# Nordmark Exec — standalone JS app

- **From:** rusloc/pnl (nerd)
- **To:** vosk.dev repo agent
- **Date:** 2026-10-30
- **Status:** ready (the app builds, tests and runs on its own; checks below)

A complete, standalone Next.js 16 app for the **Nordmark Retail executive dashboard** (ADR-0013, JS flavour per ADR-0013 (h); pack per ADR-0014 as amended 2026-10-30). Nordmark Retail is a fictional multi-category reseller (NL + BE stores, online, wholesale); all data is generated. One landing page: twelve trading metrics as cards with status chips, a period picker (Week · Month · Quarter · Year), comparators, a Region and a Category filter, ⓘ explanations and drill paths. The Power BI flavour ships separately in `../power-bi/`.

Copy this folder into the vosk.dev repo, `npm ci`, build, host and embed it. **Do not edit it in place.** The source of truth stays in rusloc/pnl (`js-exec/`); this folder is a copy as of 2026-10-30 with the changes listed under "Differences from js-exec/". A fix or a question goes back as a dated note in `.sync/` (`{yyyy-mm-dd}-{topic}.md`, from · to · date · status); the change is made in `js-exec/` and the pack is re-issued.

## What is inside

| Path | What |
|---|---|
| `app/layout.tsx`, `app/page.tsx`, `app/globals.css` | Root (Inter via `next/font`, metadata), the static page shell with a Suspense boundary, the stylesheet |
| `components/` | UI: `ExecApp.tsx` (the only client root: data load, URL state, layers, tooltip), `Card.tsx`, `Layers.tsx` (Filters menu, How to read, More KPIs, ⓘ and drill pop-ups on one scrim), `ui.tsx`, `bars.ts` |
| `lib/engine/` | Framework-free engine: every number and every string on the page (cube, calendar, period items, metrics, status bands, formats, copy, view model, URL state) |
| `lib/data/` | `manifest.ts` (strict Zod contract of `public/data`), `loader.ts`, `parquet-columns.ts` (**vendored** from rusloc/pnl `js-report/`, header comment) |
| `lib/test-utils/exec-data.ts` | Node-side loader and control-totals reader for the tests |
| `scripts/csv.ts` | RFC 4180 CSV reader used by the tests (**vendored** from `js-report/`, header comment) |
| `public/data/` | Prebuilt data, **committed** (see Data) |
| `fixtures/checks/` | `control_totals_eur.csv`, `control_totals_category_eur.csv`: the generator's expected totals, read by the control-totals tests |
| `next.config.ts` | Security headers and CSP (see Embed) |
| `package.json`, `package-lock.json`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `.prettierrc.json`, `.prettierignore`, `.gitignore` | Config |

Stack: Next.js 16.4.2 (App Router, Turbopack, `cacheComponents`), React 19.3.1, TypeScript 5.9.3 strict (`noUncheckedIndexedAccess`), Zod 4.6.7, hyparquet 1.31.5, Vitest 5.0.5, ESLint 9.39.5 (`eslint-config-next`). Node 24 or later (`engines`). No chart library, no backend, no API routes.

## Run

```bash
npm ci
npm run dev          # http://localhost:3000
npm run typecheck    # next typegen && tsc --noEmit
npm run lint
npm test             # Vitest
npm run build        # next build: / static
npm start            # next start
```

There is no `prebuild` step: the data is already in `public/data/`.

## Environment variables

| Name | Read | Meaning |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | inlined at build | Public URL of the deployment, used as `metadataBase`. Optional; client-safe by design. |
| `EMBED_ALLOWED_ORIGINS` | `next.config.ts`, **at build time** (the headers are compiled into `.next/routes-manifest.json`) | Comma-separated bare origins allowed to frame the app, for example `https://vosk.dev,https://www.vosk.dev`. Must be https (`http://localhost` and `http://127.0.0.1` are allowed for local tests). A malformed entry fails the build. Empty means same-origin framing only, so **set it for the embed build**. Server-side; not exposed to the client. |

No env var is needed for a local build. There are no secrets in this app.

## Embed

- Embed `/` with an `<iframe>`. The app assumes nothing about the host: no `postMessage`, host CSS, auth, cookies or storage.
- **Board: 1440 × 810 px**, no page scroll and no ⓘ pop-up scroll at a 1440 × 810 viewport. The host scales it (`transform: scale()` on the wrapper or the iframe). Narrower viewports reflow (two card columns at 1000 px, no horizontal scroll).
- **CSP and headers live in `next.config.ts`** (on every path): `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self' <EMBED_ALLOWED_ORIGINS>; base-uri 'self'; form-action 'none'; object-src 'none'`, plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. No `X-Frame-Options` (it would block the embed), no `X-Powered-By`. `'unsafe-inline'` scripts are the same day-one compromise as the P&L and Mirelo apps (per-request nonces deferred); `'unsafe-eval'` is added only under `next dev`.
- Fonts: Inter, self-hosted by `next/font` at build time. The build needs network access to Google Fonts once; there are no third-party requests at runtime.
- Data fetches are absolute (`/data/<file>`, `components/ExecApp.tsx`). A `basePath` deploy has to prefix them.
- No IDs, keys or connection strings belong in `.sync` (and none are needed here).

### URL state

The query string is the only input. Each key is validated on its own with Zod (`lib/engine/url-state.ts`); unknown keys and bad values are dropped and the URL is rewritten to the canonical form (defaults omitted, keys in the order below). A bare URL is **Week 43 FY2026 · vs Budget · All regions & formats · All categories · no attribute picks**.

| Key | Values | Notes |
|---|---|---|
| `i` | item key `FY2026-W43` · `FY2026-P10` · `FY2026-Q4` · `FY2026` · `FY2025-W12` … | Grammar `FY<yyyy>[-W<nn>\|-P<nn>\|-Q<n>]`; must be a listed item (95 weeks, 22 months, 8 quarters, 2 years, FY2025 W01 … FY2026 W43). The as-of week `FY2026-W43` is the default and is omitted. `P` = the 4-5-4 retail month; the UI says "Month". |
| `c` | `budget` (default) · `ly` · `prev` | Comparator. `prev` with a Year item becomes `ly`. Status is always vs budget or target; the comparator changes the Δ line only. |
| `r` | `all` (default) · `nl` · `be` · `online` | Region / format. |
| `cat` | comma list of category codes: `FRESH`, `AMBIENT`, `HB`, `HOUSEHOLD`, `ELEC`, `APPAREL`, `HOME`, `GARDEN`, `TOYS` | Case-sensitive; normalised to sort order, deduplicated, unknown codes dropped; nothing valid or all 9 = key absent (All). Under any pick EBITDA flash and Supplier OTIF are N/A ("n/a by category"); Sell-through needs a seasonal category. |
| `group` | `B1` · `B2` · `B3` · `B4` | Attribute pick, comma list (conceals cards that do not match). |
| `lever` | `sales` · `margin` · `stock` · `supply` · `cash` | Attribute pick, comma list. |
| `owner` | `commercial` · `supply` · `finance` · `digital` | Attribute pick, comma list. |

Examples:

- `/?i=FY2026-P10` — Month 10 to date vs Budget.
- `/?i=FY2026-Q4&c=ly&r=online` — Quarter 4 to date vs Last year, Online.
- `/?i=FY2026&c=prev` — rewritten to `/?i=FY2026&c=ly` (no Previous at Year).
- `/?cat=ELEC` — Week 43, Electronics; header "All regions & formats · Electronics", 3 cards N/A.
- `/?i=FY2026-P10&c=prev&r=nl&cat=ELEC%2CTOYS` — canonical; header "Netherlands · all formats · Electronics & Toys & leisure".
- `/?i=FY2026-Q4&cat=HB,FRESH,AMBIENT` — rewritten to `cat=FRESH%2CAMBIENT%2CHB` ("· 3 categories").
- `/?group=B1,B4&lever=sales&owner=finance` — attribute picks; the Filters badge counts them.
- Retired keys still parse: `p=week|ptd|ytd` (→ the as-of week · its month · its year; ignored when `i` is present, never written), `c=lw` (→ `prev`); `statement` and `horizon` are ignored.

## Data

All files load at first paint (E-83 budget 600 kB).

| File | Rows | Bytes | Grain |
|---|---:|---:|---|
| `cube.parquet` | 4,599 | 384,427 | week × site group (NL stores, BE stores, ONLINE, WHOLESALE, DC, central) × category: sales, LFL sales (current and as-LY), budget, stock, forecast COGS, availability, receipts |
| `opex.parquet` | 1,029 | 8,932 | scenario × week × cost type × site group |
| `po.parquet` | 95 | 1,685 | week: PO lines due / OTIF, suppliers below 85 % |
| `sites.parquet` | 190 | 1,355 | week × site group: trading stores, LFL stores |
| `manifest.json` | — | 55,380 | calendar (104 weeks), categories, the 32 KPIs, status rules, targets, file index (strict Zod) |
| **Total** | | **451,779** | |

**Provenance.** Built by `js-exec/scripts/build-exec-data.ts` in rusloc/pnl from the generator output `data/nordmark_retail_dummy_data/parquet/` (seed 20261028, as-of FY2026 W43 = 19–25 Oct 2026; data built 2026-10-30). Stores, suppliers and SKUs never ship; every fold is reconciled to the source totals before writing. The data is a snapshot: a data change in rusloc/pnl is a re-pack here and a redeploy there.

**Rebuild the data in rusloc/pnl, not here:** `npm run build:data` in `js-exec/`, then copy `public/data/*` (and the two control-totals CSVs into `fixtures/checks/`, if the generator changed). The build script and `hyparquet-writer` are not in this pack on purpose.

## Tests

`npm test`: **13 files, 458 passed, 0 skipped** (2026-10-30).

| File | Tests | Covers |
|---|---:|---|
| `lib/engine/control-totals.test.ts` | 94 | ET-01: every one of the 26,143 rows of `control_totals_eur.csv` (4 scopes × the period-model keys W / P / Q / FY / `@k`, EBITDA previous-month keys) within the generator's tolerances; no engine value the CSV leaves out |
| `lib/engine/control-totals-category.test.ts` | 181 | E-104: every row of `control_totals_category_eur.csv` (18 region × category scopes, 10,514 rows) |
| `lib/engine/period-model.test.ts` | 55 | ET-21 … ET-28: items, windows, LY / Previous, FY2025 N/A, bars per granularity, EBITDA per granularity, URL state and picker moves |
| `lib/engine/story.test.ts` | 30 | ET-02 / ET-03: the Week 43 story on all 12 cards, ⓘ examples and target line, the 7 / 3 / 2 orange dot |
| `lib/engine/category.test.ts` | 26 | ET-33 … ET-36: category sums, N/A rules, targets under a pick, header and dropdown copy, URL `cat` |
| `components/explain-pop.test.tsx` | 17 | ⓘ figure block order, `dt` / `dd` pairs, blank basis, CSS spec |
| `lib/engine/status.test.ts`, `view.test.ts` | 13 + 13 | ET-10 … ET-13: status edges and dot rule; comparator, region sums, attribute concealment |
| `components/layers.test.tsx` | 12 | One scrim under every layer, panel shells, z-order |
| `lib/engine/calendar.test.ts` | 6 | ET-04 / ET-05: calendar keys, LY by key |
| `lib/engine/url-state.test.ts` | 5 | Parse / serialise / fallback / unknown and retired keys |
| `components/bars.test.ts`, `filters-menu.test.tsx` | 3 + 3 | Bar geometry and labels; Category dropdown markup |

## Known platform differences vs the Power BI flavour

Accepted in `docs/design/parity-rules.md` (rusloc/pnl) › Accepted platform differences; numbers, windows and headers are the same in both:

1. **FY row of the period picker at Year** (E-53 / E-91): the JS hides the FY row and offers the two FY items (`FY2025`, `FY2026 · to date`) as item chips; the Power BI flavour keeps the FY row, which drives its single Year chip (a slicer cannot select a value on behalf of another slicer).
2. **Category dropdown closed-state wording** (E-103): the JS shows "All categories" in the closed dropdown and as the clearing option; the Power BI dropdown slicer shows its native "All". Same semantics (no pick = All, all 9 ticked = All).

## Open items (from `js-exec/README.md`, not blockers)

- Δ colour under Last year / Previous keeps the status colour ("+€2.2m vs LY" can read red on an Off-track card): open with the USER.
- Scoped EBITDA (a region pick) is a contribution before central costs, with no copy note (data README open point 15).
- The ⓘ copy export to `docs/ADD/features/exec-info-popovers.md` (shared copy file, ADR-0013 (j) sync point 1) is not written; parity rows (`parity_selections_nordmark.csv`) are pending.
- Not verified: screen-reader behaviour of `inert`, `backdrop-filter` outside Chromium, a real 1440 × 810 window with browser chrome.

## Differences from `js-exec/`

- `package.json`: no `build:data` / `prebuild` scripts (they read the repo dataset `../data/nordmark_retail_dummy_data/parquet`); no `hyparquet-writer`. The lockfile is regenerated; it differs from `js-exec/`'s only by that package.
- `scripts/build-exec-data.ts` left out (it needs the repo dataset and `hyparquet-writer`); `scripts/csv.ts` stays (the test loader uses it). `lib/data/manifest.ts` still names the build script in a comment.
- `public/data/` is committed (in `js-exec/` it is build output, ignored by `public/data/.gitignore`, which is left out here).
- `fixtures/checks/` added: the two control-totals CSVs from `data/nordmark_retail_dummy_data/checks/`.
- `lib/test-utils/exec-data.ts`: a comment and the missing-file message only (no `build:data` hint). The lookup order is unchanged: `../data/nordmark_retail_dummy_data/checks/` next to the app folder first, then `fixtures/checks/`; in this pack only the fixtures exist.
- `.gitignore`: header comment only.
- This README replaces `js-exec/README.md` (its content is folded in; the original stays in rusloc/pnl).

## Checks run on this folder (2026-10-30)

- `npm ci`, `npm run typecheck`, `npm run lint`: clean.
- `npm test`: 13 files, 458 passed, 0 skipped (both control-totals files read from `fixtures/checks/`).
- `npm run build`: `/` static, no prebuild.
- `next start` + headless Chromium at 1440 × 810, 28 / 28: `/` and the five `/data/*` files return 200; headers as above (prod CSP without `'unsafe-eval'`, no `X-Frame-Options`, no `X-Powered-By`); default view = 12 cards, header "Week 43 · 19–25 Oct 2026 · vs Budget · All regions & formats", orange dot, no page scroll, every one of the 12 ⓘ pop-ups fits without scrolling and Esc returns focus to its button; Filters → Category: closed "All categories", 10 options, Electronics → `?cat=ELEC`, Esc closes the list and keeps the menu, header "· Electronics", 3 cards "n/a by category", no page scroll, all 12 ⓘ fit; reload of `?cat=ELEC` renders the same; no console or page errors.
