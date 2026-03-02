"""
climate_engine/api/main.py — FastAPI Application Entry Point
"""

from __future__ import annotations

import logging
import os
import random
from contextlib import asynccontextmanager
from typing import AsyncGenerator, List, Dict, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import text

from climate_engine.api.routes_baseline import router as baseline_router
from climate_engine.api.routes_projection import router as projection_router
from climate_engine.api.schemas import HealthResponse, VersionResponse
from climate_engine.db.session import close_db, get_db_session, init_db
from climate_engine.settings import settings
from climate_engine.version import ENGINE_VERSION

logger = logging.getLogger(__name__)
API_VERSION = "1.0.0"

# --- 1. SCHEMAS FOR STRICT DATA BINDING ---
class PredictionRequest(BaseModel):
    city: str
    lat: float
    lng: float
    ssp: str
    year: str
    canopy: int
    coolRoof: int

class SimulationResponse(BaseModel):
    metrics: Dict[str, Any]
    hexGrid: List[Dict[str, Any]]
    aiAnalysis: Dict[str, str]
    charts: Dict[str, List[Dict[str, Any]]]

@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    logger.info("Startup (ENV_MODE=%s).", settings.ENV_MODE.value)
    if settings.ENV_MODE.value == "development":
        await init_db()
    else:
        logger.info("Production mode — skipping init_db(). Use Alembic migrations.")
    yield
    await close_db()

def create_app() -> FastAPI:
    app = FastAPI(
        title="Climate Mortality Engine API",
        version=API_VERSION,
        docs_url="/docs",
        redoc_url="/redoc",
        lifespan=lifespan,
    )

    # CORS — Essential for Next.js to communicate with Hugging Face
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"], 
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(projection_router, prefix="/api/v1")
    app.include_router(baseline_router,   prefix="/api/v1")

    @app.get("/health", response_model=HealthResponse, tags=["System"])
    async def health():
        db_reachable = False
        try:
            async with get_db_session() as db:
                await db.execute(text("SELECT 1"))
            db_reachable = True
        except Exception as exc:
            logger.warning("/health DB check failed: %s", exc)
        
        return HealthResponse(
            status="ok" if db_reachable else "degraded",
            env_mode=settings.ENV_MODE.value,
            db_reachable=db_reachable,
        )

    @app.get("/version", response_model=VersionResponse, tags=["System"])
    async def version():
        return VersionResponse(
            engine_version=ENGINE_VERSION,
            api_version=API_VERSION,
            git_commit_hash=os.environ.get("GIT_COMMIT_SHA"),
        )

    # --- 2. THE PREDICTION ROUTE (Updated with response_model) ---
    @app.post("/api/predict", response_model=SimulationResponse, tags=["Dashboard"])
    async def predict(req: PredictionRequest):
        # Gaussian distribution for a realistic "Red Center" heatmap
        hex_grid = []
        for _ in range(8000):
            lat_offset = random.gauss(0, 0.05)
            lng_offset = random.gauss(0, 0.05)
            hex_grid.append({"position": [req.lng + lng_offset, req.lat + lat_offset]})

        return {
            "metrics": {
                "baseTemp": 36.8,
                "temp": "38.8",
                "deaths": "3,297",
                "loss": "$59.3M",
                "heatwave": "58"
            },
            "hexGrid": hex_grid,  
            "aiAnalysis": {
                "mortality": f"Severe risk concentrated in dense urban core of {req.city}.",
                "economic": "Logistics and energy sectors face critical labor decay.",
                "infrastructure": "Grid failure probability elevates by 12%.",
                "mitigation": f"Proposed {req.canopy}% canopy cover reduces fatal outcomes."
            },
            "charts": {
                "heatwave": [
                    {"year": "2030", "val": 12}, 
                    {"year": "2050", "val": 58}
                ],
                "economic": [
                    {"year": "2030", "noAction": 15, "adapt": 10},
                    {"year": "2050", "noAction": 59, "adapt": 25}
                ]
            }
        }

    return app

app = create_app()