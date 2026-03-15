'use client';

import { useState } from 'react';

export default function DiscoverPage() {
  const [canopyCover, setCanopyCover] = useState(15);
  const [albedo, setAlbedo] = useState(40);

  const coolingEffect = ((canopyCover * 0.03) + (albedo * 0.018)).toFixed(1);
  const mortalityLower = Math.max(2, Math.floor((canopyCover * 0.4) + (albedo * 0.15)));
  const mortalityUpper = mortalityLower + 6;

  return (
    <div className="flex flex-col w-full min-h-screen">

      <main className="flex-grow w-full max-w-[1600px] mx-auto px-4 md:px-6 pt-8 pb-12 flex flex-col gap-6">

        {/* 1. EXPLORATION BAR */}
        <div className="w-full bg-black/40 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-xl text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500/50"></div>
          <span className="text-[10px] font-mono text-indigo-400 tracking-[0.3em] uppercase mb-2 block">Guided Simulation</span>
          <h1 className="text-xl md:text-3xl font-bold text-white tracking-[0.2em] uppercase mb-3">See OpenPlanet in Action</h1>
          <p className="text-xs text-slate-400 font-light mb-6 md:mb-8 max-w-3xl mx-auto leading-relaxed uppercase tracking-widest">
            We have pre-loaded a live example for <span className="text-white font-bold">Paris, France</span>. Follow the steps below to see how our platform takes complex climate data and turns it into localized mitigation intelligence.
          </p>

          <div className="max-w-2xl mx-auto relative flex items-center opacity-80">
            <input
              type="text"
              readOnly
              className="w-full bg-black/50 border border-white/20 px-4 md:px-6 py-3 md:py-4 rounded text-white font-mono text-xs uppercase tracking-widest cursor-not-allowed outline-none shadow-inner"
              value="Paris, France (Interactive Demo Locked)"
            />
            <button disabled className="absolute right-2 px-3 md:px-6 py-2 bg-white/5 border border-white/10 text-slate-400 font-mono text-[9px] tracking-widest uppercase rounded cursor-not-allowed">
              Demo Mode
            </button>
          </div>
          <p className="text-[9px] font-mono text-slate-500 mt-4 uppercase tracking-[0.2em]">To analyze any global coordinate, initialize terminal from the home page.</p>
        </div>

        {/* 2-COLUMN LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-grow">

          {/* LEFT: REGIONAL RISK PROFILE */}
          <div className="lg:col-span-3 bg-black/40 backdrop-blur-xl border border-white/10 p-5 md:p-6 rounded-xl flex flex-col shadow-2xl">

            <div className="bg-indigo-500/10 border border-indigo-500/20 p-4 rounded mb-6">
              <span className="text-[10px] font-mono text-indigo-400 tracking-[0.2em] uppercase block mb-2 font-bold">Phase 01: Baseline Risk</span>
              <p className="text-[10px] text-indigo-100/70 uppercase tracking-widest leading-relaxed">What happens without intervention? Projected baseline thermal hazards for Paris.</p>
            </div>

            <div className="mb-6">
              <h2 className="text-white font-bold text-xl tracking-[0.1em] uppercase">Paris, France</h2>
              <span className="text-[10px] font-mono text-slate-400 tracking-[0.3em] uppercase">Urban Center</span>
            </div>

            <div className="border-t border-white/10 pt-5 mb-5">
              <h3 className="text-[9px] font-mono text-slate-500 tracking-[0.3em] uppercase mb-4">Historical Climatic Baseline</h3>
              <div className="flex flex-col gap-4">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-300 uppercase tracking-widest">Avg Summer Temp</span>
                  <span className="text-xs font-mono text-white font-bold">24.2°C</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-300 uppercase tracking-widest">Health Safety Threshold</span>
                  <span className="text-xs font-mono text-emerald-400 font-bold">21.5°C</span>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-5 flex-grow">
              <h3 className="text-[9px] font-mono text-slate-500 tracking-[0.3em] uppercase mb-4">SSP2-4.5 Projection (2050)</h3>
              <div className="flex flex-col gap-4">
                <div className="flex flex-col mb-2">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] text-slate-300 uppercase tracking-widest">Excess Heatwave Days</span>
                    <span className="text-[10px] font-mono text-red-400 font-bold">+18 DAYS / YR</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-slate-300 uppercase tracking-widest">Thermal Exposure Risk</span>
                  <span className="text-[10px] font-mono text-orange-400 font-bold">SEVERE</span>
                </div>
              </div>
            </div>

            {/* ✅ Mobile-only CTA — desktop par nahi dikhega */}
            <div className="mt-6 pt-5 border-t border-white/10 lg:hidden">
              <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest text-center">
                Scroll down to test mitigation variables ↓
              </p>
            </div>
          </div>

          {/* RIGHT: MITIGATION MODELER */}
          <div className="lg:col-span-9 bg-black/40 backdrop-blur-xl border border-white/10 p-6 md:p-8 rounded-xl flex flex-col justify-between shadow-2xl">
            <div>
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded mb-6">
                <span className="text-[10px] font-mono text-emerald-400 tracking-[0.2em] uppercase block mb-2 font-bold">Phase 02: Mitigation Engine</span>
                <p className="text-[10px] text-emerald-100/70 uppercase tracking-widest leading-relaxed">Adjust environmental parameters below to actively offset thermal accumulation and model mortality reduction.</p>
              </div>

              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-bold text-white tracking-[0.2em] uppercase">Test Variables</h2>
              </div>
              <p className="text-[10px] text-slate-400 mb-8 md:mb-10 uppercase tracking-widest leading-relaxed">
                Observe the delta in temperature and mortality metrics as you manipulate canopy and albedo offsets.
              </p>

              {/* Sliders */}
              <div className="space-y-6 md:space-y-10">
                <div className="bg-white/[0.02] border border-white/10 p-5 md:p-6 rounded-lg">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <span className="block text-[11px] font-mono text-white tracking-widest uppercase mb-1">Urban Canopy Offset</span>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest">Vegetation shading effect</span>
                    </div>
                    <span className="text-sm font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded">+{canopyCover}%</span>
                  </div>
                  {/* ✅ touch-action: manipulation — mobile par slider properly drag hoga */}
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={canopyCover}
                    onChange={(e) => setCanopyCover(Number(e.target.value))}
                    className="w-full accent-emerald-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                    style={{ touchAction: 'manipulation' }}
                  />
                </div>

                <div className="bg-white/[0.02] border border-white/10 p-5 md:p-6 rounded-lg">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <span className="block text-[11px] font-mono text-white tracking-widest uppercase mb-1">Surface Albedo Enhancement</span>
                      <span className="text-[9px] text-slate-500 uppercase tracking-widest">Reflective roofing & pavement</span>
                    </div>
                    <span className="text-sm font-mono text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-3 py-1 rounded">+{albedo}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={albedo}
                    onChange={(e) => setAlbedo(Number(e.target.value))}
                    className="w-full accent-indigo-500 h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                    style={{ touchAction: 'manipulation' }}
                  />
                </div>
              </div>
            </div>

            {/* Real-Time Outputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6 border-t border-white/10 pt-6 md:pt-8 mt-6 md:mt-8">
              <div className="bg-black/50 border border-indigo-500/20 p-5 md:p-6 rounded-lg transition-all duration-300 text-center">
                <span className="block text-[9px] font-mono text-indigo-400 tracking-[0.3em] uppercase mb-3 md:mb-4">Net Cooling Delta</span>
                <span className="text-3xl md:text-4xl font-light text-white tracking-tighter">
                  -{coolingEffect}<span className="text-lg md:text-xl text-slate-500 ml-1">°C</span>
                </span>
              </div>
              <div className="bg-black/50 border border-emerald-500/20 p-5 md:p-6 rounded-lg transition-all duration-300 text-center">
                <span className="block text-[9px] font-mono text-emerald-400 tracking-[0.3em] uppercase mb-3 md:mb-4">Mortality Reduction</span>
                <span className="text-3xl md:text-4xl font-light text-white tracking-tighter">
                  {mortalityLower}<span className="text-lg md:text-xl text-slate-500 mr-1">%</span>
                  <span className="text-xl md:text-2xl text-slate-600 font-light mx-1">-</span>
                  {mortalityUpper}<span className="text-lg md:text-xl text-slate-500 ml-1">%</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}