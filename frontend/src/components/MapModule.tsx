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

  const savedState = typeof window !== 'undefined' ? JSON.parse(localStorage.getItem('op_sync_state') || '{}') : {};
  const [ssp, setSsp] = useState(savedState.ssp || 'SSP2-4.5');
  const [year, setYear] = useState(savedState.year || '2050');

  useEffect(() => {
    localStorage.setItem('op_sync_state', JSON.stringify({ ssp, year }));
  }, [ssp, year]);

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
    const baseW  = currentProjection.wbt_max_c ?? (currentProjection.peak_tx5d_c * 0.7 + 8);
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
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5`,
            {
              headers: {
                "Accept-Language": "en",
                "User-Agent": "OpenPlanetRiskEngine/1.0 (contact@openplanet.earth)"
              }
            }
          );
          if (!res.ok) return;
          const data: Array<{ place_id: string; name: string; display_name: string; lat: string; lon: string }> = await res.json();
          setSuggestions(data.map((c) => {
            const parts = (c.display_name || '').split(',');
            return {
              id:        c.place_id,
              name:      c.name || parts[0]?.trim() || c.display_name,
              country:   parts.length > 1 ? parts[parts.length - 1].trim() : '',
              latitude:  parseFloat(c.lat),
              longitude: parseFloat(c.lon),
            };
          }));
        } catch {
          // Nominatim request failed — suggestions stay empty, user can retry
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
  }, [selectedCity, searchQuery, ssp, year, onTargetLocked, fetchPrimaryCity]);

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

  const SustainedHeatLabel = () => (
    <div className="flex items-center gap-1.5 mb-1 relative z-30 group w-max">
      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Sustained Heat Average</p>
      <span className="flex items-center justify-center w-3 h-3 rounded-full border border-slate-600 text-[7px] text-slate-400 cursor-help">i</span>
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72 p-2 bg-[#060f1e] border border-slate-700 text-slate-400 text-[8px] leading-relaxed rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-[9999]">
        Note: This represents the decadal average of the hottest consecutive 5-day periods (Tx5d) across a 31km spatial grid. It smooths out 1-day anomalous spikes to provide stable actuarial baselines for economic models.
      </div>
    </div>
  );

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
            className={`map-canvas-container transition-gpu overflow-hidden relative transition-all duration-500 ease-in-out md:h-[clamp(44vh,calc(100vh_-_112px),100vh)] min-h-[220px] ${isInitialized ? 'h-[46vh]' : 'h-[28vh]'}`}
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
              style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' }}
            >
              <DeckOverlay layers={layers} interleaved />
            </Map>

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
            <p className="font-mono text-center pt-2 pb-1"
               style={{ fontSize: '0.6875rem', color: 'var(--muted)' }}>
              {selectedCity.name || selectedCity.locationQuery} · {year} · {ssp} · CMIP6 ensemble projection
            </p>
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
        <div className="w-full max-w-[1440px] mt-2 relative overflow-visible"
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
