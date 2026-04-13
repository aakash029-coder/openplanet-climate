# OpenPlanet: Scientific Protocol & Methodology

Version: 1.0.0 (Release Candidate)  
Status: Pending DPGA / OS-Climate Peer Review  
Architecture: Stateless, vectorized pure-function pipeline (Python/NumPy)  

---

## 1. Abstract
The OpenPlanet Climate Engine is a high-resolution translation layer that converts raw climatological data into localized financial and epidemiological risk metrics. It operates as a deterministic, purely functional pipeline, ensuring reproducibility and strict separation between spatial data querying and scientific computation.

All outputs are driven by live queries to Copernicus ERA5 and CMIP6 ensembles, processed through peer-reviewed dose-response functions. No manual lookup tables or static national averages are used for climate data.

---

## 2. Core Data Pipelines

### 2.1 Historical Baseline (ERA5)
The heatwave threshold is an emergent, data-driven property of each coordinate's 30-year climatology.
- Source: Open-Meteo ERA5 Reanalysis Archive (mirrors ECMWF Copernicus).
- Resolution: ~31km spatial grid.
- Method: We compute the 95th percentile (P95) from ~10,950 daily $T_{max}$ observations across the WMO standard 1991–2020 climate normal period.
- Tx5d Index: Mean temperature of the hottest consecutive 5-day block, consistent with WMO ETCCDI standards.

### 2.2 Future Projections (CMIP6 Ensemble)
Near-term projections (2015–2050) utilize a 3-model CMIP6 ensemble (e.g., MRI-AGCM3-2-S, NICAM16-8S, MPI-ESM1-2-XR) using equal-weight averaging per IPCC AR6 methodology.

For 2075 and 2100 projections, the engine applies IPCC AR6 WG1 published regional warming deltas (Ch. 4 Table 4.5; Ch. 11 Table 11.1) to the ERA5-anchored 2050 baseline:
$$V(t) = V_{ERA5\_baseline} + IPCC\_AR6\_delta(ssp, t)$$

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
1.  City GDP Interpolation: City-level GDP is estimated from national World Bank GDP/capita scaled by metro population and an urban productivity ratio. No unified global API exists for direct municipal GDP.
2.  Mortality Confidence: Death estimates carry a $\pm 15\%$ uncertainty margin derived from the Gasparrini beta coefficient variance.
3.  Spatial Resolution: ERA5 operates at ~31km and CMIP6 at 20-50km. Sub-city microclimatic variations (e.g., street-level urban canyons) are not natively captured without frontend mitigation offsets.
4.  No Deterministic Forecasting: All outputs represent plausible risk horizons under stated SSP scenarios, not meteorological forecasts.

---

## 7. Scientific Citations

- Gasparrini A. et al. (2017). Projections of temperature-related excess mortality under climate change scenarios. Lancet Planetary Health.
- Burke M. et al. (2018). Global non-linear effect of temperature on economic production. Nature.
- ILO (2019). Working on a Warmer Planet: The Impact of Heat Stress on Labour Productivity.
- Sherwood S.C. & Huber M. (2010). An adaptability limit to climate change due to heat stress. PNAS.
- Anderson, G.B., & Bell, M.L. (2011). Heat Waves in the United States: Mortality Risk during Heat Waves and Effect Modification... Environmental Health Perspectives.
- Hersbach H. et al. (2020). The ERA5 global reanalysis. Q. J. R. Meteorol. Soc.
- IPCC AR6 WG1 (2021). Climate Change 2021: The Physical Science Basis. Cambridge University Press.
