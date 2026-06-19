# Data Resilience & Rate-Limit Strategy

OpenPlanet runs on free, keyless open data. This document explains how it stays
**fast and accurate at ~500–600 users/day** on a shared-IP host (Hugging Face
free tier) without hitting provider rate limits or failing when one provider is
throttled.

## 1. Every data layer has ≥2 independent open providers

| Layer | Primary | Fallback(s) | Keyless |
|-------|---------|-------------|---------|
| Geocoding | Photon (Komoot/OSM) | Open-Meteo Geocoding → Nominatim | ✅ |
| Elevation (DEM) | Open-Meteo Elevation (Copernicus DEM) | Open-Topo-Data SRTM 30 m | ✅ |
| Baseline climatology | Open-Meteo ERA5 archive | NASA POWER reanalysis | ✅ |
| CMIP6 projections | Open-Meteo CMIP6 (downscaled) | **World Bank CCKP CMIP6** ensemble | ✅ |
| Köppen classification | ERA5 monthly normals | annual-stat heuristic | ✅ |
| Humidity / wet-bulb | ERA5 bundle (coincident T+RH) | latitude model | ✅ |
| Socioeconomic / GDP | Offline World Bank vault (`socio_vault.json`) | tier averages | ✅ |

If a primary provider returns 429 / errors, the engine retries with exponential
backoff and then degrades to the fallback — it **never crashes and never
fabricates** a value.

## 2. Calls per request are minimised

- **One** consolidated ERA5 archive call per location (`fetch_era5_bundle`) feeds
  the baseline, Köppen, humidity-P95 and wet-bulb computations.
- **Two** CMIP6 calls per location (one full 2011–2050 series per model), sliced
  for the baseline window, every projection horizon, and the wet-bulb future.
- Socioeconomic data (GDP, death rate, national totals) is served from a
  committed offline vault — **zero** live calls.

Cold path ≈ 3 rate-limited calls (1 ERA5 + 2 CMIP6); the rest are lightweight
(geocode, elevation) on separate endpoints.

## 3. Two-tier caching → warm path makes **zero** API calls

- In-memory LRU (per process) + **disk cache** (`climate_engine/data/cache/`,
  30-day TTL) for the heavy ERA5/CMIP6 payloads.
- The disk cache survives Hugging Face cold starts for the container's life, so a
  city is fetched live **at most once**, then served from disk forever.
- `scripts/prewarm_cache.py` pre-populates the disk cache for the most-queried
  cities so even the first request is instant. Run it after deploy:
  ```bash
  VERCEL_TUNNEL_URL="" python scripts/prewarm_cache.py
  ```

## 4. Capacity at 500–600 users/day

With caching, only **new, never-seen** cities cost live calls. Open-Meteo's free
tier allows 10,000 calls/day · 5,000/hour · 600/minute. Even in the worst case of
600 users all querying unique uncached cities, that is ≈ 600 × 3 ≈ 1,800 calls/day
— well under the daily limit. In practice most traffic concentrates on popular
cities (cache hits), so live usage is a small fraction of that. The CCKP fallback
absorbs any transient Open-Meteo throttling for CMIP6.

## 5. Need higher limits? Self-host Open-Meteo (unlimited, still open source)

Open-Meteo is **open source (AGPL)**. For unlimited throughput, run your own
instance and point the engine at it — no rate limits, no key:

```bash
docker run -d -p 8080:8080 ghcr.io/open-meteo/open-meteo
# then set the archive/climate/elevation base URLs to your instance
```

The production deployment also routes Open-Meteo calls through a Vercel edge
tunnel (`VERCEL_TUNNEL_URL`), isolating end users from the host's shared IP
quota. Set `VERCEL_TUNNEL_URL=""` locally to call providers directly.
