# Track A — P&L views redesign v4 (Vitals · Analysis · Profitability)

> Status: **deployed 2026-10-28** (fin, `npx rayfin up` to RAW after ginee's republish; USER click-test pending), gate green (263 + 20 tests); the AI chat is **deferred** (USER 2026-10-28: `services.functions.enabled: false`, `RAYFIN_PUBLIC_PNL_CHAT=off`, code kept, ADR-0009). Built 2026-10-27; the 16 probes and their timings are under "Republish dependency". Sources: `docs/design/P&L views redesign/build-brief.md` (v4), ADR-0012 (visual first), ADR-0006 §8.3 (query catalogue), `docs/design/parity-rules.md` 18–21, `docs/ADD/features/parity-check-2026-10-27.md` (PV-01 … PV-05 applied). Track B is the model Track A reads; Track C is the behaviour / copy reference.

## What and where

| View (tab) | State key | Sub-pages | Panels | Code |
|---|---|---|---|---|
| **Vitals** (formerly Key figures) | `kpi` (unchanged) | 1 | eyebrow "Results": 3 hero cards (Net revenue, Adj. EBITDA, Operating profit) + 2 secondary (Gross margin %, Opex % NR); eyebrow "Drivers & health": 5 driver cards per `dim_kpi[vitals_slot]` 6–10 (content swaps by company, L-10) | `views/vitals-view.tsx`, `components/vitals-card.tsx` |
| **Analysis** | `ana` | 2 (`pages.ana`) | p1: net revenue bridge (comparison → drivers at CC → constant-currency subtotal → FX → actual) and the profit bridge (comparison Adj. EBITDA → changes → FX → Adj. EBITDA → D&A, adjusting items → operating profit); p2: largest variances to operating profit with Top 8 / 12 / All, By block / By \|Δ\|, a cut (Total · Region · the company's three slice slots; Entity in the Group view), stacked member segments, ▸ member lists, "alloc." tags, Δ / Δ % (n.m.) / vs Compare B / of which FX, one shared bar scale, the coverage footer | `views/analysis-view.tsx`, `components/charts/waterfall.tsx`, `model/variances.ts` |
| **Profitability** | `prof` | 2 (`pages.prof`) | p1: eight-column table by Region (PV-19: no breakdown control; the F-21 query path stays dormant behind `FilterState.breakdown`; CM Δ pp carries the only status dot) and three 100 % concentration bars with the drift legend; p2: growth × margin by region (quadrant labels, company reference lines with values, hover detail) and the region × service line mix heatmap with totals | `views/profitability-view.tsx`, `components/charts/{concentration-bars,bubble-chart,heatmap}.tsx` |

Shared: `Pager` (‹ › "n / 2" next to the tabs; ← → keys page when no control or pop-up has them), one "How to read" per view (`components/how-to-read.tsx`), ⓘ per card and panel (`components/info-popover.tsx`), all on the glass dialog shell (`components/glass-dialog.tsx`: translucent white + backdrop blur, solid fallback, one layer at a time, Esc / outside click / × close, Tab trapped, focus returned). Card face = title · chip · ⓘ · value · Δ rows; no sparklines, no bars, no prose on the canvas (ADR-0012).

## State

| State | Where | Notes |
|---|---|---|
| `view` (`pnl` / `kpi` / `ana` / `prof`) | `pnl-app.tsx` | unchanged |
| `pages: { ana, prof }` (1 \| 2) | `pnl-app.tsx` | each paged view keeps its own page across tab switches |
| `varTop` (8 \| 12 \| 'all'), `varMode` ('block' \| 'abs') | `pnl-app.tsx` → `AnalysisView.controls` | display only, never re-query; "All" opens with every block collapsed |
| `varCut` ('none' \| 'region' \| 'channel' \| 'line' \| 'segment' \| 'entity') | `FilterState` (`filters.ts`, action `varCut`) | a query input like `breakdown`; `varCutsFor(entity)` is the allow-list, an entity switch falls back to Total when the cut does not apply |
| collapsed blocks, expanded member lists | `AnalysisView` local state | reset when Top changes |
| `breakdown` (F-21) | `FilterState` | dormant: no control since PV-19 (Region only); the allow-listed query path and the chat's `breakdown` argument still work |

## Data (ADR-0006 §16 pattern)

Zones (`data/data-source.ts`, one model query each, read in parallel, cached per query key): `vitals`, `vitalsInfo`, `bridge`, `profit`, `variances`, `variancesCut` (no query while the cut is Total), `profitability`, `concentration`, `bubble`, `heat`, plus the unchanged `statement` and `context`. The Key figures tile queries (Q2a / Q2b) are gone: the AI assistant's `get_kpis` / `explain_kpi` read the `vitals` (+ `vitalsInfo`) zone through the same cache. Queries QV1–3, Q3, QP, QL / QL2, Q5, QC, QB, QH: ADR-0006 §8.3. Level columns are fetched; Δ, Δ %, "on plan", the status (thresholds of `param_kpi_threshold` mirrored in `model/thresholds.ts`), block subtotals, coverage and the bar scale are derived in the app with the model's own rules. Every Profitability zone is sent at constant currency whatever the Display flyout says (PV-02).

Sample mode (no backend, `rayfin dev` / tests): the mockup covers the statement, the sample net revenue bridge and the top 8 variances only; the redesigned panels show "No sample figures for the …" (LSN-002, nothing invented).

## Republish dependency (ginee + USER)

The deployed model must carry bip's 2026-10-27 changes before these zones answer: `dim_kpi[vitals_slot]` / `vitals_tier` / `in_key_figures` with the rows `OPEX_PCT`, `MIX`, `FY_OUTLOOK`; `param_kpi_threshold`; `dim_bridge_step` rows `CC_SUB` / `END`; `dim_profit_step`; `dim_conc_level`; `dim_pl_info`; measures `Bridge Step Delta`, `Bridge Is Total`, `Profit Step Delta`, `Profit Is Total`, `LV Δ B`, `LV FX`, `Prof NR Δ % CC`, `Prof CM Δ pp`, `Prof Contribution`, `Prof Adj EBITDA`, `Conc Share`, `Prof Company Growth`, `Prof Company CM %`, `KPI Info Sub`, `KPI Opex % NR`, `KPI Subscription Share`, `KPI Payments Share`, `KPI FY Outlook NR`, `KPI FY Budget NR`, `KPI FY Outlook EBITDA`, `KPI FY Budget EBITDA`. Until then those zones show the model's error (the statement and the context keep working). Smoke after the republish: `npx rayfin connector invoke pnlModel executeQuery --file rayfin/probes/redesign/<name>.query.json` for the 16 probes (`rayfin/probes/make-redesign-probes.ts` regenerates them from the app's builders), then `npx rayfin up` (USER).

**Done 2026-10-28.** Readiness diff (INFO.VIEW vs TMDL): 253 / 253 measures, 260 / 260 columns, 0 missing (the 44 extra service columns are the engine's `RowNumber-*`). All 16 probes answer (`connector invoke` wall clock, `q0-ok` baseline 3.9 s = CLI + API overhead; ADR-0006 §8.3 has the per-row cells):

| Probe | Rows × cols | Wall s |
|---|---|---|
| qv1-vitals-meta-s | 10 × 14 | 3.6 |
| qv2-vitals-values-s-{cmp-py, fy, heroes, drivers, ratios} | 1 × 3 / 4 / 9 / 10 / 9 | 4.6 / 4.9 / 6.3 / 7.9 / 8.2 |
| qv3-vitals-info-s | 1 × 3 | 24.8 (slowest; own zone) |
| q3-bridge-s | 9 × 5 | 8.7 |
| qp-profit-bridge-s | 17 × 5 | 14.0 |
| ql-variances-s | 73 × 12 | 6.3 |
| ql2-variances-cut-region-s | 292 × 5 | 4.5 |
| q5-profitability-s | 5 × 10 | 10.0 |
| qc-concentration-s | 12 × 6 | 5.6 |
| qb-bubble-s | 5 × 5 | 6.3 |
| qh-heat-s / qh-heat-group | 25 × 7 / 50 × 7 | 6.6 / 8.1 |

Two fixes from the first live run: (1) QL's `@below_cm` lookup used a bare `dim_pl_row[account_code]` inside `SUMMARIZECOLUMNS` ("a single value … cannot be determined"); it now mirrors the model's `LV Alloc Tag` with `SELECTEDVALUE`. (2) Because `@below_cm` is never blank, QL returns every leaf of `dim_pl_row` (73, not ≈ 44); `mapVarianceLeaves` drops the leaves with no amount at all so the block counts and "All" match the model's table. Deploy note: `rayfin up` compiles every `.ts` under `rayfin/` (`rayfin/tsconfig.json` includes `**/*`), so `rayfin/probes/make-redesign-probes.ts` broke the connector-apply step once; `probes/**/*` is now excluded there. The workspace still carries the earlier `UserDataFunction` `acme_connector` and `GraphQLApi` `acme_gql` items (not deleted).

## Deviations and open points

- Status chip and the coloured Δ row compare with **Budget only** (PV-01): the Budget value comes through `param_eval` CMP_A with Compare A forced to Budget when neither Compare is Budget (one more column per card in that case).
- Bridge step labels carry the step as % of the comparison NR for every step (the brief's "% of the stream's budget" per service line would need a per-line comparison measure).
- Bubble prior-year trails not drawn in A and B for now (accepted): the contract has no prior-year growth per region (`KPI Organic Growth` reads `PY Amount` directly, so evaluating it "as Compare B" would not shift the prior year); the ⓘ keeps the shared sentence plus a "Prior-year trails: n/a" value; bip has the backlog item (C-04).
- ⓘ copy (panels and cards: title · what · formula with "; " between terms · source) = the generated "redesign-v4" block of `docs/ADD/features/info-popovers.md` (`model/info-popovers.ts`, `panelInfo` / `cardInfo`), `{comparison}` and the company's slot word filled from the selection; a card's sub-metrics line = the model's `KPI Info Sub`. Card faces keep `dim_kpi[kpi_label]` (PV-07 is bip's); codes the block does not list (Group drivers) fall back to the model's label and definition.
- Chip words lower case (PV-08, the design's `chipTxt`); Δ amounts without symbol ("+9.2", PV-21); values "$667.4 m" (B / C form).
- The variances "vs <Compare B>" column follows Compare B and is dropped on None (PV-05); the footer has the three rows with every column (PV-12).
- Profitability is Region only (PV-19): the breakdown control was removed; the F-21 query path and the EBITDA "allocated - indicative" badge stay dormant for a later decision.
- " - " as the separator everywhere and "; " between formula terms (PV-14 ruling, rule 6).
