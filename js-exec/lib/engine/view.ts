import type { Scope } from '../data/manifest.ts';
import { dateRange, seasonLength, weekRow, windowDates } from './calendar.ts';
import { sum, sumSites, SCOPE_GROUPS } from './cube.ts';
import type { ExecData } from './cube.ts';
import {
  ATTRIBUTES,
  BASIS_LABEL,
  CARD_COPY,
  DRILL_PAGES,
  PERIOD_WORDS,
  STATUS_GLYPH,
  STATUS_WORD,
  SWITCH_LABELS,
  TO_DATE,
} from './copy.ts';
import type { AttrKey, CardCopy } from './copy.ts';
import {
  eurDelta,
  eurM,
  eurMParts,
  int,
  num,
  pct,
  pctNum,
  pctSigned,
  pctTarget,
  pp,
  refreshStamp,
  share,
  signed,
  unitsM,
} from './format.ts';
import {
  catalog,
  containing,
  GRANULARITIES,
  lyWindow,
  prevMonthToDate,
  prevWindow,
  seriesOf,
  toDate,
} from './items.ts';
import type { Catalog, Granularity, Item, Window } from './items.ts';
import { availabilityByCategory, computeMetrics, gmroiByCategory, sellThroughByCategory } from './metrics.ts';
import type { Metrics } from './metrics.ts';
import type { Dot, Status } from './status.ts';
import { COMPARATORS, normalize, REGIONS } from './url-state.ts';
import type { Comparator, Region, Selection } from './url-state.ts';

// View model of the landing page (ADR-0012 card face; E-20 … E-58; period model E-90 … E-98). Components render these
// strings and numbers as they are: every value, Δ text, chip, bar, worked example, mini stat of every card and every
// period-picker chip is decided here.

/** Rich text without HTML: segments, some bold. */
export type Rich = readonly { text: string; strong?: boolean }[];
const t = (text: string): { text: string } => ({ text });
const b = (text: string): { text: string; strong: true } => ({ text, strong: true });

export type CardStatus = Status | 'na';
export type CardSize = 'hero' | 'med' | 'sm';
/** Overall dot; grey when no card has a status (E-95). */
export type DotView = Dot | 'grey';

export interface Bars {
  values: readonly (number | null)[];
  target: number | null;
  labels: readonly string[];
}

export interface CardView {
  id: string;
  title: string;
  sub: string;
  size: CardSize;
  tier: 1 | 2;
  status: CardStatus;
  word: string;
  glyph: string;
  rule: string;
  value: string;
  unit: string;
  delta: string;
  /** The Δ has no comparison value ("n/a vs …"): shown muted whatever the status colour (E-21 pattern). */
  deltaNa: boolean;
  /** ⓘ target line under the value (USER 2026-10-29): the status basis (dim_kpi.basis label + the basis metric,
   *  E-24, whatever the comparator), split like `value` / `unit`; value "n/a" when the basis is blank. */
  target: { label: string; value: string; unit: string } | null;
  bars: Bars | null;
  /** Channel mix only: store / online / wholesale shares in % (the pop-up mix bar). */
  mix: readonly [number, number, number] | null;
  tags: Readonly<Record<AttrKey, string>>;
  revealed: boolean;
  explain: {
    eyebrow: string;
    /** Δ line of the pop-up: the card Δ, or a longer one naming the compared window where the card's is shortened
     *  (EBITDA at Week vs Previous: "vs P9 weeks 1–4", USER 2026-10-30). */
    delta: string;
    stats: readonly (readonly [string, string])[];
    rows: readonly (readonly [string, Rich])[];
    tags: readonly (readonly [string, string])[];
    /** Refresh stamp, "Updated weekly" or the provisional note (the "Target …" footer is gone, USER 2026-10-29). */
    updated: string;
    drillLabel: string;
  };
  drill: { eyebrow: string; steps: readonly (readonly [string, string])[] };
}

/** One single-select chip of the Filters menu; `next` is the whole Selection it applies (already normalised). */
export interface Chip {
  id: string;
  label: string;
  checked: boolean;
  next: Selection;
}

export interface MenuView {
  /** Period picker (E-90, E-91): granularity → fiscal year (not at Year) → one item. */
  granularity: readonly Chip[];
  fy: readonly Chip[] | null;
  items: readonly Chip[];
  /** Week and Month items sit in a compact grid (up to 52 chips). */
  itemGrid: boolean;
  /** Live summary under the picker = the header period line. */
  showing: Rich;
  /** "Previous" is not offered at Year (USER 2026-10-29). */
  compare: readonly Chip[];
  region: readonly Chip[];
}

export interface DashboardView {
  header: { period: Rich; compare: Rich; region: Rich; refreshed: string };
  status: {
    dot: DotView;
    dotTip: readonly [string, string];
    counts: { on: number; watch: number; off: number };
    shown: number;
    total: number;
    picks: string;
    picked: number;
  };
  cards: readonly CardView[];
  menu: MenuView;
  how: { eyebrow: string; bullets: readonly Rich[]; foot: readonly [string, string] };
  bench: {
    count: number;
    domains: readonly { domain: string; items: readonly (readonly [string, string, string])[] }[];
  };
}

const SCOPE: Readonly<Record<Region, Scope>> = { all: 'ALL', nl: 'NL', be: 'BE', online: 'ONLINE' };
const SIZE: Readonly<Record<string, CardSize>> = { hero: 'hero', medium: 'med', small: 'sm' };
const STATUS_OF: Readonly<Record<number, Status>> = { 1: 'good', 2: 'watch', 3: 'off' };
const DOT_OF: Readonly<Record<number, Dot>> = { 1: 'green', 2: 'orange', 3: 'red' };
const CHANNELS = ['store', 'online', 'wholesale'] as const;
const NA = 'n/a';

type M = Metrics | null;
const val = (m: M, key: string): number | undefined => (m ? m[key] : undefined);
const fmt = (x: number | undefined, f: (x: number) => string): string => (x === undefined ? NA : f(x));

interface Ctx {
  d: ExecData;
  cat: Catalog;
  sel: Selection;
  scope: Scope;
  item: Item;
  /** Last week of the item's window: point-in-time cards and their mini stats read here (E-93). */
  L: number;
  cur: Metrics;
  ly: M;
  prev: M;
  /** EBITDA flash window (E-93): month to date through the week at Week; the item's own window otherwise.
   *  `prevName` names the previous window at Week ("P9 weeks 1–4"); null otherwise. */
  eb: { cur: Metrics; ly: M; prev: M; prevName: string | null };
  /** The BAR_COUNT items ending at the picked one (null before the data starts) and their labels (E-96). */
  series: readonly M[];
  labels: readonly string[];
  words: (typeof PERIOD_WORDS)[Granularity];
  refresh: { long: string; short: string };
}

export function buildView(d: ExecData, sel: Selection): DashboardView {
  const cat = catalog(d);
  const scope = SCOPE[sel.region];
  const item = (sel.item === null ? undefined : cat.byKey.get(sel.item)) ?? cat.asOf.W;
  const at = (w: Window | null): M => (w === null ? null : computeMetrics(d, scope, w));
  const s = seriesOf(d, item);
  const series = s.items.map(at);
  const cur = series.at(-1) ?? computeMetrics(d, scope, item);
  const ly = at(lyWindow(d, item));
  const prev = at(prevWindow(d, item));
  let eb: Ctx['eb'] = { cur, ly, prev, prevName: null };
  if (item.gran === 'W') {
    const ptd = toDate(d, 'P', item.last);
    // Previous = the previous month cut to the same number of weeks (USER 2026-10-30)
    const pm = prevMonthToDate(d, item.last);
    const k = pm?.win.weeks.length ?? 0;
    eb = {
      cur: computeMetrics(d, scope, ptd),
      ly: at(lyWindow(d, ptd)),
      prev: pm ? at(pm.win) : null,
      prevName: pm
        ? `P${pm.item.n}${pm.item.fy === item.fy ? '' : ` FY${pm.item.fy}`} ${k === 1 ? 'week 1' : `weeks 1–${k}`}`
        : null,
    };
  }
  const ctx: Ctx = {
    d,
    cat,
    sel,
    scope,
    item,
    L: item.last,
    cur,
    ly,
    prev,
    eb,
    series,
    labels: s.labels,
    words: PERIOD_WORDS[item.gran],
    refresh: refreshStamp(d.manifest.refreshed),
  };

  const cards = d.cards.map((k) => card(ctx, k.kpi_code));
  const n = (key: string) => ctx.cur[key] ?? 0;
  const counts = { on: n('status.count_on'), watch: n('status.count_watch'), off: n('status.count_off') };
  const pickedLabels = ATTRIBUTES.flatMap((a) =>
    (a.options as readonly (readonly [string, string])[])
      .filter(([code]) => sel.picks[a.key].includes(code))
      .map(([, label]) => label),
  );
  const head = header(ctx);
  const overall = dotView(counts, DOT_OF[n('status.dot')]);

  return {
    header: head,
    status: {
      ...overall,
      counts,
      shown: cards.filter((c) => c.revealed).length,
      total: cards.length,
      picks: pickedLabels.length ? pickedLabels.join(', ') : 'All',
      picked: pickedLabels.length,
    },
    cards,
    menu: menu(ctx, head.period),
    how: how(ctx),
    bench: bench(d),
  };
}

/** Overall dot and its tooltip over the rated cards (E-26, E-95); no rated card → grey, "no rated card". */
export function dotView(
  counts: { on: number; watch: number; off: number },
  dot: Dot | undefined,
): { dot: DotView; dotTip: readonly [string, string] } {
  const rated = counts.on + counts.watch + counts.off;
  if (rated === 0 || dot === undefined) return { dot: 'grey', dotTip: ['Overall: grey', ' · no rated card.'] };
  const share100 = (x: number) => `${Math.round((100 * x) / rated)}%`;
  return {
    dot,
    dotTip: [
      `Overall: ${dot}`,
      ` · computed over ${rated === 12 ? 'all 12 cards' : `the ${rated} cards with a status (N/A excluded)`}, filters ignored. ` +
        'Red if off track ≥ 1/3 · else orange if watch + off track > 50% · else green if on track ≥ 2/3 · else orange. ' +
        `Now: off track ${counts.off} (${share100(counts.off)}), watch + off ${counts.watch + counts.off} (${share100(counts.watch + counts.off)}), on track ${counts.on} (${share100(counts.on)}).`,
    ],
  };
}

// ---------- header and period words ----------

/** FY suffix when the item is not in the as-of FY (E-98): "Week 43 FY2025". */
const fySuffix = (c: Ctx): string => (c.item.gran !== 'FY' && c.item.fy !== c.d.currentFy ? ` FY${c.item.fy}` : '');
const toDateSuffix = (x: Item): string => (x.partial ? ` ${TO_DATE}` : '');

/** "Week 43" · "Month 10" · "Quarter 4" · "FY2026" · "Month 10 FY2025" (header line, How-to-read title). */
const itemTitle = (c: Ctx): string =>
  c.item.gran === 'FY' ? `FY${c.item.fy}` : `${c.words.header} ${c.item.n}${fySuffix(c)}`;

function header(c: Ctx): DashboardView['header'] {
  const { d, sel } = c;
  const dates = windowDates(d, c.item.weeks);
  const period: Rich = [b(itemTitle(c)), t(`${toDateSuffix(c.item)} · ${dateRange(dates.from, dates.to)}`)];
  const label: Readonly<Record<Comparator, string>> = { budget: 'Budget', ly: 'Last year', prev: c.words.prev };
  const compare: Rich = [
    t('vs '),
    b(label[sel.compare]),
    ...(sel.compare === 'ly' ? [t(c.item.gran === 'W' ? ' (same retail week)' : ' (same retail weeks)')] : []),
  ];
  const region: Rich =
    sel.region === 'all'
      ? [t('All regions & formats')]
      : sel.region === 'online'
        ? [b('Online'), t(' only')]
        : [b(SWITCH_LABELS.region.options[sel.region]), t(' · all formats')];
  return { period, compare, region, refreshed: `Refreshed ${c.refresh.long}` };
}

/** Window phrase for sub-titles: "week 43" · "month 10" · "quarter 4 to date" · "FY2026 to date" (E-92). */
function windowPhrase(c: Ctx): string {
  const x = c.item;
  return x.gran === 'FY' ? `FY${x.fy}${toDateSuffix(x)}` : `${c.words.noun} ${x.n}${fySuffix(c)}${toDateSuffix(x)}`;
}

// ---------- Filters menu: period picker, comparator, region ----------

function menu(c: Ctx, showing: Rich): MenuView {
  const { d, cat, sel, item } = c;
  const to = (x: Item | undefined): Selection => normalize({ ...sel, item: (x ?? item).key }, cat);
  const chipLabel = (x: Item) =>
    `${x.gran === 'FY' ? `FY${x.fy}` : `${x.gran}${x.n}`}${x.partial ? ` · ${TO_DATE}` : ''}`;
  const ofFy = (fy: number) => cat.items[item.gran].filter((x) => x.fy === fy);
  return {
    // switching the granularity keeps the item that holds the current item's last week (W43 → P10 → Q4 → FY2026)
    granularity: GRANULARITIES.map((g) => ({
      id: g,
      label: SWITCH_LABELS.granularity.options[g],
      checked: g === item.gran,
      next: to(containing(d, g, item.last)),
    })),
    fy:
      item.gran === 'FY'
        ? null
        : cat.items.FY.map((y) => {
            const list = ofFy(y.fy);
            return {
              id: String(y.fy),
              label: `FY${y.fy}`,
              checked: y.fy === item.fy,
              next: to(list.find((x) => x.n === item.n) ?? list.at(-1)),
            };
          }),
    items: (item.gran === 'FY' ? cat.items.FY : ofFy(item.fy)).map((x) => ({
      id: x.key,
      label: chipLabel(x),
      checked: x === item,
      next: to(x),
    })),
    itemGrid: item.gran === 'W' || item.gran === 'P',
    showing,
    compare: COMPARATORS.filter((v) => !(v === 'prev' && item.gran === 'FY')).map((v) => ({
      id: v,
      label: SWITCH_LABELS.compare.options[v],
      checked: v === sel.compare,
      next: { ...sel, compare: v },
    })),
    region: REGIONS.map((v) => ({
      id: v,
      label: SWITCH_LABELS.region.options[v],
      checked: v === sel.region,
      next: { ...sel, region: v },
    })),
  };
}

// ---------- cards ----------

interface Numbers {
  value: readonly [string, string] | null;
  /** The status basis value, formatted exactly like `value`; null when blank. */
  target: readonly [string, string] | null;
  delta: string;
  /** Pop-up Δ when it differs from the card's (EBITDA at Week vs Previous). */
  deltaLong?: string;
  series: string | null;
  targetKey: string | null;
  stats: readonly (readonly [string, string])[];
  example: Rich;
  mix?: readonly [number, number, number];
}

function card(c: Ctx, id: string): CardView {
  const { d } = c;
  const kpi = d.cards.find((k) => k.kpi_code === id);
  const copy: CardCopy | undefined = CARD_COPY[id];
  if (!kpi || !copy) throw new Error(`view: no copy for ${id}`);
  const size = SIZE[kpi.size ?? ''] ?? 'sm';
  const tier = size === 'hero' ? 1 : 2;
  const code = c.cur[`status.${id.toLowerCase()}`];
  const status: CardStatus = code === undefined ? 'na' : (STATUS_OF[code] ?? 'na');
  const sub = subTitle(c, id, copy.sub) + (kpi.is_provisional ? ' · prov.' : '');
  const x = numbers(c, id);
  const tags = { group: kpi.group ?? '', lever: kpi.lever ?? '', owner: kpi.owner };
  const revealed = ATTRIBUTES.every((a) => c.sel.picks[a.key].length === 0 || c.sel.picks[a.key].includes(tags[a.key]));
  const page = DRILL_PAGES[kpi.drill_page] ?? `${kpi.drill_page} page`;
  const updated =
    kpi.is_provisional && copy.provisional
      ? copy.provisional
      : copy.cadence === 'weekly'
        ? 'Updated weekly'
        : `Updated ${c.refresh.short}`;
  const series = x.series;
  const bars: Bars | null =
    series === null
      ? null
      : {
          values: c.series.map((m) => m?.[series] ?? null),
          target: x.targetKey === null ? null : (c.cur[x.targetKey] ?? null),
          labels: c.labels,
        };
  return {
    id,
    title: kpi.kpi_name,
    sub,
    size,
    tier,
    status,
    word: STATUS_WORD[status],
    glyph: STATUS_GLYPH[status],
    rule: copy.rule,
    value: x.value?.[0] ?? NA,
    unit: x.value?.[1] ?? '',
    delta: x.delta,
    deltaNa: x.delta.startsWith(NA),
    target: kpi.basis ? { label: BASIS_LABEL[kpi.basis], value: x.target?.[0] ?? NA, unit: x.target?.[1] ?? '' } : null,
    bars,
    mix: x.mix ?? null,
    tags,
    revealed,
    explain: {
      eyebrow: `${tier === 1 ? 'Tier 1' : 'Explains Tier 1'} · ${sub}`,
      delta: x.deltaLong ?? x.delta,
      stats: x.stats,
      rows: [
        ['What it is', [t(copy.what)]],
        ['Why it matters', [t(copy.why)]],
        ['Formula', [t(copy.formula)]],
        ['Worked example', x.example],
        ['Status rule', [t(copy.rule)]],
      ],
      tags: ATTRIBUTES.map((a) => {
        const opts: readonly (readonly [string, string])[] = a.options;
        return [a.label, opts.find(([code]) => code === tags[a.key])?.[1] ?? NA] as const;
      }),
      updated,
      drillLabel: `Drill path · ${page}`,
    },
    drill: { eyebrow: `Drill path · ${page}`, steps: copy.drill },
  };
}

function subTitle(c: Ctx, id: string, base: string): string {
  const scopeWord = { ALL: 'all channels', NL: 'Netherlands', BE: 'Belgium', ONLINE: 'online' }[c.scope];
  if (id === 'NET_SALES') return `${windowPhrase(c)}, ${scopeWord}`;
  // EBITDA flash (E-93): month to date at Week ("month 10 to date"), the item's own window otherwise
  if (id === 'EBITDA')
    return c.item.gran === 'W' ? `${PERIOD_WORDS.P.noun} ${weekRow(c.d, c.L).period} ${base}` : windowPhrase(c);
  if (id === 'LFL_GROWTH') return `${base} ${c.words.noun}`;
  return base;
}

/** Δ vs the comparator (E-14, E-94): Budget / target, LY (same weeks a year back by key) or the previous item. */
function cmpOf(c: Ctx, ebitda = false): { m: M; label: string } | null {
  if (c.sel.compare === 'budget') return null;
  if (!ebitda) return c.sel.compare === 'ly' ? { m: c.ly, label: 'vs LY' } : { m: c.prev, label: c.words.short };
  if (c.sel.compare === 'ly') return { m: c.eb.ly, label: 'vs LY' };
  // EBITDA at Week reads month to date, so its Previous is the previous month cut to the same weeks (USER 2026-10-30)
  return { m: c.eb.prev, label: c.item.gran === 'W' ? PERIOD_WORDS.P.short : c.words.short };
}

/** ⓘ stat vs the previous item: "vs last week" at Week (v5), else the short Δ suffix ("vs prev. mth"; "vs LY" at Year). */
const prevStatLabel = (c: Ctx): string => (c.item.gran === 'W' ? 'vs last week' : c.words.short);

function eurDeltaText(c: Ctx, key: string, budKey: string, cur: Metrics, ebitda = false, long?: string): string {
  const cmp = cmpOf(c, ebitda);
  const a = cur[key];
  const basis = cmp ? val(cmp.m, key) : cur[budKey];
  const label = cmp ? (long ?? cmp.label) : 'vs budget';
  if (a === undefined || basis === undefined) return `${NA} ${label}`;
  return `${eurDelta(a - basis)} (${pctSigned(a / basis - 1)}) ${label}`;
}

/** Ratio card Δ in pp: "+0.1 pp vs budget 36.2%", "−2.9 pp vs target 97%", "−0.2 pp vs LY 36.5%". */
function ppDeltaText(c: Ctx, key: string, basisKey: string, budgetLabel: string, target = false): string {
  const cmp = cmpOf(c);
  const a = c.cur[key];
  const basis = cmp ? val(cmp.m, key) : c.cur[basisKey];
  const label = cmp ? cmp.label : budgetLabel;
  if (a === undefined || basis === undefined) return `${NA} ${label}`;
  return `${pp(a - basis)} ${label} ${target && !cmp ? pctTarget(basis) : pct(basis)}`;
}

function numbers(c: Ctx, id: string): Numbers {
  const { cur } = c;
  const v = (key: string) => cur[key];
  const vsLy = `vs LY ${c.words.noun}`;
  const lyPp = (key: string) => fmt(v(key) !== undefined ? deltaOf(cur, c.ly, key) : undefined, (x) => pp(x));
  const prevPp = (key: string) => fmt(v(key) !== undefined ? deltaOf(cur, c.prev, key) : undefined, (x) => pp(x));
  switch (id) {
    case 'NET_SALES': {
      const net = v('net_sales') ?? 0;
      const bud = v('net_sales_bud');
      return {
        value: eurMParts(net),
        target: bud === undefined ? null : eurMParts(bud),
        delta: eurDeltaText(c, 'net_sales', 'net_sales_bud', cur),
        series: 'net_sales',
        targetKey: 'net_sales_bud',
        stats: [[vsLy, fmt(ratioOf(cur, c.ly, 'net_sales'), (x) => pctSigned(x))], ...netSalesStats(c)],
        example: [
          t(
            `${eurM(v('gross_sales') ?? 0)} at ticket − ${eurM(v('markdown') ?? 0)} markdowns and discounts − ${eurM(v('returns') ?? 0)} returns = `,
          ),
          b(eurM(net)),
          t(
            bud === undefined
              ? '.'
              : `. Budget was ${eurM(bud)}, so ${eurDelta(net - bud)} (${pctSigned(net / bud - 1)}).`,
          ),
        ],
      };
    }
    case 'TOTAL_MARGIN':
      return {
        value: v('total_margin_pct') === undefined ? null : [pctNum(v('total_margin_pct') ?? 0), '%'],
        target: v('total_margin_pct_bud') === undefined ? null : [pctNum(v('total_margin_pct_bud') ?? 0), '%'],
        delta: ppDeltaText(c, 'total_margin_pct', 'total_margin_pct_bud', 'vs budget'),
        series: 'total_margin_pct',
        targetKey: 'total_margin_pct_bud',
        stats: [
          ['Front margin', fmt(v('front_gm_pct'), (x) => pct(x))],
          ['Back margin', fmt(v('back_margin_pct'), (x) => pct(x))],
          [vsLy, lyPp('total_margin_pct')],
        ],
        example: [
          t(
            `Front ${eurM(v('front_margin') ?? 0)} + back ${eurM(v('back_margin') ?? 0)} = ${eurM(v('total_margin') ?? 0)}; ÷ ${eurM(v('net_sales') ?? 0)} = `,
          ),
          b(fmt(v('total_margin_pct'), (x) => pct(x))),
          t(budgetPp(v('total_margin_pct'), v('total_margin_pct_bud'))),
        ],
      };
    case 'WEEKS_OF_COVER': {
      const wc = v('weeks_of_cover');
      const tgt = v('cover_target_wks');
      const cmp = cmpOf(c);
      const basis = cmp ? val(cmp.m, 'weeks_of_cover') : tgt;
      const label = cmp ? cmp.label : 'vs target';
      return {
        value: wc === undefined ? null : [num(wc), 'wks'],
        target: tgt === undefined ? null : [num(tgt), 'wks'],
        delta:
          wc === undefined || basis === undefined
            ? `${NA} ${label}`
            : `${signed(wc - basis, ' wks')} ${label} ${num(basis)}`,
        series: 'weeks_of_cover',
        targetKey: 'cover_target_wks',
        stats: [
          ['On hand at cost', eurM(v('on_hand_cost') ?? 0, 0)],
          ['On order', eurM(v('on_order_cost') ?? 0, 0)],
          [
            prevStatLabel(c),
            fmt(wc !== undefined ? deltaOf(cur, c.prev, 'weeks_of_cover') : undefined, (x) => signed(x, ' wks')),
          ],
        ],
        example: [
          t(
            `${eurM(v('stock_incl_on_order') ?? 0, 0)} stock incl. on-order ÷ ${eurM(v('forecast_cogs') ?? 0)} forecast weekly cost of goods = `,
          ),
          b(fmt(wc, (x) => `${num(x)} weeks`)),
          t(
            wc === undefined || tgt === undefined
              ? '.'
              : `. Target ${num(tgt)}, so ${signed(wc - tgt, '', 1)} → ${statusWord(c, id)}.`,
          ),
        ],
      };
    }
    case 'MARKDOWN':
      return {
        value: v('markdown_pct') === undefined ? null : [pctNum(v('markdown_pct') ?? 0), '%'],
        target: v('markdown_pct_bud') === undefined ? null : [pctNum(v('markdown_pct_bud') ?? 0), '%'],
        delta: ppDeltaText(c, 'markdown_pct', 'markdown_pct_bud', 'vs budget'),
        series: 'markdown_pct',
        targetKey: 'markdown_pct_bud',
        stats: [
          ['Markdown value', eurM(v('markdown') ?? 0)],
          [vsLy, lyPp('markdown_pct')],
          ['Budget', fmt(v('markdown_pct_bud'), (x) => pct(x))],
        ],
        example: [
          t(`${eurM(v('markdown') ?? 0)} markdown ÷ ${eurM(v('gross_sales') ?? 0)} gross sales = `),
          b(fmt(v('markdown_pct'), (x) => pct(x))),
          t(
            v('markdown_pct') === undefined || v('markdown_pct_bud') === undefined
              ? '.'
              : `. Budget ${pct(v('markdown_pct_bud') ?? 0)}, so ${pp((v('markdown_pct') ?? 0) - (v('markdown_pct_bud') ?? 0))}; lower is better → ${statusWord(c, id)}.`,
          ),
        ],
      };
    case 'AVAILABILITY': {
      const av = v('availability_pct');
      const tgt = v('availability_target') ?? 0;
      const stores = sumSites(c.d.tradingStores, c.L, SCOPE_GROUPS[c.scope]);
      const byCountry = (['NL', 'BE'] as const).map(
        (s) => computeMetrics(c.d, s, { gran: 'W', weeks: [c.L] }).availability_pct,
      );
      const lowest = lowestCategoryAvailability(c);
      return {
        value: av === undefined ? null : [pctNum(av), '%'],
        target: v('availability_target') === undefined ? null : [pctNum(v('availability_target') ?? 0), '%'],
        delta: ppDeltaText(c, 'availability_pct', 'availability_target', 'vs target', true),
        series: 'availability_pct',
        targetKey: 'availability_target',
        stats: [
          [prevStatLabel(c), av === undefined ? NA : prevPp('availability_pct')],
          ['Netherlands · Belgium', byCountry.map((x) => fmt(x, (y) => pct(y))).join(' · ')],
          ['Lowest category', lowest],
        ],
        example:
          av === undefined
            ? [t('Availability counts stores only; this selection has none.')]
            : [
                t(
                  `${c.item.gran === 'W' ? '' : `Last week of the ${c.words.noun}: `}500 SKUs × ${int(stores)} stores × 7 days = ${int(v('ranged_sku_days') ?? 0)} ranged; ${int(v('in_stock_sku_days') ?? 0)} in stock → `,
                ),
                b(pct(av)),
                t(`. Target ${pctTarget(tgt)}, so ${pp(av - tgt)} → ${statusWord(c, id)}.`),
              ],
      };
    }
    case 'EBITDA': {
      const p = c.eb.cur;
      const e = p.ebitda ?? 0;
      const bud = p.ebitda_bud;
      return {
        value: eurMParts(e),
        target: bud === undefined ? null : eurMParts(bud),
        delta: eurDeltaText(c, 'ebitda', 'ebitda_bud', p, true),
        ...(c.sel.compare === 'prev' && c.eb.prevName
          ? { deltaLong: eurDeltaText(c, 'ebitda', 'ebitda_bud', p, true, `vs ${c.eb.prevName}`) }
          : {}),
        series: 'ebitda',
        targetKey: 'ebitda_bud',
        stats: [
          ['EBITDA margin', fmt(p.ebitda_margin_pct, (x) => pct(x))],
          ['Budget margin', fmt(p.ebitda_margin_pct_bud, (x) => pct(x))],
          ['Store costs vs plan', storeCostsVsPlan(p)],
        ],
        example: [
          t(
            `${eurM(p.total_margin ?? 0)} margin − ${eurM(p.opex_shrink ?? 0)} shrink − ${eurM(p.opex_store ?? 0)} store − ${eurM(p.opex_central ?? 0)} central − ${eurM(p.opex_fulfilment ?? 0)} fulfilment = `,
          ),
          b(eurM(e)),
          t(
            ` (${fmt(p.ebitda_margin_pct, (x) => pct(x))} of ${eurM(p.net_sales ?? 0)}).` +
              (bud === undefined ? '' : ` Budget ${eurM(bud)}, so ${eurDelta(e - bud)} (${pctSigned(e / bud - 1)}).`),
          ),
        ],
      };
    }
    case 'LFL_GROWTH': {
      const g = v('lfl_growth_pct');
      const online = ratioOf(cur, c.ly, 'mix_online_net_sales');
      return {
        value: g === undefined ? null : [pctSigned(g).slice(0, -1), '%'],
        target:
          v('lfl_growth_pct_bud') === undefined ? null : [pctSigned(v('lfl_growth_pct_bud') ?? 0).slice(0, -1), '%'],
        delta: ppDeltaText(c, 'lfl_growth_pct', 'lfl_growth_pct_bud', 'vs budget LFL'),
        series: 'lfl_growth_pct',
        targetKey: 'lfl_growth_pct_bud',
        stats: [
          [
            'LFL stores',
            g === undefined
              ? NA
              : `${int(v('lfl_store_count') ?? 0)} of ${int(sumSites(c.d.tradingStores, c.L, SCOPE_GROUPS[c.scope]))}`,
          ],
          ['Non-LFL effect', fmt(v('nonlfl_effect_pp'), (x) => pp(x))],
          ['Online LFL', fmt(online, (x) => pctSigned(x))],
        ],
        example:
          g === undefined
            ? [t('Like-for-like counts stores only; this selection has none.')]
            : [
                t(
                  `${int(v('lfl_store_count') ?? 0)} LFL stores: ${eurM(v('lfl_net_sales') ?? 0)} ÷ ${eurM(v('lfl_net_sales_ly') ?? 0)} − 1 = `,
                ),
                b(pctSigned(g)),
                t(
                  v('lfl_growth_pct_bud') === undefined
                    ? '.'
                    : `. Budget LFL ${pct(v('lfl_growth_pct_bud') ?? 0)}, so ${pp(g - (v('lfl_growth_pct_bud') ?? 0))}.`,
                ),
              ],
      };
    }
    case 'FRONT_GM':
      return {
        value: v('front_gm_pct') === undefined ? null : [pctNum(v('front_gm_pct') ?? 0), '%'],
        target: v('front_gm_pct_bud') === undefined ? null : [pctNum(v('front_gm_pct_bud') ?? 0), '%'],
        delta: ppDeltaText(c, 'front_gm_pct', 'front_gm_pct_bud', 'vs budget'),
        series: 'front_gm_pct',
        targetKey: 'front_gm_pct_bud',
        stats: [
          ['Cost of goods', eurM(v('cogs') ?? 0)],
          ['Front margin', eurM(v('front_margin') ?? 0)],
          [vsLy, lyPp('front_gm_pct')],
        ],
        example: [
          t(
            `${eurM(v('net_sales') ?? 0)} − ${eurM(v('cogs') ?? 0)} cost of goods = ${eurM(v('front_margin') ?? 0)}; ÷ ${eurM(v('net_sales') ?? 0)} = `,
          ),
          b(fmt(v('front_gm_pct'), (x) => pct(x))),
          t(budgetPp(v('front_gm_pct'), v('front_gm_pct_bud'))),
        ],
      };
    case 'SELL_THROUGH': {
      const st = v('sell_through_pct');
      const tgt = v('sell_through_target');
      const w = weekRow(c.d, c.L);
      const len = seasonLength(c.d, c.L);
      const cats = seasonalStats(c);
      return {
        value: st === undefined ? null : [pctNum(st), '%'],
        target: tgt === undefined ? null : [pctNum(tgt), '%'],
        delta: ppDeltaText(c, 'sell_through_pct', 'sell_through_target', 'vs target', true),
        series: 'sell_through_pct',
        targetKey: 'sell_through_target',
        stats: [...cats, ['vs LY season', st === undefined ? NA : lyPp('sell_through_pct')]],
        example:
          st === undefined || tgt === undefined
            ? [
                t(
                  c.item.gran === 'W'
                    ? 'No season is open in the selected week.'
                    : `No season is open in the last week of the ${c.words.noun}.`,
                ),
              ]
            : [
                t(
                  `${unitsM(v('season_units_sold') ?? 0)} units sold ÷ (${unitsM(v('season_opening_units') ?? 0)} opening + ${unitsM(v('season_receipt_units') ?? 0)} received = ${unitsM((v('season_opening_units') ?? 0) + (v('season_receipt_units') ?? 0))}) = `,
                ),
                b(pct(st)),
                t(`. Target ${pctTarget(tgt)} at week ${w.season_week ?? NA} of ${len ?? NA}, so ${pp(st - tgt)}.`),
              ],
      };
    }
    case 'GMROI': {
      const g = v('gmroi');
      const tgt = v('gmroi_target');
      const byCat = gmroiByCategory(c.d, c.scope, c.L);
      const cat = (code: string) => fmt(byCat?.get(code), (x) => `${num(x)}×`);
      const cmp = cmpOf(c);
      const basis = cmp ? val(cmp.m, 'gmroi') : tgt;
      const label = cmp ? cmp.label : 'vs target';
      return {
        value: g === undefined ? null : [num(g), '×'],
        target: tgt === undefined ? null : [num(tgt), '×'],
        delta:
          g === undefined || basis === undefined
            ? `${NA} ${label}`
            : `${signed(g - basis, '×')} ${label} ${num(basis)}×`,
        series: 'gmroi',
        targetKey: 'gmroi_target',
        stats: [
          ['R52W front margin', eurM(v('gmroi_front_margin_r52w') ?? 0, 0)],
          ['Average stock at cost', eurM(v('gmroi_avg_on_hand_cost') ?? 0, 0)],
          ['H&B · Electronics', `${cat('HB')} · ${cat('ELEC')}`],
        ],
        example:
          g === undefined || tgt === undefined
            ? [t('GMROI needs 52 weeks of history.')]
            : [
                t(
                  `${eurM(v('gmroi_front_margin_r52w') ?? 0, 0)} front margin ÷ ${eurM(v('gmroi_avg_on_hand_cost') ?? 0, 0)} average stock = `,
                ),
                b(`${num(g)}×`),
                t(`. Target ${num(tgt)}×, so ${signed(g - tgt, '×')}.`),
              ],
      };
    }
    case 'SUPPLIER_OTIF': {
      const o = v('otif_pct') ?? 0;
      const tgt = v('otif_target') ?? 0;
      return {
        value: [pctNum(o), '%'],
        target: v('otif_target') === undefined ? null : [pctNum(v('otif_target') ?? 0), '%'],
        delta: ppDeltaText(c, 'otif_pct', 'otif_target', 'vs target', true),
        series: 'otif_pct',
        targetKey: 'otif_target',
        stats: [
          ['PO lines due', int(v('po_lines_due') ?? 0)],
          [prevStatLabel(c), prevPp('otif_pct')],
          ['Suppliers below 85%', int(c.d.poBelow85[c.L] ?? 0)],
        ],
        example: [
          t(`${int(v('po_lines_otif') ?? 0)} lines on time and in full ÷ ${int(v('po_lines_due') ?? 0)} lines due = `),
          b(pct(o)),
          t(`. Target ${pctTarget(tgt)}, so ${pp(o - tgt)}.`),
        ],
      };
    }
    case 'CHANNEL_MIX': {
      const shares = CHANNELS.map((ch) => v(`mix_${ch}_pct`) ?? 0);
      const plan = CHANNELS.map((ch) => v(`mix_${ch}_pct_bud`));
      const cmp = cmpOf(c);
      const basis = cmp ? CHANNELS.map((ch) => val(cmp.m, `mix_${ch}_pct`)) : plan;
      const label = cmp ? cmp.label : 'vs plan';
      const worst = largestDeviation(shares, basis);
      const [store = 0, online = 0, wholesale = 0] = shares;
      return {
        value: [pctNum(store), '% store'],
        target: plan[0] === undefined ? null : [pctNum(plan[0]), '% store'],
        delta: worst === null ? `${NA} ${label}` : `${CHANNELS[worst.i]} ${pp(worst.dev)} ${label}`,
        series: null,
        targetKey: null,
        mix: [store * 100, online * 100, wholesale * 100],
        stats: CHANNELS.map((ch, i) => [
          ch === 'store' ? 'Store' : ch === 'online' ? 'Online' : 'Wholesale',
          `${pct(shares[i] ?? 0)} · ${fmt(plan[i] === undefined ? undefined : (shares[i] ?? 0) - (plan[i] ?? 0), (x) => pp(x))}`,
        ]),
        example: [
          t(
            `Store ${eurM(v('mix_store_net_sales') ?? 0)}, online ${eurM(v('mix_online_net_sales') ?? 0)}, wholesale ${eurM(v('mix_wholesale_net_sales') ?? 0)} of ${eurM(v('net_sales') ?? 0)} → `,
          ),
          b(shares.map((s) => pct(s)).join(' / ')),
          t(
            plan.some((p) => p === undefined)
              ? '.'
              : `. Plan ${plan.map((p) => share(p ?? 0)).join(' / ')}, so ${mixPlanDelta(shares, plan)}.`,
          ),
        ],
      };
    }
    default:
      throw new Error(`view: unknown card ${id}`);
  }
}

/** Net sales ⓘ stats 2 and 3 by granularity (exec-period-model.md §4): the enclosing windows to date, then the
 *  previous quarter / budget full year / last year where "to date" would repeat the card. */
function netSalesStats(c: Ctx): (readonly [string, string])[] {
  const { d, L, item } = c;
  const groups = SCOPE_GROUPS[c.scope];
  const net = (w: Window) => eurM(sum(d, 'net_sales', w.weeks, groups));
  const ytd = ['Year to date', net(toDate(d, 'FY', L))] as const;
  const w = weekRow(d, L);
  switch (item.gran) {
    case 'W':
      return [[`${PERIOD_WORDS.P.header} ${w.period} to date`, net(toDate(d, 'P', L))], ytd];
    case 'P':
      return [[`Quarter ${Math.ceil(w.period / 3)} to date`, net(toDate(d, 'Q', L))], ytd];
    case 'Q':
      return [
        ['FY to date', net(toDate(d, 'FY', L))],
        ['Previous quarter', fmt(val(c.prev, 'net_sales'), (x) => eurM(x))],
      ];
    case 'FY': {
      // the whole FY's budget, future weeks included (Budget exists for the as-of FY only, E-95)
      const all = d.weeks.flatMap((x, i) => (x.fy === item.fy ? [i] : []));
      const bud = item.fy === d.currentFy ? sum(d, 'net_sales_bud', all, groups) : undefined;
      return [
        ['Budget full year', fmt(bud, (x) => eurM(x))],
        ['Last year', fmt(val(c.ly, 'net_sales'), (x) => eurM(x))],
      ];
    }
  }
}

const deltaOf = (cur: Metrics, cmp: M, key: string): number | undefined => {
  const a = cur[key];
  const basis = val(cmp, key);
  return a === undefined || basis === undefined ? undefined : a - basis;
};
const ratioOf = (cur: Metrics, cmp: M, key: string): number | undefined => {
  const a = cur[key];
  const basis = val(cmp, key);
  return a === undefined || basis === undefined || basis === 0 ? undefined : a / basis - 1;
};
const budgetPp = (a: number | undefined, bud: number | undefined): string =>
  a === undefined || bud === undefined ? '.' : `. Budget ${pct(bud)}, so ${pp(a - bud)}.`;
const statusWord = (c: Ctx, id: string): string => {
  const code = c.cur[`status.${id.toLowerCase()}`];
  return code === undefined ? 'N/A' : STATUS_WORD[STATUS_OF[code] ?? 'na'];
};

/** Channel with the largest absolute deviation (first on a tie, data README "Card formulas"). */
function largestDeviation(
  shares: readonly number[],
  basis: readonly (number | undefined)[],
): { i: number; dev: number } | null {
  if (basis.some((x) => x === undefined)) return null;
  let best = { i: 0, dev: (shares[0] ?? 0) - (basis[0] ?? 0) };
  shares.forEach((s, i) => {
    const dev = s - (basis[i] ?? 0);
    if (Math.abs(dev) > Math.abs(best.dev)) best = { i, dev };
  });
  return best;
}
function mixPlanDelta(shares: readonly number[], plan: readonly (number | undefined)[]): string {
  const w = largestDeviation(shares, plan);
  return w === null ? NA : `${CHANNELS[w.i]} ${pp(w.dev)}`;
}

/** Store OpEx share of net sales vs its budget share, in pp (stand-in for v5's "Payroll vs plan", which has no data). */
function storeCostsVsPlan(p: Metrics): string {
  const { opex_store: a, net_sales: n, opex_store_bud: ab, net_sales_bud: nb } = p;
  if (a === undefined || n === undefined || ab === undefined || nb === undefined || n === 0 || nb === 0) return NA;
  return pp(a / n - ab / nb);
}

/** Lowest category availability in the scope's last week, e.g. "Fresh food 91.2%". */
function lowestCategoryAvailability(c: Ctx): string {
  const byCat = [...availabilityByCategory(c.d, c.scope, c.L)].sort((x, y) => x[1] - y[1]);
  const low = byCat[0];
  return low ? `${categoryName(c.d, low[0])} ${pct(low[1])}` : NA;
}
const categoryName = (d: ExecData, code: string): string =>
  d.categories.find((x) => x.category_code === code)?.category_name ?? code;

/** Apparel and Home & kitchen sell-through (v5 mini stats), in the selected scope. */
function seasonalStats(c: Ctx): (readonly [string, string])[] {
  const byCat = sellThroughByCategory(c.d, c.scope, c.L);
  return (['APPAREL', 'HOME'] as const).map(
    (code) => [categoryName(c.d, code), fmt(byCat?.get(code), (x) => pct(x, 0))] as const,
  );
}

// ---------- pop-ups ----------

function how(c: Ctx): DashboardView['how'] {
  return {
    eyebrow: `Nordmark · ${itemTitle(c)}`,
    bullets: [
      [
        b('Three numbers'),
        t(
          ' carry the page: Net sales (sell more), Total margin % (keep more), Weeks of cover (turn stock faster). The nine tiles below explain them: card size follows importance, worst first.',
        ),
      ],
      [
        b('Status'),
        t(
          ' is vs the metric’s target: ▲ On track · ● Watch · ▼ Off track; the card is washed in the status colour; hover a chip for the rule. The ',
        ),
        b('Δ line'),
        t(` is vs the comparator in the header (${SWITCH_LABELS.compare.options[c.sel.compare]}). The `),
        b('dot'),
        t(' before the counts is the overall status over the cards with a status; hover it for the rule.'),
      ],
      [
        b('Bars'),
        t(
          ' = the last 13 weeks, 12 months, 8 quarters or 2 years up to the picked period; the picked one is in the status colour, the dotted line is the target.',
        ),
      ],
      [
        b('ⓘ'),
        t(' opens the plain-English explanation and a worked example; the '),
        b('binoculars'),
        t(' open the drill path to the drill page and its lowest grain.'),
      ],
      [
        b('Side bar'),
        t(
          ': Filters (period, comparator, region and the metric attributes; inside one attribute a choice is OR, across attributes AND; filtered-out cards fade in place so nothing moves; the badge counts active choices; Reset clears), How to read, More KPIs (the 20 bench metrics, inactive).',
        ),
      ],
      [
        b('prov.'),
        t(
          ' in a title = provisional until close (true-up 10 Nov). Illustrative data · EUR · NL + BE · LY = same retail week.',
        ),
      ],
    ],
    foot: ['Illustrative data', `Refreshed ${c.refresh.long}`],
  };
}

function bench(d: ExecData): DashboardView['bench'] {
  const domains: { domain: string; items: (readonly [string, string, string])[] }[] = [];
  for (const k of d.bench) {
    let g = domains.find((x) => x.domain === k.domain);
    if (!g) {
      g = { domain: k.domain, items: [] };
      domains.push(g);
    }
    g.items.push([k.kpi_name, k.formula ?? '', `${k.owner_initials ?? ''} · ${k.cadence}`]);
  }
  return { count: d.bench.length, domains };
}
