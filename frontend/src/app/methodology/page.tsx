'use client';

import MethodologyModule from '@/components/MethodologyModule';
import { ClimateDataProvider } from '@/context/ClimateDataContext';

export default function MethodologyPage() {
  return (
    <ClimateDataProvider>
      <div className="w-full max-w-5xl mx-auto px-5 md:px-10 py-12 md:py-16">
        <div className="mb-10 pb-6" style={{ borderBottom: '1px solid var(--hairline)' }}>
          <p className="font-mono text-[9px] uppercase tracking-[0.3em] mb-3" style={{ color: 'var(--muted)' }}>
            Working Paper · OpenPlanet Climate Risk Engine
          </p>
          <h1 className="font-sans text-2xl md:text-3xl font-bold tracking-tight mb-3" style={{ color: 'var(--text)' }}>
            Scientific Methodology &amp; Model Documentation
          </h1>
          <p className="font-serif text-sm leading-relaxed max-w-2xl" style={{ color: 'var(--text-2)' }}>
            All epidemiological, economic, and thermodynamic models used to generate city-level
            heat risk projections. Every constant is sourced from peer-reviewed literature.
            Every equation is reproduced exactly as published.
          </p>
        </div>
        <MethodologyModule />
      </div>
    </ClimateDataProvider>
  );
}
