/**
 * export/sheetHelpers.ts — Shared helpers, types, and derived-calc logic for all Excel sheet builders.
 * Extracted from ExcelExport.tsx.
 */

import type { ExcelExportData } from '../ExcelExport';

// ── Formula cell helper ───────────────────────────────────────────────
export function F(formula: string, fallback: number | string, fmt?: string) {
  const type = typeof fallback === 'string' ? 's' : 'n';
  const cell: any = { t: type, f: formula, v: fallback };
  if (fmt && type === 'n') cell.z = fmt;
  return cell;
}

// ── Number cell helper ────────────────────────────────────────────────
export function N(value: number | string, fmt?: string) {
  const type = typeof value === 'string' ? 's' : 'n';
  const cell: any = { t: type, v: value };
  if (fmt && type === 'n') cell.z = fmt;
  return cell;
}

// ── Formats ───────────────────────────────────────────────────────────
export const FMT = {
  int:  '#,##0',
  dec2: '0.00',
  dec6: '0.000000',
  usd:  '"$"#,##0',
  pct:  '0.0"%"',
};

// ── Calibration — prevents unrealistic values ─────────────────────────
export function calibrateMetric(
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

// ── Derived calc type ─────────────────────────────────────────────────
export type DerivedCalc = ReturnType<typeof derive>;

// ── Derived calculations with full sanitization ───────────────────────
export function derive(d: ExcelExportData) {
  const beta = 0.0801;
  const tOpt = 13.0;

  const heatwave_days   = calibrateMetric(d.heatwave_days   || 0, 'heatwave');
  const peak_tx5d_c     = calibrateMetric(d.peak_tx5d_c     || 0, 'temp');
  const era5_p95_c      = calibrateMetric(d.era5_p95_c      || 0, 'temp');
  const era5_humidity   = Math.max(0, Math.min(d.era5_humidity_p95 || 70, 100));

  const mean_temp_c     = (d.mean_temp_c != null && isFinite(d.mean_temp_c))
                          ? d.mean_temp_c
                          : peak_tx5d_c;

  const population      = Math.max(0, d.population      || 0);
  const gdp_usd         = Math.max(0, d.gdp_usd         || 0);
  const death_rate      = (d.death_rate != null && isFinite(d.death_rate) && d.death_rate > 0)
                          ? Math.min(d.death_rate, 50)
                          : null;
  const vulnerability   = Math.max(0.1, Math.min(d.vulnerability || 1.0, 5.0));
  const canopy_pct      = Math.max(0, Math.min(d.canopy_pct  || 0, 100));
  const albedo_pct      = Math.max(0, Math.min(d.albedo_pct  || 0, 100));

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

  const deaths_raw = (d.attributable_deaths > 0 && isFinite(d.attributable_deaths))
    ? d.attributable_deaths
    : death_rate != null
      ? Math.round(population * (death_rate / 1000) * hwFrac * af * vulnerability)
      : 0;

  const loss_raw = (d.economic_decay_usd > 0 && isFinite(d.economic_decay_usd))
    ? d.economic_decay_usd
    : gdp_usd * (burkePen + iloFrac);

  const attributable_deaths = calibrateMetric(deaths_raw, 'deaths');
  const economic_decay_usd  = calibrateMetric(loss_raw, 'loss');
  const mitDeaths           = calibrateMetric(Math.round(attributable_deaths * hwR * sevR), 'deaths');
  const mitLoss             = calibrateMetric(economic_decay_usd * hwR * sevR, 'loss');

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
    heatwave_days, peak_tx5d_c, era5_p95_c, era5_humidity,
    mean_temp_c, population, gdp_usd, death_rate, vulnerability,
    canopy_pct, albedo_pct,
    era5_baseline_c: isFinite(d.era5_baseline_c) ? d.era5_baseline_c : 0,
  };
}
