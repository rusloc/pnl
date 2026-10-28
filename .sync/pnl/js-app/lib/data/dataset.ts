import type { EntityCode, OpsColumns, PlColumns } from '../engine/types.ts';
import { OPS_FILE, PL_FILES, parseManifest } from './manifest.ts';
import type { Manifest } from './manifest.ts';
import { readOpsColumns, readPlColumns } from './parquet-loader.ts';

/** Everything the engine reads (ADR-0002 §2.3). Entity files are loaded on demand (Group needs both). */
export interface Dataset {
  manifest: Manifest;
  pl: ReadonlyMap<EntityCode, PlColumns>;
  ops: OpsColumns; // both entities, small (first-load budget, build-data.ts): units, GMV, merchants for the Vitals view
}

/** Reads one public/data artifact by file name: `fetch` in the browser, `fs` in Node tests. */
export type ReadArtifact = (name: string) => Promise<ArrayBuffer>;

/** Loader with a per-session in-memory cache; a failed read is evicted so the next call retries. */
export function createDatasetLoader(read: ReadArtifact) {
  let manifest: Promise<Manifest> | undefined;
  const pl = new Map<EntityCode, Promise<PlColumns>>();
  let ops: Promise<OpsColumns> | undefined;

  function cached<T>(promise: Promise<T>, evict: () => void): Promise<T> {
    promise.catch(evict);
    return promise;
  }

  function loadManifest(): Promise<Manifest> {
    manifest ??= cached(
      read('manifest.json').then((bytes) => parseManifest(JSON.parse(new TextDecoder().decode(bytes)))),
      () => (manifest = undefined),
    );
    return manifest;
  }

  function loadPl(entity: EntityCode, m: Manifest): Promise<PlColumns> {
    let p = pl.get(entity);
    if (!p) {
      p = cached(
        read(PL_FILES[entity]).then((bytes) => readPlColumns(bytes, m)),
        () => pl.delete(entity),
      );
      pl.set(entity, p);
    }
    return p;
  }

  function loadOps(m: Manifest): Promise<OpsColumns> {
    ops ??= cached(
      read(OPS_FILE).then((bytes) => readOpsColumns(bytes, m)),
      () => (ops = undefined),
    );
    return ops;
  }

  return {
    async load(entities: readonly EntityCode[]): Promise<Dataset> {
      const m = await loadManifest();
      const [columns, opsColumns] = await Promise.all([Promise.all(entities.map((e) => loadPl(e, m))), loadOps(m)]);
      return { manifest: m, pl: new Map(entities.map((e, i) => [e, columns[i] as PlColumns])), ops: opsColumns };
    },
  };
}
