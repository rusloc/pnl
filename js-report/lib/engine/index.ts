import type { Dataset } from '../data/dataset.ts';
import { aggregateAccounts } from './aggregate.ts';
import { analysisBridges, largestVariances } from './analysis.ts';
import type { Translation } from './aggregate.ts';
import { createFx } from './fx.ts';
import { appliedFilters, headerStatus, railSummaries } from './header.ts';
import type { FilterRow } from './header.ts';
import { notices } from './notices.ts';
import type { Notice } from './notices.ts';
import { periodView } from './period.ts';
import { profitability } from './profitability.ts';
import { createSliceCache } from './slices.ts';
import type { PeriodView } from './period.ts';
import { buildSpine, evaluateSpine } from './spine.ts';
import type { ColumnPlan, Selection, SpineRow, StatementResult, StatementRow, Variance } from './types.ts';
import { hasNoData, versionPlan } from './versions.ts';
import { createViewContext } from './view-context.ts';
import type {
  AnalysisVM,
  HowToReadVM,
  ProfitabilityVM,
  VarCut,
  VarMode,
  VarTop,
  VariancesVM,
  VitalsVM,
} from './view-types.ts';
import { howToRead } from './view-copy.ts';
import { vitals } from './vitals.ts';

// Public engine API (ADR-0002 §2.3): the UI calls this and nothing else; every number on screen comes from here.
// Built so far (steps 0–3): statement() in the Variance layout, by function, without slice filters; notices; page top.

export interface Engine {
  statement(sel: Selection): StatementResult;
  notices(sel: Selection): Notice[]; // C-50, L-05: labelled rows of the applied-filters pop-up
  dataStatus(): { lastClosedMonth: string; builtAt: string }; // N-02 / N-03
  period(sel: Selection): PeriodView; // F-02 … F-04, C-01: period picker v2 summary sentence and month grid
  /** Page top: status line (L-01, N-02), applied-filters rows (replace the L-04 context line), rail summaries. */
  header(
    sel: Selection,
    timeZone?: string,
  ): { status: string; filters: FilterRow[]; rail: { versions: string; display: string } };
  /** P&L views redesign v4 (single company views; the Group view is not built in Track C). */
  vitals(sel: Selection): VitalsVM;
  analysis(sel: Selection): AnalysisVM;
  variances(sel: Selection, top: VarTop, mode: VarMode, cut: VarCut): VariancesVM;
  profitability(sel: Selection): ProfitabilityVM;
  howToRead(sel: Selection): HowToReadVM;
}

const NET_REVENUE = 'NR'; // every ratio and % NR divides by step 3 (M-03, M-12)
const NO_COLOUR = new Set(['ETR_PCT']); // effective tax rate Δ carries no favourable/unfavourable colour (M-11)

function assertBuilt(sel: Selection): void {
  if ([sel.region, sel.channel, sel.line, sel.segment].some((s) => s.length > 0))
    throw new Error('engine: not built yet — slice filters (build step 5)');
}

/**
 * Δ = current − comparison on signed values (M-10): positive is favourable on every line, revenue or cost (T-13).
 * Δ % = Δ ÷ |comparison|. Ratio rows: Δ in percentage points, no Δ % (M-11).
 */
export function variance(row: Pick<SpineRow, 'code' | 'kind'>, current: number | null, comparison: number | null) {
  if (current === null || comparison === null) return { delta: null, deltaPct: null, favourable: null };
  const delta = current - comparison;
  const isRatio = row.kind === 'ratio';
  return {
    delta,
    deltaPct: isRatio || comparison === 0 ? null : delta / Math.abs(comparison),
    favourable: delta === 0 || NO_COLOUR.has(row.code) ? null : delta > 0,
  };
}

export function createEngine(ds: Dataset): Engine {
  const m = ds.manifest;
  const fx = createFx(m);
  const cache = createSliceCache(ds);
  const view = (sel: Selection) => createViewContext(ds, sel, cache, fx);

  return {
    statement(sel) {
      assertBuilt(sel);
      const plan = versionPlan(m, sel);
      const tr: Translation = { fx, currency: sel.currency, basis: sel.fxBasis, fy: sel.fy };
      const spine = buildSpine(m, sel.entity);
      const evaluate = (c: ColumnPlan | null) =>
        c === null || hasNoData(c) ? null : evaluateSpine(m, spine, aggregateAccounts(ds, sel.entity, c, tr));

      const base = evaluate(plan.base);
      const compareA = evaluate(plan.compareA);
      const compareB = evaluate(plan.compareB);
      const fyBudget = evaluate(plan.fyBudget);
      const fyLE = evaluate(plan.fyLE);
      const baseNr = base?.get(NET_REVENUE) ?? null;

      const rows = spine.map((row): StatementRow => {
        const value = (col: Map<string, number | null> | null) => col?.get(row.code) ?? null;
        const b = value(base);
        const compare = (on: ColumnPlan | null, col: Map<string, number | null> | null): Variance | null => {
          if (on === null) return null;
          const v = value(col);
          return { value: v, ...variance(row, b, v) };
        };
        const le = value(fyLE);
        const budget = value(fyBudget);
        return {
          ...row,
          base: b,
          pctNr: row.kind === 'ratio' || b === null || !baseNr ? null : b / baseNr,
          compareA: compare(plan.compareA, compareA),
          compareB: compare(plan.compareB, compareB),
          fyBudget: budget,
          fyLE: { value: le, ...variance(row, le, budget) },
        };
      });
      return { rows, plan };
    },

    notices(sel) {
      return notices(m, sel, versionPlan(m, sel));
    },

    dataStatus() {
      const closed = m.tables.dim_month.filter((d) => d.is_closed);
      const last = closed[closed.length - 1];
      if (!last) throw new Error('engine: no closed month in dim_month');
      return { lastClosedMonth: last.month_key, builtAt: m.builtAt };
    },

    period(sel) {
      return periodView(m, sel);
    },

    header(sel, timeZone) {
      return { status: headerStatus(m, sel, timeZone), filters: appliedFilters(m, sel), rail: railSummaries(sel) };
    },

    vitals: (sel) => vitals(view(sel)),
    analysis: (sel) => analysisBridges(view(sel)),
    variances: (sel, top, mode, cut) => largestVariances(view(sel), top, mode, cut),
    profitability: (sel) => profitability(view(sel)),
    howToRead: (sel) => howToRead(m, sel, view(sel)),
  };
}
