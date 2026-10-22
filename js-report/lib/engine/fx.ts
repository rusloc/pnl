import type { Manifest } from '../data/manifest.ts';
import type { Currency, ReportingCurrency } from './types.ts';

// Spec §7 Currency, C-10 … C-13; D-30.

export type FxBasis = 'ACT' | 'CC';
export type RateType = 'ACTUAL_AVG' | 'BUDGET';

export interface Fx {
  /** Local currency per 1 USD (fact_fx_rate.local_per_usd). */
  rate(currency: Currency, monthIdx: number, type: RateType): number;
}

export function createFx(m: Manifest): Fx {
  const monthIdx = new Map(m.tables.dim_month.map((d) => [d.month_key, d.month_index]));
  const rates = new Map<string, number>();
  for (const r of m.tables.fact_fx_rate)
    rates.set(`${r.currency_code}|${monthIdx.get(r.month_key)}|${r.rate_type}`, r.local_per_usd);
  return {
    rate(currency, t, type) {
      const v = rates.get(`${currency}|${t}|${type}`);
      if (v === undefined) throw new Error(`fx: no ${type} rate for ${currency} in month ${t}`);
      return v;
    },
  };
}

/**
 * Local → reporting currency multiplier for one month, both legs at the same rate type and month (C-13: local →
 * USD → reporting).
 * - C-11: Actual and forecast at the month's average actual rate; Budget at its own year's budget rate.
 * - C-12: constant currency translates every version, prior year included, at the selected fiscal year's budget rate
 *   (`ccMonthIdx` = the month of the selected fiscal year with the same month number).
 */
export function translationFactor(
  fx: Fx,
  local: Currency,
  reporting: ReportingCurrency,
  monthIdx: number,
  isBudget: boolean,
  basis: FxBasis,
  ccMonthIdx: number,
): number {
  const type: RateType = basis === 'CC' || isBudget ? 'BUDGET' : 'ACTUAL_AVG';
  const t = basis === 'CC' ? ccMonthIdx : monthIdx;
  return fx.rate(reporting, t, type) / fx.rate(local, t, type);
}
