# OpenPlanet: Scientific Protocol & Methodology

Version: 2.0.0 (Defensible Scientific Framework)  
Architecture: Stateless, vectorized pure-function pipeline (Python/NumPy)

> **Data Integrity Statement:** Socioeconomic inputs are anchored to the OpenPlanet Verified City Vault — a hardcoded, audited dataset of 59+ major global cities sourced from 2023-2024 UN/World Bank/census publications. Dynamic web-scraping of population or GDP data is not used. All vault entries pass a strict census validator before entering any calculation.

> **Projection Horizon:** OpenPlanet projections are **capped at 2050**. We do not provide or extrapolate data for 2075 or 2100, maintaining strict adherence to available high-resolution CMIP6 peer-reviewed outputs. The Open-Meteo CMIP6 ensemble (MRI-AGCM3-2-S, MPI-ESM1-2-XR) provides validated daily data through 2050 only. Requests for post-2050 years return a `HorizonUnavailable` error by design.

---

## 1. Abstract
The OpenPlanet Climate Engine is a high-resolution translation layer that converts raw climatological data into localized financial and epidemiological risk metrics. It operates as a deterministic, purely functional pipeline, ensuring reproducibility and strict separation between spatial data querying and scientific computation.

All climate outputs are driven by live queries to Copernicus ERA5 and CMIP6 ensembles, processed through peer-reviewed dose-response functions. Socioeconomic inputs are sourced from the Verified City Vault rather than dynamic lookups, ensuring data provenance is auditable and immutable.

---

## 2. Core Data Pipelines

### 2.1 Historical Baseline (ERA5)
The heatwave threshold is an emergent, data-driven property of each coordinate's 30-year climatology.
- Source: Open-Meteo ERA5 Reanalysis Archive (mirrors ECMWF Copernicus).
- Resolution: ~31km spatial grid.
- Method: We compute the 95th percentile (P95) from ~10,950 daily $T_{max}$ observations across the WMO standard 1991–2020 climate normal period.
- Tx5d Index: Mean temperature of the hottest consecutive 5-day block, consistent with WMO ETCCDI standards.
- Humidity: ERA5 daily mean relative humidity (summer months, P95), corrected for diurnal variability via Clausius-Clapeyron scaling before wet-bulb calculation.

### 2.2 Future Projections (CMIP6 Ensemble) — Horizon: 2050
Near-term projections (2015–2050) utilize a 2-model CMIP6 ensemble (MRI-AGCM3-2-S, MPI-ESM1-2-XR) using equal-weight averaging per IPCC AR6 methodology.

**Projection horizon is strictly capped at 2050.** The Open-Meteo CMIP6 API provides validated daily data only through this date. No extrapolation to 2075 or 2100 is performed. Institutional users requiring indicative end-century risk should apply IPCC AR6 WG1 published regional warming deltas (Ch. 4 Table 4.5; Ch. 11 Table 11.1) to the 2050 baseline independently.

### 2.3 Socioeconomic Data — Verified City Vault
Population, GDP per capita, and healthcare access data are sourced from the **OpenPlanet Verified City Vault** (`climate_engine/data/city_vault.json`):
- 59 major global cities with hardcoded, audited values
- Sources: UN World Urbanization Prospects 2023, national census bureaus (US ACS, IBGE, INEGI, India Census), World Bank national GDP per capita 2023
- Validation: All population figures pass a boundary check ([10K, 35M]) before entering calculations. Values outside bounds trigger a `CRITICAL: Data Poisoning Detected` log and revert to World Bank national averages
- For cities not in the vault, a live geocoder (Open-Meteo + Nominatim fallback) is used with the same validator applied to returned population figures

---

## 3. Epidemiological Translation Model

Heat-attributable mortality utilizes the dose-response framework established by Gasparrini et al. (2017), aligned with Global Burden of Disease (GBD) methodology.

### 3.1 Relative Risk (RR) and Attributable Fraction (AF)
The engine calculates the Relative Risk of mortality using a log-linear increase above the Minimum Mortality Temperature (MMT):

$$RR = \exp(\beta \times \max(T - MMT, 0))$$

Where $\beta$ is the region-specific coefficient (global mean $\approx 0.0801$). The Attributable Fraction is strictly clipped to $[0, 1]$ to satisfy database constraints:

$$AF = \frac{RR - 1}{RR}$$

### 3.2 Attributable Deaths
Total heat-attributable mortality is calculated combining World Bank baseline rates and GeoNames metro populations:

$$Deaths = Pop \times \left(\frac{DR}{1000}\right) \times \left(\frac{HW}{365}\right) \times AF \times V$$

Where $V$ represents the vulnerability multiplier (0.25 to 2.5), accounting for AC penetration proxy, age structure, and healthcare access.

---

## 4. Economic Vulnerability Model

Economic decay combines the macroeconomic penalty curve from Burke et al. (2018) with the labor productivity fractions from ILO (2019).

$$Loss = GDP \times (Burke\_penalty + ILO\_fraction)$$

Burke Quadratic Penalty:
$$Penalty = 0.0127 \times \frac{(T_{mean} - 13)^2}{100}$$
(Where 13°C represents the globally optimal economic production temperature).

ILO Labor Fraction:
$$ILO\_fraction = \left(\frac{HW_{days}}{365}\right) \times 0.40 \times 0.20$$

---

## 5. Survivability Thresholds (Wet-Bulb)

Wet-bulb temperature (WBT) is computed deterministically using the Stull (2011) empirical formula with ERA5 P95 humidity. 

Critical Limit: The engine recognizes 31.0°C WBT as the onset of severe danger, and 35.0°C WBT as the theoretical limit of human thermoregulation and survivability, as defined by Sherwood & Huber (2010). Above these thresholds, a $\kappa$ (kappa) steepness multiplier accelerates the Relative Risk.

---

## 6. Limitations & Transparency Disclosures

OpenPlanet provides research-grade estimates intended for analytical modeling. We explicitly disclose the following limitations:
1. **Projection Horizon:** Projections are strictly capped at 2050. Post-2050 scenarios require independent application of IPCC AR6 regional deltas and are outside this engine's validated scope.
2. **City GDP:** City-level GDP is estimated from Verified City Vault GDP/capita scaled by metro population and an urban productivity ratio. For vault cities, GDP/capita reflects national World Bank 2023 figures; city-level productivity multipliers are applied where established.
3. **Mortality Confidence:** Death estimates carry a ±15–75% uncertainty range depending on event duration (validated against 5 historical events; see `climate_engine/validation/`). The Gasparrini β coefficient is calibrated for chronic/sustained events; acute short-duration events are systematically undershooted by 17–75%.
4. **Spatial Resolution:** ERA5 operates at ~31km and CMIP6 at 20-50km. Sub-city microclimatic variations are not natively captured without frontend mitigation offsets.
5. **No Deterministic Forecasting:** All outputs represent plausible risk horizons under stated SSP scenarios, not meteorological forecasts.
6. **Socioeconomic Provenance:** Vault data reflects 2023-2024 census/World Bank snapshots. Values are periodically reviewed; dynamic scraping is explicitly prohibited to prevent data poisoning.

---

## 7. Scientific Citations

- Gasparrini A. et al. (2017). Projections of temperature-related excess mortality under climate change scenarios. Lancet Planetary Health.
- Burke M. et al. (2018). Global non-linear effect of temperature on economic production. Nature.
- ILO (2019). Working on a Warmer Planet: The Impact of Heat Stress on Labour Productivity.
- Sherwood S.C. & Huber M. (2010). An adaptability limit to climate change due to heat stress. PNAS.
- Anderson, G.B., & Bell, M.L. (2011). Heat Waves in the United States: Mortality Risk during Heat Waves and Effect Modification... Environmental Health Perspectives.
- Hersbach H. et al. (2020). The ERA5 global reanalysis. Q. J. R. Meteorol. Soc.
- IPCC AR6 WG1 (2021). Climate Change 2021: The Physical Science Basis. Cambridge University Press.
