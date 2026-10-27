// The variance rules the app derives client-side (ADR-0006 §16), checked against the
// DAX of `_PL Δ A/B/LE`, `PL Δ A/B %`, `PL % NR` and `KPI Δ A/B` in
// pbi-report/ACME Unified PnL/ACME Unified PnL.SemanticModel/definition/tables/_measures.tmdl,
// including DAX blank arithmetic (BLANK − x = −x; DIVIDE by 0 or BLANK = BLANK).
import { describe, expect, it } from 'vitest';

import { kpiDelta, plDelta, plDeltaPct, plPctNr } from './derive';

describe('plDelta (_PL Δ A / _PL Δ B / _PL Δ LE)', () => {
  it('is base − comparison on signed values: a smaller cost (less negative) is a positive, favourable Δ', () => {
    expect(plDelta(3398.52, 3464.8, false)).toBeCloseTo(-66.28, 10);
    expect(plDelta(-647.77, -674.99, false)).toBeCloseTo(27.22, 10);
  });

  it('is blank when the comparison is blank, and treats a blank base as 0 (BLANK − c = −c)', () => {
    expect(plDelta(12.5, null, false)).toBeNull();
    expect(plDelta(null, null, false)).toBeNull();
    expect(plDelta(null, 12.5, false)).toBe(-12.5);
  });

  it('reports ratio rows in percentage points (× 100)', () => {
    expect(plDelta(0.494, 0.498, true)).toBeCloseTo(-0.4, 10);
    expect(plDelta(null, 0.25, true)).toBe(-25);
  });
});

describe('plDeltaPct (PL Δ A % / PL Δ B %)', () => {
  it('divides the Δ by |comparison| so a cost line keeps the favourable sign', () => {
    expect(plDeltaPct(3398.52, 3464.8, false)).toBeCloseTo(-0.0191295, 6);
    expect(plDeltaPct(-647.77, -674.99, false)).toBeCloseTo(0.04033, 5);
  });

  it('is blank on ratio rows, blank comparison and a zero comparison (DIVIDE)', () => {
    expect(plDeltaPct(0.494, 0.498, true)).toBeNull();
    expect(plDeltaPct(10, null, false)).toBeNull();
    expect(plDeltaPct(10, 0, false)).toBeNull();
    expect(plDeltaPct(null, 10, false)).toBe(-1);
  });
});

describe('plPctNr (PL % NR)', () => {
  it('is the row value over the NR line value of the same column', () => {
    expect(plPctNr(4321.0, 3398.52, false)).toBeCloseTo(1.271436, 5);
    expect(plPctNr(3398.52, 3398.52, false)).toBe(1);
  });

  it('is blank on ratio rows, blank values and a blank or zero NR', () => {
    expect(plPctNr(0.494, 3398.52, true)).toBeNull();
    expect(plPctNr(null, 3398.52, false)).toBeNull();
    expect(plPctNr(10, null, false)).toBeNull();
    expect(plPctNr(10, 0, false)).toBeNull();
  });
});

describe('kpiDelta (KPI Δ A / KPI Δ B)', () => {
  it('is relative to |comparison| on amount, count and price KPIs and in pp on percent KPIs', () => {
    expect(kpiDelta(3398.5219, 3464.7987, false, false)).toBeCloseTo(-0.019129, 6);
    expect(kpiDelta(-10, -8, false, false)).toBe(-0.25);
    expect(kpiDelta(0.4941, 0.4982, true, false)).toBeCloseTo(-0.41, 10);
  });

  it('is blank when the Compare is None, either side is blank, or a non-percent comparison is 0', () => {
    expect(kpiDelta(1, 2, false, true)).toBeNull();
    expect(kpiDelta(null, 2, false, false)).toBeNull();
    expect(kpiDelta(1, null, true, false)).toBeNull();
    expect(kpiDelta(1, 0, false, false)).toBeNull();
    expect(kpiDelta(0.05, 0, true, false)).toBe(5);
  });
});
