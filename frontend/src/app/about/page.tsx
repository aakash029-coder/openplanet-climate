import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="flex flex-col w-full min-h-screen font-mono selection:bg-indigo-500/30">
      
      {/* 1. RIGID HEADER */}

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-grow w-full max-w-[1400px] mx-auto px-6 pt-16 pb-16 flex flex-col gap-16 animate-in fade-in slide-in-from-bottom-4 duration-1000">
        
        {/* HERO INTRO */}
        <div className="w-full text-center mb-8 relative">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-500/10 blur-[100px] pointer-events-none"></div>
          <h1 className="text-3xl md:text-5xl font-bold text-white uppercase tracking-[0.2em] mb-6 drop-shadow-lg">About <span className="text-cyan-400">OpenPlanet</span></h1>
          <h2 className="text-sm md:text-lg font-bold text-slate-400 tracking-[0.3em] uppercase mb-8">Translating Planetary Physics into Localized Survival.</h2>
          <p className="text-xs text-slate-300 font-light max-w-3xl mx-auto leading-loose tracking-wide uppercase">
            OpenPlanet is a globally scalable climate intelligence engine. We bridge the critical gap between macro-level atmospheric science and block-level human vulnerability.
          </p>
        </div>

        {/* 2x2 GLASSMORPHIC GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
          
          {/* CARD 1: The Catalyst */}
          <div className="lg:col-span-6 bg-[#050b14]/80 backdrop-blur-xl border border-white/10 p-8 md:p-10 rounded-2xl shadow-2xl flex flex-col hover:border-cyan-500/30 transition-colors group">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full group-hover:animate-ping"></div>
              <h3 className="text-[10px] text-red-400 tracking-[0.4em] uppercase font-bold">The Catalyst</h3>
            </div>
            <h4 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">The Cost of the Data Gap</h4>
            <div className="text-xs text-slate-300 font-light leading-loose space-y-4 tracking-wide">
              <p>
                In 2021 and 2022, unprecedented "Heat Domes" across North America and Europe claimed tens of thousands of lives. In these tragedies, a glaring systemic failure was exposed: The disaster was not a failure of weather forecasting; it was a failure of spatial data translation.
              </p>
              <p>
                National meteorological agencies accurately forecasted the extreme temperatures days in advance. Yet, local governments and emergency responders were caught blind. They knew a region would be hot, but they lacked the localized epidemiological data to pinpoint exactly which specific neighborhoods and concrete-dense urban heat islands would cross lethal physiological thresholds. 
              </p>
              <p>
                Because they couldn't see the micro-level risk, resources could not be deployed where they were needed most. OpenPlanet was engineered to ensure governments and asset managers are never caught blind again.
              </p>
            </div>
          </div>

          {/* CARD 2: The Genesis */}
          <div className="lg:col-span-6 bg-[#050b14]/80 backdrop-blur-xl border border-white/10 p-8 md:p-10 rounded-2xl shadow-2xl flex flex-col hover:border-emerald-500/30 transition-colors group">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full group-hover:animate-ping"></div>
              <h3 className="text-[10px] text-emerald-400 tracking-[0.4em] uppercase font-bold">The Genesis</h3>
            </div>
            <h4 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">Understanding the Necessary Problem</h4>
            <div className="text-xs text-slate-300 font-light leading-loose space-y-4 tracking-wide">
              <p>
                The architecture for OpenPlanet was conceptualized during founder Aakash Goswami’s participation in the Harvard Innovation Labs (i-lab) climate venture program. 
              </p>
              <p>
                Guided by the "Learn-Do-Discuss" framework championed by leading climate innovators like Rebekah Emanuel, the directive was clear: you must deeply understand the systemic failure before you engineer the platform. The systemic failure was the data gap.
              </p>
              <p>
                The world is saturated with macro-economic climate policies, but knowing the global average temperature will rise by 1.5°C does not tell a mayor or an investor how to protect their assets and citizens today. OpenPlanet translates abstract planetary science into highly actionable risk intelligence.
              </p>
            </div>
          </div>

          {/* CARD 3: The Architecture */}
          <div className="lg:col-span-6 bg-[#050b14]/80 backdrop-blur-xl border border-white/10 p-8 md:p-10 rounded-2xl shadow-2xl flex flex-col hover:border-blue-500/30 transition-colors group">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full group-hover:animate-ping"></div>
              <h3 className="text-[10px] text-blue-400 tracking-[0.4em] uppercase font-bold">The Architecture</h3>
            </div>
            <h4 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">Institutional-Grade Telemetry</h4>
            <p className="text-xs text-slate-300 font-light leading-loose mb-8 tracking-wide">
              We do not rely on black-box predictions. OpenPlanet is built on an infrastructure of radical transparency, powered by the world's most trusted scientific bodies:
            </p>
            <div className="space-y-8">
              <div className="border-l-2 border-slate-700 pl-4">
                <span className="text-[11px] font-bold text-white uppercase tracking-widest block mb-2">Atmospheric Reanalysis</span>
                <span className="text-[10px] text-slate-400 font-light tracking-widest leading-relaxed">Real-time and historical telemetry ingested directly from the Copernicus Climate Data Store (ECMWF) via Open-Meteo infrastructure.</span>
              </div>
              <div className="border-l-2 border-slate-700 pl-4">
                <span className="text-[11px] font-bold text-white uppercase tracking-widest block mb-2">Advanced Spatial Data</span>
                <span className="text-[10px] text-slate-400 font-light tracking-widest leading-relaxed">High-resolution geocoding, elevation data, and spatial querying executed via OpenStreetMap (Nominatim) and digital elevation models.</span>
              </div>
              <div className="border-l-2 border-slate-700 pl-4">
                <span className="text-[11px] font-bold text-white uppercase tracking-widest block mb-2">Physiological Risk Modeling</span>
                <span className="text-[10px] text-slate-400 font-light tracking-widest leading-relaxed">Integrating rigorous epidemiological frameworks to calculate localized health thresholds and labor productivity impacts.</span>
              </div>
            </div>
          </div>

          {/* CARD 4: A New Dimension */}
          <div className="lg:col-span-6 bg-[#050b14]/80 backdrop-blur-xl border border-white/10 p-8 md:p-10 rounded-2xl shadow-2xl flex flex-col hover:border-purple-500/30 transition-colors group">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-1.5 h-1.5 bg-purple-500 rounded-full group-hover:animate-ping"></div>
              <h3 className="text-[10px] text-purple-400 tracking-[0.4em] uppercase font-bold">The Methodology</h3>
            </div>
            <h4 className="text-xl font-bold text-white mb-6 uppercase tracking-widest">A New Dimension of Climate Intelligence</h4>
            <p className="text-xs text-slate-300 font-light leading-loose mb-8 tracking-wide">
              The current climate analytics market focuses heavily on forecasting financial asset damage or providing static data feeds. OpenPlanet operates on a fundamentally different philosophy:
            </p>
            <div className="space-y-8">
              <div className="border-l-2 border-slate-700 pl-4">
                <span className="text-[11px] font-bold text-white uppercase tracking-widest block mb-2">People Over Property</span>
                <span className="text-[10px] text-slate-400 font-light tracking-widest leading-relaxed">We do not stop at the concrete. Our engine shifts the focus from structural damage to human survival and labor productivity.</span>
              </div>
              <div className="border-l-2 border-slate-700 pl-4">
                <span className="text-[11px] font-bold text-white uppercase tracking-widest block mb-2">Dynamic Simulation</span>
                <span className="text-[10px] text-slate-400 font-light tracking-widest leading-relaxed">OpenPlanet operates as an active simulation environment, allowing planners to dynamically test localized interventions (like canopy cover) to calculate risk reduction.</span>
              </div>
              <div className="border-l-2 border-slate-700 pl-4">
                <span className="text-[11px] font-bold text-white uppercase tracking-widest block mb-2">Probabilistic Reality</span>
                <span className="text-[10px] text-slate-400 font-light tracking-widest leading-relaxed">We utilize advanced probabilistic modeling to deliver mathematical estimates across standard IPCC emission pathways (CMIP6).</span>
              </div>
            </div>
          </div>

        </div>

        {/* FOUNDER SIGN-OFF (Bottom Center) */}
        <div className="mt-8 flex flex-col items-center justify-center text-center">
          <div className="bg-[#050b14]/80 backdrop-blur-xl border border-white/10 p-10 rounded-2xl flex flex-col items-center max-w-sm w-full shadow-2xl relative overflow-hidden">
            <div className="absolute -top-16 -left-16 w-32 h-32 bg-cyan-500/10 blur-[50px] pointer-events-none"></div>
            
            <span className="text-[10px] font-mono text-cyan-500 tracking-[0.4em] uppercase mb-4 block font-bold">Engineered By</span>
            <h4 className="text-xl font-bold text-white mb-2 uppercase tracking-widest">Aakash Goswami</h4>
            <p className="text-[10px] text-slate-400 font-light mb-8 uppercase tracking-widest">Founder & Developer</p>
            
            <a 
              href="https://in.linkedin.com/in/aakash-goswami-18b83531b" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-8 py-4 bg-cyan-900/50 hover:bg-cyan-800 text-cyan-300 hover:text-white border border-cyan-500/30 transition-all rounded-lg flex items-center gap-3 text-[10px] font-bold tracking-[0.2em] uppercase shadow-[0_0_15px_rgba(34,211,238,0.1)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
              Connect on LinkedIn
            </a>
          </div>
        </div>

      </main>

    </div>
  );
}