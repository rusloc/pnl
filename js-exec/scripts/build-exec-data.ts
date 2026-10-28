// Nordmark executive data build (ADR-0013 (b), (h); E-83): ../data/nordmark_retail_dummy_data/parquet/*.parquet →
// pre-aggregated public/data/*.parquet + manifest.json. Stores and suppliers never ship: the facts fold into one cube at
// week × site group × category, an OpEx cube, a weekly PO table and a week × group store-count table. Runs on Node's
// native type stripping (erasable TypeScript, explicit `.ts` imports). Every check throws, which fails `npm run build`.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parquetRead, parquetReadObjects } from 'hyparquet';
import { parquetWriteBuffer } from 'hyparquet-writer';
import type { ColumnSource } from 'hyparquet-writer';
import { z } from 'zod';
import { COST_TYPES, FILES, GROUPS, SCENARIOS, manifestSchema } from '../lib/data/manifest.ts';
import type { FileKey, Group, Manifest } from '../lib/data/manifest.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, '..', 'data', 'nordmark_retail_dummy_data', 'parquet');
const OUT = join(ROOT, 'public', 'data');

const BUDGET_TOTAL_BYTES = 3_000_000; // E-83 total ≤ 3 MB
const MAX_TOTAL_BYTES = 4_000_000; // E-83 hard fail
const BUDGET_FIRST_LOAD_BYTES = 600_000; // E-83 first paint (everything here loads at first paint)

function fail(message: string): never {
  throw new Error(`build-exec-data: ${message}`);
}

// ---------- source reading ----------

const sourceBytes = (table: string): ArrayBuffer => {
  const b = readFileSync(join(SRC, `${table}.parquet`));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

/** Plain JS value for Zod and the cubes: dates → ISO, int64 → number (checked safe), NaN → null. */
function plain(v: unknown, where: string): unknown {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'bigint') {
    const n = Number(v);
    if (!Number.isSafeInteger(n)) fail(`${where}: int64 ${v} outside the safe range`);
    return n;
  }
  if (typeof v === 'number' && Number.isNaN(v)) return null;
  return v;
}

async function readTable(table: string): Promise<Record<string, unknown>[]> {
  const rows = await parquetReadObjects({ file: sourceBytes(table) });
  return rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, plain(v, `${table}.${k}`)])));
}

async function readColumns(table: string, columns: readonly string[]): Promise<Map<string, unknown[]>> {
  const out = new Map<string, unknown[]>(columns.map((c) => [c, []]));
  await parquetRead({
    file: sourceBytes(table),
    columns: [...columns],
    onChunk: ({ columnName, columnData, rowStart }) => {
      const col = out.get(columnName) ?? fail(`${table}: unexpected column ${columnName}`);
      for (let i = 0; i < columnData.length; i++) col[rowStart + i] = plain(columnData[i], `${table}.${columnName}`);
    },
  });
  if (new Set([...out.values()].map((c) => c.length)).size !== 1) fail(`${table}: columns of different lengths`);
  return out;
}

const col = (cols: Map<string, unknown[]>, name: string): unknown[] => cols.get(name) ?? fail(`missing column ${name}`);
const str = (v: unknown, where: string): string =>
  typeof v === 'string' ? v : fail(`${where}: "${String(v)}" is not text`);
const num = (v: unknown, where: string): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fail(`${where}: "${String(v)}" is not a number`);
const bool = (v: unknown, where: string): boolean => (typeof v === 'boolean' ? v : fail(`${where}: not a boolean`));

const pick = (row: Record<string, unknown>, keys: readonly string[]): Record<string, unknown> =>
  Object.fromEntries(keys.map((k) => [k, row[k] ?? null]));

// ---------- 1 · dimensions + parameters (strict Zod, shipped in manifest.json) ----------

const sourceManifest = z
  .object({
    seed: z.number().int(),
    as_of: z.iso.date(),
    current_week_key: z.string(),
    refreshed: z.string(),
  })
  .loose() // the generator's manifest also lists tables and the calendar; only these keys are read here
  .parse(JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8')));

const WEEK_KEYS = [
  'week_key',
  'fy',
  'week_of_fy',
  'period',
  'period_key',
  'week_of_period',
  'weeks_in_period',
  'week_start',
  'week_end',
  'period_start',
  'period_end',
  'ly_week_key',
  'lw_week_key',
  'is_actual',
  'season_code',
  'season_week',
  'week_label',
] as const;
const CATEGORY_KEYS = [
  'category_code',
  'category_name',
  'is_seasonal',
  'cover_target_wks',
  'gmroi_target',
  'sellthrough_target',
  'sort_order',
] as const;
const KPI_KEYS = [
  'kpi_code',
  'catalogue_no',
  'kpi_name',
  'domain',
  'is_landing',
  'size',
  'card_order',
  'group',
  'lever',
  'horizon',
  'owner',
  'statement',
  'drill_page',
  'is_provisional',
  'direction',
  'basis',
  'formula',
  'owner_initials',
  'cadence',
] as const;
const RULE_KEYS = ['rule_code', 'kpi_code', 'direction', 'watch_from', 'off_from', 'threshold'] as const;

const sortBy = <T extends Record<string, unknown>>(rows: T[], key: string): T[] =>
  [...rows].sort((a, b) => num(a[key], key) - num(b[key], key));

const weeksRaw = sortBy(await readTable('dim_week'), 'sort_index');
const categoriesRaw = sortBy(await readTable('dim_category'), 'sort_order');
const kpisRaw = sortBy(await readTable('dim_kpi'), 'catalogue_no');
const rulesRaw = sortBy(await readTable('param_status_rule'), 'sort_order');
const targetsRaw = await readTable('param_target');

const draft = {
  schema: 'nordmark-exec/1' as const,
  seed: sourceManifest.seed,
  as_of: sourceManifest.as_of,
  current_week_key: sourceManifest.current_week_key,
  refreshed: sourceManifest.refreshed,
  groups: [...GROUPS],
  weeks: weeksRaw.map((r) => pick(r, WEEK_KEYS)),
  categories: categoriesRaw.map((r) => pick(r, CATEGORY_KEYS)),
  kpis: kpisRaw.map((r) => pick(r, KPI_KEYS)),
  rules: rulesRaw.map((r) => pick(r, RULE_KEYS)),
  targets: targetsRaw,
};

const weekIx = new Map<string, number>(weeksRaw.map((w, i) => [str(w.week_key, 'dim_week'), i]));
const categoryIx = new Map<string, number>(categoriesRaw.map((c, i) => [str(c.category_code, 'dim_category'), i]));
const groupIx = new Map<Group, number>(GROUPS.map((g, i) => [g, i]));
const NW = weekIx.size;
const NG = GROUPS.length;
const NC = categoryIx.size;
if (!weekIx.has(sourceManifest.current_week_key))
  fail(`current week ${sourceManifest.current_week_key} not in dim_week`);

// site → group (E-15): stores by scope_code, ONLINE, WHOLESALE, the DCs; a null site (central OpEx) is CENTRAL.
const storeRows = await readTable('dim_store');
const siteGroup = new Map<string, Group>();
const siteChannel = new Map<string, string>();
for (const s of storeRows) {
  const code = str(s.store_code, 'dim_store');
  const channel = str(s.channel_code, `dim_store ${code}`);
  const scope = s.scope_code;
  const group: Group =
    channel === 'STORE' && (scope === 'NL' || scope === 'BE')
      ? scope
      : channel === 'ONLINE' && scope === 'ONLINE'
        ? 'ONLINE'
        : channel === 'WHOLESALE' && scope === null
          ? 'WHOLESALE'
          : channel === 'DC' && scope === null
            ? 'DC'
            : fail(`dim_store ${code}: channel ${channel} with scope ${String(scope)} has no group`);
  siteGroup.set(code, group);
  siteChannel.set(code, channel);
}

const ix = <K>(map: Map<K, number>, key: K, where: string): number =>
  map.get(key) ?? fail(`${where}: unknown key "${String(key)}"`);
const groupOf = (site: unknown, where: string): number => {
  if (site === null) return ix(groupIx, 'CENTRAL', where);
  const g = siteGroup.get(str(site, where));
  return g === undefined ? fail(`${where}: unknown site ${String(site)}`) : ix(groupIx, g, where);
};

// ---------- 2 · the base cube: week × group × category ----------

type CubeMeasure = Exclude<keyof (typeof FILES)['cube']['columns'], 'week_ix' | 'group_ix' | 'category_ix'>;
const MEASURES = Object.keys(FILES.cube.columns).filter(
  (c): c is CubeMeasure => !['week_ix', 'group_ix', 'category_ix'].includes(c),
);
const cube = new Map<CubeMeasure, Float64Array>(MEASURES.map((m) => [m, new Float64Array(NW * NG * NC)]));
const cell = (w: number, g: number, c: number): number => (w * NG + g) * NC + c;
const sourceTotals = new Map<CubeMeasure, number>();

async function fold(
  table: string,
  map: Partial<Record<CubeMeasure, string>>,
  filter?: { column: string; target: CubeMeasure; from: string }[],
): Promise<Map<string, unknown[]>> {
  const sourceCols = [
    ...new Set([
      'week_key',
      'store_code',
      'category_code',
      ...Object.values(map),
      ...(filter ?? []).map((f) => f.column),
    ]),
  ];
  const cols = await readColumns(table, sourceCols);
  const weeks = col(cols, 'week_key');
  const sites = col(cols, 'store_code');
  const cats = col(cols, 'category_code');
  for (let i = 0; i < weeks.length; i++) {
    const where = `${table}:${i}`;
    const k = cell(
      ix(weekIx, str(weeks[i], where), where),
      groupOf(sites[i], where),
      ix(categoryIx, str(cats[i], where), where),
    );
    for (const [measure, source] of Object.entries(map) as [CubeMeasure, string][]) {
      const v = num(col(cols, source)[i], where);
      const arr = cube.get(measure) ?? fail(measure);
      arr[k] = (arr[k] ?? 0) + v;
      sourceTotals.set(measure, (sourceTotals.get(measure) ?? 0) + v);
    }
    for (const f of filter ?? [])
      if (bool(col(cols, f.column)[i], where)) {
        const arr = cube.get(f.target) ?? fail(f.target);
        arr[k] = (arr[k] ?? 0) + num(col(cols, f.from)[i], where);
      }
  }
  return cols;
}

const salesCols = await fold(
  'fact_sales_week',
  {
    gross_sales: 'gross_sales',
    markdown: 'markdown_value',
    returns: 'returns',
    net_sales: 'net_sales',
    cogs: 'cogs_landed',
    back_margin: 'back_margin_alloc',
    units: 'units',
  },
  [
    { column: 'is_lfl', target: 'net_sales_lfl', from: 'net_sales' },
    { column: 'is_lfl_as_ly', target: 'net_sales_lfl_as_ly', from: 'net_sales' },
  ],
);
await fold(
  'fact_budget_week',
  {
    net_sales_bud: 'net_sales_bud',
    gross_sales_bud: 'gross_sales_bud',
    markdown_bud: 'markdown_bud',
    cogs_bud: 'cogs_bud',
    back_margin_bud: 'back_margin_bud',
  },
  [{ column: 'is_lfl', target: 'net_sales_bud_lfl', from: 'net_sales_bud' }],
);
await fold('fact_inventory_week', {
  on_hand_units: 'on_hand_units',
  on_hand_cost: 'on_hand_cost',
  on_order_cost: 'on_order_cost',
});
await fold('fact_forecast_week', { forecast_cogs: 'forecast_cogs' });
await fold('fact_availability_week', { ranged_sku_days: 'ranged_sku_days', in_stock_sku_days: 'in_stock_sku_days' });
await fold('fact_receipts_week', { receipt_units: 'receipt_units' });

// ---------- 3 · store counts: week × group (distinct stores do not add over categories) ----------

const setOf = (map: Map<string, Set<string>>, key: string): Set<string> => {
  const set = map.get(key) ?? new Set<string>();
  map.set(key, set);
  return set;
};
const trading = new Map<string, Set<string>>();
const lfl = new Map<string, Set<string>>();
{
  const weeks = col(salesCols, 'week_key');
  const sites = col(salesCols, 'store_code');
  const flags = col(salesCols, 'is_lfl');
  for (let i = 0; i < weeks.length; i++) {
    const site = str(sites[i], 'fact_sales_week');
    if (siteChannel.get(site) !== 'STORE') continue;
    const key = `${str(weeks[i], 'fact_sales_week')}|${siteGroup.get(site)}`;
    setOf(trading, key).add(site);
    if (bool(flags[i], 'fact_sales_week.is_lfl')) setOf(lfl, key).add(site);
  }
}
const sites = [...trading.entries()].map(([key, set]) => {
  const [w = '', g = ''] = key.split('|');
  return {
    week_ix: ix(weekIx, w, 'sites'),
    group_ix: ix(groupIx, g as Group, 'sites'),
    trading_stores: set.size,
    lfl_stores: lfl.get(key)?.size ?? 0,
  };
});
sites.sort((a, b) => a.week_ix - b.week_ix || a.group_ix - b.group_ix);

// ---------- 4 · PO lines per week (no site) + suppliers below 85 % OTIF ----------

const poCols = await readColumns('fact_po_week', ['week_key', 'po_lines_due', 'po_lines_otif']);
const poByWeek = new Map<number, { due: number; otif: number; below: number }>();
{
  const weeks = col(poCols, 'week_key');
  for (let i = 0; i < weeks.length; i++) {
    const w = ix(weekIx, str(weeks[i], 'fact_po_week'), 'fact_po_week');
    const due = num(col(poCols, 'po_lines_due')[i], 'po_lines_due');
    const otif = num(col(poCols, 'po_lines_otif')[i], 'po_lines_otif');
    const acc = poByWeek.get(w) ?? { due: 0, otif: 0, below: 0 };
    acc.due += due;
    acc.otif += otif;
    if (otif < 0.85 * due) acc.below += 1;
    poByWeek.set(w, acc);
  }
}
const po = [...poByWeek.entries()]
  .sort(([a], [b]) => a - b)
  .map(([week_ix, a]) => ({ week_ix, po_lines_due: a.due, po_lines_otif: a.otif, suppliers_below_85: a.below }));

// ---------- 5 · OpEx: scenario × week × cost type × group ----------

const opexCols = await readColumns('fact_opex_week', [
  'week_key',
  'scenario_code',
  'cost_type_code',
  'store_code',
  'amount',
]);
const opexMap = new Map<string, number>();
const scenarioIx = new Map<string, number>(SCENARIOS.map((s, i) => [s, i]));
const costIx = new Map<string, number>(COST_TYPES.map((c, i) => [c, i]));
{
  const weeks = col(opexCols, 'week_key');
  for (let i = 0; i < weeks.length; i++) {
    const where = `fact_opex_week:${i}`;
    const key = [
      ix(scenarioIx, str(col(opexCols, 'scenario_code')[i], where), where),
      ix(weekIx, str(weeks[i], where), where),
      ix(costIx, str(col(opexCols, 'cost_type_code')[i], where), where),
      groupOf(col(opexCols, 'store_code')[i], where),
    ].join('|');
    opexMap.set(key, (opexMap.get(key) ?? 0) + num(col(opexCols, 'amount')[i], where));
  }
}
const opex = [...opexMap.entries()]
  .map(([key, amount]) => {
    const [scenario_ix = 0, week_ix = 0, cost_type_ix = 0, group_ix = 0] = key.split('|').map(Number);
    return { scenario_ix, week_ix, cost_type_ix, group_ix, amount };
  })
  .sort(
    (a, b) =>
      a.scenario_ix - b.scenario_ix ||
      a.week_ix - b.week_ix ||
      a.cost_type_ix - b.cost_type_ix ||
      a.group_ix - b.group_ix,
  );

// ---------- 6 · cube rows (non-empty cells only) + reconciliation ----------

const cubeRows: Record<string, number>[] = [];
for (let w = 0; w < NW; w++)
  for (let g = 0; g < NG; g++)
    for (let c = 0; c < NC; c++) {
      const k = cell(w, g, c);
      if (!MEASURES.some((m) => (cube.get(m)?.[k] ?? 0) !== 0)) continue;
      const row: Record<string, number> = { week_ix: w, group_ix: g, category_ix: c };
      for (const m of MEASURES) row[m] = cube.get(m)?.[k] ?? 0;
      cubeRows.push(row);
    }
for (const [m, total] of sourceTotals) {
  const shipped = cubeRows.reduce((s, r) => s + (r[m] ?? 0), 0);
  if (Math.abs(shipped - total) > 0.01) fail(`cube ${m}: shipped ${shipped} ≠ source ${total}`);
}

// ---------- 7 · write ----------

const PARQUET_TYPE = { int: 'INT32', num: 'DOUBLE' } as const;

function encode(key: FileKey, rows: readonly Record<string, number>[]): ArrayBuffer {
  if (rows.length === 0) fail(`${key}: no rows`);
  const columnData: ColumnSource[] = Object.entries(FILES[key].columns).map(([name, kind]) => {
    const data = rows.map((r) => r[name] ?? fail(`${key}.${name}: missing value`));
    if (kind === 'int' && data.some((v) => !Number.isInteger(v) || Math.abs(v) > 2 ** 31 - 1))
      fail(`${key}.${name}: not int32`);
    return {
      name,
      data: kind === 'int' ? Int32Array.from(data) : Float64Array.from(data),
      type: PARQUET_TYPE[kind],
      nullable: false,
    };
  });
  return parquetWriteBuffer({ columnData, rowGroupSize: rows.length, createdBy: 'nordmark js-exec build-exec-data' });
}

mkdirSync(OUT, { recursive: true });
const outputs: Record<FileKey, readonly Record<string, number>[]> = { cube: cubeRows, opex, po, sites };
const files = {} as Manifest['files'];
for (const key of Object.keys(FILES) as FileKey[]) {
  const buffer = encode(key, outputs[key]);
  writeFileSync(join(OUT, FILES[key].file), new Uint8Array(buffer));
  files[key] = { name: FILES[key].file, rows: outputs[key].length, bytes: buffer.byteLength };
}

const parsed = manifestSchema.safeParse({ ...draft, files });
if (!parsed.success) fail(z.prettifyError(parsed.error));
const manifestText = `${JSON.stringify(parsed.data)}\n`;
writeFileSync(join(OUT, 'manifest.json'), manifestText);

const total = Object.values(files).reduce((s, f) => s + f.bytes, 0) + Buffer.byteLength(manifestText);
if (total > MAX_TOTAL_BYTES) fail(`shipped data ${total} B > ${MAX_TOTAL_BYTES} B (E-83 hard limit)`);
if (total > BUDGET_TOTAL_BYTES)
  console.warn(`build-exec-data: shipped data ${total} B over the ${BUDGET_TOTAL_BYTES} B budget`);
if (total > BUDGET_FIRST_LOAD_BYTES)
  console.warn(`build-exec-data: first paint ${total} B over the ${BUDGET_FIRST_LOAD_BYTES} B budget (E-83)`);
console.log(
  `build-exec-data: ${Object.values(files)
    .map((f) => `${f.name} ${f.rows} rows ${f.bytes} B`)
    .join(' · ')} · manifest.json ${Buffer.byteLength(manifestText)} B · total ${total} B`,
);
