import Link from 'next/link';

export default function AboutPage() {
  return (
    <div className="flex flex-col w-full min-h-screen">
      
      {/* 1. RIGID HEADER */}

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-grow w-full max-w-[1400px] mx-auto px-6 pt-8 pb-16 flex flex-col gap-12">
        
        {/* HERO INTRO */}
        <div className="w-full text-center mb-4">
          <h1 className="text-4xl md:text-5xl font-extrabold text-white tracking-tight mb-4">About OpenPlanet</h1>
          <h2 className="text-xl md:text-2xl font-light text-blue-400 tracking-wide mb-6">Translating Planetary Physics into Localized Survival.</h2>
          <p className="text-base text-slate-300 font-light max-w-3xl mx-auto leading-relaxed">
            OpenPlanet is a globally scalable climate intelligence engine. We bridge the critical gap between macro-level atmospheric science and block-level human vulnerability.
          </p>
        </div>

        {/* 2x2 GLASSMORPHIC GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 w-full">
          
          {/* CARD 1: The Catalyst */}
          <div className="lg:col-span-6 bg-black/40 backdrop-blur-xl border border-white/10 p-8 md:p-10 rounded-xl shadow-2xl flex flex-col hover:bg-white/5 transition-colors">
            <h3 className="text-[10px] font-mono text-red-400 tracking-[0.3em] uppercase mb-4">The Catalyst</h3>
            <h4 className="text-2xl font-bold text-white mb-6">The Cost of the Data Gap</h4>
            <div className="text-sm text-slate-300 font-light leading-relaxed space-y-4">
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
          <div className="lg:col-span-6 bg-black/40 backdrop-blur-xl border border-white/10 p-8 md:p-10 rounded-xl shadow-2xl flex flex-col hover:bg-white/5 transition-colors">
            <h3 className="text-[10px] font-mono text-emerald-400 tracking-[0.3em] uppercase mb-4">The Genesis</h3>
            <h4 className="text-2xl font-bold text-white mb-6">Understanding the Necessary Problem</h4>
            <div className="text-sm text-slate-300 font-light leading-relaxed space-y-4">
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
          <div className="lg:col-span-6 bg-black/40 backdrop-blur-xl border border-white/10 p-8 md:p-10 rounded-xl shadow-2xl flex flex-col hover:bg-white/5 transition-colors">
            <h3 className="text-[10px] font-mono text-blue-400 tracking-[0.3em] uppercase mb-4">The Architecture</h3>
            <h4 className="text-2xl font-bold text-white mb-6">Institutional-Grade Telemetry</h4>
            <p className="text-sm text-slate-300 font-light leading-relaxed mb-6">
              We do not rely on black-box predictions. OpenPlanet is built on an infrastructure of radical transparency, powered by the world's most trusted scientific bodies:
            </p>
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wide block mb-1">Atmospheric Reanalysis</span>
                <span className="text-xs text-slate-400 font-light">Real-time and historical telemetry ingested directly from the Copernicus Climate Data Store (ECMWF) and NASA Earthdata.</span>
              </div>
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wide block mb-1">Advanced Spatial Computing</span>
                <span className="text-xs text-slate-400 font-light">Complex environmental data synthesis and global spatial querying executed via Google Earth Engine.</span>
              </div>
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wide block mb-1">Physiological Risk Modeling</span>
                <span className="text-xs text-slate-400 font-light">Integrating rigorous epidemiological frameworks to calculate localized health thresholds and labor productivity impacts.</span>
              </div>
            </div>
          </div>

          {/* CARD 4: A New Dimension */}
          <div className="lg:col-span-6 bg-black/40 backdrop-blur-xl border border-white/10 p-8 md:p-10 rounded-xl shadow-2xl flex flex-col hover:bg-white/5 transition-colors">
            <h3 className="text-[10px] font-mono text-purple-400 tracking-[0.3em] uppercase mb-4">The Methodology</h3>
            <h4 className="text-2xl font-bold text-white mb-6">A New Dimension of Climate Intelligence</h4>
            <p className="text-sm text-slate-300 font-light leading-relaxed mb-6">
              The current climate analytics market focuses heavily on forecasting financial asset damage or providing static data feeds. OpenPlanet operates on a fundamentally different philosophy:
            </p>
            <div className="space-y-6">
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wide block mb-1">People Over Property</span>
                <span className="text-xs text-slate-400 font-light">We do not stop at the concrete. Our engine shifts the focus from structural damage to human survival and labor productivity, calculating the physiological risk to populations interacting with the infrastructure.</span>
              </div>
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wide block mb-1">Dynamic Simulation vs. Static Forecasting</span>
                <span className="text-xs text-slate-400 font-light">The standard industry output is a forecast of unavoidable risk. OpenPlanet operates as an active simulation environment. We allow planners to dynamically test the physics of adaptation—simulating localized interventions to instantly calculate probabilistic risk reduction.</span>
              </div>
              <div>
                <span className="text-xs font-bold text-white uppercase tracking-wide block mb-1">Probabilistic Reality</span>
                <span className="text-xs text-slate-400 font-light">We do not provide deterministic crystal-ball predictions. We utilize advanced probabilistic modeling to deliver mathematical confidence intervals across standard IPCC emission pathways.</span>
              </div>
            </div>
          </div>

        </div>

        {/* FOUNDER SIGN-OFF (Bottom Center) */}
        <div className="mt-12 flex flex-col items-center justify-center text-center">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-xl flex flex-col items-center max-w-sm w-full">
            <span className="text-[10px] font-mono text-slate-500 tracking-[0.3em] uppercase mb-4 block">Engineered By</span>
            <h4 className="text-lg font-bold text-white mb-1">Aakash Goswami</h4>
            <p className="text-xs text-slate-400 font-light mb-6">Founder</p>
            
            <a 
              href="https://in.linkedin.com/in/aakash-goswami-18b83531b" 
              target="_blank" 
              rel="noopener noreferrer"
              className="px-6 py-3 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white border border-blue-500/30 transition-colors rounded flex items-center gap-2 text-[10px] font-mono tracking-widest uppercase"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
              </svg>
              Connect on LinkedIn
            </a>
          </div>
        </div>

      </main>

      {/* STANDARD FOOTER */}

    </div>
  );
}