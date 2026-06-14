"""
climate_engine/services/socioeconomic_service.py — Socioeconomic Data Service
Architecture v2.0:
- LRU cache with TTL and memory bounds
- Dual-geocoder fallback (Open-Meteo -> Nominatim)
- Proper rate limiting with exponential backoff
- Offline Geo-Economic Vault routing
- Density-aware metro population estimation
- Thread-safe cache operations
- Administrative keyword extraction
"""

from __future__ import annotations

import asyncio
import logging
import time
import re
import math
import json
import os
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Set, Tuple

import httpx
import pycountry

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# OFFLINE VAULT LOADERS
# ═══════════════════════════════════════════════════════════════════════════════

try:
    _VAULT_PATH = os.path.join(os.path.dirname(__file__), '../data/socio_vault.json')
    with open(_VAULT_PATH, 'r') as _f:
        _OFFLINE_VAULT = json.load(_f)
except Exception as e:
    logger.error("Failed to load offline vault in socio_service.py: %s", e)
    _OFFLINE_VAULT = {}

try:
    _CITY_VAULT_PATH = os.path.join(os.path.dirname(__file__), '../data/city_vault.json')
    with open(_CITY_VAULT_PATH, 'r') as _f:
        _CITY_VAULT: dict = json.load(_f)
    logger.info("City Vault loaded: %d verified city entries", len(_CITY_VAULT))
except Exception as e:
    logger.error("Failed to load city vault: %s", e)
    _CITY_VAULT = {}

# Offline metropolitan-population vault — Natural Earth `pop_max` (public domain).
# 7,900+ world cities with true metro-area populations. Fully offline: no runtime
# HTTP, no rate limits, instant O(1) lookup. Rebuild via scripts/build_metro_vault.py.
try:
    _METRO_VAULT_PATH = os.path.join(os.path.dirname(__file__), '../data/world_metro_pop.json')
    with open(_METRO_VAULT_PATH, 'r') as _f:
        _mv = json.load(_f)
    _METRO_KEYED: dict = _mv.get("keyed", {})
    _METRO_BARE: dict = _mv.get("bare", {})
    logger.info("Metro Population Vault loaded: %d keyed cities", len(_METRO_KEYED))
except Exception as e:
    logger.error("Failed to load metro population vault: %s", e)
    _METRO_KEYED, _METRO_BARE = {}, {}


def _metro_pop_lookup(city: str, iso2: str) -> Optional[int]:
    """
    Offline metro-area population (Natural Earth pop_max), disambiguated by the
    already-resolved country. Returns None when the city is not in the vault
    (caller then falls back to the live GeoNames figure).
    """
    import unicodedata as _ud
    def _slug(s: str) -> str:
        s = _ud.normalize("NFD", s or "").encode("ascii", "ignore").decode()
        s = re.sub(r"[^a-z0-9 ]", "", s.lower())
        return re.sub(r"\s+", "_", s.strip())

    core = _slug(city.split(",")[0])
    if not core:
        return None
    cc = (iso2 or "").upper()
    if cc:
        hit = _METRO_KEYED.get(f"{core}|{cc}")
        if hit:
            return int(hit)
    return None


# ── Census Data Validator ──────────────────────────────────────────────────────

def validate_census_data(pop: int, city: str) -> bool:
    """
    Strict boundary check on population figures before they enter the pipeline.
    Megacities cap: 35M (Tokyo metro is ~37M — the single realistic upper bound).
    Minimum: 10K (below this, geocoder likely returned a village, not a city).
    """
    if pop > 35_000_000 or pop < 10_000:
        logger.critical(
            "CRITICAL: Data Poisoning Detected — population %d for '%s' "
            "is outside defensible bounds [10K, 35M]. Defaulting to "
            "World Bank national averages.",
            pop, city,
        )
        return False
    return True


def _city_vault_key(city: str) -> Optional[str]:
    """
    Map a raw city query string to a city vault key via slug matching.
    Tries exact slug match, then partial first-token match.
    """
    import unicodedata
    def _slug(s: str) -> str:
        s = unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode()
        s = re.sub(r'[^a-z0-9 ]', '', s.lower())
        return re.sub(r'\s+', '_', s.strip())

    parts = [p.strip() for p in city.split(',')]
    # Try "city_country" slug first
    if len(parts) >= 2:
        slug = _slug(f"{parts[0]} {parts[-1]}")
        if slug in _CITY_VAULT:
            return slug
    # Try city-only slug
    city_slug = _slug(parts[0])
    for key in _CITY_VAULT:
        if key.startswith(city_slug):
            return key
    return None

# ═══════════════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ═══════════════════════════════════════════════════════════════════════════════

HEADERS = {
    "User-Agent": "ClimateRisk-Engine/2.1 (https://github.com/aakash029-coder/openplanet-climate; research)",
    "Accept": "application/json",
}

CACHE_MAX_CITIES = 50_000
CACHE_TTL_SECONDS = 86_400 * 7      # 7 days
COUNTRY_CACHE_TTL = 86_400 * 30     # 30 days

WORLD_BANK_SEMAPHORE = asyncio.Semaphore(3)
OPEN_METEO_SEMAPHORE = asyncio.Semaphore(10)
# Enforces Nominatim's strict 1-req/sec ToS
NOMINATIM_SEMAPHORE = asyncio.Semaphore(1)


# ═══════════════════════════════════════════════════════════════════════════════
# GEO-ECONOMIC TIER VAULT
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass(frozen=True, slots=True)
class GeoEconomicTier:
    gdp_per_capita: float
    urban_share: float
    life_expectancy: float
    physicians_per1000: float
    pct_under15: float
    pct_over65: float
    density_factor: float


GEO_TIERS: Dict[str, GeoEconomicTier] = {
    "NORTH_AMERICA_HIGH": GeoEconomicTier(
        gdp_per_capita=65000, urban_share=83, life_expectancy=79,
        physicians_per1000=2.6, pct_under15=18, pct_over65=17, density_factor=0.7,
    ),
    "EUROPE_HIGH": GeoEconomicTier(
        gdp_per_capita=48000, urban_share=75, life_expectancy=81,
        physicians_per1000=3.8, pct_under15=15, pct_over65=20, density_factor=1.1,
    ),
    "EAST_ASIA_HIGH": GeoEconomicTier(
        gdp_per_capita=42000, urban_share=82, life_expectancy=84,
        physicians_per1000=2.5, pct_under15=12, pct_over65=28, density_factor=1.4,
    ),
    "OCEANIA_HIGH": GeoEconomicTier(
        gdp_per_capita=55000, urban_share=86, life_expectancy=83,
        physicians_per1000=3.7, pct_under15=19, pct_over65=16, density_factor=0.5,
    ),
    "GULF_HIGH": GeoEconomicTier(
        gdp_per_capita=35000, urban_share=85, life_expectancy=78,
        physicians_per1000=2.3, pct_under15=20, pct_over65=3, density_factor=0.9,
    ),
    "EUROPE_UPPER_MID": GeoEconomicTier(
        gdp_per_capita=18000, urban_share=70, life_expectancy=76,
        physicians_per1000=3.2, pct_under15=15, pct_over65=18, density_factor=1.0,
    ),
    "LATAM_UPPER_MID": GeoEconomicTier(
        gdp_per_capita=12000, urban_share=81, life_expectancy=75,
        physicians_per1000=2.1, pct_under15=23, pct_over65=9, density_factor=1.2,
    ),
    "EAST_ASIA_UPPER_MID": GeoEconomicTier(
        gdp_per_capita=12500, urban_share=62, life_expectancy=77,
        physicians_per1000=2.2, pct_under15=17, pct_over65=13, density_factor=1.5,
    ),
    "SOUTH_ASIA_LOWER_MID": GeoEconomicTier(
        gdp_per_capita=2500, urban_share=36, life_expectancy=70,
        physicians_per1000=0.8, pct_under15=26, pct_over65=7, density_factor=1.8,
    ),
    "SOUTHEAST_ASIA_LOWER_MID": GeoEconomicTier(
        gdp_per_capita=4500, urban_share=52, life_expectancy=72,
        physicians_per1000=0.9, pct_under15=24, pct_over65=8, density_factor=1.4,
    ),
    "AFRICA_LOWER_MID": GeoEconomicTier(
        gdp_per_capita=1800, urban_share=45, life_expectancy=65,
        physicians_per1000=0.3, pct_under15=40, pct_over65=4, density_factor=1.3,
    ),
    "MENA_LOWER_MID": GeoEconomicTier(
        gdp_per_capita=4000, urban_share=65, life_expectancy=73,
        physicians_per1000=1.2, pct_under15=30, pct_over65=6, density_factor=1.1,
    ),
    "AFRICA_LOW": GeoEconomicTier(
        gdp_per_capita=700, urban_share=32, life_expectancy=62,
        physicians_per1000=0.1, pct_under15=44, pct_over65=3, density_factor=1.2,
    ),
    "SOUTH_ASIA_FRAGILE": GeoEconomicTier(
        gdp_per_capita=550, urban_share=26, life_expectancy=65,
        physicians_per1000=0.3, pct_under15=42, pct_over65=4, density_factor=1.6,
    ),
    "SMALL_ISLAND_DEVELOPING": GeoEconomicTier(
        gdp_per_capita=8000, urban_share=55, life_expectancy=71,
        physicians_per1000=1.0, pct_under15=28, pct_over65=8, density_factor=1.3,
    ),
}

COUNTRY_TO_TIER: Dict[str, str] = {
    "US": "NORTH_AMERICA_HIGH", "CA": "NORTH_AMERICA_HIGH",
    "DE": "EUROPE_HIGH", "FR": "EUROPE_HIGH", "GB": "EUROPE_HIGH",
    "IT": "EUROPE_HIGH", "ES": "EUROPE_HIGH", "NL": "EUROPE_HIGH",
    "BE": "EUROPE_HIGH", "AT": "EUROPE_HIGH", "CH": "EUROPE_HIGH",
    "SE": "EUROPE_HIGH", "NO": "EUROPE_HIGH", "DK": "EUROPE_HIGH",
    "FI": "EUROPE_HIGH", "IE": "EUROPE_HIGH", "PT": "EUROPE_HIGH",
    "LU": "EUROPE_HIGH", "IS": "EUROPE_HIGH",
    "JP": "EAST_ASIA_HIGH", "KR": "EAST_ASIA_HIGH", "TW": "EAST_ASIA_HIGH",
    "SG": "EAST_ASIA_HIGH", "HK": "EAST_ASIA_HIGH",
    "AU": "OCEANIA_HIGH", "NZ": "OCEANIA_HIGH",
    "AE": "GULF_HIGH", "SA": "GULF_HIGH", "QA": "GULF_HIGH",
    "KW": "GULF_HIGH", "BH": "GULF_HIGH", "OM": "GULF_HIGH",
    "PL": "EUROPE_UPPER_MID", "CZ": "EUROPE_UPPER_MID", "HU": "EUROPE_UPPER_MID",
    "RO": "EUROPE_UPPER_MID", "BG": "EUROPE_UPPER_MID", "HR": "EUROPE_UPPER_MID",
    "SK": "EUROPE_UPPER_MID", "SI": "EUROPE_UPPER_MID", "LT": "EUROPE_UPPER_MID",
    "LV": "EUROPE_UPPER_MID", "EE": "EUROPE_UPPER_MID", "GR": "EUROPE_UPPER_MID",
    "RS": "EUROPE_UPPER_MID", "UA": "EUROPE_UPPER_MID", "BY": "EUROPE_UPPER_MID",
    "RU": "EUROPE_UPPER_MID", "TR": "EUROPE_UPPER_MID",
    "MX": "LATAM_UPPER_MID", "BR": "LATAM_UPPER_MID", "AR": "LATAM_UPPER_MID",
    "CL": "LATAM_UPPER_MID", "CO": "LATAM_UPPER_MID", "PE": "LATAM_UPPER_MID",
    "VE": "LATAM_UPPER_MID", "EC": "LATAM_UPPER_MID", "CR": "LATAM_UPPER_MID",
    "PA": "LATAM_UPPER_MID", "UY": "LATAM_UPPER_MID", "DO": "LATAM_UPPER_MID",
    "CN": "EAST_ASIA_UPPER_MID", "TH": "EAST_ASIA_UPPER_MID", "MY": "EAST_ASIA_UPPER_MID",
    "IN": "SOUTH_ASIA_LOWER_MID", "BD": "SOUTH_ASIA_LOWER_MID",
    "PK": "SOUTH_ASIA_LOWER_MID", "LK": "SOUTH_ASIA_LOWER_MID",
    "NP": "SOUTH_ASIA_LOWER_MID",
    "ID": "SOUTHEAST_ASIA_LOWER_MID", "PH": "SOUTHEAST_ASIA_LOWER_MID",
    "VN": "SOUTHEAST_ASIA_LOWER_MID", "MM": "SOUTHEAST_ASIA_LOWER_MID",
    "KH": "SOUTHEAST_ASIA_LOWER_MID", "LA": "SOUTHEAST_ASIA_LOWER_MID",
    "NG": "AFRICA_LOWER_MID", "GH": "AFRICA_LOWER_MID", "KE": "AFRICA_LOWER_MID",
    "CI": "AFRICA_LOWER_MID", "SN": "AFRICA_LOWER_MID", "CM": "AFRICA_LOWER_MID",
    "ZA": "AFRICA_LOWER_MID", "EG": "AFRICA_LOWER_MID", "MA": "AFRICA_LOWER_MID",
    "TN": "AFRICA_LOWER_MID", "DZ": "AFRICA_LOWER_MID",
    "IR": "MENA_LOWER_MID", "IQ": "MENA_LOWER_MID", "JO": "MENA_LOWER_MID",
    "LB": "MENA_LOWER_MID", "PS": "MENA_LOWER_MID",
    "ET": "AFRICA_LOW", "TZ": "AFRICA_LOW", "UG": "AFRICA_LOW",
    "RW": "AFRICA_LOW", "MW": "AFRICA_LOW", "MZ": "AFRICA_LOW",
    "ZM": "AFRICA_LOW", "ZW": "AFRICA_LOW", "SD": "AFRICA_LOW",
    "SS": "AFRICA_LOW", "CD": "AFRICA_LOW", "CF": "AFRICA_LOW",
    "TD": "AFRICA_LOW", "NE": "AFRICA_LOW", "ML": "AFRICA_LOW",
    "BF": "AFRICA_LOW", "SO": "AFRICA_LOW", "ER": "AFRICA_LOW",
    "MR": "AFRICA_LOW", "GM": "AFRICA_LOW", "GN": "AFRICA_LOW",
    "SL": "AFRICA_LOW", "LR": "AFRICA_LOW", "BI": "AFRICA_LOW",
    "AF": "SOUTH_ASIA_FRAGILE", "YE": "SOUTH_ASIA_FRAGILE",
    "SY": "SOUTH_ASIA_FRAGILE", "HT": "SOUTH_ASIA_FRAGILE",
    "FJ": "SMALL_ISLAND_DEVELOPING", "WS": "SMALL_ISLAND_DEVELOPING",
    "TO": "SMALL_ISLAND_DEVELOPING", "VU": "SMALL_ISLAND_DEVELOPING",
    "SB": "SMALL_ISLAND_DEVELOPING", "PG": "SMALL_ISLAND_DEVELOPING",
    "MV": "SMALL_ISLAND_DEVELOPING", "MU": "SMALL_ISLAND_DEVELOPING",
    "SC": "SMALL_ISLAND_DEVELOPING", "CV": "SMALL_ISLAND_DEVELOPING",
    "JM": "SMALL_ISLAND_DEVELOPING", "TT": "SMALL_ISLAND_DEVELOPING",
    "BB": "SMALL_ISLAND_DEVELOPING", "BS": "SMALL_ISLAND_DEVELOPING",
    "CU": "SMALL_ISLAND_DEVELOPING", "PR": "SMALL_ISLAND_DEVELOPING",
}

DEFAULT_TIER = "AFRICA_LOWER_MID"


def get_tier_for_country(iso2: str) -> GeoEconomicTier:
    tier_name = COUNTRY_TO_TIER.get(iso2.upper(), DEFAULT_TIER)
    return GEO_TIERS[tier_name]


# ═══════════════════════════════════════════════════════════════════════════════
# THREAD-SAFE LRU CACHE WITH TTL
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass
class CacheEntry:
    data: Dict[str, Any]
    timestamp: float = field(default_factory=time.time)

    def is_expired(self, ttl: float) -> bool:
        return (time.time() - self.timestamp) > ttl


class BoundedTTLCache:
    __slots__ = ("_cache", "_max_size", "_ttl", "_lock", "_hits", "_misses")

    def __init__(self, max_size: int, ttl_seconds: float):
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._max_size = max_size
        self._ttl = ttl_seconds
        self._lock = asyncio.Lock()
        self._hits = 0
        self._misses = 0

    async def get(self, key: str) -> Optional[Dict[str, Any]]:
        entry = self._cache.get(key)
        if entry is None:
            self._misses += 1
            return None
        if entry.is_expired(self._ttl):
            async with self._lock:
                self._cache.pop(key, None)
            self._misses += 1
            return None
        self._cache.move_to_end(key)
        self._hits += 1
        return entry.data

    async def set(self, key: str, value: Dict[str, Any]) -> None:
        async with self._lock:
            if key in self._cache:
                self._cache[key] = CacheEntry(data=value)
                self._cache.move_to_end(key)
                return
            while len(self._cache) >= self._max_size:
                self._cache.popitem(last=False)
            self._cache[key] = CacheEntry(data=value)

    async def invalidate(self, key: str) -> bool:
        """Remove a single entry. Returns True if key existed."""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
        return False

    async def clear(self) -> int:
        """Flush the entire cache. Returns number of entries removed."""
        async with self._lock:
            count = len(self._cache)
            self._cache.clear()
            self._hits = 0
            self._misses = 0
        return count

    @property
    def stats(self) -> Dict[str, Any]:
        total = self._hits + self._misses
        return {
            "size": len(self._cache),
            "max_size": self._max_size,
            "hits": self._hits,
            "misses": self._misses,
            "hit_rate": self._hits / total if total > 0 else 0.0,
        }


_city_cache = BoundedTTLCache(max_size=CACHE_MAX_CITIES, ttl_seconds=CACHE_TTL_SECONDS)
_country_cache = BoundedTTLCache(max_size=300, ttl_seconds=COUNTRY_CACHE_TTL)


# ═══════════════════════════════════════════════════════════════════════════════
# ISO CODE HANDLING
# ═══════════════════════════════════════════════════════════════════════════════

ISO2_TO_ISO3_OVERRIDES: Dict[str, str] = {
    "XK": "XKX",  # Kosovo
    "TW": "TWN",
    "PS": "PSE",
    "AN": "ANT",
    "CS": "SCG",
}


def iso2_to_iso3(iso2: str) -> str:
    code = iso2.upper().strip()
    if code in ISO2_TO_ISO3_OVERRIDES:
        return ISO2_TO_ISO3_OVERRIDES[code]
    country = pycountry.countries.get(alpha_2=code)
    if country:
        return country.alpha_3
    logger.warning("ISO2 '%s' unresolvable, using WLD for World Bank queries", code)
    return "WLD"


# ═══════════════════════════════════════════════════════════════════════════════
# SMART KEYWORD EXTRACTOR
# ═══════════════════════════════════════════════════════════════════════════════

def _clean_city_keyword(raw_city: str) -> str:
    """
    Strips administrative prefixes to extract the core geographical entity.
    Prevents lookup errors from varied naming conventions.
    """
    # Handle literal 'undefined' passed by client configurations
    cleaned = re.sub(r",\s*undefined\b", "", raw_city, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"\bundefined\b", "", cleaned, flags=re.IGNORECASE).strip()

    # Strip trailing punctuation artifacts
    cleaned = cleaned.strip(",;. ").strip()

    parts = [p.strip() for p in cleaned.split(",")]
    core_city = parts[0]

    # Pattern stripping (order matters: most specific to least specific)
    # Prefix-only stripping — removes administrative wrappers that precede the
    # actual place name. Suffix patterns are intentionally absent: stripping
    # trailing words (e.g. "city", "metropolitan area") from the end of a name
    # risks silently corrupting legitimate toponyms such as "Ho Chi Minh City".
    noise_patterns = [
        r"^special\s+capital\s+region\s+of\s+",
        r"^national\s+capital\s+region\s+of\s+",
        r"^national\s+capital\s+territory\s+of\s+",
        r"^federal\s+territory\s+of\s+",
        r"^province\s+of\s+",
        r"^state\s+of\s+",
        r"^city\s+of\s+",
        r"^greater\s+",
        r"^municipality\s+of\s+",
        r"^metropolitan\s+area\s+of\s+",
        r"^metropolitan\s+",
        r"^urban\s+area\s+of\s+",
    ]
    for pattern in noise_patterns:
        core_city = re.sub(pattern, "", core_city, flags=re.IGNORECASE).strip()

    if not core_city:
        # Return original input if aggressive stripping leaves string empty
        return raw_city

    parts[0] = core_city
    return ", ".join(p for p in parts if p)


def _prepare_geocoding_query(raw_city: str) -> str:
    """
    Normalize client artifacts while preserving the full location string
    (city, region, country) for geocoder APIs.
    """
    return _clean_city_keyword(raw_city.strip())


def _location_country_hint(location: str) -> Optional[str]:
    """
    Return the country token from 'City, Country' or 'City Country' queries.
    Handles both comma-separated ("Oxford, UK") and space-separated ("Oxford UK").
    Does NOT split multi-word city names like "New York" or "Mexico City".
    """
    # Comma-separated: always trust the last segment
    if "," in location:
        parts = [p.strip() for p in location.split(",") if p.strip()]
        return parts[-1] if len(parts) >= 2 else None

    # Space-separated: last word is a country only if it resolves to an ISO code
    words = location.strip().split()
    if len(words) >= 2:
        last = words[-1]
        if _country_codes_from_hint(last):
            return last
    return None


def _city_token_for_geocoder(location: str) -> str:
    """
    Return the city-only portion of a query, stripping any trailing country token.
    'Oxford, UK' → 'Oxford',  'Delhi India' → 'Delhi',  'New York' → 'New York'.
    """
    hint = _location_country_hint(location)
    if hint:
        if "," in location:
            return location.split(",")[0].strip()
        # Space-separated: strip the last word (the country hint)
        words = location.strip().split()
        return " ".join(words[:-1]).strip() or location
    return location.split(",")[0].strip()


# Informal/colloquial names not in pycountry's ISO database
_COUNTRY_ALIASES: Dict[str, str] = {
    "uk": "GB", "england": "GB", "britain": "GB", "great britain": "GB",
    "scotland": "GB", "wales": "GB", "northern ireland": "GB",
    "usa": "US", "america": "US", "united states of america": "US",
    "uae": "AE", "emirates": "AE",
    "south korea": "KR", "korea": "KR",
    "north korea": "KP",
    "russia": "RU",
    "iran": "IR", "persia": "IR",
    "vietnam": "VN", "viet nam": "VN",
    "laos": "LA",
    "bolivia": "BO",
    "taiwan": "TW",
    "moldova": "MD",
    "czechia": "CZ", "czech republic": "CZ",
    "syria": "SY",
    "tanzania": "TZ",
    "congo": "CD",
    "ivory coast": "CI", "cote d'ivoire": "CI",
}


def _country_codes_from_hint(hint: str) -> Set[str]:
    """Map a country name or ISO code hint to alpha-2 codes."""
    normalized = hint.strip().lower()
    if not normalized:
        return set()

    # Check informal alias table first
    if normalized in _COUNTRY_ALIASES:
        return {_COUNTRY_ALIASES[normalized]}

    codes: Set[str] = set()
    for country in pycountry.countries:
        names = {country.name.lower()}
        if getattr(country, "common_name", None):
            names.add(country.common_name.lower())
        official = getattr(country, "official_name", None)
        if official:
            names.add(official.lower())

        if normalized in names:
            codes.add(country.alpha_2.upper())
        if normalized in (country.alpha_2.lower(), country.alpha_3.lower()):
            codes.add(country.alpha_2.upper())

    return codes


def _select_openmeteo_hit(results: List[Dict[str, Any]], location_query: str) -> Dict[str, Any]:
    """Prefer geocoder hits that match an explicit country hint in the query."""
    country_hint = _location_country_hint(location_query)
    if country_hint:
        codes = _country_codes_from_hint(country_hint)
        if codes:
            matching = [
                r for r in results
                if (r.get("country_code") or "").upper() in codes
            ]
            if matching:
                return max(matching, key=lambda r: r.get("population") or 0)

    return max(results, key=lambda r: r.get("population") or 0)


def _select_nominatim_hit(results: List[Dict[str, Any]], location_query: str) -> Dict[str, Any]:
    """Prefer Nominatim hits that match an explicit country hint in the query."""
    country_hint = _location_country_hint(location_query)
    if country_hint:
        codes = _country_codes_from_hint(country_hint)
        if codes:
            for hit in results:
                cc = (hit.get("address", {}).get("country_code") or "").upper()
                if cc in codes:
                    return hit

    return results[0]


# ═══════════════════════════════════════════════════════════════════════════════
# GEOCODING (Dual Provider)
# ═══════════════════════════════════════════════════════════════════════════════

@dataclass(frozen=True, slots=True)
class GeocodingResult:
    city_population: int
    country_code: str
    latitude: float
    longitude: float
    source: str


@dataclass(frozen=True, slots=True)
class GeocodingCandidate:
    id: str
    name: str
    display_name: str
    country: str
    country_code: str
    latitude: float
    longitude: float
    source: str


async def _fetch_openmeteo_geocoding(
    location_query: str,
    client: httpx.AsyncClient,
) -> GeocodingResult:
    url = "https://geocoding-api.open-meteo.com/v1/search"
    # Open-Meteo only understands city names in `name`; country filtering is
    # applied post-query via _select_openmeteo_hit using the full location_query.
    city_name_only = location_query.split(",")[0].strip()
    params = {"name": city_name_only, "count": 10, "format": "json"}

    data: Dict[str, Any] = {}
    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        async with OPEN_METEO_SEMAPHORE:
            try:
                resp = await client.get(url, params=params, timeout=8.0)
                if resp.status_code == 429:
                    await asyncio.sleep(2 ** attempt)
                    continue
                resp.raise_for_status()
                data = resp.json()
                break
            except Exception as exc:
                if attempt < max_attempts:
                    await asyncio.sleep(2 ** attempt)
                else:
                    raise ValueError(
                        f"Open-Meteo geocoding failed for '{location_query}': {exc}"
                    ) from exc

    results = data.get("results", [])
    if not results:
        raise ValueError(f"Open-Meteo: no results for '{location_query}'")

    hit = _select_openmeteo_hit(results, location_query)
    country_code = (hit.get("country_code") or "").upper()

    base_population = hit.get("population") or 0
    tier = get_tier_for_country(country_code)
    
    if base_population > 0:
        metro_population = int(base_population * tier.density_factor)
    else:
        metro_population = int(500_000 * tier.density_factor) 

    return GeocodingResult(
        city_population=metro_population,
        country_code=country_code,
        latitude=hit.get("latitude", 0.0),
        longitude=hit.get("longitude", 0.0),
        source="open-meteo",
    )


async def _fetch_openmeteo_population(
    location_query: str,
    country_code_hint: str,
    client: httpx.AsyncClient,
) -> int:
    """
    Authoritative per-city population from Open-Meteo's GeoNames index.

    Returns the REAL settlement population (GeoNames), disambiguated by the
    already-resolved country code so e.g. "La Paz" maps to the correct country.
    Returns 0 when no population figure is available (caller then falls back).

    This replaces the legacy flat-500k placeholder that gave every non-vault
    city on Earth the same population regardless of its true size.
    """
    url = "https://geocoding-api.open-meteo.com/v1/search"
    city_name_only = _city_token_for_geocoder(location_query)
    params = {"name": city_name_only, "count": 10, "format": "json"}

    for attempt in range(1, 4):
        async with OPEN_METEO_SEMAPHORE:
            try:
                resp = await client.get(url, params=params, timeout=8.0)
                if resp.status_code == 429:
                    await asyncio.sleep(2 ** attempt)
                    continue
                resp.raise_for_status()
                results = resp.json().get("results", [])
                break
            except Exception as exc:
                if attempt >= 3:
                    logger.warning("[population] Open-Meteo lookup failed for '%s': %s", location_query, exc)
                    return 0
                await asyncio.sleep(2 ** attempt)
    else:
        return 0

    if not results:
        return 0

    # Prefer hits in the country we already resolved via the primary geocoder;
    # among those, take the most-populous (the principal city of that name).
    cc = (country_code_hint or "").upper()
    same_country = [r for r in results if (r.get("country_code") or "").upper() == cc]
    pool = same_country or results
    best = max(pool, key=lambda r: r.get("population") or 0)
    return int(best.get("population") or 0)


async def _fetch_nominatim_geocoding(
    location_query: str,
    client: httpx.AsyncClient,
) -> GeocodingResult:
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": location_query,
        "format": "json",
        "limit": 5,
        "addressdetails": 1,
    }

    async with NOMINATIM_SEMAPHORE:
        try:
            nom_headers = {
                **HEADERS,
                "User-Agent": "ClimateRisk-Research/2.1 (https://github.com/aakash029-coder/openplanet-climate; officialaakash029@gmail.com)",
            }
            # Add micro-sleep to comply with Nominatim's 1 req/sec ToS
            await asyncio.sleep(1.1)
            resp = await client.get(url, params=params, headers=nom_headers, timeout=15.0)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            raise ValueError(
                f"Nominatim geocoding failed for '{location_query}': {exc}"
            ) from exc

    if not data:
        raise ValueError(f"Nominatim: no results for '{location_query}'")

    hit = _select_nominatim_hit(data, location_query)
    address = hit.get("address", {})
    country_code = (address.get("country_code") or "").upper()

    tier = get_tier_for_country(country_code)
    fallback_population = int(1_000_000 * tier.density_factor)

    return GeocodingResult(
        city_population=fallback_population,
        country_code=country_code,
        latitude=float(hit.get("lat", 0)),
        longitude=float(hit.get("lon", 0)),
        source="nominatim",
    )


async def _search_photon_candidates(
    query: str, client: httpx.AsyncClient
) -> List[GeocodingCandidate]:
    """
    Photon geocoder by Komoot — Elasticsearch-backed OSM data.
    No API key, no rate limit, sub-100ms response times.
    Open source: github.com/komoot/photon
    """
    url = "https://photon.komoot.io/api/"
    # Send only the city portion to Photon; country applied as post-filter.
    # Sending "Oxford, UK" or "Oxford UK" literally matches objects with "UK" in name.
    city_token = _city_token_for_geocoder(query)
    params = {"q": city_token, "limit": 10, "lang": "en"}

    resp = await client.get(url, params=params, headers=HEADERS, timeout=8.0)
    resp.raise_for_status()
    data = resp.json()

    features = data.get("features", [])

    # Prefer administrative-level features over streets / houses
    PLACE_TYPES = {"city", "district", "municipality", "county", "locality", "region", "borough"}
    city_features = [
        f for f in features
        if f.get("properties", {}).get("type", "").lower() in PLACE_TYPES
    ]
    if not city_features:
        city_features = features

    # Apply country hint post-filter
    country_hint = _location_country_hint(query)
    if country_hint:
        codes = _country_codes_from_hint(country_hint)
        if codes:
            filtered = [
                f for f in city_features
                if (f.get("properties", {}).get("countrycode") or "").upper() in codes
            ]
            if filtered:
                city_features = filtered

    candidates: List[GeocodingCandidate] = []
    seen: set = set()
    for f in city_features:
        if len(candidates) >= 5:
            break
        props = f.get("properties", {})
        coords = f.get("geometry", {}).get("coordinates", [0.0, 0.0])  # GeoJSON [lng, lat]

        country_code = (props.get("countrycode") or "").upper()
        country = props.get("country", "")
        city_name = props.get("name") or props.get("city") or query.split(",")[0].strip()

        # Deduplicate by (name, country_code)
        dedup_key = (city_name.lower(), country_code)
        if dedup_key in seen:
            continue
        seen.add(dedup_key)

        parts = [p for p in [city_name, props.get("state"), country] if p]
        display = ", ".join(dict.fromkeys(parts))

        candidates.append(GeocodingCandidate(
            id=f"photon-{props.get('osm_id', len(candidates))}",
            name=city_name,
            display_name=display,
            country=country,
            country_code=country_code,
            latitude=float(coords[1]),
            longitude=float(coords[0]),
            source="photon-osm",
        ))

    return candidates


async def _search_nominatim_candidates(
    query: str, client: httpx.AsyncClient
) -> List[GeocodingCandidate]:
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": query, "format": "json", "limit": 5, "addressdetails": 1}
    nom_headers = {
        **HEADERS,
        "User-Agent": "ClimateRisk-Research/2.1 (https://github.com/aakash029-coder/openplanet-climate; officialaakash029@gmail.com)",
    }

    async with NOMINATIM_SEMAPHORE:
        await asyncio.sleep(1.1)
        resp = await client.get(url, params=params, headers=nom_headers, timeout=15.0)
        resp.raise_for_status()
        data = resp.json()

    candidates: List[GeocodingCandidate] = []
    for r in data[:5]:
        address = r.get("address", {})
        country = address.get("country", "")
        country_code = (address.get("country_code") or "").upper()
        city_name = (
            address.get("city") or address.get("town") or address.get("municipality") or
            r.get("name") or r.get("display_name", query).split(",")[0].strip()
        )
        candidates.append(GeocodingCandidate(
            id=str(r.get("place_id", f"nom-{len(candidates)}")),
            name=city_name,
            display_name=r.get("display_name", ""),
            country=country,
            country_code=country_code,
            latitude=float(r.get("lat", 0)),
            longitude=float(r.get("lon", 0)),
            source="nominatim-osm",
        ))
    return candidates


async def _search_openmeteo_candidates(
    query: str, client: httpx.AsyncClient
) -> List[GeocodingCandidate]:
    url = "https://geocoding-api.open-meteo.com/v1/search"
    city_name_only = _city_token_for_geocoder(query)
    params = {"name": city_name_only, "count": 5, "format": "json"}

    async with OPEN_METEO_SEMAPHORE:
        resp = await client.get(url, params=params, timeout=8.0)
        resp.raise_for_status()
        data = resp.json()

    results = data.get("results", [])
    country_hint = _location_country_hint(query)
    if country_hint:
        codes = _country_codes_from_hint(country_hint)
        if codes:
            filtered = [r for r in results if (r.get("country_code") or "").upper() in codes]
            if filtered:
                results = filtered

    candidates: List[GeocodingCandidate] = []
    for r in results[:5]:
        country_code = (r.get("country_code") or "").upper()
        admin1 = r.get("admin1", "")
        country = r.get("country", "")
        display = ", ".join(p for p in [r.get("name", ""), admin1, country] if p)
        candidates.append(GeocodingCandidate(
            id=str(r.get("id", f"om-{len(candidates)}")),
            name=r.get("name", ""),
            display_name=display,
            country=country,
            country_code=country_code,
            latitude=float(r.get("latitude", 0)),
            longitude=float(r.get("longitude", 0)),
            source="open-meteo",
        ))
    return candidates


async def search_geocode_candidates(
    query: str, client: httpx.AsyncClient
) -> List[GeocodingCandidate]:
    """
    Returns up to 5 location candidates for autocomplete.
    3-tier cascade (all free, no API keys required):
      Tier 1: Photon/Komoot — Elasticsearch-backed OSM, sub-100ms, no rate limit
      Tier 2: Open-Meteo — GeoNames data, population-weighted ranking
      Tier 3: Nominatim — authoritative OSM, rate-limited to 1 req/sec
    """
    location_query = _prepare_geocoding_query(query)

    try:
        results = await _search_photon_candidates(location_query, client)
        if results:
            return results
    except Exception as e:
        logger.warning("Photon search failed for '%s': %s", location_query, e)

    try:
        results = await _search_openmeteo_candidates(location_query, client)
        if results:
            return results
    except Exception as e:
        logger.warning("Open-Meteo search failed for '%s': %s", location_query, e)

    try:
        return await _search_nominatim_candidates(location_query, client)
    except Exception as e:
        logger.warning("Nominatim search failed for '%s': %s", location_query, e)

    return []


async def geocode_city(city: str, client: httpx.AsyncClient) -> GeocodingResult:
    """
    Geocode a single location to precise WGS-84 coordinates.
    3-tier cascade (all free, no API keys required):
      Tier 1: Photon/Komoot — highest spatial accuracy, no rate limit
      Tier 2: Open-Meteo — includes population for metro-size estimates
      Tier 3: Nominatim — authoritative OSM fallback
    """
    location_query = _prepare_geocoding_query(city)
    if location_query.lower() != city.strip().lower():
        logger.info("Geocoding query normalized: '%s' -> '%s'", city, location_query)

    def _candidate_to_result(c: GeocodingCandidate) -> GeocodingResult:
        tier = get_tier_for_country(c.country_code)
        return GeocodingResult(
            city_population=int(500_000 * tier.density_factor),
            country_code=c.country_code,
            latitude=c.latitude,
            longitude=c.longitude,
            source=c.source,
        )

    try:
        candidates = await _search_photon_candidates(location_query, client)
        if candidates:
            logger.info(
                "[geocode] Photon resolved '%s' -> (%.4f, %.4f) [%s]",
                location_query, candidates[0].latitude, candidates[0].longitude, candidates[0].country_code,
            )
            return _candidate_to_result(candidates[0])
    except Exception as e:
        logger.warning("Photon geocoding failed for '%s': %s", location_query, e)

    try:
        return await _fetch_openmeteo_geocoding(location_query, client)
    except ValueError as e:
        logger.warning("Open-Meteo geocoding failed for '%s': %s", location_query, e)

    try:
        return await _fetch_nominatim_geocoding(location_query, client)
    except ValueError as e:
        raise ValueError(
            f"All geocoding providers failed for '{city}' (query: '{location_query}'). "
            f"Please verify spelling or input a major surrounding municipality. Log: {e}"
        ) from e


# ═══════════════════════════════════════════════════════════════════════════════
# OFFLINE DATA ROUTER
# ═══════════════════════════════════════════════════════════════════════════════

async def fetch_un_death_rate(iso3: str, client: httpx.AsyncClient) -> Optional[float]:
    """
    Fetches Crude Death Rate (Indicator 59) directly from the UN Population Division API.
    """
    try:
        country = pycountry.countries.get(alpha_3=iso3.upper())
        if not country:
            return None
        un_code = country.numeric
        
        # API endpoint for Crude Death Rate (59)
        url = f"https://population.un.org/dataportalapi/api/v1/data/indicators/59/locations/{un_code}/start/2023/end/2024"
        
        async with WORLD_BANK_SEMAPHORE:
            resp = await client.get(url, headers={"Accept": "application/json"}, timeout=10.0)
            resp.raise_for_status()
            data = resp.json()
            
            if data.get("data"):
                return float(data["data"][0]["value"])
                
    except Exception as exc:
        logger.warning("UN Population API request failed for death rate (%s): %s", iso3, exc)
        
    return None


async def fetch_country_indicators(
    iso3: str,
    iso2: str,
    client: httpx.AsyncClient,
) -> Dict[str, float]:
    """
    Resolves country indicators locally via vault mappings, providing resilient access.
    """
    cache_key = f"offline_socio_{iso3}"
    cached = await _country_cache.get(cache_key)
    if cached:
        return cached

    country_data = _OFFLINE_VAULT.get(iso3, {})
    tier = get_tier_for_country(iso2)

    final_data: Dict[str, Any] = {
        "gdp_per_capita": country_data.get("gdp_per_capita") or tier.gdp_per_capita,
        "urban_share": country_data.get("urban_share") or tier.urban_share,
        "gni_per_capita": country_data.get("gdp_per_capita") or tier.gdp_per_capita,
        "life_expectancy": country_data.get("life_expectancy") or tier.life_expectancy,
        "physicians_per1000": country_data.get("physicians_per1000") or tier.physicians_per1000,
        "pct_under15": country_data.get("pct_under15") or tier.pct_under15,
        "pct_over65": country_data.get("pct_over65") or tier.pct_over65,
        "density_factor": tier.density_factor,
    }

    logger.info("Loaded socioeconomic indicators for %s from Local Vault", iso3)

    await _country_cache.set(cache_key, final_data)
    return final_data


# ═══════════════════════════════════════════════════════════════════════════════
# DERIVED CALCULATIONS
# ═══════════════════════════════════════════════════════════════════════════════

def compute_metro_population(
    city_pop: int,
    urban_share: float,
    density_factor: float,
) -> int:
    if city_pop == 0:
        return 0

    if urban_share < 35:
        base_mult = 3.5
    elif urban_share < 55:
        base_mult = 3.0
    elif urban_share < 70:
        base_mult = 2.5
    elif urban_share < 85:
        base_mult = 2.0
    else:
        base_mult = 1.6

    adjusted_mult = base_mult / density_factor
    adjusted_mult = max(1.2, min(5.0, adjusted_mult))
    return int(city_pop * adjusted_mult)


def compute_median_age(pct_under15: float, pct_over65: float) -> float:
    pct_working = max(0.0, 100.0 - pct_under15 - pct_over65)
    median_age = (
        pct_under15 * 0.01 * 8.0
        + pct_working * 0.01 * 38.0
        + pct_over65 * 0.01 * 70.0
    )
    return round(max(15.0, min(55.0, median_age)), 1)


def compute_urban_productivity_ratio(gdp_per_capita: float) -> float:
    if gdp_per_capita < 1_000:
        return 7.0
    elif gdp_per_capita < 3_000:
        return 5.5
    elif gdp_per_capita < 7_000:
        return 4.5
    elif gdp_per_capita < 15_000:
        return 3.5
    elif gdp_per_capita < 30_000:
        return 2.8
    elif gdp_per_capita < 50_000:
        return 2.2
    return 1.8


def compute_vulnerability_multiplier(
    gdp_per_capita: float,
    median_age: float,
    physicians_per1000: float,
) -> float:
    """
    Composite vulnerability score integrating wealth proxies, physiological risk 
    (via age structures), and capacity of regional healthcare systems.
    Outputs a multiplier bounding [0.25, 2.5].
    """
    # Adaptive capacity / AC factor
    if gdp_per_capita > 40_000:
        ac_factor = 0.35
    elif gdp_per_capita > 20_000:
        ac_factor = 0.55
    elif gdp_per_capita > 8_000:
        ac_factor = 0.75
    elif gdp_per_capita > 3_000:
        ac_factor = 1.10
    else:
        ac_factor = 1.50

    # Age structure factor
    if median_age > 45:
        age_factor = 1.60
    elif median_age > 38:
        age_factor = 1.25
    elif median_age > 28:
        age_factor = 1.00
    elif median_age > 20:
        age_factor = 0.85
    else:
        age_factor = 0.70

    # Healthcare capacity factor
    if physicians_per1000 > 4.0:
        health_factor = 0.70
    elif physicians_per1000 > 2.5:
        health_factor = 0.85
    elif physicians_per1000 > 1.0:
        health_factor = 1.00
    elif physicians_per1000 > 0.3:
        health_factor = 1.25
    else:
        health_factor = 1.50

    combined = (ac_factor * age_factor * health_factor) ** (1.0 / 3.0)
    return round(max(0.25, min(2.5, combined)), 3)


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════════

async def fetch_live_socioeconomics(city: str) -> Dict[str, Any]:
    """
    Fetch comprehensive city socioeconomics.
    Priority: (1) Verified City Vault → (2) Geocoder + Country Vault → (3) Tier fallback.
    Runs validate_census_data before any population value enters the pipeline.
    """
    cache_key = city.strip().lower()
    cached = await _city_cache.get(cache_key)
    if cached:
        logger.info(
            "City cache hit: '%s' (rate: %.1f%%)",
            city,
            _city_cache.stats["hit_rate"] * 100,
        )
        return cached

    # ── Priority 1: Verified City Vault ──────────────────────────────────────
    vault_key = _city_vault_key(city)
    if vault_key:
        entry = _CITY_VAULT[vault_key]
        raw_pop = entry.get("metro_population") or entry.get("population", 0)
        if not validate_census_data(raw_pop, city):
            # Poisoned entry — skip vault, fall through to geocoder
            logger.warning("[vault] Skipping poisoned vault entry for '%s'", city)
        else:
            iso2 = entry.get("country_code", "")
            iso3 = iso2_to_iso3(iso2)
            gdp_pc = entry["gdp_pc"]
            physicians = entry["physicians"]
            death_rate_vault = entry.get("death_rate", 8.0)
            tier = get_tier_for_country(iso2)
            country_data = _OFFLINE_VAULT.get(iso3, {})
            life_exp = country_data.get("life_expectancy") or tier.life_expectancy
            pct_u15  = country_data.get("pct_under15")  or tier.pct_under15
            pct_o65  = country_data.get("pct_over65")   or tier.pct_over65
            median_age = compute_median_age(pct_u15, pct_o65)
            urban_ratio = compute_urban_productivity_ratio(gdp_pc)
            city_gdp = raw_pop * gdp_pc * urban_ratio
            vulnerability = compute_vulnerability_multiplier(gdp_pc, median_age, physicians)
            result: Dict[str, Any] = {
                "population": raw_pop,
                "city_gdp_usd": city_gdp,
                "country_code": iso2,
                "vulnerability_multiplier": vulnerability,
                "gdp_per_capita": gdp_pc,
                "median_age": median_age,
                "life_expectancy": life_exp,
                "physicians_per1000": physicians,
                "death_rate_per1000": death_rate_vault,
                "_geocoder_source": "verified_city_vault",
                "_vault_key": vault_key,
                "_tier_imputed": COUNTRY_TO_TIER.get(iso2.upper(), DEFAULT_TIER),
                "_cache_stats": _city_cache.stats,
            }
            await _city_cache.set(cache_key, result)
            logger.info(
                "[vault] City Vault hit for '%s' → key=%s  metro=%d  gdp_pc=$%d",
                city, vault_key, raw_pop, gdp_pc,
            )
            return result

    # ── Priority 2: Live geocoder + Country Vault ─────────────────────────────
    async with httpx.AsyncClient(headers=HEADERS, timeout=30.0, trust_env=False) as client:
        geo = await geocode_city(city, client)

        if not geo.country_code:
            raise ValueError(f"Geocoding returned no identifiable country parameters for '{city}'")

        iso2 = geo.country_code
        iso3 = iso2_to_iso3(iso2)
        indicators = await fetch_country_indicators(iso3, iso2, client)

        # Tier A (offline, instant): Natural Earth metro-area population.
        metro_vault_pop = _metro_pop_lookup(city, iso2)

        # Tier B (live): GeoNames per-city population, only if not in the vault.
        geonames_pop = 0
        if not metro_vault_pop:
            geonames_pop = await _fetch_openmeteo_population(city, iso2, client)

    if metro_vault_pop and metro_vault_pop > 0:
        # Natural Earth pop_max IS the metro-area figure — use directly, no multiplier.
        metro_pop = metro_vault_pop
        pop_source = "natural_earth_metro"
    elif geonames_pop and geonames_pop > 0:
        # GeoNames figures ≥ ~2M are already agglomeration/prefecture level and
        # must NOT be re-multiplied (would overshoot, e.g. Wuhan 10.4M → 17M).
        # Smaller figures are city-core and are scaled to the urban agglomeration.
        if geonames_pop >= 2_000_000:
            metro_pop = geonames_pop
        else:
            metro_pop = compute_metro_population(
                geonames_pop,
                indicators["urban_share"],
                indicators["density_factor"],
            )
        pop_source = "geonames_open_meteo"
    else:
        # Fallback: legacy geocoder placeholder (only when no real figure exists)
        city_pop = geo.city_population
        if city_pop == 0:
            logger.warning(
                "Precision population unresolvable for '%s'. Downstream scaling will be bypassed.",
                city,
            )
        metro_pop = compute_metro_population(
            city_pop,
            indicators["urban_share"],
            indicators["density_factor"],
        )
        pop_source = geo.source

    # Validate population before it enters any calculation
    if not validate_census_data(metro_pop, city):
        tier = get_tier_for_country(iso2)
        metro_pop = int(500_000 * tier.density_factor)
        logger.warning("[census] Defaulting '%s' to national-average population %d", city, metro_pop)

    median_age = compute_median_age(
        indicators["pct_under15"],
        indicators["pct_over65"],
    )

    if metro_pop > 0:
        urban_ratio = compute_urban_productivity_ratio(indicators["gdp_per_capita"])
        city_gdp = metro_pop * indicators["gdp_per_capita"] * urban_ratio
    else:
        tier = get_tier_for_country(iso2)
        city_gdp = tier.gdp_per_capita * 500_000
        logger.warning(
            "Missing accurate population data for '%s'; applying baseline regional GDP estimate: $%.1fM",
            city, city_gdp / 1e6,
        )

    vulnerability = compute_vulnerability_multiplier(
        indicators["gdp_per_capita"],
        median_age,
        indicators["physicians_per1000"],
    )

    result: Dict[str, Any] = {
        "population": metro_pop,
        "city_gdp_usd": city_gdp,
        "country_code": iso2,
        "vulnerability_multiplier": vulnerability,
        "gdp_per_capita": indicators["gdp_per_capita"],
        "median_age": median_age,
        "life_expectancy": indicators["life_expectancy"],
        "physicians_per1000": indicators["physicians_per1000"],
        "_geocoder_source": pop_source,
        "_population_source": pop_source,
        "_tier_imputed": COUNTRY_TO_TIER.get(iso2.upper(), DEFAULT_TIER),
        "_cache_stats": _city_cache.stats,
    }

    await _city_cache.set(cache_key, result)

    logger.info(
        "Resolved Profile '%s' (%s/%s): metro=%d | gdp=$%.1fB | vuln=%s | age=%s | cache=%s",
        city,
        iso2,
        iso3,
        metro_pop,
        city_gdp / 1e9,
        vulnerability,
        median_age,
        geo.source,
    )

    return result


# Public alias used in verification scripts and external tooling
get_socioeconomic_profile = fetch_live_socioeconomics


# ═══════════════════════════════════════════════════════════════════════════════
# CACHE MANAGEMENT UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def get_cache_stats() -> Dict[str, Any]:
    """
    Return combined live statistics for system caches.
    """
    return {
        "city": _city_cache.stats,
        "country": _country_cache.stats,
    }


async def invalidate_city_cache(city: str) -> bool:
    """
    Manually evicts a localized index from the cache tree.
    """
    cache_key = city.strip().lower()
    removed = await _city_cache.invalidate(cache_key)
    if removed:
        logger.info("Evicted index from cache: '%s'", cache_key)
    return removed


async def flush_all_caches() -> Dict[str, int]:
    """
    Drops all cache pointers and resets memory buffers.
    """
    city_count = await _city_cache.clear()
    country_count = await _country_cache.clear()
    logger.warning(
        "Caches reset initialized: %d city buffers, %d country buffers dropped.",
        city_count,
        country_count,
    )
    return {"city_evicted": city_count, "country_evicted": country_count}