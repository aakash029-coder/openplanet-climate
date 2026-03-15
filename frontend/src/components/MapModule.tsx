'use client';

import React, { useState, useEffect } from 'react';
import Map, { NavigationControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import DeckGL from '@deck.gl/react';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { FlyToInterpolator } from '@deck.gl/core';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';

const InfoTooltip = ({ publicText, techText, alignLeft = false }: { publicText: string, techText: string, alignLeft?: boolean }) => (
  <div className="relative flex items-center group cursor-help ml-2 overflow-visible">
    <div className="w-3 h-3 border border-slate-500 text-slate-400 flex items-center justify-center text-[8px] font-bold group-hover:bg-indigo-500 group-hover:text-white group-hover:border-indigo-500 transition-all z-50 rounded-sm">?</div>
    <div className={`absolute ${alignLeft ? 'right-full mr-3' : 'left-full ml-3'} top-1/2 -translate-y-1/2 p-4 bg-[#050814] border border-slate-700 text-white text-xs shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[9999] min-w-[240px] w-max pointer-events-none leading-relaxed`}>
      <p className="font-sans mb-3 text-slate-300">{publicText}</p>
      <p className="font-mono text-[9px] text-indigo-400 border-t border-slate-800 pt-3 uppercase tracking-widest">{techText}</p>
    </div>
  </div>
);

const LoadingSpinner = () => (
  <div className="flex flex-col items-center justify-center w-full py-24 bg-[#020617] border-y border-slate-800/50">
    <div className="w-10 h-10 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-6"></div>
    <span className="font-mono text-[10px] text-indigo-400 tracking-[0.5em] uppercase animate-pulse">Computing Spatial Risk Array...</span>
  </div>
);

const MapLegend = () => (
  <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/90 border border-slate-800 px-6 py-3 rounded-md backdrop-blur-md z-50 flex items-center gap-6 shadow-2xl pointer-events-none">
    <div className="flex flex-col border-r border-slate-800 pr-6">
      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-1">Height Density</span>
      <span className="text-[10px] font-mono text-slate-300 tracking-widest">Population Exp.</span>
    </div>
    <div className="flex items-center gap-4">
      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mr-2">Risk Index</span>
      <div className="flex items-center gap-2"><div className="w-2 h-2 bg-emerald-500"></div><span className="text-[9px] font-mono text-slate-300">SAFE</span></div>
      <div className="flex items-center gap-2"><div className="w-2 h-2 bg-yellow-400"></div><span className="text-[9px] font-mono text-slate-300">MODERATE</span></div>
      <div className="flex items-center gap-2"><div className="w-2 h-2 bg-orange-500"></div><span className="text-[9px] font-mono text-slate-300">HIGH</span></div>
      <div className="flex items-center gap-2"><div className="w-2 h-2 bg-red-600"></div><span className="text-[9px] font-mono text-red-400">CRITICAL</span></div>
    </div>
  </div>
);

const formatAiText = (text: string, title: string) => {
  if (!text) return null;
  if (text.includes('**EFFECT:**') && text.includes('**SOLUTION:**')) {
    const parts = text.split('**EFFECT:**');
    const rawCause = parts[0];
    const effectAndSolution = parts[1].split('**SOLUTION:**');
    const cause = rawCause.replace(/\*\*.*?\*\*:?/g, '').replace(/^:\s*/, '').trim();
    const effect = effectAndSolution[0].replace(/\*\*.*?\*\*:?/g, '').replace(/^:\s*/, '').trim();
    const solution = effectAndSolution[1].replace(/\*\*.*?\*\*:?/g, '').replace(/^:\s*/, '').trim();
    return (
      <div className="bg-[#050814] border border-slate-800 p-5 rounded-md h-full flex flex-col gap-4 shadow-inner">
        <div className="border-b border-slate-800/80 pb-3">
          <strong className="text-slate-200 font-mono text-[11px] tracking-[0.2em] uppercase">{title}</strong>
        </div>
        <div className="space-y-4 flex-grow">
          <div>
            <span className="font-mono text-[9px] text-red-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-1.5"><div className="w-1 h-1 bg-red-500"></div> Cause</span>
            <p className="text-slate-400 text-[11px] leading-relaxed font-sans">{cause}</p>
          </div>
          <div>
            <span className="font-mono text-[9px] text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-1.5"><div className="w-1 h-1 bg-orange-400"></div> Effect</span>
            <p className="text-slate-400 text-[11px] leading-relaxed font-sans">{effect}</p>
          </div>
          <div>
            <span className="font-mono text-[9px] text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-1.5"><div className="w-1 h-1 bg-emerald-400"></div> Solution</span>
            <p className="text-slate-400 text-[11px] leading-relaxed font-sans">{solution}</p>
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-[#050814] border border-slate-800 p-5 rounded-md h-full flex flex-col gap-4 shadow-inner">
      <div className="border-b border-slate-800/80 pb-3">
        <strong className="text-slate-200 font-mono text-[11px] tracking-[0.2em] uppercase">{title}</strong>
      </div>
      <p className="text-slate-400 text-[11px] leading-relaxed font-sans">{text.replace(/\*\*.*?\*\*:?/g, '').trim()}</p>
    </div>
  );
};

const cartoDarkStyle = {
  version: 8 as const,
  sources: {
    'carto-dark': {
      type: 'raster' as const,
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
    },
  },
  layers: [{ id: 'carto-dark-layer', type: 'raster' as const, source: 'carto-dark', paint: { 'raster-opacity': 1 } }],
};

const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

export default function MapModule({ onNavigateToCompare, onTargetLocked }: { onNavigateToCompare?: () => void; onTargetLocked?: (city: string) => void }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedCity, setSelectedCity] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [ssp, setSsp] = useState('SSP2-4.5');
  const [year, setYear] = useState('2050');
  const [canopy, setCanopy] = useState(5);
  const [coolRoof, setCoolRoof] = useState(15);
  const [viewState, setViewState] = useState<any>({ longitude: 0, latitude: 20, zoom: 1.8, pitch: 0, bearing: 0 });
  const [hexData, setHexData] = useState<{ position: [number, number] }[]>([]);
  const [simData, setSimData] = useState({ temp: '--', deaths: '--', ci: null as string | null, loss: '--', heatwave: '--', baseTemp: '--' });
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [chartData, setChartData] = useState<{ heatwave: any[]; economic: any[] }>({ heatwave: [], economic: [] });

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.length > 2 && !selectedCity) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5`);
          if (!res.ok) return;
          const data = await res.json();
          setSuggestions(data.map((c: any) => ({
            id: c.place_id,
            name: c.name || c.display_name.split(',')[0],
            admin1: '',
            country: c.display_name.split(',').pop()?.trim() || '',
            latitude: parseFloat(c.lat),
            longitude: parseFloat(c.lon),
          })));
        } catch {}
      } else {
        setSuggestions([]);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery, selectedCity]);

  useEffect(() => {
    setIsInitialized(false);
    setHexData([]);
    setApiError(null);
  }, [selectedCity?.name, ssp, year, canopy, coolRoof]);

  const handleInitialize = async () => {
    if (!selectedCity) return;
    setIsLoading(true);
    setApiError(null);

    setViewState((prev: any) => ({
      ...prev,
      longitude: selectedCity.lng,
      latitude: selectedCity.lat,
      zoom: 11,
      pitch: 50,
      bearing: 10,
      transitionDuration: 3000,
      transitionInterpolator: new FlyToInterpolator(),
    }));

    try {
      // ✅ Via our proxy — Cloudflare bypass
      const response = await fetch('/api/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/api/predict',
          payload: { city: selectedCity.name, lat: selectedCity.lat, lng: selectedCity.lng, ssp, year, canopy, coolRoof },
        }),
      });

      if (!response.ok) {
        const errorDetail = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorDetail}`);
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);
      if (!data.metrics || !data.hexGrid) throw new Error('API returned success but missing required simulation data fields.');

      if (onTargetLocked) onTargetLocked(selectedCity.name);

      setHexData(data.hexGrid);
      setSimData({
        temp: data.metrics?.temp ?? '--',
        deaths: data.metrics?.deaths ?? '--',
        ci: data.metrics?.ci ?? null,
        loss: data.metrics?.loss ?? '--',
        heatwave: data.metrics?.heatwave ?? '--',
        baseTemp: data.metrics?.baseTemp ?? '--',
      });
      setAiAnalysis(data.aiAnalysis || null);
      if (data.charts) setChartData({ heatwave: data.charts.heatwave || [], economic: data.charts.economic || [] });
      setIsInitialized(true);
    } catch (err: any) {
      setApiError(`Engine Error: ${err.message}`);
      setIsInitialized(false);
    } finally {
      setIsLoading(false);
    }
  };

  const val = (actual: React.ReactNode) =>
    isInitialized && !isLoading && !apiError ? actual : <span className="text-slate-600 font-mono tracking-tighter">--</span>;

  const layers = [
    new HexagonLayer({
      id: 'risk-heatmap',
      data: hexData,
      colorRange: [[34, 197, 94], [234, 179, 8], [249, 115, 22], [239, 68, 68]],
      elevationRange: [0, 1000],
      elevationScale: 5,
      extruded: true,
      getPosition: (d: any) => d.position,
      radius: 350,
      opacity: 0.85,
      coverage: 0.85,
      upperPercentile: 99,
      transitions: { elevationScale: 2000 },
    }),
  ];

  return (
    <div className="w-full flex flex-col relative z-0">
      <section className="relative w-full h-[750px] bg-[#020617] overflow-hidden border-b border-slate-800">
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
              <NavigationControl
                position="bottom-right"
                showCompass={false}
                style={{ bottom: '110px', right: '16px', background: 'rgba(5,8,20,0.92)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: '6px', boxShadow: '0 0 20px rgba(99,102,241,0.15)' }}
              />
            </Map>
            <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_20%,#020617_100%)] z-10" />
          </DeckGL>
        </div>

        {isInitialized && !isLoading && !apiError && <MapLegend />}
        {isInitialized && !isLoading && !apiError && (
          <div className="absolute bottom-[90px] left-1/2 -translate-x-1/2 z-40 flex flex-col items-center animate-bounce pointer-events-none">
            <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-[0.2em] mb-1 font-bold">Scroll to Explore</span>
            <div className="w-3 h-3 border-b-2 border-r-2 border-indigo-400 rotate-45" />
          </div>
        )}

        <div className="absolute inset-0 z-20 flex justify-between items-start px-6 md:px-12 py-8 pointer-events-none">
          {/* LEFT PANEL */}
          <div className="w-[340px] bg-[#050814]/90 backdrop-blur-md border border-slate-800 p-6 rounded-md shadow-2xl flex flex-col gap-6 pointer-events-auto overflow-visible h-fit">
            <div className="space-y-5">
              <div className="space-y-2 relative overflow-visible">
                <label className="flex items-center text-[9px] font-mono text-slate-500 uppercase tracking-widest">Location</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Type exact city name (e.g., 'Sydney')..."
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); if (selectedCity) setSelectedCity(null); }}
                    className="w-full bg-[#0a0f1d] border border-slate-700 p-2.5 text-[11px] font-mono text-slate-200 outline-none rounded-sm focus:border-indigo-500 transition-colors"
                  />
                  {suggestions.length > 0 && !selectedCity && (
                    <div className="absolute top-full left-0 w-full mt-1 bg-[#050814] border border-slate-700 rounded-sm shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[9999] max-h-64 overflow-y-auto custom-scrollbar">
                      {suggestions.map((city, idx) => (
                        <div
                          key={`${city.id}-${idx}`}
                          onClick={() => { setSelectedCity({ name: city.name, lat: city.latitude, lng: city.longitude }); setSearchQuery(`${city.name}, ${city.admin1 ? city.admin1 + ', ' : ''}${city.country}`); setSuggestions([]); }}
                          className="px-3 py-2 text-[11px] font-mono text-slate-300 hover:bg-indigo-600 hover:text-white cursor-pointer transition-colors border-b border-slate-800 last:border-0"
                        >
                          {city.name}, <span className="opacity-50">{city.admin1 ? city.admin1 + ', ' : ''}{city.country}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2 relative overflow-visible">
                <label className="flex items-center text-[9px] font-mono text-slate-500 uppercase tracking-widest">Target Year</label>
                <select value={year} onChange={(e) => setYear(e.target.value)} className="w-full bg-[#0a0f1d] border border-slate-700 p-2.5 text-[11px] font-mono text-slate-200 outline-none rounded-sm appearance-none cursor-pointer focus:border-indigo-500 transition-colors">
                  <option value="2030">2030 (Near-term)</option>
                  <option value="2050">2050 (Mid-century)</option>
                  <option value="2070">2070 (Long-term)</option>
                  <option value="2100">2100 (End-century)</option>
                </select>
              </div>

              <div className="space-y-2 relative overflow-visible">
                <label className="flex items-center text-[9px] font-mono text-slate-500 uppercase tracking-widest">
                  Emission Vector <InfoTooltip publicText="Projected global emissions pathway." techText="IPCC AR6 SSP Scenarios." />
                </label>
                <select value={ssp} onChange={(e) => setSsp(e.target.value)} className="w-full bg-[#0a0f1d] border border-slate-700 p-2.5 text-[11px] font-mono text-slate-200 outline-none rounded-sm appearance-none cursor-pointer focus:border-indigo-500 transition-colors">
                  <option value="SSP2-4.5">SSP2-4.5 (Moderate Trajectory)</option>
                  <option value="SSP5-8.5">SSP5-8.5 (Extreme Trajectory)</option>
                </select>
              </div>

              <div className="pt-2 space-y-4">
                <div className="space-y-3 bg-[#0a0f1d] p-3 border border-slate-800 rounded-sm">
                  <label className="flex justify-between items-center text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center">Canopy Offset <InfoTooltip publicText="Increases urban shading to reduce surface temperatures." techText="Applies micro-cooling coefficient." /></span>
                    <span className="text-emerald-400">+{canopy}%</span>
                  </label>
                  <input type="range" min="0" max="50" value={canopy} onChange={(e) => setCanopy(Number(e.target.value))} className="w-full accent-emerald-500 cursor-pointer" style={{ touchAction: 'manipulation' }} />
                </div>
                <div className="space-y-3 bg-[#0a0f1d] p-3 border border-slate-800 rounded-sm">
                  <label className="flex justify-between items-center text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                    <span className="flex items-center">Albedo Roofs <InfoTooltip publicText="Reflective surfaces to deflect solar radiation." techText="Increases urban albedo fraction." /></span>
                    <span className="text-indigo-400">+{coolRoof}%</span>
                  </label>
                  <input type="range" min="0" max="100" value={coolRoof} onChange={(e) => setCoolRoof(Number(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" style={{ touchAction: 'manipulation' }} />
                </div>
              </div>
            </div>

            <button
              onClick={handleInitialize}
              disabled={!selectedCity || isLoading}
              className="w-full bg-indigo-600/20 border border-indigo-500/50 text-indigo-400 py-4 text-[10px] font-mono uppercase tracking-[0.3em] rounded hover:bg-indigo-600/40 transition-colors shadow-[0_0_15px_rgba(99,102,241,0.2)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
              style={{ touchAction: 'manipulation' }}
            >
              {isLoading ? (<><span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />GENERATING...</>) : 'GENERATE CLIMATE PROJECTION'}
            </button>
          </div>

          {/* RIGHT PANEL */}
          <div className="w-[360px] bg-[#050814]/90 backdrop-blur-md border border-slate-800 p-6 rounded-md shadow-2xl flex flex-col gap-4 pointer-events-auto h-auto overflow-visible">
            <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-2">
              <h2 className="text-[10px] font-mono tracking-[0.3em] text-slate-300 uppercase">Quantified Risk Metrics</h2>
            </div>
            {apiError ? (
              <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-sm text-red-500 text-[10px] font-mono leading-relaxed">{apiError}</div>
            ) : (
              <>
                <div className="bg-[#0a0f1d] border border-slate-800 p-5 rounded-md relative shadow-inner overflow-visible">
                  <div className="flex items-center justify-between mb-2 border-b border-slate-800/50 pb-2">
                    <span className="text-[9px] font-mono text-red-500 uppercase tracking-[0.2em] font-bold flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-500 rounded-sm" /> Attributable Deaths</span>
                    <InfoTooltip alignLeft publicText="Extra fatalities specifically attributed to extreme heat exposure." techText="WHO-GBD Dose-Response Epidemiology (V8)." />
                  </div>
                  <div className="text-5xl font-mono text-white tracking-tighter mb-1 mt-3">{val(<span>{simData.deaths}</span>)}</div>
                  {isInitialized && simData.ci && (
                    <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-1 bg-black/50 inline-block px-2 py-1 rounded-sm border border-slate-800">95% CI: {simData.ci}</div>
                  )}
                </div>
                <div className="bg-[#0a0f1d] border border-slate-800 p-5 rounded-md relative shadow-inner overflow-visible">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 bg-orange-400 rounded-sm" /> Economic Decay</span>
                    <InfoTooltip alignLeft publicText="Financial capital loss projected from heat-induced productivity drops." techText="GDP Loss Fraction Model." />
                  </div>
                  <div className="text-3xl font-mono text-slate-200 tracking-tight">{val(simData.loss)}</div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#0a0f1d] border border-slate-800 p-4 rounded-md shadow-inner flex flex-col justify-between overflow-visible">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Heatwave Days</span>
                      <InfoTooltip alignLeft publicText="Count of days exceeding the localized historical extreme temperature threshold." techText="Days > ERA5 Historical p95." />
                    </div>
                    <div className="text-xl font-mono text-slate-200">{val(simData.heatwave !== '--' ? `${simData.heatwave}d` : '--')}</div>
                  </div>
                  <div className="bg-[#0a0f1d] border border-slate-800 p-4 rounded-md shadow-inner flex flex-col justify-between overflow-visible">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest">Peak Tx5d</span>
                      <InfoTooltip alignLeft publicText="The hottest sustained 5-day temperature block expected in the target year." techText="WMO ETCCDI Tx5d Index." />
                    </div>
                    <div className="text-xl font-mono text-slate-200">{val(simData.temp !== '--' ? `${simData.temp}°C` : '--')}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </section>

      <section className="bg-[#020617] w-full flex flex-col z-10 relative">
        {isLoading ? <LoadingSpinner /> : !isInitialized ? (
          <div className="py-24 text-center border-b border-slate-800/50 bg-[#050814]">
            <span className="text-slate-600 font-mono text-[10px] uppercase tracking-[0.4em]">System Offline. Awaiting configuration parameters.</span>
          </div>
        ) : (
          <>
            {(chartData.heatwave.length > 0 || chartData.economic.length > 0) && (
              <div className="px-6 md:px-12 py-12 w-full max-w-[1600px] mx-auto flex flex-col gap-10 border-b border-slate-800">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {chartData.heatwave.length > 0 && (
                    <div className="bg-[#050814] border border-slate-800 p-6 rounded-md flex flex-col h-[400px] shadow-lg">
                      <h3 className="text-[10px] font-mono text-slate-500 tracking-[0.3em] uppercase mb-8">Heatwave Escalation Trajectory</h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={chartData.heatwave} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="year" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} />
                          <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} />
                          <RechartsTooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }} />
                          <Line type="monotone" dataKey="val" name="Days" stroke="#ef4444" strokeWidth={3} dot={{ r: 4, fill: '#050814', strokeWidth: 2, stroke: '#ef4444' }} activeDot={{ r: 6 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                  {chartData.economic.length > 0 && (
                    <div className="bg-[#050814] border border-slate-800 p-6 rounded-md flex flex-col h-[400px] shadow-lg">
                      <h3 className="text-[10px] font-mono text-slate-500 tracking-[0.3em] uppercase mb-8">Economic Exposure Projection (M USD)</h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData.economic} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                          <XAxis dataKey="year" stroke="#475569" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} />
                          <YAxis stroke="#475569" tick={{ fill: '#64748b', fontSize: 10, fontFamily: 'monospace' }} />
                          <RechartsTooltip contentStyle={{ backgroundColor: '#020617', borderColor: '#1e293b', borderRadius: '4px', fontSize: '12px', fontFamily: 'monospace' }} />
                          <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '10px', fontFamily: 'monospace' }} />
                          <Bar dataKey="noAction" name="Baseline (No Action)" fill="#ef4444" radius={[2, 2, 0, 0]} />
                          <Bar dataKey="adapt" name="Adaptive Mitigation" fill="#10b981" radius={[2, 2, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              </div>
            )}
            <div className="w-full px-6 md:px-12 py-12 bg-[#0a0f1d]">
              <div className="max-w-[1600px] mx-auto">
                <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-4">
                  <div className="w-2 h-2 bg-indigo-500 rounded-sm shadow-[0_0_8px_rgba(99,102,241,0.8)]" />
                  <h3 className="text-xs font-mono text-slate-300 tracking-[0.3em] uppercase">Strategic Analysis: <span className="text-white">{selectedCity?.name}</span></h3>
                </div>
                {aiAnalysis ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {formatAiText(aiAnalysis.mortality, 'Mortality Outlook')}
                    {formatAiText(aiAnalysis.economic, 'Economic Exposure')}
                    {formatAiText(aiAnalysis.infrastructure, 'Infrastructure Risk')}
                    {formatAiText(aiAnalysis.mitigation, 'Health Mitigation')}
                  </div>
                ) : (
                  <div className="text-slate-600 font-mono text-[10px] uppercase tracking-[0.4em]">AI Analysis data not provided by backend for this query.</div>
                )}
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}