/**
 * components/ui/primitives.tsx — shared display primitives.
 *
 * Small, dependency-free building blocks so loading/confidence/metric markup is
 * defined ONCE instead of being re-pasted across modules. They lean on the
 * design tokens (styles/tokens.ts) and the global `.skeleton` shimmer, and they
 * respect prefers-reduced-motion via the CSS layer.
 */
import React from "react";
import { confidence, type ConfidenceLevel } from "@/styles/tokens";

/* ─── Skeleton ─── */
/** A single shimmering placeholder block. Size it with width/height/className. */
export function Skeleton({
  className = "",
  width,
  height = 12,
  rounded = false,
}: {
  className?: string;
  width?: number | string;
  height?: number | string;
  rounded?: boolean;
}) {
  return (
    <span
      aria-hidden="true"
      className={`skeleton block ${rounded ? "rounded-full" : ""} ${className}`}
      style={{
        width: width ?? "100%",
        height: typeof height === "number" ? `${height}px` : height,
      }}
    />
  );
}

/**
 * Multi-line skeleton — a paragraph placeholder with progressively shorter
 * lines so it reads like real text loading. Wraps in a labelled status region.
 */
export function SkeletonText({
  lines = 4,
  className = "",
  label = "Loading",
}: {
  lines?: number;
  className?: string;
  label?: string;
}) {
  const widths = ["100%", "94%", "88%", "82%", "76%", "68%"];
  return (
    <div role="status" aria-label={label} className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} height={12} width={widths[i % widths.length]} />
      ))}
      <span className="sr-only">{label}…</span>
    </div>
  );
}

/* ─── ConfidenceDot ─── */
/**
 * A confidence indicator that never encodes meaning by color alone (WCAG 1.4.1):
 * the colored dot is always paired with its text label.
 */
export function ConfidenceDot({
  level,
  showLabel = true,
  className = "",
}: {
  level: ConfidenceLevel;
  showLabel?: boolean;
  className?: string;
}) {
  const c = confidence[level];
  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`}>
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={{ background: c.color }}
      />
      {showLabel && (
        <span
          className="font-mono text-[8px] uppercase tracking-[0.15em] font-bold"
          style={{ color: c.color }}
        >
          {c.label}
        </span>
      )}
    </span>
  );
}
