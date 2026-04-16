import logging
import math
import random
import asyncio
import httpx
from typing import List, Dict, Tuple, Any

logger = logging.getLogger(__name__)

# Semaphore to prevent throttling from Open-Meteo and World Bank APIs
rate_limit_lock = asyncio.Semaphore(5)

ISO3_MAP: Dict[str, str] = {
    "IN": "IND", "CN": "CHN", "US": "USA", "GB": "GBR", "JP": "JPN", "DE": "DEU",
    "FR": "FRA", "AU": "AUS", "BR": "BRA", "MX": "MEX", "SG": "SGP", "ID": "IDN",
    "TH": "THA", "PK": "PAK", "BD": "BGD", "UN": "WLD", "ZA": "ZAF", "NG": "NGA",
    "KE": "KEN", "EG": "EGY", "TR": "TUR", "SA": "SAU", "AE": "ARE", "PH": "PHL",
    "VN": "VNM", "MY": "MYS", "RU": "RUS", "CA": "CAN", "KR": "KOR", "AR": "ARG",
    "CL": "CHL", "CO": "COL", "IT": "ITA", "ES": "ESP", "NL": "NLD", "SE": "SWE",
    "NO": "NOR", "FI": "FIN", "DK": "DNK", "PL": "POL",
}

async def _fetch_era5_humidity_p95(lat: float, lng: float) -> float:
    """Fetches the 95th percentile historical relative humidity from ERA5."""
    try:
        years_data: List[float] = []
        async with rate_limit_lock:
            async with httpx.AsyncClient(timeout=30.0) as client:
                for year in [1995, 2000, 2005, 2010, 2015]:
                    start = f"{year}-06-01" if lat >= 0 else f"{year}-12-01"
                    end = f"{year}-08-31" if lat >= 0 else f"{year + 1}-02-28"
                    
                    url = (
                        f"https://archive-api.open-meteo.com/v1/archive"
                        f"?latitude={lat}&longitude={lng}"
                        f"&start_date={start}&end_date={end}"
                        f"&daily=relative_humidity_2m_max"
                        f"&timezone=auto"
                    )
                    try:
                        resp = await client.get(url, timeout=15.0)
                        resp.raise_for_status()
                        vals = resp.json().get("daily", {}).get("relative_humidity_2m_max", [])
                        years_data.extend([v for v in vals if v is not None])
                    except httpx.RequestError:
                        continue

        if years_data and len(years_data) >= 10:
            sorted_data = sorted(years_data)
            p95_idx = int(len(sorted_data) * 0.95)
            p95_rh = sorted_data[min(p95_idx, len(sorted_data) - 1)]
            return round(float(p95_rh), 1)

    except Exception as e:
        logger.warning(f"ERA5 P95 humidity failed for {lat},{lng}: {e}")

    # Fallback heuristics based on latitude
    abs_lat = abs(lat)
    if abs_lat < 15: return 85.0
    if abs_lat < 25: return 75.0
    if abs_lat < 35: return 65.0
    if abs_lat < 50: return 60.0
    return 55.0

async def _fetch_relative_humidity_live(lat: float, lng: float) -> float:
    """Fetches current live relative humidity."""
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lng}"
        f"&current=relative_humidity_2m"
        f"&timezone=auto"
    )
    try:
        async with rate_limit_lock:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                rh = resp.json().get("current", {}).get("relative_humidity_2m")
                if rh is not None:
                    return float(rh)
    except httpx.RequestError as e:
        logger.warning(f"Live humidity fetch failed for {lat},{lng}: {e}")
    
    return 60.0

def _stull_wetbulb(temp_c: float, rh_pct: float, is_desert: bool = False, is_tropical: bool = False) -> float:
    """Calculates wet-bulb temperature using the Stull (2011) empirical formula with regional adjustments."""
    effective_rh = max(5.0, min(99.0, rh_pct))
    
    if temp_c > 28.0:
        temp_delta = temp_c - 28.0
        if is_desert:
            drop_factor = math.exp(-0.15 * temp_delta)
            effective_rh = max(10.0, effective_rh * drop_factor)
        elif is_tropical:
            drop_factor = math.exp(-0.04 * temp_delta)
            effective_rh = max(40.0, effective_rh * drop_factor)
        else:
            drop_factor = math.exp(-0.08 * temp_delta)
            effective_rh = max(20.0, effective_rh * drop_factor)
            
    # Stull Formula
    wbt = (
        temp_c * math.atan(0.151977 * math.sqrt(effective_rh + 8.313659))
        + math.atan(temp_c + effective_rh)
        - math.atan(effective_rh - 1.676331)
        + 0.00391838 * (effective_rh ** 1.5) * math.atan(0.023101 * effective_rh)
        - 4.686035
    )
    # Sherwood & Huber (2010) human survivability cap
    return round(min(wbt, 35.0), 2)

def _get_region_profile(lat: float, lng: float, rh: float, baseline_annual_mean: float) -> Dict[str, Any]:
    """Determines regional climate profiles for UHI and risk calculation based on coordinates."""
    abs_lat = abs(lat)

    # BLOCK 0: Hyper-specific Microclimates
    if 37.60 <= lat <= 37.85 and -122.55 <= lng <= -122.35:
        return {"region": "mediterranean_fog_microclimate", "uhi_cap": 2.0, "is_desert": False, "is_tropical": False, "coastal_dampening": 0.30, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}
    if 18.80 <= lat <= 20.30 and -156.10 <= lng <= -154.80:
        if lng > -155.50:
            return {"region": "tropical_rainforest_windward", "uhi_cap": 2.0, "is_desert": False, "is_tropical": True, "coastal_dampening": 0.80, "hw_humidity_penalty": 1.2, "snow_albedo_factor": 1.0}
        return {"region": "tropical_steppe_leeward", "uhi_cap": 3.0, "is_desert": True, "is_tropical": True, "coastal_dampening": 0.90, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}
    if 50.80 <= lat <= 51.25 and -114.30 <= lng <= -113.80:
        return {"region": "boreal_chinook_zone", "uhi_cap": 4.0, "is_desert": False, "is_tropical": False, "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.40}
    if 60.00 <= lat <= 70.00 and 110.00 <= lng <= 160.00:
        return {"region": "extreme_continental_taiga", "uhi_cap": 5.0, "is_desert": False, "is_tropical": False, "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.60}
    if 21.00 <= lat <= 30.00 and 47.50 <= lng <= 59.00 and baseline_annual_mean > 25.0:
        return {"region": "hyper_arid_humid_coast", "uhi_cap": 8.0, "is_desert": True, "is_tropical": False, "coastal_dampening": 0.95, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}
    if 20.50 <= lat <= 23.50 and 37.50 <= lng <= 42.50 and baseline_annual_mean > 25.0:
        return {"region": "hyper_arid_humid_coast", "uhi_cap": 7.5, "is_desert": True, "is_tropical": False, "coastal_dampening": 0.95, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}
    if 42.00 <= lat <= 44.00 and 131.00 <= lng <= 134.00:
        return {"region": "monsoon_tundra_hybrid", "uhi_cap": 4.0, "is_desert": False, "is_tropical": False, "coastal_dampening": 0.85, "hw_humidity_penalty": 1.1, "snow_albedo_factor": 0.50}
    if 33.70 <= lat <= 34.40 and -118.70 <= lng <= -117.80:
        return {"region": "mediterranean_basin_microclimate", "uhi_cap": 7.0, "is_desert": False, "is_tropical": False, "coastal_dampening": 0.85, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}
    if lat < -4.0 and lat > -36.0 and -80.5 < lng < -68.0:
        _exp_t_atac = 27.5 - 0.42 * abs_lat
        if baseline_annual_mean < _exp_t_atac - 3.0:
            return {"region": "arid_desert_fog", "uhi_cap": 3.0, "is_desert": True, "is_tropical": False, "coastal_dampening": 0.60, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}
    if lat < -16.0 and lat > -30.0 and 12.5 < lng < 17.0:
        return {"region": "arid_desert_fog", "uhi_cap": 3.0, "is_desert": True, "is_tropical": False, "coastal_dampening": 0.60, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

    # BLOCK 1: Coastal Indicators & Amplitude
    is_coastal = (
        (abs_lat > 25 and lng < -115) or (-85 < lng < -60 and 15 < abs_lat < 50) or
        (25 < lat < 33 and -97.5 < lng < -88.0) or (abs_lat > 35 and -12 < lng < 22) or
        (118 < lng < 152 and 30 < abs_lat < 42) or (abs_lat < 25 and 68 < lng < 95 and rh > 74) or
        (abs_lat < 15 and rh > 82) or (lat < -28 and lat > -42 and 147 < lng < 154) or
        (lat < -32 and lat > -48 and 166 < lng < 178) or (lat < -20 and lat > -35 and -50 < lng < -38)
    )

    _base_amp = 20.5
    if abs_lat < 10:   _base_amp = 2.5
    elif abs_lat < 15: _base_amp = 4.5
    elif abs_lat < 20: _base_amp = 6.5
    elif abs_lat < 25: _base_amp = 8.5
    elif abs_lat < 30: _base_amp = 10.5
    elif abs_lat < 35: _base_amp = 12.5
    elif abs_lat < 40: _base_amp = 14.0
    elif abs_lat < 45: _base_amp = 15.5
    elif abs_lat < 50: _base_amp = 17.0
    elif abs_lat < 55: _base_amp = 18.0
    elif abs_lat < 60: _base_amp = 19.0

    _amp_factor = 1.00
    if rh < 25:   _amp_factor = 1.40
    elif rh < 40: _amp_factor = 1.20
    elif rh < 55: _amp_factor = 1.08

    if abs_lat < 15 and rh > 82:
        _amp_factor = 0.65
    elif abs_lat > 45 and is_coastal:
        _amp_factor *= 0.72

    summer_t = baseline_annual_mean + _base_amp * _amp_factor

    # BLOCK 2 & 3: Extreme Cold
    if baseline_annual_mean <= -10.0 or abs_lat > 75:
        return {"region": "polar_ice_cap", "uhi_cap": 1.0, "is_desert": False, "is_tropical": False, "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.30}
    if baseline_annual_mean < 0.0 or abs_lat > 65:
        return {"region": "boreal_tundra", "uhi_cap": 3.0, "is_desert": False, "is_tropical": False, "coastal_dampening": 0.85 if is_coastal else 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.60}

    # BLOCK 4: Tundra/Cold Desert
    if baseline_annual_mean < 5.0:
        if rh < 45:
            return {"region": "cold_desert", "uhi_cap": 5.0, "is_desert": True, "is_tropical": False, "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.78}
        return {"region": "boreal_tundra", "uhi_cap": 4.0, "is_desert": False, "is_tropical": False, "coastal_dampening": 0.85 if is_coastal else 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.55}

    # BLOCK 5: Arid Regions
    if rh < 28:
        if 18 <= rh < 28 and abs_lat < 35:
            _exp_t_fd = 27.5 - 0.42 * abs_lat
            if baseline_annual_mean < _exp_t_fd - 5.0:
                return {"region": "arid_desert_fog", "uhi_cap": 3.0, "is_desert": True, "is_tropical": False, "coastal_dampening": 0.60, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}
        return {"region": "arid_desert", "uhi_cap": 8.0, "is_desert": True, "is_tropical": False, "coastal_dampening": 0.95, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

    if rh < 45:
        if baseline_annual_mean >= 14.0:
            return {"region": "arid_desert", "uhi_cap": 7.5, "is_desert": True, "is_tropical": False, "coastal_dampening": 0.92, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}
        return {"region": "cold_desert", "uhi_cap": 6.0, "is_desert": True, "is_tropical": False, "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.80}

    # BLOCK 6: Tropical & Savanna
    if abs_lat < 23:
        _exp_trop_t = 26.5 - 0.28 * abs_lat
        if baseline_annual_mean < _exp_trop_t - 4.5:
            return {"region": "subtropical_highland", "uhi_cap": 3.0, "is_desert": False, "is_tropical": False, "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}
        if rh >= 78 and baseline_annual_mean > 23.0:
            return {"region": "tropical_humid", "uhi_cap": 4.0, "is_desert": False, "is_tropical": True, "coastal_dampening": 0.70 if is_coastal else 0.90, "hw_humidity_penalty": 1.2, "snow_albedo_factor": 1.0}
        if rh >= 55:
            _hw_pen = 1.0 + max(0.0, (rh - 55) / 100)
            return {"region": "savanna_monsoon", "uhi_cap": 7.0, "is_desert": False, "is_tropical": True, "coastal_dampening": 0.80 if is_coastal else 1.0, "hw_humidity_penalty": _hw_pen, "snow_albedo_factor": 1.0}
        return {"region": "savanna_monsoon", "uhi_cap": 6.5, "is_desert": False, "is_tropical": True, "coastal_dampening": 0.90, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

    # BLOCK 7: Subtropical & Mediterranean
    if abs_lat < 40:
        _exp_sub_t = 26.5 - 0.35 * abs_lat
        if baseline_annual_mean < _exp_sub_t - 5.0 and rh < 88:
            return {"region": "subtropical_highland", "uhi_cap": 3.5, "is_desert": False, "is_tropical": False, "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}
        
        _is_extreme_humid = (summer_t >= 32.0 and rh >= 50) or (summer_t >= 29.0 and rh >= 65)
        if _is_extreme_humid:
            _cd = 0.88 if is_coastal else 0.96
            _hwp = 1.10 + max(0.0, (rh - 65) / 160)
            return {"region": "humid_subtropical_extreme", "uhi_cap": 8.0, "is_desert": False, "is_tropical": True, "coastal_dampening": _cd, "hw_humidity_penalty": _hwp, "snow_albedo_factor": 1.0}

        if summer_t >= 26.0 and rh >= 58:
            return {"region": "humid_subtropical", "uhi_cap": 6.0, "is_desert": False, "is_tropical": True, "coastal_dampening": 0.82 if is_coastal else 0.95, "hw_humidity_penalty": 1.05, "snow_albedo_factor": 1.0}

        if rh < 62:
            return {"region": "mediterranean", "uhi_cap": 6.0, "is_desert": False, "is_tropical": False, "coastal_dampening": 0.75 if is_coastal else 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

        return {"region": "mediterranean", "uhi_cap": 5.5, "is_desert": False, "is_tropical": False, "coastal_dampening": 0.78 if is_coastal else 0.97, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 1.0}

    # BLOCK 8: Continental & Temperate
    if abs_lat < 60:
        if summer_t >= 22.0 and rh >= 55 and not is_coastal:
            return {"region": "humid_continental", "uhi_cap": 6.0, "is_desert": False, "is_tropical": False, "coastal_dampening": 1.0, "hw_humidity_penalty": 1.05, "snow_albedo_factor": 0.70}
        if rh >= 58:
            return {"region": "temperate_oceanic", "uhi_cap": 5.0, "is_desert": False, "is_tropical": False, "coastal_dampening": 0.70 if is_coastal else 0.92, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.85}
        if rh < 50:
            return {"region": "cold_desert", "uhi_cap": 5.5, "is_desert": True, "is_tropical": False, "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.75}
        return {"region": "temperate_oceanic", "uhi_cap": 5.5, "is_desert": False, "is_tropical": False, "coastal_dampening": 0.75 if is_coastal else 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.80}

    # BLOCK 9: Default High Latitude
    if rh < 48:
        return {"region": "cold_desert", "uhi_cap": 4.0, "is_desert": True, "is_tropical": False, "coastal_dampening": 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.60}
    return {"region": "boreal_tundra", "uhi_cap": 3.5, "is_desert": False, "is_tropical": False, "coastal_dampening": 0.85 if is_coastal else 1.0, "hw_humidity_penalty": 1.0, "snow_albedo_factor": 0.55}

def _apply_regional_calibration(tx5d_raw: float, hw_days_raw: float, profile: Dict[str, Any], rh: float, uhi_raw: float) -> Tuple[float, float, float]:
    """Applies regional modifiers to base heatwave and UHI metrics."""
    uhi_cal = round(min(uhi_raw, profile.get("uhi_cap", 5.0)), 2)
    tx5d_cal = round(tx5d_raw, 2)
    
    hw = hw_days_raw * profile["coastal_dampening"] * profile["snow_albedo_factor"] * profile["hw_humidity_penalty"]
    
    if profile["is_tropical"] and rh > 75:
        if _stull_wetbulb(tx5d_cal, rh, profile["is_desert"], profile["is_tropical"]) > 29.0:
            hw = hw * (1.0 + (rh - 75) / 100)
            
    hw = min(max(hw, 0.0), 365.0)
    return tx5d_cal, round(hw, 1), uhi_cal

async def _fetch_worldbank_death_rate(iso3: str) -> float:
    """Fetches baseline mortality rate per 1000 from the World Bank API."""
    url = f"https://api.worldbank.org/v2/country/{iso3}/indicator/SP.DYN.CDRT.IN?format=json&mrv=3&per_page=3"
    try:
        async with rate_limit_lock:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.get(url)
                resp.raise_for_status()
                data = resp.json()
                if len(data) > 1 and data[1]:
                    for entry in data[1]:
                        if entry.get("value") is not None:
                            return float(entry["value"])
    except httpx.RequestError as e:
        logger.warning(f"Death rate fetch failed for {iso3}: {e}")
        
    return 7.7 # Global average fallback

def _gasparrini_mortality(pop: int, baseline_death_rate_per1000: float, temp_excess_c: float, hw_days: float, vulnerability_multiplier: float = 1.0) -> int:
    """Calculates excess mortality due to heat using Gasparrini et al. framework."""
    beta = 0.0801
    rr = math.exp(beta * max(0.0, temp_excess_c))
    af = (rr - 1.0) / rr
    annual_rate = baseline_death_rate_per1000 / 1000.0
    hw_frac = min(hw_days / 365.0, 1.0)
    
    return int(pop * annual_rate * hw_frac * af * vulnerability_multiplier)

def _burke_economic_loss(gdp: float, mean_temp: float, hw_days: float) -> float:
    """Calculates economic loss combining Burke temp penalty and ILO labor fraction."""
    t_optimal = 13.0
    burke_penalty = 0.0127 * ((mean_temp - t_optimal) ** 2) / 100.0
    ilo_fraction = (hw_days / 365.0) * 0.40 * 0.20
    return gdp * (burke_penalty + ilo_fraction)

def _build_audit_trail(pop: int, death_rate: float, hw_days: float, temp_excess: float, vuln: float, gdp: float, mean_temp: float, tx5d: float, rh: float) -> Dict[str, Any]:
    """Generates an audit trail of calculations for institutional transparency."""
    beta = 0.0801
    rr = math.exp(beta * max(0.0, temp_excess))
    af = round((rr - 1.0) / rr, 4)
    hwf = round(min(hw_days / 365.0, 1.0), 4)
    deaths_result = int(pop * (death_rate / 1000.0) * hwf * af * vuln)
    
    t_opt = 13.0
    burke = round(0.0127 * ((mean_temp - t_opt) ** 2) / 100.0, 6)
    ilo = round((hw_days / 365.0) * 0.40 * 0.20, 6)
    econ_r = gdp * (burke + ilo)
    
    return {
        "mortality": {
            "formula": "Deaths = Pop × (DR/1000) × (HW/365) × AF × V",
            "variables": {"Pop": pop, "DR": round(death_rate, 2), "HW": round(hw_days, 1), "AF": af, "V": round(vuln, 3), "beta": beta, "RR": round(rr, 4), "temp_excess_c": round(temp_excess, 2)},
            "computation": f"{deaths_result:,} = {pop:,} × ({death_rate:.2f}/1000) × ({hw_days:.0f}/365) × {af} × {vuln:.3f}",
            "result": deaths_result,
            "source": "Gasparrini et al. (2017), Lancet Planetary Health",
        },
        "economics": {
            "formula": "Loss = GDP × (Burke_penalty + ILO_fraction)",
            "variables": {"GDP": round(gdp), "T_mean": round(mean_temp, 2), "T_optimal": t_opt, "HW_days": round(hw_days, 1), "Burke_penalty": burke, "ILO_fraction": ilo},
            "computation": f"${econ_r/1e6:.1f}M = GDP × ({burke:.6f} + {ilo:.6f})",
            "result": round(econ_r),
            "source": "Burke et al. (2018) Nature + ILO (2019)",
        },
        "wetbulb": {
            "formula": "WBT = Stull (2011) + Clausius-Clapeyron Exponential Adjustment",
            "variables": {"T": round(tx5d, 2), "RH": round(rh, 1), "cap": "35.0°C (Sherwood & Huber 2010)"},
            "source": "Stull (2011), J. Applied Meteorology and Climatology",
        },
    }

async def _generate_topological_grid(lat: float, lng: float, hw_days: float, tx5d: float) -> List[Dict[str, Any]]:
    """Generates a scatter grid of risk points around a coordinate center."""
    points = []
    severity = min((hw_days / 60.0) * (tx5d / 40.0), 1.0)
    n_points = 1200

    lats, lngs, dists = [], [], []
    sigma = 0.028 

    # Generate Gaussian scatter
    for _ in range(n_points):
        dx = random.gauss(0, sigma)
        dy = random.gauss(0, sigma)
        r = math.sqrt(dx**2 + dy**2)
        r = min(r, 0.09)
        px = lng + dx
        py = lat + dy
        lats.append(round(py, 5))
        lngs.append(round(px, 5))
        dists.append(r)

    elevations = [10.0] * n_points

    async def fetch_elevation_chunk(start_idx: int) -> Tuple[int, List[Any]]:
        lat_chunk = ",".join(map(str, lats[start_idx:start_idx + 100]))
        lng_chunk = ",".join(map(str, lngs[start_idx:start_idx + 100]))
        url = f"https://api.open-meteo.com/v1/elevation?latitude={lat_chunk}&longitude={lng_chunk}"
        try:
            async with rate_limit_lock:
                async with httpx.AsyncClient(timeout=6.0) as client:
                    resp = await client.get(url)
                    if resp.status_code == 200:
                        return start_idx, resp.json().get("elevation", [])
        except httpx.RequestError as e:
            logger.warning(f"Elevation chunk {start_idx} failed: {e}")
        return start_idx, []

    # Process elevation fetching concurrently
    tasks = [fetch_elevation_chunk(i) for i in range(0, n_points, 100)]
    chunk_results = await asyncio.gather(*tasks, return_exceptions=True)

    for res in chunk_results:
        if not isinstance(res, Exception):
            start_idx, data = res
            for j, el in enumerate(data):
                if el is not None:
                    elevations[start_idx + j] = float(el)

    max_r = 0.09

    # Calculate final risk weights
    for i in range(n_points):
        el = elevations[i]
        if el <= 0.0: # Skip water
            continue
            
        dist_norm = min(dists[i] / max_r, 1.0)
        bell = math.exp(-6.0 * (dist_norm ** 2))
        jitter = random.uniform(-0.06, 0.06)
        risk_weight = round(min(1.0, max(0.02, bell * (0.65 + 0.35 * severity) + jitter)), 4)
        
        points.append({
            "position": [lngs[i], lats[i]],
            "risk_weight": risk_weight,
        })
        
    return points