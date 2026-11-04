import { checkRows, readRows } from "./parquet-columns";
import { DETAIL, FILES, detailIndexSchema, parseManifest } from "./manifest";
import type { DetailIndexFile, FileKey, SalesManifest } from "./manifest";
import type { ColumnSpec, RowOf } from "./parquet-columns";
import type {
  ClientRow,
  CohortRow,
  DetailParts,
  FileRows,
  LoanRow,
  SalesBase,
} from "./types";

// Loader for the Mirelo sales data (ADR-0011 (c)): manifest + base files on first paint; the detail files a drill
// needs on demand (2026-11-01: the full data in `detail/`, one file per month / cohort / client bucket). Since
// 2026-11-03 the browser reads the same artifacts as JSON from /api/mirelo (Supabase, schema mirelo_demo) while the
// tests and the load script read the Parquet in data/mirelo/parquet; the ArtifactSource below is that seam.
// Per-session in-memory cache; a failed read is evicted so the next call retries (same contract as the P&L loader).

/** Reads one Parquet / JSON artifact by file name as bytes (`fs` in Node tests and the load script). */
export type ReadArtifact = (name: string) => Promise<ArrayBuffer>;

/** Where the artifacts come from: Parquet bytes, or the server route's JSON. */
export interface ArtifactSource {
  json(name: string): Promise<unknown>;
  rows<S extends ColumnSpec>(
    name: string,
    spec: S,
    label: string,
  ): Promise<RowOf<S>[]>;
}

export function parquetSource(read: ReadArtifact): ArtifactSource {
  return {
    json: async (name) =>
      JSON.parse(new TextDecoder().decode(await read(name))) as unknown,
    rows: async (name, spec, label) => readRows(await read(name), spec, label),
  };
}

/** The browser's source: `/api/mirelo/<name>` answers with the file's rows (or document) as JSON. */
export function jsonSource(
  fetchJson: (name: string) => Promise<unknown>,
): ArtifactSource {
  return {
    json: fetchJson,
    rows: async (name, spec, label) =>
      checkRows(await fetchJson(name), spec, label),
  };
}

export interface SalesLoader {
  base(): Promise<SalesBase>;
  /** The named `detail/` files (engine.detailFiles), merged by kind; each file is fetched once per session. */
  detail(names: readonly string[]): Promise<DetailParts>;
}

export function createSalesLoader(source: ArtifactSource): SalesLoader {
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
      source.json("manifest.json").then(parseManifest),
      () => (manifest = undefined),
    ));

  async function file<K extends FileKey>(
    key: K,
    m: SalesManifest,
  ): Promise<FileRows<K>> {
    const { file: name, columns } = FILES[key];
    const rows = await source.rows(name, columns, name);
    const expected = m.files[name]?.rows;
    if (rows.length !== expected)
      throw new Error(
        `${name}: ${rows.length} rows, manifest says ${expected}`,
      );
    return rows as FileRows<K>; // RowOf of the same spec; the cast only restores the key → spec pairing
  }

  async function loadBase(): Promise<SalesBase> {
    const m = await loadManifest();
    const [
      loansMonth,
      funnelMonth,
      portfolioMonth,
      vintage,
      windowStats,
      cohortCurve,
      agentMonth,
    ] = await Promise.all([
      file("loansMonth", m),
      file("funnelMonth", m),
      file("portfolioMonth", m),
      file("vintage", m),
      file("windowStats", m),
      file("cohortCurve", m),
      file("agentMonth", m),
    ]);
    const [revenueMonth, subsMonth, targetMonth] = await Promise.all([
      file("revenueMonth", m),
      file("subsMonth", m),
      file("targetMonth", m),
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
      source
        .json(`${DETAIL.dir}/index.json`)
        .then((j) => detailIndexSchema.parse(j)),
      () => (index = undefined),
    ));
  const kindOf = (name: string): ColumnSpec =>
    name.startsWith("cohort-")
      ? DETAIL.cohort
      : name.startsWith("client-dim-")
        ? DETAIL.clients
        : DETAIL.loans;
  function part(name: string): Promise<unknown[]> {
    let p = parts.get(name);
    if (!p) {
      p = cached(
        (async () => {
          const expected = (await loadIndex()).files[name]?.rows;
          if (expected === undefined)
            throw new Error(`${name}: not in ${DETAIL.dir}/index.json`);
          const rows = await source.rows(
            `${DETAIL.dir}/${name}`,
            kindOf(name),
            name,
          );
          if (rows.length !== expected)
            throw new Error(
              `${name}: ${rows.length} rows, index says ${expected}`,
            );
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
      if (name.startsWith("cohort-")) out.cohort.push(...(rows as CohortRow[]));
      else if (name.startsWith("client-dim-"))
        out.clients.push(...(rows as ClientRow[]));
      else out.loans.push(...(rows as LoanRow[]));
    });
    return out;
  }

  return {
    base: () => (base ??= cached(loadBase(), () => (base = undefined))),
    detail: loadDetail,
  };
}
