'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const CITIES = [
  { name: 'Delhi',    country: 'India',     year: 2050, temp: 49.2, deaths: 14200, loss: '$31B',  hw: 68  },
  { name: 'Lagos',    country: 'Nigeria',   year: 2050, temp: 43.7, deaths: 9800,  loss: '$18B',  hw: 112 },
  { name: 'Jakarta',  country: 'Indonesia', year: 2050, temp: 38.9, deaths: 6100,  loss: '$22B',  hw: 89  },
  { name: 'Phoenix',  country: 'USA',       year: 2050, temp: 46.1, deaths: 3400,  loss: '$14B',  hw: 145 },
  { name: 'Karachi',  country: 'Pakistan',  year: 2050, temp: 51.3, deaths: 18700, loss: '$8B',   hw: 134 },
];

const STATS = [
  { value: '8,000+', label: 'Cities Modelled'  },
  { value: '4',      label: 'Climate Scenarios' },
  { value: '2050',   label: 'Validated Horizon' },
  { value: '±15%',   label: 'Mortality CI'      },
];

export default function HomePage() {
  const { data: session } = useSession();
  const router            = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeCityIdx, setActiveCityIdx] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    document.documentElement.style.overscrollBehavior = 'none';
    document.body.style.overscrollBehavior = 'none';
    return () => {
      document.documentElement.style.overscrollBehavior = '';
      document.body.style.overscrollBehavior = '';
    };
  }, []);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setActiveCityIdx(i => (i + 1) % CITIES.length);
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
    router.push('/dashboard');
  };

  return (
    <div className="flex flex-col items-center w-full min-h-screen" style={{ overscrollBehavior: 'none' }}>
      <main className="w-full max-w-7xl px-4 md:px-8 flex flex-col items-center pb-24 gap-20 md:gap-32">

        {/* ── 1. HERO ── */}
        <section className="w-full min-h-[92vh] flex flex-col items-center justify-center text-center relative z-10 pt-24 pb-16 md:pt-32">

          <h1 className="font-display text-display mb-4 md:mb-6 max-w-4xl mx-auto leading-[0.95]">
            <span style={{ color: 'var(--text)' }}>By {city.year}, </span>
            <span style={{ color: 'var(--copper)' }}>{city.name}</span>
            <br />
            <span style={{ color: 'var(--text)' }}>could lose up to </span>
            <span style={{ color: 'var(--copper)' }}>{city.loss}</span>
            <br />
            <span className="font-serif" style={{ color: 'var(--muted)', fontSize: 'clamp(1.5rem,3vw,2.25rem)' }}>
              to extreme heat every year.
            </span>
          </h1>

          <p className="font-serif text-body-s mb-3 max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--text-2)' }}>
            OpenPlanet translates climate science into numbers any city planner,
            investor, or researcher can act on.
          </p>

          {/* Stats strip */}
          <div className="w-full max-w-2xl grid grid-cols-3 gap-3 mb-10 md:mb-14">
            {[
              { label: 'Peak temperature',   value: `${city.temp}°C`,                  valueColor: 'var(--copper)' },
              { label: 'Est. Heat Deaths',   value: `~${city.deaths.toLocaleString()}`, valueColor: 'var(--heat-4, #A23A30)' },
              { label: 'Heatwave days / yr', value: `${city.hw}d`,                     valueColor: 'var(--heat-4, #A23A30)' },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.01] p-3 md:p-4 text-center transition-all duration-200" style={{ border: '1px solid var(--hairline)' }}>
                <p className="text-xl md:text-2xl font-mono font-bold tracking-tight tabular-nums" style={{ color: s.valueColor }}>{s.value}</p>
                <p className="text-[9px] font-mono uppercase tracking-widest mt-1" style={{ color: 'var(--muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* City selector — minimal monospace tags */}
          <div className="flex flex-wrap gap-2 mb-10 justify-center">
            {CITIES.map((c, i) => (
              <button
                key={c.name}
                onClick={() => setActiveCityIdx(i)}
                style={{
                  touchAction: 'manipulation',
                  ...(i === activeCityIdx
                    ? { border: '1px solid var(--hairline-strong)', color: 'var(--text)', background: 'var(--raised)' }
                    : { border: '1px solid var(--hairline)', color: 'var(--muted)', background: 'transparent' }),
                }}
                className="font-mono text-[10px] uppercase tracking-[0.14em] px-2.5 py-1 transition-all duration-150"
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Credibility strip */}
          <p className="font-mono text-prov text-center mb-8" style={{ color: 'var(--muted)' }}>
            Copernicus C3S ERA5 · CMIP6 · Gasparrini 2017 · Burke 2018 · UNDRR PreventionWeb · Climatebase
          </p>

          {/* Primary CTA — structural block, no gradient */}
          <button
            onClick={handleStartSimulation}
            style={{ touchAction: 'manipulation' }}
            className="bg-white text-black font-sans font-semibold text-xs px-6 py-2.5 uppercase tracking-wider transition-colors duration-150 hover:bg-zinc-100"
          >
            Analyse Your City
          </button>
        </section>

        {/* ── 2. WHAT IT DOES ── */}
        <section className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12 items-center">
          <div>
            <h2 className="text-3xl md:text-4xl font-sans font-bold text-white tracking-tight leading-tight mb-6">
              Type any city.<br />
              <span className="text-zinc-500 font-light">Get the real numbers.</span>
            </h2>
            <div className="space-y-4 text-sm text-zinc-400 font-light leading-relaxed font-sans">
              <p>
                Enter a city — Delhi, Phoenix, Lagos, anywhere — and within seconds you see
                projected heatwave days, peak temperatures, economic losses, and estimated
                mortality for 2030 and 2050.
              </p>
              <p>
                Pull two cities side by side, adjust tree cover or cool roofs to see what
                intervention saves, or export the full calculation to Excel with every formula intact.
              </p>
              <p className="text-[10px] font-mono text-zinc-600 leading-loose">
                Data sources: ERA5 reanalysis · CMIP6 ensemble (Open-Meteo) ·
                World Bank GDP & mortality · GeoNames population ·
                Gasparrini (2017) mortality model · Burke (2018) economics model
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { title: 'City Risk Map',        desc: 'Interactive hex-grid heatmap. Visualise thermal exposure at neighbourhood scale.' },
              { title: 'Deep Dive Analysis',   desc: 'Survivability timeline, climate debt, adaptation ROI — all from real CMIP6 data.' },
              { title: 'City vs City Compare', desc: 'Side-by-side metrics for any two cities. Same formula, transparent math.' },
              { title: 'Excel Audit Export',   desc: '4-sheet model with live formulas. Every number traceable to its source.' },
            ].map(f => (
              <div key={f.title} className="bg-white/[0.01] p-5 hover:bg-white/[0.02] transition-all duration-200" style={{ border: '1px solid var(--hairline)' }}>
                <h3 className="font-sans font-semibold text-body-ui mb-1.5" style={{ color: 'var(--text)' }}>{f.title}</h3>
                <p className="font-sans text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3. AUDIENCE ── */}
        <section className="w-full">
          <div className="text-center mb-10 md:mb-14">
            <h2 className="text-2xl md:text-3xl font-sans font-bold text-white tracking-tight">
              Built for people who make decisions about places.
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
            {[
              {
                audience: 'City Planners & Policy',
                accentColor: '#0ea5e9',
                dot: 'bg-[#0ea5e9]',
                lines: [
                  'Which neighbourhoods cross 35°C wet-bulb first?',
                  'How many cooling centres do we need by 2040?',
                  'What does +20% tree cover actually buy us?',
                ],
              },
              {
                audience: 'Climate Researchers',
                accentColor: '#10b981',
                dot: 'bg-[#10b981]',
                lines: [
                  'Full audit trail — every formula, every source.',
                  'Exportable Excel model for peer review.',
                  'Gasparrini (2017) + Burke (2018) + Stull (2011).',
                ],
              },
              {
                audience: 'Investors & Risk Teams',
                accentColor: 'var(--copper)',
                dot: 'bg-[#B08D57]',
                lines: [
                  'GDP-at-risk by city and scenario year.',
                  'NPV climate debt 2030–2050.',
                  'SSP2-4.5 and SSP5-8.5 side by side.',
                ],
              },
            ].map(card => (
              <div key={card.audience} className="p-6 md:p-8 flex flex-col gap-5 hover:bg-white/[0.02] transition-all duration-200" style={{ border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
                <div className="flex items-center gap-2">
                  <span className={`w-1.5 h-1.5 rounded-full ${card.dot} shrink-0`} />
                  <h3 className="font-mono text-eye uppercase tracking-[0.14em]" style={{ color: card.accentColor }}>{card.audience}</h3>
                </div>
                <ul className="space-y-3">
                  {card.lines.map(line => (
                    <li key={line} className="flex items-start gap-2.5">
                      <span className="text-[10px] mt-0.5 shrink-0" style={{ color: card.accentColor }}>—</span>
                      <span className="text-[12px] leading-relaxed font-sans" style={{ color: 'var(--text-2)' }}>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. STATS ── */}
        <section className="w-full p-8 md:p-14" style={{ border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-8">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-3xl md:text-4xl font-mono font-bold text-white mb-1 tracking-tight">{s.value}</p>
                <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">{s.label}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] font-mono text-zinc-600 text-center leading-loose max-w-2xl mx-auto">
            All projections are research-grade estimates for analytical purposes only.
            Not investment advice. Not a deterministic forecast.
            Mortality estimates carry ±15% CI · Economic estimates carry ±8% CI.
          </p>
        </section>

        {/* ── 5. METHODOLOGY ── */}
        <section className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div>
            <h2 className="text-2xl md:text-3xl font-sans font-bold text-white mb-6 leading-tight tracking-tight">
              Every number has a source.<br />
              <span className="text-zinc-500 font-light">No black boxes.</span>
            </h2>
            <p className="text-sm text-zinc-400 leading-relaxed mb-4 font-sans">
              When you see a "$31 Billion economic loss" estimate, you can click into the calculation
              and see exactly which formula produced it, which variables were used,
              and which peer-reviewed paper each constant came from.
            </p>
            <p className="text-sm text-zinc-400 leading-relaxed font-sans">
              The Excel export contains four sheets: a plain-language README, an editable
              control panel, the full mathematical engine, and a complete bibliography.
              Change any input — the outputs recalculate instantly.
            </p>
          </div>

          <div className="space-y-2">
            {[
              { model: 'Mortality',    source: 'Gasparrini et al. (2017)', journal: 'Lancet Planetary Health',           detail: 'β = 0.0801 · dose-response · GBD meta-analysis' },
              { model: 'Economics',   source: 'Burke et al. (2018)',       journal: 'Nature',                            detail: 'T_optimal = 13°C · GDP penalty function' },
              { model: 'Labor loss',  source: 'ILO (2019)',                journal: 'Working on a Warmer Planet',        detail: '40% workforce · 20% productivity loss / heatwave day' },
              { model: 'Wet-bulb',    source: 'Stull (2011)',              journal: 'J. Applied Meteorology',            detail: 'Capped 35°C — Sherwood & Huber (2010) PNAS' },
              { model: 'Climate data',source: 'Open-Meteo CMIP6',         journal: 'ERA5 + MRI/MPI ensemble',           detail: '2015–2050 validated CMIP6 · horizon capped at 2050' },
            ].map(m => (
              <div key={m.model} className="bg-white/[0.01] p-4 flex gap-4 items-start hover:bg-white/[0.02] transition-all duration-200" style={{ border: '1px solid var(--hairline)' }}>
                <div className="w-1.5 h-1.5 rounded-full bg-[#0ea5e9] shrink-0 mt-1.5" />
                <div>
                  <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                    <span className="text-[11px] font-mono text-zinc-200 font-bold uppercase tracking-widest">{m.model}</span>
                    <span className="text-[10px] font-mono text-[#0ea5e9]">{m.source}</span>
                    <span className="text-[9px] font-mono text-zinc-600 italic">{m.journal}</span>
                  </div>
                  <p className="text-[10px] font-mono text-zinc-500">{m.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 6. FINAL CTA ── */}
        <section className="w-full flex flex-col items-center text-center py-16 md:py-24" style={{ border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
          <h3 className="text-3xl md:text-5xl font-sans font-bold mb-4 leading-tight tracking-tight px-4" style={{ color: 'var(--text)' }}>
            What is the heat risk<br />
            <span className="font-light" style={{ color: 'var(--muted)' }}>in your city?</span>
          </h3>
          <p className="font-serif text-body-s mb-8 max-w-md mx-auto px-4" style={{ color: 'var(--text-2)' }}>
            Free to use. No account required to explore.
          </p>
          <button
            onClick={handleStartSimulation}
            style={{ touchAction: 'manipulation' }}
            className="bg-white text-black font-sans font-semibold text-xs px-6 py-2.5 uppercase tracking-wider transition-colors duration-150 hover:bg-zinc-100"
          >
            Analyse a City →
          </button>
        </section>

      </main>

      {/* ── AUTH MODAL ── */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
          onClick={() => setShowAuthModal(false)}
        >
          <div
            className="relative w-full max-w-md bg-[#08080a] border border-white/[0.06] p-8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-5 right-5 text-zinc-600 hover:text-white transition-colors z-20"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
            <p className="text-[10px] font-mono text-zinc-600 uppercase tracking-[0.3em] mb-1">Access</p>
            <h2 className="text-lg font-sans font-semibold text-white mb-8 tracking-tight">OpenPlanet</h2>

            <div className="space-y-3">
              <button
                onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-gray-800 font-sans font-medium text-sm hover:bg-gray-100 transition-all"
                style={{ touchAction: 'manipulation' }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                Continue with Google
              </button>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/[0.04]" />
                <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-white/[0.04]" />
              </div>

              <button
                onClick={handleGuestClick}
                className="w-full px-6 py-3.5 bg-transparent border border-white/[0.06] text-zinc-400 font-mono text-[10px] font-bold uppercase tracking-[0.2em] hover:border-white/[0.12] hover:text-white transition-all"
                style={{ touchAction: 'manipulation' }}
              >
                Continue as Guest →
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
