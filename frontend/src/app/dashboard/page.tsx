'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from "next/dynamic";

import CompareModule from "@/components/CompareModule";
import ResearchModule from "@/components/ResearchModule";
import MethodologyModule from "@/components/MethodologyModule";
import { ClimateDataProvider } from "@/context/ClimateDataContext";

// ── STEP 1: DYNAMIC IMPORT (SSR: FALSE) ──
// Yehi asli fix hai jo Vercel build ko pass karwayega
const MapModule = dynamic(() => import("@/components/MapModule"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[820px] bg-[#020617] flex flex-col items-center justify-center relative z-10">
      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 border-t-2 border-r-2 border-cyan-400/80 rounded-full animate-spin"></div>
        <div className="absolute w-10 h-10 border-b-2 border-l-2 border-blue-400/60 rounded-full animate-spin-reverse"></div>
      </div>
      <span className="mt-8 font-mono text-[10px] text-cyan-400 tracking-[0.5em] uppercase animate-pulse">Establishing Uplink...</span>
    </div>
  )
});

type Tab = 'Dashboard' | 'Deep Dive' | 'Compare' | 'Methodology';
const TABS: Tab[] = ['Dashboard', 'Deep Dive', 'Compare', 'Methodology'];
const NEXT_TAB_MAP: Record<Tab, Tab | null> = {
  'Dashboard':   'Deep Dive',
  'Deep Dive':   'Compare',
  'Compare':     'Methodology',
  'Methodology': null,
};

function DashboardPageInner() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab]     = useState<Tab>('Dashboard');
  const [targetCity, setTargetCity]   = useState<string | null>(null);
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set(['Dashboard']));
  const [showWarningModal, setShowWarningModal] = useState(false);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const checkScreenSize = () => {
      const hasSeenWarning = sessionStorage.getItem('hasSeenDesktopWarning');
      if (hasSeenWarning) return;
      if (window.innerWidth < 1024) setShowWarningModal(true);
    };
    checkScreenSize();
    const handleResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(checkScreenSize, 100);
    };
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, []);

  const handleDismissWarning = () => {
    sessionStorage.setItem('hasSeenDesktopWarning', 'true');
    setShowWarningModal(false);
  };

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
    setVisitedTabs(new Set(['Dashboard']));
  };

  return (
    <div className="relative text-slate-200 font-sans overflow-x-hidden flex flex-col w-full min-h-screen bg-[#020617]">

      {/* ── MODAL ── */}
      {showWarningModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm bg-[#0a0f1d] border border-cyan-500/30 p-8 rounded-2xl shadow-[0_0_40px_rgba(34,211,238,0.15)]">
            <button onClick={handleDismissWarning} className="absolute top-4 right-4 text-slate-500 hover:text-white transition-colors p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="text-center space-y-4">
              <div className="w-12 h-12 bg-cyan-900/30 text-cyan-400 rounded-full flex items-center justify-center mx-auto border border-cyan-500/20">
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-bold text-white uppercase tracking-widest">Desktop Recommended</h3>
              <p className="text-[10px] text-slate-400 leading-relaxed uppercase tracking-wider">
                OpenPlanet's high-resolution maps and data models are complex. For the full experience, please switch to a desktop or large tablet.
              </p>
              <button onClick={handleDismissWarning} className="mt-4 w-full py-3 bg-cyan-900/40 border border-cyan-500/30 text-cyan-100 text-[10px] font-bold uppercase tracking-[0.2em] rounded-lg hover:bg-cyan-800 transition-colors">
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Background ── */}
      <img
        src="/cybermap.jpeg"
        alt="Cyber Map Background"
        className="fixed inset-0 w-full h-full object-cover opacity-40 pointer-events-none z-0 mix-blend-screen"
        style={{ transform: 'translate3d(0, 0, 0)', willChange: 'transform', backfaceVisibility: 'hidden' }}
      />
      <div className="fixed inset-0 bg-gradient-to-b from-[#020617]/40 via-[#020617]/80 to-[#020617]/40 pointer-events-none z-0" />

      <div className="flex flex-col w-full flex-grow relative z-10">

        {/* ── TAB NAV ── */}
        <nav className="w-full bg-[#06101f]/90 backdrop-blur-3xl border-b border-slate-800/60 pt-20 sticky top-0 z-[40] shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
          <div className="w-full flex items-center justify-between px-8 lg:px-16 xl:px-24 py-4 text-[11px] font-mono uppercase tracking-[0.25em] relative">
            <div className="flex items-center gap-2">
              {TABS.map((tab) => {
                const isLocked = !targetCity && tab !== 'Dashboard';
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    disabled={isLocked}
                    onClick={() => setActiveTab(tab)}
                    className={`relative whitespace-nowrap transition-all duration-300 px-4 py-2 group rounded-md
                      ${isActive ? 'text-white font-bold bg-slate-800/50 border border-slate-700/50' : 'border border-transparent'}
                      ${isLocked ? 'text-slate-600 cursor-not-allowed' : ''}
                      ${!isActive && !isLocked ? 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30' : ''}
                    `}
                  >
                    {tab}
                  </button>
                );
              })}
            </div>
            {targetCity && (
              <div className="absolute right-8 lg:right-16 xl:right-24 text-[9px] font-mono text-emerald-400 uppercase tracking-widest border border-emerald-900/50 bg-emerald-950/30 px-3 py-1.5 rounded flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                LOCKED: <span className="font-bold text-white">{targetCity}</span>
              </div>
            )}
          </div>
        </nav>

        {/* ── CONTENT ── */}
        <div className="w-full h-full flex flex-col flex-grow">
          <div className={activeTab === "Dashboard" ? "block w-full" : "hidden"}>
            <MapModule onTargetLocked={(city: string) => setTargetCity(city)} />
          </div>

          <div className={activeTab !== "Dashboard" ? "max-w-[1400px] w-full mx-auto px-6 md:px-12 py-16" : "hidden"}>
            {visitedTabs.has('Deep Dive') && targetCity && (
              <div className={activeTab === "Deep Dive" ? "block animate-in fade-in duration-700" : "hidden"}>
                <ResearchModule baseTarget={targetCity} />
              </div>
            )}

            {visitedTabs.has('Compare') && targetCity && (
              <div className={activeTab === "Compare" ? "block animate-in fade-in duration-700" : "hidden"}>
                <CompareModule baseTarget={targetCity} />
              </div>
            )}

            {visitedTabs.has('Methodology') && (
              <div className={activeTab === "Methodology" ? "block animate-in fade-in duration-700" : "hidden"}>
                <MethodologyModule />
              </div>
            )}
          </div>

          {targetCity && (
            <div className="max-w-md w-full mx-auto px-6 pb-24 mt-auto relative z-10">
              {NEXT_TAB_MAP[activeTab] ? (
                <button
                  onClick={() => setActiveTab(NEXT_TAB_MAP[activeTab]!)}
                  className="w-full py-4 rounded-lg text-[10px] font-mono font-bold tracking-[0.2em] text-slate-300 uppercase transition-all border border-slate-700 bg-slate-800/40 backdrop-blur-xl hover:bg-slate-700 hover:text-white hover:border-slate-500 flex items-center justify-center gap-3"
                >
                  INITIALIZE {NEXT_TAB_MAP[activeTab]} PROTOCOL →
                </button>
              ) : (
                <button
                  onClick={handleReset}
                  className="w-full py-4 rounded-lg text-[10px] font-mono font-bold tracking-[0.2em] text-slate-300 uppercase transition-all border border-slate-700 bg-slate-800/40 backdrop-blur-xl hover:bg-slate-700 hover:text-white hover:border-slate-500 flex items-center justify-center gap-3"
                >
                  ↺ ANALYZE NEW LOCATION
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── PROFESSIONAL DISCLAIMER FOOTER (CENTERED STACKED) ── */}
      <div className="flex flex-col items-center justify-center text-center gap-3 mt-16 pt-8 pb-12 border-t border-white/10 opacity-50 relative z-20">
        <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.2em] uppercase text-slate-400">
          <div className="w-2 h-2 bg-slate-500"></div> DISCLAIMER
        </div>
        
        <p className="text-xs text-slate-500 leading-relaxed max-w-4xl px-6">
          OpenPlanet is a computational estimation engine based on global meta-analyses (Gasparrini 2017, Burke 2018). It is designed for directional risk visualization and strategic planning, not localized actuarial or medical forecasting. All outputs are model-driven estimates and do not constitute professional operational advice.
        </p>
      </div>

    </div>
  );
}

// ── FINAL EXPORT ──
export default function DashboardPage() {
  return (
    <ClimateDataProvider>
      <DashboardPageInner />
    </ClimateDataProvider>
  );
}