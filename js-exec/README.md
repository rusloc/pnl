# js-exec — Nordmark Retail executive dashboard (JS flavour)

Standalone Next.js 16 app (ADR-0013 (h)) for the Nordmark Retail executive dashboard: one landing page at 1440 × 810, built
from prototype v5 (`docs/design/executive dashboard (reseller)/prototype.html` + `README.md`). Requirements:
`docs/Requirements-exec.md` (E-nn, ET-nn). Data contract: `data/nordmark_retail_dummy_data/README.md`, which wins over
layout names (ADR-0013 (j)). The Power BI flavour is `pbi-report/Nordmark Exec/` (separate build, no shared files).

## Run

```powershell
cd js-exec
npm ci
npm run build:data   # ../data/nordmark_retail_dummy_data/parquet → public/data (also runs as prebuild)
npm test             # Vitest; reads public/data, so build the data first
npm run build        # prebuild (data) + next build
npm start            # http://localhost:3000
```

Gate: `npm run typecheck && npm run lint && npm test && npm run build`. Node ≥ 24 (the data build runs on Node's native
type stripping). No env var is needed for a local build. Runtime hooks: `NEXT_PUBLIC_SITE_URL` (optional, metadata base)
and `EMBED_ALLOWED_ORIGINS` (server-side, comma-separated origins for CSP `frame-ancestors`).

Dependencies are pinned to the `js-report/` versions (Next 16.4.2, React 19.3.1, hyparquet 1.31.5, hyparquet-writer 0.17.0,
Zod 4.6.7, Vitest 5.0.5, ESLint 9.39.5, TypeScript 5.9.3); `package-lock.json` differs from js-report's only in the name.

## Layout

```
app/              layout.tsx (Inter via next/font), page.tsx (static shell + Suspense), globals.css (the v5 stylesheet)
components/       ExecApp.tsx (client root: data load, URL state, layers, tooltip), Card.tsx, Layers.tsx, ui.tsx, bars.ts
lib/data/         manifest.ts (Zod contract of public/data), loader.ts, parquet-columns.ts (vendored from js-report)
lib/engine/       cube.ts, calendar.ts, metrics.ts, status.ts, format.ts, copy.ts, view.ts, url-state.ts (+ tests)
lib/test-utils/   exec-data.ts (Node loader + control totals reader)
scripts/          build-exec-data.ts, csv.ts (vendored from js-report)
public/data/      build output, gitignored here (as js-report/public/data); the .sync pack ships it prebuilt
```

- **Engine** (`lib/engine/`, framework-free): `metrics.ts` computes every control-total metric for a scope × window;
  `status.ts` holds the status bands and the literal v5 dot rule, reading the thresholds from `param_status_rule` only
  (E-75); `view.ts` turns metrics into card faces, Δ texts, bars, ⓘ worked examples and mini stats. Components render
  strings; they compute nothing.
- **Rendering:** the route is a static shell (`○ /`); the client reads the query string and loads `public/data` (no server,
  no API). URL keys: `p` (week · ptd · ytd), `c` (budget · ly · lw), `r` (all · nl · be · online), `group`, `lever`,
  `horizon`, `owner`, `statement` (comma lists). Each key is validated with Zod; unknown keys and bad values are dropped and
  the URL is rewritten to the canonical form.
- **Security headers** (`next.config.ts`, ADR-0002 §2.6, E-82): CSP `default-src 'self'`, `frame-ancestors` from
  `EMBED_ALLOWED_ORIGINS`, no `X-Frame-Options`, nosniff, referrer and permissions policies. `script-src 'unsafe-inline'` is
  the same day-one compromise as the P&L and Mirelo apps (nonces deferred).

## Data provenance and size

Source: `data/nordmark_retail_dummy_data/parquet/` (generator seed 20261028, as-of FY2026 W43 = 19–25 Oct 2026, refresh
stamp from its `manifest.json`). `scripts/build-exec-data.ts` folds the facts into four pre-aggregated files; stores,
suppliers and SKUs never ship (E-83). Every fold is reconciled to the source totals before writing; the build fails over
4 MB.

| File            |  Rows |       Bytes | Grain                                                                                                                                                                           |
| --------------- | ----: | ----------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cube.parquet`  | 4,599 |     384,427 | week × site group (NL stores, BE stores, ONLINE, WHOLESALE, DC, central) × category: sales, LFL sales (current and as-LY), budget, stock, forecast COGS, availability, receipts |
| `opex.parquet`  | 1,029 |       8,932 | scenario × week × cost type × site group                                                                                                                                        |
| `po.parquet`    |    95 |       1,685 | week: PO lines due / OTIF, suppliers below 85 %                                                                                                                                 |
| `sites.parquet` |   190 |       1,355 | week × site group: trading stores, LFL stores                                                                                                                                   |
| `manifest.json` |     — |      55,380 | calendar (104 weeks), categories, the 32 KPIs, status rules, targets, file index (strict Zod)                                                                                   |
| **Total**       |       | **451,779** | all of it loads at first paint (E-83 budget 600 kB)                                                                                                                             |

## Tests (Vitest, 86 tests in 7 files)

| File                                | Tests | Covers                                                                                                                                                                                                           |
| ----------------------------------- | ----: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/engine/control-totals.test.ts` |    34 | **ET-01**: every one of the 9,328 rows of `checks/control_totals_eur.csv` (4 scopes × 33 period keys) within verify.py's tolerances, and no engine value the CSV leaves out (absent = N/A)                       |
| `lib/engine/story.test.ts`          |    17 | **ET-02** Week 43 · ALL · Budget = the v5 story on all 12 cards (value, Δ text, chip), the ⓘ worked examples and mini stats; **ET-03** 7 / 3 / 2, orange, unchanged under every attribute pick                   |
| `lib/engine/calendar.test.ts`       |     7 | **ET-04** calendar keys and windows (P10 = W40–W43, YTD from 29 Dec 2025, LY / LW keys); **ET-05** LY by key (FY2025 W43), not by date (FY2025 W42)                                                              |
| `lib/engine/status.test.ts`         |    13 | **ET-10** every rule at its edges, float noise at −3 %, Markdown ↓, cover and mix bands, N/A; the dot rule (7/3/2 orange, 11/0/1 green, N/A excluded)                                                            |
| `lib/engine/view.test.ts`           |     9 | **ET-09** flow vs point in time, EBITDA always PTD; **ET-11** comparator changes Δ rows only; **ET-12** NL + BE + Online + Wholesale = ALL, Online only; **ET-13** B3 conceals 8, (B1 or B4) and Sales → 3; bars |
| `lib/engine/url-state.test.ts`      |     4 | E-62 parse / serialise / fallback / unknown keys                                                                                                                                                                 |
| `components/bars.test.ts`           |     2 | v5 bar geometry                                                                                                                                                                                                  |

A headless Chromium check (Playwright, run outside the repo on 2026-10-28) passed 32 / 32 against `next start`: fold
761 px and no scroll at 1440 × 810, card rectangles equal to prototype.html's, washes and the 2 px red border, bar sizes
92 / 62 / 58 bottom- and right-aligned with the dotted target, ⓘ → drill → back, Esc / scrim / × with focus return, Tab
trap, Notes / More KPIs / How to read, B3 conceals 8 in place with identical rectangles, switchers re-label and re-compute,
Online N/A cards, invalid query canonicalised, two columns and no horizontal scroll at 1000 px, reduced motion, no console
errors. `buildView` takes about 1.4 ms per selection in Node (E-84 budget 100 ms).

## Deviations from v5 (deliberate)

1. **Status sentence** ("Off track: Availability …") not shown: ADR-0013 §3 makes it an option, off by default.
2. **"Draft v5"** side-bar label not shown (prototype marker).
3. **Switchers are real** (v5 re-labels only). Comparators Budget · Last year · Last week; Forecast dropped (ADR-0013 OQ 6).
   The menu hint now reads "Status is always vs budget or target; the comparator changes the Δ line."
4. **YTD label** "FY2026 to date · 29 Dec 2025–25 Oct 2026" (ADR-0013 (e), E-11; v5 said 2 Feb).
5. **Bars come from the data**: Net sales W31–W39 lower than v5 (data README open point 14), Sell-through W31 is N/A and the
   bars run 12 → 63 % (open point 13), GMROI 2.67 → 2.70, EBITDA weekly bars from the data.
6. **ⓘ copy**: worked examples, mini stats and footers are computed for the current selection. GMROI reads €862m ÷ €319m
   and the formula / stat say front margin over 52 weeks (open point 12). Stats with no data behind them are replaced:
   Availability "Lost sales est." and "Fresh top-50" → "Netherlands · Belgium" (93.5 % · 94.9 %) and "Lowest category";
   EBITDA "Payroll vs plan" → "Store costs vs plan" (store OpEx % of sales vs budget).
7. **How to read**: "↗" → "binoculars", the comparator name follows the switcher, footer "Illustrative data · Refreshed …"
   instead of "Draft v3 · nothing built".
8. **Notes**: "Number corrections vs v1" dropped (prototype history); the data contract describes the built grain
   (week × site × category).
9. **N/A status** (new): grey "–" chip and muted Δ, for Availability and LFL under Online only (E-21).
10. **Header** keeps v5's brand block ("Nordmark Retail · Executive dashboard"); E-51's "Nordmark · Week 43" title is not
    applied, the week sits in the context line as in v5.
11. **Base cube grain** week × site group × category, LFL as measure columns, not E-83's week × country × format × channel ×
    category × is_lfl: no landing card reads format, and the file is smaller.
12. **Engine folder** `lib/engine/` (CLAUDE.md Track C convention and the build brief), not ADR-0013 (h)'s `lib/exec/`.

## Open items

- **Shared copy file (ADR-0013 (j) sync point 1):** `lib/engine/copy.ts` + `view.ts` are the TS source; the export to
  `docs/ADD/features/exec-info-popovers.md` is not written yet (this build kept to no shared files). The Power BI flavour
  must take the data-driven examples and the replaced stats of deviation 6, or parity will show them as gaps.
- **Parity rows** (`lib/test-utils/parity/`, `parity_selections_nordmark.csv`): phase 4, hunter.
- **Δ colour under LY / LW**: the Δ text keeps the status colour (v5 CSS), so "+€2.2m vs LY" can read red on an Off-track
  card. Keep, or switch the Δ to muted ink when the comparator is not Budget?
- **Data README story text** says NL 93.4 % vs BE 95.0 % availability; the control totals give 93.5 % / 94.9 %.
- **Owner notes** are fixed v5 text (true for Week 43 · ALL); scoped EBITDA is a contribution before central costs with no
  copy note yet (data README open point 15).
- **Not verified:** screen-reader behaviour of `inert`, backdrop-filter outside Chromium, a real 1440 × 810 window with
  browser chrome. No CI job for `js-exec/` yet. No `.sync` pack yet (ADR-0014; the pack ships `public/data` prebuilt and the
  control totals under `fixtures/checks/`, which `lib/test-utils/exec-data.ts` already reads as a fallback).
