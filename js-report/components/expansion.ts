import type { EntityView, StatementRow } from '@/lib/engine/types';

// M-20 statement expansion presets. A set lists the rows whose children show. Track B's matrix has two levels (report
// line, account), so "collapsed" there shows all 29 numbered lines and no account; here the four operating-expense
// blocks sit under Operating expenses, so collapsed keeps the rows whose children are lines open (parity rule 5).

type Row = Pick<StatementRow, 'kind' | 'parent'>;

const parentsOf = (rows: readonly Row[]) => new Set(rows.flatMap((r) => (r.parent === null ? [] : [r.parent])));

/** Collapse all / the opening state: every report line shows, no account (blocks and subtotals only). */
export const collapsedRows = (rows: readonly Row[]): ReadonlySet<string> =>
  parentsOf(rows.filter((r) => r.kind !== 'leaf'));

/** Expand all: every row with children is open, so every account shows. */
export const expandedRows = (rows: readonly Row[]): ReadonlySet<string> => parentsOf(rows);

/** Stored expansion: the company it belongs to and its open rows; null = collapsed (the opening state). */
export interface Expansion {
  entity: EntityView;
  open: ReadonlySet<string> | null;
}

/** M-21: the stored rows stay open across every filter change; another company opens collapsed. */
export const openRows = (stored: Expansion, entity: EntityView, collapsed: ReadonlySet<string>): ReadonlySet<string> =>
  (stored.entity === entity ? stored.open : null) ?? collapsed;
