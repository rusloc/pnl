from rusloc/pnl (ginee, bip) · to vosk.dev repo agent · 2026-10-30 · status: ready

**Generate the data, then refresh (USER 2026-10-30).** The pack ships no data and no model cache: the Parquet files and `.pbi/cache.abf` are not in git. Generate the 18 Parquet files + `manifest.json` with `../../data-gen/` (`mirelo-sales\generator\generate.py`, output `data-gen\mirelo-sales\parquet`), set `DataFolder` to that folder, refresh in Power BI Desktop, check, then publish (see How to open). The generated files are byte-identical to the `../data/parquet/` files this pack used until 2026-10-30 (checked 2026-10-30 by ginee), so the earlier verification still holds: on 2026-10-30 bip opened the loaded pack (28 tables, 1,030,587 rows), the Overview rendered with the expected hero values, and three test blocks passed (T-M1 192 rows, T-M4 8 rows, T-P Sep 2026 / All 133 rows, all TRUE). `powerbi-report-author validate`: 0 errors, 0 warnings. Content ships as is (USER 2026-10-30); the caveats below still apply.

**Publish after the Desktop refresh; no refresh in the service.** Do not schedule a refresh: the source is local Parquet, which the service could only read through an on-premises gateway. The published report is a snapshot of the generated data. `DataFolder` ships as a placeholder. No workspace, dataset, tenant or capacity IDs belong in `.sync/`.

Earlier check, 2026-10-28, by bip: opened in Power BI Desktop with `DataFolder` = `mirelo-sales\data\parquet`; full refresh 15 s, all 18 tables match the row counts in `manifest.json`. `tests/control-totals.dax`: 19 of 19 blocks, 3,452 rows `_pass` TRUE (T-M1 … T-M6 2,619, T-P 833), 43 s in total. `powerbi-report-author validate`: 0 errors, 0 warnings.

# Mirelo Sales — Power BI pack (PBIP + local Parquet)

A clean copy of the repo's draft report `pbi-report/Mirelo Sales/` (ADR-0011 (b), built by bip on 2026-10-27). It already read local
Parquet files through a `DataFolder` parameter. This copy only changes that parameter's value from a repo path to a placeholder.
The generator that builds its data is in `../../data-gen/mirelo-sales/` (generator, checks, data README; the data itself is not in git). The pack was copied from
the repo state of commit `fcfa19c`, and `pbi-report/` had no uncommitted changes at copy time.

Data, names and numbers are fictional: Mirelo is an invented neobank and microlender.

## What is here

| Path | What |
|---|---|
| `Mirelo Sales.pbip` | Open this in Power BI Desktop |
| `Mirelo Sales.SemanticModel/` | TMDL, Import, 18 Parquet tables + 9 calculated tables + `_measures` (339 measures), 28 relationships, compatibility level 1702 |
| `Mirelo Sales.Report/` | PBIR: page `sales_one_pager` (1440 × 810, five views) + hidden drill-through pages `loan_detail`, `client_detail` + hidden tooltip page `tt_card_info` |
| `tests/control-totals.dax` | DAX query view tests (T-M1 … T-M7 + T-P parity). Expected values are embedded, generated from `../../data-gen/mirelo-sales/checks/control_totals_eur.csv` |
| `../../data-gen/mirelo-sales/` | Not in this folder: `generator/`, `checks/` (committed) and the data README; a generate run writes `parquet/` (the 18 tables + `manifest.json`, not in git) and the CSVs |

## How to open

1. Use a current Power BI Desktop that opens Power BI Projects (`.pbip`) with a TMDL model and a PBIR report.
2. Generate the data: in `.sync\data-gen`, `.venv\Scripts\python.exe mirelo-sales\generator\generate.py` (setup and requirements
   in `../../data-gen/README.md`; about 20 s). It writes `data-gen\mirelo-sales\parquet\` (18 files + `manifest.json`).
3. Open `Mirelo Sales.pbip`. There is no data cache, so the tables are empty; if Desktop offers to refresh, cancel. Set the
   parameter first: Transform data > Manage parameters > **DataFolder** = the full local path of `data-gen\mirelo-sales\parquet`,
   without a trailing backslash. The shipped value is the placeholder `<folder holding the Parquet files>`, so a refresh fails until
   you change it. Close & Apply, then Home > Refresh (15–30 s on the source machine: 634 k loans, 302 k clients).
4. Check (How to verify), then publish from Desktop (Home > Publish).
5. Desktop writes its own `.pbi/localSettings.json` and `.pbi/cache.abf` (both ignored by git), and a save writes your machine path
   into `definition/expressions.tmdl`: put the placeholder back there before committing anything in `.sync/`.

## How to verify

1. Overview hero values for Sep 2026 / Month / All: 24.4k loans, €9.6m, 9,796 new clients, 59.9 % returning, 4.6 % 30+ DPD.
2. Run `tests/control-totals.dax` in DAX query view, one `EVALUATE` at a time (21 blocks). Every row's `_pass` must be TRUE.
   Tolerances: EUR 0.011, ratios 0.000001, counts exact.
3. The data itself: `mirelo-sales\checks\verify.py` in `../../data-gen/` (47 checks) after the generate run. See `../../data-gen/mirelo-sales/README.md`.
4. Optional: `powerbi-report-author validate "Mirelo Sales.pbip"` (0 errors and 0 warnings in the repo on 2026-10-27).

## What changed vs the repo copy

| Where | Repo (`pbi-report/Mirelo Sales/`) | This pack |
|---|---|---|
| `definition/expressions.tmdl`, `DataFolder` | Absolute repo path of `data/mirelo_sales_dummy_data/parquet`; comment says so | Placeholder `<folder holding the Parquet files>`; comment points to `data-gen/mirelo-sales/parquet` |
| `README.md` | Repo README | This file: pack sections first, then the repo README's report notes below. Only "What is here" and "How to open" were rewritten, because they named repo paths |
| Excluded | `__backup__/`, `.pbi/localSettings.json` | — |
| Added | — | — (the data is generated by `../../data-gen/mirelo-sales/`, not in git) |
| 2026-11-01 owner changes (`../../2026-11-01-mirelo-sales-changes.md`, changes 1-10) | Built in the repo report by bip | Mirrored from the repo: the changed and new `Mirelo Sales.Report/definition` files (header, Filters panel `grp_filters` + 2 bookmarks, Details buttons, ⓘ positions, callouts, O6, pop-up look, detail windows, tooltip page), `_measures.tmdl` (two-row KPI cards, `Header Filter Line`, How to read period names), `param_period` / `param_comparator` / `param_market.tmdl` (labels), `tests/control-totals.dax` (+ T-M7), and the report notes below. `expressions.tmdl` keeps the placeholder |

Everything else, including the partitions, helper queries, measures, report and tests, is byte-identical to the repo copy.

## Known caveats

- **Desktop visual check pending.** bip refreshed this pack from the same Parquet and ran every DAX test on 2026-10-28 (all green, see Verified). ADR-0011 is Accepted (2026-10-27); some report content is still draft (see the JS pack README). The first-open checklist below is still the USER's open item.
- **Publishing.** In the Power BI service, a model that reads local files needs an on-premises data gateway to refresh. Publish after the
  Desktop refresh and do not schedule a refresh. The data is static.
- **Repo drift.** If the repo report changes after the 2026-11-01 mirror, this pack has to be re-copied, with the `DataFolder` value reset to the
  placeholder (see How to open).
- `.platform` files keep the repo's `logicalId` values. They only matter if a workspace is connected to Git.
- The generated data files are byte-identical to the repo's `data/mirelo_sales_dummy_data/parquet/`. A regeneration on 2026-10-30
  from `../../data-gen/mirelo-sales/generator/` (seed 20261026) reproduced them exactly.

---

## Report notes (from the repo README of 2026-11-01)

### Data source

- Every table reads `Parquet.Document(File.Contents(DataFolder & "\<table>.parquet"))` with explicit column types (the ACME Trucks
  pattern). A file source does not fold.
- Columns derived in Power Query (ADR-0008 analogue: translate at month x currency on load, sum later):
  - `fact_loan`: `month_key`, `principal_eur_bud` (local / BUDGET rate). `application_id` and `submitted_ts` are not loaded (unused).
  - `fact_loan_month`: every balance and flow as `*_eur` at the ACTUAL_AVG rate of its month x currency; `vintage_index`,
    `months_on_book`, `vintage_quarter_index`.
  - `fact_target`: `target_eur` for amount metrics (local / BUDGET rate).
  - `fact_application`: `month_key`. `dim_month`: `month_label` (Sep 2026), `month_short` (Sep 26).
  - `dim_client`: `second_loan_date` and `days_to_second_loan` (first repeat loan, read from `fact_loan.parquet` a second time),
    cohort month / quarter indexes and `cohort_quarter`.
- Helper queries `fx_actual` / `fx_budget` (not loaded) feed the merges. The lakehouse switch of ADR-0011 (a) later replaces the
  partition sources; the Power Query and partitions belong to ginee from here on.

### Model in one paragraph

Star schema, single-direction relationships: every fact joins `dim_month` on `month_key` (no `dim_date` → `dim_month` snowflake);
`fact_loan` and `fact_application` also join `dim_date` (marked date table) by day. The four pickers (in the **Filters** panel since 2026-11-01) are disconnected tables
(`param_anchor_month`, `param_period`, `param_comparator`, `param_market`); window measures turn them into a `month_index` range,
the P&L engine pattern. Period-end metrics (30+ DPD, MRR, subscribers) use the anchor month, the last closed month of every window.

### Built vs placeholder

| View | Built | Placeholder / deviation |
|---|---|---|
| Header | Title, brand mark, wedge (SVG image), the applied-filters line + **Filters** button (top right; the pickers moved into the Filters panel 2026-11-01), tabs; one **How to read** button per view (top right of the tab row, bookmark pop-up per view) | No period sentence under the title (USER review 2026-10-27). No funnel icon on the Filters button. The month dropdown is 48 px tall (validator floor) |
| Filters panel | Bookmark pop-up `grp_filters` (440 x 378 under the button): Period (Week disabled + Month / Quarter to date / Year to date tiles), Up to (closed month), Comparison (Budget / Prior year), Region (All markets / PL / RO / PT), the Showing sentence, **Back to default** (Clear all slicers) and **Done**. Choices apply at once | Week is a disabled button (monthly data); R12M is not offered (visual filter on the period slicer). Selected tile = Power BI's dark default |
| Overview | 4 hero cards (SVG: title, value, vs Budget / vs Prior year rows with diverging bars, status chip; the former sub-line sits behind the card ⓘ), 2 x 2 why grid, markets table, card / ↗ navigation | No 16 x 16 corner markers on any card and no sparklines in the hero cards (USER review 2026-10-27, design-requirements §1). O6 drawn as columns, not horizontal bars |
| Loans issued | 6 KPI cards, loans by month vs Budget, application funnel, originations bridge (waterfall), product x market, stage cycle time, agent leaderboard | **L11 Attainment by channel: placeholder** (no channel targets). L2 sub-line shows principal at budget FX instead of pipeline coverage (no open applications in the data). L12 has only two steps (only two timestamps). Bars drawn as columns |
| Clients | 6 KPI cards, new clients by channel + Budget, new-client funnel, cohort repeat curves, returning % heat matrix + by product, new clients table | C6 Days between loans is built (parity MS-03): median days from each repeat loan to the client's previous loan (`prior_loans` - 1), from `fact_loan` |
| Portfolio quality | 6 KPI cards, DPD buckets, vintage curves, 30+ DPD heat matrix, 30+ DPD by market, roll rate 30 to 60, segments bubble, overdue loans table | Roll rate 60 to 90 dropped: the 90+ bucket is a 90-179-day stock, so the ratio runs above 200 % |
| Revenue & targets | 6 KPI cards, revenue vs Budget vs PY, revenue by stream, attainment by market, paying subscribers by tier, churn, channel mix, stream x market table | R3 = Interest + fees vs their shared lending Budget, R4 = Interchange vs the CARD Budget (layout-spec v4 §5, parity MS-04). In the stream x market table interest and fees still show no budget per stream |
| Drill-through | `loan_detail` (from market, product, channel or agent), `client_detail` (from a client id); centred 1120 x 640 window over a 20 % `#404040` mask (2026-11-01), Back | Navigates to a page instead of an overlay (ADR-0011 accepted difference); the report is not visible under the mask |

### First-open checklist (USER)

1. Generate the data, set `DataFolder`, refresh (How to open), then check the Overview hero values for Sep 2026 / Month / All: 24.4k loans, €9.6m, 9,796 new clients,
   59.9 % returning, 4.6 % 30+ DPD.
2. Click each tab; the bookmarks are hand-written (display only, data unchanged). If a tab shows the wrong group, select the view and
   Update its bookmark in the Bookmarks pane.
3. **Filters** (top right, changes 3 + 4): the header shows only the line "Sep 2026 - Month - vs Budget - All markets" and the
   Filters button. Click Filters: the panel opens under it. Hover **Week**: it is greyed and says "The data set is monthly: weekly
   figures are not in the data." Pick Quarter to date + Prior year + RO: the line reads "Jul–Sep 2026 - Quarter to date - vs Prior
   year - Romania" and the cards change at once. **Back to default** returns Month / Sep 2026 / Budget / All markets; **Done** closes
   the panel; a tab click closes it too.
4. **Hero cards** (changes 2 + 8): each has a **Details →** button bottom-right (hover inverts it) that opens the metric's view; a
   click elsewhere on the card still does. The ⓘ sits top-left beside the title.
5. **KPI cards** (changes 8 + 9): on Loans issued, L1 Loans / L2 Principal / L3 Avg ticket show two rows, vs Budget then vs PY;
   Approval rate shows vs PY alone. Switch Comparison to Prior year: the chip of Principal turns from ▼ Watch to ▲ Good (it
   follows the comparator); the rows stay.
6. **ⓘ hover** (changes 6 + 8): hover the ⓘ of any card: the tooltip page shows a warm-grey panel with rounded corners, a 1 px dark
   border and a soft shadow. Check that the area around the panel is transparent (the tooltip page background is 100 %
   transparent); if Power BI draws a light frame around it instead, tell bip. This hover could not be automated.
7. **How to read** (change 6): same glass look; the Overview text names Details and Show loans and every view has a Filters line.
8. **Story callouts** (change 1): the event labels on O8 (Overview), P10 and R11 are plain text, no yellow box.
9. **O6** (change 7): the prior-year columns are filled yellow `#FFD54A`.
10. **Show loans** (change 5): select a row in the markets table and press Show loans: the loan list opens as a centred window on a
    grey ground; **Back** returns. Same for the agent leaderboard and Show client in the clients table.
11. Run `tests/control-totals.dax` in DAX query view (paste one EVALUATE at a time); every `_pass` is TRUE.
12. Save in Desktop. From then on Desktop's serialization is the source; the generator (session scratchpad, not in the repo) is not re-run.

### USER review 2026-10-27 (applied)

- Removed the period / market / comparator sentence under the title (pickers stay) and its measure `Header Period Line`.
- Removed the 16 x 16 dark corner marker from every card and from the How to read panel; titles already sit at the 16 px padding edge.
- "Visual first, minimum text" (`docs/design/design-requirements.md` §1): explanatory chart titles shortened to names, placeholder
  prose cut to "Placeholder - see How to read"; the explanations moved into the How to read pop-up. Hero sparklines removed from the
  SVG measures.
- ADR-0012 follow-up (applied the same day): card face = title · value · Δ rows · status chip. Each sub-line became a measure
  `Card <code> Note` behind the card's **ⓘ** (plain upright "i" in a 16 px circle, bottom-left of each card; top-right of chart and
  table panels, which replaces any table footnote). Mechanism: a **report-page tooltip** — every ⓘ is a tiny card visual filtered
  to its row of the disconnected table `dim_card` (59 rows: code, title, definition) and points to the hidden tooltip page
  `tt_card_info` (title, definition, note; solid white panel with a 1 px border = Track B form of the ADR-0012 glass). Chosen over
  bookmark pop-ups: one constant query per ⓘ and nothing until hover, against ~120 bookmarks and ~200 extra visuals.
  Limitation: hover / focus, not click.
- One **How to read** per view (five bookmark pop-ups `grp_info_<view>`, opened from the view's own button; switching views closes them).

### Parity check B vs C (2026-10-27, `docs/ADD/features/parity-check-2026-10-27.md`)

- MS-01: KPI cards whose metric has no Budget compare with Prior year under either header comparator ("vs PY").
- MS-02: hero chip follows the header comparator and falls back to the other row when that one has no value (O3 → ▲ Good).
- MS-03: C6 built. MS-04: R3 Interest + fees, R4 Interchange, both vs Budget. MS-05: C5 compares with the same cohort a year earlier ("vs PY cohort").
- MS-06: chips read glyph + word (▲ Good); a zero Δ reads "◦ 0.0pp". MS-09: hero bars 160 x 6 (4 px per 1 %, 16 px per pp), rows at y 108 / 132.
- MS-08: every How to read opens with the Showing sentence (`How To Read Showing`), then Top band / Grid / Table / Legend; the pop-up now sits above the cards (z order).
- MS-10: a prior-year window that starts before Jan 2024 is n/a. MS-12: titles "New-client approval rate", "Roll rate 30→60". MS-14: ⓘ sub-values follow Track C's value lists.
- ⓘ and How to read copy is read verbatim from Track C `js-report/lib/sales/copy.ts` at build time (`dim_card` what / why / formula / source).
- Card face text comes from one hidden `_Card X Parts` measure per card; the SVGs and the parity tests (T-P) both read it.

### Verification on 2026-10-27

- `powerbi-report-author validate "pbi-report/Mirelo Sales/Mirelo Sales.pbip"`: 0 errors, 0 warnings.
- Tests run over ADOMD against a scratch copy refreshed in Desktop: 6 sets, 2,619 rows, all TRUE (T-M1 requested windows 192,
  T-M2 every closed month 2,112, T-M3 QTD / YTD / R12M 192, T-M4 bridge identity + new-client rule 8, T-M5 card smoke 56,
  T-M6 ADR-0012 info lookup 59).
- Parity check: tests 19 sets / 3,452 rows all TRUE (T-M1 … T-M6 as above + T-P: 13 selections, 833 rows of `js-report/lib/test-utils/parity/parity_selections_mirelo.csv`); validator 0 / 0; Overview, Clients, Revenue, the Clients How to read and the tooltip page render-checked.
- Render-checked in Desktop (scratch copy): all five views and both detail pages; after the ADR-0012 follow-up, the Overview, Loans issued and the tooltip page (pinned to one card in the scratch copy).

### Owner changes 2026-11-01 (applied, `.sync/2026-11-01-mirelo-sales-changes.md`)

| # | Power BI | Accepted difference vs JS (`docs/design/parity-rules.md`) |
|---|---|---|
| 1 | Story callouts O8 / P10 / R11: no fill, no border, 8 pt semibold ink; the chart alt text ends with the event | No dashed event marker (categorical month axis on O8); the text keeps its place |
| 2 | `ov_o1..4_details` "Details →" (80 x 24, bottom-right, ink border, white; ink on hover) with the card's own bookmark; the whole-card button stays | Hover inverts the button, not the card |
| 3 | Market / period / month / comparator tiles gone from the header | - |
| 4 | `hdr_filter_line` (measure `Header Filter Line`) + `hdr_filters` open `grp_filters` (bookmarks `bm_filters_open` / `bm_filters_close`); the four slicers moved into it; labels from the param tables (Quarter to date, Year to date, Prior year, All markets) | Week = disabled button; no funnel icon; Back to default always enabled |
| 5 | Drill-through pages kept, restyled: mask `#404040` at 80 % transparency over the whole page, window 1120 x 640 at (160, 85), tables widened to 1072 px | The report is not visible under the mask |
| 6 | Glass on the 5 How to read panels, the Filters panel, `tt_card_info` and both detail windows: visual container background `#F4F3F0` at 10 % transparency, 1 px `#1A1A1A` border, radius 12, drop shadow 25 % black, 0 / 12 px, blur 30. The tooltip page is 388 x 382 with a transparent background, so the shadow has room | No backdrop blur; 90 % opacity, not 85 % (without blur, card numbers read through) |
| 7 | O6 prior-year series `#FFD54A` (columns, no outline) | O6 stays columns |
| 8 | ⓘ at card (8, 16) on hero cards and (8, 24) on KPI cards; SVG titles at x 30 (C4's 24-character title at 10 px so it clears the chip) | Title shift 14 px, not 26: the Power BI ⓘ is 16 px and the old title started at 16 |
| 9 | `_Card X Parts` of L1, L2, L3, C1, P1, R1, R3, R4 carry both rows (items 6-12); their SVGs draw vs Budget (y 92) and vs PY (y 110); chip = comparator row, else the other row. The 16 other KPI cards: one row, now at y 92 | - |
| 10 | Canvas unchanged: 1440 x 810, Fit to page, wallpaper `#F3F2EF` (the ground) | See "Embedding" below |

Defaults (main agent, USER may overturn): Week shown disabled (no weekly grain in data-gen or the model); R12M left the options
(the `param_period` row and every R12M measure stay; no measure became unused); change 5 = option (b), the drill-through pages
restyled (option (a), a bookmark overlay, cannot carry the clicked row reliably and loses the native Back), so ADR-0011's accepted
difference stands as it is.

### Embedding (host frame, change 10)

- The page is a fixed 1440 x 810 canvas (16:9) shown with **Fit to page**: Power BI scales it uniformly and fills any spare room in
  the wallpaper colour `#F3F2EF`, the same as the page ground, so a mismatched frame shows a ground-coloured margin, never a white band.
- For no margin at all, the host sizes the iframe to 16:9 of its own width plus Power BI's bottom bar when it is shown
  (Publish to web / "Website or portal" embeds draw a status bar of about 36 px under the page; measure it in the host; the
  JavaScript embed with `navContentPaneEnabled: false` and `filterPaneEnabled: false` draws none):
  `width = min(popup width, (popup height - bar) x 16 / 9)`, `height = width x 9 / 16 + bar`, centred in a popup whose background is
  `#F3F2EF`. At vosk.dev's popup (up to 1600 px wide, ~90 % of the screen height): on a 1920 x 1080 screen 1600 x 936 (with the bar),
  on 1366 x 768 about 1164 x 691 (height-bound).
- No taller page: Power BI cannot spread extra height over the rows the way the JS board does; a taller canvas would fit one frame
  shape and leave a band at every other.

### Verification on 2026-11-01

- `powerbi-report-author validate "pbi-report/Mirelo Sales/Mirelo Sales.pbip"`: 0 errors, 0 warnings.
- Tests over ADOMD on a scratch copy (this PBIP + the pack's data cache): 21 blocks, 3,528 rows, all TRUE, incl. the new T-M7a
  (KPI rows and chip fallback, 64 rows) and T-M7b (filter line, How to read period names, hero values, 12 rows); 0 measures in an
  error state.
- Render-checked in Desktop (scratch copy): Overview (header line + Filters, Details, ⓘ top-left, O6, O8 callout), Loans issued with
  the Filters panel and How to read open, both detail pages, the tooltip page. Not automated: clicks (bookmarks, Clear all slicers,
  drill-through) and the ⓘ hover.
