import type { z } from 'zod';
import { readRows } from './parquet-columns.ts';
import type { RowOf } from './parquet-columns.ts';
import { FILES, manifestSchema, unfilteredManifestSchema } from './manifest.ts';
import type { FileKey, Manifest, UnfilteredManifest } from './manifest.ts';

// Loader for public/data (contract §2.3; pattern of js-marketing/lib/data/loader.ts): manifest.json through the strict
// Zod schema, then the Parquet files through the FILES specs, each checked against the manifest's row count. First paint
// = manifest + time-week + plan-month + rock-week; plan-week loads on the first pick of Plan type = Week. One promise per
// group per session; a failed read is evicted so the next call retries.

/** Reads one artifact by file name: `fetch` in the browser, `fs` in Node tests. */
export type ReadArtifact = (name: string) => Promise<ArrayBuffer>;

export type FileRows<K extends FileKey> = RowOf<(typeof FILES)[K]['columns']>[];

export interface CoreFiles<M = Manifest> {
  manifest: M;
  timeWeek: FileRows<'timeWeek'>;
  planMonth: FileRows<'planMonth'>;
  rockWeek: FileRows<'rockWeek'>;
}

export interface TrucksLoader<M = Manifest> {
  core(): Promise<CoreFiles<M>>;
  planWeek(): Promise<FileRows<'planWeek'>>;
}

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    pending ??= load();
    pending.catch(() => (pending = undefined));
    return pending;
  };
}

function build<M extends Pick<Manifest, 'files'>>(read: ReadArtifact, schema: z.ZodType<M>): TrucksLoader<M> {
  const manifest = once(async () => schema.parse(JSON.parse(new TextDecoder().decode(await read('manifest.json')))));

  async function file<K extends FileKey>(key: K): Promise<FileRows<K>> {
    const m = await manifest();
    const { file: name, columns } = FILES[key];
    const rows = await readRows(await read(name), columns, name);
    if (rows.length !== m.files[key].rows)
      throw new Error(`${name}: ${rows.length} rows, manifest says ${m.files[key].rows}`);
    return rows as FileRows<K>; // RowOf of the same spec; the cast only restores the key → spec pairing
  }

  const core = once(async () => {
    const [timeWeek, planMonth, rockWeek] = await Promise.all([file('timeWeek'), file('planMonth'), file('rockWeek')]);
    return { manifest: await manifest(), timeWeek, planMonth, rockWeek };
  });
  return { core, planWeek: once(() => file('planWeek')) };
}

export const createLoader = (read: ReadArtifact): TrucksLoader => build(read, manifestSchema);

/** The `--keep-excluded` fixture set (tests only). */
export const createUnfilteredLoader = (read: ReadArtifact): TrucksLoader<UnfilteredManifest> =>
  build(read, unfilteredManifestSchema);
