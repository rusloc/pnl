// Which statement rows are rendered (M-20 to M-22, T-16).
import { roundTo } from './format';
import type { FilterState, StatementRow } from './types';

const MAX_DEPTH: Record<FilterState['detail'], number> = { summary: 0, standard: 1, full: Infinity };

export interface VisibleRow {
  row: StatementRow;
  depth: number;
  hasChildren: boolean;
  open: boolean;
}

/** Rows to render: ancestors open (M-20/M-21), within the detail level, not empty (M-22). */
export function visibleRows(
  rows: readonly StatementRow[],
  openCodes: ReadonlySet<string>,
  filter: FilterState
): VisibleRow[] {
  const byCode = new Map(rows.map((r) => [r.code, r]));
  const hasKids = new Set(rows.map((r) => r.parent).filter((p): p is string => p !== null));
  const maxDepth = MAX_DEPTH[filter.detail];
  const out: VisibleRow[] = [];
  for (const row of rows) {
    let depth = 0;
    let shown = true;
    for (let p = row.parent; p !== null; p = byCode.get(p)?.parent ?? null) {
      depth += 1;
      if (!openCodes.has(p)) shown = false;
    }
    if (!shown || depth > maxDepth) continue;
    // T-16: hide-empty never hides a block or subtotal.
    if (filter.hideEmpty && (row.kind === 'leaf' || row.kind === 'ent')) {
      const vals = Object.values(row.values);
      if (vals.every((v) => v === null || roundTo(v, 1) === 0)) continue;
    }
    out.push({ row, depth, hasChildren: hasKids.has(row.code), open: openCodes.has(row.code) });
  }
  return out;
}
