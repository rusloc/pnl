// Geometry of the Key figures comparison bars (docs/design/kpi-card-v2.md,
// K-20, K-21): pure functions the row component draws from. A diverging bar
// with its centre at 0 grows right when the Δ is favourable and left when it is
// unfavourable, whatever the sign of the KPI, so "right = good" holds on every
// tile; neutral KPIs grow right by absolute size. One scale is shared by every
// row of every card so lengths compare; beyond it the bar is capped.
import type { CompareBar } from './types';

/** `dim_kpi.better_when`. */
export type BetterWhen = 'Higher' | 'Lower' | 'Neutral';

/** Full-scale |Δ|: amount KPIs carry Δ as a fraction (0.20 = ±20 %), percent KPIs in percentage points (±5 pp). */
export const COMPARE_BAR_SCALE = { pct: 0.2, pp: 5 } as const;

/** The side a Δ grows to: right (+1) when favourable or on a neutral KPI, left (−1) when unfavourable. A zero Δ sits right. */
export function favourableSide(delta: number, betterWhen: BetterWhen): 1 | -1 {
  if (betterWhen === 'Neutral') return 1;
  return (betterWhen === 'Lower' ? -delta : delta) >= 0 ? 1 : -1;
}

/** The bar for a Δ on the shared scale, growing to `side`; capped at the track end. */
export function barOnScale(delta: number, percentKpi: boolean, side: 1 | -1): CompareBar {
  const size = Math.abs(delta) / (percentKpi ? COMPARE_BAR_SCALE.pp : COMPARE_BAR_SCALE.pct);
  return { fraction: side * Math.min(1, size) || 0, capped: size > 1 };
}

/** A tile's comparison bar from the derived KPI Δ (`derive.ts`) and the KPI's better_when; null when there is no Δ. */
export function compareBar(delta: number | null, percentKpi: boolean, betterWhen: BetterWhen): CompareBar | null {
  if (delta === null || !Number.isFinite(delta)) return null;
  return barOnScale(delta, percentKpi, favourableSide(delta, betterWhen));
}
