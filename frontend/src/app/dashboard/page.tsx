'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Link from 'next/link';

// MAPLIBRE & DECK.GL
import Map, { MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import DeckGL from '@deck.gl/react';
import { HexagonLayer } from '@deck.gl/aggregation-layers';
import { FlyToInterpolator } from '@deck.gl/core';

import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend } from 'recharts';

import { COUNTRY_CITIES, sortedCountries } from '@/lib/data/countries';

const InfoTooltip = ({ publicText, techText, alignRight = false }: { publicText: string, techText: string, alignRight?: boolean }) => (
  <div className="relative flex items-center group cursor-help ml-2 overflow-visible">
    <div className="w-3 h-3 border border-slate-500 text-slate-400 flex items-center justify-center text-[8px] font-bold group-hover:bg-indigo-500 group-hover:text-white group-hover:border-indigo-500 transition-all z-50 rounded-sm">?</div>
    <div className={`absolute bottom-full mb-2 p-4 bg-[#050814] border border-slate-700 text-white text-xs shadow-2xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[9999] min-w-[240px] w-max pointer-events-none leading-relaxed ${alignRight ? 'right-0' : 'left-0 md:left-1/2 md:-translate-x-1/2'}`}>
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

// STRICT AI PARSER: No fallback fake data. Parses if formatted, otherwise passes raw string.
const formatAiText = (text: string, title: string) => {
  if (!text) return null;

  if (text.includes('**CAUSE:**')) {
    const cause = text.match(/\*\*CAUSE:\*\*\s*(.*?)(?=\*\*EFFECT:\*\*|$)/)?.[1];
    const effect = text.match(/\*\*EFFECT:\*\*\s*(.*?)(?=\*\*SOLUTION:\*\*|$)/)?.[1];
    const solution = text.match(/\*\*SOLUTION:\*\*\s*(.*)/)?.[1];
    
    return (
      <div className="bg-[#050814] border border-slate-800 p-5 rounded-md h-full flex flex-col gap-4 shadow-inner">
        <div className="border-b border-slate-800/80 pb-3">
           <strong className="text-slate-200 font-mono text-[11px] tracking-[0.2em] uppercase">{title}</strong>
        </div>
        <div className="space-y-4 flex-grow">
           {cause && (
             <div>
                <span className="font-mono text-[9px] text-red-500 uppercase tracking-[0.2em] flex items-center gap-2 mb-1.5"><div className="w-1 h-1 bg-red-500"></div> Cause</span>
                <p className="text-slate-400 text-[11px] leading-relaxed font-sans">{cause}</p>
             </div>
           )}
           {effect && (
             <div>
                <span className="font-mono text-[9px] text-orange-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-1.5"><div className="w-1 h-1 bg-orange-400"></div> Effect</span>
                <p className="text-slate-400 text-[11px] leading-relaxed font-sans">{effect}</p>
             </div>
           )}
           {solution && (
             <div>
                <span className="font-mono text-[9px] text-emerald-400 uppercase tracking-[0.2em] flex items-center gap-2 mb-1.5"><div className="w-1 h-1 bg-emerald-400"></div> Solution</span>
                <p className="text-slate-400 text-[11px] leading-relaxed font-sans">{solution}</p>
             </div>
           )}
        </div>
      </div>
    );
  }

  // If backend sends a flat string instead of formatting, display it without lying
  return (
    <div className="bg-[#050814] border border-slate-800 p-5 rounded-md h-full flex flex-col gap-4 shadow-inner">
      <div className="border-b border-slate-800/80 pb-3">
         <strong className="text-slate-200 font-mono text-[11px] tracking-[0.2em] uppercase">{title}</strong>
      </div>
      <p className="text-slate-400 text-[11px] leading-relaxed font-sans whitespace-pre-wrap">{text}</p>
    </div>
  );
};

// STRICT SCORECARD: Driven entirely by API charting data.
const ResilienceScorecard = ({ chartData }: any) => {
  if (!chartData || !chartData.economic || chartData.economic.length < 2) return null;
  
  // Directly references the backend trajectory array
  const targetYearData = chartData.economic[chartData.economic.length - 1]; 
  const econBase = targetYearData.noAction || 0;
  const econAdapt = targetYearData.adapt || 0;
  const econSaved = Math.max(0, econBase - econAdapt);
  const reductionPct = econBase > 0 ? (econSaved / econBase) * 100 : 0;

  const grade = reductionPct > 50 ? 'A' : reductionPct > 35 ? 'B' : reductionPct > 15 ? 'C' : 'D';
  const color = grade === 'A' ? 'text-emerald-400 border-emerald-500' : grade === 'B' ? 'text-indigo-400 border-indigo-500' : grade === 'C' ? 'text-yellow-400 border-yellow-500' : 'text-red-500 border-red-600';
  
  return (
    <div className="w-full bg-[#0a0f1d] border border-slate-800 p-8 lg:p-12 rounded-lg mt-10 flex flex-col lg:flex-row items-start justify-between gap-12 shadow-2xl relative">
      <div className="flex flex-col z-10 max-w-2xl w-full">
        <h4 className="text-xl font-black text-white uppercase tracking-widest mb-1">Institutional Resilience Audit</h4>
        <p className="text-slate-500 font-mono text-[9px] uppercase tracking-[0.3em] mb-6 border-b border-slate-800 pb-4">Algorithm: Empirical Output Trajectory</p>
        
        <p className="text-slate-400 text-xs leading-relaxed mb-6 font-sans">
          The selected mitigation parameters yield an empirical exposure reduction of <strong className="text-white">{reductionPct.toFixed(1)}%</strong> compared to the baseline trajectory. Total capital preservation across vulnerable sectors is calculated at <strong className="text-emerald-400">${econSaved.toFixed(1)} Million USD</strong>.
        </p>

        <div className="bg-[#050814] border border-slate-800 p-5 rounded-md font-mono text-[10px] text-slate-400 w-full">
          <span className="block text-indigo-400 mb-3 uppercase tracking-widest font-bold border-b border-slate-800 pb-2">Computational Output Criteria</span>
          <ul className="space-y-3">
            <li className="flex justify-between"><span>Baseline Economic Loss (No Action)</span> <span className="text-red-400">${econBase.toFixed(1)}M</span></li>
            <li className="flex justify-between"><span>Adapted Economic Loss (Post-Mitigation)</span> <span className="text-indigo-400">${econAdapt.toFixed(1)}M</span></li>
            <li className="flex justify-between"><span>Preserved Economic Capital</span> <span className="text-emerald-400">+ ${econSaved.toFixed(1)}M</span></li>
            <li className="flex justify-between pt-2 mt-1 border-t border-slate-800 font-bold text-white text-[11px]"><span>Empirical Reduction Score</span> <span>{reductionPct.toFixed(1)}%</span></li>
          </ul>
        </div>
      </div>
      
      <div className="flex flex-col items-center gap-6 z-10 shrink-0 w-full lg:w-64">
        <div className="flex flex-col items-center bg-[#050814] p-8 rounded-md border border-slate-800 w-full">
          <span className="text-[9px] font-mono text-slate-500 uppercase tracking-[0.3em] mb-4">Adaptive Grade</span>
          <div className={`w-32 h-32 rounded-full border-[2px] flex items-center justify-center text-6xl font-black ${color} bg-[#020617] shadow-inner`}>
            {grade}
          </div>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-[8px] uppercase tracking-widest text-slate-600">
            <span className={reductionPct > 50 ? 'text-emerald-400 font-bold' : ''}>&gt;50%: A</span>
            <span className={reductionPct > 35 && reductionPct <= 50 ? 'text-indigo-400 font-bold' : ''}>&gt;35%: B</span>
            <span className={reductionPct > 15 && reductionPct <= 35 ? 'text-yellow-400 font-bold' : ''}>&gt;15%: C</span>
            <span className={reductionPct <= 15 ? 'text-red-400 font-bold' : ''}>&lt;15%: D</span>
          </div>
        </div>
      </div>
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
        'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'
      ],
      tileSize: 256,
    }
  },
  layers: [
    {
      id: 'carto-dark-layer',
      type: 'raster' as const,
      source: 'carto-dark',
      paint: { 'raster-opacity': 1 }
    }
  ]
};

export default function Dashboard() {
  const { data: session } = useSession();
  
  // UI States
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('Dashboard');
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);

  // Input States
  const [countryCode, setCountryCode] = useState('');
  const [cityObj, setCityObj] = useState<{name: string, lat: number, lng: number} | null>(null);
  const [ssp, setSsp] = useState('SSP2-4.5');
  const [year, setYear] = useState('2050');
  const [canopy, setCanopy] = useState(15);
  const [coolRoof, setCoolRoof] = useState(40);

  // Data States
  const [viewState, setViewState] = useState<any>({ longitude: 0, latitude: 20, zoom: 1.8, pitch: 0, bearing: 0 });
  const [hexData, setHexData] = useState<{position: [number, number]}[]>([]);
  // STRICT STATE BINDING
  const [simData, setSimData] = useState({ temp: '--', deaths: '--', ci: null, loss: '--', heatwave: '--', baseTemp: '--' });
  const [aiAnalysis, setAiAnalysis] = useState<any>(null);
  const [chartData, setChartData] = useState<{heatwave: any[], economic: any[]}>({ heatwave: [], economic: [] });

  useEffect(() => {
    setIsInitialized(false);
    setHexData([]); 
    setApiError(null);
  }, [countryCode, cityObj?.name, ssp, year, canopy, coolRoof]);

  const handleInitialize = async () => {
    if (!countryCode || !cityObj) return;
    
    setIsLoading(true);
    setApiError(null);

    setViewState((prev: any) => ({
      ...prev,
      longitude: cityObj.lng,
      latitude: cityObj.lat,
      zoom: 11,
      pitch: 50, 
      bearing: 10,
      transitionDuration: 3000,
      transitionInterpolator: new FlyToInterpolator()
    }));

    try {
      const response = await fetch('https://albus2903-openplanet-engine.hf.space/api/predict', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'x-requested-with': 'XMLHttpRequest' 
        },
        body: JSON.stringify({ city: cityObj.name, lat: cityObj.lat, lng: cityObj.lng, ssp, year, canopy, coolRoof })
      });

      if (!response.ok) {
        const errorDetail = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorDetail}`);
      }

      const data = await response.json();

      if (!data.metrics || !data.hexGrid) {
         throw new Error("API returned success but missing required simulation data fields.");
      }

      setHexData(data.hexGrid);
      
      // Strict parameter mapping, defaults to null/-- if missing
      setSimData({
        temp: data.metrics?.temp ?? '--',
        deaths: data.metrics?.deaths ?? '--',
        ci: data.metrics?.ci ?? null,
        loss: data.metrics?.loss ?? '--',
        heatwave: data.metrics?.heatwave ?? '--',
        baseTemp: data.metrics?.baseTemp ?? '--'
      });
      
      setAiAnalysis(data.aiAnalysis || null);
      
      if (data.charts) {
        setChartData({ heatwave: data.charts.heatwave || [], economic: data.charts.economic || [] });
      }

      setIsInitialized(true);

    } catch (err: any) {
      console.error("Simulation Engine Connectivity Failure:", err.message);
      setApiError(`Engine Error: ${err.message}`);
      setIsInitialized(false);
    } finally {
      setIsLoading(false);
    }
  };

  const val = (actual: React.ReactNode) => (isInitialized && !isLoading && !apiError) ? actual : <span className="text-slate-600 font-mono tracking-tighter">--</span>;

  const layers = [
    new HexagonLayer({
      id: 'risk-heatmap',
      data: hexData,
      colorRange: [
        [34, 197, 94],   
        [234, 179, 8],   
        [249, 115, 22],  
        [239, 68, 68],   
      ],
      elevationRange: [0, 1000],
      elevationScale: 5,
      extruded: true,
      getPosition: (d: any) => d.position,
      radius: 350,       
      opacity: 0.85,     
      coverage: 0.85,    
      upperPercentile: 99, 
      transitions: { elevationScale: 2000 }
    })
  ];

  return (
    <main className="bg-[#020617] text-slate-200 font-sans overflow-x-hidden min-h-screen flex flex-col selection:bg-indigo-500/30">
      
      {/* HEADER */}
      <header className="fixed top-0 left-0 w-full flex items-center justify-between px-6 md:px-12 py-4 z-[500] bg-black/95 backdrop-blur-md border-b border-slate-800 h-[72px]">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 border border-indigo-500/50 flex items-center justify-center bg-indigo-500/10 rounded-sm">
             <span className="text-indigo-400 font-mono text-xs font-bold tracking-tighter">OP</span>
          </div>
          <div className="flex flex-col">
            <span className="text-slate-100 font-mono tracking-[0.3em] text-[10px] uppercase">OpenPlanet</span>
            <span className="text-slate-500 font-mono tracking-[0.2em] text-[8px] uppercase">Risk Intelligence</span>
          </div>
        </div>
        <div className="hidden lg:flex gap-12 items-center">
          <Link href="/" className="text-[10px] font-mono tracking-[0.2em] text-slate-400 hover:text-white transition-colors uppercase">Home</Link>
          <Link href="/discover" className="text-[10px] font-mono tracking-[0.2em] text-slate-400 hover:text-white transition-colors uppercase">Discover</Link>
          <Link href="/about" className="text-[10px] font-mono tracking-[0.2em] text-slate-400 hover:text-white transition-colors uppercase">About Us</Link>
        </div>
        <div className="flex items-center relative">
          <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-3 px-4 py-2 border border-slate-700 rounded-sm hover:border-slate-500 transition-all bg-[#050814]">
            <span className="text-[9px] font-mono text-slate-300 tracking-widest uppercase">{session?.user?.name?.split(' ')[0] || "USER"}</span>
          </button>
          {isDropdownOpen && (
            <div className="absolute top-14 right-0 w-48 bg-[#050814] border border-slate-800 rounded-sm p-2 flex flex-col shadow-2xl">
              <button onClick={() => signOut({ callbackUrl: '/' })} className="w-full text-left px-3 py-2 text-[10px] font-mono text-red-500 hover:bg-red-500/10 rounded-sm uppercase tracking-widest transition-colors">Sign Out</button>
            </div>
          )}
        </div>
      </header>

      <div className="pt-[72px] flex flex-col w-full">

        {/* SUB-NAV */}
        <nav className="w-full bg-[#050814]/90 backdrop-blur-xl border-b border-slate-800 px-6 md:px-12 flex flex-col lg:flex-row items-center justify-between sticky top-[72px] z-[450] py-0 shadow-xl">
          <div className="flex gap-8 overflow-x-auto w-full lg:w-auto no-scrollbar py-4">
            {['Dashboard', 'Compare', 'Research', 'Validation', 'Methodology'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`text-[9px] font-mono tracking-[0.2em] uppercase whitespace-nowrap transition-all ${activeTab === tab ? 'text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.8)]' : 'text-slate-600 hover:text-slate-300'}`}>
                {tab}
              </button>
            ))}
          </div>
        </nav>

        {/* MAIN MAP */}
        <section className="relative w-full h-[750px] bg-[#020617] overflow-hidden">
          <div className="absolute inset-0 z-0">
            <DeckGL
              viewState={viewState}
              onViewStateChange={({ viewState, interactionState }) => {
                 if (interactionState.isDragging || interactionState.isPanning || interactionState.isZooming || interactionState.isRotating) {
                    setViewState(viewState);
                 }
              }}
              controller={{ scrollZoom: false, dragPan: true, doubleClickZoom: true, dragRotate: true }}
              layers={isInitialized ? layers : []}
            >
              <Map mapStyle={cartoDarkStyle} attributionControl={false} reuseMaps />
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_20%,#020617_100%)] z-10"></div>
            </DeckGL>
          </div>

          {isInitialized && !isLoading && !apiError && <MapLegend />}

          <div className="absolute inset-0 z-20 flex justify-between items-start px-6 md:px-12 py-8 pointer-events-none">
            
            {/* LEFT CONTROL PANEL */}
            <div className="w-[340px] bg-[#050814]/90 backdrop-blur-md border border-slate-800 p-6 rounded-md shadow-2xl flex flex-col gap-6 pointer-events-auto overflow-visible h-fit">

              <div className="space-y-5">
                <div className="space-y-2 relative overflow-visible">
                  <label className="flex items-center text-[9px] font-mono text-slate-500 uppercase tracking-widest">Global Region</label>
                  <select value={countryCode} onChange={(e) => { setCountryCode(e.target.value); setCityObj(null); }} className="w-full bg-[#0a0f1d] border border-slate-700 p-2.5 text-[11px] font-mono text-slate-200 outline-none rounded-sm appearance-none cursor-pointer focus:border-indigo-500 transition-colors">
                    <option value="" disabled>-- Select Country --</option>
                    {sortedCountries.map(([code, data]) => (<option key={code} value={code}>{data.flag} {data.name}</option>))}
                  </select>
                  <select value={cityObj?.name || ''} onChange={(e) => { const city = COUNTRY_CITIES[countryCode].cities.find(c => c.name === e.target.value); if (city) setCityObj(city); }} disabled={!countryCode} className="w-full bg-[#0a0f1d] border border-slate-700 p-2.5 text-[11px] font-mono text-slate-200 outline-none rounded-sm appearance-none cursor-pointer disabled:opacity-50 focus:border-indigo-500 transition-colors mt-2">
                    <option value="" disabled>-- Target City --</option>
                    {countryCode && COUNTRY_CITIES[countryCode].cities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
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
                  <div className="space-y-3 bg-[#0a0f1d] p-3 border border-slate-800 rounded-sm relative overflow-visible">
                    <label className="flex justify-between items-center text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center">Canopy Offset <InfoTooltip publicText="Increases urban shading to reduce surface temperatures." techText="Applies micro-cooling coefficient." /></span>
                      <span className="text-emerald-400">+{canopy}%</span>
                    </label>
                    <input type="range" min="0" max="50" value={canopy} onChange={(e) => setCanopy(Number(e.target.value))} className="w-full accent-emerald-500 cursor-pointer" />
                  </div>
                  <div className="space-y-3 bg-[#0a0f1d] p-3 border border-slate-800 rounded-sm relative overflow-visible">
                    <label className="flex justify-between items-center text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                      <span className="flex items-center">Albedo Roofs <InfoTooltip alignRight publicText="Reflective surfaces to deflect solar radiation." techText="Increases urban albedo fraction." /></span>
                      <span className="text-indigo-400">+{coolRoof}%</span>
                    </label>
                    <input type="range" min="0" max="100" value={coolRoof} onChange={(e) => setCoolRoof(Number(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleInitialize} 
                disabled={!countryCode || !cityObj || isLoading} 
                className={`w-full py-4 font-mono text-[10px] uppercase tracking-[0.3em] font-bold transition-all rounded-sm shadow-xl ${!countryCode || !cityObj ? 'bg-slate-900 text-slate-600 cursor-not-allowed' : isLoading ? 'bg-indigo-600/50 text-white cursor-wait' : 'bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.98]'}`}
              >
                Generate Climate Projection
              </button>
            </div>

            {/* RIGHT METRICS PANEL */}
            <div className="w-[360px] bg-[#050814]/90 backdrop-blur-md border border-slate-800 p-6 rounded-md shadow-2xl flex flex-col gap-4 pointer-events-auto h-auto overflow-visible">
              <div className="flex items-center gap-3 border-b border-slate-800 pb-3 mb-2 relative overflow-visible">
                <h2 className="text-[10px] font-mono tracking-[0.3em] text-slate-300 uppercase">Quantified Risk Metrics</h2>
              </div>

              {apiError ? (
                <div className="bg-red-950/30 border border-red-900/50 p-4 rounded-sm text-red-500 text-[10px] font-mono leading-relaxed">{apiError}</div>
              ) : (
                <>
                  <div className="bg-[#0a0f1d] border border-slate-800 p-5 rounded-md relative shadow-inner overflow-visible">
                    <div className="flex items-center justify-between mb-2 border-b border-slate-800/50 pb-2 relative overflow-visible">
                      <span className="text-[9px] font-mono text-red-500 uppercase tracking-[0.2em] font-bold flex items-center gap-2"><div className="w-1.5 h-1.5 bg-red-500 rounded-sm"></div> Attributable Deaths</span>
                      <InfoTooltip alignRight publicText="Extra fatalities specifically attributed to extreme heat exposure." techText="WHO-GBD Dose-Response Epidemiology (V8)." />
                    </div>
                    <div className="text-5xl font-mono text-white tracking-tighter mb-1 mt-3">
                      {val(<span>{simData.deaths}</span>)}
                    </div>
                    {/* Only renders confidence interval if it is actually sent by the backend */}
                    {isInitialized && simData.ci && (
                      <div className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-1 bg-black/50 inline-block px-2 py-1 rounded-sm border border-slate-800">
                        95% CI: {simData.ci}
                      </div>
                    )}
                  </div>

                  <div className="bg-[#0a0f1d] border border-slate-800 p-5 rounded-md relative shadow-inner">
                    <div className="flex items-center justify-between mb-2 relative overflow-visible">
                      <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest flex items-center gap-2"><div className="w-1.5 h-1.5 bg-orange-400 rounded-sm"></div> Economic Decay</span>
                    </div>
                    <div className="text-3xl font-mono text-slate-200 tracking-tight">{val(simData.loss)}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-[#0a0f1d] border border-slate-800 p-4 rounded-md relative shadow-inner flex flex-col justify-between">
                      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-2 block">Heatwave Days</span>
                      <div className="text-xl font-mono text-slate-200">{val(simData.heatwave !== '--' ? `${simData.heatwave}d` : '--')}</div>
                    </div>
                    <div className="bg-[#0a0f1d] border border-slate-800 p-4 rounded-md relative shadow-inner flex flex-col justify-between">
                      <span className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-2 block">Peak Tx5d</span>
                      <div className="text-xl font-mono text-slate-200">{val(simData.temp !== '--' ? `${simData.temp}°C` : '--')}</div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* DATA PANELS */}
        <section className="bg-[#020617] w-full flex flex-col z-10 relative">
          {isLoading ? (
            <LoadingSpinner />
          ) : !isInitialized ? (
            <div className="py-24 text-center border-y border-slate-800/50 bg-[#050814]">
               <span className="text-slate-600 font-mono text-[10px] uppercase tracking-[0.4em]">System Offline. Awaiting configuration parameters.</span>
            </div>
          ) : (
            <>
              {/* AI STRATEGIC ANALYSIS GRIDS */}
              <div className="w-full border-y border-slate-800 px-6 md:px-12 py-12 bg-[#0a0f1d]">
                <div className="max-w-[1600px] mx-auto">
                  <div className="flex items-center gap-3 mb-8 border-b border-slate-800 pb-4">
                    <div className="w-2 h-2 bg-indigo-500 rounded-sm shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>
                    <h3 className="text-xs font-mono text-slate-300 tracking-[0.3em] uppercase">Strategic Analysis: <span className="text-white">{cityObj?.name}</span></h3>
                  </div>
                  
                  {aiAnalysis ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      {formatAiText(aiAnalysis.mortality, "Mortality Outlook")}
                      {formatAiText(aiAnalysis.economic, "Economic Exposure")}
                      {formatAiText(aiAnalysis.infrastructure, "Infrastructure Risk")}
                      {formatAiText(aiAnalysis.mitigation, "Health Mitigation")}
                    </div>
                  ) : (
                    <div className="text-slate-600 font-mono text-[10px] uppercase tracking-[0.4em]">AI Analysis data not provided by backend for this query.</div>
                  )}
                </div>
              </div>

              {/* GRAPHS AND SCORECARD */}
              {chartData.heatwave.length > 0 || chartData.economic.length > 0 ? (
                <div className="px-6 md:px-12 py-12 w-full max-w-[1600px] mx-auto flex flex-col gap-10">
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

                  {/* INSTITUTIONAL SCORECARD */}
                  <ResilienceScorecard chartData={chartData} />

                </div>
              ) : null}
            </>
          )}
        </section>

      </div>

      {/* FOOTER */}
      <footer className="w-full border-t border-slate-800 bg-[#020617] py-8 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between relative z-40 mt-auto">
        <p className="text-[9px] font-mono text-slate-600 uppercase tracking-[0.2em]">&copy; 2026 OPENPLANET. All rights reserved.</p>
        <div className="flex gap-8 mt-4 md:mt-0">
          <Link href="#" className="text-[9px] font-mono text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors">Privacy Policies</Link>
          <Link href="#" className="text-[9px] font-mono text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors">Terms of Service</Link>
          <Link href="#" className="text-[9px] font-mono text-slate-600 hover:text-slate-400 uppercase tracking-widest transition-colors">Support</Link>
        </div>
      </footer>
    </main>
  );
}