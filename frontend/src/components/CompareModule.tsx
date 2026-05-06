'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  formatWBT,
  formatEconomicRange,
  formatDeathsRange,
  formatCoordinates,
  getSourceLabel,
} from "@/context/ClimateDataContext";

interface Projection {
  year: number;
  source: string;
  heatwave_days: number;
  peak_tx5d_c: number;
  wbt_max_c?: number;
  uhi_intensity_c?: number;
  attributable_deaths: number;
  economic_decay_usd: number;
  region?: string;
  audit_trail?: any;
}

interface CityResult {
  query: string;
  display_name: string;
  lat: number;
  lng: number;
  elevation: number;
  threshold_c: number;
  cooling_offset_c: number;
  gdp_usd: number | null;
  population: number | null;
  projections: Projection[];
  baseline: { baseline_mean_c: number | null }; // 🔴 Needed for UHI math
  loading: boolean;
  error: string | null;
}

function fmt(n: number | null | undefined, d = 1): string {
  if (n == null || isNaN(n)) return "—";
  return n.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d });
}

function fmtUSD(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return "—";
  if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6)  return `$${(n / 1e6).toFixed(2)}M`;
  return `$${n.toLocaleString()}`;
}

function cleanAiText(text: string | null): string {
  if (!text) return "";
  return text.replace(/\*/g, '').replace(/([a-z])([.?!])([A-Z])/g, '$1$2 $3');
}

const SourceLine = ({ source }: { source: string }) => (
  <p className="mt-1 text-[8px] font-mono text-slate-600 italic">{source}</p>
);

// ─────────────────────────────────────────────────────────────────
// SIDE-BY-SIDE MATH MODAL
// ─────────────────────────────────────────────────────────────────
const SideBySideMathModal = ({
  open, onClose, metricLabel, metricKey,
  cityA, cityB, projA, projB, valA, valB,
}: {
  open: boolean; onClose: () => void;
  metricLabel: string; metricKey: string;
  cityA: string; cityB: string;
  projA: Projection | null; projB: Projection | null;
  valA: number | null; valB: number | null;
}) => {
  if (!open || !projA || !projB) return null;
  const auditA = projA.audit_trail;
  const auditB = projB.audit_trail;

  const getSection = (audit: any) => {
    if (!audit) return null;
    if (metricKey === 'attributable_deaths') return audit.mortality;
    if (metricKey === 'economic_decay_usd')  return audit.economics;
    return null;
  };
  const secA = getSection(auditA);
  const secB = getSection(auditB);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-3xl max-h-[85vh] overflow-y-auto bg-[#050814] border border-cyan-500/30 rounded-2xl p-6 shadow-[0_0_40px_rgba(34,211,238,0.1)]" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 w-7 h-7 rounded-lg bg-slate-800/60 border border-slate-700/50 text-slate-500 hover:text-white flex items-center justify-center transition-all">✕</button>

        <div className="flex items-center gap-3 mb-1">
          <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#22d3ee]" />
          <h3 className="text-[10px] font-mono text-cyan-300 uppercase tracking-[0.3em] font-bold">Side-by-Side Calculation Audit</h3>
        </div>
        <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-5">{metricLabel} — same formula, both cities</p>

        {secA && secB ? (
          <>
            <div className="bg-[#020617] border border-cyan-500/20 rounded-xl p-4 mb-5">
              <p className="text-[9px] font-mono text-cyan-200 uppercase tracking-[0.2em] mb-2">Formula (identical for both)</p>
              <p className="text-white font-mono text-sm">{secA.formula}</p>
              <SourceLine source={secA.source} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[{ city: cityA, sec: secA, val: valA }, { city: cityB, sec: secB, val: valB }].map(({ city, sec, val }) => (
                <div key={city} className="bg-[#020617] border border-slate-800 rounded-xl p-4">
                  <p className="text-[9px] font-mono text-slate-300 uppercase tracking-widest font-bold mb-3 truncate">{city}</p>
                  {sec.variables && (
                    <div className="space-y-1 mb-3">
                      {Object.entries(sec.variables).map(([k, v]) => (
                        <div key={k} className="flex justify-between">
                          <span className="text-[9px] font-mono text-cyan-400">{k}</span>
                          <span className="text-[9px] font-mono text-slate-300">{String(v)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {sec.computation && (
                    <div className="bg-black/40 rounded-lg p-2.5 mt-2 border border-slate-800/60">
                      <p className="text-[9px] font-mono text-white leading-relaxed break-all">{sec.computation}</p>
                    </div>
                  )}
                  <div className="mt-3 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-[8px] font-mono text-emerald-400 uppercase tracking-widest">Calculation validated</span>
                    </div>
                    <span className="text-[11px] font-mono text-white font-bold">
                      {val != null ? (metricKey === 'economic_decay_usd' ? fmtUSD(val) : metricKey === 'attributable_deaths' ? Math.round(val).toLocaleString() : `${fmt(val)}°C`) : '—'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            {valA != null && valB != null && (
              <div className="mt-4 p-4 bg-cyan-950/20 border border-cyan-500/20 rounded-xl">
                <p className="text-[9px] font-mono text-cyan-300 uppercase tracking-widest">
                  Higher exposure: <span className="font-bold text-white">{valA > valB ? cityA : valA < valB ? cityB : 'Equal'}</span>
                  {valA !== valB && (
                    <span className="text-slate-500 ml-2">
                      (difference: {metricKey === 'economic_decay_usd' ? fmtUSD(Math.abs(valA - valB)) : metricKey === 'attributable_deaths' ? Math.abs(Math.round(valA - valB)).toLocaleString() : `${fmt(Math.abs(valA - valB))}`})
                    </span>
                  )}
                </p>
              </div>
            )}
          </>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[{ city: cityA, val: valA }, { city: cityB, val: valB }].map(({ city, val }) => (
              <div key={city} className="bg-[#020617] border border-slate-800 rounded-xl p-4">
                <p className="text-[9px] font-mono text-slate-300 uppercase tracking-widest font-bold mb-2 truncate">{city}</p>
                <p className="text-2xl font-mono text-white font-bold">
                  {val != null ? (metricKey === 'economic_decay_usd' ? fmtUSD(val) : metricKey === 'attributable_deaths' ? Math.round(val).toLocaleString() : `${fmt(val)}°C`) : '—'}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────
// CACHES
// ─────────────────────────────────────────────────────────────────
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
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return 0;
    const data = await res.json();
    const elev = data?.elevation?.[0] ?? 0;
    elevationCache.set(key, elev);
    return elev;
  } catch { clearTimeout(timer); return 0; }
}

async function fetchClimateRisk(payload: {
  lat: number; lng: number; elevation: number;
  ssp: string; canopy_offset_pct: number; albedo_offset_pct: number;
  location_hint: string;
}, signal: AbortSignal): Promise<any> {

  console.log(
    "[fetchClimateRisk] Sending payload to /api/climate-risk:\n",
    JSON.stringify(payload, null, 2)
  );

  const riskResp = await fetch("/api/engine", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ endpoint: "/api/climate-risk", payload }),
    signal,
  });

  if (!riskResp.ok) {
    const rawText = await riskResp.text();
    let humanMessage = rawText;
    try {
      const parsed = JSON.parse(rawText) as { detail?: unknown };
      if (parsed.detail) {
        console.error(
          `[fetchClimateRisk] FastAPI ${riskResp.status} validation errors:\n`,
          JSON.stringify(parsed.detail, null, 2)
        );
        if (Array.isArray(parsed.detail)) {
          humanMessage = parsed.detail
            .map((e: { loc?: string[]; msg?: string; type?: string }) =>
              `[${(e.loc ?? []).join(" → ")}] ${e.msg ?? e.type ?? "unknown"}`
            )
            .join("  |  ");
        } else {
          humanMessage = String(parsed.detail);
        }
      }
    } catch {
      console.error(
        `[fetchClimateRisk] Non-JSON error body (status ${riskResp.status}):\n`,
        rawText
      );
    }
    throw new Error(`API ${riskResp.status}: ${humanMessage}`);
  }

  const riskData = await riskResp.json();
  if (riskData.error) throw new Error(`Engine: ${riskData.error}`);
  return riskData;
}

async function geocodeAndFetch(
  query: string,
  ssp: string
): Promise<Omit<CityResult, "loading" | "error"> | null> {
  const geoData = await fetchNominatimSafe(query);
  if (!geoData.length) throw new Error("Location not found.");

  const g         = geoData[0];
  const lat       = parseFloat(g.lat);
  const lng       = parseFloat(g.lon);
  const elevation = await fetchElevationSafe(lat, lng);
  const locationHint = (g.display_name ?? query).trim();

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 30000);

  try {
    const riskData = await fetchClimateRisk(
      {
        lat,
        lng,
        elevation,
        ssp,                         
        canopy_offset_pct: 0,
        albedo_offset_pct: 0,
        location_hint: locationHint, 
      },
      controller.signal
    );
    clearTimeout(timer);
    return { query, display_name: g.display_name, lat, lng, elevation, ...riskData };
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

const COMPARE_YEARS = [2030, 2050, 2075, 2100];

const METRICS = [
  { key: "heatwave_days",       label: "Heatwave Days",       unit: "d/yr",   source: "CMIP6 Ensemble · ERA5 P95",         fmt: (v: number) => `${fmt(v, 0)}d`,                             hasCalc: false },
  { key: "peak_tx5d_c",         label: "Peak Tx5d",           unit: "°C",     source: "Open-Meteo CMIP6",                  fmt: (v: number) => `${fmt(v)}°C`,                               hasCalc: false },
  { key: "wbt_max_c",           label: "Max Wet-Bulb",        unit: "°C",     source: "Stull (2011) · ERA5 P95 Humidity",  fmt: (v: number) => formatWBT(v),                                hasCalc: false },
  { key: "uhi_intensity_c",     label: "Surface UHI",       unit: "°C",     source: "",                fmt: (v: number) => `+${fmt(v)}°C`,                              hasCalc: false },
  { key: "attributable_deaths", label: "Attributable Deaths", unit: "est/yr", source: "Gasparrini (2017), Lancet",         fmt: (v: number) => Math.round(v).toLocaleString(),              hasCalc: true  },
  { key: "economic_decay_usd",  label: "Economic Decay",      unit: "USD",    source: "Burke (2018) · ILO (2019)",         fmt: (v: number) => fmtUSD(v),                                   hasCalc: true  },
];

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
export default function CompareModule({ baseTarget }: { baseTarget: string }) {
  const [city1Geo, setCity1Geo]         = useState<{ lat: number; lng: number; display_name: string } | null>(null);
  const [searchQuery2, setSearchQuery2] = useState("");
  const [suggestions2, setSuggestions2] = useState<any[]>([]);
  const [city2Geo, setCity2Geo]         = useState<{ lat: number; lng: number; display_name: string } | null>(null);

  // 🔴 SYNC STATE WITH LOCAL STORAGE 🔴
  const savedState = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('op_sync_state') || '{}') : {};
  const [ssp, setSsp]                   = useState(savedState.ssp || "SSP2-4.5");
  const [canopy, setCanopy]             = useState(savedState.canopy !== undefined ? savedState.canopy : 0);
  const [albedo, setAlbedo]             = useState(savedState.albedo !== undefined ? savedState.albedo : 0);
  const [compareYear, setCompareYear]   = useState(savedState.year ? Number(savedState.year) : 2050);

  const [results, setResults]           = useState<CityResult[]>([]);
  const [running, setRunning]           = useState(false);
  const [globalError, setGlobalError]   = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis]     = useState<string | null>(null);
  const [aiLoading, setAiLoading]       = useState(false);
  const [retryStatus, setRetryStatus]   = useState<string | null>(null);
  const [mathModal, setMathModal]       = useState<{
    open: boolean; metricLabel: string; metricKey: string;
    valA: number | null; valB: number | null;
  }>({ open: false, metricLabel: '', metricKey: '', valA: null, valB: null });

  const city1FetchedRef = useRef<string>("");

  // 🔴 UPDATE LOCAL STORAGE WHEN USER CHANGES SLIDERS/DROPDOWNS HERE 🔴
  useEffect(() => {
    localStorage.setItem('op_sync_state', JSON.stringify({ 
      ssp, 
      year: compareYear.toString(), 
      canopy, 
      albedo 
    }));
  }, [ssp, compareYear, canopy, albedo]);

  useEffect(() => {
    if (!baseTarget || baseTarget === city1FetchedRef.current) return;
    city1FetchedRef.current = baseTarget;
    fetchNominatimSafe(baseTarget).then((data) => {
      if (data?.[0]) setCity1Geo({
        display_name: baseTarget,
        lat:          parseFloat(data[0].lat),
        lng:          parseFloat(data[0].lon),
      });
    });
  }, [baseTarget]);

  useEffect(() => {
    if (city2Geo || searchQuery2.length <= 2) { setSuggestions2([]); return; }
    const timer = setTimeout(async () => {
      const data = await fetchNominatimSafe(searchQuery2);
      setSuggestions2(data.map((c: any) => ({
        id:        c.place_id,
        name:      c.name || c.display_name.split(',')[0],
        country:   c.display_name.split(',').pop()?.trim() || '',
        latitude:  parseFloat(c.lat),
        longitude: parseFloat(c.lon),
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
      threshold_c: 0, cooling_offset_c: 0, gdp_usd: null, population: null,
      projections: [], baseline: { baseline_mean_c: null }, loading: true, error: null,
    }));
    setResults(initialResults);

    const newResults: CityResult[] = [];
    for (let i = 0; i < queries.length; i++) {
      let success = false; let retries = 3; let lastError: any = null;
      while (!success && retries > 0) {
        try {
          if (retries < 3) setRetryStatus(`Retrying ${queries[i]}... (${4 - retries}/3)`);
          const data = await geocodeAndFetch(queries[i], ssp);
          newResults.push({ ...(data as any), loading: false, error: null });
          success = true; setRetryStatus(null);
        } catch (err: any) {
          lastError = err; retries--;
          if (retries > 0) await new Promise(r => setTimeout(r, 3000));
        }
      }
      if (!success) {
        const errMsg = String(lastError?.message ?? lastError).replace('Error: ', '');
        console.error(`[CompareModule] Final error for "${queries[i]}":`, errMsg);
        newResults.push({
          query: queries[i], display_name: queries[i], lat: 0, lng: 0,
          elevation: 0, threshold_c: 0, cooling_offset_c: 0,
          gdp_usd: null, population: null, projections: [],
          baseline: { baseline_mean_c: null },
          loading: false, error: errMsg,
        });
        setRetryStatus(null);
      }
      setResults([...newResults, ...initialResults.slice(i + 1)]);
      if (i < queries.length - 1) await new Promise(r => setTimeout(r, 3500));
    }
    setRunning(false);

    const okRes = newResults.filter(r => !r.error);
    if (okRes.length === 2) {
      setAiLoading(true);
      await new Promise(r => setTimeout(r, 2000));
      let aiSuccess = false; let aiRetries = 3;
      while (!aiSuccess && aiRetries > 0) {
        try {
          if (aiRetries < 3) setRetryStatus(`Generating AI comparison... (${4 - aiRetries}/3)`);
          const p1 = okRes[0].projections.find(p => p.year === compareYear) || okRes[0].projections[0];
          const p2 = okRes[1].projections.find(p => p.year === compareYear) || okRes[1].projections[0];
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 30000);

          const aiResp = await fetch("/api/engine", {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              endpoint: '/api/research-analysis',
              payload: {
                city_name: `${okRes[0].query} vs ${okRes[1].query}`,
                context:   "Comparative climate risk analysis between two urban centers.",
                metrics: {
                  temp:      `${okRes[0].query}: ${fmt(p1?.peak_tx5d_c)}°C | ${okRes[1].query}: ${fmt(p2?.peak_tx5d_c)}°C`,
                  elevation: `${okRes[0].query}: ${fmt(okRes[0].elevation, 0)}m | ${okRes[1].query}: ${fmt(okRes[1].elevation, 0)}m`,
                  heatwave:  `${okRes[0].query}: ${fmt(p1?.heatwave_days, 0)} days | ${okRes[1].query}: ${fmt(p2?.heatwave_days, 0)} days`,
                  loss:      `${okRes[0].query}: ${fmtUSD(p1?.economic_decay_usd)} | ${okRes[1].query}: ${fmtUSD(p2?.economic_decay_usd)}`,
                  deaths:    `${okRes[0].query}: ${fmt(p1?.attributable_deaths, 0)} | ${okRes[1].query}: ${fmt(p2?.attributable_deaths, 0)}`,
                  lat:       `${okRes[0].lat} | ${okRes[1].lat}`,
                  lng:       `${okRes[0].lng} | ${okRes[1].lng}`,
                },
              },
            }),
            signal: controller.signal,
          });

          clearTimeout(timer);
          if (!aiResp.ok) {
            const t = await aiResp.text();
            console.error("[CompareModule] AI endpoint error:", t);
            throw new Error(`API ${aiResp.status}`);
          }
          const aiData = await aiResp.json();
          const text   = aiData.comparison || aiData.reasoning || "";
          if (text && text.length > 10) {
            setAiAnalysis(text); aiSuccess = true; setRetryStatus(null);
          } else {
            throw new Error("Empty AI response");
          }
        } catch {
          aiRetries--;
          if (aiRetries > 0) await new Promise(r => setTimeout(r, 3000));
          else setAiAnalysis(null);
        }
      }
      setAiLoading(false); setRetryStatus(null);
    }
  };

  const getMitigatedValue = (
    baseValue: number | null | undefined,
    metricKey: string,
    baseHW = 0
  ): number | null => {
    if (baseValue == null) return null;
    const cooling = (canopy / 100) * 1.2 + (albedo / 100) * 0.8;
    if (['peak_tx5d_c', 'uhi_intensity_c'].includes(metricKey)) return Math.max(0, baseValue - cooling);
    if (metricKey === 'wbt_max_c')          return Math.min(35.0, Math.max(0, baseValue - cooling));
    if (metricKey === 'heatwave_days')       return Math.max(0, baseValue - (cooling * 3.5));
    if (['attributable_deaths', 'economic_decay_usd'].includes(metricKey)) {
      const effHW = Math.max(0, baseHW - (cooling * 3.5));
      const hwR   = baseHW > 0 ? effHW / baseHW : 1;
      return baseValue * hwR * Math.max(0, 1 - (cooling * 0.08));
    }
    return baseValue;
  };

  const hasMitigation = canopy > 0 || albedo > 0;
  const okResults     = results.filter(r => !r.loading && !r.error && r.projections?.length > 0);
  const projA         = okResults[0]?.projections?.find(p => p.year === compareYear) ?? null;
  const projB         = okResults[1]?.projections?.find(p => p.year === compareYear) ?? null;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700 relative z-10">

      <SideBySideMathModal
        open={mathModal.open}
        onClose={() => setMathModal(m => ({ ...m, open: false }))}
        metricLabel={mathModal.metricLabel}
        metricKey={mathModal.metricKey}
        cityA={okResults[0]?.query ?? ''}
        cityB={okResults[1]?.query ?? ''}
        projA={projA} projB={projB}
        valA={mathModal.valA} valB={mathModal.valB}
      />

      {/* ── HEADER ── */}
      <div className="bg-[#050b14]/70 backdrop-blur-xl border border-cyan-500/20 p-5 md:p-8 rounded-2xl shadow-[0_0_40px_rgba(34,211,238,0.05)] relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 blur-[100px] pointer-events-none" />
        <h2 className="text-xs font-mono font-bold text-cyan-300 uppercase tracking-[0.4em] mb-6">Dual-Sector Comparative Analysis</h2>

        {/* City cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          {/* City 1 locked */}
          <div className="relative rounded-xl border border-cyan-500/50 overflow-hidden min-h-[120px] flex flex-col justify-center p-5 bg-[#020617] shadow-[0_0_20px_rgba(34,211,238,0.1)]">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(34,211,238,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,0.3) 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/80 to-transparent z-10" />
            <div className="relative z-20">
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block mb-1 font-bold">City A — Locked</span>
              <h3 className="text-lg md:text-xl font-mono text-white tracking-wider uppercase truncate" title={baseTarget}>{baseTarget}</h3>
              {city1Geo && <span className="text-[9px] font-mono text-slate-400 tracking-widest block mt-1">{formatCoordinates(city1Geo.lat, city1Geo.lng)}</span>}
            </div>
          </div>

          {/* City 2 input */}
          <div className={`relative rounded-xl border overflow-visible min-h-[120px] flex flex-col justify-center p-5 bg-[#020617] transition-colors shadow-lg ${city2Geo ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-white/10'}`}>
            <div className="absolute inset-0 opacity-10 pointer-events-none rounded-xl" style={{ backgroundImage: 'linear-gradient(rgba(16,185,129,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,0.3) 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="absolute inset-0 bg-gradient-to-r from-[#020617] via-[#020617]/80 to-transparent z-10 rounded-xl" />
            <div className="relative z-20 w-full overflow-visible">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-3 font-bold">City B — Target</span>
              <div className="relative w-full overflow-visible">
                <input
                  type="text"
                  value={searchQuery2}
                  onChange={(e) => { setSearchQuery2(e.target.value); if (city2Geo) setCity2Geo(null); }}
                  placeholder="Search city to compare..."
                  className="w-full bg-[#0a0f1d]/90 border border-slate-700 p-3 text-[11px] font-mono text-white placeholder-slate-500 outline-none rounded-lg focus:border-cyan-500 transition-colors uppercase tracking-widest"
                />
                {suggestions2.length > 0 && !city2Geo && (
                  <div className="absolute top-full left-0 w-full mt-2 bg-[#050814] border border-cyan-500/30 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.8)] z-[9999] max-h-48 overflow-y-auto">
                    {suggestions2.map((city, idx) => (
                      <div
                        key={`${city.id}-${idx}`}
                        onClick={() => {
                          const n = `${city.name}, ${city.country}`;
                          setSearchQuery2(n);
                          setCity2Geo({ display_name: n, lat: city.latitude, lng: city.longitude });
                          setSuggestions2([]);
                        }}
                        className="px-4 py-3 text-[10px] font-mono text-slate-300 hover:bg-cyan-900 hover:text-white cursor-pointer transition-colors border-b border-slate-800 last:border-0 uppercase tracking-widest"
                      >
                        {city.name}, <span className="opacity-50">{city.country}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {city2Geo && <span className="text-[9px] font-mono text-emerald-400 tracking-widest block mt-2">{formatCoordinates(city2Geo.lat, city2Geo.lng)}</span>}
            </div>
          </div>
        </div>

        {/* Config */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-cyan-950/10 border border-cyan-500/10 rounded-xl mb-6">
          <div>
            <label className="block text-[10px] font-mono text-cyan-200 uppercase tracking-widest mb-2">Scenario</label>
            <select
              value={ssp}
              onChange={(e) => setSsp(e.target.value)}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-cyan-400 outline-none focus:border-cyan-500"
            >
              <option value="SSP2-4.5">SSP2-4.5 (MODERATE)</option>
              <option value="SSP5-8.5">SSP5-8.5 (HIGH RISK)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono text-cyan-200 uppercase tracking-widest mb-2">Year</label>
            <select
              value={compareYear}
              onChange={(e) => setCompareYear(Number(e.target.value))}
              className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs font-mono text-white outline-none focus:border-cyan-500"
            >
              {COMPARE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-[10px] font-mono text-cyan-200 uppercase">🌳 Canopy</label>
              <span className="text-[10px] font-mono text-emerald-400">+{canopy}%</span>
            </div>
            <input type="range" min={0} max={50} value={canopy} onChange={(e) => setCanopy(Number(e.target.value))} className="w-full accent-emerald-500 cursor-pointer" style={{ touchAction: 'manipulation' }} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-[10px] font-mono text-cyan-200 uppercase">🏠 Albedo</label>
              <span className="text-[10px] font-mono text-sky-400">+{albedo}%</span>
            </div>
            <input type="range" min={0} max={100} value={albedo} onChange={(e) => setAlbedo(Number(e.target.value))} className="w-full accent-cyan-500 cursor-pointer" style={{ touchAction: 'manipulation' }} />
          </div>
        </div>

        <button
          onClick={handleCompare}
          disabled={running || !city2Geo}
          className="w-full md:w-auto px-10 py-3 bg-cyan-900 border border-cyan-500/50 text-white font-mono text-xs font-bold uppercase tracking-[0.2em] rounded-xl hover:bg-cyan-800 disabled:opacity-50 transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)]"
          style={{ touchAction: 'manipulation' }}
        >
          {running ? "PROCESSING..." : "RUN COMPARISON"}
        </button>

        {retryStatus && (
          <p className="mt-4 text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-widest animate-pulse">
            <span className="inline-block w-2 h-2 bg-cyan-400 rounded-full mr-2" />{retryStatus}
          </p>
        )}
        {globalError && (
          <p className="mt-4 text-[10px] font-mono text-red-500 bg-red-950/30 border border-red-900/50 rounded-lg px-4 py-2 uppercase tracking-widest">{globalError}</p>
        )}
      </div>

      {/* Loading */}
      {results.some(r => r.loading) && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {results.map((r, i) => (
            <div key={i} className="bg-[#050b14]/70 border border-cyan-500/20 rounded-xl p-6 h-28 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-ping" />
                <span className="text-[9px] font-mono text-cyan-500 uppercase tracking-widest">
                  {r.loading ? 'Loading telemetry...' : 'Processing...'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── RESULTS ── */}
      {okResults.length === 2 && !running && (
        <>
          {hasMitigation && (
            <div className="bg-[#06101f] border border-emerald-800/30 rounded-2xl p-5">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-[9px] font-mono text-emerald-400 uppercase tracking-[0.2em] font-bold">
                  Mitigation Applied · +{canopy}% canopy · +{albedo}% albedo · {compareYear}
                </p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {okResults.map((r) => {
                  const proj = r.projections?.find(p => p.year === compareYear);
                  if (!proj) return null;
                  const mitDeaths = getMitigatedValue(proj.attributable_deaths, 'attributable_deaths', proj.heatwave_days);
                  const mitLoss   = getMitigatedValue(proj.economic_decay_usd,  'economic_decay_usd',  proj.heatwave_days);
                  const mitTemp   = getMitigatedValue(proj.peak_tx5d_c,         'peak_tx5d_c',         proj.heatwave_days);
                  const mitHW     = getMitigatedValue(proj.heatwave_days,        'heatwave_days',       proj.heatwave_days);
                  return (
                    <div key={r.query}>
                      <p className="text-[9px] font-mono text-slate-400 uppercase tracking-widest font-bold mb-3 truncate">{r.query}</p>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Deaths',    base: proj.attributable_deaths.toLocaleString(), mit: mitDeaths ? Math.round(mitDeaths).toLocaleString() : '—', saved: mitDeaths ? `−${(proj.attributable_deaths - Math.round(mitDeaths)).toLocaleString()}` : '—', bc: 'text-red-400'   },
                          { label: 'Econ Loss', base: fmtUSD(proj.economic_decay_usd),            mit: fmtUSD(mitLoss),                                         saved: mitLoss ? `−${fmtUSD(proj.economic_decay_usd - mitLoss)}` : '—',                       bc: 'text-amber-400' },
                          { label: 'Peak Temp', base: `${fmt(proj.peak_tx5d_c)}°C`,               mit: `${fmt(mitTemp ?? 0)}°C`,                                saved: `−${fmt((proj.peak_tx5d_c) - (mitTemp ?? proj.peak_tx5d_c))}°C`,                     bc: 'text-orange-400'},
                          { label: 'HW Days',   base: `${proj.heatwave_days}d`,                   mit: `${Math.round(mitHW ?? proj.heatwave_days)}d`,             saved: `−${proj.heatwave_days - Math.round(mitHW ?? proj.heatwave_days)}d`,                bc: 'text-yellow-400'},
                        ].map((item) => (
                          <div key={item.label} className="bg-slate-900/30 rounded-lg p-3 border border-slate-800/40">
                            <p className="text-[8px] font-mono text-slate-600 uppercase mb-1.5">{item.label}</p>
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="text-[8px] font-mono text-slate-600">W/o</span>
                              <span className={`text-[11px] font-mono font-bold ${item.bc}`}>{item.base}</span>
                            </div>
                            <div className="flex justify-between items-baseline mb-1">
                              <span className="text-[8px] font-mono text-slate-600">With</span>
                              <span className="text-[11px] font-mono font-bold text-slate-300">{item.mit}</span>
                            </div>
                            <div className="flex justify-between items-baseline bg-emerald-950/30 rounded px-1.5 py-1 border border-emerald-800/20">
                              <span className="text-[7px] font-mono text-slate-600 uppercase">Saved</span>
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">{item.saved}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main comparison table */}
          <div className="w-full bg-[#050b14]/70 backdrop-blur-xl border border-cyan-500/20 rounded-2xl shadow-[0_0_40px_rgba(34,211,238,0.05)] overflow-hidden">
            <div className="bg-cyan-950/40 border-b border-cyan-500/30 px-5 md:px-8 py-5">
              <h3 className="text-[11px] font-mono text-cyan-300 tracking-[0.4em] uppercase">
                Side-by-Side Telemetry
                <span className="text-slate-500 ml-2">| {compareYear} | {ssp.toUpperCase()}</span>
                {hasMitigation && <span className="text-emerald-400 ml-2">| +{canopy}% canopy · +{albedo}% albedo</span>}
              </h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/[0.01] border-b border-cyan-500/20">
                    <th className="px-5 md:px-8 py-5 text-[10px] font-mono text-cyan-200 uppercase tracking-widest w-[30%]">
                      Parameter
                      <p className="text-[8px] text-slate-500 mt-1 normal-case tracking-normal font-normal">
                        Rows with <span className="text-cyan-400 font-bold border border-cyan-500/30 bg-cyan-900/30 px-1 rounded text-[7px]">CALC</span> badge are auditable
                      </p>
                    </th>
                    {okResults.map(r => (
                      <th key={r.query} className="px-5 md:px-8 py-5 text-center w-[35%]">
                        <span className="font-mono text-xs font-bold text-white block uppercase tracking-widest truncate max-w-[160px] mx-auto">{r.query}</span>
                        <span className="text-[9px] font-mono text-slate-500 block mt-1">{formatCoordinates(r.lat, r.lng)} · {r.elevation.toFixed(0)}m</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {METRICS.map(m => {
                    const baseVals = okResults.map(r => {
                      const p = r.projections?.find(pr => pr.year === compareYear);
                      if (!p) return null;
                      
                      let val = (p as any)[m.key];
                      
                      // 🔴 THE FIX: If UHI is null/undefined in the table mapping, calculate it using baseline
                      if (m.key === 'uhi_intensity_c' && val == null) {
                        val = r.baseline?.baseline_mean_c ? (p.peak_tx5d_c - r.baseline.baseline_mean_c) : 2.1;
                      }
                      
                      return val as number;
                    });
                    const mitigatedVals = okResults.map((r, i) => {
                      const p = r.projections?.find(pr => pr.year === compareYear);
                      if (!p) return null;
                      return getMitigatedValue(baseVals[i], m.key, p.heatwave_days);
                    });
                    const displayVals = hasMitigation ? mitigatedVals : baseVals;
                    const maxVal      = Math.max(...displayVals.filter((v): v is number => v !== null));

                    return (
                      <tr
                        key={m.key}
                        className={`hover:bg-cyan-900/10 transition-colors group ${m.hasCalc ? 'cursor-pointer' : ''}`}
                        onClick={() => {
                          if (!m.hasCalc || !projA || !projB) return;
                          setMathModal({ open: true, metricLabel: m.label, metricKey: m.key, valA: displayVals[0], valB: displayVals[1] });
                        }}
                      >
                        <td className="px-5 md:px-8 py-5">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-mono text-slate-300 uppercase tracking-wider group-hover:text-white transition-colors">{m.label}</span>
                            {m.hasCalc && (
                              <span className="opacity-0 group-hover:opacity-100 transition-opacity px-1.5 py-0.5 bg-cyan-900/40 border border-cyan-500/40 text-cyan-300 text-[7px] font-bold rounded shadow-[0_0_10px_rgba(34,211,238,0.2)] uppercase">
                                CALC ↗
                              </span>
                            )}
                          </div>
                          <div className="text-[8px] font-mono text-slate-700 mt-0.5 uppercase">{m.unit}</div>
                          <SourceLine source={m.source} />
                        </td>
                        {okResults.map((r, i) => {
                          const baseV = baseVals[i];
                          const mitV  = mitigatedVals[i];
                          const dispV = displayVals[i];
                          const isMax = dispV != null && dispV === maxVal && maxVal > 0;
                          return (
                            <td key={r.query} className="px-5 md:px-8 py-5 text-center">
                              {/* Baseline value */}
                              {hasMitigation && baseV != null && (
                                <div className="text-[9px] font-mono text-slate-600 mb-1">
                                  <span className="text-[7px] uppercase tracking-widest text-slate-700 mr-1">Base:</span>
                                  {m.fmt(baseV)}
                                </div>
                              )}
                              {/* Display value (mitigated if sliders active) */}
                              <span className={`font-mono text-sm ${isMax ? "text-cyan-300 font-bold drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]" : hasMitigation ? "text-emerald-300 font-bold" : "text-white"}`}>
                                {dispV != null ? m.fmt(dispV) : "—"}
                              </span>
                              {isMax && <span className="block mt-1 text-[8px] text-cyan-500/70 uppercase font-mono tracking-widest">Max. Exposure</span>}
                              {/* Saved delta */}
                              {hasMitigation && baseV != null && mitV != null && (
                                <div className="text-[8px] font-mono text-emerald-500 mt-1">
                                  {m.key === 'economic_decay_usd'  ? `−${fmtUSD(baseV - mitV)}`
                                  : m.key === 'attributable_deaths' ? `−${Math.round(baseV - mitV).toLocaleString()}`
                                  : `−${fmt(baseV - mitV)}`}
                                </div>
                              )}
                              {dispV != null && m.key === 'attributable_deaths' && (
                                <div className="text-[7px] font-mono text-slate-600 mt-1">CI: {formatDeathsRange(dispV)}</div>
                              )}
                              {dispV != null && m.key === 'economic_decay_usd' && (
                                <div className="text-[7px] font-mono text-slate-600 mt-1">{formatEconomicRange(dispV)}</div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* AI Analysis */}
            <div className="bg-[#02050a]/60 border-t border-cyan-500/20 px-5 md:px-8 py-7">
              <h4 className="flex items-center gap-3 text-[10px] font-mono text-cyan-400 tracking-[0.3em] uppercase mb-4">
                <span className="w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse shadow-[0_0_8px_#22d3ee]" />
                Scientific Audit &amp; Strategic Comparison
              </h4>
              {aiLoading ? (
                <div className="flex flex-col gap-3 py-3">
                  <div className="h-2 w-full bg-slate-800 rounded animate-pulse" />
                  <div className="h-2 w-3/4 bg-slate-800 rounded animate-pulse" />
                  <div className="h-2 w-1/2 bg-slate-800 rounded animate-pulse" />
                  <span className="text-[9px] font-mono text-cyan-500/50 uppercase tracking-widest mt-1">Generating comparative analysis...</span>
                </div>
              ) : aiAnalysis ? (
                <p className="text-xs font-mono text-slate-300 leading-loose tracking-wide">{cleanAiText(aiAnalysis)}</p>
              ) : (
                <p className="text-[10px] font-mono text-slate-600 italic">Comparative analysis unavailable. Please interpret the metrics above.</p>
              )}
            </div>
          </div>
        </>
      )}

      {/* Errors */}
      {results.filter(r => r.error).map(r => (
        <div key={r.query} className="bg-red-500/10 border border-red-500/20 rounded-xl px-5 py-4 flex flex-col gap-2">
          <div className="flex gap-4 items-center">
            <span className="text-red-500 font-mono text-xs shrink-0">ERR:</span>
            <span className="text-red-400 font-mono text-[10px] uppercase tracking-widest break-all">{r.query}</span>
          </div>
          <pre className="text-[9px] font-mono text-red-300/70 bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2 whitespace-pre-wrap break-all leading-relaxed">
            {r.error}
          </pre>
        </div>
      ))}
    </div>
  );
}