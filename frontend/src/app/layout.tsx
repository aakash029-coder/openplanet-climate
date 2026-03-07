import './globals.css';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Providers } from '@/components/Providers';
import BackgroundImage from '@/components/BackgroundImage'; // 👈 Client Component import

export const metadata = {
  title: 'OpenPlanet Climate Engine',
  description: 'High-Resolution Climate Risk Intelligence',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-mono min-h-screen text-white bg-[#020617] relative selection:bg-indigo-500/30">
        
        {/* ── 1. BACKGROUND IMAGE (Interactivity handled in Client Component) ── */}
        <BackgroundImage />
        
        {/* ── 2. GRADIENT OVERLAY (Visual Depth) ── */}
        <div className="fixed inset-0 bg-gradient-to-b from-[#020617]/90 via-transparent to-[#020617]/90 z-[-1] pointer-events-none"></div>

        <Providers>
          <div className="flex flex-col min-h-screen relative z-10">
            {/* ── HEADER ── */}
            <Navbar />
            
            {/* ── MAIN CONTENT ── */}
            <main className="flex-1 flex flex-col">
              {children}
            </main>

            {/* ── FOOTER ── */}
            <footer className="border-t border-white/5 bg-[#050814]/80 backdrop-blur-md py-8 px-6 md:px-12 mt-auto">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">
                <div>
                  © {new Date().getFullYear()} OpenPlanet Intelligence.
                </div>
                
                <div className="flex flex-wrap justify-center gap-6 md:gap-10">
                  <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                  <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
                  <Link href="/support" className="hover:text-white transition-colors">Support</Link>
                </div>
              </div>
            </footer>
          </div>
        </Providers>

      </body>
    </html>
  );
}