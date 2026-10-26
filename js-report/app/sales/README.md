# `/sales` — Mirelo Sales & Revenue (Track C, draft)

> **DRAFT.** Built per ADR-0011 (c) (Proposed) against `docs/design/sales-revenue dashboard/` (`design-tokens.md`, `layout-spec.md`, `mockup.html`). Fictional company; all data is generated (`data/mirelo_sales_dummy_data/`). Nothing here touches the P&L route, engine or data.

## Route

| Piece | Where | Notes |
|---|---|---|
| Route | `app/sales/page.tsx`, `app/sales/layout.tsx` | Static shell (prerendered), Inter via `next/font` (self-hosted, CSP `font-src 'self'`) |
| UI | `components/sales/` | `SalesApp.tsx` is the only `'use client'` entry; inline SVG charts (`charts.tsx`), no chart library |
| Engine | `lib/sales/` | Framework-free; every number and every string on the page |
| Data build | `scripts/build-sales-data.ts` → `public/data/sales/` | Runs in `prebuild` after the P&L build |
| Shared tooling | `lib/data/parquet-columns.ts` | Typed hyparquet column reader (new; the P&L loader is unchanged) |

Board: fixed 1440 × 810, px-exact to `layout-spec.md`; the host scales it (design-tokens §4). URL state: `?view=overview|loans|clients|portfolio|revenue &market=all|pl|ro|pt &period=month|qtd|ytd|r12m &month=YYYY-MM &cmp=budget|py &drill=loans[.pl|.ro|.pt]|agent.A001|client.123456`. Defaults are omitted (bare URL = Overview · All markets · Month · Sep 2026 · vs Budget). Each key is validated with Zod (`lib/sales/url-state.ts`); invalid values fall back to the default and the URL is rewritten; unknown keys are dropped.

## Data build (`npm run build:sales-data`)

Reads `data/mirelo_sales_dummy_data/parquet/*.parquet` (never the CSVs). `fact_loan` (634 k rows, 19.6 MB) does not ship. The October 2026 open-month loans (20.6 k) are dropped, because only closed months can be selected.

| File | Rows | Size | Load | Grain |
|---|---:|---:|---|---|
| `loans-month.parquet` | 2,239 | 19 kB | first paint | month × market × product × channel × new / repeat: loans, principal local |
| `funnel-month.parquet` | 2,254 | 42 kB | first paint | month × market × product × channel × new / repeat: 6 funnel stages |
| `portfolio-month.parquet` | 425 | 25 kB | first paint | month-end × market × product: balances by DPD bucket, active / 30+ counts, write-offs, provision |
| `vintage.parquet` | 1,053 | 5 kB | first paint | vintage × market × months on book 0–12: first 30+ / 90+ |
| `window-stats.parquet` | 1,584 | 14 kB | first paint | time view × anchor × market × client segment: distinct borrowers, returning clients, MEDIANX hours / days. These do not add up over months, so they are computed per window |
| `cohort-curve.parquet` | 1,287 | 5 kB | first paint | first-loan month × market × days 0–180: clients with a second loan, observable flag |
| `agent-month.parquet` | 1,462 | 13 kB | first paint | month × agent: loans, principal, quota |
| `revenue-month.parquet` / `subs-month.parquet` / `target-month.parquet` | 1,147 / 297 / 2,096 | 29 kB | first paint | copies of the source facts (closed months only) |
| `detail-loans.parquet` | 48,688 | 586 kB | lazy | capped loan sample (below) |
| `detail-clients.parquet` | 18,493 | 132 kB | lazy | `dim_client` rows of every client in the sample |
| `manifest.json` | — | 43 kB | first paint | dims, FX, thresholds, file sizes (strict Zod, `lib/sales/manifest.ts`) |

**First paint 197 kB, total 915 kB** (budget 3 MB; the build fails above 4 MB). The build cross-checks: the snapshot's disbursed counts equal `fact_loan` per vintage × market; buckets sum to outstanding; the funnel is monotonic; subscriber roll-forward holds; every file passes a read-back round trip.

**Detail sample (slide-over, Clients and Portfolio tables).** The build ships the top 50 loans by principal per month × market, the top 10 per agent × month, the 100 worst overdue loans per market (DPD, then outstanding), and the top 20 clients by principal to date per first-loan month × market. It also ships the **whole loan history of every client** in the sample. Each list is therefore exact for its cap over any window. A test checks this against the raw `fact_loan`. Counts in titles ("5,412 loans - Romania - Sep 2026") come from the aggregates, and the rows come from the sample. Loan states (status, DPD, outstanding) are the Sep 2026 snapshot (the source has no history at loan grain).

## Engine (`lib/sales/`)

`createSalesEngine(base)` → `codec`, `header(sel)`, `overview(sel)`, `band(sel, detailIndex)`, `slideOver(sel, detailIndex, drill)`, `indexDetail(detail)`, `needsDetail(sel)`. Modules: `cube.ts` (additive primitives; EUR translation per row = month × currency, ACTUAL_AVG for actuals, BUDGET for Budget), `metrics.ts` (Tier-1 and KPI definitions, ADR-0011 (g) and the data README), `kpis.ts` / `status.ts` (comparator rows, design-tokens §6 bands; absolute attainment band from `param_thresholds`), `overview.ts`, `loans.ts` (with the Budget → Actual bridge), `clients.ts`, `portfolio.ts`, `revenue.ts`, `detail.ts`, `copy.ts` (all UI copy, ⓘ texts, story callouts), `format.ts` (design-tokens §8), `url-state.ts`.

Tests (`npm test`): `control-totals.test.ts` checks `checks/control_totals_eur.csv` for ALL / PL / RO / PT × Sep 2026, FY2024, FY2025 and FY2026 YTD Sep: loans, principal, new clients, borrowers, returning clients and both returning %, outstanding, 30+ balance, 30+ / 90+ %, and revenue in total and per stream. It also checks every closed month × market. `engine.test.ts` covers hero strings, a sweep of every view × market × time view × comparator (no NaN / undefined), a zero bridge residual, and the detail sample against the raw `fact_loan`. `url-state.test.ts` and `units.test.ts` cover the rest.

## What is draft / placeholder

- **Complete:** the Overview (4 heroes, 2 × 2 why grid, market table) and the KPI bands of all five views.
- **Built with data:** every chart card of views 2–5 except the one below, plus the leaderboard, clients, overdue and stream tables, and the slide-over (loan list → client card, Back, Export CSV, Esc / scrim close, focus trap).
- **Placeholder:** L11 *Attainment by channel*, because the dataset has no channel targets.
- **Not built:** mark-click cross-filtering and filter chips, except clicking a month on the trend charts, which sets the selected month. Also the `docs/ADD/features/sales-info-popovers.md` shared ⓘ source; the ⓘ copy lives in `lib/sales/copy.ts` for now.

## Run

```bash
cd js-report
npm run build:sales-data      # once, or after the generator changes (the P&L needs `npm run build:data`)
npm test                      # 88 sales tests + the P&L suite
npm run build && npm start    # → http://localhost:3000/sales
```
