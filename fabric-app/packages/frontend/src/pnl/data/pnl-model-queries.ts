// DAX for the `pnlModel` semantic-model connector (ADR-0006 §8). Pure, allow-listed
// builders: every value that reaches the DAX text is either a fixed code from the
// maps below, an integer that passed a range check, or a code that exists in the
// reference data. No user text is ever concatenated into a query. Every §7 rule
// lives in the model's measures; these queries only choose rows and measures.
import type {
  BaseVersion,
  CompareVersion,
  Currency,
  EntityCode,
  FilterState,
  FxBasis,
  OperatingEntity,
  ReferenceData,
  SliceSlot,
  TimeView,
} from '../model/types';

/** A filter value that is not in the allow-list; raised before any query is sent. */
export class PnlQueryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PnlQueryError';
  }
}

// App enums → model parameter codes (param_* tables in the Track B model).
const ENTITY_VIEW: Record<EntityCode, string> = { P: 'P', S: 'S', G: 'GROUP' };
const TIME_VIEW: Record<TimeView, string> = { month: 'MTD', qtd: 'QTD', ytd: 'YTD', ltm: 'LTM', fy: 'FY' };
const BASE_VERSION: Record<BaseVersion, string> = { ACT: 'A', LE: 'LE', BUD: 'B' };
const COMPARE_VERSION: Record<CompareVersion, string> = { BUD: 'B', LE: 'LE', PY: 'PY', NONE: 'NONE' };
const CURRENCY: Record<Currency, string> = { USD: 'USD', EUR: 'EUR', GBP: 'GBP' };
const FX_BASIS: Record<FxBasis, string> = { actual: 'ACT', constant: 'CC' };
/** Units are pinned so the display measures arrive in millions; F-14 is applied in TypeScript. */
const UNITS_CODE = 'M';

/**
 * Slice filters go on the *name* columns, like Track B's slicers: the model's
 * `Notices` / `Context Line` detect an active slice with ISFILTERED on them.
 */
const SLICE_NAME_COLUMN: Record<SliceSlot, string> = {
  channel: 'dim_channel[channel_name]',
  line: 'dim_line[line_name]',
  segment: 'dim_segment[segment_name]',
};

/** Breakdown columns (F-21) the profitability query may group by: [code column, name column]. */
export const BREAKDOWN_COLUMNS = {
  region: ['dim_region[region_code]', 'dim_region[region_name]'],
  channel: ['dim_channel[channel_code]', 'dim_channel[channel_name]'],
  line: ['dim_line[line_code]', 'dim_line[line_name]'],
  segment: ['dim_segment[segment_code]', 'dim_segment[segment_name]'],
  entity: ['dim_entity[entity_code]', 'dim_entity[short_name]'],
} as const;

export type BreakdownKey = keyof typeof BREAKDOWN_COLUMNS;

/** Breakdown options per entity in toolbar order (F-21); index = `FilterState.breakdown[entity]`. */
export function breakdownKeys(entity: EntityCode): readonly BreakdownKey[] {
  return entity === 'G' ? ['region', 'entity'] : ['region', 'channel', 'line', 'segment'];
}

function pick<K extends string>(map: Record<K, string>, key: K, what: string): string {
  const value = Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
  if (value === undefined) throw new PnlQueryError(`Unknown ${what}: ${String(key)}`);
  return value;
}

/** DAX string literal for an allow-listed code or reference name (quotes doubled, control characters refused). */
export function daxString(code: string): string {
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(code)) throw new PnlQueryError('Control character in code');
  return `"${code.replace(/"/g, '""')}"`;
}

function daxInt(value: number, what: string, min: number, max: number): string {
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new PnlQueryError(`${what} out of range: ${String(value)}`);
  }
  return String(value);
}

function treatas(literals: readonly string[], column: string): string {
  return `TREATAS ( { ${literals.join(', ')} }, ${column} )`;
}

/** Reference names for a selection of codes; every code must exist in the allowed set. */
function namesFor(selected: readonly string[], allowed: ReadonlyMap<string, string>, what: string): string[] {
  const unique = [...new Set(selected)];
  if (unique.length === 0) throw new PnlQueryError(`Empty ${what} selection`);
  return unique.map((code) => {
    const name = allowed.get(code);
    if (name === undefined) throw new PnlQueryError(`Unknown ${what} code: ${code}`);
    return daxString(name);
  });
}

interface FilterVar {
  name: string;
  expression: string;
}

/**
 * The common filter block (ADR-0006 §8.1): one table variable per filter; "All"
 * selections emit nothing; slices are omitted for Group (F-32). Codes are
 * validated against the reference data and emitted as the model's name values.
 * Every zone sends the same block: the analysis zones take the model's bridge
 * comparison (Compare A, else B, else Prior year; C-40, parity rule 1).
 */
export function filterVars(filter: FilterState, reference: ReferenceData): FilterVar[] {
  const fiscalYears = new Set(reference.months.map((m) => m.fiscalYear));
  if (!fiscalYears.has(filter.fiscalYear)) {
    throw new PnlQueryError(`Fiscal year not in the reference data: ${String(filter.fiscalYear)}`);
  }
  const vars: FilterVar[] = [
    { name: '_entity', expression: treatas([daxString(pick(ENTITY_VIEW, filter.entity, 'entity'))], 'param_entity_view[entity_view_code]') },
    { name: '_fy', expression: treatas([daxInt(filter.fiscalYear, 'Fiscal year', 1900, 2999)], 'param_fiscal_year[fiscal_year]') },
    { name: '_month', expression: treatas([daxInt(filter.month, 'Month', 1, 12)], 'param_period[month_number]') },
    { name: '_tv', expression: treatas([daxString(pick(TIME_VIEW, filter.timeView, 'time view'))], 'param_time_view[time_view_code]') },
    { name: '_base', expression: treatas([daxString(pick(BASE_VERSION, filter.baseVersion, 'base version'))], 'param_base_version[choice_code]') },
    { name: '_cmp_a', expression: treatas([daxString(pick(COMPARE_VERSION, filter.compareA, 'Compare A'))], 'param_compare_a[choice_code]') },
    { name: '_cmp_b', expression: treatas([daxString(pick(COMPARE_VERSION, filter.compareB, 'Compare B'))], 'param_compare_b[choice_code]') },
    { name: '_ccy', expression: treatas([daxString(pick(CURRENCY, filter.currency, 'currency'))], 'param_reporting_currency[currency_code]') },
    { name: '_fx', expression: treatas([daxString(pick(FX_BASIS, filter.fxBasis, 'FX basis'))], 'param_fx_basis[fx_basis_code]') },
    { name: '_units', expression: treatas([daxString(UNITS_CODE)], 'param_units[units_code]') },
  ];
  if (filter.regions !== null) {
    const allowed = new Map(reference.regions.map((r) => [r.code, r.name]));
    vars.push({ name: '_regions', expression: treatas(namesFor(filter.regions, allowed, 'region'), 'dim_region[region_name]') });
  }
  if (filter.entity !== 'G') {
    const entity: OperatingEntity = filter.entity;
    const slices = filter.slices[entity];
    for (const slot of ['channel', 'line', 'segment'] as const) {
      const selected = slices[slot];
      if (selected === null) continue;
      const allowed = new Map(reference.slices[entity][slot].values.map((v) => [v.code, v.name]));
      vars.push({ name: `_${slot}s`, expression: treatas(namesFor(selected, allowed, slot), SLICE_NAME_COLUMN[slot]) });
    }
  }
  return vars;
}

/** `DEFINE` + one `VAR` per filter, aligned. */
function defineBlock(vars: readonly FilterVar[]): string[] {
  const pad = Math.max(...vars.map((v) => v.name.length)) + 1;
  return ['DEFINE', ...vars.map((v) => `    VAR ${v.name.padEnd(pad)}= ${v.expression}`)];
}

function varList(vars: readonly FilterVar[]): string {
  return vars.map((v) => v.name).join(', ');
}

/** `"@alias", CONVERT ( [Measure], DOUBLE )` — every number is read as a double (ADR-0006 §3.18). */
function num(alias: string, expression: string): string {
  return `"${alias}", CONVERT ( ${expression}, DOUBLE )`;
}

// ---------------------------------------------------------------------------
// Q0 — visible entities (RLS probe, once per session).

export const VISIBLE_ENTITIES_QUERY = 'EVALUATE\nVALUES ( dim_entity[entity_code] )';
export const VISIBLE_ENTITIES_LIMIT = 10;

// ---------------------------------------------------------------------------
// Q1 — the statement.

/** Result column names (as the mapper reads them, table prefix / alias brackets stripped). */
export const STATEMENT_COLUMNS = {
  rowKey: 'row_key',
  lineCode: 'line_code',
  lineLabel: 'line_label',
  rowType: 'row_type',
  isKey: 'is_key',
  tag: 'tag',
  accountCode: 'account_code',
  accountLabel: 'account_label',
  isLeaf: 'is_leaf',
  lineSort: 'line_sort',
  accountSort: 'account_sort',
  base: '@base',
  cmpA: '@cmp_a',
  cmpB: '@cmp_b',
  fyBud: '@fy_bud',
  fyLe: '@fy_le',
} as const;

export const STATEMENT_LIMIT = 500;

const ROW_COLUMNS = [
  'row_key',
  'line_code',
  'line_label',
  'row_type',
  'is_key',
  'tag',
  'account_code',
  'account_label',
  'is_leaf',
  'line_sort',
  'account_sort',
] as const;

/**
 * Statement level measures (`1 Statement` folder): already in the pinned units for
 * amount rows, raw ratios on ratio rows. Only these five are fetched; Δ, Δ % and % NR
 * are derived in the app (`model/derive.ts`, ADR-0006 §16) — the model's `PL Δ *` /
 * `PL % NR` re-evaluate their inputs, so asking for them roughly quadrupled the
 * engine work per row. They return Number, but every amount is still wrapped in
 * CONVERT ( …, DOUBLE ) in case a measure goes Fixed Decimal.
 */
const STATEMENT_MEASURES: readonly [alias: string, measure: string][] = [
  ['@base', 'PL Base'],
  ['@cmp_a', 'PL Compare A'],
  ['@cmp_b', 'PL Compare B'],
  ['@fy_bud', 'PL FY Budget'],
  ['@fy_le', 'PL FY LE'],
];

/** Columns the line part does not group by: the statement measures test `ISINSCOPE ( dim_pl_row[account_label] )`. */
const LEAF_ONLY_COLUMNS: ReadonlySet<string> = new Set(['account_code', 'account_label', 'is_leaf', 'account_sort']);

/** Constant value a line row carries for a leaf-only column. */
const LINE_CONSTANT: Record<string, string> = {
  account_code: '""',
  account_label: '""',
  is_leaf: 'FALSE ()',
  account_sort: '0',
};

/**
 * One half of Q1: SUMMARIZECOLUMNS over dim_pl_row filtered to lines or leaves,
 * projected onto the same 22 column names so the two halves UNION. Lines must not
 * group by the account columns: the `1 Statement` measures treat a row with
 * `account_label` in scope as a leaf, which drops every line, subtotal and ratio row.
 */
function statementPart(leaves: boolean, vars: readonly FilterVar[], indent: string): string[] {
  const groupBy = leaves ? ROW_COLUMNS : ROW_COLUMNS.filter((c) => !LEAF_ONLY_COLUMNS.has(c));
  const i1 = `${indent}    `;
  const i2 = `${indent}        `;
  return [
    `${indent}SELECTCOLUMNS (`,
    `${i1}SUMMARIZECOLUMNS (`,
    ...groupBy.map((c, i) => `${i2}${i === 0 ? '' : ','}dim_pl_row[${c}]`),
    `${i2},TREATAS ( { ${leaves ? 'TRUE ()' : 'FALSE ()'} }, dim_pl_row[is_leaf] )`,
    ...vars.map((v) => `${i2},${v.name}`),
    ...STATEMENT_MEASURES.map(([alias, measure]) => `${i2},${num(alias, `[${measure}]`)}`),
    `${i1})`,
    ...ROW_COLUMNS.map((c) => `${i1},"${c}", ${!leaves && LEAF_ONLY_COLUMNS.has(c) ? LINE_CONSTANT[c] : `dim_pl_row[${c}]`}`),
    ...STATEMENT_MEASURES.map(([alias]) => `${i1},"${alias}", [${alias}]`),
    `${indent})`,
  ];
}

/** Q1 — the statement (ADR-0006 §8.2, §16): one row per dim_pl_row line or account, lines first within each line_sort; level columns only. */
export function buildStatementQuery(filter: FilterState, reference: ReferenceData): string {
  const vars = filterVars(filter, reference);
  return [
    ...defineBlock(vars),
    '    VAR _lines =',
    ...statementPart(false, vars, '        '),
    '    VAR _leaves =',
    ...statementPart(true, vars, '        '),
    'EVALUATE',
    'UNION ( _lines, _leaves )',
    'ORDER BY [line_sort], [account_sort]',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// KPI code helpers shared by the Vitals queries (QV, below).

/** Allow-list for a `kpi_code` before it becomes a DAX literal: the model's codes are `[A-Z0-9_]+`. */
export function kpiCodeLiteral(code: string): string {
  if (!/^[A-Z0-9_]{1,32}$/.test(code)) throw new PnlQueryError(`Unknown KPI code: ${code}`);
  return daxString(code);
}

/** Aliases a KPI values result carries per code: `@<code>`, `@<code>_cmp_a`, `@<code>_cmp_b`, `@<code>_s`; `@<code>_bud` = the value as Budget (Vitals status, PV-01). */
export function kpiAliases(code: string): { value: string; cmpA: string; cmpB: string; secondary: string; budget: string } {
  return { value: `@${code}`, cmpA: `@${code}_cmp_a`, cmpB: `@${code}_cmp_b`, secondary: `@${code}_s`, budget: `@${code}_bud` };
}

/**
 * Evaluate a measure as a comparison with its choice forced (`Bridge Comparison Amount`
 * does the same): `param_eval` CMP_A / CMP_B plus `param_compare_a/b[choice_code]`.
 * Budget for the Vitals status (PV-01), Prior year for the revenue-mix row (PV-04).
 */
function evalAs(slot: 'A' | 'B', choice: 'B' | 'PY'): string {
  const table = slot === 'A' ? 'param_compare_a' : 'param_compare_b';
  return `REMOVEFILTERS ( param_eval ), ${treatas([daxString(`CMP_${slot}`)], 'param_eval[eval_code]')}, REMOVEFILTERS ( ${table} ), ${treatas([daxString(choice)], `${table}[choice_code]`)}`;
}

/** `KPI Value` under the comparison evaluation — the `_compare` of the model's `KPI Δ A` / `KPI Δ B`. */
const KPI_COMPARE_EVAL = { cmpA: 'CMP_A', cmpB: 'CMP_B' } as const;

/**
 * Q2b — values for a chunk of KPI codes in one ROW: `KPI Value` (amounts and counts
 * already divided by the pinned units; ratios as fractions), the same value under
 * `param_eval` CMP_A / CMP_B for each Compare that is not None (the app derives the
 * Δ with the model's `KPI Δ *` rule, `model/derive.ts`, ADR-0006 §16) and the
 * `KPI Secondary` sub-line. One row, (2 + active compares) × chunk columns.
 */
export function buildKpiValuesQuery(filter: FilterState, reference: ReferenceData, codes: readonly string[]): string {
  if (codes.length === 0) throw new PnlQueryError('Empty KPI chunk');
  const vars = filterVars(filter, reference);
  const compares = (['cmpA', 'cmpB'] as const).filter((c) => filter[c === 'cmpA' ? 'compareA' : 'compareB'] !== 'NONE');
  const cols: string[] = [];
  for (const code of codes) {
    const k = treatas([kpiCodeLiteral(code)], 'dim_kpi[kpi_code]');
    const a = kpiAliases(code);
    cols.push(num(a.value, `CALCULATE ( [KPI Value], ${k} )`));
    for (const c of compares) {
      const evalFilter = treatas([daxString(KPI_COMPARE_EVAL[c])], 'param_eval[eval_code]');
      cols.push(num(a[c], `CALCULATE ( [KPI Value], ${k}, REMOVEFILTERS ( param_eval ), ${evalFilter} )`));
    }
    cols.push(`"${a.secondary}", CALCULATE ( [KPI Secondary], ${k} )`);
  }
  return [
    ...defineBlock(vars),
    'EVALUATE',
    'CALCULATETABLE (',
    '    ROW (',
    ...cols.map((c, i) => `        ${i === 0 ? '' : ','}${c}`),
    '    )',
    `    ,${varList(vars)}`,
    ')',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// QV — Vitals (redesign v4, build-brief §1; formerly Key figures, whose Q2a / Q2b
// tile queries were retired 2026-10-27). Two shapes: the entity's Vitals rows of
// dim_kpi (slot 1–10), then the values as scalar CALCULATEs per kpi_code — a
// SUMMARIZECOLUMNS over dim_kpi with `KPI Value` evaluates every branch of the
// model's SWITCH per row and does not finish (LSN-005) — plus the model's
// `KPI Info Sub` text per code for the ⓘ (its own query, so the cards never
// wait for it).

export const VITALS_META_COLUMNS = {
  slot: 'vitals_slot',
  tier: 'vitals_tier',
  code: 'kpi_code',
  label: 'kpi_label',
  betterWhen: 'better_when',
  valueType: 'value_type',
  definition: 'definition',
} as const;

export const VITALS_META_LIMIT = 50;

/** QV1 — the entity's Vitals cards: `dim_kpi` rows with a vitals_slot, no measures. */
export function buildVitalsMetaQuery(entity: EntityCode): string {
  return [
    'EVALUATE',
    `FILTER ( dim_kpi, dim_kpi[entity_view_code] = ${daxString(pick(ENTITY_VIEW, entity, 'entity'))} && dim_kpi[vitals_slot] > 0 )`,
    'ORDER BY dim_kpi[vitals_slot]',
  ].join('\n');
}

/** The FY outlook card compares FY LE with FY Budget on NR and EBITDA, not with Compare A / B (`Vitals Card SVG` `_is_fy`). */
export const FY_OUTLOOK_CODE = 'FY_OUTLOOK';
/** The revenue-mix card shows the subscription and payments shares with their Δ vs prior year in pp (PV-04). */
export const MIX_CODE = 'MIX';

/** Aliases of the revenue-mix card: subscription share, payments share, both as prior year. */
export function mixAliases(): { sub: string; pay: string; subPy: string; payPy: string } {
  return { sub: `@${MIX_CODE}`, pay: `@${MIX_CODE}_pay`, subPy: `@${MIX_CODE}_py`, payPy: `@${MIX_CODE}_pay_py` };
}

/** The alias that carries a card's Budget value: a Compare already set to Budget, else the dedicated `_bud` column. */
export function budgetAlias(filter: Pick<FilterState, 'compareA' | 'compareB'>, code: string): string {
  const a = kpiAliases(code);
  return filter.compareA === 'BUD' ? a.cmpA : filter.compareB === 'BUD' ? a.cmpB : a.budget;
}

/** Aliases of the FY outlook card: value (FY LE NR), FY Budget NR, FY LE EBITDA, FY Budget EBITDA. */
export function fyOutlookAliases(): { value: string; budget: string; ebitda: string; ebitdaBudget: string } {
  return { value: `@${FY_OUTLOOK_CODE}`, budget: `@${FY_OUTLOOK_CODE}_bud`, ebitda: `@${FY_OUTLOOK_CODE}_e`, ebitdaBudget: `@${FY_OUTLOOK_CODE}_e_bud` };
}

/**
 * QV2 — values for a chunk of Vitals codes in one ROW: `KPI Value`, the same
 * under `param_eval` CMP_A / CMP_B for each Compare that is not None (Δ derived
 * in the app with the model's `KPI Δ *` rule) and, unless a Compare is Budget
 * already, the value as Budget for the status chip (vs Budget only, PV-01);
 * the FY outlook card reads its four FY measures, the revenue-mix card its two
 * shares now and as prior year.
 */
export function buildVitalsValuesQuery(filter: FilterState, reference: ReferenceData, codes: readonly string[]): string {
  if (codes.length === 0) throw new PnlQueryError('Empty Vitals chunk');
  const vars = filterVars(filter, reference);
  const compares = (['cmpA', 'cmpB'] as const).filter((c) => filter[c === 'cmpA' ? 'compareA' : 'compareB'] !== 'NONE');
  const cols: string[] = [];
  for (const code of codes) {
    const k = treatas([kpiCodeLiteral(code)], 'dim_kpi[kpi_code]');
    if (code === FY_OUTLOOK_CODE) {
      const f = fyOutlookAliases();
      cols.push(num(f.value, `CALCULATE ( [KPI Value], ${k} )`));
      cols.push(num(f.budget, `CALCULATE ( [KPI FY Budget NR], ${k} )`));
      cols.push(num(f.ebitda, `CALCULATE ( [KPI FY Outlook EBITDA], ${k} )`));
      cols.push(num(f.ebitdaBudget, `CALCULATE ( [KPI FY Budget EBITDA], ${k} )`));
      continue;
    }
    if (code === MIX_CODE) {
      const m = mixAliases();
      cols.push(num(m.sub, `CALCULATE ( [KPI Subscription Share], ${k} )`));
      cols.push(num(m.pay, `CALCULATE ( [KPI Payments Share], ${k} )`));
      cols.push(num(m.subPy, `CALCULATE ( [KPI Subscription Share], ${k}, ${evalAs('B', 'PY')} )`));
      cols.push(num(m.payPy, `CALCULATE ( [KPI Payments Share], ${k}, ${evalAs('B', 'PY')} )`));
      continue;
    }
    const a = kpiAliases(code);
    cols.push(num(a.value, `CALCULATE ( [KPI Value], ${k} )`));
    for (const c of compares) {
      const evalFilter = treatas([daxString(KPI_COMPARE_EVAL[c])], 'param_eval[eval_code]');
      cols.push(num(a[c], `CALCULATE ( [KPI Value], ${k}, REMOVEFILTERS ( param_eval ), ${evalFilter} )`));
    }
    if (budgetAlias(filter, code) === a.budget) cols.push(num(a.budget, `CALCULATE ( [KPI Value], ${k}, ${evalAs('A', 'B')} )`));
  }
  return [...defineBlock(vars), 'EVALUATE', 'CALCULATETABLE (', '    ROW (', ...cols.map((c, i) => `        ${i === 0 ? '' : ','}${c}`), '    )', `    ,${varList(vars)}`, ')'].join('\n');
}

/** Alias of a card's `KPI Info Sub` text. */
export function vitalsInfoAlias(code: string): string {
  return `@${code}_i`;
}

/** QV3 — `KPI Info Sub` per code (the ⓘ sub-metrics line), one ROW. */
export function buildVitalsInfoQuery(filter: FilterState, reference: ReferenceData, codes: readonly string[]): string {
  if (codes.length === 0) throw new PnlQueryError('Empty Vitals chunk');
  const vars = filterVars(filter, reference);
  const cols = codes.map((code) => `"${vitalsInfoAlias(code)}", CALCULATE ( [KPI Info Sub], ${treatas([kpiCodeLiteral(code)], 'dim_kpi[kpi_code]')} )`);
  return [...defineBlock(vars), 'EVALUATE', 'CALCULATETABLE (', '    ROW (', ...cols.map((c, i) => `        ${i === 0 ? '' : ','}${c}`), '    )', `    ,${varList(vars)}`, ')'].join('\n');
}

export const VITALS_VALUES_LIMIT = 5;

// ---------------------------------------------------------------------------
// Q3 — net revenue bridge (C-40, T-05; redesign v4: CC subtotal and END levels).

export const BRIDGE_COLUMNS = { code: 'step_code', label: 'step_label', sort: 'step_sort', delta: '@delta', isTotal: '@is_total' } as const;
export const BRIDGE_LIMIT = 20;
/** The model's level rows of `dim_bridge_step`: START (comparison NR), CC_SUB (constant-currency NR), END (actual NR). */
export const BRIDGE_START_CODE = 'START';
export const BRIDGE_CC_CODE = 'CC_SUB';
export const BRIDGE_END_CODE = 'END';
export const BRIDGE_FX_CODE = 'FX';

/**
 * Q3 — the entity's steps (`Bridge Step Delta`: the signed change, 0 on the level
 * rows; `Bridge Is Total` marks START / CC_SUB / END and is blank for another
 * entity's steps, which are dropped) plus the START and END levels: START's delta
 * is the comparison NR (the model's `Bridge Value` for START); the END level is
 * read as `Prof Net Revenue` in a second row so both totals come from one result.
 * The CC subtotal level is the running sum before FX (= END − FX, T-05).
 */
export function buildBridgeQuery(filter: FilterState, reference: ReferenceData): string {
  const vars = filterVars(filter, reference);
  return [
    ...defineBlock(vars),
    '    VAR _steps =',
    '        SELECTCOLUMNS (',
    '            FILTER (',
    '                SUMMARIZECOLUMNS (',
    '                    dim_bridge_step[step_code]',
    '                    ,dim_bridge_step[step_label]',
    '                    ,dim_bridge_step[step_sort]',
    `                    ,${varList(vars)}`,
    `                    ,${num('@delta', '[Bridge Step Delta]')}`,
    `                    ,${num('@is_total', '[Bridge Is Total]')}`,
    '                )',
    '                ,NOT ISBLANK ( [@is_total] )',
    '            )',
    '            ,"step_code", dim_bridge_step[step_code]',
    '            ,"step_label", dim_bridge_step[step_label]',
    '            ,"step_sort", dim_bridge_step[step_sort]',
    '            ,"@delta", [@delta]',
    '            ,"@is_total", [@is_total]',
    '        )',
    '    VAR _end =',
    '        ROW (',
    `            "step_code", "${BRIDGE_END_CODE}"`,
    '            ,"step_label", "Actual NR"',
    '            ,"step_sort", 999',
    `            ,${num('@delta', `CALCULATE ( [Prof Net Revenue], ${varList(vars)} )`)}`,
    '            ,"@is_total", 2',
    '        )',
    'EVALUATE',
    'UNION ( _steps, _end )',
    'ORDER BY [step_sort]',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// QP — profit bridge (redesign v4 build-brief §2 page 1): `Profit Step Delta`
// per `dim_profit_step` (BUD = comparison Adj. EBITDA level; VOL … FX signed
// changes at constant currency; ACT / OP = 0, levels built here; DA / ADJ =
// the actual level of the line, signed) plus the comparison's D&A, adjusting
// items and operating profit for the level labels ("vs Budget Δ").

export const PROFIT_COLUMNS = { code: 'step_code', label: 'step_label', sort: 'step_sort', delta: '@delta', isTotal: '@is_total' } as const;
export const PROFIT_LIMIT = 30;
/** Rows the query appends with the comparison level of a P&L line (`LV Comparison` on `dim_pl_row[line_code]`). */
export const PROFIT_COMPARISON_PREFIX = 'CMP_';
const PROFIT_COMPARISON_LINES = ['DA', 'ADJ', 'OP'] as const;

export function buildProfitBridgeQuery(filter: FilterState, reference: ReferenceData): string {
  const vars = filterVars(filter, reference);
  const comparisonRow = (line: string, sort: number) =>
    [
      '        ROW (',
      `            "step_code", "${PROFIT_COMPARISON_PREFIX}${line}"`,
      `            ,"step_label", ""`,
      `            ,"step_sort", ${sort}`,
      `            ,${num('@delta', `CALCULATE ( [LV Comparison], REMOVEFILTERS ( dim_pl_row ), ${treatas([daxString(line)], 'dim_pl_row[line_code]')}, ${varList(vars)} )`)}`,
      '            ,"@is_total", 0',
      '        )',
    ].join('\n');
  return [
    ...defineBlock(vars),
    '    VAR _steps =',
    '        SELECTCOLUMNS (',
    '            SUMMARIZECOLUMNS (',
    '                dim_profit_step[step_code]',
    '                ,dim_profit_step[step_label]',
    '                ,dim_profit_step[step_sort]',
    `                ,${varList(vars)}`,
    `                ,${num('@delta', '[Profit Step Delta]')}`,
    `                ,${num('@is_total', '[Profit Is Total]')}`,
    '            )',
    '            ,"step_code", dim_profit_step[step_code]',
    '            ,"step_label", dim_profit_step[step_label]',
    '            ,"step_sort", dim_profit_step[step_sort]',
    '            ,"@delta", [@delta]',
    '            ,"@is_total", [@is_total]',
    '        )',
    ...PROFIT_COMPARISON_LINES.flatMap((line, i) => [`    VAR _cmp_${line.toLowerCase()} =`, comparisonRow(line, 901 + i)]),
    'EVALUATE',
    `UNION ( _steps, ${PROFIT_COMPARISON_LINES.map((l) => `_cmp_${l.toLowerCase()}`).join(', ')} )`,
    'ORDER BY [step_sort]',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// QL — largest variances (C-45, redesign v4 page 2): every leaf line of
// dim_pl_row with its level columns; ranking, Top-N, block subtotals, Δ, Δ %,
// |Δ| and the coverage footer are derived in `model/variances.ts` (ADR-0006
// §16), so the controls never re-query. The cut (member segments) is a second
// query grouped by the member column, Δ only.

export const VARIANCE_COLUMNS = {
  rowKey: 'row_key',
  lineCode: 'line_code',
  lineLabel: 'line_label',
  accountCode: 'account_code',
  accountLabel: 'account_label',
  lineSort: 'line_sort',
  accountSort: 'account_sort',
  base: '@base',
  cmp: '@cmp',
  dB: '@d_b',
  fx: '@fx',
  belowCm: '@below_cm',
} as const;
export const VARIANCE_LIMIT = 120;

const VARIANCE_GROUP_BY = ['row_key', 'line_code', 'line_label', 'account_code', 'account_label', 'line_sort', 'account_sort'] as const;

export function buildVariancesQuery(filter: FilterState, reference: ReferenceData): string {
  const vars = filterVars(filter, reference);
  return [
    ...defineBlock(vars),
    'EVALUATE',
    'SUMMARIZECOLUMNS (',
    ...VARIANCE_GROUP_BY.map((c, i) => `    ${i === 0 ? '' : ','}dim_pl_row[${c}]`),
    '    ,TREATAS ( { TRUE () }, dim_pl_row[is_leaf] )',
    `    ,${varList(vars)}`,
    `    ,${num('@base', '[LV Base]')}`,
    `    ,${num('@cmp', '[LV Comparison]')}`,
    `    ,${num('@d_b', '[LV Δ B]')}`,
    `    ,${num('@fx', '[LV FX]')}`,
    '    ,"@below_cm", LOOKUPVALUE ( dim_account[is_below_cm], dim_account[account_code], dim_pl_row[account_code] )',
    ')',
    'ORDER BY dim_pl_row[line_sort], dim_pl_row[account_sort]',
  ].join('\n');
}

/** Member columns of a cut: [code column, name column] (`param_var_cut` fields). */
export const CUT_COLUMNS = {
  region: BREAKDOWN_COLUMNS.region,
  channel: BREAKDOWN_COLUMNS.channel,
  line: BREAKDOWN_COLUMNS.line,
  segment: BREAKDOWN_COLUMNS.segment,
  entity: BREAKDOWN_COLUMNS.entity,
} as const;

export const CUT_RESULT_COLUMNS = { rowKey: 'row_key', member: '@member', name: '@name', inView: '@in_view', d: '@d' } as const;
export const CUT_LIMIT = 600;

/** QL2 — `LV Δ` per leaf × member of the cut, members of the view only (`Slice Member In View`). */
export function buildVariancesCutQuery(filter: FilterState, reference: ReferenceData): string {
  if (filter.varCut === 'none') throw new PnlQueryError('No cut selected');
  if (filter.varCut === 'entity' && filter.entity !== 'G') throw new PnlQueryError('Entity cut is Group view only');
  const vars = filterVars(filter, reference);
  const [codeColumn, nameColumn] = CUT_COLUMNS[filter.varCut];
  return [
    ...defineBlock(vars),
    'EVALUATE',
    'SELECTCOLUMNS (',
    '    FILTER (',
    '        SUMMARIZECOLUMNS (',
    '            dim_pl_row[row_key]',
    `            ,${codeColumn}`,
    `            ,${nameColumn}`,
    '            ,TREATAS ( { TRUE () }, dim_pl_row[is_leaf] )',
    `            ,${varList(vars)}`,
    '            ,"@in_view", [Slice Member In View]',
    `            ,${num('@d', '[LV Δ]')}`,
    '        )',
    `        ,[@in_view] = 1 && NOT ISBLANK ( ${codeColumn} ) && NOT ISBLANK ( [@d] )`,
    '    )',
    '    ,"row_key", dim_pl_row[row_key]',
    `    ,"@member", ${codeColumn}`,
    `    ,"@name", ${nameColumn}`,
    '    ,"@in_view", [@in_view]',
    '    ,"@d", [@d]',
    ')',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Q5 — profitability table (C-46, redesign v4 page 1): eight columns by the
// breakdown (F-21) plus a TOTAL row evaluated without the group-by.

export const PROFITABILITY_COLUMNS = {
  code: '@code',
  name: '@name',
  inView: '@in_view',
  nr: '@nr',
  nrDeltaPct: '@nr_d_pct',
  gm: '@gm',
  cm: '@cm',
  cmDeltaPp: '@cm_d_pp',
  contribution: '@contrib',
  ebitda: '@ebitda',
} as const;
export const PROFITABILITY_LIMIT = 100;
export const PROFITABILITY_TOTAL_CODE = 'TOTAL';

/** The breakdown the filter state selects for the entity (F-21), from the allow-list. */
export function selectedBreakdown(filter: FilterState): BreakdownKey {
  const keys = breakdownKeys(filter.entity);
  const key = keys[filter.breakdown[filter.entity]];
  if (key === undefined) throw new PnlQueryError(`Breakdown index out of range: ${String(filter.breakdown[filter.entity])}`);
  return key;
}

const PROFITABILITY_MEASURES: readonly [alias: string, measure: string][] = [
  ['@nr', 'Prof Net Revenue'],
  ['@nr_d_pct', 'Prof NR Δ % CC'],
  ['@gm', 'KPI Gross Margin %'],
  ['@cm', 'KPI CM %'],
  ['@cm_d_pp', 'Prof CM Δ pp'],
  ['@contrib', 'Prof Contribution'],
  ['@ebitda', 'Prof Adj EBITDA'],
];

/**
 * Q5 — one row per member of the breakdown dimension that belongs to the view
 * (`Slice Member In View`), NR and the margins in the pinned units, NR Δ % at
 * constant currency, CM Δ in pp; then the company total as one more row.
 */
export function buildProfitabilityQuery(filter: FilterState, reference: ReferenceData): string {
  const vars = filterVars(filter, reference);
  const [codeColumn, nameColumn] = BREAKDOWN_COLUMNS[selectedBreakdown(filter)];
  return [
    ...defineBlock(vars),
    '    VAR _members =',
    '        SELECTCOLUMNS (',
    '            FILTER (',
    '                SUMMARIZECOLUMNS (',
    `                    ${codeColumn}`,
    `                    ,${nameColumn}`,
    `                    ,${varList(vars)}`,
    '                    ,"@in_view", [Slice Member In View]',
    ...PROFITABILITY_MEASURES.map(([alias, measure]) => `                    ,${num(alias, `[${measure}]`)}`),
    '                )',
    `                ,[@in_view] = 1 && NOT ISBLANK ( ${codeColumn} )`,
    '            )',
    `            ,"@code", ${codeColumn}`,
    `            ,"@name", ${nameColumn}`,
    '            ,"@in_view", [@in_view]',
    ...PROFITABILITY_MEASURES.map(([alias]) => `            ,"${alias}", [${alias}]`),
    '        )',
    '    VAR _total =',
    '        CALCULATETABLE (',
    '            ROW (',
    `                "@code", "${PROFITABILITY_TOTAL_CODE}"`,
    '                ,"@name", "Total"',
    '                ,"@in_view", 1',
    ...PROFITABILITY_MEASURES.map(([alias, measure]) => `                ,${num(alias, `[${measure}]`)}`),
    '            )',
    `            ,${varList(vars)}`,
    '        )',
    'EVALUATE',
    'UNION ( _members, _total )',
    'ORDER BY [@nr] DESC',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// QC — concentration (redesign v4 page 1): `Conc Share` on dim_conc_level × dim_region.

export const CONCENTRATION_COLUMNS = { level: 'level_code', levelLabel: 'level_label', levelSort: 'level_sort', region: 'region_code', regionName: 'region_name', share: '@share' } as const;
export const CONCENTRATION_LIMIT = 40;

export function buildConcentrationQuery(filter: FilterState, reference: ReferenceData): string {
  const vars = filterVars(filter, reference);
  return [
    ...defineBlock(vars),
    'EVALUATE',
    'SUMMARIZECOLUMNS (',
    '    dim_conc_level[level_code]',
    '    ,dim_conc_level[level_label]',
    '    ,dim_conc_level[level_sort]',
    '    ,dim_region[region_code]',
    '    ,dim_region[region_name]',
    `    ,${varList(vars)}`,
    `    ,${num('@share', '[Conc Share]')}`,
    ')',
    'ORDER BY dim_conc_level[level_sort], dim_region[region_code]',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// QB — growth × margin by region (redesign v4 page 2): organic growth, CM % and
// NR per region, plus the company references as one more row.

export const BUBBLE_COLUMNS = { region: '@code', regionName: '@name', growth: '@growth', cm: '@cm', nr: '@nr' } as const;
export const BUBBLE_LIMIT = 20;
export const BUBBLE_COMPANY_CODE = 'COMPANY';

export function buildBubbleQuery(filter: FilterState, reference: ReferenceData): string {
  const vars = filterVars(filter, reference);
  return [
    ...defineBlock(vars),
    '    VAR _regions =',
    '        SELECTCOLUMNS (',
    '            FILTER (',
    '                SUMMARIZECOLUMNS (',
    '                    dim_region[region_code]',
    '                    ,dim_region[region_name]',
    `                    ,${varList(vars)}`,
    `                    ,${num('@growth', '[KPI Organic Growth]')}`,
    `                    ,${num('@cm', '[KPI CM %]')}`,
    `                    ,${num('@nr', '[Prof Net Revenue]')}`,
    '                )',
    '                ,NOT ISBLANK ( dim_region[region_code] )',
    '            )',
    '            ,"@code", dim_region[region_code]',
    '            ,"@name", dim_region[region_name]',
    '            ,"@growth", [@growth]',
    '            ,"@cm", [@cm]',
    '            ,"@nr", [@nr]',
    '        )',
    '    VAR _company =',
    '        CALCULATETABLE (',
    '            ROW (',
    `                "@code", "${BUBBLE_COMPANY_CODE}"`,
    '                ,"@name", "Company"',
    `                ,${num('@growth', '[Prof Company Growth]')}`,
    `                ,${num('@cm', '[Prof Company CM %]')}`,
    `                ,${num('@nr', '[Prof Net Revenue]')}`,
    '            )',
    `            ,${varList(vars)}`,
    '        )',
    'EVALUATE',
    'UNION ( _regions, _company )',
    'ORDER BY [@nr] DESC',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// QH — mix heatmap region × service line (redesign v4 page 2): NR and GM % per
// cell for the company's own lines (unassigned left out), then the region,
// line and company totals as rows with a blank code on the other axis. In the
// Group view the cells are evaluated per line's own company (the model's
// `Heat Cell` does the same), the totals at Group level.

export const HEAT_COLUMNS = { region: '@region', regionName: '@region_name', line: '@line', lineName: '@line_name', lineSort: '@line_sort', nr: '@nr', gm: '@gm' } as const;
export const HEAT_LIMIT = 120;

function heatPart(indent: string, vars: readonly FilterVar[], entityVar: string, byRegion: boolean, byLine: boolean, lineEntity: string | null): string[] {
  const i1 = `${indent}    `;
  const i2 = `${indent}        `;
  const names = vars.map((v) => (v.name === '_entity' ? entityVar : v.name)).join(', ');
  const groupBy = [
    ...(byRegion ? ['dim_region[region_code]', 'dim_region[region_name]'] : []),
    ...(byLine ? ['dim_line[line_code]', 'dim_line[line_name]', 'dim_line[sort_order]'] : []),
  ];
  const lineFilters = byLine && lineEntity !== null ? [treatas([daxString(lineEntity)], 'dim_line[entity_code]'), treatas(['FALSE ()'], 'dim_line[is_unassigned]')] : [];
  const body =
    groupBy.length === 0
      ? [`${i1}CALCULATETABLE (`, `${i2}ROW ( ${num('@nr', '[Prof Net Revenue]')}, ${num('@gm', '[KPI Gross Margin %]')} )`, `${i2},${names}`, `${i1})`]
      : [
          `${i1}SUMMARIZECOLUMNS (`,
          ...groupBy.map((c, i) => `${i2}${i === 0 ? '' : ','}${c}`),
          ...lineFilters.map((f) => `${i2},${f}`),
          `${i2},${names}`,
          `${i2},${num('@nr', '[Prof Net Revenue]')}`,
          `${i2},${num('@gm', '[KPI Gross Margin %]')}`,
          `${i1})`,
        ];
  return [
    `${indent}SELECTCOLUMNS (`,
    ...body,
    `${i1},"@region", ${byRegion ? 'dim_region[region_code]' : '""'}`,
    `${i1},"@region_name", ${byRegion ? 'dim_region[region_name]' : '""'}`,
    `${i1},"@line", ${byLine ? 'dim_line[line_code]' : '""'}`,
    `${i1},"@line_name", ${byLine ? 'dim_line[line_name]' : '""'}`,
    `${i1},"@line_sort", ${byLine ? 'dim_line[sort_order]' : '0'}`,
    `${i1},"@nr", [@nr]`,
    `${i1},"@gm", [@gm]`,
    `${indent})`,
  ];
}

export function buildHeatQuery(filter: FilterState, reference: ReferenceData): string {
  const vars = filterVars(filter, reference);
  const entities: OperatingEntity[] = filter.entity === 'G' ? ['P', 'S'] : [filter.entity];
  const extraVars: FilterVar[] =
    filter.entity === 'G'
      ? entities.map((e) => ({ name: `_entity_${e.toLowerCase()}`, expression: treatas([daxString(e)], 'param_entity_view[entity_view_code]') }))
      : [];
  const cellVar = (e: OperatingEntity) => (filter.entity === 'G' ? `_entity_${e.toLowerCase()}` : '_entity');
  const parts: string[] = [];
  const names: string[] = [];
  for (const e of entities) {
    const cells = `_cells_${e.toLowerCase()}`;
    const lines = `_lines_${e.toLowerCase()}`;
    names.push(cells, lines);
    parts.push(`    VAR ${cells} =`, ...heatPart('        ', vars, cellVar(e), true, true, e));
    parts.push(`    VAR ${lines} =`, ...heatPart('        ', vars, cellVar(e), false, true, e));
  }
  names.push('_regions', '_company');
  parts.push('    VAR _regions =', ...heatPart('        ', vars, '_entity', true, false, null));
  parts.push('    VAR _company =', ...heatPart('        ', vars, '_entity', false, false, null));
  return [...defineBlock([...vars, ...extraVars]), ...parts, 'EVALUATE', `UNION ( ${names.join(', ')} )`, 'ORDER BY [@region], [@line_sort]'].join('\n');
}

// ---------------------------------------------------------------------------
// Q6 — context strip (L-05, C-50, N-02): one row of model texts plus the
// company-average contribution margin for the profitability chart marker.

export const CONTEXT_COLUMNS = { status: '@status', notices: '@notices', profNote: '@prof_note', cmPct: '@cm_pct', refreshed: '@refreshed' } as const;
export const CONTEXT_LIMIT = 5;

/**
 * Q6 also reads the model's refresh timestamp as a column (`_meta_refresh[refreshed_at]`,
 * the value `Data Status` / `Hdr Status` format) so the header's status line can be built
 * client-side with the " - " separators (period-picker-v2 Part 2) without a new measure.
 */
export function buildContextQuery(filter: FilterState, reference: ReferenceData): string {
  const vars = filterVars(filter, reference);
  return [
    ...defineBlock(vars),
    'EVALUATE',
    'CALCULATETABLE (',
    '    ROW (',
    '        "@status", [Data Status]',
    '        ,"@notices", [Notices]',
    '        ,"@prof_note", [Profitability Note]',
    `        ,${num('@cm_pct', '[KPI CM %]')}`,
    '        ,"@refreshed", MAX ( _meta_refresh[refreshed_at] )',
    '    )',
    `    ,${varList(vars)}`,
    ')',
  ].join('\n');
}

/** The model joins its notices with this separator (`Notices` measure). */
export const NOTICE_SEPARATOR = '   |   ';
