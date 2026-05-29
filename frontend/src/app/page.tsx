'use client';

import dynamic from 'next/dynamic';
import LandingDesktop from '@/components/LandingDesktop';

// LandingMobile contains MapLibre GL and deck.gl which require browser APIs —
// must not SSR.
const LandingMobile = dynamic(() => import('@/components/LandingMobile'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-screen flex items-center justify-center"
         style={{ background: 'var(--canvas)' }}>
      <div className="relative w-7 h-7">
        <div className="absolute inset-0 rounded-full border border-white/[0.06] border-t-white/30 animate-spin" />
        <div className="absolute inset-1.5 rounded-full border border-white/[0.04] border-t-white/20 animate-spin"
             style={{ animationDirection: 'reverse', animationDuration: '0.7s' }} />
      </div>
    </div>
  ),
});

export default function HomePage() {
  return (
    <>
      <div className="hidden md:block w-full">
        <LandingDesktop />
      </div>
      <div className="block md:hidden w-full">
        <LandingMobile />
      </div>
    </>
  );
}
