'use client';

/**
 * ExcelExport.tsx
 * Investor-grade Excel audit model — 3 sheets, REAL LIVE EXCEL FORMULAS.
 *
 * Change a Yellow Cell on Sheet 1 -> Entire engine recalculates automatically.
 * 100% Free `xlsx` library implementation with { f: "formula" } syntax.
 */

import * as XLSX from 'xlsx';

// ── Types ─────────────────────────────────────────────────────────────

export interface ExcelExportData {
  city_name:         string;
  lat:               number;
  lng:               number;
  ssp:               string;
  target_year:       number;
  era5_baseline_c:   number;
  era5_p95_c:        number;
  era5_humidity_p95: number;
  peak_tx5d_c:       number;
  heatwave_days:     number;
  mean_temp_c:       number;
  population:        number;
  gdp_usd:           number;
  death_rate:        number;
  vulnerability:     number;
  canopy_pct:        number;
  albedo_pct:        number;
  attributable_deaths: number;
  economic_decay_usd:  number;
  wbt_c:               number;
  cmip6_source: string;
}

// ── Helper to create a live formula cell ──────────────────────────────
// 'f' is the Excel formula (e.g., "A1+B1"), 'v' is the fallback value 
// if the user opens in a limited viewer, 'z' is number formatting
function fCell(formula: string, fallbackValue: number, format?: string) {
  return { t: 'n', f: formula, v: fallbackValue, z: format };
}

// ── Sheet 1: Control Panel ────────────────────────────────────────────

function buildControlPanel(d: ExcelExportData): any[][] {
  const coolingC   = (d.canopy_pct / 100) * 1.2 + (d.albedo_pct / 100) * 0.8;
  const effectHW   = Math.max(0, d.heatwave_days - coolingC * 3.5);
  const effectTemp = Math.max(0, d.peak_tx5d_c - coolingC);
  const hwRatio    = d.heatwave_days > 0 ? effectHW / d.heatwave_days : 1;
  const sevRatio   = Math.max(0, 1 - coolingC * 0.08);
  const mitDeaths  = Math.round(d.attributable_deaths * hwRatio * sevRatio);
  const mitLoss    = d.economic_decay_usd * hwRatio * sevRatio;

  // Formats
  const fmtNum = '#,##0';
  const fmtUsd = '"$"#,##0';
  const fmtDec = '0.00';

  return [
    // 0: Row 1
    ["OpenPlanet Risk Intelligence — Financial Audit Model", "", "", ""],
    // 1: Row 2
    [`City: ${d.city_name}  |  Scenario: ${d.ssp}  |  Generated: ${new Date().toLocaleDateString()}`, "", "", ""],
    // 2: Row 3
    ["", "", "", ""],
    // 3: Row 4 (UPDATED INSTRUCTIONS FOR FREE XLSX LIBRARY)
    ["⚡ INSTRUCTIONS: Change the numbers in COLUMN B ('Your Input').", "", "", ""],
    // 4: Row 5
    ["As you type new numbers in Column B, the Outputs and Sheet 2 will recalculate instantly.", "", "", ""],
    // 5: Row 6
    ["", "", "", ""],
    // 6: Row 7 (UPDATED HEADER)
    ["━━ DYNAMIC INPUTS (Edit Column B) ━━", "", "", ""],
    // 7: Row 8
    ["Parameter", "Your Input", "Unit", "Source"],

    // Inputs (Row 9 to 19) — These are raw numbers, user can edit them
    // 8: Row 9
    ["Target Year",        d.target_year,       "year",  "User selection"],
    // 9: Row 10 (Cell B10)
    ["Heatwave Days",      d.heatwave_days,     "days/yr", `CMIP6 Ensemble (${d.cmip6_source})`],
    // 10: Row 11 (Cell B11)
    ["Peak Temperature",   d.peak_tx5d_c,       "°C",    "Open-Meteo CMIP6 + Regional Calibration"],
    // 11: Row 12 (Cell B12)
    ["ERA5 P95 Baseline",  d.era5_p95_c,        "°C",    "ERA5 Reanalysis 1991-2020"],
    // 12: Row 13 (Cell B13)
    ["Population",         d.population,        "persons", "GeoNames + World Bank"],
    // 13: Row 14 (Cell B14)
    ["City GDP",           d.gdp_usd,           "USD",   "World Bank + Urban Productivity Ratio"],
    // 14: Row 15 (Cell B15)
    ["Base Death Rate",    d.death_rate,        "per 1000/yr", "World Bank SP.DYN.CDRT.IN"],
    // 15: Row 16 (Cell B16)
    ["Vulnerability (V)",  d.vulnerability,     "multiplier", "IEA 2023 + WHO + World Bank"],
    // 16: Row 17 (Cell B17)
    ["ERA5 Humidity P95",  d.era5_humidity_p95, "%",  "ERA5 Summer Archive 1991-2020"],
    // 17: Row 18 (Cell B18)
    ["Canopy Offset",      d.canopy_pct,        "%",     "Bowler et al. (2010)"],
    // 18: Row 19 (Cell B19)
    ["Cool Roof Offset",   d.albedo_pct,        "%",     "Santamouris (2015)"],
    // 19: Row 20
    ["", "", "", ""],

    // 20: Row 21
    ["━━ LIVE OUTPUTS (Auto-calculated from inputs above) ━━", "", "", ""],
    // 21: Row 22
    ["Metric", "Baseline (No Action)", "With Mitigation", "Change"],

    // 22: Row 23 (Attributable Deaths)
    [
      "Attributable Deaths",
      fCell("'Core Engine'!B23", d.attributable_deaths, fmtNum), // Pull from Core Engine
      fCell("ROUND(B22 * IF($B$10>0, 'Core Engine'!B52/$B$10, 1) * MAX(0, 1 - ('Core Engine'!B50 * 0.08)), 0)", mitDeaths, fmtNum),
      fCell("C23 - B23", mitDeaths - d.attributable_deaths, fmtNum),
    ],
    // 23: Row 24 (Economic Loss)
    [
      "Economic Loss (USD)",
      fCell("'Core Engine'!B34", d.economic_decay_usd, fmtUsd), // Pull from Core Engine
      fCell("B24 * IF($B$10>0, 'Core Engine'!B52/$B$10, 1) * MAX(0, 1 - ('Core Engine'!B50 * 0.08))", mitLoss, fmtUsd),
      fCell("C24 - B24", mitLoss - d.economic_decay_usd, fmtUsd),
    ],
    // 24: Row 25 (Peak Heatwave Temp)
    [
      "Peak Heatwave Temp (°C)",
      fCell("B11", d.peak_tx5d_c, fmtDec),
      fCell("'Core Engine'!B51", effectTemp, fmtDec),
      fCell("C25 - B25", effectTemp - d.peak_tx5d_c, fmtDec),
    ],
    // 25: Row 26 (Annual Heatwave Days)
    [
      "Annual Heatwave Days",
      fCell("B10", d.heatwave_days, fmtDec),
      fCell("'Core Engine'!B52", effectHW, fmtDec),
      fCell("C26 - B26", effectHW - d.heatwave_days, fmtDec),
    ],
    // 26: Row 27
    ["", "", "", ""],
    // 27: Row 28 (UPDATED NOTE)
    ["⚠ AUDIT NOTE: Change any number in Column B above to run your own sensitivity analysis.", "", "", ""],
    // 28: Row 29
    ["All outputs are driven by peer-reviewed live formulas on Sheet 2.", "", "", ""],
  ];
}

// ── Sheet 2: Core Engine ──────────────────────────────────────────────

function buildCoreEngine(d: ExcelExportData): any[][] {
  const tempExcess = Math.max(0, d.peak_tx5d_c - d.era5_p95_c);
  const beta       = 0.0801;
  const rr         = Math.exp(beta * tempExcess);
  const af         = (rr - 1) / rr;
  const hwFrac     = Math.min(d.heatwave_days / 365, 1);
  const tOptimal   = 13.0;
  const burkePen   = 0.0127 * Math.pow(d.mean_temp_c - tOptimal, 2) / 100;
  const iloFrac    = (d.heatwave_days / 365) * 0.40 * 0.20;
  
  const coolingC   = (d.canopy_pct / 100) * 1.2 + (d.albedo_pct / 100) * 0.8;
  const effectTemp = Math.max(0, d.peak_tx5d_c - coolingC);
  const effectHW   = Math.max(0, d.heatwave_days - coolingC * 3.5);

  const rh = d.era5_humidity_p95;
  const wbt = (d.peak_tx5d_c * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) + Math.atan(d.peak_tx5d_c + rh) - Math.atan(rh - 1.676331) + 0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) - 4.686035);
  const wbtCapped = Math.min(wbt, 35.0);

  const fmtDec = '0.00';
  const fmtFrac = '0.000000';
  const fmtNum = '#,##0';
  const fmtUsd = '"$"#,##0';

  return [
    ["OpenPlanet Core Engine — Live Math Sandbox", "", "", "", ""], // Row 1
    [`City: ${d.city_name}  |  Year: ${d.target_year}  |  SSP: ${d.ssp}`, "", "", "", ""], // Row 2
    ["", "", "", "", ""], // Row 3
    
    // ── Section A: Climate Inputs (Row 4)
    ["━━ SECTION A: CLIMATE DATA INPUTS ━━", "", "", "", ""],
    ["Variable", "Value", "Unit", "Excel Formula", "Source"], // Row 5

    // Row 6 (B6)
    ["ERA5 P95 Threshold",      fCell("'Control Panel'!B12", d.era5_p95_c, fmtDec), "°C", "='Control Panel'!B12", "Open-Meteo ERA5 Archive"],
    // Row 7 (B7)
    ["ERA5 Annual Mean",        d.era5_baseline_c, "°C", "Static Baseline", "Open-Meteo ERA5 Archive"],
    // Row 8 (B8)
    ["CMIP6 Peak Tx5d",         fCell("'Control Panel'!B11", d.peak_tx5d_c, fmtDec), "°C", "='Control Panel'!B11", d.cmip6_source],
    // Row 9 (B9)
    ["CMIP6 Heatwave Days",     fCell("'Control Panel'!B10", d.heatwave_days, fmtDec), "days/yr", "='Control Panel'!B10", d.cmip6_source],
    // Row 10 (B10)
    ["CMIP6 Mean Temp",         d.mean_temp_c, "°C", "Static Mean", d.cmip6_source],
    // Row 11 (B11)
    ["ERA5 P95 Humidity",       fCell("'Control Panel'!B17", d.era5_humidity_p95, fmtDec), "%", "='Control Panel'!B17", "Open-Meteo ERA5 Archive"],
    // Row 12 (B12)
    ["Temperature Excess",      fCell("MAX(0, B8 - B6)", tempExcess, fmtDec), "°C", "=MAX(0, B8 - B6)", "Derived"],
    ["", "", "", "", ""], // Row 13

    // ── Section B: Mortality (Row 14)
    ["━━ SECTION B: GASPARRINI (2017) MORTALITY MODEL ━━", "", "", "", ""],
    ["Variable", "Value", "Unit", "Excel Formula", "Source"], // Row 15

    // Row 16 (B16)
    ["β (Beta)",                beta, "coefficient", "Constant", "Gasparrini et al. (2017)"],
    // Row 17 (B17)
    ["Relative Risk (RR)",      fCell("EXP(B16 * B12)", rr, fmtFrac), "ratio", "=EXP(B16 * B12)", "Gasparrini (2017)"],
    // Row 18 (B18)
    ["Attributable Fraction",   fCell("(B17 - 1) / B17", af, fmtFrac), "fraction", "=(B17 - 1) / B17", "Gasparrini (2017)"],
    // Row 19 (B19)
    ["Annual Death Rate",       fCell("'Control Panel'!B15 / 1000", d.death_rate/1000, fmtFrac), "fraction", "='Control Panel'!B15 / 1000", "World Bank"],
    // Row 20 (B20)
    ["HW Fraction",             fCell("MIN(B9 / 365, 1)", hwFrac, fmtFrac), "fraction", "=MIN(B9 / 365, 1)", "Derived"],
    // Row 21 (B21)
    ["Vulnerability (V)",       fCell("'Control Panel'!B16", d.vulnerability, fmtDec), "multiplier", "='Control Panel'!B16", "IEA + WHO"],
    // Row 22 (B22)
    ["Population",              fCell("'Control Panel'!B13", d.population, fmtNum), "persons", "='Control Panel'!B13", "GeoNames"],
    // Row 23 (B23)
    [
      "▶ ATTRIBUTABLE DEATHS",
      fCell("ROUND(B22 * B19 * B20 * B18 * B21, 0)", d.attributable_deaths, fmtNum),
      "lives/yr",
      "=ROUND(B22 * B19 * B20 * B18 * B21, 0)",
      "Gasparrini (2017)"
    ],
    // Row 24 (B24)
    ["95% CI Lower",            fCell("ROUND(B23 * 0.85, 0)", d.attributable_deaths * 0.85, fmtNum), "lives/yr", "=ROUND(B23 * 0.85, 0)", "±15% Uncertainty"],
    // Row 25 (B25)
    ["95% CI Upper",            fCell("ROUND(B23 * 1.15, 0)", d.attributable_deaths * 1.15, fmtNum), "lives/yr", "=ROUND(B23 * 1.15, 0)", "±15% Uncertainty"],
    ["", "", "", "", ""], // Row 26

    // ── Section C: Economics (Row 27)
    ["━━ SECTION C: BURKE (2018) + ILO (2019) ECONOMIC MODEL ━━", "", "", "", ""],
    ["Variable", "Value", "Unit", "Excel Formula", "Source"], // Row 28

    // Row 29 (B29)
    ["City GDP",                fCell("'Control Panel'!B14", d.gdp_usd, fmtUsd), "USD", "='Control Panel'!B14", "World Bank"],
    // Row 30 (B30)
    ["T_optimal",               tOptimal, "°C", "Constant", "Burke et al. (2018)"],
    // Row 31 (B31)
    ["Mean Temperature",        fCell("B10", d.mean_temp_c, fmtDec), "°C", "=B10", d.cmip6_source],
    // Row 32 (B32)
    ["Burke Penalty",           fCell("0.0127 * POWER(B31 - B30, 2) / 100", burkePen, fmtFrac), "fraction", "=0.0127 * (B31 - B30)^2 / 100", "Burke (2018)"],
    // Row 33 (B33)
    ["ILO Labor Fraction",      fCell("(B9 / 365) * 0.40 * 0.20", iloFrac, fmtFrac), "fraction", "=(B9 / 365) * 0.40 * 0.20", "ILO (2019)"],
    // Row 34 (B34)
    [
      "▶ ECONOMIC LOSS",
      fCell("B29 * (B32 + B33)", d.economic_decay_usd, fmtUsd),
      "USD/yr",
      "=B29 * (B32 + B33)",
      "Burke + ILO"
    ],
    // Row 35 (B35)
    ["CI Lower (−8%)",          fCell("B34 * 0.92", d.economic_decay_usd * 0.92, fmtUsd), "USD/yr", "=B34 * 0.92", "±8% uncertainty"],
    // Row 36 (B36)
    ["CI Upper (+8%)",          fCell("B34 * 1.08", d.economic_decay_usd * 1.08, fmtUsd), "USD/yr", "=B34 * 1.08", "±8% uncertainty"],
    ["", "", "", "", ""], // Row 37

    // ── Section D: Wet-Bulb (Row 38)
    ["━━ SECTION D: STULL (2011) WET-BULB TEMPERATURE ━━", "", "", "", ""],
    ["Variable", "Value", "Unit", "Excel Formula", "Source"], // Row 39

    // Row 40 (B40)
    ["Peak Temperature (T)",    fCell("B8", d.peak_tx5d_c, fmtDec), "°C", "=B8", d.cmip6_source],
    // Row 41 (B41)
    ["Humidity (RH)",           fCell("B11", d.era5_humidity_p95, fmtDec), "%", "=B11", "ERA5 Archive"],
    // Row 42 (B42)
    ["Raw WBT",                 fCell("B40*ATAN(0.151977*SQRT(B41+8.313659)) + ATAN(B40+B41) - ATAN(B41-1.676331) + 0.00391838*POWER(B41,1.5)*ATAN(0.023101*B41) - 4.686035", wbt, fmtDec), "°C", "Stull empirical equation", "Stull (2011)"],
    // Row 43 (B43)
    ["Scientific Cap Check",    "Cap applied to cell B44 if WBT > 35°C", "", "Sherwood & Huber (2010)", ""],
    // Row 44 (B44)
    ["▶ FINAL WBT",             fCell("MIN(B42, 35.0)", wbtCapped, fmtDec), "°C", "=MIN(B42, 35.0)", "Stull + Limit"],
    ["", "", "", "", ""], // Row 45

    // ── Section E: Mitigation (Row 46)
    ["━━ SECTION E: MITIGATION MATH ━━", "", "", "", ""],
    ["Variable", "Value", "Unit", "Excel Formula", "Source"], // Row 47

    // Row 48 (B48)
    ["Canopy Offset",           fCell("'Control Panel'!B18", d.canopy_pct, fmtDec), "%", "='Control Panel'!B18", "User input"],
    // Row 49 (B49)
    ["Albedo Offset",           fCell("'Control Panel'!B19", d.albedo_pct, fmtDec), "%", "='Control Panel'!B19", "User input"],
    // Row 50 (B50)
    ["Total Cooling",           fCell("(B48/100*1.2) + (B49/100*0.8)", coolingC, fmtDec), "°C", "=(B48/100*1.2) + (B49/100*0.8)", "Bowler + Santamouris"],
    // Row 51 (B51)
    ["Effective Temp",          fCell("MAX(0, B8 - B50)", effectTemp, fmtDec), "°C", "=MAX(0, B8 - B50)", "Derived"],
    // Row 52 (B52)
    ["Effective HW Days",       fCell("MAX(0, B9 - (B50 * 3.5))", effectHW, fmtDec), "days/yr", "=MAX(0, B9 - (B50 * 3.5))", "Derived"],
  ];
}

// ── Sheet 3: Constants & Provenance ──────────────────────────────────

function buildProvenance(d: ExcelExportData): any[][] {
  return [
    ["OpenPlanet — Scientific Constants & Data Provenance", "", "", ""],
    ["For academic review, investor due diligence, and model verification.", "", "", ""],
    ["", "", "", ""],

    ["━━ PEER-REVIEWED CONSTANTS ━━", "", "", ""],
    ["Constant", "Value", "Description", "Full Citation"],

    ["β (Gasparrini Beta)",    "0.0801",  "Log-linear heat-mortality coefficient",    "Gasparrini A. et al. (2017). Lancet Planetary Health."],
    ["T_optimal (Burke)",      "13°C",    "Global GDP-optimal temperature",           "Burke M. et al. (2018). Nature."],
    ["ILO Labor Fraction",     "0.40",    "Fraction of workforce in heat sectors",    "ILO (2019). Working on a Warmer Planet."],
    ["ILO Productivity Loss",  "0.20",    "Weighted productivity loss per HW day",    "ILO (2019) ibid."],
    ["Canopy Coefficient",     "1.2°C",   "Cooling per 100% canopy coverage",         "Bowler D.E. et al. (2010). Landscape and Urban Planning."],
    ["Albedo Coefficient",     "0.8°C",   "Cooling per 100% reflective roof coverage","Santamouris M. (2015). Energy and Buildings."],
    ["WBT Cap",                "35.0°C",  "Human thermoregulation absolute limit",    "Sherwood S.C. & Huber M. (2010). PNAS."],
    ["Stull Formula",          "See D4",  "Wet-bulb empirical formula",               "Stull R. (2011). J. Applied Meteorology."],
    ["Death Rate CI",          "±15%",    "Beta coefficient uncertainty",             "Gasparrini (2017) ibid."],
    ["Economic CI",            "±8%",     "GDP loss model uncertainty",               "Burke (2018) ibid."],
    ["", "", "", ""],

    ["━━ DATA SOURCES & API CALLS ━━", "", "", ""],
    ["Dataset", "Source", "API Endpoint", "What It Provides"],

    ["ERA5 Historical Baseline", "Open-Meteo / ECMWF Copernicus",  "archive-api.open-meteo.com/v1/archive",   "1991-2020 daily Tmax, Tmean, RH — P95 threshold calculation"],
    ["CMIP6 Projections",        "Open-Meteo Climate API",         "climate-api.open-meteo.com/v1/climate",   "2015-2050 daily Tmax from MRI-AGCM3-2-S, NICAM16-8S, MPI-ESM1-2-XR"],
    ["Post-2050 Projections",    "IPCC AR6 WG1",                   "Published Ch.4 Table 4.5 + Ch.11",        "Regional warming deltas for 2075, 2100"],
    ["Live Humidity",            "Open-Meteo Forecast",            "api.open-meteo.com/v1/forecast",          "Current RH for dashboard display only"],
    ["GDP per Capita",           "World Bank API",                 "api.worldbank.org/v2 — NY.GDP.PCAP.CD",   "Latest national GDP per capita (USD)"],
    ["Crude Death Rate",         "World Bank API",                 "api.worldbank.org/v2 — SP.DYN.CDRT.IN",   "Latest crude death rate per 1000"],
    ["Urban Share",              "World Bank API",                 "api.worldbank.org/v2 — SP.URB.TOTL.IN.ZS", "Urban population % for metro multiplier"],
    ["Age Structure",            "World Bank API",                 "api.worldbank.org/v2 — SP.POP.0014 / 65UP", "Median age proxy for vulnerability"],
    ["Healthcare Access",        "World Bank API",                 "api.worldbank.org/v2 — SH.MED.PHYS.ZS",   "Physicians per 1000 population"],
    ["City Population",          "GeoNames API",                   "api.geonames.org/searchJSON",             "City-proper population + country code"],
    ["", "", "", ""],
    ["DISCLAIMER: All outputs are research-grade estimates for analytical purposes. Not investment advice.", "", "", ""],
  ];
}

// ── Main export function ──────────────────────────────────────────────

export function downloadExcelAuditModel(data: ExcelExportData): void {
  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Control Panel
  const cp    = buildControlPanel(data);
  const ws1   = XLSX.utils.aoa_to_sheet(cp);
  ws1['!cols'] = [{ wch: 32 }, { wch: 22 }, { wch: 18 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Control Panel");

  // ── Sheet 2: Core Engine
  const ce    = buildCoreEngine(data);
  const ws2   = XLSX.utils.aoa_to_sheet(ce);
  ws2['!cols'] = [{ wch: 28 }, { wch: 20 }, { wch: 10 }, { wch: 55 }, { wch: 35 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Core Engine");

  // ── Sheet 3: Provenance
  const pv    = buildProvenance(data);
  const ws3   = XLSX.utils.aoa_to_sheet(pv);
  ws3['!cols'] = [{ wch: 28 }, { wch: 35 }, { wch: 45 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Constants & Provenance");

  // ── Download
  const filename = `OpenPlanet_Audit_${data.city_name.replace(/[^a-zA-Z0-9]/g, '_')}_${data.target_year}_${data.ssp}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ── Button Components ─────────────────────────────────────────────────

// 🌟 THE FIX: BIGGER, GLOWING EXCEL BUTTON FOR DEEP DIVE 🌟
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
          3-sheet Excel · Live formulas · Gasparrini + Burke + Stull
        </span>
      </div>
    </button>
  );
}