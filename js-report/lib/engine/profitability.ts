import { kpiStatus } from './thresholds.ts';
import type { ColumnPlan } from './types.ts';
import { money, pct, pctSigned, pp, ratio, rel, v } from './view-context.ts';
import type { Values, ViewContext } from './view-context.ts';
import { versionPlan } from './versions.ts';
import type { BubbleVM, ConcentrationVM, HeatVM, ProfRow, ProfitabilityVM, Tone } from './view-types.ts';

// Profitability view (P&L views redesign v4, build-brief §3). Constant currency by default when comparing (README
// decision 7): every amount here is at the selected year's budget rates (C-12). Region only (F-21 default): opex is
// booked at entity × region (C-31), so Adj. EBITDA by region is measured, never allocated. Page 1: 8-column table +
// concentration bars; page 2: growth × margin bubbles + region × service line mix heatmap.

export function profitability(ctx: ViewContext): ProfitabilityVM {
  const { plan, trCC, bridgeCmp: cmp, sel } = ctx;
  const t = ctx.ds.manifest.tables;
  const regionName = new Map(t.dim_region.map((r) => [r.region_code, r.region_name]));
  const regionOrder = new Map(t.dim_region.map((r) => [r.region_code, r.sort_order]));
  const byRegion = (p: ColumnPlan) => ctx.values(p, trCC, ['region']) ?? new Map<string, Values>();
  const now = byRegion(plan.base);
  const prior = byRegion(cmp.plan);
  const total = ctx.total(plan.base, trCC);
  const totalCmp = ctx.total(cmp.plan, trCC);
  const regions = [...now.keys()].sort(
    (a, b) =>
      (v(now.get(b) ?? null, 'NR') ?? 0) - (v(now.get(a) ?? null, 'NR') ?? 0) ||
      (regionOrder.get(a) ?? 0) - (regionOrder.get(b) ?? 0),
  );
  const amt = (x: number | null) => money(ctx, x);

  const row = (key: string, label: string, a: Values | null, c: Values | null, isTotal: boolean): ProfRow => {
    const nrRel = rel(v(a, 'NR'), v(c, 'NR'));
    const cm = ratio(v(a, 'CM'), v(a, 'NR'));
    const cmCmp = ratio(v(c, 'CM'), v(c, 'NR'));
    const cmDelta = cm === null || cmCmp === null ? null : cm - cmCmp;
    // CM Δ is the only status indicator on this table (build-brief §3, PV-13): the NR Δ % stays plain text
    const tone: Tone = 'neutral';
    return {
      key,
      label,
      nr: amt(v(a, 'NR')),
      nrDelta: { text: pctSigned(nrRel), tone },
      gm: pct(ratio(v(a, 'GP'), v(a, 'NR'))),
      cm: pct(cm),
      // the only status dot: CM Δ in pp (thresholds of spec KPI §6, never on revenue)
      cmDelta: { text: pp(cmDelta), status: kpiStatus(cmDelta, 'ratio', 'Higher') },
      contribution: amt(v(a, 'CM')),
      ebitda: amt(v(a, 'EBITDA')),
      total: isTotal,
    };
  };
  const rows = [
    ...regions.map((r) => row(r, regionName.get(r) ?? r, now.get(r) ?? null, prior.get(r) ?? null, false)),
    row('TOTAL', 'Total', total, totalCmp, true),
  ];

  // Concentration: share of NR, contribution and Adj. EBITDA by region (Prof NR Share pattern).
  const share = (r: string, code: string) => ratio(v(now.get(r) ?? null, code), v(total, code));
  const levels: ConcentrationVM['levels'] = [
    ['Net revenue', 'NR'],
    ['Contribution', 'CM'],
    ['Adj. EBITDA', 'EBITDA'],
  ].map(([label, code]) => ({
    label: label ?? '',
    segments: regions.map((r) => {
      const s = share(r, code ?? 'NR') ?? 0;
      return { key: r, label: regionName.get(r) ?? r, share: s, text: pct(s) };
    }),
  }));
  const concentration: ConcentrationVM = {
    levels,
    legend: regions.map((r) => ({
      key: r,
      label: regionName.get(r) ?? r,
      drift: `${pct(share(r, 'NR'))} → ${pct(share(r, 'EBITDA'))} (${pp((share(r, 'EBITDA') ?? 0) - (share(r, 'NR') ?? 0))})`,
    })),
    info: {
      title: 'Concentration - share by profit level',
      what: 'Three 100 % bars: each region’s share of net revenue, of contribution and of Adj. EBITDA (booked by region). A region whose share shrinks from revenue to contribution dilutes the margin; one whose share grows is accretive.',
      formula: 'share = region value ÷ company value, per level; drift = EBITDA share − NR share (pp)',
      values: regions.map((r) => ({
        label: regionName.get(r) ?? r,
        value: `${pct(share(r, 'NR'))} / ${pct(share(r, 'CM'))} / ${pct(share(r, 'EBITDA'))}`,
      })),
      source: 'Prof NR Share - contribution and EBITDA shares (same pattern on Contribution Margin / Adjusted EBITDA)',
    },
  };

  // Growth × margin: x = NR growth vs PY at constant currency (KPI Organic Growth per slice, K-22), y = CM %.
  const pyPlan = ctx.py;
  const py = byRegion(pyPlan);
  const pyTotal = ctx.total(pyPlan, trCC);
  const prev = versionPlan(ctx.ds.manifest, { ...sel, fy: sel.fy - 1, compareA: 'PY' });
  const py2Plan = prev.compareA;
  const py2 = py2Plan && py2Plan.missingMonths.length === 0 ? byRegion(py2Plan) : null; // C-04: needs two prior years
  const growth = (a: Values | null, b: Values | null) => rel(v(a, 'NR'), v(b, 'NR'));
  const cmOf = (a: Values | null) => ratio(v(a, 'CM'), v(a, 'NR'));
  const companyGrowth = growth(total, pyTotal);
  const companyCm = cmOf(total);
  const bubble: BubbleVM = {
    points: regions
      .map((r) => {
        const a = now.get(r) ?? null;
        const g = growth(a, py.get(r) ?? null);
        const cm = cmOf(a);
        if (g === null || cm === null) return null;
        const gPy = py2 ? growth(py.get(r) ?? null, py2.get(r) ?? null) : null;
        const cmPy = cmOf(py.get(r) ?? null);
        return {
          key: r,
          label: regionName.get(r) ?? r,
          x: g,
          y: cm,
          size: v(a, 'NR') ?? 0,
          text: `CM ${pct(cm)} - ${pctSigned(g)}`,
          detail: `${regionName.get(r) ?? r}: NR ${amt(v(a, 'NR'))}, growth ${pctSigned(g)}, CM ${pct(cm)}${gPy !== null && cmPy !== null ? `; prior year ${pctSigned(gPy)}, CM ${pct(cmPy)}` : ''}`,
          trail: gPy !== null && cmPy !== null ? { x: gPy, y: cmPy } : null,
        };
      })
      .filter((p): p is NonNullable<typeof p> => p !== null),
    ref: {
      x: companyGrowth ?? 0,
      y: companyCm ?? 0,
      xText: `company ${pctSigned(companyGrowth)}`,
      yText: `company ${pct(companyCm)}`,
    },
    quadrants: ['profitable, slower', 'profitable growth', 'problem', 'dilutive growth'],
    info: {
      title: 'Growth × margin by region',
      what: 'x = net revenue growth year on year at constant currency, y = contribution margin %, bubble = net revenue; dashed lines = company values, giving four quadrants. The thin line runs from the prior-year position (hollow dot) to the current one; it needs two earlier years, so it is blank where the prior year has no prior year (C-04).',
      formula: 'growth = NRcc ÷ PY NRcc − 1; CM % = contribution ÷ NR, per region',
      values: [
        { label: 'Company growth', value: pctSigned(companyGrowth) },
        { label: 'Company CM %', value: pct(companyCm) },
        { label: 'Prior-year trails', value: py2 ? 'drawn' : 'n/a for this window (no earlier year)' },
      ],
      source: 'KPI Organic Growth per slice (K-22) - KPI CM % per slice - Prof Net Revenue - PY: Compare B Amount',
    },
  };

  // Mix heatmap: region × service line (category for Consumer Products), NR at CC; colour = the line's GM %.
  const lines = t.dim_line
    .filter((l) => l.entity_code === ctx.entity && !l.is_unassigned)
    .sort((a, b) => a.sort_order - b.sort_order);
  const cells = ctx.values(plan.base, trCC, ['region', 'line']);
  const byLine = ctx.values(plan.base, trCC, ['line']);
  const heat: HeatVM = {
    rows: regions.map((r) => {
      const regionNr = v(now.get(r) ?? null, 'NR');
      return {
        key: r,
        label: regionName.get(r) ?? r,
        cells: lines.map((l) => {
          const c = cells?.get(`${r}|${l.line_code}`) ?? null;
          const nr = v(c, 'NR');
          return {
            text: amt(nr),
            share: pct(ratio(nr, regionNr), 0),
            detail: `${regionName.get(r) ?? r} × ${l.line_name}: NR ${amt(nr)}, ${pct(ratio(nr, regionNr))} of the region, GM ${pct(ratio(v(c, 'GP'), nr))}`,
          };
        }),
        total: amt(regionNr),
      };
    }),
    cols: lines.map((l) => {
      const x = byLine?.get(l.line_code) ?? null;
      const gm = ratio(v(x, 'GP'), v(x, 'NR'));
      return { key: l.line_code, label: l.line_name, gm, gmText: `GM ${pct(gm)}`, total: amt(v(x, 'NR')) };
    }),
    grand: amt(v(total, 'NR')),
    info: {
      title: `Mix - region × ${ctx.entity === 'S' ? 'service line' : 'category'}`,
      what: 'Cells: net revenue at constant currency and its share of the region; colour = gross margin % of the column (dark = high). Row and column totals reconcile to the table.',
      formula: 'cell = NR(region, line); share = cell ÷ region NR; colour = GP ÷ NR of the line',
      values: lines.map((l) => {
        const x = byLine?.get(l.line_code) ?? null;
        return { label: l.line_name, value: `NR ${amt(v(x, 'NR'))}, GM ${pct(ratio(v(x, 'GP'), v(x, 'NR')))}` };
      }),
      source: 'Net Revenue - Gross Profit at dim_region × dim_line grain (both direct, C-30)',
    },
  };

  return {
    title: 'Profitability by Region',
    subtitle: `Constant currency (FY${sel.fy} budget rates) - ${sel.currency} ${ctx.unitLabel} - vs ${cmp.name}`,
    table: {
      rows,
      cmpName: cmp.name,
      info: {
        title: 'Profitability by Region',
        what: `Constant currency, rows by net revenue. Δ vs ${cmp.name} % on net revenue; GM % and CM % of the region’s revenue; CM Δ = contribution margin % minus ${cmp.name} in pp, the only column with a status dot. Adj. EBITDA is booked by region (C-31): nothing here is allocated.`,
        formula: 'GM % = GP ÷ NR; CM % = contribution ÷ NR; CM Δ = CM % − comparison CM %',
        values: [
          { label: 'Comparison', value: cmp.name },
          { label: 'Status dot', value: 'on track ±0.3 pp, watch to 1.0 pp, off track beyond, ahead = green' },
        ],
        source:
          'Prof Net Revenue - Prof NR Δ % (CC) - Gross Profit - Contribution Margin - KPI CM % - Adjusted EBITDA - new: CM Δ pp - C-46',
      },
    },
    concentration,
    bubble,
    heat,
  };
}
