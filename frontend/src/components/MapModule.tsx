'use client';
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useClimateData } from '@/context/ClimateDataContext';

type SelectedCity = PanelSelectedCity;

type ViewState = { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number; transitionDuration?: number; transitionInterpolator?: FlyToInterpolator };

function flyToCoordinates(
  setViewState: React.Dispatch<React.SetStateAction<ViewState>>,
  lat: number,
  lng: number,
  zoom = 10,
) {
  setViewState(prev => ({
    ...prev,
    latitude: lat,
    longitude: lng,
    zoom,
    pitch: 0,
    bearing: 0,
    transitionDuration: 1500,
    transitionInterpolator: new FlyToInterpolator(),
  }));
}
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import DeckGL from '@deck.gl/react';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { FlyToInterpolator, WebMercatorViewport } from '@deck.gl/core';
import { cartoDarkStyle, parseLoss, fmtLoss, fetchElevationSafe } from './MapHelpers';
import { LeftPanel, RightPanel, type SuggestionCity, type PanelSelectedCity, type MitigatedData } from './MapPanels';
import { AnalyticsSection } from './MapCharts';

export default function MapModule({ onTargetLocked }: { onTargetLocked?: (city: string) => void }) {
  const { fetchPrimaryCity, primaryData } = useClimateData();

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
  const [canopy, setCanopy] = useState(savedState.canopy !== undefined ? savedState.canopy : 0);
  const [coolRoof, setCoolRoof] = useState(savedState.albedo !== undefined ? savedState.albedo : 0);

  useEffect(() => {
    localStorage.setItem('op_sync_state', JSON.stringify({ ssp, year, canopy, albedo: coolRoof }));
  }, [ssp, year, canopy, coolRoof]);

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
    if (hexData && hexData.length > 0 && mapContainerRef.current) {
      let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
      for (let i = 0; i < hexData.length; i++) {
        const lng = hexData[i].position[0], lat = hexData[i].position[1];
        if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
      }
      const { width, height } = mapContainerRef.current.getBoundingClientRect();
      if (width > 0 && height > 0) {
        try {
          const viewport = new WebMercatorViewport({ width, height });
          const { longitude, latitude, zoom } = viewport.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40 });
          setViewState({ longitude, latitude, zoom, pitch: 0, bearing: 0, transitionDuration: 2000, transitionInterpolator: new FlyToInterpolator() });
        } catch { /* fitBounds failed — retain current viewState */ }
      }
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
        flyToCoordinates(setViewState, resolvedLat, resolvedLng, 10);
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
        const green: [number,number,number] = [34, 197, 94];
        const yellow: [number,number,number] = [234, 179, 8];
        const orange: [number,number,number] = [249, 115, 22];
        const red: [number,number,number] = [239, 68, 68];
        let c1: [number,number,number], c2: [number,number,number], t: number;
        if (risk < 0.4) { c1 = green; c2 = yellow; t = risk / 0.4; }
        else if (risk < 0.7) { c1 = yellow; c2 = orange; t = (risk - 0.4) / 0.3; }
        else { c1 = orange; c2 = red; t = (risk - 0.7) / 0.3; }
        return [Math.round(c1[0] + (c2[0] - c1[0]) * t), Math.round(c1[1] + (c2[1] - c1[1]) * t), Math.round(c1[2] + (c2[2] - c1[2]) * t), 110];
      },
      extruded: false,
      coverage: viewState.zoom > 12.5 ? 1.0 : 0.85,
      stroked: false,
      updateTriggers: { getFillColor: h3Data },
    }),
  ], [h3Data, viewState.zoom]);

  const SustainedHeatLabel = () => (
    <div className="flex items-center gap-1.5 mb-1 relative group w-max">
      <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest">Sustained Heat Average</p>
      <span className="flex items-center justify-center w-3 h-3 rounded-full border border-slate-600 text-[7px] text-slate-400 cursor-help">i</span>
      <div className="absolute bottom-full left-0 mb-1 w-56 p-2 bg-[#060f1e] border border-slate-700 text-slate-400 text-[8px] leading-relaxed rounded shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
        Note: This represents the decadal average of the hottest consecutive 5-day periods (Tx5d) across a 31km spatial grid. It smooths out 1-day anomalous spikes to provide stable actuarial baselines for economic models.
      </div>
    </div>
  );

  return (
    <div className="w-full flex flex-col items-center py-6 px-4 bg-[#020617] min-h-screen gap-6">

      {/* ── MAP AREA ── */}
      <div className="w-full max-w-[1440px] flex flex-col md:flex-row gap-3 relative z-10"
        style={{ height: 'calc(100vh - 100px)', minHeight: '760px' }}>

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
        <div className="flex-1 flex flex-col gap-1.5 min-w-0">
          <div
            ref={mapContainerRef}
            className="flex-1 rounded-2xl border border-slate-800/60 overflow-hidden relative shadow-[0_8px_48px_rgba(0,0,0,0.8)] bg-[#060f1e]"
          >
            <DeckGL
              viewState={viewState}
              onViewStateChange={({ viewState: vs }) => setViewState(vs as ViewState)}
              controller={{ scrollZoom: false, doubleClickZoom: true, dragRotate: false, dragPan: true }}
              layers={layers}
            >
              <Map mapStyle={cartoDarkStyle} attributionControl={false} reuseMaps />
            </DeckGL>

            {/* Zoom controls */}
            <div className="absolute top-3 right-3 z-50 flex flex-col bg-[#060f1e]/95 border border-slate-800/80 rounded-xl overflow-hidden backdrop-blur-xl shadow-lg">
              <button
                onClick={() => setViewState(p => ({ ...p, zoom: p.zoom + 1 }))}
                className="w-8 h-8 flex items-center justify-center border-b border-slate-800/60 text-slate-500 hover:text-white hover:bg-slate-800/50 transition-all text-sm font-mono"
              >+</button>
              <button
                onClick={() => setViewState(p => ({ ...p, zoom: p.zoom - 1 }))}
                className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-white hover:bg-slate-800/50 transition-all text-sm font-mono"
              >−</button>
            </div>

            {/* Risk legend */}
            {isInitialized && (
              <div className="absolute top-3 left-3 z-50 bg-[#060f1e]/95 border border-slate-800/70 px-4 py-3 rounded-xl backdrop-blur-xl shadow-lg">
                <p className="text-[8px] font-mono text-slate-500 uppercase tracking-widest mb-2 font-bold">Thermal Risk</p>
                <div className="w-32 h-1.5 rounded-full bg-gradient-to-r from-green-500 via-yellow-500 to-red-500" />
                <div className="flex justify-between mt-2">
                  <span className="text-[8px] font-mono text-slate-600 font-bold">Low</span>
                  <span className="text-[8px] font-mono text-red-500/80 font-bold">Critical</span>
                </div>
              </div>
            )}

            {/* API error */}
            {apiError && (
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 bg-red-950/90 border border-red-900/80 rounded-xl px-5 py-3 backdrop-blur-xl">
                <p className="text-[10px] font-mono text-red-400 flex items-center gap-2 font-bold uppercase tracking-widest">
                  <span className="text-red-500">⚠</span> {apiError}
                </p>
              </div>
            )}
          </div>

          {isInitialized && selectedCity && (
            <p className="text-[11px] italic text-slate-400/70 text-center font-serif tracking-wide pt-1">
              {selectedCity.name || selectedCity.locationQuery} · {year} Projection · H3 Spatial Risk Model
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
        <div className="w-full max-w-[1440px] bg-[#030b18] border border-slate-800/50 rounded-2xl p-6 mt-2 relative overflow-hidden">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            <div className="flex flex-col bg-cyan-900/10 border border-cyan-900/40 rounded-xl p-6 relative overflow-hidden backdrop-blur-sm">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-cyan-500 opacity-80" />
              <div className="flex items-center gap-2 mb-6">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <p className="text-[10px] font-mono text-slate-300 uppercase tracking-widest font-bold">
                  Climate Baseline <span className="text-cyan-500/70">({historicalEras.era1?.label})</span>
                </p>
              </div>
              <div className="space-y-4">
                <div>
                  <SustainedHeatLabel />
                  <p className="text-3xl font-mono text-cyan-400 font-bold">{historicalEras.era1?.peak_temp}°C</p>
                </div>
                <div>
                  <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">Mean Temperature</p>
                  <p className="text-xl font-mono text-slate-300">{historicalEras.era1?.avg_mean_temp}°C</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col bg-orange-900/10 border border-orange-900/40 rounded-xl p-6 relative overflow-hidden backdrop-blur-sm">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-orange-500 opacity-80" />
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🟧</span>
                  <p className="text-[10px] font-mono text-slate-300 uppercase tracking-widest font-bold">
                    Warming Trend <span className="text-orange-500/70">({historicalEras.era2?.label})</span>
                  </p>
                </div>
                <div className="bg-orange-950/40 border border-orange-900/50 text-orange-400 text-[9px] font-mono px-2 py-0.5 rounded">
                  ▲ +{(parseFloat(historicalEras.era2?.avg_mean_temp) - parseFloat(historicalEras.era1?.avg_mean_temp)).toFixed(1)}°C from Baseline
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <SustainedHeatLabel />
                  <p className="text-3xl font-mono text-orange-400 font-bold">{historicalEras.era2?.peak_temp}°C</p>
                </div>
                <div>
                  <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">Mean Temperature</p>
                  <p className="text-xl font-mono text-slate-300">{historicalEras.era2?.avg_mean_temp}°C</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col bg-red-900/10 border border-red-900/40 rounded-xl p-6 relative overflow-hidden backdrop-blur-sm">
              <div className="absolute top-0 left-0 w-full h-[3px] bg-red-500 opacity-80" />
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-sm">🟥</span>
                  <p className="text-[10px] font-mono text-slate-300 uppercase tracking-widest font-bold">
                    Current Climate <span className="text-red-500/70">({historicalEras.era3?.label})</span>
                  </p>
                </div>
                <div className="bg-red-950/40 border border-red-900/50 text-red-400 text-[9px] font-mono px-2 py-0.5 rounded">
                  ▲ +{(parseFloat(historicalEras.era3?.avg_mean_temp) - parseFloat(historicalEras.era1?.avg_mean_temp)).toFixed(1)}°C from Baseline
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <SustainedHeatLabel />
                  <p className="text-3xl font-mono text-red-400 font-bold">{historicalEras.era3?.peak_temp}°C</p>
                </div>
                <div>
                  <p className="text-[9px] font-mono text-slate-500 uppercase tracking-widest mb-1">Mean Temperature</p>
                  <p className="text-xl font-mono text-slate-300">{historicalEras.era3?.avg_mean_temp}°C</p>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* ── ANALYTICS ── */}
      <div className="w-full max-w-[1440px] z-0 bg-[#030b18] border border-slate-800/30 rounded-2xl overflow-hidden mt-2">
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
