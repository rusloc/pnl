# Next.js Deep Dive (App Router)

The deep reference for Next.js 14+ App Router. Read the relevant section based on what the task involves. This file deliberately covers **patterns + pitfalls** — what to do, and why each common mistake fails.

## Table of Contents

1. [App Router file conventions](#1-app-router-file-conventions)
2. [Routing patterns](#2-routing-patterns)
3. [Rendering Model](#3-rendering-model)
4. [Data Fetching in Server Components](#4-data-fetching-in-server-components)
5. [The Four Caches](#5-the-four-caches)
6. [Server Actions](#6-server-actions)
7. [Route Handlers](#7-route-handlers)
8. [Middleware (auth, redirects, headers)](#8-middleware-auth-redirects-headers)
9. [Mutations & revalidation patterns](#9-mutations--revalidation-patterns)
10. [Security & token handling](#10-security--token-handling)
11. [Vercel deployment](#11-vercel-deployment)
12. [Common Next.js mistakes](#12-common-nextjs-mistakes)

---

## 1. App Router file conventions

The router is **filesystem-based**. Each special file inside `app/` has a defined role. Knowing them cold prevents 80% of "why isn't this working" bugs.

| File | Role | Server or Client? |
|---|---|---|
| `page.tsx` | Renders the route's UI. Public, indexable. | Server by default |
| `layout.tsx` | Wraps children. Persists across navigation (state preserved). Cannot read `searchParams`. | Server by default |
| `template.tsx` | Like layout but re-mounts on each navigation. Use sparingly. | Server by default |
| `loading.tsx` | Shown while a Server Component segment is fetching. Wraps children in Suspense. | Server |
| `error.tsx` | Catches errors thrown in the segment. **Must be `'use client'`.** | Client (required) |
| `global-error.tsx` | Catches errors in the root layout. Replaces `<html>` and `<body>`. | Client (required) |
| `not-found.tsx` | Renders when `notFound()` is called or for unmatched routes. | Server |
| `route.ts` | Route Handler (HTTP endpoint). Mutually exclusive with `page.tsx` in the same folder. | Server |
| `default.tsx` | Fallback for unmatched parallel route slots. | Server |
| `middleware.ts` | Runs before request hits the route. Edge runtime. **Lives at the project root, NOT in `app/`.** | Edge |

**Folder modifiers:**

- `(group)` — route group, doesn't affect the URL (used to share a layout among siblings).
- `[param]` — dynamic segment.
- `[...slug]` — catch-all.
- `[[...slug]]` — optional catch-all (matches the parent route too).
- `@slot` — parallel route slot.
- `(.)`, `(..)`, `(...)folder` — intercepting routes.
- `_folder` — private folder, never routed (use for colocation).

---

## 2. Routing patterns

### 2.1 Dynamic segments

```
app/
├── blog/
│   └── [slug]/
│       └── page.tsx        // /blog/anything
└── shop/
    └── [...categories]/
        └── page.tsx        // /shop/a, /shop/a/b, /shop/a/b/c
```

```ts
// app/blog/[slug]/page.tsx
type Props = { params: Promise<{ slug: string }> };

export default async function BlogPage({ params }: Props) {
  const { slug } = await params;       // params is async in Next 15+
  return <Article slug={slug} />;
}
```

**Important**: in Next.js 15+, `params` and `searchParams` are **Promises**. Always `await` them.

### 2.2 `generateStaticParams` for static-at-build dynamic routes

```ts
// app/blog/[slug]/page.tsx
export async function generateStaticParams() {
  const posts = await fetchAllSlugs();
  return posts.map(p => ({ slug: p.slug }));
}

// Combined with `dynamicParams = false` to 404 anything not pre-generated
export const dynamicParams = false;
```

The page becomes pre-rendered HTML at build time. Combine with ISR (`revalidate`) for content that changes after build.

### 2.3 Route groups (no URL impact, shared layout)

```
app/
├── (marketing)/
│   ├── layout.tsx          // landing layout
│   ├── page.tsx            // /
│   ├── about/page.tsx      // /about
│   └── pricing/page.tsx    // /pricing
└── (app)/
    ├── layout.tsx          // dashboard layout (auth-protected)
    ├── dashboard/page.tsx  // /dashboard
    └── settings/page.tsx   // /settings
```

Use to apply different layouts (and different auth boundaries) to sibling routes without affecting URLs.

### 2.4 Parallel routes (slots)

```
app/dashboard/
├── @analytics/page.tsx
├── @team/page.tsx
├── @notifications/default.tsx
├── layout.tsx
└── page.tsx
```

```tsx
// app/dashboard/layout.tsx
export default function Layout({
  children,
  analytics,
  team,
  notifications,
}: {
  children: React.ReactNode;
  analytics: React.ReactNode;
  team: React.ReactNode;
  notifications: React.ReactNode;
}) {
  return (
    <>
      {children}
      <aside>{analytics}{team}{notifications}</aside>
    </>
  );
}
```

Each slot can have its own loading/error boundary — independent streaming. Pair with **intercepting routes** to render modal-over-page navigation that's still URL-shareable.

### 2.5 Intercepting routes (modals via URL)

```
app/
├── feed/page.tsx
├── photo/[id]/page.tsx                  // full page at /photo/123
└── feed/
    └── @modal/(.)photo/[id]/page.tsx    // modal version when navigating from /feed
```

Click a photo on the feed → modal opens, URL updates to `/photo/123`. Refresh the page → full standalone view at `/photo/123`. Best feature of the App Router that nobody knows exists.

### 2.6 Linking & navigation

```tsx
import Link from 'next/link';
import { useRouter } from 'next/navigation';   // App Router — NOT 'next/router'

// Declarative navigation
<Link href="/dashboard" prefetch>Dashboard</Link>

// Programmatic
'use client';
const router = useRouter();
router.push('/dashboard');
router.replace('/login');     // no history entry
router.back();
router.refresh();             // re-fetch Server Components for current route, no full reload
```

**Common mistake**: importing `useRouter` from `next/router` (Pages Router). The App Router import is `next/navigation`.

### 2.7 `searchParams` is dynamic

Reading `searchParams` in a `page.tsx` opts the route into dynamic rendering. If you only need search params for a small interactive bit, isolate it in a Client Component using `useSearchParams()` so the rest of the page stays static.

---

## 3. Rendering Model

### 3.1 Server Components vs. Client Components

**Server Components (default):**
- Run on the server. Never ship JS to the client.
- Can be `async` — `await` data, `await` `cookies()`, `await` DB calls directly.
- Cannot use state, effects, refs, or browser APIs.
- Cannot use event handlers (`onClick`, etc.).
- Can import server-only code (DB drivers, API keys, file system).

**Client Components (`'use client'` at top of file):**
- Hydrated on the client. Ship JS bundle.
- Use state, effects, refs, browser APIs, event handlers.
- Cannot be `async` (well, you can, but you shouldn't — use Suspense + `use(promise)` if needed).
- Cannot import server-only code.

### 3.2 The `'use client'` boundary — push it DOWN

```tsx
// ❌ BAD — entire page becomes Client because of one button
'use client';
export default function Page() {
  const data = fetch(...);  // can't await in a Client Component
  return <div>{data}<button onClick={...}>Click</button></div>;
}

// ✅ GOOD — page is Server, only the button is Client
// app/page.tsx (Server)
import { ClickButton } from './ClickButton';
export default async function Page() {
  const data = await fetchData();
  return <div>{data}<ClickButton /></div>;
}

// app/ClickButton.tsx (Client)
'use client';
export function ClickButton() {
  return <button onClick={() => alert('hi')}>Click</button>;
}
```

The boundary marks "everything below this is also Client." So mark leaves, not roots.

### 3.3 Server Components inside Client Components — via `children` props

```tsx
// ✅ This works: ServerComponent passed as `children`
'use client';
export function ClientWrapper({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return open ? <div>{children}</div> : null;
}

// In a Server Component:
<ClientWrapper><ServerOnlyData /></ClientWrapper>
```

You can pass Server Components into Client Components **as props/children**. You cannot import a Server Component from inside a Client Component file.

### 3.4 Serialization boundary

Props passed Server → Client must be **serializable**. Allowed: primitives, plain objects/arrays, Date, Map, Set, Promise (since Next 15+). **Not allowed**: functions, class instances, Symbol.

```tsx
// ❌ Functions don't cross the boundary
<ClientButton onClick={() => doStuff()} />   // doStuff is a server function!

// ✅ Use a Server Action instead
import { doStuffAction } from './actions';
<ClientButton action={doStuffAction} />
```

### 3.5 `'use server'` — do not confuse with `'use client'`

- `'use client'` at the top of a file: this file and everything below is a Client Component boundary.
- `'use server'` at the top of a file: every exported function is a **Server Action** (callable from the client, runs on the server).
- `'use server'` inline at the top of a function body: only that function is a Server Action.

### 3.6 Streaming with Suspense

```tsx
// app/dashboard/page.tsx
import { Suspense } from 'react';

export default function Dashboard() {
  return (
    <>
      <UserHeader />                           {/* fast, renders first */}
      <Suspense fallback={<Skeleton />}>
        <SlowAnalytics />                      {/* streams in when ready */}
      </Suspense>
      <Suspense fallback={<Skeleton />}>
        <SlowFeed />                           {/* independent stream */}
      </Suspense>
    </>
  );
}
```

The HTML for `UserHeader` arrives immediately; `SlowAnalytics` and `SlowFeed` stream in independently as their data resolves. **No more all-or-nothing waterfalls.**

### 3.7 Static, dynamic, ISR — how it's actually decided

A route is **static** by default. It becomes **dynamic** if any of:
- `cookies()`, `headers()`, `searchParams` is read.
- `fetch()` is called with `cache: 'no-store'` or `next: { revalidate: 0 }`.
- `noStore()` or `unstable_noStore()` is called.
- `export const dynamic = 'force-dynamic'` is set.

Want explicit control:
```ts
export const dynamic = 'auto' | 'force-dynamic' | 'error' | 'force-static';
export const revalidate = 60;        // ISR: regenerate at most once per 60s
export const fetchCache = 'auto' | 'default-cache' | 'force-cache' | 'force-no-store';
export const runtime = 'nodejs' | 'edge';
export const preferredRegion = 'auto' | 'global' | 'home' | string[];
```

### 3.8 Partial Prerendering (PPR — experimental)

Renders the static shell at build time, streams dynamic holes (anything inside `<Suspense>` reading dynamic data) at request time. The future of Next rendering. Enable in `next.config.js`:

```js
module.exports = { experimental: { ppr: 'incremental' } };
// Then per-route:
export const experimental_ppr = true;
```

---

## 4. Data Fetching in Server Components

### 4.1 The basic shape

```tsx
// app/products/page.tsx (Server Component)
import { db } from '@/lib/db';

export default async function ProductsPage() {
  const products = await db.product.findMany();   // direct DB query, no API needed
  return <ProductList products={products} />;
}
```

No `useEffect`, no loading state, no error state to wire up. The framework handles it via `loading.tsx` (Suspense) and `error.tsx` (Error Boundary).

### 4.2 Parallel fetching — avoid waterfalls

```tsx
// ❌ BAD — sequential, slow
async function Page() {
  const user = await getUser();
  const posts = await getPosts();        // waits for user even though it doesn't need it
  const comments = await getComments();  // waits for posts
  return <View user={user} posts={posts} comments={comments} />;
}

// ✅ GOOD — parallel
async function Page() {
  const [user, posts, comments] = await Promise.all([
    getUser(),
    getPosts(),
    getComments(),
  ]);
  return <View user={user} posts={posts} comments={comments} />;
}

// ✅ EVEN BETTER — start fetches early, await later
async function Page() {
  const userPromise = getUser();
  const postsPromise = getPosts();
  const commentsPromise = getComments();
  return (
    <>
      <Header user={await userPromise} />
      <Suspense fallback={<PostsSkeleton />}>
        <Posts promise={postsPromise} />
      </Suspense>
      <Suspense fallback={<CommentsSkeleton />}>
        <Comments promise={commentsPromise} />
      </Suspense>
    </>
  );
}
```

### 4.3 Request memoization (React's `cache` & native `fetch`)

`fetch()` with the same URL + options is **automatically deduplicated** within a single request. Two Server Components on the same page calling `fetch('/api/user')` results in one network call.

For non-fetch data (DB queries), wrap in React's `cache`:

```ts
import { cache } from 'react';
import { db } from '@/lib/db';

export const getUser = cache(async (id: string) => {
  return db.user.findUnique({ where: { id } });
});
// Now multiple components in the same request get one DB call.
```

This is **per-request** memoization — separate from the long-lived Data Cache (see § 5).

### 4.4 Fetch caching options

```ts
// Cached forever (default in Next 14, no longer default in Next 15)
const data = await fetch('https://api.example.com/products');

// Always fresh (dynamic)
const data = await fetch('https://api.example.com/products', { cache: 'no-store' });

// Revalidate at most every 60 seconds (ISR semantics)
const data = await fetch('https://api.example.com/products', {
  next: { revalidate: 60 },
});

// Tagged caching for selective invalidation
const data = await fetch('https://api.example.com/products', {
  next: { tags: ['products'] },
});
// Later: revalidateTag('products') invalidates this specific cache entry.
```

**Next.js 15 changed defaults**: `fetch` is no longer cached by default. Be explicit with `next: { revalidate: ... }` or `cache: 'force-cache'` when you want caching.

### 4.5 `unstable_cache` for non-fetch data

```ts
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/db';

export const getCachedUserStats = unstable_cache(
  async (userId: string) => db.stats.findUnique({ where: { userId } }),
  ['user-stats'],                          // cache key prefix
  { revalidate: 3600, tags: ['stats'] },   // 1hr TTL + tag for invalidation
);
```

### 4.6 Reading cookies / headers (forces dynamic)

```ts
import { cookies, headers } from 'next/headers';

export default async function Page() {
  const cookieStore = await cookies();      // async in Next 15+
  const token = cookieStore.get('session')?.value;
  const headerStore = await headers();
  const ip = headerStore.get('x-forwarded-for');
  // ...
}
```

Reading cookies/headers in a page or layout makes that segment **dynamic** — it can't be statically rendered.

### 4.7 Error handling

```tsx
// app/products/page.tsx
import { notFound } from 'next/navigation';

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);
  if (!product) notFound();              // renders nearest not-found.tsx
  return <View product={product} />;
}

// app/products/error.tsx
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>Something broke: {error.message}</h2>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

**Don't** swallow errors with `try/catch` and render fallback inline — let `error.tsx` handle them. Catch only when you can genuinely recover.

---

## 5. The Four Caches

Understand all four. Conflating them is the root cause of most "why isn't my data updating" bugs.

| Cache | Scope | Purpose | Invalidation |
|---|---|---|---|
| **Request Memoization** | Per request | Dedupes identical `fetch` / `cache()` calls within one render pass | Auto, when request ends |
| **Data Cache** | Persistent (server) | Stores `fetch` results across requests/users; the long-lived cache | `revalidate`, `revalidatePath`, `revalidateTag`, redeploy |
| **Full Route Cache** | Persistent (server) | Pre-rendered HTML + RSC payload for static routes | `revalidate`, `revalidatePath`, `revalidateTag`, redeploy |
| **Router Cache** | Per browser session | Client-side cache of RSC payloads for visited routes (faster nav) | Soft: time-based; hard: `router.refresh()`, Server Action |

### Mental model

```
User clicks Link → Router Cache hit? → Yes: instant render
                                     ↘ No: fetch RSC from server
                                          → Full Route Cache hit? → Yes: serve cached HTML/RSC
                                                                   ↘ No: render route, fetch data
                                                                        → Data Cache hit? → Yes: use cached data
                                                                                          ↘ No: fetch from origin, store
```

### Invalidation API

```ts
import { revalidatePath, revalidateTag } from 'next/cache';

revalidatePath('/products');              // invalidate all caches for /products
revalidatePath('/products/[id]', 'page'); // invalidate parameterized route
revalidatePath('/', 'layout');            // invalidate the layout (cascades)

revalidateTag('products');                // invalidate all fetches tagged 'products'
```

**Use `revalidateTag` over `revalidatePath`** when possible — more surgical, less wasted re-render.

---

## 6. Server Actions

Server Actions are **server-side functions invokable from the client**. Use them for mutations triggered by your own UI (forms, buttons). They get automatic CSRF protection when invoked via `<form action={...}>`.

### 6.1 Defining

```ts
// app/actions.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { requireUser } from '@/lib/auth';

const createPostSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
});

export async function createPost(formData: FormData) {
  // 1. AUTHN — never trust the client
  const user = await requireUser();

  // 2. VALIDATE — never trust input
  const parsed = createPostSchema.safeParse({
    title: formData.get('title'),
    body: formData.get('body'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten() };
  }

  // 3. AUTHZ — check this user can do this
  // (sometimes implicit in the query: WHERE owner_id = user.id)

  // 4. MUTATE
  const post = await db.post.create({
    data: { ...parsed.data, authorId: user.id },
  });

  // 5. REVALIDATE the affected routes
  revalidatePath('/posts');
  revalidateTag(`user-${user.id}-posts`);

  // 6. REDIRECT (or return data)
  redirect(`/posts/${post.id}`);
}
```

This is **the canonical shape**. Every Server Action does authn → validate → authz → mutate → revalidate → respond.

### 6.2 Calling from a form

```tsx
// app/posts/new/page.tsx
import { createPost } from '@/app/actions';

export default function NewPostPage() {
  return (
    <form action={createPost}>          {/* Server Component form, progressive enhancement */}
      <input name="title" required />
      <textarea name="body" required />
      <button type="submit">Publish</button>
    </form>
  );
}
```

This works **without JavaScript** — the form posts to a Next-managed endpoint, the action runs, and the page re-renders.

### 6.3 Pending state with `useFormStatus` and errors with `useActionState`

```tsx
// app/posts/new/PostForm.tsx
'use client';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { createPost } from '@/app/actions';

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? 'Publishing…' : 'Publish'}</button>;
}

export function PostForm() {
  const [state, formAction] = useActionState(createPost, { error: null });
  return (
    <form action={formAction}>
      <input name="title" />
      {state.error?.fieldErrors?.title && <p>{state.error.fieldErrors.title[0]}</p>}
      <textarea name="body" />
      <SubmitButton />
    </form>
  );
}
```

`useFormStatus` MUST be inside the form's child tree. `useActionState` is React 19's official replacement for `useFormState`.

### 6.4 Optimistic updates with `useOptimistic`

```tsx
'use client';
import { useOptimistic } from 'react';
import { likePost } from '@/app/actions';

export function LikeButton({ post }: { post: { id: string; likes: number } }) {
  const [optimisticLikes, addOptimisticLike] = useOptimistic(
    post.likes,
    (current, _: void) => current + 1,
  );

  async function handleLike() {
    addOptimisticLike();
    await likePost(post.id);
  }
  return <button onClick={handleLike}>♥ {optimisticLikes}</button>;
}
```

Show the result instantly; reconcile when the server confirms.

### 6.5 Server Actions security pitfalls

**Treat every Server Action as a public API endpoint.** Anyone can craft a fetch to it.

- **Always re-authenticate.** Read the session inside the action; don't trust a `userId` argument.
- **Always validate input** with Zod (or equivalent). The arguments are user-controlled.
- **Authorize the operation** — check that this user is allowed to do this thing to this resource.
- **Don't leak server-only data** in returned values. Return only what the client needs.
- **Beware closed-over data.** Server Actions defined inline in a component capture variables from the surrounding scope — those become part of an encrypted payload. Don't accidentally close over secrets.
- **Rate-limit** sensitive actions (login, signup, password reset). `@upstash/ratelimit` works on the Edge.

### 6.6 When NOT to use a Server Action

- External clients (mobile apps, third-party integrations) calling your endpoint → use a Route Handler.
- Webhook receivers → Route Handler.
- Endpoints that need to return non-JSON (binary, streamed, custom Content-Type) → Route Handler.
- Public REST/GraphQL APIs → Route Handler.

---

## 7. Route Handlers

`app/api/**/route.ts` files. Standard `Request` → `Response` HTTP endpoints.

### 7.1 Basic shape

```ts
// app/api/posts/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireUser } from '@/lib/auth';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page') ?? '1');

  const posts = await db.post.findMany({
    take: 20,
    skip: (page - 1) * 20,
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ posts });
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(10000),
});

export async function POST(req: NextRequest) {
  const user = await requireUser();          // throws if unauthenticated

  const json = await req.json();
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const post = await db.post.create({
    data: { ...parsed.data, authorId: user.id },
  });
  return NextResponse.json({ post }, { status: 201 });
}
```

### 7.2 Dynamic params

```ts
// app/api/posts/[id]/route.ts
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const post = await db.post.findUnique({ where: { id } });
  if (!post) return new NextResponse(null, { status: 404 });
  return NextResponse.json({ post });
}
```

### 7.3 Streaming response (e.g., AI chat)

```ts
export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { messages } = await req.json();
  const upstream = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { /* ... */ },
    body: JSON.stringify({ stream: true, messages, model: 'gpt-4o' }),
  });
  return new Response(upstream.body, {
    headers: { 'Content-Type': 'text/event-stream' },
  });
}
```

### 7.4 Caching

`GET` handlers can be cached:
```ts
export const dynamic = 'force-static';
export const revalidate = 60;
```

`POST`/`PUT`/`PATCH`/`DELETE` are dynamic by default (correct — mutations shouldn't be cached).

### 7.5 CORS for cross-origin callers

```ts
// app/api/public/route.ts
const ALLOWED_ORIGINS = new Set([
  'https://example.com',
  'https://staging.example.com',
]);

export async function GET(req: NextRequest) {
  const origin = req.headers.get('origin');
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';

  return NextResponse.json(
    { ok: true },
    {
      headers: {
        'Access-Control-Allow-Origin': allowOrigin,     // never '*' with credentials
        'Access-Control-Allow-Credentials': 'true',
        'Vary': 'Origin',                                // critical for correct caching
      },
    },
  );
}

export async function OPTIONS(req: NextRequest) {
  const origin = req.headers.get('origin');
  const allowOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : '';
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': allowOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, authorization',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  });
}
```

**Critical**: include `Vary: Origin` whenever the response varies by origin, or CDNs will cache the wrong CORS response and break some users.

### 7.6 Webhook receivers (signature verification)

```ts
import { headers } from 'next/headers';
import crypto from 'node:crypto';

export const runtime = 'nodejs';   // Edge can't use node:crypto

export async function POST(req: NextRequest) {
  const body = await req.text();   // raw body for signature verification
  const sig = (await headers()).get('x-webhook-signature') ?? '';
  const expected = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET!)
    .update(body)
    .digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return new NextResponse('Bad signature', { status: 401 });
  }
  // ... process event
  return NextResponse.json({ received: true });
}
```

Always **timing-safe-compare** signatures. Never `===`.

---

## 8. Middleware (auth, redirects, headers)

`middleware.ts` at the project root runs on every request matching its `config.matcher`. Edge runtime — small bundle, fast cold starts, but no Node APIs.

### 8.1 Skeleton

```ts
// middleware.ts
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
  // do stuff before the route runs
  return NextResponse.next();
}

export const config = {
  // run on everything except static files and Next internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
```

### 8.2 Auth-gating routes

```ts
import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC = ['/', '/login', '/signup', '/api/auth'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some(p => pathname === p || pathname.startsWith(`${p}/`))) {
    return NextResponse.next();
  }

  const token = req.cookies.get('session')?.value;
  if (!token) return redirectToLogin(req);

  try {
    await jwtVerify(token, new TextEncoder().encode(process.env.JWT_SECRET!));
  } catch {
    return redirectToLogin(req);
  }
  return NextResponse.next();
}

function redirectToLogin(req: NextRequest) {
  const url = req.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.set('next', req.nextUrl.pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!_next/|favicon.ico|api/auth/).*)'],
};
```

**Important**: middleware runs on the Edge — **no Node APIs**. Use `jose` (Edge-compatible JWT lib), not `jsonwebtoken`.

### 8.3 Supabase auth pattern

```ts
// middleware.ts (canonical Supabase + SSR pattern)
import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(req: NextRequest) {
  let res = NextResponse.next({ request: req });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() { return req.cookies.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
          res = NextResponse.next({ request: req });
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // CRITICAL: always call getUser() — this refreshes the session cookie if needed.
  // Don't use getSession() for auth checks (it doesn't validate, only reads cookie).
  const { data: { user } } = await supabase.auth.getUser();

  if (!user && req.nextUrl.pathname.startsWith('/dashboard')) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }
  return res;
}
```

**`getUser()` vs `getSession()`**: `getSession()` reads the cookie without verifying — fast but trusts the client. `getUser()` round-trips to Supabase to validate the JWT. **For auth gating, always use `getUser()`** (or its server-side equivalent that verifies the token).

### 8.4 Redirects, rewrites, headers

```ts
// Redirect (URL changes, browser sees the new URL)
return NextResponse.redirect(new URL('/new-path', req.url), 308);

// Rewrite (URL stays, internal route changes — like a reverse proxy)
return NextResponse.rewrite(new URL('/internal', req.url));

// Inject headers
const res = NextResponse.next();
res.headers.set('x-request-id', crypto.randomUUID());
return res;
```

### 8.5 CSP nonces in middleware

The pattern for **strict CSP** with Next.js (nonce-based, no `'unsafe-inline'`):

```ts
// middleware.ts
export async function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    `style-src 'self' 'unsafe-inline'`,            // inline styles often hard to remove
    `img-src 'self' data: https:`,
    `font-src 'self' data:`,
    `connect-src 'self' https://*.supabase.co`,
    `frame-ancestors 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `upgrade-insecure-requests`,
  ].join('; ');

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set('x-nonce', nonce);
  reqHeaders.set('content-security-policy', csp);

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set('content-security-policy', csp);
  return res;
}
```

```tsx
// app/layout.tsx — read nonce in Server Component
import { headers } from 'next/headers';
import Script from 'next/script';

export default async function RootLayout({ children }) {
  const nonce = (await headers()).get('x-nonce')!;
  return (
    <html>
      <body>
        {children}
        <Script src="https://example.com/widget.js" nonce={nonce} />
      </body>
    </html>
  );
}
```

### 8.6 Middleware performance limits

- Edge runtime size limit (~1 MB compressed bundle).
- No Node APIs (`fs`, `path`, `crypto.createHash`, etc. — use Web Crypto instead).
- Don't make slow upstream calls in middleware — every request pays the cost. Cache aggressively or push the work into the route.

---

## 9. Mutations & revalidation patterns

The full mutation lifecycle:

```
User submits form
  ↓
Client validation (cheap UX, not security)
  ↓
Server Action invoked
  ↓
authn → input validation → authz → mutate DB
  ↓
revalidatePath / revalidateTag    ← invalidates caches
  ↓
return data, OR redirect()         ← Next sends fresh RSC payload
  ↓
Client renders updated UI
```

### Surgical revalidation

Tag your fetches at the source:
```ts
const products = await fetch('/api/products', {
  next: { tags: ['products', `category-${categoryId}`] },
});
```
Then in the action:
```ts
revalidateTag(`category-${categoryId}`);
```
Only that category's cache is invalidated — other categories stay served from cache.

### Optimistic + reconciliation

Pair `useOptimistic` (instant UI) with `revalidatePath` in the action (reconciles to server truth). Revert UX automatically if the action throws (React resets the optimistic state).

---

## 10. Security & token handling

This section is Next.js-specific. For deeper general web-security coverage (CSP, CORS, XSS, supply chain), see `references/security.md`.

### 10.1 Where to store tokens

| Storage | XSS-safe? | CSRF-safe? | Use case |
|---|---|---|---|
| **`httpOnly` Secure cookie** | ✅ JS can't read | ❌ (mitigate with `SameSite` + token) | Session tokens, refresh tokens |
| **In-memory** (React state) | ✅ if no XSS reaches your app | ✅ not auto-attached | Short-lived access tokens |
| **`localStorage`** | ❌ readable by any script | ✅ not auto-attached | Almost never — pick one of the above |
| **`sessionStorage`** | ❌ readable by any script | ✅ | Same as `localStorage` — avoid for auth |

**Default for Next.js apps**: `httpOnly` cookie holding the session, `SameSite=Lax`, `Secure`, with appropriate `Path` and `Max-Age`. Refresh tokens go in a separate `httpOnly` cookie with stricter `Path` (e.g., `/api/auth/refresh`).

```ts
// Setting a session cookie in a Route Handler or Server Action
import { cookies } from 'next/headers';

(await cookies()).set('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7,
});
```

### 10.2 CSRF in Next.js

Server Actions invoked via `<form action={action}>` get **automatic CSRF protection** (Next checks the Origin header against the host). But:

- If you call the action manually via `fetch` from a different origin, you must handle CSRF yourself.
- Route Handlers have **no built-in CSRF protection**. If they accept cookies, you need a CSRF token or verify `Origin`/`Referer`.

A solid pattern:
```ts
// In Route Handlers that accept cookie auth and mutate:
const origin = req.headers.get('origin');
const host = req.headers.get('host');
if (origin && new URL(origin).host !== host) {
  return new NextResponse('Forbidden', { status: 403 });
}
```

`SameSite=Lax` cookies prevent the most common CSRF (cross-site form posts), but cross-site fetch with `credentials: 'include'` from a malicious page can still cause issues without `Origin` checks.

### 10.3 Public env vars — the `NEXT_PUBLIC_` trap

```
NEXT_PUBLIC_FOO   → inlined into client bundle. Visible to every user.
FOO               → server-only. Never reaches the client.
```

**Audit before every release**: grep for `NEXT_PUBLIC_` in your code and confirm each one is something you intend to expose. Common mistake: `NEXT_PUBLIC_API_KEY` for a service that should only be called server-side.

### 10.4 Security headers config

```js
// next.config.js
const securityHeaders = [
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  { key: 'X-Frame-Options', value: 'DENY' },              // legacy; CSP frame-ancestors covers modern browsers
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
];

module.exports = {
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
};
```

CSP is best set in **middleware** (so you can use per-request nonces) — see § 8.5.

### 10.5 `dangerouslySetInnerHTML` — the rules

If you must:
1. Sanitize input with **DOMPurify** (or **sanitize-html** server-side).
2. Configure DOMPurify's allowed tags/attributes — defaults are reasonable but verify.
3. Re-sanitize on render (don't trust DB content was sanitized at write time — defense in depth).
4. Better: render a structured representation (Markdown via `react-markdown`, MDX, a portable text format) instead of raw HTML.

### 10.6 Image and link safety

```tsx
// External images: use next/image with remotePatterns whitelist in next.config.js
// next.config.js:
images: {
  remotePatterns: [
    { protocol: 'https', hostname: 'cdn.example.com' },
  ],
}

// Outbound links to user-controlled URLs:
<a href={url} target="_blank" rel="noopener noreferrer">…</a>

// Don't trust user-provided URLs to be safe:
function isSafeUrl(s: string) {
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch { return false; }
}
```

### 10.7 OAuth callback handling

```ts
// app/auth/callback/route.ts
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Verify state matches what was set in the cookie before redirect (CSRF protection for OAuth flow)
  const stored = (await cookies()).get('oauth_state')?.value;
  if (!state || state !== stored) {
    return new NextResponse('Invalid state', { status: 400 });
  }
  (await cookies()).delete('oauth_state');

  if (!code) return new NextResponse('No code', { status: 400 });
  // ...exchange code for token, set session cookie, redirect
}
```

Always verify the `state` parameter. Always use `httpOnly` cookies for the state value.

### 10.8 Open-redirect prevention

```ts
const next = req.nextUrl.searchParams.get('next') ?? '/dashboard';
// ❌ DANGEROUS: redirect(next) — user can pass next=https://attacker.com/login
// ✅ SAFE: only allow same-origin paths
const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard';
return NextResponse.redirect(new URL(safeNext, req.url));
```

### 10.9 Rate limiting

Sensitive endpoints (login, signup, password reset, OAuth callback, AI/expensive endpoints) need rate limiting. Use Upstash Ratelimit (Edge-compatible) or Vercel KV:

```ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, '1 m'),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') ?? 'anonymous';
  const { success } = await ratelimit.limit(ip);
  if (!success) return new NextResponse('Too many requests', { status: 429 });
  // ...
}
```

---

## 11. Vercel deployment

### 11.1 Environment variables

- Set in Vercel dashboard, scoped per environment (production / preview / development).
- `NEXT_PUBLIC_*` are inlined into the client bundle at build time.
- Server-only vars are read at runtime, never shipped.
- Use Vercel's "Sensitive" flag for secrets — they can't be read back from the UI after creation.

### 11.2 Edge vs. Node Runtime

| | Edge | Node |
|---|---|---|
| Cold start | ~50ms | ~200-500ms |
| Bundle size limit | ~1 MB | 50 MB |
| Node APIs | No (Web APIs only) | Full |
| Streaming | Native | Native |
| Use for | Middleware, simple Route Handlers, AI streaming | Heavy SDKs, file processing, anything Node-specific |

```ts
export const runtime = 'edge';     // or 'nodejs' (default in Next 14+)
```

### 11.3 `vercel.json` essentials

```json
{
  "functions": {
    "app/api/ai/**": { "maxDuration": 60, "memory": 1024 }
  },
  "headers": [
    {
      "source": "/api/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "no-store" }]
    }
  ]
}
```

### 11.4 ISR & on-demand revalidation

Combine `revalidate` (time-based) with `revalidatePath`/`revalidateTag` (event-based) for hybrid: pages refresh on a schedule AND immediately on content changes.

### 11.5 Speed Insights & Analytics

```bash
npm install @vercel/speed-insights @vercel/analytics
```

```tsx
// app/layout.tsx
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({ children }) {
  return (
    <html><body>
      {children}
      <SpeedInsights />
      <Analytics />
    </body></html>
  );
}
```

Free real-user CWV monitoring. Use it. Lab data lies.

---

## 12. Common Next.js mistakes

A non-exhaustive list, organized by frequency.

1. **Marking the whole page `'use client'`.** Push the boundary to the leaf component that needs interactivity.
2. **Importing from `next/router`** in App Router. It's `next/navigation`.
3. **`searchParams` in a layout.** Layouts can't read them (no per-request input). Move to the page or a Client Component.
4. **Forgetting `await` on `params`/`searchParams`/`cookies()`/`headers()` in Next 15.** Throws at runtime.
5. **Server-only imports leaking to Client Components.** Add `import 'server-only'` at the top of server-only modules — they'll throw at build if imported by a Client Component.
6. **`useState`-then-`useEffect` to sync derived data.** Just compute it inline.
7. **Hydration mismatch from `Date.now()` / `Math.random()` / `typeof window`.** Either move the logic to a `useEffect`, suppress with `suppressHydrationWarning` (last resort), or render a stable placeholder + replace on mount.
8. **`fetch` without revalidation strategy.** Be explicit: `cache: 'no-store'` for dynamic, `next: { revalidate: N }` or `tags` for ISR.
9. **`revalidatePath` after every action without thinking.** If you can use `revalidateTag`, you'll invalidate less.
10. **Calling Server Actions from a different origin without CSRF protection.**
11. **`Access-Control-Allow-Origin: *` with credentials.** Won't work; spec disallows it.
12. **CORS preflight not handled** (no `OPTIONS` exported in the Route Handler).
13. **Missing `Vary: Origin`** on CORS responses → CDN serves the wrong response to other origins.
14. **JWT lib that doesn't run on Edge.** Use `jose`, not `jsonwebtoken`, in middleware.
15. **`getSession()` for auth-gating** instead of `getUser()` — reads cookie without verifying.
16. **Missing `priority` on the LCP image.** It defers; LCP gets worse.
17. **Custom `fetch` wrapper that breaks Next's caching.** Use native `fetch` so caching works.
18. **Big Client Components imported eagerly.** Use `next/dynamic({ ssr: false })` for heavy interactive widgets.
19. **`'use client'` files importing huge server-side libs.** They get bundled and shipped to the browser. Audit imports.
20. **Forgetting `Suspense` boundaries.** A slow data fetch will block the entire page render.
