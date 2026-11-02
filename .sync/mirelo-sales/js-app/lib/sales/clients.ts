import { CHANNEL_SHORT, MARKET_NAMES, info } from './copy.ts';
import { fmtCount, fmtDays, fmtEur0, fmtPct } from './format.ts';
import { CATEGORY_ROLES, kpi } from './loans.ts';
import type { Ctx } from './overview.ts';
import { quarterLabel, quarterMonths, trend } from './overview.ts';
import { STATUS_WORD, cmpRow } from './status.ts';
import type { SalesSelection } from './types.ts';
import type { BandVM, ChartCard, TableCard } from './view-model.ts';
import { shift, periodWindow, windowLabel } from './windows.ts';

// View 3 — Clients (layout-spec §3): acquisition and return.

/**
 * Heat level 0 … 1 of each cell over every shown cell, all rows and columns together (2026-11-01, owner: one gradient
 * for the whole grid, grey → yellow → orange → red; it was four grey steps). Blank cells stay null.
 */
export function heatLevels(values: readonly (number | null)[]): (number | null)[] {
  const v = values.filter((x): x is number => x !== null);
  const lo = Math.min(...v);
  const hi = Math.max(...v);
  return values.map((x) => (x === null ? null : hi > lo ? (x - lo) / (hi - lo) : 0));
}

export function clientsView(ctx: Ctx, sel: SalesSelection): BandVM {
  const { cube, m } = ctx;
  const mk = sel.market;
  const w = periodWindow(sel);
  const py = shift(w, -12);
  const A = m.loans(w, mk);
  const P = m.refLoans(py, mk);
  const FN = m.funnel(w, mk, false);
  const FNP = m.refFunnel(py, mk, false);
  const FR = m.funnel(w, mk, true);
  const FRP = m.refFunnel(py, mk, true);
  const gap = m.median(w, mk, 'median_days_between');

  const ret = m.returning(w, mk);
  const stat = m.stat(w, mk);
  const gapPy = m.refMedian(py, mk, 'median_days_between');
  const kpis = [
    kpi(
      'c1',
      'New clients',
      fmtCount(A.first),
      [
        { label: 'Share of loans', value: fmtPct(A.loans ? A.first / A.loans : null) },
        { label: 'Budget', value: fmtCount(cube.budget(w, mk, 'NEW_CLIENTS')) },
        { label: 'Prior year', value: fmtCount(P?.first ?? null) },
      ],
      'countUp',
      { actual: A.first, budget: cube.budget(w, mk, 'NEW_CLIENTS'), py: P?.first ?? null },
      sel.cmp,
    ),
    kpi(
      'c2',
      'Returning clients %',
      fmtPct(ret),
      [
        { label: 'Borrowers', value: fmtCount(stat?.borrowers ?? null) },
        { label: 'Returning borrowers', value: fmtCount(stat?.returning ?? null) },
      ],
      'ratioUp',
      { actual: ret, py: m.refReturning(py, mk) },
      sel.cmp,
    ),
    kpi(
      'c3',
      'Repeat share (loans)',
      fmtPct(m.repeatShare(A)),
      [
        { label: 'Repeat loans', value: fmtCount(A.repeat) },
        { label: 'Loans', value: fmtCount(A.loans) },
      ],
      'ratioUp',
      { actual: m.repeatShare(A), py: m.repeatShare(P) },
      sel.cmp,
    ),
    kpi(
      'c4',
      'New-client approval rate',
      fmtPct(m.approval(FN)),
      [
        { label: 'First-time submitted', value: fmtCount(FN.submitted) },
        { label: 'First-time approved', value: fmtCount(FN.approved) },
      ],
      'ratioUp',
      { actual: m.approval(FN), py: m.approval(FNP) },
      sel.cmp,
    ),
    // C5 approval rate of returning applicants (2026-11-01, owner: replaces the 180-day repeat, which the C9 heatmap
    // already shows by cohort)
    kpi(
      'c5',
      'Returning-client approval rate',
      fmtPct(m.approval(FR)),
      [
        { label: 'Returning submitted', value: fmtCount(FR.submitted) },
        { label: 'Returning approved', value: fmtCount(FR.approved) },
        { label: 'New-client approval rate', value: fmtPct(m.approval(FN)) },
      ],
      'ratioUp',
      { actual: m.approval(FR), py: m.approval(FRP) },
      sel.cmp,
    ),
    kpi(
      'c6',
      'Days between loans',
      fmtDays(gap),
      [{ label: 'Prior year', value: fmtDays(gapPy) }],
      'neutralDays',
      { actual: gap, py: gapPy },
      sel.cmp,
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
    info: info('c7'),
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

  // C8 New-client funnel: every step as % of Leads, step 1 (owner, 2026-11-01); no "lost at the step" bars
  const steps = [
    ['Leads', FN.leads],
    ['First application', FN.submitted],
    ['First approval', FN.approved],
    ['First loan', FN.disbursed],
  ] as const;
  const c8: ChartCard = {
    id: 'c8',
    title: 'New-client funnel',
    info: info('c8'),
    open: null,
    legend: [{ label: 'First-time applicants', role: 'actual' }],
    chart: {
      kind: 'funnel',
      rows: steps.map(([label, v], i) => ({
        label,
        value: v,
        text: fmtCount(v),
        sub: i === 0 ? windowLabel(w) : `${fmtPct(FN.leads > 0 ? v / FN.leads : null)} of leads`,
        lost: null,
      })),
    },
  };

  // C9 Cohort repeat heatmap (2026-11-01, owner: the four curves sat on top of each other): the last four quarter
  // cohorts, oldest on top, × days since the first loan; a cohort not yet that old stays blank. The leading days where
  // no cohort has a second loan yet (the first loan is still running) are dropped.
  const cohorts = [3, 2, 1, 0].map((k) => quarterMonths(sel.anchor, k));
  const curves = cohorts.map((c) => m.cohortCurve(c, mk));
  const from = cube.cohortDays.findIndex((_, k) => curves.some((v) => (v[k] ?? 0) > 0));
  const days = cube.cohortDays.flatMap((d, k) => (k >= Math.max(from, 1) ? [{ d, k }] : []));
  const grid = curves.map((curve) => days.map(({ k }) => curve[k] ?? null));
  const cohortLevels = heatLevels(grid.flat());
  const c9: ChartCard = {
    id: 'c9',
    title: 'Cohort repeat by quarter cohort',
    info: info('c9'),
    open: null,
    legend: [],
    chart: {
      kind: 'heat',
      cols: days.map(({ d }) => `${d} d`),
      rows: cohorts.map((c, i) => ({
        label: quarterLabel(c[0] ?? sel.anchor),
        cells: days.map((_, j) => {
          const v = grid[i]?.[j] ?? null;
          return {
            text: v === null ? '' : fmtPct(v, 0),
            level: cohortLevels[i * days.length + j] ?? null,
          };
        }),
      })),
      side: null,
    },
  };

  // C10 Repeat share by product (2026-11-01, owner: the market × segment matrix is gone)
  const products = cube.dims.product.filter((p) => p.product_line === 'Microloan');
  const avg = m.repeatShare(A);
  const c10: ChartCard = {
    id: 'c10',
    title: 'Repeat share by product',
    info: info('c10'),
    open: null,
    legend: [
      { label: 'Repeat share of loans', role: 'actual' },
      { label: 'company average', role: 'budget' },
    ],
    chart: {
      kind: 'bars',
      unit: 'pct',
      rows: products.map((p) => {
        const s = m.repeatShare(m.loans(w, mk, { product: p.product_code }));
        return {
          label: p.product_name,
          value: s,
          ghost: null,
          tick: avg,
          text: fmtPct(s, 0),
        };
      }),
    },
  };

  return {
    kpis,
    charts: [c7, c8, c9, c10],
    layout: 'halves',
    table: acquisitionTable(ctx, sel),
  };
}

/**
 * C11 Acquisition by channel (2026-11-01, owner: replaces the client list, which moved into the detail window): one row
 * per acquisition channel. Budget exists per market × product only, so the Δ is always vs the prior year.
 */
function acquisitionTable(ctx: Ctx, sel: SalesSelection): TableCard {
  const { cube, m } = ctx;
  const mk = sel.market;
  const w = periodWindow(sel);
  const py = shift(w, -12);
  const byChannel = (r: { channel: string }) => r.channel;
  const all = cube.loansBy(w, mk, byChannel);
  const first = cube.loansBy(w, mk, byChannel, { repeat: false });
  const firstPy = cube.available(py) ? cube.loansBy(py, mk, byChannel, { repeat: false }) : null;
  const fNew = cube.funnelBy(w, mk, byChannel, false);
  const fRet = cube.funnelBy(w, mk, byChannel, true);
  const totalNew = m.loans(w, mk).first;
  return {
    id: 'c11',
    title: `Acquisition by channel - ${windowLabel(w)} - ${MARKET_NAMES[mk]}`,
    info: info('c11'),
    columns: [
      { key: 'channel', label: 'Channel', width: 150, align: 'left' },
      { key: 'new', label: 'New clients', width: 120, align: 'right' },
      { key: 'delta', label: 'vs PY', width: 110, align: 'right' },
      { key: 'share', label: 'Share of new', width: 120, align: 'right' },
      { key: 'conv', label: 'Lead → first loan', width: 140, align: 'right' },
      { key: 'apprN', label: 'New approval %', width: 140, align: 'right' },
      {
        key: 'apprR',
        label: 'Returning approval %',
        width: 170,
        align: 'right',
      },
      { key: 'repeat', label: 'Repeat share', width: 120, align: 'right' },
      { key: 'ticket', label: 'First ticket €', width: 120, align: 'right' },
      { key: 'status', label: 'Status', width: 96, align: 'left' },
    ],
    rows: cube.dims.channel.map((c) => {
      const code = c.channel_code;
      const n = first.get(code)?.first ?? 0;
      const ref = firstPy ? (firstPy.get(code)?.first ?? 0) : null;
      const d = cmpRow('countUp', 'vs PY', n, ref);
      const fn = fNew.get(code) ?? null;
      const f1 = first.get(code);
      return {
        key: code,
        selected: false,
        action: {
          kind: 'drill',
          drill: { kind: 'clients', market: mk, channel: code },
        },
        secondary: null,
        cells: [
          { text: CHANNEL_SHORT[code] ?? c.channel_name },
          { text: fmtCount(n) },
          { text: d.text, status: d.status },
          { text: fmtPct(totalNew > 0 ? n / totalNew : null) },
          { text: fmtPct(fn && fn.leads > 0 ? fn.disbursed / fn.leads : null) },
          { text: fmtPct(m.approval(fn)) },
          { text: fmtPct(m.approval(fRet.get(code) ?? null)) },
          { text: fmtPct(m.repeatShare(all.get(code) ?? null)) },
          {
            text: fmtEur0(f1 && f1.loans > 0 ? f1.principal / f1.loans : null),
          },
          {
            text: d.status === 'neutral' ? STATUS_WORD.neutral : `${d.text.slice(0, 1)} ${STATUS_WORD[d.status]}`,
            status: d.status,
            chip: true,
          },
        ],
      };
    }),
    empty: null,
    action: {
      label: 'Show clients',
      drill: { kind: 'clients', market: mk, channel: null },
    },
    needsDetail: false,
  };
}
