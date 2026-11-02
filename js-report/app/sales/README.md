# `/sales` — Mirelo Sales & Revenue (Track C, draft)

> **DRAFT.** Mirelo ships in two flavours: this JS app and a Power BI report (USER 2026-10-27). Built per ADR-0011 (c) (Proposed) and ADR-0012 (visual first, minimum text) against `docs/design/sales-revenue dashboard/` (`design-tokens.md`, `layout-spec.md`, `mockup.html`). Fictional company; all data is generated (`data/mirelo_sales_dummy_data/`). Nothing here touches the P&L route, engine or data.

## Route

| Piece          | Where                                                | Notes                                                                                               |
| -------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Route          | `app/sales/page.tsx`, `app/sales/layout.tsx`         | Static shell (prerendered), Inter via `next/font` (self-hosted, CSP `font-src 'self'`)              |
| UI             | `components/sales/`                                  | `SalesApp.tsx` is the only `'use client'` entry; inline SVG charts (`charts.tsx`), no chart library |
| Engine         | `lib/sales/`                                         | Framework-free; every number and every string on the page                                           |
| Data build     | `scripts/build-sales-data.ts` → `public/data/sales/` | Runs in `prebuild` after the P&L build                                                              |
| Shared tooling | `lib/data/parquet-columns.ts`                        | Typed hyparquet column reader (new; the P&L loader is unchanged)                                    |

Board: 1440 px wide, px-exact to `layout-spec.md` at 810 px high; since 2026-11-01 it is as tall as the viewport (never less than 810) and the extra height goes to the chart rows and tables (`components/sales/board.ts`); the host scales it (design-tokens §4). URL state: `?view=overview|loans|clients|portfolio|revenue &market=all|pl|ro|pt &from=YYYY-MM &month=YYYY-MM &cmp=budget|py &drill=loans[.pl|.ro|.pt]|agent.A001|client.123456|clients[.<market>[.<CHANNEL>]]|overdue[.<market>[.<PRODUCT>]]`; the period is the closed months `from` … `month`, and the old `period=month|qtd|ytd|r12m` still parses and is rewritten to its range. Defaults are omitted (bare URL = Overview · All markets · Sep 2026 · vs Budget). Each key is validated with Zod (`lib/sales/url-state.ts`); invalid values fall back to the default and the URL is rewritten; unknown keys are dropped.

## Data build (`npm run build:sales-data`)

Reads `data/mirelo_sales_dummy_data/parquet/*.parquet` (never the CSVs). `fact_loan` (634 k rows, 19.6 MB) does not ship. The October 2026 open-month loans (20.6 k) are dropped, because only closed months can be selected.

| File                                                                    |                Rows |    Size | Load        | Grain                                                                                                                                                                       |
| ----------------------------------------------------------------------- | ------------------: | ------: | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loans-month.parquet`                                                   |               2,239 |   19 kB | first paint | month × market × product × channel × new / repeat: loans, principal local                                                                                                   |
| `funnel-month.parquet`                                                  |               2,254 |   42 kB | first paint | month × market × product × channel × new / repeat: 6 funnel stages                                                                                                          |
| `portfolio-month.parquet`                                               |                 425 |   25 kB | first paint | month-end × market × product: balances by DPD bucket, active / 30+ counts, write-offs, provision                                                                            |
| `vintage.parquet`                                                       |               1,053 |    5 kB | first paint | vintage × market × months on book 0–12: first 30+ / 90+                                                                                                                     |
| `window-stats.parquet`                                                  |               1,584 |   14 kB | first paint | time view × anchor × market × client segment: distinct borrowers, returning clients, MEDIANX hours / days. These do not add up over months, so they are computed per window |
| `cohort-curve.parquet`                                                  |               1,287 |    5 kB | first paint | first-loan month × market × days 0–180: clients with a second loan, observable flag                                                                                         |
| `agent-month.parquet`                                                   |               1,462 |   13 kB | first paint | month × agent: loans, principal, quota                                                                                                                                      |
| `revenue-month.parquet` / `subs-month.parquet` / `target-month.parquet` | 1,147 / 297 / 2,096 |   29 kB | first paint | copies of the source facts (closed months only)                                                                                                                             |
| `detail/` (195 Parquet + `index.json`)                                  |  613,738 loans etc. | 21.7 MB | per drill   | full loan / client detail (below)                                                                                                                                           |
| `manifest.json`                                                         |                   — |   43 kB | first paint | dims, FX, thresholds, file sizes (strict Zod, `lib/sales/manifest.ts`)                                                                                                      |

**First paint 196.5 kB** (budget 600 kB; the build fails above 3 MB), **`detail/` 21.7 MB** (USER 2026-11-02: the full data ships; the build fails above 40 MB). The build cross-checks: the snapshot's disbursed counts equal `fact_loan` per vintage × market; buckets sum to outstanding; the funnel is monotonic; subscriber roll-forward holds; every file passes a read-back round trip.

**Full detail (detail window; 2026-11-01, owner change 30, replaces the capped sample).** A port of vosk.dev's `data/mirelo/build_detail.py`: `detail/loans-YYYY-MM` (every loan of a closed month), `cohort-YYYY-MM` (every client whose first loan is in that month, with loans / principal to date and the last loan), `overdue` (the 4,782 loans 30+ DPD with a balance at the last close), and per `client_id % 64` `client-NN` (loans) + `client-dim-NN` (`dim_client` rows); `index.json` lists rows and bytes (`lib/sales/manifest.ts` `DETAIL`). A drill loads only its files (`engine.detailFiles`); every list is complete, paged by 50, and its CSV holds every row. Tests reconcile each list to its aggregate. Loan states (status, DPD, outstanding) are the Sep 2026 snapshot (the source has no history at loan grain).

## Engine (`lib/sales/`)

`createSalesEngine(base)` → `codec`, `header(sel)`, `overview(sel)`, `band(sel)`, `detailFiles(sel, drill)`, `slideOver(sel, detailParts, drill)`. Modules: `cube.ts` (additive primitives; EUR translation per row = month × currency, ACTUAL_AVG for actuals, BUDGET for Budget), `metrics.ts` (Tier-1 and KPI definitions, ADR-0011 (g) and the data README), `kpis.ts` / `status.ts` (comparator rows, design-tokens §6 bands; absolute attainment band from `param_thresholds`), `overview.ts`, `loans.ts` (with the Budget → Actual bridge), `clients.ts`, `portfolio.ts`, `revenue.ts`, `detail.ts`, `copy.ts` (all UI copy, ⓘ texts, story callouts), `format.ts` (design-tokens §8), `url-state.ts`.

Tests (`npm test`): `control-totals.test.ts` checks `checks/control_totals_eur.csv` for ALL / PL / RO / PT × Sep 2026, FY2024, FY2025 and FY2026 YTD Sep: loans, principal, new clients, borrowers, returning clients and both returning %, outstanding, 30+ balance, 30+ / 90+ %, and revenue in total and per stream. It also checks every closed month × market. `engine.test.ts` covers hero strings, a sweep of every view × market × time view × comparator (no NaN / undefined), a zero bridge residual, every detail list against its aggregate and the change note's values of 2026-11-01. `periods.test.ts`, `kpis.test.ts`, `url-state.test.ts` and `units.test.ts` cover the rest.

## USER review 2026-10-27 (applied)

- No "Showing …" period line under the title. The sentence, including the clipped-window note for R12M before Dec 2024, is the period picker's tooltip and the first line of the "How to read" pop-up (`engine.header().periodLine`).
- No 16 × 16 corner markers on the cards. The card titles stay at the 16 px padding edge, and nothing else moved.
- No sparklines in the hero cards (`docs/design/design-requirements.md` §1 "Visual first, minimum text").
- ADR-0012 card face (follow-up done): every hero / KPI card shows title · value · delta rows · status chip (glyph + word, from the header comparator; hero falls back to the other row when it has no value). The former sub-lines are labelled sub-values inside the card's ⓘ.
- ⓘ on every card and panel: a plain upright "i" (SVG) at the bottom-left; tables carry it in the title row because their rows reach the bottom edge. The pop-up shows what it is · why it matters · formula in words · sub-values · source table. Copy is in `lib/sales/copy.ts` (`info(id, values)`), and a test checks that every card in every view has all four texts.
- One "How to read" per view (five), header right: the Showing sentence (incl. the clipped-window note), then top band · grid · table · legend (`engine.header().howToRead`).
- Table footnotes moved into the table ⓘ; an empty or loading table shows one line in place of rows.
- Glass pop-ups from the shared `components/glass.tsx` (also used by the P&L views, ADR-0012 §2.5): about 74 % white, 16 px blur, 16 px radius, solid fallback without `backdrop-filter`. One open at a time (a view change closes it); Escape, outside click and × close; focus moves to × and returns to the ⓘ; Tab stays inside. Hero diverging bar 144 × 6 (tokens say 160; 144 keeps the 16 px right padding).

## What is draft / placeholder

- **Complete:** the Overview (4 heroes, 2 × 2 why grid, market table) and the KPI bands of all five views.
- **Built with data:** every chart card of views 2–5 except the one below, plus the leaderboard, clients, overdue and stream tables, and the slide-over (loan list → client card, Back, Export CSV, Esc / scrim close, focus trap).
- **Owner changes 2026-11-01 (1–33, applied 2026-11-02)** per `.sync/2026-11-01-mirelo-sales-changes.md`: Filters pop-up with a calendar, Details on hero cards, ⓘ before titles without Source, both comparator rows on KPI cards, Mirelo's own glass (`components/sales/glass.*`; the P&L glass is unchanged), centred detail window over a blurred mask, L11 removed, new L8 / L10 / C5 / C8–C11 / P12 / P13 / R11, one heat scale, sortable leaderboard, full detail data with paging and full CSV. The glass notes in "USER review 2026-10-27" above describe the pre-2026-11-01 look.
- **Not built:** mark-click cross-filtering and filter chips; charts no longer set the month (change 22). The ⓘ copy is exported to `docs/ADD/features/sales-info-popovers.md` by `npm run export:info-copy`.
- **n/a on free ranges:** returning % and the time medians are "n/a" for a custom range that window-stats does not cover (open with the owner).

## Run

```bash
cd js-report
npm run build:sales-data      # once, or after the generator changes (the P&L needs `npm run build:data`)
npm test                      # 133 sales tests + the P&L suite
npm run build && npm start    # → http://localhost:3000/sales
```
