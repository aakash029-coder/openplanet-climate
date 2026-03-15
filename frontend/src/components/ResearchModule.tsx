'use client';

import { useState, useEffect, useRef, useCallback } from "react";

interface Projection {
  year: number; source: string; heatwave_days: number; peak_tx5d_c: number;
  avg_excess_temp_c: number; attributable_deaths: number; economic_decay_usd: number;
  wbt_max_c?: number; uhi_intensity_c?: number; grid_stress_factor?: number;
}
interface RiskResult {
  threshold_c: number; cooling_offset_c: number; iso2: string;
  gdp_usd: number | null; population: number | null;
  projections: Projection[]; errors: string[];
  baseline: { baseline_mean_c: number | null };
}
interface GeoResult { lat: number; lng: number; elevation: number; display_name: string; }

function fmt(n: number | null | undefined, decimals = 1): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}
function fmtUSD(n: number | null | undefined) {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e12) return `$${(n/1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n/1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n/1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}
function getWBTStatus(wbt: number) {
  if (wbt >= 31) return { label: "CRITICAL", color: "text-red-500",     bg: "bg-red-500/10" };
  if (wbt >= 28) return { label: "DANGER",   color: "text-orange-500",  bg: "bg-orange-500/10" };
  return           { label: "STABLE",    color: "text-emerald-500", bg: "bg-emerald-500/10" };
}
function cleanResearchText(text: string | null) {
  if (!text) return "";
  let c = text.replace(/\*/g, '');
  c = c.replace(/([a-z])([.?!])([A-Z])/g, '$1$2 $3');
  c = c.replace(/\beuros?\b/gi, 'USD').replace(/€/g, '$');
  c = c.replace(/(?:USD|\$)\s*([\d,]+(?:\.\d{2,})?)/gi, (_, n) => {
    const num = parseFloat(n.replace(/,/g, ''));
    if (isNaN(num)) return _;
    if (num >= 1e9) return `$${(num/1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num/1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  });
  return c;
}

const nominatimCache = new Map<string, any>();
const elevationCache = new Map<string, number>();

async function fetchNominatimSafe(query: string): Promise<any | null> {
  const key = query.toLowerCase().trim();
  if (nominatimCache.has(key)) return nominatimCache.get(key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`,
      { headers: { "Accept-Language": "en", "User-Agent": "OpenPlanetRiskIntelligence/1.0" }, signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.length) return null;
    nominatimCache.set(key, data[0]);
    return data[0];
  } catch { clearTimeout(timer); return null; }
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

export default function ResearchModule({ baseTarget }: { baseTarget: string }) {
  const [ssp, setSsp] = useState("ssp245");
  const [canopy, setCanopy] = useState(0);
  const [albedo, setAlbedo] = useState(0);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [geo, setGeo] = useState<GeoResult | null>(null);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const isRunningRef = useRef(false);
  const lastAutoRunTarget = useRef<string>("");

  useEffect(() => {
    if (!baseTarget || baseTarget === lastAutoRunTarget.current) return;
    lastAutoRunTarget.current = baseTarget;
    setIsStale(false);
    handleAnalyse(baseTarget, ssp, canopy, albedo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [baseTarget]);

  useEffect(() => {
    if (result) setIsStale(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ssp, canopy, albedo]);

  const handleAnalyse = useCallback(async (
    queryToRun: string = baseTarget,
    sspVal = ssp, canopyVal = canopy, albedoVal = albedo,
  ) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setLoading(true); setError(null); setAiAnalysis(null); setRetryStatus(null); setIsStale(false);

    try {
      // STEP 1: Geocode
      let currentGeo: GeoResult | null = null;
      let geoRetries = 3;
      while (geoRetries > 0 && !currentGeo) {
        if (geoRetries < 3) setRetryStatus(`Locating ${queryToRun}... (${4 - geoRetries}/3)`);
        const g = await fetchNominatimSafe(queryToRun);
        if (g) {
          const lat = parseFloat(g.lat); const lng = parseFloat(g.lon);
          const elevation = await fetchElevationSafe(lat, lng);
          currentGeo = { display_name: g.display_name, lat, lng, elevation };
          setGeo(currentGeo); setRetryStatus(null);
        } else {
          geoRetries--;
          if (geoRetries > 0) await new Promise(r => setTimeout(r, 2000));
        }
      }
      if (!currentGeo) throw new Error("Geocoding failed after 3 retries.");

      // STEP 2: Risk Engine via proxy
      let riskRetries = 3; let riskData: any = null; let lastRiskError: any = null;
      while (riskRetries > 0 && !riskData) {
        if (riskRetries < 3) setRetryStatus(`Fetching risk metrics... (${4 - riskRetries}/3)`);
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 30000);
          // ✅ Via proxy — Cloudflare bypass
          const riskResp = await fetch("/api/engine", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              endpoint: '/api/climate-risk',
              payload: { lat: currentGeo.lat, lng: currentGeo.lng, elevation: currentGeo.elevation, ssp: sspVal, canopy_offset_pct: canopyVal, albedo_offset_pct: albedoVal, location_hint: queryToRun }
            }),
            signal: controller.signal,
          });
          clearTimeout(timer);
          if (!riskResp.ok) throw new Error(`API ${riskResp.status}`);
          const d = await riskResp.json();
          if (d.error) throw new Error(d.error);
          riskData = d; setRetryStatus(null);
        } catch (err) {
          lastRiskError = err; riskRetries--;
          if (riskRetries > 0) await new Promise(r => setTimeout(r, 3000));
        }
      }
      if (!riskData) throw new Error(lastRiskError?.message || "Engine connection failed.");

      setResult(riskData);
      let targetYr = selectedYear;
      if (!targetYr && riskData.projections?.length > 0) { targetYr = riskData.projections[0].year; setSelectedYear(targetYr); }
      setLoading(false);

      // STEP 3: AI via proxy
      if (riskData.projections?.length > 0) {
        setAiLoading(true);
        await new Promise(r => setTimeout(r, 2000));
        let aiRetries = 3; let aiSuccess = false;
        while (!aiSuccess && aiRetries > 0) {
          try {
            if (aiRetries < 3) setRetryStatus(`Waking up AI Auditor... (${4 - aiRetries}/3)`);
            const pData = riskData.projections.find((p: any) => p.year === (targetYr || 2050)) || riskData.projections[0];
            const aiPayload = {
              city_name: currentGeo.display_name, context: "DeepDive",
              metrics: { temp: `${fmt(pData.peak_tx5d_c)}°C`, elevation: `${fmt(currentGeo.elevation, 0)}m`, heatwave: `${fmt(pData.heatwave_days, 0)} days`, loss: fmtUSD(pData.economic_decay_usd), lat: currentGeo.lat, lng: currentGeo.lng }
            };
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30000);
            // ✅ Via proxy
            const aiResp = await fetch("/api/engine", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ endpoint: '/api/research-analysis', payload: aiPayload }),
              signal: controller.signal,
            });
            clearTimeout(timer);
            if (!aiResp.ok) throw new Error(`AI API ${aiResp.status}`);
            const aiData = await aiResp.json();
            setAiAnalysis(aiData.reasoning);
            aiSuccess = true; setRetryStatus(null);
          } catch {
            aiRetries--;
            if (aiRetries > 0) await new Promise(r => setTimeout(r, 3000));
            else setAiAnalysis("AI Auditor offline. Refer to raw metrics.");
          }
        }
        setAiLoading(false); setRetryStatus(null);
      }
    } catch (err: any) {
      setError(err.message || "Analysis Failed");
      setLoading(false); setRetryStatus(null);
    } finally {
      isRunningRef.current = false;
    }
  }, [baseTarget, ssp, canopy, albedo, selectedYear]);

  const selectedProj = result?.projections?.find(p => p.year === selectedYear);
  const wbt = selectedProj?.wbt_max_c || (selectedProj ? (selectedProj.peak_tx5d_c * 0.7 + 8) : 0);
  const uhi = selectedProj?.uhi_intensity_c || (selectedProj && result?.baseline?.baseline_mean_c ? (selectedProj.peak_tx5d_c - result.baseline.baseline_mean_c) : 0);
  const cdd = selectedProj?.grid_stress_factor || (selectedProj ? (selectedProj.peak_tx5d_c - 18) * selectedProj.heatwave_days : 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-1000">
      <div className="flex justify-between items-end border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-[0.5em] mb-2">Deep Dive Research Protocol</h2>
          <h1 className="text-2xl sm:text-3xl font-mono font-bold text-white uppercase tracking-tighter truncate max-w-2xl" title={baseTarget}>{baseTarget.split(',')[0]}</h1>
          {geo && <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-2">{geo.lat.toFixed(4)}N / {geo.lng.toFixed(4)}E · ELEV: {geo.elevation}m</p>}
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Scientific Version</p>
          <p className="text-[10px] font-mono text-slate-300 uppercase">v2.0.4-PRO</p>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="bg-[#050814] border border-slate-800 p-6 rounded-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">SSP Scenario</label>
            <select value={ssp} onChange={(e) => setSsp(e.target.value)} className="w-full bg-[#0a0f1d] border border-slate-700 p-2.5 text-[11px] font-mono text-slate-200 outline-none rounded-sm focus:border-indigo-500 transition-colors">
              <option value="ssp245">SSP2-4.5 (Moderate)</option>
              <option value="ssp585">SSP5-8.5 (High Risk)</option>
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><label className="text-[10px] font-mono text-slate-400 uppercase">Canopy</label><span className="text-[10px] font-mono text-emerald-400">{canopy}%</span></div>
            <input type="range" min={0} max={50} value={canopy} onChange={(e) => setCanopy(Number(e.target.value))} className="w-full accent-emerald-500 cursor-pointer" style={{ touchAction: 'manipulation' }} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><label className="text-[10px] font-mono text-slate-400 uppercase">Albedo</label><span className="text-[10px] font-mono text-indigo-400">{albedo}%</span></div>
            <input type="range" min={0} max={100} value={albedo} onChange={(e) => setAlbedo(Number(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" style={{ touchAction: 'manipulation' }} />
          </div>
          <div className="flex flex-col justify-end">
            <button
              onClick={() => handleAnalyse(baseTarget, ssp, canopy, albedo)}
              disabled={loading || aiLoading}
              className="w-full bg-indigo-600/20 border border-indigo-500/50 text-indigo-400 py-3 text-[10px] font-mono uppercase tracking-[0.3em] rounded hover:bg-indigo-600/40 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              style={{ touchAction: 'manipulation' }}
            >
              {loading ? (<><span className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />RUNNING...</>) : (<>RUN ANALYSIS {isStale && <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse ml-1" />}</>)}
            </button>
          </div>
        </div>
        {isStale && !loading && <p className="text-[9px] font-mono text-amber-400/70 uppercase tracking-widest">Parameters changed — click Run Analysis to apply</p>}
        {retryStatus && <p className="mt-3 text-[9px] font-mono text-indigo-400 uppercase tracking-widest animate-pulse">{retryStatus}</p>}
      </div>

      {loading && !result && (
        <div className="w-full h-64 flex flex-col items-center justify-center bg-[#050814] border border-slate-800 rounded-sm">
          <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
          <span className="font-mono text-[10px] text-indigo-400 tracking-[0.3em] uppercase animate-pulse">Running Physics Engine...</span>
          {retryStatus && <span className="mt-4 font-mono text-[9px] text-slate-500 tracking-widest uppercase">{retryStatus}</span>}
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-sm text-red-400 font-mono text-xs">ERR: {error}</div>}

      {!loading && result && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* WET-BULB */}
            <div className="lg:col-span-1 bg-[#050814] border border-slate-800 p-6 rounded-sm flex flex-col">
              <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-8">Physiological Limit Monitor</h3>
              <div className="flex flex-col items-center justify-center py-10 border-y border-slate-800/50 my-6 flex-grow">
                <span className={`text-5xl font-mono font-bold ${getWBTStatus(wbt).color}`}>{fmt(wbt)}°C</span>
                <span className="text-[10px] font-mono text-slate-500 mt-2 tracking-widest">MAX WET-BULB (WBT)</span>
                <div className={`mt-6 px-4 py-1 rounded-full border border-current ${getWBTStatus(wbt).color} ${getWBTStatus(wbt).bg} text-[9px] font-mono font-bold`}>{getWBTStatus(wbt).label}</div>
              </div>
              <p className="text-[10px] font-mono text-slate-500 leading-relaxed">The WBT index represents the thermal limit of human survivability. Values exceeding <span className="text-red-400">31°C</span> indicate critical risk of hyperthermia during outdoor exposure.</p>
            </div>

            {/* UHI */}
            <div className="lg:col-span-1 bg-[#050814] border border-slate-800 p-6 rounded-sm flex flex-col">
              <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-8">Heat Attribution (UHI)</h3>
              <div className="space-y-6 flex-grow">
                {[
                  { label: "Global Baseline", val: `+${fmt(result?.baseline?.baseline_mean_c)}°C`, color: "text-slate-300", bar: "bg-indigo-500", w: "60%" },
                  { label: "Concrete Trap (UHI)", val: `+${fmt(uhi)}°C`, color: "text-orange-400", bar: "bg-orange-500", w: "30%" },
                  { label: "Albedo Penalty", val: `+${fmt(albedo > 0 ? 2.1 - (albedo/100*0.8) : 2.1)}°C`, color: "text-red-400", bar: "bg-red-500", w: "15%" },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[10px] font-mono mb-2">
                      <span className="text-slate-500 uppercase">{item.label}</span>
                      <span className={item.color}>{item.val}</span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div className={`${item.bar} h-full`} style={{ width: item.w }} />
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-6 pt-6 border-t border-slate-800">
                <p className="text-[9px] font-mono text-slate-600 leading-relaxed uppercase tracking-wider">Note: UHI effects are manageable through localized mitigation (Canopy/Albedo sliders).</p>
              </div>
            </div>

            {/* INFRASTRUCTURE */}
            <div className="lg:col-span-1 bg-[#050814] border border-slate-800 p-6 rounded-sm flex flex-col">
              <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-8">Infrastructure Fragility</h3>
              <div className="grid grid-cols-2 gap-4 flex-grow content-start">
                <div className="p-4 bg-white/5 border border-white/5 flex flex-col justify-center">
                  <span className="text-[9px] font-mono text-slate-500 block mb-2 uppercase">Grid Stress</span>
                  <span className="text-xl font-mono text-indigo-400 font-bold">+{fmt(cdd, 0)}</span>
                  <span className="text-[8px] font-mono text-slate-600 block mt-1 uppercase">CDD LOAD</span>
                </div>
                <div className="p-4 bg-white/5 border border-white/5 flex flex-col justify-center">
                  <span className="text-[9px] font-mono text-slate-500 block mb-2 uppercase">Road Melt Risk</span>
                  <span className={`text-xl font-mono font-bold ${selectedProj && selectedProj.peak_tx5d_c > 38 ? 'text-amber-400' : 'text-emerald-400'}`}>{selectedProj && selectedProj.peak_tx5d_c > 38 ? 'HIGH' : 'LOW'}</span>
                  <span className="text-[8px] font-mono text-slate-600 block mt-1 uppercase">38°C+ EXPOSURE</span>
                </div>
              </div>
              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 uppercase">
                  <div className={`w-1.5 h-1.5 rounded-full ${cdd > 500 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <span>Thermal Overload Threshold: {cdd > 500 ? 'Exceeded' : 'Stable'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ECONOMIC */}
          <div className="bg-indigo-600/5 border border-indigo-500/20 p-8 rounded-sm">
            <h3 className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest mb-6 font-bold">Economic Value At Risk ({selectedYear || "2050"})</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-center">
              <div className="md:col-span-2">
                <div className="h-24 flex items-end gap-1 w-full border-b border-slate-700 pb-2">
                  {result.projections.map((p, idx) => {
                    const heightPct = Math.min(100, (p.economic_decay_usd / (result.projections[result.projections.length-1].economic_decay_usd || 1)) * 100);
                    return <div key={p.year} className="bg-red-500 w-full transition-all duration-500" style={{ height: `${heightPct}%`, opacity: 0.4 + idx * 0.2 }} />;
                  })}
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-500 uppercase mt-2">
                  {result.projections.map(p => <span key={p.year}>{p.year}</span>)}
                </div>
              </div>
              <div className="flex flex-col justify-center space-y-6">
                <div>
                  <span className="text-[9px] font-mono text-slate-500 uppercase block">Est. Annual GDP Loss</span>
                  <span className="text-2xl font-mono font-bold text-white">{fmtUSD(selectedProj?.economic_decay_usd)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-slate-500 uppercase block">City GDP Baseline</span>
                  <span className="text-lg font-mono font-bold text-slate-400">{fmtUSD(result.gdp_usd)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* AI AUDIT */}
          <div className="border border-indigo-500/30 bg-[#050814]/80 p-8 rounded-sm relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/10 blur-[50px] pointer-events-none" />
            <h4 className="text-[10px] font-mono text-indigo-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />Expert AI Reasoning (Geological & Thermal Context)
            </h4>
            {aiLoading ? (
              <div className="flex items-center gap-3 py-2">
                <div className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">{retryStatus || "Generating Executive Summary..."}</span>
              </div>
            ) : aiAnalysis ? (
              <p className="text-xs font-mono text-slate-300 leading-loose">{cleanResearchText(aiAnalysis)}</p>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}