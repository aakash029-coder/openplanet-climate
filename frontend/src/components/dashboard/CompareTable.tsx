'use client';

import React from 'react';
import {
  formatWBT,
  formatDeathsRange,
  formatEconomicRange,
  formatCoordinates,
} from '@/context/ClimateDataContext';
import type { Projection } from './SideBySideMathModal';
import { useProgressiveText } from '@/hooks/useProgressiveText';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface CityResult {
  query: string;
  display_name: string;
  lat: number;
  lng: number;
  elevation: number;
  threshold_c: number;
  cooling_offset_c: number;
  gdp_usd: number | null;
  population: number | null;
  projections: Projection[];
  baseline: { baseline_mean_c: number | null };
  climateIntelligence?: Record<string, unknown> | null;
  loading: boolean;
  error: string | null;
}

export interface CompareTableProps {
  okResults:    CityResult[];
  compareYear:  number;
  canopy:       number;
  albedo:       number;
  ssp:          string;
  projA:        Projection | null;
  projB:        Projection | null;
  aiAnalysis:   string | null;
  aiLoading:    boolean;
  onMathModal:  (p: { metricLabel: string; metricKey: string; valA: number | null; valB: number | null }) => void;
}

// ── Local helpers ──────────────────────────────────────────────────────────────

function getCountry(displayName: string | undefined): string {
  if (!displayName) return '';
  const parts = displayName.split(', ');
  return parts[parts.length - 1] || '';
}

function fmt(n: number | null | undefined, d = 1): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtUSD(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  const sign = n < 0 ? "−$" : "$";
  const abs  = Math.abs(n);
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(1)}T`;
  if (abs >= 1e9)  return `${sign}${(abs / 1e9).toFixed(1)}B`;
  if (abs >= 1e6)  return `${sign}${(abs / 1e6).toFixed(1)}M`;
  return `${sign}${abs.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function cleanAiText(text: string | null): string {
  if (!text) return "";
  return text.replace(/\*/g, '').replace(/([a-z])([.?!])([A-Z])/g, '$1$2 $3');
}

const SourceLine = ({ source }: { source: string }) => (
  <p className="mt-1 text-[8px] font-mono text-slate-600 italic">{source}</p>
);

// ── Exported pure helper (still used in CompareModule for UI-less contexts) ───

export function getMitigatedValue(
  baseValue: number | null | undefined,
  metricKey: string,
  baseHW: number,
  canopy: number,
  albedo: number,
): number | null {
  if (baseValue == null) return null;
  const cooling = (canopy / 100) * 1.2 + (albedo / 100) * 0.8;
  if (['peak_tx5d_c', 'uhi_intensity_c'].includes(metricKey)) return Math.max(0, baseValue - cooling);
  if (metricKey === 'wbt_max_c')     return Math.min(35.0, Math.max(0, baseValue - cooling));
  if (metricKey === 'heatwave_days') return Math.max(0, baseValue - (cooling * 3.5));
  if (['attributable_deaths', 'economic_decay_usd'].includes(metricKey)) {
    const effHW = Math.max(0, baseHW - (cooling * 3.5));
    const hwR   = baseHW > 0 ? effHW / baseHW : 1;
    return baseValue * hwR * Math.max(0, 1 - (cooling * 0.08));
  }
  return baseValue;
}

// ── Metrics config ─────────────────────────────────────────────────────────────

const METRICS = [
  { key: "heatwave_days",       label: "Heatwave Days",       unit: "d/yr",   source: "CMIP6 Ensemble · ERA5 P95",        fmt: (v: number) => `${fmt(v, 0)}d`,                             hasCalc: false },
  { key: "peak_tx5d_c",         label: "Peak Tx5d",           unit: "°C",     source: "Open-Meteo CMIP6",                 fmt: (v: number) => `${fmt(v)}°C`,                               hasCalc: false },
  { key: "wbt_max_c",           label: "Max Wet-Bulb",        unit: "°C",     source: "Stull (2011) · ERA5 P95 Humidity", fmt: (v: number) => formatWBT(v),                                hasCalc: false },
  { key: "uhi_intensity_c",     label: "Surface UHI",         unit: "°C",     source: "",                                 fmt: (v: number) => `+${fmt(v)}°C`,                              hasCalc: false },
  { key: "attributable_deaths", label: "Attributable Deaths", unit: "est/yr", source: "Gasparrini (2017), Lancet",        fmt: (v: number) => Math.round(v).toLocaleString(),              hasCalc: true  },
  { key: "economic_decay_usd",  label: "Economic Decay",      unit: "USD",    source: "Burke (2018) · ILO (2019)",        fmt: (v: number) => fmtUSD(v),                                   hasCalc: true  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function CompareTable({
  okResults, compareYear, canopy, albedo, ssp,
  projA, projB, aiAnalysis, aiLoading, onMathModal,
}: CompareTableProps) {
  const hasMitigation = canopy > 0 || albedo > 0;
  const cleanedAi     = aiAnalysis ? cleanAiText(aiAnalysis) : null;
  const progressiveAi = useProgressiveText(cleanedAi);

  const getMit = (v: number | null | undefined, k: string, hw = 0) =>
    getMitigatedValue(v, k, hw, canopy, albedo);

  return (
    <>
      {/* ── Mitigation summary ── */}
      {hasMitigation && (
        <div className="border border-emerald-800/30 p-5" style={{ background: 'var(--raised)' }}>
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-emerald-500" />
            <p className="font-sans text-eye uppercase tracking-[0.14em] font-semibold" style={{ color: 'var(--muted)' }}>
              Mitigation Applied · +{canopy}% canopy · +{albedo}% albedo · {compareYear}
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {okResults.map((r) => {
              const proj = r.projections?.find(p => p.year === compareYear);
              if (!proj) return null;
              const mitDeaths = getMit(proj.attributable_deaths, 'attributable_deaths', proj.heatwave_days);
              const mitLoss   = getMit(proj.economic_decay_usd,  'economic_decay_usd',  proj.heatwave_days);
              const mitTemp   = getMit(proj.peak_tx5d_c,         'peak_tx5d_c',         proj.heatwave_days);
              const mitHW     = getMit(proj.heatwave_days,        'heatwave_days',       proj.heatwave_days);
              return (
                <div key={r.query}>
                  <p className="font-sans text-eye uppercase tracking-[0.14em] font-semibold mb-3 truncate" style={{ color: 'var(--muted)' }}>{r.query}</p>
                  <div className="grid grid-cols-2 gap-3">
                    {([
                      { label: 'Deaths',    base: proj.attributable_deaths.toLocaleString(), mit: mitDeaths ? Math.round(mitDeaths).toLocaleString() : '—', saved: mitDeaths ? `−${(proj.attributable_deaths - Math.round(mitDeaths)).toLocaleString()}` : '—', bc: 'text-red-400'    },
                      { label: 'Econ Loss', base: fmtUSD(proj.economic_decay_usd),            mit: fmtUSD(mitLoss),                                          saved: mitLoss ? `−${fmtUSD(proj.economic_decay_usd - mitLoss)}` : '—',                         bc: 'text-amber-400'  },
                      { label: 'Peak Temp', base: `${fmt(proj.peak_tx5d_c)}°C`,               mit: `${fmt(mitTemp)}°C`,                                 saved: `−${fmt(proj.peak_tx5d_c - (mitTemp ?? proj.peak_tx5d_c))}°C`,                        bc: 'text-orange-400' },
                      { label: 'HW Days',   base: `${proj.heatwave_days}d`,                   mit: `${Math.round(mitHW ?? proj.heatwave_days)}d`,              saved: `−${proj.heatwave_days - Math.round(mitHW ?? proj.heatwave_days)}d`,                 bc: 'text-yellow-400' },
                    ] as const).map((item) => (
                      <div key={item.label} className="border border-white/[0.04] p-3" style={{ background: 'var(--panel)' }}>
                        <p className="text-[8px] font-mono text-slate-600 uppercase mb-1.5">{item.label}</p>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-[8px] font-mono text-slate-600">W/o</span>
                          <span className={`text-[11px] font-mono font-bold tabular-nums text-right ${item.bc}`}>{item.base}</span>
                        </div>
                        <div className="flex justify-between items-baseline mb-1">
                          <span className="text-[8px] font-mono text-slate-600">With</span>
                          <span className="text-[11px] font-mono font-bold tabular-nums text-right text-slate-300">{item.mit}</span>
                        </div>
                        <div className="flex justify-between items-baseline bg-emerald-950/30 px-1.5 py-1 border border-emerald-800/20">
                          <span className="text-[7px] font-mono text-slate-600 uppercase">Saved</span>
                          <span className="text-[10px] font-mono tabular-nums text-right text-emerald-400 font-bold">{item.saved}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Main comparison table ── */}
      <div className="w-full border border-white/[0.05]" style={{ background: 'var(--raised)' }}>

        {/* Sticky VS comparison header */}
        <div className="sticky top-16 z-20 border-b border-white/[0.05]" style={{ background: 'var(--panel)' }}>
          <div className="grid" style={{ gridTemplateColumns: '1fr 56px 1fr' }}>

            {/* City A */}
            <div className="px-5 md:px-7 py-5">
              <p className="font-mono text-[7px] uppercase tracking-[0.22em] mb-2.5" style={{ color: 'var(--reference)' }}>
                {ssp.toUpperCase()} · {compareYear}
                {hasMitigation && ` · +${canopy}% canopy`}
              </p>
              <p className="font-sans text-base md:text-lg font-semibold tracking-tight leading-none mb-1.5 truncate" style={{ color: 'var(--text)' }}>
                {okResults[0]?.query ?? '—'}
              </p>
              <p className="font-mono text-[8px] mb-0.5" style={{ color: 'var(--muted)' }}>
                {getCountry(okResults[0]?.display_name)}
              </p>
              {(okResults[0]?.lat || okResults[0]?.lng) && (
                <p className="font-mono text-[8px] tabular-nums" style={{ color: 'var(--muted)', opacity: 0.7 }}>
                  {formatCoordinates(okResults[0].lat, okResults[0].lng)}
                  {okResults[0].elevation > 0 && ` · ${okResults[0].elevation.toFixed(0)}m`}
                </p>
              )}
            </div>

            {/* VS divider */}
            <div
              className="flex items-center justify-center"
              style={{ borderLeft: '1px solid var(--hairline)', borderRight: '1px solid var(--hairline)' }}
            >
              <span className="font-mono text-[9px] font-bold tracking-[0.3em]" style={{ color: 'var(--muted)', opacity: 0.5 }}>VS</span>
            </div>

            {/* City B */}
            <div className="px-5 md:px-7 py-5 text-right">
              <p className="font-mono text-[7px] uppercase tracking-[0.22em] mb-2.5" style={{ color: 'var(--reference)' }}>
                {ssp.toUpperCase()} · {compareYear}
                {hasMitigation && ` · +${albedo}% albedo`}
              </p>
              <p className="font-sans text-base md:text-lg font-semibold tracking-tight leading-none mb-1.5 truncate" style={{ color: 'var(--text)' }}>
                {okResults[1]?.query ?? '—'}
              </p>
              <p className="font-mono text-[8px] mb-0.5" style={{ color: 'var(--muted)' }}>
                {getCountry(okResults[1]?.display_name)}
              </p>
              {(okResults[1]?.lat || okResults[1]?.lng) && (
                <p className="font-mono text-[8px] tabular-nums" style={{ color: 'var(--muted)', opacity: 0.7 }}>
                  {formatCoordinates(okResults[1].lat, okResults[1].lng)}
                  {okResults[1].elevation > 0 && ` · ${okResults[1].elevation.toFixed(0)}m`}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/[0.05]" style={{ background: 'var(--raised)' }}>
                <th className="px-5 md:px-6 py-4 text-[9px] font-mono uppercase tracking-widest w-[36%]" style={{ color: 'var(--muted)' }}>
                  Parameter
                  <p className="text-[8px] mt-1 normal-case tracking-normal font-normal" style={{ color: 'var(--muted)', opacity: 0.55 }}>
                    Rows with <span className="text-[#0ea5e9] font-bold border border-white/[0.09] bg-cyan-900/30 px-1 text-[7px]">CALC</span> badge open audit
                  </p>
                </th>
                {okResults.map(r => (
                  <th key={r.query} className="px-5 md:px-6 py-4 text-center w-[32%]">
                    <span className="font-mono text-[10px] font-bold uppercase tracking-widest truncate block" style={{ color: 'var(--text-2)' }}>{r.query}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {METRICS.map(m => {
                const baseVals = okResults.map(r => {
                  const p = r.projections?.find(pr => pr.year === compareYear);
                  if (!p) return null;
                  let val: number | null | undefined = (p as unknown as Record<string, number | null | undefined>)[m.key];
                  if (m.key === 'uhi_intensity_c' && val == null) {
                    val = r.baseline?.baseline_mean_c != null
                      ? (p.peak_tx5d_c - r.baseline.baseline_mean_c)
                      : 2.1;
                  }
                  return val ?? null;
                });
                const mitigatedVals = okResults.map((r, i) => {
                  const p = r.projections?.find(pr => pr.year === compareYear);
                  if (!p) return null;
                  return getMit(baseVals[i], m.key, p.heatwave_days);
                });
                const displayVals = hasMitigation ? mitigatedVals : baseVals;
                const maxVal      = Math.max(...displayVals.filter((v): v is number => v !== null));

                return (
                  <tr
                    key={m.key}
                    className={`hover:bg-white/[0.02] transition-colors group ${m.hasCalc ? 'cursor-pointer' : ''}`}
                    onClick={() => {
                      if (!m.hasCalc || !projA || !projB) return;
                      onMathModal({ metricLabel: m.label, metricKey: m.key, valA: displayVals[0], valB: displayVals[1] });
                    }}
                  >
                    <td className="px-5 md:px-6 py-5">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-mono text-slate-300 uppercase tracking-wider group-hover:text-white transition-colors">{m.label}</span>
                        {m.hasCalc && (
                          <span className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 bg-cyan-900/40 border border-white/[0.09] text-[#0ea5e9] text-[7px] font-bold uppercase">
                            CALC ↗
                          </span>
                        )}
                      </div>
                      <div className="text-[8px] font-mono text-slate-700 mt-0.5 uppercase">{m.unit}</div>
                      <SourceLine source={m.source} />
                    </td>
                    {okResults.map((r, i) => {
                      const baseV = baseVals[i];
                      const mitV  = mitigatedVals[i];
                      const dispV = displayVals[i];
                      const isMax = dispV != null && dispV === maxVal && maxVal > 0;
                      return (
                        <td key={r.query} className="px-5 md:px-6 py-5 text-right">
                          {hasMitigation && baseV != null && (
                            <div className="text-[9px] font-mono tabular-nums text-slate-600 mb-1">
                              <span className="text-[7px] uppercase tracking-widest text-slate-700 mr-1">Base:</span>
                              {m.fmt(baseV)}
                            </div>
                          )}
                          <span className={`font-mono tabular-nums text-sm ${isMax ? "text-[#0ea5e9] font-bold" : hasMitigation ? "text-[#10b981] font-bold" : "text-white"}`}>
                            {dispV != null ? m.fmt(dispV) : "—"}
                          </span>
                          {isMax && <span className="block mt-1 text-[8px] text-[#0ea5e9]/70 uppercase font-mono tracking-widest">Max. Exposure</span>}
                          {hasMitigation && baseV != null && mitV != null && (
                            <div className="text-[8px] font-mono tabular-nums text-emerald-500 mt-1">
                              {m.key === 'economic_decay_usd'   ? `−${fmtUSD(baseV - mitV)}`
                              : m.key === 'attributable_deaths' ? `−${Math.round(baseV - mitV).toLocaleString()}`
                              : `−${fmt(baseV - mitV)}`}
                            </div>
                          )}
                          {dispV != null && m.key === 'attributable_deaths' && (
                            <div className="text-[7px] font-mono tabular-nums text-slate-600 mt-1">CI: {formatDeathsRange(dispV)}</div>
                          )}
                          {dispV != null && m.key === 'economic_decay_usd' && (
                            <div className="text-[7px] font-mono tabular-nums text-slate-600 mt-1">{formatEconomicRange(dispV)}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>


        {/* AI Analysis */}
        <div className="border-t border-white/[0.05] px-5 md:px-8 py-7">
          <h4 className="flex items-center gap-3 font-sans text-eye uppercase tracking-[0.14em] font-semibold mb-4" style={{ color: 'var(--muted)' }}>
            <span className="w-1.5 h-1.5 bg-[#0ea5e9] rounded-full" />
            Analyst summary
          </h4>
          {aiLoading ? (
            <div className="space-y-2 py-3">
              <div className="animate-pulse bg-zinc-900/60 h-3 w-full rounded-none" />
              <div className="animate-pulse bg-zinc-900/60 h-3 w-[92%] rounded-none" />
              <div className="animate-pulse bg-zinc-900/60 h-3 w-5/6 rounded-none" />
              <div className="animate-pulse bg-zinc-900/60 h-3 w-4/5 rounded-none" />
              <div className="animate-pulse bg-zinc-900/60 h-3 w-3/4 rounded-none" />
              <div className="animate-pulse bg-zinc-900/60 h-3 w-2/3 rounded-none" />
              <div className="flex items-center gap-2 pt-3 font-mono text-[9px] uppercase tracking-[0.18em]"
                   style={{ color: 'var(--reference)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse shrink-0" />
                <span>Generating comparative analysis</span>
                <span className="animate-pulse">▋</span>
              </div>
            </div>
          ) : cleanedAi ? (
            <p className="font-serif text-body-s leading-loose" style={{ color: 'var(--text-2)' }}>
              {progressiveAi}
              {progressiveAi !== cleanedAi && <span className="animate-pulse font-mono">▋</span>}
            </p>
          ) : (
            <p className="text-[10px] font-mono text-slate-600 italic">Comparative analysis unavailable. Please interpret the metrics above.</p>
          )}
          <div className="font-mono text-[8px] text-zinc-500 block mt-4 pt-3 border-t border-white/5 text-center leading-relaxed">
            AI DISCLOSURE — The analyst summary above is AI-generated. Verify all figures against the sourced metrics in the table above.
          </div>
        </div>
      </div>
    </>
  );
}
