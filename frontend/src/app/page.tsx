'use client';

import { useState } from 'react';
import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Jab user "Let's Start" par click kare
  const handleStartSimulation = (e: React.MouseEvent) => {
    e.preventDefault();
    if (session) {
      router.push('/dashboard'); 
    } else {
      setShowAuthModal(true); // Login nahi hai toh pop-up dikhao
    }
  };

  return (
    <div className="flex flex-col items-center w-full min-h-screen relative">
      <main className="w-full max-w-7xl px-6 flex flex-col items-center pb-24 gap-32">
        
        {/* 1. THE HERO SECTION */}
        <section className="w-full min-h-[80vh] flex flex-col items-center justify-center text-center relative z-10">
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tighter mb-8 leading-tight drop-shadow-2xl">
            {/* 👇 STYLISH SERIF FONT FOR UPPER TEXT */}
            <span className="font-serif font-medium text-slate-200 tracking-normal drop-shadow-md">
              Project & Mitigate
            </span> <br />
            {/* MODERN GLOSSY TEXT FOR LOWER TEXT */}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 drop-shadow-[0_0_30px_rgba(34,211,238,0.4)]">
              Climate Risks
            </span>
          </h1>
          
          <p className="text-base md:text-lg text-slate-400 font-light tracking-wide mb-12 max-w-3xl mx-auto leading-relaxed uppercase tracking-[0.1em]">
            High-resolution heat-related mortality, economic impact, and extreme weather projections. Powered by WHO-grade epidemiology and NASA geospatial data pipelines.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* DEEP BLACK GLOSSY BUTTON WITH CYAN BORDER */}
            <button 
              onClick={handleStartSimulation}
              className="relative px-12 py-4 rounded-full text-xs font-mono text-cyan-300 tracking-[0.2em] uppercase transition-all overflow-hidden group border border-cyan-500/30 bg-black/50 backdrop-blur-md shadow-[0_0_20px_rgba(34,211,238,0.1)] hover:shadow-[0_0_40px_rgba(34,211,238,0.4)] hover:scale-105 hover:border-cyan-400"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative z-10 font-bold">Let's Start</span>
            </button>
          </div>
        </section>

        {/* 2. THE PROBLEM STATEMENT (DARK GLASS CARD) */}
        <section id="discover" className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center bg-black/40 backdrop-blur-2xl border border-white/5 p-8 md:p-16 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.8)] hover:border-cyan-500/20 transition-colors">
          <div className="lg:col-span-6 flex flex-col gap-6">
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight uppercase">
              Localized <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Intelligence</span> vs Global Models
            </h2>
            <p className="text-slate-400 font-light leading-relaxed text-sm">
              Governments and asset managers are blind to localized climate threats. Global temperature averages do not predict which specific neighborhoods will experience fatal Urban Heat Islands.
            </p>
            <p className="text-slate-400 font-light leading-relaxed text-sm">
              OpenPlanet bridges this gap by fusing IPCC pathways with high-density spatial computing, transforming abstract climate science into actionable, hyper-local intelligence.
            </p>
          </div>
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { title: "H3 Spatial Indexing", desc: "Data mapped to ~0.1 km² hexagonal grids." },
              { title: "Asset Exposure", desc: "Calculate GDP losses correlated to pathways." },
              { title: "WHO-GBD Parameters", desc: "Epidemiology utilizing local Mortality Temps." },
              { title: "Monte Carlo Math", desc: "1,000-draw simulations with 95% Confidence." }
            ].map((item, idx) => (
              <div key={idx} className="bg-white/[0.02] border border-white/5 p-6 rounded-2xl hover:bg-black/60 hover:border-cyan-500/40 hover:shadow-[0_0_20px_rgba(34,211,238,0.1)] transition-all">
                <h3 className="text-amber-100/90 font-serif text-sm tracking-wide mb-2">{item.title}</h3>
                <p className="text-[10px] text-slate-500 font-light uppercase tracking-wider">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. THE CAPABILITIES GRID */}
        <section id="about" className="w-full flex flex-col items-center">
          <div className="text-center mb-16">
            <h3 className="text-2xl md:text-3xl font-serif text-slate-200 tracking-wide">Decision Infrastructure</h3>
            <p className="text-cyan-500/80 font-mono mt-4 max-w-2xl text-[10px] uppercase tracking-widest">Built on peer-reviewed epidemiology & spatial computing.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {[
              "High-Resolution Hazard Mapping",
              "Actionable 'What-If' Scenarios",
              "Climate & Economic Projections",
              "WHO-GBD Epidemiology Engine",
              "Monte Carlo Uncertainty (95% CI)",
              "Institutional Grade Precision"
            ].map((title, idx) => (
              <div key={idx} className="bg-black/40 backdrop-blur-xl border border-white/5 p-8 rounded-2xl hover:border-cyan-500/30 hover:bg-black/80 hover:shadow-[0_0_30px_rgba(34,211,238,0.1)] transition-all duration-300 group cursor-default">
                <h4 className="text-[10px] font-bold text-slate-400 group-hover:text-cyan-300 tracking-[0.2em] uppercase transition-colors">{title}</h4>
              </div>
            ))}
          </div>
        </section>

        {/* 4. FINAL CALL TO ACTION */}
        <section className="w-full flex flex-col items-center text-center bg-black/50 border border-white/5 py-24 backdrop-blur-2xl rounded-3xl overflow-hidden relative shadow-[0_0_50px_rgba(0,0,0,0.8)]">
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-900/10 to-transparent pointer-events-none"></div>
          <h3 className="text-3xl md:text-5xl font-serif text-slate-200 mb-10 tracking-wide drop-shadow-lg">Start Intelligence Audit</h3>
          
          <button 
            onClick={handleStartSimulation}
            className="relative px-12 py-4 rounded-full text-xs font-mono text-cyan-300 tracking-[0.2em] uppercase transition-all overflow-hidden group border border-cyan-500/30 bg-black/80 backdrop-blur-md shadow-[0_0_20px_rgba(34,211,238,0.1)] hover:shadow-[0_0_40px_rgba(34,211,238,0.4)] hover:scale-105 hover:border-cyan-400"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-900/20 to-blue-900/20 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <span className="relative z-10 font-bold">Let's Start</span>
          </button>
        </section>

      </main>

      {/* ── PREMIUM AUTH POP-UP MODAL ── */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          
          <div className="relative w-full max-w-md bg-[#050b14]/90 border border-cyan-500/30 rounded-2xl shadow-[0_0_50px_rgba(34,211,238,0.15)] p-8 overflow-hidden animate-in zoom-in-95 duration-300 backdrop-blur-xl">
            
            {/* Background Glow inside modal */}
            <div className="absolute -top-20 -left-20 w-48 h-48 bg-cyan-500/20 blur-[80px] pointer-events-none"></div>

            {/* Top Right 'X' Close Button */}
            <button
              onClick={() => setShowAuthModal(false)}
              className="absolute top-5 right-5 text-slate-500 hover:text-cyan-400 transition-colors z-20"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>

            <div className="relative z-10">
              <div className="flex items-center gap-3 mb-4">
                <span className="w-2 h-2 bg-cyan-400 rounded-sm animate-pulse shadow-[0_0_8px_#22d3ee]"></span>
                <h2 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-[0.3em]">
                  Authentication Recommended
                </h2>
              </div>
              
              <p className="text-[11px] font-mono text-slate-400 leading-relaxed mb-8">
                Sign in to save your telemetry reports and access historical risk projections. You can also proceed with limited guest access.
              </p>

              <div className="space-y-4">
                {/* Sign In Button */}
                <button
                  onClick={() => signIn('google', { callbackUrl: '/dashboard' })}
                  className="w-full relative px-6 py-4 bg-cyan-950/40 border border-cyan-500/50 text-cyan-300 font-mono text-[10px] font-bold uppercase tracking-[0.2em] rounded-lg hover:bg-cyan-900/60 hover:text-white transition-all shadow-[0_0_20px_rgba(34,211,238,0.1)] group overflow-hidden"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/20 via-blue-500/20 to-cyan-600/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <span className="relative z-10">Sign In with Google</span>
                </button>

                {/* Divider */}
                <div className="flex items-center gap-4 my-4">
                  <div className="flex-1 h-[1px] bg-cyan-500/10"></div>
                  <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">OR</span>
                  <div className="flex-1 h-[1px] bg-cyan-500/10"></div>
                </div>

                {/* Guest Access Button */}
                <button
                  onClick={() => router.push('/dashboard')}
                  className="w-full px-6 py-4 bg-transparent border border-white/10 text-slate-400 font-mono text-[10px] font-bold uppercase tracking-[0.2em] rounded-lg hover:border-white/30 hover:text-white transition-all"
                >
                  Continue as Guest ➔
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}