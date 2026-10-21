# Performance Deep Reference

The actual measurable goals: LCP < 2.5s, INP < 200ms, CLS < 0.1, on a throttled mid-tier device (Moto G Power-class) over Slow 4G. Lab tests on a MacBook lie. Use Chrome DevTools "Performance" tab with CPU 4× slowdown + Slow 4G throttling, OR field data via Vercel Speed Insights / `web-vitals` library.

## Sections

1. [Core Web Vitals — what each measures, what moves it](#1-core-web-vitals--what-each-measures-what-moves-it)
2. [Image optimization](#2-image-optimization)
3. [Font optimization](#3-font-optimization)
4. [Code splitting strategies](#4-code-splitting-strategies)
5. [Resource hints](#5-resource-hints)
6. [Caching at the edge](#6-caching-at-the-edge)
7. [Runtime performance — long tasks & main thread](#7-runtime-performance--long-tasks--main-thread)
8. [Hydration cost](#8-hydration-cost)
9. [Web Workers](#9-web-workers)
10. [Bundle analysis workflow](#10-bundle-analysis-workflow)

---

## 1. Core Web Vitals — what each measures, what moves it

### LCP (Largest Contentful Paint) — visual loading

The render time of the largest visible element (image, video poster, large text block) within the viewport, relative to navigation start. Goal: **< 2.5s**.

**What moves it (in order of common impact):**
1. **Slow server response** (TTFB > 600ms). Fix: edge runtime, CDN, caching, reduce origin work.
2. **Render-blocking resources**. Fix: inline critical CSS, defer non-critical, async/defer scripts.
3. **The LCP image is slow to load** (lazy-loaded, low priority, large file). Fix: `priority` + `fetchpriority="high"`, don't `loading="lazy"`, modern format (AVIF/WebP), correct dimensions.
4. **Client-side rendering** the LCP element. Fix: SSR or pre-rendering.

**Diagnose**: Lighthouse "Largest Contentful Paint element" lists which element it is. Then check that element's network entry — when does it start fetching?

### INP (Interaction to Next Paint) — responsiveness

Measures how quickly the page responds to user interactions (click, tap, key press). The 75th percentile across all interactions in the session. Replaced FID in 2024. Goal: **< 200ms**.

**What moves it:**
1. **Long tasks blocking the main thread** during interaction. Fix: break up tasks (`scheduler.yield()`, chunking), move work to Web Workers.
2. **Heavy event handler synchronous work**. Fix: `useTransition` for non-urgent updates, debounce expensive handlers.
3. **Hydration during interaction**. Fix: prioritize critical interactive bits, defer the rest.

**Diagnose**: Chrome DevTools Performance tab → Interactions track. Each interaction shows input delay, processing time, presentation delay.

### CLS (Cumulative Layout Shift) — visual stability

Sum of all unexpected layout shifts during the lifetime of the page. Goal: **< 0.1**.

**What moves it:**
1. **Images without dimensions** that load and push content down. Fix: `width`/`height` attributes (creates intrinsic aspect ratio) or `aspect-ratio` CSS.
2. **Web fonts loading and changing line heights**. Fix: `font-display: optional` or `font-display: swap` with size-adjusted fallback (`size-adjust`, `ascent-override`).
3. **Late-loaded ads or embeds** without reserved space. Fix: reserve `min-height` for the slot.
4. **Animations that affect layout** (animating `height`, `top`, etc.). Fix: animate `transform`/`opacity`.
5. **Dynamic content injected above existing content** (banners, alerts after first paint). Fix: reserve space, or inject below.

User-initiated shifts (within 500ms of input) don't count. Only **unexpected** shifts.

### Other useful metrics

- **TTFB (Time to First Byte)**: < 800ms. Server response speed.
- **FCP (First Contentful Paint)**: < 1.8s. When the first content renders.
- **TBT (Total Blocking Time)**: < 200ms. Lab proxy for INP.

---

## 2. Image optimization

Images are usually 50%+ of page weight. Fix here first.

### Format

```
AVIF  (best compression, ~50% smaller than JPEG, slower encode)
  ↓ fallback
WebP  (good compression, universal modern support)
  ↓ fallback
JPEG  (universal)
```

```html
<picture>
  <source srcSet="/img.avif" type="image/avif" />
  <source srcSet="/img.webp" type="image/webp" />
  <img src="/img.jpg" alt="..." width="800" height="600" loading="lazy" decoding="async" />
</picture>
```

### Responsive images

```html
<img
  src="/img-800.jpg"
  srcSet="/img-400.jpg 400w, /img-800.jpg 800w, /img-1600.jpg 1600w"
  sizes="(max-width: 600px) 100vw, 800px"
  alt="..."
  width="800"
  height="600"
/>
```

The browser picks the smallest source matching the layout. **`sizes` is critical** — without it, browsers assume 100vw.

### `next/image` does this automatically

```tsx
import Image from 'next/image';

<Image
  src="/img.jpg"
  alt="..."
  width={800}
  height={600}
  sizes="(max-width: 600px) 100vw, 800px"
  priority      // for the LCP image only
/>
```

`next/image` handles format negotiation, srcSet generation, lazy loading by default, blur placeholder. Configure `images.remotePatterns` in `next.config.js` for external sources (security).

### Critical attributes

| Attribute | Purpose |
|---|---|
| `width` / `height` | CLS prevention (intrinsic aspect ratio) |
| `loading="lazy"` | Defer below-fold images. **Never** on the LCP image. |
| `decoding="async"` | Decode off the main thread |
| `fetchpriority="high"` | LCP image, hero images |
| `fetchpriority="low"` | Below-fold non-essential images |
| `sizes` | Browser picks the right srcSet entry |

### Dimensions math

If your image is rendered at 400×300 CSS pixels, ship a 400×300 image (1×) and an 800×600 (2×). On a 1× display, the 1× wins; on 2×, the 2×. Don't ship a 4000×3000 image.

### Don't blow up SVGs

Inline SVGs are great for icons. But SVGs with thousands of paths (a complex chart) are heavier than a PNG/AVIF render of the same chart. Render to raster for complex visuals.

---

## 3. Font optimization

The default web-font setup is bad: invisible text → swap to web font → reflow. This is FOIT or FOUT, both ugly.

### `next/font` does the right thing

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'], display: 'swap' });

export default function RootLayout({ children }) {
  return <html className={inter.className}><body>{children}</body></html>;
}
```

What it does:
- Self-hosts the font (no third-party request, no privacy issue, no CLS from external CDN).
- Subsets to only the characters needed.
- `font-display: swap` — system font shows immediately, swaps to web font when ready.
- Auto-generates fallback metrics — sets `size-adjust`, `ascent-override`, `descent-override`, `line-gap-override` so the fallback font occupies similar space → minimal CLS on swap.

### Manual approach

```css
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter.woff2') format('woff2');
  font-display: swap;
  font-weight: 400 700;       /* variable font range */
  size-adjust: 100%;          /* match fallback metrics */
  ascent-override: 90%;
  descent-override: 22%;
  line-gap-override: 0%;
}

/* Generate metrics with: https://github.com/khaledgarbaya/font-fallback-metrics */
```

### Variable fonts

One file with a continuous range of weights/styles, instead of separate files per weight. Smaller total payload, more design flexibility.

### Preload the LCP font

```html
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin />
```

Tells the browser to fetch the font during HTML parse, before CSS even loads. Use only for fonts that affect the LCP.

### `font-display` strategies

- `swap` — show fallback immediately, swap when font loads. Best UX trade-off in most cases.
- `optional` — show fallback; swap to web font ONLY if it's already cached / loads in ~100ms. Best for CLS.
- `fallback` — like `optional` but with a brief invisible window first. Niche.
- `block` (default) — invisible text for ~3s, then swap. Almost always wrong.

---

## 4. Code splitting strategies

Don't ship every line of every component on every page. Code split by:

### 1. Route boundaries (free in modern frameworks)

Next.js App Router, React Router data routers, Remix — all split by route automatically. No config needed.

### 2. Heavy interactive widgets

```tsx
// React: lazy import + Suspense
const Editor = lazy(() => import('./Editor'));

<Suspense fallback={<Skeleton />}>
  <Editor />
</Suspense>

// Next.js: dynamic with no SSR for client-only widgets
import dynamic from 'next/dynamic';
const Map = dynamic(() => import('./Map'), { ssr: false, loading: () => <Skeleton /> });
```

Good candidates: rich text editors, charts, maps, video players, drag-and-drop systems, color pickers.

### 3. Modal content

Modal components rendered conditionally — but the import is eager. Lazy-import them so the bundle for modal content doesn't ship until first open.

### 4. Tab content

Same logic as modals. Tab 2 and 3's components are lazy.

### 5. Polyfills

Don't ship to modern browsers. Use module/nomodule:

```html
<script type="module" src="/main.js"></script>
<script nomodule src="/main-legacy.js"></script>
```

Modern browsers run the module; legacy ones run the polyfilled version.

### Anti-patterns

- **Splitting too granularly**. Each chunk has overhead (HTTP request, parse cost). For tiny components, just inline.
- **Splitting in render**. `lazy(() => import('...'))` should be at module scope, not inside a component.
- **Forgetting Suspense**. Without it, lazy imports throw during render.
- **Not preloading**. If you know a route is likely next, `<link rel="prefetch">` it (Next's `Link` does this automatically).

---

## 5. Resource hints

Tell the browser what to load early.

```html
<!-- DNS resolution + TCP + TLS for cross-origin domain you'll soon hit -->
<link rel="preconnect" href="https://api.example.com" crossorigin />

<!-- DNS only — cheaper than preconnect, less benefit -->
<link rel="dns-prefetch" href="https://cdn.example.com" />

<!-- Fetch a critical resource for THIS page during HTML parse -->
<link rel="preload" href="/hero.avif" as="image" fetchpriority="high" />
<link rel="preload" href="/fonts/inter.woff2" as="font" type="font/woff2" crossorigin />

<!-- Fetch a resource for the NEXT navigation -->
<link rel="prefetch" href="/dashboard" />

<!-- Modules — preload an ES module + its imports -->
<link rel="modulepreload" href="/chunk.js" />
```

### When each helps

- **`preconnect`**: 100-500ms savings if you're about to make a cross-origin request. Use sparingly (3-4 max — each connection has cost).
- **`preload`**: high-impact for the LCP image, critical web fonts. Don't `preload` everything — you'll just delay other resources.
- **`prefetch`**: for the likely next page. Background priority. Cancelable.

### Don't over-hint

`preload` everything → the browser can't prioritize → nothing loads fast. Pick 1-3 critical resources per page.

### Speculation Rules API (newer)

```html
<script type="speculationrules">
{
  "prerender": [{
    "where": { "href_matches": "/products/*" },
    "eagerness": "moderate"
  }]
}
</script>
```

Browser pre-renders the next page (full DOM, JS executed). Way more powerful than `prefetch`. Chromium-only as of writing.

---

## 6. Caching at the edge

For static and ISR content, the CDN is your performance moat.

### Cache-Control header semantics

```
Cache-Control: public, max-age=31536000, immutable
```
Ship asset with a content hash in the URL (`/assets/main.a1b2c3.js`), set a 1-year `max-age`, mark `immutable`. The browser never revalidates.

```
Cache-Control: public, max-age=0, s-maxage=600, stale-while-revalidate=86400
```
Browser doesn't cache (always revalidates). CDN caches for 600s. After 600s, CDN serves stale content (up to 24h old) while it revalidates in the background. Used by ISR.

```
Cache-Control: private, no-cache
```
Authenticated content. CDN must not cache; browser revalidates each time.

### Vercel / CDN tiers

- **Static assets** (`/_next/static/*`): immutable, 1-year. Hashed filenames.
- **Static pages**: cached at the edge until invalidated.
- **ISR pages**: served from edge cache, revalidated in background.
- **Dynamic pages**: served by the origin, optionally cached based on response headers.
- **API routes**: usually `no-store`, cached only when explicitly OK'd.

### Stale-while-revalidate is magic

```
Cache-Control: max-age=60, stale-while-revalidate=86400
```

For 60s: serve cached. After 60s: serve cached AND start a background fetch. Next request after the new fetch lands gets the fresh data. Users never wait. Only the first user after invalidation might see slightly stale.

---

## 7. Runtime performance — long tasks & main thread

A **long task** is any task >50ms on the main thread. Long tasks block input, animation, scrolling.

### Identifying long tasks

```ts
// in dev or via real-user monitoring
const observer = new PerformanceObserver((list) => {
  for (const entry of list.getEntries()) {
    if (entry.duration > 50) console.warn('Long task:', entry);
  }
});
observer.observe({ entryTypes: ['longtask'] });
```

### Breaking up long tasks

```ts
// ❌ Synchronous loop blocks the thread for 200ms
function processAll(items) {
  for (const item of items) heavyWork(item);
}

// ✅ Yield to the browser between chunks
async function processAllChunked(items) {
  for (const item of items) {
    heavyWork(item);
    await scheduler.yield();    // Chrome 129+
    // Fallback for older browsers:
    // await new Promise(r => setTimeout(r, 0));
  }
}
```

`scheduler.yield()` lets the browser process input/animation between iterations. Falls back to `setTimeout(0)` in older browsers.

### React: `useTransition` to mark work non-urgent

See `references/react-patterns.md` § 8.

### `requestIdleCallback` for low-priority work

```ts
requestIdleCallback(
  (deadline) => {
    while (deadline.timeRemaining() > 0 && queue.length) {
      processOne(queue.shift());
    }
  },
  { timeout: 2000 },     // run within 2s even if no idle time
);
```

Good for analytics, prefetching, background indexing.

### Avoid forced reflow

Reading layout (`offsetWidth`, `getBoundingClientRect`, `getComputedStyle`) forces the browser to compute layout. Doing it after a write forces a synchronous reflow:

```ts
// ❌ Each iteration forces reflow
for (const el of elements) {
  el.style.width = el.offsetWidth + 10 + 'px';     // read after write
}

// ✅ Batch reads, then writes
const widths = elements.map(el => el.offsetWidth);
elements.forEach((el, i) => { el.style.width = widths[i] + 10 + 'px'; });
```

`requestAnimationFrame` aligns work with the next paint.

### Throttle scroll, resize, mousemove

Or better: use `IntersectionObserver`/`ResizeObserver` instead.

```ts
// ❌ Fires hundreds of times per second
window.addEventListener('scroll', () => updateUI());

// ✅ Observe, don't poll
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) loadMore();
});
io.observe(sentinel);
```

---

## 8. Hydration cost

Hydration is the process where SSR'd HTML becomes interactive. The client downloads JS, parses it, walks the DOM, attaches event listeners, runs effects. **It's expensive.**

### Reduce hydration cost

1. **Server Components** (Next.js App Router): they don't hydrate at all. Only Client Components ship JS.
2. **`'use client'` boundaries pushed down**: the smallest possible client tree.
3. **`next/dynamic({ ssr: false })`** for client-only widgets: the server doesn't render them, and they hydrate after page interaction.
4. **Avoid large props serialized to client**: every prop crossing the Server→Client boundary gets serialized into the HTML payload AND included in the JS bundle.
5. **Streaming SSR with Suspense**: parts of the page hydrate independently as their HTML arrives.

### React 18 selective hydration

If `<Suspense>` boundaries exist, React hydrates each independently. Click on a not-yet-hydrated section → React prioritizes hydrating that section first. Free with App Router.

### Hydration mismatches kill perf

A mismatch causes React to throw away the server HTML and re-render client-side. Massive cost. Common causes:
- `Date.now()`, `Math.random()`, locale-formatted dates.
- Reading `localStorage` / `window` during initial render.
- HTML structure changing based on user agent.

Fix: render a stable shell, branch in `useEffect`. Or `suppressHydrationWarning` (last resort, only on the affected element).

---

## 9. Web Workers

Move heavy CPU work off the main thread. The worker has its own thread, communicates via `postMessage`.

### Basic worker

```ts
// worker.ts
self.onmessage = (e) => {
  const result = heavyWork(e.data);
  self.postMessage(result);
};

// main.ts
const worker = new Worker(new URL('./worker.ts', import.meta.url));
worker.postMessage(input);
worker.onmessage = (e) => console.log('Got:', e.data);
```

Vite supports this directly. Webpack 5+ supports it. In Next.js, workers in the App Router work but require careful path handling.

### `comlink` — make it ergonomic

```ts
// worker.ts
import * as Comlink from 'comlink';
const api = {
  parseCsv(text: string) { /* ... */ return rows; },
  computeStats(rows: Row[]) { /* ... */ return stats; },
};
Comlink.expose(api);

// main.ts
import * as Comlink from 'comlink';
const worker = new Worker(new URL('./worker.ts', import.meta.url));
const api = Comlink.wrap<typeof apiType>(worker);
const stats = await api.computeStats(rows);  // looks like a regular async call
```

### When to use a worker

- **Parsing large data** (CSV, JSON, XML > 1MB).
- **Image manipulation** (resize, filter — `OffscreenCanvas` works in workers).
- **Cryptography** (hashing, key derivation).
- **Compression / decompression**.
- **Heavy math** (physics simulation, machine learning inference via ONNX/TFJS in worker).

### When NOT to use

- Small computations (worker setup cost > the work itself).
- Anything needing DOM access (workers can't touch DOM).
- One-off tasks (overhead matters; pool/reuse workers for repeated work).

### Worker types

- **Dedicated Worker**: one per page. Most common.
- **Shared Worker**: shared across tabs/pages of same origin. Niche.
- **Service Worker**: separate beast — proxies network requests, enables offline. Not for CPU offload.

---

## 10. Bundle analysis workflow

Run before every release. Look for surprises.

### Next.js

```bash
npm install -D @next/bundle-analyzer
```

```js
// next.config.js
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});
module.exports = withBundleAnalyzer({ /* ... */ });
```

```bash
ANALYZE=true npm run build
```

Opens an interactive treemap. Look for:
- **Massive single chunks** > 200KB. Why?
- **Duplicated libs** (two copies of React, lodash, date-fns). Bug — pin via `overrides`.
- **Server-only code in client bundle** (DB drivers, secret-using libs). Add `import 'server-only'`.
- **Dev dependencies in prod** (test fixtures, mock data, storybook).
- **Polyfills shipped to modern targets**.
- **Big icon libraries imported wholesale** (`import * as Icons from 'lucide-react'`). Use named imports.

### Vite

```bash
npm install -D rollup-plugin-visualizer
```

```ts
// vite.config.ts
import { visualizer } from 'rollup-plugin-visualizer';
export default {
  plugins: [
    visualizer({ open: true, gzipSize: true, brotliSize: true }),
  ],
};
```

### Source map explorer (post-build)

```bash
npx source-map-explorer build/static/js/*.js
```

Works on any build with source maps.

### What "good" looks like

- **First Load JS** (Next.js terminology): < 90KB gzipped per route.
- **Total JS shipped to a session**: depends on app, but < 300KB gzipped is comfortable.
- **No duplicated libs**.
- **Largest chunk identifiable** — you should know what's in it without surprise.
