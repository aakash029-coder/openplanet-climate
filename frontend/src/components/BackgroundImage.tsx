'use client'; // 👈 Yeh line zaroori hai

export default function BackgroundImage() {
  return (
    <div className="fixed inset-0 z-[-2] pointer-events-none">
      <img 
        src="/satellite-map.jpeg" 
        alt="" 
        className="w-full h-full object-cover opacity-60"
        /* Client component hone ki wajah se ab onError chalega */
        onError={(e) => {
          (e.currentTarget as HTMLImageElement).style.display = 'none';
        }}
      />
    </div>
  );
}