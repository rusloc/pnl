import { describe, expect, it } from 'vitest';
import { DOCUMENT_TITLE, FILTERS, FOOTNOTE, HEADER, KPI, TOOLTIP, WATERFALL } from './copy.ts';

// Contract §4, §8 step 3: every string of §4 present, none carries a digit (numbers come from the engine). The verbatim
// diff against the PBIR text boxes is bip's (sync point 1).

const strings = (o: unknown): string[] =>
  typeof o === 'string' ? [o] : o && typeof o === 'object' ? Object.values(o).flatMap(strings) : [];

describe('copy.ts', () => {
  it('holds the page strings of §4', () => {
    expect(HEADER.title).toBe('Truck time utilization');
    expect(HEADER.subtitle).toBe('Haul fleet · Plan vs Fact · share of total time');
    expect(DOCUMENT_TITLE).toBe('Truck time utilization — Plan vs Fact');
    expect([KPI.truckLoading.title, KPI.effectiveWork.title, KPI.performance.title, KPI.mass.title]).toEqual([
      'TRUCK LOADING',
      'EFFECTIVE WORK TIME',
      'PERFORMANCE PER TRUCK',
      'MASS LOADED PER TRUCK',
    ]);
    expect([KPI.truckLoading.unit, KPI.performance.unit, KPI.mass.unit]).toEqual([
      '% of total time',
      'm³/h',
      'thousand m³',
    ]);
    expect(WATERFALL.title).toBe('Time structure');
    expect(WATERFALL.subtitle).toBe('Waterfall from total time to truck loading, % of total');
    expect(Object.values(WATERFALL.legend)).toEqual(['Subtotal', 'Time loss', 'Better than plan', 'Worse than plan']);
    expect(Object.values(WATERFALL.columns)).toEqual(['CATEGORY', 'PLAN', '%', 'FACT', '%', 'Δ FACT − PLAN, PP']);
    expect(FILTERS.reset).toBe('↺  Reset filters');
    expect(FOOTNOTE).toBe(
      'Δ is favorable (blue) when a subtotal grows or a time loss shrinks against plan; unfavorable (orange) otherwise.',
    );
    expect(Object.values(TOOLTIP)).toEqual(['Plan share', 'Fact share', 'Δ fact − plan']);
  });
  it('no string carries a digit', () => {
    for (const s of strings({ HEADER, FILTERS, KPI, WATERFALL, TOOLTIP, FOOTNOTE })) expect(s).not.toMatch(/\d/);
  });
});
