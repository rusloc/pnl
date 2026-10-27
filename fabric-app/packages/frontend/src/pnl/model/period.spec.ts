// Period picker v2 (docs/design/period-picker-v2.md Part 1): the summary
// sentence for every time view (incl. LTM crossing a year and Full year), the
// C-01 cut under Actual, the data-history clip, the covered months behind the
// shading, the open-month rules per base version and the grid label.
import { describe, expect, it } from 'vitest';

import { sampleReference } from '../data/sample-reference';
import { defaultFilters } from './filters';
import {
  coveredMonths,
  coveredWindow,
  fiscalYears,
  monthGridLabel,
  monthState,
  OPEN_MONTH_HINT,
  OPEN_MONTH_TEXT,
  periodSummary,
  periodWindowText,
  TIME_VIEW_OPTIONS,
} from './period';
import type { FilterState } from './types';

const reference = sampleReference(); // Jan 2024 – Dec 2026, last closed Sep 2026
const defaults = defaultFilters(reference); // YTD Sep 2026, Actual

const at = (patch: Partial<FilterState>): FilterState => ({ ...defaults, ...patch });

describe('periodSummary — one sentence per time view', () => {
  it('names the window with the plain time-view tail', () => {
    expect(periodSummary(defaults, reference)).toBe('Showing Jan – Sep 2026 - year to date');
    expect(periodSummary(at({ timeView: 'month' }), reference)).toBe('Showing Sep 2026');
    expect(periodSummary(at({ timeView: 'qtd' }), reference)).toBe('Showing Jul – Sep 2026 - quarter to date');
    expect(periodSummary(at({ timeView: 'qtd', month: 7 }), reference)).toBe('Showing Jul 2026 - quarter to date');
    expect(periodSummary(at({ timeView: 'ytd', month: 1 }), reference)).toBe('Showing Jan 2026 - year to date');
  });

  it('LTM crossing into the previous year names the full range', () => {
    expect(periodSummary(at({ timeView: 'ltm' }), reference)).toBe('Showing Oct 2025 – Sep 2026 - last 12 months');
    expect(periodSummary(at({ timeView: 'ltm', fiscalYear: 2025, month: 12 }), reference)).toBe('Showing Jan – Dec 2025 - last 12 months');
    expect(periodSummary(at({ timeView: 'ltm', fiscalYear: 2025, month: 3 }), reference)).toBe('Showing Apr 2024 – Mar 2025 - last 12 months');
  });

  it('Full year covers Jan – Dec, cut at the close under Actual (C-01), whole under Latest estimate / Budget', () => {
    expect(periodSummary(at({ timeView: 'fy', fiscalYear: 2025 }), reference)).toBe('Showing Jan – Dec 2025 - full year');
    expect(periodSummary(at({ timeView: 'fy' }), reference)).toBe('Showing Jan – Sep 2026 - full year');
    expect(periodSummary(at({ timeView: 'fy', baseVersion: 'LE' }), reference)).toBe('Showing Jan – Dec 2026 - full year');
    expect(periodSummary(at({ timeView: 'fy', baseVersion: 'BUD' }), reference)).toBe('Showing Jan – Dec 2026 - full year');
  });

  it('an anchor after the close is cut under Actual and kept under Latest estimate', () => {
    expect(periodSummary(at({ month: 12 }), reference)).toBe('Showing Jan – Sep 2026 - year to date');
    expect(periodSummary(at({ month: 12, baseVersion: 'LE' }), reference)).toBe('Showing Jan – Dec 2026 - year to date');
    expect(periodSummary(at({ month: 12, timeView: 'ltm' }), reference)).toBe('Showing Jan – Sep 2026 - last 12 months');
    // Nothing covered at all: an open single month under Actual. Exactly this, no time-view tail (parity rule 7).
    expect(periodSummary(at({ month: 11, timeView: 'month' }), reference)).toBe('Showing no closed month yet');
    expect(periodSummary(at({ fiscalYear: 2026, month: 11, timeView: 'qtd' }), reference)).toBe('Showing no closed month yet');
    expect(coveredWindow(at({ month: 11, timeView: 'month' }), reference)).toBeNull();
  });

  it('clips the start to the data history like the model (MAX ( _Win Start, 0 ))', () => {
    expect(periodSummary(at({ timeView: 'ltm', fiscalYear: 2024, month: 3 }), reference)).toBe('Showing Jan – Mar 2024 - last 12 months');
  });

  it('is the same text the rail and the pop-up use, minus "Showing "', () => {
    expect(periodWindowText(defaults, reference)).toBe('Jan – Sep 2026 - year to date');
    expect(periodSummary(defaults, reference)).toBe(`Showing ${periodWindowText(defaults, reference)}`);
  });
});

describe('coveredMonths — the shading', () => {
  it('lists every month of the window; LTM shows 12 months starting in the previous year', () => {
    const ltm = coveredMonths(at({ timeView: 'ltm' }), reference);
    expect(ltm).toHaveLength(12);
    expect(ltm[0]).toEqual({ fiscalYear: 2025, monthNumber: 10 });
    expect(ltm[11]).toEqual({ fiscalYear: 2026, monthNumber: 9 });
    // The selected year's part is what the grid shades.
    expect(ltm.filter((m) => m.fiscalYear === 2026).map((m) => m.monthNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(coveredMonths(at({ timeView: 'qtd' }), reference).map((m) => m.monthNumber)).toEqual([7, 8, 9]);
    expect(coveredMonths(at({ timeView: 'month' }), reference)).toEqual([{ fiscalYear: 2026, monthNumber: 9 }]);
    expect(coveredMonths(at({ timeView: 'fy', baseVersion: 'LE' }), reference)).toHaveLength(12);
    expect(coveredMonths(at({ month: 11, timeView: 'month' }), reference)).toEqual([]);
  });
});

describe('monthState — open months per base version (C-01)', () => {
  const oct = { fiscalYear: 2026, monthNumber: 10 };
  it('Actual: open months are not selectable and carry the hint', () => {
    expect(monthState(oct, 'ACT', reference)).toEqual({ open: true, selectable: false, text: OPEN_MONTH_TEXT, hint: OPEN_MONTH_HINT });
    expect(OPEN_MONTH_TEXT).toBe('not closed yet');
    expect(OPEN_MONTH_HINT).toBe('Switch the base to Latest estimate to include forecast months.');
  });
  it('Latest estimate / Budget: open months are selectable with their source label', () => {
    expect(monthState(oct, 'LE', reference)).toEqual({ open: true, selectable: true, text: 'forecast' });
    expect(monthState(oct, 'BUD', reference)).toEqual({ open: true, selectable: true, text: 'budget' });
  });
  it('closed months are plain for every base; a month outside the reference counts as open', () => {
    for (const base of ['ACT', 'LE', 'BUD'] as const) {
      expect(monthState({ fiscalYear: 2026, monthNumber: 9 }, base, reference)).toEqual({ open: false });
    }
    expect(monthState({ fiscalYear: 2027, monthNumber: 1 }, 'ACT', reference).open).toBe(true);
  });
});

describe('labels', () => {
  it('time views carry plain labels in the panel order and the grid label follows the view', () => {
    expect(TIME_VIEW_OPTIONS.map((o) => o.label)).toEqual(['One month', 'Quarter to date', 'Year to date', 'Last 12 months', 'Full year']);
    expect(monthGridLabel('month')).toBe('Month');
    expect(monthGridLabel('qtd')).toBe('Up to');
    expect(monthGridLabel('ytd')).toBe('Up to');
    expect(monthGridLabel('ltm')).toBe('Ending');
    expect(monthGridLabel('fy')).toBeNull();
    expect(fiscalYears(reference)).toEqual([2024, 2025, 2026]);
  });
});
