// Bridge geometry (C-40, redesign v4 §2): a truncated axis so the steps stay
// readable (ADR-0004 README decision 4: Tracks A and C truncate, Track B keeps
// the native zero axis). Decoded from the mockup: axis = lowest cumulative
// point minus 1.2 × (highest − lowest), rounded down to a whole unit; the first
// total bar is 89.8 % of the chart height. Pure: the waterfall component only
// draws the percentages returned here.
import type { BridgeKind, BridgeStep } from './types';

export interface BridgeInput {
  label: string;
  /**
   * total / subtotal: the level the bar reaches; step / fx / level: the signed
   * change added to the running level (a `level` is a P&L level such as D&A,
   * drawn as a step in slate: the bridge continues from it).
   */
  amount: number;
  kind: 'total' | 'subtotal' | 'step' | 'fx' | 'level';
  sub?: string | null;
}

export interface BridgeGeometry {
  axis: number;
  steps: BridgeStep[];
}

export function bridgeGeometry(
  input: readonly BridgeInput[],
  formatValue: (amount: number, kind: BridgeInput['kind']) => string
): BridgeGeometry {
  let running = 0;
  const points: number[] = [];
  const cumulative = input.map((s) => {
    const isLevel = s.kind === 'total' || s.kind === 'subtotal';
    const start = isLevel ? 0 : running;
    running = isLevel ? s.amount : running + s.amount;
    points.push(running);
    return { start, end: running };
  });
  const lo = Math.min(...points);
  const hi = Math.max(...points);
  const axis = Math.floor(lo - 1.2 * (hi - lo));
  const top = axis + (hi - axis) / 0.898;
  const span = top - axis || 1;
  const pct = (v: number) => ((v - axis) / span) * 100;

  const steps = input.map((s, i) => {
    const { start, end } = cumulative[i];
    const isLevel = s.kind === 'total' || s.kind === 'subtotal';
    const bottom = isLevel ? 0 : pct(Math.min(start, end));
    const height = isLevel ? pct(end) : Math.abs(pct(end) - pct(start));
    const kind: BridgeKind =
      s.kind === 'total' ? 'total' : s.kind === 'subtotal' ? 'subtotal' : s.kind === 'fx' ? 'fx' : s.kind === 'level' ? 'level' : s.amount < 0 ? 'unf' : 'fav';
    return {
      label: s.label,
      valueText: formatValue(s.amount, s.kind),
      kind,
      bottomPct: Math.round(bottom * 100) / 100,
      heightPct: Math.round(height * 100) / 100,
      sub: s.sub ?? null,
    } satisfies BridgeStep;
  });
  return { axis, steps };
}
