import LandingDesktop from '@/components/LandingDesktop';
import LandingMobile from '@/components/LandingMobile';

export default function HomePage() {
  return (
    <>
      <div className="hidden md:block w-full">
        <LandingDesktop />
      </div>
      <div className="block md:hidden w-full">
        <LandingMobile />
      </div>
    </>
  );
}
