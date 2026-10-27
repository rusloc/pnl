import { beforeAll, describe, expect, it } from 'vitest';
import type { Manifest } from '../data/manifest.ts';
import { loadPublicDataset } from '../test-utils/public-data.ts';
import { selection } from '../test-utils/selection.ts';
import { createEngine } from './index.ts';
import type { Engine } from './index.ts';
import { notices, windowLabel } from './notices.ts';
import { versionPlan } from './versions.ts';

// C-50 notice rows (parity rule 9): Track B's labels, conditions and text (`_Notice Row`) on the dummy data (last
// close Sep 2026, data from Jan 2024).
let engine: Engine;
let m: Manifest;
beforeAll(async () => {
  const ds = await loadPublicDataset(['P']);
  engine = createEngine(ds);
  m = ds.manifest;
});
const rows = (overrides: Parameters<typeof selection>[0]) =>
  engine.notices(selection(overrides)).map((n) => [n.label, n.text]);
const codes = (overrides: Parameters<typeof selection>[0]) => engine.notices(selection(overrides)).map((n) => n.code);

describe('notice rows (C-50, Track B copy)', () => {
  it('none for the default selection: no row at all', () => {
    expect(codes({})).toEqual([]);
  });

  it('T-11 Cut-off: an Actual window past the last close', () => {
    expect(rows({ timeView: 'FY', month: 12 })).toEqual([
      ['Cut-off', 'Actuals closed through Sep 2026: later months excluded; use Latest estimate for the full window'],
    ]);
  });

  it('C-02 Forecast: only when the base reads forecast months', () => {
    expect(rows({ base: 'LE', timeView: 'FY', month: 12 })).toEqual([
      ['Forecast', 'Forecast months included: Oct 2026 – Dec 2026 (Forecast 9+3 (Sep 2026))'],
    ]);
    expect(rows({ base: 'LE', timeView: 'MTD', month: 11 })).toEqual([
      ['Forecast', 'Forecast months included: Nov 2026 – Nov 2026 (Forecast 9+3 (Sep 2026))'], // Track B's text as is
    ]);
    expect(codes({ base: 'B', compareA: 'LE', timeView: 'FY', month: 12 })).toEqual([]); // a LE comparison: no row
    expect(codes({ base: 'LE', timeView: 'YTD', month: 9 })).toEqual([]); // nothing open in the window
  });

  it('T-12 Prior year: a window starting in the first data year with a prior-year comparison', () => {
    expect(rows({ fy: 2024, timeView: 'FY', month: 12 })).toEqual([['Prior year', 'Prior year n/a before Jan 2024']]);
    expect(codes({ fy: 2025, month: 9, timeView: 'LTM' })).toEqual(['N_PY']); // Oct 2024 – Sep 2025
    expect(codes({ fy: 2025, month: 9, timeView: 'YTD' })).toEqual([]);
    expect(codes({ fy: 2024, timeView: 'FY', month: 12, compareB: 'NONE' })).toEqual([]);
  });

  it('History: LTM before the data history, in Track B order after Prior year', () => {
    expect(rows({ fy: 2024, month: 3, timeView: 'LTM' })).toEqual([
      ['Prior year', 'Prior year n/a before Jan 2024'],
      ['History', 'LTM starts before the data history (Jan 2024)'],
    ]);
  });

  it('Allocation and Eliminations: slice filter on a company; Group view', () => {
    const at = (overrides: Parameters<typeof selection>[0]) =>
      notices(m, selection(overrides), versionPlan(m, selection(overrides))).map((n) => [n.label, n.text]);
    expect(at({ channel: ['GRO'] })).toEqual([
      ['Allocation', 'Slice filter on: lines from operating expenses down are allocated by net-revenue share'],
    ]);
    expect(at({ region: ['EU'] })).toEqual([]); // region alone allocates nothing (Track B)
    expect(at({ entity: 'GROUP' })).toEqual([
      ['Eliminations', 'ACME Group: Commerce Cloud fees billed to Consumer Products are eliminated'],
    ]);
  });
});

describe('statement column-group title window (parity rule 12)', () => {
  it.each([
    ['YTD', 'YTD Sep 2026'],
    ['MTD', 'Sep 2026'],
    ['LTM', 'LTM Sep 2026'],
    ['FY', 'Full year 2026'],
  ] as const)('%s → %s', (timeView, label) => {
    expect(windowLabel(m, selection({ timeView }))).toBe(label);
  });
});
