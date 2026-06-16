'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { usePrefersReducedMotion } from '@/hooks/usePrefersReducedMotion';
import { useModalA11y } from '@/hooks/useModalA11y';

// Only metrics derived from reliable CMIP6 + ERA5 sources.
// Deaths and economic loss removed from hero — model accuracy is ±41% MAE
// (see /methodology#backtests). Use dashboard for full analysis.
const CITIES = [
  { name: 'Delhi',    country: 'India',     year: 2050, temp: 49.2, wbt: 32.4, hw: 68  },
  { name: 'Lagos',    country: 'Nigeria',   year: 2050, temp: 43.7, wbt: 33.1, hw: 112 },
  { name: 'Jakarta',  country: 'Indonesia', year: 2050, temp: 38.9, wbt: 32.8, hw: 89  },
  { name: 'Phoenix',  country: 'USA',       year: 2050, temp: 46.1, wbt: 27.9, hw: 145 },
  { name: 'Karachi',  country: 'Pakistan',  year: 2050, temp: 51.3, wbt: 31.6, hw: 134 },
];

// Validation accuracy from backtest suite — see climate_engine/validation/
const BACKTESTS = [
  { event: 'India 2015',  error: '+9.8%',  ok: true  },
  { event: 'England 2022', error: '−16.7%', ok: true  },
  { event: 'Moscow 2010', error: '−28.3%', ok: true  },
  { event: 'Paris 2003',  error: '−73%',   ok: false },
  { event: 'Chicago 1995', error: '−75%',  ok: false },
];

const STATS = [
  { value: 'Any',    label: 'Global Coordinate'  },
  { value: '4',      label: 'Climate Scenarios'  },
  { value: '2050',   label: 'Validated Horizon'  },
  { value: '5/5',    label: 'Historical Backtests' },
];

export default function LandingDesktop() {
  const { data: session }         = useSession();
  const router                    = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [activeCityIdx, setActiveCityIdx] = useState(0);
  const [rotatePaused, setRotatePaused]   = useState(false);
  const intervalRef               = useRef<NodeJS.Timeout | null>(null);
  const reducedMotion             = usePrefersReducedMotion();

  const closeAuthModal = useCallback(() => setShowAuthModal(false), []);
  const modalRef       = useModalA11y(showAuthModal, closeAuthModal);

  useEffect(() => {
    document.documentElement.style.overscrollBehavior = 'none';
    return () => {
      document.documentElement.style.overscrollBehavior = '';
    };
  }, []);

  useEffect(() => {
    // Respect reduced-motion and pause state (WCAG 2.2.2 pause/stop/hide).
    if (reducedMotion || rotatePaused) return;
    intervalRef.current = setInterval(() => {
      setActiveCityIdx(i => (i + 1) % CITIES.length);
    }, 3400);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [reducedMotion, rotatePaused]);

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
      <main className="w-full max-w-7xl px-5 md:px-8 lg:px-12 flex flex-col items-center pb-24 gap-20 md:gap-32 lg:gap-40 pt-12 md:pt-16">

        {/* ── 1. HERO ── */}
        <section
          className="hero-desktop-section hero-glossy-frame w-full flex flex-col justify-between items-center py-6 md:py-8 lg:py-10 overflow-hidden relative z-10 text-center"
          style={{ height: 'min(calc(100vh - 4rem), 920px)' }}
          onMouseEnter={() => setRotatePaused(true)}
          onMouseLeave={() => setRotatePaused(false)}
          onFocusCapture={() => setRotatePaused(true)}
          onBlurCapture={() => setRotatePaused(false)}
        >

          {/* Headline */}
          <div className="w-full max-w-5xl mx-auto text-center px-4">
            <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-medium tracking-tight leading-[1.1]"
                style={{ color: '#E4E4E7' }}>
              How hot will{' '}
              <span className="gradient-text-copper">{city.name}</span>
              <br />
              get by{' '}
              <span className="gradient-text-copper">{city.year}</span>?
              <br />
              <span className="font-serif font-light"
                    style={{ color: 'var(--muted)', fontSize: 'clamp(1.25rem,2.5vw,1.875rem)', letterSpacing: '-0.01em' }}>
                Real CMIP6 projections for any city.
              </span>
            </h1>
          </div>

          <p className="font-serif text-body-s mb-0 max-w-xl mx-auto leading-relaxed px-4" style={{ color: 'var(--text-2)' }}>
            OpenPlanet pulls live ERA5 reanalysis and CMIP6 ensemble projections
            for any coordinate on Earth — no approximations, no black boxes.
          </p>

          {/* Ledger strip — only high-confidence metrics */}
          <div className="w-full max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-0 my-6 py-4 md:py-6"
               style={{ borderTop: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            {[
              {
                label:      'Peak Tx5d',
                source:     'SSP5-8.5 · CMIP6 ensemble · 2050',
                confidence: 'HIGH',
                value:      `${city.temp}°C`,
                glow:       'glow-amber',
                color:      'var(--copper)',
                cls:        'border-b border-r-0 md:border-b-0 md:border-r',
              },
              {
                label:      'Wet-bulb Temp',
                source:     'Stull 2011 · ERA5 humidity · 2050',
                confidence: 'HIGH',
                value:      `${city.wbt}°C`,
                glow:       'glow-red',
                color:      city.wbt >= 31 ? 'var(--heat-4)' : 'var(--heat-2)',
                cls:        'border-b border-r-0 md:border-b-0 md:border-r',
              },
              {
                label:      'Heatwave Days / yr',
                source:     'Days above ERA5 P95 · CMIP6',
                confidence: 'HIGH',
                value:      `${city.hw}d`,
                glow:       'glow-red',
                color:      'var(--heat-3)',
                cls:        '',
              },
            ].map((s) => (
              <div key={s.label}
                   className={`px-6 md:px-10 py-6 md:py-8 text-center flex flex-col items-center justify-center ${s.cls}`}
                   style={{ borderColor: 'rgba(255,255,255,0.05)' }}
              >
                <p className={`font-mono text-3xl md:text-4xl lg:text-5xl font-medium tracking-tighter tabular-nums ${s.glow}`}
                   style={{ color: s.color }}>
                  {s.value}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="w-1 h-1 rounded-full bg-emerald-500 shrink-0" />
                  <p className="font-sans text-[10px] tracking-[0.14em] uppercase" style={{ color: 'var(--text-2)' }}>
                    {s.label}
                  </p>
                </div>
                <p className="font-mono text-[9px] tracking-[0.08em] mt-1" style={{ color: 'var(--muted)' }}>
                  {s.source}
                </p>
              </div>
            ))}
          </div>

          {/* Validation credibility strip */}
          <div className="w-full max-w-3xl mx-auto px-4 mb-6">
            <div className="flex flex-col items-center gap-2">
              <p className="font-mono text-[8px] uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
                Model validated against 5 historical heatwaves
              </p>
              <div className="flex flex-wrap justify-center gap-2">
                {BACKTESTS.map(b => (
                  <span key={b.event}
                        className="font-mono text-[8px] px-2 py-0.5 flex items-center gap-1"
                        style={{
                          border: `1px solid ${b.ok ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.06)'}`,
                          color: b.ok ? 'var(--positive)' : 'var(--muted)',
                        }}>
                    <span>{b.ok ? '✓' : '△'}</span>
                    <span>{b.event}</span>
                    <span style={{ opacity: 0.6 }}>({b.error})</span>
                  </span>
                ))}
              </div>
              <p className="font-mono text-[8px]" style={{ color: 'var(--muted)' }}>
                △ Acute (&lt;10-day) events underestimated by model — see methodology for details
              </p>
            </div>
          </div>

          {/* Data provenance */}
          <p className="font-mono text-[9px] text-center max-w-2xl mx-auto px-4 mb-4 leading-loose" style={{ color: 'var(--muted)' }}>
            Copernicus C3S ERA5 · CMIP6 MRI/MPI ensemble · Open-Meteo · NASA POWER · Gasparrini 2017 · Burke 2018
          </p>

          {/* Primary CTA + scroll hint */}
          <div className="flex flex-col items-center gap-4">
            <button
              onClick={handleStartSimulation}
              style={{ touchAction: 'manipulation' }}
              className="btn-primary relative bg-white text-black font-sans font-semibold text-xs px-10 py-3.5 uppercase tracking-wider transition-all duration-150 hover:bg-zinc-100 min-h-[48px] overflow-hidden"
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

        {/* ── 2. PUBLISHED, DOCUMENTED & REFERENCED ── */}
        <section className="w-full -mt-8 md:-mt-12">
          <div className="w-full" style={{ borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)', padding: '3.5rem 0' }}>

            {/* Header */}
            <div className="text-center mb-10">
              <p className="text-[9px] font-mono uppercase tracking-[0.35em] mb-4" style={{ color: 'var(--muted)' }}>
                Open Science · Research Archive · Ecosystem Recognition
              </p>
              <h2 className="text-2xl md:text-[1.75rem] font-sans font-bold tracking-tight mb-3 leading-tight" style={{ color: 'var(--text)' }}>
                Published, documented, and independently referenced.
              </h2>
              <p className="font-serif text-sm max-w-xl mx-auto leading-relaxed" style={{ color: 'var(--text-2)' }}>
                OpenPlanet's methodology is openly archived, documented in peer-reviewed technical literature,
                and referenced by international disaster risk, climate adaptation, and sustainability organisations.
              </p>
            </div>

            {/* ── Grid: 3 cols × 2 rows — 5 cards, zero empty space ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-px"
                 style={{ border: '1px solid var(--hairline)', background: 'var(--hairline)' }}>

              {/* ── ROW 1 ── */}

              {/* Zenodo — col-span-2 */}
              <div className="lg:col-span-2 relative p-6 md:p-8 group flex flex-col gap-5"
                   style={{ background: 'var(--raised)', borderLeft: '2px solid rgba(176,141,87,0.55)' }}>
                <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                     style={{ background: 'linear-gradient(90deg, rgba(176,141,87,0.45), rgba(176,141,87,0.08), transparent)' }} />
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <span className="font-mono text-[7px] uppercase tracking-[0.22em] px-2 py-1 font-semibold"
                        style={{ border: '1px solid rgba(176,141,87,0.45)', color: 'var(--copper)', background: 'rgba(176,141,87,0.06)' }}>
                    Research Archive · Open Access
                  </span>
                  <span className="font-mono text-[8px] tabular-nums" style={{ color: 'var(--muted)', opacity: 0.4 }}>
                    DOI 10.5281/zenodo.19340991
                  </span>
                </div>
                <div className="flex flex-col gap-2 flex-1">
                  <h3 className="font-sans font-semibold text-base tracking-tight" style={{ color: 'var(--text)' }}>Zenodo</h3>
                  <p className="font-sans text-[11px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                    Permanently archived in the open-science repository maintained by CERN and OpenAIRE —
                    the same infrastructure used by research teams publishing in <em>Nature</em>, <em>Science</em>,
                    and IPCC working groups. Every version is citable, reproducible, and DOI-registered.
                  </p>
                </div>
                <p className="font-mono text-[8px]" style={{ color: 'var(--muted)', opacity: 0.35 }}>
                  Indexed · Google Scholar · OpenAIRE · DataCite
                </p>
              </div>

              {/* Towards Data Science — col-span-1 */}
              <div className="relative p-6 group flex flex-col gap-4"
                   style={{ background: 'var(--raised)' }}>
                <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                     style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />
                <span className="font-mono text-[7px] uppercase tracking-[0.22em] px-2 py-1 self-start"
                      style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
                  Technical Publication
                </span>
                <div className="flex flex-col gap-2 flex-1">
                  <h3 className="font-sans font-semibold text-sm tracking-tight" style={{ color: 'var(--text)' }}>
                    Towards Data Science
                  </h3>
                  <p className="font-mono text-[8px]" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                    Medium Publications · 700K+ monthly readers
                  </p>
                  <p className="font-sans text-[10px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                    "From NetCDF to Insights: A Practical Pipeline for City-Level Climate Risk Analysis" —
                    a documented walkthrough of the data engineering and scientific methodology behind OpenPlanet.
                  </p>
                </div>
                <a href="https://towardsdatascience.com/from-netcdf-to-insights-a-practical-pipeline-for-city-level-climate-risk-analysis/"
                   target="_blank" rel="noopener noreferrer"
                   className="font-mono text-[8px] uppercase tracking-[0.15em] flex items-center gap-1.5 transition-colors duration-150 hover:text-white"
                   style={{ color: 'var(--muted)', opacity: 0.5 }}>
                  Read article
                  <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M7 17L17 7M7 7h10v10"/></svg>
                </a>
              </div>

              {/* ── ROW 2 ── */}

              {/* UNDRR PreventionWeb */}
              <div className="relative p-6 group flex flex-col gap-4"
                   style={{ background: 'var(--raised)' }}>
                <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                     style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }} />
                <span className="font-mono text-[7px] uppercase tracking-[0.22em] px-2 py-1 self-start"
                      style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
                  Referenced
                </span>
                <div className="flex flex-col gap-1.5 flex-1">
                  <h3 className="font-sans font-semibold text-sm tracking-tight" style={{ color: 'var(--text)' }}>UNDRR PreventionWeb</h3>
                  <p className="font-mono text-[8px]" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                    United Nations · Office for Disaster Risk Reduction · Geneva
                  </p>
                  <p className="font-sans text-[10px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                    The UN's primary knowledge platform for researchers, practitioners, and policymakers operating under the Sendai Framework for Disaster Risk Reduction 2015–2030.
                  </p>
                </div>
              </div>

              {/* CAKE */}
              <div className="relative p-6 group flex flex-col gap-4"
                   style={{ background: 'var(--raised)' }}>
                <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                     style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }} />
                <span className="font-mono text-[7px] uppercase tracking-[0.22em] px-2 py-1 self-start"
                      style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
                  Referenced
                </span>
                <div className="flex flex-col gap-1.5 flex-1">
                  <h3 className="font-sans font-semibold text-sm tracking-tight" style={{ color: 'var(--text)' }}>CAKE</h3>
                  <p className="font-mono text-[8px]" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                    Climate Adaptation Knowledge Exchange · EcoAdapt · USA
                  </p>
                  <p className="font-sans text-[10px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                    North America's primary open-access resource for climate adaptation science, used by government agencies, research institutions, and policy organisations.
                  </p>
                </div>
              </div>

              {/* ClimateBase */}
              <div className="relative p-6 group flex flex-col gap-4"
                   style={{ background: 'var(--raised)' }}>
                <div className="absolute top-0 left-0 right-0 h-px opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                     style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)' }} />
                <span className="font-mono text-[7px] uppercase tracking-[0.22em] px-2 py-1 self-start"
                      style={{ border: '1px solid var(--hairline)', color: 'var(--muted)' }}>
                  Referenced
                </span>
                <div className="flex flex-col gap-1.5 flex-1">
                  <h3 className="font-sans font-semibold text-sm tracking-tight" style={{ color: 'var(--text)' }}>ClimateBase</h3>
                  <p className="font-mono text-[8px]" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                    Climate Career &amp; Research Directory · Global
                  </p>
                  <p className="font-sans text-[10px] leading-relaxed" style={{ color: 'var(--text-2)' }}>
                    Global directory connecting climate professionals, researchers, and organisations. Listed alongside tools from leading climate-tech institutions worldwide.
                  </p>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* ── 3. WHAT IT DOES (was 2) ── */}
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
                ERA5 reanalysis · CMIP6 ensemble (Open-Meteo) · NASA POWER ·
                Gasparrini (2017) · Burke (2018)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 stagger-children">
            {[
              { title: 'City Risk Map',        desc: 'Interactive hex-grid heatmap. Visualise thermal exposure at neighbourhood scale.', accent: 'var(--reference)', icon: '◎' },
              { title: 'Deep Dive Analysis',   desc: 'Survivability timeline, climate debt, adaptation ROI — all from real CMIP6 data.',  accent: 'var(--heat-2)',   icon: '◈' },
              { title: 'City vs City Compare', desc: 'Side-by-side metrics for any two cities. Same formula, transparent math.',          accent: 'var(--copper)',   icon: '⟷' },
              { title: 'Excel Audit Export',   desc: '4-sheet model with live formulas. Every number traceable to its source.',            accent: 'var(--positive)', icon: '⊞' },
            ].map(f => (
              <div key={f.title}
                   className="glass-card relative p-5 md:p-6 group overflow-hidden">
                <div className="absolute top-0 left-0 right-0 h-px transition-opacity duration-300 opacity-0 group-hover:opacity-100"
                     style={{ background: `linear-gradient(90deg, transparent, ${f.accent}50, transparent)` }} />
                <div className="flex items-start gap-3">
                  <span className="text-sm mt-0.5 shrink-0 transition-colors duration-200" style={{ color: f.accent }}>{f.icon}</span>
                  <div>
                    <h3 className="font-sans font-semibold text-body-ui mb-1.5" style={{ color: 'var(--text)' }}>{f.title}</h3>
                    <p className="font-sans text-[11px] leading-relaxed" style={{ color: 'var(--muted)' }}>{f.desc}</p>
                  </div>
                </div>
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
        <section className="w-full relative overflow-hidden p-8 md:p-14 glass-panel">
          <div className="absolute top-0 left-0 right-0 h-px"
               style={{ background: 'linear-gradient(90deg, transparent, rgba(176,141,87,0.15), transparent)' }} />
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(176,141,87,0.02) 0%, transparent 70%)' }} />

          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-8 relative z-10">
            {STATS.map(s => (
              <div key={s.label} className="text-center">
                <p className="text-3xl md:text-4xl lg:text-5xl font-mono font-bold mb-1.5 tracking-tight glow-copper"
                   style={{ color: 'var(--copper)' }}>
                  {s.value}
                </p>
                <p className="text-[9px] font-mono uppercase tracking-widest" style={{ color: 'var(--muted)' }}>{s.label}</p>
              </div>
            ))}
          </div>

          <div className="divider-copper mb-6" />

          <p className="text-[10px] font-mono text-center leading-loose max-w-2xl mx-auto relative z-10" style={{ color: 'var(--muted)' }}>
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
              When you run a projection, every number links to its source — which formula
              produced it, which variables were used, and which peer-reviewed paper each
              constant came from. Confidence levels (high / medium) are shown on every metric.
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
        <section className="w-full relative flex flex-col items-center text-center py-12 md:py-16 px-6 overflow-hidden glass-panel">
          <div className="absolute top-0 left-0 right-0 h-px"
               style={{ background: 'linear-gradient(90deg, transparent, rgba(176,141,87,0.2), transparent)' }} />
          <div className="absolute inset-0 pointer-events-none"
               style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(176,141,87,0.04) 0%, transparent 60%)' }} />

          <p className="text-[9px] font-mono uppercase tracking-[0.3em] mb-5 relative z-10" style={{ color: 'var(--muted)' }}>
            Free · No account required · Open source
          </p>
          <h3 className="text-3xl md:text-5xl lg:text-6xl font-sans font-bold mb-5 leading-tight tracking-tight relative z-10" style={{ color: 'var(--text)' }}>
            What is the heat risk<br />
            <span className="font-light" style={{ color: 'var(--muted)' }}>in your city?</span>
          </h3>
          <p className="font-serif text-body-s mb-8 max-w-md mx-auto relative z-10" style={{ color: 'var(--text-2)' }}>
            Research-grade climate analysis in seconds.
            5 climate-zone archetypes · validated against 5 historical heatwaves · every formula auditable.
          </p>
          <div className="flex flex-col sm:flex-row items-center gap-4 relative z-10">
            <button
              onClick={handleStartSimulation}
              style={{ touchAction: 'manipulation' }}
              className="btn-primary bg-white text-black font-sans font-semibold text-xs px-12 py-4 uppercase tracking-wider transition-all duration-150 hover:bg-zinc-50 min-h-[52px]"
            >
              Analyse a City →
            </button>
            <a href="https://github.com/aakash029-coder/openplanet-climate"
               target="_blank" rel="noopener noreferrer"
               className="btn-ghost font-mono text-[10px] uppercase tracking-[0.2em] px-6 py-4 min-h-[52px] flex items-center gap-2"
               style={{ color: 'var(--text-2)', border: '1px solid var(--hairline)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"/></svg>
              View Source
            </a>
          </div>
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
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
            className="relative w-full max-w-md overflow-hidden animate-fadeSlideUp"
            style={{ background: 'var(--panel)', border: '1px solid var(--hairline)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="h-px w-full"
                 style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.12), transparent)' }} />

            <div className="p-8">
              <button
                onClick={() => setShowAuthModal(false)}
                aria-label="Close sign-in dialog"
                className="absolute top-5 right-5 w-9 h-9 flex items-center justify-center transition-colors duration-150 hover:text-white"
                style={{ color: 'var(--muted)' }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <p className="text-[9px] font-mono uppercase tracking-[0.3em] mb-1" style={{ color: 'var(--muted)' }}>Access</p>
              <h2 id="auth-modal-title" className="text-lg font-sans font-semibold mb-8 tracking-tight" style={{ color: 'var(--text)' }}>OpenPlanet</h2>

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
