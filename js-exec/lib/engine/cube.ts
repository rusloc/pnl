import type { ExecFiles } from '../data/loader.ts';
import { COST_TYPES, FILES, GROUPS, SCENARIOS } from '../data/manifest.ts';
import type { CategoryRow, CostType, Group, KpiRow, Manifest, RuleRow, Scope, WeekRow } from '../data/manifest.ts';

// Dense in-memory form of the shipped cubes (framework-free). Every metric in metrics.ts is a sum over
// weeks × site groups × categories of these arrays; nothing else reads the raw rows.

export type Measure = Exclude<keyof (typeof FILES)['cube']['columns'], 'week_ix' | 'group_ix' | 'category_ix'>;
const MEASURES = Object.keys(FILES.cube.columns).filter(
  (c): c is Measure => c !== 'week_ix' && c !== 'group_ix' && c !== 'category_ix',
);

export interface ExecData {
  manifest: Manifest;
  weeks: readonly WeekRow[];
  categories: readonly CategoryRow[];
  /** Landing cards in card order (12). */
  cards: readonly KpiRow[];
  /** Bench KPIs in catalogue order (20). */
  bench: readonly KpiRow[];
  rules: ReadonlyMap<string, RuleRow>;
  weekIx: ReadonlyMap<string, number>;
  /** Index of the as-of week (manifest.current_week_key). */
  asOf: number;
  /** FY of the as-of week: the only year with a budget and a status (E-24, E-72). */
  currentFy: number;
  cube: Readonly<Record<Measure, Float64Array>>;
  opex: Float64Array;
  poDue: Float64Array;
  poOtif: Float64Array;
  poBelow85: Float64Array;
  tradingStores: Float64Array;
  lflStores: Float64Array;
}

export const NG = GROUPS.length;
export const groupIndex = (g: Group): number => GROUPS.indexOf(g);

/** Site groups inside a region scope (E-15): ALL = every group; WHOLESALE, the DCs and central costs only in ALL. */
export const SCOPE_GROUPS: Readonly<Record<Scope, readonly number[]>> = {
  ALL: GROUPS.map((_, i) => i),
  NL: [groupIndex('NL')],
  BE: [groupIndex('BE')],
  ONLINE: [groupIndex('ONLINE')],
};

/** Selling locations for sell-through: stores and ONLINE (wholesale excluded). */
export const SELLING_GROUPS: readonly number[] = [groupIndex('NL'), groupIndex('BE'), groupIndex('ONLINE')];
export const STORE_GROUPS: readonly number[] = [groupIndex('NL'), groupIndex('BE')];

export function createData(files: ExecFiles): ExecData {
  const { manifest } = files;
  const NW = manifest.weeks.length;
  const NC = manifest.categories.length;
  const NT = COST_TYPES.length;
  const cube = Object.fromEntries(MEASURES.map((m) => [m, new Float64Array(NW * NG * NC)])) as Record<
    Measure,
    Float64Array
  >;
  for (const r of files.cube) {
    const k = (r.week_ix * NG + r.group_ix) * NC + r.category_ix;
    for (const m of MEASURES) cube[m][k] = r[m];
  }
  const opex = new Float64Array(SCENARIOS.length * NW * NT * NG);
  for (const r of files.opex)
    opex[((r.scenario_ix * NW + r.week_ix) * NT + r.cost_type_ix) * NG + r.group_ix] = r.amount;
  const poDue = new Float64Array(NW);
  const poOtif = new Float64Array(NW);
  const poBelow85 = new Float64Array(NW);
  for (const r of files.po) {
    poDue[r.week_ix] = r.po_lines_due;
    poOtif[r.week_ix] = r.po_lines_otif;
    poBelow85[r.week_ix] = r.suppliers_below_85;
  }
  const tradingStores = new Float64Array(NW * NG);
  const lflStores = new Float64Array(NW * NG);
  for (const r of files.sites) {
    tradingStores[r.week_ix * NG + r.group_ix] = r.trading_stores;
    lflStores[r.week_ix * NG + r.group_ix] = r.lfl_stores;
  }

  const weekIx = new Map(manifest.weeks.map((w, i) => [w.week_key, i]));
  const asOf = weekIx.get(manifest.current_week_key);
  if (asOf === undefined) throw new Error(`manifest: current week ${manifest.current_week_key} not in weeks`);
  const cards = manifest.kpis.filter((k) => k.is_landing).sort((a, b) => (a.card_order ?? 0) - (b.card_order ?? 0));
  if (cards.length !== 12 || cards.some((k, i) => k.card_order !== i + 1))
    throw new Error('manifest: 12 landing cards');
  return {
    manifest,
    weeks: manifest.weeks,
    categories: manifest.categories,
    cards,
    bench: manifest.kpis.filter((k) => !k.is_landing),
    rules: new Map(manifest.rules.map((r) => [r.rule_code, r])),
    weekIx,
    asOf,
    currentFy: manifest.weeks[asOf]?.fy ?? 0,
    cube,
    opex,
    poDue,
    poOtif,
    poBelow85,
    tradingStores,
    lflStores,
  };
}

/** Σ of a cube measure over weeks × groups, optionally restricted to some categories. */
export function sum(
  d: ExecData,
  m: Measure,
  weeks: readonly number[],
  groups: readonly number[],
  categories?: readonly number[],
): number {
  const NC = d.categories.length;
  const arr = d.cube[m];
  let s = 0;
  for (const w of weeks)
    for (const g of groups) {
      const base = (w * NG + g) * NC;
      if (categories) for (const c of categories) s += arr[base + c] ?? 0;
      else for (let c = 0; c < NC; c++) s += arr[base + c] ?? 0;
    }
  return s;
}

/** Σ OpEx of one scenario and cost type over weeks × groups. */
export function sumOpex(
  d: ExecData,
  scenario: (typeof SCENARIOS)[number],
  cost: CostType,
  weeks: readonly number[],
  groups: readonly number[],
): number {
  const NW = d.weeks.length;
  const NT = COST_TYPES.length;
  const sc = SCENARIOS.indexOf(scenario);
  const ct = COST_TYPES.indexOf(cost);
  let s = 0;
  for (const w of weeks) for (const g of groups) s += d.opex[((sc * NW + w) * NT + ct) * NG + g] ?? 0;
  return s;
}

/** Σ of a week × group table over groups for one week. */
export const sumSites = (arr: Float64Array, week: number, groups: readonly number[]): number =>
  groups.reduce((s, g) => s + (arr[week * NG + g] ?? 0), 0);
