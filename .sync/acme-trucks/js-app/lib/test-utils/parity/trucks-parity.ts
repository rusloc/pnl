import { colOf, hoursUnder, isSubtotal, maskSum, planTable, windowSums } from '../../engine/hours.ts';
import { computeKpis } from '../../engine/kpi.ts';
import type { Dataset } from '../../engine/data.ts';
import { RESET_SELECTION } from '../../engine/selection.ts';
import type { Selection } from '../../engine/selection.ts';
import { sideShares } from '../../engine/shares.ts';
import type { RowShares, Scope } from '../../engine/shares.ts';
import { parseSelection, serializeSelection } from '../../engine/url-state.ts';
import { board, scopeOf } from '../../engine/view.ts';
import { roundValue } from '../../engine/format.ts';
import { PILL_FILL, timeShareDelta } from '../../engine/waterfall.ts';

// ACME Trucks PBI = JS parity harness (contract docs/ADD/features/trucks-js-flavour.md §7.2). hunter's own mapping from
// `element` to the engine values and the view model: numbers are read before display rounding, texts from `board()`.
// The selection comes from the row's state columns through the real URL parser, so the §6 deep links are part of the gate.

export const COLUMNS = [
  'sel_id',
  'week',
  'offices',
  'loaders',
  'work_types',
  'plan_type',
  'calculation',
  'element',
  'kind',
  'expected',
  'tol',
  'c_status',
  'b_status',
  'source',
  'c_value',
  'note',
] as const;
export type Row = Record<(typeof COLUMNS)[number], string>;

export const BLANK = 'BLANK ()';

// ---------- CSV (RFC 4180) ----------

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(f);
      f = '';
    } else if (c === '\n') {
      row.push(f.endsWith('\r') ? f.slice(0, -1) : f);
      rows.push(row);
      row = [];
      f = '';
    } else f += c;
  }
  if (f !== '' || row.length > 0) rows.push([...row, f]);
  return rows;
}

export function readRows(text: string): Row[] {
  const [head, ...body] = parseCsv(text.replace(/^﻿/, ''));
  if (!head) throw new Error('empty CSV');
  return body.map((cells, n) => {
    if (cells.length !== head.length) throw new Error(`CSV row ${n + 2}: ${cells.length} cells, header ${head.length}`);
    const o = Object.fromEntries(COLUMNS.map((k) => [k, ''])) as Row;
    head.forEach((k, i) => ((o as Record<string, string>)[k] = cells[i] ?? ''));
    return o;
  });
}

const quote = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
export const writeRows = (rows: readonly Row[]): string =>
  [COLUMNS.join(','), ...rows.map((r) => COLUMNS.map((k) => quote(r[k])).join(','))].join('\n') + '\n';

// ---------- normalisation and comparison (§7.2) ----------

/** Runs of spaces around the `  ·  ` divider collapse. */
export const collapse = (t: string): string => t.replace(/\s*·\s*/g, ' · ').trim();
/** One minus glyph as well. */
export const normalise = (t: string): string => collapse(t.replaceAll('−', '-'));

export type Status = 'match' | 'accepted' | 'gap';

/** Accepted difference 16: Power BI prints `(Blank)` on a blank card; the JS prints `–` (value) or an empty pill (Δ). */
const isBlankCardFace = (expected: string, js: string) => expected === '(Blank)' && (js === '–' || js === '');

export function classify(row: Pick<Row, 'kind' | 'expected' | 'tol'>, js: string | undefined): Status {
  if (js === undefined) return 'gap';
  if (row.kind === 'number') {
    if (row.expected === BLANK || js === BLANK) return row.expected === js ? 'match' : 'gap';
    const want = Number(row.expected);
    const got = Number(js);
    if (!Number.isFinite(want) || !Number.isFinite(got) || js === '') return 'gap';
    return Math.abs(got - want) <= Number(row.tol) * Math.max(1, Math.abs(want)) ? 'match' : 'gap';
  }
  if (collapse(js) === collapse(row.expected)) return 'match';
  if (isBlankCardFace(row.expected, js)) return 'accepted';
  return normalise(js) === normalise(row.expected) ? 'accepted' : 'gap';
}

export function noteOf(row: Pick<Row, 'kind' | 'expected' | 'tol'>, js: string | undefined): string {
  const st = classify(row, js);
  if (st === 'gap') return 'gap';
  if (st === 'match') return '';
  return isBlankCardFace(row.expected, js as string)
    ? 'parity-rules ACME Trucks (16) blank card: PBI prints (Blank), JS the dash / an empty pill'
    : 'parity-rules ACME Trucks (14) minus glyph';
}

// ---------- selection state of a row ----------

export const stateKey = (r: Row): string =>
  [r.week, r.offices, r.loaders, r.work_types, r.plan_type, r.calculation].join('|');

/** The deep link of a row's state columns (absent values are the defaults, as in the §6 table). */
export function queryOf(r: Row): URLSearchParams {
  const q = new URLSearchParams();
  if (r.week) q.set('w', r.week);
  if (r.offices) q.set('o', r.offices);
  if (r.loaders) q.set('l', r.loaders);
  if (r.work_types) q.set('wt', r.work_types);
  if (r.plan_type === 'week') q.set('pt', 'week');
  if (r.calculation === 'linear') q.set('calc', 'linear');
  return q;
}

export const selectionOf = (ds: Dataset, r: Row): Selection => parseSelection(queryOf(r), ds.m);

/** PT-06: no fixed filters and every work type, which no URL can express (fixture set only). */
export const unfilteredSelection = (): Selection => ({ ...RESET_SELECTION, workTypes: [] });

// ---------- element → JS text ----------

const num = (v: number | null): string => (v === null ? BLANK : String(v));

function chainResidual(rows: readonly RowShares[], sort: number): number | null {
  let level = rows.find((r) => r.sort === 1)?.subtotal ?? 0;
  for (const r of rows) {
    if (r.sort === 1) continue;
    const sub = isSubtotal(r.sort);
    const residual = sub ? (r.subtotal ?? 0) - level : (r.base ?? 0) + (r.loss ?? 0) - level;
    if (r.sort === sort) return residual;
    level = sub ? (r.subtotal ?? 0) : (r.base ?? 0);
  }
  return null;
}

export type Resolver = (element: string) => string | undefined;

/** Everything a selection shows, built once; element → the text or number the JS holds (undefined = no such slot). */
export function resolver(ds: Dataset, sel: Selection): Resolver {
  const scope: Scope = scopeOf(ds, sel);
  const plan = sideShares(ds, scope, 'plan');
  const fact = sideShares(ds, scope, 'fact');
  const k = computeKpis(ds, scope, plan, fact);
  const view = board(ds, sel);
  const KPI = { tl: k.truckLoading, ew: k.effectiveWork, pf: k.performance, rm: k.mass } as const;
  const TILE = { tl: 'truckLoading', ew: 'effectiveWork', pf: 'performance', rm: 'mass' } as const;
  type TileKey = keyof typeof KPI;
  const isTile = (x: string | undefined): x is TileKey => x !== undefined && x in KPI;

  return (element) => {
    const [area = '', a, b] = element.split('.');
    if (element === 'HDR.context') return view.context;
    if (area === 'CHIP') return view.chips.find((c) => c.key === a)?.value;
    if (area === 'KPI' && isTile(a)) {
      const t = KPI[a];
      if (b === 'plan') return num(t.plan);
      if (b === 'fact') return num(t.fact);
      if (b === 'delta') return num(t.delta);
      if (b === 'delta_identity') return num((t.delta ?? 0) - ((t.fact ?? 0) - (t.plan ?? 0)));
      return undefined;
    }
    if (area === 'TILE' && isTile(a)) {
      const t = view.tiles.find((x) => x.key === TILE[a]);
      if (!t) return undefined;
      if (b === 'plan_text') return t.plan;
      if (b === 'fact_text') return t.fact;
      if (b === 'delta_text') return t.delta;
      if (b === 'tone') return t.tone;
      return undefined;
    }

    const sort = Number(a);
    const p = plan.find((r) => r.sort === sort);
    const f = fact.find((r) => r.sort === sort);
    const row = view.rows.find((r) => r.sort === sort);
    if (!p || !f || !row) return undefined;
    const delta = timeShareDelta(f.share, p.share);

    if (area === 'WF') {
      switch (b) {
        case 'plan_pct':
          return String(p.share ?? 0);
        case 'fact_pct':
          return String(f.share ?? 0);
        case 'plan_share':
          return num(p.share);
        case 'fact_share':
          return num(f.share);
        case 'delta':
          return num(delta);
        case 'plan_base':
          return num(p.base);
        case 'plan_loss':
          return num(p.loss);
        case 'plan_subtotal':
          return num(p.subtotal);
        case 'fact_base':
          return num(f.base);
        case 'fact_loss':
          return num(f.loss);
        case 'fact_subtotal':
          return num(f.subtotal);
        case 'chain_plan':
          return num(chainResidual(plan, sort));
        case 'chain_fact':
          return num(chainResidual(fact, sort));
        case 'name':
          return row.name;
        case 'plan_text':
          return row.planText;
        case 'fact_text':
          return row.factText;
        case 'delta_text':
          return row.pill;
        case 'fill':
          return PILL_FILL[row.tone];
        case 'plan_bar_w':
          return String(row.planBar.width);
        case 'plan_bar_x':
          return String(row.planBar.x);
        case 'fact_bar_w':
          return String(row.factBar.width);
        case 'fact_bar_x':
          return String(row.factBar.x);
        default:
          return undefined;
      }
    }
    if (area === 'HRS') {
      const c = colOf(sort);
      const blank = (v: number) => (Number.isNaN(v) ? BLANK : String(v));
      if (b === 'plan')
        return blank(
          hoursUnder(
            ds,
            windowSums(ds, planTable(ds, scope.planType), scope.week),
            scope.mask,
            c,
            scope.calculation,
            1,
          ),
        );
      if (b === 'fact')
        return blank(hoursUnder(ds, windowSums(ds, ds.time, scope.week), scope.mask, c, scope.calculation, 3600));
      if (b === 'fact_linear') return blank(maskSum(windowSums(ds, ds.time, scope.week), scope.mask, c) / 3600);
      return undefined;
    }
    if (area === 'TT') {
      if (b === 'delta_pp') return String(roundValue((delta ?? 0) * 100, 2));
      if (b === 'delta_text') return row.tooltip.lines[2]?.value;
      if (b === 'title') return row.tooltip.title;
      return undefined;
    }
    return undefined;
  };
}

/** PT-07: URL behaviour (no engine numbers). */
export function urlResolver(ds: Dataset, r: Row): Resolver {
  const sel = selectionOf(ds, r);
  const workTypeOf = (query: string) => parseSelection(new URLSearchParams(query), ds.m).workTypes.join(', ');
  return (element) => {
    if (element === 'URL.canonical') return serializeSelection(sel, ds.m);
    if (element === 'URL.reset') return serializeSelection(RESET_SELECTION, ds.m);
    if (element === 'URL.wt_empty') return workTypeOf('wt=');
    if (element === 'URL.wt_invalid') return workTypeOf('wt=__proto__,foo');
    return undefined;
  };
}
