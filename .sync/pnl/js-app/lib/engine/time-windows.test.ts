import { beforeAll, describe, expect, it } from 'vitest';
import type { Manifest } from '../data/manifest.ts';
import { loadPublicDataset } from '../test-utils/public-data.ts';
import { resolveWindow } from './time-windows.ts';

// Spec §7 time windows; month index 0 = Jan 2024.
let dimMonth: Manifest['tables']['dim_month'];
beforeAll(async () => {
  dimMonth = (await loadPublicDataset(['P'])).manifest.tables.dim_month;
});

describe('resolveWindow', () => {
  it.each([
    ['MTD', 2026, 9, [32], 0],
    ['QTD', 2026, 8, [30, 31], 0],
    ['QTD', 2026, 9, [30, 31, 32], 0],
    ['YTD', 2026, 9, [24, 25, 26, 27, 28, 29, 30, 31, 32], 0],
    ['FY', 2025, 3, [12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23], 0],
    ['LTM', 2025, 6, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17], 0], // crosses fiscal years
    ['LTM', 2024, 2, [0, 1], 10], // starts before the data history
  ] as const)('%s FY%i month %i', (timeView, fy, month, months, before) => {
    expect(resolveWindow(dimMonth, timeView, fy, month)).toEqual({ months, monthsBeforeHistory: before });
  });

  it('rejects a month outside dim_month', () => {
    expect(() => resolveWindow(dimMonth, 'YTD', 2023, 1)).toThrow(/no month 1 in FY2023/);
  });
});
