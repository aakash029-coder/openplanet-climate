'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Map, { NavigationControl } from 'react-map-gl/maplibre';
// @ts-ignore
import 'maplibre-gl/dist/maplibre-gl.css';
import DeckGL from '@deck.gl/react';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { latLngToCell } from 'h3-js';
import { FlyToInterpolator } from '@deck.gl/core';
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend,
} from 'recharts';
import {
  formatCoordinates,
  formatEconomicRange,
  formatDeathsRange,
} from '@/context/ClimateDataContext';

// ─────────────────────────────────────────────────────────────────────────────
// FOURSQUARE / KEPLER.GL COLOR PALETTE
// yellow (hottest) → orange → red → crimson → magenta-purple (edge)
// ─────────────────────────────────────────────────────────────────────────────
function getRiskColor(weight: number): [number, number, number, number] {
  if (weight >= 0.88) return [255, 235,   0, 255]; // Bright yellow — hottest core
  if (weight >= 0.72) return [255, 165,  10, 255]; // Amber-orange
  if (weight >= 0.55) return [240,  80,  15, 255]; // Deep orange-red
  if (weight >= 0.38) return [200,  30,  60, 255]; // Crimson
  if (weight >= 0.22) return [155,  15, 105, 255]; // Magenta-purple
  if (weight >= 0.10) return [100,   8, 120, 255]; // Deep purple
  return                      [ 55,   4,  75, 255]; // Edge scatter — darkest
}

const cartoDarkStyle = {
  version: 8 as const,
  sources: {
    'carto-dark': {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
    },
  },
  layers: [{
    id: 'carto-dark-layer', type: 'raster' as const,
    source: 'carto-dark', paint: { 'raster-opacity': 1 },
  }],
};

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

// ─────────────────────────────────────────────────────────────────────────────
// SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────
const InfoTooltip = ({
  publicText, techText, alignLeft = false,
}: { publicText: string; techText: string; alignLeft?: boolean }) => (
  <div className="relative flex items-center group shrink-0" onClick={(e) => e.stopPropagation()}>
    <button type="button" className="w-4 h-4 rounded-full border border-slate-700 text-slate-600 flex items-center justify-center text-[9px] font-bold hover:border-cyan-500/60 hover:text-cyan-400 transition-all select-none focus:outline-none">?</button>
    <div className={`absolute ${alignLeft ? 'right-5' : 'left-5'} top-1/2 -translate-y-1/2 w-56 p-4 rounded-xl bg-[#070e20] border border-slate-700/70 shadow-[0_12px_40px_rgba(0,0,0,0.8)] opacity-0 invisible scale-95 group-hover:opacity-100 group-hover:visible group-hover:scale-100 transition-all duration-150 z-[9999] pointer-events-none`}>
      <p className="text-slate-300 text-[11px] leading-relaxed mb-2.5 font-sans">{publicText}</p>
      <p className="text-cyan-400/80 text-[9px] font-mono uppercase tracking-widest border-t border-slate-700/60 pt-2 leading-relaxed">{techText}</p>
    </div>
  </div>
);

const VAR_TOOLTIPS: Record<string, string> = {
  AF:            "Attributable Fraction — proportion of deaths attributable to heat. AF = (RR−1) / RR",
  RR:            "Relative Risk — how much more likely death is vs baseline. RR = exp(β × ΔT)",
  beta:          "Gasparrini (2017) GBD meta-analysis global mean coefficient = 0.0801",
  V:             "Vulnerability multiplier — adjusts for AC penetration, age structure, and healthcare access",
  DR:            "World Bank crude death rate per 1,000 population (indicator: SP.DYN.CDRT.IN)",
  HW:            "Calibrated annual heatwave days from CMIP6 ensemble + regional adjustments",
  Pop:           "Metro population from GeoNames API",
  temp_excess_c: "Temperature above ERA5 P95 historical threshold — excess heat above local adaptation limit",
  Burke_penalty: "0.0127 × (T_mean − 13°C)² / 100 — Burke (2018) non-linear GDP penalty coefficient",
  ILO_fraction:  "(HW/365) × 0.40 × 0.20 — ILO (2019) labor productivity loss fraction",
  T_mean:        "CMIP6 projected annual mean temperature for the target year",
  T_optimal:     "13°C — global economic optimum temperature per Burke et al. (2018) Nature",
  HW_days:       "Annual heatwave days from CMIP6 ensemble (same as HW)",
  GDP:           "City GDP: World Bank GDP/cap × metro population × urban productivity ratio",
};

const AuditModal = ({
  open, onClose, auditTrail, metricKey,
}: {
  open: boolean; onClose: () => void;
  auditTrail: any; metricKey: 'mortality' | 'economics' | 'wetbulb';
}) => {
  if (!open || !auditTrail) return null;
  const data = auditTrail[metricKey === 'economics' ? 'economics' : metricKey];
  if (!data) return null;
  const disclaimer = metricKey === 'mortality'
    ? 'Simplified Gasparrini et al. 2017 implementation for research estimation.'
    : metricKey === 'economics'
    ? 'Simplified Burke (2018) + ILO (2019) framework for estimation.'
    : 'Stull (2011) empirical formula. Capped at 35°C per Sherwood & Huber (2010).';
  const metricLabel = metricKey === 'mortality' ? 'Mortality' : metricKey === 'economics' ? 'Economics' : 'Wet-Bulb';

  return (
    <>
      <div className="absolute inset-0 z-[500] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 z-[501] flex items-center justify-center pointer-events-none px-4">
        <div className="pointer-events-auto w-full max-w-[430px] bg-[#06101f] border border-cyan-500/25 rounded-2xl shadow-[0_0_60px_rgba(34,211,238,0.12),0_24px_48px_rgba(0,0,0,0.8)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800/60 bg-gradient-to-r from-cyan-950/30 to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <span className="text-[9px] font-mono text-cyan-400 uppercase tracking-[0.3em] font-bold">Calculation Details</span>
              <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">· {metricLabel}</span>
            </div>
            <button onClick={onClose} className="w-6 h-6 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-500 hover:text-white hover:bg-slate-700/60 transition-all flex items-center justify-center text-[14px] leading-none">×</button>
          </div>
          <div className="p-5 space-y-3 max-h-[70vh] overflow-y-auto">
            <div className="bg-[#020912]/80 rounded-xl px-4 py-3 border border-slate-800/60">
              <p className="text-[8px] font-mono text-slate-600 uppercase tracking-[0.2em] mb-1.5">Formula</p>
              <p className="text-white font-mono text-[12px] tracking-wide leading-relaxed">{data.formula}</p>
            </div>
            {data.variables && (
              <div className="bg-[#020912]/80 rounded-xl px-4 py-3 border border-slate-800/60">
                <p className="text-[8px] font-mono text-slate-600 uppercase tracking-[0.2em] mb-2.5">Variables</p>
                <div className="grid grid-cols-2 gap-x-6">
                  {Object.entries(data.variables).map(([k, v]) => {
                    const tip = VAR_TOOLTIPS[k];
                    return (
                      <div key={k} className="flex items-center justify-between py-1.5 border-b border-slate-800/30 last:border-0">
                        <div className="flex items-center gap-1 shrink-0">
                          <span className="text-[10px] font-mono text-cyan-400">{k}</span>
                          {tip && (
                            <div className="relative group">
                              <div className="w-3 h-3 rounded-full border border-slate-700 text-slate-600 flex items-center justify-center text-[7px] cursor-help hover:border-cyan-500/60 hover:text-cyan-400 transition-all select-none">?</div>
                              <div className="absolute left-4 top-1/2 -translate-y-1/2 w-48 p-2.5 rounded-lg bg-[#0a1830] border border-slate-700/60 shadow-[0_8px_24px_rgba(0,0,0,0.9)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-[99999] pointer-events-none">
                                <p className="text-[8px] font-mono text-slate-300 leading-relaxed">{tip}</p>
                              </div>
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] font-mono text-slate-300 tabular-nums">{String(v)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {data.computation && (
              <div className="bg-emerald-950/20 rounded-xl px-4 py-3 border border-emerald-500/20">
                <p className="text-[8px] font-mono text-emerald-400 uppercase tracking-[0.2em] mb-1.5">Result</p>
                <p className="text-[11px] font-mono text-white leading-relaxed break-all">{data.computation}</p>
              </div>
            )}
            <div className="flex items-center justify-between">
              <p className="text-[8px] font-mono text-slate-700 italic">{data.source}</p>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="text-[8px] font-mono text-emerald-500 uppercase tracking-widest">Calculation validated</span>
              </div>
            </div>
            <div className="bg-slate-900/30 rounded-lg px-3 py-2 border border-slate-800/40">
              <p className="text-[8px] font-mono text-slate-600 leading-relaxed italic">{disclaimer}</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center w-full py-24 bg-[#020617]">
    <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6" />
    <span className="font-mono text-[10px] text-indigo-400 tracking-[0.5em] uppercase animate-pulse">Computing Spatial Risk Array...</span>
  </div>
);

const MapLegend = () => (
  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/80 border border-white/5 px-5 py-2.5 rounded-full backdrop-blur-xl z-50 flex items-center gap-4 shadow-2xl pointer-events-none">
    {[
      { hex: '#FFEB00', label: 'Critical'  },
      { hex: '#FF8A00', label: 'High'      },
      { hex: '#C81E3C', label: 'Moderate'  },
      { hex: '#640878', label: 'Low'       },
    ].map((item) => (
      <div key={item.label} className="flex items-center gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.hex, boxShadow: `0 0 6px ${item.hex}88` }} />
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">{item.label}</span>
      </div>
    ))}
  </div>
);

function parseLoss(s: string) {
  const m = String(s).match(/([\$€£])?([0-9.]+)([BKM])?/i);
  if (!m) return null;
  const mult = m[3]?.toUpperCase() === 'B' ? 1e9 : m[3]?.toUpperCase() === 'M' ? 1e6 : 1;
  return { num: parseFloat(m[2]) * mult, prefix: m[1] || '$', suffix: m[3] || '' };
}
function fmtLoss(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

const AiCard = ({ text, title, badge }: { text: string; title: string; badge?: string }) => {
  if (!text) return null;
  const clean = (s: string) => s.replace(/\*\*.*?\*\*:?/g, '').replace(/^:\s*/, '').trim();
  if (text.includes('**EFFECT:**') && text.includes('**SOLUTION:**')) {
    const [rawCause, rest]    = text.split('**EFFECT:**');
    const [rawEffect, rawSol] = rest.split('**SOLUTION:**');
    return (
      <div className="bg-[#06101f] border border-slate-800/70 rounded-2xl p-4 md:p-5 h-full flex flex-col gap-3">
        <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/60">
          <p className="text-[10px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold leading-tight">{title}</p>
          {badge && <span className="shrink-0 text-[8px] font-mono text-slate-600 uppercase tracking-widest border border-slate-800 rounded px-1.5 py-0.5">{badge}</span>}
        </div>
        <div className="space-y-3 flex-grow">
          {[
            { label: 'Cause',    accent: 'text-red-400',     dot: 'bg-red-500',     text: clean(rawCause) },
            { label: 'Effect',   accent: 'text-amber-400',   dot: 'bg-amber-400',   text: clean(rawEffect) },
            { label: 'Solution', accent: 'text-emerald-400', dot: 'bg-emerald-500', text: clean(rawSol) },
          ].map((s) => (
            <div key={s.label}>
              <div className={`flex items-center gap-1.5 mb-1 ${s.accent}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] font-bold">{s.label}</span>
              </div>
              <p className="text-slate-300 text-[11px] leading-relaxed font-sans">{s.text}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="bg-[#06101f] border border-slate-800/70 rounded-2xl p-4 md:p-5 h-full flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-800/60">
        <p className="text-[10px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold">{title}</p>
        {badge && <span className="shrink-0 text-[8px] font-mono text-slate-600 uppercase tracking-widest border border-slate-800 rounded px-1.5 py-0.5">{badge}</span>}
      </div>
      <p className="text-slate-300 text-[11px] leading-relaxed font-sans">{clean(text)}</p>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN EXPORT
// ─────────────────────────────────────────────────────────────────────────────
export default function MapModule({
  onNavigateToCompare,
  onTargetLocked,
}: {
  onNavigateToCompare?: () => void;
  onTargetLocked?: (city: string) => void;
}) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading]         = useState(false);
  const [apiError, setApiError]           = useState<string | null>(null);
  const [searchQuery, setSearchQuery]     = useState('');
  const [suggestions, setSuggestions]     = useState<any[]>([]);
  const [selectedCity, setSelectedCity]   = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [ssp, setSsp]       = useState('SSP2-4.5');
  const [year, setYear]     = useState('2050');
  const [canopy, setCanopy] = useState(0);
  const [coolRoof, setCoolRoof] = useState(0);
  const [viewState, setViewState] = useState<any>({ longitude: 0, latitude: 20, zoom: 1.8, pitch: 0, bearing: 0 });
  const [hexData, setHexData] = useState<{ position: [number, number]; risk_weight?: number }[]>([]);
  const [simData, setSimData] = useState({
    temp: '--', deaths: '--', ci: null as string | null,
    loss: '--', heatwave: '--', baseTemp: '--',
    wbt: '--', region: '--', rh_p95: null as number | null,
  });
  const [auditTrail, setAuditTrail] = useState<any>(null);
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [chartData, setChartData]   = useState<{ heatwave: any[]; economic: any[] }>({ heatwave: [], economic: [] });
  const [auditOpen, setAuditOpen]   = useState(false);
  const [auditKey, setAuditKey]     = useState<'mortality' | 'economics' | 'wetbulb'>('mortality');
  const [systemAlert, setSystemAlert] = useState<{ title: string; message: string; type: 'warning' | 'error' | 'info' } | null>(null);

  const isSimulating = canopy > 0 || coolRoof > 0;
  const openAudit = (k: 'mortality' | 'economics' | 'wetbulb') => { setAuditKey(k); setAuditOpen(true); };

  // Autocomplete
  useEffect(() => {
    const t = setTimeout(async () => {
      if (searchQuery.length > 2 && !selectedCity) {
        try {
          const res  = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5`);
          const data = await res.json();
          setSuggestions(data.map((c: any) => ({
            id: c.place_id, name: c.name || c.display_name.split(',')[0],
            country: c.display_name.split(',').pop()?.trim() || '',
            latitude: parseFloat(c.lat), longitude: parseFloat(c.lon),
          })));
        } catch {}
      } else { setSuggestions([]); }
    }, 600);
    return () => clearTimeout(t);
  }, [searchQuery, selectedCity]);

  useEffect(() => {
    setIsInitialized(false); setHexData([]); setApiError(null);
  }, [selectedCity?.name, ssp, year]);

  const handleInitialize = async () => {
    if (!selectedCity) return;
    setIsLoading(true); setApiError(null); setSystemAlert(null);
    setCanopy(0); setCoolRoof(0);

    setViewState((p: any) => ({
      ...p, longitude: selectedCity.lng, latitude: selectedCity.lat,
      zoom: 14.5, pitch: 30, bearing: 0,
      transitionDuration: 3000, transitionInterpolator: new FlyToInterpolator(),
    }));

    try {
      const res = await fetch('/api/engine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/api/predict',
          payload:  { city: selectedCity.name, lat: selectedCity.lat, lng: selectedCity.lng, ssp, year, canopy: 0, coolRoof: 0 },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (data.metrics?.region === 'ERROR') throw new Error('Python API Error: Check backend terminal.');
      if (!data.metrics || !data.hexGrid) throw new Error('API returned missing or malformed data.');

      if (onTargetLocked) onTargetLocked(selectedCity.name);
      setHexData(data.hexGrid);
      setSimData({
        temp:     data.metrics?.temp      ?? '--',
        deaths:   data.metrics?.deaths    ?? '--',
        ci:       data.metrics?.ci        ?? null,
        loss:     data.metrics?.loss      ?? '--',
        heatwave: data.metrics?.heatwave  ?? '--',
        baseTemp: data.metrics?.baseTemp  ?? '--',
        wbt:      data.metrics?.wbt       ?? '--',
        region:   data.metrics?.region    ?? '--',
        rh_p95:   data.metrics?.rh_p95    ?? null,
      });
      setAuditTrail(data.auditTrail ?? null);
      setAiAnalysis(data.aiAnalysis ?? null);
      if (data.charts) setChartData({ heatwave: data.charts.heatwave || [], economic: data.charts.economic || [] });
      setIsInitialized(true);
    } catch (err: any) {
      setApiError(err.message); setIsInitialized(false);
    } finally { setIsLoading(false); }
  };

  // ── BIOME CONSTRAINT LOGIC ──
  // FIX: guard against '--' before parseFloat
  const handleMitigationChange = (type: 'canopy' | 'coolRoof', value: number) => {
    if (!selectedCity) return;
    setSystemAlert(null);

    const baseT = simData.baseTemp !== '--' ? parseFloat(simData.baseTemp) : 20;
    const rh    = simData.rh_p95 ?? 50;

    // Arid biome: hot + dry → water-scarce, canopy can't grow much
    if (type === 'canopy' && baseT > 28 && rh < 35 && value > 10) {
      setSystemAlert({ title: '🏜️ Resource Limit', message: 'Arid Biome: Canopy > 10% restricted — insufficient groundwater for tree establishment.', type: 'warning' });
      setCanopy(10); return;
    }

    // Tropical trap: excessive canopy in humid heat raises transpiration → worse WBT
    if (type === 'canopy' && baseT > 25 && rh > 75 && value > 25) {
      setSystemAlert({ title: '🚨 Wet-Bulb Trap', message: 'High ambient humidity. Excess canopy increases transpiration and can worsen lethal Wet-Bulb conditions.', type: 'error' });
    }

    // Cold biome: cooling infrastructure has negative ROI
    if (baseT < 12 && baseT !== 0 && value > 0) {
      setSystemAlert({ title: '❄️ Biome Mismatch', message: 'Cold-climate zone: Urban cooling yields negative ROI and increases winter heating demand.', type: 'info' });
      setCanopy(0); setCoolRoof(0); return;
    }

    if (type === 'canopy')   setCanopy(value);
    if (type === 'coolRoof') setCoolRoof(value);
  };

  // ── H3 DATA: convert position points → hex IDs + apply live mitigation ──
  // FIX: This useMemo previously lived inside the layer useMemo — separated for clarity
  const h3Data = useMemo(() => {
    if (!hexData || hexData.length === 0) return [];
    const cooling  = (canopy / 100) * 1.2 + (coolRoof / 100) * 0.8;
    const riskMult = Math.max(0.1, 1 - cooling * 0.08);
    return hexData.map(d => ({
      // position is [lng, lat] — latLngToCell takes (lat, lng, res)
      hex:  latLngToCell(d.position[1], d.position[0], 9),
      risk: (d.risk_weight ?? 0) * riskMult,
    }));
  }, [hexData, canopy, coolRoof]);

  // ── DUAL H3 LAYERS: glow (additive blend) + core (opaque fill) ──
  const layers = useMemo(() => {
    if (!isInitialized || h3Data.length === 0) return [];
    return [
      // Layer 1: soft neon glow (additive blending = colours bleed like kepler.gl)
      new H3HexagonLayer({
        id:           'h3-glow',
        data:         h3Data,
        getHexagon:   (d: any) => d.hex,
        getFillColor: (d: any) => { const [r, g, b] = getRiskColor(d.risk); return [r, g, b, 80] as [number, number, number, number]; },
        extruded:     false,
        coverage:     1.3,
        stroked:      false,
        parameters:   { depthTest: false, blend: true, blendFunc: [770, 1] }, // SRC_ALPHA, ONE → additive
        updateTriggers: { getFillColor: h3Data },
      }),
      // Layer 2: solid core (proper opacity, thin outline keeps hexes readable)
      new H3HexagonLayer({
        id:                 'h3-core',
        data:               h3Data,
        pickable:           true,
        getHexagon:         (d: any) => d.hex,
        getFillColor:       (d: any) => { const [r, g, b] = getRiskColor(d.risk); return [r, g, b, 145] as [number, number, number, number]; },
        extruded:           false,
        coverage:           0.96,
        stroked:            true,
        getLineColor:       [8, 12, 22, 70] as [number, number, number, number],
        lineWidthMinPixels: 0.3,
        parameters:         { depthTest: false },
        updateTriggers:     { getFillColor: h3Data },
      }),
    ];
  }, [isInitialized, h3Data]);

  // ── MITIGATION NUMBERS ──
  const mitigatedData = (() => {
    if (!isInitialized || simData.temp === '--' || (canopy === 0 && coolRoof === 0)) return null;
    const baseTemp       = parseFloat(String(simData.temp));
    const baseHW         = parseFloat(String(simData.heatwave));
    const baseDeaths     = parseFloat(String(simData.deaths).replace(/,/g, '')) || 0;
    const baseLossParsed = parseLoss(simData.loss);
    const cooling        = (canopy / 100) * 1.2 + (coolRoof / 100) * 0.8;
    const effectHW       = Math.max(0, baseHW - cooling * 3.5);
    const hwRatio        = baseHW > 0 ? effectHW / baseHW : 1;
    const combined       = hwRatio * Math.max(0, 1 - cooling * 0.08);
    const mitDeaths      = Math.round(baseDeaths * combined);
    const mitLossNum     = baseLossParsed ? baseLossParsed.num * combined : null;
    const mitTemp        = Math.max(0, baseTemp - cooling);
    return {
      deaths:      mitDeaths.toLocaleString(),
      savedDeaths: Math.round(baseDeaths - mitDeaths).toLocaleString(),
      loss:        mitLossNum !== null ? fmtLoss(mitLossNum) : null,
      savedLoss:   mitLossNum !== null && baseLossParsed ? fmtLoss(baseLossParsed.num - mitLossNum) : null,
      temp:        mitTemp.toFixed(1),
      heatwave:    Math.round(effectHW).toString(),
      tempDelta:   (baseTemp - mitTemp).toFixed(1),
      hwDelta:     Math.max(0, baseHW - Math.round(effectHW)),
    };
  })();

  const baseDeathsNum    = isInitialized ? parseFloat(String(simData.deaths).replace(/,/g, '')) || 0 : 0;
  const hasRealAdaptData = chartData.economic.some(d => d.adapt != null);
  const panelCls         = `bg-[#06101f]/95 backdrop-blur-2xl border border-slate-800/70 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.03)]`;

  return (
    <div className="w-full flex flex-col relative z-0">

      {/* ══════════════════════════════ MAP ══════════════════════════════ */}
      <section className="relative w-full h-[680px] md:h-[760px] lg:h-[820px] bg-[#020617] overflow-hidden border-b border-slate-800/40">

        <AuditModal open={auditOpen} onClose={() => setAuditOpen(false)} auditTrail={auditTrail} metricKey={auditKey} />

        {/* TOAST ALERT */}
        {systemAlert && (
          <div className={`absolute top-24 left-1/2 -translate-x-1/2 z-[200] w-[340px] p-4 rounded-xl border backdrop-blur-2xl shadow-2xl ${
            systemAlert.type === 'error'   ? 'bg-red-950/80 border-red-500/50'   :
            systemAlert.type === 'warning' ? 'bg-amber-950/80 border-amber-500/50' :
                                             'bg-cyan-950/80 border-cyan-500/50'
          }`}>
            <div className="flex justify-between items-start mb-1">
              <p className={`text-[10px] font-mono font-bold uppercase tracking-[0.2em] ${systemAlert.type === 'error' ? 'text-red-400' : systemAlert.type === 'warning' ? 'text-amber-400' : 'text-cyan-400'}`}>{systemAlert.title}</p>
              <button onClick={() => setSystemAlert(null)} className="text-slate-400 hover:text-white text-[12px] leading-none ml-2">✕</button>
            </div>
            <p className="text-[11px] font-sans text-slate-300 leading-relaxed">{systemAlert.message}</p>
          </div>
        )}

        {/* BASELINE / SIM MODE BADGE */}
        {isInitialized && !isLoading && !apiError && (
          <div className={`absolute top-5 left-1/2 -translate-x-1/2 z-[100] px-5 py-2 rounded-full border backdrop-blur-xl flex items-center gap-3 transition-all duration-700 pointer-events-none ${
            isSimulating
              ? 'bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
              : 'bg-red-950/40 border-red-500/40'
          }`}>
            <div className={`w-2 h-2 rounded-full animate-pulse ${isSimulating ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className={`text-[10px] font-mono font-bold uppercase tracking-[0.3em] ${isSimulating ? 'text-emerald-400' : 'text-red-400'}`}>
              {isSimulating ? 'Simulation Mode: Sandbox Active' : 'Baseline Reality: Do-Nothing Scenario'}
            </span>
          </div>
        )}

        {/* DECK + MAP */}
        <div className="absolute inset-0 z-0">
          <DeckGL
            viewState={viewState}
            onViewStateChange={({ viewState: vs, interactionState }: any) => {
              if (interactionState.isDragging || interactionState.isPanning || interactionState.isZooming || interactionState.isRotating)
                setViewState(vs);
            }}
            controller={{ scrollZoom: false, dragPan: !isMobile, doubleClickZoom: true, dragRotate: !isMobile, touchRotate: false, touchZoom: true }}
            layers={layers}
          >
            <Map mapStyle={cartoDarkStyle} attributionControl={false} reuseMaps>
              <NavigationControl position="bottom-right" showCompass={false} style={{ bottom: '140px', right: '16px', background: 'rgba(6,16,31,0.95)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px' }} />
            </Map>
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_30%,#020617_100%)] z-10" />
          </DeckGL>
        </div>

        {isInitialized && !isLoading && !apiError && <MapLegend />}
        {isInitialized && !isLoading && !apiError && (
          <div className="absolute bottom-[110px] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-none animate-bounce">
            <span className="text-[8px] font-mono text-cyan-500/40 uppercase tracking-[0.4em] mb-1">Scroll</span>
            <div className="w-2.5 h-2.5 border-b border-r border-cyan-500/30 rotate-45" />
          </div>
        )}

        {/* ── PANELS OVERLAY ──
            IMPORTANT: parent is pointer-events-none so deck.gl captures map pan/zoom.
            Every interactive element inside must have pointer-events-auto explicitly. */}
        <div className="absolute inset-x-0 top-0 bottom-0 z-20 flex justify-between items-start p-3 md:p-5 lg:p-8 pointer-events-none gap-2 md:gap-3">

          {/* ─── LEFT PANEL ─── */}
          <div className={`${panelCls} w-[240px] md:w-[260px] lg:w-[280px] p-4 md:p-5 flex flex-col gap-3 md:gap-4 pointer-events-auto transition-colors duration-700 ${isSimulating ? 'border-emerald-500/30' : ''}`}>

            {/* City search */}
            <div className="space-y-1.5">
              <label className="block text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">Location</label>
              <div className="relative">
                <input
                  type="text" placeholder="Search city…" value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); if (selectedCity) setSelectedCity(null); }}
                  className="w-full bg-[#0a1830] border border-slate-700/60 rounded-xl px-3 py-2.5 text-[12px] font-sans text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
                />
                {suggestions.length > 0 && !selectedCity && (
                  <div className="absolute top-full left-0 w-full mt-1.5 bg-[#06101f] border border-slate-700/50 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.9)] z-[9999] overflow-hidden">
                    {suggestions.map((city, idx) => (
                      <div key={`${city.id}-${idx}`}
                        onClick={() => { setSelectedCity({ name: city.name, lat: city.latitude, lng: city.longitude }); setSearchQuery(`${city.name}${city.country ? ', ' + city.country : ''}`); setSuggestions([]); }}
                        className="px-3 py-2.5 text-[11px] font-sans text-slate-300 hover:bg-indigo-700/30 cursor-pointer transition-colors border-b border-slate-800/40 last:border-0"
                      >{city.name}{city.country && <span className="text-slate-600 ml-1.5">{city.country}</span>}</div>
                    ))}
                  </div>
                )}
              </div>
              {selectedCity && <p className="text-[9px] font-mono text-slate-600 italic pl-0.5">{formatCoordinates(selectedCity.lat, selectedCity.lng)}</p>}
            </div>

            {/* Year */}
            <div className="space-y-1.5">
              <label className="block text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">Target Year</label>
              <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full bg-[#0a1830] border border-slate-700/60 rounded-xl px-3 py-2.5 text-[12px] font-sans text-slate-200 outline-none appearance-none cursor-pointer focus:border-indigo-500/50 transition-colors">
                <option value="2030">2030 — Near-term</option>
                <option value="2050">2050 — Mid-century</option>
                <option value="2070">2070 — Long-term</option>
                <option value="2100">2100 — End-century</option>
              </select>
            </div>

            {/* SSP */}
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <label className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">Emission Scenario</label>
                <InfoTooltip publicText="Global emissions pathway. Higher SSP = more warming." techText="IPCC AR6 SSP scenarios" />
              </div>
              <select value={ssp} onChange={(e) => setSsp(e.target.value)} className="w-full bg-[#0a1830] border border-slate-700/60 rounded-xl px-3 py-2.5 text-[12px] font-sans text-slate-200 outline-none appearance-none cursor-pointer focus:border-indigo-500/50 transition-colors">
                <option value="SSP2-4.5">SSP2-4.5 — Moderate</option>
                <option value="SSP5-8.5">SSP5-8.5 — Extreme</option>
              </select>
            </div>

            {/* Generate button */}
            <button onClick={handleInitialize} disabled={!selectedCity || isLoading}
              className="w-full py-3 rounded-xl bg-indigo-600/15 border border-indigo-500/35 text-[10px] font-mono text-indigo-300 uppercase tracking-[0.3em] hover:bg-indigo-600/28 hover:border-indigo-400/55 disabled:opacity-35 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
              style={{ touchAction: 'manipulation' }}>
              {isLoading ? (<><span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />Generating…</>) : 'Generate Projection'}
            </button>

            {/* SIMULATOR — only shows after first projection */}
            {isInitialized && (
              <div className="mt-1 pt-4 border-t border-slate-800/60">
                <div className="flex items-center gap-1.5 mb-4">
                  <div className={`w-1.5 h-1.5 rounded-full ${isSimulating ? 'bg-emerald-500 animate-pulse' : 'bg-slate-600'}`} />
                  <p className={`text-[9px] font-mono uppercase tracking-widest ${isSimulating ? 'text-emerald-400' : 'text-slate-500'}`}>Theoretical Simulator</p>
                </div>

                {/* Canopy slider */}
                <div className="space-y-3 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">Canopy</label>
                      <InfoTooltip publicText="Urban tree coverage cools surface temperature." techText="Bowler 2010: ~0.12°C cooling per 1% canopy" />
                    </div>
                    <span className={`text-[11px] font-mono font-bold ${canopy > 25 ? 'text-red-500' : 'text-emerald-400'}`}>
                      +{canopy}%{canopy > 25 ? ' ⚠️' : ''}
                    </span>
                  </div>
                  <input type="range" min="0" max="50" value={canopy}
                    onChange={(e) => handleMitigationChange('canopy', Number(e.target.value))}
                    className={`w-full h-1.5 appearance-none rounded-full cursor-pointer ${canopy > 25 ? 'accent-red-500' : 'accent-emerald-500'}`}
                    style={{ touchAction: 'manipulation' }} />
                  {/* Feasibility gradient bar */}
                  <div className="relative h-1 w-full rounded-full overflow-hidden bg-slate-800">
                    <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 via-yellow-500 to-red-600 opacity-50" />
                  </div>
                  {canopy > 25 && <p className="text-[8px] font-mono text-red-500/80 uppercase tracking-tighter leading-tight">Critical: density requires significant urban demolition</p>}
                </div>

                {/* Cool roof slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <label className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">Albedo Roofs</label>
                      <InfoTooltip publicText="Reflective rooftops reduce solar heat absorption." techText="Santamouris 2014: ~0.08°C per 1% albedo" />
                    </div>
                    <span className="text-[11px] font-mono text-cyan-400 font-bold">+{coolRoof}%</span>
                  </div>
                  <input type="range" min="0" max="100" value={coolRoof}
                    onChange={(e) => handleMitigationChange('coolRoof', Number(e.target.value))}
                    className="w-full h-1.5 accent-cyan-500 cursor-pointer"
                    style={{ touchAction: 'manipulation' }} />
                </div>
              </div>
            )}
          </div>

          {/* ─── RIGHT PANEL ─── */}
          <div className={`${panelCls} w-[260px] md:w-[280px] lg:w-[300px] p-4 md:p-5 flex flex-col gap-3 pointer-events-auto transition-colors duration-700 ${isSimulating ? 'border-emerald-500/30' : ''}`}>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800/50">
              <p className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">Risk Metrics</p>
              {isInitialized && (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest">Live</span>
                </div>
              )}
            </div>

            {apiError ? (
              <div className="bg-red-950/20 border border-red-900/30 rounded-xl p-3 text-red-400 text-[11px] font-mono leading-relaxed">{apiError}</div>
            ) : (
              <>
                {/* DEATHS */}
                <div className="bg-[#0a1830] border border-slate-800/50 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.15em]">Attributable Deaths</span>
                    </div>
                    <InfoTooltip alignLeft publicText="Estimated fatalities directly attributable to extreme heat exposure." techText="Gasparrini 2017 · β = 0.0801" />
                  </div>
                  <div>
                    <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest mb-0.5">Baseline</p>
                    {isInitialized && simData.deaths !== '--'
                      ? <p className="text-[30px] md:text-[34px] font-mono tracking-tighter leading-none tabular-nums select-none">
                          {isSimulating
                            ? <span className="text-red-500/50 line-through">{simData.deaths}</span>
                            : <span className="text-white">{simData.deaths}</span>}
                        </p>
                      : <p className="text-[30px] font-mono text-slate-700 tracking-tighter leading-none">—</p>}
                  </div>
                  {isInitialized && baseDeathsNum > 0 && !isSimulating && (
                    <p className="text-[9px] font-mono text-slate-500">95% CI · {formatDeathsRange(baseDeathsNum)}</p>
                  )}
                  {mitigatedData && (
                    <div className="pt-2 border-t border-slate-700/50">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[8px] font-mono text-emerald-500/70 uppercase tracking-widest mb-0.5">With Mitigation</p>
                          <p className="text-[18px] font-mono text-emerald-400 tabular-nums leading-none">↓ {mitigatedData.deaths}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest mb-0.5">Saved</p>
                          <p className="text-[13px] font-mono text-emerald-300 font-bold">−{mitigatedData.savedDeaths}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <p className="text-[8px] font-mono text-slate-600 italic pt-0.5"><em>Gasparrini et al. (2017), Lancet Planetary Health</em></p>
                  {isInitialized && auditTrail && (
                    <button onClick={() => openAudit('mortality')} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[9px] font-mono text-cyan-400 hover:bg-cyan-900/40 hover:border-cyan-400/40 transition-all duration-150">
                      <span>⊕</span>Calculation Details
                    </button>
                  )}
                </div>

                {/* ECONOMIC DECAY */}
                <div className="bg-[#0a1830] border border-slate-800/50 rounded-xl p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                      <span className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.15em]">Economic Decay</span>
                    </div>
                    <InfoTooltip alignLeft publicText="Annual GDP loss from heat-induced productivity and labor decline." techText="Burke 2018 · ILO 2019" />
                  </div>
                  <div>
                    <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest mb-0.5">Baseline</p>
                    {isInitialized && simData.loss !== '--'
                      ? <p className="text-[22px] md:text-[26px] font-mono tracking-tighter leading-none select-none">
                          {isSimulating
                            ? <span className="text-red-500/50 line-through">{simData.loss}</span>
                            : <span className="text-white">{simData.loss}</span>}
                        </p>
                      : <p className="text-[22px] font-mono text-slate-700 tracking-tighter leading-none">—</p>}
                  </div>
                  {isInitialized && simData.loss !== '--' && !isSimulating && (() => { const p = parseLoss(simData.loss); return p ? <p className="text-[9px] font-mono text-slate-500">Range · {formatEconomicRange(p.num)}</p> : null; })()}
                  {mitigatedData && mitigatedData.loss && (
                    <div className="pt-2 border-t border-slate-700/50">
                      <div className="flex items-end justify-between">
                        <div>
                          <p className="text-[8px] font-mono text-emerald-500/70 uppercase tracking-widest mb-0.5">With Mitigation</p>
                          <p className="text-[16px] font-mono text-emerald-400 leading-none">↓ {mitigatedData.loss}</p>
                        </div>
                        {mitigatedData.savedLoss && (
                          <div className="text-right">
                            <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest mb-0.5">Saved</p>
                            <p className="text-[12px] font-mono text-emerald-300 font-bold">−{mitigatedData.savedLoss}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  <p className="text-[8px] font-mono text-slate-600 italic pt-0.5"><em>Burke et al. (2018), Nature · ILO (2019)</em></p>
                  {isInitialized && auditTrail && (
                    <button onClick={() => openAudit('economics')} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[9px] font-mono text-cyan-400 hover:bg-cyan-900/40 hover:border-cyan-400/40 transition-all duration-150">
                      <span>⊕</span>Calculation Details
                    </button>
                  )}
                </div>

                {/* HW DAYS + PEAK Tx5d */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: 'heatwave', label: 'HW Days',   unit: 'd', pub: 'Annual days exceeding ERA5 P95 threshold.', tech: 'ERA5 P95 · 1991-2020',      src: 'CMIP6 Ensemble',    mit: mitigatedData?.heatwave },
                    { key: 'temp',     label: 'Peak Tx5d', unit: '°C', pub: 'Hottest sustained 5-day temperature block.', tech: 'WMO ETCCDI Tx5d',       src: 'Open-Meteo CMIP6',  mit: mitigatedData?.temp     },
                  ].map((m) => {
                    const val = simData[m.key as 'heatwave' | 'temp'];
                    return (
                      <div key={m.key} className="bg-[#0a1830] border border-slate-800/50 rounded-xl p-3 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[8px] font-mono text-slate-600 uppercase tracking-[0.12em]">{m.label}</span>
                          <InfoTooltip alignLeft publicText={m.pub} techText={m.tech} />
                        </div>
                        {isInitialized && val !== '--'
                          ? <p className="text-[20px] font-mono leading-none tabular-nums select-none">
                              {isSimulating
                                ? <span className="text-red-500/50 line-through text-[14px]">{val}{m.unit}</span>
                                : <span className="text-white">{val}{m.unit}</span>}
                            </p>
                          : <p className="text-[20px] font-mono text-slate-700 leading-none">—</p>}
                        {m.mit && isSimulating && m.mit !== val && (
                          <p className="text-[11px] font-mono text-emerald-400 leading-none">↓ {m.mit}{m.unit}</p>
                        )}
                        {m.key === 'temp' && isInitialized && simData.baseTemp !== '--' && (
                          <p className="text-[8px] font-mono text-slate-600">hist. {simData.baseTemp}°C</p>
                        )}
                        <p className="text-[8px] font-mono text-slate-600 italic"><em>{m.src}</em></p>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════ CHARTS + AI ══════════════════════════════ */}
      <section className="bg-[#030c1a] w-full flex flex-col z-10 relative">
        {isLoading ? <LoadingSpinner /> : !isInitialized ? (
          <div className="py-28 text-center">
            <p className="text-slate-700 font-mono text-[10px] uppercase tracking-[0.5em]">Select a city and generate a projection</p>
          </div>
        ) : (
          <>
            {(chartData.heatwave.length > 0 || chartData.economic.length > 0) && (
              <div className="px-4 md:px-8 lg:px-16 py-10 w-full max-w-[1440px] mx-auto border-b border-slate-800/30">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {chartData.heatwave.length > 0 && (
                    <div className="bg-[#06101f] border border-slate-800/60 rounded-2xl p-5">
                      <p className="text-[11px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold mb-1">Heatwave Escalation Trajectory</p>
                      <p className="text-[9px] font-mono text-slate-600 italic mb-4"><em>Open-Meteo CMIP6 Ensemble (IPCC AR6)</em></p>
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height={250}>
                          <LineChart data={chartData.heatwave} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="year" stroke="#334155" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }} />
                            <YAxis stroke="#334155" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }} unit=" d" />
                            <RechartsTooltip contentStyle={{ background: '#06101f', border: '1px solid #1e293b', borderRadius: '10px', fontSize: '11px', fontFamily: 'monospace' }} formatter={(v: any) => [`${v} days`, 'Heatwave Days']} />
                            <Line type="monotone" dataKey="val" stroke="#f87171" strokeWidth={2.5} dot={{ r: 4, fill: '#06101f', strokeWidth: 2, stroke: '#f87171' }} activeDot={{ r: 6 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                  {chartData.economic.length > 0 && (
                    <div className="bg-[#06101f] border border-slate-800/60 rounded-2xl p-5">
                      <p className="text-[11px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold mb-1">Economic Risk Projection</p>
                      <p className="text-[9px] font-mono text-slate-600 italic mb-1"><em>Burke (2018) · ILO (2019) · values in M USD</em></p>
                      {!hasRealAdaptData && <p className="text-[8px] font-mono text-slate-700 italic mb-3">Baseline only · no mitigation scenario from API</p>}
                      <div className="h-[250px]">
                        <ResponsiveContainer width="100%" height={250}>
                          <BarChart data={chartData.economic.map(d => ({ ...d, adapt: d.adapt ?? null }))} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="year" stroke="#334155" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }} />
                            <YAxis stroke="#334155" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }} />
                            <RechartsTooltip contentStyle={{ background: '#06101f', border: '1px solid #1e293b', borderRadius: '10px', fontSize: '11px', fontFamily: 'monospace' }} formatter={(v: any, name: any) => [`$${Number(v).toFixed(0)}M`, name]} />
                            <Legend wrapperStyle={{ paddingTop: '14px', fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8' }} />
                            <Bar dataKey="noAction" name="Baseline (No Action)" fill="#ef4444" radius={[3,3,0,0]} opacity={0.85} />
                            {hasRealAdaptData && <Bar dataKey="adapt" name="With Mitigation" fill="#10b981" radius={[3,3,0,0]} opacity={0.85} />}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {aiAnalysis && (
              <div className="px-4 md:px-8 lg:px-16 py-10 w-full max-w-[1440px] mx-auto">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6 pb-4 border-b border-slate-800/40">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                    <p className="text-[10px] font-mono text-slate-400 uppercase tracking-[0.3em]">
                      Strategic Analysis{selectedCity && <span className="text-slate-200 ml-2 font-bold">· {selectedCity.name}</span>}
                    </p>
                  </div>
                  <p className="text-[8px] font-mono text-slate-700 italic uppercase tracking-widest">All values sourced from climate engine · Baseline risk</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-5">
                  <AiCard text={aiAnalysis.mortality}      title="Mortality Risk"        badge="Baseline" />
                  <AiCard text={aiAnalysis.economic}       title="Economic Impact"       badge="Baseline" />
                  <AiCard text={aiAnalysis.infrastructure} title="Infrastructure Stress" badge="Baseline" />

                  {/* Live mitigation card */}
                  <div className="bg-[#06101f] border border-emerald-900/40 rounded-2xl p-4 md:p-5 h-full flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800/60">
                      <p className="text-[10px] font-mono text-emerald-400 uppercase tracking-[0.2em] font-bold">Mitigation Model</p>
                      <div className="flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest">Live</span>
                      </div>
                    </div>
                    {aiAnalysis.mitigation && (() => {
                      const text  = aiAnalysis.mitigation;
                      const clean = (s: string) => s.replace(/\*\*.*?\*\*:?/g, '').replace(/^:\s*/, '').trim();
                      if (text.includes('**EFFECT:**') && text.includes('**SOLUTION:**')) {
                        const [rawCause, rest]    = text.split('**EFFECT:**');
                        const [rawEffect, rawSol] = rest.split('**SOLUTION:**');
                        return (
                          <div className="space-y-2 flex-grow text-[11px]">
                            {[
                              { label: 'Why it works', text: clean(rawCause),  cls: 'text-slate-600' },
                              { label: 'Mechanism',    text: clean(rawEffect), cls: 'text-slate-600' },
                              { label: 'Scaling rule', text: clean(rawSol),    cls: 'text-cyan-700'  },
                            ].map((row) => (
                              <div key={row.label}>
                                <p className={`text-[8px] font-mono ${row.cls} uppercase tracking-[0.15em] mb-1`}>{row.label}</p>
                                <p className="text-slate-400 leading-relaxed font-sans">{row.text}</p>
                              </div>
                            ))}
                          </div>
                        );
                      }
                      return <p className="text-slate-400 text-[11px] leading-relaxed font-sans flex-grow">{clean(text)}</p>;
                    })()}
                    <div className="h-px bg-slate-800/60" />
                    {mitigatedData ? (
                      <div>
                        <p className="text-[8px] font-mono text-slate-600 uppercase tracking-[0.15em] mb-2">+{canopy}% canopy · +{coolRoof}% cool roofs</p>
                        {[
                          { label: 'Lives Saved',    value: `−${mitigatedData.savedDeaths}`, color: 'text-emerald-300' },
                          { label: 'GDP Saved',      value: mitigatedData.savedLoss ? `−${mitigatedData.savedLoss}` : '—', color: 'text-emerald-300' },
                          { label: 'Temp Reduction', value: `−${mitigatedData.tempDelta}°C`, color: 'text-cyan-300'    },
                          { label: 'HW Days Cut',    value: `−${mitigatedData.hwDelta}d`,    color: 'text-cyan-300'    },
                        ].map((row) => (
                          <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-slate-800/30 last:border-0">
                            <span className="text-[10px] font-mono text-slate-500">{row.label}</span>
                            <span className={`text-[12px] font-mono font-bold tabular-nums ${row.color}`}>{row.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="bg-slate-900/30 rounded-xl px-3 py-3 border border-slate-800/40">
                        <p className="text-[10px] font-mono text-slate-600 leading-relaxed">
                          Adjust <span className="text-emerald-400">Canopy</span> and <span className="text-cyan-400">Albedo Roofs</span> sliders to see live impact.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {mitigatedData && (
                  <div className="bg-[#06101f] border border-slate-800/40 rounded-2xl p-5 md:p-6">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-5">
                      <div className="w-2 h-2 rounded-full bg-cyan-500" />
                      <p className="text-[9px] font-mono text-slate-400 uppercase tracking-[0.2em]">Baseline vs Mitigation</p>
                      <span className="text-[9px] font-mono text-slate-600">·</span>
                      <span className="text-[9px] font-mono text-slate-500">+{canopy}% canopy · +{coolRoof}% cool roofs</span>
                      <div className="ml-auto flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[8px] font-mono text-emerald-500 uppercase tracking-widest">Live</span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-5">
                      {[
                        { label: 'Attributable Deaths', baseline: simData.deaths,         mitigated: mitigatedData.deaths,              saved: `−${mitigatedData.savedDeaths} lives`,                          baseColor: 'text-red-400'    },
                        { label: 'Economic Loss',        baseline: simData.loss,           mitigated: mitigatedData.loss ?? simData.loss, saved: mitigatedData.savedLoss ? `−${mitigatedData.savedLoss}` : '—', baseColor: 'text-amber-400'  },
                        { label: 'Peak Temperature',     baseline: `${simData.temp}°C`,    mitigated: `${mitigatedData.temp}°C`,          saved: `−${mitigatedData.tempDelta}°C`,                                baseColor: 'text-orange-400' },
                        { label: 'Heatwave Days',        baseline: `${simData.heatwave}d`, mitigated: `${mitigatedData.heatwave}d`,       saved: `−${mitigatedData.hwDelta}d`,                                   baseColor: 'text-yellow-400' },
                      ].map((item) => (
                        <div key={item.label} className="space-y-2">
                          <p className="text-[8px] font-mono text-slate-600 uppercase tracking-[0.12em] leading-tight">{item.label}</p>
                          <div className="flex items-baseline justify-between">
                            <span className="text-[8px] font-mono text-slate-600 uppercase">Without</span>
                            <span className={`text-[13px] md:text-[14px] font-mono font-bold tabular-nums ${item.baseColor}`}>{item.baseline}</span>
                          </div>
                          <div className="flex items-baseline justify-between">
                            <span className="text-[8px] font-mono text-slate-600 uppercase">With</span>
                            <span className="text-[13px] md:text-[14px] font-mono font-bold tabular-nums text-slate-300">{item.mitigated}</span>
                          </div>
                          <div className="flex items-center justify-between bg-emerald-950/25 rounded-lg px-2.5 py-1.5 border border-emerald-800/20">
                            <span className="text-[8px] font-mono text-slate-600 uppercase">Saved</span>
                            <span className="text-[11px] font-mono text-emerald-400 font-bold">{item.saved}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}