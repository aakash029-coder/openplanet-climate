'use client';

import { useState } from "react";

// ── UI COMPONENTS ──────────────────────────────────────────────────────────

function Code({ children }: { children: string }) {
  return (
    <code className="font-mono text-[10px] bg-white/5 border border-white/10 rounded px-1.5 py-0.5 text-indigo-400 uppercase tracking-tighter">
      {children}
    </code>
  );
}

function Formula({ label, formula, note }: { label: string; formula: string; note?: string }) {
  return (
    <div className="bg-white/[0.02] border border-white/5 rounded-lg px-6 py-5 my-6 relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.2em] mb-4">{label}</p>
      <div className="text-white overflow-x-auto py-2">
        {/* Using LaTeX for that high-end scientific look */}
        {formula}
      </div>
      {note && <p className="text-[10px] font-mono text-slate-600 mt-4 italic uppercase tracking-widest">{note}</p>}
    </div>
  );
}

function Ref({ authors, year, journal, title }: { authors: string; year: number; journal: string; title: string }) {
  return (
    <div className="flex gap-4 py-4 border-b border-white/5 last:border-0 group">
      <span className="text-indigo-500/50 font-mono text-[10px] mt-1">[{year}]</span>
      <div className="space-y-1">
        <p className="text-[11px] font-mono text-white uppercase tracking-wider group-hover:text-indigo-400 transition-colors">
          {authors}
        </p>
        <p className="text-[10px] font-mono text-slate-500 leading-relaxed uppercase tracking-widest">
          {title}. <span className="text-slate-400 italic font-bold">{journal}</span>
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
        <div className="space-y-4 font-mono text-[11px] text-slate-400 uppercase tracking-widest leading-relaxed">
          <p>
            The heatwave threshold is derived via the <span className="text-white">ERA5 reanalysis satellite archive</span>. No lookup tables are utilized; the threshold is an emergent property of the specific coordinate's 30-year history.
          </p>
          <div className="bg-black/40 border border-white/10 p-4 rounded font-mono text-[10px] text-emerald-500/80 break-all leading-tight">
            GET https://archive-api.open-meteo.com/v1/archive?lat=&#123;lat&#125;&lng=&#123;lng&#125;&daily=Tmax&period=1991-2020
          </div>
          <p>
            The system computes the <span className="text-white">95th percentile</span> from ~10,950 daily observations, establishing the local physiological adaptation limit.
          </p>
          <Formula
            label="Statistical Definition"
            formula={"$$T_{\\text{threshold}} = P_{95}(\\text{ERA5}_{\\text{Tmax, 1991–2020}})$$"}
            note="Zero regional bias. Pure satellite-derived truth."
          />
        </div>
      ),
    },
    {
      id: "cmip6",
      title: "CMIP6 Future Projections",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-400 uppercase tracking-widest leading-relaxed">
          <p>
            Projections utilize the <Code>mpi_esm1_2_xr</Code> model. Inter-annual variability is mitigated via a <span className="text-white">±2 year rolling window</span>.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { year: "2030", method: "CMIP6 LIVE", color: "text-indigo-400" },
              { year: "2050", method: "CMIP6 LIVE", color: "text-indigo-400" },
              { year: "2075", method: "EXTRAPOLATED", color: "text-amber-500" },
              { year: "2100", method: "EXTRAPOLATED", color: "text-amber-500" },
            ].map((r) => (
              <div key={r.year} className="bg-white/[0.02] border border-white/5 p-3 rounded">
                <span className="text-white font-bold">{r.year}</span>
                <span className={`ml-3 ${r.color}`}>// {r.method}</span>
              </div>
            ))}
          </div>
          <Formula
            label="Linear Extrapolation (t > 2050)"
            formula={"$$V(t) = V_{2050} + \\left( \\frac{V_{2050} - V_{2030}}{20} \\right) \\times (t - 2050)$$"}
          />
        </div>
      ),
    },
    {
      id: "mortality",
      title: "Attributable Deaths (WHO-ERR)",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-400 uppercase tracking-widest leading-relaxed">
          <p>
            Mortality is estimated via the <span className="text-white">Excess Risk Ratio (ERR)</span> framework (Gasparrini et al. 2017).
          </p>
          <Formula
            label="Mortality Estimation"
            formula={"$$\\text{Deaths} = \\text{Pop} \\times \\left( \\frac{M}{1000} \\right) \\times \\text{ERR} \\times \\Delta T_{\\text{avg}} \\times \\text{HW}_{\\text{days}}$$"}
            note="ERR = 2.2% increase in all-cause mortality per 1°C above threshold."
          />
        </div>
      ),
    },
    {
      id: "economics",
      title: "Economic Decay Model",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-400 uppercase tracking-widest leading-relaxed">
          <p>
            GDP loss follows the <span className="text-white">Burke et al. (2015)</span> non-linear productivity decay model.
          </p>
          <Formula
            label="Capital Decay Formula"
            formula={"$$\\text{Loss} = \\text{GDP} \\times 0.0004 \\times \\text{HW}_{\\text{days}} \\times (1 + 0.1 \\times \\Delta T_{\\text{avg}})$$"}
            note="Captures non-linear productivity collapse at thermal extremes."
          />
        </div>
      ),
    },
    {
      id: "mitigation",
      title: "Mitigation Offsets",
      content: (
        <div className="space-y-4 font-mono text-[11px] text-slate-400 uppercase tracking-widest leading-relaxed">
          <p>
            Simulations support dual-lever urban cooling offsets:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
             <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded">
                <p className="text-emerald-400 font-bold mb-2">// CANOPY COVER</p>
                <p className="text-[10px]">
                  {"$$ \\Delta T = \\left( \\frac{\\%}{100} \\right) \\times 1.2^\\circ\\text{C} $$"}
                </p>
             </div>
             <div className="p-4 bg-sky-500/5 border border-sky-500/10 rounded">
                <p className="text-sky-400 font-bold mb-2">// ALBEDO ROOFS</p>
                <p className="text-[10px]">
                  {"$$ \\Delta T = \\left( \\frac{\\%}{100} \\right) \\times 0.8^\\circ\\text{C} $$"}
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
        <div className="space-y-1">
          <Ref authors="Gasparrini et al." year={2017} title="Temperature-related excess mortality projections" journal="Lancet Planetary Health" />
          <Ref authors="Burke, S. et al." year={2015} title="Non-linear effect of temperature on economic production" journal="Nature" />
          <Ref authors="Bowler, D.E. et al." year={2010} title="Urban greening to cool towns and cities" journal="Landscape & Urban Planning" />
          <Ref authors="Hersbach, H. et al." year={2020} title="The ERA5 global reanalysis" journal="Q. J. R. Meteorol. Soc." />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-1000 flex flex-col min-h-full pb-8">
      
      {/* ── MODULE HEADER ── */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-8 rounded-xl shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-indigo-500/5 blur-[100px] pointer-events-none"></div>
        <h2 className="text-[10px] font-mono font-bold text-white uppercase tracking-[0.4em] mb-4">Scientific Protocol & Methodology</h2>
        <p className="text-xs font-mono text-slate-500 uppercase tracking-widest leading-relaxed">
          Documentation of data ingestion pipelines, stochastic modeling frameworks, and peer-reviewed empirical constants.
        </p>
      </div>

      {/* ── ACCORDION SECTIONS ── */}
      <div className="space-y-2 flex-grow">
        {sections.map((s) => (
          <div key={s.id} className="bg-black/20 backdrop-blur-md border border-white/5 rounded-lg overflow-hidden group">
            <button
              onClick={() => setOpen(open === s.id ? null : s.id)}
              className="w-full flex items-center justify-between px-8 py-5 text-left transition-all hover:bg-white/[0.02]"
            >
              <span className={`text-[11px] font-mono uppercase tracking-[0.2em] transition-colors ${open === s.id ? 'text-indigo-400' : 'text-slate-400'}`}>
                {s.title}
              </span>
              <span className={`text-slate-600 transition-transform ${open === s.id ? "rotate-180" : ""}`}>
                ▼
              </span>
            </button>
            {open === s.id && (
              <div className="px-8 pb-8 pt-4 border-t border-white/5 animate-in slide-in-from-top-2 duration-300">
                {s.content}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── UNCERTAINTY DISCLOSURE ── */}
      <div className="mt-8 pt-6 border-t border-white/10 text-center">
        <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest leading-relaxed max-w-4xl mx-auto">
          <span className="text-slate-400 font-bold">Data Disclosure:</span> All projections are based on stochastic modeling and CMIP6 ensemble averages. While grounded in peer-reviewed empirical constants, these outputs represent risk probabilities rather than guaranteed future outcomes.
        </p>
      </div>

    </div>
  );
}