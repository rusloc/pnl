import { NA, fmtDeltaDays, fmtDeltaHours, fmtDeltaPct, fmtPp } from './format.ts';
import type { DimRow } from './manifest.ts';

// Status rules (design-tokens §6): glyph = direction (▲ up / ▼ down), colour + chip word = meaning. Delta bands are the
// design defaults (param_thresholds carries absolute bands only); the absolute attainment band comes from
// param_thresholds KPI_STATUS attainment_pct.

export type Status = 'good' | 'watch' | 'off' | 'neutral';

/** How a metric is compared: relative % (counts, amounts), pp (ratios), hours, days; with its favourable side. */
export type DeltaKind =
  | 'countUp' // loans, principal, new clients, revenue: Δ %, ↑
  | 'ratioUp' // returning %, approval %, take-up: Δ pp, ↑
  | 'riskDown' // 30+ / 90+ DPD, vintage, roll, cost of risk: Δ pp, ↓
  | 'hoursDown' // time to cash: Δ h, ↓
  | 'neutralPct' // avg ticket: Δ %, no favourable side
  | 'neutralDays'; // days between loans: Δ d, no favourable side

export interface CmpBar {
  side: 'left' | 'right'; // right = favourable (left = unfavourable), neutral by sign
  size: number; // 0 … 1 of the half-bar
  capped: boolean;
}

export interface CmpRow {
  label: string; // "vs Budget"
  text: string; // "▼ −2.4%", "n/a"
  status: Status;
  bar: CmpBar | null;
}

const UNIT: Record<DeltaKind, 'pct' | 'pp' | 'h' | 'd'> = {
  countUp: 'pct',
  ratioUp: 'pp',
  riskDown: 'pp',
  hoursDown: 'h',
  neutralPct: 'pct',
  neutralDays: 'd',
};
const BAR_SCALE = { pct: 0.2, pp: 0.05, h: 2, d: 10 } as const; // design-tokens §5: ±20 %, ±5 pp

/** Δ of actual vs reference, or null when either side is missing (or a relative Δ has no base). */
export function deltaOf(kind: DeltaKind, actual: number | null, ref: number | null): number | null {
  if (actual === null || ref === null || !Number.isFinite(actual) || !Number.isFinite(ref)) return null;
  if (UNIT[kind] === 'pct') return ref === 0 ? null : actual / ref - 1;
  return actual - ref;
}

export function statusOf(kind: DeltaKind, delta: number | null): Status {
  if (delta === null) return 'neutral';
  switch (kind) {
    case 'countUp':
      return delta >= 0 ? 'good' : delta >= -0.05 ? 'watch' : 'off';
    case 'ratioUp':
      return delta >= 0 ? 'good' : delta >= -0.02 ? 'watch' : 'off';
    case 'riskDown':
      return delta <= 0 ? 'good' : delta <= 0.005 ? 'watch' : 'off';
    case 'hoursDown':
      return delta <= 0 ? 'good' : delta <= 0.5 ? 'watch' : 'off';
    case 'neutralPct':
    case 'neutralDays':
      return 'neutral';
  }
}

function deltaText(kind: DeltaKind, delta: number): string {
  switch (UNIT[kind]) {
    case 'pct':
      return fmtDeltaPct(delta);
    case 'pp':
      return fmtPp(delta);
    case 'h':
      return fmtDeltaHours(delta);
    case 'd':
      return fmtDeltaDays(delta);
  }
}

export const glyph = (delta: number): string => (delta > 0 ? '▲' : delta < 0 ? '▼' : '◦');

export function cmpRow(
  kind: DeltaKind,
  label: string,
  actual: number | null,
  ref: number | null,
  withBar = false,
): CmpRow {
  const delta = deltaOf(kind, actual, ref);
  if (delta === null) return { label, text: NA, status: 'neutral', bar: null };
  const status = statusOf(kind, delta);
  const raw = Math.abs(delta) / BAR_SCALE[UNIT[kind]];
  const favourable = status === 'neutral' ? delta >= 0 : status === 'good';
  return {
    label,
    text: `${glyph(delta)} ${deltaText(kind, delta)}`,
    status,
    bar: withBar ? { side: favourable ? 'right' : 'left', size: Math.min(raw, 1), capped: raw > 1 } : null,
  };
}

/** Absolute attainment band from param_thresholds (KPI_STATUS · attainment_pct: RED / AMBER / GREEN). */
export function attainmentStatus(ratio: number | null, thresholds: readonly DimRow<'thresholds'>[]): Status {
  if (ratio === null || !Number.isFinite(ratio)) return 'neutral';
  const band = thresholds.find(
    (t) =>
      t.threshold_set === 'KPI_STATUS' &&
      t.metric_code === 'attainment_pct' &&
      (t.min_value === null || ratio >= t.min_value) &&
      (t.max_value === null || ratio < t.max_value),
  );
  return band?.band_code === 'GREEN' ? 'good' : band?.band_code === 'AMBER' ? 'watch' : band ? 'off' : 'neutral';
}

export const STATUS_WORD: Readonly<Record<Status, string>> = {
  good: 'Good',
  watch: 'Watch',
  off: 'Off',
  neutral: 'n/a',
};
