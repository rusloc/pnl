import type { Manifest } from '../data/manifest.ts';
import { resolveWindow } from './time-windows.ts';
import type { MonthNumber, Selection, TimeView } from './types.ts';

// Period picker v2 (docs/design/period-picker-v2.md Part 1): the live summary sentence, the plain time-view labels,
// the month-grid label per time view and the month cells (covered window, anchor, open months by base version, C-01).
// Copy lives here so the rail, the flyout and the applied-filters pop-up say the same thing (F-02 … F-04).

type DimMonth = Manifest['tables']['dim_month'];
type Period = Pick<Selection, 'fy' | 'month' | 'timeView' | 'base'>;

export const TIME_VIEW_LABEL: Record<TimeView, string> = {
  MTD: 'One month',
  QTD: 'Quarter to date',
  YTD: 'Year to date',
  LTM: 'Last 12 months',
  FY: 'Full year',
};
const TIME_VIEW_ORDER: readonly TimeView[] = ['MTD', 'QTD', 'YTD', 'LTM', 'FY'];

/** What the selected month means in each time view; Full year has no grid. */
const GRID_LABEL: Record<TimeView, string | null> = {
  MTD: 'Month',
  QTD: 'Up to',
  YTD: 'Up to',
  LTM: 'Ending',
  FY: null,
};

export const OPEN_MONTH_HINT = 'Switch the base to Latest estimate to include forecast months.';

const MONTH_NUMBERS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
export const isMonthNumber = (n: number): n is MonthNumber => MONTH_NUMBERS.includes(n);

export interface MonthCell {
  month: MonthNumber;
  name: string;
  /** Inside the window the numbers cover (selected fiscal year's part only). */
  covered: boolean;
  /** The selected month: the end of the window. */
  anchor: boolean;
  /** False = open month under an Actual base (C-01): shown, not selectable. */
  selectable: boolean;
  /** Small label under the month name for open months: "not closed yet", "forecast" or "budget". */
  note: string | null;
}

export interface PeriodView {
  summary: string;
  timeViews: readonly { value: TimeView; label: string }[];
  years: readonly number[];
  /** "Month", "Up to" or "Ending"; null = Full year, the grid is hidden. */
  gridLabel: string | null;
  /** The one line that replaces the grid in Full year. */
  fullYearNote: string | null;
  months: readonly MonthCell[];
  openMonthHint: string;
}

/**
 * The months the numbers contain (period-picker-v2.md rules): the time-view window clipped to the data history, and
 * under an Actual base cut at the last close (C-01), so the sentence matches the version plan and the model's
 * `_Window Label`. "Showing Jan – Sep 2026 - year to date"; one month: "Showing Sep 2026"; across years: "Oct 2025 –
 * Sep 2026"; nothing closed under Actual: "Showing no closed month yet".
 */
export function periodSummary(m: Manifest, p: Period): string {
  const dim = m.tables.dim_month;
  const months = resolveWindow(dim, p.timeView, p.fy, p.month).months.filter(
    (t) => p.base !== 'A' || dim[t]?.is_closed, // closed months are a prefix of dim_month: the cut stays contiguous
  );
  const a = dim[months[0] ?? -1];
  const b = dim[months[months.length - 1] ?? -1];
  if (!a || !b) return 'Showing no closed month yet'; // parity rule 7: exactly this, no time-view tail
  const tail = p.timeView === 'MTD' ? '' : ` - ${TIME_VIEW_LABEL[p.timeView].toLowerCase()}`;
  const end = `${b.month_name} ${b.fiscal_year}`;
  const range =
    a === b
      ? end
      : a.fiscal_year === b.fiscal_year
        ? `${a.month_name} – ${end}`
        : `${a.month_name} ${a.fiscal_year} – ${end}`;
  return `Showing ${range}${tail}`;
}

const longMonth = new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' });

/** "Full year covers January to December." from the fiscal year's first and last month in dim_month. */
function fullYearNote(dim: DimMonth, fy: number): string {
  const year = dim.filter((d) => d.fiscal_year === fy);
  const first = year[0];
  const last = year[year.length - 1];
  if (!first || !last) return '';
  const name = (d: DimMonth[number]) => longMonth.format(new Date(d.month_start_date));
  return `Full year covers ${name(first)} to ${name(last)}.`;
}

const OPEN_NOTE = { A: 'not closed yet', LE: 'forecast', B: 'budget' } as const;

export function periodView(m: Manifest, sel: Period): PeriodView {
  const dim = m.tables.dim_month;
  const inWindow = new Set(resolveWindow(dim, sel.timeView, sel.fy, sel.month).months);
  const months = dim
    .filter((d) => d.fiscal_year === sel.fy)
    .flatMap((d): MonthCell[] => {
      if (!isMonthNumber(d.month_number)) return [];
      const selectable = d.is_closed || sel.base !== 'A'; // C-01: Actual never covers an open month
      return [
        {
          month: d.month_number,
          name: d.month_name,
          covered: selectable && inWindow.has(d.month_index),
          anchor: d.month_number === sel.month,
          selectable,
          note: d.is_closed ? null : OPEN_NOTE[sel.base],
        },
      ];
    });
  const gridLabel = GRID_LABEL[sel.timeView];
  return {
    summary: periodSummary(m, sel),
    timeViews: TIME_VIEW_ORDER.map((value) => ({ value, label: TIME_VIEW_LABEL[value] })),
    years: [...new Set(dim.map((d) => d.fiscal_year))],
    gridLabel,
    fullYearNote: gridLabel === null ? fullYearNote(dim, sel.fy) : null,
    months,
    openMonthHint: OPEN_MONTH_HINT,
  };
}
