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
    <div className="flex flex-col items-center w-full min-h-screen relative">
      <main className="w-full max-w-7xl px-6 flex flex-col items-center pb-24 gap-32">
        
        {/* 1. THE HERO SECTION */}
        <section className="w-full min-h-[80vh] flex flex-col items-center justify-center text-center relative z-10">
          <h1 className="text-5xl md:text-7xl font-extrabold text-white tracking-tighter mb-8 leading-tight drop-shadow-2xl">
            Project & Mitigate <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-cyan-300 to-indigo-400 drop-shadow-[0_0_30px_rgba(34,211,238,0.4)]">
              Climate Risks
            </span>
          </h1>
          <p className="text-base md:text-lg text-slate-400 font-light tracking-wide mb-12 max-w-3xl mx-auto leading-relaxed uppercase tracking-[0.1em]">
            High-resolution heat-related mortality, economic impact, and extreme weather projections. Powered by WHO-grade epidemiology and NASA geospatial data pipelines.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {/* 👈 Text changed to Let's Start */}
            <button 
              onClick={handleStartSimulation}
              className="relative px-12 py-4 rounded-full text-xs font-mono text-white tracking-[0.2em] uppercase transition-all overflow-hidden group border border-white/20 shadow-[0_0_30px_rgba(59,130,246,0.4)] hover:shadow-[0_0_50px_rgba(34,211,238,0.6)] hover:scale-105"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-700 via-cyan-600 to-indigo-700 opacity-90 group-hover:opacity-100 transition-opacity"></div>
              <span className="relative z-10 font-bold">Let's Start</span>
            </button>
          </div>
        </section>

        {/* 2. THE PROBLEM STATEMENT */}
        <section id="discover" className="w-full grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center bg-white/[0.02] backdrop-blur-2xl border border-white/10 p-8 md:p-16 rounded-3xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] hover:border-cyan-500/30 transition-colors">
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
              <div key={idx} className="bg-white/[0.03] border border-white/10 p-6 rounded-2xl hover:bg-blue-900/20 hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(34,211,238,0.15)] transition-all">
                <h3 className="text-cyan-300 font-bold text-[10px] uppercase tracking-widest mb-3">{item.title}</h3>
                <p className="text-[10px] text-slate-500 font-light uppercase">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* 3. THE CAPABILITIES GRID */}
        <section id="about" className="w-full flex flex-col items-center">
          <div className="text-center mb-16">
            <h3 className="text-2xl md:text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400 tracking-[0.2em] uppercase">Decision Infrastructure</h3>
            <p className="text-blue-400/80 font-mono mt-4 max-w-2xl text-[10px] uppercase tracking-widest">Built on peer-reviewed epidemiology & spatial computing.</p>
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
              <div key={idx} className="bg-white/[0.02] backdrop-blur-xl border border-white/10 p-8 rounded-2xl hover:border-cyan-500/40 hover:bg-blue-900/10 hover:shadow-[0_0_30px_rgba(59,130,246,0.15)] transition-all duration-300 group cursor-default">
                <h4 className="text-[10px] font-bold text-slate-300 group-hover:text-cyan-300 tracking-[0.2em] uppercase transition-colors">{title}</h4>
              </div>
            ))}
          </div>
        </section>

        {/* 4. FINAL CALL TO ACTION */}
        <section className="w-full flex flex-col items-center text-center bg-white/[0.02] border border-blue-500/20 py-24 backdrop-blur-2xl rounded-3xl overflow-hidden relative shadow-[0_0_50px_rgba(59,130,246,0.1)]">
          <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent pointer-events-none"></div>
          <h3 className="text-3xl md:text-5xl font-bold text-white mb-10 tracking-widest uppercase">Start Intelligence Audit</h3>
          
          {/* 👈 Text changed to Let's Start */}
          <button 
            onClick={handleStartSimulation}
            className="px-12 py-4 bg-white text-black font-mono font-bold text-xs hover:bg-cyan-50 hover:shadow-[0_0_40px_rgba(255,255,255,0.6)] transition-all uppercase tracking-[0.3em] rounded-full"
          >
            Let's Start
          </button>
        </section>

      </main>
    </div>
  );
}