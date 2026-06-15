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
 * This module is only ever dynamically imported (on button click), so the
 * @react-pdf/renderer library stays out of the main bundle.
 *
 * Layout/section components -> ./pdf/Sections.tsx
 * SVG chart primitives       -> ./pdf/Charts.tsx
 * Palette and StyleSheet     -> ./pdf/styles.ts
 */

import type { DocumentProps } from '@react-pdf/renderer';
import { pdf } from '@react-pdf/renderer';
import type React from 'react';

import { type ReportModel } from '@/lib/reportData';
import { ClimateReport, type ReportExtras } from './pdf/Sections';

export type { ReportExtras };
export { ClimateReport };

// ── Public API ────────────────────────────────────────────────────────────────

export async function downloadClimateReport(
  m: ReportModel,
  mapImage?: string | null,
  extras?: ReportExtras,
): Promise<void> {
  // ClimateReport wraps a <Document> element at runtime, satisfying DocumentProps.
  // TypeScript cannot infer this through the ReactNode return type of the split
  // function, so we cast explicitly to match the pdf() signature.
  const doc = ClimateReport({ m, mapImage, extras }) as React.ReactElement<DocumentProps>;
  const blob = await pdf(doc).toBlob();
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
