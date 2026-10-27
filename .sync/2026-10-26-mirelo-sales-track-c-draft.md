# Mirelo Sales & Revenue — Track C draft route `/sales`

- **From:** rusloc/pnl (Track C, nerd)
- **To:** vosk.dev repo agent
- **Date:** 2026-10-26
- **Status:** draft (ADR-0011 is Proposed). Two flavours: JS app (this route) + Power BI report (USER 2026-10-27). ADR-0012 card face and pop-ups applied 2026-10-27 (visual only; embed contract unchanged)

Source of truth: `js-report/app/sales/README.md`, `docs/ADR/0011-mirelo-sales-revenue-report.md`, and `docs/design/sales-revenue dashboard/` (`design-tokens.md`, `layout-spec.md`, `mockup.html`). This note is the shared copy for embedding.

## 1. Route

- `js-report/app/sales/` is a static App Router route in the same Next.js 16 app as the P&L (`/`). It has no server data: the browser loads `/data/sales/*` and runs the engine `js-report/lib/sales/`.
- Files to vendor: `app/sales/**`, `components/sales/**`, `lib/sales/**`, `lib/data/parquet-columns.ts`, `scripts/build-sales-data.ts`, plus the `build:sales-data` script and the `prebuild` line in `package.json`.
- Dependencies: no new ones. It uses `hyparquet` (runtime), `hyparquet-writer` (build), `zod` and `next/font/google` (Inter, self-hosted at build).

## 2. Data files (`js-report/public/data/sales/`, build output, gitignored)

| File | Size | When |
|---|---:|---|
| `manifest.json` + 10 base Parquet files | 197 kB | first paint |
| `detail-loans.parquet` | 586 kB | lazy: Clients / Portfolio views or the first slide-over |
| `detail-clients.parquet` | 132 kB | lazy, with the above |
| **Total** | **915 kB** | budget 3 MB; the build fails above 4 MB |

The build reads `data/mirelo_sales_dummy_data/parquet/*.parquet` (the generator's output in this repo). The other repo needs either that folder or a copy of the built `public/data/sales/`. No copy is in `.sync/` yet, because the draft is not accepted; ask for one if needed.

## 3. Env vars

None new. The route uses the app's existing names: `NEXT_PUBLIC_SITE_URL` (metadata base) and `EMBED_ALLOWED_ORIGINS` (server-side, CSP `frame-ancestors`).

## 4. Embed notes

- **Board:** fixed 1440 × 810 px, no internal scroll, and no horizontal scroll at a 1440 × 810 viewport (checked headless). The host scales it (design-tokens §4: `transform: scale()` on the wrapper or the iframe). Below 1440 px the page scrolls horizontally unless the host scales it.
- **Data paths:** fetches are absolute (`/data/sales/<file>`), like the P&L. A `basePath` deploy has to prefix them (`components/sales/SalesApp.tsx`, the `loader`).
- **URL state:** `?view=&market=&period=&month=&cmp=&drill=`, with lowercase values (see the README). It is validated with Zod; invalid values are rewritten to defaults and unknown keys are dropped. "Copy link" copies `location.href`; inside a sandboxed iframe the clipboard can be blocked, and the button then says "Copy blocked".
- **Fonts:** the `/sales` layout loads Inter only. The P&L keeps IBM Plex on the root layout.
- **CSP:** unchanged (`next.config.ts`). No inline `style` beyond React style props, no external origins, and no console errors in the headless check.

## 5. Status

- 2026-10-27 USER review, visual only (embed contract unchanged): the period line under the title is gone (its text now sits in the period picker tooltip and the How-to-read pop-up), and the card corner markers and hero sparklines are removed.

- Overview is complete to the px spec. Views 2–5 have their 6 KPI cards and data-backed charts; L11 *Attainment by channel* is a labelled placeholder (no channel targets in the data). Mark-click cross-filtering is not built; clicking a month on a trend chart sets the month.
- Control totals (`checks/control_totals_eur.csv`) reconcile for ALL / PL / RO / PT × Sep 2026, FY2024, FY2025 and FY2026 YTD Sep, and for every closed month.
- Open questions for the USER are listed in the main agent's report (Budget for interest vs fees, the leaderboard columns, R12M before Dec 2024, the loan-state snapshot).
