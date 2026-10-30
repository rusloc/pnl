# Nordmark Retail — executive dashboard dummy dataset

Sample data for the Nordmark Retail executive dashboard (ADR-0013, `docs/Requirements-exec.md`, design target `docs/design/executive dashboard (reseller)/prototype.html` v5). All figures are invented. The generator is deterministic: seed 20261028 gives byte-identical files.

This README is the data contract for both flavours (`pbi-report/Nordmark Exec/` and `js-exec/`). Table, column and metric names here win over any layout or prototype name (ADR-0013 (j)).

- **Company:** Nordmark Retail, a fictional multi-category reseller. 142 trading stores in NL and BE (hyper, super, convenience), one online site, one wholesale desk, two DCs, 9 categories, 1,100 suppliers. EUR only.
- **Calendar:** 4-5-4 retail calendar, weeks Monday–Sunday. A fiscal year is the 52 weeks from the Monday of the week that contains 1 January. FY2025 = 30 Dec 2024 – 28 Dec 2025, FY2026 = 29 Dec 2025 – 27 Dec 2026. No 53-week year in the data.
- **As of:** actuals run through Sunday 25 Oct 2026 = **FY2026 Week 43** (19–25 Oct), Period 10 week 4 of 4 (P10 = 28 Sep – 25 Oct). The header stamp "Refreshed Mon 26 Oct 05:12" is `manifest.json › refreshed`.
- **Span:** actuals FY2025 W1 … FY2026 W43 (95 weeks). Budget FY2026 W1–W52. `dim_week` holds all 104 weeks.
- **Grain:** week × site × category for the executive facts. No day grain, no SKU grain.
- **Size:** 18 tables, 0.88 M rows, 15.4 MB of Parquet. No CSV copies of the tables.

## How to run

```powershell
cd data\nordmark_retail_dummy_data
py -3.12 -m venv generator\.venv                                   # once; .venv is gitignored
generator\.venv\Scripts\python.exe -m pip install -r generator\requirements.txt
generator\.venv\Scripts\python.exe generator\generate.py           # writes parquet\ and checks\ (~3 s)
generator\.venv\Scripts\python.exe checks\verify.py                # 91 checks incl. a byte-identical rerun, exit 1 on any failure (~50 s)
```

- `generate.py --out <folder>` writes the dataset somewhere else. `verify.py --data <folder>` checks that folder; `--no-rerun` skips the determinism rerun (ET-20).
- Dependencies are pinned to numpy 2.5.4, pandas 2.3.3 and pyarrow 26.0.0, as for Mirelo.
- `generate.py` asserts the v5 Week-43 story itself and stops if any value is off. `verify.py` recomputes every control total from the Parquet files with its own code.

## Files

| File | Rows | Grain (one row per …) |
| --- | ---: | --- |
| parquet/dim_week.parquet | 104 | retail week, FY2025 W1 … FY2026 W52 |
| parquet/dim_date.parquet | 728 | day of those weeks (calendar labels only; no fact joins it) |
| parquet/dim_store.parquet | 149 | site: 145 stores (142 trading at W43 + 3 closed in FY2026), ONLINE, WHOLESALE, DC_TIL, DC_WIL |
| parquet/dim_category.parquet | 9 | category |
| parquet/dim_supplier.parquet | 1,100 | supplier |
| parquet/dim_cost_type.parquet | 4 | cost type of the EBITDA bridge |
| parquet/dim_kpi.parquet | 32 | KPI of the spec catalogue: 12 landing cards + 20 bench KPIs |
| parquet/fact_sales_week.parquet | 121,572 | week × selling site (stores, ONLINE, WHOLESALE) × category, actuals |
| parquet/fact_budget_week.parquet | 68,094 | week × selling site × category, Budget FY2026 W1–W52 |
| parquet/fact_supplier_income_week.parquet | 71,345 | week × supplier with a rebate scheme |
| parquet/fact_inventory_week.parquet | 122,427 | week-end × stock location (stores, ONLINE fulfilment centre, 2 DCs) × category |
| parquet/fact_forecast_week.parquet | 121,572 | week × selling site × category |
| parquet/fact_availability_week.parquet | 119,862 | week × store × category |
| parquet/fact_receipts_week.parquet | 120,717 | week × selling location (stores, ONLINE) × category |
| parquet/fact_po_week.parquet | 88,937 | week × supplier with PO lines due |
| parquet/fact_opex_week.parquet | 42,001 | scenario (ACT / BUD) × week × cost type × site (null = central) |
| parquet/param_status_rule.parquet | 15 | status rule per landing card + the 3 dot constants |
| parquet/param_target.parquet | 27 | KPI × category (or ALL) target |
| parquet/manifest.json | — | rows, bytes, column → Arrow type per table; seed, as-of, current week, refresh stamp, calendar anchor |
| checks/control_totals_eur.csv | 26,143 | scope × period key × metric (see Control totals) |
| checks/control_totals_category_eur.csv | 10,514 | category scope × period key × metric, sampled (see Category control totals) |
| checks/verify.py | — | independent recomputation and story checks (ET-01 … 05, 20 … 24, 27, 33, 34) |
| generator/generate.py | — | the generator (Python 3.12, seed 20261028) |

## Format

- One Parquet file per table, snappy, written with pyarrow 26, no pandas metadata. Types: `date32` for dates, `bool` for flags, `int32` / `int64` for counts, `double` for every amount and ratio (never DECIMAL), `string` for codes and keys.
- Amounts are EUR, ex-VAT, rounded to the cent. Model them as Decimal Number (double), never Fixed Decimal.
- `week_key` is text `FY2026-W43`. Null means "not applicable".

## Relationships

| Fact column | Dimension | Note |
| --- | --- | --- |
| `week_key` (every fact) | `dim_week.week_key` | `dim_date.week_key` → `dim_week` for day labels |
| `store_code` (sales, budget, inventory, forecast, availability, receipts, opex) | `dim_store.store_code` | `fact_opex_week.store_code` is null for central costs |
| `category_code` | `dim_category.category_code` | |
| `supplier_code` (supplier income, PO) | `dim_supplier.supplier_code` | these two facts have no site and no category key |
| `cost_type_code` | `dim_cost_type.cost_type_code` | |
| `param_target.category_code` | `dim_category.category_code` | `ALL` rows are the card targets |
| `dim_week.ly_week_key`, `lw_week_key` | `dim_week.week_key` | role-playing, for LY / LW windows |

`dim_kpi`, `param_status_rule` and `param_target` are metadata: they join no fact.

## Columns

**dim_week**: `week_key` · `fy` · `week_of_fy` 1–52 · `quarter` · `period` 1–12 (4-5-4) · `period_key` (`FY2026-P10`) · `week_of_period` · `weeks_in_period` · `week_start` (Mon) · `week_end` (Sun) · `period_start` · `period_end` · `ly_week_key` (FY2026 Wn → FY2025 Wn; null in FY2025) · `lw_week_key` · `is_actual` (≤ FY2026 W43) · `season_code` (`AW25`, `AW26` = W32–W51, else null) · `season_week` 1–20 · `week_label` (`Week 43`) · `sort_index` 1–104

**dim_date**: `date` · `week_key` · `fy` · `period` · `week_of_fy` · `day_of_week` (1 = Mon) · `day_name` · `is_trading_day` (false on 25 Dec and 1 Jan) · `is_actual`

**dim_store**: `store_code` (`S001`–`S145`, `ONLINE`, `WHOLESALE`, `DC_TIL`, `DC_WIL`) · `store_name` · `channel_code` (STORE / ONLINE / WHOLESALE / DC) · `format` (hyper / super / convenience / online / wholesale / dc) · `country` (physical location) · `region` (NL: Randstad, North & East, South; BE: Flanders, Brussels, Wallonia) · **`scope_code`** (NL / BE for stores, ONLINE for the online site, null for WHOLESALE and the DCs) · `cluster` (Urban / Suburban / Regional) · `sales_area_sqm` · `open_date` · `close_date` · `refit_date` · `sort_order`

**dim_category**: `category_code` (FRESH, AMBIENT, HB, HOUSEHOLD, ELEC, APPAREL, HOME, GARDEN, TOYS) · `category_name` · `division` · `is_seasonal` (APPAREL, HOME, GARDEN, TOYS: the sell-through categories) · `cover_target_wks` · `gmroi_target` · `sellthrough_target` (seasonal only) · `top500_skus` (the category's share of the top-500 sellers) · `sort_order`

**dim_supplier**: `supplier_code` (`SUP0001`–`SUP1100`) · `supplier_name` (invented) · `supplier_group` (`Group nn` or the supplier itself) · `country` · `primary_category_code` · `rebate_scheme` (VOLUME / GROWTH / PROMO / NONE)

**dim_cost_type**: `cost_type_code` (SHRINK, STORE_OPEX, CENTRAL_OPEX, FULFILMENT) · `cost_type_name` · `site_level` · `sort_order`

**dim_kpi** (the 32 rows of the spec catalogue, `catalogue_no` 1–32): `kpi_code` · `kpi_name` · `domain` · `is_landing` · `size` (hero / medium / small) · `card_order` 1–12 (the v5 size map) · `group` (B1–B4) · `lever` · `horizon` · `owner` · `statement` (pl / bs / ops) — the five attribute values use the v5 filter codes · `drill_page` · `is_provisional` (TOTAL_MARGIN, EBITDA; drives "prov.", E-27) · `is_stock` · `direction` (UP / DOWN / BAND / CONTEXT) · `unit` (EUR / PCT / WKS / X / MIX) · `period_basis` (FLOW / POINT_IN_TIME / PERIOD_TO_DATE / SEASON_TO_DATE / R52W) · `basis` (BUDGET / TARGET / PLAN) · `value_metric`, `basis_metric`, `status_metric` (the control-total metric codes of the card) · `formula`, `owner_initials`, `cadence` (bench KPIs: the More-KPIs drawer text)

| card_order | kpi_code | Card | size | value_metric | basis_metric |
| ---: | --- | --- | --- | --- | --- |
| 1 | NET_SALES | Net sales | hero | `net_sales` | `net_sales_bud` |
| 2 | TOTAL_MARGIN | Total margin (prov.) | hero | `total_margin_pct` | `total_margin_pct_bud` |
| 3 | WEEKS_OF_COVER | Weeks of cover | hero | `weeks_of_cover` | `cover_target_wks` |
| 4 | MARKDOWN | Markdown | medium | `markdown_pct` | `markdown_pct_bud` |
| 5 | AVAILABILITY | Availability | medium | `availability_pct` | `availability_target` |
| 6 | EBITDA | EBITDA flash (prov.) | medium | `ebitda` (card: `ebitda_ptd`) | `ebitda_bud` (card: `ebitda_bud_ptd`) |
| 7 | LFL_GROWTH | Like-for-like growth | small | `lfl_growth_pct` | `lfl_growth_pct_bud` |
| 8 | FRONT_GM | Front gross margin | small | `front_gm_pct` | `front_gm_pct_bud` |
| 9 | SELL_THROUGH | Sell-through | small | `sell_through_pct` | `sell_through_target` |
| 10 | GMROI | GMROI | small | `gmroi` | `gmroi_target` |
| 11 | SUPPLIER_OTIF | Supplier OTIF | small | `otif_pct` | `otif_target` |
| 12 | CHANNEL_MIX | Channel mix | small | `mix_store_pct` (+ online, wholesale) | `mix_store_pct_bud` (+ online, wholesale) |

**fact_sales_week**: `gross_sales` (ticket, ex-VAT) · `markdown_value` (permanent + promo) · `returns` · `net_sales` (= gross − markdown − returns, to the cent) · `units` · `cogs_landed` (standard landed cost) · `back_margin_alloc` · `transactions` (receipts containing the category; wholesale = orders; not additive across categories) · `is_lfl` · `is_lfl_as_ly` (see LFL)

**fact_budget_week**: `net_sales_bud` · `gross_sales_bud` · `markdown_bud` · `cogs_bud` · `back_margin_bud` · `is_lfl`. Implied budget returns = gross − markdown − net. Closed stores keep their budget all year (the closures were unplanned).

**fact_supplier_income_week**: `rebate_accrual` · `promo_funding` · `listing_fees` · `is_provisional` (TRUE in FY2026 W40–W43: accrued at contract rate, true-up 10 Nov)

**fact_inventory_week**: `on_hand_units` · `on_hand_cost` · `on_order_cost` · `in_transit_cost` · `aged_90_cost`. Week-end snapshots: never sum them over weeks.

**fact_forecast_week**: `forecast_cogs` (forward weekly COGS: the mean of the next four weeks, taken at the week-end). Selling sites only.

**fact_availability_week**: `ranged_sku_days` (top-500 SKU-days: 3,500 per trading store and week) · `in_stock_sku_days` (sales-weighted, 1 decimal). Stores only.

**fact_receipts_week**: `receipt_units` received into the selling location (from a DC or direct). DC inbound receipts are not in this table.

**fact_po_week**: `po_lines_due` · `po_lines_otif`

**fact_opex_week**: `amount`. SHRINK and STORE_OPEX on stores, FULFILMENT on ONLINE and WHOLESALE, CENTRAL_OPEX with `store_code` null.

**param_status_rule**: `rule_code` · `kpi_code` · `basis` · `direction` · `unit` · `watch_from` · `off_from` · `threshold` (dot rows only) · `sort_order`. See Status.

**param_target**: `kpi_code` · `category_code` (`ALL` or a category) · `target_value`. ALL rows: AVAILABILITY 0.97, SUPPLIER_OTIF 0.95, GMROI 2.5, WEEKS_OF_COVER 9.5, SELL_THROUGH 0.62. Category rows repeat `dim_category`.

## Rules to apply in your measures

**Scope (region switcher, E-15).** ALL = no filter. NL / BE / ONLINE = `dim_store.scope_code`. NL + BE + ONLINE + WHOLESALE = ALL for every sales fact (ET-12). WHOLESALE, the DCs and central costs appear only in ALL.

- `fact_po_week` has no site: Supplier OTIF is the same in every scope.
- Availability is store-only, so it is N/A for ONLINE. LFL is store-only, so it is N/A for ONLINE.
- Stock-based cards in a scope use that scope's locations only: DC stock is in ALL, never in NL / BE.

**Category (filter, E-100 … E-104, `docs/ADD/features/exec-category-filter.md`).** A pick is one or more `dim_category.category_code`s. It combines with Region: scope = region × pick. All 9 picked = All (no pick).

- Every fact with a `category_code` filters on the pick: sales, budget, inventory, forecast, availability, receipts. Each card keeps its formulas and status bands. The card is computed on the picked cells.
- Back margin is exact per category: `back_margin_alloc` per week × category equals the category's supplier accruals (ET-07).
- **EBITDA flash and Supplier OTIF are N/A under any pick.** `fact_opex_week` and `fact_po_week` have no category key. `dim_supplier.primary_category_code` is not used.
- **Sell-through** runs on the seasonal part of the pick. A pick without a seasonal category is N/A.
- **Targets under a pick:**
  - Weeks of cover: the cover-target formula above (a single category gives its `cover_target_wks`).
  - GMROI: Σ (average on-hand cost × `gmroi_target`) ÷ Σ average on-hand cost over the picked categories (a single category gives its row).
  - Sell-through: 0.62. Availability: 0.97.
  - At All every card keeps its `param_target` ALL row (GMROI 2.5).
- The (i) mini stats `gmroi.<CATEGORY>` and `sell_through_pct.<CATEGORY>` list the picked categories only.
- Status chips per category were not tuned to a story (accepted 2026-10-30): many cover and GMROI chips are Watch or Off track.

**Windows (granularity picker, E-90 … E-93, `docs/ADD/features/exec-period-model.md`).** An item is one Week, Month (the 4-5-4 retail period), Quarter (13 weeks) or Year (52 weeks) of `dim_week`. Its window = its weeks ∩ actuals. At the as-of week, Q4 FY2026 (W40–W43) and FY2026 (W1–W43) are partial ("to date"); P10 FY2026 is complete.

- Flow metrics sum over the window: sales, margins, markdown, LFL, OTIF, EBITDA, budget.
- Point-in-time metrics take the window's last week: Weeks of cover, Availability, GMROI, Sell-through (N/A when that week is outside a season).
- Channel mix: the last week at Week; shares over the whole window at Month / Quarter / Year (USER 2026-10-29).
- The EBITDA card shows period to date through the week at Week (`ebitda_ptd`) and the item's own window at Month / Quarter / Year (`ebitda`). Its bars are one per item.

**Comparators (E-14).**

- Budget = `fact_budget_week` / `fact_opex_week` scenario BUD, or the card's target.
- Last year = the same window one year back by week key (`ly_week_key`; `W-FY2025-43` is the LY of `W-FY2026-43`). Never join LY on dates: 19 Oct 2025 is in FY2025 W42 (ET-05).
- Previous item = the item before at the same granularity (`lw_week_key` at Week). Exception, the EBITDA card at Week: its value is period to date, so Previous = the previous period cut to the same number of weeks (week k of P10 → P9 weeks 1 … k; P1 → P12 of the FY before; USER 2026-10-29). Week 5 of a 5-week period (W9, W22, W35, W48) has no like-length window, so its EBITDA Previous is N/A: no value, no Δ (main agent 2026-10-30). A complete item compares with the whole previous item, even when the 4-5-4 lengths differ. A partial item compares with the previous item's first k weeks (`Q-FY2026-3@4`). Year has no previous-year comparator, only Last year (USER 2026-10-29).
- FY2025 items: no budget (budget-based values, Δ and status N/A) and no LY (the data starts at FY2025 W1).
- The status chip is always vs Budget / target (E-24). Only the Δ row follows the comparator.

**Card formulas (E-30 … E-41).**

| Card | Formula |
| --- | --- |
| Net sales | Σ `net_sales` |
| Front gross margin % | (Σ `net_sales` − Σ `cogs_landed`) ÷ Σ `net_sales` |
| Total margin % | (front margin € + Σ `back_margin_alloc`) ÷ Σ `net_sales` |
| Markdown % of gross | Σ `markdown_value` ÷ Σ `gross_sales` |
| Weeks of cover | (Σ `on_hand_cost` + Σ `on_order_cost`) at the last week-end ÷ Σ `forecast_cogs` of that week. Fallback when the forecast is blank: R4W average `cogs_landed` |
| Cover target | Σ (`forecast_cogs` × `dim_category.cover_target_wks`) ÷ Σ `forecast_cogs`, same week and scope. It is 9.5 at ALL in every week |
| Availability % | Σ `in_stock_sku_days` ÷ Σ `ranged_sku_days`, last week |
| Sell-through % | Season-to-date units sold ÷ (season opening units + season-to-date receipts). Seasonal categories only, selling locations only (stores and ONLINE; wholesale excluded). Season = `dim_week.season_code` of the last week; N/A outside a season. Opening units = `on_hand_units` at the week-end before season week 1 (W31). Receipts = `fact_receipts_week`. Sold = `fact_sales_week.units` |
| GMROI | Σ front margin € over the 52 weeks ending with the last week ÷ average `on_hand_cost` over those 52 week-ends (on-order and in-transit excluded) |
| Supplier OTIF % | Σ `po_lines_otif` ÷ Σ `po_lines_due` |
| EBITDA | Total margin € − Σ `amount` (SHRINK, STORE_OPEX, CENTRAL_OPEX, FULFILMENT). Budget = scenario BUD with the budget total margin. Margin % = ÷ Net sales |
| LFL growth % | See LFL |
| Channel mix | Net sales by `channel_code` ÷ Net sales: the last week at Week, the whole window at Month / Quarter / Year. Plan = Budget Net-sales shares on the same weeks. The Δ row shows the channel with the largest absolute deviation (first channel on a tie) |

**LFL (E-31).** A store is LFL for a retail period when:

- it opened at least 13 months before the period start;
- it is not closed by the period end;
- it had no refit in the 13 months before the period start or during the period.

The generator writes the flag per row:

- `is_lfl` on a row says the store is LFL in that row's period. Use it for the current side.
- `is_lfl_as_ly` on a row says the store is LFL in the period one year later. Use it for the LY side.
- LFL growth = Σ `net_sales` [`is_lfl`] over the window ÷ Σ `net_sales` [`is_lfl_as_ly`] over the LY window − 1.
- Budget LFL = Σ `net_sales_bud` [`is_lfl`] ÷ the same LY actual − 1.
- Non-LFL effect = store-channel growth vs LY − LFL growth.
- LFL store count = stores with `is_lfl` rows in the last week.

**Back margin (E-33).** Supplier income is accrued per week × supplier. Its category total is allocated to that category's site cells by COGS share, with the residual to the largest cell. So Σ `back_margin_alloc` = Σ supplier income per week × category and for ALL (ET-07). Back margin is provisional in W40–W43.

**Status (E-22, E-23, E-75).** For each card, compute a badness *b* in the rule's unit; ratios are fractions, so 1 pp = 0.01.

| direction | b |
| --- | --- |
| UP | basis − actual. Net sales and EBITDA use 1 − actual ÷ budget |
| DOWN | actual − basis |
| BAND | \|actual − basis\|. Channel mix uses the largest channel deviation |

Then: **On track** if *b* ≤ `watch_from`; **Watch** if *b* ≤ `off_from`; else **Off track**. N/A when the input is blank. Round *b* to 10 decimals before comparing.

This keeps the E-22 table: a value exactly on the Watch edge (−3 %, −1.0 pp, 2 wks …) is Watch, and Off track starts strictly beyond it. E-23's sentence "a Δ of exactly the off-track edge is Off track" contradicts the table; see Open points.

**Overall dot (E-26).** Over the cards with a status (N/A excluded from the denominator; n = 0 gives no `status.dot` row = grey dot), attribute filters ignored:

1. **red** if off ÷ n ≥ `DOT_RED_OFF` (1/3);
2. else **orange** if (watch + off) ÷ n > `DOT_ORANGE_WATCH_OFF` (0.5);
3. else **green** if on ÷ n ≥ `DOT_GREEN_GOOD` (2/3);
4. else **orange**.

Week 43 ALL: 7 / 3 / 2 → orange.

**Rounding.** Full precision in every measure. Round only at display (E-42).

## Control totals

`checks/control_totals_eur.csv` is long format: `scope, period_key, metric_code, value`. It holds 26,143 values: 87 item keys and 6 legacy keys × 4 scopes. The generator computes them from the tables it writes; `verify.py` recomputes every one independently (ET-01).

- **Tolerance:** amounts 0.005, ratios 1e-6, counts and codes exact.
- **Scopes:** ALL, NL, BE, ONLINE.
- **Key grammar** `{W|P|Q|FY}-FY{yyyy}[-{n}][@{k}]` (E-99, `docs/ADD/features/exec-period-model.md` §6):
  - `W-FY2026-43` week (two digits) · `P-FY2026-10` retail period, the "Month" (two digits) · `Q-FY2026-4` quarter · `FY-FY2026` year;
  - without `@`: the item's weeks ∩ actuals, so `Q-FY2026-4` = W40–W43 and `FY-FY2026` = W1–W43 at this as-of;
  - `@k`: the item's first k weeks, the like-length window a partial item compares with.
- **Item keys (87):**
  - weeks `W-FY2026-30` … `W-FY2026-43` (the 13 bar weeks and the previous week of W31) and `W-FY2025-31` … `W-FY2025-43` (their LY). FY2026 W01–W29 and FY2025 W01–W30 have no rows: same code path, and the parity tests pick one of them (ET-25);
  - every Month item `P-FY2025-01` … `P-FY2025-12`, `P-FY2026-01` … `P-FY2026-10`;
  - every Quarter item `Q-FY2025-1` … `Q-FY2025-4`, `Q-FY2026-1` … `Q-FY2026-4`;
  - both Year items `FY-FY2025`, `FY-FY2026`;
  - like-length windows `Q-FY2026-3@4` (previous item of Q4 to date: W27–W30), `Q-FY2025-4@4` (its LY: FY2025 W40–W43), `FY-FY2025@43` (LY of FY2026 to date: FY2025 W1–W43);
  - EBITDA Previous at Week (25): `P-FY{yyyy}-{p−1}@{k}` for every covered W key, k = its `week_of_period`: `P-FY2026-06@4`, `P-FY2026-07@1` … `@4`, `P-FY2026-08@1` … `@4`, `P-FY2026-09@1` … `@4`, `P-FY2025-07@1` … `@4`, `P-FY2025-08@1` … `@4`, `P-FY2025-09@1` … `@4`. The key always carries `@k`, even when k covers the whole previous period (`P-FY2026-09@4` = P9 = W36–W39; same values as `P-FY2026-09`). Week 5 of a 5-week period has no key: `W-FY2026-35` and `W-FY2025-35` read N/A (the previous period has 4 weeks). `P-FY2026-07@4` / `P-FY2025-07@4` stay, for W34.
- **Comparator key of an item** (ET-23):
  - Last year = the same granularity and number in FY2025, with `@k` when the item is partial. FY2025 items have no LY.
  - Previous item = the item before, at the same granularity. It is whole when the picked item is complete, even across 4-5-4 lengths, and `@k` when it is partial. There is none for the first item of the data (W01 / P01 / Q1 FY2025) and none at Year.
  - EBITDA card at a W key: Δ vs Previous = `ebitda_ptd` of the W key − `ebitda` of its `P-…@k` key (above), not the previous week's `ebitda_ptd`; N/A at week 5 of a 5-week period. Every other W-key comparator reads the previous W key (`lw_week_key`).
- **Legacy keys, to be removed:** `PTD-FY2026-43`, `PTD-FY2026-42`, `PTD-FY2025-43`, `YTD-FY2026-43`, `YTD-FY2026-42`, `YTD-FY2025-43`.
  - They stay byte-identical to the 2026-10-28 file (pinned hash, ET-22) under the old rules: exit channel mix, no status before FY2026, EBITDA status on P10 to date. Do not build on them.
  - They keep the current js-exec and PBI tests fed while both flavours move to the item keys.
  - Successors: `P-FY2026-10`, `P-FY2025-10`, `FY-FY2026` and `FY-FY2025@43`. The "as of last week" windows (`-42`) have none.
  - ET-24 asserts the successors equal them and prints every difference. Allowed differences: channel mix, which now uses window shares; the EBITDA status of `FY-FY2026`, which now uses the FY window; and `ebitda_ptd` / `ebitda_bud_ptd`, which now exist on W keys only.
  - Removal: delete them from both key lists (`generate.py` › `control_totals`, `verify.py` › `KEYS`). Then drop the `LEGACY` branches, the legacy ET-22 hash, ET-24 and the YTD clause of ET-27, regenerate, and run `verify.py`.
- **Absent row** = N/A for that scope and window. Examples: no budget in FY2025, no LFL or GMROI where the LY or R52W history is missing, no sell-through when the window ends outside a season, no availability or LFL for ONLINE.

Metrics:

- **Sales and margin (window):** `gross_sales`, `markdown`, `returns`, `net_sales`, `cogs`, `front_margin`, `back_margin`, `total_margin`, `front_gm_pct`, `back_margin_pct`, `total_margin_pct`, `markdown_pct`.
- **EBITDA (window):** `opex_shrink`, `opex_store`, `opex_central`, `opex_fulfilment`, `ebitda`, `ebitda_margin_pct`. The card value at W keys is `ebitda_ptd` / `ebitda_bud_ptd` (period to date through the week, W keys only). At P / Q / FY keys it is `ebitda` / `ebitda_bud` of the key.
- **LFL:** `lfl_net_sales`, `lfl_net_sales_ly`, `lfl_store_count`, `lfl_growth_pct`, `store_net_sales`, `store_net_sales_ly`, `nonlfl_effect_pp`.
- **Supplier:** `po_lines_due`, `po_lines_otif`, `otif_pct`, `otif_target`, `otif_suppliers_below_85` (W keys, ALL).
- **Point in time:**
  - cover: `on_hand_cost`, `on_order_cost`, `stock_incl_on_order`, `forecast_cogs`, `weeks_of_cover`, `cover_target_wks`;
  - availability: `ranged_sku_days`, `in_stock_sku_days`, `availability_pct`, `availability_target`;
  - sell-through: `season_opening_units`, `season_receipt_units`, `season_units_sold`, `sell_through_pct`, `sell_through_target`;
  - GMROI: `gmroi_front_margin_r52w`, `gmroi_avg_on_hand_cost`, `gmroi`, `gmroi_target`;
  - channel mix: `mix_{store|online|wholesale}_net_sales`, `mix_{…}_pct`. These are last-week values at W keys and window sums and shares at P / Q / FY keys.
- **Budget (FY2026 keys):** `net_sales_bud`, `gross_sales_bud`, `markdown_bud`, `cogs_bud`, `back_margin_bud`, `markdown_pct_bud`, `front_gm_pct_bud`, `total_margin_pct_bud`, `opex_*_bud`, `ebitda_bud`, `ebitda_margin_pct_bud`, `lfl_net_sales_bud`, `lfl_growth_pct_bud`, `mix_{…}_pct_bud` (same weeks as `mix_{…}_pct`), `mix_max_dev_pp` (signed), `mix_max_dev_channel` (1 store, 2 online, 3 wholesale).
- **Status (every key):**
  - `status.<kpi_code lower>`: 1 On track, 2 Watch, 3 Off track; absent = N/A;
  - `status.count_on`, `status.count_watch`, `status.count_off`, `status.count_na`, counted over the rated cards;
  - `status.dot`: 1 green, 2 orange, 3 red.

  A key's status uses its own window. EBITDA uses period to date at W keys and the key's window at P / Q / FY keys. FY2025 keys rate only the target-based cards where their input exists: Weeks of cover, Availability, Sell-through, GMROI, OTIF. That gives 4 for `P-FY2025-10` (no GMROI) and 3 for `Q-FY2025-1`.
- **ALL only, the (i) mini stats:** `gmroi.<CATEGORY>`, `sell_through_pct.<SEASONAL CATEGORY>`.

### Category control totals (E-104)

`checks/control_totals_category_eur.csv` holds 10,514 values for 180 sampled cells. It uses the same four columns and tolerances as the main file and the same period keys. The main file and its ET-22 hashes are unchanged.

- **Scope grammar** `{ALL|NL|BE|ONLINE}#{code}[+{code}…]`: codes in `dim_category.sort_order`, joined by `+` (`ALL#ELEC`, `NL#ELEC+TOYS`). A scope without `#` (main file) = All categories.
- **Picks (12):** the 9 singles · `ELEC+TOYS` (seasonal + non-seasonal) · `FRESH+AMBIENT+HB` (non-seasonal only) · `APPAREL+HOME+GARDEN+TOYS` (all seasonal).
- **K12 keys:** `W-FY2026-43`, `W-FY2025-43`, `W-FY2026-42`, `P-FY2026-10`, `P-FY2025-10`, `P-FY2026-09`, `Q-FY2026-4`, `Q-FY2025-4@4`, `Q-FY2026-3@4`, `FY-FY2026`, `FY-FY2025@43`, `FY-FY2025`. K6 = its W and P keys.
- **Block A:** the 12 picks at `ALL#…` × K12 = 144 cells, 8,466 rows.
- **Block B:** `{NL, BE, ONLINE}#{ELEC, ELEC+TOYS}` × K6 = 36 cells, 2,048 rows.
- **Metrics:** those of the main file, except the following, which have no rows under a pick:
  - every `opex_*` and `ebitda*` metric (including `ebitda_ptd`), and `status.ebitda`;
  - `po_lines_*`, `otif_*` and `status.supplier_otif`;
  - the sell-through block when the pick has no seasonal category.
- **Mini stats:** at `ALL#…` only, for the picked categories only. Counts and dot run over the rated cards. FY2026 at W43 rates 10 cards, or 9 without a seasonal category; ONLINE rates 8 or 7.
- **`verify.py` checks:**
  - ET-01 recomputes every row with its own dense category engine.
  - In memory, for all 87 item keys × 4 scopes: the 9-category pick reproduces the published All values, and Σ of the 9 singles = All for 32 additive inputs.
  - ET-33: additivity of the file rows, the sell-through identity and the targets.
  - ET-34: the N/A rows and the rated counts.
  - ET-20 covers this file too.

### Week 43 · ALL · vs Budget (ET-02, asserted at display precision)

| Card | Value | Δ vs Budget / target | Status | (i) inputs in the data |
| --- | --- | --- | --- | --- |
| Net sales | €61.4m | −€1.5m (−2.4%) | Watch | €68.4m gross − €6.7m markdown − €0.3m returns; budget €62.9m; vs LY +3.8%; P10 €241.7m; YTD €2,318m |
| Total margin (prov.) | 36.3% | +0.1 pp vs 36.2% | On track | front €18.5m + back €3.8m (6.2%) = €22.3m; vs LY −0.2 pp |
| Weeks of cover | 11.4 wks | +1.9 wks vs 9.5 | Watch | €402m on hand + €88m on order = €490m ÷ €43.0m forecast COGS; vs LW +0.3 |
| Markdown | 9.8% | +1.3 pp vs 8.5% | Off track | €6.7m ÷ €68.4m; vs LY +1.9 pp |
| Availability | 94.1% | −2.9 pp vs 97% | Off track | 467,700 ÷ 497,000 SKU-days; vs LW −0.2 pp |
| EBITDA flash (prov., P10) | €15.3m | −€0.8m (−5.0%) | Watch | €87.7m − €2.2m − €52.4m − €11.6m − €6.2m; 6.3% of €241.7m; budget €16.1m = 6.6% |
| Like-for-like growth | +3.4% | +0.4 pp vs 3.0% | On track | 131 LFL stores of 142: €39.0m ÷ €37.7m; non-LFL effect −1.2 pp; online +12.1% |
| Front gross margin | 30.1% | +0.1 pp vs 30.0% | On track | €61.4m − €42.9m = €18.5m; vs LY −0.3 pp |
| Sell-through | 63.1% | +1.1 pp vs 62% | On track | 8.4m sold ÷ (4.2m opening + 9.1m received); Apparel 58%, Home & kitchen 69%; vs LY season +2.4 pp |
| GMROI | 2.7× | +0.2× vs 2.5× | On track | **€862m ÷ €319m** (R52W front margin ÷ average on-hand cost); H&B 4.1×, Electronics 1.9× |
| Supplier OTIF | 95.4% | +0.4 pp vs 95% | On track | 4,591 ÷ 4,812 lines; vs LW +0.4 pp; 2 Electronics suppliers below 85% |
| Channel mix | 68.4 / 19.9 / 11.7 | online +1.9 pp vs plan 70 / 18 / 12 | On track | store €42.0m, online €12.2m, wholesale €7.2m |

Counts 7 on track / 3 watch / 2 off track; overall dot **orange**.

The v5 GMROI example "€1,016m ÷ €376m" cannot hold with the accepted front-margin definition: R52W front margin at about 30 % on €2.9 bn of R52W sales is €0.86 bn. The ratio 2.7× holds; the (i) copy needs the data values. See Open points.

## Stories built into the data

| When | What | Where it shows |
| --- | --- | --- |
| Every week | **Seasonality.** Low January, Easter lift, summer flat, autumn build. Black Friday in W48, Christmas peak in W51–W52. By category: Garden in spring, Toys in Nov–Dec, Electronics around Black Friday | Net sales bars, category mix |
| FY2025 → FY2026 | **Growth +3.8 % vs LY at W43.** Stores LFL +2–3.6 %; online +11–12 %; wholesale about +1 % | LFL, Channel mix, vs-LY Δ |
| 2025-02 … 2026-09 | **Estate changes.** 2 openings in FY2025 (Feb, May) and 6 from Oct 2025 to Sep 2026. 3 closures on 1 Mar, 14 Jun and 30 Aug 2026 (convenience / super). 5 refits between Nov 2025 and Aug 2026. Result at W43: 142 trading, 131 LFL | LFL store count, non-LFL effect (−1.2 pp at W43) |
| W31–W43 FY2026 | **The v5 bar shapes.** Total margin, Front GM, Markdown, Availability, Weeks of cover, EBITDA, LFL and OTIF follow the v5 13-week series exactly. Net sales rise from €54m to €61m (smoothed; see Open points) | 13-week bars |
| Autumn FY2026 | **Apparel clearance 4 weeks early, Garden end of season.** Markdown rises from 7.9 % to 9.8 % vs a flat 8.5 % budget | Markdown (Off track) |
| Autumn FY2025 vs FY2026 | **Stock.** LY carried an autumn overstock (peak €429m on hand at W45). This year stock was leaner through the summer and builds from €297m (W31) to €402m (W43) | Weeks of cover (Watch), GMROI rising 2.67 → 2.70 |
| W43 FY2026 | **DC Tilburg WMS outage.** NL store availability is lower (93.4 % vs BE 95.0 %). Fresh is the lowest category | Availability (Off track), NL dot red |
| W36–W43 FY2026 | **Two Electronics suppliers below 85 % OTIF** (81 % and 82 % at W43) | Supplier drill, OTIF owner note |
| FY2026 budget | **Plan.** Stores LFL +3.0 %, online +10 %, wholesale +1 %; closed stores still budgeted (closures unplanned); plan mix exactly 70 / 18 / 12 at W43. Online beats plan (+7.7 % at W43); stores miss it | Net sales (Watch), Channel mix |
| P10 FY2026 | **Provisional.** Supplier accruals at contract rate until the 10 Nov true-up. Payroll over on Sunday trading in W43 (costs above the P10 average) | Total margin and EBITDA "prov." |
| Category GMROI | Fresh 9.0×, H&B 4.1×, Ambient 2.4×, Household 2.4×, Apparel 2.2×, Toys 2.0×, Home 1.9×, **Electronics 1.9× (target 2.2×)**, Garden 1.6× | GMROI (i), Inventory drill |
| Channel margins | Front margin: stores 32.5 %, online 31.8 %, wholesale 13.2 % (no markdown). Scoped EBITDA is a contribution before central costs: ONLINE reads about 26 % | Region switcher |

## Drill-path steps with no data behind them (E-78)

The binoculars pop-up shows the drill path only. These steps have no table in this build:

- SKU, SKU-store-day and SKU × promotion lists;
- receipt (POS) lines and order lines;
- PO line × receipt detail (OTIF is weekly per supplier);
- contract accrual lines (income is weekly per supplier);
- GL journal and cost-centre × account detail (opex is weekly per site and cost type);
- promotion types;
- aged-stock buckets other than 90+ days (`aged_90_cost` only);
- footfall, sessions and online orders;
- subcategory and brand.

Store, category, week, supplier, region, format and cluster grains exist, so the "store × category × week" and "by supplier" steps can be built later.

## Open points (fix nothing here; for the USER / ADR owner)

1. **Data home layout.** E-70 and ADR-0013 (b)/(c) list `dims/`, `facts/`, `params/` CSV next to `parquet/`. The build brief of 2026-10-28 asked for Parquet only, so there are no CSV copies.
2. **Row count.** 0.88 M rows, against ADR-0013 (d)'s ≈ 0.6 M. Six facts sit at about 120 k rows each. Still 15.4 MB, under the 25 MB target.
3. **dim_store** has 149 rows, not 144 sites:
   - 145 stores, because 3 stores closed in FY2026 and 142 still trade (v5: 500 × 142 × 7 = 497,000);
   - plus the two DCs, which the inventory fact needs;
   - plus `scope_code`, so both flavours filter the region switcher the same way.
4. **Added columns:** `is_lfl` and `is_lfl_as_ly` on the sales fact, `is_lfl` on the budget fact. They make LFL additive in a cube and in DAX.
5. **Dropped column:** `fact_budget_week.lfl_growth_bud`. A ratio is not additive at cell grain, so budget LFL is derived from `net_sales_bud` of the LFL stores.
6. **param_status_rule** has one row per card with two thresholds, not KPI × band rows, plus the 3 dot rows.
7. **Forecast, receipts and inventory grains:**
   - `fact_forecast_week` is week × site × category, not week × category: scoped Weeks of cover needs a scoped denominator;
   - `fact_receipts_week` includes ONLINE;
   - the inventory fact carries the ONLINE fulfilment centre.
8. **Period-key naming.** ADR-0013 (f) uses `P-FY2026-10` and `YTD-FY2026`. The file uses `PTD-FY2026-43` and `YTD-FY2026-43`, because every key names its as-of week, which the LW keys need. *Superseded 2026-10-29: item keys `{W|P|Q|FY}-FY{yyyy}[-{n}][@{k}]` (Control totals); the PTD- / YTD- keys are legacy.*
9. **E-23 vs E-22.** The table has −3 % ≤ Δ < 0 → Watch, so the edge is Watch. The next sentence says "exactly the off-track edge is Off track". The data follows the table; one sentence needs fixing.
10. **E-15 vs E-25 / ET-03.** E-15 says the dot ignores the region switcher; E-25 and ET-03 say the dot and counts follow it. Control totals carry a dot per scope, so either reading can be built. Also undecided: whether N/A cards count in the dot denominator (here they do not).
11. **E-41 vs E-13 / ET-09.** E-41 defines Channel mix "in the window"; E-13 and ET-09 call it point-in-time. The data follows E-13 / ET-09 (last week). *Superseded 2026-10-29 (USER): Week keeps the last-week shares. Month / Quarter / Year use window shares: Σ net sales per channel ÷ Σ net sales over the item's weeks, not the exit mix at the last week. Plan uses budget shares on the same weeks (see 18).*
12. **GMROI example.** "€1,016m ÷ €376m" cannot match OQ 11's front-margin definition with YTD sales of €2,318m (it would need R52W sales of ≈ €3.4 bn). The data gives €862m ÷ €319m = 2.7×. The v5 GMROI formula text ("Total margin for the last 12 months") and the "R12M total margin" stat label also contradict OQ 11.
13. **Sell-through bars.**
    - The v5 series 41 → 63 % is not reachable with the (i) example's units: 8.4m sold over 12 weeks on 4.2m + 9.1m makes season week 1 about 12 %.
    - W31 lies before the AW26 season (W32–W51), so its bar is N/A. The bars read 12 → 63 %.
14. **Net-sales bar W31–W39.** It is lowered from the v5 57.8 → 59.8 to 54.3 → 58.3. With YTD fixed at €2,318m and P10 at €241.7m, the v5 values would leave a jump between W30 and W31. P10 itself reconciles: W40–W42 sum to €180.3m, not the v5 bars' €182.8m.
15. **Scoped EBITDA.** Central costs exist only in ALL, so the NL / BE / ONLINE EBITDA cards show a contribution. ONLINE reads about 26 %. This needs a copy note or a cost-allocation decision.
16. **Last-week comparator for PTD / YTD.** The data assumes "the same window as of last week". The requirements do not define it. *Superseded 2026-10-29: Previous item replaces Last week (Comparators).*
17. **ET-26 vs GMROI history.** ET-26 says `FY2025-P10` rates the 5 target-based cards. GMROI needs R52W history (last week ≥ FY2025 W52), so P10 FY2025 rates 4: Weeks of cover, Availability, Sell-through and OTIF. GMROI is rated only from P12 / Q4 / FY2025.
18. **Channel-mix plan at Month / Quarter / Year.** The USER answer fixes the actual shares over the window. The plan shares and the max-deviation status use budget shares on the same weeks. This is ginee's reading and not yet confirmed.
19. **Category control totals, spec wording.**
    - E-76 and E-104 place the `#` scopes in `control_totals_eur.csv`. The file built is the separate `control_totals_category_eur.csv` (main agent, 2026-10-30), with the same grammar and columns.
    - ET-34 says "10 rated at `ALL#ELEC` · `W-FY2026-43`". ELEC is not seasonal, so E-103 gives 9 (count_na 3). The data follows E-103.
