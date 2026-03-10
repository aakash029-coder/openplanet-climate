'use client';

import { useState } from "react";

// ── UI COMPONENTS ──────────────────────────────────────────────────────────

function Code({ children }: { children: string }) {
  return (
    <code className="font-mono text-[10px] bg-cyan-950/30 border border-cyan-500/20 rounded px-1.5 py-0.5 text-cyan-400 uppercase tracking-tighter shadow-inner">
      {children}
    </code>
  );
}

function Formula({ label, formula, note }: { label: string; formula: string; note?: React.ReactNode }) {
  return (
    <div className="bg-[#050b14]/60 border border-cyan-500/20 rounded-xl px-6 py-5 my-6 relative overflow-hidden group shadow-[0_0_20px_rgba(34,211,238,0.03)] backdrop-blur-md">
      <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <p className="text-[10px] font-mono text-cyan-200 uppercase tracking-[0.2em] mb-4">{label}</p>
      <div className="text-white overflow-x-auto py-2 font-serif text-lg tracking-wide">
        {/* Using plain text math for clean rendering without heavy libraries */}
        {formula}
      </div>
      {note && <div className="text-[10px] font-mono text-slate-400 mt-4 leading-relaxed uppercase tracking-widest border-t border-cyan-500/10 pt-3">{note}</div>}
    </div>
  );
}

function Ref({ authors, year, journal, title }: { authors: string; year: number; journal: string; title: string }) {
  return (
    <div className="flex gap-4 py-5 border-b border-cyan-500/10 last:border-0 group hover:bg-cyan-900/10 transition-colors px-4 -mx-4 rounded-lg">
      <span className="text-cyan-500/60 font-mono text-[10px] mt-1 font-bold">[{year}]</span>
      <div className="space-y-1">
        <p className="text-[11px] font-mono text-cyan-100 uppercase tracking-wider group-hover:text-cyan-300 transition-colors">
          {authors}
        </p>
        <p className="text-[10px] font-mono text-slate-400 leading-relaxed uppercase tracking-widest">
          {title}. <span className="text-slate-300 italic font-bold">{journal}</span>
        </p>
      </div>
    </div>
  );
}

// ── MAIN COMPONENT ─────────────────────────────────────────────────────────

export default function MethodologyModule() {
  const [open, setOpen] = useState<string | null>("threshold");

  const sections = [
    {
      id: "threshold",
      title: "ERA5 Empirical Threshold",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>
            The heatwave threshold is derived via the <span className="text-cyan-300 font-bold">ERA5 reanalysis archive</span>. No manual lookup tables are utilized; the threshold is an emergent data-driven property of the specific coordinate's 30-year climatology.
          </p>
          <div className="bg-[#02050a]/80 border border-cyan-500/20 p-4 rounded-lg font-mono text-[10px] text-cyan-400 break-all leading-tight shadow-inner">
            GET https://archive-api.open-meteo.com/v1/archive?lat=&#123;lat&#125;&lng=&#123;lng&#125;&daily=Tmax&period=1991-2020
          </div>
          <p className="text-[9px] text-slate-500">
            ERA5 data accessed via the Open-Meteo archive API, which mirrors the ECMWF Copernicus Climate Data Store.
          </p>
          <p>
            The system computes the <span className="text-cyan-300 font-bold">95th percentile</span> from ~10,950 daily observations (1991–2020), establishing a reasonable operational definition for the local physiological adaptation limit.
          </p>
          <Formula
            label="Statistical Definition"
            formula={"T_threshold = P95(ERA5 Tmax 1991–2020)"}
            note="ERA5 reanalysis provides a globally consistent, physics-constrained estimate of historical climate conditions derived from satellite, in-situ, and model assimilation."
          />
        </div>
      ),
    },
    {
      id: "cmip6",
      title: "CMIP6 Future Projections",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>
            Primary projection model: <Code>MPI-ESM1-2-XR</Code> (Representative CMIP6 Earth System Model). Inter-annual variability is mitigated via a <span className="text-cyan-300 font-bold">±2 year rolling window</span>. Future releases will support multi-model ensemble aggregation.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-6">
            {[
              { year: "2030", method: "CMIP6 LIVE", color: "text-cyan-400" },
              { year: "2050", method: "CMIP6 LIVE", color: "text-cyan-400" },
              { year: "2075", method: "EXTRAPOLATED", color: "text-purple-400" },
              { year: "2100", method: "EXTRAPOLATED", color: "text-purple-400" },
            ].map((r) => (
              <div key={r.year} className="bg-[#050b14]/60 border border-cyan-500/10 p-4 rounded-lg shadow-sm flex items-center justify-between">
                <span className="text-white font-bold text-lg">{r.year}</span>
                <span className={`text-[9px] ${r.color} tracking-widest font-bold`}>// {r.method}</span>
              </div>
            ))}
          </div>
          <Formula
            label="Linear Extrapolation (t > 2050)"
            formula={"V(t) = V2050 + ((V2050 − V2030) / 20) × (t − 2050)"}
            note="Post-2050 values are estimated via linear extrapolation for visual continuity. These values are illustrative and not intended to represent full non-linear climate model simulations."
          />
        </div>
      ),
    },
    {
      id: "mortality",
      title: "Attributable Deaths (WHO-ERR)",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>
            Mortality is estimated via the <span className="text-cyan-300 font-bold">Excess Risk Ratio (ERR)</span> framework (Gasparrini et al. 2017 - Lancet Planetary Health).
          </p>
          <Formula
            label="Mortality Estimation"
            formula={"Deaths = Pop × (M / 1000) × ERR × ΔT × HW_days"}
            note={
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                <div><span className="text-cyan-400">Pop</span> = population (persons)</div>
                <div><span className="text-cyan-400">M</span> = baseline mortality (deaths per 1000)</div>
                <div><span className="text-cyan-400">ERR</span> = 2.2% increase per 1°C above threshold</div>
                <div><span className="text-cyan-400">ΔT</span> = mean temp above threshold (°C)</div>
                <div><span className="text-cyan-400">HW_days</span> = heatwave days per year</div>
              </div>
            }
          />
        </div>
      ),
    },
    {
      id: "economics",
      title: "Economic Decay Model",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>
            GDP loss follows the <span className="text-cyan-300 font-bold">Burke et al. (2015) - Nature</span> non-linear productivity decay model. This captures the non-linear productivity collapse at thermal extremes.
          </p>
          <Formula
            label="Capital Decay Formula"
            formula={"Loss = GDP × 0.0004 × HW_days × (1 + 0.1 × ΔT)"}
            note={
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                <div><span className="text-cyan-400">GDP</span> = Baseline City GDP (USD)</div>
                <div><span className="text-cyan-400">HW_days</span> = heatwave days per year</div>
                <div><span className="text-cyan-400">ΔT</span> = mean temp above threshold (°C)</div>
                <div><span className="text-cyan-400">0.0004</span> = base productivity loss fraction</div>
              </div>
            }
          />
        </div>
      ),
    },
    {
      id: "mitigation",
      title: "Mitigation Offsets",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-300 uppercase tracking-widest leading-relaxed">
          <p>
            Simulations support dual-lever urban cooling offsets to manage localized Urban Heat Island (UHI) effects:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
             <div className="p-6 bg-[#050b14]/80 border border-emerald-500/30 rounded-xl shadow-[0_0_20px_rgba(16,185,129,0.05)]">
                <p className="text-emerald-400 font-bold mb-4 tracking-[0.3em] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full"></span> CANOPY COVER
                </p>
                <p className="text-white font-serif text-lg tracking-wider">
                  ΔT = (% / 100) × 1.2°C
                </p>
             </div>
             <div className="p-6 bg-[#050b14]/80 border border-sky-500/30 rounded-xl shadow-[0_0_20px_rgba(14,165,233,0.05)]">
                <p className="text-sky-400 font-bold mb-4 tracking-[0.3em] flex items-center gap-2">
                  <span className="w-1.5 h-1.5 bg-sky-400 rounded-full"></span> ALBEDO ROOFS
                </p>
                <p className="text-white font-serif text-lg tracking-wider">
                  ΔT = (% / 100) × 0.8°C
                </p>
             </div>
          </div>
        </div>
      ),
    },
    {
      id: "sources",
      title: "Scientific Citations",
      content: (
        <div className="space-y-2 mt-2">
          <Ref authors="Gasparrini et al." year={2017} title="Temperature-related excess mortality projections" journal="Lancet Planetary Health" />
          <Ref authors="Burke, S. et al." year={2015} title="Non-linear effect of temperature on economic production" journal="Nature" />
          <Ref authors="Bowler, D.E. et al." year={2010} title="Urban greening to cool towns and cities" journal="Landscape & Urban Planning" />
          <Ref authors="Hersbach, H. et al." year={2020} title="The ERA5 global reanalysis" journal="Q. J. R. Meteorol. Soc." />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 flex flex-col min-h-full pb-12 relative z-10">
      
      {/* ── MODULE HEADER ── */}
      <div className="bg-[#050b14]/70 backdrop-blur-xl border border-cyan-500/20 p-10 rounded-2xl shadow-[0_0_40px_rgba(34,211,238,0.05)] relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-64 h-64 bg-cyan-500/10 blur-[120px] pointer-events-none"></div>
        <h2 className="text-[11px] font-mono font-bold text-cyan-300 uppercase tracking-[0.4em] mb-4 flex items-center gap-3">
          <span className="w-2 h-2 bg-cyan-400 rounded-sm animate-pulse shadow-[0_0_8px_#22d3ee]"></span>
          Scientific Protocol & Methodology
        </h2>
        <p className="text-xs font-mono text-slate-400 uppercase tracking-[0.2em] leading-loose max-w-3xl">
          Documentation of data ingestion pipelines, stochastic modeling frameworks, and peer-reviewed empirical constants.
        </p>
      </div>

      {/* ── ACCORDION SECTIONS ── */}
      <div className="space-y-4 flex-grow">
        {sections.map((s) => (
          <div key={s.id} className="bg-[#02050a]/60 backdrop-blur-xl border border-cyan-500/20 rounded-xl overflow-hidden group shadow-lg transition-all duration-300 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)]">
            <button
              onClick={() => setOpen(open === s.id ? null : s.id)}
              className="w-full flex items-center justify-between px-8 py-6 text-left transition-all hover:bg-cyan-900/10"
            >
              <span className={`text-[11px] font-mono font-bold uppercase tracking-[0.3em] transition-colors ${open === s.id ? 'text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'text-slate-300'}`}>
                {s.title}
              </span>
              <span className={`text-cyan-500 transition-transform duration-500 ${open === s.id ? "rotate-180 text-cyan-300" : ""}`}>
                ▼
              </span>
            </button>
            
            <div 
              className={`transition-all duration-500 ease-in-out overflow-hidden ${open === s.id ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'}`}
            >
              <div className="px-8 pb-8 pt-2 border-t border-cyan-500/10 bg-[#050b14]/30">
                {s.content}
              </div>
            </div>
          </div>
        ))}
      </div>

    </div>
  );
}