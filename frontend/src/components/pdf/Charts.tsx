/**
 * pdf/Charts.tsx — SVG vector chart components for the PDF report.
 *
 * Extracted from ClimateReportPDF.tsx. Used only inside ClimateReportPDF.tsx —
 * not intended as a public component API.
 */

import type { ReactNode } from 'react';
import { Svg, G, Rect, Line, Polyline, Circle, Text } from '@react-pdf/renderer';
import { INK, GREY, RULE } from './styles';

// ── Helpers ────────────────────────────────────────────────────────────────────

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

// SVG text helper — react-pdf wants fontSize/fontFamily via `style`.
export function SvgText({
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
  children: ReactNode;
  fill?: string;
  size?: number;
  bold?: boolean;
  anchor?: 'start' | 'middle' | 'end';
}): ReactNode {
  return (
    <Text
      x={x}
      y={y}
      fill={fill}
      textAnchor={anchor}
      style={{ fontSize: size, fontFamily: bold ? 'Helvetica-Bold' : 'Helvetica' }}
    >
      {children}
    </Text>
  );
}

// ── BarChart ──────────────────────────────────────────────────────────────────

export function BarChart({
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
      {[0, 0.5, 1].map((f, i) => {
        const y = padT + plotH - f * plotH;
        return (
          <G key={`g${i}`}>
            <Line x1={padL} y1={y} x2={width - padR} y2={y} stroke={RULE} strokeWidth={0.5} />
            <SvgText x={padL - 6} y={y + 3} fill={GREY} size={7} anchor="end">
              {Math.round(max * f)}
            </SvgText>
          </G>
        );
      })}
      <Line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={INK} strokeWidth={0.8} />
      <Line x1={padL} y1={padT + plotH} x2={width - padR} y2={padT + plotH} stroke={INK} strokeWidth={0.8} />
      {data.map((d, i) => {
        if (d.value === null) {
          return (
            <SvgText key={`b${i}`} x={padL + slot * (i + 0.5)} y={padT + plotH + 15} fill={GREY} anchor="middle">
              {d.label}
            </SvgText>
          );
        }
        const x = padL + slot * (i + 0.5) - barW / 2;
        const y = yOf(d.value);
        return (
          <G key={`b${i}`}>
            <Rect x={x} y={y} width={barW} height={padT + plotH - y} fill={color} />
            <SvgText x={x + barW / 2} y={y - 3} fill={INK} bold anchor="middle">
              {Math.round(d.value)}
            </SvgText>
            <SvgText x={padL + slot * (i + 0.5)} y={padT + plotH + 15} fill={GREY} anchor="middle">
              {d.label}
            </SvgText>
          </G>
        );
      })}
      <SvgText x={padL} y={8} fill={GREY} size={7}>
        {unit}
      </SvgText>
    </Svg>
  );
}

// ── LineChart ─────────────────────────────────────────────────────────────────

export function LineChart({
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
            <SvgText x={padL - 6} y={y + 3} fill={GREY} size={7} anchor="end">
              {Math.round(maxV * f)}
            </SvgText>
          </G>
        );
      })}
      <Line x1={padL} y1={padT} x2={padL} y2={padT + plotH} stroke={INK} strokeWidth={0.8} />
      <Line x1={padL} y1={padT + plotH} x2={width - padR} y2={padT + plotH} stroke={INK} strokeWidth={0.8} />
      {years.map((yr, i) => (
        <SvgText key={`x${i}`} x={xOf(i)} y={padT + plotH + 14} fill={GREY} anchor="middle">
          {yr}
        </SvgText>
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
              p === null ? null : (
                <Circle key={`c${si}-${i}`} cx={xOf(i)} cy={yOf(p)} r={2.2} fill={se.color} />
              ),
            )}
          </G>
        );
      })}
      {series.map((se, si) => (
        <G key={`l${si}`}>
          <Rect x={padL + si * 150} y={height - 12} width={9} height={4} fill={se.color} />
          <SvgText x={padL + si * 150 + 13} y={height - 8} fill={INK}>
            {se.name}
          </SvgText>
        </G>
      ))}
    </Svg>
  );
}
