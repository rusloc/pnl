// Page top shared by the three tracks (docs/design/period-picker-v2.md Part 2):
// the status line on the title row (N-02, N-03) and the rows of the applied-
// filters pop-up, the same rows as Track B's `dim_filter_row` / `Filter Value`
// (company, fiscal year, period, time view, versions, currency, FX basis, units,
// regions, slices) followed by the notices (C-50; L-04 / L-05 as amended).
// Everything is derived client-side from the filter state, the reference data
// and the model's notices; no extra model measure.
import { COMPANY_THEME } from '../theme/company';
import { activeSlices, MONTH_SHORT, SLICE_SLOTS, VERSION_LABEL } from './filters';
import { periodSummary, TIME_VIEW_OPTIONS } from './period';
import type { FilterState, ReferenceData } from './types';

/** " - " everywhere in header copy (Part 2). */
export const HEADER_SEPARATOR = ' - ';

/**
 * The model's refresh timestamp (`_meta_refresh[refreshed_at]`, Q6 `@refreshed`,
 * an ISO-like string) → "22 Oct 2026 13:53", read as stored (no time-zone shift,
 * like Track B's FORMAT). Anything else → null, never an invented time.
 */
export function refreshedText(raw: string | null): string | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(raw);
  if (!m) return null;
  const month = MONTH_SHORT[Number(m[2]) - 1];
  if (!month) return null;
  return `${Number(m[3])} ${month} ${m[1]} ${m[4]}:${m[5]}`;
}

/**
 * `<Company> - Management reporting - Closed through <Mon YYYY> - Refreshed <d Mon YYYY HH:MM>`;
 * the refresh segment is omitted while the model has not answered (no invented time).
 */
export function statusLine(filter: Pick<FilterState, 'entity'>, reference: Pick<ReferenceData, 'lastClosed'>, refreshed: string | null): string {
  const closed = reference.lastClosed;
  const parts = [
    COMPANY_THEME[filter.entity].short,
    'Management reporting',
    `Closed through ${MONTH_SHORT[closed.monthNumber - 1]} ${closed.fiscalYear}`,
  ];
  if (refreshed) parts.push(`Refreshed ${refreshed}`);
  return parts.join(HEADER_SEPARATOR);
}

export interface FilterRow {
  label: string;
  value: string;
}

function versionsText(filter: FilterState): string {
  const base = VERSION_LABEL[filter.baseVersion];
  const a = filter.compareA === 'NONE' ? null : VERSION_LABEL[filter.compareA];
  const b = filter.compareB === 'NONE' ? null : VERSION_LABEL[filter.compareB];
  if (!a && !b) return `${base} only`;
  if (!b) return `${base} vs ${a} (A)`;
  if (!a) return `${base} vs ${b} (B)`;
  return `${base} vs ${a} (A) and ${b} (B)`;
}

// Selected values are listed in the dimension's own order (`sort_order`, the order
// the reference data carries), not alphabetically (parity rule 10).

function regionsText(filter: FilterState, reference: ReferenceData): string {
  if (filter.regions === null) return 'All regions';
  const selected = new Set(filter.regions);
  return reference.regions
    .filter((r) => selected.has(r.code))
    .map((r) => r.name)
    .join(', ');
}

function slicesText(filter: FilterState, reference: ReferenceData): string {
  if (filter.entity === 'G') return 'Consolidated: channel, category and segment do not apply';
  const slices = activeSlices(filter);
  if (!slices || SLICE_SLOTS.every((slot) => slices[slot] === null)) return 'All slices';
  const sets = reference.slices[filter.entity];
  return SLICE_SLOTS.map((slot) => {
    const sel = slices[slot];
    const names =
      sel === null
        ? 'All'
        : sets[slot].values
            .filter((v) => sel.includes(v.code))
            .map((v) => v.name)
            .join(', ');
    return `${sets[slot].label}: ${names}`;
  }).join(HEADER_SEPARATOR);
}

/** The ten filter rows, in Track B's order. */
export function filterRows(filter: FilterState, reference: ReferenceData): FilterRow[] {
  const company = filter.entity === 'G' ? 'ACME Group (consolidated)' : COMPANY_THEME[filter.entity].short;
  const timeView = TIME_VIEW_OPTIONS.find((o) => o.value === filter.timeView)?.label ?? filter.timeView;
  return [
    { label: 'Company', value: company },
    { label: 'Fiscal year', value: String(filter.fiscalYear) },
    { label: 'Period', value: periodSummary(filter, reference) },
    { label: 'Time view', value: timeView },
    { label: 'Versions', value: versionsText(filter) },
    { label: 'Currency', value: filter.currency },
    { label: 'FX basis', value: filter.fxBasis === 'constant' ? `Constant currency (FY${filter.fiscalYear} budget rates)` : 'Actual rates' },
    { label: 'Units', value: filter.units === 'k' ? 'Thousands' : 'Millions' },
    { label: 'Regions', value: regionsText(filter, reference) },
    { label: 'Slices', value: slicesText(filter, reference) },
  ];
}

/**
 * Row label per notice, Track B's `dim_filter_row` labels (parity rule 9), keyed on
 * the opening words of the model's `Notices` texts (the app's offline notices use
 * the same words). Anything else is a plain "Notice".
 */
const NOTICE_LABELS: readonly [test: RegExp, label: string][] = [
  [/^Actuals closed through /, 'Cut-off'],
  [/^Forecast months included/, 'Forecast'],
  [/^Prior year n\/a/, 'Prior year'],
  [/^LTM starts before /, 'History'],
  [/^Slice filter on/, 'Allocation'],
  [/^ACME Group: /, 'Eliminations'],
  [/^(Sample figures|Reference data) /, 'Sample'],
];

export function noticeLabel(notice: string): string {
  return NOTICE_LABELS.find(([test]) => test.test(notice))?.[1] ?? 'Notice';
}

/** One labelled row per notice that applies (C-50); no row at all when none does (parity rule 9). */
export function noticeRows(notices: readonly string[]): FilterRow[] {
  return notices.map((value) => ({ label: noticeLabel(value), value }));
}
