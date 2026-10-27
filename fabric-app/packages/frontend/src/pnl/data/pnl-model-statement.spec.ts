// Q1 rows → StatementRow[] (ADR-0006 phase 1, §16). The fixture carries the model's
// unscaled-to-millions `PL *` level values for Consumer Products, FY2026 YTD Sep,
// Actual vs Budget, taken from data/acme_pl_dummy_data/checks/control_totals_usd.csv
// (rows `P,ACT,FY2026 YTD Sep,*` and `P,BUD,FY2026 YTD Sep,*`), so the mapped
// statement — Δ, Δ % and % NR derived in the app — must print the same figures as
// the control totals and as the sample statement ("3,398.5", "−66.3" in
// pnl-app.spec) — T-06 at the app boundary. Parity with the model's own `PL Δ *`
// columns is proven in pnl-model-statement.parity.spec.ts.
import type { ExecuteQueryInput, QueryTable, SemanticModelQueryResult } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import { describe, expect, it, vi } from 'vitest';

import { defaultFilters } from '../model/filters';
import { fmtAmount, fmtPct, fmtPp } from '../model/format';
import { PnlModelError } from './pnl-model-client';
import { lineDisplay, loadModelStatement, mapStatementRows } from './pnl-model-statement';
import { sampleReference } from './sample-reference';

/** control_totals_usd.csv, entity P, window "FY2026 YTD Sep", in USD. */
const CT = {
  ACT: { GR: 4321001175.05, NR: 3398521942.66, GP: 1679210080.56, OPEX: -647770020.2, SM: -392296680.68, UOP: 560248141.7, PBT: 521374963.28, TAX: -125129991.42 },
  BUD: { GR: 4390283465.78, NR: 3464798688.45, GP: 1726233768.58, OPEX: -674985172.83, SM: -414409869.11, UOP: 576305029.47, PBT: 542331021.92, TAX: -130159445.36 },
} as const;

const M = 1_000_000;

/** The connector's column names: `table[column]` for columns, `[@alias]` for measures. */
const COLUMNS = [
  'dim_pl_row[row_key]', 'dim_pl_row[line_code]', 'dim_pl_row[line_label]', 'dim_pl_row[row_type]', 'dim_pl_row[is_key]',
  'dim_pl_row[tag]', 'dim_pl_row[account_code]', 'dim_pl_row[account_label]', 'dim_pl_row[is_leaf]', 'dim_pl_row[line_sort]',
  'dim_pl_row[account_sort]', '[@base]', '[@cmp_a]', '[@cmp_b]', '[@fy_bud]', '[@fy_le]',
].map((name) => ({ name, dataType: 'String' }));

interface Spec {
  key: string;
  line: string;
  label: string;
  type: string;
  isKey?: boolean;
  tag?: string;
  account?: [code: string, label: string, sort: number];
  sort: number;
  /** Amount lines: USD actual / budget. Ratio lines: fractions. */
  act: number | null;
  bud: number | null;
  ratio?: boolean;
}

/** What the model returns for one row: level columns only — amounts in millions (units pinned to M), ratios as fractions. */
function row(s: Spec): unknown[] {
  const leaf = s.account !== undefined;
  const scale = s.ratio ? 1 : 1 / M;
  const base = s.act === null ? null : s.act * scale;
  const cmpA = s.bud === null ? null : s.bud * scale;
  return [
    s.key, s.line, s.label, s.type, s.isKey ?? false, s.tag ?? '', s.account?.[0] ?? '', s.account?.[1] ?? '', leaf, s.sort,
    s.account?.[2] ?? 0, base, cmpA, null, null, null,
  ];
}

const SPECS: Spec[] = [
  { key: 'NR', line: 'NR', label: 'Net revenue', type: 'subtotal', isKey: true, sort: 30, act: CT.ACT.NR, bud: CT.BUD.NR },
  { key: 'GR', line: 'GR', label: 'Gross revenue', type: 'input_block', sort: 10, act: CT.ACT.GR, bud: CT.BUD.GR },
  { key: 'GR|GR_P2', line: 'GR', label: 'Gross revenue', type: 'input_block', account: ['GR_P2', 'Shipping & delivery fees billed', 20], sort: 10, act: 18_600_000, bud: null },
  { key: 'GR|GR_P1', line: 'GR', label: 'Gross revenue', type: 'input_block', account: ['GR_P1', 'Gross product sales', 10], sort: 10, act: 4302401175.05, bud: 4371883465.78 },
  { key: 'GM_PCT', line: 'GM_PCT', label: 'Gross margin %', type: 'ratio', sort: 60, act: CT.ACT.GP / CT.ACT.NR, bud: CT.BUD.GP / CT.BUD.NR, ratio: true },
  { key: 'OPEX', line: 'OPEX', label: 'Operating expenses', type: 'group_total', sort: 100, act: CT.ACT.OPEX, bud: CT.BUD.OPEX },
  { key: 'SM', line: 'SM', label: 'Sales & marketing', type: 'input_block', sort: 110, act: CT.ACT.SM, bud: CT.BUD.SM },
  { key: 'UOP', line: 'UOP', label: 'Underlying operating profit', type: 'memo', tag: 'MPM', sort: 180, act: CT.ACT.UOP, bud: CT.BUD.UOP },
  { key: 'ETR_PCT', line: 'ETR_PCT', label: 'Effective tax rate %', type: 'ratio', sort: 270, act: -CT.ACT.TAX / CT.ACT.PBT, bud: -CT.BUD.TAX / CT.BUD.PBT, ratio: true },
];

/** Rows deliberately out of display order; the mapper sorts by (line_sort, account_sort). */
const TABLE: QueryTable = { columns: COLUMNS, rows: SPECS.map(row) };

describe('mapStatementRows', () => {
  const rows = mapStatementRows(TABLE);
  const byCode = new Map(rows.map((r) => [r.code, r]));

  it('orders rows by line then account and keys leaves by account code under their line', () => {
    expect(rows.map((r) => r.code)).toEqual(['GR', 'GR_P1', 'GR_P2', 'NR', 'GM_PCT', 'OPEX', 'SM', 'UOP', 'ETR_PCT']);
    expect(byCode.get('GR_P1')).toMatchObject({ kind: 'leaf', parent: 'GR', label: 'Gross product sales', tags: [] });
    expect(byCode.get('SM')).toMatchObject({ kind: 'sec', parent: 'OPEX' });
    expect(byCode.get('GR')?.parent).toBeNull();
  });

  it('numbers the top level in display order and in capitals like Track B’s line_display; accounts keep their names (parity rule 11)', () => {
    expect(rows.filter((r) => r.kind !== 'leaf').map((r) => r.label)).toEqual([
      '01. GROSS REVENUE', '02. NET REVENUE', '03. GROSS MARGIN %', '04. OPERATING EXPENSES', '05. SALES & MARKETING', '06. UNDERLYING OPERATING PROFIT', '07. EFFECTIVE TAX RATE %',
    ]);
    expect(rows.filter((r) => r.kind === 'leaf').map((r) => r.label)).toEqual(['Gross product sales', 'Shipping & delivery fees billed']);
    expect(lineDisplay(29, 'Net margin %')).toBe('29. NET MARGIN %');
  });

  it('maps row_type and is_key to the Ledger row kinds and keeps the tag', () => {
    expect(byCode.get('NR')?.kind).toBe('key');
    expect(byCode.get('GR')?.kind).toBe('sec');
    expect(byCode.get('OPEX')?.kind).toBe('grp');
    expect(byCode.get('UOP')).toMatchObject({ kind: 'memo', tags: ['MPM'] });
    expect(byCode.get('GM_PCT')?.kind).toBe('ratio');
  });

  it('prints the control totals: net revenue 3,398.5 vs budget 3,464.8, Δ −66.3 (−1.9%), 127.1% of NR on gross revenue', () => {
    const nr = byCode.get('NR')!.values;
    expect(fmtAmount(nr.base, 'm')).toBe('3,398.5');
    expect(fmtAmount(nr.cmpA, 'm')).toBe('3,464.8');
    expect(fmtAmount(nr.dA, 'm', true)).toBe('−66.3');
    expect(fmtPct(nr.dApct, true)).toBe('−1.9%');
    expect(fmtPct(nr.pctNr)).toBe('100.0%');
    expect(fmtPct(byCode.get('GR')!.values.pctNr)).toBe('127.1%');
    expect(fmtAmount(byCode.get('OPEX')!.values.base, 'm')).toBe('−647.8');
    // Thousands are a display matter: the mapped value stays in millions.
    expect(fmtAmount(nr.base, 'k')).toBe('3,398,522');
  });

  it('turns ratio rows into percentages with pp deltas and no Δ % / % NR (M-11)', () => {
    const gm = byCode.get('GM_PCT')!.values;
    expect(fmtPct(gm.base)).toBe('49.4%');
    expect(fmtPct(gm.cmpA)).toBe('49.8%');
    expect(fmtPp(gm.dA)).toBe('−0.4 pp');
    expect(gm.dApct).toBeNull();
    expect(gm.pctNr).toBeNull();
    expect(byCode.get('GM_PCT')!.barFraction).toBeNull();
  });

  it('scales the ±15 % bar from the unrounded Δ % and clamps it', () => {
    const nr = byCode.get('NR')!;
    expect(nr.barFraction).toBeCloseTo(nr.values.dApct! / 15, 10);
    const wide = mapStatementRows({
      columns: COLUMNS,
      rows: [row({ key: 'GR', line: 'GR', label: 'Gross revenue', type: 'input_block', sort: 10, act: 2 * M, bud: 1 * M })],
    });
    expect(wide[0].barFraction).toBe(1);
  });

  it('marks only the effective tax rate as a neutral-Δ row', () => {
    expect(byCode.get('ETR_PCT')?.neutralDelta).toBe(true);
    expect(rows.filter((r) => r.neutralDelta)).toHaveLength(1);
  });

  it('keeps blanks as null so hide-empty and formatting treat them as no value (M-13)', () => {
    const leaf = byCode.get('GR_P2')!.values;
    expect(leaf.cmpA).toBeNull();
    expect(leaf.dA).toBeNull();
    expect(leaf.dApct).toBeNull();
    expect(leaf.fyBud).toBeNull();
    expect(byCode.get('GR_P2')!.barFraction).toBeNull();
  });

  it('refuses a result whose shape drifted from the contract', () => {
    expect(() => mapStatementRows({ columns: COLUMNS.slice(0, 12), rows: [] })).toThrow(PnlModelError);
    const odd = row({ key: 'X', line: 'X', label: 'x', type: 'calculated_total', sort: 1, act: 1, bud: 1 });
    expect(() => mapStatementRows({ columns: COLUMNS, rows: [odd] })).toThrow(/Unknown dim_pl_row.row_type: calculated_total/);
  });
});

describe('loadModelStatement', () => {
  it('builds Q1 for the filter, runs it with the row cap and maps the rows', async () => {
    const reference = sampleReference();
    const filter = { ...defaultFilters(reference), month: 6 };
    const executeQuery = vi.fn<(input: ExecuteQueryInput) => Promise<SemanticModelQueryResult>>(async () => ({
      status: 'success',
      table: TABLE,
      requestId: 'req-9',
    }));
    const result = await loadModelStatement({ executeQuery }, filter, reference, 1000);
    expect(result.requestId).toBe('req-9');
    expect(result.rows).toHaveLength(SPECS.length);
    const input = executeQuery.mock.calls[0][0];
    expect(input.resultSetRowCountLimit).toBe(1000);
    expect(input.query).toContain('TREATAS ( { 6 }, param_period[month_number] )');
    expect(input.query).toContain('CONVERT ( [PL Base], DOUBLE )');
  });
});
