import { createCube } from '../../sales/cube.ts';
import type { SalesEngine } from '../../sales/index.ts';
import type { SalesBase, SalesSelection } from '../../sales/types.ts';
import type { CmpRow } from '../../sales/status.ts';
import { windowOf } from '../../sales/windows.ts';
import type { Resolved } from './pnl.ts';

// Track C side of the Mirelo parity rows (parity_selections_mirelo.csv). Actual Tier-1 values are already reconciled
// by both tracks against checks/control_totals_eur.csv (Track B T-M1, Track C lib/sales/control-totals.test.ts); these
// rows cover what the control totals do not: Budget values (no control totals exist for them), the comparator row each
// card shows, the status chip with its Budget-or-PY fallback, and the card face text. Status codes: good / watch /
// off / neutral (Track B `_Loans Status` codes).

const rowText = (r: CmpRow) => `${r.label}: ${r.text}`;
/** Comparator a KPI row uses, as a code (MS-11: "vs PY" in every track). */
const CMP_CODE: Readonly<Record<string, string>> = {
  'vs Budget': 'BUD',
  'vs PY': 'PY', // MS-11: Track B wording
  'vs PY cohort': 'PY cohort', // C5 (layout-spec v4, MS-05)
};

export function resolveMirelo(base: SalesBase, engine: SalesEngine, sel: SalesSelection): Resolved {
  const out = new Map<string, number | string | null>();
  const put = (k: string, x: number | string | null | undefined) => out.set(k, x ?? null);
  const cube = createCube(base);
  const w = windowOf(sel.tv, sel.anchor);

  // ---- Budget values (fact_target BUD; amounts at the BUDGET rate per month × currency) ----
  put('budget.loans', cube.budget(w, sel.market, 'LOANS'));
  put('budget.principal_eur', cube.budget(w, sel.market, 'PRINCIPAL_LOCAL'));
  put('budget.new_clients', cube.budget(w, sel.market, 'NEW_CLIENTS'));
  put('budget.dpd30_pct', cube.budgetDpd30(sel.anchor, sel.market));
  put('budget.revenue_eur', cube.budget(w, sel.market, 'REVENUE_LOCAL'));

  // ---- Overview hero cards: both rows always, chip follows the header comparator with fallback ----
  const ov = engine.overview(sel);
  for (const h of ov.heroes) {
    put(`${h.id}.value_text`, h.second ? `${h.value} ${h.second}` : h.value);
    put(`${h.id}.row_budget`, rowText(h.rows[0]));
    put(`${h.id}.row_py`, rowText(h.rows[1]));
    put(`${h.id}.chip`, h.status ? h.status.status : 'neutral');
  }

  // ---- KPI cards of views 2–5: the row shown is the header comparator, else Prior year (no Budget) ----
  for (const view of ['loans', 'clients', 'portfolio', 'revenue'] as const)
    for (const k of engine.band({ ...sel, view }, null).kpis) {
      put(`${k.id}.label`, k.label);
      put(`${k.id}.value_text`, k.value);
      put(`${k.id}.row_cmp`, CMP_CODE[k.row.label] ?? k.row.label);
      put(`${k.id}.row`, k.row.text);
      put(`${k.id}.chip`, k.status ? k.status.status : 'neutral');
    }
  return out;
}
