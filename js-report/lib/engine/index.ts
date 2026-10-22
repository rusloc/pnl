import type { Dataset } from '../data/dataset.ts';
import { aggregateAccounts } from './aggregate.ts';
import type { Translation } from './aggregate.ts';
import { createFx } from './fx.ts';
import { contextLine, notices } from './notices.ts';
import type { Notice } from './notices.ts';
import { buildSpine, evaluateSpine } from './spine.ts';
import type { ColumnPlan, Selection, SpineRow, StatementResult, StatementRow, Variance } from './types.ts';
import { hasNoData, versionPlan } from './versions.ts';

// Public engine API (ADR-0002 §2.3): the UI calls this and nothing else; every number on screen comes from here.
// Built so far (steps 0–3): statement() in the Variance layout, by function, without slice filters; notices; context.

export interface Engine {
  statement(sel: Selection): StatementResult;
  notices(sel: Selection): Notice[]; // C-50, L-05
  context(sel: Selection): string; // L-04
  dataStatus(): { lastClosedMonth: string; builtAt: string }; // N-02 / N-03
}

const NET_REVENUE = 'NR'; // every ratio and % NR divides by step 3 (M-03, M-12)
const NO_COLOUR = new Set(['ETR_PCT']); // effective tax rate Δ carries no favourable/unfavourable colour (M-11)

function assertBuilt(sel: Selection): void {
  const pending = [
    sel.layout !== 'VAR' && `layout ${sel.layout} (build step 4)`,
    sel.costLens !== 'FN' && 'cost lens By nature (build step 8)',
    [sel.region, sel.channel, sel.line, sel.segment].some((s) => s.length > 0) && 'slice filters (build step 5)',
  ].filter(Boolean);
  if (pending.length) throw new Error(`engine: not built yet — ${pending.join(', ')}`);
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
      return notices(m, versionPlan(m, sel));
    },

    context(sel) {
      return contextLine(m, sel);
    },

    dataStatus() {
      const closed = m.tables.dim_month.filter((d) => d.is_closed);
      const last = closed[closed.length - 1];
      if (!last) throw new Error('engine: no closed month in dim_month');
      return { lastClosedMonth: last.month_key, builtAt: m.builtAt };
    },
  };
}
