import { roundsToZero, type Units } from './format.ts';
import type { Selection, StatementRow, Variance } from './types.ts';

// M-22 / T-16 "Hide empty lines" (parity rule 2): a leaf row is hidden when every number it shows rounds to zero in
// the selected units, on the columns that are visible. Blocks, subtotals and ratios always show.

/** Which statement columns the selection shows (F-07, F-16, F-17); the table draws exactly these. */
export interface StatementColumns {
  pctNr: boolean;
  compareA: boolean;
  compareB: boolean;
  amount: boolean; // Δ amount columns
  percent: boolean; // Δ % columns
  fyOutlook: boolean;
}

export function statementColumns(sel: Selection): StatementColumns {
  return {
    pctNr: sel.showPctNr,
    compareA: sel.compareA !== 'NONE',
    compareB: sel.compareB !== 'NONE',
    amount: sel.varianceFormat !== 'PCT',
    percent: sel.varianceFormat !== 'ABS',
    fyOutlook: sel.showFyOutlook,
  };
}

const PERCENT: Units = { divisor: 0.01, decimals: 1 }; // % NR and Δ % show one decimal (N-06)

/** True when every visible number of the row shows as zero or n/a. */
export function isEmptyLine(row: StatementRow, cols: StatementColumns, units: Units): boolean {
  const cells: [number | null, Units][] = [[row.base, units]];
  if (cols.pctNr) cells.push([row.pctNr, PERCENT]);
  const compare = (v: Variance | null, bar: boolean) => {
    if (!v) return;
    cells.push([v.value, units]);
    if (cols.amount) cells.push([v.delta, units]);
    if (cols.percent || bar) cells.push([v.deltaPct, PERCENT]); // Compare A's bar draws Δ % even without the column
  };
  if (cols.compareA) compare(row.compareA, true);
  if (cols.compareB) compare(row.compareB, false);
  if (cols.fyOutlook) {
    cells.push([row.fyBudget, units], [row.fyLE.value, units]);
    if (cols.amount) cells.push([row.fyLE.delta, units]);
  }
  return cells.every(([v, u]) => v === null || roundsToZero(v, u));
}

/** The rows to draw: all of them, or without empty leaves when Hide empty lines is on (default on, M-22). */
export function hideEmptyLines(rows: readonly StatementRow[], sel: Selection, units: Units): readonly StatementRow[] {
  if (!sel.hideEmpty) return rows;
  const cols = statementColumns(sel);
  return rows.filter((r) => r.kind !== 'leaf' || !isEmptyLine(r, cols, units));
}
