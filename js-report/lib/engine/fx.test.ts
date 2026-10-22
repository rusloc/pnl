import { beforeAll, describe, expect, it } from 'vitest';
import { loadPublicDataset } from '../test-utils/public-data.ts';
import { createFx, translationFactor } from './fx.ts';
import type { Fx } from './fx.ts';

// C-11 … C-13 against fact_fx_rate (local per 1 USD). Month 24 = Jan 2026, 12 = Jan 2025.
let fx: Fx;
beforeAll(async () => {
  fx = createFx((await loadPublicDataset(['P'])).manifest);
});

describe('translationFactor', () => {
  it('is 1 for USD to USD', () => {
    expect(translationFactor(fx, 'USD', 'USD', 24, false, 'ACT', 24)).toBe(1);
  });

  it('C-11: actual and forecast at the month average rate, budget at its year budget rate', () => {
    expect(translationFactor(fx, 'EUR', 'USD', 24, false, 'ACT', 24)).toBe(1 / fx.rate('EUR', 24, 'ACTUAL_AVG'));
    expect(translationFactor(fx, 'EUR', 'USD', 24, true, 'ACT', 24)).toBe(1 / fx.rate('EUR', 24, 'BUDGET'));
    expect(fx.rate('EUR', 24, 'BUDGET')).toBe(0.87);
  });

  it('C-12: constant currency uses the selected year budget rate for every version, prior year included', () => {
    // a FY2025 actual (prior-year) row seen from FY2026 at constant currency
    expect(translationFactor(fx, 'GBP', 'USD', 12, false, 'CC', 24)).toBe(1 / fx.rate('GBP', 24, 'BUDGET'));
    expect(translationFactor(fx, 'GBP', 'USD', 12, true, 'CC', 24)).toBe(1 / 0.75);
  });

  it('C-13: cross rates go local → USD → reporting at the same month and rate type', () => {
    const f = translationFactor(fx, 'AUD', 'GBP', 30, false, 'ACT', 30);
    expect(f).toBe(fx.rate('GBP', 30, 'ACTUAL_AVG') / fx.rate('AUD', 30, 'ACTUAL_AVG'));
  });

  it('throws on a missing rate rather than translating at a wrong one', () => {
    expect(() => fx.rate('EUR', 99, 'ACTUAL_AVG')).toThrow(/no ACTUAL_AVG rate/);
  });
});
