# Code Review Checklist — The Picky Pass

A red-flag list organized by domain. Use this when:
- Doing a deliberate review pass on a PR / pasted snippet.
- Hunting for the actual bug behind a vague "it's slow" / "it's broken" report.
- Vetting your own draft before claiming it's done.

For each flag: the symptom, why it's wrong, and what to do instead. Read the section relevant to what you're looking at; for a full-pass review, walk every section.

## Sections

1. [React — components & rendering](#1-react--components--rendering)
2. [React — hooks](#2-react--hooks)
3. [React — state shape & lifting](#3-react--state-shape--lifting)
4. [React — performance](#4-react--performance)
5. [Next.js App Router specifics](#5-nextjs-app-router-specifics)
6. [TypeScript](#6-typescript)
7. [JavaScript & async](#7-javascript--async)
8. [CSS & styling](#8-css--styling)
9. [HTML & accessibility](#9-html--accessibility)
10. [Performance — runtime & bundle](#10-performance--runtime--bundle)
11. [Security smells](#11-security-smells)
12. [Build, deps, and tooling](#12-build-deps-and-tooling)
13. [Testing & error handling](#13-testing--error-handling)

---

## 1. React — components & rendering

### Missing or misused `key` on lists
**Smell**: `array.map((item) => <Row {...item} />)` — no key. Or `key={index}` on a list that mutates.
**Why**: React uses keys to track identity across renders. Missing → console warning + buggy reconciliation. `index` on a reordering list → state attached to the wrong item, animations break, controlled inputs swap values.
**Fix**: stable, unique key derived from data (`item.id`).

### `key={Math.random()}` or `key={Date.now()}`
**Smell**: someone "fixed" a key warning by making it always-changing.
**Why**: every render = new key = unmount + remount. Defeats reconciliation entirely. Animations replay, focus is lost, scroll is lost.
**Fix**: real stable key. If you genuinely need to force-remount (e.g., when route changes), use `key={someStableId}`.

### Inline object/array/function literals as props to memoized children
**Smell**: `<Memoed config={{ a: 1 }} onClick={() => x()} />`
**Why**: new object identity every render → `React.memo` does nothing → child re-renders anyway.
**Fix**: lift the object out, or wrap with `useMemo`/`useCallback` (only if the child is genuinely memoized — otherwise this is overhead, not optimization).

### Component defined inside another component
**Smell**:
```tsx
function Parent() {
  function Child() { return <div />; }   // re-created every render
  return <Child />;
}
```
**Why**: every render creates a new `Child` reference, which React treats as an entirely different component type. State inside `Child` is lost on every parent render.
**Fix**: hoist `Child` to module scope. If it needs parent context, pass props or use a hook.

### Conditional rendering that flips component type
**Smell**: `{isEditing ? <EditableField {...} /> : <DisplayField {...} />}` where the two have similar internal state.
**Why**: switching component types unmounts one and mounts the other → state is lost.
**Fix**: render one component that internally handles both modes. If you genuinely want the unmount, fine — but be aware.

### Returning early before all hooks are called
**Smell**:
```tsx
function X({ data }) {
  if (!data) return null;        // BUG: hooks below this are conditional
  const [x, setX] = useState(0);
  // ...
}
```
**Why**: violates Rules of Hooks. React tracks hooks by call order; conditional calls = misaligned state.
**Fix**: hooks at the top, then the early return.

### Mutating props or state directly
**Smell**: `props.items.push(x)` / `state.count++`
**Why**: React relies on referential equality to decide what changed. Mutation = no change detected = no re-render. Or worse, sometimes-rerender depending on what else triggered it.
**Fix**: spread / immutable updaters. `setState(s => ({ ...s, count: s.count + 1 }))`.

### Reading `props` / `state` inside a stale closure
**Smell**: setTimeout/setInterval/event listener that captured an old value.
```tsx
useEffect(() => {
  const id = setInterval(() => setCount(count + 1), 1000);
  return () => clearInterval(id);
}, []);                          // count is captured at first render — stays 0 forever
```
**Fix**: functional updater (`setCount(c => c + 1)`) OR add `count` to deps (will reset interval — usually wrong) OR `useRef` to hold a mutable latest value.

---

## 2. React — hooks

### `useEffect` for derived state
**Smell**:
```tsx
const [filtered, setFiltered] = useState([]);
useEffect(() => { setFiltered(items.filter(...)); }, [items]);
```
**Why**: extra render (set state → trigger re-render → effect → set state → re-render). Plus race conditions if items changes again before effect runs.
**Fix**:
```tsx
const filtered = useMemo(() => items.filter(...), [items]);
// or just: const filtered = items.filter(...);
```

### `useEffect` to notify the parent
**Smell**:
```tsx
useEffect(() => { onChange(value); }, [value]);
```
**Why**: parent gets notified on every render that changes `value`, including when the change came from the parent itself. Loops, stale state, double notifications.
**Fix**: call `onChange(newValue)` from the event handler that *caused* the change. Effects describe state; handlers do work.

### `useEffect` to reset state on prop change
**Smell**:
```tsx
useEffect(() => { setCount(0); }, [userId]);
```
**Why**: extra render (one with old state, one after reset).
**Fix**: pass `key={userId}` to the component (remounts cleanly) OR derive: track `previousUserId` with `useRef` and reset inline (advanced; usually `key` is cleaner).

### Missing or wrong `useEffect` dependencies
**Smell**: `// eslint-disable-next-line react-hooks/exhaustive-deps`
**Why**: silently ignored deps → stale closures → bugs. The `exhaustive-deps` lint rule is right almost always.
**Fix**: include the deps. If you genuinely don't want the effect to re-run when X changes, that's a sign you should be using a ref, an event handler, or a different abstraction. Don't disable the lint without understanding why.

### `useEffect` doing data fetching in a Server Component world
**Smell**: `useEffect(() => { fetch('/api/...').then(setData); }, [])` in a Next.js page that could just `await fetch` server-side.
**Why**: client-side waterfall, slower TTFB, no streaming, larger client bundle, cache benefits lost.
**Fix**: turn the page into a Server Component, fetch on the server.

### `useEffect` without cleanup for subscriptions/listeners/timers
**Smell**: `addEventListener` without `removeEventListener`, `setInterval` without `clearInterval`.
**Why**: leaks. Component unmounts but listener stays, fires on stale state, errors.
**Fix**: cleanup function. Use `AbortController` for `addEventListener` and `fetch` — cleaner than tracking handlers.

### `useState` for refs that don't need re-renders
**Smell**: `const [el, setEl] = useState(null); <div ref={setEl}>` when you never re-render based on `el`.
**Why**: ref callback triggers a re-render every time it's called. `useRef` doesn't.
**Fix**: `useRef` if you just need to remember it; `useState` only if you genuinely re-render based on the ref.

### Hook called conditionally / in a loop / after early return
**Smell**: `if (cond) useFoo();` / `items.map(item => useBar(item))` / `if (x) return; useBaz();`
**Why**: hooks track state by call order. Order must be consistent across renders.
**Fix**: restructure so hooks are at the top, called unconditionally. If you need per-item state, lift each item to its own component.

### Custom hook that returns a new object every render
**Smell**:
```tsx
function useThing() { return { x: 1, doStuff: () => {} }; }
// Caller: const { x, doStuff } = useThing(); useEffect(() => {}, [doStuff]);  // re-runs every render
```
**Fix**: `useMemo` the returned object, `useCallback` the functions, OR return primitives instead of objects.

### `useReducer` for trivially simple state
**Smell**: `useReducer` with one action, two lines of state.
**Why**: overhead without benefit. Reducers shine when state has multiple interdependent fields and many transitions.
**Fix**: `useState` until you have actual complexity.

---

## 3. React — state shape & lifting

### Duplicated / redundant state
**Smell**: `selected: User | null` AND `selectedId: string | null`. Both have to stay in sync.
**Fix**: pick one source of truth. The other is derived (`users.find(u => u.id === selectedId)`).

### State that should be a ref
**Smell**: state that's used only in event handlers and never displayed in JSX.
**Why**: every set triggers a re-render for nothing.
**Fix**: `useRef`.

### State lifted too high
**Smell**: a deeply-nested input's value lives in the root component, prop-drilled through 6 layers.
**Fix**: keep state where it's used. Lift only when multiple components genuinely need it.

### State lifted too low
**Smell**: two siblings each manage their own copy and try to sync via callbacks.
**Fix**: lift to common parent.

### Server data in `useState`
**Smell**: `const [user, setUser] = useState(null); useEffect(() => fetch... .then(setUser), [])`
**Why**: you've reinvented data fetching, with no caching, deduping, retry, error handling, or background refresh.
**Fix**: TanStack Query / SWR (client-fetched), or move to a Server Component.

### Forms with one `useState` per field
**Smell**: 10 inputs, 10 `useState` calls, 10 `onChange` handlers.
**Fix**: React Hook Form (uncontrolled, fewer re-renders) OR a single `useReducer` with one state object.

### Storing in `localStorage` without SSR safety
**Smell**:
```tsx
const [theme, setTheme] = useState(localStorage.getItem('theme') ?? 'light');
```
**Why**: `localStorage` doesn't exist on the server → crashes on SSR.
**Fix**: lazy initialize on the client only:
```tsx
const [theme, setTheme] = useState<'light' | 'dark'>('light');
useEffect(() => { setTheme(localStorage.getItem('theme') as any ?? 'light'); }, []);
```
Or render a hydration-safe fallback first frame.

---

## 4. React — performance

### `React.memo` on components that always re-render anyway
**Smell**: every prop is a new object/function literal from the parent → memo is useless.
**Fix**: stabilize prop identity with `useCallback`/`useMemo` first. Or remove the memo — it's lying.

### `useMemo` on cheap computations
**Smell**: `useMemo(() => x + y, [x, y])`.
**Why**: the deps comparison costs more than the addition.
**Fix**: just compute it inline.

### `useCallback` on a callback that doesn't cross a memo boundary
**Smell**: `useCallback(() => alert('hi'), [])` passed to a non-memoized child.
**Fix**: just declare the function inline. `useCallback` saves nothing here.

### Re-rendering all-of-Context on tiny changes
**Smell**: a context value `{ user, theme, settings, anotherThing }`; changing `theme` re-renders every consumer of any field.
**Fix**: split contexts, or use a state library (Zustand) with selectors.

### Long lists rendered in full
**Smell**: `array.map` over 1000+ items → 1000 DOM nodes → slow render, slow scroll.
**Fix**: virtualize (`@tanstack/react-virtual`). Render only the visible window.

### Heavy work in render
**Smell**: parsing a markdown blob, formatting 10k dates, etc., directly in the component body.
**Fix**: `useMemo` (renders once per dep change), or move to a Server Component, or do it in a Web Worker if it's truly heavy.

### Synchronous heavy state updates blocking the UI
**Smell**: typing into a search box; on each keystroke, a 200ms re-filter → input feels sluggish.
**Fix**: `useDeferredValue` (the *result* lags, the input stays responsive) or `useTransition` for the wrapping update.

### Hydration mismatch warnings ignored
**Smell**: console warnings during dev, ignored.
**Why**: hydration mismatches mean React threw away the server-rendered DOM and re-rendered. Slow, breaks streaming, can cause real bugs.
**Fix**: read the warning, find the branch (`typeof window`, `Date.now()`, locale-formatted strings), fix it.

---

## 5. Next.js App Router specifics

### `'use client'` at the top of a page that mostly doesn't need it
**Fix**: extract the interactive bits into Client Components, keep the page Server.

### Importing `useRouter` from `next/router`
**Why**: that's the Pages Router. App Router is `next/navigation`.
**Fix**: change the import. Different API too (`router.push(href)` vs `router.push({ pathname, query })`).

### Reading `searchParams` in a layout
**Why**: layouts don't get them. Layouts persist across navigations; search params change without a navigation.
**Fix**: read in `page.tsx`, or use `useSearchParams()` in a Client Component.

### Forgetting to `await` `params` / `searchParams` / `cookies()` / `headers()` (Next 15+)
**Why**: they're Promises in Next 15. Logging them shows `Promise { ... }`.
**Fix**: `const { id } = await params;`

### Server-only module imported by a Client Component
**Smell**: DB driver / API key util importing fine on server, suddenly bundled into client when a Client Component grabs it.
**Fix**: add `import 'server-only'` at the top of server-only modules. Build-time error if a client imports it.

### `searchParams` in static `page.tsx` (forces dynamic)
**Why**: reading them opts the route into dynamic rendering — losing static optimization for the whole route.
**Fix**: if only a small slice needs the params, isolate it in a Client Component using `useSearchParams()`. The page stays static.

### `fetch` without explicit caching strategy (Next 15+)
**Why**: defaults changed; behavior depends on the dynamic-vs-static context. Be explicit to avoid surprise.
**Fix**: pick one — `cache: 'no-store'`, `next: { revalidate: N }`, `next: { tags: [...] }`, or `cache: 'force-cache'`.

### `revalidatePath` after every mutation
**Why**: clobbers more cache than necessary.
**Fix**: tag your fetches; `revalidateTag` for surgical invalidation.

### `getSession()` for auth-gating
**Why**: reads cookie without verifying signature. Trusts the client.
**Fix**: `getUser()` (Supabase) or actual JWT verification with `jose`.

### JWT lib that doesn't run on Edge
**Smell**: `jsonwebtoken` imported in middleware; build fails or runtime crashes.
**Fix**: `jose` (Edge-compatible).

### Server Action without input validation
**Smell**:
```ts
'use server';
export async function updateUser(data) {
  await db.user.update({ where: { id: data.id }, data });   // any field updatable
}
```
**Fix**: Zod-validate. **Never** spread user input directly into a DB update — mass-assignment vulnerability.

### Server Action without authn/authz check
**Smell**: trusting the user is logged in because the page that called it required auth.
**Why**: anyone can craft a request to the action endpoint directly.
**Fix**: re-check the session at the top of every Server Action.

### Missing `Suspense` boundary around slow data
**Smell**: page TTFB is 3 seconds because one slow fetch blocks the whole render.
**Fix**: wrap the slow component in `<Suspense fallback={...}>` so the fast parts stream first.

### `next/image` without `width`/`height`/`priority`
**Why**: layout shift (no dimensions) or slow LCP (non-priority hero image).
**Fix**: always provide intrinsic `width` and `height`; the LCP image gets `priority`.

### Custom `fetch` wrapper that breaks Next caching
**Smell**: a `apiClient.get(...)` that uses XHR, axios, or wraps fetch in a way that drops the `cache` / `next` options.
**Fix**: use native `fetch` with the options Next understands, OR call `unstable_cache` to layer caching back on.

### `'use server'` typo or missing
**Smell**: function defined with no `'use server'` directive at the top of the file or function — silently becomes a regular function exported from a server component, can't be called from the client.
**Fix**: add the directive, save, restart dev server if needed.

---

## 6. TypeScript

### `any` (explicit or implicit)
**Smell**: `function foo(x: any)`, `as any`, `// @ts-ignore`.
**Why**: kills the type system locally and infects callers.
**Fix**: `unknown` + narrowing, generic + constraint, or a real type. Last resort: `as never` with a comment explaining why.

### Casting instead of narrowing
**Smell**: `(value as User).name` without verifying.
**Fix**: type guard:
```ts
function isUser(v: unknown): v is User {
  return typeof v === 'object' && v !== null && 'id' in v && typeof (v as User).id === 'string';
}
```
Or runtime validation (Zod): `User.parse(value)` — gives you a typed value AND validates.

### Missing `noUncheckedIndexedAccess`
**Smell**: `arr[0]` is typed as `T` not `T | undefined`. You access `arr[0].name` and crash on empty arrays.
**Fix**: enable `noUncheckedIndexedAccess` in tsconfig. The compiler will force you to handle the undefined case.

### Non-null assertion (`!`) without justification
**Smell**: `getUser()!.email` — "I know it's not null."
**Why**: maybe today. Maybe not next week.
**Fix**: narrow with `if`, throw with a message, or use `??` with a default.

### Function signature with optional fields that should be required
**Smell**: `function pay(amount?: number, currency?: string)` because you didn't want to fill them in for tests.
**Fix**: required signatures, separate test factories.

### `as const` missing on literal-shaped data
**Smell**: `const colors = ['red', 'blue']` — type is `string[]`, not `('red' | 'blue')[]`.
**Fix**: `as const` for literal-shaped data; `satisfies` to validate without losing inference.

### Discriminated union without `kind`/`type` discriminator
**Smell**: `type State = { data?: T, error?: E, loading?: boolean }` — combinations like `{ data: T, loading: true }` are reachable in types.
**Fix**:
```ts
type State<T, E> = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error', error: E } | { kind: 'ok', data: T };
```
`switch (state.kind)` is exhaustive-checked.

### Hand-written types for things that should be derived
**Smell**: hand-typed Database row types, OpenAPI response types, Zod-validated input types.
**Fix**: generate. `supabase gen types`. OpenAPI codegen. `z.infer<typeof schema>`. Single source of truth.

### `tsconfig` missing strictness flags
**Quick audit**: `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`, `noFallthroughCasesInSwitch: true`, `noUnusedLocals: true` (debatable), `noUnusedParameters: true`, `forceConsistentCasingInFileNames: true`.

---

## 7. JavaScript & async

### `await` inside a loop where parallel would work
**Smell**:
```ts
for (const id of ids) {
  results.push(await fetch(`/api/${id}`));
}
```
**Fix**:
```ts
const results = await Promise.all(ids.map(id => fetch(`/api/${id}`)));
```

### `Promise.all` where one rejection nukes the rest
**Smell**: `Promise.all` over partial-failure-tolerant operations.
**Fix**: `Promise.allSettled` and inspect each.

### `fetch` without `AbortController`
**Smell**: components unmount while fetch is in flight; setState fires on unmounted component.
**Fix**:
```ts
useEffect(() => {
  const ctrl = new AbortController();
  fetch(url, { signal: ctrl.signal }).then(setData).catch(e => {
    if (e.name !== 'AbortError') setError(e);
  });
  return () => ctrl.abort();
}, [url]);
```

### Forgetting to handle fetch errors
**Smell**: `fetch(url).then(r => r.json())` — `fetch` only rejects on network errors. HTTP 4xx/5xx returns a response with `ok: false`.
**Fix**: `if (!r.ok) throw new Error(...)`.

### Mutation of arguments
**Smell**: `function sortInPlace(arr) { arr.sort(); return arr; }` called on caller's data they didn't expect to mutate.
**Fix**: `[...arr].sort()` returns new array. Or be loud: `function mutateInPlace_arr(arr)`.

### `JSON.parse(JSON.stringify(x))` for cloning
**Smell**: legacy deep-clone idiom; loses Date, Map, Set, undefined.
**Fix**: `structuredClone(x)` (modern, supports more types).

### `Object.assign({}, a, b)` for spreading
**Smell**: pre-ES2018 idiom.
**Fix**: `{ ...a, ...b }`.

### String concat for URLs
**Smell**: `` `/api/users?id=${userId}&q=${q}` `` — encoding bugs, special characters break, security risks.
**Fix**: `URL` + `URLSearchParams`:
```ts
const u = new URL('/api/users', location.origin);
u.searchParams.set('id', userId);
u.searchParams.set('q', q);
```

### `==` for comparison
**Smell**: type coercion comparison. `'0' == 0`, `null == undefined` etc.
**Fix**: `===` always. Use lint to enforce.

---

## 8. CSS & styling

### `!important` outside utility/reset
**Why**: specificity wars start here.
**Fix**: increase normal specificity, or use cascade layers, or refactor the offending selector.

### Animating layout-affecting properties
**Smell**: `transition: width 200ms` — triggers reflow + repaint of every following element.
**Fix**: animate `transform` (scale) and `opacity` only. Compositor-only, no layout cost.

### Magic spacing numbers
**Smell**: `margin-top: 17px` next to `margin-bottom: 23px`.
**Fix**: design tokens (`--space-2`, `--space-3`) or Tailwind scale. Consistency is its own value.

### Specificity bumping (`.btn.btn.btn`)
**Smell**: a hack to override a more-specific selector.
**Fix**: cascade layers (`@layer utilities`), refactor the original, or use a proper utility approach.

### Untyped `style={{}}` props instead of CSS
**Smell**: `style={{ marginTop: dynamic }}` for things that should be classes / variables.
**Why**: per-element styles bypass the cascade, can't be themed, harder to debug.
**Fix**: CSS variables (`style={{ '--gap': dynamic }}`) consumed by stylesheet rules.

### Missing `@supports` for newer features on a project that supports old browsers
**Smell**: container queries / `:has()` used unconditionally; site silently broken on older Safari.
**Fix**: `@supports` block with a flexbox fallback.

### `width: 100vw` causing horizontal scroll
**Smell**: `vw` includes scrollbar width on most browsers.
**Fix**: `width: 100%` for normal blocks; `width: 100dvw` if you really want viewport width on modern browsers.

### `100vh` not accounting for mobile chrome
**Smell**: hero takes "the full screen" but URL bar shows/hides → layout jumps.
**Fix**: `100dvh` (dynamic; tracks the chrome) or `100svh` (smallest stable height).

### Nested selectors 5 levels deep (Sass)
**Smell**: `.a .b .c .d .e { ... }`
**Why**: high specificity, brittle, hard to refactor.
**Fix**: BEM-style flat selectors, or stop nesting beyond 2 levels.

### Forgetting `prefers-reduced-motion`
**Smell**: every animation runs unconditionally.
**Fix**:
```css
@media (prefers-reduced-motion: no-preference) {
  .thing { transition: transform .3s; }
}
```

---

## 9. HTML & accessibility

### Clickable `<div>` instead of `<button>`
**Why**: not keyboard-accessible, no native focus ring, no `aria` semantics, no Enter/Space handling.
**Fix**: `<button type="button">` (always specify `type` to avoid form-submit surprises).

### `<a>` without `href`
**Why**: not focusable, not navigable. Screen readers may skip.
**Fix**: `<button>` if it's an action; real `href` if it navigates.

### Form inputs without labels
**Smell**: `<input placeholder="Email" />` and nothing else.
**Why**: placeholder isn't a label. Accessibility tree has no name for the input.
**Fix**: `<label>Email <input /></label>` or `<label htmlFor="email">Email</label><input id="email" />`.

### `outline: none` without replacement
**Smell**: removing focus rings for "design reasons."
**Fix**: replace with a visible focus indicator. `:focus-visible { outline: 2px solid ...; outline-offset: 2px; }`.

### Color-only state indicators
**Smell**: red/green status with no text label.
**Fix**: add icon or text alongside color.

### Missing `alt` on images
**Smell**: `<img src="...">` no alt.
**Fix**: descriptive `alt` for content images, `alt=""` for decorative ones (still required, signals "no content").

### `target="_blank"` without `rel="noopener"`
**Why**: opened page can navigate the opener (`window.opener.location = ...`). Modern browsers fixed this by default but be explicit.
**Fix**: `rel="noopener noreferrer"`.

### Tab order broken by `tabindex={5}`
**Smell**: positive tabindex.
**Why**: forces a custom tab order; almost always wrong.
**Fix**: `tabindex={0}` to add to natural order, `tabindex={-1}` to remove. Never positive.

### Modal with no focus trap or escape handling
**Smell**: custom `<div>` modal; tab leaks to background page; escape doesn't close.
**Fix**: native `<dialog>` (free behavior) or a vetted dialog library (Radix, Headless UI).

### `aria-*` on elements that don't need it
**Smell**: `<button aria-label="Submit">Submit</button>` — duplicate name.
**Fix**: native semantics first; ARIA only when there's no native equivalent.

---

## 10. Performance — runtime & bundle

### Namespace import of large library
**Smell**: `import _ from 'lodash'` (ships all of lodash); `import * as date from 'date-fns'`.
**Fix**: named imports — `import { debounce } from 'lodash-es'`, `import { format } from 'date-fns'`. Tree shaking actually works.

### Date library duplication
**Smell**: `dayjs` and `date-fns` both in the bundle.
**Fix**: pick one. Modern: `Intl.DateTimeFormat` for formatting, `Temporal` (when available) for math.

### Polyfills shipped to modern browsers
**Smell**: core-js polyfilling things every modern browser has.
**Fix**: configure browserslist correctly, use `<script type="module">` (modern only) + nomodule fallback (legacy), or drop legacy support.

### Eager-loaded heavy widget
**Smell**: rich text editor / chart lib loaded on the homepage even though it's only used on `/edit`.
**Fix**: `next/dynamic({ ssr: false })` (Next) or `React.lazy` + Suspense (anywhere).

### Image without dimensions
**Smell**: `<img src="...">` with no `width`/`height` and no `aspect-ratio` CSS.
**Why**: CLS (Cumulative Layout Shift) — content reflows when image loads.
**Fix**: intrinsic dimensions OR `aspect-ratio` CSS.

### LCP image lazy-loaded
**Smell**: hero `<img loading="lazy">` or `<Image priority={false}>`.
**Why**: defers the most important paint.
**Fix**: `priority` (`next/image`) or `fetchpriority="high"` + no `loading="lazy"`.

### Web font loaded without `font-display`
**Smell**: invisible text for 3 seconds while font loads (FOIT).
**Fix**: `font-display: swap` (CSS) or `next/font` (auto-handles).

### Unbatched DOM reads/writes
**Smell**: loop that reads `getBoundingClientRect()` then writes `style.top` for each element → forced reflow per iteration.
**Fix**: batch all reads, then all writes. `requestAnimationFrame` to align with the frame.

### Scroll/resize/input event handler not throttled
**Smell**: `onScroll` handler fires 60+ times a second doing real work.
**Fix**: throttle (every N ms), debounce (after N ms idle), or use `IntersectionObserver`/`ResizeObserver` instead.

### Long task on main thread
**Smell**: 500ms parse/process during user interaction; INP sucks.
**Fix**: chunk the work (`requestIdleCallback` or `setTimeout(0)` between chunks), or move to a Web Worker.

### Bundle analyzer never run
**Smell**: nobody knows what's actually in the bundle.
**Fix**: run `@next/bundle-analyzer` / `vite-bundle-visualizer` before every release. Look for surprises.

---

## 11. Security smells

### `dangerouslySetInnerHTML` with unsanitized input
**Fix**: DOMPurify, or render structurally (e.g., react-markdown).

### `target="_blank"` without `rel="noopener"`
**Fix**: add `rel="noopener noreferrer"`.

### `href={userInput}` without protocol validation
**Smell**: user types `javascript:alert(1)` as their website URL.
**Fix**: validate protocol is `http:` / `https:` / `mailto:` before rendering.

### `Access-Control-Allow-Origin: *` with credentials
**Why**: browsers block this combo entirely; the API silently doesn't work for some users.
**Fix**: echo the specific allowed origin from a whitelist; `Vary: Origin`.

### Missing `Vary: Origin` on CORS responses
**Why**: CDN serves wrong origin's response to other origins.
**Fix**: add `Vary: Origin` whenever the response varies by origin.

### Server-only env var prefixed `NEXT_PUBLIC_`
**Why**: shipped to every browser. Visible to anyone who opens devtools.
**Fix**: rename, regenerate the secret (it's compromised), audit git history.

### Tokens in `localStorage`
**Why**: any script (XSS, ad, extension, supply-chain) can read.
**Fix**: `httpOnly` cookie (best for SSR) or in-memory + refresh token in cookie (for SPAs).

### CSP missing or trivial
**Smell**: `default-src *` or no CSP at all.
**Fix**: see `references/security.md` § 4.

### Server Action with no input validation
**Smell**:
```ts
export async function update(data: FormData) {
  await db.user.update({ where: { id: data.get('id') }, data: Object.fromEntries(data) });
}
```
**Fix**: Zod-validate, then update specific fields.

### Server Action that trusts a `userId` argument
**Smell**: `export async function deletePost(postId, userId) { ... }` with `userId` from the client.
**Fix**: read user from server-side session; ignore client-supplied identity.

### `target="_blank"` on user-generated links without filtering
**Smell**: comment system renders user-supplied URLs as `_blank` links → phishing vector.
**Fix**: validate URLs, optionally show through an interstitial, ensure `rel="noopener nofollow ugc"`.

### Open redirect parameter
**Smell**: `redirect_to=...` parameter passed straight to `Response.redirect`.
**Fix**: allowlist same-origin paths only. See `references/security.md` § 10.

### Unsigned webhook
**Smell**: `/api/webhook` accepts events without signature verification.
**Fix**: HMAC signature, timing-safe comparison, replay protection (nonce + timestamp).

---

## 12. Build, deps, and tooling

### No lockfile committed
**Why**: deploys can drift from local. Different team members install different versions.
**Fix**: commit `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock`.

### `npm install` in CI instead of `npm ci`
**Why**: `install` updates the lockfile when it can; `ci` enforces it.
**Fix**: `npm ci` (or `pnpm install --frozen-lockfile`, `yarn install --immutable`).

### Multiple package managers
**Smell**: `package-lock.json` AND `pnpm-lock.yaml` AND `yarn.lock` all present.
**Fix**: pick one, delete the others, document in README.

### `latest` or `^x.x.x` for security-sensitive packages
**Smell**: auto-updating to a new major across versions.
**Fix**: pin or use `~` for patch-only updates on security-sensitive packages. Use Renovate/Dependabot to PR updates with tests.

### Postinstall scripts allowed for unvetted deps
**Why**: `postinstall` can run arbitrary code at install time.
**Fix**: review new deps before adding. Consider `npm install --ignore-scripts` and approve scripts manually for known-needed deps.

### Source maps shipped to production
**Smell**: `dist/main.js.map` accessible at the public URL.
**Why**: leaks unminified code, sometimes server-side logic that snuck in.
**Fix**: don't deploy `.map` files (or upload them only to error-tracking service like Sentry).

### Dev-only deps in production bundle
**Smell**: storybook, msw, faker bundled into prod.
**Fix**: ensure they're in `devDependencies`. `NODE_ENV=production` gates with build tools that respect it.

---

## 13. Testing & error handling

### `try/catch` that swallows errors
**Smell**:
```ts
try { await foo(); } catch (e) { console.log(e); }
```
**Why**: error is logged in dev, invisible in prod, and the calling code thinks `foo()` succeeded.
**Fix**: rethrow if you can't recover, OR explicitly return a result type (`{ ok: false, error }`).

### Generic error messages to the user
**Smell**: "Something went wrong" — useless for the user, useless for support.
**Fix**: structured errors with codes, friendly messages mapped from codes, error IDs the user can quote in support tickets.

### Error boundaries missing
**Smell**: a single component error blanks the whole app.
**Fix**: error boundaries at meaningful segments (page, major section, third-party widget). Next App Router: `error.tsx`.

### Sentry / logging not catching server-side errors
**Smell**: only client-side errors are captured.
**Fix**: wire up server-side error reporting in Route Handlers, Server Actions, middleware. Each has its own error path.

### Not testing the error path
**Smell**: tests cover the happy path; the loading/error UI is never rendered.
**Fix**: tests that simulate fetch failures, validation errors, slow networks.

### Console errors shipped to production
**Smell**: dev-server console full of warnings, ignored.
**Why**: warnings often = real bugs; ignoring them = ignoring the bug.
**Fix**: treat warnings as errors in CI (`tsc --noEmit`, lint with `--max-warnings 0`, `--silent` rejection in test runner).

---

## How to use this document

When asked to review code:

1. **Skim the relevant sections** based on what the code is. Server Component data fetch? Sections 5, 7, 11. Form with state? Sections 1, 2, 3. Whole page? All of them.
2. **List findings briefly** before deep-diving. Group by severity: Bugs > Security > Performance > Style.
3. **Cite the section.** "This is the 'useEffect for derived state' smell from § 2 — extra renders + race risk." The user learns the taxonomy alongside the fix.
4. **Show the smallest fix** that addresses the issue. Don't rewrite the file.
5. **Note tradeoffs.** Some smells are smells with reasons — sometimes `useEffect` to sync IS the right answer because of an external system constraint. Be honest.
