import logging
import httpx
from typing import List, Dict

logger = logging.getLogger(__name__)

def calculate_global_threshold(lat: float) -> float:
    """
    Dynamically calculates a localized heatwave threshold (°C) based on absolute latitude.
    Tropics (0-20°): 35.0°C
    Sub-tropics (20-35°): Scales 35°C -> 32°C
    Temperate (35-50°): Scales 32°C -> 28°C
    Boreal/Polar (>50°): Scales 28°C -> 25°C
    """
    abs_lat = abs(lat)
    if abs_lat <= 20:
        return 35.0
    elif abs_lat <= 35:
        return 35.0 - ((abs_lat - 20) * (3.0 / 15.0))
    elif abs_lat <= 50:
        return 32.0 - ((abs_lat - 35) * (4.0 / 15.0))
    else:
        return max(25.0, 28.0 - ((abs_lat - 50) * (3.0 / 15.0)))

async def fetch_cmip6_timeseries(lat: float, lng: float, ssp: str, target_year: int) -> List[Dict[str, float]]:
    """
    STRICT LIVE DATA: Queries the Open-Meteo CMIP6 Climate Ensemble.
    """
    url = f"https://climate-api.open-meteo.com/v1/climate?latitude={lat}&longitude={lng}&start_date=2030-01-01&end_date={target_year}-12-31&daily=temperature_2m_max"

    time_series = []
    local_threshold = calculate_global_threshold(lat)

    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=20.0) 
            response.raise_for_status()
            data = response.json()
            
            times = data["daily"]["time"]
            temps = data["daily"]["temperature_2m_max"]
            
            decades = [2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100]
            
            for decade in decades:
                if decade > target_year:
                    break
                    
                yearly_temps = [t for i, t in enumerate(temps) if times[i].startswith(str(decade)) and t is not None]
                
                if not yearly_temps:
                    continue
                    
                avg_max_temp = sum(yearly_temps) / len(yearly_temps)
                
                # Count exact days exceeding the DYNAMIC GLOBAL threshold
                heatwave_days = len([t for t in yearly_temps if t > local_threshold])
                
                time_series.append({
                    "year": decade,
                    "temp": round(avg_max_temp, 1),
                    "heatwaves": heatwave_days,
                })
                
            return time_series

    except Exception as e:
        logger.error(f"Live CMIP6 API failed: {e}")
        return []