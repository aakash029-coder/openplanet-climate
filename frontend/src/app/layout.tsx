import type { Metadata } from 'next';
import './globals.css';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Providers } from '@/components/Providers';
// 👇 1. Sabse upar ye line daal di hai
import { GoogleAnalytics } from '@next/third-parties/google';

export const metadata: Metadata = {
  metadataBase: new URL('https://openplanet-ai.vercel.app'),
  
  title: 'OpenPlanet | High-Resolution Climate Risk Intelligence',
  description: 'OpenPlanet is a globally scalable climate intelligence engine. We translate complex planetary physics into highly actionable, localized survival strategies.',
  
  verification: {
    google: 'AteFZ_PNhw-ABwNOcaDMqNI6VD4Somp4TQ9xk7Eqmy8', 
  },

  openGraph: {
    title: 'OpenPlanet | High-Resolution Climate Risk Intelligence',
    description: 'OpenPlanet is a globally scalable climate intelligence engine. We translate complex planetary physics into highly actionable, localized survival strategies.',
    url: 'https://openplanet-ai.vercel.app',
    siteName: 'OpenPlanet',
    locale: 'en_US',
    type: 'website',
  },

  twitter: {
    card: 'summary_large_image',
    title: 'OpenPlanet | High-Resolution Climate Risk Intelligence',
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
        
        <img 
          src="/satellite-map.jpeg" 
          alt="Satellite Map" 
          className="fixed inset-0 w-full h-full object-cover opacity-35 pointer-events-none z-0 mix-blend-screen"
        />
        
        <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/15 rounded-full blur-[150px] pointer-events-none z-0"></div>
        <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none z-0"></div>
        
        <Providers>
          <div className="flex flex-col min-h-screen relative z-20">
            <Navbar />
            
            <main className="flex-1 flex flex-col pt-10">
              {children}
            </main>
            
            <footer className="mt-auto relative z-50 border-t border-cyan-500/10 bg-[#060d1a]/70 backdrop-blur-2xl py-8 px-6 md:px-12">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                
                <div className="flex items-center gap-4 group">
                  {/* 👇 BLUE/CYAN PLANET LOGO IN FOOTER WITH GLOW */}
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
                  <span className="text-[9px] font-mono text-slate-500 ml-4 uppercase tracking-widest border-l border-white/10 pl-4">
                    All rights reserved.
                  </span>
                </div>
                
                <div className="flex gap-8 text-[9px] uppercase tracking-[0.4em] text-slate-400 font-bold">
                  <Link href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy</Link>
                  <Link href="/terms" className="hover:text-cyan-400 transition-colors">Terms</Link>
                  <Link href="/support" className="hover:text-cyan-400 transition-colors">Support</Link>
                </div>
              </div>
            </footer>
          </div>
        </Providers>

      </body>
      
      {/* 👇 2. </body> close hone ke theek baad ye line daal di hai */}
      <GoogleAnalytics gaId="G-ZVH6C10YRD" />
    </html>
  );
}