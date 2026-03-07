"""
climate_engine/api/main.py — Final Bulletproof Architecture with AI Auditor
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

# SERVICES
from climate_engine.services.cmip6_service import fetch_cmip6_timeseries, fetch_historical_baseline
from climate_engine.services.socioeconomic_service import fetch_live_socioeconomics
from climate_engine.services.llm_service import generate_strategic_analysis, generate_strategic_analysis_raw

logger = logging.getLogger(__name__)

# --- PERMANENT ILAAJ: GLOBAL SEMAPHORE ---
rate_limit_lock = asyncio.Semaphore(1) 

# ─── DATA MODELS ────────────────────────────────────────────────────────

class PredictionRequest(BaseModel):
    city: str
    lat: float
    lng: float
    ssp: str
    year: str
    canopy: int
    coolRoof: int

class ClimateRiskRequest(BaseModel):
    lat: float
    lng: float
    elevation: float = 0.0
    ssp: str
    canopy_offset_pct: int
    albedo_offset_pct: int
    location_hint: str = ""

# NEW: RESEARCH & COMPARE EXPERT AI REQUEST
class ResearchAIRequest(BaseModel):
    city_name: str
    metrics: Dict[str, Any]
    context: str # "Compare" or "DeepDive"

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
    raise ValueError(f"Socioeconomic data missing for {city_name}.")

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

    # --- NEW: RESEARCH & COMPARE EXPERT AI ENDPOINT ---
    @app.post("/api/research-analysis")
    async def research_analysis(req: ResearchAIRequest):
        import re
        
        # Check if it's Compare mode or Single City mode
        is_compare = " vs " in req.city_name
        mode_text = "COMPARATIVE SCIENTIFIC AUDIT" if is_compare else "SCIENTIFIC AUDIT"
        
        prompt = f"""
        [SYSTEM: {mode_text} MODE]
        Write a cohesive, professional 3-sentence executive summary analyzing the climate risk for {req.city_name}.
        
        METRICS PROVIDED:
        - Temperatures: {req.metrics.get('temp')}
        - Elevations: {req.metrics.get('elevation')}
        - Heatwave Days: {req.metrics.get('heatwave')}
        - Economic Loss: {req.metrics.get('loss')}
        
        STRICT RULES (FAILURE IS NOT AN OPTION):
        1. Write exactly ONE flowing paragraph. MAXIMUM 3-4 sentences.
        2. DO NOT use lists (1., 2.), bullet points, or newlines.
        3. DO NOT say "model is not applicable" or "cannot be evaluated". Act like an expert interpreting the data directly.
        4. If comparing, clearly state which city has higher economic or thermal exposure based strictly on the numbers.
        5. Write like a Senior IPCC Climate Scientist. Keep it authoritative and dense.
        """
        
        try:
            analysis = await generate_strategic_analysis_raw(prompt)
            
            # --- BACKEND CLEANING (Extra Safety) ---
            # 1. Remove all asterisks
            clean_analysis = analysis.replace("**", "").replace("*", "")
            # 2. Remove line breaks to force a single paragraph
            clean_analysis = clean_analysis.replace("\n", " ").strip()
            # 3. Use Regex to remove robotic numbering like "1. ", "2. ", "3. "
            clean_analysis = re.sub(r'\b\d+\.\s', '', clean_analysis)
            
            return {"reasoning": clean_analysis}
            
        except Exception as e:
            return {"reasoning": "Scientific reasoning currently unavailable due to thermal processing load."}

    # 1. THE DASHBOARD API
    @app.post("/api/predict", response_model=SimulationResponse)
    async def predict(req: PredictionRequest):
        async with rate_limit_lock:
            try:
                await asyncio.sleep(1.0)
                annual_mean_temp = await fetch_historical_baseline(req.lat, req.lng)
                historical_summer_peak = annual_mean_temp + 8.0 + (abs(req.lat) * 0.25)
                
                target_year = int(req.year)
                nasa_timeseries = await fetch_cmip6_timeseries(req.lat, req.lng, req.ssp, target_year)
                
                try: socio_data = await fetch_live_socioeconomics(req.city)
                except: socio_data = {}
                live_pop, live_gdp = get_real_socioeconomics(req.city, socio_data)
                
                total_cooling = (req.canopy / 100.0 * 1.2) + (req.coolRoof / 100.0 * 0.8)
                
                heatwave_chart, economic_chart = [], []
                ssp_multiplier = 1.5 if req.ssp == "SSP5-8.5" else 1.0

                for data_point in nasa_timeseries:
                    yr = str(data_point["year"])
                    adapted_hw = max(0, data_point["heatwaves"] - int(total_cooling * 4))
                    raw_loss_frac = (data_point["heatwaves"] / 365.0) * 0.04 * ssp_multiplier
                    adapted_loss_frac = (adapted_hw / 365.0) * 0.04 * ssp_multiplier
                    
                    heatwave_chart.append({"year": yr, "val": adapted_hw})
                    economic_chart.append({
                        "year": yr, 
                        "noAction": round((live_gdp * raw_loss_frac) / 1000000, 1), 
                        "adapt": round((live_gdp * adapted_loss_frac) / 1000000, 1)
                    })
                
                target_data = nasa_timeseries[-1]
                final_hw = max(0, target_data["heatwaves"] - int(total_cooling * 4))
                final_temp = max(historical_summer_peak, target_data.get("temp", historical_summer_peak) - total_cooling)
                deaths = int((live_pop/1000) * (8.0/365.0) * 0.125 * final_hw * ssp_multiplier)
                
                intensity_multiplier = 1.0 + (max(0.0, final_temp - historical_summer_peak) * 0.15)
                final_loss_usd = live_gdp * (final_hw / 365.0) * 0.04 * intensity_multiplier * ssp_multiplier

                return {
                    "metrics": {
                        "baseTemp": str(round(historical_summer_peak, 1)),
                        "temp": f"{final_temp:.1f}",
                        "deaths": f"{deaths:,}",
                        "ci": f"{int(deaths*0.88):,} - {int(deaths*1.15):,}",
                        "loss": f"${final_loss_usd/1e9:.2f}B" if final_loss_usd > 1e9 else f"${final_loss_usd/1e6:.1f}M",
                        "heatwave": str(final_hw)
                    },
                    "hexGrid": [{"position": [req.lng + random.gauss(0, 0.06), req.lat + random.gauss(0, 0.06)]} for _ in range(1200)],
                    "aiAnalysis": await generate_strategic_analysis(req.city, req.ssp, req.year, req.canopy, req.coolRoof, final_temp, final_hw, deaths, final_loss_usd),
                    "charts": {"heatwave": heatwave_chart, "economic": economic_chart}
                }
            except Exception as e:
                return {"metrics": {"baseTemp": "ERR", "temp": "ERR", "deaths": "ERR", "ci": "ERR", "loss": "ERR", "heatwave": "ERR"}, "hexGrid": [], "aiAnalysis": None, "charts": {"heatwave": [], "economic": []}}

    # 2. THE RESEARCH ENGINE API
    @app.post("/api/climate-risk")
    async def climate_risk(req: ClimateRiskRequest):
        async with rate_limit_lock:
            try:
                await asyncio.sleep(1.5) 
                annual_mean_temp = await fetch_historical_baseline(req.lat, req.lng)
                if annual_mean_temp is None: raise ValueError("Baseline feed unavailable")
                
                historical_summer_peak = annual_mean_temp + 8.0 + (abs(req.lat) * 0.25)
                total_cooling = (req.canopy_offset_pct / 100.0 * 1.2) + (req.albedo_offset_pct / 100.0 * 0.8)
                
                city_name = req.location_hint.split(',')[0].strip()
                socio_data = await fetch_live_socioeconomics(city_name)
                pop, gdp = get_real_socioeconomics(city_name, socio_data)

                ssp_multiplier = 1.6 if req.ssp == 'ssp585' else 1.0
                projections = []

                for year in [2030, 2050, 2075, 2100]:
                    nasa_timeseries = None
                    for attempt in range(5):
                        try:
                            wait_time = 2.0 + (attempt * 2.0)
                            await asyncio.sleep(wait_time) 
                            nasa_timeseries = await fetch_cmip6_timeseries(req.lat, req.lng, req.ssp, year)
                            if nasa_timeseries: break
                        except Exception as e:
                            if "429" in str(e): continue
                            raise e

                    if not nasa_timeseries: continue
                    
                    target_data = nasa_timeseries[-1] 
                    peak_temp = max(historical_summer_peak, target_data.get("temp", historical_summer_peak) - total_cooling)
                    hw_days = max(0, target_data.get("heatwaves", 0) - int(total_cooling * 4))

                    intensity_multiplier = 1.0 + (max(0.0, peak_temp - historical_summer_peak) * 0.15) 
                    econ_loss = gdp * (hw_days / 365.0) * 0.04 * intensity_multiplier * ssp_multiplier

                    wbt_max = round((peak_temp * 0.7) + 8.0, 2)
                    projections.append({
                        "year": year,
                        "source": "cmip6_live" if year <= 2050 else "extrapolated",
                        "heatwave_days": hw_days,
                        "peak_tx5d_c": round(peak_temp, 2),
                        "attributable_deaths": int((pop/1000)*(8.0/365.0)*0.125*hw_days*ssp_multiplier),
                        "economic_decay_usd": econ_loss,
                        "wbt_max_c": wbt_max,
                        "uhi_intensity_c": round(peak_temp - annual_mean_temp, 2),
                        "grid_stress_factor": round((peak_temp - 18) * hw_days, 1),
                        "survivability_status": "CRITICAL" if wbt_max >= 31 else "STABLE"
                    })

                return {
                    "threshold_c": round(historical_summer_peak, 2),
                    "cooling_offset_c": round(total_cooling, 2),
                    "gdp_usd": gdp,
                    "population": pop,
                    "projections": projections,
                    "baseline": {"baseline_mean_c": round(annual_mean_temp, 2)}
                }
            except Exception as e:
                logger.error(f"Permanent Shield Alert: {str(e)}")
                return {"error": "Server is busy protecting your connection."}

    return app

app = create_app()