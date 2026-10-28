// vendored from rusloc/pnl js-report/lib/data/parquet-columns.ts, 2026-10-28; source of truth stays there
import { parquetMetadata, parquetRead } from 'hyparquet';

// Generic, typed column reader on top of hyparquet (shared tooling, no business logic). A file spec names every column
// with its kind; the reader returns one plain array per column and rejects any value whose runtime type does not
// match, so a drifted artifact fails loudly instead of leaking `unknown` into an engine. First consumer: the Mirelo
// sales route (ADR-0011 (c)); the P&L loader keeps its own typed-array path (parquet-loader.ts).

export type ColumnKind = 'str' | 'str?' | 'int' | 'int?' | 'num' | 'num?' | 'bool';
export type ColumnSpec = Readonly<Record<string, ColumnKind>>;

export type KindValue<K extends ColumnKind> = K extends 'str'
  ? string
  : K extends 'str?'
    ? string | null
    : K extends 'int' | 'num'
      ? number
      : K extends 'int?' | 'num?'
        ? number | null
        : boolean;

export type RowOf<S extends ColumnSpec> = { -readonly [C in keyof S]: KindValue<S[C]> };

function check(kind: ColumnKind, v: unknown): boolean {
  switch (kind) {
    case 'str':
      return typeof v === 'string';
    case 'str?':
      return v === null || typeof v === 'string';
    case 'int':
      return typeof v === 'number' && Number.isInteger(v);
    case 'int?':
      return v === null || (typeof v === 'number' && Number.isInteger(v));
    case 'num':
      return typeof v === 'number' && Number.isFinite(v);
    case 'num?':
      return v === null || (typeof v === 'number' && Number.isFinite(v));
    case 'bool':
      return typeof v === 'boolean';
  }
}

/** Reads every column of `spec` from a Parquet buffer into row objects; throws on a missing column or a type drift. */
export async function readRows<S extends ColumnSpec>(file: ArrayBuffer, spec: S, label: string): Promise<RowOf<S>[]> {
  const n = Number(parquetMetadata(file).num_rows);
  const names = Object.keys(spec);
  const columns = new Map<string, unknown[]>(names.map((c) => [c, new Array<unknown>(n)]));
  await parquetRead({
    file,
    columns: names,
    onChunk: ({ columnName, columnData, rowStart }) => {
      const out = columns.get(columnName);
      if (!out) throw new Error(`${label}: unexpected column ${columnName}`);
      for (let i = 0; i < columnData.length; i++) out[rowStart + i] = columnData[i];
    },
  });
  for (const [name, kind] of Object.entries(spec)) {
    const values = columns.get(name) ?? [];
    for (let i = 0; i < n; i++)
      if (!check(kind, values[i]))
        throw new Error(`${label}: column ${name} row ${i} is ${String(values[i])}, expected ${kind}`);
  }
  const rows = new Array<RowOf<S>>(n);
  for (let i = 0; i < n; i++) {
    const row: Record<string, unknown> = {};
    for (const name of names) row[name] = columns.get(name)?.[i];
    rows[i] = row as RowOf<S>; // every value checked against its kind above
  }
  return rows;
}
