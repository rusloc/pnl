import { CMP_NAMES } from './copy.ts';
import { cmpRow } from './status.ts';
import type { CmpRow, DeltaKind } from './status.ts';
import type { Comparator } from './types.ts';

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
    cmpRow(kind, `vs ${CMP_NAMES.PY}`, b.actual, b.py, true),
  ];
}

export function kpiRows(kind: DeltaKind, b: Bundle, cmp: Comparator): { row: CmpRow; alt: CmpRow | null } {
  if (b.ref) return { row: cmpRow(kind, b.ref.label, b.actual, b.ref.value), alt: null };
  const budget = b.budget === undefined ? null : cmpRow(kind, `vs ${CMP_NAMES.BUD}`, b.actual, b.budget);
  const py = cmpRow(kind, `vs ${CMP_NAMES.PY}`, b.actual, b.py);
  return cmp === 'BUD' && budget ? { row: budget, alt: py } : { row: py, alt: budget };
}
