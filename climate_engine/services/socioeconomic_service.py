import httpx
import logging

logger = logging.getLogger(__name__)

# THE SHIELD: Prevent Open-Meteo Geocoding from blocking us
HEADERS = {
    "User-Agent": "OpenPlanet-Risk-Engine/2.0 (Academic Research App)",
    "Accept": "application/json"
}

async def fetch_live_socioeconomics(city: str) -> dict:
    """
    GLOBAL LIVE API FETCHING WITH BULLETPROOF FALLBACKS
    """
    pop_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&format=json"
    
    try:
        async with httpx.AsyncClient(headers=HEADERS) as client:
            # 1. Fetch live population and ISO-2 Code
            pop_resp = await client.get(pop_url, timeout=10.0)
            pop_resp.raise_for_status()
            
            results = pop_resp.json().get("results", [])
            if not results:
                raise ValueError(f"City '{city}' not found.")
                
            city_data = results[0]
            city_pop = city_data.get("population", 3000000) # Graceful fallback if missing
            iso2 = city_data.get("country_code", "IN") 
            
            # 2. Query World Bank dynamically using the exact country code
            gdp_url = f"https://api.worldbank.org/v2/country/{iso2}/indicator/NY.GDP.PCAP.CD?format=json&per_page=1"
            gdp_resp = await client.get(gdp_url, timeout=10.0)
            gdp_resp.raise_for_status()
            
            gdp_data = gdp_resp.json()
            gdp_per_capita = 12000 # Global average fallback
            
            if len(gdp_data) > 1 and gdp_data[1]:
                for entry in gdp_data[1]:
                    if entry.get("value") is not None:
                        gdp_per_capita = entry["value"]
                        break
                        
            city_gdp = city_pop * gdp_per_capita * 1.5
            
            return {
                "population": city_pop,
                "city_gdp_usd": city_gdp,
                "country_code": iso2
            }
            
    except Exception as e:
        logger.error(f"Socioeconomic API failure for {city}: {str(e)}")
        # ULTIMATE FALLBACK: If external APIs crash, use an estimated global baseline
        # so the climate engine can still generate predictions without crashing the UI.
        return {
            "population": 4000000, 
            "city_gdp_usd": 4000000 * 12000 * 1.5, 
            "country_code": "UN"
        }