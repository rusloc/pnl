# Nordmark Exec — Power BI flavour (PBIP)

> **DRAFT.** PBI flavour of ADR-0013 (Accepted 2026-10-28). Local PBIP only: nothing is published, no Fabric item exists.
> Built by bip on 2026-10-28 against prototype v5 (`docs/design/executive dashboard (reseller)/prototype.html`), the requirement note
> `docs/Requirements-exec.md` and the dataset contract `data/nordmark_retail_dummy_data/README.md` (its open-point resolutions win).
> All data is generated and fictional (Nordmark Retail is an invented reseller). The JS flavour is `js-exec/`; both reconcile to the
> same control totals and share the copy of `js-exec/lib/engine/copy.ts`.

## What is here

| Path | What |
|---|---|
| `Nordmark Exec.pbip` | Open this in Power BI Desktop |
| `Nordmark Exec.SemanticModel/` | TMDL, Import, 17 Parquet tables + `meta_dataset` (manifest.json) + 8 disconnected picker tables + `_measures` (361 measures), 25 relationships, compatibility level 1702 |
| `Nordmark Exec.Report/` | PBIR: page `exec_landing` (1440 x 810, FitToPage) + hidden tooltip pages `tt_info`, `tt_drill`, `tt_rule`, `tt_dot`; 5 bookmarks; custom theme and 4 SVG resources |
| `tests/control-totals.dax` | DAX tests against `data/nordmark_retail_dummy_data/checks/control_totals_eur.csv` (23 blocks, 13,273 rows) |
| `docs/model/nordmark-measure-dictionary.md` (repo) | Every measure: definition, spec IDs, folder, format, DAX |

## How to open

1. Close any other Power BI Desktop window that has this PBIP open.
2. Open `Nordmark Exec.pbip`. The repo holds no data cache, so the tables are empty until you refresh.
3. **DataFolder.** The parameter holds an absolute path: `C:\__PBI\PNL\data\nordmark_retail_dummy_data\parquet`. If the repo lives elsewhere, change it first:
   Transform data > Manage parameters > **DataFolder** = the full path of `data\nordmark_retail_dummy_data\parquet` (the folder also
   holds `manifest.json`, which the model reads for the as-of week and the refresh stamp). Nothing else is machine-specific (E-80, ET-18).
4. Home > Refresh (about 8 s on this machine, 0.88 M rows).

## Data source

- Every table reads `Parquet.Document(File.Contents(DataFolder & "\<table>.parquet"))` with explicit column types (the Trucks / Mirelo
  pattern). A file source does not fold. Derived on load: `dim_kpi[domain_order]`, `dim_kpi[owner_cadence]` (More KPIs drawer).
- `meta_dataset` = one row from `manifest.json`: `current_week_key` (the as-of week, FY2026-W43), `refreshed` (the header stamp, E-05).
- `dim_date` is not loaded: no fact joins it and every label comes from `dim_week`. The lakehouse switch of ADR-0013 (b) "Later" only
  replaces the partition sources; the Power Query and partitions belong to ginee from here on.

## Model in one paragraph

Star schema, single-direction relationships: every fact joins `dim_week` on `week_key`, site facts join `dim_store`, category facts
`dim_category`, supplier facts `dim_supplier`, OpEx `dim_cost_type`. Base measures evaluate over the `dim_week` rows in context (the
window) and the region in `param_region` (leaf sums filter `dim_store[scope_code]`; All = no filter, so DCs, wholesale and central costs
appear only in All, as the data README says). The card layer turns the period switcher and the as-of week into a `sort_index` range;
LY joins on `ly_week_key`, Last week is the same window as of the week before. Status, counts and the dot are window-context measures
with the thresholds of `param_status_rule`. Details: `docs/model/nordmark-measure-dictionary.md`.

## The page (v5 map)

| Zone | Power BI |
|---|---|
| Side bar 56 px | Static SVG (mark, 4 icons) + transparent buttons: Filters, How to read, More KPIs, Notes (bookmarks `bm_filters`, `bm_how`, `bm_more`, `bm_notes`; one layer at a time, `bm_close` from × and the scrim). Badge = image measure (active attribute picks) |
| Header | One SVG image measure: brand, period · comparator · region line (dates from `dim_week`, YTD from 29 Dec 2025), refresh stamp |
| Status line | SVG: dot (literal v5 rule, static), three count pills, "n of 12 metrics · picks". Hover target on the dot → `tt_dot` |
| Cards | 12 image visuals at the v5 rectangles (3 hero 437 x 236, 3 medium 437 x 176, 6 small 213 x 168, grid bottom 754 px), one `Card SVG <KPI>` measure each: wash (Watch / Off-track gradient), 2 px red border on Off track, title + sub-title (+ prov. from `dim_kpi.is_provisional`), chip (glyph-only on small cards), value, Δ vs the comparator in the status colour, 13 bottom-aligned bars with the dotted target, ⓘ and binoculars |
| Hover targets per card | ⓘ → `tt_info` (value, Δ, labelled bars, 3 stats, What / Why / Formula / Worked example / Status rule / Owner note, tags, footer); binoculars → `tt_drill` (drill page + 4 steps); chip → `tt_rule` |
| Filters menu | Solid panel (glass → solid) with button slicers: Period, Comparator, Region / format (single, force selection), Group, Lever, Horizon, Owner, Statement (multi select). Reset = *Clear all slicers* (the switchers snap back to Week / Budget / All by force selection); filtered-out cards fade in place (opacity 0.08 + greyscale inside the card SVG) |
| How to read · Notes · More KPIs | SVG panels (How to read is a measure: week and comparator name are data); More KPIs = a table of the 20 bench KPIs from `dim_kpi` (domain, KPI, formula, owner · cadence), sorted by catalogue order |

## Tests

`tests/control-totals.dax` holds 23 blocks; run each `// ==== BLOCK` as its own query (one ADOMD batch of all blocks runs out of
memory). Every row returns `_pass`. On 2026-10-28: **13,273 rows, 0 not TRUE** (refreshed scratch copy, ADOMD, 39.9 min serially).

| Block | Checks |
|---|---|
| T-N1 (12) | every row of the control-totals CSV (9,328) through the base layer, per scope x period key; plus N/A rows (absent in the CSV = blank) |
| T-N2 (4) | card layer per scope x {Week, Period to date, Year to date} x {Budget, Last year, Last week}: value, comparator, Δ, status, mix deviation, counts, dot (ET-02, ET-03, ET-09, ET-11) |
| T-N3 | card texts at Week 43 / All / Budget equal the v5 card faces (ET-02); N/A under Online; header period labels |
| T-N4 (4) | the 13 bar values per card per scope = the W-FY2026-31 .. 43 control totals (E-29) |
| T-N5 | back margin = supplier income (ET-07); NL + BE + Online + Wholesale = All (ET-12) |
| T-N6 | conceal in place: B3 shows 4 of 12, counts and dot unchanged; (B1 OR B4) AND Sales shows 3 (ET-13) |

## Timings (E-84)

One DAX query per visual (header, status line, badge, 12 cards), each from a cold cache (XMLA ClearCache before every query), median of 3
runs, on this machine (Desktop 2.157.1354.0 (26.08)), ADOMD client time incl. about 0.1 s overhead per query. Desktop sends the visual queries in
parallel, so a selection change costs about the slowest visual. Hover pop-ups: 0.1 – 0.9 s (ⓘ 0.4 – 0.6 s, overall dot 0.9 s).

| Selection | Slowest visual (ms) | All visuals, one after another (ms) |
|---|---:|---:|
| Week · Budget · All | 700 | 3,700 |
| Period to date · Last year · All | 700 | 4,400 |
| Year to date · Last week · Netherlands | 700 | 4,300 |
| Week · Budget · Online only | 600 | 3,500 |

## Platform differences and deviations

Platform rows for `docs/design/parity-rules.md` (E-87): solid panels instead of frosted glass; static dot (no pulse ring); FitToPage
instead of the responsive breakpoints; Segoe UI instead of Inter; filters conceal by a faded card face, not CSS.

| # | v5 / js-exec | Power BI | Why |
|---|---|---|---|
| 1 | Frosted glass pop-ups, menu and drawer (E-59) | Solid white panels with the same 1 px border and 16 px radius; a 22 % ink scrim | No backdrop blur in Power BI (ADR-0012 §2.5, accepted platform difference) |
| 2 | Pulse ring on the overall dot | Static dot, same colour and tooltip | No CSS animation (E-26, accepted) |
| 3 | Responsive breakpoints 1200 / 720 px | FitToPage at 1440 x 810 | Accepted (E-61, E-87) |
| 4 | Inter | Segoe UI (inside the SVGs and the native visuals) | Accepted (E-60) |
| 5 | ⓘ, binoculars and chip open on click; focus trap, Esc, pills between explanation and drill path | Hover (and keyboard focus) report-page tooltips `tt_info`, `tt_drill`, `tt_rule`; no pills inside the pop-ups | Tooltips are not interactive; click pop-ups per card would need 24 bookmarked groups |
| 6 | Side bar layers close with Esc; active side-bar button tinted | × and a click on the dark scrim close (bookmark `bm_close`); no active tint, the scrim covers the side bar as in v5 | Bookmarks cannot react to keys; one layer at a time is kept |
| 7 | Filter chips: cobalt-tinted selected chip | Native button slicers (pill tiles); the picked chip shows Desktop's default dark style | Selected-state formatting written in PBIR is not applied (also with the P&L's measure-bound form); fix once from a Desktop-saved file |
| 8 | Concealed card: opacity 0.08 + greyscale, `inert`, out of the tab order | Same look inside the card SVG; its hover targets return blank (no tooltip) | Visuals cannot be made inert |
| 9 | More KPIs drawer grouped under domain headings | A scrolling table: Domain · KPI · Formula · Owner, catalogue order | Native table; matrix expand states cannot be authored reliably in PBIR |
| 10 | Worked-example and Δ line breaks by browser layout | Static copy wrapped with Segoe UI metrics; worked examples and small-card Δ rows wrapped by character count (52 / 14) | SVG text does not wrap |
| 11 | ⓘ pop-up sized to its content | Fixed tooltip page 524 x 681 (white space under shorter cards) | Tooltip page size is fixed |
| 12 | Notes › Data contract bullet 3 (js-exec: pre-aggregated cubes) | "This report imports the week-grain tables from Parquet …" | The JS text describes the JS build |
| 13 | `dim_date` (ADR-0013 (d)) | Not loaded | No fact joins it; every label comes from dim_week |

## First-open checklist (USER)

1. Open, set DataFolder if needed, Refresh. The page should read Week 43 · vs Budget · All, 7 / 3 / 2, orange dot.
2. Hover each ⓘ, binoculars and status chip on 2-3 cards: the pop-up must show *that* card (tooltip pages are filtered by the
   hover target's visual filter on `dim_kpi`; hover cannot be automated here).
3. Side bar: Filters → pick Group B3 → 8 cards fade, summary "4 of 12 metrics · B3 stock & supply", badge 1; Reset → all back,
   switchers back to Week / Budget / All. Try Period to date + Last year + Netherlands.
4. How to read, Notes, More KPIs open one at a time; × and the dark area close them.
5. Save once in Desktop so it writes its own serialization (diagram layout, slicer states); after that, edit the PBIP surgically.
