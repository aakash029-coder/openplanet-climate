import LandingDesktop from '@/components/LandingDesktop';
import LandingMobile from '@/components/LandingMobile';

export default function HomePage() {
  return (
    <>
      <div className="hidden lg:block w-full">
        <LandingDesktop />
      </div>
      <div className="block lg:hidden w-full">
        <LandingMobile />
      </div>
    </>
  );
}
