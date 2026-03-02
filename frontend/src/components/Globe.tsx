'use client';

export interface GlobeProps {
  size?: number;
  className?: string;
}

export default function Globe({ size = 500, className = '' }: GlobeProps) {
  return (
    <div 
      className={`relative flex items-center justify-center rounded-full bg-brand-bg border border-brand-border/80 shadow-[0_0_60px_rgba(59,130,246,0.05)] overflow-hidden aspect-square w-full ${className}`}
      style={{ maxWidth: size }}
    >
      {/* Tactical Radar Grid */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:2rem_2rem] opacity-30 rounded-full"></div>

      {/* Concentric Measurement Rings */}
      <div className="absolute w-[80%] h-[80%] border border-slate-800/50 rounded-full"></div>
      <div className="absolute w-[60%] h-[60%] border border-slate-700/40 rounded-full"></div>
      <div className="absolute w-[40%] h-[40%] border border-slate-600/30 rounded-full"></div>

      {/* Radar Sweep Animation */}
      <div className="absolute inset-0 rounded-full opacity-20 animate-[spin_4s_linear_infinite]"
           style={{ background: 'conic-gradient(from 0deg, transparent 70%, rgba(59,130,246,0.8) 100%)' }}></div>

      {/* Center Origin Node */}
      <div className="relative z-10 flex items-center justify-center w-[15%] h-[15%] bg-blue-950/40 border border-blue-800/50 rounded-full backdrop-blur-sm shadow-[0_0_30px_rgba(59,130,246,0.3)]">
        <div className="w-2 h-2 bg-brand-info rounded-full animate-pulse"></div>
      </div>

      {/* Simulated Hazard Data Nodes */}
      <div className="absolute top-[30%] left-[25%] w-1.5 h-1.5 bg-brand-accent rounded-full shadow-[0_0_10px_rgba(239,68,68,1)] animate-pulse" style={{ animationDelay: '0.5s' }}></div>
      <div className="absolute top-[60%] right-[30%] w-1.5 h-1.5 bg-amber-500 rounded-full shadow-[0_0_10px_rgba(245,158,11,1)] animate-pulse" style={{ animationDelay: '1.2s' }}></div>

      {/* Status Text */}
      <div className="absolute bottom-10 text-[10px] font-mono text-brand-info/70 tracking-institutional uppercase bg-brand-bg/50 px-3 py-1 rounded-full backdrop-blur-md border border-blue-900/30">
        System Standby
      </div>
    </div>
  );
}