import { parquetMetadata, parquetRead } from 'hyparquet';
import type { PlColumns } from '../engine/types.ts';
import type { Manifest } from './manifest.ts';

// The only module that knows the artifact file format (ADR-0002 §2.1): pl-{entity}.parquet → typed arrays.

type CodeColumn = Exclude<keyof Manifest['dict'], 'entity'>;
const CODE_COLUMNS = [
  ['month_idx', 'monthIdx', null],
  ['version', 'version', 'version'],
  ['region', 'region', 'region'],
  ['channel', 'channel', 'channel'],
  ['line', 'line', 'line'],
  ['segment', 'segment', 'segment'],
  ['account', 'account', 'account'],
  ['counterparty', 'counterparty', 'counterparty'],
] as const satisfies readonly (readonly [string, keyof PlColumns, CodeColumn | null])[];

export async function readPlColumns(file: ArrayBuffer, manifest: Manifest): Promise<PlColumns> {
  const n = Number(parquetMetadata(file).num_rows);
  const pl: PlColumns = {
    n,
    monthIdx: new Int32Array(n),
    version: new Int32Array(n),
    region: new Int32Array(n),
    channel: new Int32Array(n),
    line: new Int32Array(n),
    segment: new Int32Array(n),
    account: new Int32Array(n),
    counterparty: new Int32Array(n),
    cents: new Float64Array(n),
  };
  const target = new Map<string, Int32Array | Float64Array>([
    ...CODE_COLUMNS.map(([column, key]) => [column, pl[key]] as const),
    ['cents', pl.cents],
  ]);
  await parquetRead({
    file,
    columns: [...target.keys()],
    onChunk: ({ columnName, columnData, rowStart }) => {
      const out = target.get(columnName);
      if (!out) throw new Error(`parquet: unexpected column ${columnName}`);
      if (columnData instanceof BigInt64Array || columnData instanceof BigUint64Array)
        throw new Error(`parquet: column ${columnName} is 64-bit integer, expected INT32 / DOUBLE`);
      out.set(columnData, rowStart);
    },
  });
  // Every code must resolve, so the engine can index dictionaries and dims without range checks.
  const months = manifest.tables.dim_month.length;
  for (const [, key, dict] of CODE_COLUMNS) {
    const size = dict === null ? months : manifest.dict[dict].length;
    for (const v of pl[key]) if (v < 0 || v >= size) throw new Error(`parquet: ${key} code ${v} outside 0…${size - 1}`);
  }
  return pl;
}
