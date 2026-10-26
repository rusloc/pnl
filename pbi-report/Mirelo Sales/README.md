# Mirelo Sales — Power BI draft (PBIP)

> **DRAFT.** Track B of ADR-0011 (Proposed), decision (b). Local PBIP only: nothing is published, no Fabric item exists.
> Built by bip on 2026-10-27. Data, names and numbers are fictional (Mirelo is an invented neobank and microlender).

## What is here

| Path | What |
|---|---|
| `Mirelo Sales.pbip` | Open this in Power BI Desktop |
| `Mirelo Sales.SemanticModel/` | TMDL, Import, 18 Parquet tables + 8 calculated tables + `_measures` (241 measures), 28 relationships, compatibility level 1702 |
| `Mirelo Sales.Report/` | PBIR: page `sales_one_pager` (1440 x 810, five views) + hidden drill-through pages `loan_detail`, `client_detail` |
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
`fact_loan` and `fact_application` also join `dim_date` (marked date table) by day. The four header pickers are disconnected tables
(`param_anchor_month`, `param_period`, `param_comparator`, `param_market`); window measures turn them into a `month_index` range,
the P&L engine pattern. Period-end metrics (30+ DPD, MRR, subscribers) use the anchor month, the last closed month of every window.

## Built vs placeholder

| View | Built | Placeholder / deviation |
|---|---|---|
| Header | Title, brand mark, wedge (SVG image), period sentence, market / period / month / comparator pickers, tabs, How to read pop-up | Market tiles are equal width (Power BI) and the first one reads **All**, not "All markets" (did not fit 58 px). The month dropdown is 48 px tall (validator floor) |
| Overview | 4 hero cards (SVG: value, sub-line, vs Budget / vs Prior year rows with diverging bars, status chip, 13-month sparkline), 2 x 2 why grid, markets table, card / ↗ navigation | O6 drawn as columns, not horizontal bars |
| Loans issued | 6 KPI cards, loans by month vs Budget, application funnel, originations bridge (waterfall), product x market, stage cycle time, agent leaderboard | **L11 Attainment by channel: placeholder** (no channel targets). L2 sub-line shows principal at budget FX instead of pipeline coverage (no open applications in the data). L12 has only two steps (only two timestamps). Bars drawn as columns |
| Clients | 6 KPI cards, new clients by channel + Budget, new-client funnel, cohort repeat curves, returning % heat matrix + by product, new clients table | **C6 Days between loans: placeholder** (no previous-loan date) |
| Portfolio quality | 6 KPI cards, DPD buckets, vintage curves, 30+ DPD heat matrix, 30+ DPD by market, roll rate 30 to 60, segments bubble, overdue loans table | Roll rate 60 to 90 dropped: the 90+ bucket is a 90-179-day stock, so the ratio runs above 200 % |
| Revenue & targets | 6 KPI cards, revenue vs Budget vs PY, revenue by stream, attainment by market, paying subscribers by tier, churn, channel mix, stream x market table | Interest and fees have no separate budget (budget is per product), so those rows show no budget |
| Drill-through | `loan_detail` (from market, product, channel or agent), `client_detail` (from a client id); 720 px panel, scrim, Back | Navigates to a page instead of an overlay (ADR-0011 accepted difference) |

## First-open checklist (USER)

1. Refresh (step 4 above) and check the Overview hero values for Sep 2026 / Month / All: 24.4k loans, €9.6m, 9,796 new clients,
   59.9 % returning, 4.6 % 30+ DPD.
2. Click each tab; the bookmarks are hand-written (display only, data unchanged). If a tab shows the wrong group, select the view and
   Update its bookmark in the Bookmarks pane.
3. Click a few picker tiles: the selected tile should turn ink with white text (it renders that way in the scratch copy; the
   click behaviour itself is untested).
4. Select a row in the markets table and press **Show loans**; on the detail page press **Back**. Try **Show client** in the clients table.
5. Hover a hero card: the tooltip gives the definition; a click opens the metric's view.
6. Run `tests/control-totals.dax` in DAX query view (paste one EVALUATE at a time); every `_pass` is TRUE.
7. Save in Desktop. From then on Desktop's serialization is the source; the generator (session scratchpad, not in the repo) is not re-run.

## Verification on 2026-10-27

- `powerbi-report-author validate "pbi-report/Mirelo Sales/Mirelo Sales.pbip"`: 0 errors, 0 warnings.
- Tests run over ADOMD against a scratch copy refreshed in Desktop: 5 sets, 2,560 rows, all TRUE (T-M1 requested windows 192,
  T-M2 every closed month 2,112, T-M3 QTD / YTD / R12M 192, T-M4 bridge identity + new-client rule 8, T-M5 card smoke 56).
- Render-checked in Desktop (scratch copy): all five views and both detail pages.
