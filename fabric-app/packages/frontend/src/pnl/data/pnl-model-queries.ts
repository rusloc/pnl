// DAX for the `pnlModel` semantic-model connector (ADR-0006 §8). Pure, allow-listed
// builders: every value that reaches the DAX text is either a fixed code from the
// maps below, an integer that passed a range check, or a code that exists in the
// reference data. No user text is ever concatenated into a query.
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
/** Units are pinned so the `PL *` measures arrive in millions; F-14 is applied in TypeScript. */
const UNITS_CODE = 'M';

const SLICE_COLUMN: Record<SliceSlot, string> = {
  channel: 'dim_channel[channel_code]',
  line: 'dim_line[line_code]',
  segment: 'dim_segment[segment_code]',
};

function pick<K extends string>(map: Record<K, string>, key: K, what: string): string {
  const value = Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
  if (value === undefined) throw new PnlQueryError(`Unknown ${what}: ${String(key)}`);
  return value;
}

/** DAX string literal for an allow-listed code (quotes doubled, control characters refused). */
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

function codes(selected: readonly string[], allowed: ReadonlySet<string>, what: string): string[] {
  const unique = [...new Set(selected)];
  if (unique.length === 0) throw new PnlQueryError(`Empty ${what} selection`);
  for (const code of unique) {
    if (!allowed.has(code)) throw new PnlQueryError(`Unknown ${what} code: ${code}`);
  }
  return unique.map(daxString);
}

interface FilterVar {
  name: string;
  expression: string;
}

/** The common filter block (ADR-0006 §8.1): one table variable per filter, slices omitted for Group (F-32). */
export function statementFilterVars(filter: FilterState, reference: ReferenceData): FilterVar[] {
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
    const allowed = new Set(reference.regions.map((r) => r.code));
    vars.push({ name: '_regions', expression: treatas(codes(filter.regions, allowed, 'region'), 'dim_region[region_code]') });
  }
  if (filter.entity !== 'G') {
    const entity: OperatingEntity = filter.entity;
    const slices = filter.slices[entity];
    for (const slot of ['channel', 'line', 'segment'] as const) {
      const selected = slices[slot];
      if (selected === null) continue;
      const allowed = new Set(reference.slices[entity][slot].values.map((v) => v.code));
      vars.push({ name: `_${slot}s`, expression: treatas(codes(selected, allowed, slot), SLICE_COLUMN[slot]) });
    }
  }
  return vars;
}

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
  pctNr: '@pct_nr',
  cmpA: '@cmp_a',
  dA: '@d_a',
  dApct: '@d_a_pct',
  cmpB: '@cmp_b',
  dB: '@d_b',
  dBpct: '@d_b_pct',
  fyBud: '@fy_bud',
  fyLe: '@fy_le',
  fyD: '@fy_d',
} as const;

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
 * Statement measures (`1 Statement` folder): already in the pinned units for amount
 * rows, raw ratios on ratio rows, Δ in pp on ratio rows. They return Number, but every
 * amount is still wrapped in CONVERT ( …, DOUBLE ) in case a measure goes Fixed Decimal.
 */
const STATEMENT_MEASURES: readonly [alias: string, measure: string][] = [
  ['@base', 'PL Base'],
  ['@pct_nr', 'PL % NR'],
  ['@cmp_a', 'PL Compare A'],
  ['@d_a', 'PL Δ A'],
  ['@d_a_pct', 'PL Δ A %'],
  ['@cmp_b', 'PL Compare B'],
  ['@d_b', 'PL Δ B'],
  ['@d_b_pct', 'PL Δ B %'],
  ['@fy_bud', 'PL FY Budget'],
  ['@fy_le', 'PL FY LE'],
  ['@fy_d', 'PL Δ LE vs Budget'],
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
    ...STATEMENT_MEASURES.map(([alias, measure]) => `${i2},"${alias}", CONVERT ( [${measure}], DOUBLE )`),
    `${i1})`,
    ...ROW_COLUMNS.map((c) => `${i1},"${c}", ${!leaves && LEAF_ONLY_COLUMNS.has(c) ? LINE_CONSTANT[c] : `dim_pl_row[${c}]`}`),
    ...STATEMENT_MEASURES.map(([alias]) => `${i1},"${alias}", [${alias}]`),
    `${indent})`,
  ];
}

/** Q1 — the statement (ADR-0006 §8.2): one row per dim_pl_row line or account, lines first within each line_sort. */
export function buildStatementQuery(filter: FilterState, reference: ReferenceData): string {
  const vars = statementFilterVars(filter, reference);
  const pad = Math.max(...vars.map((v) => v.name.length)) + 1;
  const lines = [
    'DEFINE',
    ...vars.map((v) => `    VAR ${v.name.padEnd(pad)}= ${v.expression}`),
    '    VAR _lines =',
    ...statementPart(false, vars, '        '),
    '    VAR _leaves =',
    ...statementPart(true, vars, '        '),
    'EVALUATE',
    'UNION ( _lines, _leaves )',
    'ORDER BY [line_sort], [account_sort]',
  ];
  return lines.join('\n');
}
