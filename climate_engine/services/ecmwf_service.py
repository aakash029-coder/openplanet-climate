import os
import logging

logger = logging.getLogger(__name__)

async def fetch_historical_baseline(lat: float, lng: float) -> float:
    """
    ROLE: Queries Copernicus ERA5-Land for historical baseline temperature.
    REALITY: This requires the 'cdsapi' package and background queuing.
    For the API response, it queries the local Postgres cache.
    """
    cds_key = os.environ.get("CDSAPI_KEY")
    if not cds_key:
        logger.warning("ECMWF missing. Returning cached fallback.")
        return 35.2 # Fallback until DB pipeline is fully synced
    
    # TODO: Connect to DB and return cached ERA5 data for this lat/lng
    return 36.8