/**
 * ClimateReportPDF.tsx
 * Elite, research-paper-style PDF report for a single city's climate-risk
 * assessment. Built with @react-pdf/renderer (vector output) using the standard
 * Times-Roman family for an academic look and zero font-loading fragility.
 *
 * Accuracy contract (see reportData.ts): only verified fields are rendered.
 * Rows for missing values are omitted; the map figure is included ONLY when a
 * real canvas capture is supplied. Nothing is fabricated.
 *
 * This module statically imports @react-pdf/renderer but is itself only ever
 * dynamically imported (on button click), so the library stays out of the main
 * bundle.
 */

import type { ReactNode } from 'react';
import {
  Document,
  Page,
  View,
  Text,
  Image,
  Svg,
  G,
  Rect,
  Line,
  Polyline,
  Circle,
  StyleSheet,
  pdf,
} from '@react-pdf/renderer';

import {
  type ReportModel,
  type ReportProjectionRow,
  fmtInt,
  fmtTemp,
  fmtUsd,
  fmtWbt,
  fmtCoord,
  sourceLabel,
  narrativeClimateCharacter,
  narrativeWhyWarming,
  narrativeWhyMortality,
  narrativeSeasonalProfile,
} from '@/lib/reportData';

export interface ReportExtras {
  aiAnalysis?: Record<string, string> | null;
  historicalEras?: Record<
    string,
    { label?: string; peak_temp?: string; avg_mean_temp?: string }
  > | null;
}

// ── Palette (light / printable academic) ──────────────────────────────────────
const INK = '#14181f';
const NAVY = '#14213d';
const GREY = '#5b6470';
const RULE = '#c9ccd2';
const FILL = '#f2f3f5';
const GOLD = '#8a6d3f';
const HEAT = ['#2F6F8F', '#B79237', '#BE6A2E', '#A23A30'];

const s = StyleSheet.create({
  page: {
    paddingTop: 54,
    paddingBottom: 56,
    paddingHorizontal: 50,
    fontFamily: 'Times-Roman',
    fontSize: 10.5,
    color: INK,
    lineHeight: 1.45,
  },
  runHeader: {
    position: 'absolute',
    top: 24,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: GREY,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    borderBottomWidth: 0.5,
    borderBottomColor: RULE,
    paddingBottom: 4,
  },
  runFooter: {
    position: 'absolute',
    bottom: 28,
    left: 50,
    right: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7.5,
    fontFamily: 'Helvetica',
    color: GREY,
    borderTopWidth: 0.5,
    borderTopColor: RULE,
    paddingTop: 5,
  },
  eyebrow: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: GOLD,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: {
    fontFamily: 'Times-Bold',
    fontSize: 22,
    color: NAVY,
    lineHeight: 1.15,
  },
  subtitle: { fontSize: 11, color: GREY, marginTop: 6 },
  hr: { borderBottomWidth: 1, borderBottomColor: NAVY, marginVertical: 12 },
  hrThin: { borderBottomWidth: 0.5, borderBottomColor: RULE, marginVertical: 9 },
  sectionH: {
    fontFamily: 'Times-Bold',
    fontSize: 13,
    color: NAVY,
    marginTop: 16,
    marginBottom: 6,
  },
  abstractBox: {
    backgroundColor: FILL,
    borderLeftWidth: 2,
    borderLeftColor: GOLD,
    padding: 10,
    marginTop: 10,
  },
  abstractLabel: {
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    color: NAVY,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  p: { marginBottom: 6, textAlign: 'justify' },
  small: { fontSize: 8.5, color: GREY },
  caption: { fontSize: 8, color: GREY, fontFamily: 'Helvetica', marginTop: 4 },
  // tables
  tRow: { flexDirection: 'row', borderBottomWidth: 0.5, borderBottomColor: RULE },
  tHead: { flexDirection: 'row', backgroundColor: NAVY },
  th: {
    color: '#fff',
    fontFamily: 'Helvetica-Bold',
    fontSize: 8,
    padding: 5,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  td: { padding: 5, fontSize: 9.5 },
  tdMono: { padding: 5, fontSize: 9, fontFamily: 'Courier' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 7,
    marginTop: 12,
    borderWidth: 0.5,
  },
  bannerDot: { width: 6, height: 6, borderRadius: 3, marginRight: 7 },
  refItem: { flexDirection: 'row', marginBottom: 4 },
  refNum: { width: 18, fontFamily: 'Helvetica-Bold', fontSize: 8.5, color: NAVY },
  refText: { flex: 1, fontSize: 8.5 },
});

// ── Reusable bits ─────────────────────────────────────────────────────────────

function KV({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <View style={s.tRow}>
      <Text style={[s.td, { width: '42%', color: GREY }]}>{k}</Text>
      <Text style={[mono ? s.tdMono : s.td, { width: '58%' }]}>{v}</Text>
    </View>
  );
}

function Para({ lines }: { lines: string[] }) {
  return (
    <View>
      {lines.map((t, i) => (
        <Text key={i} style={s.p}>
          {t}
        </Text>
      ))}
    </View>
  );
}

// ── Vector charts (drawn from real projection data only) ──────────────────────

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

// SVG text helper — react-pdf wants fontSize/fontFamily via `style`.
function SvgText({
  x,
  y,
  children,
  fill = INK,
  size = 7.5,
  bold = false,
  anchor,
}: {
  x: number;
  y: number;
  children: React.ReactNode;
  fill?: string;
  size?: number;
  bold?: boolean;
  anchor?: 'start' | 'middle' | 'end';
}): ReactNode {
  return (
    <Text x={x} y={y} fill={fill} textAnchor={anchor} style={{ fontSize: size, fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica' }}>
      {children}
    </Text>
  );
}

function BarChart({
  data,
  color,
  unit,
  width = 495,
  height = 168,
}: {
  data: { label: string; value: number | null }[];
  color: string;
  unit: string;
  width?: number;
  height?: number;
}) {
  const padL = 40;
  const padR = 12;
  const padT = 10;
  const padB = 24;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const max = niceMax(Math.max(1, ...data.map((d) => d.value ?? 0)));
  const n = data.length;
  const slot = plotW / n;
  const barW = Math.min(48, slot * 0.55);
  const yOf = (v: number) => padT + plotH - (v / max) * plotH;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* gridlines + y labels at 0, 0.5, 1 */}
      {[0, 0.5, 1].map((f, i) => {
        const y = padT + plotH - f * plotH;
        return (
          <G key={`g${i}`}>
            <Line x1={padL} y1={y} x2={width - padR} y2={y} stroke={RULE} strokeWidth={0.5} />
            <SvgText x={padL - 6} y={y + 3} fill={GREY} size={7} anchor="end">{Math.round(max * f)}</SvgText>
          </G>
        );
      })}
      {/* axis */}
      <Line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={INK} strokeWidth={0.8} />
      <Line x1={padL} y1={padT + plotH} x2={width - padR} y2={padT + plotH} stroke={INK} strokeWidth={0.8} />
      {/* bars — null values are skipped (no fabrication) */}
      {data.map((d, i) => {
        if (d.value === null) {
          return (
            <SvgText key={`b${i}`} x={padL + slot * (i + 0.5)} y={padT + plotH + 15} fill={GREY} anchor="middle">{d.label}</SvgText>
          );
        }
        const x = padL + slot * (i + 0.5) - barW / 2;
        const y = yOf(d.value);
        return (
          <G key={`b${i}`}>
            <Rect x={x} y={y} width={barW} height={padT + plotH - y} fill={color} />
            <SvgText x={x + barW / 2} y={y - 3} fill={INK} bold anchor="middle">{Math.round(d.value)}</SvgText>
            <SvgText x={padL + slot * (i + 0.5)} y={padT + plotH + 15} fill={GREY} anchor="middle">{d.label}</SvgText>
          </G>
        );
      })}
      <SvgText x={padL} y={8} fill={GREY} size={7}>{unit}</SvgText>
    </Svg>
  );
}

function LineChart({
  years,
  series,
  width = 495,
  height = 180,
}: {
  years: number[];
  series: { name: string; color: string; points: (number | null)[] }[];
  width?: number;
  height?: number;
}) {
  const padL = 40;
  const padR = 12;
  const padT = 12;
  const padB = 36;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;
  const all = series.flatMap((se) => se.points.filter((p): p is number => p !== null));
  const maxV = niceMax(Math.max(1, ...all));
  const minV = 0;
  const n = years.length;
  const xOf = (i: number) => padL + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));
  const yOf = (v: number) => padT + plotH - ((v - minV) / (maxV - minV)) * plotH;

  return (
    <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {[0, 0.25, 0.5, 0.75, 1].map((f, i) => {
        const y = padT + plotH - f * plotH;
        return (
          <G key={`g${i}`}>
            <Line x1={padL} y1={y} x2={width - padR} y2={y} stroke={RULE} strokeWidth={0.5} />
            <SvgText x={padL - 6} y={y + 3} fill={GREY} size={7} anchor="end">{Math.round(maxV * f)}</SvgText>
          </G>
        );
      })}
      <Line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={INK} strokeWidth={0.8} />
      <Line x1={padL} y1={padT + plotH} x2={width - padR} y2={padT + plotH} stroke={INK} strokeWidth={0.8} />
      {years.map((yr, i) => (
        <SvgText key={`x${i}`} x={xOf(i)} y={padT + plotH + 14} fill={GREY} anchor="middle">{yr}</SvgText>
      ))}
      {series.map((se, si) => {
        const pts = se.points
          .map((p, i) => (p === null ? null : `${xOf(i)},${yOf(p)}`))
          .filter((p): p is string => p !== null)
          .join(' ');
        return (
          <G key={`s${si}`}>
            <Polyline points={pts} stroke={se.color} strokeWidth={1.6} fill="none" />
            {se.points.map((p, i) =>
              p === null ? null : <Circle key={`c${si}-${i}`} cx={xOf(i)} cy={yOf(p)} r={2.2} fill={se.color} />,
            )}
          </G>
        );
      })}
      {/* legend */}
      {series.map((se, si) => (
        <G key={`l${si}`}>
          <Rect x={padL + si * 150} y={height - 12} width={9} height={4} fill={se.color} />
          <SvgText x={padL + si * 150 + 13} y={height - 8} fill={INK}>{se.name}</SvgText>
        </G>
      ))}
    </Svg>
  );
}

// ── Sources (verified, fixed bibliography) ────────────────────────────────────
const REFERENCES = [
  'Gasparrini A. et al. (2017). Projections of temperature-related excess mortality under climate change scenarios. The Lancet Planetary Health 1(9): e360–e367.',
  'Burke M., Davis W.M., Diffenbaugh N.S. (2018). Large potential reduction in economic damages under UN mitigation targets. Nature 557: 549–553.',
  'International Labour Organization (2019). Working on a Warmer Planet: The impact of heat stress on labour productivity. ILO, Geneva.',
  'Stull R. (2011). Wet-Bulb Temperature from Relative Humidity and Air Temperature. J. Applied Meteorology and Climatology 50(11): 2267–2269.',
  'Sherwood S.C., Huber M. (2010). An adaptability limit to climate change due to heat stress. PNAS 107(21): 9552–9555.',
  'Hersbach H. et al. (2020). The ERA5 global reanalysis. Q. J. R. Meteorol. Soc. 146: 1999–2049.',
  'IPCC (2021). Climate Change 2021: The Physical Science Basis (AR6 WG1). Cambridge University Press.',
];

const SOURCE_ROWS: [string, string][] = [
  ['Baseline climatology', 'Copernicus C3S ERA5 reanalysis (2011–2020) via Open-Meteo'],
  ['Forward projections', 'CMIP6 MRI-AGCM3-2-S / MPI-ESM1-2-XR ensemble; IPCC AR6 deltas post-2050'],
  ['Mortality model', 'Gasparrini et al. (2017), β = 0.0801; saturating ΔT, AF cap 0.35'],
  ['Economic model', 'Burke et al. (2018) T_opt 13 °C + ILO (2019) labour heat-stress'],
  ['Wet-bulb model', 'Stull (2011); 35 °C ceiling per Sherwood & Huber (2010)'],
  ['Socioeconomic data', 'World Bank WDI (death rate, GDP); UN / metro population vault'],
];

// ── Document ──────────────────────────────────────────────────────────────────

function buildAbstract(m: ReportModel): string {
  const f = m.focus;
  if (!f) return '';
  const parts: string[] = [];
  parts.push(
    `This report presents a directional physical climate-risk assessment for ${m.cityName} ` +
      `(${fmtCoord(m.lat, m.lng)}) under scenario ${m.ssp}, with a focus horizon of ${f.year}.`,
  );
  if (f.peakTx5d !== null) {
    parts.push(
      `The ${sourceLabel(f.source)} projects a peak 5-day maximum temperature of ${fmtTemp(f.peakTx5d)}` +
        (f.heatwaveDays !== null ? ` and approximately ${fmtInt(f.heatwaveDays)} heatwave days per year` : '') +
        '.',
    );
  }
  if (f.wbt !== null) {
    parts.push(
      `Peak wet-bulb temperature is estimated at ${fmtWbt(f.wbt)} against the 35 °C physiological survivability ceiling.`,
    );
  }
  if (f.deaths !== null || f.lossUsd !== null) {
    const bits: string[] = [];
    if (f.deaths !== null) bits.push(`${fmtInt(f.deaths)} heat-attributable deaths/yr`);
    if (f.lossUsd !== null) bits.push(`${fmtUsd(f.lossUsd)} in annual economic exposure`);
    parts.push(`Directional estimates indicate ${bits.join(' and ')}.`);
  }
  parts.push(
    'All figures are macro-scale screening proxies derived from public datasets and peer-reviewed methods; they are not certified forecasts or actuarial assessments.',
  );
  return parts.join(' ');
}

function titleCase(k: string): string {
  return k
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

export function ClimateReport({
  m,
  mapImage,
  extras,
}: {
  m: ReportModel;
  mapImage?: string | null;
  extras?: ReportExtras;
}) {
  const isFallback = m.lineage === 'statistical_fallback';
  const date = new Date(m.generatedAtISO).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const years = m.projections.map((p) => p.year);

  const eraOrder = ['era1', 'era2', 'era3'];
  const eras = (extras?.historicalEras
    ? eraOrder
        .map((k) => extras.historicalEras![k])
        .filter((e): e is NonNullable<typeof e> => !!e && (!!e.peak_temp || !!e.avg_mean_temp))
    : []) as { label?: string; peak_temp?: string; avg_mean_temp?: string }[];

  const aiEntries = extras?.aiAnalysis
    ? Object.entries(extras.aiAnalysis).filter(
        ([, v]) => typeof v === 'string' && v.trim().length > 0,
      )
    : [];

  const Header = () => (
    <View style={s.runHeader} fixed>
      <Text>OpenPlanet · Climate Risk Intelligence</Text>
      <Text render={({ pageNumber, totalPages }) => `${m.cityName} · ${pageNumber}/${totalPages}`} />
    </View>
  );
  const Footer = () => (
    <View style={s.runFooter} fixed>
      <Text>Directional screening proxy — not investment, engineering, or medical advice.</Text>
      <Text>{date}</Text>
    </View>
  );

  return (
    <Document
      title={`OpenPlanet Climate Risk Assessment — ${m.cityName}`}
      author="OpenPlanet"
      subject={`Physical climate risk, ${m.ssp}, ${m.focusYear}`}
      creator="OpenPlanet Climate Engine"
    >
      {/* ── PAGE 1 ── */}
      <Page size="A4" style={s.page}>
        <Header />
        <Footer />

        <Text style={s.eyebrow}>Physical Climate Risk Assessment</Text>
        <Text style={s.title}>{m.cityName}</Text>
        <Text style={s.subtitle}>
          {fmtCoord(m.lat, m.lng)}  ·  Scenario {m.ssp}  ·  Focus horizon {m.focusYear}
        </Text>
        <View style={s.hr} />

        {/* lineage banner */}
        <View
          style={[
            s.banner,
            {
              borderColor: isFallback ? '#a23a30' : '#2f7a4d',
              backgroundColor: isFallback ? '#fbeae8' : '#eaf5ee',
            },
          ]}
        >
          <View style={[s.bannerDot, { backgroundColor: isFallback ? '#a23a30' : '#2f7a4d' }]} />
          <Text style={{ fontSize: 8.5 }}>
            {isFallback
              ? 'DATA LINEAGE: statistical fallback — one or more upstream APIs were unavailable; values are indicative, order-of-magnitude only.'
              : 'DATA LINEAGE: empirical — built from live ERA5 reanalysis and CMIP6 ensemble projections.'}
          </Text>
        </View>

        <View style={s.abstractBox}>
          <Text style={s.abstractLabel}>Abstract</Text>
          <Text style={{ fontSize: 9.5, textAlign: 'justify' }}>{buildAbstract(m)}</Text>
        </View>

        <Text style={s.sectionH}>1 · Study Site & Baseline Climatology</Text>
        <Text style={s.p}>
          The analytical baseline is the WMO 2011–2020 reference decade of ERA5 daily maximum
          temperature at the resolved coordinate. The 95th-percentile threshold defines the city&apos;s
          own heat-onset reference; mortality and economic functions are anchored to this baseline.
        </Text>
        <View style={{ borderWidth: 0.5, borderColor: RULE, marginTop: 4 }}>
          <KV k="Resolved coordinate" v={fmtCoord(m.lat, m.lng)} mono />
          {m.elevationM !== null && <KV k="Elevation" v={`${Math.round(m.elevationM)} m`} mono />}
          {m.population !== null && <KV k="Metropolitan population" v={fmtInt(m.population)} mono />}
          {m.gdpUsd !== null && <KV k="Estimated metro GDP" v={fmtUsd(m.gdpUsd)} mono />}
          {m.baselineMeanC !== null && <KV k="Baseline mean temperature" v={fmtTemp(m.baselineMeanC)} mono />}
          {m.era5P95C !== null && <KV k="ERA5 P95 heat threshold" v={fmtTemp(m.era5P95C)} mono />}
          {m.tx5dBaselineC !== null && <KV k="Tx5d baseline" v={fmtTemp(m.tx5dBaselineC)} mono />}
          {m.humidityP95 !== null && <KV k="ERA5 humidity P95" v={`${m.humidityP95.toFixed(0)} %`} mono />}
        </View>

        {mapImage && (
          <View>
            <Text style={s.sectionH}>Figure 1 · Spatial Heat-Exposure Surface</Text>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={mapImage} style={{ width: '100%', borderWidth: 0.5, borderColor: RULE }} />
            <Text style={s.caption}>
              H3 resolution-9 hex grid coloured by normalised thermal risk for {m.focusYear} ({m.ssp}).
              Rendered from the live MapLibre/CMIP6 surface. Hex cells are a spatial index, not
              independent sub-cell measurements.
            </Text>
          </View>
        )}
      </Page>

      {/* ── PAGE 2 — city climate behaviour ── */}
      <Page size="A4" style={s.page}>
        <Header />
        <Footer />

        <Text style={s.sectionH}>2 · Climate Character & Drivers</Text>
        <Para lines={narrativeClimateCharacter(m)} />
        {(m.climateZone || m.zoneConfidence !== null) && (
          <View style={{ borderWidth: 0.5, borderColor: RULE, marginTop: 2 }}>
            {m.climateZone && <KV k="Detected climate zone" v={titleCase(m.climateZone)} />}
            {m.zoneConfidence !== null && <KV k="Zone confidence" v={`${Math.round(m.zoneConfidence * 100)}%`} mono />}
            {m.region && <KV k="Region" v={m.region} />}
            {m.seasonalityC !== null && <KV k="Peak-above-mean amplitude" v={fmtTemp(m.seasonalityC)} mono />}
            {m.uhiIntensityC !== null && <KV k="Urban heat-island intensity" v={fmtTemp(m.uhiIntensityC)} mono />}
          </View>
        )}

        {eras.length > 0 && (
          <View wrap={false}>
            <Text style={s.sectionH}>3 · Observed Historical Record</Text>
            <Text style={s.p}>
              Decadal ERA5 history at this coordinate — the measured trajectory that precedes the
              projections. Each era reports the sustained 5-day peak and the mean temperature.
            </Text>
            <View style={s.tHead}>
              <Text style={[s.th, { width: '40%' }]}>Era</Text>
              <Text style={[s.th, { width: '30%' }]}>Peak (5-day)</Text>
              <Text style={[s.th, { width: '30%' }]}>Mean</Text>
            </View>
            {eras.map((e, i) => (
              <View style={s.tRow} key={i}>
                <Text style={[s.td, { width: '40%' }]}>{e.label ?? `Era ${i + 1}`}</Text>
                <Text style={[s.tdMono, { width: '30%' }]}>{e.peak_temp ? `${e.peak_temp} °C` : '—'}</Text>
                <Text style={[s.tdMono, { width: '30%' }]}>{e.avg_mean_temp ? `${e.avg_mean_temp} °C` : '—'}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.sectionH}>{eras.length > 0 ? '4' : '3'} · Why Temperatures Are Rising Here</Text>
        <Para lines={narrativeWhyWarming(m)} />
      </Page>

      {/* ── PAGE 3 ── */}
      <Page size="A4" style={s.page}>
        <Header />
        <Footer />

        <Text style={s.sectionH}>5 · Projected Heat Exposure</Text>
        <Text style={s.p}>
          Projections combine direct CMIP6 ensemble extraction (2030, 2050) with IPCC AR6 WG1
          decadal delta-rate extrapolation (post-2050). Each row reflects the model output for the
          selected emission pathway.
        </Text>

        <View style={s.tHead}>
          <Text style={[s.th, { width: '12%' }]}>Year</Text>
          <Text style={[s.th, { width: '20%' }]}>Peak Tx5d</Text>
          <Text style={[s.th, { width: '16%' }]}>HW days</Text>
          <Text style={[s.th, { width: '18%' }]}>Wet-bulb</Text>
          <Text style={[s.th, { width: '34%' }]}>Status</Text>
        </View>
        {m.projections.map((p: ReportProjectionRow) => (
          <View style={s.tRow} key={p.year}>
            <Text style={[s.tdMono, { width: '12%' }]}>{p.year}</Text>
            <Text style={[s.tdMono, { width: '20%' }]}>{fmtTemp(p.peakTx5d)}</Text>
            <Text style={[s.tdMono, { width: '16%' }]}>{fmtInt(p.heatwaveDays)}</Text>
            <Text style={[s.tdMono, { width: '18%' }]}>{fmtWbt(p.wbt)}</Text>
            <Text style={[s.td, { width: '34%' }]}>{p.survivability ?? '—'}</Text>
          </View>
        ))}

        <Text style={s.sectionH}>Figure 2 · Heatwave Days per Year</Text>
        <BarChart
          unit="days/yr"
          color={HEAT[2]}
          data={m.projections.map((p) => ({ label: String(p.year), value: p.heatwaveDays }))}
        />
        <Text style={s.caption}>Days exceeding the local ERA5 P95 threshold, by projection horizon.</Text>

        <Text style={s.sectionH}>Figure 3 · Temperature & Wet-Bulb Trajectory</Text>
        <LineChart
          years={years}
          series={[
            { name: 'Peak Tx5d (°C)', color: HEAT[3], points: m.projections.map((p) => p.peakTx5d) },
            { name: 'Wet-bulb (°C)', color: HEAT[0], points: m.projections.map((p) => p.wbt) },
          ]}
        />
        <Text style={s.caption}>
          Wet-bulb values are display-capped at the 35 °C survivability ceiling (Sherwood &amp; Huber, 2010).
        </Text>
      </Page>

      {/* ── PAGE 4 — impacts & mechanisms ── */}
      <Page size="A4" style={s.page}>
        <Header />
        <Footer />

        <Text style={s.sectionH}>6 · Why Extreme Heat Increases Mortality</Text>
        <Para lines={narrativeWhyMortality(m)} />
        <Text style={[s.small, { fontFamily: 'Courier', marginBottom: 6 }]}>
          Deaths = Pop × (DR/1000) × (HW/365) × AF × V,  AF = (RR−1)/RR,  RR = exp(β·ΔT_eff),  β = 0.0801
        </Text>
        <View style={{ borderWidth: 0.5, borderColor: RULE }}>
          {m.focus?.deaths !== null && m.focus !== null && (
            <KV k={`Attributable deaths (${m.focusYear})`} v={`${fmtInt(m.focus.deaths)} /yr`} mono />
          )}
          {m.deathRatePer1000 !== null && <KV k="Crude death rate (World Bank)" v={`${m.deathRatePer1000.toFixed(2)} per 1,000`} mono />}
          {m.vulnerability !== null && <KV k="Composite vulnerability (OP-CVI)" v={m.vulnerability.toFixed(3)} mono />}
        </View>
        <Text style={s.caption}>
          Mortality carries materially higher uncertainty for acute (&lt; 10-day) events — see methodology backtests (MAE ≈ 41 %). Use for comparative triage, not individual-event point prediction.
        </Text>

        <Text style={s.sectionH}>7 · Economic Exposure</Text>
        <Text style={s.p}>
          Damages combine a Burke et al. (2018) macro-growth penalty (optimum 13 °C) with an ILO
          (2019) labour-productivity heat-stress loss applied during projected heatwave days — outdoor
          and manual work slows or stops as wet-bulb conditions rise.
        </Text>
        <View style={{ borderWidth: 0.5, borderColor: RULE }}>
          {m.focus?.lossUsd !== null && m.focus !== null && (
            <KV k={`Annual economic exposure (${m.focusYear})`} v={fmtUsd(m.focus.lossUsd)} mono />
          )}
          {m.gdpUsd !== null && <KV k="Estimated metro GDP" v={fmtUsd(m.gdpUsd)} mono />}
        </View>

        <Text style={s.sectionH}>8 · Wet-Bulb Survivability</Text>
        <Text style={s.p}>
          Wet-bulb temperature is computed with the Stull (2011) empirical equation on co-occurring
          afternoon temperature and humidity. Sustained exposure above 35 °C exceeds the human
          thermoregulatory limit even for healthy, shaded, hydrated individuals — the body cannot
          shed heat once the air is as warm and wet as the skin.
        </Text>
        <View style={{ borderWidth: 0.5, borderColor: RULE }}>
          {m.focus?.wbt !== null && m.focus !== null && (
            <KV k={`Peak wet-bulb (${m.focusYear})`} v={fmtWbt(m.focus.wbt)} mono />
          )}
          <KV k="Survivability ceiling" v="35.0 °C (Sherwood & Huber, 2010)" mono />
        </View>

        <Text style={s.sectionH}>9 · Seasonal Hazard Profile</Text>
        <Para lines={narrativeSeasonalProfile(m)} />
      </Page>

      {/* ── PAGE 5 — context, methodology, references ── */}
      <Page size="A4" style={s.page}>
        <Header />
        <Footer />

        {aiEntries.length > 0 && (
          <View>
            <Text style={s.sectionH}>10 · Contextual Analysis (AI-generated)</Text>
            <Text style={[s.caption, { marginBottom: 6 }]}>
              The following geographic/contextual narrative is generated by a language model for
              orientation only. It may contain interpretation; the quantitative figures in
              Sections 1–9 are the authoritative source.
            </Text>
            {aiEntries.map(([k, v]) => (
              <View key={k} style={{ marginBottom: 6 }}>
                <Text style={{ fontFamily: 'Times-Bold', fontSize: 10.5, color: NAVY, marginBottom: 2 }}>
                  {titleCase(k)}
                </Text>
                <Text style={s.p}>{v}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={s.sectionH}>{aiEntries.length > 0 ? '11' : '10'} · Methodology & Data Provenance</Text>
        {SOURCE_ROWS.map(([k, v]) => (
          <KV key={k} k={k} v={v} />
        ))}

        <View style={s.hrThin} />
        <Text style={s.sectionH}>References</Text>
        {REFERENCES.map((r, i) => (
          <View style={s.refItem} key={i}>
            <Text style={s.refNum}>[{i + 1}]</Text>
            <Text style={s.refText}>{r}</Text>
          </View>
        ))}
      </Page>
    </Document>
  );
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function downloadClimateReport(
  m: ReportModel,
  mapImage?: string | null,
  extras?: ReportExtras,
): Promise<void> {
  const blob = await pdf(<ClimateReport m={m} mapImage={mapImage} extras={extras} />).toBlob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const safe = m.cityName.replace(/[^a-z0-9]+/gi, '_').replace(/^_+|_+$/g, '');
  a.href = url;
  a.download = `OpenPlanet_${safe}_${m.ssp}_${m.focusYear}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
