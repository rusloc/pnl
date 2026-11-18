# 03 · Model: tables, relationships, switches

## Design in one paragraph

A small star: three fact tables keyed by week (`Cube`, `Opex`, `Sites`, plus `PO` keyed by week only), dimensions
`Week`, `Site Group`, `Category`. Region is a many-to-many filter through a bridge (`Region` → `Region Group` →
`Site Group`) because "All" is not a partition (it adds wholesale, DCs and central costs). The **period picker is not a
date filter**: it is the disconnected `Period` table; DAX reads the picked item and applies its week range
(`from_ix … to_ix`, or the LY / Previous / month-to-date range) to `Week[week_ix]` explicitly. This mirrors the web
engine (`C:\__VOSK__\src\lib\nordmark\engine\metrics.ts` computes every card from "scope × window × category pick").
Comparator, window role, metric code and card are also disconnected tables read with `SELECTEDVALUE`.

## Tables

| Table | Rows | Kind | Key | Visible to report authors | Purpose |
|---|---:|---|---|:-:|---|
| Cube | 4,599 | fact | (week_ix, group_ix, category_ix) | hide | sales, margin, budget, stock, availability, receipts |
| Opex | 1,029 | fact | (scenario, week_ix, cost_type, group_ix) | hide | OpEx actual and budget (EBITDA) |
| PO | 95 | fact | week_ix | hide | supplier OTIF |
| Sites | 190 | fact | (week_ix, group_ix) | hide | trading and LFL store counts |
| Week | 104 | dimension | week_ix | yes | 4-5-4 calendar, LY / LW keys, month / quarter / FY starts, season |
| Site Group | 6 | dimension | group_ix (also group_code unique) | hide | channel, is_store, is_selling |
| Category | 9 | dimension | category_ix (also category_code unique) | yes | Category slicer, category targets |
| Region | 4 | switch | region_code | yes | Region slicer |
| Region Group | 9 | bridge | (region_code, group_code) | hide | which site groups a region holds |
| Period | 127 | switch (disconnected) | item_id (item_key unique) | yes | period picker: granularity → FY → item |
| Bar Item | 127 | axis (disconnected) | item_id | hide (axis only) | x-axis of the card bars |
| Comparator | 3 | switch (disconnected) | comparator_code | yes | Budget · Last year · Previous |
| Window | 5 | internal (disconnected) | window_code | hide | CUR · LY · PREV · ITEM · BAR, set only inside measures |
| Metric | 82 | internal (disconnected) | metric_code | hide | code → measure dispatcher, unit, basis, flash flag |
| Card | 12 | switch (disconnected) | kpi_code | yes (attribute slicers, Explain card picker) | card copy and behaviour, attribute picks |
| KPI Drill Step | 48 | lookup | (kpi_code, step_no) | yes | drill path list |
| KPI | 32 | lookup (disconnected) | kpi_code | yes | bench drawer ("More KPIs") |
| Status Rule | 15 | parameter | rule_code | hide | thresholds and dot constants |
| Target | 27 | parameter | (kpi_code, category_code) | hide | ALL targets |
| Report Info | 1 | parameter | – | hide | as-of, refresh stamp, current FY |
| Golden | 97 | validation | golden_id | validation page only | answer key |
| Golden Category | ~25 | validation bridge | – | hide | categories of a golden row |
| Control (optional) | ~36.6k | validation | control_id | validation page only | control totals |
| Control Scope Category (optional) | ~30 | validation bridge | – | hide | categories of a control scope |
| Measures | 0 | measure home | – | yes | every measure (an empty table: Enter data with one column, then hide the column) |

## Relationships

| From (many) | To (one) | Cardinality | Cross-filter | Active | Note |
|---|---|---|---|:-:|---|
| Cube[week_ix] | Week[week_ix] | *:1 | single | yes | |
| Opex[week_ix] | Week[week_ix] | *:1 | single | yes | |
| PO[week_ix] | Week[week_ix] | *:1 | single | yes | |
| Sites[week_ix] | Week[week_ix] | *:1 | single | yes | |
| Cube[group_ix] | Site Group[group_ix] | *:1 | single | yes | |
| Opex[group_ix] | Site Group[group_ix] | *:1 | single | yes | CENTRAL = group 5 |
| Sites[group_ix] | Site Group[group_ix] | *:1 | single | yes | |
| Cube[category_ix] | Category[category_ix] | *:1 | single | yes | Opex, PO and Sites have no category: by design |
| Region Group[region_code] | Region[region_code] | *:1 | single | yes | |
| Region Group[group_code] | Site Group[group_code] | *:1 | **both** | yes | lets `Region` filter `Site Group` (bridge pattern) |
| KPI Drill Step[kpi_code] | Card[kpi_code] | *:1 | single | yes | the Explain page's card picker filters the steps |

Everything else is disconnected on purpose. Do **not** relate `Period`, `Bar Item`, `Comparator`, `Window`, `Metric`,
`Golden*`, `Control*` or `KPI` to anything.

Check after building: with no slicer, `COUNTROWS ( 'Site Group' )` = 6; with Region = Netherlands, 1 (NL); with Region
= All, 6. Opex CENTRAL rows appear only under All.

## Hierarchies and sort orders

| Table | Column | Sort by | Hierarchy |
|---|---|---|---|
| Week | week_key, week_label | week_ix | Calendar: fy_label → quarter_key → period_key → week_key |
| Period | gran_label | gran_sort | Period picker (not a hierarchy, three slicers): gran_label → fy_label → chip_label |
| Period | chip_label | chip_sort | (labels repeat across FYs on purpose: "W43" of FY2025 and FY2026 share one slicer value, so switching the FY keeps the week number) |
| Bar Item | bar_label_u | item_id | |
| Category | category_name | sort_order | |
| Region | region_label | region_sort | |
| Comparator | comparator_label | comparator_sort | |
| Card | kpi_name | card_order | |
| Card | group_label / lever_label / owner_label | (sort columns: add `group_sort`, `lever_sort`, `owner_sort` as calculated columns, below) | |
| KPI | domain | domain_sort | Bench: domain → kpi_name (sort kpi_name by catalogue_no) |
| KPI Drill Step | step_title | step_no | |

Calculated columns on `Card` for the attribute chip order (menu order of `copy.ts › ATTRIBUTES`):

```dax
group_sort =
SWITCH ( 'Card'[group_code], "B1", 1, "B2", 2, "B3", 3, "B4", 4 )
```

```dax
lever_sort =
SWITCH ( 'Card'[lever_code], "sales", 1, "margin", 2, "stock", 3, "supply", 4, "cash", 5 )
```

```dax
owner_sort =
SWITCH ( 'Card'[owner_code], "commercial", 1, "supply", 2, "finance", 3, "digital", 4 )
```

Sort `group_label` by `group_sort`, `lever_label` by `lever_sort`, `owner_label` by `owner_sort`.

## Scenarios, versions, windows

- **Scenarios**: ACT and BUD only, both in `Opex[scenario]`; budget sales live in the `*_bud` columns of `Cube`.
  **Budget exists for FY2026 only** (`current_fy`): every budget figure, and every status that reads one, is N/A
  (BLANK) in FY2025. Targets (cover, availability, sell-through, GMROI, OTIF) exist in both years.
- **Windows** (the window a figure reads), resolved per measure from the picked `Period` row:

| Window code | Range on `Week[week_ix]` | Used by |
|---|---|---|
| CUR | `from_ix … to_ix`; for `Metric[flash] = TRUE` at Week: `ptd_from_ix … ptd_to_ix` | card values, bases, status |
| LY | `ly_from_ix … ly_to_ix`; flash at Week: `ptd_ly_*` | Δ vs Last year, "vs LY …" stats |
| PREV | `prev_from_ix … prev_to_ix`; flash at Week: `ptd_prev_*` | Δ vs Previous, "vs last week" stats |
| ITEM | `from_ix … to_ix` (never month to date) | the bar target line (EBITDA at Week: the week's own budget) |
| BAR | the `Bar Item` row's `from_ix … to_ix` | bar heights |

- **Flows** sum the window; **point-in-time** figures (stock, cover, availability, sell-through, GMROI, store counts,
  suppliers below 85 %) read the window's **last week** `L = MAX ( Week[week_ix] )`; GMROI reads the 52 weeks ending at
  `L` (N/A when `L < 51`); sell-through reads the season to date ending at `L` (N/A outside a season).
- **Category pick**: "no category ticked" and "all 9 ticked" both mean **All**. Under a real pick: EBITDA and its
  parts, OpEx and Supplier OTIF are N/A ("n/a by category"); Sell-through runs on the seasonal part of the pick (N/A
  without one); GMROI and sell-through targets become weighted category targets; the weeks-of-cover target is always
  forecast-weighted.

## Why no calculation group

The window switch looks like a calculation-group job, but calculation items re-apply to every nested measure
reference. The engine's point-in-time measures set their own `Week` filter (the last week, the 52-week window, the
season), and a re-applied window item would overwrite it. The `Window` table read with `SELECTEDVALUE` inside one
dispatcher measure (`[Metric In Window]`) gives the same single-definition benefit without the recursion. Field
parameters are not needed: no visual switches its measure; every switch is a filter.

## Model settings

- Culture: **en-US** (number formats in text measures).
- Turn off Auto date/time (no date hierarchy is used).
- Discourage implicit measures: on.
- Data reduction: none needed (≈ 0.5 MB).
- Mark no date table (Week is not a daily calendar; no time-intelligence functions are used).
