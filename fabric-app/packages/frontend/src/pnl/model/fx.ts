// Currency translation and summation for aggregated fact rows (spec §7
// C-10 to C-13, D-30; data README "Currency translation"). Pure functions so
// the rules live in one tested place, whichever source feeds them.
//
//   amount_usd = amount_local / local_per_usd(currency, month, rateType)
//   amount_rep = amount_usd × local_per_usd(reporting currency, month, rateType)
//
// Rate type: ACT and FC* months use ACTUAL_AVG of the row's month; BUD uses
// BUDGET of the row's month (one rate per year); constant currency uses BUDGET
// of the *selected* fiscal year for every version. Translate per row (month ×
// currency), never on an aggregated total.

export type RateType = 'ACTUAL_AVG' | 'BUDGET';

export interface FxRate {
  currencyCode: string;
  monthKey: string;
  rateType: RateType;
  localPerUsd: number;
}

/** A server-aggregated fact row: one amount per account × month × currency. */
export interface AggregatedAmount {
  accountCode: string;
  monthKey: string;
  currencyCode: string;
  amountLocal: number;
}

export interface TranslationOptions {
  /** Version of the rows being translated (version_code: ACT, BUD, FC). */
  versionCode: 'ACT' | 'BUD' | 'FC';
  fxBasis: 'actual' | 'constant';
  /** Selected fiscal year, used for constant currency (C-12). */
  fiscalYear: number;
  reportingCurrency: string;
}

export class RateTable {
  private readonly map = new Map<string, number>();

  constructor(rates: readonly FxRate[]) {
    for (const r of rates) this.map.set(RateTable.key(r.currencyCode, r.monthKey, r.rateType), r.localPerUsd);
  }

  private static key(currency: string, month: string, rateType: RateType): string {
    return `${currency}|${month}|${rateType}`;
  }

  localPerUsd(currency: string, monthKey: string, rateType: RateType): number {
    const v = this.map.get(RateTable.key(currency, monthKey, rateType));
    if (v === undefined) throw new Error(`No ${rateType} rate for ${currency} ${monthKey}`);
    return v;
  }
}

/** Which rate month and type apply to a row (C-11, C-12). */
export function rateFor(monthKey: string, options: TranslationOptions): { monthKey: string; rateType: RateType } {
  if (options.fxBasis === 'constant') {
    // One budget rate per fiscal year, repeated per month: any month of the
    // selected year resolves it. Use the row's month number in that year.
    return { monthKey: `${options.fiscalYear}-${monthKey.slice(5, 7)}`, rateType: 'BUDGET' };
  }
  return { monthKey, rateType: options.versionCode === 'BUD' ? 'BUDGET' : 'ACTUAL_AVG' };
}

/** Translate every row to the reporting currency and sum per account. */
export function translateAndSum(
  rows: readonly AggregatedAmount[],
  rates: RateTable,
  options: TranslationOptions
): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const { monthKey, rateType } = rateFor(row.monthKey, options);
    const usd = row.amountLocal / rates.localPerUsd(row.currencyCode, monthKey, rateType);
    const rep =
      options.reportingCurrency === 'USD'
        ? usd
        : usd * rates.localPerUsd(options.reportingCurrency, monthKey, rateType);
    totals.set(row.accountCode, (totals.get(row.accountCode) ?? 0) + rep);
  }
  return totals;
}
