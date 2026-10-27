// Status of a KPI vs Budget only, whatever Compare A is (spec KPI §6; ADR-0012;
// build-brief §0 "Status colouring"; parity check PV-01). Mirrors the Track B parameter table `param_kpi_threshold`
// (two rows: PCT for amounts and counts as a relative Δ, PP for ratios in
// percentage points) and the rules of the model's `_KPI Status` and
// `_Prof CM Status` measures, so the app prints the status the model would
// without asking it for one more evaluation per card (ADR-0006 §16).
import type { DeltaTone, StatusChip, StatusKind } from './types';

/** `param_kpi_threshold` as published 2026-10-27: on track within `onTrack`, watch up to `watch`, off beyond. */
export const KPI_THRESHOLDS = {
  /** Relative Δ (fraction): 0.01 = ±1 %, 0.03 = ±3 %. */
  PCT: { onTrack: 0.01, watch: 0.03 },
  /** Percentage points: ±0.3 pp, ±1.0 pp. */
  PP: { onTrack: 0.3, watch: 1.0 },
} as const;

export type DeltaKind = keyof typeof KPI_THRESHOLDS;

/** `dim_kpi.better_when`. */
export type BetterWhen = 'Higher' | 'Lower' | 'Neutral';

/**
 * `_KPI Status`: `delta` = (value − comparison) ÷ |comparison| for PCT, (value − comparison) × 100 for PP
 * (both as `derive.ts` `kpiDelta` returns them). Neutral when the KPI is neutral or either side is blank;
 * on track within the inner band; ahead when favourable beyond it; watch within the outer band; off beyond.
 */
export function kpiStatus(delta: number | null, kind: DeltaKind, betterWhen: BetterWhen): StatusKind {
  if (delta === null || !Number.isFinite(delta) || betterWhen === 'Neutral') return 'neutral';
  const t = KPI_THRESHOLDS[kind];
  const fav = betterWhen === 'Lower' ? -delta : delta;
  if (Math.abs(delta) <= t.onTrack) return 'ontrack';
  if (fav > 0) return 'ahead';
  return Math.abs(delta) <= t.watch ? 'watch' : 'off';
}

/** `_Prof CM Status`: the CM Δ in pp against the PP band, higher is better. */
export function cmStatus(deltaPp: number | null): StatusKind {
  return kpiStatus(deltaPp, 'PP', 'Higher');
}

/** The chip words (the v4 design's `chipTxt`, lower case; PV-08). */
export const STATUS_TEXT: Record<Exclude<StatusKind, 'neutral'>, string> = {
  ontrack: 'on track',
  ahead: 'ahead',
  watch: 'watch',
  off: 'off track',
};

/** The chip of a card: none while neutral. */
export function statusChip(status: StatusKind): StatusChip | null {
  return status === 'neutral' ? null : { kind: status, text: STATUS_TEXT[status] };
}

/** Colour of the comparison row that carries the status (`Vitals Card SVG` ink: ahead green, watch amber, off orange, else ink). */
export function statusTone(status: StatusKind): DeltaTone {
  switch (status) {
    case 'ahead':
      return 'ahead';
    case 'watch':
      return 'watch';
    case 'off':
      return 'off';
    case 'ontrack':
      return 'plan';
    default:
      return 'neutral';
  }
}
