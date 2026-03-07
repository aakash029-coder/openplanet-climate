import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers';

export const metadata: Metadata = {
  title: 'OpenPlanet Risk Intelligence',
  description: 'Project & Mitigate Climate Risks.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-black text-slate-200">
        <Providers>
          
          {/* LAYER 1: THE BULLETPROOF BACKGROUND */}
          <img 
            src="/satellite-map.jpeg" 
            alt="Map Background" 
            className="fixed inset-0 w-full h-full object-cover z-0 pointer-events-none opacity-60"
          />

          {/* LAYER 2: The "Expensive Sci-Fi" Dark Overlay */}
          <div 
            className="fixed inset-0 z-10 bg-gradient-to-b from-black/90 via-black/40 to-black/90 pointer-events-none"
            aria-hidden="true"
          />

          {/* LAYER 3: The Foreground */}
          <div className="relative z-20 flex flex-col min-h-screen">
            {children}
          </div>

        </Providers>
      </body>
    </html>
  );
}