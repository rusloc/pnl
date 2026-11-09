// ACME Trucks data build (contract docs/ADD/features/trucks-js-flavour.md §2; ADR-0016 (a)): the live extract in
// ../pbi-report/ACME Trucks/data/ → public/data/ (manifest.json + four Parquet files at loader × business week). The
// literal tables and the SWITCH columns are read from the TMDL at build time, so they are verbatim by construction.
// Cyrillic file and column names live only in this script. `--keep-excluded` also writes the test fixture set
// fixtures/data-unfiltered/ (every dim_loader row, §2.2). The checks of §2.4 run here; every failure throws, which fails
// `npm run build` (prebuild). Source files are ZSTD-compressed; Node's built-in zstd decodes them (no new dependency).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zstdDecompressSync } from 'node:zlib';
import { parquetMetadata, parquetReadObjects } from 'hyparquet';
import { parquetWriteBuffer } from 'hyparquet-writer';
import type { ColumnSource } from 'hyparquet-writer';
import { z } from 'zod';
import {
  FILES,
  FIRST_PAINT_FILES,
  TIME_SORTS,
  WORK_TYPES,
  hrsColumn,
  manifestSchema,
  secColumn,
  unfilteredManifestSchema,
} from '../lib/data/manifest.ts';
import type { FileKey, Manifest, TimeSort, WorkType } from '../lib/data/manifest.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REPORT = join(ROOT, '..', 'pbi-report', 'ACME Trucks');
const DATA = join(REPORT, 'data');
const TMDL = join(REPORT, 'Trucks.SemanticModel', 'definition', 'tables');
const OUT = join(ROOT, 'public', 'data');
const OUT_UNFILTERED = join(ROOT, 'fixtures', 'data-unfiltered');
const KEEP_EXCLUDED = process.argv.includes('--keep-excluded');

const FIRST_PAINT_BUDGET = 900_000; // §2.3: first paint ≤ 900 kB (hard fail 1.2 MB)
const FIRST_PAINT_MAX = 1_200_000;
const TOTAL_BUDGET = 1_300_000; // total ≤ 1.3 MB (hard fail 1.8 MB)
const TOTAL_MAX = 1_800_000;
const EXTRACT_DATE = '2026-10-21'; // when the live model was snapshotted (M comments of the partitions)

function fail(message: string): never {
  throw new Error(`build-trucks-data: ${message}`);
}

// ---------- 1 · source files + footers (§2.4 check 1) ----------

const SOURCE = {
  dim_date: {
    file: 'Calendar.parquet',
    rows: 156,
    columns: ['_weekStartBiz', '_weekEndBiz', '_weekNumBiz', 'Date', '_dateSpanBiz', '_sortSpan'],
  },
  dim_loader: {
    file: 'Справочник ЭКС.parquet',
    rows: 168,
    columns: ['Филиал', 'Название ЭКС в ГД', 'objrem_id', 'Объем ковша', 'Учитывать', 'Подрядчик'],
  },
  fact_interval: { file: 'intervals.parquet', rows: 891, columns: ['vehicle_export_code', 'vehicle_group_code'] },
  fact_time_actual: {
    file: 'ПФ КРВ.parquet',
    rows: 203_867,
    columns: ['vehicle_export_code', 'dat', 'idle_name_for_op', 'duration'],
  },
  fact_time_plan_week: {
    file: 'План_2.parquet',
    rows: 394_056,
    columns: ['vehicle_export_code', 'dat', 'indicator_name', 'indicator_amount'],
  },
  fact_time_plan_month: {
    file: 'План_2_МЕС.parquet',
    rows: 249_080,
    columns: ['vehicle_export_code', 'dat', 'indicator_name', 'indicator_amount'],
  },
  fact_rock_mass: {
    file: 'ПФ объемы.parquet',
    rows: 18_684,
    columns: [
      'Дата',
      'Экспортный код',
      'Объем ГМ на авто план',
      'Объем ГМ на авто факт',
      'Объем ГМ на авто план месяц',
    ],
  },
} as const;
type SourceTable = keyof typeof SOURCE;
type SourceRow = Record<string, unknown>;

const compressors = { ZSTD: (input: Uint8Array) => new Uint8Array(zstdDecompressSync(input)) };

async function read(table: SourceTable): Promise<SourceRow[]> {
  const { file, rows, columns } = SOURCE[table];
  const b = readFileSync(join(DATA, file));
  const buffer = b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  const meta = parquetMetadata(buffer);
  if (Number(meta.num_rows) !== rows) fail(`${file}: ${meta.num_rows} rows, expected ${rows}`);
  const present = new Set(meta.schema.slice(1).map((s) => s.name));
  for (const c of columns) if (!present.has(c)) fail(`${file}: column "${c}" is missing`);
  const out = (await parquetReadObjects({ file: buffer, columns: [...columns], compressors })) as SourceRow[];
  if (out.length !== rows) fail(`${file}: read ${out.length} rows, expected ${rows}`);
  return out;
}

const iso = (v: unknown): string =>
  v instanceof Date ? v.toISOString().slice(0, 10) : fail(`"${String(v)}" is not a date`);
const num = (v: unknown): number => {
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isSafeInteger(n) ? n : fail(`int64 ${v} outside the safe range`);
  }
  return typeof v === 'number' ? v : fail(`"${String(v)}" is not a number`);
};
const str = (v: unknown): string => (typeof v === 'string' ? v : fail(`"${String(v)}" is not text`));

const [calendarRows, loaderRows, intervalRows, factRows, planWeekRows, planMonthRows, rockRows] = await Promise.all([
  read('dim_date'),
  read('dim_loader'),
  read('fact_interval'),
  read('fact_time_actual'),
  read('fact_time_plan_week'),
  read('fact_time_plan_month'),
  read('fact_rock_mass'),
]);

// ---------- 2 · literal tables and SWITCH columns, verbatim from the TMDL (§2.1) ----------

const tmdl = (name: string) => readFileSync(join(TMDL, `${name}.tmdl`), 'utf8');
const dq = '"((?:[^"]|"")*)"';
const unquote = (s: string | undefined) => (s ?? fail('regex group missing')).replaceAll('""', '"');

const pairs = (text: string, re: RegExp): [string, string][] =>
  [...text.matchAll(re)].map((m) => [unquote(m[1]), unquote(m[2])]);

const rowPair = new RegExp(`\\{${dq},${dq}\\}`, 'g');
const bridgeFact = pairs(tmdl('bridge_fact_time_category'), rowPair).slice(1); // the first pair is the column header row
const bridgePlan = pairs(tmdl('bridge_plan_time_category'), rowPair).slice(1);
if (bridgeFact.length !== 22) fail(`bridge_fact_time_category: ${bridgeFact.length} rows, expected 22`);
if (bridgePlan.length !== 25) fail(`bridge_plan_time_category: ${bridgePlan.length} rows, expected 25`);

const dimText = tmdl('dim_time_category');
const dimRows = [...dimText.matchAll(new RegExp(`\\{${dq},"(\\d+)","([01])",${dq}\\}`, 'g'))].map((m) => ({
  category_code: unquote(m[1]),
  sort_order: Number(m[2]),
  is_shown: m[3] as '1' | '0',
  is_included: unquote(m[4]) as 'да' | 'нет',
}));
if (dimRows.length !== 31) fail(`dim_time_category: ${dimRows.length} rows, expected 31`);
const categoryNames = new Map(
  [...dimText.matchAll(new RegExp(`\\[sort_order\\] = (\\d+)\\s*,${dq}`, 'g'))].map((m) => [
    Number(m[1]),
    unquote(m[2]),
  ]),
);
const loaderText = tmdl('dim_loader');
const officeNames = new Map(pairs(loaderText, new RegExp(`\\[branch_name\\] = ${dq}\\s*,${dq}`, 'g')));
const loaderNames = new Map(pairs(loaderText, new RegExp(`\\[loader_name_dispatch\\] = ${dq},${dq}`, 'g')));
if (officeNames.size !== 6) fail(`office_name SWITCH: ${officeNames.size} branches, expected 6`);

const SUBTOTAL_SORTS = new Set([1, 6, 24, 27]); // _WF Is Subtotal

// ---------- 3 · calendar → 23 business weeks (§2.2, §2.4 check 3) ----------

interface Week {
  label: string;
  sort: number;
  num: number;
  start: string;
  end: string;
  dates: string[];
}
const weekByLabel = new Map<string, Week>();
for (const r of calendarRows) {
  const label = str(r._dateSpanBiz);
  let w = weekByLabel.get(label);
  if (!w) {
    w = {
      label,
      sort: num(r._sortSpan),
      num: num(r._weekNumBiz),
      start: iso(r._weekStartBiz),
      end: iso(r._weekEndBiz),
      dates: [],
    };
    weekByLabel.set(label, w);
  }
  w.dates.push(iso(r.Date));
}
const weeks = [...weekByLabel.values()].sort((a, b) => a.sort - b.sort);
if (weeks.length !== 23) fail(`${weeks.length} business weeks, expected 23`);
weeks.forEach((w, i) => {
  const expected = i === weeks.length - 1 ? 2 : 7;
  if (w.dates.length !== expected) fail(`week ${w.label}: ${w.dates.length} days, expected ${expected}`);
});
const weekOfDate = new Map(weeks.flatMap((w, i) => w.dates.map((d) => [d, i] as const)));
const weekIx = (v: unknown, table: string): number => {
  const d = iso(v);
  return weekOfDate.get(d) ?? fail(`${table}: date ${d} is outside Calendar.parquet`);
};

// ---------- 4 · category joins, case-insensitive at every step (R1, §2.4 check 4) ----------

const fold = (s: string) => s.toLowerCase();
const dimByFolded = new Map(dimRows.map((d) => [fold(d.category_code), d]));
const caseOnly = new Set<string>();

function joiner(bridge: readonly [string, string][]) {
  const exact = new Map(bridge);
  const byFolded = new Map(bridge.map(([k, v]) => [fold(k), v]));
  return (source: string): TimeSort | 'drop' => {
    const chart = byFolded.get(fold(source));
    if (chart === undefined) return 'drop';
    if (!exact.has(source)) caseOnly.add(source);
    const dim = dimByFolded.get(fold(chart));
    if (!dim) return 'drop'; // "Не учитывать" and anything else without a dim_time_category row
    if (dim.category_code !== chart) caseOnly.add(chart);
    if (!(TIME_SORTS as readonly number[]).includes(dim.sort_order))
      fail(`chart category "${chart}" lands on sort ${dim.sort_order}, which has no shipped column`);
    return dim.sort_order as TimeSort; // checked against TIME_SORTS on the line above
  };
}

// fact_time_actual[idle_name_for_op_2], fact_time_plan_*[indicator_name_2]: the TMDL SWITCH columns (§2.2)
const IDLE_2: Record<string, string> = {
  ktg: 'КТГ',
  kio: 'КИО',
  Пересменка: 'Пересменок',
  'Ожидание а/с': 'Ожидание АС',
  kfv: 'КФВ',
};
const INDICATOR_2: Record<string, string> = { 'КТГ план': 'КТГ', Проверка: 'КФВ' };
const factJoin = joiner(bridgeFact);
const planJoin = joiner(bridgePlan);
const factSort = (idle: string) => factJoin(IDLE_2[idle] ?? idle);
const planSort = (indicator: string) => planJoin(INDICATOR_2[indicator] ?? indicator);

// ---------- 5 · loaders: fixed filters, names, work type (§2.2, §2.4 check 6) ----------

const groupMax = new Map<number, number>();
for (const r of intervalRows) {
  const id = num(r.vehicle_export_code);
  groupMax.set(id, Math.max(groupMax.get(id) ?? -Infinity, num(r.vehicle_group_code)));
}
function workType(id: number): WorkType | null {
  const g = groupMax.get(id);
  if (g === undefined) return 'Undefined';
  return g === 1 ? 'On spot' : g === 2 ? 'Trucks' : null; // FORMAT(g, "###") of anything else is neither "1" nor "2"
}

interface LoaderRow {
  id: number;
  name: string;
  office: string;
  volume: number;
  workType: WorkType | null;
  included: boolean;
  contractorBlank: boolean;
}
const allLoaders: LoaderRow[] = loaderRows.map((r, i) => {
  const dispatch = str(r['Название ЭКС в ГД']);
  const branch = str(r['Филиал']);
  return {
    id: num(r.objrem_id),
    name: loaderNames.get(dispatch) ?? `UNNAMED-${i}`,
    office: officeNames.get(branch) ?? fail(`branch "${branch}" is not in the office_name SWITCH`),
    volume: num(r['Объем ковша']),
    workType: workType(num(r.objrem_id)),
    included: r['Учитывать'] === 'да',
    contractorBlank: r['Подрядчик'] === null || r['Подрядчик'] === undefined,
  };
});
const byName = (a: LoaderRow, b: LoaderRow) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
const shipped = allLoaders.filter((l) => l.included && l.contractorBlank).sort(byName);
if (shipped.length !== 131) fail(`${shipped.length} loaders pass the fixed filters, expected 131`);
for (const l of shipped) if (l.name.startsWith('UNNAMED-')) fail(`included loader ${l.id} has no loader_name`);
if (new Set(shipped.map((l) => l.name)).size !== 131) fail('loader_name is not unique among the shipped loaders');

const counts = Object.fromEntries(WORK_TYPES.map((t) => [t, shipped.filter((l) => l.workType === t).length]));
const blankWork = shipped.filter((l) => l.workType === null).length;
if (counts.Undefined !== 1 || blankWork !== 0) fail(`work types ${JSON.stringify(counts)}, blank ${blankWork}`);

// ---------- 6 · aggregate to loader × week (§2.1) ----------

type Acc = { n_rows: number } & Record<string, number | null>;

interface Aggregated {
  time: Map<number, Acc>;
  planWeek: Map<number, Acc>;
  planMonth: Map<number, Acc>;
  rock: Map<number, Acc>;
  sums: { time: number; planWeek: number; planMonth: number; rockPlan: number; rockFact: number; rockMonth: number };
  counted: { time: number; planWeek: number; planMonth: number; rock: number };
  factFirst: string;
  factLast: string;
  monthFirst: string;
  allDurationSec: number;
}

const NW = weeks.length;

function aggregate(loaders: readonly LoaderRow[], blankMember: number | null): Aggregated {
  const ixOf = new Map(loaders.map((l, i) => [l.id, i]));
  const key = (loader: number, week: number) => loader * NW + week;
  const loaderIx = (id: number) => ixOf.get(id) ?? blankMember;
  const acc = (m: Map<number, Acc>, k: number): Acc => {
    let a = m.get(k);
    if (!a) m.set(k, (a = { n_rows: 0 } as Acc));
    return a;
  };
  const add = (a: Acc, col: string, v: number) => {
    a[col] = (a[col] ?? 0) + v;
  };
  const out: Aggregated = {
    time: new Map(),
    planWeek: new Map(),
    planMonth: new Map(),
    rock: new Map(),
    sums: { time: 0, planWeek: 0, planMonth: 0, rockPlan: 0, rockFact: 0, rockMonth: 0 },
    counted: { time: 0, planWeek: 0, planMonth: 0, rock: 0 },
    factFirst: '9999',
    factLast: '0000',
    monthFirst: '9999',
    allDurationSec: 0,
  };

  for (const r of factRows) {
    const week = weekIx(r.dat, 'fact_time_actual');
    const d = iso(r.dat);
    if (d < out.factFirst) out.factFirst = d;
    if (d > out.factLast) out.factLast = d;
    const duration = num(r.duration);
    out.allDurationSec += duration;
    const ix = loaderIx(num(r.vehicle_export_code));
    if (ix === null) continue;
    const a = acc(out.time, key(ix, week));
    a.n_rows += 1;
    out.counted.time += 1;
    const sort = factSort(str(r.idle_name_for_op));
    if (sort === 'drop') continue;
    add(a, secColumn(sort), duration);
    out.sums.time += duration;
  }

  const plan = (rows: readonly SourceRow[], target: Map<number, Acc>, label: 'planWeek' | 'planMonth') => {
    for (const r of rows) {
      const week = weekIx(r.dat, label);
      if (label === 'planMonth') {
        const d = iso(r.dat);
        if (d < out.monthFirst) out.monthFirst = d;
      }
      const ix = loaderIx(num(r.vehicle_export_code));
      if (ix === null) continue;
      const a = acc(target, key(ix, week));
      a.n_rows += 1;
      out.counted[label] += 1;
      const sort = planSort(str(r.indicator_name));
      if (sort === 'drop') continue;
      const amount = num(r.indicator_amount);
      add(a, hrsColumn(sort), amount);
      out.sums[label] += amount;
    }
  };
  plan(planWeekRows, out.planWeek, 'planWeek');
  plan(planMonthRows, out.planMonth, 'planMonth');

  for (const r of rockRows) {
    const week = weekIx(r['Дата'], 'fact_rock_mass');
    const ix = loaderIx(num(r['Экспортный код']));
    if (ix === null) continue;
    const a = acc(out.rock, key(ix, week));
    a.n_rows += 1;
    out.counted.rock += 1;
    const put = (
      col: 'rock_mass_truck_plan' | 'rock_mass_truck_fact' | 'rock_mass_truck_plan_month',
      v: unknown,
      sum: 'rockPlan' | 'rockFact' | 'rockMonth',
    ) => {
      if (v === null || v === undefined) return;
      add(a, col, num(v));
      out.sums[sum] += num(v);
    };
    put('rock_mass_truck_plan', r['Объем ГМ на авто план'], 'rockPlan');
    put('rock_mass_truck_fact', r['Объем ГМ на авто факт'], 'rockFact');
    put('rock_mass_truck_plan_month', r['Объем ГМ на авто план месяц'], 'rockMonth');
  }
  return out;
}

const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a));

function checkLossless(a: Aggregated, label: string) {
  const total = (m: Map<number, Acc>, cols: readonly string[]) => {
    let s = 0;
    for (const row of m.values()) for (const c of cols) s += row[c] ?? 0;
    return s;
  };
  const rows = (m: Map<number, Acc>) => [...m.values()].reduce((s, row) => s + row.n_rows, 0);
  const SEC = TIME_SORTS.map(secColumn);
  const HRS = TIME_SORTS.map(hrsColumn);
  const eq = (what: string, got: number, want: number) => {
    if (!close(got, want)) fail(`${label}: lossless check ${what}: ${got} ≠ ${want}`);
  };
  eq('Σ sec_*', total(a.time, SEC), a.sums.time);
  eq('Σ hrs_* (week)', total(a.planWeek, HRS), a.sums.planWeek);
  eq('Σ hrs_* (month)', total(a.planMonth, HRS), a.sums.planMonth);
  eq('Σ rock plan', total(a.rock, ['rock_mass_truck_plan']), a.sums.rockPlan);
  eq('Σ rock fact', total(a.rock, ['rock_mass_truck_fact']), a.sums.rockFact);
  eq('Σ rock month', total(a.rock, ['rock_mass_truck_plan_month']), a.sums.rockMonth);
  eq('Σ n_rows (time)', rows(a.time), a.counted.time);
  eq('Σ n_rows (week plan)', rows(a.planWeek), a.counted.planWeek);
  eq('Σ n_rows (month plan)', rows(a.planMonth), a.counted.planMonth);
  eq('Σ n_rows (rock)', rows(a.rock), a.counted.rock);
}

const g = aggregate(shipped, null);
checkLossless(g, 'shipped');

// §2.4 check 4: exactly these source values match only through case folding
const expectedCaseOnly = ['Авар. Прост.', 'Консервация/резерв'];
if ([...caseOnly].sort().join('|') !== [...expectedCaseOnly].sort().join('|'))
  fail(`case-only matches: ${[...caseOnly].join(', ')}; expected exactly ${expectedCaseOnly.join(', ')}`);

// §2.4 check 5: totals present
const SEC_01 = secColumn(1);
const HRS_01 = hrsColumn(1);
for (const [k, a] of g.time) if (!((a[SEC_01] ?? 0) > 0)) fail(`time-week key ${k}: sec_01 missing`);
function checkPlan(m: Map<number, Acc>, label: string, expectedNoHours: number) {
  let withoutHours = 0;
  for (const [k, a] of m) {
    const any = TIME_SORTS.some((s) => (a[hrsColumn(s)] ?? null) !== null);
    if (!any) withoutHours += 1;
    else if (!((a[HRS_01] ?? 0) > 0)) fail(`${label} key ${k}: hrs_01 missing on a row with hours`);
  }
  if (withoutHours !== expectedNoHours)
    fail(`${label}: ${withoutHours} loader-weeks without hours, expected ${expectedNoHours}`);
}
checkPlan(g.planWeek, 'plan-week', 1);
checkPlan(g.planMonth, 'plan-month', 28);
if (g.monthFirst !== '2023-01-01') fail(`month plan starts ${g.monthFirst}, expected 2023-01-01 (R7)`);

// ---------- 7 · write ----------

function encode(fk: FileKey, rows: readonly Record<string, number | null>[]): ArrayBuffer {
  if (rows.length === 0) fail(`${fk}: no rows`);
  const columnData: ColumnSource[] = Object.entries(FILES[fk].columns).map(([name, kind]) => {
    if (kind === 'int') {
      const data = rows.map((r) => r[name] ?? fail(`${fk}.${name}: null key`));
      return { name, data: Int32Array.from(data), type: 'INT32', nullable: false };
    }
    return { name, data: rows.map((r) => r[name] ?? null), type: 'DOUBLE', nullable: true };
  });
  return parquetWriteBuffer({ columnData, rowGroupSize: rows.length, createdBy: 'acme js-trucks build-trucks-data' });
}

const toRows = (m: Map<number, Acc>) =>
  [...m.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([k, a]) => ({ loader_ix: Math.floor(k / NW), week_ix: k % NW, ...a }));

function writeSet(dir: string, a: Aggregated): Manifest['files'] {
  mkdirSync(dir, { recursive: true });
  const rows: Record<FileKey, Record<string, number | null>[]> = {
    timeWeek: toRows(a.time),
    planMonth: toRows(a.planMonth),
    planWeek: toRows(a.planWeek),
    rockWeek: toRows(a.rock),
  };
  const files = {} as Manifest['files'];
  for (const fk of Object.keys(FILES) as FileKey[]) {
    const buffer = encode(fk, rows[fk]);
    writeFileSync(join(dir, FILES[fk].file), new Uint8Array(buffer));
    files[fk] = { name: FILES[fk].file, rows: rows[fk].length, bytes: buffer.byteLength };
  }
  return files;
}

const manifestCommon = {
  weeks: weeks.map((w, week_ix) => ({
    week_ix,
    week_label: w.label,
    sort_span: w.sort,
    week_num: w.num,
    week_start: w.start,
    week_end: w.end,
    year: Number(w.end.slice(0, 4)),
    days: w.dates.length,
  })),
  categories: [...dimRows]
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((d) => ({
      sort_order: d.sort_order,
      category_code: d.category_code,
      category_name: categoryNames.get(d.sort_order) ?? fail(`no category_name for sort ${d.sort_order}`),
      is_shown: d.is_shown,
      is_included: d.is_included,
      row_kind: SUBTOTAL_SORTS.has(d.sort_order) ? ('subtotal' as const) : ('loss' as const),
    })),
  offices: [...new Set(shipped.map((l) => l.office))]
    .sort()
    .map((office_name, sort_order) => ({ office_name, sort_order })),
  work_types: [...WORK_TYPES],
};
const meta = (a: Aggregated) => ({
  extract_date: EXTRACT_DATE,
  calendar_first: [...weekOfDate.keys()].sort()[0] ?? fail('no dates'),
  calendar_last: [...weekOfDate.keys()].sort().at(-1) ?? fail('no dates'),
  fact_first: a.factFirst,
  fact_last: a.factLast,
  month_plan_first: a.monthFirst,
  culture: 'ru-RU' as const,
});

const files = writeSet(OUT, g);
const parsed = manifestSchema.safeParse({
  schema: 'acme-trucks/1',
  meta: meta(g),
  ...manifestCommon,
  loaders: shipped.map((l, loader_ix) => ({
    loader_ix,
    loader_name: l.name,
    office_name: l.office,
    bucket_volume_m3: l.volume,
    work_type: l.workType,
  })),
  files,
});
if (!parsed.success) fail(z.prettifyError(parsed.error));
const manifestText = `${JSON.stringify(parsed.data)}\n`;
writeFileSync(join(OUT, 'manifest.json'), manifestText);

if (KEEP_EXCLUDED) {
  const blankIx = allLoaders.length; // the model's blank dim_loader member: fact rows whose loader has no dim row
  const a = aggregate(allLoaders, blankIx);
  checkLossless(a, 'unfiltered');
  const fixtureFiles = writeSet(OUT_UNFILTERED, a);
  const fixture = unfilteredManifestSchema.safeParse({
    schema: 'acme-trucks-unfiltered/1',
    meta: { ...meta(a), fact_duration_sec_all: a.allDurationSec },
    ...manifestCommon,
    loaders: [
      ...allLoaders.map((l, i) => ({
        loader_ix: i,
        loader_name: l.name,
        office_name: l.office,
        bucket_volume_m3: l.volume,
        work_type: l.workType,
        is_included: l.included,
        contractor_blank: l.contractorBlank,
        is_blank_member: false,
      })),
      {
        loader_ix: blankIx,
        loader_name: '(blank)',
        office_name: '(blank)',
        bucket_volume_m3: null,
        work_type: null,
        is_included: false,
        contractor_blank: true,
        is_blank_member: true,
      },
    ],
    files: fixtureFiles,
  });
  if (!fixture.success) fail(z.prettifyError(fixture.error));
  writeFileSync(join(OUT_UNFILTERED, 'manifest.json'), `${JSON.stringify(fixture.data)}\n`);
  const bytes = Object.values(fixtureFiles).reduce((s, f) => s + f.bytes, 0);
  console.log(`build-trucks-data: fixtures/data-unfiltered ${allLoaders.length} loaders + blank member, ${bytes} B`);
}

// ---------- 8 · budgets (§2.3, §2.4 check 7) ----------

const mBytes = Buffer.byteLength(manifestText);
const firstPaint = mBytes + FIRST_PAINT_FILES.reduce((s, k) => s + files[k].bytes, 0);
const total = mBytes + Object.values(files).reduce((s, f) => s + f.bytes, 0);
if (firstPaint > FIRST_PAINT_MAX) fail(`first paint ${firstPaint} B > ${FIRST_PAINT_MAX} B`);
if (total > TOTAL_MAX) fail(`total ${total} B > ${TOTAL_MAX} B`);
if (firstPaint > FIRST_PAINT_BUDGET) console.warn(`build-trucks-data: first paint ${firstPaint} B over the budget`);
if (total > TOTAL_BUDGET) console.warn(`build-trucks-data: total ${total} B over the budget`);

console.log(
  `build-trucks-data: §2.4 checks OK · work types ${JSON.stringify(counts)} · case-only matches ${[...caseOnly].join(', ')}`,
);
for (const fk of Object.keys(FILES) as FileKey[])
  console.log(
    `  ${files[fk].name.padEnd(22)} ${String(files[fk].rows).padStart(6)} rows ${String(files[fk].bytes).padStart(8)} B${FILES[fk].lazy ? '  (lazy)' : ''}`,
  );
console.log(`  manifest.json${' '.repeat(22)}${String(mBytes).padStart(8)} B`);
console.log(`  first paint ${firstPaint} B (≤ ${FIRST_PAINT_BUDGET}) · total ${total} B (≤ ${TOTAL_BUDGET})`);
