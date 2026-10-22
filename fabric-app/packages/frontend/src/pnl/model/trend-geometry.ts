// Geometry of the Key figures trends (K-24, K-25; ADR-0007 §2.5): pure
// functions the SVG components draw from, so the maths is testable without a
// DOM. No chart library; coordinates are in SVG user units.
import type { KpiTarget, KpiTrendPoint } from './types';

/** Short month label from a `YYYY-MM` key. */
export function monthLabel(key: string): string {
  const m = Number(key.slice(5, 7));
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1] ?? key;
}

export interface Point {
  x: number;
  y: number;
}

export interface SparklineGeometry {
  /** Runs of consecutive plotted months; a blank (open or missing) month breaks the line. */
  segments: Point[][];
  /** The selected month (the last point) when it has a value; null when it is blank. */
  marker: Point | null;
  /** Indices of the blank months, for the dotted baseline ticks. */
  blanks: number[];
  /** x of every slot, blank or not. */
  xs: number[];
  /** Index of the selected month (always the last slot). */
  selectedIndex: number;
}

/** A month is plotted when it is closed and has a value (K-24: open months blank). */
export function isPlotted(p: KpiTrendPoint): boolean {
  return !p.isOpen && p.value !== null;
}

/**
 * Sparkline geometry: x evenly spaced, y scaled to the plotted values' range
 * (a flat series sits at mid-height). The last slot is the selected month.
 */
export function sparklineGeometry(points: readonly KpiTrendPoint[], width: number, height: number, pad = 3): SparklineGeometry {
  const n = points.length;
  const xs = points.map((_, i) => (n === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (n - 1)));
  const values = points.filter(isPlotted).map((p) => p.value as number);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min;
  const y = (v: number) => (span === 0 ? height / 2 : pad + ((max - v) * (height - 2 * pad)) / span);

  const segments: Point[][] = [];
  const blanks: number[] = [];
  let run: Point[] = [];
  points.forEach((p, i) => {
    if (isPlotted(p)) {
      run.push({ x: xs[i], y: y(p.value as number) });
    } else {
      blanks.push(i);
      if (run.length > 0) segments.push(run);
      run = [];
    }
  });
  if (run.length > 0) segments.push(run);

  const last = points[n - 1];
  const marker = n > 0 && isPlotted(last) ? { x: xs[n - 1], y: y(last.value as number) } : null;
  return { segments, marker, blanks, xs, selectedIndex: n - 1 };
}

/** SVG path data for one run; a single point draws a 1-unit dash so it stays visible. */
export function segmentPath(run: readonly Point[]): string {
  if (run.length === 1) return `M${f(run[0].x - 0.5)} ${f(run[0].y)}H${f(run[0].x + 0.5)}`;
  return run.map((p, i) => `${i === 0 ? 'M' : 'L'}${f(p.x)} ${f(p.y)}`).join('');
}

function f(v: number): string {
  return String(Math.round(v * 100) / 100);
}

export interface TargetTick {
  name: string;
  x: number;
  /** 'a' = first comparison (solid tick), 'b' = second (muted tick). */
  kind: 'a' | 'b';
}

export interface TargetBarGeometry {
  /** x of zero on the scale. */
  zero: number;
  /** The base value's bar, from zero to its value (left of zero when negative). */
  bar: { from: number; to: number } | null;
  ticks: TargetTick[];
}

/**
 * Target bar: a linear scale from min(0, values) to max(0, values) over the
 * width; the base value is the bar, each comparison with a value a tick. Null
 * when there is nothing to draw (no base and no comparison value).
 */
export function targetBarGeometry(target: KpiTarget, width: number, pad = 1): TargetBarGeometry | null {
  const values = [target.base, ...target.marks.map((m) => m.value)].filter((v): v is number => v !== null && Number.isFinite(v));
  if (values.length === 0) return null;
  const lo = Math.min(0, ...values);
  const hi = Math.max(0, ...values);
  const span = hi - lo;
  const x = (v: number) => (span === 0 ? pad : pad + ((v - lo) * (width - 2 * pad)) / span);
  const zero = x(0);
  const bar = target.base === null ? null : { from: Math.min(zero, x(target.base)), to: Math.max(zero, x(target.base)) };
  const ticks: TargetTick[] = target.marks
    .map((m, i) => (m.value === null ? null : { name: m.name, x: x(m.value), kind: i === 0 ? ('a' as const) : ('b' as const) }))
    .filter((t): t is TargetTick => t !== null);
  return { zero, bar, ticks };
}
