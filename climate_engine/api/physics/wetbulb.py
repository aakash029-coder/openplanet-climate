"""
climate_engine/api/physics/wetbulb.py — Stull (2011) wet-bulb temperature.

Includes:
- ERA5 humidity fetching (P95 and live)
- Stull (2011) empirical wet-bulb calculation with Clausius-Clapeyron correction
"""
from __future__ import annotations

import logging
import math
import asyncio
from typing import Optional
from dataclasses import dataclass

import httpx

from .climate_zone import ClimateZone
from .utils import (
    _ERA5_CACHE, _cache_get, _cache_set,
    _latitude_p95_humidity_fallback,
    rate_limit_lock,
)

logger = logging.getLogger(__name__)


# ── ERA5 Humidity ──────────────────────────────────────────────────────────────

async def _fetch_era5_humidity_p95(lat: float, lng: float) -> float:
    """
    Fetch ERA5 95th-percentile relative humidity from Open-Meteo Archive API.
    Falls back to latitude-model estimate on failure.

    Humidity P95 is anchored to the same WMO 2011-2020 reference decade used
    for the temperature baseline so the wet-bulb pair (T, RH) is drawn from
    one consistent climatology.
    """
    cache_key = f"era5_rh_{round(lat, 2)}_{round(lng, 2)}"
    cached = _cache_get(_ERA5_CACHE, cache_key)
    if cached is not None:
        return cached

    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lng}"
        f"&start_date=2011-01-01&end_date=2020-12-31"
        f"&daily=relative_humidity_2m_mean"
        f"&timezone=auto"
    )

    max_attempts = 3
    last_exc: Optional[Exception] = None

    for attempt in range(1, max_attempts + 1):
        try:
            async with rate_limit_lock:
                async with httpx.AsyncClient(timeout=30.0, trust_env=False) as client:
                    resp = await client.get(url)
                    if resp.status_code == 429:
                        wait = 2 ** attempt
                        logger.warning(
                            "ERA5 RH rate limited (attempt %d/%d), waiting %ds",
                            attempt, max_attempts, wait,
                        )
                        await asyncio.sleep(wait)
                        continue
                    resp.raise_for_status()
                    daily = resp.json().get("daily", {})
                    times = daily.get("time", [])
                    rh_vals = daily.get("relative_humidity_2m_mean", [])

            target_years = {2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020}
            summer_rh: list[float] = []

            for t, rh in zip(times, rh_vals):
                if rh is None:
                    continue
                year = int(t[0:4])
                month = int(t[5:7])
                if year not in target_years:
                    continue
                if lat >= 0 and month in {6, 7, 8}:
                    summer_rh.append(float(rh))
                elif lat < 0 and month in {12, 1, 2}:
                    summer_rh.append(float(rh))

            if len(summer_rh) < 10:
                raise ValueError(
                    f"Insufficient ERA5 summer-RH data for ({lat:.2f}, {lng:.2f}). "
                    f"Only {len(summer_rh)} valid days."
                )

            sorted_rh = sorted(summer_rh)
            p95_idx = min(int(len(sorted_rh) * 0.95), len(sorted_rh) - 1)
            p95_rh = round(sorted_rh[p95_idx], 1)

            _cache_set(_ERA5_CACHE, cache_key, p95_rh)
            logger.info("ERA5 P95 RH for (%.2f, %.2f): %.1f%%", lat, lng, p95_rh)
            return p95_rh

        except Exception as exc:
            last_exc = exc
            if attempt < max_attempts:
                wait = 2 ** attempt
                logger.warning(
                    "ERA5 RH attempt %d/%d failed: %s — retrying in %ds",
                    attempt, max_attempts, exc, wait,
                )
                await asyncio.sleep(wait)

    logger.error(
        "ERA5 P95 RH completely failed for (%.2f, %.2f) after %d attempts: %s. "
        "Activating latitude-model fallback.",
        lat, lng, max_attempts, last_exc,
    )
    fallback = _latitude_p95_humidity_fallback(lat)
    _cache_set(_ERA5_CACHE, cache_key, fallback)
    return fallback


async def _fetch_relative_humidity_live(lat: float, lng: float) -> float:
    """
    Fetch current relative humidity from Open-Meteo Forecast API.
    Falls back to latitude-model estimate on total failure.
    """
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lng}"
        f"&current=relative_humidity_2m"
        f"&timezone=auto"
    )

    max_attempts = 3
    for attempt in range(1, max_attempts + 1):
        try:
            async with rate_limit_lock:
                async with httpx.AsyncClient(timeout=8.0, trust_env=False) as client:
                    resp = await client.get(url)
                    if resp.status_code == 429:
                        await asyncio.sleep(2 ** attempt)
                        continue
                    resp.raise_for_status()
                    rh = resp.json().get("current", {}).get("relative_humidity_2m")

            if rh is not None:
                return float(rh)

        except Exception as exc:
            if attempt < max_attempts:
                await asyncio.sleep(2 ** attempt)
                logger.warning("Live RH attempt %d failed: %s", attempt, exc)
            else:
                logger.error("Live RH completely failed: %s — using fallback", exc)

    return _latitude_p95_humidity_fallback(lat)


# ── Stull (2011) Wet-Bulb Temperature ─────────────────────────────────────────

@dataclass(frozen=True)
class WetBulbResult:
    """Wet-bulb calculation result with zone-aware metadata."""

    wbt_celsius: float
    capped_at_survivability_limit: bool
    zone: ClimateZone
    theoretical_uncapped_wbt: Optional[float] = None
    lethal_risk_flag: bool = False


def _stull_wetbulb(
    temp_c: float,
    rh_pct: float,
    zone: ClimateZone = ClimateZone.STANDARD,
) -> WetBulbResult:
    """
    Calculate wet-bulb temperature using the Stull (2011) empirical equation.
    Includes Clausius-Clapeyron diurnal correction to convert nighttime maximum
    RH into co-occurring afternoon RH.

    Diurnal swing scales linearly from 0°C at 18°C to 12°C at 34°C (capped),
    eliminating the non-physical discontinuity that existed at the old 20°C
    hard cutoff.
    """
    if temp_c > 18.0:
        swing = min(12.0, (temp_c - 18.0) * 0.75)
        night_temp = temp_c - swing

        e_s_day = math.exp(17.67 * temp_c / (temp_c + 243.5))
        e_s_night = math.exp(17.67 * night_temp / (night_temp + 243.5))

        afternoon_rh = rh_pct * (e_s_night / e_s_day)

        if temp_c > 35.0:
            rh_to_use = max(10.0, min(60.0, afternoon_rh))
        elif temp_c > 30.0:
            rh_to_use = max(15.0, min(70.0, afternoon_rh))
        else:
            rh_to_use = max(15.0, min(95.0, afternoon_rh))
    else:
        rh_to_use = max(5.0, min(99.0, rh_pct))

    wbt_raw = (
        temp_c * math.atan(0.151977 * math.sqrt(rh_to_use + 8.313659))
        + math.atan(temp_c + rh_to_use)
        - math.atan(rh_to_use - 1.676331)
        + 0.00391838 * (rh_to_use ** 1.5) * math.atan(0.023101 * rh_to_use)
        - 4.686035
    )

    wbt_final = wbt_raw

    SURVIVABILITY_LIMIT = 35.0
    capped = wbt_raw > SURVIVABILITY_LIMIT

    lethal_flag = zone == ClimateZone.LETHAL_HUMID and capped

    return WetBulbResult(
        wbt_celsius=round(wbt_final, 2),
        capped_at_survivability_limit=capped,
        zone=zone,
        theoretical_uncapped_wbt=round(wbt_raw, 2) if capped else None,
        lethal_risk_flag=lethal_flag,
    )


def stull_wetbulb_simple(
    temp_c: float,
    rh_pct: float,
    zone: ClimateZone = ClimateZone.STANDARD,
) -> float:
    """Simplified wet-bulb returning only the capped temperature float."""
    return _stull_wetbulb(temp_c, rh_pct, zone).wbt_celsius
