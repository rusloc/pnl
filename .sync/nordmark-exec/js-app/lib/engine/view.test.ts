import { beforeAll, describe, expect, it } from 'vitest';
import { loadExecData } from '../test-utils/exec-data.ts';
import type { ExecData } from './cube.ts';
import { ATTRIBUTES, SIDEBAR_TIPS } from './copy.ts';
import { catalog } from './items.ts';
import { computeMetrics } from './metrics.ts';
import { DEFAULT_SELECTION, NO_PICKS, parseSelection } from './url-state.ts';
import type { Selection } from './url-state.ts';
import { buildView } from './view.ts';

// ET-11 status basis, ET-12 region switcher, ET-13 conceal semantics (E-54 … E-56), bars. ET-09 per granularity and the
// EBITDA flash per granularity (ET-27): period-model.test.ts.

let d: ExecData;
beforeAll(async () => {
  d = await loadExecData();
});
const sel = (patch: Partial<Selection>): Selection => ({ ...DEFAULT_SELECTION, ...patch });
const near = (a: number | null | undefined, b: number | null | undefined, tol: number) =>
  Math.abs((a ?? NaN) - (b ?? NaN)) <= tol;

describe('ET-11 status is always vs Budget / target', () => {
  it('Last year and Previous change every Δ row and no chip, count or dot', () => {
    const base = buildView(d, DEFAULT_SELECTION);
    for (const compare of ['ly', 'prev'] as const) {
      const v = buildView(d, sel({ compare }));
      expect(v.cards.map((c) => c.status)).toEqual(base.cards.map((c) => c.status));
      v.cards.forEach((c, i) => expect(c.delta).not.toBe(base.cards[i]?.delta));
      expect([v.status.counts, v.status.dot]).toEqual([base.status.counts, base.status.dot]);
    }
  });
});

describe('ⓘ target line is the status basis (USER 2026-10-29, E-24)', () => {
  it('Last year and Previous change the Δ row, never the target line', () => {
    const base = buildView(d, DEFAULT_SELECTION).cards.map((c) => c.target);
    for (const compare of ['ly', 'prev'] as const)
      expect(buildView(d, sel({ compare })).cards.map((c) => c.target)).toEqual(base);
  });

  it('a blank basis reads n/a, the label stays (Online only: LFL has no budget)', () => {
    const v = buildView(d, sel({ region: 'online' }));
    const target = (id: string) => v.cards.find((c) => c.id === id)?.target;
    expect(target('LFL_GROWTH')).toEqual({ label: 'Budget', value: 'n/a', unit: '' });
    expect(target('AVAILABILITY')).toEqual({ label: 'Target', value: '97.0', unit: '%' }); // value n/a, target known
    expect(v.cards.every((c) => c.target !== null)).toBe(true);
  });
});

describe('ET-12 region / format switcher', () => {
  it('NL + BE + Online + Wholesale = ALL net sales for every actual week', () => {
    for (let w = 0; w <= d.asOf; w++) {
      const all = computeMetrics(d, 'ALL', { gran: 'W', weeks: [w] });
      const parts = (['NL', 'BE', 'ONLINE'] as const).reduce(
        (s, sc) => s + (computeMetrics(d, sc, { gran: 'W', weeks: [w] }).net_sales ?? 0),
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

describe('Statement and Horizon attributes and the Notes pop-up removed (USER 2026-10-29)', () => {
  it('Filters attributes are Group · Lever · Owner; the ⓘ tags follow', () => {
    expect(ATTRIBUTES.map((a) => a.label)).toEqual(['Group', 'Lever', 'Owner']);
    for (const c of buildView(d, DEFAULT_SELECTION).cards)
      expect(c.explain.tags.map(([label]) => label)).toEqual(['Group', 'Lever', 'Owner']);
  });

  it('an old link with statement= or horizon= conceals nothing and adds nothing to the badge', () => {
    for (const q of ['statement=bs', 'horizon=week'])
      expect(buildView(d, parseSelection(new URLSearchParams(q), catalog(d))).status).toMatchObject({
        shown: 12,
        picked: 0,
        picks: 'All',
      });
  });

  it('period-neutral ⓘ copy (USER 2026-10-30): no owner note, no "this week"; "Period" only as a name, never as copy', () => {
    for (const item of [null, 'FY2026-P10', 'FY2026-Q4', 'FY2026']) {
      const v = buildView(d, { ...DEFAULT_SELECTION, item });
      for (const c of v.cards) {
        expect(c.explain.rows.map(([k]) => k)).toEqual([
          'What it is',
          'Why it matters',
          'Formula',
          'Worked example',
          'Status rule',
        ]);
        const all = JSON.stringify([c.explain, c.sub, c.delta, c.drill]);
        expect(all).not.toMatch(/this week|week’s|\bperiod \d|Period \d/);
      }
      expect(JSON.stringify([v.header, v.how, v.menu.showing])).not.toMatch(/\b[Pp]eriod \d/);
    }
  });

  it('ⓘ footer: no "Target …" left (the basis sits under the value); the refresh / provisional note stays', () => {
    const v = buildView(d, DEFAULT_SELECTION);
    expect(v.cards.map((c) => c.explain.updated)).toEqual([
      'Updated Mon 05:12',
      'Provisional · true-up 10 Nov',
      'Updated Mon 05:12',
      'Updated Mon 05:12',
      'Updated Mon 05:12',
      'Provisional · weekly flash',
      'Updated Mon 05:12',
      'Updated Mon 05:12',
      'Updated weekly',
      'Updated weekly',
      'Updated Mon 05:12',
      'Updated Mon 05:12',
    ]);
    expect(JSON.stringify(v.cards.map((c) => c.explain))).not.toMatch(/Target (budget|≥|plan mix)/);
  });

  it('no Notes: no view model, no side-bar tooltip, not named in How to read', () => {
    const v = buildView(d, DEFAULT_SELECTION);
    expect('notes' in v).toBe(false);
    expect(Object.keys(SIDEBAR_TIPS)).toEqual(['filters', 'how', 'more', 'explain', 'drill']);
    const how = v.how.bullets.map((r) => r.map((x) => x.text).join('')).join(' ');
    expect(how).not.toMatch(/Notes/);
    expect(how).toContain('How to read, More KPIs (the 20 bench metrics, inactive).');
  });
});
