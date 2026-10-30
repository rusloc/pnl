import { beforeAll, describe, expect, it } from 'vitest';
import { SCOPES } from '../data/manifest.ts';
import { loadExecData, tolerance } from '../test-utils/exec-data.ts';
import { CATEGORY_COPY } from './copy.ts';
import { categoryMask } from './cube.ts';
import type { ExecData } from './cube.ts';
import { catalog, parseItemKey } from './items.ts';
import type { Catalog, Window } from './items.ts';
import { computeMetrics } from './metrics.ts';
import { DEFAULT_SELECTION, parseSelection, serializeSelection } from './url-state.ts';
import type { Selection } from './url-state.ts';
import { buildView } from './view.ts';
import type { CardView, DashboardView } from './view.ts';

// Category filter (ADR-0013 (l), E-100 … E-104, docs/ADD/features/exec-category-filter.md; USER 2026-10-30 + main-agent
// rulings): ET-33 additivity and targets, ET-34 N/A under a pick, ET-35 header / menu / Reset, ET-36 URL state `cat`.
// The control rows of the sampled category scopes (E-104) reconcile in control-totals-category.test.ts.

let d: ExecData;
let cat: Catalog;
beforeAll(async () => {
  d = await loadExecData();
  cat = catalog(d);
});

const CODES = ['FRESH', 'AMBIENT', 'HB', 'HOUSEHOLD', 'ELEC', 'APPAREL', 'HOME', 'GARDEN', 'TOYS'] as const;
const KEYS = ['W-FY2026-43', 'P-FY2026-10', 'Q-FY2026-4', 'FY-FY2026', 'W-FY2025-43', 'FY-FY2025'];
const win = (key: string): Window => {
  const w = parseItemKey(d, key);
  if (!w) throw new Error(`no key ${key}`);
  return w;
};
const at = (key: string, codes: readonly string[], scope: (typeof SCOPES)[number] = 'ALL') =>
  computeMetrics(d, scope, win(key), categoryMask(d, codes));
const view = (patch: Partial<Selection>): DashboardView => buildView(d, { ...DEFAULT_SELECTION, ...patch });
const cardOf = (v: DashboardView, id: string): CardView => {
  const c = v.cards.find((x) => x.id === id);
  if (!c) throw new Error(`no card ${id}`);
  return c;
};
const text = (r: readonly { text: string }[]) => r.map((x) => x.text).join('');
const parse = (q: string) => parseSelection(new URLSearchParams(q), cat);

describe('categoryMask', () => {
  it('nothing picked or all 9 picked = All (null); otherwise cube indices in sort_order', () => {
    expect(categoryMask(d, [])).toBeNull();
    expect(categoryMask(d, CODES)).toBeNull();
    expect(categoryMask(d, ['TOYS', 'ELEC'])).toEqual([4, 8]);
    expect(d.categories.map((c) => c.category_code)).toEqual(CODES);
  });
});

describe('ET-33 additivity and targets', () => {
  const ADDITIVE = [
    'gross_sales',
    'markdown',
    'returns',
    'net_sales',
    'cogs',
    'back_margin',
    'on_hand_cost',
    'on_order_cost',
    'forecast_cogs',
    'ranged_sku_days',
    'in_stock_sku_days',
    'season_receipt_units',
    'season_units_sold',
  ];
  it.each(KEYS)('%s: Σ of the 9 singles = All (ALL, NL, BE, ONLINE)', (key) => {
    for (const scope of SCOPES) {
      const all = computeMetrics(d, scope, win(key));
      const singles = CODES.map((code) => at(key, [code], scope));
      const off = ADDITIVE.filter((m) => all[m] !== undefined).filter((m) => {
        const s = singles.reduce((acc, x) => acc + (x[m] ?? 0), 0);
        return !(Math.abs(s - (all[m] ?? NaN)) <= tolerance(m));
      });
      expect(off.map((m) => `${scope} ${m}`)).toEqual([]);
    }
  });

  it('APPAREL + HOME + GARDEN + TOYS sell-through = All (the All card already covers the seasonal categories only)', () => {
    for (const key of ['W-FY2026-43', 'P-FY2026-10', 'W-FY2025-43'])
      expect(at(key, ['APPAREL', 'HOME', 'GARDEN', 'TOYS']).sell_through_pct).toBeCloseTo(
        computeMetrics(d, 'ALL', win(key)).sell_through_pct ?? NaN,
        12,
      );
  });

  it('single category: cover and GMROI targets = its dim_category row; availability stays 0.97; sell-through 0.62', () => {
    for (const c of d.categories) {
      const m = at('W-FY2026-43', [c.category_code]);
      expect(m.cover_target_wks).toBeCloseTo(c.cover_target_wks, 10);
      expect(m.gmroi_target).toBeCloseTo(c.gmroi_target, 10);
      expect(m.availability_target).toBe(0.97);
      if (c.is_seasonal) expect(m.sell_through_target).toBeCloseTo(0.62, 10);
    }
    expect(at('W-FY2026-43', ['ELEC']).gmroi_target).toBeCloseTo(2.2, 10);
  });

  it('a mix: GMROI target = average-on-hand-cost-weighted category targets; cover = forecast-weighted', () => {
    const m = at('W-FY2026-43', ['ELEC', 'TOYS']);
    const e = at('W-FY2026-43', ['ELEC']);
    const t = at('W-FY2026-43', ['TOYS']);
    const aoh = (x: typeof m) => x.gmroi_avg_on_hand_cost ?? NaN;
    const fc = (x: typeof m) => x.forecast_cogs ?? NaN;
    expect(m.gmroi_target).toBeCloseTo(
      (aoh(e) * (e.gmroi_target ?? NaN) + aoh(t) * (t.gmroi_target ?? NaN)) / (aoh(e) + aoh(t)),
      10,
    );
    expect(m.cover_target_wks).toBeCloseTo(
      (fc(e) * (e.cover_target_wks ?? NaN) + fc(t) * (t.cover_target_wks ?? NaN)) / (fc(e) + fc(t)),
      10,
    );
  });

  it('at All every target is the param_target ALL row (GMROI 2.5, availability 0.97, sell-through 0.62)', () => {
    const m = computeMetrics(d, 'ALL', win('W-FY2026-43'));
    expect([m.gmroi_target, m.availability_target, m.sell_through_target, m.otif_target]).toEqual([
      2.5, 0.97, 0.62, 0.95,
    ]);
    // all 9 ticked = All: the same metric set, key for key
    expect(computeMetrics(d, 'ALL', win('W-FY2026-43'), categoryMask(d, CODES))).toEqual(m);
  });
});

describe('ET-34 N/A under a pick', () => {
  const GONE = /^(opex_|ebitda|po_lines_|otif_|status\.ebitda$|status\.supplier_otif$)/;
  it('no OpEx / EBITDA / PO / OTIF value under any pick, any key, any region', () => {
    for (const key of KEYS)
      for (const scope of SCOPES)
        for (const codes of [['ELEC'], ['ELEC', 'TOYS'], ['FRESH', 'AMBIENT', 'HB']]) {
          const m = at(key, codes, scope);
          expect(Object.keys(m).filter((k) => GONE.test(k))).toEqual([]);
        }
  });

  it('non-seasonal pick → no sell-through; ELEC + TOYS sell-through = TOYS', () => {
    expect(at('W-FY2026-43', ['FRESH', 'AMBIENT', 'HB']).sell_through_pct).toBeUndefined();
    expect(at('W-FY2026-43', ['ELEC', 'TOYS']).sell_through_pct).toBe(at('W-FY2026-43', ['TOYS']).sell_through_pct);
  });

  // ET-34 says "10 rated at ALL#ELEC"; Electronics is not seasonal, so its Sell-through is N/A by the E-101 rule
  // (main-agent ruling 2026-10-30) → 9 rated, 3 N/A. A seasonal pick (ELEC + TOYS) rates 10.
  it('W43: ELEC + TOYS 10 rated / 2 N/A; ELEC and FRESH + AMBIENT + HB (no seasonal category) 9 rated / 3 N/A', () => {
    const rated = (m: Readonly<Record<string, number>>) => [
      (m['status.count_on'] ?? 0) + (m['status.count_watch'] ?? 0) + (m['status.count_off'] ?? 0),
      m['status.count_na'],
    ];
    expect(rated(at('W-FY2026-43', ['ELEC', 'TOYS']))).toEqual([10, 2]);
    expect(rated(at('W-FY2026-43', ['ELEC']))).toEqual([9, 3]);
    expect(rated(at('W-FY2026-43', ['FRESH', 'AMBIENT', 'HB']))).toEqual([9, 3]);
    expect(at('W-FY2026-43', ['ELEC'])['status.dot']).toBeDefined();
  });

  it('ONLINE × category keeps availability and LFL N/A', () => {
    const m = at('W-FY2026-43', ['ELEC'], 'ONLINE');
    expect([m.availability_pct, m.lfl_growth_pct]).toEqual([undefined, undefined]);
  });

  it('GMROI / sell-through mini stats list the picked categories only (ALL scope)', () => {
    const m = at('W-FY2026-43', ['ELEC', 'TOYS']);
    expect(Object.keys(m).filter((k) => /^(gmroi|sell_through_pct)\./.test(k))).toEqual([
      'gmroi.ELEC',
      'gmroi.TOYS',
      'sell_through_pct.TOYS',
    ]);
    expect(m.otif_suppliers_below_85).toBeUndefined();
  });

  it('cards: EBITDA flash and Supplier OTIF show the N/A face; Sell-through too on a non-seasonal pick', () => {
    const v = view({ categories: ['ELEC'] });
    for (const [id, note] of [
      ['EBITDA', CATEGORY_COPY.note.EBITDA],
      ['SUPPLIER_OTIF', CATEGORY_COPY.note.SUPPLIER_OTIF],
    ] as const) {
      const c = cardOf(v, id);
      expect([c.value, c.unit, c.delta, c.deltaNa, c.status, c.glyph]).toEqual([
        '–',
        '',
        'n/a by category',
        true,
        'na',
        '–',
      ]);
      expect(c.bars?.values.every((x) => x === null) ?? true).toBe(true);
      expect(c.explain.delta).toBe('n/a by category');
      expect(c.explain.rows.find(([l]) => l === 'Worked example')?.[1]).toEqual([{ text: note }]);
      expect(c.explain.stats.every(([, x]) => x === 'n/a')).toBe(true);
      expect(c.target).toEqual({ label: id === 'EBITDA' ? 'Budget' : 'Target', value: 'n/a', unit: '' });
    }
    const st = cardOf(view({ categories: ['FRESH', 'AMBIENT', 'HB'] }), 'SELL_THROUGH');
    expect([st.value, st.delta, st.status]).toEqual(['–', 'n/a by category', 'na']);
    expect(st.explain.rows.find(([l]) => l === 'Worked example')?.[1]).toEqual([
      { text: 'No seasonal category in the selection.' },
    ]);
    // ELEC alone keeps Sell-through N/A as well (no seasonal category); ELEC + TOYS rates it on Toys
    expect(cardOf(v, 'SELL_THROUGH').delta).toBe('n/a by category');
    const mix = cardOf(view({ categories: ['ELEC', 'TOYS'] }), 'SELL_THROUGH');
    expect(mix.status).not.toBe('na');
    expect(text(mix.explain.rows.find(([l]) => l === 'Worked example')?.[1] ?? [])).toMatch(
      /Seasonal categories only\.$/,
    );
  });

  it('splittable cards are computed on the pick (Net sales W43 ELEC = the ELEC cells)', () => {
    const c = cardOf(view({ categories: ['ELEC'] }), 'NET_SALES');
    const m = at('W-FY2026-43', ['ELEC']);
    expect(c.delta).not.toContain('by category');
    expect(c.status).not.toBe('na');
    expect(c.bars?.values.at(-1)).toBeCloseTo(m.net_sales ?? NaN, 6);
  });
});

describe('ET-35 header, menu and Reset', () => {
  const region = (patch: Partial<Selection>) => text(view(patch).header.region);
  it('region segment: nothing at All, one name, two names in menu order, "n categories" with a title', () => {
    expect(region({})).toBe('All regions & formats');
    expect(view({}).header.regionTitle).toBeNull();
    expect(region({ categories: ['ELEC'] })).toBe('All regions & formats · Electronics');
    expect(region({ region: 'nl', categories: ['ELEC'] })).toBe('Netherlands · all formats · Electronics');
    expect(region({ region: 'online', categories: ['ELEC'] })).toBe('Online only · Electronics');
    expect(region({ categories: ['ELEC', 'TOYS'] })).toBe('All regions & formats · Electronics & Toys & leisure');
    const three = view({ categories: ['FRESH', 'AMBIENT', 'HB'] });
    expect(text(three.header.region)).toBe('All regions & formats · 3 categories');
    expect(three.header.regionTitle).toBe('Fresh food, Ambient grocery, Health & beauty');
  });

  it('dropdown: label Category, the 9 names in sort_order, no code on screen; closed-state summary per pick', () => {
    const m = view({}).menu.category;
    expect(m.label).toBe('Category');
    expect(m.summary).toBe('All categories');
    expect(m.all).toMatchObject({ label: 'All categories', checked: true });
    expect(m.options.map((o) => o.label)).toEqual([
      'Fresh food',
      'Ambient grocery',
      'Health & beauty',
      'Household & cleaning',
      'Electronics',
      'Apparel',
      'Home & kitchen',
      'Garden & DIY',
      'Toys & leisure',
    ]);
    expect(m.options.every((o) => !(CODES as readonly string[]).includes(o.label) && !o.checked)).toBe(true);
    expect(view({ categories: ['ELEC'] }).menu.category.summary).toBe('Electronics');
    expect(view({ categories: ['ELEC', 'TOYS'] }).menu.category.summary).toBe('Electronics & Toys & leisure');
    expect(view({ categories: ['FRESH', 'AMBIENT', 'HB'] }).menu.category).toMatchObject({
      summary: '3 categories',
      title: 'Fresh food, Ambient grocery, Health & beauty',
    });
  });

  it('options toggle in sort_order; the 9th tick = All; "All categories" clears; Reset = DEFAULT_SELECTION clears', () => {
    const m = view({ categories: ['TOYS'] }).menu.category;
    const elec = m.options.find((o) => o.id === 'ELEC');
    expect(elec?.next.categories).toEqual(['ELEC', 'TOYS']);
    expect(m.options.find((o) => o.id === 'TOYS')?.next.categories).toEqual([]);
    expect(m.all).toMatchObject({ checked: false, next: { categories: [] } });
    const eight = CODES.filter((c) => c !== 'GARDEN');
    expect(view({ categories: eight }).menu.category.options.find((o) => o.id === 'GARDEN')?.next.categories).toEqual(
      [],
    );
    expect(DEFAULT_SELECTION.categories).toEqual([]);
  });

  it('the pick changes neither the status-line summary nor the badge (attribute picks only)', () => {
    const v = view({ categories: ['ELEC'] });
    expect([v.status.picks, v.status.picked]).toEqual(['All', 0]);
  });

  it('How to read lists "category" among the filters', () => {
    expect(view({}).how.bullets.map(text).join(' ')).toContain('period, comparator, region, category and the metric');
  });
});

describe('ET-36 URL state cat (E-62)', () => {
  it('?cat=ELEC,TOYS selects both and serialises as cat=ELEC%2CTOYS', () => {
    const s = parse('cat=ELEC,TOYS');
    expect(s.categories).toEqual(['ELEC', 'TOYS']);
    expect(serializeSelection(s)).toBe('cat=ELEC%2CTOYS');
    expect(parse('cat=ELEC%2CTOYS')).toEqual(s);
  });

  it('normalised: sort_order, dedup, unknown and wrong-case codes dropped; empty / invalid / all 9 = absent', () => {
    expect(parse('cat=toys,ELEC,ELEC,FOO').categories).toEqual(['ELEC']);
    expect(serializeSelection(parse('cat=TOYS,ELEC'))).toBe('cat=ELEC%2CTOYS');
    for (const q of ['cat=FOO', 'cat=', `cat=${CODES.join(',')}`, 'cat=ELEC+TOYS', `cat=${'ELEC,'.repeat(40)}`]) {
      expect(parse(q)).toEqual(DEFAULT_SELECTION);
      expect(serializeSelection(parse(q))).toBe('');
    }
  });

  it('round-trips byte-identical with every other key; no effect on the i / c normalisation', () => {
    const q = 'i=FY2026-P10&c=ly&r=nl&cat=ELEC%2CTOYS&group=B3';
    expect(serializeSelection(parse(q))).toBe(q);
    expect(serializeSelection(parse('cat=ELEC&i=FY2026&c=prev'))).toBe('i=FY2026&c=ly&cat=ELEC');
  });
});
