import LandingDesktop from '@/components/LandingDesktop';
import LandingMobile from '@/components/LandingMobile';

export default function HomePage() {
  return (
    <>
      {/* Desktop + Tablet landscape (≥768px) — same component, responsive via CSS */}
      <div className="hidden md:block w-full">
        <LandingDesktop />
      </div>
      {/* Mobile (<768px) — touch-optimized layout */}
      <div className="block md:hidden w-full">
        <LandingMobile />
      </div>
    </>
  );
}
