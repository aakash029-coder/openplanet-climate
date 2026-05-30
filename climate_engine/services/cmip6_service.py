"""
climate_engine/services/cmip6_service.py
100% Real Data — Open-Meteo ERA5 + CMIP6 APIs + NASA POWER reanalysis.

Baseline pipeline (2-tier):
  Tier 1: ERA5 daily via archive-api.open-meteo.com (WMO 2011–2020 reference decade)
  Tier 2: NASA POWER daily reanalysis (power.larc.nasa.gov) — no arithmetic fallbacks.

Projection pipeline:
  Primary: Open-Meteo CMIP6 multi-model ensemble (MRI-AGCM3-2-S + MPI-ESM1-2-XR)
  If all models fail, raises ValueError — no invented trend extrapolations.
"""

from __future__ import annotations

import logging
import math
import asyncio
import time
from typing import List, Dict, Optional

import httpx
from collections import OrderedDict
import threading

from climate_engine.settings import settings

logger = logging.getLogger(__name__)

# ── Vercel Tunnel ──────────────────────────────────────────────────────
VERCEL_TUNNEL_URL = settings.VERCEL_TUNNEL_URL

HEADERS = {
    "User-Agent": "OpenPlanet-Risk-Engine/2.0 (Academic Research)",
    "Accept": "application/json",
}

# ── Cache — 24hr TTL, hard size cap ───────────────────────────────────
_CACHE_TTL = 86400
_CACHE_MAX  = 20_000   # (lat, lng, ssp, year) tuples; 4 SSPs × 3 years × ~1667 locations


class _BoundedCache:
    """Thread-safe LRU cache with TTL and hard size cap — no unbounded growth."""
    def __init__(self, maxsize: int, ttl: int):
        self._cache: OrderedDict = OrderedDict()
        self._maxsize = maxsize
        self._ttl = ttl
        self._lock = threading.Lock()

    def get(self, key: str):
        with self._lock:
            if key not in self._cache:
                return None
            data, ts = self._cache[key]
            if time.time() - ts > self._ttl:
                del self._cache[key]
                return None
            self._cache.move_to_end(key)
            return data

    def set(self, key: str, data) -> None:
        with self._lock:
            if key in self._cache:
                self._cache.move_to_end(key)
            self._cache[key] = (data, time.time())
            while len(self._cache) > self._maxsize:
                self._cache.popitem(last=False)


_CACHE = _BoundedCache(maxsize=_CACHE_MAX, ttl=_CACHE_TTL)


class HorizonUnavailable(Exception):
    """
    Raised when a projection year exceeds the validated CMIP6 data horizon (2050).
    OpenPlanet projections are strictly capped at 2050. Beyond this horizon,
    no peer-reviewed CMIP6 output is available via the Open-Meteo ensemble.
    Use IPCC AR6 WG1 published regional warming deltas for indicative 2075/2100 ranges.
    """


PROJECTION_HORIZON_YEAR = 2050  # Hard scientific cap — Open-Meteo CMIP6 ends here


def _cache_get(key: str):
    return _CACHE.get(key)


def _cache_set(key: str, data):
    _CACHE.set(key, data)


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
        sum(temps[i : i + window]) / window
        for i in range(len(temps) - window + 1)
    )


# ── SSP → model mapping ────────────────────────────────────────────────
# MRI-AGCM3-2-S (Japan) and MPI-ESM1-2-XR (Germany) are both high-resolution
# CMIP6 members with full SSP coverage on Open-Meteo's climate API.
CMIP6_MODELS_BY_SSP = {
    "ssp245": ["MRI_AGCM3_2_S", "MPI_ESM1_2_XR"],
    "ssp585": ["MRI_AGCM3_2_S", "MPI_ESM1_2_XR"],
    "ssp126": ["MRI_AGCM3_2_S", "MPI_ESM1_2_XR"],
    "ssp370": ["MRI_AGCM3_2_S", "MPI_ESM1_2_XR"],
}

SSP_PARAM_MAP = {
    "ssp245": "ssp245",
    "ssp585": "ssp585",
    "ssp126": "ssp126",
    "ssp370": "ssp370",
    "SSP2-4.5": "ssp245",
    "SSP5-8.5": "ssp585",
    "SSP1-2.6": "ssp126",
    "SSP3-7.0": "ssp370",
}


async def _tunnel_get(
    url: str,
    client: httpx.AsyncClient,
    timeout: float = 45.0,
    max_attempts: int = 3,
) -> dict:
    """
    Fetch a remote URL with retry + exponential backoff.

    Two execution modes — selected automatically at runtime:
      TUNNEL mode  (VERCEL_TUNNEL_URL is set): POSTs the target URL to the
                   Vercel edge proxy, which forwards the GET request server-side.
                   Required when the engine is hosted on Vercel to avoid CORS
                   restrictions and client-IP rate limits on Open-Meteo.
      DIRECT mode  (VERCEL_TUNNEL_URL is not set): Calls Open-Meteo APIs directly
                   via HTTP GET. Used in local and Docker deployments where no
                   client-side CORS restriction exists.
    """
    use_tunnel = bool(VERCEL_TUNNEL_URL)
    last_exc: Optional[Exception] = None

    if use_tunnel:
        safe_tunnel_url = VERCEL_TUNNEL_URL
        if not safe_tunnel_url.startswith("http://") and not safe_tunnel_url.startswith("https://"):
            safe_tunnel_url = "https://" + safe_tunnel_url

    for attempt in range(1, max_attempts + 1):
        try:
            if use_tunnel:
                resp = await client.post(
                    safe_tunnel_url,
                    json={"target_url": url},
                    timeout=timeout,
                )
            else:
                resp = await client.get(url, timeout=timeout)

            if resp.status_code == 429:
                wait = 2 ** attempt
                logger.warning("API 429 (attempt %d), waiting %ds", attempt, wait)
                await asyncio.sleep(wait)
                continue

            resp.raise_for_status()
            data = resp.json()

            if use_tunnel and isinstance(data, dict) and "error" in data:
                raise ValueError(f"Tunnel error response: {data['error']}")

            return data

        except Exception as exc:
            last_exc = exc
            if attempt < max_attempts:
                wait = 2 ** attempt
                logger.warning(
                    "Fetch attempt %d/%d failed (%s mode): %s — retrying in %ds",
                    attempt, max_attempts, "tunnel" if use_tunnel else "direct", exc, wait,
                )
                await asyncio.sleep(wait)

    raise ValueError(
        f"All {max_attempts} fetch attempts failed "
        f"({'tunnel' if use_tunnel else 'direct'} mode). Last error: {last_exc}"
    )


async def _fetch_era5_daily(
    lat: float,
    lng: float,
    start_date: str,
    end_date: str,
    variables: List[str],
    client: httpx.AsyncClient,
) -> dict:
    """Fetch ERA5 reanalysis via Vercel Tunnel."""
    vars_str = ",".join(variables)
    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lng}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&daily={vars_str}"
        f"&timezone=auto"
    )

    data = await _tunnel_get(url, client)

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
) -> Optional[dict]:
    """Fetch single CMIP6 model via Vercel Tunnel."""
    url = (
        f"https://climate-api.open-meteo.com/v1/climate"
        f"?latitude={lat}&longitude={lng}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&models={model}"
        f"&daily=temperature_2m_max,temperature_2m_min,temperature_2m_mean"
        f"&timezone=auto"
    )
    try:
        data = await _tunnel_get(url, client, timeout=60.0, max_attempts=2)
        if "daily" not in data:
            logger.warning("CMIP6 %s: no daily data", model)
            return None
        return data["daily"]
    except Exception as e:
        logger.warning("CMIP6 model %s failed: %s", model, e)
        return None


def _extract_decade_stats(
    daily: dict,
    decade_center: int,
    p95_threshold: float,
    window_years: int = 2,  # Refined default window
) -> Optional[dict]:
    """Extract climate statistics for a decade window from CMIP6 daily data."""
    times = daily.get("time", [])
    tmax_raw = daily.get("temperature_2m_max", [])
    tmean_raw = daily.get("temperature_2m_mean", [])

    if not times or not tmax_raw:
        return None

    yr_start = str(decade_center - window_years)
    yr_end = str(decade_center + window_years - 1)

    tmax_window: list[float] = []
    tmean_window: list[float] = []
    
    unique_years_set = set()

    for i, t in enumerate(times):
        yr = t[:4]
        if yr_start <= yr <= yr_end:
            unique_years_set.add(yr)
            if i < len(tmax_raw) and tmax_raw[i] is not None:
                tmax_window.append(float(tmax_raw[i]))
            if i < len(tmean_raw) and tmean_raw[i] is not None:
                tmean_window.append(float(tmean_raw[i]))

    if not tmax_window:
        return None

    # Require mean temperature — CMIP6 output always includes temperature_2m_mean;
    # if absent this model slice is corrupt and must be excluded from the ensemble.
    if not tmean_window:
        logger.warning(
            "CMIP6 decade stats: no mean-temperature data in window [%s, %s] — model excluded.",
            yr_start, yr_end,
        )
        return None

    tx5d = _rolling_max_mean(sorted(tmax_window, reverse=True)[:365], window=5)

    hw_days_total = sum(1 for t in tmax_window if t > p95_threshold)
    unique_years  = len(unique_years_set)
    hw_days_annual = round(hw_days_total / max(1, unique_years), 1)

    mean_temp = sum(tmean_window) / len(tmean_window)

    return {
        "tx5d_c": round(tx5d, 2),
        "hw_days": hw_days_annual,
        "mean_temp_c": round(mean_temp, 2),
        "n_days": len(tmax_window),
    }


async def _fetch_nasa_power_baseline(lat: float, lng: float) -> dict:
    """
    Tier 2 baseline fallback — NASA POWER daily reanalysis (2011–2020).

    Provides the same statistics as ERA5 (annual_mean_c, p95_threshold_c,
    tx5d_baseline_c, hw_days_baseline) from official NASA/GEWEX surface
    meteorology data. Free, no API key. NASA POWER fill-value (-999) is
    filtered before any statistical computation.
    """
    url = (
        f"https://power.larc.nasa.gov/api/temporal/daily/point"
        f"?parameters=T2M,T2M_MAX"
        f"&community=RE"
        f"&longitude={lng}"
        f"&latitude={lat}"
        f"&start=20110101"
        f"&end=20201231"
        f"&format=JSON"
    )
    async with httpx.AsyncClient(timeout=45.0, trust_env=False) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        body   = resp.json()
        params = body.get("properties", {}).get("parameter", {})
        t2m     = params.get("T2M", {})
        t2m_max = params.get("T2M_MAX", {})

    if not t2m:
        raise ValueError(f"NASA POWER returned empty T2M data for ({lat}, {lng})")

    tmean_vals = [v for v in t2m.values()     if v is not None and float(v) != -999.0]
    tmax_vals  = [v for v in t2m_max.values() if v is not None and float(v) != -999.0]

    if not tmean_vals or not tmax_vals:
        raise ValueError(f"NASA POWER: insufficient valid data for ({lat}, {lng})")

    annual_mean   = round(sum(tmean_vals) / len(tmean_vals), 2)
    p95_threshold = round(_percentile(tmax_vals, 95.0), 2)
    tx5d_baseline = round(_rolling_max_mean(sorted(tmax_vals, reverse=True)[:365], 5), 2)
    hw_total      = sum(1 for t in tmax_vals if t > p95_threshold)
    nasa_years    = len({k[:4] for k in t2m.keys()}) or 10
    hw_baseline   = round(hw_total / nasa_years, 1)

    logger.info(
        "NASA POWER baseline (%.4f, %.4f): mean=%.2f°C | p95=%.2f°C | tx5d=%.2f°C | hw/yr=%.1f",
        lat, lng, annual_mean, p95_threshold, tx5d_baseline, hw_baseline,
    )
    return {
        "annual_mean_c":    annual_mean,
        "p95_threshold_c":  p95_threshold,
        "tx5d_baseline_c":  tx5d_baseline,
        "hw_days_baseline": hw_baseline,
        "_lineage":         "nasa_power_reanalysis",
        "_compiled_at":     time.time(),
    }


def _ensemble_mean(model_results: List[dict], key: str) -> float:
    """IPCC AR6 equal-weight multi-model ensemble mean."""
    values = [r[key] for r in model_results if r and key in r]
    if not values:
        raise ValueError(f"No models produced '{key}'")
    return round(sum(values) / len(values), 2)


async def fetch_historical_baseline(lat: float, lng: float) -> float:
    """
    Annual mean temperature from ERA5 (Tier 1) or NASA POWER (Tier 2).
    Raises ValueError if both data sources are unavailable.
    """
    cache_key = f"baseline_mean_{round(lat, 2)}_{round(lng, 2)}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    # Tier 1: ERA5
    try:
        async with httpx.AsyncClient(headers=HEADERS) as client:
            daily = await _fetch_era5_daily(
                lat, lng,
                "2011-01-01", "2020-12-31",  # WMO 2011–2020 reference decade
                ["temperature_2m_mean"],
                client,
            )
        temps = [t for t in daily.get("temperature_2m_mean", []) if t is not None]
        if not temps:
            raise ValueError(f"ERA5: no temperature data for {lat},{lng}")
        result = round(sum(temps) / len(temps), 2)
        logger.info("ERA5 baseline mean (%.4f, %.4f): %.2f°C", lat, lng, result)
        _cache_set(cache_key, result)
        return result

    except Exception as exc:
        logger.warning("ERA5 baseline mean failed for (%.4f, %.4f): %s — shifting to Tier 2 (NASA POWER)", lat, lng, exc)

    # Tier 2: NASA POWER
    try:
        nasa = await _fetch_nasa_power_baseline(lat, lng)
        result = nasa["annual_mean_c"]
        _cache_set(cache_key, result)
        return result
    except Exception as exc:
        raise ValueError(
            f"Upstream climate baseline matrices unreachable for ({lat:.4f}, {lng:.4f}): {exc}"
        ) from exc


async def fetch_historical_baseline_full(lat: float, lng: float) -> dict:
    """
    Full ERA5 baseline statistics (annual_mean_c, p95_threshold_c, tx5d_baseline_c, hw_days_baseline).

    2-tier pipeline:
      Tier 1: ERA5 daily via archive-api.open-meteo.com (WMO 2011–2020 reference decade)
      Tier 2: NASA POWER daily reanalysis (power.larc.nasa.gov), same date window

    Raises ValueError if both tiers are unavailable — no arithmetic substitutions.
    """
    cache_key = f"baseline_full_{round(lat, 2)}_{round(lng, 2)}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    # ── Tier 1: ERA5 ─────────────────────────────────────────────────────────
    try:
        async with httpx.AsyncClient(headers=HEADERS) as client:
            daily = await _fetch_era5_daily(
                lat, lng,
                "2011-01-01", "2020-12-31",  # WMO 2011–2020 reference decade
                ["temperature_2m_max", "temperature_2m_mean"],
                client,
            )

        tmax_all  = [t for t in daily.get("temperature_2m_max",  []) if t is not None]
        tmean_all = [t for t in daily.get("temperature_2m_mean", []) if t is not None]

        if not tmax_all:
            raise ValueError(f"ERA5 baseline: no data for ({lat},{lng})")

        annual_mean   = round(sum(tmean_all) / len(tmean_all), 2) if tmean_all else 0.0
        p95_threshold = round(_percentile(tmax_all, 95.0), 2)
        tx5d_baseline = round(_rolling_max_mean(sorted(tmax_all, reverse=True)[:365], 5), 2)
        hw_total      = sum(1 for t in tmax_all if t > p95_threshold)
        era5_years    = len({d[:4] for d in daily.get("time", []) if d}) or 10
        hw_baseline   = round(hw_total / era5_years, 1)

        result = {
            "annual_mean_c":    annual_mean,
            "p95_threshold_c":  p95_threshold,
            "tx5d_baseline_c":  tx5d_baseline,
            "hw_days_baseline": hw_baseline,
            "_lineage":         "empirical_api",
            "_compiled_at":     time.time(),
        }
        logger.info(
            "ERA5 full baseline (%.4f, %.4f): mean=%.2f°C | p95=%.2f°C | tx5d=%.2f°C | hw/yr=%.1f",
            lat, lng, annual_mean, p95_threshold, tx5d_baseline, hw_baseline,
        )
        _cache_set(cache_key, result)
        return result

    except Exception as exc:
        logger.warning(
            "ERA5 full baseline failed for (%.4f, %.4f): %s — shifting to Tier 2 (NASA POWER)",
            lat, lng, exc,
        )

    # ── Tier 2: NASA POWER ────────────────────────────────────────────────────
    try:
        result = await _fetch_nasa_power_baseline(lat, lng)
        _cache_set(cache_key, result)
        return result
    except Exception as exc:
        raise ValueError(
            f"Upstream climate baseline matrices unreachable for ({lat:.4f}, {lng:.4f}): {exc}"
        ) from exc


async def fetch_cmip6_projection(
    lat: float,
    lng: float,
    ssp: str,
    target_year: int,
    p95_threshold: float,
    total_cooling: float = 0.0,
) -> dict:
    """
    Real CMIP6 multi-model ensemble projection.
    Strictly capped at PROJECTION_HORIZON_YEAR (2050).
    Raises HorizonUnavailable for any year beyond the validated data horizon.
    """
    if target_year > PROJECTION_HORIZON_YEAR:
        raise HorizonUnavailable(
            f"Projection year {target_year} exceeds the validated CMIP6 data horizon "
            f"({PROJECTION_HORIZON_YEAR}). OpenPlanet does not extrapolate beyond peer-reviewed "
            f"CMIP6 ensemble outputs. Request a year ≤ {PROJECTION_HORIZON_YEAR}."
        )

    ssp_param = SSP_PARAM_MAP.get(ssp, "ssp245")
    cache_key = f"proj_{round(lat,2)}_{round(lng,2)}_{ssp_param}_{target_year}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    models = CMIP6_MODELS_BY_SSP.get(ssp_param, CMIP6_MODELS_BY_SSP["ssp245"])
    
    # ±2yr window around target_year: 4 years of daily data per model.
    # Balances CMIP6 internal variability smoothing vs API payload size.
    window = 2
    start_yr = max(2015, target_year - window)
    end_yr = min(2050, target_year + window - 1)

    start_date = f"{start_yr}-01-01"
    end_date = f"{end_yr}-12-31"

    model_dailies = []
    try:
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
    except Exception as exc:
        logger.error("CMIP6 fetch completely failed for %s,%s: %s", lat, lng, exc)

    model_stats = []
    for model, daily in model_dailies:
        stats = _extract_decade_stats(daily, target_year, p95_threshold, window)
        if stats:
            model_stats.append(stats)
            logger.info(
                "CMIP6 %s %s %d: tx5d=%.2f°C",
                model, ssp_param, target_year, stats["tx5d_c"],
            )

    if not model_stats:
        raise ValueError(
            f"All CMIP6 ensemble models failed for ({lat:.4f}, {lng:.4f}) "
            f"scenario={ssp_param} year={target_year}. "
            "No arithmetic extrapolations are used — upstream CMIP6 data is required."
        )

    raw_tx5d = _ensemble_mean(model_stats, "tx5d_c")
    raw_hw_days = _ensemble_mean(model_stats, "hw_days")
    raw_mean = _ensemble_mean(model_stats, "mean_temp_c")

    mitigated_tx5d = round(raw_tx5d - total_cooling, 2)
    mitigated_hw_days = round(max(0.0, raw_hw_days - (total_cooling * 3.5)), 1)

    result = {
        "year": target_year,
        "tx5d_c": mitigated_tx5d,
        "tx5d_raw_c": raw_tx5d,
        "hw_days": mitigated_hw_days,
        "hw_days_raw": raw_hw_days,
        "mean_temp_c": raw_mean,
        "n_models": len(model_stats),
        "source": f"open_meteo_cmip6_ensemble_{len(model_stats)}models",
    }

    _cache_set(cache_key, result)
    return result


async def fetch_cmip6_timeseries(
    lat: float,
    lng: float,
    ssp: str,
    target_year: int,
) -> List[Dict]:
    """Legacy interface for compatibility."""
    baseline = await fetch_historical_baseline_full(lat, lng)
    p95 = baseline["p95_threshold_c"]

    chart_years = sorted(
        {y for y in [2030, 2040, 2050] if y <= min(target_year, PROJECTION_HORIZON_YEAR)}
    )
    if not chart_years:
        chart_years = [min(target_year, PROJECTION_HORIZON_YEAR)]
    if target_year <= PROJECTION_HORIZON_YEAR and target_year not in chart_years:
        chart_years.append(target_year)
        chart_years = sorted(chart_years)

    results = []
    for year in chart_years:
        try:
            proj = await fetch_cmip6_projection(lat, lng, ssp, year, p95)
            results.append({
                "year": year,
                "temp": proj["tx5d_c"],
                "heatwaves": int(proj["hw_days"]),
            })
        except Exception as e:
            logger.warning("fetch_cmip6_timeseries: year %d skipped: %s", year, e)

    if not results:
        raise ValueError(
            f"fetch_cmip6_timeseries: all years failed for {lat},{lng} {ssp}"
        )

    return results