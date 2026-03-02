"""
climate_engine/api/main.py — FastAPI Application Entry Point
"""
from __future__ import annotations
import logging
import os
from contextlib import asynccontextmanager
from typing import AsyncGenerator, List, Dict, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from climate_engine.services.ecmwf_service import fetch_historical_baseline
from climate_engine.services.nasa_service import fetch_cmip6_timeseries
from climate_engine.services.gee_service import generate_spatial_hexgrid
from climate_engine.services.llm_service import generate_strategic_analysis

logger = logging.getLogger(__name__)

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

def create_app() -> FastAPI:
    app = FastAPI(title="Climate Engine API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"], 
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.post("/api/predict", response_model=SimulationResponse)
    async def predict(req: PredictionRequest):
        
        base_temp = await fetch_historical_baseline(req.lat, req.lng)
        target_year = int(req.year)
        nasa_timeseries = await fetch_cmip6_timeseries(req.lat, req.lng, req.ssp, target_year)
        
        canopy_cooling = req.canopy * 0.035
        roof_cooling = req.coolRoof * 0.015
        total_mitigation = canopy_cooling + roof_cooling
        
        heatwave_chart = []
        economic_chart = []
        
        for data_point in nasa_timeseries:
            yr = str(data_point["year"])
            adapted_heatwaves = max(0, data_point["heatwaves"] - int(total_mitigation * 4))
            adapted_econ = max(0, data_point["economic_loss"] - (total_mitigation * 5))
            heatwave_chart.append({"year": yr, "val": adapted_heatwaves})
            economic_chart.append({"year": yr, "noAction": data_point["economic_loss"], "adapt": round(adapted_econ, 1)})

        if nasa_timeseries:
            target_data = nasa_timeseries[-1]
            final_heatwaves = max(0, target_data["heatwaves"] - int(total_mitigation * 4))
            final_temp = max(base_temp, target_data["temp"] - total_mitigation)
            final_loss = max(0, target_data["economic_loss"] - (total_mitigation * 5))
            
            ssp_multiplier = 1.5 if req.ssp == "SSP5-8.5" else 1.0
            deaths = int(800 + (final_heatwaves * 42) * ssp_multiplier)
            ci_lower, ci_upper = f"{int(deaths * 0.88):,}", f"{int(deaths * 1.15):,}"
            deaths_str, loss_str = f"{deaths:,}", f"${round(final_loss, 1)}M"
        else:
            final_temp, final_heatwaves, deaths_str, ci_lower, ci_upper, loss_str = "N/A", "N/A", "N/A", "N/A", "N/A", "N/A"

        hex_grid = await generate_spatial_hexgrid(req.lat, req.lng)
        ai_analysis = await generate_strategic_analysis(req.city, req.ssp, req.year, req.canopy, req.coolRoof)

        return {
            "metrics": {
                "baseTemp": str(base_temp),
                "temp": f"{final_temp:.1f}" if isinstance(final_temp, float) else "N/A",
                "deaths": deaths_str,
                "ci": f"{ci_lower} - {ci_upper}" if ci_lower != "N/A" else "N/A",
                "loss": loss_str,
                "heatwave": str(final_heatwaves)
            },
            "hexGrid": hex_grid,  
            "aiAnalysis": ai_analysis,
            "charts": {
                "heatwave": heatwave_chart,
                "economic": economic_chart
            }
        }
    return app

app = create_app()