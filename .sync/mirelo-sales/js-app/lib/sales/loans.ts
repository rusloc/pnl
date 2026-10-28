import { MARKET_NAMES, info } from './copy.ts';
import type { InfoValue } from './copy.ts';
import type { Cube } from './cube.ts';
import { fmtCount, fmtDeltaPct, fmtEur, fmtEur0, fmtEurDelta, fmtHours, fmtPct, fmtPp } from './format.ts';
import { chipOf, kpiRows } from './kpis.ts';
import type { Bundle } from './kpis.ts';
import { MARKETS } from './manifest.ts';
import type { Ctx } from './overview.ts';
import { trend } from './overview.ts';
import { attainmentStatus, cmpRow } from './status.ts';
import type { DeltaKind } from './status.ts';
import type { Comparator, MarketSel, SalesSelection } from './types.ts';
import type { BandVM, ChartCard, KpiCard, SeriesRole, TableCard } from './view-model.ts';
import { shift, windowLabel, windowOf } from './windows.ts';
import type { Window } from './windows.ts';

// View 2 — Loans issued (layout-spec §2): volume, ticket, funnel, bridge, product mix, cycle time, agents.

export function kpi(
  id: string,
  label: string,
  value: string,
  values: InfoValue[],
  kind: DeltaKind,
  b: Bundle,
  cmp: Comparator,
): KpiCard {
  const { row, alt } = kpiRows(kind, b, cmp);
  return { id, label, info: info(id, values), value, row, alt, status: chipOf(row) };
}

export const CATEGORY_ROLES: readonly SeriesRole[] = ['c1', 'c2', 'c3', 'c4', 'c5'];

export interface Bridge {
  budget: number;
  volume: number;
  mix: number;
  ticket: number;
  fx: number;
  actual: number;
  residual: number; // budget + steps − actual (0 up to float noise)
}

/**
 * Originations bridge Budget → Actual (principal, EUR). Cells = market × product. At Budget FX: volume = (A loans −
 * B loans) × B average ticket; mix = Σ (A share − B share) × A loans × B cell ticket; ticket = Σ A loans × (A cell
 * ticket − B cell ticket); then FX = Actual at actual rates − Actual at Budget rates. A cell with no Budget loans uses
 * its own actual ticket (its whole effect lands in mix).
 */
export function bridge(cube: Cube, w: Window, market: MarketSel): Bridge | null {
  const key = (r: { market: string; product: string | null }) => `${r.market}|${r.product ?? ''}`;
  const actual = cube.loansBy(w, market, key);
  const bLoans = cube.budgetBy(w, market, 'LOANS', key);
  const bPrincipal = cube.budgetBy(w, market, 'PRINCIPAL_LOCAL', key);
  let B = 0;
  let BN = 0;
  for (const [k, n] of bLoans) {
    BN += n;
    B += bPrincipal.get(k) ?? 0;
  }
  if (BN <= 0) return null;
  const BT = B / BN;
  let AN = 0;
  let AatB = 0;
  let A = 0;
  for (const s of actual.values()) {
    AN += s.loans;
    AatB += s.principalBudFx;
    A += s.principal;
  }
  let mix = 0;
  let ticket = 0;
  for (const k of new Set([...actual.keys(), ...bLoans.keys()])) {
    const a = actual.get(k);
    const bn = bLoans.get(k) ?? 0;
    const an = a?.loans ?? 0;
    const bt = bn > 0 ? (bPrincipal.get(k) ?? 0) / bn : an > 0 ? (a?.principalBudFx ?? 0) / an : 0;
    mix += (an - (AN * bn) / BN) * bt;
    ticket += (a?.principalBudFx ?? 0) - an * bt;
  }
  const volume = (AN - BN) * BT;
  const fx = A - AatB;
  return { budget: B, volume, mix, ticket, fx, actual: A, residual: B + volume + mix + ticket + fx - A };
}

export function loansView(ctx: Ctx, sel: SalesSelection): BandVM {
  const { cube, m } = ctx;
  const mk = sel.market;
  const w = windowOf(sel.tv, sel.anchor);
  const py = shift(w, -12);
  const A = m.loans(w, mk);
  const P = m.refLoans(py, mk);
  const budLoans = cube.budget(w, mk, 'LOANS');
  const budPrincipal = cube.budget(w, mk, 'PRINCIPAL_LOCAL');
  const F = m.funnel(w, mk);
  const FP = m.refFunnel(py, mk);
  const step12 = m.loans(w, mk, { product: 'STEP12' }).loans;
  const cash = m.median(sel.tv, sel.anchor, mk, 'median_hours_to_cash');

  const cashPy = m.refMedian(sel.tv, sel.anchor - 12, mk, 'median_hours_to_cash');
  const kpis: KpiCard[] = [
    kpi(
      'l1',
      'Loans',
      fmtCount(A.loans),
      [
        { label: 'Budget', value: fmtCount(budLoans) },
        { label: 'Prior year', value: fmtCount(P?.loans ?? null) },
      ],
      'countUp',
      { actual: A.loans, budget: budLoans, py: P?.loans ?? null },
      sel.cmp,
    ),
    kpi(
      'l2',
      'Principal',
      fmtEur(A.principal),
      [
        { label: 'Budget', value: fmtEur(budPrincipal) },
        { label: 'At Budget FX', value: fmtEur(A.principalBudFx) },
        {
          label: 'Δ vs Budget at Budget FX',
          value: budPrincipal ? fmtDeltaPct(A.principalBudFx / budPrincipal - 1) : 'n/a',
        },
        { label: 'Prior year', value: fmtEur(P?.principal ?? null) },
      ],
      'countUp',
      { actual: A.principal, budget: budPrincipal, py: P?.principal ?? null },
      sel.cmp,
    ),
    kpi(
      'l3',
      'Avg ticket',
      fmtEur0(m.avgTicket(A)),
      [
        { label: 'Step 12 share of loans', value: fmtPct(A.loans ? step12 / A.loans : null) },
        { label: 'Budget ticket', value: fmtEur0(budPrincipal && budLoans ? budPrincipal / budLoans : null) },
        { label: 'Prior year', value: fmtEur0(m.avgTicket(P)) },
      ],
      'neutralPct',
      { actual: m.avgTicket(A), budget: budPrincipal && budLoans ? budPrincipal / budLoans : null, py: m.avgTicket(P) },
      sel.cmp,
    ),
    kpi(
      'l4',
      'Approval rate',
      fmtPct(m.approval(F)),
      [
        { label: 'New clients', value: fmtPct(m.approval(m.funnel(w, mk, false))) },
        { label: 'Submitted', value: fmtCount(F.submitted) },
        { label: 'Approved', value: fmtCount(F.approved) },
      ],
      'ratioUp',
      { actual: m.approval(F), py: m.approval(FP) },
      sel.cmp,
    ),
    kpi(
      'l5',
      'Take-up rate',
      fmtPct(m.takeUp(F)),
      [
        { label: 'Approved', value: fmtCount(F.approved) },
        { label: 'Disbursed', value: fmtCount(F.disbursed) },
      ],
      'ratioUp',
      { actual: m.takeUp(F), py: m.takeUp(FP) },
      sel.cmp,
    ),
    kpi(
      'l6',
      'Time to cash',
      fmtHours(cash),
      [{ label: 'Prior year', value: fmtHours(cashPy) }],
      'hoursDown',
      { actual: cash, py: cashPy },
      sel.cmp,
    ),
  ];

  // L7 Loans by month vs Budget
  const t = trend(ctx, sel.anchor, (i) => m.loans({ start: i, end: i }, mk).loans);
  const l7: ChartCard = {
    id: 'l7',
    title: 'Loans by month vs Budget',
    info: info('l7'),
    open: null,
    legend: [
      { label: 'Actual', role: 'actual' },
      { label: 'Budget', role: 'budget' },
      { label: 'Prior year', role: 'ghost' },
    ],
    chart: {
      kind: 'columns',
      x: t.x,
      months: t.months,
      unit: 'count',
      stacks: [{ name: 'Actual', role: 'actual', values: t.actual }],
      ghost: t.py,
      line: {
        name: 'Budget',
        role: 'budget',
        values: t.months.map((i) =>
          i >= cube.first && i <= cube.closed ? cube.budget({ start: i, end: i }, mk, 'LOANS') : null,
        ),
      },
      selected: 12,
      labels: null,
      percent: false,
    },
  };

  // L8 Application funnel
  const stages = [
    ['Started', 'started'],
    ['Submitted', 'submitted'],
    ['KYC passed', 'kyc'],
    ['Approved', 'approved'],
    ['Disbursed', 'disbursed'],
  ] as const;
  const l8: ChartCard = {
    id: 'l8',
    title: 'Application funnel',
    info: info('l8'),
    open: null,
    legend: [
      { label: 'Applications', role: 'actual' },
      { label: 'Lost at the step', role: 'c3' },
    ],
    chart: {
      kind: 'funnel',
      rows: stages.map(([label, key], k) => {
        const prevKey = k === 0 ? 'leads' : (stages[k - 1]?.[1] ?? 'leads');
        const v = F[key];
        const prev = F[prevKey];
        const conv = prev > 0 ? v / prev : null;
        const convPy = FP && FP[prevKey] > 0 ? FP[key] / FP[prevKey] : null;
        return {
          label,
          value: v,
          text: fmtCount(v),
          sub: `${fmtPct(conv, 0)} - ${conv !== null && convPy !== null ? fmtPp(conv - convPy) : 'n/a'} vs PY`,
          lost: prev - v,
        };
      }),
    },
  };

  // L9 Originations bridge
  const br = bridge(cube, w, mk);
  const l9: ChartCard = {
    id: 'l9',
    title: 'Originations bridge Budget → Actual',
    info: info('l9'),
    open: null,
    legend: [
      { label: 'Budget / Actual', role: 'actual' },
      { label: 'increase', role: 'budget' },
      { label: 'decrease', role: 'c3' },
    ],
    chart: br
      ? {
          kind: 'waterfall',
          steps: [
            { label: 'Budget', value: br.budget, kind: 'total', text: fmtEur(br.budget) },
            ...(
              [
                ['volume', br.volume],
                ['ticket', br.ticket],
                ['mix', br.mix],
                ['FX', br.fx],
              ] as const
            ).map(([label, v]) => ({
              label,
              value: v,
              kind: v >= 0 ? ('up' as const) : ('down' as const),
              text: fmtEurDelta(v),
            })),
            { label: 'Actual', value: br.actual, kind: 'total', text: fmtEur(br.actual) },
          ],
        }
      : { kind: 'placeholder', text: 'No Budget for this window' },
  };

  // L10 Loans by product × market
  const products = cube.dims.product.filter((p) => p.product_line === 'Microloan');
  const byCell = cube.loansBy(w, 'ALL', (r) => `${r.market}|${r.product}`);
  const shownMarkets = mk === 'ALL' ? MARKETS : [mk];
  const l10: ChartCard = {
    id: 'l10',
    title: 'Loans by product × market',
    info: info('l10'),
    open: null,
    legend: products.map((p, k) => ({ label: p.product_name, role: CATEGORY_ROLES[k] ?? 'c5' })),
    chart: {
      kind: 'stackedBars',
      unit: 'count',
      segments: products.map((p, k) => ({ name: p.product_name, role: CATEGORY_ROLES[k] ?? 'c5' })),
      rows: shownMarkets.map((c) => {
        const values = products.map((p) => byCell.get(`${c}|${p.product_code}`)?.loans ?? 0);
        return { label: MARKET_NAMES[c], values, text: fmtCount(values.reduce((s, v) => s + v, 0)) };
      }),
    },
  };

  // L11 Attainment by channel: no channel targets in the dataset
  const l11: ChartCard = {
    id: 'l11',
    title: 'Attainment by channel',
    info: info('l11'),
    open: null,
    legend: [],
    chart: {
      kind: 'placeholder',
      text: 'Not available - no channel targets', // the reason is in the ⓘ (ADR-0012, MS-13)
    },
  };

  // L12 Stage cycle time vs SLA (the two timed legs; SLA = dim_funnel_stage.sla_hours)
  const sla = (code: string) => cube.dims.funnel_stage.find((s) => s.stage_code === code)?.sla_hours ?? null;
  const approveSla = (sla('KYC_PASSED') ?? 0) + (sla('APPROVED') ?? 0) || null;
  const appr = m.median(sel.tv, sel.anchor, mk, 'median_hours_to_approve');
  const payout = m.median(sel.tv, sel.anchor, mk, 'median_hours_payout');
  const l12: ChartCard = {
    id: 'l12',
    title: 'Stage cycle time vs SLA',
    info: info('l12'),
    open: null,
    legend: [
      { label: 'Median hours', role: 'actual' },
      { label: 'SLA', role: 'budget' },
    ],
    chart: {
      kind: 'bars',
      unit: 'hours',
      rows: [
        {
          label: 'Submitted → approved',
          value: appr,
          ghost: null,
          tick: approveSla,
          text: `${fmtHours(appr)}${approveSla ? ` - SLA ${approveSla} h` : ''}`,
        },
        { label: 'Approved → cash', value: payout, ghost: null, tick: null, text: `${fmtHours(payout)} - no SLA` },
        { label: 'Submitted → cash', value: cash, ghost: null, tick: null, text: fmtHours(cash) },
      ],
    },
  };

  return { kpis, charts: [l7, l8, l9, l10, l11, l12], layout: 'thirds', table: leaderboard(ctx, sel) };
}

function leaderboard(ctx: Ctx, sel: SalesSelection): TableCard {
  const { cube } = ctx;
  const w = windowOf(sel.tv, sel.anchor);
  const now = cube.agents(w);
  const prior = cube.available(shift(w, -12)) ? cube.agents(shift(w, -12)) : null;
  const cmpName = sel.cmp === 'BUD' ? 'vs quota' : 'vs PY';
  const rows = cube.dims.agent
    .filter((a) => sel.market === 'ALL' || a.market_code === sel.market)
    .map((a) => {
      const s = now.get(a.agent_code) ?? { loans: 0, principal: 0, target: 0 };
      const att = s.target > 0 ? s.loans / s.target : null;
      return { a, s, att };
    })
    .filter((r) => r.s.loans > 0 || r.s.target > 0)
    .sort((x, y) => (y.att ?? -1) - (x.att ?? -1) || x.a.sort_order - y.a.sort_order);
  return {
    id: 'l13',
    title: `Agent & partner leaderboard - ${windowLabel(w)}`,
    info: info('l13'),
    columns: [
      { key: 'name', label: 'Name', width: 220, align: 'left' },
      { key: 'type', label: 'Type', width: 90, align: 'left' },
      { key: 'market', label: 'Market', width: 90, align: 'left' },
      { key: 'loans', label: 'Loans', width: 100, align: 'right' },
      { key: 'target', label: 'Quota', width: 100, align: 'right' },
      { key: 'att', label: 'Attainment %', width: 200, align: 'left' },
      { key: 'principal', label: 'Principal €', width: 120, align: 'right' },
      { key: 'delta', label: cmpName, width: 110, align: 'right' },
      { key: 'status', label: 'Status', width: 96, align: 'left' },
    ],
    rows: rows.map(({ a, s, att }) => {
      const ref = sel.cmp === 'BUD' ? s.target || null : prior ? (prior.get(a.agent_code)?.loans ?? null) : null;
      const d = cmpRow('countUp', cmpName, s.loans, ref);
      const status = attainmentStatus(att, cube.thresholds);
      return {
        key: a.agent_code,
        selected: false,
        action: { kind: 'drill', drill: { kind: 'agent', agent: a.agent_code } },
        secondary: null,
        cells: [
          { text: a.agent_name, tag: a.is_ramp_cohort ? 'Ramp' : undefined },
          { text: a.agent_type === 'AGENT' ? 'Agent' : 'Partner' },
          { text: a.market_code },
          { text: fmtCount(s.loans) },
          { text: fmtCount(s.target || null) },
          { text: fmtPct(att), bar: att },
          { text: fmtEur(s.principal) },
          { text: d.text, status: d.status },
          {
            text:
              status === 'neutral' ? 'n/a' : status === 'good' ? 'On target' : status === 'watch' ? 'Close' : 'Behind',
            status,
            chip: true,
          },
        ],
      };
    }),
    empty: rows.length === 0 ? 'No agent or partner loans in this window' : null,
    action: null,
    needsDetail: false,
  };
}
