import { CHANNEL_SHORT, INFO, MARKET_NAMES, STREAM_NAMES } from './copy.ts';
import { fmtCount, fmtDeltaPct, fmtEur, fmtPct } from './format.ts';
import { CATEGORY_ROLES, kpi } from './loans.ts';
import { MARKETS } from './manifest.ts';
import type { Ctx } from './overview.ts';
import { storyCallout, trend } from './overview.ts';
import { STATUS_WORD, attainmentStatus, cmpRow } from './status.ts';
import type { MarketSel, SalesSelection } from './types.ts';
import type { BandVM, ChartCard, KpiCard, TableCard, TableRow } from './view-model.ts';
import { shift, windowLabel, windowOf } from './windows.ts';
import type { Window } from './windows.ts';

// View 5 — Revenue & targets (layout-spec §5). Budget REVENUE_LOCAL is set per product: loan products carry interest +
// fees together, CARD = interchange, PLUS + PRO = subscriptions. Interest and fees alone have no Budget.

const STREAMS = ['INTEREST', 'FEE', 'INTERCHANGE', 'SUBSCRIPTION'] as const;
const PAYING = ['PLUS', 'PRO'] as const;

function streamBudget(ctx: Ctx, w: Window, mk: MarketSel, stream: string): number | null | undefined {
  if (stream === 'INTERCHANGE') return ctx.cube.budget(w, mk, 'REVENUE_LOCAL', ['CARD']);
  if (stream === 'SUBSCRIPTION') return ctx.cube.budget(w, mk, 'REVENUE_LOCAL', PAYING);
  return undefined;
}

export function revenueView(ctx: Ctx, sel: SalesSelection): BandVM {
  const { cube, m } = ctx;
  const mk = sel.market;
  const a = sel.anchor;
  const w = windowOf(sel.tv, a);
  const py = shift(w, -12);
  const rev = m.revenue(w, mk);
  const revPy = m.refRevenue(py, mk);
  const bud = cube.budget(w, mk, 'REVENUE_LOCAL');
  const byStream = cube.revenueBy(w, mk, (r) => r.stream);
  const byStreamPy = cube.available(py) ? cube.revenueBy(py, mk, (r) => r.stream) : null;
  const subs = m.paying(a, mk);
  const subsPy = m.paying(a - 12, mk);
  const tiers = cube.subsBy(a, mk, (r) => r.tier);
  const att = bud ? rev / bud : null;
  const attRow = cmpRow('ratioUp', 'vs 100%', att, 1);

  const kpis: KpiCard[] = [
    kpi(
      'r1',
      'Revenue',
      fmtEur(rev),
      'interest + fees + interchange + subs',
      'countUp',
      { actual: rev, budget: bud, py: revPy },
      sel.cmp,
      INFO.r1 ?? '',
    ),
    {
      id: 'r2',
      label: 'Attainment',
      info: INFO.r2 ?? '',
      value: fmtPct(att),
      sub: `Budget ${fmtEur(bud)}`,
      row: { ...attRow, status: attainmentStatus(att, cube.thresholds) },
      alt: null,
    },
    kpi(
      'r3',
      'Interest income',
      fmtEur(byStream.get('INTEREST') ?? 0),
      `${fmtPct(rev ? (byStream.get('INTEREST') ?? 0) / rev : null, 0)} of revenue`,
      'countUp',
      { actual: byStream.get('INTEREST') ?? 0, py: byStreamPy?.get('INTEREST') ?? null },
      sel.cmp,
      INFO.r3 ?? '',
    ),
    kpi(
      'r4',
      'Fees',
      fmtEur(byStream.get('FEE') ?? 0),
      'origination + late fees',
      'countUp',
      { actual: byStream.get('FEE') ?? 0, py: byStreamPy?.get('FEE') ?? null },
      sel.cmp,
      INFO.r4 ?? '',
    ),
    kpi(
      'r5',
      'MRR',
      fmtEur(subs?.mrr ?? null),
      `Plus ${fmtEur(tiers?.get('PLUS')?.mrr ?? null)} - Pro ${fmtEur(tiers?.get('PRO')?.mrr ?? null)}`,
      'countUp',
      { actual: subs?.mrr ?? null, py: subsPy?.mrr ?? null },
      sel.cmp,
      INFO.r5 ?? '',
    ),
    kpi(
      'r6',
      'Paying subscribers',
      fmtCount(subs?.end ?? null),
      `Plus ${fmtCount(tiers?.get('PLUS')?.end ?? null)} - Pro ${fmtCount(tiers?.get('PRO')?.end ?? null)}`,
      'countUp',
      { actual: subs?.end ?? null, py: subsPy?.end ?? null },
      sel.cmp,
      INFO.r6 ?? '',
    ),
  ];

  const monthly = (i: number) => ({ start: i, end: i });
  const inData = (i: number) => i >= cube.first && i <= cube.closed;

  // R7 Revenue by month vs Budget vs PY
  const t = trend(ctx, a, (i) => m.revenue(monthly(i), mk));
  const r7: ChartCard = {
    id: 'r7',
    title: 'Revenue by month vs Budget vs PY',
    info: INFO.r7 ?? '',
    open: null,
    legend: [
      { label: 'Actual', role: 'actual' },
      { label: 'Budget', role: 'budget' },
      { label: 'Prior year', role: 'py' },
    ],
    chart: {
      kind: 'line',
      x: t.x,
      months: t.months,
      unit: 'eur',
      series: [
        { name: 'Actual', role: 'actual', values: t.actual },
        {
          name: 'Budget',
          role: 'budget',
          values: t.months.map((i) => (inData(i) ? cube.budget(monthly(i), mk, 'REVENUE_LOCAL') : null)),
        },
        { name: 'Prior year', role: 'py', values: t.py },
      ],
      selected: 12,
      callout: null,
      zeroBased: false,
    },
  };

  // R8 Revenue by stream, 13 months
  const perMonth = t.months.map((i) => (inData(i) ? cube.revenueBy(monthly(i), mk, (r) => r.stream) : null));
  const r8: ChartCard = {
    id: 'r8',
    title: 'Revenue by stream, 13 months',
    info: INFO.r8 ?? '',
    open: null,
    legend: STREAMS.map((s, k) => ({ label: STREAM_NAMES[s] ?? s, role: CATEGORY_ROLES[k] ?? 'c4' })),
    chart: {
      kind: 'columns',
      x: t.x,
      months: t.months,
      unit: 'eur',
      stacks: STREAMS.map((s, k) => ({
        name: STREAM_NAMES[s] ?? s,
        role: CATEGORY_ROLES[k] ?? 'c4',
        values: perMonth.map((p) => (p ? (p.get(s) ?? 0) : null)),
      })),
      ghost: null,
      line: null,
      selected: 12,
      labels: null,
      percent: false,
    },
  };

  // R9 Attainment by market
  const shownMarkets: MarketSel[] = mk === 'ALL' ? [...MARKETS] : [mk];
  const r9: ChartCard = {
    id: 'r9',
    title: 'Attainment by market',
    info: INFO.r9 ?? '',
    open: null,
    legend: [
      { label: 'Revenue', role: 'actual' },
      { label: 'Budget', role: 'budget' },
    ],
    chart: {
      kind: 'bullets',
      unit: 'eur',
      rows: shownMarkets.map((c) => {
        const v = m.revenue(w, c);
        const b = cube.budget(w, c, 'REVENUE_LOCAL') ?? 0;
        const r = b > 0 ? v / b : null;
        const st = attainmentStatus(r, cube.thresholds);
        return { label: MARKET_NAMES[c], value: v, target: b, text: `${fmtPct(r)} - ${STATUS_WORD[st]}`, status: st };
      }),
    },
  };

  // R10 MRR and subscribers by tier
  const subsMonths = t.months.map((i) => (inData(i) ? cube.subsBy(i, mk, (r) => r.tier) : null));
  const r10: ChartCard = {
    id: 'r10',
    title: 'MRR and subscribers by tier',
    info: INFO.r10 ?? '',
    open: null,
    legend: [
      { label: 'Plus', role: 'c1' },
      { label: 'Pro', role: 'c2' },
    ],
    chart: {
      kind: 'columns',
      x: t.x,
      months: t.months,
      unit: 'count',
      stacks: PAYING.map((tier, k) => ({
        name: tier === 'PLUS' ? 'Plus' : 'Pro',
        role: k === 0 ? 'c1' : 'c2',
        values: subsMonths.map((s) => (s ? (s.get(tier)?.end ?? 0) : null)),
      })),
      ghost: null,
      line: null,
      selected: 12,
      labels: subsMonths.map((s, k) =>
        s && k % 2 === 0 ? fmtEur(PAYING.reduce((sum, tier) => sum + (s.get(tier)?.mrr ?? 0), 0)) : null,
      ),
      percent: false,
    },
  };

  // R11 Subscriber churn % (paying tiers)
  const churn = (i: number) => {
    const s = m.paying(i, mk);
    return s && s.start > 0 ? s.churned / s.start : null;
  };
  const tc = trend(ctx, a, churn);
  const r11: ChartCard = {
    id: 'r11',
    title: 'Subscriber churn %',
    info: INFO.r11 ?? '',
    open: null,
    legend: [
      { label: 'Actual', role: 'actual' },
      { label: 'Prior year', role: 'py' },
    ],
    chart: {
      kind: 'line',
      x: tc.x,
      months: tc.months,
      unit: 'pct',
      series: [
        { name: 'Actual', role: 'actual', values: tc.actual },
        { name: 'Prior year', role: 'py', values: tc.py },
      ],
      selected: 12,
      callout: storyCallout('r11', tc.months),
      zeroBased: true,
    },
  };

  // R12 Channel mix, share of loans
  const loanMonths = t.months.map((i) => (inData(i) ? cube.loansBy(monthly(i), mk, (r) => r.channel) : null));
  const r12: ChartCard = {
    id: 'r12',
    title: 'Channel mix, share of loans',
    info: INFO.r12 ?? '',
    open: null,
    legend: cube.dims.channel.map((c, k) => ({
      label: CHANNEL_SHORT[c.channel_code] ?? c.channel_name,
      role: CATEGORY_ROLES[k] ?? 'c5',
    })),
    chart: {
      kind: 'columns',
      x: t.x,
      months: t.months,
      unit: 'pct',
      stacks: cube.dims.channel.map((c, k) => ({
        name: CHANNEL_SHORT[c.channel_code] ?? c.channel_name,
        role: CATEGORY_ROLES[k] ?? 'c5',
        values: loanMonths.map((p) => {
          if (!p) return null;
          const total = [...p.values()].reduce((s, v) => s + v.loans, 0);
          return total > 0 ? (p.get(c.channel_code)?.loans ?? 0) / total : null;
        }),
      })),
      ghost: null,
      line: null,
      selected: 12,
      labels: null,
      percent: true,
    },
  };

  return { kpis, charts: [r7, r8, r9, r10, r11, r12], layout: 'thirds', table: streamTable(ctx, sel) };
}

function streamTable(ctx: Ctx, sel: SalesSelection): TableCard {
  const { cube, m } = ctx;
  const w = windowOf(sel.tv, sel.anchor);
  const py = shift(w, -12);
  const pyOk = cube.available(py);
  const shownMarkets: MarketSel[] = sel.market === 'ALL' ? [...MARKETS] : [sel.market];
  const rows: TableRow[] = [];
  const line = (
    key: string,
    stream: string,
    market: MarketSel,
    actual: number,
    budget: number | null | undefined,
    prior: number | null,
  ): TableRow => {
    const st = cmpRow('countUp', '', actual, sel.cmp === 'BUD' ? (budget ?? null) : prior);
    return {
      key,
      selected: false,
      action: { kind: 'drill', drill: { kind: 'loans', market } },
      secondary: null,
      cells: [
        { text: stream },
        { text: market === 'ALL' ? 'All' : market },
        { text: fmtEur(actual) },
        { text: budget === undefined ? 'n/a' : fmtEur(budget) },
        { text: budget ? fmtEur(actual - budget) : 'n/a' },
        { text: budget ? fmtDeltaPct(actual / budget - 1) : 'n/a' },
        { text: fmtEur(prior) },
        { text: prior ? fmtDeltaPct(actual / prior - 1) : 'n/a' },
        {
          text: st.status === 'neutral' ? 'n/a' : `${st.text.slice(0, 1)} ${STATUS_WORD[st.status]}`,
          status: st.status,
          chip: true,
        },
      ],
    };
  };
  for (const c of shownMarkets) {
    const now = cube.revenueBy(w, c, (r) => r.stream);
    const before = pyOk ? cube.revenueBy(py, c, (r) => r.stream) : null;
    for (const s of STREAMS)
      rows.push(
        line(
          `${s}|${c}`,
          STREAM_NAMES[s] ?? s,
          c,
          now.get(s) ?? 0,
          streamBudget(ctx, w, c, s),
          before ? (before.get(s) ?? 0) : null,
        ),
      );
  }
  rows.push(
    line(
      'TOTAL',
      'Total',
      sel.market,
      m.revenue(w, sel.market),
      cube.budget(w, sel.market, 'REVENUE_LOCAL'),
      m.refRevenue(py, sel.market),
    ),
  );
  return {
    id: 'r13',
    title: `Stream × market - ${windowLabel(w)}`,
    info: INFO.r13 ?? '',
    columns: [
      { key: 'stream', label: 'Stream', width: 160, align: 'left' },
      { key: 'market', label: 'Market', width: 100, align: 'left' },
      { key: 'actual', label: 'Actual €', width: 120, align: 'right' },
      { key: 'budget', label: 'Budget €', width: 120, align: 'right' },
      { key: 'd', label: 'Δ €', width: 110, align: 'right' },
      { key: 'dp', label: 'Δ %', width: 90, align: 'right' },
      { key: 'py', label: 'PY €', width: 120, align: 'right' },
      { key: 'dpy', label: 'Δ vs PY %', width: 100, align: 'right' },
      { key: 'status', label: 'Status', width: 96, align: 'left' },
    ],
    rows,
    note: 'Budget is set per product: interest and fees share the loan-product Budget, so their rows show n/a. Row click lists the market’s loans.',
    action: null,
    needsDetail: false,
  };
}
