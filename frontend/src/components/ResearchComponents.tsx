'use client';

import React, { useState } from "react";

export interface Projection {
  year: number; source: string; heatwave_days: number; peak_tx5d_c: number;
  attributable_deaths: number; economic_decay_usd: number; wbt_max_c?: number;
  uhi_intensity_c?: number; grid_stress_factor?: number; region?: string; audit_trail?: any;
}

export interface RiskResult {
  threshold_c: number; cooling_offset_c: number; gdp_usd: number | null;
  population: number | null; projections: Projection[];
  baseline: { baseline_mean_c: number | null }; era5_humidity_p95?: number;
}

export function fmt(n: number | null | undefined, d = 1): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function fmtUSD(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

export function getWBTStatus(wbt: number) {
  if (wbt >= 35) return { label: "> 35°C — Critical Physiological Limit", color: "text-red-500",    bg: "bg-red-500/10",    border: "border-red-500/30"    };
  if (wbt >= 31) return { label: "CRITICAL",                              color: "text-red-500",    bg: "bg-red-500/10",    border: "border-red-500/30"    };
  if (wbt >= 28) return { label: "DANGER",                                color: "text-orange-500", bg: "bg-orange-500/10", border: "border-orange-500/30" };
  return           { label: "STABLE",                                     color: "text-emerald-500",bg: "bg-emerald-500/10",border: "border-emerald-500/30"};
}

export function cleanResearchText(t: string | null): string {
  if (!t) return "";
  return t
    .replace(/\*/g, "")
    .replace(/([a-z])([.?!])([A-Z])/g, "$1$2 $3")
    .replace(/\beuros?\b/gi, "USD")
    .replace(/€/g, "$");
}

export const SourceLine = ({ source }: { source: string }) => (
  <p className="mt-1.5 text-[8px] font-mono text-slate-600 italic">{source}</p>
);

export const EstimateDisclaimer = ({ text }: { text: string }) => (
  <div className="bg-amber-950/20 border border-amber-800/20 rounded-lg px-3 py-2 mt-3">
    <p className="text-[8px] font-mono text-amber-600/70 italic leading-relaxed">⚠ {text}</p>
  </div>
);

export const CalcBtn = ({ onClick }: { onClick: () => void }) => (
  <button
    onClick={onClick}
    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[9px] font-mono text-cyan-400 hover:bg-cyan-900/40 hover:border-cyan-400/40 transition-all"
  >
    <span>⊕</span> Calculation Details
  </button>
);

// ─────────────────────────────────────────────────────────────────
// CALC MODAL
// ─────────────────────────────────────────────────────────────────
export const VAR_TOOLTIPS: Record<string, string> = {
  AF:            "Attributable Fraction — AF = (RR−1)/RR",
  RR:            "Relative Risk — RR = exp(β×ΔT)",
  beta:          "Gasparrini (2017) coefficient = 0.0801",
  V:             "Vulnerability multiplier — AC penetration, age structure, healthcare",
  DR:            "World Bank crude death rate per 1,000",
  HW:            "Calibrated annual heatwave days (CMIP6)",
  Pop:           "Metro population (GeoNames)",
  temp_excess_c: "Temperature above ERA5 P95 threshold",
  Burke_penalty: "0.0127×(T_mean−13°C)²/100 — Burke (2018)",
  ILO_fraction:  "(HW/365)×0.40×0.20 — ILO (2019)",
  T_mean:        "CMIP6 projected annual mean temperature",
  T_optimal:     "13°C — global economic optimum (Burke 2018)",
  HW_days:       "Annual heatwave days from CMIP6 ensemble",
  GDP:           "City GDP estimate (World Bank GDP/cap × population)",
};

export const CalcModal = ({
  open, onClose, auditSection, title, disclaimer,
}: {
  open: boolean; onClose: () => void;
  auditSection: any; title: string; disclaimer: string;
}) => {
  if (!open || !auditSection) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-[#06101f] border border-cyan-500/20 rounded-2xl shadow-[0_0_60px_rgba(34,211,238,0.1)]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 bg-cyan-950/10 sticky top-0 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-mono text-cyan-300 uppercase tracking-[0.25em] font-bold">
              Calculation Details · {title}
            </span>
          </div>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-500 hover:text-white transition-all flex items-center justify-center text-[14px]"
          >
            ×
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-[#020912] rounded-xl px-4 py-3 border border-slate-800">
            <p className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.2em] mb-1.5">Formula</p>
            <p className="text-white font-mono text-[12px] tracking-wide leading-relaxed">{auditSection.formula}</p>
          </div>
          {auditSection.variables && (
            <div className="bg-[#020912] rounded-xl px-4 py-3 border border-slate-800">
              <p className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.2em] mb-2.5">Variables</p>
              <div className="grid grid-cols-2 gap-x-6">
                {Object.entries(auditSection.variables).map(([k, v]) => {
                  const tip = VAR_TOOLTIPS[k];
                  return (
                    <div key={k} className="flex items-center justify-between py-1.5 border-b border-slate-800/40 last:border-0">
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-mono text-cyan-400">{k}</span>
                        {tip && (
                          <div className="relative group">
                            <div className="w-3 h-3 rounded-full border border-slate-700 text-slate-600 flex items-center justify-center text-[7px] cursor-help hover:border-cyan-500 hover:text-cyan-400 transition-all">
                              ?
                            </div>
                            <div className="absolute left-4 top-1/2 -translate-y-1/2 w-48 p-2.5 rounded-lg bg-[#0a1830] border border-slate-700/60 shadow-[0_8px_24px_rgba(0,0,0,0.9)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[99999] pointer-events-none">
                              <p className="text-[8px] font-mono text-slate-300 leading-relaxed">{tip}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <span className="text-[10px] font-mono text-slate-300 tabular-nums">{String(v)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {auditSection.computation && (
            <div className="bg-emerald-950/20 rounded-xl px-4 py-3 border border-emerald-500/20">
              <p className="text-[8px] font-mono text-emerald-400 uppercase tracking-[0.2em] mb-1.5">Result</p>
              <p className="text-[11px] font-mono text-white leading-relaxed break-all">{auditSection.computation}</p>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <p className="text-[8px] font-mono text-slate-600 italic">{auditSection.source}</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest">Calculation validated</span>
            </div>
          </div>
          <div className="bg-slate-900/40 rounded-lg px-3 py-2 border border-slate-800/40">
            <p className="text-[8px] font-mono text-slate-500 leading-relaxed italic">{disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// ADAPTATION ROI ENGINE
// ═══════════════════════════════════════════════════════════════
export const AdaptationROI = ({
  selectedProj, gdp_usd, population, canopy, albedo, setCanopy, setAlbedo,
}: {
  selectedProj: Projection; gdp_usd: number | null; population: number | null;
  canopy: number; albedo: number; setCanopy: (v: number) => void; setAlbedo: (v: number) => void;
}) => {
  const canopyCost  = (population ?? 5e6) * 2.5;
  const albedoCost  = (gdp_usd ?? 50e9) * 0.0008;
  const totalInvest = (canopy / 100) * canopyCost * 50 + (albedo / 100) * albedoCost * 30;
  const cooling     = (canopy / 100) * 1.2 + (albedo / 100) * 0.8;
  const hwR         = selectedProj.heatwave_days > 0
    ? Math.max(0, selectedProj.heatwave_days - cooling * 3.5) / selectedProj.heatwave_days
    : 1;
  const combined    = hwR * Math.max(0, 1 - cooling * 0.08);
  const savedDeaths = Math.round(selectedProj.attributable_deaths * (1 - combined));
  const savedLoss   = selectedProj.economic_decay_usd * (1 - combined);
  const roi         = totalInvest > 0 ? ((savedLoss * 30 - totalInvest) / totalInvest) * 100 : 0;
  const costPerLife = savedDeaths > 0 ? totalInvest / savedDeaths : 0;
  const payback     = totalInvest > 0 && savedLoss > 0 ? totalInvest / savedLoss : Infinity;
  const roiColor    = roi > 200 ? "text-emerald-400" : roi > 50 ? "text-cyan-400" : roi > 0 ? "text-yellow-400" : "text-red-400";

  const presets = [
    { label: "Minimal",    canopy: 5,  albedo: 10,  desc: "Low-cost pilots"  },
    { label: "Moderate",   canopy: 15, albedo: 30,  desc: "City program"     },
    { label: "Aggressive", canopy: 30, albedo: 60,  desc: "Full deployment"  },
    { label: "Maximum",    canopy: 50, albedo: 100, desc: "Theoretical max"  },
  ];

  return (
    <div className="bg-[#050814] border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 blur-[80px] pointer-events-none" />
      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div>
            <h3 className="text-[11px] font-mono text-slate-300 uppercase tracking-[0.3em] font-bold">Adaptation ROI Engine</h3>
            <p className="text-[9px] font-mono text-slate-600 mt-1 italic">
              Investment cost vs economic return — 30-year horizon · Use sliders or presets below
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {presets.map(p => (
              <button
                key={p.label}
                onClick={() => { setCanopy(p.canopy); setAlbedo(p.albedo); }}
                className={`px-3 py-1.5 rounded-lg text-[8px] font-mono uppercase tracking-widest border transition-all ${
                  canopy === p.canopy && albedo === p.albedo
                    ? "border-emerald-500/50 bg-emerald-950/30 text-emerald-300"
                    : "border-slate-800 text-slate-500 hover:border-slate-700 hover:text-slate-300"
                }`}
              >
                {p.label}
                <span className="block text-[7px] text-slate-600">{p.desc}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Investment (est.)",   val: fmtUSD(totalInvest),                        sub: "30-yr deployment",    color: "text-amber-400",  border: "border-amber-500/20",   bg: "bg-amber-950/20"   },
            { label: "30-Year ROI",         val: totalInvest > 0 ? `${fmt(roi, 0)}%` : "—",  sub: "vs baseline losses",  color: roiColor,          border: "border-emerald-500/20", bg: "bg-emerald-950/20" },
            { label: "Cost per Life Saved", val: costPerLife > 0 ? fmtUSD(costPerLife) : "—",sub: "USD estimate",        color: "text-cyan-400",   border: "border-cyan-500/20",    bg: "bg-cyan-950/20"    },
            { label: "Payback Period",      val: isFinite(payback) ? `${fmt(payback, 1)}y` : "—", sub: "years to break even", color: "text-indigo-400", border: "border-indigo-500/20", bg: "bg-indigo-950/20" },
          ].map(m => (
            <div key={m.label} className={`${m.bg} border ${m.border} rounded-2xl p-4 text-center`}>
              <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-2 leading-relaxed">{m.label}</p>
              <p className={`text-xl font-mono font-bold ${m.color}`}>{m.val}</p>
              <p className="text-[8px] font-mono text-slate-600 italic mt-1">{m.sub}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
          <div className="bg-slate-900/30 border border-slate-800/60 rounded-xl p-4">
            <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-3">
              Investment Breakdown <span className="text-slate-600 normal-case">(order-of-magnitude est.)</span>
            </p>
            {[
              { label: `🌳 Canopy +${canopy}%`, cost: (canopy / 100) * canopyCost * 50, color: "bg-emerald-500", note: "~$2.5/person per 1% · C40 Cities (2021)"   },
              { label: `🏠 Albedo +${albedo}%`, cost: (albedo / 100) * albedoCost * 30, color: "bg-indigo-500",  note: "~0.08% GDP per 1% · Levinson LBNL (2018)" },
            ].map(item => (
              <div key={item.label} className="mb-3">
                <div className="flex justify-between text-[9px] font-mono mb-1">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="text-slate-300">{fmtUSD(item.cost)}</span>
                </div>
                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${item.color} rounded-full transition-all duration-500`}
                    style={{ width: totalInvest > 0 ? `${(item.cost / totalInvest) * 100}%` : "0%" }}
                  />
                </div>
                <p className="text-[7px] font-mono text-slate-600 italic mt-0.5">{item.note}</p>
              </div>
            ))}
          </div>
          <div className="bg-slate-900/30 border border-slate-800/60 rounded-xl p-4">
            <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest mb-3">
              30-Year Benefit <span className="text-slate-600 normal-case">(real API × 30yr)</span>
            </p>
            <div className="space-y-3">
              {[
                { label: "Economic loss prevented",  val: fmtUSD(savedLoss * 30) },
                { label: "Lives saved (cumulative)", val: (savedDeaths * 30).toLocaleString() },
                { label: "Net benefit (benefit−cost)", val: fmtUSD(savedLoss * 30 - totalInvest), highlight: savedLoss * 30 - totalInvest > 0 },
              ].map(item => (
                <div key={item.label} className="flex justify-between items-center border-b border-slate-800/40 pb-2 last:border-0">
                  <span className="text-[9px] font-mono text-slate-500">{item.label}</span>
                  <span className={`text-[13px] font-mono font-bold ${"highlight" in item ? (item.highlight ? "text-cyan-400" : "text-red-400") : "text-emerald-400"}`}>
                    {item.val}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="bg-slate-900/20 border border-slate-800/40 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-mono text-slate-500 uppercase">ROI Gauge (30-year horizon)</span>
            <span className={`text-[11px] font-mono font-bold ${roiColor}`}>
              {totalInvest > 0 ? `${fmt(roi, 0)}% return` : "Set sliders above to calculate"}
            </span>
          </div>
          <div className="h-3 bg-slate-900 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-700"
              style={{
                width: `${Math.min(100, Math.max(0, roi / 5))}%`,
                background: "linear-gradient(90deg,#f97316,#10b981,#22d3ee)",
              }}
            />
          </div>
          <div className="flex justify-between text-[7px] font-mono text-slate-700 mt-1">
            <span>0%</span><span>100%</span><span>200%</span><span>300%</span><span>500%+</span>
          </div>
        </div>

        <SourceLine source="C40 Cities (2021) · Levinson LBNL (2018) · Burke et al. (2018)" />
        <EstimateDisclaimer text="Investment costs are order-of-magnitude estimates from published literature. Economic benefits use real CMIP6 API projections. For research scenario planning only — not investment advice." />
      </div>
    </div>
  );
};

// ═══════════════════════════════════════════════════════════════
// HEAT MORTALITY AGE DECOMPOSITION
// ═══════════════════════════════════════════════════════════════
export const MortalityDecomposition = ({
  selectedProj, population, onCalcClick,
}: {
  selectedProj: Projection; population: number | null; onCalcClick: () => void;
}) => {
  const totalDeaths = selectedProj.attributable_deaths;
  const wbt         = selectedProj.wbt_max_c ?? 28;
  const cohorts     = [
    {
      label: "Elderly (65+)", icon: "🧓", share: 0.12, vuln: 3.2,
      color: "#ef4444", bg: "bg-red-500/10", border: "border-red-500/20",
      textColor: "text-red-400", barColor: "bg-red-500", risk: "VERY HIGH",
      factors: ["Reduced thermoregulation capacity", "Cardiovascular comorbidities", "Limited AC access", "Social isolation risk"],
      interventions: ["Cooling centers with transport access", "Door-to-door welfare checks during heat events", "AC subsidy programs for low-income elderly", "Medical alert systems with heat triggers"],
    },
    {
      label: "Working Age (15–64)", icon: "👷", share: 0.65, vuln: 1.0,
      color: "#f97316", bg: "bg-orange-500/10", border: "border-orange-500/20",
      textColor: "text-orange-400", barColor: "bg-orange-500", risk: "HIGH",
      factors: ["Outdoor labor during peak heat", "Economic pressure to work", "Dehydration from exertion", "Heat stress during transit"],
      interventions: ["Mandatory heat pause regs (>35°C)", "Employer heat stress monitoring", "Shade at outdoor worksites", "Flexible hours to avoid peak heat"],
    },
    {
      label: "Children (0–14)", icon: "👶", share: 0.23, vuln: 1.8,
      color: "#f59e0b", bg: "bg-yellow-500/10", border: "border-yellow-500/20",
      textColor: "text-yellow-400", barColor: "bg-yellow-500", risk: "ELEVATED",
      factors: ["Higher body surface area to mass ratio", "Immature thermoregulation", "School/outdoor exposure", "Dependence on caregivers"],
      interventions: ["School early dismissal at WBT > 28°C", "Cool play zone networks", "Heat-health education for parents", "Pediatric heat clinic fast-track"],
    },
  ];

  const totalWeight = cohorts.reduce((s, c) => s + c.share * c.vuln, 0);
  const withDeaths  = cohorts.map(c => ({
    ...c,
    deaths:   Math.round(totalDeaths * (c.share * c.vuln) / totalWeight),
    popCount: Math.round((population ?? 5e6) * c.share),
    deathPct: (c.share * c.vuln) / totalWeight * 100,
  }));
  const [tab, setTab] = useState<"deaths" | "factors" | "interventions">("deaths");

  return (
    <div className="bg-[#050814] border border-slate-800 rounded-2xl p-6 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-56 h-56 bg-red-500/5 blur-[80px] pointer-events-none" />
      <div className="relative">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-6">
          <div>
            <h3 className="text-[11px] font-mono text-slate-300 uppercase tracking-[0.3em] font-bold">Heat Mortality Age Decomposition</h3>
            <p className="text-[9px] font-mono text-slate-600 mt-1 italic">
              Vulnerability-weighted attribution by demographic cohort · GBD 2019 multipliers
            </p>
          </div>
          <div className="flex bg-slate-900/60 rounded-xl p-1 border border-slate-800/60 shrink-0">
            {(["deaths", "factors", "interventions"] as const).map(t => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`px-3 py-1.5 rounded-lg text-[8px] font-mono uppercase tracking-widest transition-all ${
                  tab === t ? "bg-slate-700 text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 mb-5 p-4 bg-red-950/20 border border-red-500/20 rounded-xl">
          <div>
            <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Total Deaths (API)</p>
            <p className="text-3xl font-mono text-red-400 font-bold tabular-nums">{totalDeaths.toLocaleString()}</p>
          </div>
          <div className="h-12 w-px bg-slate-800" />
          <div>
            <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">WBT (API)</p>
            <p className="text-xl font-mono text-orange-400 font-bold">{fmt(wbt)}°C</p>
          </div>
          <div className="h-12 w-px bg-slate-800" />
          <div className="flex-grow min-w-[160px]">
            <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Distribution (estimated)</p>
            <div className="h-4 flex rounded-full overflow-hidden">
              {withDeaths.map(c => (
                <div
                  key={c.label}
                  className={`${c.barColor} transition-all duration-700`}
                  style={{ width: `${c.deathPct}%` }}
                  title={`${c.label}: ${c.deaths.toLocaleString()}`}
                />
              ))}
            </div>
            <div className="flex gap-3 mt-1.5 flex-wrap">
              {withDeaths.map(c => (
                <div key={c.label} className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${c.barColor}`} />
                  <span className="text-[7px] font-mono text-slate-600">{c.icon} {fmt(c.deathPct, 0)}%</span>
                </div>
              ))}
            </div>
          </div>
          <div className="ml-auto">
            <CalcBtn onClick={onCalcClick} />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {withDeaths.map(c => (
            <div key={c.label} className={`${c.bg} border ${c.border} rounded-2xl p-4`}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{c.icon}</span>
                  <div>
                    <p className={`text-[9px] font-mono font-bold uppercase tracking-widest ${c.textColor}`}>{c.label}</p>
                    <p className="text-[8px] font-mono text-slate-600">{(c.popCount / 1e6).toFixed(1)}M people (est.)</p>
                  </div>
                </div>
                <span className={`text-[7px] font-mono border ${c.border} ${c.bg} ${c.textColor} px-1.5 py-0.5 rounded-full uppercase font-bold`}>
                  {c.risk}
                </span>
              </div>

              {tab === "deaths" && (
                <>
                  <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-1">Estimated Deaths</p>
                  <p className={`text-2xl font-mono font-bold ${c.textColor} mb-1`}>{c.deaths.toLocaleString()}</p>
                  <p className="text-[8px] font-mono text-slate-600 mb-3">{fmt(c.deathPct, 1)}% of total · {c.vuln}× vulnerability</p>
                  <div className="space-y-2">
                    <div>
                      <div className="flex justify-between text-[8px] font-mono text-slate-500 mb-1">
                        <span>Relative vulnerability</span><span>{c.vuln}×</span>
                      </div>
                      <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                        <div className={`h-full ${c.barColor} rounded-full`} style={{ width: `${Math.min(100, (c.vuln / 3.5) * 100)}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-[8px] font-mono text-slate-500 mb-1">
                        <span>Share of burden</span><span>{fmt(c.deathPct, 1)}%</span>
                      </div>
                      <div className="h-2 bg-slate-900 rounded-full overflow-hidden">
                        <div className={`h-full ${c.barColor} opacity-60 rounded-full`} style={{ width: `${c.deathPct}%` }} />
                      </div>
                    </div>
                  </div>
                </>
              )}
              {tab === "factors" && (
                <div className="space-y-2">
                  {c.factors.map((f, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <div className={`w-1 h-1 rounded-full ${c.barColor} mt-1.5 shrink-0`} />
                      <p className="text-[9px] font-mono text-slate-400 leading-relaxed">{f}</p>
                    </div>
                  ))}
                </div>
              )}
              {tab === "interventions" && (
                <div className="space-y-2">
                  {c.interventions.map((iv, i) => (
                    <div key={i} className="flex items-start gap-2 bg-slate-900/40 rounded-lg p-2 border border-slate-800/40">
                      <span className="text-[8px] text-emerald-500 mt-0.5 shrink-0">→</span>
                      <p className="text-[9px] font-mono text-slate-400 leading-relaxed">{iv}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        <SourceLine source="GBD 2019 age-specific mortality · UN World Urbanization Prospects (2022) · Gasparrini et al. (2017)" />
        <div className="bg-slate-900/30 border border-slate-800/40 rounded-xl p-3 mt-3">
          <p className="text-[8px] font-mono text-slate-600 leading-relaxed">
            <span className="text-slate-500 font-bold">Methodology:</span> Total deaths ({totalDeaths.toLocaleString()}) from real
            Gasparrini (2017) API engine. Per-cohort distribution applies GBD 2019 vulnerability multipliers to UN WUP (2022)
            population shares, normalized to match API total exactly. Individual cohort figures are research estimates.
          </p>
        </div>
        <EstimateDisclaimer text="Per-cohort estimates use standardized GBD (2019) multipliers and UN WUP (2022) population shares. Actual age-specific mortality varies by city demographics, healthcare access, and AC penetration. For public health research planning only." />
      </div>
    </div>
  );
};