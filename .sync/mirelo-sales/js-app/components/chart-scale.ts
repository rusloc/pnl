// vendored from rusloc/pnl js-report/components/chart-scale.ts, 2026-10-28; source of truth stays there
// Presentation-only scale helpers for the inline SVG charts of both routes (axis domains and ticks). No business logic.

/** Up to `count` + 1 "nice" ticks covering [min, max] (1 · 2 · 2.5 · 5 × 10^n steps). */
export function niceTicks(min: number, max: number, count = 3): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];
  if (max === min) max = min === 0 ? 1 : min * 1.1;
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((s) => s * mag >= raw) ?? 10) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v / step) * step);
  return out;
}

export function extent(values: readonly (number | null)[]): [number, number] {
  let lo = Infinity;
  let hi = -Infinity;
  for (const v of values)
    if (v !== null && Number.isFinite(v)) {
      lo = Math.min(lo, v);
      hi = Math.max(hi, v);
    }
  return lo === Infinity ? [0, 1] : [lo, hi];
}

export const linear =
  (d0: number, d1: number, r0: number, r1: number) =>
  (v: number): number =>
    d1 === d0 ? r0 : r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
