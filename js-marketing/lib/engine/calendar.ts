// Calendar (contract §2.2, §3.1): calendar days, Monday weeks, no retail calendar. dim_date / dim_month do not ship;
// they are derived here from manifest.meta, and scripts/build-marketing-data.ts asserts the derivation equals both
// tables column for column. Day index 0 = meta.first_day (2025-01-01); month index 0 = 2025-01 (dim_month.month_index).
// "Last year" = the same calendar date one year back (dim_date.ly_date; the data holds no Feb 29). Pure, UTC only.

const MS = 86_400_000;

/** Days since 1970-01-01 of an ISO date (UTC). */
export const epochDay = (iso: string): number => Math.round(Date.parse(`${iso}T00:00:00Z`) / MS);
export const isoOfEpoch = (e: number): string => new Date(e * MS).toISOString().slice(0, 10);

export interface Calendar {
  /** epoch day of day index 0 */
  readonly first: number;
  /** number of actual days (0 … days − 1; the last is the as-of day) */
  readonly days: number;
  readonly asOf: number;
  readonly firstYear: number;
  /** month index of each actual day */
  readonly monthIx: Int32Array;
  iso(ix: number): string;
  ix(iso: string): number;
  /** day index of the same calendar date one year back (may be < 0: before the data) */
  ly(ix: number): number;
  /** day index of the Monday of ix's week (may be < 0) */
  weekStart(ix: number): number;
  monthOf(ix: number): number;
  /** day index of the first day of month m (may be ≥ days for future months) */
  monthStart(m: number): number;
  daysInMonth(m: number): number;
  /** "2026-10" */
  monthKey(m: number): string;
  quarterStart(ix: number): number;
  /** last complete calendar month at day b (README › Monthly logo churn): b's month if b is its last day, else the one before */
  lastCompleteMonth(b: number): number;
}

export function createCalendar(firstDay: string, asOf: string): Calendar {
  const first = epochDay(firstDay);
  const days = epochDay(asOf) - first + 1;
  const firstYear = Number(firstDay.slice(0, 4));
  const ymd = (ix: number) => {
    const d = new Date((first + ix) * MS);
    return { y: d.getUTCFullYear(), m: d.getUTCMonth(), d: d.getUTCDate(), wd: d.getUTCDay() };
  };
  const monthOf = (ix: number) => {
    const { y, m } = ymd(ix);
    return (y - firstYear) * 12 + m;
  };
  const monthIx = new Int32Array(days);
  for (let i = 0; i < days; i++) monthIx[i] = monthOf(i);
  const ymOf = (m: number) => ({ y: firstYear + Math.floor(m / 12), mo: ((m % 12) + 12) % 12 });
  const monthStart = (m: number) => {
    const { y, mo } = ymOf(m);
    return Math.round(Date.UTC(y, mo, 1) / MS) - first;
  };
  const daysInMonth = (m: number) => monthStart(m + 1) - monthStart(m);
  return {
    first,
    days,
    asOf: days - 1,
    firstYear,
    monthIx,
    iso: (ix) => isoOfEpoch(first + ix),
    ix: (iso) => epochDay(iso) - first,
    ly: (ix) => {
      const { y, m, d } = ymd(ix);
      return Math.round(Date.UTC(y - 1, m, d) / MS) - first;
    },
    weekStart: (ix) => ix - ((ymd(ix).wd + 6) % 7),
    monthOf,
    monthStart,
    daysInMonth,
    monthKey: (m) => {
      const { y, mo } = ymOf(m);
      return `${y}-${String(mo + 1).padStart(2, '0')}`;
    },
    quarterStart: (ix) => {
      const { y, m } = ymd(ix);
      return Math.round(Date.UTC(y, m - (m % 3), 1) / MS) - first;
    },
    lastCompleteMonth: (b) => {
      const m = monthOf(b);
      return monthOf(b + 1) !== m ? m : m - 1;
    },
  };
}
