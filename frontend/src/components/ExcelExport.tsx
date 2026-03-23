'use client';

/**
 * ExcelExport.tsx — OpenPlanet World-Tier Audit Model
 * Pure `xlsx` library — no styling dependency needed
 * 4 Sheets: README | Control Panel | Core Engine | Constants & Provenance
 * * PROFESSIONAL WITHOUT COLORS:
 * - Emoji icons replace colors (✅ ⚡ 📊 ▶ ━━ ⚠)
 * - Clear section separators
 * - Formula previews in adjacent column
 * - All cross-sheet references verified by row number
 * - Google Sheets + Excel both compatible
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
  int:   '#,##0',
  dec2:  '0.00',
  dec6:  '0.000000',
  usd:   '"$"#,##0',
  usdB:  '"$"#,##0.00,,,"B"',
  pct:   '0.0"%"',
};

// ── Derived calculations (mirrors frontend exactly) ───────────────────
function derive(d: ExcelExportData) {
  const beta       = 0.0801;
  const tOpt       = 13.0;
  const tempExcess = Math.max(0, d.peak_tx5d_c - d.era5_p95_c);
  const rr         = Math.exp(beta * tempExcess);
  const af         = (rr - 1) / rr;
  const hwFrac     = Math.min(d.heatwave_days / 365, 1);
  const burkePen   = 0.0127 * Math.pow(d.mean_temp_c - tOpt, 2) / 100;
  const iloFrac    = (d.heatwave_days / 365) * 0.40 * 0.20;
  const coolingC   = (d.canopy_pct / 100) * 1.2 + (d.albedo_pct / 100) * 0.8;
  const effectTemp = Math.max(0, d.peak_tx5d_c - coolingC);
  const effectHW   = Math.max(0, d.heatwave_days - coolingC * 3.5);
  const hwR        = d.heatwave_days > 0 ? effectHW / d.heatwave_days : 1;
  const sevR       = Math.max(0, 1 - coolingC * 0.08);
  const mitDeaths  = Math.round(d.attributable_deaths * hwR * sevR);
  const mitLoss    = d.economic_decay_usd * hwR * sevR;
  const rh         = d.era5_humidity_p95;
  const rawWBT     = d.peak_tx5d_c * Math.atan(0.151977 * Math.sqrt(rh + 8.313659))
                   + Math.atan(d.peak_tx5d_c + rh)
                   - Math.atan(rh - 1.676331)
                   + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh)
                   - 4.686035;
  const wbt = Math.min(rawWBT, 35.0);
  return {
    beta, tOpt, tempExcess, rr, af, hwFrac, burkePen, iloFrac,
    coolingC, effectTemp, effectHW, hwR, sevR, mitDeaths, mitLoss, wbt, rawWBT,
  };
}

// ════════════════════════════════════════════════════════════════════
// SHEET 0: README
// ════════════════════════════════════════════════════════════════════
function buildReadme(d: ExcelExportData): any[][] {
  return [
    ["╔══════════════════════════════════════════════════════════════════════╗"],
    ["║        OPENPLANET RISK INTELLIGENCE — FINANCIAL AUDIT MODEL          ║"],
    ["║                    Peer-Reviewed Climate Economics                   ║"],
    ["╚══════════════════════════════════════════════════════════════════════╝"],
    [""],
    ["CITY",         d.city_name],
    ["COORDINATES",  `${d.lat.toFixed(4)}°N, ${d.lng.toFixed(4)}°E`],
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
    ["STEP 3", "Edit any value in Column B (rows 9–19)"],
    ["STEP 4", "ALL outputs on this sheet AND Core Engine recalculate instantly"],
    ["STEP 5", "View full formula derivations on the 'Core Engine' tab"],
    [""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    ["SHEET GUIDE"],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"],
    [""],
    ["📋 README",                 "This sheet — model guide and city metadata"],
    ["⚡ Control Panel",          "Edit inputs here → all outputs auto-recalculate"],
    ["🔬 Core Engine",            "Full peer-reviewed math — Gasparrini + Burke + Stull"],
    ["📚 Constants & Provenance", "Scientific constants, API sources, full citations"],
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
// SHEET 1: CONTROL PANEL (legacy — not used in export)
// ════════════════════════════════════════════════════════════════════
function buildControlPanel(d: ExcelExportData, calc: ReturnType<typeof derive>): any[][] {
  return [
    ["OPENPLANET RISK INTELLIGENCE — FINANCIAL AUDIT MODEL", "", "", "", ""],
    [`City: ${d.city_name}  |  Scenario: ${d.ssp}  |  Target Year: ${d.target_year}  |  Generated: ${new Date().toLocaleDateString()}`, "", "", "", ""],
    ["", "", "", "", ""],
    ["⚡ INSTRUCTIONS: Edit the numbers in Column B (rows 9–19). Every output below recalculates automatically.", "", "", "", ""],
    ["   Yellow = Editable Input  |  Green = Live Formula Output  |  Both update Core Engine tab instantly.", "", "", "", ""],
    ["", "", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    ["⚡ EDITABLE INPUTS — Change these numbers to run sensitivity analysis", "", "", "", ""],
    ["Parameter", "✏ Your Input", "Unit", "Data Source", "Notes"],
    ["🌡 Heatwave Days",      N(d.heatwave_days, FMT.dec2), "days/yr",     `CMIP6 Ensemble · ${d.cmip6_source}`,    "Days exceeding ERA5 P95 threshold"],
    ["🔥 Peak Temperature",   N(d.peak_tx5d_c,   FMT.dec2), "°C",          "Open-Meteo CMIP6 + Regional Calibration","WMO Tx5d — hottest 5-day block"],
    ["📊 ERA5 P95 Baseline",  N(d.era5_p95_c,    FMT.dec2), "°C",          "Open-Meteo ERA5 Archive 1991-2020",      "Local heat threshold"],
    ["👥 Population",         N(d.population,    FMT.int),  "persons",     "GeoNames API + World Bank",              "Metro area population"],
    ["💰 City GDP",           N(d.gdp_usd,       FMT.usd),  "USD/yr",      "World Bank NY.GDP.PCAP.CD × Pop",        "Estimated city-level GDP"],
    ["💀 Base Death Rate",    N(d.death_rate,    FMT.dec2), "per 1,000/yr","World Bank SP.DYN.CDRT.IN",             "Crude death rate"],
    ["🛡 Vulnerability (V)",  N(d.vulnerability, FMT.dec2), "multiplier",  "IEA 2023 + WHO + World Bank composite", "0.25 (high AC) → 2.5 (low AC)"],
    ["💧 ERA5 Humidity P95",  N(d.era5_humidity_p95, FMT.dec2), "%",       "Open-Meteo ERA5 Summer Archive",        "P95 relative humidity"],
    ["🌳 Canopy Offset",      N(d.canopy_pct,    FMT.dec2), "%",           "Bowler et al. (2010)",                   "Urban tree coverage"],
    ["🏠 Cool Roof Offset",   N(d.albedo_pct,    FMT.dec2), "%",           "Santamouris (2015)",                     "Reflective roof coverage"],
    ["", "", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    ["📊 BASELINE OUTPUTS — Auto-calculated (no mitigation)", "", "", "", ""],
    ["Metric", "▶ Value", "Unit", "Formula Source", "95% Confidence"],
    [
      "☠ Attributable Deaths",
      F("'Core Engine'!B23", d.attributable_deaths, FMT.int),
      "lives/yr",
      "Gasparrini (2017) — See Core Engine B23",
      F("TEXT('Core Engine'!B24,\"#,##0\")&\" – \"&TEXT('Core Engine'!B25,\"#,##0\")", "Calculating..."),
    ],
    [
      "📉 Economic Loss",
      F("'Core Engine'!B34", d.economic_decay_usd, FMT.usd),
      "USD/yr",
      "Burke (2018) + ILO (2019) — See Core Engine B34",
      F("TEXT('Core Engine'!B35,\"$#,##0\")&\" – \"&TEXT('Core Engine'!B36,\"$#,##0\")", "Calculating..."),
    ],
    [
      "🌡 Peak Temperature",
      F("B11", d.peak_tx5d_c, FMT.dec2),
      "°C",
      "Open-Meteo CMIP6 — Control Panel B11",
      "WMO Tx5d index",
    ],
    [
      "☀ Annual Heatwave Days",
      F("B10", d.heatwave_days, FMT.dec2),
      "days/yr",
      "CMIP6 Ensemble — Control Panel B10",
      "Days above ERA5 P95",
    ],
    [
      "💦 Wet-Bulb Temperature",
      F("'Core Engine'!B44", calc.wbt, FMT.dec2),
      "°C",
      "Stull (2011) — See Core Engine B44",
      "Capped at 35°C (Sherwood & Huber 2010)",
    ],
    ["", "", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    ["🌿 MITIGATION OUTPUTS — Based on Canopy (B18) + Cool Roof (B19) sliders", "", "", "", ""],
    ["Metric", "Baseline", "With Mitigation", "▶ Lives / USD Saved", "Formula"],
    [
      "☠ Attributable Deaths",
      F("'Core Engine'!B23", d.attributable_deaths, FMT.int),
      F(
        "ROUND('Core Engine'!B23 * IF(B10>0, MAX(0,B10-((B18/100*1.2+B19/100*0.8)*3.5))/B10, 1) * MAX(0,1-(B18/100*1.2+B19/100*0.8)*0.08), 0)",
        calc.mitDeaths, FMT.int
      ),
      F("C33 - B33", calc.mitDeaths - d.attributable_deaths, FMT.int),
      "Bowler (2010) + Santamouris (2015) scaling",
    ],
    [
      "📉 Economic Loss",
      F("'Core Engine'!B34", d.economic_decay_usd, FMT.usd),
      F(
        "'Core Engine'!B34 * IF(B10>0, MAX(0,B10-((B18/100*1.2+B19/100*0.8)*3.5))/B10, 1) * MAX(0,1-(B18/100*1.2+B19/100*0.8)*0.08)",
        calc.mitLoss, FMT.usd
      ),
      F("C34 - B34", calc.mitLoss - d.economic_decay_usd, FMT.usd),
      "Bowler (2010) + Santamouris (2015) scaling",
    ],
    [
      "🌡 Peak Temperature",
      F("B11", d.peak_tx5d_c, FMT.dec2),
      F("MAX(0, B11 - (B18/100*1.2 + B19/100*0.8))", calc.effectTemp, FMT.dec2),
      F("C35 - B35", calc.effectTemp - d.peak_tx5d_c, FMT.dec2),
      "Bowler 1.2°C/100% + Santamouris 0.8°C/100%",
    ],
    [
      "☀ Heatwave Days",
      F("B10", d.heatwave_days, FMT.dec2),
      F("MAX(0, B10 - ((B18/100*1.2 + B19/100*0.8) * 3.5))", calc.effectHW, FMT.dec2),
      F("C36 - B36", calc.effectHW - d.heatwave_days, FMT.dec2),
      "HW reduction = cooling × 3.5 days/°C",
    ],
    ["", "", "", "", ""],
    ["⚠  AUDIT NOTE: Every formula in this sheet references live cells. Change B10–B19 to run sensitivity analysis.", "", "", "", ""],
    ["   Full derivation with peer-reviewed sources is on the 'Core Engine' tab.", "", "", "", ""],
  ];
}

// ════════════════════════════════════════════════════════════════════
// CORE ENGINE — CLEAN VERSION WITH EXACT ROW TRACKING
// ════════════════════════════════════════════════════════════════════
function buildCoreEngineClean(d: ExcelExportData, calc: ReturnType<typeof derive>): any[][] {
  const rows: any[][] = [];
  const push = (row: any[]) => rows.push(row);
  const blank = () => rows.push(["", "", "", "", ""]);

  push(["OPENPLANET CORE ENGINE — Peer-Reviewed Climate Risk Mathematics", "", "", "", ""]);
  push([`City: ${d.city_name}  |  Year: ${d.target_year}  |  SSP: ${d.ssp}`, "", "", "", ""]);
  blank();

  push(["[ A ] CLIMATE DATA INPUTS", "Value", "Unit", "Live Excel Formula", "Source"]);
  push(["  ERA5 P95 Threshold",  F("'Control Panel'!B12", d.era5_p95_c, FMT.dec2),      "°C",     "='Control Panel'!B12",  "Open-Meteo ERA5 1991–2020"]);
  push(["  ERA5 Annual Mean",    N(d.era5_baseline_c, FMT.dec2),                          "°C",     "Static",                "Open-Meteo ERA5 1991–2020"]);
  push(["  CMIP6 Peak Tx5d",    F("'Control Panel'!B11", d.peak_tx5d_c, FMT.dec2),       "°C",     "='Control Panel'!B11",  d.cmip6_source]);
  push(["  CMIP6 Heatwave Days",F("'Control Panel'!B10", d.heatwave_days, FMT.dec2),     "days/yr","='Control Panel'!B10",  d.cmip6_source]);
  push(["  CMIP6 Mean Temp",    N(d.mean_temp_c, FMT.dec2),                               "°C",     "Static",                d.cmip6_source]);
  push(["  ERA5 Humidity P95",  F("'Control Panel'!B17", d.era5_humidity_p95, FMT.dec2), "%",      "='Control Panel'!B17",  "Open-Meteo ERA5 Summer"]);
  push(["  Temperature Excess", F("MAX(0, B7 - B5)", calc.tempExcess, FMT.dec2),          "°C",     "=MAX(0, B7 - B5)",      "Derived: CMIP6 peak − ERA5 P95"]);
  blank();

  push(["[ B ] GASPARRINI (2017) MORTALITY MODEL", "Value", "Unit", "Live Excel Formula", "Source"]);
  push(["  β (Beta coefficient)",   N(calc.beta, FMT.dec6),                               "constant","= 0.0801 (constant)",        "Gasparrini et al. (2017) GBD"]);
  push(["  Relative Risk (RR)",     F("EXP(B14 * B11)", calc.rr, FMT.dec6),               "ratio",  "=EXP(B14 * B11)",             "Gasparrini (2017)"]);
  push(["  Attributable Fraction",  F("(B15 - 1) / B15", calc.af, FMT.dec6),              "fraction","=(B15 - 1) / B15",           "Gasparrini (2017)"]);
  push(["  Annual Death Rate",      F("'Control Panel'!B15 / 1000", d.death_rate/1000, FMT.dec6), "fraction","='Control Panel'!B15 / 1000","World Bank SP.DYN.CDRT.IN"]);
  push(["  HW Fraction",            F("MIN(B8 / 365, 1)", calc.hwFrac, FMT.dec6),         "fraction","=MIN(B8 / 365, 1)",           "Derived"]);
  push(["  Vulnerability (V)",      F("'Control Panel'!B16", d.vulnerability, FMT.dec2),  "multiplier","='Control Panel'!B16",     "IEA + WHO + World Bank"]);
  push(["  Population",             F("'Control Panel'!B13", d.population, FMT.int),      "persons", "='Control Panel'!B13",        "GeoNames API"]);
  push([
    "▶ ATTRIBUTABLE DEATHS",
    F("ROUND(B20 * B17 * B18 * B16 * B19, 0)", d.attributable_deaths, FMT.int),
    "lives/yr",
    "=ROUND(B20 * B17 * B18 * B16 * B19, 0)",
    "Gasparrini (2017) — Lancet Planetary Health",
  ]);
  push(["  95% CI Lower (−15%)",    F("ROUND(B21 * 0.85, 0)", Math.round(d.attributable_deaths * 0.85), FMT.int), "lives/yr","=ROUND(B21 * 0.85, 0)","±15% beta uncertainty"]);
  push(["  95% CI Upper (+15%)",    F("ROUND(B21 * 1.15, 0)", Math.round(d.attributable_deaths * 1.15), FMT.int), "lives/yr","=ROUND(B21 * 1.15, 0)","±15% beta uncertainty"]);
  blank();

  push(["[ C ] BURKE (2018) + ILO (2019) ECONOMIC MODEL", "Value", "Unit", "Live Excel Formula", "Source"]);
  push(["  City GDP",              F("'Control Panel'!B14", d.gdp_usd, FMT.usd),           "USD/yr", "='Control Panel'!B14",        "World Bank NY.GDP.PCAP.CD"]);
  push(["  T_optimal",             N(calc.tOpt, FMT.dec2),                                  "°C",     "= 13.0 (constant)",           "Burke et al. (2018) Nature"]);
  push(["  Mean Temperature",      F("B9", d.mean_temp_c, FMT.dec2),                        "°C",     "=B9",                         d.cmip6_source]);
  push(["  Burke GDP Penalty",     F("0.0127 * POWER(B28 - B27, 2) / 100", calc.burkePen, FMT.dec6),"fraction","=0.0127*(B28-B27)^2/100","Burke (2018) non-linear coefficient"]);
  push(["  ILO Labor Fraction",    F("(B8 / 365) * 0.40 * 0.20", calc.iloFrac, FMT.dec6),  "fraction","=(B8/365)*0.40*0.20",        "ILO (2019) — 40% workforce × 20% loss"]);
  push([
    "▶ ECONOMIC LOSS",
    F("B26 * (B29 + B30)", d.economic_decay_usd, FMT.usd),
    "USD/yr",
    "=B26 * (B29 + B30)",
    "Burke (2018) + ILO (2019)",
  ]);
  push(["  CI Lower (−8%)",        F("B31 * 0.92", d.economic_decay_usd * 0.92, FMT.usd),  "USD/yr", "=B31 * 0.92",                 "±8% model uncertainty"]);
  push(["  CI Upper (+8%)",        F("B31 * 1.08", d.economic_decay_usd * 1.08, FMT.usd),  "USD/yr", "=B31 * 1.08",                 "±8% model uncertainty"]);
  blank();

  push(["[ D ] STULL (2011) WET-BULB TEMPERATURE", "Value", "Unit", "Live Excel Formula", "Source"]);
  push(["  Peak Temperature (T)",  F("B7", d.peak_tx5d_c, FMT.dec2),                       "°C",     "=B7",                         d.cmip6_source]);
  push(["  Humidity (RH)",         F("B10", d.era5_humidity_p95, FMT.dec2),                 "%",      "=B10",                        "ERA5 Archive"]);
  push([
    "  Raw WBT (Stull 2011)",
    F(
      "B36*ATAN(0.151977*SQRT(B37+8.313659))+ATAN(B36+B37)-ATAN(B37-1.676331)+0.00391838*POWER(B37,1.5)*ATAN(0.023101*B37)-4.686035",
      calc.rawWBT, FMT.dec2
    ),
    "°C",
    "Stull empirical formula (see Constants tab)",
    "Stull R. (2011) J. Applied Meteorology",
  ]);
  push([
    "▶ FINAL WBT (capped 35°C)",
    F("MIN(B38, 35.0)", calc.wbt, FMT.dec2),
    "°C",
    "=MIN(B38, 35.0)",
    "Sherwood & Huber (2010) PNAS — physiological limit",
  ]);
  blank();

  push(["[ E ] MITIGATION SCALING MODEL", "Value", "Unit", "Live Excel Formula", "Source"]);
  push(["  Canopy Offset %",       F("'Control Panel'!B18", d.canopy_pct, FMT.dec2),        "%",      "='Control Panel'!B18",        "User input — Control Panel B18"]);
  push(["  Albedo (Cool Roof) %",  F("'Control Panel'!B19", d.albedo_pct, FMT.dec2),        "%",      "='Control Panel'!B19",        "User input — Control Panel B19"]);
  push(["  Total Cooling (°C)",    F("(B42/100*1.2)+(B43/100*0.8)", calc.coolingC, FMT.dec2),"°C",   "=(B42/100*1.2)+(B43/100*0.8)","Bowler (2010) + Santamouris (2015)"]);
  push(["  Effective Peak Temp",   F("MAX(0, B7 - B44)", calc.effectTemp, FMT.dec2),         "°C",    "=MAX(0, B7 - B44)",           "Derived"]);
  push(["  Effective HW Days",     F("MAX(0, B8 - (B44 * 3.5))", calc.effectHW, FMT.dec2),  "days/yr","=MAX(0, B8 - (B44 * 3.5))", "Derived — 3.5 days reduction per °C cooling"]);
  blank();

  push(["[ F ] SENSITIVITY — 95% CI SUMMARY", "Lower Bound", "Point Estimate", "Upper Bound", "Uncertainty Source"]);
  push([
    "  Attributable Deaths",
    F("ROUND(B21*0.85,0)", Math.round(d.attributable_deaths*0.85), FMT.int),
    F("B21", d.attributable_deaths, FMT.int),
    F("ROUND(B21*1.15,0)", Math.round(d.attributable_deaths*1.15), FMT.int),
    "±15% — Gasparrini (2017) β coefficient",
  ]);
  push([
    "  Economic Loss (USD)",
    F("B31*0.92", d.economic_decay_usd*0.92, FMT.usd),
    F("B31", d.economic_decay_usd, FMT.usd),
    F("B31*1.08", d.economic_decay_usd*1.08, FMT.usd),
    "±8% — Burke (2018) model uncertainty",
  ]);

  return rows;
}

// ════════════════════════════════════════════════════════════════════
// CONTROL PANEL FINAL
// ════════════════════════════════════════════════════════════════════
function buildControlPanelFinal(d: ExcelExportData, calc: ReturnType<typeof derive>): any[][] {
  return [
    ["OPENPLANET RISK INTELLIGENCE — FINANCIAL AUDIT MODEL", "", "", "", ""],
    [`City: ${d.city_name}  |  Scenario: ${d.ssp}  |  Target Year: ${d.target_year}  |  Generated: ${new Date().toLocaleDateString()}`, "", "", "", ""],
    ["", "", "", "", ""],
    ["⚡ INSTRUCTIONS: Edit any number in Column B (rows 9–19). Every output below recalculates automatically.", "", "", "", ""],
    ["   ✏ = Raw input you can change  |  ▶ = Live formula output  |  Both link to Core Engine tab.", "", "", "", ""],
    ["", "", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    ["✏  EDITABLE INPUTS — Change Column B values to run sensitivity analysis", "", "", "", ""],
    ["Parameter", "✏ Edit This Value", "Unit", "Data Source", "Notes"],
    ["🌡 Heatwave Days",         N(d.heatwave_days,      FMT.dec2), "days/yr",    `CMIP6 · ${d.cmip6_source}`,           "Days exceeding ERA5 P95"],
    ["🔥 Peak Temperature",      N(d.peak_tx5d_c,        FMT.dec2), "°C",         "Open-Meteo CMIP6",                    "WMO Tx5d — hottest 5-day block"],
    ["📊 ERA5 P95 Baseline",     N(d.era5_p95_c,         FMT.dec2), "°C",         "Open-Meteo ERA5 Archive 1991–2020",   "Local heat threshold"],
    ["👥 Population",            N(d.population,         FMT.int),  "persons",    "GeoNames API + World Bank",           "Metro area population"],
    ["💰 City GDP",              N(d.gdp_usd,            FMT.usd),  "USD/yr",     "World Bank NY.GDP.PCAP.CD × Pop",     "Estimated city-level GDP"],
    ["💀 Base Death Rate",       N(d.death_rate,         FMT.dec2), "per 1,000/yr","World Bank SP.DYN.CDRT.IN",         "Crude death rate"],
    ["🛡 Vulnerability (V)",     N(d.vulnerability,      FMT.dec2), "multiplier", "IEA 2023 + WHO + World Bank",         "0.25 (high AC) to 2.5 (low AC)"],
    ["💧 ERA5 Humidity P95",     N(d.era5_humidity_p95,  FMT.dec2), "%",          "Open-Meteo ERA5 Summer Archive",      "P95 relative humidity"],
    ["🌳 Canopy Cover %",        N(d.canopy_pct,         FMT.dec2), "%",          "Bowler et al. (2010)",                "Urban tree coverage increase"],
    ["🏠 Cool Roof %",           N(d.albedo_pct,         FMT.dec2), "%",          "Santamouris (2015)",                  "Reflective roof coverage increase"],
    ["", "", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    ["▶  BASELINE OUTPUTS — Live from Core Engine (no mitigation applied)", "", "", "", ""],
    ["Metric", "▶ Live Value", "Unit", "Source Formula (Core Engine)", "95% Confidence Interval"],
    [
      "☠ Attributable Deaths",
      F("'Core Engine'!B21", d.attributable_deaths, FMT.int),
      "lives/yr",
      "Core Engine B21 — Gasparrini (2017)",
      F("TEXT('Core Engine'!B22,\"#,##0\")&\" — \"&TEXT('Core Engine'!B23,\"#,##0\")", "Calculating..."),
    ],
    [
      "📉 Economic Loss",
      F("'Core Engine'!B31", d.economic_decay_usd, FMT.usd),
      "USD/yr",
      "Core Engine B31 — Burke (2018) + ILO (2019)",
      F("TEXT('Core Engine'!B32,\"$#,##0\")&\" — \"&TEXT('Core Engine'!B33,\"$#,##0\")", "Calculating..."),
    ],
    [
      "💦 Wet-Bulb Temperature",
      F("'Core Engine'!B39", calc.wbt, FMT.dec2),
      "°C",
      "Core Engine B39 — Stull (2011)",
      "Capped at 35°C — Sherwood & Huber (2010)",
    ],
    [
      "🌡 Peak Temperature",
      F("B11", d.peak_tx5d_c, FMT.dec2),
      "°C",
      "Control Panel B11 — Open-Meteo CMIP6",
      "WMO Tx5d index",
    ],
    [
      "☀ Annual Heatwave Days",
      F("B10", d.heatwave_days, FMT.dec2),
      "days/yr",
      "Control Panel B10 — CMIP6 ensemble",
      "Days above ERA5 P95 threshold",
    ],
    ["", "", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    ["🌿  MITIGATION SCENARIO — Change Canopy (B18) or Cool Roof (B19) to update", "", "", "", ""],
    ["Metric", "Baseline", "With Mitigation", "▶ Saved / Change", "Methodology"],
    [
      "☠ Attributable Deaths",
      F("'Core Engine'!B21", d.attributable_deaths, FMT.int),
      F(
        "ROUND('Core Engine'!B21 * IF(B10>0, MAX(0,B10-((B18/100*1.2+B19/100*0.8)*3.5))/B10, 1) * MAX(0,1-(B18/100*1.2+B19/100*0.8)*0.08), 0)",
        calc.mitDeaths, FMT.int
      ),
      F("C33-B33", calc.mitDeaths - d.attributable_deaths, FMT.int),
      "Bowler (2010) + Santamouris (2015) cooling coefficients",
    ],
    [
      "📉 Economic Loss",
      F("'Core Engine'!B31", d.economic_decay_usd, FMT.usd),
      F(
        "'Core Engine'!B31 * IF(B10>0, MAX(0,B10-((B18/100*1.2+B19/100*0.8)*3.5))/B10, 1) * MAX(0,1-(B18/100*1.2+B19/100*0.8)*0.08)",
        calc.mitLoss, FMT.usd
      ),
      F("C34-B34", calc.mitLoss - d.economic_decay_usd, FMT.usd),
      "Bowler (2010) + Santamouris (2015) cooling coefficients",
    ],
    [
      "🌡 Peak Temperature",
      F("B11", d.peak_tx5d_c, FMT.dec2),
      F("MAX(0, B11 - (B18/100*1.2 + B19/100*0.8))", calc.effectTemp, FMT.dec2),
      F("C35-B35", calc.effectTemp - d.peak_tx5d_c, FMT.dec2),
      "Canopy 1.2°C/100% + Cool roof 0.8°C/100%",
    ],
    [
      "☀ Heatwave Days",
      F("B10", d.heatwave_days, FMT.dec2),
      F("MAX(0, B10 - ((B18/100*1.2 + B19/100*0.8) * 3.5))", calc.effectHW, FMT.dec2),
      F("C36-B36", calc.effectHW - d.heatwave_days, FMT.dec2),
      "HW reduction = cooling_C × 3.5 days/°C",
    ],
    ["", "", "", "", ""],
    ["⚠  AUDIT NOTE: All formulas reference live input cells. Edit B10–B19 for full sensitivity analysis.", "", "", "", ""],
    ["   Peer-reviewed derivations with citations are on the 'Core Engine' tab.", "", "", "", ""],
  ];
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
    ["β (Gasparrini Beta)",     "0.0801",  "Log-linear heat-mortality coefficient",       "Gasparrini A. et al. (2017). Projections of temperature-related excess mortality. Lancet Planetary Health."],
    ["T_optimal (Burke)",       "13°C",    "Global GDP-optimal temperature",              "Burke M. et al. (2018). Global non-linear effect of temperature on economic production. Nature."],
    ["ILO Workforce Fraction",  "0.40",    "Fraction of workforce in heat-exposed sectors","ILO (2019). Working on a Warmer Planet. International Labour Organization."],
    ["ILO Productivity Loss",   "0.20",    "Weighted productivity loss per HW day",       "ILO (2019) ibid."],
    ["Canopy Coefficient",      "1.2°C",   "Cooling per 100% canopy coverage",            "Bowler D.E. et al. (2010). Urban greening to cool towns and cities. Landscape and Urban Planning."],
    ["Albedo Coefficient",      "0.8°C",   "Cooling per 100% reflective roof coverage",   "Santamouris M. (2015). Analyzing the heat island magnitude. Energy and Buildings."],
    ["WBT Physiological Cap",   "35.0°C",  "Human thermoregulation absolute limit",       "Sherwood S.C. & Huber M. (2010). An adaptability limit to climate change. PNAS."],
    ["Death Rate CI",           "±15%",    "Beta coefficient uncertainty range",          "Gasparrini (2017) ibid."],
    ["Economic CI",             "±8%",     "GDP loss model uncertainty range",            "Burke (2018) ibid."],
    ["HW Reduction Rate",       "3.5 d/°C","Heatwave days reduced per °C cooling",        "Derived from Bowler (2010) + Santamouris (2015) scaling"],
    ["Severity Reduction",      "8%/°C",   "Mortality/loss severity reduction per °C",    "Derived from mitigation literature composite"],
    ["", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["STULL (2011) WET-BULB FORMULA — FULL EXPANSION", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["WBT = T·atan(0.151977·√(RH+8.313659)) + atan(T+RH) − atan(RH−1.676331) + 0.00391838·RH^1.5·atan(0.023101·RH) − 4.686035", "", "", ""],
    ["Where: T = peak temperature (°C), RH = relative humidity (%)", "", "", ""],
    ["Accuracy: ±0.65°C. Capped at 35°C per Sherwood & Huber (2010).", "", "", ""],
    ["", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["DATA SOURCES & LIVE API CALLS", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["Dataset", "Source", "API Endpoint", "What It Provides"],
    ["ERA5 Historical Baseline",  "Open-Meteo / ECMWF Copernicus", "archive-api.open-meteo.com/v1/archive",    "1991-2020 daily Tmax — P95 threshold calculation"],
    ["CMIP6 Projections",         "Open-Meteo Climate API",        "climate-api.open-meteo.com/v1/climate",    "2015-2050: MRI-AGCM3-2-S, NICAM16-8S, MPI-ESM1-2-XR ensemble"],
    ["Post-2050 (2075, 2100)",     "IPCC AR6 WG1",                  "Published Ch.4 Table 4.5 + Ch.11",         "Regional warming deltas — not direct CMIP6 output"],
    ["GDP per Capita",             "World Bank API",                "api.worldbank.org/v2 — NY.GDP.PCAP.CD",    "National GDP/capita — multiplied by population × urban share"],
    ["Crude Death Rate",           "World Bank API",                "api.worldbank.org/v2 — SP.DYN.CDRT.IN",   "Crude death rate per 1,000 population"],
    ["Urban Share",                "World Bank API",                "api.worldbank.org/v2 — SP.URB.TOTL.IN.ZS","Urban population % for metro GDP multiplier"],
    ["Age Structure",              "World Bank API",                "api.worldbank.org/v2 — SP.POP.0014+65UP", "Age structure proxy for vulnerability multiplier"],
    ["Healthcare Access",          "World Bank API",                "api.worldbank.org/v2 — SH.MED.PHYS.ZS",   "Physicians per 1,000 — healthcare component of V"],
    ["City Population",            "GeoNames API",                  "api.geonames.org/searchJSON",              "Metro population + country code"],
    ["", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["ADDITIONAL REFERENCES", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", ""],
    ["C40 Cities (2021)",          "Nature-Based Solutions for Urban Climate Resilience", "C40 Cities Finance Facility", "Investment cost estimates for urban cooling programs"],
    ["Levinson R. (2018)",         "Energy savings from cool roofs", "Lawrence Berkeley National Laboratory (LBNL)", "Cool roof economic cost estimates"],
    ["GBD 2019",                   "Global burden of 87 risk factors", "The Lancet", "Age-specific vulnerability multipliers"],
    ["UN WUP (2022)",              "World Urbanization Prospects", "United Nations DESA", "Population age share estimates"],
    ["Hersbach H. et al. (2020)",  "The ERA5 global reanalysis", "Q. J. R. Meteorol. Soc.", "ERA5 dataset description"],
    ["IPCC AR6 WG1 (2021)",        "Climate Change 2021: Physical Science Basis", "Cambridge University Press", "Regional warming projections Ch.4 + Ch.11"],
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

  const rm  = buildReadme(data);
  const ws0 = XLSX.utils.aoa_to_sheet(rm);
  ws0['!cols'] = [{ wch: 80 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws0, "README");

  const cp  = buildControlPanelFinal(data, calc);
  const ws1 = XLSX.utils.aoa_to_sheet(cp);
  ws1['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 45 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Control Panel");

  const ce  = buildCoreEngineClean(data, calc);
  const ws2 = XLSX.utils.aoa_to_sheet(ce);
  ws2['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 55 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Core Engine");

  const pv  = buildProvenance(data);
  const ws3 = XLSX.utils.aoa_to_sheet(pv);
  ws3['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 45 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Constants & Provenance");

  const filename = `OpenPlanet_${data.city_name.replace(/[^a-zA-Z0-9]/g, '_')}_${data.target_year}_${data.ssp}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ════════════════════════════════════════════════════════════════════
// BUTTON COMPONENTS
// ════════════════════════════════════════════════════════════════════
export function ExcelExportIconButton({
  data,
  disabled = false,
}: {
  data: ExcelExportData | null;
  disabled?: boolean;
}) {
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
  data,
  disabled = false,
}: {
  data: ExcelExportData | null;
  disabled?: boolean;
}) {
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