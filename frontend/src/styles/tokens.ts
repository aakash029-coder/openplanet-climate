/**
 * styles/tokens.ts — Single typed source of truth for the OpenPlanet design system.
 *
 * Why this file exists:
 *   The codebase had two divergent color stories — the CSS custom properties in
 *   globals.css (`var(--canvas)` …, used at runtime by most components) and the
 *   Tailwind `colors` map (used by `bg-*` / `text-*` utilities). They disagreed
 *   (e.g. canvas #050608 vs #08080A; muted #8C8C96 vs #52525B, the latter failing
 *   WCAG AA). This module codifies the CANONICAL values — the ones actually
 *   rendered via the CSS variables — so new code references one place.
 *
 * Usage:
 *   - Prefer the existing CSS variables in JSX (`style={{ color: 'var(--text)' }}`
 *     or Tailwind arbitrary `text-[color:var(--text)]`) for surfaces/text.
 *   - Import these tokens in TS where you need the literal value (charts, map
 *     layers, canvas, PDF) so MapLibre/Recharts/react-pdf share the palette.
 *
 * The palette, type roles, and motion intent are preserved from the current
 * design — this only systematizes them; it does not introduce a new look.
 */

/** Canonical surface + text + accent colors (mirror of globals.css `:root`). */
export const color = {
  // Background scale — near-black base → elevated surfaces
  canvas: "#050608",
  panel: "#0A0A0C",
  raised: "#0F0F12",
  raisedHover: "#141418",

  // Rules / borders
  hairline: "rgba(255, 255, 255, 0.06)",
  hairlineStrong: "rgba(255, 255, 255, 0.12)",

  // Text scale (all AA-compliant on `canvas`)
  text: "#EDEDEF",
  textSecondary: "#B4B4BD",
  muted: "#8C8C96",

  // Semantic accents
  copper: "#B08D57", // economic / default metric headline
  reference: "#6E8CA8", // links, interactive references
  positive: "#5E8C6A", // high confidence / saved / positive
} as const;

/**
 * Heat / risk ramp — perceptually ordered (low → critical). Used for the map
 * legend and any risk-encoded value. Index 1..5 matches `--heat-1..5`.
 */
export const heat = {
  1: "#2F6F8F", // low — muted steel / blue
  2: "#B79237", // moderate — ochre / amber
  3: "#BE6A2E", // high — burnt amber / orange
  4: "#A23A30", // severe — oxide red
  5: "#6E2020", // critical — deep oxide
} as const;

/**
 * Confidence tokens — color AND a label, so meaning is never encoded by color
 * alone (WCAG 1.4.1). Pair the dot with `.label` text in the UI.
 */
export const confidence = {
  high: { color: color.positive, label: "HIGH CONFIDENCE" },
  medium: { color: heat[2], label: "MEDIUM CONFIDENCE" },
  low: { color: heat[4], label: "LOW CONFIDENCE" },
} as const;

export type ConfidenceLevel = keyof typeof confidence;

/** Map risk-weight [0..1] → heat ramp color. Mirrors MapHelpers thresholds. */
export function riskColor(weight: number): string {
  if (!Number.isFinite(weight)) return heat[1];
  if (weight >= 0.75) return heat[4];
  if (weight >= 0.5) return heat[3];
  if (weight >= 0.3) return heat[2];
  return heat[1];
}

/** Typeface roles — one job each (mapped to the next/font CSS variables). */
export const font = {
  display: "var(--font-display)", // Instrument Serif — hero / section titles
  reading: "var(--font-reading)", // Source Serif 4 — long-form prose
  sans: "var(--font-sans)", // Inter — body / UI / labels
  mono: "var(--font-mono)", // JetBrains Mono — ALL numeric data + captions
} as const;

/** Type scale (rem) with the line-height/tracking baked into Tailwind config. */
export const fontSize = {
  eye: "0.6875rem", // uppercase tracked mono labels
  prov: "0.6875rem", // provenance / captions
  data: "0.8125rem", // tabular data
  bodyUi: "0.875rem", // UI text
  bodyS: "1.0625rem", // reading prose
  h2: "1.5rem",
  h1: "2.25rem",
  metric: "clamp(1.75rem, 3vw, 2.5rem)",
  display: "clamp(2.75rem, 6vw, 4.5rem)",
} as const;

/** 4px base spacing scale. */
export const space = {
  0: "0px",
  1: "4px",
  2: "8px",
  3: "12px",
  4: "16px",
  5: "20px",
  6: "24px",
  8: "32px",
  10: "40px",
  12: "48px",
  16: "64px",
} as const;

/** Radii, borders, blur — restrained, terminal-flat. */
export const radius = { none: "0px", sm: "2px", md: "4px", lg: "8px", full: "9999px" } as const;
export const border = { hairline: "1px", strong: "1px" } as const;
export const blur = { card: "20px", panel: "32px", nav: "32px" } as const;

/** Reading measure caps so content never sprawls on wide screens (§4). */
export const measure = {
  prose: "72ch",
  panel: "420px",
  content: "1440px",
} as const;

/** Motion — one easing, three durations. Respect prefers-reduced-motion. */
export const motion = {
  easing: "cubic-bezier(0.16, 1, 0.3, 1)",
  duration: { fast: "120ms", base: "200ms", slow: "320ms" },
} as const;

/** Layout breakpoints (px) — sm mobile, md tablet, lg laptop, xl desktop. */
export const breakpoint = { sm: 360, md: 640, lg: 1024, xl: 1440 } as const;

const tokens = {
  color,
  heat,
  confidence,
  font,
  fontSize,
  space,
  radius,
  border,
  blur,
  measure,
  motion,
  breakpoint,
} as const;

export default tokens;
