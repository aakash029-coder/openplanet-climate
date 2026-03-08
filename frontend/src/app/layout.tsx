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
    <html lang="en" className="dark">
      <body className="font-mono min-h-screen text-white bg-[#020617] relative selection:bg-indigo-500/30">
        
        {/* 👇 BULLETPROOF BACKGROUND IMAGE (z-[-2] sabse piche rahega) */}
        <div 
          className="fixed inset-0 z-[-2] w-full h-full bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/satellite-map.jpeg')" }}
        ></div>
        
        {/* 👇 DARK OVERLAY (z-[-1] image ke upar, content ke piche). Maine isko /60 kiya hai taaki map dikhe */}
        <div className="fixed inset-0 bg-[#020617]/60 backdrop-blur-[2px] z-[-1] pointer-events-none"></div>
        
        <Providers>
          <div className="flex flex-col min-h-screen relative z-10">
            <Navbar />
            
            <main className="flex-1 flex flex-col">
              {children}
            </main>
            
            <footer className="border-t border-white/5 bg-[#050814]/80 backdrop-blur-md py-8 px-6 md:px-12 mt-auto">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">
                <div>© {new Date().getFullYear()} OpenPlanet Intelligence.</div>
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