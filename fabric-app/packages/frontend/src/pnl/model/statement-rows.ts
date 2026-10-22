// Which statement rows are rendered (M-20 to M-22, T-16), and the expansion
// rules behind Expand all / Collapse all (ADR-0007 §2.3).
import { roundTo } from './format';
import type { FilterState, StatementRow } from './types';

export interface VisibleRow {
  row: StatementRow;
  depth: number;
  hasChildren: boolean;
  open: boolean;
}

/** Codes of every row that has children: the set Expand all opens (M-20). */
export function expandableCodes(rows: readonly StatementRow[]): ReadonlySet<string> {
  return new Set(rows.map((r) => r.parent).filter((p): p is string => p !== null));
}

/** Collapse all: blocks and subtotals only, nothing open (M-20; the default). */
export const COLLAPSED: ReadonlySet<string> = new Set();

/** One row toggled on its own (M-20): the rest of the state is untouched. */
export function toggleOpen(open: ReadonlySet<string>, code: string): ReadonlySet<string> {
  const next = new Set(open);
  if (next.has(code)) next.delete(code);
  else next.add(code);
  return next;
}

/** Rows to render: ancestors open (M-20/M-21), not empty (M-22). */
export function visibleRows(
  rows: readonly StatementRow[],
  openCodes: ReadonlySet<string>,
  filter: Pick<FilterState, 'hideEmpty'>
): VisibleRow[] {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const hasKids = expandableCodes(rows);
  const out: VisibleRow[] = [];
  for (const row of rows) {
    let depth = 0;
    let shown = true;
    for (let p = row.parent; p !== null; p = byCode.get(p)?.parent ?? null) {
      depth += 1;
      if (!openCodes.has(p)) shown = false;
    }
    if (!shown) continue;
    // T-16: hide-empty never hides a block or subtotal.
    if (filter.hideEmpty && (row.kind === 'leaf' || row.kind === 'ent')) {
      const vals = Object.values(row.values);
      if (vals.every((v) => v === null || roundTo(v, 1) === 0)) continue;
    }
    out.push({ row, depth, hasChildren: hasKids.has(row.code), open: openCodes.has(row.code) });
  }
  return out;
}
