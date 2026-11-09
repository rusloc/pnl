import { csvTable } from './csv.ts';

// checks/control_totals_usd.csv (A-76): long format scope, period_key, metric_code, value. Shared by the build (the 32
// CR: creative rows, contract §2.4) and the engine suite (every other row, §7.1). The tolerance is verify.py's tol():
// counts and codes exact (1e-6 for float noise), money 0.005, ratios 1e-6, plus 1e-9 relative.

export interface ControlRow {
  scope: string;
  periodKey: string;
  metric: string;
  value: number;
}

export function readControlTotals(text: string, file = 'control_totals_usd.csv'): ControlRow[] {
  return [...csvTable(text, ['scope', 'period_key', 'metric_code', 'value'], file)].map(
    ([scope = '', periodKey = '', metric = '', value = '']) => {
      const v = Number(value);
      if (!Number.isFinite(v)) throw new Error(`${file}: ${scope} ${periodKey} ${metric} value "${value}"`);
      return { scope, periodKey, metric, value: v };
    },
  );
}

const MONEY = [
  'spend',
  'plan',
  'new_mrr',
  'cpa',
  'cpc',
  'cpm',
  'cpl',
  'cost_per_activated',
  'team_cost',
  'paid_cac',
  'blended_cac',
  'arpa',
  'ltv',
  'cohort_cac',
  'cpa_target',
  'alert_value.PACING_OVER',
  'alert_value.UNDERSPENT_SCALE',
  'blended_cac_target',
  'trial_shortfall',
];

/** verify.py tol(): MONEY prefixes and `.lcp_ms` 0.005, everything else 1e-6. */
export function tolerance(metric: string): number {
  if (/\.(signups|sessions|store_views)$/.test(metric)) return 1e-6;
  if (MONEY.some((p) => metric.startsWith(p)) || metric.endsWith('.lcp_ms')) return 0.005;
  return 1e-6;
}

export const withinTolerance = (metric: string, expected: number, got: number): boolean =>
  Math.abs(got - expected) <= tolerance(metric) + 1e-9 * Math.abs(expected);
