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
      <body className="font-mono min-h-screen text-slate-200 relative selection:bg-cyan-500/30 selection:text-white bg-[#010314] overflow-x-hidden">
        
        {/* 1. SATELLITE IMAGE LAYER (Ab ye clearly visible hogi) */}
        <div 
          className="fixed inset-0 z-0 w-full h-full bg-cover bg-center bg-no-repeat opacity-30"
          style={{ backgroundImage: "url('/satellite-map.jpeg')" }}
        ></div>
        
        {/* 2. GLOWING LIGHTS LAYER */}
        <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-700/20 rounded-full blur-[150px] pointer-events-none z-0"></div>
        <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-cyan-700/10 rounded-full blur-[150px] pointer-events-none z-0"></div>
        
        <Providers>
          <div className="flex flex-col min-h-screen relative z-20">
            <Navbar />
            
            <main className="flex-1 flex flex-col">
              {children}
            </main>
            
            {/* GLASSMORPHISM FOOTER */}
            <footer className="border-t border-white/10 bg-[#010314]/60 backdrop-blur-xl py-8 px-6 md:px-12 mt-auto shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold">
                <div>© {new Date().getFullYear()} OpenPlanet Intelligence.</div>
                <div className="flex flex-wrap justify-center gap-6 md:gap-10">
                  <Link href="/privacy" className="hover:text-cyan-400 transition-colors">Privacy Policy</Link>
                  <Link href="/terms" className="hover:text-cyan-400 transition-colors">Terms of Service</Link>
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