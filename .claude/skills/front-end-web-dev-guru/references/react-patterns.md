# React Patterns Deep Reference

Patterns that hold up at scale. Read the section relevant to what you're building. For Next.js-specific React (Server Components, Server Actions, the rendering model), see `references/nextjs.md`. For perf-only concerns, see `references/performance.md`.

## Sections

1. [Component composition](#1-component-composition)
2. [Custom hooks](#2-custom-hooks)
3. [State management — picking the right tool](#3-state-management--picking-the-right-tool)
4. [Context — using it without re-render storms](#4-context--using-it-without-re-render-storms)
5. [Memoization — when it actually helps](#5-memoization--when-it-actually-helps)
6. [Suspense & Error Boundaries](#6-suspense--error-boundaries)
7. [Refs and imperative handles](#7-refs-and-imperative-handles)
8. [Concurrent features (`useTransition`, `useDeferredValue`)](#8-concurrent-features-usetransition-usedeferredvalue)
9. [Forms](#9-forms)
10. [`use(promise)` — the new primitive](#10-usepromise--the-new-primitive)

---

## 1. Component composition

The most under-used pattern: pass JSX **into** a component instead of configuring it via props. Composition beats prop explosion almost every time.

### Configuration vs. composition

```tsx
// ❌ Configuration — the props will keep growing
<Card
  title="Hello"
  subtitle="..."
  showAvatar
  avatarSrc="..."
  showAction
  actionLabel="Save"
  onAction={...}
  variant="raised"
  trailingIcon={<Bell />}
/>

// ✅ Composition — the consumer composes what they need
<Card variant="raised">
  <Card.Header>
    <Avatar src="..." />
    <div><h3>Hello</h3><p>...</p></div>
  </Card.Header>
  <Card.Footer>
    <button onClick={...}>Save</button>
  </Card.Footer>
</Card>
```

### Compound components

Components that share implicit state via context, exposed as a namespace:

```tsx
const TabsContext = createContext<{ active: string; setActive: (s: string) => void } | null>(null);

export function Tabs({ defaultValue, children }) {
  const [active, setActive] = useState(defaultValue);
  return <TabsContext.Provider value={{ active, setActive }}>{children}</TabsContext.Provider>;
}

Tabs.List = function List({ children }) {
  return <div role="tablist">{children}</div>;
};

Tabs.Trigger = function Trigger({ value, children }) {
  const ctx = useContext(TabsContext)!;
  return (
    <button role="tab" aria-selected={ctx.active === value} onClick={() => ctx.setActive(value)}>
      {children}
    </button>
  );
};

Tabs.Panel = function Panel({ value, children }) {
  const ctx = useContext(TabsContext)!;
  return ctx.active === value ? <div role="tabpanel">{children}</div> : null;
};

// Usage:
<Tabs defaultValue="a">
  <Tabs.List>
    <Tabs.Trigger value="a">A</Tabs.Trigger>
    <Tabs.Trigger value="b">B</Tabs.Trigger>
  </Tabs.List>
  <Tabs.Panel value="a">Content A</Tabs.Panel>
  <Tabs.Panel value="b">Content B</Tabs.Panel>
</Tabs>
```

The consumer controls structure; the components share state. Used by Radix, Headless UI, every modern UI lib.

### Render props (still useful)

```tsx
function MousePosition({ children }: { children: (pos: { x: number; y: number }) => React.ReactNode }) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  useEffect(() => {
    const onMove = (e: MouseEvent) => setPos({ x: e.clientX, y: e.clientY });
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);
  return <>{children(pos)}</>;
}

<MousePosition>{({ x, y }) => <div>{x}, {y}</div>}</MousePosition>
```

Modern alternative: a custom hook (`useMousePosition`) is usually cleaner. Render props earn their keep when you need to **control where** the rendered output goes, not just compute a value.

### `children` as the escape hatch

The `children` prop accepts anything. Pass arrays, fragments, single elements, render functions, plain text. Most "I need to pass X to Y" problems dissolve into "let the consumer pass children."

### Slot pattern (delegated rendering)

Instead of `<Button startIcon={...}>`, accept any element and merge props:

```tsx
import { Slot } from '@radix-ui/react-slot';

function Button({ asChild = false, ...props }: { asChild?: boolean } & React.ComponentProps<'button'>) {
  const Comp = asChild ? Slot : 'button';
  return <Comp {...props} />;
}

// Usage: render as <a> with all button styling
<Button asChild><a href="/foo">Click</a></Button>
```

This is the "polymorphic component" pattern done right. Avoids the `as` prop's TypeScript pain.

### Don't pass JSX through `useState`

```tsx
// ❌ Stale JSX held in state
const [error, setError] = useState<React.ReactNode>(null);
setError(<div>Oh no, {someValue}</div>);   // captured someValue at the time of setError
```

State should hold data; render derives JSX.

```tsx
// ✅
const [error, setError] = useState<string | null>(null);
return error && <div>Oh no, {error}</div>;
```

---

## 2. Custom hooks

The naming convention is law: hooks start with `use`. ESLint's `react-hooks/rules-of-hooks` relies on it.

### When to extract

Extract a custom hook when:
- The same logic appears in multiple components.
- A component has 3+ related effects/state pieces that conceptually belong together.
- You want to test the logic in isolation.

Don't extract just because a component has multiple hooks — that's normal.

### Shape: return what's used, not the kitchen sink

```tsx
// ❌ Returns 8 things, callers destructure 2
function useSomething() {
  return { a, b, c, d, e, f, g, h };
}

// ✅ Returns only what callers need
function useSomething() {
  return [value, update] as const;   // tuple — like useState
}
// OR
function useSomething() {
  return { value, update };          // object — when there are 3+ items
}
```

Tuple for 1-2 returns (matches `useState`). Object for 3+. `as const` keeps the tuple's literal types.

### Stable identity (same trap as useEffect)

```tsx
// ❌ Returns a new object every render
function useThing() {
  return { value: 1, doThing: () => {} };
}
// Caller: useEffect(() => {}, [thing]); — runs every render

// ✅ Memoize the returned shape
function useThing() {
  const doThing = useCallback(() => {}, []);
  return useMemo(() => ({ value: 1, doThing }), [doThing]);
}
```

Even better: return primitives. `useState`'s setter is stable; emulate that.

### Common useful hooks

```tsx
// useEventCallback — stable function identity, always-fresh closure
function useEventCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref = useRef(fn);
  useEffect(() => { ref.current = fn; });
  return useCallback(((...args) => ref.current(...args)) as T, []);
}

// useIsomorphicLayoutEffect — useLayoutEffect on client, useEffect on server
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// useMediaQuery
function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setMatches(m.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

// useDebouncedValue
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
```

`useEventCallback` is the cleanest way to get a stable callback that always sees the latest state — useful for callbacks passed to children that you don't want to re-run effects on.

---

## 3. State management — picking the right tool

A flowchart that fits in your head:

```
The value is...
├── ...derivable from props/other state           → derive (no state)
├── ...the URL (filters, page, tab, sort)         → search params
├── ...form input being typed                     → React Hook Form (uncontrolled) or local useState
├── ...server data (lists, detail, user)
│   ├── ...rendered server-side                   → Server Component fetch + cache
│   └── ...rendered client-side                   → TanStack Query / SWR
├── ...UI state used by 1-2 components            → useState in the closest common parent
├── ...UI state across the app, infrequent        → React Context (split contexts!)
├── ...UI state across the app, frequent          → Zustand or Jotai
└── ...complex state machine                      → XState
```

**You don't need Redux.** A modern app is: server state in Query/Server Components + URL state in search params + UI state in `useState`/`Zustand`. Redux Toolkit fits niche cases (very large, deeply-shared client state with many related transitions).

### Server state vs. client state

Conflating these is the #1 architectural mistake.

- **Server state**: lists of users, the current user, settings. Origin: a server. Should be cached, deduped, refetched in background, invalidated on mutation. Tools: Server Components + cache, TanStack Query, SWR, Apollo (GraphQL).
- **Client state**: theme, modal open/closed, draft form input. Origin: the user's interactions. Tools: `useState`, Context, Zustand, Jotai.

If you put server state in `useState` and `useEffect`-fetch it, you've reinvented a worse cache.

### Search params as URL state

```tsx
'use client';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function FilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const setFilter = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    router.replace(`${pathname}?${next}`, { scroll: false });
  };
  // ...
}
```

URL state is shareable, bookmarkable, and survives reload. For filters, page numbers, sort orders, tabs — make them URL state.

### Zustand — the minimalist client store

```tsx
import { create } from 'zustand';

interface UIStore {
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  theme: 'light' | 'dark';
  setTheme: (t: 'light' | 'dark') => void;
}

export const useUIStore = create<UIStore>((set) => ({
  sidebarOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  theme: 'light',
  setTheme: (theme) => set({ theme }),
}));

// Usage with selector — only re-renders when `theme` changes
const theme = useUIStore((s) => s.theme);
```

The selector pattern is the win. Reading the whole store causes a re-render on any change; reading a slice subscribes only to that slice.

### Jotai — atomic state

```tsx
import { atom, useAtom } from 'jotai';

const themeAtom = atom<'light' | 'dark'>('light');
const userAtom = atom<User | null>(null);

// Derived atom
const greetingAtom = atom((get) => {
  const u = get(userAtom);
  return u ? `Hi, ${u.name}` : 'Hi';
});

const [theme, setTheme] = useAtom(themeAtom);
```

Each atom is independent. Derived atoms re-compute only when their deps change. Good fit when state is naturally composable.

---

## 4. Context — using it without re-render storms

Context is fine. The `Provider` value is what causes re-renders, not Context itself. Two rules.

### Rule 1: Memoize the value

```tsx
// ❌ New object every render → all consumers re-render every render
<UserContext.Provider value={{ user, login, logout }}>

// ✅ Stable identity unless deps change
const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
<UserContext.Provider value={value}>
```

### Rule 2: Split contexts when fields change at different rates

```tsx
// ❌ One context — every theme change re-renders user consumers and vice versa
<AppContext.Provider value={{ user, theme, settings }}>

// ✅ Separate contexts — consumers subscribe to what they actually use
<UserContext.Provider value={user}>
  <ThemeContext.Provider value={theme}>
    <SettingsContext.Provider value={settings}>
      ...
```

Or **state-and-dispatch split**:

```tsx
// State changes often; dispatch is stable
<StateContext.Provider value={state}>
  <DispatchContext.Provider value={dispatch}>
```

A component that only fires actions (e.g., a button) consumes Dispatch only and never re-renders on state changes.

### Selector pattern via `use-context-selector`

If you genuinely need a single big context for ergonomic reasons (e.g., theme), use `use-context-selector` so consumers subscribe to slices:

```tsx
const useTheme = () => useContextSelector(AppContext, c => c.theme);
```

But by then, Zustand is usually a better answer.

---

## 5. Memoization — when it actually helps

The default in React is: **don't memoize**. The runtime is fast. Premature memoization adds dependency-array overhead and complexity for no gain.

### Decision

```
Memoize this value/callback when:
  1. It's a dep of useEffect/useMemo/useCallback below it,
     and re-creating it breaks downstream memoization, OR
  2. It crosses a React.memo boundary (the child IS memoized), OR
  3. The computation itself is expensive (>1ms) AND runs on most renders.

Otherwise: don't.
```

### `React.memo` is contagious — and conditional

```tsx
const Child = React.memo(function Child({ data, onClick }: Props) { ... });

// Useless — onClick is a new identity every render
<Child data={data} onClick={() => doStuff()} />

// Useful — onClick is stable
const stableHandler = useCallback(() => doStuff(), []);
<Child data={data} onClick={stableHandler} />
```

`React.memo` only helps if **all** props compared shallow-equal. One unstable prop nullifies it.

### Cheap `useMemo` is anti-optimization

```tsx
// ❌ The dep comparison costs more than `a + b`
const sum = useMemo(() => a + b, [a, b]);

// ✅ Just compute it
const sum = a + b;
```

`useMemo` has overhead: ref allocation, dep-array shallow-compare. Worth it for `parseLargeJSON()`, `heavyDateMath()`, `O(n²)` operations. Not worth it for arithmetic, string concat, simple filters on tiny arrays.

### React Compiler

React 19's compiler (Forget) auto-memoizes everything optimally. If you're using it and trust it, you can mostly stop hand-writing `useMemo`/`useCallback`. Verify it's enabled, watch the bundle.

---

## 6. Suspense & Error Boundaries

The two boundaries that turn async UIs from event-loop spaghetti into declarative trees.

### Suspense

```tsx
<Suspense fallback={<Skeleton />}>
  <ComponentThatReads /> {/* throws a Promise while loading */}
</Suspense>
```

What can suspend:
- A component that calls `use(promise)` (React 19+).
- A `lazy(() => import(...))` boundary while the chunk loads.
- A Server Component awaiting data (Next.js).
- A library that integrates with Suspense (TanStack Query, SWR, Relay, Apollo with `useSuspenseQuery`).

### Boundary placement

Place the boundary where the loading state should appear:

```tsx
// Page-level (one big skeleton for the whole page)
<Suspense fallback={<PageSkeleton />}>
  <Dashboard />
</Suspense>

// Granular — independent loading states
<Header />
<Suspense fallback={<AnalyticsSkeleton />}><Analytics /></Suspense>
<Suspense fallback={<FeedSkeleton />}><Feed /></Suspense>
```

Granular boundaries enable streaming SSR — fast parts render first, slow parts stream in.

### Error Boundaries

Suspense catches "loading"; Error Boundaries catch "broken." React only ships a class-based primitive — but `react-error-boundary` is the de-facto standard wrapper.

```tsx
import { ErrorBoundary } from 'react-error-boundary';

<ErrorBoundary
  fallback={<ErrorScreen />}
  onError={(err, info) => logError(err, info)}
  onReset={() => /* reset state */}
>
  <App />
</ErrorBoundary>
```

In Next.js App Router: `error.tsx` in any route segment is an error boundary for that segment. Always put a `'use client'` at the top — required.

### Error boundaries don't catch:
- Async errors (rejected Promises that aren't bound to render).
- Event handler errors.
- Errors during SSR (separate path).
- Errors in the boundary itself.

For event handlers, wrap with try/catch and call `setState`/show toast. For async, surface errors to the rendering path (e.g., make the error a state field that throws on read).

### Suspense + Error Boundary pattern

```tsx
<ErrorBoundary fallback={<Err />}>
  <Suspense fallback={<Loading />}>
    <ResourceComponent />
  </Suspense>
</ErrorBoundary>
```

Three states (loading / loaded / error) handled declaratively, no flags.

---

## 7. Refs and imperative handles

`useRef` for two things: holding a DOM node, or holding a mutable value that doesn't need to trigger re-renders.

### DOM ref

```tsx
function Input() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return <input ref={ref} />;
}
```

### Mutable value (alternative to state when you don't render based on it)

```tsx
function ThrottledClick() {
  const lastClick = useRef(0);
  const onClick = () => {
    if (Date.now() - lastClick.current < 500) return;
    lastClick.current = Date.now();
    // do thing
  };
}
```

`useRef`'s `.current` change does NOT trigger re-render. `useState` always does.

### `forwardRef` (still relevant in React <19)

```tsx
const Input = forwardRef<HTMLInputElement, React.ComponentProps<'input'>>(
  function Input(props, ref) {
    return <input ref={ref} {...props} />;
  },
);
```

In **React 19+**, you can pass `ref` as a regular prop on function components — `forwardRef` is no longer needed.

### `useImperativeHandle` — escape hatch for imperative APIs

When a parent needs to call methods on a child (focus, play, scrollTo), expose a controlled interface:

```tsx
type AudioPlayerHandle = { play: () => void; pause: () => void };

const AudioPlayer = forwardRef<AudioPlayerHandle>(function AudioPlayer(_, ref) {
  const audio = useRef<HTMLAudioElement>(null);
  useImperativeHandle(ref, () => ({
    play: () => audio.current?.play(),
    pause: () => audio.current?.pause(),
  }), []);
  return <audio ref={audio} src="..." />;
});

// Parent:
const playerRef = useRef<AudioPlayerHandle>(null);
playerRef.current?.play();
```

Use sparingly — declarative props are usually cleaner. Imperative handles fit when integrating with non-React imperative APIs (video players, animations, drag systems).

### Callback refs for measuring

```tsx
function Measured() {
  const [width, setWidth] = useState(0);
  const ref = useCallback((node: HTMLDivElement | null) => {
    if (!node) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(node);
    // No way to clean up in this pattern — see below
  }, []);
  return <div ref={ref}>...</div>;
}
```

Cleaner with React 19's ref-cleanup pattern (return cleanup from ref callback) — supported in modern React.

---

## 8. Concurrent features (`useTransition`, `useDeferredValue`)

These split state updates into urgent (user input) and non-urgent (the expensive consequence). The urgent part stays responsive; the non-urgent part can lag without blocking it.

### `useTransition` — mark an update as non-urgent

```tsx
function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [isPending, startTransition] = useTransition();

  return (
    <input
      value={query}
      onChange={(e) => {
        setQuery(e.target.value);                          // urgent — input stays in sync
        startTransition(() => {                            // non-urgent — can be interrupted
          setResults(expensiveFilter(e.target.value));
        });
      }}
    />
  );
}
```

If the user types fast, React abandons in-progress transition renders for newer ones. The input stays at 60fps.

### `useDeferredValue` — derive a "lagged" value

```tsx
function Search({ query }: { query: string }) {
  const deferred = useDeferredValue(query);
  const isStale = query !== deferred;
  const results = useMemo(() => expensiveFilter(deferred), [deferred]);
  return (
    <div style={{ opacity: isStale ? 0.5 : 1 }}>
      <Results items={results} />
    </div>
  );
}
```

`useDeferredValue` is the receiver-side version of `useTransition`. The producer doesn't know about it.

### Which to use

- **`useTransition`**: you control the update site (`onChange`, button click). Wrap the expensive set.
- **`useDeferredValue`**: the prop comes from outside, you can't wrap its setter. Lag the prop locally.

---

## 9. Forms

### React Hook Form is the floor

For anything beyond a 2-field form. Uncontrolled inputs (no per-keystroke re-render), built-in validation, integrates with Zod.

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});
type FormData = z.infer<typeof schema>;

function LoginForm() {
  const { register, handleSubmit, formState: { errors, isSubmitting } } =
    useForm<FormData>({ resolver: zodResolver(schema) });

  return (
    <form onSubmit={handleSubmit(async (data) => { await login(data); })}>
      <input {...register('email')} />
      {errors.email && <p>{errors.email.message}</p>}
      <input type="password" {...register('password')} />
      {errors.password && <p>{errors.password.message}</p>}
      <button disabled={isSubmitting}>Sign in</button>
    </form>
  );
}
```

### With Server Actions (Next.js)

`useActionState` + RHF + Zod — see `references/nextjs.md` § 6.

### Native form validation (small forms)

```tsx
<form onSubmit={(e) => { e.preventDefault(); /* ... */ }}>
  <input type="email" required minLength={3} />
  <input type="password" required minLength={8} />
  <button>Submit</button>
</form>
```

The browser validates before `onSubmit`. Style invalid states with `:invalid` and `:user-invalid` (only after interaction). For richer needs: RHF + Zod.

---

## 10. `use(promise)` — the new primitive

React 19's `use` is the first hook that can be called conditionally and inside loops. It unwraps a Promise (suspending) or reads Context.

### Reading a Promise in a Client Component

```tsx
'use client';
import { use } from 'react';

export function ClientReader({ promise }: { promise: Promise<Data> }) {
  const data = use(promise);            // suspends until resolved
  return <div>{data.title}</div>;
}
```

Pair with a Server Component starting the fetch:

```tsx
// Server Component
export default function Page() {
  const dataPromise = fetchData();      // do NOT await
  return (
    <Suspense fallback={<Skeleton />}>
      <ClientReader promise={dataPromise} />
    </Suspense>
  );
}
```

The data starts loading on the server, the page streams immediately, the Client Component suspends until the promise resolves on the client. **Best of both worlds**: server-initiated fetches + client interactivity.

### Reading Context conditionally

```tsx
function Maybe({ when, children }: { when: boolean; children: React.ReactNode }) {
  if (!when) return null;
  const theme = use(ThemeContext);     // ✅ would be illegal with useContext
  return <div className={theme}>{children}</div>;
}
```

### Pair with the cache: avoid waterfalls

```tsx
// Server Component
import { cache } from 'react';
const getUser = cache(async (id: string) => db.user.findUnique({ where: { id } }));

export default async function Page() {
  const userPromise = getUser('123');         // started immediately
  return (
    <>
      <Suspense fallback={<HeaderSkeleton />}>
        <Header userPromise={userPromise} />
      </Suspense>
      <Suspense fallback={<BodySkeleton />}>
        <Body userPromise={userPromise} />    {/* deduped via cache() */}
      </Suspense>
    </>
  );
}
```
