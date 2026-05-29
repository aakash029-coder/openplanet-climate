'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const CITIES = [
  { name: 'Delhi',    country: 'India',     temp: 49.2, deaths: 14200, loss: '$31B', hw: 68  },
  { name: 'Lagos',    country: 'Nigeria',   temp: 43.7, deaths: 9800,  loss: '$18B', hw: 112 },
  { name: 'Jakarta',  country: 'Indonesia', temp: 38.9, deaths: 6100,  loss: '$22B', hw: 89  },
  { name: 'Phoenix',  country: 'USA',       temp: 46.1, deaths: 3400,  loss: '$14B', hw: 145 },
  { name: 'Karachi',  country: 'Pakistan',  temp: 51.3, deaths: 18700, loss: '$8B',  hw: 134 },
];

const FEATURES = [
  { title: 'City Risk Map',      desc: 'Hex-grid heatmap at neighbourhood scale', accent: 'var(--reference)' },
  { title: 'Deep Dive Analysis', desc: 'Survivability timeline · Adaptation ROI',  accent: 'var(--heat-2)'  },
  { title: 'Compare Cities',     desc: 'Side-by-side metrics, same formula',       accent: 'var(--copper)'  },
  { title: 'Excel Export',       desc: 'Every number traceable to its source',     accent: 'var(--positive)' },
];

const STATS = [
  { value: '8,000+', label: 'Cities Modelled'  },
  { value: '4',      label: 'Climate Scenarios' },
  { value: '2050',   label: 'Validated Horizon' },
  { value: '±15%',   label: 'Mortality CI'      },
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

  const handleCTA = () => {
    if (session) router.push('/dashboard');
    else setShowAuthModal(true);
  };

  return (
    <div className="w-full flex flex-col pb-10"
         style={{ background: 'var(--canvas)', color: 'var(--text)', minHeight: '100dvh' }}>

      {/* ── BRAND BAR ── */}
      <div className="flex items-center justify-between px-5 py-3"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <span className="w-1 h-1 rounded-full" style={{ background: 'var(--muted)' }} />
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] font-semibold"
                style={{ color: 'var(--muted)' }}>
            OpenPlanet · Climate Risk
          </span>
        </div>
        <span className="font-mono text-[8px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>
          CMIP6 · ERA5
        </span>
      </div>

      {/* ── HERO ── */}
      <div className="px-5 pt-6 pb-5 flex flex-col gap-4">

        <span className="font-mono text-[9px] uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
          ● Live · CMIP6 · ERA5 · Peer-Reviewed
        </span>

        {/* Cycling headline */}
        <h1 className="font-serif text-[1.85rem] font-medium tracking-tight leading-[1.2]"
            style={{ color: '#E4E4E7' }}>
          By 2050,{' '}
          <span className="gradient-text-copper transition-opacity duration-300"
                style={{ opacity: cityVisible ? 1 : 0 }}>
            {city.name}
          </span>
          <br />
          could lose{' '}
          <span className="gradient-text-copper transition-opacity duration-300"
                style={{ opacity: cityVisible ? 1 : 0 }}>
            {city.loss}
          </span>
          <br />
          <span className="font-serif font-light"
                style={{ color: 'var(--muted)', fontSize: '1.1rem' }}>
            to extreme heat every year.
          </span>
        </h1>

        {/* Metric ledger */}
        <div style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
          {[
            { label: 'Peak Temperature',   value: `${city.temp}°C`,                  color: 'var(--copper)', source: 'TX5d decadal mean · ERA5'    },
            { label: 'Est. Heat Deaths',   value: `~${city.deaths.toLocaleString()}`, color: 'var(--heat-4)', source: 'Gasparrini 2017 · ±15% CI'   },
            { label: 'Heatwave Days / yr', value: `${city.hw}d`,                     color: 'var(--heat-3)', source: 'Days above P95 · CMIP6'       },
          ].map((m, i) => (
            <div key={m.label}
                 className="flex items-center justify-between px-4 py-3"
                 style={{ borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
              <div>
                <p className="font-mono text-[9px] uppercase tracking-[0.12em]"
                   style={{ color: 'var(--muted)' }}>{m.label}</p>
                <p className="font-mono text-[8px] mt-0.5"
                   style={{ color: 'var(--muted)', opacity: 0.4 }}>{m.source}</p>
              </div>
              <p className="font-mono text-[1.5rem] font-bold tabular-nums transition-opacity duration-300"
                 style={{ color: m.color, opacity: cityVisible ? 1 : 0 }}>
                {m.value}
              </p>
            </div>
          ))}
        </div>

        {/* Provenance */}
        <p className="font-mono text-[8px] tracking-[0.07em] text-center"
           style={{ color: 'var(--muted)', opacity: 0.45 }}>
          Copernicus C3S ERA5 · CMIP6 · Gasparrini 2017 · Burke 2018
        </p>

        {/* Primary CTA */}
        <button
          onClick={handleCTA}
          className="w-full font-sans font-semibold text-[12px] uppercase tracking-wider transition-all duration-150 hover:bg-zinc-100 btn-primary"
          style={{ background: 'var(--text)', color: 'var(--canvas)', minHeight: '56px', touchAction: 'manipulation' }}
        >
          Analyse Your City →
        </button>

        <p className="font-mono text-[8px] text-center uppercase tracking-[0.18em]"
           style={{ color: 'var(--muted)', opacity: 0.4 }}>
          Free · No account required
        </p>
      </div>

      {/* ── WHAT YOU GET ── */}
      <div className="px-5 pb-6" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="font-mono text-[9px] uppercase tracking-[0.2em] py-4" style={{ color: 'var(--muted)' }}>
          What you get
        </p>
        <div className="grid grid-cols-2 gap-2">
          {FEATURES.map(f => (
            <div key={f.title}
                 className="p-3 flex flex-col gap-1.5"
                 style={{ border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
              <div className="w-1.5 h-1.5 rounded-full" style={{ background: f.accent }} />
              <p className="font-sans font-semibold text-[11px] leading-tight" style={{ color: 'var(--text)' }}>
                {f.title}
              </p>
              <p className="font-sans text-[10px] leading-relaxed" style={{ color: 'var(--muted)' }}>
                {f.desc}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* ── STATS STRIP ── */}
      <div className="mx-5 mb-6 p-4 grid grid-cols-2 gap-4 relative overflow-hidden"
           style={{ border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
        <div className="absolute top-0 left-0 right-0 h-px"
             style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }} />
        {STATS.map(s => (
          <div key={s.label} className="text-center">
            <p className="font-mono text-[1.35rem] font-bold glow-copper" style={{ color: 'var(--copper)' }}>
              {s.value}
            </p>
            <p className="font-mono text-[8px] uppercase tracking-widest mt-0.5" style={{ color: 'var(--muted)' }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* ── FOOTER ── */}
      <div className="mt-auto px-5 py-5" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <p className="font-mono text-[7px] uppercase tracking-[0.13em] text-center leading-relaxed"
           style={{ color: 'var(--muted)', opacity: 0.3 }}>
          OpenPlanet is a computational estimation engine based on global meta-analyses.<br />
          Designed for directional risk visualization · Not operational advice.
        </p>
      </div>

      {/* ── AUTH MODAL (bottom sheet) ── */}
      {showAuthModal && (
        <div
          className="fixed inset-0 z-[999] flex items-end justify-center bg-black/80"
          style={{ backdropFilter: 'blur(14px)' }}
          onClick={() => setShowAuthModal(false)}
        >
          <div
            className="relative w-full max-w-md overflow-hidden animate-fadeSlideUp"
            style={{
              background: 'var(--panel)',
              border: '1px solid var(--hairline)',
              borderBottom: 'none',
            }}
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

              <p className="text-[9px] font-mono uppercase tracking-[0.3em] mb-1"
                 style={{ color: 'var(--muted)' }}>Access</p>
              <h2 className="text-lg font-sans font-semibold mb-8 tracking-tight"
                  style={{ color: 'var(--text)' }}>OpenPlanet</h2>

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
                  <span className="text-[10px] font-mono uppercase tracking-widest"
                        style={{ color: 'var(--muted)' }}>or</span>
                  <div className="flex-1 divider-gradient" />
                </div>

                <button
                  onClick={() => { setShowAuthModal(false); router.push('/dashboard'); }}
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
