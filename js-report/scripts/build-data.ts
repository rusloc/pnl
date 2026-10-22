// Track C data build (ADR-0002 §2.2): repo CSVs (spec §8, D-01 … D-21) → public/data/pl-P.parquet, pl-S.parquet,
// ops.parquet + manifest.json. Runs as `prebuild` on Node's native type stripping, so this file and its imports stay
// erasable TypeScript (no enums, namespaces, parameter properties) with explicit `.ts` import extensions.
// Every check below throws, which fails `npm run build` (N-13: a failed test blocks publishing).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parquetMetadata, parquetReadObjects } from 'hyparquet';
import { parquetWriteBuffer } from 'hyparquet-writer';
import type { ColumnSource } from 'hyparquet-writer';
import { z } from 'zod';
import { OPS_FILE, PL_FILES, TABLES, manifestSchema, tablesSchema } from '../lib/data/manifest.ts';
import type { Manifest, TableName } from '../lib/data/manifest.ts';
import { csvTable } from './csv.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const DATA = join(ROOT, '..', 'data', 'acme_pl_dummy_data');
const OUT = join(ROOT, 'public', 'data');

const MAX_TOTAL_BYTES = 5_000_000; // hard fail (ADR-0002 §2.2)
const BUDGET_FIRST_LOAD_BYTES = 3_000_000; // manifest + ops + pl-P (default entity, F-01)
const BUDGET_TOTAL_BYTES = 4_000_000;
const EXPECTED_ROWS = { [PL_FILES.P]: 334_700, [PL_FILES.S]: 88_012, [OPS_FILE]: 26_784 } as const;
const NR_BLOCKS = new Set(['GR', 'GTN']); // net revenue = GR + GTN (spec §3 step 3), the C-31 allocation key
const NATURE_BLOCKS = new Set(['COR', 'VSC', 'SM', 'RD', 'GA', 'OOI']); // operating costs before D&A (M-23)

const FACT_PL_COLUMNS = [
  'entity_code',
  'month_key',
  'version_key',
  'region_code',
  'channel_code',
  'line_code',
  'segment_code',
  'account_code',
  'counterparty_entity_code',
  'currency_code',
  'cost_centre_code',
  'amount_local',
] as const;
const FACT_OPS_COLUMNS = [
  'entity_code',
  'month_key',
  'version_key',
  'region_code',
  'channel_code',
  'line_code',
  'segment_code',
  'currency_code',
  'units_sold',
  'gmv_local',
  'active_merchants_end',
] as const;

type Fields12 = [string, string, string, string, string, string, string, string, string, string, string, string];
type Fields11 = [string, string, string, string, string, string, string, string, string, string, string];

function fail(message: string): never {
  throw new Error(`build-data: ${message}`);
}

const readCsv = (file: string) => readFileSync(join(DATA, file), 'utf8');

/** Exact 2-dp decimal string → integer cents (no float multiply). */
function toCents(raw: string, where: string): number {
  if (!/^-?\d{1,16}\.\d{2}$/.test(raw)) fail(`${where}: amount "${raw}" is not a 2-decimal number`);
  const cents = Number(raw.slice(0, -3) + raw.slice(-2));
  if (!Number.isSafeInteger(cents)) fail(`${where}: |cents| ≥ 2^53`);
  return cents;
}

function toInt32(raw: string, where: string): number {
  if (raw === '') return 0;
  const v = Number(raw);
  if (!Number.isInteger(v) || v < 0 || v > 2 ** 31 - 1) fail(`${where}: "${raw}" is not a non-negative int32`);
  return v;
}

// ---------- 1 · dimensions + parameters (validated by the manifest contract) ----------

function folderOf(name: TableName): string {
  if (name.startsWith('param_')) return 'params';
  if (name.startsWith('fact_')) return 'facts';
  return 'dims';
}

function toCell(raw: string, field: z.ZodType | undefined): unknown {
  if (raw === '') return null; // README: an empty cell means null
  const inner = field instanceof z.ZodNullable ? field.unwrap() : field;
  if (inner instanceof z.ZodNumber) return Number(raw);
  if (inner instanceof z.ZodBoolean) return raw === 'TRUE' ? true : raw === 'FALSE' ? false : raw;
  return raw; // strings and enums; Zod rejects anything else
}

function readRawTable(name: TableName): Record<string, unknown>[] {
  const shape: Record<string, z.ZodType> = TABLES[name].shape;
  const columns = Object.keys(shape);
  const file = `${folderOf(name)}/${name}.csv`;
  return [...csvTable(readCsv(file), columns, file)].map((record) =>
    Object.fromEntries(columns.map((c, j) => [c, toCell(record[j] ?? '', shape[c])])),
  );
}

const rawTables = Object.fromEntries((Object.keys(TABLES) as TableName[]).map((n) => [n, readRawTable(n)]));
const parsedTables = tablesSchema.safeParse(rawTables);
if (!parsedTables.success) fail(z.prettifyError(parsedTables.error));
const tables = parsedTables.data;

// T-07: every account has a block, a spine step that matches its block, an IFRS 18 category, and — for the nature
// lens (M-23/M-24) — nature weights summing to 1.
{
  const blocks = new Map(
    tables.dim_report_line.filter((l) => l.row_type === 'input_block').map((l) => [l.block_code, l.spine_step]),
  );
  const natures = new Set(tables.dim_nature.map((n) => n.nature_code));
  const accounts = new Set(tables.dim_account.map((a) => a.account_code));
  const weights = new Map<string, number>();
  for (const b of tables.bridge_account_nature) {
    if (!accounts.has(b.account_code)) fail(`T-07: bridge_account_nature account ${b.account_code} not in dim_account`);
    if (!natures.has(b.nature_code)) fail(`T-07: nature ${b.nature_code} not in dim_nature`);
    weights.set(b.account_code, (weights.get(b.account_code) ?? 0) + b.weight);
  }
  for (const a of tables.dim_account) {
    const step = blocks.get(a.block_code);
    if (step === undefined) fail(`T-07: ${a.account_code} block ${a.block_code} is not an input block`);
    if (step !== a.spine_step) fail(`T-07: ${a.account_code} spine step ${a.spine_step} ≠ block step ${step}`);
    if (NATURE_BLOCKS.has(a.block_code) && Math.abs((weights.get(a.account_code) ?? 0) - 1) > 1e-9)
      fail(`T-07: ${a.account_code} nature weights sum to ${weights.get(a.account_code) ?? 0}, not 1`);
  }
}

// dim_month must be the dense month index the Parquet month_idx column relies on.
tables.dim_month.forEach((m, i) => {
  if (m.month_index !== i) fail(`dim_month row ${i} has month_index ${m.month_index}`);
});

// ---------- 2 · dictionaries ----------

const shippedVersions = tables.dim_version
  .filter((v) => v.version_code !== 'Forecast' || v.is_latest_forecast) // older cycles (FC2606) are out (spec §11)
  .map((v) => v.version_key);
const entities = tables.dim_entity.map((e) => e.entity_code);
const dict: Manifest['dict'] = {
  entity: entities,
  version: shippedVersions,
  region: tables.dim_region.map((r) => r.region_code),
  channel: tables.dim_channel.map((c) => c.channel_code),
  line: tables.dim_line.map((l) => l.line_code),
  segment: tables.dim_segment.map((s) => s.segment_code),
  account: tables.dim_account.map((a) => a.account_code),
  counterparty: ['', ...entities],
};

const indexOf = (codes: readonly string[]) => new Map(codes.map((c, i) => [c, i]));
const ix = {
  entity: indexOf(dict.entity),
  version: indexOf(dict.version),
  region: indexOf(dict.region),
  channel: indexOf(dict.channel),
  line: indexOf(dict.line),
  segment: indexOf(dict.segment),
  account: indexOf(dict.account),
  counterparty: indexOf(dict.counterparty),
  month: indexOf(tables.dim_month.map((m) => m.month_key)),
};
const allVersions = new Set(tables.dim_version.map((v) => v.version_key));
const regionCurrency = new Map(tables.dim_region.map((r) => [r.region_code, r.functional_currency]));
const unassigned = new Set(
  [...tables.dim_channel, ...tables.dim_line, ...tables.dim_segment]
    .filter((d) => d.is_unassigned)
    .map((d) => ('channel_code' in d ? d.channel_code : 'line_code' in d ? d.line_code : d.segment_code)),
);
const accountByCode = new Map(tables.dim_account.map((a) => [a.account_code, a]));

function code(map: Map<string, number>, value: string, what: string, where: string): number {
  const i = map.get(value);
  if (i === undefined) fail(`${where}: unknown ${what} "${value}"`);
  return i;
}

// ---------- 3 · fact_pl → per-entity columns ----------

interface PlRows {
  month: number[];
  version: number[];
  region: number[];
  channel: number[];
  line: number[];
  segment: number[];
  account: number[];
  counterparty: number[];
  cents: number[];
}
const emptyPl = (): PlRows => ({
  month: [],
  version: [],
  region: [],
  channel: [],
  line: [],
  segment: [],
  account: [],
  counterparty: [],
  cents: [],
});
const pl: Record<string, PlRows> = Object.fromEntries(entities.map((e) => [e, emptyPl()]));

// Allocation inputs (C-31), keyed entity|version|month|region: NR per slice, and the below-CM totals per account.
const nrBySlice = new Map<string, Map<string, number>>();
const belowTotal = new Map<string, number>();
const costCentre = new Map<string, string>();

{
  let line = 1;
  for (const r of csvTable(readCsv('facts/fact_pl.csv'), FACT_PL_COLUMNS, 'fact_pl.csv')) {
    line++;
    const where = `fact_pl.csv:${line}`;
    // csvTable has checked the field count, so the tuple view is exact.
    const [entity, monthKey, versionKey, region, channel, lineCode, segment, accountCode, cp, currency, cc, amount] =
      r as Fields12;
    code(ix.entity, entity, 'entity', where);
    if (!allVersions.has(versionKey)) fail(`${where}: unknown version "${versionKey}"`);
    const account = accountByCode.get(accountCode) ?? fail(`${where}: unknown account "${accountCode}"`);
    if (!account.has_fact_rows) fail(`${where}: ${accountCode} is display-only (has_fact_rows = FALSE)`);
    if (account.entity_scope !== 'BOTH' && account.entity_scope !== entity)
      fail(`${where}: ${accountCode} (scope ${account.entity_scope}) booked on entity ${entity}`);
    if (regionCurrency.get(region) !== currency)
      fail(`${where}: currency ${currency} ≠ functional currency of ${region}`);
    if (cp === entity) fail(`${where}: counterparty equals entity`);
    const sliceUnassigned = [channel, lineCode, segment].map((s) => unassigned.has(s));
    if (
      account.is_below_cm !== sliceUnassigned.every(Boolean) ||
      (!account.is_below_cm && sliceUnassigned.some(Boolean))
    )
      fail(`${where}: ${accountCode} is_below_cm = ${account.is_below_cm} but slice ${channel}/${lineCode}/${segment}`);
    const ccKey = `${entity}|${accountCode}`;
    if ((costCentre.get(ccKey) ?? cc) !== cc)
      fail(`${where}: ${ccKey} has two cost centres — dropping the column would merge rows`);
    costCentre.set(ccKey, cc);
    const cents = toCents(amount, where);
    const month = code(ix.month, monthKey, 'month', where);
    const regionIdx = code(ix.region, region, 'region', where);
    const channelIdx = code(ix.channel, channel, 'channel', where);
    const lineIdx = code(ix.line, lineCode, 'line', where);
    const segmentIdx = code(ix.segment, segment, 'segment', where);
    const accountIdx = code(ix.account, accountCode, 'account', where);
    const cpIdx = code(ix.counterparty, cp, 'counterparty', where);

    const version = ix.version.get(versionKey);
    if (version === undefined) continue; // validated above, not shipped

    const p = pl[entity] ?? fail(`${where}: entity ${entity}`);
    p.month.push(month);
    p.version.push(version);
    p.region.push(regionIdx);
    p.channel.push(channelIdx);
    p.line.push(lineIdx);
    p.segment.push(segmentIdx);
    p.account.push(accountIdx);
    p.counterparty.push(cpIdx);
    p.cents.push(cents);

    const group = `${entity}|${versionKey}|${monthKey}|${region}`;
    if (NR_BLOCKS.has(account.block_code)) {
      const slices = nrBySlice.get(group) ?? new Map<string, number>();
      const slice = `${channel}|${lineCode}|${segment}`;
      slices.set(slice, (slices.get(slice) ?? 0) + cents);
      nrBySlice.set(group, slices);
    } else if (account.is_below_cm) {
      const key = `${group}|${accountCode}`;
      belowTotal.set(key, (belowTotal.get(key) ?? 0) + cents);
    }
  }
}

/** Sort (version, month, account, region, channel, line, segment, counterparty) and reject duplicate grain. */
function sortedOrder(p: PlRows, where: string): Int32Array {
  const n = p.cents.length;
  const key = new Float64Array(n);
  const dims = [
    [p.version, dict.version.length],
    [p.month, tables.dim_month.length],
    [p.account, dict.account.length],
    [p.region, dict.region.length],
    [p.channel, dict.channel.length],
    [p.line, dict.line.length],
    [p.segment, dict.segment.length],
    [p.counterparty, dict.counterparty.length],
  ] as const;
  for (let i = 0; i < n; i++) {
    let k = 0;
    for (const [col, size] of dims) k = k * size + (col[i] ?? 0);
    key[i] = k;
  }
  const order = Int32Array.from({ length: n }, (_, i) => i).sort((a, b) => (key[a] ?? 0) - (key[b] ?? 0));
  for (let i = 1; i < n; i++)
    if (key[order[i] ?? 0] === key[order[i - 1] ?? 0])
      fail(`${where}: duplicate row at the D-01 grain without cost centre`);
  return order;
}

const int32Column = (name: string, values: readonly number[], order: Int32Array): ColumnSource => ({
  name,
  data: Int32Array.from(order, (i) => values[i] ?? 0),
  type: 'INT32',
  nullable: false,
});

function plColumns(p: PlRows, order: Int32Array): ColumnSource[] {
  return [
    int32Column('month_idx', p.month, order),
    int32Column('version', p.version, order),
    int32Column('region', p.region, order),
    int32Column('channel', p.channel, order),
    int32Column('line', p.line, order),
    int32Column('segment', p.segment, order),
    int32Column('account', p.account, order),
    int32Column('counterparty', p.counterparty, order),
    {
      name: 'cents', // DOUBLE holding integer cents: exact sums below 2^53; int32 has too little headroom
      data: Float64Array.from(order, (i) => p.cents[i] ?? 0),
      type: 'DOUBLE',
      nullable: false,
      encoding: 'BYTE_STREAM_SPLIT',
    },
  ];
}

// ---------- 4 · allocation parity vs fact_pl_allocated (C-31 formula vs D-02; Q3 open, ADR-0002 §2.2) ----------
// Engine formula: allocated = line(entity, region, month) × NR(slice) ÷ NR(entity, region). The generator rounds each
// slice to cents and pushes the residual to the largest slice, so: per group Σ D-02 = the fact_pl total exactly (T-03
// at source); every slice within half a cent of the formula, except at most one residual slice per group.

const parity = { groups: 0, rows: 0, maxSliceDiffCents: 0, maxResidualCents: 0 };
{
  const seen = new Map<string, { sum: number; residuals: number }>();
  let line = 1;
  for (const r of csvTable(readCsv('facts/fact_pl_allocated.csv'), FACT_PL_COLUMNS, 'fact_pl_allocated.csv')) {
    line++;
    const where = `fact_pl_allocated.csv:${line}`;
    const [entity, monthKey, versionKey, region, channel, lineCode, segment, accountCode, , , , amount] = r as Fields12;
    if (!ix.version.has(versionKey)) continue;
    if (!accountByCode.get(accountCode)?.is_below_cm) fail(`${where}: ${accountCode} is not a below-CM account`);
    const group = `${entity}|${versionKey}|${monthKey}|${region}`;
    const key = `${group}|${accountCode}`;
    const total = belowTotal.get(key) ?? fail(`${where}: no fact_pl total for ${key}`);
    const slices = nrBySlice.get(group) ?? fail(`${where}: no net revenue for ${group}`);
    let regionNr = 0;
    for (const v of slices.values()) regionNr += v;
    if (regionNr === 0) fail(`${where}: zero net revenue in ${group}`);
    const expected = (total * (slices.get(`${channel}|${lineCode}|${segment}`) ?? 0)) / regionNr;
    const cents = toCents(amount, where);
    const diff = Math.abs(cents - expected);
    const s = seen.get(key) ?? { sum: 0, residuals: 0 };
    s.sum += cents;
    if (diff <= 0.5 + 1e-6) parity.maxSliceDiffCents = Math.max(parity.maxSliceDiffCents, diff);
    else {
      s.residuals++;
      if (s.residuals > 1 || diff > 0.5 * slices.size + 0.5)
        fail(`${where}: allocation ${cents} vs formula ${expected.toFixed(2)} cents`);
      parity.maxResidualCents = Math.max(parity.maxResidualCents, diff);
    }
    seen.set(key, s);
    parity.rows++;
  }
  for (const [key, total] of belowTotal) {
    const s = seen.get(key);
    if (total !== 0 && s?.sum !== total)
      fail(`allocation: Σ fact_pl_allocated ${s?.sum ?? 'none'} ≠ fact_pl ${total} for ${key}`);
  }
  parity.groups = seen.size;
}

// ---------- 5 · fact_operational → ops columns ----------

const ops = {
  entity: [] as number[],
  month: [] as number[],
  version: [] as number[],
  region: [] as number[],
  channel: [] as number[],
  line: [] as number[],
  segment: [] as number[],
  units: [] as number[],
  gmvCents: [] as number[],
  merchants: [] as number[],
};
{
  let line = 1;
  for (const r of csvTable(readCsv('facts/fact_operational.csv'), FACT_OPS_COLUMNS, 'fact_operational.csv')) {
    line++;
    const where = `fact_operational.csv:${line}`;
    const [entity, monthKey, versionKey, region, channel, lineCode, segment, currency, units, gmv, merchants] =
      r as Fields11;
    if (!allVersions.has(versionKey)) fail(`${where}: unknown version "${versionKey}"`);
    if (regionCurrency.get(region) !== currency)
      fail(`${where}: currency ${currency} ≠ functional currency of ${region}`);
    const row = {
      entity: code(ix.entity, entity, 'entity', where),
      month: code(ix.month, monthKey, 'month', where),
      region: code(ix.region, region, 'region', where),
      channel: code(ix.channel, channel, 'channel', where),
      line: code(ix.line, lineCode, 'line', where),
      segment: code(ix.segment, segment, 'segment', where),
      // An empty measure cell is a zero the generator skipped writing; 0 is lossless for flows and month-end counts.
      units: toInt32(units, where),
      gmvCents: gmv === '' ? 0 : toCents(gmv, where),
      merchants: toInt32(merchants, where),
    };
    const version = ix.version.get(versionKey);
    if (version === undefined) continue;
    for (const k of Object.keys(row) as (keyof typeof row)[]) ops[k].push(row[k]);
    ops.version.push(version);
  }
}

// ---------- 6 · encode, verify, write ----------

const written: Record<string, { rows: number; bytes: number; buffer: ArrayBuffer; first: Record<string, number>[] }> =
  {};

function encode(file: keyof typeof EXPECTED_ROWS, columns: ColumnSource[]): void {
  const rows = columns[0]?.data.length ?? 0;
  if (rows !== EXPECTED_ROWS[file]) fail(`${file}: ${rows} rows, expected ${EXPECTED_ROWS[file]}`);
  const buffer = parquetWriteBuffer({
    columnData: columns,
    rowGroupSize: rows,
    createdBy: 'acme-pnl js-report build-data',
  });
  const first = Array.from({ length: Math.min(5, rows) }, (_, i) =>
    Object.fromEntries(columns.map((c) => [c.name, Number(c.data[i])])),
  );
  written[file] = { rows, bytes: buffer.byteLength, buffer, first };
}

for (const e of entities) {
  const file = PL_FILES[e];
  const p = pl[e] ?? emptyPl();
  encode(file, plColumns(p, sortedOrder(p, file)));
}
{
  const all = Int32Array.from({ length: ops.entity.length }, (_, i) => i);
  encode(OPS_FILE, [
    int32Column('entity', ops.entity, all),
    int32Column('month_idx', ops.month, all),
    int32Column('version', ops.version, all),
    int32Column('region', ops.region, all),
    int32Column('channel', ops.channel, all),
    int32Column('line', ops.line, all),
    int32Column('segment', ops.segment, all),
    int32Column('units', ops.units, all),
    {
      name: 'gmv_cents',
      data: Float64Array.from(ops.gmvCents),
      type: 'DOUBLE',
      nullable: false,
      encoding: 'BYTE_STREAM_SPLIT',
    },
    int32Column('merchants', ops.merchants, all),
  ]);
}

// Read round-trip: row count from the footer, first 5 rows equal what was written.
for (const [file, w] of Object.entries(written)) {
  const meta = parquetMetadata(w.buffer);
  if (Number(meta.num_rows) !== w.rows) fail(`${file}: footer says ${meta.num_rows} rows, wrote ${w.rows}`);
  const back = await parquetReadObjects({ file: w.buffer, rowStart: 0, rowEnd: 5 });
  const got = JSON.stringify(
    back.map((row) => Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)]))),
  );
  if (got !== JSON.stringify(w.first))
    fail(`${file}: read round-trip mismatch\n  wrote ${JSON.stringify(w.first)}\n  read  ${got}`);
}

const manifest = manifestSchema.parse({
  schemaVersion: 1,
  builtAt: new Date().toISOString(),
  files: Object.fromEntries(Object.entries(written).map(([f, w]) => [f, { rows: w.rows, bytes: w.bytes }])),
  dict,
  tables,
});
const manifestText = JSON.stringify(manifest);

const manifestBytes = Buffer.byteLength(manifestText);
const bytesOf = (f: string) => written[f]?.bytes ?? 0;
const firstLoad = manifestBytes + bytesOf(OPS_FILE) + bytesOf(PL_FILES.P);
const total = manifestBytes + Object.values(written).reduce((s, w) => s + w.bytes, 0);
const kb = (b: number) => `${(b / 1000).toFixed(1)} kB`;

console.log('build-data → public/data');
for (const [f, w] of Object.entries(written))
  console.log(`  ${f.padEnd(14)} ${String(w.rows).padStart(8)} rows  ${kb(w.bytes)}`);
console.log(`  ${'manifest.json'.padEnd(14)} ${''.padStart(8)}       ${kb(manifestBytes)}`);
console.log(
  `  first load ${kb(firstLoad)} (budget ${kb(BUDGET_FIRST_LOAD_BYTES)}) · total ${kb(total)} (budget ${kb(BUDGET_TOTAL_BYTES)}, hard limit ${kb(MAX_TOTAL_BYTES)})`,
);
console.log(
  `  T-07 ok · allocation parity ok: ${parity.rows} rows in ${parity.groups} groups, max slice diff ${parity.maxSliceDiffCents.toFixed(3)} ¢, max residual ${parity.maxResidualCents.toFixed(1)} ¢`,
);
if (firstLoad > BUDGET_FIRST_LOAD_BYTES || total > BUDGET_TOTAL_BYTES) console.warn('  WARNING: over the size budget');
if (total > MAX_TOTAL_BYTES) fail(`artifacts total ${kb(total)} > ${kb(MAX_TOTAL_BYTES)}`);

// Only now, with every check green, replace the artifacts.
mkdirSync(OUT, { recursive: true });
for (const [file, w] of Object.entries(written)) writeFileSync(join(OUT, file), new Uint8Array(w.buffer));
writeFileSync(join(OUT, 'manifest.json'), manifestText);
