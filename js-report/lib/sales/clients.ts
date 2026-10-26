import { CHANNEL_SHORT, INFO, MARKET_NAMES, SEGMENT_NAMES } from './copy.ts';
import type { DetailIndex } from './detail.ts';
import { cohortClients } from './detail.ts';
import { fmtCount, fmtDays, fmtEur0, fmtInt, fmtPct } from './format.ts';
import { CATEGORY_ROLES, kpi } from './loans.ts';
import { MARKETS } from './manifest.ts';
import type { Ctx } from './overview.ts';
import { quarterLabel, quarterMonths, trend } from './overview.ts';
import type { SalesSelection } from './types.ts';
import type { BandVM, ChartCard, TableCard } from './view-model.ts';
import { dateLabel, monthLabel, shift, windowLabel, windowOf } from './windows.ts';

// View 3 — Clients (layout-spec §3): acquisition and return.

/** 4-step bins over the shown values (design-tokens §7 heat matrix). */
export function bins(values: readonly (number | null)[]): (0 | 1 | 2 | 3 | null)[] {
  const v = values.filter((x): x is number => x !== null);
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  return values.map((x) =>
    x === null ? null : hi > lo ? (Math.min(3, Math.floor(((x - lo) / (hi - lo)) * 4)) as 0 | 1 | 2 | 3) : 0,
  );
}

export function clientsView(ctx: Ctx, sel: SalesSelection, ix: DetailIndex | null): BandVM {
  const { cube, m } = ctx;
  const mk = sel.market;
  const w = windowOf(sel.tv, sel.anchor);
  const py = shift(w, -12);
  const A = m.loans(w, mk);
  const P = m.refLoans(py, mk);
  const FN = m.funnel(w, mk, false);
  const FNP = m.refFunnel(py, mk, false);
  const r180 = m.repeat180(sel.anchor - 6, mk);
  const gap = m.median(sel.tv, sel.anchor, mk, 'median_days_between');

  const kpis = [
    kpi(
      'c1',
      'New clients',
      fmtCount(A.first),
      `${fmtPct(A.loans ? A.first / A.loans : null)} of loans`,
      'countUp',
      { actual: A.first, budget: cube.budget(w, mk, 'NEW_CLIENTS'), py: P?.first ?? null },
      sel.cmp,
      INFO.c1 ?? '',
    ),
    kpi(
      'c2',
      'Returning clients %',
      fmtPct(m.returning(sel.tv, sel.anchor, mk)),
      'of borrowers',
      'ratioUp',
      { actual: m.returning(sel.tv, sel.anchor, mk), py: m.refReturning(sel.tv, sel.anchor - 12, mk) },
      sel.cmp,
      INFO.c2 ?? '',
    ),
    kpi(
      'c3',
      'Repeat share (loans)',
      fmtPct(m.repeatShare(A)),
      'of loans',
      'ratioUp',
      { actual: m.repeatShare(A), py: m.repeatShare(P) },
      sel.cmp,
      INFO.c3 ?? '',
    ),
    kpi(
      'c4',
      'New-client approval rate',
      fmtPct(m.approval(FN)),
      'first-time applicants',
      'ratioUp',
      { actual: m.approval(FN), py: m.approval(FNP) },
      sel.cmp,
      INFO.c4 ?? '',
    ),
    kpi(
      'c5',
      '180-day repeat',
      fmtPct(r180),
      `cohort ${monthLabel(sel.anchor - 6)}`,
      'ratioUp',
      { actual: r180, py: null, ref: { label: 'vs prev. cohort', value: m.repeat180(sel.anchor - 7, mk) } },
      sel.cmp,
      INFO.c5 ?? '',
    ),
    kpi(
      'c6',
      'Days between loans',
      fmtDays(gap),
      'median gap',
      'neutralDays',
      { actual: gap, py: m.refMedian(sel.tv, sel.anchor - 12, mk, 'median_days_between') },
      sel.cmp,
      INFO.c6 ?? '',
    ),
  ];

  // C7 New clients by channel, 13 months (stacked), Budget total as a line
  const channels = cube.dims.channel;
  const t = trend(ctx, sel.anchor, () => null);
  const inData = (i: number) => i >= cube.first && i <= cube.closed;
  const perMonth = t.months.map((i) =>
    inData(i) ? cube.loansBy({ start: i, end: i }, mk, (r) => r.channel, { repeat: false }) : null,
  );
  const c7: ChartCard = {
    id: 'c7',
    title: 'New clients by channel, 13 months',
    info: INFO.c7 ?? '',
    open: null,
    legend: [
      ...channels.map((c, k) => ({
        label: CHANNEL_SHORT[c.channel_code] ?? c.channel_name,
        role: CATEGORY_ROLES[k] ?? 'c5',
      })),
      { label: 'Budget', role: 'budget' as const },
    ],
    chart: {
      kind: 'columns',
      x: t.x,
      months: t.months,
      unit: 'count',
      stacks: channels.map((c, k) => ({
        name: CHANNEL_SHORT[c.channel_code] ?? c.channel_name,
        role: CATEGORY_ROLES[k] ?? 'c5',
        values: perMonth.map((p) => (p ? (p.get(c.channel_code)?.loans ?? 0) : null)),
      })),
      ghost: null,
      line: {
        name: 'Budget',
        role: 'budget',
        values: t.months.map((i) => (inData(i) ? cube.budget({ start: i, end: i }, mk, 'NEW_CLIENTS') : null)),
      },
      selected: 12,
      labels: null,
      percent: false,
    },
  };

  // C8 New-client funnel
  const steps = [
    ['Leads', FN.leads, null],
    ['First application', FN.submitted, FN.leads],
    ['First approval', FN.approved, FN.submitted],
    ['First loan', FN.disbursed, FN.approved],
  ] as const;
  const c8: ChartCard = {
    id: 'c8',
    title: 'New-client funnel',
    info: INFO.c8 ?? '',
    open: null,
    legend: [
      { label: 'First-time applicants', role: 'actual' },
      { label: 'Lost at the step', role: 'c3' },
    ],
    chart: {
      kind: 'funnel',
      rows: steps.map(([label, v, prev]) => ({
        label,
        value: v,
        text: fmtCount(v),
        sub: prev === null ? windowLabel(w) : `${fmtPct(prev > 0 ? v / prev : null)} of previous`,
        lost: prev === null ? null : prev - v,
      })),
    },
  };

  // C9 Cohort repeat curves, last four quarter cohorts
  const cohorts = [0, 1, 2, 3].map((k) => quarterMonths(sel.anchor, k));
  const c9: ChartCard = {
    id: 'c9',
    title: 'Cohort repeat curves (quarter cohorts)',
    info: INFO.c9 ?? '',
    open: null,
    legend: cohorts.map((c, k) => ({ label: quarterLabel(c[0] ?? sel.anchor), role: CATEGORY_ROLES[k] ?? 'c4' })),
    chart: {
      kind: 'line',
      x: cube.cohortDays.map((d) => (d % 30 === 0 ? `${d} d` : '')),
      months: null,
      unit: 'pct',
      series: cohorts.map((c, k) => ({
        name: quarterLabel(c[0] ?? sel.anchor),
        role: CATEGORY_ROLES[k] ?? 'c4',
        values: m.cohortCurve(c, mk),
      })),
      selected: null,
      callout: null,
      zeroBased: true,
    },
  };

  // C10 Returning % by market × segment, repeat share by product
  const segments = ['CONSUMER', 'MICRO_BUSINESS'];
  const shownMarkets = mk === 'ALL' ? MARKETS : [mk];
  const cells = shownMarkets.map((c) => segments.map((s) => m.returning(sel.tv, sel.anchor, c, s)));
  const flatBins = bins(cells.flat());
  const products = cube.dims.product.filter((p) => p.product_line === 'Microloan');
  const avg = m.repeatShare(A);
  const c10: ChartCard = {
    id: 'c10',
    title: 'Returning % by market × segment - repeat share by product',
    info: INFO.c10 ?? '',
    open: null,
    legend: [
      { label: 'Repeat share of loans', role: 'actual' },
      { label: 'company average', role: 'budget' },
    ],
    chart: {
      kind: 'heat',
      cols: segments.map((s) => SEGMENT_NAMES[s] ?? s),
      rows: shownMarkets.map((c, i) => ({
        label: MARKET_NAMES[c],
        cells: segments.map((_, j) => ({
          text: fmtPct(cells[i]?.[j] ?? null),
          bin: flatBins[i * segments.length + j] ?? null,
        })),
      })),
      side: {
        title: 'Repeat share by product',
        unit: 'pct',
        rows: products.map((p) => {
          const s = m.repeatShare(m.loans(w, mk, { product: p.product_code }));
          return { label: p.product_name, value: s, ghost: null, tick: avg, text: fmtPct(s, 0) };
        }),
      },
    },
  };

  return { kpis, charts: [c7, c8, c9, c10], layout: 'halves', table: clientsTable(ctx, sel, ix) };
}

function clientsTable(ctx: Ctx, sel: SalesSelection, ix: DetailIndex | null): TableCard {
  const { cube } = ctx;
  const w = windowOf(sel.tv, sel.anchor);
  const list = ix ? cohortClients(ix, cube, w, sel.market, cube.caps.clientsPerCohortMarket) : [];
  return {
    id: 'c11',
    title: `Clients - ${windowLabel(w)} cohort - ${MARKET_NAMES[sel.market]}`,
    info: INFO.c11 ?? '',
    columns: [
      { key: 'id', label: 'Client id', width: 130, align: 'left' },
      { key: 'market', label: 'Market', width: 80, align: 'left' },
      { key: 'type', label: 'Type', width: 130, align: 'left' },
      { key: 'first', label: 'First loan', width: 110, align: 'left' },
      { key: 'product', label: 'First product', width: 110, align: 'left' },
      { key: 'channel', label: 'Channel', width: 100, align: 'left' },
      { key: 'loans', label: 'Loans to date', width: 110, align: 'right' },
      { key: 'ptd', label: 'Principal to date', width: 130, align: 'right' },
      { key: 'last', label: 'Last loan', width: 110, align: 'left' },
      { key: 'since', label: 'Days since', width: 90, align: 'right' },
      { key: 'status', label: 'Status', width: 110, align: 'left' },
    ],
    rows: list.map((s) => ({
      key: String(s.client.client_id),
      selected: false,
      action: { kind: 'drill', drill: { kind: 'client', client: s.client.client_id } },
      secondary: null,
      cells: [
        { text: `C-${s.client.client_id}` },
        { text: s.client.market },
        { text: SEGMENT_NAMES[s.client.segment] ?? s.client.segment },
        { text: dateLabel(s.client.first_loan_date) },
        {
          text:
            cube.dims.product.find((p) => p.product_code === s.client.first_product)?.product_name ??
            s.client.first_product,
        },
        { text: CHANNEL_SHORT[s.client.acquisition_channel] ?? s.client.acquisition_channel },
        { text: fmtInt(s.loans) },
        { text: fmtEur0(s.principalToDate) },
        { text: dateLabel(s.last.disbursed) },
        { text: fmtInt(s.daysSince) },
        {
          text: s.status,
          status:
            s.last.status === 'CURRENT' || s.last.status === 'REPAID'
              ? 'good'
              : s.last.status === 'DPD_1_29'
                ? 'watch'
                : 'off',
          chip: true,
        },
      ],
    })),
    note: ix
      ? list.length
        ? `Top ${list.length} by principal to date (draft sample) - states at ${monthLabel(cube.closed)}`
        : 'No first loans in this window'
      : 'Loading the client sample…',
    action: null,
    needsDetail: true,
  };
}
