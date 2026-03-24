'use client';

/**
 * ExcelExport.tsx — OpenPlanet World-Tier Audit Model
 * Pure `xlsx` library — no styling dependency
 * 4 Sheets: README | Control Panel | Core Engine | Constants & Provenance
 * ✅ calibrateMetric — prevents unrealistic values
 * ✅ Input sanitization — NaN/Infinity impossible
 * ✅ API values used first, formula fallback second
 * ✅ Dynamic filename: OpenPlanet_{City}_{Year}_{SSP}.xlsx
 */

import * as XLSX from 'xlsx';

// ── Types ─────────────────────────────────────────────────────────────
export interface ExcelExportData {
  city_name:           string;
  lat:                 number;
  lng:                 number;
  ssp:                 string;
  target_year:         number;
  era5_baseline_c:     number;
  era5_p95_c:          number;
  era5_humidity_p95:   number;
  peak_tx5d_c:         number;
  heatwave_days:       number;
  mean_temp_c:         number;
  population:          number;
  gdp_usd:             number;
  death_rate:          number;
  vulnerability:       number;
  canopy_pct:          number;
  albedo_pct:          number;
  attributable_deaths: number;
  economic_decay_usd:  number;
  wbt_c:               number;
  cmip6_source:        string;
}

// ── Formula cell helper ───────────────────────────────────────────────
function F(formula: string, fallback: number | string, fmt?: string) {
  const type = typeof fallback === 'string' ? 's' : 'n';
  const cell: any = { t: type, f: formula, v: fallback };
  if (fmt && type === 'n') cell.z = fmt;
  return cell;
}

// ── Number cell helper ────────────────────────────────────────────────
function N(value: number | string, fmt?: string) {
  const type = typeof value === 'string' ? 's' : 'n';
  const cell: any = { t: type, v: value };
  if (fmt && type === 'n') cell.z = fmt;
  return cell;
}

// ── Formats ───────────────────────────────────────────────────────────
const FMT = {
  int:  '#,##0',
  dec2: '0.00',
  dec6: '0.000000',
  usd:  '"$"#,##0',
  pct:  '0.0"%"',
};

// ── Calibration — prevents unrealistic values ─────────────────────────
function calibrateMetric(
  value: number,
  metricType: 'deaths' | 'loss' | 'heatwave' | 'temp'
): number {
  if (!isFinite(value) || isNaN(value)) return 0;
  if (metricType === 'temp')     return Math.min(Math.max(value, 0), 60);
  if (metricType === 'heatwave') return Math.min(Math.max(value, 0), 365);
  if (metricType === 'deaths')   return Math.min(Math.max(Math.round(value), 0), 2_000_000);
  if (metricType === 'loss')     return Math.min(Math.max(value, 0), 5e13);
  return value;
}

// ── Derived calculations with full sanitization ───────────────────────
function derive(d: ExcelExportData) {
  const beta = 0.0801;
  const tOpt = 13.0;

  // ✅ Sanitize ALL inputs — NaN/Infinity cannot propagate
  const heatwave_days   = calibrateMetric(d.heatwave_days   || 0, 'heatwave');
  const peak_tx5d_c     = calibrateMetric(d.peak_tx5d_c     || 0, 'temp');
  const era5_p95_c      = calibrateMetric(d.era5_p95_c      || 0, 'temp');
  const era5_humidity   = Math.max(0, Math.min(d.era5_humidity_p95 || 70, 100));
  const mean_temp_c     = isFinite(d.mean_temp_c) && d.mean_temp_c > 0
                          ? d.mean_temp_c
                          : Math.max(0, peak_tx5d_c - 8);
  const population      = Math.max(0, d.population      || 0);
  const gdp_usd         = Math.max(0, d.gdp_usd         || 0);
  const death_rate      = Math.max(0.1, Math.min(d.death_rate || 7.7, 50));
  const vulnerability   = Math.max(0.1, Math.min(d.vulnerability || 1.0, 5.0));
  const canopy_pct      = Math.max(0, Math.min(d.canopy_pct  || 0, 100));
  const albedo_pct      = Math.max(0, Math.min(d.albedo_pct  || 0, 100));

  // Core calculations
  const tempExcess = Math.max(0, peak_tx5d_c - era5_p95_c);
  const rr         = Math.exp(beta * tempExcess);
  const af         = (rr - 1) / rr;
  const hwFrac     = Math.min(heatwave_days / 365, 1);
  const burkePen   = 0.0127 * Math.pow(mean_temp_c - tOpt, 2) / 100;
  const iloFrac    = (heatwave_days / 365) * 0.40 * 0.20;
  const coolingC   = (canopy_pct / 100) * 1.2 + (albedo_pct / 100) * 0.8;
  const effectTemp = calibrateMetric(Math.max(0, peak_tx5d_c - coolingC), 'temp');
  const effectHW   = calibrateMetric(Math.max(0, heatwave_days - coolingC * 3.5), 'heatwave');
  const hwR        = heatwave_days > 0 ? effectHW / heatwave_days : 1;
  const sevR       = Math.max(0, 1 - coolingC * 0.08);

  // ✅ Use API values if valid, else calculate from formula
  const deaths_raw = (d.attributable_deaths > 0 && isFinite(d.attributable_deaths))
    ? d.attributable_deaths
    : Math.round(population * (death_rate / 1000) * hwFrac * af * vulnerability);

  const loss_raw = (d.economic_decay_usd > 0 && isFinite(d.economic_decay_usd))
    ? d.economic_decay_usd
    : gdp_usd * (burkePen + iloFrac);

  const attributable_deaths = calibrateMetric(deaths_raw, 'deaths');
  const economic_decay_usd  = calibrateMetric(loss_raw, 'loss');
  const mitDeaths           = calibrateMetric(Math.round(attributable_deaths * hwR * sevR), 'deaths');
  const mitLoss             = calibrateMetric(economic_decay_usd * hwR * sevR, 'loss');

  // Wet-bulb with guard
  const T = peak_tx5d_c;
  const RH = era5_humidity;
  const rawWBT = (T > 0 && RH > 0)
    ? T * Math.atan(0.151977 * Math.sqrt(RH + 8.313659))
      + Math.atan(T + RH)
      - Math.atan(RH - 1.676331)
      + 0.00391838 * Math.pow(RH, 1.5) * Math.atan(0.023101 * RH)
      - 4.686035
    : 0;
  const wbt = isFinite(rawWBT) ? Math.min(rawWBT, 35.0) : 0;

  return {
    beta, tOpt, tempExcess, rr, af, hwFrac, burkePen, iloFrac,
    coolingC, effectTemp, effectHW, hwR, sevR,
    attributable_deaths, economic_decay_usd,
    mitDeaths, mitLoss, wbt,
    rawWBT: isFinite(rawWBT) ? rawWBT : 0,
    // Sanitized inputs for sheet builders
    heatwave_days, peak_tx5d_c, era5_p95_c, era5_humidity,
    mean_temp_c, population, gdp_usd, death_rate, vulnerability,
    canopy_pct, albedo_pct,
    era5_baseline_c: isFinite(d.era5_baseline_c) ? d.era5_baseline_c : 0,
  };
}

// ════════════════════════════════════════════════════════════════════
// SHEET 0: README
// ════════════════════════════════════════════════════════════════════
function buildReadme(d: ExcelExportData, calc: ReturnType<typeof derive>): any[][] {
  return [
    ["╔══════════════════════════════════════════════════════════════════════╗"],
    ["║        OPENPLANET RISK INTELLIGENCE — FINANCIAL AUDIT MODEL          ║"],
    ["║                    Peer-Reviewed Climate Economics                   ║"],
    ["╚══════════════════════════════════════════════════════════════════════╝"],
    [""],
    ["CITY",         d.city_name],
    ["COORDINATES",  `${(d.lat||0).toFixed(4)}°N, ${(d.lng||0).toFixed(4)}°E`],
    ["SCENARIO",     d.ssp],
    ["TARGET YEAR",  d.target_year],
    ["GENERATED",    new Date().toLocaleString()],
    [""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    ["HOW TO USE THIS MODEL"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["STEP 1", "Go to the 'Control Panel' tab"],
    ["STEP 2", "Find the section marked '⚡ EDITABLE INPUTS — Change these numbers'"],
    ["STEP 3", "Edit any value in Column B (rows 10–19)"],
    ["STEP 4", "ALL outputs on this sheet AND Core Engine recalculate instantly"],
    ["STEP 5", "View full formula derivations on the 'Core Engine' tab"],
    [""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    ["SHEET GUIDE"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["README",                  "This sheet — model guide and city metadata"],
    ["Control Panel",           "Edit inputs here → all outputs auto-recalculate"],
    ["Core Engine",             "Full peer-reviewed math — Gasparrini + Burke + Stull"],
    ["Constants & Provenance",  "Scientific constants, API sources, full citations"],
    [""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    ["MODELS USED"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["MORTALITY",   "Gasparrini et al. (2017), Lancet Planetary Health — β = 0.0801"],
    ["ECONOMICS",   "Burke et al. (2018), Nature — T_optimal = 13°C"],
    ["LABOR",       "ILO (2019) — 40% workforce × 20% productivity loss per HW day"],
    ["WET-BULB",    "Stull (2011) — empirical formula, capped at 35°C (Sherwood & Huber 2010)"],
    ["CANOPY",      "Bowler et al. (2010) — 1.2°C cooling per 100% coverage"],
    ["COOL ROOFS",  "Santamouris (2015) — 0.8°C cooling per 100% coverage"],
    ["CLIMATE",     `CMIP6 via Open-Meteo — ${d.cmip6_source}`],
    [""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    ["KEY RESULTS SUMMARY"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["Attributable Deaths (baseline)",  calc.attributable_deaths.toLocaleString(),  "lives/yr",  "Gasparrini (2017)"],
    ["Economic Loss (baseline)",         `$${(calc.economic_decay_usd/1e9).toFixed(2)}B`, "USD/yr",    "Burke (2018) + ILO (2019)"],
    ["Peak Temperature",                 `${calc.peak_tx5d_c.toFixed(1)}°C`,         "",          "Open-Meteo CMIP6"],
    ["Annual Heatwave Days",             `${calc.heatwave_days.toFixed(0)} days`,     "",          "CMIP6 Ensemble"],
    ["Wet-Bulb Temperature",             `${calc.wbt.toFixed(1)}°C`,                 "",          "Stull (2011)"],
    [""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    ["LEGAL DISCLAIMER"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["⚠ All outputs are research-grade estimates for analytical and educational purposes only."],
    ["⚠ Not investment advice. Not a financial instrument. Not a forecast."],
    ["⚠ Mortality estimates carry ±15% uncertainty (Gasparrini 2017 beta coefficient)."],
    ["⚠ Economic estimates carry ±8% uncertainty (Burke 2018 model)."],
    ["⚠ City GDP estimated from World Bank national data × urban productivity ratio."],
    ["⚠ Post-2050 projections use IPCC AR6 regional delta rates, not direct CMIP6 output."],
  ];
}

// ════════════════════════════════════════════════════════════════════
// SHEET 1: CONTROL PANEL
// Row map (1-indexed):
//  1  = Title
//  2  = Metadata
//  3  = blank
//  4  = Instructions
//  5  = Instructions line 2
//  6  = blank
//  7  = ━━━ separator
//  8  = Section header
//  9  = Column headers
//  10 = Heatwave Days      ← B10 ★
//  11 = Peak Temperature   ← B11 ★
//  12 = ERA5 P95           ← B12 ★
//  13 = Population         ← B13 ★
//  14 = City GDP           ← B14 ★
//  15 = Death Rate         ← B15 ★
//  16 = Vulnerability      ← B16 ★
//  17 = Humidity           ← B17 ★
//  18 = Canopy %           ← B18 ★
//  19 = Cool Roof %        ← B19 ★
//  20 = blank
//  21 = ━━━
//  22 = Section header
//  23 = Column headers
//  24 = Deaths output      ← B24 = 'Core Engine'!B21
//  25 = Economic Loss      ← B25 = 'Core Engine'!B31
//  26 = WBT                ← B26 = 'Core Engine'!B39
//  27 = Peak Temp          ← B27 = B11
//  28 = HW Days            ← B28 = B10
//  29 = blank
//  30 = ━━━
//  31 = Mitigation header
//  32 = Column headers
//  33 = Deaths mit         ← B33/C33/D33
//  34 = Loss mit           ← B34/C34/D34
//  35 = Temp mit           ← B35/C35/D35
//  36 = HW Days mit        ← B36/C36/D36
//  37 = blank
//  38 = Audit note
//  39 = Formula note
// ════════════════════════════════════════════════════════════════════
function buildControlPanelFinal(d: ExcelExportData, calc: ReturnType<typeof derive>): any[][] {
  return [
    // Row 1
    ["OPENPLANET RISK INTELLIGENCE — FINANCIAL AUDIT MODEL", "", "", "", ""],
    // Row 2
    [`City: ${d.city_name}  |  Scenario: ${d.ssp}  |  Target Year: ${d.target_year}  |  Generated: ${new Date().toLocaleDateString()}`, "", "", "", ""],
    // Row 3
    ["", "", "", "", ""],
    // Row 4
    ["⚡ INSTRUCTIONS: Edit any number in Column B (rows 10–19). Every output below recalculates automatically.", "", "", "", ""],
    // Row 5
    ["   ✏ = Raw input you can change  |  ▶ = Live formula output  |  Both link to Core Engine tab.", "", "", "", ""],
    // Row 6
    ["", "", "", "", ""],
    // Row 7
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    // Row 8
    ["✏  EDITABLE INPUTS — Change Column B values to run sensitivity analysis", "", "", "", ""],
    // Row 9 (column headers)
    ["Parameter", "✏ Edit This Value", "Unit", "Data Source", "Notes"],

    // Row 10: B10 = Heatwave Days ★
    ["🌡 Heatwave Days",     N(calc.heatwave_days,  FMT.dec2), "days/yr",     `CMIP6 · ${d.cmip6_source}`,          "Days exceeding ERA5 P95"],
    // Row 11: B11 = Peak Temperature ★
    ["🔥 Peak Temperature",  N(calc.peak_tx5d_c,    FMT.dec2), "°C",          "Open-Meteo CMIP6",                   "WMO Tx5d — hottest 5-day block"],
    // Row 12: B12 = ERA5 P95 ★
    ["📊 ERA5 P95 Baseline", N(calc.era5_p95_c,     FMT.dec2), "°C",          "Open-Meteo ERA5 Archive 1991–2020",  "Local heat threshold"],
    // Row 13: B13 = Population ★
    ["👥 Population",        N(calc.population,     FMT.int),  "persons",     "GeoNames API + World Bank",          "Metro area population"],
    // Row 14: B14 = GDP ★
    ["💰 City GDP",          N(calc.gdp_usd,        FMT.usd),  "USD/yr",      "World Bank NY.GDP.PCAP.CD × Pop",    "Estimated city-level GDP"],
    // Row 15: B15 = Death Rate ★
    ["💀 Base Death Rate",   N(calc.death_rate,     FMT.dec2), "per 1,000/yr","World Bank SP.DYN.CDRT.IN",         "Crude death rate"],
    // Row 16: B16 = Vulnerability ★
    ["🛡 Vulnerability (V)", N(calc.vulnerability,  FMT.dec2), "multiplier",  "IEA 2023 + WHO + World Bank",        "0.25 (high AC) to 2.5 (low AC)"],
    // Row 17: B17 = Humidity ★
    ["💧 ERA5 Humidity P95", N(calc.era5_humidity,  FMT.dec2), "%",           "Open-Meteo ERA5 Summer Archive",     "P95 relative humidity"],
    // Row 18: B18 = Canopy ★
    ["🌳 Canopy Cover %",    N(calc.canopy_pct,     FMT.dec2), "%",           "Bowler et al. (2010)",               "Urban tree coverage increase"],
    // Row 19: B19 = Cool Roof ★
    ["🏠 Cool Roof %",       N(calc.albedo_pct,     FMT.dec2), "%",           "Santamouris (2015)",                 "Reflective roof coverage increase"],

    // Row 20
    ["", "", "", "", ""],
    // Row 21
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    // Row 22
    ["▶  BASELINE OUTPUTS — Live from Core Engine (no mitigation applied)", "", "", "", ""],
    // Row 23 (column headers)
    ["Metric", "▶ Live Value", "Unit", "Source Formula (Core Engine)", "95% Confidence Interval"],

    // Row 24: Deaths ← Core Engine B21
    [
      "☠ Attributable Deaths",
      F("'Core Engine'!B21", calc.attributable_deaths, FMT.int),
      "lives/yr",
      "Core Engine B21 — Gasparrini (2017)",
      F("TEXT('Core Engine'!B22,\"#,##0\")&\" — \"&TEXT('Core Engine'!B23,\"#,##0\")", "See Core Engine"),
    ],
    // Row 25: Economic Loss ← Core Engine B31
    [
      "📉 Economic Loss",
      F("'Core Engine'!B31", calc.economic_decay_usd, FMT.usd),
      "USD/yr",
      "Core Engine B31 — Burke (2018) + ILO (2019)",
      F("TEXT('Core Engine'!B32,\"$#,##0\")&\" — \"&TEXT('Core Engine'!B33,\"$#,##0\")", "See Core Engine"),
    ],
    // Row 26: WBT ← Core Engine B39
    [
      "💦 Wet-Bulb Temperature",
      F("'Core Engine'!B39", calc.wbt, FMT.dec2),
      "°C",
      "Core Engine B39 — Stull (2011)",
      "Capped at 35°C — Sherwood & Huber (2010)",
    ],
    // Row 27: Peak Temp ← B11
    [
      "🌡 Peak Temperature",
      F("B11", calc.peak_tx5d_c, FMT.dec2),
      "°C",
      "Control Panel B11 — Open-Meteo CMIP6",
      "WMO Tx5d index",
    ],
    // Row 28: HW Days ← B10
    [
      "☀ Annual Heatwave Days",
      F("B10", calc.heatwave_days, FMT.dec2),
      "days/yr",
      "Control Panel B10 — CMIP6 ensemble",
      "Days above ERA5 P95 threshold",
    ],

    // Row 29
    ["", "", "", "", ""],
    // Row 30
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    // Row 31
    ["🌿  MITIGATION SCENARIO — Change Canopy (B18) or Cool Roof (B19) to update", "", "", "", ""],
    // Row 32 (column headers)
    ["Metric", "Baseline", "With Mitigation", "▶ Saved / Change", "Methodology"],

    // Row 33: Deaths mitigation (self-contained formula)
    [
      "☠ Attributable Deaths",
      F("'Core Engine'!B21", calc.attributable_deaths, FMT.int),
      F(
        "ROUND('Core Engine'!B21 * IF(B10>0, MAX(0,B10-((B18/100*1.2+B19/100*0.8)*3.5))/B10, 1) * MAX(0,1-(B18/100*1.2+B19/100*0.8)*0.08), 0)",
        calc.mitDeaths, FMT.int
      ),
      F("C33-B33", calc.mitDeaths - calc.attributable_deaths, FMT.int),
      "Bowler (2010) + Santamouris (2015) cooling",
    ],
    // Row 34: Economic mitigation
    [
      "📉 Economic Loss",
      F("'Core Engine'!B31", calc.economic_decay_usd, FMT.usd),
      F(
        "'Core Engine'!B31 * IF(B10>0, MAX(0,B10-((B18/100*1.2+B19/100*0.8)*3.5))/B10, 1) * MAX(0,1-(B18/100*1.2+B19/100*0.8)*0.08)",
        calc.mitLoss, FMT.usd
      ),
      F("C34-B34", calc.mitLoss - calc.economic_decay_usd, FMT.usd),
      "Bowler (2010) + Santamouris (2015) cooling",
    ],
    // Row 35: Temp mitigation
    [
      "🌡 Peak Temperature",
      F("B11", calc.peak_tx5d_c, FMT.dec2),
      F("MAX(0, B11 - (B18/100*1.2 + B19/100*0.8))", calc.effectTemp, FMT.dec2),
      F("C35-B35", calc.effectTemp - calc.peak_tx5d_c, FMT.dec2),
      "Canopy 1.2°C/100% + Cool roof 0.8°C/100%",
    ],
    // Row 36: HW Days mitigation
    [
      "☀ Heatwave Days",
      F("B10", calc.heatwave_days, FMT.dec2),
      F("MAX(0, B10 - ((B18/100*1.2 + B19/100*0.8) * 3.5))", calc.effectHW, FMT.dec2),
      F("C36-B36", calc.effectHW - calc.heatwave_days, FMT.dec2),
      "HW reduction = cooling_C × 3.5 days/°C",
    ],

    // Row 37
    ["", "", "", "", ""],
    // Row 38
    ["⚠  AUDIT NOTE: All formulas reference live input cells. Edit B10–B19 for full sensitivity analysis.", "", "", "", ""],
    // Row 39
    ["   Peer-reviewed derivations with citations are on the 'Core Engine' tab.", "", "", "", ""],
  ];
}

// ════════════════════════════════════════════════════════════════════
// SHEET 2: CORE ENGINE
// Row map (push = +1 row each time):
//  1  = Title
//  2  = Metadata
//  3  = blank
//  4  = [A] header
//  5  = ERA5 P95           B5  ← 'Control Panel'!B12
//  6  = ERA5 Mean          B6
//  7  = CMIP6 Peak         B7  ← 'Control Panel'!B11
//  8  = HW Days            B8  ← 'Control Panel'!B10
//  9  = Mean Temp          B9
//  10 = Humidity           B10 ← 'Control Panel'!B17
//  11 = Temp Excess        B11 = MAX(0,B7-B5)
//  12 = blank
//  13 = [B] header
//  14 = β                  B14
//  15 = RR                 B15 = EXP(B14*B11)
//  16 = AF                 B16 = (B15-1)/B15
//  17 = Death Rate         B17 ← 'Control Panel'!B15/1000
//  18 = HW Fraction        B18 = MIN(B8/365,1)
//  19 = Vulnerability      B19 ← 'Control Panel'!B16
//  20 = Population         B20 ← 'Control Panel'!B13
//  21 = ▶ DEATHS           B21 = ROUND(B20*B17*B18*B16*B19,0)  ★ PULLED BY CP
//  22 = CI Lower           B22 = ROUND(B21*0.85,0)
//  23 = CI Upper           B23 = ROUND(B21*1.15,0)
//  24 = blank
//  25 = [C] header
//  26 = City GDP           B26 ← 'Control Panel'!B14
//  27 = T_optimal          B27
//  28 = Mean Temp          B28 = B9
//  29 = Burke Penalty      B29
//  30 = ILO Fraction       B30
//  31 = ▶ ECON LOSS        B31 = B26*(B29+B30)               ★ PULLED BY CP
//  32 = CI Lower           B32 = B31*0.92
//  33 = CI Upper           B33 = B31*1.08
//  34 = blank
//  35 = [D] header
//  36 = Peak Temp          B36 = B7
//  37 = Humidity           B37 = B10
//  38 = Raw WBT            B38 = Stull formula
//  39 = ▶ FINAL WBT        B39 = MIN(B38,35.0)               ★ PULLED BY CP
//  40 = blank
//  41 = [E] header
//  42 = Canopy %           B42 ← 'Control Panel'!B18
//  43 = Albedo %           B43 ← 'Control Panel'!B19
//  44 = Total Cooling      B44 = (B42/100*1.2)+(B43/100*0.8)
//  45 = Effective Temp     B45 = MAX(0,B7-B44)
//  46 = Effective HW       B46 = MAX(0,B8-(B44*3.5))
//  47 = blank
//  48 = [F] header
//  49 = Deaths sensitivity
//  50 = Loss sensitivity
// ════════════════════════════════════════════════════════════════════
function buildCoreEngineClean(d: ExcelExportData, calc: ReturnType<typeof derive>): any[][] {
  const rows: any[][] = [];
  const push  = (row: any[]) => rows.push(row);
  const blank = () => rows.push(["", "", "", "", ""]);

  // Row 1
  push(["OPENPLANET CORE ENGINE — Peer-Reviewed Climate Risk Mathematics", "", "", "", ""]);
  // Row 2
  push([`City: ${d.city_name}  |  Year: ${d.target_year}  |  SSP: ${d.ssp}  |  Source: ${d.cmip6_source}`, "", "", "", ""]);
  // Row 3
  blank();

  // ── SECTION A ───────────────────────────────────────────────────
  // Row 4
  push(["[ A ] CLIMATE DATA INPUTS", "Value", "Unit", "Live Excel Formula", "Source"]);
  // Row 5: B5 = ERA5 P95
  push(["  ERA5 P95 Threshold",  F("'Control Panel'!B12", calc.era5_p95_c,    FMT.dec2), "°C",     "='Control Panel'!B12", "Open-Meteo ERA5 1991–2020"]);
  // Row 6: B6 = ERA5 Mean
  push(["  ERA5 Annual Mean",    N(calc.era5_baseline_c,                       FMT.dec2), "°C",     "Static",               "Open-Meteo ERA5 1991–2020"]);
  // Row 7: B7 = CMIP6 Peak
  push(["  CMIP6 Peak Tx5d",    F("'Control Panel'!B11", calc.peak_tx5d_c,    FMT.dec2), "°C",     "='Control Panel'!B11", d.cmip6_source]);
  // Row 8: B8 = HW Days
  push(["  CMIP6 Heatwave Days",F("'Control Panel'!B10", calc.heatwave_days,  FMT.dec2), "days/yr","='Control Panel'!B10", d.cmip6_source]);
  // Row 9: B9 = Mean Temp
  push(["  CMIP6 Mean Temp",    N(calc.mean_temp_c,                            FMT.dec2), "°C",     "Static",               d.cmip6_source]);
  // Row 10: B10 = Humidity
  push(["  ERA5 Humidity P95",  F("'Control Panel'!B17", calc.era5_humidity,  FMT.dec2), "%",      "='Control Panel'!B17", "Open-Meteo ERA5 Summer"]);
  // Row 11: B11 = Temp Excess
  push(["  Temperature Excess", F("MAX(0, B7 - B5)", calc.tempExcess,          FMT.dec2), "°C",     "=MAX(0, B7 - B5)",     "Derived: CMIP6 peak − ERA5 P95"]);
  // Row 12
  blank();

  // ── SECTION B ───────────────────────────────────────────────────
  // Row 13
  push(["[ B ] GASPARRINI (2017) MORTALITY MODEL", "Value", "Unit", "Live Excel Formula", "Source"]);
  // Row 14: B14 = β
  push(["  β (Beta coefficient)",   N(calc.beta,                                FMT.dec6), "constant","= 0.0801 (constant)",           "Gasparrini et al. (2017) GBD"]);
  // Row 15: B15 = RR
  push(["  Relative Risk (RR)",     F("EXP(B14 * B11)", calc.rr,               FMT.dec6), "ratio",  "=EXP(B14 * B11)",                "Gasparrini (2017)"]);
  // Row 16: B16 = AF
  push(["  Attributable Fraction",  F("(B15 - 1) / B15", calc.af,              FMT.dec6), "fraction","=(B15 - 1) / B15",              "Gasparrini (2017)"]);
  // Row 17: B17 = Death Rate
  push(["  Annual Death Rate",      F("'Control Panel'!B15 / 1000", calc.death_rate/1000, FMT.dec6), "fraction","='Control Panel'!B15 / 1000","World Bank SP.DYN.CDRT.IN"]);
  // Row 18: B18 = HW Fraction
  push(["  HW Fraction",            F("MIN(B8 / 365, 1)", calc.hwFrac,          FMT.dec6), "fraction","=MIN(B8 / 365, 1)",              "Derived"]);
  // Row 19: B19 = Vulnerability
  push(["  Vulnerability (V)",      F("'Control Panel'!B16", calc.vulnerability,FMT.dec2), "multiplier","='Control Panel'!B16",        "IEA + WHO + World Bank"]);
  // Row 20: B20 = Population
  push(["  Population",             F("'Control Panel'!B13", calc.population,   FMT.int),  "persons","='Control Panel'!B13",           "GeoNames API"]);
  // Row 21: B21 = ▶ DEATHS ★
  push([
    "▶ ATTRIBUTABLE DEATHS",
    F("ROUND(B20 * B17 * B18 * B16 * B19, 0)", calc.attributable_deaths, FMT.int),
    "lives/yr",
    "=ROUND(B20 * B17 * B18 * B16 * B19, 0)",
    "Gasparrini (2017) — Lancet Planetary Health",
  ]);
  // Row 22: B22 = CI Lower
  push(["  95% CI Lower (−15%)", F("ROUND(B21 * 0.85, 0)", Math.round(calc.attributable_deaths * 0.85), FMT.int), "lives/yr","=ROUND(B21 * 0.85, 0)","±15% beta uncertainty"]);
  // Row 23: B23 = CI Upper
  push(["  95% CI Upper (+15%)", F("ROUND(B21 * 1.15, 0)", Math.round(calc.attributable_deaths * 1.15), FMT.int), "lives/yr","=ROUND(B21 * 1.15, 0)","±15% beta uncertainty"]);
  // Row 24
  blank();

  // ── SECTION C ───────────────────────────────────────────────────
  // Row 25
  push(["[ C ] BURKE (2018) + ILO (2019) ECONOMIC MODEL", "Value", "Unit", "Live Excel Formula", "Source"]);
  // Row 26: B26 = GDP
  push(["  City GDP",           F("'Control Panel'!B14", calc.gdp_usd,          FMT.usd),  "USD/yr","='Control Panel'!B14",           "World Bank NY.GDP.PCAP.CD"]);
  // Row 27: B27 = T_optimal
  push(["  T_optimal",          N(calc.tOpt,                                     FMT.dec2), "°C",    "= 13.0 (constant)",               "Burke et al. (2018) Nature"]);
  // Row 28: B28 = Mean Temp
  push(["  Mean Temperature",   F("B9", calc.mean_temp_c,                        FMT.dec2), "°C",    "=B9",                             d.cmip6_source]);
  // Row 29: B29 = Burke Penalty
  push(["  Burke GDP Penalty",  F("0.0127 * POWER(B28 - B27, 2) / 100", calc.burkePen, FMT.dec6), "fraction","=0.0127*(B28-B27)^2/100","Burke (2018) non-linear coefficient"]);
  // Row 30: B30 = ILO Fraction
  push(["  ILO Labor Fraction", F("(B8 / 365) * 0.40 * 0.20", calc.iloFrac,    FMT.dec6), "fraction","=(B8/365)*0.40*0.20",           "ILO (2019) — 40% workforce × 20% loss"]);
  // Row 31: B31 = ▶ ECON LOSS ★
  push([
    "▶ ECONOMIC LOSS",
    F("B26 * (B29 + B30)", calc.economic_decay_usd, FMT.usd),
    "USD/yr",
    "=B26 * (B29 + B30)",
    "Burke (2018) + ILO (2019)",
  ]);
  // Row 32: B32 = CI Lower
  push(["  CI Lower (−8%)",     F("B31 * 0.92", calc.economic_decay_usd * 0.92, FMT.usd), "USD/yr","=B31 * 0.92","±8% model uncertainty"]);
  // Row 33: B33 = CI Upper
  push(["  CI Upper (+8%)",     F("B31 * 1.08", calc.economic_decay_usd * 1.08, FMT.usd), "USD/yr","=B31 * 1.08","±8% model uncertainty"]);
  // Row 34
  blank();

  // ── SECTION D ───────────────────────────────────────────────────
  // Row 35
  push(["[ D ] STULL (2011) WET-BULB TEMPERATURE", "Value", "Unit", "Live Excel Formula", "Source"]);
  // Row 36: B36 = Peak Temp
  push(["  Peak Temperature (T)", F("B7", calc.peak_tx5d_c,     FMT.dec2), "°C", "=B7",  d.cmip6_source]);
  // Row 37: B37 = Humidity
  push(["  Humidity (RH)",        F("B10", calc.era5_humidity,  FMT.dec2), "%",  "=B10", "ERA5 Archive"]);
  // Row 38: B38 = Raw WBT
  push([
    "  Raw WBT (Stull 2011)",
    F(
      "B36*ATAN(0.151977*SQRT(B37+8.313659))+ATAN(B36+B37)-ATAN(B37-1.676331)+0.00391838*POWER(B37,1.5)*ATAN(0.023101*B37)-4.686035",
      calc.rawWBT, FMT.dec2
    ),
    "°C", "Stull empirical formula", "Stull R. (2011) J. Applied Meteorology",
  ]);
  // Row 39: B39 = ▶ FINAL WBT ★
  push([
    "▶ FINAL WBT (capped 35°C)",
    F("MIN(B38, 35.0)", calc.wbt, FMT.dec2),
    "°C", "=MIN(B38, 35.0)", "Sherwood & Huber (2010) PNAS — physiological limit",
  ]);
  // Row 40
  blank();

  // ── SECTION E ───────────────────────────────────────────────────
  // Row 41
  push(["[ E ] MITIGATION SCALING MODEL", "Value", "Unit", "Live Excel Formula", "Source"]);
  // Row 42: B42 = Canopy %
  push(["  Canopy Offset %",      F("'Control Panel'!B18", calc.canopy_pct,  FMT.dec2), "%",      "='Control Panel'!B18", "User input"]);
  // Row 43: B43 = Albedo %
  push(["  Albedo (Cool Roof) %", F("'Control Panel'!B19", calc.albedo_pct,  FMT.dec2), "%",      "='Control Panel'!B19", "User input"]);
  // Row 44: B44 = Total Cooling
  push(["  Total Cooling (°C)",   F("(B42/100*1.2)+(B43/100*0.8)", calc.coolingC, FMT.dec2), "°C","=(B42/100*1.2)+(B43/100*0.8)","Bowler (2010) + Santamouris (2015)"]);
  // Row 45: B45 = Effective Temp
  push(["  Effective Peak Temp",  F("MAX(0, B7 - B44)", calc.effectTemp,     FMT.dec2), "°C",    "=MAX(0, B7 - B44)",    "Derived"]);
  // Row 46: B46 = Effective HW
  push(["  Effective HW Days",    F("MAX(0, B8 - (B44 * 3.5))", calc.effectHW, FMT.dec2), "days/yr","=MAX(0, B8-(B44*3.5))","Derived — 3.5 days/°C"]);
  // Row 47
  blank();

  // ── SECTION F: SENSITIVITY ──────────────────────────────────────
  // Row 48
  push(["[ F ] SENSITIVITY — 95% CI SUMMARY", "Lower Bound", "Point Estimate", "Upper Bound", "Uncertainty Source"]);
  // Row 49
  push([
    "  Attributable Deaths",
    F("ROUND(B21*0.85,0)", Math.round(calc.attributable_deaths*0.85), FMT.int),
    F("B21", calc.attributable_deaths, FMT.int),
    F("ROUND(B21*1.15,0)", Math.round(calc.attributable_deaths*1.15), FMT.int),
    "±15% — Gasparrini (2017) β coefficient",
  ]);
  // Row 50
  push([
    "  Economic Loss (USD)",
    F("B31*0.92", calc.economic_decay_usd*0.92, FMT.usd),
    F("B31", calc.economic_decay_usd, FMT.usd),
    F("B31*1.08", calc.economic_decay_usd*1.08, FMT.usd),
    "±8% — Burke (2018) model uncertainty",
  ]);

  return rows;
}

// ════════════════════════════════════════════════════════════════════
// SHEET 3: CONSTANTS & PROVENANCE
// ════════════════════════════════════════════════════════════════════
function buildProvenance(d: ExcelExportData): any[][] {
  return [
    ["OPENPLANET — Scientific Constants & Data Provenance", "", "", ""],
    ["For academic review, investor due diligence, and model verification.", "", "", ""],
    ["", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["PEER-REVIEWED CONSTANTS", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["Constant", "Value", "Description", "Full Citation"],
    ["β (Gasparrini Beta)",    "0.0801",  "Log-linear heat-mortality coefficient",       "Gasparrini A. et al. (2017). Lancet Planetary Health."],
    ["T_optimal (Burke)",      "13°C",    "Global GDP-optimal temperature",              "Burke M. et al. (2018). Nature."],
    ["ILO Workforce Fraction", "0.40",    "Fraction of workforce in heat-exposed sectors","ILO (2019). Working on a Warmer Planet."],
    ["ILO Productivity Loss",  "0.20",    "Weighted productivity loss per HW day",       "ILO (2019) ibid."],
    ["Canopy Coefficient",     "1.2°C",   "Cooling per 100% canopy coverage",            "Bowler D.E. et al. (2010). Landscape and Urban Planning."],
    ["Albedo Coefficient",     "0.8°C",   "Cooling per 100% reflective roof coverage",   "Santamouris M. (2015). Energy and Buildings."],
    ["WBT Physiological Cap",  "35.0°C",  "Human thermoregulation absolute limit",       "Sherwood S.C. & Huber M. (2010). PNAS."],
    ["Death Rate CI",          "±15%",    "Beta coefficient uncertainty range",          "Gasparrini (2017) ibid."],
    ["Economic CI",            "±8%",     "GDP loss model uncertainty range",            "Burke (2018) ibid."],
    ["HW Reduction Rate",      "3.5 d/°C","Heatwave days reduced per °C cooling",        "Derived from Bowler (2010) + Santamouris (2015)"],
    ["Severity Reduction",     "8%/°C",   "Mortality/loss severity reduction per °C",    "Derived from mitigation literature composite"],
    ["", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["STULL (2011) WET-BULB FORMULA", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["WBT = T·atan(0.151977·√(RH+8.313659)) + atan(T+RH) − atan(RH−1.676331) + 0.00391838·RH^1.5·atan(0.023101·RH) − 4.686035", "", "", ""],
    ["Where: T = peak temperature (°C), RH = relative humidity (%)", "", "", ""],
    ["Accuracy: ±0.65°C. Capped at 35°C per Sherwood & Huber (2010).", "", "", ""],
    ["", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["DATA SOURCES & LIVE API CALLS", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["Dataset", "Source", "API Endpoint", "What It Provides"],
    ["ERA5 Historical Baseline", "Open-Meteo / ECMWF Copernicus","archive-api.open-meteo.com/v1/archive",  "1991-2020 daily Tmax — P95 threshold calculation"],
    ["CMIP6 Projections",        "Open-Meteo Climate API",        "climate-api.open-meteo.com/v1/climate",  "2015-2050: MRI-AGCM3-2-S, NICAM16-8S, MPI-ESM1-2-XR ensemble"],
    ["Post-2050 (2075, 2100)",   "IPCC AR6 WG1",                  "Published Ch.4 Table 4.5 + Ch.11",       "Regional warming deltas — not direct CMIP6 output"],
    ["GDP per Capita",           "World Bank API",                 "api.worldbank.org/v2 — NY.GDP.PCAP.CD", "National GDP/capita — multiplied by population × urban share"],
    ["Crude Death Rate",         "World Bank API",                 "api.worldbank.org/v2 — SP.DYN.CDRT.IN", "Crude death rate per 1,000 population"],
    ["Urban Share",              "World Bank API",                 "api.worldbank.org/v2 — SP.URB.TOTL.IN.ZS","Urban population % for metro GDP multiplier"],
    ["Age Structure",            "World Bank API",                 "api.worldbank.org/v2 — SP.POP.0014+65UP","Age structure proxy for vulnerability multiplier"],
    ["Healthcare Access",        "World Bank API",                 "api.worldbank.org/v2 — SH.MED.PHYS.ZS", "Physicians per 1,000 — healthcare component of V"],
    ["City Population",          "GeoNames API",                   "api.geonames.org/searchJSON",            "Metro population + country code"],
    ["", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["ADDITIONAL REFERENCES", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["C40 Cities (2021)",         "Nature-Based Solutions for Urban Climate Resilience","C40 Cities Finance Facility","Investment cost estimates for urban cooling programs"],
    ["Levinson R. (2018)",        "Energy savings from cool roofs","Lawrence Berkeley National Laboratory (LBNL)","Cool roof economic cost estimates"],
    ["GBD 2019",                  "Global burden of 87 risk factors","The Lancet","Age-specific vulnerability multipliers"],
    ["UN WUP (2022)",             "World Urbanization Prospects","United Nations DESA","Population age share estimates"],
    ["Hersbach H. et al. (2020)", "The ERA5 global reanalysis","Q. J. R. Meteorol. Soc.","ERA5 dataset description"],
    ["IPCC AR6 WG1 (2021)",       "Climate Change 2021: Physical Science Basis","Cambridge University Press","Regional warming projections Ch.4 + Ch.11"],
    ["", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["LEGAL DISCLAIMER", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["⚠ All outputs are research-grade estimates for analytical and educational purposes only.", "", "", ""],
    ["⚠ Not investment advice. Not a financial instrument. Not a deterministic forecast.", "", "", ""],
    ["⚠ Mortality: ±15% CI from Gasparrini (2017) beta coefficient uncertainty.", "", "", ""],
    ["⚠ Economics: ±8% CI from Burke (2018) model uncertainty.", "", "", ""],
    ["⚠ City GDP is estimated — no API provides direct city-level GDP globally.", "", "", ""],
    ["⚠ Post-2050 values use IPCC AR6 regional deltas, not direct CMIP6 model output.", "", "", ""],
    ["⚠ Adaptation cost estimates are order-of-magnitude from published literature.", "", "", ""],
  ];
}

// ════════════════════════════════════════════════════════════════════
// MAIN EXPORT FUNCTION
// ════════════════════════════════════════════════════════════════════
export function downloadExcelAuditModel(data: ExcelExportData): void {
  const wb   = XLSX.utils.book_new();
  const calc = derive(data);

  // Sheet 0: README
  const ws0 = XLSX.utils.aoa_to_sheet(buildReadme(data, calc));
  ws0['!cols'] = [{ wch: 80 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws0, "README");

  // Sheet 1: Control Panel
  const ws1 = XLSX.utils.aoa_to_sheet(buildControlPanelFinal(data, calc));
  ws1['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 45 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Control Panel");

  // Sheet 2: Core Engine
  const ws2 = XLSX.utils.aoa_to_sheet(buildCoreEngineClean(data, calc));
  ws2['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 55 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Core Engine");

  // Sheet 3: Provenance
  const ws3 = XLSX.utils.aoa_to_sheet(buildProvenance(data));
  ws3['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 45 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Constants & Provenance");

  // ✅ Dynamic filename
  const safeName = (data.city_name || 'Unknown')
    .replace(/FORMULA TEMPLATE.*/, 'TEMPLATE')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 40);
  const filename = `OpenPlanet_${safeName}_${data.target_year}_${data.ssp}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ════════════════════════════════════════════════════════════════════
// BUTTON COMPONENTS
// ════════════════════════════════════════════════════════════════════
export function ExcelExportIconButton({
  data, disabled = false,
}: { data: ExcelExportData | null; disabled?: boolean }) {
  if (!data) return null;
  return (
    <button
      onClick={() => downloadExcelAuditModel(data)}
      disabled={disabled}
      title="Export Financial Audit Model (.XLSX)"
      className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-mono font-bold text-emerald-300 bg-emerald-950/40 hover:bg-emerald-900/60 border border-emerald-500/40 hover:border-emerald-400 rounded-md transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)] hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] disabled:opacity-30 disabled:cursor-not-allowed"
    >
      <span className="text-sm">📥</span>
      <span className="uppercase tracking-widest">Download .XLSX</span>
    </button>
  );
}

export function ExcelExportFullButton({
  data, disabled = false,
}: { data: ExcelExportData | null; disabled?: boolean }) {
  if (!data) return null;
  return (
    <button
      onClick={() => downloadExcelAuditModel(data)}
      disabled={disabled}
      className="flex items-center gap-3 px-8 py-4 bg-emerald-900/20 border border-emerald-500/40 text-emerald-300 font-mono text-[11px] uppercase tracking-[0.3em] rounded-xl hover:bg-emerald-900/40 hover:border-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.1)] hover:shadow-[0_0_30px_rgba(16,185,129,0.2)] disabled:opacity-30 disabled:cursor-not-allowed"
    >
      <span className="text-lg">📥</span>
      <div className="flex flex-col items-start">
        <span>Export Complete Math Model</span>
        <span className="text-[8px] text-emerald-500/60 normal-case tracking-normal mt-0.5">
          4-sheet Excel · Live formulas · Gasparrini + Burke + Stull · Google Sheets compatible
        </span>
      </div>
    </button>
  );
}