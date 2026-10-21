import { describe, expect, it } from 'vitest';

import { RateTable, rateFor, translateAndSum, type FxRate } from './fx';

const rates: FxRate[] = [
  { currencyCode: 'USD', monthKey: '2026-01', rateType: 'ACTUAL_AVG', localPerUsd: 1 },
  { currencyCode: 'EUR', monthKey: '2026-01', rateType: 'ACTUAL_AVG', localPerUsd: 0.9 },
  { currencyCode: 'EUR', monthKey: '2026-02', rateType: 'ACTUAL_AVG', localPerUsd: 0.95 },
  { currencyCode: 'EUR', monthKey: '2026-01', rateType: 'BUDGET', localPerUsd: 0.92 },
  { currencyCode: 'EUR', monthKey: '2026-02', rateType: 'BUDGET', localPerUsd: 0.92 },
  { currencyCode: 'EUR', monthKey: '2025-02', rateType: 'ACTUAL_AVG', localPerUsd: 1.1 },
  { currencyCode: 'GBP', monthKey: '2026-01', rateType: 'ACTUAL_AVG', localPerUsd: 0.8 },
  { currencyCode: 'GBP', monthKey: '2026-02', rateType: 'ACTUAL_AVG', localPerUsd: 0.8 },
  { currencyCode: 'USD', monthKey: '2026-02', rateType: 'ACTUAL_AVG', localPerUsd: 1 },
];
const table = new RateTable(rates);

describe('rateFor (C-11, C-12)', () => {
  it('uses the row month at actual rates, budget rates for BUD', () => {
    expect(rateFor('2026-02', { versionCode: 'ACT', fxBasis: 'actual', fiscalYear: 2026, reportingCurrency: 'USD' }))
      .toEqual({ monthKey: '2026-02', rateType: 'ACTUAL_AVG' });
    expect(rateFor('2026-02', { versionCode: 'BUD', fxBasis: 'actual', fiscalYear: 2026, reportingCurrency: 'USD' }))
      .toEqual({ monthKey: '2026-02', rateType: 'BUDGET' });
  });
  it('uses the selected fiscal year’s budget rate for every version at constant currency, prior year included', () => {
    expect(rateFor('2025-02', { versionCode: 'ACT', fxBasis: 'constant', fiscalYear: 2026, reportingCurrency: 'USD' }))
      .toEqual({ monthKey: '2026-02', rateType: 'BUDGET' });
  });
});

describe('translateAndSum (C-10 to C-13, D-30)', () => {
  const rows = [
    { accountCode: 'GR_P1', monthKey: '2026-01', currencyCode: 'EUR', amountLocal: 90 },
    { accountCode: 'GR_P1', monthKey: '2026-02', currencyCode: 'EUR', amountLocal: 95 },
    { accountCode: 'GR_P1', monthKey: '2026-01', currencyCode: 'USD', amountLocal: 10 },
    { accountCode: 'COR_P1', monthKey: '2026-01', currencyCode: 'EUR', amountLocal: -45 },
  ];

  it('translates month by month and currency by currency before summing', () => {
    const usd = translateAndSum(rows, table, { versionCode: 'ACT', fxBasis: 'actual', fiscalYear: 2026, reportingCurrency: 'USD' });
    expect(usd.get('GR_P1')).toBeCloseTo(100 + 100 + 10, 9);
    expect(usd.get('COR_P1')).toBeCloseTo(-50, 9);
  });

  it('crosses local → USD → reporting currency with the same month and rate type', () => {
    const gbp = translateAndSum(rows, table, { versionCode: 'ACT', fxBasis: 'actual', fiscalYear: 2026, reportingCurrency: 'GBP' });
    expect(gbp.get('GR_P1')).toBeCloseTo(210 * 0.8, 9);
  });

  it('fails loudly on a missing rate instead of silently skipping money', () => {
    expect(() =>
      translateAndSum(
        [{ accountCode: 'x', monthKey: '2030-01', currencyCode: 'EUR', amountLocal: 1 }],
        table,
        { versionCode: 'ACT', fxBasis: 'actual', fiscalYear: 2030, reportingCurrency: 'USD' }
      )
    ).toThrow(/No ACTUAL_AVG rate for EUR 2030-01/);
  });
});
