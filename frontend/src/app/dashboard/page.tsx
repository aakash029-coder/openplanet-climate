'use client';

// 👇 Yahan useEffect import add kiya hai
import React, { useState, useEffect } from 'react';
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

  // 👇 MEMORY SYSTEM: Ye track karega ki aap kis-kis tab par ja chuke hain
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set(['Dashboard']));

  // 🔴 NEW: Pop-up control karne ke liye state
  const [showWarningModal, setShowWarningModal] = useState(false);

  // 🔴 NEW: Page load hote hi screen size check karne ka logic
  useEffect(() => {
    const checkScreenSize = () => {
      // Agar screen 1024px se choti hai (Mobile / Small Tablet), toh pop-up dikhao
      if (window.innerWidth < 1024) {
        setShowWarningModal(true);
      }
    };

    // Pehli baar check karega
    checkScreenSize(); 

    // Agar user phone rotate karta hai tab bhi check karega
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Jab bhi active tab badlega, hum use memory mein save kar lenge
  useEffect(() => {
    setVisitedTabs((prev) => {
      const newSet = new Set(prev);
      newSet.add(activeTab);
      return newSet;
    });
  }, [activeTab]);

  const handleReset = () => {
    setTargetCity(null);
    setActiveTab('Dashboard');
    // Jab nayi city select karni ho, toh memory reset karni padegi
    setVisitedTabs(new Set(['Dashboard']));
  };

  return (
    <div className="relative text-slate-200 font-sans overflow-x-hidden flex flex-col w-full min-h-screen">
      
      {/* 🛑 THE POP-UP MODAL (Sirf tab dikhega jab screen choti hogi aur state true hogi) */}
      {showWarningModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm bg-[#0a0f1d] border border-cyan-500/30 p-8 rounded-2xl shadow-[0_0_40px_rgba(34,211,238,0.15)]">
            
            {/* ❌ TOP RIGHT CROSS BUTTON (Click karne pe pop-up band aur user dashboard use kar payega) */}
            <button
              onClick={() => setShowWarningModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Modal Content */}
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-cyan-900/30 text-cyan-400 rounded-full flex items-center justify-center mx-auto border border-cyan-500/20">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">
                Desktop Recommended
              </h3>
              <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-wider">
                OpenPlanet's high-resolution maps and data models are complex. For the full experience, please switch to a desktop or large tablet.
              </p>
              
              {/* Continue Button */}
              <button
                onClick={() => setShowWarningModal(false)}
                className="mt-4 w-full py-3 bg-cyan-900/40 border border-cyan-500/30 text-cyan-100 text-[10px] font-bold uppercase tracking-[0.2em] rounded-lg hover:bg-cyan-800 transition-colors"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      <img 
        src="/cybermap.jpeg" 
        alt="Cyber Map Background" 
        className="fixed inset-0 w-full h-full object-cover opacity-40 pointer-events-none z-0 mix-blend-screen"
      />
      <div className="fixed inset-0 bg-gradient-to-b from-[#060d1a]/30 via-[#060d1a]/60 to-[#060d1a]/30 pointer-events-none z-0"></div>

      <div className="flex flex-col w-full flex-grow relative z-10">
        
        <nav className="w-full bg-[#0a1526]/80 backdrop-blur-3xl border-b border-cyan-500/20 pt-20 sticky top-0 z-[40] shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
          <div className="w-full flex items-center justify-between px-8 lg:px-16 xl:px-24 py-5 text-[11px] font-mono uppercase tracking-[0.25em] relative">
            
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
                    ${!isActive && !isLocked ? 'text-slate-400 hover:text-cyan-100 hover:tracking-[0.28em]' : ''}
                  `}
                >
                  {tab}
                  {isActive && (
                    <span className="absolute -bottom-[21px] left-0 w-full h-[2px] bg-cyan-400 shadow-[0_0_20px_#22d3ee] rounded-t-full"></span>
                  )}
                </button>
              );
            })}

            {targetCity && (
              <div className="absolute -bottom-6 right-8 lg:right-16 xl:right-24 text-[9px] font-mono text-cyan-200 uppercase tracking-widest border border-cyan-400/40 bg-cyan-900/80 px-4 py-1.5 rounded-full shadow-[0_0_20px_rgba(34,211,238,0.3)] backdrop-blur-xl flex items-center gap-3">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse shadow-[0_0_8px_#22d3ee]"></span>
                Target Locked: <span className="text-white font-bold">{targetCity}</span>
              </div>
            )}

          </div>
        </nav>

        {/* ── THE ENGINE CORE (Updated for Keep-Alive Memory) ── */}
        <div className="w-full h-full flex flex-col flex-grow">
            
            {/* DASHBOARD TAB - Hides instead of destroying */}
            <div className={activeTab === "Dashboard" ? "block w-full" : "hidden"}>
                <MapModule onTargetLocked={(city: string) => setTargetCity(city)} />
            </div>
            
            {/* OTHER TABS WRAPPER */}
            <div className={activeTab !== "Dashboard" ? "max-w-[1400px] w-full mx-auto px-6 md:px-12 py-16" : "hidden"}>
                
                {/* COMPARE TAB */}
                {visitedTabs.has('Compare') && targetCity && (
                  <div className={activeTab === "Compare" ? "block animate-in fade-in duration-700" : "hidden"}>
                    <CompareModule baseTarget={targetCity} />
                  </div>
                )}

                {/* RESEARCH TAB */}
                {visitedTabs.has('Research') && targetCity && (
                  <div className={activeTab === "Research" ? "block animate-in fade-in duration-700" : "hidden"}>
                    <ResearchModule baseTarget={targetCity} />
                  </div>
                )}

                {/* METHODOLOGY TAB */}
                {visitedTabs.has('Methodology') && (
                  <div className={activeTab === "Methodology" ? "block animate-in fade-in duration-700" : "hidden"}>
                    <MethodologyModule />
                  </div>
                )}

            </div>

            {/* BUTTON LOGIC */}
            {targetCity && (
              <div className="max-w-md w-full mx-auto px-6 pb-24 mt-auto relative z-10">
                {NEXT_TAB_MAP[activeTab] ? (
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
                  <button 
                    onClick={handleReset}
                    className="relative w-full py-4 rounded-full text-[10px] font-mono font-bold tracking-[0.3em] text-white uppercase transition-all overflow-hidden group border border-cyan-400/50 bg-cyan-900/60 backdrop-blur-xl shadow-[0_0_30px_rgba(34,211,238,0.3)] hover:shadow-[0_0_50px_rgba(34,211,238,0.6)] hover:border-cyan-300 hover:scale-105 hover:-translate-y-1"
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-cyan-600/40 via-blue-500/50 to-cyan-600/40 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
                    <span className="relative z-10 flex items-center justify-center gap-3">
                      <span className="text-cyan-300 group-hover:text-white group-hover:-translate-x-2 transition-transform duration-300">↺</span>
                      Analyze New City
                    </span>
                  </button>
                )}
              </div>
            )}
        </div>
      </div>

      <div className="w-full border-t border-cyan-500/10 bg-[#060d1a]/80 backdrop-blur-2xl px-6 py-8 mt-auto relative z-20">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-[9px] text-slate-400 font-mono uppercase tracking-[0.3em] leading-loose">
            <span className="text-cyan-400 font-bold tracking-[0.4em] mr-3">SYSTEM NOTICE :-</span> 
            OpenPlanet provides climate risk projections generated using the OpenMatrix modeling framework. These projections integrate global climate datasets and demographic models to estimate potential health and economic impacts. All outputs are research-oriented estimates intended for analytical and exploratory purposes.
          </p>
        </div>
      </div>

    </div>
  );
}