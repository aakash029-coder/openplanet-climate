# OpenPlanet — Climate Risk Intelligence Engine

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-3.11%2B-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115-009688.svg)](https://fastapi.tiangolo.com/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)

---

## Executive Summary

OpenPlanet translates continental-scale atmospheric reanalysis and forward-projection datasets into city-scale physical climate risk indicators and human survival thresholds. It converts raw ERA5 climatology and CMIP6 ensemble projections into directly actionable screening metrics: heat-attributable mortality estimates, GDP-denominated economic damage proxies, and wet-bulb survivability assessments — rendered at Uber H3 Resolution 9 spatial granularity (avg. cell ≈ 0.1053 km²) over any city on Earth.

The system is designed for climate risk researchers, portfolio screening teams, and urban resilience analysts who require transparent, auditable, and reproducible directional calculations. Every output is traceable to a peer-reviewed source, a public dataset API, and an explicit formula. All outputs are macro-scale directional proxies and do not constitute certified financial instruments, engineering assessments, or regulatory filings.

---

## Three Core Views

### 1. Interactive Risk Dashboard

The primary interface presents an H3 hex-grid thermal risk map overlaid on a MapLibre vector basemap. Risk intensity is computed from the CMIP6 ensemble projection for the selected SSP and target year. The left panel provides:

- **Location search** with strict `"City, Country"` dropdown enforcement — the Generate Projection button is locked until an explicit dropdown selection is made, preventing free-text coordinate guessing.
- **Target year selector** (2030 · 2050 · 2070 · 2100).
- **Emission scenario selector** (SSP2-4.5 · SSP5-8.5).
- **Theoretical Mitigation Simulator** — directional canopy expansion and albedo (cool-roof) sliders that apply deterministic cooling offsets derived from Bowler et al. (2010) urban greening studies.

The right panel displays live risk metrics drawn exclusively from `ClimateDataContext` — the single source of truth populated by a single `/api/climate-risk` call:

| Metric | Formula source | Uncertainty display |
|--------|---------------|---------------------|
| Attributable Deaths | Gasparrini et al. (2017) AF = (RR−1)/RR · OP-CVI | Model Variance Sensitivity Bounds ±15% |
| Economic Impact | Burke et al. (2018) + ILO (2019) bipartite model | Model Variance Sensitivity Bounds ±8% |
| Heatwave Days | ERA5 P95 threshold exceedance | — |
| Peak Tx5d | CMIP6 ensemble 5-day maximum temperature | — |

### 2. Deep Dive Research Tab

Full projection breakdown across all four CMIP6/IPCC AR6 time horizons (2030, 2050, 2075, 2100) for the active city. Surfaces:

- Year-by-year projection table with survivability status classification (STABLE / DANGER / CRITICAL).
- Wet-bulb temperature trajectory with Sherwood & Huber (2010) 35 °C physiological ceiling annotation.
- Urban Heat Island intensity and grid stress factor trends.
- SSP scenario and mitigation parameter re-configuration without page navigation — context re-fetches and re-populates all metrics from the same global state.
- AI narrative analysis (Groq LLM) for geographic and geopolitical risk context.
- One-click Excel export of the full 4-sheet actuarial model.

### 3. Side-by-Side Comparative Matrix

Simultaneous projection of any two cities across identical time horizons and SSP pathways. City A is pre-populated from the Dashboard's active context — zero redundant API calls. City B is independently geocoded and fetched. Renders delta columns for mortality, economic loss, heatwave exposure, and wet-bulb limits.

---

## Scientific Data Pipeline

All projections are deterministic functions of public datasets. No proprietary models, no synthetic training data.

### Step 1 — Climatology Baseline

**Source:** Copernicus Climate Change Service (C3S) ERA5 global reanalysis via the Open-Meteo Historical API.

#### Contemporary Non-Stationary Baseline Calibration

The engine uses a dual-layer baseline architecture:

**Layer A — Macroclimatic Context (display only):** The frontend overview surfaces a long-term decadal retrospective trend spanning approximately 1995–2024 for macro-climatic orientation. This gives analysts a sense of the long-run temperature trajectory at a location.

**Layer B — Analytical Calculation Baseline (canonical):** All mortality, economic, and wet-bulb calculations are anchored to the most recent complete decade — **2011–2020** (~3,650 daily maximum temperature observations per coordinate). This is a deliberate design choice termed *Contemporary Non-Stationary Baseline Calibration*: under accelerating anthropogenic forcing, the most recent decade captures observed extreme heat velocity far more accurately than a 30-year average that dilutes current thermal regimes with pre-acceleration climatology from the 1990s. It also ensures reliable upstream API throughput without triggering rate limits on the Copernicus historical archive.

From the 2011–2020 ERA5 series the engine computes:

- **Tx5d baseline** — rolling 5-day maximum temperature mean at the 95th percentile (WMO heatwave definition). This is the site-specific heatwave onset threshold.
- **ERA5 P95** — absolute 95th percentile of daily maximum temperature over the baseline window. Used as the mortality dose-response reference temperature.
- **ERA5 humidity P95** — afternoon-corrected relative humidity at P95 events (see Step 3).
- **Cooling offset** — applied algebraically to projected temperatures when mitigation sliders are active.

### Step 2 — Forward Projections

**Source:** CMIP6 high-resolution two-model ensemble via the Open-Meteo Climate API.

| Horizon | Model | Resolution | Method |
|---------|-------|-----------|--------|
| 2030 | MRI-AGCM3-2-S | ~20 km | Direct CMIP6 API extraction |
| 2050 | MPI-ESM1-2-XR | ~50 km | Direct CMIP6 API extraction |
| 2075 | IPCC AR6 WG1 | Regional | Published decadal delta-rate extrapolation |
| 2100 | IPCC AR6 WG1 | Regional | Published decadal delta-rate extrapolation |

The two-model ensemble weight is equal (0.5 / 0.5). MRI-AGCM3-2-S is selected for its superior resolution in tropical and monsoon-affected urban biomes. MPI-ESM1-2-XR provides the broader ensemble anchor for mid-latitude regions.

SSP2-4.5 (moderate mitigation pathway) is the default scenario. SSP5-8.5 (high-emission baseline) is available as a stress-test configuration.

### Step 3 — Humid Dynamics (Wet-Bulb Temperature)

**Source:** Stull (2011) empirical wet-bulb equation with Clausius-Clapeyron diurnal correction.

ERA5 reports daily maximum relative humidity at the coolest part of the diurnal cycle (typically early morning), while daily maximum temperature (Tmax) occurs in the afternoon. Combining raw ERA5 P95 humidity with Tmax directly produces inflated wet-bulb estimates in arid and semi-arid climates.

The engine applies a Clausius-Clapeyron saturation vapour pressure correction to derive co-occurring afternoon relative humidity before applying the Stull (2011) formula:

```
WBT = T × atan(0.151977 × (RH + 8.313659)^0.5)
    + atan(T + RH) − atan(RH − 1.676331)
    + 0.00391838 × RH^1.5 × atan(0.023101 × RH) − 4.686035
```

The 35 °C WBT ceiling per Sherwood & Huber (2010) is enforced as a hard display cap — model outputs above this threshold are flagged as "Critical Physiological Limit" and not rendered as continuous values.

### Step 4 — Mortality Calculus

**Source:** Gasparrini et al. (2017), *Lancet Planetary Health* — "Projections of temperature-related excess mortality under climate change scenarios."

```
Deaths = Pop × (DR / 1000) × (HW / 365) × AF × OP-CVI

where:
  Pop    = scaled metropolitan population (GeoNames + UN Population Division)
  DR     = crude death rate per 1,000 (World Bank WDI API; WHO fallback)
  HW     = projected heatwave days for target year
  AF     = attributable fraction = (RR − 1) / RR
  RR     = relative risk = exp(β × ΔT)
  β      = 0.0801  [Gasparrini et al. 2017 global pooled mean — applied as a
           cross-city macro-benchmarking constant; city-specific ERFs not computed]
  ΔT     = peak_Tx5d − ERA5_P95_threshold
  OP-CVI = OpenPlanet Composite Vulnerability Index (see below)
```

**OpenPlanet Composite Vulnerability Index (OP-CVI)** is a cross-city macro-benchmarking proxy constructed from three independent socioeconomic axes:
- **Wealth proxy** — inverse of GDP per capita (AC adoption and cooling infrastructure access).
- **Age structure** — cohorts aged 65+ carry a **3.2× physiological sensitivity weight** derived from Gasparrini et al. (2017) age-stratified supplementary analysis.
- **Health system capacity** — physicians per 1,000 persons (World Bank SH.MED.PHYS.ZS).

The OP-CVI multiplicative composite is an original OpenPlanet cross-city normalization index designed for comparative portfolio screening. It is not a direct reproduction of any single published vulnerability index. All three dimensions are pulled live from the World Bank API at query time, with the pre-computed `socio_vault.json` as the structured fallback.

### Step 5 — Econometrics

**Source:** Burke, Hsiang & Miguel (2018), *Nature* + International Labour Organization (2019).

The engine implements a **bipartite economic damage model** that separately addresses two distinct loss channels:

**Channel A — Macro growth penalty (Burke et al. 2018):**
```
Burke_penalty = 0.0127 × (T_mean − 13.0)² / 100
```
Applied to the full GDP stock. The 13 °C global optimal temperature and the 0.0127 quadratic coefficient are taken directly from Burke et al. (2018) Table S3 (global sample, all-year model).

**Channel B — Heat-shock labour productivity loss (ILO 2019):**
```
ILO_fraction = (HW_days / 365) × 0.40 × 0.20
```
The 0.40 outdoor labour share and 0.20 per-day productivity loss floor are from ILO (2019) Annex Table A4, applied strictly during projected heatwave days.

**Combined loss:**
```
Total_Loss = GDP × (Burke_penalty + ILO_fraction)
```

Metropolitan GDP is estimated as national GDP per capita × urban population × urban productivity ratio. This is a directional actuarial proxy, not audited financial reporting.

### Step 6 — Spatial Architecture

**Source:** Uber H3 geospatial indexing library at Resolution 9.

The city boundary is polyfilled at H3 Resolution 9 (canonical specs: average hexagon area ≈ 0.1053 km², mean edge length ≈ 0.14 km). Each hex cell is assigned a thermal risk weight derived from the ERA5 P95 temperature relative to global baselines, the CMIP6 projected anomaly, and a distance-decay urban heat island function anchored at the geocoded city centroid.

**Spatial scope note:** Risk calculations are computed at the city centroid and projected outward via a spatial decay model. The hex grid provides a city-scale risk surface for visual orientation; it does not represent independent sub-cell temperature measurements. ERA5 native resolution is ~31 km and CMIP6 native resolution is ~20–50 km — the H3 Resolution 9 cell size (≈ 0.1053 km²) exceeds the source data resolution and should be understood as a spatial indexing framework, not a measurement grid.

The resulting hex grid is rendered client-side via DeckGL `H3HexagonLayer` with a continuous green → yellow → orange → red colour ramp mapped to [0.0, 1.0] normalized risk. When mitigation sliders are active, hex risk weights are scaled by `max(0.1, 1 − cooling_factor × 0.08)` — display-only approximation, does not feed mortality or economic calculations.

---

## Quickstart

### Prerequisites

| Tool | Required Version |
|------|-----------------|
| Python | ≥ 3.11 |
| Node.js | ≥ 20 LTS |
| Git | any recent version |

---

### 1. Clone the repository

```bash
git clone https://github.com/aakash029-coder/openplanet-climate.git
cd openplanet-climate
```

### 2. Start the FastAPI engine

```bash
python -m venv .venv
source .venv/bin/activate      # Windows: .venv\Scripts\activate

pip install -r requirements.txt

cp .env.example .env
# Edit .env — set GROQ_API_KEY for AI analysis features

uvicorn climate_engine.api.main:app --reload --port 7860
```

API documentation is available at `http://localhost:7860/docs`.

> **Platform Independence Note:** The engine is fully self-contained and runs standalone in any local Python 3.11+ environment or Docker container. `VERCEL_TUNNEL_URL` is an *optional* architectural proxy used to route upstream ERA5 / CMIP6 API calls through a Vercel edge function — this sidesteps client-side CORS restrictions when the frontend is hosted on Vercel. It is not required for local deployments or Docker-based setups. When `VERCEL_TUNNEL_URL` is not set, the engine calls Open-Meteo APIs directly.

### 3. Start the Next.js frontend

```bash
cd frontend
npm install

# Create frontend/.env.local
cp ../.env.example .env.local
# Set NEXT_PUBLIC_ENGINE_URL=http://localhost:7860

npm run dev
```

Open `http://localhost:3000`.

### 4. Full stack via Docker Compose

```bash
docker compose -f infra/docker-compose.yml up --build
```

---

## Repository Structure

```
openplanet-climate/
├── climate_engine/          # FastAPI backend — stateless physics pipeline
│   ├── api/                 # main.py, schemas.py, security.py
│   ├── services/            # ERA5, CMIP6, LLM, socioeconomic data services
│   ├── data/                # socio_vault.json — World Bank socioeconomic reference
│   └── settings.py          # Pydantic-Settings environment governance
├── frontend/                # Next.js 16 / React 19 frontend
│   ├── src/app/             # App Router pages and /api proxy routes
│   ├── src/components/      # MapModule, ResearchModule, CompareModule, MethodologyModule
│   └── src/context/         # ClimateDataContext — global single source of truth
├── hf_space/                # Hugging Face Spaces deployment mirror
├── infra/                   # Docker Compose, Nginx, production Dockerfiles
├── scripts/                 # Operational utilities
│   ├── build_socio_vault.py # Rebuild socio_vault.json from World Bank API
│   └── deploy_hf.py         # Push engine files to Hugging Face Space
├── tests/                   # Python integration tests (geocoding, pipeline)
├── docs/                    # Extended scientific methodology documentation
├── .env.example             # Environment variable reference (no real secrets)
├── CONTRIBUTING.md          # Contribution guidelines
└── LICENSE                  # MIT License
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/climate-risk` | Full CMIP6 projection set for a coordinate — the canonical data source for all UI tabs |
| `POST` | `/api/predict` | Dashboard simulation — hex grid, charts, AI analysis, historical eras |
| `POST` | `/api/research-analysis` | LLM-generated narrative risk analysis (Groq) |
| `GET`  | `/health` | Engine liveness probe |
| `GET`  | `/docs` | OpenAPI interactive documentation |

All `/api/*` routes are proxied through the Next.js `/api/engine` route handler to avoid exposing the engine URL client-side and to enforce the ALLOWED endpoint allowlist.

---

## Scientific Citations

| Reference | Used for |
|-----------|---------|
| Gasparrini A. et al. (2017). *Lancet Planetary Health.* | Mortality dose-response, AF formula, β = 0.0801 (global pooled mean); age-stratified sensitivity weights in OP-CVI |
| Burke M. et al. (2018). *Nature.* | Macroeconomic damage function, T_optimal = 13 °C |
| ILO (2019). *Working on a Warmer Planet.* | Labour productivity heat-stress loss |
| Stull R. (2011). *J. Applied Meteorology and Climatology.* | Wet-bulb temperature calculation |
| Sherwood S.C. & Huber M. (2010). *PNAS.* | 35 °C WBT physiological survivability ceiling |
| Hersbach H. et al. (2020). *Q. J. R. Meteorol. Soc.* | ERA5 global reanalysis baseline |
| IPCC AR6 WG1 (2021). *Cambridge University Press.* | CMIP6 delta-rate extrapolation, SSP pathways |
| World Bank WDI (2024). | Death rates, GDP, age structure, health capacity |
| UN Population Division (2024). | Metropolitan population scaling |
| Bowler D.E. et al. (2010). *Landscape and Urban Planning.* | Urban canopy cooling coefficient |

---

## Regulatory Compliance, Limitation of Liability & Legal Disclaimer

**1 — Non-Binding Directional Screening Tool.** All outputs produced by the OpenPlanet Climate Risk Intelligence Engine — including but not limited to heat-attributable mortality estimates, economic damage projections, wet-bulb temperature trajectories, heatwave day counts, and H3 hex-grid risk scores — are *directional macro-scale proxies* derived from public scientific datasets and open APIs. They are not certified weather forecasts, audited engineering assessments, actuarial certifications, insurance underwriting opinions, credit ratings, or financial instruments of any kind. No output constitutes investment advice or a binding recommendation under any applicable jurisdiction.

**2 — Methodology Transparency & Known Constraints.** The mortality model applies the Gasparrini et al. (2017) global pooled β = 0.0801 coefficient as a cross-city macro-benchmarking constant; city-specific Exposure-Response Functions are not computed. The OpenPlanet Composite Vulnerability Index (OP-CVI) is an original cross-city normalization proxy — not a reproduction of any certified vulnerability index. Model Variance Sensitivity Bounds (±15% mortality, ±8% economic) are scaling constants for directional range display, not statistically derived confidence intervals. The 2011–2020 ERA5 Contemporary Non-Stationary Baseline is a deliberate design choice; outputs will differ from analyses using the WMO 30-year standard normal (1991–2020).

**3 — Data Lineage Transparency.** Every API response carries a `metadata.data_lineage` field. When this reads `"statistical_fallback"`, a latitude-based piecewise regression was substituted for one or more upstream API calls (Copernicus C3S ERA5 or Open-Meteo CMIP6) that timed out or returned an error. Fallback outputs carry materially higher uncertainty and must be treated as indicative order-of-magnitude estimates only.

**4 — Platform Independence.** The engine is deployable as a fully standalone Python/Docker service. `VERCEL_TUNNEL_URL` is an optional architectural proxy for hosted deployments; it is not required for local or self-hosted operation.

**5 — Zero Liability.** To the maximum extent permitted by applicable law, the authors and contributors accept zero civil or commercial liability for capital allocation decisions, portfolio actions, insurance pricing changes, public policy choices, or any consequential action taken in reliance on this engine's outputs. Users assume full responsibility for independent validation before any operational deployment.

**Open-Source Licensing:** MIT License. No warranty express or implied. See [LICENSE](LICENSE).

---

## License

[MIT License](LICENSE) — Copyright (c) 2026 Aakash Goswami.
