import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from 'recharts';

export const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center w-full py-32 bg-[#020617]">
    <div className="relative w-16 h-16 mb-8">
      {/* Outer ring */}
      <div className="absolute inset-0 rounded-full border border-cyan-500/10 border-t-cyan-500/60 animate-spin" style={{ animationDuration: '1.2s' }} />
      {/* Inner ring */}
      <div className="absolute inset-2 rounded-full border border-indigo-500/10 border-t-indigo-400/60 animate-spin" style={{ animationDuration: '0.8s', animationDirection: 'reverse' }} />
      {/* Core dot */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)] animate-pulse" />
      </div>
    </div>
    <span className="font-mono text-[9px] text-cyan-500/70 tracking-[0.6em] uppercase animate-pulse">
      Computing Spatial Risk Array
    </span>
    <div className="mt-4 flex gap-1">
      {[0, 1, 2, 3, 4].map(i => (
        <div
          key={i}
          className="w-1 h-1 rounded-full bg-cyan-500/40"
          style={{ animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite` }}
        />
      ))}
    </div>
  </div>
);

export const AiCard = ({
  text,
  title,
  icon,
  severity,
}: {
  text: string;
  title: string;
  icon?: React.ReactNode;
  severity?: string;
}) => {
  if (!text) return null;
  const clean = (s: string) => s.replace(/\*\*.*?\*\*:?/g, '').replace(/^:\s*/, '').trim();

  const severityMeta =
    severity === 'CRITICAL'
      ? { color: 'text-red-400', bg: 'bg-red-500/8', border: 'border-red-500/20', dot: 'bg-red-400', glow: 'shadow-[0_0_8px_rgba(239,68,68,0.3)]' }
      : severity === 'HIGH'
      ? { color: 'text-amber-400', bg: 'bg-amber-500/8', border: 'border-amber-500/20', dot: 'bg-amber-400', glow: 'shadow-[0_0_8px_rgba(245,158,11,0.3)]' }
      : severity === 'STRONG'
      ? { color: 'text-emerald-400', bg: 'bg-emerald-500/8', border: 'border-emerald-500/20', dot: 'bg-emerald-400', glow: 'shadow-[0_0_8px_rgba(16,185,129,0.3)]' }
      : { color: 'text-slate-400', bg: 'bg-slate-500/8', border: 'border-slate-500/20', dot: 'bg-slate-400', glow: '' };

  if (text.includes('**EFFECT:**') && text.includes('**SOLUTION:**')) {
    const [rawCause] = text.split('**EFFECT:**');
    return (
      <div className={`relative bg-[#060f1e] border ${severityMeta.border} rounded-2xl p-4 h-full flex flex-col gap-3 overflow-hidden group hover:border-opacity-50 transition-all duration-300`}>
        <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-30 ${severityMeta.color}`} />
        <div className="flex items-start gap-2.5 pb-3 border-b border-slate-800/50">
          {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
          <div className="min-w-0">
            {severity && (
              <div className="flex items-center gap-1.5 mb-1">
                <div className={`w-1.5 h-1.5 rounded-full ${severityMeta.dot} ${severityMeta.glow}`} />
                <p className={`text-[8px] font-mono uppercase tracking-[0.15em] font-bold ${severityMeta.color}`}>{severity}</p>
              </div>
            )}
            <p className="text-[10px] font-mono text-slate-200 uppercase tracking-[0.15em] font-bold leading-tight">{title}</p>
          </div>
        </div>
        <p className="text-slate-400 text-[11px] leading-relaxed font-sans flex-grow">{clean(rawCause)}</p>
      </div>
    );
  }

  return (
    <div className={`relative bg-[#060f1e] border ${severityMeta.border} rounded-2xl p-4 h-full flex flex-col gap-3 overflow-hidden hover:border-opacity-60 transition-all duration-300`}>
      <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-current to-transparent opacity-20 ${severityMeta.color}`} />
      <div className="flex items-start gap-2.5 pb-3 border-b border-slate-800/50">
        {icon && <div className="shrink-0 mt-0.5">{icon}</div>}
        <div className="min-w-0">
          {severity && (
            <div className="flex items-center gap-1.5 mb-1">
              <div className={`w-1.5 h-1.5 rounded-full ${severityMeta.dot} ${severityMeta.glow}`} />
              <p className={`text-[8px] font-mono uppercase tracking-[0.15em] font-bold ${severityMeta.color}`}>{severity}</p>
            </div>
          )}
          <p className="text-[10px] font-mono text-slate-200 uppercase tracking-[0.15em] font-bold leading-tight">{title}</p>
        </div>
      </div>
      <p className="text-slate-400 text-[11px] leading-relaxed font-sans flex-grow">{clean(text)}</p>
    </div>
  );
};

const HeatwaveTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-[#0d1f3c] border border-slate-700/60 rounded-xl px-3.5 py-2.5 shadow-[0_8px_32px_rgba(0,0,0,0.5)]">
      <p className="text-[9px] font-mono text-slate-500 mb-1.5 uppercase tracking-widest">{label}</p>
      <p className="text-[15px] font-mono text-blue-400 font-bold tabular-nums">{val}<span className="text-[10px] text-slate-500 ml-0.5">d</span></p>
    </div>
  );
};

const MitigationDonut = ({ reductionPct }: { reductionPct: number }) => {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const safePct = isNaN(reductionPct) ? 0 : Math.min(Math.max(reductionPct, 0), 100);
  const dash = (safePct / 100) * circ;

  return (
    <div className="relative bg-[#060f1e] border border-emerald-900/30 rounded-2xl p-5 h-full flex flex-col items-center justify-center overflow-hidden">
      {/* Subtle glow backdrop */}
      <div className="absolute inset-0 bg-emerald-500/3 rounded-2xl" />
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />

      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em] mb-5 font-bold z-10">
        Mitigation Efficiency
      </p>

      <div className="relative w-28 h-28 z-10">
        {/* Background glow */}
        <div className="absolute inset-0 rounded-full bg-emerald-500/5 blur-xl" />
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          {/* Track */}
          <circle cx="40" cy="40" r={r} fill="none" stroke="#0f2a1a" strokeWidth="7" />
          {/* Progress */}
          <circle
            cx="40" cy="40" r={r} fill="none"
            stroke="url(#emeraldGrad)" strokeWidth="7"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
          <defs>
            <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#059669" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[24px] font-mono font-bold text-white tracking-tighter leading-none">{safePct}%</span>
          <span className="text-[7px] font-mono text-emerald-500/70 uppercase tracking-widest mt-1">Reduction</span>
        </div>
      </div>

      <div className="mt-5 z-10 flex items-center gap-2 bg-emerald-950/30 border border-emerald-900/30 rounded-lg px-3 py-1.5">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
        <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest">Active Simulation</span>
      </div>
    </div>
  );
};

/* ─── Shared chart axis/grid styles ─── */
const axisProps = { stroke: '#1e2d45', tick: { fill: '#334155', fontSize: 9, fontFamily: 'ui-monospace, monospace' } };
const gridProps = { strokeDasharray: '3 3', stroke: '#0f1f33', vertical: false };

export const AnalyticsSection = ({
  isLoading,
  isInitialized,
  chartData,
  aiAnalysis,
  selectedCity,
  mitigatedData,
  simData,
  baseDeathsNum,
}: any) => {

  const overallReduction = (() => {
    if (!mitigatedData || !baseDeathsNum || isNaN(baseDeathsNum) || baseDeathsNum === 0) return 0;
    const saved = parseFloat(mitigatedData.savedDeathsNum) || 0;
    return Math.round((saved / baseDeathsNum) * 100);
  })();

  if (isLoading) return <LoadingSpinner />;
  if (!isInitialized) return null;

  const renderDeaths = simData?.deaths || '--';
  const renderLoss = simData?.loss || '--';
  const renderTemp = simData?.temp || '--';
  const renderHeatwave = simData?.heatwave || '--';

  return (
    <div className="w-full space-y-0">

      {/* ── CHARTS AREA ── */}
      {(chartData?.heatwave?.length > 0 || chartData?.economic?.length > 0) && (
        <section className="px-4 md:px-8 lg:px-10 py-10 w-full border-b border-slate-800/30">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-px h-4 bg-gradient-to-b from-transparent via-cyan-500 to-transparent" />
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.35em]">Trend Projections</span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-r from-slate-800 to-transparent" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

            {/* HEATWAVE LINE CHART */}
            {chartData.heatwave.length > 0 && (
              <div className="bg-[#060f1e] border border-slate-800/50 rounded-2xl p-5 flex flex-col shadow-xl hover:border-blue-900/40 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_6px_rgba(59,130,246,0.6)]" />
                  <p className="text-[10px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold">
                    Heatwave Frequency
                  </p>
                </div>
                <p className="text-[8px] font-mono text-slate-600 mb-4 ml-4">Annual days above historical P95</p>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.heatwave} margin={{ top: 10, right: 16, bottom: 5, left: -8 }}>
                      <defs>
                        <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#3b82f6" />
                          <stop offset="100%" stopColor="#818cf8" />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="year" {...axisProps} />
                      <YAxis {...axisProps} unit="d" />
                      <RechartsTooltip content={<HeatwaveTooltip />} />
                      <Line
                        type="monotone" dataKey="val" stroke="url(#lineGrad)" strokeWidth={2.5}
                        dot={{ r: 3.5, fill: '#060f1e', strokeWidth: 2, stroke: '#3b82f6' }}
                        activeDot={{ r: 5, fill: '#3b82f6', strokeWidth: 0 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ECONOMIC BAR CHART */}
            {chartData.economic.length > 0 && (
              <div className="bg-[#060f1e] border border-slate-800/50 rounded-2xl p-5 flex flex-col shadow-xl hover:border-red-900/30 transition-colors duration-300">
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.5)]" />
                  <p className="text-[10px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold">
                    Economic Risk
                  </p>
                </div>
                <p className="text-[8px] font-mono text-slate-600 mb-4 ml-4">Baseline GDP/productivity loss projection</p>
                <div className="h-[180px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={chartData.economic.map((d: any) => ({ ...d, adapt: d.adapt ?? null }))}
                      margin={{ top: 10, right: 16, bottom: 5, left: -8 }}
                    >
                      <defs>
                        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#ef4444" stopOpacity={0.9} />
                          <stop offset="100%" stopColor="#7f1d1d" stopOpacity={0.6} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid {...gridProps} />
                      <XAxis dataKey="year" {...axisProps} />
                      <YAxis {...axisProps} />
                      <RechartsTooltip
                        contentStyle={{ background: '#0d1f3c', border: '1px solid #1e3a5f', borderRadius: '12px', fontSize: '11px', fontFamily: 'ui-monospace, monospace', padding: '10px 14px' }}
                        formatter={(v: any, name: any) => [`${Number(v).toFixed(0)}`, name]}
                      />
                      <Bar dataKey="noAction" name="Baseline (No Action)" fill="url(#barGrad)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* MITIGATION DONUT */}
            {mitigatedData && <MitigationDonut reductionPct={overallReduction} />}
          </div>
        </section>
      )}

      {/* ── AI ANALYSIS AREA ── */}
      {aiAnalysis && (
        <section className="px-4 md:px-8 lg:px-10 py-10 w-full">

          {/* Section header */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7">
            <div className="flex items-center gap-3">
              <div className="relative flex items-center justify-center w-6 h-6">
                <div className="absolute w-6 h-6 rounded-full bg-amber-400/10 animate-ping" style={{ animationDuration: '2.5s' }} />
                <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.7)]" />
              </div>
              <div>
                <p className="text-[11px] font-mono text-slate-200 uppercase tracking-[0.25em] font-bold">
                  Strategic Insights
                </p>
                {selectedCity && (
                  <p className="text-[9px] font-mono text-slate-500 mt-0.5">
                    Climate risk profile · {selectedCity.name}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 py-1.5 px-3 bg-slate-900/60 border border-slate-800/60 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/60" />
              <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">
                CMIP6 Ensemble · Baseline risk
              </p>
            </div>
          </div>

          {/* AI Cards grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3 mb-8">
            <AiCard
              text={aiAnalysis.mortality} title="Mortality Risk" severity="CRITICAL"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                  <path d="M12 8v4m0 4h.01" />
                </svg>
              }
            />
            <AiCard
              text={aiAnalysis.economic} title="Economic Impact" severity="HIGH"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" />
                </svg>
              }
            />
            <AiCard
              text={aiAnalysis.infrastructure} title="Infrastructure" severity="HIGH"
              icon={
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                  <polyline points="9 22 9 12 15 12 15 22" />
                </svg>
              }
            />

            {/* Mitigation Potential */}
            <div className="relative bg-[#060f1e] border border-emerald-900/30 rounded-2xl p-4 h-full flex flex-col gap-3 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent" />
              <div className="flex items-start gap-2.5 pb-3 border-b border-slate-800/50">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5" strokeLinecap="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.5)]" />
                    <p className="text-[8px] font-mono text-emerald-400 uppercase tracking-[0.15em] font-bold">STRONG</p>
                  </div>
                  <p className="text-[10px] font-mono text-slate-200 uppercase tracking-[0.15em] font-bold leading-tight">Mitigation Potential</p>
                </div>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed font-sans flex-grow">
                {mitigatedData && mitigatedData.savedDeaths !== '0'
                  ? `Integrated mitigation could prevent ~${mitigatedData.savedDeaths} deaths and save ${mitigatedData.savedLoss ?? 'significant'} in economic losses.`
                  : aiAnalysis.mitigation
                  ? aiAnalysis.mitigation.replace(/\*\*.*?\*\*:?/g, '').replace(/^:\s*/, '').trim()
                  : 'Adjust sliders to compute mitigation impact.'}
              </p>
            </div>

            {/* Data Confidence */}
            <div className="relative bg-[#060f1e] border border-indigo-900/30 rounded-2xl p-4 h-full flex flex-col gap-3 overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent" />
              <div className="flex items-start gap-2.5 pb-3 border-b border-slate-800/50">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
                </svg>
                <div>
                  <div className="flex items-center gap-1.5 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_6px_rgba(99,102,241,0.5)]" />
                    <p className="text-[8px] font-mono text-indigo-400 uppercase tracking-[0.15em] font-bold">HIGH</p>
                  </div>
                  <p className="text-[10px] font-mono text-slate-200 uppercase tracking-[0.15em] font-bold leading-tight">Data Confidence</p>
                </div>
              </div>
              <p className="text-slate-400 text-[11px] leading-relaxed font-sans flex-grow">
                High confidence in temperature & heat stress projections (CMIP6 Ensemble).
              </p>
            </div>
          </div>

          {/* ── BASELINE vs MITIGATION TABLE ── */}
          {mitigatedData && (
            <div className="relative bg-[#060f1e] border border-slate-800/40 rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 border-b border-slate-800/40 bg-slate-900/20">
                <div className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_6px_rgba(6,182,212,0.5)]" />
                <p className="text-[10px] font-mono text-slate-200 uppercase tracking-[0.2em] font-bold">
                  Baseline vs Mitigation Impact
                </p>
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_6px_rgba(52,211,153,0.6)]" />
                  <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest">Live Math</span>
                </div>
              </div>

              {/* Metrics grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-slate-800/30 md:divide-y-0">
                {[
                  {
                    label: 'Attributable Deaths',
                    baseline: renderDeaths,
                    mitigated: mitigatedData.deaths || renderDeaths,
                    saved: `${mitigatedData.savedDeaths || '0'} lives`,
                    baseColor: 'text-red-400',
                    accentColor: 'text-red-400',
                    icon: '☠',
                  },
                  {
                    label: 'Economic Loss',
                    baseline: renderLoss,
                    mitigated: mitigatedData.loss || renderLoss,
                    saved: mitigatedData.savedLoss || '0',
                    baseColor: 'text-amber-400',
                    accentColor: 'text-amber-400',
                    icon: '⚡',
                  },
                  {
                    label: 'Peak Temperature',
                    baseline: `${renderTemp}°C`,
                    mitigated: `${mitigatedData.temp || renderTemp}°C`,
                    saved: `${mitigatedData.tempDelta || '0.0'}°C`,
                    baseColor: 'text-orange-400',
                    accentColor: 'text-orange-400',
                    icon: '🌡',
                  },
                  {
                    label: 'Heatwave Days',
                    baseline: `${renderHeatwave}d`,
                    mitigated: `${mitigatedData.heatwave || renderHeatwave}d`,
                    saved: `${mitigatedData.hwDelta || '0'}d`,
                    baseColor: 'text-yellow-400',
                    accentColor: 'text-yellow-400',
                    icon: '☀',
                  },
                ].map((item, i) => (
                  <div key={item.label} className="flex flex-col p-5 gap-4 relative group">
                    {/* Hover highlight */}
                    <div className="absolute inset-0 bg-white/[0.01] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                    {/* Label */}
                    <div className="flex items-center gap-2">
                      <span className="text-base opacity-60">{item.icon}</span>
                      <p className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.15em] font-bold leading-tight">
                        {item.label}
                      </p>
                    </div>

                    {/* Baseline row */}
                    <div className="space-y-1">
                      <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">Without mitigation</p>
                      <p className={`text-[20px] md:text-[22px] font-mono font-bold tabular-nums leading-none ${item.baseColor}`}>
                        {item.baseline}
                      </p>
                    </div>

                    {/* Divider with arrow */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-slate-800" />
                      <span className="text-[8px] text-emerald-500/60">↓</span>
                      <div className="flex-1 h-px bg-slate-800" />
                    </div>

                    {/* Mitigated row */}
                    <div className="space-y-1">
                      <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest">With mitigation</p>
                      <p className="text-[20px] md:text-[22px] font-mono font-bold tabular-nums leading-none text-slate-300">
                        {item.mitigated}
                      </p>
                    </div>

                    {/* Saved pill */}
                    <div className="flex items-center justify-between bg-emerald-950/25 border border-emerald-900/25 rounded-xl px-3 py-2 mt-auto">
                      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Saved</span>
                      <span className="text-[11px] font-mono text-emerald-400 font-bold tracking-tight">
                        ↓ {item.saved}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
