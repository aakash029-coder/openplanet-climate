import './globals.css';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import { Providers } from '@/components/Providers';

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
    <html lang="en">
      <body className="font-mono min-h-screen text-slate-200 relative selection:bg-cyan-500/30 bg-[#020205] overflow-x-hidden">
        
        {/* 👇 SATELLITE IMAGE - Sharp & Visible */}
        <img 
          src="/satellite-map.jpeg" 
          alt="Satellite Map" 
          className="fixed inset-0 w-full h-full object-cover opacity-25 pointer-events-none z-0"
        />
        
        {/* 👇 EXTREMELY LOW GLOW - Just to add depth, not color */}
        <div className="fixed top-[-20%] left-[-10%] w-[60vw] h-[60vw] bg-blue-900/5 rounded-full blur-[180px] pointer-events-none z-0"></div>
        
        <Providers>
          <div className="flex flex-col min-h-screen relative z-20">
            {/* Header is already sticky/fixed in Navbar */}
            <Navbar />
            
            <main className="flex-1 flex flex-col pt-10">
              {children}
            </main>
            
            {/* 👇 RIGID FIXED FOOTER */}
            <footer className="fixed bottom-0 left-0 right-0 z-50 border-t border-white/5 bg-black/80 backdrop-blur-2xl py-5 px-6 md:px-12 shadow-[0_-10px_40px_rgba(0,0,0,0.9)]">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-[9px] uppercase tracking-[0.4em] text-slate-500 font-bold">
                <div>© {new Date().getFullYear()} OpenPlanet Intelligence.</div>
                <div className="flex gap-8">
                  <Link href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy</Link>
                  <Link href="/terms" className="hover:text-cyan-400 transition-colors">Terms</Link>
                  <Link href="/support" className="hover:text-cyan-400 transition-colors">Support</Link>
                </div>
              </div>
            </footer>
          </div>
        </Providers>

      </body>
    </html>
  );
}