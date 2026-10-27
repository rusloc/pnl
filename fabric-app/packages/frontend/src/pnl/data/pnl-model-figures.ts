// Live figures (ADR-0006 phase 2): the model's result tables → the typed zone
// shapes the views render. The model owns every §7 rule and every number here;
// this file reshapes rows, applies display units / signs / formats (F-14 … F-16,
// N-06) and derives favourable / unfavourable from the sign the model returns.
// Amounts arrive in millions (param_units pinned to M), ratios as fractions
// (0.494 → 49.4 %); card Δ are derived from the value / comparison pairs with the
// model's `KPI Δ *` rule (`model/derive.ts`, ADR-0006 §16). ⓘ copy comes from
// `model/info-popovers.ts` (the shared block of docs/ADD/features/info-popovers.md).
import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';

import { bridgeComparison, VERSION_SHORT } from '../model/filters';
import { bridgeGeometry, type BridgeInput } from '../model/bridge-geometry';
import { kpiDelta, lvDelta, lvDeltaPct } from '../model/derive';
import { CURRENCY_SYMBOL, fmtAmount, fmtInt, fmtMoney, fmtPct, fmtPp, MINUS, roundTo, toneOf } from '../model/format';
import { cardInfo, panelInfo } from '../model/info-popovers';
import { type BetterWhen, cmStatus, kpiStatus, statusChip, statusTone } from '../model/thresholds';
import { VARIANCE_BLOCKS } from '../model/variances';
import type {
  Bridge,
  Bubble,
  BubblePoint,
  CompareVersion,
  Concentration,
  DeltaRow,
  DeltaTone,
  Driver,
  FilterState,
  Heat,
  InfoCopy,
  Profitability,
  ProfRow,
  ReferenceData,
  Units,
  VarCut,
  VarianceLeaf,
  VarianceMembers,
  VariancesZone,
  VitalsCard,
  VitalsZone,
} from '../model/types';
import { cellBoolean, cellNumber, cellString, indexColumns, PnlModelError } from './pnl-model-client';
import {
  BRIDGE_CC_CODE,
  BRIDGE_COLUMNS,
  BRIDGE_END_CODE,
  BRIDGE_FX_CODE,
  BRIDGE_START_CODE,
  breakdownKeys,
  BUBBLE_COLUMNS,
  BUBBLE_COMPANY_CODE,
  CONCENTRATION_COLUMNS,
  CONTEXT_COLUMNS,
  CUT_RESULT_COLUMNS,
  budgetAlias,
  FY_OUTLOOK_CODE,
  fyOutlookAliases,
  HEAT_COLUMNS,
  kpiAliases,
  MIX_CODE,
  mixAliases,
  NOTICE_SEPARATOR,
  PROFIT_COLUMNS,
  PROFIT_COMPARISON_PREFIX,
  PROFITABILITY_COLUMNS,
  PROFITABILITY_TOTAL_CODE,
  selectedBreakdown,
  VARIANCE_COLUMNS,
  VITALS_META_COLUMNS,
  vitalsInfoAlias,
} from './pnl-model-queries';

type Reader = (row: unknown[], name: string) => unknown;

function reader(table: QueryTable, required: readonly string[]): Reader {
  const col = indexColumns(table, required);
  return (row, name) => row[col.get(name) as number];
}

/** "vs Budget" / "vs Prior year" — the delta line names on a tile (K-20). */
function compareName(version: CompareVersion): string {
  return `vs ${version === 'NONE' ? '' : VERSION_SHORT[version]}`.trimEnd();
}

// ---------------------------------------------------------------------------
// Shared by the Vitals cards.

/** Two-decimal price with thousands separators (8.0948 → "8.09"). */
function price(value: number): string {
  const r = roundTo(value, 2);
  const [int, frac] = Math.abs(r).toFixed(2).split('.');
  return `${r < 0 ? '−' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`;
}

/** `dim_kpi.value_type` of the percent KPIs: Δ in pp (the test the model's `KPI Δ *` make). */
function isPercentKpi(valueType: string): boolean {
  return valueType === 'PCT' || valueType === 'PCT2';
}

// ---------------------------------------------------------------------------
// Vitals (redesign v4, build-brief §1): 3 heroes, 2 secondary, 5 drivers per
// `dim_kpi[vitals_slot]` / `vitals_tier`; Δ rows with the model's `KPI Δ *` rule,
// the status chip vs Budget only with the `_KPI Status` thresholds (thresholds.ts,
// PV-01), "on plan" for a zero Δ (`Vitals Card SVG` `_zero`), the FY outlook card
// against FY Budget, the revenue-mix card as two shares (PV-04).

export interface VitalsMeta {
  slot: number;
  tier: VitalsCard['tier'];
  code: string;
  label: string;
  betterWhen: BetterWhen;
  valueType: string;
  definition: string;
}

const VITALS_META_REQUIRED = Object.values(VITALS_META_COLUMNS);

const TIERS: Record<string, VitalsCard['tier']> = { Hero: 'hero', Secondary: 'secondary', Driver: 'driver' };

/** QV1 rows → the entity's cards in slot order. */
export function mapVitalsMeta(table: QueryTable): VitalsMeta[] {
  const read = reader(table, VITALS_META_REQUIRED);
  return table.rows
    .map((row): VitalsMeta => {
      const tier = TIERS[cellString(read(row, VITALS_META_COLUMNS.tier))];
      const betterWhen = cellString(read(row, VITALS_META_COLUMNS.betterWhen));
      if (!tier) throw new PnlModelError('query', `Unknown dim_kpi.vitals_tier: ${cellString(read(row, VITALS_META_COLUMNS.tier))}`);
      if (betterWhen !== 'Higher' && betterWhen !== 'Lower' && betterWhen !== 'Neutral') {
        throw new PnlModelError('query', `Unknown dim_kpi.better_when: ${betterWhen}`);
      }
      return {
        slot: cellNumber(read(row, VITALS_META_COLUMNS.slot)) ?? 0,
        tier,
        code: cellString(read(row, VITALS_META_COLUMNS.code)),
        label: cellString(read(row, VITALS_META_COLUMNS.label)),
        betterWhen,
        valueType: cellString(read(row, VITALS_META_COLUMNS.valueType)),
        definition: cellString(read(row, VITALS_META_COLUMNS.definition)),
      };
    })
    .sort((a, b) => a.slot - b.slot);
}

/** Card value text by `dim_kpi.value_type` (`Vitals Card SVG` `_value_text`): "$667.4 m", "419.8 m", "124,291", "$8.09", "55.9%". */
export function vitalsValueText(value: number | null, valueType: string, filter: Pick<FilterState, 'units' | 'currency'>): string {
  if (value === null) return 'n/a';
  switch (valueType) {
    case 'AMT':
      return fmtMoney(value, filter.units, filter.currency);
    case 'CNT':
      return `${fmtAmount(value, filter.units)} ${filter.units}`;
    case 'INT':
      return fmtInt(value);
    case 'PRICE':
      return `${CURRENCY_SYMBOL[filter.currency]}${price(value)}`;
    case 'PCT2':
      return fmtPct(value * 100, false, 2);
    default:
      return fmtPct(value * 100);
  }
}

/** The signed absolute Δ of a non-ratio KPI (`_abs_text`): no symbol (the value carries it), "" when it rounds to zero. */
function absDeltaText(d: number, valueType: string, units: Units): string {
  switch (valueType) {
    case 'AMT':
    case 'CNT':
      return fmtAmount(d, units, true);
    case 'INT':
      return fmtInt(roundTo(d, 0)) === '0' ? '' : `${d > 0 ? '+' : ''}${fmtInt(d)}`;
    case 'PRICE': {
      const r = roundTo(d, 2);
      return r === 0 ? '' : `${r > 0 ? '+' : MINUS}${price(Math.abs(r))}`;
    }
    default:
      return '';
  }
}

/**
 * One "vs …" row: percent KPIs in pp, others as the relative Δ with the absolute
 * Δ beside it; "on plan" when the Δ shows as zero (pp to 1 dp, % to 0.1 %);
 * "n/a" without a bar when either side is blank.
 */
function deltaRow(name: string, value: number | null, compare: number | null, percent: boolean, valueType: string, units: Units, tone: DeltaTone): DeltaRow {
  const d = kpiDelta(value, compare, percent, false);
  if (d === null || value === null || compare === null) return { name, abs: null, rel: 'n/a', tone: 'neutral' };
  const zero = percent ? roundTo(d, 1) === 0 : roundTo(d, 3) === 0;
  if (zero) return { name, abs: null, rel: 'on plan', tone: 'plan' };
  return {
    name,
    abs: percent ? null : absDeltaText(value - compare, valueType, units) || null,
    rel: percent ? fmtPp(d) : fmtPct(d * 100, true),
    tone,
  };
}

export interface VitalsCards {
  cards: VitalsCard[];
}

/** QV1 metadata + QV2 value rows (one table per chunk) → the ten cards. */
export function mapVitals(meta: readonly VitalsMeta[], values: readonly QueryTable[], filter: FilterState): VitalsZone {
  const cells = new Map<string, unknown>();
  for (const table of values) {
    if (table.rows.length !== 1) throw new PnlModelError('query', `Vitals values: expected one row, got ${table.rows.length}`);
    for (const [name, i] of indexColumns(table, [])) cells.set(name, table.rows[0][i]);
  }
  const need = (alias: string): number | null => {
    if (!cells.has(alias)) throw new PnlModelError('query', `Vitals values: missing column ${alias}`);
    return cellNumber(cells.get(alias));
  };
  const cards = meta.map((m): VitalsCard => {
    const info: InfoCopy = cardInfo(m.code, filter.entity, m.label, m.definition);
    if (m.code === FY_OUTLOOK_CODE) {
      const f = fyOutlookAliases();
      const nr = need(f.value);
      const bud = need(f.budget);
      const e = need(f.ebitda);
      const eBud = need(f.ebitdaBudget);
      const status = kpiStatus(kpiDelta(nr, bud, false, false), 'PCT', 'Higher');
      return {
        code: m.code,
        label: m.label,
        tier: m.tier,
        value: vitalsValueText(nr, 'AMT', filter),
        rows: [
          deltaRow('vs FY Budget', nr, bud, false, 'AMT', filter.units, statusTone(status)),
          deltaRow('EBITDA vs FY Bud', e, eBud, false, 'AMT', filter.units, 'neutral'),
        ],
        status: statusChip(status),
        info,
      };
    }
    if (m.code === MIX_CODE) {
      // Revenue mix (PV-04): "Sub % / Pay %", one row "Sub / Pay vs PY" in pp, neutral (no chip).
      const x = mixAliases();
      const sub = need(x.sub);
      const pay = need(x.pay);
      const dSub = kpiDelta(sub, need(x.subPy), true, false);
      const dPay = kpiDelta(pay, need(x.payPy), true, false);
      return {
        code: m.code,
        label: m.label,
        tier: m.tier,
        value: `${vitalsValueText(sub, 'PCT', filter)} / ${vitalsValueText(pay, 'PCT', filter)}`,
        rows: [{ name: 'Sub / Pay vs PY', abs: null, rel: dSub === null || dPay === null ? 'n/a' : `${fmtPp(dSub)} / ${fmtPp(dPay)}`, tone: 'neutral' }],
        status: null,
        info,
      };
    }
    const a = kpiAliases(m.code);
    const value = need(a.value);
    const percent = isPercentKpi(m.valueType);
    const compares = ([[filter.compareA, a.cmpA], [filter.compareB, a.cmpB]] as const).filter(([version]) => version !== 'NONE');
    // The chip and the coloured row compare with Budget only, whatever Compare A is (PV-01).
    const status = kpiStatus(kpiDelta(value, need(budgetAlias(filter, m.code)), percent, false), percent ? 'PP' : 'PCT', m.betterWhen);
    const rows = compares.map(([version, alias]) => deltaRow(compareName(version), value, need(alias), percent, m.valueType, filter.units, version === 'BUD' ? statusTone(status) : 'neutral'));
    return { code: m.code, label: m.label, tier: m.tier, value: vitalsValueText(value, m.valueType, filter), rows, status: statusChip(status), info };
  });
  return { results: cards.filter((c) => c.tier !== 'driver'), drivers: cards.filter((c) => c.tier === 'driver') };
}

/** QV3 rows (one table per chunk) → `KPI Info Sub` text per code (blank texts dropped). */
export function mapVitalsInfo(codes: readonly string[], tables: readonly QueryTable[]): Record<string, string> {
  const cells = new Map<string, unknown>();
  for (const table of tables) {
    if (table.rows.length !== 1) throw new PnlModelError('query', `Vitals info: expected one row, got ${table.rows.length}`);
    for (const [name, i] of indexColumns(table, [])) cells.set(name, table.rows[0][i]);
  }
  const out: Record<string, string> = {};
  for (const code of codes) {
    const text = cellString(cells.get(vitalsInfoAlias(code)));
    if (text.length > 0) out[code] = text;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Bridges (C-40, redesign v4 page 1).

const BRIDGE_REQUIRED = Object.values(BRIDGE_COLUMNS);

interface BridgeRow {
  code: string;
  label: string;
  sort: number;
  delta: number | null;
  isTotal: number | null;
}

function bridgeRows(table: QueryTable, columns: typeof BRIDGE_COLUMNS, required: readonly string[]): BridgeRow[] {
  const read = reader(table, required);
  return table.rows
    .map((row) => ({
      code: cellString(read(row, columns.code)),
      label: cellString(read(row, columns.label)),
      sort: cellNumber(read(row, columns.sort)) ?? 0,
      delta: cellNumber(read(row, columns.delta)),
      isTotal: cellNumber(read(row, columns.isTotal)),
    }))
    .sort((a, b) => a.sort - b.sort);
}

const pctOf = (d: number, base: number): string | null => (base === 0 ? null : fmtPct((d / Math.abs(base)) * 100, true));

/** Geometry + texts for a list of bridge inputs (both bridges share the drawing rules). */
function buildBridge(input: BridgeInput[], filter: FilterState, subtitle: string, info: InfoCopy): Bridge {
  const geometry = bridgeGeometry(input, (amount, kind) =>
    kind === 'total' || kind === 'subtotal' ? fmtMoney(amount, filter.units, filter.currency) : kind === 'level' ? fmtAmount(amount, filter.units) : fmtAmount(amount, filter.units, true)
  );
  const axisUnits = filter.units === 'm' ? geometry.axis : geometry.axis * 1000;
  return { subtitle, steps: geometry.steps, axisText: `${CURRENCY_SYMBOL[filter.currency]}${fmtInt(axisUnits)}${filter.units}`, info };
}

/**
 * Q3 rows → the net revenue bridge: comparison level (START), the driver steps at
 * constant currency, the constant-currency subtotal (running level before FX),
 * FX, the actual level (END); step labels carry the step as % of the comparison.
 */
export function mapBridge(table: QueryTable, filter: FilterState): Bridge {
  const rows = bridgeRows(table, BRIDGE_COLUMNS, BRIDGE_REQUIRED);
  const start = rows.find((r) => r.code === BRIDGE_START_CODE);
  const end = rows.find((r) => r.code === BRIDGE_END_CODE && r.isTotal === 2);
  if (!start || !end) throw new PnlModelError('query', 'Bridge result has no comparison or base total');
  const comparison = VERSION_SHORT[bridgeComparison(filter)];
  const startLevel = start.delta ?? 0;
  const endLevel = end.delta ?? 0;
  let running = startLevel;
  let fx = 0;
  const input: BridgeInput[] = [{ label: comparison, amount: startLevel, kind: 'total', sub: null }];
  for (const r of rows) {
    if (r.code === BRIDGE_START_CODE || r.code === BRIDGE_END_CODE) continue;
    if (r.code === BRIDGE_CC_CODE) {
      input.push({ label: 'Constant currency', amount: running, kind: 'subtotal', sub: pctOf(running - startLevel, startLevel) });
      continue;
    }
    const amount = r.delta ?? 0;
    running += amount;
    if (r.code === BRIDGE_FX_CODE) {
      fx = amount;
      input.push({ label: r.label, amount, kind: 'fx', sub: null });
    } else {
      input.push({ label: r.label, amount, kind: 'step', sub: pctOf(amount, startLevel) });
    }
  }
  input.push({ label: VERSION_SHORT[filter.baseVersion], amount: endLevel, kind: 'total', sub: pctOf(endLevel - startLevel, startLevel) });
  const cc = endLevel - fx;
  const residual = running - endLevel;
  const money = (v: number, plus = true) => fmtMoney(v, filter.units, filter.currency, plus);
  const info: InfoCopy = {
    ...panelInfo('NRBRIDGE', { comparison, entity: filter.entity }),
    values: [
      { label: `Reported Δ vs ${comparison}`, value: `${money(endLevel - startLevel)} (${pctOf(endLevel - startLevel, startLevel) ?? 'n/a'})` },
      { label: 'Constant-currency Δ', value: `${money(cc - startLevel)} (${pctOf(cc - startLevel, startLevel) ?? 'n/a'})` },
      { label: 'FX', value: money(fx) },
      ...(Math.abs(residual) > 0.05 ? [{ label: 'Steps not reconciling to the actual level (T-05)', value: money(residual) }] : []),
    ],
  };
  return buildBridge(input, filter, bridgeMethod(filter.entity), info);
}

/** Method note of the net revenue bridge (design §6.3), by entity; the AI assistant quotes it. */
function bridgeMethod(entity: FilterState['entity']): string {
  switch (entity) {
    case 'S':
      return 'Change by service line at constant currency; FX is the translation effect.';
    case 'G':
      return 'Change by company at constant currency; FX is the translation effect.';
    default:
      return 'Volume and price / mix at constant currency; FX is the translation effect.';
  }
}

const PROFIT_REQUIRED = Object.values(PROFIT_COLUMNS);
const PROFIT_LEVEL_STEPS: ReadonlySet<string> = new Set(['DA', 'ADJ']);

/**
 * QP rows → the profit bridge: comparison Adj. EBITDA (BUD), the changes at
 * constant currency, FX, actual Adj. EBITDA (subtotal = running), D&A and
 * adjusting items as signed levels, operating profit (total = running). Level
 * bars carry their Δ vs the comparison (the CMP_* rows).
 */
export function mapProfitBridge(table: QueryTable, filter: FilterState): Bridge {
  const rows = bridgeRows(table, PROFIT_COLUMNS, PROFIT_REQUIRED);
  const comparisonOf = new Map(rows.filter((r) => r.code.startsWith(PROFIT_COMPARISON_PREFIX)).map((r) => [r.code.slice(PROFIT_COMPARISON_PREFIX.length), r.delta]));
  const steps = rows.filter((r) => !r.code.startsWith(PROFIT_COMPARISON_PREFIX));
  const start = steps.find((r) => r.code === 'BUD');
  if (!start || !steps.some((r) => r.code === 'OP')) throw new PnlModelError('query', 'Profit bridge result has no comparison or operating profit row');
  const comparison = VERSION_SHORT[bridgeComparison(filter)];
  const startLevel = start.delta ?? 0;
  const money = (v: number, plus = true) => fmtMoney(v, filter.units, filter.currency, plus);
  const deltaLabel = (v: number) => `Δ ${fmtAmount(v, filter.units, true)}`;
  let running = startLevel;
  let fx = 0;
  let ebitda = startLevel;
  const input: BridgeInput[] = [{ label: `${comparison} EBITDA`, amount: startLevel, kind: 'total', sub: null }];
  for (const r of steps) {
    if (r.code === 'BUD') continue;
    const amount = r.delta ?? 0;
    if (r.code === 'ACT') {
      ebitda = running;
      input.push({ label: 'Adj. EBITDA', amount: running, kind: 'subtotal', sub: deltaLabel(running - startLevel) });
    } else if (r.code === 'OP') {
      const cmp = comparisonOf.get('OP') ?? null;
      input.push({ label: r.label, amount: running, kind: 'total', sub: cmp === null ? null : deltaLabel(running - cmp) });
    } else if (PROFIT_LEVEL_STEPS.has(r.code)) {
      running += amount;
      const cmp = comparisonOf.get(r.code) ?? null;
      input.push({ label: r.label, amount, kind: 'level', sub: cmp === null ? null : deltaLabel(amount - cmp) });
    } else if (r.code === 'FX') {
      fx = amount;
      running += amount;
      input.push({ label: r.label, amount, kind: 'fx', sub: null });
    } else {
      running += amount;
      input.push({ label: r.label, amount, kind: 'step', sub: null });
    }
  }
  const op = running;
  const cmpOp = comparisonOf.get('OP') ?? null;
  const info: InfoCopy = {
    ...panelInfo('PBRIDGE', { comparison, entity: filter.entity }),
    values: [
      { label: `Adj. EBITDA Δ vs ${comparison}`, value: money(ebitda - startLevel) },
      { label: 'of which FX', value: money(fx) },
      { label: 'Δ at constant currency', value: money(ebitda - startLevel - fx) },
      { label: `Operating profit Δ vs ${comparison}`, value: cmpOp === null ? 'n/a' : money(op - cmpOp) },
    ],
  };
  return buildBridge(input, filter, `${comparison} Adj. EBITDA → ${VERSION_SHORT[filter.baseVersion]} → Operating profit`, info);
}

// ---------------------------------------------------------------------------
// Largest variances (C-45, redesign v4 page 2).

const VARIANCE_REQUIRED = Object.values(VARIANCE_COLUMNS);

/** QL rows → the leaf lines (every block; `model/variances.ts` keeps those down to operating profit). */
export function mapVarianceLeaves(table: QueryTable): VariancesZone {
  const read = reader(table, VARIANCE_REQUIRED);
  const leaves = table.rows.map(
    (row): VarianceLeaf => ({
      rowKey: cellString(read(row, VARIANCE_COLUMNS.rowKey)),
      code: cellString(read(row, VARIANCE_COLUMNS.accountCode)),
      label: cellString(read(row, VARIANCE_COLUMNS.accountLabel)),
      block: cellString(read(row, VARIANCE_COLUMNS.lineCode)),
      blockName: cellString(read(row, VARIANCE_COLUMNS.lineLabel)),
      lineSort: cellNumber(read(row, VARIANCE_COLUMNS.lineSort)) ?? 0,
      accountSort: cellNumber(read(row, VARIANCE_COLUMNS.accountSort)) ?? 0,
      base: cellNumber(read(row, VARIANCE_COLUMNS.base)),
      comparison: cellNumber(read(row, VARIANCE_COLUMNS.cmp)),
      deltaB: cellNumber(read(row, VARIANCE_COLUMNS.dB)),
      fx: cellNumber(read(row, VARIANCE_COLUMNS.fx)),
      belowCm: cellBoolean(read(row, VARIANCE_COLUMNS.belowCm)),
    })
  );
  return { leaves };
}

/** The top 8 leaves by |Δ| as the AI assistant's largest-variances rows (ADR-0009). */
export function driversFromVariances(zone: VariancesZone, filter: FilterState): Driver[] {
  return zone.leaves
    .filter((l) => VARIANCE_BLOCKS.includes(l.block))
    .map((l) => ({ leaf: l, d: lvDelta(l.base, l.comparison) }))
    .sort((a, b) => Math.abs(b.d ?? 0) - Math.abs(a.d ?? 0))
    .slice(0, DRIVER_TOP)
    .map(({ leaf, d }) => {
      const pct = lvDeltaPct(leaf.base, leaf.comparison);
      return {
        name: leaf.label,
        block: leaf.blockName,
        delta: d ?? 0,
        deltaText: fmtAmount(d, filter.units, true),
        deltaPctText: pct === null ? '' : Number.isNaN(pct) ? 'n.m.' : fmtPct(pct * 100, true),
        tone: toneOf(d, filter.units === 'k' ? 3 : 1),
      };
    });
}

export const DRIVER_TOP = 8;

const CUT_REQUIRED = Object.values(CUT_RESULT_COLUMNS);

/** Members of a cut in the dimension's own order (parity rule 10), from the reference data. */
function cutMemberOrder(cut: Exclude<VarCut, 'none'>, filter: FilterState, reference: ReferenceData): string[] {
  switch (cut) {
    case 'region':
      return reference.regions.map((r) => r.code);
    case 'entity':
      return ['P', 'S'];
    default:
      return filter.entity === 'G' ? [] : reference.slices[filter.entity][cut].values.map((v) => v.code);
  }
}

/** QL2 rows → member deltas per leaf, members ordered as the reference lists them. */
export function mapVarianceMembers(table: QueryTable, filter: FilterState, reference: ReferenceData): VarianceMembers {
  if (filter.varCut === 'none') throw new PnlModelError('query', 'No cut selected');
  const read = reader(table, CUT_REQUIRED);
  const deltas: Record<string, Record<string, number>> = {};
  const names = new Map<string, string>();
  for (const row of table.rows) {
    const key = cellString(read(row, CUT_RESULT_COLUMNS.rowKey));
    const member = cellString(read(row, CUT_RESULT_COLUMNS.member));
    const d = cellNumber(read(row, CUT_RESULT_COLUMNS.d));
    if (key === '' || member === '' || d === null) continue;
    names.set(member, cellString(read(row, CUT_RESULT_COLUMNS.name)));
    (deltas[key] ??= {})[member] = d;
  }
  const order = cutMemberOrder(filter.varCut, filter, reference);
  const seen = [...names.keys()].sort((a, b) => {
    const ia = order.indexOf(a);
    const ib = order.indexOf(b);
    return (ia === -1 ? order.length : ia) - (ib === -1 ? order.length : ib) || a.localeCompare(b);
  });
  return { cut: filter.varCut, members: seen.map((key) => ({ key, label: names.get(key) ?? key })), deltas };
}

// ---------------------------------------------------------------------------
// Profitability (C-46, redesign v4).

const PROFITABILITY_REQUIRED = Object.values(PROFITABILITY_COLUMNS);

/** Breakdown labels for the toolbar (F-21), from the reference slice labels. */
export function breakdownOptions(filter: Pick<FilterState, 'entity'>, reference: ReferenceData): string[] {
  return breakdownKeys(filter.entity).map((key) => {
    switch (key) {
      case 'region':
        return 'Region';
      case 'entity':
        return 'Company';
      default:
        return reference.slices[filter.entity === 'G' ? 'P' : filter.entity][key].label;
    }
  });
}

const pct = (v: number | null, plus = false) => fmtPct(v === null ? null : v * 100, plus);

/** Built from the selection (parity rule 13; PV-02: every Profitability panel is at constant currency): "Constant currency (FY2026 budget rates) - USD m - vs Budget". */
export function profitabilitySubtitle(filter: FilterState): string {
  const parts = [`Constant currency (FY${filter.fiscalYear} budget rates)`, `${filter.currency} ${filter.units}`, `vs ${VERSION_SHORT[bridgeComparison(filter)]}`];
  if (filter.entity !== 'G') parts.push('opex booked by region, allocated for other breakdowns');
  return parts.join(' - ');
}

/** Q5 rows → the eight-column table (members by NR, the total last). */
export function mapProfitability(table: QueryTable, filter: FilterState, reference: ReferenceData): Profitability {
  const read = reader(table, PROFITABILITY_REQUIRED);
  const options = breakdownOptions(filter, reference);
  const column = options[filter.breakdown[filter.entity]] ?? options[0];
  const key = selectedBreakdown(filter);
  const toRow = (row: unknown[]): ProfRow => {
    const code = cellString(read(row, PROFITABILITY_COLUMNS.code));
    const d = cellNumber(read(row, PROFITABILITY_COLUMNS.nrDeltaPct));
    const cmD = cellNumber(read(row, PROFITABILITY_COLUMNS.cmDeltaPp));
    return {
      key: code,
      name: cellString(read(row, PROFITABILITY_COLUMNS.name)),
      nrText: fmtAmount(cellNumber(read(row, PROFITABILITY_COLUMNS.nr)), filter.units),
      nrDeltaText: pct(d, true),
      gm: pct(cellNumber(read(row, PROFITABILITY_COLUMNS.gm))),
      cm: pct(cellNumber(read(row, PROFITABILITY_COLUMNS.cm))),
      cmDeltaText: fmtPp(cmD),
      cmStatus: cmStatus(cmD),
      contributionText: fmtAmount(cellNumber(read(row, PROFITABILITY_COLUMNS.contribution)), filter.units),
      ebitdaText: fmtAmount(cellNumber(read(row, PROFITABILITY_COLUMNS.ebitda)), filter.units),
      total: code === PROFITABILITY_TOTAL_CODE,
    };
  };
  // A blank member (the model's unmatched row) is not a slice; the total goes last.
  const rows = table.rows.map(toRow).filter((r) => r.key !== '');
  const members = rows.filter((r) => !r.total);
  const total = rows.filter((r) => r.total);
  const comparison = VERSION_SHORT[bridgeComparison(filter)];
  return {
    by: column.toLowerCase(),
    column,
    options,
    compareLabel: comparison,
    subtitle: profitabilitySubtitle(filter),
    allocated: key !== 'region' && key !== 'entity',
    rows: [...members, ...total],
    info: {
      ...panelInfo('PROFTABLE', { comparison, entity: filter.entity }),
      values: [
        { label: 'Comparison', value: comparison },
        { label: 'Status dot', value: 'CM Δ on track ±0.3 pp, watch to 1.0 pp, off track beyond, ahead = green' },
      ],
    },
  };
}

const CONCENTRATION_REQUIRED = Object.values(CONCENTRATION_COLUMNS);

/** QC rows → three 100 % bars; regions ordered by their net revenue share. */
export function mapConcentration(table: QueryTable, filter: FilterState): Concentration {
  const read = reader(table, CONCENTRATION_REQUIRED);
  const levels = new Map<string, { label: string; sort: number; shares: Map<string, { label: string; share: number }> }>();
  for (const row of table.rows) {
    const code = cellString(read(row, CONCENTRATION_COLUMNS.level));
    const region = cellString(read(row, CONCENTRATION_COLUMNS.region));
    if (code === '' || region === '') continue;
    const level = levels.get(code) ?? { label: cellString(read(row, CONCENTRATION_COLUMNS.levelLabel)), sort: cellNumber(read(row, CONCENTRATION_COLUMNS.levelSort)) ?? 0, shares: new Map() };
    level.shares.set(region, { label: cellString(read(row, CONCENTRATION_COLUMNS.regionName)), share: cellNumber(read(row, CONCENTRATION_COLUMNS.share)) ?? 0 });
    levels.set(code, level);
  }
  const nr = levels.get('NR');
  const regions = [...(nr?.shares.entries() ?? [])].sort((a, b) => b[1].share - a[1].share).map(([key, s]) => ({ key, label: s.label }));
  const shareOf = (level: string, region: string) => levels.get(level)?.shares.get(region)?.share ?? 0;
  return {
    levels: [...levels.entries()]
      .sort((a, b) => a[1].sort - b[1].sort)
      .map(([code, l]) => ({
        code,
        label: l.label,
        segments: regions.map((r) => ({ key: r.key, label: r.label, share: shareOf(code, r.key), text: fmtPct(shareOf(code, r.key) * 100) })),
      })),
    legend: regions.map((r) => ({
      key: r.key,
      label: r.label,
      drift: `${fmtPct(shareOf('NR', r.key) * 100)} → ${fmtPct(shareOf('EBITDA', r.key) * 100)} (${fmtPp((shareOf('EBITDA', r.key) - shareOf('NR', r.key)) * 100)})`,
    })),
    info: {
      ...panelInfo('CONC', { comparison: VERSION_SHORT[bridgeComparison(filter)], entity: filter.entity }),
      values: regions.map((r) => ({ label: r.label, value: `${fmtPct(shareOf('NR', r.key) * 100)} / ${fmtPct(shareOf('CM', r.key) * 100)} / ${fmtPct(shareOf('EBITDA', r.key) * 100)}` })),
    },
  };
}

const BUBBLE_REQUIRED = Object.values(BUBBLE_COLUMNS);

/** QB rows → the growth × margin points and the company reference lines; no trails until the model has a prior-year growth per region. */
export function mapBubble(table: QueryTable, filter: FilterState): Bubble {
  const read = reader(table, BUBBLE_REQUIRED);
  const money = (v: number | null) => fmtMoney(v, filter.units, filter.currency);
  let ref: Bubble['ref'] = null;
  const points: BubblePoint[] = [];
  for (const row of table.rows) {
    const code = cellString(read(row, BUBBLE_COLUMNS.region));
    const growth = cellNumber(read(row, BUBBLE_COLUMNS.growth));
    const cm = cellNumber(read(row, BUBBLE_COLUMNS.cm));
    const nr = cellNumber(read(row, BUBBLE_COLUMNS.nr));
    if (code === BUBBLE_COMPANY_CODE) {
      ref = growth === null || cm === null ? null : { x: growth, y: cm, xText: `company ${pct(growth, true)}`, yText: `company ${pct(cm)}` };
      continue;
    }
    if (code === '' || growth === null || cm === null) continue;
    const label = cellString(read(row, BUBBLE_COLUMNS.regionName));
    points.push({
      key: code,
      label,
      x: growth,
      y: cm,
      size: Math.max(0, nr ?? 0),
      text: `CM ${pct(cm)} - ${pct(growth, true)}`,
      detail: `${label}: NR ${money(nr)}, growth ${pct(growth, true)}, CM ${pct(cm)}`,
      trail: null,
    });
  }
  return {
    points: points.sort((a, b) => b.size - a.size),
    ref,
    quadrants: ['profitable, slower', 'profitable growth', 'problem', 'dilutive growth'],
    info: {
      ...panelInfo('BUBBLE', { comparison: VERSION_SHORT[bridgeComparison(filter)], entity: filter.entity }),
      values: [
        { label: 'Company growth', value: ref ? pct(ref.x, true) : 'n/a' },
        { label: 'Company CM %', value: ref ? pct(ref.y) : 'n/a' },
        { label: 'Prior-year trails', value: 'n/a: no per-region prior-year growth measure in the model yet (C-04)' },
      ],
    },
  };
}

const HEAT_REQUIRED = Object.values(HEAT_COLUMNS);

/** QH rows → the region × service line matrix with row, column and grand totals; the fill follows the column's GM % (PV-03). */
export function mapHeat(table: QueryTable, filter: FilterState): Heat {
  const read = reader(table, HEAT_REQUIRED);
  const amount = (v: number | null) => fmtAmount(v, filter.units);
  interface Cell {
    nr: number | null;
    gm: number | null;
  }
  const cells = new Map<string, Cell>();
  const regions = new Map<string, string>();
  const lines = new Map<string, { label: string; sort: number }>();
  for (const row of table.rows) {
    const region = cellString(read(row, HEAT_COLUMNS.region));
    const line = cellString(read(row, HEAT_COLUMNS.line));
    cells.set(`${region}|${line}`, { nr: cellNumber(read(row, HEAT_COLUMNS.nr)), gm: cellNumber(read(row, HEAT_COLUMNS.gm)) });
    if (region !== '') regions.set(region, cellString(read(row, HEAT_COLUMNS.regionName)));
    if (line !== '' && !lines.has(line)) lines.set(line, { label: cellString(read(row, HEAT_COLUMNS.lineName)), sort: cellNumber(read(row, HEAT_COLUMNS.lineSort)) ?? 0 });
  }
  const cell = (region: string, line: string): Cell => cells.get(`${region}|${line}`) ?? { nr: null, gm: null };
  const regionOrder = [...regions.keys()].sort((a, b) => (cell(b, '').nr ?? 0) - (cell(a, '').nr ?? 0));
  const lineOrder = [...lines.entries()].sort((a, b) => a[1].sort - b[1].sort || a[0].localeCompare(b[0]));
  const share = (nr: number | null, total: number | null) => (nr === null || total === null || total === 0 ? '' : `${Math.round((nr / total) * 100)}%`);
  return {
    rows: regionOrder.map((r) => {
      const total = cell(r, '').nr;
      return {
        key: r,
        label: regions.get(r) ?? r,
        cells: lineOrder.map(([l, meta]) => {
          const c = cell(r, l);
          return {
            text: amount(c.nr),
            share: share(c.nr, total),
            gm: c.gm,
            detail: `${regions.get(r) ?? r} × ${meta.label}: NR ${amount(c.nr)} ${filter.units}, ${share(c.nr, total) || 'n/a'} of the region, GM ${pct(c.gm)}`,
          };
        }),
        total: amount(total),
      };
    }),
    cols: lineOrder.map(([l, meta]) => ({ key: l, label: meta.label, gm: cell('', l).gm, gmText: `GM ${pct(cell('', l).gm)}`, total: amount(cell('', l).nr) })),
    grand: amount(cell('', '').nr),
    info: {
      ...panelInfo('HEAT', { comparison: VERSION_SHORT[bridgeComparison(filter)], entity: filter.entity }),
      values: lineOrder.map(([l, meta]) => ({ label: meta.label, value: `NR ${amount(cell('', l).nr)} ${filter.units}, GM ${pct(cell('', l).gm)}` })),
    },
  };
}

// ---------------------------------------------------------------------------
// Context strip (C-50, N-02).

export interface ContextZone {
  dataStatus: string;
  /** `_meta_refresh[refreshed_at]` as the connector returns it (ISO-like text); null when absent. */
  refreshedAt: string | null;
  notices: string[];
  profitabilityNote: string;
  cmAverage: number | null;
}

/** `@refreshed` is optional so a result without it (older probe captures) still maps. */
const CONTEXT_REQUIRED = [CONTEXT_COLUMNS.status, CONTEXT_COLUMNS.notices, CONTEXT_COLUMNS.profNote, CONTEXT_COLUMNS.cmPct];

/** Q6 row → header status, the refresh timestamp, the model's notices (split), the profitability note and the CM average. */
export function mapContext(table: QueryTable): ContextZone {
  if (table.rows.length !== 1) throw new PnlModelError('query', `Context: expected one row, got ${table.rows.length}`);
  const read = reader(table, CONTEXT_REQUIRED);
  const row = table.rows[0];
  const refreshed = cellString(read(row, CONTEXT_COLUMNS.refreshed));
  return {
    dataStatus: cellString(read(row, CONTEXT_COLUMNS.status)),
    refreshedAt: refreshed.length > 0 ? refreshed : null,
    notices: cellString(read(row, CONTEXT_COLUMNS.notices))
      .split(NOTICE_SEPARATOR)
      .map((n) => n.trim())
      .filter((n) => n.length > 0),
    profitabilityNote: cellString(read(row, CONTEXT_COLUMNS.profNote)),
    cmAverage: cellNumber(read(row, CONTEXT_COLUMNS.cmPct)),
  };
}
