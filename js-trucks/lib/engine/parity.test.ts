import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { hasUnfiltered, loadDataset, loadUnfiltered } from '../test-utils/trucks-data.ts';
import {
  BLANK,
  COLUMNS,
  classify,
  noteOf,
  queryOf,
  readRows,
  resolver,
  selectionOf,
  stateKey,
  unfilteredSelection,
  urlResolver,
  writeRows,
} from '../test-utils/parity/trucks-parity.ts';
import type { Resolver, Row } from '../test-utils/parity/trucks-parity.ts';
import type { WorkType } from '../data/manifest.ts';
import { computeKpis } from './kpi.ts';
import { RESET_SELECTION } from './selection.ts';
import type { Selection } from './selection.ts';
import { sideShares } from './shares.ts';
import type { Scope } from './shares.ts';
import { parseSelection, serializeSelection } from './url-state.ts';
import { board, scopeOf } from './view.ts';

// PBI = JS parity gate, ACME Trucks (contract trucks-js-flavour.md §7.2; 0 gap rows = the gate). Rows:
// lib/test-utils/parity/parity_selections_trucks.csv = hunter's pinned blocks (fixtures/checks/trucks-pinned.csv) + bip's
// Power BI capture (pbi-report/ACME Trucks/tests/parity-expected.csv) + faces rendered from them by the DAX format rules.
// `accepted` needs a numbered difference of docs/design/parity-rules.md › ACME Trucks in `note`.
// Refresh c_value / c_status after an engine change: PARITY_WRITE=1 npx vitest run lib/engine/parity.test.ts

const CSV = fileURLToPath(new URL('../test-utils/parity/parity_selections_trucks.csv', import.meta.url));
const PBI_CSV = fileURLToPath(new URL('../../../pbi-report/ACME Trucks/tests/parity-expected.csv', import.meta.url));
const HAS_PBI = existsSync(PBI_CSV); // absent in a .sync pack (ADR-0014)
const SELS = ['PT-01', 'PT-02', 'PT-03', 'PT-04', 'PT-05', 'PT-05b', 'PT-06', 'PT-07', 'PT-08'];
const FIXTURE_ONLY = 'PT-06';

const ds = await loadDataset();
const unf = hasUnfiltered() ? await loadUnfiltered() : null;

/** The tab 7 contractor checks: the fixture set with the two page filters applied by hand. */
function contractorSlot(element: string): string | undefined {
  if (!unf) return undefined;
  const { ds: u, m } = unf;
  const included = Array.from({ length: u.nLoaders }, (_, i) => i).filter((i) => m.loaders[i]?.is_included === true);
  const inFact = new Set(Array.from(u.time.loader));
  if (element === 'CTR.distinct')
    return String(new Set(included.filter((i) => inFact.has(i)).map((i) => m.loaders[i]?.contractor_blank)).size);
  const worked = included.filter((i) => {
    const w = m.loaders[i]?.work_type ?? null;
    return w !== null && (['Trucks', 'On spot'] as WorkType[]).includes(w);
  });
  const kpi = (mask: number[]) => {
    const scope: Scope = { mask, week: null, planType: 'Month', calculation: 'Weighted' };
    return computeKpis(u, scope, sideShares(u, scope, 'plan'), sideShares(u, scope, 'fact'));
  };
  const all = kpi(worked);
  const page = kpi(worked.filter((i) => m.loaders[i]?.contractor_blank === true));
  if (element === 'CTR.tl_fact_diff') return String((page.truckLoading.fact ?? 0) - (all.truckLoading.fact ?? 0));
  if (element === 'CTR.rm_fact_diff') return String((page.mass.fact ?? 0) - (all.mass.fact ?? 0));
  return undefined;
}

function resolveAll(rows: readonly Row[]): (string | undefined)[] {
  const bySel = new Map<string, Resolver>();
  return rows.map((r) => {
    if (r.element.startsWith('CTR.')) return contractorSlot(r.element);
    let f = bySel.get(r.sel_id);
    if (!f) {
      if (r.sel_id === 'PT-07') f = urlResolver(ds, r);
      else if (r.sel_id === FIXTURE_ONLY) f = unf ? resolver(unf.ds, unfilteredSelection()) : () => undefined;
      else f = resolver(ds, selectionOf(ds, r));
      bySel.set(r.sel_id, f);
    }
    return f(r.element);
  });
}

if (process.env.PARITY_WRITE === '1') {
  const seed = readRows(readFileSync(CSV, 'utf8'));
  const values = resolveAll(seed);
  const out = seed.map((r, i) => ({
    ...r,
    c_status: classify(r, values[i]),
    c_value: values[i] ?? '',
    note: noteOf(r, values[i]),
  }));
  writeFileSync(CSV, writeRows(out));
}

const rows = readRows(readFileSync(CSV, 'utf8'));
const js = resolveAll(rows);
const label = (i: number) => {
  const r = rows[i] as Row;
  return { element: r.element, expected: r.expected, js: js[i] ?? '(no slot)', source: r.source };
};

describe('harness', () => {
  const n = (expected: string, tol = '1e-9') => ({ kind: 'number', expected, tol });
  const t = (expected: string) => ({ kind: 'text', expected, tol: '0' });

  it('numbers use tol × max(1, |expected|), and BLANK matches only BLANK', () => {
    expect(classify(n('0.5'), '0.5000000001')).toBe('match');
    expect(classify(n('0.5'), '0.500000002')).toBe('gap');
    expect(classify(n('847000'), '847000.0001')).toBe('match'); // scaled by |expected|
    expect(classify(n(BLANK), BLANK)).toBe('match');
    expect(classify(n(BLANK), '0')).toBe('gap'); // DEF-007: JS 0 where DAX is BLANK
    expect(classify(n('0'), BLANK)).toBe('gap');
    expect(classify(n('0'), undefined)).toBe('gap');
    expect(classify(n('1'), 'NaN')).toBe('gap');
  });

  it('text folds only the minus glyph, the divider spaces and the blank-card face', () => {
    expect(classify(t('−2.13 pp'), '−2.13 pp')).toBe('match');
    expect(classify(t('-2.13'), '−2.13')).toBe('accepted');
    expect(classify(t('Week 9  ·  Month plan'), 'Week 9 · Month plan')).toBe('match');
    expect(classify(t('(Blank)'), '–')).toBe('accepted');
    expect(classify(t('(Blank)'), '')).toBe('accepted');
    expect(classify(t('(Blank)'), '0')).toBe('gap');
    expect(classify(t('–'), '-')).toBe('gap'); // the en dash of an empty cell is not a minus
    expect(classify(t('42.9%'), '42.8%')).toBe('gap');
    expect(classify(t(''), undefined)).toBe('gap'); // an unresolved slot never passes as blank
  });

  it('unknown slots resolve to undefined (no vacuous match)', () => {
    const f = resolver(ds, RESET_SELECTION);
    for (const e of ['KPI.xx.plan', 'KPI.tl.nope', 'WF.13.plan_pct', 'WF.02.nope', 'TT.99.title', 'CHIP.nope', 'X'])
      expect(f(e), e).toBeUndefined();
  });
});

describe('parity_selections_trucks.csv', () => {
  it('holds the nine selections, unique sel_id + element, one state per selection', () => {
    expect([...new Set(rows.map((r) => r.sel_id))].sort()).toEqual([...SELS].sort());
    const keys = rows.map((r) => `${r.sel_id} ${r.element}`);
    expect(new Set(keys).size).toBe(rows.length);
    for (const s of SELS) expect(new Set(rows.filter((r) => r.sel_id === s).map(stateKey)).size, s).toBe(1);
  });

  it('c_status is filled; accepted rows cite a numbered difference (14) or (16)', () => {
    for (const r of rows) {
      expect(['match', 'accepted', 'gap'], `${r.sel_id} ${r.element}`).toContain(r.c_status);
      if (r.c_status === 'accepted') expect(r.note, `${r.sel_id} ${r.element}`).toMatch(/\((?:14|16)\)/);
    }
  });

  it.skipIf(!HAS_PBI)("carries bip's capture unchanged, row for row", () => {
    const pbi = readRows(readFileSync(PBI_CSV, 'utf8'));
    const ours = new Map(rows.map((r) => [`${r.sel_id} ${r.element}`, r]));
    const pick = (r: Row) =>
      COLUMNS.filter((k) => !['c_status', 'c_value', 'note', 'source'].includes(k)).map((k) => r[k]);
    expect(pbi).toHaveLength(244);
    for (const b of pbi) {
      const r = ours.get(`${b.sel_id} ${b.element}`);
      expect(r, `${b.sel_id} ${b.element}`).toBeDefined();
      expect(pick(r as Row), `${b.sel_id} ${b.element}`).toEqual(pick(b));
    }
  });

  it('the state columns are the §6 deep links', () => {
    const q = (sel: string) => queryOf(rows.find((r) => r.sel_id === sel) as Row).toString();
    const decoded = (sel: string) => decodeURIComponent(q(sel));
    expect(decoded('PT-02')).toBe('w=2023-09&wt=trucks,onspot');
    expect(decoded('PT-03')).toBe('w=2023-10&wt=trucks,onspot');
    expect(decoded('PT-04')).toBe('wt=trucks,onspot&pt=week&calc=linear');
    expect(decoded('PT-05')).toBe('w=2023-05&o=k3&wt=trucks,onspot,undefined&calc=linear');
    expect(decoded('PT-08')).toBe('w=2022-44&wt=trucks,onspot');
  });
});

describe.each(SELS)('PBI = JS %s', (sel) => {
  // the tab 7 contractor rows (CTR.*) need the fixture set too, whatever their selection
  const ix = rows.flatMap((r, i) => (r.sel_id === sel && (unf || !r.element.startsWith('CTR.')) ? [i] : []));
  const skip = sel === FIXTURE_ONLY && !unf; // the fixture set does not ship in a pack

  it.skipIf(skip)('every row equal after normalisation (a gap fails)', () => {
    const off = ix.flatMap((i) => (classify(rows[i] as Row, js[i]) === 'gap' ? [label(i)] : []));
    expect(off).toEqual([]);
  });

  it.skipIf(skip)('c_status / c_value are current (else PARITY_WRITE=1)', () => {
    const stale = ix.flatMap((i) => {
      const r = rows[i] as Row;
      return r.c_value !== (js[i] ?? '') || r.c_status !== classify(r, js[i]) ? [label(i)] : [];
    });
    expect(stale).toEqual([]);
  });
});

// Beyond the captured states: invariants over a grid of selections (no Power BI capture exists for these).
describe('stress grid', () => {
  const offices = ds.m.offices.map((o) => o.office_name);
  const loaders = ds.m.loaders;
  const first = (office: string) => loaders.find((l) => l.office_name === office)?.loader_name as string;
  const outside = (office: string) => loaders.find((l) => l.office_name !== office)?.loader_name as string;
  const zeroVol = loaders.find((l) => l.bucket_volume_m3 === 0)?.loader_name;
  const masks: Pick<Selection, 'offices' | 'loaders' | 'workTypes'>[] = [
    { offices: [], loaders: [], workTypes: ['On spot', 'Trucks'] },
    { offices: [], loaders: [], workTypes: ['Undefined'] },
    { offices: [], loaders: [], workTypes: ['On spot'] },
    ...offices.map((o) => ({ offices: [o], loaders: [], workTypes: ['On spot', 'Trucks'] as WorkType[] })),
    ...offices.map((o) => ({
      offices: [o],
      loaders: [first(o)],
      workTypes: ['On spot', 'Trucks', 'Undefined'] as WorkType[],
    })),
    ...offices.map((o) => ({ offices: [o], loaders: [outside(o)], workTypes: ['On spot', 'Trucks'] as WorkType[] })), // empty
    ...(zeroVol
      ? [{ offices: [], loaders: [zeroVol], workTypes: ['On spot', 'Trucks', 'Undefined'] as WorkType[] }]
      : []),
  ];
  const weeks: (number | null)[] = [null, ...ds.m.weeks.map((w) => w.week_ix)];
  const grid: Selection[] = weeks.flatMap((week) =>
    masks.flatMap((m) =>
      (['Month', 'Week'] as const).flatMap((planType) =>
        (['Weighted', 'Linear'] as const).map((calculation) => ({ ...m, week, planType, calculation })),
      ),
    ),
  );
  const describeSel = (s: Selection) => JSON.stringify(s);

  it(`no NaN / Infinity / undefined on any face, ${grid.length} selections`, () => {
    const bad: string[] = [];
    const BAD = /NaN|Infinity|undefined|null/;
    for (const s of grid) {
      const v = board(ds, s);
      const strings = [
        ...v.tiles.flatMap((t) => [t.plan, t.fact, t.delta]),
        ...v.rows.flatMap((r) => [r.planText, r.factText, r.pill, ...r.tooltip.lines.map((l) => l.value)]),
      ];
      if (strings.some((x) => BAD.test(x))) bad.push(describeSel(s));
      for (const r of v.rows)
        if (![r.planBar.x, r.planBar.width, r.factBar.x, r.factBar.width].every(Number.isFinite))
          bad.push(describeSel(s));
    }
    expect(bad.slice(0, 5)).toEqual([]);
  });

  it('the chain holds wherever a side has rows: base + loss = the level above', () => {
    const bad: string[] = [];
    for (const s of grid) {
      const scope = scopeOf(ds, s);
      for (const side of ['plan', 'fact'] as const) {
        const rows2 = sideShares(ds, scope, side);
        if (
          rows2.every((r) => r.loss === null || r.loss === 0) &&
          rows2.every((r) => r.subtotal === null || r.subtotal === 0)
        )
          continue; // R8
        // the Linear plan subtotal with no hour row is 0 by `1 − COALESCE(…, 1)`, not 1: the chain is a Weighted guarantee there
        let level = rows2[0]?.subtotal ?? 0;
        for (const r of rows2.slice(1)) {
          const sub = [6, 24, 27].includes(r.sort);
          const residual = sub ? (r.subtotal ?? 0) - level : (r.base ?? 0) + (r.loss ?? 0) - level;
          if (Math.abs(residual) > 1e-9 && hasHours(scope, side))
            bad.push(`${side} ${r.sort} ${residual} ${describeSel(s)}`);
          level = sub ? (r.subtotal ?? 0) : (r.base ?? 0);
        }
      }
    }
    expect(bad.slice(0, 10)).toEqual([]);
  });

  const hasHours = (scope: Scope, side: 'plan' | 'fact') => {
    const rows2 = sideShares(ds, scope, side);
    return (rows2.find((r) => r.sort === 6)?.share ?? 0) > 0;
  };

  it.each([
    'w=2023-9', // unpadded: not a manifest key
    'w=2022-53',
    'w=../../etc',
    'w=2023-09&w=2023-10',
    'o=k1,k1,ZZ,%00',
    'o=__proto__',
    'wt=',
    'wt=constructor',
    'wt=TRUCKS,onspot',
    'pt=WEEK&calc=Linear',
    'calc=weighted%20',
    'pt=week&w=2023-14', // no plan-week row at all in week 14
    'l=%F0%9F%9A%9A,LDR-does-not-exist',
    'unknown=1&__proto__=2',
  ])('URL %s never breaks the page and parses idempotently', (query) => {
    const sel = parseSelection(new URLSearchParams(query), ds.m);
    expect(() => board(ds, sel)).not.toThrow();
    const again = parseSelection(new URLSearchParams(serializeSelection(sel, ds.m)), ds.m);
    expect(again).toEqual(sel);
  });
});
