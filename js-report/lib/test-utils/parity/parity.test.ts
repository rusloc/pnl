import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import { csvTable } from '../../../scripts/csv.ts';
import type { Dataset } from '../../data/dataset.ts';
import { createEngine } from '../../engine/index.ts';
import type { Engine } from '../../engine/index.ts';
import type { CompareChoice, EntityCode, Selection, TimeView } from '../../engine/types.ts';
import { createSalesEngine } from '../../sales/index.ts';
import type { SalesEngine } from '../../sales/index.ts';
import type { Comparator, MarketSel, SalesBase, SalesSelection } from '../../sales/types.ts';
import { monthIndex } from '../../sales/windows.ts';
import { loadPublicDataset } from '../public-data.ts';
import { loadSalesBase } from '../sales-data.ts';
import { selection } from '../selection.ts';
import { resolveMirelo } from './mirelo.ts';
import { resolvePnl } from './pnl.ts';
import type { Resolved } from './pnl.ts';

// Cross-track parity gate (build-brief §5, parity-rules "Check"; docs/ADD/features/parity-check-2026-10-27.md).
// One row = selection × metric × expected value, shared by every track: Track B asserts the same rows as DAX, Track A
// through its own resolver. Here Track C resolves each metric and compares.
//   c_status = match    → must equal the expected value now.
//   c_status = gap:<ID> → the expected value is the contract value Track C does not show yet; the row runs as
//                         it.fails, so the day nerd fixes the gap this file fails and the marker must flip to match.
// Expected values are never a known bug (parity rule 3): where a track is wrong, the row holds the contract value.

const DIR = new URL('./', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, DIR), 'utf8');

type Kind = 'amount' | 'ratio' | 'count' | 'text' | 'status';
interface Row {
  sel: string;
  metric: string;
  kind: Kind;
  expected: string;
  tol: number;
  c: string;
  b: string;
}

const PNL_COLUMNS = [
  'sel_id',
  'entity',
  'fy',
  'month',
  'time_view',
  'compare_a',
  'compare_b',
  'currency',
  'fx_basis',
  'units',
  'metric',
  'kind',
  'expected',
  'tol',
  'c_status',
  'b_status',
  'source',
] as const;
const MIRELO_COLUMNS = [
  'sel_id',
  'market',
  'period',
  'anchor',
  'comparator',
  'metric',
  'kind',
  'expected',
  'tol',
  'c_status',
  'b_status',
  'source',
] as const;
const KINDS = new Set<Kind>(['amount', 'ratio', 'count', 'text', 'status']);
const STATUS = /^(match(:[A-Z0-9-]+)?|gap:[A-Z]{2}-\d{2}|accepted:[A-Z]{2}-\d{2})$/;

function parse<C extends readonly string[]>(file: string, columns: C) {
  const rows: Record<C[number], string>[] = [];
  for (const rec of csvTable(read(file), columns, file))
    rows.push(Object.fromEntries(columns.map((c, i) => [c, rec[i] ?? ''])) as Record<C[number], string>);
  return rows;
}

const toRow = (r: Record<string, string>): Row => ({
  sel: r.sel_id ?? '',
  metric: r.metric ?? '',
  kind: (r.kind ?? '') as Kind,
  expected: r.expected ?? '',
  tol: Number(r.tol),
  c: r.c_status ?? '',
  b: r.b_status ?? '',
});

/** Soft assertions: one run lists every mismatching row of a selection, not just the first. */
function check(row: Row, got: number | string | null | undefined) {
  const where = `${row.sel} ${row.metric}`;
  if (got === undefined) {
    expect.soft(got, `${where}: metric not resolved by Track C`).toBeDefined();
    return;
  }
  if (row.kind === 'text' || row.kind === 'status') expect.soft(got, where).toBe(row.expected);
  else if (typeof got !== 'number') expect.soft(got, `${where}: expected a number`).toBeTypeOf('number');
  else expect.soft(Math.abs(got - Number(row.expected)), where).toBeLessThanOrEqual(row.tol + 1e-9);
}

function suite(rows: Row[], resolve: (sel: string) => Resolved) {
  const bySel = Map.groupBy(rows, (r) => r.sel);
  for (const [sel, list] of bySel)
    describe(sel, () => {
      let resolved: Resolved;
      beforeAll(() => {
        resolved = resolve(sel);
      });
      const matching = list.filter((r) => r.c.startsWith('match'));
      if (matching.length > 0)
        it(`${matching.length} rows match`, () => {
          for (const r of matching) check(r, resolved.get(r.metric));
        });
      for (const r of list.filter((x) => x.c.startsWith('gap:')))
        it.fails(`${r.c} ${r.metric} = ${r.expected} (known Track C gap; flip to match when fixed)`, () => {
          check(r, resolved.get(r.metric));
        });
    });
}

function wellFormed(rows: Row[], file: string) {
  it(`${file}: every row is well formed and unique`, () => {
    const seen = new Set<string>();
    for (const r of rows) {
      const key = `${r.sel}|${r.metric}`;
      expect(seen.has(key), `duplicate ${key}`).toBe(false);
      seen.add(key);
      expect(KINDS.has(r.kind), `${key} kind ${r.kind}`).toBe(true);
      expect(Number.isFinite(r.tol) && r.tol >= 0, `${key} tol`).toBe(true);
      expect(r.c, `${key} c_status`).toMatch(STATUS);
      expect(r.b, `${key} b_status`).toMatch(STATUS);
      if (r.kind !== 'text' && r.kind !== 'status') expect(Number.isFinite(Number(r.expected)), key).toBe(true);
    }
  });
}

// ---------------------------------------------------------------- P&L views redesign v4 (Vitals · Analysis · Profitability)

const pnlRaw = parse('parity_selections.csv', PNL_COLUMNS);
const pnlRows = pnlRaw.map(toRow);
const pnlSel = new Map<string, Selection>(
  pnlRaw.map((r) => [
    r.sel_id,
    selection({
      entity: r.entity as EntityCode,
      fy: Number(r.fy),
      month: Number(r.month) as Selection['month'],
      timeView: r.time_view as TimeView,
      compareA: r.compare_a as CompareChoice,
      compareB: r.compare_b as CompareChoice,
      currency: r.currency as Selection['currency'],
      fxBasis: r.fx_basis as Selection['fxBasis'],
      units: r.units as Selection['units'],
    }),
  ]),
);

let ds: Dataset;
let engine: Engine;

describe('parity P&L (parity_selections.csv)', () => {
  beforeAll(async () => {
    ds = await loadPublicDataset(['P', 'S']);
    engine = createEngine(ds);
  });
  wellFormed(pnlRows, 'parity_selections.csv');
  it('covers the quoted view and both companies, both windows, and the comparator probes', () => {
    expect([...pnlSel.keys()]).toEqual(['S-FY25', 'S-YTD26', 'P-FY25', 'P-YTD26', 'S-FY25-cmpPY', 'S-FY25-noB']);
  });
  suite(pnlRows, (id) => {
    const sel = pnlSel.get(id);
    if (!sel) throw new Error(`unknown selection ${id}`);
    return resolvePnl(ds, engine, sel);
  });
});

// ---------------------------------------------------------------- Mirelo Sales & Revenue

const mirRaw = parse('parity_selections_mirelo.csv', MIRELO_COLUMNS);
const mirRows = mirRaw.map(toRow);
const TV: Readonly<Record<string, SalesSelection['tv']>> = { MONTH: 'M', QTD: 'Q', YTD: 'Y', R12M: 'R' };
const mirSel = new Map<string, SalesSelection>(
  mirRaw.map((r) => [
    r.sel_id,
    {
      view: 'overview',
      market: r.market as MarketSel,
      tv: TV[r.period] ?? 'M',
      anchor: monthIndex(r.anchor),
      cmp: r.comparator as Comparator,
      drill: null,
    },
  ]),
);

let base: SalesBase;
let sales: SalesEngine;

describe('parity Mirelo (parity_selections_mirelo.csv)', () => {
  beforeAll(async () => {
    base = await loadSalesBase();
    sales = createSalesEngine(base);
  });
  wellFormed(mirRows, 'parity_selections_mirelo.csv');
  it('covers Sep 2026, FY2025 and FY2026 YTD × All / PL / RO / PT, plus the PY comparator', () => {
    const ids = [...mirSel.keys()];
    for (const w of ['2026-09', 'FY2025', 'FY2026_YTD_SEP'])
      for (const mk of ['ALL', 'PL', 'RO', 'PT']) expect(ids).toContain(`M-${w}-${mk}`);
    expect(ids).toContain('M-2026-09-ALL-PY');
  });
  suite(mirRows, (id) => {
    const sel = mirSel.get(id);
    if (!sel) throw new Error(`unknown selection ${id}`);
    return resolveMirelo(base, sales, sel);
  });
});
