'use client';

import { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

const BASE = {
  city: 'Paris',
  country: 'France',
  year: 2050,
  ssp: 'SSP2-4.5',
  peakTemp: 42.1,
  baselineTemp: 24.2,
  heatwaveDays: 31,
  deaths: 4800,
  economicLoss: 28400000000,
  population: 2161000,
  wbt: 29.4,
};

function fmtUSD(n: number): string {
  if (n >= 1e9) return '$' + (n / 1e9).toFixed(1) + 'B';
  if (n >= 1e6) return '$' + (n / 1e6).toFixed(0) + 'M';
  return '$' + n.toLocaleString();
}

export default function DiscoverPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showDesktopWarning, setShowDesktopWarning] = useState(false);

  const [canopy, setCanopy] = useState(15);
  const [albedo, setAlbedo] = useState(40);

  const cooling = (canopy / 100) * 1.2 + (albedo / 100) * 0.8;
  const effectHW = Math.max(0, BASE.heatwaveDays - cooling * 3.5);
  const hwRatio = BASE.heatwaveDays > 0 ? effectHW / BASE.heatwaveDays : 1;
  const combined = hwRatio * Math.max(0, 1 - cooling * 0.08);

  const mitTemp = Math.max(0, BASE.peakTemp - cooling);
  const mitHW = Math.round(effectHW);
  const mitDeaths = Math.round(BASE.deaths * combined);
  const mitLoss = BASE.economicLoss * combined;

  const savedDeaths = BASE.deaths - mitDeaths;
  const savedLoss = BASE.economicLoss - mitLoss;
  const savedTemp = cooling;
  const deathPctSaved = ((savedDeaths / BASE.deaths) * 100).toFixed(0);

  const handleOpenDashboard = (e: React.MouseEvent) => {
    e.preventDefault();
    if (session) router.push('/dashboard');
    else setShowAuthModal(true);
  };

  const handleGuestClick = () => {
    setShowAuthModal(false);
    setShowDesktopWarning(true);
  };

  return (
    <div className="flex flex-col w-full min-h-screen relative">
      <main className="flex-grow w-full max-w-[1400px] mx-auto px-4 md:px-8 pt-8 pb-16 flex flex-col gap-6">

        <div className="w-full bg-black/50 border border-white/10 rounded-2xl p-5 md:p-8 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-500/50 to-transparent" />
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <p className="text-[10px] font-mono text-indigo-400 uppercase tracking-[0.3em] mb-1">Interactive Demo</p>
              <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                Paris, France · 2050 · SSP2-4.5
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Pre-loaded with real CMIP6 projections. Adjust the sliders to see what intervention achieves.
              </p>
            </div>
            <div className="flex items-center gap-2 text-[10px] font-mono text-slate-500 bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600 shrink-0" />
              Demo locked · Run any city in Dashboard
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-grow">

          <div className="lg:col-span-4 flex flex-col gap-4">

            <div className="bg-slate-900/60 border border-white/10 rounded-2xl p-5">
              <p className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.3em] mb-3">Phase 01 — Without intervention</p>
              <h2 className="text-white font-bold text-lg mb-1">Baseline risk</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                What happens to Paris if nothing changes. Projected values for 2050 under a moderate emissions pathway.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-3.5">
                <p className="text-xl font-mono font-bold text-orange-400 leading-none mb-1.5">{BASE.peakTemp}°C</p>
                <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest leading-tight">Peak temperature</p>
                <p className="text-[8px] font-mono text-slate-600 mt-1 italic">vs 24.2°C historical</p>
              </div>
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-3.5">
                <p className="text-xl font-mono font-bold text-red-400 leading-none mb-1.5">{BASE.heatwaveDays}d/yr</p>
                <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest leading-tight">Heatwave days</p>
                <p className="text-[8px] font-mono text-slate-600 mt-1 italic">days above P95 threshold</p>
              </div>
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-xl p-3.5">
                <p className="text-xl font-mono font-bold text-rose-400 leading-none mb-1.5">{BASE.deaths.toLocaleString()}</p>
                <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest leading-tight">Attributable deaths</p>
                <p className="text-[8px] font-mono text-slate-600 mt-1 italic">Gasparrini (2017) est.</p>
              </div>
              <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-3.5">
                <p className="text-xl font-mono font-bold text-amber-300 leading-none mb-1.5">{fmtUSD(BASE.economicLoss)}</p>
                <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest leading-tight">Economic loss</p>
                <p className="text-[8px] font-mono text-slate-600 mt-1 italic">Burke (2018) + ILO est.</p>
              </div>
            </div>

            <div className="bg-orange-950/30 border border-orange-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 rounded-full bg-orange-400 animate-pulse shrink-0" />
                <p className="text-[10px] font-mono text-orange-300 uppercase tracking-widest font-bold">Wet-bulb temperature</p>
              </div>
              <p className="text-2xl font-mono font-bold text-orange-300 mb-1">{BASE.wbt}°C</p>
              <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                Danger zone begins at 28°C. At 31°C+ unprotected outdoor exposure becomes fatal within hours.
              </p>
              <p className="text-[8px] font-mono text-slate-600 mt-2 italic">Stull (2011) · Sherwood and Huber (2010)</p>
            </div>

            <div className="bg-slate-900/40 border border-white/5 rounded-xl p-4">
              <p className="text-[9px] font-mono text-slate-600 leading-relaxed">
                All figures are research-grade estimates. Mortality plus or minus 15% CI. Economics plus or minus 8% CI.
                Not a forecast. Not investment advice.
              </p>
            </div>

          </div>

          <div className="lg:col-span-8 bg-black/40 border border-white/10 rounded-2xl p-6 md:p-8 flex flex-col gap-6">

            <div>
              <p className="text-[9px] font-mono text-emerald-400 uppercase tracking-[0.3em] mb-1">Phase 02 — With intervention</p>
              <h2 className="text-lg font-bold text-white mb-1">What can we change?</h2>
              <p className="text-xs text-slate-500 leading-relaxed max-w-xl">
                Adjust urban tree cover and reflective roofing. See the direct impact on temperature, deaths, and economic loss.
                Formulas match the full engine exactly.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-5">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <p className="text-[11px] font-mono text-white font-bold uppercase tracking-widest">Urban tree cover</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Bowler et al. (2010) · 1.2°C per 100%</p>
                  </div>
                  <span className="text-sm font-mono text-emerald-400 font-bold">+{canopy}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  step="1"
                  value={canopy}
                  onChange={(e) => setCanopy(Number(e.target.value))}
                  className="w-full accent-emerald-500 mt-3"
                  style={{ touchAction: 'manipulation' }}
                />
                <div className="flex justify-between text-[8px] font-mono text-slate-600 mt-1">
                  <span>No change</span>
                  <span>+50%</span>
                </div>
              </div>

              <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-xl p-5">
                <div className="flex justify-between items-start mb-1">
                  <div>
                    <p className="text-[11px] font-mono text-white font-bold uppercase tracking-widest">Cool / reflective roofs</p>
                    <p className="text-[9px] text-slate-500 mt-0.5">Santamouris (2015) · 0.8°C per 100%</p>
                  </div>
                  <span className="text-sm font-mono text-indigo-400 font-bold">+{albedo}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={albedo}
                  onChange={(e) => setAlbedo(Number(e.target.value))}
                  className="w-full accent-indigo-500 mt-3"
                  style={{ touchAction: 'manipulation' }}
                />
                <div className="flex justify-between text-[8px] font-mono text-slate-600 mt-1">
                  <span>No change</span>
                  <span>+100%</span>
                </div>
              </div>
            </div>

            <div className="bg-white/[0.02] border border-white/5 rounded-xl p-4 flex flex-wrap gap-4 items-center">
              <div>
                <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest mb-1">Total cooling</p>
                <p className="text-xl font-mono text-cyan-300 font-bold">-{cooling.toFixed(2)}°C</p>
              </div>
              <div className="h-8 w-px bg-white/5" />
              <p className="text-[10px] font-mono text-slate-500 flex-1">
                = canopy ({((canopy / 100) * 1.2).toFixed(2)}°C) + albedo ({((albedo / 100) * 0.8).toFixed(2)}°C)
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">

              <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 space-y-2.5">
                <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Deaths / year</p>
                <div className="flex items-baseline justify-between">
                  <span className="text-[8px] font-mono text-slate-600">Without</span>
                  <span className="text-base font-mono font-bold text-rose-400">{BASE.deaths.toLocaleString()}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[8px] font-mono text-slate-600">With</span>
                  <span className="text-base font-mono font-bold text-slate-300">{mitDeaths.toLocaleString()}</span>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-lg px-2.5 py-2 flex items-baseline justify-between">
                  <span className="text-[8px] font-mono text-slate-600 uppercase">lives saved</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">-{savedDeaths.toLocaleString()}</span>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 space-y-2.5">
                <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Economic loss</p>
                <div className="flex items-baseline justify-between">
                  <span className="text-[8px] font-mono text-slate-600">Without</span>
                  <span className="text-base font-mono font-bold text-amber-300">{fmtUSD(BASE.economicLoss)}</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[8px] font-mono text-slate-600">With</span>
                  <span className="text-base font-mono font-bold text-slate-300">{fmtUSD(mitLoss)}</span>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-lg px-2.5 py-2 flex items-baseline justify-between">
                  <span className="text-[8px] font-mono text-slate-600 uppercase">recovered</span>
                  <span className="text-sm font-mono font-bold text-emerald-400">-{fmtUSD(savedLoss)}</span>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 space-y-2.5">
                <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Peak temperature</p>
                <div className="flex items-baseline justify-between">
                  <span className="text-[8px] font-mono text-slate-600">Without</span>
                  <span className="text-base font-mono font-bold text-orange-400">{BASE.peakTemp}°C</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[8px] font-mono text-slate-600">With</span>
                  <span className="text-base font-mono font-bold text-slate-300">{mitTemp.toFixed(1)}°C</span>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-lg px-2.5 py-2 flex items-baseline justify-between">
                  <span className="text-[8px] font-mono text-slate-600 uppercase">cooler</span>
                  <span className="text-sm font-mono font-bold text-cyan-400">-{savedTemp.toFixed(2)}°C</span>
                </div>
              </div>

              <div className="bg-slate-900/50 border border-white/5 rounded-xl p-4 space-y-2.5">
                <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Heatwave days</p>
                <div className="flex items-baseline justify-between">
                  <span className="text-[8px] font-mono text-slate-600">Without</span>
                  <span className="text-base font-mono font-bold text-red-400">{BASE.heatwaveDays}d</span>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-[8px] font-mono text-slate-600">With</span>
                  <span className="text-base font-mono font-bold text-slate-300">{mitHW}d</span>
                </div>
                <div className="bg-emerald-950/30 border border-emerald-500/20 rounded-lg px-2.5 py-2 flex items-baseline justify-between">
                  <span className="text-[8px] font-mono text-slate-600 uppercase">fewer days</span>
                  <span className="text-sm font-mono font-bold text-cyan-400">-{BASE.heatwaveDays - mitHW}d</span>
                </div>
              </div>

            </div>

            <div className="bg-emerald-950/20 border border-emerald-500/20 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="shrink-0">
                <p className="text-4xl font-mono font-bold text-emerald-300">{deathPctSaved}%</p>
                <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-1">mortality reduction</p>
              </div>
              <div className="h-px sm:h-10 sm:w-px bg-emerald-500/20 shrink-0" />
              <p className="text-xs text-slate-400 leading-relaxed">
                At +{canopy}% tree cover and +{albedo}% cool roofs, {savedDeaths.toLocaleString()} fewer
                people die from heat in Paris every year by 2050.
                This uses the same calculation as the full engine —
                Gasparrini (2017) mortality model scaled by heatwave reduction.
              </p>
            </div>

            <p className="text-[9px] font-mono text-slate-600 leading-relaxed">
              Formula: Deaths = Base x hwRatio x (1 - cooling x 0.08) where
              cooling = (canopy/100)x1.2 + (albedo/100)x0.8,
              hwRatio = effectiveHW / baseHW.
              Source: Bowler (2010) · Santamouris (2015) · Gasparrini (2017).
              Plus or minus 15% confidence interval applies.
            </p>

          </div>
        </div>

        <div className="w-full bg-black/40 border border-white/5 rounded-2xl p-6 md:p-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-base font-bold text-white mb-1">Run this for your city.</h3>
            <p className="text-xs text-slate-500">
              Real CMIP6 data · Any city on Earth · Full methodology visible
            </p>
          </div>
          <button
            onClick={handleOpenDashboard}
            className="shrink-0 px-8 py-3.5 rounded-xl text-[11px] font-mono font-bold text-white uppercase tracking-[0.2em] bg-gradient-to-r from-indigo-600/80 to-cyan-600/80 border border-indigo-500/30 hover:from-indigo-500 hover:to-cyan-500 hover:scale-105 transition-all"
          >
            Open Dashboard
          </button>
        </div>

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