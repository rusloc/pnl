import { readRows } from '../data/parquet-columns.ts';
import { DETAIL, FILES, detailIndexSchema, parseManifest } from './manifest.ts';
import type { DetailIndexFile, FileKey, SalesManifest } from './manifest.ts';
import type { ColumnSpec } from '../data/parquet-columns.ts';
import type { ClientRow, CohortRow, DetailParts, FileRows, LoanRow, SalesBase } from './types.ts';

// Loader for public/data/sales (ADR-0011 (c)): manifest + base files on first paint; the detail files a drill needs
// on demand (2026-11-01: the full data in `detail/`, one file per month / cohort / client bucket).
// Per-session in-memory cache; a failed read is evicted so the next call retries (same contract as the P&L loader).

/** Reads one public/data/sales artifact by file name: `fetch` in the browser, `fs` in Node tests. */
export type ReadArtifact = (name: string) => Promise<ArrayBuffer>;

export interface SalesLoader {
  base(): Promise<SalesBase>;
  /** The named `detail/` files (engine.detailFiles), merged by kind; each file is fetched once per session. */
  detail(names: readonly string[]): Promise<DetailParts>;
}

export function createSalesLoader(read: ReadArtifact): SalesLoader {
  let manifest: Promise<SalesManifest> | undefined;
  let base: Promise<SalesBase> | undefined;
  let index: Promise<DetailIndexFile> | undefined;
  const parts = new Map<string, Promise<unknown[]>>();

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

  const loadIndex = () =>
    (index ??= cached(
      read(`${DETAIL.dir}/index.json`).then((b) => detailIndexSchema.parse(JSON.parse(new TextDecoder().decode(b)))),
      () => (index = undefined),
    ));
  const kindOf = (name: string): ColumnSpec =>
    name.startsWith('cohort-') ? DETAIL.cohort : name.startsWith('client-dim-') ? DETAIL.clients : DETAIL.loans;
  function part(name: string): Promise<unknown[]> {
    let p = parts.get(name);
    if (!p) {
      p = cached(
        (async () => {
          const expected = (await loadIndex()).files[name]?.rows;
          if (expected === undefined) throw new Error(`${name}: not in ${DETAIL.dir}/index.json`);
          const rows = await readRows(await read(`${DETAIL.dir}/${name}`), kindOf(name), name);
          if (rows.length !== expected) throw new Error(`${name}: ${rows.length} rows, index says ${expected}`);
          return rows;
        })(),
        () => parts.delete(name),
      );
      parts.set(name, p);
    }
    return p;
  }
  async function loadDetail(names: readonly string[]): Promise<DetailParts> {
    const out: DetailParts = { loans: [], cohort: [], clients: [] };
    const loaded = await Promise.all(names.map(part));
    names.forEach((name, k) => {
      const rows = loaded[k] ?? [];
      // the cast restores the name → spec pairing kindOf() chose
      if (name.startsWith('cohort-')) out.cohort.push(...(rows as CohortRow[]));
      else if (name.startsWith('client-dim-')) out.clients.push(...(rows as ClientRow[]));
      else out.loans.push(...(rows as LoanRow[]));
    });
    return out;
  }

  return {
    base: () => (base ??= cached(loadBase(), () => (base = undefined))),
    detail: loadDetail,
  };
}
