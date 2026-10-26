import { createFx } from './fx.ts';
import type { Fx } from './fx.ts';
import type { DimRow } from './manifest.ts';
import type { MarketSel, SalesBase, TimeView } from './types.ts';
import { monthIndex, monthsOf } from './windows.ts';
import type { Window } from './windows.ts';

// Additive primitives over the pre-aggregated files (ADR-0011 (g)): flow metrics sum the months of a window, period-end
// metrics read one month, and every EUR amount is translated per row = month × market (= month × currency) before it
// is summed. Nothing here formats or decides status; lib/sales/kpis.ts and the view modules build on these.

export interface LoanSum {
  loans: number;
  first: number; // first loans = new clients locked in
  repeat: number;
  principal: number; // EUR at actual rates
  principalBudFx: number; // EUR at the Budget rate (constant currency, bridge FX step)
}

export interface FunnelSum {
  leads: number;
  started: number;
  submitted: number;
  kyc: number;
  approved: number;
  disbursed: number;
}

export interface Snapshot {
  outstanding: number; // EUR, month-end, actual rate of the month
  current: number;
  b1_29: number;
  b30_59: number;
  b60_89: number;
  b90p: number;
  active: number;
  dpd30Count: number;
  writtenOff: number;
  provision: number;
}

export interface SubsSum {
  start: number;
  added: number;
  churned: number;
  end: number;
  revenue: number; // EUR
  mrr: number; // EUR, month-end
}

export interface LoanFilter {
  product?: string;
  channel?: string;
  repeat?: boolean;
}

const zeroLoans = (): LoanSum => ({ loans: 0, first: 0, repeat: 0, principal: 0, principalBudFx: 0 });
const zeroFunnel = (): FunnelSum => ({ leads: 0, started: 0, submitted: 0, kyc: 0, approved: 0, disbursed: 0 });
const zeroSnapshot = (): Snapshot => ({
  outstanding: 0,
  current: 0,
  b1_29: 0,
  b30_59: 0,
  b60_89: 0,
  b90p: 0,
  active: 0,
  dpd30Count: 0,
  writtenOff: 0,
  provision: 0,
});

function indexByMonth<T>(rows: readonly T[], key: (r: T) => string): Map<number, T[]> {
  const out = new Map<number, T[]>();
  for (const r of rows) {
    const m = monthIndex(key(r));
    const list = out.get(m);
    if (list) list.push(r);
    else out.set(m, [r]);
  }
  return out;
}

export type Cube = ReturnType<typeof createCube>;

export function createCube(base: SalesBase) {
  const { dims, source } = base.manifest;
  const fx: Fx = createFx(dims.fx);
  const first = monthIndex(source.firstMonth);
  const closed = monthIndex(source.lastClosedMonth);
  const currencyOf = new Map<string, string>(dims.market.map((m) => [m.market_code, m.currency_code]));
  const currency = (market: string): string => {
    const c = currencyOf.get(market);
    if (!c) throw new Error(`cube: unknown market ${market}`);
    return c;
  };
  const inMarket = (sel: MarketSel, market: string) => sel === 'ALL' || sel === market;
  /** A window can be read when every month of it has closed actuals. */
  const available = (w: Window) => w.start >= first && w.end <= closed;
  const months = (w: Window) => monthsOf({ start: Math.max(w.start, first), end: Math.min(w.end, closed) });

  const loansAt = indexByMonth(base.loansMonth, (r) => r.month);
  const funnelAt = indexByMonth(base.funnelMonth, (r) => r.month);
  const portfolioAt = indexByMonth(base.portfolioMonth, (r) => r.month);
  const revenueAt = indexByMonth(base.revenueMonth, (r) => r.month);
  const subsAt = indexByMonth(base.subsMonth, (r) => r.month);
  const targetAt = indexByMonth(base.targetMonth, (r) => r.month);
  const agentAt = indexByMonth(base.agentMonth, (r) => r.month);
  const statKey = (tv: TimeView, anchor: string, market: MarketSel, segment: string) =>
    `${tv}|${anchor}|${market}|${segment}`;
  const stats = new Map(
    base.windowStats.map((r) => [statKey(r.tv as TimeView, r.anchor, r.market as MarketSel, r.segment), r]),
  );

  function loansBy(
    w: Window,
    market: MarketSel,
    by: (r: (typeof base.loansMonth)[number]) => string,
    f: LoanFilter = {},
  ) {
    const out = new Map<string, LoanSum>();
    for (const m of months(w))
      for (const r of loansAt.get(m) ?? []) {
        if (!inMarket(market, r.market)) continue;
        if (f.product !== undefined && r.product !== f.product) continue;
        if (f.channel !== undefined && r.channel !== f.channel) continue;
        if (f.repeat !== undefined && r.repeat !== f.repeat) continue;
        const k = by(r);
        const s = out.get(k) ?? zeroLoans();
        s.loans += r.loans;
        if (r.repeat) s.repeat += r.loans;
        else s.first += r.loans;
        s.principal += fx.toEur(r.principal_local, currency(r.market), m, 'ACTUAL_AVG');
        s.principalBudFx += fx.toEur(r.principal_local, currency(r.market), m, 'BUDGET');
        out.set(k, s);
      }
    return out;
  }

  function funnelBy(
    w: Window,
    market: MarketSel,
    by: (r: (typeof base.funnelMonth)[number]) => string,
    repeat?: boolean,
  ) {
    const out = new Map<string, FunnelSum>();
    for (const m of months(w))
      for (const r of funnelAt.get(m) ?? []) {
        if (!inMarket(market, r.market) || (repeat !== undefined && r.repeat !== repeat)) continue;
        const k = by(r);
        const s = out.get(k) ?? zeroFunnel();
        s.leads += r.leads;
        s.started += r.started;
        s.submitted += r.submitted;
        s.kyc += r.kyc_passed;
        s.approved += r.approved;
        s.disbursed += r.disbursed;
        out.set(k, s);
      }
    return out;
  }

  /** Month-end snapshot in EUR at the month's actual rate; null outside the snapshot range. */
  function snapshotBy(month: number, market: MarketSel, by: (r: (typeof base.portfolioMonth)[number]) => string) {
    if (month < first || month > closed) return null;
    const out = new Map<string, Snapshot>();
    for (const r of portfolioAt.get(month) ?? []) {
      if (!inMarket(market, r.market)) continue;
      const eur = (v: number) => fx.toEur(v, currency(r.market), month, 'ACTUAL_AVG');
      const k = by(r);
      const s = out.get(k) ?? zeroSnapshot();
      s.outstanding += eur(r.outstanding);
      s.current += eur(r.bal_current);
      s.b1_29 += eur(r.bal_1_29);
      s.b30_59 += eur(r.bal_30_59);
      s.b60_89 += eur(r.bal_60_89);
      s.b90p += eur(r.bal_90p);
      s.writtenOff += eur(r.written_off);
      s.provision += eur(r.provision);
      s.active += r.loans_active;
      s.dpd30Count += r.loans_dpd_30p;
      out.set(k, s);
    }
    return out;
  }

  /** Budget (fact_target BUD) over the months of the window that have actuals; amounts at the BUDGET rate per month × currency. */
  function budget(w: Window, market: MarketSel, metric: string, products?: readonly string[]): number | null {
    let sum = 0;
    let hit = false;
    for (const m of months(w))
      for (const r of targetAt.get(m) ?? []) {
        if (r.metric !== metric || !inMarket(market, r.market)) continue;
        if (products && (r.product === null || !products.includes(r.product))) continue;
        hit = true;
        sum += metric.endsWith('_LOCAL') ? fx.toEur(r.value, currency(r.market), m, 'BUDGET') : r.value;
      }
    return hit ? sum : null;
  }

  function budgetBy(
    w: Window,
    market: MarketSel,
    metric: string,
    by: (r: (typeof base.targetMonth)[number]) => string,
  ) {
    const out = new Map<string, number>();
    for (const m of months(w))
      for (const r of targetAt.get(m) ?? []) {
        if (r.metric !== metric || !inMarket(market, r.market)) continue;
        const v = metric.endsWith('_LOCAL') ? fx.toEur(r.value, currency(r.market), m, 'BUDGET') : r.value;
        const k = by(r);
        out.set(k, (out.get(k) ?? 0) + v);
      }
    return out;
  }

  /** Planned 30+ DPD ratio at a month; All markets = market ratios weighted by actual outstanding EUR. */
  function budgetDpd30(month: number, market: MarketSel): number | null {
    const rows = (targetAt.get(month) ?? []).filter((r) => r.metric === 'DPD30_RATIO' && inMarket(market, r.market));
    if (rows.length === 0) return null;
    if (market !== 'ALL') return rows[0]?.value ?? null;
    const snap = snapshotBy(month, 'ALL', (r) => r.market);
    if (!snap) return null;
    let num = 0;
    let den = 0;
    for (const r of rows) {
      const o = snap.get(r.market)?.outstanding ?? 0;
      num += r.value * o;
      den += o;
    }
    return den > 0 ? num / den : null;
  }

  function revenueBy(w: Window, market: MarketSel, by: (r: (typeof base.revenueMonth)[number]) => string) {
    const out = new Map<string, number>();
    for (const m of months(w))
      for (const r of revenueAt.get(m) ?? []) {
        if (!inMarket(market, r.market)) continue;
        const k = by(r);
        out.set(k, (out.get(k) ?? 0) + fx.toEur(r.amount_local, currency(r.market), m, 'ACTUAL_AVG'));
      }
    return out;
  }

  function subsBy(month: number, market: MarketSel, by: (r: (typeof base.subsMonth)[number]) => string) {
    const out = new Map<string, SubsSum>();
    for (const r of subsAt.get(month) ?? []) {
      if (!inMarket(market, r.market)) continue;
      const k = by(r);
      const s = out.get(k) ?? { start: 0, added: 0, churned: 0, end: 0, revenue: 0, mrr: 0 };
      s.start += r.subscribers_start;
      s.added += r.subscribers_new;
      s.churned += r.subscribers_churned;
      s.end += r.subscribers_end;
      s.revenue += fx.toEur(r.revenue_local, currency(r.market), month, 'ACTUAL_AVG');
      s.mrr += fx.toEur(r.mrr_local, currency(r.market), month, 'ACTUAL_AVG');
      out.set(k, s);
    }
    return out;
  }

  /** Per agent over the window: loans, principal EUR (actual), target loans. */
  function agents(w: Window) {
    const agentMarket = new Map(dims.agent.map((a) => [a.agent_code, a.market_code]));
    const out = new Map<string, { loans: number; principal: number; target: number }>();
    for (const m of months(w))
      for (const r of agentAt.get(m) ?? []) {
        const s = out.get(r.agent) ?? { loans: 0, principal: 0, target: 0 };
        s.loans += r.loans;
        s.principal += fx.toEur(r.principal_local, currency(agentMarket.get(r.agent) ?? ''), m, 'ACTUAL_AVG');
        s.target += r.target_loans;
        out.set(r.agent, s);
      }
    return out;
  }

  const sum1 = <T>(map: Map<string, T> | null, zero: () => T): T => map?.get('') ?? zero();

  return {
    fx,
    first,
    closed,
    dims,
    caps: base.manifest.caps,
    cohortDays: base.manifest.cohortDays,
    currency,
    available,
    loans: (w: Window, market: MarketSel, f: LoanFilter = {}) =>
      sum1(
        loansBy(w, market, () => '', f),
        zeroLoans,
      ),
    loansBy,
    funnel: (w: Window, market: MarketSel, repeat?: boolean) =>
      sum1(
        funnelBy(w, market, () => '', repeat),
        zeroFunnel,
      ),
    snapshot: (month: number, market: MarketSel) => {
      const s = snapshotBy(month, market, () => '');
      return s ? (s.get('') ?? zeroSnapshot()) : null;
    },
    snapshotBy,
    budget,
    budgetBy,
    budgetDpd30,
    revenue: (w: Window, market: MarketSel) => revenueBy(w, market, () => '').get('') ?? 0,
    revenueBy,
    subs: (month: number, market: MarketSel, tiers: readonly string[]) =>
      sum1(
        subsBy(month, market, (r) => (tiers.includes(r.tier) ? '' : r.tier)),
        () => ({ start: 0, added: 0, churned: 0, end: 0, revenue: 0, mrr: 0 }),
      ),
    subsBy,
    agents,
    windowStat: (tv: TimeView, anchor: string, market: MarketSel, segment = 'ALL') =>
      stats.get(statKey(tv, anchor, market, segment)) ?? null,
    vintageRows: base.vintage,
    cohortRows: base.cohortCurve,
    thresholds: dims.thresholds as readonly DimRow<'thresholds'>[],
  };
}
