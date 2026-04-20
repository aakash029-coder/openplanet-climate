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
  <div className="flex flex-col items-center justify-center w-full py-24 bg-[#020617]">
    <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6" />
    <span className="font-mono text-[10px] text-indigo-400 tracking-[0.5em] uppercase animate-pulse">
      Computing Spatial Risk Array...
    </span>
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

  const severityColor =
    severity === 'CRITICAL' ? 'text-red-400'
      : severity === 'HIGH' ? 'text-amber-400'
      : severity === 'STRONG' ? 'text-emerald-400'
      : 'text-slate-400';

  if (text.includes('**EFFECT:**') && text.includes('**SOLUTION:**')) {
    const [rawCause] = text.split('**EFFECT:**');
    return (
      <div className="bg-[#06101f] border border-slate-800/70 rounded-2xl p-4 h-full flex flex-col gap-3">
        <div className="flex items-start gap-2 pb-3 border-b border-slate-800/60">
          {icon && <div className="text-slate-400 shrink-0">{icon}</div>}
          <div>
            {severity && (
              <p className={`text-[8px] font-mono uppercase tracking-widest font-bold ${severityColor}`}>
                {severity}
              </p>
            )}
            <p className="text-[10px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold leading-tight">
              {title}
            </p>
          </div>
        </div>
        <p className="text-slate-300 text-[11px] leading-relaxed font-sans flex-grow">
          {clean(rawCause)}
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#06101f] border border-slate-800/70 rounded-2xl p-4 h-full flex flex-col gap-3">
      <div className="flex items-start gap-2 pb-3 border-b border-slate-800/60">
        {icon && <div className="text-slate-400 shrink-0">{icon}</div>}
        <div>
          {severity && (
            <p className={`text-[8px] font-mono uppercase tracking-widest font-bold ${severityColor}`}>
              {severity}
            </p>
          )}
          <p className="text-[10px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold leading-tight">
            {title}
          </p>
        </div>
      </div>
      <p className="text-slate-300 text-[11px] leading-relaxed font-sans flex-grow">{clean(text)}</p>
    </div>
  );
};

const HeatwaveTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const val = payload[0]?.value;
  return (
    <div className="bg-[#06101f] border border-slate-700 rounded-xl px-3 py-2 shadow-xl">
      <p className="text-[9px] font-mono text-slate-500 mb-1">{label}</p>
      <p className="text-[13px] font-mono text-red-400 font-bold">{val}d</p>
    </div>
  );
};

const MitigationDonut = ({ reductionPct }: { reductionPct: number }) => {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const safePct = isNaN(reductionPct) ? 0 : Math.min(Math.max(reductionPct, 0), 100);
  const dash = (safePct / 100) * circ;
  
  return (
    <div className="bg-[#06101f] border border-slate-800/70 rounded-2xl p-4 h-full flex flex-col items-center justify-center shadow-xl">
      <p className="text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-6 font-bold">
        Mitigation Efficiency
      </p>
      <div className="relative w-32 h-32">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r={r} fill="none" stroke="#1e293b" strokeWidth="6" />
          <circle
            cx="40"
            cy="40"
            r={r}
            fill="none"
            stroke="#10b981"
            strokeWidth="6"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[22px] font-mono font-bold text-white tracking-tighter">
            {safePct}%
          </span>
          <span className="text-[7px] font-mono text-slate-500 uppercase tracking-widest text-center leading-tight mt-1">
            Reduction
          </span>
        </div>
      </div>
    </div>
  );
};

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

  // Safe checks for rendering values in table
  const renderDeaths = simData?.deaths || '--';
  const renderLoss = simData?.loss || '--';
  const renderTemp = simData?.temp || '--';
  const renderHeatwave = simData?.heatwave || '--';

  return (
    <>
      {/* ── CHARTS AREA ── */}
      {(chartData?.heatwave?.length > 0 || chartData?.economic?.length > 0) && (
        <div className="px-4 md:px-8 lg:px-16 py-10 w-full max-w-[1440px] mx-auto border-b border-slate-800/30">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* HEATWAVE LINE CHART */}
            {chartData.heatwave.length > 0 && (
              <div className="bg-[#06101f] border border-slate-800/60 rounded-2xl p-5 flex flex-col shadow-xl">
                <div className="mb-4">
                  <p className="text-[11px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold flex items-center gap-2">
                    ● Frequency Trajectory
                  </p>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData.heatwave} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="year" stroke="#475569" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }} />
                      <YAxis stroke="#475569" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }} unit="d" />
                      <RechartsTooltip content={<HeatwaveTooltip />} />
                      <Line type="monotone" dataKey="val" stroke="#3b82f6" strokeWidth={2.5} dot={{ r: 4, fill: '#06101f', strokeWidth: 2, stroke: '#3b82f6' }} activeDot={{ r: 6 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* ECONOMIC BAR CHART */}
            {chartData.economic.length > 0 && (
              <div className="bg-[#06101f] border border-slate-800/60 rounded-2xl p-5 flex flex-col shadow-xl">
                <div className="mb-4">
                  <p className="text-[11px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold flex items-center gap-2">
                    ● Economic Risk Projection
                  </p>
                </div>
                <div className="h-[200px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.economic.map((d: any) => ({ ...d, adapt: d.adapt ?? null }))} margin={{ top: 10, right: 20, bottom: 5, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                      <XAxis dataKey="year" stroke="#475569" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }} />
                      <YAxis stroke="#475569" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }} />
                      <RechartsTooltip contentStyle={{ background: '#06101f', border: '1px solid #1e293b', borderRadius: '10px', fontSize: '11px', fontFamily: 'monospace' }} formatter={(v: any, name: any) => [`${Number(v).toFixed(0)}`, name]} />
                      <Bar dataKey="noAction" name="Baseline (No Action)" fill="#ef4444" radius={[3, 3, 0, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* MITIGATION DONUT */}
            {mitigatedData && (
              <MitigationDonut reductionPct={overallReduction} />
            )}
          </div>
        </div>
      )}

      {/* ── AI ANALYSIS AREA ── */}
      {aiAnalysis && (
        <div className="px-4 md:px-8 lg:px-16 py-10 w-full max-w-[1440px] mx-auto">
          
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6 pb-4 border-b border-slate-800/40">
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <p className="text-[11px] font-mono text-slate-300 uppercase tracking-[0.3em] font-bold">
                › Strategic Insights
                {selectedCity && <span className="text-slate-200 ml-2">· {selectedCity.name}</span>}
              </p>
            </div>
            <p className="text-[8px] font-mono text-slate-700 italic uppercase tracking-widest">
              All values sourced from climate engine · Baseline risk
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-8">
            <AiCard
              text={aiAnalysis.mortality} title="Mortality Risk" severity="CRITICAL"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="1.5"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" /><path d="M12 8v4m0 4h.01" /></svg>}
            />
            <AiCard
              text={aiAnalysis.economic} title="Economic Impact" severity="HIGH"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5"><rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2" /></svg>}
            />
            <AiCard
              text={aiAnalysis.infrastructure} title="Infrastructure Stress" severity="HIGH"
              icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>}
            />
            
            {/* Mitigation Potential Block */}
            <div className="bg-[#06101f] border border-slate-800/70 rounded-2xl p-4 h-full flex flex-col gap-3">
              <div className="flex items-start gap-2 pb-3 border-b border-slate-800/60">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10b981" strokeWidth="1.5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                <div>
                  <p className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest font-bold">STRONG</p>
                  <p className="text-[10px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold leading-tight">Mitigation Potential</p>
                </div>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed font-sans flex-grow">
                {mitigatedData && mitigatedData.savedDeaths !== '0'
                  ? `Integrated mitigation could prevent ~${mitigatedData.savedDeaths} deaths and save ${mitigatedData.savedLoss ?? 'significant'} in economic losses.`
                  : aiAnalysis.mitigation
                  ? aiAnalysis.mitigation.replace(/\*\*.*?\*\*:?/g, '').replace(/^:\s*/, '').trim()
                  : 'Adjust sliders to compute mitigation impact.'}
              </p>
            </div>
            
            {/* Data Confidence Block */}
            <div className="bg-[#06101f] border border-slate-800/70 rounded-2xl p-4 h-full flex flex-col gap-3">
              <div className="flex items-start gap-2 pb-3 border-b border-slate-800/60">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="1.5"><circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" /></svg>
                <div>
                  <p className="text-[8px] font-mono text-indigo-400 uppercase tracking-widest font-bold">HIGH</p>
                  <p className="text-[10px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold leading-tight">Data Confidence</p>
                </div>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed font-sans flex-grow">
                High confidence in temperature & heat stress projections (CMIP6 Ensemble).
              </p>
            </div>
          </div>

          {/* ── BASELINE VS MITIGATION SUMMARY TABLE (SAFE FOR UNDEFINED) ── */}
          {mitigatedData && (
            <div className="bg-[#06101f] border border-slate-800/40 rounded-2xl p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-5">
                <div className="w-2 h-2 rounded-full bg-cyan-500" />
                <p className="text-[10px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold">
                  Baseline vs Mitigation Impact
                </p>
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[8px] font-mono text-emerald-500 uppercase tracking-widest">Live Math</span>
                </div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                {[
                  {
                    label: 'Attributable Deaths',
                    baseline: renderDeaths,
                    mitigated: mitigatedData.deaths || renderDeaths,
                    saved: `${mitigatedData.savedDeaths || '0'} lives`,
                    baseColor: 'text-red-400',
                  },
                  {
                    label: 'Economic Loss',
                    baseline: renderLoss,
                    mitigated: mitigatedData.loss || renderLoss,
                    saved: mitigatedData.savedLoss || '0',
                    baseColor: 'text-amber-400',
                  },
                  {
                    label: 'Peak Temperature',
                    baseline: `${renderTemp}°C`,
                    mitigated: `${mitigatedData.temp || renderTemp}°C`,
                    saved: `${mitigatedData.tempDelta || '0.0'}°C`,
                    baseColor: 'text-orange-400',
                  },
                  {
                    label: 'Heatwave Days',
                    baseline: `${renderHeatwave}d`,
                    mitigated: `${mitigatedData.heatwave || renderHeatwave}d`,
                    saved: `${mitigatedData.hwDelta || '0'}d`,
                    baseColor: 'text-yellow-400',
                  },
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <p className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.12em] leading-tight">
                      {item.label}
                    </p>
                    <div className="flex items-baseline justify-between border-b border-slate-800 pb-1">
                      <span className="text-[9px] font-mono text-slate-500 uppercase">Without</span>
                      <span className={`text-[13px] md:text-[14px] font-mono font-bold tabular-nums ${item.baseColor}`}>
                        {item.baseline}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between pb-1">
                      <span className="text-[9px] font-mono text-slate-500 uppercase">With</span>
                      <span className="text-[13px] md:text-[14px] font-mono font-bold tabular-nums text-slate-300">
                        {item.mitigated}
                      </span>
                    </div>
                    <div className="flex items-center justify-between bg-emerald-950/20 rounded-lg px-2.5 py-1.5 border border-emerald-900/30">
                      <span className="text-[8px] font-mono text-slate-500 uppercase">Saved</span>
                      <span className="text-[11px] font-mono text-emerald-400 font-bold tracking-tight">
                        📉 {item.saved}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};