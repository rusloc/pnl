# Nordmark Exec — Power BI flavour (PBIP)

> **DRAFT.** PBI flavour of ADR-0013 (Accepted 2026-10-28) incl. the period model of ADR-0013 (k) and the category filter (l).
> Local PBIP only: nothing is published, no Fabric item exists. Built by bip on 2026-10-28 against prototype v5
> (`docs/design/executive dashboard (reseller)/prototype.html`), `docs/Requirements-exec.md` and the dataset contract
> `data/nordmark_retail_dummy_data/README.md`; brought to parity with `js-exec/` on 2026-10-30 (`docs/ADD/features/exec-period-model.md`).
> **Web sync 2026-11-16** (USER Option B, no ADR): numbers and texts equal the vosk.dev web report, layout and design follow its
> build spec (`.sync/nordmark-exec/report-spec/` 05–07) at 1280 × 720, with an Explain page opened by click instead of hover
> pop-ups. Record: `docs/ADD/features/nordmark-exec-pbi-spec-gap-2026-11-16.md` §§ 11–13. All data is generated and fictional
> (Nordmark Retail is an invented reseller). Both flavours reconcile to the same control totals and share the copy of
> `js-exec/lib/engine/copy.ts`.

## What is here

| Path | What |
|---|---|
| `Nordmark Exec.pbip` | Open this in Power BI Desktop |
| `Nordmark Exec.SemanticModel/` | TMDL, Import, 17 Parquet tables + `meta_dataset` (manifest.json) + `dim_item` (calculated, the period-model items) + 6 picker tables + `param_metric` (calculated metric catalogue, 82 codes) + `_measures` (470 measures), 26 relationships, compatibility level 1702 |
| `Nordmark Exec.Report/` | PBIR: page `exec_landing` "Executive" (1280 × 720, FitToPage), hidden page `explain` "Explain" (1280 × 720), hidden tooltip pages `tt_dot` "TT Dot" (300 × 140) and `tt_rule` "TT Chip" (300 × 110); 31 bookmarks; custom theme `nordmark-exec-theme.json` and 3 SVG resources |
| `tests/control-totals.dax` | DAX tests against `data/nordmark_retail_dummy_data/checks/control_totals_eur.csv` and `checks/control_totals_category_eur.csv` (207 blocks, 50,390 rows) |
| `tests/web-sync.dax`, `tests/web/` | Web sync tests (53 blocks, 3,539 rows): T-N11 the 97-row answer key (`web/chat-golden.csv`), T-N12 the card strings of 17 views + the default-view bars (`web/card-strings.csv`, `web/bars-default.csv`, extracted from the spec's `08-validation.md`), T-N13 the Explain texts (`web/info-strings.csv`), T-N14 hunter's web oracle (`parity/2026-11-16-web-faces-expected.csv`) |
| `tests/parity/` | Cross-flavour faces: `2026-10-30-pbi-faces.csv` + hunter's report, `2026-11-16-web-faces-expected.csv` (12 states × 135 fields) + `parity-notes.md` |
| `tools/` | Generators of `_measures`, the tests, the dictionary and the report layout (`gen/report_web_sync.py`), plus the test and timing runners (`tools/README.md`; gitignored folder, committed with `git add -f`) |
| `docs/model/nordmark-measure-dictionary.md` (repo) | Every measure: definition, spec IDs, folder, format, DAX |

## How to open

1. Close any other Power BI Desktop window that has this PBIP open.
2. Open `Nordmark Exec.pbip`. The repo holds no data cache, so the tables are empty until you refresh.
3. **DataFolder.** The parameter holds an absolute path: `C:\__PBI\PNL\data\nordmark_retail_dummy_data\parquet`. If the repo lives elsewhere, change it first:
   Transform data > Manage parameters > **DataFolder** = the full path of `data\nordmark_retail_dummy_data\parquet` (the folder also
   holds `manifest.json`, which the model reads for the as-of week and the refresh stamp). Nothing else is machine-specific (E-80, ET-18).
4. Home > Refresh (about 8 s on this machine, 0.88 M rows). `dim_item`, `param_granularity`, `param_metric` and the other picker tables
   are calculated and need no refresh.

## Data source

- Every table reads `Parquet.Document(File.Contents(DataFolder & "\<table>.parquet"))` with explicit column types (the Trucks / Mirelo
  pattern). A file source does not fold. Derived on load: `dim_kpi[domain_order]`, `dim_kpi[owner_cadence]` (More KPIs drawer).
- `meta_dataset` = one row from `manifest.json`: `current_week_key` (the as-of week, FY2026-W43), `refreshed` (the header stamp, E-05).
- `dim_date` is not loaded: no fact joins it and every label comes from `dim_week`. The lakehouse switch of ADR-0013 (b) "Later" only
  replaces the partition sources; the Power Query and partitions belong to ginee from here on.
- The web report reads cube files built from the same generator output; the numbers are proven identical (gap doc § 1, ruling 4), so
  the PBIP keeps the raw Parquet.

## Model in one paragraph

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
cover target keeps its forecast-weighted rule; availability 97 %. `supplier.primary_category_code` is deliberately not related.
**Web sync (2026-11-16):** `param_metric` (the spec's `Metric`, 82 codes, `flash` = EBITDA family) with the catalogue measures
`Metric Value`, `Actual`, `Basis`, `Last Year`, `Previous`, `Comparison` (folder `8 Catalogue`); per card `Card Sub`, `Card Basis Label`,
`Card Basis Unit`, `Card Bar Target`; `Status Summary Text`; 26 plain-text Explain measures (folder `8 Explain`: eyebrow, stats, worked
example). No existing measure was renamed. Details: `docs/model/nordmark-measure-dictionary.md`.

## The pages

Layout generator: `tools/gen/report_web_sync.py` reads the pristine 1440 × 810 report (`__backup__/Nordmark Exec.Report.2026-11-16-1920.bak`,
local) and writes this report (idempotent). Every Executive visual is the 1440 build × 0.8889 (the spec's board scale), except where the
spec gives its own position (cards, hit targets, section labels, side bar, Filters panel).

**Executive** (`exec_landing`, 1280 × 720, FitToPage)

| Zone | Power BI |
|---|---|
| Side bar 50 px | Static SVG `sb_bar` (mark, 3 icons) + transparent buttons Filters, How to read, More KPIs (36 × 36 at y 53 / 94 / 135; bookmarks `Overlay · Filters / How to read / More KPIs`, one layer at a time, `Overlay · none` from × and the scrim). Badge = image measure (active attribute picks) |
| Header | `hdr` (x 71, y 12, 1188 × 46), one SVG image measure: brand, the picked item's period line (`Week 43 · 19–25 Oct 2026`, `Quarter 4 to date · 28 Sep–25 Oct 2026`, `Month 10 FY2025 · …`, bold up to " to date"), comparator line (`vs Budget`, `vs Last year (same retail week / weeks)`, `vs Previous week / month / quarter`), region + the category segment of a pick (` · Electronics`, ` · Electronics & Toys & leisure`, ` · 3 categories`; nothing at All or with all 9 ticked), refresh stamp |
| Status line | `status_line` (y 62, 1188 × 28), SVG: dot (literal v5 rule over the rated cards, grey with "no rated card" when none, static), three count pills, "n of 12 metrics · picks", the summary sentence. Hover target `status_dot_hit` on the dot → TT Dot |
| Cards | 12 image visuals at the spec rectangles: 3 hero 389 × 210 (y 121), 3 medium 389 × 156 (y 360), 6 small 189 × 149 (y 527). One `Card SVG <KPI>` measure each: wash, title + sub-title (`week 43, all channels` / `month 10` / `quarter 4 to date`; EBITDA `month 10 to date` at Week; LFL `vs LY week / month / quarter / year`; + prov.), chip (– N/A grey where the card has no status), value, Δ vs the comparator in the status colour (`vs prev. wk / mth / qtr` for Previous; any `n/a vs …` in muted ink #5F6878), bars of the picked type (13 weeks / 12 months / 8 quarters / 2 years ending at the item, picked one in the status colour, dotted target = the item's basis, blank before the data starts), ⓘ and binoculars icons. 2 px border on Off track |
| Hit targets per card | ⓘ button (25 × 25) → bookmark `Explain · <KPI>`; binoculars button → `Drill · <KPI>`: both pick the card on the Explain page and navigate there. Chip (`card_<kpi>_chip`, transparent card) → hover TT Chip |
| Layer scrim | One shared `layer_scrim` (ink at 78 % transparency, full page incl. the side bar, below every layer group) shown by the three overlay bookmarks, hidden by `Overlay · none`; a click on it runs `Overlay · none` |
| Filters panel | `menu_panel` (x 59, y 9, 320 × 702): hint, section labels PERIOD … OWNER, button slicers 284 px wide, tiles 8 pt, selected tiles cobalt (`#2048C6` text, tint fill, cobalt border). **Period:** type `menu_param_granularity` (Week · Month · Quarter · Year; single, force selection) → FY `menu_item_fy` (FY2025 · FY2026) → item: `menu_item_wide` (Quarter / Year chips incl. `Q4 · to date`, `FY2026 · to date`; y 150) and `menu_item` (Week / Month chips W1 … W52 / P1 … P12, 8 × 7 grid; y 179, h 139), then `menu_showing` = "Showing" + the header period line. Comparator (Budget · Last year · Previous; the Previous row is hidden at Year by a visual filter on `[_Comparator Row Visible]`), Region / format, **Category** (`menu_param_category`: dropdown on `dim_category[category_name]`, multi select, no Select all, h 48; shows Power BI's own "All" when nothing is picked), then Group, Lever, Owner (multi select; Owner two rows). **Reset** → bookmark `Default view` |
| How to read · More KPIs | SVG panels (How to read 516 × 449 is a measure: eyebrow `Nordmark · <item title>`, comparator name, the bars bullet names the four lengths); More KPIs (409 × 699) = a table of the 20 bench KPIs from `dim_kpi` |

**Explain** (`explain`, 1280 × 720, hidden in view mode, backdrop `#F6F7F9`): opened only by the ⓘ / binoculars buttons.

| Part | Power BI |
|---|---|
| Panel | Centred group at x 402, y 15, 475 × 690: state A `ex_panel_info` = `KPI Info SVG` (explanation), state B `ex_panel_drill` = `KPI Drill SVG` (drill path). Both drawn 520 × 755 and scaled into the panel |
| State A content | Title, then the stacked block — `Actual` → value (unit muted) → dotted swatch + basis name (`Budget` / `Target` / `Plan`) → target value (no basis: the name and a muted `–`, the web's `NO_BASIS_VALUE`) — then Δ (EBITDA at Week vs Previous names the weeks: `vs P9 weeks 1–4`), labelled bars, 3 stats by type, What it is / Why it matters / Formula / Worked example / Status rule, tags Group · Lever · Owner with the refresh / provisional note; pill `Drill path · <page>` at the bottom |
| State B content | Drill page and 4 steps, footer, pill `Back to the explanation` |
| Buttons | Transparent buttons on the drawn pills (`ex_pill_drill` → bookmark `Explain view · drill`, `ex_pill_back` → `Explain view · explanation`) and on the close circle (`ex_close` → page navigation to Executive) |
| State carried over | Hidden card picker `ex_picker` on `dim_kpi[kpi_code]` (set by the 24 card bookmarks, data only on the picker); 7 hidden slicers `ex_s_*` in the sync groups `period-gran`, `period-fy`, `period-item`, `period-item-wide`, `comparator`, `region`, `category`, so the panel shows the Executive selection and × returns with it kept |

**TT Dot** (300 × 140): the dot tip (`Dot SVG`). **TT Chip** (`tt_rule`, 300 × 110): `KPI Rule SVG` in a one-row table filtered by the
chip target's `dim_kpi` row.

**Bookmarks (31):** `Default view` (data + display: both pages' slicers at Week · FY2026 · W43 · Budget · All, no category, no
attributes; overlays closed), `Overlay · Filters / How to read / More KPIs / none`, `Explain · <KPI>` × 12, `Drill · <KPI>` × 12,
`Explain view · drill`, `Explain view · explanation`. Saved state = the default view.

**Theme:** the spec's 07 keys merged into `nordmark-exec-theme.json` (data colours, neutrals, text classes, `*` / slicer / combo chart /
table styles).

## Tests

Run each `// ==== BLOCK` as its own query (one ADOMD batch of all blocks runs out of memory; one large UNION of card or SVG measures
also explodes the plan, so T-N2, T-N3, T-N4, T-N7, T-N9, T-N10, T-N12 and T-N14 are one scenario per block). Every row returns `_pass`.
Runner: `tools/run/run-tests.ps1 -Port <port>` (control totals), `-TestFile ..\..\tests\web-sync.dax` (web sync), `-Pattern "T-N10"`
(one family).

**Status 2026-11-16** (scratch copies of this PBIP, model = repo TMDL with 470 measures; the layout step changed no model file):

| File · family | Blocks | Rows | Not TRUE |
|---|---:|---:|---:|
| `web-sync.dax` T-N11 answer key | 19 | 97 | 0 |
| T-N12 card strings of 17 views + default bars | 18 | 1,446 | 0 |
| T-N13 Explain texts (3 views × 12 cards, EBITDA checks, panel SVG = plain texts) | 4 | 376 | 0 |
| T-N14 hunter's web oracle (12 states × 135 fields) | 12 | 1,620 | 0 |
| `control-totals.dax` (T-N1 27,231 · T-N2 4,932 · T-N3 179 · T-N4 1,716 · T-N5 27 · T-N6 11 · T-N7 90 · T-N8 5 · T-N9 225 · T-N10 15,974) | 207 | 50,390 | 0 |

The 207 control-totals blocks ran on 3 scratch instances from a shared queue (a serial run takes about 4 h). `powerbi-report-author validate`:
0 errors, 0 warnings.

| Block | Checks |
|---|---|
| T-N1 (20) | every row of the 87 item keys of the CSV (27,231 rows: W / P / Q / FY keys and the `@k` like-length and EBITDA-Previous keys) through the base layer, per scope; N/A rows (absent in the CSV = blank). The 6 legacy `PTD-` / `YTD-` keys are retired here: their mix rows carried the W43 exit mix, the model now reads window shares (ET-24) |
| T-N2 (100) | card layer through the picker slicers, per scope × {W43, P10, Q4 to date, FY2026 to date, FY2025 P10 / P12 / Q1 / FY2025} × {Budget, Last year, Previous}: value, comparator, Δ, status, mix deviation, counts + dot; EBITDA vs Previous at W39 / W31 / W35 (ET-22 … ET-26, ET-31) |
| T-N3 (36) | texts: the v5 card faces at Reset and in the saved state (ET-02, ET-22); headers, titles and phrases per item; comparator lines and short Δ suffixes per type; Year offers Budget · Last year and reads LY for Previous (ET-23); EBITDA ⓘ `vs P9 weeks 1–4`, W35 `n/a vs prev. mth` muted (ET-31); FY2025 N/A cards and rated counts 4 / 3 (ET-26); picker fallbacks W43 → P10 → Q4 → FY2026 (ET-28); Online N/A; category (c1–c6): header segment for 1 / 2 / 3 categories and none for all 9 ticked, the N/A faces of EBITDA, OTIF and non-seasonal sell-through, rated 9 (ELEC) / 10 (ELEC + TOYS), GMROI target 2.2 / cover 15.0 / availability 97.0 at ELEC, badge ignores the pick, sub-titles unchanged, How to read names the category |
| T-N4 (16) | bars per type per scope: count 13 / 12 / 8 / 2 and every bar = the item-key value (ET-25) |
| T-N5 | back margin = supplier income (ET-07); NL + BE + Online + Wholesale = All (ET-12); no measure in an error state |
| T-N6 | conceal in place with the three attribute groups (ET-13) |
| T-N7 (5) | ⓘ / Explain stacked block per card under Budget, Last year and Previous: `Actual` + value, then swatch + basis name + target value (+ the Δ line at Budget), in this order and with the specified sizes; Owner tag, no Horizon, Statement, owner note or footer target; FY2025 P10: basis name + muted `–` for the 8 cards without a basis, the target value for the other 4 (ET-30, ET-32); ELEC: the one-line notes of EBITDA, OTIF and sell-through, `–` value and basis, n/a stats (E-101) |
| T-N8 | item lists 95 / 22 / 8 / 2, partial `FY2026-Q4` and `FY2026`, `FY2026-P10` complete, no P11 FY2026 (ET-21) |
| T-N9 (9) | frame parity: in 9 picker states every card face shows the card-layer value and chip (and Δ on hero / medium cards), every ⓘ the value, basis, Δ (EBITDA long form) and status word; the status line and dot tip show `[Window Status Pack]` |
| T-N10 (18) | category scopes: all 10,514 rows of `checks/control_totals_category_eur.csv` through the base layer with the Category slicer on top of the region, plus 5,460 N/A rows (ET-33, ET-34) |
| T-N11 (19) | the spec's answer key `chat-golden.csv` (97 rows) through `[Actual]` / `[Basis]` / `[Last Year]` / `[Previous]` over `param_metric`; spec tolerances (counts exact, ratios 1e-6, EUR 0.0051); expected BLANK = n/a |
| T-N12 (18) | per view (17): header, counts, dot, summary + per card sub-title, value & unit, Δ, status word, basis line (`Card Basis Text`: `n/a` where there is no basis, as the spec's frozen strings), revealed; block 18 = the default-view bars |
| T-N13 (4) | plain `8 Explain` measures vs the spec's ⓘ pop-up strings (3 views × 12 cards), EBITDA Δ checks, panel SVG contains the plain texts |
| T-N14 (12) | hunter's web oracle (12 states): header, counts, dot + per card title, sub-title, value, unit, Δ, status, ⓘ actual / basis label / basis value as displayed / Δ / category note |

## Timings (E-84, N-01)

Method (`tools/run/time.ps1`): one DAX query per visual measure, XMLA ClearCache before **every** query, fresh scratch instance.

**2026-11-16** (3 states: W43 · Budget · All; Q4 · Previous · NL; P10 · Previous · NL · Electronics + Toys; the machine also ran the test
suite and another Desktop, so upper bounds):

| Page | Visual measures | Cold time per query |
|---|---|---|
| Executive | `Header SVG` | 0.59–0.62 s |
| Executive | `Status Line SVG` (slowest on the page) | 0.89–0.93 s |
| Executive | 12 × `Card SVG <KPI>` | 0.56–0.73 s (EBITDA, Sell-through slowest) |
| Executive | all 14, one after another | 9.0–9.2 s serial; Desktop runs them in parallel |
| Explain | `KPI Info SVG` (one per open panel) | 1.00–1.65 s (EBITDA 1.44–1.65 s, Channel mix 1.50–1.58 s) |

Every visual is under the N-01 budget (2 s) cold. The page-level time (parallel visuals) needs a Performance Analyzer run in Desktop (USER).

**2026-10-30 perf pass** (1440 × 810 build; USER targets: every card ≤ 1.0 s, every ⓘ ≤ 3.0 s cold; 3 runs, median):

| Selection | Slowest card (ms), before → after | Slowest ⓘ (ms), before → after | Status line (ms), before → after |
|---|---:|---:|---:|
| Week 43 · Budget · All | 1,316 → 525 | 4,195 → 1,298 | 993 → 695 |
| Month 10 · Last year · All | 1,361 → 541 | 4,346 → 1,364 | 944 → 616 |
| Quarter 4 to date · Previous · Netherlands | 1,319 → 652 | 5,065 → 1,393 | 1,022 → 668 |
| FY2026 to date · Budget · All | 1,351 → 546 | 4,517 → 1,324 | 1,036 → 690 |

What was slow: query-plan size, not scans (19 `[_Item Key]` resolutions per EBITDA card through the card-layer measures, and the
picker and region filters in context). What changed: every SVG measure (`Card SVG`, `Info SVG`, `Status Line SVG`, `Dot SVG`) is built
in **one frame** (`tools/gen/frame.py`) — the slicers are read once, the face is computed inside one `CALCULATE` that clears the picker
tables and passes the region as a `dim_store[scope_code]` filter, every window `CALCULATE` is one VAR, and value / comparator / status /
texts are computed in place with the same DAX as the card-layer measures (kept for the tests; T-N9 proves both agree). A category pick
costs nothing measurable (same instance, pick vs no pick within ±10 %).

## Platform differences and deviations

Platform rows for `docs/design/parity-rules.md` (E-87): solid panels instead of frosted glass; static dot (no pulse ring); FitToPage
instead of the responsive breakpoints; Segoe UI instead of Inter; filters conceal by a faded card face, not CSS. **Web sync deviations
L1–L12** (where this build differs from the spec's 05–07: SVG card faces instead of native visuals, SVG header / status / badge, Explain
panel 475 × 690 as one image, no icon hover colour, two Period item slicers, dropdown and text-box floors, Owner in two rows, TT Chip as
an SVG table, card picker on `dim_kpi[kpi_code]`, no panel shadow, no Validation page): gap doc § 13.1.

| # | v5 / js-exec | Power BI | Why |
|---|---|---|---|
| 1 | Frosted glass pop-ups, menu and drawer (E-59) | Solid white panels with the same 1 px border and 16 px radius; a 22 % ink scrim | No backdrop blur in Power BI (ADR-0012 §2.5, accepted platform difference) |
| 2 | Pulse ring on the overall dot | Static dot, same colour and tooltip | No CSS animation (E-26, accepted) |
| 3 | Responsive breakpoints 1200 / 720 px | FitToPage at 1280 × 720 (1440 × 810 until 2026-11-16) | Accepted (E-61, E-87); canvas per the web spec (ruling 2) |
| 4 | Inter | Segoe UI (inside the SVGs and the native visuals) | Accepted (E-60) |
| 5 | ⓘ and binoculars open a pop-up on click; focus trap, Esc | Click → the hidden Explain page on that card (bookmark + page navigation); × back to Executive; chip and dot stay hover tooltips (TT Chip, TT Dot); no focus trap, no Esc | Per the web spec (ruling 3); one Explain page instead of 24 bookmarked groups |
| 6 | Side bar layers close with Esc; active side-bar button tinted | × and a click on the dark scrim close (`Overlay · none`); no active tint | Bookmarks cannot react to keys; one layer at a time is kept |
| 7 | Filter chips: cobalt-tinted selected chip | Selected tiles written cobalt in the PBIR (2026-11-16); whether Desktop applies it to a picked tile is part of the USER click-test | Selected-state formatting written in PBIR was not applied in the 2026-10 builds |
| 8 | Concealed card: opacity 0.08 + greyscale, `inert`, out of the tab order | Same look inside the card SVG; its hit targets stay clickable and open the Explain page | Visuals cannot be made inert |
| 9 | More KPIs drawer grouped under domain headings | A scrolling table: Domain · KPI · Formula · Owner, catalogue order | Native table; matrix expand states cannot be authored reliably in PBIR |
| 10 | Worked-example and Δ line breaks by browser layout | Static copy wrapped with Segoe UI metrics; worked examples and small-card Δ rows wrapped by character count (52 / 14) | SVG text does not wrap |
| 11 | Pop-up sized to its content | Fixed Explain panel 475 × 690 (SVG drawn 520 × 755 for the tallest card; white space under shorter cards; no scrolling) | One image per state |
| 12 | `dim_date` (ADR-0013 (d)) | Not loaded | No fact joins it; every label comes from dim_week |
| 13 | Picker: switching the type selects the item that holds the last pick (W43 → P10 → Q4 → FY2026), and that chip is shown selected; the FY row is hidden at Year | The cards, header and "Showing" line switch the same way (`[_Item Key]` fallback), but no chip of the new type is highlighted until one is clicked; the FY row stays at Year (it then drives the single Year chip) | A slicer cannot select a value on behalf of another slicer |
| 14 | One item row | Two item rows: a wide Quarter / Year row (so `Q4 · to date` fits) and an 8 × 7 Week / Month grid; the row of the other types stays empty | Button-slicer tiles have one fixed size per visual (L5) |
| 15 | At Year the comparator menu renders two options and a user on Previous snaps to Last year | The Previous row of the comparator slicer is filtered out at Year; a Previous pick made before switching to Year stays selected underneath but reads Last year (header, Δ) | Slicers cannot be re-selected by a measure |
| 16 | Dot tooltip grey state | Same text (`Overall: grey · no rated card.`); not reachable with the shipped data (OTIF and Weeks of cover are always rated) | Same guard as js-exec |
| 17 | Category dropdown reads "All categories" when nothing is picked | Power BI's native dropdown reads "All" | Accepted platform difference (`docs/design/parity-rules.md`, 2026-10-30) |
| 18 | Category list opens inside the Filters layer | The dropdown list opens in Power BI's overlay above the menu and the scrim; close it before a screenshot | Native slicer behaviour |

## Parity notes (for hunter)

- Default open = Reset = `Default view` = Week 43 FY2026 · Budget · All: 7 / 3 / 2, orange dot, card faces as the web (T-N3-01, T-N14).
- Web oracle: `tests/parity/2026-11-16-web-faces-expected.csv` (hunter, 12 states × 135 fields, 1,620 / 1,620, 0 gaps); spec strings in
  `tests/web/`. Earlier cross-flavour faces: `tests/parity/2026-10-30-pbi-faces.csv` (`tools/run/export_faces.py`).
- Category scope in DAX tests: `TREATAS ( { "Electronics", "Toys & leisure" }, dim_category[category_name] )` on top of the region;
  scope `NL#ELEC+TOYS` of the category CSV = `TREATAS ( { "NL" }, param_region[scope_code] )` + those names.
- Picker state is three slicers: `param_granularity[granularity_name]`, `dim_item[fy_label]`, then `dim_item[label]` (Week / Month) or
  `dim_item[label_wide]` (Quarter / Year). In DAX tests set the codes: `TREATAS ( { "Q" }, param_granularity[granularity_code] )`,
  `TREATAS ( { "FY2026" }, dim_item[fy_label] )`, `TREATAS ( { "Q4 · to date" }, dim_item[label_wide] )`; `[_Item Key]` returns the
  item (`FY2026-Q4`).
- Comparator codes stay `BUD` / `LY` / `LW` (`LW` = Previous, label "Previous"); at Year `[_Comparator Code]` returns `LY` for `LW`.
- EBITDA at Week reads month to date (`[EBITDA Flash]`); Previous = the `P-…@k` key; W35 / W9 / W22 / W48 → `n/a vs prev. mth`.
- No basis: the Explain panel prints a muted `–` (web `NO_BASIS_VALUE`); the card basis line (`Card Basis Text <KPI>`) returns `n/a`.
- Copy: `js-exec/lib/engine/copy.ts` exported at build time (snapshot `tools/gen/copy_ts.json`); the view.ts sentences (stats, worked
  examples, How to read, dot tip) are mirrored in the generator (`tools/gen/tokens.py`, `tools/gen/measures_svg.py`).
- Explain panel SVG geometry (drawn 520 wide, baselines, x = 24): `Actual` 87, value 125, swatch y 142.5 (x 24–44) with the basis name
  at x 52 / 148, target 180, Δ 201, rule 222; bars at y 126–186, labels 199; pill 40 px at the bottom, close circle 32 px top right.

## First-open checklist (USER)

1. Refresh (How to open). Executive reads Week 43 · 19–25 Oct 2026 · vs Budget · All regions & formats, 7 / 3 / 2, orange dot, no
   Group / Lever / Owner picks (badge empty).
2. Click the ⓘ on Net sales: the Explain page opens on Net sales — `Actual` €61.4m, `Budget` €62.9m, then the Δ line, bars, stats,
   texts, tags. Click the pill `Drill path · …`: the drill steps; the back pill returns to the explanation; × returns to Executive with
   the selection kept. Repeat with the binoculars on 2-3 cards (Explain opens in the drill state).
3. Filters › Period: Week → Month → Quarter → Year. The header, sub-titles, bars (13 / 12 / 8 / 2) and the "Showing" line follow
   (W43 → Month 10 → Quarter 4 to date → FY2026 to date). Click a Month / Quarter chip: it shows selected (check the cobalt style,
   deviation 7). At Year the comparator row offers Budget · Last year only. Open an ⓘ: the Explain panel shows the same period.
4. Pick FY2025 and Month P10: seven cards show the grey "– N/A" chip with a muted `n/a vs budget`, four are rated (Weeks of cover,
   Availability, Sell-through, OTIF); the dot runs over those four. An ⓘ on a budget card shows `Budget` and a grey `–`.
5. Week 43 + Previous: EBITDA reads `−€0.0m (−0.0%) vs prev. mth`; its ⓘ Δ line reads `… vs P9 weeks 1–4`. Week 35 + Previous:
   EBITDA `n/a vs prev. mth` in grey.
6. Filters › Category: pick Electronics. Header `… · Electronics`; EBITDA flash and Supplier OTIF show `–` with `n/a by category`
   and a grey chip; Sell-through too (Electronics is not seasonal); 9 cards rated. Add Toys & leisure: Sell-through comes back.
7. Hover a chip (TT Chip: the status rule) and the dot (TT Dot). Open and close Filters, How to read and More KPIs (× and scrim).
8. Reset → Week 43 · Budget · All · all categories, overlays closed.
9. Performance Analyzer on Executive and on Explain (page-level time vs N-01).
10. Save once in Desktop so it writes its own serialization; after that, edit surgically.
