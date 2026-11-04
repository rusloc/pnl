import "server-only";
import postgres from "postgres";
import type { Sql } from "postgres";
import { resolveArtifact, runArtifact } from "./artifacts";

// The site's one connection to the Mirelo data: role `mirelo_reader`, which can read schema `mirelo_demo` and
// nothing else (data/mirelo/sql/001-schema-and-roles.sql). The URL lives only in the server env
// (MIRELO_DATABASE_URL, **Session pooler, port 5432**); this module never leaves the server bundle.
//
// Why the Session pooler (2026-11-03): through the Transaction pooler (6543) this driver's concurrent reads stall,
// even on one connection, and a reply can land on another request (the browser asks for seven files at once and
// got the wrong columns for one). Session mode answered the same ten concurrent reads in ~1.2 s with no mismatch.
// A small pool with a short idle timeout keeps the backend count low; the role's connection limit is the ceiling.

let client: Sql | undefined;

/** The reader connection, or null when MIRELO_DATABASE_URL is unset (the route answers 503 instead of failing the build). */
function db(): Sql | null {
  const url = process.env.MIRELO_DATABASE_URL;
  if (!url) return null;
  if (new URL(url).port === "6543")
    throw new Error(
      "MIRELO_DATABASE_URL must use the Session pooler (port 5432): through the Transaction pooler concurrent reads stall",
    );
  return (client ??= postgres(url, {
    max: 2,
    ssl: "require",
    idle_timeout: 20,
    connect_timeout: 10,
  }));
}

export type ArtifactResult =
  { status: 200; body: unknown } | { status: 404 | 503 };

export async function readArtifact(name: string): Promise<ArtifactResult> {
  const query = resolveArtifact(name);
  if (!query) return { status: 404 };
  const sql = db();
  if (!sql) return { status: 503 };
  return { status: 200, body: await runArtifact(sql, query) };
}
