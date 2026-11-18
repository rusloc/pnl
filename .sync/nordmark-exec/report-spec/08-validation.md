# 08 · Validation

Three levels, all with numbers that come from outside the web engine or are frozen from it:

1. **Row counts** and the calendar / period tables (structure).
2. **The answer key**: 97 verified figures, `C:\__VOSK__\data\nordmark\checks\chat-golden.csv`, built from the
   independent control totals (`C:\__VOSK__\scripts\nordmark-golden.ts`). Every row must pass on the Validation page
   (`[Golden Fail Count]` = 0).
3. **Control totals** (optional, ≈ 36,600 rows across 4 region scopes, 18 region × category scopes and every whole
   item plus the `@k` like-length windows): `[Control Fail Count]` = 0. The range logic of this spec was replayed
   against them outside Power BI (33,924 non-status-mini-stat figures, 0 differences).
4. **Display strings**: the exact text of every card in 17 views, frozen from the web engine (`buildView`), below.

Tolerances (the generator's): status codes and counts exact; ratios, `weeks_of_cover`, `gmroi`, `*_pp`, `*_target`
1e-6; units and SKU-days 0.06; EUR amounts 0.0051.

## 1 · Structure

| Check | Expected |
|---|---|
| `COUNTROWS ( 'Cube' )` | 4,599 |
| `COUNTROWS ( 'Opex' )` | 1,029 (ACT 665, BUD 364) |
| `COUNTROWS ( 'PO' )` | 95 |
| `COUNTROWS ( 'Sites' )` | 190 |
| `COUNTROWS ( 'Week' )` | 104; `week_ix` 0–103; 95 with `is_in_actuals` |
| `COUNTROWS ( 'Period' )` | 127 = W 95 + P 22 + Q 8 + FY 2; partial items exactly FY2026-Q4 and FY2026 |
| `COUNTROWS ( 'Metric' )` | 82 (43 with `is_catalogue`) |
| `COUNTROWS ( 'Card' )` / `'KPI Drill Step'` | 12 / 48 |
| Σ `Cube[net_sales]` (all rows) | 5,095,224,765.42 |
| Σ `Opex[amount]` | 2,404,945,933.21 |
| Σ `PO[po_lines_due]` | 458,134 |
| `Report Info` | as_of_ix 94 · current_fy 2026 · "Mon 26 Oct 05:12" |
| Region = Netherlands → `COUNTROWS ( 'Site Group' )` | 1 |
| Default view `[Sel Item Id]` / `[Sel Item Key]` | 94 / FY2026-W43 |
| `[Sel From Ix]`…`[Sel PTD Prev To Ix]` at W43 | 94, 94, LY 42–42, prev 93–93, PTD 91–94, PTD LY 39–42, PTD prev 87–90 ("P9 weeks 1–4") |
| Q4 FY2026 windows | 91–94, LY 39–42, prev 78–81 |
| FY2026 windows | 52–94, LY 0–42, prev 0–42 |

Full expected `Week` and `Period` tables: `02-data.md` appendices A and B.

## 2 · The answer key (97 rows)

How to read a row: set the period item (blank = the default FY2026-W43), the region, the categories (blank = All),
then read the measure of the `column`: `actual` → `[Actual]`, `basis` → `[Basis]`, `ly` → `[Last Year]`,
`prev` → `[Previous]`, with `Metric[metric_code]` = the row's metric (this is exactly what `[Golden Got]` does).
`n/a (BLANK)` = the measure must return BLANK. EBITDA-family metrics read month to date at Week; their "prev" at Week
is the previous month cut to the same number of weeks (P9 weeks 1–4 at W43).

| # | question | metric_code | item ("" = W43) | region | categories | column | expected | tolerance |
|---:|---|---|---|---|---|---|---:|---|
| 1 | How are net sales doing against budget this week? | `net_sales` | (W43) | all | All | actual | 61407862.34 | 0.0051 |
| 2 | How are net sales doing against budget this week? | `net_sales` | (W43) | all | All | basis | 62912987.45 | 0.0051 |
| 3 | How has total margin moved against last year? | `total_margin_pct` | (W43) | all | All | actual | 0.363131 | 1e-6 |
| 4 | How has total margin moved against last year? | `total_margin_pct` | (W43) | all | All | ly | 0.365000 | 1e-6 |
| 5 | Are weeks of cover on target? | `weeks_of_cover` | (W43) | all | All | actual | 11.393953 | 1e-6 |
| 6 | Are weeks of cover on target? | `weeks_of_cover` | (W43) | all | All | basis | 9.500000 | 1e-6 |
| 7 | What is the markdown rate this week? | `markdown_pct` | (W43) | all | All | actual | 0.097848 | 1e-6 |
| 8 | What markdown rate was budgeted for this week? | `markdown_pct` | (W43) | all | All | basis | 0.085000 | 1e-6 |
| 9 | What is store availability this week? | `availability_pct` | (W43) | all | All | actual | 0.941046 | 1e-6 |
| 10 | What is the availability target? | `availability_pct` | (W43) | all | All | basis | 0.970000 | 1e-6 |
| 11 | What is the EBITDA flash this week? | `ebitda` | (W43) | all | All | actual | 15299215.89 | 0.0051 |
| 12 | What is the budget for the EBITDA flash this week? | `ebitda` | (W43) | all | All | basis | 16096880.12 | 0.0051 |
| 13 | What is like-for-like growth this week? | `lfl_growth_pct` | (W43) | all | All | actual | 0.033894 | 1e-6 |
| 14 | What like-for-like growth was budgeted this week? | `lfl_growth_pct` | (W43) | all | All | basis | 0.030000 | 1e-6 |
| 15 | What is the front gross margin this week? | `front_gm_pct` | (W43) | all | All | actual | 0.301149 | 1e-6 |
| 16 | What front gross margin was budgeted this week? | `front_gm_pct` | (W43) | all | All | basis | 0.300000 | 1e-6 |
| 17 | What is season sell-through so far? | `sell_through_pct` | (W43) | all | All | actual | 0.631038 | 1e-6 |
| 18 | What is the sell-through target? | `sell_through_pct` | (W43) | all | All | basis | 0.620000 | 1e-6 |
| 19 | What is GMROI? | `gmroi` | (W43) | all | All | actual | 2.703100 | 1e-6 |
| 20 | What is the GMROI target? | `gmroi` | (W43) | all | All | basis | 2.500000 | 1e-6 |
| 21 | What is supplier OTIF this week? | `otif_pct` | (W43) | all | All | actual | 0.954073 | 1e-6 |
| 22 | What is the supplier OTIF target? | `otif_pct` | (W43) | all | All | basis | 0.950000 | 1e-6 |
| 23 | What share of net sales came through the stores this week? | `mix_store_pct` | (W43) | all | All | actual | 0.684051 | 1e-6 |
| 24 | What store share of net sales was planned this week? | `mix_store_pct` | (W43) | all | All | basis | 0.700000 | 1e-6 |
| 25 | What share of net sales was online this week? | `mix_online_pct` | (W43) | all | All | actual | 0.198618 | 1e-6 |
| 26 | What share of net sales went to wholesale this week? | `mix_wholesale_pct` | (W43) | all | All | actual | 0.117330 | 1e-6 |
| 27 | What were net sales in the same week last year? | `net_sales` | (W43) | all | All | ly | 59160248.18 | 0.0051 |
| 28 | What were net sales last week? | `net_sales` | (W43) | all | All | prev | 59370950.99 | 0.0051 |
| 29 | How many weeks of cover did we have last week? | `weeks_of_cover` | (W43) | all | All | prev | 11.100000 | 1e-6 |
| 30 | What was the markdown rate in the same week last year? | `markdown_pct` | (W43) | all | All | ly | 0.078800 | 1e-6 |
| 31 | What was availability last week? | `availability_pct` | (W43) | all | All | prev | 0.943000 | 1e-6 |
| 32 | What was EBITDA in the first four weeks of the previous month? | `ebitda` | (W43) | all | All | prev | 15304677.07 | 0.0051 |
| 33 | What was the EBITDA flash for the same month to date last year? | `ebitda` | (W43) | all | All | ly | 13913471.44 | 0.0051 |
| 34 | What were net sales in month 10? | `net_sales` | FY2026-P10 | all | All | actual | 241690417.83 | 0.0051 |
| 35 | What was the net sales budget for month 10? | `net_sales` | FY2026-P10 | all | All | basis | 244097812.66 | 0.0051 |
| 36 | What were net sales in month 9? | `net_sales` | FY2026-P10 | all | All | prev | 233583333.33 | 0.0051 |
| 37 | What were net sales in month 10 last year? | `net_sales` | FY2026-P10 | all | All | ly | 231891190.70 | 0.0051 |
| 38 | What was the total margin in month 10? | `total_margin_pct` | FY2026-P10 | all | All | actual | 0.362909 | 1e-6 |
| 39 | What was EBITDA in month 10? | `ebitda` | FY2026-P10 | all | All | actual | 15299215.89 | 0.0051 |
| 40 | What are net sales for quarter 4 to date? | `net_sales` | FY2026-Q4 | all | All | actual | 241690417.83 | 0.0051 |
| 41 | What were net sales in the same weeks of quarter 4 last year? | `net_sales` | FY2026-Q4 | all | All | ly | 231891190.70 | 0.0051 |
| 42 | What were net sales in the first four weeks of quarter 3? | `net_sales` | FY2026-Q4 | all | All | prev | 221260024.36 | 0.0051 |
| 43 | How many weeks of cover at the end of quarter 4 to date? | `weeks_of_cover` | FY2026-Q4 | all | All | actual | 11.393953 | 1e-6 |
| 44 | What are net sales for the year to date? | `net_sales` | FY2026 | all | All | actual | 2318203551.40 | 0.0051 |
| 45 | What were net sales in the same 43 weeks last year? | `net_sales` | FY2026 | all | All | ly | 2214317200.42 | 0.0051 |
| 46 | What is EBITDA for the year to date? | `ebitda` | FY2026 | all | All | actual | 137016839.87 | 0.0051 |
| 47 | What is the total margin for the year to date? | `total_margin_pct` | FY2026 | all | All | actual | 0.361039 | 1e-6 |
| 48 | What were net sales in FY2025? | `net_sales` | FY2025 | all | All | actual | 2777021214.02 | 0.0051 |
| 49 | What was the net sales budget for FY2025? | `net_sales` | FY2025 | all | All | basis | n/a (BLANK) | 0.0051 |
| 50 | What were net sales in week 30? | `net_sales` | FY2026-W30 | all | All | actual | 56715919.15 | 0.0051 |
| 51 | What were net sales in week 31 of FY2025? | `net_sales` | FY2025-W31 | all | All | actual | 52173423.45 | 0.0051 |
| 52 | What are net sales in the Netherlands this week? | `net_sales` | (W43) | nl | All | actual | 22981422.01 | 0.0051 |
| 53 | What is the Netherlands' net sales budget this week? | `net_sales` | (W43) | nl | All | basis | 24854939.27 | 0.0051 |
| 54 | What is like-for-like growth in the Netherlands? | `lfl_growth_pct` | (W43) | nl | All | actual | 0.029002 | 1e-6 |
| 55 | What is store availability in the Netherlands? | `availability_pct` | (W43) | nl | All | actual | 0.935395 | 1e-6 |
| 56 | What is the EBITDA flash for the Netherlands? | `ebitda` | (W43) | nl | All | actual | 4496429.45 | 0.0051 |
| 57 | What are Netherlands net sales for quarter 4 to date? | `net_sales` | FY2026-Q4 | nl | All | actual | 91061642.28 | 0.0051 |
| 58 | What are net sales in Belgium this week? | `net_sales` | (W43) | be | All | actual | 19024696.89 | 0.0051 |
| 59 | What is the total margin in Belgium this week? | `total_margin_pct` | (W43) | be | All | actual | 0.383063 | 1e-6 |
| 60 | How many weeks of cover does Belgium have? | `weeks_of_cover` | (W43) | be | All | actual | 8.218337 | 1e-6 |
| 61 | What are online net sales this week? | `net_sales` | (W43) | online | All | actual | 12196734.55 | 0.0051 |
| 62 | What is the online markdown rate this week? | `markdown_pct` | (W43) | online | All | actual | 0.120478 | 1e-6 |
| 63 | What is like-for-like growth online? | `lfl_growth_pct` | (W43) | online | All | actual | n/a (BLANK) | 1e-6 |
| 64 | What is availability online? | `availability_pct` | (W43) | online | All | actual | n/a (BLANK) | 1e-6 |
| 65 | What are Electronics net sales this week? | `net_sales` | (W43) | all | ELEC | actual | 6244442.81 | 0.0051 |
| 66 | What is the total margin in Electronics this week? | `total_margin_pct` | (W43) | all | ELEC | actual | 0.247889 | 1e-6 |
| 67 | How many weeks of cover does Electronics have? | `weeks_of_cover` | (W43) | all | ELEC | actual | 8.230548 | 1e-6 |
| 68 | What is the weeks-of-cover target for Electronics? | `weeks_of_cover` | (W43) | all | ELEC | basis | 15.000000 | 1e-6 |
| 69 | What is GMROI for Electronics? | `gmroi` | (W43) | all | ELEC | actual | 1.898065 | 1e-6 |
| 70 | What is the GMROI target for Electronics? | `gmroi` | (W43) | all | ELEC | basis | 2.200000 | 1e-6 |
| 71 | What is availability in Electronics? | `availability_pct` | (W43) | all | ELEC | actual | 0.952592 | 1e-6 |
| 72 | What is the EBITDA flash for Electronics? | `ebitda` | (W43) | all | ELEC | actual | n/a (BLANK) | 0.0051 |
| 73 | What were Electronics net sales last week? | `net_sales` | (W43) | all | ELEC | prev | 6098541.71 | 0.0051 |
| 74 | What were Electronics net sales in month 10? | `net_sales` | FY2026-P10 | all | ELEC | actual | 24056660.40 | 0.0051 |
| 75 | What were Electronics net sales in the same weeks of quarter 4 last year? | `net_sales` | FY2026-Q4 | all | ELEC | ly | 22778202.52 | 0.0051 |
| 76 | What are Toys & leisure net sales for the year to date? | `net_sales` | FY2026 | all | TOYS | actual | 92756376.67 | 0.0051 |
| 77 | What is sell-through across the seasonal categories? | `sell_through_pct` | (W43) | all | APPAREL + HOME + GARDEN + TOYS | actual | 0.631038 | 1e-6 |
| 78 | What is the sell-through target for the seasonal categories? | `sell_through_pct` | (W43) | all | APPAREL + HOME + GARDEN + TOYS | basis | 0.620000 | 1e-6 |
| 79 | What are net sales of fresh, ambient and health & beauty this week? | `net_sales` | (W43) | all | FRESH + AMBIENT + HB | actual | 32823156.61 | 0.0051 |
| 80 | What is the markdown rate of fresh, ambient and health & beauty? | `markdown_pct` | (W43) | all | FRESH + AMBIENT + HB | actual | 0.059686 | 1e-6 |
| 81 | What are Electronics net sales in the Netherlands this week? | `net_sales` | (W43) | nl | ELEC | actual | 1668615.81 | 0.0051 |
| 82 | What are online net sales of Electronics and Toys this week? | `net_sales` | (W43) | online | ELEC + TOYS | actual | 3350269.42 | 0.0051 |
| 83 | What were gross sales this week? | `gross_sales` | (W43) | all | All | actual | 68414126.07 | 0.0051 |
| 84 | How much was given away in markdowns this week? | `markdown` | (W43) | all | All | actual | 6694215.07 | 0.0051 |
| 85 | How much was returned this week? | `returns` | (W43) | all | All | actual | 312048.66 | 0.0051 |
| 86 | What was the cost of goods this week? | `cogs` | (W43) | all | All | actual | 42914970.12 | 0.0051 |
| 87 | How much back margin came in this week? | `back_margin` | (W43) | all | All | actual | 3806233.41 | 0.0051 |
| 88 | What was the front margin in euros this week? | `front_margin` | (W43) | all | All | actual | 18492892.22 | 0.0051 |
| 89 | What is the EBITDA margin month to date? | `ebitda_margin_pct` | (W43) | all | All | actual | 0.063301 | 1e-6 |
| 90 | What are store costs month to date? | `opex_store` | (W43) | all | All | actual | 52380912.55 | 0.0051 |
| 91 | How much stock do we hold including on-order? | `stock_incl_on_order` | (W43) | all | All | actual | 490081019.42 | 0.0051 |
| 92 | What is the forecast weekly cost of goods? | `forecast_cogs` | (W43) | all | All | actual | 43012377.85 | 0.0051 |
| 93 | How many like-for-like stores are there? | `lfl_store_count` | (W43) | all | All | actual | 131 | 0 |
| 94 | What is the non-LFL effect this week? | `nonlfl_effect_pp` | (W43) | all | All | actual | -0.011980 | 1e-6 |
| 95 | How many PO lines were due this week? | `po_lines_due` | (W43) | all | All | actual | 4812 | 0 |
| 96 | How many seasonal units have been sold this season? | `season_units_sold` | (W43) | all | All | actual | 8413000.00 | 0.06 |
| 97 | What is the rolling 52-week front margin? | `gmroi_front_margin_r52w` | (W43) | all | All | actual | 862457667.89 | 0.0051 |

Card-level reading of the same figures (default view): Net sales `[Card Actual]` = 61,407,862.34 vs `[Card Basis]`
62,912,987.45 → `[Card Badness]` 0.023924 → Watch (≤ 0.03); Weeks of cover 11.393953 vs 9.5 → 1.893953 → Watch
(1–2); Markdown 0.097848 vs 0.085 → 0.012848 → Off track (> 0.01); Availability 0.941046 vs 0.97 → 0.028954 → Off track
(> 0.02); EBITDA 15,299,215.89 vs 16,096,880.12 → 0.049554 → Watch (≤ 0.05).

## 3 · Status codes from the control totals (1 On track · 2 Watch · 3 Off track · – N/A; dot 1 green · 2 orange · 3 red)

Read with `[Card Status Code]` per card and `[Status Count *]`, `[Dot Code]`, at each scope (Region) and whole item.

| scope | period key | NET_SALES | TOTAL_MARGIN | WEEKS_OF_COVER | MARKDOWN | AVAILABILITY | EBITDA | LFL_GROWTH | FRONT_GM | SELL_THROUGH | GMROI | SUPPLIER_OTIF | CHANNEL_MIX | on | watch | off | n/a | dot |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ALL | W-FY2026-43 | 2 | 1 | 2 | 3 | 3 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 7 | 3 | 2 | 0 | 2 |
| ALL | W-FY2026-42 | 2 | 2 | 2 | 3 | 3 | 2 | 1 | 2 | 2 | 1 | 1 | 1 | 4 | 6 | 2 | 0 | 2 |
| ALL | P-FY2026-10 | 2 | 1 | 2 | 2 | 3 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 7 | 4 | 1 | 0 | 2 |
| ALL | Q-FY2026-4 | 2 | 1 | 2 | 2 | 3 | 2 | 1 | 1 | 1 | 1 | 1 | 1 | 7 | 4 | 1 | 0 | 2 |
| ALL | FY-FY2026 | 2 | 2 | 2 | 1 | 3 | 3 | 2 | 2 | 1 | 1 | 2 | 1 | 4 | 6 | 2 | 0 | 2 |
| ALL | P-FY2025-10 | – | – | 3 | – | 2 | – | – | – | 2 | – | 2 | – | 0 | 3 | 1 | 8 | 2 |
| ALL | FY-FY2025 | – | – | 2 | – | 1 | – | – | – | – | 1 | 2 | – | 2 | 2 | 0 | 8 | 2 |
| NL | W-FY2026-43 | 3 | 1 | 1 | 3 | 3 | 3 | 2 | 1 | 2 | 1 | 1 | 1 | 6 | 2 | 4 | 0 | 3 |
| NL | W-FY2026-42 | 3 | 2 | 1 | 3 | 3 | 3 | 1 | 2 | 3 | 1 | 1 | 1 | 5 | 2 | 5 | 0 | 3 |
| NL | P-FY2026-10 | 3 | 1 | 1 | 2 | 3 | 3 | 2 | 1 | 2 | 1 | 1 | 1 | 6 | 3 | 3 | 0 | 2 |
| NL | Q-FY2026-4 | 3 | 1 | 1 | 2 | 3 | 3 | 2 | 1 | 2 | 1 | 1 | 1 | 6 | 3 | 3 | 0 | 2 |
| NL | FY-FY2026 | 2 | 2 | 1 | 1 | 3 | 3 | 2 | 1 | 2 | 1 | 2 | 1 | 5 | 5 | 2 | 0 | 2 |
| NL | P-FY2025-10 | – | – | 1 | – | 2 | – | – | – | 2 | – | 2 | – | 1 | 3 | 0 | 8 | 2 |
| NL | FY-FY2025 | – | – | 1 | – | 1 | – | – | – | – | 1 | 2 | – | 3 | 1 | 0 | 8 | 1 |
| BE | W-FY2026-43 | 2 | 1 | 1 | 3 | 3 | 3 | 1 | 1 | 2 | 1 | 1 | 1 | 7 | 2 | 3 | 0 | 2 |
| BE | W-FY2026-42 | 2 | 2 | 1 | 3 | 3 | 2 | 1 | 2 | 3 | 1 | 1 | 1 | 5 | 4 | 3 | 0 | 2 |
| BE | P-FY2026-10 | 2 | 1 | 1 | 2 | 3 | 3 | 1 | 1 | 2 | 1 | 1 | 1 | 7 | 3 | 2 | 0 | 2 |
| BE | Q-FY2026-4 | 2 | 1 | 1 | 2 | 3 | 3 | 1 | 1 | 2 | 1 | 1 | 1 | 7 | 3 | 2 | 0 | 2 |
| BE | FY-FY2026 | 2 | 2 | 1 | 1 | 3 | 3 | 2 | 1 | 2 | 1 | 2 | 1 | 5 | 5 | 2 | 0 | 2 |
| BE | P-FY2025-10 | – | – | 1 | – | 1 | – | – | – | 2 | – | 2 | – | 2 | 2 | 0 | 8 | 2 |
| BE | FY-FY2025 | – | – | 1 | – | 1 | – | – | – | – | 1 | 2 | – | 3 | 1 | 0 | 8 | 1 |
| ONLINE | W-FY2026-43 | 1 | 1 | 3 | 3 | – | 1 | – | 1 | 1 | 1 | 1 | 1 | 8 | 0 | 2 | 2 | 1 |
| ONLINE | W-FY2026-42 | 1 | 1 | 3 | 3 | – | 1 | – | 1 | 1 | 1 | 1 | 1 | 8 | 0 | 2 | 2 | 1 |
| ONLINE | P-FY2026-10 | 1 | 1 | 3 | 3 | – | 1 | – | 1 | 1 | 1 | 1 | 1 | 8 | 0 | 2 | 2 | 1 |
| ONLINE | Q-FY2026-4 | 1 | 1 | 3 | 3 | – | 1 | – | 1 | 1 | 1 | 1 | 1 | 8 | 0 | 2 | 2 | 1 |
| ONLINE | FY-FY2026 | 1 | 2 | 3 | 1 | – | 1 | – | 1 | 1 | 1 | 2 | 1 | 7 | 2 | 1 | 2 | 1 |
| ONLINE | P-FY2025-10 | – | – | 3 | – | – | – | – | – | 1 | – | 2 | – | 1 | 1 | 1 | 9 | 3 |
| ONLINE | FY-FY2025 | – | – | 3 | – | – | – | – | – | – | 1 | 2 | – | 1 | 1 | 1 | 9 | 3 |

Other status facts from the web tests: Online only at W43 → Availability and LFL N/A, counts 8 / 0 / 2, dot green;
Group = B3 → 4 of 12 shown (Availability, Sell-through, GMROI, Supplier OTIF), counts and dot unchanged; Group B1 or
B4 and Lever Sales → Net sales, LFL, Channel mix shown; Electronics → 9 rated / 3 N/A (EBITDA, OTIF, Sell-through);
Electronics + Toys → 10 rated / 2 N/A; FY2025 Q1 → only Weeks of cover, Availability, Supplier OTIF rated.

## 4 · Expected card strings (frozen from the web engine)

Each block is one selection; "value" is `[Card Value Text] & [Card Unit Text]` (as printed, no space), "Δ line" is
`[Card Delta Text]`, "status" `[Card Status Word]`, "basis (ⓘ)" `[Card Basis Label] & " " & [Card Basis Text] &
[Card Basis Unit]`, "sub-title" `[Card Sub]`. Header = `[Hdr Period Bold] & [Hdr Period Rest]` · "vs " &
`[Hdr Compare Label] & [Hdr Compare Suffix]` · `[Hdr Region Bold] & [Hdr Region Rest]`.


#### default (W43 · Budget · All · All categories)

Header: `Week 43 · 19–25 Oct 2026 · vs Budget · All regions & formats` · counts ▲ 7 / ● 3 / ▼ 2 · dot **orange** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | week 43, all channels | `€61.4m` | `−€1.5m (−2.4%) vs budget` | Watch | Budget €62.9m | Y |
| TOTAL_MARGIN | front + back · prov. | `36.3%` | `+0.1 pp vs budget 36.2%` | On track | Budget 36.2% | Y |
| WEEKS_OF_COVER | forward | `11.4wks` | `+1.9 wks vs target 9.5` | Watch | Target 9.5wks | Y |
| MARKDOWN | % of gross sales | `9.8%` | `+1.3 pp vs budget 8.5%` | Off track | Budget 8.5% | Y |
| AVAILABILITY | top-500 SKUs, weighted | `94.1%` | `−2.9 pp vs target 97%` | Off track | Target 97.0% | Y |
| EBITDA | month 10 to date · prov. | `€15.3m` | `−€0.8m (−5.0%) vs budget` | Watch | Budget €16.1m | Y |
| LFL_GROWTH | vs LY week | `+3.4%` | `+0.4 pp vs budget LFL 3.0%` | On track | Budget +3.0% | Y |
| FRONT_GM | % of net sales | `30.1%` | `+0.1 pp vs budget 30.0%` | On track | Budget 30.0% | Y |
| SELL_THROUGH | A/W season to date | `63.1%` | `+1.1 pp vs target 62%` | On track | Target 62.0% | Y |
| GMROI | rolling 12 months | `2.7×` | `+0.2× vs target 2.5×` | On track | Target 2.5× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `95.4%` | `+0.4 pp vs target 95%` | On track | Target 95.0% | Y |
| CHANNEL_MIX | % of net sales vs plan | `68.4% store` | `online +1.9 pp vs plan` | On track | Plan 70.0% store | Y |

#### W43 · Last year

Header: `Week 43 · 19–25 Oct 2026 · vs Last year (same retail week) · All regions & formats` · counts ▲ 7 / ● 3 / ▼ 2 · dot **orange** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | week 43, all channels | `€61.4m` | `+€2.2m (+3.8%) vs LY` | Watch | Budget €62.9m | Y |
| TOTAL_MARGIN | front + back · prov. | `36.3%` | `−0.2 pp vs LY 36.5%` | On track | Budget 36.2% | Y |
| WEEKS_OF_COVER | forward | `11.4wks` | `−1.0 wks vs LY 12.4` | Watch | Target 9.5wks | Y |
| MARKDOWN | % of gross sales | `9.8%` | `+1.9 pp vs LY 7.9%` | Off track | Budget 8.5% | Y |
| AVAILABILITY | top-500 SKUs, weighted | `94.1%` | `−2.9 pp vs LY 97.0%` | Off track | Target 97.0% | Y |
| EBITDA | month 10 to date · prov. | `€15.3m` | `+€1.4m (+10.0%) vs LY` | Watch | Budget €16.1m | Y |
| LFL_GROWTH | vs LY week | `+3.4%` | `n/a vs LY` | On track | Budget +3.0% | Y |
| FRONT_GM | % of net sales | `30.1%` | `−0.3 pp vs LY 30.4%` | On track | Budget 30.0% | Y |
| SELL_THROUGH | A/W season to date | `63.1%` | `+2.4 pp vs LY 60.7%` | On track | Target 62.0% | Y |
| GMROI | rolling 12 months | `2.7×` | `n/a vs LY` | On track | Target 2.5× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `95.4%` | `+1.0 pp vs LY 94.4%` | On track | Target 95.0% | Y |
| CHANNEL_MIX | % of net sales vs plan | `68.4% store` | `online +1.5 pp vs LY` | On track | Plan 70.0% store | Y |

#### W43 · Previous

Header: `Week 43 · 19–25 Oct 2026 · vs Previous week · All regions & formats` · counts ▲ 7 / ● 3 / ▼ 2 · dot **orange** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | week 43, all channels | `€61.4m` | `+€2.0m (+3.4%) vs prev. wk` | Watch | Budget €62.9m | Y |
| TOTAL_MARGIN | front + back · prov. | `36.3%` | `+0.3 pp vs prev. wk 36.0%` | On track | Budget 36.2% | Y |
| WEEKS_OF_COVER | forward | `11.4wks` | `+0.3 wks vs prev. wk 11.1` | Watch | Target 9.5wks | Y |
| MARKDOWN | % of gross sales | `9.8%` | `+0.2 pp vs prev. wk 9.6%` | Off track | Budget 8.5% | Y |
| AVAILABILITY | top-500 SKUs, weighted | `94.1%` | `−0.2 pp vs prev. wk 94.3%` | Off track | Target 97.0% | Y |
| EBITDA | month 10 to date · prov. | `€15.3m` | `−€0.0m (−0.0%) vs prev. mth` | Watch | Budget €16.1m | Y |
| LFL_GROWTH | vs LY week | `+3.4%` | `+0.3 pp vs prev. wk 3.1%` | On track | Budget +3.0% | Y |
| FRONT_GM | % of net sales | `30.1%` | `+0.3 pp vs prev. wk 29.8%` | On track | Budget 30.0% | Y |
| SELL_THROUGH | A/W season to date | `63.1%` | `+4.7 pp vs prev. wk 58.4%` | On track | Target 62.0% | Y |
| GMROI | rolling 12 months | `2.7×` | `+0.0× vs prev. wk 2.7×` | On track | Target 2.5× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `95.4%` | `+0.4 pp vs prev. wk 95.0%` | On track | Target 95.0% | Y |
| CHANNEL_MIX | % of net sales vs plan | `68.4% store` | `online +0.2 pp vs prev. wk` | On track | Plan 70.0% store | Y |

#### P10 · Budget

Header: `Month 10 · 28 Sep–25 Oct 2026 · vs Budget · All regions & formats` · counts ▲ 7 / ● 4 / ▼ 1 · dot **orange** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | month 10, all channels | `€241.7m` | `−€2.4m (−1.0%) vs budget` | Watch | Budget €244.1m | Y |
| TOTAL_MARGIN | front + back · prov. | `36.3%` | `+0.1 pp vs budget 36.2%` | On track | Budget 36.2% | Y |
| WEEKS_OF_COVER | forward | `11.4wks` | `+1.9 wks vs target 9.5` | Watch | Target 9.5wks | Y |
| MARKDOWN | % of gross sales | `9.4%` | `+0.9 pp vs budget 8.5%` | Watch | Budget 8.5% | Y |
| AVAILABILITY | top-500 SKUs, weighted | `94.1%` | `−2.9 pp vs target 97%` | Off track | Target 97.0% | Y |
| EBITDA | month 10 · prov. | `€15.3m` | `−€0.8m (−5.0%) vs budget` | Watch | Budget €16.1m | Y |
| LFL_GROWTH | vs LY month | `+3.3%` | `+0.3 pp vs budget LFL 3.0%` | On track | Budget +3.0% | Y |
| FRONT_GM | % of net sales | `30.1%` | `+0.2 pp vs budget 30.0%` | On track | Budget 30.0% | Y |
| SELL_THROUGH | A/W season to date | `63.1%` | `+1.1 pp vs target 62%` | On track | Target 62.0% | Y |
| GMROI | rolling 12 months | `2.7×` | `+0.2× vs target 2.5×` | On track | Target 2.5× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `95.2%` | `+0.2 pp vs target 95%` | On track | Target 95.0% | Y |
| CHANNEL_MIX | % of net sales vs plan | `68.6% store` | `store −1.6 pp vs plan` | On track | Plan 70.2% store | Y |

#### Q4 to date · Last year

Header: `Quarter 4 to date · 28 Sep–25 Oct 2026 · vs Last year (same retail weeks) · All regions & formats` · counts ▲ 7 / ● 4 / ▼ 1 · dot **orange** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | quarter 4 to date, all channels | `€241.7m` | `+€9.8m (+4.2%) vs LY` | Watch | Budget €244.1m | Y |
| TOTAL_MARGIN | front + back · prov. | `36.3%` | `−0.1 pp vs LY 36.4%` | On track | Budget 36.2% | Y |
| WEEKS_OF_COVER | forward | `11.4wks` | `−1.0 wks vs LY 12.4` | Watch | Target 9.5wks | Y |
| MARKDOWN | % of gross sales | `9.4%` | `+1.7 pp vs LY 7.7%` | Watch | Budget 8.5% | Y |
| AVAILABILITY | top-500 SKUs, weighted | `94.1%` | `−2.9 pp vs LY 97.0%` | Off track | Target 97.0% | Y |
| EBITDA | quarter 4 to date · prov. | `€15.3m` | `+€1.4m (+10.0%) vs LY` | Watch | Budget €16.1m | Y |
| LFL_GROWTH | vs LY quarter | `+3.3%` | `n/a vs LY` | On track | Budget +3.0% | Y |
| FRONT_GM | % of net sales | `30.1%` | `−0.2 pp vs LY 30.3%` | On track | Budget 30.0% | Y |
| SELL_THROUGH | A/W season to date | `63.1%` | `+2.4 pp vs LY 60.7%` | On track | Target 62.0% | Y |
| GMROI | rolling 12 months | `2.7×` | `n/a vs LY` | On track | Target 2.5× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `95.2%` | `+0.6 pp vs LY 94.6%` | On track | Target 95.0% | Y |
| CHANNEL_MIX | % of net sales vs plan | `68.6% store` | `online +1.3 pp vs LY` | On track | Plan 70.2% store | Y |

#### Q4 to date · Previous

Header: `Quarter 4 to date · 28 Sep–25 Oct 2026 · vs Previous quarter · All regions & formats` · counts ▲ 7 / ● 4 / ▼ 1 · dot **orange** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | quarter 4 to date, all channels | `€241.7m` | `+€20.4m (+9.2%) vs prev. qtr` | Watch | Budget €244.1m | Y |
| TOTAL_MARGIN | front + back · prov. | `36.3%` | `+0.3 pp vs prev. qtr 36.0%` | On track | Budget 36.2% | Y |
| WEEKS_OF_COVER | forward | `11.4wks` | `+2.6 wks vs prev. qtr 8.8` | Watch | Target 9.5wks | Y |
| MARKDOWN | % of gross sales | `9.4%` | `+0.7 pp vs prev. qtr 8.7%` | Watch | Budget 8.5% | Y |
| AVAILABILITY | top-500 SKUs, weighted | `94.1%` | `−2.7 pp vs prev. qtr 96.8%` | Off track | Target 97.0% | Y |
| EBITDA | quarter 4 to date · prov. | `€15.3m` | `+€2.3m (+17.8%) vs prev. qtr` | Watch | Budget €16.1m | Y |
| LFL_GROWTH | vs LY quarter | `+3.3%` | `+0.6 pp vs prev. qtr 2.7%` | On track | Budget +3.0% | Y |
| FRONT_GM | % of net sales | `30.1%` | `+0.2 pp vs prev. qtr 29.9%` | On track | Budget 30.0% | Y |
| SELL_THROUGH | A/W season to date | `63.1%` | `n/a vs prev. qtr` | On track | Target 62.0% | Y |
| GMROI | rolling 12 months | `2.7×` | `+0.0× vs prev. qtr 2.7×` | On track | Target 2.5× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `95.2%` | `+0.4 pp vs prev. qtr 94.8%` | On track | Target 95.0% | Y |
| CHANNEL_MIX | % of net sales vs plan | `68.6% store` | `online +0.9 pp vs prev. qtr` | On track | Plan 70.2% store | Y |

#### FY2026 to date · Budget

Header: `FY2026 to date · 29 Dec 2025–25 Oct 2026 · vs Budget · All regions & formats` · counts ▲ 4 / ● 6 / ▼ 2 · dot **orange** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | FY2026 to date, all channels | `€2,318m` | `−€21.3m (−0.9%) vs budget` | Watch | Budget €2,340m | Y |
| TOTAL_MARGIN | front + back · prov. | `36.1%` | `−0.1 pp vs budget 36.2%` | Watch | Budget 36.2% | Y |
| WEEKS_OF_COVER | forward | `11.4wks` | `+1.9 wks vs target 9.5` | Watch | Target 9.5wks | Y |
| MARKDOWN | % of gross sales | `8.4%` | `−0.1 pp vs budget 8.6%` | On track | Budget 8.6% | Y |
| AVAILABILITY | top-500 SKUs, weighted | `94.1%` | `−2.9 pp vs target 97%` | Off track | Target 97.0% | Y |
| EBITDA | FY2026 to date · prov. | `€137.0m` | `−€13.4m (−8.9%) vs budget` | Off track | Budget €150.5m | Y |
| LFL_GROWTH | vs LY year | `+2.8%` | `−0.3 pp vs budget LFL 3.0%` | Watch | Budget +3.0% | Y |
| FRONT_GM | % of net sales | `30.0%` | `−0.0 pp vs budget 30.0%` | Watch | Budget 30.0% | Y |
| SELL_THROUGH | A/W season to date | `63.1%` | `+1.1 pp vs target 62%` | On track | Target 62.0% | Y |
| GMROI | rolling 12 months | `2.7×` | `+0.2× vs target 2.5×` | On track | Target 2.5× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `94.8%` | `−0.2 pp vs target 95%` | Watch | Target 95.0% | Y |
| CHANNEL_MIX | % of net sales vs plan | `70.1% store` | `store −0.6 pp vs plan` | On track | Plan 70.7% store | Y |

#### FY2025 · Budget

Header: `FY2025 · 30 Dec 2024–28 Dec 2025 · vs Budget · All regions & formats` · counts ▲ 2 / ● 2 / ▼ 0 · dot **orange** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | FY2025, all channels | `€2,777m` | `n/a vs budget` | N/A | Budget n/a | Y |
| TOTAL_MARGIN | front + back · prov. | `36.2%` | `n/a vs budget` | N/A | Budget n/a | Y |
| WEEKS_OF_COVER | forward | `11.4wks` | `+1.9 wks vs target 9.5` | Watch | Target 9.5wks | Y |
| MARKDOWN | % of gross sales | `8.0%` | `n/a vs budget` | N/A | Budget n/a | Y |
| AVAILABILITY | top-500 SKUs, weighted | `97.1%` | `+0.1 pp vs target 97%` | On track | Target 97.0% | Y |
| EBITDA | FY2025 · prov. | `€168.5m` | `n/a vs budget` | N/A | Budget n/a | Y |
| LFL_GROWTH | vs LY year | `n/a` | `n/a vs budget LFL` | N/A | Budget n/a | Y |
| FRONT_GM | % of net sales | `30.2%` | `n/a vs budget` | N/A | Budget n/a | Y |
| SELL_THROUGH | A/W season to date | `n/a` | `n/a vs target` | N/A | Target n/a | Y |
| GMROI | rolling 12 months | `2.6×` | `+0.1× vs target 2.5×` | On track | Target 2.5× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `94.4%` | `−0.6 pp vs target 95%` | Watch | Target 95.0% | Y |
| CHANNEL_MIX | % of net sales vs plan | `70.5% store` | `n/a vs plan` | N/A | Plan n/a | Y |

#### FY2025-P10 · Budget

Header: `Month 10 FY2025 · 29 Sep–26 Oct 2025 · vs Budget · All regions & formats` · counts ▲ 0 / ● 3 / ▼ 1 · dot **orange** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | month 10 FY2025, all channels | `€231.9m` | `n/a vs budget` | N/A | Budget n/a | Y |
| TOTAL_MARGIN | front + back · prov. | `36.4%` | `n/a vs budget` | N/A | Budget n/a | Y |
| WEEKS_OF_COVER | forward | `12.4wks` | `+2.9 wks vs target 9.5` | Off track | Target 9.5wks | Y |
| MARKDOWN | % of gross sales | `7.7%` | `n/a vs budget` | N/A | Budget n/a | Y |
| AVAILABILITY | top-500 SKUs, weighted | `97.0%` | `−0.0 pp vs target 97%` | Watch | Target 97.0% | Y |
| EBITDA | month 10 FY2025 · prov. | `€13.9m` | `n/a vs budget` | N/A | Budget n/a | Y |
| LFL_GROWTH | vs LY month | `n/a` | `n/a vs budget LFL` | N/A | Budget n/a | Y |
| FRONT_GM | % of net sales | `30.3%` | `n/a vs budget` | N/A | Budget n/a | Y |
| SELL_THROUGH | A/W season to date | `60.7%` | `−1.3 pp vs target 62%` | Watch | Target 62.0% | Y |
| GMROI | rolling 12 months | `n/a` | `n/a vs target` | N/A | Target n/a | Y |
| SUPPLIER_OTIF | inbound, PO lines | `94.6%` | `−0.4 pp vs target 95%` | Watch | Target 95.0% | Y |
| CHANNEL_MIX | % of net sales vs plan | `69.5% store` | `n/a vs plan` | N/A | Plan n/a | Y |

#### W43 · Netherlands

Header: `Week 43 · 19–25 Oct 2026 · vs Budget · Netherlands · all formats` · counts ▲ 6 / ● 2 / ▼ 4 · dot **red** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | week 43, Netherlands | `€23.0m` | `−€1.9m (−7.5%) vs budget` | Off track | Budget €24.9m | Y |
| TOTAL_MARGIN | front + back · prov. | `38.4%` | `+0.1 pp vs budget 38.3%` | On track | Budget 38.3% | Y |
| WEEKS_OF_COVER | forward | `8.1wks` | `−0.8 wks vs target 8.9` | On track | Target 8.9wks | Y |
| MARKDOWN | % of gross sales | `10.3%` | `+1.3 pp vs budget 9.1%` | Off track | Budget 9.1% | Y |
| AVAILABILITY | top-500 SKUs, weighted | `93.5%` | `−3.5 pp vs target 97%` | Off track | Target 97.0% | Y |
| EBITDA | month 10 to date · prov. | `€4.5m` | `−€0.9m (−17.0%) vs budget` | Off track | Budget €5.4m | Y |
| LFL_GROWTH | vs LY week | `+2.9%` | `−0.4 pp vs budget LFL 3.3%` | Watch | Budget +3.3% | Y |
| FRONT_GM | % of net sales | `32.6%` | `+0.1 pp vs budget 32.4%` | On track | Budget 32.4% | Y |
| SELL_THROUGH | A/W season to date | `60.0%` | `−2.0 pp vs target 62%` | Watch | Target 62.0% | Y |
| GMROI | rolling 12 months | `3.6×` | `+1.1× vs target 2.5×` | On track | Target 2.5× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `95.4%` | `+0.4 pp vs target 95%` | On track | Target 95.0% | Y |
| CHANNEL_MIX | % of net sales vs plan | `100.0% store` | `store +0.0 pp vs plan` | On track | Plan 100.0% store | Y |

#### W43 · Belgium

Header: `Week 43 · 19–25 Oct 2026 · vs Budget · Belgium · all formats` · counts ▲ 7 / ● 2 / ▼ 3 · dot **orange** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | week 43, Belgium | `€19.0m` | `−€0.2m (−0.8%) vs budget` | Watch | Budget €19.2m | Y |
| TOTAL_MARGIN | front + back · prov. | `38.3%` | `+0.0 pp vs budget 38.3%` | On track | Budget 38.3% | Y |
| WEEKS_OF_COVER | forward | `8.2wks` | `−0.8 wks vs target 9.0` | On track | Target 9.0wks | Y |
| MARKDOWN | % of gross sales | `10.5%` | `+1.4 pp vs budget 9.1%` | Off track | Budget 9.1% | Y |
| AVAILABILITY | top-500 SKUs, weighted | `94.9%` | `−2.1 pp vs target 97%` | Off track | Target 97.0% | Y |
| EBITDA | month 10 to date · prov. | `€4.5m` | `−€0.4m (−8.2%) vs budget` | Off track | Budget €4.9m | Y |
| LFL_GROWTH | vs LY week | `+4.0%` | `+1.3 pp vs budget LFL 2.7%` | On track | Budget +2.7% | Y |
| FRONT_GM | % of net sales | `32.5%` | `+0.0 pp vs budget 32.5%` | On track | Budget 32.5% | Y |
| SELL_THROUGH | A/W season to date | `60.2%` | `−1.8 pp vs target 62%` | Watch | Target 62.0% | Y |
| GMROI | rolling 12 months | `3.6×` | `+1.1× vs target 2.5×` | On track | Target 2.5× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `95.4%` | `+0.4 pp vs target 95%` | On track | Target 95.0% | Y |
| CHANNEL_MIX | % of net sales vs plan | `100.0% store` | `store +0.0 pp vs plan` | On track | Plan 100.0% store | Y |

#### W43 · Online only

Header: `Week 43 · 19–25 Oct 2026 · vs Budget · Online only` · counts ▲ 8 / ● 0 / ▼ 2 · dot **green** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | week 43, online | `€12.2m` | `+€0.9m (+7.7%) vs budget` | On track | Budget €11.3m | Y |
| TOTAL_MARGIN | front + back · prov. | `38.1%` | `+0.4 pp vs budget 37.6%` | On track | Budget 37.6% | Y |
| WEEKS_OF_COVER | forward | `5.1wks` | `−6.8 wks vs target 12.0` | Off track | Target 12.0wks | Y |
| MARKDOWN | % of gross sales | `12.0%` | `+1.5 pp vs budget 10.5%` | Off track | Budget 10.5% | Y |
| AVAILABILITY | top-500 SKUs, weighted | `n/a` | `n/a vs target` | N/A | Target 97.0% | Y |
| EBITDA | month 10 to date · prov. | `€12.4m` | `+€0.6m (+5.4%) vs budget` | On track | Budget €11.8m | Y |
| LFL_GROWTH | vs LY week | `n/a` | `n/a vs budget LFL` | N/A | Budget n/a | Y |
| FRONT_GM | % of net sales | `31.8%` | `+0.5 pp vs budget 31.3%` | On track | Budget 31.3% | Y |
| SELL_THROUGH | A/W season to date | `72.5%` | `+10.5 pp vs target 62%` | On track | Target 62.0% | Y |
| GMROI | rolling 12 months | `6.1×` | `+3.6× vs target 2.5×` | On track | Target 2.5× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `95.4%` | `+0.4 pp vs target 95%` | On track | Target 95.0% | Y |
| CHANNEL_MIX | % of net sales vs plan | `0.0% store` | `store +0.0 pp vs plan` | On track | Plan 0.0% store | Y |

#### W43 · Electronics

Header: `Week 43 · 19–25 Oct 2026 · vs Budget · All regions & formats · Electronics` · counts ▲ 3 / ● 5 / ▼ 1 · dot **orange** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | week 43, all channels | `€6.2m` | `−€0.2m (−2.5%) vs budget` | Watch | Budget €6.4m | Y |
| TOTAL_MARGIN | front + back · prov. | `24.8%` | `−0.6 pp vs budget 25.3%` | Watch | Budget 25.3% | Y |
| WEEKS_OF_COVER | forward | `8.2wks` | `−6.8 wks vs target 15.0` | Off track | Target 15.0wks | Y |
| MARKDOWN | % of gross sales | `8.9%` | `−0.2 pp vs budget 9.1%` | On track | Budget 9.1% | Y |
| AVAILABILITY | top-500 SKUs, weighted | `95.3%` | `−1.7 pp vs target 97%` | Watch | Target 97.0% | Y |
| EBITDA | month 10 to date · prov. | `–` | `n/a by category` | N/A | Budget n/a | Y |
| LFL_GROWTH | vs LY week | `+3.5%` | `+0.5 pp vs budget LFL 3.0%` | On track | Budget +3.0% | Y |
| FRONT_GM | % of net sales | `16.3%` | `−0.7 pp vs budget 17.0%` | Watch | Budget 17.0% | Y |
| SELL_THROUGH | A/W season to date | `–` | `n/a by category` | N/A | Target n/a | Y |
| GMROI | rolling 12 months | `1.9×` | `−0.3× vs target 2.2×` | Watch | Target 2.2× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `–` | `n/a by category` | N/A | Target n/a | Y |
| CHANNEL_MIX | % of net sales vs plan | `50.3% store` | `online +1.4 pp vs plan` | On track | Plan 51.6% store | Y |

#### W43 · Electronics + Toys

Header: `Week 43 · 19–25 Oct 2026 · vs Budget · All regions & formats · Electronics & Toys & leisure` · counts ▲ 3 / ● 6 / ▼ 1 · dot **orange** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | week 43, all channels | `€10.2m` | `−€0.2m (−2.1%) vs budget` | Watch | Budget €10.5m | Y |
| TOTAL_MARGIN | front + back · prov. | `30.5%` | `−0.2 pp vs budget 30.7%` | Watch | Budget 30.7% | Y |
| WEEKS_OF_COVER | forward | `10.9wks` | `−4.5 wks vs target 15.4` | Off track | Target 15.4wks | Y |
| MARKDOWN | % of gross sales | `9.4%` | `−0.2 pp vs budget 9.6%` | On track | Budget 9.6% | Y |
| AVAILABILITY | top-500 SKUs, weighted | `95.3%` | `−1.7 pp vs target 97%` | Watch | Target 97.0% | Y |
| EBITDA | month 10 to date · prov. | `–` | `n/a by category` | N/A | Budget n/a | Y |
| LFL_GROWTH | vs LY week | `+4.0%` | `+1.0 pp vs budget LFL 3.0%` | On track | Budget +3.0% | Y |
| FRONT_GM | % of net sales | `23.1%` | `−0.2 pp vs budget 23.3%` | Watch | Budget 23.3% | Y |
| SELL_THROUGH | A/W season to date | `61.0%` | `−1.0 pp vs target 62%` | Watch | Target 62.0% | Y |
| GMROI | rolling 12 months | `2.0×` | `−0.3× vs target 2.2×` | Watch | Target 2.2× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `–` | `n/a by category` | N/A | Target n/a | Y |
| CHANNEL_MIX | % of net sales vs plan | `57.4% store` | `online +1.5 pp vs plan` | On track | Plan 58.8% store | Y |

#### W43 · Fresh + Ambient + H&B

Header: `Week 43 · 19–25 Oct 2026 · vs Budget · All regions & formats · 3 categories` · counts ▲ 6 / ● 2 / ▼ 1 · dot **green** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | week 43, all channels | `€32.8m` | `−€0.9m (−2.7%) vs budget` | Watch | Budget €33.7m | Y |
| TOTAL_MARGIN | front + back · prov. | `33.7%` | `+0.0 pp vs budget 33.7%` | On track | Budget 33.7% | Y |
| WEEKS_OF_COVER | forward | `6.4wks` | `+1.2 wks vs target 5.2` | Watch | Target 5.2wks | Y |
| MARKDOWN | % of gross sales | `6.0%` | `−0.2 pp vs budget 6.1%` | On track | Budget 6.1% | Y |
| AVAILABILITY | top-500 SKUs, weighted | `93.4%` | `−3.6 pp vs target 97%` | Off track | Target 97.0% | Y |
| EBITDA | month 10 to date · prov. | `–` | `n/a by category` | N/A | Budget n/a | Y |
| LFL_GROWTH | vs LY week | `+3.1%` | `+0.1 pp vs budget LFL 3.0%` | On track | Budget +3.0% | Y |
| FRONT_GM | % of net sales | `27.3%` | `+0.0 pp vs budget 27.3%` | On track | Budget 27.3% | Y |
| SELL_THROUGH | A/W season to date | `–` | `n/a by category` | N/A | Target n/a | Y |
| GMROI | rolling 12 months | `4.1×` | `+0.3× vs target 3.8×` | On track | Target 3.8× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `–` | `n/a by category` | N/A | Target n/a | Y |
| CHANNEL_MIX | % of net sales vs plan | `73.7% store` | `online +1.9 pp vs plan` | On track | Plan 75.3% store | Y |

#### W35 · Previous (EBITDA n/a)

Header: `Week 35 · 24–30 Aug 2026 · vs Previous week · All regions & formats` · counts ▲ 4 / ● 7 / ▼ 1 · dot **orange** · summary `12 of 12 metrics · All`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | week 35, all channels | `€56.4m` | `−€1.1m (−2.0%) vs prev. wk` | Watch | Budget €57.2m | Y |
| TOTAL_MARGIN | front + back · prov. | `35.8%` | `−0.3 pp vs prev. wk 36.1%` | Watch | Budget 36.1% | Y |
| WEEKS_OF_COVER | forward | `10.1wks` | `+0.2 wks vs prev. wk 9.9` | On track | Target 9.5wks | Y |
| MARKDOWN | % of gross sales | `8.6%` | `+0.4 pp vs prev. wk 8.2%` | Watch | Budget 8.5% | Y |
| AVAILABILITY | top-500 SKUs, weighted | `95.9%` | `−0.3 pp vs prev. wk 96.2%` | Watch | Target 97.0% | Y |
| EBITDA | month 8 to date · prov. | `€18.6m` | `n/a vs prev. mth` | Watch | Budget €18.8m | Y |
| LFL_GROWTH | vs LY week | `+2.6%` | `−0.5 pp vs prev. wk 3.1%` | Watch | Budget +3.0% | Y |
| FRONT_GM | % of net sales | `29.7%` | `−0.3 pp vs prev. wk 30.0%` | Watch | Budget 29.9% | Y |
| SELL_THROUGH | A/W season to date | `31.2%` | `+4.8 pp vs prev. wk 26.4%` | Off track | Target 62.0% | Y |
| GMROI | rolling 12 months | `2.7×` | `+0.0× vs prev. wk 2.7×` | On track | Target 2.5× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `95.3%` | `+0.5 pp vs prev. wk 94.8%` | On track | Target 95.0% | Y |
| CHANNEL_MIX | % of net sales vs plan | `69.2% store` | `online +0.1 pp vs prev. wk` | On track | Plan 70.0% store | Y |

#### W43 · Group B3

Header: `Week 43 · 19–25 Oct 2026 · vs Budget · All regions & formats` · counts ▲ 7 / ● 3 / ▼ 2 · dot **orange** · summary `4 of 12 metrics · B3 stock & supply`

| card | sub-title | value | Δ line | status | basis (ⓘ) | revealed |
|---|---|---|---|---|---|:-:|
| NET_SALES | week 43, all channels | `€61.4m` | `−€1.5m (−2.4%) vs budget` | Watch | Budget €62.9m | faded |
| TOTAL_MARGIN | front + back · prov. | `36.3%` | `+0.1 pp vs budget 36.2%` | On track | Budget 36.2% | faded |
| WEEKS_OF_COVER | forward | `11.4wks` | `+1.9 wks vs target 9.5` | Watch | Target 9.5wks | faded |
| MARKDOWN | % of gross sales | `9.8%` | `+1.3 pp vs budget 8.5%` | Off track | Budget 8.5% | faded |
| AVAILABILITY | top-500 SKUs, weighted | `94.1%` | `−2.9 pp vs target 97%` | Off track | Target 97.0% | Y |
| EBITDA | month 10 to date · prov. | `€15.3m` | `−€0.8m (−5.0%) vs budget` | Watch | Budget €16.1m | faded |
| LFL_GROWTH | vs LY week | `+3.4%` | `+0.4 pp vs budget LFL 3.0%` | On track | Budget +3.0% | faded |
| FRONT_GM | % of net sales | `30.1%` | `+0.1 pp vs budget 30.0%` | On track | Budget 30.0% | faded |
| SELL_THROUGH | A/W season to date | `63.1%` | `+1.1 pp vs target 62%` | On track | Target 62.0% | Y |
| GMROI | rolling 12 months | `2.7×` | `+0.2× vs target 2.5×` | On track | Target 2.5× | Y |
| SUPPLIER_OTIF | inbound, PO lines | `95.4%` | `+0.4 pp vs target 95%` | On track | Target 95.0% | Y |
| CHANNEL_MIX | % of net sales vs plan | `68.4% store` | `online +1.9 pp vs plan` | On track | Plan 70.0% store | faded |

### ⓘ pop-up strings

`[Explain Eyebrow]`, `[Explain Delta]`, `[Explain Stat k Label]: [Explain Stat k Value]`, the worked example =
`[Example Pre] & [Example Bold] & [Example Post]`, footer note `[Explain Updated]`.


#### default (W43 · Budget · All · All categories)

| card | eyebrow | ⓘ Δ | stat 1 | stat 2 | stat 3 | worked example | footer note |
|---|---|---|---|---|---|---|---|
| NET_SALES | Tier 1 · week 43, all channels | `−€1.5m (−2.4%) vs budget` | vs LY week: `+3.8%` | Month 10 to date: `€241.7m` | Year to date: `€2,318m` | €68.4m at ticket − €6.7m markdowns and discounts − €0.3m returns = €61.4m. Budget was €62.9m, so −€1.5m (−2.4%). | Updated Mon 05:12 |
| TOTAL_MARGIN | Tier 1 · front + back · prov. | `+0.1 pp vs budget 36.2%` | Front margin: `30.1%` | Back margin: `6.2%` | vs LY week: `−0.2 pp` | Front €18.5m + back €3.8m = €22.3m; ÷ €61.4m = 36.3%. Budget 36.2%, so +0.1 pp. | Provisional · true-up 10 Nov |
| WEEKS_OF_COVER | Tier 1 · forward | `+1.9 wks vs target 9.5` | On hand at cost: `€402m` | On order: `€88m` | vs last week: `+0.3 wks` | €490m stock incl. on-order ÷ €43.0m forecast weekly cost of goods = 11.4 weeks. Target 9.5, so +1.9 → Watch. | Updated Mon 05:12 |
| MARKDOWN | Explains Tier 1 · % of gross sales | `+1.3 pp vs budget 8.5%` | Markdown value: `€6.7m` | vs LY week: `+1.9 pp` | Budget: `8.5%` | €6.7m markdown ÷ €68.4m gross sales = 9.8%. Budget 8.5%, so +1.3 pp; lower is better → Off track. | Updated Mon 05:12 |
| AVAILABILITY | Explains Tier 1 · top-500 SKUs, weighted | `−2.9 pp vs target 97%` | vs last week: `−0.2 pp` | Netherlands · Belgium: `93.5% · 94.9%` | Lowest category: `Fresh food 90.0%` | 500 SKUs × 142 stores × 7 days = 497,000 ranged; 467,700 in stock → 94.1%. Target 97%, so −2.9 pp → Off track. | Updated Mon 05:12 |
| EBITDA | Explains Tier 1 · month 10 to date · prov. | `−€0.8m (−5.0%) vs budget` | EBITDA margin: `6.3%` | Budget margin: `6.6%` | Store costs vs plan: `−0.0 pp` | €87.7m margin − €2.2m shrink − €52.4m store − €11.6m central − €6.2m fulfilment = €15.3m (6.3% of €241.7m). Budget €16.1m, so −€0.8m (−5.0%). | Provisional · weekly flash |
| LFL_GROWTH | Explains Tier 1 · vs LY week | `+0.4 pp vs budget LFL 3.0%` | LFL stores: `131 of 142` | Non-LFL effect: `−1.2 pp` | Online LFL: `+12.1%` | 131 LFL stores: €39.0m ÷ €37.7m − 1 = +3.4%. Budget LFL 3.0%, so +0.4 pp. | Updated Mon 05:12 |
| FRONT_GM | Explains Tier 1 · % of net sales | `+0.1 pp vs budget 30.0%` | Cost of goods: `€42.9m` | Front margin: `€18.5m` | vs LY week: `−0.3 pp` | €61.4m − €42.9m cost of goods = €18.5m; ÷ €61.4m = 30.1%. Budget 30.0%, so +0.1 pp. | Updated Mon 05:12 |
| SELL_THROUGH | Explains Tier 1 · A/W season to date | `+1.1 pp vs target 62%` | Apparel: `58%` | Home & kitchen: `69%` | vs LY season: `+2.4 pp` | 8.4m units sold ÷ (4.2m opening + 9.1m received = 13.3m) = 63.1%. Target 62% at week 12 of 20, so +1.1 pp. | Updated weekly |
| GMROI | Explains Tier 1 · rolling 12 months | `+0.2× vs target 2.5×` | R52W front margin: `€862m` | Average stock at cost: `€319m` | H&B · Electronics: `4.1× · 1.9×` | €862m front margin ÷ €319m average stock = 2.7×. Target 2.5×, so +0.2×. | Updated weekly |
| SUPPLIER_OTIF | Explains Tier 1 · inbound, PO lines | `+0.4 pp vs target 95%` | PO lines due: `4,812` | vs last week: `+0.4 pp` | Suppliers below 85%: `2` | 4,591 lines on time and in full ÷ 4,812 lines due = 95.4%. Target 95%, so +0.4 pp. | Updated Mon 05:12 |
| CHANNEL_MIX | Explains Tier 1 · % of net sales vs plan | `online +1.9 pp vs plan` | Store: `68.4% · −1.6 pp` | Online: `19.9% · +1.9 pp` | Wholesale: `11.7% · −0.3 pp` | Store €42.0m, online €12.2m, wholesale €7.2m of €61.4m → 68.4% / 19.9% / 11.7%. Plan 70 / 18 / 12, so online +1.9 pp. | Updated Mon 05:12 |

#### P10 · Budget

| card | eyebrow | ⓘ Δ | stat 1 | stat 2 | stat 3 | worked example | footer note |
|---|---|---|---|---|---|---|---|
| NET_SALES | Tier 1 · month 10, all channels | `−€2.4m (−1.0%) vs budget` | vs LY month: `+4.2%` | Quarter 4 to date: `€241.7m` | Year to date: `€2,318m` | €268.2m at ticket − €25.3m markdowns and discounts − €1.2m returns = €241.7m. Budget was €244.1m, so −€2.4m (−1.0%). | Updated Mon 05:12 |
| TOTAL_MARGIN | Tier 1 · front + back · prov. | `+0.1 pp vs budget 36.2%` | Front margin: `30.1%` | Back margin: `6.2%` | vs LY month: `−0.1 pp` | Front €72.8m + back €14.9m = €87.7m; ÷ €241.7m = 36.3%. Budget 36.2%, so +0.1 pp. | Provisional · true-up 10 Nov |
| WEEKS_OF_COVER | Tier 1 · forward | `+1.9 wks vs target 9.5` | On hand at cost: `€402m` | On order: `€88m` | vs prev. mth: `+0.6 wks` | €490m stock incl. on-order ÷ €43.0m forecast weekly cost of goods = 11.4 weeks. Target 9.5, so +1.9 → Watch. | Updated Mon 05:12 |
| MARKDOWN | Explains Tier 1 · % of gross sales | `+0.9 pp vs budget 8.5%` | Markdown value: `€25.3m` | vs LY month: `+1.7 pp` | Budget: `8.5%` | €25.3m markdown ÷ €268.2m gross sales = 9.4%. Budget 8.5%, so +0.9 pp; lower is better → Watch. | Updated Mon 05:12 |
| AVAILABILITY | Explains Tier 1 · top-500 SKUs, weighted | `−2.9 pp vs target 97%` | vs prev. mth: `−1.1 pp` | Netherlands · Belgium: `93.5% · 94.9%` | Lowest category: `Fresh food 90.0%` | Last week of the month: 500 SKUs × 142 stores × 7 days = 497,000 ranged; 467,700 in stock → 94.1%. Target 97%, so −2.9 pp → Off track. | Updated Mon 05:12 |
| EBITDA | Explains Tier 1 · month 10 · prov. | `−€0.8m (−5.0%) vs budget` | EBITDA margin: `6.3%` | Budget margin: `6.6%` | Store costs vs plan: `−0.0 pp` | €87.7m margin − €2.2m shrink − €52.4m store − €11.6m central − €6.2m fulfilment = €15.3m (6.3% of €241.7m). Budget €16.1m, so −€0.8m (−5.0%). | Provisional · weekly flash |
| LFL_GROWTH | Explains Tier 1 · vs LY month | `+0.3 pp vs budget LFL 3.0%` | LFL stores: `131 of 142` | Non-LFL effect: `−0.5 pp` | Online LFL: `+11.9%` | 131 LFL stores: €154.9m ÷ €149.9m − 1 = +3.3%. Budget LFL 3.0%, so +0.3 pp. | Updated Mon 05:12 |
| FRONT_GM | Explains Tier 1 · % of net sales | `+0.2 pp vs budget 30.0%` | Cost of goods: `€168.9m` | Front margin: `€72.8m` | vs LY month: `−0.2 pp` | €241.7m − €168.9m cost of goods = €72.8m; ÷ €241.7m = 30.1%. Budget 30.0%, so +0.2 pp. | Updated Mon 05:12 |
| SELL_THROUGH | Explains Tier 1 · A/W season to date | `+1.1 pp vs target 62%` | Apparel: `58%` | Home & kitchen: `69%` | vs LY season: `+2.4 pp` | 8.4m units sold ÷ (4.2m opening + 9.1m received = 13.3m) = 63.1%. Target 62% at week 12 of 20, so +1.1 pp. | Updated weekly |
| GMROI | Explains Tier 1 · rolling 12 months | `+0.2× vs target 2.5×` | R52W front margin: `€862m` | Average stock at cost: `€319m` | H&B · Electronics: `4.1× · 1.9×` | €862m front margin ÷ €319m average stock = 2.7×. Target 2.5×, so +0.2×. | Updated weekly |
| SUPPLIER_OTIF | Explains Tier 1 · inbound, PO lines | `+0.2 pp vs target 95%` | PO lines due: `19,412` | vs prev. mth: `+0.1 pp` | Suppliers below 85%: `2` | 18,486 lines on time and in full ÷ 19,412 lines due = 95.2%. Target 95%, so +0.2 pp. | Updated Mon 05:12 |
| CHANNEL_MIX | Explains Tier 1 · % of net sales vs plan | `store −1.6 pp vs plan` | Store: `68.6% · −1.6 pp` | Online: `19.6% · +1.3 pp` | Wholesale: `11.8% · +0.3 pp` | Store €165.8m, online €47.4m, wholesale €28.5m of €241.7m → 68.6% / 19.6% / 11.8%. Plan 70.2 / 18.3 / 11.5, so store −1.6 pp. | Updated Mon 05:12 |

#### W43 · Electronics + Toys

| card | eyebrow | ⓘ Δ | stat 1 | stat 2 | stat 3 | worked example | footer note |
|---|---|---|---|---|---|---|---|
| NET_SALES | Tier 1 · week 43, all channels | `−€0.2m (−2.1%) vs budget` | vs LY week: `+3.8%` | Month 10 to date: `€37.7m` | Year to date: `€308.1m` | €11.4m at ticket − €1.1m markdowns and discounts − €0.1m returns = €10.2m. Budget was €10.5m, so −€0.2m (−2.1%). | Updated Mon 05:12 |
| TOTAL_MARGIN | Tier 1 · front + back · prov. | `−0.2 pp vs budget 30.7%` | Front margin: `23.1%` | Back margin: `7.4%` | vs LY week: `−0.7 pp` | Front €2.4m + back €0.8m = €3.1m; ÷ €10.2m = 30.5%. Budget 30.7%, so −0.2 pp. | Provisional · true-up 10 Nov |
| WEEKS_OF_COVER | Tier 1 · forward | `−4.5 wks vs target 15.4` | On hand at cost: `€62m` | On order: `€13m` | vs last week: `+0.2 wks` | €75m stock incl. on-order ÷ €6.9m forecast weekly cost of goods = 10.9 weeks. Target 15.4, so −4.5 → Off track. | Updated Mon 05:12 |
| MARKDOWN | Explains Tier 1 · % of gross sales | `−0.2 pp vs budget 9.6%` | Markdown value: `€1.1m` | vs LY week: `+2.1 pp` | Budget: `9.6%` | €1.1m markdown ÷ €11.4m gross sales = 9.4%. Budget 9.6%, so −0.2 pp; lower is better → On track. | Updated Mon 05:12 |
| AVAILABILITY | Explains Tier 1 · top-500 SKUs, weighted | `−1.7 pp vs target 97%` | vs last week: `−0.2 pp` | Netherlands · Belgium: `94.8% · 96.1%` | Lowest category: `Electronics 95.3%` | 500 SKUs × 142 stores × 7 days = 54,670 ranged; 52,118 in stock → 95.3%. Target 97%, so −1.7 pp → Watch. | Updated Mon 05:12 |
| EBITDA | Explains Tier 1 · month 10 to date · prov. | `n/a by category` | EBITDA margin: `n/a` | Budget margin: `n/a` | Store costs vs plan: `n/a` | Not split by category — OpEx is booked per site and centrally. | Provisional · weekly flash |
| LFL_GROWTH | Explains Tier 1 · vs LY week | `+1.0 pp vs budget LFL 3.0%` | LFL stores: `131 of 142` | Non-LFL effect: `−1.7 pp` | Online LFL: `+6.7%` | 131 LFL stores: €5.5m ÷ €5.2m − 1 = +4.0%. Budget LFL 3.0%, so +1.0 pp. | Updated Mon 05:12 |
| FRONT_GM | Explains Tier 1 · % of net sales | `−0.2 pp vs budget 23.3%` | Cost of goods: `€7.9m` | Front margin: `€2.4m` | vs LY week: `−1.1 pp` | €10.2m − €7.9m cost of goods = €2.4m; ÷ €10.2m = 23.1%. Budget 23.3%, so −0.2 pp. | Updated Mon 05:12 |
| SELL_THROUGH | Explains Tier 1 · A/W season to date | `−1.0 pp vs target 62%` | Toys & leisure: `61%` | vs LY season: `+3.8 pp` |  | 1.6m units sold ÷ (0.8m opening + 1.9m received = 2.7m) = 61.0%. Target 62% at week 12 of 20, so −1.0 pp. Seasonal categories only. | Updated weekly |
| GMROI | Explains Tier 1 · rolling 12 months | `−0.3× vs target 2.2×` | R52W front margin: `€97m` | Average stock at cost: `€49m` | Electronics · Toys & leisure: `1.9× · 2.0×` | €97m front margin ÷ €49m average stock = 2.0×. Target 2.2×, so −0.3×. | Updated weekly |
| SUPPLIER_OTIF | Explains Tier 1 · inbound, PO lines | `n/a by category` | PO lines due: `n/a` | vs last week: `n/a` | Suppliers below 85%: `n/a` | Not split by category — PO lines are per supplier. | Updated Mon 05:12 |
| CHANNEL_MIX | Explains Tier 1 · % of net sales vs plan | `online +1.5 pp vs plan` | Store: `57.4% · −1.5 pp` | Online: `32.7% · +1.5 pp` | Wholesale: `9.9% · −0.0 pp` | Store €5.9m, online €3.4m, wholesale €1.0m of €10.2m → 57.4% / 32.7% / 9.9%. Plan 58.8 / 31.2 / 9.9, so online +1.5 pp. | Updated Mon 05:12 |

More pop-up checks: W43 vs Previous → EBITDA `[Explain Delta]` = "−€0.0m (−0.0%) vs P9 weeks 1–4" (card Δ "… vs
prev. mth"); W35 vs Previous → EBITDA Δ "n/a vs prev. mth" (week 5 of a 5-week month), status still Watch/rated;
FY2026-W01 vs Previous → EBITDA ⓘ Δ ends "vs P12 FY2025 week 1".

### Bars of the default view (oldest → picked, W31 … W43)

`[Bar Value]` per bar, `[Bar Target]` on the line. `–` = BLANK (no season in W31).

| card | bar values (oldest → picked) | target line |
|---|---|---|
| NET_SALES | 54,266,667, 55,125,000, 56,083,333, 57,541,667, 56,400,000, 57,358,333, 59,216,667, 58,675,000, 58,333,333, 60,061,311, 60,850,294, 59,370,951, 61,407,862 | 62,912,987.45 |
| TOTAL_MARGIN | 0.359000, 0.360000, 0.362000, 0.361000, 0.358000, 0.360000, 0.364000, 0.362000, 0.361000, 0.363146, 0.365144, 0.360148, 0.363131 | 0.362000 |
| WEEKS_OF_COVER | 9.200000, 9.400000, 9.600000, 9.900000, 10.100000, 10.300000, 10.600000, 10.400000, 10.800000, 11.000000, 11.200000, 11.100000, 11.393953 | 9.500000 |
| MARKDOWN | 0.079000, 0.081000, 0.084000, 0.082000, 0.086000, 0.089000, 0.087000, 0.091000, 0.094000, 0.090000, 0.093000, 0.096000, 0.097848 | 0.085000 |
| AVAILABILITY | 0.968000, 0.965000, 0.969000, 0.962000, 0.959000, 0.961000, 0.954000, 0.950000, 0.952000, 0.948000, 0.946000, 0.943000, 0.941046 | 0.970000 |
| EBITDA | 3,612,147, 3,697,226, 3,795,074, 3,912,792, 3,592,489, 3,800,140, 4,020,331, 3,787,749, 3,696,457, 3,903,623, 3,997,784, 3,696,990, 3,700,819 | 4,305,805.92 |
| LFL_GROWTH | 0.021000, 0.024000, 0.028000, 0.031000, 0.026000, 0.029000, 0.035000, 0.030000, 0.027000, 0.032000, 0.036000, 0.031000, 0.033894 | 0.030000 |
| FRONT_GM | 0.296000, 0.298000, 0.302000, 0.300000, 0.297000, 0.301000, 0.303000, 0.299000, 0.300000, 0.302000, 0.304000, 0.298000, 0.301149 | 0.300000 |
| SELL_THROUGH | –, 0.121158, 0.202942, 0.264138, 0.312386, 0.354417, 0.393807, 0.430028, 0.465317, 0.501448, 0.541662, 0.584411, 0.631038 | 0.620000 |
| GMROI | 2.670561, 2.672266, 2.675074, 2.677892, 2.680478, 2.682328, 2.685158, 2.686866, 2.688909, 2.692221, 2.696420, 2.699569, 2.703100 | 2.500000 |
| SUPPLIER_OTIF | 0.940091, 0.945940, 0.951026, 0.947952, 0.953100, 0.950061, 0.946970, 0.952095, 0.955936, 0.951030, 0.953936, 0.950064, 0.954073 | 0.950000 |

Labels (W43): W31, W32, W33, W34, W35, W36, W37, W38, W39, W40, W41, W42, W43

At Month 10 the Net sales bars are the 12 months P11 FY2025 … P10 FY2026 (the last = 241,690,417.83, the one before
= P9 = 233,583,333.33); at Quarter 4 the 8 quarters Q1 FY25 … Q4 FY26 (the last = the to-date value 241,690,417.83);
at FY2026 two bars FY25, FY26. EBITDA bars at Week are weekly EBITDA (W43 = 3,700,819.30) with the weekly budget
4,305,805.92 as the line, although the card value is month to date (15,299,215.89).

## Acceptance

The build is done when: structure checks match; `[Golden Fail Count]` = 0; (optional) `[Control Fail Count]` = 0;
the default view shows exactly the strings of "default (W43 · Budget · All · All categories)" above with counts
▲ 7 / ● 3 / ▼ 2 and an orange dot; and the spot views (P10, Q4 vs LY, FY2025, Online only, Electronics, Group B3)
match their blocks.
