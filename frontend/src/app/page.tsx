'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const CITIES = [
  { name: 'Delhi', country: 'India', year: 2050, temp: 49.2, deaths: 14200, loss: '$31B', hw: 68 },
  { name: 'Lagos', country: 'Nigeria', year: 2050, temp: 43.7, deaths: 9800, loss: '$18B', hw: 112 },
  { name: 'Jakarta', country: 'Indonesia', year: 2050, temp: 38.9, deaths: 6100, loss: '$22B', hw: 89 },
  { name: 'Phoenix', country: 'USA', year: 2050, temp: 46.1, deaths: 3400, loss: '$14B', hw: 145 },
  { name: 'Karachi', country: 'Pakistan', year: 2050, temp: 51.3, deaths: 18700, loss: '$8B', hw: 134 },
];

const STATS = [
  { value: '8,000+', label: 'Cities Modelled' },
  { value: '4', label: 'Climate Scenarios' },
  { value: '2100', label: 'End-Century Coverage' },
  { value: '±15%', label: 'Mortality CI' },
];

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDesktopWarning, setShowDesktopWarning] = useState(false);
  const [activeCityIdx, setActiveCityIdx] = useState(0);
  const [ticker, setTicker] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prev = {
      htmlOverscroll: html.style.overscrollBehavior,
      bodyOverscroll: body.style.overscrollBehavior,
      bodyTouchAction: body.style.touchAction,
    };
    html.style.overscrollBehavior = 'none';
    body.style.overscrollBehavior = 'none';
    body.style.touchAction = 'pan-y';
    return () => {
      html.style.overscrollBehavior = prev.htmlOverscroll;
      body.style.overscrollBehavior = prev.bodyOverscroll;
      body.style.touchAction = prev.bodyTouchAction;
    };
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setActiveCityIdx(i => (i + 1) % CITIES.length);
      setTicker(t => t + 1);
    }, 3200);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const city = CITIES[activeCityIdx];

  const handleStartSimulation = (e: React.MouseEvent) => {
    e.preventDefault();
    if (session) router.push('/dashboard');
    else setShowAuthModal(true);
  };

  const handleGuestClick = () => {
    setShowAuthModal(false);
    setShowDesktopWarning(true);
  };

  return (
    <div className="flex flex-col items-center w-full min-h-screen relative" style={{ overscrollBehavior: 'none' }}>

      <main className="w-full max-w-7xl px-4 md:px-8 flex flex-col items-center pb-24 gap-20 md:gap-32">

        {/* ── 1. HERO ── */}
        <section className="w-full min-h-[92vh] flex flex-col items-center justify-center text-center relative z-10 pt-24 pb-16 md:pt-32">
          
          {/* Main headline — human, not technical */}
          <h1 className="text-4xl md:text-[72px] font-extrabold tracking-tighter mb-4 md:mb-6 leading-[0.95] max-w-4xl mx-auto">
            <span className="text-white">By {city.year}, </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-red-400 to-rose-500">
              {city.name}
            </span>
            <br />
            <span className="text-white">could lose </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 to-orange-400">
              {city.deaths.toLocaleString()} lives
            </span>
            <br />
            <span className="text-slate-400 font-light text-3xl md:text-5xl">
              to heat every year.
            </span>
          </h1>

          {/* Sub — one sentence, plain English */}
          <p className="text-sm md:text-base text-slate-400 font-light mb-3 max-w-xl mx-auto leading-relaxed">
            OpenPlanet translates climate science into numbers any city planner,
            investor, or researcher can act on.
          </p>
          <p className="text-[11px] font-mono text-slate-600 tracking-widest uppercase mb-10 md:mb-14">
            Estimates · Gasparrini (2017) · CMIP6 · Burke (2018) · ±15% CI
          </p>

          {/* City stats strip */}
          <div className="w-full max-w-2xl grid grid-cols-3 gap-3 mb-10 md:mb-14">
            {[
              { label: 'Peak temperature', value: `${city.temp}°C`, color: 'text-orange-400' },
              { label: 'Annual economic loss', value: city.loss, color: 'text-amber-300' },
              { label: 'Heatwave days / yr', value: `${city.hw}d`, color: 'text-red-400' },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] border border-white/10 rounded-xl p-3 md:p-4 text-center">
                <p className={`text-xl md:text-2xl font-mono font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-1">{s.label}</p>
              </div>
            ))}
          </div>

          {/* City selector dots */}
          <div className="flex gap-2 mb-10">
            {CITIES.map((c, i) => (
              <button
                key={c.name}
                onClick={() => setActiveCityIdx(i)}
                className={`transition-all duration-300 rounded-full font-mono text-[9px] uppercase tracking-widest px-3 py-1 border ${
                  i === activeCityIdx
                    ? 'border-red-400/60 text-red-300 bg-red-500/10'
                    : 'border-white/10 text-slate-600 hover:text-slate-400'
                }`}
                style={{ touchAction: 'manipulation' }}
              >
                {c.name}
              </button>
            ))}
          </div>

          <button
            onClick={handleStartSimulation}
            className="relative px-10 md:px-14 py-4 rounded-full text-xs font-mono text-white tracking-[0.25em] uppercase transition-all overflow-hidden group bg-gradient-to-r from-red-600/80 to-orange-600/80 border border-red-500/40 hover:from-red-500 hover:to-orange-500 hover:scale-105 shadow-[0_0_30px_rgba(239,68,68,0.25)] hover:shadow-[0_0_50px_rgba(239,68,68,0.45)]"
            style={{ touchAction: 'manipulation' }}
          >
            <span className="relative z-10 font-bold">Analyse Your City</span>
          </button>
        </section>

        {/* ── 2. WHAT IT ACTUALLY DOES (plain English) ── */}
        <section className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight mb-6">
              Type any city.<br />
              <span className="text-slate-400 font-light">Get the real numbers.</span>
            </h2>
            <div className="space-y-4 text-sm text-slate-400 font-light leading-relaxed">
              <p>
                Enter a city — Delhi, Phoenix, Lagos, anywhere — and within seconds you see
                projected heatwave days, peak temperatures, estimated deaths, and
                economic losses for 2030 through 2100.
              </p>
              <p>
                You can then pull two cities side by side, adjust tree cover or
                cool roofs to see what intervention saves, or export the full
                calculation to Excel with every formula intact.
              </p>
              <p className="text-[10px] font-mono text-slate-600 leading-loose">
                Data sources: ERA5 reanalysis · CMIP6 ensemble (Open-Meteo) ·
                World Bank GDP & mortality · GeoNames population ·
                Gasparrini (2017) mortality model · Burke (2018) economics model
              </p>
            </div>
          </div>

          {/* Feature list — no fake links, no unbuilt features */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              {
                icon: '🗺️',
                title: 'City Risk Map',
                desc: 'Interactive hex-grid heatmap. Visualise thermal exposure at neighbourhood scale.',
              },
              {
                icon: '📊',
                title: 'Deep Dive Analysis',
                desc: 'Survivability timeline, climate debt, adaptation ROI — all from real CMIP6 data.',
              },
              {
                icon: '⚖️',
                title: 'City vs City Compare',
                desc: 'Side-by-side metrics for any two cities. Same formula, transparent math.',
              },
              {
                icon: '📥',
                title: 'Excel Audit Export',
                desc: '4-sheet model with live formulas. Every number traceable to its source.',
              },
            ].map(f => (
              <div key={f.title} className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl hover:border-cyan-500/30 hover:bg-black/50 transition-all">
                <span className="text-2xl mb-3 block" style={{ fontSize: 22 }}>{f.icon}</span>
                <h3 className="text-white font-semibold text-sm mb-1.5 tracking-wide">{f.title}</h3>
                <p className="text-[11px] text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3. WHO IS THIS FOR ── */}
        <section className="w-full">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-2xl md:text-3xl font-bold text-white tracking-tight">
              Built for people who make decisions about places.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[
              {
                audience: 'City Planners & Policy',
                color: 'border-blue-500/30 bg-blue-500/5',
                accent: 'text-blue-300',
                dot: 'bg-blue-400',
                lines: [
                  'Which neighbourhoods cross 35°C wet-bulb first?',
                  'How many cooling centres do we need by 2040?',
                  'What does +20% tree cover actually buy us?',
                ],
              },
              {
                audience: 'Climate Researchers',
                color: 'border-emerald-500/30 bg-emerald-500/5',
                accent: 'text-emerald-300',
                dot: 'bg-emerald-400',
                lines: [
                  'Full audit trail — every formula, every source.',
                  'Exportable Excel model for peer review.',
                  'Gasparrini (2017) + Burke (2018) + Stull (2011).',
                ],
              },
              {
                audience: 'Investors & Risk Teams',
                color: 'border-amber-500/30 bg-amber-500/5',
                accent: 'text-amber-300',
                dot: 'bg-amber-400',
                lines: [
                  'GDP-at-risk by city and scenario year.',
                  'NPV climate debt 2030–2100.',
                  'SSP2-4.5 and SSP5-8.5 side by side.',
                ],
              },
            ].map(card => (
              <div key={card.audience} className={`border rounded-2xl p-6 md:p-8 ${card.color} flex flex-col gap-5`}>
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${card.dot} shrink-0`} />
                  <h3 className={`text-sm font-bold tracking-widest uppercase ${card.accent}`}>{card.audience}</h3>
                </div>
                <ul className="space-y-3">
                  {card.lines.map(line => (
                    <li key={line} className="flex items-start gap-2.5">
                      <span className={`text-[10px] ${card.accent} mt-0.5 shrink-0`}>→</span>
                      <span className="text-[12px] text-slate-300 leading-relaxed font-mono">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. STATS — honest, caveated ── */}
        <section className="w-full bg-black/40 border border-white/5 rounded-3xl p-8 md:p-14 backdrop-blur-xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-8">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-3xl md:text-4xl font-mono font-bold text-white mb-1">{s.value}</p>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] font-mono text-slate-600 text-center leading-loose max-w-2xl mx-auto">
            All projections are research-grade estimates for analytical purposes only.
            Not investment advice. Not a deterministic forecast.
            Mortality estimates carry ±15% CI · Economic estimates carry ±8% CI.
          </p>
        </section>

        {/* ── 5. METHODOLOGY TRANSPARENCY — builds trust ── */}
        <section className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 leading-tight">
              Every number has a source.<br />
              <span className="text-slate-400 font-light">No black boxes.</span>
            </h2>
            <p className="text-sm text-slate-400 leading-relaxed mb-4">
              When you see "14,200 deaths", you can click into the calculation
              and see exactly which formula produced it, which variables were used,
              and which peer-reviewed paper each constant came from.
            </p>
            <p className="text-sm text-slate-400 leading-relaxed">
              The Excel export contains four sheets: a plain-language README, an editable
              control panel, the full mathematical engine, and a complete bibliography.
              Change any input — the outputs recalculate instantly.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { model: 'Mortality', source: 'Gasparrini et al. (2017)', journal: 'Lancet Planetary Health', detail: 'β = 0.0801 · dose-response · GBD meta-analysis' },
              { model: 'Economics', source: 'Burke et al. (2018)', journal: 'Nature', detail: 'T_optimal = 13°C · GDP penalty function' },
              { model: 'Labor loss', source: 'ILO (2019)', journal: 'Working on a Warmer Planet', detail: '40% workforce · 20% productivity loss / heatwave day' },
              { model: 'Wet-bulb', source: 'Stull (2011)', journal: 'J. Applied Meteorology', detail: 'Capped 35°C — Sherwood & Huber (2010) PNAS' },
              { model: 'Climate data', source: 'Open-Meteo CMIP6', journal: 'ERA5 + MRI/NICAM/MPI ensemble', detail: '2015–2050 live · 2075–2100 IPCC AR6 delta' },
            ].map(m => (
              <div key={m.model} className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex gap-4 items-start">
                <div className="w-2 h-2 rounded-full bg-cyan-500 shrink-0 mt-1.5" />
                <div>
                  <div className="flex items-baseline gap-2 mb-0.5">
                    <span className="text-[11px] font-mono text-slate-300 font-bold uppercase tracking-widest">{m.model}</span>
                    <span className="text-[10px] font-mono text-cyan-400">{m.source}</span>
                    <span className="text-[9px] font-mono text-slate-600 italic">{m.journal}</span>
                  </div>
                  <p className="text-[10px] font-mono text-slate-500">{m.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 6. FINAL CTA ── */}
        <section className="w-full flex flex-col items-center text-center bg-gradient-to-b from-black/50 to-red-950/20 border border-red-500/10 py-16 md:py-24 backdrop-blur-2xl rounded-3xl relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(239,68,68,0.08)_0%,transparent_70%)] pointer-events-none" />
          <h3 className="text-3xl md:text-5xl font-bold text-white mb-4 leading-tight px-4">
            What is the heat risk<br />
            <span className="text-slate-400 font-light">in your city?</span>
          </h3>
          <button
            onClick={handleStartSimulation}
            className="relative px-12 py-4 rounded-full text-xs font-mono text-white tracking-[0.25em] uppercase transition-all group bg-gradient-to-r from-red-600/80 to-orange-600/80 border border-red-500/40 hover:from-red-500 hover:to-orange-500 hover:scale-105 shadow-[0_0_40px_rgba(239,68,68,0.3)] hover:shadow-[0_0_60px_rgba(239,68,68,0.5)]"
            style={{ touchAction: 'manipulation' }}
          >
            <span className="font-bold">Analyse a City →</span>
          </button>
        </section>

      </main>

      {/* ── AUTH MODAL ── */}
      {showAuthModal && (
        <div 
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
          onClick={() => setShowAuthModal(false)}
        >
          <div 
            className="relative w-full max-w-md bg-[#050b14]/95 border border-white/10 rounded-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)] p-8 overflow-hidden animate-in zoom-in-95 duration-300 backdrop-blur-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute -top-20 -left-20 w-48 h-48 bg-red-500/10 blur-[80px] pointer-events-none" />
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-5 right-5 text-slate-500 hover:text-white transition-colors z-20"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <div className="relative z-10">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-[0.3em] mb-1">Access</p>
              <h2 className="text-lg font-bold text-white mb-8">OpenPlanet</h2>
              
              <div className="space-y-3">
                <button
                  onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                  className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-gray-800 font-medium text-sm rounded-xl hover:bg-gray-100 transition-all"
                  style={{ touchAction: 'manipulation' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                  Continue with Google
                </button>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-white/5" />
                  <span className="text-[10px] font-mono text-slate-600 uppercase tracking-widest">or</span>
                  <div className="flex-1 h-px bg-white/5" />
                </div>
                <button
                  onClick={handleGuestClick}
                  className="w-full px-6 py-3.5 bg-transparent border border-white/10 text-slate-400 font-mono text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl hover:border-white/20 hover:text-white transition-all"
                  style={{ touchAction: 'manipulation' }}
                >
                  Continue as Guest →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── DESKTOP WARNING MODAL ── */}
      {showDesktopWarning && (
        <div 
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300"
        >
          <div 
            className="relative w-full max-w-md bg-[#050b14]/95 border border-cyan-500/30 rounded-2xl shadow-[0_0_60px_rgba(34,211,238,0.15)] p-8 overflow-hidden text-center animate-in zoom-in-95 duration-300 backdrop-blur-xl"
          >
            <div className="absolute -top-20 -left-20 w-48 h-48 bg-cyan-500/10 blur-[80px] pointer-events-none" />
            <div className="relative z-10 flex flex-col items-center">
              <div className="mb-5 p-3 bg-cyan-950/30 border border-cyan-500/20 rounded-full text-cyan-400">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line></svg>
              </div>
              <h2 className="text-lg font-bold text-white mb-3">Desktop Recommended</h2>
              <p className="text-xs text-slate-400 mb-8 leading-relaxed">
                OpenPlanet's high-resolution maps and data models are complex. For the full experience, please switch to a desktop or large tablet.
              </p>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full px-6 py-3.5 bg-cyan-900 border border-cyan-500/50 text-white font-mono text-[10px] font-bold uppercase tracking-[0.2em] rounded-xl hover:bg-cyan-800 transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                style={{ touchAction: 'manipulation' }}
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}