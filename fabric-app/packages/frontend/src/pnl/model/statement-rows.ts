// Which statement rows are rendered (M-20 to M-22, T-16), and the expansion
// rules behind Expand all / Collapse all (ADR-0007 §2.3).
import { roundTo } from './format';
import type { FilterState, StatementRow, StatementValues } from './types';

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

/** The display settings that decide which value columns the statement shows and how they round. */
export type StatementColumnSettings = Pick<
  FilterState,
  'hideEmpty' | 'units' | 'compareA' | 'compareB' | 'varianceFormat' | 'showPctNr' | 'showFyOutlook'
>;

/** The value columns the statement renders for these settings, in column order (mirrors the view's column groups). */
export function visibleValueKeys(filter: Omit<StatementColumnSettings, 'hideEmpty' | 'units'>): (keyof StatementValues)[] {
  const amount = filter.varianceFormat !== 'pct';
  const pct = filter.varianceFormat !== 'amount';
  const keys: (keyof StatementValues)[] = ['base'];
  if (filter.showPctNr) keys.push('pctNr');
  if (filter.compareA !== 'NONE') keys.push('cmpA', ...(amount ? (['dA'] as const) : []), ...(pct ? (['dApct'] as const) : []));
  if (filter.compareB !== 'NONE') keys.push('cmpB', ...(amount ? (['dB'] as const) : []), ...(pct ? (['dBpct'] as const) : []));
  if (filter.showFyOutlook) keys.push('fyBud', 'fyLe', ...(amount ? (['fyD'] as const) : []));
  return keys;
}

/** Columns that hold percentages whatever the units (1 decimal); the rest are amounts in millions. */
const PERCENT_KEYS: ReadonlySet<keyof StatementValues> = new Set(['pctNr', 'dApct', 'dBpct']);

/**
 * M-22 (parity rule 2): a line is empty when every visible cell rounds to zero in
 * the selected units — 1 decimal in millions, whole thousands in thousands,
 * 1 decimal on percentages. Hidden columns never keep a line visible.
 */
export function isEmptyLine(values: StatementValues, filter: Omit<StatementColumnSettings, 'hideEmpty'>): boolean {
  return visibleValueKeys(filter).every((key) => {
    const v = values[key];
    if (v === null) return true;
    if (PERCENT_KEYS.has(key)) return roundTo(v, 1) === 0;
    return filter.units === 'k' ? roundTo(v * 1000, 0) === 0 : roundTo(v, 1) === 0;
  });
}

/** Rows to render: ancestors open (M-20/M-21), not empty (M-22). */
export function visibleRows(rows: readonly StatementRow[], openCodes: ReadonlySet<string>, filter: StatementColumnSettings): VisibleRow[] {
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
    if (filter.hideEmpty && (row.kind === 'leaf' || row.kind === 'ent') && isEmptyLine(row.values, filter)) continue;
    out.push({ row, depth, hasChildren: hasKids.has(row.code), open: openCodes.has(row.code) });
  }
  return out;
}
