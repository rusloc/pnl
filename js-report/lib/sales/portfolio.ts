import { heatLevels } from './clients.ts';
import { MARKET_NAMES, info } from './copy.ts';
import { fmtCount, fmtEur, fmtPct } from './format.ts';
import { kpi } from './loans.ts';
import { MARKETS } from './manifest.ts';
import type { Ctx } from './overview.ts';
import { quarterLabel, quarterMonths, storyCallout, trend } from './overview.ts';
import { STATUS_WORD, cmpRow } from './status.ts';
import type { MarketSel, SalesSelection } from './types.ts';
import type { BandVM, ChartCard, TableCard } from './view-model.ts';
import { axisLabel, monthLabel, shift, trailing13, periodWindow } from './windows.ts';

// View 4 — Portfolio quality (layout-spec §4): period-end metrics at the anchor month (fact_loan_month snapshot).

const BUCKETS = [
  ['1–29', 'b1_29', 'c4'],
  ['30–59', 'b30_59', 'c3'],
  ['60–89', 'b60_89', 'c2'],
  ['90+', 'b90p', 'c1'],
] as const;

export function portfolioView(ctx: Ctx, sel: SalesSelection): BandVM {
  const { cube, m } = ctx;
  const mk = sel.market;
  const a = sel.anchor;
  const w = periodWindow(sel);
  const S = m.snap(a, mk);
  const SP = m.snap(a - 12, mk);
  const cor = m.costOfRisk(w, mk);

  const eur = (v: number | undefined) => fmtEur(v ?? null);
  const kpis = [
    kpi(
      'p1',
      '30+ DPD %',
      fmtPct(m.dpd30(S)),
      [
        { label: 'Month-end', value: monthLabel(a) },
        { label: '30+ DPD balance', value: eur(S ? S.b30_59 + S.b60_89 + S.b90p : undefined) },
        { label: 'Outstanding', value: eur(S?.outstanding) },
        { label: 'Planned (Budget)', value: fmtPct(cube.budgetDpd30(a, mk)) },
      ],
      'riskDown',
      { actual: m.dpd30(S), budget: cube.budgetDpd30(a, mk), py: m.dpd30(SP) },
      sel.cmp,
    ),
    kpi(
      'p2',
      '90+ DPD %',
      fmtPct(m.dpd90(S)),
      [{ label: '90+ DPD balance', value: eur(S?.b90p) }],
      'riskDown',
      { actual: m.dpd90(S), py: m.dpd90(SP) },
      sel.cmp,
    ),
    kpi(
      'p3',
      '30+ by count',
      fmtPct(m.dpd30Count(S)),
      [
        { label: 'Loans 30+ DPD', value: fmtCount(S?.dpd30Count ?? null) },
        { label: 'Active loans', value: fmtCount(S?.active ?? null) },
      ],
      'riskDown',
      { actual: m.dpd30Count(S), py: m.dpd30Count(SP) },
      sel.cmp,
    ),
    kpi(
      'p4',
      'Vintage 6m bad rate',
      fmtPct(m.vintageBad6(a - 6, mk)),
      [
        { label: 'Vintage', value: monthLabel(a - 6) },
        { label: 'Same vintage a year earlier', value: fmtPct(m.vintageBad6(a - 18, mk)) },
      ],
      'riskDown',
      { actual: m.vintageBad6(a - 6, mk), py: null, ref: { label: 'vs PY vintage', value: m.vintageBad6(a - 18, mk) } },
      sel.cmp,
    ),
    kpi(
      'p5',
      'Roll rate 30→60',
      fmtPct(m.roll3060(a, mk)),
      [{ label: '1–29 → 30+', value: fmtPct(m.roll129(a, mk)) }],
      'riskDown',
      { actual: m.roll3060(a, mk), py: m.roll3060(a - 12, mk) },
      sel.cmp,
    ),
    kpi(
      'p6',
      'Cost of risk',
      fmtPct(cor),
      [{ label: 'Basis', value: 'annualised over the window' }],
      'riskDown',
      { actual: cor, py: cube.available(shift(w, -12)) ? m.costOfRisk(shift(w, -12), mk) : null },
      sel.cmp,
    ),
  ];

  // P7 DPD buckets, 13 months
  const months = trailing13(a);
  const snaps = months.map((i) => m.snap(i, mk));
  const p7: ChartCard = {
    id: 'p7',
    title: 'DPD buckets, 13 months',
    info: info('p7'),
    open: null,
    legend: BUCKETS.map(([label, , role]) => ({ label, role })),
    chart: {
      kind: 'columns',
      x: months.map(axisLabel),
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
    info: info('p8'),
    open: null,
    legend: vintages.map((v, k) => ({ label: quarterLabel(v[0] ?? a), role: roles[k] ?? 'c4' })),
    chart: {
      kind: 'line',
      x: Array.from({ length: 13 }, (_, k) => (k % 3 === 0 ? `${k} m` : '')),
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
  const flat = heatLevels(values.flat());
  const p9: ChartCard = {
    id: 'p9',
    title: 'Bad rate by product × market',
    info: info('p9'),
    open: null,
    legend: [],
    chart: {
      kind: 'heat',
      cols: shownMarkets.map((c) => MARKET_NAMES[c]),
      rows: products.map((p, i) => ({
        label: p.product_name,
        cells: shownMarkets.map((_, j) => ({
          text: fmtPct(values[i]?.[j] ?? null),
          level: flat[i * shownMarkets.length + j] ?? null,
        })),
      })),
      side: null,
    },
  };

  // P10 30+ DPD by market
  const p10: ChartCard = {
    id: 'p10',
    title: '30+ DPD by market',
    info: info('p10'),
    open: null,
    legend: MARKETS.map((c, k) => ({ label: MARKET_NAMES[c], role: k === 0 ? 'c1' : k === 1 ? 'c2' : 'py' })),
    chart: {
      kind: 'line',
      x: months.map(axisLabel),
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
    info: info('p11'),
    open: null,
    legend: [
      { label: '30 → 60', role: 'c1' },
      { label: '1–29 → 30+', role: 'c2' },
    ],
    chart: {
      kind: 'line',
      x: t.x,
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

  // P12 Segments: size × DPD, one bubble per product (2026-11-01, owner: no market breakdown; a small market filter
  // on the card instead, starting at the page's market)
  const bubbles = (market: MarketSel) => {
    const lp = cube.loansBy(w, market, (r) => r.product);
    const sp = cube.snapshotBy(a, market, (r) => r.product);
    const pts = products
      .map((p) => {
        const l = lp.get(p.product_code);
        const s = sp?.get(p.product_code) ?? null;
        return {
          label: p.product_name,
          x: l && l.loans > 0 ? l.principal / l.loans : 0,
          y: m.dpd30(s) ?? 0,
          size: s?.outstanding ?? 0,
          cls: 0 as const,
          highlight: false,
          showLabel: false,
        };
      })
      .filter((pt) => pt.size > 0);
    const worst = pts.reduce((w0, pt) => (pt.y > (w0?.y ?? -1) ? pt : w0), pts[0]);
    // labels on the three largest bubbles and the worst one (all five collide where tickets are close)
    const top3 = [...pts].sort((x, y) => y.size - x.size).slice(0, 3);
    for (const pt of pts) {
      pt.highlight = pt === worst;
      pt.showLabel = top3.includes(pt) || pt === worst;
    }
    return {
      kind: 'bubble' as const,
      xUnit: 'eur' as const,
      yUnit: 'pct' as const,
      points: pts,
    };
  };
  const p12: ChartCard = {
    id: 'p12',
    title: 'Segments: size × DPD',
    info: info('p12'),
    open: null,
    legend: [
      { label: 'Product', role: 'c4' },
      { label: 'worst 30+ DPD', role: 'selected' as const },
    ],
    chart: bubbles(mk),
    variants: {
      label: 'Market',
      value: mk,
      options: (['ALL', ...MARKETS] as const).map((c) => ({
        key: c,
        label: c === 'ALL' ? 'All' : c,
        chart: bubbles(c),
      })),
    },
  };

  return {
    kpis,
    charts: [p7, p8, p9, p10, p11, p12],
    layout: 'thirds',
    table: overdueTable(ctx, sel),
  };
}

/**
 * P13 Overdue by product (2026-11-01, owner: replaces the overdue-loan list, which moved into the detail window): the
 * month-end book per microloan product, balances by bucket. Budget 30+ DPD exists per market only, so the Δ is vs PY.
 */
function overdueTable(ctx: Ctx, sel: SalesSelection): TableCard {
  const { cube, m } = ctx;
  const mk = sel.market;
  const a = sel.anchor;
  const now = cube.snapshotBy(a, mk, (r) => r.product);
  const prior = cube.snapshotBy(a - 12, mk, (r) => r.product);
  const products = cube.dims.product.filter((p) => p.product_line === 'Microloan');
  const eur = (v: number | undefined) => fmtEur(v ?? null);
  return {
    id: 'p13',
    title: `Overdue by product - ${monthLabel(a)} - ${MARKET_NAMES[mk]}`,
    info: info('p13'),
    columns: [
      { key: 'product', label: 'Product', width: 130, align: 'left' },
      { key: 'active', label: 'Active loans', width: 110, align: 'right' },
      { key: 'out', label: 'Outstanding €', width: 120, align: 'right' },
      ...BUCKETS.map(([label, key]) => ({
        key,
        label: `${label} €`,
        width: 100,
        align: 'right' as const,
      })),
      { key: 'dpd', label: '30+ DPD %', width: 100, align: 'right' },
      { key: 'delta', label: 'vs PY', width: 100, align: 'right' },
      { key: 'prov', label: 'Provision €', width: 110, align: 'right' },
      { key: 'status', label: 'Status', width: 96, align: 'left' },
    ],
    rows: products.map((p) => {
      const code = p.product_code;
      const s = now?.get(code) ?? null;
      const d = cmpRow('riskDown', 'vs PY', m.dpd30(s), m.dpd30(prior?.get(code) ?? null));
      return {
        key: code,
        selected: false,
        action: {
          kind: 'drill',
          drill: { kind: 'overdue', market: mk, product: code },
        },
        secondary: null,
        cells: [
          { text: p.product_name },
          { text: fmtCount(s?.active ?? null) },
          { text: eur(s?.outstanding) },
          ...BUCKETS.map(([, key]) => ({ text: eur(s?.[key]) })),
          { text: fmtPct(m.dpd30(s)) },
          { text: d.text, status: d.status },
          { text: eur(s?.provision) },
          {
            text: d.status === 'neutral' ? STATUS_WORD.neutral : `${d.text.slice(0, 1)} ${STATUS_WORD[d.status]}`,
            status: d.status,
            chip: true,
          },
        ],
      };
    }),
    empty: now ? null : 'No portfolio snapshot for this month',
    action: {
      label: 'Show overdue loans',
      drill: { kind: 'overdue', market: mk, product: null },
    },
    needsDetail: false,
  };
}
