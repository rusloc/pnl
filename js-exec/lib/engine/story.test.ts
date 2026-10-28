import { beforeAll, describe, expect, it } from 'vitest';
import { loadExecData } from '../test-utils/exec-data.ts';
import type { ExecData } from './cube.ts';
import { ATTRIBUTES } from './copy.ts';
import { DEFAULT_SELECTION } from './url-state.ts';
import type { Selection } from './url-state.ts';
import { buildView } from './view.ts';

// ET-02 / ET-03: Week 43 · ALL · Budget reads exactly the v5 story on every card (value, Δ text, chip), counts 7 / 3 / 2,
// overall dot orange; the dot and counts ignore the attribute filters (E-25, E-26, E-56).

let d: ExecData;
beforeAll(async () => {
  d = await loadExecData();
});

const V5: Record<string, [string, string, string]> = {
  NET_SALES: ['€61.4m', '−€1.5m (−2.4%) vs budget', 'Watch'],
  TOTAL_MARGIN: ['36.3%', '+0.1 pp vs budget 36.2%', 'On track'],
  WEEKS_OF_COVER: ['11.4wks', '+1.9 wks vs target 9.5', 'Watch'],
  MARKDOWN: ['9.8%', '+1.3 pp vs budget 8.5%', 'Off track'],
  AVAILABILITY: ['94.1%', '−2.9 pp vs target 97%', 'Off track'],
  EBITDA: ['€15.3m', '−€0.8m (−5.0%) vs budget', 'Watch'],
  LFL_GROWTH: ['+3.4%', '+0.4 pp vs budget LFL 3.0%', 'On track'],
  FRONT_GM: ['30.1%', '+0.1 pp vs budget 30.0%', 'On track'],
  SELL_THROUGH: ['63.1%', '+1.1 pp vs target 62%', 'On track'],
  GMROI: ['2.7×', '+0.2× vs target 2.5×', 'On track'],
  SUPPLIER_OTIF: ['95.4%', '+0.4 pp vs target 95%', 'On track'],
  CHANNEL_MIX: ['68.4% store', 'online +1.9 pp vs plan', 'On track'],
};

describe('ET-02 Week 43 · ALL · Budget = the v5 story', () => {
  it.each(Object.entries(V5))('%s', (id, [value, delta, word]) => {
    const c = buildView(d, DEFAULT_SELECTION).cards.find((x) => x.id === id);
    expect([`${c?.value}${c?.unit}`, c?.delta, c?.word]).toEqual([value, delta, word]);
  });

  it('cards in v5 order and sizes: 3 hero, 3 medium, 6 small', () => {
    const v = buildView(d, DEFAULT_SELECTION);
    expect(v.cards.map((c) => c.id)).toEqual(Object.keys(V5));
    expect(v.cards.map((c) => c.size).join(' ')).toBe('hero hero hero med med med sm sm sm sm sm sm');
  });

  it('ⓘ worked examples quote the data (README Week-43 table)', () => {
    const ex = (id: string) =>
      buildView(d, DEFAULT_SELECTION)
        .cards.find((c) => c.id === id)
        ?.explain.rows.find(([k]) => k === 'Worked example')?.[1]
        .map((s) => s.text)
        .join('');
    expect(ex('NET_SALES')).toBe(
      '€68.4m at ticket − €6.7m markdowns and discounts − €0.3m returns = €61.4m. Budget was €62.9m, so −€1.5m (−2.4%).',
    );
    expect(ex('TOTAL_MARGIN')).toBe('Front €18.5m + back €3.8m = €22.3m; ÷ €61.4m = 36.3%. Budget 36.2%, so +0.1 pp.');
    expect(ex('WEEKS_OF_COVER')).toBe(
      '€490m stock incl. on-order ÷ €43.0m forecast weekly cost of goods = 11.4 weeks. Target 9.5, so +1.9 → Watch.',
    );
    expect(ex('AVAILABILITY')).toBe(
      '500 SKUs × 142 stores × 7 days = 497,000 ranged; 467,700 in stock → 94.1%. Target 97%, so −2.9 pp → Off track.',
    );
    expect(ex('EBITDA')).toBe(
      '€87.7m margin − €2.2m shrink − €52.4m store − €11.6m central − €6.2m fulfilment = €15.3m (6.3% of €241.7m). Budget €16.1m, so −€0.8m (−5.0%).',
    );
    expect(ex('LFL_GROWTH')).toBe('131 LFL stores: €39.0m ÷ €37.7m − 1 = +3.4%. Budget LFL 3.0%, so +0.4 pp.');
    expect(ex('SELL_THROUGH')).toBe(
      '8.4m units sold ÷ (4.2m opening + 9.1m received = 13.3m) = 63.1%. Target 62% at week 12 of 20, so +1.1 pp.',
    );
    expect(ex('GMROI')).toBe('€862m front margin ÷ €319m average stock = 2.7×. Target 2.5×, so +0.2×.');
    expect(ex('SUPPLIER_OTIF')).toBe(
      '4,591 lines on time and in full ÷ 4,812 lines due = 95.4%. Target 95%, so +0.4 pp.',
    );
    expect(ex('CHANNEL_MIX')).toBe(
      'Store €42.0m, online €12.2m, wholesale €7.2m of €61.4m → 68.4% / 19.9% / 11.7%. Plan 70 / 18 / 12, so online +1.9 pp.',
    );
  });

  it('ⓘ mini stats quote the data', () => {
    const stats = (id: string) => buildView(d, DEFAULT_SELECTION).cards.find((c) => c.id === id)?.explain.stats;
    expect(stats('NET_SALES')).toEqual([
      ['vs LY week', '+3.8%'],
      ['Period 10 to date', '€241.7m'],
      ['Year to date', '€2,318m'],
    ]);
    expect(stats('TOTAL_MARGIN')).toEqual([
      ['Front margin', '30.1%'],
      ['Back margin', '6.2%'],
      ['vs LY week', '−0.2 pp'],
    ]);
    expect(stats('WEEKS_OF_COVER')).toEqual([
      ['On hand at cost', '€402m'],
      ['On order', '€88m'],
      ['vs last week', '+0.3 wks'],
    ]);
    expect(stats('MARKDOWN')).toEqual([
      ['Markdown value', '€6.7m'],
      ['vs LY week', '+1.9 pp'],
      ['Budget', '8.5%'],
    ]);
    expect(stats('LFL_GROWTH')).toEqual([
      ['LFL stores', '131 of 142'],
      ['Non-LFL effect', '−1.2 pp'],
      ['Online LFL', '+12.1%'],
    ]);
    expect(stats('SELL_THROUGH')).toEqual([
      ['Apparel', '58%'],
      ['Home & kitchen', '69%'],
      ['vs LY season', '+2.4 pp'],
    ]);
    expect(stats('GMROI')?.[2]).toEqual(['H&B · Electronics', '4.1× · 1.9×']);
    expect(stats('SUPPLIER_OTIF')).toEqual([
      ['PO lines due', '4,812'],
      ['vs last week', '+0.4 pp'],
      ['Suppliers below 85%', '2'],
    ]);
    expect(stats('AVAILABILITY')?.slice(0, 2)).toEqual([
      ['vs last week', '−0.2 pp'],
      ['Netherlands · Belgium', '93.5% · 94.9%'], // control totals NL 0.935395 / BE 0.948770 (README story text says 93.4 / 95.0)
    ]);
  });
});

describe('ET-03 counts and the overall dot', () => {
  it('Week 43 ALL: 7 / 3 / 2, dot orange, tooltip states the shares', () => {
    const s = buildView(d, DEFAULT_SELECTION).status;
    expect([s.counts, s.dot]).toEqual([{ on: 7, watch: 3, off: 2 }, 'orange']);
    expect(s.dotTip[1]).toContain('Now: off track 2 (17%), watch + off 5 (42%), on track 7 (58%).');
  });

  it('every attribute pick leaves the counts and the dot unchanged (E-25, E-56)', () => {
    const base = buildView(d, DEFAULT_SELECTION).status;
    for (const a of ATTRIBUTES)
      for (const [code] of a.options) {
        const sel: Selection = { ...DEFAULT_SELECTION, picks: { ...DEFAULT_SELECTION.picks, [a.key]: [code] } };
        const s = buildView(d, sel).status;
        expect([s.counts, s.dot]).toEqual([base.counts, base.dot]);
      }
  });
});
