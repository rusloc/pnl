import type { Manifest } from '../data/manifest.ts';
import type { ColumnPlan, Selection, VersionPlan } from './types.ts';

// C-50 notices (L-05) and the L-04 context line, from the version plan. Build step 3 covers the period and version
// conditions; the slice-filter (C-31) and Group-view (C-36) notices arrive with steps 5 and 4.

export type NoticeCode = 'PAST_CLOSE' | 'FORECAST_MONTHS' | 'PY_MISSING' | 'PY_PARTIAL' | 'LTM_BEFORE_HISTORY';

export interface Notice {
  code: NoticeCode;
  text: string;
}

const BASE_LABEL = { A: 'Actual', LE: 'Latest estimate', B: 'Budget' } as const;
const COMPARE_LABEL = { B: 'Budget', LE: 'Latest estimate', PY: 'Prior year', NONE: null } as const;

function monthLabels(m: Manifest, months: readonly number[]): string {
  const label = (t: number) => {
    const d = m.tables.dim_month[t];
    return d ? `${d.month_name} ${d.fiscal_year}` : `month ${t}`;
  };
  if (months.length === 0) return '';
  const first = months[0] ?? 0;
  const last = months[months.length - 1] ?? 0;
  return months.length === 1 ? label(first) : `${label(first)} – ${label(last)}`;
}

export function notices(m: Manifest, plan: VersionPlan): Notice[] {
  const out: Notice[] = [];
  const history = monthLabels(m, [0]); // first month of data
  if (plan.droppedMonths.length > 0)
    out.push({
      code: 'PAST_CLOSE',
      text: `Actual covers closed months only: ${monthLabels(m, plan.droppedMonths)} are still open and left out. Choose Latest estimate as the base to include them.`,
    });
  const forecast = [...new Set([...plan.base.forecastMonths, ...compareForecast(plan)])].sort((a, b) => a - b);
  if (forecast.length > 0)
    out.push({
      code: 'FORECAST_MONTHS',
      text: `Latest estimate uses the latest forecast for ${monthLabels(m, forecast)}.`,
    });
  for (const c of [plan.compareA, plan.compareB])
    if (c?.choice === 'PY' && c.missingMonths.length > 0)
      out.push(
        c.parts.length === 0
          ? {
              code: 'PY_MISSING',
              text: `Prior year shows n/a: the data starts in ${history}, so there is no prior year for this window.`,
            }
          : {
              code: 'PY_PARTIAL',
              text: `Prior year has no data for ${monthLabels(m, c.missingMonths)} (before ${history}); it covers the remaining months only.`,
            },
      );
  if (plan.monthsBeforeHistory > 0)
    out.push({
      code: 'LTM_BEFORE_HISTORY',
      text: `LTM starts ${plan.monthsBeforeHistory} month${plan.monthsBeforeHistory === 1 ? '' : 's'} before the data history; it covers ${plan.window.length} months.`,
    });
  return out;
}

const compareForecast = (plan: VersionPlan): number[] =>
  [plan.compareA, plan.compareB].flatMap((c: ColumnPlan | null) => (c ? [...c.forecastMonths] : []));

/** L-04 window label: "YTD Sep 2026", "Sep 2026", "LTM Sep 2026", "FY2026". */
export function windowLabel(m: Manifest, sel: Selection): string {
  const month = m.tables.dim_month.find((d) => d.fiscal_year === sel.fy && d.month_number === sel.month);
  const at = `${month?.month_name ?? sel.month} ${sel.fy}`;
  return sel.timeView === 'FY' ? `FY${sel.fy}` : sel.timeView === 'MTD' ? at : `${sel.timeView} ${at}`;
}

/** L-04 context line: window · versions · currency, units and FX basis · slices. */
export function contextLine(m: Manifest, sel: Selection): string {
  const compares = [COMPARE_LABEL[sel.compareA], COMPARE_LABEL[sel.compareB]].filter((c) => c !== null);
  const versions = compares.length ? `${BASE_LABEL[sel.base]} vs ${compares.join(' and ')}` : BASE_LABEL[sel.base];
  const fx = sel.fxBasis === 'CC' ? 'constant currency' : 'actual rates';
  return [windowLabel(m, sel), versions, `${sel.currency} ${sel.units === 'M' ? 'm' : 'k'}, ${fx}`, 'All slices'].join(
    ' · ',
  );
}
