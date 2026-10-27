import { beforeAll, describe, expect, it } from 'vitest';
import type { Manifest } from '../data/manifest.ts';
import { loadPublicDataset } from '../test-utils/public-data.ts';
import { selection } from '../test-utils/selection.ts';
import { appliedFilters, formatStamp, headerStatus, railSummaries } from './header.ts';

// Page top (docs/design/period-picker-v2.md Part 2): status line and applied-filters rows, Track B wording.
let m: Manifest;
beforeAll(async () => {
  m = (await loadPublicDataset(['P'])).manifest;
});

const value = (rows: { label: string; value: string }[], label: string) => rows.find((r) => r.label === label)?.value;

describe('status line (L-01, N-02, N-03)', () => {
  it('company - Management reporting - Closed through - Refreshed (data build time)', () => {
    const stamp = formatStamp(m, m.builtAt, 'UTC');
    expect(headerStatus(m, { entity: 'P' }, 'UTC')).toBe(
      `Consumer Products - Management reporting - Closed through Sep 2026 - Refreshed ${stamp}`,
    );
    expect(headerStatus(m, { entity: 'S' }, 'UTC')).toMatch(/^Commerce Cloud - /);
    expect(headerStatus(m, { entity: 'GROUP' }, 'UTC')).toMatch(/^ACME Group - /);
    expect(headerStatus(m, { entity: 'P' })).not.toContain(' · ');
  });

  it('stamp: d Mon YYYY HH:MM in the given time zone, 24-hour clock', () => {
    expect(formatStamp(m, '2026-10-22T10:32:57.404Z', 'UTC')).toBe('22 Oct 2026 10:32');
    expect(formatStamp(m, '2026-10-22T23:05:00Z', 'Europe/Berlin')).toBe('23 Oct 2026 01:05');
    expect(formatStamp(m, '2026-09-01T00:00:00Z', 'UTC')).toBe('1 Sep 2026 00:00');
  });
});

describe('applied filters (replace the L-04 context line)', () => {
  it('the Track B rows in order; the Period row is the picker summary', () => {
    expect(appliedFilters(m, selection())).toEqual([
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

  it('versions with one or no comparison; constant currency; thousands', () => {
    const rows = (o: Parameters<typeof selection>[0]) => appliedFilters(m, selection(o));
    expect(value(rows({ compareB: 'NONE' }), 'Versions')).toBe('Actual vs Budget (A)');
    expect(value(rows({ base: 'LE', compareA: 'NONE' }), 'Versions')).toBe('Latest estimate vs Prior year (B)');
    expect(value(rows({ compareA: 'NONE', compareB: 'NONE' }), 'Versions')).toBe('Actual only');
    expect(value(rows({ fxBasis: 'CC', fy: 2025 }), 'FX basis')).toBe('Constant currency (FY2025 budget rates)');
    expect(value(rows({ units: 'K' }), 'Units')).toBe('Thousands');
  });

  it('regions and slices by name with the company’s slot labels; Group view', () => {
    const rows = appliedFilters(m, selection({ region: ['EU', 'UK'], channel: ['GRO'] }));
    expect(value(rows, 'Regions')).toBe('Continental Europe, UK & Ireland');
    expect(value(rows, 'Slices')).toBe('Channel: Grocery & mass retail - Category: All - Price tier: All');
    const group = appliedFilters(m, selection({ entity: 'GROUP' }));
    expect(value(group, 'Company')).toBe('ACME Group (consolidated)');
    expect(value(group, 'Slices')).toBe('Consolidated: channel, category and segment do not apply');
  });
});

describe('slice values in dimension sort_order (parity rule 10)', () => {
  it('regions and slices follow sort_order, not the table or click order', () => {
    const t = m.tables;
    // Same rows, shuffled: the output order must come from sort_order alone
    const shuffled: Manifest = {
      ...m,
      tables: { ...t, dim_region: [...t.dim_region].reverse(), dim_channel: [...t.dim_channel].reverse() },
    };
    const rows = appliedFilters(shuffled, selection({ region: ['AP', 'NA', 'UK'], channel: ['MKT', 'GRO'] }));
    expect(value(rows, 'Regions')).toBe('North America, UK & Ireland, Asia-Pacific');
    expect(value(rows, 'Slices')).toMatch(/^Channel: Grocery & mass retail, Online marketplaces - /);
  });
});

describe('rail summaries (Track B Rail Sum Versions / Display)', () => {
  it('Versions: base vs comparisons; "Actual only" without a comparison (parity rule 8)', () => {
    expect(railSummaries(selection()).versions).toBe('Actual vs Budget, Prior year');
    expect(railSummaries(selection({ base: 'LE', compareA: 'NONE' })).versions).toBe('Latest estimate vs Prior year');
    expect(railSummaries(selection({ compareA: 'NONE', compareB: 'NONE' })).versions).toBe('Actual only');
  });

  it('Display: currency, units and FX basis separated by " - " (parity rule 6)', () => {
    expect(railSummaries(selection()).display).toBe('USD m - actual rates');
    expect(railSummaries(selection({ currency: 'EUR', units: 'K', fxBasis: 'CC' })).display).toBe(
      'EUR k - constant currency',
    );
  });
});
