"""
climate_engine/api/main.py — Final Pure API Architecture
"""
from __future__ import annotations
import logging
import random
from typing import List, Dict, Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# STRICTLY ONLY THE 3 APPROVED APIS
from climate_engine.services.ecmwf_service import fetch_historical_baseline
from climate_engine.services.cmip6_service import fetch_cmip6_timeseries # UPDATED: cmip6_service
from climate_engine.services.socioeconomic_service import fetch_live_socioeconomics
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
        try:
            # 1. LIVE CLIMATE (Open-Meteo)
            base_temp = await fetch_historical_baseline(req.lat, req.lng)
            target_year = int(req.year)
            
            # UPDATED: We removed req.city because thresholds are now calculated mathematically by latitude!
            nasa_timeseries = await fetch_cmip6_timeseries(req.lat, req.lng, req.ssp, target_year)
            
            # 2. LIVE SOCIOECONOMICS (World Bank + Open-Meteo Geo)
            socio_data = await fetch_live_socioeconomics(req.city)
            live_pop = socio_data["population"]
            live_gdp = socio_data["city_gdp_usd"]
            
            # 3. THERMODYNAMIC PHYSICS
            canopy_cooling = req.canopy * 0.035
            roof_cooling = req.coolRoof * 0.015
            total_mitigation = canopy_cooling + roof_cooling

            heatwave_chart = []
            economic_chart = []
            
            daily_city_gdp = live_gdp / 365.0
            daily_baseline_deaths = (live_pop / 1000) * (8.0 / 365.0)

            for data_point in nasa_timeseries:
                yr = str(data_point["year"])
                adapted_heatwaves = max(0, data_point["heatwaves"] - int(total_mitigation * 4))
                heatwave_chart.append({"year": yr, "val": adapted_heatwaves})
                
                ssp_multiplier = 1.5 if req.ssp == "SSP5-8.5" else 1.0
                raw_econ_loss = (daily_city_gdp * 0.002) * data_point["heatwaves"] * ssp_multiplier
                adapted_econ_loss = (daily_city_gdp * 0.002) * adapted_heatwaves * ssp_multiplier
                
                economic_chart.append({
                    "year": yr, 
                    "noAction": round(raw_econ_loss / 1000000, 1), 
                    "adapt": round(adapted_econ_loss / 1000000, 1)
                })
            
            if nasa_timeseries:
                target_data = nasa_timeseries[-1]
                final_heatwaves = max(0, target_data["heatwaves"] - int(total_mitigation * 4))
                final_temp = max(base_temp, target_data["temp"] - total_mitigation)
                
                deaths = int(daily_baseline_deaths * 0.125 * final_heatwaves * ssp_multiplier)
                final_loss_usd = (daily_city_gdp * 0.002) * final_heatwaves * ssp_multiplier
                
                ci_lower, ci_upper = f"{int(deaths * 0.88):,}", f"{int(deaths * 1.15):,}"
                deaths_str = f"{deaths:,}"
                
                if final_loss_usd > 1000000000:
                    loss_str = f"${round(final_loss_usd / 1000000000, 2)}B"
                else:
                    loss_str = f"${round(final_loss_usd / 1000000, 1)}M"
            else:
                final_temp, final_heatwaves, deaths_str, ci_lower, ci_upper, loss_str = "N/A", "N/A", "N/A", "N/A", "N/A", "N/A"

            # 4. PURE MATH MAP GENERATION (Replaces Google Earth Engine API)
            hex_grid = [{"position": [req.lng + random.gauss(0, 0.06), req.lat + random.gauss(0, 0.06)]} for _ in range(1200)]

            # 5. LIVE AI ANALYSIS (Groq)
            ai_analysis = await generate_strategic_analysis(req.city, req.ssp, req.year, req.canopy, req.coolRoof)

            return {
                "metrics": {
                    "baseTemp": str(round(base_temp, 1)),
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
            
        except Exception as e:
            import traceback
            tb = traceback.format_exc()
            logger.error(f"CRITICAL 500 CRASH:\n{tb}")
            return {
                "metrics": {"baseTemp": "ERR", "temp": "ERR", "deaths": "ERR", "ci": "ERR", "loss": "ERR", "heatwave": "ERR"},
                "hexGrid": [],
                "aiAnalysis": {
                    "mortality": f"**CAUSE:** SERVER 500 CRASH **EFFECT:** {str(e)} **SOLUTION:** See backend.",
                    "economic": f"**CAUSE:** PYTHON TRACEBACK **EFFECT:** {tb[-250:]} **SOLUTION:** N/A",
                    "infrastructure": "**CAUSE:** N/A **EFFECT:** N/A **SOLUTION:** N/A",
                    "mitigation": "**CAUSE:** N/A **EFFECT:** N/A **SOLUTION:** N/A"
                },
                "charts": {"heatwave": [], "economic": []}
            }
    return app

app = create_app()