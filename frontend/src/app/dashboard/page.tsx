'use client';

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
import dynamic from "next/dynamic";

import CompareModule from "@/components/CompareModule";
import ResearchModule from "@/components/ResearchModule";
import MethodologyModule from "@/components/MethodologyModule";

const MapModule = dynamic(() => import("@/components/MapModule"), { 
  ssr: false,
  loading: () => (
    <div className="w-full h-[750px] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center border-b border-white/10">
      <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
      <span className="font-mono text-[10px] text-indigo-400 tracking-[0.5em] uppercase animate-pulse">Initializing WebGL Engine...</span>
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  // THE MASTER LOCK: Holds the city generated in the Map Module
  const [targetCity, setTargetCity] = useState<string | null>(null);

  return (
    // ── GLOBAL CYBERPUNK BACKGROUND WRAPPER ──
    <main 
      className="text-slate-200 font-sans overflow-x-hidden min-h-screen flex flex-col selection:bg-indigo-500/30 bg-fixed bg-center bg-cover"
      style={{
        backgroundImage: `linear-gradient(to bottom, rgba(2, 6, 23, 0.85), rgba(5, 8, 20, 0.95)), url('/cybermap.jpeg')`
      }}
    >
      
      {/* ── COMMAND HEADER ── */}
      <div className="pt-[72px] flex flex-col w-full flex-grow">
        
        {/* ── TACTICAL SUB-NAV ── */}
        <nav className="w-full bg-black/60 backdrop-blur-xl border-b border-white/10 px-6 md:px-12 flex flex-col lg:flex-row items-center justify-between sticky top-[72px] z-[450] shadow-xl">
          <div className="flex gap-8 overflow-x-auto w-full lg:w-auto no-scrollbar py-4">
            {TABS.map((tab) => {
              const isLocked = !targetCity && tab !== 'Dashboard';
              return (
                <button 
                  key={tab} 
                  disabled={isLocked}
                  onClick={() => setActiveTab(tab)} 
                  className={`text-[9px] font-mono tracking-[0.2em] uppercase whitespace-nowrap transition-all flex items-center gap-2
                    ${activeTab === tab ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]' : ''}
                    ${isLocked ? 'text-slate-500/50 cursor-not-allowed' : 'text-slate-400 hover:text-white'}
                  `}
                >
                  {tab} {isLocked && <span className="text-slate-600 text-xs">🔒</span>}
                </button>
              );
            })}
          </div>
          {targetCity && (
            <div className="hidden lg:block text-[9px] font-mono text-emerald-400 uppercase tracking-widest border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 rounded shadow-[0_0_10px_rgba(16,185,129,0.2)]">
              Active Target: {targetCity}
            </div>
          )}
        </nav>

        {/* ── THE ENGINE CORE ── */}
        <div className="w-full h-full flex flex-col flex-grow animate-in fade-in duration-700">
            {activeTab === "Dashboard" && (
                <MapModule onTargetLocked={(city: string) => setTargetCity(city)} />
            )}
            
            <div className={activeTab === "Dashboard" ? "" : "max-w-[1600px] w-full mx-auto px-6 md:px-12 py-12"}>
                {activeTab === "Compare"     && targetCity && <CompareModule baseTarget={targetCity} />}
                {activeTab === "Research"    && targetCity && <ResearchModule baseTarget={targetCity} />}
                {activeTab === "Methodology" && <MethodologyModule />}
            </div>

            {/* ── PROGRESSION ROUTER ── */}
            {targetCity && NEXT_TAB_MAP[activeTab] && (
              <div className="max-w-[1600px] w-full mx-auto px-6 md:px-12 pb-12 mt-auto">
                <button 
                  onClick={() => setActiveTab(NEXT_TAB_MAP[activeTab]!)}
                  className="w-full py-4 bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 font-mono text-[10px] uppercase tracking-[0.3em] rounded transition-all shadow-[0_0_15px_rgba(99,102,241,0.1)] hover:shadow-[0_0_25px_rgba(99,102,241,0.2)] backdrop-blur-sm"
                >
                  Proceed to {NEXT_TAB_MAP[activeTab]} Protocol ➔
                </button>
              </div>
            )}
        </div>
      </div>

      {/* ── SYSTEM DISCLAIMER (ABOVE GLOBAL FOOTER) ── */}
      <div className="w-full border-t border-white/5 bg-[#020617]/80 backdrop-blur-md px-6 py-6 mt-auto">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest leading-relaxed">
            <span className="text-slate-400 font-bold tracking-[0.2em] mr-2">SYSTEM NOTICE:</span> 
            OpenPlanet provides climate risk projections generated using the OpenMatrix modeling framework. These projections integrate global climate datasets and demographic models to estimate potential health and economic impacts. All outputs are research-oriented estimates intended for analytical and exploratory purposes.
          </p>
        </div>
      </div>

    </main>
  );
}