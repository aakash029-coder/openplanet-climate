import type { Metadata } from 'next';
import { Instrument_Serif, Source_Serif_4, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';
import 'katex/dist/katex.min.css';
import Navbar from '@/components/Navbar';
import SiteFooter from '@/components/SiteFooter';
import { Providers } from '@/components/Providers';
import { CookieBanner } from '@/components/CookieBanner';
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

        {/* World map basemap — glossy atmospheric backdrop */}
        <img
          src="/satellite-map.jpeg"
          alt=""
          aria-hidden="true"
          className="world-map-bg"
        />
        <div className="world-map-overlay" aria-hidden="true" />

        <Providers>
          <div className="flex flex-col min-h-screen relative z-10">
            <Navbar />

            <main className="flex-1 flex flex-col pt-10">
              {children}
            </main>

            <SiteFooter />
          </div>
          <CookieBanner />
        </Providers>

      </body>
      <GoogleAnalytics gaId="G-ZVH6C10YRD" />
    </html>
  );
}
