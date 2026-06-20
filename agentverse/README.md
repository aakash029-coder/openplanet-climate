# OpenPlanet Heat-Risk Agent

Ask any city, get its **heat-risk outlook** — historical baseline plus a
bias-corrected CMIP6 projection for 2030 and 2050: peak temperature, extreme-heat
days, wet-bulb temperature, and a risk rating. Built on free, open climate data
(ERA5 reanalysis + CMIP6 climate models via Open-Meteo). No API key, no account.

**Tags:** `climate` · `weather` · `environment` · `science` · `heat-risk` · `data`

Full interactive analysis, methodology, and validation: **https://openplanetrisk.com**

---

## Try it

> **heat risk in Kolkata**

## Example response

```
🌡️ Heat-risk outlook for Kolkata, India

Historical baseline [ERA5, 2011–2020]: annual mean 26.0°C, 5-day peak (Tx5d)
38.3°C, ~18 extreme-heat days/year, observed wet-bulb 28.5°C.

2030 [CMIP6 SSP2-4.5, 2-model ensemble]: peak 38.4°C, ~18 extreme-heat days/year,
wet-bulb 32.7°C [Stull 2011] → CRITICAL.

2050 [CMIP6 SSP2-4.5, 2-model ensemble]: peak 40.3°C, ~34 extreme-heat days/year,
wet-bulb 34.4°C [Stull 2011] → CRITICAL.

Projections are capped at 2050 (the validated CMIP6 horizon) — we do not
extrapolate to 2075/2100. Directional screening estimate; see openplanetrisk.com
for the full interactive analysis.
```

You can also ask things like:
- `How hot could Mumbai get by 2050?`
- `Dubai heat risk`
- `What's the heat outlook for London?`

---

## How it works

| Field | Source | Method |
|-------|--------|--------|
| Historical baseline | ERA5 (Open-Meteo archive) | 2011–2020 daily Tmax/Tmean/RH; Tx5d = annual max of the 5-consecutive-day mean; extreme-heat days = days above the city's own 95th-percentile Tmax |
| 2030 / 2050 peak | CMIP6 SSP2-4.5, 2-model ensemble (MRI-AGCM3-2-S + MPI-ESM1-2-XR) | **Bias-corrected delta downscaling**: anchor to the ERA5 baseline, add the CMIP6-internal warming delta (future − CMIP6 2011-2016). The peak can never fall below the observed baseline under a warming scenario. |
| Wet-bulb | Stull (2011) | Computed from the projected peak and the humidity coincident with hot days; capped at the dry-bulb and the 35 °C survivability limit |
| Risk rating | WHO / physiological wet-bulb thresholds | CRITICAL ≥31 °C wet-bulb · DANGER ≥28 °C · else by heatwave-day multiplier |

**Honesty & limits:** CMIP6 is coarse (~25–100 km), so this is a *directional
screening estimate*, not an actuarial forecast. Projections are strictly capped
at 2050 — we do **not** extrapolate to 2075 or 2100. No value is invented: if a
data source is unavailable the agent says so rather than guessing.

## Deployment (hosted)

This is an **Agentverse hosted agent** — it runs on Agentverse's always-on
infrastructure, so it does not depend on any external server staying up. The
entire implementation is the single self-contained file `openplanet_agent.py`
(only `requests` + the Python standard library).
