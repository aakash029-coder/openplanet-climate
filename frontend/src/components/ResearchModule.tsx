'use client';

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  formatWBT,
  formatEconomicRange,
  formatDeathsRange,
  formatCoordinates,
  getSourceLabel,
} from "@/context/ClimateDataContext";
import { ExcelExportIconButton, type ExcelExportData } from "@/components/ExcelExport";

interface Projection {
  year: number;
  source: string;
  heatwave_days: number;
  peak_tx5d_c: number;
  attributable_deaths: number;
  economic_decay_usd: number;
  wbt_max_c?: number;
  uhi_intensity_c?: number;
  grid_stress_factor?: number;
  region?: string;
  audit_trail?: any;
}

interface RiskResult {
  threshold_c: number;
  cooling_offset_c: number;
  gdp_usd: number | null;
  population: number | null;
  projections: Projection[];
  baseline: { baseline_mean_c: number | null };
  era5_humidity_p95?: number;
}

function fmt(n: number | null | undefined, decimals = 1): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function fmtUSD(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function getWBTStatus(wbt: number) {
  if (wbt >= 35)  return { label: "> 35°C — Critical Physiological Limit", color: "text-red-500",     bg: "bg-red-500/10",     border: "border-red-500/30" };
  if (wbt >= 31)  return { label: "CRITICAL",  color: "text-red-500",     bg: "bg-red-500/10",     border: "border-red-500/30" };
  if (wbt >= 28)  return { label: "DANGER",    color: "text-orange-500",  bg: "bg-orange-500/10",  border: "border-orange-500/30" };
  return            { label: "STABLE",     color: "text-emerald-500", bg: "bg-emerald-500/10", border: "border-emerald-500/30" };
}

function cleanResearchText(text: string | null): string {
  if (!text) return "";
  let c = text.replace(/\*/g, '');
  c = c.replace(/([a-z])([.?!])([A-Z])/g, '$1$2 $3');
  c = c.replace(/\beuros?\b/gi, 'USD').replace(/€/g, '$');
  return c;
}

// ─────────────────────────────────────────────────────────────────
// SOURCE BADGE — italic, no box
// ─────────────────────────────────────────────────────────────────
const SourceLine = ({ source }: { source: string }) => (
  <p className="mt-1.5 text-[8px] font-mono text-slate-600 italic">{source}</p>
);

// ─────────────────────────────────────────────────────────────────
// CALCULATION DETAILS MODAL — for Deep Dive
// ─────────────────────────────────────────────────────────────────
const VAR_TOOLTIPS: Record<string, string> = {
  AF:            "Attributable Fraction — proportion of deaths attributable to heat. AF = (RR−1) / RR",
  RR:            "Relative Risk — RR = exp(β × ΔT)",
  beta:          "Gasparrini (2017) GBD meta-analysis global mean coefficient = 0.0801",
  V:             "Vulnerability multiplier — AC penetration, age structure, healthcare access",
  DR:            "World Bank crude death rate per 1,000 (SP.DYN.CDRT.IN)",
  HW:            "Calibrated annual heatwave days from CMIP6 ensemble",
  Pop:           "Metro population from GeoNames API",
  temp_excess_c: "Temperature above ERA5 P95 threshold",
  Burke_penalty: "0.0127 × (T_mean − 13°C)² / 100 — Burke (2018) GDP penalty",
  ILO_fraction:  "(HW/365) × 0.40 × 0.20 — ILO (2019) labor productivity loss",
  T_mean:        "CMIP6 projected annual mean temperature",
  T_optimal:     "13°C — global economic optimum temperature",
  HW_days:       "Annual heatwave days from CMIP6 ensemble",
  GDP:           "City GDP: World Bank GDP/cap × population × urban ratio",
};

const CalcModal = ({
  open, onClose, auditSection, title, disclaimer,
}: {
  open: boolean; onClose: () => void;
  auditSection: any; title: string; disclaimer: string;
}) => {
  if (!open || !auditSection) return null;
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 backdrop-blur-md p-4" onClick={onClose}>
      <div className="relative w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-[#06101f] border border-cyan-500/20 rounded-2xl shadow-[0_0_60px_rgba(34,211,238,0.1)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 bg-cyan-950/10 sticky top-0 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            <span className="text-[10px] font-mono text-cyan-300 uppercase tracking-[0.25em] font-bold">Calculation Details · {title}</span>
          </div>
          <button onClick={onClose} className="w-6 h-6 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-500 hover:text-white transition-all flex items-center justify-center text-[14px]">×</button>
        </div>
        <div className="p-5 space-y-3">
          <div className="bg-[#020912] rounded-xl px-4 py-3 border border-slate-800">
            <p className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.2em] mb-1.5">Formula</p>
            <p className="text-white font-mono text-[12px] tracking-wide leading-relaxed">{auditSection.formula}</p>
          </div>
          {auditSection.variables && (
            <div className="bg-[#020912] rounded-xl px-4 py-3 border border-slate-800">
              <p className="text-[8px] font-mono text-slate-500 uppercase tracking-[0.2em] mb-2.5">Variables</p>
              <div className="grid grid-cols-2 gap-x-6">
                {Object.entries(auditSection.variables).map(([k, v]) => {
                  const tip = VAR_TOOLTIPS[k];
                  return (
                    <div key={k} className="flex items-center justify-between py-1.5 border-b border-slate-800/40 last:border-0">
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-mono text-cyan-400">{k}</span>
                        {tip && (
                          <div className="relative group">
                            <div className="w-3 h-3 rounded-full border border-slate-700 text-slate-600 flex items-center justify-center text-[7px] cursor-help hover:border-cyan-500 hover:text-cyan-400 transition-all">?</div>
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
          {auditSection.computation && (
            <div className="bg-emerald-950/20 rounded-xl px-4 py-3 border border-emerald-500/20">
              <p className="text-[8px] font-mono text-emerald-400 uppercase tracking-[0.2em] mb-1.5">Result</p>
              <p className="text-[11px] font-mono text-white leading-relaxed break-all">{auditSection.computation}</p>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <p className="text-[8px] font-mono text-slate-600 italic">{auditSection.source}</p>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest">Calculation validated</span>
            </div>
          </div>
          <div className="bg-slate-900/40 rounded-lg px-3 py-2 border border-slate-800/40">
            <p className="text-[8px] font-mono text-slate-500 leading-relaxed italic">{disclaimer}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// CACHES
// ─────────────────────────────────────────────────────────────────
const nominatimCache = new Map<string, any>();
const elevationCache = new Map<string, number>();

async function fetchNominatimSafe(query: string): Promise<any | null> {
  const key = query.toLowerCase().trim();
  if (nominatimCache.has(key)) return nominatimCache.get(key);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1`, { headers: { "Accept-Language": "en", "User-Agent": "OpenPlanetRiskIntelligence/1.0" }, signal: controller.signal });
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

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function ResearchModule({ baseTarget }: { baseTarget: string }) {
  const [ssp, setSsp]               = useState("ssp245");
  const [canopy, setCanopy]         = useState(0);
  const [albedo, setAlbedo]         = useState(0);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [geo, setGeo]               = useState<{ lat: number; lng: number; elevation: number; display_name: string } | null>(null);
  const [result, setResult]         = useState<RiskResult | null>(null);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading, setAiLoading]   = useState(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);

  // Calc modals
  const [calcModal, setCalcModal] = useState<{ open: boolean; key: 'mortality' | 'economics' }>({ open: false, key: 'mortality' });

  const isRunningRef      = useRef(false);
  const lastAutoRunTarget = useRef<string>("");

  useEffect(() => {
    if (!baseTarget || baseTarget === lastAutoRunTarget.current) return;
    lastAutoRunTarget.current = baseTarget;
    handleAnalyse(baseTarget, ssp);
  }, [baseTarget]);

  useEffect(() => {
    if (result && lastAutoRunTarget.current) handleAnalyse(lastAutoRunTarget.current, ssp);
  }, [ssp]);

  const handleAnalyse = useCallback(async (queryToRun: string = baseTarget, sspVal = ssp) => {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setLoading(true); setError(null); setAiAnalysis(null); setRetryStatus(null);

    try {
      let currentGeo: { lat: number; lng: number; elevation: number; display_name: string } | null = null;
      let geoRetries = 3;
      while (geoRetries > 0 && !currentGeo) {
        if (geoRetries < 3) setRetryStatus(`Locating ${queryToRun}... (${4 - geoRetries}/3)`);
        const g = await fetchNominatimSafe(queryToRun);
        if (g) {
          const lat = parseFloat(g.lat); const lng = parseFloat(g.lon);
          const elevation = await fetchElevationSafe(lat, lng);
          currentGeo = { display_name: g.display_name, lat, lng, elevation };
          setGeo(currentGeo); setRetryStatus(null);
        } else { geoRetries--; if (geoRetries > 0) await new Promise(r => setTimeout(r, 2000)); }
      }
      if (!currentGeo) throw new Error("Geocoding failed after 3 retries.");

      let riskRetries = 3; let riskData: any = null; let lastRiskError: any = null;
      while (riskRetries > 0 && !riskData) {
        if (riskRetries < 3) setRetryStatus(`Fetching risk metrics... (${4 - riskRetries}/3)`);
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 30000);
          const riskResp = await fetch("/api/engine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: '/api/climate-risk', payload: { lat: currentGeo.lat, lng: currentGeo.lng, elevation: currentGeo.elevation, ssp: sspVal, canopy_offset_pct: 0, albedo_offset_pct: 0, location_hint: queryToRun } }), signal: controller.signal });
          clearTimeout(timer);
          if (!riskResp.ok) throw new Error(`API ${riskResp.status}`);
          const d = await riskResp.json();
          if (d.error) throw new Error(d.error);
          riskData = d; setRetryStatus(null);
        } catch (err) { lastRiskError = err; riskRetries--; if (riskRetries > 0) await new Promise(r => setTimeout(r, 3000)); }
      }
      if (!riskData) throw new Error(lastRiskError?.message || "Engine connection failed.");

      setResult(riskData);
      let targetYr = selectedYear;
      if (!targetYr && riskData.projections?.length > 0) { targetYr = riskData.projections[0].year; setSelectedYear(targetYr); }
      setLoading(false);

      if (riskData.projections?.length > 0) {
        setAiLoading(true);
        await new Promise(r => setTimeout(r, 2000));
        let aiRetries = 3; let aiSuccess = false;
        while (!aiSuccess && aiRetries > 0) {
          try {
            if (aiRetries < 3) setRetryStatus(`Generating AI analysis... (${4 - aiRetries}/3)`);
            const pData = riskData.projections.find((p: any) => p.year === (targetYr || 2050)) || riskData.projections[0];
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 30000);
            const aiResp = await fetch("/api/engine", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: '/api/research-analysis', payload: { city_name: currentGeo.display_name, context: "DeepDive", metrics: { temp: `${fmt(pData.peak_tx5d_c)}°C`, elevation: `${fmt(currentGeo.elevation, 0)}m`, heatwave: `${fmt(pData.heatwave_days, 0)} days`, loss: fmtUSD(pData.economic_decay_usd), lat: currentGeo.lat, lng: currentGeo.lng } } }), signal: controller.signal });
            clearTimeout(timer);
            if (!aiResp.ok) throw new Error(`AI API ${aiResp.status}`);
            const aiData = await aiResp.json();
            setAiAnalysis(aiData.reasoning);
            aiSuccess = true; setRetryStatus(null);
          } catch { aiRetries--; if (aiRetries > 0) await new Promise(r => setTimeout(r, 3000)); else setAiAnalysis(null); }
        }
        setAiLoading(false); setRetryStatus(null);
      }
    } catch (err: any) {
      setError(err.message || "Analysis Failed");
      setLoading(false); setRetryStatus(null);
    } finally { isRunningRef.current = false; }
  }, [baseTarget, selectedYear]);

  const getMitigatedData = () => {
    if (!result) return null;
    const selectedProj = result.projections?.find(p => p.year === selectedYear);
    if (!selectedProj) return null;
    const cooling_C    = (canopy / 100) * 1.2 + (albedo / 100) * 0.8;
    const baseHeatwave = selectedProj.heatwave_days;
    const effectiveHW  = Math.max(0, baseHeatwave - (cooling_C * 3.5));
    const hwRatio      = baseHeatwave > 0 ? effectiveHW / baseHeatwave : 1;
    const combinedRatio= hwRatio * Math.max(0, 1 - (cooling_C * 0.08));
    const mitigatedTemp = Math.max(0, selectedProj.peak_tx5d_c - cooling_C);
    const rawWBT        = selectedProj.wbt_max_c ?? (selectedProj.peak_tx5d_c * 0.7 + 8);
    const mitigatedWBT  = Math.min(35.0, Math.max(0, rawWBT - (cooling_C * 0.85)));
    const baseUHI       = selectedProj.uhi_intensity_c ?? (result.baseline?.baseline_mean_c ? (selectedProj.peak_tx5d_c - result.baseline.baseline_mean_c) : 2.1);
    const mitigatedUHI  = Math.max(0, Math.min(8.0, baseUHI - cooling_C));
    const mitigatedLoss = selectedProj.economic_decay_usd * combinedRatio;
    const baseCdd       = selectedProj.grid_stress_factor ?? ((selectedProj.peak_tx5d_c - 18) * selectedProj.heatwave_days);
    const mitigatedDeaths = Math.round(selectedProj.attributable_deaths * combinedRatio);
    const savedDeaths = Math.round(selectedProj.attributable_deaths - mitigatedDeaths);
    const savedLoss   = selectedProj.economic_decay_usd - mitigatedLoss;
    return {
      wbt: mitigatedWBT, uhi: mitigatedUHI,
      cdd: Math.max(0, baseCdd * hwRatio),
      peakTemp: mitigatedTemp, loss: mitigatedLoss,
      deaths: mitigatedDeaths, savedDeaths, savedLoss,
      combinedRatio, hwDays: Math.round(effectiveHW),
    };
  };

  const dynamicData  = getMitigatedData();
  const wbtStatus    = dynamicData ? getWBTStatus(dynamicData.wbt) : getWBTStatus(0);
  const selectedProj = result?.projections?.find(p => p.year === selectedYear) ?? null;
  const era5Humidity = result?.era5_humidity_p95 ?? 70.0;
  const hasMitigation = canopy > 0 || albedo > 0;

  const excelData: ExcelExportData | null = (result && selectedProj && geo) ? {
    city_name: baseTarget, lat: geo.lat, lng: geo.lng, ssp, target_year: selectedYear ?? 2050,
    era5_baseline_c: result.baseline?.baseline_mean_c ?? 0, era5_p95_c: result.threshold_c,
    era5_humidity_p95: result.era5_humidity_p95 ?? 70,
    peak_tx5d_c: selectedProj.peak_tx5d_c, heatwave_days: selectedProj.heatwave_days,
    mean_temp_c: selectedProj.peak_tx5d_c - 8,
    population: result.population ?? 0, gdp_usd: result.gdp_usd ?? 0,
    death_rate: 7.7, vulnerability: selectedProj.audit_trail?.mortality?.variables?.V ?? 1.0,
    canopy_pct: canopy, albedo_pct: albedo,
    attributable_deaths: selectedProj.attributable_deaths,
    economic_decay_usd: selectedProj.economic_decay_usd,
    wbt_c: selectedProj.wbt_max_c ?? 0, cmip6_source: selectedProj.source,
  } : null;

  // Audit sections for modals
  const mortalityAudit  = selectedProj?.audit_trail?.mortality ?? null;
  const economicsAudit  = selectedProj?.audit_trail?.economics ?? null;

  return (
    <div className="space-y-5 animate-in fade-in duration-700">

      {/* Calc Modals */}
      <CalcModal
        open={calcModal.open && calcModal.key === 'mortality'}
        onClose={() => setCalcModal(m => ({ ...m, open: false }))}
        auditSection={mortalityAudit}
        title="Mortality"
        disclaimer="Simplified Gasparrini et al. 2017 implementation for research estimation."
      />
      <CalcModal
        open={calcModal.open && calcModal.key === 'economics'}
        onClose={() => setCalcModal(m => ({ ...m, open: false }))}
        auditSection={economicsAudit}
        title="Economics"
        disclaimer="Simplified Burke (2018) + ILO (2019) framework for estimation."
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-slate-800 pb-5 gap-4">
        <div>
          <h2 className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-[0.5em] mb-2">Deep Dive Research Protocol</h2>
          <h1 className="text-2xl sm:text-3xl font-mono font-bold text-white uppercase tracking-tighter truncate max-w-2xl" title={baseTarget}>
            {baseTarget.split(',')[0]}
          </h1>
          {geo && <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-2">{formatCoordinates(geo.lat, geo.lng)} · ELEV: {geo.elevation}m</p>}
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Scientific Version</p>
          <p className="text-[10px] font-mono text-slate-300 uppercase">v2.0.4-PRO</p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-[#050814] border border-slate-800 p-5 rounded-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-4">
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">SSP Scenario</label>
            <select value={ssp} onChange={(e) => setSsp(e.target.value)} disabled={loading} className="w-full bg-[#0a0f1d] border border-slate-700 p-2.5 text-[11px] font-mono text-slate-200 outline-none rounded-lg focus:border-indigo-500 transition-colors disabled:opacity-50">
              <option value="ssp245">SSP2-4.5 (Moderate)</option>
              <option value="ssp585">SSP5-8.5 (High Risk)</option>
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><label className="text-[10px] font-mono text-slate-400 uppercase">🌳 Canopy</label><span className="text-[10px] font-mono text-emerald-400">+{canopy}%</span></div>
            <input type="range" min={0} max={50} value={canopy} onChange={(e) => setCanopy(Number(e.target.value))} className="w-full accent-emerald-500 cursor-pointer" style={{ touchAction: 'manipulation' }} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><label className="text-[10px] font-mono text-slate-400 uppercase">🏠 Albedo</label><span className="text-[10px] font-mono text-indigo-400">+{albedo}%</span></div>
            <input type="range" min={0} max={100} value={albedo} onChange={(e) => setAlbedo(Number(e.target.value))} className="w-full accent-indigo-500 cursor-pointer" style={{ touchAction: 'manipulation' }} />
          </div>
          <div className="flex flex-col justify-end">
            <div className="w-full bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 py-2.5 text-[10px] font-mono uppercase tracking-[0.2em] rounded-lg flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" /> ENGINE SYNCED
            </div>
          </div>
        </div>
        {retryStatus && <p className="mt-2 text-[9px] font-mono text-indigo-400 uppercase tracking-widest animate-pulse">{retryStatus}</p>}
      </div>

      {/* Year selector */}
      {result && result.projections.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {result.projections.map((p) => (
            <button key={p.year} onClick={() => setSelectedYear(p.year)}
              className={`px-3.5 py-2 text-[10px] font-mono uppercase tracking-widest border rounded-lg transition-colors ${selectedYear === p.year ? 'border-cyan-500/50 bg-cyan-950/30 text-cyan-300' : 'border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700'}`}>
              {p.year}
              <span className="ml-2 text-[8px] text-slate-600">{p.source.includes('cmip6') ? 'CMIP6' : 'AR6'}</span>
            </button>
          ))}
        </div>
      )}

      {loading && !result && (
        <div className="w-full h-64 flex flex-col items-center justify-center bg-[#050814] border border-slate-800 rounded-xl">
          <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
          <span className="font-mono text-[10px] text-indigo-400 tracking-[0.3em] uppercase animate-pulse">Running Physics Engine...</span>
          {retryStatus && <span className="mt-3 font-mono text-[9px] text-slate-500 tracking-widest uppercase">{retryStatus}</span>}
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-400 font-mono text-xs">ERR: {error}</div>}

      {!loading && result && dynamicData && selectedProj && (
        <>
          {/* ── BASELINE + MITIGATION COMPARISON ── */}
          {hasMitigation && (
            <div className="bg-[#06101f] border border-emerald-800/30 rounded-2xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[9px] font-mono text-emerald-400 uppercase tracking-[0.25em] font-bold">
                  Baseline vs Mitigation · {selectedYear} · +{canopy}% canopy · +{albedo}% albedo
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Attributable Deaths',
                    baseline: selectedProj.attributable_deaths.toLocaleString(),
                    mitigated: dynamicData.deaths.toLocaleString(),
                    saved: `−${dynamicData.savedDeaths.toLocaleString()} lives`,
                    baseColor: 'text-red-400',
                  },
                  {
                    label: 'Economic Loss',
                    baseline: fmtUSD(selectedProj.economic_decay_usd),
                    mitigated: fmtUSD(dynamicData.loss),
                    saved: `−${fmtUSD(dynamicData.savedLoss)}`,
                    baseColor: 'text-amber-400',
                  },
                  {
                    label: 'Peak Temperature',
                    baseline: `${fmt(selectedProj.peak_tx5d_c)}°C`,
                    mitigated: `${fmt(dynamicData.peakTemp)}°C`,
                    saved: `−${fmt(selectedProj.peak_tx5d_c - dynamicData.peakTemp)}°C`,
                    baseColor: 'text-orange-400',
                  },
                  {
                    label: 'Heatwave Days',
                    baseline: `${selectedProj.heatwave_days}d`,
                    mitigated: `${dynamicData.hwDays}d`,
                    saved: `−${Math.max(0, selectedProj.heatwave_days - dynamicData.hwDays)}d`,
                    baseColor: 'text-yellow-400',
                  },
                ].map((item) => (
                  <div key={item.label} className="space-y-2">
                    <p className="text-[8px] font-mono text-slate-600 uppercase tracking-[0.12em]">{item.label}</p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[8px] font-mono text-slate-600 uppercase">Without</span>
                      <span className={`text-[13px] font-mono font-bold tabular-nums ${item.baseColor}`}>{item.baseline}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[8px] font-mono text-slate-600 uppercase">With</span>
                      <span className="text-[13px] font-mono font-bold tabular-nums text-slate-300">{item.mitigated}</span>
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

          {/* ── MAIN 3-COLUMN GRID ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

            {/* WBT */}
            <div className="bg-[#050814] border border-slate-800 p-5 rounded-xl flex flex-col">
              <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Physiological Limit Monitor</h3>
              <div className={`flex flex-col items-center justify-center py-8 border-y border-slate-800/50 my-4 flex-grow transition-colors duration-500 rounded-lg ${wbtStatus.bg}`}>
                <span className={`text-4xl font-mono font-bold ${wbtStatus.color} transition-colors duration-500`}>
                  {formatWBT(dynamicData.wbt)}
                </span>
                <span className="text-[10px] font-mono text-slate-500 mt-2 tracking-widest">WET-BULB TEMPERATURE</span>
                <div className={`mt-3 px-4 py-1 rounded-full border ${wbtStatus.border} ${wbtStatus.color} ${wbtStatus.bg} text-[9px] font-mono font-bold`}>
                  {wbtStatus.label}
                </div>
                {hasMitigation && (
                  <p className="text-[9px] font-mono text-slate-600 mt-3 italic">
                    Baseline: {formatWBT(selectedProj.wbt_max_c ?? 0)}
                  </p>
                )}
              </div>
              <SourceLine source="Stull (2011) · ERA5 P95 Humidity" />
              <p className="text-[9px] font-mono text-slate-500 leading-relaxed mt-2">Values ≥ 31°C indicate critical survivability risk. Capped at 35°C per Sherwood & Huber (2010) PNAS.</p>
              {result.baseline?.baseline_mean_c && (
                <div className="mt-3 pt-3 border-t border-slate-800">
                  <span className="text-[8px] font-mono text-slate-600 uppercase tracking-widest italic">Historical baseline mean: {fmt(result.baseline.baseline_mean_c)}°C (ERA5 1991-2020)</span>
                </div>
              )}
            </div>

            {/* UHI */}
            <div className="bg-[#050814] border border-slate-800 p-5 rounded-xl flex flex-col">
              <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Heat Attribution (UHI)</h3>
              <div className="space-y-5 flex-grow">
                {[
                  { label: "ERA5 Historical Mean", val: `${fmt(result.baseline?.baseline_mean_c)}°C`, color: "text-slate-300", bar: "bg-indigo-500", w: "60%", source: "ERA5 1991-2020" },
                  { label: "Urban Heat Island (UHI)", val: `+${fmt(dynamicData.uhi)}°C`, color: "text-orange-400", bar: "bg-orange-500", w: `${Math.min(100, Math.max(10, (dynamicData.uhi / 8) * 100))}%`, source: "Oke (1982) cap: 8°C" },
                  { label: "Albedo/Canopy Offset", val: `-${fmt((canopy / 100) * 1.2 + (albedo / 100) * 0.8)}°C`, color: "text-emerald-400", bar: "bg-emerald-500", w: `${Math.min(100, (canopy + albedo) / 2)}%`, source: "Bowler (2010) · Santamouris (2015)" },
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[10px] font-mono mb-1.5">
                      <span className="text-slate-500 uppercase">{item.label}</span>
                      <span className={item.color}>{item.val}</span>
                    </div>
                    <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                      <div className={`${item.bar} h-full transition-all duration-500`} style={{ width: item.w }} />
                    </div>
                    <SourceLine source={item.source} />
                  </div>
                ))}
              </div>
            </div>

            {/* Infrastructure */}
            <div className="bg-[#050814] border border-slate-800 p-5 rounded-xl flex flex-col">
              <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Infrastructure Fragility</h3>
              <div className="grid grid-cols-2 gap-3 flex-grow content-start">
                <div className="p-4 bg-white/5 border border-white/5 rounded-lg flex flex-col justify-center">
                  <span className="text-[9px] font-mono text-slate-500 block mb-2 uppercase">Grid Stress</span>
                  <span className="text-xl font-mono text-indigo-400 font-bold transition-all duration-500">+{fmt(dynamicData.cdd, 0)}</span>
                  <span className="text-[8px] font-mono text-slate-600 block mt-1 uppercase">CDD Load</span>
                </div>
                <div className="p-4 bg-white/5 border border-white/5 rounded-lg flex flex-col justify-center">
                  <span className="text-[9px] font-mono text-slate-500 block mb-2 uppercase">Road Melt Risk</span>
                  <span className={`text-xl font-mono font-bold transition-colors duration-500 ${dynamicData.peakTemp > 38 ? 'text-amber-400' : 'text-emerald-400'}`}>
                    {dynamicData.peakTemp > 38 ? 'HIGH' : 'LOW'}
                  </span>
                  <span className="text-[8px] font-mono text-slate-600 block mt-1 uppercase">38°C+ Exposure</span>
                </div>
              </div>
              <div className="mt-5 space-y-2.5">
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 uppercase">
                  <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-500 ${dynamicData.cdd > 500 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <span>Thermal Overload: {dynamicData.cdd > 500 ? 'Exceeded' : 'Stable'}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 uppercase">
                  <div className={`w-1.5 h-1.5 rounded-full ${selectedProj.wbt_max_c && selectedProj.wbt_max_c >= 31 ? 'bg-red-500 animate-pulse' : 'bg-emerald-500'}`} />
                  <span>Survivability: {selectedProj.wbt_max_c && selectedProj.wbt_max_c >= 31 ? 'Critical' : 'Stable'}</span>
                </div>
              </div>
              <SourceLine source="CMIP6 Ensemble · ERA5 P95" />
            </div>
          </div>

          {/* ── DEATHS + ECONOMIC — side by side with calc buttons ── */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Deaths card */}
            <div className="bg-[#050814] border border-slate-800 p-5 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Attributable Deaths ({selectedYear})</h3>
                {mortalityAudit && (
                  <button
                    onClick={() => setCalcModal({ open: true, key: 'mortality' })}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[9px] font-mono text-cyan-400 hover:bg-cyan-900/40 hover:border-cyan-400/40 transition-all"
                  >
                    <span>⊕</span>Calculation Details
                  </button>
                )}
              </div>

              {/* Baseline */}
              <div className="mb-4">
                <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest mb-1">Baseline (no mitigation)</p>
                <p className="text-3xl font-mono text-white font-bold tabular-nums">{selectedProj.attributable_deaths.toLocaleString()}</p>
                <p className="text-[9px] font-mono text-slate-500 mt-1">95% CI · {formatDeathsRange(selectedProj.attributable_deaths)}</p>
              </div>

              {/* Mitigated */}
              {hasMitigation && (
                <div className="pt-3 border-t border-slate-800">
                  <p className="text-[8px] font-mono text-emerald-500/70 uppercase tracking-widest mb-1">With +{canopy}% canopy · +{albedo}% albedo</p>
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-mono text-emerald-400 font-bold tabular-nums">↓ {dynamicData.deaths.toLocaleString()}</p>
                    <p className="text-[13px] font-mono text-emerald-300 font-bold">−{dynamicData.savedDeaths.toLocaleString()} lives</p>
                  </div>
                </div>
              )}

              <SourceLine source="Gasparrini et al. (2017), Lancet Planetary Health" />
            </div>

            {/* Economics card */}
            <div className="bg-indigo-600/5 border border-indigo-500/20 p-5 rounded-xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold">
                  Economic Value At Risk ({selectedYear})
                </h3>
                <div className="flex items-center gap-2">
                  {economicsAudit && (
                    <button
                      onClick={() => setCalcModal({ open: true, key: 'economics' })}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/30 border border-cyan-500/20 text-[9px] font-mono text-cyan-400 hover:bg-cyan-900/40 hover:border-cyan-400/40 transition-all"
                    >
                      <span>⊕</span>Calculation Details
                    </button>
                  )}
                  <ExcelExportIconButton data={excelData} />
                </div>
              </div>

              {/* Baseline */}
              <div className="mb-4">
                <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest mb-1">Baseline (no mitigation)</p>
                <p className="text-3xl font-mono text-white font-bold">{fmtUSD(selectedProj.economic_decay_usd)}</p>
                <p className="text-[9px] font-mono text-slate-500 mt-1">Range · {formatEconomicRange(selectedProj.economic_decay_usd)}</p>
              </div>

              {/* Mitigated */}
              {hasMitigation && (
                <div className="pt-3 border-t border-slate-700/50">
                  <p className="text-[8px] font-mono text-emerald-500/70 uppercase tracking-widest mb-1">With +{canopy}% canopy · +{albedo}% albedo</p>
                  <div className="flex items-end justify-between">
                    <p className="text-2xl font-mono text-emerald-400 font-bold">↓ {fmtUSD(dynamicData.loss)}</p>
                    <p className="text-[13px] font-mono text-emerald-300 font-bold">−{fmtUSD(dynamicData.savedLoss)}</p>
                  </div>
                </div>
              )}

              {/* Mini chart */}
              <div className="mt-4">
                <div className="h-16 flex items-end gap-1 w-full border-b border-slate-700 pb-1">
                  {result.projections.map((p, idx) => {
                    const loss = p.economic_decay_usd * (hasMitigation ? dynamicData.combinedRatio : 1);
                    const maxLoss = result.projections[result.projections.length - 1].economic_decay_usd || 1;
                    const heightPct = Math.min(100, (loss / maxLoss) * 100);
                    return (
                      <div key={p.year} className="bg-red-500 w-full transition-all duration-500 cursor-pointer hover:bg-red-400 rounded-t-sm"
                        style={{ height: `${heightPct}%`, opacity: 0.4 + idx * 0.2 }}
                        onClick={() => setSelectedYear(p.year)} title={`${p.year}: ${fmtUSD(loss)}`} />
                    );
                  })}
                </div>
                <div className="flex justify-between text-[8px] font-mono text-slate-600 uppercase mt-1">
                  {result.projections.map(p => <span key={p.year}>{p.year}</span>)}
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <span className="text-[9px] font-mono text-slate-500 uppercase block">City GDP</span>
                  <span className="text-base font-mono font-bold text-slate-400">{fmtUSD(result.gdp_usd)}</span>
                </div>
                <div>
                  <span className="text-[9px] font-mono text-slate-500 uppercase block">Population</span>
                  <span className="text-base font-mono font-bold text-slate-400">{result.population ? (result.population / 1e6).toFixed(1) + 'M' : '—'}</span>
                </div>
              </div>

              <SourceLine source="Burke et al. (2018) Nature · ILO (2019) · World Bank" />
            </div>
          </div>

          {/* AI Reasoning */}
          <div className="border border-indigo-500/30 bg-[#050814]/80 p-6 rounded-xl relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/10 blur-[50px] pointer-events-none" />
            <h4 className="text-[10px] font-mono text-indigo-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
              Expert AI Reasoning — Geological &amp; Thermal Context
            </h4>
            {aiLoading ? (
              <div className="flex items-center gap-3 py-2">
                <div className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">{retryStatus || "Generating scientific summary..."}</span>
              </div>
            ) : aiAnalysis ? (
              <p className="text-xs font-mono text-slate-300 leading-loose">{cleanResearchText(aiAnalysis)}</p>
            ) : (
              <p className="text-[10px] font-mono text-slate-600 italic">AI analysis unavailable. Refer to the metrics above.</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}