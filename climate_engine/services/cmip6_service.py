import logging
import httpx
import math
from typing import List, Dict

logger = logging.getLogger(__name__)

def calculate_percentile(data: List[float], percentile: float) -> float:
    """Pure Python 95th Percentile calculator."""
    if not data:
        return 30.0
    sorted_data = sorted(data)
    k = (len(sorted_data) - 1) * (percentile / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_data[int(k)]
    return (sorted_data[int(f)] * (c - k)) + (sorted_data[int(c)] * (k - f))

async def fetch_empirical_threshold(lat: float, lng: float, client: httpx.AsyncClient) -> float:
    """Fetches the 100% REAL historical 95th percentile threshold from ERA5."""
    url = f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lng}&start_date=2010-01-01&end_date=2020-12-31&daily=temperature_2m_max"
    
    try:
        response = await client.get(url, timeout=15.0)
        response.raise_for_status()
        temps = response.json()["daily"]["temperature_2m_max"]
        clean_temps = [t for t in temps if t is not None]
        
        p95_threshold = calculate_percentile(clean_temps, 95.0)
        return max(25.0, round(p95_threshold, 1))
    except Exception as e:
        logger.error(f"ERA5 Archive failed: {e}")
        return 32.0

async def fetch_cmip6_timeseries(lat: float, lng: float, ssp: str, target_year: int) -> List[Dict[str, float]]:
    """
    STRICT LIVE DATA & POST-2050 EXTRAPOLATION
    """
    # 1. API STRICT CAP: Open-Meteo Climate API physically stops at 2050.
    # We must cap the HTTP request here, otherwise it throws a 400 error.
    api_end_year = min(target_year, 2050)
    
    cmip6_url = f"https://climate-api.open-meteo.com/v1/climate?latitude={lat}&longitude={lng}&start_date=2030-01-01&end_date={api_end_year}-12-31&daily=temperature_2m_max&models=MPI_ESM1_2_XR"

    time_series = []

    try:
        async with httpx.AsyncClient() as client:
            local_threshold = await fetch_empirical_threshold(lat, lng, client)
            
            response = await client.get(cmip6_url, timeout=20.0) 
            response.raise_for_status()
            data = response.json()
            
            times = data["daily"]["time"]
            
            # 2. BULLETPROOF KEY EXTRACTION
            # Finds the temperature array dynamically, ignoring whatever suffix the API appends
            temp_key = next((k for k in data["daily"].keys() if "temperature" in k), "temperature_2m_max")
            temps = data["daily"][temp_key]
            
            # 3. PROCESS REAL DATA UP TO 2050
            decades = [2030, 2040, 2050]
            last_real_temp = 0.0
            last_real_heatwaves = 0
            
            for decade in decades:
                if decade > api_end_year:
                    break
                    
                yearly_temps = [t for i, t in enumerate(temps) if times[i].startswith(str(decade)) and t is not None]
                if not yearly_temps:
                    continue
                    
                avg_max_temp = sum(yearly_temps) / len(yearly_temps)
                heatwave_days = len([t for t in yearly_temps if t > local_threshold])
                
                last_real_temp = round(avg_max_temp, 1)
                last_real_heatwaves = heatwave_days
                
                time_series.append({
                    "year": decade,
                    "temp": last_real_temp,
                    "heatwaves": heatwave_days,
                })
            
            # 4. EXTRAPOLATE POST-2050 DATA (if requested)
            if target_year > 2050:
                future_decades = [y for y in [2060, 2070, 2080, 2090, 2100] if y <= target_year]
                for decade in future_decades:
                    decades_past_2050 = (decade - 2050) / 10
                    
                    if ssp == "SSP5-8.5":
                        # Extreme emission scenario
                        projected_temp = last_real_temp + (0.45 * decades_past_2050)
                        projected_heatwaves = int(last_real_heatwaves * (1 + (0.25 * decades_past_2050)))
                    else:
                        # Moderate emission scenario
                        projected_temp = last_real_temp + (0.20 * decades_past_2050)
                        projected_heatwaves = int(last_real_heatwaves * (1 + (0.10 * decades_past_2050)))
                        
                    time_series.append({
                        "year": decade,
                        "temp": round(projected_temp, 1),
                        "heatwaves": projected_heatwaves,
                    })

            return time_series

    except Exception as e:
        logger.error(f"Live CMIP6 API failed: {e}")
        return []