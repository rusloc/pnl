// Largest variances view model (C-45, redesign v4 build-brief §2 page 2): the
// model returns every leaf line down to operating profit with its level columns
// (`LV Base`, `LV Comparison`, `LV Δ B`, `LV FX`); Top-N, the block grouping,
// the shared bar scale, the coverage footer and the n.m. rule are evaluated here
// with the model's own rules (`derive.ts`, ADR-0006 §16), so a control change
// never re-queries. The cut's member segments come from the `variancesCut` zone.
import { lvDelta, lvDeltaPct } from './derive';
import { fmtAmount, fmtPct, roundTo } from './format';
import type { DeltaTone, Units, VarCut, VarianceLeaf, VarianceMembers } from './types';

export type VarTop = 8 | 12 | 'all';
export type VarMode = 'block' | 'abs';

/** Blocks down to operating profit, in P&L order (spine; INV / FIN / TAX stay out, like `LV Coverage *`). */
export const VARIANCE_BLOCKS: readonly string[] = ['GR', 'GTN', 'COR', 'VSC', 'SM', 'RD', 'GA', 'OOI', 'DA', 'ADJ'];

export interface VarMember {
  key: string;
  label: string;
  delta: number;
  text: string;
}

export interface VarRow {
  kind: 'block' | 'leaf' | 'footer';
  key: string;
  label: string;
  /** Leaf: its block's name (flat mode shows it as a grey suffix). */
  blockName: string | null;
  /** Block row: "3 of 4 lines". */
  count: string | null;
  comparison: string;
  actual: string;
  delta: number;
  deltaText: string;
  /** "n.m." when |comparison| < 2.0 display units or |Δ %| > 50 %. */
  deltaPct: string;
  /** Δ vs Compare B ("vs PY"); "" when Compare B is None. */
  py: string;
  fx: string;
  tone: DeltaTone;
  /** Below CM and cut by anything but Region / Entity: allocated by NR share (C-31). */
  alloc: boolean;
  members: VarMember[];
  /** Block row: its leaves are hidden. */
  collapsed: boolean;
}

export interface VariancesVM {
  rows: VarRow[];
  footer: VarRow[];
  /** Σ|Δ shown| ÷ Σ|Δ all| (1 when there is nothing). */
  coverage: number;
  /** max |Δ| of every leaf: one bar scale for every row. */
  scale: number;
  legend: { key: string; label: string }[];
  /** Compare B is set: the "vs PY" column shows. */
  hasPy: boolean;
}

export interface VarControls {
  top: VarTop;
  mode: VarMode;
  /** Block codes whose leaves are hidden (block mode). */
  collapsed: ReadonlySet<string>;
}

/** Σ with DAX blank semantics: all blank → blank. */
function sum(values: readonly (number | null)[]): number | null {
  let total: number | null = null;
  for (const v of values) if (v !== null) total = (total ?? 0) + v;
  return total;
}

/** Cuts whose members are booked, not allocated, below contribution margin (`LV Alloc Tag`: Cut Order 0, 1, 5). */
export function cutAllocates(cut: VarCut): boolean {
  return cut !== 'none' && cut !== 'region' && cut !== 'entity';
}

export function largestVariances(
  leaves: readonly VarianceLeaf[],
  members: VarianceMembers | null,
  controls: VarControls,
  units: Units,
  hasPy: boolean
): VariancesVM {
  const scaleK = units === 'k' ? 1000 : 1;
  const decimals = units === 'k' ? 0 : 1;
  const amount = (v: number | null, plus = false) => fmtAmount(v, units, plus);
  const pctText = (base: number | null, cmp: number | null): string => {
    const p = lvDeltaPct(base === null ? null : base * scaleK, cmp === null ? null : cmp * scaleK);
    if (p === null) return '';
    return Number.isNaN(p) ? 'n.m.' : fmtPct(p * 100, true);
  };
  const toneOf = (d: number | null): DeltaTone => {
    if (d === null) return 'neutral';
    const r = roundTo(d * scaleK, decimals);
    return r > 0 ? 'ahead' : r < 0 ? 'off' : 'plan';
  };
  const cut = members?.cut ?? 'none';
  const alloc = cutAllocates(cut);
  const memberList = members?.members ?? [];
  const membersOf = (keys: readonly string[]): VarMember[] =>
    memberList.map((m) => {
      const d = keys.reduce((s, k) => s + (members?.deltas[k]?.[m.key] ?? 0), 0);
      return { key: m.key, label: m.label, delta: d, text: amount(d, true) };
    });

  interface Ranked {
    leaf: VarianceLeaf;
    delta: number | null;
    abs: number;
    row: VarRow;
  }
  const ranked: Ranked[] = leaves
    .filter((l) => VARIANCE_BLOCKS.includes(l.block))
    .map((leaf) => {
      const delta = lvDelta(leaf.base, leaf.comparison);
      const row: VarRow = {
        kind: 'leaf',
        key: leaf.rowKey,
        label: leaf.label,
        blockName: leaf.blockName,
        count: null,
        comparison: amount(leaf.comparison),
        actual: amount(leaf.base),
        delta: delta ?? 0,
        deltaText: amount(delta, true),
        deltaPct: pctText(leaf.base, leaf.comparison),
        py: hasPy ? amount(leaf.deltaB, true) : '',
        fx: amount(leaf.fx, true),
        tone: toneOf(delta),
        alloc: alloc && leaf.belowCm,
        members: membersOf([leaf.rowKey]),
        collapsed: false,
      };
      return { leaf, delta, abs: Math.abs(delta ?? 0), row };
    })
    .sort((a, b) => b.abs - a.abs || a.leaf.lineSort - b.leaf.lineSort || a.leaf.accountSort - b.leaf.accountSort);

  const shown = controls.top === 'all' ? ranked : ranked.slice(0, controls.top);
  const shownKeys = new Set(shown.map((r) => r.leaf.rowKey));

  const rows: VarRow[] = [];
  if (controls.mode === 'abs') {
    rows.push(...shown.map((r) => r.row));
  } else {
    for (const block of VARIANCE_BLOCKS) {
      const inBlock = ranked.filter((r) => r.leaf.block === block);
      const shownIn = inBlock.filter((r) => shownKeys.has(r.leaf.rowKey));
      if (inBlock.length === 0 || (controls.top !== 'all' && shownIn.length === 0)) continue;
      const base = sum(inBlock.map((r) => r.leaf.base));
      const cmp = sum(inBlock.map((r) => r.leaf.comparison));
      const delta = lvDelta(base, cmp);
      const collapsed = controls.collapsed.has(block);
      rows.push({
        kind: 'block',
        key: block,
        label: inBlock[0].leaf.blockName,
        blockName: null,
        count: `${shownIn.length} of ${inBlock.length} lines`,
        comparison: amount(cmp),
        actual: amount(base),
        delta: delta ?? 0,
        deltaText: amount(delta, true),
        deltaPct: pctText(base, cmp),
        py: hasPy ? amount(sum(inBlock.map((r) => r.leaf.deltaB)), true) : '',
        fx: amount(sum(inBlock.map((r) => r.leaf.fx)), true),
        tone: toneOf(delta),
        alloc: alloc && inBlock.every((r) => r.leaf.belowCm),
        members: membersOf(inBlock.map((r) => r.leaf.rowKey)),
        collapsed,
      });
      if (!collapsed) rows.push(...shownIn.map((r) => r.row));
    }
  }

  const footer = (label: string, key: string, set: readonly Ranked[]): VarRow => {
    const base = sum(set.map((r) => r.leaf.base));
    const cmp = sum(set.map((r) => r.leaf.comparison));
    const delta = lvDelta(base, cmp);
    return {
      kind: 'footer',
      key,
      label,
      blockName: null,
      count: null,
      comparison: amount(cmp),
      actual: amount(base),
      delta: delta ?? 0,
      deltaText: amount(delta, true),
      deltaPct: pctText(base, cmp),
      py: hasPy ? amount(sum(set.map((r) => r.leaf.deltaB)), true) : '',
      fx: amount(sum(set.map((r) => r.leaf.fx)), true),
      tone: toneOf(delta),
      alloc: false,
      members: [],
      collapsed: false,
    };
  };
  const totalAbs = ranked.reduce((s, r) => s + r.abs, 0);
  const coverage = totalAbs === 0 ? 1 : shown.reduce((s, r) => s + r.abs, 0) / totalAbs;
  const others = ranked.filter((r) => !shownKeys.has(r.leaf.rowKey));
  return {
    rows,
    footer: [
      footer(`Shown lines (${shown.length}) - coverage ${Math.round(coverage * 100)}%`, 'SHOWN', shown),
      footer(`All other lines (${others.length})`, 'OTHER', others),
      footer('Total P&L Δ at operating profit', 'TOTAL', ranked),
    ],
    coverage,
    scale: Math.max(1e-9, ...ranked.map((r) => r.abs)),
    legend: memberList.map((m) => ({ key: m.key, label: m.label })),
    hasPy,
  };
}
