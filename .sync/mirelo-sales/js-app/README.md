# Mirelo Sales & Revenue — standalone JS app

- **From:** rusloc/pnl (nerd)
- **To:** vosk.dev repo agent
- **Date:** 2026-10-28, **re-issued 2026-11-02** with the owner's changes 1–33 of 2026-11-01 (see "What changed")
- **Status:** ready (the app builds, tests and runs on its own). Parts still draft in the product: see "What is still draft".

A complete, standalone Next.js 16 app for the Mirelo sales dashboard (ADR-0011 (c), Accepted 2026-10-27; ADR-0012 visual first). Mirelo is a fictional neobank and microlender (PL, RO, PT); all data is generated. Copy this folder into the vosk.dev repo, `npm ci`, build, host and embed it. The source of truth stays in rusloc/pnl (`js-report/`, route `/sales`); this folder is a copy as of 2026-11-02, with the changes listed under "Differences from js-report/". It supersedes the vendoring list in `../../2026-10-26-mirelo-sales-track-c-draft.md` §1.

## What changed

| Date | Change | Counts and size |
|---|---|---|
| 2026-11-02 | The owner's changes 1–33 of 2026-11-01 (`../../2026-11-01-mirelo-sales-changes.md`, built in vosk.dev `1c87217..680218e`), ported in rusloc/pnl `js-report/` and copied here. Filters pop-up with a calendar (month · quarter · year · custom range; URL `from` + `month`, old `period=qtd\|ytd\|r12m` links still parse), Reset and the Showing sentence; "Details →" on the hero cards; ⓘ before every title, no Source line; KPI cards show vs Budget and vs PY; one Mirelo glass for every pop-up and a centred detail window over a blurred mask; L11 removed; L8 on the scale of Started with a yellow "did not reach the next stage" line; L10 and C9 heatmaps; C5 returning-client approval; C8 % of leads; C10 repeat share by product; P12 bubbles per product with a card filter; R11 new vs churned; C11 Acquisition by channel and P13 Overdue by product tables that open full lists; one grey → yellow → orange → red scale for L10 / C9 / P9; a sortable leaderboard; charts no longer change the month. **The full detail data replaces the capped sample** (USER 2026-11-02): every list is complete, paged by 50, and the CSV holds every row. The board grows to the viewport height (no empty band). | 133 tests (6 files, none skipped); data 196.5 kB first paint + `detail/` 195 Parquet + `index.json` = 21.7 MB; the folder (without `node_modules`, `.next`) 263 files, 22.6 MB |

## What is inside

| Path | What |
|---|---|
| `app/layout.tsx`, `app/globals.css` | Root of this app (new): Inter via `next/font`, metadata, page resets, focus ring |
| `app/sales/page.tsx` | The dashboard: static page with a Suspense boundary. The route stays `/sales` so the `/data/sales/` paths and the URL contract are unchanged |
| `components/sales/` | UI: `SalesApp.tsx` (the only client root), header, Filters pop-up and `Calendar.tsx`, controls, cards, inline SVG charts (no chart library), the detail window (`SlideOver.tsx`), `board.ts` (board height), Mirelo's own glass pop-ups (`glass.tsx`, `glass.module.css`) |
| `lib/sales/` | Framework-free engine: every number and every string on the page (cube, metrics, KPIs and status bands, periods, the five views, detail lists, copy, formats, URL state) |
| `components/chart-scale.ts`, `lib/data/parquet-columns.ts`, `scripts/csv.ts` | **Vendored** from rusloc/pnl `js-report/` (header comment in each file); the source of truth stays there |
| `lib/test-utils/sales-data.ts` | Node-side loader for the tests |
| `public/data/sales/` | Prebuilt data, **committed** (see Data) |
| `fixtures/checks/control_totals_eur.csv` | The generator's expected totals, used by the control-totals test |
| `next.config.ts` | Security headers and CSP (see Embed), and the `/` → `/sales` redirect |

Stack: Next.js 16.4.2 (App Router, Turbopack, `cacheComponents`), React 19.3, TypeScript 5.9 strict (`noUncheckedIndexedAccess`), Zod 4, hyparquet, Vitest 5, ESLint 9 (`eslint-config-next`). Node 24 or later (`engines`).

## Run

```bash
npm ci
npm run dev          # http://localhost:3000/sales (/ redirects there)
npm run typecheck    # next typegen && tsc --noEmit
npm run lint
npm test             # Vitest
npm run build        # next build: /sales static
npm start            # next start
```

There is no `prebuild` step: the data is already in `public/data/sales/`.

## Environment variables

| Name | Read | Meaning |
|---|---|---|
| `EMBED_ALLOWED_ORIGINS` | `next.config.ts`, **at build time** (the headers are compiled into the build) | Comma-separated bare origins allowed to frame the app, for example `https://vosk.dev,https://www.vosk.dev`. Must be https (`http://localhost` and `http://127.0.0.1` are allowed for local tests). A malformed entry fails the build. Empty means same-origin framing only. |
| `NEXT_PUBLIC_SITE_URL` | inlined at build | Public URL of the deployment, used as `metadataBase`. Optional; client-safe by design. ("Copy link" copies `location.href` and does not use it.) |

There are no secrets in this app.

## Embed

- Embed `/sales` with an `<iframe>`. The app assumes nothing about the host: no `postMessage`, host CSS, auth, cookies or storage.
- **Board:** 1440 px wide and as tall as the viewport, never less than 810 px (2026-11-01, owner: no empty band under the report; `components/sales/board.ts`). At 1440 × 810 it is the px-exact design board; a taller frame gives the extra height to the chart rows and the tables. No internal scroll and no page scroll from 810 px up. The host scales it (`transform: scale()` on the wrapper or the iframe); vosk.dev's own scaler does the same fill on its side. Below 1440 px the page scrolls horizontally unless the host scales it. Outside the board the page ground is `#F3F2EF`.
- `/` answers with a 307 to `/sales` and keeps the query string (`next.config.ts` `redirects()`), so a bare-domain visit does not hit a 404. Embed `/sales` directly.
- Headers (`next.config.ts`, on every path): `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self' <EMBED_ALLOWED_ORIGINS>; base-uri 'self'; form-action 'none'; object-src 'none'`, plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. There is no `X-Frame-Options` (it would block the embed) and no `X-Powered-By`.
- Fonts: Inter, self-hosted by `next/font` at build time. The build needs network access to Google Fonts once; there are no third-party requests at runtime.
- Data fetches are absolute (`/data/sales/<file>`, the loader in `components/sales/SalesApp.tsx`). A `basePath` deploy has to prefix them.
- **URL state:** `?view=overview|loans|clients|portfolio|revenue &market=all|pl|ro|pt &from=YYYY-MM &month=YYYY-MM &cmp=budget|py &drill=loans[.pl|.ro|.pt]|agent.A001|client.123456|clients[.<market>[.<CHANNEL>]]|overdue[.<market>[.<PRODUCT>]]`. The period is the closed months `from` … `month` (`from` omitted = one month). The old `period=month|qtd|ytd|r12m` is still read when `from` is absent and rewritten to its range. Defaults are omitted (a bare URL is Overview · All markets · Sep 2026 · vs Budget). Each key is validated with Zod (`lib/sales/url-state.ts`); invalid values fall back to the default and the URL is rewritten; unknown keys are dropped.
- "Copy link" copies `location.href`. Inside a sandboxed iframe the clipboard can be blocked (give the iframe `allow="clipboard-write"`); the button then says "Copy blocked".

## Data

| File | Bytes | Load | Grain |
|---|---:|---|---|
| `manifest.json` | 43,446 | first paint | dims, FX, thresholds, file sizes (strict Zod, `lib/sales/manifest.ts`) |
| `loans-month.parquet` | 19,095 | first paint | month × market × product × channel × new / repeat |
| `funnel-month.parquet` | 42,318 | first paint | same grain, 6 funnel stages |
| `portfolio-month.parquet` | 25,346 | first paint | month-end × market × product: balances by DPD bucket, counts, write-offs, provision |
| `vintage.parquet` | 4,931 | first paint | vintage × market × months on book 0–12 |
| `window-stats.parquet` | 14,197 | first paint | time view × anchor × market × segment: distinct borrowers, returning clients, median hours / days (not additive, so computed per window) |
| `cohort-curve.parquet` | 5,095 | first paint | first-loan month × market × days 0–180 |
| `agent-month.parquet` | 13,325 | first paint | month × agent: loans, principal, quota |
| `revenue-month.parquet`, `subs-month.parquet`, `target-month.parquet` | 28,941 | first paint | copies of the source facts, closed months only |
| `detail/loans-YYYY-MM.parquet` (33) | 7,528,884 | per drill | every loan of a closed month, 613,738 in all (Show loans and the agent lists load the window's months; the largest file 331 kB) |
| `detail/cohort-YYYY-MM.parquet` (33) | 3,523,745 | per drill | every client whose first loan is in that month (279,188), with loans and principal to date and the last loan (the C11 lists) |
| `detail/overdue.parquet` | 75,979 | per drill | the 4,782 loans 30+ DPD with a balance at the last close (the P13 lists) |
| `detail/client-NN.parquet` + `client-dim-NN.parquet` (64 + 64) | 10,592,363 | per drill | every loan and every `dim_client` row (302,230), bucketed by `client_id % 64` (the client card) |
| `detail/index.json` | 13,440 | per drill | rows and bytes per detail file, the last close, the bucket count (strict Zod; the loader checks every read against it) |

First paint 196.5 kB; `detail/` 21.7 MB (195 Parquet + `index.json`), loaded only by a drill and cached per file. Loan states (status, DPD, outstanding) are the Sep 2026 snapshot for every month (the source has no history at loan grain).

**Provenance.** Built by `js-report/scripts/build-sales-data.ts` in rusloc/pnl from the generator output `data/mirelo_sales_dummy_data/parquet/*.parquet` (seed 20261026; the same data as `../../data-gen/mirelo-sales/`, control totals byte-identical). The detail files are the TypeScript port of vosk.dev's `data/mirelo/build_detail.py`: same files, rows, order and columns; the Parquet encoding (hyparquet-writer, not pyarrow) makes them 21.7 MB here against 28 MB there. The raw `fact_loan` (634 k rows, 19.6 MB) never ships as such; its 613,738 closed loans are cut into `detail/` (the 20.6 k October loans are open-month and dropped). The build checks the snapshot against `fact_loan` per vintage × market, buckets against outstanding, the funnel order, the subscriber roll-forward, `principal_eur` against the translation at the actual rate, that the detail cuts hold every closed loan and every client once, and a read-back of every file. `fixtures/checks/control_totals_eur.csv` is the generator's `checks/control_totals_eur.csv`.

**Rebuild the data in rusloc/pnl, not here:** run `npm run build:sales-data` in `js-report/`, then copy `public/data/sales/*` (and the control totals, if the generator changed) into this pack. The build script and `hyparquet-writer` are not in this pack on purpose.

## Tests

`npm test`: **6 files, 133 passed, none skipped** (2026-11-02).

- `lib/sales/control-totals.test.ts`: `control_totals_eur.csv` for ALL / PL / RO / PT × Sep 2026, FY2024, FY2025 and FY2026 YTD Sep (loans, principal, new clients, borrowers, returning clients and both returning %, outstanding, 30+ balance, 30+ / 90+ %, revenue in total and per stream), and every closed month × market.
- `lib/sales/engine.test.ts`: hero strings, a sweep of every view × market × time view × comparator (no NaN / undefined), a zero bridge residual, ⓘ copy on every card; every detail list reconciled to its aggregate (window loans, an agent's loans, a channel's first loans, a product's 30+ DPD count) and the change note's values (Partner new clients Sep 2026 = 2,846, loans 30+ DPD at the close = 4,782, Sep 2026 YTD loans = 209,898 in 4,198 pages, C11 per channel, C5, L8, the filter line); the round 3–4 cards (L8, L10 / C9 / P9 heat scale, C5, R11, C11, P13, the sortable leaderboard).
- `periods.test.ts`, `kpis.test.ts`, `url-state.test.ts`, `units.test.ts`: periods and labels, KPI rows, the URL codec (incl. legacy `period`), formats.

## What is still draft

- **Not built:** mark-click cross-filtering and filter chips. Charts no longer set the month (owner, change 22): the period changes only in the Filters pop-up.
- **n/a on free ranges:** returning % and the time medians show "n/a" for a custom range that is not a month, a calendar quarter, a year (to its last closed month) or 12 months: `window-stats.parquet` holds those non-additive figures for Month / QTD / YTD / R12M windows only. Open with the owner (precompute, or limit the calendar).
- **Week** is not offered: the data set is monthly.
- The page `description` metadata still starts with "Draft".
- Open questions with the USER (they may change numbers or columns later): Budget for interest vs fees (the Budget is set per product only); the leaderboard columns Approval % and Pace (there is no agent funnel); the loan-state snapshot used for every anchor month.

## Differences from `js-report/`

- New `app/layout.tsx` and `app/globals.css`. In `js-report/`, `/sales` sits under the P&L root layout and its global CSS (IBM Plex, Ledger tokens, `min-width: 1024px`, blue focus ring); that no longer applies. The new root loads Inter only and keeps the same resets (`box-sizing`, zero body margin, `button` / `input` inherit the font). `app/sales/layout.tsx` is gone: its Inter font and metadata moved to the root. Rendering is unchanged: headless screenshots of five URLs at 1440 × 810 are pixel-identical to `js-report/` `/sales`.
- `next.config.ts`: the same headers, plus the `/` → `/sales` redirect.
- `package.json`: no `prebuild`, `build:*` or `export:*` scripts; no `hyparquet-writer`. The lockfile is regenerated to match.
- `public/data/sales/` is committed, `detail/` included (in `js-report/` it is build output and ignored).
- `lib/test-utils/sales-data.ts`: `SALES_DATA_DIR` points to `fixtures/`; the missing-file message no longer says to run `build:sales-data`.
- `lib/sales/engine.test.ts` is identical to `js-report/` since 2026-11-02 (the `fact_loan` block it skipped here is gone: the lists are reconciled to the aggregates instead).
- Three vendored files carry a header comment; nothing else in them changed. The glass pop-ups are no longer vendored: Mirelo has its own copy in `components/sales/` (in `js-report/` the P&L keeps `components/glass.tsx` unchanged).
- Left out: `app/sales/README.md` (its content is folded into this README; the original stays in rusloc/pnl).

## Checks run on this folder (2026-11-02)

- `npm run typecheck`, `npm run lint`: clean.
- `npm test`: 6 files, 133 passed.
- `npm run build`: `/sales` static.
- `next start`: `/sales` and `/data/sales/detail/index.json` return 200; `/` returns 307 to `/sales` with the query kept; CSP as above. Headless Chromium (Playwright): no page scroll at 1440 × 810 and at 1440 × 1000 (the board fills it); four "Details →" hero labels; the Filters pop-up 420 × 514 in all four calendar modes, no scroll; Q3 2026 · Romania · Prior year gives "Showing Jul–Sep 2026 - Quarter - Romania - Actual vs Prior year and Budget - Closed through Sep 2026"; a cross-year custom range Nov 2025 – Feb 2026; Reset; `?period=ytd&month=2026-06` rewritten to `?from=2026-01&month=2026-06`; Show loans at Sep 2026 YTD paged to its last page (4,198, "209,851–209,898 of 209,898"); the C11 Partner list (2,846 rows, 57 pages), its CSV export 2,846 rows, a row → client card → Back; the overdue list; the three heatmaps on the four-stop scale; the leaderboard sorted both ways; the Mirelo glass (`rgba(244,243,240,.32)`, 12 px, blur 28 px) with no Source line. No console or CSP errors.
