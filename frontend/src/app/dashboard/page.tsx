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
    <div className="w-full h-[75vh] min-h-[700px] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center">
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
  const [targetCity, setTargetCity] = useState<string | null>(null);

  return (
    <div className="text-slate-200 font-sans overflow-x-hidden flex flex-col w-full flex-grow pt-0 mt-0">
      
      <div className="flex flex-col w-full flex-grow pt-0 mt-0">
        
        {/* SUB-NAV */}
        <nav className="w-full bg-black/80 backdrop-blur-xl border-b border-white/10 px-6 md:px-12 flex flex-col lg:flex-row items-center justify-between sticky top-[80px] z-[450] shadow-xl m-0">
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
                    ${isLocked ? 'text-slate-500/40 cursor-not-allowed' : 'text-slate-400 hover:text-white'}
                  `}
                >
                  {tab}
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
        <div className="w-full flex flex-col flex-grow relative">
            
            {/* MAP MODULE HEIGHT ADJUSTED FOR CLEAN STACKING */}
            <div className={activeTab === "Dashboard" ? "block w-full h-[75vh] min-h-[750px] relative" : "hidden"}>
                <MapModule onTargetLocked={(city: string) => setTargetCity(city)} />
            </div>
            
            <div className={activeTab !== "Dashboard" ? "max-w-[1600px] w-full mx-auto px-6 md:px-12 py-12" : "hidden"}>
                <div className={activeTab === "Compare" ? "block animate-in fade-in duration-500" : "hidden"}>
                  {targetCity && <CompareModule baseTarget={targetCity} />}
                </div>
                <div className={activeTab === "Research" ? "block animate-in fade-in duration-500" : "hidden"}>
                  {targetCity && <ResearchModule baseTarget={targetCity} />}
                </div>
                <div className={activeTab === "Methodology" ? "block animate-in fade-in duration-500" : "hidden"}>
                  <MethodologyModule />
                </div>
            </div>

            {targetCity && NEXT_TAB_MAP[activeTab] && activeTab !== "Dashboard" && (
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

      {/* ── COLLISION FIX: SOLID BACKGROUND & CLEAN PADDING ── */}
      {/* Changed transparent bg to solid #020617 and removed mt-auto to force it BELOW the map */}
      <div className="w-full border-y border-white/10 bg-[#020617] px-6 py-8 shrink-0 relative z-50 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest leading-relaxed">
            <span className="text-slate-400 font-bold tracking-[0.2em] mr-2">SYSTEM NOTICE:</span> 
            OpenPlanet provides climate risk projections generated using the OpenMatrix modeling framework. These projections integrate global climate datasets and demographic models to estimate potential health and economic impacts. All outputs are research-oriented estimates intended for analytical and exploratory purposes.
          </p>
        </div>
      </div>

    </div>
  );
}