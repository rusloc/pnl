import { describe, expect, it } from 'vitest';

import { sampleReference } from '../data/sample-reference';
import {
  bridgeComparison,
  comparisonText,
  defaultFilters,
  filterReducer,
  kpiCaption,
  railSummaries,
  statementFootnote,
  toggleSelection,
  windowTitle,
} from './filters';

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
    // Parity rule 1: no Analysis comparison toggle; rule 4: Region (index 0) for every company.
    expect(defaults).not.toHaveProperty('analysisCompare');
    expect(defaults.breakdown).toEqual({ P: 0, S: 0, G: 0 });
  });
});

describe('selection-built copy (parity rules 1, 12, 13, 16)', () => {
  it('bridgeComparison is Compare A, else Compare B, else Prior year (C-40)', () => {
    expect(bridgeComparison(defaults)).toBe('BUD');
    expect(bridgeComparison({ compareA: 'NONE', compareB: 'LE' })).toBe('LE');
    expect(bridgeComparison({ compareA: 'NONE', compareB: 'NONE' })).toBe('PY');
  });

  it('comparisonText is the full name in lower case, never the "Latest est." abbreviation', () => {
    expect(comparisonText('BUD')).toBe('budget');
    expect(comparisonText('LE')).toBe('latest estimate');
    expect(comparisonText('PY')).toBe('prior year');
  });

  it('windowTitle writes the window like Track B’s PL Hdr Base', () => {
    expect(windowTitle(defaults)).toBe('YTD Sep 2026');
    expect(windowTitle({ ...defaults, timeView: 'qtd', month: 6 })).toBe('QTD Jun 2026');
    expect(windowTitle({ ...defaults, timeView: 'ltm' })).toBe('LTM Sep 2026');
    expect(windowTitle({ ...defaults, timeView: 'month' })).toBe('Sep 2026');
    expect(windowTitle({ ...defaults, timeView: 'fy', fiscalYear: 2025 })).toBe('Full year 2025');
  });

  it('kpiCaption names the active comparisons like Track B’s Kpi Toolbar Caption', () => {
    expect(kpiCaption(defaults)).toBe('Changes vs Budget and Prior year, same months');
    expect(kpiCaption({ compareA: 'LE', compareB: 'NONE' })).toBe('Changes vs Latest estimate, same months');
    expect(kpiCaption({ compareA: 'NONE', compareB: 'PY' })).toBe('Changes vs Prior year, same months');
    expect(kpiCaption({ compareA: 'NONE', compareB: 'NONE' })).toBe('No comparison selected');
  });

  it('statementFootnote follows rates, cost sign, the bar comparison and the tag switch, " - " separated', () => {
    expect(statementFootnote(defaults)).toBe(
      'Actual at average rates, budget at budget rates - costs negative - Δ positive when favourable - bars in Δ % vs Budget on a ±15% scale - IFRS 18 required subtotal - MPM management-defined measure - Mgmt management subtotal - IC intercompany'
    );
    expect(statementFootnote({ ...defaults, fxBasis: 'constant', costSign: 'pos', compareA: 'LE', showTags: false })).toBe(
      'Constant currency at FY2026 budget rates - costs shown positive - Δ positive when favourable - bars in Δ % vs Latest estimate on a ±15% scale'
    );
    expect(statementFootnote({ ...defaults, compareA: 'NONE', showTags: false })).toBe('Actual at average rates, budget at budget rates - costs negative - Δ positive when favourable');
    expect(statementFootnote(defaults)).not.toContain(' · ');
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

describe('railSummaries (§5.1)', () => {
  it('carries the period sentence through and names the versions and display settings', () => {
    const s = railSummaries(defaults, 'All slices', 'Showing Jan – Sep 2026 - year to date');
    expect(s).toEqual({
      period: 'Showing Jan – Sep 2026 - year to date',
      compare: 'Actual vs Budget, Prior year',
      slice: 'All slices',
      display: 'USD m - actual rates',
    });
    // Track B's Rail Sum Versions / Rail Sum Display wording (parity rules 6, 8).
    expect(railSummaries({ ...defaults, compareA: 'NONE', compareB: 'NONE' }, '', '').compare).toBe('Actual only');
    expect(railSummaries({ ...defaults, baseVersion: 'LE', compareA: 'NONE', compareB: 'NONE' }, '', '').compare).toBe('Latest estimate only');
    expect(railSummaries({ ...defaults, currency: 'EUR', units: 'k', fxBasis: 'constant' }, '', '').display).toBe('EUR k - constant currency');
  });
});
