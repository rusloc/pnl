import type { Calendar } from './calendar.ts';

// Windows (contract §3.1, §3.2, §3.8, §5.4): presets, comparator windows, the movers window (`_Mv Start`), the dynamics
// window and the trend buckets. Day indices throughout (0 = first day of data); a window is [a, b] inclusive.

export const PRESETS = ['7d', '30d', 'mtd', 'qtd', 'custom'] as const;
export const COMPARATORS = ['prev', 'ly', 'plan', 'none'] as const;
export const GRAINS = ['day', 'week', 'month'] as const;
export type Preset = (typeof PRESETS)[number];
export type Comparator = (typeof COMPARATORS)[number];
export type Grain = (typeof GRAINS)[number];

export interface Win {
  a: number;
  b: number;
  days: number;
}

export const win = (a: number, b: number): Win => ({ a, b, days: b - a + 1 });

/** Window of a preset (end = as-of; Custom: [max(from, first), min(to, as-of)], from > to → the default window). */
export function resolveWindow(cal: Calendar, preset: Preset, from?: number, to?: number): Win {
  const end = cal.asOf;
  switch (preset) {
    case '7d':
      return win(end - 6, end);
    case 'mtd':
      return win(cal.monthStart(cal.monthOf(end)), end);
    case 'qtd':
      return win(cal.quarterStart(end), end);
    case 'custom': {
      const a = Math.max(from ?? 0, 0);
      const b = Math.min(to ?? end, end);
      return a <= b ? win(a, b) : win(end - 29, end);
    }
    default:
      return win(end - 29, end);
  }
}

/** Previous period = the same number of days immediately before. */
export const previous = (w: Win): Win => win(w.a - w.days, w.a - 1);
/** Same period last year = the same calendar dates one year back. */
export const lastYear = (cal: Calendar, w: Win): Win => win(cal.ly(w.a), cal.ly(w.b));

/** Comparison window of the comparator (Plan / None have none). */
export function basis(cal: Calendar, w: Win, cmp: Comparator): Win | null {
  if (cmp === 'prev') return previous(w);
  if (cmp === 'ly') return lastYear(cal, w);
  return null;
}

/** Movers window (O5 / O6, §3.8, §11 rule 1): when the comparison window would start before the first day of data and
 *  the window is longer than 30 days, the window's last 30 days; else the window itself. Its basis follows the same
 *  comparator (LY in LY mode, else the previous period — also under Plan / None, as `_Mv Start`). */
export function moversWindow(cal: Calendar, w: Win, cmp: Comparator): { now: Win; before: Win } {
  const ly = cmp === 'ly';
  const basisStart = ly ? cal.ly(w.a) : w.a - w.days;
  const now = basisStart < 0 && w.days > 30 ? win(w.b - 29, w.b) : w;
  return { now, before: ly ? lastYear(cal, now) : previous(now) };
}

/** Dynamics pop-up window (§5.4): the window, or its last 30 days when longer than 90 days. */
export const dynamicsWindow = (w: Win): Win => (w.days > 90 ? win(w.b - 29, w.b) : w);

/** Trend buckets of O3 (`Trend Spend`): one per bucket, at the bucket's first day inside the window. */
export function buckets(cal: Calendar, w: Win, grain: Grain): Win[] {
  const out: Win[] = [];
  for (let d = w.a; d <= w.b;) {
    let end = d;
    if (grain === 'week') end = Math.min(w.b, cal.weekStart(d) + 6);
    else if (grain === 'month') end = Math.min(w.b, cal.monthStart(cal.monthOf(d) + 1) - 1);
    out.push(win(d, end));
    d = end + 1;
  }
  return out;
}
