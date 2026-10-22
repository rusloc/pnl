import { describe, expect, it } from 'vitest';

import { sampleReference } from '../data/sample-reference';
import { contextLine, defaultFilters, filterReducer, toggleSelection } from './filters';

const reference = sampleReference();
const defaults = defaultFilters(reference);

describe('defaultFilters', () => {
  it('anchors on the last closed month from dim_month (N-03) with the spec §6 defaults', () => {
    expect(defaults).toMatchObject({
      entity: 'P', fiscalYear: 2026, month: 9, timeView: 'ytd',
      baseVersion: 'ACT', compareA: 'BUD', compareB: 'PY',
      regions: null, currency: 'USD', fxBasis: 'actual', units: 'm',
    });
    // ADR-0007: one layout, one cost lens, no detail level in the filter state.
    expect(defaults).not.toHaveProperty('layout');
    expect(defaults).not.toHaveProperty('costLens');
    expect(defaults).not.toHaveProperty('detail');
  });
});

describe('toggleSelection (F-33)', () => {
  const all = ['a', 'b', 'c'];
  it('removes from "all" and never clears the last value', () => {
    expect(toggleSelection(null, 'b', all)).toEqual(['a', 'c']);
    expect(toggleSelection(['a'], 'a', all)).toEqual(['a']);
  });
  it('collapses back to "all" when every value is selected again', () => {
    expect(toggleSelection(['a', 'c'], 'b', all)).toBeNull();
  });
});

describe('filterReducer', () => {
  it('keeps period, versions, currency and region on an entity switch (F-31) and slices per entity (F-30)', () => {
    let s = filterReducer(defaults, { type: 'set', patch: { fiscalYear: 2025, compareA: 'LE', currency: 'EUR' } });
    s = filterReducer(s, { type: 'toggleRegion', code: 'NA', all: ['NA', 'EU', 'UK', 'APAC'] });
    s = filterReducer(s, { type: 'toggleSlice', slot: 'channel', code: 'x', all: ['x', 'y'] });
    s = filterReducer(s, { type: 'entity', entity: 'S' });
    expect(s).toMatchObject({ entity: 'S', fiscalYear: 2025, compareA: 'LE', currency: 'EUR', regions: ['EU', 'UK', 'APAC'] });
    expect(s.slices.P.channel).toEqual(['y']);
    expect(s.slices.S.channel).toBeNull();
    s = filterReducer(s, { type: 'entity', entity: 'P' });
    expect(s.slices.P.channel).toEqual(['y']);
  });

  it('ignores slice toggles in the Group view (F-32)', () => {
    const s = filterReducer(defaults, { type: 'entity', entity: 'G' });
    expect(filterReducer(s, { type: 'toggleSlice', slot: 'line', code: 'x', all: ['x', 'y'] })).toBe(s);
  });

  it('resets one group to its defaults, keeping the entity (F-35)', () => {
    let s = filterReducer(defaults, { type: 'entity', entity: 'S' });
    s = filterReducer(s, { type: 'set', patch: { month: 3, timeView: 'month', units: 'k' } });
    s = filterReducer(s, { type: 'resetGroup', group: 'period', defaults });
    expect(s).toMatchObject({ entity: 'S', month: 9, timeView: 'ytd', units: 'k' });
  });
});

describe('contextLine (L-04)', () => {
  it('names the company (ADR-0007), then window, versions, currency/units/FX and slices', () => {
    expect(contextLine(defaults, 'All slices')).toBe(
      'Consumer Products · YTD Jan–Sep 2026 · Actual vs Budget and Prior year · USD m, actual rates · All slices'
    );
    expect(contextLine({ ...defaults, entity: 'G' }, 'All regions, consolidated')).toMatch(/^ACME Group · /);
  });
});
