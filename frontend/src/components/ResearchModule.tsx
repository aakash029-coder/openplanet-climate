'use client';

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  formatWBT, formatEconomicRange, formatCoordinates,
} from "@/context/ClimateDataContext";
import { ExcelExportIconButton, type ExcelExportData } from "@/components/ExcelExport";

import {
  Projection, RiskResult, fmt, fmtUSD, getWBTStatus, cleanResearchText,
  CalcModal, AdaptationROI, MortalityDecomposition, SourceLine, CalcBtn
} from "./ResearchComponents";

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

// ─────────────────────────────────────────────────────────────────
// Deep-logging fetch helper
// ─────────────────────────────────────────────────────────────────
async function fetchClimateRiskResearch(payload: {
  lat: number; lng: number; elevation: number;
  ssp: string; canopy_offset_pct: number; albedo_offset_pct: number;
  location_hint: string;
}, signal: AbortSignal): Promise<any> {
  console.log(
    "[fetchClimateRiskResearch] payload →\n",
    JSON.stringify(payload, null, 2)
  );

  const resp = await fetch("/api/engine", {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ endpoint: "/api/climate-risk", payload }),
    signal,
  });

  if (!resp.ok) {
    const rawText = await resp.text();
    let humanMessage = rawText;
    try {
      const parsed = JSON.parse(rawText) as { detail?: unknown };
      if (parsed.detail) {
        console.error(
          `[fetchClimateRiskResearch] FastAPI ${resp.status} validation errors:\n`,
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
        `[fetchClimateRiskResearch] Non-JSON error body (status ${resp.status}):\n`,
        rawText
      );
    }
    throw new Error(`API ${resp.status}: ${humanMessage}`);
  }

  const d = await resp.json();
  if (d.error) throw new Error(d.error);
  return d;
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function ResearchModule({ baseTarget }: { baseTarget: string }) {
  // 🔴 2. Deep Dive directly Dashboard wale saved inputs ko read karega
  const savedState = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('op_sync_state') || '{}') : {};
  const [ssp, setSsp]                   = useState(savedState.ssp || "SSP2-4.5");
  const [canopy, setCanopy]             = useState(savedState.canopy !== undefined ? savedState.canopy : 0);
  const [albedo, setAlbedo]             = useState(savedState.albedo !== undefined ? savedState.albedo : 0);
  const [selectedYear, setSelectedYear] = useState<number | null>(savedState.year ? Number(savedState.year) : null);

  // Agar user Deep Dive ke andar aakar koi change kare, toh wo bhi wapas save ho jaye
  useEffect(() => {
    localStorage.setItem('op_sync_state', JSON.stringify({ 
      ssp, 
      year: selectedYear?.toString() || '2050', 
      canopy, 
      albedo 
    }));
  }, [ssp, selectedYear, canopy, albedo]);

  const [geo, setGeo]                   = useState<{ lat: number; lng: number; elevation: number; display_name: string } | null>(null);
  const [result, setResult]             = useState<RiskResult | null>(null);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis]     = useState<string | null>(null);
  const [aiLoading, setAiLoading]       = useState(false);
  const [retryStatus, setRetryStatus]   = useState<string | null>(null);

  const [calcModal, setCalcModal] = useState<{ open: boolean; key: "mortality" | "economics" }>({
    open: false, key: "mortality",
  });

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

  const handleAnalyse = useCallback(async (
    queryToRun: string = baseTarget,
    sspVal: string     = ssp,
  ) => {
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
          const lat       = parseFloat(g.lat);
          const lng       = parseFloat(g.lon);
          const elevation = await fetchElevationSafe(lat, lng);
          currentGeo      = { display_name: g.display_name, lat, lng, elevation };
          setGeo(currentGeo); setRetryStatus(null);
        } else {
          geoRetries--;
          if (geoRetries > 0) await new Promise(r => setTimeout(r, 2000));
        }
      }
      if (!currentGeo) throw new Error("Geocoding failed after 3 retries.");

      let riskData: any   = null;
      let riskRetries     = 3;
      let lastRiskError: any = null;

      while (riskRetries > 0 && !riskData) {
        if (riskRetries < 3) setRetryStatus(`Fetching risk metrics... (${4 - riskRetries}/3)`);
        try {
          const ctrl  = new AbortController();
          const timer = setTimeout(() => ctrl.abort(), 30000);

          riskData = await fetchClimateRiskResearch(
            {
              lat:               currentGeo.lat,
              lng:               currentGeo.lng,
              elevation:         currentGeo.elevation,
              ssp:               sspVal,           
              canopy_offset_pct: canopy,
              albedo_offset_pct: albedo,
              location_hint:     currentGeo.display_name, 
            },
            ctrl.signal
          );

          clearTimeout(timer);
          setRetryStatus(null);
        } catch (err) {
          lastRiskError = err;
          riskRetries--;
          if (riskRetries > 0) await new Promise(r => setTimeout(r, 3000));
        }
      }
      if (!riskData) throw new Error(lastRiskError?.message ?? "Engine connection failed.");

      setResult(riskData);

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "openplanet_last_risk_data",
          JSON.stringify({
            ...riskData,
            city_name: baseTarget,
            lat:       currentGeo.lat,
            lng:       currentGeo.lng,
          })
        );
      }

      let targetYr = selectedYear;
      if (!targetYr && riskData.projections?.length > 0) {
        targetYr = riskData.projections[0].year;
        setSelectedYear(targetYr);
      }
      setLoading(false);

      if (riskData.projections?.length > 0) {
        setAiLoading(true);
        await new Promise(r => setTimeout(r, 2000));
        let aiRetries = 3;
        let aiSuccess = false;

        while (!aiSuccess && aiRetries > 0) {
          try {
            if (aiRetries < 3) setRetryStatus(`Generating AI analysis... (${4 - aiRetries}/3)`);
            const pData = riskData.projections.find((p: any) => p.year === (targetYr ?? 2050))
              ?? riskData.projections[0];
            const ctrl  = new AbortController();
            const timer = setTimeout(() => ctrl.abort(), 30000);

            const aiResp = await fetch("/api/engine", {
              method:  "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                endpoint: "/api/research-analysis",
                payload: {
                  city_name: currentGeo.display_name,
                  context:   "Deep Dive Research Analysis",
                  metrics: {
                    temp:      `${fmt(pData.peak_tx5d_c)}°C`,
                    elevation: `${fmt(currentGeo.elevation, 0)}m`,
                    heatwave:  `${fmt(pData.heatwave_days, 0)} days`,
                    loss:      fmtUSD(pData.economic_decay_usd),
                    lat:       currentGeo.lat,
                    lng:       currentGeo.lng,
                  },
                },
              }),
              signal: ctrl.signal,
            });

            clearTimeout(timer);

            if (!aiResp.ok) {
              const t = await aiResp.text();
              console.error("[ResearchModule] AI endpoint error:", t);
              throw new Error(`AI ${aiResp.status}`);
            }

            const aiData = await aiResp.json();
            setAiAnalysis(aiData.reasoning);
            aiSuccess = true; setRetryStatus(null);
          } catch {
            aiRetries--;
            if (aiRetries > 0) await new Promise(r => setTimeout(r, 3000));
            else setAiAnalysis(null);
          }
        }
        setAiLoading(false); setRetryStatus(null);
      }
    } catch (err: any) {
      const msg = err?.message ?? "Analysis Failed";
      console.error("[ResearchModule] handleAnalyse error:", msg);
      setError(msg);
      setLoading(false); setRetryStatus(null);
    } finally {
      isRunningRef.current = false;
    }
  }, [baseTarget, selectedYear, canopy, albedo]);

  const getMitigatedData = () => {
    if (!result) return null;
    const sp = result.projections?.find(p => p.year === selectedYear);
    if (!sp) return null;
    const cooling    = (canopy / 100) * 1.2 + (albedo / 100) * 0.8;
    const effHW      = Math.max(0, sp.heatwave_days - cooling * 3.5);
    const hwR        = sp.heatwave_days > 0 ? effHW / sp.heatwave_days : 1;
    const combined   = hwR * Math.max(0, 1 - cooling * 0.08);
    const rawWBT     = sp.wbt_max_c ?? (sp.peak_tx5d_c * 0.7 + 8);
    const baseUHI    = sp.uhi_intensity_c ?? (result.baseline?.baseline_mean_c ? (sp.peak_tx5d_c - result.baseline.baseline_mean_c) : 2.1);
    const baseCdd    = sp.grid_stress_factor ?? ((sp.peak_tx5d_c - 18) * sp.heatwave_days);
    const mitDeaths  = Math.round(sp.attributable_deaths * combined);
    const savedDeaths= Math.round(sp.attributable_deaths - mitDeaths);
    const mitLoss    = sp.economic_decay_usd * combined;
    return {
      wbt:           Math.min(35, Math.max(0, rawWBT - cooling * 0.85)),
      uhi:           Math.max(0, Math.min(8, baseUHI - cooling)),
      cdd:           Math.max(0, baseCdd * hwR),
      peakTemp:      Math.max(0, sp.peak_tx5d_c - cooling),
      loss:          mitLoss,
      deaths:        mitDeaths,
      savedDeaths,
      savedLoss:     sp.economic_decay_usd - mitLoss,
      combinedRatio: combined,
      hwDays:        Math.round(effHW),
    };
  };

  const dynamicData    = getMitigatedData();
  const wbtStatus      = dynamicData ? getWBTStatus(dynamicData.wbt) : getWBTStatus(0);
  const selectedProj   = result?.projections?.find(p => p.year === selectedYear) ?? null;
  const hasMitigation  = canopy > 0 || albedo > 0;
  const mortalityAudit = selectedProj?.audit_trail?.mortality ?? null;
  const economicsAudit = selectedProj?.audit_trail?.economics ?? null;

  const excelData: ExcelExportData | null = (result && selectedProj && geo)
    ? {
        city_name:          baseTarget,
        lat:                geo.lat,
        lng:                geo.lng,
        ssp,
        target_year:        selectedYear ?? 2050,
        era5_baseline_c:    result.baseline?.baseline_mean_c ?? 0,
        era5_p95_c:         result.threshold_c,
        era5_humidity_p95:  result.era5_humidity_p95 ?? 70,
        peak_tx5d_c:        selectedProj.peak_tx5d_c,
        heatwave_days:      selectedProj.heatwave_days,
        mean_temp_c:        selectedProj.peak_tx5d_c - 8,
        population:         result.population ?? 0,
        gdp_usd:            result.gdp_usd ?? 0,
        death_rate:         7.7,
        vulnerability:      selectedProj.audit_trail?.mortality?.variables?.V ?? 1.0,
        canopy_pct:         canopy,
        albedo_pct:         albedo,
        attributable_deaths:selectedProj.attributable_deaths,
        economic_decay_usd: selectedProj.economic_decay_usd,
        wbt_c:              selectedProj.wbt_max_c ?? 0,
        cmip6_source:       selectedProj.source,
      }
    : null;

  return (
    <div className="space-y-5 animate-in fade-in duration-700">

      {/* Calc Modals */}
      <CalcModal
        open={calcModal.open && calcModal.key === "mortality"}
        onClose={() => setCalcModal(m => ({ ...m, open: false }))}
        auditSection={mortalityAudit} title="Mortality"
        disclaimer="Simplified Gasparrini et al. 2017 — for research estimation only."
      />
      <CalcModal
        open={calcModal.open && calcModal.key === "economics"}
        onClose={() => setCalcModal(m => ({ ...m, open: false }))}
        auditSection={economicsAudit} title="Economics"
        disclaimer="Simplified Burke (2018) + ILO (2019) framework — for estimation only."
      />

      {/* ── HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-slate-800 pb-5 gap-4">
        <div>
          <h2 className="text-[10px] font-mono font-bold text-indigo-400 uppercase tracking-[0.5em] mb-2">Deep Dive Research Protocol</h2>
          <h1 className="text-2xl sm:text-3xl font-mono font-bold text-white uppercase tracking-tighter truncate max-w-2xl">
            {baseTarget.split(",")[0]}
          </h1>
          {geo && (
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-2">
              {formatCoordinates(geo.lat, geo.lng)} · ELEV: {geo.elevation}m
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Scientific Version</p>
          <p className="text-[10px] font-mono text-slate-300 uppercase">v2.0.4-PRO</p>
        </div>
      </div>

      {/* ── CONTROLS ── */}
      <div className="bg-[#050814] border border-slate-800 p-5 rounded-xl">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-4">
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">SSP Scenario</label>
            <select
              value={ssp}
              onChange={e => setSsp(e.target.value)}
              disabled={loading}
              className="w-full bg-[#0a0f1d] border border-slate-700 p-2.5 text-[11px] font-mono text-slate-200 outline-none rounded-lg focus:border-indigo-500 transition-colors disabled:opacity-50"
            >
              <option value="SSP2-4.5">SSP2-4.5 (Moderate)</option>
              <option value="SSP5-8.5">SSP5-8.5 (High Risk)</option>
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-[10px] font-mono text-slate-400 uppercase">🌳 Canopy</label>
              <span className="text-[10px] font-mono text-emerald-400">+{canopy}%</span>
            </div>
            <input
              type="range" min={0} max={50} value={canopy}
              onChange={e => setCanopy(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer"
              style={{ touchAction: "manipulation" }}
            />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-[10px] font-mono text-slate-400 uppercase">🏠 Albedo</label>
              <span className="text-[10px] font-mono text-indigo-400">+{albedo}%</span>
            </div>
            <input
              type="range" min={0} max={100} value={albedo}
              onChange={e => setAlbedo(Number(e.target.value))}
              className="w-full accent-indigo-500 cursor-pointer"
              style={{ touchAction: "manipulation" }}
            />
          </div>
          <div className="flex flex-col justify-end">
            <div className="w-full bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 py-2.5 text-[10px] font-mono uppercase tracking-[0.2em] rounded-lg flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />ENGINE SYNCED
            </div>
          </div>
        </div>
        {retryStatus && (
          <p className="mt-2 text-[9px] font-mono text-indigo-400 uppercase tracking-widest animate-pulse">
            {retryStatus}
          </p>
        )}
      </div>

      {/* ── YEAR SELECTOR ── */}
      {result && result.projections.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {result.projections.map(p => (
            <button
              key={p.year}
              onClick={() => setSelectedYear(p.year)}
              className={`px-3.5 py-2 text-[10px] font-mono uppercase tracking-widest border rounded-lg transition-colors ${
                selectedYear === p.year
                  ? "border-cyan-500/50 bg-cyan-950/30 text-cyan-300"
                  : "border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700"
              }`}
            >
              {p.year}
              <span className="ml-2 text-[8px] text-slate-600">
                {p.source.includes("cmip6") ? "CMIP6" : "AR6"}
              </span>
            </button>
          ))}
        </div>
      )}

      {loading && !result && (
        <div className="w-full h-64 flex flex-col items-center justify-center bg-[#050814] border border-slate-800 rounded-xl">
          <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
          <span className="font-mono text-[10px] text-indigo-400 tracking-[0.3em] uppercase animate-pulse">
            Running Physics Engine...
          </span>
          {retryStatus && (
            <span className="mt-3 font-mono text-[9px] text-slate-500 tracking-widest uppercase">{retryStatus}</span>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl space-y-2">
          <p className="text-red-400 font-mono text-xs font-bold uppercase tracking-widest">ERR: Analysis Failed</p>
          <pre className="text-[9px] font-mono text-red-300/70 bg-red-950/20 border border-red-900/30 rounded-lg px-3 py-2 whitespace-pre-wrap break-all leading-relaxed">
            {error}
          </pre>
        </div>
      )}

      {!loading && result && dynamicData && selectedProj && (
        <>
          {/* ── BASELINE vs MITIGATION ── */}
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
                  { label: "Deaths",        baseline: selectedProj.attributable_deaths.toLocaleString(), mitigated: dynamicData.deaths.toLocaleString(),   saved: `−${dynamicData.savedDeaths.toLocaleString()} lives`,                     baseColor: "text-red-400"    },
                  { label: "Economic Loss", baseline: fmtUSD(selectedProj.economic_decay_usd),           mitigated: fmtUSD(dynamicData.loss),               saved: `−${fmtUSD(dynamicData.savedLoss)}`,                                     baseColor: "text-amber-400"  },
                  { label: "Peak Temp",     baseline: `${fmt(selectedProj.peak_tx5d_c)}°C`,              mitigated: `${fmt(dynamicData.peakTemp)}°C`,       saved: `−${fmt(selectedProj.peak_tx5d_c - dynamicData.peakTemp)}°C`,           baseColor: "text-orange-400" },
                  { label: "Heatwave Days", baseline: `${selectedProj.heatwave_days}d`,                  mitigated: `${dynamicData.hwDays}d`,               saved: `−${Math.max(0, selectedProj.heatwave_days - dynamicData.hwDays)}d`,    baseColor: "text-yellow-400" },
                ].map(item => (
                  <div key={item.label} className="space-y-2">
                    <p className="text-[8px] font-mono text-slate-600 uppercase tracking-[0.12em]">{item.label}</p>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[8px] font-mono text-slate-600">Without</span>
                      <span className={`text-[13px] font-mono font-bold tabular-nums ${item.baseColor}`}>{item.baseline}</span>
                    </div>
                    <div className="flex items-baseline justify-between">
                      <span className="text-[8px] font-mono text-slate-600">With</span>
                      <span className="text-[13px] font-mono font-bold tabular-nums text-slate-300">{item.mitigated}</span>
                    </div>
                    <div className="flex items-center justify-between bg-emerald-950/25 rounded-lg px-2.5 py-1.5 border border-emerald-800/20">
                      <span className="text-[8px] font-mono text-slate-600">Saved</span>
                      <span className="text-[11px] font-mono text-emerald-400 font-bold">{item.saved}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── WBT + UHI + INFRASTRUCTURE ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* WBT */}
            <div className="bg-[#050814] border border-slate-800 p-5 rounded-xl flex flex-col">
              <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Physiological Limit Monitor</h3>
              <div className={`flex flex-col items-center justify-center py-8 border-y border-slate-800/50 my-4 flex-grow rounded-lg ${wbtStatus.bg}`}>
                <span className={`text-4xl font-mono font-bold ${wbtStatus.color}`}>{formatWBT(dynamicData.wbt)}</span>
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
              <p className="text-[9px] font-mono text-slate-500 leading-relaxed">
                Values ≥ 31°C critical. Capped at 35°C per Sherwood & Huber (2010) PNAS.
              </p>
              {result.baseline?.baseline_mean_c && (
                <p className="text-[8px] font-mono text-slate-600 italic mt-2">
                  ERA5 baseline: {fmt(result.baseline.baseline_mean_c)}°C (1991-2020)
                </p>
              )}
              <SourceLine source="Stull (2011) · ERA5 P95 Humidity" />
            </div>

            {/* UHI */}
            <div className="bg-[#050814] border border-slate-800 p-5 rounded-xl flex flex-col">
              <h3 className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-4">Heat Attribution (UHI)</h3>
              <div className="space-y-5 flex-grow">
                {[
                  { label: "ERA5 Historical Mean",  val: `${fmt(result.baseline?.baseline_mean_c)}°C`,                         color: "text-slate-300",  bar: "bg-indigo-500",  w: "60%",                                                              source: "ERA5 1991-2020"                    },
                  { label: "Urban Heat Island",     val: `+${fmt(dynamicData.uhi)}°C`,                                          color: "text-orange-400", bar: "bg-orange-500", w: `${Math.min(100, Math.max(10, (dynamicData.uhi / 8) * 100))}%`,     source: "Oke (1982) cap: 8°C"              },
                  { label: "Albedo/Canopy Offset",  val: `-${fmt((canopy / 100) * 1.2 + (albedo / 100) * 0.8)}°C`,              color: "text-emerald-400",bar: "bg-emerald-500",w: `${Math.min(100, (canopy + albedo) / 2)}%`,                         source: "Bowler (2010) · Santamouris (2015)"},
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
                  <span className="text-xl font-mono text-indigo-400 font-bold">+{fmt(dynamicData.cdd, 0)}</span>
                  <span className="text-[8px] font-mono text-slate-600 block mt-1 uppercase">CDD Load</span>
                </div>
                <div className="p-4 bg-white/5 border border-white/5 rounded-lg flex flex-col justify-center">
                  <span className="text-[9px] font-mono text-slate-500 block mb-2 uppercase">Road Melt Risk</span>
                  <span className={`text-xl font-mono font-bold ${dynamicData.peakTemp > 38 ? "text-amber-400" : "text-emerald-400"}`}>
                    {dynamicData.peakTemp > 38 ? "HIGH" : "LOW"}
                  </span>
                  <span className="text-[8px] font-mono text-slate-600 block mt-1 uppercase">38°C+ Exposure</span>
                </div>
              </div>
              <div className="mt-5 space-y-2.5">
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 uppercase">
                  <div className={`w-1.5 h-1.5 rounded-full ${dynamicData.cdd > 500 ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
                  <span>Thermal Overload: {dynamicData.cdd > 500 ? "Exceeded" : "Stable"}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 uppercase">
                  <div className={`w-1.5 h-1.5 rounded-full ${selectedProj.wbt_max_c && selectedProj.wbt_max_c >= 31 ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`} />
                  <span>Survivability: {selectedProj.wbt_max_c && selectedProj.wbt_max_c >= 31 ? "Critical" : "Stable"}</span>
                </div>
              </div>
              <SourceLine source="CMIP6 Ensemble · ERA5 P95" />
            </div>
          </div>

          {/* ── ECONOMIC CARD ── */}
          <div className="bg-indigo-600/5 border border-indigo-500/20 p-5 rounded-xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest font-bold">
                Economic Value At Risk ({selectedYear})
              </h3>
              <div className="flex items-center gap-2">
                {economicsAudit && <CalcBtn onClick={() => setCalcModal({ open: true, key: "economics" })} />}
                <ExcelExportIconButton data={excelData} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest mb-1">Baseline (no mitigation)</p>
                <p className="text-3xl font-mono text-white font-bold">{fmtUSD(selectedProj.economic_decay_usd)}</p>
                <p className="text-[9px] font-mono text-slate-500 mt-1">Range · {formatEconomicRange(selectedProj.economic_decay_usd)}</p>
                {hasMitigation && (
                  <div className="pt-3 mt-3 border-t border-slate-700/50">
                    <p className="text-[8px] font-mono text-emerald-500/70 uppercase tracking-widest mb-1">
                      With +{canopy}% canopy · +{albedo}% albedo
                    </p>
                    <div className="flex items-end justify-between">
                      <p className="text-2xl font-mono text-emerald-400 font-bold">↓ {fmtUSD(dynamicData.loss)}</p>
                      <p className="text-[13px] font-mono text-emerald-300 font-bold">−{fmtUSD(dynamicData.savedLoss)}</p>
                    </div>
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">City GDP</span>
                    <span className="text-base font-mono font-bold text-slate-400">{fmtUSD(result.gdp_usd)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">Population</span>
                    <span className="text-base font-mono font-bold text-slate-400">
                      {result.population ? (result.population / 1e6).toFixed(1) + "M" : "—"}
                    </span>
                  </div>
                </div>
                <SourceLine source="Burke et al. (2018) Nature · ILO (2019) · World Bank" />
              </div>
              <div>
                <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest mb-3">Projected Loss Trajectory</p>
                <div className="h-24 flex items-end gap-1 w-full border-b border-slate-700 pb-1">
                  {result.projections.map((p, idx) => {
                    const loss    = p.economic_decay_usd * (hasMitigation ? dynamicData.combinedRatio : 1);
                    const maxLoss = result.projections[result.projections.length - 1].economic_decay_usd || 1;
                    return (
                      <div
                        key={p.year}
                        className="bg-red-500 w-full cursor-pointer hover:bg-red-400 rounded-t-sm transition-all duration-500 relative group"
                        style={{ height: `${Math.min(100, (loss / maxLoss) * 100)}%`, opacity: 0.4 + idx * 0.2 }}
                        onClick={() => setSelectedYear(p.year)}
                      >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-slate-800 text-white text-[7px] font-mono px-1.5 py-0.5 rounded whitespace-nowrap z-10">
                          {p.year}: {fmtUSD(loss)}
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-[8px] font-mono text-slate-600 uppercase mt-1">
                  {result.projections.map(p => <span key={p.year}>{p.year}</span>)}
                </div>
              </div>
            </div>
          </div>

          {/* ── ADAPTATION ROI + MORTALITY ── */}
          <AdaptationROI
            selectedProj={selectedProj}
            gdp_usd={result.gdp_usd} population={result.population}
            canopy={canopy} albedo={albedo}
            setCanopy={setCanopy} setAlbedo={setAlbedo}
          />

          <MortalityDecomposition
            selectedProj={selectedProj}
            population={result.population}
            onCalcClick={() => setCalcModal({ open: true, key: "mortality" })}
          />

          {/* ── AI REASONING ── */}
          <div className="border border-indigo-500/30 bg-[#050814]/80 p-6 rounded-xl relative overflow-hidden">
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/10 blur-[50px] pointer-events-none" />
            <h4 className="text-[10px] font-mono text-indigo-400 uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
              Expert AI Reasoning — Geological &amp; Thermal Context
            </h4>
            {aiLoading ? (
              <div className="flex items-center gap-3 py-2">
                <div className="w-4 h-4 border-2 border-indigo-500/20 border-t-indigo-400 rounded-full animate-spin" />
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-widest">
                  {retryStatus ?? "Generating scientific summary..."}
                </span>
              </div>
            ) : aiAnalysis ? (
              <p className="text-xs font-mono text-slate-300 leading-loose">{cleanResearchText(aiAnalysis)}</p>
            ) : (
              <p className="text-[10px] font-mono text-slate-600 italic">
                AI analysis unavailable. Refer to the metrics above.
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}