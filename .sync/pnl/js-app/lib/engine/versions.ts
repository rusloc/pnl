import type { Manifest } from '../data/manifest.ts';
import { resolveWindow } from './time-windows.ts';
import type { BaseChoice, ColumnPlan, CompareChoice, PlanPart, Selection, VersionPlan } from './types.ts';

// Spec §7 Versions, C-01 … C-05; D-31.

interface VersionKeys {
  actual: string;
  budget: string;
  latestForecast: { key: string; first: number; last: number } | null;
  closed: ReadonlySet<number>; // N-03: from dim_month.is_closed, never from the latest data date
}

function versionKeys(m: Manifest): VersionKeys {
  const monthIdx = new Map(m.tables.dim_month.map((d) => [d.month_key, d.month_index]));
  const one = (code: 'Actual' | 'Budget') => {
    const rows = m.tables.dim_version.filter((v) => v.version_code === code);
    if (rows.length !== 1 || !rows[0]) throw new Error(`versions: expected one ${code} version, found ${rows.length}`);
    return rows[0].version_key;
  };
  const latest = m.tables.dim_version.find((v) => v.is_latest_forecast);
  return {
    actual: one('Actual'),
    budget: one('Budget'),
    latestForecast: latest
      ? {
          key: latest.version_key,
          first: monthIdx.get(latest.first_month_key) ?? Infinity,
          last: monthIdx.get(latest.last_month_key) ?? -Infinity,
        }
      : null,
    closed: new Set(m.tables.dim_month.filter((d) => d.is_closed).map((d) => d.month_index)),
  };
}

const part = (version: string, months: readonly number[]): PlanPart[] => (months.length ? [{ version, months }] : []);

function column(k: VersionKeys, choice: BaseChoice | 'PY', months: readonly number[]): ColumnPlan {
  switch (choice) {
    case 'A': {
      const closed = months.filter((t) => k.closed.has(t));
      return { choice, parts: part(k.actual, closed), missingMonths: [], forecastMonths: [] };
    }
    case 'B': // C-05: the approved budget of each fiscal year, phased by month
      return { choice, parts: part(k.budget, months), missingMonths: [], forecastMonths: [] };
    case 'LE': {
      // C-02: actuals for closed months + the latest forecast for open months
      const lf = k.latestForecast;
      const closed = months.filter((t) => k.closed.has(t));
      const forecast = months.filter((t) => !k.closed.has(t) && lf !== null && t >= lf.first && t <= lf.last);
      return {
        choice,
        parts: [...part(k.actual, closed), ...(lf ? part(lf.key, forecast) : [])],
        missingMonths: months.filter((t) => !k.closed.has(t) && !forecast.includes(t)),
        forecastMonths: forecast,
      };
    }
    case 'PY': {
      // C-04: base months shifted back 12, Actual version; months before the data history are missing
      const available = months.map((t) => t - 12).filter((t) => t >= 0 && k.closed.has(t));
      return {
        choice,
        parts: part(k.actual, available),
        missingMonths: months.filter((t) => !available.includes(t - 12)),
        forecastMonths: [],
      };
    }
  }
}

const compare = (k: VersionKeys, choice: CompareChoice, months: readonly number[]) =>
  choice === 'NONE' ? null : column(k, choice, months);

export function versionPlan(m: Manifest, sel: Selection): VersionPlan {
  const k = versionKeys(m);
  const w = resolveWindow(m.tables.dim_month, sel.timeView, sel.fy, sel.month);
  // C-01: an Actual base never includes months after the last close
  const months = sel.base === 'A' ? w.months.filter((t) => k.closed.has(t)) : w.months;
  const fullYear = resolveWindow(m.tables.dim_month, 'FY', sel.fy, sel.month).months;
  return {
    window: w.months,
    monthsBeforeHistory: w.monthsBeforeHistory,
    months,
    droppedMonths: w.months.filter((t) => !months.includes(t)),
    base: column(k, sel.base, months),
    compareA: compare(k, sel.compareA, months), // C-03: exactly the months the base covers
    compareB: compare(k, sel.compareB, months),
    fyBudget: column(k, 'B', fullYear), // M-14: whole fiscal year whatever the time view
    fyLE: column(k, 'LE', fullYear),
  };
}

/** No data at all for the column → "n/a" (M-13, C-04). */
export const hasNoData = (c: ColumnPlan) => c.parts.length === 0;
