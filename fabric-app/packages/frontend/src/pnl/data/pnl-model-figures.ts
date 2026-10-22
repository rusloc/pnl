// Live figures (ADR-0006 phase 2): the model's result tables → the typed zone
// shapes the views render. The model owns every §7 rule and every number here;
// this file reshapes rows, applies display units / signs / formats (F-14 … F-16,
// N-06) and derives favourable / unfavourable from the sign the model returns.
// Amounts arrive in millions (param_units pinned to M), ratios as fractions
// (0.494 → 49.4 %); KPI Δ are derived from the value / comparison pairs with the
// model's `KPI Δ *` rule (`model/derive.ts`, ADR-0006 §16).
import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';

import { VERSION_SHORT } from '../model/filters';
import { bridgeGeometry, type BridgeInput } from '../model/bridge-geometry';
import { type BetterWhen, compareBar } from '../model/compare-bar';
import { kpiDelta } from '../model/derive';
import { CURRENCY_SYMBOL, fmtAmount, fmtAmountUnits, fmtInt, fmtPct, fmtPp, roundTo, toneOf } from '../model/format';
import type {
  Bridge,
  CompareVersion,
  Driver,
  FilterState,
  KpiCompare,
  KpiTile,
  Profitability,
  ProfitabilityRow,
  ReferenceData,
  Tone,
} from '../model/types';
import { cellNumber, cellString, indexColumns, PnlModelError } from './pnl-model-client';
import {
  BRIDGE_COLUMNS,
  BRIDGE_END_CODE,
  breakdownKeys,
  CONTEXT_COLUMNS,
  DRIVER_COLUMNS,
  DRIVER_TOP,
  KPI_META_COLUMNS,
  kpiAliases,
  NOTICE_SEPARATOR,
  PROFITABILITY_COLUMNS,
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

/**
 * The comparison the model's bridge measures use when the analysis toolbar does
 * not override it (C-40: Compare A, else Compare B, else prior year).
 */
export function bridgeComparison(filter: Pick<FilterState, 'compareA' | 'compareB'>): Exclude<CompareVersion, 'NONE'> {
  if (filter.compareA !== 'NONE') return filter.compareA;
  if (filter.compareB !== 'NONE') return filter.compareB;
  return 'PY';
}

// ---------------------------------------------------------------------------
// KPI tiles (§5, K-20 … K-23).

export interface KpiMeta {
  slot: number;
  code: string;
  label: string;
  group: 'Financial' | 'Operational';
  betterWhen: BetterWhen;
  valueType: string;
  definition: string;
}

const KPI_META_REQUIRED = Object.values(KPI_META_COLUMNS);

/** Q2a rows → the entity's slots in slot order. */
export function mapKpiMeta(table: QueryTable): KpiMeta[] {
  const read = reader(table, KPI_META_REQUIRED);
  const rows = table.rows.map((row): KpiMeta => {
    const group = cellString(read(row, KPI_META_COLUMNS.group));
    const betterWhen = cellString(read(row, KPI_META_COLUMNS.betterWhen));
    if (group !== 'Financial' && group !== 'Operational') throw new PnlModelError('query', `Unknown dim_kpi.kpi_group: ${group}`);
    if (betterWhen !== 'Higher' && betterWhen !== 'Lower' && betterWhen !== 'Neutral') {
      throw new PnlModelError('query', `Unknown dim_kpi.better_when: ${betterWhen}`);
    }
    return {
      slot: cellNumber(read(row, KPI_META_COLUMNS.slot)) ?? 0,
      code: cellString(read(row, KPI_META_COLUMNS.code)),
      label: cellString(read(row, KPI_META_COLUMNS.label)),
      group,
      betterWhen,
      valueType: cellString(read(row, KPI_META_COLUMNS.valueType)),
      definition: cellString(read(row, KPI_META_COLUMNS.definition)),
    };
  });
  return rows.sort((a, b) => a.slot - b.slot);
}

/** KPIs that are themselves a change vs prior year; their tiles carry no comparison rows (K-20, kpi-card-v2). */
const GROWTH_KPIS: ReadonlySet<string> = new Set(['ORG_GROWTH', 'VOL_GROWTH', 'PRICE_MIX']);

/** Tile value text by dim_kpi.value_type (N-06; the model's own format-string families). */
export function kpiValueText(value: number | null, valueType: string, filter: Pick<FilterState, 'units' | 'currency'>, growth: boolean): string {
  if (value === null) return 'n/a';
  const symbol = CURRENCY_SYMBOL[filter.currency];
  switch (valueType) {
    case 'AMT':
      return `${symbol}${fmtAmountUnits(value, filter.units)}`;
    case 'CNT':
      return fmtAmountUnits(value, filter.units);
    case 'INT':
      return fmtInt(value);
    case 'PRICE':
      return `${symbol}${price(value)}`;
    case 'PCT2':
      return fmtPct(value * 100, growth, 2);
    case 'PCT':
    default:
      return fmtPct(value * 100, growth);
  }
}

/** Two-decimal price with thousands separators (8.0948 → "8.09"). */
function price(value: number): string {
  const r = roundTo(value, 2);
  const [int, frac] = Math.abs(r).toFixed(2).split('.');
  return `${r < 0 ? '−' : ''}${int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}.${frac}`;
}

/** Δ text by value type: percent KPIs in pp, amount KPIs in % (K-20). */
function kpiDeltaText(delta: number | null, valueType: string): string {
  return isPercentKpi(valueType) ? fmtPp(delta) : fmtPct(delta === null ? null : delta * 100, true);
}

/** `dim_kpi.value_type` of the percent KPIs: Δ in pp (the test the model's `KPI Δ *` make). */
function isPercentKpi(valueType: string): boolean {
  return valueType === 'PCT' || valueType === 'PCT2';
}

/** Δ colour follows better_when (K-21); neutral KPIs are never coloured. */
function kpiTone(delta: number | null, betterWhen: KpiMeta['betterWhen'], valueType: string): Tone {
  if (betterWhen === 'Neutral') return 'neutral';
  const decimals = valueType === 'PCT' || valueType === 'PCT2' ? 1 : 3;
  const t = toneOf(delta, decimals);
  if (betterWhen === 'Lower') return t === 'fav' ? 'unf' : t === 'unf' ? 'fav' : 'neutral';
  return t;
}

export interface KpiZone {
  financial: KpiTile[];
  operational: KpiTile[];
}

/** Q2a metadata + Q2b value rows (one table per chunk) → the two tile rows. */
export function mapKpiTiles(meta: readonly KpiMeta[], values: readonly QueryTable[], filter: FilterState): KpiZone {
  // One flat (alias → value) map across the chunk results.
  const cells = new Map<string, unknown>();
  for (const table of values) {
    if (table.rows.length !== 1) throw new PnlModelError('query', `KPI values: expected one row, got ${table.rows.length}`);
    for (const [name, i] of indexColumns(table, [])) cells.set(name, table.rows[0][i]);
  }
  const tiles = meta.map((m): KpiTile & { group: KpiMeta['group'] } => {
    const a = kpiAliases(m.code);
    const compares = ([[filter.compareA, a.cmpA], [filter.compareB, a.cmpB]] as const).filter(([version]) => version !== 'NONE');
    for (const alias of [a.value, a.secondary, ...compares.map(([, alias]) => alias)]) {
      if (!cells.has(alias)) throw new PnlModelError('query', `KPI values: missing column ${alias}`);
    }
    const growth = GROWTH_KPIS.has(m.code);
    const value = cellNumber(cells.get(a.value));
    const percent = isPercentKpi(m.valueType);
    const secondary = cellString(cells.get(a.secondary));
    // The comparison rows carry the derived KPI Δ as text and as a bar on the shared scale; growth KPIs have none.
    const rows: KpiCompare[] = growth
      ? []
      : compares.map(([version, alias]): KpiCompare => {
          const d = kpiDelta(value, cellNumber(cells.get(alias)), percent, false);
          return {
            name: compareName(version),
            text: d === null ? 'n/a' : kpiDeltaText(d, m.valueType),
            tone: kpiTone(d, m.betterWhen, m.valueType),
            bar: compareBar(d, percent, m.betterWhen),
          };
        });
    return {
      code: m.code,
      label: m.label,
      hint: m.definition,
      value: kpiValueText(value, m.valueType, filter, growth),
      sublines: secondary === '' ? [] : [secondary],
      compares: rows,
      group: m.group,
    };
  });
  const strip = ({ group: _g, ...tile }: KpiTile & { group: KpiMeta['group'] }): KpiTile => {
    void _g;
    return tile;
  };
  return {
    financial: tiles.filter((t) => t.group === 'Financial').map(strip),
    operational: tiles.filter((t) => t.group === 'Operational').map(strip),
  };
}

// ---------------------------------------------------------------------------
// Net revenue bridge (C-40, §6.3).

const BRIDGE_REQUIRED = Object.values(BRIDGE_COLUMNS);

/** Q3 rows → the bridge: comparison total, the model's steps, base total; geometry from bridge-geometry.ts. */
export function mapBridge(table: QueryTable, filter: FilterState): Bridge {
  const read = reader(table, BRIDGE_REQUIRED);
  const rows = table.rows
    .map((row) => ({
      code: cellString(read(row, BRIDGE_COLUMNS.code)),
      label: cellString(read(row, BRIDGE_COLUMNS.label)),
      sort: cellNumber(read(row, BRIDGE_COLUMNS.sort)) ?? 0,
      value: cellNumber(read(row, BRIDGE_COLUMNS.value)),
    }))
    .sort((a, b) => a.sort - b.sort);
  const comparison = VERSION_SHORT[filter.analysisCompare];
  const base = VERSION_SHORT[filter.baseVersion];
  const input: BridgeInput[] = rows.map((r) => {
    if (r.code === 'START') return { label: comparison, amount: r.value ?? 0, kind: 'total' };
    if (r.code === BRIDGE_END_CODE) return { label: base, amount: r.value ?? 0, kind: 'total' };
    return { label: r.label, amount: r.value ?? 0, kind: 'step' };
  });
  if (input.length < 2 || input[0].kind !== 'total' || input[input.length - 1].kind !== 'total') {
    throw new PnlModelError('query', 'Bridge result has no comparison or base total');
  }
  const symbol = CURRENCY_SYMBOL[filter.currency];
  const geometry = bridgeGeometry(input, (amount, kind) =>
    kind === 'total' ? `${symbol}${fmtAmountUnits(amount, filter.units)}` : fmtAmount(amount, filter.units, true)
  );
  const axisUnits = filter.units === 'm' ? geometry.axis : geometry.axis * 1000;
  return {
    subtitle: bridgeMethod(filter.entity),
    steps: geometry.steps,
    axisText: `${symbol}${fmtInt(axisUnits)}${filter.units}`,
  };
}

/** Method note under the bridge title (design §6.3), by entity. */
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

// ---------------------------------------------------------------------------
// Largest variances (C-45).

const DRIVER_REQUIRED = Object.values(DRIVER_COLUMNS);

/** Q4 rows → the top 8 drivers in |Δ| order. */
export function mapDrivers(table: QueryTable, filter: FilterState): Driver[] {
  const read = reader(table, DRIVER_REQUIRED);
  return table.rows
    .map((row) => {
      const d = cellNumber(read(row, DRIVER_COLUMNS.d));
      const dPct = cellNumber(read(row, DRIVER_COLUMNS.dPct));
      return {
        name: cellString(read(row, DRIVER_COLUMNS.accountLabel)),
        block: cellString(read(row, DRIVER_COLUMNS.lineLabel)),
        delta: d ?? 0,
        deltaText: fmtAmount(d, filter.units, true),
        deltaPctText: fmtPct(dPct === null ? null : dPct * 100, true),
        tone: toneOf(d, filter.units === 'k' ? 3 : 1),
        absD: cellNumber(read(row, DRIVER_COLUMNS.absD)) ?? 0,
      };
    })
    .sort((a, b) => b.absD - a.absD)
    .slice(0, DRIVER_TOP)
    .map(({ absD: _a, ...driver }) => {
      void _a;
      return driver;
    });
}

// ---------------------------------------------------------------------------
// Profitability by slice (C-46).

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

/** Q5 rows + the company-average CM % (Q6) → the profitability table and bar chart. */
export function mapProfitability(table: QueryTable, cmAverage: number | null, note: string, filter: FilterState, reference: ReferenceData): Profitability {
  const read = reader(table, PROFITABILITY_REQUIRED);
  const options = breakdownOptions(filter, reference);
  const column = options[filter.breakdown[filter.entity]] ?? options[0];
  // A blank member (the model's unmatched row) carries `Slice Member In View` = 1 in the Group view; it is not a slice.
  const members = table.rows.filter((row) => cellString(read(row, PROFITABILITY_COLUMNS.code)) !== '');
  const rows: ProfitabilityRow[] = members.map((row) => {
    const d = cellNumber(read(row, PROFITABILITY_COLUMNS.nrDeltaPct));
    const share = cellNumber(read(row, PROFITABILITY_COLUMNS.share));
    return {
      name: cellString(read(row, PROFITABILITY_COLUMNS.name)),
      nrText: fmtAmount(cellNumber(read(row, PROFITABILITY_COLUMNS.nr)), filter.units),
      shareText: pct(share),
      sharePct: share === null ? 0 : Math.max(0, Math.min(100, share * 100)),
      deltaPctText: pct(d, true),
      tone: toneOf(d === null ? null : d * 100),
      gm: pct(cellNumber(read(row, PROFITABILITY_COLUMNS.gm))),
      cm: pct(cellNumber(read(row, PROFITABILITY_COLUMNS.cm))),
      ebitda: pct(cellNumber(read(row, PROFITABILITY_COLUMNS.ebitda))),
      op: pct(cellNumber(read(row, PROFITABILITY_COLUMNS.op))),
    };
  });
  return {
    by: column.toLowerCase(),
    column,
    options,
    compareLabel: VERSION_SHORT[bridgeComparison(filter)],
    note,
    rows,
    cmAverageText: pct(cmAverage),
    cmAveragePct: cmAverage === null ? 0 : cmAverage * 100,
  };
}

// ---------------------------------------------------------------------------
// Context strip (C-50, N-02).

export interface ContextZone {
  dataStatus: string;
  notices: string[];
  profitabilityNote: string;
  cmAverage: number | null;
}

const CONTEXT_REQUIRED = Object.values(CONTEXT_COLUMNS);

/** Q6 row → header status, the model's notices (split), the profitability note and the CM average. */
export function mapContext(table: QueryTable): ContextZone {
  if (table.rows.length !== 1) throw new PnlModelError('query', `Context: expected one row, got ${table.rows.length}`);
  const read = reader(table, CONTEXT_REQUIRED);
  const row = table.rows[0];
  return {
    dataStatus: cellString(read(row, CONTEXT_COLUMNS.status)),
    notices: cellString(read(row, CONTEXT_COLUMNS.notices))
      .split(NOTICE_SEPARATOR)
      .map((n) => n.trim())
      .filter((n) => n.length > 0),
    profitabilityNote: cellString(read(row, CONTEXT_COLUMNS.profNote)),
    cmAverage: cellNumber(read(row, CONTEXT_COLUMNS.cmPct)),
  };
}
