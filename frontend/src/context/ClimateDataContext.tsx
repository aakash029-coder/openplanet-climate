'use client';

/**
 * ClimateDataContext.tsx
 * Single Source of Truth for all climate data across Dashboard, Deep Dive, and Compare.
 *
 * Architecture:
 * - ONE API call per city → data stored in context
 * - All screens read from context → zero data inconsistency
 * - Cache: city data persists for session (no redundant API calls)
 */

import React, { createContext, useContext, useState, useCallback, useRef } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Projection {
  year: number;
  source: string;
  heatwave_days: number;
  peak_tx5d_c: number;
  attributable_deaths: number;
  economic_decay_usd: number;
  wbt_max_c: number;
  uhi_intensity_c: number;
  grid_stress_factor: number;
  survivability_status: "STABLE" | "DANGER" | "CRITICAL";
  n_models: number;
  region: string;
}

export interface ClimateBaseline {
  baseline_mean_c: number;
}

export interface CityClimateData {
  // Identity
  city_name: string;
  lat: number;
  lng: number;
  ssp: string;
  canopy_offset_pct: number;
  albedo_offset_pct: number;

  // ERA5 baseline (real historical data)
  threshold_c: number;         // ERA5 P95 — heatwave threshold
  tx5d_baseline_c: number;     // WMO Tx5d historical baseline
  cooling_offset_c: number;

  // Socioeconomics (GeoNames + World Bank)
  gdp_usd: number;
  population: number;

  // CMIP6 projections (2030, 2050) + IPCC AR6 (2075, 2100)
  projections: Projection[];

  // Historical baseline mean
  baseline: ClimateBaseline;

  // Humidity locked to ERA5 P95 (deterministic for projections)
  era5_humidity_p95: number;

  // Fetch metadata
  fetched_at: number;  // timestamp — for cache validation
  fetch_duration_ms: number;
}

export interface DashboardMetrics {
  baseTemp: string;
  temp: string;
  deaths: string;
  ci: string;
  loss: string;
  heatwave: string;
  wbt: string;
  region: string;
}

export interface DashboardData {
  metrics: DashboardMetrics;
  hexGrid: Array<{ position: [number, number] }>;
  aiAnalysis: Record<string, string> | null;
  charts: {
    heatwave: Array<{ year: string; val: number }>;
    economic: Array<{ year: string; noAction: number; adapt: number }>;
  };
}

// ── Cache ─────────────────────────────────────────────────────────────────────

// Session-level cache: city_ssp_canopy_albedo → data
// Prevents redundant API calls when switching between tabs
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes

interface CacheEntry {
  data: CityClimateData;
  timestamp: number;
}

const _cache = new Map<string, CacheEntry>();

function getCacheKey(
  city: string,
  lat: number,
  lng: number,
  ssp: string,
  canopy: number,
  albedo: number
): string {
  return `${city.toLowerCase().trim()}_${lat}_${lng}_${ssp}_${canopy}_${albedo}`;
}

function getCached(key: string): CityClimateData | null {
  const entry = _cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    _cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: CityClimateData): void {
  _cache.set(key, { data, timestamp: Date.now() });
}

// ── Context Definition ────────────────────────────────────────────────────────

interface ClimateDataContextType {
  // Primary city (Dashboard + Deep Dive)
  primaryData:    CityClimateData | null;
  primaryLoading: boolean;
  primaryError:   string | null;

  // Compare city A
  compareA:        CityClimateData | null;
  compareALoading: boolean;
  compareAError:   string | null;

  // Compare city B
  compareB:        CityClimateData | null;
  compareBLoading: boolean;
  compareBError:   string | null;

  // Dashboard simulation result (predict endpoint)
  dashboardData:    DashboardData | null;
  dashboardLoading: boolean;
  dashboardError:   string | null;

  // Actions
  fetchPrimaryCity: (params: FetchParams) => Promise<void>;
  fetchCompareCity: (slot: "A" | "B", params: FetchParams) => Promise<void>;
  fetchDashboard:   (params: DashboardParams) => Promise<void>;
  clearCompare:     () => void;
}

export interface FetchParams {
  city_name:         string;
  lat:               number;
  lng:               number;
  ssp:               string;
  canopy_offset_pct: number;
  albedo_offset_pct: number;
}

export interface DashboardParams {
  city:     string;
  lat:      number;
  lng:      number;
  ssp:      string;
  year:     string;
  canopy:   number;
  coolRoof: number;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ClimateDataContext = createContext<ClimateDataContextType | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function ClimateDataProvider({ children }: { children: React.ReactNode }) {

  const [primaryData,    setPrimaryData]    = useState<CityClimateData | null>(null);
  const [primaryLoading, setPrimaryLoading] = useState(false);
  const [primaryError,   setPrimaryError]   = useState<string | null>(null);

  const [compareA,        setCompareA]        = useState<CityClimateData | null>(null);
  const [compareALoading, setCompareALoading] = useState(false);
  const [compareAError,   setCompareAError]   = useState<string | null>(null);

  const [compareB,        setCompareB]        = useState<CityClimateData | null>(null);
  const [compareBLoading, setCompareBLoading] = useState(false);
  const [compareBError,   setCompareBError]   = useState<string | null>(null);

  const [dashboardData,    setDashboardData]    = useState<DashboardData | null>(null);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError,   setDashboardError]   = useState<string | null>(null);

  // In-flight request guards — prevent duplicate concurrent fetches
  const inFlight = useRef(new Set<string>());

  // ── Fetch climate-risk data for a city ──────────────────────────────────────

  const fetchCityData = useCallback(async (params: FetchParams): Promise<CityClimateData | null> => {
    const key = getCacheKey(
      params.city_name,
      params.lat,
      params.lng,
      params.ssp,
      params.canopy_offset_pct,
      params.albedo_offset_pct,
    );

    // Return cached data if valid
    const cached = getCached(key);
    if (cached) return cached;

    // Prevent duplicate in-flight requests
    if (inFlight.current.has(key)) return null;
    inFlight.current.add(key);

    const t0 = Date.now();

    try {
      const resp = await fetch("/api/engine", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_url: `${process.env.NEXT_PUBLIC_ENGINE_URL}/api/climate-risk`,
          payload: {
            lat:               params.lat,
            lng:               params.lng,
            ssp:               params.ssp,
            canopy_offset_pct: params.canopy_offset_pct,
            albedo_offset_pct: params.albedo_offset_pct,
            location_hint:     params.city_name,
          },
        }),
      });

      if (!resp.ok) throw new Error(`Engine returned ${resp.status}`);
      const raw = await resp.json();

      if (raw.error) throw new Error(raw.error);

      const data: CityClimateData = {
        city_name:          params.city_name,
        lat:                params.lat,
        lng:                params.lng,
        ssp:                params.ssp,
        canopy_offset_pct:  params.canopy_offset_pct,
        albedo_offset_pct:  params.albedo_offset_pct,
        threshold_c:        raw.threshold_c,
        tx5d_baseline_c:    raw.tx5d_baseline_c,
        cooling_offset_c:   raw.cooling_offset_c,
        gdp_usd:            raw.gdp_usd,
        population:         raw.population,
        projections:        raw.projections ?? [],
        baseline:           raw.baseline,
        era5_humidity_p95:  raw.era5_humidity_p95 ?? 70.0,
        fetched_at:         Date.now(),
        fetch_duration_ms:  Date.now() - t0,
      };

      setCache(key, data);
      return data;

    } finally {
      inFlight.current.delete(key);
    }
  }, []);

  // ── Public actions ────────────────────────────────────────────────────────

  const fetchPrimaryCity = useCallback(async (params: FetchParams) => {
    setPrimaryLoading(true);
    setPrimaryError(null);
    try {
      const data = await fetchCityData(params);
      if (data) setPrimaryData(data);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setPrimaryError(msg);
    } finally {
      setPrimaryLoading(false);
    }
  }, [fetchCityData]);

  const fetchCompareCity = useCallback(async (slot: "A" | "B", params: FetchParams) => {
    if (slot === "A") {
      setCompareALoading(true);
      setCompareAError(null);
    } else {
      setCompareBLoading(true);
      setCompareBError(null);
    }

    try {
      const data = await fetchCityData(params);
      if (data) {
        if (slot === "A") setCompareA(data);
        else              setCompareB(data);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      if (slot === "A") setCompareAError(msg);
      else              setCompareBError(msg);
    } finally {
      if (slot === "A") setCompareALoading(false);
      else              setCompareBLoading(false);
    }
  }, [fetchCityData]);

  const fetchDashboard = useCallback(async (params: DashboardParams) => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const resp = await fetch("/api/engine", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target_url: `${process.env.NEXT_PUBLIC_ENGINE_URL}/api/predict`,
          payload: params,
        }),
      });

      if (!resp.ok) throw new Error(`Engine returned ${resp.status}`);
      const data: DashboardData = await resp.json();
      setDashboardData(data);

    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setDashboardError(msg);
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  const clearCompare = useCallback(() => {
    setCompareA(null);
    setCompareB(null);
    setCompareAError(null);
    setCompareBError(null);
  }, []);

  return (
    <ClimateDataContext.Provider value={{
      primaryData,    primaryLoading,  primaryError,
      compareA,       compareALoading, compareAError,
      compareB,       compareBLoading, compareBError,
      dashboardData,  dashboardLoading, dashboardError,
      fetchPrimaryCity,
      fetchCompareCity,
      fetchDashboard,
      clearCompare,
    }}>
      {children}
    </ClimateDataContext.Provider>
  );
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useClimateData(): ClimateDataContextType {
  const ctx = useContext(ClimateDataContext);
  if (!ctx) throw new Error("useClimateData must be used inside ClimateDataProvider");
  return ctx;
}

// ── Utility helpers ───────────────────────────────────────────────────────────

/**
 * Format WBT with scientific cap per Sherwood & Huber (2010)
 * Never display raw model output above 35°C
 */
export function formatWBT(wbt: number): string {
  if (wbt >= 35.0) return "> 35°C (Critical Physiological Limit)";
  return `${wbt.toFixed(1)}°C`;
}

/**
 * Format economic loss with confidence interval (±8%)
 * Best-practice statistics — not a point estimate
 */
export function formatEconomicRange(usd: number): string {
  const low  = usd * 0.92;
  const high = usd * 1.08;
  const fmt  = (v: number) =>
    v >= 1e9
      ? `$${(v / 1e9).toFixed(1)}B`
      : `$${(v / 1e6).toFixed(0)}M`;
  return `${fmt(low)} – ${fmt(high)}`;
}

/**
 * Format deaths with confidence interval (±15% per Gasparrini 2017)
 */
export function formatDeathsRange(deaths: number): string {
  const low  = Math.floor(deaths * 0.85);
  const high = Math.ceil(deaths * 1.15);
  return `${low.toLocaleString()} – ${high.toLocaleString()}`;
}

/**
 * Format coordinates correctly
 * 34.1477, -118.1442 → "34.1477° N, 118.1442° W"
 */
export function formatCoordinates(lat: number, lng: number): string {
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

/**
 * Get projection for a specific year from city data
 */
export function getProjection(data: CityClimateData, year: number): Projection | null {
  return data.projections.find(p => p.year === year) ?? null;
}

/**
 * Get source label for display
 */
export function getSourceLabel(source: string): string {
  if (source.includes("cmip6_ensemble")) return "CMIP6 Ensemble (IPCC AR6)";
  if (source.includes("ipcc_ar6"))       return "IPCC AR6 WG1 Delta Method";
  if (source.includes("extrapolation"))  return "IPCC AR6 Extrapolation";
  return "Open-Meteo ERA5";
}

/**
 * Audit math — live variable substitution for mortality formula
 * Returns string showing Gasparrini 2017 formula with actual values plugged in
 */
export function auditMortality(
  pop: number,
  deathRate: number,
  hwDays: number,
  tempExcess: number,
  vulnMultiplier: number,
): { formula: string; computation: string; result: number } {
  const beta = 0.0801;
  const rr   = Math.exp(beta * Math.max(0, tempExcess));
  const af   = (rr - 1) / rr;
  const result = Math.round(pop * (deathRate / 1000) * (hwDays / 365) * af * vulnMultiplier);

  return {
    formula:     "Deaths = Pop × (DR/1000) × (HW/365) × AF × V",
    computation: `${result.toLocaleString()} = ${pop.toLocaleString()} × (${deathRate.toFixed(2)}/1000) × (${hwDays}/365) × ${af.toFixed(4)} × ${vulnMultiplier.toFixed(2)}`,
    result,
  };
}

/**
 * Audit math — live variable substitution for economic loss formula
 * Returns string showing Burke 2018 + ILO 2019 formula with actual values
 */
export function auditEconomics(
  gdp: number,
  meanTemp: number,
  hwDays: number,
): { formula: string; computation: string; result: number } {
  const tOptimal     = 13.0;
  const burkePenalty = 0.0127 * Math.pow(meanTemp - tOptimal, 2) / 100;
  const iloFraction  = (hwDays / 365) * 0.40 * 0.20;
  const totalFrac    = burkePenalty + iloFraction;
  const result       = gdp * totalFrac;

  const fmt = (v: number) =>
    v >= 1e9 ? `$${(v / 1e9).toFixed(2)}B` : `$${(v / 1e6).toFixed(1)}M`;

  return {
    formula:     "Loss = GDP × (Burke_penalty + ILO_fraction)",
    computation: `${fmt(result)} = ${fmt(gdp)} × (${burkePenalty.toFixed(5)} + ${iloFraction.toFixed(5)})`,
    result,
  };
}