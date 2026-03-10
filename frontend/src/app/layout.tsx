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
      <body className="font-mono min-h-screen text-slate-200 relative selection:bg-fuchsia-500/30 selection:text-white bg-[#030014] overflow-x-hidden">
        
        {/* 1. SATELLITE IMAGE LAYER (Very faint for texture) */}
        <div 
          className="fixed inset-0 z-0 w-full h-full bg-cover bg-center bg-no-repeat opacity-20 mix-blend-overlay"
          style={{ backgroundImage: "url('/satellite-map.jpeg')" }}
        ></div>
        
        {/* 2. GLOWING LIGHTS LAYER (Generates stylish background lights) */}
        <div className="fixed top-[-10%] left-[-10%] w-[50vw] h-[50vw] bg-purple-700/20 rounded-full blur-[150px] pointer-events-none z-0"></div>
        <div className="fixed bottom-[-10%] right-[-10%] w-[50vw] h-[50vw] bg-indigo-700/20 rounded-full blur-[150px] pointer-events-none z-0"></div>
        
        {/* 3. MAIN CONTENT LAYER */}
        <Providers>
          <div className="flex flex-col min-h-screen relative z-20">
            <Navbar />
            
            <main className="flex-1 flex flex-col">
              {children}
            </main>
            
            {/* GLASSMORPHISM FOOTER */}
            <footer className="border-t border-white/10 bg-black/20 backdrop-blur-xl py-8 px-6 md:px-12 mt-auto shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-[0.3em] text-slate-400 font-bold">
                <div>© {new Date().getFullYear()} OpenPlanet Intelligence.</div>
                <div className="flex flex-wrap justify-center gap-6 md:gap-10">
                  <Link href="/privacy" className="hover:text-fuchsia-400 transition-colors">Privacy Policy</Link>
                  <Link href="/terms" className="hover:text-fuchsia-400 transition-colors">Terms of Service</Link>
                  <Link href="/support" className="hover:text-fuchsia-400 transition-colors">Support</Link>
                </div>
              </div>
            </footer>
          </div>
        </Providers>

      </body>
    </html>
  );
}