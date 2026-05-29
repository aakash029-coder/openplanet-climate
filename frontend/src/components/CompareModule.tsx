'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  formatCoordinates,
  useClimateData,
} from "@/context/ClimateDataContext";
import { SideBySideMathModal } from './dashboard/SideBySideMathModal';
import { CompareTable, type CityResult } from './dashboard/CompareTable';

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

// ─────────────────────────────────────────────────────────────────
// CACHES
// ─────────────────────────────────────────────────────────────────
interface NominatimResult { place_id: string; name: string; display_name: string; lat: string; lon: string }

const nominatimCache = new Map<string, NominatimResult[]>();
const elevationCache = new Map<string, number>();

async function fetchNominatimSafe(query: string): Promise<NominatimResult[]> {
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
}, signal: AbortSignal): Promise<Record<string, unknown>> {

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
        if (Array.isArray(parsed.detail)) {
          humanMessage = parsed.detail
            .map((e: { loc?: string[]; msg?: string; type?: string }) =>
              `[${(e.loc ?? []).join(' → ')}] ${e.msg ?? e.type ?? 'unknown'}`
            )
            .join('  |  ');
        } else {
          humanMessage = String(parsed.detail);
        }
      }
    } catch {
      // rawText is already the fallback message
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

  const g            = geoData[0];
  const lat          = parseFloat(g.lat);
  const lng          = parseFloat(g.lon);
  const elevation    = await fetchElevationSafe(lat, lng);
  const locationHint = (g.display_name ?? query).trim();

  const controller = new AbortController();
  const timer      = setTimeout(() => controller.abort(), 30000);

  try {
    const riskData = await fetchClimateRisk(
      { lat, lng, elevation, ssp, canopy_offset_pct: 0, albedo_offset_pct: 0, location_hint: locationHint },
      controller.signal
    );
    clearTimeout(timer);
    return { query, display_name: g.display_name, lat, lng, elevation, ...riskData } as Omit<CityResult, 'loading' | 'error'>;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

const COMPARE_YEARS = [2030, 2050];

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
export default function CompareModule({ baseTarget }: { baseTarget: string }) {
  const { primaryData, primaryLoading, fetchPrimaryCity, canopy, setCanopy, coolRoof: albedo, setCoolRoof: setAlbedo } = useClimateData();

  const [searchQuery2, setSearchQuery2] = useState("");
  const [suggestions2, setSuggestions2] = useState<any[]>([]);
  const [city2Geo, setCity2Geo]         = useState<{ lat: number; lng: number; display_name: string } | null>(null);

  const savedState = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('op_sync_state') || '{}') : {};
  const [ssp, setSsp]                 = useState(() => primaryData?.ssp || savedState.ssp || "SSP2-4.5");
  const [compareYear, setCompareYear] = useState(savedState.year ? Number(savedState.year) : 2050);

  const [results, setResults]         = useState<CityResult[]>([]);
  const [running, setRunning]         = useState(false);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [aiAnalysis, setAiAnalysis]   = useState<string | null>(null);
  const [aiLoading, setAiLoading]     = useState(false);
  const [retryStatus, setRetryStatus] = useState<string | null>(null);
  const [mathModal, setMathModal]     = useState<{
    open: boolean; metricLabel: string; metricKey: string;
    valA: number | null; valB: number | null;
  }>({ open: false, metricLabel: '', metricKey: '', valA: null, valB: null });

  const primaryDataRef = useRef(primaryData);
  useEffect(() => { primaryDataRef.current = primaryData; });

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('op_sync_state', JSON.stringify({ ssp, year: compareYear.toString() }));
  }, [ssp, compareYear]);

  // When SSP / mitigation changes, re-fetch City A via context
  const lastFetchParamsRef = useRef({ ssp: '', canopy: -1, albedo: -1 });
  useEffect(() => {
    const pd = primaryDataRef.current;
    if (!pd) return;
    const p = lastFetchParamsRef.current;
    if (p.ssp === ssp && p.canopy === canopy && p.albedo === albedo) return;
    lastFetchParamsRef.current = { ssp, canopy, albedo };
    fetchPrimaryCity({
      city_name: pd.city_name, lat: pd.lat, lng: pd.lng,
      ssp, canopy_offset_pct: canopy, albedo_offset_pct: albedo, elevation: pd.elevation,
    });
  }, [ssp, canopy, albedo]); // intentionally omit primaryData/fetchPrimaryCity

  useEffect(() => {
    if (city2Geo || searchQuery2.length <= 2) { setSuggestions2([]); return; }
    const timer = setTimeout(async () => {
      const data = await fetchNominatimSafe(searchQuery2);
      setSuggestions2(data.map((c) => ({
        id:        c.place_id,
        name:      c.name || c.display_name.split(',')[0],
        country:   c.display_name.split(',').pop()?.trim() ?? '',
        latitude:  parseFloat(c.lat),
        longitude: parseFloat(c.lon),
      })));
    }, 600);
    return () => clearTimeout(timer);
  }, [searchQuery2, city2Geo]);

  const handleCompare = async () => {
    if (!primaryData || !city2Geo || running) return;
    setGlobalError(null); setRunning(true); setAiAnalysis(null); setRetryStatus(null);

    const cityAResult: CityResult = {
      query:            primaryData.city_name,
      display_name:     primaryData.city_name,
      lat:              primaryData.lat,
      lng:              primaryData.lng,
      elevation:        primaryData.elevation ?? 0,
      threshold_c:      primaryData.threshold_c,
      cooling_offset_c: primaryData.cooling_offset_c,
      gdp_usd:          primaryData.gdp_usd ?? null,
      population:       primaryData.population ?? null,
      projections:      primaryData.projections.map(p => ({
        year: p.year, source: p.source, heatwave_days: p.heatwave_days,
        peak_tx5d_c: p.peak_tx5d_c, wbt_max_c: p.wbt_max_c, uhi_intensity_c: p.uhi_intensity_c,
        attributable_deaths: p.attributable_deaths, economic_decay_usd: p.economic_decay_usd,
        region: p.region, audit_trail: p.audit_trail,
      })),
      baseline: primaryData.baseline,
      loading: false, error: null,
    };

    setResults([cityAResult, {
      query: city2Geo.display_name, display_name: city2Geo.display_name, lat: 0, lng: 0,
      elevation: 0, threshold_c: 0, cooling_offset_c: 0, gdp_usd: null, population: null,
      projections: [], baseline: { baseline_mean_c: null }, loading: true, error: null,
    }]);

    const newResults: CityResult[] = [cityAResult];
    let success = false; let retries = 3; let lastError: unknown = null;
    while (!success && retries > 0) {
      try {
        if (retries < 3) setRetryStatus(`Retrying ${city2Geo.display_name}... (${4 - retries}/3)`);
        const data = await geocodeAndFetch(city2Geo.display_name, ssp);
        if (data) newResults.push({ ...data, loading: false, error: null });
        success = true; setRetryStatus(null);
      } catch (err: unknown) {
        lastError = err; retries--;
        if (retries > 0) await new Promise(r => setTimeout(r, 3000));
      }
    }
    if (!success) {
      const errMsg = String(lastError instanceof Error ? lastError.message : lastError).replace('Error: ', '');
      newResults.push({
        query: city2Geo.display_name, display_name: city2Geo.display_name, lat: 0, lng: 0,
        elevation: 0, threshold_c: 0, cooling_offset_c: 0, gdp_usd: null, population: null,
        projections: [], baseline: { baseline_mean_c: null }, loading: false, error: errMsg,
      });
    }
    setResults(newResults);
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
            method: "POST",
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
          if (!aiResp.ok) throw new Error(`AI API ${aiResp.status}`);
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

  const okResults = results.filter(r => !r.loading && !r.error && r.projections?.length > 0);
  const projA     = okResults[0]?.projections?.find(p => p.year === compareYear) ?? null;
  const projB     = okResults[1]?.projections?.find(p => p.year === compareYear) ?? null;

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
      <div className="border border-white/[0.05] p-5 md:p-8 relative overflow-hidden" style={{ background: 'var(--raised)' }}>
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 blur-[100px] pointer-events-none" />
        <h2 className="font-sans text-eye uppercase tracking-[0.14em] font-semibold mb-6" style={{ color: 'var(--muted)' }}>City comparison</h2>

        {/* City cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          {/* City A — locked to primaryData */}
          <div className="relative border border-white/[0.09] overflow-hidden min-h-[120px] flex flex-col justify-center p-5 bg-black">
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(34,211,238,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(34,211,238,0.3) 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent z-10" />
            <div className="relative z-20">
              <span className="text-[10px] font-mono text-[#0ea5e9] uppercase tracking-widest block mb-1 font-bold">City A — Locked</span>
              <h3 className="text-lg md:text-xl font-mono text-white tracking-wider uppercase truncate" title={primaryData?.city_name ?? baseTarget}>
                {primaryData?.city_name ?? baseTarget}
              </h3>
              {primaryData && (
                <span className="text-[9px] font-mono text-slate-400 tracking-widest block mt-1">
                  {formatCoordinates(primaryData.lat, primaryData.lng)}
                </span>
              )}
              {primaryLoading && (
                <span className="text-[9px] font-mono text-[#0ea5e9]/60 tracking-widest block mt-1">Loading...</span>
              )}
            </div>
          </div>

          {/* City B input */}
          <div className={`relative border overflow-visible min-h-[120px] flex flex-col justify-center p-5 bg-black transition-colors ${city2Geo ? 'border-emerald-500/50' : 'border-white/[0.05]'}`}>
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'linear-gradient(rgba(16,185,129,0.3) 1px,transparent 1px),linear-gradient(90deg,rgba(16,185,129,0.3) 1px,transparent 1px)', backgroundSize: '24px 24px' }} />
            <div className="absolute inset-0 bg-gradient-to-r from-black via-black/80 to-transparent z-10" />
            <div className="relative z-20 w-full overflow-visible">
              <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest block mb-3 font-bold">City B — Target</span>
              <div className="relative w-full overflow-visible">
                <input
                  type="text"
                  value={searchQuery2}
                  onChange={(e) => { setSearchQuery2(e.target.value); if (city2Geo) setCity2Geo(null); }}
                  placeholder="Search city to compare..."
                  className="w-full bg-white/[0.03] p-3 text-[11px] font-mono text-white placeholder-slate-500 outline-none focus:border-white/20 transition-colors uppercase tracking-widest"
                  style={{ border: '1px solid var(--hairline)' }}
                />
                {suggestions2.length > 0 && !city2Geo && (
                  <div className="absolute top-full left-0 w-full mt-2 border border-white/[0.05] z-[9999] max-h-48 overflow-y-auto" style={{ background: 'var(--panel)' }}>
                    {suggestions2.map((city, idx) => (
                      <div
                        key={`${city.id}-${idx}`}
                        onClick={() => {
                          const n = `${city.name}, ${city.country}`;
                          setSearchQuery2(n);
                          setCity2Geo({ display_name: n, lat: city.latitude, lng: city.longitude });
                          setSuggestions2([]);
                        }}
                        className="px-4 py-3 text-[10px] font-mono text-slate-300 hover:bg-white/[0.05] hover:text-white cursor-pointer transition-colors border-b border-white/[0.05] last:border-0 uppercase tracking-widest"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-5 bg-cyan-950/10 border border-cyan-500/10 mb-6">
          <div>
            <label className="block text-[10px] font-mono text-slate-300 uppercase tracking-widest mb-2">Scenario</label>
            <select
              value={ssp}
              onChange={(e) => setSsp(e.target.value)}
              className="w-full bg-black/40 px-3 py-2 text-xs font-mono text-[#0ea5e9] outline-none focus:border-white/20"
              style={{ border: '1px solid var(--hairline)' }}
            >
              <option value="SSP2-4.5">SSP2-4.5 (MODERATE)</option>
              <option value="SSP5-8.5">SSP5-8.5 (HIGH RISK)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-mono text-slate-300 uppercase tracking-widest mb-2">Year</label>
            <select
              value={compareYear}
              onChange={(e) => setCompareYear(Number(e.target.value))}
              className="w-full bg-black/40 px-3 py-2 text-xs font-mono text-white outline-none focus:border-white/20"
              style={{ border: '1px solid var(--hairline)' }}
            >
              {COMPARE_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-[10px] font-mono text-slate-300 uppercase">Canopy</label>
              <span className="text-[10px] font-mono text-emerald-400">+{canopy}%</span>
            </div>
            <input type="range" min={0} max={50} value={canopy} onChange={(e) => setCanopy(Number(e.target.value))} className="w-full accent-emerald-500 cursor-pointer" style={{ touchAction: 'manipulation' }} />
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-[10px] font-mono text-slate-300 uppercase">Albedo</label>
              <span className="text-[10px] font-mono text-sky-400">+{albedo}%</span>
            </div>
            <input type="range" min={0} max={100} value={albedo} onChange={(e) => setAlbedo(Number(e.target.value))} className="w-full accent-cyan-500 cursor-pointer" style={{ touchAction: 'manipulation' }} />
          </div>
        </div>

        <button
          onClick={handleCompare}
          disabled={running || !city2Geo || !primaryData || primaryLoading}
          className="w-full md:w-auto px-10 py-3 bg-cyan-900 border border-cyan-500/50 text-white font-mono text-xs font-bold uppercase tracking-[0.2em] hover:bg-cyan-800 disabled:opacity-50 transition-all"
          style={{ touchAction: 'manipulation' }}
        >
          {running ? "PROCESSING..." : primaryLoading ? "LOADING CITY A..." : "RUN COMPARISON"}
        </button>

        {retryStatus && (
          <p className="mt-4 text-[10px] font-mono text-[#0ea5e9] font-bold uppercase tracking-widest">
            <span className="inline-block w-2 h-2 bg-[#0ea5e9] rounded-full mr-2" />{retryStatus}
          </p>
        )}
        {globalError && (
          <div className="mt-4 border border-amber-900/40 p-4" style={{ background: 'rgba(120,53,15,0.08)' }}>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold mb-2" style={{ color: 'var(--heat-2)' }}>
              UPSTREAM NODE DISRUPTION
            </p>
            <p className="font-mono text-[9px] leading-relaxed" style={{ color: 'var(--muted)' }}>
              Copernicus data gateway currently handling extreme request load threshold.
              Falling back to localized historical downscaling cache layers.
              Please toggle execution loop again within 15 seconds.
            </p>
          </div>
        )}
      </div>

      {/* Loading */}
      {results.some(r => r.loading) && (
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
          {results.map((r, i) => (
            <div key={i} className="border border-white/[0.05] p-6 h-28 flex items-center justify-center" style={{ background: 'var(--raised)' }}>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-[#0ea5e9] rounded-full animate-ping" />
                <span className="text-[9px] font-mono text-[#0ea5e9] uppercase tracking-widest">
                  {r.loading ? 'Loading telemetry...' : 'Processing...'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── RESULTS ── */}
      {okResults.length === 2 && !running && (
        <CompareTable
          okResults={okResults}
          compareYear={compareYear}
          canopy={canopy}
          albedo={albedo}
          ssp={ssp}
          projA={projA}
          projB={projB}
          aiAnalysis={aiAnalysis}
          aiLoading={aiLoading}
          onMathModal={(p) => setMathModal({ ...p, open: true })}
        />
      )}

      {/* Errors */}
      {results.filter(r => r.error).map(r => (
        <div key={r.query} className="border border-amber-900/40 px-5 py-4"
             style={{ background: 'rgba(120,53,15,0.06)' }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] font-bold truncate"
                  style={{ color: 'var(--heat-2)' }}>
              UPSTREAM NODE DISRUPTION — {r.query}
            </span>
          </div>
          <p className="font-mono text-[9px] leading-relaxed" style={{ color: 'var(--muted)' }}>
            Copernicus data gateway currently handling extreme request load threshold.
            Falling back to localized historical downscaling cache layers.
            Please toggle execution loop again within 15 seconds.
          </p>
        </div>
      ))}
    </div>
  );
}
