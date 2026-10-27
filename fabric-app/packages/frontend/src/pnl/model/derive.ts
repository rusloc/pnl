// Client-side derivation of the statement and KPI variance columns (ADR-0006 §16).
// Q1 and Q2b fetch only the level measures (Base, Compare A/B, FY Budget, FY LE;
// KPI value and its comparisons); the Δ, Δ % and % NR columns are computed here
// with the exact rules of the model's `_PL Δ *`, `PL Δ * %`, `PL % NR` and
// `KPI Δ *` measures (pbi-report/…/_measures.tmdl), so the app prints what the
// model would. Pure functions; every input is the double the connector returned
// (amount rows in the pinned units, ratio rows as fractions). `null` = BLANK.
//
// DAX blank arithmetic that the rules depend on: `BLANK () - x` = `-x` (blank
// base counts as 0 in a difference) while `DIVIDE ( BLANK (), x )` is BLANK and
// `DIVIDE ( x, 0 )` / `DIVIDE ( x, BLANK () )` are BLANK.

/**
 * `_PL Δ A` / `_PL Δ B` / `_PL Δ LE`: blank comparison → blank; otherwise
 * base − comparison on signed values (positive is favourable on every line, the
 * sign lives in the amounts); ratio rows × 100 → percentage points.
 * Scale-free for amount rows: (b − c) / divisor = b / divisor − c / divisor.
 */
export function plDelta(base: number | null, compare: number | null, ratio: boolean): number | null {
  if (compare === null) return null;
  const delta = (base ?? 0) - compare;
  return ratio ? delta * 100 : delta;
}

/** `PL Δ A %` / `PL Δ B %`: blank on ratio rows and blank comparison; (base − c) / |c|; c = 0 → blank. */
export function plDeltaPct(base: number | null, compare: number | null, ratio: boolean): number | null {
  if (ratio || compare === null || compare === 0) return null;
  return ((base ?? 0) - compare) / Math.abs(compare);
}

/** `PL % NR`: blank on ratio rows; row value ÷ the NR line's value of the same column; blank value or NR 0 / blank → blank. */
export function plPctNr(value: number | null, netRevenue: number | null, ratio: boolean): number | null {
  if (ratio || value === null || netRevenue === null || netRevenue === 0) return null;
  return value / netRevenue;
}

/**
 * `KPI Δ A` / `KPI Δ B`: blank when the comparison is None or either side is
 * blank; percent KPIs (value_type PCT / PCT2) in percentage points, every other
 * type relative to |comparison| (0 → blank). Units cancel on amount KPIs.
 */
export function kpiDelta(value: number | null, compare: number | null, percentKpi: boolean, compareIsNone: boolean): number | null {
  if (compareIsNone || value === null || compare === null) return null;
  if (percentKpi) return (value - compare) * 100;
  if (compare === 0) return null;
  return (value - compare) / Math.abs(compare);
}

// ---------------------------------------------------------------------------
// Largest variances (C-45, redesign v4): the `LV *` rules on the level columns
// `LV Base` / `LV Comparison` (already in the pinned units).

/** `LV Δ`: blank when both sides are blank; otherwise base − comparison (a blank side counts as 0). */
export function lvDelta(base: number | null, comparison: number | null): number | null {
  if (base === null && comparison === null) return null;
  return (base ?? 0) - (comparison ?? 0);
}

/**
 * `LV Δ % Text`: blank when both sides are blank; "n.m." when |comparison| < 2.0 display
 * units or |Δ %| > 50 %; otherwise the signed percentage. `comparison` is in display units
 * (millions or thousands, as the model scales it), so the 2.0 test is in those units.
 * Returns the percentage as a number (null = blank, NaN = n.m.) so callers format it.
 */
export function lvDeltaPct(base: number | null, comparison: number | null): number | null {
  if (base === null && comparison === null) return null;
  const c = comparison ?? 0;
  if (Math.abs(c) < 2) return Number.NaN;
  const pct = ((base ?? 0) - c) / Math.abs(c);
  return Math.abs(pct) > 0.5 ? Number.NaN : pct;
}
