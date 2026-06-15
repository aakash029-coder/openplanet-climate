"""
climate_engine/api/routers/climate.py — /api/climate-risk endpoint.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from fastapi import HTTPException, Request, Response, status
from fastapi.routing import APIRouter

from climate_engine.api.security import get_rate_limit_string, limiter
from climate_engine.api.schemas import ClimateRiskRequest
from climate_engine.services.cmip6_service import (
    fetch_historical_baseline_full,
    fetch_cmip6_projection,
    fetch_wetbulb_profile,
)
from climate_engine.services.socioeconomic_service import fetch_live_socioeconomics
from climate_engine.api.physics import (
    ZoneClassification,
    detect_climate_archetype,
    _fetch_era5_humidity_p95,
    WetBulbResult,
    _stull_wetbulb,
    _fetch_worldbank_death_rate,
    _gasparrini_mortality,
    mortality_confidence_level,
    compute_hybrid_economic_loss,
    _build_audit_trail,
)
from climate_engine.api._helpers import (
    _data_unavailable,
    _normalize_ssp,
    _is_high_emission,
    _iso2_to_iso3,
    _generate_hex_grid_data,
)

logger = logging.getLogger(__name__)

router = APIRouter()
_rate_limit = get_rate_limit_string()


@router.post("/api/climate-risk", tags=["Simulation"])
@limiter.limit(_rate_limit)
async def climate_risk(request: Request, req: ClimateRiskRequest, response: Response):
    total_cooling = (
        (req.canopy_offset_pct / 100.0 * 1.2)
        + (req.albedo_offset_pct / 100.0 * 0.8)
    )

    ssp_code = _normalize_ssp(req.ssp)
    extreme = _is_high_emission(ssp_code)
    logger.info(
        "[climate-risk] lat=%.4f  lng=%.4f  ssp_raw=%r  ssp_code=%r  "
        "extreme=%s  canopy=%d%%  albedo=%d%%  hint=%r",
        req.lat,
        req.lng,
        req.ssp,
        ssp_code,
        extreme,
        req.canopy_offset_pct,
        req.albedo_offset_pct,
        req.location_hint,
    )

    # ── Baseline ──────────────────────────────────────────────────────────────
    try:
        baseline = await fetch_historical_baseline_full(req.lat, req.lng)
    except Exception as exc:
        raise _data_unavailable(
            f"ERA5 historical baseline unavailable for "
            f"({req.lat:.2f}, {req.lng:.2f}): {exc}"
        )

    p95 = baseline["p95_threshold_c"]
    ann_mean = baseline["annual_mean_c"]
    tx5d_baseline = baseline["tx5d_baseline_c"]

    # ── Socioeconomics ────────────────────────────────────────────────────────
    location_query = req.location_hint.strip()
    if not location_query.split(",")[0].strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="location_hint must contain at least a city name.",
        )

    try:
        socio = await fetch_live_socioeconomics(location_query)
    except Exception as exc:
        raise _data_unavailable(
            f"Socioeconomic data unavailable for '{location_query}': {exc}"
        )

    pop = socio["population"]
    gdp = socio["city_gdp_usd"]
    iso2 = socio.get("country_code", "UN")
    iso3 = _iso2_to_iso3(iso2)
    vuln = socio.get("vulnerability_multiplier", 1.0)

    # ── External data (parallel) ──────────────────────────────────────────────
    try:
        death_rate, rh_p95 = await asyncio.gather(
            _fetch_worldbank_death_rate(iso3),
            _fetch_era5_humidity_p95(req.lat, req.lng),
        )
    except Exception as exc:
        raise _data_unavailable(
            f"World Bank death rate / ERA5 humidity fetch failed: {exc}"
        )

    # ── CMIP6 base projections ────────────────────────────────────────────────
    res_2030, res_2050 = await asyncio.gather(
        fetch_cmip6_projection(
            req.lat, req.lng, ssp_code, 2030, p95, total_cooling
        ),
        fetch_cmip6_projection(
            req.lat, req.lng, ssp_code, 2050, p95, total_cooling
        ),
        return_exceptions=True,
    )

    base_projs: dict = {}
    if not isinstance(res_2030, Exception):
        base_projs[2030] = res_2030
    else:
        logger.warning("[climate-risk] CMIP6 2030 failed: %s", res_2030)

    if not isinstance(res_2050, Exception):
        base_projs[2050] = res_2050
    else:
        logger.warning("[climate-risk] CMIP6 2050 failed: %s", res_2050)

    if not base_projs:
        raise _data_unavailable(
            f"CMIP6 projections unavailable for ({req.lat:.2f}, {req.lng:.2f}) "
            f"under scenario {req.ssp} (normalised: {ssp_code})."
        )

    # ── Per-decade projections (zone-aware) ───────────────────────────────────
    projection_records: list = []
    wbt = 20.0
    tx5d = p95

    for year in [2030, 2050]:
        try:
            if year not in base_projs:
                raise ValueError(f"CMIP6 data for {year} unavailable.")
            proj = base_projs[year]

            tx5d = proj["tx5d_c"]
            hw_days = proj["hw_days"]
            mean_temp = proj["mean_temp_c"]
            temp_excess = max(0.0, tx5d - p95)

            wb_profile_yr: Optional[dict] = None
            try:
                wb_profile_yr = await fetch_wetbulb_profile(req.lat, req.lng, ssp_code, year)
            except Exception as exc:
                logger.warning("[climate-risk] Physical wet-bulb unavailable for %d (%s)", year, exc)
            true_wbt_yr = wb_profile_yr["projected_wb_c"] if wb_profile_yr else None

            zone_obj: ZoneClassification = detect_climate_archetype(
                mean_temp=mean_temp,
                p95_rh=rh_p95,
                tx5d=tx5d,
                true_wbt=true_wbt_yr,
            )

            deaths = _gasparrini_mortality(
                pop=pop,
                baseline_death_rate_per1000=death_rate,
                temp_excess_c=temp_excess,
                hw_days=hw_days,
                vulnerability_multiplier=vuln,
            )

            econ_loss = compute_hybrid_economic_loss(
                city_gdp=gdp,
                t_mean=mean_temp,
                tx5d=tx5d,
                hw_days=hw_days,
            )

            cdd = round(max(0.0, mean_temp - 18.0) * hw_days, 1)

            wbt_result: WetBulbResult = _stull_wetbulb(
                temp_c=tx5d,
                rh_pct=rh_p95,
                zone=zone_obj.zone,
            )
            wbt = true_wbt_yr if true_wbt_yr is not None else wbt_result.wbt_celsius

            audit = _build_audit_trail(
                pop=pop,
                death_rate=death_rate,
                hw_days=hw_days,
                temp_excess=temp_excess,
                vuln=vuln,
                gdp=gdp,
                mean_temp=mean_temp,
                tx5d=tx5d,
                rh=rh_p95,
                zone=zone_obj,
                true_wbt=true_wbt_yr,
            )

            if wbt >= 31:
                survivability_status = "CRITICAL"
            elif wbt >= 28:
                survivability_status = "DANGER"
            else:
                survivability_status = "STABLE"

            projection_records.append({
                "year": year,
                "source": proj["source"],
                "heatwave_days": int(hw_days),
                "peak_tx5d_c": round(tx5d, 2),
                "mean_temp_c": round(mean_temp, 2),
                "attributable_deaths": deaths,
                "economic_decay_usd": round(econ_loss, 2),
                "wbt_max_c": wbt,
                "grid_stress_factor": cdd,
                "survivability_status": survivability_status,
                "n_models": proj.get("n_models", 1),
                "climate_zone": zone_obj.zone.value,
                "zone_confidence": zone_obj.confidence,
                "zone_diagnostics": list(zone_obj.diagnostic_flags),
                "lethal_risk_flag": wbt_result.lethal_risk_flag,
                "methodology": "Hybrid Bipartite Model (Burke Baseline + ILO Extreme Shocks)",
                "audit_trail": audit,
            })

        except Exception as exc:
            logger.warning("[climate-risk] year=%d failed: %s", year, exc)

    if not projection_records:
        raise _data_unavailable(
            "All projection years failed — no valid CMIP6 data returned. "
            f"Location: ({req.lat:.2f}, {req.lng:.2f})  "
            f"SSP: {req.ssp} (code: {ssp_code})"
        )

    logger.info(
        "[climate-risk] Processed %d projections for city=%r",
        len(projection_records),
        location_query,
    )

    hex_grid_data, hex_coverage_method = await _generate_hex_grid_data(
        city_name=location_query,
        city_wbt=wbt,
        city_temp=tx5d,
        p95_rh=rh_p95,
        ann_mean=ann_mean,
        resolution=9,
    )

    any_fallback = (
        baseline.get("_lineage") == "statistical_fallback"
        or any("fallback" in str(r.get("source", "")) for r in projection_records)
    )

    cr_pop_source = socio.get("_geocoder_source", "geocoder")
    _avg_hw = (
        sum(r["heatwave_days"] for r in projection_records) / len(projection_records)
        if projection_records else 30.0
    )
    cr_mort_conf = mortality_confidence_level(_avg_hw, cr_pop_source)

    return {
        "threshold_c": p95,
        "tx5d_baseline_c": tx5d_baseline,
        "cooling_offset_c": round(total_cooling, 2),
        "gdp_usd": gdp,
        "population": pop,
        "projections": projection_records,
        "baseline": {"baseline_mean_c": ann_mean},
        "era5_humidity_p95": rh_p95,
        "hexGrid": hex_grid_data,
        "_data_confidence": {
            "peak_tx5d":     {"level": "high",   "source": "CMIP6 ensemble + ERA5 P95"},
            "wet_bulb":      {"level": "high",   "source": "Stull 2011 + ERA5 humidity"},
            "heatwave_days": {"level": "high",   "source": "CMIP6 ensemble + ERA5 P95",
                              "definition": "Days/year exceeding the 2011-2020 local 95th-percentile daily max temperature (extreme-heat days vs the city's own historical baseline), not absolute-threshold heatwaves."},
            "deaths":        cr_mort_conf,
            "economic_loss": {"level": "medium", "source": "Burke 2018 + ILO bipartite model",
                              "note": "Indicative directional estimate. +-8% CI."},
            "population":    {"level": "high" if cr_pop_source == "verified_city_vault" else "medium",
                              "source": cr_pop_source},
        },
        "metadata": {
            "data_lineage": "statistical_fallback" if any_fallback else "empirical_api",
            "coverage_method": hex_coverage_method,
        },
    }
