import type { WeekRow } from '../data/manifest.ts';
import type { ExecData } from './cube.ts';

// Retail calendar (E-10 … E-12): 4-5-4, FY = 52 Mon–Sun weeks from the Monday of the week containing 1 Jan.
// Windows per granularity live in items.ts. Every LY / LW move goes through dim_week's ly_week_key / lw_week_key
// (E-12, ET-05), never through date arithmetic.

const week = (d: ExecData, i: number): WeekRow => {
  const w = d.weeks[i];
  if (!w) throw new Error(`calendar: week index ${i} out of range`);
  return w;
};

const shift = (d: ExecData, asOf: number, key: 'ly_week_key' | 'lw_week_key'): number | null => {
  const k = week(d, asOf)[key];
  return k === null ? null : (d.weekIx.get(k) ?? null);
};
/** As-of week one retail year back by key (FY2026 W43 → FY2025 W43); null before the data starts. */
export const lyWeek = (d: ExecData, asOf: number): number | null => shift(d, asOf, 'ly_week_key');
/** Week moved back one week (FY2026 W43 → W42; FY2026 W1 → FY2025 W52); null before the data starts. */
export const lwWeek = (d: ExecData, asOf: number): number | null => shift(d, asOf, 'lw_week_key');

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
