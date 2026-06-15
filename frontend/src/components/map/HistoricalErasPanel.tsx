'use client';
import React from 'react';

type EraData = {
  label?: string;
  peak_temp?: string;
  avg_mean_temp?: string;
};

export interface HistoricalErasPanelProps {
  historicalEras: Record<string, EraData>;
}

function SustainedHeatLabel() {
  const [tipPos, setTipPos] = React.useState<{ top: number; left: number } | null>(null);
  const btnRef = React.useRef<HTMLSpanElement>(null);
  const showTip = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setTipPos({ top: r.top - 8, left: r.left + r.width / 2 });
  };
  return (
    <div className="flex items-center gap-1.5 mb-1">
      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Sustained Heat Average</p>
      <span
        ref={btnRef}
        className="flex items-center justify-center w-3 h-3 rounded-full border border-slate-600 text-[7px] text-slate-400 cursor-help"
        onMouseEnter={showTip}
        onMouseLeave={() => setTipPos(null)}
      >i</span>
      {tipPos && (
        <div
          className="fixed w-72 p-2.5 bg-[#060f1e] border border-slate-700 text-slate-400 text-[8px] leading-relaxed rounded shadow-xl z-[9999] -translate-x-1/2 -translate-y-full pointer-events-none"
          style={{ top: tipPos.top, left: tipPos.left }}
        >
          Note: This represents the decadal average of the hottest consecutive 5-day periods (Tx5d) across a 31km spatial grid. It smooths out 1-day anomalous spikes to provide stable actuarial baselines for economic models.
        </div>
      )}
    </div>
  );
}

export default function HistoricalErasPanel({ historicalEras }: HistoricalErasPanelProps) {
  return (
    <div className="w-full max-w-[1440px] mt-2 relative overflow-visible animate-fadeIn"
         style={{ border: '1px solid var(--hairline)', background: 'var(--panel)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 md:px-8 py-4 border-b" style={{ borderColor: 'var(--hairline)' }}>
        <div className="w-px h-4" style={{ background: 'linear-gradient(180deg, transparent, var(--muted), transparent)' }} />
        <p className="text-[10px] font-mono uppercase tracking-[0.25em] font-semibold" style={{ color: 'var(--muted)' }}>
          Historical Climate Record
        </p>
        <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, var(--hairline), transparent)' }} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3" style={{ borderTop: '1px solid var(--hairline)' }}>
        {/* Era 1 — Baseline */}
        <div className="relative flex flex-col p-5 md:p-7 overflow-visible" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <div className="absolute top-0 left-0 right-0 h-px"
               style={{ background: 'linear-gradient(90deg, transparent, rgba(47,111,143,0.5), transparent)' }} />
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--heat-1)' }} />
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] font-bold" style={{ color: 'var(--heat-1)' }}>
                Climate Baseline
              </p>
            </div>
            <span className="text-[9px] font-mono px-2 py-0.5" style={{ color: 'var(--muted)', border: '1px solid var(--hairline)' }}>
              {historicalEras.era1?.label}
            </span>
          </div>
          <div className="space-y-4">
            <div>
              <SustainedHeatLabel />
              <p className="text-[36px] md:text-[40px] font-mono font-bold leading-none tabular-nums glow-blue" style={{ color: 'var(--heat-1)' }}>
                {historicalEras.era1?.peak_temp}°C
              </p>
            </div>
            <div>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Mean Temperature</p>
              <p className="text-xl font-mono tabular-nums" style={{ color: 'var(--text-2)' }}>{historicalEras.era1?.avg_mean_temp}°C</p>
            </div>
          </div>
        </div>

        {/* Era 2 — Warming Trend */}
        <div className="relative flex flex-col p-5 md:p-7 overflow-visible"
             style={{ borderBottom: '1px solid var(--hairline)', borderLeft: '0px', borderRight: '0px' }}>
          <div className="absolute top-0 left-0 right-0 h-px"
               style={{ background: 'linear-gradient(90deg, transparent, rgba(183,146,55,0.5), transparent)' }} />
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--heat-2)' }} />
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] font-bold" style={{ color: 'var(--heat-2)' }}>
                Warming Trend
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5"
                 style={{ border: '1px solid rgba(183,146,55,0.3)', background: 'rgba(183,146,55,0.06)' }}>
              <span className="text-[9px] font-mono font-bold" style={{ color: 'var(--heat-2)' }}>
                ▲ +{(parseFloat(historicalEras.era2?.avg_mean_temp ?? '0') - parseFloat(historicalEras.era1?.avg_mean_temp ?? '0')).toFixed(1)}°C
              </span>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <SustainedHeatLabel />
              <p className="text-[36px] md:text-[40px] font-mono font-bold leading-none tabular-nums glow-amber" style={{ color: 'var(--heat-2)' }}>
                {historicalEras.era2?.peak_temp}°C
              </p>
            </div>
            <div>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Mean Temperature</p>
              <p className="text-xl font-mono tabular-nums" style={{ color: 'var(--text-2)' }}>{historicalEras.era2?.avg_mean_temp}°C</p>
            </div>
          </div>
        </div>

        {/* Era 3 — Current Climate */}
        <div className="relative flex flex-col p-5 md:p-7 overflow-visible">
          <div className="absolute top-0 left-0 right-0 h-px"
               style={{ background: 'linear-gradient(90deg, transparent, rgba(162,58,48,0.5), transparent)' }} />
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--heat-4)' }} />
              <p className="text-[9px] font-mono uppercase tracking-[0.2em] font-bold" style={{ color: 'var(--heat-4)' }}>
                Current Climate
              </p>
            </div>
            <div className="flex items-center gap-1.5 px-2 py-0.5"
                 style={{ border: '1px solid rgba(162,58,48,0.3)', background: 'rgba(162,58,48,0.06)' }}>
              <span className="text-[9px] font-mono font-bold" style={{ color: 'var(--heat-4)' }}>
                ▲ +{(parseFloat(historicalEras.era3?.avg_mean_temp ?? '0') - parseFloat(historicalEras.era1?.avg_mean_temp ?? '0')).toFixed(1)}°C
              </span>
            </div>
          </div>
          <div className="space-y-4">
            <div>
              <SustainedHeatLabel />
              <p className="text-[36px] md:text-[40px] font-mono font-bold leading-none tabular-nums glow-red" style={{ color: 'var(--heat-4)' }}>
                {historicalEras.era3?.peak_temp}°C
              </p>
            </div>
            <div>
              <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Mean Temperature</p>
              <p className="text-xl font-mono tabular-nums" style={{ color: 'var(--text-2)' }}>{historicalEras.era3?.avg_mean_temp}°C</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
