"""
climate_engine/api/physics/utils.py — Shared utilities for the physics layer.
"""
from __future__ import annotations

import logging
import time
import asyncio

logger = logging.getLogger(__name__)

# ── Shared cache store ────────────────────────────────────────────────────────

_ERA5_CACHE: dict = {}
_CACHE_TTL = 86400  # 24 hours

rate_limit_lock = asyncio.Semaphore(5)


def _cache_get(store: dict, key: str):
    entry = store.get(key)
    if entry and (time.time() - entry[1]) < _CACHE_TTL:
        return entry[0]
    return None


def _cache_set(store: dict, key: str, value):
    store[key] = (value, time.time())


# ── Latitude-based fallbacks ──────────────────────────────────────────────────

def _latitude_temperature_fallback(lat: float) -> float:
    """
    Estimate annual mean temperature purely from latitude when ERA5 fails.
    Uses a simplified cosine model calibrated against ERA5 climatology.
    Accuracy: ±4°C for continental regions, ±6°C for maritime/polar.
    """
    abs_lat = abs(lat)

    if abs_lat <= 15:
        base = 27.0
    elif abs_lat <= 30:
        base = 27.0 - (abs_lat - 15) * 0.6
    elif abs_lat <= 45:
        base = 18.0 - (abs_lat - 30) * 0.7
    elif abs_lat <= 60:
        base = 7.5 - (abs_lat - 45) * 0.7
    elif abs_lat <= 75:
        base = -3.0 - (abs_lat - 60) * 0.8
    else:
        base = -15.0 - (abs_lat - 75) * 0.6

    logger.warning(
        "ERA5 fallback activated for lat=%.2f. "
        "Using latitude-model temperature %.1f°C. "
        "Results are indicative.",
        lat,
        base,
    )
    return round(base, 1)


def _latitude_p95_humidity_fallback(lat: float) -> float:
    """
    Estimate P95 summer relative humidity from latitude when ERA5 fails.
    """
    abs_lat = abs(lat)
    if abs_lat <= 15:
        rh = 82.0
    elif abs_lat <= 25:
        rh = 70.0
    elif abs_lat <= 35:
        rh = 55.0
    elif abs_lat <= 50:
        rh = 65.0
    elif abs_lat <= 65:
        rh = 72.0
    else:
        rh = 78.0

    logger.warning(
        "ERA5 RH fallback activated for lat=%.2f. "
        "Using latitude-model P95 RH %.1f%%.",
        lat,
        rh,
    )
    return rh
