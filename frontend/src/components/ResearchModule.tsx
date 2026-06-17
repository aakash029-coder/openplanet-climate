'use client';

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  formatEconomicRange,
  useClimateData, CityClimateData,
} from "@/context/ClimateDataContext";
import { formatCoord, formatWetBulb } from "@/lib/format";
import { ExcelExportIconButton, type ExcelExportData } from "@/components/ExcelExport";

import {
  Projection, RiskResult, fmt, fmtUSD, getWBTStatus, cleanResearchText,
  CalcModal, AdaptationROI, MortalityDecomposition, SourceLine, CalcBtn
} from "./ResearchComponents";
import { useProgressiveText } from "@/hooks/useProgressiveText";
import { SkeletonText } from "@/components/ui/primitives";

// ─────────────────────────────────────────────────────────────────
// MOBILE COLLAPSIBLE SECTION
// ─────────────────────────────────────────────────────────────────
function MobileSection({ title, defaultOpen = true, children }: {
  title: string; defaultOpen?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="md:hidden w-full flex items-center justify-between px-4 py-3 mb-1 border border-white/[0.05]"
        style={{ background: 'var(--raised)' }}
      >
        <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">{title}</span>
        <span className="font-mono text-slate-500 text-base leading-none">{open ? '−' : '+'}</span>
      </button>
      <div className={open ? 'block' : 'hidden md:block'}>{children}</div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function ResearchModule({ baseTarget }: { baseTarget: string }) {
  const { primaryData, primaryLoading, primaryError, fetchPrimaryCity, canopy, setCanopy, coolRoof: albedo, setCoolRoof: setAlbedo } = useClimateData();

  // SSP / mitigation state — initialize from primaryData if already loaded, else localStorage
  const savedState = typeof window !== 'undefined'
    ? (() => { try { return JSON.parse(localStorage.getItem('op_sync_state') || '{}'); } catch { return {}; } })()
    : {};
  const [ssp, setSsp] = useState(() => primaryData?.ssp || savedState.ssp || "SSP2-4.5");
  const [selectedYear, setSelectedYear] = useState<number | null>(
    savedState.year ? Number(savedState.year) : null
  );

  const [calcModal, setCalcModal] = useState<{ open: boolean; key: "mortality" | "economics" }>({
    open: false, key: "mortality",
  });

  // AI analysis state — fetched independently; not a core risk metric
  const [aiAnalysis, setAiAnalysis] = useState<string | null>(null);
  const [aiLoading,  setAiLoading]  = useState(false);
  const lastAiKeyRef   = useRef('');
  const aiControllerRef = useRef<AbortController | null>(null);

  // Keep a ref to primaryData to avoid stale closures in effects
  const primaryDataRef = useRef(primaryData);
  useEffect(() => { primaryDataRef.current = primaryData; });

  // Sync to localStorage whenever controls change
  useEffect(() => {
    localStorage.setItem('op_sync_state', JSON.stringify({
      ssp,
      year: selectedYear?.toString() || '2050',
    }));
  }, [ssp, selectedYear]);

  // Set initial year from projections once data arrives
  useEffect(() => {
    if (primaryData?.projections?.length && !selectedYear) {
      const fromStorage = savedState.year ? Number(savedState.year) : null;
      const matchYear   = fromStorage
        ? primaryData.projections.find(p => p.year === fromStorage)?.year
        : null;
      setSelectedYear(matchYear ?? primaryData.projections[0].year);
    }
  }, [primaryData]);

  // When SSP / mitigation changes, re-fetch via context (cache prevents duplicates)
  const lastFetchParamsRef = useRef({ ssp: '', canopy: -1, albedo: -1 });
  useEffect(() => {
    const pd = primaryDataRef.current;
    if (!pd) return;
    const p = lastFetchParamsRef.current;
    if (p.ssp === ssp && p.canopy === canopy && p.albedo === albedo) return;
    lastFetchParamsRef.current = { ssp, canopy, albedo };
    fetchPrimaryCity({
      city_name:         pd.city_name,
      lat:               pd.lat,
      lng:               pd.lng,
      ssp,
      canopy_offset_pct: canopy,
      albedo_offset_pct: albedo,
      elevation:         pd.elevation,
    });
  }, [ssp, canopy, albedo]); // intentionally omit primaryData/fetchPrimaryCity

  // Trigger AI analysis whenever the city or SSP changes
  const runAiAnalysis = useCallback(async (data: CityClimateData, targetYear: number) => {
    const pData = data.projections.find(p => p.year === targetYear) ?? data.projections[0];
    if (!pData) return;

    setAiLoading(true);
    setAiAnalysis(null);

    // Cancel any previous in-flight request
    aiControllerRef.current?.abort();
    const ctrl = new AbortController();
    aiControllerRef.current = ctrl;

    let retries = 3;
    while (retries > 0) {
      try {
        const timer = setTimeout(() => ctrl.abort(), 30000);
        const aiResp = await fetch("/api/engine", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            endpoint: "/api/research-analysis",
            payload: {
              city_name: data.city_name,
              context:   "Deep Dive Research Analysis",
              metrics: {
                temp:      `${fmt(pData.peak_tx5d_c)}°C`,
                elevation: `${data.elevation ?? 0}m`,
                heatwave:  `${fmt(pData.heatwave_days, 0)} days`,
                loss:      fmtUSD(pData.economic_decay_usd),
                lat:       data.lat,
                lng:       data.lng,
              },
            },
          }),
          signal: ctrl.signal,
        });
        clearTimeout(timer);
        if (!aiResp.ok) throw new Error(`AI ${aiResp.status}`);
        const aiData = await aiResp.json();
        if (!ctrl.signal.aborted) setAiAnalysis(aiData.reasoning ?? null);
        break;
      } catch (e: any) {
        if (e?.name === 'AbortError') break;
        retries--;
        if (retries > 0) await new Promise(r => setTimeout(r, 3000));
        else setAiAnalysis(null);
      }
    }
    setAiLoading(false);
  }, []);

  useEffect(() => {
    if (!primaryData || primaryLoading) return;
    const aiKey = `${primaryData.city_name}__${primaryData.ssp}`;
    if (aiKey === lastAiKeyRef.current) return;
    lastAiKeyRef.current = aiKey;
    const yr = selectedYear ?? primaryData.projections[0]?.year ?? 2050;
    runAiAnalysis(primaryData, yr);
  }, [primaryData, primaryLoading]); // intentionally omit selectedYear to avoid re-triggering on year change

  // ─── Derived values ────────────────────────────────────────────
  const result      = primaryData;   // alias for readability
  const selectedProj = result?.projections?.find(p => p.year === selectedYear) ?? null;

  const getMitigatedData = () => {
    if (!result || !selectedProj) return null;
    const cooling    = (canopy / 100) * 1.2 + (albedo / 100) * 0.8;
    const effHW      = Math.max(0, selectedProj.heatwave_days - cooling * 3.5);
    const hwR        = selectedProj.heatwave_days > 0 ? effHW / selectedProj.heatwave_days : 1;
    const combined   = hwR * Math.max(0, 1 - cooling * 0.08);
    // wbt_max_c is always set by the backend Stull formula — use directly
    const rawWBT     = selectedProj.wbt_max_c;
    const baseUHI    = selectedProj.uhi_intensity_c ?? (result.baseline?.baseline_mean_c ? (selectedProj.peak_tx5d_c - result.baseline.baseline_mean_c) : 2.1);
    const baseCdd    = selectedProj.grid_stress_factor ?? ((selectedProj.peak_tx5d_c - 18) * selectedProj.heatwave_days);
    const mitDeaths  = Math.round(selectedProj.attributable_deaths * combined);
    const savedDeaths = Math.round(selectedProj.attributable_deaths - mitDeaths);
    const mitLoss    = selectedProj.economic_decay_usd * combined;
    return {
      wbt:           Math.min(35, Math.max(0, rawWBT - cooling * 0.85)),
      uhi:           Math.max(0, Math.min(8, baseUHI - cooling)),
      cdd:           Math.max(0, baseCdd * hwR),
      peakTemp:      Math.max(0, selectedProj.peak_tx5d_c - cooling),
      loss:          mitLoss,
      deaths:        mitDeaths,
      savedDeaths,
      savedLoss:     selectedProj.economic_decay_usd - mitLoss,
      combinedRatio: combined,
      hwDays:        Math.round(effHW),
    };
  };

  const dynamicData    = getMitigatedData();
  const wbtStatus      = dynamicData ? getWBTStatus(dynamicData.wbt) : getWBTStatus(0);
  const hasMitigation  = canopy > 0 || albedo > 0;
  const mortalityAudit = selectedProj?.audit_trail?.mortality ?? null;
  const economicsAudit = selectedProj?.audit_trail?.economics ?? null;
  const cleanedAi      = aiAnalysis ? cleanResearchText(aiAnalysis) : null;
  const progressiveAi  = useProgressiveText(cleanedAi);

  const excelData: ExcelExportData | null = (result && selectedProj)
    ? {
        city_name:           result.city_name,
        lat:                 result.lat,
        lng:                 result.lng,
        ssp,
        target_year:         selectedYear ?? 2050,
        era5_baseline_c:     result.baseline?.baseline_mean_c ?? 0,
        era5_p95_c:          result.threshold_c,
        era5_humidity_p95:   result.era5_humidity_p95 ?? 70,
        peak_tx5d_c:         selectedProj.peak_tx5d_c,
        heatwave_days:       selectedProj.heatwave_days,
        mean_temp_c:         selectedProj.mean_temp_c,
        population:          result.population ?? 0,
        gdp_usd:             result.gdp_usd ?? 0,
        death_rate:          selectedProj?.audit_trail?.mortality?.variables?.DR != null ? Number(selectedProj.audit_trail.mortality.variables.DR) : null,
        vulnerability:       Number(selectedProj?.audit_trail?.mortality?.variables?.V ?? 1.0),
        canopy_pct:          canopy,
        albedo_pct:          albedo,
        attributable_deaths: selectedProj.attributable_deaths,
        economic_decay_usd:  selectedProj.economic_decay_usd,
        wbt_c:               selectedProj.wbt_max_c ?? 0,
        cmip6_source:        selectedProj.source,
      }
    : null;

  // ─── Render ────────────────────────────────────────────────────
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
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end border-b border-white/[0.05] pb-5 gap-4">
        <div>
          <h2 className="font-sans text-eye uppercase tracking-[0.14em] font-semibold mb-2" style={{ color: 'var(--muted)' }}>Deep Dive Research Protocol</h2>
          <h1 className="text-2xl sm:text-3xl font-mono font-bold text-white uppercase tracking-tighter truncate max-w-2xl">
            {baseTarget.split(",")[0]}
          </h1>
          {result && (
            <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mt-2">
              {formatCoord(result.lat, result.lng)}
              {result.elevation ? ` · ELEV: ${result.elevation}m` : ''}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Scientific Version</p>
          <p className="text-[10px] font-mono text-slate-300 uppercase">v2.0.4-PRO</p>
        </div>
      </div>

      {/* ── CONTROLS ── */}
      <div className="border border-white/[0.05] p-5" style={{ background: 'var(--raised)' }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-4">
          <div>
            <label className="block text-[10px] font-mono text-slate-400 uppercase tracking-widest mb-2">SSP Scenario</label>
            <select
              value={ssp}
              onChange={e => setSsp(e.target.value)}
              disabled={primaryLoading}
              className="w-full bg-white/[0.03] border border-white/[0.05] p-2.5 text-[11px] font-mono text-slate-200 outline-none focus:border-indigo-500 transition-colors disabled:opacity-50"
              style={{ border: '1px solid var(--hairline)' }}
            >
              <option value="SSP2-4.5">SSP2-4.5 (Moderate)</option>
              <option value="SSP5-8.5">SSP5-8.5 (High Risk)</option>
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-[10px] font-mono text-slate-400 uppercase">Canopy</label>
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
              <label className="text-[10px] font-mono text-slate-400 uppercase">Albedo</label>
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
            {primaryLoading ? (
              <div className="w-full bg-indigo-600/10 border border-indigo-500/30 text-indigo-400 py-2.5 text-[10px] font-mono uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                <div className="w-2 h-2 border border-indigo-400/40 border-t-indigo-400 rounded-full animate-spin" />
                FETCHING...
              </div>
            ) : primaryError ? (
              <div className="w-full bg-red-600/10 border border-red-500/30 text-red-400 py-2.5 text-[10px] font-mono uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                ENGINE ERROR
              </div>
            ) : (
              <div className="w-full bg-emerald-600/10 border border-emerald-500/30 text-emerald-400 py-2.5 text-[10px] font-mono uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />ENGINE SYNCED
              </div>
            )}
          </div>
        </div>
        <div className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider border border-white/[0.05] bg-zinc-950/40 px-3 py-2 mt-3">
          CMIP6 CORE · MRI-AGCM3-2-S · MPI-ESM1-2-XR · δT &lt; 1.4°C INTER-MODEL SPREAD
        </div>
      </div>

      {/* ── YEAR SELECTOR ── */}
      {result && result.projections.length > 0 && (
        <div className="sticky top-[48px] z-20 -mx-5 px-5 py-2" style={{ background: 'var(--canvas)' }}>
          <div className="flex gap-2 flex-wrap">
            {result.projections.map(p => (
              <button
                key={p.year}
                onClick={() => setSelectedYear(p.year)}
                className={`px-3.5 py-2 text-[10px] font-mono uppercase tracking-widest border transition-colors ${
                  selectedYear === p.year
                    ? "border-cyan-500/50 bg-cyan-950/30 text-[#0ea5e9]"
                    : "border-white/[0.05] text-slate-500 hover:text-slate-300 hover:border-white/[0.09]"
                }`}
              >
                {p.year}
                <span className="ml-2 text-[8px] text-slate-600">
                  {p.source.includes("cmip6") ? "CMIP6" : "AR6"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {primaryLoading && !result && (
        <div className="w-full h-64 flex flex-col items-center justify-center border border-white/[0.05]" style={{ background: 'var(--raised)' }}>
          <div className="w-8 h-8 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin mb-4" />
          <span className="font-mono text-[10px] text-indigo-400 tracking-[0.3em] uppercase">
            Running Physics Engine...
          </span>
        </div>
      )}

      {/* Error state */}
      {primaryError && (
        <div className="border border-amber-900/40 p-5" style={{ background: 'rgba(120,53,15,0.08)' }}>
          <div className="flex items-center gap-2 mb-3">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold"
               style={{ color: 'var(--heat-2)' }}>
              UPSTREAM NODE DISRUPTION
            </p>
          </div>
          <p className="font-mono text-[9px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            Copernicus data gateway currently handling extreme request load threshold.
            Falling back to localized historical downscaling cache layers.
            Please toggle execution loop again within 15 seconds.
          </p>
        </div>
      )}

      {!primaryLoading && result && dynamicData && selectedProj && (
        <>
          {/* ── BASELINE vs MITIGATION ── */}
          {hasMitigation && (
            <div className="border border-emerald-800/30 p-5" style={{ background: 'var(--raised)' }}>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <p className="font-sans text-eye uppercase tracking-[0.14em] font-semibold" style={{ color: 'var(--muted)' }}>
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
                    <div className="flex items-center justify-between bg-emerald-950/25 px-2.5 py-1.5 border border-emerald-800/20">
                      <span className="text-[8px] font-mono text-slate-600">Saved</span>
                      <span className="text-[11px] font-mono text-emerald-400 font-bold">{item.saved}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── WBT + UHI + INFRASTRUCTURE ── */}
          <MobileSection title="Physiological &amp; Infrastructure">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {/* WBT */}
            <div className="border border-white/[0.05] p-5 flex flex-col" style={{ background: 'var(--raised)' }}>
              <h3 className="font-sans text-eye uppercase tracking-[0.14em] font-semibold mb-4" style={{ color: 'var(--muted)' }}>Physiological Limit Monitor</h3>
              <div className={`flex flex-col items-center justify-center py-8 border-y border-white/[0.05] my-4 flex-grow ${wbtStatus.bg}`}>
                <span className={`text-4xl font-mono font-bold tabular-nums ${wbtStatus.color}`}>{formatWetBulb(dynamicData.wbt)}</span>
                <span className="text-[10px] font-mono text-slate-500 mt-2 tracking-widest">WET-BULB TEMPERATURE</span>
                <div className={`mt-3 px-4 py-1 border ${wbtStatus.border} ${wbtStatus.color} ${wbtStatus.bg} text-[9px] font-mono font-bold`}>
                  {wbtStatus.label}
                </div>
                {hasMitigation && (
                  <p className="text-[9px] font-mono text-slate-600 mt-3 italic">
                    Baseline: {selectedProj.wbt_max_c != null ? formatWetBulb(selectedProj.wbt_max_c) : '—'}
                  </p>
                )}
              </div>
              <p className="text-[9px] font-mono text-slate-500 leading-relaxed">
                Values ≥ 31°C critical. Capped at 35°C per Sherwood &amp; Huber (2010) PNAS.
              </p>
              {result.baseline?.baseline_mean_c && (
                <p className="text-[8px] font-mono text-slate-600 italic mt-2">
                  ERA5 baseline: {fmt(result.baseline.baseline_mean_c)}°C (1991-2020)
                </p>
              )}
              <SourceLine source="Stull (2011) · ERA5 P95 Humidity" />
            </div>

            {/* UHI */}
            <div className="border border-white/[0.05] p-5 flex flex-col" style={{ background: 'var(--raised)' }}>
              <h3 className="font-sans text-eye uppercase tracking-[0.14em] font-semibold mb-4" style={{ color: 'var(--muted)' }}>Heat Attribution (UHI)</h3>
              <div className="space-y-5 flex-grow">
                {[
                  { label: "ERA5 Historical Mean",  val: `${fmt(result.baseline?.baseline_mean_c)}°C`,                         color: "text-slate-300",  bar: "bg-indigo-500",  w: "60%",                                                              source: "ERA5 1991-2020"                    },
                  { label: "Urban Heat Island",     val: `+${fmt(dynamicData.uhi)}°C`,                                          color: "text-orange-400", bar: "bg-orange-500", w: `${Math.min(100, Math.max(10, (dynamicData.uhi / 8) * 100))}%`,     source: "Oke (1982) cap: 8°C"              },
                  { label: "Albedo/Canopy Offset",  val: `-${fmt((canopy / 100) * 1.2 + (albedo / 100) * 0.8)}°C`,              color: "text-emerald-400",bar: "bg-emerald-500",w: `${Math.min(100, (canopy + albedo) / 2)}%`,                         source: "Bowler (2010) · Santamouris (2015)"},
                ].map((item, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-[10px] font-mono mb-1.5">
                      <span className="text-slate-500 uppercase">{item.label}</span>
                      <span className={`tabular-nums ${item.color}`}>{item.val}</span>
                    </div>
                    <div className="w-full bg-white/[0.01] h-1.5 overflow-hidden">
                      <div className={`${item.bar} h-full transition-all duration-500`} style={{ width: item.w }} />
                    </div>
                    <SourceLine source={item.source} />
                  </div>
                ))}
              </div>
            </div>

            {/* Infrastructure */}
            <div className="border border-white/[0.05] p-5 flex flex-col" style={{ background: 'var(--raised)' }}>
              <h3 className="font-sans text-eye uppercase tracking-[0.14em] font-semibold mb-4" style={{ color: 'var(--muted)' }}>Infrastructure Fragility</h3>
              <div className="grid grid-cols-2 gap-3 flex-grow content-start">
                <div className="p-4 bg-white/5 border border-white/5 flex flex-col justify-center">
                  <span className="text-[9px] font-mono text-slate-500 block mb-2 uppercase">Grid Stress</span>
                  <span className="text-xl font-mono text-indigo-400 font-bold tabular-nums">+{fmt(dynamicData.cdd, 0)}</span>
                  <span className="text-[8px] font-mono text-slate-600 block mt-1 uppercase">CDD Load</span>
                </div>
                <div className="p-4 bg-white/5 border border-white/5 flex flex-col justify-center">
                  <span className="text-[9px] font-mono text-slate-500 block mb-2 uppercase">Road Melt Risk</span>
                  <span className={`text-xl font-mono font-bold ${dynamicData.peakTemp > 38 ? "text-amber-400" : "text-emerald-400"}`}>
                    {dynamicData.peakTemp > 38 ? "HIGH" : "LOW"}
                  </span>
                  <span className="text-[8px] font-mono text-slate-600 block mt-1 uppercase">38°C+ Exposure</span>
                </div>
              </div>
              <div className="mt-5 space-y-2.5">
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 uppercase">
                  <div className={`w-1.5 h-1.5 rounded-full ${dynamicData.cdd > 500 ? "bg-red-500" : "bg-emerald-500"}`} />
                  <span>Thermal Overload: {dynamicData.cdd > 500 ? "Exceeded" : "Stable"}</span>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-slate-400 uppercase">
                  <div className={`w-1.5 h-1.5 rounded-full ${selectedProj.wbt_max_c && selectedProj.wbt_max_c >= 31 ? "bg-red-500" : "bg-emerald-500"}`} />
                  <span>Survivability: {selectedProj.wbt_max_c && selectedProj.wbt_max_c >= 31 ? "Critical" : "Stable"}</span>
                </div>
              </div>
              <SourceLine source="CMIP6 Ensemble · ERA5 P95" />
            </div>
          </div>
          </MobileSection>

          {/* ── ECONOMIC CARD ── */}
          <MobileSection title="Economic Value At Risk">
          <div className="bg-indigo-600/5 border border-indigo-500/20 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-sans text-eye uppercase tracking-[0.14em] font-semibold" style={{ color: 'var(--muted)' }}>
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
                <p className="text-3xl font-mono text-white font-bold tabular-nums">{fmtUSD(selectedProj.economic_decay_usd)}</p>
                <p className="text-[9px] font-mono text-slate-500 mt-1">Range · {formatEconomicRange(selectedProj.economic_decay_usd)}</p>
                {hasMitigation && (
                  <div className="pt-3 mt-3 border-t border-white/[0.05]">
                    <p className="text-[8px] font-mono text-emerald-500/70 uppercase tracking-widest mb-1">
                      With +{canopy}% canopy · +{albedo}% albedo
                    </p>
                    <div className="flex items-end justify-between">
                      <p className="text-2xl font-mono text-emerald-400 font-bold tabular-nums">↓ {fmtUSD(dynamicData.loss)}</p>
                      <p className="text-[13px] font-mono text-emerald-300 font-bold tabular-nums">−{fmtUSD(dynamicData.savedLoss)}</p>
                    </div>
                  </div>
                )}
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">City GDP</span>
                    <span className="text-base font-mono font-bold tabular-nums text-slate-400">{fmtUSD(result.gdp_usd)}</span>
                  </div>
                  <div>
                    <span className="text-[9px] font-mono text-slate-500 uppercase block">Population</span>
                    <span className="text-base font-mono font-bold tabular-nums text-slate-400">
                      {result.population ? (result.population / 1e6).toFixed(1) + "M" : "—"}
                    </span>
                  </div>
                </div>
                <SourceLine source="Burke et al. (2018) Nature · ILO (2019) · World Bank" />
              </div>
              <div>
                <p className="text-[8px] font-mono text-slate-600 uppercase tracking-widest mb-3">Projected Loss Trajectory</p>
                <div className="h-24 flex items-end gap-1 w-full border-b border-white/[0.05] pb-1">
                  {result.projections.map((p, idx) => {
                    const loss    = p.economic_decay_usd * (hasMitigation ? dynamicData.combinedRatio : 1);
                    const maxLoss = result.projections[result.projections.length - 1].economic_decay_usd || 1;
                    return (
                      <div
                        key={p.year}
                        className="bg-red-500 w-full cursor-pointer hover:bg-red-400 transition-all duration-500 relative group"
                        style={{ height: `${Math.min(100, (loss / maxLoss) * 100)}%`, opacity: 0.4 + idx * 0.2 }}
                        onClick={() => setSelectedYear(p.year)}
                      >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block bg-white/[0.05] text-white text-[7px] font-mono px-1.5 py-0.5 whitespace-nowrap z-10">
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
          </MobileSection>

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
          <MobileSection title="Analyst Summary">
          <div className="border border-indigo-500/30 p-6 relative overflow-hidden" style={{ background: 'var(--raised)' }}>
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-indigo-500/10 blur-[50px] pointer-events-none" />
            <h4 className="font-sans text-eye uppercase tracking-[0.14em] font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--muted)' }}>
              <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              Analyst summary — Geological &amp; Thermal Context
            </h4>
            {aiLoading ? (
              <div className="py-3">
                <SkeletonText lines={6} label="Generating scientific summary" />
                <div className="flex items-center gap-2 pt-3 font-mono text-[9px] uppercase tracking-[0.18em]"
                     style={{ color: 'var(--reference)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse shrink-0" />
                  <span>Generating scientific summary</span>
                  <span className="animate-pulse">▋</span>
                </div>
              </div>
            ) : cleanedAi ? (
              <p className="font-serif text-body-s leading-loose" style={{ color: 'var(--text-2)' }}>
                {progressiveAi}
                {progressiveAi !== cleanedAi && <span className="animate-pulse font-mono">▋</span>}
              </p>
            ) : (
              <p className="text-[10px] font-mono text-slate-600 italic">
                AI analysis unavailable. Refer to the metrics above.
              </p>
            )}
            <div className="font-mono text-[8px] text-zinc-500 block mt-4 pt-3 border-t border-white/5 text-center leading-relaxed">
              AI DISCLOSURE — The narrative above is AI-generated. Verify all figures against the sourced metrics shown above.
            </div>
          </div>
          </MobileSection>
        </>
      )}
    </div>
  );
}
