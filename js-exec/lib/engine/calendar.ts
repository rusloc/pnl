import type { WeekRow } from '../data/manifest.ts';
import type { ExecData } from './cube.ts';

// Retail calendar windows (E-10 … E-14): 4-5-4, FY = 52 Mon–Sun weeks from the Monday of the week containing 1 Jan.
// Every LY / LW move goes through dim_week's ly_week_key / lw_week_key (E-12, ET-05), never through date arithmetic.

export type PeriodKind = 'W' | 'PTD' | 'YTD';

const week = (d: ExecData, i: number): WeekRow => {
  const w = d.weeks[i];
  if (!w) throw new Error(`calendar: week index ${i} out of range`);
  return w;
};

/** Week indices of the window ending at `asOf` (flow metrics sum over them; point-in-time ones take the last). */
export function windowWeeks(d: ExecData, kind: PeriodKind, asOf: number): number[] {
  const end = week(d, asOf);
  const out: number[] = [];
  for (let i = asOf; i >= 0; i--) {
    const w = week(d, i);
    if (w.fy !== end.fy) break;
    if (kind === 'W' && i !== asOf) break;
    if (kind === 'PTD' && w.period_key !== end.period_key) break;
    out.unshift(i);
  }
  return out;
}

const shift = (d: ExecData, asOf: number, key: 'ly_week_key' | 'lw_week_key'): number | null => {
  const k = week(d, asOf)[key];
  return k === null ? null : (d.weekIx.get(k) ?? null);
};
/** As-of week one retail year back by key (FY2026 W43 → FY2025 W43); null before the data starts. */
export const lyWeek = (d: ExecData, asOf: number): number | null => shift(d, asOf, 'ly_week_key');
/** As-of week moved back one week (PTD / YTD then read "as of last week", data README open point 16). */
export const lwWeek = (d: ExecData, asOf: number): number | null => shift(d, asOf, 'lw_week_key');

/** Control-total period key, e.g. W-FY2026-43, PTD-FY2026-43, YTD-FY2025-43. */
export function periodKey(d: ExecData, kind: PeriodKind, asOf: number): string {
  const w = week(d, asOf);
  return `${kind}-FY${w.fy}-${String(w.week_of_fy).padStart(2, '0')}`;
}

/** Inverse of periodKey; null when the key names no week in the data. */
export function parsePeriodKey(d: ExecData, key: string): { kind: PeriodKind; asOf: number } | null {
  const m = /^(W|PTD|YTD)-FY(\d{4})-(\d{2})$/.exec(key);
  if (!m) return null;
  const asOf = d.weekIx.get(`FY${m[2]}-W${m[3]}`);
  return asOf === undefined ? null : { kind: m[1] as PeriodKind, asOf };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const parts = (iso: string) => {
  const [y = '', m = '', d = ''] = iso.split('-');
  return { y, mon: MONTHS[Number(m) - 1] ?? m, d: String(Number(d)) };
};

/** "19–25 Oct 2026" · "28 Sep–25 Oct 2026" · "29 Dec 2025–25 Oct 2026" (en dash, no locale dependency). */
export function dateRange(fromIso: string, toIso: string): string {
  const a = parts(fromIso);
  const b = parts(toIso);
  if (a.y !== b.y) return `${a.d} ${a.mon} ${a.y}–${b.d} ${b.mon} ${b.y}`;
  if (a.mon !== b.mon) return `${a.d} ${a.mon}–${b.d} ${b.mon} ${b.y}`;
  return `${a.d}–${b.d} ${b.mon} ${b.y}`;
}

/** First and last day of a window. */
export function windowDates(d: ExecData, weeks: readonly number[]): { from: string; to: string } {
  const first = weeks[0];
  const last = weeks.at(-1);
  if (first === undefined || last === undefined) throw new Error('calendar: empty window');
  return { from: week(d, first).week_start, to: week(d, last).week_end };
}

/** Length of the season the week belongs to (AW26 = 20 weeks, E-16); null outside a season. */
export function seasonLength(d: ExecData, asOf: number): number | null {
  const code = week(d, asOf).season_code;
  if (code === null) return null;
  return d.weeks.filter((w) => w.fy === week(d, asOf).fy && w.season_code === code).length;
}

export { week as weekRow };
