// ⓘ and How-to-read copy (ADR-0012; parity rules 6, 13, 18, 19): panel copy is
// Track B's dim_pl_info, the How to read opens with the selection sentence,
// and no UI copy uses " · " (the " - " separator rule).
import { describe, expect, it } from 'vitest';

import { sampleReference } from '../data/sample-reference';
import { defaultFilters } from './filters';
import { cardInfo, howToRead, lineWord, PANEL_INFO, panelInfo } from './info-popovers';

const reference = sampleReference();
const filter = defaultFilters(reference);

describe('panel and card copy', () => {
  it('has a title, what it shows, a formula ("; " between terms) and a source for each of the seven panels (shared block)', () => {
    for (const key of ['NRBRIDGE', 'PBRIDGE', 'VAR', 'PROFTABLE', 'CONC', 'BUBBLE', 'HEAT'] as const) {
      const t = PANEL_INFO[key];
      expect(t.title.length).toBeGreaterThan(3);
      expect(t.what.length).toBeGreaterThan(40);
      expect(t.formula).toBeTruthy();
      expect(t.source).toBeTruthy();
      expect(t.values).toEqual([]);
      expect(`${t.title} ${t.what} ${t.formula}`).not.toContain(' · ');
    }
    expect(PANEL_INFO.VAR.formula).toMatch(/Δ % = Δ ÷ \|comparison\|, n\.m\. when \|comparison\| < 2\.0 or \|Δ %\| > 50 %; FX =/);
    // The comparison and the company's slot word are filled from the selection.
    expect(panelInfo('VAR', { comparison: 'Latest est.', entity: 'P' }).title).toBe('Largest variances vs Latest est.');
    expect(panelInfo('NRBRIDGE', { comparison: 'Prior year', entity: 'P' })).toMatchObject({ what: expect.stringMatching(/^Prior year to actual/), formula: expect.stringMatching(/^volume = Σ slices/) });
    expect(panelInfo('NRBRIDGE', { comparison: 'Budget', entity: 'G' }).formula).toMatch(/^company step/);
    expect(panelInfo('HEAT', { comparison: 'Budget', entity: 'P' }).title).toBe('Mix - region × category');
    expect(panelInfo('PBRIDGE', { comparison: 'Budget', entity: 'S' }).what).toMatch(/mix by service line/);
    expect([lineWord('P'), lineWord('S'), lineWord('G')]).toEqual(['category', 'service line', 'service line']);
  });

  it('card copy per code (and company where the block lists both), falling back to the model’s label and definition', () => {
    expect(cardInfo('NR', 'S', 'Net revenue', 'def')).toMatchObject({ title: 'Net revenue', formula: 'NR = GR + GTN; Δ = actual − comparison, % of |comparison|', source: expect.stringMatching(/^KPI Value K-01/) });
    expect(cardInfo('GM_PCT', 'S', 'x', 'y').source).toMatch(/KPI Subscription GM %/);
    expect(cardInfo('GM_PCT', 'P', 'x', 'y').source).toMatch(/GM % by category/);
    expect(cardInfo('EBITDA', 'S', 'x', 'y').source).toMatch(/Rule of 40/);
    expect(cardInfo('EBITDA', 'P', 'x', 'y').source).not.toMatch(/Rule of 40/);
    expect(cardInfo('OPEX_PCT', 'P', 'Opex % of NR', 'y').title).toBe('Opex % revenue');
    expect(cardInfo('IC_ELIM', 'G', 'Intercompany eliminated', 'Fees billed by Commerce Cloud')).toEqual({ title: 'Intercompany eliminated', what: 'Fees billed by Commerce Cloud', formula: null, values: [], source: 'KPI Value (IC_ELIM)' });
  });
});

describe('howToRead', () => {
  it('one guide per view, opening with the selection sentence and closing with the Budget-only legend', () => {
    const kpi = howToRead('kpi', filter, reference);
    expect(kpi.title).toBe('How to read - Vitals');
    expect(kpi.lines[0]).toEqual({ label: 'Showing', value: 'Jan – Sep 2026 - year to date - USD m - vs Budget and Prior year' });
    expect(kpi.lines.map((l) => l.label)).toEqual(['Showing', 'Results', 'Drivers & health', 'Card face', 'Legend']);
    expect(kpi.lines.at(-1)?.value).toMatch(/^Status vs Budget only/);
    expect(howToRead('ana', filter, reference).lines.map((l) => l.label)).toEqual(['Showing', 'Page 1', 'Page 2', 'Paging', 'Colours', 'Legend']);
    expect(howToRead('prof', filter, reference).lines.map((l) => l.label)).toEqual(['Showing', 'Page 1', 'Page 2', 'Basis', 'Paging', 'Legend']);
    expect(howToRead('prof', filter, reference).lines[2].value).toMatch(/region × category\.$/);
    expect(howToRead('prof', { ...filter, entity: 'S' }, reference).lines[2].value).toMatch(/region × service line\.$/);
  });

  it('names the comparisons from the selection; with none selected, the C-40 fallback (Prior year)', () => {
    expect(howToRead('ana', { ...filter, compareA: 'LE', compareB: 'NONE', units: 'k', currency: 'EUR' }, reference).lines[0].value).toBe('Jan – Sep 2026 - year to date - EUR k - vs Latest estimate');
    expect(howToRead('prof', { ...filter, compareA: 'NONE', compareB: 'NONE' }, reference).lines[0].value).toMatch(/vs Prior year$/);
    for (const view of ['kpi', 'ana', 'prof'] as const) {
      for (const line of howToRead(view, filter, reference).lines) expect(line.value).not.toContain(' · ');
    }
  });
});
