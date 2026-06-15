"""
climate_engine/services/socioeconomic/geocoding.py — Geocoding providers (Photon, Open-Meteo, Nominatim).
"""
from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Set

import httpx
import pycountry

from .fallback import get_tier_for_country

logger = logging.getLogger(__name__)

HEADERS = {
    "User-Agent": "ClimateRisk-Engine/2.1 (https://github.com/aakash029-coder/openplanet-climate; research)",
    "Accept": "application/json",
}

OPEN_METEO_SEMAPHORE = asyncio.Semaphore(10)
NOMINATIM_SEMAPHORE = asyncio.Semaphore(1)


# ── Country hint helpers ───────────────────────────────────────────────────────

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


def _location_country_hint(location: str) -> Optional[str]:
    """Return the country token from 'City, Country' or 'City Country' queries."""
    if "," in location:
        parts = [p.strip() for p in location.split(",") if p.strip()]
        return parts[-1] if len(parts) >= 2 else None

    words = location.strip().split()
    if len(words) >= 2:
        last = words[-1]
        if _country_codes_from_hint(last):
            return last
    return None


def _city_token_for_geocoder(location: str) -> str:
    """Return the city-only portion of a query, stripping any trailing country token."""
    hint = _location_country_hint(location)
    if hint:
        if "," in location:
            return location.split(",")[0].strip()
        words = location.strip().split()
        return " ".join(words[:-1]).strip() or location
    return location.split(",")[0].strip()


# ── Keyword cleaner ────────────────────────────────────────────────────────────

def _clean_city_keyword(raw_city: str) -> str:
    """
    Strips administrative prefixes to extract the core geographical entity.
    """
    cleaned = re.sub(r",\s*undefined\b", "", raw_city, flags=re.IGNORECASE).strip()
    cleaned = re.sub(r"\bundefined\b", "", cleaned, flags=re.IGNORECASE).strip()
    cleaned = cleaned.strip(",;. ").strip()

    parts = [p.strip() for p in cleaned.split(",")]
    core_city = parts[0]

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
        return raw_city

    parts[0] = core_city
    return ", ".join(p for p in parts if p)


def _prepare_geocoding_query(raw_city: str) -> str:
    """Normalize client artifacts while preserving the full location string."""
    return _clean_city_keyword(raw_city.strip())


# ── Result dataclasses ────────────────────────────────────────────────────────

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


# ── Hit selectors ─────────────────────────────────────────────────────────────

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


# ── Provider implementations ──────────────────────────────────────────────────

async def _fetch_openmeteo_geocoding(
    location_query: str,
    client: httpx.AsyncClient,
) -> GeocodingResult:
    url = "https://geocoding-api.open-meteo.com/v1/search"
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
    """Photon geocoder by Komoot — Elasticsearch-backed OSM data."""
    url = "https://photon.komoot.io/api/"
    city_token = _city_token_for_geocoder(query)
    params = {"q": city_token, "limit": 10, "lang": "en"}

    resp = await client.get(url, params=params, headers=HEADERS, timeout=8.0)
    resp.raise_for_status()
    data = resp.json()

    features = data.get("features", [])

    PLACE_TYPES = {"city", "district", "municipality", "county", "locality", "region", "borough"}
    city_features = [
        f for f in features
        if f.get("properties", {}).get("type", "").lower() in PLACE_TYPES
    ]
    if not city_features:
        city_features = features

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
        coords = f.get("geometry", {}).get("coordinates", [0.0, 0.0])

        country_code = (props.get("countrycode") or "").upper()
        country = props.get("country", "")
        city_name = props.get("name") or props.get("city") or query.split(",")[0].strip()

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


# ── Public API ────────────────────────────────────────────────────────────────

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
    3-tier cascade: Photon → Open-Meteo → Nominatim.
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
