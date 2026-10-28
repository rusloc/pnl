import { beforeAll, describe, expect, it } from 'vitest';
import type { Manifest } from '../data/manifest.ts';
import { loadPublicDataset } from '../test-utils/public-data.ts';
import { selection } from '../test-utils/selection.ts';
import { periodSummary, periodView } from './period.ts';

// Period picker v2 (docs/design/period-picker-v2.md Part 1) on the dummy data: FY2024 … FY2026, last close Sep 2026.
let m: Manifest;
beforeAll(async () => {
  m = (await loadPublicDataset(['P'])).manifest;
});

describe('periodSummary — the months the numbers contain, one sentence per time view', () => {
  it.each([
    ['MTD', 2026, 9, 'A', 'Showing Sep 2026'],
    ['MTD', 2024, 1, 'A', 'Showing Jan 2024'],
    ['QTD', 2026, 9, 'A', 'Showing Jul – Sep 2026 - quarter to date'],
    ['QTD', 2026, 7, 'A', 'Showing Jul 2026 - quarter to date'], // first month of the quarter
    ['YTD', 2026, 9, 'A', 'Showing Jan – Sep 2026 - year to date'],
    ['YTD', 2025, 1, 'A', 'Showing Jan 2025 - year to date'],
    ['LTM', 2026, 9, 'A', 'Showing Oct 2025 – Sep 2026 - last 12 months'], // crosses into the previous year
    ['LTM', 2025, 12, 'A', 'Showing Jan – Dec 2025 - last 12 months'], // inside one year
    ['LTM', 2024, 3, 'A', 'Showing Jan – Mar 2024 - last 12 months'], // clipped to the data history
    ['FY', 2025, 9, 'A', 'Showing Jan – Dec 2025 - full year'],
    ['FY', 2024, 2, 'A', 'Showing Jan – Dec 2024 - full year'], // the anchor month does not narrow a full year
    // C-01: under Actual the window is cut at the last close (Sep 2026); Latest estimate / Budget keep it whole
    ['FY', 2026, 9, 'A', 'Showing Jan – Sep 2026 - full year'],
    ['FY', 2026, 9, 'LE', 'Showing Jan – Dec 2026 - full year'],
    ['FY', 2026, 9, 'B', 'Showing Jan – Dec 2026 - full year'],
    ['YTD', 2026, 12, 'A', 'Showing Jan – Sep 2026 - year to date'],
    ['YTD', 2026, 12, 'LE', 'Showing Jan – Dec 2026 - year to date'],
    ['LTM', 2026, 12, 'A', 'Showing Jan – Sep 2026 - last 12 months'],
    ['LTM', 2026, 12, 'B', 'Showing Jan – Dec 2026 - last 12 months'],
    ['QTD', 2026, 11, 'A', 'Showing no closed month yet'], // parity rule 7: exactly this, no time-view tail
    ['MTD', 2026, 11, 'A', 'Showing no closed month yet'],
    ['MTD', 2026, 11, 'LE', 'Showing Nov 2026'],
  ] as const)('%s FY%i month %i base %s', (timeView, fy, month, base, text) => {
    expect(periodSummary(m, { timeView, fy, month, base })).toBe(text);
  });
});

describe('periodView', () => {
  const cells = (overrides: Parameters<typeof selection>[0]) => periodView(m, selection(overrides)).months;
  const names = (rows: readonly { name: string }[]) => rows.map((c) => c.name);

  it('time views first with plain labels, years without "FY"', () => {
    const v = periodView(m, selection());
    expect(v.timeViews.map((t) => t.label)).toEqual([
      'One month',
      'Quarter to date',
      'Year to date',
      'Last 12 months',
      'Full year',
    ]);
    expect(v.years).toEqual([2024, 2025, 2026]);
    expect(v.summary).toBe('Showing Jan – Sep 2026 - year to date');
  });

  it.each([
    ['MTD', 'Month'],
    ['QTD', 'Up to'],
    ['YTD', 'Up to'],
    ['LTM', 'Ending'],
  ] as const)('%s: the month grid is labelled "%s"', (timeView, label) => {
    const v = periodView(m, selection({ timeView }));
    expect(v.gridLabel).toBe(label);
    expect(v.fullYearNote).toBeNull();
  });

  it('Full year hides the grid and says which months it covers', () => {
    const v = periodView(m, selection({ timeView: 'FY' }));
    expect(v.gridLabel).toBeNull();
    expect(v.fullYearNote).toBe('Full year covers January to December.');
  });

  it('12 months of the selected year; the anchor is the selected month', () => {
    const c = cells({ fy: 2025, month: 4 });
    expect(c).toHaveLength(12);
    expect(c.filter((x) => x.anchor).map((x) => x.month)).toEqual([4]);
  });

  it('covered months are the window: YTD, QTD, one month', () => {
    expect(names(cells({ timeView: 'YTD', month: 9 }).filter((c) => c.covered))).toEqual(names(cells({}).slice(0, 9)));
    expect(names(cells({ timeView: 'QTD', month: 8 }).filter((c) => c.covered))).toEqual(['Jul', 'Aug']);
    expect(names(cells({ timeView: 'MTD', month: 5 }).filter((c) => c.covered))).toEqual(['May']);
  });

  it('LTM across years shades only the selected year’s part', () => {
    expect(names(cells({ timeView: 'LTM', fy: 2026, month: 3 }).filter((c) => c.covered))).toEqual([
      'Jan',
      'Feb',
      'Mar',
    ]);
    expect(names(cells({ timeView: 'LTM', fy: 2025, month: 12 }).filter((c) => c.covered))).toHaveLength(12);
  });

  it('C-01, base Actual: open months are not selectable, say "not closed yet" and are never shaded', () => {
    const c = cells({ base: 'A', timeView: 'LTM', month: 9 });
    const open = c.filter((x) => !x.selectable);
    expect(names(open)).toEqual(['Oct', 'Nov', 'Dec']);
    expect(open.every((x) => x.note === 'not closed yet' && !x.covered)).toBe(true);
    expect(c.filter((x) => x.selectable).every((x) => x.note === null)).toBe(true);
    expect(periodView(m, selection()).openMonthHint).toBe(
      'Switch the base to Latest estimate to include forecast months.',
    );
  });

  it('C-02 / C-05: Latest estimate and Budget make open months selectable with a small label', () => {
    const le = cells({ base: 'LE', month: 11 });
    expect(le.every((x) => x.selectable)).toBe(true);
    expect(le.filter((x) => x.note !== null).map((x) => x.note)).toEqual(['forecast', 'forecast', 'forecast']);
    expect(names(le.filter((x) => x.covered))).toHaveLength(11);
    expect(
      cells({ base: 'B' })
        .filter((x) => x.note !== null)
        .map((x) => x.note),
    ).toEqual(['budget', 'budget', 'budget']);
  });

  it('a closed year has no open months', () => {
    expect(cells({ fy: 2025 }).every((x) => x.selectable && x.note === null)).toBe(true);
  });
});
