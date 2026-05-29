'use client';

import dynamic from 'next/dynamic';
import { ClimateDataProvider } from '@/context/ClimateDataContext';

const MapModule = dynamic(() => import('@/components/MapModule'), {
  ssr: false,
  loading: () => (
    <div className="w-full flex flex-col items-center justify-center h-[40vh]"
         style={{ background: 'var(--canvas)' }}>
      <div className="relative w-8 h-8">
        <div className="absolute inset-0 rounded-full border border-white/[0.06] border-t-white/30 animate-spin" />
        <div className="absolute inset-1.5 rounded-full border border-white/[0.04] border-t-white/20 animate-spin"
             style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
      </div>
      <span className="mt-5 font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--muted)' }}>
        Loading…
      </span>
    </div>
  ),
});

export default function LandingMobile() {
  return (
    <ClimateDataProvider>
      <div className="w-full pt-16" style={{ background: 'var(--canvas)' }}>
        <MapModule />
      </div>
    </ClimateDataProvider>
  );
}
