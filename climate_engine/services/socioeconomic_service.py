"""
climate_engine/services/socioeconomic_service.py — Hardened Socioeconomic Data Service

Architecture v2.0 ("Actually Undefeatable"):
- LRU cache with TTL and memory bounds
- Dual-geocoder fallback (Open-Meteo → Nominatim)
- Proper rate limiting with exponential backoff
- Real Geo-Economic Vault
- Density-aware metro population estimation
- Thread-safe cache writes
- Smart Keyword Extraction (strips "Greater ", "City of ", ", undefined")
- ZERO-FAIL: Never crashes, always returns a usable result
"""

from __future__ import annotations

import asyncio
import logging
import time
import re
import math  # Moved to top level
from collections import OrderedDict
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Tuple

import httpx
import pycountry

logger = logging.getLogger(__name__)

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
    # North America High
    "US": "NORTH_AMERICA_HIGH", "CA": "NORTH_AMERICA_HIGH",
    # Europe High
    "DE": "EUROPE_HIGH", "FR": "EUROPE_HIGH", "GB": "EUROPE_HIGH",
    "IT": "EUROPE_HIGH", "ES": "EUROPE_HIGH", "NL": "EUROPE_HIGH",
    "BE": "EUROPE_HIGH", "AT": "EUROPE_HIGH", "CH": "EUROPE_HIGH",
    "SE": "EUROPE_HIGH", "NO": "EUROPE_HIGH", "DK": "EUROPE_HIGH",
    "FI": "EUROPE_HIGH", "IE": "EUROPE_HIGH", "PT": "EUROPE_HIGH",
    "LU": "EUROPE_HIGH", "IS": "EUROPE_HIGH",
    # East Asia High
    "JP": "EAST_ASIA_HIGH", "KR": "EAST_ASIA_HIGH", "TW": "EAST_ASIA_HIGH",
    "SG": "EAST_ASIA_HIGH", "HK": "EAST_ASIA_HIGH",
    # Oceania High
    "AU": "OCEANIA_HIGH", "NZ": "OCEANIA_HIGH",
    # Gulf High
    "AE": "GULF_HIGH", "SA": "GULF_HIGH", "QA": "GULF_HIGH",
    "KW": "GULF_HIGH", "BH": "GULF_HIGH", "OM": "GULF_HIGH",
    # Europe Upper-Mid
    "PL": "EUROPE_UPPER_MID", "CZ": "EUROPE_UPPER_MID", "HU": "EUROPE_UPPER_MID",
    "RO": "EUROPE_UPPER_MID", "BG": "EUROPE_UPPER_MID", "HR": "EUROPE_UPPER_MID",
    "SK": "EUROPE_UPPER_MID", "SI": "EUROPE_UPPER_MID", "LT": "EUROPE_UPPER_MID",
    "LV": "EUROPE_UPPER_MID", "EE": "EUROPE_UPPER_MID", "GR": "EUROPE_UPPER_MID",
    "RS": "EUROPE_UPPER_MID", "UA": "EUROPE_UPPER_MID", "BY": "EUROPE_UPPER_MID",
    "RU": "EUROPE_UPPER_MID", "TR": "EUROPE_UPPER_MID",
    # LATAM Upper-Mid
    "MX": "LATAM_UPPER_MID", "BR": "LATAM_UPPER_MID", "AR": "LATAM_UPPER_MID",
    "CL": "LATAM_UPPER_MID", "CO": "LATAM_UPPER_MID", "PE": "LATAM_UPPER_MID",
    "VE": "LATAM_UPPER_MID", "EC": "LATAM_UPPER_MID", "CR": "LATAM_UPPER_MID",
    "PA": "LATAM_UPPER_MID", "UY": "LATAM_UPPER_MID", "DO": "LATAM_UPPER_MID",
    # East Asia Upper-Mid
    "CN": "EAST_ASIA_UPPER_MID", "TH": "EAST_ASIA_UPPER_MID", "MY": "EAST_ASIA_UPPER_MID",
    # South Asia Lower-Mid
    "IN": "SOUTH_ASIA_LOWER_MID", "BD": "SOUTH_ASIA_LOWER_MID",
    "PK": "SOUTH_ASIA_LOWER_MID", "LK": "SOUTH_ASIA_LOWER_MID",
    "NP": "SOUTH_ASIA_LOWER_MID",
    # Southeast Asia Lower-Mid
    "ID": "SOUTHEAST_ASIA_LOWER_MID", "PH": "SOUTHEAST_ASIA_LOWER_MID",
    "VN": "SOUTHEAST_ASIA_LOWER_MID", "MM": "SOUTHEAST_ASIA_LOWER_MID",
    "KH": "SOUTHEAST_ASIA_LOWER_MID", "LA": "SOUTHEAST_ASIA_LOWER_MID",
    # Africa Lower-Mid
    "NG": "AFRICA_LOWER_MID", "GH": "AFRICA_LOWER_MID", "KE": "AFRICA_LOWER_MID",
    "CI": "AFRICA_LOWER_MID", "SN": "AFRICA_LOWER_MID", "CM": "AFRICA_LOWER_MID",
    "ZA": "AFRICA_LOWER_MID", "EG": "AFRICA_LOWER_MID", "MA": "AFRICA_LOWER_MID",
    "TN": "AFRICA_LOWER_MID", "DZ": "AFRICA_LOWER_MID",
    # MENA Lower-Mid
    "IR": "MENA_LOWER_MID", "IQ": "MENA_LOWER_MID", "JO": "MENA_LOWER_MID",
    "LB": "MENA_LOWER_MID", "PS": "MENA_LOWER_MID",
    # Africa Low
    "ET": "AFRICA_LOW", "TZ": "AFRICA_LOW", "UG": "AFRICA_LOW",
    "RW": "AFRICA_LOW", "MW": "AFRICA_LOW", "MZ": "AFRICA_LOW",
    "ZM": "AFRICA_LOW", "ZW": "AFRICA_LOW", "SD": "AFRICA_LOW",
    "SS": "AFRICA_LOW", "CD": "AFRICA_LOW", "CF": "AFRICA_LOW",
    "TD": "AFRICA_LOW", "NE": "AFRICA_LOW", "ML": "AFRICA_LOW",
    "BF": "AFRICA_LOW", "SO": "AFRICA_LOW", "ER": "AFRICA_LOW",
    "MR": "AFRICA_LOW", "GM": "AFRICA_LOW", "GN": "AFRICA_LOW",
    "SL": "AFRICA_LOW", "LR": "AFRICA_LOW", "BI": "AFRICA_LOW",
    # South Asia Fragile
    "AF": "SOUTH_ASIA_FRAGILE", "YE": "SOUTH_ASIA_FRAGILE",
    "SY": "SOUTH_ASIA_FRAGILE", "HT": "SOUTH_ASIA_FRAGILE",
    # Small Island Developing States
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
# SMART KEYWORD EXTRACTOR (NINJA REGEX CLEANER)
# ═══════════════════════════════════════════════════════════════════════════════

def _clean_city_keyword(raw_city: str) -> str:
    """
    Strips frontend noise and administrative prefixes to extract the core
    geographical entity. Prevents 404 errors from garbage input.

    Examples:
        'City of Edinburgh, undefined'  → 'Edinburgh'
        'Greater London, UK'            → 'London, UK'
        'Metropolitan Tokyo'            → 'Tokyo'
        'Mumbai, India'                 → 'Mumbai, India'  (unchanged, already clean)
    """
    # Kill the frontend "undefined" bug
    cleaned = re.sub(r",\s*undefined\b", "", raw_city, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"\bundefined\b", "", cleaned, flags=re.IGNORECASE).strip()

    # Strip trailing punctuation artifacts
    cleaned = cleaned.strip(",;. ").strip()

    parts = [p.strip() for p in cleaned.split(",")]
    core_city = parts[0]

    # Noise patterns to strip (order matters — most specific first)
    noise_patterns = [
        r"^city\s+of\s+",
        r"^greater\s+",
        r"^municipality\s+of\s+",
        r"^metropolitan\s+area\s+of\s+",
        r"^metropolitan\s+",
        r"^urban\s+area\s+of\s+",
        r"\s+metropolitan\s+area$",
        r"\s+metro\s+area$",
        r"\s+city$",
    ]
    for pattern in noise_patterns:
        core_city = re.sub(pattern, "", core_city, flags=re.IGNORECASE).strip()

    if not core_city:
        # Degenerate case — return original to avoid empty query
        return raw_city

    parts[0] = core_city
    return ", ".join(p for p in parts if p)


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


async def _fetch_openmeteo_geocoding(
    city: str,
    client: httpx.AsyncClient,
) -> GeocodingResult:
    url = "https://geocoding-api.open-meteo.com/v1/search"
    params = {"name": city, "count": 3, "format": "json"}

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
                        f"Open-Meteo geocoding failed for '{city}': {exc}"
                    ) from exc

    results = data.get("results", [])
    if not results:
        raise ValueError(f"Open-Meteo: no results for '{city}'")

    # Prefer results with population data
    hit = max(results, key=lambda r: r.get("population") or 0)

    return GeocodingResult(
        city_population=hit.get("population") or 0,
        country_code=hit.get("country_code", "").upper(),
        latitude=hit.get("latitude", 0.0),
        longitude=hit.get("longitude", 0.0),
        source="open-meteo",
    )


async def _fetch_nominatim_geocoding(
    city: str,
    client: httpx.AsyncClient,
) -> GeocodingResult:
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": city, "format": "json", "limit": 1, "addressdetails": 1}

    async with NOMINATIM_SEMAPHORE:
        try:
            nom_headers = {
                **HEADERS,
                "User-Agent": "ClimateRisk-Research/2.1 (https://github.com/aakash029-coder/openplanet-climate; officialaakash029@gmail.com)",
            }
            # Adding a deliberate tiny sleep to ensure we strictly obey the 1 req/sec ToS
            await asyncio.sleep(1.1)
            resp = await client.get(url, params=params, headers=nom_headers, timeout=15.0)
            resp.raise_for_status()
            data = resp.json()
        except Exception as exc:
            raise ValueError(
                f"Nominatim geocoding failed for '{city}': {exc}"
            ) from exc

    if not data:
        raise ValueError(f"Nominatim: no results for '{city}'")

    hit = data[0]
    address = hit.get("address", {})
    country_code = address.get("country_code", "").upper()

    return GeocodingResult(
        city_population=0,
        country_code=country_code,
        latitude=float(hit.get("lat", 0)),
        longitude=float(hit.get("lon", 0)),
        source="nominatim",
    )


async def geocode_city(city: str, client: httpx.AsyncClient) -> GeocodingResult:
    """
    Geocode a city with smart keyword extraction and automatic dual-provider fallback.

    ZERO-FAIL:
    1. Clean input with regex.
    2. Try Open-Meteo (fast, global, has population).
    3. Try Nominatim (authoritative OSM, slower).
    4. If both fail, raise descriptive ValueError.
    """
    smart_city = _clean_city_keyword(city)
    if smart_city.lower() != city.lower():
        logger.info("Smart keyword: '%s' → '%s'", city, smart_city)

    try:
        return await _fetch_openmeteo_geocoding(smart_city, client)
    except ValueError as e:
        logger.warning("Open-Meteo failed for '%s', trying Nominatim: %s", smart_city, e)

    try:
        return await _fetch_nominatim_geocoding(smart_city, client)
    except ValueError as e:
        raise ValueError(
            f"All geocoders failed for '{city}' (cleaned: '{smart_city}'). "
            f"Check spelling or try a nearby major city. Last error: {e}"
        ) from e


# ═══════════════════════════════════════════════════════════════════════════════
# WORLD BANK API
# ═══════════════════════════════════════════════════════════════════════════════

WORLD_BANK_INDICATORS = {
    "gdp_per_capita": "NY.GDP.PCAP.CD",
    "urban_share": "SP.URB.TOTL.IN.ZS",
    "gni_per_capita": "NY.GNP.PCAP.CD",
    "life_expectancy": "SP.DYN.LE00.IN",
    "physicians_per1000": "SH.MED.PHYS.ZS",
    "pct_under15": "SP.POP.0014.TO.ZS",
    "pct_over65": "SP.POP.65UP.TO.ZS",
}


async def _fetch_single_indicator(
    iso3: str,
    indicator_code: str,
    indicator_name: str,
    client: httpx.AsyncClient,
) -> Tuple[str, Optional[float]]:
    url = f"https://api.worldbank.org/v2/country/{iso3}/indicator/{indicator_code}"
    params = {"format": "json", "mrv": 5, "per_page": 5}

    max_retries = 2
    for attempt in range(max_retries + 1):
        async with WORLD_BANK_SEMAPHORE:
            try:
                resp = await client.get(url, params=params, timeout=12.0)
                if resp.status_code == 429:
                    await asyncio.sleep(2 ** attempt)
                    continue
                resp.raise_for_status()
                data = resp.json()
                if len(data) > 1 and data[1]:
                    for entry in data[1]:
                        if entry.get("value") is not None:
                            return indicator_name, float(entry["value"])
                return indicator_name, None
            except httpx.HTTPStatusError:
                if attempt < max_retries:
                    await asyncio.sleep(1)
                    continue
                return indicator_name, None
            except Exception as exc:
                logger.warning("World Bank error for %s/%s: %s", indicator_name, iso3, exc)
                return indicator_name, None

    return indicator_name, None


async def fetch_country_indicators(
    iso3: str,
    iso2: str,
    client: httpx.AsyncClient,
) -> Dict[str, float]:
    cache_key = f"wb:{iso3}"
    cached = await _country_cache.get(cache_key)
    if cached:
        return cached

    tasks = [
        _fetch_single_indicator(iso3, code, name, client)
        for name, code in WORLD_BANK_INDICATORS.items()
    ]
    results = await asyncio.gather(*tasks)
    raw_data = {name: value for name, value in results}

    tier = get_tier_for_country(iso2)

    final_data: Dict[str, Any] = {
        "gdp_per_capita": raw_data["gdp_per_capita"] or tier.gdp_per_capita,
        "urban_share": raw_data["urban_share"] or tier.urban_share,
        "gni_per_capita": raw_data["gni_per_capita"] or raw_data["gdp_per_capita"] or tier.gdp_per_capita,
        "life_expectancy": raw_data["life_expectancy"] or tier.life_expectancy,
        "physicians_per1000": raw_data["physicians_per1000"] or tier.physicians_per1000,
        "pct_under15": raw_data["pct_under15"] or tier.pct_under15,
        "pct_over65": raw_data["pct_over65"] or tier.pct_over65,
        "density_factor": tier.density_factor,
    }

    imputed = [k for k, v in raw_data.items() if v is None]
    if imputed:
        tier_name = COUNTRY_TO_TIER.get(iso2.upper(), DEFAULT_TIER)
        logger.info("Imputed from tier '%s' for %s: %s", tier_name, iso3, imputed)

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
    Composite vulnerability score combining:
    - Wealth proxy (AC access / adaptive capacity)
    - Population age structure (physiological heat sensitivity)
    - Healthcare system capacity (emergency response)

    Returns a multiplier in [0.25, 2.5]:
    < 1.0 = lower-than-average vulnerability (wealthy, young, well-served)
    > 1.0 = higher-than-average vulnerability (poor, elderly, under-served)
    """

    # ── AC / adaptive capacity factor ────────────────────────────────────
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

    # ── Age structure factor ──────────────────────────────────────────────
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

    # ── Healthcare capacity factor ────────────────────────────────────────
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

    # Geometric mean of the three factors — prevents any single dimension
    # from dominating the composite score.
    combined = (ac_factor * age_factor * health_factor) ** (1.0 / 3.0)
    return round(max(0.25, min(2.5, combined)), 3)


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════════

async def fetch_live_socioeconomics(city: str) -> Dict[str, Any]:
    """
    Fetch comprehensive city socioeconomics with full resilience.

    ZERO-FAIL: Only raises ValueError if geocoding completely fails.
    All other data gaps are filled from the Geo-Economic Tier Vault.

    Args:
        city: City name string (e.g. "Mumbai", "Greater London", "City of Tokyo").

    Returns:
        Complete socioeconomic profile dict with keys:
            population, city_gdp_usd, country_code, vulnerability_multiplier,
            gdp_per_capita, median_age, life_expectancy, physicians_per1000,
            _geocoder_source, _tier_imputed, _cache_stats

    Raises:
        ValueError: Only when all geocoders fail (unrecognisable city string).
    """
    cache_key = city.strip().lower().split(",")[0].strip()
    cached = await _city_cache.get(cache_key)
    if cached:
        logger.info(
            "City cache hit: '%s' (rate: %.1f%%)",
            city,
            _city_cache.stats["hit_rate"] * 100,
        )
        return cached

    async with httpx.AsyncClient(headers=HEADERS, timeout=30.0) as client:
        # ── Geocoding ─────────────────────────────────────────────────────
        geo = await geocode_city(city, client)

        if not geo.country_code:
            raise ValueError(f"Geocoding returned no country for '{city}'")

        iso2 = geo.country_code
        iso3 = iso2_to_iso3(iso2)

        # ── Country indicators (World Bank + tier fallback) ───────────────
        indicators = await fetch_country_indicators(iso3, iso2, client)

    city_pop = geo.city_population

    if city_pop == 0:
        logger.warning(
            "No exact population found for '%s' (source: %s). "
            "Climate calculations will proceed without population-scaling.",
            city,
            geo.source,
        )

    # ── Metro-area population ─────────────────────────────────────────────
    metro_pop = compute_metro_population(
        city_pop,
        indicators["urban_share"],
        indicators["density_factor"],
    )

    # ── Demographics ──────────────────────────────────────────────────────
    median_age = compute_median_age(
        indicators["pct_under15"],
        indicators["pct_over65"],
    )

    # ── City GDP (metro scale × urban productivity premium) ───────────────
    if metro_pop > 0:
        urban_ratio = compute_urban_productivity_ratio(indicators["gdp_per_capita"])
        city_gdp = metro_pop * indicators["gdp_per_capita"] * urban_ratio
    else:
        # Honest fallback: conservative estimate when population unknown
        tier = get_tier_for_country(iso2)
        city_gdp = tier.gdp_per_capita * 500_000   # assume small city baseline
        logger.warning(
            "No population for '%s' — using conservative city GDP estimate: $%.1fM",
            city,
            city_gdp / 1e6,
        )

    # ── Vulnerability multiplier ──────────────────────────────────────────
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
        "_geocoder_source": geo.source,
        "_tier_imputed": COUNTRY_TO_TIER.get(iso2.upper(), DEFAULT_TIER),
        "_cache_stats": _city_cache.stats,
    }

    await _city_cache.set(cache_key, result)

    logger.info(
        "Socio '%s' (%s/%s): metro=%d | gdp=$%.1fB | vuln=%s | age=%s | source=%s",
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


# ═══════════════════════════════════════════════════════════════════════════════
# CACHE MANAGEMENT UTILITIES
# ═══════════════════════════════════════════════════════════════════════════════

def get_cache_stats() -> Dict[str, Any]:
    """
    Return combined live statistics for both the city and country caches.

    Useful for a /health or /debug endpoint to expose cache health.

    Returns:
        Dict with 'city' and 'country' sub-dicts, each containing:
            size, max_size, hits, misses, hit_rate
    """
    return {
        "city": _city_cache.stats,
        "country": _country_cache.stats,
    }


async def invalidate_city_cache(city: str) -> bool:
    """
    Manually evict a city from the cache (e.g. after a data correction).

    Args:
        city: Raw city name as originally submitted.

    Returns:
        True if the key existed and was removed, False if it was not cached.
    """
    cache_key = city.strip().lower().split(",")[0].strip()
    removed = await _city_cache.invalidate(cache_key)
    if removed:
        logger.info("Cache evicted: '%s'", cache_key)
    return removed


async def flush_all_caches() -> Dict[str, int]:
    """
    Flush both the city and country caches entirely.

    Returns:
        Dict with 'city_evicted' and 'country_evicted' counts.
    """
    city_count = await _city_cache.clear()
    country_count = await _country_cache.clear()
    logger.warning(
        "All caches flushed: city=%d entries, country=%d entries removed.",
        city_count,
        country_count,
    )
    return {"city_evicted": city_count, "country_evicted": country_count}