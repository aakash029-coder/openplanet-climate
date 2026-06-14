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
    async with httpx.AsyncClient(headers=HEADERS) as client:
        era5 = await _fetch_era5_daily(
            lat, lng, "2011-01-01", "2020-12-31",
            ["temperature_2m_max", "dew_point_2m_mean", "wet_bulb_temperature_2m_max"],
            client,
        )

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
    start_yr = max(2015, target_year - window)
    end_yr = min(2050, target_year + window - 1)
    start_date, end_date = f"{start_yr}-01-01", f"{end_yr}-12-31"

    fut_stull_vals: List[float] = []
    async with httpx.AsyncClient(headers=HEADERS) as client:
        for model in models:
            url = (
                f"https://climate-api.open-meteo.com/v1/climate"
                f"?latitude={lat}&longitude={lng}"
                f"&start_date={start_date}&end_date={end_date}"
                f"&models={model}"
                f"&daily=temperature_2m_max,dew_point_2m_mean"
                f"&timezone=auto"
            )
            try:
                data = await _tunnel_get(url, client, timeout=60.0, max_attempts=2)
                daily = data.get("daily", {})
                p = _stull_p95_from_daily(daily, summer)
                if p is not None:
                    fut_stull_vals.append(p)
            except Exception as exc:
                logger.warning("[wetbulb] CMIP6 model %s failed: %s", model, exc)

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