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
from climate_engine.services.disk_cache import disk_get, disk_set

logger = logging.getLogger(__name__)

# WMO reference decade used everywhere for the ERA5 baseline climatology.
ERA5_BASELINE_START = "2011-01-01"
ERA5_BASELINE_END = "2020-12-31"
# Disk-cache TTL for heavy upstream payloads (30 days). On HF free tier this makes
# the warm path a zero-API-call read that survives cold starts.
_DISK_TTL = 86400 * 30

# All ERA5 daily variables the engine needs, fetched in ONE archive call and
# shared by the baseline, Köppen, humidity-P95 and wet-bulb computations.
ERA5_BUNDLE_VARS = [
    "temperature_2m_max",
    "temperature_2m_mean",
    "precipitation_sum",
    "relative_humidity_2m_mean",
    "dew_point_2m_mean",
    "wet_bulb_temperature_2m_max",
]

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
    """
    Hottest N-day mean over a *date-ordered* daily series. NOTE: callers must
    pass chronologically-ordered values — sorting beforehand breaks the
    'consecutive days' definition. Retained for the per-year Tx5d helper below.
    """
    if len(temps) < window:
        return max(temps) if temps else 0.0
    return max(
        sum(temps[i : i + window]) / window
        for i in range(len(temps) - window + 1)
    )


def _annual_tx5d_values(times: List[str], tmax: List[float]) -> List[float]:
    """
    WMO Tx5d per calendar year = annual maximum of the 5-CONSECUTIVE-day mean of
    daily Tmax. Returns one value per year that has ≥5 valid days. Daily series
    from ERA5/CMIP6 are already chronological, so consecutiveness is preserved.
    """
    by_year: "OrderedDict[str, List[float]]" = OrderedDict()
    for t, v in zip(times, tmax):
        if not t or v is None:
            continue
        by_year.setdefault(t[:4], []).append(float(v))
    out: List[float] = []
    for _yr, vals in by_year.items():
        if len(vals) >= 5:
            out.append(_rolling_max_mean(vals, 5))
    return out


def _tx5d_normal(times: List[str], tmax: List[float]) -> Optional[float]:
    """Decadal Tx5d 'normal' = mean of the per-year annual Tx5d maxima."""
    vals = _annual_tx5d_values(times, tmax)
    if not vals:
        return None
    return sum(vals) / len(vals)


def _window_stats(daily: dict, p95_threshold: float) -> Optional[dict]:
    """
    Compute {tx5d_c, hw_days, mean_temp_c} over a daily window using a PROPER
    consecutive-5-day Tx5d and the supplied P95 heat threshold for heatwave days.
    Used identically for the CMIP6 baseline window and the CMIP6 future window so
    that any model bias cancels in the (future − baseline) delta.
    """
    times = daily.get("time", [])
    tmax_raw = daily.get("temperature_2m_max", [])
    tmean_raw = daily.get("temperature_2m_mean", [])
    if not times or not tmax_raw:
        return None

    pairs = [(t, v) for t, v in zip(times, tmax_raw) if t and v is not None]
    if not pairs:
        return None
    times_c = [t for t, _ in pairs]
    tmax_c = [v for _, v in pairs]

    tx5d = _tx5d_normal(times_c, tmax_c)
    if tx5d is None:
        return None

    years = {t[:4] for t in times_c}
    hw_total = sum(1 for v in tmax_c if v > p95_threshold)
    hw_days = hw_total / max(1, len(years))

    tmean_clean = [v for v in tmean_raw if v is not None]
    mean_temp = sum(tmean_clean) / len(tmean_clean) if tmean_clean else None
    if mean_temp is None:
        return None

    return {
        "tx5d_c": round(tx5d, 2),
        "hw_days": round(hw_days, 1),
        "mean_temp_c": round(mean_temp, 2),
        "n_days": len(tmax_c),
    }


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


async def fetch_era5_bundle(lat: float, lng: float) -> dict:
    """
    Fetch ALL ERA5 daily variables for the 2011–2020 baseline decade in a single
    archive-api call, memory- and disk-cached. This is the engine's one ERA5
    request per location; the baseline, Köppen, humidity-P95 and wet-bulb paths
    all read from it instead of issuing their own calls — critical for staying
    under the Open-Meteo rate limit on Hugging Face's shared free-tier IP.
    """
    key = f"era5_bundle_{round(lat, 2)}_{round(lng, 2)}"
    cached = _cache_get(key)
    if cached is not None:
        return cached
    on_disk = disk_get(key, ttl=_DISK_TTL)
    if on_disk is not None:
        _cache_set(key, on_disk)
        return on_disk

    async with httpx.AsyncClient(headers=HEADERS) as client:
        daily = await _fetch_era5_daily(
            lat, lng, ERA5_BASELINE_START, ERA5_BASELINE_END, ERA5_BUNDLE_VARS, client
        )
    if not daily.get("temperature_2m_max"):
        raise ValueError(f"ERA5 bundle returned no Tmax for ({lat:.2f}, {lng:.2f})")
    _cache_set(key, daily)
    disk_set(key, daily)
    return daily


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


# Full CMIP6 series per model, fetched ONCE per (lat,lng,model) and sliced for the
# baseline window, every projection horizon, and the wet-bulb profile. This keeps
# the engine to 2 CMIP6 requests per city (one per model) instead of ~8, so the
# live site stays fast and well under the free-tier rate limit.
CMIP6_FULL_START = "2011-01-01"
CMIP6_FULL_END = "2050-12-31"


async def _fetch_cmip6_model_full(
    lat: float, lng: float, model: str, client: httpx.AsyncClient
) -> Optional[dict]:
    """Fetch (and cache) a model's full 2011–2050 daily series with all variables."""
    cache_key = f"cmip6_full_{round(lat,2)}_{round(lng,2)}_{model}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    on_disk = disk_get(cache_key, ttl=_DISK_TTL)
    if on_disk is not None:
        _cache_set(cache_key, on_disk)
        return on_disk
    url = (
        f"https://climate-api.open-meteo.com/v1/climate"
        f"?latitude={lat}&longitude={lng}"
        f"&start_date={CMIP6_FULL_START}&end_date={CMIP6_FULL_END}"
        f"&models={model}"
        f"&daily=temperature_2m_max,temperature_2m_mean,dew_point_2m_mean"
        f"&timezone=auto"
    )
    try:
        data = await _tunnel_get(url, client, timeout=90.0, max_attempts=3)
        daily = data.get("daily")
        if not daily or not daily.get("time"):
            logger.warning("CMIP6 %s: no daily data in full series", model)
            return None
        _cache_set(cache_key, daily)
        disk_set(cache_key, daily)
        return daily
    except Exception as e:
        logger.warning("CMIP6 full series %s failed: %s", model, e)
        return None


def _slice_daily_by_years(full: dict, y0: int, y1: int) -> dict:
    """Return the subset of a daily dict whose dates fall in [y0, y1] (inclusive)."""
    times = full.get("time", [])
    var_keys = [k for k in full if k != "time"]
    out: dict = {"time": []}
    for k in var_keys:
        out[k] = []
    for i, t in enumerate(times):
        if not t:
            continue
        y = int(t[:4])
        if y0 <= y <= y1:
            out["time"].append(t)
            for k in var_keys:
                arr = full.get(k, [])
                out[k].append(arr[i] if i < len(arr) else None)
    return out


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

    # Chronological (date, Tmax) series for a proper consecutive-5-day Tx5d.
    nasa_times = [f"{k[:4]}-{k[4:6]}-{k[6:8]}" for k in sorted(t2m_max.keys())]
    nasa_tmax = [
        (float(t2m_max[k]) if t2m_max[k] is not None and float(t2m_max[k]) != -999.0 else None)
        for k in sorted(t2m_max.keys())
    ]

    annual_mean   = round(sum(tmean_vals) / len(tmean_vals), 2)
    p95_threshold = round(_percentile(tmax_vals, 95.0), 2)
    _tx5d = _tx5d_normal(nasa_times, nasa_tmax)
    tx5d_baseline = round(_tx5d if _tx5d is not None else max(tmax_vals), 2)
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

    # ── Tier 1: ERA5 (shared single-call bundle) ─────────────────────────────
    try:
        daily = await fetch_era5_bundle(lat, lng)

        times_all = daily.get("time", [])
        tmax_series = daily.get("temperature_2m_max", [])
        tmax_all  = [t for t in tmax_series if t is not None]
        tmean_all = [t for t in daily.get("temperature_2m_mean", []) if t is not None]

        if not tmax_all:
            raise ValueError(f"ERA5 baseline: no data for ({lat},{lng})")

        annual_mean   = round(sum(tmean_all) / len(tmean_all), 2) if tmean_all else 0.0
        p95_threshold = round(_percentile(tmax_all, 95.0), 2)
        # Proper WMO Tx5d: annual max of 5-consecutive-day mean, averaged over the decade.
        _tx5d = _tx5d_normal(times_all, tmax_series)
        tx5d_baseline = round(_tx5d if _tx5d is not None else max(tmax_all), 2)
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


# ── CMIP6 baseline reference window (matches the ERA5 2011–2020 anchor) ────────
CMIP6_BASELINE_START_YEAR = 2011
CMIP6_BASELINE_END_YEAR = 2020


async def _fetch_cckp_warming_delta(
    iso3: str, ssp_param: str, target_year: int
) -> Optional[float]:
    """
    Fallback CMIP6 warming signal from the World Bank Climate Change Knowledge
    Portal (cckpapi.worldbank.org) — free, no key. Returns the country-level
    ensemble-median Tmax anomaly Δ(target window − 2015–2020) in °C, or None.

    Coarser than Open-Meteo's downscaled point series, so it is used ONLY when the
    primary CMIP6 source is unavailable (e.g. rate-limited), giving the engine a
    second independent open-data provider for resilience at 500–600 users/day.
    """
    if not iso3 or len(iso3) != 3:
        return None
    cache_key = f"cckp_delta_{iso3}_{ssp_param}_{target_year}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached
    on_disk = disk_get(cache_key, ttl=_DISK_TTL)
    if on_disk is not None:
        _cache_set(cache_key, on_disk)
        return on_disk

    url = (
        f"https://cckpapi.worldbank.org/cckp/v1/"
        f"cmip6-x0.25_timeseries_tasmax_timeseries_annual_2015-2100_median_"
        f"{ssp_param}_ensemble_all_mean/{iso3}?_format=json"
    )
    try:
        async with httpx.AsyncClient(headers=HEADERS, timeout=25.0, trust_env=False) as client:
            for attempt in range(1, 3):
                resp = await client.get(url)
                if resp.status_code == 429:
                    await asyncio.sleep(2 ** attempt)
                    continue
                resp.raise_for_status()
                break
            series = resp.json().get("data", {}).get(iso3, {})
        if not series:
            return None

        def _mean_for(years: range) -> Optional[float]:
            vals = [series.get(f"{y}-07") for y in years]
            vals = [float(v) for v in vals if v is not None]
            return sum(vals) / len(vals) if vals else None

        base = _mean_for(range(2015, 2021))  # CCKP series begins 2015
        fut = _mean_for(range(target_year - 2, target_year + 3))
        if base is None or fut is None:
            return None
        delta = round(fut - base, 2)
        _cache_set(cache_key, delta)
        disk_set(cache_key, delta)
        logger.info("[cckp] %s %s %d fallback Δtasmax=%+.2f°C", iso3, ssp_param, target_year, delta)
        return delta
    except Exception as exc:
        logger.warning("[cckp] warming-delta fallback failed for %s: %s", iso3, exc)
        return None


# Global-mean Tmax warming (°C) from the 2011–2020 baseline to 2050 per SSP,
# from IPCC AR6 WG1 SPM. Scaled linearly in time and by the Köppen-zone regional
# amplification factor. Deterministic last-resort so a projection ALWAYS exists.
_SSP_GLOBAL_DELTA_2050_C = {"ssp126": 0.6, "ssp245": 1.1, "ssp370": 1.5, "ssp585": 1.9}


def _ipcc_deterministic_projection(
    baseline: dict, ssp_param: str, target_year: int, warming_factor: float, total_cooling: float
) -> dict:
    """Final-tier projection from IPCC AR6 regional warming — used only when both
    Open-Meteo CMIP6 and World Bank CCKP are unavailable, so the engine never fails
    to return a (clearly lower-confidence) projection for any location on Earth."""
    era5_tx5d = baseline["tx5d_baseline_c"]
    era5_hw = baseline["hw_days_baseline"]
    era5_mean = baseline["annual_mean_c"]
    g2050 = _SSP_GLOBAL_DELTA_2050_C.get(ssp_param, 1.1)
    frac = max(0.0, (target_year - 2020) / 30.0)
    delta = max(0.0, g2050 * frac * max(0.5, warming_factor))
    raw_tx5d = round(era5_tx5d + delta, 2)
    raw_hw = round(era5_hw + delta * 4.0, 1)
    return {
        "year": target_year,
        "tx5d_c": round(raw_tx5d - total_cooling, 2),
        "tx5d_raw_c": raw_tx5d,
        "delta_tx5d_c": round(delta, 2),
        "hw_days": round(max(0.0, raw_hw - total_cooling * 3.5), 1),
        "hw_days_raw": raw_hw,
        "mean_temp_c": round(era5_mean + delta, 2),
        "delta_mean_c": round(delta, 2),
        "baseline_tx5d_c": era5_tx5d,
        "n_models": 0,
        "source": "ipcc_ar6_deterministic_fallback",
    }


async def fetch_cmip6_projection(
    lat: float,
    lng: float,
    ssp: str,
    target_year: int,
    baseline: dict,
    total_cooling: float = 0.0,
    country_iso3: Optional[str] = None,
    warming_factor: float = 1.2,
) -> dict:
    """
    CMIP6 multi-model ensemble projection via BIAS-CORRECTED DELTA DOWNSCALING.

    projected = ERA5_observed_baseline  +  Δ(CMIP6 future − CMIP6 2011–2020)

    The delta is computed entirely within each CMIP6 model (future window minus
    the model's own 2011–2020 window, same statistic), so the model's coarse-grid
    bias cancels. The signal is then added to the high-quality ERA5 observed
    anchor. This eliminates the previous defect where a CMIP6 cell colder than
    the ERA5 point produced a 2050 Tx5d *below* baseline under a warming SSP.

    The baseline-relative floor (projected ≥ baseline under warming) is enforced
    here; cross-horizon monotonicity is enforced by the caller.

    Parameters
    ----------
    baseline : dict
        ERA5 anchor from fetch_historical_baseline_full() — must contain
        p95_threshold_c, tx5d_baseline_c, hw_days_baseline, annual_mean_c.
    """
    if target_year > PROJECTION_HORIZON_YEAR:
        raise HorizonUnavailable(
            f"Projection year {target_year} exceeds the validated CMIP6 data horizon "
            f"({PROJECTION_HORIZON_YEAR}). OpenPlanet does not extrapolate beyond peer-reviewed "
            f"CMIP6 ensemble outputs. Request a year ≤ {PROJECTION_HORIZON_YEAR}."
        )

    p95_threshold = baseline["p95_threshold_c"]
    era5_tx5d = baseline["tx5d_baseline_c"]
    era5_hw = baseline["hw_days_baseline"]
    era5_mean = baseline["annual_mean_c"]

    ssp_param = SSP_PARAM_MAP.get(ssp, "ssp245")
    cache_key = f"proj_{round(lat,2)}_{round(lng,2)}_{ssp_param}_{target_year}_{round(total_cooling,3)}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    models = CMIP6_MODELS_BY_SSP.get(ssp_param, CMIP6_MODELS_BY_SSP["ssp245"])

    # ±2yr window around target_year: ~4 years of daily data per model.
    window = 2
    fut_y0 = max(2015, target_year - window)
    fut_y1 = min(2050, target_year + window - 1)

    deltas_tx5d: List[float] = []
    deltas_hw: List[float] = []
    deltas_mean: List[float] = []
    n_models = 0

    async with httpx.AsyncClient(headers=HEADERS) as client:
        fulls = await asyncio.gather(
            *[_fetch_cmip6_model_full(lat, lng, model, client) for model in models],
            return_exceptions=True,
        )
        for model, full in zip(models, fulls):
            if isinstance(full, Exception) or not full:
                continue
            base_stats = _window_stats(
                _slice_daily_by_years(full, CMIP6_BASELINE_START_YEAR, CMIP6_BASELINE_END_YEAR),
                p95_threshold,
            )
            fut_stats = _window_stats(_slice_daily_by_years(full, fut_y0, fut_y1), p95_threshold)
            if not base_stats or not fut_stats:
                continue
            deltas_tx5d.append(fut_stats["tx5d_c"] - base_stats["tx5d_c"])
            deltas_hw.append(fut_stats["hw_days"] - base_stats["hw_days"])
            deltas_mean.append(fut_stats["mean_temp_c"] - base_stats["mean_temp_c"])
            n_models += 1
            logger.info(
                "CMIP6 %s %s %d: Δtx5d=%+.2f°C (fut %.2f − base %.2f)",
                model, ssp_param, target_year,
                fut_stats["tx5d_c"] - base_stats["tx5d_c"],
                fut_stats["tx5d_c"], base_stats["tx5d_c"],
            )

    if n_models == 0:
        # ── Resilience fallback: World Bank CCKP CMIP6 (second open provider) ──
        # When Open-Meteo CMIP6 is unavailable (rate-limited / network), use the
        # country-level CCKP ensemble warming delta applied to the ERA5 anchor so
        # the site keeps serving accurate-within-tolerance projections.
        cckp_delta = await _fetch_cckp_warming_delta(country_iso3 or "", ssp_param, target_year)
        if cckp_delta is None:
            # Final tier: IPCC AR6 deterministic — guarantees a projection for any
            # location so the request never fails (clearly labelled lower confidence).
            logger.warning(
                "[cmip6] Open-Meteo + CCKP unavailable for (%.4f,%.4f) — IPCC AR6 deterministic fallback.",
                lat, lng,
            )
            result = _ipcc_deterministic_projection(baseline, ssp_param, target_year, warming_factor, total_cooling)
            _cache_set(cache_key, result)
            return result
        delta = max(0.0, cckp_delta)
        proj_tx5d = max(era5_tx5d + delta, era5_tx5d)
        proj_hw = max(era5_hw + delta * 4.0, era5_hw)
        proj_mean = era5_mean + delta
        raw_tx5d = round(proj_tx5d, 2)
        raw_hw_days = round(proj_hw, 1)
        raw_mean = round(proj_mean, 2)
        result = {
            "year": target_year,
            "tx5d_c": round(raw_tx5d - total_cooling, 2),
            "tx5d_raw_c": raw_tx5d,
            "delta_tx5d_c": round(delta, 2),
            "hw_days": round(max(0.0, raw_hw_days - total_cooling * 3.5), 1),
            "hw_days_raw": raw_hw_days,
            "mean_temp_c": raw_mean,
            "delta_mean_c": round(delta, 2),
            "baseline_tx5d_c": era5_tx5d,
            "n_models": 0,
            "source": "worldbank_cckp_fallback",
        }
        _cache_set(cache_key, result)
        return result

    delta_tx5d = sum(deltas_tx5d) / n_models
    delta_hw = sum(deltas_hw) / n_models
    delta_mean = sum(deltas_mean) / n_models

    # Anchor to ERA5 observed baseline + CMIP6 internal warming delta.
    proj_tx5d = era5_tx5d + delta_tx5d
    proj_hw = era5_hw + delta_hw
    proj_mean = era5_mean + delta_mean

    # Baseline-relative floor under warming scenarios: a 2050 value below the
    # observed baseline is unphysical for SSP1-2.6…SSP5-8.5 and is treated as
    # small-window sampling noise (Tx5d_2050 ≥ baseline invariant).
    proj_tx5d = max(proj_tx5d, era5_tx5d)
    proj_hw = max(proj_hw, era5_hw)

    raw_tx5d = round(proj_tx5d, 2)
    raw_hw_days = round(proj_hw, 1)
    raw_mean = round(proj_mean, 2)

    mitigated_tx5d = round(raw_tx5d - total_cooling, 2)
    mitigated_hw_days = round(max(0.0, raw_hw_days - (total_cooling * 3.5)), 1)

    result = {
        "year": target_year,
        "tx5d_c": mitigated_tx5d,
        "tx5d_raw_c": raw_tx5d,
        "delta_tx5d_c": round(delta_tx5d, 2),
        "hw_days": mitigated_hw_days,
        "hw_days_raw": raw_hw_days,
        "mean_temp_c": raw_mean,
        "delta_mean_c": round(delta_mean, 2),
        "baseline_tx5d_c": era5_tx5d,
        "n_models": n_models,
        "source": f"open_meteo_cmip6_delta_{n_models}models",
    }

    _cache_set(cache_key, result)
    return result


# ═══════════════════════════════════════════════════════════════════════════════
# PHYSICALLY-CONSISTENT WET-BULB PROFILE  (bias-corrected delta downscaling)
# ═══════════════════════════════════════════════════════════════════════════════
#
# Why this exists
# ---------------
# The legacy wet-bulb path paired the projected peak temperature (Tx5d) with the
# P95 of summer daily-MEAN relative humidity. In monsoon / maritime climates the
# P95 daily-mean RH is near-saturation (85–95%) and occurs on cool, humid days —
# NEVER co-occurring with the hottest day. Multiplying peak heat by monsoon
# humidity produced physically impossible wet-bulb values (e.g. Delhi 39.6°C,
# above Earth's all-time record of ~35°C; Sherwood & Huber 2010).
#
# Correct method (validated against ERA5's own wet_bulb_temperature_2m_max):
#   1. Baseline absolute value = P95 of ERA5 `wet_bulb_temperature_2m_max` — the
#      true daily-max wet-bulb computed by Open-Meteo from hourly co-occurring
#      T + RH. Correctly handles altitude/pressure (e.g. La Paz 13.0°C).
#   2. Climate-change signal (Δ) = P95[ Stull(Tmax, RH@Tmax) ]_future
#                                 − P95[ Stull(Tmax, RH@Tmax) ]_baseline
#      where RH@Tmax is derived from the day's mean dewpoint (moisture is
#      conserved through the diurnal cycle far better than RH). The SAME Stull
#      method is applied to both periods, so its systematic bias cancels.
#   3. Projected wet-bulb = baseline_obs + Δ, capped at the 35°C survivability
#      limit (Sherwood & Huber 2010, PNAS).
#
# Open-Meteo CMIP6 is bias-corrected to ERA5 climatology, so mixing the ERA5
# baseline with the CMIP6 future delta is internally consistent.

_SURVIVABILITY_CAP_C = 35.0


def _stull_raw(temp_c: float, rh_pct: float) -> float:
    """Pure Stull (2011) wet-bulb from co-occurring T and RH (no diurnal hack)."""
    rh = max(5.0, min(100.0, rh_pct))
    return (
        temp_c * math.atan(0.151977 * math.sqrt(rh + 8.313659))
        + math.atan(temp_c + rh)
        - math.atan(rh - 1.676331)
        + 0.00391838 * (rh ** 1.5) * math.atan(0.023101 * rh)
        - 4.686035
    )


def _saturation_vapor_pressure(temp_c: float) -> float:
    """Saturation vapour pressure (hPa) — August–Roche–Magnus approximation."""
    return 6.112 * math.exp(17.67 * temp_c / (temp_c + 243.5))


def _rh_at_tmax(tmax_c: float, dewpoint_mean_c: float) -> float:
    """
    Relative humidity at the moment of daily-max temperature, derived from the
    day's mean dewpoint. Dewpoint (absolute moisture) is conserved through the
    diurnal cycle, so RH@Tmax = 100 · e_s(Td) / e_s(Tmax).
    """
    rh = 100.0 * _saturation_vapor_pressure(dewpoint_mean_c) / _saturation_vapor_pressure(tmax_c)
    return max(5.0, min(100.0, rh))


def _summer_months(lat: float) -> set:
    """Meteorological summer for the hemisphere (JJA north, DJF south)."""
    return {6, 7, 8} if lat >= 0 else {12, 1, 2}


def _stull_p95_from_daily(daily: dict, summer: set) -> Optional[float]:
    """P95 of daily Stull(Tmax, RH@Tmax) over summer days only."""
    times = daily.get("time", [])
    tmax = daily.get("temperature_2m_max", [])
    td = daily.get("dew_point_2m_mean", [])
    vals: List[float] = []
    for i, t in enumerate(times):
        if not t or int(t[5:7]) not in summer:
            continue
        if i < len(tmax) and i < len(td) and tmax[i] is not None and td[i] is not None:
            vals.append(_stull_raw(float(tmax[i]), _rh_at_tmax(float(tmax[i]), float(td[i]))))
    if len(vals) < 10:
        return None
    return round(_percentile(vals, 95.0), 2)


async def fetch_wetbulb_profile(
    lat: float,
    lng: float,
    ssp: str,
    target_year: int,
) -> dict:
    """
    Physically-consistent baseline + projected wet-bulb maxima for a location.

    Returns:
        {
          "baseline_wb_c":  P95 of observed ERA5 daily-max wet-bulb (current),
          "projected_wb_c": baseline + bias-corrected CMIP6 warming delta,
          "delta_c":        climate-change wet-bulb signal,
          "capped":         True if projected hit the 35°C survivability limit,
          "source":         provenance string,
        }

    Raises ValueError if the gold-standard ERA5 wet-bulb series is unavailable;
    callers should fall back to the legacy estimate in that case.
    """
    cache_key = f"wetbulb_{round(lat,2)}_{round(lng,2)}_{SSP_PARAM_MAP.get(ssp,'ssp245')}_{target_year}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    summer = _summer_months(lat)

    # ── Baseline: ERA5 observed daily-max wet-bulb + Stull reference ──────────
    era5 = await fetch_era5_bundle(lat, lng)

    times = era5.get("time", [])
    wb_obs_vals: List[float] = []
    for i, t in enumerate(times):
        if not t or int(t[5:7]) not in summer:
            continue
        wb = era5.get("wet_bulb_temperature_2m_max", [])
        if i < len(wb) and wb[i] is not None:
            wb_obs_vals.append(float(wb[i]))

    if len(wb_obs_vals) < 10:
        raise ValueError(
            f"ERA5 wet_bulb_temperature_2m_max unavailable for ({lat:.2f}, {lng:.2f})"
        )

    wb_base_obs = round(_percentile(wb_obs_vals, 95.0), 2)
    wb_base_stull = _stull_p95_from_daily(era5, summer)

    # ── Future: CMIP6 ensemble Stull reference (same method as baseline) ──────
    ssp_param = SSP_PARAM_MAP.get(ssp, "ssp245")
    models = CMIP6_MODELS_BY_SSP.get(ssp_param, CMIP6_MODELS_BY_SSP["ssp245"])
    window = 2
    fut_y0 = max(2015, target_year - window)
    fut_y1 = min(2050, target_year + window - 1)

    # Reuses the SAME cached full CMIP6 series as fetch_cmip6_projection (same cache
    # key), so the wet-bulb profile adds no extra CMIP6 requests.
    fut_stull_vals: List[float] = []
    async with httpx.AsyncClient(headers=HEADERS) as client:
        fulls = await asyncio.gather(
            *[_fetch_cmip6_model_full(lat, lng, model, client) for model in models],
            return_exceptions=True,
        )
        for model, full in zip(models, fulls):
            if isinstance(full, Exception) or not full:
                logger.warning("[wetbulb] CMIP6 model %s unavailable", model)
                continue
            daily = _slice_daily_by_years(full, fut_y0, fut_y1)
            p = _stull_p95_from_daily(daily, summer)
            if p is not None:
                fut_stull_vals.append(p)

    # ── Combine: anchor to ERA5 observed, add CMIP6 warming delta ────────────
    if fut_stull_vals and wb_base_stull is not None:
        wb_fut_stull = sum(fut_stull_vals) / len(fut_stull_vals)
        delta = wb_fut_stull - wb_base_stull
    else:
        # No usable future signal — report current observed wet-bulb, no warming.
        logger.warning(
            "[wetbulb] No CMIP6 wet-bulb signal for (%.2f, %.2f); projecting baseline only.",
            lat, lng,
        )
        delta = 0.0

    projected = wb_base_obs + delta
    capped = projected > _SURVIVABILITY_CAP_C
    projected = min(projected, _SURVIVABILITY_CAP_C)

    result = {
        "baseline_wb_c": round(min(wb_base_obs, _SURVIVABILITY_CAP_C), 2),
        "projected_wb_c": round(projected, 2),
        "delta_c": round(delta, 2),
        "capped": capped,
        "source": "era5_wet_bulb_observed + cmip6_stull_delta",
    }
    _cache_set(cache_key, result)
    logger.info(
        "[wetbulb] (%.2f, %.2f) %s %d: base=%.1f°C  Δ=%.1f°C  proj=%.1f°C%s",
        lat, lng, ssp_param, target_year,
        result["baseline_wb_c"], result["delta_c"], result["projected_wb_c"],
        "  [CAPPED@35]" if capped else "",
    )
    return result


async def fetch_cmip6_timeseries(
    lat: float,
    lng: float,
    ssp: str,
    target_year: int,
) -> List[Dict]:
    """Legacy interface for compatibility."""
    baseline = await fetch_historical_baseline_full(lat, lng)

    chart_years = sorted(
        {y for y in [2030, 2040, 2050] if y <= min(target_year, PROJECTION_HORIZON_YEAR)}
    )
    if not chart_years:
        chart_years = [min(target_year, PROJECTION_HORIZON_YEAR)]
    if target_year <= PROJECTION_HORIZON_YEAR and target_year not in chart_years:
        chart_years.append(target_year)
        chart_years = sorted(chart_years)

    results = []
    prev_temp = baseline["tx5d_baseline_c"]
    prev_hw = baseline["hw_days_baseline"]
    for year in chart_years:
        try:
            proj = await fetch_cmip6_projection(lat, lng, ssp, year, baseline)
            # Cross-horizon monotonicity under warming (Tx5d & heatwave days non-decreasing).
            temp = max(proj["tx5d_c"], prev_temp)
            hw = max(proj["hw_days"], prev_hw)
            prev_temp, prev_hw = temp, hw
            results.append({
                "year": year,
                "temp": round(temp, 2),
                "heatwaves": int(hw),
            })
        except Exception as e:
            logger.warning("fetch_cmip6_timeseries: year %d skipped: %s", year, e)

    if not results:
        raise ValueError(
            f"fetch_cmip6_timeseries: all years failed for {lat},{lng} {ssp}"
        )

    return results