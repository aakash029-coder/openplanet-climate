import './globals.css';
import Link from 'next/link';
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
    <html lang="en" className="bg-[#020617] text-white">
      {/* 👇 YAHAN MAINE SATELLITE IMAGE PERMANENTLY ADD KAR DI HAI */}
      <body className="font-mono min-h-screen flex flex-col selection:bg-indigo-500/30 bg-[url('/cybermap.jpeg')] bg-cover bg-center bg-fixed bg-no-repeat">
        
        <Providers>
          
          {/* ── HEADER ── */}
          <header className="sticky top-0 z-50 bg-[#020617]/90 backdrop-blur-xl border-b border-white/10 px-6 md:px-12 py-5 flex justify-between items-center shadow-lg">
            <Link href="/" className="text-sm md:text-base font-bold uppercase tracking-[0.3em] text-white hover:text-indigo-400 transition-colors">
              Open<span className="text-indigo-500">Planet</span>
            </Link>
            
            <nav className="flex gap-6 md:gap-10 text-[10px] uppercase tracking-widest font-bold">
              <Link href="/" className="text-slate-400 hover:text-white transition-colors">Home</Link>
              <Link href="/discover" className="text-slate-400 hover:text-white transition-colors">Discover</Link>
              <Link href="/about" className="text-slate-400 hover:text-white transition-colors">About</Link>
            </nav>
          </header>

          {/* ── MAIN CONTENT ── */}
          {/* Halki si black overlay di hai taaki text read karne mein problem na ho, par map piche dikhta rahega */}
          <main className="flex-1 flex flex-col bg-black/40 backdrop-blur-[2px]">
            {children}
          </main>

          {/* ── FOOTER (PROFESSIONAL THEME - NO GREEN) ── */}
          <footer className="border-t border-white/10 bg-[#050814]/95 backdrop-blur-md py-8 px-6 md:px-12 mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              
              <div>
                © {new Date().getFullYear()} OpenPlanet Intelligence.
              </div>
              
              <div className="flex flex-wrap justify-center gap-6 md:gap-10">
                <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
                <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
                {/* Support se green hata kar professional white/indigo theme par set kar diya */}
                <Link href="/support" className="hover:text-white transition-colors">Support</Link>
              </div>

            </div>
          </footer>
          
        </Providers>

      </body>
    </html>
  );
}