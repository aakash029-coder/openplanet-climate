"""
climate_engine/services/socioeconomic — Socioeconomic Data Service package.

Public API surface (all existing importers continue to work unchanged):
    fetch_live_socioeconomics(city) -> Dict[str, Any]
    geocode_city(city, client) -> GeocodingResult
    search_geocode_candidates(query, client) -> List[GeocodingCandidate]
    GeocodingResult, GeocodingCandidate
    get_cache_stats() -> Dict[str, Any]
    invalidate_city_cache(city) -> bool
    flush_all_caches() -> Dict[str, int]
    get_socioeconomic_profile  (alias for fetch_live_socioeconomics)
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, Optional

import httpx

from .fallback import _CITY_VAULT, _OFFLINE_VAULT, COUNTRY_TO_TIER, DEFAULT_TIER, get_tier_for_country
from .worldbank import BoundedTTLCache, _country_cache, fetch_country_indicators, iso2_to_iso3
from .population import _metro_pop_lookup, validate_census_data, compute_metro_population, _fetch_openmeteo_population
from .vulnerability import compute_median_age, compute_urban_productivity_ratio, compute_vulnerability_multiplier
from .geocoding import (
    geocode_city,
    search_geocode_candidates,
    GeocodingResult,
    GeocodingCandidate,
    HEADERS,
)

logger = logging.getLogger(__name__)

CACHE_MAX_CITIES = 50_000
CACHE_TTL_SECONDS = 86_400 * 7  # 7 days

_city_cache = BoundedTTLCache(max_size=CACHE_MAX_CITIES, ttl_seconds=CACHE_TTL_SECONDS)


# ── City Vault Key Lookup ─────────────────────────────────────────────────────

def _city_vault_key(city: str) -> Optional[str]:
    """
    Map a raw city query string to a city vault key via slug matching.
    Tries exact slug match, then partial first-token match.
    """
    import unicodedata

    def _slug(s: str) -> str:
        s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
        s = re.sub(r"[^a-z0-9 ]", "", s.lower())
        return re.sub(r"\s+", "_", s.strip())

    parts = [p.strip() for p in city.split(",")]
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
            pct_u15 = country_data.get("pct_under15") or tier.pct_under15
            pct_o65 = country_data.get("pct_over65") or tier.pct_over65
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
        # GeoNames figures >= ~2M are already agglomeration/prefecture level and
        # must NOT be re-multiplied (would overshoot, e.g. Wuhan 10.4M -> 17M).
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
    """Return combined live statistics for system caches."""
    return {
        "city": _city_cache.stats,
        "country": _country_cache.stats,
    }


async def invalidate_city_cache(city: str) -> bool:
    """Manually evicts a localized index from the cache tree."""
    cache_key = city.strip().lower()
    removed = await _city_cache.invalidate(cache_key)
    if removed:
        logger.info("Evicted index from cache: '%s'", cache_key)
    return removed


async def flush_all_caches() -> Dict[str, int]:
    """Drops all cache pointers and resets memory buffers."""
    city_count = await _city_cache.clear()
    country_count = await _country_cache.clear()
    logger.warning(
        "Caches reset initialized: %d city buffers, %d country buffers dropped.",
        city_count,
        country_count,
    )
    return {"city_evicted": city_count, "country_evicted": country_count}


__all__ = [
    "fetch_live_socioeconomics",
    "get_socioeconomic_profile",
    "geocode_city",
    "search_geocode_candidates",
    "GeocodingResult",
    "GeocodingCandidate",
    "get_cache_stats",
    "invalidate_city_cache",
    "flush_all_caches",
]
