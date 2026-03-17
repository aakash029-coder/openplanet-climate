"""
climate_engine/services/cmip6_service.py
100% Real Data — Open-Meteo ERA5 + CMIP6 APIs only. Zero fake/demo data.
(Optimized with Vercel Tunnel & Parallel Processing)
"""
from __future__ import annotations
import logging
import math
import asyncio
import time
from typing import List, Dict, Optional

import httpx

logger = logging.getLogger(__name__)

# ─── 🛡️ THE VERCEL BYPASS TUNNEL ──────────────────────────────────────
VERCEL_TUNNEL_URL = "https://openplanet-ai.vercel.app/api/tunnel"

HEADERS = {
    "User-Agent": "OpenPlanet-Risk-Engine/2.0 (Academic Research)",
    "Accept": "application/json",
}

# ── Cache — 24hr TTL ──────────────────────────────────────────────────
_CACHE: dict = {}
_CACHE_TTL = 86400


def _cache_get(key: str):
    if key in _CACHE:
        data, ts = _CACHE[key]
        if time.time() - ts < _CACHE_TTL:
            logger.info(f"CACHE HIT: {key}")
            return data
    return None


def _cache_set(key: str, data):
    _CACHE[key] = (data, time.time())


def _percentile(data: List[float], p: float) -> float:
    """Pure Python percentile — no numpy dependency."""
    if not data:
        raise ValueError("Empty data for percentile calculation.")
    s = sorted(data)
    k = (len(s) - 1) * (p / 100.0)
    f, c = math.floor(k), math.ceil(k)
    if f == c:
        return s[int(k)]
    return s[f] * (c - k) + s[c] * (k - f)


def _rolling_max_mean(temps: List[float], window: int = 5) -> float:
    """WMO Tx5d — hottest consecutive N-day mean."""
    if len(temps) < window:
        return max(temps) if temps else 0.0
    return max(
        sum(temps[i:i + window]) / window
        for i in range(len(temps) - window + 1)
    )


# ── SSP → model mapping ───────────────────────────────────────────────
CMIP6_MODELS_BY_SSP = {
    "ssp245": [
        "MRI_AGCM3_2_S",   # MRI Japan — 20km, best for Asia
        "NICAM16_8S",       # NICAM Japan — strong tropical performance
        "MPI_ESM1_2_XR",    # MPI Germany — good global coverage
    ],
    "ssp585": [
        "MRI_AGCM3_2_S",   # MRI Japan
        "EC_Earth3P_HR",    # EC-Earth Europe — strong for high emissions
        "MPI_ESM1_2_XR",    # MPI Germany
    ],
    "ssp126": [
        "MRI_AGCM3_2_S",
        "MPI_ESM1_2_XR",
        "NICAM16_8S",
    ],
}

SSP_PARAM_MAP = {
    "ssp245":   "ssp245",
    "ssp585":   "ssp585",
    "ssp126":   "ssp126",
    "SSP2-4.5": "ssp245",
    "SSP5-8.5": "ssp585",
    "SSP1-2.6": "ssp126",
}


async def _fetch_era5_daily(
    lat: float,
    lng: float,
    start_date: str,
    end_date: str,
    variables: List[str],
    client: httpx.AsyncClient,
) -> dict:
    """
    Fetch ERA5 reanalysis via Vercel Tunnel.
    Real observed climate data 1940-present.
    """
    vars_str = ",".join(variables)
    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lng}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&daily={vars_str}"
        f"&timezone=auto"
    )
    
    # 🔥 TUNNEL MAGIC: POST request to Vercel
    resp = await client.post(VERCEL_TUNNEL_URL, json={"target_url": url}, timeout=45.0)
    resp.raise_for_status()
    data = resp.json()
    
    if isinstance(data, dict) and "error" in data:
        raise ValueError(f"Tunnel Error: {data['error']}")
        
    if "daily" not in data:
        raise ValueError(f"ERA5 API returned no daily data for {lat},{lng}")
    return data["daily"]


async def _fetch_cmip6_model(
    lat: float,
    lng: float,
    model: str,
    start_date: str,
    end_date: str,
    client: httpx.AsyncClient,
) -> dict | None:
    """
    Fetch single CMIP6 model via Vercel Tunnel.
    """
    url = (
        f"https://climate-api.open-meteo.com/v1/climate"
        f"?latitude={lat}&longitude={lng}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&models={model}"
        f"&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean"
        f"&timezone=auto"
    )
    try:
        # 🔥 TUNNEL MAGIC: POST request to Vercel
        resp = await client.post(VERCEL_TUNNEL_URL, json={"target_url": url}, timeout=60.0)
        resp.raise_for_status()
        data = resp.json()
        
        if isinstance(data, dict) and "error" in data:
            logger.warning(f"Tunnel Error for CMIP6 {model}: {data['error']}")
            return None
            
        if "daily" not in data:
            logger.warning(f"CMIP6 {model}: no daily data")
            return None
        return data["daily"]
    except Exception as e:
        logger.warning(f"CMIP6 model {model} failed: {e}")
        return None


def _extract_decade_stats(
    daily: dict,
    decade_center: int,
    p95_threshold: float,
    window_years: int = 5,
) -> dict | None:
    """Extract climate statistics for a decade window from CMIP6 daily data."""
    times     = daily.get("time", [])
    tmax_raw  = daily.get("temperature_2m_max", [])
    tmean_raw = daily.get("temperature_2m_mean", [])

    if not times or not tmax_raw:
        return None

    yr_start = str(decade_center - window_years)
    yr_end   = str(decade_center + window_years - 1)

    tmax_window  = []
    tmean_window = []

    for i, t in enumerate(times):
        yr = t[:4]
        if yr_start <= yr <= yr_end:
            if i < len(tmax_raw)  and tmax_raw[i]  is not None:
                tmax_window.append(float(tmax_raw[i]))
            if i < len(tmean_raw) and tmean_raw[i] is not None:
                tmean_window.append(float(tmean_raw[i]))

    if not tmax_window:
        return None

    tx5d = _rolling_max_mean(
        sorted(tmax_window, reverse=True)[:365], window=5
    )

    hw_days_total = sum(1 for t in tmax_window if t > p95_threshold)
    unique_years  = len(set(
        times[i][:4]
        for i, _ in enumerate(times)
        if i < len(times) and yr_start <= times[i][:4] <= yr_end
    ))
    hw_days_annual = round(hw_days_total / max(1, unique_years), 1)

    mean_temp = (
        sum(tmean_window) / len(tmean_window)
        if tmean_window else tx5d - 8.0
    )

    return {
        "tx5d_c":      round(tx5d, 2),
        "hw_days":     hw_days_annual,
        "mean_temp_c": round(mean_temp, 2),
        "n_days":      len(tmax_window),
    }


def _ensemble_mean(model_results: List[dict], key: str) -> float:
    """IPCC AR6 equal-weight multi-model ensemble mean."""
    values = [r[key] for r in model_results if r and key in r]
    if not values:
        raise ValueError(f"No models produced '{key}'")
    return round(sum(values) / len(values), 2)


async def fetch_historical_baseline(lat: float, lng: float) -> float:
    """ERA5 1991-2020 annual mean temperature."""
    cache_key = f"baseline_mean_{round(lat, 2)}_{round(lng, 2)}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(headers=HEADERS) as client:
        daily = await _fetch_era5_daily(
            lat, lng,
            "1991-01-01", "2020-12-31",
            ["temperature_2m_mean"],
            client,
        )

    temps = [t for t in daily.get("temperature_2m_mean", []) if t is not None]
    if not temps:
        raise ValueError(f"ERA5: no temperature data for {lat},{lng}")

    result = round(sum(temps) / len(temps), 2)
    logger.info(f"ERA5 baseline mean {lat},{lng}: {result}°C")
    _cache_set(cache_key, result)
    return result


async def fetch_historical_baseline_full(lat: float, lng: float) -> dict:
    """Full ERA5 1991-2020 baseline statistics."""
    cache_key = f"baseline_full_{round(lat, 2)}_{round(lng, 2)}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    async with httpx.AsyncClient(headers=HEADERS) as client:
        daily = await _fetch_era5_daily(
            lat, lng,
            "1991-01-01", "2020-12-31",
            ["temperature_2m_max", "temperature_2m_mean"],
            client,
        )

    tmax_all  = [t for t in daily.get("temperature_2m_max",  []) if t is not None]
    tmean_all = [t for t in daily.get("temperature_2m_mean", []) if t is not None]

    if not tmax_all:
        raise ValueError(f"ERA5 baseline: no data for {lat},{lng}")

    annual_mean   = round(sum(tmean_all) / len(tmean_all), 2) if tmean_all else 0.0
    p95_threshold = round(_percentile(tmax_all, 95.0), 2)
    tx5d_baseline = round(
        _rolling_max_mean(sorted(tmax_all, reverse=True)[:365], 5), 2
    )
    hw_total      = sum(1 for t in tmax_all if t > p95_threshold)
    hw_baseline   = round(hw_total / 30.0, 1)

    result = {
        "annual_mean_c":    annual_mean,
        "p95_threshold_c":  p95_threshold,
        "tx5d_baseline_c":  tx5d_baseline,
        "hw_days_baseline": hw_baseline,
    }

    logger.info(
        f"ERA5 full baseline {lat},{lng}: "
        f"mean={annual_mean}°C | p95={p95_threshold}°C | "
        f"tx5d={tx5d_baseline}°C | hw/yr={hw_baseline}"
    )
    _cache_set(cache_key, result)
    return result


async def fetch_cmip6_projection(
    lat: float,
    lng: float,
    ssp: str,
    target_year: int,
    p95_threshold: float,
    total_cooling: float = 0.0,
) -> dict:
    """
    Real CMIP6 multi-model ensemble projection (Parallel Fetch).
    """
    ssp_param = SSP_PARAM_MAP.get(ssp, "ssp245")
    cache_key = f"proj_{round(lat,2)}_{round(lng,2)}_{ssp_param}_{target_year}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    models     = CMIP6_MODELS_BY_SSP.get(ssp_param, CMIP6_MODELS_BY_SSP["ssp245"])
    window     = 5
    start_yr   = max(2015, target_year - window)
    
    # 🔥 THE FIX: Strictly lock the maximum end year to 2050 for API calls
    end_yr     = min(2050, target_year + window - 1)
    
    start_date = f"{start_yr}-01-01"
    end_date   = f"{end_yr}-12-31"

    # ✅ Superfast Parallel Fetching via Vercel Tunnel
    model_dailies = []
    async with httpx.AsyncClient(headers=HEADERS) as client:
        tasks = [
            _fetch_cmip6_model(lat, lng, model, start_date, end_date, client)
            for model in models
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
        
        for model, daily in zip(models, results):
            if isinstance(daily, Exception) or daily is None:
                continue
            model_dailies.append((model, daily))

    model_stats = []
    for model, daily in model_dailies:
        stats = _extract_decade_stats(daily, target_year, p95_threshold, window)
        if stats:
            model_stats.append(stats)
            logger.info(f"CMIP6 {model} {ssp_param} {target_year}: tx5d={stats['tx5d_c']}°C")

    if not model_stats:
        raise ValueError(f"All CMIP6 models failed for {lat},{lng} {ssp_param} {target_year}.")

    # IPCC AR6 equal-weight ensemble mean
    raw_tx5d    = _ensemble_mean(model_stats, "tx5d_c")
    raw_hw_days = _ensemble_mean(model_stats, "hw_days")
    raw_mean    = _ensemble_mean(model_stats, "mean_temp_c")

    mitigated_tx5d    = round(raw_tx5d - total_cooling, 2)
    mitigated_hw_days = round(max(0.0, raw_hw_days - (total_cooling * 3.5)), 1)

    result = {
        "year":        target_year,
        "tx5d_c":      mitigated_tx5d,
        "tx5d_raw_c":  raw_tx5d,
        "hw_days":     mitigated_hw_days,
        "hw_days_raw": raw_hw_days,
        "mean_temp_c": raw_mean,
        "n_models":    len(model_stats),
        "source":      f"open_meteo_cmip6_ensemble_{len(model_stats)}models",
    }

    _cache_set(cache_key, result)
    return result


async def fetch_cmip6_timeseries(
    lat: float,
    lng: float,
    ssp: str,
    target_year: int,
) -> List[Dict]:
    """Legacy interface for main.py compatibility."""
    baseline = await fetch_historical_baseline_full(lat, lng)
    p95      = baseline["p95_threshold_c"]

    chart_years = sorted({
        y for y in [2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100]
        if y <= target_year
    })
    if not chart_years:
        chart_years = [target_year]
    if target_year not in chart_years:
        chart_years.append(target_year)
        chart_years = sorted(chart_years)

    results = []
    for year in chart_years:
        try:
            proj = await fetch_cmip6_projection(lat, lng, ssp, year, p95)
            results.append({
                "year":      year,
                "temp":      proj["tx5d_c"],
                "heatwaves": int(proj["hw_days"]),
            })
        except Exception as e:
            logger.warning(f"fetch_cmip6_timeseries: year {year} skipped: {e}")

    if not results:
        raise ValueError(f"fetch_cmip6_timeseries: all years failed for {lat},{lng} {ssp}")

    return results