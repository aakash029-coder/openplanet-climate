'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

// Only high-confidence CMIP6+ERA5 metrics — deaths/loss removed from hero.
// Full analysis (with confidence labels) available in the dashboard.
const CITIES = [
  { name: 'Delhi',    country: 'India',     year: 2050, temp: 49.2, wbt: 32.4, hw: 68  },
  { name: 'Lagos',    country: 'Nigeria',   year: 2050, temp: 43.7, wbt: 33.1, hw: 112 },
  { name: 'Jakarta',  country: 'Indonesia', year: 2050, temp: 38.9, wbt: 32.8, hw: 89  },
  { name: 'Phoenix',  country: 'USA',       year: 2050, temp: 46.1, wbt: 27.9, hw: 145 },
  { name: 'Karachi',  country: 'Pakistan',  year: 2050, temp: 51.3, wbt: 31.6, hw: 134 },
];

const STATS = [
  { value: 'Any',    label: 'Global Coordinate'   },
  { value: '4',      label: 'Climate Scenarios'   },
  { value: '2050',   label: 'Validated Horizon'   },
  { value: '5/5',    label: 'Historical Backtests' },
];

export default function LandingMobile() {
  const { data: session } = useSession();
  const router             = useRouter();

  const [activeCityIdx, setActiveCityIdx] = useState(0);
  const [cityVisible,   setCityVisible]   = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setCityVisible(false);
      setTimeout(() => {
        setActiveCityIdx(i => (i + 1) % CITIES.length);
        setCityVisible(true);
      }, 280);
    }, 3400);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const city = CITIES[activeCityIdx];

  const handleCTA = (e: React.MouseEvent) => {
    e.preventDefault();
    if (session) router.push('/dashboard');
    else setShowAuthModal(true);
  };

  const handleGuestClick = () => {
    setShowAuthModal(false);
    router.push('/dashboard');
  };

  return (
    // pt-6 (24px) + main's pt-10 (40px) = 64px total → clears the fixed navbar exactly
    <div className="flex flex-col items-center w-full min-h-screen pt-6"
         style={{ overscrollBehavior: 'none' }}>

      {/* ── 1. HERO ── */}
      <section
        className="w-full flex flex-col justify-center items-center px-4 py-4 gap-6 overflow-hidden relative z-10 text-center"
        style={{ minHeight: 'min(calc(100dvh - 64px), 760px)' }}
      >
        {/* Eyebrow */}
        <div className="flex items-center gap-2">
          <span className="pulse-dot" />
          <span className="font-mono text-[9px] uppercase tracking-[0.2em]"
                style={{ color: 'var(--muted)' }}>
            Live ERA5 + CMIP6 · Any City
          </span>
        </div>

        {/* Headline */}
        <div className="w-full max-w-sm mx-auto text-center">
          <h1 className="font-serif text-[1.9rem] font-medium tracking-tight leading-[1.15]"
              style={{ color: '#E4E4E7' }}>
            How hot will{' '}
            <span
              className="gradient-text-copper transition-opacity duration-300"
              style={{ opacity: cityVisible ? 1 : 0 }}
            >
              {city.name}
            </span>
            <br />
            get by{' '}
            <span className="gradient-text-copper">{city.year}</span>?
            <br />
            <span className="font-serif font-light"
                  style={{ color: 'var(--muted)', fontSize: '1.05rem' }}>
              Real CMIP6 data. Any city.
            </span>
          </h1>
        </div>

        {/* Sub-headline */}
        <p className="font-serif text-[0.875rem] leading-relaxed max-w-xs mx-auto"
           style={{ color: 'var(--text-2)' }}>
          Live ERA5 reanalysis and CMIP6 ensemble projections —
          peer-reviewed physics, full audit trail.
        </p>

        {/* Ledger strip — high-confidence metrics only */}
        <div className="w-full max-w-sm mx-auto border-t border-b border-white/5">
          {[
            {
              label:  'Peak Tx5d',
              source: 'SSP5-8.5 · CMIP6 ensemble · 2050',
              value:  `${city.temp}°C`,
              glow:   'glow-amber',
              color:  'var(--copper)',
            },
            {
              label:  'Wet-bulb Temp',
              source: 'Stull 2011 · ERA5 humidity · 2050',
              value:  `${city.wbt}°C`,
              glow:   'glow-red',
              color:  city.wbt >= 31 ? 'var(--heat-4)' : 'var(--heat-2)',
            },
            {
              label:  'Heatwave Days / yr',
              source: 'Days above ERA5 P95 · CMIP6',
              value:  `${city.hw}d`,
              glow:   'glow-red',
              color:  'var(--heat-3)',
            },
          ].map((s, i) => (
            <div
              key={s.label}
              className="flex items-center justify-between px-3 py-3"
              style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}
            >
              <div className="text-left">
                <div className="flex items-center gap-1.5">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                  <p className="font-sans text-[10px] tracking-[0.12em] uppercase" style={{ color: 'var(--text-2)' }}>{s.label}</p>
                </div>
                <p className="font-mono text-[8px] tracking-[0.06em] mt-0.5 pl-2.5" style={{ color: 'var(--muted)' }}>{s.source}</p>
              </div>
              <p
                className={`font-mono text-[1.5rem] font-medium tracking-tighter tabular-nums ${s.glow} transition-opacity duration-300`}
                style={{ color: s.color, opacity: cityVisible ? 1 : 0 }}
              >
                {s.value}
              </p>
            </div>
          ))}
        </div>

        {/* Data provenance */}
        <p className="font-mono text-[8px] text-center max-w-xs mx-auto"
           style={{ color: 'var(--muted)' }}>
          Copernicus ERA5 · CMIP6 · NASA POWER · Gasparrini 2017 · Burke 2018
        </p>

        {/* CTA + scroll hint */}
        <div className="w-full max-w-xs mx-auto flex flex-col items-center gap-3">
          <button
            onClick={handleCTA}
            style={{ touchAction: 'manipulation' }}
            className="w-full btn-primary bg-white text-black font-sans font-semibold text-xs uppercase tracking-wider transition-all duration-150 hover:bg-zinc-100 min-h-[52px]"
          >
            Analyse Your City →
          </button>
          <div className="flex flex-col items-center gap-0.5 animate-bounce" style={{ opacity: 0.2 }}>
            <span className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>scroll</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
                 style={{ color: 'var(--muted)' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </section>

      {/* ── 2. WHAT IT DOES ── */}
      <section className="w-full px-5 py-12 flex flex-col gap-8 max-w-lg mx-auto">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] mb-3" style={{ color: 'var(--muted)' }}>
            How it works
          </p>
          <h2 className="text-2xl font-sans font-bold tracking-tight leading-tight mb-4" style={{ color: 'var(--text)' }}>
            Type any city.<br />
            <span className="font-light" style={{ color: 'var(--muted)' }}>Get the real numbers.</span>
          </h2>
          <div className="space-y-3 font-sans leading-relaxed" style={{ color: 'var(--text-2)' }}>
            <p className="text-sm">
              Enter a city — Delhi, Phoenix, Lagos, anywhere — and within seconds you see
              projected heatwave days, peak temperatures, economic losses, and estimated
              mortality for 2030 and 2050.
            </p>
            <p className="text-sm">
              Pull two cities side by side, adjust tree cover or cool roofs to see what
              intervention saves, or export the full calculation to Excel.
            </p>
            <p className="text-[10px] font-mono leading-loose" style={{ color: 'var(--muted)' }}>
              ERA5 reanalysis · CMIP6 ensemble · World Bank GDP · Gasparrini (2017) · Burke (2018)
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5 stagger-children">
          {[
            { title: 'City Risk Map',        desc: 'Interactive hex-grid heatmap at neighbourhood scale.',        accent: 'var(--reference)', icon: '◎' },
            { title: 'Deep Dive Analysis',   desc: 'Survivability timeline, climate debt, adaptation ROI.',      accent: 'var(--heat-2)',   icon: '◈' },
            { title: 'City vs City Compare', desc: 'Side-by-side metrics for any two cities. Transparent math.', accent: 'var(--copper)',   icon: '⟷' },
            { title: 'Excel Audit Export',   desc: '4-sheet model with live formulas, every number sourced.',     accent: 'var(--positive)', icon: '⊞' },
          ].map(f => (
            <div key={f.title}
                 className="glass-card relative p-4 flex flex-col gap-1.5 overflow-hidden group">
              <div className="absolute top-0 left-0 right-0 h-px"
                   style={{ background: `linear-gradient(90deg, transparent, ${f.accent}50, transparent)` }} />
              <span className="text-sm" style={{ color: f.accent }}>{f.icon}</span>
              <h3 className="font-sans font-semibold text-[11px] leading-tight" style={{ color: 'var(--text)' }}>{f.title}</h3>
              <p className="font-sans text-[10px] leading-relaxed" style={{ color: 'var(--muted)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── 3. AUDIENCE ── */}
      <section className="w-full px-5 pb-12 max-w-lg mx-auto">
        <div className="text-center mb-8">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] mb-2" style={{ color: 'var(--muted)' }}>Who uses OpenPlanet</p>
          <h2 className="text-xl font-sans font-bold tracking-tight" style={{ color: 'var(--text)' }}>
            Built for people who make decisions about places.
          </h2>
        </div>

        <div className="flex flex-col gap-3">
          {[
            {
              audience: 'City Planners & Policy',
              accent: '#6E8CA8',
              lines: ['Which neighbourhoods cross 35°C wet-bulb first?', 'How many cooling centres do we need by 2040?', 'What does +20% tree cover actually buy us?'],
            },
            {
              audience: 'Climate Researchers',
              accent: '#5E8C6A',
              lines: ['Full audit trail — every formula, every source.', 'Exportable Excel model for peer review.', 'Gasparrini (2017) + Burke (2018) + Stull (2011).'],
            },
            {
              audience: 'Investors & Risk Teams',
              accent: '#B08D57',
              lines: ['GDP-at-risk by city and scenario year.', 'NPV climate debt 2030–2050.', 'SSP2-4.5 and SSP5-8.5 side by side.'],
            },
          ].map(card => (
            <div key={card.audience}
                 className="glass relative p-5 flex flex-col gap-4 overflow-hidden"
                 style={{ border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
              <div className="absolute top-0 left-0 right-0 h-px"
                   style={{ background: `linear-gradient(90deg, transparent, ${card.accent}60, transparent)` }} />
              <div className="flex items-center gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: card.accent }} />
                <h3 className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: card.accent }}>{card.audience}</h3>
              </div>
              <ul className="space-y-2">
                {card.lines.map(line => (
                  <li key={line} className="flex items-start gap-2">
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
      <section className="w-full px-5 pb-12 max-w-lg mx-auto">
        <div className="relative overflow-hidden p-6 glass-panel">
          <div className="absolute top-0 left-0 right-0 h-px"
               style={{ background: 'linear-gradient(90deg, transparent, rgba(176,141,87,0.15), transparent)' }} />
          <div className="grid grid-cols-2 gap-5 mb-6">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-[1.75rem] font-mono font-bold mb-1 tracking-tight glow-copper"
                   style={{ color: 'var(--copper)' }}>{s.value}</p>
                <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>
          <div className="divider-copper mb-4" />
          <p className="text-[9px] font-mono text-center leading-loose" style={{ color: 'var(--muted)' }}>
            All projections are research-grade estimates for analytical purposes only.
            Not investment advice. Mortality ±15% CI · Economic ±8% CI.
          </p>
        </div>
      </section>

      {/* ── 5. METHODOLOGY ── */}
      <section className="w-full px-5 pb-12 max-w-lg mx-auto flex flex-col gap-6">
        <div>
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] mb-3" style={{ color: 'var(--muted)' }}>
            Transparent science
          </p>
          <h2 className="text-xl font-sans font-bold tracking-tight leading-tight mb-4" style={{ color: 'var(--text)' }}>
            Every number has a source.<br />
            <span className="font-light" style={{ color: 'var(--muted)' }}>No black boxes.</span>
          </h2>
          <p className="text-sm leading-relaxed font-sans" style={{ color: 'var(--text-2)' }}>
            Every number links back to its formula and source paper. Confidence levels
            (high / medium) are shown on each metric — so you always know what to trust.
          </p>
        </div>

        <div className="space-y-2">
          {[
            { model: 'Mortality',    source: 'Gasparrini et al. (2017)', journal: 'Lancet Planetary Health',    detail: 'β = 0.0801 · dose-response · GBD meta-analysis', accent: 'var(--heat-4)' },
            { model: 'Economics',    source: 'Burke et al. (2018)',       journal: 'Nature',                    detail: 'T_optimal = 13°C · GDP penalty function',         accent: 'var(--heat-2)' },
            { model: 'Labor loss',   source: 'ILO (2019)',                journal: 'Working on a Warmer Planet', detail: '40% workforce · 20% productivity per heatwave day', accent: 'var(--copper)' },
            { model: 'Wet-bulb',     source: 'Stull (2011)',              journal: 'J. Applied Meteorology',    detail: 'Capped 35°C — Sherwood & Huber (2010) PNAS',       accent: 'var(--reference)' },
            { model: 'Climate data', source: 'Open-Meteo CMIP6',          journal: 'ERA5 + MRI/MPI ensemble',  detail: '2015–2050 validated CMIP6 · horizon capped 2050',   accent: 'var(--positive)' },
          ].map(m => (
            <div key={m.model}
                 className="glass relative p-3.5 flex gap-3 items-start overflow-hidden group"
                 style={{ border: '1px solid var(--hairline)' }}>
              <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                   style={{ background: `linear-gradient(90deg, transparent, ${m.accent}50, transparent)` }} />
              <div className="w-1 h-1 rounded-full shrink-0 mt-1.5" style={{ background: m.accent }} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-1.5 mb-0.5 flex-wrap">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-widest" style={{ color: 'var(--text)' }}>{m.model}</span>
                  <span className="text-[9px] font-mono" style={{ color: m.accent }}>{m.source}</span>
                </div>
                <p className="text-[9px] font-mono italic truncate" style={{ color: 'var(--muted)' }}>{m.journal}</p>
                <p className="text-[9px] font-mono mt-0.5" style={{ color: 'var(--muted)' }}>{m.detail}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── 6. FINAL CTA ── */}
      <section className="w-full px-5 pb-16 max-w-lg mx-auto">
        <div className="relative flex flex-col items-center text-center py-12 px-5 overflow-hidden glass-panel">
          <div className="absolute top-0 left-0 right-0 h-px"
               style={{ background: 'linear-gradient(90deg, transparent, rgba(176,141,87,0.2), transparent)' }} />
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(176,141,87,0.04) 0%, transparent 60%)' }} />
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] mb-4 relative z-10" style={{ color: 'var(--muted)' }}>
            Free · Open source · No account required
          </p>
          <h3 className="text-2xl font-sans font-bold mb-3 leading-tight tracking-tight relative z-10"
              style={{ color: 'var(--text)' }}>
            What is the heat risk<br />
            <span className="font-light" style={{ color: 'var(--muted)' }}>in your city?</span>
          </h3>
          <p className="font-serif text-sm mb-8 max-w-xs mx-auto relative z-10" style={{ color: 'var(--text-2)' }}>
            20 climate zones verified. Every formula auditable.
          </p>
          <button
            onClick={handleCTA}
            style={{ touchAction: 'manipulation' }}
            className="w-full btn-primary relative z-10 bg-white text-black font-sans font-semibold text-xs uppercase tracking-wider transition-all duration-150 hover:bg-zinc-50 min-h-[52px]"
          >
            Analyse a City →
          </button>
        </div>
      </section>

      {/* ── DISCLAIMER ── */}
      <div className="w-full flex flex-col items-center text-center gap-2 pt-6 pb-10 px-5"
           style={{ borderTop: '1px solid var(--hairline)' }}>
        <p className="text-[9px] font-mono uppercase tracking-[0.25em] font-bold" style={{ color: 'var(--muted)' }}>
          Disclaimer
        </p>
        <p className="text-[10px] leading-relaxed font-serif max-w-sm" style={{ color: 'var(--muted)' }}>
          OpenPlanet is a computational estimation engine based on global meta-analyses (Gasparrini 2017, Burke 2018).
          Designed for directional risk visualization and strategic planning, not localized actuarial or medical forecasting.
        </p>
      </div>

      {/* ── AUTH MODAL — bottom sheet ── */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[999] flex items-end justify-center bg-black/85"
          style={{ backdropFilter: 'blur(14px)' }}
          onClick={() => setShowAuthModal(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden animate-fadeSlideUp"
            style={{ background: 'var(--panel)', border: '1px solid var(--hairline)', borderBottom: 'none' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="h-px w-full"
                 style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }} />
            <div className="p-8">
              <button
                onClick={() => setShowAuthModal(false)}
                className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center transition-colors hover:text-white"
                style={{ color: 'var(--muted)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                     strokeWidth="1.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
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
                  style={{ border: '1px solid var(--hairline)', color: 'var(--text-2)', background: 'var(--raised)', touchAction: 'manipulation' }}
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
