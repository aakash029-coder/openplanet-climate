'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import dynamic from "next/dynamic";

import CompareModule from "@/components/CompareModule";
import ResearchModule from "@/components/ResearchModule";
import MethodologyModule from "@/components/MethodologyModule";
import { ClimateDataProvider } from "@/context/ClimateDataContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const MapModule = dynamic(() => import("@/components/MapModule"), {
  ssr: false,
  loading: () => (
    <div className="w-full flex flex-col items-center justify-center min-h-[480px] md:min-h-[600px]"
         style={{ background: 'var(--canvas)' }}>
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 rounded-full border border-white/[0.06] border-t-white/30 animate-spin" />
        <div className="absolute inset-1.5 rounded-full border border-white/[0.04] border-t-white/20 animate-spin"
             style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
      </div>
      <span className="mt-5 font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--muted)' }}>
        Loading map…
      </span>
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
  const { data: session }         = useSession();
  const [activeTab, setActiveTab]     = useState<Tab>('Dashboard');
  const [targetCity, setTargetCity]   = useState<string | null>(null);
  const [visitedTabs, setVisitedTabs] = useState<Set<Tab>>(new Set(['Dashboard']));
  const [showWarningModal, setShowWarningModal] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const resizeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }, []);

  useEffect(() => {
    const check = () => {
      if (sessionStorage.getItem('hasSeenDesktopWarning')) return;
      if (window.innerWidth < 768) setShowWarningModal(true);
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

  // Snap viewport to top on every tab transition
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
    const container = document.getElementById('dashboard-scroll-container')
      || document.querySelector('.dashboard-viewport-gate') as HTMLElement | null;
    if (container) container.scrollTop = 0;
  }, [activeTab]);

  const handleReset = () => {
    setTargetCity(null);
    setActiveTab('Dashboard');
    setVisitedTabs(new Set(['Dashboard']));
  };

  return (
    <div className="relative font-sans overflow-x-hidden flex flex-col w-full min-h-screen"
         style={{ background: 'var(--canvas)', color: 'var(--text)' }}>

      {/* Mobile warning modal */}
      {showWarningModal && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/90 p-4"
             style={{ backdropFilter: 'blur(16px)' }}>
          <div className="relative w-full max-w-sm overflow-hidden animate-fadeSlideUp"
               style={{ background: 'var(--panel)', border: '1px solid var(--hairline)' }}>
            <div className="h-px w-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)' }} />
            <div className="p-8">
              <button onClick={dismissWarning}
                      className="absolute top-4 right-4 w-9 h-9 flex items-center justify-center transition-colors hover:text-white"
                      style={{ color: 'var(--muted)' }}>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="text-center space-y-5">
                <div className="w-12 h-12 glass flex items-center justify-center mx-auto"
                     style={{ border: '1px solid var(--hairline)' }}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                       style={{ color: 'var(--text-2)' }}>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                          d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-sans font-semibold tracking-tight mb-2" style={{ color: 'var(--text)' }}>
                    Desktop Recommended
                  </h3>
                  <p className="text-[11px] leading-relaxed font-sans" style={{ color: 'var(--muted)' }}>
                    OpenPlanet's high-resolution maps and data models are optimised for desktop.
                    The full experience may be limited on mobile.
                  </p>
                </div>
                <button
                  onClick={dismissWarning}
                  className="w-full min-h-[48px] bg-white text-black font-sans font-semibold text-xs uppercase tracking-wider transition-colors hover:bg-zinc-100 btn-primary"
                >
                  Continue Anyway
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dashboard tab nav */}
      <nav className="w-full glass-nav border-b pt-16 sticky top-0 z-[40]"
           style={{ borderBottomColor: 'var(--hairline)' }}>
        <div className="w-full overflow-x-auto scrollbar-none relative">
          {/* Right-edge fade hints at more tabs on narrow viewports */}
          <div className="absolute right-0 top-0 bottom-0 w-10 pointer-events-none lg:hidden z-10"
               style={{ background: 'linear-gradient(to right, transparent, var(--canvas))' }} />
          <div className="flex items-center justify-between px-4 md:px-10 lg:px-16 min-w-max md:min-w-0 w-full">
            <div className="flex items-center">
              {TABS.map((tab) => {
                const isLocked = !targetCity && tab !== 'Dashboard';
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    disabled={isLocked}
                    onClick={() => setActiveTab(tab)}
                    className={`relative whitespace-nowrap transition-all duration-200 px-3 md:px-5 font-sans text-[10px] md:text-[11px] uppercase tracking-[0.12em] font-medium flex items-center min-h-[52px]
                      ${isActive      ? '' : ''}
                      ${isLocked      ? 'cursor-not-allowed' : 'hover:text-white'}
                    `}
                    style={{
                      color: isActive ? 'var(--text)' : isLocked ? 'var(--muted)' : 'var(--text-2)',
                    }}
                  >
                    {tab}
                    {/* Active indicator */}
                    <span
                      className="absolute bottom-0 left-0 right-0 h-[2px] transition-all duration-200"
                      style={{
                        background: isActive
                          ? 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)'
                          : 'transparent',
                        opacity: isActive ? 1 : 0,
                      }}
                    />
                    {/* Lock indicator */}
                    {isLocked && (
                      <svg className="ml-1.5 w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"
                           style={{ color: 'var(--muted)', opacity: 0.5 }}>
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>

            {targetCity && (
              <div className="ml-4 flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-2 px-3 py-1.5"
                     style={{ border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--positive)' }} />
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'var(--positive)' }}>
                    {targetCity}
                  </span>
                </div>
                <button
                  onClick={handleCopyLink}
                  aria-label="Copy shareable link"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 font-mono uppercase tracking-[0.14em] transition-colors duration-150 hover:text-white"
                  style={{ fontSize: '0.625rem', color: linkCopied ? 'var(--positive)' : 'var(--text-2)', border: '1px solid var(--hairline)', background: 'var(--raised)' }}
                >
                  {linkCopied ? (
                    <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>Copied</>
                  ) : (
                    <><svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>Copy link</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Content */}
      <div className="w-full h-full flex flex-col flex-grow">
        <div className={activeTab === "Dashboard" ? "block w-full" : "hidden"}>
          <ErrorBoundary>
            <MapModule onTargetLocked={(city: string) => setTargetCity(city)} />
          </ErrorBoundary>
        </div>

        <div className={(activeTab === "Deep Dive" || activeTab === "Compare") ? "max-w-[1400px] w-full mx-auto px-5 md:px-10 py-14 md:py-16" : "hidden"}>
          {visitedTabs.has('Deep Dive') && targetCity && (
            <div className={activeTab === "Deep Dive" ? "block" : "hidden"}>
              <ErrorBoundary>
                <ResearchModule baseTarget={targetCity} />
              </ErrorBoundary>
            </div>
          )}
          {visitedTabs.has('Compare') && targetCity && (
            <div className={activeTab === "Compare" ? "block" : "hidden"}>
              <ErrorBoundary>
                <CompareModule baseTarget={targetCity} />
              </ErrorBoundary>
            </div>
          )}
        </div>

        {visitedTabs.has('Methodology') && (
          <div className={activeTab === "Methodology" ? "block w-full" : "hidden"}>
            <MethodologyModule />
          </div>
        )}

        {targetCity && (
          <div className="max-w-md w-full mx-auto px-5 pb-16 mt-auto">
            {NEXT_TAB_MAP[activeTab] ? (
              <button
                onClick={() => setActiveTab(NEXT_TAB_MAP[activeTab]!)}
                className="w-full min-h-[52px] text-[10px] font-mono font-bold tracking-[0.2em] uppercase transition-all duration-150 hover:text-white flex items-center justify-center gap-3 btn-primary"
                style={{ border: '1px solid var(--hairline)', color: 'var(--text-2)', background: 'var(--raised)' }}
              >
                {NEXT_TAB_MAP[activeTab]} →
              </button>
            ) : (
              <button
                onClick={handleReset}
                className="w-full min-h-[52px] text-[10px] font-mono font-bold tracking-[0.2em] uppercase transition-all duration-150 hover:text-white flex items-center justify-center gap-3 btn-primary"
                style={{ border: '1px solid var(--hairline)', color: 'var(--text-2)', background: 'var(--raised)' }}
              >
                ↺ New analysis
              </button>
            )}
          </div>
        )}
      </div>

      {/* Disclaimer */}
      <div className="flex flex-col items-center justify-center text-center gap-2 mt-16 pt-8 pb-12 relative z-20"
           style={{ borderTop: '1px solid var(--hairline)' }}>
        <p className="text-[9px] font-mono uppercase tracking-[0.25em] font-bold" style={{ color: 'var(--muted)' }}>
          Disclaimer
        </p>
        <p className="text-[10px] leading-relaxed max-w-4xl px-6 font-serif text-body-ui" style={{ color: 'var(--muted)' }}>
          OpenPlanet is a computational estimation engine based on global meta-analyses (Gasparrini 2017, Burke 2018).
          Designed for directional risk visualization and strategic planning, not localized actuarial or medical forecasting.
          All outputs are model-driven estimates and do not constitute professional operational advice.
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
