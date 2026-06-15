/**
 * pdf/styles.ts — Palette constants and StyleSheet for the PDF report.
 *
 * Extracted from ClimateReportPDF.tsx so the main document file stays focused
 * on layout/content. Import from here, not directly from ClimateReportPDF.tsx.
 */

import { StyleSheet } from '@react-pdf/renderer';

// ── Palette (light / printable academic) ──────────────────────────────────────
export const INK  = '#14181f';
export const NAVY = '#14213d';
export const GREY = '#5b6470';
export const RULE = '#c9ccd2';
export const FILL = '#f2f3f5';
export const GOLD = '#8a6d3f';
export const HEAT = ['#2F6F8F', '#B79237', '#BE6A2E', '#A23A30'];

export const s = StyleSheet.create({
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

// ── Sources (verified, fixed bibliography) ────────────────────────────────────
export const REFERENCES = [
  'Gasparrini A. et al. (2017). Projections of temperature-related excess mortality under climate change scenarios. The Lancet Planetary Health 1(9): e360-e367.',
  'Burke M., Davis W.M., Diffenbaugh N.S. (2018). Large potential reduction in economic damages under UN mitigation targets. Nature 557: 549-553.',
  'International Labour Organization (2019). Working on a Warmer Planet: The impact of heat stress on labour productivity. ILO, Geneva.',
  'Stull R. (2011). Wet-Bulb Temperature from Relative Humidity and Air Temperature. J. Applied Meteorology and Climatology 50(11): 2267-2269.',
  'Sherwood S.C., Huber M. (2010). An adaptability limit to climate change due to heat stress. PNAS 107(21): 9552-9555.',
  'Hersbach H. et al. (2020). The ERA5 global reanalysis. Q. J. R. Meteorol. Soc. 146: 1999-2049.',
  'IPCC (2021). Climate Change 2021: The Physical Science Basis (AR6 WG1). Cambridge University Press.',
];

export const SOURCE_ROWS: [string, string][] = [
  ['Baseline climatology', 'Copernicus C3S ERA5 reanalysis (2011-2020) via Open-Meteo'],
  ['Forward projections', 'CMIP6 MRI-AGCM3-2-S / MPI-ESM1-2-XR ensemble; IPCC AR6 deltas post-2050'],
  ['Mortality model', 'Gasparrini et al. (2017), beta = 0.0801; saturating delta-T, AF cap 0.35'],
  ['Economic model', 'Burke et al. (2018) T_opt 13 deg-C + ILO (2019) labour heat-stress'],
  ['Wet-bulb model', 'Stull (2011); 35 deg-C ceiling per Sherwood & Huber (2010)'],
  ['Socioeconomic data', 'World Bank WDI (death rate, GDP); UN / metro population vault'],
];
