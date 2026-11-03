# Mirelo Sales — Power BI draft (PBIP)

> **DRAFT.** Track B of ADR-0011 (Proposed), decision (b). Local PBIP only: nothing is published, no Fabric item exists.
> Built by bip on 2026-10-27. Data, names and numbers are fictional (Mirelo is an invented neobank and microlender).
>
> **Delivery: two flavours** (USER 2026-10-27) — the JS app (Track C, `js-report/` route `/sales`) and this Power BI report. Both
> follow ADR-0011 and ADR-0012 and reconcile to the same control totals.

## What is here

| Path | What |
|---|---|
| `Mirelo Sales.pbip` | Open this in Power BI Desktop |
| `Mirelo Sales.SemanticModel/` | TMDL, Import, 18 Parquet tables + 9 calculated tables + `_measures` (339 measures), 28 relationships, compatibility level 1702 |
| `Mirelo Sales.Report/` | PBIR: page `sales_one_pager` (1440 x 810, five views) + hidden drill-through pages `loan_detail`, `client_detail` + hidden tooltip page `tt_card_info` |
| `tests/control-totals.dax` | DAX query view tests against `data/mirelo_sales_dummy_data/checks/control_totals_eur.csv` |
| `docs/model/mirelo-measure-dictionary.md` (repo) | Every measure: definition, tier, folder, format, DAX |

## How to open

1. Close any other Power BI Desktop window that has this PBIP open.
2. Open `Mirelo Sales.pbip`. The repo holds no data cache, so the tables are empty until you refresh.
3. If the repo is not at `C:\__PBI\PNL`, change the parameter first: Transform data > Manage parameters > **DataFolder** =
   the full path of `data\mirelo_sales_dummy_data\parquet`.
4. Home > Refresh (about 30 s on this machine, 634 k loans, 302 k clients).

## Data source

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

## Model in one paragraph

Star schema, single-direction relationships: every fact joins `dim_month` on `month_key` (no `dim_date` → `dim_month` snowflake);
`fact_loan` and `fact_application` also join `dim_date` (marked date table) by day. The pickers (in the **Filters** panel) are disconnected tables
(`param_anchor_month` = the calendar, `param_comparator`, `param_market`; `param_period` left the model 2026-11-02); window measures
turn the picked months into a `month_index` range from the first to the last pick (no pick = the last closed month), the P&L engine
pattern. Period-end metrics (30+ DPD, MRR, subscribers) use the last month of the window.

## Built vs placeholder

| View | Built | Placeholder / deviation |
|---|---|---|
| Header | Title and brand mark on one centre line, wedge (SVG image), the applied-filters line (e.g. "Q3 2026 - vs Prior year - Romania") + **Filters** button, tabs (6 px top corners); one **How to read** button per view; every button has 6 px corners | No period sentence under the title (USER review 2026-10-27). No funnel icon on the Filters button |
| Filters panel | Bookmark pop-up `grp_filters`, fixed 440 x 514: **Period** = calendar slicer Year > Quarter > Month (closed months only, years collapsed; a year, a quarter or a month in one click, a custom range = first month + Ctrl+click on the last), a one-line hint, Comparison (Budget / Prior year), Region (All markets / PL / RO / PT), **Reset** (Clear all slicers; greyed at the defaults), a divider, the two-line Showing sentence. Choices apply at once; no Done. Closes with **Close** (top right, `filters_close`, the list windows' Close look) or a second click on **Filters** (`hdr_filters_close`, stacked on `hdr_filters`, ink fill and white text while the panel is open, as the JS open state); a view change closes it too | No mode row (Month / Quarter / Year / Custom range) and no year stepper: one hierarchy slicer does all four. Selected tile = Power BI's dark default. Reset is always clickable (only its look follows the defaults). A "Close" button instead of the JS ×; no Escape and no click-outside close (no key action in Power BI; a page-wide mask would block the tabs and How to read, which may stay open beside Filters); the filter line still only opens the panel |
| Overview | 4 hero cards (SVG: title, value, vs Budget / vs Prior year rows with diverging bars, status chip; the former sub-line sits behind the card ⓘ), 2 x 2 why grid, markets table, card / ↗ navigation | No 16 x 16 corner markers on any card and no sparklines in the hero cards (USER review 2026-10-27, design-requirements §1). O6 drawn as columns, not horizontal bars |
| Loans issued | 6 KPI cards, loans by month vs Budget, application funnel on the scale of Started (stacked: ink = reached the next stage, yellow = did not), originations bridge (waterfall), product x market heat matrix, stage cycle time, agent leaderboard (header click sorts every column; Status by rank) | L11 removed (change 14). L8 is columns, the "% of leads / Δ pp vs PY" text is in the tooltip (hand-written data-label details do not render). L2 sub-line shows principal at budget FX (no open applications). L12 has only two steps (only two timestamps) |
| Clients | 6 KPI cards (C5 = Returning-client approval rate), new clients by channel + Budget, new-client funnel, cohort repeat heat matrix (four quarter cohorts x 15-180 d), repeat share by product + average line, Acquisition by channel table with **Show clients ↗** (list window of new clients) | C8 "% of leads" in the tooltip (as L8). C6 Days between loans built (parity MS-03) |
| Portfolio quality | 6 KPI cards, DPD buckets, vintage curves, 30+ DPD heat matrix, 30+ DPD by market, roll rate 30 to 60, segments bubble (one per product, worst yellow, own All / PL / RO / PT pick), Overdue by product table with **Show overdue loans ↗** (list window of loans 30+ DPD) | Bubble labels on all five products (no per-point label choice). Roll rate 60 to 90 dropped (90+ is a 90-179-day stock) |
| Revenue & targets | 6 KPI cards, revenue vs Budget vs PY, revenue by stream, attainment by market, paying subscribers by tier, new vs churned subscribers (churn rate in the ⓘ), channel mix, stream x market table | R3 = Interest + fees vs their shared lending Budget, R4 = Interchange vs the CARD Budget (layout-spec v4 §5, parity MS-04). In the stream x market table interest and fees still show no budget per stream |
| Drill-through | `loan_detail` (from market, product, channel or agent), `client_detail` (from a client id); centred 1120 x 640 window over a 32 % `#404040` mask, Back. The two list windows (C11 clients, P13 overdue loans) are overlays on the report page itself (same window, same mask, report visible under it), **Close**, and **Show client ↗** to the client card. Every list holds all rows and scrolls | Detail pages navigate away (ADR-0011 accepted difference). No pager and no CSV (the note in each window says so). No blur under the mask |

## First-open checklist (USER)

1. Refresh (step 4 above) and check the Overview hero values for Sep 2026 / All: 24.4k loans, €9.6m, 9,796 new clients,
   59.9 % returning, 4.6 % 30+ DPD.
2. Click each tab; the bookmarks are hand-written (display only). If a tab shows the wrong group, select the view and Update its
   bookmark in the Bookmarks pane. L11 is gone from Loans issued.
3. **Filters / calendar** (changes 11, 12, 19): open Filters. The calendar lists 2024, 2025, 2026 collapsed. Click 2025: the line
   reads "Year 2025 - vs Budget - All markets". Expand 2026 > Q3 and click it: "Q3 2026 - …". Click Jun 2025, then Ctrl+click
   Sep 2025: "Jun–Sep 2025 - …" (custom range; the Showing sentence says "Custom range"). The panel never changes size. **Reset**
   is grey at the defaults and dark otherwise; it returns Sep 2026 / Budget / All markets.
4. **Trend clicks** (change 22): click a month on any trend chart: the period and the other visuals stay as they are.
5. **ⓘ hover** (changes 18, 20, 21): every chart and table has its ⓘ before the title; the tooltip shows no Source line. Hover could
   not be automated.
6. **Clients** (changes 15, 16, 25, 26, 28): C5 = Returning-client approval rate 81.4 %, ▲ +0.1pp vs PY; C9 is a heat grid
   Q4 2025 … Q3 2026 x 45 … 180 d; C10 = Repeat share by product with a teal average line. In Acquisition by channel select
   Partner, press **Show clients ↗**: the window title reads "2,846 new clients - Partner - All markets - Sep 2026"; select a
   client, **Show client ↗** opens the card, Back returns; **Close** closes the window. With no row selected the window lists all
   9,796 ("9,796 new clients - All channels - All markets - Sep 2026"). Tip: click the selected row again to clear it.
7. **Portfolio** (changes 17, 29, 32): P9 and L10 / C9 share the grey → yellow → orange → red scale. In P12 pick RO on the card:
   the bubbles move, the page stays on All. **Show overdue loans ↗** lists 4,782 loans 30+ DPD worst first.
8. **Leaderboard** (change 33): click the STATUS header: On target → Close → Behind → n/a, again for the reverse. Partners
   show n/a for Quota, Attainment, VS QUOTA / PY and Status. Select an agent, **Show loans**: the title starts with the agent.
9. **Buttons and corners** (change 13): every button has 6 px corners, the tabs only at the top; the M mark and the title share
   one centre line.
10. Run `tests/control-totals.dax` in DAX query view (one EVALUATE at a time); every `_pass` is TRUE.
11. Save in Desktop. From then on Desktop's serialization is the source.

## USER review 2026-10-27 (applied)

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

## Parity check B vs C (2026-10-27, `docs/ADD/features/parity-check-2026-10-27.md`)

- MS-01: KPI cards whose metric has no Budget compare with Prior year under either header comparator ("vs PY").
- MS-02: hero chip follows the header comparator and falls back to the other row when that one has no value (O3 → ▲ Good).
- MS-03: C6 built. MS-04: R3 Interest + fees, R4 Interchange, both vs Budget. MS-05: C5 compares with the same cohort a year earlier ("vs PY cohort").
- MS-06: chips read glyph + word (▲ Good); a zero Δ reads "◦ 0.0pp". MS-09: hero bars 160 x 6 (4 px per 1 %, 16 px per pp), rows at y 108 / 132.
- MS-08: every How to read opens with the Showing sentence (`How To Read Showing`), then Top band / Grid / Table / Legend; the pop-up now sits above the cards (z order).
- MS-10: a prior-year window that starts before Jan 2024 is n/a. MS-12: titles "New-client approval rate", "Roll rate 30→60". MS-14: ⓘ sub-values follow Track C's value lists.
- ⓘ and How to read copy is read verbatim from Track C `js-report/lib/sales/copy.ts` at build time (`dim_card` what / why / formula / source).
- Card face text comes from one hidden `_Card X Parts` measure per card; the SVGs and the parity tests (T-P) both read it.

## Verification on 2026-10-27

- `powerbi-report-author validate "pbi-report/Mirelo Sales/Mirelo Sales.pbip"`: 0 errors, 0 warnings.
- Tests run over ADOMD against a scratch copy refreshed in Desktop: 6 sets, 2,619 rows, all TRUE (T-M1 requested windows 192,
  T-M2 every closed month 2,112, T-M3 QTD / YTD / R12M 192, T-M4 bridge identity + new-client rule 8, T-M5 card smoke 56,
  T-M6 ADR-0012 info lookup 59).
- Parity check: tests 19 sets / 3,452 rows all TRUE (T-M1 … T-M6 as above + T-P: 13 selections, 833 rows of `js-report/lib/test-utils/parity/parity_selections_mirelo.csv`); validator 0 / 0; Overview, Clients, Revenue, the Clients How to read and the tooltip page render-checked.
- Render-checked in Desktop (scratch copy): all five views and both detail pages; after the ADR-0012 follow-up, the Overview, Loans issued and the tooltip page (pinned to one card in the scratch copy).

## Owner changes 2026-11-01 (applied, `.sync/2026-11-01-mirelo-sales-changes.md`)

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

## Owner changes 2026-11-02, rounds 2-4 (applied, changes 11-33)

| # | Power BI | Accepted difference vs JS (`docs/design/parity-rules.md`) |
|---|---|---|
| 11 | `param_anchor_month` gains year / quarter_label / month_name; slicer `s_range` (hierarchy, multi-select with Ctrl); `_Win Start` = first pick, `_Win End` = last pick; `_Period Kind` / `_Period Label`; filter line and Showing as Track C filterLine / periodLine. `param_period`, `s_period`, `s_month`, the Week tile and Up to are gone | One hierarchy slicer instead of mode row + stepper + tiles. **Returning % and the medians show real values for every range** (loan grain in the model); the JS shows n/a for free ranges |
| 12 | **Reset** (Clear all slicers) with fx text / outline (grey at the defaults), 1 px divider, two-line Showing; Done removed | Reset stays clickable at the defaults |
| 13 | Title on the brand's centre line; `shape` rectangleRoundedByPixel 6 on every button, tabRoundTopCorners 6 on the tabs; slicer tiles 6 px with 4 px gaps | - |
| 14 | L11 visuals deleted; L10 and L12 680 px wide | - |
| 15 | C8 tooltip "x% of leads" (`Funnel New Label`, `Funnel New % of Leads`); no lost series (there was none) | Label text in the tooltip, not under the bar; stage names from `dim_funnel_stage` (Lead, Submitted, Credit approved, Disbursed) |
| 16 | `cl_c10_matrix` deleted; C10 bars = `Repeat Share` per microloan product + constant line `Repeat Share Avg` | - |
| 17 | P12 = one bubble per product (`P12 …` measures read `param_p12_market`, else the page region); `P12 Bubble Fill` yellow on the worst; slicer `s_p12_market` on the card | Labels on all five bubbles; the card pick shows no tile selected while it follows the page |
| 18 | ⓘ at the left of every chart / table title (charts: title text led by a Braille blank + em space, the renderer trims plain spaces) | - |
| 19 | Filters panel 440 x 514, every child fixed | 440 wide (JS 420) |
| 20 | One glass for every pop-up (Filters, How to read, ⓘ, detail pages, list windows): `#F4F3F0` at 90 %, 1 px `#1A1A1A`, radius 12, shadow; masks 32 % `#404040` | **Opacity unchanged at 90 %**: at 85 % the charts under the panel read through its text (render-checked); no blur |
| 21 | `tt_source` and `Card Info Source` deleted; `dim_card` has no source column | - |
| 22 | page `visualInteractions`: 14 trend / curve charts → NoFilter on every other data visual | - |
| 23 | L8 stacked columns `Funnel Reached Next` (ink) + `Funnel Not Reached` (`#FFD54A`), total = stage; `Funnel Label` "52% of leads - +1.1pp vs PY" in the tooltip | Columns, not bars; label in the tooltip |
| 24 / 26 / 32 | L10, C9, P9 matrices with `Heat Fill X` / `Heat Ink X` (field value) over `Heat Level X`; C9 rows `param_cohort_quarter`, columns `param_cohort_day`; L10 cells via `Loans Heat Cell` (0 for an empty shown cell, as Track C) | - |
| 25 | `_Card C5 Parts / Note / SVG` = Returning-client approval rate vs PY (two-line title) | - |
| 27 | R11 = `Subscribers New Trend` (ink) + `Subscribers Churned Trend` (teal), callout kept; churn rate and net adds in the ⓘ (`Card R11 Note`) | - |
| 28 | `cl_c11_channels` table (vs PY only) + list window `grp_list_clients` (`cl_c11_table` moved in, title `Title Clients List`) | Row selection + **Show clients ↗** instead of a row click |
| 29 | `pf_p13_products` table + list window `grp_list_overdue` (`pf_p13_table`: 30+ DPD statuses with a balance) | As 28; the list holds the last close |
| 30 | All lists read `fact_loan` / `dim_client` in full (no sample existed in the model) | - |
| 31 | Note in every list window and on `loan_detail`: "Every row; the table scrolls. Full list with CSV export in the custom JS version." | No pager, no CSV |
| 33 | `Agent Status Rank` (1 / 0 / -1, format `\G\o\o\d;\O\f\f;\W\a\t\c\h`) replaces the text Status column; € / % columns were numeric | Blank status sorts first ascending |

Defaults (main agent, USER may overturn): see the change table above; Week / QTD / YTD left with the period picker; change 5's list
windows for C11 / P13 are overlays on the page (closer to the JS than the drill pages, and "all" works without a selected row).

## Power BI = JS fix-up 2026-11-02 (applied)

Checked against the Track C engine output (js-report/lib/sales, view-model dumped for five selections) and the regenerated
`docs/ADD/features/sales-info-popovers.md`; tests T-M9 (`tests/control-totals.dax`).

| Item | Power BI now | Accepted difference vs JS |
|---|---|---|
| Leaderboard | Status On target / Close / Behind / n/a, rank 3 / 2 / 1 / 0 (`Agent Status Rank`, dynamic format); attainment band on the unrounded ratio; new vs quota / vs PY column (`Agent Δ Cmp %`, loans ÷ reference − 1); Type Agent / Partner; Quota, Attainment, vs n/a for partners; one row per agent (`dim_agent[agent_code]` as a narrow invisible last column: 20 names are used twice); only agents with loans or a quota; drill-through to `loan_detail` by agent code; title without the market | Static header VS QUOTA / PY; Ramp tag in its own column; n/a first ascending |
| Table cells | O9, L13, C11, P13, R13 and the L10 / P9 cells show Track C text (11.7k, €3.3m, €580k, ▲ +1.5%, n/a) through display measures with a dynamic format string (value stays numeric for the header sort); O9 lists the three markets whatever the region pick; P13 the five products (n/a without a book); R13 rows market-major with market codes, Budget n/a for interest and fees; P9 n/a on white | O9 header VS BUDGET / PY; R13 total row Market blank |
| Status chips | O9 and R13 chips carry the glyph of the delta (▲ Good); C11 / P13 already did | - |
| Titles | List windows "2,846 new clients - Partner - All markets - Sep 2026" (All channels / All products without a selected row) and "282 loans 30+ DPD - Step 6 - Romania - Sep 2026"; Stream × market; chart titles as Track C (C7, L9, L10, P8, P9, P11, P12, R9, R10); loan detail title agent first | - |
| ⓘ | Titles as the cards (table titles with window and market), sub-values "Label: value" with Track C labels, C11 / P13 formulas reworded; How to read Filters line in Track C order | Sub-values in one paragraph joined by "; "; Show ↗ wording; no n/a-range sentence |
| Charts | P11 second line 1–29 → 30+ (teal) with legend; P7 legend en dashes; L12 legend SLA | O6 / O7 / P8 legends, R9 bullets, P12 legend (see parity-rules) |
| Heat, C9, period lines | Already matched (levels, RGB interpolation, white text from 0.8, C9 leading columns, filter / Showing lines); now tested cell by cell | - |

Open (data layer, ginee): channel App organic, stream Interest income and the loan status names in the lists come from the
dimensions; display-name columns are needed in Power Query to read App / Interest / 30–59 DPD.

## USER bug fix 2026-11-03 (applied)

| Item | Power BI | Accepted difference vs JS (`docs/design/parity-rules.md`) |
|---|---|---|
| Filters close | Since change 12 (Done removed) the open Filters panel had no close control and the Filters button only opened it. New `filters_close` ("Close", 88 x 28 at (332, 11) in `grp_filters`, copy of the list windows' `lc_close`) and `hdr_filters_close` (copy of `hdr_filters` stacked on it, open-state look), both → `bm_filters_close`. `bm_filters_open` shows both and hides `hdr_filters`; `bm_filters_close` and the five `bm_view_*` do the reverse | "Close" instead of ×; no Escape / click-outside close |

## Embedding (host frame, change 10)

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

## Verification on 2026-11-01

- `powerbi-report-author validate "pbi-report/Mirelo Sales/Mirelo Sales.pbip"`: 0 errors, 0 warnings.
- Tests over ADOMD on a scratch copy (this PBIP + the pack's data cache): 21 blocks, 3,528 rows, all TRUE, incl. the new T-M7a
  (KPI rows and chip fallback, 64 rows) and T-M7b (filter line, How to read period names, hero values, 12 rows); 0 measures in an
  error state.
- Render-checked in Desktop (scratch copy): Overview (header line + Filters, Details, ⓘ top-left, O6, O8 callout), Loans issued with
  the Filters panel and How to read open, both detail pages, the tooltip page. Not automated: clicks (bookmarks, Clear all slicers,
  drill-through) and the ⓘ hover.

## Verification on 2026-11-02 (Power BI = JS fix-up)

- `powerbi-report-author validate`: 0 errors, 0 warnings (source and pack).
- Tests over ADOMD on a fresh scratch copy (this PBIP + the pack's data cache, opened Ready, 458 measures, none in an error state):
  40 blocks, 4,361 rows, all TRUE. New T-M9 (570 rows): the five tables cell by cell, titles, L13 order and filter / Showing lines
  for Sep 2026 All / All PY / RO, Year 2025 and Q1 2024 PL PY (337), list titles (5), ⓘ titles and sub-values (58), heat cells
  (170); T-P back to 833 rows (25 c5 rows re-seeded from the shared parity CSV); T-M8a +3 period rows; T-M8j per agent code.
- Render-checked in Desktop: Overview, Loans issued, Clients, Portfolio quality, Revenue & targets (dynamic-format cells, P11,
  R13 order). Not automated: clicks, header sort, ⓘ hover.

## Verification on 2026-11-02

- `powerbi-report-author validate "pbi-report/Mirelo Sales/Mirelo Sales.pbip"`: 0 errors, 0 warnings (source and pack).
- Tests over ADOMD on a fresh scratch copy (this PBIP + the pack's data cache, opened Ready: 634,365 loans, 390 measures, none in an
  error state): 30 blocks, 3,743 rows, all TRUE. New T-M8a-j (253 rows): calendar filter line / Showing / Reset look, free ranges
  vs direct counts, C5 81.4 % / +0.1pp and 32 direct-sum checks, L8 (61.7k / 10.7k … 24.4k, "52% of leads - +1.1pp vs PY"), C8,
  C11 (3,620 / 2,509 / 2,846 / 821 = 9,796), R11 (Feb 2026 665 vs 754), P13, the three heat grids, list row counts (Partner 2,846;
  30+ DPD at the last close 4,782; Sep 2026 YTD loans 209,898), leaderboard rank, P12. Older blocks migrated from `param_period`
  to the calendar; T-P loses the 25 superseded c5 rows (808 rows).
- Render-checked in Desktop (scratch copy): all five views, the Filters panel (collapsed calendar, Reset grey, two-line Showing),
  both list windows, `loan_detail`, the tooltip page. Not automated: clicks (bookmarks, slicer picks, Show ↗, drill-through,
  header sort) and the ⓘ hover.
