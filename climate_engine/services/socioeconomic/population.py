"""
climate_engine/services/socioeconomic/population.py — Population lookups (metro vault + GeoNames).
"""
from __future__ import annotations

import logging
import re
from typing import Optional

import httpx

from .fallback import _METRO_KEYED, get_tier_for_country

logger = logging.getLogger(__name__)

OPEN_METEO_SEMAPHORE = __import__('asyncio').Semaphore(10)


def _metro_pop_lookup(city: str, iso2: str) -> Optional[int]:
    """
    Offline metro-area population (Natural Earth pop_max), disambiguated by the
    already-resolved country. Returns None when the city is not in the vault.
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


def validate_census_data(pop: int, city: str) -> bool:
    """
    Strict boundary check on population figures before they enter the pipeline.
    Upper bound 40M: Greater Tokyo (~37.7M) is the world's largest metro, so the
    cap must sit just above it — a 35M cap wrongly rejected Tokyo and defaulted it
    to a tiny figure. Minimum 10K filters bad geocodes.
    """
    if pop > 40_000_000 or pop < 10_000:
        logger.critical(
            "CRITICAL: Data Poisoning Detected — population %d for '%s' "
            "is outside defensible bounds [10K, 40M]. Defaulting to "
            "World Bank national averages.",
            pop, city,
        )
        return False
    return True


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


def _city_token_for_geocoder(location: str) -> str:
    """
    Return the city-only portion of a query, stripping any trailing country token.
    """
    from .geocoding import _location_country_hint  # local import avoids circular dep
    hint = _location_country_hint(location)
    if hint:
        if "," in location:
            return location.split(",")[0].strip()
        words = location.strip().split()
        return " ".join(words[:-1]).strip() or location
    return location.split(",")[0].strip()


async def _fetch_openmeteo_population(
    location_query: str,
    country_code_hint: str,
    client: httpx.AsyncClient,
) -> int:
    """
    Authoritative per-city population from Open-Meteo's GeoNames index.
    Returns 0 when no population figure is available.
    """
    import asyncio
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

    cc = (country_code_hint or "").upper()
    same_country = [r for r in results if (r.get("country_code") or "").upper() == cc]
    pool = same_country or results
    best = max(pool, key=lambda r: r.get("population") or 0)
    return int(best.get("population") or 0)
