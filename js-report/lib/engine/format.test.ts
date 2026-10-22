import { describe, expect, it } from 'vitest';
import { displayValue, formatAmount, formatPercent, formatPoints, roundsToZero } from './format.ts';

// N-06 number formats; D-30 rounding at display only.
const M = { divisor: 1_000_000, decimals: 1 };
const K = { divisor: 1_000, decimals: 0 };

describe('format', () => {
  it('millions with 1 decimal, thousands with 0, thousands separators', () => {
    expect(formatAmount(3_398_512_345.67, M)).toBe('3,398.5');
    expect(formatAmount(3_398_512_345.67, K)).toBe('3,398,512');
  });

  it('uses a true minus sign (U+2212) and never shows −0', () => {
    expect(formatAmount(-1_719_300_000, M)).toBe('−1,719.3');
    expect(formatAmount(-40_000, M)).toBe('0.0');
    expect(formatPercent(-0.0004)).toBe('0.0%');
  });

  it('percentages with 1 decimal, take rate with 2, points for ratio Δ', () => {
    expect(formatPercent(0.20084)).toBe('20.1%');
    expect(formatPercent(0.029345, 2)).toBe('2.93%');
    expect(formatPoints(-0.0123)).toBe('−1.2 pp');
    expect(formatPoints(0.0123)).toBe('+1.2 pp');
    expect(formatPoints(0.0123)).toBe('+1.2 pp');
  });

  it('n/a for missing values (M-13)', () => {
    expect(formatAmount(null, M)).toBe('n/a');
    expect(formatPercent(null)).toBe('n/a');
    expect(formatPoints(null)).toBe('n/a');
  });

  it('signs deltas with + and keeps zero unsigned (L-12)', () => {
    expect(formatAmount(21_600_000, M, { signed: true })).toBe('+21.6');
    expect(formatAmount(-21_600_000, M, { signed: true })).toBe('−21.6');
    expect(formatAmount(30_000, M, { signed: true })).toBe('0.0');
    expect(formatPercent(0.0312, 1, { signed: true })).toBe('+3.1%');
  });

  it('roundsToZero follows the display units', () => {
    expect(roundsToZero(40_000, M)).toBe(true);
    expect(roundsToZero(60_000, M)).toBe(false);
    expect(roundsToZero(400, K)).toBe(true);
  });

  it('F-15: costs shown as positives flips cost rows only', () => {
    expect(displayValue(-1_719.3, true, -1)).toBe(1_719.3);
    expect(displayValue(-1_719.3, true, 1)).toBe(-1_719.3);
    expect(displayValue(3_398.5, false, -1)).toBe(3_398.5);
    expect(displayValue(null, true, -1)).toBeNull();
  });
});
