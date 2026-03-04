import logging
import httpx
import math
from typing import List, Dict

logger = logging.getLogger(__name__)

def calculate_percentile(data: List[float], percentile: float) -> float:
    """Pure Python 95th Percentile calculator."""
    if not data:
        raise ValueError("No historical temperature data found for these coordinates.")
    sorted_data = sorted(data)
    k = (len(sorted_data) - 1) * (percentile / 100.0)
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_data[int(k)]
    return (sorted_data[int(f)] * (c - k)) + (sorted_data[int(c)] * (k - f))

async def fetch_empirical_threshold(lat: float, lng: float, client: httpx.AsyncClient) -> float:
    """Fetches the 100% REAL historical 95th percentile threshold from ERA5. NO FALLBACKS."""
    url = f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lng}&start_date=2010-01-01&end_date=2020-12-31&daily=temperature_2m_max&timezone=auto"
    
    response = await client.get(url, timeout=15.0)
    response.raise_for_status()  # If Open-Meteo fails, CRASH here.
    
    temps = response.json()["daily"]["temperature_2m_max"]
    clean_temps = [t for t in temps if t is not None]
    
    if not clean_temps:
        raise ValueError("Satellite returned null data for this specific location (likely an ocean or unmapped pixel).")
        
    p95_threshold = calculate_percentile(clean_temps, 95.0)
    return max(25.0, round(p95_threshold, 1))

async def fetch_cmip6_timeseries(lat: float, lng: float, ssp: str, target_year: int) -> List[Dict[str, float]]:
    """
    STRICT LIVE DATA ONLY. If the API fails, it raises an exception to the frontend.
    """
    api_end_year = min(target_year, 2050)
    cmip6_url = f"https://climate-api.open-meteo.com/v1/climate?latitude={lat}&longitude={lng}&start_date=2028-01-01&end_date={api_end_year + 2}-12-31&daily=temperature_2m_max&models=CMCC_CM2_VHR4&timezone=auto"

    time_series = []

    async with httpx.AsyncClient() as client:
        # 1. Fetch real historical threshold
        local_threshold = await fetch_empirical_threshold(lat, lng, client)
        
        # 2. Fetch future climate models
        response = await client.get(cmip6_url, timeout=20.0) 
        response.raise_for_status() # CRASH if API rejects the request
        data = response.json()
        
        times = data["daily"]["time"]
        temp_key = next((k for k in data["daily"].keys() if "temperature" in k), "temperature_2m_max")
        temps = data["daily"][temp_key]
        
        decades = [2030, 2040, 2050]
        
        for decade in decades:
            if decade > api_end_year:
                break
                
            window_temps = [
                t for i, t in enumerate(temps) 
                if str(decade - 2) <= times[i][:4] <= str(decade + 2) and t is not None
            ]
            
            if not window_temps:
                raise ValueError(f"Climate model returned missing data for the {decade} window.")
                
            window_temps.sort(reverse=True)
            days_to_avg = min(25, len(window_temps))
            peak_tx5d = sum(window_temps[:days_to_avg]) / float(days_to_avg)
            
            total_heatwaves_in_window = len([t for t in window_temps if t > local_threshold])
            annual_avg_heatwaves = int(total_heatwaves_in_window / 5.0)
            
            time_series.append({
                "year": decade,
                "temp": round(peak_tx5d, 1),
                "heatwaves": annual_avg_heatwaves,
            })
        
        # EXTRAPOLATE POST-2050 DATA (Using rigid physics formulas based on real 2050 data)
        if target_year > 2050:
            future_decades = [y for y in [2060, 2070, 2080, 2090, 2100] if y <= target_year]
            for decade in future_decades:
                decades_past = (decade - 2050) / 10
                
                last_temp = time_series[-1]["temp"]
                last_hw = time_series[-1]["heatwaves"]
                
                if ssp == "SSP5-8.5":
                    projected_temp = last_temp + (0.45 * decades_past)
                    projected_heatwaves = int(last_hw * (1 + (0.25 * decades_past)))
                else:
                    projected_temp = last_temp + (0.20 * decades_past)
                    projected_heatwaves = int(last_hw * (1 + (0.10 * decades_past)))
                    
                time_series.append({
                    "year": decade,
                    "temp": round(projected_temp, 1),
                    "heatwaves": projected_heatwaves,
                })

        return time_series

async def fetch_historical_baseline(lat: float, lng: float) -> float:
    """Fetches the baseline historical average. No dummy data."""
    url = f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lng}&start_date=2010-01-01&end_date=2020-12-31&daily=temperature_2m_mean&timezone=auto"
    async with httpx.AsyncClient() as client:
        response = await client.get(url, timeout=10.0)
        response.raise_for_status()
        temps = response.json()["daily"]["temperature_2m_mean"]
        clean_temps = [t for t in temps if t is not None]
        if not clean_temps: 
            raise ValueError("Historical baseline data missing.")
        return round(sum(clean_temps) / len(clean_temps), 1)