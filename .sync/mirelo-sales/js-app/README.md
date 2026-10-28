# Mirelo Sales & Revenue — standalone JS app

- **From:** rusloc/pnl (nerd)
- **To:** vosk.dev repo agent
- **Date:** 2026-10-28
- **Status:** ready (the app builds, tests and runs on its own). Parts still draft in the product: see "What is still draft".

A complete, standalone Next.js 16 app for the Mirelo sales dashboard (ADR-0011 (c), Accepted 2026-10-27; ADR-0012 visual first). Mirelo is a fictional neobank and microlender (PL, RO, PT); all data is generated. Copy this folder into the vosk.dev repo, `npm ci`, build, host and embed it. The source of truth stays in rusloc/pnl (`js-report/`, route `/sales`); this folder is a copy as of 2026-10-28, with the changes listed under "Differences from js-report/". It supersedes the vendoring list in `../../2026-10-26-mirelo-sales-track-c-draft.md` §1.

## What is inside

| Path | What |
|---|---|
| `app/layout.tsx`, `app/globals.css` | Root of this app (new): Inter via `next/font`, metadata, page resets, focus ring |
| `app/sales/page.tsx` | The dashboard: static page with a Suspense boundary. The route stays `/sales` so the `/data/sales/` paths and the URL contract are unchanged |
| `components/sales/` | UI: `SalesApp.tsx` (the only client root), header and controls, cards, inline SVG charts (no chart library), slide-over, glass pop-up wiring |
| `lib/sales/` | Framework-free engine: every number and every string on the page (cube, metrics, KPIs and status bands, the five views, detail sample, copy, formats, URL state) |
| `components/glass.tsx`, `glass.module.css`, `components/chart-scale.ts`, `lib/data/parquet-columns.ts`, `scripts/csv.ts` | **Vendored** from rusloc/pnl `js-report/` (header comment in each file); the source of truth stays there |
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
- **Board:** fixed 1440 × 810 px, px-exact to the layout spec, no internal scroll and no page scroll at a 1440 × 810 viewport. The host scales it (`transform: scale()` on the wrapper or the iframe). Below 1440 px the page scrolls horizontally unless the host scales it. Outside the board the page ground is `#F3F2EF`.
- `/` answers with a 307 to `/sales` and keeps the query string (`next.config.ts` `redirects()`), so a bare-domain visit does not hit a 404. Embed `/sales` directly.
- Headers (`next.config.ts`, on every path): `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self' <EMBED_ALLOWED_ORIGINS>; base-uri 'self'; form-action 'none'; object-src 'none'`, plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. There is no `X-Frame-Options` (it would block the embed) and no `X-Powered-By`.
- Fonts: Inter, self-hosted by `next/font` at build time. The build needs network access to Google Fonts once; there are no third-party requests at runtime.
- Data fetches are absolute (`/data/sales/<file>`, the loader in `components/sales/SalesApp.tsx`). A `basePath` deploy has to prefix them.
- **URL state:** `?view=overview|loans|clients|portfolio|revenue &market=all|pl|ro|pt &period=month|qtd|ytd|r12m &month=YYYY-MM &cmp=budget|py &drill=loans[.pl|.ro|.pt]|agent.A001|client.123456`. Defaults are omitted (a bare URL is Overview · All markets · Month · Sep 2026 · vs Budget). Each key is validated with Zod (`lib/sales/url-state.ts`); invalid values fall back to the default and the URL is rewritten; unknown keys are dropped.
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
| `detail-loans.parquet` | 585,768 | lazy | capped loan sample (top 50 per month × market, top 10 per agent × month, 100 worst overdue per market, top 20 clients per first-loan month × market, plus every loan of each sampled client) |
| `detail-clients.parquet` | 132,140 | lazy | `dim_client` rows of every sampled client |

First paint 197 kB; total 915 kB. Loan states (status, DPD, outstanding) are the Sep 2026 snapshot for every month (the source has no history at loan grain).

**Provenance.** Built by `js-report/scripts/build-sales-data.ts` in rusloc/pnl from the generator output `data/mirelo_sales_dummy_data/parquet/*.parquet`. The raw `fact_loan` (634 k rows, 19.6 MB) never ships; it is folded into the monthly files and the detail sample. The build checks the snapshot against `fact_loan` per vintage × market, buckets against outstanding, the funnel order, the subscriber roll-forward and a read-back of every file. `fixtures/checks/control_totals_eur.csv` is the generator's `checks/control_totals_eur.csv`.

**Rebuild the data in rusloc/pnl, not here:** run `npm run build:sales-data` in `js-report/`, then copy `public/data/sales/*` (and the control totals, if the generator changed) into this pack. The build script and `hyparquet-writer` are not in this pack on purpose.

## Tests

`npm test`: **4 files, 92 passed, 4 skipped** (2026-10-28).

- `lib/sales/control-totals.test.ts`: `control_totals_eur.csv` for ALL / PL / RO / PT × Sep 2026, FY2024, FY2025 and FY2026 YTD Sep (loans, principal, new clients, borrowers, returning clients and both returning %, outstanding, 30+ balance, 30+ / 90+ %, revenue in total and per stream), and every closed month × market.
- `lib/sales/engine.test.ts`: hero strings, a sweep of every view × market × time view × comparator (no NaN / undefined), a zero bridge residual, ⓘ copy on every card.
- `url-state.test.ts`, `units.test.ts`: URL codec and formats.
- **Skipped (4):** the block "detail sample is exact for its caps" in `engine.test.ts`. It compares the sample with the raw `fact_loan.parquet`, which is not shipped; it runs in rusloc/pnl and skips here (`describe.skipIf`).

## What is still draft

- **Placeholder:** L11 *Attainment by channel* reads "Not available - no channel targets" (the dataset has no channel targets).
- **Not built:** mark-click cross-filtering and filter chips. Clicking a month on a trend chart does set the month.
- The page `description` metadata still starts with "Draft".
- Open questions with the USER (they may change numbers or columns later): Budget for interest vs fees (the Budget is set per product only); the leaderboard columns Approval % and Pace (there is no agent funnel); the loan-state snapshot used for every anchor month.

## Differences from `js-report/`

- New `app/layout.tsx` and `app/globals.css`. In `js-report/`, `/sales` sits under the P&L root layout and its global CSS (IBM Plex, Ledger tokens, `min-width: 1024px`, blue focus ring); that no longer applies. The new root loads Inter only and keeps the same resets (`box-sizing`, zero body margin, `button` / `input` inherit the font). `app/sales/layout.tsx` is gone: its Inter font and metadata moved to the root. Rendering is unchanged: headless screenshots of five URLs at 1440 × 810 are pixel-identical to `js-report/` `/sales`.
- `next.config.ts`: the same headers, plus the `/` → `/sales` redirect.
- `package.json`: no `prebuild`, `build:*` or `export:*` scripts; no `hyparquet-writer`. The lockfile is regenerated to match.
- `public/data/sales/` is committed (in `js-report/` it is build output and ignored).
- `lib/test-utils/sales-data.ts`: `SALES_DATA_DIR` points to `fixtures/`; the missing-file message no longer says to run `build:sales-data`.
- `lib/sales/engine.test.ts`: `describe.skipIf` on the `fact_loan` block (above).
- Five vendored files carry a header comment; nothing else in them changed.
- Left out: `app/sales/README.md` (its content is folded into this README; the original stays in rusloc/pnl).

## Checks run on this folder (2026-10-28)

- `npm run typecheck`, `npm run lint`: clean.
- `npm test`: 4 files, 92 passed, 4 skipped.
- `npm run build`: `/sales` static.
- `next start`: `/sales` (with and without query) and `/data/sales/*` return 200; `/` returns 307 to `/sales` with the query kept; headers as above. Headless Chromium at 1440 × 810 on Overview, Loans issued (RO), Clients, Portfolio quality (YTD) and Revenue & targets (through the `/` redirect): no console or CSP errors, no page scroll, pixel-identical to `js-report/`.
