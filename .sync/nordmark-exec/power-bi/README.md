from rusloc/pnl (bip) · to vosk.dev repo agent · 2026-10-30 · status: ready

**Generate the data, then refresh (USER 2026-10-30).** The pack ships no data and no model cache: the Parquet files and `.pbi/cache.abf` are not in git. Generate the 18 Parquet files + `manifest.json` with `../../data-gen/` (`nordmark-exec\generator\generate.py`, output `data-gen\nordmark-exec\parquet`), set `DataFolder` to that folder, refresh in Power BI Desktop, check, then publish (see How to open). The generated files are byte-identical to the `../data/parquet/` files this pack used until 2026-10-30 (checked 2026-10-30 by ginee), so the earlier verification still holds: on 2026-10-30 bip opened the loaded pack (26 tables, 878,120 rows), the landing page rendered Week 43 · vs Budget · All with 7 / 3 / 2 and the v5 card faces, and a test sample passed (see How to verify). `powerbi-report-author validate`: 0 errors, 0 warnings.

**Publish after the Desktop refresh; no refresh in the service.** Do not schedule a refresh: the source is local Parquet, which the service could only read through an on-premises gateway. The published report is a snapshot of the generated data. `DataFolder` ships as a placeholder. No workspace, dataset, tenant or capacity IDs belong in `.sync/`. Embed size 1440 × 810.

# Nordmark Exec — Power BI pack (PBIP + local Parquet)

A copy of the repo's Power BI flavour `pbi-report/Nordmark Exec/` (ADR-0013, built by bip, finished 2026-10-30 with the period model
and the category filter). The model reads local Parquet through a `DataFolder` parameter; this copy only changes that parameter's value
from a repo path to a placeholder (and its `///` comment). The generator that builds its data is in `../../data-gen/nordmark-exec/`
(generator, checks, data README; the data itself is not in git). Saved state = the default view: Week 43 FY2026 ·
Budget · All · no category, no attribute picks.

Data, names and numbers are fictional: Nordmark Retail is an invented NL / BE multi-category reseller.

## What is here

| Path | What |
|---|---|
| `Nordmark Exec.pbip` | Open this in Power BI Desktop |
| `Nordmark Exec.SemanticModel/` | TMDL, Import, 17 Parquet tables + `meta_dataset` (manifest.json) + `dim_item` (calculated, the period-model items) + 6 picker tables + `_measures` (390 measures), 26 relationships, compatibility level 1702 |
| `Nordmark Exec.Report/` | PBIR: page `exec_landing` (1440 x 810, FitToPage) + hidden tooltip pages `tt_info`, `tt_drill`, `tt_rule`, `tt_dot`; 4 bookmarks; custom theme and 3 SVG resources |
| `tests/control-totals.dax` | DAX query tests against `control_totals_eur.csv` and `control_totals_category_eur.csv` in `../../data-gen/nordmark-exec/checks/` (207 blocks, 50,390 rows); expected values are embedded |
| `tests/parity/2026-10-30-pbi-faces.csv` | Rendered card faces, ⓘ texts, header line and dot / counts of 7 picker states, for the cross-flavour check with the JS app |

## How to open

1. Use a current Power BI Desktop that opens Power BI Projects (`.pbip`) with a TMDL model and a PBIR report.
2. Generate the data: in `.sync\data-gen`, `.venv\Scripts\python.exe nordmark-exec\generator\generate.py` (setup and
   requirements in `../../data-gen/README.md`; about 5 s). It writes `data-gen\nordmark-exec\parquet\` (18 files + `manifest.json`).
3. Open `Nordmark Exec.pbip`. There is no data cache, so the tables are empty; if Desktop offers to refresh, cancel. Set the
   parameter first: Transform data > Manage parameters > **DataFolder** = the full local path of `data-gen\nordmark-exec\parquet`,
   without a trailing backslash (the folder also holds `manifest.json`, which the model reads for the as-of week and the header's
   refresh stamp). The shipped value is the placeholder `<folder holding the Parquet files>`, so a refresh fails until you change it.
   Close & Apply, then Home > Refresh (about 8 s on the source machine, 0.88 M rows). The page then shows Week 43 · vs Budget · All.
4. Check (How to verify), then publish from Desktop (Home > Publish).
5. Desktop writes its own `.pbi/localSettings.json` and `.pbi/cache.abf` (both ignored by git), and a save writes your machine path
   into `definition/expressions.tmdl`: put the placeholder back there before committing anything in `.sync/`.

## How to verify

1. The landing page after the refresh: Week 43 · 19–25 Oct 2026 · vs Budget · All regions & formats; 7 on track / 3 watch / 2 off track, orange
   dot; Net sales €61.4m, Total margin 36.3 %, Weeks of cover 11.4 wks.
2. Run `tests/control-totals.dax` one `// ==== BLOCK` at a time (DAX query view or ADOMD); every row's `_pass` must be TRUE. The whole
   file in one batch runs out of memory, and a full serial run takes about 4 hours (the T-N1 blocks take 2–4 min each).
   Run by bip on the loaded pack (2026-10-30, same data as a generate run): T-N1-ALL-W26 (1,496 rows), T-N1-NL-P25 (1,511), T-N1-ONLINE-W26,
   T-N9-1, T-N9-5, T-N9-9, T-N10-ALL-ELEC, T-N10-BE-ELEC_TOYS, T-N10-ALL-FRESH_AMBIENT_HB: 9 blocks, 6,977 rows, all TRUE (T-N1 3 blocks / 4,231 rows, T-N9 3 / 75, T-N10 3 / 2,671). The full run (207 blocks,
   50,390 rows, all TRUE) was done on the repo PBIP on 2026-10-30.
3. Optional: `powerbi-report-author validate "Nordmark Exec.pbip"`.

## What changed vs the repo copy

| Where | Repo (`pbi-report/Nordmark Exec/`) | This pack |
|---|---|---|
| `definition/expressions.tmdl`, `DataFolder` | Absolute repo path of `data/nordmark_retail_dummy_data/parquet`; comment says so | Placeholder `<folder holding the Parquet files>`; comment points to `nordmark-exec/data/parquet` (written before the data moved: the folder is now `data-gen/nordmark-exec/parquet`) |
| `README.md` | Repo README | This file: pack sections first, then the repo README's report notes below (repo paths there name files in rusloc/pnl) |
| Excluded | `tools/` (generator and runners), `__backup__/`, `.pbi/localSettings.json` (report and model) | — |
| Added | — | — (the data is generated by `../../data-gen/nordmark-exec/`, not in git) |

Everything else, including the partitions, measures, report, bookmarks, theme and tests, is byte-identical to the repo copy.

## Known caveats

- **Desktop interaction check pending.** bip render-checked the landing page of the loaded pack (same data); hover pop-ups (ⓘ, binoculars, chip,
  dot) and slicer clicks cannot be automated and are still the USER's first-open items (checklist below). Picked filter chips show
  Power BI's default dark selected style (deviation 7).
- **Repo drift.** The source of truth is rusloc/pnl. Any change there means re-copy and reset `DataFolder` to the placeholder.
- `.platform` files keep the repo's `logicalId` values. They only matter if a workspace is connected to Git.
- A generate run from `../../data-gen/nordmark-exec/` is byte-identical to the repo's `data/nordmark_retail_dummy_data/parquet/` (ginee, 2026-10-30).

---

## Report notes (from the repo README of 2026-10-30)

Repo paths below (`tools/`, `docs/`, `js-exec/`, `data/nordmark_retail_dummy_data/`) name files in rusloc/pnl; they are not in this pack.
"This machine" means the source machine. Timings are informative only.

### Data source

- Every table reads `Parquet.Document(File.Contents(DataFolder & "\<table>.parquet"))` with explicit column types (the Trucks / Mirelo
  pattern). A file source does not fold. Derived on load: `dim_kpi[domain_order]`, `dim_kpi[owner_cadence]` (More KPIs drawer).
- `meta_dataset` = one row from `manifest.json`: `current_week_key` (the as-of week, FY2026-W43), `refreshed` (the header stamp, E-05).
- `dim_date` is not loaded: no fact joins it and every label comes from `dim_week`. The lakehouse switch of ADR-0013 (b) "Later" only
  replaces the partition sources; the Power Query and partitions belong to ginee from here on.

### Model in one paragraph

Star schema, single-direction relationships: every fact joins `dim_week` on `week_key`, site facts join `dim_store`, category facts
`dim_category`, supplier facts `dim_supplier`, OpEx `dim_cost_type`. Base measures evaluate over the `dim_week` rows in context (the
window) and the region in `param_region` (leaf sums filter `dim_store[scope_code]`; All = no filter, so DCs, wholesale and central costs
appear only in All, as the data README says). **Period model (ADR-0013 (k)):** `dim_item` is a calculated table from `dim_week` with one
row per item — 95 weeks, 22 months (4-5-4 retail periods), 8 quarters, 2 years at the shipped as-of week; partial items
(`FY2026-Q4`, `FY2026`) are "to date" — and every window as `sort_index` bounds: the item (weeks within actuals), LY (`ly_week_key`,
blank in FY2025), the previous item (`lw_week_key` at Week; else the item before, cut to the picked item's weeks when it is partial) and
the EBITDA Previous window at Week (the previous month's first k weeks; none for week 5 of a 5-week month). `param_granularity`
(Week / Month / Quarter / Year) filters `dim_item` (one relationship, single direction). `[_Item Key]` reads the picker and every card
measure reads its window from `dim_item`. Status, counts and the dot are window-context measures with the thresholds of
`param_status_rule`; status is N/A where the value or its basis is blank (FY2025 has no budget). **Category filter (ADR-0013 (l),
E-100 … E-104):** the Category dropdown filters `dim_category[category_name]`, which joins the six category facts (sales, budget,
inventory, forecast, availability, receipts) natively, so 9 cards follow the pick with unchanged formulas and combine with the region.
`[_Category Active]` (a pick of fewer than all 9 categories; all 9 ticked = All) blanks the facts without a category key — every OpEx
and EBITDA measure (`Total margin − BLANK ()` would otherwise be Total margin) and the PO / OTIF measures — so EBITDA flash and
Supplier OTIF show the N/A face (value `–`, Δ `n/a by category`, grey chip, no bars, the one-line ⓘ note); sell-through runs on the
seasonal part of the pick and is N/A without one; GMROI target = the pick's own row (single) or its average-on-hand-weighted mean;
cover target keeps its forecast-weighted rule; availability 97 %. `supplier.primary_category_code` is deliberately not related. Details:
`docs/model/nordmark-measure-dictionary.md`.

### The page (v5 map)

| Zone | Power BI |
|---|---|
| Side bar 56 px | Static SVG (mark, 3 icons) + transparent buttons: Filters, How to read, More KPIs (bookmarks `bm_filters`, `bm_how`, `bm_more`; one layer at a time, `bm_close` from × and the scrim). Badge = image measure (active attribute picks) |
| Header | One SVG image measure: brand, the picked item's period line (`Week 43 · 19–25 Oct 2026`, `Quarter 4 to date · 28 Sep–25 Oct 2026`, `Month 10 FY2025 · …`, bold up to " to date"), comparator line (`vs Budget`, `vs Last year (same retail week / weeks)`, `vs Previous week / month / quarter`), region + the category segment of a pick (` · Electronics`, ` · Electronics & Toys & leisure`, ` · 3 categories`; nothing at All or with all 9 ticked), refresh stamp |
| Status line | SVG: dot (literal v5 rule over the rated cards, grey with "no rated card" when none, static), three count pills, "n of 12 metrics · picks". Hover target on the dot → `tt_dot` |
| Cards | 12 image visuals at the v5 rectangles (3 hero 437 x 236, 3 medium 437 x 176, 6 small 213 x 168), one `Card SVG <KPI>` measure each: wash, title + sub-title (`week 43, all channels` / `month 10` / `quarter 4 to date`; EBITDA `month 10 to date` at Week; LFL `vs LY week / month / quarter / year`; + prov.), chip (– N/A grey where the card has no status), value, Δ vs the comparator in the status colour (`vs prev. wk / mth / qtr` for Previous; any `n/a vs …` in muted ink #5F6878), bars of the picked type (13 weeks / 12 months / 8 quarters / 2 years ending at the item, picked one in the status colour, dotted target = the item's basis, blank before the data starts), ⓘ and binoculars |
| Layer scrim | One shared `layer_scrim` (ink at 78 % transparency, full page incl. the side bar, below every layer group) shown by `bm_filters` / `bm_how` / `bm_more`, hidden by `bm_close`; a click on it runs `bm_close` |
| Hover targets per card | ⓘ → `tt_info` (548 x 715): stacked block (USER 2026-10-30) — `Actual` 16 px / 600 #374151 → value 48 px / 700 ink (unit 16 px / 500 muted) → 12 px → dotted 20 px swatch + basis name (`Budget` / `Target` / `Plan`) 16 px / 600 #374151 → target value 40 px / 700 ink, unit 16 px / 600 #374151 (no basis: the name and a muted `–`); 4 px between each label and its number; any comparator; then Δ (EBITDA at Week vs Previous names the weeks: `vs P9 weeks 1–4`), labelled bars, 3 stats by type, What it is / Why it matters / Formula / Worked example / Status rule (no owner note), tags Group · Lever · Owner closed by the refresh / provisional note, no footer row; binoculars → `tt_drill`; chip → `tt_rule` |
| Filters menu | Solid panel with button slicers. **Period:** type `menu_param_granularity` (Week · Month · Quarter · Year; single, force selection) → FY `menu_item_fy` (FY2025 · FY2026) → item: `menu_item_wide` (Quarter / Year chips incl. `Q4 · to date`, `FY2026 · to date`) and `menu_item` (Week / Month chips W1 … W52 / P1 … P12, 8 x 7 grid), then `menu_showing` = "Showing" + the header period line. Comparator (Budget · Last year · Previous; the Previous row is hidden at Year by a visual filter on `[_Comparator Row Visible]`), Region / format, **Category** (`menu_param_category`: dropdown on `dim_category[category_name]`, multi select, no Select all; shows Power BI's own "All" when nothing is picked), then Group, Lever, Owner (multi select; Horizon and Statement removed, `dim_kpi.horizon` / `statement` stay in the data). Reset = *Clear all slicers*: type back to Week (force selection), FY, item and category empty → Week 43 FY2026 · Budget · All · all categories. The layer bookmarks only show / hide the menu (the category slicer is one of their targets); they never reset it |
| How to read · More KPIs | SVG panels (How to read is a measure: eyebrow `Nordmark · <item title>`, comparator name, the bars bullet names the four lengths); More KPIs = a table of the 20 bench KPIs from `dim_kpi` |

### Tests

`tests/control-totals.dax` holds 207 blocks; run each `// ==== BLOCK` as its own query (one ADOMD batch of all blocks runs out of
memory; one large UNION of card or SVG measures also explodes the plan (13 GB), so T-N2, T-N3, T-N4, T-N7, T-N9 and T-N10 are one scenario per block). Every row returns `_pass`.
Full run on 2026-10-30 (period model): 34,118 rows, 0 not TRUE (about 2 h 10 min serially). After the 2026-10-30 perf pass and ⓘ
block, the behaviour blocks T-N2 … T-N9 and the slowest T-N1 block per scope (`ALL-P26`, `NL-P25`, `BE-P26`, `ONLINE-P25`) were run
on a scratch copy of this PBIP with the USER's data cache (ADOMD): 164 blocks, 14,471 rows, 0 not TRUE (T-N1 4 / 7,373; T-N2 100 / 4,932; T-N3 30 / 148; T-N4 16 / 1,716; T-N5 27; T-N6 11; T-N7 4 / 84; T-N8 5; T-N9 7 / 175). **Full run after the category round (2026-10-30):** 207 blocks, 50,390 rows, 0 not TRUE on a scratch copy of this PBIP with the USER's data cache (ADOMD, about 3 h 50 min serially incl. a repeat of the 18 T-N10 blocks): T-N1 20 / 27,231; T-N2 100 / 4,932; T-N3 36 / 179; T-N4 16 / 1,716; T-N5 27; T-N6 11; T-N7 5 / 90; T-N8 5; T-N9 9 / 225; T-N10 18 / 15,974.
Runner: `tools/run/run-tests.ps1 -Port <port>` (all blocks) or `-Pattern "T-N10"` (category scopes only).

| Block | Checks |
|---|---|
| T-N1 (20) | every row of the 87 item keys of the CSV (27,231 rows: W / P / Q / FY keys and the `@k` like-length and EBITDA-Previous keys) through the base layer, per scope; N/A rows (absent in the CSV = blank). The 6 legacy `PTD-` / `YTD-` keys are retired here: their mix rows carried the W43 exit mix, the model now reads window shares (ET-24) |
| T-N2 (100) | card layer through the picker slicers, per scope x {W43, P10, Q4 to date, FY2026 to date, FY2025 P10 / P12 / Q1 / FY2025} x {Budget, Last year, Previous}: value, comparator, Δ, status, mix deviation, counts + dot; EBITDA vs Previous at W39 / W31 / W35 (ET-22 … ET-26, ET-31) |
| T-N3 (36) | texts: the v5 card faces at Reset and in the saved state (ET-02, ET-22); headers, titles and phrases per item; comparator lines and short Δ suffixes per type; Year offers Budget · Last year and reads LY for Previous (ET-23); EBITDA ⓘ `vs P9 weeks 1–4`, W35 `n/a vs prev. mth` muted (ET-31); FY2025 N/A cards and rated counts 4 / 3 (ET-26); picker fallbacks W43 → P10 → Q4 → FY2026 (ET-28); Online N/A; category (c1–c6): header segment for 1 / 2 / 3 categories and none for all 9 ticked, the N/A faces of EBITDA, OTIF and non-seasonal sell-through, rated 9 (ELEC) / 10 (ELEC + TOYS), GMROI target 2.2 / cover 15.0 / availability 97.0 at ELEC, badge ignores the pick, sub-titles unchanged, How to read names the category |
| T-N4 (16) | bars per type per scope: count 13 / 12 / 8 / 2 and every bar = the item-key value (ET-25) |
| T-N5 | back margin = supplier income (ET-07); NL + BE + Online + Wholesale = All (ET-12); no measure in an error state |
| T-N6 | conceal in place with the three attribute groups (ET-13) |
| T-N7 (5) | ⓘ stacked block per card under Budget, Last year and Previous: `Actual` + value, then swatch + basis name + target value (+ the Δ line at Budget), in this order and with the specified sizes; SVG height = the page image; Owner tag, no Horizon, Statement, owner note or footer target; FY2025 P10: basis name + muted `–` for the 8 cards without a basis, the target value for the other 4 (ET-30, ET-32); ELEC: the one-line notes of EBITDA, OTIF and sell-through, `–` value and basis, n/a stats (E-101) |
| T-N8 | item lists 95 / 22 / 8 / 2, partial `FY2026-Q4` and `FY2026`, `FY2026-P10` complete, no P11 FY2026 (ET-21) |
| T-N9 (9) | frame parity: in 9 picker states (Reset, P10 · LY · All, Q4 · Previous · NL, FY2026 · Budget · BE, FY2025 P10 · Budget · Online, W43 · Previous · All, W35 · Previous · BE, ALL#ELEC W43 · Budget, NL#ELEC+TOYS P10 · Previous) every card face shows the card-layer value and chip (and Δ on hero / medium cards), every ⓘ the value, basis, Δ (EBITDA long form) and status word; the status line and dot tip show `[Window Status Pack]` |
| T-N10 (18) | category scopes: all 10,514 rows of `checks/control_totals_category_eur.csv` (12 picks × 12 keys at All; NL / BE / Online × {ELEC, ELEC + TOYS} × 6 keys) through the base layer with the Category slicer on top of the region, plus 5,460 N/A rows (EBITDA / OPEX / OTIF families, sell-through without a seasonal category, mini stats of categories outside the pick) (ET-33, ET-34) |

### Timings (E-84)

Perf pass 2026-10-30 (USER targets: every card ≤ 1.0 s, every ⓘ ≤ 3.0 s cold). Method (`tools/run/time.ps1`): one DAX query per
visual measure (header, status line, 12 cards, 12 ⓘ), XMLA ClearCache before **every** query, 3 runs, median; picker state passed as
slicer filters; freshly opened scratch instance of this PBIP (Desktop 2.157.1354.0, USER data cache). ADOMD client time includes a fixed
floor of about 0.33 s (a constant query after ClearCache). Desktop sends the visual queries in parallel.

| Selection | Slowest card (ms), before → after | Slowest ⓘ (ms), before → after | Status line (ms), before → after |
|---|---:|---:|---:|
| Week 43 · Budget · All | 1,316 → 525 | 4,195 → 1,298 | 993 → 695 |
| Month 10 · Last year · All | 1,361 → 541 | 4,346 → 1,364 | 944 → 616 |
| Quarter 4 to date · Previous · Netherlands | 1,319 → 652 | 5,065 → 1,393 | 1,022 → 668 |
| FY2026 to date · Budget · All | 1,351 → 546 | 4,517 → 1,324 | 1,036 → 690 |

Slowest before = the EBITDA card and the EBITDA ⓘ; after, every card is 0.38–0.65 s and every ⓘ 0.81–1.39 s. The earlier README
figures (EBITDA card 2.0–2.5 s, ⓘ 9–10 s) came from a run whose cache clear never executed (a TMSL `clearCache` the engine rejects,
output discarded); they are not comparable with this method.

What was slow: query-plan size, not scans. Each SVG measure called the card-layer measures (`Card Value / Compare / Status / … Text`),
each of which resolved the picked item again (19 `[_Item Key]` evaluations per EBITDA card) and ran the scoped leaf sums with the
picker and region filters in context (the region filter alone roughly doubled a card). What changed: every SVG measure (`Card SVG`,
`Info SVG`, `Status Line SVG`, `Dot SVG`) is built in **one frame** — the slicers are read once (picked `dim_item` row, type,
comparator, region, attribute state), the face is computed inside one `CALCULATE` that clears the picker tables and passes the region as
a `dim_store[scope_code]` filter, every window `CALCULATE` is one VAR, and value / comparator / status / texts are computed in place
with the same DAX as the card-layer measures (kept for the tests; T-N9 proves both agree). A real dimension filter such as the coming
`dim_category` slicer passes through the frame unchanged (no extra disconnected-table work).

**Category round, with and without a pick** (same method, `tools/run/time.ps1` now interleaves the states):

| Selection | Header (≈ query floor) | Slowest card | Slowest ⓘ | Status line |
|---|---:|---:|---:|---:|
| Week 43 · Budget · All | 296 | 363 (SELL_THROUGH) | 887 (EBITDA) | 550 |
| Month 10 · Last year · All | 296 | 393 (SELL_THROUGH) | 932 (EBITDA) | 521 |
| Quarter 4 to date · Previous · NL | 298 | 378 (SELL_THROUGH) | 940 (EBITDA) | 533 |
| FY2026 to date · Budget · All | 292 | 367 (SELL_THROUGH) | 863 (CHANNEL_MIX) | 500 |
| **ALL#ELEC** · Week 43 · Budget | 291 | 359 (SELL_THROUGH) | 959 (EBITDA) | 560 |
| **NL#ELEC+TOYS** · Month 10 · Previous | 301 | 381 (SELL_THROUGH) | 945 (EBITDA) | 570 |

Interleaved runs (each measure timed in all six states back to back, 3 runs, median; fresh instance, 2026-10-30 evening). A pick costs nothing measurable: same instance, same measure, pick vs no pick within ±10 %. An afternoon run on a loaded machine (a browser holding one core; constant-query floor 1.1–1.3 s) showed the same parity at about 3× the absolute times.

### Platform differences and deviations

Platform rows for `docs/design/parity-rules.md` (E-87): solid panels instead of frosted glass; static dot (no pulse ring); FitToPage
instead of the responsive breakpoints; Segoe UI instead of Inter; filters conceal by a faded card face, not CSS.

| # | v5 / js-exec | Power BI | Why |
|---|---|---|---|
| 1 | Frosted glass pop-ups, menu and drawer (E-59) | Solid white panels with the same 1 px border and 16 px radius; a 22 % ink scrim | No backdrop blur in Power BI (ADR-0012 §2.5, accepted platform difference) |
| 2 | Pulse ring on the overall dot | Static dot, same colour and tooltip | No CSS animation (E-26, accepted) |
| 3 | Responsive breakpoints 1200 / 720 px | FitToPage at 1440 x 810 | Accepted (E-61, E-87) |
| 4 | Inter | Segoe UI (inside the SVGs and the native visuals) | Accepted (E-60) |
| 5 | ⓘ, binoculars and chip open on click; focus trap, Esc, pills between explanation and drill path | Hover (and keyboard focus) report-page tooltips `tt_info`, `tt_drill`, `tt_rule`; no pills inside the pop-ups | Tooltips are not interactive; click pop-ups per card would need 24 bookmarked groups |
| 6 | Side bar layers close with Esc; active side-bar button tinted | × and a click on the dark scrim close (bookmark `bm_close`); no active tint | Bookmarks cannot react to keys; one layer at a time is kept |
| 7 | Filter chips: cobalt-tinted selected chip | Native button slicers (pill tiles); the picked chip shows Desktop's default dark style | Selected-state formatting written in PBIR is not applied; the USER's 2026-10-29 saves (21:25, 22:49) carry no chip restyle, so there is nothing to copy yet |
| 8 | Concealed card: opacity 0.08 + greyscale, `inert`, out of the tab order | Same look inside the card SVG; its hover targets return blank (no tooltip) | Visuals cannot be made inert |
| 9 | More KPIs drawer grouped under domain headings | A scrolling table: Domain · KPI · Formula · Owner, catalogue order | Native table; matrix expand states cannot be authored reliably in PBIR |
| 10 | Worked-example and Δ line breaks by browser layout | Static copy wrapped with Segoe UI metrics; worked examples and small-card Δ rows wrapped by character count (52 / 14) | SVG text does not wrap |
| 11 | ⓘ pop-up sized to its content | Fixed tooltip page 548 x 715 (SVG 520 x 697, sized to the tallest card with a 6-line example; white space under shorter cards; no scrolling) | Tooltip page size is fixed |
| 12 | `dim_date` (ADR-0013 (d)) | Not loaded | No fact joins it; every label comes from dim_week |
| 13 | Picker: switching the type selects the item that holds the last pick (W43 → P10 → Q4 → FY2026), and that chip is shown selected; the FY row is hidden at Year | The cards, header and "Showing" line switch the same way (`[_Item Key]` fallback), but no chip of the new type is highlighted until one is clicked; the FY row stays at Year (it then drives the single Year chip) | A slicer cannot select a value on behalf of another slicer |
| 14 | One item row | Two item rows: a wide Quarter / Year row (so `Q4 · to date` fits) and an 8 x 7 Week / Month grid; the row of the other types stays empty | Button-slicer tiles have one fixed size per visual; `autoGrid` gave three huge tiles per row |
| 15 | At Year the comparator menu renders two options and a user on Previous snaps to Last year | The Previous row of the comparator slicer is filtered out at Year; a Previous pick made before switching to Year stays selected underneath but reads Last year (header, Δ) | Slicers cannot be re-selected by a measure |
| 17 | Category dropdown reads "All categories" when nothing is picked | Power BI's native dropdown reads "All" | Accepted platform difference (`docs/design/parity-rules.md`, 2026-10-30) |
| 18 | Category list opens inside the Filters layer | The dropdown list opens in Power BI's overlay above the menu and the scrim; close it before a screenshot | Native slicer behaviour |
| 16 | Dot tooltip grey state | Same text (`Overall: grey · no rated card.`); not reachable with the shipped data (OTIF and Weeks of cover are always rated) | Same guard as js-exec |

### Parity notes (for hunter)

- Default open = Reset = Week 43 FY2026 · Budget · All: 7 / 3 / 2, orange dot, v5 card faces (T-N3-01, T-N3-02).
- Category scope in DAX tests: `TREATAS ( { "Electronics", "Toys & leisure" }, dim_category[category_name] )` on top of the region;
  scope `NL#ELEC+TOYS` of the category CSV = `TREATAS ( { "NL" }, param_region[scope_code] )` + those names.
- Rendered faces for the cross-flavour check: `tests/parity/2026-10-30-pbi-faces.csv` (`tools/run/export_faces.py`).
- Picker state is three slicers: `param_granularity[granularity_name]`, `dim_item[fy_label]`, then `dim_item[label]` (Week / Month) or
  `dim_item[label_wide]` (Quarter / Year). In DAX tests set the codes: `TREATAS ( { "Q" }, param_granularity[granularity_code] )`,
  `TREATAS ( { "FY2026" }, dim_item[fy_label] )`, `TREATAS ( { "Q4 · to date" }, dim_item[label_wide] )`; `[_Item Key]` returns the
  item (`FY2026-Q4`).
- Comparator codes stay `BUD` / `LY` / `LW` (`LW` = Previous, label "Previous"); at Year `[_Comparator Code]` returns `LY` for `LW`.
- EBITDA at Week reads month to date (`[EBITDA Flash]`); Previous = the `P-…@k` key; W35 / W9 / W22 / W48 → `n/a vs prev. mth`.
- Non-default week pick for ET-25 parity: any W chip in FY2025 / FY2026 (e.g. `W20`); the bars are the 13 W items ending there.
- Copy: `js-exec/lib/engine/copy.ts` exported at build time (snapshot `tools/gen/copy_ts.json`); the view.ts sentences (stats, worked
  examples, How to read, dot tip) are mirrored in the generator (`tools/gen/tokens.py`, `tools/gen/measures_svg.py`).
- ⓘ stacked block geometry (SVG baselines, x = 24): `Actual` 87, value 125, swatch y 142.5 (x 24–44) with the basis name at x 52 / 148,
  target 180, Δ 201, rule 222; ⓘ bars at y 126–186, labels 199. Gaps are visible gaps: 4 px from a label's baseline to its number's cap
  top (0.7 em), 12 px from the actual's baseline to the basis name's cap top.

### First-open checklist (USER)

1. Generate, set `DataFolder` and refresh (How to open; the model computes `dim_item` and `param_granularity` on refresh). The page should read
   Week 43 · vs Budget · All, 7 / 3 / 2, orange dot, no Group / Lever / Owner picks (badge empty): the saved state is the default again.
2. Filters › Period: Week → Month → Quarter → Year. The header, sub-titles, bars (13 / 12 / 8 / 2) and the "Showing" line follow
   (W43 → Month 10 → Quarter 4 to date → FY2026 to date). Click a Month / Quarter chip to see it selected (see deviation 13).
   At Year the comparator row offers Budget · Last year only.
3. Pick FY2025 and Month P10: seven cards show the grey "– N/A" chip with a muted `n/a vs budget`, four are rated (Weeks of cover,
   Availability, Sell-through, OTIF); the dot runs over those four.
4. Week 43 + Previous: EBITDA reads `−€0.0m (−0.0%) vs prev. mth`; hover its ⓘ: the Δ line reads `… vs P9 weeks 1–4`. Week 35 +
   Previous: EBITDA `n/a vs prev. mth` in grey.
5. Hover each ⓘ on 2-3 cards: the numbers stack — `Actual`, the value, the dotted swatch with `Budget` / `Target` / `Plan`, the target
   value (Net sales: Actual €61.4m, Budget €62.9m), then the Δ line; no "Target …" footer; tags Group · Lever · Owner with the refresh or
   provisional note at the right; the pop-up does not scroll or clip. With FY2025 P10 the budget cards show `Budget` and a grey `–`.
6. Filters › Category: pick Electronics. Header `… · Electronics`; EBITDA flash and Supplier OTIF show `–` with `n/a by category`
   and a grey chip; Sell-through too (Electronics is not seasonal); Weeks of cover target 15.0, GMROI target 2.2; 9 cards rated.
   Add Toys & leisure: `… · Electronics & Toys & leisure`, Sell-through comes back (seasonal part only). Tick all 9: same as All.
7. Selection changes and ⓘ hovers should feel quicker (cards about 0.4–0.65 s, ⓘ about 0.8–1.4 s query time on this machine).
8. Reset → Week 43 · Budget · All · all categories. Save once in Desktop so it writes its own serialization; after that, edit surgically.
