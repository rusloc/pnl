import { bins } from './clients.ts';
import { CHANNEL_SHORT, INFO, MARKET_NAMES } from './copy.ts';
import type { DetailIndex } from './detail.ts';
import { STATUS_SHORT, overdueLoans } from './detail.ts';
import { fmtEur0, fmtInt, fmtPct } from './format.ts';
import { kpi } from './loans.ts';
import { MARKETS } from './manifest.ts';
import type { Ctx } from './overview.ts';
import { quarterLabel, quarterMonths, storyCallout, trend } from './overview.ts';
import type { MarketSel, SalesSelection } from './types.ts';
import type { BandVM, ChartCard, TableCard } from './view-model.ts';
import { axisLabel, dateLabel, monthLabel, shift, trailing13, windowOf } from './windows.ts';

// View 4 — Portfolio quality (layout-spec §4): period-end metrics at the anchor month (fact_loan_month snapshot).

const BUCKETS = [
  ['1–29', 'b1_29', 'c4'],
  ['30–59', 'b30_59', 'c3'],
  ['60–89', 'b60_89', 'c2'],
  ['90+', 'b90p', 'c1'],
] as const;

export function portfolioView(ctx: Ctx, sel: SalesSelection, ix: DetailIndex | null): BandVM {
  const { cube, m } = ctx;
  const mk = sel.market;
  const a = sel.anchor;
  const w = windowOf(sel.tv, a);
  const S = m.snap(a, mk);
  const SP = m.snap(a - 12, mk);
  const cor = m.costOfRisk(w, mk);

  const kpis = [
    kpi(
      'p1',
      '30+ DPD %',
      fmtPct(m.dpd30(S)),
      `by balance - ${monthLabel(a)}`,
      'riskDown',
      { actual: m.dpd30(S), budget: cube.budgetDpd30(a, mk), py: m.dpd30(SP) },
      sel.cmp,
      INFO.p1 ?? '',
    ),
    kpi(
      'p2',
      '90+ DPD %',
      fmtPct(m.dpd90(S)),
      'by balance',
      'riskDown',
      { actual: m.dpd90(S), py: m.dpd90(SP) },
      sel.cmp,
      INFO.p2 ?? '',
    ),
    kpi(
      'p3',
      '30+ by count',
      fmtPct(m.dpd30Count(S)),
      'of active loans',
      'riskDown',
      { actual: m.dpd30Count(S), py: m.dpd30Count(SP) },
      sel.cmp,
      INFO.p3 ?? '',
    ),
    kpi(
      'p4',
      'Vintage 6m bad rate',
      fmtPct(m.vintageBad6(a - 6, mk)),
      `vintage ${monthLabel(a - 6)}`,
      'riskDown',
      { actual: m.vintageBad6(a - 6, mk), py: null, ref: { label: 'vs PY vintage', value: m.vintageBad6(a - 18, mk) } },
      sel.cmp,
      INFO.p4 ?? '',
    ),
    kpi(
      'p5',
      'Roll rate 30→60',
      fmtPct(m.roll3060(a, mk)),
      'balance rolling one bucket',
      'riskDown',
      { actual: m.roll3060(a, mk), py: m.roll3060(a - 12, mk) },
      sel.cmp,
      INFO.p5 ?? '',
    ),
    kpi(
      'p6',
      'Cost of risk',
      fmtPct(cor),
      'annualised',
      'riskDown',
      { actual: cor, py: cube.available(shift(w, -12)) ? m.costOfRisk(shift(w, -12), mk) : null },
      sel.cmp,
      INFO.p6 ?? '',
    ),
  ];

  // P7 DPD buckets, 13 months
  const months = trailing13(a);
  const snaps = months.map((i) => m.snap(i, mk));
  const p7: ChartCard = {
    id: 'p7',
    title: 'DPD buckets, 13 months',
    info: INFO.p7 ?? '',
    open: null,
    legend: BUCKETS.map(([label, , role]) => ({ label, role })),
    chart: {
      kind: 'columns',
      x: months.map(axisLabel),
      months,
      unit: 'eur',
      stacks: BUCKETS.map(([label, key, role]) => ({
        name: label,
        role,
        values: snaps.map((s) => (s ? s[key] : null)),
      })),
      ghost: null,
      line: null,
      selected: 12,
      labels: null,
      percent: false,
    },
  };

  // P8 Vintage curves, last four vintage quarters
  const vintages = [0, 1, 2, 3].map((k) => quarterMonths(a, k));
  const roles = ['c1', 'c2', 'c3', 'c4'] as const;
  const p8: ChartCard = {
    id: 'p8',
    title: 'Vintage curves',
    info: INFO.p8 ?? '',
    open: null,
    legend: vintages.map((v, k) => ({ label: quarterLabel(v[0] ?? a), role: roles[k] ?? 'c4' })),
    chart: {
      kind: 'line',
      x: Array.from({ length: 13 }, (_, k) => (k % 3 === 0 ? `${k} m` : '')),
      months: null,
      unit: 'pct',
      series: vintages.map((v, k) => ({
        name: quarterLabel(v[0] ?? a),
        role: roles[k] ?? 'c4',
        values: m.vintageCurve(v, mk),
      })),
      selected: null,
      callout: null,
      zeroBased: true,
    },
  };

  // P9 Bad rate (30+ DPD by balance) by product × market
  const products = cube.dims.product.filter((p) => p.product_line === 'Microloan');
  const cell = cube.snapshotBy(a, 'ALL', (r) => `${r.product}|${r.market}`);
  const shownMarkets: MarketSel[] = mk === 'ALL' ? [...MARKETS] : [mk];
  const values = products.map((p) => shownMarkets.map((c) => m.dpd30(cell?.get(`${p.product_code}|${c}`) ?? null)));
  const flat = bins(values.flat());
  const p9: ChartCard = {
    id: 'p9',
    title: 'Bad rate by product × market',
    info: INFO.p9 ?? '',
    open: null,
    legend: [],
    chart: {
      kind: 'heat',
      cols: shownMarkets.map((c) => MARKET_NAMES[c]),
      rows: products.map((p, i) => ({
        label: p.product_name,
        cells: shownMarkets.map((_, j) => ({
          text: fmtPct(values[i]?.[j] ?? null),
          bin: flat[i * shownMarkets.length + j] ?? null,
        })),
      })),
      side: null,
    },
  };

  // P10 30+ DPD by market
  const p10: ChartCard = {
    id: 'p10',
    title: '30+ DPD by market',
    info: INFO.p10 ?? '',
    open: null,
    legend: MARKETS.map((c, k) => ({ label: MARKET_NAMES[c], role: k === 0 ? 'c1' : k === 1 ? 'c2' : 'py' })),
    chart: {
      kind: 'line',
      x: months.map(axisLabel),
      months,
      unit: 'pct',
      series: MARKETS.map((c, k) => ({
        name: MARKET_NAMES[c],
        role: k === 0 ? 'c1' : k === 1 ? 'c2' : 'py',
        values: months.map((i) => m.dpd30At(i, c)),
      })),
      selected: null,
      callout: storyCallout('p10', months),
      zeroBased: false,
    },
  };

  // P11 Roll rates by month
  const t = trend(ctx, a, (i) => m.roll3060(i, mk));
  const p11: ChartCard = {
    id: 'p11',
    title: 'Roll rates by month',
    info: INFO.p11 ?? '',
    open: null,
    legend: [
      { label: '30 → 60', role: 'c1' },
      { label: '1–29 → 30+', role: 'c2' },
    ],
    chart: {
      kind: 'line',
      x: t.x,
      months: t.months,
      unit: 'pct',
      series: [
        { name: '30 → 60', role: 'c1', values: t.actual },
        {
          name: '1–29 → 30+',
          role: 'c2',
          values: t.months.map((i) => (i > cube.first && i <= cube.closed ? m.roll129(i, mk) : null)),
        },
      ],
      selected: null,
      callout: null,
      zeroBased: true,
    },
  };

  // P12 Segments: size × DPD (one bubble per product × market)
  const loansCell = cube.loansBy(w, 'ALL', (r) => `${r.product}|${r.market}`);
  const points = products
    .flatMap((p) =>
      shownMarkets.map((c) => {
        const key = `${p.product_code}|${c}`;
        const l = loansCell.get(key);
        const s = cell?.get(key) ?? null;
        return {
          label: `${p.product_name} ${c}`,
          x: l && l.loans > 0 ? l.principal / l.loans : 0,
          y: m.dpd30(s) ?? 0,
          size: s?.outstanding ?? 0,
          cls: (MARKETS.indexOf(c as (typeof MARKETS)[number]) % 3) as 0 | 1 | 2,
          highlight: false,
          showLabel: false,
        };
      }),
    )
    .filter((pt) => pt.size > 0);
  const worst = points.reduce((w0, pt) => (pt.y > (w0?.y ?? -1) ? pt : w0), points[0]);
  const top3 = [...points].sort((x, y) => y.size - x.size).slice(0, 3);
  for (const pt of points) {
    pt.highlight = pt === worst;
    pt.showLabel = top3.includes(pt) || pt === worst;
  }
  const p12: ChartCard = {
    id: 'p12',
    title: 'Segments: size × DPD',
    info: INFO.p12 ?? '',
    open: null,
    legend: [
      ...shownMarkets.map((c) => ({
        label: MARKET_NAMES[c],
        role: (['c4', 'c3', 'c1'] as const)[MARKETS.indexOf(c as (typeof MARKETS)[number])] ?? 'c1',
      })),
      { label: 'worst 30+ DPD', role: 'selected' as const },
    ],
    chart: { kind: 'bubble', xUnit: 'eur', yUnit: 'pct', points },
  };

  return { kpis, charts: [p7, p8, p9, p10, p11, p12], layout: 'thirds', table: overdueTable(ctx, sel, ix) };
}

function overdueTable(ctx: Ctx, sel: SalesSelection, ix: DetailIndex | null): TableCard {
  const { cube } = ctx;
  const list = ix ? overdueLoans(ix, sel.market, cube.caps.overduePerMarket) : [];
  const bucket = (dpd: number) => (dpd >= 90 ? '90+' : dpd >= 60 ? '60–89' : '30–59');
  return {
    id: 'p13',
    title: `Overdue loans - ${monthLabel(cube.closed)} - ${MARKET_NAMES[sel.market]}`,
    info: INFO.p13 ?? '',
    columns: [
      { key: 'loan', label: 'Loan id', width: 120, align: 'left' },
      { key: 'client', label: 'Client id', width: 120, align: 'left' },
      { key: 'market', label: 'Market', width: 70, align: 'left' },
      { key: 'product', label: 'Product', width: 100, align: 'left' },
      { key: 'channel', label: 'Channel', width: 90, align: 'left' },
      { key: 'disbursed', label: 'Disbursed', width: 110, align: 'left' },
      { key: 'principal', label: 'Principal', width: 100, align: 'right' },
      { key: 'outstanding', label: 'Outstanding', width: 110, align: 'right' },
      { key: 'dpd', label: 'DPD', width: 70, align: 'right' },
      { key: 'bucket', label: 'Bucket', width: 80, align: 'left' },
      { key: 'status', label: 'Status', width: 110, align: 'left' },
    ],
    rows: list.map((r) => ({
      key: String(r.loan_id),
      selected: false,
      action: { kind: 'drill', drill: { kind: 'client', client: r.client_id } },
      secondary: null,
      cells: [
        { text: `L-${r.loan_id}` },
        { text: `C-${r.client_id}` },
        { text: r.market },
        { text: cube.dims.product.find((p) => p.product_code === r.product)?.product_name ?? r.product },
        { text: CHANNEL_SHORT[r.channel] ?? r.channel },
        { text: dateLabel(r.disbursed) },
        { text: fmtEur0(ix?.eur(r) ?? null) },
        { text: fmtEur0(ix?.outstandingEur(r) ?? null) },
        { text: fmtInt(r.dpd_close) },
        { text: bucket(r.dpd_close) },
        { text: STATUS_SHORT[r.status] ?? r.status, status: r.dpd_close >= 90 ? 'off' : 'watch', chip: true },
      ],
    })),
    note: ix
      ? `Loan states are the ${monthLabel(cube.closed)} snapshot for every selected month - worst ${list.length} by DPD (draft sample)`
      : 'Loading the loan sample…',
    action: null,
    needsDetail: true,
  };
}
