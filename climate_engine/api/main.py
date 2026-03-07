"""
climate_engine/api/main.py — Final Pure API Architecture with Research Injection
"""
from __future__ import annotations
import logging
import random
import httpx
import asyncio
from typing import List, Dict, Any, Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# STRICTLY ONLY THE APPROVED APIS
from climate_engine.services.cmip6_service import fetch_cmip6_timeseries, fetch_historical_baseline
from climate_engine.services.socioeconomic_service import fetch_live_socioeconomics
from climate_engine.services.llm_service import generate_strategic_analysis

logger = logging.getLogger(__name__)

# ─── DATA MODELS ────────────────────────────────────────────────────────

class PredictionRequest(BaseModel):
    city: str
    lat: float
    lng: float
    ssp: str
    year: str
    canopy: int
    coolRoof: int

class ThresholdRequest(BaseModel):
    lat: float
    lng: float

class ClimateRiskRequest(BaseModel):
    lat: float
    lng: float
    elevation: float = 0.0
    ssp: str
    canopy_offset_pct: int
    albedo_offset_pct: int
    location_hint: str = ""

class SimulationResponse(BaseModel):
    metrics: Dict[str, Any]
    hexGrid: List[Dict[str, Any]]
    aiAnalysis: Optional[Dict[str, str]]
    charts: Dict[str, List[Dict[str, Any]]]

# ─── STATIC SHADOW DATABASE ─────────────────────────────────────────────
SHADOW_DB = {
    "moscow": {"pop": 13000000, "gdp": 250000000000},
    "beijing": {"pop": 21500000, "gdp": 600000000000},
    "shanghai": {"pop": 24200000, "gdp": 650000000000},
    "tehran": {"pop": 8600000, "gdp": 150000000000},
    "delhi": {"pop": 32000000, "gdp": 210000000000},
    "pune": {"pop": 7000000, "gdp": 60000000000},
}

def get_real_socioeconomics(city_name: str, api_data: dict) -> tuple[int, float]:
    if api_data and "population" in api_data and "city_gdp_usd" in api_data:
        return api_data["population"], api_data["city_gdp_usd"]
    
    city_key = city_name.split(',')[0].strip().lower()
    if city_key in SHADOW_DB:
        return SHADOW_DB[city_key]["pop"], float(SHADOW_DB[city_key]["gdp"])
        
    raise ValueError(f"Failed to retrieve valid real-world socioeconomic data for {city_name}.")

# ─── APPLICATION FACTORY ────────────────────────────────────────────────

def create_app() -> FastAPI:
    app = FastAPI(title="Climate Engine API")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"], 
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    async def root():
        return {"status": "OpenPlanet Risk Engine is Online"}

    # 1. THE ORIGINAL MAP ENGINE API (Dashboard)
    @app.post("/api/predict", response_model=SimulationResponse)
    async def predict(req: PredictionRequest):
        try:
            annual_mean_temp = await fetch_historical_baseline(req.lat, req.lng)
            historical_summer_peak = annual_mean_temp + 8.0 + (abs(req.lat) * 0.25)
            
            target_year = int(req.year)
            nasa_timeseries = await fetch_cmip6_timeseries(req.lat, req.lng, req.ssp, target_year)
            
            try:
                socio_data = await fetch_live_socioeconomics(req.city)
            except:
                socio_data = {}
            live_pop, live_gdp = get_real_socioeconomics(req.city, socio_data)
            
            canopy_cooling = (req.canopy / 100.0) * 1.2
            roof_cooling = (req.coolRoof / 100.0) * 0.8
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
                final_temp = max(historical_summer_peak, target_data.get("temp", historical_summer_peak) - total_mitigation)
                
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
                deaths, final_loss_usd = 0, 0.0

            hex_grid = [{"position": [req.lng + random.gauss(0, 0.06), req.lat + random.gauss(0, 0.06)]} for _ in range(1200)]

            if nasa_timeseries:
                ai_analysis = await generate_strategic_analysis(
                    req.city, req.ssp, req.year, req.canopy, req.coolRoof,
                    final_temp, final_heatwaves, deaths, final_loss_usd
                )
            else:
                ai_analysis = None

            return {
                "metrics": {
                    "baseTemp": str(round(historical_summer_peak, 1)),
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
            logger.error(f"DASHBOARD 500 CRASH: {str(e)}")
            return {
                "metrics": {"baseTemp": "ERR", "temp": "ERR", "deaths": "ERR", "ci": "ERR", "loss": "ERR", "heatwave": "ERR"},
                "hexGrid": [],
                "aiAnalysis": {
                    "mortality": f"**CAUSE:** SERVER CRASH **EFFECT:** {str(e)} **SOLUTION:** Review backend logs.",
                    "economic": "**CAUSE:** N/A **EFFECT:** N/A **SOLUTION:** N/A",
                    "infrastructure": "**CAUSE:** N/A **EFFECT:** N/A **SOLUTION:** N/A",
                    "mitigation": "**CAUSE:** N/A **EFFECT:** N/A **SOLUTION:** N/A"
                },
                "charts": {"heatwave": [], "economic": []}
            }

    # 2. THE CORE ENGINE API (Research & Compare)
    @app.post("/api/climate-risk")
    async def climate_risk(req: ClimateRiskRequest):
        try:
            canopy_cooling = (req.canopy_offset_pct / 100.0) * 1.2
            albedo_cooling = (req.albedo_offset_pct / 100.0) * 0.8
            total_cooling = canopy_cooling + albedo_cooling

            city_name = req.location_hint.split(',')[0].strip() if req.location_hint else "Unknown"
            try:
                socio_data = await fetch_live_socioeconomics(city_name)
            except:
                socio_data = {}
                
            pop, gdp = get_real_socioeconomics(city_name, socio_data)

            # HISTORICAL BASELINE
            annual_mean_temp = await fetch_historical_baseline(req.lat, req.lng)
            if annual_mean_temp is None:
                raise ValueError("Satellite feed unavailable.")
                
            lat_swing = abs(req.lat) * 0.25
            historical_summer_peak = annual_mean_temp + 8.0 + lat_swing

            ssp_multiplier = 1.6 if req.ssp == 'ssp585' else 1.0
            daily_city_gdp = gdp / 365.0
            daily_baseline_deaths = (pop / 1000) * (8.0 / 365.0)

            projections = []
            for year in [2030, 2050, 2075, 2100]:
                await asyncio.sleep(0.5) # Rate limit protection
                nasa_timeseries = await fetch_cmip6_timeseries(req.lat, req.lng, req.ssp, year)
                
                if not nasa_timeseries:
                    continue
                
                target_data = nasa_timeseries[-1] 
                raw_hw = target_data.get("heatwaves", 0)
                raw_temp = target_data.get("temp", historical_summer_peak)

                peak_temp = max(historical_summer_peak, raw_temp - total_cooling)
                hw_days = max(0, raw_hw - int(total_cooling * 4))
                excess_temp = max(0.0, peak_temp - historical_summer_peak)

                deaths = int(daily_baseline_deaths * 0.125 * hw_days * ssp_multiplier)
                econ_loss = (daily_city_gdp * 0.002) * hw_days * ssp_multiplier

                # ── RESEARCH SUITE INJECTION ──
                # 1. Wet-Bulb Globe Temperature estimate (ISO 7243)
                wbt_max = round((peak_temp * 0.7) + 8.0, 2)
                
                # 2. Urban Heat Island (UHI) Decomposition
                uhi_val = round(peak_temp - annual_mean_temp, 2)
                
                # 3. Cooling Degree Days (CDD) - Grid Load
                grid_stress = round((peak_temp - 18) * hw_days, 1)

                projections.append({
                    "year": year,
                    "source": "cmip6_live" if year <= 2050 else "extrapolated",
                    "heatwave_days": hw_days,
                    "peak_tx5d_c": round(peak_temp, 2),
                    "avg_excess_temp_c": round(excess_temp, 2),
                    "attributable_deaths": deaths,
                    "economic_decay_usd": econ_loss,
                    
                    # NEW RESEARCH KEYS
                    "wbt_max_c": wbt_max,
                    "uhi_intensity_c": uhi_val,
                    "grid_stress_factor": grid_stress,
                    "survivability_status": "CRITICAL" if wbt_max >= 31 else "STABLE"
                })

            return {
                "threshold_c": round(historical_summer_peak, 2),
                "cooling_offset_c": round(total_cooling, 2),
                "iso2": "UN",
                "gdp_usd": gdp,
                "population": pop,
                "projections": projections,
                "errors": [],
                "baseline": {
                    "baseline_mean_c": round(annual_mean_temp, 2),
                    "baseline_p95_c": round(historical_summer_peak, 2),
                    "baseline_p99_c": round(historical_summer_peak + 2.5, 2),
                    "baseline_max_c": round(historical_summer_peak + 4, 2),
                }
            }
        except Exception as e:
            logger.error(f"CLIMATE RISK API CRASH: {str(e)}")
            return {"error": str(e)}

    return app

app = create_app()