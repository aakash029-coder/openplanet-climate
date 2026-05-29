'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Map, { type MapRef, useControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { useClimateData } from '@/context/ClimateDataContext';
import { cartoDarkStyle, fmtLoss, fetchElevationSafe } from './MapHelpers';

// ── Types ────────────────────────────────────────────────────────────────────

type ViewState = { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number };
type H3Datum   = { hex: string; risk: number };

interface SuggestionCity {
  id:        string | number;
  name:      string;
  country:   string;
  latitude:  number;
  longitude: number;
}

interface SelectedCity {
  locationQuery: string;
  name?:         string;
  country?:      string;
  lat?:          number;
  lng?:          number;
  latitude?:     number;
  longitude?:    number;
}

// ── DeckGL interleaved overlay ───────────────────────────────────────────────

function DeckOverlay(props: MapboxOverlayProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

// ── Heat ramp ────────────────────────────────────────────────────────────────

function riskToRGBA(risk: number): [number, number, number, number] {
  const r = Math.max(0, Math.min(1, risk));
  const h1: [number, number, number] = [47,  111, 143];
  const h2: [number, number, number] = [183, 146, 55 ];
  const h3: [number, number, number] = [190, 106, 46 ];
  const h4: [number, number, number] = [162, 58,  48 ];
  const h5: [number, number, number] = [110, 32,  32 ];
  let c1: [number, number, number], c2: [number, number, number], t: number;
  if      (r < 0.25) { c1 = h1; c2 = h2; t = r / 0.25; }
  else if (r < 0.50) { c1 = h2; c2 = h3; t = (r - 0.25) / 0.25; }
  else if (r < 0.75) { c1 = h3; c2 = h4; t = (r - 0.50) / 0.25; }
  else               { c1 = h4; c2 = h5; t = (r - 0.75) / 0.25; }
  return [
    Math.round(c1[0] + (c2[0] - c1[0]) * t),
    Math.round(c1[1] + (c2[1] - c1[1]) * t),
    Math.round(c1[2] + (c2[2] - c1[2]) * t),
    Math.round(140 + r * 80),
  ];
}

// ── Main component ───────────────────────────────────────────────────────────

export default function MobileProjection() {
  const { fetchPrimaryCity, primaryData } = useClimateData();

  const [isLoading,     setIsLoading]     = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [apiError,      setApiError]      = useState<string | null>(null);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [suggestions,   setSuggestions]   = useState<SuggestionCity[]>([]);
  const [selectedCity,  setSelectedCity]  = useState<SelectedCity | null>(null);
  const [ssp,           setSsp]           = useState('SSP2-4.5');
  const [year,          setYear]          = useState('2050');
  const [canopy,        setCanopy]        = useState(0);
  const [coolRoof,      setCoolRoof]      = useState(0);
  const [hexData,       setHexData]       = useState<Array<{ hex_id: string; position: [number, number]; risk_weight?: number }>>([]);
  const [viewState,     setViewState]     = useState<ViewState>({ longitude: 0, latitude: 20, zoom: 1.8, pitch: 0, bearing: 0 });
  const mapRef = useRef<MapRef | null>(null);

  const canGenerate  = selectedCity !== null;
  const isSimulating = canopy > 0 || coolRoof > 0;

  // Current projection from context
  const currentProjection = useMemo(() => {
    if (!primaryData?.projections?.length) return null;
    const y = Number(year);
    return (
      primaryData.projections.find(p => p.year === y) ??
      primaryData.projections.reduce((c, p) =>
        Math.abs(p.year - y) < Math.abs(c.year - y) ? p : c
      )
    );
  }, [primaryData, year]);

  // Autocomplete
  useEffect(() => {
    const t = setTimeout(async () => {
      if (searchQuery.length > 2 && !selectedCity) {
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=5`,
            { headers: { 'Accept-Language': 'en', 'User-Agent': 'OpenPlanetRiskEngine/1.0 (contact@openplanet.earth)' } }
          );
          if (!res.ok) return;
          const data: Array<{ place_id: string; name: string; display_name: string; lat: string; lon: string }> = await res.json();
          setSuggestions(data.map(c => {
            const parts = (c.display_name || '').split(',');
            return {
              id: c.place_id,
              name: c.name || parts[0]?.trim() || c.display_name,
              country: parts.length > 1 ? parts[parts.length - 1].trim() : '',
              latitude: parseFloat(c.lat),
              longitude: parseFloat(c.lon),
            };
          }));
        } catch { /* silent */ }
      } else {
        setSuggestions([]);
      }
    }, 600);
    return () => clearTimeout(t);
  }, [searchQuery, selectedCity]);

  // Fit bounds when hex data arrives
  useEffect(() => {
    if (!hexData.length) return;
    let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const d of hexData) {
      const [lng, lat] = d.position;
      if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat;
    }
    try {
      mapRef.current?.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 20, maxZoom: 11.5, duration: 1500 });
    } catch { /* ignore */ }
  }, [hexData]);

  const handleAnalyse = useCallback(async () => {
    if (!selectedCity) return;
    const locationQuery = selectedCity.locationQuery.trim();
    const requestLat    = selectedCity.lat ?? selectedCity.latitude ?? 0;
    const requestLng    = selectedCity.lng ?? selectedCity.longitude ?? 0;

    setIsLoading(true);
    setApiError(null);
    setCanopy(0);
    setCoolRoof(0);
    setHexData([]);
    setIsInitialized(false);

    const cleanName = selectedCity.name && selectedCity.country
      ? `${selectedCity.name}, ${selectedCity.country}`
      : locationQuery;

    try {
      const res = await fetch('/api/engine', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          endpoint: '/api/predict',
          payload: { city: locationQuery, lat: requestLat, lng: requestLng, ssp, year, canopy: 0, coolRoof: 0 },
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const resolved    = data.resolvedLocation as { lat?: number; latitude?: number; lng?: number; longitude?: number } | null;
      const resolvedLat = resolved?.lat ?? resolved?.latitude ?? requestLat;
      const resolvedLng = resolved?.lng ?? resolved?.longitude ?? requestLng;

      setSelectedCity({ ...selectedCity, locationQuery: cleanName, lat: resolvedLat, lng: resolvedLng });
      setSearchQuery(cleanName);

      if (resolvedLat !== 0 && resolvedLng !== 0) {
        mapRef.current?.flyTo({ center: [resolvedLng, resolvedLat], zoom: 10, duration: 1200 });
      }
      setHexData(data.hexGrid || []);
      setIsInitialized(true);

      const elevation = await fetchElevationSafe(resolvedLat, resolvedLng);
      fetchPrimaryCity({ city_name: cleanName, lat: resolvedLat, lng: resolvedLng, ssp, canopy_offset_pct: 0, albedo_offset_pct: 0, elevation });

    } catch (err: unknown) {
      setApiError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCity, ssp, year, fetchPrimaryCity]);

  // H3 data with mitigation applied
  const h3Data = useMemo(() => {
    if (!hexData.length) return [];
    const cooling       = (canopy / 100) * 1.2 + (coolRoof / 100) * 0.8;
    const riskReduction = Math.max(0.1, 1 - cooling * 0.08);
    return hexData.map(d => ({ hex: d.hex_id, risk: (d.risk_weight || 0) * riskReduction }));
  }, [hexData, canopy, coolRoof]);

  const layers = useMemo(() => [
    new H3HexagonLayer<H3Datum>({
      id:           'h3-mobile-layer',
      data:         h3Data,
      getHexagon:   d => d.hex,
      getFillColor: d => riskToRGBA(d.risk || 0),
      extruded:     false,
      coverage:     viewState.zoom >= 11.5 ? 1.0 : 0.88,
      stroked:      false,
      // @ts-expect-error -- beforeId resolved at runtime by @deck.gl/mapbox; absent from LayerProps types
      beforeId:     'settlement-label',
      updateTriggers: { getFillColor: h3Data, coverage: viewState.zoom },
    }),
  ], [h3Data, viewState.zoom]);

  // Display values
  const deaths   = currentProjection ? Math.round(currentProjection.attributable_deaths).toLocaleString() : '--';
  const loss     = currentProjection ? fmtLoss(currentProjection.economic_decay_usd) : '--';
  const heatwave = currentProjection ? Math.round(currentProjection.heatwave_days).toString() : '--';
  const temp     = currentProjection ? currentProjection.peak_tx5d_c.toFixed(1) : '--';

  // Mitigation deltas
  const cooling   = (canopy / 100) * 1.2 + (coolRoof / 100) * 0.8;
  const mitTemp   = currentProjection ? Math.max(0, currentProjection.peak_tx5d_c - cooling).toFixed(1) : '--';
  const mitHW     = currentProjection ? Math.max(0, Math.round(currentProjection.heatwave_days - cooling * 3)).toString() : '--';
  const hwRatio   = currentProjection && currentProjection.heatwave_days > 0
    ? Math.max(0, currentProjection.heatwave_days - cooling * 3.5) / currentProjection.heatwave_days : 1;
  const combined  = hwRatio * Math.max(0, 1 - cooling * 0.08);
  const mitDeaths = currentProjection ? Math.round(currentProjection.attributable_deaths * combined).toLocaleString() : '--';
  const mitLoss   = currentProjection ? fmtLoss(currentProjection.economic_decay_usd * combined) : '--';

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="w-full flex flex-col" style={{ background: 'var(--canvas)', minHeight: '100dvh' }}>

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between px-4 py-2.5"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div className="flex items-center gap-2">
          <span className="inline-block w-1 h-1 rounded-full" style={{ background: 'var(--muted)' }} />
          <span className="font-mono text-[9px] uppercase tracking-[0.22em] font-semibold"
                style={{ color: 'var(--muted)' }}>
            OpenPlanet · Climate Risk
          </span>
        </div>
        <span className="font-mono text-[8px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>
          CMIP6 · ERA5
        </span>
      </div>

      {/* ── CONTROLS ── */}
      <div className="px-4 pt-3 pb-3 flex flex-col gap-2"
           style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>

        {/* Search */}
        <div className="relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                 style={{ color: 'var(--muted)' }}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search city or location..."
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); if (selectedCity) setSelectedCity(null); }}
            className="w-full text-[11px] outline-none placeholder:opacity-30 rounded-none"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--hairline)',
              color: 'var(--text)',
              height: '40px',
              padding: '0 12px 0 36px',
            }}
          />
          {suggestions.length > 0 && !selectedCity && (
            <div className="absolute top-full left-0 w-full mt-1 overflow-hidden z-[9999] shadow-2xl"
                 style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.06)' }}>
              {suggestions.map((city, idx) => {
                const label = [city.name, city.country].filter(Boolean).join(', ');
                return (
                  <div
                    key={`${city.id}-${idx}`}
                    onClick={() => {
                      setSelectedCity({ locationQuery: label, name: city.name, country: city.country, lat: city.latitude, lng: city.longitude });
                      setSearchQuery(label);
                      setSuggestions([]);
                    }}
                    className="flex items-center gap-2.5 px-3 py-2.5 text-[11px] cursor-pointer border-b last:border-0"
                    style={{ color: 'var(--text-2)', borderColor: 'rgba(255,255,255,0.04)' }}
                  >
                    <div className="w-1 h-1 rounded-full bg-slate-600 shrink-0" />
                    <span className="truncate">{label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Year + SSP */}
        <div className="grid grid-cols-2 gap-2">
          <select
            value={year}
            onChange={e => setYear(e.target.value)}
            className="text-[11px] cursor-pointer outline-none appearance-none rounded-none"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--hairline)',
              color: 'var(--text)',
              height: '38px',
              padding: '0 24px 0 10px',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2352525B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            <option value="2030">2030</option>
            <option value="2050">2050</option>
          </select>
          <select
            value={ssp}
            onChange={e => setSsp(e.target.value)}
            className="text-[11px] cursor-pointer outline-none appearance-none rounded-none"
            style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--hairline)',
              color: 'var(--text)',
              height: '38px',
              padding: '0 24px 0 10px',
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 24 24' fill='none' stroke='%2352525B' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 8px center',
            }}
          >
            <option value="SSP2-4.5">SSP2-4.5</option>
            <option value="SSP5-8.5">SSP5-8.5</option>
          </select>
        </div>

        {/* Analyse button — prominent white block */}
        <button
          onClick={handleAnalyse}
          disabled={!canGenerate || isLoading}
          className="w-full font-sans font-semibold text-[11px] uppercase tracking-wider transition-all duration-150 disabled:opacity-25 disabled:cursor-not-allowed"
          style={{ background: 'var(--text)', color: 'var(--canvas)', minHeight: '52px', touchAction: 'manipulation' }}
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="inline-block w-3 h-3 border border-current/30 border-t-current rounded-full animate-spin" />
              Analysing…
            </span>
          ) : 'Analyse Your City →'}
        </button>
      </div>

      {/* ── MAP — 32vh ── */}
      <div
        className="w-full h-[32vh] relative"
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          background: 'var(--canvas)',
          minHeight: '200px',
        }}
      >
        {/* Idle overlay */}
        {!isInitialized && !isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
            <p className="font-mono text-[9px] uppercase tracking-[0.15em] text-center px-8"
               style={{ color: 'var(--muted)' }}>
              Run a projection to generate the heat exposure grid
            </p>
          </div>
        )}

        {/* Loading overlay */}
        {isLoading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-[#08080A]/75">
            <div className="w-5 h-5 border border-white/20 border-t-white/50 rounded-full animate-spin" />
            <p className="font-mono text-[9px] uppercase tracking-[0.15em]" style={{ color: 'var(--muted)' }}>
              Computing…
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
          doubleClickZoom={false}
          dragRotate={false}
          style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
        >
          <DeckOverlay layers={layers} interleaved />
        </Map>

        {/* Zoom controls */}
        <div className="absolute top-2 right-2 z-50 flex flex-col"
             style={{ border: '1px solid var(--hairline)', background: 'var(--panel)' }}>
          <button onClick={() => mapRef.current?.zoomIn()}
                  className="w-8 h-8 flex items-center justify-center font-mono text-sm"
                  style={{ borderBottom: '1px solid var(--hairline)', color: 'var(--muted)', touchAction: 'manipulation' }}
                  aria-label="Zoom in">+</button>
          <button onClick={() => mapRef.current?.zoomOut()}
                  className="w-8 h-8 flex items-center justify-center font-mono text-sm"
                  style={{ color: 'var(--muted)', touchAction: 'manipulation' }}
                  aria-label="Zoom out">−</button>
        </div>

        {/* Legend — text-[9px], minimal footprint */}
        {isInitialized && (
          <div className="absolute bottom-2 left-2 z-50 px-1.5 py-1"
               style={{ background: 'rgba(8,8,10,0.95)', border: '1px solid var(--hairline)' }}>
            <p className="font-mono text-[9px] uppercase tracking-[0.09em] mb-0.5"
               style={{ color: 'var(--muted)' }}>
              {year} · {ssp}
            </p>
            <div className="flex items-end gap-0">
              {[
                { color: '#2F6F8F', label: '34' },
                { color: '#B79237', label: '37' },
                { color: '#BE6A2E', label: '40' },
                { color: '#A23A30', label: '43' },
                { color: '#6E2020', label: '46+' },
              ].map(({ color, label }) => (
                <div key={label} className="flex flex-col items-center">
                  <div className="w-5 h-1.5" style={{ background: color }} />
                  <span className="font-mono mt-0.5" style={{ fontSize: '0.5rem', color: 'var(--muted)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {apiError && (
          <div className="absolute top-2 left-2 right-12 z-50 px-3 py-1.5"
               style={{ background: 'rgba(8,8,10,0.95)', border: '1px solid var(--heat-4)' }}>
            <p className="text-[9px] font-mono text-red-400 uppercase tracking-wider truncate">⚠ {apiError}</p>
          </div>
        )}
      </div>

      {/* ── INDICATORS — 2×2 dense grid ── */}
      {isInitialized && (
        <div className="grid grid-cols-2"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          {([
            { label: 'Heat Deaths / yr',  value: isSimulating ? mitDeaths : deaths,        baseline: isSimulating ? deaths        : null, color: isSimulating ? 'var(--positive)' : 'var(--heat-4)', sub: '±15% CI · Gasparrini' },
            { label: 'Economic Loss / yr', value: isSimulating ? mitLoss   : loss,          baseline: isSimulating ? loss          : null, color: isSimulating ? 'var(--positive)' : 'var(--heat-2)', sub: '±8% CI · Burke 2018' },
            { label: 'Heatwave Days',      value: isSimulating ? `${mitHW}d` : `${heatwave}d`, baseline: isSimulating ? `${heatwave}d` : null, color: isSimulating ? 'var(--positive)' : 'var(--heat-3)', sub: 'Above P95 · CMIP6' },
            { label: 'Peak Tx5d',          value: isSimulating ? `${mitTemp}°C` : `${temp}°C`, baseline: isSimulating ? `${temp}°C`    : null, color: isSimulating ? 'var(--positive)' : 'var(--copper)', sub: 'ERA5 decadal mean' },
          ] as const).map((m, i) => (
            <div key={m.label} className="p-3 flex flex-col gap-0.5"
                 style={{
                   borderRight: i % 2 === 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                   borderTop:   i >= 2       ? '1px solid rgba(255,255,255,0.05)' : 'none',
                 }}>
              <p className="font-mono text-[8px] uppercase tracking-[0.12em]" style={{ color: 'var(--muted)' }}>{m.label}</p>
              {m.baseline !== null && (
                <p className="font-mono text-[8px] tabular-nums" style={{ color: 'var(--muted)', opacity: 0.4 }}>
                  ↓ from {m.baseline}
                </p>
              )}
              <p className="font-mono text-[20px] font-bold leading-tight tabular-nums" style={{ color: m.color }}>{m.value}</p>
              <p className="font-mono text-[7px]" style={{ color: 'var(--muted)', opacity: 0.4 }}>{m.sub}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── ADAPTATION SLIDERS ── */}
      {isInitialized && (
        <div className="px-4 py-3 flex flex-col gap-2.5"
             style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div className="flex items-center gap-1.5">
            <span className="inline-block w-1 h-1 rounded-full" style={{ background: 'var(--reference)' }} />
            <span className="font-mono text-[8px] uppercase tracking-[0.16em]" style={{ color: 'var(--reference)' }}>
              Adaptation Scenario
            </span>
            <span className="font-mono text-[7px] italic" style={{ color: 'var(--muted)' }}>— directional only</span>
          </div>

          {/* Canopy */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="font-mono text-[8px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Canopy Cover</label>
              <span className="font-mono text-[9px] font-bold tabular-nums" style={{ color: 'var(--positive)' }}>+{canopy}%</span>
            </div>
            <div className="relative">
              <input type="range" min="0" max="50" value={canopy}
                     onChange={e => setCanopy(Number(e.target.value))}
                     className="w-full h-[3px] bg-white/[0.05] rounded-none appearance-none cursor-pointer accent-emerald-500"
                     style={{ touchAction: 'none' }} />
              <div className="absolute top-0 left-0 h-[3px] pointer-events-none"
                   style={{ width: `${(canopy / 50) * 100}%`, background: 'var(--positive)' }} />
            </div>
          </div>

          {/* Albedo */}
          <div className="space-y-1">
            <div className="flex justify-between items-center">
              <label className="font-mono text-[8px] uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Albedo Roofs</label>
              <span className="font-mono text-[9px] font-bold tabular-nums" style={{ color: 'var(--reference)' }}>+{coolRoof}%</span>
            </div>
            <div className="relative">
              <input type="range" min="0" max="100" value={coolRoof}
                     onChange={e => setCoolRoof(Number(e.target.value))}
                     className="w-full h-[3px] bg-white/[0.05] rounded-none appearance-none cursor-pointer accent-cyan-500"
                     style={{ touchAction: 'none' }} />
              <div className="absolute top-0 left-0 h-[3px] pointer-events-none"
                   style={{ width: `${(coolRoof / 100) * 100}%`, background: 'var(--reference)' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── FOOTER ── */}
      <div className="px-4 py-5 mt-auto">
        <p className="font-mono text-[7px] uppercase tracking-[0.13em] text-center leading-relaxed"
           style={{ color: 'var(--muted)', opacity: 0.3 }}>
          Research-grade estimates · Not investment advice<br />
          Mortality ±15% CI · Economic ±8% CI
        </p>
      </div>

    </div>
  );
}
