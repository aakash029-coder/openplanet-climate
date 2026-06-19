"""
tests/_engine_probe.py — Run the real OpenPlanet engine for one city and return a
flat dict of every validated output field.

This mirrors the climate_engine.api.routers.predict pipeline (minus the LLM
narrative and H3 hex grid, which are not accuracy-validated), including the
cross-horizon monotonicity enforcement, so the harness validates exactly what
the API serves. Used both to generate the committed fixture and, under live
mode, to re-validate against live APIs.
"""
from __future__ import annotations

import math
from typing import Iterable

import httpx

from climate_engine.services.socioeconomic import geocode_city, fetch_live_socioeconomics
from climate_engine.services.cmip6_service import (
    fetch_historical_baseline_full,
    fetch_cmip6_projection,
    fetch_wetbulb_profile,
)
from climate_engine.api.physics.koppen import classify_koppen_live
from climate_engine.services.socioeconomic.worldbank import iso2_to_iso3


def _finite(x) -> bool:
    return isinstance(x, (int, float)) and math.isfinite(x)


async def compute_city(
    query: str,
    ssp: str = "ssp245",
    years: Iterable[int] = (2030, 2050),
) -> dict:
    """Compute the full engine output for one city query. Network-dependent."""
    years = sorted(years)

    async with httpx.AsyncClient(trust_env=False, timeout=45.0) as client:
        geo = await geocode_city(query, client)
    lat, lng = geo.latitude, geo.longitude

    # Baseline first so the shared ERA5 bundle is fetched/cached, then Köppen
    # reuses it (authoritative) — and degrades, never raises, if it is throttled.
    baseline = await fetch_historical_baseline_full(lat, lng)
    koppen = await classify_koppen_live(
        lat, lng,
        ann_mean_c=baseline["annual_mean_c"],
        rh_p95=70.0,  # nominal; only used by the heuristic fallback path
        p95_temp_c=baseline["p95_threshold_c"],
    )
    iso3 = iso2_to_iso3(geo.country_code) if geo.country_code else None
    warming_factor = koppen["macro"].ipcc_warming_rate_factor

    # Projections with the same baseline-floor + cross-horizon monotonicity the
    # API enforces.
    projections: dict[int, dict] = {}
    prev_tx5d = baseline["tx5d_baseline_c"]
    prev_hw = baseline["hw_days_baseline"]
    for y in years:
        p = await fetch_cmip6_projection(
            lat, lng, ssp, y, baseline, country_iso3=iso3, warming_factor=warming_factor
        )
        tx = max(p["tx5d_c"], prev_tx5d)
        hw = max(p["hw_days"], prev_hw)
        prev_tx5d, prev_hw = tx, hw
        projections[y] = {
            "tx5d_c": round(tx, 2),
            "hw_days": round(hw, 1),
            "delta_tx5d_c": p.get("delta_tx5d_c"),
            "n_models": p.get("n_models"),
        }

    dry_final = projections[years[-1]]["tx5d_c"]
    try:
        wb = await fetch_wetbulb_profile(lat, lng, ssp, years[-1])
        wbt_proj = min(wb["projected_wb_c"], dry_final)
    except Exception:
        # Mirror predict.py: degrade rather than fail if the ERA5 wet-bulb series
        # is unavailable (throttle). Conservative Stull estimate, ≤ dry-bulb / 35 °C.
        from climate_engine.api.physics.wetbulb import stull_wetbulb_simple
        wb = {
            "baseline_wb_c": None,
            "projected_wb_c": min(stull_wetbulb_simple(dry_final, 50.0), dry_final, 35.0),
            "capped": False,
            "source": "stull_fallback_no_era5",
        }
        wbt_proj = wb["projected_wb_c"]

    socio = await fetch_live_socioeconomics(query)

    return {
        "query": query,
        "ssp": ssp,
        "lat": round(lat, 4),
        "lng": round(lng, 4),
        "elevation_m": geo.elevation,
        "elevation_source": geo.elevation_source,
        "country_code": socio.get("country_code") or geo.country_code,
        "koppen_code": koppen["koppen_code"],
        "koppen_main": koppen["koppen_code"][0] if koppen["koppen_code"] else "",
        "koppen_source": koppen["source"],
        "baseline_annual_mean_c": baseline["annual_mean_c"],
        "baseline_p95_c": baseline["p95_threshold_c"],
        "baseline_tx5d_c": baseline["tx5d_baseline_c"],
        "baseline_hw_days": baseline["hw_days_baseline"],
        "projections": {str(y): projections[y] for y in years},
        "wbt_proj_c": round(wbt_proj, 2),
        "wbt_baseline_c": wb["baseline_wb_c"],
        "wbt_capped": wb["capped"],
        "population": socio["population"],
        "metro_gdp_usd": socio["city_gdp_usd"],
        "national_gdp_usd": socio.get("national_gdp_usd"),
        "gdp_per_capita_usd": socio.get("gdp_per_capita"),
        "gdp_basis": socio.get("gdp_basis"),
        "gdp_capped_at_national": socio.get("gdp_capped_at_national"),
    }
