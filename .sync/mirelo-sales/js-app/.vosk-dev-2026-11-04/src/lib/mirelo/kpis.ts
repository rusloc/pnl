import { CMP_NAMES } from "./copy";
import { STATUS_WORD, cmpRow } from "./status";
import type { CmpRow, DeltaKind } from "./status";
import type { Comparator } from "./types";
import type { Chip } from "./view-model";

// Comparator rows of hero and KPI cards (layout-spec §6 Comparator): hero cards always show Budget and Prior year.
// KPI cards show "vs Budget" and "vs PY" both, Budget first, since 2026-11-01 (owner: the row the ⓘ left is used for
// Budget); a metric without a Budget shows "vs PY" alone. The status chip follows the chosen comparator, falling back
// to the other row. `budget: undefined` = the metric has no Budget at all; `null` = no value for this window.

export interface Bundle {
  actual: number | null;
  budget?: number | null;
  py: number | null;
  ref?: { label: string; value: number | null }; // fixed comparator ("vs prev. cohort", "vs target")
}

export function heroRows(kind: DeltaKind, b: Bundle): [CmpRow, CmpRow] {
  return [
    cmpRow(kind, `vs ${CMP_NAMES.BUD}`, b.actual, b.budget ?? null, true),
    cmpRow(kind, "vs PY", b.actual, b.py, true), // MS-11: Track B wording
  ];
}

export function kpiRows(
  kind: DeltaKind,
  b: Bundle,
  cmp: Comparator,
): { rows: CmpRow[]; chip: Chip | null } {
  if (b.ref) {
    const row = cmpRow(kind, b.ref.label, b.actual, b.ref.value);
    return { rows: [row], chip: chipOf(row) };
  }
  const budget =
    b.budget === undefined
      ? null
      : cmpRow(kind, `vs ${CMP_NAMES.BUD}`, b.actual, b.budget);
  const py = cmpRow(kind, "vs PY", b.actual, b.py);
  const chosen = cmp === "BUD" && budget ? budget : py;
  const other = chosen === py ? budget : py;
  return {
    rows: budget ? [budget, py] : [py],
    chip: chipOf(chosen) ?? (other ? chipOf(other) : null),
  };
}

/** Status chip of a comparator row: glyph (direction) + word (meaning); none when there is no comparison. */
export function chipOf(row: CmpRow): Chip | null {
  if (row.status === "neutral") return null;
  return {
    text: `${row.text.slice(0, 1)} ${STATUS_WORD[row.status]}`,
    status: row.status,
  };
}

/** Hero chip follows the header comparator; falls back to the other row when that one has no value. */
export function heroChip(rows: [CmpRow, CmpRow], cmp: Comparator): Chip | null {
  const [bud, py] = rows;
  return cmp === "BUD"
    ? (chipOf(bud) ?? chipOf(py))
    : (chipOf(py) ?? chipOf(bud));
}
