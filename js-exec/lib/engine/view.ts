import type { Scope } from '../data/manifest.ts';
import { dateRange, lwWeek, lyWeek, seasonLength, weekRow, windowDates, windowWeeks } from './calendar.ts';
import type { PeriodKind } from './calendar.ts';
import { sumSites, SCOPE_GROUPS } from './cube.ts';
import type { ExecData } from './cube.ts';
import {
  ATTRIBUTES,
  CARD_COPY,
  DATA_CONTRACT,
  DRILL_PAGES,
  MARGIN_LOGIC,
  STATUS_GLYPH,
  STATUS_WORD,
  SWITCH_LABELS,
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
import { availabilityByCategory, computeMetrics, gmroiByCategory, sellThroughByCategory } from './metrics.ts';
import type { Metrics } from './metrics.ts';
import type { Dot, Status } from './status.ts';
import type { Comparator, Period, Region, Selection } from './url-state.ts';

// View model of the landing page (ADR-0012 card face; E-20 … E-58). Components render these strings and numbers
// as they are: every value, Δ text, chip, bar, worked example and mini stat of every card is decided here.

/** Rich text without HTML: segments, some bold. */
export type Rich = readonly { text: string; strong?: boolean }[];
const t = (text: string): { text: string } => ({ text });
const b = (text: string): { text: string; strong: true } => ({ text, strong: true });

export type CardStatus = Status | 'na';
export type CardSize = 'hero' | 'med' | 'sm';

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
  bars: Bars | null;
  /** Channel mix only: store / online / wholesale shares in % (the pop-up mix bar). */
  mix: readonly [number, number, number] | null;
  tags: Readonly<Record<AttrKey, string>>;
  revealed: boolean;
  explain: {
    eyebrow: string;
    stats: readonly (readonly [string, string])[];
    rows: readonly (readonly [string, Rich])[];
    tags: readonly (readonly [string, string])[];
    foot: readonly [string, string];
    drillLabel: string;
  };
  drill: { eyebrow: string; steps: readonly (readonly [string, string])[] };
}

export interface DashboardView {
  header: { period: Rich; compare: Rich; region: Rich; refreshed: string };
  status: {
    dot: Dot;
    dotTip: readonly [string, string];
    counts: { on: number; watch: number; off: number };
    shown: number;
    total: number;
    picks: string;
    picked: number;
  };
  cards: readonly CardView[];
  how: { eyebrow: string; bullets: readonly Rich[]; foot: readonly [string, string] };
  notes: {
    rules: readonly (readonly [string, string])[];
    margin: string;
    contract: readonly string[];
    foot: string;
  };
  bench: {
    count: number;
    domains: readonly { domain: string; items: readonly (readonly [string, string, string])[] }[];
  };
}

const KIND: Readonly<Record<Period, PeriodKind>> = { week: 'W', ptd: 'PTD', ytd: 'YTD' };
const SCOPE: Readonly<Record<Region, Scope>> = { all: 'ALL', nl: 'NL', be: 'BE', online: 'ONLINE' };
const SIZE: Readonly<Record<string, CardSize>> = { hero: 'hero', medium: 'med', small: 'sm' };
const STATUS_OF: Readonly<Record<number, Status>> = { 1: 'good', 2: 'watch', 3: 'off' };
const DOT_OF: Readonly<Record<number, Dot>> = { 1: 'green', 2: 'orange', 3: 'red' };
const CMP_LABEL: Readonly<Record<Comparator, string>> = { budget: 'Budget', ly: 'Last year', lw: 'Last week' };
const CMP_SHORT: Readonly<Record<'ly' | 'lw', string>> = { ly: 'vs LY', lw: 'vs last week' };
const CHANNELS = ['store', 'online', 'wholesale'] as const;
const NA = 'n/a';

type M = Metrics | null;
const val = (m: M, key: string): number | undefined => (m ? m[key] : undefined);
const fmt = (x: number | undefined, f: (x: number) => string): string => (x === undefined ? NA : f(x));

interface Ctx {
  d: ExecData;
  sel: Selection;
  scope: Scope;
  kind: PeriodKind;
  asOf: number;
  cur: Metrics;
  ptd: Metrics;
  ytd: Metrics;
  ly: M;
  lw: M;
  ptdLy: M;
  ptdLw: M;
  weekly: readonly Metrics[];
  /** "week" · "period" · "year": the noun of the window for stat labels. */
  noun: string;
  refresh: { long: string; short: string };
}

export function buildView(d: ExecData, sel: Selection): DashboardView {
  const scope = SCOPE[sel.region];
  const kind = KIND[sel.period];
  const asOf = d.asOf;
  const at = (k: PeriodKind, w: number | null): M => (w === null ? null : computeMetrics(d, scope, k, w));
  const ctx: Ctx = {
    d,
    sel,
    scope,
    kind,
    asOf,
    cur: computeMetrics(d, scope, kind, asOf),
    ptd: computeMetrics(d, scope, 'PTD', asOf),
    ytd: computeMetrics(d, scope, 'YTD', asOf),
    ly: at(kind, lyWeek(d, asOf)),
    lw: at(kind, lwWeek(d, asOf)),
    ptdLy: at('PTD', lyWeek(d, asOf)),
    ptdLw: at('PTD', lwWeek(d, asOf)),
    weekly: Array.from({ length: 13 }, (_, i) => computeMetrics(d, scope, 'W', asOf - 12 + i)),
    noun: { W: 'week', PTD: 'period', YTD: 'year' }[kind],
    refresh: refreshStamp(d.manifest.refreshed),
  };

  const cards = d.cards.map((k) => card(ctx, k.kpi_code));
  const n = (key: string) => ctx.cur[key] ?? 0;
  const counts = { on: n('status.count_on'), watch: n('status.count_watch'), off: n('status.count_off') };
  const rated = counts.on + counts.watch + counts.off;
  const dot = DOT_OF[n('status.dot')] ?? 'orange';
  const share100 = (x: number) => `${Math.round((100 * x) / rated)}%`;
  const pickedLabels = ATTRIBUTES.flatMap((a) =>
    (a.options as readonly (readonly [string, string])[])
      .filter(([code]) => sel.picks[a.key].includes(code))
      .map(([, label]) => label),
  );

  return {
    header: header(ctx),
    status: {
      dot,
      dotTip: [
        `Overall: ${dot}`,
        ` · computed over ${rated === 12 ? 'all 12 cards' : `the ${rated} cards with a status (N/A excluded)`}, filters ignored. ` +
          'Red if off track ≥ 1/3 · else orange if watch + off track > 50% · else green if on track ≥ 2/3 · else orange. ' +
          `Now: off track ${counts.off} (${share100(counts.off)}), watch + off ${counts.watch + counts.off} (${share100(counts.watch + counts.off)}), on track ${counts.on} (${share100(counts.on)}).`,
      ],
      counts,
      shown: cards.filter((c) => c.revealed).length,
      total: cards.length,
      picks: pickedLabels.length ? pickedLabels.join(', ') : 'All',
      picked: pickedLabels.length,
    },
    cards,
    how: how(ctx),
    notes: {
      rules: cards.map((c) => [c.title, c.rule] as const),
      margin: MARGIN_LOGIC,
      contract: DATA_CONTRACT,
      foot: `Illustrative data · seed ${d.manifest.seed} · EUR · NL + BE`,
    },
    bench: bench(d),
  };
}

// ---------- header ----------

function header(c: Ctx): DashboardView['header'] {
  const { d, sel, asOf } = c;
  const w = weekRow(d, asOf);
  const dates = windowDates(d, windowWeeks(d, c.kind, asOf));
  const range = dateRange(dates.from, dates.to);
  const period: Rich =
    c.kind === 'W'
      ? [b(w.week_label), t(` · ${range}`)]
      : c.kind === 'PTD'
        ? [b(`Period ${w.period}`), t(` to date · ${range}`)]
        : [b(`FY${w.fy}`), t(` to date · ${range}`)];
  const compare: Rich = [
    t('vs '),
    b(CMP_LABEL[sel.compare]),
    ...(sel.compare === 'ly' ? [t(' (same retail week)')] : []),
  ];
  const region: Rich =
    sel.region === 'all'
      ? [t('All regions & formats')]
      : sel.region === 'online'
        ? [b('Online'), t(' only')]
        : [b(SWITCH_LABELS.region.options[sel.region]), t(' · all formats')];
  return { period, compare, region, refreshed: `Refreshed ${c.refresh.long}` };
}

/** Window phrase for sub-titles: "week 43" · "period 10 to date" · "FY2026 to date". */
function windowPhrase(c: Ctx): string {
  const w = weekRow(c.d, c.asOf);
  return c.kind === 'W'
    ? `week ${w.week_of_fy}`
    : c.kind === 'PTD'
      ? `period ${w.period} to date`
      : `FY${w.fy} to date`;
}

// ---------- cards ----------

interface Numbers {
  value: readonly [string, string] | null;
  delta: string;
  series: string | null;
  targetKey: string | null;
  stats: readonly (readonly [string, string])[];
  example: Rich;
  footLeft: string;
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
  const tags = {
    group: kpi.group ?? '',
    lever: kpi.lever ?? '',
    horizon: kpi.horizon ?? '',
    owner: kpi.owner,
    statement: kpi.statement ?? '',
  };
  const revealed = ATTRIBUTES.every((a) => c.sel.picks[a.key].length === 0 || c.sel.picks[a.key].includes(tags[a.key]));
  const page = DRILL_PAGES[kpi.drill_page] ?? `${kpi.drill_page} page`;
  const footRight =
    kpi.is_provisional && copy.provisional
      ? copy.provisional
      : copy.cadence === 'weekly'
        ? 'Updated weekly'
        : `Updated ${c.refresh.short}`;
  const labels = c.weekly.map((_, i) => `W${weekRow(d, c.asOf - 12 + i).week_of_fy}`);
  const bars: Bars | null =
    x.series === null
      ? null
      : {
          values: c.weekly.map((m) => m[x.series ?? ''] ?? null),
          target: x.targetKey === null ? null : (c.weekly.at(-1)?.[x.targetKey] ?? null),
          labels,
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
    bars,
    mix: x.mix ?? null,
    tags,
    revealed,
    explain: {
      eyebrow: `${tier === 1 ? 'Tier 1' : 'Explains Tier 1'} · ${sub}`,
      stats: x.stats,
      rows: [
        ['What it is', [t(copy.what)]],
        ['Why it matters', [t(copy.why)]],
        ['Formula', [t(copy.formula)]],
        ['Worked example', x.example],
        ['Status rule', [t(copy.rule)]],
        ['Owner note', [t(copy.note)]],
      ],
      tags: ATTRIBUTES.map((a) => {
        const opts: readonly (readonly [string, string])[] = a.options;
        return [a.label, opts.find(([code]) => code === tags[a.key])?.[1] ?? NA] as const;
      }),
      foot: [x.footLeft, footRight],
      drillLabel: `Drill path · ${page}`,
    },
    drill: { eyebrow: `Drill path · ${page}`, steps: copy.drill },
  };
}

function subTitle(c: Ctx, id: string, base: string): string {
  const scopeWord = { ALL: 'all channels', NL: 'Netherlands', BE: 'Belgium', ONLINE: 'online' }[c.scope];
  if (id === 'NET_SALES') return `${windowPhrase(c)}, ${scopeWord}`;
  if (id === 'EBITDA') return `period ${weekRow(c.d, c.asOf).period} ${base}`;
  if (id === 'LFL_GROWTH') return `${base} ${c.noun}`;
  return base;
}

/** Δ vs the comparator (E-14): Budget / target, LY (same window a year back by key) or last week. */
function cmpOf(c: Ctx, ptd = false): { m: M; label: string } | null {
  if (c.sel.compare === 'budget') return null;
  const m = c.sel.compare === 'ly' ? (ptd ? c.ptdLy : c.ly) : ptd ? c.ptdLw : c.lw;
  return { m, label: CMP_SHORT[c.sel.compare] };
}

function eurDeltaText(c: Ctx, key: string, budKey: string, cur: Metrics, ptd = false): string {
  const cmp = cmpOf(c, ptd);
  const a = cur[key];
  const basis = cmp ? val(cmp.m, key) : cur[budKey];
  const label = cmp ? cmp.label : 'vs budget';
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
  const vsLy = `vs LY ${c.noun}`;
  const lyPp = (key: string) => fmt(v(key) !== undefined ? deltaOf(cur, c.ly, key) : undefined, (x) => pp(x));
  const lwPp = (key: string) => fmt(v(key) !== undefined ? deltaOf(cur, c.lw, key) : undefined, (x) => pp(x));
  switch (id) {
    case 'NET_SALES': {
      const net = v('net_sales') ?? 0;
      const bud = v('net_sales_bud');
      return {
        value: eurMParts(net),
        delta: eurDeltaText(c, 'net_sales', 'net_sales_bud', cur),
        series: 'net_sales',
        targetKey: 'net_sales_bud',
        stats: [
          [vsLy, fmt(ratioOf(cur, c.ly, 'net_sales'), (x) => pctSigned(x))],
          [`Period ${weekRow(c.d, c.asOf).period} to date`, eurM(c.ptd.net_sales ?? 0)],
          ['Year to date', eurM(c.ytd.net_sales ?? 0)],
        ],
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
        footLeft: `Target budget ${fmt(bud, (x) => eurM(x))}`,
      };
    }
    case 'TOTAL_MARGIN':
      return {
        value: v('total_margin_pct') === undefined ? null : [pctNum(v('total_margin_pct') ?? 0), '%'],
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
        footLeft: `Target budget ${fmt(v('total_margin_pct_bud'), (x) => pct(x))}`,
      };
    case 'WEEKS_OF_COVER': {
      const wc = v('weeks_of_cover');
      const tgt = v('cover_target_wks');
      const cmp = cmpOf(c);
      const basis = cmp ? val(cmp.m, 'weeks_of_cover') : tgt;
      const label = cmp ? cmp.label : 'vs target';
      return {
        value: wc === undefined ? null : [num(wc), 'wks'],
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
            'vs last week',
            fmt(wc !== undefined ? deltaOf(cur, c.lw, 'weeks_of_cover') : undefined, (x) => signed(x, ' wks')),
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
        footLeft: `Target ${fmt(tgt, (x) => num(x))} wks (by category)`,
      };
    }
    case 'MARKDOWN':
      return {
        value: v('markdown_pct') === undefined ? null : [pctNum(v('markdown_pct') ?? 0), '%'],
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
        footLeft: `Target budget ${fmt(v('markdown_pct_bud'), (x) => pct(x))}`,
      };
    case 'AVAILABILITY': {
      const av = v('availability_pct');
      const tgt = v('availability_target') ?? 0;
      const stores = sumSites(c.d.tradingStores, c.asOf, SCOPE_GROUPS[c.scope]);
      const byCountry = (['NL', 'BE'] as const).map((s) => computeMetrics(c.d, s, 'W', c.asOf).availability_pct);
      const lowest = lowestCategoryAvailability(c);
      return {
        value: av === undefined ? null : [pctNum(av), '%'],
        delta: ppDeltaText(c, 'availability_pct', 'availability_target', 'vs target', true),
        series: 'availability_pct',
        targetKey: 'availability_target',
        stats: [
          ['vs last week', av === undefined ? NA : lwPp('availability_pct')],
          ['Netherlands · Belgium', byCountry.map((x) => fmt(x, (y) => pct(y))).join(' · ')],
          ['Lowest category', lowest],
        ],
        example:
          av === undefined
            ? [t('Availability counts stores only; this selection has none.')]
            : [
                t(
                  `500 SKUs × ${int(stores)} stores × 7 days = ${int(v('ranged_sku_days') ?? 0)} ranged; ${int(v('in_stock_sku_days') ?? 0)} in stock → `,
                ),
                b(pct(av)),
                t(`. Target ${pctTarget(tgt)}, so ${pp(av - tgt)} → ${statusWord(c, id)}.`),
              ],
        footLeft: `Target ≥ ${pctTarget(tgt)}`,
      };
    }
    case 'EBITDA': {
      const p = c.ptd;
      const e = p.ebitda ?? 0;
      const bud = p.ebitda_bud;
      return {
        value: eurMParts(e),
        delta: eurDeltaText(c, 'ebitda', 'ebitda_bud', p, true),
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
        footLeft: `Target budget ${fmt(bud, (x) => eurM(x))}`,
      };
    }
    case 'LFL_GROWTH': {
      const g = v('lfl_growth_pct');
      const online = ratioOf(cur, c.ly, 'mix_online_net_sales');
      return {
        value: g === undefined ? null : [pctSigned(g).slice(0, -1), '%'],
        delta: ppDeltaText(c, 'lfl_growth_pct', 'lfl_growth_pct_bud', 'vs budget LFL'),
        series: 'lfl_growth_pct',
        targetKey: 'lfl_growth_pct_bud',
        stats: [
          [
            'LFL stores',
            g === undefined
              ? NA
              : `${int(v('lfl_store_count') ?? 0)} of ${int(sumSites(c.d.tradingStores, c.asOf, SCOPE_GROUPS[c.scope]))}`,
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
        footLeft: `Target budget LFL ${fmt(v('lfl_growth_pct_bud'), (x) => pct(x))}`,
      };
    }
    case 'FRONT_GM':
      return {
        value: v('front_gm_pct') === undefined ? null : [pctNum(v('front_gm_pct') ?? 0), '%'],
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
        footLeft: `Target budget ${fmt(v('front_gm_pct_bud'), (x) => pct(x))}`,
      };
    case 'SELL_THROUGH': {
      const st = v('sell_through_pct');
      const tgt = v('sell_through_target');
      const w = weekRow(c.d, c.asOf);
      const len = seasonLength(c.d, c.asOf);
      const cats = seasonalStats(c);
      return {
        value: st === undefined ? null : [pctNum(st), '%'],
        delta: ppDeltaText(c, 'sell_through_pct', 'sell_through_target', 'vs target', true),
        series: 'sell_through_pct',
        targetKey: 'sell_through_target',
        stats: [...cats, ['vs LY season', st === undefined ? NA : lyPp('sell_through_pct')]],
        example:
          st === undefined || tgt === undefined
            ? [t('No season is open in the selected week.')]
            : [
                t(
                  `${unitsM(v('season_units_sold') ?? 0)} units sold ÷ (${unitsM(v('season_opening_units') ?? 0)} opening + ${unitsM(v('season_receipt_units') ?? 0)} received = ${unitsM((v('season_opening_units') ?? 0) + (v('season_receipt_units') ?? 0))}) = `,
                ),
                b(pct(st)),
                t(`. Target ${pctTarget(tgt)} at week ${w.season_week ?? NA} of ${len ?? NA}, so ${pp(st - tgt)}.`),
              ],
        footLeft: `Target ${fmt(tgt, (x) => pctTarget(x))} by season week ${w.season_week ?? NA}`,
      };
    }
    case 'GMROI': {
      const g = v('gmroi');
      const tgt = v('gmroi_target');
      const byCat = gmroiByCategory(c.d, c.scope, c.asOf);
      const cat = (code: string) => fmt(byCat?.get(code), (x) => `${num(x)}×`);
      const cmp = cmpOf(c);
      const basis = cmp ? val(cmp.m, 'gmroi') : tgt;
      const label = cmp ? cmp.label : 'vs target';
      return {
        value: g === undefined ? null : [num(g), '×'],
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
        footLeft: `Target ≥ ${fmt(tgt, (x) => num(x))}× (by category)`,
      };
    }
    case 'SUPPLIER_OTIF': {
      const o = v('otif_pct') ?? 0;
      const tgt = v('otif_target') ?? 0;
      return {
        value: [pctNum(o), '%'],
        delta: ppDeltaText(c, 'otif_pct', 'otif_target', 'vs target', true),
        series: 'otif_pct',
        targetKey: 'otif_target',
        stats: [
          ['PO lines due', int(v('po_lines_due') ?? 0)],
          ['vs last week', lwPp('otif_pct')],
          ['Suppliers below 85%', int(c.d.poBelow85[c.asOf] ?? 0)],
        ],
        example: [
          t(`${int(v('po_lines_otif') ?? 0)} lines on time and in full ÷ ${int(v('po_lines_due') ?? 0)} lines due = `),
          b(pct(o)),
          t(`. Target ${pctTarget(tgt)}, so ${pp(o - tgt)}.`),
        ],
        footLeft: `Target ≥ ${pctTarget(tgt)}`,
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
            `Store ${eurM(v('mix_store_net_sales') ?? 0)}, online ${eurM(v('mix_online_net_sales') ?? 0)}, wholesale ${eurM(v('mix_wholesale_net_sales') ?? 0)} of ${eurM(c.weekly.at(-1)?.net_sales ?? 0)} → `,
          ),
          b(shares.map((s) => pct(s)).join(' / ')),
          t(
            plan.some((p) => p === undefined)
              ? '.'
              : `. Plan ${plan.map((p) => share(p ?? 0)).join(' / ')}, so ${mixPlanDelta(shares, plan)}.`,
          ),
        ],
        footLeft: `Target plan mix ${plan.some((p) => p === undefined) ? NA : plan.map((p) => share(p ?? 0)).join(' / ')}`,
      };
    }
    default:
      throw new Error(`view: unknown card ${id}`);
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
  const byCat = [...availabilityByCategory(c.d, c.scope, c.asOf)].sort((x, y) => x[1] - y[1]);
  const low = byCat[0];
  return low ? `${categoryName(c.d, low[0])} ${pct(low[1])}` : NA;
}
const categoryName = (d: ExecData, code: string): string =>
  d.categories.find((x) => x.category_code === code)?.category_name ?? code;

/** Apparel and Home & kitchen sell-through (v5 mini stats), in the selected scope. */
function seasonalStats(c: Ctx): (readonly [string, string])[] {
  const byCat = sellThroughByCategory(c.d, c.scope, c.asOf);
  return (['APPAREL', 'HOME'] as const).map(
    (code) => [categoryName(c.d, code), fmt(byCat?.get(code), (x) => pct(x, 0))] as const,
  );
}

// ---------- pop-ups ----------

function how(c: Ctx): DashboardView['how'] {
  const w = weekRow(c.d, c.asOf);
  return {
    eyebrow: `Nordmark · ${w.week_label}`,
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
        t(` is vs the comparator in the header (${CMP_LABEL[c.sel.compare]}). The `),
        b('dot'),
        t(' before the counts is the overall status over all 12 cards; hover it for the rule.'),
      ],
      [
        b('Bars'),
        t(' = the last 13 retail weeks; the current week is in the status colour, the dotted line is the target.'),
      ],
      [
        b('ⓘ'),
        t(' opens the plain-English explanation, a worked example and the owner’s note; the '),
        b('binoculars'),
        t(' open the drill path to the drill page and its lowest grain.'),
      ],
      [
        b('Side bar'),
        t(
          ': Filters (period, comparator, region and the metric attributes; inside one attribute a choice is OR, across attributes AND; filtered-out cards fade in place so nothing moves; the badge counts active choices; Reset clears), How to read, More KPIs (the 20 bench metrics, inactive), Notes.',
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
