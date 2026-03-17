import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Providers } from '@/components/Providers';
import { GoogleAnalytics } from '@next/third-parties/google';

export const metadata: Metadata = {
  metadataBase: new URL('https://openplanet-ai.vercel.app'),
  
  title: 'OpenPlanet | Climate Risk Intelligence',
  description: 'OpenPlanet is a globally scalable climate intelligence engine. We translate complex planetary physics into highly actionable, localized survival strategies.',
  
  verification: {
    google: 'AteFZ_PNhw-ABwNOcaDMqNI6VD4Somp4TQ9xk7Eqmy8', 
  },

  openGraph: {
    title: 'OpenPlanet | Climate Risk Intelligence',
    description: 'OpenPlanet is a globally scalable climate intelligence engine. We translate complex planetary physics into highly actionable, localized survival strategies.',
    url: 'https://openplanet-ai.vercel.app',
    siteName: 'OpenPlanet',
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'OpenPlanet | Climate Risk Intelligence',
    description: 'OpenPlanet is a globally scalable climate intelligence engine. We translate complex planetary physics into highly actionable, localized survival strategies.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-mono min-h-screen text-slate-200 relative selection:bg-cyan-500/30 bg-[#060d1a] overflow-x-hidden">
        
        {/* ✅ GPU hardware acceleration — background jitter band */}
        <img 
          src="/satellite-map.jpeg" 
          alt="Satellite Map" 
          className="fixed inset-0 w-full h-full object-cover opacity-35 pointer-events-none z-0 mix-blend-screen"
          style={{ 
            transform: 'translate3d(0, 0, 0)',
            willChange: 'transform',
            backfaceVisibility: 'hidden',
          }}
        />
        
        {/* ✅ Blur orbs GPU pe — scroll pe stable rahenge */}
        <div 
          className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/15 rounded-full blur-[150px] pointer-events-none z-0"
          style={{ transform: 'translate3d(0, 0, 0)' }}
        />
        <div 
          className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none z-0"
          style={{ transform: 'translate3d(0, 0, 0)' }}
        />
        
        <Providers>
          <div className="flex flex-col min-h-screen relative z-20">
            <Navbar />
            
            <main className="flex-1 flex flex-col pt-10">
              {children}
            </main>
            
            {/* 🚀 UPDATED ENTERPRISE FOOTER */}
            <footer className="mt-auto relative z-50 border-t border-cyan-500/10 bg-[#060d1a]/70 backdrop-blur-2xl py-8 px-6 md:px-12">
              <div className="max-w-7xl mx-auto flex flex-col lg:flex-row justify-between items-center gap-8 lg:gap-4">
                
                {/* ── LEFT: BRANDING ── */}
                <div className="flex items-center gap-4 group">
                  <div className="relative flex items-center justify-center w-8 h-8 overflow-hidden rounded-full border border-white/5 shadow-[0_0_15px_rgba(34,211,238,0.2)]">
                    <img 
                      src="/logo.jpeg" 
                      alt="OpenPlanet Logo" 
                      className="w-full h-full object-cover scale-110" 
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-serif font-bold text-slate-200 tracking-wider leading-none mb-1">OpenPlanet</span>
                    <span className="text-[8px] font-mono text-cyan-500 tracking-[0.25em] leading-none uppercase">Risk Intelligence</span>
                  </div>
                  <span className="hidden md:inline-block text-[9px] font-mono text-slate-500 ml-4 uppercase tracking-widest border-l border-white/10 pl-4">
                    All rights reserved.
                  </span>
                </div>

                {/* ── CENTER: CLIMATEBASE CREDIBILITY (TEXT ONLY) ── */}
                <div className="flex flex-col items-center">
                  <a 
                    href="https://www.climatebase.org/company/1142537/openplanet-risk-intelligence"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center group/cb p-3 rounded-lg hover:bg-cyan-950/30 transition-all border border-transparent hover:border-cyan-500/20 text-center"
                    title="View OpenPlanet on Climatebase"
                  >
                    <div className="flex flex-col">
                      <span className="text-slate-400 font-mono text-[10px] font-bold tracking-[0.2em] uppercase group-hover/cb:text-cyan-300 transition-colors">
                        Recognized Organization on Climatebase
                      </span>
                      <span className="text-slate-600 font-mono text-[8px] tracking-[0.2em] uppercase group-hover/cb:text-cyan-500 transition-colors mt-1">
                        Listed in the Climatebase Directory
                      </span>
                    </div>
                  </a>
                </div>
                
                {/* ── RIGHT: LINKS & SOCIALS ── */}
                <div className="flex flex-col items-center lg:items-end gap-4">
                  <div className="flex gap-5 text-[9px] uppercase tracking-[0.4em] text-slate-400 font-bold items-center">
                    <Link href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy</Link>
                    <Link href="/terms" className="hover:text-cyan-400 transition-colors">Terms</Link>
                    <Link href="/support" className="hover:text-cyan-400 transition-colors">Support</Link>
                    
                    {/* LinkedIn Icon */}
                    <a 
                      href="https://www.linkedin.com/company/openplanet-climate/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-slate-500 hover:text-cyan-400 hover:drop-shadow-[0_0_8px_rgba(34,211,238,0.6)] transition-all duration-300 ml-2 border-l border-white/10 pl-6"
                      aria-label="OpenPlanet Official LinkedIn"
                    >
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path fillRule="evenodd" d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" clipRule="evenodd" />
                      </svg>
                    </a>
                  </div>
                  {/* Mobile Copyright fallback */}
                  <span className="md:hidden text-[8px] font-mono text-slate-600 uppercase tracking-widest mt-2">
                    © {new Date().getFullYear()} All rights reserved.
                  </span>
                </div>

              </div>
            </footer>
          </div>
        </Providers>

      </body>
      
      <GoogleAnalytics gaId="G-ZVH6C10YRD" />
    </html>
  );
}