import './globals.css';
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
      <body className="font-mono min-h-screen flex flex-col text-white selection:bg-indigo-500/30 relative">
        
        {/* THE 100% BULLETPROOF BACKGROUND LAYER */}
        <div 
          className="fixed inset-0 z-[-10]"
          style={{
            backgroundImage: "url('/satellite-map.jpeg')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
            backgroundColor: "#020617" // Fallback dark color
          }}
        />

        <Providers>
          <Navbar />
          
          {/* Main content area with a slight blur so the map is visible but text is readable */}
          <main className="flex-1 flex flex-col bg-black/60 backdrop-blur-[2px]">
            {children}
          </main>

          {/* Global Professional Footer */}
          <footer className="border-t border-white/10 bg-[#050814]/90 backdrop-blur-md py-8 px-6 md:px-12 mt-auto">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
              <div>
                © {new Date().getFullYear()} OpenPlanet Intelligence.
              </div>
              <div className="flex flex-wrap justify-center gap-6 md:gap-10">
                <a href="/privacy" className="hover:text-white transition-colors">Privacy Policy</a>
                <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
                <a href="/support" className="hover:text-white transition-colors">Support</a>
              </div>
            </div>
          </footer>
          
        </Providers>

      </body>
    </html>
  );
}
