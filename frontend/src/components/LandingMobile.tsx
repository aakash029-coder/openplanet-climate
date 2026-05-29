'use client';

import dynamic from 'next/dynamic';
import { ClimateDataProvider } from '@/context/ClimateDataContext';

// MobileProjection contains MapLibre GL + deck.gl which require browser WebGL APIs.
// Must be dynamically imported with ssr:false — identical pattern to MapModule in the dashboard.
const MobileProjection = dynamic(
  () => import('@/components/MobileProjection'),
  {
    ssr: false,
    loading: () => (
      <div className="w-full flex flex-col" style={{ minHeight: '100dvh', background: 'var(--canvas)' }}>
        {/* Skeleton header */}
        <div className="flex items-center justify-between px-4 py-2.5"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] font-semibold"
                style={{ color: 'var(--muted)' }}>
            OpenPlanet · Climate Risk
          </span>
        </div>
        {/* Skeleton sub-nav matches MobileProjection structure to prevent layout jump */}
        <div className="flex w-full"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.3)' }}>
          {['DASHBOARD', 'DEEP DIVE', 'COMPARE', 'METHODOLOGY'].map((tab, i) => (
            <div key={tab} className="relative px-4 py-2.5 shrink-0 font-mono text-[10px] uppercase tracking-[0.12em]"
                 style={{ color: i === 0 ? 'var(--text)' : 'rgba(255,255,255,0.28)' }}>
              {tab}
              {i === 0 && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px]"
                      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)' }} />
              )}
            </div>
          ))}
        </div>
        {/* Centred spinner */}
        <div className="flex-1 flex items-center justify-center">
          <div className="relative w-7 h-7">
            <div className="absolute inset-0 rounded-full border border-white/[0.06] border-t-white/30 animate-spin" />
            <div className="absolute inset-1.5 rounded-full border border-white/[0.04] border-t-white/20 animate-spin"
                 style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
          </div>
        </div>
      </div>
    ),
  }
);

export default function LandingMobile() {
  return (
    <ClimateDataProvider>
      <div className="w-full pt-16">
        <MobileProjection />
      </div>
    </ClimateDataProvider>
  );
}
