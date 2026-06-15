/**
 * types/climate.ts — Shared TypeScript interfaces for the climate data pipeline.
 *
 * All interfaces are exported from here and re-exported from ClimateDataContext.tsx
 * so existing importers remain unaffected.
 */

export interface Projection {
  year: number;
  source: string;
  heatwave_days: number;
  peak_tx5d_c: number;
  mean_temp_c: number;
  attributable_deaths: number;
  economic_decay_usd: number;
  wbt_max_c: number;
  uhi_intensity_c: number;
  grid_stress_factor: number;
  survivability_status: "STABLE" | "DANGER" | "CRITICAL";
  n_models: number;
  region: string;
  audit_trail?: any;
}

export interface ClimateBaseline {
  baseline_mean_c: number;
}

export interface ResponseMetadata {
  data_lineage: 'empirical_api' | 'statistical_fallback';
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

  // Elevation (metres) — display & AI analysis only
  elevation: number;

  // Data lineage and cache freshness from backend compliance metadata
  metadata?: ResponseMetadata;

  // Fetch metadata
  fetched_at: number;        // timestamp — for cache validation
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

export interface FetchParams {
  city_name:         string;
  lat:               number;
  lng:               number;
  ssp:               string;
  canopy_offset_pct: number;
  albedo_offset_pct: number;
  elevation?:        number;
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
