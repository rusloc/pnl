import type { WeekRow } from '../data/manifest.ts';
import { lwWeek, lyWeek, weekRow } from './calendar.ts';
import type { ExecData } from './cube.ts';

// Period model (ADR-0013 (k), E-90 … E-99, docs/ADD/features/exec-period-model.md §2, §3, §6): the items of each
// granularity, derived from dim_week (manifest.weeks), their windows (item weeks ∩ actuals), and the comparator windows.
// Every LY / previous-week move goes through ly_week_key / lw_week_key (E-12), never through date arithmetic.

export const GRANULARITIES = ['W', 'P', 'Q', 'FY'] as const;
export type Granularity = (typeof GRANULARITIES)[number];

/** Bars per granularity (E-96): 13 weeks · 12 months · 8 quarters · 2 years ending at the picked item. */
export const BAR_COUNT: Readonly<Record<Granularity, number>> = { W: 13, P: 12, Q: 8, FY: 2 };

/** A set of whole retail weeks of one FY (indices into d.weeks, ascending); `gran` decides the EBITDA reading (E-93). */
export interface Window {
  gran: Granularity;
  weeks: readonly number[];
}

export interface Item extends Window {
  /** FY2026-W43 (= week_key) · FY2026-P10 (= period_key) · FY2026-Q4 · FY2026. */
  key: string;
  fy: number;
  /** Week / period / quarter number in the FY; 0 for a year. */
  n: number;
  /** Weeks of the complete item. */
  size: number;
  /** Last week of the window: point-in-time metrics read here. */
  last: number;
  /** Last week of the item is after the as-of week: named "to date" (E-92). */
  partial: boolean;
}

export interface Catalog {
  items: Readonly<Record<Granularity, readonly Item[]>>;
  byKey: ReadonlyMap<string, Item>;
  /** The item of each granularity that contains the as-of week (W43 · P10 · Q4 · FY2026 at the shipped data). */
  asOf: Readonly<Record<Granularity, Item>>;
  /** Default on open (E-90): the as-of week. */
  defaultKey: string;
  /** dim_category codes in sort_order: the valid values of the category pick (E-100, URL key `cat`). */
  categories: readonly string[];
}

export const quarterOf = (w: WeekRow): number => Math.ceil(w.period / 3);

const keyOf = (w: WeekRow, g: Granularity): string =>
  g === 'W' ? w.week_key : g === 'P' ? w.period_key : g === 'Q' ? `FY${w.fy}-Q${quarterOf(w)}` : `FY${w.fy}`;
const numberOf = (w: WeekRow, g: Granularity): number =>
  g === 'W' ? w.week_of_fy : g === 'P' ? w.period : g === 'Q' ? quarterOf(w) : 0;

const cache = new WeakMap<ExecData, Catalog>();

/** The 127 items at the shipped data (95 / 22 / 8 / 2, ET-21); items without an actual week are not listed. */
export function catalog(d: ExecData): Catalog {
  const hit = cache.get(d);
  if (hit) return hit;
  const actual = (i: number) => i <= d.asOf && weekRow(d, i).is_actual;
  const build = (g: Granularity): Item[] => {
    const groups = new Map<string, number[]>();
    d.weeks.forEach((w, i) => {
      const k = keyOf(w, g);
      const list = groups.get(k);
      if (list) list.push(i);
      else groups.set(k, [i]);
    });
    return [...groups].flatMap(([key, all]) => {
      const weeks = all.filter(actual);
      const last = weeks.at(-1);
      const first = all[0];
      if (last === undefined || first === undefined) return [];
      const w = weekRow(d, first);
      return [
        {
          gran: g,
          key,
          fy: w.fy,
          n: numberOf(w, g),
          weeks,
          size: all.length,
          last,
          partial: weeks.length < all.length,
        },
      ];
    });
  };
  const items = { W: build('W'), P: build('P'), Q: build('Q'), FY: build('FY') };
  const byKey = new Map(GRANULARITIES.flatMap((g) => items[g].map((x) => [x.key, x] as const)));
  const at = (g: Granularity): Item => {
    const x = byKey.get(keyOf(weekRow(d, d.asOf), g));
    if (!x) throw new Error(`items: no ${g} item holds the as-of week`);
    return x;
  };
  const asOf = { W: at('W'), P: at('P'), Q: at('Q'), FY: at('FY') };
  const out: Catalog = {
    items,
    byKey,
    asOf,
    defaultKey: asOf.W.key,
    categories: d.categories.map((c) => c.category_code),
  };
  cache.set(d, out);
  return out;
}

/** The item of granularity `g` that contains week `i` (listed items only). */
export const containing = (d: ExecData, g: Granularity, i: number): Item | undefined =>
  catalog(d).byKey.get(keyOf(weekRow(d, i), g));

/** The enclosing item of `g` from its start through week L: period / quarter / year to date (stats, EBITDA at Week). */
export function toDate(d: ExecData, g: Granularity, L: number): Window {
  const k = keyOf(weekRow(d, L), g);
  const weeks: number[] = [];
  for (let i = L; i >= 0 && keyOf(weekRow(d, i), g) === k; i--) weeks.unshift(i);
  return { gran: g, weeks };
}

/** Last year: the same weeks one year back by ly_week_key (E-12, E-94); null when any week has no LY (FY2025). */
export function lyWindow(d: ExecData, w: Window): Window | null {
  const weeks = w.weeks.map((i) => lyWeek(d, i));
  return weeks.every((i): i is number => i !== null) ? { gran: w.gran, weeks } : null;
}

/** Previous item at the same granularity (E-94): previous week by lw_week_key; else the item before, cut to the
 *  picked item's week count from its start when the picked item is partial (like-length). Null for the first item. */
export function prevWindow(d: ExecData, x: Item): Window | null {
  if (x.gran === 'W') {
    const lw = lwWeek(d, x.last);
    return lw === null ? null : { gran: 'W', weeks: [lw] };
  }
  const list = catalog(d).items[x.gran];
  const prev = list[list.indexOf(x) - 1];
  if (!prev) return null;
  return { gran: x.gran, weeks: x.partial ? prev.weeks.slice(0, x.weeks.length) : prev.weeks };
}

/** EBITDA flash at Week vs Previous (USER 2026-10-30): month to date through week L vs the previous month's first k
 *  weeks, k = L's week of the month (W43 = P10 weeks 1–4 vs P9 weeks 1–4 = control key P-FY2026-09@4; P1 crosses to
 *  the previous FY's P12). Null (N/A) for the first month of the data and for week 5 of a 5-week month, whose previous
 *  month has only 4 weeks (W9 / W22 / W35 / W48; main-agent ruling 2026-10-30). */
export function prevMonthToDate(d: ExecData, L: number): { win: Window; item: Item } | null {
  const k = toDate(d, 'P', L).weeks.length;
  const x = containing(d, 'P', L);
  const list = catalog(d).items.P;
  const prev = x ? list[list.indexOf(x) - 1] : undefined;
  return prev && prev.weeks.length >= k ? { win: { gran: 'P', weeks: prev.weeks.slice(0, k) }, item: prev } : null;
}

/** Bar label of an item, with arithmetic labels before the data starts (E-96): W31 · P11 · Q1 FY25 · FY25. */
export function barLabel(g: Granularity, fy: number, n: number): string {
  const yy = String(fy).slice(-2);
  return g === 'W' ? `W${n}` : g === 'P' ? `P${n}` : g === 'Q' ? `Q${n} FY${yy}` : `FY${yy}`;
}

const PER_FY: Readonly<Record<Exclude<Granularity, 'FY'>, number>> = { W: 52, P: 12, Q: 4 };

/** The BAR_COUNT items ending at `x` (null where the data has none) and their labels. */
export function seriesOf(d: ExecData, x: Item): { items: readonly (Item | null)[]; labels: readonly string[] } {
  const list = catalog(d).items[x.gran];
  const end = list.indexOf(x);
  const first = list[0];
  if (end < 0 || !first) throw new Error(`items: ${x.key} not listed`);
  const count = BAR_COUNT[x.gran];
  const items: (Item | null)[] = [];
  const labels: string[] = [];
  for (let j = count - 1; j >= 0; j--) {
    const pos = end - j;
    const it = pos >= 0 ? (list[pos] ?? null) : null;
    items.push(it);
    if (it) labels.push(barLabel(x.gran, it.fy, it.n));
    else if (x.gran === 'FY') labels.push(barLabel('FY', first.fy + pos, 0));
    else {
      const per = PER_FY[x.gran];
      const z = first.n - 1 + pos; // pos < 0: steps back from the first listed item
      labels.push(barLabel(x.gran, first.fy + Math.floor(z / per), (((z % per) + per) % per) + 1));
    }
  }
  return { items, labels };
}

/**
 * Control-total period key (E-99): `{W|P|Q|FY}-FY{yyyy}[-{n}][@{k}]` → its window; no `@` = the whole item ∩ actuals,
 * `@k` = the item's first k weeks. Null when the key names no listed item or k exceeds the window.
 */
export function parseItemKey(d: ExecData, key: string): Window | null {
  const m = /^(W|P|Q|FY)-FY(\d{4})(?:-(\d{1,2}))?(?:@(\d{1,2}))?$/.exec(key);
  if (!m) return null;
  const g = m[1] as Granularity;
  const n = m[3];
  if ((g === 'FY') !== (n === undefined)) return null;
  const itemKey =
    g === 'W'
      ? `FY${m[2]}-W${n?.padStart(2, '0')}`
      : g === 'P'
        ? `FY${m[2]}-P${n?.padStart(2, '0')}`
        : g === 'Q'
          ? `FY${m[2]}-Q${n}`
          : `FY${m[2]}`;
  const x = catalog(d).byKey.get(itemKey);
  if (!x) return null;
  const k = m[4] === undefined ? x.weeks.length : Number(m[4]);
  if (k < 1 || k > x.weeks.length) return null;
  return { gran: g, weeks: x.weeks.slice(0, k) };
}
