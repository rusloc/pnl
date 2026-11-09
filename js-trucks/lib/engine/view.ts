import { FILTERS, KPI, TOOLTIP } from './copy.ts';
import type { Dataset, DatasetManifest } from './data.ts';
import { integer, pillText, ppText, roundValue, signedInteger, tablePct, tilePct, wholePct } from './format.ts';
import { computeKpis } from './kpi.ts';
import type { Tile } from './kpi.ts';
import { loaderList, loaderMask } from './scope.ts';
import type { Calculation, PlanType, Selection } from './selection.ts';
import { sideShares } from './shares.ts';
import type { Scope } from './shares.ts';
import { waterfallRows } from './waterfall.ts';
import type { Tone, WaterfallRow } from './waterfall.ts';

// Page faces (contract §3.5, §3.6, §5.2): components render these strings and geometry and compute nothing.

const PLAN_PAD = 6;
const FACT_PAD = 39.75;
const TRACK = 399.75;
const MIN_BAR = 2;
const LABEL_MIN_WIDTH = 36;

/** `_Header Context`: one week → `Week 9 (2023)`; all weeks → `Weeks 44 (2022) – 14 (2023)`. */
export function headerContext(
  weeks: DatasetManifest['weeks'],
  week: number | null,
  calculation: Calculation,
  planType: PlanType,
): string {
  const first = week === null ? weeks[0] : weeks[week];
  const last = week === null ? weeks[weeks.length - 1] : weeks[week];
  if (!first || !last) throw new Error('no such week');
  const range =
    first.week_num === last.week_num && first.year === last.year
      ? `Week ${first.week_num} (${first.year})`
      : first.year === last.year
        ? `Weeks ${first.week_num}–${last.week_num} (${first.year})`
        : `Weeks ${first.week_num} (${first.year}) – ${last.week_num} (${last.year})`;
  return `${range}  ·  ${calculation} calculation  ·  ${planType} plan`;
}

export interface Chip {
  key: 'week' | 'office' | 'planType' | 'calculation' | 'workType' | 'loader';
  label: string;
  value: string;
}

export function chips(ds: Dataset, sel: Selection): Chip[] {
  const week = sel.week === null ? FILTERS.all : (ds.m.weeks[sel.week]?.week_label ?? FILTERS.all);
  const picked = (xs: readonly string[], all: string) =>
    xs.length === 0 ? all : xs.length === 1 ? (xs[0] as string) : `${xs.length} ${FILTERS.selected}`;
  const workAll = sel.workTypes.length === 3;
  const list = loaderList(ds, sel);
  return [
    { key: 'week', label: FILTERS.week, value: week },
    { key: 'office', label: FILTERS.office, value: picked(sel.offices, FILTERS.all) },
    { key: 'planType', label: FILTERS.planType, value: sel.planType },
    { key: 'calculation', label: FILTERS.calculation, value: sel.calculation },
    { key: 'workType', label: FILTERS.workType, value: workAll ? FILTERS.all : sel.workTypes.join(', ') },
    { key: 'loader', label: FILTERS.loader, value: picked(sel.loaders, `${FILTERS.all} (${list.length})`) },
  ];
}

export interface TileView {
  key: 'truckLoading' | 'effectiveWork' | 'performance' | 'mass';
  title: string;
  unit: string;
  plan: string;
  fact: string;
  delta: string;
  tone: Tone;
}

/** KPI Δ pill rule (§3.5): `> band` blue, `< −band` orange, else neutral; null neutral. */
function tileTone(delta: number | null, band: number): Tone {
  if (delta === null) return 'neutral';
  return delta > band ? 'favourable' : delta < -band ? 'unfavourable' : 'neutral';
}

function tiles(k: ReturnType<typeof computeKpis>): TileView[] {
  const pctTile = (key: 'truckLoading' | 'effectiveWork', t: Tile): TileView => ({
    key,
    ...KPI[key],
    plan: tilePct(t.plan),
    fact: tilePct(t.fact),
    delta: ppText(t.delta),
    tone: tileTone(t.delta, 0.005),
  });
  const intTile = (key: 'performance' | 'mass', t: Tile): TileView => ({
    key,
    ...KPI[key],
    plan: integer(t.plan),
    fact: integer(t.fact),
    delta: signedInteger(t.delta),
    tone: tileTone(t.delta, 0.5),
  });
  return [
    pctTile('truckLoading', k.truckLoading),
    pctTile('effectiveWork', k.effectiveWork),
    intTile('performance', k.performance),
    intTile('mass', k.mass),
  ];
}

export interface BarView {
  x: number;
  width: number;
  subtotal: boolean;
  label: string | null;
  title: string;
}

export interface RowView {
  sort: number;
  name: string;
  subtotal: boolean;
  planText: string;
  factText: string;
  planBar: BarView;
  factBar: BarView;
  pill: string;
  tone: Tone;
  tooltip: { title: string; lines: { label: string; value: string }[] };
}

function barView(b: WaterfallRow['planBar'], pad: number, subtotal: boolean, share: number | null): BarView {
  const width = Math.max(b.value * TRACK, MIN_BAR);
  return {
    x: pad + b.left * TRACK,
    width,
    subtotal,
    label: subtotal && width > LABEL_MIN_WIDTH ? wholePct(b.value) : null,
    title: share === null ? '' : String(share),
  };
}

export interface BoardView {
  context: string;
  chips: Chip[];
  tiles: TileView[];
  rows: RowView[];
}

export function scopeOf(ds: Dataset, sel: Selection): Scope {
  return { mask: loaderMask(ds, sel), week: sel.week, planType: sel.planType, calculation: sel.calculation };
}

export function board(ds: Dataset, sel: Selection): BoardView {
  const scope = scopeOf(ds, sel);
  const plan = sideShares(ds, scope, 'plan');
  const fact = sideShares(ds, scope, 'fact');
  const names = new Map(ds.m.categories.map((c) => [c.sort_order, c.category_name]));
  const rows = waterfallRows(plan, fact).map((r): RowView => {
    const name = names.get(r.sort) ?? '';
    const planText = tablePct(r.plan);
    const factText = tablePct(r.fact);
    return {
      sort: r.sort,
      name,
      subtotal: r.isSubtotal,
      planText,
      factText,
      planBar: barView(r.planBar, PLAN_PAD, r.isSubtotal, r.plan),
      factBar: barView(r.factBar, FACT_PAD, r.isSubtotal, r.fact),
      pill: pillText(r.pp),
      tone: r.tone,
      tooltip: {
        title: name,
        lines: [
          { label: TOOLTIP.plan, value: planText },
          { label: TOOLTIP.fact, value: factText },
          { label: TOOLTIP.delta, value: ppText(roundValue(r.pp, 2)) }, // WF Δ pp = ROUND(COALESCE(Δ, 0) × 100, 2)
        ],
      },
    };
  });
  return {
    context: headerContext(ds.m.weeks, sel.week, sel.calculation, sel.planType),
    chips: chips(ds, sel),
    tiles: tiles(computeKpis(ds, scope, plan, fact)),
    rows,
  };
}
