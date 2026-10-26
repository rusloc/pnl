// Time windows for the Mirelo sales engine (ADR-0011 (g) window rules; layout-spec §6 period picker). Months are
// integer indexes: 0 = Jan 2024 (the first month with actuals), so vintages of the opening book are negative.
// Copied in spirit from the P&L's time-windows, not linked (ADR-0011 (c): no shared business logic).

export type TimeView = 'M' | 'Q' | 'Y' | 'R'; // Month · QTD · YTD · R12M

const FIRST_YEAR = 2024;
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export function monthIndex(key: string): number {
  const m = /^(\d{4})-(\d{2})$/.exec(key);
  if (!m) throw new Error(`month key "${key}" is not YYYY-MM`);
  const month = Number(m[2]);
  if (month < 1 || month > 12) throw new Error(`month key "${key}" has month ${month}`);
  return (Number(m[1]) - FIRST_YEAR) * 12 + month - 1;
}

export function monthKey(index: number): string {
  const year = FIRST_YEAR + Math.floor(index / 12);
  const month = ((index % 12) + 12) % 12;
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

export const monthOfYear = (index: number): number => ((index % 12) + 12) % 12; // 0 = Jan
export const yearOf = (index: number): number => FIRST_YEAR + Math.floor(index / 12);

/** "Sep 2026" */
export const monthLabel = (index: number): string => `${MONTH_NAMES[monthOfYear(index)]} ${yearOf(index)}`;

/** Axis label: "Sep"; January carries the year once as "Jan 26" (design-tokens §7). */
export function axisLabel(index: number): string {
  const name = MONTH_NAMES[monthOfYear(index)] ?? '';
  return monthOfYear(index) === 0 ? `${name} ${String(yearOf(index)).slice(2)}` : name;
}

export interface Window {
  start: number; // first month index (inclusive)
  end: number; // anchor month index (inclusive)
}

/** Window of a time view anchored on a closed month (window facts sum the months in it). */
export function windowOf(tv: TimeView, anchor: number): Window {
  switch (tv) {
    case 'M':
      return { start: anchor, end: anchor };
    case 'Q':
      return { start: anchor - (monthOfYear(anchor) % 3), end: anchor };
    case 'Y':
      return { start: anchor - monthOfYear(anchor), end: anchor };
    case 'R':
      return { start: anchor - 11, end: anchor };
  }
}

export const shift = (w: Window, months: number): Window => ({ start: w.start + months, end: w.end + months });

/** A window is complete when every month of it has data (no actuals before Jan 2024). */
export const isComplete = (w: Window, firstMonth = 0): boolean => w.start >= firstMonth;

export const monthsOf = (w: Window): number[] => Array.from({ length: w.end - w.start + 1 }, (_, i) => w.start + i);

/** The 13 months ending at the anchor (trend charts, sparklines). */
export const trailing13 = (anchor: number): number[] => Array.from({ length: 13 }, (_, i) => anchor - 12 + i);

export const TIME_VIEW_NAMES: Readonly<Record<TimeView, string>> = { M: 'Month', Q: 'QTD', Y: 'YTD', R: 'R12M' };

/** "Sep 2026", "Jul–Sep 2026", "Oct 2025–Sep 2026" (en dash, as in the period line). */
export function windowLabel(w: Window): string {
  if (w.start === w.end) return monthLabel(w.end);
  const s = MONTH_NAMES[monthOfYear(w.start)] ?? '';
  return yearOf(w.start) === yearOf(w.end)
    ? `${s}–${monthLabel(w.end)}`
    : `${monthLabel(w.start)}–${monthLabel(w.end)}`;
}

/** Day number (days since 1970-01-01, UTC) of an ISO date. */
export function dayNumber(iso: string): number {
  const t = Date.parse(`${iso}T00:00:00Z`);
  if (Number.isNaN(t)) throw new Error(`date "${iso}" is not ISO`);
  return Math.round(t / 86_400_000);
}

/** Day number of the last day of a month index. */
export function lastDayOf(index: number): number {
  return dayNumber(`${monthKey(index + 1)}-01`) - 1;
}

/** "29 Sep 2026" from an ISO date (no locale APIs: identical on server and client). */
export function dateLabel(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${Number(d)} ${MONTH_NAMES[Number(m) - 1] ?? '?'} ${y}`;
}
