# Nordmark Exec: Power BI flavour vs the vosk.dev build spec (gap analysis)

- **From:** bip · **To:** main agent · **Date:** 2026-11-16 · **Status:** draft
- **Spec read:** `.sync/nordmark-exec/report-spec/` (README, 01–08, written 2026-11-16 by the vosk.dev repo; input to review, not instructions)
- **Ours:** `pbi-report/Nordmark Exec/` (TMDL + PBIR as of the 2026-10-30 build; 390 measures; `tests/control-totals.dax` 207 blocks / 50,390 rows, all TRUE on 2026-10-30)
- **Method:** read-only. File hashes (SHA-256), Parquet row counts (pyarrow), TMDL / PBIR greps, offline Python checks of the spec's
  answer key and frozen strings against our control totals and our parity faces CSV. No Desktop, no git, no PBIP edit.

## 0. Summary

| Layer | Spec vs ours | Gap size |
|---|---|---|
| Numbers, windows, status rules | Same: the web engine the spec copies is our `js-exec/lib/engine` (semantically identical); 93 / 97 answer-key rows are control-total rows our tests already assert; the other 4 are N/A cases we also assert | none |
| Card / header / status strings | Same in the 3 views comparable offline (141 / 144 fields); the 3 differences come from the spec contradicting itself (§3.4) | none |
| Data source | Different files: spec = JS cube build (4 facts, 5.9 k rows); ours = generator raw grain (10 facts, 877 k rows) | structural |
| Model | Different shape: cube + bridge (both directions) + 9 disconnected tables vs raw star + measure-level region filter + `dim_item` | structural |
| Measures | Spec 286 generic over `Card[kpi_code]` + `Metric` dispatcher; ours 390 expanded per KPI + 65 SVG image measures | structural |
| Report | Spec 1280 × 720, 5 pages, native visuals, 31 bookmarks, Explain page; ours 1440 × 810, 1 page + 4 tooltip pages, SVG cards, 4 bookmarks | structural |
| Validation | Spec adds `chat-golden.csv` (97 rows), Golden / Control tables and a Validation page; ours has DAX query tests only | functional (small) |

**Verdict: UPDATE** (keep the PBIP; add the validation layer and the small items in §9). The structural differences are not
defects: each one contradicts an accepted ADR-0013 decision or a CLAUDE.md rule (§7). Meeting the spec literally is a
**REBUILD** of model and report, and only follows if the USER rules that the spec supersedes ADR-0013 for the Power BI
flavour (§10, decision 1).

## 1. Data

### 1.1 Files

| File (spec) | Spec path | Rows | SHA-256 (first 12) | Same file in this repo | Loaded by our PBIP |
|---|---|---:|---|---|:-:|
| manifest.json (55,380 B) | `C:\__VOSK__\data\nordmark\parquet\` | – | `8f5d575d8c8c` | `js-exec/public/data/`, `.sync/nordmark-exec/js-app/public/data/` (byte-identical) | no |
| cube.parquet | same | 4,599 | `af366b40262b` | same two folders | no |
| opex.parquet | same | 1,029 | `cb3b8cbd4d41` | same two folders | no |
| po.parquet | same | 95 | `b617a2cb40a1` | same two folders | no |
| sites.parquet | same | 190 | `0b7064d24322` | same two folders | no |
| control_totals_eur.csv | `C:\__VOSK__\data\nordmark\checks\` | 26,143 | `0055e1578731` | `data/nordmark_retail_dummy_data/checks/` (identical) | tests |
| control_totals_category_eur.csv | same | 10,514 | `2de58d7c717d` | same (identical) | tests |
| chat-golden.csv | same | 97 | `81e4bbf72391` | **absent** (built in vosk.dev by `scripts/nordmark-golden.ts` from the control totals) | – |

What our PBIP loads (`DataFolder` = `C:\__PBI\PNL\data\nordmark_retail_dummy_data\parquet`, byte-identical to
`.sync/nordmark-exec/data/parquet/`): 7 dims (`dim_week` 104, `dim_store` 149, `dim_category` 9, `dim_supplier` 1,100,
`dim_cost_type` 4, `dim_kpi` 32, `dim_date` 728 not loaded), 10 facts at week × store (× category / supplier / cost type):
sales 121,572 · budget 68,094 · inventory 122,427 · forecast 121,572 · availability 119,862 · receipts 120,717 ·
supplier income 71,345 · PO 88,937 · OpEx 42,001; `param_status_rule` 15, `param_target` 27; `manifest.json` 6,989 B
(`meta_dataset`).

Provenance: the cube files are the `js-exec` build output (`scripts/build-exec-data.ts`) of the same generator folder,
seed 20261028, as-of FY2026 W43. Same truth, different grain: the cube is pre-aggregated to site group
(NL · BE · ONLINE · WHOLESALE · DC · CENTRAL) × category.

### 1.2 Binding

| Item | Spec | Ours |
|---|---|---|
| Parameters | `DataFolder` (→ vosk.dev `data\nordmark\parquet\`) + `ChecksFolder` | `DataFolder` only (→ this repo's raw folder; E-80, ADR-0013 (b)) |
| Queries | 25 (manifest-driven `Week`, `Period`, `Bar Item`; `Card`, `KPI Drill Step`, `Metric`, `Comparator`, `Window`, `Region*` as M `#table` literals; Golden / Control from CSV) | 19 M partitions + 7 calculated tables (`dim_item`, 6 `param_*`) |
| Period table | M from manifest (127 rows, `week_ix` 0-based, PTD / PTD LY / PTD prev bounds as columns) | DAX calculated `dim_item` (127 rows, `sort_index` 1-based; PTD current / LY derived in measures; `eb_prev_*` = spec `ptd_prev_*`) |

## 2. Model

| Topic | Spec | Ours | Gap |
|---|---|---|---|
| Facts | `Cube`, `Opex`, `PO`, `Sites` keyed by `week_ix`, `group_ix`, `category_ix` | 9 facts keyed by `week_key`, `store_code`, `category_code` / `supplier_code` / `cost_type_code` | data shape |
| Region | `Region` 1→* `Region Group` *↔1 `Site Group` (**both directions**), region slicer filters the model | disconnected `param_region`; measures filter `dim_store[scope_code]` (`FILTER ( ALL ( dim_store[scope_code] ), … )` in the card frame) | pattern; spec needs an ADR (§7) |
| Period / window | disconnected `Period`; DAX applies `Week[week_ix]` ranges (CUR / LY / PREV / ITEM / BAR) | disconnected `dim_item` (+ `param_granularity`); DAX applies `dim_week[sort_index]` ranges (window, LY, prev, EBITDA prev) | **same model**, other names |
| Granularity switch fallback | latest listed item of the granularity + FY (README: accepted PBI difference) | the item that holds the old item's last week (`[_Item Key]`, ADR-0013 (k), the web's `containing` rule) | ours is closer to the web |
| Window dispatcher | `Window` + `Metric` (82 rows) tables, `[Metric In Window]` | none; per-KPI card measures carry their window | spec adds a catalogue layer |
| Card table + 3 calculated sort columns | `Card` (12, `#table` copy) + `group_sort` / `lever_sort` / `owner_sort` | `dim_kpi` (Parquet) + 3 calculated `param_attr_*` tables carrying their sort | equivalent |
| Drill steps | `KPI Drill Step` (48) related to `Card` | drill copy in measures (`KPI Drill SVG`, tooltip page `tt_drill`) | shape |
| Bench KPIs | `KPI` (32) table, bench table visual | `dim_kpi` rows `is_landing = false`, drawer SVG | shape |
| Validation tables | `Golden`, `Golden Category`, `Control`, `Control Scope Category` | none (tests are DAX query files) | missing (§6) |
| Settings | en-US, auto date/time off, implicit measures off | same (`culture: en-US`, `__PBI_TimeIntelligenceEnabled = 0`, `discourageImplicitMeasures`) | none |

## 3. Measures

### 3.1 Count

| Spec folder | Spec | In ours by name | In ours by meaning (≈) | Shape in ours | Missing in ours |
|---|---:|---:|---:|---|---|
| 0 Selection | 40 | 0 | ≈ 28 | `9 Engine` `_Item Key`, `_Window *`, `_LY/_Prev/_EB Prev *`, `_Comparator Code`, `_Scope Code`, `_Category Active`, `_AsOf Index`; labels as `dim_item` columns | ≈ 12 lookups (`Sel Item Ord`, `Sel Bar Count`, `Sel Month/Quarter/FY Start Ix`, `Sel Season Length`, PTD LY bounds …) inlined or absent |
| 1 Engine | 81 | 56 | ≈ 81 | folders 1–6; budget named `* Bud` (spec `* Budget`); `Trading Store Count`, `OTIF Suppliers Below 85` | none |
| 2 Window | 9 | 0 | ≈ 5 | per-KPI `Card Value / Compare / LY / Prev / Basis <KPI>`, dispatchers `KPI Value`, `KPI Compare` | `Metric Value`, `Metric In Window`, generic `Actual / Basis / Last Year / Previous` |
| 3 Card | 55 | 0 | ≈ 45 | 189 per-KPI measures in `8 Cards` (12 × ~15 families) | colour measures (inside SVG), `Card Chip Tooltip` |
| 4 Bars | 7 | 0 | 7 | bars drawn inside the card SVG (`Card SVG <KPI>`) | native-chart helpers (`Bar In Series`, axis min / max) |
| 5 Status strip | 18 | 4 | ≈ 16 | `7 Status` (12 status + counts + `Status Dot`, `Status Pack`) + `Window Status *` | grey dot (`#9AA1AD`, no rated card): not found in ours |
| 6 Header & copy | 13 | 0 | ≈ 10 | `Header Period / Comparator / Region Text`, `Refreshed Text`, `Filter Picks Text`, `_Category Label` | `Hdr Region Tooltip`, `How Compare Name` |
| 7 Explain | 53 | 0 | ≈ 45 | `KPI Info SVG`, `Card Basis Text <KPI>` (one SVG per pop-up, stats and worked example inline) | as separate text measures |
| 8 Validation | 10 | 0 | 0 | – | all 10 (Golden 6, Control 3, Rows Check) |
| **Total** | **286** | **60** | **≈ 237** | | **≈ 49** |

Extra in ours (≈ 200): the per-KPI expansion of the card layer (the spec does it once over `Card[kpi_code]`), 65 SVG image
measures (cards, ⓘ, drill, rule, dot), chip-style and picker-visibility helpers (`_Chip * Selected`, `_Comparator Row
Visible`), the frame measures of the 2026-10-30 perf pass.

### 3.2 Logic samples (spec DAX vs ours)

| Measure | Spec | Ours | Same result |
|---|---|---|:-:|
| `Sel Item Id` / `[_Item Key]` | one visible item, else latest of granularity + FY, else default | one visible item, else the item of the picked type holding the anchor week | yes from the default view; ours also right from W30 → Month (P8), spec lands on P10 |
| `Card Status Code` / `Status <KPI>` | badness per KPI direction, `ROUND ( _bad, 10 )`, `<= watch` 1, `<= off` 2, else 3, BLANK = N/A | identical rule, one measure per KPI, `LOOKUPVALUE` on `param_status_rule` | yes (T-N2 status rows TRUE; spec §3 table = control `status.*` rows) |
| Dot | off ≥ 1/3 red · watch + off > 50 % orange · on ≥ 2/3 green · else orange; no rated → grey | same thresholds from `DOT_*` rules; BLANK when none rated | yes except the grey colour (S fix) |
| `Weeks of Cover` | `(on hand + on order) / forecast COGS` at L | same, plus a trailing-4-week COGS fallback when forecast = 0 | yes on the data (forecast never 0 where cover is shown) |
| `Cover Target Wks` | forecast-weighted category target at L | `_Forecast x Cover Target` / `_Forecast COGS` at L | yes |
| `Card Basis Text` | `"–"` when N/A | `"–"` (ADR-0013 (m)) | yes; the spec's frozen strings say `n/a` (§3.4) |
| EBITDA flash | `Metric[flash]` → PTD window at Week for the whole EBITDA family (`ebitda`, `ebitda_margin_pct`, `opex_*`) | `[EBITDA Flash]` / `[EBITDA Flash Bud]` PTD at Week; `Opex *` and `EBITDA Margin %` stay weekly | cards yes; answer-key rows 89 / 90 need the PTD window (they pass against the PTD control rows) |

### 3.3 Answer key (97 rows) vs our control totals, offline

| Result | Rows | Note |
|---|---:|---|
| Equal to a control-total row within the spec tolerance | 93 | mapping: actual → item key; basis → `*_bud` / `*_target` / `cover_target_wks`; ly → LY item (`Q-FY2025-4@4`, `FY-FY2025@43`); prev → previous like-length; EBITDA family at Week → `PTD-FY2026-43`, prev `P-FY2026-09@4` |
| Expected BLANK (no control row) | 4 | FY2025 net-sales budget; ONLINE LFL and availability; EBITDA under Electronics: all asserted as N/A by our T-N2 / T-N10 blocks |
| Different | 0 | |

### 3.4 Frozen card strings (08 §4) vs our parity faces (`tests/parity/2026-10-30-pbi-faces.csv`), offline

| Spec view | Our state | Fields | Differences |
|---|---|---:|---|
| default (W43 · Budget · All) | W43 · Budget · All | 48 | 0 |
| W43 · Electronics | ALL#ELEC · W43 · Budget | 48 | 3: ⓘ basis `Budget n/a` / `Target n/a` (spec) vs `Budget –` / `Target –` (ours) on EBITDA, Sell-through, OTIF |
| FY2026 to date · Budget | FY2026 · Budget · All | 48 | 0 |

The 3 differences are a spec self-contradiction: its own `Card Basis Text` returns `"–"`; ours follows ADR-0013 (m).
The other 14 views have no frozen-string assertion in ours (their numbers and statuses are covered by T-N1 / T-N2 /
T-N10).

## 4. Pages and interactions

| Topic | Spec | Ours | Gap |
|---|---|---|---|
| Canvas | 1280 × 720 (web × 0.8889) | 1440 × 810 (ADR-0013 (g), E-50) | conflict |
| Pages | Executive · Explain · TT Dot · TT Chip (opt.) · Validation | `exec_landing` · `tt_info` 548 × 715 · `tt_drill` 468 × 387 · `tt_rule` 328 × 112 · `tt_dot` 320 × 146 | Explain page + Validation page missing; ⓘ / drill / rule are hover tooltips in ours |
| Card build | group of native visuals per card (box, title, chip, value, Δ, 2 buttons, combo chart) ≈ 95 visuals + 11 charts | one SVG image measure per card + invisible hover targets (85 visuals on the page) | design choice (ADR-0013 Risks (2)); perf measured on ours |
| ⓘ / binoculars | click → bookmark `Explain · <KPI>` / `Drill · <KPI>` (24) | hover → tooltip page filtered by the hover target's `dim_kpi` visual filter | interaction differs (web = click) |
| Bookmarks | 31 (Default view, 4 overlays, 24 card, 2 explain states) | 4 (`bm_filters`, `bm_how`, `bm_more`, `bm_close`) in group `bmg_layers`; no `Default view` bookmark (`menu_reset` = Clear all slicers; the measures then fall back to W43 · Budget · All) | 27 missing if the spec route is chosen |
| Slicers | tile slicers; Previous hidden at Year "TODO(verify)" | button slicers; Previous hidden at Year by visual filter `[_Comparator Row Visible] = 1` on `menu_param_comparator` (works) | none |
| Sync slicers | 6 groups to the Explain page | none needed (one page) | only with an Explain page |
| Cross-filtering | none | none (SVG images do not cross-filter) | none |

## 5. Theme

| Item | Spec | Ours | Gap |
|---|---|---|---|
| Colour tokens | 24 hex tokens (07 §1) | all present in measures / theme except `#EAEFFB` (selected side-bar fill), `#9AA1AD` (grey dot) | 2 tokens |
| Washes | flat mid tones `#FFF4E7` / `#FCF2F1` (gradient optional via SVG) | SVG gradient `#FFD3A0` / `#F3C9C5` at 0.5 opacity (= the web) | ours closer to the web |
| Faded card | `#ECEDEE` text etc. | opacity 0.08 in SVG (= the web) | equivalent |
| Fonts | Segoe UI / Semibold / Bold, pt scale × 0.889 | Segoe UI family (theme `textClasses`, 54 SVG `font-family`), px scale at 1440 | scale follows the canvas |
| Formats | text measures, U+2212, en-US | same recipes (`tools/gen/fmt.py`), en-US | none |
| Theme file | `nordmark-exec.json` (keys "may need trimming") | `nordmark-exec-theme.json`, loads in Desktop | none |

## 6. Validation coverage

| Spec check | Our suite | Can be re-pointed without Desktop? |
|---|---|---|
| Structure (row counts of `Cube` …, `Period` 127, windows at W43 / Q4 / FY2026) | `dim_item` 127 and window bounds asserted in T-N3; table names differ | authoring yes (generator `tools/gen/build_tests.py`); running needs an engine |
| Answer key 97 rows | 93 values + 4 BLANKs already asserted inside T-N1 / T-N2 / T-N10 (§3.3) | a dedicated T-N11 block can be generated offline from `chat-golden.csv`; running needs an engine |
| Control totals 36,657 rows | all asserted (T-N1 26,143 + T-N10 10,514), TRUE 2026-10-30 | already done |
| Status table (08 §3) | = control `status.*` rows, asserted | already done |
| Card strings, 17 views | 7 states frozen in the faces CSV, texts in T-N3 / T-N9 (9 picker states) | a T-N12 block from 08 §4 can be generated offline; running needs an engine |
| Default-view bars | T-N3 bars | already done |

Running any DAX block needs an Analysis Services engine: today `tools/run/run-tests.ps1` targets a local Desktop
instance by port. Alternatives without the Desktop UI: a headless `msmdsrv` started from the Desktop `bin` folder
with the model deployed by TOM (bip can script; not tried here), or the RAW workspace XMLA endpoint (ginee; a Fabric
dependency the ADR avoids for runtime, acceptable for testing only with USER consent).

## 7. Conflicts with this repo's docs and ADRs

| # | Spec says | This repo says | Source |
|---:|---|---|---|
| C1 | canvas 1280 × 720 | 1440 × 810; 1920 × 1080 alternative rejected | ADR-0013 (g), E-50, ET-14 |
| C2 | data = JS cube files in the vosk.dev repo (`C:\__VOSK__\…`) | PBI reads the generator's raw Parquet in this repo through `DataFolder`; pack self-contained | ADR-0013 (b), E-80, ET-18, ADR-0014 |
| C3 | ⓘ explanation = a page reached by bookmark | ⓘ = hidden tooltip page (Mirelo pattern); stacked block sizes; no ⓘ may scroll at 1440 × 810 | ADR-0013 (g), (m), E-57, ET-30 |
| C4 | granularity switch → latest item (accepted difference) | switch keeps the item holding the current item's last week, both flavours | ADR-0013 (k) |
| C5 | frozen strings: N/A basis `n/a` | basis label + `–` in muted ink | ADR-0013 (m); also the spec's own `Card Basis Text` |
| C6 | `Region Group` → `Site Group` cross-filter **both** | no bidirectional relationship without an ADR | CLAUDE.md Track B key rules |
| C7 | 3 calculated columns on `Card` (an M `#table`) | no calculated columns where Power Query can do the job | CLAUDE.md Track B key rules |
| C8 | `Metric` / `[Actual]` catalogue for the web's "Ask AI" answer key | no AI chat in scope | ADR-0013 Consequences (scope held out) |
| C9 | measure folders 0–8, names `Sel …`, `Card …`, `* Budget` | measure dictionary in lockstep with the model | CLAUDE.md, `docs/model/nordmark-measure-dictionary.md` |
| C10 | "from nothing but this folder" | `.sync/` files from other repos are input, never override spec / ADR | CLAUDE.md `.sync/` rules |

## 8. The spec's TODO(verify) items, answered from our build

| # | Item | Evidence in ours | State |
|---:|---|---|---|
| 1 | Report-page tooltip receives a visual-level filter | 36 hover targets with a `dim_kpi` visual filter drive `tt_info` / `tt_drill` / `tt_rule` (12 each); render-checked through a scratch visual filter 2026-10-28 | works by design; real hover still a USER check |
| 2 | Slicer with a measure-based visual filter (hide Previous at Year) | `menu_param_comparator` carries `[_Comparator Row Visible] = 1`; validator 0 / 0; USER saves on 10-29 / 10-30 kept it | resolved: works |
| 3 | `FORMAT` vs `toFixed` on exact halves | 945 parity fields 0 mismatch (2026-10-30) + 141 / 144 today (§3.4) | no case found |
| 4 | Theme JSON keys per Desktop version | our theme loads; the spec's JSON is untested | n/a for UPDATE |

## 9. Verdict and work list

**UPDATE.** Same numbers, windows, status rules and texts are already in place and tested. What the spec adds that ADR-0013
does not contradict: the answer key, a Validation page, two colour tokens, the frozen-string views. Everything else is
a different build of the same truth.

| # | Work | Owner | Size | Verify |
|---:|---|---|:-:|---|
| 1 | USER rulings on §10; ADR-0013 amendment if any spec item is adopted | main agent | S | ADR text + coms `#decision` |
| 2 | Copy `chat-golden.csv` into `data/nordmark_retail_dummy_data/checks/`; README row | ginee | S | SHA-256 = `81e4bbf72391…` |
| 3 | T-N11 block generated from `chat-golden.csv` (base layer for numbers; EBITDA family PTD at Week; N/A rows as BLANK) | bip | S | 97 / 97 TRUE on a local engine |
| 4 | T-N12 block from 08 §4: 17 views × card strings, headers, counts, dot, ⓘ blocks; record the 3 `n/a` vs `–` rows as ADR-0013 (m) exceptions | bip | M | all TRUE except the documented 3 |
| 5 | Grey dot `#9AA1AD` when no card is rated; `#EAEFFB` on the selected side-bar button | bip | S | DEFINE MEASURE test at a no-rated state; validator 0 / 0; render |
| 6 | (if decision 7 = yes) Validation page + `Golden` table (M from CSV) + 6 golden measures with a metric dispatcher over our base measures | ginee (query) · bip (measures, page) | M | `[Golden Fail Count]` = 0 |
| 7 | (if decision 3 = click) ⓘ / binoculars as buttons → explain page or bookmark layers; tooltips kept as hover | bip | L | validator 0 / 0; USER click-test |
| 8 | Measure dictionary, PBIP README, refresh `.sync/nordmark-exec/power-bi/` pack | bip · main agent | S | dictionary count = model count |
| 9 | JS side: none (engine = web engine); parity re-capture only if 4 changes a string | hunter | S | 0 gap rows |

**If the USER rules REBUILD** (spec supersedes ADR-0013 for PBI): new PQ layer on the cube files (ginee, L), model with the
region bridge (bip, M; ADR for C6), 286 measures ported from ours under the spec names (bip, L), 1280 × 720 report with 5
pages and 31 bookmarks (bip, L), tests regenerated against the new names (bip, M), parity re-run (hunter, M). Reuse: every
DAX rule, the copy, `fmt.py`, the test generator.

## 10. Decisions for the USER

1. Is this spec the contract for the Power BI flavour (supersedes ADR-0013 (b) (g) (k) (m) for PBI → REBUILD) or input to reconcile (→ UPDATE)?
2. Canvas: keep 1440 × 810 or move to 1280 × 720?
3. ⓘ / drill path: hover tooltip pages (ours) or click to an Explain page / layer (spec; the web is click)?
4. Data source: generator raw Parquet in this repo (ours) or the JS cube files (spec)? Numbers are the same.
5. N/A basis in the ⓘ: `–` (ADR-0013 (m)) or `n/a` (spec frozen strings)?
6. Granularity switch: keep the `containing` rule (ADR-0013 (k)) — recommended — or accept the spec's "latest item"?
7. Answer key: a test block only (item 3) or also a Validation page and `Golden` table inside the model (item 6)?
8. Test engine without the Desktop UI: headless `msmdsrv` (local) or the RAW XMLA endpoint (Fabric, testing only)?

## 11. Decisions (2026-11-16)
USER: **Option B (UPDATE).** The PBI base stays the main source; this is a sync to the web, not a permanent rule; no ADR. Two hard targets: **(1) numbers and texts identical to the web report** (oracle = spec `08-validation.md` + `chat-golden.csv` + the web engine); **(2) layout and design = the spec** (`05-pages.md`, `06-interactions.md`, `07-theme.md`). The rest delegated to the main agent:

| # | Ruling (main agent) |
|---|---|
| 1 | Spec = input to reconcile; ADR-0013 stays; differences listed here as sync deviations |
| 2 | Canvas 1280 × 720 per the spec (same as the P&L) |
| 3 | ⓘ and drill path per the spec (click → Explain page by bookmark) |
| 4 | Keep our raw Parquet (numbers proven identical) |
| 5 | `n/a`, as the web shows (target 1) |
| 6 | Keep the `containing` rule (it is the web's behaviour) |
| 7 | Answer key as test blocks only; no `Golden` table or Validation page in the shipped report |
| 8 | Tests run locally (Desktop on a scratch copy, as for earlier captures); no publish to RAW for testing |

## 12. Phase 1 result: numbers and card texts (bip, 2026-11-16)

| Item | Result |
|---|---|
| Oracle in the repo | `pbi-report/Nordmark Exec/tests/web/`: `chat-golden.csv` (copy, SHA-256 `81e4bbf72391…`), `card-strings.csv` (17 views, 1,292 strings), `bars-default.csv` (default-view bars), extracted from `08-validation.md` by `tools/gen/web_spec.py` |
| Tests | `tests/web-sync.dax` (`tools/gen/build_tests_web.py`): T-N11 answer key 97 rows (19 blocks), T-N12 card strings 17 views + bars 1,446 rows (18 blocks) |
| Baseline (before) | T-N11 0 / 97 (catalogue measures missing); T-N12 1,010 / 1,010 rows that read existing measures TRUE (value & unit, Δ, status word, revealed, header, counts, dot, bars); 436 rows needed new measures (sub-title, basis line, summary, bar target) |
| Failures by class | missing measure: T-N11 all 97, T-N12 436 rows; logic differs from the web engine: 0; spec error: 0 |
| Added | calculated `param_metric` (spec `Metric`, 82 codes, `flash` = EBITDA family); `Metric Value`, `Actual`, `Basis`, `Last Year`, `Previous`, `Comparison` (folder `8 Catalogue`); per card `Card Sub`, `Card Basis Label`, `Card Basis Unit` (12 each), `Card Bar Target` (11); `Status Summary Text`. 444 measures (was 390) |
| Changed | the 12 `Info SVG <KPI>`: no basis = muted `n/a` (ruling 5; was `–`); T-N7 / T-N9 expectations follow |
| After | T-N11 97 / 97, T-N12 1,446 / 1,446 TRUE; validator 0 / 0 |
| Left for phase 2 | Explain page texts as plain measures (eyebrow, three stats, worked example runs), header bold / rest runs (today `**` markers), a `Bar Item` axis table for native bar charts, colour measures, grey dot `#9AA1AD` |

## 13. Phase 2 result: layout and design (bip, 2026-11-16)

Route: the SVG faces stay (every string already tested against the web); the report around them is laid out to 05–07. Built by
`tools/gen/report_web_sync.py` from the pre-phase-2 report (backup `__backup__/Nordmark Exec.Report.2026-11-16-1920.bak`); no
measure renamed, no model change in this step.

| Item | Result |
|---|---|
| Pages | `exec_landing` "Executive" 1280 × 720 · `explain` "Explain" 1280 × 720 (hidden tab, backdrop `#F6F7F9`) · `tt_dot` "TT Dot" 300 × 140 · `tt_rule` "TT Chip" 300 × 110. `tt_info` / `tt_drill` removed (the ⓘ and binoculars are clicks now). No Validation page (ruling 7) |
| Executive | every visual × 0.8889 (the spec's board scale); the spec's positions for the 12 cards and their chip / ⓘ / binoculars targets, the section labels, the side bar (buttons, badge, icons) and the Filters panel (panel redrawn: hint, PERIOD … OWNER labels, attribute rule); fonts × 0.8889, slicer tiles 8 pt, selected tiles cobalt (`#2048C6` text, tint fill, cobalt border) |
| Explain | panel = `KPI Info SVG` (state A) / `KPI Drill SVG` (state B), centred 475 × 690; hidden card picker `dim_kpi[kpi_code]`; transparent buttons over the drawn pills (→ `Explain view · drill` / `· explanation`) and the close circle (× → page navigation to Executive); the 7 period / comparator / region / category slicers synced (groups `period-gran`, `period-fy`, `period-item`, `period-item-wide`, `comparator`, `region`, `category`) and hidden |
| Bookmarks | 31: `Default view` (data + display, both pages' slicers at Week · FY2026 · W43 · Budget · All, no category, no attributes; overlays closed; Reset points to it), `Overlay · Filters / How to read / More KPIs / none` (the 4 existing bookmarks, display names per 06), `Explain · <KPI>` and `Drill · <KPI>` × 12 (data on the card picker only, groups shown / hidden), `Explain view · drill / · explanation` |
| Theme | 07 keys merged into `nordmark-exec-theme.json` (data colours, neutrals, text classes, `*` / slicer / combo chart / table styles) |
| Validator | `powerbi-report-author validate` 0 errors / 0 warnings |
| Render | Desktop render of a scratch copy: Executive, Filters / How to read / More KPIs overlays, Explain state A and B, TT Dot, TT Chip (screenshots in the bip hand-back) |

### 13.1 Sync deviations (where the PBI build differs from 05–07)

| # | Spec | PBI | Why |
|---:|---|---|---|
| L1 | Card = group of native visuals (box, title, chip, value, Δ, 2 buttons, combo chart; ≈ 95 visuals + 11 charts) | one SVG image per card (the web's drawing at web × 0.8889) + 3 hit targets | strings already equal the web (T-N12 / T-N14); same choice as the P&L Vitals (D8); a native rebuild needs a `Bar Item` axis table and ~100 colour measures (L) |
| L2 | Header meta, status counts, summary, "Showing", badge as text boxes / cards with styled runs | SVG measures (`Header SVG`, `Status Line SVG`, `Menu Showing SVG`, `Filter Badge SVG`) | same runs and colours as the spec; measured and tested |
| L3 | Explain panel 560 × 690, native cards and a combo chart | the web pop-up SVG (520 × 755 drawn) at 475 × 690; texts also as plain measures (`8 Explain`, T-N13) | one image, tested strings; panel narrower than the spec's |
| L4 | ⓘ / binoculars icon hover `#2048C6`; side-bar Filters button selected fill `#EAEFFB` | transparent buttons over the drawn icons: no hover colour; no selected side-bar state | buttons sit on the SVG drawing |
| L5 | one Period item slicer (52 weeks · 12 months · 4 quarters · FY) | Q / FY row (`menu_item_wide`, y 150, h 25) above the W / P grid (`menu_item`, y 179, h 139) | one button slicer cannot hold both chip widths (2026-10-30) |
| L6 | Category dropdown h 28 | h 48 at y 446 (selector 32 at y 454) | dropdown floor of the validator |
| L7 | Section labels h 15; Filters hint 7.5 pt | h 18; hint 9 px (6.75 pt) | text-box floor; at 7.5 pt the hint is 317 px wide in Segoe UI and leaves the 284 px column |
| L8 | Owner tiles one row (h 25) | two rows (h 50) | four owner tiles at 8 pt do not fit 284 px |
| L9 | TT Chip = Card (new) with `[Card Title] · [Card Status Word] · [Card Rule]` | `KPI Rule SVG` in a one-row table (hover target's `dim_kpi` visual filter) | the pattern render-checked 2026-10-28 |
| L10 | Card picker `Card[kpi_name]` | `dim_kpi[kpi_code]` | stable key; hidden either way |
| L11 | Panel drop shadow; 2 px Off-track border | none in the panel images; the card SVG draws the 2 px border | images |
| L12 | Validation page, `Golden` / `Control` tables | not built | ruling 7 |

### 13.2 Tests

Run on scratch copies (cache of 2026-10-30, model = repo TMDL with 470 measures); the layout step changed no model file, so
these results hold for the final PBIP.

| File | Blocks | Rows | Not TRUE |
|---|---:|---:|---:|
| `tests/web-sync.dax`: T-N11 answer key | 19 | 97 | 0 |
| T-N12 card strings of 17 views + default bars | 18 | 1,446 | 0 |
| T-N13 Explain texts (3 views × 12 cards, EBITDA checks, panel SVG = plain texts) | 4 | 376 | 0 |
| T-N14 hunter's web oracle (`tests/parity/2026-11-16-web-faces-expected.csv`, 12 states × 135 fields) | 12 | 1,620 | 0 |
| `tests/control-totals.dax` (T-N1 27,231 · T-N2 4,932 · T-N3 179 · T-N4 1,716 · T-N5 27 · T-N6 11 · T-N7 90 · T-N8 5 · T-N9 225 · T-N10 15,974) | 207 | 50,390 | 0 |

- Oracle: 1,620 / 1,620, 0 gaps; nothing to add to `docs/design/parity-rules.md`. Not producible from the model (hunter): Group (not
  built on the web), the header status line, raw FX under a variance filter (P&L only).
- ⓘ no-basis value: phase 2 put the `–` back (hunter's oracle: the web prints `NO_BASIS_VALUE` "–"); this supersedes the `n/a` of
  § 12 / ruling 5. The card's basis text measure (`Card Basis Text <KPI>`) still returns `n/a` as the spec's frozen strings expect.
- `tools/run/run-tests.ps1` line 19 fixed (quoted `-replace` pattern); the 207 blocks ran on 3 scratch instances from a shared queue.

### 13.3 Performance (N-01: filter change < 2 s)

Cold query per visual measure (`tools/run/time.ps1`: XMLA ClearCache before every query), fresh scratch instance, 3 states
(W43 · Budget · All; Q4 · Previous · NL; P10 · Previous · NL · Electronics + Toys); the machine was also running the test suite and
another agent's Desktop, so these are upper bounds.

| Page | Visual measures | Cold time per query |
|---|---|---|
| Executive | `Header SVG` | 0.59–0.62 s |
| Executive | `Status Line SVG` (slowest on the page) | 0.89–0.93 s |
| Executive | 12 × `Card SVG <KPI>` | 0.56–0.73 s (EBITDA, Sell-through slowest) |
| Executive | all 14, run one after another | 9.0–9.2 s serial; Desktop runs them in parallel |
| Explain | `KPI Info SVG` (one per open panel) | 1.00–1.65 s (EBITDA 1.44–1.65 s, Channel mix 1.50–1.58 s) |

Every visual is under the N-01 2 s budget cold. The page-level time (parallel visuals) needs a Performance Analyzer run in Desktop
(USER); no perf work started.

### 13.4 Open

- USER click-test in Desktop (bookmark actions cannot be driven by the tools): ⓘ / binoculars on each card → Explain page on that card; drill pill / back pill; × back to Executive with the period kept; Reset (`Default view`, hand-written data state on both pages); overlays and scrim; chip and dot hover.
- Performance Analyzer pass on Executive and Explain in Desktop (page-level time; the numbers above are per query).
- `pbi-report/Nordmark Exec/README.md` (first-open checklist) still describes the 1440 × 810 page and the hover pop-ups; `.sync/nordmark-exec/power-bi/` pack not refreshed (main agent / ginee).
