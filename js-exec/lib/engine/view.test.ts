import { beforeAll, describe, expect, it } from 'vitest';
import { loadExecData } from '../test-utils/exec-data.ts';
import { windowWeeks } from './calendar.ts';
import type { ExecData } from './cube.ts';
import { computeMetrics } from './metrics.ts';
import { DEFAULT_SELECTION, NO_PICKS } from './url-state.ts';
import type { Selection } from './url-state.ts';
import { buildView } from './view.ts';

// ET-09 flow vs point in time, ET-11 status basis, ET-12 region switcher, ET-13 conceal semantics (E-54 … E-56), bars.

let d: ExecData;
beforeAll(async () => {
  d = await loadExecData();
});
const sel = (patch: Partial<Selection>): Selection => ({ ...DEFAULT_SELECTION, ...patch });
const near = (a: number | null | undefined, b: number | null | undefined, tol: number) =>
  Math.abs((a ?? NaN) - (b ?? NaN)) <= tol;

describe('ET-09 flow vs point in time', () => {
  it.each(['PTD', 'YTD'] as const)('%s: flow metrics sum the weeks, point-in-time ones equal the last week', (kind) => {
    const m = computeMetrics(d, 'ALL', kind, d.asOf);
    const weeks = windowWeeks(d, kind, d.asOf).map((w) => computeMetrics(d, 'ALL', 'W', w));
    const last = computeMetrics(d, 'ALL', 'W', d.asOf);
    const total = (key: string) => weeks.reduce((s, w) => s + (w[key] ?? 0), 0);
    for (const key of [
      'net_sales',
      'markdown',
      'gross_sales',
      'po_lines_due',
      'po_lines_otif',
      'lfl_net_sales',
      'ebitda',
    ])
      expect(near(m[key], total(key), 0.01)).toBe(true);
    for (const key of [
      'weeks_of_cover',
      'availability_pct',
      'gmroi',
      'sell_through_pct',
      'mix_store_pct',
      'mix_online_pct',
    ])
      expect(m[key]).toBe(last[key]);
  });

  it('EBITDA flash shows period to date whatever the period switcher says', () => {
    const value = (period: Selection['period']) =>
      buildView(d, sel({ period })).cards.find((c) => c.id === 'EBITDA')?.value;
    expect([value('week'), value('ptd'), value('ytd')]).toEqual(['€15.3', '€15.3', '€15.3']);
  });
});

describe('ET-11 status is always vs Budget / target', () => {
  it('Last year and Last week change every Δ row and no chip, count or dot', () => {
    const base = buildView(d, DEFAULT_SELECTION);
    for (const compare of ['ly', 'lw'] as const) {
      const v = buildView(d, sel({ compare }));
      expect(v.cards.map((c) => c.status)).toEqual(base.cards.map((c) => c.status));
      v.cards.forEach((c, i) => expect(c.delta).not.toBe(base.cards[i]?.delta));
      expect([v.status.counts, v.status.dot]).toEqual([base.status.counts, base.status.dot]);
    }
  });
});

describe('ET-12 region / format switcher', () => {
  it('NL + BE + Online + Wholesale = ALL net sales for every actual week', () => {
    for (let w = 0; w <= d.asOf; w++) {
      const all = computeMetrics(d, 'ALL', 'W', w);
      const parts = (['NL', 'BE', 'ONLINE'] as const).reduce(
        (s, sc) => s + (computeMetrics(d, sc, 'W', w).net_sales ?? 0),
        0,
      );
      expect(near(parts + (all.mix_wholesale_net_sales ?? 0), all.net_sales, 0.01)).toBe(true);
    }
  });

  it('Online only: Channel mix 0 / 100 / 0, Availability and LFL N/A, nothing concealed', () => {
    const v = buildView(d, sel({ region: 'online' }));
    const mix = v.cards.find((c) => c.id === 'CHANNEL_MIX');
    expect([mix?.value, mix?.unit, mix?.mix]).toEqual(['0.0', '% store', [0, 100, 0]]);
    expect(v.cards.filter((c) => c.status === 'na').map((c) => c.id)).toEqual(['AVAILABILITY', 'LFL_GROWTH']);
    expect(v.cards.every((c) => c.revealed)).toBe(true);
    expect([v.status.counts, v.status.dot]).toEqual([{ on: 8, watch: 0, off: 2 }, 'green']);
  });
});

describe('ET-13 conceal in place', () => {
  it('Group = B3 conceals exactly the 8 non-B3 cards; summary 4 of 12 · B3 stock & supply', () => {
    const v = buildView(d, sel({ picks: { ...NO_PICKS, group: ['B3'] } }));
    expect(v.cards.filter((c) => !c.revealed)).toHaveLength(8);
    expect(v.cards.filter((c) => c.revealed).map((c) => c.id)).toEqual([
      'AVAILABILITY',
      'SELL_THROUGH',
      'GMROI',
      'SUPPLIER_OTIF',
    ]);
    expect([v.status.shown, v.status.total, v.status.picks, v.status.picked]).toEqual([4, 12, 'B3 stock & supply', 1]);
  });

  it('OR within an attribute, AND across: (B1 or B4) and Sales → Net sales, LFL, Channel mix', () => {
    const v = buildView(d, sel({ picks: { ...NO_PICKS, group: ['B1', 'B4'], lever: ['sales'] } }));
    expect(v.cards.filter((c) => c.revealed).map((c) => c.id)).toEqual(['NET_SALES', 'LFL_GROWTH', 'CHANNEL_MIX']);
    expect(v.status.shown).toBe(3);
  });
});

describe('bars (E-29)', () => {
  it('13 weeks W31–W43, current last; Sell-through W31 N/A (before AW26, README open point 13); none on Channel mix', () => {
    const v = buildView(d, DEFAULT_SELECTION);
    const st = v.cards.find((c) => c.id === 'SELL_THROUGH')?.bars;
    expect(st?.labels).toEqual(Array.from({ length: 13 }, (_, i) => `W${31 + i}`));
    expect(st?.values[0]).toBeNull();
    expect(near(st?.values[12], 0.631038, 1e-6)).toBe(true);
    expect(st?.target).toBe(0.62);
    expect(v.cards.find((c) => c.id === 'CHANNEL_MIX')?.bars).toBeNull();
    expect(v.cards.filter((c) => c.bars).every((c) => c.bars?.values.length === 13)).toBe(true);
  });
});
