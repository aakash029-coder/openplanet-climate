import logging
import math
import re
import asyncio
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from climate_engine.services.cmip6_service import (
    fetch_historical_baseline_full,
    fetch_cmip6_projection,
)
from climate_engine.services.socioeconomic_service import fetch_live_socioeconomics
from climate_engine.services.llm_service import (
    generate_strategic_analysis,
    generate_strategic_analysis_raw,
    generate_compare_analysis,
)

# Relative imports bridging the separation
from .schemas import (
    PredictionRequest,
    ClimateRiskRequest,
    ResearchAIRequest,
    CompareAnalysisRequest,
    SimulationResponse
)
from .physics import (
    _fetch_era5_humidity_p95,
    _fetch_relative_humidity_live,
    _stull_wetbulb,
    _get_region_profile,
    _apply_regional_calibration,
    _fetch_worldbank_death_rate,
    _gasparrini_mortality,
    _burke_economic_loss,
    _build_audit_trail,
    _generate_topological_grid,
    ISO3_MAP
)

logger = logging.getLogger(__name__)

def create_app() -> FastAPI:
    app = FastAPI(title="OpenPlanet Climate Engine")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    async def root():
        return {"status": "OpenPlanet Risk Engine — Honest Physics + Gaussian Grid"}

    @app.post("/api/research-analysis")
    async def research_analysis(req: ResearchAIRequest):
        prompt = f"""
[SYSTEM: SCIENTIFIC AUDIT MODE]
Write a cohesive 3-4 sentence executive summary for {req.city_name}.
REAL METRICS (Open-Meteo ERA5 + CMIP6 + World Bank + Regional Calibration):
- Peak Tx5d: {req.metrics.get('temp')}
- Elevation: {req.metrics.get('elevation')}
- Annual heatwave/heat-stress days: {req.metrics.get('heatwave')}
- Economic loss (Burke 2018 + ILO): {req.metrics.get('loss')}
RULES: ONE paragraph. No lists. No bullets. Authoritative IPCC scientist tone. Use exact numbers provided.
"""
        try:
            raw   = await generate_strategic_analysis_raw(prompt)
            clean = raw.replace("**", "").replace("*", "").replace("\n", " ").strip()
            clean = re.sub(r'\b\d+\.\s', '', clean)
            return {"reasoning": clean}
        except Exception as e:
            logger.error(f"AI error: {e}")
            return {"reasoning": "Scientific reasoning temporarily unavailable."}

    @app.post("/api/compare-analysis")
    async def compare_analysis(req: CompareAnalysisRequest):
        try:
            comparison = await generate_compare_analysis(
                city_a=req.city_a, city_b=req.city_b,
                data_a=req.data_a, data_b=req.data_b,
            )
            return {"comparison": comparison}
        except Exception as e:
            logger.error(f"Compare analysis error: {e}")
            return {"comparison": "Comparative analysis temporarily unavailable."}

    @app.post("/api/predict", response_model=SimulationResponse)
    async def predict(req: PredictionRequest):
        try:
            target_year   = int(req.year)
            total_cooling = (req.canopy / 100.0 * 1.2) + (req.coolRoof / 100.0 * 0.8)

            baseline = await fetch_historical_baseline_full(req.lat, req.lng)
            p95      = baseline["p95_threshold_c"]
            ann_mean = baseline["annual_mean_c"]

            try:
                socio = await fetch_live_socioeconomics(req.city)
            except Exception as e:
                logger.error(f"Socio failed: {e}")
                socio = {"population": 5_000_000, "city_gdp_usd": 50_000_000_000, "country_code": "UN", "vulnerability_multiplier": 1.0}

            pop  = socio["population"]
            gdp  = socio["city_gdp_usd"]
            iso2 = socio.get("country_code", "UN")
            iso3 = ISO3_MAP.get(iso2, iso2)
            vuln = socio.get("vulnerability_multiplier", 1.0)

            death_rate, rh_live, rh_p95 = await asyncio.gather(
                _fetch_worldbank_death_rate(iso3),
                _fetch_relative_humidity_live(req.lat, req.lng),
                _fetch_era5_humidity_p95(req.lat, req.lng),
            )

            profile     = _get_region_profile(req.lat, req.lng, rh_p95, ann_mean)
            chart_years = sorted({2030, 2040, 2050, target_year})
            chart_years = [y for y in chart_years if 2015 <= y <= 2100]
            fetch_years = [y for y in chart_years if y <= 2050]

            results = await asyncio.gather(*[
                fetch_cmip6_projection(req.lat, req.lng, req.ssp, yr, p95, total_cooling)
                for yr in fetch_years
            ], return_exceptions=True)

            projections = {}
            proj_2050   = None
            for yr, res in zip(fetch_years, results):
                if not isinstance(res, Exception):
                    projections[yr] = res
                    if yr == 2050: proj_2050 = res

            for yr in chart_years:
                if yr > 2050 and proj_2050:
                    decades = (yr - 2050) / 10.0
                    extreme = req.ssp.lower() in ["ssp585", "ssp5-8.5"]
                    if extreme:
                        t_add   = (0.35 * decades) + (0.04 * (decades ** 2))
                        hw_mult = (0.20 * decades) + (0.03 * (decades ** 2))
                    else:
                        t_add   = 0.25 * decades * math.log1p(decades/2.0)
                        hw_mult = 0.15 * decades * math.log1p(decades/2.0)
                    projections[yr] = {
                        "tx5d_c":      proj_2050["tx5d_c"] + t_add,
                        "hw_days":     min(365, proj_2050["hw_days"] * (1 + hw_mult)),
                        "mean_temp_c": proj_2050["mean_temp_c"] + t_add,
                        "hw_days_raw": min(365, proj_2050.get("hw_days_raw", proj_2050["hw_days"]) * (1 + hw_mult)),
                        "source":      "ipcc_ar6_extrapolation",
                        "n_models":    proj_2050.get("n_models", 1),
                    }

            heatwave_chart, economic_chart = [], []
            for yr in chart_years:
                if yr not in projections: continue
                proj    = projections[yr]
                uhi_raw = proj["tx5d_c"] - baseline["annual_mean_c"]
                _, hw_cal, _ = _apply_regional_calibration(proj["tx5d_c"], proj.get("hw_days_raw", proj["hw_days"]), profile, rh_p95, uhi_raw)
                loss     = _burke_economic_loss(gdp, proj["mean_temp_c"], hw_cal)
                loss_mit = _burke_economic_loss(gdp, proj["mean_temp_c"], proj["hw_days"])
                heatwave_chart.append({"year": str(yr), "val": int(hw_cal)})
                economic_chart.append({
                    "year":     str(yr),
                    "noAction": round(loss / 1_000_000, 1),
                    "adapt":    round(loss_mit / 1_000_000, 1),
                })

            if target_year not in projections:
                raise ValueError(f"Target year {target_year} failed")

            tgt            = projections[target_year]
            uhi_raw        = tgt["tx5d_c"] - baseline["annual_mean_c"]
            tx5d_cal, hw_cal, uhi_cal = _apply_regional_calibration(tgt["tx5d_c"], tgt["hw_days"], profile, rh_p95, uhi_raw)
            temp_excess    = max(0.0, tx5d_cal - p95)
            deaths         = _gasparrini_mortality(pop, death_rate, temp_excess, hw_cal, vuln)
            final_loss     = _burke_economic_loss(gdp, tgt["mean_temp_c"], hw_cal)
            wbt_projection = _stull_wetbulb(tx5d_cal, rh_p95, profile["is_desert"], profile["is_tropical"])
            wbt_display    = _stull_wetbulb(tx5d_cal, rh_live, profile["is_desert"], profile["is_tropical"])
            loss_str       = f"${final_loss/1e9:.2f}B" if final_loss >= 1e9 else f"${final_loss/1e6:.1f}M"
            audit          = _build_audit_trail(pop, death_rate, hw_cal, temp_excess, vuln, gdp, tgt["mean_temp_c"], tx5d_cal, rh_p95)

            try:
                ai = await generate_strategic_analysis(req.city, req.ssp, req.year, req.canopy, req.coolRoof, round(tx5d_cal, 1), int(hw_cal), deaths, final_loss)
            except Exception:
                ai = None

            hex_grid = await _generate_topological_grid(req.lat, req.lng, hw_cal, tx5d_cal)

            return {
                "metrics": {
                    "baseTemp": str(baseline["tx5d_baseline_c"]),
                    "temp":     f"{tx5d_cal:.1f}",
                    "deaths":   f"{deaths:,}",
                    "ci":       f"{int(deaths*0.85):,} – {int(deaths*1.18):,}",
                    "loss":     loss_str,
                    "heatwave": str(int(hw_cal)),
                    "wbt":      f"{wbt_projection:.1f}",
                    "wbt_live": f"{wbt_display:.1f}",
                    "region":   profile["region"],
                    "rh_p95":   rh_p95,
                    "rh_live":  rh_live,
                },
                "hexGrid":    hex_grid,
                "aiAnalysis": ai,
                "auditTrail": audit,
                "charts": {"heatwave": heatwave_chart, "economic": economic_chart},
            }

        except Exception as e:
            logger.error(f"/api/predict error: {e}")
            return {
                "metrics": {
                    "baseTemp": None, "temp": None, "deaths": None, "ci": None,
                    "loss": None, "heatwave": None, "wbt": None, "wbt_live": None,
                    "region": "ERROR", "rh_p95": None, "rh_live": None
                },
                "hexGrid":    [],
                "aiAnalysis": None,
                "auditTrail": None,
                "charts":     {"heatwave": [], "economic": []},
            }

    @app.post("/api/climate-risk")
    async def climate_risk(req: ClimateRiskRequest):
        try:
            total_cooling = (req.canopy_offset_pct/100.0*1.2) + (req.albedo_offset_pct/100.0*0.8)
            baseline      = await fetch_historical_baseline_full(req.lat, req.lng)
            p95           = baseline["p95_threshold_c"]
            ann_mean      = baseline["annual_mean_c"]

            city_name = req.location_hint.split(',')[0].strip() or "Unknown"
            try:
                socio = await fetch_live_socioeconomics(city_name)
            except Exception as e:
                logger.error(f"Socio failed: {e}")
                socio = {"population": 5_000_000, "city_gdp_usd": 50_000_000_000, "country_code": "UN", "vulnerability_multiplier": 1.0}

            pop  = socio["population"]
            gdp  = socio["city_gdp_usd"]
            iso2 = socio.get("country_code", "UN")
            iso3 = ISO3_MAP.get(iso2, iso2)
            vuln = socio.get("vulnerability_multiplier", 1.0)

            death_rate, rh_p95 = await asyncio.gather(
                _fetch_worldbank_death_rate(iso3),
                _fetch_era5_humidity_p95(req.lat, req.lng),
            )

            profile = _get_region_profile(req.lat, req.lng, rh_p95, ann_mean)

            res_2030, res_2050 = await asyncio.gather(
                fetch_cmip6_projection(req.lat, req.lng, req.ssp, 2030, p95, total_cooling),
                fetch_cmip6_projection(req.lat, req.lng, req.ssp, 2050, p95, total_cooling),
                return_exceptions=True,
            )

            base_projs = {}
            if not isinstance(res_2030, Exception): base_projs[2030] = res_2030
            if not isinstance(res_2050, Exception): base_projs[2050] = res_2050

            projections = []
            for year in [2030, 2050, 2075, 2100]:
                try:
                    if year <= 2050:
                        if year not in base_projs: raise ValueError(f"Year {year} failed")
                        proj = base_projs[year]
                    else:
                        if 2050 not in base_projs: raise ValueError("No 2050 base")
                        decades = (year - 2050) / 10.0
                        extreme = req.ssp.lower() in ["ssp585", "ssp5-8.5"]
                        if extreme:
                            t_add   = (0.35 * decades) + (0.04 * (decades ** 2))
                            hw_mult = (0.20 * decades) + (0.03 * (decades ** 2))
                        else:
                            t_add   = 0.25 * decades * math.log1p(decades/2.0)
                            hw_mult = 0.15 * decades * math.log1p(decades/2.0)
                        b    = base_projs[2050]
                        proj = {
                            "tx5d_c":      b["tx5d_c"] + t_add,
                            "hw_days":     min(365, b["hw_days"] * (1 + hw_mult)),
                            "mean_temp_c": b["mean_temp_c"] + t_add,
                            "source":      "ipcc_ar6_extrapolation",
                            "n_models":    b.get("n_models", 1),
                        }

                    uhi_raw     = proj["tx5d_c"] - baseline["annual_mean_c"]
                    tx5d_cal, hw_cal, uhi_cal = _apply_regional_calibration(proj["tx5d_c"], proj["hw_days"], profile, rh_p95, uhi_raw)
                    temp_excess = max(0.0, tx5d_cal - p95)
                    deaths      = _gasparrini_mortality(pop, death_rate, temp_excess, hw_cal, vuln)
                    econ_loss   = _burke_economic_loss(gdp, proj["mean_temp_c"], hw_cal)
                    cdd         = round(max(0.0, proj["mean_temp_c"] - 18.0) * hw_cal, 1)
                    wbt         = _stull_wetbulb(tx5d_cal, rh_p95, profile["is_desert"], profile["is_tropical"])
                    audit       = _build_audit_trail(pop, death_rate, hw_cal, temp_excess, vuln, gdp, proj["mean_temp_c"], tx5d_cal, rh_p95)

                    projections.append({
                        "year":                year,
                        "source":              proj["source"],
                        "heatwave_days":       int(hw_cal),
                        "peak_tx5d_c":         round(tx5d_cal, 2),
                        "attributable_deaths": deaths,
                        "economic_decay_usd":  round(econ_loss, 2),
                        "wbt_max_c":           wbt,
                        "uhi_intensity_c":     uhi_cal,
                        "grid_stress_factor":  cdd,
                        "survivability_status": ("CRITICAL" if wbt >= 31 else "DANGER" if wbt >= 28 else "STABLE"),
                        "n_models":    proj.get("n_models", 1),
                        "region":      profile["region"],
                        "audit_trail": audit,
                    })

                except Exception as e:
                    logger.warning(f"climate-risk year {year} failed: {e}")

            if not projections:
                raise ValueError("All projection years failed.")

            return {
                "threshold_c":       baseline["p95_threshold_c"],
                "tx5d_baseline_c":   baseline["tx5d_baseline_c"],
                "cooling_offset_c":  round(total_cooling, 2),
                "gdp_usd":           gdp,
                "population":        pop,
                "projections":       projections,
                "baseline":          {"baseline_mean_c": baseline["annual_mean_c"]},
                "era5_humidity_p95": rh_p95,
            }

        except Exception as e:
            logger.error(f"/api/climate-risk error: {e}")
            return {"error": str(e)}

    return app

app = create_app()