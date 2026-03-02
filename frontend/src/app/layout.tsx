import type { Metadata } from 'next';
import './globals.css';
import { Providers } from '@/components/Providers'; // THIS FIXES THE ERROR

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
          
          {/* LAYER 1: The Fixed Background */}
          <div 
            className="fixed inset-0 z-0 bg-[url('/satellite-map.jpeg')] bg-cover bg-center bg-no-repeat"
            aria-hidden="true"
          />

          {/* LAYER 2: Refined Dimmer (Lighter middle to show the map) */}
          <div 
            className="fixed inset-0 z-10 bg-gradient-to-b from-black/80 via-black/40 to-black/80 pointer-events-none"
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