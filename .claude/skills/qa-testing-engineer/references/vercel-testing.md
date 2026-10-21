# Vercel Integration Testing

Vercel-specific concerns: edge runtime, middleware behaviour, ISR / on-demand revalidation, environment variables, cron jobs, OG images. Most of this overlaps with Next.js testing (see `nextjs-react-testing.md`); this file focuses on the Vercel-specific edges.

---

## Edge Runtime vs. Node Runtime

Code marked `export const runtime = 'edge'` runs on V8 isolates, not Node. Subtle constraints:

- No `Buffer` (use `Uint8Array` / `TextEncoder`).
- No `fs`, `child_process`, no native modules.
- A subset of `crypto` — `crypto.randomUUID()` works, but Node-specific APIs don't.
- No `process.env` in the same shape — Vercel injects only the env vars you've allowed for the edge.

**Test implication**: if your Route Handler is `runtime = 'edge'`, your test environment must not let it accidentally use Node APIs that wouldn't be available at runtime.

```ts
// app/api/geo/route.ts
export const runtime = 'edge';

export async function GET(req: Request) {
  // ❌ would crash at runtime — no fs in edge
  // const fs = await import('fs');
  return Response.json({ ok: true });
}
```

A guardrail test:

```ts
it('uses no Node-only APIs', async () => {
  // The test environment is Node, so this won't crash even if you misuse fs.
  // The real catch is a CI step running `next build` — failures are caught there.
  // For unit tests, verify the function works with web APIs only:
  const res = await GET(new Request('http://test'));
  expect(res.status).toBe(200);
});
```

For the strongest guarantee, run an E2E that hits the deployed edge function. Unit tests only catch logic bugs, not runtime-mismatch bugs.

---

## Testing Middleware Geolocation & IP

Vercel injects geo/IP via headers and `request.geo` / `request.ip`. Test by constructing a `NextRequest` with these set:

```ts
import { NextRequest } from 'next/server';
import { middleware } from './middleware';

const makeReq = (path: string, opts: { country?: string; ip?: string } = {}) => {
  const url = `http://localhost${path}`;
  const headers = new Headers();
  if (opts.country) headers.set('x-vercel-ip-country', opts.country);
  if (opts.ip) headers.set('x-forwarded-for', opts.ip);
  return new NextRequest(url, { headers });
};

it('blocks requests from sanctioned countries', async () => {
  const res = await middleware(makeReq('/', { country: 'XX' }));
  expect(res.status).toBe(451);
});

it('rate-limits per IP', async () => {
  // 11 requests from the same IP, 11th should 429
  for (let i = 0; i < 10; i++) await middleware(makeReq('/api/x', { ip: '1.2.3.4' }));
  const res = await middleware(makeReq('/api/x', { ip: '1.2.3.4' }));
  expect(res.status).toBe(429);
});
```

**Critical IP-spoofing test:** `x-forwarded-for` is user-controllable. If your code reads it directly, an attacker can claim any IP they want. On Vercel, prefer `request.ip` (which Vercel populates from the trusted edge) and reject any code that reads `req.headers.get('x-forwarded-for')` for security decisions.

```ts
it('does not trust user-supplied x-forwarded-for', async () => {
  // Attacker tries to spoof a different IP via XFF
  const headers = new Headers({
    'x-forwarded-for': '8.8.8.8, 1.1.1.1',
    'x-real-ip': '8.8.8.8',
  });
  const req = new NextRequest('http://localhost/api/x', { headers });

  // The real source IP comes from Vercel's trusted header, not user-controlled XFF.
  // If your rate limiter is keyed on the real IP, the spoofed values shouldn't matter.
  // Verify by calling 11 times — the limiter should treat them as the same IP.
  for (let i = 0; i < 10; i++) await middleware(req);
  const res = await middleware(req);
  expect(res.status).toBe(429);
});
```

---

## ISR & On-Demand Revalidation

`revalidatePath` and `revalidateTag` invalidate the cached version of pages. Test that they're called at the right moments — otherwise users see stale data.

```ts
import { revalidatePath, revalidateTag } from 'next/cache';
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

it('revalidates the post list after creation', async () => {
  await createPost(formData({ title: 'Hi', body: 'Body' }));
  expect(revalidatePath).toHaveBeenCalledWith('/posts');
});

it('revalidates the specific post page after edit', async () => {
  await editPost('post-1', formData({ title: 'Updated' }));
  expect(revalidatePath).toHaveBeenCalledWith('/posts/post-1');
});

it('revalidates by tag on bulk operations', async () => {
  await archiveOldPosts();
  expect(revalidateTag).toHaveBeenCalledWith('posts');
});
```

**Picky cases:**
- After **delete** — does the page invalidate? (Common bug: only the create/update paths revalidate; delete leaves stale data.)
- Both the listing and the detail page should revalidate on edit.
- If a Server Action fails, revalidation should NOT happen — the data didn't change.
- For multi-tenant apps: revalidation should be scoped (`/team/[id]/posts`), not global.

---

## On-Demand Revalidation Webhook

Vercel revalidation webhooks (e.g., from a CMS) hit `app/api/revalidate/route.ts`. Common implementation:

```ts
export async function POST(req: Request) {
  const secret = req.headers.get('x-revalidate-secret');
  if (secret !== process.env.REVALIDATE_SECRET) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const { path, tag } = await req.json();
  if (path) revalidatePath(path);
  if (tag) revalidateTag(tag);
  return Response.json({ ok: true });
}
```

Tests:

```ts
it('rejects without the secret', async () => {
  const res = await POST(new Request('http://test', { method: 'POST', body: '{}' }));
  expect(res.status).toBe(401);
});

it('rejects with the wrong secret', async () => {
  const res = await POST(new Request('http://test', {
    method: 'POST',
    headers: { 'x-revalidate-secret': 'guess' },
    body: JSON.stringify({ path: '/' }),
  }));
  expect(res.status).toBe(401);
});

it('revalidates the requested path', async () => {
  await POST(new Request('http://test', {
    method: 'POST',
    headers: { 'x-revalidate-secret': 'secret-from-env' },
    body: JSON.stringify({ path: '/posts/abc' }),
  }));
  expect(revalidatePath).toHaveBeenCalledWith('/posts/abc');
});

it('refuses path traversal in the path', async () => {
  await POST(new Request('http://test', {
    method: 'POST',
    headers: { 'x-revalidate-secret': 'secret-from-env' },
    body: JSON.stringify({ path: '../../../etc/passwd' }),
  }));
  // revalidatePath silently does nothing for invalid paths, but the test
  // asserts your code rejected it (or normalized) before calling.
  expect(revalidatePath).not.toHaveBeenCalled();
});

it('compares the secret in constant time', async () => {
  // If you use ===, an attacker can theoretically time the comparison.
  // The test here is more architectural — does your code use crypto.timingSafeEqual?
  // Inspect the implementation; assert via code review, not test.
});
```

---

## Environment Variables in Tests

`process.env.NEXT_PUBLIC_*` is inlined at build time. In tests, set them via:

```ts
// vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'http://localhost:54321',
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'test-anon',
      SUPABASE_SECRET_KEY: 'test-service',
      REVALIDATE_SECRET: 'secret-from-env',
    },
  },
});
```

Or per-file with `vi.stubEnv`:

```ts
beforeEach(() => {
  vi.stubEnv('REVALIDATE_SECRET', 'secret-from-env');
});

afterEach(() => {
  vi.unstubAllEnvs();
});
```

**Picky cases:**
- Missing env var — does your code throw a useful error or fail mysteriously? (Add a `validateEnv()` step at boot, test it.)
- Empty string env var (`""`) — many libraries treat this as "set". Distinguish from absent.
- `NEXT_PUBLIC_` prefix accidentally on a secret — verify in CI with a script that scans for `NEXT_PUBLIC_*SECRET`, `NEXT_PUBLIC_*KEY`, etc.

---

## Cron Jobs

Vercel cron triggers a Route Handler on schedule. The endpoint must protect itself — it's just an HTTP handler, anyone can hit it.

```ts
// app/api/cron/cleanup/route.ts
export async function GET(req: Request) {
  // Vercel includes this header for cron-triggered invocations
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ ok: false }, { status: 401 });
  }

  await cleanupExpiredSessions();
  return Response.json({ ok: true });
}
```

Tests:

```ts
it('rejects unauthenticated cron requests', async () => {
  const res = await GET(new Request('http://test'));
  expect(res.status).toBe(401);
  expect(cleanupExpiredSessions).not.toHaveBeenCalled();
});

it('runs cleanup with the correct bearer token', async () => {
  vi.stubEnv('CRON_SECRET', 'cron-token');
  const res = await GET(new Request('http://test', {
    headers: { authorization: 'Bearer cron-token' },
  }));
  expect(res.status).toBe(200);
  expect(cleanupExpiredSessions).toHaveBeenCalled();
});

it('returns 500 if cleanup throws (so Vercel retries)', async () => {
  vi.stubEnv('CRON_SECRET', 'cron-token');
  vi.mocked(cleanupExpiredSessions).mockRejectedValue(new Error('db down'));
  const res = await GET(new Request('http://test', {
    headers: { authorization: 'Bearer cron-token' },
  }));
  expect(res.status).toBe(500);
});
```

**Picky cases:**
- Cron runs concurrently with itself if previous didn't finish — does the job have an idempotency lock?
- Cron timeout (Vercel limits — 10s on Hobby, longer on Pro). Long jobs need batching.
- Failure should retry; success should NOT (test the response semantics).

---

## OG Images (`@vercel/og`)

OG image routes are usually `runtime = 'edge'` and return a streaming `ImageResponse`. Hard to assert visually in unit tests; assert the metadata.

```ts
// app/og/route.tsx
import { ImageResponse } from 'next/og';
export const runtime = 'edge';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const title = url.searchParams.get('title') ?? 'Default';
  return new ImageResponse(
    (<div style={{ fontSize: 64 }}>{title}</div>),
    { width: 1200, height: 630 },
  );
}
```

```ts
it('returns a PNG with cache headers', async () => {
  const res = await GET(new Request('http://test/og?title=Hello'));
  expect(res.headers.get('content-type')).toMatch(/^image\/png/);
  expect(res.status).toBe(200);
});

it('truncates titles over 100 chars to prevent overflow', async () => {
  const long = 'A'.repeat(500);
  const res = await GET(new Request(`http://test/og?title=${encodeURIComponent(long)}`));
  expect(res.status).toBe(200); // doesn't crash
});

it('rejects/escapes script tags in the title', async () => {
  const res = await GET(new Request('http://test/og?title=<script>alert(1)</script>'));
  // The output is a raster image; the script can't execute.
  // But inspect: does your code log the raw title server-side without escaping?
  expect(res.status).toBe(200);
});
```

For visual regression on OG images, snapshot the binary output and compare with a tolerance. Most teams find this not worth the maintenance and rely on a manual review.

---

## `Cache-Control` Headers

Wrong cache headers cause real outages — users seeing other users' personalised pages. Test them.

```ts
it('sets no-store on per-user pages', async () => {
  const res = await GET(authenticatedRequest());
  expect(res.headers.get('cache-control')).toMatch(/no-store/);
});

it('sets s-maxage on public listings', async () => {
  const res = await GET(new Request('http://test/api/posts/public'));
  expect(res.headers.get('cache-control')).toMatch(/s-maxage=\d+/);
  expect(res.headers.get('cache-control')).toMatch(/stale-while-revalidate/);
});

it('does not cache the auth callback', async () => {
  const res = await GET(new Request('http://test/auth/callback?code=x'));
  expect(res.headers.get('cache-control')).toMatch(/no-store/);
});
```

The single most catastrophic Vercel bug: caching an authenticated page on the CDN. Every protected route handler should have an explicit `Cache-Control: private, no-store` test if the response is user-specific.

---

## Preview Deployment Concerns

Preview deployments use real services (real Supabase, real Stripe, real email). Tests can't catch this directly, but design choices around it can be verified:

- A `process.env.VERCEL_ENV === 'preview'` branch that swaps to test keys.
- Email sender restricted to the developer's domain in preview.
- Stripe in test mode in preview.

```ts
it('uses the test Stripe key on preview', () => {
  vi.stubEnv('VERCEL_ENV', 'preview');
  const config = getStripeConfig();
  expect(config.key).toMatch(/^sk_test_/);
});

it('uses the live Stripe key on production', () => {
  vi.stubEnv('VERCEL_ENV', 'production');
  const config = getStripeConfig();
  expect(config.key).toMatch(/^sk_live_/);
});
```

---

## Common Vercel test smells

| Smell                                                          | Why bad                                                  |
| -------------------------------------------------------------- | -------------------------------------------------------- |
| Testing a `runtime = 'edge'` handler with a Node-only mock     | False sense of security — won't actually fail in CI build |
| Mocking `revalidatePath` but not asserting it was called       | The whole point is the cache invalidation                |
| Assertions on `process.env.VERCEL_ENV` without `vi.stubEnv`    | Bleeds into other tests; flaky in parallel runs          |
| Testing rate-limit logic with one IP                           | The bug is usually around shared keys / spoofed headers  |
| Cron handler with no auth test                                 | Anyone can trigger your cleanup by hitting the URL       |
| OG image test that just asserts `res.status === 200`           | Misses crash-on-invalid-input; test edge inputs too      |
