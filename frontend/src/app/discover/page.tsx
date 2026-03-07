'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function DiscoverPage() {
  // Interactive Slider State
  const [canopyCover, setCanopyCover] = useState(15);
  const [coolRoof, setCoolRoof] = useState(40);
  
  // Dynamic Math Logic
  const coolingEffect = ((canopyCover * 0.03) + (coolRoof * 0.018)).toFixed(1);
  const mortalityLower = Math.max(2, Math.floor((canopyCover * 0.4) + (coolRoof * 0.15)));
  const mortalityUpper = mortalityLower + 6;

  return (
    <div className="flex flex-col w-full min-h-screen">
      
      {/* 1. RIGID DISCOVER HEADER */}

      {/* MAIN CONTENT WORKSPACE */}
      <main className="flex-grow w-full max-w-[1600px] mx-auto px-6 pt-28 pb-12 flex flex-col gap-6">
        
        {/* 2. EXPLORATION BAR (Locked Example) */}
        <div className="w-full bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-xl text-center shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-blue-500/50"></div>
          <span className="text-[10px] font-mono text-blue-400 tracking-[0.3em] uppercase mb-2 block">Guided Example</span>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight mb-3">See OpenPlanet in Action.</h1>
          <p className="text-sm text-slate-300 font-light mb-8 max-w-3xl mx-auto leading-relaxed">
            We have pre-loaded a live example for <strong>Paris, France</strong>. Follow the steps below to see how our platform takes complex climate data and turns it into simple, life-saving city planning tools.
          </p>
          
          {/* Locked Search Bar */}
          <div className="max-w-2xl mx-auto relative flex items-center opacity-70">
            <input 
              type="text" 
              readOnly
              className="w-full bg-black/50 border border-white/20 px-6 py-4 rounded-md text-white font-mono text-sm cursor-not-allowed"
              value="Paris, France (Interactive Demo Locked)"
            />
            <button disabled className="absolute right-2 px-6 py-2 bg-white/5 border border-white/10 text-slate-400 font-mono text-[10px] tracking-widest uppercase rounded cursor-not-allowed">
              Demo Mode
            </button>
          </div>
          <p className="text-[10px] font-mono text-slate-400 mt-4 uppercase tracking-widest">To search any global city, sign in from the home page.</p>
        </div>

        {/* 3-COLUMN DASHBOARD LAYOUT */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 w-full flex-grow">
          
          {/* 3. REGIONAL RISK PROFILE (Left Sidebar - THE PROBLEM) */}
          <div className="lg:col-span-3 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-xl flex flex-col h-full shadow-2xl">
            
            {/* Simple Explainer */}
            <div className="bg-blue-500/10 border border-blue-500/20 p-3 rounded mb-6">
              <span className="text-[10px] font-mono text-blue-400 tracking-[0.2em] uppercase block mb-1">Step 1: The Problem</span>
              <p className="text-xs text-blue-100 font-light">What happens if the city does nothing? Here is the projected heat risk for Paris.</p>
            </div>

            <div className="mb-6">
              <h2 className="text-white font-bold text-xl tracking-tight">PARIS, FRANCE</h2>
              <span className="text-[10px] font-mono text-slate-400 tracking-[0.2em] uppercase">Downtown Area</span>
            </div>
            
            <div className="border-t border-white/10 pt-5 mb-5">
              <h3 className="text-[10px] font-mono text-slate-500 tracking-[0.2em] uppercase mb-4">Current Normal Weather</h3>
              <div className="flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-300">Average Summer Temp</span>
                  <span className="text-xs font-mono text-white">24.2°C</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-300">Safest Temp (Health)</span>
                  <span className="text-xs font-mono text-emerald-400">21.5°C</span>
                </div>
              </div>
            </div>

            <div className="border-t border-white/10 pt-5 flex-grow">
              <h3 className="text-[10px] font-mono text-slate-500 tracking-[0.2em] uppercase mb-4">Future Risk (By 2050)</h3>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col mb-2">
                  <span className="text-[10px] text-slate-500 mb-1">If global emissions continue normally:</span>
                  <div className="flex justify-between items-center">
                    <span className="text-xs text-slate-300">Extra Heatwave Days</span>
                    <span className="text-xs font-mono text-red-400">+18 Days / Year</span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-300">City Heat Trapping</span>
                  <span className="text-xs font-mono text-orange-400">Severe Risk</span>
                </div>
              </div>
            </div>
          </div>

          {/* 4. MITIGATION MODELER (Center Panel - THE SOLUTION) */}
          <div className="lg:col-span-6 bg-black/40 backdrop-blur-xl border border-white/10 p-8 rounded-xl flex flex-col justify-between shadow-2xl">
            <div>
              
              {/* Simple Explainer */}
              <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded mb-6">
                <span className="text-[10px] font-mono text-emerald-400 tracking-[0.2em] uppercase block mb-1">Step 2: The Solution</span>
                <p className="text-xs text-emerald-100 font-light">Drag the sliders below. See how planting trees and painting roofs white actively cools the city and saves lives.</p>
              </div>

              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-lg font-bold text-white tracking-wide">Test City Improvements</h2>
              </div>
              <p className="text-xs text-slate-400 mb-10 font-light leading-relaxed">
                Watch the numbers at the bottom change as you increase the green spaces and reflective roofs in Paris.
              </p>
              
              {/* Interactive Sliders */}
              <div className="space-y-10">
                <div className="bg-white/5 border border-white/10 p-5 rounded-lg">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <span className="block text-xs font-mono text-white uppercase mb-1">Plant More Trees (Canopy Cover)</span>
                      <span className="text-[10px] text-slate-400">Adds shade to streets and cools the air.</span>
                    </div>
                    <span className="text-lg font-mono text-blue-400 bg-blue-500/10 px-3 py-1 rounded">+{canopyCover}%</span>
                  </div>
                  <input type="range" min="0" max="50" value={canopyCover} onChange={(e) => setCanopyCover(Number(e.target.value))} className="w-full accent-blue-500 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                </div>

                <div className="bg-white/5 border border-white/10 p-5 rounded-lg">
                  <div className="flex justify-between items-end mb-4">
                    <div>
                      <span className="block text-xs font-mono text-white uppercase mb-1">Paint Roofs White (Cool Roofs)</span>
                      <span className="text-[10px] text-slate-400">Reflects sunlight away from buildings.</span>
                    </div>
                    <span className="text-lg font-mono text-blue-400 bg-blue-500/10 px-3 py-1 rounded">+{coolRoof}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={coolRoof} onChange={(e) => setCoolRoof(Number(e.target.value))} className="w-full accent-blue-500 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer" />
                </div>
              </div>
            </div>

            {/* Real-Time Outputs */}
            <div className="grid grid-cols-2 gap-6 border-t border-white/10 pt-8 mt-8">
              <div className="bg-gradient-to-br from-blue-900/20 to-transparent border border-blue-500/20 p-5 rounded-lg transition-all duration-300">
                <span className="block text-[10px] font-mono text-blue-400 tracking-[0.2em] uppercase mb-2">The City Cools By</span>
                <span className="text-4xl font-light text-white tracking-tighter">-{coolingEffect}<span className="text-xl text-slate-400">°C</span></span>
              </div>
              <div className="bg-gradient-to-br from-emerald-900/20 to-transparent border border-emerald-500/20 p-5 rounded-lg transition-all duration-300">
                <span className="block text-[10px] font-mono text-emerald-400 tracking-[0.2em] uppercase mb-2">Lives Saved (Mortality Drop)</span>
                <span className="text-4xl font-light text-white tracking-tighter">{mortalityLower}<span className="text-xl text-slate-400">%</span> <span className="text-2xl text-slate-500 font-light">-</span> {mortalityUpper}<span className="text-xl text-slate-400">%</span></span>
              </div>
            </div>
          </div>

          {/* 5. DATA EXTRACTION PANEL (Right Sidebar - THE PROOF) */}
          <div className="lg:col-span-3 bg-black/40 backdrop-blur-xl border border-white/10 p-6 rounded-xl flex flex-col shadow-2xl">
            
            {/* Simple Explainer */}
            <div className="bg-white/5 border border-white/10 p-3 rounded mb-6">
              <span className="text-[10px] font-mono text-slate-300 tracking-[0.2em] uppercase block mb-1">Step 3: The Proof</span>
              <p className="text-xs text-slate-400 font-light">Professionals can download the exact math and reports used to generate these numbers.</p>
            </div>

            <h2 className="text-sm font-bold text-white mb-2 tracking-wide uppercase">Download the Data</h2>
            <p className="text-xs text-slate-400 font-light mb-8 leading-relaxed">
              Export the raw maps and health estimates to share with city planners or researchers.
            </p>
            
            <div className="flex flex-col gap-4 mt-auto">
              <button className="w-full flex items-center justify-between px-5 py-4 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all rounded group cursor-not-allowed opacity-80">
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-mono text-white tracking-widest uppercase mb-1">Get PDF Report</span>
                  <span className="text-[9px] text-slate-500 font-mono">Demo Disabled</span>
                </div>
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </button>

              <button className="w-full flex items-center justify-between px-5 py-4 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/30 transition-all rounded group cursor-not-allowed opacity-80">
                <div className="flex flex-col text-left">
                  <span className="text-[10px] font-mono text-white tracking-widest uppercase mb-1">Get Raw Data (CSV)</span>
                  <span className="text-[9px] text-slate-500 font-mono">Demo Disabled</span>
                </div>
                <svg className="w-4 h-4 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
              </button>
            </div>
          </div>

        </div>
      </main>

      {/* 6. STANDARD FOOTER (Unchanged text) */}

    </div>
  );
}