/**
 * export/projectionSheet.ts — "Control Panel" sheet builder for the Excel audit model.
 * Extracted from ExcelExport.tsx.
 */

import type { ExcelExportData } from '../ExcelExport';
import { N, F, FMT, type DerivedCalc } from './sheetHelpers';

export function buildControlPanel(d: ExcelExportData, calc: DerivedCalc): any[][] {
  return [
    ["OPENPLANET RISK INTELLIGENCE — FINANCIAL AUDIT MODEL", "", "", "", ""],
    [`City: ${d.city_name}  |  Scenario: ${d.ssp}  |  Target Year: ${d.target_year}  |  Generated: ${new Date().toLocaleDateString()}`, "", "", "", ""],
    ["", "", "", "", ""],
    ["⚡ INSTRUCTIONS: Edit any number in Column B (rows 10–19). Every output below recalculates automatically.", "", "", "", ""],
    ["   ✏ = Raw input you can change  |  ▶ = Live formula output  |  Both link to Core Engine tab.", "", "", "", ""],
    ["", "", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    ["✏  EDITABLE INPUTS — Change Column B values to run sensitivity analysis", "", "", "", ""],
    ["Parameter", "✏ Edit This Value", "Unit", "Data Source", "Notes"],
    ["🌡 Heatwave Days",     N(calc.heatwave_days,  FMT.dec2), "days/yr",     `CMIP6 · ${d.cmip6_source}`,          "Days exceeding ERA5 P95"],
    ["🔥 Peak Temperature",  N(calc.peak_tx5d_c,    FMT.dec2), "°C",          "Open-Meteo CMIP6",                   "WMO Tx5d — hottest 5-day block"],
    ["📊 ERA5 P95 Baseline", N(calc.era5_p95_c,     FMT.dec2), "°C",          "Open-Meteo ERA5 Archive 1991–2020",  "Local heat threshold"],
    ["👥 Population",        N(calc.population,     FMT.int),  "persons",     "GeoNames API + World Bank",          "Metro area population"],
    ["💰 City GDP",          N(calc.gdp_usd,        FMT.usd),  "USD/yr",      "World Bank NY.GDP.PCAP.CD × Pop",    "Estimated city-level GDP"],
    ["💀 Base Death Rate",   calc.death_rate != null ? N(calc.death_rate, FMT.dec2) : N("N/A"), "per 1,000/yr","World Bank SP.DYN.CDRT.IN — from audit trail", "Crude death rate (country-specific)"],
    ["🛡 Vulnerability (V)", N(calc.vulnerability,  FMT.dec2), "multiplier",  "IEA 2023 + WHO + World Bank",        "0.25 (high AC) to 2.5 (low AC)"],
    ["💧 ERA5 Humidity P95", N(calc.era5_humidity,  FMT.dec2), "%",           "Open-Meteo ERA5 Summer Archive",     "P95 relative humidity"],
    ["🌳 Canopy Cover %",    N(calc.canopy_pct,     FMT.dec2), "%",           "Bowler et al. (2010)",               "Urban tree coverage increase"],
    ["🏠 Cool Roof %",       N(calc.albedo_pct,     FMT.dec2), "%",           "Santamouris (2015)",                 "Reflective roof coverage increase"],
    ["", "", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    ["▶  BASELINE OUTPUTS — Live from Core Engine (no mitigation applied)", "", "", "", ""],
    ["Metric", "▶ Live Value", "Unit", "Source Formula (Core Engine)", "95% Confidence Interval"],
    ["☠ Attributable Deaths", F("'Core Engine'!B21", calc.attributable_deaths, FMT.int), "lives/yr", "Core Engine B21 — Gasparrini (2017)", F("TEXT('Core Engine'!B22,\"#,##0\")&\" — \"&TEXT('Core Engine'!B23,\"#,##0\")", "See Core Engine")],
    ["📉 Economic Loss", F("'Core Engine'!B31", calc.economic_decay_usd, FMT.usd), "USD/yr", "Core Engine B31 — Burke (2018) + ILO (2019)", F("TEXT('Core Engine'!B32,\"$#,##0\")&\" — \"&TEXT('Core Engine'!B33,\"$#,##0\")", "See Core Engine")],
    ["💦 Wet-Bulb Temperature", F("'Core Engine'!B39", calc.wbt, FMT.dec2), "°C", "Core Engine B39 — Stull (2011)", "Capped at 35°C — Sherwood & Huber (2010)"],
    ["🌡 Peak Temperature", F("B11", calc.peak_tx5d_c, FMT.dec2), "°C", "Control Panel B11 — Open-Meteo CMIP6", "WMO Tx5d index"],
    ["☀ Annual Heatwave Days", F("B10", calc.heatwave_days, FMT.dec2), "days/yr", "Control Panel B10 — CMIP6 ensemble", "Days above ERA5 P95 threshold"],
    ["", "", "", "", ""],
    ["━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "", "", "", ""],
    ["🌿  MITIGATION SCENARIO — Change Canopy (B18) or Cool Roof (B19) to update", "", "", "", ""],
    ["Metric", "Baseline", "With Mitigation", "▶ Saved / Change", "Methodology"],
    ["☠ Attributable Deaths", F("'Core Engine'!B21", calc.attributable_deaths, FMT.int), F("ROUND('Core Engine'!B21 * IF(B10>0, MAX(0,B10-((B18/100*1.2+B19/100*0.8)*3.5))/B10, 1) * MAX(0,1-(B18/100*1.2+B19/100*0.8)*0.08), 0)", calc.mitDeaths, FMT.int), F("C33-B33", calc.mitDeaths - calc.attributable_deaths, FMT.int), "Bowler (2010) + Santamouris (2015) cooling"],
    ["📉 Economic Loss", F("'Core Engine'!B31", calc.economic_decay_usd, FMT.usd), F("'Core Engine'!B31 * IF(B10>0, MAX(0,B10-((B18/100*1.2+B19/100*0.8)*3.5))/B10, 1) * MAX(0,1-(B18/100*1.2+B19/100*0.8)*0.08)", calc.mitLoss, FMT.usd), F("C34-B34", calc.mitLoss - calc.economic_decay_usd, FMT.usd), "Bowler (2010) + Santamouris (2015) cooling"],
    ["🌡 Peak Temperature", F("B11", calc.peak_tx5d_c, FMT.dec2), F("MAX(0, B11 - (B18/100*1.2 + B19/100*0.8))", calc.effectTemp, FMT.dec2), F("C35-B35", calc.effectTemp - calc.peak_tx5d_c, FMT.dec2), "Canopy 1.2°C/100% + Cool roof 0.8°C/100%"],
    ["☀ Heatwave Days", F("B10", calc.heatwave_days, FMT.dec2), F("MAX(0, B10 - ((B18/100*1.2 + B19/100*0.8) * 3.5))", calc.effectHW, FMT.dec2), F("C36-B36", calc.effectHW - calc.heatwave_days, FMT.dec2), "HW reduction = cooling_C × 3.5 days/°C"],
    ["", "", "", "", ""],
    ["⚠  AUDIT NOTE: All formulas reference live input cells. Edit B10–B19 for full sensitivity analysis.", "", "", "", ""],
    ["   Peer-reviewed derivations with citations are on the 'Core Engine' tab.", "", "", "", ""],
  ];
}
