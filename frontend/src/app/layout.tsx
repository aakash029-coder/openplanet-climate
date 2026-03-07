import './globals.css';
import Link from 'next/link';
// 👇 Dhyan de: Curly braces use kiye hain kyunki ye named export hai
import { Providers } from '@/components/Providers'; 

export const metadata = {
  title: 'OpenPlanet Climate Engine',
  description: 'High-Resolution Climate Risk Intelligence',
};

export default function RootLayout({
  children, bg-[url('/cybermap.jpeg')] bg-cover bg-center bg-no-repeat
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="bg-[#020617] text-white">
      <body className="font-mono uppercase tracking-widest min-h-screen flex flex-col selection:bg-indigo-500/30">
        
        {/* ── YAHAN WRAP KIYA HAI TERI FILE KO ── */}
        <Providers>
          
          {/* ── HEADER ── */}
          <header className="sticky top-0 z-50 bg-[#020617]/90 backdrop-blur-xl border-b border-white/10 px-6 md:px-12 py-5 flex justify-between items-center shadow-lg">
            <Link href="/" className="text-sm md:text-base font-bold uppercase tracking-[0.3em] text-white hover:text-white transition-colors uppercase tracking-widest text-[9px]">
              Open<span className="text-indigo-500">Planet</span>
            </Link>
            
            <nav className="flex gap-6 md:gap-10 text-[10px] md:text-xs uppercase tracking-widest font-bold">
              <Link href="/" className="text-slate-400 hover:text-white transition-colors">Home</Link>
              <Link href="/discover" className="text-slate-400 hover:text-white transition-colors">Discover</Link>
              <Link href="/about" className="text-slate-400 hover:text-white transition-colors">About</Link>
            </nav>
          </header>

          {/* ── MAIN CONTENT ── */}
          <main className="flex-1 flex flex-col">
            {children}
          </main>

          {/* ── FOOTER ── */}
          <footer className="border-t border-white/10 bg-[#050814] py-8 px-6 md:px-12 mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-widest text-slate-500">
              
              <div>
                © {new Date().getFullYear()} OpenPlanet Intelligence.
              </div>
              
              <div className="flex flex-wrap justify-center gap-6 md:gap-10 font-bold">
                <Link href="/privacy" className="hover:text-white transition-colors uppercase tracking-widest text-[9px]">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-white transition-colors uppercase tracking-widest text-[9px]">Terms of Service</Link>
                <Link href="/support" className="hover:text-white transition-colors uppercase tracking-widest text-[9px] ">Support</Link>
              </div>

            </div>
          </footer>
          
        </Providers>

      </body>
    </html>
  );
}