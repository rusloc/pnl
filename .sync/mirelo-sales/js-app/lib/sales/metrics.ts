import type { Cube, FunnelSum, LoanFilter, LoanSum, Snapshot } from './cube.ts';
import type { MarketSel, TimeView } from './types.ts';
import { MARKETS } from './manifest.ts';
import { monthKey, windowOf } from './windows.ts';
import type { Window } from './windows.ts';

// Metric definitions of the Mirelo report (ADR-0011 (g) Tier-1, README "Rules to apply in your measures"). Each
// returns the raw value (ratio as a fraction, amounts in EUR) or null when the window / month has no data. Actuals of a
// window clipped by the data start (R12M before Dec 2024) read the months that exist; comparisons (PY) need the whole
// reference window (`ref*` helpers).

export type Metrics = ReturnType<typeof createMetrics>;

const ratio = (num: number, den: number): number | null => (den > 0 ? num / den : null);

export function createMetrics(cube: Cube) {
  const markets = (m: MarketSel): readonly string[] => (m === 'ALL' ? MARKETS : [m]);

  // ---- loans (Tier-1 #1, #2) ----
  const loans = (w: Window, market: MarketSel, f?: LoanFilter): LoanSum => cube.loans(w, market, f);
  /** Reference window (PY): null unless every month of it has actuals. */
  const refLoans = (w: Window, market: MarketSel, f?: LoanFilter): LoanSum | null =>
    cube.available(w) ? cube.loans(w, market, f) : null;
  const avgTicket = (s: LoanSum | null) => (s ? ratio(s.principal, s.loans) : null);

  // ---- returning clients (Tier-1 #3): client-weighted from the per-window distinct counts ----
  function returning(tv: TimeView, anchor: number, market: MarketSel, segment = 'ALL'): number | null {
    const r = cube.windowStat(tv, monthKey(anchor), market, segment);
    return r ? ratio(r.returning, r.borrowers) : null;
  }
  const refReturning = (tv: TimeView, anchor: number, market: MarketSel, segment = 'ALL') =>
    cube.available(windowOf(tv, anchor)) ? returning(tv, anchor, market, segment) : null;
  const repeatShare = (s: LoanSum | null) => (s ? ratio(s.repeat, s.loans) : null);

  type StatField = 'median_hours_to_cash' | 'median_hours_to_approve' | 'median_hours_payout' | 'median_days_between';
  function median(tv: TimeView, anchor: number, market: MarketSel, field: StatField): number | null {
    return cube.windowStat(tv, monthKey(anchor), market)?.[field] ?? null;
  }
  const refMedian = (tv: TimeView, anchor: number, market: MarketSel, field: StatField) =>
    cube.available(windowOf(tv, anchor)) ? median(tv, anchor, market, field) : null;

  // ---- funnel ----
  const funnel = (w: Window, market: MarketSel, repeat?: boolean): FunnelSum => cube.funnel(w, market, repeat);
  const refFunnel = (w: Window, market: MarketSel, repeat?: boolean): FunnelSum | null =>
    cube.available(w) ? cube.funnel(w, market, repeat) : null;
  const approval = (f: FunnelSum | null) => (f ? ratio(f.approved, f.submitted) : null);
  const takeUp = (f: FunnelSum | null) => (f ? ratio(f.disbursed, f.approved) : null);

  // ---- portfolio (Tier-1 #4): period-end at the anchor month ----
  const snap = (month: number, market: MarketSel): Snapshot | null => cube.snapshot(month, market);
  const dpd30 = (s: Snapshot | null) => (s ? ratio(s.b30_59 + s.b60_89 + s.b90p, s.outstanding) : null);
  const dpd90 = (s: Snapshot | null) => (s ? ratio(s.b90p, s.outstanding) : null);
  const dpd30Count = (s: Snapshot | null) => (s ? ratio(s.dpd30Count, s.active) : null);
  const dpd30At = (month: number, market: MarketSel) => dpd30(snap(month, market));

  /** Roll 30→60 ≈ 60–89 balance this month ÷ 30–59 balance last month (README; balances amortise). */
  function roll3060(month: number, market: MarketSel): number | null {
    const now = snap(month, market);
    const prev = snap(month - 1, market);
    return now && prev ? ratio(now.b60_89, prev.b30_59) : null;
  }
  /** Roll 1–29→30+ ≈ 30–59 balance this month ÷ 1–29 balance last month (same approximation). */
  function roll129(month: number, market: MarketSel): number | null {
    const now = snap(month, market);
    const prev = snap(month - 1, market);
    return now && prev ? ratio(now.b30_59, prev.b1_29) : null;
  }
  /** Cost of risk = Σ provision ÷ months × 12 ÷ average month-end outstanding (both in EUR). */
  function costOfRisk(w: Window, market: MarketSel): number | null {
    let provision = 0;
    let outstanding = 0;
    let n = 0;
    for (let m = Math.max(w.start, cube.first); m <= Math.min(w.end, cube.closed); m++) {
      const s = snap(m, market);
      if (!s) continue;
      provision += s.provision;
      outstanding += s.outstanding;
      n++;
    }
    return n > 0 ? ratio((provision / n) * 12, outstanding / n) : null;
  }

  // ---- vintages (fact_loan_month by vintage × months on book) ----
  const vintageIx = new Map<string, { disbursed: number; first30: number[]; first90: number[] }>();
  for (const r of cube.vintageRows) {
    const key = `${r.vintage}|${r.market}`;
    const v = vintageIx.get(key) ?? { disbursed: r.disbursed, first30: [], first90: [] };
    v.first30[r.mob] = r.first_30p;
    v.first90[r.mob] = r.first_90p;
    vintageIx.set(key, v);
  }
  const observedMob = (vintage: number) => cube.closed - vintage;

  /** Vintage 6-month bad rate: loans first 90+ within 6 months on book ÷ loans disbursed in the vintage. */
  function vintageBad6(vintage: number, market: MarketSel): number | null {
    if (vintage < cube.first || observedMob(vintage) < 6) return null;
    let bad = 0;
    let disbursed = 0;
    for (const m of markets(market)) {
      const v = vintageIx.get(`${monthKey(vintage)}|${m}`);
      if (!v) continue;
      disbursed += v.disbursed;
      for (let mob = 0; mob <= 6; mob++) bad += v.first90[mob] ?? 0;
    }
    return ratio(bad, disbursed);
  }

  /** Cumulative 30+ rate by months on book (0 … 12) for a set of vintages; a point needs every vintage observed. */
  function vintageCurve(vintages: readonly number[], market: MarketSel): (number | null)[] {
    return Array.from({ length: 13 }, (_, mob) => {
      if (vintages.length === 0 || vintages.some((v) => v < cube.first || observedMob(v) < mob)) return null;
      let hit = 0;
      let disbursed = 0;
      for (const v of vintages)
        for (const m of markets(market)) {
          const row = vintageIx.get(`${monthKey(v)}|${m}`);
          if (!row) continue;
          disbursed += row.disbursed;
          for (let k = 0; k <= mob; k++) hit += row.first30[k] ?? 0;
        }
      return ratio(hit, disbursed);
    });
  }

  // ---- cohort repeat curves (first-loan month × days since first loan) ----
  const cohortIx = new Map<string, { clients: number; repeated: number; observable: boolean }[]>();
  for (const r of cube.cohortRows) {
    const key = `${r.cohort}|${r.market}`;
    const list = cohortIx.get(key) ?? [];
    list[cube.cohortDays.indexOf(r.day)] = { clients: r.clients, repeated: r.repeated, observable: r.observable };
    cohortIx.set(key, list);
  }
  /**
   * Share of a cohort with a 2nd loan within d days. Right-censored: a cohort month counts at day d only when all of
   * its clients have been observed for d days by the last close; a point with no such month is blank.
   */
  function cohortCurve(cohorts: readonly number[], market: MarketSel): (number | null)[] {
    return cube.cohortDays.map((_, k) => {
      let clients = 0;
      let repeated = 0;
      for (const c of cohorts)
        for (const m of markets(market)) {
          const p = cohortIx.get(`${monthKey(c)}|${m}`)?.[k];
          if (!p?.observable) continue;
          clients += p.clients;
          repeated += p.repeated;
        }
      return ratio(repeated, clients);
    });
  }
  /** 180-day repeat of one cohort month (null until the whole cohort is 180 days old). */
  const repeat180 = (cohort: number, market: MarketSel): number | null => cohortCurve([cohort], market).at(-1) ?? null;

  // ---- revenue and subscriptions ----
  const revenue = (w: Window, market: MarketSel): number => cube.revenue(w, market);
  const refRevenue = (w: Window, market: MarketSel): number | null =>
    cube.available(w) ? cube.revenue(w, market) : null;
  const paying = (month: number, market: MarketSel) =>
    month >= cube.first && month <= cube.closed ? cube.subs(month, market, ['PLUS', 'PRO']) : null;

  return {
    loans,
    refLoans,
    avgTicket,
    returning,
    refReturning,
    repeatShare,
    median,
    refMedian,
    funnel,
    refFunnel,
    approval,
    takeUp,
    snap,
    dpd30,
    dpd90,
    dpd30Count,
    dpd30At,
    roll3060,
    roll129,
    costOfRisk,
    vintageBad6,
    vintageCurve,
    cohortCurve,
    repeat180,
    revenue,
    refRevenue,
    paying,
  };
}
