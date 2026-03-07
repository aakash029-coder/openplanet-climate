'use client';

import React, { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';
// import Link from 'next/link'; // Kept in case you need it later
import dynamic from "next/dynamic";

import CompareModule from "@/components/CompareModule";
import ResearchModule from "@/components/ResearchModule";
import MethodologyModule from "@/components/MethodologyModule";

const MapModule = dynamic(() => import("@/components/MapModule"), { 
  ssr: false,
  loading: () => (
    // Updated loading background to be transparent so the cyber-map shows through
    <div className="w-full h-[750px] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center border-b border-white/10">
      <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
      <span className="font-mono text-[10px] text-indigo-400 tracking-[0.5em] uppercase animate-pulse">Initializing WebGL Engine...</span>
    </div>
  )
});

type Tab = 'Dashboard' | 'Compare' | 'Research' | 'Methodology';
const TABS: Tab[] = ['Dashboard', 'Compare', 'Research', 'Methodology'];

// ⚡️ Routing optimized: Research now flows directly into Methodology
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
        // Maine yahan naam change karke cybermap.jpeg kar diya hai
        backgroundImage: `linear-gradient(to bottom, rgba(2, 6, 23, 0.85), rgba(5, 8, 20, 0.95)), url('/cybermap.jpeg')`
      }}
    >
      
      {/* ── COMMAND HEADER ── */}
      {/* Made slightly more transparent (bg-black/80) to let the background bleed through */}
      <header className="fixed top-0 left-0 w-full flex items-center justify-between px-6 md:px-12 py-4 z-[500] bg-black/80 backdrop-blur-md border-b border-white/10 h-[72px]">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 border border-indigo-500/50 flex items-center justify-center bg-indigo-500/10 rounded-sm">
             <span className="text-indigo-400 font-mono text-xs font-bold tracking-tighter">OP</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-100 font-mono tracking-[0.3em] text-[10px] uppercase">OpenPlanet</span>
            <span className="text-slate-400 font-mono tracking-[0.2em] text-[8px] uppercase">Risk Intelligence</span>
          </div>
        </div>
        <div className="flex items-center relative">
          <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-3 px-4 py-2 border border-white/10 rounded-sm hover:border-white/30 transition-all bg-white/5">
            <span className="text-[9px] font-mono text-slate-300 tracking-widest uppercase">{session?.user?.name?.split(' ')[0] || "USER"}</span>
          </button>
          {isDropdownOpen && (
            <div className="absolute top-14 right-0 w-48 bg-black/90 backdrop-blur-xl border border-white/10 rounded-sm p-2 flex flex-col shadow-2xl">
              <button onClick={() => signOut({ callbackUrl: '/' })} className="w-full text-left px-3 py-2 text-[10px] font-mono text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-sm uppercase tracking-widest transition-colors">Sign Out</button>
            </div>
          )}
        </div>
      </header>

      <div className="pt-[72px] flex flex-col w-full flex-grow">
        
        {/* ── TACTICAL SUB-NAV (LOCKED UNTIL TARGET ACQUIRED) ── */}
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
            {/* We pass the lock function to the Map Module */}
            {activeTab === "Dashboard" && (
                <MapModule onTargetLocked={(city: string) => setTargetCity(city)} />
            )}
            
            <div className={activeTab === "Dashboard" ? "" : "max-w-[1600px] w-full mx-auto px-6 md:px-12 py-12"}>
                {activeTab === "Compare"     && targetCity && <CompareModule baseTarget={targetCity} />}
                {activeTab === "Research"    && targetCity && <ResearchModule baseTarget={targetCity} />}
                {activeTab === "Methodology" && <MethodologyModule />}
            </div>

            {/* ── PROGRESSION ROUTER (NEXT PAGE BUTTONS) ── */}
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

      <footer className="w-full border-t border-white/10 bg-black/60 backdrop-blur-md py-8 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between relative z-40 mt-auto">
        <p className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">&copy; 2026 OPENPLANET. All rights reserved.</p>
      </footer>
    </main>
  );
}