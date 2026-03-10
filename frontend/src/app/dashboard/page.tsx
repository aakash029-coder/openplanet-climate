'use client';

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import dynamic from "next/dynamic";

import CompareModule from "@/components/CompareModule";
import ResearchModule from "@/components/ResearchModule";
import MethodologyModule from "@/components/MethodologyModule";

// Ultra-premium loading state
const MapModule = dynamic(() => import("@/components/MapModule"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-[750px] bg-[#020205]/80 backdrop-blur-md flex flex-col items-center justify-center relative z-10">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 border-t-2 border-r-2 border-cyan-500/80 rounded-full animate-spin"></div>
        <div className="absolute w-10 h-10 border-b-2 border-l-2 border-blue-500/60 rounded-full animate-spin-reverse"></div>
        <div className="absolute w-2 h-2 bg-cyan-400 rounded-full shadow-[0_0_10px_#22d3ee] animate-pulse"></div>
      </div>
      <span className="mt-8 font-mono text-[10px] text-cyan-500/80 tracking-[0.5em] uppercase animate-pulse">Establishing Secure Uplink...</span>
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

  return (
    <div className="relative text-slate-200 font-sans overflow-x-hidden flex flex-col w-full min-h-screen">
      
      {/* 🌌 PREMIUM CYBERMAP BACKGROUND */}
      <img 
        src="/cybermap.jpeg" 
        alt="Cyber Map Background" 
        className="fixed inset-0 w-full h-full object-cover opacity-15 pointer-events-none z-0 mix-blend-screen"
      />
      <div className="fixed inset-0 bg-gradient-to-b from-[#020205] via-[#020205]/80 to-[#020205] pointer-events-none z-0"></div>

      <div className="flex flex-col w-full flex-grow relative z-10">
        
        {/* 🛸 SLEEK RIGID SUB-NAVIGATION */}
        <nav className="w-full bg-[#020205]/60 backdrop-blur-3xl border-b border-white/5 pt-20 sticky top-0 z-[40] shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
          
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
                    ${isActive ? 'text-cyan-400 font-extrabold tracking-[0.3em] drop-shadow-[0_0_15px_rgba(34,211,238,0.8)] scale-105' : ''}
                    ${isLocked ? 'text-slate-800 cursor-not-allowed' : ''}
                    ${!isActive && !isLocked ? 'text-slate-500 hover:text-cyan-200 hover:tracking-[0.25em]' : ''}
                  `}
                >
                  {tab}
                  {/* Glowing Underline indicator for active tab */}
                  {isActive && (
                    <span className="absolute -bottom-[21px] left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_15px_#22d3ee] rounded-t-full"></span>
                  )}
                </button>
              );
            })}

            {/* 🎯 SCI-FI TARGET BADGE */}
            {targetCity && (
              <div className="absolute -bottom-6 right-8 lg:right-16 xl:right-24 text-[9px] font-mono text-cyan-300 uppercase tracking-widest border border-cyan-400/20 bg-cyan-950/40 px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.15)] backdrop-blur-xl flex items-center gap-3">
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
            
            {/* Added generous padding and max-width for premium spacing */}
            <div className={activeTab === "Dashboard" ? "" : "max-w-[1400px] w-full mx-auto px-6 md:px-12 py-16"}>
                {activeTab === "Compare"     && targetCity && <CompareModule baseTarget={targetCity} />}
                {activeTab === "Research"    && targetCity && <ResearchModule baseTarget={targetCity} />}
                {activeTab === "Methodology" && <MethodologyModule />}
            </div>

            {/* 🚀 HIGH-CLASS NEXT PROTOCOL BUTTON */}
            {targetCity && NEXT_TAB_MAP[activeTab] && (
              <div className="max-w-md w-full mx-auto px-6 pb-24 mt-auto">
                <button 
                  onClick={() => setActiveTab(NEXT_TAB_MAP[activeTab]!)}
                  className="relative w-full py-4 rounded-full text-[10px] font-mono font-bold tracking-[0.3em] text-cyan-300 uppercase transition-all overflow-hidden group border border-cyan-500/30 bg-black/60 backdrop-blur-xl shadow-[0_0_30px_rgba(34,211,238,0.1)] hover:shadow-[0_0_50px_rgba(34,211,238,0.4)] hover:border-cyan-400 hover:scale-105 hover:-translate-y-1"
                >
                  {/* Deep glowing gradient inside button */}
                  <div className="absolute inset-0 bg-gradient-to-r from-cyan-950/40 via-blue-900/40 to-cyan-950/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <span className="relative z-10 flex items-center justify-center gap-3">
                    Initialize {NEXT_TAB_MAP[activeTab]} Protocol 
                    <span className="text-cyan-500 group-hover:text-cyan-300 group-hover:translate-x-2 transition-transform duration-300">➔</span>
                  </span>
                </button>
              </div>
            )}
        </div>
      </div>

      {/* 🛡️ MILITARY-GRADE SYSTEM DISCLAIMER */}
      <div className="w-full border-t border-white/5 bg-[#010103]/80 backdrop-blur-2xl px-6 py-8 mt-auto relative z-20">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[9px] text-slate-600 font-mono uppercase tracking-[0.3em] leading-loose">
            <span className="text-cyan-800 font-bold tracking-[0.4em] mr-3">SYSTEM NOTICE //</span> 
            OpenPlanet provides climate risk projections generated using the OpenMatrix modeling framework. These projections integrate global climate datasets and demographic models to estimate potential health and economic impacts. All outputs are research-oriented estimates intended for analytical and exploratory purposes.
          </p>
        </div>
      </div>

    </div>
  );
}