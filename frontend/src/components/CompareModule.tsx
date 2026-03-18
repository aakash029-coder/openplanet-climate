'use client';

import React, { useState, useEffect, useRef } from "react";

interface Projection {
  year: number; source: string; heatwave_days: number; peak_tx5d_c: number;
  avg_excess_temp_c?: number; wbt_max_c?: number; uhi_intensity_c?: number;
  attributable_deaths: number; economic_decay_usd: number;
}
interface CityResult {
  query: string; display_name: string; lat: number; lng: number; elevation: number;
  threshold_c: number; cooling_offset_c: number; iso2: string; gdp_usd: number | null;
  population: number | null; projections: Projection[]; errors: string[];
  loading: boolean; error: string | null;
}
interface GeoResult { lat: number; lng: number; display_name: string; }

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
function cleanAiText(text: string | null) {
  if (!text) return "";
  let c = text.replace(/\*/g, '');
  c = c.replace(/([a-z])([.?!])([A-Z])/g, '$1$2 $3');
  c = c.replace(/\$([\d,]+(?:\.\d+)?)/g, (_, n) => {
    const num = parseFloat(n.replace(/,/g, ''));
    if (isNaN(num)) return _;
    if (num >= 1e9) return `$${(num/1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num/1e6).toFixed(2)}M`;
    return `$${Math.round(num).toLocaleString()}`;
  });
  return c;
}

const nominatimCache = new Map<string, any[]>();
const elevationCache = new Map<string, number>();

async function fetchNominatimSafe(query: string): Promise<any[]> {
  const key = query.toLowerCase().trim();
  if (nominatimCache.has(key)) return nominatimCache.get(key)!;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
      { headers: { "Accept-Language": "en", "User-Agent": "OpenPlanetRiskIntelligence/1.0" }, signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = await res.json();
    nominatimCache.set(key, data);
    return data;
  } catch { clearTimeout(timer); return []; }
}

async function fetchElevationSafe(lat: number, lng: number): Promise<number> {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  if (elevationCache.has(key)) return elevationCache.get(key)!;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return 0;
    const data = await res.json();
    const elev = data?.elevation?.[0] ?? 0;
    elevationCache.set(key, elev);
    return elev;
  } catch { clearTimeout(timer); return 0; }
}

// 🚀 FIXED: Removed canopy and albedo from API call. Fetching BASE data only.
async function geocodeAndFetch(query: string, ssp: string): Promise<Omit<CityResult, "loading" | "error"> | null> {
  const geoData = await fetchNominatimSafe(query);
  if (!geoData.length) throw new Error("Location not found.");
  const g = geoData[0];
  const lat = parseFloat(g.lat);
  const lng = parseFloat(g.lon);
  const elevation = await fetchElevationSafe(lat, lng);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const riskResp = await fetch("/api/engine", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        endpoint: '/api/climate-risk',
        payload: { lat, lng, elevation, ssp, canopy_offset_pct: 0, albedo_offset_pct: 0, location_hint: query }
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!riskResp.ok) throw new Error(`API ${riskResp.status}`);
    const riskData = await riskResp.json();
    if (riskData.error) throw new Error(`Engine reported: ${riskData.error}`);
    return { query, display_name: g.display_name, lat, lng, elevation, ...riskData };
  } catch (err) { clearTimeout(timer); throw err; }
}

const COMPARE_YEARS = [2030, 2050, 2075, 2100];

export default function CompareModule({ baseTarget }: { baseTarget: string }) {
  const [city1Geo, setCity1Geo] = useState<GeoResult | null>(null);
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
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const city1FetchedRef = useRef<string>("");

  useEffect(() => {
    if (!baseTarget || baseTarget === city1FetchedRef.current) return;
    city1FetchedRef.current = baseTarget;
    fetchNominatimSafe(baseTarget).then((data) => {
      if (data?.[0]) setCity1Geo({ display_name: baseTarget, lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) });
    });
  }, [baseTarget]);

  useEffect(() => {
    if (city2Geo || searchQuery2.length <= 2) { setSuggestions2([]); return; }
    const timer = setTimeout(async () => {
      const data = await fetchNominatimSafe(searchQuery2);
      setSuggestions2(data.map((c: any) => ({
        id: c.place_id, name: c.name || c.display_name.split(',')[0],
        country: c.display_name.split(',').pop()?.trim() || '',
        latitude: parseFloat(c.lat), longitude: parseFloat(c.lon),
      })));
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery2, city2Geo]);

  const handleCompare = async () => {
    if (!city2Geo || running) return;
    setGlobalError(null); setRunning(true); setAiAnalysis(null); setRetryStatus(null);
    const queries = [baseTarget, city2Geo.display_name];
    const initialResults = queries.map((q) => ({
      query: q, display_name: q, lat: 0, lng: 0, elevation: 0,
      threshold_c: 0, cooling_offset_c: 0, iso2: "", gdp_usd: null,
      population: null, projections: [], errors: [], loading: true, error: null,
    }));
    setResults(initialResults);
    const newResults: CityResult[] = [];

    for (let i = 0; i < queries.length; i++) {
      let success = false; let retries = 3; let lastError: any = null;
      while (!success && retries > 0) {
        try {
          if (retries < 3) setRetryStatus(`Retrying ${queries[i]}... (${4 - retries}/3)`);
          const data = await geocodeAndFetch(queries[i], ssp); // 🚀 Passed ONLY query and ssp
          newResults.push({ ...(data as Omit<CityResult, "loading" | "error">), loading: false, error: null });
          success = true; setRetryStatus(null);
        } catch (err: any) {
          lastError = err; retries--;
          if (retries > 0) await new Promise(r => setTimeout(r, 3000));
        }
      }
      if (!success) {
        newResults.push({
          query: queries[i], display_name: queries[i], lat: 0, lng: 0, elevation: 0,
          threshold_c: 0, cooling_offset_c: 0, iso2: "", gdp_usd: null, population: null,
          projections: [], errors: [], loading: false,
          error: String(lastError?.message || lastError).replace('Error: ', ''),
        });
        setRetryStatus(null);
      }
      setResults([...newResults, ...initialResults.slice(i + 1)]);
      if (i < queries.length - 1) await new Promise(r => setTimeout(r, 3500));
    }
    setRunning(false);

    // AI Analysis Block
    const okRes = newResults.filter(r => !r.error);
    if (okRes.length === 2) {
      setAiLoading(true);
      await new Promise(r => setTimeout(r, 2000));
      let aiSuccess = false; let aiRetries = 3;
      while (!aiSuccess && aiRetries > 0) {
        try {
          if (aiRetries < 3) setRetryStatus(`Waking up AI Auditor... (${4 - aiRetries}/3)`);
          const p1 = okRes[0].projections.find(p => p.year === compareYear) || okRes[0].projections[0];
          const p2 = okRes[1].projections.find(p => p.year === compareYear) || okRes[1].projections[0];
          const aiPayload = {
            city_name: `${okRes[0].query} vs ${okRes[1].query}`, context: "Compare",
            metrics: {
              temp: `${okRes[0].query}: ${fmt(p1?.peak_tx5d_c)}°C | ${okRes[1].query}: ${fmt(p2?.peak_tx5d_c)}°C`,
              elevation: `${okRes[0].query}: ${fmt(okRes[0].elevation, 0)}m | ${okRes[1].query}: ${fmt(okRes[1].elevation, 0)}m`,
              heatwave: `${okRes[0].query}: ${fmt(p1?.heatwave_days, 0)} days | ${okRes[1].query}: ${fmt(p2?.heatwave_days, 0)} days`,
              loss: `${okRes[0].query}: ${fmtUSD(p1?.economic_decay_usd)} | ${okRes[1].query}: ${fmtUSD(p2?.economic_decay_usd)}`,
              deaths: `${okRes[0].query}: ${fmt(p1?.attributable_deaths, 0)} | ${okRes[1].query}: ${fmt(p2?.attributable_deaths, 0)}`,
              lat: `${okRes[0].lat} | ${okRes[1].lat}`, lng: `${okRes[0].lng} | ${okRes[1].lng}`,
            },
          };
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 30000);
          const aiResp = await fetch("/api/engine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ endpoint: '/api/research-analysis', payload: aiPayload }),
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (!aiResp.ok) throw new Error(`API ${aiResp.status}`);
          const aiData = await aiResp.json();
          setAiAnalysis(aiData.reasoning);
          aiSuccess = true; setRetryStatus(null);
        } catch {
          aiRetries--;
          if (aiRetries > 0) await new Promise(r => setTimeout(r, 3000));
          else setAiAnalysis("AI Auditor offline. Please interpret the raw telemetry data above.");
        }
      }
      setAiLoading(false); setRetryStatus(null);
    }
  };

  // 🚀 THE MAGIC: Real-Time Frontend Mitigation Math for Table
  const getMitigatedValue = (baseValue: number | null | undefined, metricKey: string, baseHeatwaveDays: number = 0) => {
    if (baseValue == null) return null;
    
    // Calculate total cooling effect from sliders
    const cooling_C = (canopy / 100) * 1.2 + (albedo / 100) * 0.8;

    if (metricKey === "peak_tx5d_c" || metricKey === "wbt_max_c" || metricKey === "uhi_intensity_c") {
      return Math.max(0, baseValue - cooling_C);
    }
    
    if (metricKey === "heatwave_days") {
       return Math.max(0, baseValue - (cooling_C * 3.5));
    }

    if (metricKey === "attributable_deaths" || metricKey === "economic_decay_usd") {
        const effectiveHW = Math.max(0, baseHeatwaveDays - (cooling_C * 3.5));
        const hwRatio = baseHeatwaveDays > 0 ? effectiveHW / baseHeatwaveDays : 1;
        const severityRatio = Math.max(0, 1 - (cooling_C * 0.08)); 
        const combinedRatio = hwRatio * severityRatio;
        return baseValue * combinedRatio;
    }

    return baseValue;
  };

  const METRICS = [
    { key: "heatwave_days",       label: "Heatwave Days",       unit: "d/yr",   fmt: (v: number) => fmt(v, 0) },
    { key: "peak_tx5d_c",         label: "Peak Tx5d",           unit: "°C",     fmt: (v: number) => fmt(v) + "°C" },
    { key: "wbt_max_c",           label: "Max Wet-Bulb",        unit: "°C",     fmt: (v: number) => fmt(v) + "°C" },
    { key: "uhi_intensity_c",     label: "UHI Intensity",       unit: "°C",     fmt: (v: number) => "+" + fmt(v) + "°C" },
    { key: "attributable_deaths", label: "Attributable Deaths", unit: "est/yr", fmt: (v: number) => fmt(v, 0) },
    { key: "economic_decay_usd",  label: "Economic Decay",      unit: "USD",    fmt: (v: number) => fmtUSD(v) },
  ];

  const okResults = results.filter(r => !r.loading && !r.error && r.projections?.length > 0);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-1000 relative z-10">
      <div className="bg-[#050b14]/70 backdrop-blur-xl border border-cyan-500/20 p-8 rounded-2xl shadow-[0_0_40px_rgba(34,211,238,0.05)] relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 blur-[100px] pointer-events-none" />
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-[0.4em]">Dual-Sector Comparative Analysis</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
          {/* SECTOR 1 */}
          <div className="relative rounded-xl border border-cyan-500/50 overflow-hidden h-[140px] flex flex-col justify-center p-6 bg-[#020617] shadow-[0_0_20px_rgba(34,211,238,0.1)]">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(34,211,238,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,0.3) 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/80 to-transparent z-10" />
            <div className="relative z-20 w-full">
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block mb-1 font-bold">Sector 1 (Locked)</span>
              <h3 className="text-xl sm:text-2xl font-mono text-white tracking-wider uppercase truncate" title={baseTarget}>{baseTarget}</h3>
              {city1Geo && <span className="text-[9px] font-mono text-slate-400 tracking-widest block mt-1">{city1Geo.lat.toFixed(4)}N / {city1Geo.lng.toFixed(4)}E</span>}
            </div>
          </div>

          {/* SECTOR 2 */}
          <div className={`relative rounded-xl border overflow-visible h-[140px] flex flex-col justify-center p-6 bg-[#020617] transition-colors shadow-lg ${city2Geo ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-white/10'}`}>
            <div className="absolute inset-0 opacity-10 pointer-events-none rounded-xl" style={{ backgroundImage: 'linear-gradient(rgba(16,185,129,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,0.3) 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/80 to-black/20 z-10 rounded-xl" />
            <div className="relative z-20 w-full overflow-visible">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-3 font-bold">Sector 2 (Target Acquisition)</span>
              <div className="relative w-full overflow-visible">
                <input
                  type="text" value={searchQuery2}
                  onChange={(e) => { setSearchQuery2(e.target.value); if (city2Geo) setCity2Geo(null); }}
                  placeholder="SEARCH CITY TO COMPARE..."
                  className="w-full bg-[#0a0f1d]/90 backdrop-blur-md border border-slate-700 p-3 text-xs font-mono text-white placeholder-slate-500 outline-none rounded-sm focus:border-cyan-500 transition-colors uppercase tracking-widest shadow-xl"
                />
                {suggestions2.length > 0 && !city2Geo && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-[#050814] border border-cyan-500/30 rounded-sm shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[9999] max-h-48 overflow-y-auto custom-scrollbar">
                    {suggestions2.map((city, idx) => (
                      <div key={`${city.id}-${idx}`}
                        onClick={() => { const n = `${city.name}, ${city.country}`; setSearchQuery2(n); setCity2Geo({ display_name: n, lat: city.latitude, lng: city.longitude }); setSuggestions2([]); }}
                        className="px-4 py-3 text-[10px] font-mono text-slate-300 hover:bg-cyan-900 hover:text-white cursor-pointer transition-colors border-b border-slate-800 last:border-0 uppercase tracking-widest"
                      >
                        {city.name}, <span className="opacity-50">{city.country}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {city2Geo && <span className="text-[9px] font-mono text-emerald-400 tracking-widest block mt-2">{city2Geo.lat.toFixed(4)}N / {city2Geo.lng.toFixed(4)}E</span>}
            </div>
          </div>
        </div>

        {/* CONFIG HUD */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 p-6 bg-cyan-950/10 border border-cyan-500/10 rounded-xl mb-8">
          <div>
            <label className="block text-[10px] font-mono text-cyan-200 uppercase tracking-widest mb-3">Model Scenario</label>
            <select value={ssp} onChange={(e) => setSsp(e.target.value)} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs font-mono text-cyan-400 outline-none focus:border-cyan-500">
              <option value="ssp245">SSP2-4.5 (MODERATE)</option>
              <option value="ssp585">SSP5-8.5 (HIGH RISK)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono text-cyan-200 uppercase tracking-widest mb-3">Temporal Focus</label>
            <select value={compareYear} onChange={(e) => setCompareYear(Number(e.target.value))} className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs font-mono text-white outline-none focus:border-cyan-500">
              {COMPARE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><label className="text-[10px] font-mono text-cyan-200 uppercase">Canopy Offset</label><span className="text-[10px] font-mono text-emerald-400">+{canopy}%</span></div>
            <input type="range" min={0} max={50} value={canopy} onChange={(e) => setCanopy(Number(e.target.value))} className="w-full accent-emerald-500 bg-white/10 h-1 rounded-full appearance-none cursor-pointer" style={{ touchAction: 'manipulation' }} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><label className="text-[10px] font-mono text-cyan-200 uppercase">Albedo Roofs</label><span className="text-[10px] font-mono text-sky-400">+{albedo}%</span></div>
            <input type="range" min={0} max={100} value={albedo} onChange={(e) => setAlbedo(Number(e.target.value))} className="w-full accent-cyan-500 bg-white/10 h-1 rounded-full appearance-none cursor-pointer" style={{ touchAction: 'manipulation' }} />
          </div>
        </div>

        <button onClick={handleCompare} disabled={running || !city2Geo}
          className="w-full md:w-auto px-12 py-3 bg-cyan-900 border border-cyan-500/50 text-white font-mono text-xs font-bold uppercase tracking-[0.2em] rounded hover:bg-cyan-800 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)]"
          style={{ touchAction: 'manipulation' }}
        >
          {running ? "PROCESSING SIMULATION..." : "RUN COMPARISON"}
        </button>

        {retryStatus && <p className="mt-4 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-widest animate-pulse"><span className="inline-block w-2 h-2 bg-cyan-400 rounded-full mr-2" />{retryStatus}</p>}
        {globalError && <p className="mt-4 text-[10px] font-mono text-red-500 bg-red-950/30 border border-red-900/50 rounded-sm px-4 py-2 uppercase tracking-widest">{globalError}</p>}
      </div>

      {results.some(r => r.loading) && (
        <div className="grid gap-4 grid-cols-2">
          {results.map((r, i) => (
            <div key={i} className="bg-[#050b14]/70 border border-cyan-500/20 rounded-xl p-6 h-32 flex flex-col justify-center items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                <span className="text-[9px] font-mono text-cyan-500 uppercase tracking-widest">{r.loading ? 'loading telemetry..' : 'processing...'}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {okResults.length === 2 && !running && (
        <div className="w-full bg-[#050b14]/70 backdrop-blur-xl border border-cyan-500/20 rounded-2xl shadow-[0_0_40px_rgba(34,211,238,0.05)] overflow-hidden mt-8">
          <div className="bg-cyan-950/40 border-b border-cyan-500/30 px-8 py-6">
            <h3 className="text-[11px] font-mono text-cyan-300 tracking-[0.4em] uppercase">Side-by-Side Telemetry <span className="text-slate-500 ml-2">| {compareYear} | {ssp.toUpperCase()}</span></h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.01] border-b border-cyan-500/20">
                  <th className="px-8 py-6 text-[10px] font-mono text-cyan-200 uppercase tracking-widest w-[30%]">Parameter</th>
                  {okResults.map(r => (
                    <th key={r.query} className="px-8 py-6 text-center w-[35%]">
                      <span className="font-mono text-xs font-bold text-white block uppercase tracking-widest">{r.query}</span>
                      <span className="text-[9px] font-mono text-slate-500 block mt-1">{r.lat.toFixed(2)}N / {r.lng.toFixed(2)}E · {r.elevation.toFixed(0)}m</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {METRICS.map(m => {
                  // 🚀 Apply Real-Time Mitigation to Table Values
                  const vals = okResults.map(r => { 
                    const p = r.projections?.find(pr => pr.year === compareYear); 
                    if (!p) return null;
                    return getMitigatedValue((p as any)[m.key], m.key, p.heatwave_days);
                  });
                  
                  const maxVal = Math.max(...vals.filter((v): v is number => v !== null));
                  return (
                    <tr key={m.key} className="hover:bg-cyan-900/20 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="text-[11px] font-mono text-slate-300 uppercase tracking-wider group-hover:text-cyan-200 transition-colors">{m.label}</div>
                        <div className="text-[9px] font-mono text-slate-600 mt-1 uppercase">{m.unit}</div>
                      </td>
                      {okResults.map((r, i) => {
                        const v = vals[i];
                        const isMax = v != null && v === maxVal && maxVal > 0;
                        return (
                          <td key={r.query} className="px-8 py-6 text-center">
                            <span className={`font-mono text-sm ${isMax ? "text-cyan-300 font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" : "text-white"}`}>{v != null ? m.fmt(v) : "—"}</span>
                            {isMax && <span className="block mt-1 text-[8px] text-cyan-500/70 uppercase font-mono tracking-widest">Max.Exposure</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="bg-[#02050a]/60 border-t border-cyan-500/20 px-8 py-8">
            <h4 className="flex items-center gap-3 text-[10px] font-mono text-cyan-400 tracking-[0.3em] uppercase mb-4">
              <span className="w-1.5 h-1.5 bg-cyan-400 rounded-sm animate-pulse shadow-[0_0_8px_#22d3ee]" />Scientific Audit & Strategic Comparison
            </h4>
            {aiLoading ? (
              <div className="flex flex-col gap-3 py-4">
                <div className="h-2 w-full bg-slate-800 rounded animate-pulse" />
                <div className="h-2 w-3/4 bg-slate-800 rounded animate-pulse" />
                <span className="text-[9px] font-mono text-cyan-500/50 uppercase tracking-widest mt-2">AI Generating Executive Summary...</span>
              </div>
            ) : aiAnalysis ? (
              <p className="text-xs font-mono text-slate-300 leading-loose tracking-wide">{cleanAiText(aiAnalysis)}</p>
            ) : null}
          </div>
        </div>
      )}

      {results.filter(r => r.error).map(r => (
        <div key={r.query} className="bg-red-500/10 border border-red-500/20 rounded-xl px-6 py-4 mt-6 flex gap-4 items-center">
          <span className="text-red-500 font-mono text-xs">ERR:</span>
          <span className="text-red-400 font-mono text-[10px] uppercase tracking-widest">{r.query}: {r.error}</span>
        </div>
      ))}
    </div>
  );
}