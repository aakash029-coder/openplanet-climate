"""
climate_engine/api/main.py — FastAPI Application Factory
Route responsibilities:
  1. Validate request schema (Pydantic).
  2. Normalize SSP strings to compact service-layer format ONCE at entry.
  3. Call physics / service layer functions.
  4. Propagate data-unavailability as HTTP 404.
  5. Return typed response schemas.
Scientific logic is delegated to the physics and services layers.
"""

from __future__ import annotations

import base64
import logging
import math
import re
import os
import json
import asyncio
import traceback
import time
import uuid
from typing import Optional

import pycountry
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
import h3
from global_land_mask import globe

from climate_engine.settings import settings
from climate_engine.api.security import (
    add_security_headers,
    inject_request_id,
    limiter,
    get_rate_limit_string,
    verify_api_key,
)
from climate_engine.services.cmip6_service import (
    fetch_historical_baseline_full,
    fetch_cmip6_projection,
    HorizonUnavailable,
    PROJECTION_HORIZON_YEAR,
)
from climate_engine.services.socioeconomic_service import (
    fetch_live_socioeconomics,
    geocode_city,
    search_geocode_candidates,
    GeocodingResult,
)
import httpx
from climate_engine.services.historical_service import fetch_historical_eras
from climate_engine.services.llm_service import (
    generate_strategic_analysis,
    generate_strategic_analysis_raw,
    generate_compare_analysis,
)

from .schemas import (
    PredictionRequest,
    ClimateRiskRequest,
    ResearchAIRequest,
    CompareAnalysisRequest,
    SimulationResponse,
    ResponseMetadata,
)
from .physics import (
    ClimateZone,
    ZoneClassification,
    detect_climate_archetype,
    _fetch_era5_humidity_p95,
    _fetch_relative_humidity_live,
    WetBulbResult,
    _stull_wetbulb,
    stull_wetbulb_simple,
    _fetch_worldbank_death_rate,
    _gasparrini_mortality,
    compute_hybrid_economic_loss,
    _build_audit_trail,
    H3CoverageResult,
    get_city_hexagons,
    ISO3_MAP,
)

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# City Coordinate Vault — local geocoding intercept (zero HTTP, zero 429 risk)
# ─────────────────────────────────────────────────────────────────────────────

try:
    _CITY_COORDS_PATH = os.path.join(
        os.path.dirname(__file__), "../data/city_coords.json"
    )
    with open(_CITY_COORDS_PATH, "r") as _f:
        _CITY_COORDS: dict = json.load(_f)
    logger.info("City Coords Vault loaded: %d entries", len(_CITY_COORDS))
except Exception as _e:
    logger.error("Failed to load city_coords.json: %s", _e)
    _CITY_COORDS = {}


def _coords_vault_key(city: str) -> Optional[str]:
    """Slug-match a raw city query string against the coordinate vault."""
    parts = [p.strip() for p in city.split(",")]
    def _slug(s: str) -> str:
        import unicodedata
        s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode()
        s = re.sub(r"[^a-z0-9 ]", "", s.lower())
        return re.sub(r"\s+", "_", s.strip())
    if len(parts) >= 2:
        slug = _slug(f"{parts[0]} {parts[-1]}")
        if slug in _CITY_COORDS:
            return slug
    city_slug = _slug(parts[0])
    for key in _CITY_COORDS:
        if key.startswith(city_slug):
            return key
    return None


# ─────────────────────────────────────────────────────────────────────────────
# ISO2 → ISO3 helper
# ─────────────────────────────────────────────────────────────────────────────

def _iso2_to_iso3(iso2: str) -> str:
    """
    Convert an ISO 3166-1 alpha-2 code to alpha-3 using pycountry.
    Falls back gracefully:
      1. pycountry lookup (covers all 249 UN-recognised countries).
      2. Legacy ISO3_MAP (for "UN" → "WLD" and any custom mappings).
      3. Returns "WLD" as the final safe default.
    """
    if not iso2 or iso2 == "UN":
        return "WLD"
    try:
        country = pycountry.countries.get(alpha_2=iso2.upper())
        if country:
            return country.alpha_3
    except Exception:
        pass
    return ISO3_MAP.get(iso2, "WLD")


# ─────────────────────────────────────────────────────────────────────────────
# SSP Normalisation helpers
# ─────────────────────────────────────────────────────────────────────────────

_SSP_DISPLAY: dict[str, str] = {
    "ssp119": "SSP1-1.9",
    "ssp126": "SSP1-2.6",
    "ssp245": "SSP2-4.5",
    "ssp370": "SSP3-7.0",
    "ssp434": "SSP4-3.4",
    "ssp460": "SSP4-6.0",
    "ssp534": "SSP5-3.4",
    "ssp585": "SSP5-8.5",
}

_SSP_HIGH_EMISSION: frozenset[str] = frozenset({"ssp585", "ssp370"})


def _normalize_ssp(ssp: str) -> str:
    code = ssp.strip().lower().replace("-", "").replace(".", "")
    if code not in _SSP_DISPLAY:
        logger.warning(
            "[_normalize_ssp] Unrecognised SSP code '%s' (raw='%s'). "
            "Proceeding best-effort.",
            code,
            ssp,
        )
    return code


def _is_high_emission(ssp_code: str) -> bool:
    return ssp_code in _SSP_HIGH_EMISSION


# ─────────────────────────────────────────────────────────────────────────────
# Canonical error helpers
# ─────────────────────────────────────────────────────────────────────────────

def _data_unavailable(detail: str) -> HTTPException:
    logger.error("DATA UNAVAILABLE 404: %s", detail)
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=f"Scientific Data Unavailable: {detail}",
    )


# ─────────────────────────────────────────────────────────────────────────────
# Köppen-Calibrated UHI Spatial Decay Parameters
# Sources:
#   Oke TR (1982) "The energetic basis of the urban heat island."
#     Q J R Meteorol Soc 108(455):1–24. Table 2 — UHI intensity by climate type.
#   Arnfield AJ (2003) "Two decades of urban climate research: a review of
#     turbulence, exchanges of energy and water, and the urban heat island."
#     Int J Climatol 23(1):1–26. §4.2 — lateral decay morphology.
#   Roth M (2007) "Review of atmospheric turbulence over cities."
#     Q J R Meteorol Soc 133(629):1551–1563. Fig. 3 — lateral decay profiles.
#
# Format: (core_warmth_offset, decay_per_km)
#   core_warmth_offset  — fractional risk addition at the urban centre
#   decay_per_km        — fractional reduction per km from centre
# ─────────────────────────────────────────────────────────────────────────────

_UHI_DECAY_PARAMS: dict[ClimateZone, tuple[float, float]] = {
    ClimateZone.HYPER_ARID:          (0.14, 0.018),
    ClimateZone.LETHAL_HUMID:        (0.06, 0.025),
    ClimateZone.EXTREME_CONTINENTAL: (0.10, 0.024),
    ClimateZone.PERMAFROST:          (0.04, 0.038),
    ClimateZone.STANDARD:            (0.08, 0.028),
}


# ─────────────────────────────────────────────────────────────────────────────
# H3 Hex Grid Generation Helper
# ─────────────────────────────────────────────────────────────────────────────

async def _generate_hex_grid_data(
    city_name: str,
    city_wbt: float,
    city_temp: float,
    p95_rh: float = 65.0,
    ann_mean: float = 15.0,
    resolution: int = 9,
) -> tuple[list[dict], str]:
    """
    Generate H3 hex grid with Köppen-calibrated UHI distance-decay modelling.
    1. Filters out water using global_land_mask.
    2. Classifies climate archetype from ann_mean + p95_rh.
    3. Applies Oke (1982) / Arnfield (2003) zone-specific decay params.
    """
    try:
        hex_coverage: H3CoverageResult = await get_city_hexagons(city_name, resolution)
        center_lat = hex_coverage.center_lat
        center_lng = hex_coverage.center_lng

        # Classify climate zone and pick UHI decay params
        zone_obj   = detect_climate_archetype(mean_temp=ann_mean, p95_rh=p95_rh, tx5d=city_temp)
        uhi_core, uhi_slope = _UHI_DECAY_PARAMS[zone_obj.zone]

        # Base macro-climate risk from ERA5
        base_intensity = min(0.85, max(0.1, (city_wbt - 15.0) / 20.0))

        hex_grid_data: list[dict] = []
        for hx in hex_coverage.hexagons:
            lat, lng = h3.cell_to_latlng(hx)

            # Water masking — skip ocean/lake hexagons
            if not globe.is_land(lat, lng):
                continue

            # Oke (1982) UHI distance-decay from urban core
            dy = lat - center_lat
            dx = (lng - center_lng) * math.cos(math.radians(center_lat))
            dist_km = math.sqrt(dx * dx + dy * dy) * 111.0

            uhi_decay_factor = max(-0.25, uhi_core - (dist_km * uhi_slope))

            final_risk = min(1.0, max(0.05, base_intensity + uhi_decay_factor))

            hex_grid_data.append({
                "position": [lng, lat],
                "risk_weight": round(final_risk, 3),
                "hex_id": hx,
            })

        logger.info(
            "[hex_grid] Generated %d modelled hexagons for '%s' (coverage=%s)",
            len(hex_grid_data),
            city_name,
            hex_coverage.coverage_method,
        )
        return hex_grid_data, hex_coverage.coverage_method

    except Exception as exc:
        logger.warning("[hex_grid] Failed for '%s': %s", city_name, exc)
        return [], "unavailable"


# ─────────────────────────────────────────────────────────────────────────────
# ASI Agentverse Chat Protocol — request schema and climate summary helper
# ─────────────────────────────────────────────────────────────────────────────

class ASIChatPayload(BaseModel):
    version: int = 1
    sender: str = ""
    target: str = ""
    session: str = ""
    schema_digest: str = ""
    protocol_digest: str = ""
    payload: str = ""
    expires: int = 0
    nonce: int = 0
    signature: str = ""


async def _get_asi_climate_summary(city_name: str) -> str:
    """Fetch real ERA5 + CMIP6 data for a city and format as agent-readable text."""
    # Vault-first geocoding to avoid external HTTP for known cities
    vault_key = _coords_vault_key(city_name)
    if vault_key:
        cv = _CITY_COORDS[vault_key]
        lat, lng = cv["lat"], cv["lng"]
        logger.info("[asi] vault hit '%s' -> (%.4f, %.4f)", city_name, lat, lng)
    else:
        async with httpx.AsyncClient(timeout=30.0, trust_env=False) as geo_client:
            geo = await geocode_city(city_name, geo_client)
        lat, lng = geo.latitude, geo.longitude
        logger.info("[asi] geocoded '%s' -> (%.4f, %.4f)", city_name, lat, lng)

    baseline, rh_p95 = await asyncio.gather(
        fetch_historical_baseline_full(lat, lng),
        _fetch_era5_humidity_p95(lat, lng),
    )

    p95 = baseline["p95_threshold_c"]

    proj_2030, proj_2050 = await asyncio.gather(
        fetch_cmip6_projection(lat, lng, "ssp245", 2030, p95, 0.0),
        fetch_cmip6_projection(lat, lng, "ssp245", 2050, p95, 0.0),
        return_exceptions=True,
    )

    lines = [f"OpenPlanet Heat Risk Report — {city_name}"]

    for year, proj in [(2030, proj_2030), (2050, proj_2050)]:
        if isinstance(proj, Exception):
            logger.warning("[asi] CMIP6 year=%d failed for '%s': %s", year, city_name, proj)
            continue
        tx5d = proj["tx5d_c"]
        hw_days = int(proj["hw_days"])
        mean_temp = proj["mean_temp_c"]
        zone_obj = detect_climate_archetype(mean_temp=mean_temp, p95_rh=rh_p95, tx5d=tx5d)
        wbt_result = _stull_wetbulb(temp_c=tx5d, rh_pct=rh_p95, zone=zone_obj.zone)
        wbt = wbt_result.wbt_celsius
        risk_level = "CRITICAL" if wbt >= 31 else ("DANGER" if wbt >= 28 else "STABLE")
        lines.append(
            f"{year} (SSP2-4.5): Peak Tx5d {tx5d:.1f}°C | {hw_days} heatwave days | "
            f"Wet-bulb {wbt:.1f}°C | Risk: {risk_level}"
        )

    if len(lines) == 1:
        raise ValueError(f"No CMIP6 projection data available for '{city_name}'")

    lines.append("Full interactive analysis: openplanetrisk.com")
    return "\n".join(lines)


# ─────────────────────────────────────────────────────────────────────────────
# App factory
# ─────────────────────────────────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(
        title="OpenPlanet Climate Engine",
        description="High-resolution urban heat risk intelligence.",
        version="2.0.0",
        docs_url="/docs" if settings.ENV_MODE.value == "development" else None,
        redoc_url="/redoc" if settings.ENV_MODE.value == "development" else None,
    )

    # ── Rate limiter state ────────────────────────────────────────────────
    app.state.limiter = limiter

    # ── Middleware (order matters: outermost wraps first) ─────────────────
    app.add_middleware(SlowAPIMiddleware)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "X-RateLimit-Limit", "X-RateLimit-Remaining"],
    )

    app.middleware("http")(inject_request_id)
    app.middleware("http")(add_security_headers)

    # ── Rate limit exceeded handler ───────────────────────────────────────
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── Global exception handler ──────────────────────────────────────────

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = getattr(request.state, "request_id", str(uuid.uuid4()))

        if isinstance(exc, HTTPException):
            return JSONResponse(
                status_code=exc.status_code,
                content={
                    "error": f"HTTP_{exc.status_code}",
                    "detail": exc.detail,
                    "request_id": request_id,
                },
            )

        tb = traceback.format_exc()
        logger.error(
            "Unhandled exception | request_id=%s | path=%s | %s\n%s",
            request_id,
            request.url.path,
            str(exc),
            tb,
        )

        if settings.ENV_MODE.value == "development":
            detail = f"{type(exc).__name__}: {exc}"
        else:
            detail = (
                "An internal engine error occurred. "
                f"Reference: {request_id}"
            )

        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "ENGINE_FAILURE",
                "detail": detail,
                "request_id": request_id,
            },
        )

    # ── Health check ──────────────────────────────────────────────────────

    @app.get("/", tags=["Health"])
    async def root():
        return {
            "status": "OpenPlanet Risk Engine",
            "version": "2.0.0",
            "env": settings.ENV_MODE.value,
        }

    @app.get("/health", tags=["Health"])
    async def health():
        return {"status": "running", "agent": "OpenPlanet Heat-Risk Agent"}

    # ── Geocode Search ────────────────────────────────────────────────────

    rate_limit = get_rate_limit_string()

    @app.get("/api/geocode-search", tags=["Geocoding"])
    @limiter.limit(rate_limit)
    async def geocode_search(request: Request, response: Response, q: str = ""):
        """
        Multi-tier location autocomplete.
        Cascade: Google Maps → OpenCage → Nominatim → Open-Meteo.
        Returns up to 5 ranked candidates with precise WGS-84 coordinates.
        """
        if not q or len(q.strip()) < 2:
            return {"results": []}

        async with httpx.AsyncClient(timeout=20.0, trust_env=False) as geo_client:
            candidates = await search_geocode_candidates(q.strip(), geo_client)

        return {
            "results": [
                {
                    "id": c.id,
                    "name": c.name,
                    "display_name": c.display_name,
                    "country": c.country,
                    "country_code": c.country_code,
                    "latitude": c.latitude,
                    "longitude": c.longitude,
                    "source": c.source,
                }
                for c in candidates
            ]
        }

    # ── Research AI ───────────────────────────────────────────────────────

    @app.post("/api/research-analysis", tags=["Analysis"])
    @limiter.limit(rate_limit)
    async def research_analysis(request: Request, req: ResearchAIRequest, response: Response):
        logger.info(
            "[research-analysis] city=%r  context=%r  metrics_keys=%s",
            req.city_name,
            req.context,
            list(req.metrics.keys()),
        )
        prompt = (
            "[SYSTEM: SCIENTIFIC AUDIT MODE]\n"
            f"Context: {req.context}\n"
            f"Write a cohesive 3-4 sentence executive summary for {req.city_name}.\n"
            "REAL METRICS (Open-Meteo ERA5 + CMIP6 + World Bank):\n"
            f"- Peak Tx5d: {req.metrics.get('temp')}\n"
            f"- Elevation: {req.metrics.get('elevation')}\n"
            f"- Annual heatwave/heat-stress days: {req.metrics.get('heatwave')}\n"
            f"- Economic loss: {req.metrics.get('loss')}\n"
            "RULES: ONE paragraph. No lists. No bullets. "
            "Authoritative IPCC scientist tone. Use exact numbers provided."
        )
        try:
            raw = await generate_strategic_analysis_raw(prompt)
            clean = raw.replace("**", "").replace("*", "").replace("\n", " ").strip()
            clean = re.sub(r"\b\d+\.\s", "", clean)
            return {"reasoning": clean}
        except Exception as exc:
            logger.error("[research-analysis] LLM error: %s", exc)
            return {"reasoning": "Scientific reasoning temporarily unavailable."}

    # ── Compare Analysis ──────────────────────────────────────────────────

    @app.post("/api/compare-analysis", tags=["Analysis"])
    @limiter.limit(rate_limit)
    async def compare_analysis(request: Request, req: CompareAnalysisRequest, response: Response):
        logger.info(
            "[compare-analysis] city_a=%r  city_b=%r",
            req.city_a,
            req.city_b,
        )
        try:
            comparison = await generate_compare_analysis(
                city_a=req.city_a,
                city_b=req.city_b,
                data_a=req.data_a,
                data_b=req.data_b,
            )
            return {"comparison": comparison}
        except Exception as exc:
            logger.error("[compare-analysis] error: %s", exc)
            return {"comparison": "Comparative analysis temporarily unavailable."}

    # ── Predict ───────────────────────────────────────────────────────────

    @app.post("/api/predict", response_model=SimulationResponse, tags=["Simulation"])
    @limiter.limit(rate_limit)
    async def predict(request: Request, req: PredictionRequest, response: Response):
        target_year = int(req.year)
        if target_year > PROJECTION_HORIZON_YEAR:
            raise HTTPException(
                status_code=422,
                detail=(
                    f"Projection year {target_year} exceeds the validated CMIP6 data horizon "
                    f"({PROJECTION_HORIZON_YEAR}). OpenPlanet projections are capped at "
                    f"{PROJECTION_HORIZON_YEAR} per strict adherence to available peer-reviewed "
                    f"CMIP6 outputs. Request a year ≤ {PROJECTION_HORIZON_YEAR}."
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

        # ── Vault-first coordinate resolution — eliminates Nominatim 429 cascade.
        # PredictionRequest already carries validated lat/lng from the frontend,
        # so we only need the external geocoder to infer country_code for cities
        # not in our vault. Vault hits short-circuit ALL external HTTP.
        _vault_key = _coords_vault_key(location_hint)
        if _vault_key:
            _cv = _CITY_COORDS[_vault_key]
            geo = GeocodingResult(
                city_population=0,
                country_code=_cv["country_code"],
                latitude=req.lat,   # trust client-validated coordinates
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

        # ── 1. Historical baseline ────────────────────────────────────────
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

        # ── 2. Socioeconomics ─────────────────────────────────────────────
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

        # ── 3. External data (parallel) ───────────────────────────────────
        try:
            death_rate, rh_live, rh_p95, historical_eras = await asyncio.gather(
                _fetch_worldbank_death_rate(iso3),
                _fetch_relative_humidity_live(lat, lng),
                _fetch_era5_humidity_p95(lat, lng),
                fetch_historical_eras(lat, lng)
            )
        except Exception as exc:
            raise _data_unavailable(str(exc))

        # ── 4. CMIP6 projections — capped at PROJECTION_HORIZON_YEAR ────────
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

        # ── 6. Zone-aware chart series ────────────────────────────────────
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

        # ── 7. Target-year outputs (zone-aware) ───────────────────────────
        if target_year not in projections:
            raise _data_unavailable(
                f"CMIP6 projection for target year {target_year} is unavailable."
            )

        tgt = projections[target_year]
        tx5d = tgt["tx5d_c"]
        hw_days_tgt = tgt["hw_days"]
        mean_temp_tgt = tgt["mean_temp_c"]
        temp_excess = max(0.0, tx5d - p95)

        zone_obj_target: ZoneClassification = detect_climate_archetype(
            mean_temp=mean_temp_tgt,
            p95_rh=rh_p95,
            tx5d=tx5d,
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
        wbt_proj = wbt_result_proj.wbt_celsius

        wbt_result_live: WetBulbResult = _stull_wetbulb(
            temp_c=tx5d,
            rh_pct=rh_live,
            zone=zone_obj_target.zone,
        )
        wbt_live = wbt_result_live.wbt_celsius

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

        # ── 8. H3 hex grid ────────────────────────────────────────────────
        hex_grid_data, hex_coverage_method = await _generate_hex_grid_data(
            city_name=location_hint,
            city_wbt=wbt_proj,
            city_temp=tx5d,
            p95_rh=rh_p95,
            ann_mean=ann_mean,
            resolution=9,
        )

        # ── 9. Optional AI narrative ──────────────────────────────────────
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
                "rh_p95": rh_p95,
                "rh_live": rh_live,
                "climate_zone": zone_obj_target.zone.value,
                "zone_confidence": zone_obj_target.confidence,
                "lethal_risk_flag": wbt_result_proj.lethal_risk_flag,
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

    # ── Climate Risk ──────────────────────────────────────────────────────

    @app.post("/api/climate-risk", tags=["Simulation"])
    @limiter.limit(rate_limit)
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

        # ── Baseline ──────────────────────────────────────────────────────
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

        # ── Socioeconomics ────────────────────────────────────────────────
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

        # ── External data (parallel) ──────────────────────────────────────
        try:
            death_rate, rh_p95 = await asyncio.gather(
                _fetch_worldbank_death_rate(iso3),
                _fetch_era5_humidity_p95(req.lat, req.lng),
            )
        except Exception as exc:
            raise _data_unavailable(
                f"World Bank death rate / ERA5 humidity fetch failed: {exc}"
            )

        # ── CMIP6 base projections ────────────────────────────────────────
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

        # ── Per-decade projections (zone-aware) ───────────────────────────
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

                zone_obj: ZoneClassification = detect_climate_archetype(
                    mean_temp=mean_temp,
                    p95_rh=rh_p95,
                    tx5d=tx5d,
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
                wbt = wbt_result.wbt_celsius

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
            "metadata": {
                "data_lineage": "statistical_fallback" if any_fallback else "empirical_api",
                "coverage_method": hex_coverage_method,
            },
        }

    # ── ASI Agentverse Chat Protocol ──────────────────────────────────────────

    @app.post("/submit", tags=["ASI Agent"])
    async def agentverse_submit(req: ASIChatPayload):
        logger.info("[asi/submit] sender=%r  session=%r", req.sender, req.session)

        city_name = ""
        try:
            padded = req.payload + "=" * ((4 - len(req.payload) % 4) % 4)
            payload_data = json.loads(base64.b64decode(padded).decode("utf-8"))

            # Support both AgentChatProtocol v0.3 content array and plain text field
            content = payload_data.get("content", [])
            if content and isinstance(content, list):
                raw_text = content[0].get("text", "").strip()
            else:
                raw_text = payload_data.get("text", "").strip()

            # Extract city from natural language ("for Tokyo", "including Tokyo")
            match = re.search(
                r'\bfor\s+([A-Z][a-zA-Z\s\-]+?)(?:\s+including|\s*[,\.?]|$)',
                raw_text,
            )
            city_name = match.group(1).strip() if match else raw_text
            logger.info("[asi/submit] raw_text=%r  city_name=%r", raw_text, city_name)
        except Exception as exc:
            logger.warning("[asi/submit] payload decode failed: %s", exc)

        if city_name:
            try:
                response_text = await _get_asi_climate_summary(city_name)
            except Exception as exc:
                logger.warning("[asi/submit] climate summary failed for '%s': %s", city_name, exc)
                response_text = (
                    f"Climate data for '{city_name}' is currently unavailable. "
                    "Visit openplanetrisk.com for full heat risk intelligence."
                )
        else:
            response_text = (
                "Please provide a city name in your message. "
                "Example: 'What is the heat risk for Mumbai?' "
                "Visit openplanetrisk.com for full heat risk intelligence."
            )

        encoded_payload = base64.b64encode(
            json.dumps({"type": "text", "text": response_text}).encode("utf-8")
        ).decode("ascii")

        return {
            "version": 1,
            "sender": "openplanet-heat-risk-agent",
            "target": req.sender,
            "session": req.session,
            "schema_digest": req.schema_digest,
            "protocol_digest": req.protocol_digest,
            "payload": encoded_payload,
            "expires": 0,
            "nonce": 0,
            "signature": "",
        }

    return app


app = create_app()