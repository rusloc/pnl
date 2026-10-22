import { beforeAll, describe, expect, it } from 'vitest';
import type { Dataset } from '../data/dataset.ts';
import { loadPublicDataset } from '../test-utils/public-data.ts';
import { selection } from '../test-utils/selection.ts';
import { createEngine, variance } from './index.ts';
import { buildSpine, evaluateFormula } from './spine.ts';
import type { StatementRow } from './types.ts';

let ds: Dataset;
beforeAll(async () => {
  ds = await loadPublicDataset(['P', 'S']);
});

describe('T-13 Δ sign and favourability (M-10)', () => {
  const leaf = { code: 'X', kind: 'leaf' } as const;

  it('a cost below budget gives a positive, favourable Δ', () => {
    expect(variance(leaf, -90, -100)).toEqual({ delta: 10, deltaPct: 0.1, favourable: true });
  });

  it('revenue below budget gives a negative, unfavourable Δ', () => {
    expect(variance(leaf, 90, 100)).toEqual({ delta: -10, deltaPct: -0.1, favourable: false });
  });

  it('ratios: Δ in points, no Δ %; effective tax rate uncoloured (M-11)', () => {
    expect(variance({ code: 'GM_PCT', kind: 'ratio' }, 0.5, 0.45).deltaPct).toBeNull();
    expect(variance({ code: 'GM_PCT', kind: 'ratio' }, 0.5, 0.45).favourable).toBe(true);
    expect(variance({ code: 'ETR_PCT', kind: 'ratio' }, 0.25, 0.2).favourable).toBeNull();
  });

  it('n/a and zero comparisons', () => {
    expect(variance(leaf, 5, null)).toEqual({ delta: null, deltaPct: null, favourable: null });
    expect(variance(leaf, 5, 0).deltaPct).toBeNull();
    expect(variance(leaf, 5, 5).favourable).toBeNull();
  });

  it('on the data: Consumer Products YTD Sep 2026 vs Budget', () => {
    const rows = new Map(
      createEngine(ds)
        .statement(selection())
        .rows.map((r) => [r.code, r]),
    );
    const at = (code: string): StatementRow => {
      const r = rows.get(code);
      if (!r) throw new Error(`row ${code} missing`);
      return r;
    };
    // raw materials & packaging: a cost, below budget → Δ > 0, favourable
    expect(at('COR_P1').base).toBeGreaterThan(at('COR_P1').compareA?.value ?? 0);
    expect(at('COR_P1').compareA?.delta).toBeGreaterThan(0);
    expect(at('COR_P1').compareA?.favourable).toBe(true);
    // net revenue below budget → Δ < 0, unfavourable
    expect(at('NR').compareA?.delta).toBeLessThan(0);
    expect(at('NR').compareA?.favourable).toBe(false);
    for (const r of rows.values()) {
      if (r.base === null || r.compareA?.value == null) continue;
      expect(r.compareA.delta).toBe(r.base - r.compareA.value);
    }
  });
});

describe('spine (spec §3, D-32)', () => {
  it('labels from dim_report_line, entity alias as the secondary label (N-11, L-11)', () => {
    const nr = (e: 'P' | 'S' | 'GROUP') => buildSpine(ds.manifest, e).find((r) => r.code === 'NR');
    expect(nr('P')).toMatchObject({ label: 'Net revenue', alias: 'Net sales' });
    expect(nr('S')).toMatchObject({ label: 'Net revenue', alias: 'Revenue' });
    expect(nr('GROUP')).toMatchObject({ label: 'Net revenue', alias: null });
  });

  it('classifies cost rows for the cost-sign display (F-15, M-25)', () => {
    const cost = new Map(buildSpine(ds.manifest, 'S').map((r) => [r.code, r.isCost]));
    for (const c of ['GTN', 'COR', 'VSC', 'OPEX', 'SM', 'RD', 'RD_S3', 'GA', 'DA', 'ADJ', 'FIN', 'TAX'])
      expect(cost.get(c), c).toBe(true);
    for (const c of ['GR', 'NR', 'GP', 'CM', 'OOI', 'OOI_1', 'EBITDA', 'INV', 'NP', 'GM_PCT'])
      expect(cost.get(c), c).toBe(false);
  });

  it('tags intercompany leaves IC (L-14)', () => {
    expect(buildSpine(ds.manifest, 'P').find((r) => r.code === 'VSC_P4')?.tag).toBe('IC');
  });

  it('lists only the leaves each entity books, under their block, in spine order', () => {
    const p = buildSpine(ds.manifest, 'P');
    const codes = p.map((r) => r.code);
    expect(codes.slice(0, 4)).toEqual(['GR', 'GR_P1', 'GR_P2', 'GTN']);
    expect(codes).not.toContain('GR_S1');
    expect(codes).not.toContain('ELIM_GR');
    expect(p.find((r) => r.code === 'SM')).toMatchObject({ parent: 'OPEX', level: 1 });
    expect(p.find((r) => r.code === 'SM_P1')).toMatchObject({ parent: 'SM', level: 2, kind: 'leaf' });
    expect(codes.indexOf('OPEX')).toBeLessThan(codes.indexOf('SM'));
  });

  it('blocks are Σ leaves and subtotals follow their formulas (M-01)', () => {
    const rows = createEngine(ds).statement(selection({ entity: 'S' })).rows;
    const v = (code: string) => rows.find((r) => r.code === code)?.base ?? NaN;
    const leaves = rows.filter((r) => r.parent === 'COR' && r.kind === 'leaf');
    expect(leaves.reduce((s, r) => s + (r.base ?? 0), 0)).toBeCloseTo(v('COR'), 6);
    expect(v('NR')).toBeCloseTo(v('GR') + v('GTN'), 6);
    expect(v('OPEX')).toBeCloseTo(v('SM') + v('RD') + v('GA') + v('OOI'), 6);
    expect(v('ETR_PCT')).toBeCloseTo(-v('TAX') / v('PBT'), 12);
    expect(rows.find((r) => r.code === 'GM_PCT')?.pctNr).toBeNull();
    expect(rows.find((r) => r.code === 'GP')?.pctNr).toBeCloseTo(v('GM_PCT'), 12);
  });

  it('evaluateFormula: sums, ratios, a negated numerator and a zero denominator', () => {
    const vals: Record<string, number> = { A: 3, B: -1, C: 0 };
    const get = (c: string) => vals[c] ?? null;
    expect(evaluateFormula('A + B', get)).toBe(2);
    expect(evaluateFormula('-B / A', get)).toBeCloseTo(1 / 3, 12);
    expect(evaluateFormula('A / C', get)).toBeNull();
    expect(() => evaluateFormula('A * B', get)).toThrow(/bad term/);
  });
});

describe('engine guards for unbuilt features', () => {
  it('refuses slice filters, other layouts and the nature lens instead of ignoring them', () => {
    const engine = createEngine(ds);
    expect(() => engine.statement(selection({ channel: ['GRO'] }))).toThrow(/slice filters/);
    expect(() => engine.statement(selection({ layout: 'TREND_M' }))).toThrow(/layout/);
    expect(() => engine.statement(selection({ costLens: 'NAT' }))).toThrow(/By nature/);
  });

  it('reports the last closed month from dim_month (N-03)', () => {
    expect(createEngine(ds).dataStatus().lastClosedMonth).toBe('2026-09');
  });
});
