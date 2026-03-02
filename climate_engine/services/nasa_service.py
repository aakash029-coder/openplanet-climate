from typing import List, Dict

async def fetch_cmip6_timeseries(lat: float, lng: float, ssp: str, target_year: int) -> List[Dict[str, float]]:
    decades = [2030, 2040, 2050, 2060, 2070, 2080, 2090, 2100]
    time_series = []
    ssp_multiplier = 1.5 if ssp == "SSP5-8.5" else 1.0

    for year in decades:
        if year > target_year: break
        climate_penalty = ((year - 2024) * 0.08) * ssp_multiplier
        time_series.append({
            "year": year,
            "temp": round(36.8 + climate_penalty, 1),
            "heatwaves": max(0, int(12 + (climate_penalty * 8))),
            "economic_loss": round(15.0 + (climate_penalty * 6), 1)
        })
    return time_series