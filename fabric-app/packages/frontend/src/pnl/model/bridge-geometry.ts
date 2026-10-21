// Net revenue bridge geometry (C-40, §6.3): a truncated axis so the steps stay
// readable. Decoded from the mockup: axis = lowest cumulative point minus
// 1.2 × (highest − lowest), rounded down to a whole million; the first total
// bar is 89.8 % of the chart height.
import type { BridgeStep } from './types';

export interface BridgeInput {
  label: string;
  amount: number;
  kind: 'total' | 'step';
}

export interface BridgeGeometry {
  axis: number;
  steps: BridgeStep[];
}

export function bridgeGeometry(
  input: readonly BridgeInput[],
  formatValue: (amount: number, kind: 'total' | 'step') => string
): BridgeGeometry {
  let running = 0;
  const points: number[] = [];
  const cumulative = input.map((s) => {
    const start = s.kind === 'total' ? 0 : running;
    running = s.kind === 'total' ? s.amount : running + s.amount;
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
    const bottom = s.kind === 'total' ? 0 : pct(Math.min(start, end));
    const height = s.kind === 'total' ? pct(end) : Math.abs(pct(end) - pct(start));
    return {
      label: s.label,
      valueText: formatValue(s.amount, s.kind),
      kind: s.kind === 'total' ? 'total' : s.amount < 0 ? 'unf' : 'fav',
      bottomPct: Math.round(bottom * 100) / 100,
      heightPct: Math.round(height * 100) / 100,
    } satisfies BridgeStep;
  });
  return { axis, steps };
}
