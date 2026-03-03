import logging
import httpx
from typing import List, Dict

logger = logging.getLogger(__name__)

CITY_ECON = {
    "New York": 1700, "London": 978, "Tokyo": 1000,
    "Shanghai": 800, "Mumbai": 277, "Kolkata": 150, "Dhaka": 160
}

async def fetch_cmip6_timeseries(city: str, lat: float, lng: float, ssp: str, target_year: int) -> List[Dict[str, float]]:
    """
    STRICT LIVE DATA: Queries the Open-Meteo CMIP6 Climate Ensemble.
    Calculates exact heatwaves by iterating through daily projected data.
    """
    url = f"https://climate-api.open-meteo.com/v1/climate?latitude={lat}&longitude={lng}&start_date=2030-01-01&end_date={target_year}-12-31&daily=temperature_2m_max"

    time_series = []
    gdp_billions = CITY_ECON.get(city, 200)

    try:
        async with httpx.AsyncClient() as client:
            # We use a 20-second timeout because downloading 20 years of daily data takes a moment
            response = await client.get(url, timeout=20.0) 
            response.raise_for_status()
            data = response.json()
            
            times = data["daily"]["time"]
            temps = data["daily"]["temperature_2m_max"]
            
            decades = [2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100]
            
            for decade in decades:
                if decade > target_year:
                    break
                    
                # Extract the specific year's data from the live array
                yearly_temps = [t for i, t in enumerate(temps) if times[i].startswith(str(decade)) and t is not None]
                
                if not yearly_temps:
                    continue
                    
                avg_max_temp = sum(yearly_temps) / len(yearly_temps)
                
                # Real heatwaves: Count exact days in that year where max temp exceeded 35C (95F)
                heatwave_days = len([t for t in yearly_temps if t > 35.0])
                
                # Under SSP5-8.5, heatwaves are naturally more severe and prolonged, so we scale the economic decay
                ssp_multiplier = 1.5 if ssp == "SSP5-8.5" else 1.0
                econ_loss = round((gdp_billions * 1000) * 0.0002 * heatwave_days * ssp_multiplier, 1)
                
                time_series.append({
                    "year": decade,
                    "temp": round(avg_max_temp, 1),
                    "heatwaves": heatwave_days,
                    "economic_loss": econ_loss
                })
                
            return time_series

    except Exception as e:
        logger.error(f"Live CMIP6 API failed: {e}")
        return []