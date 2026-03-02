import os
import logging
from typing import List, Dict

logger = logging.getLogger(__name__)

async def fetch_cmip6_timeseries(lat: float, lng: float, ssp: str, target_year: int) -> List[Dict[str, float]]:
    """
    ROLE: Queries NASA NEX-GDDP-CMIP6 (via Postgres cache) for decadal time-series data.
    Returns an array of yearly projections up to the requested target_year.
    """
    nasa_user = os.environ.get("EARTHDATA_USERNAME")
    if not nasa_user:
        return [] # Return empty array if unhooked -> Frontend shows "Awaiting Graph Data"
    
    # =====================================================================
    # TODO: Fetch this exact array from your PostgreSQL JSONB column
    # Example SQL: SELECT timeseries FROM climate_cache WHERE lat = ? AND ssp = ?
    # =====================================================================
    
    # Placeholder logic simulating a database fetch for the requested decades
    decades = [2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100]
    time_series = []
    
    ssp_multiplier = 1.5 if ssp == "SSP5-8.5" else 1.0

    for year in decades:
        if year > target_year:
            break # Stop plotting after the user's target year
            
        climate_penalty = ((year - 2024) * 0.08) * ssp_multiplier
        
        time_series.append({
            "year": year,
            "temp": round(36.8 + climate_penalty, 1),
            "heatwaves": max(0, int(12 + (climate_penalty * 8))),
            "economic_loss": round(15.0 + (climate_penalty * 6), 1)
        })
        
    return time_series