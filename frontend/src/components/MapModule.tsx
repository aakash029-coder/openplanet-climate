'use client';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useClimateData } from '@/context/ClimateDataContext';
import Map, { type MapRef, useControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { cartoDarkStyle, parseLoss, fmtLoss, fetchElevationSafe } from './MapHelpers';
import { LeftPanel, RightPanel, type SuggestionCity, type PanelSelectedCity, type MitigatedData } from './MapPanels';
import { AnalyticsSection } from './MapCharts';
import { buildReportModel } from '@/lib/reportData';

type SelectedCity = PanelSelectedCity;
type ViewState = { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number };

function DeckOverlay(props: MapboxOverlayProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

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
  // Shareable deep-link params take precedence over localStorage so a pasted
  // /dashboard?city=Delhi&year=2050&ssp=SSP5-8.5 link reproduces the exact view.
  const urlParams = typeof window !== 'undefined'
    ? new URLSearchParams(window.location.search)
    : new URLSearchParams();
  const [ssp, setSsp] = useState(urlParams.get('ssp') || savedState.ssp || 'SSP2-4.5');
  const [year, setYear] = useState(urlParams.get('year') || savedState.year || '2050');
  const [shareCopied, setShareCopied] = useState(false);
  const didAutoRun = useRef(false);

  // Mobile map interaction lock state — declared early so effects/callbacks can reference setters
  const [isMobile, setIsMobile] = useState(false);
  const [mapInteractive, setMapInteractive] = useState(false);
  const mapLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const overlayLastTapRef = useRef<number>(0);
  const overlayTouchStartRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    localStorage.setItem('op_sync_state', JSON.stringify({ ssp, year }));
  }, [ssp, year]);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener('resize', check, { passive: true });
    return () => window.removeEventListener('resize', check);
  }, []);

  useEffect(() => () => { if (mapLockTimerRef.current) clearTimeout(mapLockTimerRef.current); }, []);

  // ── Shareable link: write current selection to the URL (no reload) ──────────
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
    } catch {
      // Clipboard blocked — select-and-copy fallback is the browser's URL bar.
    }
  }, []);

  const unlockMap = useCallback(() => {
    setMapInteractive(true);
    if (mapLockTimerRef.current) clearTimeout(mapLockTimerRef.current);
    mapLockTimerRef.current = setTimeout(() => setMapInteractive(false), 8000);
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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapRef | null>(null);

  // ── Elite research-paper PDF export ─────────────────────────────────────────
  const handleDownloadPdf = useCallback(async () => {
    if (pdfBusy) return;
    const model = buildReportModel(primaryData, Number(year));
    if (!model) return; // no verified data → no report (never fabricate)
    setPdfBusy(true);
    try {
      // Capture the live map surface (hexes are interleaved into this canvas).
      // Only include the figure if a real, non-blank capture succeeds.
      let mapImage: string | null = null;
      try {
        const mlMap = mapRef.current?.getMap?.() as
          | { redraw?: () => void; getCanvas?: () => HTMLCanvasElement }
          | undefined;
        mlMap?.redraw?.();
        const canvas = mlMap?.getCanvas?.();
        const dataUrl = canvas?.toDataURL?.('image/png');
        // A blank capture is a short data URL; require real pixels.
        if (dataUrl && dataUrl.length > 5000) mapImage = dataUrl;
      } catch {
        mapImage = null;
      }
      const { downloadClimateReport } = await import('./ClimateReportPDF');
      await downloadClimateReport(model, mapImage, {
        aiAnalysis: aiAnalysis ?? undefined,
        historicalEras: historicalEras ?? undefined,
      });
    } catch {
      // Generation failed — leave UI unchanged; user can retry.
    } finally {
      setPdfBusy(false);
    }
  }, [pdfBusy, primaryData, year, aiAnalysis, historicalEras]);

  // Button only enabled after explicit dropdown selection — disabled while freely typing
  const canGenerate = selectedCity !== null;

  // Current projection from the single source of truth
  const currentProjection = useMemo(() => {
    if (!primaryData?.projections?.length) return null;
    const y = Number(year);
    return (
      primaryData.projections.find(p => p.year === y) ??
      primaryData.projections.reduce((closest, p) =>
        Math.abs(p.year - y) < Math.abs(closest.year - y) ? p : closest
      )
    );
  }, [primaryData, year]);

  // Mitigated values computed from primaryData projection (consistent with DeepDive/Compare)
  const mitigatedData = useMemo((): MitigatedData | null => {
    if (!isInitialized || !currentProjection) return null;
    const cooling = (canopy / 100) * 1.2 + (coolRoof / 100) * 0.8;
    const baseT  = currentProjection.peak_tx5d_c;
    const baseH  = currentProjection.heatwave_days;
    // wbt_max_c is always computed by the backend Stull formula — never approximated
    const baseW  = currentProjection.wbt_max_c;
    const baseD  = currentProjection.attributable_deaths;
    const baseL  = currentProjection.economic_decay_usd;

    const mitTemp = Math.max(0, baseT - cooling);
    const mitWbt  = Math.max(0, baseW - cooling * 0.75);
    const mitHW   = Math.max(0, Math.round(baseH - cooling * 3));
    const effHW   = Math.max(0, baseH - cooling * 3.5);
    const hwR     = baseH > 0 ? effHW / baseH : 1;
    const combined = hwR * Math.max(0, 1 - cooling * 0.08);
    const mitD    = Math.round(baseD * combined);
    const savedD  = Math.max(0, Math.round(baseD - mitD));
    const mitL    = baseL * combined;

    return {
      temp:          mitTemp.toFixed(1),
      tempDelta:     Math.max(0, baseT - mitTemp).toFixed(1),
      wbt:           mitWbt.toFixed(1),
      wbtDelta:      Math.max(0, baseW - mitWbt).toFixed(1),
      heatwave:      mitHW.toString(),
      hwDelta:       Math.max(0, baseH - mitHW).toString(),
      deaths:        mitD.toLocaleString(),
      savedDeaths:   savedD.toLocaleString(),
      savedDeathsNum: savedD,
      loss:          fmtLoss(mitL),
      savedLoss:     fmtLoss(Math.max(0, baseL - mitL)),
      savedLossNum:  Math.max(0, baseL - mitL),
    };
  }, [isInitialized, currentProjection, canopy, coolRoof]);

  const baseDeathsNum = currentProjection?.attributable_deaths ?? 0;

  useEffect(() => {
    const lockedQuery = selectedCity?.locationQuery?.trim();
    if (isInitialized && lockedQuery && searchQuery.trim() && searchQuery.trim() !== lockedQuery) {
      setIsInitialized(false);
      setHistoricalEras(null);
      setSelectedCity(null);
      setHexData([]);
    }
  }, [searchQuery, isInitialized, selectedCity?.locationQuery]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (searchQuery.length > 2 && !selectedCity) {
        try {
          const res = await fetch(
            `/api/geocode-search?q=${encodeURIComponent(searchQuery)}`,
            { headers: { 'Accept': 'application/json' } }
          );
          if (!res.ok) return;
          const data: {
            results: Array<{
              id: string;
              name: string;
              display_name: string;
              country: string;
              country_code: string;
              latitude: number;
              longitude: number;
              source: string;
            }>
          } = await res.json();
          setSuggestions((data.results ?? []).map((c) => ({
            id:           c.id,
            name:         c.name,
            display_name: c.display_name,
            country:      c.country,
            latitude:     c.latitude,
            longitude:    c.longitude,
          })));
        } catch {
          // Geocode search failed — suggestions stay empty, user can retry
        }
      } else {
        setSuggestions([]);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [searchQuery, selectedCity]);

  useEffect(() => {
    if (hexData && hexData.length > 0) {
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (let i = 0; i < hexData.length; i++) {
        const lng = hexData[i].position[0], lat = hexData[i].position[1];
        if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
      }
      try {
        mapRef.current?.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40, maxZoom: 11.5, duration: 2000 });
      } catch { /* fitBounds failed — retain current view */ }
    }
  }, [hexData]);

  const handleInitialize = useCallback(async (passedCity?: SelectedCity) => {
    const locationQuery = (
      passedCity?.locationQuery ||
      selectedCity?.locationQuery ||
      searchQuery
    ).trim();

    if (!locationQuery) return;

    const cityToLoad: SelectedCity = passedCity || selectedCity || { locationQuery };
    const requestLat = cityToLoad.lat ?? cityToLoad.latitude ?? 0;
    const requestLng = cityToLoad.lng ?? cityToLoad.longitude ?? 0;

    setIsLoading(true);
    setApiError(null);
    setCanopy(0);
    setCoolRoof(0);
    setHistoricalEras(null);
    setHexData([]);
    setIsInitialized(false);

    // Build clean "City, Country" name for the context key
    const cleanName = cityToLoad.name && cityToLoad.country
      ? `${cityToLoad.name}, ${cityToLoad.country}`
      : locationQuery.split(',').slice(0, 2).map(s => s.trim()).join(', ') || locationQuery;

    try {
      const res = await fetch('/api/engine', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/api/predict',
          payload: {
            city: locationQuery,
            lat: requestLat,
            lng: requestLng,
            ssp,
            year,
            canopy: 0,
            coolRoof: 0,
          },
        }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const resolved    = data.resolvedLocation;
      const resolvedLat = typeof (resolved?.lat ?? resolved?.latitude) === 'number'
        ? (resolved?.lat ?? resolved?.latitude) : requestLat;
      const resolvedLng = typeof (resolved?.lng ?? resolved?.longitude) === 'number'
        ? (resolved?.lng ?? resolved?.longitude) : requestLng;

      const lockedCity: SelectedCity = {
        ...cityToLoad,
        locationQuery: cleanName,
        lat: resolvedLat,
        lng: resolvedLng,
        name: cityToLoad.name || cleanName.split(',')[0]?.trim() || cleanName,
      };
      setSelectedCity(lockedCity);
      setSearchQuery(cleanName);
      writeShareUrl(cleanName, resolvedLat, resolvedLng);

      if (resolvedLat !== 0 && resolvedLng !== 0) {
        mapRef.current?.flyTo({ center: [resolvedLng, resolvedLat], zoom: 10, duration: 1500 });
      }

      setHexData(data.hexGrid || []);
      setAuditTrail(data.auditTrail ?? null);
      setAiAnalysis(data.aiAnalysis ?? null);
      setHistoricalEras(data.historicalEras ?? null);
      if (data.charts) {
        setChartData({ heatwave: data.charts.heatwave || [], economic: data.charts.economic || [] });
      }
      setIsInitialized(true);

      // Fetch elevation then populate the single source of truth for all tabs
      const elevation = await fetchElevationSafe(resolvedLat, resolvedLng);
      fetchPrimaryCity({
        city_name:         cleanName,
        lat:               resolvedLat,
        lng:               resolvedLng,
        ssp,
        canopy_offset_pct: 0,
        albedo_offset_pct: 0,
        elevation,
      });

      if (onTargetLocked) onTargetLocked(cleanName);

    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Unknown error');
      setIsInitialized(false);
    } finally {
      setIsLoading(false);
    }
  }, [selectedCity, searchQuery, ssp, year, onTargetLocked, fetchPrimaryCity, writeShareUrl]);

  // Keep the share URL current when scenario/year change after a city is locked.
  useEffect(() => {
    if (isInitialized && selectedCity) {
      const lat = selectedCity.lat ?? selectedCity.latitude ?? 0;
      const lng = selectedCity.lng ?? selectedCity.longitude ?? 0;
      writeShareUrl(selectedCity.locationQuery || selectedCity.name || '', lat, lng);
    }
  }, [year, ssp, isInitialized, selectedCity, writeShareUrl]);

  // Auto-run from a shareable deep link (?city=...&lat=...&lng=...) — once.
  useEffect(() => {
    if (didAutoRun.current) return;
    const city = urlParams.get('city');
    if (!city) return;
    didAutoRun.current = true;

    const lat = parseFloat(urlParams.get('lat') || '');
    const lng = parseFloat(urlParams.get('lng') || '');
    const seeded: SelectedCity = {
      locationQuery: city,
      name: city.split(',')[0]?.trim() || city,
      ...(Number.isFinite(lat) ? { lat, latitude: lat } : {}),
      ...(Number.isFinite(lng) ? { lng, longitude: lng } : {}),
    };
    setSearchQuery(city);
    setSelectedCity(seeded);
    handleInitialize(seeded);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const h3Data = useMemo(() => {
    if (!hexData || hexData.length === 0) return [];
    const cooling = (canopy / 100) * 1.2 + (coolRoof / 100) * 0.8;
    const riskReductionMultiplier = Math.max(0.1, 1 - cooling * 0.08);
    return hexData.map((d) => ({ hex: d.hex_id, risk: (d.risk_weight || 0) * riskReductionMultiplier }));
  }, [hexData, canopy, coolRoof]);

  type H3Datum = { hex: string; risk: number };
  const layers = useMemo(() => [
    new H3HexagonLayer<H3Datum>({
      id: 'h3-core-layer',
      data: h3Data,
      getHexagon: (d) => d.hex,
      getFillColor: (d) => {
        const risk = Math.max(0, Math.min(1, d.risk || 0));
        // heat-1 steel, heat-2 ochre, heat-3 amber, heat-4 oxide red, heat-5 deep oxide
        const h1: [number,number,number] = [47,  111, 143];  // #2F6F8F
        const h2: [number,number,number] = [183, 146, 55 ];  // #B79237
        const h3: [number,number,number] = [190, 106, 46 ];  // #BE6A2E
        const h4: [number,number,number] = [162, 58,  48 ];  // #A23A30
        const h5: [number,number,number] = [110, 32,  32 ];  // #6E2020
        let c1: [number,number,number], c2: [number,number,number], t: number;
        if      (risk < 0.25) { c1 = h1; c2 = h2; t = risk / 0.25; }
        else if (risk < 0.50) { c1 = h2; c2 = h3; t = (risk - 0.25) / 0.25; }
        else if (risk < 0.75) { c1 = h3; c2 = h4; t = (risk - 0.50) / 0.25; }
        else                  { c1 = h4; c2 = h5; t = (risk - 0.75) / 0.25; }
        return [
          Math.round(c1[0] + (c2[0] - c1[0]) * t),
          Math.round(c1[1] + (c2[1] - c1[1]) * t),
          Math.round(c1[2] + (c2[2] - c1[2]) * t),
          Math.round(140 + risk * 80),  // opacity 140-220, varies with intensity
        ];
      },
      extruded: false,
      coverage: viewState.zoom >= 11.5 ? 1.0 : 0.88,
      stroked: false,
      // @ts-expect-error -- beforeId is read by @deck.gl/mapbox interleaved resolver at runtime; not in LayerProps types
      beforeId: 'settlement-label',
      updateTriggers: { getFillColor: h3Data, coverage: viewState.zoom },
    }),
  ], [h3Data, viewState.zoom]);

  const SustainedHeatLabel = () => {
    const [tipPos, setTipPos] = React.useState<{ top: number; left: number } | null>(null);
    const btnRef = React.useRef<HTMLSpanElement>(null);
    const showTip = () => {
      if (!btnRef.current) return;
      const r = btnRef.current.getBoundingClientRect();
      setTipPos({ top: r.top - 8, left: r.left + r.width / 2 });
    };
    return (
      <div className="flex items-center gap-1.5 mb-1">
        <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Sustained Heat Average</p>
        <span
          ref={btnRef}
          className="flex items-center justify-center w-3 h-3 rounded-full border border-slate-600 text-[7px] text-slate-400 cursor-help"
          onMouseEnter={showTip}
          onMouseLeave={() => setTipPos(null)}
        >i</span>
        {tipPos && (
          <div
            className="fixed w-72 p-2.5 bg-[#060f1e] border border-slate-700 text-slate-400 text-[8px] leading-relaxed rounded shadow-xl z-[9999] -translate-x-1/2 -translate-y-full pointer-events-none"
            style={{ top: tipPos.top, left: tipPos.left }}
          >
            Note: This represents the decadal average of the hottest consecutive 5-day periods (Tx5d) across a 31km spatial grid. It smooths out 1-day anomalous spikes to provide stable actuarial baselines for economic models.
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col items-center py-4 md:py-6 px-3 md:px-4 bg-[var(--canvas)] min-h-screen gap-0">

      {/* ── MAP AREA ── */}
      {/* On mobile: column-reversed so map is on top, controls sheet below.
          On md+: side-by-side row with fixed viewport height. */}
      <div className="w-full max-w-[1440px] flex flex-col md:flex-row gap-0 relative z-10"
        style={{ border: '1px solid var(--hairline)', height: 'auto' }}
      >
        <LeftPanel
          selectedCity={selectedCity} searchQuery={searchQuery} setSearchQuery={setSearchQuery}
          suggestions={suggestions} setSuggestions={setSuggestions} setSelectedCity={setSelectedCity}
          year={year} setYear={setYear} ssp={ssp} setSsp={setSsp}
          handleInitialize={handleInitialize} isLoading={isLoading} isInitialized={isInitialized}
          canGenerate={canGenerate}
          canopy={canopy} coolRoof={coolRoof}
          handleMitigationChange={(t: any, v: any) => t === 'canopy' ? setCanopy(v) : setCoolRoof(v)}
          isSimulating={isSimulating}
        />

        {/* MAP CONTAINER */}
        <div className="flex-1 flex flex-col gap-1.5 min-w-0 min-h-0 w-full">
          <div
            ref={mapContainerRef}
            className="map-canvas-container transition-gpu overflow-hidden relative md:h-[clamp(44vh,calc(100vh_-_112px),100vh)] min-h-[220px] h-[42vh]"
            style={{ background: 'var(--canvas)', border: '1px solid var(--hairline)' }}
          >
            {/* Loading / idle placeholder — prevents DeckGL from initialising into a 0×0 canvas */}
            {!isInitialized && !isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 pointer-events-none">
                <p className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--muted)' }}>
                  Search a location to generate the risk exposure grid
                </p>
                <p className="font-mono text-[9px]" style={{ color: 'var(--muted)', opacity: 0.5 }}>
                  H3 hexagonal grid · CMIP6 ensemble · ERA5 baseline
                </p>
              </div>
            )}

            {/* Loading spinner overlay */}
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 bg-[#08080A]/70">
                <div className="w-7 h-7 border border-white/20 border-t-white/50 rounded-full animate-spin" />
                <p className="font-mono text-[10px] uppercase tracking-[0.25em]" style={{ color: 'var(--muted)' }}>
                  Computing risk exposure grid…
                </p>
              </div>
            )}

            <Map
              ref={mapRef}
              mapStyle={cartoDarkStyle}
              attributionControl={false}
              // Forwarded to the maplibre constructor so the canvas can be
              // captured for the PDF report (not in react-map-gl's prop types).
              {...({ preserveDrawingBuffer: true } as Record<string, unknown>)}
              reuseMaps
              longitude={viewState.longitude}
              latitude={viewState.latitude}
              zoom={viewState.zoom}
              pitch={viewState.pitch}
              bearing={viewState.bearing}
              onMove={({ viewState: vs }) => setViewState(vs as ViewState)}
              scrollZoom={false}
              doubleClickZoom={true}
              dragRotate={false}
              dragPan={!isMobile || mapInteractive}
              style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' }}
            >
              <DeckOverlay layers={layers} interleaved />
            </Map>

            {/* Mobile map interaction lock — sits below zoom/legend controls (z-25) so
                they remain tappable, but intercepts raw map drag events.
                touchAction: pan-y lets the page scroll vertically through this overlay. */}
            {isMobile && !mapInteractive && !isLoading && (
              <div
                className="absolute inset-0 z-[25] flex items-center justify-center"
                style={{ touchAction: 'pan-y' }}
                onTouchStart={handleOverlayTouchStart}
                onTouchEnd={handleOverlayTouchEnd}
              >
                <div
                  className="flex items-center gap-2 px-3 py-2"
                  style={{ background: 'rgba(5,6,8,0.82)', border: '1px solid var(--hairline)' }}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ color: 'var(--muted)' }}>
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: 'var(--muted)' }}>
                    Double-tap to interact
                  </span>
                </div>
              </div>
            )}
            {isMobile && mapInteractive && (
              <button
                className="absolute bottom-4 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1.5 px-3 py-1.5"
                style={{ background: 'rgba(5,6,8,0.85)', border: '1px solid var(--hairline)', touchAction: 'manipulation' }}
                onClick={() => { setMapInteractive(false); if (mapLockTimerRef.current) clearTimeout(mapLockTimerRef.current); }}
                aria-label="Lock map interaction"
              >
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true" style={{ color: 'var(--positive)' }}>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" /><rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                </svg>
                <span className="font-mono text-[9px] uppercase tracking-[0.18em]" style={{ color: 'var(--positive)' }}>
                  Map active · tap to lock
                </span>
              </button>
            )}

            {/* Zoom controls — 44px touch targets */}
            <div className="absolute top-3 right-3 z-50 flex flex-col glass-nav" style={{ border: '1px solid var(--hairline)' }}>
              <button
                onClick={() => mapRef.current?.zoomIn()}
                className="w-11 h-11 flex items-center justify-center text-base font-mono transition-colors duration-150"
                style={{ borderBottom: '1px solid var(--hairline)', color: 'var(--muted)', touchAction: 'manipulation' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                aria-label="Zoom in"
              >+</button>
              <button
                onClick={() => mapRef.current?.zoomOut()}
                className="w-11 h-11 flex items-center justify-center text-base font-mono transition-colors duration-150"
                style={{ color: 'var(--muted)', touchAction: 'manipulation' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
                onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
                aria-label="Zoom out"
              >−</button>
            </div>

            {/* Risk legend */}
            {isInitialized && (
              <div className="absolute bottom-4 left-3 z-50 bg-[#08080A]/95 px-2 py-1.5 md:px-3 md:py-2.5 origin-bottom-left scale-90 md:scale-100"
                   style={{ border: '1px solid var(--hairline)' }}>
                {/* Eyebrow */}
                <p className="font-mono uppercase tracking-[0.14em] mb-1 md:mb-2 text-[9px] md:text-[11px]"
                   style={{ color: 'var(--muted)' }}>
                  Heat exposure (°C) · {year} · {ssp}
                </p>
                {/* Quantitative ramp with 5 stops */}
                <div className="flex items-center gap-0">
                  {[
                    { color: '#2F6F8F', label: '34' },
                    { color: '#B79237', label: '37' },
                    { color: '#BE6A2E', label: '40' },
                    { color: '#A23A30', label: '43' },
                    { color: '#6E2020', label: '46+' },
                  ].map(({ color, label }) => (
                    <div key={label} className="flex flex-col items-center">
                      <div className="w-8 h-2" style={{ background: color }} />
                      <span className="font-mono mt-1" style={{ fontSize: '0.6rem', color: 'var(--muted)' }}>{label}</span>
                    </div>
                  ))}
                </div>
                {/* Instrument chrome */}
                {selectedCity && (
                  <p className="font-mono mt-2 pt-2" style={{ fontSize: '0.6rem', color: 'var(--muted)', borderTop: '1px solid var(--hairline)' }}>
                    H3 r9 · WGS84 ·{' '}
                    {selectedCity.lat !== undefined ? `${selectedCity.lat.toFixed(2)}°N ${selectedCity.lng !== undefined ? Math.abs(selectedCity.lng).toFixed(2) : ''}°${(selectedCity.lng ?? 0) >= 0 ? 'E' : 'W'}` : ''}
                  </p>
                )}
              </div>
            )}

            {/* API error */}
            {apiError && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-[#08080A]/95 px-5 py-3" style={{ border: '1px solid var(--heat-4)' }}>
                <p className="text-[10px] font-mono text-red-400 flex items-center gap-2 font-bold uppercase tracking-widest">
                  <span className="text-red-500">⚠</span> {apiError}
                </p>
              </div>
            )}
          </div>

          {isInitialized && selectedCity && (
            <div className="flex items-center justify-center gap-3 pt-2 pb-1 flex-wrap animate-fadeSlideUp">
              <p className="font-mono text-center"
                 style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>
                {selectedCity.name || selectedCity.locationQuery} · {year} · {ssp} · CMIP6 ensemble projection
              </p>
              <button
                onClick={handleCopyShareLink}
                aria-label="Copy shareable link to this projection"
                className="flex items-center gap-1.5 px-2.5 py-1 font-mono uppercase tracking-[0.14em] transition-colors duration-150 hover:text-white"
                style={{ fontSize: '0.625rem', color: shareCopied ? 'var(--positive)' : 'var(--text-2)', border: '1px solid var(--hairline)', background: 'var(--raised)' }}
              >
                {shareCopied ? (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
                    Link copied
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></svg>
                    Copy link
                  </>
                )}
              </button>
              <button
                onClick={handleDownloadPdf}
                disabled={pdfBusy || !primaryData}
                aria-label="Download research-grade PDF report"
                className="flex items-center gap-1.5 px-2.5 py-1 font-mono uppercase tracking-[0.14em] transition-colors duration-150 hover:text-white disabled:opacity-40"
                style={{ fontSize: '0.625rem', color: 'var(--text-2)', border: '1px solid var(--hairline)', background: 'var(--raised)' }}
              >
                {pdfBusy ? (
                  <>
                    <span className="w-2.5 h-2.5 border border-white/30 border-t-white/70 rounded-full animate-spin" />
                    Building…
                  </>
                ) : (
                  <>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M7 10l5 5 5-5" /><path d="M12 15V3" /></svg>
                    PDF report
                  </>
                )}
              </button>
            </div>
          )}
        </div>

        <RightPanel
          isInitialized={isInitialized}
          year={Number(year)}
          isSimulating={isSimulating}
          mitigatedData={mitigatedData}
          openAudit={openAudit}
        />
      </div>

      {/* ── HISTORICAL DATA ── */}
      {isInitialized && historicalEras && (
        <div className="w-full max-w-[1440px] mt-2 relative overflow-visible animate-fadeIn"
             style={{ border: '1px solid var(--hairline)', background: 'var(--panel)' }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-5 md:px-8 py-4 border-b" style={{ borderColor: 'var(--hairline)' }}>
            <div className="w-px h-4" style={{ background: 'linear-gradient(180deg, transparent, var(--muted), transparent)' }} />
            <p className="text-[10px] font-mono uppercase tracking-[0.25em] font-semibold" style={{ color: 'var(--muted)' }}>
              Historical Climate Record
            </p>
            <div className="flex-1 h-px" style={{ background: 'linear-gradient(90deg, var(--hairline), transparent)' }} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3" style={{ borderTop: '1px solid var(--hairline)' }}>
            {/* Era 1 — Baseline */}
            <div className="relative flex flex-col p-5 md:p-7 overflow-visible" style={{ borderBottom: '1px solid var(--hairline)' }}>
              <div className="absolute top-0 left-0 right-0 h-px"
                   style={{ background: 'linear-gradient(90deg, transparent, rgba(47,111,143,0.5), transparent)' }} />
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--heat-1)' }} />
                  <p className="text-[9px] font-mono uppercase tracking-[0.2em] font-bold" style={{ color: 'var(--heat-1)' }}>
                    Climate Baseline
                  </p>
                </div>
                <span className="text-[9px] font-mono px-2 py-0.5" style={{ color: 'var(--muted)', border: '1px solid var(--hairline)' }}>
                  {historicalEras.era1?.label}
                </span>
              </div>
              <div className="space-y-4">
                <div>
                  <SustainedHeatLabel />
                  <p className="text-[36px] md:text-[40px] font-mono font-bold leading-none tabular-nums glow-blue" style={{ color: 'var(--heat-1)' }}>
                    {historicalEras.era1?.peak_temp}°C
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Mean Temperature</p>
                  <p className="text-xl font-mono tabular-nums" style={{ color: 'var(--text-2)' }}>{historicalEras.era1?.avg_mean_temp}°C</p>
                </div>
              </div>
            </div>

            {/* Era 2 — Warming Trend */}
            <div className="relative flex flex-col p-5 md:p-7 overflow-visible"
                 style={{ borderBottom: '1px solid var(--hairline)', borderLeft: '0px', borderRight: '0px' }}>
              <div className="absolute top-0 left-0 right-0 h-px"
                   style={{ background: 'linear-gradient(90deg, transparent, rgba(183,146,55,0.5), transparent)' }} />
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--heat-2)' }} />
                  <p className="text-[9px] font-mono uppercase tracking-[0.2em] font-bold" style={{ color: 'var(--heat-2)' }}>
                    Warming Trend
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5"
                     style={{ border: '1px solid rgba(183,146,55,0.3)', background: 'rgba(183,146,55,0.06)' }}>
                  <span className="text-[9px] font-mono font-bold" style={{ color: 'var(--heat-2)' }}>
                    ▲ +{(parseFloat(historicalEras.era2?.avg_mean_temp) - parseFloat(historicalEras.era1?.avg_mean_temp)).toFixed(1)}°C
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <SustainedHeatLabel />
                  <p className="text-[36px] md:text-[40px] font-mono font-bold leading-none tabular-nums glow-amber" style={{ color: 'var(--heat-2)' }}>
                    {historicalEras.era2?.peak_temp}°C
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Mean Temperature</p>
                  <p className="text-xl font-mono tabular-nums" style={{ color: 'var(--text-2)' }}>{historicalEras.era2?.avg_mean_temp}°C</p>
                </div>
              </div>
            </div>

            {/* Era 3 — Current Climate */}
            <div className="relative flex flex-col p-5 md:p-7 overflow-visible">
              <div className="absolute top-0 left-0 right-0 h-px"
                   style={{ background: 'linear-gradient(90deg, transparent, rgba(162,58,48,0.5), transparent)' }} />
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--heat-4)' }} />
                  <p className="text-[9px] font-mono uppercase tracking-[0.2em] font-bold" style={{ color: 'var(--heat-4)' }}>
                    Current Climate
                  </p>
                </div>
                <div className="flex items-center gap-1.5 px-2 py-0.5"
                     style={{ border: '1px solid rgba(162,58,48,0.3)', background: 'rgba(162,58,48,0.06)' }}>
                  <span className="text-[9px] font-mono font-bold" style={{ color: 'var(--heat-4)' }}>
                    ▲ +{(parseFloat(historicalEras.era3?.avg_mean_temp) - parseFloat(historicalEras.era1?.avg_mean_temp)).toFixed(1)}°C
                  </span>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <SustainedHeatLabel />
                  <p className="text-[36px] md:text-[40px] font-mono font-bold leading-none tabular-nums glow-red" style={{ color: 'var(--heat-4)' }}>
                    {historicalEras.era3?.peak_temp}°C
                  </p>
                </div>
                <div>
                  <p className="text-[9px] font-mono uppercase tracking-widest mb-1" style={{ color: 'var(--muted)' }}>Mean Temperature</p>
                  <p className="text-xl font-mono tabular-nums" style={{ color: 'var(--text-2)' }}>{historicalEras.era3?.avg_mean_temp}°C</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── ANALYTICS ── */}
      <div className="w-full max-w-[1440px] z-0 mt-2 overflow-hidden" style={{ border: '1px solid var(--hairline)', background: 'var(--panel)' }}>
        <AnalyticsSection
          isLoading={isLoading} isInitialized={isInitialized}
          chartData={chartData} aiAnalysis={aiAnalysis}
          mitigatedData={mitigatedData}
          projection={currentProjection}
          baseDeathsNum={baseDeathsNum}
          selectedCity={selectedCity}
        />
      </div>

      {/* ── AUDIT MODAL ── */}
      {auditOpen && auditTrail && (
        <div
          className="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-md p-4"
          onClick={() => setAuditOpen(false)}
        >
          <div
            className="bg-[#060f1e] border border-slate-700/60 rounded-2xl w-full max-w-lg shadow-[0_24px_80px_rgba(0,0,0,0.7)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60 bg-slate-900/30">
              <div className="flex items-center gap-2.5">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 shadow-[0_0_5px_rgba(6,182,212,0.5)]" />
                <p className="text-[10px] font-mono text-slate-300 uppercase tracking-[0.2em] font-bold">
                  Calculation Source · {auditKey}
                </p>
              </div>
              <button
                onClick={() => setAuditOpen(false)}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-600 hover:text-white hover:bg-slate-800 transition-all text-sm"
              >✕</button>
            </div>
            <pre className="text-[10px] font-mono text-slate-400 whitespace-pre-wrap max-h-[60vh] overflow-y-auto p-5 leading-relaxed custom-scrollbar">
              {typeof auditTrail[auditKey] === 'string'
                ? auditTrail[auditKey]
                : JSON.stringify(auditTrail[auditKey], null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
