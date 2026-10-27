import type { KpiStatus } from './thresholds.ts';

// View models of the Vitals, Analysis and Profitability views (P&L views redesign v4). Every string is final copy
// and every plotted number comes from the engine; components own geometry only (ADR-0002, CONV-001).

export interface InfoValue {
  label: string;
  value: string;
}

/** ⓘ pop-up (ADR-0012 §2.3): what it is · formula in words · sub-metrics · source measures (Track B names). */
export interface InfoVM {
  title: string;
  what: string;
  formula: string;
  values: InfoValue[];
  source: string;
}

export interface HowToReadVM {
  title: string;
  lines: InfoValue[];
}

/** ahead = favourable beyond on-track, adverse = watch / off track, plan = on track, neutral = no colour (PY rows). */
export type Tone = 'ahead' | 'adverse' | 'plan' | 'neutral';

export interface DeltaRow {
  label: string; // "vs Budget"
  abs: string | null; // "+$9.2 m"; null for ratios
  rel: string; // "+1.4%", "+0.3 pp", "on plan", "n/a"
  tone: Tone;
}

export interface StatusChip {
  status: KpiStatus;
  text: string; // word, never colour alone (N-07)
}

export interface KpiCardVM {
  id: string;
  title: string;
  size: 'hero' | 'secondary' | 'driver';
  value: string;
  rows: DeltaRow[];
  status: StatusChip | null;
  info: InfoVM;
}

export interface VitalsVM {
  results: KpiCardVM[]; // 3 heroes, then 2 secondary
  drivers: KpiCardVM[]; // 5, content swaps by company (L-10)
}

export type BridgeKind = 'start' | 'end' | 'subtotal' | 'up' | 'down' | 'fx' | 'level';

export interface BridgeStep {
  label: string;
  kind: BridgeKind;
  /** start / end / subtotal / level: the level; up / down / fx: the signed change. */
  value: number;
  text: string; // value label
  sub: string | null; // step % of the stream's comparison, or the level's Δ vs comparison
}

export interface BridgeVM {
  id: string;
  title: string;
  steps: BridgeStep[];
  info: InfoVM;
  /** Σ changes − (end − start): 0 up to float noise (T-05). */
  residual: number;
}

export type VarTop = 8 | 12 | 'all';
export type VarMode = 'block' | 'abs';
export type VarCut = 'none' | 'region' | 'channel' | 'line' | 'segment';

export interface VarMember {
  key: string;
  label: string;
  delta: number; // signed, reporting units
  text: string;
}

export interface VarRow {
  kind: 'block' | 'leaf' | 'footer';
  code: string;
  label: string;
  block: string | null; // leaf: block code; flat mode shows the block name as a grey suffix
  blockName: string | null;
  count: string | null; // block row: "3 of 4 lines"
  comparison: string;
  actual: string;
  delta: number; // signed, reporting units (bar)
  deltaText: string;
  deltaPct: string; // "n.m." when |comparison| < 2.0 units or |Δ %| > 50 %
  py: string; // Δ vs prior year
  fx: string; // of which FX
  tone: Tone;
  alloc: boolean; // below CM and cut by anything but Region (C-31)
  members: VarMember[]; // stacked segments of the cut (empty without a cut)
}

export interface VariancesVM {
  title: string;
  cmpName: string;
  columns: { comparison: string; py: string };
  rows: VarRow[]; // display order; block rows precede their shown leaves in block mode
  footer: VarRow[]; // shown lines · all other lines · total at operating profit
  coverage: number; // Σ|Δ shown| ÷ Σ|Δ all|
  scale: number; // max |Δ| of every leaf (shared bar scale)
  legend: { key: string; label: string }[]; // cut members
  cuts: { value: VarCut; label: string }[]; // Total · Region · company slot labels (dim_* slot_label)
  info: InfoVM;
}

export interface ProfRow {
  key: string;
  label: string;
  nr: string;
  nrDelta: { text: string; tone: Tone };
  gm: string;
  cm: string;
  cmDelta: { text: string; status: KpiStatus | null };
  contribution: string;
  ebitda: string;
  total: boolean;
}

export interface ConcentrationVM {
  levels: { label: string; segments: { key: string; label: string; share: number; text: string }[] }[];
  legend: { key: string; label: string; drift: string }[];
  info: InfoVM;
}

export interface BubbleVM {
  points: {
    key: string;
    label: string;
    x: number; // NR growth vs PY at constant currency
    y: number; // CM %
    size: number; // NR
    text: string; // "CM 50.9% · +27.8%"
    detail: string; // hover
    trail: { x: number; y: number } | null; // prior-year position
  }[];
  ref: { x: number; y: number; xText: string; yText: string };
  quadrants: [string, string, string, string]; // top-left, top-right, bottom-left, bottom-right
  info: InfoVM;
}

export interface HeatVM {
  rows: { key: string; label: string; cells: { text: string; share: string; detail: string }[]; total: string }[];
  cols: { key: string; label: string; gm: number | null; gmText: string; total: string }[];
  grand: string;
  info: InfoVM;
}

export interface ProfitabilityVM {
  title: string;
  subtitle: string; // basis and comparison, built from the selection (parity rule 13)
  table: { rows: ProfRow[]; info: InfoVM; cmpName: string };
  concentration: ConcentrationVM;
  bubble: BubbleVM;
  heat: HeatVM;
}

export interface AnalysisVM {
  nr: BridgeVM;
  profit: BridgeVM;
}
