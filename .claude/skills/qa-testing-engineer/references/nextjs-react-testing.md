# Next.js & React: Testing Patterns

Next.js App Router introduces multiple boundaries (Server Components, Client Components, Server Actions, Route Handlers, middleware) that each demand a different testing approach. This file covers each, plus React-specific patterns (hooks, suspense, error boundaries, hydration).

---

## Quick map: what to test where

| Code lives in...                              | Best testing approach                              |
| --------------------------------------------- | -------------------------------------------------- |
| `'use client'` component                      | RTL `render` + `userEvent` + MSW                   |
| Server Component                              | Pure Node test of returned JSX, or E2E             |
| Server Action (`'use server'`)                | Direct unit test (it's just an async function)     |
| Route Handler (`app/api/.../route.ts`)        | Construct a `Request`, call the exported function  |
| `middleware.ts`                               | Construct a `NextRequest`, call `middleware()`     |
| Custom hook                                   | `renderHook` from `@testing-library/react`         |
| Full user flow across pages                   | Playwright E2E                                     |

The pattern: **find the function boundary and call it directly**. Most of Next.js's "magic" is invocation; the code itself is plain functions you can test.

---

## Mocking `next/navigation`

Almost any Client Component test needs this. Without it, calling `useRouter`, `usePathname`, or `useSearchParams` throws.

```ts
// vitest.setup.ts (or jest.setup.ts)
import { vi } from 'vitest';

const push = vi.fn();
const replace = vi.fn();
const back = vi.fn();
const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace, back, refresh, prefetch: vi.fn(), forward: vi.fn() }),
  usePathname: () => '/test',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
  redirect: vi.fn(),
  notFound: vi.fn(),
}));

// Export so individual tests can assert / override
export const navMocks = { push, replace, back, refresh };
```

Per-test override:

```ts
import { navMocks } from '@/test/setup';

it('redirects to /login on missing session', async () => {
  render(<ProtectedPage />);
  await waitFor(() => {
    expect(navMocks.push).toHaveBeenCalledWith('/login');
  });
});

beforeEach(() => {
  vi.clearAllMocks(); // critical — these mocks are module-scoped
});
```

For dynamic mocking of `useSearchParams`:

```ts
const searchParams = vi.hoisted(() => new Map<string, string>());

vi.mock('next/navigation', async (orig) => ({
  ...(await orig<typeof import('next/navigation')>()),
  useSearchParams: () => ({
    get: (key: string) => searchParams.get(key) ?? null,
    has: (key: string) => searchParams.has(key),
    toString: () => Array.from(searchParams).map(([k, v]) => `${k}=${v}`).join('&'),
  }),
}));

beforeEach(() => searchParams.clear());

it('reads ?q from the URL', () => {
  searchParams.set('q', 'hello');
  render(<Search />);
  expect(screen.getByRole('searchbox')).toHaveValue('hello');
});
```

---

## Mocking `next/image` and `next/link`

`next/link` works in tests but warns about prefetching. `next/image` works in tests but the optimizer pipeline isn't worth simulating.

Simple replacements:

```ts
vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('next/image', () => ({
  default: ({ src, alt, ...props }: any) => <img src={src} alt={alt} {...props} />,
}));
```

These are pragmatic — they test the user-visible attributes (href, src, alt) without dragging in Next's whole optimization layer.

---

## Testing Custom Hooks

Use `renderHook` for hooks with non-trivial logic. For hooks tightly coupled to one component, just test the component.

```ts
import { renderHook, act, waitFor } from '@testing-library/react';
import { useDebounce } from './useDebounce';

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 500));
    expect(result.current).toBe('hello');
  });

  it('returns the updated value after the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'a' } },
    );

    rerender({ value: 'b' });
    expect(result.current).toBe('a'); // not yet

    act(() => { vi.advanceTimersByTime(500); });
    expect(result.current).toBe('b');
  });

  it('cancels pending updates on unmount', () => {
    const { rerender, unmount } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'a' } },
    );
    rerender({ value: 'b' });
    unmount();
    // No error, no setState-after-unmount warning
    act(() => { vi.advanceTimersByTime(500); });
  });
});
```

**Edge cases for any hook:**
- Initial render — does it crash?
- Re-render with same props — stable identity for returned objects?
- Re-render with new props — does it react correctly?
- Unmount mid-flight (for async hooks) — no warnings?
- Strict mode double-invocation — does the hook handle being called twice?

---

## Testing Server Actions

Server Actions are async functions with `'use server'`. They're testable directly — no Next.js runtime needed for the logic itself.

```ts
// app/actions/createPost.ts
'use server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const schema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10_000),
});

export async function createPost(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error('Unauthorized');

  const parsed = schema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
  });
  if (!parsed.success) return { error: parsed.error.flatten() };

  const post = await db.posts.create({ ...parsed.data, authorId: session.user.id });
  revalidatePath('/posts');
  return { post };
}
```

```ts
// app/actions/createPost.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth');
vi.mock('@/lib/db');
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { createPost } from './createPost';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { revalidatePath } from 'next/cache';

const formData = (entries: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.append(k, v);
  return fd;
};

describe('createPost', () => {
  beforeEach(() => vi.clearAllMocks());

  it('throws Unauthorized when there is no session', async () => {
    vi.mocked(auth).mockResolvedValue(null);
    await expect(createPost(formData({ title: 'Hi', body: 'Body' })))
      .rejects.toThrow('Unauthorized');
  });

  it('returns validation errors for short title', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    const result = await createPost(formData({ title: '', body: 'ok' }));
    expect(result.error?.fieldErrors.title).toBeDefined();
    expect(db.posts.create).not.toHaveBeenCalled();
  });

  it('rejects body over 10k characters', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    const result = await createPost(formData({ title: 'ok', body: 'x'.repeat(10_001) }));
    expect(result.error?.fieldErrors.body).toBeDefined();
  });

  it('creates the post with the session user as author', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(db.posts.create).mockResolvedValue({ id: 'p1' } as any);

    await createPost(formData({ title: 'Hi', body: 'Body' }));

    expect(db.posts.create).toHaveBeenCalledWith({
      title: 'Hi',
      body: 'Body',
      authorId: 'u1', // critical: don't trust authorId from input
    });
  });

  it('revalidates /posts after creation', async () => {
    vi.mocked(auth).mockResolvedValue({ user: { id: 'u1' } } as any);
    vi.mocked(db.posts.create).mockResolvedValue({ id: 'p1' } as any);

    await createPost(formData({ title: 'Hi', body: 'Body' }));

    expect(revalidatePath).toHaveBeenCalledWith('/posts');
  });
});
```

**Picky edge cases for every Server Action:**
1. **Unauthenticated**: does it reject?
2. **Authorization mismatch**: user A acting on user B's resource — does the action check ownership?
3. **`authorId`/`userId` from input**: a Server Action is just an HTTP endpoint. If it accepts an `authorId` from `formData`, an attacker can spoof it. Always derive from session.
4. **Validation**: every Zod (or other) edge case — empty, too long, wrong type, missing fields.
5. **Side-effect ordering**: if the DB write fails, are downstream calls (email, revalidate) skipped?
6. **`revalidatePath` / `revalidateTag`**: tested? It's the difference between users seeing stale content or fresh content.

---

## Testing Route Handlers

Route Handlers export named functions (`GET`, `POST`, etc.) that take a `Request` and return a `Response`. Testable as plain functions.

```ts
// app/api/users/[id]/route.ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const user = await db.users.findById(params.id);
  if (!user) return Response.json({ error: 'Not found' }, { status: 404 });
  return Response.json(user);
}
```

```ts
// app/api/users/[id]/route.test.ts
import { GET } from './route';

it('returns the user when found', async () => {
  vi.mocked(db.users.findById).mockResolvedValue({ id: '1', name: 'Alice' });

  const res = await GET(new Request('http://test/api/users/1'), { params: { id: '1' } });

  expect(res.status).toBe(200);
  expect(await res.json()).toEqual({ id: '1', name: 'Alice' });
});

it('returns 404 when missing', async () => {
  vi.mocked(db.users.findById).mockResolvedValue(null);

  const res = await GET(new Request('http://test/api/users/ghost'), { params: { id: 'ghost' } });

  expect(res.status).toBe(404);
  expect(await res.json()).toEqual({ error: 'Not found' });
});
```

**Picky edge cases for any Route Handler:**
- Method not allowed (no `POST` exported → `405`).
- Invalid `params` (`/users/`, `/users/null`, `/users/../admin`).
- Query string injection (`?id=1' OR '1'='1`).
- Unauthenticated request when auth is required (`401`).
- Rate-limited request (`429`).
- Body too large (`413` if you enforce one).
- `Content-Type: application/json` with malformed JSON.
- Header injection / smuggling via user-controlled headers.
- CORS preflight if the route is cross-origin.

---

## Testing Middleware

Middleware runs on every request. Mistakes here are blast-radius bugs (everyone can't log in, every page leaks data). Test thoroughly.

```ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';
import { verifySession } from '@/lib/auth';

export async function middleware(req: NextRequest) {
  const token = req.cookies.get('session')?.value;

  if (req.nextUrl.pathname.startsWith('/dashboard')) {
    if (!token) return NextResponse.redirect(new URL('/login', req.url));

    const session = await verifySession(token);
    if (!session) {
      const res = NextResponse.redirect(new URL('/login', req.url));
      res.cookies.delete('session');
      return res;
    }
  }
  return NextResponse.next();
}
```

```ts
// middleware.test.ts
import { NextRequest } from 'next/server';
import { middleware } from './middleware';
import { verifySession } from '@/lib/auth';

vi.mock('@/lib/auth');

const makeReq = (path: string, cookies: Record<string, string> = {}) => {
  const url = `http://localhost${path}`;
  const req = new NextRequest(url);
  for (const [k, v] of Object.entries(cookies)) req.cookies.set(k, v);
  return req;
};

describe('middleware', () => {
  it('passes through public routes', async () => {
    const res = await middleware(makeReq('/'));
    expect(res.status).toBe(200);
    expect(res.headers.get('location')).toBeNull();
  });

  it('redirects unauthenticated /dashboard requests to /login', async () => {
    const res = await middleware(makeReq('/dashboard'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login');
  });

  it('clears the session cookie when token is invalid', async () => {
    vi.mocked(verifySession).mockResolvedValue(null);
    const res = await middleware(makeReq('/dashboard', { session: 'tampered' }));
    expect(res.headers.get('location')).toBe('http://localhost/login');
    // NextResponse cookie deletion sets a Max-Age=0 cookie
    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toMatch(/session=;.*Max-Age=0/);
  });

  it('passes through with a valid session', async () => {
    vi.mocked(verifySession).mockResolvedValue({ userId: 'u1' });
    const res = await middleware(makeReq('/dashboard', { session: 'good' }));
    expect(res.headers.get('location')).toBeNull();
  });
});
```

**Edge cases for middleware:**
- Empty cookie value (`session=`).
- Cookie present but JWT signature invalid.
- Cookie present but JWT expired.
- `Authorization` header injection.
- Path traversal: `/dashboard%2F..%2Fadmin`, `/dashboard/../admin`, double-encoded.
- Trailing slash variations: `/dashboard`, `/dashboard/`, `/Dashboard` (case).
- Query string preservation in the redirect (`?next=/dashboard/x`).
- Subroute matching: `/dashboard-public` should NOT match `/dashboard/*`.

---

## Testing Server Components

Server Components are async functions returning JSX. The picky truth: they're hard to unit-test, because RTL doesn't handle async components and Next's RSC payload generator runs in a separate process.

Three pragmatic options, in order of preference:

1. **Extract logic, leave the JSX thin.** Test the data-fetching / transformation as plain functions. The component just renders props. This is by far the most maintainable.

2. **Render-as-a-function** for simple cases:
   ```ts
   it('renders the user name', async () => {
     const ui = await UserCard({ id: '1' });
     render(ui as React.ReactElement);
     expect(screen.getByText('Alice')).toBeInTheDocument();
   });
   ```
   This works for top-level Server Components without nested async children. Falls apart with nested async.

3. **Playwright** for anything non-trivial. RSC streaming, suspense, nested async — these are all easier to verify by visiting the page.

**Tell-tale sign you're doing it wrong**: large amounts of mocking just to make a Server Component "renderable" in a test. Move the logic out.

---

## Testing Suspense and Error Boundaries

```ts
// Suspense
it('shows the fallback while loading', () => {
  render(
    <Suspense fallback={<div>Loading...</div>}>
      <SlowComponent />
    </Suspense>,
  );
  expect(screen.getByText('Loading...')).toBeInTheDocument();
});

it('shows the content once resolved', async () => {
  render(
    <Suspense fallback={<div>Loading...</div>}>
      <SlowComponent />
    </Suspense>,
  );
  expect(await screen.findByText('Done!')).toBeInTheDocument();
});

// Error boundary — silence the React noisy console.error during the test
it('shows the error UI when the child throws', () => {
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

  const Bomb = () => { throw new Error('boom'); };
  render(
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <Bomb />
    </ErrorBoundary>,
  );

  expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  errorSpy.mockRestore();
});
```

---

## Hydration Mismatches

You don't usually unit-test hydration directly — you catch it via E2E or by reading the dev console. But you **can** prevent it by testing that components which render different content on client vs. server do so deliberately:

```ts
// A common bug: rendering Date.now() in a component renders different output
// on the server (page build) vs. client (hydration) → hydration warning.

it('renders a stable timestamp at hydration', () => {
  const fixed = new Date('2025-01-15T12:00:00Z').toISOString();
  vi.setSystemTime(new Date(fixed));
  render(<RecentActivity />);
  expect(screen.getByText(fixed)).toBeInTheDocument();
});
```

If a component intentionally differs between server and client (e.g., hide-until-mounted for `localStorage`), wrap it in `useEffect` + `useState(false)` and assert the *post-mount* state in tests. Pre-mount assertion is fragile and reflects an implementation detail.

---

## React Query / SWR / Tanstack Query

Common gotcha: tests time out because React Query retries failed fetches three times.

```ts
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false, gcTime: 0 },     // Tanstack v5 (cacheTime → gcTime)
    mutations: { retry: false },
  },
});
```

Always pass `retry: false` and `gcTime: 0` (or `cacheTime: 0` for v4) so cached data doesn't leak between tests.

---

## Common Smells in Next.js Tests

| Smell                                                          | Why it's a problem                                                |
| -------------------------------------------------------------- | ----------------------------------------------------------------- |
| Mocking `next/cache` and forgetting `revalidatePath` calls     | The cache invalidation isn't asserted; users see stale data       |
| Over-mocking `next/navigation` per-test                        | Centralize in setup; per-test only when behaviour differs         |
| Testing Server Components by manually constructing RSC payload | You're testing Next, not your code. Move logic out instead.       |
| Asserting on cookie names with `getCookies()` regex            | Use `req.cookies.get('name')` from `NextRequest`'s real API        |
| `toMatchSnapshot()` on entire pages                            | Snapshot rot. Assert specific user-visible behaviour.             |
| Not clearing module mocks between tests                        | State leaks; flaky failures depend on test order                  |
