// Page top (period-picker-v2 Part 2): the status line with " - " separators and
// the applied-filters rows, the same rows as Track B's dim_filter_row / Filter
// Value, plus the notice rows that never disappear (C-50).
import { describe, expect, it } from 'vitest';

import { sampleReference } from '../data/sample-reference';
import { filterRows, noticeLabel, noticeRows, refreshedText, statusLine } from './applied-filters';
import { defaultFilters } from './filters';
import type { FilterState } from './types';

const reference = sampleReference();
const defaults = defaultFilters(reference);
const at = (patch: Partial<FilterState>): FilterState => ({ ...defaults, ...patch });

describe('statusLine (N-02, N-03)', () => {
  it('names the company, the last closed month and the refresh with " - " separators; no refresh until the model answered', () => {
    expect(statusLine(defaults, reference, null)).toBe('Consumer Products - Management reporting - Closed through Sep 2026');
    expect(statusLine(at({ entity: 'G' }), reference, '22 Oct 2026 13:53')).toBe(
      'ACME Group - Management reporting - Closed through Sep 2026 - Refreshed 22 Oct 2026 13:53'
    );
    expect(statusLine(at({ entity: 'S' }), reference, null)).toMatch(/^Commerce Cloud - /);
    expect(statusLine(defaults, reference, null)).not.toContain(' · ');
  });

  it('formats the model timestamp as stored (d Mon yyyy HH:mm) and never invents one', () => {
    expect(refreshedText('2026-10-22T13:53:00')).toBe('22 Oct 2026 13:53');
    expect(refreshedText('2026-10-05 08:07:21.000')).toBe('5 Oct 2026 08:07');
    expect(refreshedText('yesterday')).toBeNull();
    expect(refreshedText('')).toBeNull();
    expect(refreshedText(null)).toBeNull();
  });
});

describe('filterRows — Track B’s dim_filter_row order and values', () => {
  it('lists the ten rows for the defaults', () => {
    expect(filterRows(defaults, reference)).toEqual([
      { label: 'Company', value: 'Consumer Products' },
      { label: 'Fiscal year', value: '2026' },
      { label: 'Period', value: 'Showing Jan – Sep 2026 - year to date' },
      { label: 'Time view', value: 'Year to date' },
      { label: 'Versions', value: 'Actual vs Budget (A) and Prior year (B)' },
      { label: 'Currency', value: 'USD' },
      { label: 'FX basis', value: 'Actual rates' },
      { label: 'Units', value: 'Millions' },
      { label: 'Regions', value: 'All regions' },
      { label: 'Slices', value: 'All slices' },
    ]);
  });

  it('spells out narrowed regions and slices with the company’s own slot labels, in the dimension’s sort_order (parity rule 10)', () => {
    const rows = filterRows(
      at({
        regions: ['APAC', 'EU'],
        slices: { ...defaults.slices, P: { channel: ['Own D2C webstore', 'Grocery & mass retail'], line: null, segment: ['Value & private label', 'Premium'] } },
      }),
      reference
    );
    // Alphabetical would put Asia-Pacific first and Premium last.
    expect(rows.find((r) => r.label === 'Regions')?.value).toBe('Continental Europe, Asia-Pacific');
    expect(rows.find((r) => r.label === 'Slices')?.value).toBe('Channel: Grocery & mass retail, Own D2C webstore - Category: All - Price tier: Premium, Value & private label');
  });

  it('the Period row is the full "Showing …" sentence, "Showing no closed month yet" when nothing is covered (parity rule 7)', () => {
    expect(filterRows(at({ month: 11, timeView: 'month' }), reference).find((r) => r.label === 'Period')?.value).toBe('Showing no closed month yet');
  });

  it('covers the Group view, Compare None, constant currency and thousands', () => {
    const group = filterRows(at({ entity: 'G', compareB: 'NONE', fxBasis: 'constant', units: 'k' }), reference);
    expect(group.find((r) => r.label === 'Company')?.value).toBe('ACME Group (consolidated)');
    expect(group.find((r) => r.label === 'Versions')?.value).toBe('Actual vs Budget (A)');
    expect(group.find((r) => r.label === 'FX basis')?.value).toBe('Constant currency (FY2026 budget rates)');
    expect(group.find((r) => r.label === 'Units')?.value).toBe('Thousands');
    expect(group.find((r) => r.label === 'Slices')?.value).toBe('Consolidated: channel, category and segment do not apply');
    expect(filterRows(at({ compareA: 'NONE', compareB: 'NONE', baseVersion: 'LE' }), reference).find((r) => r.label === 'Versions')?.value).toBe('Latest estimate only');
    expect(filterRows(at({ compareA: 'NONE', compareB: 'PY' }), reference).find((r) => r.label === 'Versions')?.value).toBe('Actual vs Prior year (B)');
  });
});

describe('noticeRows (C-50, parity rule 9)', () => {
  it('one row per notice, labelled like Track B’s dim_filter_row; no row at all when none applies', () => {
    expect(noticeRows([])).toEqual([]);
    expect(
      noticeRows([
        'Actuals closed through September 2026: later months excluded; use Latest estimate for the full window',
        'Forecast months included: October 2026 – December 2026 (Forecast 9+3)',
        'Prior year n/a before January 2024',
        'LTM starts before the data history (January 2024)',
        'Slice filter on: lines from operating expenses down are allocated by net-revenue share',
        'ACME Group: Commerce Cloud fees billed to Consumer Products are eliminated',
      ]).map((r) => r.label)
    ).toEqual(['Cut-off', 'Forecast', 'Prior year', 'History', 'Allocation', 'Eliminations']);
    expect(noticeRows(['Slice filter on: …'])[0]).toEqual({ label: 'Allocation', value: 'Slice filter on: …' });
  });

  it('labels the app’s own offline notices "Sample" and anything unknown "Notice"', () => {
    expect(noticeLabel('Sample figures (YTD Sep 2026, …) don’t respond to period')).toBe('Sample');
    expect(noticeLabel('Reference data (months, versions, regions, slices) is sample: lh_raw could not be read')).toBe('Sample');
    expect(noticeLabel('Full year compares the budget with the latest estimate')).toBe('Notice');
  });
});
