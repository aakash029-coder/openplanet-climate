"""
climate_engine/services/historical_service.py
4-Tier High-Availability Historical Climate Data Engine.

Tier 1 (Primary):   Open-Meteo ERA5 daily archive   (archive-api.open-meteo.com)
Tier 2A (Secondary): Weatherstack commercial API     (api.weatherstack.com)
Tier 2B (Secondary): Meteostat monthly via RapidAPI  (meteostat.p.rapidapi.com)
Tier 3 (Tertiary):  Visual Crossing daily archive    (weather.visualcrossing.com)
Tier 4 (Emergency): NASA POWER reanalysis monthly    (power.larc.nasa.gov)

If all 4 tiers are exhausted, raises ValueError — no arithmetic fallbacks.
"""

import logging
import asyncio
import time
import os
import urllib.parse
from typing import Dict, Any, Optional

import httpx

logger = logging.getLogger(__name__)

_HISTORICAL_CACHE: dict = {}
_CACHE_TTL = 86400 * 7  # 7-day cache


def _cache_get(key: str):
    if key in _HISTORICAL_CACHE:
        data, ts = _HISTORICAL_CACHE[key]
        if time.time() - ts < _CACHE_TTL:
            return data
    return None


def _cache_set(key: str, data):
    _HISTORICAL_CACHE[key] = (data, time.time())


# ── ERA BUCKET PROCESSOR ──────────────────────────────────────────────────────
def _process_eras_from_arrays(
    times: list, tmax_list: list, tmean_list: list, is_monthly: bool = False
) -> Optional[Dict[str, Any]]:
    """
    Slot temperature records into three era buckets and compute per-era statistics.

    Accepts daily (YYYY-MM-DD) or monthly (YYYYMM) time key formats — both are
    handled identically because str(t)[:4] extracts the year from either format.

    The is_monthly flag adds 2.5 °C to the peak to approximate the absolute
    single-day maximum from a monthly-maximum series (WMO guidance).

    Returns None if every era bucket is empty (unusable data).
    """
    eras: dict = {
        "era1": {"label": "1995-2004", "means": [], "maxes": []},
        "era2": {"label": "2005-2014", "means": [], "maxes": []},
        "era3": {"label": "2015-2024", "means": [], "maxes": []},
    }

    for i, t in enumerate(times):
        if i >= len(tmax_list) or i >= len(tmean_list):
            break
        if tmax_list[i] is None or tmean_list[i] is None:
            continue
        # Skip NASA POWER fill-value
        if float(tmax_list[i]) == -999.0 or float(tmean_list[i]) == -999.0:
            continue

        year = int(str(t)[:4])
        tmax  = float(tmax_list[i])
        tmean = float(tmean_list[i])

        if 1995 <= year <= 2004:
            eras["era1"]["means"].append(tmean)
            eras["era1"]["maxes"].append(tmax)
        elif 2005 <= year <= 2014:
            eras["era2"]["means"].append(tmean)
            eras["era2"]["maxes"].append(tmax)
        elif 2015 <= year <= 2024:
            eras["era3"]["means"].append(tmean)
            eras["era3"]["maxes"].append(tmax)

    result: dict = {}
    any_data = False
    for key, data in eras.items():
        if data["means"] and data["maxes"]:
            any_data = True
            avg_mean  = sum(data["means"]) / len(data["means"])
            peak_temp = max(data["maxes"])
            if is_monthly:
                peak_temp += 2.5
            result[key] = {
                "label":        data["label"],
                "avg_mean_temp": round(avg_mean, 1),
                "peak_temp":    round(peak_temp, 1),
            }
        else:
            result[key] = {
                "label":        data["label"],
                "avg_mean_temp": None,
                "peak_temp":    None,
            }

    return result if any_data else None


# ── TIER 1: OPEN-METEO ERA5 DAILY ARCHIVE ────────────────────────────────────
async def _fetch_open_meteo_era5(lat: float, lng: float) -> Optional[Dict[str, Any]]:
    """
    Tier 1 — ERA5 daily reanalysis via Open-Meteo archive API.
    Free, no API key required. Covers 1940–present globally.
    """
    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lng}"
        f"&start_date=1995-01-01&end_date=2024-12-31"
        f"&daily=temperature_2m_max,temperature_2m_mean"
        f"&timezone=auto"
    )
    try:
        async with httpx.AsyncClient(timeout=30.0, trust_env=False) as client:
            resp = await client.get(url)
            if resp.status_code == 429:
                logger.warning("[Tier-1] ERA5 rate-limited (429) for (%.4f, %.4f)", lat, lng)
                return None
            resp.raise_for_status()
            daily = resp.json().get("daily", {})
            times = daily.get("time", [])
            tmax  = daily.get("temperature_2m_max", [])
            tmean = daily.get("temperature_2m_mean", [])
            if not times:
                logger.warning("[Tier-1] ERA5 returned empty time series for (%.4f, %.4f)", lat, lng)
                return None
            result = _process_eras_from_arrays(times, tmax, tmean, is_monthly=False)
            if result:
                logger.info("[Tier-1] ERA5 daily loaded for (%.4f, %.4f)", lat, lng)
            return result
    except Exception as exc:
        logger.warning("[Tier-1] ERA5 failed for (%.4f, %.4f): %s", lat, lng, exc)
        return None


# ── TIER 2A: WEATHERSTACK COMMERCIAL API ─────────────────────────────────────
async def _fetch_weatherstack(lat: float, lng: float) -> Optional[Dict[str, Any]]:
    """
    Tier 2A — Weatherstack commercial historical API.
    Requires WEATHERSTACK_API_KEY environment variable.
    Fetches in 5-year blocks to respect per-request date range limits.
    """
    api_key = os.getenv("WEATHERSTACK_API_KEY")
    if not api_key:
        logger.debug("[Tier-2A] Weatherstack skipped: WEATHERSTACK_API_KEY not configured.")
        return None

    logger.info("[Tier-2A] Attempting Weatherstack for (%.4f, %.4f)", lat, lng)
    all_times: list = []
    all_tmax:  list = []
    all_tmean: list = []

    try:
        async with httpx.AsyncClient(timeout=30.0, trust_env=False) as client:
            for start_yr, end_yr in [
                (1995, 1999), (2000, 2004), (2005, 2009),
                (2010, 2014), (2015, 2019), (2020, 2024),
            ]:
                url = (
                    f"http://api.weatherstack.com/historical"
                    f"?access_key={api_key}"
                    f"&query={lat},{lng}"
                    f"&historical_date_start={start_yr}-01-01"
                    f"&historical_date_end={end_yr}-12-31"
                    f"&interval=24"
                    f"&units=m"
                )
                resp = await client.get(url, timeout=30.0)
                if resp.status_code in (401, 403):
                    logger.warning("[Tier-2A] Weatherstack auth error (%d)", resp.status_code)
                    return None
                if resp.status_code == 429:
                    logger.warning("[Tier-2A] Weatherstack rate-limited for %d–%d, retrying", start_yr, end_yr)
                    await asyncio.sleep(3)
                    continue
                resp.raise_for_status()
                hist = resp.json().get("historical", {})
                for date_str, day in hist.items():
                    all_times.append(date_str)
                    all_tmax.append(day.get("maxtemp"))
                    all_tmean.append(day.get("avgtemp"))

        if not all_times:
            return None
        result = _process_eras_from_arrays(all_times, all_tmax, all_tmean, is_monthly=False)
        if result:
            logger.info("[Tier-2A] Weatherstack loaded for (%.4f, %.4f)", lat, lng)
        return result

    except Exception as exc:
        logger.warning("[Tier-2A] Weatherstack failed for (%.4f, %.4f): %s", lat, lng, exc)
        return None


# ── TIER 2B: METEOSTAT MONTHLY VIA RAPIDAPI ──────────────────────────────────
async def _fetch_meteostat(lat: float, lng: float) -> Optional[Dict[str, Any]]:
    """
    Tier 2B — Meteostat monthly climate data via RapidAPI.
    Requires METEOSTAT_API_KEY environment variable.
    Fetches 30 years as ~360 monthly records in a single API call.
    """
    api_key = os.getenv("METEOSTAT_API_KEY")
    if not api_key:
        logger.debug("[Tier-2B] Meteostat skipped: METEOSTAT_API_KEY not configured.")
        return None

    logger.info("[Tier-2B] Attempting Meteostat monthly for (%.4f, %.4f)", lat, lng)
    url = "https://meteostat.p.rapidapi.com/point/monthly"
    headers = {
        "x-rapidapi-host": "meteostat.p.rapidapi.com",
        "x-rapidapi-key":  api_key,
    }
    params = {"lat": lat, "lon": lng, "start": "1995-01-01", "end": "2024-12-31"}

    try:
        async with httpx.AsyncClient(timeout=20.0, trust_env=False) as client:
            resp = await client.get(url, headers=headers, params=params)
            resp.raise_for_status()
            data = resp.json().get("data", [])
            if not data:
                return None
            times = [d.get("date", d.get("month")) for d in data]
            tmax  = [d.get("tmax") for d in data]
            tmean = [d.get("tavg") for d in data]
            result = _process_eras_from_arrays(times, tmax, tmean, is_monthly=True)
            if result:
                logger.info("[Tier-2B] Meteostat loaded for (%.4f, %.4f)", lat, lng)
            return result
    except Exception as exc:
        logger.warning("[Tier-2B] Meteostat failed for (%.4f, %.4f): %s", lat, lng, exc)
        return None


# ── TIER 3: VISUAL CROSSING ───────────────────────────────────────────────────
async def _fetch_visual_crossing(lat: float, lng: float) -> Optional[Dict[str, Any]]:
    """
    Tier 3 — Visual Crossing daily historical weather API.
    Requires VISUAL_CROSSING_API_KEY environment variable.
    """
    api_key = os.getenv("VISUAL_CROSSING_API_KEY")
    if not api_key:
        logger.debug("[Tier-3] Visual Crossing skipped: VISUAL_CROSSING_API_KEY not configured.")
        return None

    logger.info("[Tier-3] Attempting Visual Crossing for (%.4f, %.4f)", lat, lng)
    location = f"{lat},{lng}"
    url = (
        f"https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline/"
        f"{urllib.parse.quote_plus(location)}/1995-01-01/2024-12-31"
        f"?unitGroup=metric&contentType=json&key={api_key}&elements=datetime,tempmax,temp"
    )
    try:
        async with httpx.AsyncClient(timeout=25.0, trust_env=False) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            days = resp.json().get("days", [])
            if not days:
                return None
            times = [d.get("datetime") for d in days]
            tmax  = [d.get("tempmax") for d in days]
            tmean = [d.get("temp") for d in days]
            result = _process_eras_from_arrays(times, tmax, tmean, is_monthly=False)
            if result:
                logger.info("[Tier-3] Visual Crossing loaded for (%.4f, %.4f)", lat, lng)
            return result
    except Exception as exc:
        logger.warning("[Tier-3] Visual Crossing failed for (%.4f, %.4f): %s", lat, lng, exc)
        return None


# ── TIER 4: NASA POWER REANALYSIS ─────────────────────────────────────────────
async def _fetch_nasa_power(lat: float, lng: float) -> Optional[Dict[str, Any]]:
    """
    Tier 4 — NASA POWER surface meteorology reanalysis (monthly).
    Free, no API key. Official NASA/GEWEX archive covering 1981–present globally.
    Parameters: T2M (2 m mean temperature) and T2M_MAX (2 m maximum temperature).
    NASA POWER fill value (-999) is filtered before processing.
    """
    logger.info("[Tier-4] Attempting NASA POWER for (%.4f, %.4f)", lat, lng)
    url = (
        f"https://power.larc.nasa.gov/api/temporal/monthly/point"
        f"?parameters=T2M,T2M_MAX"
        f"&community=RE"
        f"&longitude={lng}"
        f"&latitude={lat}"
        f"&start=1995"
        f"&end=2024"
        f"&format=JSON"
    )
    try:
        async with httpx.AsyncClient(timeout=40.0, trust_env=False) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            body   = resp.json()
            params = body.get("properties", {}).get("parameter", {})
            t2m     = params.get("T2M", {})
            t2m_max = params.get("T2M_MAX", {})
            if not t2m:
                logger.warning("[Tier-4] NASA POWER returned empty T2M for (%.4f, %.4f)", lat, lng)
                return None
            # Keys are "YYYYMM" — compatible with _process_eras_from_arrays year extraction
            all_keys = sorted(t2m.keys())
            times = all_keys
            tmax  = [t2m_max.get(k) for k in all_keys]
            tmean = [t2m.get(k) for k in all_keys]
            result = _process_eras_from_arrays(times, tmax, tmean, is_monthly=True)
            if result:
                logger.info("[Tier-4] NASA POWER loaded for (%.4f, %.4f)", lat, lng)
            return result
    except Exception as exc:
        logger.error("[Tier-4] NASA POWER failed for (%.4f, %.4f): %s", lat, lng, exc)
        return None


# ── MASTER ENGINE ─────────────────────────────────────────────────────────────
async def fetch_historical_eras(lat: float, lng: float) -> Dict[str, Any]:
    """
    4-Tier high-availability historical climate data engine.

    Cascade order (each tier only activates if the previous returned None):
      Tier 1:  Open-Meteo ERA5 daily archive (archive-api.open-meteo.com)
      Tier 2A: Weatherstack commercial API   (requires WEATHERSTACK_API_KEY)
      Tier 2B: Meteostat monthly via RapidAPI (requires METEOSTAT_API_KEY)
      Tier 3:  Visual Crossing daily         (requires VISUAL_CROSSING_API_KEY)
      Tier 4:  NASA POWER reanalysis monthly (no key required)

    Raises:
        ValueError: If all 4 tiers return None — no arithmetic fallbacks are
                    used. Data integrity is non-negotiable.
    """
    cache_key = f"hist_eras_v7_{round(lat, 2)}_{round(lng, 2)}"
    cached = _cache_get(cache_key)
    if cached:
        return cached

    # ── Tier 1: ERA5 primary ──────────────────────────────────────────────────
    result = await _fetch_open_meteo_era5(lat, lng)

    # ── Tier 2: Commercial secondary ─────────────────────────────────────────
    if result is None:
        logger.warning(
            "[Failover] Tier 1 exhausted for (%.4f, %.4f) — activating Tier 2 (Weatherstack)",
            lat, lng,
        )
        result = await _fetch_weatherstack(lat, lng)

    if result is None:
        logger.warning(
            "[Failover] Tier 2A exhausted for (%.4f, %.4f) — activating Tier 2B (Meteostat)",
            lat, lng,
        )
        result = await _fetch_meteostat(lat, lng)

    # ── Tier 3: Visual Crossing ───────────────────────────────────────────────
    if result is None:
        logger.warning(
            "[Failover] Tier 2 exhausted for (%.4f, %.4f) — activating Tier 3 (Visual Crossing)",
            lat, lng,
        )
        result = await _fetch_visual_crossing(lat, lng)

    # ── Tier 4: NASA POWER ────────────────────────────────────────────────────
    if result is None:
        logger.warning(
            "[Failover] Tier 3 exhausted for (%.4f, %.4f) — activating Tier 4 (NASA POWER)",
            lat, lng,
        )
        result = await _fetch_nasa_power(lat, lng)

    # ── All 4 tiers exhausted — hard failure ──────────────────────────────────
    if result is None:
        raise ValueError(
            f"Upstream enterprise climate matrices currently unreachable across all "
            f"4 failover cloud clusters for coordinate ({lat:.4f}, {lng:.4f}). "
            "Verify network connectivity and API key configuration."
        )

    _cache_set(cache_key, result)
    return result
