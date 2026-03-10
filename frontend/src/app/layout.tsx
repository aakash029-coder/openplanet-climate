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
      {/* 👇 BRIGHTER OCEANIC BLUE BACKGROUND */}
      <body className="font-mono min-h-screen text-slate-200 relative selection:bg-cyan-500/30 bg-[#060d1a] overflow-x-hidden">
        
        {/* SATELLITE IMAGE - Opacity badha di hai taaki map clear aur beautiful dikhe */}
        <img 
          src="/satellite-map.jpeg" 
          alt="Satellite Map" 
          className="fixed inset-0 w-full h-full object-cover opacity-35 pointer-events-none z-0 mix-blend-screen"
        />
        
        {/* GLOWING LIGHTS - Brighter Cyan and Blue to remove the "too dark" feeling */}
        <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-blue-600/15 rounded-full blur-[150px] pointer-events-none z-0"></div>
        <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-cyan-500/10 rounded-full blur-[150px] pointer-events-none z-0"></div>
        
        <Providers>
          <div className="flex flex-col min-h-screen relative z-20">
            <Navbar />
            
            <main className="flex-1 flex flex-col pt-10">
              {children}
            </main>
            
            {/* 👇 FOOTER MATCHED WITH HEADER LOGO STYLE */}
            <footer className="mt-auto relative z-50 border-t border-cyan-500/10 bg-[#060d1a]/70 backdrop-blur-2xl py-8 px-6 md:px-12">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
                
                {/* Footer Logo exactly like Header */}
                <div className="flex items-center gap-4 group">
                  <div className="relative flex items-center justify-center w-8 h-8 bg-black/50 border border-white/10 overflow-hidden rounded-lg">
                    <span className="relative text-white font-serif font-black text-[10px] tracking-tighter">OP</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-serif font-bold text-slate-200 tracking-wider leading-none mb-1">OpenPlanet</span>
                    <span className="text-[8px] font-mono text-cyan-500 tracking-[0.25em] leading-none uppercase">Risk Intelligence</span>
                  </div>
                  {/* Added All Rights Reserved */}
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
    </html>
  );
}