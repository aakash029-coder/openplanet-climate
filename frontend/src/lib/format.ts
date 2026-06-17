/**
 * lib/format.ts — Single source of truth for ALL value formatting.
 *
 * Display-hardening contract (presentation layer only — no science changes):
 *   - Every formatter guards null / undefined / NaN / Infinity → em-dash "—".
 *   - Negative values use the real Unicode minus sign "−" (U+2212), never the
 *     ASCII hyphen, and never a doubled sign like "+-".
 *   - Money is rounded to sensible significant figures ($1.08B / $240.0M /
 *     −$7.81M) — never raw fractional cents on hundreds of millions.
 *   - Coordinates reject the "null island" (0,0) so real cities never render
 *     as 0.0000° N, 0.0000° E.
 *
 * Pair with the CSS `font-variant-numeric: tabular-nums` (already global on
 * `.font-mono`) so numeric columns stay aligned.
 */

/** Em-dash placeholder rendered whenever a value is missing or non-finite. */
export const EM_DASH = "—";

/** Unicode minus sign (U+2212) — typographically correct, aligns with digits. */
const MINUS = "\u2212";

/** A value that may legitimately be absent. */
export type Maybe = number | null | undefined;

/** Type guard: a real, finite number we are safe to format. */
export function isFiniteNumber(value: Maybe): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/**
 * Prefix `body` with the sign of `value`.
 * Positive → "+body", negative → "−body" (real minus), zero → "body" (no sign).
 */
function withSign(value: number, body: string): string {
  if (value > 0) return `+${body}`;
  if (value < 0) return `${MINUS}${body}`;
  return body;
}

/** Scale a positive magnitude to T/B/M/K with sensible precision. */
function scaleCurrency(abs: number): string {
  const pick = (scaled: number, unit: string): string => {
    // ≥100 of a unit reads fine at 1dp ($240.0M); below that keep 2dp ($7.81M).
    const decimals = scaled >= 100 ? 1 : 2;
    return `$${scaled.toFixed(decimals)}${unit}`;
  };
  if (abs >= 1e12) return pick(abs / 1e12, "T");
  if (abs >= 1e9) return pick(abs / 1e9, "B");
  if (abs >= 1e6) return pick(abs / 1e6, "M");
  if (abs >= 1e3) return pick(abs / 1e3, "K");
  return `$${Math.round(abs).toLocaleString("en-US")}`;
}

/**
 * Money. e.g. 1.08e9 → "$1.08B", 2.4e8 → "$240.0M", −7.81e6 → "−$7.81M".
 * @param opts.signed force a leading "+" on positive values (for deltas).
 */
export function formatCurrency(value: Maybe, opts: { signed?: boolean } = {}): string {
  if (!isFiniteNumber(value)) return EM_DASH;
  if (value === 0) return opts.signed ? "$0" : "$0";
  const body = scaleCurrency(Math.abs(value));
  if (value < 0) return `${MINUS}${body}`;
  return opts.signed ? `+${body}` : body;
}

/**
 * A net (signed) monetary outcome with an explicit human label so a negative
 * figure is never shown bare next to positives. `text` carries the magnitude;
 * `label` ("net benefit" / "net cost") + `positive` convey direction.
 */
export interface NetValue {
  text: string;
  positive: boolean;
  label: string;
}

export function formatNet(value: Maybe): NetValue {
  if (!isFiniteNumber(value)) return { text: EM_DASH, positive: false, label: "" };
  const positive = value >= 0;
  return {
    text: scaleCurrency(Math.abs(value)),
    positive,
    label: positive ? "net benefit" : "net cost",
  };
}

/** Temperature. 28.4 → "28.4°C". */
export function formatTemp(value: Maybe, decimals = 1): string {
  if (!isFiniteNumber(value)) return EM_DASH;
  return `${value.toFixed(decimals)}°C`;
}

/** Signed temperature delta. 0.3 → "+0.3°C", −0.1 → "−0.1°C" (never "+-0.1°C"). */
export function formatTempDelta(value: Maybe, decimals = 1): string {
  if (!isFiniteNumber(value)) return EM_DASH;
  return withSign(value, `${Math.abs(value).toFixed(decimals)}°C`);
}

/** Whole days. 67.6 → "68d". */
export function formatDays(value: Maybe): string {
  if (!isFiniteNumber(value)) return EM_DASH;
  return `${Math.round(value)}d`;
}

/** Plain percent. 54 → "54%". */
export function formatPercent(value: Maybe, decimals = 0): string {
  if (!isFiniteNumber(value)) return EM_DASH;
  return `${value.toFixed(decimals)}%`;
}

/** Signed percent delta. 0.3 → "+0.3%", −0.1 → "−0.1%". */
export function formatPercentDelta(value: Maybe, decimals = 1): string {
  if (!isFiniteNumber(value)) return EM_DASH;
  return withSign(value, `${Math.abs(value).toFixed(decimals)}%`);
}

/** Grouped integer/decimal. 32000 → "32,000". */
export function formatNumber(value: Maybe, decimals = 0): string {
  if (!isFiniteNumber(value)) return EM_DASH;
  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Coordinates. 34.1477, −118.1442 → "34.1477° N, 118.1442° W".
 * Returns the em-dash for missing values OR the (0,0) null island, so a real
 * city never renders as 0.0000° N, 0.0000° E.
 */
export function formatCoord(lat: Maybe, lng: Maybe): string {
  if (!isFiniteNumber(lat) || !isFiniteNumber(lng)) return EM_DASH;
  if (lat === 0 && lng === 0) return EM_DASH;
  const latDir = lat >= 0 ? "N" : "S";
  const lngDir = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}° ${latDir}, ${Math.abs(lng).toFixed(4)}° ${lngDir}`;
}

/**
 * Wet-bulb temperature with the Sherwood & Huber (2010) 35°C physiological
 * ceiling rendered as a hard cap rather than a continuous value.
 */
export function formatWetBulb(value: Maybe, decimals = 1): string {
  if (!isFiniteNumber(value)) return EM_DASH;
  if (value >= 35.0) return "> 35°C (critical limit)";
  return `${value.toFixed(decimals)}°C`;
}

/** Generic fallback: render the em-dash for any empty/non-finite value. */
export function dashIfEmpty(value: Maybe, render: (n: number) => string): string {
  return isFiniteNumber(value) ? render(value) : EM_DASH;
}
