import { describe, expect, it } from 'vitest';

import { fmtAmount, fmtPct, fmtPp, MINUS, parseSampleNumber, toneOf } from './format';

describe('format (N-06, L-12)', () => {
  it('formats millions with 1 decimal, thousands with 0, grouping and U+2212', () => {
    expect(fmtAmount(4321, 'm')).toBe('4,321.0');
    expect(fmtAmount(-1719.3, 'm')).toBe(`${MINUS}1,719.3`);
    expect(fmtAmount(-69.3, 'm', true)).toBe(`${MINUS}69.3`);
    expect(fmtAmount(333, 'm', true)).toBe('+333.0');
    expect(fmtAmount(0.04, 'm', true)).toBe('0.0');
    expect(fmtAmount(3398.5, 'k')).toBe('3,398,500');
    expect(fmtAmount(null, 'm')).toBe('');
  });

  it('formats percentages and percentage points', () => {
    expect(fmtPct(127.1)).toBe('127.1%');
    expect(fmtPct(-1.6, true)).toBe(`${MINUS}1.6%`);
    expect(fmtPct(8.4, true)).toBe('+8.4%');
    expect(fmtPp(-0.4)).toBe(`${MINUS}0.4 pp`);
    expect(fmtPp(0)).toBe('0.0 pp');
  });

  it('derives tone from the rounded delta (M-10): positive favourable, zero neutral', () => {
    expect(toneOf(0.2)).toBe('fav');
    expect(toneOf(-0.1)).toBe('unf');
    expect(toneOf(0.04)).toBe('neutral');
    expect(toneOf(null)).toBe('neutral');
  });

  it('parses the mockup cell text back to numbers', () => {
    expect(parseSampleNumber(`${MINUS}1,349.5`)).toBe(-1349.5);
    expect(parseSampleNumber('+8.4%')).toBe(8.4);
    expect(parseSampleNumber(`${MINUS}0.4 pp`)).toBe(-0.4);
    expect(parseSampleNumber('')).toBeNull();
  });
});
