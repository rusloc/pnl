import { readRows } from './parquet-columns.ts';
import type { RowOf } from './parquet-columns.ts';
import { FILES, manifestSchema } from './manifest.ts';
import type { FileKey, Manifest } from './manifest.ts';

// Loader for public/data (ADR-0002 §2.2 pattern): manifest.json (strict Zod) + the four Parquet files, all on first
// paint (≈ 0.45 MB, E-83). One in-memory promise per session; a failed read is evicted so the next call retries.

/** Reads one public/data artifact by file name: `fetch` in the browser, `fs` in Node tests. */
export type ReadArtifact = (name: string) => Promise<ArrayBuffer>;

export type FileRows<K extends FileKey> = RowOf<(typeof FILES)[K]['columns']>[];

export interface ExecFiles {
  manifest: Manifest;
  cube: FileRows<'cube'>;
  opex: FileRows<'opex'>;
  po: FileRows<'po'>;
  sites: FileRows<'sites'>;
}

export function createLoader(read: ReadArtifact): () => Promise<ExecFiles> {
  let pending: Promise<ExecFiles> | undefined;

  async function file<K extends FileKey>(key: K, m: Manifest): Promise<FileRows<K>> {
    const { file: name, columns } = FILES[key];
    const rows = await readRows(await read(name), columns, name);
    if (rows.length !== m.files[key].rows)
      throw new Error(`${name}: ${rows.length} rows, manifest says ${m.files[key].rows}`);
    return rows as FileRows<K>; // RowOf of the same spec; the cast only restores the key → spec pairing
  }

  async function load(): Promise<ExecFiles> {
    const manifest = manifestSchema.parse(JSON.parse(new TextDecoder().decode(await read('manifest.json'))));
    const [cube, opex, po, sites] = await Promise.all([
      file('cube', manifest),
      file('opex', manifest),
      file('po', manifest),
      file('sites', manifest),
    ]);
    return { manifest, cube, opex, po, sites };
  }

  return () => {
    pending ??= load();
    pending.catch(() => (pending = undefined));
    return pending;
  };
}
