# P&L Power BI flavour vs the vosk.dev build spec — gap analysis

from bip · to main agent · 2026-11-16 · status: draft

Read-only analysis. Nothing in `pbi-report/` or `.sync/pnl/power-bi/` was edited; Desktop was not opened; no DAX was run.
Inputs: `.sync/pnl/report-spec/` (README + 01…08, written 2026-11-16 by the vosk.dev repo), `pbi-report/ACME Unified PnL/`,
`.sync/pnl/power-bi/`, `C:\__VOSK__\src\lib\pnl\engine\`, `C:\__VOSK__\data\pnl\`, `data/acme_pl_dummy_data/`,
`docs/Requirements.md`, ADR-0002/0003/0004/0006/0007/0008/0014.

## 0. Verdict in one line

**UPDATE the repo PBIP `pbi-report/ACME Unified PnL/`** (model kept and extended; report layer re-laid out to 4 pages),
then re-pack `.sync/pnl/power-bi/`. Do not rebuild from the spec. Reasons in §8.

## 1. Data

| Check | Spec (vosk.dev) | Ours | Result |
|---|---|---|---|
| `pl-P.parquet` SHA-256 | `e069dfa2…af427` | `js-report/public/data/pl-P.parquet` same hash | identical |
| `pl-S.parquet` SHA-256 | `fa5073bf…2704a` | `js-report/public/data/pl-S.parquet` same hash | identical |
| `ops.parquet` SHA-256 | `55cf269b…aa3854` | `js-report/public/data/ops.parquet` same hash | identical |
| `manifest.json` | builtAt 2026-10-28T15:57:41Z | builtAt 2026-11-01T22:30:13Z | identical apart from `builtAt` (JSON compared key by key) |
| `control_totals_usd.csv` | 552 rows | `data/acme_pl_dummy_data/checks/` | identical (SHA-256 `fb304475…91e2e1`) |
| `chat-golden.csv` (63) | `C:\__VOSK__\data\pnl\checks\` | not in this repo | missing here |
| P&L raw rows | 422,712 (no FC2606) | `fact_pl.csv` 457,896 = 422,712 + 35,184 FC2606 rows | same rows + FC2606. Spec 02 §3.2 says FC2606 "has no fact rows": true for the Parquet only |
| Ops rows | 26,784 | `fact_operational.csv` 29,016 = 26,784 + 2,232 FC2606 | same + FC2606 |
| Allocated below-CM rows (C-31) | 702,420, computed in Power Query, unrounded | `fact_pl_allocated` 758,364 = 702,420 + 55,944 FC2606, precomputed by the generator | same 702,420 tuples (0 only-spec, 0 only-ours); below-CM sums equal to the cent (P −7,820,642,197.81, S −1,893,695,631.82) |
| Allocated amounts per row | unrounded share × amount | cent-rounded with residual | max 0.106 per row, 7,829 rows > 0.01; summed per company × version × year × channel/line/segment member: up to 1.34 local units, 155 of 161 sums > 0.011 |
| Group | rows with a counterparty excluded at query time | `fact_pl_elim` 5,304 rows (ELIM_GR / ELIM_VSC, ADR-0008) | same totals (T-06 GROUP rows TRUE); statement leaves differ (ours shows ELIM rows) |
| Translation | per row in DAX: `SUMX ( 'FX Factor' … )`, CC via `FX CC Factor` | pre-translated `amount_usd/eur/gbp` on load + CC 4-currency × FY factor (ADR-0008) | same arithmetic (ADR-0008 FX-path tests pin it); spec form is the pre-ADR-0008 formula that cost 26-55 % more query time |
| Source binding | `DataFolder` → 4 web Parquet + manifest, decoded in M | repo: `Sql.Database ( SqlEndpoint, Database )` on `lh_raw`; pack: `DataFolder` → 23 per-table Parquet from `.sync/data-gen/pnl` | different format, same content |

Consequence: our data is the spec's data. Only the allocation rounding can move golden rows that combine a
channel / line / segment slice with a below-CM line (#21, #22, #27, #62) outside the spec's 0.011 tolerance (by up to
~1 currency unit). Region-only and unsliced figures are unaffected (the residual stays inside each group).

## 2. Model

| Item | Spec | Ours | Gap |
|---|---|---|---|
| Facts | `Fact PL` (1,112,532, direct + allocated in one table), `Fact Ops` | `fact_pl` (direct read), `fact_pl_allocated` (below-CM), `fact_pl_elim`, `fact_operational` | shape differs, meaning equal; keep ours |
| Dimensions | Month (MonthIdx), Version, Region, Channel, Line, Segment, Entity, Account, `FX Factor` | same set keyed by `month_key`; + `dim_cost_centre`, `dim_nature`, `bridge_account_nature`, `dim_report_line` | `dim_nature` / bridge unused by both (ADR-0007); no gap |
| Relationships | 17, all single-direction, `FX Factor` → facts | 35 (3 facts + elim, 1 inactive counterparty, `dim_kpi` / `dim_bridge_step` → `param_entity_view`) | none needed; ours has no FX relationship by design (ADR-0008) |
| Calculated / disconnected tables | 24: 14 `P …` parameters, `Plan Column`, `Plan Scope`, `FX Override`, `Vitals Card`, `Bridge Step`, `Conc Level`, `Trend Row`, `Applied Row`, field parameter, calc group | ~20: `param_entity_view`, `_fiscal_year`, `_period`, `_base_version`, `_compare_a/b`, `_eval`, `_kpi_threshold`, `_metric`, `_var_cut` (+`var_cut_total`), `_breakdown_field`, `dim_kpi`, `dim_bridge_step`, `dim_profit_step`, `dim_conc_level`, `dim_pl_row`, `dim_pl_info`, `dim_filter_row`, `_meta_refresh` | missing: range start, cost sign, show tags, hide empty, `Trend Row`, `Applied Row`; `P Time View` lacks RANGE |
| Calc group `Comparison Column` (9 items via `Plan Column`) | yes | no: one measure per column (`Base Amount`, `Compare A/B Amount`, `PY Amount`, `FY Budget/LE Amount`, `Bridge Comparison Amount`) | missing; can be added as a façade over the existing column measures |
| Field parameter `Statement Columns` (13, incl. Line note, ±15% A bar) | yes | no; statement columns are fixed measures, toggles disabled (F-15..F-17 deferred, `pbi-report-layout.md` l. 73, 124) | missing |
| Field parameters elsewhere | — | `param_var_cut` (variance cut), `param_breakdown_field` (Profitability breakdown, F-21) | ours extra; spec replaces both |
| Group support | model only, picker disabled | exposed (entity switch, Group KPIs, Group bridge steps ENT_P / ENT_S / ELIM) | conflict, see §7 |
| Culture / compat | en-US, auto date off | en-US, discourageImplicitMeasures | none |

## 3. Measures

Spec 304 (folders 0–3 engine 58, lines 29, catalogue 33, statement 38, Vitals 25, Analysis 70, Profitability 33,
header 18). Ours 253 (`9 Engine` 53, `Design` 70, `3 KPIs` 48, `4 Analysis` 26, `5 Profitability` 18, `1 Statement` 16,
`2 Versions` 17, `6 Context` 5). Measure names differ almost everywhere; Track A reads ours by name (ADR-0006
"app contract"), so renames are not free.

### 3.1 The 62-metric catalogue (golden answers read these)

| Group | Spec | Ours, by meaning | Matched | Other form | Rows only | Missing |
|---|---:|---|---:|---:|---:|---:|
| Lines | 23 | `2 Versions\Subtotals` (GR, GTN, NR, GP, CM, EBITDA, OP, PBT, TAX, NP); the other 13 (COR, VSC, OPEX, SM, RD, GA, OOI, DA, UOP, ADJ, INV, PBFIT, FIN) exist only as `dim_pl_row` rows of `PL Base` | 10 | — | 13 | — |
| Ratios | 6 | `KPI Gross Margin %`, `KPI CM %`, `KPI Adj EBITDA Margin`, `KPI Operating Margin`, `KPI Effective Tax Rate`, `KPI Net Margin` | 6 | — | — | — |
| Cost ratios | 8 | `KPI Opex % NR`, `KPI Gross-to-Net %`, `KPI S&M / R&D / G&A % NR`, `KPI A&P % NR` | 6 | — | — | 2 (COR % NR, VSC % NR) |
| Growth | 3 | `KPI Reported Growth`, `KPI Organic Growth` | 2 | — | — | 1 (EBITDA Growth) |
| Drivers | 10 | `KPI Units Sold`, `NR per Unit`, `GMV`, `Payments Take Rate`, `Active Merchants`, `GMV per Merchant`, `ARR`, `Subscription Share`, `Payments Share` | 9 | — | — | 1 (A&P Spend) |
| FY outlook | 6 | `KPI FY Outlook NR / EBITDA`, `KPI FY Budget NR / EBITDA`, `KPI FY Attainment` | 5 | — | — | 1 (FY EBITDA Attainment) |
| FX effects | 3 | NR / profit bridge FX steps (`Bridge FX`, `_Profit Step`) | — | 2 | — | 1 (FX Effect OP) |
| Shares of company | 3 | `Prof NR Share` | 1 | — | — | 2 (CM, EBITDA share) |
| **Total** | **62** | | **39** | **2** | **13** | **8** |

Same rules checked by reading both sides: windows MTD/QTD/YTD/LTM/FY (spec 03 §4.2 = `_Anchor Index` / `_Win Start` /
`_Win End`), plans C-01 cut / LE = ACT + FC2609 / PY = ACT − 12 / FY columns (spec 03 §4.3 = `_Amt Window`), translation
(§1), ratio denominators (NR; ETR = −TAX / PBT), Opex % excluding OOI, bridge steps per company (identical step lists in
`dim_bridge_step` / `dim_profit_step`), Vitals slots (10 cards per company, identical metric per slot in `dim_kpi`).
Not checkable without a run: the numeric value of the 63 answers (no DAX run in this task).

### 3.2 The other 242 (estimate from folder inventories, ±15 per folder; the exact map is work item 1)

| Spec folder | Spec | Ours | Same meaning | Missing / redesign | Driver of the gap |
|---|---:|---|---:|---:|---|
| 0–3 Selection, window, plan, base amounts | 58 | `9 Engine` 53 | ~45 | ~13 | RANGE (range start, months before history), cost multiplier, tags / hide-empty switches, `Plan …` helpers of the calc group |
| 6 Statement | 38 | `1 Statement` 16 + PL header / notes in `Design` ~8 | ~22 | ~16 | Line note, ±15% bar, cost sign, hide-empty toggle, field-parameter display measures, row font colours |
| 7 Vitals | 25 | `3 KPIs` 10 + `Info *` 6 | ~16 | ~9 | spec uses the new Card visual with reference labels; ours renders each card as one SVG (`Vitals Card SVG`) |
| 8 Analysis | 70 | `4 Analysis` 26 | ~26 | ~44 | variances: all rows + 4-dimension member filter + money text measures; bridges: spec draws them with ~15 plumbing measures, ours uses visual calculations |
| 9 Profitability | 33 | `5 Profitability` 18 + bubble / heat helpers in `Design` | ~20 | ~13 | Trend measures (growth / CM % by region by month) new; bubbles dropped |
| 10 Header | 18 | `6 Context` 5 + rail / period / notice helpers in `Design` ~15 | ~12 | ~6 | RANGE period texts, `Applied Row`, notice count |
| **Total** | **242** | | **~141** | **~101** | |

Ours extra (no spec counterpart): ~10 KPI items used by Group or ⓘ values (Rule of 40, Subscription / Payments GM %,
CP / CC op. margin, IC eliminated, Volume growth, Price / mix, Net new ARR, Services share; most feed the spec's ⓘ
texts too), ~8 Top-N coverage / var-cut measures, ~6 bubble axis measures, the Group bridge steps.

## 4. Pages

| Item | Spec | Ours | Gap |
|---|---|---|---|
| Pages | 4 report pages (`P&L statement`, `Vitals`, `Analysis`, `Profitability`) + `TT Vitals card`, `TT Info` | 1 page `pnl_one_pager` (326 visuals, views as bookmarks) + `tt_pl_info` | L: re-layout to 4 pages |
| Canvas | 1280 × 720; Profitability 1280 × 900 (scrolls) | 1440 × 810, never scrolls (ADR-0004) | L, conflicts ADR-0004 |
| Bookmarks | ~55 (panels ×4 pages, rows collapsed / expanded, resets) + 15 sync-slicer groups | 38 (views, flyouts, `bm_pl_expand`) | M |
| Frame | rail 64 px, header 104 px, page navigator, How to read, Reset | rail + flyouts + filters pop-up + tabs (same Ledger design) | re-position only |
| Companies | P and S; Group shown disabled "Not built yet" | P, S and ACME Group | conflict (§7) |
| Statement | matrix on `PL Row` + `Statement Columns` field parameter (13 cols, horizontal scroll), group titles card | matrix on `dim_pl_row`, 11 fixed columns | M |
| Vitals | 3 new-Card visuals (hero 3, secondary 2, drivers 5) | 10 SVG image cards | technique differs, content same |
| Analysis | one page: variances (all lines, 4 slicers, totals row) above both bridges | 2 pager pages: bridges / variances (Top 8 / 12 / All, one cut via field parameter) | L |
| Profitability | 8-col region table, concentration bars, growth + CM % small multiples by region, heatmap | table (with breakdown F-21), concentration, bubble scatter, heatmap | L |
| Statement-wide slice filters | off (Slice panel shows a notice) | on (rail Slice flyout, F-08..F-11) | conflict (§7) |
| Custom range | yes (Period panel "From") | no | M |

## 5. Theme and formats

| Item | Spec | Ours | Gap |
|---|---|---|---|
| Colour tokens | Ledger tokens (07 §1), company accents `#2453A6` / `#6B48C8` / `#3B4A5E` | same tokens (`acme-finance-theme.json` dataColors carry the same hexes) | region colour map to check (spec: NA `#6B48C8`, EU `#2453A6`, AP `#3BA37B`, UK `#E2804A`) |
| Fonts | IBM Plex if installed, else Segoe UI / Segoe UI Semibold (theme JSON uses Segoe UI) | Segoe UI / Segoe UI Semibold | none |
| Minus sign | U+2212 everywhere, zero without sign, `"n/a"` literal format | mixed: 7 format strings with U+2212, 43 with ASCII `-` (39 × `#,0;-#,0;0`, 4 × `+0.0%;-0.0%;0.0%`) | S: display-layer formats to U+2212 |
| Units | display measures ÷ divisor, `#,##0.0` / `#,##0` | same (no trailing-comma scaling, CLAUDE.md rule) | none |

## 6. Validation coverage

| Spec check | Ours today | Gap |
|---|---|---|
| 552 control totals (§3) | T-06 headline 24 rows + full 552 / 552 TRUE (2026-10-22, re-run 10-28 and 10-30 on the pack) | covered |
| 63 golden answers (§2) | not in the repo; partly covered by T-06 (#16, #51-54, #58-60 equal control values), T-17 (#41, #42) | M: port the 63 rows to our selection tables; needs the 8 missing catalogue measures; #21/#22/#27/#62 exposed to allocation rounding |
| Engine reference outputs, default views (§4) | T-P parity 601 rows vs our `js-report` engine of 2026-10-27 | stale: every one of the 30 web engine files differs from `js-report/lib/engine` (mostly quote / wrap reformatting, plus dated semantic changes: Analysis one page + variance filter 2026-10-31, custom range, Profitability trends, slice `byMonth` 2026-11-15). Regenerate the reference rows from the vosk.dev engine |
| Row counts (§5) | pack README row counts per table | spec counts are for its one-table `Fact PL`; ours differ by design (FC2606 rows, split facts) |
| Behaviour T-05, T-10, T-11, T-12, T-13, T-16, T-17 (§6) | T-05, T-10, T-17 tests; T-11/T-12 via notices; T-16 hide-empty always on | custom-range checks new; T-16 with the toggle off is new |

## 7. Conflicts (spec vs this repo's contract)

The spec states "where the requirements and the code disagree, the code wins". In this repo `docs/Requirements.md`
IDs and accepted ADRs are the contract (CLAUDE.md › Project identity › Spec; › Cross-repo sync folder). Each row
needs a USER decision before it is built; none is resolved here.

| # | Topic | Contract here | Spec | Kind |
|---|---|---|---|---|
| C1 | Precedence | Requirements IDs are the contract; `.sync` files never override them | "the code wins" over requirements | governance |
| C2 | Group view | F-01, M-05, C-36, T-01, T-02, T-15 (Group selectable, ELIM nodes in the statement) | Group in the model only, picker disabled | scope cut |
| C3 | Statement-wide slice filters | F-08..F-11, F-30, F-32, F-34, F-36 (every zone) | off; slices only in the Analysis variance filter | scope cut |
| C4 | Layout | ADR-0004 (accepted 2026-10-23): one page 1440 × 810, never scrolls, bookmark views | 4 pages 1280 × 720, Profitability 1280 × 900 scrolling | ADR amendment |
| C5 | Largest variances | C-45 top 8 | every leaf with data (37 rows default P) + 4-dimension member filter | requirement change |
| C6 | Profitability | F-21 breakdown (Region / Channel / Category / Segment; Group Region / Entity), C-46 per slice value, L-09 | region only; bubbles replaced by month-by-month trends | requirement change |
| C7 | Time views | F-04: Month, QTD, YTD, LTM, Full year | + Custom range (web 2026-11-15) | addition |
| C8 | Data source / physical model | CLAUDE.md Track B + ADR-0003 (Import from `lh_raw`), ADR-0008 (pre-translated columns, `fact_pl_elim`), ADR-0014 items 3 and 6 (pack Parquet from the loader's type spec; source of truth = `pbi-report/`) | bind to the 4 vosk.dev Parquet + manifest, allocate in M, translate per row in DAX | reverses accepted ADRs |
| C9 | Reset | F-35: Reset keeps the current entity and page tab | `Reset – All` sets every slicer (company included) to its default | detail |
| C10 | Measure names | ADR-0006: Track A queries model measures by name (app contract) | 304 new names | Track A breakage if renamed |
| C11 | Display controls | F-15, F-16, F-17 required; ours deferred | built | spec agrees with the contract; gap on our side |

Spec `TODO(verify)` items:

| # | Item | Our view |
|---|---|---|
| T1 | Catalogue has 62 metrics, docs say 61 | follow 62 (code); affects only names / coverage |
| T2 | Table "Totals label", per-series fx colours in stacked column, new Card reference labels depend on the Desktop build | check the installed Desktop build before the Analysis / Vitals work; our bridges already avoid the per-series fx path (visual calculations) |
| T3 | Build stamp shown in UTC | ours shows the model refresh time (`_meta_refresh`); USER picks |

Additional spec claims to verify: FC2606 "has no rows" (true only for the web Parquet); allocation unrounded (ours is
cent-rounded, §1); Group by excluding counterparty rows (equal totals, different leaves).

## 8. Verdict

**UPDATE, base = repo PBIP `pbi-report/ACME Unified PnL/`.**

- The pack `.sync/pnl/power-bi/` is the same PBIP: report folder identical (`diff -rq`: only `.pbi/`), `_measures.tmdl`
  identical, model tables differ only in partition source (`Parquet.Document ( File.Contents ( DataFolder … ) )` vs
  `Sql.Database`). ADR-0014 item 6 makes the repo the source of truth and the pack a re-packed copy.
- Same data (§1), same rules lineage (the web engine started as our Track C, parity 601 rows TRUE on 2026-10-27), 39 of
  62 catalogue metrics already named and tested, 17 test sets + T-06 552 / 552, ADR-0008 performance work that the
  spec's DAX would undo, and a Track A contract on our measure names.
- A rebuild would redo all of that to reach the same numbers, slower, and break Track A.
- The report layer is the large part: moving from one bookmark page to 4 pages touches nearly every visual container.
  It is done inside the same PBIP (pages, groups, bookmarks), reusing the existing visuals.

## 9. Ordered work list (after the USER decisions in §10)

| # | Item | Owner | Size | Verify |
|---:|---|---|---|---|
| 0 | ADR amendment(s) for the decided conflicts (ADR-0004 layout, Requirements F-01/F-08..F-11/C-45/F-21/C-46/F-04 as decided) | main agent | S | ADR accepted by USER |
| 1 | One-by-one measure map spec 304 → ours (name, rule, keep / wrap / add / drop), measure dictionary rows | bip | S | map reviewed; no rename of Track A contract names |
| 2 | Expected values: 63 goldens + §4 reference outputs regenerated from the vosk.dev engine as CSV fixtures (both companies, default views + custom-range cases) | hunter | M | fixtures reproduce `chat-golden.csv` and spec §4 tables |
| 3 | Allocation rounding per decision D6 (unrounded `fact_pl_allocated` in loader + `.sync/data-gen/pnl` generator, or accept) | ginee | S–M | goldens #21, #22, #27, #62 within 0.011; T-06 552 / 552 |
| 4 | Catalogue completion: 13 line measures + 8 missing metrics as thin wrappers over the existing engine | bip | M | 63 golden DAX blocks TRUE; existing 17 sets TRUE |
| 5 | Calc group `Comparison Column` as a façade over the column measures (if D9 keeps it) | bip | M | goldens with Column ≠ Base (#12-14, 26, 52, 54, 60) TRUE; N-01 timing unchanged |
| 6 | Custom range (time view RANGE, range-start parameter, window, period texts, notices) | bip | M | spec 08 §6 custom-range checks; T-11 / T-12 |
| 7 | Display controls F-15 / F-16 / F-17: cost sign, `Statement Columns` field parameter (Line note, ±15% bar), tags, hide-empty toggle | bip | M | statement reference 08 §4.1; T-16 both states |
| 8 | Analysis one page: variances all rows + 4-slicer member filter + totals row; bridges unchanged | bip | L | 08 §4.3 (37 rows P, footer Δ −$21.6 m); T-R4; T-05 |
| 9 | Profitability: region table (8 cols), concentration, trend small multiples (`Trend Row`), heatmap; bubbles / breakdown per D7 | bip | L | 08 §4.4; T-R5 |
| 10 | Report re-layout: 4 pages + 2 tooltip pages, frame, panels, ~55 bookmarks, sync slicers; Vitals per D8 | bip | L | `powerbi-report-author validate` 0 / 0; Desktop render; USER click-test |
| 11 | Formats: U+2212, zero without sign, `n/a` | bip | S | grep of format strings; render check |
| 12 | Theme: region colour map, Plex vs Segoe decision | bip | S | screenshots |
| 13 | Performance pass N-01 on the 4 pages | bip | M | Performance Analyzer ≤ 2 s per filter change (N-01) |
| 14 | Re-pack `.sync/pnl/power-bi` (+ `.sync/data-gen/pnl`), binding per D5; README fixes ("3 entities", row counts) | ginee | M | pack refresh row counts; T-06 552 / 552; validate 0 / 0 |
| 15 | Track A impact check of any measure change | fin | S | fin's DAX probes unchanged |
| 16 | Model republish to RAW for Track A (dev) | ginee | S | refresh OK; T-06 on the service model |

## 10. Decisions for the USER

| # | Decision | Options | bip recommendation |
|---|---|---|---|
| D1 | What the Power BI flavour must match | (a) the web report as built (spec, "code wins": amend Requirements / ADRs first) · (b) `docs/Requirements.md` (spec advisory) | (a) only with the amendments written first (C1) |
| D2 | Group view | hide like the web · keep it exposed (F-01, T-01, T-15) | keep in the model; picker follows D1 |
| D3 | Statement-wide slice filters | drop like the web · keep (F-08..F-11, F-34) | follows D1 |
| D4 | Layout | 4 pages 1280 × 720 (+ 900 scroll) · ADR-0004 one page 1440 × 810 | 4 pages if D1 = (a) |
| D5 | Data binding of the delivered PBI | ours (lh_raw in the repo, 23-file Parquet pack, ADR-0008) · the web's 4 Parquet + manifest, M allocation, DAX translation | ours: same content, faster |
| D6 | Allocation rounding | accept cent-rounded allocation (up to ~1 unit per slice-year) · switch to unrounded | unrounded (cheap, makes the goldens exact) |
| D7 | Variances and Profitability | web (all rows + 4-slicer filter; region-only + trends) · ours (Top 8/12/All, one cut; breakdown + bubbles) | follows D1 |
| D8 | Vitals card technique | new Card with reference labels (spec) · keep SVG cards (same content, tested) | keep SVG unless the USER wants the native card |
| D9 | Measure names | rename to the spec's 304 · keep ours and add spec-named wrappers where the goldens / catalogue need them | wrappers (Track A contract, ADR-0006) |

## 11. Decisions (2026-11-16)
USER: **Option B.** The PBI base stays the main source; this is a sync to the web, not a permanent rule; no ADR. Two hard targets: **(1) numbers identical to the web report** (vosk.dev engine as of 2026-11-16, oracle = spec `08-validation.md` + a fresh engine dump); **(2) layout and design = the spec** (`05-pages.md`, `06-interactions.md`, `07-theme.md`). The rest delegated to the main agent:

| # | Ruling (main agent) |
|---|---|
| D1 | Requirements / ADRs stay the contract on paper; where the web differs, the PBI follows the web and the deviation is listed here as a sync deviation (C2–C10), not amended |
| D2 | Group hidden in the UI as in the web ("Not built yet"); the model keeps Group (3 goldens need it) |
| D3 | Statement slice filters as in the web (off, with its note); measures stay |
| D4 | 4 pages + 2 tooltip pages at the spec's sizes (1280 × 720, Profitability 1280 × 900) |
| D5 | Keep our binding (lh_raw in the repo PBIP, DataFolder in the pack) |
| D6 | Unrounded allocation (target 1 needs it): ginee changes the loader, `--dry-run` first, the `lh_raw` write waits for the USER's yes |
| D7 | Web versions of Analysis and Profitability |
| D8 | Whichever reproduces the spec's Vitals design closest; keep the SVG cards if they match |
| D9 | Keep our names (ADR-0006); no wrappers; tests map spec names to ours |
| Engine | Tests run locally (Desktop on a scratch copy, as for earlier captures); no publish to RAW for testing |

## 12. Phase 2 result (layout and design, bip, 2026-11-16)

Report rebuilt to `05-pages.md` / `06-interactions.md` / `07-theme.md`: pages `P&L statement`, `Vitals`, `Analysis`, `Profitability`
(1280 × 720; Profitability 1280 × 900, fit to width) + tooltip pages `TT Vitals card`, `TT Info`; frame (rail, header, page
tabs, notice badge, How to read, Reset); panels Company (Group shown as a disabled tile, D2), Period (with Custom range
"From", bookmark `Period - Range on`), Versions, Slice (static notice, D3), Display (cost sign, statement columns, tags,
hide empty), Applied filters, How to read ×3, Variance filter (Analysis); 55 bookmarks, 15 sync groups, visual-to-visual
cross-filtering off (variance slicers filter only the variance table and its title / badge / empty text). Theme = spec
`ledger-theme` values merged into `acme-finance-theme.json` (name kept). Model: 32 measures, 6 calculated tables
(`param_cost_sign`, `param_show_tags`, `param_hide_empty`, `param_range_start`, `dim_trend_row`, field parameter
`param_statement_columns`); custom range in `_Win Start` / `_Win End Raw`; no rename (ADR-0006).

Sync deviations Power BI forced (fallback used):

| Spec | Power BI | Fallback |
|---|---|---|
| Statement headers "Actual", "Δ", "±15%" … | a field-parameter matrix shows the parameter names | names "Base", "Δ A", "±15% A" … (they double as the column checklist) |
| ±15 % bar on a fixed ±0.15 scale | data bars scale to the column's min / max | `PL Bar A` clamps to ±0.15; scale follows the largest shown Δ % |
| Statement columns checklist, all ticked | hand-written selection on a field parameter not applied | nothing ticked = every column shown |
| Selected tile: company tint + accent text | hand-written selected style ignored (known since 2026-10-21) | Desktop's dark selected tile |
| Vitals: new Card with reference labels | SVG cards kept (D8: same face, tested) | SVG resized to the spec grid; status chip under the title, ⓘ = hover tooltip |
| Concentration as 100 % stacked bar | stacked bar of shares (sums to 100 %) | region colours fixed, legend off |
| Trends: label the last point only | not available | labels off, tooltips carry the values; continuous month axis |
| Heatmap GM header strip (P11) | not built | GM % stays in the ⓘ; cell colour = cell NR (spec) |
| Time view 2 columns × 3 rows | 3 × 2 tiles | same six values |
| Slice panel dashed "All" boxes | no dashed border on buttons | solid `#CDD4DC` on `#F6F8FA` |
| Tooltip pages 320 × 240 / 360 × 280 | existing pop-up measured for 380 × 300 | 380 × 300 kept |
| Hide page tabs in the Service | report setting, not PBIR | USER sets it on publish |

Performance (N-01, filter change < 2 s): not met. Compare A Budget → Prior year, cold, all visuals of the page at once:
profit bridge 21 s, NR bridge 19 s, variances 5 s, Vitals cards 3–6.5 s; single visuals cold 2–5 s. Pre-existing (ADR-0008
notes); `LV Delta Bar` adds ~1.3 s cold to the variance table. Perf pass is an open item.

### 12.1 Follow-up 2026-11-16 (bip): oracle parity, layout deviations, N-01

**Tests** (fresh scratch copy of the repo PBIP on the pack data: unrounded allocation, 6-row `param_time_view`; Desktop,
block by block; 19:16–20:04 on the 17:33 model, which the final state keeps; R-16 rewritten for the static bridge labels):

| File | Blocks | Rows | Not TRUE |
|---|---|---|---|
| `tests/web-oracle-2026-11-16.dax` | 84 | 4,515 (4,514 oracle rows + coverage row) | 0 |
| `tests/web-spec-golden.dax` | 16 | 1,342 (63 goldens, 08 §4 reference rows, R-15 20, R-16 42 bridge labels) | 0 |
| `tests/control-totals.dax` | 23 | 858 | 0 |

Final report state (static bridge labels, 22:20–22:45, fresh scratch): control totals 858 / 0; Analysis goldens R-05 / R-06 + R-16 237 / 0; the 10 oracle bridge blocks 284 / 0; the other blocks read only the unchanged model.

**Oracle.** hunter's `js-report/lib/test-utils/parity/parity_selections_2026-11-16.csv` (vosk.dev engine as of 2026-11-16,
4,514 rows, 21 selections) runs as `tests/web-oracle-2026-11-16.dax` (generator `tools/oracle-2026-11-16/gen_oracle.py`,
83 blocks, one per selection × view, plus a coverage row): all 4,514 rows match, 0 accepted differences (coverage row:
4,514 generated, 0 accepted). Texts compare exactly as the visuals render them. Readings outside the oracle (Group, header
status line, raw FX under a member filter, the vs Compare B column kept empty when Compare B = None, ranking ties) are in
`docs/design/parity-rules.md` (Accepted platform differences, and the run under Check). The custom-range ruling holds: P-RNG-2407-2506 shows NR
organic growth +129.8 % (6 of 12 PY months) with the "Prior year n/a before Jan 2024: it covers 6 of the range's 12
months" notice, as the web.

Model changes (no rename, ADR-0006; 298 → 317 measures, 4 calculated tables):

| Area | Change | Oracle family |
|---|---|---|
| Variances | Money texts `LV Comparison Text`, `LV Base Text`, `LV Δ Text`, `LV Δ B Text`, `LV FX Text` ("$4,302.4 m", U+2212, no sign at zero); totals row = Σ of the listed leaves (the web footer); `LV Δ % Text` totals and zero rule; `LV Show` (listing rule: a leaf with nothing in base or comparison drops out, every table measure blanks it); `LV Rank Key` (sort: \|Δ\| to the cent, ties in account order); "n/a" when Compare B has no data, empty column when Compare B = None | var.* |
| Bridges | `dim_bridge_axis` / `dim_profit_axis` + `Bridge Axis Delta` / `Is Total`, `Profit Axis Delta` / `Is Total`, `_Bridge Cmp Code`: the first bar reads "Budget NR", "Prior year Adj. EBITDA"; `_Profit Step` D&A / adjusting items 0 (not blank) when nothing is booked | nr_bridge.*.label, profit_bridge.ADJ |
| Statement | Format strings without a sign on a value that rounds to zero, U+2212 on ratio rows; `PL Δ A %` / `PL Δ B %` "n/a" when the comparison is 0 | stmt.*_text |
| Trends | `Trend Growth Last` / `Trend CM % Last` (end labels); `param_cc_year` + `_CC FY`: constant-currency rates of the selected fiscal year on every month of a cross-year window (`_Amt Raw`, `_Elim Amount`, `Bridge Volume`, `Prof Trend Growth`, `Prof Trend CM %`) | trend.TOTAL.* |
| Header | `Period Summary` without " - custom range"; `Filter Value` fiscal year "2025 – 2026" for a range across years | hdr.filter.* |
| Heatmap | `dim_heat_row` + `Heat Grid Cell` / `Fill` / `Ink`, `Heat Line GM Text`, `_Heat NR Ratio` also on the row axis | (layout) |

All 317 measures are in `docs/model/measure-dictionary.md`. `powerbi-report-author validate`: 0 errors, 0 warnings.

**Deviations of the §12 table, re-checked** (render check on the scratch copy, default view Consumer Products YTD Sep
2026; the four pages, the Period / Versions / Company / Display panels, the variance filter and both tooltip pages):

| Spec | Now | Status |
|---|---|---|
| Statement headers "Actual", "Δ", "±15%" … | Field-parameter names are the headers: "Actual", "Compare A", "Compare B", "Budget", "Latest est."; "Line note" and the A / B suffixes on Δ, Δ %, ±15% stay because the same names are the Display checklist (spec 06 names them "Δ % A") | partly closed; rest accepted (one name serves header and checklist) |
| ±15 % bar on a fixed ±0.15 scale | data bars minimum −0.15 / maximum 0.15 (Number) | closed |
| Statement columns checklist, all ticked | selection saved on the field parameter's Fields column (NAMEOF values + filterExpressionMetadata, as Desktop writes it): all 13 ticked | closed |
| Selected tile: company tint + accent text | the button slicer's state id is `selection:selected` (not `selected`): tint fill, accent border, dark title; the second line (company description, base-version note) `#4F5C6C` via a `label` entry for `selection:selected` on `hdr_entity` / `s_base_version` (it fell back to near-white on the tint) | closed |
| Vitals: new Card with reference labels | SVG cards (D8) | kept by ruling |
| Concentration as 100 % stacked bar | `hundredPercentStackedBarChart`, labels 1 dp | closed |
| Trends: label the last point only | a series blank except on the last month carries the only data labels | closed |
| Heatmap GM header strip (P11) | a "Gross margin" row ("GM 51.6%" per line, company GM in the total column) directly under the column headers; a separate strip matrix cannot keep its columns aligned with the heatmap | closed (row instead of a strip) |
| Time view 2 columns × 3 rows | 2 × 3 tiles | closed |
| Slice panel dashed "All" boxes | buttons and shapes have no dashed outline | accepted (Power BI cannot) |
| Tooltip pages 320 × 240 / 360 × 280 | `TT Vitals card` 320 × 240, `TT Info` 360 × 280, content re-laid out | closed |
| Hide page tabs in the Service | report setting, not PBIR | accepted (USER on publish) |

Found in the render check, not in the §12 table:

| Spec | Now | Status |
|---|---|---|
| 05 §4.2 bridge data labels = `[Br Label Text]` (money, signed, above each bar) | **USER 2026-11-16: speed.** Fixed formats on the visual-calculation bars (`an_nr_chart`, `an_pb_chart`): level `$#,0.0" m";−$#,0.0" m";$0.0" m"`, increase `+$#,0.0" m"`, decrease `−$#,0.0" m"` (the bar height is positive); Base `#,0` and first, so the value axis reads 3,400 / 600; label density 100, overflow on, profit bridge 6 pt and inner padding 12 %. Labels sit inside the bars. What shows: USD millions (default) = the 08 §4.3 text exactly (R-16, 42 labels); thousands = the thousands value with " m" ("−$64,973.4 m"); EUR / GBP = "$" kept; a step that rounds to zero "+$0.0 m" (web "$0.0 m"), a step of exactly 0 no bar and no label; profit steps too short for an inside label show none (P default: GM rate … FX, adjusting items; the tooltip has the value). A dynamic label (model measure on a transparent carrier segment, tried first) matched every selection but tripled the bridge queries; removed with its 6 measures | closed for USD millions; rest accepted |

**Performance (N-01, filter change < 2 s): not met.** Every slow query is formula-engine bound (storage engine ≤ 1.4 s per
query, FE ≥ 90 %). Script replays, cold, Compare A = Prior year, Consumer Products YTD Sep 2026, interleaved before / after
on one scratch instance (the machine also ran another agent's model, so ±50 % drift): net revenue bridge 5.5–12.2 s (median 10.6) → 5.4–8.8 s (6.5); profit bridge 11.4–20.7 s (11.4) → 10.5–13.4 s (12.2); variances 6.3–7.9 s → 5.4–10.3 s for the rows + 2.7 s for the new totals row (the web footer); statement matrix 31–33 s → 16–23 s; Vitals cards 1.4–4.9 s → 2.0–6.9 s (no measure change: drift). Desktop, fresh copy, cold,
the Analysis page at once (default view, same shared machine): variances 32 s, net revenue bridge 53 s, profit bridge 59 s.
A visual-level measure filter on the variances table tripled its query (30–50 s): removed, the measures blank unlisted leaves
instead. Set-based rewrites of `Bridge Volume`, `_Profit GM Rate` and `_Vitals Parts` gave no measurable gain and were not
kept. Reaching 2 s needs model-physical work (#handoff ginee): pre-translated constant-currency amounts per budget-rate year
on `fact_pl` / `fact_pl_allocated` (the ADR-0008 §4 prototype measured −26 … −55 %), a pre-aggregated driver table (units and
NR by slice × month × version) for the volume step, and an aggregation at account × month × version × entity for the
unsliced views; plus a logical redesign by bip (ADR-worthy): window × version pairs and account sets as relationship filters
instead of the FILTER-built tables of `_Amt Window` / `_Amt Row`.

Bridge labels and speed (USER 2026-11-16: "a snappy report"): the dynamic label text re-evaluated every step (formula-engine bound). Replays of the bridge query, cold, default view, Consumer Products, 2 runs each: net revenue bridge 3.6–3.8 s → 11.8–12.6 s with the dynamic labels → 3.0–3.6 s with the static formats; profit bridge 7.1–7.6 s → 18.5–18.8 s → 4.9–6.7 s. The static formats add no query.

**Performance after ADR-0017 P0 + P1 (bip, 2026-11-17; details and method: ADR-0017 § 7).** Desktop page-cold, default view: statement 22.9 → 6.4 s, Vitals 6.2 → 1.6 s, Analysis 21.1 → 7.6 s (profit bridge 7.2 s), Profitability 36.9 → 2.4 s. Replays (default / Compare A → Prior year / Group + LTM + constant currency): statement 5.5 / 5.9 / 17.6–19.2 s, Vitals 3.4 / 3.4 / 4.7 s, Analysis 15 / 15 / 16 s (11 queries at once, about 2× Desktop), Profitability 4.7 / 4.7 / 5.2 s. Target ≤ 5 s / ≤ 10 s met on Vitals and Profitability, not on the statement (zero-rule format strings at the default view, constant currency in the worst case) and Analysis (profit bridge). Changes: `LV Delta Bar` and `_LV Scale` removed (P0); `_Win`, literal selection defaults, entity view without slice filters as one filter, lazy "comparison has data" check, bridge total row blank, no visual-level filter on the profitability table (P1); 316 measures; tests 4,515 / 1,342 / 867 TRUE. The mapping tables of option B gave 0 % / −4 % and were not adopted. Open: P2 (constant-currency amounts in long form, volume driver table; ginee) or a USER decision on static statement formats.

### 12.2 Profitability rebuild to the 2026-11-17 spec (bip, 2026-11-17)

**Input.** `C:\__VOSK__\docs\pnl\power-bi-profitability-spec.md` (vosk.dev repo, 2026-11-17 12:31), synced under the §11
ruling (Option B: PBI base stays the main source, no ADR, Requirements / ADRs not amended; numbers and texts = the web
report, layout = the spec). Web code read for the exact copy: `C:\__VOSK__\src\lib\pnl\engine\profitability.ts`,
`view-copy.ts`, `format.ts`, `src\components\pnl\views\profitability-view.tsx`. Repo PBIP only; `.sync/pnl/power-bi/` not
touched (open in Desktop). Tools: `pbi-report/ACME Unified PnL/tools/profitability-2026-11-17/` (`patch_model.py`,
`patch_report.py`: re-runnable from the 2026-11-17-1247 backup; `gen_test.py`; `edit_dict.py`).
`tools/phase2-web-sync/gen_report.py` no longer runs (its `content_statement` holds a fragment of `content_analysis` since
the 2026-11-17 00:21 edit): the page was patched in place, not regenerated.

**Page.** `pnl_profitability` 1280 × 900 Fit to width → **1280 × 720 Fit to page** (USER 2026-11-17: every view page 16:9,
same size). All four view pages are now 1280 × 720, Fit to page (`pnl_statement`, `pnl_vitals`, `pnl_analysis`,
`pnl_profitability`); the tooltip pages keep 320 × 240 / 360 × 280, Actual size. Frame unchanged (rail, header, tabs, panels,
Reset, How to read, 15 sync groups, bookmarks: no bookmark targets a content visual of the page, so none dangles). Top row
y 118–376: A table panel 742 px (64 %) + B concentration 416 px (36 %); bottom row y 386–704: C combo + D heatmap, 579 px
each. Visuals 148 → 152: out `pf_trend_growth`, `pf_trend_cm`, `pf_trend_title`, `pf_trend_panel`, `pf_trend_info`; in
`pf_combo_panel`, `pf_combo_title`, `pf_combo_info`, `pf_combo_chart` (line and clustered column), legend
`pf_combo_key_sw` / `pf_combo_key_nr` / `pf_combo_key_dot` / `pf_combo_key_cm`, `pf_tab_dhead` (Δ column header).
How to read: "Below" line per spec §3.

**Model** (no rename, ADR-0006; 316 → 321 measures; 1 calculated table):

| Change | What |
|---|---|
| New table `dim_combo_period` | Months and fiscal quarters of `dim_month` (year_label > period_label axis). `Combo NR` / `Combo Contribution` fill the window's months, or its quarters when the window is longer than 12 months (a partial quarter = its months in the window), at the selected FY's budget rates on every period; `Combo CM %` = contribution ÷ NR of the period (ratio of sums). Model-driven, so the §8 quarter figures match exactly; the spec's hierarchy fallback was not needed |
| Added (10) | `Prof CM Status` (1 on track, 2 ahead, 3 watch, 4 off track), `Conc Segment Share`, `Prof Δ Header`, `Combo NR`, `Combo Contribution`, `Combo CM %`, `Combo Tooltip`, `Combo Title`, `Combo Legend NR`, `Combo Bar Fill` |
| Changed (10) | `Prof Net Revenue`, `Prof Contribution`, `Prof Adj EBITDA` (money format "$1,488.6 m", currency symbol, m / k), `Heat Grid Cell` / `Fill` / `Ink` (money text, Total and GM % rows), `Heat NR Fill` / `Ink` (web ramp: accent 15 % + 70 % × cell ÷ largest cell, white text above 0.45), `Info Title` ({grain}), `Info Detail` (the web's ⓘ values for the four panels) |
| Removed (5, orphaned by this change; no test or Track A query used them) | `Prof CM Dot`, `Prof CM Dot Color`, `Trend Growth Company`, `Trend CM % Company`, `Trend Panel Title` |
| Calculated rows | `dim_pl_info`: PROFTABLE / CONC / HEAT texts per spec, COMBO replaces TRENDS; `dim_heat_row`: NA, EU, AP, UK, Total, GM % |

Kept although the page no longer shows them: `Trend Growth`, `Trend CM %`, `Trend Growth Last`, `Trend CM % Last`, `Trend Note`,
`Prof Trend Growth`, `Prof Trend CM %`, `dim_trend_row` (the 2026-11-16 oracle asserts them), `Conc Share` and `Heat Cell`
(Track A), the older unused `Prof Panel Title` and `Bubble *` (not orphaned by this change).

**Sync deviations** (numbers unchanged; what Power BI shows differently from the spec):

| Spec | Power BI | Why |
|---|---|---|
| Column 3 header "Δ vs Budget %" from the comparison | A card (`Prof Δ Header`) drawn over the static header cell; text exact | A table header cannot be a measure. The card sits on fixed column widths: resizing that column in Desktop needs the card moved |
| Status dot colours #8592A3 / #3BA37B / #D9A441 / #C2410C | Power BI icons: CircleFilled (grey), CircleHigh (green), CircleMedium (amber), CircleLow (red); rules on the CM Δ pp value with the 0.3 / 1.0 pp thresholds; the column is left-aligned so the dot stands in front of the value | A field-value SVG icon with the exact colours (or rules on `Prof CM Status`) re-evaluates CM Δ pp: +1.5 s cold on the table query. `Prof CM Status` (1–4) stays as the tested status |
| No "−0.0" on Δ % and CM Δ pp; "n/a" when missing | Static formats as before: a value between −0.05 and 0 prints "−0.0"; no comparison data = empty cell | A zero-rule format string cost +1.6 s cold on the table query (CAND-047); the numeric columns cannot hold "n/a". Same open USER decision as the statement (ADR-0017 § 7) |
| Segments and heat rows in the table's row order | Static NA, EU, AP, UK (`dim_heat_row`); the table itself sorts by NR | Bar series and matrix rows cannot sort by a measure. The static order equals the NR order in every company and fiscal year of the data (test PS-07) |
| Segment hover "{level}: {region} {share}" | Native tooltip: Level, Region, Share | Text tooltip not built |
| Combo: year under the first month | Year centred under its months (hierarchy axis) | Power BI axis layout |
| Combo: white markers with a dark outline | Dark filled markers | No marker border property on this chart |
| Combo tooltip sentence alone | Native field list plus the sentence ("Sep 2026: net revenue $402.7 m, contribution $155.3 m, CM 38.6%", partial quarter "(2 of 3 months)") | Native tooltip |
| Combo labels "last point only when crowded" | CM % on every point (label density auto) | ≤ 12 points per view |
| Combo legend | Cards over the chart (tint swatch + measure text, dot + text); axis titles as the spec (left title from `Combo Legend NR`) | Legend names cannot follow currency / units |
| Heatmap column headers "line + GM 51.6%" | A bottom row "GM %" ("GM 51.6%" per line), as the spec's Power BI note; ⓘ text says "The GM % row carries the line's gross margin %" | A matrix header cannot show a measure |
| Heatmap cell: line 1 bold, line 2 normal | Whole cell Semibold | One font per matrix cell |
| Heatmap cell tooltip "{Region} × {line}: NR …, GM …" | Native cell value; the ⓘ lists NR and GM per line | A matrix has no Tooltips role |
| ⓘ values of the combo: the period, then one row per period | The period line only ("Period: net revenue $3,369.0 m, CM 39.1%") | The shared 360 × 280 tooltip page has no room for 24 rows; the chart tooltip has the per-period figures |
| How to read "… Scroll for them." (web) | Dropped; spec §3 wording | The page no longer scrolls |

**Tests** (scratch copy of the repo PBIP on `.sync/data-gen/pnl/parquet`, TMSL refresh, block by block, 2026-11-17):

| File | Blocks | Rows | Not TRUE |
|---|---|---|---|
| `tests/profitability-spec-2026-11-17.dax` (new: §8 table rows + total and statuses, concentration, combo Jan–Sep, mix totals / GM / top-left cell, custom range total + 8 quarters, static order, partial quarter, measures in error) | 8 | 117 | 0 |
| `tests/web-spec-golden.dax` | 16 | 1,342 | 0 |
| `tests/control-totals.dax` | 24 | 867 | 0 |
| `tests/web-oracle-2026-11-16.dax` | 84 | 4,515 | 0 |

**Timing** (Desktop page-cold, default view, ClearCache then first open of the page, first query start to last query end; same
machine, same hour, baseline = a fresh copy of the pre-change repo). The machine was far slower today than at ADR-0017 § 7
(statement 15–17 s here vs 6.4 s then), so compare within a column:

| Page | Baseline | After |
|---|---|---|
| Profitability | 5.4 s (table 5.1 s, heatmap 3.9 s) | 3.5 s (table 3.2 s, heatmap 2.1 s, combo 1.4 s, bars 0.9 s); below the 5 s target |
| Vitals (render after refresh) | 4.5 s | 4.7 s (no change on the page) |
| P&L statement | 14.9 s | 17.3 s (no change on the page; noise) |
| Analysis | 20.0 s | 17.1 s (no change on the page; noise) |

Table query replays (cold, 2 runs each): as first built 6.9–7.0 s; without the zero-rule format strings 5.3–5.4 s; without the
field-value icon 5.2–5.7 s; final form (money formats, icon rules) 3.4–3.7 s. The money format strings cost nothing measurable.

**Re-pack of `.sync/pnl/power-bi/`** (after the USER closes Desktop): the pack's report definition and its `_measures.tmdl`,
`dim_pl_info.tmdl`, `dim_heat_row.tmdl` equal the pre-change repo files, so the re-pack copies from the repo
`pages/pnl_profitability/` (whole folder), `tables/_measures.tmdl`, `tables/dim_pl_info.tmdl`, `tables/dim_heat_row.tmdl`,
the new `tables/dim_combo_period.tmdl`, adds `ref table dim_combo_period` after `ref table dim_bridge_axis` in the pack's own
`model.tmdl` (keep its `DataFolder` query order), copies `tests/profitability-spec-2026-11-17.dax`, then opens, refreshes
and saves so `cache.abf` carries the new calculated table; the pack README's page sizes change (Profitability 1280 × 720).
