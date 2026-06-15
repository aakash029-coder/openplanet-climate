"""
climate_engine/api/main.py — FastAPI Application Factory

Route responsibilities:
  1. Validate request schema (Pydantic).
  2. Normalize SSP strings to compact service-layer format ONCE at entry.
  3. Call physics / service layer functions.
  4. Propagate data-unavailability as HTTP 404.
  5. Return typed response schemas.
Scientific logic is delegated to the physics and services layers.
Route handlers are in climate_engine.api.routers.*
"""

from __future__ import annotations

import logging
import traceback
import uuid

import httpx
from fastapi import FastAPI, HTTPException, Request, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from climate_engine.settings import settings
from climate_engine.api.security import (
    add_security_headers,
    inject_request_id,
    limiter,
    get_rate_limit_string,
)
from climate_engine.services.socioeconomic_service import search_geocode_candidates

# Route sub-modules
from climate_engine.api.routers.predict import router as predict_router
from climate_engine.api.routers.climate import router as climate_router
from climate_engine.api.routers.analysis import router as analysis_router
from climate_engine.api.routers.asi import router as asi_router

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(
        title="OpenPlanet Climate Engine",
        description=(
            "Open-source, city-scale physical climate-risk intelligence.\n\n"
            "Translates ERA5 reanalysis and CMIP6 ensemble projections into "
            "heat-attributable mortality, economic-damage proxies, and wet-bulb "
            "survivability for any coordinate on Earth.\n\n"
            "**All outputs are directional macro-scale proxies** derived from public "
            "datasets and peer-reviewed methods (Gasparrini 2017, Burke 2018, "
            "Stull 2011, Sherwood & Huber 2010) — not certified forecasts or "
            "financial instruments. Every response carries a `metadata.data_lineage` "
            "field; `statistical_fallback` means an upstream API failed and a "
            "latitude-model estimate was substituted (treat as order-of-magnitude).\n\n"
            "Source & full methodology: https://github.com/aakash029-coder/openplanet-climate"
        ),
        version="2.0.0",
        contact={
            "name": "OpenPlanet",
            "url": "https://github.com/aakash029-coder/openplanet-climate",
        },
        license_info={"name": "MIT", "url": "https://opensource.org/licenses/MIT"},
        openapi_tags=[
            {"name": "climate", "description": "Climate-risk projection endpoints."},
            {"name": "ops", "description": "Liveness and operational probes."},
        ],
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
    )

    # ── Rate limiter state ────────────────────────────────────────────────────
    app.state.limiter = limiter

    # ── Middleware (order matters: outermost wraps first) ─────────────────────
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

    # ── Rate limit exceeded handler ───────────────────────────────────────────
    app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

    # ── Global exception handler ──────────────────────────────────────────────

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

    # ── Health checks ─────────────────────────────────────────────────────────

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

    # ── Geocode Search ────────────────────────────────────────────────────────

    rate_limit = get_rate_limit_string()

    @app.get("/api/geocode-search", tags=["Geocoding"])
    @limiter.limit(rate_limit)
    async def geocode_search(request: Request, response: Response, q: str = ""):
        """
        Multi-tier location autocomplete.
        Cascade: Photon -> Open-Meteo -> Nominatim.
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

    # ── Include route sub-modules ─────────────────────────────────────────────
    app.include_router(predict_router)
    app.include_router(climate_router)
    app.include_router(analysis_router)
    app.include_router(asi_router)

    return app


# Module-level instance — required by uvicorn CLI: uvicorn climate_engine.api.main:app
app = create_app()
