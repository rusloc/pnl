import { readRows } from '../data/parquet-columns.ts';
import { FILES, parseManifest } from './manifest.ts';
import type { FileKey, SalesManifest } from './manifest.ts';
import type { FileRows, SalesBase, SalesDetail } from './types.ts';

// Loader for public/data/sales (ADR-0011 (c)): manifest + base files on first paint, the detail sample on first need.
// Per-session in-memory cache; a failed read is evicted so the next call retries (same contract as the P&L loader).

/** Reads one public/data/sales artifact by file name: `fetch` in the browser, `fs` in Node tests. */
export type ReadArtifact = (name: string) => Promise<ArrayBuffer>;

export interface SalesLoader {
  base(): Promise<SalesBase>;
  detail(): Promise<SalesDetail>;
}

export function createSalesLoader(read: ReadArtifact): SalesLoader {
  let manifest: Promise<SalesManifest> | undefined;
  let base: Promise<SalesBase> | undefined;
  let detail: Promise<SalesDetail> | undefined;

  const cached = <T>(p: Promise<T>, evict: () => void): Promise<T> => {
    p.catch(evict);
    return p;
  };

  const loadManifest = () =>
    (manifest ??= cached(
      read('manifest.json').then((b) => parseManifest(JSON.parse(new TextDecoder().decode(b)))),
      () => (manifest = undefined),
    ));

  async function file<K extends FileKey>(key: K, m: SalesManifest): Promise<FileRows<K>> {
    const { file: name, columns } = FILES[key];
    const rows = await readRows(await read(name), columns, name);
    const expected = m.files[name]?.rows;
    if (rows.length !== expected) throw new Error(`${name}: ${rows.length} rows, manifest says ${expected}`);
    return rows as FileRows<K>; // RowOf of the same spec; the cast only restores the key → spec pairing
  }

  async function loadBase(): Promise<SalesBase> {
    const m = await loadManifest();
    const [loansMonth, funnelMonth, portfolioMonth, vintage, windowStats, cohortCurve, agentMonth] = await Promise.all([
      file('loansMonth', m),
      file('funnelMonth', m),
      file('portfolioMonth', m),
      file('vintage', m),
      file('windowStats', m),
      file('cohortCurve', m),
      file('agentMonth', m),
    ]);
    const [revenueMonth, subsMonth, targetMonth] = await Promise.all([
      file('revenueMonth', m),
      file('subsMonth', m),
      file('targetMonth', m),
    ]);
    return {
      manifest: m,
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
    };
  }

  async function loadDetail(): Promise<SalesDetail> {
    const m = await loadManifest();
    const [loans, clients] = await Promise.all([file('detailLoans', m), file('detailClients', m)]);
    return { loans, clients };
  }

  return {
    base: () => (base ??= cached(loadBase(), () => (base = undefined))),
    detail: () => (detail ??= cached(loadDetail(), () => (detail = undefined))),
  };
}
