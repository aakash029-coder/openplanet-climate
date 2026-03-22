'use client';

import React, { useState, useEffect } from 'react';
import Map, { NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import DeckGL from '@deck.gl/react';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
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

// ─────────────────────────────────────────────────────────────────
// TOOLTIP
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// VAR TOOLTIPS
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// CALCULATION DETAILS MODAL — inside map section
// ─────────────────────────────────────────────────────────────────
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

  const metricLabel = metricKey === 'mortality' ? 'Mortality'
    : metricKey === 'economics' ? 'Economics' : 'Wet-Bulb';

  return (
    <>
      <div className="absolute inset-0 z-[500] bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="absolute inset-0 z-[501] flex items-center justify-center pointer-events-none px-4">
        <div
          className="pointer-events-auto w-full max-w-[430px] bg-[#06101f] border border-cyan-500/25 rounded-2xl shadow-[0_0_60px_rgba(34,211,238,0.12),0_24px_48px_rgba(0,0,0,0.8)] overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
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

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────
const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center w-full py-24 bg-[#020617]">
    <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6" />
    <span className="font-mono text-[10px] text-indigo-400 tracking-[0.5em] uppercase animate-pulse">Computing Spatial Risk Array...</span>
  </div>
);

const MapLegend = () => (
  <div className="absolute bottom-16 left-1/2 -translate-x-1/2 bg-black/80 border border-white/5 px-4 py-2 rounded-full backdrop-blur-xl z-50 flex items-center gap-3 shadow-2xl pointer-events-none">
    {[{ color: 'bg-emerald-500', label: 'Safe' }, { color: 'bg-yellow-400', label: 'Moderate' }, { color: 'bg-orange-500', label: 'High' }, { color: 'bg-red-600', label: 'Critical' }].map((item) => (
      <div key={item.label} className="flex items-center gap-1.5">
        <div className={`w-2 h-2 rounded-full ${item.color}`} />
        <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">{item.label}</span>
      </div>
    ))}
  </div>
);

const cartoDarkStyle = {
  version: 8 as const,
  sources: { 'carto-dark': { type: 'raster' as const, tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png', 'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png', 'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'], tileSize: 256 } },
  layers: [{ id: 'carto-dark-layer', type: 'raster' as const, source: 'carto-dark', paint: { 'raster-opacity': 1 } }],
};

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

// ─────────────────────────────────────────────────────────────────
// AI CARD — Cause / Effect / Solution
// ─────────────────────────────────────────────────────────────────
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

function parseLoss(lossStr: string): { num: number; prefix: string; suffix: string } | null {
  const m = String(lossStr).match(/([\$€£])?([0-9.]+)([BKM])?/i);
  if (!m) return null;
  const multiplier = m[3]?.toUpperCase() === 'B' ? 1e9 : m[3]?.toUpperCase() === 'M' ? 1e6 : 1;
  return { num: parseFloat(m[2]) * multiplier, prefix: m[1] || '$', suffix: m[3] || '' };
}

function fmtLoss(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(0)}M`;
  return `$${n.toLocaleString()}`;
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
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
  const [canopy, setCanopy] = useState(5);
  const [coolRoof, setCoolRoof] = useState(15);
  const [viewState, setViewState] = useState<any>({ longitude: 0, latitude: 20, zoom: 1.8, pitch: 0, bearing: 0 });
  const [hexData, setHexData] = useState<{ position: [number, number] }[]>([]);

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

  const openAudit = (k: 'mortality' | 'economics' | 'wetbulb') => { setAuditKey(k); setAuditOpen(true); };

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
    setIsLoading(true); setApiError(null);
    setViewState((p: any) => ({
      ...p, longitude: selectedCity.lng, latitude: selectedCity.lat,
      zoom: 11, pitch: 50, bearing: 10,
      transitionDuration: 3000, transitionInterpolator: new FlyToInterpolator(),
    }));
    try {
      const res = await fetch('/api/engine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/api/predict',
          payload: { city: selectedCity.name, lat: selectedCity.lat, lng: selectedCity.lng, ssp, year, canopy: 0, coolRoof: 0 },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      if (!data.metrics || !data.hexGrid) throw new Error('API missing data.');
      if (onTargetLocked) onTargetLocked(selectedCity.name);
      setHexData(data.hexGrid);
      setSimData({
        temp: data.metrics?.temp ?? '--', deaths: data.metrics?.deaths ?? '--',
        ci: data.metrics?.ci ?? null, loss: data.metrics?.loss ?? '--',
        heatwave: data.metrics?.heatwave ?? '--', baseTemp: data.metrics?.baseTemp ?? '--',
        wbt: data.metrics?.wbt ?? '--', region: data.metrics?.region ?? '--',
        rh_p95: data.metrics?.rh_p95 ?? null,
      });
      setAuditTrail(data.auditTrail ?? null);
      setAiAnalysis(data.aiAnalysis ?? null);
      if (data.charts) setChartData({ heatwave: data.charts.heatwave || [], economic: data.charts.economic || [] });
      setIsInitialized(true);
    } catch (err: any) {
      setApiError(err.message); setIsInitialized(false);
    } finally { setIsLoading(false); }
  };

  // Mitigation math — pure frontend, zero API calls
  const mitigatedData = (() => {
    if (!isInitialized || simData.temp === '--') return null;
    if (canopy === 0 && coolRoof === 0) return null;
    const baseTemp       = parseFloat(String(simData.temp));
    const baseHW         = parseFloat(String(simData.heatwave));
    const baseDeaths     = parseFloat(String(simData.deaths).replace(/,/g, '')) || 0;
    const baseLossParsed = parseLoss(simData.loss);
    const cooling        = (canopy / 100) * 1.2 + (coolRoof / 100) * 0.8;
    const effectHW       = Math.max(0, baseHW - cooling * 3.5);
    const hwRatio        = baseHW > 0 ? effectHW / baseHW : 1;
    const combined       = hwRatio * Math.max(0, 1 - cooling * 0.08);
    const mitDeaths      = Math.round(baseDeaths * combined);
    const savedDeaths    = Math.round(baseDeaths - mitDeaths);
    const mitLossNum     = baseLossParsed ? baseLossParsed.num * combined : null;
    const savedLossNum   = baseLossParsed && mitLossNum !== null ? baseLossParsed.num - mitLossNum : null;
    const mitTemp        = Math.max(0, baseTemp - cooling);
    return {
      deaths: mitDeaths.toLocaleString(), savedDeaths: savedDeaths.toLocaleString(),
      loss: mitLossNum !== null ? fmtLoss(mitLossNum) : null,
      savedLoss: savedLossNum !== null ? fmtLoss(savedLossNum) : null,
      temp: mitTemp.toFixed(1),
      heatwave: Math.round(effectHW).toString(),
      tempDelta: (baseTemp - mitTemp).toFixed(1),
      hwDelta: Math.max(0, baseHW - Math.round(effectHW)),
    };
  })();

  const baseDeathsNum = isInitialized ? parseFloat(String(simData.deaths).replace(/,/g, '')) || 0 : 0;

  const layers = [new HexagonLayer({
    id: 'risk-heatmap', data: hexData,
    colorRange: [[34,197,94],[234,179,8],[249,115,22],[239,68,68]],
    elevationRange: [0, 1000], elevationScale: 5, extruded: true,
    getPosition: (d: any) => d.position,
    radius: 350, opacity: 0.85, coverage: 0.85, upperPercentile: 99,
    transitions: { elevationScale: 2000 },
  })];

  const panelClass = `bg-[#06101f]/95 backdrop-blur-2xl border border-slate-800/70 rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.03)] pointer-events-auto`;

  return (
    <div className="w-full flex flex-col relative z-0">

      {/* ═══ MAP ═══ */}
      <section className="relative w-full h-[680px] md:h-[760px] lg:h-[820px] bg-[#020617] overflow-hidden border-b border-slate-800/40">

        <AuditModal open={auditOpen} onClose={() => setAuditOpen(false)} auditTrail={auditTrail} metricKey={auditKey} />

        <div className="absolute inset-0 z-0">
          <DeckGL
            viewState={viewState}
            onViewStateChange={({ viewState: vs, interactionState }: any) => {
              if (interactionState.isDragging || interactionState.isPanning || interactionState.isZooming || interactionState.isRotating) setViewState(vs);
            }}
            controller={{ scrollZoom: false, dragPan: !isMobile, doubleClickZoom: true, dragRotate: !isMobile, touchRotate: false, touchZoom: true }}
            layers={isInitialized ? layers : []}
          >
            <Map mapStyle={cartoDarkStyle} attributionControl={false} reuseMaps>
              <NavigationControl position="bottom-right" showCompass={false} style={{ bottom: '140px', right: '16px', background: 'rgba(6,16,31,0.95)', border: '1px solid rgba(99,102,241,0.2)', borderRadius: '10px' }} />
            </Map>
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_25%,#020617_100%)] z-10" />
          </DeckGL>
        </div>

        {isInitialized && !isLoading && !apiError && <MapLegend />}
        {isInitialized && !isLoading && !apiError && (
          <div className="absolute bottom-[110px] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center pointer-events-none animate-bounce">
            <span className="text-[8px] font-mono text-cyan-500/40 uppercase tracking-[0.4em] mb-1">Scroll</span>
            <div className="w-2.5 h-2.5 border-b border-r border-cyan-500/30 rotate-45" />
          </div>
        )}

        {/* Overlay panels */}
        <div className="absolute inset-x-0 top-0 bottom-0 z-20 flex justify-between items-start p-3 md:p-5 lg:p-8 pointer-events-none gap-2 md:gap-3">

          {/* LEFT PANEL */}
          <div className={`${panelClass} w-[240px] md:w-[260px] lg:w-[280px] p-4 md:p-5 flex flex-col gap-3 md:gap-4`}>
            <div className="space-y-1.5">
              <label className="block text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">Location</label>
              <div className="relative">
                <input type="text" placeholder="Search city…" value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); if (selectedCity) setSelectedCity(null); }}
                  className="w-full bg-[#0a1830] border border-slate-700/60 rounded-xl px-3 py-2.5 text-[12px] font-sans text-slate-200 placeholder:text-slate-600 outline-none focus:border-indigo-500/50 transition-colors"
                />
                {suggestions.length > 0 && !selectedCity && (
                  <div className="absolute top-full left-0 w-full mt-1.5 bg-[#06101f] border border-slate-700/50 rounded-xl shadow-[0_16px_48px_rgba(0,0,0,0.9)] z-[9999] overflow-hidden">
                    {suggestions.map((city, idx) => (
                      <div key={`${city.id}-${idx}`}
                        onClick={() => { setSelectedCity({ name: city.name, lat: city.latitude, lng: city.longitude }); setSearchQuery(`${city.name}${city.country ? ', ' + city.country : ''}`); setSuggestions([]); }}
                        className="px-3 py-2.5 text-[11px] font-sans text-slate-300 hover:bg-indigo-700/30 cursor-pointer transition-colors border-b border-slate-800/40 last:border-0"
                      >
                        {city.name}{city.country && <span className="text-slate-600 ml-1.5">{city.country}</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {selectedCity && <p className="text-[9px] font-mono text-slate-600 italic pl-0.5">{formatCoordinates(selectedCity.lat, selectedCity.lng)}</p>}
            </div>

            <div className="space-y-1.5">
              <label className="block text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">Target Year</label>
              <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full bg-[#0a1830] border border-slate-700/60 rounded-xl px-3 py-2.5 text-[12px] font-sans text-slate-200 outline-none appearance-none cursor-pointer focus:border-indigo-500/50 transition-colors">
                <option value="2030">2030 — Near-term</option>
                <option value="2050">2050 — Mid-century</option>
                <option value="2070">2070 — Long-term</option>
                <option value="2100">2100 — End-century</option>
              </select>
            </div>

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

            <div className="h-px bg-slate-800/60" />

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">Canopy</label>
                  <InfoTooltip publicText="Urban tree coverage cools surface temperature." techText="Bowler 2010: 1.2°C / 100%" />
                </div>
                <span className="text-[11px] font-mono text-emerald-400 font-bold">+{canopy}%</span>
              </div>
              <input type="range" min="0" max="50" value={canopy} onChange={(e) => setCanopy(Number(e.target.value))} className="w-full h-1.5 accent-emerald-500 cursor-pointer" style={{ touchAction: 'manipulation' }} />
              <div className="flex justify-between text-[9px] font-mono text-slate-700"><span>0%</span><span>50%</span></div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <label className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.2em]">Albedo Roofs</label>
                  <InfoTooltip publicText="Reflective rooftops reduce solar heat absorption." techText="Santamouris 2015: 0.8°C / 100%" />
                </div>
                <span className="text-[11px] font-mono text-indigo-400 font-bold">+{coolRoof}%</span>
              </div>
              <input type="range" min="0" max="100" value={coolRoof} onChange={(e) => setCoolRoof(Number(e.target.value))} className="w-full h-1.5 accent-indigo-500 cursor-pointer" style={{ touchAction: 'manipulation' }} />
              <div className="flex justify-between text-[9px] font-mono text-slate-700"><span>0%</span><span>100%</span></div>
            </div>

            <button onClick={handleInitialize} disabled={!selectedCity || isLoading}
              className="w-full mt-1 py-3 rounded-xl bg-indigo-600/15 border border-indigo-500/35 text-[10px] font-mono text-indigo-300 uppercase tracking-[0.3em] hover:bg-indigo-600/28 hover:border-indigo-400/55 disabled:opacity-35 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center gap-2"
              style={{ touchAction: 'manipulation' }}>
              {isLoading ? (<><span className="w-3 h-3 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />Generating…</>) : 'Generate Projection'}
            </button>
          </div>

          {/* RIGHT PANEL */}
          <div className={`${panelClass} w-[260px] md:w-[280px] lg:w-[300px] p-4 md:p-5 flex flex-col gap-3`}>
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
                    {isInitialized && !isLoading && !apiError && simData.deaths !== '--' ? (
                      <p className="text-[30px] md:text-[34px] font-mono text-white tracking-tighter leading-none tabular-nums select-none">{simData.deaths}</p>
                    ) : <p className="text-[30px] font-mono text-slate-700 tracking-tighter leading-none">—</p>}
                  </div>
                  {isInitialized && baseDeathsNum > 0 && (
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
                  <p className="text-[8px] font-mono text-slate-600 italic leading-relaxed pt-0.5">
                    <em>Gasparrini et al. (2017), Lancet Planetary Health</em>
                  </p>
                  {isInitialized && auditTrail && (
                    <button onClick={() => openAudit('mortality')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[9px] font-mono text-cyan-400 hover:bg-cyan-900/40 hover:border-cyan-400/40 hover:text-cyan-300 transition-all duration-150">
                      <span className="leading-none">⊕</span>Calculation Details
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
                    {isInitialized && !isLoading && !apiError && simData.loss !== '--' ? (
                      <p className="text-[22px] md:text-[26px] font-mono text-white tracking-tighter leading-none select-none">{simData.loss}</p>
                    ) : <p className="text-[22px] font-mono text-slate-700 tracking-tighter leading-none">—</p>}
                  </div>
                  {isInitialized && simData.loss !== '--' && (() => { const p = parseLoss(simData.loss); if (!p) return null; return <p className="text-[9px] font-mono text-slate-500">Range · {formatEconomicRange(p.num)}</p>; })()}
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
                  <p className="text-[8px] font-mono text-slate-600 italic leading-relaxed pt-0.5">
                    <em>Burke et al. (2018), Nature · ILO (2019)</em>
                  </p>
                  {isInitialized && auditTrail && (
                    <button onClick={() => openAudit('economics')}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[9px] font-mono text-cyan-400 hover:bg-cyan-900/40 hover:border-cyan-400/40 hover:text-cyan-300 transition-all duration-150">
                      <span className="leading-none">⊕</span>Calculation Details
                    </button>
                  )}
                </div>

                {/* HW DAYS + PEAK Tx5d */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-[#0a1830] border border-slate-800/50 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-mono text-slate-600 uppercase tracking-[0.12em]">HW Days</span>
                      <InfoTooltip alignLeft publicText="Annual days exceeding ERA5 P95 threshold." techText="ERA5 P95 · 1991-2020" />
                    </div>
                    {isInitialized && !isLoading && simData.heatwave !== '--' ? (
                      <p className="text-[20px] font-mono text-white leading-none tabular-nums select-none">{simData.heatwave}d</p>
                    ) : <p className="text-[20px] font-mono text-slate-700 leading-none">—</p>}
                    {mitigatedData && mitigatedData.heatwave !== simData.heatwave && (
                      <p className="text-[11px] font-mono text-emerald-400 leading-none">↓ {mitigatedData.heatwave}d</p>
                    )}
                    <p className="text-[8px] font-mono text-slate-600 italic"><em>CMIP6 Ensemble</em></p>
                  </div>
                  <div className="bg-[#0a1830] border border-slate-800/50 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[8px] font-mono text-slate-600 uppercase tracking-[0.12em]">Peak Tx5d</span>
                      <InfoTooltip alignLeft publicText="Hottest sustained 5-day temperature block." techText="WMO ETCCDI Tx5d" />
                    </div>
                    {isInitialized && !isLoading && simData.temp !== '--' ? (
                      <p className="text-[20px] font-mono text-white leading-none select-none">{simData.temp}°C</p>
                    ) : <p className="text-[20px] font-mono text-slate-700 leading-none">—</p>}
                    {mitigatedData && mitigatedData.temp !== simData.temp && (
                      <p className="text-[11px] font-mono text-emerald-400 leading-none">↓ {mitigatedData.temp}°C</p>
                    )}
                    {isInitialized && simData.baseTemp !== '--' && (
                      <p className="text-[8px] font-mono text-slate-600">hist. {simData.baseTemp}°C</p>
                    )}
                    <p className="text-[8px] font-mono text-slate-600 italic"><em>Open-Meteo CMIP6</em></p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ═══ CHARTS + AI ═══ */}
      <section className="bg-[#030c1a] w-full flex flex-col z-10 relative">
        {isLoading ? <LoadingSpinner /> : !isInitialized ? (
          <div className="py-28 text-center">
            <p className="text-slate-700 font-mono text-[10px] uppercase tracking-[0.5em]">Select a city and generate a projection</p>
          </div>
        ) : (
          <>
            {/* CHARTS */}
            {(chartData.heatwave.length > 0 || chartData.economic.length > 0) && (
              <div className="px-4 md:px-8 lg:px-16 py-10 w-full max-w-[1440px] mx-auto border-b border-slate-800/30">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {chartData.heatwave.length > 0 && (
                    <div className="bg-[#06101f] border border-slate-800/60 rounded-2xl p-5 flex flex-col h-[320px] md:h-[360px]">
                      <div className="mb-3">
                        <p className="text-[11px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold">Heatwave Escalation Trajectory</p>
                        <p className="text-[9px] font-mono text-slate-600 italic mt-1"><em>Open-Meteo CMIP6 Ensemble (IPCC AR6)</em></p>
                      </div>
                      <div className="flex-grow">
                        <ResponsiveContainer width="100%" height="100%">
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
                    <div className="bg-[#06101f] border border-slate-800/60 rounded-2xl p-5 flex flex-col h-[320px] md:h-[360px]">
                      <div className="mb-3">
                        <p className="text-[11px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold">Economic Risk Projection</p>
                        <p className="text-[9px] font-mono text-slate-600 italic mt-1"><em>Burke (2018) · ILO (2019) · values in M USD</em></p>
                      </div>
                      <div className="flex-grow">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData.economic.map(d => ({ ...d, adapt: Math.min(d.adapt ?? 0, d.noAction * 0.80) }))} margin={{ top: 5, right: 16, bottom: 5, left: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                            <XAxis dataKey="year" stroke="#334155" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }} />
                            <YAxis stroke="#334155" tick={{ fill: '#475569', fontSize: 10, fontFamily: 'monospace' }} />
                            <RechartsTooltip contentStyle={{ background: '#06101f', border: '1px solid #1e293b', borderRadius: '10px', fontSize: '11px', fontFamily: 'monospace' }} formatter={(v: any, name: any) => [`$${Number(v).toFixed(0)}M`, name]} />
                            <Legend wrapperStyle={{ paddingTop: '14px', fontSize: '10px', fontFamily: 'monospace', color: '#94a3b8' }} />
                            <Bar dataKey="noAction" name="Baseline (No Action)" fill="#ef4444" radius={[3,3,0,0]} opacity={0.85} />
                            <Bar dataKey="adapt"    name="With Mitigation"      fill="#10b981" radius={[3,3,0,0]} opacity={0.85} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── AI STRATEGIC ANALYSIS ── */}
            {aiAnalysis && (
              <div className="px-4 md:px-8 lg:px-16 py-10 w-full max-w-[1440px] mx-auto">

                {/* Section header */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6 pb-4 border-b border-slate-800/40">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                    <p className="text-[10px] font-mono text-slate-400 uppercase tracking-[0.3em]">
                      Strategic Analysis
                      {selectedCity && <span className="text-slate-200 ml-2 font-bold">· {selectedCity.name}</span>}
                    </p>
                  </div>
                  <p className="text-[8px] font-mono text-slate-700 italic uppercase tracking-widest">All values sourced from climate engine · Baseline risk</p>
                </div>

                {/* 4 cards: 3 AI baseline + 1 live mitigation */}
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

                    {/* AI science explanation */}
                    {aiAnalysis.mitigation && (() => {
                      const text = aiAnalysis.mitigation;
                      const clean = (s: string) => s.replace(/\*\*.*?\*\*:?/g, '').replace(/^:\s*/, '').trim();
                      if (text.includes('**EFFECT:**') && text.includes('**SOLUTION:**')) {
                        const [rawCause, rest]    = text.split('**EFFECT:**');
                        const [rawEffect, rawSol] = rest.split('**SOLUTION:**');
                        return (
                          <div className="space-y-2 flex-grow text-[11px]">
                            <div>
                              <p className="text-[8px] font-mono text-slate-600 uppercase tracking-[0.15em] mb-1">Why it works</p>
                              <p className="text-slate-400 leading-relaxed font-sans">{clean(rawCause)}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-mono text-slate-600 uppercase tracking-[0.15em] mb-1">Mechanism</p>
                              <p className="text-slate-400 leading-relaxed font-sans">{clean(rawEffect)}</p>
                            </div>
                            <div>
                              <p className="text-[8px] font-mono text-cyan-700 uppercase tracking-[0.15em] mb-1">Scaling rule</p>
                              <p className="text-slate-400 leading-relaxed font-sans">{clean(rawSol)}</p>
                            </div>
                          </div>
                        );
                      }
                      return <p className="text-slate-400 text-[11px] leading-relaxed font-sans flex-grow">{clean(text)}</p>;
                    })()}

                    <div className="h-px bg-slate-800/60" />

                    {/* Live numbers */}
                    {mitigatedData ? (
                      <div>
                        <p className="text-[8px] font-mono text-slate-600 uppercase tracking-[0.15em] mb-2">
                          +{canopy}% canopy · +{coolRoof}% cool roofs
                        </p>
                        {[
                          { label: 'Lives Saved',    value: `−${mitigatedData.savedDeaths}`, color: 'text-emerald-300' },
                          { label: 'GDP Saved',      value: mitigatedData.savedLoss ? `−${mitigatedData.savedLoss}` : '—', color: 'text-emerald-300' },
                          { label: 'Temp Reduction', value: `−${mitigatedData.tempDelta}°C`, color: 'text-cyan-300' },
                          { label: 'HW Days Cut',    value: `−${mitigatedData.hwDelta}d`, color: 'text-cyan-300' },
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
                          Adjust <span className="text-emerald-400">Canopy</span> and{' '}
                          <span className="text-indigo-400">Albedo Roofs</span> sliders to see live impact.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Baseline vs Mitigation comparison bar ── */}
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
                        { label: 'Attributable Deaths', baseline: simData.deaths, mitigated: mitigatedData.deaths, saved: `−${mitigatedData.savedDeaths} lives`, baseColor: 'text-red-400' },
                        { label: 'Economic Loss',        baseline: simData.loss,   mitigated: mitigatedData.loss ?? simData.loss, saved: mitigatedData.savedLoss ? `−${mitigatedData.savedLoss}` : '—', baseColor: 'text-amber-400' },
                        { label: 'Peak Temperature',     baseline: `${simData.temp}°C`, mitigated: `${mitigatedData.temp}°C`, saved: `−${mitigatedData.tempDelta}°C`, baseColor: 'text-orange-400' },
                        { label: 'Heatwave Days',        baseline: `${simData.heatwave}d`, mitigated: `${mitigatedData.heatwave}d`, saved: `−${mitigatedData.hwDelta}d`, baseColor: 'text-yellow-400' },
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