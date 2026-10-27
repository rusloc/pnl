// Period picker v2 (docs/design/period-picker-v2.md Part 1; F-02 to F-04, C-01):
// the months a time view covers, the live summary sentence, the month-grid
// label and the open-month rules per base version. The window arithmetic
// mirrors the model's `_Win Start` / `_Win End Raw` / `_Win End` (Track B), so
// the sentence names the months the numbers actually cover: under Actual the
// window stops at the last close (C-01); the start is clipped to the data
// history like the model's `MAX ( [_Win Start], 0 )`.
import { MONTH_SHORT } from './filters';
import type { BaseVersion, FilterState, ReferenceData, TimeView } from './types';

export interface MonthKey {
  fiscalYear: number;
  monthNumber: number;
}

/** Plain labels, in the panel's order (time view first). */
export const TIME_VIEW_OPTIONS: readonly { value: TimeView; label: string }[] = [
  { value: 'month', label: 'One month' },
  { value: 'qtd', label: 'Quarter to date' },
  { value: 'ytd', label: 'Year to date' },
  { value: 'ltm', label: 'Last 12 months' },
  { value: 'fy', label: 'Full year' },
];

/** The sentence's tail per time view; One month has none. */
const TIME_VIEW_TAIL: Record<TimeView, string | null> = {
  month: null,
  qtd: 'quarter to date',
  ytd: 'year to date',
  ltm: 'last 12 months',
  fy: 'full year',
};

/** The month grid's label follows the time view; Full year hides the grid. */
export function monthGridLabel(timeView: TimeView): string | null {
  switch (timeView) {
    case 'month':
      return 'Month';
    case 'qtd':
    case 'ytd':
      return 'Up to';
    case 'ltm':
      return 'Ending';
    case 'fy':
      return null;
  }
}

export const FULL_YEAR_LINE = 'Full year covers January to December.';

/** The window text when no month is covered: the sentence reads exactly "Showing no closed month yet". */
export const NOTHING_COVERED = 'no closed month yet';

export const OPEN_MONTH_TEXT = 'not closed yet';
export const OPEN_MONTH_HINT = 'Switch the base to Latest estimate to include forecast months.';

function serial(m: MonthKey): number {
  return m.fiscalYear * 12 + (m.monthNumber - 1);
}

function fromSerial(s: number): MonthKey {
  return { fiscalYear: Math.floor(s / 12), monthNumber: (s % 12) + 1 };
}

type PeriodInput = Pick<FilterState, 'fiscalYear' | 'month' | 'timeView' | 'baseVersion'>;
type PeriodReference = Pick<ReferenceData, 'months' | 'lastClosed'>;

/**
 * First and last month of the window the base covers: the model's `_Win Start`
 * (clipped to the first month of the data history) and `_Win End` (Actual never
 * runs past the last close). `null` when nothing is covered (an Actual window
 * that lies entirely after the close).
 */
export function coveredWindow(state: PeriodInput, reference: PeriodReference): { start: MonthKey; end: MonthKey } | null {
  const anchor = serial({ fiscalYear: state.fiscalYear, monthNumber: state.month });
  let start: number;
  switch (state.timeView) {
    case 'month':
      start = anchor;
      break;
    case 'qtd':
      start = anchor - ((state.month - 1) % 3);
      break;
    case 'ltm':
      start = anchor - 11;
      break;
    case 'ytd':
    case 'fy':
      start = anchor - (state.month - 1);
      break;
  }
  const endRaw = state.timeView === 'fy' ? anchor - state.month + 12 : anchor;
  const first = reference.months.length > 0 ? Math.min(...reference.months.map(serial)) : start;
  start = Math.max(start, first);
  const end = state.baseVersion === 'ACT' ? Math.min(endRaw, serial(reference.lastClosed)) : endRaw;
  if (end < start) return null;
  return { start: fromSerial(start), end: fromSerial(end) };
}

/** Every month of the covered window, first to last. */
export function coveredMonths(state: PeriodInput, reference: PeriodReference): MonthKey[] {
  const w = coveredWindow(state, reference);
  if (!w) return [];
  const out: MonthKey[] = [];
  for (let s = serial(w.start); s <= serial(w.end); s += 1) out.push(fromSerial(s));
  return out;
}

function short(m: MonthKey): string {
  return MONTH_SHORT[m.monthNumber - 1];
}

/** "Sep 2026", "Jan – Sep 2026", "Oct 2025 – Sep 2026". */
export function rangeText(start: MonthKey, end: MonthKey): string {
  if (serial(start) === serial(end)) return `${short(end)} ${end.fiscalYear}`;
  if (start.fiscalYear === end.fiscalYear) return `${short(start)} – ${short(end)} ${end.fiscalYear}`;
  return `${short(start)} ${start.fiscalYear} – ${short(end)} ${end.fiscalYear}`;
}

/**
 * The window part of the summary sentence: "Jan – Sep 2026 - year to date",
 * "Sep 2026", "Oct 2025 – Sep 2026 - last 12 months" (" - " like all header copy,
 * USER decision 2026-10-23). Shared by the panel
 * (prefixed "Showing "), the rail and the applied-filters pop-up.
 */
export function periodWindowText(state: PeriodInput, reference: PeriodReference): string {
  const w = coveredWindow(state, reference);
  // Actual with every month of the window still open: nothing is covered (C-01); no time-view tail (parity rule 7).
  if (!w) return NOTHING_COVERED;
  const tail = TIME_VIEW_TAIL[state.timeView];
  return tail ? `${rangeText(w.start, w.end)} - ${tail}` : rangeText(w.start, w.end);
}

/** The live summary sentence of the Period panel. */
export function periodSummary(state: PeriodInput, reference: PeriodReference): string {
  return `Showing ${periodWindowText(state, reference)}`;
}

/** Fiscal years offered, ascending, from the reference months (F-02). */
export function fiscalYears(reference: Pick<ReferenceData, 'months'>): number[] {
  return [...new Set(reference.months.map((m) => m.fiscalYear))].sort((a, b) => a - b);
}

export type MonthState =
  | { open: false }
  /** Open month under Actual: not selectable, with the hint (C-01). */
  | { open: true; selectable: false; text: typeof OPEN_MONTH_TEXT; hint: typeof OPEN_MONTH_HINT }
  /** Open month under Latest estimate / Budget: selectable, with its source label. */
  | { open: true; selectable: true; text: 'forecast' | 'budget' };

/** Whether a month is open (after the last close) and how the picker treats it for the base version. */
export function monthState(month: MonthKey, baseVersion: BaseVersion, reference: Pick<ReferenceData, 'months'>): MonthState {
  const ref = reference.months.find((m) => m.fiscalYear === month.fiscalYear && m.monthNumber === month.monthNumber);
  const open = ref ? !ref.isClosed : true;
  if (!open) return { open: false };
  if (baseVersion === 'ACT') return { open: true, selectable: false, text: OPEN_MONTH_TEXT, hint: OPEN_MONTH_HINT };
  return { open: true, selectable: true, text: baseVersion === 'LE' ? 'forecast' : 'budget' };
}
