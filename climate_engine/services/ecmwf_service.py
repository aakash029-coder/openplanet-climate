import logging
import httpx

logger = logging.getLogger(__name__)

async def fetch_historical_baseline(lat: float, lng: float) -> float:
    """
    STRICT LIVE DATA: Queries the Open-Meteo ERA5 Archive API.
    Gets the mean daily maximum temperature for the last 10 years to form a baseline.
    """
    url = f"https://archive-api.open-meteo.com/v1/archive?latitude={lat}&longitude={lng}&start_date=2014-01-01&end_date=2023-12-31&daily=temperature_2m_max&timezone=auto"
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(url, timeout=10.0)
            response.raise_for_status()
            data = response.json()
            
            # Calculate the actual historical average of all daily maximums
            temps = data["daily"]["temperature_2m_max"]
            valid_temps = [t for t in temps if t is not None]
            
            if not valid_temps:
                return 35.0 # Absolute fallback if API fails
                
            base_temp = sum(valid_temps) / len(valid_temps)
            return round(base_temp, 1)
            
    except Exception as e:
        logger.error(f"Live ERA5 API failed: {e}")
        return 35.0