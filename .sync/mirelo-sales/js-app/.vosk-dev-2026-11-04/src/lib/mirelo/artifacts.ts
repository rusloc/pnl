import type { Sql, TransactionSql } from "postgres";
import { DETAIL, FILES } from "./manifest";

// Artifact name → the query that reproduces that file from Supabase schema `mirelo_demo` (2026-11-03: the report's
// data moved out of public/data/mirelo; the file names stayed the contract between the browser and its source, so
// data.ts and the engine did not change shape). Pure, framework-free: the server route (server.ts) and the load
// script's verification (scripts/mirelo-load.ts) both build on it. Every table, column and sort key here comes from
// our own specs, never from the request; the request contributes only a validated month or bucket number.
// Row order reproduces data/mirelo/build_detail.py: loans by loan_id per month, client cards by client_id,
// disbursed, loan_id; base files keep their file order in `seq`.

/** A connection or a transaction handle: both run the same tagged templates. */
export type Db = Sql | TransactionSql;

export type Where =
  | { month: string }
  | { cohortMonth: string }
  | { bucket: number }
  | { overdue: true }
  | null;

export type ArtifactQuery =
  | { kind: "document"; name: string }
  | {
      kind: "rows";
      table: string;
      columns: readonly string[];
      where: Where;
      orderBy: readonly string[];
    };

/** `loans-month.parquet` → table `loans_month`, with the file's columns. */
const BASE = new Map<string, { table: string; columns: string[] }>(
  Object.values(FILES).map((f) => [
    f.file,
    {
      table: f.file.replace(/\.parquet$/, "").replace(/-/g, "_"),
      columns: Object.keys(f.columns),
    },
  ]),
);
const LOAN_COLUMNS = Object.keys(DETAIL.loans);
const CLIENT_COLUMNS = Object.keys(DETAIL.clients);
const COHORT_COLUMNS = Object.keys(DETAIL.cohort);
const MONTH = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const INDEX_NAME = `${DETAIL.dir}/index.json`;

const capture = (re: RegExp, s: string): string | undefined => re.exec(s)?.[1];
const bucketOf = (s: string | undefined): number | undefined => {
  if (s === undefined) return undefined;
  const n = Number(s);
  return n < DETAIL.buckets ? n : undefined;
};

/** The query for one artifact name, or null when the name is not one the report reads (the route answers 404). */
export function resolveArtifact(name: string): ArtifactQuery | null {
  if (name === "manifest.json" || name === INDEX_NAME)
    return { kind: "document", name };
  const base = BASE.get(name);
  if (base) return { kind: "rows", ...base, where: null, orderBy: ["seq"] };
  if (!name.startsWith(`${DETAIL.dir}/`)) return null;
  const file = name.slice(DETAIL.dir.length + 1);

  if (file === "overdue.parquet")
    return {
      kind: "rows",
      table: "loan",
      columns: LOAN_COLUMNS,
      where: { overdue: true },
      orderBy: ["loan_id"],
    };
  const loansMonth = capture(/^loans-(\d{4}-\d{2})\.parquet$/, file);
  if (loansMonth !== undefined && MONTH.test(loansMonth))
    return {
      kind: "rows",
      table: "loan",
      columns: LOAN_COLUMNS,
      where: { month: loansMonth },
      orderBy: ["loan_id"],
    };
  const cohortMonth = capture(/^cohort-(\d{4}-\d{2})\.parquet$/, file);
  if (cohortMonth !== undefined && MONTH.test(cohortMonth))
    return {
      kind: "rows",
      table: "client",
      columns: COHORT_COLUMNS,
      where: { cohortMonth },
      orderBy: ["client_id"],
    };
  const dimBucket = bucketOf(capture(/^client-dim-(\d{2})\.parquet$/, file));
  if (dimBucket !== undefined)
    return {
      kind: "rows",
      table: "client",
      columns: CLIENT_COLUMNS,
      where: { bucket: dimBucket },
      orderBy: ["client_id"],
    };
  const loanBucket = bucketOf(capture(/^client-(\d{2})\.parquet$/, file));
  if (loanBucket !== undefined)
    return {
      kind: "rows",
      table: "loan",
      columns: LOAN_COLUMNS,
      where: { bucket: loanBucket },
      orderBy: ["client_id", "disbursed", "loan_id"],
    };
  return null;
}

/** Every artifact name the report can ask for, given the detail index's file list (the load script verifies them all). */
export function allArtifactNames(detailFiles: readonly string[]): string[] {
  return [
    "manifest.json",
    INDEX_NAME,
    ...Object.values(FILES).map((f) => f.file),
    ...detailFiles.map((f) => `${DETAIL.dir}/${f}`),
  ];
}

/**
 * Runs one artifact query on a connection whose role has `search_path = mirelo_demo` (both roles do, at login).
 * Documents come back as the stored JSON; row queries as an array of plain objects in spec column order.
 */
export async function runArtifact(sql: Db, q: ArtifactQuery): Promise<unknown> {
  if (q.kind === "document") {
    const rows = await sql<
      { doc: unknown }[]
    >`select doc from document where name = ${q.name}`;
    const doc = rows[0]?.doc;
    if (doc === undefined) throw new Error(`${q.name}: not loaded`);
    return doc;
  }
  const w = q.where;
  const where =
    w === null
      ? sql``
      : "month" in w
        ? sql`where month = ${w.month}`
        : "cohortMonth" in w
          ? sql`where cohort_month = ${w.cohortMonth} and loans_to_date is not null`
          : "bucket" in w
            ? sql`where bucket = ${w.bucket}`
            : sql`where dpd_close >= 30 and outstanding_close_local > 0`;
  const rows =
    await sql`select ${sql([...q.columns])} from ${sql(q.table)} ${where} order by ${sql([...q.orderBy])}`;
  return [...rows];
}
