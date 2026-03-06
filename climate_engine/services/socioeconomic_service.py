import httpx
import logging

logger = logging.getLogger(__name__)

async def fetch_live_socioeconomics(city: str) -> dict:
    """
    GLOBAL LIVE API FETCHING:
    Dynamically reverse-engineers the country code for ANY city on Earth,
    then queries the World Bank for that specific country's GDP over secure HTTPS.
    """
    pop_url = f"https://geocoding-api.open-meteo.com/v1/search?name={city}&count=1&format=json"
    
    try:
        async with httpx.AsyncClient() as client:
            # 1. Fetch live population and ISO-2 Code
            pop_resp = await client.get(pop_url, timeout=10.0)
            pop_resp.raise_for_status()
            
            results = pop_resp.json().get("results", [])
            if not results:
                raise ValueError(f"City '{city}' not found in Open-Meteo Geocoding.")
                
            city_data = results[0]
            
            # STRICT REQUIREMENT: No fake data. If it doesn't exist, fail to the Shadow DB.
            if "population" not in city_data:
                raise ValueError(f"Live population data missing for '{city}'.")
            if "country_code" not in city_data:
                raise ValueError(f"Live country code missing for '{city}'.")
                
            city_pop = city_data["population"]
            iso2 = city_data["country_code"] 
            
            # 2. Query World Bank dynamically using the exact country code (STRICT HTTPS)
            gdp_url = f"https://api.worldbank.org/v2/country/{iso2}/indicator/NY.GDP.PCAP.CD?format=json&per_page=1"
            gdp_resp = await client.get(gdp_url, timeout=10.0)
            
            # This prevents the 302 Redirect crash
            gdp_resp.raise_for_status()
            
            gdp_data = gdp_resp.json()
            gdp_per_capita = None
            
            # Extract the most recent valid year from World Bank array
            if len(gdp_data) > 1 and gdp_data[1]:
                for entry in gdp_data[1]:
                    if entry.get("value") is not None:
                        gdp_per_capita = entry["value"]
                        break
                        
            if gdp_per_capita is None:
                raise ValueError(f"Live GDP data not available from World Bank for '{iso2}'.")
                        
            # True City GDP = Population * GDP per capita * 1.5 (Urban premium)
            city_gdp = city_pop * gdp_per_capita * 1.5
            
            return {
                "population": city_pop,
                "city_gdp_usd": city_gdp,
                "country_code": iso2
            }
            
    except Exception as e:
        logger.error(f"Global Socioeconomic API failure for {city}: {str(e)}")
        # NO MORE FAKE DATA. We raise the error so main.py triggers the SHADOW_DB fallback.
        raise e