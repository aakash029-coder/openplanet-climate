'use client';

import { useState, useEffect } from 'react';
import { signIn, signOut, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();
  
  // State to control the sign-in modal
  const [showModal, setShowModal] = useState(false);
  
  // State to control the profile dropdown menu
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // State to silently track usage
  const [simCount, setSimCount] = useState(0);

  // Load the current simulation count from memory when the page loads
  useEffect(() => {
    const count = parseInt(localStorage.getItem('op_sim_count') || '0');
    setSimCount(count);
  }, []);

  // Internal Logic: Allow 10 free simulations, then force auth
  const handleStartSimulation = (e: React.MouseEvent) => {
    e.preventDefault();

    if (session) {
      // If already signed in, go straight to the dashboard/app
      router.push('/dashboard'); 
      return;
    }

    if (simCount < 10) {
      // Add 1 to the count silently and let them proceed as a guest
      const newCount = simCount + 1;
      setSimCount(newCount);
      localStorage.setItem('op_sim_count', newCount.toString());
      router.push('/dashboard'); // Route them to the engine
    } else {
      // 10 times reached: Show the pop-up modal
      setShowModal(true);
    }
  };

  return (
    <div className="flex flex-col items-center w-full min-h-screen">
      
      {/* AUTH POPUP MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md">
          <div className="bg-[#020617] border border-white/20 p-8 rounded-lg shadow-2xl max-w-sm w-full relative flex flex-col items-center mx-4 animate-in fade-in zoom-in duration-300">
            <button 
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
            >
              ✕
            </button>
            <div className="w-12 h-12 border border-white/20 flex items-center justify-center bg-white/5 mb-6 rounded-md">
               <span className="text-white font-mono text-lg font-bold">OP</span>
            </div>
            <h3 className="text-xl font-bold text-white mb-2 tracking-tight">Access Terminal</h3>
            <p className="text-xs text-slate-400 text-center mb-8 font-light leading-relaxed">
              Authenticate to run unlimited spatial simulations and access institutional datasets.
            </p>
            <button
              onClick={() => signIn('google', { callbackUrl: '/' })}
              className="w-full py-3 bg-white text-black hover:bg-slate-200 transition-colors font-mono text-xs uppercase tracking-widest flex items-center justify-center gap-3 rounded-md"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path fill="currentColor" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="currentColor" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="currentColor" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="currentColor" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Sign in with Google
            </button>
          </div>
        </div>
      )}

      {/* 1. GLOBAL NAVIGATION (FIXED) */}
      <nav className="fixed top-0 left-0 w-full flex items-center justify-between px-6 md:px-12 py-4 z-50 bg-black/40 backdrop-blur-md border-b border-white/10 transition-all">
        {/* Left: Logo */}
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-white/20 flex items-center justify-center bg-white/5 backdrop-blur-md rounded-sm">
             <span className="text-white font-mono text-xs font-bold tracking-tighter">OP</span>
          </div>
          <span className="text-white font-mono tracking-[0.3em] text-[10px] md:text-xs uppercase">OpenPlanet</span>
        </div>
        
        {/* Center: Links */}
        <div className="hidden md:flex gap-12 items-center">
          <Link href="/discover" className="text-[10px] font-mono tracking-[0.2em] text-slate-400 hover:text-white transition-colors uppercase">Discover</Link>
          <Link href="/about" className="text-[10px] font-mono tracking-[0.2em] text-slate-400 hover:text-white transition-colors uppercase">About</Link>
          <Link href="#support" className="text-[10px] font-mono tracking-[0.2em] text-slate-400 hover:text-white transition-colors uppercase">Support</Link>
        </div>

        {/* Right: Profile Dropdown OR Sign In Button */}
        <div className="flex items-center relative z-50">
          {session ? (
            // USER IS SIGNED IN - Show the clickable profile dropdown
            <div className="relative">
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center gap-3 px-4 py-2 border border-white/10 rounded-full hover:border-white/30 transition-all bg-white/5"
              >
                {/* User Avatar */}
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center overflow-hidden">
                  {session?.user?.image ? (
                    <img src={session.user.image} alt="User" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-emerald-400 font-bold text-[10px]">
                      {session?.user?.name?.charAt(0).toUpperCase() || 'U'}
                    </span>
                  )}
                </div>
                
                {/* User Name */}
                <span className="text-[10px] font-mono text-white tracking-widest uppercase">
                  {session?.user?.name?.split(' ')[0] || "USER"}
                </span>

                {/* Dropdown Arrow */}
                <svg 
                  className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* The Dropdown Menu */}
              {isDropdownOpen && (
                <div className="absolute top-14 right-0 min-w-[160px] bg-black/90 backdrop-blur-xl border border-white/10 rounded-lg shadow-2xl flex flex-col p-2 animate-in fade-in slide-in-from-top-2 duration-200">
                  <div className="px-3 py-2 border-b border-white/10 mb-1">
                    <span className="block text-[9px] text-slate-500 font-mono uppercase tracking-widest">Signed in as</span>
                    <span className="block text-[10px] text-white font-mono truncate">{session?.user?.email}</span>
                  </div>
                  
                  {/* Link to Dashboard directly from dropdown */}
                  <Link 
                    href="/dashboard"
                    className="w-full text-left px-3 py-2 text-[10px] font-mono text-slate-300 hover:text-white hover:bg-white/10 rounded transition-colors uppercase tracking-widest mb-1 mt-1"
                  >
                    Open Terminal
                  </Link>
                  
                  {/* Sign Out Button */}
                  <button 
                    onClick={() => signOut({ callbackUrl: '/' })}
                    className="w-full text-left px-3 py-2 text-[10px] font-mono text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded transition-colors uppercase tracking-widest flex items-center gap-2"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            // USER IS NOT SIGNED IN - Show Sign In button
            <button 
              onClick={() => setShowModal(true)}
              className="px-6 py-2 rounded-md border border-white/20 bg-white/5 hover:bg-white hover:text-black transition-all text-[10px] font-mono tracking-widest uppercase text-white"
            >
              Sign In
            </button>
          )}
        </div>
      </nav>

      {/* MAIN CONTENT WRAPPER */}
      <main className="w-full max-w-7xl px-6 flex flex-col items-center pb-12 gap-32">
        
        {/* 2. THE HERO SECTION */}
        <section className="w-full min-h-screen flex flex-col items-center justify-center text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tighter mb-8 leading-tight drop-shadow-2xl">
            Project & Mitigate <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-slate-200 to-slate-500">
              Climate Risks.
            </span>
          </h1>
          
          <p className="text-base md:text-lg text-slate-300 font-light tracking-wide mb-12 max-w-3xl mx-auto leading-relaxed">
            High-resolution heat-related mortality, economic impact, and extreme weather projections. Powered by WHO-grade epidemiology and NASA geospatial data pipelines.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={handleStartSimulation}
              className="px-10 py-4 bg-white text-black font-mono text-xs tracking-[0.2em] uppercase hover:bg-slate-200 transition-all border border-transparent hover:border-white shadow-[0_0_30px_rgba(255,255,255,0.15)] rounded-md"
            >
              Let's Start
            </button>
          </div>
        </section>

        {/* 3. THE PROBLEM STATEMENT */}
        <section id="discover" className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center bg-black/40 backdrop-blur-md border border-white/10 p-8 md:p-16 rounded-xl">
          <div className="lg:col-span-6 flex flex-col gap-6">
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight">
              Macro-level climate models fail at the city block level.
            </h2>
            <p className="text-slate-300 font-light leading-relaxed">
              Governments and asset managers are blind to localized climate threats. Global temperature averages do not predict which specific neighborhoods will experience fatal Urban Heat Islands, or how much labor productivity will be lost.
            </p>
            <p className="text-slate-300 font-light leading-relaxed">
              OpenPlanet bridges this gap by fusing IPCC pathways with high-density spatial computing, transforming abstract climate science into actionable, hyper-local intelligence.
            </p>
          </div>
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 p-6 hover:bg-white/10 transition-colors rounded-lg">
              <h3 className="text-white font-bold text-sm mb-3">H3 Spatial Indexing</h3>
              <p className="text-xs text-slate-400 font-light">Data mapped to ~0.1 km² hexagonal grids for precise risk identification.</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 hover:bg-white/10 transition-colors rounded-lg">
              <h3 className="text-white font-bold text-sm mb-3">Asset Exposure</h3>
              <p className="text-xs text-slate-400 font-light">Calculate GDP and labor losses correlated to SSP emission pathways.</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 hover:bg-white/10 transition-colors rounded-lg">
              <h3 className="text-white font-bold text-sm mb-3">WHO-GBD Parameters</h3>
              <p className="text-xs text-slate-400 font-light">Peer-reviewed epidemiology utilizing local Minimum Mortality Temperatures.</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 hover:bg-white/10 transition-colors rounded-lg">
              <h3 className="text-white font-bold text-sm mb-3">Monte Carlo Math</h3>
              <p className="text-xs text-slate-400 font-light">1,000-draw simulations outputting strict 95% Confidence Intervals.</p>
            </div>
          </div>
        </section>

        {/* 4. THE CAPABILITIES GRID */}
        <section id="about" className="w-full flex flex-col items-center">
          <div className="text-center mb-16">
            <h2 className="text-[10px] font-mono text-blue-400 tracking-[0.3em] uppercase mb-4">Advanced Climate Analytics</h2>
            <h3 className="text-2xl md:text-3xl font-bold text-white tracking-wide">For Informed Decisions</h3>
            <p className="text-slate-400 font-light mt-4 max-w-2xl text-sm">Built on peer-reviewed epidemiology, global satellite data, and institutional-grade spatial computing.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {[
              "High-Resolution Heat Hazard Mapping",
              "Actionable 'What-If' Scenarios",
              "Climate & Economic Projections",
              "WHO-GBD Epidemiology Engine",
              "Monte Carlo Uncertainty (95% CI)",
              "Institutional Grade Precision"
            ].map((title, idx) => (
              <div key={idx} className="bg-white/5 hover:bg-white/10 backdrop-blur-md border border-white/10 p-8 transition-all duration-300 group rounded-xl">
                <div className="text-blue-400/50 font-mono text-xs mb-6 group-hover:text-blue-400 transition-colors">
                  [ 0{idx + 1} ]
                </div>
                <h4 className="text-base font-bold text-slate-100 tracking-wide">{title}</h4>
              </div>
            ))}
          </div>
        </section>

        {/* 5. OPERATIONAL WORKFLOW */}
        <section className="w-full flex flex-col items-center">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-white tracking-wide">How It Works</h3>
            <p className="text-slate-400 font-light mt-4 text-sm">Three steps from satellite data to actionable health risk intelligence.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full relative">
            <div className="hidden md:block absolute top-1/2 left-0 w-full h-[1px] bg-white/10 -z-10"></div>
            {[
              { step: "Step 1", title: "Map & Model", sub: "Climate Risks", desc: "Select global coordinates and ingest historical climatic baselines via glowing globe visual mapping.", color: "from-blue-500/20 to-transparent" },
              { step: "Step 2", title: "Simulate", sub: "'What-If' Scenarios", desc: "Apply targeted interventions and visualize colored trajectory graphs of mitigation outcomes.", color: "from-emerald-500/20 to-transparent" },
              { step: "Step 3", title: "Explore", sub: "& Compare Results", desc: "Data Metrics Analysis: Quantify 2.1K deaths, 56 HW Days, 43°C Max Temp deterministic outputs.", color: "from-red-500/20 to-transparent" }
            ].map((phase, idx) => (
              <div key={idx} className="bg-black/60 backdrop-blur-xl border border-white/10 p-8 flex flex-col relative overflow-hidden rounded-xl">
                <div className={`absolute top-0 left-0 w-full h-24 bg-gradient-to-b ${phase.color} opacity-50`}></div>
                <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mb-6 relative z-10">
                  <span className="text-white font-mono text-xs">{idx + 1}</span>
                </div>
                <h4 className="text-xl font-bold text-white mb-1 relative z-10">{phase.title}</h4>
                <h5 className="text-sm font-mono text-slate-400 mb-4 uppercase tracking-wider relative z-10">{phase.sub}</h5>
                <p className="text-sm text-slate-400 font-light relative z-10">{phase.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 6. FINAL CALL TO ACTION */}
        <section className="w-full flex flex-col items-center text-center bg-gradient-to-b from-transparent to-blue-900/10 border border-white/10 py-24 backdrop-blur-sm rounded-xl">
          <h2 className="text-[10px] font-mono text-blue-400 tracking-[0.3em] uppercase mb-4">Join The Mission</h2>
          <h3 className="text-3xl md:text-5xl font-bold text-white mb-6 tracking-tight">Get Started Today</h3>
          <p className="text-slate-300 font-light mb-10 max-w-xl mx-auto">Analyze, predict, and mitigate climate risks with OpenPlanet.</p>
          <button 
            onClick={handleStartSimulation}
            className="px-10 py-4 bg-white text-black font-mono tracking-[0.2em] text-xs uppercase hover:bg-slate-200 transition-colors flex items-center gap-2 rounded-md"
          >
            Let's Start <span>&rarr;</span>
          </button>
        </section>
      </main>

      {/* 7. FOOTER */}
      <footer className="w-full border-t border-white/10 bg-black/80 backdrop-blur-md py-8 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between z-40 relative">
        <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4 md:mb-0">
          &copy; 2026 OPENPLANET. All Rights Reserved.
        </p>
        <div className="flex gap-6">
          <Link href="#" className="text-[10px] font-mono text-slate-500 hover:text-white uppercase tracking-widest transition-colors">Privacy Policy</Link>
          <Link href="#" className="text-[10px] font-mono text-slate-500 hover:text-white uppercase tracking-widest transition-colors">Terms of Service</Link>
          <Link href="#support" className="text-[10px] font-mono text-slate-500 hover:text-white uppercase tracking-widest transition-colors">Support</Link>
        </div>
      </footer>

    </div>
  );
}