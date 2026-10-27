import type { SliceDim } from './slices.ts';
import type { ColumnPlan, SpineRow } from './types.ts';
import { diff, money, pctSigned, v } from './view-context.ts';
import type { Values, ViewContext } from './view-context.ts';
import type {
  AnalysisVM,
  BridgeStep,
  BridgeVM,
  Tone,
  VarCut,
  VarMember,
  VarMode,
  VarRow,
  VarTop,
  VariancesVM,
} from './view-types.ts';

// Analysis view (P&L views redesign v4, build-brief §2). Page 1: net revenue bridge with a constant-currency subtotal
// (Track B `Bridge Value` + new step "Constant-currency NR") and the profit bridge Budget Adj. EBITDA → Actual →
// Operating profit (new `dim_profit_step`). Page 2: largest variances (`LV *` measures, C-45) with Top-N, block
// grouping, slice cut, prior-year Δ and "of which FX" (`LV FX`, gap analysis P4). Comparison = Compare A, else
// Compare B, else prior year (parity rule 1, `Bridge Comparison Amount`).

const SHORT: Readonly<Record<'B' | 'LE' | 'PY', string>> = { B: 'Budget', LE: 'LE', PY: 'PY' };
const SVC_LINES = ['SUB', 'PAY', 'APP', 'PS'] as const; // Commerce Cloud service-line steps (SVC_*), C-40
const VARIANCE_BLOCKS = ['GR', 'GTN', 'COR', 'VSC', 'SM', 'RD', 'GA', 'OOI', 'DA', 'ADJ'] as const; // to OP

const residualOf = (steps: readonly BridgeStep[]) => {
  const start = steps.find((s) => s.kind === 'start')?.value ?? 0;
  const end = steps.find((s) => s.kind === 'end')?.value ?? 0;
  const changes = steps
    .filter((s) => s.kind === 'up' || s.kind === 'down' || s.kind === 'fx')
    .reduce((a, s) => a + s.value, 0);
  const levels = steps.filter((s) => s.kind === 'level').reduce((a, s) => a + s.value, 0);
  return start + changes + levels - end;
};

const change = (label: string, value: number, ctx: ViewContext, sub: string | null = null): BridgeStep => ({
  label,
  kind: value >= 0 ? 'up' : 'down',
  value,
  text: money(ctx, value, true),
  sub,
});

// ---------- page 1: bridges ----------

function nrBridge(ctx: ViewContext): BridgeVM {
  const { plan, tr, trCC, bridgeCmp: cmp } = ctx;
  const nr = (p: ColumnPlan, t = tr) => v(ctx.total(p, t), 'NR') ?? 0;
  const start = nr(cmp.plan);
  const end = nr(plan.base);
  const ccBase = nr(plan.base, trCC);
  const ccCmp = nr(cmp.plan, trCC);
  // labels per build-brief §2: "<cmp> NR → … → Constant-currency NR → FX → Actual NR" (PV-11)
  const steps: BridgeStep[] = [
    { label: `${cmp.name} NR`, kind: 'start', value: start, text: money(ctx, start), sub: null },
  ];
  if (ctx.entity === 'S') {
    const base = ctx.values(plan.base, trCC, ['line']);
    const prior = ctx.values(cmp.plan, trCC, ['line']);
    const priorAct = ctx.values(cmp.plan, tr, ['line']);
    for (const l of SVC_LINES) {
      const d = (v(base?.get(l) ?? null, 'NR') ?? 0) - (v(prior?.get(l) ?? null, 'NR') ?? 0);
      const stream = v(priorAct?.get(l) ?? null, 'NR');
      const name = ctx.ds.manifest.tables.dim_line.find((x) => x.line_code === l)?.line_name ?? l;
      steps.push(change(name, d, ctx, stream ? pctSigned(d / Math.abs(stream)) : null));
    }
  } else {
    // Consumer Products: volume per lowest slice k = (U base − U cmp) × NRcc cmp ÷ U cmp; a slice without comparison
    // units counts entirely as volume. Price / mix = the CC change − volume, so the steps add up (Bridge Volume /
    // Bridge Price Mix, K-11 / K-12).
    const by: SliceDim[] = ['region', 'channel', 'line', 'segment'];
    const nrB = ctx.values(plan.base, trCC, by);
    const nrC = ctx.values(cmp.plan, trCC, by);
    const uB = ctx.ops(ctx.entity, plan.base, trCC, by);
    const uC = ctx.ops(ctx.entity, cmp.plan, trCC, by);
    let volume = 0;
    for (const k of new Set([...(nrB?.keys() ?? []), ...(nrC?.keys() ?? [])])) {
      const nb = v(nrB?.get(k) ?? null, 'NR') ?? 0;
      const nc = v(nrC?.get(k) ?? null, 'NR') ?? 0;
      const ub = uB.get(k)?.units ?? 0;
      const uc = uC.get(k)?.units ?? 0;
      volume += uc > 0 ? ((ub - uc) * nc) / uc : nb - nc;
    }
    steps.push(change('Volume', volume, ctx, start ? pctSigned(volume / Math.abs(start)) : null));
    const price = ccBase - ccCmp - volume;
    steps.push(change('Price / mix', price, ctx, start ? pctSigned(price / Math.abs(start)) : null));
  }
  const cc = start + (ccBase - ccCmp);
  steps.push({
    label: 'Constant-currency NR',
    kind: 'subtotal',
    value: cc,
    text: money(ctx, cc),
    sub: pctSigned(rel0(cc, start)),
  });
  const fx = end - ccBase - (start - ccCmp); // Bridge FX = (NR − NRcc) base − (NR − NRcc) comparison
  steps.push({ label: 'FX', kind: 'fx', value: fx, text: money(ctx, fx, true), sub: null });
  steps.push({ label: 'Actual NR', kind: 'end', value: end, text: money(ctx, end), sub: pctSigned(rel0(end, start)) });
  return {
    id: 'nrBridge',
    title: 'Net revenue bridge',
    steps,
    residual: residualOf(steps),
    info: {
      title: 'Net revenue bridge',
      what: `${cmp.name} to actual: driver steps at constant currency, a constant-currency subtotal, then FX (translation, not controllable). The axis does not start at zero; read the labels.`,
      formula: `${ctx.entity === 'S' ? 'service-line step = NRcc actual − NRcc comparison per line' : 'volume = Σ slices (U − Ucmp) × NRcc cmp ÷ Ucmp; price / mix = ΔNRcc − volume'}; CC subtotal = comparison + Σ steps; FX = (NR − NRcc) actual − (NR − NRcc) comparison`,
      values: [
        {
          label: `Reported Δ vs ${cmp.name}`,
          value: `${money(ctx, end - start, true)} (${pctSigned(rel0(end, start))})`,
        },
        { label: 'Constant-currency Δ', value: `${money(ctx, cc - start, true)} (${pctSigned(rel0(cc, start))})` },
        { label: 'FX', value: money(ctx, fx, true) },
      ],
      source:
        'Bridge Value - Bridge Comparison NR - _NR CC Base - _NR CC Bridge Cmp - Bridge FX - C-40 - new step "Constant-currency NR"',
    },
  };
}

const rel0 = (a: number, b: number) => (b === 0 ? null : (a - b) / Math.abs(b));

function profitBridge(ctx: ViewContext): BridgeVM {
  const { plan, tr, trCC, bridgeCmp: cmp } = ctx;
  const A = ctx.total(plan.base, tr);
  const B = ctx.total(cmp.plan, tr);
  const Acc = ctx.total(plan.base, trCC);
  const Bcc = ctx.total(cmp.plan, trCC);
  const val = (x: Values | null, code: string) => v(x, code) ?? 0;
  const eA = val(A, 'EBITDA');
  const eB = val(B, 'EBITDA');
  // Gross-profit steps at constant currency, by service line / category (COR is direct at line grain, C-30).
  const linesA = ctx.values(plan.base, trCC, ['line']);
  const linesB = ctx.values(cmp.plan, trCC, ['line']);
  const nrA = val(Acc, 'NR');
  const nrB = val(Bcc, 'NR');
  const gmB = nrB === 0 ? 0 : val(Bcc, 'GP') / nrB;
  const volume = (nrA - nrB) * gmB;
  let mix = 0;
  for (const k of new Set([...(linesA?.keys() ?? []), ...(linesB?.keys() ?? [])])) {
    const a = linesA?.get(k) ?? null;
    const b = linesB?.get(k) ?? null;
    const nrAl = val(a, 'NR');
    const nrBl = val(b, 'NR');
    const gmBl = nrBl !== 0 ? val(b, 'GP') / nrBl : nrAl !== 0 ? val(a, 'GP') / nrAl : 0;
    mix += (nrAl - (nrB === 0 ? 0 : (nrA * nrBl) / nrB)) * gmBl;
  }
  const rate = val(Acc, 'GP') - val(Bcc, 'GP') - volume - mix; // GM rate = the remainder, so the steps add up
  const block = (code: string) => val(Acc, code) - val(Bcc, code);
  const fx = eA - val(Acc, 'EBITDA') - (eB - val(Bcc, 'EBITDA'));
  const da = val(A, 'DA');
  const adj = val(A, 'ADJ');
  const op = val(A, 'OP');
  const level = (label: string, code: string, x: number): BridgeStep => ({
    label,
    kind: 'level',
    value: x,
    text: money(ctx, x),
    sub: `Δ ${money(ctx, x - val(B, code), true)}`, // Δ vs the comparison; the ⓘ names it
  });
  const steps: BridgeStep[] = [
    { label: `${cmp.name} Adj. EBITDA`, kind: 'start', value: eB, text: money(ctx, eB), sub: null },
    change('Revenue volume', volume, ctx),
    change('GM rate', rate, ctx),
    change('GM mix', mix, ctx),
    change('Variable selling', block('VSC'), ctx),
    change('S&M', block('SM'), ctx),
    change('R&D', block('RD'), ctx),
    change('G&A', block('GA'), ctx),
    change('Other operating', block('OOI'), ctx),
    { label: 'FX', kind: 'fx', value: fx, text: money(ctx, fx, true), sub: null },
    {
      label: 'Adj. EBITDA',
      kind: 'subtotal',
      value: eA,
      text: money(ctx, eA),
      sub: `Δ ${money(ctx, eA - eB, true)}`,
    },
    level('D&A', 'DA', da),
    level('Adjusting items', 'ADJ', adj),
    {
      label: 'Operating profit',
      kind: 'end',
      value: op,
      text: money(ctx, op),
      sub: `Δ ${money(ctx, op - val(B, 'OP'), true)}`,
    },
  ];
  // Reconciliation: comparison EBITDA + changes = actual EBITDA; + D&A + adjusting items = operating profit.
  const changes = steps
    .filter((s) => s.kind === 'up' || s.kind === 'down' || s.kind === 'fx')
    .reduce((a, s) => a + s.value, 0);
  const residual = Math.abs(eB + changes - eA) + Math.abs(eA + da + adj - op);
  return {
    id: 'profitBridge',
    title: `Profit bridge: ${cmp.name} Adj. EBITDA → Actual → Operating profit`,
    steps,
    residual,
    info: {
      title: 'Profit bridge',
      what: `${cmp.name} Adj. EBITDA to actual: revenue volume at the comparison's gross margin, GM rate and mix by ${ctx.entity === 'S' ? 'service line' : 'category'}, variable selling, the opex blocks (all at constant currency), then FX. D&A and adjusting items are actual levels (their Δ is the small label) so the bridge reconciles to operating profit. No share-based compensation step: not in the data.`,
      formula:
        'volume = ΔNRcc × GM %cmp; mix = Σ lines (NR − NR × share cmp) × GM %cmp,line; rate = ΔGPcc − volume − mix; FX = (E − Ecc) − (Ecmp − Ecc,cmp)',
      values: [
        { label: `Adj. EBITDA Δ vs ${cmp.name}`, value: money(ctx, eA - eB, true) },
        { label: 'of which FX', value: money(ctx, fx, true) },
        { label: 'Δ at constant currency', value: money(ctx, eA - eB - fx, true) },
        { label: `Operating profit Δ vs ${cmp.name}`, value: money(ctx, op - val(B, 'OP'), true) },
      ],
      source:
        'PL Δ A rows VSC SM RD GA OOI - PL Base rows DA ADJ - GP by dim_line - _Bridge NR CC Change - CC branch of _Amt Raw - new dim_profit_step - spec Analysis §5.2',
    },
  };
}

export function analysisBridges(ctx: ViewContext): AnalysisVM {
  return { nr: nrBridge(ctx), profit: profitBridge(ctx) };
}

// ---------- page 2: largest variances ----------

const CUT_DIM: Record<Exclude<VarCut, 'none'>, SliceDim> = {
  region: 'region',
  channel: 'channel',
  line: 'line',
  segment: 'segment',
};

function memberNames(ctx: ViewContext, dim: SliceDim): Map<string, string> {
  const t = ctx.ds.manifest.tables;
  const rows: [string, string, boolean][] =
    dim === 'region'
      ? t.dim_region.map((r) => [r.region_code, r.region_name, false])
      : dim === 'channel'
        ? t.dim_channel
            .filter((c) => c.entity_code === ctx.entity)
            .map((c) => [c.channel_code, c.channel_name, c.is_unassigned])
        : dim === 'line'
          ? t.dim_line
              .filter((c) => c.entity_code === ctx.entity)
              .map((c) => [c.line_code, c.line_name, c.is_unassigned])
          : t.dim_segment
              .filter((c) => c.entity_code === ctx.entity)
              .map((c) => [c.segment_code, c.segment_name, c.is_unassigned]);
  return new Map(rows.filter((r) => !r[2]).map((r) => [r[0], r[1]]));
}

/** Company-specific name of a slice dimension ("Sales motion", "Service line", …): dim_*.slot_label (L-10). */
const slotLabel = (rows: readonly { entity_code: string; slot_label: string }[], entity: string) =>
  rows.find((r) => r.entity_code === entity)?.slot_label ?? '';

export function largestVariances(ctx: ViewContext, top: VarTop, mode: VarMode, cut: VarCut): VariancesVM {
  const { plan, tr, trCC, bridgeCmp: cmp, spine } = ctx;
  const m = ctx.ds.manifest;
  const idx = new Map(m.dict.account.map((c, i) => [c, i]));
  const acc = (p: ColumnPlan, t = tr) => ctx.leaves(p, t).get('') ?? new Float64Array(m.dict.account.length);
  const base = acc(plan.base);
  const comp = acc(cmp.plan);
  // Second comparison column = Compare B (build-brief §2 "Compare B Amount per leaf"); dropped when Compare B = None
  // (parity rule 17, PV-05). Its header names the choice: "vs PY", "vs Budget", "vs LE".
  const cmpB = ctx.compareB;
  const pyHas = cmpB !== null && cmpB.plan.parts.length > 0;
  const py = cmpB ? acc(cmpB.plan) : new Float64Array(m.dict.account.length);
  const baseCC = acc(plan.base, trCC);
  const compCC = acc(cmp.plan, trCC);
  const isBelowCm = new Map(m.tables.dim_account.map((a) => [a.account_code, a.is_below_cm]));
  const blockRows = new Map(spine.filter((r) => r.kind === 'block').map((r) => [r.code, r]));
  const blockNames = new Map([...blockRows].map(([c, r]) => [c, r.label]));
  const valuesBase = ctx.total(plan.base, tr);
  const valuesCmp = ctx.total(cmp.plan, tr);
  const valuesPy = cmpB ? ctx.total(cmpB.plan, tr) : null;
  const valuesBaseCC = ctx.total(plan.base, trCC);
  const valuesCmpCC = ctx.total(cmp.plan, trCC);
  const nm = 2 * ctx.units.divisor; // n.m. when |comparison| < 2.0 display units (spec Analysis 6.2)

  const deltaPct = (d: number, c: number) => {
    if (Math.abs(c) < nm) return 'n.m.';
    const r = d / Math.abs(c);
    return Math.abs(r) > 0.5 ? 'n.m.' : pctSigned(r);
  };
  // "plan" when the Δ shows as zero in the selected units (half the last displayed digit)
  const zero = 0.5 * 10 ** -ctx.units.decimals * ctx.units.divisor;
  const tone = (d: number): Tone => (Math.abs(d) < zero ? 'plan' : d > 0 ? 'ahead' : 'adverse');

  // Members of the cut (stacked segments, ▸ list), allocated below CM unless the cut is Region (C-31).
  const dim = cut === 'none' ? null : CUT_DIM[cut];
  const names = dim ? memberNames(ctx, dim) : new Map<string, string>();
  const byBase = dim ? ctx.leaves(plan.base, tr, [dim]) : null;
  const byCmp = dim ? ctx.leaves(cmp.plan, tr, [dim]) : null;
  const membersOf = (i: number): VarMember[] =>
    dim
      ? [...names].map(([key, label]) => {
          const d = (byBase?.get(key)?.[i] ?? 0) - (byCmp?.get(key)?.[i] ?? 0);
          return { key, label, delta: d, text: money(ctx, d, true) };
        })
      : [];

  interface Leaf {
    row: VarRow;
    code: string;
    block: string;
    abs: number;
    i: number;
  }
  const leaves: Leaf[] = spine
    .filter(
      (r): r is SpineRow & { parent: string } =>
        r.kind === 'leaf' && r.parent !== null && (VARIANCE_BLOCKS as readonly string[]).includes(r.parent),
    )
    // A line with no data in either version is hidden, not "n.m." (Track B parity round 2026-10-27, PV-12); its Δ is
    // 0, so Σ|Δ all| and the coverage are unchanged. n.m. stays for lines with data (comparison < 2.0 or |Δ %| > 50 %).
    .filter((r) => {
      const i = idx.get(r.code) ?? -1;
      return (base[i] ?? 0) !== 0 || (comp[i] ?? 0) !== 0;
    })
    .map((r) => {
      const i = idx.get(r.code) ?? -1;
      const b = base[i] ?? 0;
      const c = comp[i] ?? 0;
      const d = b - c;
      const fx = d - ((baseCC[i] ?? 0) - (compCC[i] ?? 0)); // LV FX = (base − base cc) − (cmp − cmp cc)
      const row: VarRow = {
        kind: 'leaf',
        code: r.code,
        label: r.label,
        block: r.parent,
        blockName: blockNames.get(r.parent) ?? r.parent,
        count: null,
        comparison: money(ctx, c),
        actual: money(ctx, b),
        delta: d,
        deltaText: money(ctx, d, true),
        deltaPct: deltaPct(d, c),
        py: pyHas ? money(ctx, b - (py[i] ?? 0), true) : 'n/a',
        fx: money(ctx, fx, true),
        tone: tone(d),
        alloc: dim !== null && dim !== 'region' && (isBelowCm.get(r.code) ?? false),
        members: membersOf(i),
      };
      return { row, code: r.code, block: r.parent, abs: Math.abs(d), i };
    });
  const ranked = [...leaves].sort((a, b) => b.abs - a.abs || a.i - b.i);
  const shown = top === 'all' ? ranked : ranked.slice(0, top);
  const shownSet = new Set(shown.map((l) => l.code));
  const strip = (l: Leaf): VarRow => l.row;

  const rows: VarRow[] = [];
  if (mode === 'abs') rows.push(...shown.map(strip));
  else
    for (const code of VARIANCE_BLOCKS) {
      const inBlock = leaves.filter((l) => l.block === code);
      const shownIn = ranked.filter((l) => l.block === code && shownSet.has(l.code));
      if (inBlock.length === 0 || (top !== 'all' && shownIn.length === 0)) continue;
      const b = v(valuesBase, code) ?? 0;
      const c = v(valuesCmp, code) ?? 0;
      const d = b - c;
      const fx = d - ((v(valuesBaseCC, code) ?? 0) - (v(valuesCmpCC, code) ?? 0));
      const i0 = inBlock.map((l) => l.i);
      rows.push({
        kind: 'block',
        code,
        label: blockNames.get(code) ?? code,
        block: null,
        blockName: null,
        count: `${shownIn.length} of ${inBlock.length} lines`,
        comparison: money(ctx, c),
        actual: money(ctx, b),
        delta: d,
        deltaText: money(ctx, d, true),
        deltaPct: deltaPct(d, c),
        py: pyHas ? money(ctx, diff(b, v(valuesPy, code)), true) : 'n/a',
        fx: money(ctx, fx, true),
        tone: tone(d),
        alloc: dim !== null && dim !== 'region' && inBlock.every((l) => isBelowCm.get(l.code)),
        members: dim
          ? [...names].map(([key, label]) => {
              const md = i0.reduce((s, i) => s + (byBase?.get(key)?.[i] ?? 0) - (byCmp?.get(key)?.[i] ?? 0), 0);
              return { key, label, delta: md, text: money(ctx, md, true) };
            })
          : [],
      });
      rows.push(...shownIn.map(strip));
    }

  const sum = (ls: readonly Leaf[], f: (l: Leaf) => number) => ls.reduce((s, l) => s + f(l), 0);
  const footer = (label: string, ls: readonly Leaf[], code: string): VarRow => {
    const b = sum(ls, (l) => base[l.i] ?? 0);
    const c = sum(ls, (l) => comp[l.i] ?? 0);
    const d = b - c;
    const fx = d - sum(ls, (l) => (baseCC[l.i] ?? 0) - (compCC[l.i] ?? 0));
    return {
      kind: 'footer',
      code,
      label,
      block: null,
      blockName: null,
      count: null,
      comparison: money(ctx, c),
      actual: money(ctx, b),
      delta: d,
      deltaText: money(ctx, d, true),
      deltaPct: deltaPct(d, c),
      py: pyHas ? money(ctx, b - sum(ls, (l) => py[l.i] ?? 0), true) : 'n/a',
      fx: money(ctx, fx, true),
      tone: tone(d),
      alloc: false,
      members: [],
    };
  };
  const totalAbs = sum(leaves, (l) => l.abs);
  const coverage = totalAbs === 0 ? 1 : sum(shown, (l) => l.abs) / totalAbs;
  const others = leaves.filter((l) => !shownSet.has(l.code));
  const pct0 = (x: number) => `${Math.round(x * 100)}%`;
  return {
    title: `Largest variances vs ${cmp.name}`,
    cmpName: cmp.name,
    columns: { comparison: cmp.name, py: cmpB ? `vs ${SHORT[cmpB.choice]}` : '' },
    rows,
    footer: [
      footer(`Shown lines (${shown.length}) - coverage ${pct0(coverage)}`, shown, 'SHOWN'),
      footer(`All other lines (${others.length})`, others, 'OTHER'),
      footer('Total P&L Δ at operating profit', leaves, 'TOTAL'),
    ],
    coverage,
    scale: Math.max(...leaves.map((l) => l.abs), 1e-9),
    legend: [...names].map(([key, label]) => ({ key, label })),
    cuts: [
      { value: 'none', label: 'Total' },
      { value: 'region', label: 'Region' },
      { value: 'channel', label: slotLabel(m.tables.dim_channel, ctx.entity) },
      { value: 'line', label: slotLabel(m.tables.dim_line, ctx.entity) },
      { value: 'segment', label: slotLabel(m.tables.dim_segment, ctx.entity) },
    ],
    info: {
      title: `Largest variances vs ${cmp.name}`,
      what: 'Leaf lines of the P&L down to operating profit. Δ = actual − comparison on signed values, so a positive Δ always helps profit and a negative one hurts it; bars share one scale. Top 8 / 12 / All; By block groups the shown lines under their P&L block with the block’s full subtotal; By |Δ| is one flat ranking. A cut splits every bar into slice members; opex and below are booked by region only and allocated by NR share to the other slices (marked alloc.).',
      formula:
        'Δ = actual − comparison; Δ % = Δ ÷ |comparison|, n.m. when |comparison| < 2.0 or |Δ %| > 50 %; FX = (actual − actual cc) − (comparison − comparison cc); coverage = Σ|Δ shown| ÷ Σ|Δ all|',
      values: [
        { label: 'Lines to operating profit', value: String(leaves.length) },
        { label: 'Coverage of the shown lines', value: pct0(coverage) },
        {
          label: 'Second comparison',
          value: cmpB
            ? pyHas
              ? `actual − ${cmpB.name}, same months`
              : `n/a (no ${cmpB.name} data)`
            : 'none (Compare B off)',
        },
      ],
      source:
        'LV Base - LV Comparison - LV Δ - LV Δ % - LV Abs Δ (TopN) - Compare B Amount (PY) - dim_account.block_code - _Amt Row block subtotals - fact_pl / fact_pl_allocated cut (C-30, C-31) - new: LV FX, TopN parameter, block grouping - C-45',
    },
  };
}
