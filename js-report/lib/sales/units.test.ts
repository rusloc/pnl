import { describe, expect, it } from 'vitest';
import { fmtCount, fmtDeltaPct, fmtEur, fmtEur0, fmtEurDelta, fmtHours, fmtPct, fmtPp } from './format.ts';
import { attainmentStatus, cmpRow, deltaOf, statusOf } from './status.ts';
import { axisLabel, monthIndex, monthKey, monthLabel, windowLabel, windowOf } from './windows.ts';

describe('windows (layout-spec §6 period picker)', () => {
  const sep26 = monthIndex('2026-09');
  it('indexes months from Jan 2024', () => {
    expect(monthIndex('2024-01')).toBe(0);
    expect(sep26).toBe(32);
    expect(monthKey(32)).toBe('2026-09');
    expect(monthKey(-1)).toBe('2023-12');
    expect(() => monthIndex('2026-13')).toThrow();
  });
  it('builds Month / QTD / YTD / R12M windows on the anchor', () => {
    expect(windowOf('M', sep26)).toEqual({ start: 32, end: 32 });
    expect(windowOf('Q', sep26)).toEqual({ start: monthIndex('2026-07'), end: 32 });
    expect(windowOf('Q', monthIndex('2026-07'))).toEqual({ start: monthIndex('2026-07'), end: monthIndex('2026-07') });
    expect(windowOf('Y', sep26)).toEqual({ start: monthIndex('2026-01'), end: 32 });
    expect(windowOf('R', sep26)).toEqual({ start: monthIndex('2025-10'), end: 32 });
  });
  it('labels windows and axes', () => {
    expect(monthLabel(sep26)).toBe('Sep 2026');
    expect(windowLabel(windowOf('Q', sep26))).toBe('Jul–Sep 2026');
    expect(windowLabel(windowOf('R', sep26))).toBe('Oct 2025–Sep 2026');
    expect(axisLabel(monthIndex('2026-01'))).toBe('Jan 26');
    expect(axisLabel(sep26)).toBe('Sep');
  });
});

describe('number formats (design-tokens §8)', () => {
  it('counts, money, ratios, deltas', () => {
    expect(fmtCount(24_410)).toBe('24.4k');
    expect(fmtCount(9_796)).toBe('9,796');
    expect(fmtCount(null)).toBe('n/a');
    expect(fmtEur(9_590_000)).toBe('€9.6m');
    expect(fmtEur(580_400)).toBe('€580k');
    expect(fmtEur0(398.4)).toBe('€398');
    expect(fmtEurDelta(-360_000)).toBe('−€0.36m');
    expect(fmtEurDelta(24_000)).toBe('+€24k');
    expect(fmtPct(0.5994)).toBe('59.9%');
    expect(fmtDeltaPct(-0.024)).toBe('−2.4%');
    expect(fmtDeltaPct(0.164)).toBe('+16.4%');
    expect(fmtDeltaPct(-0.00001)).toBe('0.0%'); // no "−0.0"
    expect(fmtPp(0.029)).toBe('+2.9pp');
    expect(fmtHours(3.45)).toBe('3.5 h');
  });
});

describe('status rules (design-tokens §6)', () => {
  it('bands counts, ratios, risk and hours', () => {
    expect(statusOf('countUp', 0.01)).toBe('good');
    expect(statusOf('countUp', -0.024)).toBe('watch');
    expect(statusOf('countUp', -0.12)).toBe('off');
    expect(statusOf('ratioUp', -0.019)).toBe('watch');
    expect(statusOf('riskDown', 0.006)).toBe('off');
    expect(statusOf('riskDown', 0.004)).toBe('watch');
    expect(statusOf('riskDown', -0.001)).toBe('good');
    expect(statusOf('hoursDown', -1.7)).toBe('good');
    expect(statusOf('neutralPct', 0.5)).toBe('neutral');
  });
  it('builds comparator rows with glyph = direction and the bar on the favourable side', () => {
    const risk = cmpRow('riskDown', 'vs Budget', 0.046, 0.04, true);
    expect(risk.text).toBe('▲ +0.6pp');
    expect(risk.status).toBe('off');
    expect(risk.bar?.side).toBe('left');
    const up = cmpRow('countUp', 'vs PY', 116.4, 100, true);
    expect(up.text).toBe('▲ +16.4%');
    expect(up.bar).toEqual({ side: 'right', size: expect.closeTo(0.82, 5), capped: false });
    expect(cmpRow('ratioUp', 'vs Budget', 0.5, null)).toEqual({
      label: 'vs Budget',
      text: 'n/a',
      status: 'neutral',
      bar: null,
    });
    expect(deltaOf('countUp', 5, 0)).toBeNull();
  });
  it('reads the absolute attainment band from param_thresholds', () => {
    const t = [
      {
        threshold_set: 'KPI_STATUS',
        metric_code: 'attainment_pct',
        band_code: 'RED',
        min_value: 0,
        max_value: 0.95,
        label: '',
        sort_order: 1,
      },
      {
        threshold_set: 'KPI_STATUS',
        metric_code: 'attainment_pct',
        band_code: 'AMBER',
        min_value: 0.95,
        max_value: 1,
        label: '',
        sort_order: 2,
      },
      {
        threshold_set: 'KPI_STATUS',
        metric_code: 'attainment_pct',
        band_code: 'GREEN',
        min_value: 1,
        max_value: null,
        label: '',
        sort_order: 3,
      },
    ];
    expect(attainmentStatus(1.02, t)).toBe('good');
    expect(attainmentStatus(0.97, t)).toBe('watch');
    expect(attainmentStatus(0.9, t)).toBe('off');
    expect(attainmentStatus(null, t)).toBe('neutral');
  });
});

describe('status bands the displayed Δ (MS-07)', () => {
  it('a Δ that shows as 0.0 % / 0.0 pp is on plan, not a miss', () => {
    const r = cmpRow('countUp', 'vs Budget', 99.96, 100);
    expect(r.text).toBe('◦ 0.0%');
    expect(r.status).toBe('good');
    expect(cmpRow('riskDown', 'vs Budget', 0.04004, 0.04).status).toBe('good');
    expect(cmpRow('countUp', 'vs Budget', 94.96, 100).status).toBe('watch'); // −5.04 % shows −5.0 %: still watch
    expect(cmpRow('countUp', 'vs Budget', 94.94, 100).status).toBe('off'); // −5.06 % shows −5.1 %: off
  });
});
