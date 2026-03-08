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
    {/* 👇 'dark' class yahan se hata di hai */}
    <html lang="en">
      {/* 👇 text-white ki jagah text-slate-900 (dark text) aur light selection color use kiya hai */}
      <body className="font-mono min-h-screen text-slate-900 relative selection:bg-indigo-500/30 bg-slate-50">
        
        {/* 1. SATELLITE IMAGE LAYER */}
        <div 
          className="fixed inset-0 z-0 w-full h-full bg-cover bg-center bg-no-repeat opacity-40"
          style={{ backgroundImage: "url('/satellite-map.jpeg')" }}
        ></div>
        
        {/* 2. LIGHT OVERLAY LAYER (White/Slate blur overlay taaki dark text clear padhne mein aaye) */}
        <div className="fixed inset-0 z-10 bg-white/85 backdrop-blur-[3px] pointer-events-none"></div>
        
        {/* 3. MAIN CONTENT LAYER */}
        <Providers>
          <div className="flex flex-col min-h-screen relative z-20">
            <Navbar />
            
            <main className="flex-1 flex flex-col">
              {children}
            </main>
            
            {/* 👇 Footer ko professional light look diya hai */}
            <footer className="border-t border-slate-200 bg-white/80 backdrop-blur-md py-8 px-6 md:px-12 mt-auto shadow-sm">
              <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-[0.3em] text-slate-500 font-bold">
                <div>© {new Date().getFullYear()} OpenPlanet Intelligence.</div>
                <div className="flex flex-wrap justify-center gap-6 md:gap-10">
                  <Link href="/privacy" className="hover:text-indigo-600 transition-colors">Privacy Policy</Link>
                  <Link href="/terms" className="hover:text-indigo-600 transition-colors">Terms of Service</Link>
                  <Link href="/support" className="hover:text-indigo-600 transition-colors">Support</Link>
                </div>
              </div>
            </footer>
          </div>
        </Providers>

      </body>
    </html>
  );
}