import { beforeAll, describe, expect, it } from 'vitest';
import { controlTotals, loadExecData, tolerance } from '../test-utils/exec-data.ts';
import { weekRow } from './calendar.ts';
import type { ExecData } from './cube.ts';
import { catalog, lyWindow, parseItemKey, prevMonthToDate, prevWindow, seriesOf, toDate } from './items.ts';
import type { Catalog, Item, Window } from './items.ts';
import { computeMetrics } from './metrics.ts';
import { DEFAULT_SELECTION, parseSelection, serializeSelection } from './url-state.ts';
import type { Selection } from './url-state.ts';
import { buildView, dotView } from './view.ts';
import type { CardView, DashboardView } from './view.ts';

// Period model (ADR-0013 (k), E-90 … E-99, exec-period-model.md, USER answers 2026-10-29): ET-21 item lists, ET-22
// default unchanged, ET-23 comparators, ET-25 bars, ET-26 N/A, ET-27 EBITDA, ET-28 URL state, plus the labels (E-98).

let d: ExecData;
let cat: Catalog;
const ct = new Map(controlTotals().map((r) => [`${r.scope}|${r.periodKey}|${r.metric}`, r.value]));
beforeAll(async () => {
  d = await loadExecData();
  cat = catalog(d);
});

const item = (key: string): Item => {
  const x = cat.byKey.get(key);
  if (!x) throw new Error(`no item ${key}`);
  return x;
};
const keys = (w: Window | null) => w?.weeks.map((i) => weekRow(d, i).week_key) ?? null;
const view = (patch: Partial<Selection>): DashboardView => buildView(d, { ...DEFAULT_SELECTION, ...patch });
const cardOf = (v: DashboardView, id: string): CardView => {
  const c = v.cards.find((x) => x.id === id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};
const text = (r: readonly { text: string }[]) => r.map((x) => x.text).join('');
const csv = (key: string, metric: string, scope = 'ALL') => ct.get(`${scope}|${key}|${metric}`);
const close = (a: number | null | undefined, b: number | undefined, metric: string) =>
  a !== null && a !== undefined && b !== undefined && Math.abs(a - b) <= tolerance(metric);
const parse = (q: string) => parseSelection(new URLSearchParams(q), cat);

describe('ET-21 item lists from dim_week', () => {
  it('95 weeks, 22 periods, 8 quarters, 2 years, in calendar order; no item without an actual week', () => {
    const list = (g: keyof Catalog['items']) => cat.items[g].map((x) => x.key);
    expect([list('W').length, list('P').length, list('Q').length, list('FY').length]).toEqual([95, 22, 8, 2]);
    expect([list('W')[0], list('W').at(-1), list('P')[0], list('P').at(-1)]).toEqual([
      'FY2025-W01',
      'FY2026-W43',
      'FY2025-P01',
      'FY2026-P10',
    ]);
    expect(list('Q')).toEqual([
      'FY2025-Q1',
      'FY2025-Q2',
      'FY2025-Q3',
      'FY2025-Q4',
      'FY2026-Q1',
      'FY2026-Q2',
      'FY2026-Q3',
      'FY2026-Q4',
    ]);
    expect(list('FY')).toEqual(['FY2025', 'FY2026']);
    for (const k of ['FY2026-W44', 'FY2026-P11', 'FY2026-P12']) expect(cat.byKey.has(k)).toBe(false);
  });

  it('exactly Q4 FY2026 and FY2026 are partial; P10 FY2026 is complete (W40–W43 = 4 of 4)', () => {
    expect([...cat.byKey.values()].filter((x) => x.partial).map((x) => x.key)).toEqual(['FY2026-Q4', 'FY2026']);
    const p10 = item('FY2026-P10');
    expect([keys(p10), p10.size, p10.partial]).toEqual([
      ['FY2026-W40', 'FY2026-W41', 'FY2026-W42', 'FY2026-W43'],
      4,
      false,
    ]);
    expect([item('FY2026-Q4').weeks.length, item('FY2026-Q4').size, item('FY2026').weeks.length]).toEqual([4, 13, 43]);
  });

  it('quarters are 13 weeks = three 4-5-4 periods; years are 52 weeks', () => {
    for (const q of cat.items.Q.filter((x) => !x.partial)) {
      expect(q.size).toBe(13);
      const periods = new Set(q.weeks.map((i) => weekRow(d, i).period));
      expect([...periods]).toEqual([3 * q.n - 2, 3 * q.n - 1, 3 * q.n]);
    }
    expect(item('FY2025').size).toBe(52);
  });

  it('control-total keys (E-99): whole item ∩ actuals, @k = first k weeks; unknown items and bad k are null', () => {
    expect(keys(parseItemKey(d, 'W-FY2026-43'))).toEqual(['FY2026-W43']);
    expect(keys(parseItemKey(d, 'P-FY2026-10'))).toEqual(keys(item('FY2026-P10')));
    expect(keys(parseItemKey(d, 'Q-FY2026-4'))).toEqual(keys(item('FY2026-P10')));
    expect(keys(parseItemKey(d, 'Q-FY2026-3@4'))).toEqual(['FY2026-W27', 'FY2026-W28', 'FY2026-W29', 'FY2026-W30']);
    expect(parseItemKey(d, 'FY-FY2025@43')?.weeks).toHaveLength(43);
    for (const bad of ['P-FY2026-11', 'FY-FY2026-1', 'Q-FY2026', 'Q-FY2026-4@5', 'W-FY2024-43', 'PTD-FY2026-43'])
      expect(parseItemKey(d, bad)).toBeNull();
  });

  it('to date (stats, EBITDA at Week): period / quarter / year from its start through the week', () => {
    const w42 = d.weekIx.get('FY2026-W42') ?? -1;
    expect(keys(toDate(d, 'P', w42))).toEqual(['FY2026-W40', 'FY2026-W41', 'FY2026-W42']);
    expect(toDate(d, 'Q', w42).weeks).toHaveLength(3);
    expect(toDate(d, 'FY', d.asOf).weeks).toHaveLength(43);
  });
});

describe('ET-22 default unchanged', () => {
  it('opens on Week · FY2026 · W43 vs Budget; header and How-to-read title as before', () => {
    const v = view({});
    expect([text(v.header.period), text(v.header.compare), v.how.eyebrow]).toEqual([
      'Week 43 · 19–25 Oct 2026',
      'vs Budget',
      'Nordmark · Week 43',
    ]);
    const on = (chips: readonly { label: string; checked: boolean }[] | null) =>
      chips?.filter((c) => c.checked).map((c) => c.label);
    expect([on(v.menu.granularity), on(v.menu.fy), on(v.menu.items)]).toEqual([['Week'], ['FY2026'], ['W43']]);
    expect([v.status.counts, v.status.dot]).toEqual([{ on: 7, watch: 3, off: 2 }, 'orange']);
    expect(text(v.menu.showing)).toBe(text(v.header.period));
  });
});

describe('ET-23 comparators per granularity', () => {
  it('P10: LY = P-FY2025-10, Previous = P-FY2026-09 (whole items)', () => {
    expect(keys(lyWindow(d, item('FY2026-P10')))).toEqual(keys(parseItemKey(d, 'P-FY2025-10')));
    expect(keys(prevWindow(d, item('FY2026-P10')))).toEqual(keys(parseItemKey(d, 'P-FY2026-09')));
  });

  it('Q4 to date: LY = Q-FY2025-4@4, Previous = Q-FY2026-3@4 (like-length, USER answer 2)', () => {
    expect(keys(lyWindow(d, item('FY2026-Q4')))).toEqual(keys(parseItemKey(d, 'Q-FY2025-4@4')));
    expect(keys(prevWindow(d, item('FY2026-Q4')))).toEqual(keys(parseItemKey(d, 'Q-FY2026-3@4')));
  });

  it('FY2026 to date: LY and the previous year are both FY-FY2025@43', () => {
    const want = keys(parseItemKey(d, 'FY-FY2025@43'));
    expect([keys(lyWindow(d, item('FY2026'))), keys(prevWindow(d, item('FY2026')))]).toEqual([want, want]);
  });

  it('a complete item compares with the whole previous item, even of another length (P3 4 wks vs P2 5 wks)', () => {
    expect([item('FY2026-P03').weeks.length, prevWindow(d, item('FY2026-P03'))?.weeks.length]).toEqual([4, 5]);
    expect(keys(prevWindow(d, item('FY2026-P01')))).toEqual(keys(item('FY2025-P12')));
    expect(keys(prevWindow(d, item('FY2026-W01')))).toEqual(['FY2025-W52']);
  });

  it('FY2025: no Last year for any item; no Previous for the first item of each granularity', () => {
    for (const x of cat.byKey.values()) if (x.fy === 2025) expect(lyWindow(d, x)).toBeNull();
    for (const k of ['FY2025-W01', 'FY2025-P01', 'FY2025-Q1', 'FY2025']) expect(prevWindow(d, item(k))).toBeNull();
    for (const c of view({ item: 'FY2025-P10', compare: 'ly' }).cards) expect(c.delta.startsWith('n/a vs')).toBe(true);
  });

  it('the Δ rows read the comparator windows (P10 Net sales vs LY = P-FY2025-10)', () => {
    const net = (k: string) => csv(k, 'net_sales') ?? NaN;
    const pctOf = (a: number, b: number) => `${a >= b ? '+' : '−'}${(Math.abs(a / b - 1) * 100).toFixed(1)}%`;
    expect(cardOf(view({ item: 'FY2026-P10', compare: 'ly' }), 'NET_SALES').delta).toContain(
      `(${pctOf(net('P-FY2026-10'), net('P-FY2025-10'))}) vs LY`,
    );
    expect(cardOf(view({ item: 'FY2026-Q4', compare: 'prev' }), 'NET_SALES').delta).toContain(
      `(${pctOf(net('Q-FY2026-4'), net('Q-FY2026-3@4'))}) vs prev. qtr`,
    );
  });

  it('Year offers Budget and Last year only; picking Year on Previous snaps to Last year', () => {
    expect(view({ item: 'FY2026' }).menu.compare.map((c) => c.id)).toEqual(['budget', 'ly']);
    expect(view({ item: 'FY2026-Q4' }).menu.compare.map((c) => c.id)).toEqual(['budget', 'ly', 'prev']);
    const year = view({ compare: 'prev' }).menu.granularity.find((c) => c.id === 'FY');
    expect([year?.next.item, year?.next.compare]).toEqual(['FY2026', 'ly']);
  });

  it('status stays vs Budget / target under every comparator (E-24) at Month, Quarter and Year', () => {
    for (const k of ['FY2026-P10', 'FY2026-Q4', 'FY2026']) {
      const base = view({ item: k });
      for (const compare of ['ly', 'prev'] as const) {
        const v = view({ item: k, compare });
        expect(v.cards.map((c) => c.status)).toEqual(base.cards.map((c) => c.status));
        expect(v.cards.map((c) => c.target)).toEqual(base.cards.map((c) => c.target));
      }
    }
  });
});

describe('ET-09 (amended) and USER answer 5: aggregation per granularity', () => {
  it.each(['FY2026-P10', 'FY2026-Q3', 'FY2026'])('%s: flow sums the weeks, point in time = the last week', (k) => {
    const x = item(k);
    const m = computeMetrics(d, 'ALL', x);
    const weeks = x.weeks.map((w) => computeMetrics(d, 'ALL', { gran: 'W', weeks: [w] }));
    const last = computeMetrics(d, 'ALL', { gran: 'W', weeks: [x.last] });
    const total = (key: string) => weeks.reduce((s, w) => s + (w[key] ?? 0), 0);
    // channel mix is a window share at Month / Quarter / Year (USER 2026-10-29), not the exit mix
    for (const key of ['net_sales', 'markdown', 'po_lines_due', 'lfl_net_sales', 'ebitda', 'mix_store_net_sales'])
      expect(Math.abs((m[key] ?? NaN) - total(key))).toBeLessThan(0.01);
    expect(m.mix_store_pct).toBeCloseTo(total('mix_store_net_sales') / total('net_sales'), 12);
    for (const key of ['weeks_of_cover', 'availability_pct', 'gmroi', 'sell_through_pct'])
      expect(m[key]).toBe(last[key]);
  });

  it('Week: channel mix is the week itself (unchanged)', () => {
    expect(cardOf(view({}), 'CHANNEL_MIX').value).toBe('68.4');
  });
});

describe('ET-25 bars per granularity', () => {
  const bars = (k: string, id: string) => cardOf(view({ item: k }), id).bars;

  it('W43: 13 weeks W31–W43; a non-default week W20: W8–W20', () => {
    expect(bars('FY2026-W43', 'NET_SALES')?.labels).toEqual(Array.from({ length: 13 }, (_, i) => `W${31 + i}`));
    expect(bars('FY2026-W20', 'NET_SALES')?.labels).toEqual(Array.from({ length: 13 }, (_, i) => `W${8 + i}`));
  });

  it('P10: 12 periods P11 FY2025 … P10 FY2026; values = the P- control rows; target = P10 budget', () => {
    const b = bars('FY2026-P10', 'NET_SALES');
    const pks = [11, 12]
      .map((n) => `P-FY2025-${n}`)
      .concat(Array.from({ length: 10 }, (_, i) => `P-FY2026-${String(i + 1).padStart(2, '0')}`));
    expect(b?.labels).toEqual(['P11', 'P12', 'P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7', 'P8', 'P9', 'P10']);
    b?.values.forEach((v, i) => expect(close(v, csv(pks[i] ?? '', 'net_sales'), 'net_sales')).toBe(true));
    expect(close(b?.target, csv('P-FY2026-10', 'net_sales_bud'), 'net_sales_bud')).toBe(true);
  });

  it('Q4: 8 quarters Q1 FY25 … Q4 FY26, the last = the to-date value; FY2026: 2 years', () => {
    const b = bars('FY2026-Q4', 'NET_SALES');
    expect(b?.labels).toEqual(['Q1 FY25', 'Q2 FY25', 'Q3 FY25', 'Q4 FY25', 'Q1 FY26', 'Q2 FY26', 'Q3 FY26', 'Q4 FY26']);
    expect(close(b?.values.at(-1), csv('Q-FY2026-4', 'net_sales'), 'net_sales')).toBe(true);
    const y = bars('FY2026', 'NET_SALES');
    expect([y?.labels, y?.values.length]).toEqual([['FY25', 'FY26'], 2]);
    expect(close(y?.values[0], csv('FY-FY2025', 'net_sales'), 'net_sales')).toBe(true);
  });

  it('no history = blank bar, label kept: GMROI before FY2025 W52, LFL in FY2025, Sell-through outside a season', () => {
    const blank = (b: CardView['bars']) => b?.values.map((v) => v === null);
    expect(blank(bars('FY2026-Q4', 'GMROI'))).toEqual([true, true, true, false, false, false, false, false]);
    expect(blank(bars('FY2026-Q4', 'LFL_GROWTH'))).toEqual([true, true, true, true, false, false, false, false]);
    expect(blank(bars('FY2026-Q4', 'SELL_THROUGH'))).toEqual([true, true, false, true, true, true, false, false]);
    const early = seriesOf(d, item('FY2025-Q1'));
    expect([early.labels[0], early.items.filter((x) => x === null).length]).toEqual(['Q2 FY23', 7]);
  });

  it('every card with bars has the granularity count (13 · 12 · 8 · 2); none on Channel mix', () => {
    for (const [k, n] of [
      ['FY2026-W43', 13],
      ['FY2026-P10', 12],
      ['FY2026-Q4', 8],
      ['FY2026', 2],
    ] as const) {
      const v = view({ item: k });
      expect(v.cards.filter((c) => c.bars).every((c) => c.bars?.values.length === n)).toBe(true);
      expect(cardOf(v, 'CHANNEL_MIX').bars).toBeNull();
    }
  });
});

describe('ET-26 N/A rendering', () => {
  const BUDGET_CARDS = ['NET_SALES', 'TOTAL_MARGIN', 'MARKDOWN', 'EBITDA', 'LFL_GROWTH', 'FRONT_GM', 'CHANNEL_MIX'];

  it('FY2025 P10: the 7 budget-based cards N/A ("–", muted n/a Δ); target cards rated, GMROI N/A until FY2025 W52', () => {
    const v = view({ item: 'FY2025-P10' });
    for (const id of BUDGET_CARDS) {
      const c = cardOf(v, id);
      expect([c.status, c.glyph, c.word, c.delta.startsWith('n/a vs')]).toEqual(['na', '–', 'N/A', true]);
    }
    // exec-period-model.md §4 #10: GMROI = R52W, N/A before FY2025 W52 → 4 rated here, not the 5 of the ET-26 text
    expect(v.cards.filter((c) => c.status !== 'na').map((c) => c.id)).toEqual([
      'WEEKS_OF_COVER',
      'AVAILABILITY',
      'SELL_THROUGH',
      'SUPPLIER_OTIF',
    ]);
    const { on, watch, off } = v.status.counts;
    expect(on + watch + off).toBe(4);
    expect(v.status.dotTip[1]).toContain('the 4 cards with a status (N/A excluded)');
  });

  it('FY2025 Q1: GMROI and Sell-through N/A too, 3 rated, the dot still renders; FY2025: GMROI rated (L = W52)', () => {
    const q1 = view({ item: 'FY2025-Q1' });
    expect(q1.cards.filter((c) => c.status !== 'na').map((c) => c.id)).toEqual([
      'WEEKS_OF_COVER',
      'AVAILABILITY',
      'SUPPLIER_OTIF',
    ]);
    expect(q1.status.dot).not.toBe('grey');
    const fy = view({ item: 'FY2025' });
    expect(fy.cards.filter((c) => c.status !== 'na').map((c) => c.id)).toEqual([
      'WEEKS_OF_COVER',
      'AVAILABILITY',
      'GMROI',
      'SUPPLIER_OTIF',
    ]);
    expect(fy.status.counts.on + fy.status.counts.watch + fy.status.counts.off).toBe(
      (csv('FY-FY2025', 'status.count_on') ?? NaN) + (csv('FY-FY2025', 'status.count_watch') ?? NaN),
    );
  });

  it('no rated card → grey dot, "no rated card"', () => {
    expect(dotView({ on: 0, watch: 0, off: 0 }, undefined)).toEqual({
      dot: 'grey',
      dotTip: ['Overall: grey', ' · no rated card.'],
    });
  });
});

describe('ET-27 EBITDA per granularity', () => {
  const eb = (k: string) => cardOf(view({ item: k }), 'EBITDA');

  it('W43 and P10 show €15.3m: "month 10 to date" vs "month 10"; Q4 to date = P10; FY2026 = the YTD EBITDA', () => {
    expect([eb('FY2026-W43').value, eb('FY2026-W43').sub]).toEqual(['€15.3', 'month 10 to date · prov.']);
    expect([eb('FY2026-P10').value, eb('FY2026-P10').sub]).toEqual(['€15.3', 'month 10 · prov.']);
    expect([eb('FY2026-Q4').value, eb('FY2026-Q4').sub]).toEqual(['€15.3', 'quarter 4 to date · prov.']);
    expect(eb('FY2026').sub).toBe('FY2026 to date · prov.');
    expect(`${eb('FY2026').value}m`).toBe(`€${((csv('FY-FY2026', 'ebitda') ?? NaN) / 1e6).toFixed(1)}m`);
  });

  it('Week 41 reads month 10 to date through W41 (W40–W41)', () => {
    const w = computeMetrics(d, 'ALL', toDate(d, 'P', d.weekIx.get('FY2026-W41') ?? -1));
    expect(eb('FY2026-W41').value).toBe(`€${((w.ebitda ?? NaN) / 1e6).toFixed(1)}`);
  });

  it('Week vs Previous = the previous month cut to the same weeks (USER 2026-10-30); card Δ short, ⓘ Δ names it', () => {
    const at = (week: string) => d.weekIx.get(week) ?? -1;
    const pm = (week: string) => prevMonthToDate(d, at(week));
    expect(keys(pm('FY2026-W43')?.win ?? null)).toEqual(keys(parseItemKey(d, 'P-FY2026-09@4')));
    expect(keys(pm('FY2026-W41')?.win ?? null)).toEqual(keys(parseItemKey(d, 'P-FY2026-09@2')));
    expect(keys(pm('FY2026-W01')?.win ?? null)).toEqual(['FY2025-W49']); // P1 crosses to P12 FY2025, week 1
    expect(pm('FY2025-W03')).toBeNull(); // first month of the data
    // week 5 of a 5-week month: the previous month has 4 weeks → N/A, muted "n/a vs prev. mth" (ruling 2026-10-30)
    for (const w of ['FY2026-W09', 'FY2026-W22', 'FY2026-W35', 'FY2025-W48']) expect(pm(w)).toBeNull();
    const w35 = cardOf(view({ item: 'FY2026-W35', compare: 'prev' }), 'EBITDA');
    expect([w35.delta, w35.explain.delta, w35.deltaNa, w35.status === 'na']).toEqual([
      'n/a vs prev. mth',
      'n/a vs prev. mth',
      true,
      false,
    ]);
    expect(keys(pm('FY2026-W31')?.win ?? null)).toEqual(keys(parseItemKey(d, 'P-FY2026-07@1')));
    const w43 = eb('FY2026-W43');
    expect(cardOf(view({ compare: 'prev' }), 'EBITDA').delta).toMatch(/^[+−]€\d+\.\dm \([+−]\d+\.\d%\) vs prev\. mth$/);
    const v = cardOf(view({ compare: 'prev' }), 'EBITDA');
    expect(v.explain.delta).toBe(v.delta.replace('vs prev. mth', 'vs P9 weeks 1–4'));
    const want = (csv('P-FY2026-10', 'ebitda') ?? NaN) - (csv('P-FY2026-09@4', 'ebitda') ?? NaN);
    expect(v.delta.startsWith(`${want >= 0 ? '+' : '−'}€${(Math.abs(want) / 1e6).toFixed(1)}m`)).toBe(true);
    expect(cardOf(view({ item: 'FY2026-W01', compare: 'prev' }), 'EBITDA').explain.delta).toMatch(
      / vs P12 FY2025 week 1$/,
    );
    expect(w43.explain.delta).toBe(w43.delta); // Budget: the same Δ in the card and the pop-up
    // only EBITDA changes: the other cards still compare with the previous week
    expect(cardOf(view({ compare: 'prev' }), 'NET_SALES').delta).toMatch(/ vs prev\. wk$/);
  });

  it('bars: weekly at Week (last = W-FY2026-43 ebitda), per period at Month', () => {
    expect(close(eb('FY2026-W43').bars?.values.at(-1), csv('W-FY2026-43', 'ebitda'), 'ebitda')).toBe(true);
    expect(close(eb('FY2026-P10').bars?.values.at(-2), csv('P-FY2026-09', 'ebitda'), 'ebitda')).toBe(true);
  });
});

describe('E-98 labels', () => {
  it.each([
    ['FY2026-P10', 'Month 10 · 28 Sep–25 Oct 2026', 'Nordmark · Month 10'],
    ['FY2026-Q4', 'Quarter 4 to date · 28 Sep–25 Oct 2026', 'Nordmark · Quarter 4'],
    ['FY2026-Q3', 'Quarter 3 · 29 Jun–27 Sep 2026', 'Nordmark · Quarter 3'],
    ['FY2026', 'FY2026 to date · 29 Dec 2025–25 Oct 2026', 'Nordmark · FY2026'],
    ['FY2025', 'FY2025 · 30 Dec 2024–28 Dec 2025', 'Nordmark · FY2025'],
    ['FY2025-W43', 'Week 43 FY2025 · 20–26 Oct 2025', 'Nordmark · Week 43 FY2025'],
    ['FY2025-P10', 'Month 10 FY2025 · 29 Sep–26 Oct 2025', 'Nordmark · Month 10 FY2025'],
  ])('%s: header "%s", title "%s"', (k, period, title) => {
    const v = view({ item: k });
    expect([text(v.header.period), v.how.eyebrow]).toEqual([period, title]);
  });

  it('comparator words: header "vs Previous month", Δ always short (USER answer 7); LY "(same retail weeks)"', () => {
    const p = view({ item: 'FY2026-P10', compare: 'prev' });
    expect(text(p.header.compare)).toBe('vs Previous month');
    expect(cardOf(p, 'TOTAL_MARGIN').delta).toMatch(/ pp vs prev\. mth \d/);
    expect(cardOf(view({ compare: 'prev' }), 'NET_SALES').delta).toMatch(/ vs prev\. wk$/);
    expect(cardOf(view({ item: 'FY2026-Q3', compare: 'prev' }), 'GMROI').delta).toMatch(/ vs prev\. qtr /);
    expect(text(view({ item: 'FY2026-Q4', compare: 'ly' }).header.compare)).toBe('vs Last year (same retail weeks)');
    expect(text(view({ compare: 'ly' }).header.compare)).toBe('vs Last year (same retail week)');
  });

  it('ⓘ window words: Net sales stats and sub-titles follow the granularity', () => {
    const stats = (k: string) => cardOf(view({ item: k }), 'NET_SALES').explain.stats.map(([l]) => l);
    expect(stats('FY2026-P10')).toEqual(['vs LY month', 'Quarter 4 to date', 'Year to date']);
    expect(stats('FY2026-W43')).toEqual(['vs LY week', 'Month 10 to date', 'Year to date']);
    expect(cardOf(view({ item: 'FY2026-P10' }), 'NET_SALES').sub).toBe('month 10, all channels');
    expect(cardOf(view({ item: 'FY2026-P10' }), 'LFL_GROWTH').sub).toBe('vs LY month');
    expect(stats('FY2026-Q4')).toEqual(['vs LY quarter', 'FY to date', 'Previous quarter']);
    expect(stats('FY2026')).toEqual(['vs LY year', 'Budget full year', 'Last year']);
    expect(cardOf(view({ item: 'FY2026-Q4' }), 'NET_SALES').sub).toBe('quarter 4 to date, all channels');
    expect(cardOf(view({ item: 'FY2026' }), 'LFL_GROWTH').sub).toBe('vs LY year');
    expect(cardOf(view({ item: 'FY2026-P10' }), 'SUPPLIER_OTIF').explain.stats[1]?.[0]).toBe('vs prev. mth');
  });

  it('picker chips: partial items "to date"; Week / Month items in the grid', () => {
    const q = view({ item: 'FY2026-Q4' }).menu;
    expect(q.items.map((c) => c.label)).toEqual(['Q1', 'Q2', 'Q3', 'Q4 · to date']);
    expect(q.itemGrid).toBe(false);
    const y = view({ item: 'FY2025' }).menu;
    expect([y.fy, y.items.map((c) => c.label)]).toEqual([null, ['FY2025', 'FY2026 · to date']]);
    expect(view({}).menu.items).toHaveLength(43);
    expect(view({ item: 'FY2025-W10' }).menu.items).toHaveLength(52);
  });
});

describe('ET-28 URL state and picker moves', () => {
  it.each([
    ['i=FY2026-P10', 'FY2026-P10', 'i=FY2026-P10'],
    ['p=ptd', 'FY2026-P10', 'i=FY2026-P10'],
    ['p=ytd', 'FY2026', 'i=FY2026'],
    ['p=week', null, ''],
    ['i=FY2026-W50', null, ''],
    ['i=FY2024', null, ''],
    ['i=FY2026-W43', null, ''],
    ['i=%3Cscript%3E', null, ''],
    ['i=FY2026-Q4&p=ytd', 'FY2026-Q4', 'i=FY2026-Q4'],
    ['i=nope&p=ytd', null, ''],
    ['c=lw', null, 'c=prev'],
    ['i=FY2026&c=prev', 'FY2026', 'i=FY2026&c=ly'],
    ['horizon=week&owner=finance', null, 'owner=finance'],
  ])('?%s → item %s, canonical "%s"', (q, wantItem, canonical) => {
    const s = parse(q);
    expect(s.item).toBe(wantItem);
    expect(serializeSelection(s)).toBe(canonical);
    expect(parse(serializeSelection(s))).toEqual(s);
  });

  it('switching the granularity keeps the item holding the last week (W43 → P10 → Q4 → FY2026 and back)', () => {
    const next = (k: string | null, g: string) => view({ item: k }).menu.granularity.find((c) => c.id === g)?.next.item;
    expect([next(null, 'P'), next(null, 'Q'), next(null, 'FY')]).toEqual(['FY2026-P10', 'FY2026-Q4', 'FY2026']);
    expect([next('FY2026', 'Q'), next('FY2026-Q4', 'P'), next('FY2026-P10', 'W')]).toEqual([
      'FY2026-Q4',
      'FY2026-P10',
      null,
    ]);
    expect([next('FY2025', 'Q'), next('FY2025-Q4', 'P'), next('FY2025-P12', 'W')]).toEqual([
      'FY2025-Q4',
      'FY2025-P12',
      'FY2025-W52',
    ]);
  });

  it('switching the FY keeps the item number, else takes the FY’s last item', () => {
    const fy = (k: string | null, y: string) => view({ item: k }).menu.fy?.find((c) => c.id === y)?.next.item;
    expect([fy(null, '2025'), fy('FY2025-W50', '2026'), fy('FY2025-Q2', '2026')]).toEqual([
      'FY2025-W43',
      null,
      'FY2026-Q2',
    ]);
  });
});
