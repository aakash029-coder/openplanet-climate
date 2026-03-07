'use client';

export default function BackgroundImage() {
  return (
    <div className="fixed inset-0 z-[-2] pointer-events-none bg-[#020617]">
      <img 
        src="/satellite-map.jpeg" 
        alt="" 
        className="w-full h-full object-cover opacity-60"
        /* Fallback logic: Agar image load nahi hui toh background black hi rahega */
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.opacity = '0';
        }}
      />
    </div>
  );
}