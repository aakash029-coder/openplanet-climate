'use client';

import { useState, useEffect } from "react";

// ── TYPES ────────────────────────────────────────────────────────────────────
interface Projection {
  year: number;
  source: string;
  heatwave_days: number;
  peak_tx5d_c: number;
  avg_excess_temp_c: number;
  attributable_deaths: number;
  economic_decay_usd: number;
  wbt_max_c?: number;
  uhi_intensity_c?: number;
  grid_stress_factor?: number;
}

interface RiskResult {
  threshold_c: number;
  cooling_offset_c: number;
  iso2: string;
  gdp_usd: number | null;
  population: number | null;
  projections: Projection[];
  errors: string[];
  baseline: {
    baseline_mean_c: number | null;
  };
}

interface GeoResult {
  lat: number;
  lng: number;
  elevation: number;
  display_name: string;
}

// ── HELPERS ──────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined, decimals = 1): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtUSD(n: number | null | undefined) {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function getWBTStatus(wbt: number) {
  if (wbt >= 31) return { label: "CRITICAL", color: "text-red-500", bg: "bg-red-500/10" };
  if (wbt >= 28) return { label: "DANGER", color: "text-orange-500", bg: "bg-orange-500/10" };
  return { label: "STABLE", color: "text-emerald-500", bg: "bg-emerald-500/10" };
}

// ── MAIN COMPONENT ───────────────────────────────────────────────────────────
export default function ResearchModule({ baseTarget }: { baseTarget: string }) {
  const [ssp, setSsp] = useState("ssp245");
  const [canopy, setCanopy] = useState(0);
  const [albedo, setAlbedo] = useState(0);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const [geo, setGeo] = useState<GeoResult | null>(null);
  const [result, setResult] = useState<RiskResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI AUDITOR STATE
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    if (baseTarget) handleAnalyse(baseTarget);
  }, [baseTarget, ssp, canopy, albedo]); // Re-run if mitigation changes

  const handleAnalyse = async (queryToRun: string = baseTarget) => {
    setLoading(true);
    setError(null);
    setAiAnalysis(null);

    try {
      // 1. GEOCODE THE TARGET
      const geoResp = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(queryToRun)}&format=json&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      const geoDataArr = await geoResp.json();
      if (!geoDataArr.length) throw new Error("Location not found.");
      
      const g = geoDataArr[0];
      const lat = parseFloat(g.lat);
      const lng = parseFloat(g.lon);

      let elevation = 0;
      try {
        const elevResp = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
        const elevData = await elevResp.json();
        elevation = elevData?.elevation?.[0] ?? 0;
      } catch {}

      const currentGeo = { display_name: g.display_name, lat, lng, elevation };
      setGeo(currentGeo);

      // 2. FETCH RISK METRICS FROM ENGINE
      const riskResp = await fetch("https://albus2903-openplanet-engine.hf.space/api/climate-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lng, elevation, ssp, canopy_offset_pct: canopy, albedo_offset_pct: albedo, location_hint: queryToRun }), 
      });
      
      const data = await riskResp.json();
      if (data.error) throw new Error(data.error);
      
      setResult(data);
      let targetYr = selectedYear;
      if (!targetYr && data.projections?.length > 0) {
        targetYr = data.projections[0].year;
        setSelectedYear(targetYr);
      }

      // 3. FETCH AI REASONING (SCIENTIFIC AUDIT)
      if (data.projections?.length > 0) {
        setAiLoading(true);
        try {
          const pData = data.projections.find((p: any) => p.year === (targetYr || 2050)) || data.projections[0];
          
          const aiPayload = {
            city_name: currentGeo.display_name,
            context: "DeepDive",
            metrics: {
              temp: pData.peak_tx5d_c,
              elevation: currentGeo.elevation,
              heatwave: pData.heatwave_days,
              loss: pData.economic_decay_usd,
              lat: currentGeo.lat,
              lng: currentGeo.lng
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
          setAiAnalysis("AI Auditor offline. Refer to raw metrics.");
        } finally {
          setAiLoading(false);
        }
      }

    } catch (err: any) { 
      setError(err.message || "Analysis Failed"); 
    } finally { 
      setLoading(false); 
    }
  };

  const selectedProj = result?.projections?.find((p) => p.year === selectedYear);
  const wbt = selectedProj?.wbt_max_c || (selectedProj ? (selectedProj.peak_tx5d_c * 0.7 + 8) : 0);
  const uhi = selectedProj?.uhi_intensity_c || (selectedProj && result?.baseline?.baseline_mean_c ? (selectedProj.peak_tx5d_c - result.baseline.baseline_mean_c) : 0);
  const cdd = selectedProj?.grid_stress_factor || (selectedProj ? (selectedProj.peak_tx5d_c - 18) * selectedProj.heatwave_days : 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-1000">
      
      {/* ── HEADER: INSTITUTIONAL PROTOCOL ── */}
      <div className="flex justify-between items-end border-b border-slate-800 pb-6">
        <div>
          <h2 className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-[0.5em] mb-2">Deep Dive Research Protocol</h2>
          <h1 className="text-2xl sm:text-3xl font-mono font-bold text-white uppercase tracking-tighter truncate max-w-2xl" title={baseTarget}>
            {baseTarget.split(',')[0]}
          </h1>
          {geo && <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-2">{geo.lat.toFixed(4)}N / {geo.lng.toFixed(4)}E · ELEV: {geo.elevation}m</p>}
        </div>
        <div className="text-right hidden sm:block">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Scientific Version</p>
          <p className="text-[10px] font-mono text-slate-300 uppercase">v2.0.4-PRO</p>
        </div>
      </div>

      {loading && !result && (
        <div className="w-full h-64 flex flex-col items-center justify-center bg-[#050814] border border-slate-800 rounded-sm">
          <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
          <span className="font-mono text-[10px] text-indigo-400 tracking-[0.3em] uppercase animate-pulse">Running Physics Engine...</span>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-sm text-red-400 font-mono text-xs">
          ERR: {error}
        </div>
      )}

      {!loading && result && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* ── COLUMN 1: PHYSIOLOGICAL LIMIT (WET-BULB) ── */}
            <div className="lg:col-span-1 bg-[#050814] border border-slate-800 p-6 rounded-sm relative overflow-hidden flex flex-col">
              <div className="absolute top-0 right-0 p-2 opacity-20"><span className="text-[40px] font-bold">01</span></div>
              <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-8">Physiological Limit Monitor</h3>
              
              <div className="flex flex-col items-center justify-center py-10 border-y border-slate-800/50 my-6 flex-grow">
                <span className={`text-5xl font-mono font-bold ${getWBTStatus(wbt).color}`}>{fmt(wbt)}°C</span>
                <span className="text-[10px] font-mono text-slate-500 mt-2 tracking-widest">MAX WET-BULB (WBT)</span>
                <div className={`mt-6 px-4 py-1 rounded-full border border-current ${getWBTStatus(wbt).color} ${getWBTStatus(wbt).bg} text-[9px] font-mono font-bold`}>
                  {getWBTStatus(wbt).label}
                </div>
              </div>
              
              <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                The WBT index represents the thermal limit of human survivability. 
                Values exceeding <span className="text-red-400">31°C</span> indicate critical risk of hyperthermia during outdoor exposure.
              </p>
            </div>

            {/* ── COLUMN 2: UHI DECOMPOSITION ── */}
            <div className="lg:col-span-1 bg-[#050814] border border-slate-800 p-6 rounded-sm flex flex-col">
              <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-8">Heat Attribution (UHI)</h3>
              
              <div className="space-y-6 flex-grow">
                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-2">
                    <span className="text-slate-500 uppercase">Global Baseline</span>
                    <span className="text-slate-300">+{fmt(result?.baseline?.baseline_mean_c)}°C</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-indigo-500 h-full" style={{ width: '60%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-2">
                    <span className="text-slate-500 uppercase">Concrete Trap (UHI)</span>
                    <span className="text-orange-400">+{fmt(uhi)}°C</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-orange-500 h-full" style={{ width: '30%' }}></div>
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-mono mb-2">
                    <span className="text-slate-500 uppercase">Albedo Penalty</span>
                    <span className="text-red-400">+{fmt(albedo > 0 ? 2.1 - (albedo/100 * 0.8) : 2.1)}°C</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                    <div className="bg-red-500 h-full" style={{ width: '15%' }}></div>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-slate-800">
                <p className="text-[9px] font-mono text-slate-600 leading-relaxed uppercase tracking-wider">
                  Note: Urban Heat Island (UHI) effects are manageable through localized mitigation (Canopy/Albedo sliders).
                </p>
              </div>
            </div>

            {/* ── COLUMN 3: INFRASTRUCTURE FRAGILITY ── */}
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
                  <span className={`text-xl font-mono font-bold ${selectedProj && selectedProj.peak_tx5d_c > 38 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {selectedProj && selectedProj.peak_tx5d_c > 38 ? 'HIGH' : 'LOW'}
                  </span>
                  <span className="text-[8px] font-mono text-slate-600 block mt-1 uppercase">38°C+ EXPOSURE</span>
                </div>
              </div>

              <div className="mt-8 space-y-4">
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 uppercase">
                  <div className={`w-1.5 h-1.5 rounded-full ${cdd > 500 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`}></div>
                  <span>Thermal Overload Threshold: {cdd > 500 ? 'Exceeded' : 'Stable'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ── THE COST OF INACTION (CFO VIEW) ── */}
          <div className="bg-indigo-600/5 border border-indigo-500/20 p-8 rounded-sm">
            <h3 className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest mb-6 font-bold">Economic Value At Risk ({selectedYear || "2050"})</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12 items-center">
              <div className="md:col-span-2">
                <div className="h-24 flex items-end gap-1 w-full border-b border-slate-700 pb-2">
                   {/* Dynamic bars based on projections array */}
                   {result.projections.map((p, idx) => {
                      const heightPct = Math.min(100, (p.economic_decay_usd / (result.projections[result.projections.length-1].economic_decay_usd || 1)) * 100);
                      return (
                        <div key={p.year} className="bg-red-500 w-full transition-all duration-500" style={{ height: `${heightPct}%`, opacity: (0.4 + (idx * 0.2)) }}></div>
                      );
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

          {/* ── NEW: AI SCIENTIFIC AUDIT BOX ── */}
          <div className="border border-indigo-500/30 bg-[#050814]/80 p-8 rounded-sm relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/10 blur-[50px] pointer-events-none"></div>
            <h4 className="text-[10px] font-mono text-indigo-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse"></span> 
              Expert AI Reasoning (Geological & Thermal Context)
            </h4>
            
            {aiLoading ? (
              <span className="text-xs font-mono text-slate-500">data loading...</span>
            ) : aiAnalysis ? (
              <p className="text-xs font-mono text-slate-300 leading-loose">
                {aiAnalysis.replace(/\*/g, '')}
              </p>
            ) : null}
          </div>

        </>
      )}
    </div>
  );
}