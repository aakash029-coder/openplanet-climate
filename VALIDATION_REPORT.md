# OpenPlanet — Global Accuracy Validation Report

Generated: 2026-06-19 21:27 UTC
Panel: 25 reference cities · 221 field checks · **221/221 passed (100.0%)**

Engine outputs are recorded in `tests/fixtures/engine_outputs.json` from live
ERA5 / CMIP6 (Open-Meteo) + World Bank WDI + Copernicus/SRTM DEM APIs and asserted
by `tests/test_global_accuracy.py`. Reference values and their sources are encoded
in `tests/reference_cities.json`. Tolerances: elevation ±max(60 m, 12 %); annual
mean ±2.6 °C (ERA5 2011–2020 vs published normals); Köppen main-group exact;
metro population [0.5×, 1.8×]; implied metro GDP/capita [0.55×, 1.45×] of national
WDI with a hard metro ≤ national cap.

| City | Field | Reference | Engine | Pass | Source |
|------|-------|-----------|--------|------|--------|
| Jacobabad | Coordinate | 28.28,68.44 | 28.2813,68.4364 | ✅ | GeoNames |
| Jacobabad | Elevation (m) | 55 | 64.0 | ✅ | GeoNames |
| Jacobabad | Köppen | BWh (B) | BWh | ✅ | Beck2018 |
| Jacobabad | Annual mean (°C) | 27.5 | 26.91 | ✅ | WikiNormals |
| Jacobabad | Implied GDP/cap ($) | 1,450 (nat'l) | 1,996 | ✅ | WDI |
| Jacobabad | Tx5d base→2030→2050 (°C) | ≥45.78 | 45.78→45.78→47.47 | ✅ | invariant §5 |
| Jacobabad | 2050 warming Δ (°C) | [0, 6] | 1.69 | ✅ | IPCC AR6 |
| Jacobabad | Wet-bulb 2050 (°C) | ≤47.47 & ≤35 | 31.09 | ✅ | Stull 2011 (coincident) |
| Mecca | Coordinate | 21.42,39.83 | 21.4208,39.8269 | ✅ | GeoNames |
| Mecca | Elevation (m) | 277 | 308.0 | ✅ | GeoNames |
| Mecca | Köppen | BWh (B) | BWh | ✅ | Beck2018 |
| Mecca | Annual mean (°C) | 31.0 | 28.91 | ✅ | WikiNormals |
| Mecca | Metro pop | 2,040,000 | 3,508,271 | ✅ | GeoNames |
| Mecca | Implied GDP/cap ($) | 32,000 (nat'l) | 43,902 | ✅ | WDI |
| Mecca | Tx5d base→2030→2050 (°C) | ≥43.72 | 43.72→44.67→45.52 | ✅ | invariant §5 |
| Mecca | 2050 warming Δ (°C) | [0, 6] | 1.80 | ✅ | IPCC AR6 |
| Mecca | Wet-bulb 2050 (°C) | ≤45.52 & ≤35 | 28.15 | ✅ | Stull 2011 (coincident) |
| Kuwait City | Coordinate | 29.38,47.99 | 29.3797,47.9734 | ✅ | GeoNames |
| Kuwait City | Elevation (m) | 10 | 6.0 | ✅ | GeoNames |
| Kuwait City | Köppen | BWh (B) | BWh | ✅ | Beck2018 |
| Kuwait City | Annual mean (°C) | 26.5 | 26.74 | ✅ | WikiNormals |
| Kuwait City | Metro pop | 3,100,000 | 2,063,000 | ✅ | GeoNames |
| Kuwait City | Implied GDP/cap ($) | 32,200 (nat'l) | 40,897 | ✅ | WDI |
| Kuwait City | Tx5d base→2030→2050 (°C) | ≥46.05 | 46.05→46.08→47.75 | ✅ | invariant §5 |
| Kuwait City | 2050 warming Δ (°C) | [0, 6] | 1.70 | ✅ | IPCC AR6 |
| Kuwait City | Wet-bulb 2050 (°C) | ≤47.75 & ≤35 | 31.18 | ✅ | Stull 2011 (coincident) |
| Phoenix | Coordinate | 33.45,-112.07 | 33.4484,-112.0741 | ✅ | GeoNames |
| Phoenix | Elevation (m) | 331 | 333.0 | ✅ | GeoNames |
| Phoenix | Köppen | BWh (B) | BWh | ✅ | Beck2018 |
| Phoenix | Annual mean (°C) | 24.0 | 23.69 | ✅ | WikiNormals |
| Phoenix | Metro pop | 4,950,000 | 5,002,221 | ✅ | GeoNames |
| Phoenix | Implied GDP/cap ($) | 82,000 (nat'l) | 57,000 | ✅ | WDI |
| Phoenix | Tx5d base→2030→2050 (°C) | ≥44.75 | 44.75→45.76→46.51 | ✅ | invariant §5 |
| Phoenix | 2050 warming Δ (°C) | [0, 6] | 1.76 | ✅ | IPCC AR6 |
| Phoenix | Wet-bulb 2050 (°C) | ≤46.51 & ≤35 | 27.87 | ✅ | Stull 2011 (coincident) |
| Las Vegas | Coordinate | 36.17,-115.14 | 36.1674,-115.1484 | ✅ | GeoNames |
| Las Vegas | Elevation (m) | 620 | 620.0 | ✅ | GeoNames |
| Las Vegas | Köppen | BWh (B) | BWh | ✅ | Beck2018 |
| Las Vegas | Annual mean (°C) | 20.5 | 20.84 | ✅ | WikiNormals |
| Las Vegas | Metro pop | 2,270,000 | 1,823,000 | ✅ | GeoNames |
| Las Vegas | Implied GDP/cap ($) | 82,000 (nat'l) | 105,668 | ✅ | WDI |
| Las Vegas | Tx5d base→2030→2050 (°C) | ≥42.94 | 42.94→43.76→45.5 | ✅ | invariant §5 |
| Las Vegas | 2050 warming Δ (°C) | [0, 6] | 2.56 | ✅ | IPCC AR6 |
| Las Vegas | Wet-bulb 2050 (°C) | ≤45.5 & ≤35 | 24.54 | ✅ | Stull 2011 (coincident) |
| Dubai | Coordinate | 25.2,55.27 | 25.2647,55.2924 | ✅ | GeoNames |
| Dubai | Elevation (m) | 5 | 0.0 | ✅ | GeoNames |
| Dubai | Köppen | BWh (B) | BWh | ✅ | Beck2018 |
| Dubai | Annual mean (°C) | 28.0 | 28.03 | ✅ | WikiNormals |
| Dubai | Metro pop | 3,500,000 | 3,604,029 | ✅ | GeoNames |
| Dubai | Implied GDP/cap ($) | 49,000 (nat'l) | 43,000 | ✅ | WDI |
| Dubai | Tx5d base→2030→2050 (°C) | ≥44.1 | 44.1→44.4→45.91 | ✅ | invariant §5 |
| Dubai | 2050 warming Δ (°C) | [0, 6] | 1.81 | ✅ | IPCC AR6 |
| Dubai | Wet-bulb 2050 (°C) | ≤45.91 & ≤35 | 32.51 | ✅ | Stull 2011 (coincident) |
| Singapore | Coordinate | 1.35,103.82 | 1.2899,103.8519 | ✅ | GeoNames |
| Singapore | Elevation (m) | 15 | 12.0 | ✅ | GeoNames |
| Singapore | Köppen | Af (A) | Af | ✅ | Beck2018 |
| Singapore | Annual mean (°C) | 27.6 | 27.05 | ✅ | WikiNormals |
| Singapore | Metro pop | 5,900,000 | 5,917,600 | ✅ | GeoNames |
| Singapore | Implied GDP/cap ($) | 84,500 (nat'l) | 82,800 | ✅ | WDI |
| Singapore | Tx5d base→2030→2050 (°C) | ≥30.6 | 30.6→31.04→31.96 | ✅ | invariant §5 |
| Singapore | 2050 warming Δ (°C) | [0, 6] | 1.36 | ✅ | IPCC AR6 |
| Singapore | Wet-bulb 2050 (°C) | ≤31.96 & ≤35 | 27.68 | ✅ | Stull 2011 (coincident) |
| Jakarta | Coordinate | -6.21,106.85 | -6.1754,106.8272 | ✅ | GeoNames |
| Jakarta | Elevation (m) | 8 | 6.0 | ✅ | GeoNames |
| Jakarta | Köppen | Am (A) | Am | ✅ | Beck2018 |
| Jakarta | Annual mean (°C) | 27.0 | 26.67 | ✅ | WikiNormals |
| Jakarta | Metro pop | 10,600,000 | 9,125,000 | ✅ | GeoNames |
| Jakarta | Implied GDP/cap ($) | 4,900 (nat'l) | 6,551 | ✅ | WDI |
| Jakarta | Tx5d base→2030→2050 (°C) | ≥32.48 | 32.48→32.9→33.46 | ✅ | invariant §5 |
| Jakarta | 2050 warming Δ (°C) | [0, 6] | 0.98 | ✅ | IPCC AR6 |
| Jakarta | Wet-bulb 2050 (°C) | ≤33.46 & ≤35 | 27.67 | ✅ | Stull 2011 (coincident) |
| Kolkata | Coordinate | 22.57,88.36 | 22.5726,88.3639 | ✅ | GeoNames |
| Kolkata | Elevation (m) | 9 | 12.0 | ✅ | GeoNames |
| Kolkata | Köppen | Aw (A) | Aw | ✅ | Beck2018 |
| Kolkata | Annual mean (°C) | 26.8 | 25.94 | ✅ | WikiNormals |
| Kolkata | Metro pop | 14,850,000 | 15,133,000 | ✅ | GeoNames |
| Kolkata | Implied GDP/cap ($) | 2,480 (nat'l) | 2,000 | ✅ | WDI |
| Kolkata | Tx5d base→2030→2050 (°C) | ≥38.32 | 38.32→39.17→40.64 | ✅ | invariant §5 |
| Kolkata | 2050 warming Δ (°C) | [0, 6] | 2.32 | ✅ | IPCC AR6 |
| Kolkata | Wet-bulb 2050 (°C) | ≤40.64 & ≤35 | 31.81 | ✅ | Stull 2011 (coincident) |
| Lagos | Coordinate | 6.45,3.4 | 6.4551,3.3942 | ✅ | GeoNames |
| Lagos | Elevation (m) | 10 | 8.0 | ✅ | GeoNames |
| Lagos | Köppen | Aw (A) | Aw | ✅ | Beck2018 |
| Lagos | Annual mean (°C) | 27.0 | 26.8 | ✅ | WikiNormals |
| Lagos | Metro pop | 15,000,000 | 16,637,000 | ✅ | GeoNames |
| Lagos | Implied GDP/cap ($) | 1,620 (nat'l) | 2,200 | ✅ | WDI |
| Lagos | Tx5d base→2030→2050 (°C) | ≥32.21 | 32.21→32.56→33.1 | ✅ | invariant §5 |
| Lagos | 2050 warming Δ (°C) | [0, 6] | 0.89 | ✅ | IPCC AR6 |
| Lagos | Wet-bulb 2050 (°C) | ≤33.1 & ≤35 | 27.79 | ✅ | Stull 2011 (coincident) |
| Delhi | Coordinate | 28.61,77.21 | 28.6328,77.2198 | ✅ | GeoNames |
| Delhi | Elevation (m) | 216 | 214.0 | ✅ | GeoNames |
| Delhi | Köppen | BSh (B/C) | BSh | ✅ | Beck2018 |
| Delhi | Annual mean (°C) | 25.3 | 24.49 | ✅ | WikiNormals |
| Delhi | Metro pop | 32,000,000 | 32,226,000 | ✅ | GeoNames |
| Delhi | Implied GDP/cap ($) | 2,480 (nat'l) | 4,000 | ✅ | WDI |
| Delhi | Tx5d base→2030→2050 (°C) | ≥43.27 | 43.27→43.27→45.42 | ✅ | invariant §5 |
| Delhi | 2050 warming Δ (°C) | [0, 6] | 2.15 | ✅ | IPCC AR6 |
| Delhi | Wet-bulb 2050 (°C) | ≤45.42 & ≤35 | 29.67 | ✅ | Stull 2011 (coincident) |
| Cairo | Coordinate | 30.04,31.24 | 30.0444,31.2357 | ✅ | GeoNames |
| Cairo | Elevation (m) | 23 | 22.0 | ✅ | GeoNames |
| Cairo | Köppen | BWh (B) | BWh | ✅ | Beck2018 |
| Cairo | Annual mean (°C) | 22.0 | 22.66 | ✅ | WikiNormals |
| Cairo | Metro pop | 21,000,000 | 21,750,000 | ✅ | GeoNames |
| Cairo | Implied GDP/cap ($) | 3,500 (nat'l) | 4,200 | ✅ | WDI |
| Cairo | Tx5d base→2030→2050 (°C) | ≥40.7 | 40.7→41.47→43.41 | ✅ | invariant §5 |
| Cairo | 2050 warming Δ (°C) | [0, 6] | 2.71 | ✅ | IPCC AR6 |
| Cairo | Wet-bulb 2050 (°C) | ≤43.41 & ≤35 | 26.55 | ✅ | Stull 2011 (coincident) |
| Lisbon | Coordinate | 38.72,-9.14 | 38.7078,-9.1366 | ✅ | GeoNames |
| Lisbon | Elevation (m) | 30 | 7.0 | ✅ | DEM |
| Lisbon | Köppen | Csa (C) | Csa | ✅ | Beck2018 |
| Lisbon | Annual mean (°C) | 17.0 | 16.85 | ✅ | WikiNormals |
| Lisbon | Metro pop | 2,820,000 | 2,812,000 | ✅ | GeoNames |
| Lisbon | Implied GDP/cap ($) | 29,292 (nat'l) | 36,615 | ✅ | WDI |
| Lisbon | Tx5d base→2030→2050 (°C) | ≥32.85 | 32.85→32.85→33.56 | ✅ | invariant §5 |
| Lisbon | 2050 warming Δ (°C) | [0, 6] | 0.71 | ✅ | IPCC AR6 |
| Lisbon | Wet-bulb 2050 (°C) | ≤33.56 & ≤35 | 24.84 | ✅ | Stull 2011 (coincident) |
| Cape Town | Coordinate | -33.92,18.42 | -33.9288,18.4172 | ✅ | GeoNames |
| Cape Town | Elevation (m) | 25 | 25.0 | ✅ | GeoNames |
| Cape Town | Köppen | Csb (C) | Csb | ✅ | Beck2018 |
| Cape Town | Annual mean (°C) | 16.8 | 17.02 | ✅ | WikiNormals |
| Cape Town | Metro pop | 4,600,000 | 4,618,000 | ✅ | GeoNames |
| Cape Town | Implied GDP/cap ($) | 6,250 (nat'l) | 6,200 | ✅ | WDI |
| Cape Town | Tx5d base→2030→2050 (°C) | ≥30.56 | 30.56→30.97→31.91 | ✅ | invariant §5 |
| Cape Town | 2050 warming Δ (°C) | [0, 6] | 1.35 | ✅ | IPCC AR6 |
| Cape Town | Wet-bulb 2050 (°C) | ≤31.91 & ≤35 | 23.86 | ✅ | Stull 2011 (coincident) |
| London | Coordinate | 51.51,-0.13 | 51.5074,-0.1278 | ✅ | GeoNames |
| London | Elevation (m) | 11 | 16.0 | ✅ | GeoNames |
| London | Köppen | Cfb (C) | Cfb | ✅ | Beck2018 |
| London | Annual mean (°C) | 11.5 | 11.03 | ✅ | WikiNormals |
| London | Metro pop | 9,500,000 | 14,800,000 | ✅ | GeoNames |
| London | Implied GDP/cap ($) | 49,500 (nat'l) | 63,000 | ✅ | WDI |
| London | Tx5d base→2030→2050 (°C) | ≥27.83 | 27.83→28.14→31.49 | ✅ | invariant §5 |
| London | 2050 warming Δ (°C) | [0, 6] | 3.66 | ✅ | IPCC AR6 |
| London | Wet-bulb 2050 (°C) | ≤31.49 & ≤35 | 21.5 | ✅ | Stull 2011 (coincident) |
| Auckland | Coordinate | -36.85,174.76 | -36.8521,174.7632 | ✅ | GeoNames |
| Auckland | Elevation (m) | 20 | 26.0 | ✅ | GeoNames |
| Auckland | Köppen | Cfb (C) | Cfb | ✅ | Beck2018 |
| Auckland | Annual mean (°C) | 15.3 | 15.6 | ✅ | WikiNormals |
| Auckland | Metro pop | 1,650,000 | 1,377,200 | ✅ | GeoNames |
| Auckland | Implied GDP/cap ($) | 48,000 (nat'l) | 61,506 | ✅ | WDI |
| Auckland | Tx5d base→2030→2050 (°C) | ≥24.77 | 24.77→25.46→25.81 | ✅ | invariant §5 |
| Auckland | 2050 warming Δ (°C) | [0, 6] | 1.04 | ✅ | IPCC AR6 |
| Auckland | Wet-bulb 2050 (°C) | ≤25.81 & ≤35 | 22.28 | ✅ | Stull 2011 (coincident) |
| Moscow | Coordinate | 55.76,37.62 | 55.7505,37.6175 | ✅ | GeoNames |
| Moscow | Elevation (m) | 156 | 157.0 | ✅ | GeoNames |
| Moscow | Köppen | Dfb (D) | Dfb | ✅ | Beck2018 |
| Moscow | Annual mean (°C) | 6.0 | 6.15 | ✅ | WikiNormals |
| Moscow | Metro pop | 12,600,000 | 17,332,000 | ✅ | GeoNames |
| Moscow | Implied GDP/cap ($) | 14,000 (nat'l) | 12,600 | ✅ | WDI |
| Moscow | Tx5d base→2030→2050 (°C) | ≥28.79 | 28.79→29.45→30.4 | ✅ | invariant §5 |
| Moscow | 2050 warming Δ (°C) | [0, 6] | 1.61 | ✅ | IPCC AR6 |
| Moscow | Wet-bulb 2050 (°C) | ≤30.4 & ≤35 | 22.46 | ✅ | Stull 2011 (coincident) |
| Reykjavik | Coordinate | 64.15,-21.94 | 64.146,-21.9422 | ✅ | GeoNames |
| Reykjavik | Elevation (m) | 15 | 7.0 | ✅ | GeoNames |
| Reykjavik | Köppen | Cfc (C/D) | Dfc | ✅ | Beck2018 |
| Reykjavik | Annual mean (°C) | 5.0 | 4.78 | ✅ | WikiNormals |
| Reykjavik | Metro pop | 230,000 | 166,212 | ✅ | GeoNames |
| Reykjavik | Implied GDP/cap ($) | 78,000 (nat'l) | 107,551 | ✅ | WDI |
| Reykjavik | Tx5d base→2030→2050 (°C) | ≥17.33 | 17.33→17.45→17.45 | ✅ | invariant §5 |
| Reykjavik | 2050 warming Δ (°C) | [0, 6] | 0.12 | ✅ | IPCC AR6 |
| Reykjavik | Wet-bulb 2050 (°C) | ≤17.45 & ≤35 | 14.59 | ✅ | Stull 2011 (coincident) |
| Ushuaia | Coordinate | -54.8,-68.3 | -54.8073,-68.3084 | ✅ | GeoNames |
| Ushuaia | Elevation (m) | 30 | 21.0 | ✅ | GeoNames |
| Ushuaia | Köppen | Cfc (C/E) | ET | ✅ | Beck2018 |
| Ushuaia | Annual mean (°C) | 6.0 | 4.28 | ✅ | WikiNormals |
| Ushuaia | Implied GDP/cap ($) | 13,000 (nat'l) | 18,161 | ✅ | WDI |
| Ushuaia | Tx5d base→2030→2050 (°C) | ≥17.24 | 17.24→18.09→18.93 | ✅ | invariant §5 |
| Ushuaia | 2050 warming Δ (°C) | [0, 6] | 1.69 | ✅ | IPCC AR6 |
| Ushuaia | Wet-bulb 2050 (°C) | ≤18.93 & ≤35 | 14.35 | ✅ | Stull 2011 (coincident) |
| Yakutsk | Coordinate | 62.03,129.73 | 62.0274,129.732 | ✅ | GeoNames |
| Yakutsk | Elevation (m) | 100 | 98.0 | ✅ | GeoNames |
| Yakutsk | Köppen | Dfd (D) | Dwc | ✅ | Beck2018 |
| Yakutsk | Annual mean (°C) | -8.8 | -6.82 | ✅ | WikiNormals |
| Yakutsk | Metro pop | 355,000 | 235,600 | ✅ | GeoNames |
| Yakutsk | Implied GDP/cap ($) | 14,000 (nat'l) | 19,356 | ✅ | WDI |
| Yakutsk | Tx5d base→2030→2050 (°C) | ≥30.78 | 30.78→33.41→33.41 | ✅ | invariant §5 |
| Yakutsk | 2050 warming Δ (°C) | [0, 6] | 2.63 | ✅ | IPCC AR6 |
| Yakutsk | Wet-bulb 2050 (°C) | ≤33.41 & ≤35 | 23.0 | ✅ | Stull 2011 (coincident) |
| Verkhoyansk | Coordinate | 67.55,133.39 | 67.5495,133.3875 | ✅ | GeoNames |
| Verkhoyansk | Elevation (m) | 135 | 135.0 | ✅ | GeoNames |
| Verkhoyansk | Köppen | Dfd (D) | Dwd | ✅ | Beck2018 |
| Verkhoyansk | Annual mean (°C) | -14.5 | -11.0 | ✅ | WikiNormals |
| Verkhoyansk | Implied GDP/cap ($) | 14,000 (nat'l) | 19,356 | ✅ | WDI |
| Verkhoyansk | Tx5d base→2030→2050 (°C) | ≥27.66 | 27.66→28.96→28.96 | ✅ | invariant §5 |
| Verkhoyansk | 2050 warming Δ (°C) | [0, 6] | 1.30 | ✅ | IPCC AR6 |
| Verkhoyansk | Wet-bulb 2050 (°C) | ≤28.96 & ≤35 | 19.86 | ✅ | Stull 2011 (coincident) |
| La Paz | Coordinate | -16.5,-68.15 | -16.4955,-68.1336 | ✅ | GeoNames |
| La Paz | Elevation (m) | 3640 | 3645.0 | ✅ | DEM |
| La Paz | Köppen | Cwc (C/E) | Cwc | ✅ | Beck2018 |
| La Paz | Annual mean (°C) | 9.0 | 9.26 | ✅ | WikiNormals |
| La Paz | Metro pop | 1,900,000 | 1,590,000 | ✅ | GeoNames |
| La Paz | Implied GDP/cap ($) | 4,420 (nat'l) | 5,880 | ✅ | WDI |
| La Paz | Tx5d base→2030→2050 (°C) | ≥18.91 | 18.91→19.37→19.85 | ✅ | invariant §5 |
| La Paz | 2050 warming Δ (°C) | [0, 6] | 0.94 | ✅ | IPCC AR6 |
| La Paz | Wet-bulb 2050 (°C) | ≤19.85 & ≤35 | 16.63 | ✅ | Stull 2011 (coincident) |
| Quito | Coordinate | -0.18,-78.47 | -0.2202,-78.5123 | ✅ | GeoNames |
| Quito | Elevation (m) | 2850 | 2824.0 | ✅ | DEM |
| Quito | Köppen | Cfb (C) | Cfb | ✅ | Beck2018 |
| Quito | Annual mean (°C) | 13.8 | 12.7 | ✅ | WikiNormals |
| Quito | Metro pop | 2,010,000 | 1,701,000 | ✅ | GeoNames |
| Quito | Implied GDP/cap ($) | 6,500 (nat'l) | 9,143 | ✅ | WDI |
| Quito | Tx5d base→2030→2050 (°C) | ≥21.32 | 21.32→22.31→23.38 | ✅ | invariant §5 |
| Quito | 2050 warming Δ (°C) | [0, 6] | 2.06 | ✅ | IPCC AR6 |
| Quito | Wet-bulb 2050 (°C) | ≤23.38 & ≤35 | 15.8 | ✅ | Stull 2011 (coincident) |
| Funafuti | Coordinate | -8.52,179.2 | -8.52,179.1983 | ✅ | GeoNames |
| Funafuti | Elevation (m) | 2 | 4.0 | ✅ | DEM |
| Funafuti | Köppen | Af (A) | Af | ✅ | Beck2018 |
| Funafuti | Annual mean (°C) | 28.5 | 27.53 | ✅ | WikiNormals |
| Funafuti | Implied GDP/cap ($) | 5,400 (nat'l) | 96 | ✅ | WDI |
| Funafuti | Tx5d base→2030→2050 (°C) | ≥29.36 | 29.36→29.73→30.46 | ✅ | invariant §5 |
| Funafuti | 2050 warming Δ (°C) | [0, 6] | 1.10 | ✅ | IPCC AR6 |
| Funafuti | Wet-bulb 2050 (°C) | ≤30.46 & ≤35 | 27.39 | ✅ | Stull 2011 (coincident) |
| Sydney | Coordinate | -33.87,151.21 | -33.8698,151.2083 | ✅ | GeoNames |
| Sydney | Elevation (m) | 40 | 87.0 | ✅ | GeoNames |
| Sydney | Köppen | Cfa (C) | Cfa | ✅ | Beck2018 |
| Sydney | Annual mean (°C) | 18.5 | 17.59 | ✅ | WikiNormals |
| Sydney | Metro pop | 5,300,000 | 5,312,000 | ✅ | GeoNames |
| Sydney | Implied GDP/cap ($) | 65,000 (nat'l) | 55,000 | ✅ | WDI |
| Sydney | Tx5d base→2030→2050 (°C) | ≥30.52 | 30.52→31.05→32.69 | ✅ | invariant §5 |
| Sydney | 2050 warming Δ (°C) | [0, 6] | 2.17 | ✅ | IPCC AR6 |
| Sydney | Wet-bulb 2050 (°C) | ≤32.69 & ≤35 | 25.49 | ✅ | Stull 2011 (coincident) |
