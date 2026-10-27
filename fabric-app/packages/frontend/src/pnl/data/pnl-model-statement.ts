// Live statement (ADR-0006 phase 1, §16): Q1 rows from the semantic model → `StatementRow[]`.
// The model owns every §7 rule; this file reshapes rows, scales units and derives
// the variance columns (Δ, Δ %, % NR) from the five level columns with the model's
// own rules (`model/derive.ts`). Amount cells arrive in millions (param_units
// pinned to M), ratios as fractions (0.494 → 49.4 %).
import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';

import { plDelta, plDeltaPct, plPctNr } from '../model/derive';
import type { FilterState, ReferenceData, RowKind, StatementRow, StatementValues } from '../model/types';
import {
  cellBoolean,
  cellNumber,
  cellString,
  indexColumns,
  type ModelQueryRunner,
  PnlModelError,
  runModelQuery,
} from './pnl-model-client';
import { buildStatementQuery, STATEMENT_COLUMNS as C } from './pnl-model-queries';

/** dim_pl_row.row_type → the Ledger row kind; key subtotals are `is_key` (M-04). */
const ROW_KIND: Record<string, RowKind> = {
  input_block: 'sec',
  group_total: 'grp',
  subtotal: 'sub',
  memo: 'memo',
  ratio: 'ratio',
};

/** dim_report_line.parent_line_code for the OPEX group; dim_pl_row carries no parent column. */
const LINE_PARENT: Record<string, string> = { SM: 'OPEX', RD: 'OPEX', GA: 'OPEX', OOI: 'OPEX' };

/** The ±15 % bar scale (M-12). */
const BAR_SCALE_PCT = 15;

/** The one line whose Δ never carries favourable / unfavourable colour (M-11). */
const NEUTRAL_DELTA_LINE = 'ETR_PCT';

const REQUIRED = Object.values(C);

/** The line whose Base is the `% NR` denominator (`PL % NR`: `dim_pl_row[line_code] = "NR"`, lines only). */
const NET_REVENUE_LINE = 'NR';

function scaled(value: number | null, factor: number): number | null {
  return value === null ? null : value * factor;
}

export interface LiveStatementResult {
  rows: StatementRow[];
  requestId: string;
}

/** Pure: a Q1 result table → statement rows in display order (line_sort, account_sort). */
export function mapStatementRows(table: QueryTable): StatementRow[] {
  const col = indexColumns(table, REQUIRED);
  const read = (row: unknown[], name: string) => row[col.get(name) as number];

  // `PL % NR` divides by the NR line's Base of the same column (same filters, dim_pl_row removed).
  const nrRow = table.rows.find((row) => cellString(read(row, C.lineCode)) === NET_REVENUE_LINE && !cellBoolean(read(row, C.isLeaf)));
  const netRevenue = nrRow === undefined ? null : cellNumber(read(nrRow, C.base));

  const mapped = table.rows.map((row) => {
    const lineCode = cellString(read(row, C.lineCode));
    const isLeaf = cellBoolean(read(row, C.isLeaf));
    const rowType = cellString(read(row, C.rowType));
    const tag = cellString(read(row, C.tag));

    let kind: RowKind;
    if (isLeaf) {
      kind = 'leaf';
    } else {
      const base = ROW_KIND[rowType];
      if (base === undefined) throw new PnlModelError('query', `Unknown dim_pl_row.row_type: ${rowType}`);
      kind = base === 'sub' && cellBoolean(read(row, C.isKey)) ? 'key' : base;
    }
    const ratio = kind === 'ratio';
    const num = (name: string) => cellNumber(read(row, name));
    // Ratio rows: levels are fractions → percent; Δ already in pp; no Δ % and no % NR (M-11).
    // Derive on the model's raw values (fractions on ratio rows), then scale for display:
    // ratio levels → percent; Δ on ratio rows is already in pp; Δ % and % NR → percent.
    const base = num(C.base);
    const cmpA = num(C.cmpA);
    const cmpB = num(C.cmpB);
    const fyBud = num(C.fyBud);
    const fyLe = num(C.fyLe);
    const level = (value: number | null) => (ratio ? scaled(value, 100) : value);
    const values: StatementValues = {
      base: level(base),
      pctNr: scaled(plPctNr(base, netRevenue, ratio), 100),
      cmpA: level(cmpA),
      dA: plDelta(base, cmpA, ratio),
      dApct: scaled(plDeltaPct(base, cmpA, ratio), 100),
      cmpB: level(cmpB),
      dB: plDelta(base, cmpB, ratio),
      dBpct: scaled(plDeltaPct(base, cmpB, ratio), 100),
      fyBud: level(fyBud),
      fyLe: level(fyLe),
      fyD: plDelta(fyLe, fyBud, ratio),
    };
    const barFraction =
      values.dApct === null ? null : Math.max(-1, Math.min(1, values.dApct / BAR_SCALE_PCT));

    const statementRow: StatementRow = {
      code: isLeaf ? cellString(read(row, C.accountCode)) : lineCode,
      parent: isLeaf ? lineCode : (LINE_PARENT[lineCode] ?? null),
      kind,
      label: cellString(read(row, isLeaf ? C.accountLabel : C.lineLabel)),
      alias: '',
      tags: tag === '' ? [] : [tag],
      values,
      barFraction,
      neutralDelta: !isLeaf && lineCode === NEUTRAL_DELTA_LINE,
    };
    return {
      statementRow,
      lineSort: cellNumber(read(row, C.lineSort)) ?? 0,
      accountSort: cellNumber(read(row, C.accountSort)) ?? 0,
    };
  });

  mapped.sort((a, b) => a.lineSort - b.lineSort || a.accountSort - b.accountSort);
  // Parity rule 11: the top level is numbered and in capitals like Track B's dim_pl_row[line_display].
  let lineRank = 0;
  for (const m of mapped) {
    if (m.statementRow.kind === 'leaf') continue;
    lineRank += 1;
    m.statementRow.label = lineDisplay(lineRank, m.statementRow.label);
  }
  return mapped.map((m) => m.statementRow);
}

/**
 * Track B's `dim_pl_row[line_display]` ("01. GROSS REVENUE" … "29. NET MARGIN %"):
 * the line's rank in display order over every line, ratio rows included, then its
 * name in capitals. Derived here from the Q1 line rows (every dim_report_line row
 * comes back, in line_sort order) because the column is not in the published model
 * yet; it reproduces the model's formula `FORMAT ( COUNTROWS ( FILTER ( dim_report_line,
 * sort_order <= _sort ) ), "00" ) & ". " & UPPER ( line_name )`.
 */
export function lineDisplay(rank: number, label: string): string {
  return `${String(rank).padStart(2, '0')}. ${label.toUpperCase()}`;
}

/** Builds Q1 for the filter, runs it on the connector, maps the rows. */
export async function loadModelStatement(
  runner: ModelQueryRunner,
  filter: FilterState,
  reference: ReferenceData,
  rowLimit: number
): Promise<LiveStatementResult> {
  const query = buildStatementQuery(filter, reference);
  const { table, requestId } = await runModelQuery(runner, query, rowLimit);
  return { rows: mapStatementRows(table), requestId };
}
