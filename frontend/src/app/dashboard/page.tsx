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
  <div className="relative flex items-center group cursor-help ml-2">
    <div className="w-4 h-4 rounded-full border border-slate-500 text-slate-400 flex items-center justify-center text-[10px] font-bold group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-600 transition-all z-20">i</div>
    <div className={`absolute bottom-full mb-3 p-4 bg-gray-950 border border-gray-700 text-white text-xs rounded-xl shadow-[0_20px_50px_rgba(0,0,0,1)] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-[1000] min-w-[260px] w-max pointer-events-none leading-relaxed ${alignRight ? 'right-0' : 'left-0 md:left-1/2 md:-translate-x-1/2'}`}>
      <p className="font-sans mb-3 text-slate-100">{publicText}</p>
      <p className="font-mono text-[9px] text-blue-400 border-t border-gray-800 pt-3 uppercase tracking-tighter">{techText}</p>
    </div>
  </div>
);

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
  const mapRef = useRef<MapRef>(null);
  
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

  // Data States (STRICTLY FROM API)
  const [viewState, setViewState] = useState<any>({ longitude: 0, latitude: 20, zoom: 1.8, pitch: 0, bearing: 0 });
  const [hexData, setHexData] = useState<{position: [number, number]}[]>([]);
  const [simData, setSimData] = useState({ temp: '--', deaths: '--', loss: '--', heatwave: '--', baseTemp: '--' });
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

    // Fly Map to the target City
    setViewState({
      longitude: cityObj.lng,
      latitude: cityObj.lat,
      zoom: 11,
      pitch: 50, 
      bearing: 10,
      transitionDuration: 3000,
      transitionInterpolator: new FlyToInterpolator()
    });

    try {
      // Use the DIRECT Hugging Face API URL
      const response = await fetch('https://albus2903-openplanet-engine.hf.space/api/predict', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          // Adding this ensures HF routes the request to the app, not the UI
          'x-requested-with': 'XMLHttpRequest' 
        },
        body: JSON.stringify({
          city: cityObj.name,
          lat: cityObj.lat,
          lng: cityObj.lng,
          ssp,
          year,
          canopy,
          coolRoof
        })
      });

      // This will tell us if it's a 404, 422 (Validation Error), or 500
      if (!response.ok) {
        const errorDetail = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorDetail}`);
      }

      const data = await response.json();

      // Safety check: ensure the data has the fields we need
      if (!data.metrics || !data.hexGrid) {
         throw new Error("API returned success but missing required simulation data fields.");
      }

      // STRICT DATA BINDING - No Mock Math Allowed
      setHexData(data.hexGrid);
      setSimData(data.metrics);
      setAiAnalysis(data.aiAnalysis || null);
      
      if (data.charts) {
        setChartData({
          heatwave: data.charts.heatwave || [],
          economic: data.charts.economic || []
        });
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

  // Deck.gl Hexagon Layer Mapping Red -> Orange -> Yellow -> Green
  const layers = [
    new HexagonLayer({
      id: 'risk-heatmap',
      data: hexData,
      colorRange: [
        [34, 197, 94],   // Green (Low Risk)
        [234, 179, 8],   // Yellow (Moderate Risk)
        [249, 115, 22],  // Orange (High Risk)
        [239, 68, 68],   // Red (Extreme Risk)
      ],
      elevationRange: [0, 1000],
      elevationScale: 5,
      extruded: true,
      getPosition: (d: any) => d.position,
      radius: 350,       
      opacity: 0.85,     
      coverage: 0.85,    
      upperPercentile: 99, 
      transitions: {
        elevationScale: 2000
      }
    })
  ];

  return (
    <main className="bg-[#020617] text-slate-200 font-sans overflow-x-hidden min-h-screen flex flex-col">
      
      {/* === LAYER 1: MAIN HEADER === */}
      <header className="fixed top-0 left-0 w-full flex items-center justify-between px-6 md:px-12 py-4 z-[500] bg-black/95 backdrop-blur-md border-b border-white/10 h-[72px]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 border border-white/20 flex items-center justify-center bg-white/5 rounded-sm">
             <span className="text-white font-mono text-xs font-bold tracking-tighter">OP</span>
          </div>
          <div className="flex flex-col">
            <span className="text-white font-mono tracking-[0.3em] text-[10px] uppercase">OpenPlanet</span>
            <span className="text-slate-500 font-mono tracking-[0.2em] text-[8px] uppercase">Risk Intelligence</span>
          </div>
        </div>
        <div className="hidden lg:flex gap-12 items-center">
          <Link href="/" className="text-[10px] font-mono tracking-[0.2em] text-slate-400 hover:text-white transition-colors uppercase">Home</Link>
          <Link href="/discover" className="text-[10px] font-mono tracking-[0.2em] text-slate-400 hover:text-white transition-colors uppercase">Discover</Link>
          <Link href="/about" className="text-[10px] font-mono tracking-[0.2em] text-slate-400 hover:text-white transition-colors uppercase">About Us</Link>
          <Link href="#support" className="text-[10px] font-mono tracking-[0.2em] text-slate-400 hover:text-white transition-colors uppercase">Support</Link>
        </div>
        <div className="flex items-center relative">
          <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="flex items-center gap-3 px-4 py-2 border border-white/10 rounded-full hover:border-white/30 transition-all bg-white/5">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 border border-emerald-500 flex items-center justify-center overflow-hidden">
              {session?.user?.image ? <img src={session.user.image} alt="User" /> : <span className="text-emerald-400 font-bold text-[10px]">{session?.user?.name?.charAt(0).toUpperCase() || 'U'}</span>}
            </div>
            <span className="text-[10px] font-mono text-white tracking-widest uppercase">{session?.user?.name?.split(' ')[0] || "USER"}</span>
          </button>
          {isDropdownOpen && (
            <div className="absolute top-14 right-0 w-48 bg-slate-900 border border-slate-700 rounded-lg p-2 flex flex-col shadow-2xl">
              <button onClick={() => signOut({ callbackUrl: '/' })} className="w-full text-left px-3 py-2 text-[10px] font-mono text-red-400 hover:bg-slate-800 rounded uppercase tracking-widest">Sign Out</button>
            </div>
          )}
        </div>
      </header>

      <div className="pt-[72px] flex flex-col w-full">

        {/* === LAYER 2: STICKY SUB-NAV & EXPORTS === */}
        <nav className="w-full bg-black/60 backdrop-blur-xl border-b border-white/10 px-6 md:px-12 flex flex-col lg:flex-row items-center justify-between sticky top-[72px] z-[450] py-2 shadow-2xl">
          <div className="flex gap-8 overflow-x-auto w-full lg:w-auto no-scrollbar py-3">
            {['Dashboard', 'Compare', 'Research', 'Validation', 'Methodology'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)} className={`text-[10px] font-mono tracking-[0.2em] uppercase whitespace-nowrap pb-1 transition-all ${activeTab === tab ? 'text-blue-400 border-b-2 border-blue-400' : 'text-slate-500 hover:text-white'}`}>
                {tab}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-3 py-2 shrink-0">
             <div className="flex items-center text-[9px] font-mono text-slate-500 tracking-widest uppercase mr-2">Export Intelligence</div>
             <button onClick={() => window.print()} className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-mono text-white tracking-widest transition-all">📄 PDF Report</button>
             <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-mono text-white tracking-widest transition-all">📊 CSV</button>
             <button className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-[9px] font-mono text-white tracking-widest transition-all">⚙️ JSON</button>
          </div>
        </nav>

        {/* === LAYER 3: MAIN MAP VIEWPORT === */}
        <section className="relative w-full h-[750px] bg-slate-950 overflow-hidden">
          
          <div className="absolute inset-0 z-0">
            <DeckGL
              viewState={viewState}
              onViewStateChange={({ viewState: newViewState }) => setViewState(newViewState)}
              controller={{ scrollZoom: false, dragPan: true, doubleClickZoom: true, dragRotate: true }}
              layers={isInitialized ? layers : []}
            >
              <Map mapStyle={cartoDarkStyle} attributionControl={false} reuseMaps />
              <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_20%,#020617_100%)] z-10"></div>
            </DeckGL>
          </div>

          <div className="absolute inset-0 z-20 flex justify-between items-start px-6 md:px-12 py-8 pointer-events-none">
            <div className="w-[340px] bg-black/80 backdrop-blur-md border border-white/10 p-7 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,1)] flex flex-col gap-8 pointer-events-auto overflow-visible h-fit">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <div className={`w-2.5 h-2.5 rounded-full ${isInitialized ? 'bg-emerald-500' : isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-blue-500'}`}></div>
                <h2 className="text-[11px] font-mono tracking-[0.2em] text-white uppercase">Engine Parameters</h2>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <label className="flex items-center text-[10px] font-mono text-slate-400 uppercase tracking-widest">Country</label>
                  <select value={countryCode} onChange={(e) => { setCountryCode(e.target.value); setCityObj(null); }} className="w-full bg-gray-900 border border-gray-700 px-3 py-3 text-xs font-mono text-white outline-none rounded-lg appearance-none cursor-pointer focus:border-blue-500 transition-colors">
                    <option value="" disabled>-- Select Country --</option>
                    {sortedCountries.map(([code, data]) => (
                      <option key={code} value={code}>{data.flag} {data.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center text-[10px] font-mono text-slate-400 uppercase tracking-widest">City</label>
                  <select value={cityObj?.name || ''} onChange={(e) => { const city = COUNTRY_CITIES[countryCode].cities.find(c => c.name === e.target.value); if (city) setCityObj(city); }} disabled={!countryCode} className="w-full bg-gray-900 border border-gray-700 px-3 py-3 text-xs font-mono text-white outline-none rounded-lg appearance-none cursor-pointer disabled:opacity-50 focus:border-blue-500 transition-colors">
                    <option value="" disabled>-- Select City --</option>
                    {countryCode && COUNTRY_CITIES[countryCode].cities.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="flex items-center text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                    Emission Scenario <InfoTooltip publicText="Projected global emissions pathway." techText="IPCC AR6 SSP Scenarios." />
                  </label>
                  <select value={ssp} onChange={(e) => setSsp(e.target.value)} className="w-full bg-gray-900 border border-gray-700 px-3 py-3 text-xs font-mono text-white outline-none rounded-lg appearance-none cursor-pointer focus:border-blue-500 transition-colors">
                    <option value="SSP2-4.5">SSP2-4.5 (Moderate)</option>
                    <option value="SSP5-8.5">SSP5-8.5 (Extreme)</option>
                  </select>
                </div>

                <div className="pt-4 border-t border-gray-800 space-y-6">
                  <span className="text-[10px] font-mono text-emerald-400 tracking-[0.2em] uppercase block">Adaptation Drivers</span>
                  <div className="space-y-3">
                    <label className="flex justify-between text-[9px] font-mono text-slate-400 uppercase"><span>Canopy Cover</span><span className="text-white">+{canopy}%</span></label>
                    <input type="range" min="0" max="50" value={canopy} onChange={(e) => setCanopy(Number(e.target.value))} className="w-full accent-emerald-500 cursor-pointer" />
                  </div>
                  <div className="space-y-3">
                    <label className="flex justify-between text-[9px] font-mono text-slate-400 uppercase"><span>Cool Roofs</span><span className="text-white">+{coolRoof}%</span></label>
                    <input type="range" min="0" max="100" value={coolRoof} onChange={(e) => setCoolRoof(Number(e.target.value))} className="w-full accent-emerald-500 cursor-pointer" />
                  </div>
                </div>
              </div>

              <button 
                onClick={handleInitialize} 
                disabled={!countryCode || !cityObj || isLoading} 
                className={`w-full py-4 mt-2 font-mono text-[11px] uppercase tracking-[0.3em] font-bold transition-all rounded-xl shadow-2xl ${!countryCode || !cityObj ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed' : isLoading ? 'bg-slate-700 text-blue-300 border border-blue-500/50 cursor-wait' : isInitialized ? 'bg-slate-800 text-blue-400 border border-blue-500/50 hover:bg-slate-700' : 'bg-blue-600 text-white hover:bg-blue-500 hover:scale-[1.02] shadow-[0_0_30px_rgba(59,130,246,0.3)]'}`}
              >
                {isLoading ? 'Querying Backend...' : isInitialized ? 'Update Projection' : 'Generate Climate Projection'}
              </button>
            </div>

            <div className="w-[360px] bg-black/80 backdrop-blur-md border border-white/10 p-7 rounded-2xl shadow-[0_0_50px_rgba(0,0,0,1)] flex flex-col gap-6 pointer-events-auto h-auto overflow-visible">
              <div className="flex items-center gap-3 border-b border-white/10 pb-4">
                <h2 className="text-[11px] font-mono tracking-[0.2em] text-slate-400 uppercase">Risk Intelligence</h2>
              </div>

              {apiError ? (
                <div className="bg-red-950/50 border border-red-800 p-4 rounded-xl text-red-400 text-xs font-mono leading-relaxed break-words">
                  {apiError}
                </div>
              ) : (
                <>
                  <div className="bg-gray-950 border-l-[4px] border-l-red-600 border border-gray-800 p-6 rounded-xl overflow-visible relative">
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[11px] font-mono text-red-500 uppercase tracking-[0.2em] font-bold">Attributable Deaths</span>
                      <InfoTooltip alignRight publicText="Extra fatalities specifically attributed to extreme heat exposure." techText="WHO-GBD Dose-Response Epidemiology (V8)." />
                    </div>
                    <div className="text-6xl font-light text-white tracking-tighter mb-2">
                      {val(<span>{simData.deaths} <span className="text-2xl text-red-600 font-black">↑</span></span>)}
                    </div>
                    <div className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">
                      {val("95% CI: Validated Threshold Active")}
                    </div>
                  </div>

                  <div className="space-y-4 overflow-visible">
                    <div className="bg-gray-950 p-5 rounded-xl border border-gray-800 overflow-visible relative">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Economic Loss</span>
                        <InfoTooltip alignRight publicText="Direct GDP impact due to labor hour decay." techText="Wet Bulb Temperature productivity functions." />
                      </div>
                      <div className="text-3xl font-bold text-white tracking-tight">{val(simData.loss)}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 overflow-visible">
                      <div className="bg-gray-950 p-5 rounded-xl border border-gray-800 overflow-visible relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Heatwave Days</span>
                          <InfoTooltip alignRight publicText="Days exceeding safety baselines." techText="Tmax > 95th Percentile for >3 Days." />
                        </div>
                        <div className="text-xl font-bold text-white tracking-tight">{val(`${simData.heatwave} Days`)}</div>
                      </div>
                      <div className="bg-gray-950 p-5 rounded-xl border border-gray-800 overflow-visible relative">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">Max 5D Temp</span>
                          <InfoTooltip alignRight publicText="Hottest consecutive stretch." techText="Tx5d IPCC Core Metric." />
                        </div>
                        <div className="text-xl font-bold text-white tracking-tight">{val(`${simData.temp}°C`)}</div>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
          
          {isInitialized && !apiError && (
            <div className="absolute bottom-24 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center pointer-events-none opacity-80 transition-opacity duration-1000 drop-shadow-md">
              <div className="text-[10px] font-mono text-white uppercase tracking-[0.4em] mb-2 animate-pulse">Explore</div>
              <svg className="w-5 h-5 text-white animate-bounce drop-shadow-md" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
              </svg>
            </div>
          )}
        </section>

        {/* AI STRATEGIC ANALYSIS */}
        <section className="w-full bg-[#050814] border-y border-indigo-500/20 px-6 md:px-12 py-10 shadow-2xl relative z-[100]">
          <div className="max-w-[1600px] mx-auto">
            <div className="flex items-center gap-3 mb-8 border-b border-white/5 pb-6">
              <span className="text-indigo-400 text-2xl">✨</span>
              <h3 className="text-sm font-mono text-indigo-300 tracking-[0.4em] uppercase font-black">AI Strategic Analysis: {cityObj?.name || '[AWAITING DATA]'}</h3>
            </div>
            
            {!isInitialized ? (
              <div className="text-slate-500 font-mono text-xs tracking-widest uppercase">Awaiting backend synthesis...</div>
            ) : aiAnalysis ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 text-[15px] text-slate-400 font-light leading-relaxed">
                <div className="space-y-4">
                  <strong className="text-white font-mono text-[11px] uppercase tracking-[0.3em] block text-indigo-400">1. Mortality Outlook</strong>
                  <span>{aiAnalysis.mortality}</span>
                </div>
                <div className="space-y-4">
                  <strong className="text-white font-mono text-[11px] uppercase tracking-[0.3em] block text-indigo-400">2. Economic Exposure</strong>
                  <span>{aiAnalysis.economic}</span>
                </div>
                <div className="space-y-4">
                  <strong className="text-white font-mono text-[11px] uppercase tracking-[0.3em] block text-indigo-400">3. Infrastructure Risk</strong>
                  <span>{aiAnalysis.infrastructure}</span>
                </div>
                <div className="space-y-4">
                  <strong className="text-white font-mono text-[11px] uppercase tracking-[0.3em] block text-indigo-400">4. Health Mitigation</strong>
                  <span>{aiAnalysis.mitigation}</span>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 font-mono text-xs tracking-widest uppercase">No AI Analysis generated by backend for this region.</div>
            )}
          </div>
        </section>

        {/* GAP INDEX & CHARTS */}
        <section className="bg-[#0a0f1d] p-6 md:p-12 w-full mx-auto flex flex-col gap-10 flex-grow z-10 relative">
          <div className="max-w-[1600px] mx-auto w-full flex flex-col gap-10">
            
            {activeTab === 'Dashboard' && (
              <>
                <div className="w-full bg-white/5 border border-white/10 p-10 rounded-2xl shadow-xl">
                  <h3 className="text-sm font-bold text-white uppercase tracking-[0.3em] mb-10">The Gap Index: Health Thresholds</h3>
                  <div className="w-full flex flex-col gap-3 relative">
                    <div className="flex justify-between text-[11px] font-mono uppercase tracking-[0.2em] mb-4">
                      <span className="text-emerald-500 font-black">Safe Limit (21.5°C)</span>
                      <span className="text-slate-500">Historical Baseline ({isInitialized ? simData.baseTemp : '--'}°C)</span>
                      <span className="text-red-500 font-black">Projected ({val(simData.temp)})</span>
                    </div>
                    <div className="h-8 w-full bg-slate-900 rounded-full overflow-hidden flex relative border border-slate-700 p-1">
                      <div className="h-full bg-emerald-500 w-[30%] rounded-l-full"></div>
                      <div className="h-full bg-slate-600 w-[30%] border-l-4 border-[#020617]"></div>
                      {isInitialized && <div className="h-full bg-red-600 w-[40%] border-l-4 border-[#020617] animate-[width_2s_ease-in-out] rounded-r-full"></div>}
                    </div>
                    <p className="text-sm text-slate-400 font-light mt-6 max-w-3xl">
                      Institutional thresholds indicate <strong className="text-white">{cityObj?.name || 'the target region'}</strong> will breach safe environmental parameters for <strong className="text-red-500">{isInitialized ? `${simData.heatwave} Days` : '--'}</strong> annually by mid-century.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  {isInitialized && chartData.heatwave.length > 0 ? (
                    <>
                      <div className="bg-white/5 border border-white/10 p-8 rounded-2xl flex flex-col h-[450px] shadow-lg">
                        <h3 className="text-[12px] font-mono font-black text-slate-300 tracking-[0.3em] uppercase mb-10">Heatwave Days Escalation</h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={chartData.heatwave} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                            <XAxis dataKey="year" stroke="#ffffff40" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis stroke="#ffffff40" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                            <Line type="monotone" dataKey="val" name="Days" stroke="#ef4444" strokeWidth={4} dot={{ r: 6, fill: '#ef4444', strokeWidth: 0 }} activeDot={{ r: 8 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>

                      <div className="bg-white/5 border border-white/10 p-8 rounded-2xl flex flex-col h-[450px] shadow-lg">
                        <h3 className="text-[12px] font-mono font-black text-slate-300 tracking-[0.3em] uppercase mb-10">Economic Exposure (Millions USD)</h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData.economic} margin={{ top: 10, right: 30, bottom: 10, left: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff0a" vertical={false} />
                            <XAxis dataKey="year" stroke="#ffffff40" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <YAxis stroke="#ffffff40" tick={{ fill: '#94a3b8', fontSize: 11 }} />
                            <RechartsTooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                            <Legend wrapperStyle={{ paddingTop: '20px', fontSize: '11px' }} />
                            <Bar dataKey="noAction" name="No Adaptation" fill="#ef4444" radius={[6, 6, 0, 0]} />
                            <Bar dataKey="adapt" name="With Mitigation" fill="#10b981" radius={[6, 6, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2 h-72 border-2 border-dashed border-white/5 flex items-center justify-center text-slate-600 font-mono text-xs uppercase tracking-[0.5em] rounded-2xl bg-black/10">
                      System Awaiting Graph Data from API
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab !== 'Dashboard' && (
              <div className="w-full h-96 border-2 border-dashed border-white/5 flex flex-col items-center justify-center text-slate-600 rounded-2xl bg-black/10">
                <span className="font-mono text-xs uppercase tracking-[0.4em] mb-4">Module Locked: {activeTab}</span>
                <span className="text-xs font-light opacity-50 tracking-widest uppercase">Connecting Intelligence Pipeline...</span>
              </div>
            )}
          </div>
        </section>

      </div>

      {/* FOOTER */}
      <footer className="w-full border-t border-white/5 bg-black py-10 px-6 md:px-12 flex flex-col md:flex-row items-center justify-between relative z-40 mt-auto">
        <div className="flex items-center gap-6 mb-6 md:mb-0">
          <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">&copy; 2026 OPENPLANET. Institutional Risk Intelligence.</p>
        </div>
        <div className="flex gap-10">
          <Link href="#" className="text-[9px] font-mono text-slate-600 hover:text-white uppercase tracking-widest">Privacy Protocol</Link>
          <Link href="#" className="text-[9px] font-mono text-slate-600 hover:text-white uppercase tracking-widest">Data Governance</Link>
        </div>
      </footer>
    </main>
  );
}