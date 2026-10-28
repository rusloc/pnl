// Bar geometry of v5's spark() (prototype.html): 13 bars with 2 px gaps, a value range padded 60 % below and 15 % above
// so small moves stay visible, the dotted target line across, optional week labels under every third bar and the last.
// Presentation only: the values and the target come from the engine.

export interface BarRect {
  x: number;
  y: number;
  w: number;
  h: number;
  current: boolean;
}
export interface BarLabel {
  x: number;
  text: string;
  current: boolean;
}
export interface BarGeometry {
  rects: BarRect[];
  labels: BarLabel[];
  targetY: number | null;
}

export function barGeometry(
  values: readonly (number | null)[],
  target: number | null,
  width: number,
  height: number,
  labels?: readonly string[],
): BarGeometry {
  const n = values.length;
  const gap = 2;
  const bw = (width - gap * (n - 1)) / n;
  const base = height - (labels ? 12 : 0);
  const known = values.filter((v): v is number => v !== null).concat(target === null ? [] : [target]);
  let lo = known.length ? Math.min(...known) : 0;
  let hi = known.length ? Math.max(...known) : 1;
  const r = hi - lo || 1;
  lo -= r * 0.6;
  hi += r * 0.15;
  const y = (v: number) => base - ((v - lo) / (hi - lo)) * base;
  const round = (v: number) => Math.round(v * 10) / 10;
  const rects: BarRect[] = [];
  const out: BarLabel[] = [];
  values.forEach((v, i) => {
    const x = i * (bw + gap);
    const current = i === n - 1;
    if (v !== null) rects.push({ x: round(x), y: round(y(v)), w: round(bw), h: round(base - y(v)), current });
    if (labels && (i % 3 === 0 || current)) out.push({ x: round(x + bw / 2), text: labels[i] ?? '', current });
  });
  return { rects, labels: out, targetY: target === null ? null : round(y(target)) };
}
