'use client';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useClimateData } from '@/context/ClimateDataContext';
import { type MapRef } from 'react-map-gl/maplibre';
import { parseLoss, fmtLoss, fetchElevationSafe } from './MapHelpers';
import { LeftPanel, RightPanel, type SuggestionCity, type PanelSelectedCity, type MitigatedData } from './MapPanels';
import { AnalyticsSection } from './MapCharts';
import { buildReportModel } from '@/lib/reportData';
import MapCanvas from './map/MapCanvas';
import HistoricalErasPanel from './map/HistoricalErasPanel';
import { buildHexLayer } from './map/hexLayer';

type SelectedCity = PanelSelectedCity;
type ViewState = { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number };

export default function MapModule({ onTargetLocked }: { onTargetLocked?: (city: string) => void }) {
  const { fetchPrimaryCity, primaryData, canopy, setCanopy, coolRoof, setCoolRoof } = useClimateData();

  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestionCity[]>([]);
  const [selectedCity, setSelectedCity] = useState<SelectedCity | null>(null);
  const [viewState, setViewState] = useState<ViewState>({ longitude: 0, latitude: 20, zoom: 1.8, pitch: 0, bearing: 0 });

  const savedState = typeof window !== 'undefined' ? (() => { try { return JSON.parse(localStorage.getItem('op_sync_state') || '{}'); } catch { return {}; } })() : {};
  const urlParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const [ssp, setSsp] = useState(urlParams.get('ssp') || savedState.ssp || 'SSP2-4.5');
  const [year, setYear] = useState(urlParams.get('year') || savedState.year || '2050');
  const [shareCopied, setShareCopied] = useState(false);
  const didAutoRun = useRef(false);

  const [isMobile, setIsMobile] = useState(false);
  const [mapInteractive, setMapInteractive] = useState(false);
  const mapLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayLastTapRef = useRef<number>(0);
  const overlayTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => { localStorage.setItem('op_sync_state', JSON.stringify({ ssp, year })); }, [ssp, year]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => () => { if (mapLockTimerRef.current) clearTimeout(mapLockTimerRef.current); }, []);

  const writeShareUrl = useCallback((cityName: string, lat: number, lng: number) => {
    if (typeof window === 'undefined') return;
    const p = new URLSearchParams();
    p.set('city', cityName);
    if (Number.isFinite(lat) && lat !== 0) p.set('lat', lat.toFixed(4));
    if (Number.isFinite(lng) && lng !== 0) p.set('lng', lng.toFixed(4));
    p.set('year', year);
    p.set('ssp', ssp);
    window.history.replaceState(null, '', `${window.location.pathname}?${p.toString()}`);
  }, [year, ssp]);

  const handleCopyShareLink = useCallback(async () => {
    if (typeof window === 'undefined') return;
    try {
      await navigator.clipboard.writeText(window.location.href);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch { /* Clipboard blocked */ }
  }, []);

  const unlockMap = useCallback(() => {
    setMapInteractive(true);
    if (mapLockTimerRef.current) clearTimeout(mapLockTimerRef.current);
    mapLockTimerRef.current = setTimeout(() => setMapInteractive(false), 8000);
  }, []);

  const lockMap = useCallback(() => {
    setMapInteractive(false);
    if (mapLockTimerRef.current) clearTimeout(mapLockTimerRef.current);
  }, []);

  const handleOverlayTouchStart = useCallback((e: React.TouchEvent) => {
    overlayTouchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, []);

  const handleOverlayTouchEnd = useCallback((e: React.TouchEvent) => {
    if (!overlayTouchStartRef.current) return;
    const dx = Math.abs(e.changedTouches[0].clientX - overlayTouchStartRef.current.x);
    const dy = Math.abs(e.changedTouches[0].clientY - overlayTouchStartRef.current.y);
    overlayTouchStartRef.current = null;
    if (dx > 8 || dy > 8) return;
    const now = Date.now();
    if (now - overlayLastTapRef.current < 300) unlockMap();
    overlayLastTapRef.current = now;
  }, [unlockMap]);

  const [pdfBusy, setPdfBusy] = useState(false);
  const [hexData, setHexData] = useState<Array<{ hex_id: string; position: [number, number]; risk_weight?: number }>>([]);
  const [auditTrail, setAuditTrail] = useState<Record<string, unknown> | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<Record<string, string> | null>(null);
  const [chartData, setChartData] = useState<{ heatwave: Array<{ year: string; val: number }>; economic: Array<{ year: string; noAction: number; adapt: number }> }>({ heatwave: [], economic: [] });
  const [historicalEras, setHistoricalEras] = useState<Record<string, { label: string; peak_temp: string; avg_mean_temp: string }> | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditKey, setAuditKey] = useState<'mortality' | 'economics' | 'wetbulb'>('mortality');

  const isSimulating = canopy > 0 || coolRoof > 0;
  const openAudit = (k: 'mortality' | 'economics' | 'wetbulb') => { setAuditKey(k); setAuditOpen(true); };
  const mapRef = useRef<MapRef | null>(null);

  const handleDownloadPdf = useCallback(async () => {
    if (pdfBusy) return;
    const model = buildReportModel(primaryData, Number(year));
    if (!model) return;
    setPdfBusy(true);
    try {
      let mapImage: string | null = null;
      try {
        const mlMap = mapRef.current?.getMap?.() as { redraw?: () => void; getCanvas?: () => HTMLCanvasElement } | undefined;
        mlMap?.redraw?.();
        const canvas = mlMap?.getCanvas?.();
        const dataUrl = canvas?.toDataURL?.('image/png');
        if (dataUrl && dataUrl.length > 5000) mapImage = dataUrl;
      } catch { mapImage = null; }
      const { downloadClimateReport } = await import('./ClimateReportPDF');
      await downloadClimateReport(model, mapImage, { aiAnalysis: aiAnalysis ?? undefined, historicalEras: historicalEras ?? undefined });
    } catch { /* Generation failed */ } finally { setPdfBusy(false); }
  }, [pdfBusy, primaryData, year, aiAnalysis, historicalEras]);

  const canGenerate = selectedCity !== null;

  const currentProjection = useMemo(() => {
    if (!primaryData?.projections?.length) return null;
    const y = Number(year);
    return primaryData.projections.find(p => p.year === y) ??
      primaryData.projections.reduce((closest, p) => Math.abs(p.year - y) < Math.abs(closest.year - y) ? p : closest);
  }, [primaryData, year]);

  const mitigatedData = useMemo((): MitigatedData | null => {
    if (!isInitialized || !currentProjection) return null;
    const cooling = (canopy / 100) * 1.2 + (coolRoof / 100) * 0.8;
    const baseT = currentProjection.peak_tx5d_c, baseH = currentProjection.heatwave_days;
    const baseW = currentProjection.wbt_max_c, baseD = currentProjection.attributable_deaths;
    const baseL = currentProjection.economic_decay_usd;
    const mitTemp = Math.max(0, baseT - cooling), mitWbt = Math.max(0, baseW - cooling * 0.75);
    const mitHW = Math.max(0, Math.round(baseH - cooling * 3));
    const effHW = Math.max(0, baseH - cooling * 3.5), hwR = baseH > 0 ? effHW / baseH : 1;
    const combined = hwR * Math.max(0, 1 - cooling * 0.08);
    const mitD = Math.round(baseD * combined), savedD = Math.max(0, Math.round(baseD - mitD));
    const mitL = baseL * combined;
    return {
      temp: mitTemp.toFixed(1), tempDelta: Math.max(0, baseT - mitTemp).toFixed(1),
      wbt: mitWbt.toFixed(1), wbtDelta: Math.max(0, baseW - mitWbt).toFixed(1),
      heatwave: mitHW.toString(), hwDelta: Math.max(0, baseH - mitHW).toString(),
      deaths: mitD.toLocaleString(), savedDeaths: savedD.toLocaleString(), savedDeathsNum: savedD,
      loss: fmtLoss(mitL), savedLoss: fmtLoss(Math.max(0, baseL - mitL)), savedLossNum: Math.max(0, baseL - mitL),
    };
  }, [isInitialized, currentProjection, canopy, coolRoof]);

  const baseDeathsNum = currentProjection?.attributable_deaths ?? 0;

  useEffect(() => {
    const lockedQuery = selectedCity?.locationQuery?.trim();
    if (isInitialized && lockedQuery && searchQuery.trim() && searchQuery.trim() !== lockedQuery) {
      setIsInitialized(false); setHistoricalEras(null); setSelectedCity(null); setHexData([]);
    }
  }, [searchQuery, isInitialized, selectedCity?.locationQuery]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (searchQuery.length > 2 && !selectedCity) {
        try {
          const res = await fetch(`/api/geocode-search?q=${encodeURIComponent(searchQuery)}`, { headers: { 'Accept': 'application/json' } });
          if (!res.ok) return;
          const data: { results: Array<{ id: string; name: string; display_name: string; country: string; country_code: string; latitude: number; longitude: number; source: string; }> } = await res.json();
          setSuggestions((data.results ?? []).map((c) => ({ id: c.id, name: c.name, display_name: c.display_name, country: c.country, latitude: c.latitude, longitude: c.longitude })));
        } catch { /* Geocode search failed */ }
      } else { setSuggestions([]); }
    }, 600);
    return () => clearTimeout(t);
  }, [searchQuery, selectedCity]);

  useEffect(() => {
    if (hexData && hexData.length > 0) {
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (const h of hexData) {
        const lng = h.position[0], lat = h.position[1];
        if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
      }
      try { mapRef.current?.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40, maxZoom: 11.5, duration: 2000 }); }
      catch { /* fitBounds failed */ }
    }
  }, [hexData]);

  const handleInitialize = useCallback(async (passedCity?: SelectedCity) => {
    const locationQuery = (passedCity?.locationQuery || selectedCity?.locationQuery || searchQuery).trim();
    if (!locationQuery) return;
    const cityToLoad: SelectedCity = passedCity || selectedCity || { locationQuery };
    const requestLat = cityToLoad.lat ?? cityToLoad.latitude ?? 0;
    const requestLng = cityToLoad.lng ?? cityToLoad.longitude ?? 0;
    setIsLoading(true); setApiError(null); setCanopy(0); setCoolRoof(0);
    setHistoricalEras(null); setHexData([]); setIsInitialized(false);
    const cleanName = cityToLoad.name && cityToLoad.country
      ? `${cityToLoad.name}, ${cityToLoad.country}`
      : locationQuery.split(',').slice(0, 2).map(s => s.trim()).join(', ') || locationQuery;
    try {
      const res = await fetch('/api/engine', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: '/api/predict', payload: { city: locationQuery, lat: requestLat, lng: requestLng, ssp, year, canopy: 0, coolRoof: 0 } }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      const resolved = data.resolvedLocation;
      const resolvedLat = typeof (resolved?.lat ?? resolved?.latitude) === 'number' ? (resolved?.lat ?? resolved?.latitude) : requestLat;
      const resolvedLng = typeof (resolved?.lng ?? resolved?.longitude) === 'number' ? (resolved?.lng ?? resolved?.longitude) : requestLng;
      const lockedCity: SelectedCity = { ...cityToLoad, locationQuery: cleanName, lat: resolvedLat, lng: resolvedLng, name: cityToLoad.name || cleanName.split(',')[0]?.trim() || cleanName };
      setSelectedCity(lockedCity); setSearchQuery(cleanName); writeShareUrl(cleanName, resolvedLat, resolvedLng);
      if (resolvedLat !== 0 && resolvedLng !== 0) mapRef.current?.flyTo({ center: [resolvedLng, resolvedLat], zoom: 10, duration: 1500 });
      setHexData(data.hexGrid || []); setAuditTrail(data.auditTrail ?? null); setAiAnalysis(data.aiAnalysis ?? null);
      setHistoricalEras(data.historicalEras ?? null);
      if (data.charts) setChartData({ heatwave: data.charts.heatwave || [], economic: data.charts.economic || [] });
      setIsInitialized(true);
      const elevation = await fetchElevationSafe(resolvedLat, resolvedLng);
      fetchPrimaryCity({ city_name: cleanName, lat: resolvedLat, lng: resolvedLng, ssp, canopy_offset_pct: 0, albedo_offset_pct: 0, elevation });
      if (onTargetLocked) onTargetLocked(cleanName);
    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Unknown error'); setIsInitialized(false);
    } finally { setIsLoading(false); }
  }, [selectedCity, searchQuery, ssp, year, onTargetLocked, fetchPrimaryCity, writeShareUrl]);

  useEffect(() => {
    if (isInitialized && selectedCity) {
      const lat = selectedCity.lat ?? selectedCity.latitude ?? 0;
      const lng = selectedCity.lng ?? selectedCity.longitude ?? 0;
      writeShareUrl(selectedCity.locationQuery || selectedCity.name || '', lat, lng);
    }
  }, [year, ssp, isInitialized, selectedCity, writeShareUrl]);

  useEffect(() => {
    if (didAutoRun.current) return;
    const city = urlParams.get('city');
    if (!city) return;
    didAutoRun.current = true;
    const lat = parseFloat(urlParams.get('lat') || ''), lng = parseFloat(urlParams.get('lng') || '');
    const seeded: SelectedCity = { locationQuery: city, name: city.split(',')[0]?.trim() || city, ...(Number.isFinite(lat) ? { lat, latitude: lat } : {}), ...(Number.isFinite(lng) ? { lng, longitude: lng } : {}) };
    setSearchQuery(city); setSelectedCity(seeded); handleInitialize(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const h3Data = useMemo(() => {
    if (!hexData || hexData.length === 0) return [];
    const cooling = (canopy / 100) * 1.2 + (coolRoof / 100) * 0.8;
    const riskReductionMultiplier = Math.max(0.1, 1 - cooling * 0.08);
    return hexData.map((d) => ({ hex: d.hex_id, risk: (d.risk_weight || 0) * riskReductionMultiplier }));
  }, [hexData, canopy, coolRoof]);

  const layers = useMemo(() => [buildHexLayer(h3Data, viewState.zoom)], [h3Data, viewState.zoom]);

  return (
    <div className="w-full flex flex-col items-center py-4 md:py-6 px-3 md:px-4 bg-[var(--canvas)] min-h-screen gap-0">
      <div className="w-full max-w-[1440px] flex flex-col md:flex-row gap-0 relative z-10"
        style={{ border: '1px solid var(--hairline)', height: 'auto' }}>
        <LeftPanel
          selectedCity={selectedCity} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          suggestions={suggestions} setSuggestions={setSuggestions} setSelectedCity={setSelectedCity}
          year={year} setYear={setYear} ssp={ssp} setSsp={setSsp}
          handleInitialize={handleInitialize} isLoading={isLoading} isInitialized={isInitialized}
          canGenerate={canGenerate} canopy={canopy} coolRoof={coolRoof}
          handleMitigationChange={(t: 'canopy' | 'coolRoof', v: number) => t === 'canopy' ? setCanopy(v) : setCoolRoof(v)}
          isSimulating={isSimulating}
        />
        <div className="flex-1 flex flex-col gap-1.5 min-w-0 min-h-0 w-full">
          <MapCanvas
            mapRef={mapRef} viewState={viewState} onMove={(vs) => setViewState(vs)}
            isLoading={isLoading} isInitialized={isInitialized} isMobile={isMobile}
            mapInteractive={mapInteractive} layers={layers} selectedCity={selectedCity}
            year={year} ssp={ssp} apiError={apiError}
            onZoomIn={() => mapRef.current?.zoomIn()} onZoomOut={() => mapRef.current?.zoomOut()}
            onLockMap={lockMap} handleOverlayTouchStart={handleOverlayTouchStart}
            handleOverlayTouchEnd={handleOverlayTouchEnd}
          />
          {isInitialized && selectedCity && (
            <div className="flex items-center justify-center gap-3 pt-2 pb-1 flex-wrap animate-fadeSlideUp">
              <p className="font-mono text-center" style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>
                {selectedCity.name || selectedCity.locationQuery} · {year} · {ssp} · CMIP6 ensemble projection
              </p>
              <button onClick={handleCopyShareLink} aria-label="Copy shareable link to this projection"
                className="flex items-center gap-1.5 px-2.5 py-1 font-mono uppercase tracking-[0.14em] transition-colors duration-150 hover:text-white"
                style={{ fontSize: '0.625rem', color: shareCopied ? 'var(--positive)' : 'var(--text-2)', border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
                {shareCopied ? (<><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>Link copied</>) : (<><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>Copy link</>)}
              </button>
              <button onClick={handleDownloadPdf} disabled={pdfBusy || !primaryData} aria-label="Download research-grade PDF report"
                className="flex items-center gap-1.5 px-2.5 py-1 font-mono uppercase tracking-[0.14em] transition-colors duration-150 hover:text-white disabled:opacity-40"
                style={{ fontSize: '0.625rem', color: 'var(--text-2)', border: '1px solid var(--hairline)', background: 'var(--raised)' }}>
                {pdfBusy ? (<><span className="w-2.5 h-2.5 border border-white/30 border-t-white/70 rounded-full animate-spin" />Building…</>) : (<><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>PDF report</>)}
              </button>
            </div>
          )}
        </div>
        <RightPanel isInitialized={isInitialized} year={Number(year)} isSimulating={isSimulating} mitigatedData={mitigatedData} openAudit={openAudit} />
      </div>

      {isInitialized && historicalEras && <HistoricalErasPanel historicalEras={historicalEras} />}

      <div className="w-full max-w-[1440px] z-0 mt-2 overflow-hidden" style={{ border: '1px solid var(--hairline)', background: 'var(--panel)' }}>
        <AnalyticsSection isLoading={isLoading} isInitialized={isInitialized} chartData={chartData} aiAnalysis={aiAnalysis} mitigatedData={mitigatedData} projection={currentProjection} baseDeathsNum={baseDeathsNum} selectedCity={selectedCity} />
      </div>

      {auditOpen && auditTrail && (
        <div className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-4" onClick={() => setAuditOpen(false)}>
          <div className="bg-[#060f1e] border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-[0_24px_80px_rgba(0,0,0,0.7)] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 bg-slate-900/30">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.5)]" />
                <p className="text-[10px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold">Calculation Source · {auditKey}</p>
              </div>
              <button onClick={() => setAuditOpen(false)} className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-white hover:bg-slate-800 transition-all text-sm">✕</button>
            </div>
            <pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap max-h-[60vh] overflow-y-auto p-5 leading-relaxed custom-scrollbar">
              {typeof auditTrail[auditKey] === 'string' ? auditTrail[auditKey] : JSON.stringify(auditTrail[auditKey], null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
