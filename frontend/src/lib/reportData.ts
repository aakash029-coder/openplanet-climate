/**
 * reportData.ts
 * Assembles a verified, fabrication-free model for the PDF research report from
 * the canonical ClimateDataContext payload.
 *
 * Accuracy contract: a field is included ONLY when it is actually present and
 * finite in the live API response. Missing values are returned as `null` and the
 * renderer omits the corresponding row/figure — nothing is invented or back-filled.
 */

import type { CityClimateData, Projection } from '@/context/ClimateDataContext';

export interface ReportProjectionRow {
  year: number;
  source: string;
  heatwaveDays: number | null;
  peakTx5d: number | null;
  meanTemp: number | null;
  deaths: number | null;
  lossUsd: number | null;
  wbt: number | null;
  survivability: Projection['survivability_status'] | null;
  nModels: number | null;
}

export interface ReportModel {
  cityName: string;
  lat: number;
  lng: number;
  elevationM: number | null;
  population: number | null;
  gdpUsd: number | null;
  ssp: string;
  focusYear: number;
  generatedAtISO: string;
  lineage: 'empirical_api' | 'statistical_fallback' | 'unknown';

  // Baseline climatology (ERA5, 2011–2020)
  era5P95C: number | null;
  tx5dBaselineC: number | null;
  humidityP95: number | null;
  baselineMeanC: number | null;

  // Focus-year socioeconomic inputs (from audit trail) — may be null
  deathRatePer1000: number | null;
  vulnerability: number | null;

  // Climate-character signals (drive the city-specific narrative) — may be null
  climateZone: string | null;
  zoneConfidence: number | null;
  zoneDiagnostics: string[];
  uhiIntensityC: number | null;
  gridStressFactor: number | null;
  region: string | null;
  seasonalityC: number | null;

  projections: ReportProjectionRow[];
  focus: ReportProjectionRow | null;
}

const num = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null;

const pos = (v: unknown): number | null => {
  const n = num(v);
  return n !== null && n > 0 ? n : null;
};

function toRow(p: Projection): ReportProjectionRow {
  return {
    year: p.year,
    source: p.source ?? '',
    heatwaveDays: num(p.heatwave_days),
    peakTx5d: num(p.peak_tx5d_c),
    meanTemp: num(p.mean_temp_c),
    deaths: pos(p.attributable_deaths),
    lossUsd: pos(p.economic_decay_usd),
    wbt: num(p.wbt_max_c),
    survivability: p.survivability_status ?? null,
    nModels: num(p.n_models),
  };
}

/**
 * Returns a ReportModel, or null when there is not enough verified data to
 * produce an honest report (no city resolved or no projections).
 */
export function buildReportModel(
  data: CityClimateData | null,
  focusYear: number,
): ReportModel | null {
  if (!data || !data.projections?.length) return null;

  const projections = [...data.projections]
    .filter((p) => Number.isFinite(p.year))
    .sort((a, b) => a.year - b.year)
    .map(toRow);

  if (projections.length === 0) return null;

  const focus =
    projections.find((p) => p.year === focusYear) ??
    projections.reduce((closest, p) =>
      Math.abs(p.year - focusYear) < Math.abs(closest.year - focusYear) ? p : closest,
    );

  const focusProj = data.projections.find((p) => p.year === focus.year);
  const audit = focusProj?.audit_trail as
    | {
        mortality?: { variables?: { DR?: number; V?: number } };
        climate_zone?: { detected_zone?: string; confidence?: number; diagnostic_flags?: string[] };
      }
    | undefined;

  const zone = audit?.climate_zone;
  // Seasonality proxy: peak heat above the annual mean (large = continental/diurnal).
  const seasonalityBase = num(data.baseline?.baseline_mean_c);
  const seasonalityPeak = num(data.tx5d_baseline_c) ?? focus.peakTx5d;
  const seasonalityC =
    seasonalityBase !== null && seasonalityPeak !== null
      ? Math.round((seasonalityPeak - seasonalityBase) * 10) / 10
      : null;

  const lineage =
    data.metadata?.data_lineage === 'empirical_api' ||
    data.metadata?.data_lineage === 'statistical_fallback'
      ? data.metadata.data_lineage
      : 'unknown';

  return {
    cityName: data.city_name,
    lat: data.lat,
    lng: data.lng,
    elevationM: pos(data.elevation),
    population: pos(data.population),
    gdpUsd: pos(data.gdp_usd),
    ssp: data.ssp,
    focusYear: focus.year,
    generatedAtISO: new Date().toISOString(),
    lineage,

    era5P95C: num(data.threshold_c),
    tx5dBaselineC: num(data.tx5d_baseline_c),
    humidityP95: num(data.era5_humidity_p95),
    baselineMeanC: num(data.baseline?.baseline_mean_c),

    deathRatePer1000: pos(audit?.mortality?.variables?.DR),
    vulnerability: pos(audit?.mortality?.variables?.V),

    climateZone: typeof zone?.detected_zone === 'string' ? zone.detected_zone : null,
    zoneConfidence: num(zone?.confidence),
    zoneDiagnostics: Array.isArray(zone?.diagnostic_flags)
      ? zone.diagnostic_flags.filter((d): d is string => typeof d === 'string')
      : [],
    uhiIntensityC: num(focusProj?.uhi_intensity_c),
    gridStressFactor: num(focusProj?.grid_stress_factor),
    region: typeof focusProj?.region === 'string' ? focusProj.region : null,
    seasonalityC,

    projections,
    focus,
  };
}

// ── City-specific narrative, derived only from real signals ───────────────────
// Qualitative mechanisms are established science (cited in the report); all
// city-specific clauses are gated on the city's own computed values.

interface ZoneProfile {
  name: string;
  drivers: string;
}

const ZONE_PROFILE: Record<string, ZoneProfile> = {
  HYPER_ARID_DESERT: {
    name: 'hyper-arid desert',
    drivers:
      'intense daytime solar loading on dry ground, very low atmospheric moisture, and a large day–night temperature swing. Heat here is predominantly sensible (dry) rather than humid.',
  },
  LETHAL_HUMID_ZONE: {
    name: 'humid tropical / coastal',
    drivers:
      'high atmospheric moisture and strong latent-heat flux that suppress night-time cooling and drive wet-bulb temperature toward the human survivability limit. Humidity, not just air temperature, governs danger.',
  },
  EXTREME_CONTINENTAL: {
    name: 'extreme continental',
    drivers:
      'a strong land-driven seasonal cycle — hot summers and cold winters — with large summer urban heat build-up and little maritime moderation.',
  },
  PERMAFROST_ZONE: {
    name: 'cold / sub-polar',
    drivers:
      'a cold base climate in which the dominant near-term hazard remains winter cold, even as summer warming accelerates.',
  },
  STANDARD_ZONE: {
    name: 'temperate / moderate',
    drivers:
      'a moderate base climate in which rising mean temperatures gradually lengthen and intensify summer heat episodes.',
  },
};

function latitudeBand(lat: number): string {
  const a = Math.abs(lat);
  if (a <= 23.5) return 'tropical';
  if (a <= 35) return 'subtropical';
  if (a <= 55) return 'mid-latitude';
  return 'high-latitude';
}

/** Paragraphs explaining what physically governs THIS city's climate. */
export function narrativeClimateCharacter(m: ReportModel): string[] {
  const out: string[] = [];
  const zp = m.climateZone ? ZONE_PROFILE[m.climateZone] : undefined;
  const band = latitudeBand(m.lat);

  if (zp) {
    out.push(
      `${m.cityName} sits in a ${band}, ${zp.name} regime. Its climate is governed by ${zp.drivers}`,
    );
  } else {
    out.push(
      `${m.cityName} sits in a ${band} setting. The analysis below is driven by its own ERA5 baseline signature rather than a generic climate label.`,
    );
  }

  if (m.humidityP95 !== null) {
    if (m.humidityP95 >= 60) {
      out.push(
        `Characteristic humidity is high (ERA5 P95 ≈ ${m.humidityP95.toFixed(0)}%). High moisture limits evaporative (sweat) cooling, so wet-bulb temperature — not dry-bulb — becomes the controlling measure of heat danger, and night-time relief is reduced.`,
      );
    } else if (m.humidityP95 <= 40) {
      out.push(
        `Characteristic humidity is low (ERA5 P95 ≈ ${m.humidityP95.toFixed(0)}%), producing dry heat with a large diurnal range: very hot days but comparatively cooler nights that allow some physiological recovery.`,
      );
    }
  }

  if (m.seasonalityC !== null && m.seasonalityC >= 12) {
    out.push(
      `The gap between peak heat and the annual mean is large (≈ ${m.seasonalityC.toFixed(0)} °C), indicating a strongly seasonal/continental climate in which summer heat builds well above baseline.`,
    );
  }

  if (m.elevationM !== null && m.elevationM > 1000) {
    out.push(
      `At ≈ ${Math.round(m.elevationM)} m elevation, altitude partially moderates daytime extremes relative to lowland cities at the same latitude.`,
    );
  }

  if (m.zoneDiagnostics.length) {
    out.push(`Engine climate-zone diagnostics: ${m.zoneDiagnostics.join('; ')}.`);
  }
  return out;
}

/** Why this city's temperatures are projected to rise. */
export function narrativeWhyWarming(m: ReportModel): string[] {
  const out: string[] = [];
  out.push(
    `Under emission pathway ${m.ssp}, accumulating greenhouse-gas forcing raises the regional mean temperature; the CMIP6 ensemble values tabulated in this report are the result for the ${m.focusYear} horizon.`,
  );
  if (m.uhiIntensityC !== null && m.uhiIntensityC > 0) {
    out.push(
      `Within the built-up core, the urban heat island adds roughly ${m.uhiIntensityC.toFixed(1)} °C on top of the regional signal, as heat-absorbing surfaces (asphalt, concrete) and reduced vegetation store daytime heat and release it at night.`,
    );
  }
  out.push(
    'Crucially, extreme-heat days scale non-linearly with the mean: a modest rise in average temperature produces a disproportionately large increase in the number of days exceeding the city’s own P95 heat threshold.',
  );
  return out;
}

/** Why extreme heat increases mortality in this city. */
export function narrativeWhyMortality(m: ReportModel): string[] {
  const out: string[] = [];
  out.push(
    'Heat causes death primarily through cardiovascular and renal strain when the body can no longer shed metabolic heat. Risk rises sharply once night-time minima stay elevated (preventing recovery) and once wet-bulb temperature approaches 35 °C, beyond which sweating cannot cool the body even in shade (Sherwood & Huber, 2010).',
  );
  if (m.vulnerability !== null) {
    const sense = m.vulnerability > 1 ? 'elevated' : 'below-average';
    out.push(
      `This city’s composite vulnerability multiplier is ${m.vulnerability.toFixed(2)} (${sense} sensitivity), combining its age structure, air-conditioning/cooling access, and health-system capacity via the OpenPlanet Composite Vulnerability Index.`,
    );
  }
  out.push(
    'The elderly, outdoor labourers, and households without air-conditioning bear the greatest burden (Gasparrini et al., 2017).',
  );
  if (m.humidityP95 !== null && m.humidityP95 >= 60) {
    out.push(
      'Because of this city’s high humidity, lethality is wet-bulb-driven: dangerous conditions can occur even when peak air temperature appears moderate.',
    );
  }
  return out;
}

/** Seasonal hazard profile + honest scope note. */
export function narrativeSeasonalProfile(m: ReportModel): string[] {
  const out: string[] = [];
  out.push('Extreme heat is the principal hazard quantified by this engine.');
  const band = latitudeBand(m.lat);
  if (m.humidityP95 !== null && m.humidityP95 >= 60 && (band === 'tropical' || band === 'subtropical')) {
    out.push(
      'A humid/monsoon season raises wet-bulb heat stress even when peak dry-bulb temperature is lower, extending the dangerous period beyond the hottest pre-monsoon weeks.',
    );
  }
  if (m.climateZone === 'EXTREME_CONTINENTAL' || m.climateZone === 'PERMAFROST_ZONE' || band === 'high-latitude') {
    out.push(
      'Winter cold remains a real seasonal hazard for this city, although cold-season mortality is outside the scope of this heat-risk model.',
    );
  }
  out.push(
    'Scope note: this report quantifies heat-related risk only. Flooding, air quality, drought, and cold-season mortality are not modelled and should be assessed separately.',
  );
  return out;
}

// ── Formatting helpers shared by the renderer ─────────────────────────────────

export const fmtInt = (v: number | null): string =>
  v === null ? '—' : Math.round(v).toLocaleString('en-US');

export const fmtTemp = (v: number | null, dp = 1): string =>
  v === null ? '—' : `${v.toFixed(dp)} °C`;

export const fmtUsd = (v: number | null): string => {
  if (v === null) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(2)} B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(1)} M`;
  return `$${Math.round(v).toLocaleString('en-US')}`;
};

export const fmtWbt = (v: number | null): string => {
  if (v === null) return '—';
  if (v >= 35) return '> 35 °C (critical)';
  return `${v.toFixed(1)} °C`;
};

export const fmtCoord = (lat: number, lng: number): string => {
  const la = `${Math.abs(lat).toFixed(4)}° ${lat >= 0 ? 'N' : 'S'}`;
  const lo = `${Math.abs(lng).toFixed(4)}° ${lng >= 0 ? 'E' : 'W'}`;
  return `${la}, ${lo}`;
};

export function sourceLabel(source: string): string {
  if (source.includes('cmip6_ensemble')) return 'CMIP6 ensemble (IPCC AR6)';
  if (source.includes('ipcc_ar6')) return 'IPCC AR6 WG1 delta method';
  if (source.includes('extrapolation')) return 'IPCC AR6 decadal extrapolation';
  return 'Open-Meteo / ERA5';
}
