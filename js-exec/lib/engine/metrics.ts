import type { Scope } from '../data/manifest.ts';
import { lyWeek, weekRow } from './calendar.ts';
import { SCOPE_GROUPS, SELLING_GROUPS, STORE_GROUPS, groupIndex, sum, sumOpex, sumSites } from './cube.ts';
import type { ExecData, Measure } from './cube.ts';
import { toDate } from './items.ts';
import type { Window } from './items.ts';
import { DOT_CODE, STATUS_CODE, countStatuses, dotOf, dotRule, statusOf } from './status.ts';
import type { Status } from './status.ts';

// The metric set of one scope × window (E-30 … E-41), keyed by the control-total metric codes of
// data/nordmark_retail_dummy_data/checks/control_totals_eur.csv. An absent key is N/A (data README "Control totals").
// Full precision throughout; rounding happens only in format.ts (E-42). One window = one item or a comparator window of
// it (items.ts); the status block runs for every window and a card is N/A where its input or basis is blank (E-95).

export type Metrics = Readonly<Record<string, number>>;

/** The 12 landing cards' kpi_code → status metric suffix (control totals `status.<code lower>`). */
const statusKey = (kpiCode: string) => `status.${kpiCode.toLowerCase()}`;

/** Channel mix channels (E-41) and the site groups that sell through them. */
const CHANNELS: readonly (readonly [string, readonly number[]])[] = [
  ['store', STORE_GROUPS],
  ['online', [groupIndex('ONLINE')]],
  ['wholesale', [groupIndex('WHOLESALE')]],
];

export function computeMetrics(d: ExecData, scope: Scope, win: Window): Metrics {
  const m = base(d, scope, win.weeks);
  const L = lastOf(win.weeks);
  if (win.gran === 'W') {
    // EBITDA flash at Week = period to date through the week (E-40, E-93); at P / Q / FY the card reads `ebitda`
    const ptd = base(d, scope, toDate(d, 'P', L).weeks);
    if (ptd.ebitda !== undefined) m.ebitda_ptd = ptd.ebitda;
    if (ptd.ebitda_bud !== undefined) m.ebitda_bud_ptd = ptd.ebitda_bud;
  }
  const statuses = d.cards.map((k) => {
    const b = badness(k.kpi_code, m);
    const rule = d.rules.get(k.kpi_code);
    if (!rule) throw new Error(`metrics: no status rule for ${k.kpi_code}`);
    const s: Status | null = b === null ? null : statusOf(b, rule);
    if (s) m[statusKey(k.kpi_code)] = STATUS_CODE[s];
    return s;
  });
  const c = countStatuses(statuses);
  m['status.count_on'] = c.on;
  m['status.count_watch'] = c.watch;
  m['status.count_off'] = c.off;
  m['status.count_na'] = c.na;
  // no rated card → no dot (the view shows it grey, E-95); OTIF is always rated, so the shipped data never hits it
  if (c.on + c.watch + c.off > 0) m['status.dot'] = DOT_CODE[dotOf(c, dotRule(d.rules))];
  if (scope === 'ALL') Object.assign(m, categoryStats(d, win.gran, L));
  return m;
}

const lastOf = (weeks: readonly number[]): number => {
  const L = weeks.at(-1);
  if (L === undefined) throw new Error('metrics: empty window');
  return L;
};

/** Direction-adjusted shortfall vs Budget / target (E-22, E-24); null = N/A. Targets come from the metric set. */
export function badness(kpi: string, m: Readonly<Record<string, number>>): number | null {
  const has = (...keys: string[]) => keys.every((k) => m[k] !== undefined);
  const v = (k: string) => m[k] ?? NaN;
  switch (kpi) {
    case 'NET_SALES':
      return has('net_sales', 'net_sales_bud') && v('net_sales_bud') !== 0
        ? 1 - v('net_sales') / v('net_sales_bud')
        : null;
    case 'TOTAL_MARGIN':
      return has('total_margin_pct', 'total_margin_pct_bud') ? v('total_margin_pct_bud') - v('total_margin_pct') : null;
    case 'WEEKS_OF_COVER':
      return has('weeks_of_cover') ? Math.abs(v('weeks_of_cover') - v('cover_target_wks')) : null;
    case 'MARKDOWN':
      return has('markdown_pct', 'markdown_pct_bud') ? v('markdown_pct') - v('markdown_pct_bud') : null;
    case 'AVAILABILITY':
      return has('availability_pct') ? v('availability_target') - v('availability_pct') : null;
    case 'EBITDA': {
      // Week reads the period-to-date pair, Month / Quarter / Year the window's own (E-93)
      const [a, bud] = 'ebitda_ptd' in m ? ['ebitda_ptd', 'ebitda_bud_ptd'] : ['ebitda', 'ebitda_bud'];
      return has(a, bud) ? 1 - v(a) / v(bud) : null;
    }
    case 'LFL_GROWTH':
      return has('lfl_growth_pct', 'lfl_growth_pct_bud') ? v('lfl_growth_pct_bud') - v('lfl_growth_pct') : null;
    case 'FRONT_GM':
      return has('front_gm_pct', 'front_gm_pct_bud') ? v('front_gm_pct_bud') - v('front_gm_pct') : null;
    case 'SELL_THROUGH':
      return has('sell_through_pct') ? v('sell_through_target') - v('sell_through_pct') : null;
    case 'GMROI':
      return has('gmroi') ? v('gmroi_target') - v('gmroi') : null;
    case 'SUPPLIER_OTIF':
      return has('otif_pct') ? v('otif_target') - v('otif_pct') : null;
    case 'CHANNEL_MIX':
      return has('mix_max_dev_pp') ? Math.abs(v('mix_max_dev_pp')) : null;
    default:
      throw new Error(`metrics: no status for ${kpi}`);
  }
}

/** Card target (param_target, category ALL). */
function target(d: ExecData, kpi: string): number {
  const t = d.manifest.targets.find((r) => r.kpi_code === kpi && r.category_code === 'ALL');
  if (!t) throw new Error(`metrics: no ALL target for ${kpi}`);
  return t.target_value;
}

function base(d: ExecData, scope: Scope, ws: readonly number[]): Record<string, number> {
  const L = lastOf(ws);
  const groups = SCOPE_GROUPS[scope];
  const S = (
    measure: Measure,
    weeks: readonly number[] = ws,
    g: readonly number[] = groups,
    cats?: readonly number[],
  ) => sum(d, measure, weeks, g, cats);
  const m: Record<string, number> = {};

  // Sales and margin (window, E-30 · E-32 · E-33 · E-34)
  m.gross_sales = S('gross_sales');
  m.markdown = S('markdown');
  m.returns = S('returns');
  m.net_sales = S('net_sales');
  m.cogs = S('cogs');
  m.back_margin = S('back_margin');
  m.front_margin = m.net_sales - m.cogs;
  m.total_margin = m.front_margin + m.back_margin;
  if (m.net_sales !== 0) {
    m.front_gm_pct = m.front_margin / m.net_sales;
    m.back_margin_pct = m.back_margin / m.net_sales;
    m.total_margin_pct = m.total_margin / m.net_sales;
  }
  if (m.gross_sales !== 0) m.markdown_pct = m.markdown / m.gross_sales;

  // EBITDA (window, E-40): scoped EBITDA is a contribution before central costs (data README open point 15)
  m.opex_shrink = sumOpex(d, 'ACT', 'SHRINK', ws, groups);
  m.opex_store = sumOpex(d, 'ACT', 'STORE_OPEX', ws, groups);
  m.opex_central = sumOpex(d, 'ACT', 'CENTRAL_OPEX', ws, groups);
  m.opex_fulfilment = sumOpex(d, 'ACT', 'FULFILMENT', ws, groups);
  m.ebitda = m.total_margin - m.opex_shrink - m.opex_store - m.opex_central - m.opex_fulfilment;
  if (m.net_sales !== 0) m.ebitda_margin_pct = m.ebitda / m.net_sales;

  // Supplier OTIF (window, E-39): no site, so the same in every scope
  m.po_lines_due = ws.reduce((s, w) => s + (d.poDue[w] ?? 0), 0);
  m.po_lines_otif = ws.reduce((s, w) => s + (d.poOtif[w] ?? 0), 0);
  m.otif_pct = m.po_lines_otif / m.po_lines_due;
  m.otif_target = target(d, 'SUPPLIER_OTIF');

  // LFL (E-31): needs the LY window by key; store-only, so N/A where the scope has no LFL LY sales
  const ly = ws.map((w) => lyWeek(d, w));
  if (ly.every((w): w is number => w !== null)) {
    const lyv = S('net_sales_lfl_as_ly', ly);
    m.store_net_sales = S('net_sales', ws, storeGroups(groups));
    m.store_net_sales_ly = S('net_sales', ly, storeGroups(groups));
    if (lyv !== 0) {
      m.lfl_net_sales = S('net_sales_lfl');
      m.lfl_net_sales_ly = lyv;
      m.lfl_store_count = sumSites(d.lflStores, L, groups);
      m.lfl_growth_pct = m.lfl_net_sales / lyv - 1;
      m.nonlfl_effect_pp = m.store_net_sales / m.store_net_sales_ly - 1 - m.lfl_growth_pct;
    }
  }

  // Weeks of cover (point in time, E-35); target = forecast-weighted category targets
  m.on_hand_cost = S('on_hand_cost', [L]);
  m.on_order_cost = S('on_order_cost', [L]);
  m.forecast_cogs = S('forecast_cogs', [L]);
  m.stock_incl_on_order = m.on_hand_cost + m.on_order_cost;
  if (m.forecast_cogs !== 0) {
    m.weeks_of_cover = m.stock_incl_on_order / m.forecast_cogs;
    const weighted = d.categories.reduce((s, c, i) => s + S('forecast_cogs', [L], groups, [i]) * c.cover_target_wks, 0);
    m.cover_target_wks = weighted / m.forecast_cogs;
  }

  // Availability (point in time, E-36): stores only
  const ranged = S('ranged_sku_days', [L]);
  if (ranged !== 0) {
    m.ranged_sku_days = ranged;
    m.in_stock_sku_days = S('in_stock_sku_days', [L]);
    m.availability_pct = m.in_stock_sku_days / ranged;
  }
  m.availability_target = target(d, 'AVAILABILITY');

  // Sell-through (season to date, E-37): seasonal categories, selling locations
  const st = sellThrough(d, L, groups);
  if (st) Object.assign(m, st, { sell_through_target: target(d, 'SELL_THROUGH') });

  // GMROI (R52W, E-38): front margin ÷ average on-hand cost over the 52 week-ends (zero weeks count)
  if (L >= 51) {
    const r52 = Array.from({ length: 52 }, (_, i) => L - 51 + i);
    const fm = S('net_sales', r52) - S('cogs', r52);
    const avg = r52.reduce((s, w) => s + S('on_hand_cost', [w]), 0) / 52;
    m.gmroi_front_margin_r52w = fm;
    m.gmroi_avg_on_hand_cost = avg;
    m.gmroi = fm / avg;
    m.gmroi_target = target(d, 'GMROI');
  }

  // Channel mix (E-41): shares over the window (USER 2026-10-29; at Week the window is the week itself)
  const net = S('net_sales');
  for (const [name, channelGroups] of CHANNELS) {
    m[`mix_${name}_net_sales`] = S('net_sales', ws, within(groups, channelGroups));
    m[`mix_${name}_pct`] = (m[`mix_${name}_net_sales`] ?? 0) / net;
  }

  // Budget (the as-of FY only, E-14): absent in FY2025, so every budget-based value and status is N/A there (E-95)
  if (weekRow(d, L).fy === d.currentFy) {
    m.net_sales_bud = S('net_sales_bud');
    m.gross_sales_bud = S('gross_sales_bud');
    m.markdown_bud = S('markdown_bud');
    m.cogs_bud = S('cogs_bud');
    m.back_margin_bud = S('back_margin_bud');
    m.markdown_pct_bud = m.markdown_bud / m.gross_sales_bud;
    m.front_gm_pct_bud = 1 - m.cogs_bud / m.net_sales_bud;
    m.total_margin_pct_bud = (m.net_sales_bud - m.cogs_bud + m.back_margin_bud) / m.net_sales_bud;
    m.opex_shrink_bud = sumOpex(d, 'BUD', 'SHRINK', ws, groups);
    m.opex_store_bud = sumOpex(d, 'BUD', 'STORE_OPEX', ws, groups);
    m.opex_central_bud = sumOpex(d, 'BUD', 'CENTRAL_OPEX', ws, groups);
    m.opex_fulfilment_bud = sumOpex(d, 'BUD', 'FULFILMENT', ws, groups);
    m.ebitda_bud =
      m.net_sales_bud -
      m.cogs_bud +
      m.back_margin_bud -
      m.opex_shrink_bud -
      m.opex_store_bud -
      m.opex_central_bud -
      m.opex_fulfilment_bud;
    m.ebitda_margin_pct_bud = m.ebitda_bud / m.net_sales_bud;
    if (m.lfl_net_sales_ly !== undefined) {
      m.lfl_net_sales_bud = S('net_sales_bud_lfl');
      m.lfl_growth_pct_bud = m.lfl_net_sales_bud / m.lfl_net_sales_ly - 1;
    }
    const netBud = m.net_sales_bud;
    let worst = 0;
    CHANNELS.forEach(([name, channelGroups], i) => {
      const pct = S('net_sales_bud', ws, within(groups, channelGroups)) / netBud;
      m[`mix_${name}_pct_bud`] = pct;
      const dev = (m[`mix_${name}_pct`] ?? 0) - pct;
      if (i === 0 || Math.abs(dev) > Math.abs(m.mix_max_dev_pp ?? 0)) {
        worst = i;
        m.mix_max_dev_pp = dev;
      }
    });
    m.mix_max_dev_channel = worst + 1;
  }
  return m;
}

const within = (groups: readonly number[], wanted: readonly number[]) => groups.filter((g) => wanted.includes(g));
const storeGroups = (groups: readonly number[]) => within(groups, STORE_GROUPS);

function sellThrough(d: ExecData, L: number, groups: readonly number[]): Record<string, number> | null {
  const sw = weekRow(d, L).season_week;
  if (sw === null || L - sw < 0) return null;
  const seasonal = d.categories.flatMap((c, i) => (c.is_seasonal ? [i] : []));
  const sell = groups.filter((g) => SELLING_GROUPS.includes(g));
  const weeks = Array.from({ length: sw }, (_, i) => L - sw + 1 + i);
  const opening = sum(d, 'on_hand_units', [L - sw], sell, seasonal);
  const receipts = sum(d, 'receipt_units', weeks, groups, seasonal);
  const sold = sum(d, 'units', weeks, sell, seasonal);
  return {
    season_opening_units: opening,
    season_receipt_units: receipts,
    season_units_sold: sold,
    sell_through_pct: sold / (opening + receipts),
  };
}

/** GMROI per category over R52W in a scope (ⓘ mini stats); null without 52 weeks of history. */
export function gmroiByCategory(d: ExecData, scope: Scope, L: number): Map<string, number> | null {
  if (L < 51) return null;
  const groups = SCOPE_GROUPS[scope];
  const r52 = Array.from({ length: 52 }, (_, i) => L - 51 + i);
  return new Map(
    d.categories.map((c, i) => {
      const fm = sum(d, 'net_sales', r52, groups, [i]) - sum(d, 'cogs', r52, groups, [i]);
      return [c.category_code, fm / (sum(d, 'on_hand_cost', r52, groups, [i]) / 52)];
    }),
  );
}

/** Sell-through per seasonal category in a scope (ⓘ mini stats); null outside a season. */
export function sellThroughByCategory(d: ExecData, scope: Scope, L: number): Map<string, number> | null {
  const sw = weekRow(d, L).season_week;
  if (sw === null || L - sw < 0) return null;
  const groups = SCOPE_GROUPS[scope];
  const sell = within(groups, SELLING_GROUPS);
  const weeks = Array.from({ length: sw }, (_, i) => L - sw + 1 + i);
  return new Map(
    d.categories.flatMap((c, i) => {
      if (!c.is_seasonal) return [];
      const sold = sum(d, 'units', weeks, sell, [i]);
      const opening = sum(d, 'on_hand_units', [L - sw], sell, [i]);
      return [[c.category_code, sold / (opening + sum(d, 'receipt_units', weeks, groups, [i]))] as const];
    }),
  );
}

/** Availability per category in a scope's last week, stores only (ⓘ mini stat "Lowest category"). */
export function availabilityByCategory(d: ExecData, scope: Scope, L: number): Map<string, number> {
  const groups = SCOPE_GROUPS[scope];
  return new Map(
    d.categories.flatMap((c, i) => {
      const ranged = sum(d, 'ranged_sku_days', [L], groups, [i]);
      return ranged === 0 ? [] : [[c.category_code, sum(d, 'in_stock_sku_days', [L], groups, [i]) / ranged] as const];
    }),
  );
}

/** ALL-only control-total extras: GMROI per category, sell-through per seasonal category, suppliers below 85 % (W). */
function categoryStats(d: ExecData, gran: Window['gran'], L: number): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [code, v] of gmroiByCategory(d, 'ALL', L) ?? []) out[`gmroi.${code}`] = v;
  for (const [code, v] of sellThroughByCategory(d, 'ALL', L) ?? []) out[`sell_through_pct.${code}`] = v;
  if (gran === 'W') out.otif_suppliers_below_85 = d.poBelow85[L] ?? 0;
  return out;
}
