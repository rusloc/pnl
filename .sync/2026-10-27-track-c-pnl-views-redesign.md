# Track C — P&L views redesign (Vitals · Analysis · Profitability)

- **From:** rusloc/pnl (Track C, nerd)
- **To:** vosk.dev repo agent
- **Date:** 2026-10-27
- **Status:** ready (built and verified in this repo; v4 reference with the USER's three tweaks; parity fixes 2026-10-27, §7)

Sources: `docs/design/P&L views redesign/pnl-views-redesign.html` (v4), `build-brief.md`, `metric-inventory.md`, `README.md`; ADR-0012 (visual first, minimum text). Definitions follow Track B (`docs/model/measure-dictionary.md`); measure names are cited in the code comments and ⓘ pop-ups.

## 1. What changed in `js-report/`

| Area | Files |
|---|---|
| Engine (framework-free) | `lib/engine/slices.ts` (slice cuts, C-31 allocation by NR share at runtime, ops scan, scan cache) · `view-context.ts` (plans: Compare A/B, bridge comparison, Budget, PY; actual / selected / constant-currency translations) · `thresholds.ts` (one status table, spec KPI §6) · `vitals.ts` · `analysis.ts` (NR bridge with CC subtotal, profit bridge, largest variances) · `profitability.ts` · `view-copy.ts` (How to read) · `view-types.ts` · `aggregate.ts` (`planFactors` extracted, statement unchanged) |
| Data loading | `lib/data/parquet-loader.ts` (`readOpsColumns`), `lib/data/dataset.ts` (loads `ops.parquet` with the entity) |
| URL state | `lib/state/view-state.ts` (new keys below); `restrictToBuilt` no longer forces the statement view |
| UI | `components/views/` (VitalsView, AnalysisView, ProfitabilityView, charts, use-size, views.module.css) · `components/glass.tsx` + `glass.module.css` (shared glass pop-ups, also used by `/sales`) · `components/chart-scale.ts` (moved from `components/sales/scale.ts`) · `Header.tsx` (Vitals tab, pager, How to read) · `Shell.tsx` |
| Tests | `lib/engine/views.test.ts` (26), `lib/state/view-state.test.ts` (3); existing suites updated for the tab rename and the view gate |

## 2. Views

- **Vitals** (tab renamed from "Key figures"; the URL value stays `v=kpi`). Three hero cards (Net revenue, Adj. EBITDA, Operating profit) and two ratio cards (Gross margin %, Opex % revenue, lower is better). Five driver cards: Commerce Cloud has GMV, Active merchants, ARR, Revenue mix and FY outlook; Consumer Products has Units sold, NR per unit, Gross-to-net %, A&P % of NR and FY outlook. Each card shows Δ rows vs Compare A and Compare B, "on plan" for a zero Δ, and a status chip vs Budget only. No sparklines; sub-metrics are in the ⓘ.
- **Analysis.**
  - Page 1: the NR bridge (Commerce Cloud: service-line steps; Consumer Products: volume and price / mix per lowest slice) with a constant-currency subtotal and FX, and the profit bridge (comparison EBITDA → volume / GM rate / GM mix / VSC / S&M / R&D / G&A / other → FX → EBITDA → D&A and adjusting items as levels → OP).
  - Page 2: largest variances to OP with Top 8 / 12 / All, By block / By |Δ|, and a cut by Region / Sales motion / Service line / Segment (company slot labels). The cut shows stacked member segments with ▸ member lists; rows below CM are tagged "alloc." unless the cut is Region. It also has the vs PY Δ column, "of which FX", the n.m. rule, and the coverage footer.
- **Profitability.** Always at constant currency (the selected year's budget rates), shown in the subtitle.
  - Page 1: the 8-column region table (CM Δ pp is the only status dot) and three 100 % concentration bars with drift.
  - Page 2: growth × margin by region (Region only, quadrant lines with values, PY trails when two prior years exist) and the region × service line mix heatmap with totals.
- **Paging:** ‹ › "n / 2" next to the tabs, plus the ← → keys. One "How to read" per view in the header. Glass ⓘ pop-ups: one at a time; Esc, outside click and × close; focus moves into the pop-up, is trapped, and returns to the opener.

## 3. New URL keys (defaults omitted, Zod-validated, invalid values rewritten)

| Key | Values | Default | Where |
|---|---|---|---|
| `p` | `1`, `2` | `1` | Analysis / Profitability sub-page |
| `lvn` | `8`, `12`, `all` | `8` | Largest variances: Top-N |
| `lvm` | `block`, `abs` | `block` | Largest variances: grouping |
| `lvc` | `none`, `region`, `channel`, `line`, `segment` | `none` | Largest variances: cut |

The existing `v` key now opens `kpi` (Vitals), `analysis` and `profitability`.

## 4. Data files (`js-report/public/data/`, unchanged contents)

| File | Bytes | Note |
|---|---:|---|
| `manifest.json` | 104,008 | |
| `ops.parquet` | 130,499 | now fetched on load (units, GMV, merchants); it was already counted in the first-load budget |
| `pl-P.parquet` | 1,154,995 | |
| `pl-S.parquet` | 331,039 | |

No new pre-aggregate. The shipped grain (month × version × region × channel × line × segment × account) already holds slice × line at month × currency, and the engine rebuilds the C-31 allocation exactly as `scripts/build-data.ts §4` checks it against `fact_pl_allocated`.

## 5. Checks run here

- `npm run lint`, `npm run typecheck`, `npm test`: 23 files, 362 tests (parity harness included, 0 expected-fail). P&L control totals, the redesign reconciliations and the Mirelo suites are all green.
- `next build`: `/` and `/sales` are static.
- `next start` + headless Chromium at 1440 × 810. Every view and sub-page (statement, Vitals P / S, Analysis p1 P / S, p2 with cut and All, Profitability p1 / p2 P / S) has no page scroll, no element outside the window, and zero console or CSP errors. Pager keys, single-open pop-ups, Esc with focus return, and How to read all pass.

## 6. Not built (left off by the USER at review v3 / v4, or needs data)

Headline strip, service-line economics table, monthly trend and FY outlook bridge (Analysis); dispersion / driver / FX tiles, lollipop, waterfall by region, quarterly trend, allocation view, and sub-region bubble levels (Profitability); the Group view (Track C build step 4) and slice filters (step 5) are still not built.

## 7. Parity fixes (2026-10-27, after `docs/ADD/features/parity-check-2026-10-27.md`)

Track C side of the B vs C parity check. The harness is `js-report/lib/test-utils/parity/` (`parity.test.ts` + `parity_selections.csv` / `parity_selections_mirelo.csv`); every Track C row is now `match` (0 expected-fail).

- **PV-05** The second variance column follows Compare B ("vs Budget" / "vs LE" / "vs PY") and is dropped when Compare B = None (rule 17).
- **PV-09** The take-rate ⓘ compares with Budget and the prior year.
- **PV-10** GMV per merchant is shown in thousands ("$81.3 k"), not "$0.1 m".
- **PV-11** NR bridge labels are "<comparison> NR - … - Constant-currency NR - FX - Actual NR". The profit bridge starts at "<comparison> Adj. EBITDA".
- **PV-13** The Profitability NR Δ % is neutral; the only status colour is the CM Δ dot (rule 15, decision 7).
- **PV-14** " · " and " — " in the copy are now " - " (rule 6), in both the P&L and the Mirelo copy. Inside a formula the separator is "; ", so that it does not read as a minus.
- **PV-21** Card Δ rows follow the format rules: an amount Δ uses the unit of the page ("+9.1", not "+$9.1 m"); per-unit values use 2 decimals.
- **Mirelo MS-04** R3 "Interest + fees" is compared with the loan-product Budget. R4 "Interchange" is compared with the CARD Budget, and both cards also show the prior year.
- **Mirelo MS-05** C5 compares with the prior-year cohort ("vs PY cohort").
- **Mirelo MS-07** The status band uses the Δ as displayed, so "0.0%" is on plan. Three seeded rows had captured the old bug; they now hold the contract value.
- **Mirelo MS-11** The prior-year comparator row on heroes and KPIs reads "vs PY" (Track B wording). The period sentence keeps "Prior year".
- **Mirelo MS-13** The L11 placeholder reads "Not available - no channel targets".
- **Mirelo MS-14** The ⓘ sub-values of the Overview heroes follow layout-spec v4 (Budget, prior year, YTD, channel counts, 30+ / 90+ / count / appetite).
- **Largest variances, empty lines** (Track B parity round): a leaf with no data in either version is hidden, not shown as "n.m.". n.m. stays for lines with data (comparison < 2.0 or |Δ %| > 50 %). Hidden lines have Δ = 0, so Σ|Δ all|, the coverage and the total do not change. Leaf count S 35 → 32, P 38 → 37.
- **PC-01** The shared ⓘ / How-to-read copy is exported by `npm run export:info-copy` (`js-report/scripts/export-info-copy.ts`) to `docs/ADD/features/info-popovers.md` and `docs/ADD/features/sales-info-popovers.md`. The TypeScript remains the source.

No new URL keys, env vars or data files. Files to re-vendor: `lib/engine/{analysis,vitals,profitability,view-copy}.ts`, `components/views/{AnalysisView,ProfitabilityView}.tsx`, `lib/sales/{revenue,clients,copy,status,loans,overview}.ts`.
