'use client';
import React from 'react';
import Map, { type MapRef, useControl } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox';
import { cartoDarkStyle } from '../MapHelpers';

type ViewState = { longitude: number; latitude: number; zoom: number; pitch: number; bearing: number };

function DeckOverlay(props: MapboxOverlayProps) {
  const overlay = useControl<MapboxOverlay>(() => new MapboxOverlay(props));
  overlay.setProps(props);
  return null;
}

export interface MapCanvasProps {
  mapRef: React.RefObject<MapRef | null>;
  viewState: ViewState;
  onMove: (vs: ViewState) => void;
  isLoading: boolean;
  isInitialized: boolean;
  isMobile: boolean;
  mapInteractive: boolean;
  layers: unknown[];
  selectedCity: { name?: string; locationQuery?: string; lat?: number; lng?: number } | null;
  year: string;
  ssp: string;
  apiError: string | null;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onLockMap: () => void;
  handleOverlayTouchStart: (e: React.TouchEvent) => void;
  handleOverlayTouchEnd: (e: React.TouchEvent) => void;
}

export default function MapCanvas({
  mapRef,
  viewState,
  onMove,
  isLoading,
  isInitialized,
  isMobile,
  mapInteractive,
  layers,
  selectedCity,
  year,
  ssp,
  apiError,
  onZoomIn,
  onZoomOut,
  onLockMap,
  handleOverlayTouchStart,
  handleOverlayTouchEnd,
}: MapCanvasProps) {
  return (
    <div
      className="map-canvas-container transition-gpu overflow-hidden relative md:h-[clamp(44vh,calc(100vh_-_112px),100vh)] min-h-[220px] h-[42vh]"
      style={{ background: 'var(--canvas)', border: '1px solid var(--hairline)' }}
    >
      {/* Loading / idle placeholder */}
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
        {...({ preserveDrawingBuffer: true } as Record<string, unknown>)}
        reuseMaps
        longitude={viewState.longitude}
        latitude={viewState.latitude}
        zoom={viewState.zoom}
        pitch={viewState.pitch}
        bearing={viewState.bearing}
        onMove={({ viewState: vs }) => onMove(vs as ViewState)}
        scrollZoom={false}
        doubleClickZoom={true}
        dragRotate={false}
        dragPan={!isMobile || mapInteractive}
        style={{ position: 'absolute', top: '0', left: '0', width: '100%', height: '100%' }}
      >
        <DeckOverlay layers={layers as MapboxOverlayProps['layers']} interleaved />
      </Map>

      {/* Mobile map interaction lock overlay */}
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
          onClick={onLockMap}
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

      {/* Zoom controls */}
      <div className="absolute top-3 right-3 z-50 flex flex-col glass-nav" style={{ border: '1px solid var(--hairline)' }}>
        <button
          onClick={onZoomIn}
          className="w-11 h-11 flex items-center justify-center text-base font-mono transition-colors duration-150"
          style={{ borderBottom: '1px solid var(--hairline)', color: 'var(--muted)', touchAction: 'manipulation' }}
          onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
          onMouseLeave={e => (e.currentTarget.style.color = 'var(--muted)')}
          aria-label="Zoom in"
        >+</button>
        <button
          onClick={onZoomOut}
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
          <p className="font-mono uppercase tracking-[0.14em] mb-1 md:mb-2 text-[9px] md:text-[11px]"
             style={{ color: 'var(--muted)' }}>
            Heat exposure (°C) · {year} · {ssp}
          </p>
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
  );
}
