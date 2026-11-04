import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import postgres from "postgres";
import type { Sql } from "postgres";
import {
  allArtifactNames,
  resolveArtifact,
  runArtifact,
} from "@/lib/mirelo/artifacts";
import type { Db } from "@/lib/mirelo/artifacts";
import {
  DETAIL,
  FILES,
  detailIndexSchema,
  parseManifest,
} from "@/lib/mirelo/manifest";
import { readRows } from "@/lib/mirelo/parquet-columns";
import type { ColumnSpec, RowOf } from "@/lib/mirelo/parquet-columns";

// Loads data/mirelo/parquet (the files the report used to fetch from public/data/mirelo) into Supabase schema
// `mirelo_demo`, then verifies every artifact the server route serves against the Parquet it replaces: same rows,
// same values, same order. Run from the owner's machine only, as mirelo_loader (Session pooler):
//
//     node --env-file=.env.local --import tsx scripts/mirelo-load.ts            # truncate, load, verify
//     node --env-file=.env.local --import tsx scripts/mirelo-load.ts --verify   # verify only
//
// Node reads .env.local; this script never prints a value from it. Nothing here runs in the site.

const DIR = new URL("../data/mirelo/parquet/", import.meta.url);
const BATCH = 1000;
const VERIFY_ONLY = process.argv.includes("--verify");

const bytes = async (name: string): Promise<ArrayBuffer> => {
  const b = await readFile(fileURLToPath(new URL(name, DIR)));
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
};
const json = async (name: string): Promise<unknown> =>
  JSON.parse(await readFile(fileURLToPath(new URL(name, DIR)), "utf8"));
const rows = async <S extends ColumnSpec>(
  name: string,
  spec: S,
): Promise<RowOf<S>[]> => readRows(await bytes(name), spec, name);

const tableOf = (file: string) =>
  file.replace(/\.parquet$/, "").replace(/-/g, "_");
const specOf = (file: string): ColumnSpec =>
  file.startsWith("cohort-")
    ? DETAIL.cohort
    : file.startsWith("client-dim-")
      ? DETAIL.clients
      : DETAIL.loans;

async function insert(
  sql: Db,
  table: string,
  columns: string[],
  data: readonly Record<string, unknown>[],
): Promise<void> {
  for (let i = 0; i < data.length; i += BATCH) {
    const slice = data.slice(i, i + BATCH);
    await sql`insert into ${sql(table)} ${sql(slice, ...columns)}`;
  }
}

async function load(sql: Sql): Promise<void> {
  const manifest = parseManifest(await json("manifest.json"));
  const index = detailIndexSchema.parse(await json(`${DETAIL.dir}/index.json`));
  const detailFiles = Object.keys(index.files).sort();

  await sql.begin(async (tx) => {
    await tx`truncate document, loan, client, ${tx(Object.values(FILES).map((f) => tableOf(f.file)))}`;
    await tx`insert into document ${tx(
      [
        { name: "manifest.json", doc: manifest },
        { name: `${DETAIL.dir}/index.json`, doc: index },
      ],
      "name",
      "doc",
    )}`;

    for (const f of Object.values(FILES)) {
      const data = await rows(f.file, f.columns);
      await insert(
        tx,
        tableOf(f.file),
        ["seq", ...Object.keys(f.columns)],
        data.map((r, seq) => ({ seq, ...r })),
      );
      console.log(`${tableOf(f.file)}: ${data.length} rows`);
    }

    const loanColumns = Object.keys(DETAIL.loans);
    let loans = 0;
    for (const file of detailFiles.filter((f) => f.startsWith("loans-"))) {
      const data = await rows(`${DETAIL.dir}/${file}`, DETAIL.loans);
      await insert(tx, "loan", loanColumns, data);
      loans += data.length;
    }
    console.log(`loan: ${loans} rows`);

    const summary = new Map<number, RowOf<typeof DETAIL.cohort>>();
    for (const file of detailFiles.filter((f) => f.startsWith("cohort-")))
      for (const r of await rows(`${DETAIL.dir}/${file}`, DETAIL.cohort))
        summary.set(r.client_id, r);
    const clients: Record<string, unknown>[] = [];
    for (const file of detailFiles.filter((f) => f.startsWith("client-dim-")))
      for (const r of await rows(`${DETAIL.dir}/${file}`, DETAIL.clients)) {
        const s = summary.get(r.client_id);
        clients.push({
          ...r,
          loans_to_date: s?.loans_to_date ?? null,
          principal_eur_to_date: s?.principal_eur_to_date ?? null,
          last_disbursed: s?.last_disbursed ?? null,
          last_status: s?.last_status ?? null,
        });
      }
    const clientColumns = [
      ...Object.keys(DETAIL.clients),
      "loans_to_date",
      "principal_eur_to_date",
      "last_disbursed",
      "last_status",
    ];
    await insert(tx, "client", clientColumns, clients);
    console.log(
      `client: ${clients.length} rows (${summary.size} with a cohort summary)`,
    );
  });
}

/** Every artifact the route can serve, compared with the Parquet file it replaces. Returns the names that differ. */
async function verify(sql: Sql): Promise<string[]> {
  const index = detailIndexSchema.parse(await json(`${DETAIL.dir}/index.json`));
  const names = allArtifactNames(Object.keys(index.files).sort());
  const failures: string[] = [];
  let checked = 0;
  for (const name of names) {
    const query = resolveArtifact(name);
    if (!query) {
      failures.push(`${name}: no query`);
      continue;
    }
    const expected =
      query.kind === "document"
        ? await json(name)
        : name.startsWith(`${DETAIL.dir}/`)
          ? await rows(name, specOf(name.slice(DETAIL.dir.length + 1)))
          : await rows(
              name,
              Object.values(FILES).find((f) => f.file === name)?.columns ?? {},
            );
    const actual = await runArtifact(sql, query);
    if (!isDeepStrictEqual(actual, expected)) {
      const n = Array.isArray(actual) ? actual.length : "?";
      const e = Array.isArray(expected) ? expected.length : "?";
      failures.push(`${name}: differs (${n} rows vs ${e} in Parquet)`);
    }
    checked += 1;
  }
  console.log(`verified ${checked} artifacts, ${failures.length} differ`);
  return failures;
}

async function main(): Promise<number> {
  const url = process.env.MIRELO_LOAD_DATABASE_URL;
  if (!url) {
    console.error(
      "MIRELO_LOAD_DATABASE_URL is not set: run with node --env-file=.env.local",
    );
    return 2;
  }
  const sql = postgres(url, { max: 1, ssl: "require" });
  try {
    if (!VERIFY_ONLY) await load(sql);
    const failures = await verify(sql);
    for (const f of failures) console.error(`  ${f}`);
    const [size] = await sql<
      { size: string }[]
    >`select pg_size_pretty(pg_database_size(current_database())) as size`;
    console.log(`database size: ${size?.size ?? "?"}`);
    return failures.length === 0 ? 0 : 1;
  } finally {
    await sql.end();
  }
}

main().then(
  (code) => process.exit(code),
  (error: unknown) => {
    // A driver error can carry the host; never the password. Print the message only.
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  },
);
