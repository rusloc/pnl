import { beforeAll, describe, expect, it } from 'vitest';
import { controlTotals, loadExecData } from '../test-utils/exec-data.ts';
import { dateRange, lwWeek, lyWeek, parsePeriodKey, periodKey, windowWeeks, weekRow } from './calendar.ts';
import type { ExecData } from './cube.ts';
import { computeMetrics } from './metrics.ts';
import { DEFAULT_SELECTION } from './url-state.ts';
import { buildView } from './view.ts';

// ET-04 calendar keys and windows; ET-05 LY joins on the week key, never on the date.

let d: ExecData;
beforeAll(async () => {
  d = await loadExecData();
});
const ix = (key: string) => d.weekIx.get(key) ?? -1;
const keys = (weeks: number[]) => weeks.map((w) => weekRow(d, w).week_key);

describe('ET-04 retail calendar', () => {
  it('104 weeks FY2025 W1 … FY2026 W52, 52 per year (no 53-week year), Mon–Sun', () => {
    expect(d.weeks).toHaveLength(104);
    expect([d.weeks[0]?.week_key, d.weeks.at(-1)?.week_key]).toEqual(['FY2025-W01', 'FY2026-W52']);
    expect(d.weeks.filter((w) => w.fy === 2025)).toHaveLength(52);
    expect(d.weeks.filter((w) => w.fy === 2026)).toHaveLength(52);
    for (const w of d.weeks) {
      expect(new Date(`${w.week_start}T00:00:00Z`).getUTCDay()).toBe(1);
      expect(new Date(`${w.week_end}T00:00:00Z`).getUTCDay()).toBe(0);
    }
    expect([d.weeks[0]?.week_start, d.weeks[52]?.week_start]).toEqual(['2024-12-30', '2025-12-29']);
  });

  it('as-of FY2026 W43 = 19–25 Oct 2026, P10 week 4 of 4; LY FY2025 W43 = 20–26 Oct 2025; LW FY2026 W42', () => {
    const w = weekRow(d, d.asOf);
    expect([w.week_key, w.week_start, w.week_end, w.period, w.week_of_period, w.weeks_in_period]).toEqual([
      'FY2026-W43',
      '2026-10-19',
      '2026-10-25',
      10,
      4,
      4,
    ]);
    const ly = lyWeek(d, d.asOf);
    expect(ly === null ? null : [weekRow(d, ly).week_key, weekRow(d, ly).week_start, weekRow(d, ly).week_end]).toEqual([
      'FY2025-W43',
      '2025-10-20',
      '2025-10-26',
    ]);
    expect(keys([lwWeek(d, d.asOf) ?? -1])).toEqual(['FY2026-W42']);
  });

  it('windows: Week = W43, Period to date = W40–W43 (28 Sep–25 Oct), Year to date = W1–W43 (from 29 Dec 2025)', () => {
    expect(keys(windowWeeks(d, 'W', d.asOf))).toEqual(['FY2026-W43']);
    expect(keys(windowWeeks(d, 'PTD', d.asOf))).toEqual(['FY2026-W40', 'FY2026-W41', 'FY2026-W42', 'FY2026-W43']);
    const ytd = windowWeeks(d, 'YTD', d.asOf);
    expect([ytd.length, keys(ytd)[0]]).toEqual([43, 'FY2026-W01']);
    expect(keys(windowWeeks(d, 'PTD', ix('FY2026-W42')))).toEqual(['FY2026-W40', 'FY2026-W41', 'FY2026-W42']);
    expect(dateRange('2026-09-28', '2026-10-25')).toBe('28 Sep–25 Oct 2026');
    expect(dateRange('2025-12-29', '2026-10-25')).toBe('29 Dec 2025–25 Oct 2026');
    expect(dateRange('2026-10-19', '2026-10-25')).toBe('19–25 Oct 2026');
  });

  it('every LY key is 364 days back and every LW key 7 days back (key join = same weekday, same week number)', () => {
    for (let i = 0; i < d.weeks.length; i++) {
      const start = Date.parse(`${weekRow(d, i).week_start}T00:00:00Z`);
      const ly = lyWeek(d, i);
      const lw = lwWeek(d, i);
      if (ly !== null) expect((start - Date.parse(`${weekRow(d, ly).week_start}T00:00:00Z`)) / 864e5).toBe(364);
      if (lw !== null) expect((start - Date.parse(`${weekRow(d, lw).week_start}T00:00:00Z`)) / 864e5).toBe(7);
      expect(ly === null).toBe(weekRow(d, i).fy === 2025);
    }
  });

  it('period keys round-trip (W / PTD / YTD)', () => {
    for (const key of ['W-FY2026-43', 'PTD-FY2026-42', 'YTD-FY2025-43']) {
      const p = parsePeriodKey(d, key);
      expect(p && periodKey(d, p.kind, p.asOf)).toBe(key);
    }
    expect(parsePeriodKey(d, 'P-FY2026-10')).toBeNull();
  });
});

describe('ET-05 LY by week key, not by date', () => {
  it('19 Oct 2025 (date − 1 year) sits in FY2025 W42, but the LY of FY2026 W43 is FY2025 W43', () => {
    const w42 = weekRow(d, ix('FY2025-W42'));
    expect('2025-10-19' >= w42.week_start && '2025-10-19' <= w42.week_end).toBe(true);
    expect(keys([lyWeek(d, d.asOf) ?? -1])).toEqual(['FY2025-W43']);
  });

  it('the LY comparator reads the key-joined week (control total W-FY2025-43), not the date-joined one', () => {
    const ct = new Map(controlTotals().map((r) => [`${r.scope}|${r.periodKey}|${r.metric}`, r.value]));
    const lyNet = computeMetrics(d, 'ALL', 'W', lyWeek(d, d.asOf) ?? -1).net_sales ?? NaN;
    expect(Math.abs(lyNet - (ct.get('ALL|W-FY2025-43|net_sales') ?? NaN))).toBeLessThan(0.0051);
    expect(Math.abs(lyNet - (ct.get('ALL|W-FY2025-42|net_sales') ?? NaN))).toBeGreaterThan(1e5);
    const card = buildView(d, { ...DEFAULT_SELECTION, compare: 'ly' }).cards.find((c) => c.id === 'NET_SALES');
    expect(card?.delta).toBe('+€2.2m (+3.8%) vs LY');
  });
});
