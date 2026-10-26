import type { DimRow } from './manifest.ts';
import { monthIndex } from './windows.ts';

// Currency translation (ADR-0011 (g), README "Currency translation"): local ÷ local_per_eur of the row's month ×
// currency. Actual uses ACTUAL_AVG, Budget uses BUDGET. Always applied at month × currency grain, never on a total.

export type RateType = 'ACTUAL_AVG' | 'BUDGET';

export interface Fx {
  rate(currency: string, month: number, type: RateType): number;
  toEur(local: number, currency: string, month: number, type: RateType): number;
}

export function createFx(rows: readonly DimRow<'fx'>[]): Fx {
  const rates = new Map<string, number>();
  for (const r of rows) rates.set(`${r.currency_code}|${monthIndex(r.month_key)}|${r.rate_type}`, r.local_per_eur);
  const rate = (currency: string, month: number, type: RateType): number => {
    const v = rates.get(`${currency}|${month}|${type}`);
    if (v === undefined) throw new Error(`fx: no ${type} rate for ${currency} month ${month}`);
    return v;
  };
  return { rate, toEur: (local, currency, month, type) => local / rate(currency, month, type) };
}
