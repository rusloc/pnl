import { formatAmount } from './format.ts';
import { STATUS_TEXT, kpiStatus } from './thresholds.ts';
import type { Better } from './thresholds.ts';
import type { ColumnPlan } from './types.ts';
import type { DeltaRow, InfoValue, KpiCardVM, StatusChip, Tone, VitalsVM } from './view-types.ts';
import { diff, money, pct, pctSigned, pp, ratio, rel, v } from './view-context.ts';
import type { Compare, Values, ViewContext } from './view-context.ts';

// Vitals view (formerly Key figures; P&L views redesign v4, build-brief §1): 3 heroes (Net revenue, Adj. EBITDA,
// Operating profit), 2 ratio cards (Gross margin %, Opex % revenue) and 5 driver cards whose content swaps by company
// (L-10). Card face = title - value - Δ rows vs Compare A / Compare B - status chip vs Budget only (spec KPI §6);
// sub-metrics live in the ⓘ. Definitions follow Track B (`docs/model/measure-dictionary.md`, folder 3 KPIs).

type Kind = 'amount' | 'ratio';

interface Metric {
  /** Value for a plan (null = no data); `t` is the translation the card is read at (the selected basis). */
  at(plan: ColumnPlan | null): number | null;
  kind: Kind;
  better: Better;
  format(value: number | null): string;
  /** Δ magnitude on the card face: number only, no symbol or unit ("+9.1", v4 HTML varRow, PV-21). */
  formatDelta?(value: number): string;
}

interface CardSpec {
  id: string;
  title: string;
  size: KpiCardVM['size'];
  metric: Metric;
  what: string;
  formula: string;
  source: string;
  values: InfoValue[];
}

function deltaRow(ctx: ViewContext, c: Compare, m: Metric, base: number | null): DeltaRow {
  const cmp = m.at(c.plan);
  const label = `vs ${c.name}`;
  if (base === null || cmp === null) return { label, abs: null, rel: 'n/a', tone: 'neutral' };
  const d = base - cmp;
  const r = m.kind === 'ratio' ? d : rel(base, cmp);
  const shown = m.kind === 'ratio' ? pp(d) : pctSigned(r);
  const onPlan = r !== null && Math.abs(r) < 0.0005; // shows as 0.0 % / 0.0 pp: "on plan" (spec KPI §4)
  // Colour only on the Budget row (build-brief §0): prior-year and latest-estimate rows are text only.
  const status = c.choice === 'B' ? kpiStatus(r, m.kind, m.better) : null;
  const tone: Tone =
    status === null ? 'neutral' : status === 'ahead' ? 'ahead' : status === 'onTrack' ? 'plan' : 'adverse';
  return {
    label,
    abs: m.kind === 'ratio' || onPlan ? null : signedOf(m, d),
    rel: onPlan ? 'on plan' : shown,
    tone,
  };
}

function signedOf(m: Metric, d: number): string {
  const s = (m.formatDelta ?? m.format)(Math.abs(d));
  if (/^[^1-9]*$/.test(s)) return s; // rounds to zero: no sign
  return `${d > 0 ? '+' : d < 0 ? '−' : ''}${s}`;
}

function card(ctx: ViewContext, s: CardSpec): KpiCardVM {
  const base = s.metric.at(ctx.plan.base);
  const rows = [ctx.compareA, ctx.compareB]
    .filter((c): c is Compare => c !== null)
    .map((c) => deltaRow(ctx, c, s.metric, base));
  const bud = s.metric.at(ctx.budget);
  const statusRel = base === null || bud === null ? null : s.metric.kind === 'ratio' ? base - bud : rel(base, bud);
  const st = kpiStatus(statusRel, s.metric.kind, s.metric.better);
  const status: StatusChip | null = st === null ? null : { status: st, text: STATUS_TEXT[st] };
  return {
    id: s.id,
    title: s.title,
    size: s.size,
    value: s.metric.format(base),
    rows,
    status,
    info: { title: s.title, what: s.what, formula: s.formula, values: s.values, source: s.source },
  };
}

export function vitals(ctx: ViewContext): VitalsVM {
  const { tr, trCC, plan, entity } = ctx;
  const amt = (x: number | null) => money(ctx, x);
  const vals = (p: ColumnPlan | null) => ctx.total(p, tr);
  const line =
    (code: string): Metric['at'] =>
    (p) =>
      v(vals(p), code);
  const lineMetric = (code: string): Metric => ({
    at: line(code),
    kind: 'amount',
    better: 'Higher',
    format: amt,
    formatDelta: (x) => formatAmount(x, ctx.units),
  });
  const ratioMetric = (f: (x: Values) => number | null, better: Better): Metric => ({
    at: (p) => {
      const x = vals(p);
      return x ? f(x) : null;
    },
    kind: 'ratio',
    better,
    format: (r) => pct(r),
  });
  const byLine = (p: ColumnPlan | null) => (p === null ? null : ctx.values(p, tr, ['line']));
  const base = vals(plan.base);
  const nr = v(base, 'NR');
  const py = vals(ctx.py);
  const nrCC = v(ctx.total(plan.base, trCC), 'NR');
  const pyCC = v(ctx.total(ctx.py, trCC), 'NR');
  const organic = rel(nrCC, pyCC); // KPI Organic Growth (K-02): NRcc ÷ PY NRcc − 1 (PY NR is positive)
  const reported = rel(nr, v(py, 'NR')); // KPI Reported Growth
  const ebitdaMargin = ratio(v(base, 'EBITDA'), nr);
  const cmpBud = vals(ctx.budget);
  const lines = byLine(plan.base);
  const lineGm = (code: string) => ratio(v(lines?.get(code) ?? null, 'GP'), v(lines?.get(code) ?? null, 'NR'));
  const opex = (x: Values | null) => {
    const sm = v(x, 'SM');
    const rd = v(x, 'RD');
    const ga = v(x, 'GA');
    return sm === null || rd === null || ga === null ? null : -(sm + rd + ga);
  };
  const lineName = (code: string) =>
    ctx.ds.manifest.tables.dim_line.find((l) => l.line_code === code)?.line_name ?? code;

  const results: KpiCardVM[] = [
    card(ctx, {
      id: 'nr',
      title: 'Net revenue',
      size: 'hero',
      metric: lineMetric('NR'),
      what: 'Gross revenue less gross-to-net deductions (spine step 3). The chip compares with Budget only; other rows are text.',
      formula: 'NR = GR + GTN; Δ = actual − comparison, % of |comparison|',
      values: [
        { label: 'Organic growth vs PY (constant currency)', value: pctSigned(organic) },
        { label: 'Reported growth vs PY', value: pctSigned(reported) },
      ],
      source: 'KPI Value K-01 - KPI Δ A / Δ B - KPI Organic Growth - KPI Reported Growth',
    }),
    card(ctx, {
      id: 'ebitda',
      title: 'Adjusted EBITDA',
      size: 'hero',
      metric: lineMetric('EBITDA'),
      what: 'Contribution margin plus operating expenses (spine step 9, management performance measure). Excludes D&A and adjusting items; the data has no share-based compensation.',
      formula: 'Adj. EBITDA = CM + OPEX',
      values: [
        { label: 'Margin', value: pct(ebitdaMargin) },
        ...(entity === 'S'
          ? [
              {
                label: 'Rule of 40 (organic growth + margin)',
                value: organic === null || ebitdaMargin === null ? 'n/a' : pct(organic + ebitdaMargin),
              },
            ]
          : []),
      ],
      source: `KPI Value K-07 - KPI Adj EBITDA Margin${entity === 'S' ? ' - KPI Rule of 40 (K-12 S)' : ''}`,
    }),
    card(ctx, {
      id: 'op',
      title: 'Operating profit',
      size: 'hero',
      metric: lineMetric('OP'),
      what: 'IFRS 18 required subtotal (spine step 13).',
      formula: 'OP = Adj. EBITDA + D&A + adjusting items (signed)',
      values: [
        { label: 'Margin', value: pct(ratio(v(base, 'OP'), nr)) },
        { label: 'Adj. EBITDA', value: amt(v(base, 'EBITDA')) },
        { label: 'D&A', value: amt(v(base, 'DA')) },
        { label: 'Adjusting items', value: amt(v(base, 'ADJ')) },
        { label: 'Net profit', value: amt(v(base, 'NP')) },
        { label: 'Net margin', value: pct(ratio(v(base, 'NP'), nr)) },
      ],
      source: 'KPI Value K-08 - KPI Operating Margin - Net Profit - KPI Net Margin',
    }),
    card(ctx, {
      id: 'gm',
      title: 'Gross margin %',
      size: 'secondary',
      metric: ratioMetric((x) => ratio(v(x, 'GP'), v(x, 'NR')), 'Higher'),
      what: 'Gross profit as a share of net revenue. A ratio: variances in percentage points.',
      formula: 'GM % = GP ÷ NR',
      values:
        entity === 'S'
          ? [
              { label: 'Platform subscriptions', value: pct(lineGm('SUB')) },
              { label: 'Payments', value: pct(lineGm('PAY')) },
            ]
          : [...(lines?.entries() ?? [])]
              .filter(([k]) => !k.endsWith('UNASSIGNED'))
              .sort((a, b) => (v(b[1], 'NR') ?? 0) - (v(a[1], 'NR') ?? 0))
              .slice(0, 2)
              .map(([k]) => ({ label: lineName(k), value: pct(lineGm(k)) })),
      source: `KPI Gross Margin % K-03 - ${entity === 'S' ? 'KPI Subscription GM % - Payments GM % (same pattern on PAY)' : 'GM % by category (dim_line)'}`,
    }),
    card(ctx, {
      id: 'opex',
      title: 'Opex % revenue',
      size: 'secondary',
      metric: ratioMetric((x) => ratio(opex(x), v(x, 'NR')), 'Lower'),
      what: 'Sales & marketing, R&D and G&A as a share of net revenue. Lower is better, so the colour logic is inverted. Excludes other operating items, D&A and adjusting items.',
      formula: 'Opex % = −(SM + RD + GA) ÷ NR',
      values: [
        { label: 'Sales & marketing % NR', value: pct(ratio(-(v(base, 'SM') ?? 0), nr)) },
        { label: 'R&D % NR', value: pct(ratio(-(v(base, 'RD') ?? 0), nr)) },
        { label: 'G&A % NR', value: pct(ratio(-(v(base, 'GA') ?? 0), nr)) },
        { label: 'Opex', value: amt(opex(base)) },
        { label: 'Opex vs Budget (favourable +)', value: money(ctx, diff(opex(cmpBud), opex(base)), true) },
      ],
      source: 'new: Opex % NR = blocks SM + RD + GA ÷ NR (PL % NR rows) - spec KPI §5 1.3',
    }),
  ];

  const drivers = entity === 'S' ? servicesDrivers(ctx) : productsDrivers(ctx);
  drivers.push(fyOutlook(ctx));
  return { results, drivers };
}

// ---------- driver row: Commerce Cloud ----------

/** Δ text on card faces: the number in the selected units with its sign, no symbol or unit ("+9.1"; zero: "0.0"). */
function signedAmount(ctx: ViewContext, d: number): string {
  const s = formatAmount(Math.abs(d), ctx.units);
  return /^[^1-9]*$/.test(s) ? s : `${d > 0 ? '+' : '−'}${s}`;
}

function servicesDrivers(ctx: ViewContext): KpiCardVM[] {
  const { tr, plan } = ctx;
  const amtDelta = (x: number) => formatAmount(x, ctx.units);
  /** "$100.3 k" (per-merchant amounts, PV-10). */
  const thousands = (x: number | null) =>
    x === null ? 'n/a' : `${ctx.symbol}${formatAmount(x, { divisor: 1_000, decimals: 1 })} k`;
  const opsTotal = (p: ColumnPlan | null) => (p === null ? null : (ctx.ops(ctx.entity, p, tr).get('') ?? null));
  const gmv = (p: ColumnPlan | null) => opsTotal(p)?.gmv ?? null;
  const merchants = (p: ColumnPlan | null) => {
    const o = opsTotal(p);
    return o && o.merchants > 0 ? o.merchants : null;
  };
  const sub = (p: ColumnPlan | null) =>
    p === null ? null : v(ctx.values(ctx.lastMonth(p), tr, ['line'])?.get('SUB') ?? null, 'NR');
  const arr = (p: ColumnPlan | null) => {
    const x = sub(p);
    return x === null ? null : x * 12; // KPI ARR: SUB NR of the last month × 12 (run-rate, K-04 S)
  };
  const lines = (p: ColumnPlan | null) => (p === null ? null : ctx.values(p, tr, ['line']));
  const share = (p: ColumnPlan | null, code: string) => {
    const l = lines(p);
    return ratio(v(l?.get(code) ?? null, 'NR'), v(ctx.total(p, tr), 'NR'));
  };
  const payGmv = (p: ColumnPlan | null) =>
    p === null ? null : (ctx.ops(ctx.entity, p, tr, ['line']).get('PAY')?.gmv ?? null);
  const takeRate = (p: ColumnPlan | null) => ratio(v(lines(p)?.get('PAY') ?? null, 'NR'), payGmv(p));
  const amt = (x: number | null) => money(ctx, x);
  const int = (x: number | null) => (x === null ? 'n/a' : formatAmount(x, { divisor: 1, decimals: 0 }));
  const bp = (d: number | null) => {
    if (d === null) return 'n/a';
    const n = Math.round(d * 10_000);
    return n === 0 ? '0 bp' : `${n > 0 ? '+' : '−'}${Math.abs(n)} bp`; // no sign on a zero (parity rule 15)
  };
  const subNow = v(lines(plan.base)?.get('SUB') ?? null, 'NR');
  const payNow = v(lines(plan.base)?.get('PAY') ?? null, 'NR');
  const subPy = v(lines(ctx.py)?.get('SUB') ?? null, 'NR');
  const payPy = v(lines(ctx.py)?.get('PAY') ?? null, 'NR');
  const mix: KpiCardVM = {
    id: 'mix',
    title: 'Revenue mix',
    size: 'driver',
    value: `${pct(share(plan.base, 'SUB'))} / ${pct(share(plan.base, 'PAY'))}`,
    rows: [
      {
        label: 'Sub / Pay vs PY',
        abs: null,
        rel: `${pp(diff(share(plan.base, 'SUB'), share(ctx.py, 'SUB')))} / ${pp(diff(share(plan.base, 'PAY'), share(ctx.py, 'PAY')))}`,
        tone: 'neutral',
      },
    ],
    status: null, // neutral KPI: no colour
    info: {
      title: 'Revenue mix',
      what: 'Platform subscriptions and Payments as shares of net revenue; the rest is apps, partners & ads and professional services. Neutral: no colour.',
      formula: 'share = NR of the service line ÷ NR',
      values: [
        { label: 'Platform subscriptions', value: `${amt(subNow)} (${pctSigned(rel(subNow, subPy))} YoY)` },
        { label: 'Payments', value: `${amt(payNow)} (${pctSigned(rel(payNow, payPy))} YoY)` },
      ],
      source: 'Prof NR Share by dim_line (SUB, PAY) - gap analysis P1',
    },
  };
  return [
    card(ctx, {
      id: 'gmv',
      title: 'GMV processed',
      size: 'driver',
      metric: { at: gmv, kind: 'amount', better: 'Higher', format: amt, formatDelta: amtDelta },
      what: 'Transaction value processed in the window, translated like amounts.',
      formula: 'GMV = Σ gmv_local → reporting currency, per month × currency',
      values: [
        { label: 'Payments take rate', value: pct(takeRate(plan.base), 2) },
        // vs Budget and vs Prior year, as the v4 HTML (PV-09)
        { label: 'Take rate vs Budget', value: bp(diff(takeRate(plan.base), takeRate(ctx.budget))) },
        { label: 'Take rate vs Prior year', value: bp(diff(takeRate(plan.base), takeRate(ctx.py))) },
      ],
      source: 'KPI GMV K-09 S - KPI Payments Take Rate K-05 S',
    }),
    card(ctx, {
      id: 'merchants',
      title: 'Active merchants',
      size: 'driver',
      metric: { at: merchants, kind: 'amount', better: 'Higher', format: int },
      what: 'Merchants with an active paid plan at the last month-end of the window; never a sum over months.',
      formula: 'merchants = active_merchants_end at the window end (K-23)',
      values: [{ label: 'GMV per merchant', value: thousands(ratio(gmv(plan.base), merchants(plan.base))) }],
      source: 'KPI Active Merchants K-10 S - new: KPI GMV ÷ KPI Active Merchants',
    }),
    card(ctx, {
      id: 'arr',
      title: 'ARR (run-rate)',
      size: 'driver',
      metric: { at: arr, kind: 'amount', better: 'Higher', format: amt, formatDelta: amtDelta },
      what: 'Platform-subscription net revenue of the last month in the window × 12. A run-rate proxy, not contract ARR.',
      formula: 'ARR = SUB NR (last month) × 12',
      values: [{ label: 'Net new ARR vs prior-year end', value: money(ctx, diff(arr(plan.base), arr(ctx.py)), true) }],
      source: 'KPI ARR K-04 S - new: KPI ARR − KPI ARR as Compare B',
    }),
    mix,
  ];
}

// ---------- driver row: Consumer Products ----------

function productsDrivers(ctx: ViewContext): KpiCardVM[] {
  const { tr, plan } = ctx;
  const units = (p: ColumnPlan | null) => {
    const o = p === null ? null : (ctx.ops(ctx.entity, p, tr).get('') ?? null);
    return o && o.units > 0 ? o.units : null;
  };
  const vals = (p: ColumnPlan | null) => ctx.total(p, tr);
  const leaf = (p: ColumnPlan | null, codes: readonly string[]) => {
    if (p === null) return null;
    const acc = ctx.leaves(p, tr).get('');
    if (!acc) return null;
    const dict = ctx.ds.manifest.dict.account;
    return codes.reduce((s, c) => s + (acc[dict.indexOf(c)] ?? 0), 0);
  };
  const ap = (p: ColumnPlan | null) => {
    const x = leaf(p, ['SM_P1', 'SM_P2']);
    return x === null ? null : ratio(-x, v(vals(p), 'NR'));
  };
  const amt = (x: number | null) => money(ctx, x);
  const int = (x: number | null) => (x === null ? 'n/a' : formatAmount(x, { divisor: 1, decimals: 0 }));
  const perUnit = (x: number | null) =>
    x === null ? 'n/a' : `${ctx.symbol}${formatAmount(x, { divisor: 1, decimals: 2 })}`;
  const nrPerUnit = (p: ColumnPlan | null) => ratio(v(vals(p), 'NR'), units(p));
  return [
    card(ctx, {
      id: 'units',
      title: 'Units sold',
      size: 'driver',
      metric: { at: units, kind: 'amount', better: 'Higher', format: int },
      what: 'Units shipped in the window (a flow: sums over the months).',
      formula: 'units = Σ units_sold',
      values: [{ label: 'Volume vs prior year', value: pctSigned(rel(units(plan.base), units(ctx.py))) }],
      source: 'KPI Units Sold K-09 P',
    }),
    card(ctx, {
      id: 'nrPerUnit',
      title: 'Net revenue per unit',
      size: 'driver',
      metric: {
        at: nrPerUnit,
        kind: 'amount',
        better: 'Higher',
        format: perUnit,
        formatDelta: (x) => formatAmount(x, { divisor: 1, decimals: 2 }),
      },
      what: 'Net revenue divided by units sold: the price / mix lever.',
      formula: 'NR per unit = NR ÷ units sold',
      values: [
        { label: 'Net revenue', value: amt(v(vals(plan.base), 'NR')) },
        { label: 'Units sold', value: int(units(plan.base)) },
      ],
      source: 'KPI NR per Unit K-10 P',
    }),
    card(ctx, {
      id: 'gtn',
      title: 'Gross-to-net %',
      size: 'driver',
      metric: {
        at: (p) => {
          const x = vals(p);
          return ratio(-(v(x, 'GTN') ?? 0), v(x, 'GR'));
        },
        kind: 'ratio',
        better: 'Lower',
        format: (r) => pct(r),
      },
      what: 'Deductions from gross revenue (trade spend, rebates, returns) as a share of gross revenue. Lower is better.',
      formula: 'GTN % = − GTN ÷ GR',
      values: [{ label: 'Gross-to-net deductions', value: amt(v(vals(plan.base), 'GTN')) }],
      source: 'KPI Gross-to-Net % K-04 P',
    }),
    card(ctx, {
      id: 'ap',
      title: 'A&P % of NR',
      size: 'driver',
      metric: { at: ap, kind: 'ratio', better: 'Neutral', format: (r) => pct(r) },
      what: 'Advertising (working media) and consumer promotions as a share of net revenue. Neutral: no colour.',
      formula: 'A&P % = − (SM_P1 + SM_P2) ÷ NR',
      values: [{ label: 'A&P spend', value: amt(leaf(plan.base, ['SM_P1', 'SM_P2'])) }],
      source: 'KPI A&P % NR K-05 P',
    }),
  ];
}

// ---------- FY outlook (every company) ----------

function fyOutlook(ctx: ViewContext): KpiCardVM {
  const { tr, plan } = ctx;
  const le = ctx.total(plan.fyLE, tr);
  const bud = ctx.total(plan.fyBudget, tr);
  const nr = v(le, 'NR');
  const nrBud = v(bud, 'NR');
  const e = v(le, 'EBITDA');
  const eBud = v(bud, 'EBITDA');
  const row = (label: string, a: number | null, b: number | null): DeltaRow => {
    const r = rel(a, b);
    const st = kpiStatus(r, 'amount', 'Higher');
    return {
      label,
      abs: a === null || b === null ? null : signedAmount(ctx, a - b),
      rel: pctSigned(r),
      tone: st === null ? 'neutral' : st === 'ahead' ? 'ahead' : st === 'onTrack' ? 'plan' : 'adverse',
    };
  };
  const st = kpiStatus(rel(nr, nrBud), 'amount', 'Higher');
  return {
    id: 'fy',
    title: 'FY outlook',
    size: 'driver',
    value: money(ctx, nr),
    rows: [row('vs FY Budget', nr, nrBud), row('EBITDA vs FY Bud', e, eBud)],
    status: st === null ? null : { status: st, text: STATUS_TEXT[st] },
    info: {
      title: 'FY outlook vs Budget',
      what: 'Latest estimate of net revenue for the whole fiscal year: actual closed months plus the latest forecast for open months (C-02). Same card for every company.',
      formula: 'attainment = FY LE ÷ FY Budget',
      values: [
        { label: 'Revenue attainment', value: pct(ratio(nr, nrBud)) },
        { label: 'Adj. EBITDA, FY LE', value: money(ctx, e) },
        { label: 'EBITDA attainment', value: pct(ratio(e, eBud)) },
      ],
      source: 'FY LE Amount - FY Budget Amount - PL Δ LE vs Budget (M-14)',
    },
  };
}
