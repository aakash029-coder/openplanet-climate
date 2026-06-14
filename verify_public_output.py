#!/usr/bin/env python3
"""
verify_public_output.py — Reproduces the EXACT /api/predict public output per city.

Faithfully mirrors climate_engine/api/main.py::predict for default public params
(ssp245, year=2050, canopy=0, coolRoof=0) using the real physics + services layer.
Prints wet-bulb, deaths, economic loss, heatwave days, zone, plus baseline.

Run: .venv/bin/python verify_public_output.py
"""
import asyncio
import json
import sys
import httpx

from climate_engine.services.cmip6_service import (
    fetch_historical_baseline_full,
    fetch_cmip6_projection,
    fetch_wetbulb_profile,
)
from climate_engine.services.socioeconomic_service import (
    fetch_live_socioeconomics,
    geocode_city,
)
from climate_engine.api.physics import (
    detect_climate_archetype,
    _fetch_era5_humidity_p95,
    _stull_wetbulb,
    _fetch_worldbank_death_rate,
    _gasparrini_mortality,
    compute_hybrid_economic_loss,
    ISO3_MAP,
)
import pycountry

# (display name, query string, optional explicit lat/lng for cities that may mis-geocode)
CITIES = [
    ("Delhi",      "Delhi, India",            None),
    ("Mumbai",     "Mumbai, India",           None),
    ("Jacobabad",  "Jacobabad, Pakistan",     (28.28, 68.44)),
    ("Singapore",  "Singapore, Singapore",    None),
    ("Phoenix",    "Phoenix, USA",            None),
    ("Riyadh",     "Riyadh, Saudi Arabia",    None),
    ("Khartoum",   "Khartoum, Sudan",         None),
    ("Las Vegas",  "Las Vegas, USA",          (36.17, -115.14)),
    ("Paris",      "Paris, France",           None),
    ("London",     "London, UK",              None),
    ("Athens",     "Athens, Greece",          (37.98, 23.73)),
    ("Seville",    "Seville, Spain",          (37.39, -5.99)),
    ("Yakutsk",    "Yakutsk, Russia",         (62.03, 129.73)),
    ("Helsinki",   "Helsinki, Finland",       (60.17, 24.94)),
    ("Anchorage",  "Anchorage, USA",          (61.22, -149.90)),
    ("Reykjavik",  "Reykjavik, Iceland",      (64.15, -21.94)),
    ("Quito",      "Quito, Ecuador",          (-0.18, -78.47)),
    ("La Paz",     "La Paz, Bolivia",         (-16.50, -68.15)),
    ("Lima",       "Lima, Peru",              None),
    ("Cape Town",  "Cape Town, South Africa", None),
]

SSP = "ssp245"
YEAR = 2050


def _iso2_to_iso3(iso2):
    if not iso2 or iso2 == "UN":
        return "WLD"
    try:
        c = pycountry.countries.get(alpha_2=iso2.upper())
        if c:
            return c.alpha_3
    except Exception:
        pass
    return ISO3_MAP.get(iso2, "WLD")


async def run_city(name, query, coords):
    out = {"city": name, "query": query}
    try:
        # geocode
        if coords:
            lat, lng = coords
            src = "explicit"
        else:
            async with httpx.AsyncClient(timeout=30.0, trust_env=False) as gc:
                geo = await geocode_city(query, gc)
            lat, lng, src = geo.latitude, geo.longitude, geo.source
        out["lat"], out["lng"], out["geo_src"] = round(lat, 3), round(lng, 3), src

        baseline = await fetch_historical_baseline_full(lat, lng)
        p95 = baseline["p95_threshold_c"]
        ann_mean = baseline["annual_mean_c"]
        tx5d_base = baseline["tx5d_baseline_c"]
        out["baseline_mean_c"] = ann_mean
        out["baseline_p95_c"] = p95
        out["baseline_tx5d_c"] = tx5d_base
        out["baseline_lineage"] = baseline.get("_lineage")

        socio = await fetch_live_socioeconomics(query)
        pop = socio["population"]
        gdp = socio["city_gdp_usd"]
        iso2 = socio.get("country_code", "UN")
        iso3 = _iso2_to_iso3(iso2)
        vuln = socio.get("vulnerability_multiplier", 1.0)
        out["population"] = pop
        out["gdp_usd"] = gdp
        out["vuln"] = vuln
        out["socio_src"] = socio.get("_geocoder_source")

        death_rate, rh_p95 = await asyncio.gather(
            _fetch_worldbank_death_rate(iso3),
            _fetch_era5_humidity_p95(lat, lng),
        )
        out["death_rate_per1000"] = death_rate
        out["rh_p95"] = rh_p95

        proj = await fetch_cmip6_projection(lat, lng, SSP, YEAR, p95, 0.0)
        tx5d = proj["tx5d_c"]
        hw_days = proj["hw_days"]
        mean_temp = proj["mean_temp_c"]
        out["proj_tx5d_c"] = tx5d
        out["proj_hw_days"] = hw_days
        out["proj_mean_c"] = mean_temp
        out["proj_n_models"] = proj["n_models"]

        # Physically-consistent wet-bulb (ERA5 observed + CMIP6 delta)
        try:
            wbp = await fetch_wetbulb_profile(lat, lng, SSP, YEAR)
            true_wbt = wbp["projected_wb_c"]
            out["WBT_base_c"] = wbp["baseline_wb_c"]
            out["WBT_delta_c"] = wbp["delta_c"]
            out["wbt_capped"] = wbp["capped"]
        except Exception as e:
            wbp = None
            true_wbt = None
            out["wbt_profile_error"] = str(e)[:120]

        zone = detect_climate_archetype(mean_temp=mean_temp, p95_rh=rh_p95, tx5d=tx5d, true_wbt=true_wbt)
        out["zone"] = zone.zone.value
        out["zone_conf"] = zone.confidence

        temp_excess = max(0.0, tx5d - p95)
        deaths = _gasparrini_mortality(
            pop=pop, baseline_death_rate_per1000=death_rate,
            temp_excess_c=temp_excess, hw_days=hw_days,
            vulnerability_multiplier=vuln,
        )
        loss = compute_hybrid_economic_loss(gdp, mean_temp, tx5d, hw_days)
        legacy_wbt = _stull_wetbulb(tx5d, rh_p95, zone.zone)

        out["temp_excess_c"] = round(temp_excess, 2)
        out["DEATHS"] = deaths
        out["WBT_c"] = true_wbt if true_wbt is not None else legacy_wbt.wbt_celsius
        out["WBT_legacy_c"] = legacy_wbt.wbt_celsius
        out["ECON_LOSS_usd"] = round(loss)
        out["ECON_LOSS_str"] = (
            f"${loss/1e9:.2f}B" if loss >= 1e9 else f"${loss/1e6:.1f}M"
        )
        out["status"] = "OK"
    except Exception as e:
        out["status"] = "ERROR"
        out["error"] = str(e)[:200]
    return out


async def main():
    selected = sys.argv[1:] if len(sys.argv) > 1 else None
    results = []
    for name, query, coords in CITIES:
        if selected and name.lower() not in [s.lower() for s in selected]:
            continue
        print(f"... {name}", file=sys.stderr, flush=True)
        r = await run_city(name, query, coords)
        results.append(r)
        # print one-line summary to stderr
        if r["status"] == "OK":
            print(
                f"    mean={r['baseline_mean_c']}  Tx5d2050={r['proj_tx5d_c']}  "
                f"hw={r['proj_hw_days']}  WBT={r['WBT_c']}  deaths={r['DEATHS']:,}  "
                f"loss={r['ECON_LOSS_str']}  zone={r['zone']}",
                file=sys.stderr, flush=True,
            )
        else:
            print(f"    ERROR: {r.get('error')}", file=sys.stderr, flush=True)
        await asyncio.sleep(0.4)

    with open("public_output_results.json", "w") as f:
        json.dump(results, f, indent=2)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
