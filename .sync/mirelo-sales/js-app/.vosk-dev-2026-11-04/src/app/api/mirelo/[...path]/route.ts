import { NextResponse } from "next/server";
import { readArtifact } from "@/lib/mirelo/server";

/**
 * Serves the Mirelo sales report's data from Supabase (schema `mirelo_demo`), one artifact per request, under the
 * file names the browser used to fetch from public/data/mirelo (lib/mirelo/artifacts.ts). Public by necessity —
 * visitors are anonymous — and narrow by design: only a known artifact name, read through a role that can see
 * nothing but this synthetic data, at a modest rate.
 *
 * The data is a frozen snapshot, so the CDN keeps each answer a day and serves stale while it refreshes: the
 * database sees a handful of reads per artifact, not one per visitor.
 *
 * Reachable only because proxy.ts excludes /api/* from locale rewriting (CAND-001).
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_CONTROL =
  "public, max-age=300, s-maxage=86400, stale-while-revalidate=604800";

// A session reads ten base files and a few detail files per drill. Same best-effort in-memory shape as the other
// routes: per-instance, resets on cold start; enough to blunt casual abuse on a low-traffic site.
const MAX_PER_WINDOW = 600;
const WINDOW_MS = 10 * 60 * 1000;
const hits = new Map<string, number[]>();

function isRateLimited(key: string, now: number): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  return recent.length > MAX_PER_WINDOW;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ path: string[] }> },
) {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (isRateLimited(ip, Date.now())) {
    return new Response("Too many requests", { status: 429 });
  }

  const { path } = await ctx.params;
  const name = path.join("/");
  try {
    const result = await readArtifact(name);
    if (result.status !== 200)
      return new Response(
        result.status === 404 ? "Not found" : "Report data is not configured",
        { status: result.status },
      );
    return NextResponse.json(result.body, {
      headers: { "Cache-Control": CACHE_CONTROL },
    });
  } catch (error) {
    // The message may name a host or a table, never a credential; the body stays generic.
    console.error(
      `mirelo artifact ${name}: ${error instanceof Error ? error.message : String(error)}`,
    );
    return new Response("Report data unavailable", { status: 502 });
  }
}
