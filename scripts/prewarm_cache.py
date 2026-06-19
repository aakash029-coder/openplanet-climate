"""
scripts/prewarm_cache.py — Pre-warm the disk cache for popular cities.

On Hugging Face free tier this is the difference between a fast first request and
a rate-limited one: run it once after deploy (or on a schedule) to populate
climate_engine/data/cache/ with the ERA5 bundle + CMIP6 full series for the most
queried cities, so those queries serve instantly with ZERO live API calls.

    python scripts/prewarm_cache.py                 # all city-vault cities
    python scripts/prewarm_cache.py "Lisbon" "Delhi"  # specific cities

Set VERCEL_TUNNEL_URL="" to fetch directly (recommended for a one-off warm).
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
import time

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from climate_engine.services.socioeconomic import geocode_city  # noqa: E402
from climate_engine.services.cmip6_service import (  # noqa: E402
    fetch_era5_bundle,
    fetch_historical_baseline_full,
    fetch_cmip6_projection,
    fetch_wetbulb_profile,
)
import httpx  # noqa: E402

VAULT_PATH = os.path.join(
    os.path.dirname(__file__), "..", "climate_engine", "data", "city_vault.json"
)


def _popular_cities() -> list[str]:
    try:
        with open(VAULT_PATH, encoding="utf-8") as fh:
            vault = json.load(fh)
        names = []
        for v in vault.values():
            n = v.get("display_name") or v.get("name")
            if n:
                names.append(n)
        return names or ["Lisbon, Portugal", "Delhi, India", "London, UK"]
    except Exception:
        return ["Lisbon, Portugal", "Delhi, India", "London, UK"]


async def warm(city: str) -> None:
    async with httpx.AsyncClient(trust_env=False, timeout=45.0) as client:
        geo = await geocode_city(city, client)
    lat, lng = geo.latitude, geo.longitude
    # Populate the two heavy disk-cached payloads + derived caches.
    await fetch_era5_bundle(lat, lng)
    baseline = await fetch_historical_baseline_full(lat, lng)
    for year in (2030, 2050):
        await fetch_cmip6_projection(lat, lng, "ssp245", year, baseline)
    await fetch_wetbulb_profile(lat, lng, "ssp245", 2050)


async def main(cities: list[str]) -> None:
    ok = 0
    for c in cities:
        t0 = time.time()
        try:
            await warm(c)
            ok += 1
            print(f"[warm] {c:30s} {time.time()-t0:5.1f}s")
        except Exception as exc:
            print(f"[skip] {c:30s} {str(exc)[:80]}")
        await asyncio.sleep(2.0)  # gentle pacing for the free tier
    print(f"\nPre-warmed {ok}/{len(cities)} cities into the disk cache.")


if __name__ == "__main__":
    only = sys.argv[1:]
    asyncio.run(main(only or _popular_cities()))
