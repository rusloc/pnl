# ACME Trucks — Time utilization, standalone JS app

- **From:** rusloc/pnl (nerd)
- **To:** vosk.dev repo agent
- **Date:** 2026-11-09
- **Status:** ready (builds, tests and runs on its own; parity gate passed — checks below)

A complete, standalone Next.js 16 app of the Power BI page **"Time utilization"** (ADR-0016; contract
`docs/ADD/features/trucks-js-flavour.md` in rusloc/pnl; pack per ADR-0014): how the haul trucks' total time splits into work
and time losses, plan against fact, as a share of total time. One page: six filter chips with popovers and Reset, four KPI
tiles, the 19-row "Time structure" waterfall table with a row tooltip. The Power BI flavour ships separately in
`../power-bi/`; it is the reference this app matches (parity gate: 1,649 rows, 0 gaps).

Copy this folder into the vosk.dev repo, `npm ci`, build, host and embed it. **Do not edit it in place.** The source of
truth stays in rusloc/pnl (`js-trucks/`); this folder is a copy as of 2026-11-09 with the differences listed below. A fix or
a question goes back as a dated note in `.sync/` (`{yyyy-mm-dd}-{topic}.md`, from · to · date · status); the change is made
in `js-trucks/` and the pack is re-issued.

## What is inside

| Path | What |
| --- | --- |
| `app/` | `layout.tsx` (Inter + Manrope via `next/font`, metadata), `page.tsx` (static shell), `globals.css` (tokens, the 1440 × 810 geometry) |
| `components/` | `TrucksApp.tsx` (client root: data load, URL ↔ state, board frame), `FilterBar.tsx` (chips, popovers), `Waterfall.tsx` (table, bars, tooltip) |
| `lib/engine/` | Framework-free engine: every number and every string on the page (masks, hours, Linear / Weighted shares, KPI tiles, waterfall, formats, copy, view models, URL state) |
| `lib/data/` | `manifest.ts` (strict Zod contract of `public/data`, column specs), `loader.ts`, `parquet-columns.ts` (**vendored** from rusloc/pnl `js-report/`, header comment) |
| `lib/test-utils/` | Node loader for the tests and `parity/` (hunter's parity CSV, harness and notes) |
| `scripts/csv.ts` | **Vendored** from `js-report/`; read by the tests |
| `public/data/` | Prebuilt data, **committed** (see Data) |
| `public/icons/` | `trucks-logo.svg` |
| `fixtures/checks/trucks-pinned.csv` | The expected values extracted once from the Power BI DAX tests |
| `next.config.ts` | Security headers and CSP (see Embed) |
| `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `.prettierrc.json`, `.prettierignore`, `.gitignore` | Config |

Stack: Next.js 16.4.2 (App Router, Turbopack, `cacheComponents`), React 19.3.1, TypeScript 5.9.3 strict
(`noUncheckedIndexedAccess`), Zod 4.6.7, hyparquet 1.31.5, Vitest 5.0.5, ESLint 9.39.5 (`eslint-config-next`). Node 24 or
later. No chart library, no backend, no API routes.

## Run

```bash
npm ci
npm run dev          # http://localhost:3000
npm run typecheck    # next typegen && tsc --noEmit
npm run lint
npm test             # Vitest: 68 tests (6 skip in the pack, see Checks)
npm run build        # next build: / static
npm start            # next start
```

There is no `prebuild` step: the data is already in `public/data/`.

## Environment variables

| Name | Read | Meaning |
| --- | --- | --- |
| `EMBED_ALLOWED_ORIGINS` | `next.config.ts`, **at build time** | Comma-separated bare https origins allowed to frame the app, for example `https://vosk.dev,https://www.vosk.dev` (`http://localhost` / `http://127.0.0.1` allowed for local tests). A malformed entry fails the build. Empty = same-origin framing only, so **set it for the embed build**. Server-side; not exposed to the client. |
| `NEXT_PUBLIC_SITE_URL` | inlined at build | Public URL of the deployment, used as `metadataBase`. Optional; client-safe by design. |

No env var is needed for a local build. There are no secrets in this app.

## Embed

- Embed `/` with an `<iframe>`. The app assumes nothing about the host: no `postMessage`, host CSS, auth, cookies or storage.
- **Board: fixed 1440 × 810** (the Power BI page's geometry × 0.75). The host scales it (`transform: scale()` on the wrapper
  or the iframe). Below 1200 px the app is not optimised (horizontal scroll). Light theme only.
- **CSP and headers live in `next.config.ts`** (every path): `default-src 'self'; script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self'
  <EMBED_ALLOWED_ORIGINS>; base-uri 'self'; form-action 'none'; object-src 'none'`, plus `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. No
  `X-Frame-Options`, no `X-Powered-By`. `'unsafe-eval'` only under `next dev`.
- Fonts: Inter and Manrope, self-hosted by `next/font` at build time (the build needs Google Fonts once; no third-party
  requests at runtime).
- Data fetches are absolute (`/data/<file>`, `components/TrucksApp.tsx`); a `basePath` deploy has to prefix them.
- **Copy link** uses `navigator.clipboard`: the host iframe needs `allow="clipboard-write"`, otherwise it does nothing, silently.

## URL state

Every value is validated with Zod; defaults are omitted, unknown keys ignored, an invalid value falls back to its default
and the URL is rewritten to the canonical form. The Reset state is every key absent.

| Key | Values | Default |
| --- | --- | --- |
| `w` | `yyyy-ww`, from `2022-44` to `2023-14` (`2023-09` = week `9 (25.2-3.3)`) | all weeks |
| `o` | offices, lower case, comma list (`k1,k3`) | all |
| `l` | loader names, comma list (`LDR-12-09`; case-insensitive on parse) | all |
| `wt` | `trucks,onspot,undefined` (≥ 1) | `trucks,onspot` |
| `pt` | `month` · `week` | `month` |
| `calc` | `weighted` · `linear` | `weighted` |

Values are capped at 256 characters, except `l`, capped at the length of the full loader list so every selection the page
can make round-trips. Deep links: `/?w=2023-10`, `/?pt=week&calc=linear`, `/?w=2023-05&calc=linear&o=k3&wt=trucks,onspot,undefined`.

## Data

**`public/data/` is pre-aggregated from the live extract, not from a synthetic twin (USER decision 2026-11-08, ADR-0016).**
The rows are real operating figures, and every file is readable by anyone who can open the page. It carries the real mines
and loaders under the names the Power BI model gives them (offices `K1` … `T1`, loaders `LDR-12-09` …). The source dispatch,
branch and mine names, and the comments and serial numbers of the extract, do not ship. The only Cyrillic is the
time-category codes in `manifest.json`.

Built in rusloc/pnl by `js-trucks/scripts/build-trucks-data.ts` from `pbi-report/ACME Trucks/data/`, at loader × business
week; only the 131 loaders that pass the report's fixed filters (`is_included = "да"`, contractor blank) ship:

| File | Rows | Bytes | Loaded |
| --- | ---: | ---: | --- |
| `manifest.json` | — | 22,910 | first paint |
| `time-week.parquet` | 2,688 | 157,917 | first paint |
| `plan-month.parquet` | 1,533 | 51,635 | first paint |
| `rock-week.parquet` | 2,671 | 32,262 | first paint |
| `plan-week.parquet` | 2,522 | 78,372 | first pick of Plan type = Week, or at load with `pt=week` |

First paint 265 kB, total 343 kB. The build script is **not** in the pack (it reads the repo's PBIP folder); a data change is
made in rusloc/pnl and re-packed.

## Checks (2026-11-09, run inside this folder)

- `npm ci && npm run typecheck && npm run lint && npm test && npm run build` green: 6 test files, 62 passed, 6 skipped. In
  rusloc/pnl all 68 pass.
- The 6 skipped need what the pack does not carry. Five need `fixtures/data-unfiltered/` (every loader, before the fixed
  filters; its Parquet would not survive `.sync/**/*.parquet` in `.gitignore`): the fixture check, the contractor check and
  `model_total` in `pinned.test.ts`, and the two PT-06 parity tests. One needs the PBIP (`parity-expected.csv` mirror).
- Pinned values (`lib/engine/pinned.test.ts`): in rusloc/pnl, all 959 captured + derived rows of `trucks-pinned.csv`. 14 of
  them are DAX fall-through constants in a state the page cannot reach (Plan type and Calculation unselected).
- Parity (hunter, `lib/test-utils/parity/`): in rusloc/pnl, 1,649 rows, 1,647 match, 2 accepted, 0 gap. Refresh the recorded
  JS values after an engine change with `PARITY_WRITE=1 npx vitest run lib/engine/parity.test.ts`.
- Headless, `next build && next start` at 1440 × 810: Reset and `/?w=2023-10` fit 810 px with 0 console errors; real clicks
  on Loader search, Work type (cannot go empty), Done, Clear, Esc, outside click, focus return, Reset, and a pick changing the tiles.

## Differences from `js-trucks/` (rusloc/pnl)

- No `scripts/build-trucks-data.ts`, no `build:data` / `build:fixtures` / `prebuild` scripts, no `hyparquet-writer` (lockfile
  re-resolved), no `fixtures/data-unfiltered/`.
- `public/data/` is committed; this README replaces the app README.

## Deviations from the contract or the Power BI flavour (deliberate)

From the contract, settled by the model or the pinned rows:

1. A blank divided by a number is blank, not 0 (`ratio`, §3.3).
2. `_WF * Subtotal` is blank on loss rows (plan Linear: 0); `_WF Fact Loss` is 1 on Total time under Weighted. No bar reads either.
3. Table rows are 22.5 px, not ≈ 23.4 (20 rows must end above the axis strip).
4. Chip text is 12 px, not 13 (it does not fit the Power BI chip widths at 13).
5. Tooltip labels are `Plan share` / `Fact share`, as in the Power BI tooltip page.
6. The `l` URL value has its own length cap (see URL state).

Accepted platform differences (rusloc/pnl `docs/design/parity-rules.md` › ACME Trucks): chips with popovers, pending until
Done, Clear = that filter's Reset value (Power BI: dropdown slicers that apply at once); Esc closes; bold subtotal rows; `%` /
`%` column headers; legend swatches; native axis text and Δ pill; Manrope / Inter; opens on the Reset state (Power BI: its
saved week); URL state + Copy link; keyboard reach and focus return; Work type keeps ≥ 1 pick; a blank KPI prints `–` with
an empty pill (Power BI: `(Blank)`); bar hover shows the exact share.

## Open items (the app runs on the defaults)

- **Unverified face:** at `?wt=onspot` Refueling fact is 0.0017 % and prints `0.00%`. Whether Power BI prints `0.00%` or `–`
  for a nonzero share that rounds to zero is not captured (267 cells of the stress grid are in this state). One capture settles it.
- Open USER questions, defaults in force (contract §10): opens at the Reset state; board fixed at 810 px; popovers apply on
  Done; no ⓘ / How to read; pack timing.
- Linear waterfall rows and Week + Weighted are not captured from Power BI (KPI tiles only for Linear); an independent
  recomputation of the model covers them.
