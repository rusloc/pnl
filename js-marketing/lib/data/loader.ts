import { readRows } from './parquet-columns.ts';
import type { RowOf } from './parquet-columns.ts';
import { CAMPAIGNS_FILES, FILES, FIRST_PAINT_FILES, JOURNEY_FILES, manifestSchema } from './manifest.ts';
import type { FileKey, Manifest } from './manifest.ts';

// Loader for public/data (contract §2.3; ADR-0002 §2.2 pattern, as js-exec/lib/data/loader.ts): manifest.json through
// the strict Zod schema, then the Parquet files through the FILES specs, each checked against the manifest's row count.
// First paint = manifest + campaign-day + cohort-month + retention; the Journey files load on the first open of
// Journey, term-day on the first open of Campaigns. One promise per group per session; a failed read is evicted so the
// next call retries. Every file holds INT32 / DOUBLE only (the build converts INT64 / DATE), so readRows never meets a
// bigint or a Date (CAND-022).

/** Reads one public/data artifact by file name: `fetch` in the browser, `fs` in Node tests. */
export type ReadArtifact = (name: string) => Promise<ArrayBuffer>;

export type FileRows<K extends FileKey> = RowOf<(typeof FILES)[K]['columns']>[];

export interface CoreFiles {
  manifest: Manifest;
  campaignDay: FileRows<'campaignDay'>;
  cohortMonth: FileRows<'cohortMonth'>;
  retention: FileRows<'retention'>;
}
export interface JourneyFiles {
  journeyDay: FileRows<'journeyDay'>;
  trafficPageDay: FileRows<'trafficPageDay'>;
  segmentDay: FileRows<'segmentDay'>;
}
export interface CampaignsFiles {
  termDay: FileRows<'termDay'>;
}

export interface MarketingLoader {
  core(): Promise<CoreFiles>;
  journey(): Promise<JourneyFiles>;
  campaigns(): Promise<CampaignsFiles>;
}

function once<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | undefined;
  return () => {
    pending ??= load();
    pending.catch(() => (pending = undefined));
    return pending;
  };
}

export function createLoader(read: ReadArtifact): MarketingLoader {
  const manifest = once(async () =>
    manifestSchema.parse(JSON.parse(new TextDecoder().decode(await read('manifest.json')))),
  );

  async function file<K extends FileKey>(key: K): Promise<FileRows<K>> {
    const m = await manifest();
    const { file: name, columns } = FILES[key];
    const rows = await readRows(await read(name), columns, name);
    if (rows.length !== m.files[key].rows)
      throw new Error(`${name}: ${rows.length} rows, manifest says ${m.files[key].rows}`);
    return rows as FileRows<K>; // RowOf of the same spec; the cast only restores the key → spec pairing
  }

  const group = <const K extends readonly FileKey[]>(keys: K) =>
    once(async () => {
      const rows = await Promise.all(keys.map((k) => file(k)));
      return Object.fromEntries(keys.map((k, i) => [k, rows[i]])) as { [P in K[number]]: FileRows<P> };
    });

  const coreFiles = group(FIRST_PAINT_FILES);
  return {
    core: once(async () => ({ manifest: await manifest(), ...(await coreFiles()) })),
    journey: group(JOURNEY_FILES),
    campaigns: group(CAMPAIGNS_FILES),
  };
}
