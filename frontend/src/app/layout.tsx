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
      {/* Root cause fix: body ka z-index issue theek karne ke liye hum layers system use kar rahe hain */}
      <body className="font-mono min-h-screen text-white relative selection:bg-indigo-500/30">
        
        {/* 1. SATELLITE IMAGE LAYER (z-0: Body ke upar, sabse piche) */}
        <div 
          className="fixed inset-0 z-0 w-full h-full bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/satellite-map.jpeg')" }}
        ></div>
        
        {/* 2. DARK OVERLAY LAYER (z-10: Image ke theek upar) */}
        <div className="fixed inset-0 z-10 bg-[#020617]/70 backdrop-blur-[2px] pointer-events-none"></div>
        
        {/* 3. MAIN CONTENT LAYER (z-20: Sabse aage) */}
        <Providers>
          <div className="flex flex-col min-h-screen relative z-20">
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