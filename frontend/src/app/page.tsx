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
  { value: '8,000+', label: 'Cities Modelled'   },
  { value: '4',      label: 'Climate Scenarios'  },
  { value: '2050',   label: 'Validated Horizon'  },
  { value: '±15%',   label: 'Mortality CI'       },
];

export default function HomePage() {
  const { data: session }         = useSession();
  const router                    = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeCityIdx, setActiveCityIdx] = useState(0);
  const intervalRef               = useRef<NodeJS.Timeout | null>(null);

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
    }, 3400);
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
      <main className="w-full max-w-7xl px-5 md:px-8 flex flex-col items-center pb-24 gap-24 md:gap-36 pt-16">

        {/* ── 1. HERO ── */}
        <section className="h-[calc(100vh-4rem)] w-full flex flex-col justify-between items-center py-6 md:py-10 overflow-hidden relative z-10 text-center">

          {/* Eyebrow */}
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] block" style={{ color: 'var(--muted)' }}>
            ● Live · CMIP6 · ERA5 · Peer-Reviewed
          </span>

          {/* ── HEADLINE — expansive reading-editorial register ── */}
          <div className="w-full max-w-5xl mx-auto text-center px-4 mt-6 md:mt-8">
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium tracking-tight leading-[1.1]"
                style={{ color: '#E4E4E7' }}>
              By {city.year},{' '}
              <span className="gradient-text-copper">{city.name}</span>
              <br />
              could lose up to{' '}
              <span className="gradient-text-copper">{city.loss}</span>
              <br />
              <span className="font-serif font-light"
                    style={{ color: 'var(--muted)', fontSize: 'clamp(1.25rem,2.5vw,1.875rem)', letterSpacing: '-0.01em' }}>
                to extreme heat every year.
              </span>
            </h1>
          </div>

          <p className="font-serif text-body-s mb-0 max-w-xl mx-auto leading-relaxed px-4" style={{ color: 'var(--text-2)' }}>
            OpenPlanet translates climate science into numbers any city planner,
            investor, or researcher can act on.
          </p>

          {/* ── HORIZONTAL INK-LINE LEDGER STRIP ── */}
          <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-0 my-6 py-4 md:py-6"
               style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {[
              {
                label:  'Peak Temperature',
                source: 'TX5d decadal mean · ERA5',
                value:  `${city.temp}°C`,
                glow:   'glow-amber',
                color:  'var(--copper)',
                cls:    'border-b border-r-0 md:border-b-0 md:border-r',
              },
              {
                label:  'Est. Heat Deaths',
                source: 'Gasparrini 2017 · 95% CI ±15%',
                value:  `~${city.deaths.toLocaleString()}`,
                glow:   'glow-red',
                color:  'var(--heat-4)',
                cls:    'border-b border-r-0 md:border-b-0 md:border-r',
              },
              {
                label:  'Heatwave Days / yr',
                source: 'Days above historical P95 · CMIP6',
                value:  `${city.hw}d`,
                glow:   'glow-red',
                color:  'var(--heat-3)',
                cls:    '',
              },
            ].map((s) => (
              <div key={s.label}
                   className={`px-6 md:px-10 py-6 md:py-8 text-center flex flex-col items-center justify-center ${s.cls}`}
                   style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              >
                {/* Big mono value */}
                <p className={`font-mono text-3xl md:text-4xl lg:text-5xl font-medium tracking-tighter tabular-nums ${s.glow}`}
                   style={{ color: s.color }}>
                  {s.value}
                </p>

                {/* Label */}
                <p className="font-sans text-[10px] tracking-[0.14em] uppercase mt-2"
                   style={{ color: 'var(--text-2)' }}>
                  {s.label}
                </p>

                {/* Source descriptor */}
                <p className="font-mono text-[9px] tracking-[0.08em] mt-1"
                   style={{ color: 'var(--muted)' }}>
                  {s.source}
                </p>
              </div>
            ))}
          </div>

          {/* Credibility strip */}
          <p className="font-mono text-prov text-center mb-8 max-w-2xl mx-auto px-4" style={{ color: 'var(--muted)' }}>
            Copernicus C3S ERA5 · CMIP6 · Gasparrini 2017 · Burke 2018 · UNDRR · Climatebase
          </p>

          {/* Primary CTA */}
          <button
            onClick={handleStartSimulation}
            style={{ touchAction: 'manipulation' }}
            className="btn-primary relative bg-white text-black font-sans font-semibold text-xs px-10 py-3.5 uppercase tracking-wider transition-all duration-150 hover:bg-zinc-100 min-h-[48px] overflow-hidden"
          >
            Analyse Your City →
          </button>
        </section>

        {/* ── 2. WHAT IT DOES ── */}
        <section className="w-full grid grid-cols-1 lg:grid-cols-2 gap-10 md:gap-16 items-center">
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--muted)' }}>
              How it works
            </p>
            <h2 className="text-3xl md:text-4xl font-sans font-bold tracking-tight leading-tight mb-6" style={{ color: 'var(--text)' }}>
              Type any city.<br />
              <span className="font-light" style={{ color: 'var(--muted)' }}>Get the real numbers.</span>
            </h2>
            <div className="space-y-4 font-sans leading-relaxed" style={{ color: 'var(--text-2)' }}>
              <p className="text-sm">
                Enter a city — Delhi, Phoenix, Lagos, anywhere — and within seconds you see
                projected heatwave days, peak temperatures, economic losses, and estimated
                mortality for 2030 and 2050.
              </p>
              <p className="text-sm">
                Pull two cities side by side, adjust tree cover or cool roofs to see what
                intervention saves, or export the full calculation to Excel with every formula intact.
              </p>
              <p className="text-[10px] font-mono leading-loose" style={{ color: 'var(--muted)' }}>
                ERA5 reanalysis · CMIP6 ensemble (Open-Meteo) · World Bank GDP & mortality ·
                Gasparrini (2017) · Burke (2018)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { title: 'City Risk Map',        desc: 'Interactive hex-grid heatmap. Visualise thermal exposure at neighbourhood scale.', accent: 'var(--reference)' },
              { title: 'Deep Dive Analysis',   desc: 'Survivability timeline, climate debt, adaptation ROI — all from real CMIP6 data.',  accent: 'var(--heat-2)'  },
              { title: 'City vs City Compare', desc: 'Side-by-side metrics for any two cities. Same formula, transparent math.',          accent: 'var(--copper)'  },
              { title: 'Excel Audit Export',   desc: '4-sheet model with live formulas. Every number traceable to its source.',            accent: 'var(--positive)' },
            ].map(f => (
              <div key={f.title}
                   className="glass relative p-5 hover:bg-white/[0.02] transition-all duration-200 group overflow-hidden"
                   style={{ border: '1px solid var(--hairline)' }}>
                <div className="absolute top-0 left-0 right-0 h-px transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                     style={{ background: `linear-gradient(90deg, transparent, ${f.accent}50, transparent)` }} />
                <h3 className="font-sans font-semibold text-body-ui mb-1.5" style={{ color: 'var(--text)' }}>{f.title}</h3>
                <p className="font-sans text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── 3. AUDIENCE ── */}
        <section className="w-full">
          <div className="text-center mb-12 md:mb-16">
            <p className="text-[9px] font-mono uppercase tracking-[0.3em] mb-3" style={{ color: 'var(--muted)' }}>Who uses OpenPlanet</p>
            <h2 className="text-2xl md:text-3xl font-sans font-bold tracking-tight" style={{ color: 'var(--text)' }}>
              Built for people who make decisions about places.
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              {
                audience: 'City Planners & Policy',
                accent: '#6E8CA8',
                lines: [
                  'Which neighbourhoods cross 35°C wet-bulb first?',
                  'How many cooling centres do we need by 2040?',
                  'What does +20% tree cover actually buy us?',
                ],
              },
              {
                audience: 'Climate Researchers',
                accent: '#5E8C6A',
                lines: [
                  'Full audit trail — every formula, every source.',
                  'Exportable Excel model for peer review.',
                  'Gasparrini (2017) + Burke (2018) + Stull (2011).',
                ],
              },
              {
                audience: 'Investors & Risk Teams',
                accent: '#B08D57',
                lines: [
                  'GDP-at-risk by city and scenario year.',
                  'NPV climate debt 2030–2050.',
                  'SSP2-4.5 and SSP5-8.5 side by side.',
                ],
              },
            ].map(card => (
              <div key={card.audience}
                   className="glass relative p-6 md:p-8 flex flex-col gap-5 hover:bg-white/[0.02] transition-all duration-200 overflow-hidden group"
                   style={{ border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
                <div className="absolute top-0 left-0 right-0 h-px"
                     style={{ background: `linear-gradient(90deg, transparent, ${card.accent}60, transparent)` }} />
                <div className="flex items-center gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: card.accent }} />
                  <h3 className="font-mono text-eye uppercase tracking-[0.14em]" style={{ color: card.accent }}>{card.audience}</h3>
                </div>
                <ul className="space-y-3">
                  {card.lines.map(line => (
                    <li key={line} className="flex items-start gap-2.5">
                      <span className="text-[10px] mt-0.5 shrink-0" style={{ color: card.accent }}>—</span>
                      <span className="text-[12px] leading-relaxed font-sans" style={{ color: 'var(--text-2)' }}>{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </section>

        {/* ── 4. STATS ── */}
        <section className="w-full relative overflow-hidden p-8 md:p-14"
                 style={{ border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
          <div className="absolute top-0 left-0 right-0 h-px"
               style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)' }} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-8">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-3xl md:text-4xl font-mono font-bold mb-1.5 tracking-tight glow-copper"
                   style={{ color: 'var(--copper)' }}>
                  {s.value}
                </p>
                <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          <div className="divider-gradient mb-6" />

          <p className="text-[10px] font-mono text-center leading-loose max-w-2xl mx-auto" style={{ color: 'var(--muted)' }}>
            All projections are research-grade estimates for analytical purposes only.
            Not investment advice. Not a deterministic forecast.
            Mortality estimates carry ±15% CI · Economic estimates carry ±8% CI.
          </p>
        </section>

        {/* ── 5. METHODOLOGY ── */}
        <section className="w-full grid grid-cols-1 lg:grid-cols-2 gap-10 items-start">
          <div>
            <p className="text-[9px] font-mono uppercase tracking-[0.3em] mb-4" style={{ color: 'var(--muted)' }}>
              Transparent science
            </p>
            <h2 className="text-2xl md:text-3xl font-sans font-bold tracking-tight leading-tight mb-6" style={{ color: 'var(--text)' }}>
              Every number has a source.<br />
              <span className="font-light" style={{ color: 'var(--muted)' }}>No black boxes.</span>
            </h2>
            <p className="text-sm leading-relaxed mb-4 font-sans" style={{ color: 'var(--text-2)' }}>
              When you see a "$31 Billion economic loss" estimate, you can click into the calculation
              and see exactly which formula produced it, which variables were used,
              and which peer-reviewed paper each constant came from.
            </p>
            <p className="text-sm leading-relaxed font-sans" style={{ color: 'var(--text-2)' }}>
              The Excel export contains four sheets: a plain-language README, an editable
              control panel, the full mathematical engine, and a complete bibliography.
            </p>
          </div>

          <div className="space-y-2">
            {[
              { model: 'Mortality',     source: 'Gasparrini et al. (2017)', journal: 'Lancet Planetary Health', detail: 'β = 0.0801 · dose-response · GBD meta-analysis',        accent: 'var(--heat-4)' },
              { model: 'Economics',     source: 'Burke et al. (2018)',       journal: 'Nature',                  detail: 'T_optimal = 13°C · GDP penalty function',                 accent: 'var(--heat-2)' },
              { model: 'Labor loss',    source: 'ILO (2019)',                journal: 'Working on a Warmer Planet', detail: '40% workforce · 20% productivity loss / heatwave day',  accent: 'var(--copper)' },
              { model: 'Wet-bulb',      source: 'Stull (2011)',              journal: 'J. Applied Meteorology',   detail: 'Capped 35°C — Sherwood & Huber (2010) PNAS',             accent: 'var(--reference)' },
              { model: 'Climate data',  source: 'Open-Meteo CMIP6',          journal: 'ERA5 + MRI/MPI ensemble',  detail: '2015–2050 validated CMIP6 · horizon capped at 2050',    accent: 'var(--positive)' },
            ].map(m => (
              <div key={m.model}
                   className="glass relative p-4 flex gap-4 items-start hover:bg-white/[0.02] transition-all duration-200 overflow-hidden group"
                   style={{ border: '1px solid var(--hairline)' }}>
                <div className="absolute top-0 left-0 right-0 h-px transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                     style={{ background: `linear-gradient(90deg, transparent, ${m.accent}50, transparent)` }} />
                <div className="w-1 h-1 rounded-full shrink-0 mt-2" style={{ background: m.accent }} />
                <div>
                  <div className="flex items-baseline gap-2 mb-0.5 flex-wrap">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-widest" style={{ color: 'var(--text)' }}>{m.model}</span>
                    <span className="text-[10px] font-mono" style={{ color: m.accent }}>{m.source}</span>
                    <span className="text-[9px] font-mono italic" style={{ color: 'var(--muted)' }}>{m.journal}</span>
                  </div>
                  <p className="text-[10px] font-mono" style={{ color: 'var(--muted)' }}>{m.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── 6. FINAL CTA ── */}
        <section className="w-full relative flex flex-col items-center text-center py-16 md:py-24 px-6 overflow-hidden"
                 style={{ border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
          <div className="absolute top-0 left-0 right-0 h-px"
               style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }} />
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'radial-gradient(ellipse 60% 40% at 50% 0%, rgba(176,141,87,0.04) 0%, transparent 70%)' }} />

          <p className="text-[9px] font-mono uppercase tracking-[0.3em] mb-4 relative z-10" style={{ color: 'var(--muted)' }}>
            Free · No account required
          </p>
          <h3 className="text-3xl md:text-5xl font-sans font-bold mb-4 leading-tight tracking-tight relative z-10" style={{ color: 'var(--text)' }}>
            What is the heat risk<br />
            <span className="font-light" style={{ color: 'var(--muted)' }}>in your city?</span>
          </h3>
          <p className="font-serif text-body-s mb-10 max-w-md mx-auto relative z-10" style={{ color: 'var(--text-2)' }}>
            Research-grade analysis in seconds. Free to explore, no account required.
          </p>
          <button
            onClick={handleStartSimulation}
            style={{ touchAction: 'manipulation' }}
            className="btn-primary relative z-10 bg-white text-black font-sans font-semibold text-xs px-10 py-4 uppercase tracking-wider transition-all duration-150 hover:bg-zinc-50 min-h-[52px]"
          >
            Analyse a City →
          </button>
        </section>

      </main>

      {/* ── AUTH MODAL ── */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/90"
          style={{ backdropFilter: 'blur(12px)' }}
          onClick={() => setShowAuthModal(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden animate-fadeSlideUp"
            style={{ background: 'var(--panel)', border: '1px solid var(--hairline)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Accent line */}
            <div className="h-px w-full"
                 style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }} />

            <div className="p-8">
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center transition-colors duration-150 hover:text-white"
                style={{ color: 'var(--muted)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <p className="text-[9px] font-mono uppercase tracking-[0.3em] mb-1" style={{ color: 'var(--muted)' }}>Access</p>
              <h2 className="text-lg font-sans font-semibold mb-8 tracking-tight" style={{ color: 'var(--text)' }}>OpenPlanet</h2>

              <div className="space-y-3">
                <button
                  onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                  className="w-full flex items-center justify-center gap-3 px-6 py-3.5 bg-white text-gray-800 font-sans font-medium text-sm hover:bg-gray-50 transition-all min-h-[52px]"
                  style={{ touchAction: 'manipulation' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                  </svg>
                  Continue with Google
                </button>

                <div className="flex items-center gap-3">
                  <div className="flex-1 divider-gradient" />
                  <span className="text-[10px] font-mono uppercase tracking-widest" style={{ color: 'var(--muted)' }}>or</span>
                  <div className="flex-1 divider-gradient" />
                </div>

                <button
                  onClick={handleGuestClick}
                  className="w-full px-6 py-3.5 font-mono text-[10px] font-bold uppercase tracking-[0.2em] transition-all duration-150 hover:text-white min-h-[52px] btn-primary"
                  style={{
                    border: '1px solid var(--hairline)',
                    color: 'var(--text-2)',
                    background: 'var(--raised)',
                    touchAction: 'manipulation',
                  }}
                >
                  Continue as Guest →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
