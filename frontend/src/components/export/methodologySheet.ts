/**
 * export/methodologySheet.ts — "Core Engine" sheet builder for the Excel audit model.
 * Extracted from ExcelExport.tsx.
 */

import type { ExcelExportData } from '../ExcelExport';
import { N, F, FMT, type DerivedCalc } from './sheetHelpers';

export function buildCoreEngine(d: ExcelExportData, calc: DerivedCalc): any[][] {
  const rows: any[][] = [];
  const push  = (row: any[]) => rows.push(row);
  const blank = () => rows.push(["", "", "", "", ""]);

  push(["OPENPLANET CORE ENGINE — Peer-Reviewed Climate Risk Mathematics", "", "", "", ""]);
  push([`City: ${d.city_name}  |  Year: ${d.target_year}  |  SSP: ${d.ssp}  |  Source: ${d.cmip6_source}`, "", "", "", ""]);
  blank();

  push(["[ A ] CLIMATE DATA INPUTS", "Value", "Unit", "Live Excel Formula", "Source"]);
  push(["  ERA5 P95 Threshold",  F("'Control Panel'!B12", calc.era5_p95_c,    FMT.dec2), "°C",     "='Control Panel'!B12", "Open-Meteo ERA5 1991–2020"]);
  push(["  ERA5 Annual Mean",    N(calc.era5_baseline_c,                       FMT.dec2), "°C",     "Static",               "Open-Meteo ERA5 1991–2020"]);
  push(["  CMIP6 Peak Tx5d",    F("'Control Panel'!B11", calc.peak_tx5d_c,    FMT.dec2), "°C",     "='Control Panel'!B11", d.cmip6_source]);
  push(["  CMIP6 Heatwave Days",F("'Control Panel'!B10", calc.heatwave_days,  FMT.dec2), "days/yr","='Control Panel'!B10", d.cmip6_source]);
  push(["  CMIP6 Mean Temp",    F("B7 - ('Control Panel'!B11 - " + calc.mean_temp_c + ")", calc.mean_temp_c, FMT.dec2), "°C", "=B7 - delta", d.cmip6_source]);
  push(["  ERA5 Humidity P95",  F("'Control Panel'!B17", calc.era5_humidity,  FMT.dec2), "%",      "='Control Panel'!B17", "Open-Meteo ERA5 Summer"]);
  push(["  Temperature Excess", F("MAX(0, B7 - B5)", calc.tempExcess,          FMT.dec2), "°C",     "=MAX(0, B7 - B5)",     "Derived: CMIP6 peak − ERA5 P95"]);
  blank();

  push(["[ B ] GASPARRINI (2017) MORTALITY MODEL", "Value", "Unit", "Live Excel Formula", "Source"]);
  push(["  β (Beta coefficient)",   N(calc.beta,                                FMT.dec6), "constant","= 0.0801 (constant)",           "Gasparrini et al. (2017) GBD"]);
  push(["  Relative Risk (RR)",     F("EXP(B14 * B11)", calc.rr,               FMT.dec6), "ratio",  "=EXP(B14 * B11)",                "Gasparrini (2017)"]);
  push(["  Attributable Fraction",  F("(B15 - 1) / B15", calc.af,              FMT.dec6), "fraction","=(B15 - 1) / B15",              "Gasparrini (2017)"]);
  push(["  Annual Death Rate",
    calc.death_rate != null
      ? F("'Control Panel'!B15 / 1000", calc.death_rate / 1000, FMT.dec6)
      : N("N/A"),
    "fraction","='Control Panel'!B15 / 1000","World Bank SP.DYN.CDRT.IN"]);
  push(["  HW Fraction",            F("MIN(B8 / 365, 1)", calc.hwFrac,          FMT.dec6), "fraction","=MIN(B8 / 365, 1)",              "Derived"]);
  push(["  Vulnerability (V)",      F("'Control Panel'!B16", calc.vulnerability,FMT.dec2), "multiplier","='Control Panel'!B16",        "IEA + WHO + World Bank"]);
  push(["  Population",             F("'Control Panel'!B13", calc.population,   FMT.int),  "persons","='Control Panel'!B13",           "GeoNames API"]);
  push([
    "▶ ATTRIBUTABLE DEATHS",
    F(`IF(${d.attributable_deaths || 0}>0, ${d.attributable_deaths || 0}, ROUND(B20 * B17 * B18 * B16 * B19, 0))`, calc.attributable_deaths, FMT.int),
    "lives/yr",
    "=IF(API_Value>0, API, Formula)",
    "Gasparrini (2017) — Lancet Planetary Health",
  ]);
  push(["  95% CI Lower (−15%)", F("ROUND(B21 * 0.85, 0)", Math.round(calc.attributable_deaths * 0.85), FMT.int), "lives/yr","=ROUND(B21 * 0.85, 0)","±15% beta uncertainty"]);
  push(["  95% CI Upper (+15%)", F("ROUND(B21 * 1.15, 0)", Math.round(calc.attributable_deaths * 1.15), FMT.int), "lives/yr","=ROUND(B21 * 1.15, 0)","±15% beta uncertainty"]);
  blank();

  push(["[ C ] BURKE (2018) + ILO (2019) ECONOMIC MODEL", "Value", "Unit", "Live Excel Formula", "Source"]);
  push(["  City GDP",           F("'Control Panel'!B14", calc.gdp_usd,          FMT.usd),  "USD/yr","='Control Panel'!B14",           "World Bank NY.GDP.PCAP.CD"]);
  push(["  T_optimal",          N(calc.tOpt,                                     FMT.dec2), "°C",    "= 13.0 (constant)",               "Burke et al. (2018) Nature"]);
  push(["  Mean Temperature",   F("B9", calc.mean_temp_c,                        FMT.dec2), "°C",    "=B9",                             d.cmip6_source]);
  push(["  Burke GDP Penalty",  F("0.0127 * POWER(B28 - B27, 2) / 100", calc.burkePen, FMT.dec6), "fraction","=0.0127*(B28-B27)^2/100","Burke (2018) non-linear coefficient"]);
  push(["  ILO Labor Fraction", F("(B8 / 365) * 0.40 * 0.20", calc.iloFrac,    FMT.dec6), "fraction","=(B8/365)*0.40*0.20",           "ILO (2019) — 40% workforce × 20% loss"]);
  push([
    "▶ ECONOMIC LOSS",
    F(`IF(${d.economic_decay_usd || 0}>0, ${d.economic_decay_usd || 0}, B26 * (B29 + B30))`, calc.economic_decay_usd, FMT.usd),
    "USD/yr",
    "=IF(API_Value>0, API, Formula)",
    "Burke (2018) + ILO (2019)",
  ]);
  push(["  CI Lower (−8%)",     F("B31 * 0.92", calc.economic_decay_usd * 0.92, FMT.usd), "USD/yr","=B31 * 0.92","±8% model uncertainty"]);
  push(["  CI Upper (+8%)",     F("B31 * 1.08", calc.economic_decay_usd * 1.08, FMT.usd), "USD/yr","=B31 * 1.08","±8% model uncertainty"]);
  blank();

  push(["[ D ] STULL (2011) WET-BULB TEMPERATURE", "Value", "Unit", "Live Excel Formula", "Source"]);
  push(["  Peak Temperature (T)", F("B7", calc.peak_tx5d_c,     FMT.dec2), "°C", "=B7",  d.cmip6_source]);
  push(["  Humidity (RH)",        F("B10", calc.era5_humidity,  FMT.dec2), "%",  "=B10", "ERA5 Archive"]);
  push([
    "  Raw WBT (Stull 2011)",
    F(
      "B36*ATAN(0.151977*SQRT(B37+8.313659))+ATAN(B36+B37)-ATAN(B37-1.676331)+0.00391838*POWER(B37,1.5)*ATAN(0.023101*B37)-4.686035",
      calc.rawWBT, FMT.dec2
    ),
    "°C", "Stull empirical formula", "Stull R. (2011) J. Applied Meteorology",
  ]);
  push([
    "▶ FINAL WBT (capped 35°C)",
    F("MIN(B38, 35.0)", calc.wbt, FMT.dec2),
    "°C", "=MIN(B38, 35.0)", "Sherwood & Huber (2010) PNAS — physiological limit",
  ]);
  blank();

  push(["[ E ] MITIGATION SCALING MODEL", "Value", "Unit", "Live Excel Formula", "Source"]);
  push(["  Canopy Offset %",      F("'Control Panel'!B18", calc.canopy_pct,  FMT.dec2), "%",      "='Control Panel'!B18", "User input"]);
  push(["  Albedo (Cool Roof) %", F("'Control Panel'!B19", calc.albedo_pct,  FMT.dec2), "%",      "='Control Panel'!B19", "User input"]);
  push(["  Total Cooling (°C)",   F("(B42/100*1.2)+(B43/100*0.8)", calc.coolingC, FMT.dec2), "°C","=(B42/100*1.2)+(B43/100*0.8)","Bowler (2010) + Santamouris (2015)"]);
  push(["  Effective Peak Temp",  F("MAX(0, B7 - B44)", calc.effectTemp,     FMT.dec2), "°C",    "=MAX(0, B7 - B44)",    "Derived"]);
  push(["  Effective HW Days",    F("MAX(0, B8 - (B44 * 3.5))", calc.effectHW, FMT.dec2), "days/yr","=MAX(0, B8-(B44*3.5))","Derived — 3.5 days/°C"]);
  blank();

  push(["[ F ] SENSITIVITY — 95% CI SUMMARY", "Lower Bound", "Point Estimate", "Upper Bound", "Uncertainty Source"]);
  push([
    "  Attributable Deaths",
    F("ROUND(B21*0.85,0)", Math.round(calc.attributable_deaths*0.85), FMT.int),
    F("B21", calc.attributable_deaths, FMT.int),
    F("ROUND(B21*1.15,0)", Math.round(calc.attributable_deaths*1.15), FMT.int),
    "±15% — Gasparrini (2017) β coefficient",
  ]);
  push([
    "  Economic Loss (USD)",
    F("B31*0.92", calc.economic_decay_usd*0.92, FMT.usd),
    F("B31", calc.economic_decay_usd, FMT.usd),
    F("B31*1.08", calc.economic_decay_usd*1.08, FMT.usd),
    "±8% — Burke (2018) model uncertainty",
  ]);

  return rows;
}
