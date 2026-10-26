// Mirelo sales data build (ADR-0011 (a), (c)): data/mirelo_sales_dummy_data/parquet/*.parquet → pre-aggregated
// public/data/sales/*.parquet + manifest.json. fact_loan (634 k rows, 19.6 MB) never ships: it is folded into monthly
// cubes, per-window distinct-client stats and medians, cohort curves, and a capped loan / client sample for the
// slide-over. Runs on Node's native type stripping (erasable TypeScript, explicit `.ts` imports), like build-data.ts.
// Every check throws, which fails `npm run build`.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parquetRead, parquetReadObjects } from 'hyparquet';
import { parquetWriteBuffer } from 'hyparquet-writer';
import type { ColumnSource } from 'hyparquet-writer';
import { z } from 'zod';
import { readRows } from '../lib/data/parquet-columns.ts';
import type { ColumnSpec, RowOf } from '../lib/data/parquet-columns.ts';
import { createFx } from '../lib/sales/fx.ts';
import { DETAIL_CAPS, DIMS, FILES, MARKETS, dimsSchema, manifestSchema } from '../lib/sales/manifest.ts';
import type { DimName, FileKey } from '../lib/sales/manifest.ts';
import { dayNumber, lastDayOf, monthIndex, monthKey, windowOf } from '../lib/sales/windows.ts';
import type { TimeView } from '../lib/sales/windows.ts';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const SRC = join(ROOT, '..', 'data', 'mirelo_sales_dummy_data', 'parquet');
const OUT = join(ROOT, 'public', 'data', 'sales');

const BUDGET_TOTAL_BYTES = 3_000_000; // ADR-0011 brief: shipped Parquet under ~3 MB
const MAX_TOTAL_BYTES = 4_000_000; // hard fail
const BUDGET_FIRST_LOAD_BYTES = 600_000; // manifest + base files
const COHORT_DAYS = [0, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180];
const MAX_MOB = 12;

function fail(message: string): never {
  throw new Error(`build-sales-data: ${message}`);
}

// ---------- source reading ----------

const sourceBytes = (table: string): ArrayBuffer => {
  const b = readFileSync(join(SRC, `${table}.parquet`));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};

/** Plain JS value for Zod and the cubes: dates → ISO, int64 → number (checked safe). */
function plain(v: unknown, where: string): unknown {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === 'bigint') {
    const n = Number(v);
    if (!Number.isSafeInteger(n)) fail(`${where}: int64 ${v} outside the safe range`);
    return n;
  }
  return v;
}

async function readColumns(table: string, columns: readonly string[]): Promise<Map<string, unknown[]>> {
  const out = new Map<string, unknown[]>(columns.map((c) => [c, []]));
  await parquetRead({
    file: sourceBytes(table),
    columns: [...columns],
    onChunk: ({ columnName, columnData, rowStart }) => {
      const col = out.get(columnName);
      if (!col) fail(`${table}: unexpected column ${columnName}`);
      for (let i = 0; i < columnData.length; i++) col[rowStart + i] = plain(columnData[i], `${table}.${columnName}`);
    },
  });
  const lengths = new Set([...out.values()].map((c) => c.length));
  if (lengths.size !== 1) fail(`${table}: columns of different lengths`);
  return out;
}

function column(cols: Map<string, unknown[]>, name: string): unknown[] {
  const c = cols.get(name);
  if (!c) fail(`missing column ${name}`);
  return c;
}
const str = (v: unknown, where: string): string =>
  typeof v === 'string' ? v : fail(`${where}: "${String(v)}" is not text`);
const optStr = (v: unknown, where: string): string | null => (v === null ? null : str(v, where));
const num = (v: unknown, where: string): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fail(`${where}: "${String(v)}" is not a number`);
const bool = (v: unknown, where: string): boolean => (typeof v === 'boolean' ? v : fail(`${where}: not a boolean`));

/** 0.1-hour grid → integer tenths (exact histogram bins for MEDIANX). */
function tenths(v: number, where: string): number {
  const t = Math.round(v * 10);
  if (Math.abs(v * 10 - t) > 1e-6 || t < 0) fail(`${where}: ${v} h is not on the 0.1 h grid`);
  return t;
}

// ---------- 1 · dimensions + parameters (strict Zod, shipped in manifest.json) ----------

const SOURCE_OF: Record<DimName, string> = {
  market: 'dim_market',
  product: 'dim_product',
  channel: 'dim_channel',
  agent: 'dim_agent',
  funnel_stage: 'dim_funnel_stage',
  revenue_type: 'dim_revenue_type',
  loan_status: 'dim_loan_status',
  month: 'dim_month',
  thresholds: 'param_thresholds',
  fx: 'param_fx',
};

const rawDims: Record<string, unknown[]> = {};
for (const name of Object.keys(DIMS) as DimName[]) {
  const table = SOURCE_OF[name];
  const rows = await parquetReadObjects({ file: sourceBytes(table) });
  rawDims[name] = rows.map((r) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, plain(v, `${table}.${k}`)])),
  );
}
const parsedDims = dimsSchema.safeParse(rawDims);
if (!parsedDims.success) fail(z.prettifyError(parsedDims.error));
const dims = parsedDims.data;

const sourceManifest = z
  .object({ seed: z.number().int(), last_closed_month: z.string(), actuals_through: z.iso.date() })
  .loose() // the generator's manifest also lists tables; only these three keys are read here
  .parse(JSON.parse(readFileSync(join(SRC, 'manifest.json'), 'utf8')));

const FIRST = 0; // Jan 2024
const CLOSED = monthIndex(sourceManifest.last_closed_month);
const CUT_DAY = lastDayOf(CLOSED);
const lastClosedRow = dims.month.filter((m) => m.is_closed).at(-1);
if (lastClosedRow?.month_key !== sourceManifest.last_closed_month)
  fail(`dim_month last closed ${lastClosedRow?.month_key} ≠ manifest ${sourceManifest.last_closed_month}`);

const fx = createFx(dims.fx);
const currencyOf = new Map<string, string>(dims.market.map((m) => [m.market_code, m.currency_code]));
const marketIx = new Map<string, number>(MARKETS.map((m, i) => [m, i]));
const loanProducts = dims.product.filter((p) => p.product_line === 'Microloan').map((p) => p.product_code);
const productIx = new Map(loanProducts.map((p, i) => [p, i]));
const channels = dims.channel.map((c) => c.channel_code);
const channelIx = new Map(channels.map((c, i) => [c, i]));
const agentMarket = new Map(dims.agent.map((a) => [a.agent_code, a.market_code]));
for (let m = FIRST; m <= CLOSED; m++)
  for (const cur of new Set(currencyOf.values())) {
    fx.rate(cur, m, 'ACTUAL_AVG'); // throws on a gap
    fx.rate(cur, m, 'BUDGET');
  }

const ix = (map: Map<string, number>, v: string, what: string, where: string): number =>
  map.get(v) ?? fail(`${where}: unknown ${what} "${v}"`);

// ---------- 2 · dim_client (segment per client; detail sample) ----------

const CLIENT_COLUMNS = [
  'client_id',
  'market_code',
  'segment_code',
  'acquisition_channel_code',
  'acquisition_agent_code',
  'first_loan_date',
  'first_product_code',
  'cohort_month',
  'birth_year_band',
  'city_tier',
  'loans_before_2024',
] as const;
const clientCols = await readColumns('dim_client', CLIENT_COLUMNS);
const clientIds = column(clientCols, 'client_id').map((v, i) => num(v, `dim_client:${i}`));
const MIN_CLIENT = clientIds.reduce((a, b) => Math.min(a, b), Infinity);
const clientSpan = clientIds.reduce((a, b) => Math.max(a, b), -Infinity) - MIN_CLIENT + 1;
const clientRow = new Int32Array(clientSpan).fill(-1); // client id − MIN → dim_client row
const clientSeg = new Uint8Array(clientSpan); // 1 consumer, 2 micro-business
const clientMarket = new Int8Array(clientSpan).fill(-1);
clientIds.forEach((id, row) => {
  const k = id - MIN_CLIENT;
  if (clientRow[k] !== -1) fail(`dim_client: duplicate client ${id}`);
  clientRow[k] = row;
  const seg = str(column(clientCols, 'segment_code')[row], `dim_client:${row}`);
  clientSeg[k] = seg === 'CONSUMER' ? 1 : seg === 'MICRO_BUSINESS' ? 2 : fail(`dim_client:${row}: segment ${seg}`);
  clientMarket[k] = ix(marketIx, str(column(clientCols, 'market_code')[row], 'dim_client'), 'market', 'dim_client');
});

// ---------- 3 · fact_loan → closed loans in typed arrays ----------

const LOAN_COLUMNS = [
  'loan_id',
  'client_id',
  'market_code',
  'product_code',
  'channel_code',
  'agent_code',
  'currency_code',
  'hours_to_approve',
  'hours_to_cash',
  'disbursed_date',
  'principal_local',
  'is_first_loan',
  'is_repeat',
  'status_code',
  'dpd_days_close',
  'outstanding_local_close',
] as const;
const loanCols = await readColumns('fact_loan', LOAN_COLUMNS);
const sourceLoans = column(loanCols, 'loan_id').length;
const statusCodes = new Set(dims.loan_status.map((s) => s.status_code));

const L = {
  id: [] as number[],
  client: [] as number[], // client id − MIN_CLIENT
  day: [] as number[],
  month: [] as number[],
  iso: [] as string[],
  market: [] as number[],
  product: [] as number[],
  channel: [] as number[],
  agent: [] as (string | null)[],
  repeat: [] as boolean[],
  principal: [] as number[],
  cash10: [] as number[],
  appr10: [] as number[],
  status: [] as string[],
  dpd: [] as number[],
  outstanding: [] as number[],
};
let afterClose = 0;
for (let i = 0; i < sourceLoans; i++) {
  const where = `fact_loan row ${i}`;
  const get = (c: (typeof LOAN_COLUMNS)[number]) => column(loanCols, c)[i];
  const iso = str(get('disbursed_date'), where);
  const month = monthIndex(iso.slice(0, 7));
  if (month > CLOSED) {
    if (get('status_code') !== 'AFTER_CLOSE')
      fail(`${where}: open-month loan with status ${String(get('status_code'))}`);
    afterClose++;
    continue; // October 2026 is open: no window can reach it (closed months only)
  }
  if (month < FIRST) fail(`${where}: disbursed before Jan 2024`);
  const market = str(get('market_code'), where);
  if (currencyOf.get(market) !== get('currency_code')) fail(`${where}: currency ≠ market currency`);
  const repeat = bool(get('is_repeat'), where);
  if (repeat === bool(get('is_first_loan'), where)) fail(`${where}: is_repeat = is_first_loan`);
  const client = num(get('client_id'), where) - MIN_CLIENT;
  if (client < 0 || client >= clientSpan || clientRow[client] === -1) fail(`${where}: client not in dim_client`);
  const m = ix(marketIx, market, 'market', where);
  if (clientMarket[client] !== m) fail(`${where}: loan market ≠ client market`);
  const principal = num(get('principal_local'), where);
  if (principal <= 0) fail(`${where}: principal ${principal}`);
  const cash10 = tenths(num(get('hours_to_cash'), where), where);
  const appr10 = tenths(num(get('hours_to_approve'), where), where);
  if (cash10 < appr10) fail(`${where}: cash before approval`);
  const status = str(get('status_code'), where);
  if (!statusCodes.has(status) || status === 'AFTER_CLOSE') fail(`${where}: status ${status} in a closed month`);
  const agent = optStr(get('agent_code'), where);
  if (agent !== null && agentMarket.get(agent) !== market) fail(`${where}: agent ${agent} outside ${market}`);
  L.id.push(num(get('loan_id'), where));
  L.client.push(client);
  L.day.push(dayNumber(iso));
  L.month.push(month);
  L.iso.push(iso);
  L.market.push(m);
  L.product.push(ix(productIx, str(get('product_code'), where), 'product', where));
  L.channel.push(ix(channelIx, str(get('channel_code'), where), 'channel', where));
  L.agent.push(agent);
  L.repeat.push(repeat);
  L.principal.push(principal);
  L.cash10.push(cash10);
  L.appr10.push(appr10);
  L.status.push(status);
  L.dpd.push(num(get('dpd_days_close'), where));
  L.outstanding.push(num(get('outstanding_local_close'), where));
}
const N = L.id.length;
const at = <T>(a: ArrayLike<T>, i: number): T => {
  const v = a[i];
  if (v === undefined) fail(`index ${i} out of range`);
  return v;
};
/** a[i]++ for typed and plain arrays under noUncheckedIndexedAccess. */
const inc = (a: { [i: number]: number | undefined }, i: number) => {
  a[i] = (a[i] ?? 0) + 1;
};
const currencyOfIx = MARKETS.map((m) => currencyOf.get(m) ?? fail(`dim_market: no ${m}`));
const EUR = (i: number) =>
  fx.toEur(at(L.principal, i), at(currencyOfIx, at(L.market, i)), at(L.month, i), 'ACTUAL_AVG');

// Client order: client, day, loan id (the detail file is written in this order, so sums replay identically).
const byClient = Int32Array.from({ length: N }, (_, i) => i).sort(
  (a, b) => at(L.client, a) - at(L.client, b) || at(L.day, a) - at(L.day, b) || at(L.id, a) - at(L.id, b),
);
const prevDay = new Int32Array(N).fill(-1);
const nextDay = new Int32Array(N).fill(-1);
for (let k = 1; k < N; k++) {
  const a = at(byClient, k - 1);
  const b = at(byClient, k);
  if (at(L.client, a) === at(L.client, b)) {
    prevDay[b] = at(L.day, a);
    nextDay[a] = at(L.day, b);
  }
}
const byMonth: number[][] = Array.from({ length: CLOSED + 1 }, () => []);
for (let i = 0; i < N; i++) byMonth[at(L.month, i)]?.push(i);

// ---------- 4 · loans-month cube ----------

type Rows<K extends FileKey> = RowOf<(typeof FILES)[K]['columns']>[];

const loansCube = new Map<string, { loans: number; principal: number }>();
for (let i = 0; i < N; i++) {
  const key = [at(L.month, i), at(L.market, i), at(L.product, i), at(L.channel, i), at(L.repeat, i) ? 1 : 0].join('|');
  const c = loansCube.get(key) ?? { loans: 0, principal: 0 };
  c.loans++;
  c.principal += at(L.principal, i);
  loansCube.set(key, c);
}
const loansMonth: Rows<'loansMonth'> = [...loansCube.entries()]
  .map(([key, c]) => {
    const [mo, mk, p, ch, r] = key.split('|').map(Number) as [number, number, number, number, number];
    return {
      month: monthKey(mo),
      market: at(MARKETS, mk),
      product: at(loanProducts, p),
      channel: at(channels, ch),
      repeat: r === 1,
      loans: c.loans,
      principal_local: c.principal,
    };
  })
  .sort(
    (a, b) =>
      a.month.localeCompare(b.month) ||
      a.market.localeCompare(b.market) ||
      a.product.localeCompare(b.product) ||
      a.channel.localeCompare(b.channel) ||
      Number(a.repeat) - Number(b.repeat),
  );

// ---------- 5 · per-window distinct clients + medians (not additive over months, so computed here) ----------

const SLOTS = 4; // 0 = all markets, 1..3 = PL, RO, PT
const SEGS = 3; // 0 = all, 1 = consumer, 2 = micro-business
type Metric = 'cash' | 'appr' | 'payout' | 'gap';
const values: Record<Metric, (i: number) => number | null> = {
  cash: (i) => at(L.cash10, i),
  appr: (i) => at(L.appr10, i),
  payout: (i) => at(L.cash10, i) - at(L.appr10, i),
  gap: (i) => (at(L.repeat, i) && prevDay[i] !== -1 ? at(L.day, i) - (prevDay[i] as number) : null),
};
const bins: Record<Metric, number> = { cash: 1, appr: 1, payout: 1, gap: 1 };
for (let i = 0; i < N; i++)
  for (const m of Object.keys(values) as Metric[]) {
    const v = values[m](i);
    if (v !== null) bins[m] = Math.max(bins[m], v + 1);
  }
// prefix[m][slot] = cumulative histogram through month index `mo` (Int32Array per month), so a window is one subtraction
const prefix = Object.fromEntries(
  (Object.keys(values) as Metric[]).map((m) => {
    const perMonth = Array.from({ length: CLOSED + 1 }, () =>
      Array.from({ length: SLOTS }, () => new Int32Array(bins[m])),
    );
    for (let i = 0; i < N; i++) {
      const v = values[m](i);
      if (v === null) continue;
      const mo = at(L.month, i);
      const row = perMonth[mo] as Int32Array[];
      inc(at(row, 0), v);
      inc(at(row, at(L.market, i) + 1), v);
    }
    for (let mo = 1; mo <= CLOSED; mo++)
      for (let s = 0; s < SLOTS; s++) {
        const cur = (perMonth[mo] as Int32Array[])[s] as Int32Array;
        const prev = (perMonth[mo - 1] as Int32Array[])[s] as Int32Array;
        for (let b = 0; b < cur.length; b++) cur[b] = (cur[b] as number) + (prev[b] as number);
      }
    return [m, perMonth];
  }),
) as Record<Metric, Int32Array[][]>;

/** MEDIANX over the window's values: the middle value, or the mean of the two middle values. */
function median(m: Metric, slot: number, start: number, end: number, scale: number): number | null {
  const hi = (prefix[m][end] as Int32Array[])[slot] as Int32Array;
  const lo = start > 0 ? ((prefix[m][start - 1] as Int32Array[])[slot] as Int32Array) : null;
  let n = 0;
  for (let b = 0; b < hi.length; b++) n += (hi[b] as number) - (lo ? (lo[b] as number) : 0);
  if (n === 0) return null;
  const k1 = Math.floor((n - 1) / 2);
  const k2 = Math.floor(n / 2);
  let seen = 0;
  let v1 = -1;
  for (let b = 0; b < hi.length; b++) {
    const c = (hi[b] as number) - (lo ? (lo[b] as number) : 0);
    if (c === 0) continue;
    if (v1 < 0 && seen + c > k1) v1 = b;
    if (seen + c > k2) return (v1 + b) / 2 / scale;
    seen += c;
  }
  fail('median: histogram walk ended early');
}

const stamp = new Int32Array(clientSpan).fill(-1);
const returned = new Uint8Array(clientSpan);
const windowStats: Rows<'windowStats'> = [];
let wid = 0;
for (const tv of ['M', 'Q', 'Y', 'R'] as TimeView[])
  for (let anchor = FIRST; anchor <= CLOSED; anchor++) {
    const w = windowOf(tv, anchor);
    const start = Math.max(w.start, FIRST);
    const borrowers = Array.from({ length: SLOTS }, () => new Array<number>(SEGS).fill(0));
    const returning = Array.from({ length: SLOTS }, () => new Array<number>(SEGS).fill(0));
    wid++;
    for (let mo = start; mo <= anchor; mo++)
      for (const i of byMonth[mo] ?? []) {
        const c = at(L.client, i);
        const slots: [number, number][] = [
          [0, 0],
          [at(L.market, i) + 1, 0],
          [0, clientSeg[c] as number],
          [at(L.market, i) + 1, clientSeg[c] as number],
        ];
        if (stamp[c] !== wid) {
          stamp[c] = wid;
          returned[c] = 0;
          for (const [s, g] of slots) inc(at(borrowers, s), g);
        }
        if (at(L.repeat, i) && returned[c] === 0) {
          returned[c] = 1;
          for (const [s, g] of slots) inc(at(returning, s), g);
        }
      }
    for (let s = 0; s < SLOTS; s++)
      for (let g = 0; g < SEGS; g++) {
        const all = g === 0;
        windowStats.push({
          tv,
          anchor: monthKey(anchor),
          market: s === 0 ? 'ALL' : at(MARKETS, s - 1),
          segment: ['ALL', 'CONSUMER', 'MICRO_BUSINESS'][g] ?? 'ALL',
          borrowers: (borrowers[s] as number[])[g] ?? 0,
          returning: (returning[s] as number[])[g] ?? 0,
          median_hours_to_cash: all ? median('cash', s, start, anchor, 10) : null,
          median_hours_to_approve: all ? median('appr', s, start, anchor, 10) : null,
          median_hours_payout: all ? median('payout', s, start, anchor, 10) : null,
          median_days_between: all ? median('gap', s, start, anchor, 1) : null,
        });
      }
  }

// ---------- 6 · cohort repeat curves (first-loan month × market × days since first loan) ----------

const cohortClients = new Map<string, number>();
const cohortRepeated = new Map<string, number[]>();
for (let i = 0; i < N; i++) {
  if (at(L.repeat, i)) continue;
  const key = `${at(L.month, i)}|${at(L.market, i)}`;
  cohortClients.set(key, (cohortClients.get(key) ?? 0) + 1);
  const rep = cohortRepeated.get(key) ?? new Array<number>(COHORT_DAYS.length).fill(0);
  const gap = nextDay[i] === -1 ? -1 : (nextDay[i] as number) - at(L.day, i);
  if (gap >= 0) COHORT_DAYS.forEach((d, k) => gap <= d && (rep[k] = (rep[k] ?? 0) + 1));
  cohortRepeated.set(key, rep);
}
const cohortCurve: Rows<'cohortCurve'> = [];
for (let mo = FIRST; mo <= CLOSED; mo++)
  MARKETS.forEach((market, mk) => {
    const key = `${mo}|${mk}`;
    const clients = cohortClients.get(key) ?? 0;
    const rep = cohortRepeated.get(key) ?? [];
    COHORT_DAYS.forEach((day, k) =>
      cohortCurve.push({
        cohort: monthKey(mo),
        market,
        day,
        clients,
        repeated: rep[k] ?? 0,
        observable: lastDayOf(mo) + day <= CUT_DAY,
      }),
    );
  });

// ---------- 7 · fact_application → funnel-month ----------

const appCols = await readColumns('fact_application', [
  'date',
  'market_code',
  'channel_code',
  'product_code',
  'is_repeat',
  'leads',
  'apps_started',
  'apps_submitted',
  'kyc_passed',
  'approved',
  'disbursed',
]);
const STAGES = ['leads', 'apps_started', 'apps_submitted', 'kyc_passed', 'approved', 'disbursed'] as const;
const funnelCube = new Map<string, number[]>();
column(appCols, 'date').forEach((d, i) => {
  const where = `fact_application row ${i}`;
  const month = monthIndex(str(d, where).slice(0, 7));
  if (month > CLOSED) return;
  const counts = STAGES.map((s) => num(column(appCols, s)[i], where));
  for (let k = 1; k < counts.length; k++)
    if ((counts[k] as number) > (counts[k - 1] as number)) fail(`${where}: funnel not monotonic`);
  const key = [
    month,
    str(column(appCols, 'market_code')[i], where),
    str(column(appCols, 'product_code')[i], where),
    str(column(appCols, 'channel_code')[i], where),
    bool(column(appCols, 'is_repeat')[i], where) ? 1 : 0,
  ].join('|');
  const acc = funnelCube.get(key) ?? new Array<number>(STAGES.length).fill(0);
  counts.forEach((c, k) => (acc[k] = (acc[k] ?? 0) + c));
  funnelCube.set(key, acc);
});
const funnelMonth: Rows<'funnelMonth'> = [...funnelCube.entries()]
  .map(([key, c]) => {
    const [mo, market, product, channel, r] = key.split('|') as [string, string, string, string, string];
    if (!marketIx.has(market) || !productIx.has(product) || !channelIx.has(channel)) fail(`funnel: bad key ${key}`);
    return {
      month: monthKey(Number(mo)),
      market,
      product,
      channel,
      repeat: r === '1',
      leads: c[0] ?? 0,
      started: c[1] ?? 0,
      submitted: c[2] ?? 0,
      kyc_passed: c[3] ?? 0,
      approved: c[4] ?? 0,
      disbursed: c[5] ?? 0,
    };
  })
  .sort(
    (a, b) =>
      a.month.localeCompare(b.month) ||
      a.market.localeCompare(b.market) ||
      a.product.localeCompare(b.product) ||
      a.channel.localeCompare(b.channel) ||
      Number(a.repeat) - Number(b.repeat),
  );

// ---------- 8 · fact_loan_month → portfolio-month + vintage ----------

const PORTFOLIO_SUMS = [
  'loans_active',
  'loans_dpd_30p',
  'outstanding_local',
  'bal_current_local',
  'bal_dpd_1_29_local',
  'bal_dpd_30_59_local',
  'bal_dpd_60_89_local',
  'bal_dpd_90p_local',
  'written_off_local',
  'provision_local',
] as const;
const lmCols = await readColumns('fact_loan_month', [
  'month_key',
  'vintage_month',
  'market_code',
  'product_code',
  'currency_code',
  'loans_disbursed',
  'loans_first_30p',
  'loans_first_90p',
  ...PORTFOLIO_SUMS,
]);
const portfolioCube = new Map<string, number[]>();
const vintageCube = new Map<string, [number, number]>(); // vintage|market|mob → first_30p, first_90p
const vintageDisbursed = new Map<string, number>(); // vintage|market
column(lmCols, 'month_key').forEach((mk, i) => {
  const where = `fact_loan_month row ${i}`;
  const month = monthIndex(str(mk, where));
  if (month > CLOSED) fail(`${where}: snapshot after the last closed month`);
  const market = str(column(lmCols, 'market_code')[i], where);
  if (currencyOf.get(market) !== column(lmCols, 'currency_code')[i]) fail(`${where}: currency ≠ market`);
  const product = str(column(lmCols, 'product_code')[i], where);
  if (!productIx.has(product)) fail(`${where}: product ${product}`);
  const pkey = `${month}|${market}|${product}`;
  const acc = portfolioCube.get(pkey) ?? new Array<number>(PORTFOLIO_SUMS.length).fill(0);
  PORTFOLIO_SUMS.forEach((c, k) => (acc[k] = (acc[k] ?? 0) + num(column(lmCols, c)[i], where)));
  portfolioCube.set(pkey, acc);
  const vintage = monthIndex(str(column(lmCols, 'vintage_month')[i], where));
  const mob = month - vintage;
  if (vintage < FIRST || mob > MAX_MOB) return; // opening book has no disbursement row; curves stop at 12 months
  if (mob === 0) {
    const vkey = `${vintage}|${market}`;
    vintageDisbursed.set(vkey, (vintageDisbursed.get(vkey) ?? 0) + num(column(lmCols, 'loans_disbursed')[i], where));
  }
  const key = `${vintage}|${market}|${mob}`;
  const v = vintageCube.get(key) ?? [0, 0];
  v[0] += num(column(lmCols, 'loans_first_30p')[i], where);
  v[1] += num(column(lmCols, 'loans_first_90p')[i], where);
  vintageCube.set(key, v);
});
const portfolioMonth: Rows<'portfolioMonth'> = [...portfolioCube.entries()]
  .map(([key, a]) => {
    const [mo, market, product] = key.split('|') as [string, string, string];
    const g = (k: number) => a[k] ?? 0;
    return {
      month: monthKey(Number(mo)),
      market,
      product,
      loans_active: g(0),
      loans_dpd_30p: g(1),
      outstanding: g(2),
      bal_current: g(3),
      bal_1_29: g(4),
      bal_30_59: g(5),
      bal_60_89: g(6),
      bal_90p: g(7),
      written_off: g(8),
      provision: g(9),
    };
  })
  .sort(
    (a, b) => a.month.localeCompare(b.month) || a.market.localeCompare(b.market) || a.product.localeCompare(b.product),
  );
for (const p of portfolioMonth) {
  const buckets = p.bal_current + p.bal_1_29 + p.bal_30_59 + p.bal_60_89 + p.bal_90p;
  if (Math.abs(buckets - p.outstanding) > 0.05)
    fail(`portfolio ${p.month} ${p.market} ${p.product}: buckets ≠ outstanding`);
}
const vintage: Rows<'vintage'> = [...vintageCube.entries()]
  .map(([key, [f30, f90]]) => {
    const [v, market, mob] = key.split('|') as [string, string, string];
    return {
      vintage: monthKey(Number(v)),
      market,
      mob: Number(mob),
      disbursed: vintageDisbursed.get(`${v}|${market}`) ?? 0,
      first_30p: f30,
      first_90p: f90,
    };
  })
  .sort((a, b) => a.vintage.localeCompare(b.vintage) || a.market.localeCompare(b.market) || a.mob - b.mob);
// Cross-table tie: the snapshot's disbursed counts equal the loan cube per month × market.
for (const [vkey, n] of vintageDisbursed) {
  const [v, market] = vkey.split('|') as [string, string];
  const fromLoans = loansMonth
    .filter((r) => r.month === monthKey(Number(v)) && r.market === market)
    .reduce((s, r) => s + r.loans, 0);
  if (fromLoans !== n) fail(`vintage ${monthKey(Number(v))} ${market}: snapshot ${n} ≠ fact_loan ${fromLoans}`);
}

// ---------- 9 · revenue, subscriptions, targets, agents ----------

const revCols = await readColumns('fact_revenue_month', [
  'month_key',
  'market_code',
  'product_code',
  'revenue_type_code',
  'currency_code',
  'amount_local',
]);
const revenueTypes = new Set(dims.revenue_type.map((r) => r.revenue_type_code));
const revenueMonth: Rows<'revenueMonth'> = column(revCols, 'month_key').map((mk, i) => {
  const where = `fact_revenue_month row ${i}`;
  const market = str(column(revCols, 'market_code')[i], where);
  if (currencyOf.get(market) !== column(revCols, 'currency_code')[i]) fail(`${where}: currency ≠ market`);
  const stream = str(column(revCols, 'revenue_type_code')[i], where);
  if (!revenueTypes.has(stream)) fail(`${where}: stream ${stream}`);
  if (monthIndex(str(mk, where)) > CLOSED) fail(`${where}: revenue after close`);
  return {
    month: str(mk, where),
    market,
    product: str(column(revCols, 'product_code')[i], where),
    stream,
    amount_local: num(column(revCols, 'amount_local')[i], where),
  };
});

const subCols = await readColumns('fact_subscription_month', [
  'month_key',
  'market_code',
  'product_code',
  'subscribers_start',
  'subscribers_new',
  'subscribers_churned',
  'subscribers_end',
  'revenue_local',
  'mrr_local',
]);
const subsMonth: Rows<'subsMonth'> = column(subCols, 'month_key').map((mk, i) => {
  const where = `fact_subscription_month row ${i}`;
  const g = (c: string) => num(column(subCols, c)[i], where);
  const row = {
    month: str(mk, where),
    market: str(column(subCols, 'market_code')[i], where),
    tier: str(column(subCols, 'product_code')[i], where),
    subscribers_start: g('subscribers_start'),
    subscribers_new: g('subscribers_new'),
    subscribers_churned: g('subscribers_churned'),
    subscribers_end: g('subscribers_end'),
    revenue_local: g('revenue_local'),
    mrr_local: g('mrr_local'),
  };
  if (row.subscribers_start + row.subscribers_new - row.subscribers_churned !== row.subscribers_end)
    fail(`${where}: subscriber roll-forward broken`);
  return row;
});

const tgtCols = await readColumns('fact_target', [
  'version_code',
  'month_key',
  'market_code',
  'product_code',
  'agent_code',
  'metric_code',
  'target_value',
]);
const targetMonth: Rows<'targetMonth'> = [];
const agentTargets = new Map<string, [number, number]>(); // month|agent → loans, principal local
column(tgtCols, 'month_key').forEach((mk, i) => {
  const where = `fact_target row ${i}`;
  if (column(tgtCols, 'version_code')[i] !== 'BUD')
    fail(`${where}: version ${String(column(tgtCols, 'version_code')[i])}`);
  const month = str(mk, where);
  if (monthIndex(month) > CLOSED) return; // windows end at the last closed month
  const metric = str(column(tgtCols, 'metric_code')[i], where);
  const value = num(column(tgtCols, 'target_value')[i], where);
  const agent = optStr(column(tgtCols, 'agent_code')[i], where);
  if (metric === 'AGENT_LOANS' || metric === 'AGENT_PRINCIPAL_LOCAL') {
    if (agent === null || !agentMarket.has(agent)) fail(`${where}: agent target without a known agent`);
    const key = `${month}|${agent}`;
    const t = agentTargets.get(key) ?? [0, 0];
    t[metric === 'AGENT_LOANS' ? 0 : 1] += value;
    agentTargets.set(key, t);
    return;
  }
  if (!['LOANS', 'NEW_CLIENTS', 'PRINCIPAL_LOCAL', 'REVENUE_LOCAL', 'DPD30_RATIO'].includes(metric))
    fail(`${where}: metric ${metric}`);
  targetMonth.push({
    month,
    market: str(column(tgtCols, 'market_code')[i], where),
    product: optStr(column(tgtCols, 'product_code')[i], where),
    metric,
    value,
  });
});

const agentLoans = new Map<string, [number, number]>();
for (let i = 0; i < N; i++) {
  const agent = at(L.agent, i);
  if (agent === null) continue;
  const key = `${monthKey(at(L.month, i))}|${agent}`;
  const a = agentLoans.get(key) ?? [0, 0];
  a[0]++;
  a[1] += at(L.principal, i);
  agentLoans.set(key, a);
}
const agentMonth: Rows<'agentMonth'> = [...new Set([...agentLoans.keys(), ...agentTargets.keys()])]
  .sort()
  .map((key) => {
    const [month, agent] = key.split('|') as [string, string];
    const [loans, principal] = agentLoans.get(key) ?? [0, 0];
    const [tl, tp] = agentTargets.get(key) ?? [0, 0];
    return { month, agent, loans, principal_local: principal, target_loans: tl, target_principal_local: tp };
  });

// ---------- 10 · capped detail sample (slide-over, Clients / Portfolio tables) ----------

const pick = new Uint8Array(N);
const topBy = (indices: number[], cmp: (a: number, b: number) => number, cap: number) =>
  indices.sort(cmp).slice(0, cap);
const byPrincipal = (a: number, b: number) => at(L.principal, b) - at(L.principal, a) || at(L.id, a) - at(L.id, b);

const groups = new Map<string, number[]>();
const group = (key: string, i: number) => {
  const g = groups.get(key);
  if (g) g.push(i);
  else groups.set(key, [i]);
};
for (let i = 0; i < N; i++) {
  group(`mm|${at(L.month, i)}|${at(L.market, i)}`, i);
  const agent = at(L.agent, i);
  if (agent !== null) group(`ag|${agent}|${at(L.month, i)}`, i);
  if (at(L.dpd, i) >= 30 && at(L.outstanding, i) > 0) group(`od|${at(L.market, i)}`, i);
}
for (const [key, idx] of groups) {
  const kind = key.slice(0, 2);
  const chosen =
    kind === 'mm'
      ? topBy(idx, byPrincipal, DETAIL_CAPS.loansPerMonthMarket)
      : kind === 'ag'
        ? topBy(idx, byPrincipal, DETAIL_CAPS.loansPerAgentMonth)
        : topBy(
            idx,
            (a, b) =>
              at(L.dpd, b) - at(L.dpd, a) || at(L.outstanding, b) - at(L.outstanding, a) || at(L.id, a) - at(L.id, b),
            DETAIL_CAPS.overduePerMarket,
          );
  for (const i of chosen) pick[i] = 1;
}

// Principal to date per client in EUR, summed in client order (the engine replays the same order from the file).
const clientPtd = new Map<number, number>();
const firstLoanOf = new Map<number, number>();
for (const i of byClient) {
  const c = at(L.client, i);
  clientPtd.set(c, (clientPtd.get(c) ?? 0) + EUR(i));
  if (!at(L.repeat, i)) firstLoanOf.set(c, i);
}
const cohortGroups = new Map<string, number[]>();
for (const [c, i] of firstLoanOf) {
  const key = `${at(L.month, i)}|${at(L.market, i)}`;
  const g = cohortGroups.get(key);
  if (g) g.push(c);
  else cohortGroups.set(key, [c]);
}
const referenced = new Set<number>();
for (const clients of cohortGroups.values())
  clients
    .sort((a, b) => (clientPtd.get(b) ?? 0) - (clientPtd.get(a) ?? 0) || a - b)
    .slice(0, DETAIL_CAPS.clientsPerCohortMarket)
    .forEach((c) => referenced.add(c));
for (let i = 0; i < N; i++) if (pick[i]) referenced.add(at(L.client, i));
// Every referenced client carries its whole history, so the client card and "to date" columns are complete.
const detailLoans: Rows<'detailLoans'> = [];
for (const i of byClient) {
  if (!referenced.has(at(L.client, i))) continue;
  detailLoans.push({
    loan_id: at(L.id, i),
    client_id: at(L.client, i) + MIN_CLIENT,
    disbursed: at(L.iso, i),
    market: at(MARKETS, at(L.market, i)),
    product: at(loanProducts, at(L.product, i)),
    channel: at(channels, at(L.channel, i)),
    agent: at(L.agent, i),
    repeat: at(L.repeat, i),
    principal_local: at(L.principal, i),
    hours_to_cash: at(L.cash10, i) / 10,
    status: at(L.status, i),
    dpd_close: at(L.dpd, i),
    outstanding_close_local: at(L.outstanding, i),
  });
}
const detailClients: Rows<'detailClients'> = [...referenced]
  .sort((a, b) => a - b)
  .map((c) => {
    const row = clientRow[c] as number;
    const get = (name: (typeof CLIENT_COLUMNS)[number]) => column(clientCols, name)[row];
    const where = `dim_client row ${row}`;
    return {
      client_id: c + MIN_CLIENT,
      market: str(get('market_code'), where),
      segment: str(get('segment_code'), where),
      acquisition_channel: str(get('acquisition_channel_code'), where),
      acquisition_agent: optStr(get('acquisition_agent_code'), where),
      first_loan_date: str(get('first_loan_date'), where),
      first_product: str(get('first_product_code'), where),
      cohort_month: str(get('cohort_month'), where),
      birth_year_band: str(get('birth_year_band'), where),
      city_tier: num(get('city_tier'), where),
      loans_before_2024: num(get('loans_before_2024'), where),
    };
  });

// ---------- 11 · encode, verify, write ----------

const PARQUET_TYPE = {
  str: 'STRING',
  'str?': 'STRING',
  int: 'INT32',
  'int?': 'INT32',
  num: 'DOUBLE',
  'num?': 'DOUBLE',
  bool: 'BOOLEAN',
} as const;

function encode<S extends ColumnSpec>(spec: S, rows: readonly RowOf<S>[], label: string): ArrayBuffer {
  if (rows.length === 0) fail(`${label}: no rows`);
  const columnData: ColumnSource[] = Object.entries(spec).map(([name, kind]) => {
    const data = rows.map((r) => r[name as keyof S] as unknown);
    for (const v of data)
      if (kind.startsWith('int') && v !== null && (!Number.isInteger(v) || (v as number) > 2 ** 31 - 1))
        fail(`${label}.${name}: ${String(v)} is not int32`);
    return {
      name,
      data:
        kind === 'int'
          ? Int32Array.from(data as number[])
          : kind === 'num'
            ? Float64Array.from(data as number[])
            : data,
      type: PARQUET_TYPE[kind],
      nullable: kind.endsWith('?'),
    };
  });
  return parquetWriteBuffer({ columnData, rowGroupSize: rows.length, createdBy: 'mirelo js-report build-sales-data' });
}

const outputs: { [K in FileKey]: Rows<K> } = {
  loansMonth,
  funnelMonth,
  portfolioMonth,
  vintage,
  windowStats,
  cohortCurve,
  agentMonth,
  revenueMonth,
  subsMonth,
  targetMonth,
  detailLoans,
  detailClients,
};
const written = new Map<string, { rows: number; buffer: ArrayBuffer; base: boolean }>();
for (const key of Object.keys(FILES) as FileKey[]) {
  const { file, columns, load } = FILES[key];
  const rows = outputs[key] as readonly RowOf<typeof columns>[];
  const buffer = encode(columns, rows, file);
  // Read round-trip through the browser's reader: same rows, same values.
  const back = await readRows(buffer, columns, file);
  if (back.length !== rows.length) fail(`${file}: read ${back.length} rows, wrote ${rows.length}`);
  for (const k of [0, Math.floor(rows.length / 2), rows.length - 1])
    if (JSON.stringify(back[k]) !== JSON.stringify(rows[k]))
      fail(
        `${file}: round-trip mismatch at row ${k}\n  wrote ${JSON.stringify(rows[k])}\n  read  ${JSON.stringify(back[k])}`,
      );
  written.set(file, { rows: rows.length, buffer, base: load === 'base' });
}

const totalLoans = loansMonth.reduce((s, r) => s + r.loans, 0);
if (totalLoans + afterClose !== sourceLoans) fail(`loans ${totalLoans} + open month ${afterClose} ≠ ${sourceLoans}`);

const manifest = manifestSchema.parse({
  schemaVersion: 1,
  builtAt: new Date().toISOString(),
  source: {
    seed: sourceManifest.seed,
    firstMonth: monthKey(FIRST),
    lastClosedMonth: sourceManifest.last_closed_month,
    actualsThrough: sourceManifest.actuals_through,
  },
  caps: DETAIL_CAPS,
  cohortDays: COHORT_DAYS,
  files: Object.fromEntries([...written].map(([f, w]) => [f, { rows: w.rows, bytes: w.buffer.byteLength }])),
  dims,
});
const manifestText = JSON.stringify(manifest);
const manifestBytes = Buffer.byteLength(manifestText);
const firstLoad =
  manifestBytes + [...written.values()].filter((w) => w.base).reduce((s, w) => s + w.buffer.byteLength, 0);
const total = manifestBytes + [...written.values()].reduce((s, w) => s + w.buffer.byteLength, 0);
const kb = (b: number) => `${(b / 1000).toFixed(1)} kB`;

console.log('build-sales-data → public/data/sales');
for (const [f, w] of written)
  console.log(
    `  ${f.padEnd(24)} ${String(w.rows).padStart(7)} rows  ${kb(w.buffer.byteLength).padStart(9)}  ${w.base ? 'base' : 'detail (lazy)'}`,
  );
console.log(`  ${'manifest.json'.padEnd(24)} ${''.padStart(7)}       ${kb(manifestBytes).padStart(9)}`);
console.log(
  `  loans ${totalLoans} closed + ${afterClose} open-month (not shipped) · first load ${kb(firstLoad)} (budget ${kb(BUDGET_FIRST_LOAD_BYTES)}) · total ${kb(total)} (budget ${kb(BUDGET_TOTAL_BYTES)}, hard limit ${kb(MAX_TOTAL_BYTES)})`,
);
if (firstLoad > BUDGET_FIRST_LOAD_BYTES || total > BUDGET_TOTAL_BYTES) console.warn('  WARNING: over the size budget');
if (total > MAX_TOTAL_BYTES) fail(`artifacts total ${kb(total)} > ${kb(MAX_TOTAL_BYTES)}`);

mkdirSync(OUT, { recursive: true });
for (const [file, w] of written) writeFileSync(join(OUT, file), new Uint8Array(w.buffer));
writeFileSync(join(OUT, 'manifest.json'), manifestText);
