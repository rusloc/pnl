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

export interface FilterVarOptions {
  /**
   * Analysis zones (C-40, C-45) follow the "Compared with" toolbar: Compare A is
   * replaced, so the model's bridge comparison (Compare A, else B, else PY) is
   * exactly the chosen version. Not used by the statement, KPIs or profitability.
   */
  compareA?: CompareVersion;
}

/**
 * The common filter block (ADR-0006 §8.1): one table variable per filter; "All"
 * selections emit nothing; slices are omitted for Group (F-32). Codes are
 * validated against the reference data and emitted as the model's name values.
 */
export function filterVars(filter: FilterState, reference: ReferenceData, options: FilterVarOptions = {}): FilterVar[] {
  const fiscalYears = new Set(reference.months.map((m) => m.fiscalYear));
  if (!fiscalYears.has(filter.fiscalYear)) {
    throw new PnlQueryError(`Fiscal year not in the reference data: ${String(filter.fiscalYear)}`);
  }
  const compareA = options.compareA ?? filter.compareA;
  const vars: FilterVar[] = [
    { name: '_entity', expression: treatas([daxString(pick(ENTITY_VIEW, filter.entity, 'entity'))], 'param_entity_view[entity_view_code]') },
    { name: '_fy', expression: treatas([daxInt(filter.fiscalYear, 'Fiscal year', 1900, 2999)], 'param_fiscal_year[fiscal_year]') },
    { name: '_month', expression: treatas([daxInt(filter.month, 'Month', 1, 12)], 'param_period[month_number]') },
    { name: '_tv', expression: treatas([daxString(pick(TIME_VIEW, filter.timeView, 'time view'))], 'param_time_view[time_view_code]') },
    { name: '_base', expression: treatas([daxString(pick(BASE_VERSION, filter.baseVersion, 'base version'))], 'param_base_version[choice_code]') },
    { name: '_cmp_a', expression: treatas([daxString(pick(COMPARE_VERSION, compareA, 'Compare A'))], 'param_compare_a[choice_code]') },
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
// Q2 — KPI tiles (§5). Two shapes: the entity's 12 dim_kpi rows (metadata, no
// measures), then the values as scalar CALCULATEs per kpi_code. A SUMMARIZECOLUMNS
// over dim_kpi with `KPI Value` evaluates every branch of the model's SWITCH for
// every row and does not finish inside the request timeout; scalar CALCULATEs with
// one kpi_code in filter evaluate one branch each.

export const KPI_META_COLUMNS = {
  slot: 'slot',
  code: 'kpi_code',
  label: 'kpi_label',
  group: 'kpi_group',
  betterWhen: 'better_when',
  valueType: 'value_type',
  definition: 'definition',
} as const;

export const KPI_META_LIMIT = 50;

/** Q2a — the entity's KPI slots: `dim_kpi` rows, no measures (fast). */
export function buildKpiMetaQuery(entity: EntityCode): string {
  return [
    'EVALUATE',
    `FILTER ( dim_kpi, dim_kpi[entity_view_code] = ${daxString(pick(ENTITY_VIEW, entity, 'entity'))} )`,
    'ORDER BY dim_kpi[slot]',
  ].join('\n');
}

/** KPI codes per values call; each code costs value + one comparison per active Compare + secondary evaluations. */
export const KPI_CHUNK = 3;

/** Allow-list for a `kpi_code` before it becomes a DAX literal: the model's codes are `[A-Z0-9_]+`. */
export function kpiCodeLiteral(code: string): string {
  if (!/^[A-Z0-9_]{1,32}$/.test(code)) throw new PnlQueryError(`Unknown KPI code: ${code}`);
  return daxString(code);
}

/** Aliases a KPI values result carries per code: `@<code>`, `@<code>_cmp_a`, `@<code>_cmp_b`, `@<code>_s`. */
export function kpiAliases(code: string): { value: string; cmpA: string; cmpB: string; secondary: string } {
  return { value: `@${code}`, cmpA: `@${code}_cmp_a`, cmpB: `@${code}_cmp_b`, secondary: `@${code}_s` };
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

export const KPI_VALUES_LIMIT = 5;

// ---------------------------------------------------------------------------
// Q3 — net revenue bridge (C-40, T-05).

export const BRIDGE_COLUMNS = { code: 'step_code', label: 'step_label', sort: 'step_sort', value: '@value' } as const;
export const BRIDGE_LIMIT = 20;
/** The row the query appends for the base total; its value is the model's `Net Revenue`. */
export const BRIDGE_END_CODE = 'END';

/**
 * Q3 — the entity's bridge steps (`Bridge Value`, in the pinned units) plus an END
 * row carrying the base `Net Revenue`, so the chart can draw both totals from one
 * result. Steps the model leaves blank (other entities' step codes) are dropped.
 */
export function buildBridgeQuery(filter: FilterState, reference: ReferenceData): string {
  const vars = filterVars(filter, reference, { compareA: filter.analysisCompare });
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
    `                    ,${num('@value', '[Bridge Value]')}`,
    '                )',
    '                ,NOT ISBLANK ( [@value] )',
    '            )',
    '            ,"step_code", dim_bridge_step[step_code]',
    '            ,"step_label", dim_bridge_step[step_label]',
    '            ,"step_sort", dim_bridge_step[step_sort]',
    '            ,"@value", [@value]',
    '        )',
    '    VAR _end =',
    '        ROW (',
    `            "step_code", "${BRIDGE_END_CODE}"`,
    '            ,"step_label", "Base"',
    '            ,"step_sort", 999',
    `            ,${num('@value', `CALCULATE ( [Prof Net Revenue], ${varList(vars)} )`)}`,
    '        )',
    'EVALUATE',
    'UNION ( _steps, _end )',
    'ORDER BY [step_sort]',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Q4 — largest variances (C-45): top 8 leaf lines by |Δ| vs the bridge comparison.

export const DRIVER_COLUMNS = {
  rowKey: 'row_key',
  lineCode: 'line_code',
  lineLabel: 'line_label',
  accountCode: 'account_code',
  accountLabel: 'account_label',
  base: '@base',
  cmp: '@cmp',
  d: '@d',
  dPct: '@d_pct',
  absD: '@abs_d',
} as const;
export const DRIVER_LIMIT = 20;
export const DRIVER_TOP = 8;

export function buildDriversQuery(filter: FilterState, reference: ReferenceData): string {
  const vars = filterVars(filter, reference, { compareA: filter.analysisCompare });
  return [
    ...defineBlock(vars),
    'EVALUATE',
    'TOPN (',
    `    ${DRIVER_TOP}`,
    '    ,SUMMARIZECOLUMNS (',
    '        dim_pl_row[row_key]',
    '        ,dim_pl_row[line_code]',
    '        ,dim_pl_row[line_label]',
    '        ,dim_pl_row[account_code]',
    '        ,dim_pl_row[account_label]',
    '        ,TREATAS ( { TRUE () }, dim_pl_row[is_leaf] )',
    `        ,${varList(vars)}`,
    `        ,${num('@base', '[LV Base]')}`,
    `        ,${num('@cmp', '[LV Comparison]')}`,
    `        ,${num('@d', '[LV Δ]')}`,
    `        ,${num('@d_pct', '[LV Δ %]')}`,
    `        ,${num('@abs_d', '[LV Abs Δ]')}`,
    '    )',
    '    ,[@abs_d], DESC',
    ')',
    'ORDER BY [@abs_d] DESC',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Q5 — profitability by slice (C-46).

export const PROFITABILITY_COLUMNS = {
  code: '@code',
  name: '@name',
  inView: '@in_view',
  nr: '@nr',
  share: '@share',
  nrDeltaPct: '@nr_d_pct',
  gm: '@gm',
  cm: '@cm',
  ebitda: '@ebitda',
  op: '@op',
} as const;
export const PROFITABILITY_LIMIT = 100;

/** The breakdown the filter state selects for the entity (F-21), from the allow-list. */
export function selectedBreakdown(filter: FilterState): BreakdownKey {
  const keys = breakdownKeys(filter.entity);
  const key = keys[filter.breakdown[filter.entity]];
  if (key === undefined) throw new PnlQueryError(`Breakdown index out of range: ${String(filter.breakdown[filter.entity])}`);
  return key;
}

/**
 * Q5 — one row per member of the breakdown dimension that belongs to the view
 * (`Slice Member In View`, which also drops the other entity's members and the
 * unassigned member), with NR in the pinned units, share, NR Δ % vs the bridge
 * comparison and the four margins.
 */
export function buildProfitabilityQuery(filter: FilterState, reference: ReferenceData): string {
  const vars = filterVars(filter, reference);
  const [codeColumn, nameColumn] = BREAKDOWN_COLUMNS[selectedBreakdown(filter)];
  return [
    ...defineBlock(vars),
    'EVALUATE',
    'SELECTCOLUMNS (',
    '    FILTER (',
    '        SUMMARIZECOLUMNS (',
    `            ${codeColumn}`,
    `            ,${nameColumn}`,
    `            ,${varList(vars)}`,
    '            ,"@in_view", [Slice Member In View]',
    `            ,${num('@nr', '[Prof Net Revenue]')}`,
    `            ,${num('@share', '[Prof NR Share]')}`,
    `            ,${num('@nr_d_pct', '[Prof NR Δ %]')}`,
    `            ,${num('@gm', '[KPI Gross Margin %]')}`,
    `            ,${num('@cm', '[KPI CM %]')}`,
    `            ,${num('@ebitda', '[KPI Adj EBITDA Margin]')}`,
    `            ,${num('@op', '[KPI Operating Margin]')}`,
    '        )',
    `        ,[@in_view] = 1 && NOT ISBLANK ( ${codeColumn} )`,
    '    )',
    `    ,"@code", ${codeColumn}`,
    `    ,"@name", ${nameColumn}`,
    '    ,"@in_view", [@in_view]',
    '    ,"@nr", [@nr]',
    '    ,"@share", [@share]',
    '    ,"@nr_d_pct", [@nr_d_pct]',
    '    ,"@gm", [@gm]',
    '    ,"@cm", [@cm]',
    '    ,"@ebitda", [@ebitda]',
    '    ,"@op", [@op]',
    ')',
    'ORDER BY [@nr] DESC',
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Q6 — context strip (L-05, C-50, N-02): one row of model texts plus the
// company-average contribution margin for the profitability chart marker.

export const CONTEXT_COLUMNS = { status: '@status', notices: '@notices', profNote: '@prof_note', cmPct: '@cm_pct' } as const;
export const CONTEXT_LIMIT = 5;

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
    '    )',
    `    ,${varList(vars)}`,
    ')',
  ].join('\n');
}

/** The model joins its notices with this separator (`Notices` measure). */
export const NOTICE_SEPARATOR = '   |   ';
