'use client';

import React from 'react';

/**
 * ExcelExport.tsx — OpenPlanet World-Tier Audit Model
 * Pure `xlsx` library — no styling dependency
 * 4 Sheets: README | Control Panel | Core Engine | Constants & Provenance
 *
 * Sheet builders are in ./export/:
 *   summarySheet.ts    → README sheet
 *   projectionSheet.ts → Control Panel sheet
 *   methodologySheet.ts → Core Engine sheet
 *   rawDataSheet.ts    → Constants & Provenance sheet
 *
 * Shared helpers (F, N, FMT, calibrateMetric, derive) are in ./export/sheetHelpers.ts
 */

import * as XLSX from 'xlsx';
import { derive } from './export/sheetHelpers';
import { buildReadme } from './export/summarySheet';
import { buildControlPanel } from './export/projectionSheet';
import { buildCoreEngine } from './export/methodologySheet';
import { buildProvenance } from './export/rawDataSheet';

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
  death_rate:          number | null;
  vulnerability:       number;
  canopy_pct:          number;
  albedo_pct:          number;
  attributable_deaths: number;
  economic_decay_usd:  number;
  wbt_c:               number;
  cmip6_source:        string;
}

// ── Main export function ──────────────────────────────────────────────
export function downloadExcelAuditModel(data: ExcelExportData): void {
  const wb   = XLSX.utils.book_new();
  const calc = derive(data);

  // Sheet 0: README
  const ws0 = XLSX.utils.aoa_to_sheet(buildReadme(data, calc));
  ws0['!cols'] = [{ wch: 80 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws0, "README");

  // Sheet 1: Control Panel
  const ws1 = XLSX.utils.aoa_to_sheet(buildControlPanel(data, calc));
  ws1['!cols'] = [{ wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 45 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Control Panel");

  // Sheet 2: Core Engine
  const ws2 = XLSX.utils.aoa_to_sheet(buildCoreEngine(data, calc));
  ws2['!cols'] = [{ wch: 30 }, { wch: 18 }, { wch: 10 }, { wch: 55 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Core Engine");

  // Sheet 3: Provenance
  const ws3 = XLSX.utils.aoa_to_sheet(buildProvenance(data));
  ws3['!cols'] = [{ wch: 30 }, { wch: 40 }, { wch: 45 }, { wch: 65 }];
  XLSX.utils.book_append_sheet(wb, ws3, "Constants & Provenance");

  const safeName = (data.city_name || 'Unknown')
    .replace(/FORMULA TEMPLATE.*/, 'TEMPLATE')
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .substring(0, 40);
  const filename = `OpenPlanet_${safeName}_${data.target_year}_${data.ssp}.xlsx`;
  XLSX.writeFile(wb, filename);
}

// ── Button components ─────────────────────────────────────────────────
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
