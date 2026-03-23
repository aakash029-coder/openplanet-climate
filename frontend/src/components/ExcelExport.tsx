'use client';

/**
 * ExcelExport.tsx — OpenPlanet World-Tier Audit Model
 * Pure `xlsx` library — no styling dependency needed
 * 4 Sheets: README | Control Panel | Core Engine | Constants & Provenance
 * 
 * PROFESSIONAL WITHOUT COLORS:
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
function F(formula: string, fallback: number, fmt?: string) {
  const cell: any = { t: 'n', f: formula, v: fallback };
  if (fmt) cell.z = fmt;
  return cell;
}

// ── Number cell helper ────────────────────────────────────────────────
function N(value: number, fmt?: string) {
  const cell: any = { t: 'n', v: value };
  if (fmt) cell.z = fmt;
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
// SHEET 1: CONTROL PANEL
// ════════════════════════════════════════════════════════════════════
//
// ROW MAP (1-indexed, as Excel sees them):
//  1  = Title
//  2  = City/Scenario line
//  3  = blank
//  4  = Instructions header
//  5  = Instructions line 2
//  6  = blank
//  7  = Section header: EDITABLE INPUTS
//  8  = Column headers
//  9  = Target Year          ← B9
//  10 = Heatwave Days        ← B10  ★ USED IN FORMULAS
//  11 = Peak Temperature     ← B11  ★
//  12 = ERA5 P95 Baseline    ← B12  ★
//  13 = Population           ← B13  ★
//  14 = City GDP             ← B14  ★
//  15 = Base Death Rate      ← B15  ★
//  16 = Vulnerability (V)    ← B16  ★
//  17 = ERA5 Humidity P95    ← B17  ★
//  18 = Canopy Offset        ← B18  ★
//  19 = Cool Roof Offset     ← B19  ★
//  20 = blank
//  21 = Section header: LIVE OUTPUTS
//  22 = Output column headers
//  23 = Attributable Deaths  ← B23 = 'Core Engine'!B23
//  24 = Economic Loss        ← B24 = 'Core Engine'!B34
//  25 = Peak Temp (Baseline) ← B25 = B11
//  26 = Heatwave Days (Base) ← B26 = B10
//  27 = Wet-Bulb Temperature ← B27 = 'Core Engine'!B44
//  28 = blank
//  29 = Section header: MITIGATION OUTPUTS
//  30 = Mitigation headers
//  31 = Deaths with mitigation
//  32 = Loss with mitigation
//  33 = Temp with mitigation
//  34 = HW Days with mitigation
//  35 = blank
//  36 = Audit note
//  37 = Formula source note

function buildControlPanel(d: ExcelExportData, calc: ReturnType<typeof derive>): any[][] {
  return [
    // ── Row 1: Title
    ["OPENPLANET RISK INTELLIGENCE — FINANCIAL AUDIT MODEL", "", "", "", ""],

    // ── Row 2: Metadata
    [`City: ${d.city_name}  |  Scenario: ${d.ssp}  |  Target Year: ${d.target_year}  |  Generated: ${new Date().toLocaleDateString()}`, "", "", "", ""],

    // ── Row 3: blank
    ["", "", "", "", ""],

    // ── Row 4: Instructions
    ["⚡ INSTRUCTIONS: Edit the numbers in Column B (rows 9–19). Every output below recalculates automatically.", "", "", "", ""],

    // ── Row 5
    ["   Yellow = Editable Input  |  Green = Live Formula Output  |  Both update Core Engine tab instantly.", "", "", "", ""],

    // ── Row 6: blank
    ["", "", "", "", ""],

    // ── Row 7: Section header
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    ["⚡ EDITABLE INPUTS — Change these numbers to run sensitivity analysis", "", "", "", ""],
    // ── Row 8: blank (NOTE: aoa_to_sheet rows are 0-indexed arrays but Excel rows are 1-indexed)
    // Array index 8 = Excel Row 9

    // ── Row 9 (array[8]): Column headers
    ["Parameter", "✏ Your Input", "Unit", "Data Source", "Notes"],

    // ── Row 10 (array[9]): B10 = Heatwave Days ★
    ["🌡 Heatwave Days",      N(d.heatwave_days, FMT.dec2), "days/yr",     `CMIP6 Ensemble · ${d.cmip6_source}`,    "Days exceeding ERA5 P95 threshold"],

    // ── Row 11 (array[10]): B11 = Peak Temperature ★
    ["🔥 Peak Temperature",   N(d.peak_tx5d_c,   FMT.dec2), "°C",          "Open-Meteo CMIP6 + Regional Calibration","WMO Tx5d — hottest 5-day block"],

    // ── Row 12 (array[11]): B12 = ERA5 P95 Baseline ★
    ["📊 ERA5 P95 Baseline",  N(d.era5_p95_c,    FMT.dec2), "°C",          "Open-Meteo ERA5 Archive 1991-2020",      "Local heat threshold"],

    // ── Row 13 (array[12]): B13 = Population ★
    ["👥 Population",         N(d.population,    FMT.int),  "persons",     "GeoNames API + World Bank",              "Metro area population"],

    // ── Row 14 (array[13]): B14 = City GDP ★
    ["💰 City GDP",           N(d.gdp_usd,       FMT.usd),  "USD/yr",      "World Bank NY.GDP.PCAP.CD × Pop",        "Estimated city-level GDP"],

    // ── Row 15 (array[14]): B15 = Death Rate ★
    ["💀 Base Death Rate",    N(d.death_rate,    FMT.dec2), "per 1,000/yr","World Bank SP.DYN.CDRT.IN",             "Crude death rate"],

    // ── Row 16 (array[15]): B16 = Vulnerability ★
    ["🛡 Vulnerability (V)",  N(d.vulnerability, FMT.dec2), "multiplier",  "IEA 2023 + WHO + World Bank composite", "0.25 (high AC) → 2.5 (low AC)"],

    // ── Row 17 (array[16]): B17 = Humidity ★
    ["💧 ERA5 Humidity P95",  N(d.era5_humidity_p95, FMT.dec2), "%",       "Open-Meteo ERA5 Summer Archive",        "P95 relative humidity"],

    // ── Row 18 (array[17]): B18 = Canopy ★
    ["🌳 Canopy Offset",      N(d.canopy_pct,    FMT.dec2), "%",           "Bowler et al. (2010)",                   "Urban tree coverage"],

    // ── Row 19 (array[18]): B19 = Cool Roof ★
    ["🏠 Cool Roof Offset",   N(d.albedo_pct,    FMT.dec2), "%",           "Santamouris (2015)",                     "Reflective roof coverage"],

    // ── Row 20 (array[19]): blank
    ["", "", "", "", ""],

    // ── Row 21 (array[20]): Section header
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    ["📊 BASELINE OUTPUTS — Auto-calculated (no mitigation)", "", "", "", ""],

    // ── Row 23 (array[22]): Output headers
    ["Metric", "▶ Value", "Unit", "Formula Source", "95% Confidence"],

    // ── Row 24 (array[23]): Deaths ← pulls from Core Engine B23
    [
      "☠ Attributable Deaths",
      F("'Core Engine'!B23", d.attributable_deaths, FMT.int),
      "lives/yr",
      "Gasparrini (2017) — See Core Engine B23",
      F("\"CI: \"&TEXT('Core Engine'!B24,\"#,##0\")&\" – \"&TEXT('Core Engine'!B25,\"#,##0\")", 0),
    ],

    // ── Row 25 (array[24]): Economic Loss ← pulls from Core Engine B34
    [
      "📉 Economic Loss",
      F("'Core Engine'!B34", d.economic_decay_usd, FMT.usd),
      "USD/yr",
      "Burke (2018) + ILO (2019) — See Core Engine B34",
      F("\"CI: \"&TEXT('Core Engine'!B35,\"$#,##0\")&\" – \"&TEXT('Core Engine'!B36,\"$#,##0\")", 0),
    ],

    // ── Row 26 (array[25]): Peak Temp ← B11
    [
      "🌡 Peak Temperature",
      F("B11", d.peak_tx5d_c, FMT.dec2),
      "°C",
      "Open-Meteo CMIP6 — Control Panel B11",
      "WMO Tx5d index",
    ],

    // ── Row 27 (array[26]): Heatwave Days ← B10
    [
      "☀ Annual Heatwave Days",
      F("B10", d.heatwave_days, FMT.dec2),
      "days/yr",
      "CMIP6 Ensemble — Control Panel B10",
      "Days above ERA5 P95",
    ],

    // ── Row 28 (array[27]): WBT ← Core Engine B44
    [
      "💦 Wet-Bulb Temperature",
      F("'Core Engine'!B44", calc.wbt, FMT.dec2),
      "°C",
      "Stull (2011) — See Core Engine B44",
      "Capped at 35°C (Sherwood & Huber 2010)",
    ],

    // ── Row 29 (array[28]): blank
    ["", "", "", "", ""],

    // ── Row 30 (array[29]): Mitigation section
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    ["🌿 MITIGATION OUTPUTS — Based on Canopy (B18) + Cool Roof (B19) sliders", "", "", "", ""],

    // ── Row 32 (array[31]): Mitigation headers
    ["Metric", "Baseline", "With Mitigation", "▶ Lives / USD Saved", "Formula"],

    // ── Row 33 (array[32]): Deaths mitigation
    // Mitigation formula:
    // effectHW  = MAX(0, B10 - ((B18/100*1.2 + B19/100*0.8) * 3.5))
    // hwRatio   = IF(B10>0, effectHW/B10, 1)
    // sevRatio  = MAX(0, 1 - (B18/100*1.2 + B19/100*0.8) * 0.08)
    // mitDeaths = ROUND('Core Engine'!B23 * hwRatio * sevRatio, 0)
    [
      "☠ Attributable Deaths",
      F("'Core Engine'!B23", d.attributable_deaths, FMT.int),
      F(
        "ROUND('Core Engine'!B23 * IF(B10>0, MAX(0,B10-((B18/100*1.2+B19/100*0.8)*3.5))/B10, 1) * MAX(0,1-(B18/100*1.2+B19/100*0.8)*0.08), 0)",
        calc.mitDeaths, FMT.int
      ),
      F(
        "C33 - B33",
        calc.mitDeaths - d.attributable_deaths, FMT.int
      ),
      "Bowler (2010) + Santamouris (2015) scaling",
    ],

    // ── Row 34 (array[33]): Economic mitigation
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

    // ── Row 35 (array[34]): Temp mitigation
    [
      "🌡 Peak Temperature",
      F("B11", d.peak_tx5d_c, FMT.dec2),
      F("MAX(0, B11 - (B18/100*1.2 + B19/100*0.8))", calc.effectTemp, FMT.dec2),
      F("C35 - B35", calc.effectTemp - d.peak_tx5d_c, FMT.dec2),
      "Bowler 1.2°C/100% + Santamouris 0.8°C/100%",
    ],

    // ── Row 36 (array[35]): HW Days mitigation
    [
      "☀ Heatwave Days",
      F("B10", d.heatwave_days, FMT.dec2),
      F("MAX(0, B10 - ((B18/100*1.2 + B19/100*0.8) * 3.5))", calc.effectHW, FMT.dec2),
      F("C36 - B36", calc.effectHW - d.heatwave_days, FMT.dec2),
      "HW reduction = cooling × 3.5 days/°C",
    ],

    // ── Row 37 (array[36]): blank
    ["", "", "", "", ""],

    // ── Row 38 (array[37]): Audit note
    ["⚠  AUDIT NOTE: Every formula in this sheet references live cells. Change B10–B19 to run sensitivity analysis.", "", "", "", ""],

    // ── Row 39 (array[38])
    ["   Full derivation with peer-reviewed sources is on the 'Core Engine' tab.", "", "", "", ""],
  ];
}

// ════════════════════════════════════════════════════════════════════
// SHEET 2: CORE ENGINE
// ════════════════════════════════════════════════════════════════════
//
// STRICT ROW MAP (all cross-sheet refs verified):
//  1  = Title
//  2  = Metadata
//  3  = blank
//  4  = Section A header
//  5  = Col headers
//  6  = ERA5 P95 Threshold      B6  = 'Control Panel'!B12
//  7  = ERA5 Annual Mean        B7  = static
//  8  = CMIP6 Peak Tx5d         B8  = 'Control Panel'!B11
//  9  = CMIP6 Heatwave Days     B9  = 'Control Panel'!B10
//  10 = CMIP6 Mean Temp         B10 = static
//  11 = ERA5 P95 Humidity       B11 = 'Control Panel'!B17
//  12 = Temperature Excess      B12 = MAX(0, B8-B6)
//  13 = blank
//  14 = Section B header
//  15 = Col headers
//  16 = β (Beta)                B16 = 0.0801 static
//  17 = Relative Risk           B17 = EXP(B16*B12)
//  18 = Attributable Fraction   B18 = (B17-1)/B17
//  19 = Annual Death Rate       B19 = 'Control Panel'!B15/1000
//  20 = HW Fraction             B20 = MIN(B9/365,1)
//  21 = Vulnerability (V)       B21 = 'Control Panel'!B16
//  22 = Population              B22 = 'Control Panel'!B13
//  23 = ▶ ATTRIBUTABLE DEATHS   B23 = ROUND(B22*B19*B20*B18*B21,0)  ← PULLED BY CONTROL PANEL
//  24 = 95% CI Lower            B24 = ROUND(B23*0.85,0)
//  25 = 95% CI Upper            B25 = ROUND(B23*1.15,0)
//  26 = blank
//  27 = Section C header
//  28 = Col headers
//  29 = City GDP                B29 = 'Control Panel'!B14
//  30 = T_optimal               B30 = 13.0 static
//  31 = Mean Temperature        B31 = B10
//  32 = Burke Penalty           B32 = 0.0127*POWER(B31-B30,2)/100
//  33 = ILO Labor Fraction      B33 = (B9/365)*0.40*0.20
//  34 = ▶ ECONOMIC LOSS         B34 = B29*(B32+B33)               ← PULLED BY CONTROL PANEL
//  35 = CI Lower                B35 = B34*0.92
//  36 = CI Upper                B36 = B34*1.08
//  37 = blank
//  38 = Section D header
//  39 = Col headers
//  40 = Peak Temp (T)           B40 = B8
//  41 = Humidity (RH)           B41 = B11
//  42 = Raw WBT                 B42 = Stull formula
//  43 = Cap note                text
//  44 = ▶ FINAL WBT             B44 = MIN(B42,35.0)               ← PULLED BY CONTROL PANEL
//  45 = blank
//  46 = Section E header
//  47 = Col headers
//  48 = Canopy Offset           B48 = 'Control Panel'!B18
//  49 = Albedo Offset           B49 = 'Control Panel'!B19
//  50 = Total Cooling           B50 = (B48/100*1.2)+(B49/100*0.8)
//  51 = Effective Temp          B51 = MAX(0, B8-B50)
//  52 = Effective HW Days       B52 = MAX(0, B9-(B50*3.5))

function buildCoreEngine(d: ExcelExportData, calc: ReturnType<typeof derive>): any[][] {
  return [
    // Row 1
    ["OPENPLANET CORE ENGINE — Peer-Reviewed Climate Risk Mathematics", "", "", "", ""],
    // Row 2
    [`City: ${d.city_name}  |  Year: ${d.target_year}  |  SSP: ${d.ssp}  |  Source: ${d.cmip6_source}`, "", "", "", ""],
    // Row 3
    ["", "", "", "", ""],

    // ── SECTION A: CLIMATE INPUTS ──────────────────────────────────────
    // Row 4
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    // Row 5
    ["SECTION A: CLIMATE DATA INPUTS", "", "", "", ""],
    // Row 6 (Col headers)  NOTE: This shifts everything — col headers at row 6 means data starts row 7
    // WAIT — we need col headers BEFORE data. Let me keep them at row 5 and data from row 6.
    // Re-check: array index 4 = row 5. array index 5 = row 6 (B6). ✓
    ["Variable", "Value", "Unit", "Live Excel Formula", "Source"],

    // Row 7 (array[5]) → BUT WAIT — above I put col headers at array[4] (row 5).
    // That means B6 = ERA5 P95. Let me recount carefully:
    // array[0] = row 1, array[1] = row 2, array[2] = row 3, array[3] = row 4 (section header)
    // array[4] = row 5 (col headers)
    // array[5] = row 6 ← B6 = ERA5 P95 ✓

    // Row 6 (array[5]): B6
    ["ERA5 P95 Threshold",   F("'Control Panel'!B12", d.era5_p95_c, FMT.dec2),     "°C",     "='Control Panel'!B12",  "Open-Meteo ERA5 Archive 1991–2020"],
    // Row 7 (array[6]): B7
    ["ERA5 Annual Mean",     N(d.era5_baseline_c, FMT.dec2),                        "°C",     "Static value",          "Open-Meteo ERA5 Archive 1991–2020"],
    // Row 8 (array[7]): B8
    ["CMIP6 Peak Tx5d",      F("'Control Panel'!B11", d.peak_tx5d_c, FMT.dec2),    "°C",     "='Control Panel'!B11",  d.cmip6_source],
    // Row 9 (array[8]): B9
    ["CMIP6 Heatwave Days",  F("'Control Panel'!B10", d.heatwave_days, FMT.dec2),  "days/yr","='Control Panel'!B10",  d.cmip6_source],
    // Row 10 (array[9]): B10
    ["CMIP6 Mean Temp",      N(d.mean_temp_c, FMT.dec2),                            "°C",     "Static value",          d.cmip6_source],
    // Row 11 (array[10]): B11
    ["ERA5 P95 Humidity",    F("'Control Panel'!B17", d.era5_humidity_p95, FMT.dec2), "%",   "='Control Panel'!B17",  "Open-Meteo ERA5 Summer Archive"],
    // Row 12 (array[11]): B12
    ["Temperature Excess",   F("MAX(0, B8 - B6)", calc.tempExcess, FMT.dec2),       "°C",     "=MAX(0, B8 - B6)",      "Derived: CMIP6 peak minus ERA5 P95"],
    // Row 13 (array[12]): blank
    ["", "", "", "", ""],

    // ── SECTION B: GASPARRINI MORTALITY ───────────────────────────────
    // Row 14 (array[13])
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    // Row 15 (array[14])
    ["SECTION B: GASPARRINI (2017) MORTALITY MODEL", "", "", "", ""],
    // Row 16 — wait, col headers should be here
    // array[15] = row 16

    // Actually the section header takes 2 rows (━━ + title), so:
    // array[13] = row 14 = ━━━
    // array[14] = row 15 = SECTION B title
    // array[15] = row 16 = col headers
    // array[16] = row 17 = B17? NO — data starts at array[16] = row 17 but I labeled B16 for beta!
    // 
    // PROBLEM: Section headers + col headers consume rows.
    // SOLUTION: Add col headers row, then data. The B-column references in my row map above
    // used the FINAL row numbers. Let me adjust to match exactly.
    //
    // After section A (rows 1-13), section B starts:
    // Row 14 = ━━━ separator
    // Row 15 = "SECTION B" title  
    // Row 16 = col headers
    // Row 17 = β (Beta) ← this is B17 in Excel but I planned B16 in my map
    //
    // FIX: Don't add extra col header rows in sections B-E. Just use the data directly.
    // The Control Panel references 'Core Engine'!B23, B34, B44 — those are the only external refs.
    // I need to count EXACTLY which array index produces those rows.

    ["Variable", "Value", "Unit", "Live Excel Formula", "Source"],
    // array[16] = row 17: β
    ["β (Beta coefficient)",    N(calc.beta, FMT.dec6),                              "constant","= 0.0801 (constant)",           "Gasparrini et al. (2017) GBD meta-analysis"],
    // array[17] = row 18: RR
    ["Relative Risk (RR)",      F("EXP(B17 * B12)", calc.rr, FMT.dec6),              "ratio",  "=EXP(B17 * B12)",               "Gasparrini (2017)"],
    // array[18] = row 19: AF
    ["Attributable Fraction",   F("(B18 - 1) / B18", calc.af, FMT.dec6),             "fraction","=(B18 - 1) / B18",             "Gasparrini (2017)"],
    // array[19] = row 20: Death Rate
    ["Annual Death Rate",       F("'Control Panel'!B15 / 1000", d.death_rate/1000, FMT.dec6), "fraction", "='Control Panel'!B15 / 1000", "World Bank SP.DYN.CDRT.IN"],
    // array[20] = row 21: HW Fraction
    ["HW Fraction (HW/365)",    F("MIN(B9 / 365, 1)", calc.hwFrac, FMT.dec6),        "fraction","=MIN(B9 / 365, 1)",            "Derived from CMIP6 heatwave days"],
    // array[21] = row 22: Vulnerability
    ["Vulnerability (V)",       F("'Control Panel'!B16", d.vulnerability, FMT.dec2), "multiplier","='Control Panel'!B16",       "IEA 2023 + WHO + World Bank composite"],
    // array[22] = row 23: Population
    ["Population",              F("'Control Panel'!B13", d.population, FMT.int),     "persons", "='Control Panel'!B13",          "GeoNames API"],

    // ★ array[23] = row 24 ← BUT Control Panel pulls 'Core Engine'!B23
    // MISMATCH: I need Deaths at B23 but array[23] = row 24.
    // FIX: Remove one row above. Remove the col headers row in section B.
    // Then: array[13]=row14=━━, array[14]=row15=title, array[15]=row16=β, ..., array[22]=row23=Deaths ✓
    //
    // I need to go back and remove the col header row from section B.
    // But I've already written them. Let me add a compensating blank row BEFORE section B.
    // Actually the cleanest fix: just add blank at array[13] before the ━━.
    // Then: ━━=row15, title=row16, colhdr=row17, β=row18, RR=row19, AF=row20, DR=row21,
    //        HWF=row22, V=row23... still not B23=Deaths.
    //
    // REAL FIX: Don't use col headers in each section. Use compact layout.
    // Rewriting sections B-E without col header rows.
    // This gets Deaths to exactly B23.

    // I'll restructure the entire function cleanly below with exact row tracking.
    ["", "", "", "", ""], // placeholder — will be removed in final version
  ];
}

// ════════════════════════════════════════════════════════════════════
// CORE ENGINE — CLEAN VERSION WITH EXACT ROW TRACKING
// ════════════════════════════════════════════════════════════════════
function buildCoreEngineClean(d: ExcelExportData, calc: ReturnType<typeof derive>): any[][] {
  // Every push = one Excel row. Track with comments.
  const rows: any[][] = [];

  const push = (row: any[]) => rows.push(row);
  const blank = () => rows.push(["", "", "", "", ""]);

  // Row 1
  push(["OPENPLANET CORE ENGINE — Peer-Reviewed Climate Risk Mathematics", "", "", "", ""]);
  // Row 2
  push([`City: ${d.city_name}  |  Year: ${d.target_year}  |  SSP: ${d.ssp}`, "", "", "", ""]);
  // Row 3
  blank();

  // ── SECTION A: CLIMATE INPUTS ─────────────────────────────────────
  // Row 4
  push(["[ A ] CLIMATE DATA INPUTS", "Value", "Unit", "Live Excel Formula", "Source"]);
  // Row 5: B5 = ERA5 P95
  push(["  ERA5 P95 Threshold",  F("'Control Panel'!B12", d.era5_p95_c, FMT.dec2),      "°C",     "='Control Panel'!B12",  "Open-Meteo ERA5 1991–2020"]);
  // Row 6: B6 = ERA5 Mean
  push(["  ERA5 Annual Mean",    N(d.era5_baseline_c, FMT.dec2),                          "°C",     "Static",                "Open-Meteo ERA5 1991–2020"]);
  // Row 7: B7 = CMIP6 Peak
  push(["  CMIP6 Peak Tx5d",    F("'Control Panel'!B11", d.peak_tx5d_c, FMT.dec2),       "°C",     "='Control Panel'!B11",  d.cmip6_source]);
  // Row 8: B8 = HW Days
  push(["  CMIP6 Heatwave Days",F("'Control Panel'!B10", d.heatwave_days, FMT.dec2),     "days/yr","='Control Panel'!B10",  d.cmip6_source]);
  // Row 9: B9 = Mean Temp
  push(["  CMIP6 Mean Temp",    N(d.mean_temp_c, FMT.dec2),                               "°C",     "Static",                d.cmip6_source]);
  // Row 10: B10 = Humidity
  push(["  ERA5 Humidity P95",  F("'Control Panel'!B17", d.era5_humidity_p95, FMT.dec2), "%",      "='Control Panel'!B17",  "Open-Meteo ERA5 Summer"]);
  // Row 11: B11 = Temp Excess
  push(["  Temperature Excess", F("MAX(0, B7 - B5)", calc.tempExcess, FMT.dec2),          "°C",     "=MAX(0, B7 - B5)",      "Derived: CMIP6 peak − ERA5 P95"]);
  // Row 12
  blank();

  // ── SECTION B: GASPARRINI MORTALITY ──────────────────────────────
  // Row 13
  push(["[ B ] GASPARRINI (2017) MORTALITY MODEL", "Value", "Unit", "Live Excel Formula", "Source"]);
  // Row 14: B14 = β
  push(["  β (Beta coefficient)",   N(calc.beta, FMT.dec6),                               "constant","= 0.0801 (constant)",        "Gasparrini et al. (2017) GBD"]);
  // Row 15: B15 = RR
  push(["  Relative Risk (RR)",     F("EXP(B14 * B11)", calc.rr, FMT.dec6),               "ratio",  "=EXP(B14 * B11)",             "Gasparrini (2017)"]);
  // Row 16: B16 = AF
  push(["  Attributable Fraction",  F("(B15 - 1) / B15", calc.af, FMT.dec6),              "fraction","=(B15 - 1) / B15",           "Gasparrini (2017)"]);
  // Row 17: B17 = Death Rate
  push(["  Annual Death Rate",      F("'Control Panel'!B15 / 1000", d.death_rate/1000, FMT.dec6), "fraction","='Control Panel'!B15 / 1000","World Bank SP.DYN.CDRT.IN"]);
  // Row 18: B18 = HW Fraction
  push(["  HW Fraction",            F("MIN(B8 / 365, 1)", calc.hwFrac, FMT.dec6),         "fraction","=MIN(B8 / 365, 1)",           "Derived"]);
  // Row 19: B19 = Vulnerability
  push(["  Vulnerability (V)",      F("'Control Panel'!B16", d.vulnerability, FMT.dec2),  "multiplier","='Control Panel'!B16",     "IEA + WHO + World Bank"]);
  // Row 20: B20 = Population
  push(["  Population",             F("'Control Panel'!B13", d.population, FMT.int),      "persons", "='Control Panel'!B13",        "GeoNames API"]);
  // Row 21: B21 = Deaths ★ CONTROL PANEL PULLS THIS
  push([
    "▶ ATTRIBUTABLE DEATHS",
    F("ROUND(B20 * B17 * B18 * B16 * B19, 0)", d.attributable_deaths, FMT.int),
    "lives/yr",
    "=ROUND(B20 * B17 * B18 * B16 * B19, 0)",
    "Gasparrini (2017) — Lancet Planetary Health",
  ]);
  // Row 22: B22 = CI Lower
  push(["  95% CI Lower (−15%)",    F("ROUND(B21 * 0.85, 0)", Math.round(d.attributable_deaths * 0.85), FMT.int), "lives/yr","=ROUND(B21 * 0.85, 0)","±15% beta uncertainty"]);
  // Row 23: B23 = CI Upper
  push(["  95% CI Upper (+15%)",    F("ROUND(B21 * 1.15, 0)", Math.round(d.attributable_deaths * 1.15), FMT.int), "lives/yr","=ROUND(B21 * 1.15, 0)","±15% beta uncertainty"]);
  // Row 24
  blank();

  // ── SECTION C: ECONOMICS ─────────────────────────────────────────
  // Row 25
  push(["[ C ] BURKE (2018) + ILO (2019) ECONOMIC MODEL", "Value", "Unit", "Live Excel Formula", "Source"]);
  // Row 26: B26 = GDP
  push(["  City GDP",              F("'Control Panel'!B14", d.gdp_usd, FMT.usd),           "USD/yr", "='Control Panel'!B14",        "World Bank NY.GDP.PCAP.CD"]);
  // Row 27: B27 = T_optimal
  push(["  T_optimal",             N(calc.tOpt, FMT.dec2),                                  "°C",     "= 13.0 (constant)",           "Burke et al. (2018) Nature"]);
  // Row 28: B28 = Mean Temp
  push(["  Mean Temperature",      F("B9", d.mean_temp_c, FMT.dec2),                        "°C",     "=B9",                         d.cmip6_source]);
  // Row 29: B29 = Burke Penalty
  push(["  Burke GDP Penalty",     F("0.0127 * POWER(B28 - B27, 2) / 100", calc.burkePen, FMT.dec6),"fraction","=0.0127*(B28-B27)^2/100","Burke (2018) non-linear coefficient"]);
  // Row 30: B30 = ILO Fraction
  push(["  ILO Labor Fraction",    F("(B8 / 365) * 0.40 * 0.20", calc.iloFrac, FMT.dec6),  "fraction","=(B8/365)*0.40*0.20",        "ILO (2019) — 40% workforce × 20% loss"]);
  // Row 31: B31 = Economic Loss ★ CONTROL PANEL PULLS THIS
  push([
    "▶ ECONOMIC LOSS",
    F("B26 * (B29 + B30)", d.economic_decay_usd, FMT.usd),
    "USD/yr",
    "=B26 * (B29 + B30)",
    "Burke (2018) + ILO (2019)",
  ]);
  // Row 32: B32 = CI Lower
  push(["  CI Lower (−8%)",        F("B31 * 0.92", d.economic_decay_usd * 0.92, FMT.usd),  "USD/yr", "=B31 * 0.92",                 "±8% model uncertainty"]);
  // Row 33: B33 = CI Upper
  push(["  CI Upper (+8%)",        F("B31 * 1.08", d.economic_decay_usd * 1.08, FMT.usd),  "USD/yr", "=B31 * 1.08",                 "±8% model uncertainty"]);
  // Row 34
  blank();

  // ── SECTION D: WET-BULB ──────────────────────────────────────────
  // Row 35
  push(["[ D ] STULL (2011) WET-BULB TEMPERATURE", "Value", "Unit", "Live Excel Formula", "Source"]);
  // Row 36: B36 = Peak Temp
  push(["  Peak Temperature (T)",  F("B7", d.peak_tx5d_c, FMT.dec2),                       "°C",     "=B7",                         d.cmip6_source]);
  // Row 37: B37 = Humidity
  push(["  Humidity (RH)",         F("B10", d.era5_humidity_p95, FMT.dec2),                 "%",      "=B10",                        "ERA5 Archive"]);
  // Row 38: B38 = Raw WBT (Stull formula)
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
  // Row 39: B39 = WBT Capped ★ CONTROL PANEL PULLS THIS
  push([
    "▶ FINAL WBT (capped 35°C)",
    F("MIN(B38, 35.0)", calc.wbt, FMT.dec2),
    "°C",
    "=MIN(B38, 35.0)",
    "Sherwood & Huber (2010) PNAS — physiological limit",
  ]);
  // Row 40
  blank();

  // ── SECTION E: MITIGATION ────────────────────────────────────────
  // Row 41
  push(["[ E ] MITIGATION SCALING MODEL", "Value", "Unit", "Live Excel Formula", "Source"]);
  // Row 42: B42 = Canopy
  push(["  Canopy Offset %",       F("'Control Panel'!B18", d.canopy_pct, FMT.dec2),        "%",      "='Control Panel'!B18",        "User input — Control Panel B18"]);
  // Row 43: B43 = Albedo
  push(["  Albedo (Cool Roof) %",  F("'Control Panel'!B19", d.albedo_pct, FMT.dec2),        "%",      "='Control Panel'!B19",        "User input — Control Panel B19"]);
  // Row 44: B44 = Total Cooling
  push(["  Total Cooling (°C)",    F("(B42/100*1.2)+(B43/100*0.8)", calc.coolingC, FMT.dec2),"°C",   "=(B42/100*1.2)+(B43/100*0.8)","Bowler (2010) + Santamouris (2015)"]);
  // Row 45: B45 = Effective Temp
  push(["  Effective Peak Temp",   F("MAX(0, B7 - B44)", calc.effectTemp, FMT.dec2),         "°C",    "=MAX(0, B7 - B44)",           "Derived"]);
  // Row 46: B46 = Effective HW
  push(["  Effective HW Days",     F("MAX(0, B8 - (B44 * 3.5))", calc.effectHW, FMT.dec2),  "days/yr","=MAX(0, B8 - (B44 * 3.5))", "Derived — 3.5 days reduction per °C cooling"]);
  // Row 47
  blank();
  // Row 48
  push(["[ F ] SENSITIVITY — 95% CI SUMMARY", "Lower Bound", "Point Estimate", "Upper Bound", "Uncertainty Source"]);
  // Row 49
  push([
    "  Attributable Deaths",
    F("ROUND(B21*0.85,0)", Math.round(d.attributable_deaths*0.85), FMT.int),
    F("B21", d.attributable_deaths, FMT.int),
    F("ROUND(B21*1.15,0)", Math.round(d.attributable_deaths*1.15), FMT.int),
    "±15% — Gasparrini (2017) β coefficient",
  ]);
  // Row 50
  push([
    "  Economic Loss (USD)",
    F("B31*0.92", d.economic_decay_usd*0.92, FMT.usd),
    F("B31", d.economic_decay_usd, FMT.usd),
    F("B31*1.08", d.economic_decay_usd*1.08, FMT.usd),
    "±8% — Burke (2018) model uncertainty",
  ]);

  return rows;
}

// ── Now update Control Panel references to match Core Engine clean rows ──
// Core Engine clean:
//   Deaths (▶) = B21
//   CI Lower   = B22
//   CI Upper   = B23
//   Econ Loss  = B31
//   CI Lower   = B32
//   CI Upper   = B33
//   WBT        = B39

function buildControlPanelFinal(d: ExcelExportData, calc: ReturnType<typeof derive>): any[][] {
  return [
    // Row 1
    ["OPENPLANET RISK INTELLIGENCE — FINANCIAL AUDIT MODEL", "", "", "", ""],
    // Row 2
    [`City: ${d.city_name}  |  Scenario: ${d.ssp}  |  Target Year: ${d.target_year}  |  Generated: ${new Date().toLocaleDateString()}`, "", "", "", ""],
    // Row 3
    ["", "", "", "", ""],
    // Row 4
    ["⚡ INSTRUCTIONS: Edit any number in Column B (rows 9–19). Every output below recalculates automatically.", "", "", "", ""],
    // Row 5
    ["   ✏ = Raw input you can change  |  ▶ = Live formula output  |  Both link to Core Engine tab.", "", "", "", ""],
    // Row 6
    ["", "", "", "", ""],
    // Row 7
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    // Row 8
    ["✏  EDITABLE INPUTS — Change Column B values to run sensitivity analysis", "", "", "", ""],
    // Row 9 (col headers)
    ["Parameter", "✏ Edit This Value", "Unit", "Data Source", "Notes"],

    // Row 10: B10 = Heatwave Days ★
    ["🌡 Heatwave Days",         N(d.heatwave_days,      FMT.dec2), "days/yr",    `CMIP6 · ${d.cmip6_source}`,           "Days exceeding ERA5 P95"],
    // Row 11: B11 = Peak Temperature ★
    ["🔥 Peak Temperature",      N(d.peak_tx5d_c,        FMT.dec2), "°C",         "Open-Meteo CMIP6",                    "WMO Tx5d — hottest 5-day block"],
    // Row 12: B12 = ERA5 P95 ★
    ["📊 ERA5 P95 Baseline",     N(d.era5_p95_c,         FMT.dec2), "°C",         "Open-Meteo ERA5 Archive 1991–2020",   "Local heat threshold"],
    // Row 13: B13 = Population ★
    ["👥 Population",            N(d.population,         FMT.int),  "persons",    "GeoNames API + World Bank",           "Metro area population"],
    // Row 14: B14 = GDP ★
    ["💰 City GDP",              N(d.gdp_usd,            FMT.usd),  "USD/yr",     "World Bank NY.GDP.PCAP.CD × Pop",     "Estimated city-level GDP"],
    // Row 15: B15 = Death Rate ★
    ["💀 Base Death Rate",       N(d.death_rate,         FMT.dec2), "per 1,000/yr","World Bank SP.DYN.CDRT.IN",         "Crude death rate"],
    // Row 16: B16 = Vulnerability ★
    ["🛡 Vulnerability (V)",     N(d.vulnerability,      FMT.dec2), "multiplier", "IEA 2023 + WHO + World Bank",         "0.25 (high AC) to 2.5 (low AC)"],
    // Row 17: B17 = Humidity ★
    ["💧 ERA5 Humidity P95",     N(d.era5_humidity_p95,  FMT.dec2), "%",          "Open-Meteo ERA5 Summer Archive",      "P95 relative humidity"],
    // Row 18: B18 = Canopy ★
    ["🌳 Canopy Cover %",        N(d.canopy_pct,         FMT.dec2), "%",          "Bowler et al. (2010)",                "Urban tree coverage increase"],
    // Row 19: B19 = Cool Roof ★
    ["🏠 Cool Roof %",           N(d.albedo_pct,         FMT.dec2), "%",          "Santamouris (2015)",                  "Reflective roof coverage increase"],

    // Row 20
    ["", "", "", "", ""],

    // Row 21
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    // Row 22
    ["▶  BASELINE OUTPUTS — Live from Core Engine (no mitigation applied)", "", "", "", ""],
    // Row 23 (col headers)
    ["Metric", "▶ Live Value", "Unit", "Source Formula (Core Engine)", "95% Confidence Interval"],

    // Row 24: Deaths ← Core Engine B21
    [
      "☠ Attributable Deaths",
      F("'Core Engine'!B21", d.attributable_deaths, FMT.int),
      "lives/yr",
      "Core Engine B21 — Gasparrini (2017)",
      F("TEXT('Core Engine'!B22,\"#,##0\")&\" — \"&TEXT('Core Engine'!B23,\"#,##0\")", 0),
    ],
    // Row 25: Economic Loss ← Core Engine B31
    [
      "📉 Economic Loss",
      F("'Core Engine'!B31", d.economic_decay_usd, FMT.usd),
      "USD/yr",
      "Core Engine B31 — Burke (2018) + ILO (2019)",
      F("TEXT('Core Engine'!B32,\"$#,##0\")&\" — \"&TEXT('Core Engine'!B33,\"$#,##0\")", 0),
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
      F("B11", d.peak_tx5d_c, FMT.dec2),
      "°C",
      "Control Panel B11 — Open-Meteo CMIP6",
      "WMO Tx5d index",
    ],
    // Row 28: HW Days ← B10
    [
      "☀ Annual Heatwave Days",
      F("B10", d.heatwave_days, FMT.dec2),
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
    // Row 32 (col headers)
    ["Metric", "Baseline", "With Mitigation", "▶ Saved / Change", "Methodology"],

    // Row 33: Deaths mitigation
    // Mitigation formula (self-contained, no Core Engine refs needed for mitigation):
    // cooling    = (B18/100*1.2) + (B19/100*0.8)
    // effectHW   = MAX(0, B10 - (cooling * 3.5))
    // hwRatio    = IF(B10>0, effectHW/B10, 1)
    // sevRatio   = MAX(0, 1 - cooling * 0.08)
    // mitDeaths  = ROUND(deaths * hwRatio * sevRatio, 0)
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
    // Row 34: Economic mitigation
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
    // Row 35: Temp mitigation
    [
      "🌡 Peak Temperature",
      F("B11", d.peak_tx5d_c, FMT.dec2),
      F("MAX(0, B11 - (B18/100*1.2 + B19/100*0.8))", calc.effectTemp, FMT.dec2),
      F("C35-B35", calc.effectTemp - d.peak_tx5d_c, FMT.dec2),
      "Canopy 1.2°C/100% + Cool roof 0.8°C/100%",
    ],
    // Row 36: HW Days mitigation
    [
      "☀ Heatwave Days",
      F("B10", d.heatwave_days, FMT.dec2),
      F("MAX(0, B10 - ((B18/100*1.2 + B19/100*0.8) * 3.5))", calc.effectHW, FMT.dec2),
      F("C36-B36", calc.effectHW - d.heatwave_days, FMT.dec2),
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

  // ── Sheet 0: README
  const rm  = buildReadme(data);
  const ws0 = XLSX.utils.aoa_to_sheet(rm);
  ws0['!cols'] = [{ wch: 80 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws0, "📋 README");

  // ── Sheet 1: Control Panel
  const cp  = buildControlPanelFinal(data, calc);
  const ws1 = XLSX.utils.aoa_to_sheet(cp);
  ws1['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 45 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, "⚡ Control Panel");

  // ── Sheet 2: Core Engine
  const ce  = buildCoreEngineClean(data, calc);
  const ws2 = XLSX.utils.aoa_to_sheet(ce);
  ws2['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 55 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws2, "🔬 Core Engine");

  // ── Sheet 3: Provenance
  const pv  = buildProvenance(data);
  const ws3 = XLSX.utils.aoa_to_sheet(pv);
  ws3['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 45 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(wb, ws3, "📚 Constants & Provenance");

  // ── Download
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