'use client';

import React, { useState, useEffect } from "react";
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

// ── TYPES ──
interface Projection {
  year: number;
  source: string;
  heatwave_days: number;
  peak_tx5d_c: number;
  avg_excess_temp_c?: number;
  wbt_max_c?: number;         // Added for new metrics
  uhi_intensity_c?: number;   // Added for new metrics
  attributable_deaths: number;
  economic_decay_usd: number;
}

interface CityResult {
  query: string;
  display_name: string;
  lat: number;
  lng: number;
  elevation: number;
  threshold_c: number;
  cooling_offset_c: number;
  iso2: string;
  gdp_usd: number | null;
  population: number | null;
  projections: Projection[];
  errors: string[];
  loading: boolean;
  error: string | null;
}

interface GeoResult {
  lat: number;
  lng: number;
  display_name: string;
}

// ── FORMATTING HELPERS ──
function fmt(n: number | null | undefined, d = 1) {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtUSD(n: number | null | undefined) {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
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

// ── API FETCH LOGIC ──
async function geocodeAndFetch(
  query: string,
  ssp: string,
  canopy: number,
  albedo: number
): Promise<Omit<CityResult, "loading" | "error"> | null> {
  const geoResp = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
    { headers: { "Accept-Language": "en", "User-Agent": "ClimateRiskDashboard/1.0" } }
  );
  const geoData = await geoResp.json();
  if (!geoData.length) throw new Error("Location not found. Please be more specific.");
  const g = geoData[0];
  const lat = parseFloat(g.lat);
  const lng = parseFloat(g.lon);

  let elevation = 0;
  try {
    const elevResp = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
    const elevData = await elevResp.json();
    elevation = elevData?.elevation?.[0] ?? 0;
  } catch {}

  const riskResp = await fetch("https://albus2903-openplanet-engine.hf.space/api/climate-risk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ lat, lng, elevation, ssp, canopy_offset_pct: canopy, albedo_offset_pct: albedo, location_hint: query }),
  });
  
  if (!riskResp.ok) throw new Error(`API ${riskResp.status}`);
  const riskData = await riskResp.json();

  if (riskData.error) throw new Error(`Engine reported: ${riskData.error}`);

  return { query, display_name: g.display_name, lat, lng, elevation, ...riskData };
}

const COMPARE_YEARS = [2030, 2050, 2075, 2100];

export default function CompareModule({ baseTarget }: { baseTarget: string }) {
  // Sector 1 (Locked)
  const [city1Geo, setCity1Geo] = useState<GeoResult | null>(null);
  
  // Sector 2 (User Input)
  const [searchQuery2, setSearchQuery2] = useState("");
  const [suggestions2, setSuggestions2] = useState<any[]>([]);
  const [city2Geo, setCity2Geo] = useState<GeoResult | null>(null);

  const [ssp, setSsp] = useState("ssp245");
  const [canopy, setCanopy] = useState(0);
  const [albedo, setAlbedo] = useState(0);
  const [compareYear, setCompareYear] = useState(2050);
  
  const [results, setResults] = useState<CityResult[]>([]);
  const [running, setRunning] = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);

  // ── AI AUDITOR STATE ──
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Initialize Sector 1 Map on Load
  useEffect(() => {
    fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(baseTarget)}&format=json&limit=1`)
      .then(res => res.json())
      .then(data => {
        if (data && data[0]) {
          setCity1Geo({ display_name: baseTarget, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
        }
      });
  }, [baseTarget]);

  // Sector 2 Suggestion Engine
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchQuery2.length > 2) {
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery2)}&format=json&limit=5`);
          const data = await res.json();
          const mappedResults = data.map((city: any) => ({
            id: city.place_id,
            name: city.name || city.display_name.split(',')[0],
            country: city.display_name.split(',').pop()?.trim() || '',
            latitude: parseFloat(city.lat),
            longitude: parseFloat(city.lon)
          }));
          setSuggestions2(mappedResults);
        } catch (err) {
          console.error("Geocoding Error:", err);
        }
      } else {
        setSuggestions2([]);
      }
    }, 600); 

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery2]);

  const handleCompare = async () => {
    if (!city2Geo) {
      setGlobalError("Please select a valid target for Sector 2.");
      return;
    }
    setGlobalError(null);
    setRunning(true);
    setAiAnalysis(null); // Reset AI

    const queries = [baseTarget, city2Geo.display_name];
    const initialResults = queries.map((q) => ({
      query: q, display_name: q, lat: 0, lng: 0, elevation: 0,
      threshold_c: 0, cooling_offset_c: 0, iso2: "", gdp_usd: null,
      population: null, projections: [], errors: [],
      loading: true, error: null,
    }));
    
    setResults(initialResults);
    const newResults: CityResult[] = [];
    
    for (let i = 0; i < queries.length; i++) {
      try {
        const data = await geocodeAndFetch(queries[i], ssp, canopy, albedo);
        newResults.push({ ...(data as Omit<CityResult, "loading" | "error">), loading: false, error: null });
      } catch (err: any) {
        newResults.push({
          query: queries[i], display_name: queries[i], lat: 0, lng: 0, elevation: 0,
          threshold_c: 0, cooling_offset_c: 0, iso2: "", gdp_usd: null, population: null, projections: [], errors: [],
          loading: false, error: String(err.message || err).replace('Error: ', ''),
        });
      }
      
      setResults([...newResults, ...initialResults.slice(i + 1)]);

      if (i < queries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2500));
      }
    }

    setRunning(false);

    // ── FIRE EXPERT AI ANALYSIS IF BOTH SUCCEED ──
    const okRes = newResults.filter(r => !r.error);
    if (okRes.length === 2) {
      setAiLoading(true);
      try {
        const p1 = okRes[0].projections.find(p => p.year === compareYear) || okRes[0].projections[0];
        const p2 = okRes[1].projections.find(p => p.year === compareYear) || okRes[1].projections[0];

        const aiPayload = {
          city_name: `${okRes[0].query} vs ${okRes[1].query}`,
          context: "Compare",
          metrics: {
            // Yahan dono cities ka data ek sath combine kar diya taaki AI dono ko compare kar sake
            temp: `${okRes[0].query}: ${p1?.peak_tx5d_c}°C | ${okRes[1].query}: ${p2?.peak_tx5d_c}°C`,
            elevation: `${okRes[0].query}: ${okRes[0].elevation}m | ${okRes[1].query}: ${okRes[1].elevation}m`,
            heatwave: `${okRes[0].query}: ${p1?.heatwave_days} days | ${okRes[1].query}: ${p2?.heatwave_days} days`,
            loss: `${okRes[0].query}: $${p1?.economic_decay_usd} | ${okRes[1].query}: $${p2?.economic_decay_usd}`,
            lat: `${okRes[0].query}: ${okRes[0].lat} | ${okRes[1].query}: ${okRes[1].lat}`,
            lng: `${okRes[0].query}: ${okRes[0].lng} | ${okRes[1].query}: ${okRes[1].lng}`
          }
        };

        const aiResp = await fetch("https://albus2903-openplanet-engine.hf.space/api/research-analysis", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(aiPayload)
        });
        
        const aiData = await aiResp.json();
        setAiAnalysis(aiData.reasoning);
      } catch (err) {
        setAiAnalysis("AI Auditor offline. Manual interpretation required.");
      } finally {
        setAiLoading(false);
      }
    }
  };

  const METRICS = [
    { key: "heatwave_days",       label: "Heatwave Days",       unit: "d/yr",  fmt: (v: number) => fmt(v, 0) },
    { key: "peak_tx5d_c",         label: "Peak Tx5d",           unit: "°C",    fmt: (v: number) => fmt(v) + "°C" },
    // ── NAYE METRICS JO BACKEND BHEJ RAHA HAI ──
    { key: "wbt_max_c",           label: "Max Wet-Bulb",        unit: "°C",    fmt: (v: number) => fmt(v) + "°C" },
    { key: "uhi_intensity_c",     label: "UHI Intensity",       unit: "°C",    fmt: (v: number) => "+" + fmt(v) + "°C" },
    // ─────────────────────────────────────────────
    { key: "attributable_deaths", label: "Attributable Deaths", unit: "est/yr",fmt: (v: number) => fmt(v, 0) },
    { key: "economic_decay_usd",  label: "Economic Decay",      unit: "USD",   fmt: (v: number) => fmtUSD(v) },
  ];

  const okResults = results.filter((r) => !r.loading && !r.error && r.projections?.length > 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
      
      {/* ── TACTICAL INPUT CONSOLE ── */}
      <div className="bg-black/40 backdrop-blur-xl border border-white/5 p-8 rounded-xl shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-blue-500/10 blur-[100px] pointer-events-none"></div>
        
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xs font-mono font-bold text-white uppercase tracking-[0.4em]">
            Dual-Sector Comparative Analysis
          </h2>
        </div>

        {/* ── MASSIVE DUAL MAP LAYOUT (REDESIGNED) ── */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          
          {/* SECTOR 1 (LOCKED MAP) */}
          <div className="relative rounded-xl border border-indigo-500/50 overflow-hidden h-[160px] flex flex-col justify-center p-6 bg-[#020617]">
            {city1Geo && (
              <div className="absolute inset-0 z-0 opacity-70 pointer-events-none">
                <Map longitude={city1Geo.lng} latitude={city1Geo.lat} zoom={9} mapStyle={cartoDarkStyle} interactive={false} attributionControl={false} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/80 to-transparent z-10" />
            <div className="relative z-20 w-full">
              <span className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest block mb-1 font-bold drop-shadow-md">Sector 1 (Locked)</span>
              <h3 className="text-xl sm:text-2xl font-mono text-white tracking-wider uppercase truncate w-full drop-shadow-md" title={baseTarget}>{baseTarget}</h3>
              {city1Geo && <span className="text-[9px] font-mono text-slate-400 tracking-widest block mt-1 drop-shadow-md">{city1Geo.lat.toFixed(4)}N / {city1Geo.lng.toFixed(4)}E</span>}
            </div>
          </div>

          {/* SECTOR 2 (SEARCH MAP) */}
          <div className={`relative rounded-xl border overflow-visible h-[160px] flex flex-col justify-center p-6 bg-[#020617] transition-colors ${city2Geo ? 'border-emerald-500/50' : 'border-white/10'}`}>
            {city2Geo && (
              <div className="absolute inset-0 z-0 opacity-70 pointer-events-none overflow-hidden rounded-xl">
                <Map longitude={city2Geo.lng} latitude={city2Geo.lat} zoom={9} mapStyle={cartoDarkStyle} interactive={false} attributionControl={false} />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/80 to-black/20 z-10 rounded-xl" />
            <div className="relative z-20 w-full overflow-visible">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-3 font-bold drop-shadow-md">Sector 2 (Target Acquisition)</span>
              <div className="relative w-full overflow-visible">
                <input
                  type="text"
                  value={searchQuery2}
                  onChange={(e) => {
                    setSearchQuery2(e.target.value);
                    if (city2Geo) setCity2Geo(null);
                  }}
                  placeholder="SEARCH SECONDARY TARGET..."
                  className="w-full bg-[#0a0f1d]/90 backdrop-blur-md border border-slate-700 p-3 text-xs font-mono text-white placeholder-slate-500 outline-none rounded-sm focus:border-indigo-500 transition-colors uppercase tracking-widest shadow-xl"
                />
                {suggestions2.length > 0 && !city2Geo && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-[#050814] border border-slate-700 rounded-sm shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[9999] max-h-48 overflow-y-auto custom-scrollbar">
                    {suggestions2.map((city, idx) => (
                      <div
                        key={`${city.id}-${idx}`}
                        onClick={() => {
                          const fullName = `${city.name}, ${city.country}`;
                          setSearchQuery2(fullName);
                          setCity2Geo({ display_name: fullName, lat: city.latitude, lng: city.longitude });
                          setSuggestions2([]);
                        }}
                        className="px-4 py-3 text-[10px] font-mono text-slate-300 hover:bg-indigo-600 hover:text-white cursor-pointer transition-colors border-b border-slate-800 last:border-0 uppercase tracking-widest"
                      >
                        {city.name}, <span className="opacity-50">{city.country}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Configuration HUD */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6 bg-white/[0.02] border border-white/5 rounded-lg mb-8">
          <div>
            <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Model Scenario</label>
            <select value={ssp} onChange={(e) => setSsp(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs font-mono text-indigo-400 outline-none focus:border-indigo-500">
              <option value="ssp245">SSP2-4.5 (MODERATE)</option>
              <option value="ssp585">SSP5-8.5 (HIGH RISK)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-3">Temporal Focus</label>
            <select value={compareYear} onChange={(e) => setCompareYear(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs font-mono text-white outline-none">
              {COMPARE_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><label className="text-[10px] font-mono text-slate-500 uppercase">Canopy</label><span className="text-[10px] font-mono text-emerald-400">{canopy}%</span></div>
            <input type="range" min={0} max={100} value={canopy} onChange={(e) => setCanopy(Number(e.target.value))} className="w-full accent-emerald-500 bg-white/10 h-1 rounded-full appearance-none cursor-pointer" />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><label className="text-[10px] font-mono text-slate-500 uppercase">Albedo</label><span className="text-[10px] font-mono text-sky-400">{albedo}%</span></div>
            <input type="range" min={0} max={100} value={albedo} onChange={(e) => setAlbedo(Number(e.target.value))} className="w-full accent-sky-500 bg-white/10 h-1 rounded-full appearance-none cursor-pointer" />
          </div>
        </div>

        <button
          onClick={handleCompare}
          disabled={running || !city2Geo}
          className="w-full md:w-auto px-12 py-3 bg-white text-black font-mono text-xs font-bold uppercase tracking-[0.2em] rounded hover:bg-slate-200 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(255,255,255,0.1)]"
        >
          {running ? "PROCESSING SIMULATION..." : "RUN COMPARISON"}
        </button>

        {globalError && (
          <p className="mt-4 text-[10px] font-mono text-red-500 bg-red-950/30 border border-red-900/50 rounded-sm px-4 py-2 uppercase tracking-widest">
            {globalError}
          </p>
        )}
      </div>

      {/* ── Loading Skeletons ── */}
      {results.some((r) => r.loading) && (
        <div className="grid gap-4 grid-cols-2">
          {results.map((r, i) => (
            <div key={i} className={`bg-black/40 border ${r.loading ? 'border-indigo-500/50' : 'border-white/5'} rounded-xl p-6 h-32 flex flex-col justify-center items-center gap-3`}>
               {r.loading ? (
                 <div className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-ping"></div>
                   <span className="text-[9px] font-mono text-indigo-400 uppercase tracking-widest">Acquiring Sector {i+1} Data...</span>
                 </div>
               ) : (
                 <span className="text-[9px] font-mono text-emerald-500 uppercase tracking-widest">Data Acquired</span>
               )}
            </div>
          ))}
        </div>
      )}

      {/* ── TELEMETRY COMPARISON TABLE ── */}
      {okResults.length === 2 && !running && (
        <div className="bg-black/40 backdrop-blur-xl border border-white/5 rounded-xl shadow-2xl overflow-hidden">
          <div className="px-8 py-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
            <h3 className="text-[10px] font-mono text-white uppercase tracking-[0.4em]">
              Side-by-side Telemetry — {compareYear} · {ssp.toUpperCase()}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-white/[0.03] border-b border-white/5">
                  <th className="px-8 py-5 text-[10px] font-mono text-slate-500 uppercase tracking-widest">Parameter</th>
                  {okResults.map((r) => (
                    <th key={r.query} className="px-8 py-5 text-center">
                      <span className="font-mono text-xs font-bold text-white block uppercase tracking-widest">{r.query}</span>
                      <span className="text-[9px] font-mono text-slate-600 block mt-1">
                        {r.lat.toFixed(2)}N / {r.lng.toFixed(2)}E · {r.elevation.toFixed(0)}m
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {METRICS.map((m) => {
                  const vals = okResults.map((r) => {
                    const p = r.projections?.find((pr) => pr.year === compareYear);
                    return p ? (p as any)[m.key as keyof Projection] as number : null;
                  });
                  const maxVal = Math.max(...vals.filter((v): v is number => v !== null));

                  return (
                    <tr key={m.key} className="hover:bg-white/[0.02] transition-colors">
                      <td className="px-8 py-5">
                        <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">{m.label}</div>
                        <div className="text-[9px] font-mono text-slate-600 mt-1 uppercase">{m.unit}</div>
                      </td>
                      {okResults.map((r, i) => {
                        const val = vals[i];
                        const isMax = val != null && val === maxVal && maxVal > 0;
                        return (
                          <td key={r.query} className="px-8 py-5 text-center">
                            <span className={`font-mono text-sm ${isMax ? "text-indigo-400 drop-shadow-[0_0_8px_rgba(129,140,248,0.5)]" : "text-white"}`}>
                              {val != null ? m.fmt(val) : "—"}
                            </span>
                            {isMax && <span className="ml-2 text-[9px] text-indigo-500/50 uppercase font-mono">Max.Exposure</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ── STRATEGIC COMPARISON AI BOX ── */}
          <div className="border-t border-white/5 bg-[#050814] p-8">
            <h4 className="text-[10px] font-mono text-indigo-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></span> 
              Scientific Audit & Strategic Comparison
            </h4>
            
            {aiLoading ? (
              <div className="flex flex-col gap-3 py-4">
                 <div className="h-2 w-full bg-slate-800 rounded animate-pulse"></div>
                 <div className="h-2 w-3/4 bg-slate-800 rounded animate-pulse"></div>
                 <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mt-2">AI Processing Geological Context...</span>
              </div>
            ) : aiAnalysis ? (
              <p className="text-xs font-mono text-slate-300 leading-loose">
                {aiAnalysis.replace(/\*/g, '')}
              </p>
            ) : null}
          </div>
          
        </div>
      )}

      {/* ── Error Handling HUD ── */}
      {results.filter((r) => r.error).map((r) => (
        <div key={r.query} className="bg-red-500/10 border border-red-500/20 rounded-xl px-6 py-4 mt-6 flex gap-4 items-center">
          <span className="text-red-500 font-mono text-xs">ERR:</span>
          <span className="text-red-400 font-mono text-[10px] uppercase tracking-widest">{r.query}: {r.error}</span>
        </div>
      ))}
    </div>
  );
}