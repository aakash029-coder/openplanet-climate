"""
climate_engine/services/socioeconomic_service.py — Compatibility redirect.

This module is kept for backward-compatibility only.
All logic has been moved to the `climate_engine.services.socioeconomic` package.
Existing importers continue to work:
    from climate_engine.services.socioeconomic_service import fetch_live_socioeconomics
    from climate_engine.services.socioeconomic_service import geocode_city
    etc.
"""
from climate_engine.services.socioeconomic import (  # noqa: F401
    fetch_live_socioeconomics,
    get_socioeconomic_profile,
    geocode_city,
    search_geocode_candidates,
    GeocodingResult,
    GeocodingCandidate,
    get_cache_stats,
    invalidate_city_cache,
    flush_all_caches,
)

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
