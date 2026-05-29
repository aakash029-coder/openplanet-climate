'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from "next/dynamic";

import CompareModule from "@/components/CompareModule";
import ResearchModule from "@/components/ResearchModule";
import MethodologyModule from "@/components/MethodologyModule";
import { ClimateDataProvider } from "@/context/ClimateDataContext";

const MapModule = dynamic(() => import("@/components/MapModule"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[820px] flex flex-col items-center justify-center"
         style={{ background: 'var(--canvas)' }}>
      <div className="w-6 h-6 border border-white/20 border-t-white/50 rounded-full animate-spin" />
      <span className="mt-4 font-mono text-[10px] uppercase tracking-[0.2em]"
            style={{ color: 'var(--muted)' }}>Loading map…</span>
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
    const check = () => {
      if (sessionStorage.getItem('hasSeenDesktopWarning')) return;
      if (window.innerWidth < 1024) setShowWarningModal(true);
    };
    check();
    const onResize = () => {
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
      resizeTimerRef.current = setTimeout(check, 100);
    };
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('resize', onResize);
      if (resizeTimerRef.current) clearTimeout(resizeTimerRef.current);
    };
  }, []);

  const dismissWarning = () => {
    sessionStorage.setItem('hasSeenDesktopWarning', 'true');
    setShowWarningModal(false);
  };

  useEffect(() => {
    setVisitedTabs(prev => { const s = new Set(prev); s.add(activeTab); return s; });
  }, [activeTab]);

  const handleReset = () => {
    setTargetCity(null);
    setActiveTab('Dashboard');
    setVisitedTabs(new Set(['Dashboard']));
  };

  return (
    <div className="relative font-sans overflow-x-hidden flex flex-col w-full min-h-screen" style={{ background: 'var(--canvas)', color: 'var(--text)' }}>

      {/* Mobile warning modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm bg-[#08080a] border border-white/[0.06] p-8">
            <button onClick={dismissWarning} className="absolute top-4 right-4 text-zinc-600 hover:text-white transition-colors p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="text-center space-y-4">
              <div className="w-10 h-10 bg-white/[0.03] border border-white/[0.06] rounded-full flex items-center justify-center mx-auto">
                <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-sm font-sans font-semibold text-white tracking-tight">Desktop Recommended</h3>
              <p className="text-[11px] text-zinc-500 leading-relaxed font-sans">
                OpenPlanet's high-resolution maps and data models are optimised for desktop. The full experience may be limited on mobile.
              </p>
              <button
                onClick={dismissWarning}
                className="mt-4 w-full py-3 bg-white text-black font-sans font-semibold text-xs uppercase tracking-wider transition-colors hover:bg-zinc-100"
              >
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard tab nav */}
      <nav className="w-full bg-[var(--canvas)]/95 backdrop-blur-xl border-b pt-20 sticky top-0 z-[40]" style={{ borderBottomColor: 'var(--hairline)' }}>
        <div className="w-full flex items-center justify-between px-6 md:px-12 lg:px-16 py-3 text-[11px] font-mono uppercase tracking-[0.2em]">
          <div className="flex items-center gap-1">
            {TABS.map((tab) => {
              const isLocked = !targetCity && tab !== 'Dashboard';
              const isActive = activeTab === tab;
              return (
                <button
                  key={tab}
                  disabled={isLocked}
                  onClick={() => setActiveTab(tab)}
                  className={`relative whitespace-nowrap transition-all duration-150 px-3 py-2 font-sans text-[11px] uppercase tracking-[0.12em] font-medium border-b-2
                    ${isActive
                      ? 'border-current'
                      : isLocked
                      ? 'border-transparent cursor-not-allowed'
                      : 'border-transparent hover:border-current/30'
                    }`}
                  style={{
                    color: isActive ? 'var(--text)' : isLocked ? 'var(--muted)' : 'var(--text-2)',
                  }}
                >
                  {tab}
                </button>
              );
            })}
          </div>

          {targetCity && (
            <span className="font-mono text-[10px] px-3 py-1 uppercase tracking-[0.14em]"
                  style={{ color: 'var(--positive)', border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
              {targetCity}
            </span>
          )}
        </div>
      </nav>

      {/* Content */}
      <div className="w-full h-full flex flex-col flex-grow">
        <div className={activeTab === "Dashboard" ? "block w-full" : "hidden"}>
          <MapModule onTargetLocked={(city: string) => setTargetCity(city)} />
        </div>

        <div className={activeTab !== "Dashboard" ? "max-w-[1400px] w-full mx-auto px-6 md:px-12 py-16" : "hidden"}>
          {visitedTabs.has('Deep Dive') && targetCity && (
            <div className={activeTab === "Deep Dive" ? "block" : "hidden"}>
              <ResearchModule baseTarget={targetCity} />
            </div>
          )}
          {visitedTabs.has('Compare') && targetCity && (
            <div className={activeTab === "Compare" ? "block" : "hidden"}>
              <CompareModule baseTarget={targetCity} />
            </div>
          )}
          {visitedTabs.has('Methodology') && (
            <div className={activeTab === "Methodology" ? "block" : "hidden"}>
              <MethodologyModule />
            </div>
          )}
        </div>

        {targetCity && (
          <div className="max-w-md w-full mx-auto px-6 pb-24 mt-auto relative z-10">
            {NEXT_TAB_MAP[activeTab] ? (
              <button
                onClick={() => setActiveTab(NEXT_TAB_MAP[activeTab]!)}
                className="w-full py-3.5 text-[10px] font-mono font-bold tracking-[0.2em] uppercase transition-all bg-white/[0.01] hover:bg-white/[0.03] hover:text-white flex items-center justify-center gap-3"
                style={{ border: '1px solid var(--hairline)', color: 'var(--text-2)' }}
              >
                {NEXT_TAB_MAP[activeTab]} →
              </button>
            ) : (
              <button
                onClick={handleReset}
                className="w-full py-3.5 text-[10px] font-mono font-bold tracking-[0.2em] uppercase transition-all bg-white/[0.01] hover:bg-white/[0.03] hover:text-white flex items-center justify-center gap-3"
                style={{ border: '1px solid var(--hairline)', color: 'var(--text-2)' }}
              >
                ↺ New analysis
              </button>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="flex flex-col items-center justify-center text-center gap-2 mt-16 pt-8 pb-12 border-t border-white/[0.04] relative z-20">
        <p className="text-[9px] font-mono text-zinc-700 uppercase tracking-[0.2em] font-bold">Disclaimer</p>
        <p className="text-[10px] leading-relaxed max-w-4xl px-6 font-serif text-body-ui" style={{ color: 'var(--muted)' }}>
          OpenPlanet is a computational estimation engine based on global meta-analyses (Gasparrini 2017, Burke 2018). It is designed for directional risk visualization and strategic planning, not localized actuarial or medical forecasting. All outputs are model-driven estimates and do not constitute professional operational advice.
        </p>
      </div>

    </div>
  );
}

export default function DashboardPage() {
  return (
    <ClimateDataProvider>
      <DashboardPageInner />
    </ClimateDataProvider>
  );
}
