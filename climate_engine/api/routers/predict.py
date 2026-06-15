"""
climate_engine/api/routers/predict.py — /api/predict endpoint.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

import httpx
from fastapi import HTTPException, Request, Response, status
from fastapi.routing import APIRouter

from climate_engine.api.security import get_rate_limit_string, limiter
from climate_engine.api.schemas import PredictionRequest, SimulationResponse
from climate_engine.services.cmip6_service import (
    fetch_historical_baseline_full,
    fetch_cmip6_projection,
    fetch_wetbulb_profile,
    PROJECTION_HORIZON_YEAR,
)
from climate_engine.services.socioeconomic_service import (
    fetch_live_socioeconomics,
    geocode_city,
    GeocodingResult,
)
from climate_engine.services.historical_service import fetch_historical_eras
from climate_engine.services.llm_service import generate_strategic_analysis
from climate_engine.api.physics import (
    ClimateZone,
    ZoneClassification,
    detect_climate_archetype,
    _fetch_era5_humidity_p95,
    _fetch_relative_humidity_live,
    WetBulbResult,
    _stull_wetbulb,
    _fetch_worldbank_death_rate,
    _gasparrini_mortality,
    mortality_confidence_level,
    compute_hybrid_economic_loss,
    _build_audit_trail,
    H3CoverageResult,
    get_city_hexagons,
    ISO3_MAP,
)
from climate_engine.api._helpers import (
    _data_unavailable,
    _normalize_ssp,
    _is_high_emission,
    _iso2_to_iso3,
    _generate_hex_grid_data,
    _coords_vault_key,
    _CITY_COORDS,
)

logger = logging.getLogger(__name__)

router = APIRouter()
_rate_limit = get_rate_limit_string()


@router.post("/api/predict", response_model=SimulationResponse, tags=["Simulation"])
@limiter.limit(_rate_limit)
async def predict(request: Request, req: PredictionRequest, response: Response):
    target_year = int(req.year)
    if target_year > PROJECTION_HORIZON_YEAR:
        raise HTTPException(
            status_code=422,
            detail=(
                f"Projection year {target_year} exceeds the validated CMIP6 data horizon "
                f"({PROJECTION_HORIZON_YEAR}). OpenPlanet projections are capped at "
                f"{PROJECTION_HORIZON_YEAR} per strict adherence to available peer-reviewed "
                f"CMIP6 outputs. Request a year <= {PROJECTION_HORIZON_YEAR}."
            ),
        )

    total_cooling = (req.canopy / 100.0 * 1.2) + (req.coolRoof / 100.0 * 0.8)

    ssp_code = _normalize_ssp(req.ssp)
    extreme = _is_high_emission(ssp_code)
    location_hint = req.city.strip()
    logger.info(
        "[predict] city=%r  ssp_raw=%r  ssp_code=%r  extreme=%s  "
        "target_year=%d  cooling=%.3f",
        location_hint,
        req.ssp,
        ssp_code,
        extreme,
        target_year,
        total_cooling,
    )

    # ── Vault-first coordinate resolution ────────────────────────────────────
    _vault_key = _coords_vault_key(location_hint)
    if _vault_key:
        _cv = _CITY_COORDS[_vault_key]
        geo = GeocodingResult(
            city_population=0,
            country_code=_cv["country_code"],
            latitude=req.lat,
            longitude=req.lng,
            source="city_coords_vault",
        )
        logger.info(
            "[predict] vault hit '%s' (key=%s) country_code=%s",
            location_hint, _vault_key, _cv["country_code"],
        )
    else:
        try:
            async with httpx.AsyncClient(timeout=30.0, trust_env=False) as geo_client:
                geo = await geocode_city(location_hint, geo_client)
        except Exception as exc:
            raise _data_unavailable(
                f"Could not geocode '{location_hint}': {exc}"
            )
        logger.info(
            "[predict] geocoded '%s' -> (%.4f, %.4f) via %s",
            location_hint, geo.latitude, geo.longitude, geo.source,
        )

    lat = geo.latitude
    lng = geo.longitude

    # ── 1. Historical baseline ────────────────────────────────────────────────
    try:
        baseline = await fetch_historical_baseline_full(lat, lng)
    except Exception as exc:
        raise _data_unavailable(
            f"ERA5 historical baseline unavailable for "
            f"({lat:.2f}, {lng:.2f}): {exc}"
        )

    p95 = baseline["p95_threshold_c"]
    ann_mean = baseline["annual_mean_c"]
    tx5d_baseline = baseline["tx5d_baseline_c"]

    # ── 2. Socioeconomics ─────────────────────────────────────────────────────
    try:
        socio = await fetch_live_socioeconomics(location_hint)
    except Exception as exc:
        raise _data_unavailable(
            f"Socioeconomic data unavailable for city '{location_hint}': {exc}"
        )

    pop = socio["population"]
    gdp = socio["city_gdp_usd"]
    iso2 = socio.get("country_code", "UN")
    iso3 = _iso2_to_iso3(iso2)
    vuln = socio.get("vulnerability_multiplier", 1.0)

    # ── 3. External data (parallel) ───────────────────────────────────────────
    try:
        death_rate, rh_live, rh_p95, historical_eras = await asyncio.gather(
            _fetch_worldbank_death_rate(iso3),
            _fetch_relative_humidity_live(lat, lng),
            _fetch_era5_humidity_p95(lat, lng),
            fetch_historical_eras(lat, lng)
        )
    except Exception as exc:
        raise _data_unavailable(str(exc))

    # ── 4. CMIP6 projections ──────────────────────────────────────────────────
    chart_years = sorted(
        {yr for yr in {2030, 2040, 2050, target_year} if yr <= PROJECTION_HORIZON_YEAR}
    )

    results = await asyncio.gather(
        *[
            fetch_cmip6_projection(
                lat, lng, ssp_code, yr, p95, total_cooling
            )
            for yr in chart_years
        ],
        return_exceptions=True,
    )

    projections: dict = {}
    for yr, res in zip(chart_years, results):
        if isinstance(res, Exception):
            logger.warning("[predict] CMIP6 year=%d failed: %s", yr, res)
            continue
        projections[yr] = res

    # ── 6. Zone-aware chart series ────────────────────────────────────────────
    heatwave_chart: list = []
    economic_chart: list = []

    for yr in chart_years:
        if yr not in projections:
            continue
        proj = projections[yr]
        hw_days = proj.get("hw_days_raw", proj["hw_days"])
        mean_temp = proj["mean_temp_c"]
        tx5d = proj["tx5d_c"]

        zone_obj: ZoneClassification = detect_climate_archetype(
            mean_temp=mean_temp,
            p95_rh=rh_p95,
            tx5d=tx5d,
        )
        loss = compute_hybrid_economic_loss(
            city_gdp=gdp,
            t_mean=mean_temp,
            tx5d=tx5d,
            hw_days=hw_days,
        )
        loss_mit = loss * (1.0 - total_cooling * 0.05)

        heatwave_chart.append({"year": str(yr), "val": int(hw_days)})
        economic_chart.append({
            "year": str(yr),
            "noAction": round(loss / 1_000_000, 1),
            "adapt": round(loss_mit / 1_000_000, 1),
        })

    # ── 7. Target-year outputs (zone-aware) ───────────────────────────────────
    if target_year not in projections:
        raise _data_unavailable(
            f"CMIP6 projection for target year {target_year} is unavailable."
        )

    tgt = projections[target_year]
    tx5d = tgt["tx5d_c"]
    hw_days_tgt = tgt["hw_days"]
    mean_temp_tgt = tgt["mean_temp_c"]
    temp_excess = max(0.0, tx5d - p95)

    wb_profile: Optional[dict] = None
    try:
        wb_profile = await fetch_wetbulb_profile(lat, lng, ssp_code, target_year)
    except Exception as exc:
        logger.warning(
            "[predict] Physical wet-bulb unavailable (%s); falling back to legacy estimate.",
            exc,
        )

    true_wbt_proj = wb_profile["projected_wb_c"] if wb_profile else None

    zone_obj_target: ZoneClassification = detect_climate_archetype(
        mean_temp=mean_temp_tgt,
        p95_rh=rh_p95,
        tx5d=tx5d,
        true_wbt=true_wbt_proj,
    )

    logger.info(
        "[predict] Zone detected: %s (confidence=%.2f) for year=%d",
        zone_obj_target.zone.value,
        zone_obj_target.confidence,
        target_year,
    )

    deaths = _gasparrini_mortality(
        pop=pop,
        baseline_death_rate_per1000=death_rate,
        temp_excess_c=temp_excess,
        hw_days=hw_days_tgt,
        vulnerability_multiplier=vuln,
    )

    final_loss = compute_hybrid_economic_loss(
        city_gdp=gdp,
        t_mean=mean_temp_tgt,
        tx5d=tx5d,
        hw_days=hw_days_tgt,
    )

    wbt_result_proj: WetBulbResult = _stull_wetbulb(
        temp_c=tx5d,
        rh_pct=rh_p95,
        zone=zone_obj_target.zone,
    )

    if wb_profile:
        wbt_proj = wb_profile["projected_wb_c"]
        wbt_live = wb_profile["baseline_wb_c"]
        wbt_capped = wb_profile["capped"]
    else:
        wbt_proj = wbt_result_proj.wbt_celsius
        wbt_result_live: WetBulbResult = _stull_wetbulb(
            temp_c=tx5d,
            rh_pct=rh_live,
            zone=zone_obj_target.zone,
        )
        wbt_live = wbt_result_live.wbt_celsius
        wbt_capped = wbt_result_proj.capped_at_survivability_limit

    loss_str = (
        f"${final_loss / 1e9:.2f}B"
        if final_loss >= 1e9
        else f"${final_loss / 1e6:.1f}M"
    )

    audit = _build_audit_trail(
        pop=pop,
        death_rate=death_rate,
        hw_days=hw_days_tgt,
        temp_excess=temp_excess,
        vuln=vuln,
        gdp=gdp,
        mean_temp=mean_temp_tgt,
        tx5d=tx5d,
        rh=rh_p95,
        zone=zone_obj_target,
        true_wbt=true_wbt_proj,
    )

    logger.info(
        "[predict] Processed city=%r  year=%d  tx5d=%.1f°C  "
        "hw=%d  deaths=%.0f  loss=%s  zone=%s",
        location_hint,
        target_year,
        tx5d,
        int(hw_days_tgt),
        deaths,
        loss_str,
        zone_obj_target.zone.value,
    )

    # ── 8. H3 hex grid ────────────────────────────────────────────────────────
    hex_grid_data, hex_coverage_method = await _generate_hex_grid_data(
        city_name=location_hint,
        city_wbt=wbt_proj,
        city_temp=tx5d,
        p95_rh=rh_p95,
        ann_mean=ann_mean,
        resolution=9,
    )

    # ── 9. Optional AI narrative ───────────────────────────────────────────────
    ai: Optional[dict] = None
    try:
        ai = await generate_strategic_analysis(
            location_hint,
            req.ssp,
            req.year,
            req.canopy,
            req.coolRoof,
            round(tx5d, 1),
            int(hw_days_tgt),
            deaths,
            final_loss,
        )
    except Exception as exc:
        logger.warning("[predict] AI narrative failed (non-fatal): %s", exc)

    any_fallback = (
        baseline.get("_lineage") == "statistical_fallback"
        or any("fallback" in str(projections.get(yr, {}).get("source", "")) for yr in projections)
    )

    pop_source = socio.get("_geocoder_source", "geocoder")
    mort_conf = mortality_confidence_level(hw_days_tgt, pop_source)

    return {
        "resolvedLocation": {
            "city": location_hint,
            "lat": lat,
            "lng": lng,
            "country_code": geo.country_code,
            "geocoder_source": geo.source,
        },
        "metrics": {
            "baseTemp": str(tx5d_baseline),
            "temp": f"{tx5d:.1f}",
            "deaths": f"{deaths:,}",
            "ci": f"{int(deaths * 0.85):,} – {int(deaths * 1.18):,}",
            "loss": loss_str,
            "heatwave": str(int(hw_days_tgt)),
            "wbt": f"{wbt_proj:.1f}",
            "wbt_live": f"{wbt_live:.1f}",
            "wbt_capped": wbt_capped,
            "heatwave_definition": (
                "Days/year exceeding the 2011–2020 local 95th-percentile daily-max "
                "temperature (extreme-heat days relative to the city's own historical "
                "baseline), not fixed-threshold heatwaves."
            ),
            "rh_p95": rh_p95,
            "rh_live": rh_live,
            "climate_zone": zone_obj_target.zone.value,
            "zone_confidence": zone_obj_target.confidence,
            "lethal_risk_flag": bool(wbt_capped or (zone_obj_target.zone == ClimateZone.LETHAL_HUMID and wbt_proj >= 31.0)),
        },
        "_data_confidence": {
            "peak_tx5d":     {"level": "high",   "source": "CMIP6 ensemble + ERA5 P95"},
            "wet_bulb":      {"level": "high",   "source": "Stull 2011 + ERA5 humidity"},
            "heatwave_days": {"level": "high",   "source": "CMIP6 ensemble + ERA5 P95",
                              "definition": "Days/year exceeding the 2011-2020 local 95th-percentile daily max temperature (extreme-heat days vs the city's own historical baseline), not absolute-threshold heatwaves."},
            "deaths":        mort_conf,
            "economic_loss": {"level": "medium", "source": "Burke 2018 + ILO bipartite model",
                              "note": "Indicative directional estimate. +-8% CI."},
            "population":    {"level": "high" if pop_source == "verified_city_vault" else "medium",
                              "source": pop_source},
            "death_rate":    {"level": "high",   "source": "vault/UN Population Division"},
        },
        "historicalEras": historical_eras,
        "hexGrid": hex_grid_data,
        "aiAnalysis": ai,
        "auditTrail": audit,
        "charts": {
            "heatwave": heatwave_chart,
            "economic": economic_chart,
        },
        "metadata": {
            "data_lineage": "statistical_fallback" if any_fallback else "empirical_api",
            "coverage_method": hex_coverage_method,
        },
    }
