import './globals.css';
import Navbar from '@/components/Navbar';
import { Providers } from '@/components/Providers';

export const metadata = {
  title: 'OpenPlanet Climate Engine',
  description: 'High-Resolution Climate Risk Intelligence',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-mono min-h-screen text-white selection:bg-indigo-500/30 bg-transparent">
        
        {/* ── 1. PHYSICAL BACKGROUND IMAGE (IMPOSSIBLE TO HIDE) ── */}
        <img 
          src="/satellite-map.jpeg" 
          alt="Satellite Background" 
          className="fixed inset-0 w-full h-full object-cover z-[-2]"
        />
        
        {/* ── 2. DARK OVERLAY (Taki text padhne me aasaani ho) ── */}
        <div className="fixed inset-0 bg-[#020617]/70 z-[-1]"></div>

        {/* ── 3. MAIN CONTENT ── */}
        <Providers>
          <div className="flex flex-col min-h-screen relative z-10">
            <Navbar />
            
            <main className="flex-1 flex flex-col backdrop-blur-sm">
              {children}
            </main>

            <footer className="border-t border-white/10 bg-[#050814]/90 backdrop-blur-md py-8 px-6 md:px-12 mt-auto">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                <div>© {new Date().getFullYear()} OpenPlanet Intelligence.</div>
                <div className="flex flex-wrap justify-center gap-6 md:gap-10">
                  <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
                  <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
                  <a href="/support" className="hover:text-white transition-colors">Support</a>
                </div>
              </div>
            </footer>
          </div>
        </Providers>

      </body>
    </html>
  );
}