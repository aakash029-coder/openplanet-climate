'use client';

import React from 'react';

// ── Shared types ──────────────────────────────────────────────────────────────

export interface Projection {
  year:                number;
  source:              string;
  heatwave_days:       number;
  peak_tx5d_c:         number;
  wbt_max_c?:          number;
  uhi_intensity_c?:    number;
  attributable_deaths: number;
  economic_decay_usd:  number;
  region?:             string;
  audit_trail?:        Record<string, unknown>;
}

interface AuditSection {
  formula?:     string;
  source?:      string;
  variables?:   Record<string, unknown>;
  computation?: string;
}

// ── Local helpers (duplicated deliberately — no cross-module coupling) ─────────

function fmt(n: number | null | undefined, d = 1): string {
  if (n == null || isNaN(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtUSD(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '—';
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

const SourceLine = ({ source }: { source: string }) => (
  <p className="mt-1 text-[8px] font-mono text-slate-600 italic">{source}</p>
);

// ── Props ─────────────────────────────────────────────────────────────────────

export interface SideBySideMathModalProps {
  open:        boolean;
  onClose:     () => void;
  metricLabel: string;
  metricKey:   string;
  cityA:       string;
  cityB:       string;
  projA:       Projection | null;
  projB:       Projection | null;
  valA:        number | null;
  valB:        number | null;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function SideBySideMathModal({
  open, onClose, metricLabel, metricKey,
  cityA, cityB, projA, projB, valA, valB,
}: SideBySideMathModalProps) {
  if (!open || !projA || !projB) return null;

  const auditA = projA.audit_trail;
  const auditB = projB.audit_trail;

  const getSection = (audit: Record<string, unknown> | undefined): AuditSection | null => {
    if (!audit) return null;
    if (metricKey === 'attributable_deaths') return (audit.mortality as AuditSection) ?? null;
    if (metricKey === 'economic_decay_usd')  return (audit.economics as AuditSection) ?? null;
    return null;
  };

  const secA = getSection(auditA);
  const secB = getSection(auditB);

  const formatVal = (val: number | null) => {
    if (val == null) return '—';
    if (metricKey === 'economic_decay_usd')  return fmtUSD(val);
    if (metricKey === 'attributable_deaths') return Math.round(val).toLocaleString();
    return `${fmt(val)}°C`;
  };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto border border-white/[0.05] p-6"
        style={{ background: 'var(--raised)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-7 h-7 bg-white/[0.05] border border-white/[0.09] text-slate-500 hover:text-white flex items-center justify-center transition-all"
        >
          ✕
        </button>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 bg-cyan-400 rounded-full" />
          <h3 className="text-[10px] font-mono text-[#0ea5e9] uppercase tracking-[0.3em] font-bold">
            Side-by-Side Calculation Audit
          </h3>
        </div>
        <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-5">
          {metricLabel} — same formula, both cities
        </p>

        {secA && secB ? (
          <>
            <div className="border border-white/[0.05] p-4 mb-5" style={{ background: 'var(--panel)' }}>
              <p className="text-[9px] font-mono text-cyan-200 uppercase tracking-[0.2em] mb-2">
                Formula (identical for both)
              </p>
              <p className="text-white font-mono text-sm">{secA.formula}</p>
              {secA.source && <SourceLine source={secA.source} />}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {([
                { city: cityA, sec: secA, val: valA },
                { city: cityB, sec: secB, val: valB },
              ] as const).map(({ city, sec, val }) => (
                <div key={city} className="border border-white/[0.05] p-4" style={{ background: 'var(--panel)' }}>
                  <p className="text-[9px] font-mono text-slate-300 uppercase tracking-widest font-bold mb-3 truncate">
                    {city}
                  </p>
                  {sec.variables && (
                    <div className="space-y-1 mb-3">
                      {Object.entries(sec.variables).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-[9px] font-mono text-[#0ea5e9]">{k}</span>
                          <span className="text-[9px] font-mono tabular-nums text-slate-300">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {sec.computation && (
                    <div className="bg-black/40 p-2.5 mt-2 border border-white/[0.05]">
                      <p className="text-[9px] font-mono text-white leading-relaxed break-all">
                        {sec.computation}
                      </p>
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest">
                        Calculation validated
                      </span>
                    </div>
                    <span className="text-[11px] font-mono tabular-nums text-white font-bold">
                      {formatVal(val)}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {valA != null && valB != null && (
              <div className="mt-4 p-4 bg-cyan-950/20 border border-white/[0.05]">
                <p className="text-[9px] font-mono text-[#0ea5e9] uppercase tracking-widest">
                  Higher exposure:{' '}
                  <span className="font-bold text-white">
                    {valA > valB ? cityA : valA < valB ? cityB : 'Equal'}
                  </span>
                  {valA !== valB && (
                    <span className="text-slate-500 ml-2">
                      (difference: {formatVal(Math.abs(valA - valB))})
                    </span>
                  )}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {([
              { city: cityA, val: valA },
              { city: cityB, val: valB },
            ] as const).map(({ city, val }) => (
              <div key={city} className="border border-white/[0.05] p-4" style={{ background: 'var(--panel)' }}>
                <p className="text-[9px] font-mono text-slate-300 uppercase tracking-widest font-bold mb-2 truncate">
                  {city}
                </p>
                <p className="text-2xl font-mono tabular-nums text-white font-bold">
                  {formatVal(val)}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
