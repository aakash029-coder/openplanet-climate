import React from 'react';
import { Info } from 'lucide-react';

export function getRiskColor(weight: number): [number, number, number] {
  if (weight >= 0.75) return [220, 38, 38];
  if (weight >= 0.50) return [249, 115, 22];
  if (weight >= 0.30) return [234, 179, 8];
  return [34, 197, 94];
}

export const cartoDarkStyle = {
  version: 8 as const,
  sources: { 'carto-dark': { type: 'raster' as const, tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'], tileSize: 256 } },
  layers: [{ id: 'carto-dark-layer', type: 'raster' as const, source: 'carto-dark' }],
};

export function parseLoss(lossStr: string): { num: number; prefix: string; suffix: string } | null {
  if (!lossStr || lossStr === '--') return null;
  const m = String(lossStr).match(/([\$€£])?([0-9.]+)([BKM])?/i);
  if (!m) return null;
  const multiplier = m[3]?.toUpperCase() === 'B' ? 1e9 : m[3]?.toUpperCase() === 'M' ? 1e6 : 1;
  return { num: parseFloat(m[2]) * multiplier, prefix: m[1] || '$', suffix: m[3] || '' };
}

export function fmtLoss(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

// ✅ NEW: Generic Range Generator for all metrics
export const getScientificRange = (val: string | number, type: 'num' | 'temp' | 'days' = 'num') => {
  const n = typeof val === 'string' ? parseFloat(val.replace(/[\$,B,M,d,°C]/g, '')) || 0 : val;
  if (!n) return '--';
  if (type === 'temp') return `${(n - 1.2).toFixed(1)}°C – ${(n + 1.5).toFixed(1)}°C`;
  if (type === 'days') return `${Math.max(0, Math.floor(n * 0.85))}d – ${Math.ceil(n * 1.15)}d`;
  
  const isLoss = typeof val === 'string' && val.includes('$');
  const suffix = typeof val === 'string' && val.includes('B') ? 'B' : typeof val === 'string' && val.includes('M') ? 'M' : '';
  const prefix = isLoss ? '$' : '';
  
  const low = (n * 0.85).toFixed(suffix ? 1 : 0);
  const high = (n * 1.15).toFixed(suffix ? 1 : 0);
  return `${prefix}${low}${suffix} – ${prefix}${high}${suffix}`;
};

// ✅ NEW: Stylish 'i' Icon
export const InfoIcon = ({ text }: { text: string }) => (
  <div className="group relative inline-flex items-center justify-center ml-1.5 cursor-help z-50">
    <Info size={11} className="text-slate-500 hover:text-cyan-400 transition-colors" />
    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-slate-900 border border-slate-700 rounded-lg text-[10px] text-slate-300 hidden group-hover:block z-[9999] shadow-2xl backdrop-blur-md font-sans normal-case tracking-normal text-center leading-relaxed">
      {text}
    </div>
  </div>
);