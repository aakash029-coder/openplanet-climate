'use client';

import { useSession, signIn } from 'next-auth/react'; // 👈 signIn yahan add kiya hai
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();

  // Internal Logic: Direct entry to dashboard or trigger direct login
  const handleStartSimulation = (e: React.MouseEvent) => {
    e.preventDefault();
    if (session) {
      router.push('/dashboard'); 
    } else {
      // 👇 Full-screen page ke bajaye seedha Google popup/login trigger karega
      signIn('google', { callbackUrl: '/dashboard' });
    }
  };

  return (
    <div className="flex flex-col items-center w-full min-h-screen">
      
      {/* MAIN CONTENT WRAPPER */}
      <main className="w-full max-w-7xl px-6 flex flex-col items-center pb-24 gap-32">
        
        {/* 1. THE HERO SECTION */}
        <section className="w-full min-h-[80vh] flex flex-col items-center justify-center text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tighter mb-8 leading-tight drop-shadow-2xl">
            Project & Mitigate <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-300 to-slate-500">
              Climate Risks
            </span>
          </h1>
          
          <p className="text-base md:text-lg text-slate-300 font-light tracking-wide mb-12 max-w-3xl mx-auto leading-relaxed uppercase tracking-[0.1em]">
            High-resolution heat-related mortality, economic impact, and extreme weather projections. Powered by WHO-grade epidemiology and NASA geospatial data pipelines.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={handleStartSimulation}
              className="px-10 py-4 bg-white text-black font-mono text-xs tracking-[0.2em] uppercase transition-all hover:bg-slate-200 rounded-sm flex items-center justify-center shadow-[0_0_20px_rgba(255,255,255,0.2)]"
            >
              let's start
            </button>
          </div>
        </section>

        {/* 2. THE PROBLEM STATEMENT */}
        <section id="discover" className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center bg-black/40 backdrop-blur-md border border-white/10 p-8 md:p-16 rounded-xl">
          <div className="lg:col-span-6 flex flex-col gap-6">
            <h2 className="text-3xl md:text-5xl font-bold text-white tracking-tight leading-tight uppercase">
              Localized <span className="text-indigo-400">Intelligence</span> vs Global Models
            </h2>
            <p className="text-slate-300 font-light leading-relaxed text-sm">
              Governments and asset managers are blind to localized climate threats. Global temperature averages do not predict which specific neighborhoods will experience fatal Urban Heat Islands, or how much labor productivity will be lost.
            </p>
            <p className="text-slate-300 font-light leading-relaxed text-sm">
              OpenPlanet bridges this gap by fusing IPCC pathways with high-density spatial computing, transforming abstract climate science into actionable, hyper-local intelligence.
            </p>
          </div>
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white/5 border border-white/10 p-6 hover:bg-white/10 transition-colors rounded-lg">
              <h3 className="text-white font-bold text-[10px] uppercase tracking-widest mb-3">H3 Spatial Indexing</h3>
              <p className="text-[10px] text-slate-400 font-light uppercase">Data mapped to ~0.1 km² hexagonal grids for precise risk identification.</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 hover:bg-white/10 transition-colors rounded-lg">
              <h3 className="text-white font-bold text-[10px] uppercase tracking-widest mb-3">Asset Exposure</h3>
              <p className="text-[10px] text-slate-400 font-light uppercase">Calculate GDP and labor losses correlated to SSP emission pathways.</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 hover:bg-white/10 transition-colors rounded-lg">
              <h3 className="text-white font-bold text-[10px] uppercase tracking-widest mb-3">WHO-GBD Parameters</h3>
              <p className="text-[10px] text-slate-400 font-light uppercase">Peer-reviewed epidemiology utilizing local Minimum Mortality Temperatures.</p>
            </div>
            <div className="bg-white/5 border border-white/10 p-6 hover:bg-white/10 transition-colors rounded-lg">
              <h3 className="text-white font-bold text-[10px] uppercase tracking-widest mb-3">Monte Carlo Math</h3>
              <p className="text-[10px] text-slate-400 font-light uppercase">1,000-draw simulations outputting strict 95% Confidence Intervals.</p>
            </div>
          </div>
        </section>

        {/* 3. THE CAPABILITIES GRID */}
        <section id="about" className="w-full flex flex-col items-center">
          <div className="text-center mb-16">
            <h3 className="text-2xl md:text-3xl font-bold text-white tracking-[0.2em] uppercase">Decision Infrastructure</h3>
            <p className="text-slate-400 font-light mt-4 max-w-2xl text-[10px] uppercase tracking-widest">Built on peer-reviewed epidemiology, global satellite data, and institutional-grade spatial computing.</p>
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
              <div key={idx} className="bg-black/40 backdrop-blur-md border border-white/5 p-8 transition-all duration-300 group rounded-xl hover:border-indigo-500/50">
                <h4 className="text-[10px] font-bold text-slate-100 tracking-[0.2em] uppercase">{title}</h4>
              </div>
            ))}
          </div>
        </section>

        {/* 4. OPERATIONAL WORKFLOW */}
        <section className="w-full flex flex-col items-center">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-white tracking-[0.2em] uppercase">Protocol Workflow</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
            {[
              { step: "01", title: "Map & Model", desc: "Select global coordinates and ingest historical climatic baselines via glowing globe visual mapping." },
              { step: "02", title: "Simulate", desc: "Apply targeted interventions and visualize colored trajectory graphs of mitigation outcomes." },
              { step: "03", title: "Audit", desc: "Quantify mortality risks and economic decay through deterministic AI-driven audit reports." }
            ].map((phase, idx) => (
              <div key={idx} className="bg-black/60 backdrop-blur-xl border border-white/5 p-8 flex flex-col rounded-xl border-l-2 border-l-indigo-500">
                <span className="text-indigo-500 font-mono text-xs mb-4">PHASE_{phase.step}</span>
                <h4 className="text-sm font-bold text-white mb-4 uppercase tracking-widest">{phase.title}</h4>
                <p className="text-[10px] text-slate-400 font-light uppercase tracking-wider leading-relaxed">{phase.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 5. FINAL CALL TO ACTION */}
        <section className="w-full flex flex-col items-center text-center bg-white/[0.02] border border-white/5 py-24 backdrop-blur-sm rounded-xl overflow-hidden relative">
          <div className="absolute inset-0 bg-indigo-500/5 blur-[100px] pointer-events-none"></div>
          <h2 className="text-[10px] font-mono text-indigo-400 tracking-[0.5em] uppercase mb-4">Strategic Uplink</h2>
          <h3 className="text-3xl md:text-5xl font-bold text-white mb-10 tracking-widest uppercase">Start Intelligence Audit</h3>
          <button 
            onClick={handleStartSimulation}
            className="px-12 py-4 bg-white text-black font-mono font-bold text-xs hover:bg-slate-200 transition-all uppercase tracking-[0.3em] rounded-sm"
          >
            let's start
          </button>
        </section>
      </main>
    </div>
  );
}