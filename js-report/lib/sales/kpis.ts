import { CMP_NAMES } from './copy.ts';
import { STATUS_WORD, cmpRow } from './status.ts';
import type { CmpRow, DeltaKind } from './status.ts';
import type { Comparator } from './types.ts';
import type { Chip } from './view-model.ts';

// Comparator rows of hero and KPI cards (layout-spec §6 Comparator): hero cards always show Budget and Prior year;
// KPI cards show the header comparator, falling back to Prior year when the metric has no Budget, and keep the other
// one for hover. `budget: undefined` = the metric has no Budget at all; `null` = no value for this window.

export interface Bundle {
  actual: number | null;
  budget?: number | null;
  py: number | null;
  ref?: { label: string; value: number | null }; // fixed comparator ("vs prev. cohort", "vs target")
}

export function heroRows(kind: DeltaKind, b: Bundle): [CmpRow, CmpRow] {
  return [
    cmpRow(kind, `vs ${CMP_NAMES.BUD}`, b.actual, b.budget ?? null, true),
    cmpRow(kind, 'vs PY', b.actual, b.py, true), // MS-11: Track B wording
  ];
}

export function kpiRows(kind: DeltaKind, b: Bundle, cmp: Comparator): { row: CmpRow; alt: CmpRow | null } {
  if (b.ref) return { row: cmpRow(kind, b.ref.label, b.actual, b.ref.value), alt: null };
  const budget = b.budget === undefined ? null : cmpRow(kind, `vs ${CMP_NAMES.BUD}`, b.actual, b.budget);
  const py = cmpRow(kind, 'vs PY', b.actual, b.py);
  return cmp === 'BUD' && budget ? { row: budget, alt: py } : { row: py, alt: budget };
}

/** Status chip of a comparator row: glyph (direction) + word (meaning); none when there is no comparison. */
export function chipOf(row: CmpRow): Chip | null {
  if (row.status === 'neutral') return null;
  return { text: `${row.text.slice(0, 1)} ${STATUS_WORD[row.status]}`, status: row.status };
}

/** Hero chip follows the header comparator; falls back to the other row when that one has no value. */
export function heroChip(rows: [CmpRow, CmpRow], cmp: Comparator): Chip | null {
  const [bud, py] = rows;
  return cmp === 'BUD' ? (chipOf(bud) ?? chipOf(py)) : (chipOf(py) ?? chipOf(bud));
}
