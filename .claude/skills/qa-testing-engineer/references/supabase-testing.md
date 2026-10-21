# Supabase Testing Patterns

The Supabase JS client uses fluent chaining (`.from(...).select(...).eq(...).single()`), which makes naive mocking painful. This file covers the patterns that scale: a chainable mock factory, auth flow tests, RLS testing strategies, and the trap of testing only with the service role key.

---

## The chainable-mock problem

A typical query:

```ts
const { data, error } = await supabase
  .from('posts')
  .select('id, title, author:profiles(name)')
  .eq('published', true)
  .order('created_at', { ascending: false })
  .limit(10);
```

If you mock with `vi.fn().mockResolvedValue(...)`, you get `TypeError: supabase.from(...).select is not a function` — because `from()` doesn't return the mock, it returns `undefined`.

You have three options, ranked by maintenance cost (lowest first):

1. **Extract a thin data-access layer**, mock that. Best long-term answer.
2. **Use `@supabase/supabase-js` against a local Supabase** (fastest, most realistic).
3. **Build a chainable mock**.

---

## Pattern 1: Extract a data-access layer (preferred)

```ts
// lib/posts.ts
export async function getPublishedPosts(limit = 10) {
  const { data, error } = await supabase
    .from('posts')
    .select('id, title, author:profiles(name)')
    .eq('published', true)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}
```

Now your tests mock `getPublishedPosts`, not the Supabase client. The chained query is integration-tested **once** against a real database; everything else uses the simple function mock.

```ts
// in component test
vi.mock('@/lib/posts');
import { getPublishedPosts } from '@/lib/posts';

it('renders posts', async () => {
  vi.mocked(getPublishedPosts).mockResolvedValue([
    { id: '1', title: 'Hello', author: { name: 'Alice' } },
  ]);
  render(<PostsList />);
  expect(await screen.findByText('Hello')).toBeInTheDocument();
});
```

This is the pattern that scales. Over-mocking the Supabase client deep in component tests creates a maintenance tax that grows with every query.

---

## Pattern 2: Local Supabase for integration tests

Run Supabase locally with the CLI:

```bash
supabase start                    # spins up Postgres + Auth + Storage on local ports
supabase db reset                 # rebuild schema from migrations
```

Configure your test client:

```ts
// test/supabase-test.ts
import { createClient } from '@supabase/supabase-js';

export const testSupabase = createClient(
  'http://127.0.0.1:54321',
  process.env.SUPABASE_LOCAL_ANON_KEY!,         // for client-perspective tests
);

export const testSupabaseAdmin = createClient(
  'http://127.0.0.1:54321',
  process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY!, // for setup/teardown that bypasses RLS
);
```

Reset state between tests:

```ts
beforeEach(async () => {
  await testSupabaseAdmin.from('posts').delete().neq('id', '00000000-0000-0000-0000-000000000000');
});
```

**Critical**: write tests that use the **anon** key (or a signed-in user), not just the service role. Service role bypasses RLS — if all your tests use it, you're not testing RLS at all (the most common Supabase security mistake).

---

## Pattern 3: A reusable chainable mock

When you really must mock the client (e.g., in CI without local Supabase, or in fast unit tests), this factory handles arbitrary chains:

```ts
// test/mock-supabase.ts
import { vi } from 'vitest';

type ChainResult = { data: unknown; error: unknown };

/**
 * Build a chainable Supabase mock. Configure responses with `setResult`.
 *
 * Every chained method returns the same proxy. Terminal awaits resolve to
 * the most recently set result. Reset between tests.
 */
export function makeSupabaseMock() {
  let nextResult: ChainResult = { data: null, error: null };
  const calls: { method: string; args: unknown[] }[] = [];

  const handler: ProxyHandler<any> = {
    get(_, prop: string) {
      if (prop === 'then') {
        // Awaited — resolve with the configured result
        return (resolve: (v: ChainResult) => void) => resolve(nextResult);
      }
      return (...args: unknown[]) => {
        calls.push({ method: prop, args });
        return proxy;
      };
    },
  };

  const proxy: any = new Proxy({}, handler);

  return {
    client: { from: () => proxy, rpc: () => proxy, auth: makeAuthMock(), storage: makeStorageMock() },
    setResult: (r: ChainResult) => { nextResult = r; },
    calls,
    reset: () => { calls.length = 0; nextResult = { data: null, error: null }; },
  };
}

function makeAuthMock() {
  return {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signInWithPassword: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    onAuthStateChange: vi.fn().mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    }),
  };
}

function makeStorageMock() {
  const bucket = {
    upload: vi.fn().mockResolvedValue({ data: { path: 'test/file' }, error: null }),
    download: vi.fn(),
    remove: vi.fn(),
    getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: 'http://test/file' } }),
  };
  return { from: () => bucket };
}
```

Use it:

```ts
import { makeSupabaseMock } from '@/test/mock-supabase';

const supa = makeSupabaseMock();
vi.mock('@/lib/supabase', () => ({ supabase: supa.client }));

import { getPublishedPosts } from './posts';

beforeEach(() => supa.reset());

it('queries the posts table with the right filters', async () => {
  supa.setResult({ data: [{ id: '1', title: 'Hi' }], error: null });

  const result = await getPublishedPosts(5);

  expect(result).toEqual([{ id: '1', title: 'Hi' }]);
  // Verify the chain was built correctly
  const methods = supa.calls.map((c) => c.method);
  expect(methods).toEqual(['select', 'eq', 'order', 'limit']);
  expect(supa.calls.find((c) => c.method === 'limit')?.args).toEqual([5]);
});

it('returns [] when data is null', async () => {
  supa.setResult({ data: null, error: null });
  expect(await getPublishedPosts()).toEqual([]);
});

it('throws when the query errors', async () => {
  supa.setResult({ data: null, error: { message: 'connection refused' } });
  await expect(getPublishedPosts()).rejects.toMatchObject({ message: 'connection refused' });
});
```

The factory is fragile if your code calls something it doesn't recognise (e.g., `.maybeSingle()` — handled by the proxy, but new methods need testing). Treat it as a stop-gap and graduate to local Supabase for anything multi-table.

---

## Testing the SSR client

`@supabase/ssr` provides `createServerClient` for Route Handlers, Server Actions, and middleware. It needs a cookie store.

```ts
// lib/supabase-server.ts
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function getServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    },
  );
}
```

In tests, mock `next/headers`:

```ts
const cookieStore = new Map<string, { value: string }>();

vi.mock('next/headers', () => ({
  cookies: async () => ({
    getAll: () => Array.from(cookieStore, ([name, { value }]) => ({ name, value })),
    set: (name: string, value: string) => cookieStore.set(name, { value }),
    get: (name: string) => cookieStore.get(name),
  }),
}));

beforeEach(() => cookieStore.clear());
```

---

## Testing Auth Flows

Auth is where bugs hurt most. Tests should cover:

### `signUp`

```ts
it('creates a new user with the right metadata', async () => {
  vi.mocked(supabase.auth.signUp).mockResolvedValue({
    data: { user: { id: 'u1', email: 'a@b.com' } as any, session: null },
    error: null,
  });

  const result = await signUpUser({ email: 'a@b.com', password: 'longenough123', name: 'Alice' });

  expect(supabase.auth.signUp).toHaveBeenCalledWith({
    email: 'a@b.com',
    password: 'longenough123',
    options: { data: { name: 'Alice' } },
  });
  expect(result.user?.id).toBe('u1');
});

it('rejects passwords under 8 characters before calling Supabase', async () => {
  await expect(signUpUser({ email: 'a@b.com', password: 'short', name: 'A' }))
    .rejects.toThrow(/at least 8/);
  expect(supabase.auth.signUp).not.toHaveBeenCalled();
});

it('surfaces "User already registered" cleanly', async () => {
  vi.mocked(supabase.auth.signUp).mockResolvedValue({
    data: { user: null, session: null },
    error: { message: 'User already registered', status: 400 } as any,
  });
  await expect(signUpUser({ email: 'a@b.com', password: 'longenough', name: 'A' }))
    .rejects.toThrow(/already registered/i);
});
```

**Picky cases:**
- Email casing — Supabase lowercases, but does your UI? (User signs up as `Alice@x.com`, signs in as `alice@x.com` — should work.)
- Trailing whitespace in email.
- Empty password.
- Password over the bcrypt 72-byte limit (Supabase silently truncates — security smell).
- Email confirmation required vs. not (`session` is `null` until confirmed).

### `signInWithPassword`

```ts
it('rejects invalid credentials with a generic error', async () => {
  vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
    data: { user: null, session: null },
    error: { message: 'Invalid login credentials', status: 400 } as any,
  });
  // Test that we don't leak whether the email exists
  await expect(signIn({ email: 'a@b.com', password: 'wrong' }))
    .rejects.toThrow(/invalid credentials/i); // not "user not found"
});
```

**Critical security test**: the error message for "wrong password" must equal the error for "user doesn't exist". If they differ, you have user enumeration. Most auth systems get this right out of the box, but custom wrappers often break it.

### OAuth callback

```ts
it('exchanges the code for a session', async () => {
  vi.mocked(supabase.auth.exchangeCodeForSession).mockResolvedValue({
    data: { session: { access_token: 'tok' } as any, user: null },
    error: null,
  });

  const url = new URL('http://test/auth/callback?code=abc&next=/dashboard');
  const res = await GET(new Request(url));

  expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith('abc');
  expect(res.headers.get('location')).toBe('http://test/dashboard');
});

it('refuses an open-redirect via ?next=', async () => {
  const url = new URL('http://test/auth/callback?code=abc&next=https://evil.com');
  const res = await GET(new Request(url));
  // Should redirect to a safe default, NOT evil.com
  expect(res.headers.get('location')).toMatch(/^http:\/\/test\//);
});

it('refuses a protocol-relative ?next=//evil.com', async () => {
  const url = new URL('http://test/auth/callback?code=abc&next=//evil.com');
  const res = await GET(new Request(url));
  expect(res.headers.get('location')).not.toContain('evil.com');
});
```

The OAuth callback's `next` parameter is the most-missed open-redirect vector in Next.js apps. Always test it explicitly.

### Session refresh

```ts
it('refreshes the session when the token is expired', async () => {
  vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
    data: { session: { access_token: 'new', refresh_token: 'r2' } as any, user: null },
    error: null,
  });

  await ensureFreshSession({ access_token: 'old', expires_at: 1 } as any);
  expect(supabase.auth.refreshSession).toHaveBeenCalled();
});

it('treats refresh failure as a logout', async () => {
  vi.mocked(supabase.auth.refreshSession).mockResolvedValue({
    data: { session: null, user: null },
    error: { message: 'Invalid refresh token' } as any,
  });
  const result = await ensureFreshSession({ access_token: 'old', expires_at: 1 } as any);
  expect(result.session).toBeNull(); // log the user out
});
```

---

## Testing RLS Policies

RLS is the security boundary. **Test it as such** — assume any unauthorized client query is a known attack and the policy must reject it.

### Approach A: pgTAP (in-database tests)

`pgTAP` runs SQL assertions directly on Postgres. Most thorough, slowest setup.

```sql
-- supabase/tests/posts_rls.sql
BEGIN;
SELECT plan(4);

-- Setup: two users, two posts
INSERT INTO auth.users (id, email) VALUES
  ('11111111-1111-1111-1111-111111111111', 'a@x.com'),
  ('22222222-2222-2222-2222-222222222222', 'b@x.com');

INSERT INTO public.posts (id, author_id, title) VALUES
  ('aaaa1111-...', '11111111-...', 'Alice''s post'),
  ('bbbb2222-...', '22222222-...', 'Bob''s post');

-- Run queries as Alice
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';
SET LOCAL ROLE authenticated;

SELECT results_eq(
  $$ SELECT count(*) FROM public.posts $$,
  $$ VALUES (1::bigint) $$,
  'Alice sees only her post'
);

SELECT throws_ok(
  $$ UPDATE public.posts SET title='hacked' WHERE author_id != auth.uid() $$,
  NULL,
  NULL,
  'Alice cannot update Bob''s post'
);

SELECT * FROM finish();
ROLLBACK;
```

Run with `supabase test db`.

### Approach B: from JS, using the anon client + signed-in users

Fast feedback loop, runs in your normal test suite, but easier to forget edge cases.

```ts
import { createClient } from '@supabase/supabase-js';

async function clientAs(email: string, password: string) {
  const c = createClient(URL, ANON_KEY);
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return c;
}

it('Alice cannot read Bobs posts (RLS)', async () => {
  const alice = await clientAs('alice@test', 'pw');
  const { data } = await alice.from('posts').select('*').eq('author_id', BOB_ID);
  expect(data).toEqual([]); // RLS filters silently — empty array, not error
});

it('Alice cannot update Bobs post (RLS)', async () => {
  const alice = await clientAs('alice@test', 'pw');
  const { data, error } = await alice
    .from('posts')
    .update({ title: 'hacked' })
    .eq('author_id', BOB_ID)
    .select();

  expect(data).toEqual([]); // no rows updated
  expect(error).toBeNull(); // RLS doesn't error, it filters — this is the gotcha
});

it('Alice cannot insert a post with author_id = Bob (RLS)', async () => {
  const alice = await clientAs('alice@test', 'pw');
  const { error } = await alice.from('posts').insert({ author_id: BOB_ID, title: 'spoof' });
  expect(error).not.toBeNull(); // INSERT violations error, unlike SELECT/UPDATE
});
```

**The single most common RLS bug**: a policy on `SELECT` but not on `UPDATE` or `DELETE`. Test all four (SELECT, INSERT, UPDATE, DELETE) for every protected table.

**The second most common RLS bug**: a `USING` clause without a matching `WITH CHECK` clause. `USING` controls what rows the user can *read/affect*; `WITH CHECK` controls what the new row values must satisfy. Without `WITH CHECK`, a user can update a row to set `author_id` to someone else.

```sql
-- Bad: a user can change author_id to anyone
CREATE POLICY x ON posts FOR UPDATE
  USING (author_id = auth.uid());

-- Good: user can only update their own posts AND can't reassign authorship
CREATE POLICY x ON posts FOR UPDATE
  USING (author_id = auth.uid())
  WITH CHECK (author_id = auth.uid());
```

Test for this:

```ts
it('Alice cannot reassign her post to Bob (WITH CHECK)', async () => {
  const alice = await clientAs('alice@test', 'pw');
  const { error } = await alice
    .from('posts')
    .update({ author_id: BOB_ID })
    .eq('id', ALICE_POST_ID);
  expect(error).not.toBeNull(); // WITH CHECK should reject
});
```

---

## Realtime testing

Realtime channels are best E2E-tested. For unit tests, mock the subscription:

```ts
const subscribers: Array<(payload: any) => void> = [];

const realtimeMock = {
  channel: vi.fn().mockReturnValue({
    on: vi.fn().mockImplementation((_evt, _filter, cb) => {
      subscribers.push(cb);
      return realtimeMock.channel();
    }),
    subscribe: vi.fn().mockReturnValue({ unsubscribe: vi.fn() }),
  }),
};

it('updates the UI when a new row arrives', async () => {
  render(<PostsRealtime />);

  // Simulate a Supabase realtime event
  act(() => subscribers[0]({ new: { id: '1', title: 'Live!' } }));

  expect(await screen.findByText('Live!')).toBeInTheDocument();
});
```

Verify subscriptions are cleaned up on unmount — leaked subscriptions are a common production bug.

---

## Storage testing

Mock at the bucket level:

```ts
it('uploads with the right path', async () => {
  vi.mocked(supabase.storage.from('avatars').upload)
    .mockResolvedValue({ data: { path: 'u1/avatar.png' }, error: null });

  await uploadAvatar('u1', new File([new Uint8Array(10)], 'avatar.png', { type: 'image/png' }));

  expect(supabase.storage.from('avatars').upload).toHaveBeenCalledWith(
    'u1/avatar.png',
    expect.any(File),
    expect.objectContaining({ contentType: 'image/png', upsert: true }),
  );
});
```

**Picky cases:**
- File over the bucket's max size (Supabase returns a specific error).
- Wrong MIME type (server validates `Content-Type`).
- Filename containing path separators (`../../etc/passwd`) — should be rejected client-side AND server-side.
- Non-ASCII filename (Unicode normalization issues with S3).
- Empty file (`new File([], 'x.png')`).

---

## Common Supabase test smells

| Smell                                                       | Why bad                                                     |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| All RLS tests use the service role key                      | RLS not actually being tested                               |
| Mocking `.from('x')` to return data without filters         | Filter logic untested; query rewrites silently break        |
| `expect(error).toBeNull()` after an UPDATE without `.select()` | RLS-filtered updates return `data: []` and `error: null`. You think it succeeded. |
| Stubbing `auth.getUser` to return a user without an email   | Most code paths don't care — but password reset and OAuth do |
| Not testing the email-confirmation flow                     | Users land on the app with `session: null` and you crash    |
| Testing only happy-path auth                                | The whole point is the unhappy paths                        |
