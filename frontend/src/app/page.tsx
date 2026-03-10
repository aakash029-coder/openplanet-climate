'use client';

import { useSession, signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function HomePage() {
  const { data: session } = useSession();
  const router = useRouter();

  const handleStartSimulation = (e: React.MouseEvent) => {
    e.preventDefault();
    if (session) {
      router.push('/dashboard'); 
    } else {
      signIn('google', { callbackUrl: '/dashboard' });
    }
  };

  return (
    <div className="flex flex-col items-center w-full min-h-screen">
      <main className="w-full max-w-7xl px-6 flex flex-col items-center pb-24 gap-32">
        
        {/* HERO SECTION */}
        <section className="w-full min-h-[80vh] flex flex-col items-center justify-center text-center">
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tighter mb-8 leading-tight drop-shadow-sm">
            Project & Mitigate <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-indigo-500 to-slate-600">
              Climate Risks
            </span>
          </h1>
          <p className="text-base md:text-lg text-slate-600 font-light tracking-wide mb-12 max-w-3xl mx-auto leading-relaxed uppercase tracking-[0.1em]">
            High-resolution heat-related mortality, economic impact, and extreme weather projections. Powered by WHO-grade epidemiology and NASA geospatial data pipelines.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={handleStartSimulation}
              className="px-10 py-4 bg-indigo-600 text-white font-mono text-xs tracking-[0.2em] uppercase transition-all hover:bg-indigo-700 rounded-sm flex items-center justify-center shadow-lg shadow-indigo-500/30"
            >
              let's start
            </button>
          </div>
        </section>

        {/* PROBLEM STATEMENT */}
        <section id="discover" className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center bg-white/70 backdrop-blur-md border border-slate-200 p-8 md:p-16 rounded-xl shadow-sm">
          <div className="lg:col-span-6 flex flex-col gap-6">
            <h2 className="text-3xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight uppercase">
              Localized <span className="text-indigo-600">Intelligence</span> vs Global Models
            </h2>
            <p className="text-slate-600 font-light leading-relaxed text-sm">
              Governments and asset managers are blind to localized climate threats. Global temperature averages do not predict which specific neighborhoods will experience fatal Urban Heat Islands, or how much labor productivity will be lost.
            </p>
            <p className="text-slate-600 font-light leading-relaxed text-sm">
              OpenPlanet bridges this gap by fusing IPCC pathways with high-density spatial computing, transforming abstract climate science into actionable, hyper-local intelligence.
            </p>
          </div>
          <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all rounded-lg">
              <h3 className="text-slate-800 font-bold text-[10px] uppercase tracking-widest mb-3">H3 Spatial Indexing</h3>
              <p className="text-[10px] text-slate-500 font-light uppercase">Data mapped to ~0.1 km² hexagonal grids for precise risk identification.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all rounded-lg">
              <h3 className="text-slate-800 font-bold text-[10px] uppercase tracking-widest mb-3">Asset Exposure</h3>
              <p className="text-[10px] text-slate-500 font-light uppercase">Calculate GDP and labor losses correlated to SSP emission pathways.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all rounded-lg">
              <h3 className="text-slate-800 font-bold text-[10px] uppercase tracking-widest mb-3">WHO-GBD Parameters</h3>
              <p className="text-[10px] text-slate-500 font-light uppercase">Peer-reviewed epidemiology utilizing local Minimum Mortality Temperatures.</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-6 hover:border-indigo-300 hover:shadow-md transition-all rounded-lg">
              <h3 className="text-slate-800 font-bold text-[10px] uppercase tracking-widest mb-3">Monte Carlo Math</h3>
              <p className="text-[10px] text-slate-500 font-light uppercase">1,000-draw simulations outputting strict 95% Confidence Intervals.</p>
            </div>
          </div>
        </section>

        {/* CAPABILITIES */}
        <section id="about" className="w-full flex flex-col items-center">
          <div className="text-center mb-16">
            <h3 className="text-2xl md:text-3xl font-bold text-slate-900 tracking-[0.2em] uppercase">Decision Infrastructure</h3>
            <p className="text-slate-500 font-light mt-4 max-w-2xl text-[10px] uppercase tracking-widest">Built on peer-reviewed epidemiology, global satellite data, and institutional-grade spatial computing.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
            {["High-Resolution Hazard Mapping", "Actionable 'What-If' Scenarios", "Climate & Economic Projections", "WHO-GBD Epidemiology Engine", "Monte Carlo Uncertainty (95% CI)", "Institutional Grade Precision"].map((title, idx) => (
              <div key={idx} className="bg-white/80 backdrop-blur-md border border-slate-200 p-8 transition-all duration-300 group rounded-xl hover:border-indigo-400 hover:shadow-lg shadow-sm">
                <h4 className="text-[10px] font-bold text-slate-800 tracking-[0.2em] uppercase">{title}</h4>
              </div>
            ))}
          </div>
        </section>

        {/* WORKFLOW */}
        <section className="w-full flex flex-col items-center">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-slate-900 tracking-[0.2em] uppercase">Protocol Workflow</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
            {[
              { step: "01", title: "Map & Model", desc: "Select global coordinates and ingest historical climatic baselines via glowing globe visual mapping." },
              { step: "02", title: "Simulate", desc: "Apply targeted interventions and visualize colored trajectory graphs of mitigation outcomes." },
              { step: "03", title: "Audit", desc: "Quantify mortality risks and economic decay through deterministic AI-driven audit reports." }
            ].map((phase, idx) => (
              <div key={idx} className="bg-white/90 backdrop-blur-xl border border-slate-200 p-8 flex flex-col rounded-xl border-l-4 border-l-indigo-500 shadow-sm">
                <span className="text-indigo-600 font-mono text-xs mb-4">PHASE_{phase.step}</span>
                <h4 className="text-sm font-bold text-slate-900 mb-4 uppercase tracking-widest">{phase.title}</h4>
                <p className="text-[10px] text-slate-600 font-light uppercase tracking-wider leading-relaxed">{phase.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CALL TO ACTION */}
        <section className="w-full flex flex-col items-center text-center bg-indigo-50 border border-indigo-100 py-24 backdrop-blur-sm rounded-xl overflow-hidden relative shadow-sm">
          <div className="absolute inset-0 bg-indigo-500/10 blur-[100px] pointer-events-none"></div>
          <h2 className="text-[10px] font-mono text-indigo-600 tracking-[0.5em] uppercase mb-4">Strategic Uplink</h2>
          <h3 className="text-3xl md:text-5xl font-bold text-slate-900 mb-10 tracking-widest uppercase">Start Intelligence Audit</h3>
          <button 
            onClick={handleStartSimulation}
            className="px-12 py-4 bg-indigo-600 text-white font-mono font-bold text-xs hover:bg-indigo-700 transition-all uppercase tracking-[0.3em] rounded-sm shadow-lg shadow-indigo-500/30"
          >
            let's start
          </button>
        </section>
      </main>
    </div>
  );
}