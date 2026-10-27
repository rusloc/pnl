// Status of a KPI vs Budget (spec KPI §6; build-brief §0 "Status colouring"; Track B `param_kpi_threshold` + one
// status measure). One table, four values: on track within ±1 % (amounts) / ±0.3 pp (ratios), watch up to 3 % / 1 pp,
// off track beyond; ahead (green) when better than on-track. "Lower is better" inverts; neutral KPIs have no status.

export const KPI_THRESHOLDS = {
  amountWatch: 0.01, // relative Δ
  amountOff: 0.03,
  ratioWatch: 0.003, // Δ in ratio units (0.003 = 0.3 pp)
  ratioOff: 0.01,
} as const;

export type Better = 'Higher' | 'Lower' | 'Neutral'; // dim_kpi.better_when
export type KpiStatus = 'onTrack' | 'watch' | 'off' | 'ahead';

export const STATUS_TEXT: Readonly<Record<KpiStatus, string>> = {
  onTrack: 'on track',
  watch: 'watch',
  off: 'off track',
  ahead: 'ahead',
};

/**
 * `delta` = relative Δ for amounts (Δ ÷ |Budget|), absolute Δ for ratios (fractions). null when there is no Budget or
 * the KPI is neutral.
 */
export function kpiStatus(delta: number | null, kind: 'amount' | 'ratio', better: Better): KpiStatus | null {
  if (delta === null || !Number.isFinite(delta) || better === 'Neutral') return null;
  const d = better === 'Lower' ? -delta : delta;
  const watch = kind === 'amount' ? KPI_THRESHOLDS.amountWatch : KPI_THRESHOLDS.ratioWatch;
  const off = kind === 'amount' ? KPI_THRESHOLDS.amountOff : KPI_THRESHOLDS.ratioOff;
  if (Math.abs(d) <= watch) return 'onTrack';
  if (d > 0) return 'ahead';
  return Math.abs(d) <= off ? 'watch' : 'off';
}
