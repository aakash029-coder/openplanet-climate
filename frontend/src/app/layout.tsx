import type { Metadata } from 'next';
import { Instrument_Serif, Source_Serif_4, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import 'katex/dist/katex.min.css';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Providers } from '@/components/Providers';
import { GoogleAnalytics } from '@next/third-parties/google';

// ── Four-typeface system — each font has exactly one role ─────────────────
const displayFont = Instrument_Serif({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-display',
  display: 'swap',
});

const readingFont = Source_Serif_4({
  subsets: ['latin'],
  weight: ['400', '600'],
  variable: '--font-reading',
  display: 'swap',
});

const uiFont = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-sans',
  display: 'swap',
});

const dataFont = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://www.openplanetrisk.com'),
  title: 'OpenPlanet | Climate Risk Intelligence',
  description: 'Research-grade heat risk projections for any city. Peer-reviewed methodology: Gasparrini 2017, Burke 2018, CMIP6. UNDRR PreventionWeb · Climatebase.',
  verification: { google: 'AteFZ_PNhw-ABwNOcaDMqNI6VD4Somp4TQ9xk7Eqmy8' },
  openGraph: {
    title: 'OpenPlanet | Climate Risk Intelligence',
    description: 'Research-grade heat risk projections for any city.',
    url: 'https://www.openplanetrisk.com',
    siteName: 'OpenPlanet',
    locale: 'en_US',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OpenPlanet | Climate Risk Intelligence',
    description: 'Research-grade heat risk projections for any city.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${displayFont.variable} ${readingFont.variable} ${uiFont.variable} ${dataFont.variable}`}
    >
      <body className="font-sans min-h-screen overflow-x-hidden selection:bg-white/[0.08]"
            style={{ color: 'var(--text)', background: 'var(--canvas)' }}>

        {/* Faint graticule basemap — structural, not decorative */}
        <img
          src="/satellite-map.jpeg"
          alt=""
          aria-hidden="true"
          className="fixed inset-0 w-full h-full object-cover pointer-events-none z-0"
          style={{
            opacity: 0.05,
            filter: 'saturate(0) contrast(1.05)',
            mixBlendMode: 'luminosity',
            transform: 'translate3d(0,0,0)',
          }}
        />

        <Providers>
          <div className="flex flex-col min-h-screen relative z-10">
            <Navbar />

            <main className="flex-1 flex flex-col pt-10">
              {children}
            </main>

            {/* Footer */}
            <footer className="mt-auto relative z-50 border-t bg-[var(--canvas)] py-8 px-6 md:px-12"
                    style={{ borderColor: 'var(--hairline)' }}>
              <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-6 lg:gap-4">

                {/* Brand */}
                <div className="flex items-center gap-4">
                  <img src="/logo.jpeg" alt="OpenPlanet Logo"
                       className="w-7 h-7 object-cover"
                       style={{ border: '1px solid var(--hairline)' }} />
                  <div className="flex flex-col">
                    <span className="text-sm font-sans font-semibold tracking-tight leading-none mb-1"
                          style={{ color: 'var(--text)' }}>OpenPlanet</span>
                    <span className="text-[8px] font-mono tracking-[0.25em] leading-none uppercase"
                          style={{ color: 'var(--muted)' }}>Risk Intelligence</span>
                  </div>
                </div>

                {/* Climatebase */}
                <a
                  href="https://www.climatebase.org/company/1142537/openplanet-risk-intelligence"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-center transition-colors duration-150 hover:opacity-80"
                >
                  <span className="block font-mono text-[10px] tracking-[0.15em] uppercase"
                        style={{ color: 'var(--text-2)' }}>Recognized on Climatebase</span>
                  <span className="block font-mono text-[8px] tracking-[0.15em] uppercase mt-0.5"
                        style={{ color: 'var(--muted)' }}>Listed in the Climatebase Directory</span>
                </a>

                {/* Links */}
                <div className="flex gap-5 text-[9px] uppercase tracking-[0.25em] font-mono items-center"
                     style={{ color: 'var(--muted)' }}>
                  <Link href="/privacy" className="hover:text-white transition-colors">Privacy</Link>
                  <Link href="/terms"   className="hover:text-white transition-colors">Terms</Link>
                  <Link href="/support" className="hover:text-white transition-colors">Support</Link>
                  <a href="https://www.linkedin.com/company/openplanet-climate/"
                     target="_blank" rel="noopener noreferrer"
                     className="hover:text-white transition-colors ml-2 pl-4"
                     style={{ borderLeft: '1px solid var(--hairline)' }}
                     aria-label="OpenPlanet LinkedIn">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                    </svg>
                  </a>
                </div>

              </div>

              {/* Persistent provenance strip — §1 of design brief */}
              <div className="max-w-7xl mx-auto mt-6 pt-4"
                   style={{ borderTop: '1px solid var(--hairline)' }}>
                <p className="font-mono text-[11px] text-center leading-relaxed"
                   style={{ color: 'var(--muted)' }}>
                  DATA: Copernicus C3S (ERA5 · CMIP6) · MODELS: Gasparrini 2017, Burke 2018, Stull 2011
                  {' '}· INDEXED: UNDRR PreventionWeb · CAKE · Climatebase · v2.0
                </p>
              </div>
            </footer>
          </div>
        </Providers>

      </body>
      <GoogleAnalytics gaId="G-ZVH6C10YRD" />
    </html>
  );
}
