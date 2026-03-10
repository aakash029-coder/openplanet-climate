'use client';

import React, { useState } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from "next/dynamic";

import CompareModule from "@/components/CompareModule";
import ResearchModule from "@/components/ResearchModule";
import MethodologyModule from "@/components/MethodologyModule";

const MapModule = dynamic(() => import("@/components/MapModule"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-[750px] bg-[#060d1a]/80 backdrop-blur-md flex flex-col items-center justify-center relative z-10">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 border-t-2 border-r-2 border-cyan-400/80 rounded-full animate-spin"></div>
        <div className="absolute w-10 h-10 border-b-2 border-l-2 border-blue-400/60 rounded-full animate-spin-reverse"></div>
      </div>
      <span className="mt-8 font-mono text-[10px] text-cyan-400 tracking-[0.5em] uppercase animate-pulse">Establishing Uplink...</span>
    </div>
  )
});

type Tab = 'Dashboard' | 'Compare' | 'Research' | 'Methodology';
const TABS: Tab[] = ['Dashboard', 'Compare', 'Research', 'Methodology'];

const NEXT_TAB_MAP: Record<Tab, Tab | null> = {
  Dashboard: 'Compare',
  Compare: 'Research',
  Research: 'Methodology', 
  Methodology: null
};

export default function DashboardPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>('Dashboard');
  const [targetCity, setTargetCity] = useState<string | null>(null);

  // 👇 RESET FUNCTION TO SELECT NEW CITY
  const handleReset = () => {
    setTargetCity(null);
    setActiveTab('Dashboard');
  };

  return (
    <div className="relative text-slate-200 font-sans overflow-x-hidden flex flex-col w-full min-h-screen">
      
      {/* 🌌 BRIGHTER CYBERMAP BACKGROUND */}
      <img 
        src="/cybermap.jpeg" 
        alt="Cyber Map Background" 
        className="fixed inset-0 w-full h-full object-cover opacity-25 pointer-events-none z-0 mix-blend-screen"
      />
      <div className="fixed inset-0 bg-gradient-to-b from-[#060d1a]/40 via-[#060d1a]/80 to-[#060d1a]/40 pointer-events-none z-0"></div>

      <div className="flex flex-col w-full flex-grow relative z-10">
        
        {/* 🛸 SLEEK RIGID SUB-NAVIGATION */}
        <nav className="w-full bg-[#0a1526]/80 backdrop-blur-3xl border-b border-cyan-500/20 pt-20 sticky top-0 z-[40] shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
          <div className="w-full flex items-center justify-between px-8 lg:px-16 xl:px-24 py-5 text-[10px] font-mono uppercase tracking-[0.2em] relative">
            
            {TABS.map((tab) => {
              const isLocked = !targetCity && tab !== 'Dashboard';
              const isActive = activeTab === tab;

              return (
                <button 
                  key={tab} 
                  disabled={isLocked}
                  onClick={() => setActiveTab(tab)} 
                  className={`relative whitespace-nowrap transition-all duration-500 px-4 py-2 group
                    ${isActive ? 'text-cyan-300 font-extrabold tracking-[0.3em] drop-shadow-[0_0_15px_rgba(34,211,238,0.9)] scale-105' : ''}
                    ${isLocked ? 'text-slate-700 cursor-not-allowed' : ''}
                    ${!isActive && !isLocked ? 'text-slate-400 hover:text-cyan-100 hover:tracking-[0.25em]' : ''}
                  `}
                >
                  {tab}
                  {/* 👇 GLOWING LINE: Sirf tabhi aayegi jab tab active (kaam kar raha) hoga */}
                  {isActive && (
                    <span className="absolute -bottom-[21px] left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_20px_#22d3ee] rounded-t-full"></span>
                  )}
                </button>
              );
            })}

            {/* 🎯 TARGET BADGE */}
            {targetCity && (
              <div className="absolute -bottom-6 right-8 lg:right-16 xl:right-24 text-[9px] font-mono text-cyan-200 uppercase tracking-widest border border-cyan-400/40 bg-cyan-900/80 px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.3)] backdrop-blur-xl flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]"></span>
                Target Locked: <span className="text-white font-bold">{targetCity}</span>
              </div>
            )}

          </div>
        </nav>

        {/* ── ⚙️ THE ENGINE CORE ── */}
        <div className="w-full h-full flex flex-col flex-grow animate-in fade-in duration-1000">
            {activeTab === "Dashboard" && (
                <MapModule onTargetLocked={(city: string) => setTargetCity(city)} />
            )}
            
            <div className={activeTab === "Dashboard" ? "" : "max-w-[1400px] w-full mx-auto px-6 md:px-12 py-16"}>
                {activeTab === "Compare"     && targetCity && <CompareModule baseTarget={targetCity} />}
                {activeTab === "Research"    && targetCity && <ResearchModule baseTarget={targetCity} />}
                {activeTab === "Methodology" && <MethodologyModule />}
            </div>

            {/* 🚀 BUTTON LOGIC */}
            {targetCity && (
              <div className="max-w-md w-full mx-auto px-6 pb-24 mt-auto">
                {NEXT_TAB_MAP[activeTab] ? (
                  // PROCEED BUTTON (Compare & Research pages ke liye)
                  <button 
                    onClick={() => setActiveTab(NEXT_TAB_MAP[activeTab]!)}
                    className="relative w-full py-4 rounded-full text-[10px] font-mono font-bold tracking-[0.3em] text-white uppercase transition-all overflow-hidden group border border-cyan-400/50 bg-cyan-900/60 backdrop-blur-xl shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:shadow-[0_0_50px_rgba(34,211,238,0.6)] hover:border-cyan-300 hover:scale-105 hover:-translate-y-1"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/40 via-blue-500/50 to-cyan-600/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      Initialize {NEXT_TAB_MAP[activeTab]} Protocol 
                      <span className="text-cyan-300 group-hover:text-white group-hover:translate-x-2 transition-transform duration-300">➔</span>
                    </span>
                  </button>
                ) : (
                  // 👇 NEW CITY BUTTON (Sirf Methodology page par dikhega)
                  <button 
                    onClick={handleReset}
                    className="relative w-full py-4 rounded-full text-[10px] font-mono font-bold tracking-[0.3em] text-white uppercase transition-all overflow-hidden group border border-purple-400/50 bg-purple-900/60 backdrop-blur-xl shadow-[0_0_30px_rgba(168,85,247,0.3)] hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] hover:border-purple-300 hover:scale-105 hover:-translate-y-1"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/40 via-fuchsia-500/50 to-purple-600/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      <span className="text-purple-300 group-hover:text-white group-hover:-translate-x-2 transition-transform duration-300">↺</span>
                      Analyze New City
                    </span>
                  </button>
                )}
              </div>
            )}
        </div>
      </div>

      {/* 🛡️ BRIGHTER DISCLAIMER */}
      <div className="w-full border-t border-cyan-500/10 bg-[#060d1a]/80 backdrop-blur-2xl px-6 py-8 mt-auto relative z-20">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[9px] text-slate-400 font-mono uppercase tracking-[0.3em] leading-loose">
            <span className="text-cyan-400 font-bold tracking-[0.4em] mr-3">SYSTEM NOTICE //</span> 
            OpenPlanet provides climate risk projections generated using the OpenMatrix modeling framework. These projections integrate global climate datasets and demographic models to estimate potential health and economic impacts. All outputs are research-oriented estimates intended for analytical and exploratory purposes.
          </p>
        </div>
      </div>

    </div>
  );
}