# Build Tools Deep Reference

When to use what, the configs that actually matter, and the gotchas. For Next.js (its own pipeline), see `references/nextjs.md`.

## Sections

1. [Build tool selection](#1-build-tool-selection)
2. [Vite — the default for non-Next projects](#2-vite--the-default-for-non-next-projects)
3. [Webpack — when you can't avoid it](#3-webpack--when-you-cant-avoid-it)
4. [Parcel — zero-config niche](#4-parcel--zero-config-niche)
5. [Module resolution](#5-module-resolution)
6. [Bundle splitting strategies](#6-bundle-splitting-strategies)
7. [Source maps](#7-source-maps)
8. [Tree shaking](#8-tree-shaking)
9. [Package managers — npm vs. yarn vs. pnpm](#9-package-managers--npm-vs-yarn-vs-pnpm)
10. [Monorepos](#10-monorepos)

---

## 1. Build tool selection

```
Building a Next.js app?                          → Next's pipeline (Turbopack/Webpack)
Building a Vue / Svelte / React SPA or library?  → Vite (default)
Working on an inherited Webpack project?         → Stay; audit the config
Throwaway prototype, marketing one-pager?        → Parcel or Vite
Storybook?                                       → Vite-based Storybook 8+
Building a CLI tool / Node-only library?         → tsup (esbuild-based) or Bun build
Building a browser extension?                    → Vite + a CRX plugin, or Webpack
```

### What's the difference, really?

- **Vite**: dev server uses native ES modules (instant hot reload); production build uses Rollup (excellent tree shaking). Modern, fast, opinionated.
- **Webpack**: traditional bundler. Mature, configurable, slow. Best when you need its plugin ecosystem (federation, complex monorepos).
- **Parcel**: zero-config bundler. Auto-detects assets, sets up dev server, handles imports. Great for prototypes; less control for advanced cases.
- **esbuild / swc / Bun build**: faster transpilers/bundlers. Used by Vite, Next, Parcel under the hood. Direct use for CLI tools / libraries.
- **Turbopack**: Next.js's Rust-based replacement for Webpack. Faster dev. As of writing, stable for `next dev`, in active development for `next build`.

---

## 2. Vite — the default for non-Next projects

### Minimal `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  build: { sourcemap: true },
});
```

Most apps don't need much more.

### Path aliases

```ts
// vite.config.ts
import path from 'node:path';
export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});

// tsconfig.json — must match for TypeScript
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  }
}
```

Both must agree. `vite-tsconfig-paths` plugin reads tsconfig and applies it automatically.

### Environment variables

```
.env                # always loaded
.env.local          # always loaded, gitignored
.env.production     # loaded for `vite build`
.env.development    # loaded for `vite`
```

```ts
// Available as import.meta.env.VITE_*
const url = import.meta.env.VITE_API_URL;
```

**Only `VITE_*` vars are exposed to the client.** Everything else stays server/build-time only. Same trap as Next's `NEXT_PUBLIC_*` — audit before release.

### Asset handling

```ts
import logoUrl from './logo.svg';                 // URL string
import logoSvg from './logo.svg?raw';             // raw text
import logoComponent from './logo.svg?react';     // as React component (with vite-plugin-svgr)
import data from './data.json';                   // parsed
const importer = import.meta.glob('./pages/*.tsx');   // dynamic globbing
```

### Dev proxy

```ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8080',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/api/, ''),
    },
  },
}
```

Bypass CORS in dev by proxying through the Vite dev server.

### Production build settings

```ts
build: {
  sourcemap: true,                       // ALWAYS in prod (upload to Sentry separately)
  rollupOptions: {
    output: {
      manualChunks: {                    // explicit code splitting
        vendor: ['react', 'react-dom'],
        utils: ['lodash-es', 'date-fns'],
      },
    },
  },
  target: 'es2020',                       // skip polyfills for ancient browsers
  minify: 'esbuild',                      // faster than terser, ~95% as good
}
```

### Plugin ecosystem worth knowing

- `@vitejs/plugin-react` — React refresh + JSX.
- `vite-plugin-svgr` — import SVG as React component.
- `rollup-plugin-visualizer` — bundle analyzer.
- `vite-plugin-pwa` — service worker generation.
- `vite-tsconfig-paths` — auto-apply tsconfig paths.

---

## 3. Webpack — when you can't avoid it

If you've inherited a Webpack project, don't switch to Vite for the sake of it. Audit and tighten what's there.

### Things to look for in a Webpack config audit

- **Mode set correctly** for prod (`mode: 'production'` enables minification, scope hoisting, dead code elimination).
- **`devtool` is `source-map` or `hidden-source-map` for prod**, not `eval-source-map` (slower, larger).
- **Babel only transpiling what's needed** — ancient `babel.config.js` configs often over-transpile (ES5 when targets allow ES2020).
- **`splitChunks` configured** to extract vendors and shared chunks.
- **`Terser` settings** — drop console in prod, optimize.
- **No `--watch` mode in prod build** (yes, this happens).
- **No source maps shipped to public** (`hidden-source-map` is fine — uploaded to Sentry separately).

### Loaders vs. plugins

- **Loaders**: transform individual files (`babel-loader`, `css-loader`, `ts-loader`).
- **Plugins**: modify bundles, emit assets, inject env (`HtmlWebpackPlugin`, `MiniCssExtractPlugin`, `DefinePlugin`).

### Module Federation (the killer feature Webpack still owns)

```js
new ModuleFederationPlugin({
  name: 'host',
  remotes: {
    cart: 'cart@http://cart.example.com/remoteEntry.js',
  },
  shared: ['react', 'react-dom'],
});
```

Lets multiple independently-deployed apps share runtime modules. Vite has community plugins but Webpack's is mature. Use Webpack if you need this.

### Migrating to Rsbuild

[Rsbuild](https://rsbuild.dev/) is a Rust-based, Webpack-compatible alternative. Same plugin/config structure, much faster. If you're stuck on Webpack for plugin reasons but want speed, Rsbuild is the migration.

---

## 4. Parcel — zero-config niche

```bash
npx parcel index.html
# Done. Dev server at localhost:1234. Auto-detects assets, bundles, hot reloads.
```

Strengths:
- Zero config.
- Auto-installs missing deps.
- Multi-page support out of the box.
- Good asset handling (images, fonts, JSON, GLSL, etc. — just `import` them).

Weaknesses:
- Less plugin ecosystem.
- Less control over advanced bundling.
- Smaller community.

Fits: prototypes, marketing pages, multi-page demos. For React apps with even moderate complexity, Vite is the better choice.

---

## 5. Module resolution

### `package.json` module fields

```json
{
  "main": "./dist/index.cjs",          // CommonJS entry (legacy Node)
  "module": "./dist/index.mjs",        // ES module entry (modern bundlers)
  "types": "./dist/index.d.ts",        // TypeScript declarations
  "exports": {                         // modern, supersedes the above
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs"
    },
    "./styles.css": "./dist/styles.css"
  },
  "sideEffects": false                 // tree-shaking hint
}
```

`exports` is the modern field. Conditional exports (`import` vs. `require` vs. `node` vs. `browser`) let you ship different code per environment.

### Why `sideEffects: false` matters

```
"sideEffects": false                                     // entire package can be tree-shaken
"sideEffects": ["./src/registerThing.ts", "*.css"]       // these have side effects, others don't
```

Without this, bundlers must assume any imported module might do something globally — they keep it even if no exports are used. With it, unused imports get dropped.

### Conditional exports trap

Some libs ship multiple entry points (`react/jsx-runtime`, `react/server`). The `exports` field controls what's reachable:

```json
"exports": {
  ".": { ... },
  "./styles.css": "./styles.css"
}
```

Anything not listed is **unreachable** — `import 'lib/internal'` fails. This is the lib author's choice. If you need internal access, find another path or fork.

### `tsconfig` `moduleResolution`

```jsonc
{
  "module": "ESNext",
  "moduleResolution": "Bundler"   // for Vite, Webpack, Next, etc.
}
```

Old options (`"Node"`, `"Node16"`, `"NodeNext"`) are stricter — they enforce file extensions in imports. `"Bundler"` is what most modern app projects want.

---

## 6. Bundle splitting strategies

See `references/performance.md` § 4 for the high-level. Build-tool specifics:

### Vite / Rollup

```ts
// vite.config.ts
build: {
  rollupOptions: {
    output: {
      manualChunks: (id) => {
        if (id.includes('node_modules/react')) return 'react';
        if (id.includes('node_modules')) return 'vendor';
        // app code falls through to dynamic per-module chunks
      },
    },
  },
},
```

Per-route splitting happens automatically via dynamic `import()` (`React.lazy(() => import(...))` etc.).

### Webpack

```js
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendor: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendor',
        priority: 10,
      },
      common: {
        minChunks: 2,
        priority: 5,
        reuseExistingChunk: true,
      },
    },
  },
}
```

### What to actually do

For most apps:
- **Don't manually configure splitting**. Rely on dynamic imports for explicit splits + the bundler's defaults for everything else.
- **Pull in framework chunks separately** (React/Vue) — they're long-cache-friendly.
- **Don't over-split.** Each chunk = HTTP request + parse cost. < 10 chunks for a typical SPA.

---

## 7. Source maps

```
source-map               full external file. Best debugging, slowest build, leaks code if exposed.
hidden-source-map        full external file, no comment in JS. Upload to Sentry; users can't fetch.
inline-source-map        embedded in JS. Don't ship to prod.
eval-source-map          fast dev mode. Dev only.
cheap-module-source-map  faster, less detail. Dev only.
nosources-source-map     debug structure without source content. Public-safe.
```

### Production strategy

1. Build with `hidden-source-map` (or `source-map` and don't deploy `.map` files).
2. Upload `.map` files to your error monitor (Sentry, Bugsnag).
3. Errors stack-trace correctly in monitoring without exposing source publicly.

### Don't deploy `.map` to public

Source maps reveal:
- Original code (unminified).
- Sometimes server-side logic that snuck in.
- Comments and dead code.
- API patterns the minified version obscures.

Verify after every deploy: `curl https://yourapp.com/main.js.map` should 404.

---

## 8. Tree shaking

The bundler removes code not actually imported. For it to work:

1. **ES modules** (`import`/`export`), not CommonJS (`require`/`module.exports`).
2. **`sideEffects: false`** in `package.json` of the library.
3. **No top-level side effects** — code that runs at import time stays.

### Side-effect examples

```ts
// ❌ Top-level side effect — won't tree-shake
import './polyfill';
window.foo = 'bar';
console.log('loaded');

// ✅ Pure exports — tree-shakable
export function add(a: number, b: number) { return a + b; }
export function sub(a: number, b: number) { return a - b; }
```

If you `import { add } from './math'`, only `add` is bundled — `sub` is dropped.

### Verify

Run the bundle analyzer. Search for the function you didn't import. If it's in the bundle, tree shaking failed for that module.

### Common tree-shaking failures

- **Wildcard imports**: `import * as date from 'date-fns'` defeats it (the bundler can't know which methods you'll use).
- **`require()` somewhere in the chain**: forces CommonJS, breaks tree shaking.
- **No `sideEffects`** field on a third-party lib: bundler must assume side effects.
- **CSS imports**: CSS isn't tree-shaken. Be explicit about what you import.

---

## 9. Package managers — npm vs. yarn vs. pnpm

### Differences that matter

| | npm | yarn (Berry) | pnpm |
|---|---|---|---|
| Node modules layout | Flat with hoisting | Plug'n'Play (no node_modules) or hoisting | Strict (symlinked) |
| Install speed | Slowest | Fast | Fastest |
| Disk usage | High | Med (PnP=low) | Low (content-addressable) |
| Workspace support | Decent | Excellent | Excellent |
| Phantom dependencies | Allowed | Blocked (PnP) | Blocked |

### pnpm wins for most projects

- **Fastest installs**, especially in CI.
- **Strict node_modules** — code that imports a transitive dep without listing it directly fails. Catches a real bug class.
- **Content-addressable store** — one copy of each version on disk, hardlinked into projects.
- **Excellent workspace support** — first-class.

```bash
pnpm install
pnpm add react react-dom
pnpm -r build              # run `build` in every workspace
pnpm --filter @app/web dev  # run dev in specific workspace
```

### Yarn Berry (v2+) with PnP

PnP (Plug'n'Play) skips `node_modules` entirely. Bundlers and editors need PnP support — most modern tools have it. Strictest, fastest, but more setup friction.

### npm — fine for solo / simple projects

`npm` works. It's slower; the workspace story is workable but less polished than pnpm. For most teams in 2026, pnpm is the better default.

### Lockfiles — commit them, all of them

`package-lock.json` / `yarn.lock` / `pnpm-lock.yaml` — commit. Always. CI uses them to reproduce installs.

```bash
# CI installs (no lockfile updates allowed)
npm ci                           # for npm
yarn install --immutable         # for yarn
pnpm install --frozen-lockfile   # for pnpm
```

### `overrides` / `resolutions`

Force a specific version of a transitive dep:

```json
// npm — package.json
"overrides": { "lodash": "^4.17.21" }

// yarn — package.json
"resolutions": { "lodash": "^4.17.21" }

// pnpm — package.json
"pnpm": { "overrides": { "lodash": "^4.17.21" } }
```

Use to patch security vulnerabilities upstream hasn't released a fix for.

---

## 10. Monorepos

### Why monorepo?

- Shared code (UI library, types, utils) consumed by multiple apps without npm publish.
- Atomic commits across packages (a feature touching backend + frontend in one PR).
- Single set of dev dependencies (one TypeScript version, one ESLint config).

### Tools

- **pnpm workspaces** — built into pnpm, simplest setup.
- **npm/yarn workspaces** — also built-in, similar but slower.
- **Turborepo** — task runner on top of workspaces. Caches build outputs, parallelizes.
- **Nx** — full-fat monorepo platform. More features, more config.
- **Bun workspaces** — emerging, fast.

### pnpm + Turbo (the modern simple stack)

```
my-monorepo/
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
├── apps/
│   ├── web/              # Next.js app
│   └── docs/             # Astro / Docusaurus
└── packages/
    ├── ui/               # shared component library
    ├── config/           # shared eslint/tsconfig
    └── utils/            # shared utilities
```

```yaml
# pnpm-workspace.yaml
packages:
  - "apps/*"
  - "packages/*"
```

```json
// turbo.json
{
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**", ".next/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": {},
    "test": { "dependsOn": ["^build"] }
  }
}
```

```bash
pnpm turbo run build       # builds everything in dependency order, caches per package
pnpm turbo run dev          # starts dev for everything
pnpm turbo run build --filter=@app/web   # only the web app
```

### Sharing code between packages

```json
// apps/web/package.json
{
  "dependencies": {
    "@my/ui": "workspace:*",
    "@my/utils": "workspace:*"
  }
}
```

`workspace:*` means "use the in-monorepo version always." Published packages get the workspace version replaced with the published one at publish time.

### TypeScript in monorepos

```json
// packages/ui/tsconfig.json
{ "extends": "@my/config/tsconfig.base.json", "compilerOptions": { "outDir": "dist" } }

// apps/web/tsconfig.json
{
  "extends": "@my/config/tsconfig.base.json",
  "references": [{ "path": "../../packages/ui" }, { "path": "../../packages/utils" }]
}
```

Project references enable incremental builds and proper inter-package type checking.

### Build outputs vs. live source

Two strategies:

1. **Build everything**. `packages/ui` builds to `packages/ui/dist`; consumers import from it. Production-like; needs orchestration (Turbo).
2. **Live source consumption**. `packages/ui/package.json` points `main` and `types` at `src/index.ts` directly; consumers import the TypeScript. Simpler for dev; needs the consumer's bundler to handle TS.

Most teams settle on a hybrid: live source in dev, built artifacts for publishing.

### Common monorepo footguns

- **Phantom deps**: app uses `lodash` because some other package brings it in; works locally, breaks when that package removes it. pnpm's strict layout prevents this.
- **TypeScript paths confusion**: each package has its own `tsconfig`; aliases in app's `tsconfig` don't apply to library packages. Use project references.
- **Caching breaks** (Turbo): outputs not declared correctly, stale builds. Verify `outputs` in `turbo.json`.
- **CI builds taking forever** without caching. Use Turbo Remote Cache or Nx Cloud.
