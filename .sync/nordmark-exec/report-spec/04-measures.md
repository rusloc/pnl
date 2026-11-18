# 04 · Measures (DAX)

All measures live in the empty `Measures` table, in the display folders below. Formatting follows one house style:
UPPERCASE functions, `_`-prefixed VARs with aligned `=`, leading commas, one filter per line, columns always
table-qualified, measures never.

Source references are to the web engine in `C:\__VOSK__\src\lib\nordmark\` (`engine/metrics.ts` = **M**,
`engine/view.ts` = **V**, `engine/items.ts` = **I**, `engine/status.ts` = **S**, `engine/format.ts` = **F**,
`engine/copy.ts` = **C**, `engine/url-state.ts` = **U**, `chat-metrics.ts` = **CM**).

## How the layers fit

| Folder | Layer | Reads | Count |
|---|---|---|---:|
| 0 Selection | the picked item, comparator, region, category pick; lookups on `Period` and `Week` | slicers | 40 |
| 1 Engine | every figure of the engine, evaluated over **whatever `Week` rows are in context** + region + category | facts | 81 |
| 2 Window | `[Metric Value]` dispatches a `Metric[metric_code]` to its engine measure; `[Metric In Window]` applies the window (CUR / LY / PREV / ITEM / BAR) | engine | 9 |
| 3 Card | everything a card face shows, generic over `Card[kpi_code]` | window | 55 |
| 4 Bars | bar heights, target line, colours, axis range | window | 7 |
| 5 Status strip | counts, overall dot, attribute picks | card | 18 |
| 6 Header & copy | header runs, category pick label, How to read | selection | 13 |
| 7 Explain | ⓘ pop-up: eyebrow, Δ, three stats, worked example, footer, mix bar | card | 53 |
| 8 Validation | answer key and control totals | all | 10 |
| | | **Total** | **286** |

Rules every measure keeps (the engine's):

- **BLANK = N/A.** A figure the engine leaves out ("absent key") is BLANK; the page prints `n/a` or `–`.
- **Full precision** in numbers; rounding only in the text measures (F).
- **Flows** sum the window, **point-in-time** figures read the window's last week, status is always vs the card's
  basis (budget / target / plan) whatever the comparator.

## Text format recipes (F, used inline below)

DAX has no user functions here, so the text measures inline these patterns. `_x` is the number; `−` is U+2212
(`UNICHAR ( 8722 )`); the sign is decided on the **unrounded** value (so `−0.0 pp` can appear, as in the web).

| Recipe | Web (F) | DAX | Example |
|---|---|---|---|
| eurM | `eurM(x)` | `IF ( _x < 0, "−", "" ) & "€" & FORMAT ( ABS ( _x ) / 1000000, IF ( ABS ( _x ) >= 1000000000, "#,0", "#,0.0" ) ) & "m"` | €61.4m · €2,318m |
| eurM0 | `eurM(x, 0)` | same with `"#,0"` always | €402m |
| eurDelta | `eurDelta(x)` | `IF ( _x >= 0, "+", "−" ) & "€" & FORMAT ( ABS ( _x ) / 1000000, IF ( ABS ( _x ) >= 1000000000, "#,0", "#,0.0" ) ) & "m"` | −€1.5m |
| pct | `pct(x)` | `IF ( _x < 0, "−", "" ) & FORMAT ( ABS ( _x ) * 100, "#,0.0" ) & "%"` | 36.3% |
| pct0 | `pct(x, 0)` | `FORMAT ( _x * 100, "#,0" ) & "%"` | 58% |
| pctNum | `pctNum(x)` | pct without `%` | 36.3 |
| pctSigned | `pctSigned(x)` | `IF ( _x >= 0, "+", "−" ) & FORMAT ( ABS ( _x ) * 100, "#,0.0" ) & "%"` | +3.8% |
| pp | `pp(x)` | `IF ( _x >= 0, "+", "−" ) & FORMAT ( ABS ( _x ) * 100, "#,0.0" ) & " pp"` | +0.1 pp |
| pctTarget | `pctTarget(x)` | `VAR _s = FORMAT ( _x * 100, "#,0.0" )` then `IF ( RIGHT ( _s, 2 ) = ".0", LEFT ( _s, LEN ( _s ) - 2 ), _s ) & "%"` | 97% · 62.5% |
| share | `share(x)` | pctTarget without `%` | 70 |
| num | `num(x)` | `IF ( _x < 0, "−", "" ) & FORMAT ( ABS ( _x ), "#,0.0" )` | 11.4 |
| signed | `signed(x, u)` | `IF ( _x >= 0, "+", "−" ) & FORMAT ( ABS ( _x ), "#,0.0" ) & u` | +1.9 wks · +0.2× |
| int | `int(x)` | `IF ( _x < 0, "−", "" ) & FORMAT ( ABS ( _x ), "#,0" )` | 4,812 |
| unitsM | `unitsM(x)` | `FORMAT ( _x / 1000000, "#,0.0" ) & "m"` | 8.4m |

`FORMAT` rounds half away from zero; JavaScript's `toFixed` rounds the binary value. They can differ on a value that
sits exactly on a half (none of the validated strings in `08-validation.md` does).

---

## 0 Selection

### Sel Item Id

The picked `Period` row. One visible item → that item. None or several (e.g. the granularity changed and the old chip
is filtered out) → the **latest listed item** of the selected granularity and fiscal year (for FY2026 that is the
item holding the as-of week: W43 → P10 → Q4 → FY2026, the web's rule I `containing`). No granularity selected → the
default item (FY2026-W43). Web: U `normalize`, V `buildView` lines 237–242. Format: `0`.

```dax
Sel Item Id =
VAR _ids          = VALUES ( 'Period'[item_id] )
VAR _gran_count   =
    CALCULATE (
        DISTINCTCOUNT ( 'Period'[gran] )
        ,REMOVEFILTERS ( 'Period'[chip_label], 'Period'[chip_sort] )
    )
VAR _fallback     =
    IF (
        _gran_count = 1
        ,CALCULATE (
            MAX ( 'Period'[item_id] )
            ,REMOVEFILTERS ( 'Period'[chip_label], 'Period'[chip_sort] )
        )
        ,CALCULATE (
            MAX ( 'Period'[item_id] )
            ,REMOVEFILTERS ( 'Period' )
            ,'Period'[is_default] = TRUE ()
        )
    )
RETURN
    IF ( COUNTROWS ( _ids ) = 1, MAXX ( _ids, 'Period'[item_id] ), _fallback )
```

### Period lookups (24 measures, one pattern)

Pattern (replace `<Name>` and `<column>`):

```dax
<Name> =
VAR _id           = [Sel Item Id]
RETURN
    CALCULATE (
        SELECTEDVALUE ( 'Period'[<column>] )
        ,REMOVEFILTERS ( 'Period' )
        ,'Period'[item_id] = _id
    )
```

| Measure | Column | Format | Meaning |
|---|---|---|---|
| Sel Gran | gran | text | W · P · Q · FY |
| Sel Item Key | item_key | text | FY2026-W43 |
| Sel Item Ord | item_ord | `0` | position inside its granularity |
| Sel FY | fy | `0` | 2026 |
| Sel From Ix | from_ix | `0` | window start |
| Sel To Ix | to_ix | `0` | window end = **L** (last week; point-in-time figures read here) |
| Sel LY From Ix | ly_from_ix | `0` | |
| Sel LY To Ix | ly_to_ix | `0` | |
| Sel Prev From Ix | prev_from_ix | `0` | |
| Sel Prev To Ix | prev_to_ix | `0` | |
| Sel PTD From Ix | ptd_from_ix | `0` | Week only |
| Sel PTD To Ix | ptd_to_ix | `0` | Week only |
| Sel PTD LY From Ix | ptd_ly_from_ix | `0` | Week only |
| Sel PTD LY To Ix | ptd_ly_to_ix | `0` | Week only |
| Sel PTD Prev From Ix | ptd_prev_from_ix | `0` | Week only; BLANK for week 5 of a 5-week month and the first month |
| Sel PTD Prev To Ix | ptd_prev_to_ix | `0` | |
| Sel PTD Prev Name | ptd_prev_name | text | "P9 weeks 1–4", "P12 FY2025 week 1" |
| Sel Title | title | text | "Week 43" · "Month 10 FY2025" · "FY2026" |
| Sel Header Period Rest | header_period_rest | text | " · 19–25 Oct 2026" · " to date · 28 Sep–25 Oct 2026" |
| Sel Window Phrase | window_phrase | text | "week 43" · "quarter 4 to date" · "FY2026 to date" |
| Sel Word Noun | word_noun | text | week · month · quarter · year |
| Sel Word Prev | word_prev | text | Previous week · Previous month · Previous quarter · Last year |
| Sel Word Short | word_short | text | vs prev. wk · vs prev. mth · vs prev. qtr · vs LY |
| Sel Bar Count | bar_count | `0` | 13 · 12 · 8 · 2 |

(`Sel Last Period` is the Week lookup below; `is_partial` is folded into the text columns.)

### Week-at-L lookups (6 measures, one pattern)

```dax
<Name> =
VAR _L            = [Sel To Ix]
RETURN
    CALCULATE (
        SELECTEDVALUE ( 'Week'[<column>] )
        ,REMOVEFILTERS ( 'Week' )
        ,'Week'[week_ix] = _L
    )
```

| Measure | Column | Format |
|---|---|---|
| Sel Month Start Ix | month_start_ix | `0` |
| Sel Quarter Start Ix | quarter_start_ix | `0` |
| Sel FY Start Ix | fy_start_ix | `0` |
| Sel Last Period | period | `0` |
| Sel Last Quarter | quarter | `0` |
| Sel Season Week | season_week | `0` |

### Sel Season Length

```dax
Sel Season Length =
VAR _L            = [Sel To Ix]
RETURN
    CALCULATE (
        SELECTEDVALUE ( 'Week'[season_length] )
        ,REMOVEFILTERS ( 'Week' )
        ,'Week'[week_ix] = _L
    )
```

### Sel Comparator

Budget by default; Previous at Year becomes Last year (U `normalize`). Text.

```dax
Sel Comparator =
VAR _picked       = SELECTEDVALUE ( 'Comparator'[comparator_code], "budget" )
RETURN
    IF ( _picked = "prev" && [Sel Gran] = "FY", "ly", _picked )
```

### Sel Region Code

```dax
Sel Region Code =
SELECTEDVALUE ( 'Region'[region_code], "all" )
```

### Category Pick Active

No category or all nine = All (I/U `normalize`, cube.ts `categoryMask`). Boolean.

```dax
Category Pick Active =
VAR _picked       = COUNTROWS ( VALUES ( 'Category'[category_code] ) )
VAR _all          = COUNTROWS ( ALL ( 'Category' ) )
RETURN
    _picked > 0 && _picked < _all
```

### Current FY · As Of Ix · Refreshed Long · Refreshed Short

```dax
Current FY =
MAX ( 'Report Info'[current_fy] )
```

```dax
As Of Ix =
MAX ( 'Report Info'[as_of_ix] )
```

```dax
Refreshed Long =
SELECTEDVALUE ( 'Report Info'[refreshed_long] )
```

```dax
Refreshed Short =
SELECTEDVALUE ( 'Report Info'[refreshed_short] )
```

### Seasonal In Pick

Seasonal categories inside the current category filter (all four at All). `0`.

```dax
Seasonal In Pick =
CALCULATE (
    COUNTROWS ( 'Category' )
    ,KEEPFILTERS ( 'Category'[is_seasonal] = TRUE () )
) + 0
```

---

## 1 Engine

Context: the `Week` rows in the filter context are **the window**; `Site Group` is filtered by the region bridge;
`Category` by the category pick. `L` = `[Last Week Ix]`. Formats: EUR amounts `#,0.00`; ratios, weeks, × `0.000000`;
counts `#,0`. Web: M `base()` lines 156–332 unless noted.

### Window helpers

```dax
Last Week Ix =
MAX ( 'Week'[week_ix] )
```

```dax
Has Budget =
MAX ( 'Week'[fy] ) = [Current FY]
```

Budget exists for the as-of FY only (M 287–288; every window lies inside one FY).

```dax
Window Has LY =
VAR _weeks        = COUNTROWS ( 'Week' )
VAR _with_ly      =
    CALCULATE (
        COUNTROWS ( 'Week' )
        ,NOT ISBLANK ( 'Week'[ly_week_ix] )
    )
RETURN
    _weeks > 0 && _weeks = _with_ly
```

Every week of the window has an LY week by key (M 211–213).

```dax
Season Week At L =
VAR _L            = [Last Week Ix]
RETURN
    CALCULATE (
        MAX ( 'Week'[season_week] )
        ,REMOVEFILTERS ( 'Week' )
        ,'Week'[week_ix] = _L
    )
```

### Sales and margin (window; M 173–187)

```dax
Gross Sales =
SUM ( 'Cube'[gross_sales] ) + 0
```

```dax
Markdown =
SUM ( 'Cube'[markdown] ) + 0
```

```dax
Returns =
SUM ( 'Cube'[returns] ) + 0
```

```dax
Net Sales =
SUM ( 'Cube'[net_sales] ) + 0
```

```dax
COGS =
SUM ( 'Cube'[cogs] ) + 0
```

```dax
Back Margin =
SUM ( 'Cube'[back_margin] ) + 0
```

```dax
Front Margin =
[Net Sales] - [COGS]
```

```dax
Total Margin =
[Front Margin] + [Back Margin]
```

```dax
Front GM % =
DIVIDE ( [Front Margin], [Net Sales] )
```

```dax
Back Margin % =
DIVIDE ( [Back Margin], [Net Sales] )
```

```dax
Total Margin % =
DIVIDE ( [Total Margin], [Net Sales] )
```

```dax
Markdown % =
DIVIDE ( [Markdown], [Gross Sales] )
```

### OpEx and EBITDA (window; no category key → BLANK under a pick; M 189–202)

```dax
Opex Shrink =
IF (
    NOT [Category Pick Active]
    ,CALCULATE (
        SUM ( 'Opex'[amount] )
        ,'Opex'[scenario] = "ACT"
        ,'Opex'[cost_type] = "SHRINK"
    ) + 0
)
```

```dax
Opex Store =
IF (
    NOT [Category Pick Active]
    ,CALCULATE (
        SUM ( 'Opex'[amount] )
        ,'Opex'[scenario] = "ACT"
        ,'Opex'[cost_type] = "STORE_OPEX"
    ) + 0
)
```

```dax
Opex Central =
IF (
    NOT [Category Pick Active]
    ,CALCULATE (
        SUM ( 'Opex'[amount] )
        ,'Opex'[scenario] = "ACT"
        ,'Opex'[cost_type] = "CENTRAL_OPEX"
    ) + 0
)
```

```dax
Opex Fulfilment =
IF (
    NOT [Category Pick Active]
    ,CALCULATE (
        SUM ( 'Opex'[amount] )
        ,'Opex'[scenario] = "ACT"
        ,'Opex'[cost_type] = "FULFILMENT"
    ) + 0
)
```

Scoped EBITDA (a region pick) is a contribution before central costs: CENTRAL rows sit only in the All scope.

```dax
EBITDA =
IF (
    NOT [Category Pick Active]
    ,[Total Margin] - [Opex Shrink] - [Opex Store] - [Opex Central] - [Opex Fulfilment]
)
```

```dax
EBITDA Margin % =
IF (
    NOT [Category Pick Active]
    ,DIVIDE ( [EBITDA], [Net Sales] )
)
```

### Supplier OTIF (window; no site, no category; M 204–209)

```dax
PO Lines Due =
IF (
    NOT [Category Pick Active]
    ,SUM ( 'PO'[po_lines_due] ) + 0
)
```

```dax
PO Lines OTIF =
IF (
    NOT [Category Pick Active]
    ,SUM ( 'PO'[po_lines_otif] ) + 0
)
```

```dax
OTIF % =
IF (
    NOT [Category Pick Active]
    ,DIVIDE ( [PO Lines OTIF], [PO Lines Due] )
)
```

```dax
OTIF Target =
IF (
    NOT [Category Pick Active]
    ,CALCULATE (
        MAX ( 'Target'[target_value] )
        ,REMOVEFILTERS ( 'Target' )
        ,'Target'[kpi_code] = "SUPPLIER_OTIF"
        ,'Target'[category_code] = "ALL"
    )
)
```

```dax
Suppliers Below 85 =
VAR _L            = [Last Week Ix]
RETURN
    CALCULATE (
        SUM ( 'PO'[suppliers_below_85] )
        ,REMOVEFILTERS ( 'Week' )
        ,'Week'[week_ix] = _L
    ) + 0
```

### Like-for-like (window + its LY by key; stores only; M 211–225)

```dax
LFL Net Sales LY =
VAR _ly           =
    CALCULATE (
        SUM ( 'Cube'[net_sales_lfl_as_ly] )
        ,TREATAS ( VALUES ( 'Week'[ly_week_ix] ), 'Week'[week_ix] )
    )
RETURN
    IF ( [Window Has LY] && _ly <> 0, _ly )
```

```dax
Store Net Sales =
IF (
    [Window Has LY]
    ,CALCULATE (
        [Net Sales]
        ,KEEPFILTERS ( 'Site Group'[is_store] = TRUE () )
    )
)
```

```dax
Store Net Sales LY =
IF (
    [Window Has LY]
    ,CALCULATE (
        [Net Sales]
        ,KEEPFILTERS ( 'Site Group'[is_store] = TRUE () )
        ,TREATAS ( VALUES ( 'Week'[ly_week_ix] ), 'Week'[week_ix] )
    )
)
```

```dax
LFL Net Sales =
IF (
    NOT ISBLANK ( [LFL Net Sales LY] )
    ,SUM ( 'Cube'[net_sales_lfl] ) + 0
)
```

```dax
LFL Store Count =
VAR _L            = [Last Week Ix]
RETURN
    IF (
        NOT ISBLANK ( [LFL Net Sales LY] )
        ,CALCULATE (
            SUM ( 'Sites'[lfl_stores] )
            ,REMOVEFILTERS ( 'Week' )
            ,'Week'[week_ix] = _L
        ) + 0
    )
```

```dax
LFL Growth % =
VAR _ly           = [LFL Net Sales LY]
RETURN
    IF ( NOT ISBLANK ( _ly ), [LFL Net Sales] / _ly - 1 )
```

```dax
Non-LFL Effect pp =
VAR _growth       = [LFL Growth %]
RETURN
    IF (
        NOT ISBLANK ( _growth )
        ,DIVIDE ( [Store Net Sales], [Store Net Sales LY] ) - 1 - _growth
    )
```

```dax
Trading Stores =
VAR _L            = [Last Week Ix]
RETURN
    CALCULATE (
        SUM ( 'Sites'[trading_stores] )
        ,REMOVEFILTERS ( 'Week' )
        ,'Week'[week_ix] = _L
    ) + 0
```

### Weeks of cover (point in time at L; M 227–242)

```dax
On Hand Cost =
VAR _L            = [Last Week Ix]
RETURN
    CALCULATE (
        SUM ( 'Cube'[on_hand_cost] )
        ,REMOVEFILTERS ( 'Week' )
        ,'Week'[week_ix] = _L
    ) + 0
```

```dax
On Order Cost =
VAR _L            = [Last Week Ix]
RETURN
    CALCULATE (
        SUM ( 'Cube'[on_order_cost] )
        ,REMOVEFILTERS ( 'Week' )
        ,'Week'[week_ix] = _L
    ) + 0
```

```dax
Forecast COGS =
VAR _L            = [Last Week Ix]
RETURN
    CALCULATE (
        SUM ( 'Cube'[forecast_cogs] )
        ,REMOVEFILTERS ( 'Week' )
        ,'Week'[week_ix] = _L
    ) + 0
```

```dax
Stock Incl On Order =
[On Hand Cost] + [On Order Cost]
```

```dax
Weeks of Cover =
DIVIDE ( [Stock Incl On Order], [Forecast COGS] )
```

Target = forecast-weighted category targets (always, also at All).

```dax
Cover Target Wks =
VAR _L            = [Last Week Ix]
VAR _weighted     =
    CALCULATE (
        SUMX (
            'Cube'
            ,'Cube'[forecast_cogs] * RELATED ( 'Category'[cover_target_wks] )
        )
        ,REMOVEFILTERS ( 'Week' )
        ,'Week'[week_ix] = _L
    )
RETURN
    DIVIDE ( _weighted, [Forecast COGS] )
```

### Availability (point in time at L; stores only; M 244–251)

```dax
Ranged SKU Days =
VAR _L            = [Last Week Ix]
VAR _ranged       =
    CALCULATE (
        SUM ( 'Cube'[ranged_sku_days] )
        ,REMOVEFILTERS ( 'Week' )
        ,'Week'[week_ix] = _L
    )
RETURN
    IF ( _ranged <> 0, _ranged )
```

```dax
In Stock SKU Days =
VAR _L            = [Last Week Ix]
RETURN
    IF (
        NOT ISBLANK ( [Ranged SKU Days] )
        ,CALCULATE (
            SUM ( 'Cube'[in_stock_sku_days] )
            ,REMOVEFILTERS ( 'Week' )
            ,'Week'[week_ix] = _L
        ) + 0
    )
```

```dax
Availability % =
DIVIDE ( [In Stock SKU Days], [Ranged SKU Days] )
```

```dax
Availability Target =
CALCULATE (
    MAX ( 'Target'[target_value] )
    ,REMOVEFILTERS ( 'Target' )
    ,'Target'[kpi_code] = "AVAILABILITY"
    ,'Target'[category_code] = "ALL"
)
```

### Sell-through (season to date ending at L; seasonal part of the pick; selling locations; M 338–379)

Season window: weeks `L − sw + 1 … L` (sw = season week at L); opening stock at week `L − sw`. N/A outside a season,
when `L − sw < 0`, or when the pick holds no seasonal category.

```dax
Season Opening Units =
VAR _L            = [Last Week Ix]
VAR _sw           = [Season Week At L]
VAR _ok           = NOT ISBLANK ( _sw ) && _L - _sw >= 0 && [Seasonal In Pick] > 0
RETURN
    IF (
        _ok
        ,CALCULATE (
            SUM ( 'Cube'[on_hand_units] )
            ,REMOVEFILTERS ( 'Week' )
            ,'Week'[week_ix] = _L - _sw
            ,KEEPFILTERS ( 'Category'[is_seasonal] = TRUE () )
            ,KEEPFILTERS ( 'Site Group'[is_selling] = TRUE () )
        ) + 0
    )
```

```dax
Season Receipt Units =
VAR _L            = [Last Week Ix]
VAR _sw           = [Season Week At L]
VAR _ok           = NOT ISBLANK ( _sw ) && _L - _sw >= 0 && [Seasonal In Pick] > 0
RETURN
    IF (
        _ok
        ,CALCULATE (
            SUM ( 'Cube'[receipt_units] )
            ,REMOVEFILTERS ( 'Week' )
            ,'Week'[week_ix] >= _L - _sw + 1 && 'Week'[week_ix] <= _L
            ,KEEPFILTERS ( 'Category'[is_seasonal] = TRUE () )
        ) + 0
    )
```

(Receipts use every group of the region, as the engine does; only NL, BE and ONLINE have receipts.)

```dax
Season Units Sold =
VAR _L            = [Last Week Ix]
VAR _sw           = [Season Week At L]
VAR _ok           = NOT ISBLANK ( _sw ) && _L - _sw >= 0 && [Seasonal In Pick] > 0
RETURN
    IF (
        _ok
        ,CALCULATE (
            SUM ( 'Cube'[units] )
            ,REMOVEFILTERS ( 'Week' )
            ,'Week'[week_ix] >= _L - _sw + 1 && 'Week'[week_ix] <= _L
            ,KEEPFILTERS ( 'Category'[is_seasonal] = TRUE () )
            ,KEEPFILTERS ( 'Site Group'[is_selling] = TRUE () )
        ) + 0
    )
```

```dax
Sell-through % =
VAR _opening      = [Season Opening Units]
RETURN
    IF (
        NOT ISBLANK ( _opening )
        ,DIVIDE ( [Season Units Sold], _opening + [Season Receipt Units] )
    )
```

At All the `ALL` target row; under a pick the (opening + receipts)-weighted category targets (M 361–371).

```dax
Sell-through Target =
VAR _st           = [Sell-through %]
VAR _all_target   =
    CALCULATE (
        MAX ( 'Target'[target_value] )
        ,REMOVEFILTERS ( 'Target' )
        ,'Target'[kpi_code] = "SELL_THROUGH"
        ,'Target'[category_code] = "ALL"
    )
VAR _weighted     =
    DIVIDE (
        SUMX (
            CALCULATETABLE (
                VALUES ( 'Category'[category_ix] )
                ,KEEPFILTERS ( 'Category'[is_seasonal] = TRUE () )
            )
            ,( [Season Opening Units] + [Season Receipt Units] )
                * CALCULATE ( MAX ( 'Category'[sellthrough_target] ) )
        )
        ,[Season Opening Units] + [Season Receipt Units]
    )
RETURN
    IF (
        NOT ISBLANK ( _st )
        ,IF ( [Category Pick Active], _weighted, _all_target )
    )
```

### GMROI (rolling 52 weeks ending at L; N/A when L < 51; M 257–274)

```dax
GMROI Front Margin R52W =
VAR _L            = [Last Week Ix]
RETURN
    IF (
        _L >= 51
        ,CALCULATE (
            [Net Sales] - [COGS]
            ,REMOVEFILTERS ( 'Week' )
            ,'Week'[week_ix] >= _L - 51 && 'Week'[week_ix] <= _L
        )
    )
```

```dax
GMROI Avg On Hand Cost =
VAR _L            = [Last Week Ix]
RETURN
    IF (
        _L >= 51
        ,CALCULATE (
            SUM ( 'Cube'[on_hand_cost] )
            ,REMOVEFILTERS ( 'Week' )
            ,'Week'[week_ix] >= _L - 51 && 'Week'[week_ix] <= _L
        ) / 52
    )
```

```dax
GMROI =
DIVIDE ( [GMROI Front Margin R52W], [GMROI Avg On Hand Cost] )
```

```dax
GMROI Target =
VAR _gmroi        = [GMROI]
VAR _all_target   =
    CALCULATE (
        MAX ( 'Target'[target_value] )
        ,REMOVEFILTERS ( 'Target' )
        ,'Target'[kpi_code] = "GMROI"
        ,'Target'[category_code] = "ALL"
    )
VAR _weighted     =
    DIVIDE (
        SUMX (
            VALUES ( 'Category'[category_ix] )
            ,[GMROI Avg On Hand Cost] * CALCULATE ( MAX ( 'Category'[gmroi_target] ) )
        )
        ,SUMX (
            VALUES ( 'Category'[category_ix] )
            ,[GMROI Avg On Hand Cost]
        )
    )
RETURN
    IF (
        NOT ISBLANK ( _gmroi )
        ,IF ( [Category Pick Active], _weighted, _all_target )
    )
```

### Channel mix (window shares; M 276–285)

```dax
Mix Store Net Sales =
CALCULATE (
    [Net Sales]
    ,KEEPFILTERS ( 'Site Group'[channel] = "Store" )
)
```

```dax
Mix Online Net Sales =
CALCULATE (
    [Net Sales]
    ,KEEPFILTERS ( 'Site Group'[channel] = "Online" )
)
```

```dax
Mix Wholesale Net Sales =
CALCULATE (
    [Net Sales]
    ,KEEPFILTERS ( 'Site Group'[channel] = "Wholesale" )
)
```

```dax
Mix Store % =
DIVIDE ( [Mix Store Net Sales], [Net Sales] )
```

```dax
Mix Online % =
DIVIDE ( [Mix Online Net Sales], [Net Sales] )
```

```dax
Mix Wholesale % =
DIVIDE ( [Mix Wholesale Net Sales], [Net Sales] )
```

### Budget (FY2026 only; M 287–330)

```dax
Net Sales Budget =
IF ( [Has Budget], SUM ( 'Cube'[net_sales_bud] ) + 0 )
```

```dax
Gross Sales Budget =
IF ( [Has Budget], SUM ( 'Cube'[gross_sales_bud] ) + 0 )
```

```dax
Markdown Budget =
IF ( [Has Budget], SUM ( 'Cube'[markdown_bud] ) + 0 )
```

```dax
COGS Budget =
IF ( [Has Budget], SUM ( 'Cube'[cogs_bud] ) + 0 )
```

```dax
Back Margin Budget =
IF ( [Has Budget], SUM ( 'Cube'[back_margin_bud] ) + 0 )
```

```dax
Markdown % Budget =
IF ( [Has Budget], DIVIDE ( [Markdown Budget], [Gross Sales Budget] ) )
```

```dax
Front GM % Budget =
IF ( [Has Budget], 1 - DIVIDE ( [COGS Budget], [Net Sales Budget] ) )
```

```dax
Total Margin % Budget =
IF (
    [Has Budget]
    ,DIVIDE ( [Net Sales Budget] - [COGS Budget] + [Back Margin Budget], [Net Sales Budget] )
)
```

```dax
Opex Shrink Budget =
IF (
    [Has Budget] && NOT [Category Pick Active]
    ,CALCULATE (
        SUM ( 'Opex'[amount] )
        ,'Opex'[scenario] = "BUD"
        ,'Opex'[cost_type] = "SHRINK"
    ) + 0
)
```

```dax
Opex Store Budget =
IF (
    [Has Budget] && NOT [Category Pick Active]
    ,CALCULATE (
        SUM ( 'Opex'[amount] )
        ,'Opex'[scenario] = "BUD"
        ,'Opex'[cost_type] = "STORE_OPEX"
    ) + 0
)
```

```dax
Opex Central Budget =
IF (
    [Has Budget] && NOT [Category Pick Active]
    ,CALCULATE (
        SUM ( 'Opex'[amount] )
        ,'Opex'[scenario] = "BUD"
        ,'Opex'[cost_type] = "CENTRAL_OPEX"
    ) + 0
)
```

```dax
Opex Fulfilment Budget =
IF (
    [Has Budget] && NOT [Category Pick Active]
    ,CALCULATE (
        SUM ( 'Opex'[amount] )
        ,'Opex'[scenario] = "BUD"
        ,'Opex'[cost_type] = "FULFILMENT"
    ) + 0
)
```

```dax
EBITDA Budget =
IF (
    [Has Budget] && NOT [Category Pick Active]
    ,[Net Sales Budget] - [COGS Budget] + [Back Margin Budget]
        - [Opex Shrink Budget] - [Opex Store Budget] - [Opex Central Budget] - [Opex Fulfilment Budget]
)
```

```dax
EBITDA Margin % Budget =
IF (
    [Has Budget] && NOT [Category Pick Active]
    ,DIVIDE ( [EBITDA Budget], [Net Sales Budget] )
)
```

```dax
LFL Net Sales Budget =
IF (
    [Has Budget] && NOT ISBLANK ( [LFL Net Sales LY] )
    ,SUM ( 'Cube'[net_sales_bud_lfl] ) + 0
)
```

```dax
LFL Growth % Budget =
VAR _bud          = [LFL Net Sales Budget]
RETURN
    IF ( NOT ISBLANK ( _bud ), _bud / [LFL Net Sales LY] - 1 )
```

```dax
Mix Store % Budget =
IF (
    [Has Budget]
    ,DIVIDE (
        CALCULATE (
            SUM ( 'Cube'[net_sales_bud] )
            ,KEEPFILTERS ( 'Site Group'[channel] = "Store" )
        ) + 0
        ,[Net Sales Budget]
    )
)
```

```dax
Mix Online % Budget =
IF (
    [Has Budget]
    ,DIVIDE (
        CALCULATE (
            SUM ( 'Cube'[net_sales_bud] )
            ,KEEPFILTERS ( 'Site Group'[channel] = "Online" )
        ) + 0
        ,[Net Sales Budget]
    )
)
```

```dax
Mix Wholesale % Budget =
IF (
    [Has Budget]
    ,DIVIDE (
        CALCULATE (
            SUM ( 'Cube'[net_sales_bud] )
            ,KEEPFILTERS ( 'Site Group'[channel] = "Wholesale" )
        ) + 0
        ,[Net Sales Budget]
    )
)
```

Largest absolute deviation of the actual share from the plan share; first channel wins a tie (store, online,
wholesale; M 317–329).

```dax
Mix Max Dev pp =
VAR _d1           = [Mix Store %] - [Mix Store % Budget]
VAR _d2           = [Mix Online %] - [Mix Online % Budget]
VAR _d3           = [Mix Wholesale %] - [Mix Wholesale % Budget]
VAR _best12       = IF ( ABS ( _d2 ) > ABS ( _d1 ), _d2, _d1 )
VAR _best         = IF ( ABS ( _d3 ) > ABS ( _best12 ), _d3, _best12 )
RETURN
    IF ( [Has Budget], _best )
```

```dax
Mix Max Dev Channel =
VAR _d1           = [Mix Store %] - [Mix Store % Budget]
VAR _d2           = [Mix Online %] - [Mix Online % Budget]
VAR _d3           = [Mix Wholesale %] - [Mix Wholesale % Budget]
VAR _i12          = IF ( ABS ( _d2 ) > ABS ( _d1 ), 2, 1 )
VAR _best12       = IF ( _i12 = 2, _d2, _d1 )
VAR _i            = IF ( ABS ( _d3 ) > ABS ( _best12 ), 3, _i12 )
RETURN
    IF ( [Has Budget], _i )
```

---

## 2 Window

### Metric code → engine measure (`Metric[layer1_measure]`)

| # | metric_code | name | unit | basis_code (label) | card | flash | catalogue | Layer-1 measure |
|---:|---|---|---|---|---|:-:|:-:|---|
| 1 | `gross_sales` | Gross sales | eur | – | – |  | Y | `[Gross Sales]` |
| 2 | `markdown` | Markdown value | eur | – | – |  | Y | `[Markdown]` |
| 3 | `returns` | Returns | eur | – | – |  | Y | `[Returns]` |
| 4 | `net_sales` | Net sales | eur | `net_sales_bud` (budget) | NET_SALES |  | Y | `[Net Sales]` |
| 5 | `cogs` | Cost of goods | eur | – | – |  | Y | `[COGS]` |
| 6 | `back_margin` | Back margin | eur | – | – |  | Y | `[Back Margin]` |
| 7 | `front_margin` | Front margin | eur | – | – |  | Y | `[Front Margin]` |
| 8 | `total_margin` | Total margin | eur | – | – |  | Y | `[Total Margin]` |
| 9 | `front_gm_pct` | Front gross margin % | pct | `front_gm_pct_bud` (budget) | FRONT_GM |  | Y | `[Front GM %]` |
| 10 | `back_margin_pct` | Back margin % | pct | – | – |  | Y | `[Back Margin %]` |
| 11 | `total_margin_pct` | Total margin % | pct | `total_margin_pct_bud` (budget) | TOTAL_MARGIN |  | Y | `[Total Margin %]` |
| 12 | `markdown_pct` | Markdown % | pct | `markdown_pct_bud` (budget) | MARKDOWN |  | Y | `[Markdown %]` |
| 13 | `opex_shrink` | Shrink | eur | `opex_shrink_bud` (budget) | – | Y | Y | `[Opex Shrink]` |
| 14 | `opex_store` | Store costs | eur | `opex_store_bud` (budget) | – | Y | Y | `[Opex Store]` |
| 15 | `opex_central` | Central costs | eur | `opex_central_bud` (budget) | – | Y | Y | `[Opex Central]` |
| 16 | `opex_fulfilment` | Fulfilment costs | eur | `opex_fulfilment_bud` (budget) | – | Y | Y | `[Opex Fulfilment]` |
| 17 | `ebitda` | EBITDA | eur | `ebitda_bud` (budget) | EBITDA | Y | Y | `[EBITDA]` |
| 18 | `ebitda_margin_pct` | EBITDA margin | pct | `ebitda_margin_pct_bud` (budget) | – | Y | Y | `[EBITDA Margin %]` |
| 19 | `po_lines_due` | PO lines due | int | – | – |  | Y | `[PO Lines Due]` |
| 20 | `po_lines_otif` | PO lines on time and in full | int | – | – |  | Y | `[PO Lines OTIF]` |
| 21 | `otif_pct` | Supplier OTIF | pct | `otif_target` (target) | SUPPLIER_OTIF |  | Y | `[OTIF %]` |
| 22 | `otif_target` | OTIF Target | pct | – | – |  |  | `[OTIF Target]` |
| 23 | `store_net_sales` | Store Net Sales | eur | – | – |  |  | `[Store Net Sales]` |
| 24 | `store_net_sales_ly` | Store Net Sales LY | eur | – | – |  |  | `[Store Net Sales LY]` |
| 25 | `lfl_net_sales` | LFL net sales | eur | – | – |  | Y | `[LFL Net Sales]` |
| 26 | `lfl_net_sales_ly` | LFL net sales last year | eur | – | – |  | Y | `[LFL Net Sales LY]` |
| 27 | `lfl_store_count` | LFL stores | int | – | – |  | Y | `[LFL Store Count]` |
| 28 | `lfl_growth_pct` | Like-for-like growth | spct | `lfl_growth_pct_bud` (budget) | LFL_GROWTH |  | Y | `[LFL Growth %]` |
| 29 | `nonlfl_effect_pp` | Non-LFL effect | pp | – | – |  | Y | `[Non-LFL Effect pp]` |
| 30 | `on_hand_cost` | Stock on hand at cost | eur | – | – |  | Y | `[On Hand Cost]` |
| 31 | `on_order_cost` | Stock on order | eur | – | – |  | Y | `[On Order Cost]` |
| 32 | `forecast_cogs` | Forecast weekly cost of goods | eur | – | – |  | Y | `[Forecast COGS]` |
| 33 | `stock_incl_on_order` | Stock incl. on-order | eur | – | – |  | Y | `[Stock Incl On Order]` |
| 34 | `weeks_of_cover` | Weeks of cover | wks | `cover_target_wks` (target) | WEEKS_OF_COVER |  | Y | `[Weeks of Cover]` |
| 35 | `cover_target_wks` | Cover Target Wks | wks | – | – |  |  | `[Cover Target Wks]` |
| 36 | `ranged_sku_days` | Ranged SKU Days | int | – | – |  |  | `[Ranged SKU Days]` |
| 37 | `in_stock_sku_days` | In Stock SKU Days | int | – | – |  |  | `[In Stock SKU Days]` |
| 38 | `availability_pct` | Availability | pct | `availability_target` (target) | AVAILABILITY |  | Y | `[Availability %]` |
| 39 | `availability_target` | Availability Target | pct | – | – |  |  | `[Availability Target]` |
| 40 | `season_opening_units` | Season Opening Units | units | – | – |  |  | `[Season Opening Units]` |
| 41 | `season_receipt_units` | Season Receipt Units | units | – | – |  |  | `[Season Receipt Units]` |
| 42 | `season_units_sold` | Season units sold | units | – | – |  | Y | `[Season Units Sold]` |
| 43 | `sell_through_pct` | Sell-through | pct | `sell_through_target` (target) | SELL_THROUGH |  | Y | `[Sell-through %]` |
| 44 | `sell_through_target` | Sell-through Target | pct | – | – |  |  | `[Sell-through Target]` |
| 45 | `gmroi_front_margin_r52w` | R52W front margin | eur | – | – |  | Y | `[GMROI Front Margin R52W]` |
| 46 | `gmroi_avg_on_hand_cost` | Average stock at cost | eur | – | – |  | Y | `[GMROI Avg On Hand Cost]` |
| 47 | `gmroi` | GMROI | x | `gmroi_target` (target) | GMROI |  | Y | `[GMROI]` |
| 48 | `gmroi_target` | GMROI Target | x | – | – |  |  | `[GMROI Target]` |
| 49 | `mix_store_net_sales` | Store net sales | eur | – | – |  | Y | `[Mix Store Net Sales]` |
| 50 | `mix_online_net_sales` | Online net sales | eur | – | – |  | Y | `[Mix Online Net Sales]` |
| 51 | `mix_wholesale_net_sales` | Wholesale net sales | eur | – | – |  | Y | `[Mix Wholesale Net Sales]` |
| 52 | `mix_store_pct` | Channel mix: store share | pct | `mix_store_pct_bud` (plan) | CHANNEL_MIX |  | Y | `[Mix Store %]` |
| 53 | `mix_online_pct` | Channel mix: online share | pct | `mix_online_pct_bud` (plan) | CHANNEL_MIX |  | Y | `[Mix Online %]` |
| 54 | `mix_wholesale_pct` | Channel mix: wholesale share | pct | `mix_wholesale_pct_bud` (plan) | CHANNEL_MIX |  | Y | `[Mix Wholesale %]` |
| 55 | `net_sales_bud` | Net Sales Budget | eur | – | – |  |  | `[Net Sales Budget]` |
| 56 | `gross_sales_bud` | Gross Sales Budget | eur | – | – |  |  | `[Gross Sales Budget]` |
| 57 | `markdown_bud` | Markdown Budget | eur | – | – |  |  | `[Markdown Budget]` |
| 58 | `cogs_bud` | COGS Budget | eur | – | – |  |  | `[COGS Budget]` |
| 59 | `back_margin_bud` | Back Margin Budget | eur | – | – |  |  | `[Back Margin Budget]` |
| 60 | `markdown_pct_bud` | Markdown % Budget | pct | – | – |  |  | `[Markdown % Budget]` |
| 61 | `front_gm_pct_bud` | Front GM % Budget | pct | – | – |  |  | `[Front GM % Budget]` |
| 62 | `total_margin_pct_bud` | Total Margin % Budget | pct | – | – |  |  | `[Total Margin % Budget]` |
| 63 | `opex_shrink_bud` | Opex Shrink Budget | eur | – | – | Y |  | `[Opex Shrink Budget]` |
| 64 | `opex_store_bud` | Opex Store Budget | eur | – | – | Y |  | `[Opex Store Budget]` |
| 65 | `opex_central_bud` | Opex Central Budget | eur | – | – | Y |  | `[Opex Central Budget]` |
| 66 | `opex_fulfilment_bud` | Opex Fulfilment Budget | eur | – | – | Y |  | `[Opex Fulfilment Budget]` |
| 67 | `ebitda_bud` | EBITDA Budget | eur | – | – | Y |  | `[EBITDA Budget]` |
| 68 | `ebitda_margin_pct_bud` | EBITDA Margin % Budget | pct | – | – | Y |  | `[EBITDA Margin % Budget]` |
| 69 | `lfl_net_sales_bud` | LFL Net Sales Budget | eur | – | – |  |  | `[LFL Net Sales Budget]` |
| 70 | `lfl_growth_pct_bud` | LFL Growth % Budget | spct | – | – |  |  | `[LFL Growth % Budget]` |
| 71 | `mix_store_pct_bud` | Mix Store % Budget | pct | – | – |  |  | `[Mix Store % Budget]` |
| 72 | `mix_online_pct_bud` | Mix Online % Budget | pct | – | – |  |  | `[Mix Online % Budget]` |
| 73 | `mix_wholesale_pct_bud` | Mix Wholesale % Budget | pct | – | – |  |  | `[Mix Wholesale % Budget]` |
| 74 | `mix_max_dev_pp` | Mix Max Dev pp | pp | – | – |  |  | `[Mix Max Dev pp]` |
| 75 | `mix_max_dev_channel` | Mix Max Dev Channel | int | – | – |  |  | `[Mix Max Dev Channel]` |
| 76 | `ebitda_ptd` | EBITDA | eur | – | – | Y |  | `[EBITDA]` |
| 77 | `ebitda_bud_ptd` | EBITDA Budget | eur | – | – | Y |  | `[EBITDA Budget]` |
| 78 | `flash.net_sales` | Net Sales | eur | – | – | Y |  | `[Net Sales]` |
| 79 | `flash.net_sales_bud` | Net Sales Budget | eur | – | – | Y |  | `[Net Sales Budget]` |
| 80 | `flash.total_margin` | Total Margin | eur | – | – | Y |  | `[Total Margin]` |
| 81 | `trading_stores` | Trading Stores | int | – | – |  |  | `[Trading Stores]` |
| 82 | `suppliers_below_85` | Suppliers Below 85 | int | – | – |  |  | `[Suppliers Below 85]` |

### Win From Ix · Win To Ix

The window of the current `Window[window_code]` (CUR when none). `Metric[flash]` at Week reads month to date (the EBITDA
flash, M 53–58, V 251–264, CM `windowOf`). BAR reads the `Bar Item` row in context. Format `0`.

```dax
Win From Ix =
VAR _window       = SELECTEDVALUE ( 'Window'[window_code], "CUR" )
VAR _flash        = SELECTEDVALUE ( 'Metric'[flash], FALSE () ) && [Sel Gran] = "W"
RETURN
    SWITCH (
        _window
        ,"CUR"
            ,IF ( _flash, [Sel PTD From Ix], [Sel From Ix] )
        ,"LY"
            ,IF ( _flash, [Sel PTD LY From Ix], [Sel LY From Ix] )
        ,"PREV"
            ,IF ( _flash, [Sel PTD Prev From Ix], [Sel Prev From Ix] )
        ,"ITEM"
            ,[Sel From Ix]
        ,"BAR"
            ,SELECTEDVALUE ( 'Bar Item'[from_ix] )
    )
```

```dax
Win To Ix =
VAR _window       = SELECTEDVALUE ( 'Window'[window_code], "CUR" )
VAR _flash        = SELECTEDVALUE ( 'Metric'[flash], FALSE () ) && [Sel Gran] = "W"
RETURN
    SWITCH (
        _window
        ,"CUR"
            ,IF ( _flash, [Sel PTD To Ix], [Sel To Ix] )
        ,"LY"
            ,IF ( _flash, [Sel PTD LY To Ix], [Sel LY To Ix] )
        ,"PREV"
            ,IF ( _flash, [Sel PTD Prev To Ix], [Sel Prev To Ix] )
        ,"ITEM"
            ,[Sel To Ix]
        ,"BAR"
            ,SELECTEDVALUE ( 'Bar Item'[to_ix] )
    )
```

### Metric Value

The dispatcher: the engine measure of the single `Metric[metric_code]` in context, over whatever `Week` rows are in
context. Format `0.000000` (validation only).

```dax
Metric Value =
VAR _code         = SELECTEDVALUE ( 'Metric'[metric_code] )
RETURN
    SWITCH (
        _code
        ,"gross_sales"
            ,[Gross Sales]
        ,"markdown"
            ,[Markdown]
        ,"returns"
            ,[Returns]
        ,"net_sales"
            ,[Net Sales]
        ,"cogs"
            ,[COGS]
        ,"back_margin"
            ,[Back Margin]
        ,"front_margin"
            ,[Front Margin]
        ,"total_margin"
            ,[Total Margin]
        ,"front_gm_pct"
            ,[Front GM %]
        ,"back_margin_pct"
            ,[Back Margin %]
        ,"total_margin_pct"
            ,[Total Margin %]
        ,"markdown_pct"
            ,[Markdown %]
        ,"opex_shrink"
            ,[Opex Shrink]
        ,"opex_store"
            ,[Opex Store]
        ,"opex_central"
            ,[Opex Central]
        ,"opex_fulfilment"
            ,[Opex Fulfilment]
        ,"ebitda"
            ,[EBITDA]
        ,"ebitda_margin_pct"
            ,[EBITDA Margin %]
        ,"po_lines_due"
            ,[PO Lines Due]
        ,"po_lines_otif"
            ,[PO Lines OTIF]
        ,"otif_pct"
            ,[OTIF %]
        ,"otif_target"
            ,[OTIF Target]
        ,"store_net_sales"
            ,[Store Net Sales]
        ,"store_net_sales_ly"
            ,[Store Net Sales LY]
        ,"lfl_net_sales"
            ,[LFL Net Sales]
        ,"lfl_net_sales_ly"
            ,[LFL Net Sales LY]
        ,"lfl_store_count"
            ,[LFL Store Count]
        ,"lfl_growth_pct"
            ,[LFL Growth %]
        ,"nonlfl_effect_pp"
            ,[Non-LFL Effect pp]
        ,"on_hand_cost"
            ,[On Hand Cost]
        ,"on_order_cost"
            ,[On Order Cost]
        ,"forecast_cogs"
            ,[Forecast COGS]
        ,"stock_incl_on_order"
            ,[Stock Incl On Order]
        ,"weeks_of_cover"
            ,[Weeks of Cover]
        ,"cover_target_wks"
            ,[Cover Target Wks]
        ,"ranged_sku_days"
            ,[Ranged SKU Days]
        ,"in_stock_sku_days"
            ,[In Stock SKU Days]
        ,"availability_pct"
            ,[Availability %]
        ,"availability_target"
            ,[Availability Target]
        ,"season_opening_units"
            ,[Season Opening Units]
        ,"season_receipt_units"
            ,[Season Receipt Units]
        ,"season_units_sold"
            ,[Season Units Sold]
        ,"sell_through_pct"
            ,[Sell-through %]
        ,"sell_through_target"
            ,[Sell-through Target]
        ,"gmroi_front_margin_r52w"
            ,[GMROI Front Margin R52W]
        ,"gmroi_avg_on_hand_cost"
            ,[GMROI Avg On Hand Cost]
        ,"gmroi"
            ,[GMROI]
        ,"gmroi_target"
            ,[GMROI Target]
        ,"mix_store_net_sales"
            ,[Mix Store Net Sales]
        ,"mix_online_net_sales"
            ,[Mix Online Net Sales]
        ,"mix_wholesale_net_sales"
            ,[Mix Wholesale Net Sales]
        ,"mix_store_pct"
            ,[Mix Store %]
        ,"mix_online_pct"
            ,[Mix Online %]
        ,"mix_wholesale_pct"
            ,[Mix Wholesale %]
        ,"net_sales_bud"
            ,[Net Sales Budget]
        ,"gross_sales_bud"
            ,[Gross Sales Budget]
        ,"markdown_bud"
            ,[Markdown Budget]
        ,"cogs_bud"
            ,[COGS Budget]
        ,"back_margin_bud"
            ,[Back Margin Budget]
        ,"markdown_pct_bud"
            ,[Markdown % Budget]
        ,"front_gm_pct_bud"
            ,[Front GM % Budget]
        ,"total_margin_pct_bud"
            ,[Total Margin % Budget]
        ,"opex_shrink_bud"
            ,[Opex Shrink Budget]
        ,"opex_store_bud"
            ,[Opex Store Budget]
        ,"opex_central_bud"
            ,[Opex Central Budget]
        ,"opex_fulfilment_bud"
            ,[Opex Fulfilment Budget]
        ,"ebitda_bud"
            ,[EBITDA Budget]
        ,"ebitda_margin_pct_bud"
            ,[EBITDA Margin % Budget]
        ,"lfl_net_sales_bud"
            ,[LFL Net Sales Budget]
        ,"lfl_growth_pct_bud"
            ,[LFL Growth % Budget]
        ,"mix_store_pct_bud"
            ,[Mix Store % Budget]
        ,"mix_online_pct_bud"
            ,[Mix Online % Budget]
        ,"mix_wholesale_pct_bud"
            ,[Mix Wholesale % Budget]
        ,"mix_max_dev_pp"
            ,[Mix Max Dev pp]
        ,"mix_max_dev_channel"
            ,[Mix Max Dev Channel]
        ,"ebitda_ptd"
            ,[EBITDA]
        ,"ebitda_bud_ptd"
            ,[EBITDA Budget]
        ,"flash.net_sales"
            ,[Net Sales]
        ,"flash.net_sales_bud"
            ,[Net Sales Budget]
        ,"flash.total_margin"
            ,[Total Margin]
        ,"trading_stores"
            ,[Trading Stores]
        ,"suppliers_below_85"
            ,[Suppliers Below 85]
    )
```

### Metric In Window

```dax
Metric In Window =
VAR _from         = [Win From Ix]
VAR _to           = [Win To Ix]
RETURN
    IF (
        NOT ISBLANK ( _from ) && NOT ISBLANK ( _to )
        ,CALCULATE (
            [Metric Value]
            ,REMOVEFILTERS ( 'Week' )
            ,'Week'[week_ix] >= _from && 'Week'[week_ix] <= _to
        )
    )
```

### Actual · Basis · Last Year · Previous · Comparison

The four columns of the catalogue (CM `value`): `actual` = the picked period, `basis` = the card's status basis
(budget / target / plan, from `Metric[basis_code]`), `ly`, `prev`. Format `0.000000`.

```dax
Actual =
CALCULATE (
    [Metric In Window]
    ,'Window'[window_code] = "CUR"
)
```

```dax
Basis =
VAR _basis        = SELECTEDVALUE ( 'Metric'[basis_code] )
RETURN
    IF (
        NOT ISBLANK ( _basis )
        ,CALCULATE (
            [Metric In Window]
            ,REMOVEFILTERS ( 'Metric' )
            ,'Metric'[metric_code] = _basis
            ,'Window'[window_code] = "CUR"
        )
    )
```

```dax
Last Year =
CALCULATE (
    [Metric In Window]
    ,'Window'[window_code] = "LY"
)
```

```dax
Previous =
CALCULATE (
    [Metric In Window]
    ,'Window'[window_code] = "PREV"
)
```

```dax
Comparison =
SWITCH (
    [Sel Comparator]
    ,"budget"
        ,[Basis]
    ,"ly"
        ,[Last Year]
    ,"prev"
        ,[Previous]
)
```

---

## 3 Card

Every card visual carries a visual-level filter `Card[kpi_code] = "<CODE>"` (or uses the wrapper measures of
`05-pages.md` › "Wrapper measures"). The attribute slicers filter `Card[group_label] / [lever_label] / [owner_label]`;
`[Card Code]` ignores them, `[Card Revealed]` reads them.

### Card Code · Card Revealed

```dax
Card Code =
CALCULATE (
    SELECTEDVALUE ( 'Card'[kpi_code] )
    ,REMOVEFILTERS (
        'Card'[group_label]
        ,'Card'[group_sort]
        ,'Card'[lever_label]
        ,'Card'[lever_sort]
        ,'Card'[owner_label]
        ,'Card'[owner_sort]
    )
)
```

Revealed = the card matches every attribute pick (OR inside an attribute, AND across; V 559–563). Boolean.

```dax
Card Revealed =
VAR _code         = [Card Code]
RETURN
    NOT ISBLANK ( _code ) && COUNTROWS ( 'Card' ) = 1
```

### Card lookups (21 measures, one pattern)

```dax
<Name> =
VAR _code         = [Card Code]
RETURN
    CALCULATE (
        SELECTEDVALUE ( 'Card'[<column>] )
        ,REMOVEFILTERS ( 'Card' )
        ,'Card'[kpi_code] = _code
    )
```

| Measure | Column | Measure | Column |
|---|---|---|---|
| Card Title | kpi_name | Card Is Provisional | is_provisional |
| Card Size | size | Card Rule | rule |
| Card Tier | tier | Card What | what |
| Card Metric Code | metric_code | Card Why | why |
| Card Series Metric | series_metric | Card Formula | formula |
| Card Delta Kind | delta_kind | Card Cadence | cadence |
| Card Budget Delta Label | budget_delta_label | Card Provisional Note | provisional_note |
| Card Target Style | target_style | Card Drill Page | drill_page_label |
| Card Basis Label | basis_label | Card Group Label | group_label |
| Card Sub Base | sub_base | Card Lever Label | lever_label |
| | | Card Owner Label | owner_label |

### Card Actual · Card Basis · Card Last Year · Card Previous · Card Comparison

```dax
Card Actual =
VAR _metric       = [Card Metric Code]
RETURN
    CALCULATE (
        [Actual]
        ,REMOVEFILTERS ( 'Metric' )
        ,'Metric'[metric_code] = _metric
    )
```

`Card Basis`, `Card Last Year`, `Card Previous` and `Card Comparison` are the same with `[Basis]`, `[Last Year]`,
`[Previous]`, `[Comparison]`. Format `0.000000`.

### Card Category NA

The N/A face under a category pick (V 500–510, 543–553): EBITDA and Supplier OTIF always; Sell-through when the pick
holds no seasonal category. Boolean.

```dax
Card Category NA =
VAR _code         = [Card Code]
RETURN
    [Category Pick Active]
        && (
            _code IN { "EBITDA", "SUPPLIER_OTIF" }
                || ( _code = "SELL_THROUGH" && [Seasonal In Pick] = 0 )
        )
```

### Card Badness

Direction-adjusted shortfall vs the basis (M `badness`, lines 89–145); BLANK = N/A. Format `0.000000`.

```dax
Card Badness =
VAR _code         = [Card Code]
VAR _a            = [Card Actual]
VAR _b            = [Card Basis]
VAR _both         = NOT ISBLANK ( _a ) && NOT ISBLANK ( _b )
VAR _mix_dev      =
    CALCULATE (
        [Actual]
        ,REMOVEFILTERS ( 'Metric' )
        ,'Metric'[metric_code] = "mix_max_dev_pp"
    )
RETURN
    SWITCH (
        _code
        ,"NET_SALES"
            ,IF ( _both && _b <> 0, 1 - _a / _b )
        ,"EBITDA"
            ,IF ( _both, 1 - _a / _b )
        ,"TOTAL_MARGIN"
            ,IF ( _both, _b - _a )
        ,"LFL_GROWTH"
            ,IF ( _both, _b - _a )
        ,"FRONT_GM"
            ,IF ( _both, _b - _a )
        ,"MARKDOWN"
            ,IF ( _both, _a - _b )
        ,"WEEKS_OF_COVER"
            ,IF ( _both, ABS ( _a - _b ) )
        ,"AVAILABILITY"
            ,IF ( _both, _b - _a )
        ,"SELL_THROUGH"
            ,IF ( _both, _b - _a )
        ,"GMROI"
            ,IF ( _both, _b - _a )
        ,"SUPPLIER_OTIF"
            ,IF ( _both, _b - _a )
        ,"CHANNEL_MIX"
            ,IF ( NOT ISBLANK ( _mix_dev ), ABS ( _mix_dev ) )
    )
```

### Card Status Code

1 On track · 2 Watch · 3 Off track · BLANK N/A. Badness rounded to 10 decimals; a value exactly on the watch edge is
On track, exactly on the off edge Watch (S 21–26). Format `0`.

```dax
Card Status Code =
VAR _code         = [Card Code]
VAR _bad          = [Card Badness]
VAR _watch        =
    CALCULATE (
        MAX ( 'Status Rule'[watch_from] )
        ,REMOVEFILTERS ( 'Status Rule' )
        ,'Status Rule'[rule_code] = _code
    )
VAR _off          =
    CALCULATE (
        MAX ( 'Status Rule'[off_from] )
        ,REMOVEFILTERS ( 'Status Rule' )
        ,'Status Rule'[rule_code] = _code
    )
VAR _b            = ROUND ( _bad, 10 )
RETURN
    SWITCH (
        TRUE ()
        ,ISBLANK ( _bad )
            ,BLANK ()
        ,_b <= _watch
            ,1
        ,_b <= _off
            ,2
        ,3
    )
```

### Card status words (5)

```dax
Card Status Key =
SWITCH ( [Card Status Code], 1, "good", 2, "watch", 3, "off", "na" )
```

```dax
Card Status Word =
SWITCH ( [Card Status Code], 1, "On track", 2, "Watch", 3, "Off track", "N/A" )
```

```dax
Card Status Glyph =
SWITCH ( [Card Status Code], 1, "▲", 2, "●", 3, "▼", "–" )
```

Small cards show the glyph only (V 36 of card.tsx; C `STATUS_GLYPH`).

```dax
Card Chip Text =
IF (
    [Card Size] = "sm"
    ,[Card Status Glyph]
    ,[Card Status Glyph] & " " & [Card Status Word]
)
```

```dax
Card Status Colour =
SWITCH ( [Card Status Code], 1, "#136C3A", 2, "#9A5B00", 3, "#C0272D", "#5F6878" )
```

### Card Sub

The muted sub-title after the card title (V `subTitle`, 630–645, plus " · prov."). Small cards hide it on the face; the
ⓘ eyebrow always shows it.

```dax
Card Sub =
VAR _code         = [Card Code]
VAR _scope_word   =
    SWITCH ( [Sel Region Code], "nl", "Netherlands", "be", "Belgium", "online", "online", "all channels" )
VAR _base         =
    SWITCH (
        _code
        ,"NET_SALES"
            ,[Sel Window Phrase] & ", " & _scope_word
        ,"EBITDA"
            ,IF ( [Sel Gran] = "W", "month " & [Sel Last Period] & " to date", [Sel Window Phrase] )
        ,"LFL_GROWTH"
            ,"vs LY " & [Sel Word Noun]
        ,[Card Sub Base]
    )
RETURN
    _base & IF ( [Card Is Provisional], " · prov.", "" )
```

### Card Value Text · Card Unit Text · Card Value Display

V `numbers()` lines 698–1142: Net sales, EBITDA, Supplier OTIF and Channel mix always print a number (blank → 0);
the others print `n/a` with no unit when blank; the N/A face prints `–`.

```dax
Card Value Text =
VAR _code         = [Card Code]
VAR _a            = [Card Actual]
VAR _a0           = COALESCE ( _a, 0 )
VAR _sign         = IF ( _a0 < 0, "−", "" )
RETURN
    SWITCH (
        TRUE ()
        ,[Card Category NA]
            ,"–"
        ,_code IN { "NET_SALES", "EBITDA" }
            ,_sign & "€" & FORMAT ( ABS ( _a0 ) / 1000000, IF ( ABS ( _a0 ) >= 1000000000, "#,0", "#,0.0" ) )
        ,NOT ( _code IN { "SUPPLIER_OTIF", "CHANNEL_MIX" } ) && ISBLANK ( _a )
            ,"n/a"
        ,_code = "LFL_GROWTH"
            ,IF ( _a >= 0, "+", "−" ) & FORMAT ( ABS ( _a ) * 100, "#,0.0" )
        ,_code IN { "WEEKS_OF_COVER", "GMROI" }
            ,_sign & FORMAT ( ABS ( _a0 ), "#,0.0" )
        ,_sign & FORMAT ( ABS ( _a0 ) * 100, "#,0.0" )
    )
```

```dax
Card Unit Text =
VAR _code         = [Card Code]
VAR _a            = [Card Actual]
RETURN
    SWITCH (
        TRUE ()
        ,[Card Category NA]
            ,""
        ,_code IN { "NET_SALES", "EBITDA" }
            ,"m"
        ,_code = "CHANNEL_MIX"
            ,"% store"
        ,_code = "SUPPLIER_OTIF"
            ,"%"
        ,ISBLANK ( _a )
            ,""
        ,_code = "WEEKS_OF_COVER"
            ,"wks"
        ,_code = "GMROI"
            ,"×"
        ,"%"
    )
```

One-string form for visuals that cannot style two runs ("€61.4m", "11.4 wks", "68.4% store"):

```dax
Card Value Display =
VAR _value        = [Card Value Text]
VAR _unit         = [Card Unit Text]
RETURN
    _value
        & IF (
            _unit = ""
            ,""
            ,IF ( LEFT ( _unit, 1 ) IN { "m", "%", "×" }, _unit, " " & _unit )
        )
```

### Card Basis Text · Card Basis Unit · Card Target Line

The ⓘ figure block's second line (label `Budget` / `Target` / `Plan` from `Card[basis_label]`), formatted like the
value; `–` when blank (V 594–600, layers.tsx `ExplainPop`).

```dax
Card Basis Text =
VAR _code         = [Card Code]
VAR _b            = [Card Basis]
VAR _sign         = IF ( _b < 0, "−", "" )
RETURN
    SWITCH (
        TRUE ()
        ,[Card Category NA] || ISBLANK ( _b )
            ,"–"
        ,_code IN { "NET_SALES", "EBITDA" }
            ,_sign & "€" & FORMAT ( ABS ( _b ) / 1000000, IF ( ABS ( _b ) >= 1000000000, "#,0", "#,0.0" ) )
        ,_code = "LFL_GROWTH"
            ,IF ( _b >= 0, "+", "−" ) & FORMAT ( ABS ( _b ) * 100, "#,0.0" )
        ,_code IN { "WEEKS_OF_COVER", "GMROI" }
            ,_sign & FORMAT ( ABS ( _b ), "#,0.0" )
        ,_sign & FORMAT ( ABS ( _b ) * 100, "#,0.0" )
    )
```

```dax
Card Basis Unit =
VAR _code         = [Card Code]
RETURN
    IF (
        [Card Basis Text] = "–"
        ,""
        ,SWITCH (
            _code
            ,"NET_SALES"
                ,"m"
            ,"EBITDA"
                ,"m"
            ,"WEEKS_OF_COVER"
                ,"wks"
            ,"GMROI"
                ,"×"
            ,"CHANNEL_MIX"
                ,"% store"
            ,"%"
        )
    )
```

```dax
Card Target Line =
VAR _unit         = [Card Basis Unit]
RETURN
    [Card Basis Label] & " " & [Card Basis Text]
        & IF ( _unit = "" || LEFT ( _unit, 1 ) IN { "m", "%", "×" }, _unit, " " & _unit )
```

### Card Delta Text

The Δ line (V `eurDeltaText` 666–680, `ppDeltaText` 683–696, cards 768–808, 1043–1057). Labels: Budget →
`Card[budget_delta_label]`; Last year → "vs LY"; Previous → the granularity's short word, but **EBITDA at Week vs
Previous → "vs prev. mth"** (its window is month to date).

```dax
Card Delta Text =
VAR _code         = [Card Code]
VAR _kind         = [Card Delta Kind]
VAR _cmp          = [Sel Comparator]
VAR _label        =
    SWITCH (
        _cmp
        ,"budget"
            ,[Card Budget Delta Label]
        ,"ly"
            ,"vs LY"
        ,IF ( _code = "EBITDA" && [Sel Gran] = "W", "vs prev. mth", [Sel Word Short] )
    )
VAR _a            = [Card Actual]
VAR _b            = [Card Comparison]
VAR _d            = _a - _b
VAR _missing      = ISBLANK ( _a ) || ISBLANK ( _b )
VAR _pp           = IF ( _d >= 0, "+", "−" ) & FORMAT ( ABS ( _d ) * 100, "#,0.0" ) & " pp"
VAR _b_pct        = IF ( _b < 0, "−", "" ) & FORMAT ( ABS ( _b ) * 100, "#,0.0" ) & "%"
VAR _b_t          = FORMAT ( _b * 100, "#,0.0" )
VAR _b_trim       = IF ( RIGHT ( _b_t, 2 ) = ".0", LEFT ( _b_t, LEN ( _b_t ) - 2 ), _b_t ) & "%"
VAR _b_num        = IF ( _b < 0, "−", "" ) & FORMAT ( ABS ( _b ), "#,0.0" )
VAR _eur          =
    IF ( _d >= 0, "+", "−" ) & "€"
        & FORMAT ( ABS ( _d ) / 1000000, IF ( ABS ( _d ) >= 1000000000, "#,0", "#,0.0" ) ) & "m"
VAR _ratio        = DIVIDE ( _a, _b ) - 1
VAR _ratio_txt    = IF ( _ratio >= 0, "+", "−" ) & FORMAT ( ABS ( _ratio ) * 100, "#,0.0" ) & "%"
VAR _signed       = IF ( _d >= 0, "+", "−" ) & FORMAT ( ABS ( _d ), "#,0.0" )
RETURN
    SWITCH (
        TRUE ()
        ,[Card Category NA]
            ,"n/a by category"
        ,_kind = "MIX"
            ,[Card Mix Delta Text]
        ,_missing
            ,"n/a " & _label
        ,_kind = "EUR"
            ,_eur & " (" & _ratio_txt & ") " & _label
        ,_kind = "PP"
            ,_pp & " " & _label & " " & IF ( [Card Target Style] && _cmp = "budget", _b_trim, _b_pct )
        ,_kind = "WKS"
            ,_signed & " wks " & _label & " " & _b_num
        ,_kind = "X"
            ,_signed & "× " & _label & " " & _b_num & "×"
    )
```

### Card Mix Delta Text

Channel mix Δ: the channel with the largest absolute deviation from the basis shares (plan under Budget, the LY or
previous shares otherwise), first on a tie (V 1102–1118, `largestDeviation` 1209–1220). Shares default to 0.

```dax
Card Mix Delta Text =
VAR _cmp          = [Sel Comparator]
VAR _label        = SWITCH ( _cmp, "budget", "vs plan", "ly", "vs LY", [Sel Word Short] )
VAR _window       = SWITCH ( _cmp, "ly", "LY", "prev", "PREV", "CUR" )
VAR _s1           = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_store_pct" ) + 0
VAR _s2           = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_online_pct" ) + 0
VAR _s3           = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_wholesale_pct" ) + 0
VAR _b1           =
    IF (
        _cmp = "budget"
        ,CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_store_pct_bud" )
        ,CALCULATE ( [Metric In Window], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_store_pct", 'Window'[window_code] = _window )
    )
VAR _b2           =
    IF (
        _cmp = "budget"
        ,CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_online_pct_bud" )
        ,CALCULATE ( [Metric In Window], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_online_pct", 'Window'[window_code] = _window )
    )
VAR _b3           =
    IF (
        _cmp = "budget"
        ,CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_wholesale_pct_bud" )
        ,CALCULATE ( [Metric In Window], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_wholesale_pct", 'Window'[window_code] = _window )
    )
VAR _missing      = ISBLANK ( _b1 ) || ISBLANK ( _b2 ) || ISBLANK ( _b3 )
VAR _d1           = _s1 - _b1
VAR _d2           = _s2 - _b2
VAR _d3           = _s3 - _b3
VAR _i12          = IF ( ABS ( _d2 ) > ABS ( _d1 ), 2, 1 )
VAR _dev12        = IF ( _i12 = 2, _d2, _d1 )
VAR _i            = IF ( ABS ( _d3 ) > ABS ( _dev12 ), 3, _i12 )
VAR _dev          = IF ( _i = 3, _d3, _dev12 )
VAR _channel      = SWITCH ( _i, 1, "store", 2, "online", 3, "wholesale" )
RETURN
    IF (
        _missing
        ,"n/a " & _label
        ,_channel & " " & IF ( _dev >= 0, "+", "−" ) & FORMAT ( ABS ( _dev ) * 100, "#,0.0" ) & " pp " & _label
    )
```

### Card Delta Is NA

A Δ without a comparison value is muted whatever the status (V 593). Boolean.

```dax
Card Delta Is NA =
LEFT ( [Card Delta Text], 3 ) = "n/a"
```

### Card colours (8)

Hex strings for conditional formatting (`07-theme.md`). Faded = the card is concealed by an attribute pick (web:
opacity 8 %, greyscale).

```dax
Card Fill Colour =
SWITCH (
    TRUE ()
    ,NOT [Card Revealed]
        ,"#FFFFFF"
    ,[Card Status Code] = 2
        ,"#FFF4E7"
    ,[Card Status Code] = 3
        ,"#FCF2F1"
    ,"#FFFFFF"
)
```

```dax
Card Border Colour =
SWITCH (
    TRUE ()
    ,NOT [Card Revealed]
        ,"#F3F4F6"
    ,[Card Status Code] = 3
        ,"#C0272D"
    ,"#E5E7EB"
)
```

```dax
Card Ink Colour =
IF ( [Card Revealed], "#111827", "#ECEDEE" )
```

```dax
Card Muted Colour =
IF ( [Card Revealed], "#5F6878", "#ECEDEE" )
```

```dax
Card Delta Colour =
SWITCH (
    TRUE ()
    ,NOT [Card Revealed]
        ,"#ECEDEE"
    ,[Card Delta Is NA] || ISBLANK ( [Card Status Code] )
        ,"#5F6878"
    ,[Card Status Colour]
)
```

```dax
Card Chip Fill =
IF (
    NOT [Card Revealed]
    ,"#F9FAFB"
    ,SWITCH ( [Card Status Code], 1, "#E1F0E5", 2, "#FBEFD6", 3, "#FAE3E3", "#F6F7F9" )
)
```

```dax
Card Chip Font =
IF ( NOT [Card Revealed], "#ECEDEE", [Card Status Colour] )
```

```dax
Card Chip Tooltip =
[Card Title] & " · " & [Card Status Word] & " · " & [Card Rule]
```

---

## 4 Bars

Axis: `'Bar Item'[bar_label_u]` (sorted by `item_id`). Visual-level filter `[Bar In Series]` is 1. Columns =
`[Bar Value]`, line = `[Bar Target]`. Values: the 13 / 12 / 8 / 2 items ending at the picked one, each its own whole
window (EBITDA at Week: weekly EBITDA, not month to date); target = the card basis of the **picked item's own
window** (V 571–579, I `seriesOf`).

```dax
Bar In Series =
VAR _gran         = [Sel Gran]
VAR _sel_ord      = [Sel Item Ord]
VAR _count        = [Sel Bar Count]
VAR _bar_gran     = SELECTEDVALUE ( 'Bar Item'[gran] )
VAR _bar_ord      = SELECTEDVALUE ( 'Bar Item'[item_ord] )
RETURN
    IF (
        _bar_gran = _gran
            && _bar_ord <= _sel_ord
            && _bar_ord > _sel_ord - _count
            && NOT ISBLANK ( [Card Series Metric] )
        ,1
        ,0
    )
```

```dax
Bar Value =
VAR _metric       = [Card Series Metric]
RETURN
    IF (
        NOT ISBLANK ( _metric ) && [Bar In Series] = 1
        ,CALCULATE (
            [Metric In Window]
            ,REMOVEFILTERS ( 'Metric' )
            ,'Metric'[metric_code] = _metric
            ,'Window'[window_code] = "BAR"
        )
    )
```

```dax
Bar Target Value =
VAR _metric       = [Card Series Metric]
VAR _basis        =
    CALCULATE (
        SELECTEDVALUE ( 'Metric'[basis_code] )
        ,REMOVEFILTERS ( 'Metric' )
        ,'Metric'[metric_code] = _metric
    )
RETURN
    IF (
        NOT ISBLANK ( _basis )
        ,CALCULATE (
            [Metric In Window]
            ,REMOVEFILTERS ( 'Metric' )
            ,'Metric'[metric_code] = _basis
            ,'Window'[window_code] = "ITEM"
        )
    )
```

```dax
Bar Target =
IF ( [Bar In Series] = 1, [Bar Target Value] )
```

Current bar in the status colour (muted when N/A), the others `#D1D5DB`.

```dax
Bar Colour =
VAR _is_current   = SELECTEDVALUE ( 'Bar Item'[item_id] ) = [Sel Item Id]
RETURN
    SWITCH (
        TRUE ()
        ,NOT [Card Revealed]
            ,"#F3F4F6"
        ,_is_current
            ,[Card Status Colour]
        ,"#D1D5DB"
    )
```

Y-axis range (bars.ts `barGeometry`): pad 60 % of the range below and 15 % above, over the bar values and the target;
nothing known → 0 … 1. Use as fx for the value axis Start / End.

```dax
Bar Axis Min =
VAR _rows         =
    FILTER (
        ADDCOLUMNS ( ALL ( 'Bar Item' ), "@v", [Bar Value] )
        ,NOT ISBLANK ( [@v] )
    )
VAR _t            = [Bar Target Value]
VAR _lo_v         = MINX ( _rows, [@v] )
VAR _hi_v         = MAXX ( _rows, [@v] )
VAR _lo           =
    SWITCH (
        TRUE ()
        ,ISBLANK ( _lo_v ) && ISBLANK ( _t )
            ,0
        ,ISBLANK ( _lo_v )
            ,_t
        ,ISBLANK ( _t )
            ,_lo_v
        ,IF ( _t < _lo_v, _t, _lo_v )
    )
VAR _hi           =
    SWITCH (
        TRUE ()
        ,ISBLANK ( _hi_v ) && ISBLANK ( _t )
            ,1
        ,ISBLANK ( _hi_v )
            ,_t
        ,ISBLANK ( _t )
            ,_hi_v
        ,IF ( _t > _hi_v, _t, _hi_v )
    )
VAR _range        = IF ( _hi - _lo = 0, 1, _hi - _lo )
RETURN
    _lo - 0.6 * _range
```

`Bar Axis Max` is the same with `RETURN _hi + 0.15 * _range`.

---

## 5 Status strip

Counts and dot are computed over all twelve cards in the current period / region / category, **ignoring the attribute
picks** (V 284–296; S `dotOf` 72–79).

```dax
Status Count On =
COUNTROWS ( FILTER ( ALL ( 'Card' ), [Card Status Code] = 1 ) ) + 0
```

```dax
Status Count Watch =
COUNTROWS ( FILTER ( ALL ( 'Card' ), [Card Status Code] = 2 ) ) + 0
```

```dax
Status Count Off =
COUNTROWS ( FILTER ( ALL ( 'Card' ), [Card Status Code] = 3 ) ) + 0
```

```dax
Status Count NA =
COUNTROWS ( ALL ( 'Card' ) ) - [Status Count On] - [Status Count Watch] - [Status Count Off]
```

```dax
Status Rated =
[Status Count On] + [Status Count Watch] + [Status Count Off]
```

```dax
Dot Code =
VAR _on           = [Status Count On]
VAR _watch        = [Status Count Watch]
VAR _off          = [Status Count Off]
VAR _rated        = _on + _watch + _off
VAR _red          =
    CALCULATE ( MAX ( 'Status Rule'[threshold] ), REMOVEFILTERS ( 'Status Rule' ), 'Status Rule'[rule_code] = "DOT_RED_OFF" )
VAR _orange       =
    CALCULATE ( MAX ( 'Status Rule'[threshold] ), REMOVEFILTERS ( 'Status Rule' ), 'Status Rule'[rule_code] = "DOT_ORANGE_WATCH_OFF" )
VAR _green        =
    CALCULATE ( MAX ( 'Status Rule'[threshold] ), REMOVEFILTERS ( 'Status Rule' ), 'Status Rule'[rule_code] = "DOT_GREEN_GOOD" )
RETURN
    SWITCH (
        TRUE ()
        ,_rated = 0
            ,BLANK ()
        ,_off / _rated >= _red
            ,3
        ,( _watch + _off ) / _rated > _orange
            ,2
        ,_on / _rated >= _green
            ,1
        ,2
    )
```

```dax
Dot Key =
SWITCH ( [Dot Code], 1, "green", 2, "orange", 3, "red", "grey" )
```

```dax
Dot Colour =
SWITCH ( [Dot Code], 1, "#2E9E5B", 2, "#E3A52A", 3, "#B3261E", "#9AA1AD" )
```

```dax
Dot Tooltip Title =
"Overall: " & [Dot Key]
```

```dax
Dot Tooltip Body =
VAR _on           = [Status Count On]
VAR _watch        = [Status Count Watch]
VAR _off          = [Status Count Off]
VAR _rated        = _on + _watch + _off
VAR _over         =
    IF ( _rated = 12, "all 12 cards", "the " & _rated & " cards with a status (N/A excluded)" )
RETURN
    IF (
        _rated = 0
        ," · no rated card."
        ," · computed over " & _over & ", filters ignored. "
            & "Red if off track ≥ 1/3 · else orange if watch + off track > 50% · else green if on track ≥ 2/3 · else orange. "
            & "Now: off track " & _off & " (" & ROUND ( 100 * _off / _rated, 0 ) & "%), "
            & "watch + off " & ( _watch + _off ) & " (" & ROUND ( 100 * ( _watch + _off ) / _rated, 0 ) & "%), "
            & "on track " & _on & " (" & ROUND ( 100 * _on / _rated, 0 ) & "%)."
    )
```

```dax
Status Count On Text =
"▲ " & [Status Count On] & " on track"
```

```dax
Status Count Watch Text =
"● " & [Status Count Watch] & " watch"
```

```dax
Status Count Off Text =
"▼ " & [Status Count Off] & " off track"
```

Shown = cards matching the attribute picks (page context, no visual filter).

```dax
Status Shown =
COUNTROWS ( 'Card' ) + 0
```

```dax
Status Summary Bold =
[Status Shown] & " of 12 metrics"
```

Picked attribute labels in menu order (Group, then Lever, then Owner), "All" when none (V 290–305).

```dax
Attr Picks Text =
VAR _group        =
    IF (
        ISFILTERED ( 'Card'[group_label] )
        ,CONCATENATEX ( FILTERS ( 'Card'[group_label] ), 'Card'[group_label], ", ", 'Card'[group_label], ASC )
    )
VAR _lever        =
    IF (
        ISFILTERED ( 'Card'[lever_label] )
        ,CONCATENATEX (
            FILTERS ( 'Card'[lever_label] )
            ,'Card'[lever_label]
            ,", "
            ,SWITCH ( 'Card'[lever_label], "Sales", 1, "Margin", 2, "Stock", 3, "Supply", 4, "Cash", 5 )
            ,ASC
        )
    )
VAR _owner        =
    IF (
        ISFILTERED ( 'Card'[owner_label] )
        ,CONCATENATEX (
            FILTERS ( 'Card'[owner_label] )
            ,'Card'[owner_label]
            ,", "
            ,SWITCH ( 'Card'[owner_label], "Commercial", 1, "Supply chain", 2, "Finance", 3, "Digital", 4 )
            ,ASC
        )
    )
VAR _all          =
    _group
        & IF ( LEN ( _group ) > 0 && LEN ( _lever & _owner ) > 0, ", " )
        & _lever
        & IF ( LEN ( _lever ) > 0 && LEN ( _owner ) > 0, ", " )
        & _owner
RETURN
    IF ( LEN ( _all ) = 0, "All", _all )
```

```dax
Attr Picks Count =
IF ( ISFILTERED ( 'Card'[group_label] ), COUNTROWS ( FILTERS ( 'Card'[group_label] ) ) )
    + IF ( ISFILTERED ( 'Card'[lever_label] ), COUNTROWS ( FILTERS ( 'Card'[lever_label] ) ) )
    + IF ( ISFILTERED ( 'Card'[owner_label] ), COUNTROWS ( FILTERS ( 'Card'[owner_label] ) ) )
    + 0
```

```dax
Status Picks Text =
" · " & [Attr Picks Text]
```

(The Filters badge shows `[Attr Picks Count]` when > 0; the category pick never counts: V 352–355 of the category test.)

---

## 6 Header & copy

Header runs (V `header` 348–388): **bold** runs and regular runs sit side by side in one text box.

```dax
Hdr Period Bold =
[Sel Title]
```

```dax
Hdr Period Rest =
[Sel Header Period Rest]
```

```dax
Hdr Compare Label =
SWITCH ( [Sel Comparator], "budget", "Budget", "ly", "Last year", [Sel Word Prev] )
```

Rendered as "vs " + **label** + suffix.

```dax
Hdr Compare Suffix =
IF (
    [Sel Comparator] = "ly"
    ,IF ( [Sel Gran] = "W", " (same retail week)", " (same retail weeks)" )
    ,""
)
```

```dax
Hdr Region Bold =
SWITCH ( [Sel Region Code], "online", "Online", "nl", "Netherlands", "be", "Belgium", "" )
```

```dax
Hdr Region Rest =
VAR _region       =
    SWITCH ( [Sel Region Code], "all", "All regions & formats", "online", " only", " · all formats" )
RETURN
    _region & IF ( [Category Pick Active], " · " & [Category Pick Label], "" )
```

```dax
Hdr Refreshed =
"Refreshed " & [Refreshed Long]
```

Category names of the pick, in `sort_order`.

```dax
Category Pick Names =
IF (
    [Category Pick Active]
    ,CONCATENATEX (
        SUMMARIZE ( 'Category', 'Category'[category_name], 'Category'[sort_order] )
        ,'Category'[category_name]
        ,", "
        ,'Category'[sort_order]
        ,ASC
    )
)
```

"Electronics" · "Electronics & Toys & leisure" · "3 categories"; "All categories" with no pick (V `pickLabel`).

```dax
Category Pick Label =
VAR _n            = COUNTROWS ( VALUES ( 'Category'[category_code] ) )
RETURN
    SWITCH (
        TRUE ()
        ,NOT [Category Pick Active]
            ,"All categories"
        ,_n <= 2
            ,CONCATENATEX (
                SUMMARIZE ( 'Category', 'Category'[category_name], 'Category'[sort_order] )
                ,'Category'[category_name]
                ," & "
                ,'Category'[sort_order]
                ,ASC
            )
        ,_n & " categories"
    )
```

```dax
Hdr Region Tooltip =
IF ( COUNTROWS ( VALUES ( 'Category'[category_code] ) ) >= 3 && [Category Pick Active], [Category Pick Names] )
```

How-to-read (V `how` 1301–1352):

```dax
How Eyebrow =
"Nordmark · " & [Sel Title]
```

```dax
How Compare Name =
SWITCH ( [Sel Comparator], "budget", "Budget", "ly", "Last year", "Previous" )
```

```dax
Filters Showing =
"Showing " & [Sel Title] & [Sel Header Period Rest]
```

---

## 7 Explain (the ⓘ pop-up)

All read `[Card Code]` from the Explain page's card picker (`06-interactions.md`). The N/A face turns every stat value
into `n/a` and the worked example into the note (V 543–553).

### Explain Eyebrow · Explain Delta · Explain Updated · Explain Drill Label

```dax
Explain Eyebrow =
IF ( [Card Tier] = 1, "Tier 1", "Explains Tier 1" ) & " · " & [Card Sub]
```

EBITDA at Week vs Previous names the compared window ("vs P9 weeks 1–4"; V 898–909).

```dax
Explain Delta =
VAR _delta        = [Card Delta Text]
VAR _name         = [Sel PTD Prev Name]
RETURN
    IF (
        [Card Code] = "EBITDA"
            && [Sel Comparator] = "prev"
            && [Sel Gran] = "W"
            && NOT ISBLANK ( _name )
            && NOT [Card Category NA]
        ,SUBSTITUTE ( _delta, "vs prev. mth", "vs " & _name )
        ,_delta
    )
```

```dax
Explain Updated =
SWITCH (
    TRUE ()
    ,[Card Is Provisional] && NOT ISBLANK ( [Card Provisional Note] )
        ,[Card Provisional Note]
    ,[Card Cadence] = "weekly"
        ,"Updated weekly"
    ,"Updated " & [Refreshed Short]
)
```

```dax
Explain Drill Label =
"Drill path · " & [Card Drill Page]
```

### Mix bar (Channel mix only; shares in %)

```dax
Mix Bar Store =
CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_store_pct" ) * 100 + 0
```

`Mix Bar Online` and `Mix Bar Wholesale` the same with `mix_online_pct` / `mix_wholesale_pct`.

### Stat helpers (8)

First two seasonal categories of the current category filter (Apparel and Home & kitchen at All; V `seasonalStats`
1265–1282):

```dax
Seasonal Stat Count =
VAR _n            = [Seasonal In Pick]
RETURN
    IF ( _n > 2, 2, _n )
```

```dax
Seasonal Stat 1 Code =
VAR _t            =
    CALCULATETABLE (
        SUMMARIZE ( 'Category', 'Category'[category_code], 'Category'[sort_order] )
        ,KEEPFILTERS ( 'Category'[is_seasonal] = TRUE () )
    )
VAR _first        = MINX ( _t, 'Category'[sort_order] )
RETURN
    MAXX ( FILTER ( _t, 'Category'[sort_order] = _first ), 'Category'[category_code] )
```

```dax
Seasonal Stat 2 Code =
VAR _t            =
    CALCULATETABLE (
        SUMMARIZE ( 'Category', 'Category'[category_code], 'Category'[sort_order] )
        ,KEEPFILTERS ( 'Category'[is_seasonal] = TRUE () )
    )
VAR _first        = MINX ( _t, 'Category'[sort_order] )
VAR _second       = MINX ( FILTER ( _t, 'Category'[sort_order] > _first ), 'Category'[sort_order] )
RETURN
    MAXX ( FILTER ( _t, 'Category'[sort_order] = _second ), 'Category'[category_code] )
```

GMROI mini stat: H&B and Electronics at All, else the first two picked categories (V `gmroiStat` 1285–1297):

```dax
GMROI Stat 1 Code =
VAR _t            = SUMMARIZE ( 'Category', 'Category'[category_code], 'Category'[sort_order] )
VAR _first        = MINX ( _t, 'Category'[sort_order] )
RETURN
    IF (
        [Category Pick Active]
        ,MAXX ( FILTER ( _t, 'Category'[sort_order] = _first ), 'Category'[category_code] )
        ,"HB"
    )
```

```dax
GMROI Stat 2 Code =
VAR _t            = SUMMARIZE ( 'Category', 'Category'[category_code], 'Category'[sort_order] )
VAR _first        = MINX ( _t, 'Category'[sort_order] )
VAR _second       = MINX ( FILTER ( _t, 'Category'[sort_order] > _first ), 'Category'[sort_order] )
RETURN
    IF (
        [Category Pick Active]
        ,MAXX ( FILTER ( _t, 'Category'[sort_order] = _second ), 'Category'[category_code] )
        ,"ELEC"
    )
```

```dax
GMROI Stat Label =
VAR _c1           = [GMROI Stat 1 Code]
VAR _c2           = [GMROI Stat 2 Code]
VAR _n1           =
    IF (
        _c1 = "HB" && NOT [Category Pick Active]
        ,"H&B"
        ,CALCULATE ( SELECTEDVALUE ( 'Category'[category_name] ), REMOVEFILTERS ( 'Category' ), 'Category'[category_code] = _c1 )
    )
VAR _n2           =
    CALCULATE ( SELECTEDVALUE ( 'Category'[category_name] ), REMOVEFILTERS ( 'Category' ), 'Category'[category_code] = _c2 )
RETURN
    _n1 & IF ( ISBLANK ( _c2 ), "", " · " & _n2 )
```

```dax
GMROI Stat Value =
VAR _c1           = [GMROI Stat 1 Code]
VAR _c2           = [GMROI Stat 2 Code]
VAR _g1           =
    CALCULATE (
        [Actual]
        ,REMOVEFILTERS ( 'Metric' )
        ,'Metric'[metric_code] = "gmroi"
        ,REMOVEFILTERS ( 'Category' )
        ,'Category'[category_code] = _c1
    )
VAR _g2           =
    CALCULATE (
        [Actual]
        ,REMOVEFILTERS ( 'Metric' )
        ,'Metric'[metric_code] = "gmroi"
        ,REMOVEFILTERS ( 'Category' )
        ,'Category'[category_code] = _c2
    )
VAR _t1           = IF ( ISBLANK ( _g1 ), "n/a", FORMAT ( _g1, "#,0.0" ) & "×" )
VAR _t2           = IF ( ISBLANK ( _g2 ), "n/a", FORMAT ( _g2, "#,0.0" ) & "×" )
RETURN
    _t1 & IF ( ISBLANK ( _c2 ), "", " · " & _t2 )
```

Lowest-availability category of the pick at L, stores only, first in `sort_order` on a tie (V 1250–1256):

```dax
Lowest Category Availability =
VAR _rows         =
    FILTER (
        ADDCOLUMNS (
            SUMMARIZE ( 'Category', 'Category'[category_name], 'Category'[sort_order] )
            ,"@av"
            ,CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "availability_pct" )
        )
        ,NOT ISBLANK ( [@av] )
    )
VAR _min          = MINX ( _rows, [@av] )
VAR _first        = MINX ( FILTER ( _rows, [@av] = _min ), 'Category'[sort_order] )
VAR _row          = FILTER ( _rows, 'Category'[sort_order] = _first )
RETURN
    IF (
        ISEMPTY ( _rows )
        ,"n/a"
        ,MAXX ( _row, 'Category'[category_name] & " " & FORMAT ( [@av] * 100, "#,0.0" ) & "%" )
    )
```

### Explain Stat 1 / 2 / 3 Label

```dax
Explain Stat 1 Label =
VAR _code         = [Card Code]
VAR _prev_label   = IF ( [Sel Gran] = "W", "vs last week", [Sel Word Short] )
VAR _c1           = [Seasonal Stat 1 Code]
VAR _st_name      =
    CALCULATE (
        SELECTEDVALUE ( 'Category'[category_name] )
        ,REMOVEFILTERS ( 'Category' )
        ,'Category'[category_code] = _c1
    )
RETURN
    SWITCH (
        _code
        ,"NET_SALES", "vs LY " & [Sel Word Noun]
        ,"TOTAL_MARGIN", "Front margin"
        ,"WEEKS_OF_COVER", "On hand at cost"
        ,"MARKDOWN", "Markdown value"
        ,"AVAILABILITY", _prev_label
        ,"EBITDA", "EBITDA margin"
        ,"LFL_GROWTH", "LFL stores"
        ,"FRONT_GM", "Cost of goods"
        ,"SELL_THROUGH", IF ( [Seasonal Stat Count] >= 1, _st_name, "vs LY season" )
        ,"GMROI", "R52W front margin"
        ,"SUPPLIER_OTIF", "PO lines due"
        ,"CHANNEL_MIX", "Store"
    )
```

Measures are always read into a VAR before they appear in a `CALCULATE` boolean filter.

```dax
Explain Stat 2 Label =
VAR _code         = [Card Code]
VAR _gran         = [Sel Gran]
VAR _prev_label   = IF ( _gran = "W", "vs last week", [Sel Word Short] )
VAR _c2           = [Seasonal Stat 2 Code]
VAR _st_name      =
    CALCULATE (
        SELECTEDVALUE ( 'Category'[category_name] )
        ,REMOVEFILTERS ( 'Category' )
        ,'Category'[category_code] = _c2
    )
RETURN
    SWITCH (
        _code
        ,"NET_SALES"
            ,SWITCH (
                _gran
                ,"W", "Month " & [Sel Last Period] & " to date"
                ,"P", "Quarter " & [Sel Last Quarter] & " to date"
                ,"Q", "FY to date"
                ,"Budget full year"
            )
        ,"TOTAL_MARGIN", "Back margin"
        ,"WEEKS_OF_COVER", "On order"
        ,"MARKDOWN", "vs LY " & [Sel Word Noun]
        ,"AVAILABILITY", "Netherlands · Belgium"
        ,"EBITDA", "Budget margin"
        ,"LFL_GROWTH", "Non-LFL effect"
        ,"FRONT_GM", "Front margin"
        ,"SELL_THROUGH"
            ,SWITCH ( [Seasonal Stat Count], 2, _st_name, 1, "vs LY season", BLANK () )
        ,"GMROI", "Average stock at cost"
        ,"SUPPLIER_OTIF", _prev_label
        ,"CHANNEL_MIX", "Online"
    )
```

```dax
Explain Stat 3 Label =
VAR _code         = [Card Code]
VAR _gran         = [Sel Gran]
VAR _prev_label   = IF ( _gran = "W", "vs last week", [Sel Word Short] )
RETURN
    SWITCH (
        _code
        ,"NET_SALES"
            ,SWITCH ( _gran, "W", "Year to date", "P", "Year to date", "Q", "Previous quarter", "Last year" )
        ,"TOTAL_MARGIN", "vs LY " & [Sel Word Noun]
        ,"WEEKS_OF_COVER", _prev_label
        ,"MARKDOWN", "Budget"
        ,"AVAILABILITY", "Lowest category"
        ,"EBITDA", "Store costs vs plan"
        ,"LFL_GROWTH", "Online LFL"
        ,"FRONT_GM", "vs LY " & [Sel Word Noun]
        ,"SELL_THROUGH", IF ( [Seasonal Stat Count] = 2, "vs LY season", BLANK () )
        ,"GMROI", [GMROI Stat Label]
        ,"SUPPLIER_OTIF", "Suppliers below 85%"
        ,"CHANNEL_MIX", "Wholesale"
    )
```

### Explain Stat 1 / 2 / 3 Value

Shared building blocks inside the three measures (each branch evaluates only its own VARs):

- `A ( code )` = `CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "code" )`
- `LY ( code )` = the same with `[Last Year]`; `P ( code )` = with `[Previous]`.

```dax
Explain Stat 1 Value =
VAR _code         = [Card Code]
RETURN
    IF (
        [Card Category NA]
        ,"n/a"
        ,SWITCH (
            _code
            ,"NET_SALES"
                ,VAR _a = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "net_sales" )
                 VAR _l = CALCULATE ( [Last Year], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "net_sales" )
                 VAR _r = DIVIDE ( _a, _l ) - 1
                 RETURN IF ( ISBLANK ( _l ) || _l = 0, "n/a", IF ( _r >= 0, "+", "−" ) & FORMAT ( ABS ( _r ) * 100, "#,0.0" ) & "%" )
            ,"TOTAL_MARGIN"
                ,VAR _v = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "front_gm_pct" )
                 RETURN IF ( ISBLANK ( _v ), "n/a", IF ( _v < 0, "−", "" ) & FORMAT ( ABS ( _v ) * 100, "#,0.0" ) & "%" )
            ,"WEEKS_OF_COVER"
                ,VAR _v = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "on_hand_cost" ) + 0
                 RETURN "€" & FORMAT ( _v / 1000000, "#,0" ) & "m"
            ,"MARKDOWN"
                ,VAR _v = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "markdown" ) + 0
                 RETURN "€" & FORMAT ( _v / 1000000, IF ( _v >= 1000000000, "#,0", "#,0.0" ) ) & "m"
            ,"AVAILABILITY"
                ,VAR _a = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "availability_pct" )
                 VAR _p = CALCULATE ( [Previous], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "availability_pct" )
                 VAR _d = _a - _p
                 RETURN IF ( ISBLANK ( _a ) || ISBLANK ( _p ), "n/a", IF ( _d >= 0, "+", "−" ) & FORMAT ( ABS ( _d ) * 100, "#,0.0" ) & " pp" )
            ,"EBITDA"
                ,VAR _v = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "ebitda_margin_pct" )
                 RETURN IF ( ISBLANK ( _v ), "n/a", IF ( _v < 0, "−", "" ) & FORMAT ( ABS ( _v ) * 100, "#,0.0" ) & "%" )
            ,"LFL_GROWTH"
                ,VAR _g = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "lfl_growth_pct" )
                 VAR _n = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "lfl_store_count" ) + 0
                 VAR _t = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "trading_stores" ) + 0
                 RETURN IF ( ISBLANK ( _g ), "n/a", FORMAT ( _n, "#,0" ) & " of " & FORMAT ( _t, "#,0" ) )
            ,"FRONT_GM"
                ,VAR _v = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "cogs" ) + 0
                 RETURN "€" & FORMAT ( _v / 1000000, IF ( _v >= 1000000000, "#,0", "#,0.0" ) ) & "m"
            ,"SELL_THROUGH"
                ,IF (
                    [Seasonal Stat Count] >= 1
                    ,VAR _c = [Seasonal Stat 1 Code]
                     VAR _v =
                        CALCULATE (
                            [Actual]
                            ,REMOVEFILTERS ( 'Metric' )
                            ,'Metric'[metric_code] = "sell_through_pct"
                            ,REMOVEFILTERS ( 'Category' )
                            ,'Category'[category_code] = _c
                        )
                     RETURN IF ( ISBLANK ( _v ), "n/a", FORMAT ( _v * 100, "#,0" ) & "%" )
                    ,[Explain ST vs LY Season]
                )
            ,"GMROI"
                ,VAR _v = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "gmroi_front_margin_r52w" ) + 0
                 RETURN IF ( _v < 0, "−", "" ) & "€" & FORMAT ( ABS ( _v ) / 1000000, "#,0" ) & "m"
            ,"SUPPLIER_OTIF"
                ,FORMAT ( CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "po_lines_due" ) + 0, "#,0" )
            ,"CHANNEL_MIX"
                ,[Explain Mix Stat Store]
        )
    )
```

```dax
Explain Stat 2 Value =
VAR _code         = [Card Code]
VAR _gran         = [Sel Gran]
VAR _L            = [Sel To Ix]
RETURN
    IF (
        [Card Category NA]
        ,"n/a"
        ,SWITCH (
            _code
            ,"NET_SALES"
                ,VAR _start =
                    SWITCH ( _gran, "W", [Sel Month Start Ix], "P", [Sel Quarter Start Ix], "Q", [Sel FY Start Ix] )
                 VAR _fy = [Sel FY]
                 VAR _v =
                    IF (
                        _gran = "FY"
                        ,IF (
                            _fy = [Current FY]
                            ,CALCULATE ( SUM ( 'Cube'[net_sales_bud] ), REMOVEFILTERS ( 'Week' ), 'Week'[fy] = _fy ) + 0
                        )
                        ,CALCULATE ( [Net Sales], REMOVEFILTERS ( 'Week' ), 'Week'[week_ix] >= _start && 'Week'[week_ix] <= _L )
                    )
                 RETURN
                    IF (
                        ISBLANK ( _v )
                        ,"n/a"
                        ,IF ( _v < 0, "−", "" ) & "€" & FORMAT ( ABS ( _v ) / 1000000, IF ( ABS ( _v ) >= 1000000000, "#,0", "#,0.0" ) ) & "m"
                    )
            ,"TOTAL_MARGIN"
                ,VAR _v = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "back_margin_pct" )
                 RETURN IF ( ISBLANK ( _v ), "n/a", IF ( _v < 0, "−", "" ) & FORMAT ( ABS ( _v ) * 100, "#,0.0" ) & "%" )
            ,"WEEKS_OF_COVER"
                ,VAR _v = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "on_order_cost" ) + 0
                 RETURN "€" & FORMAT ( _v / 1000000, "#,0" ) & "m"
            ,"MARKDOWN"
                ,VAR _a = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "markdown_pct" )
                 VAR _l = CALCULATE ( [Last Year], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "markdown_pct" )
                 VAR _d = _a - _l
                 RETURN IF ( ISBLANK ( _a ) || ISBLANK ( _l ), "n/a", IF ( _d >= 0, "+", "−" ) & FORMAT ( ABS ( _d ) * 100, "#,0.0" ) & " pp" )
            ,"AVAILABILITY"
                ,VAR _nl =
                    CALCULATE (
                        [Actual]
                        ,REMOVEFILTERS ( 'Metric' )
                        ,'Metric'[metric_code] = "availability_pct"
                        ,REMOVEFILTERS ( 'Region' )
                        ,'Region'[region_code] = "nl"
                    )
                 VAR _be =
                    CALCULATE (
                        [Actual]
                        ,REMOVEFILTERS ( 'Metric' )
                        ,'Metric'[metric_code] = "availability_pct"
                        ,REMOVEFILTERS ( 'Region' )
                        ,'Region'[region_code] = "be"
                    )
                 RETURN
                    IF ( ISBLANK ( _nl ), "n/a", FORMAT ( _nl * 100, "#,0.0" ) & "%" )
                        & " · "
                        & IF ( ISBLANK ( _be ), "n/a", FORMAT ( _be * 100, "#,0.0" ) & "%" )
            ,"EBITDA"
                ,VAR _v = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "ebitda_margin_pct_bud" )
                 RETURN IF ( ISBLANK ( _v ), "n/a", IF ( _v < 0, "−", "" ) & FORMAT ( ABS ( _v ) * 100, "#,0.0" ) & "%" )
            ,"LFL_GROWTH"
                ,VAR _v = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "nonlfl_effect_pp" )
                 RETURN IF ( ISBLANK ( _v ), "n/a", IF ( _v >= 0, "+", "−" ) & FORMAT ( ABS ( _v ) * 100, "#,0.0" ) & " pp" )
            ,"FRONT_GM"
                ,VAR _v = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "front_margin" ) + 0
                 RETURN IF ( _v < 0, "−", "" ) & "€" & FORMAT ( ABS ( _v ) / 1000000, IF ( ABS ( _v ) >= 1000000000, "#,0", "#,0.0" ) ) & "m"
            ,"SELL_THROUGH"
                ,SWITCH (
                    [Seasonal Stat Count]
                    ,2
                        ,VAR _c = [Seasonal Stat 2 Code]
                         VAR _v =
                            CALCULATE (
                                [Actual]
                                ,REMOVEFILTERS ( 'Metric' )
                                ,'Metric'[metric_code] = "sell_through_pct"
                                ,REMOVEFILTERS ( 'Category' )
                                ,'Category'[category_code] = _c
                            )
                         RETURN IF ( ISBLANK ( _v ), "n/a", FORMAT ( _v * 100, "#,0" ) & "%" )
                    ,1
                        ,[Explain ST vs LY Season]
                    ,BLANK ()
                )
            ,"GMROI"
                ,VAR _v = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "gmroi_avg_on_hand_cost" ) + 0
                 RETURN "€" & FORMAT ( _v / 1000000, "#,0" ) & "m"
            ,"SUPPLIER_OTIF"
                ,VAR _a = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "otif_pct" )
                 VAR _p = CALCULATE ( [Previous], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "otif_pct" )
                 VAR _d = _a - _p
                 RETURN IF ( ISBLANK ( _a ) || ISBLANK ( _p ), "n/a", IF ( _d >= 0, "+", "−" ) & FORMAT ( ABS ( _d ) * 100, "#,0.0" ) & " pp" )
            ,"CHANNEL_MIX"
                ,[Explain Mix Stat Online]
        )
    )
```

```dax
Explain Stat 3 Value =
VAR _code         = [Card Code]
VAR _gran         = [Sel Gran]
VAR _L            = [Sel To Ix]
RETURN
    IF (
        [Card Category NA]
        ,"n/a"
        ,SWITCH (
            _code
            ,"NET_SALES"
                ,VAR _start = [Sel FY Start Ix]
                 VAR _v =
                    SWITCH (
                        _gran
                        ,"Q", CALCULATE ( [Previous], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "net_sales" )
                        ,"FY", CALCULATE ( [Last Year], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "net_sales" )
                        ,CALCULATE ( [Net Sales], REMOVEFILTERS ( 'Week' ), 'Week'[week_ix] >= _start && 'Week'[week_ix] <= _L )
                    )
                 RETURN
                    IF (
                        ISBLANK ( _v )
                        ,"n/a"
                        ,IF ( _v < 0, "−", "" ) & "€" & FORMAT ( ABS ( _v ) / 1000000, IF ( ABS ( _v ) >= 1000000000, "#,0", "#,0.0" ) ) & "m"
                    )
            ,"TOTAL_MARGIN"
                ,VAR _a = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "total_margin_pct" )
                 VAR _l = CALCULATE ( [Last Year], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "total_margin_pct" )
                 VAR _d = _a - _l
                 RETURN IF ( ISBLANK ( _a ) || ISBLANK ( _l ), "n/a", IF ( _d >= 0, "+", "−" ) & FORMAT ( ABS ( _d ) * 100, "#,0.0" ) & " pp" )
            ,"WEEKS_OF_COVER"
                ,VAR _a = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "weeks_of_cover" )
                 VAR _p = CALCULATE ( [Previous], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "weeks_of_cover" )
                 VAR _d = _a - _p
                 RETURN IF ( ISBLANK ( _a ) || ISBLANK ( _p ), "n/a", IF ( _d >= 0, "+", "−" ) & FORMAT ( ABS ( _d ), "#,0.0" ) & " wks" )
            ,"MARKDOWN"
                ,VAR _v = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "markdown_pct_bud" )
                 RETURN IF ( ISBLANK ( _v ), "n/a", FORMAT ( _v * 100, "#,0.0" ) & "%" )
            ,"AVAILABILITY"
                ,[Lowest Category Availability]
            ,"EBITDA"
                ,VAR _a  = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "opex_store" )
                 VAR _n  = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "flash.net_sales" )
                 VAR _ab = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "opex_store_bud" )
                 VAR _nb = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "flash.net_sales_bud" )
                 VAR _d  = DIVIDE ( _a, _n ) - DIVIDE ( _ab, _nb )
                 RETURN
                    IF (
                        ISBLANK ( _a ) || ISBLANK ( _n ) || ISBLANK ( _ab ) || ISBLANK ( _nb ) || _n = 0 || _nb = 0
                        ,"n/a"
                        ,IF ( _d >= 0, "+", "−" ) & FORMAT ( ABS ( _d ) * 100, "#,0.0" ) & " pp"
                    )
            ,"LFL_GROWTH"
                ,VAR _a = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_online_net_sales" )
                 VAR _l = CALCULATE ( [Last Year], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_online_net_sales" )
                 VAR _r = DIVIDE ( _a, _l ) - 1
                 RETURN IF ( ISBLANK ( _l ) || _l = 0, "n/a", IF ( _r >= 0, "+", "−" ) & FORMAT ( ABS ( _r ) * 100, "#,0.0" ) & "%" )
            ,"FRONT_GM"
                ,VAR _a = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "front_gm_pct" )
                 VAR _l = CALCULATE ( [Last Year], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "front_gm_pct" )
                 VAR _d = _a - _l
                 RETURN IF ( ISBLANK ( _a ) || ISBLANK ( _l ), "n/a", IF ( _d >= 0, "+", "−" ) & FORMAT ( ABS ( _d ) * 100, "#,0.0" ) & " pp" )
            ,"SELL_THROUGH"
                ,IF ( [Seasonal Stat Count] = 2, [Explain ST vs LY Season], BLANK () )
            ,"GMROI"
                ,[GMROI Stat Value]
            ,"SUPPLIER_OTIF"
                ,FORMAT ( CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "suppliers_below_85" ) + 0, "#,0" )
            ,"CHANNEL_MIX"
                ,[Explain Mix Stat Wholesale]
        )
    )
```

```dax
Explain ST vs LY Season =
VAR _a            = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "sell_through_pct" )
VAR _l            = CALCULATE ( [Last Year], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "sell_through_pct" )
VAR _d            = _a - _l
RETURN
    IF (
        ISBLANK ( _a ) || ISBLANK ( _l )
        ,"n/a"
        ,IF ( _d >= 0, "+", "−" ) & FORMAT ( ABS ( _d ) * 100, "#,0.0" ) & " pp"
    )
```

Channel mix stats "68.4% · −1.6 pp" (share · pp vs plan; V 1122–1125):

```dax
Explain Mix Stat Store =
VAR _s            = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_store_pct" ) + 0
VAR _p            = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_store_pct_bud" )
VAR _d            = _s - _p
RETURN
    FORMAT ( _s * 100, "#,0.0" ) & "% · "
        & IF ( ISBLANK ( _p ), "n/a", IF ( _d >= 0, "+", "−" ) & FORMAT ( ABS ( _d ) * 100, "#,0.0" ) & " pp" )
```

`Explain Mix Stat Online` and `Explain Mix Stat Wholesale`: the same with `mix_online_pct(_bud)` /
`mix_wholesale_pct(_bud)`.

### Worked example (three runs: before · **bold** · after; V 724–1137)

```dax
Example Pre =
VAR _code         = [Card Code]
VAR _gran         = [Sel Gran]
RETURN
    IF (
        [Card Category NA]
        ,SWITCH (
            _code
            ,"EBITDA", "Not split by category — OpEx is booked per site and centrally."
            ,"SUPPLIER_OTIF", "Not split by category — PO lines are per supplier."
            ,"No seasonal category in the selection."
        )
        ,SWITCH (
            _code
            ,"NET_SALES"
                ,[Ex EUR gross_sales] & " at ticket − " & [Ex EUR markdown] & " markdowns and discounts − "
                    & [Ex EUR returns] & " returns = "
            ,"TOTAL_MARGIN"
                ,"Front " & [Ex EUR front_margin] & " + back " & [Ex EUR back_margin] & " = " & [Ex EUR total_margin]
                    & "; ÷ " & [Ex EUR net_sales] & " = "
            ,"WEEKS_OF_COVER"
                ,[Ex EUR0 stock_incl_on_order] & " stock incl. on-order ÷ " & [Ex EUR forecast_cogs]
                    & " forecast weekly cost of goods = "
            ,"MARKDOWN"
                ,[Ex EUR markdown] & " markdown ÷ " & [Ex EUR gross_sales] & " gross sales = "
            ,"AVAILABILITY"
                ,VAR _av = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "availability_pct" )
                 VAR _stores = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "trading_stores" ) + 0
                 VAR _ranged = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "ranged_sku_days" ) + 0
                 VAR _in = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "in_stock_sku_days" ) + 0
                 RETURN
                    IF (
                        ISBLANK ( _av )
                        ,"Availability counts stores only; this selection has none."
                        ,IF ( _gran = "W", "", "Last week of the " & [Sel Word Noun] & ": " )
                            & "500 SKUs × " & FORMAT ( _stores, "#,0" ) & " stores × 7 days = " & FORMAT ( _ranged, "#,0" )
                            & " ranged; " & FORMAT ( _in, "#,0" ) & " in stock → "
                    )
            ,"EBITDA"
                ,[Ex EUR flash.total_margin] & " margin − " & [Ex EUR opex_shrink] & " shrink − " & [Ex EUR opex_store]
                    & " store − " & [Ex EUR opex_central] & " central − " & [Ex EUR opex_fulfilment] & " fulfilment = "
            ,"LFL_GROWTH"
                ,VAR _g = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "lfl_growth_pct" )
                 VAR _n = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "lfl_store_count" ) + 0
                 RETURN
                    IF (
                        ISBLANK ( _g )
                        ,"Like-for-like counts stores only; this selection has none."
                        ,FORMAT ( _n, "#,0" ) & " LFL stores: " & [Ex EUR lfl_net_sales] & " ÷ " & [Ex EUR lfl_net_sales_ly] & " − 1 = "
                    )
            ,"FRONT_GM"
                ,[Ex EUR net_sales] & " − " & [Ex EUR cogs] & " cost of goods = " & [Ex EUR front_margin] & "; ÷ "
                    & [Ex EUR net_sales] & " = "
            ,"SELL_THROUGH"
                ,VAR _st = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "sell_through_pct" )
                 VAR _o = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "season_opening_units" ) + 0
                 VAR _r = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "season_receipt_units" ) + 0
                 VAR _s = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "season_units_sold" ) + 0
                 RETURN
                    IF (
                        ISBLANK ( _st )
                        ,IF ( _gran = "W", "No season is open in the selected week.", "No season is open in the last week of the " & [Sel Word Noun] & "." )
                        ,FORMAT ( _s / 1000000, "#,0.0" ) & "m units sold ÷ (" & FORMAT ( _o / 1000000, "#,0.0" ) & "m opening + "
                            & FORMAT ( _r / 1000000, "#,0.0" ) & "m received = " & FORMAT ( ( _o + _r ) / 1000000, "#,0.0" ) & "m) = "
                    )
            ,"GMROI"
                ,VAR _g = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "gmroi" )
                 RETURN
                    IF (
                        ISBLANK ( _g )
                        ,"GMROI needs 52 weeks of history."
                        ,[Ex EUR0 gmroi_front_margin_r52w] & " front margin ÷ " & [Ex EUR0 gmroi_avg_on_hand_cost] & " average stock = "
                    )
            ,"SUPPLIER_OTIF"
                ,FORMAT ( CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "po_lines_otif" ) + 0, "#,0" )
                    & " lines on time and in full ÷ "
                    & FORMAT ( CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "po_lines_due" ) + 0, "#,0" )
                    & " lines due = "
            ,"CHANNEL_MIX"
                ,"Store " & [Ex EUR mix_store_net_sales] & ", online " & [Ex EUR mix_online_net_sales] & ", wholesale "
                    & [Ex EUR mix_wholesale_net_sales] & " of " & [Ex EUR net_sales] & " → "
        )
    )
```

`[Ex EUR <code>]` and `[Ex EUR0 <code>]` are 18 helper measures (folder "7 Explain/ex"), one pattern: eurM (eurM0 = 0
decimals) of the Actual of that code, BLANK → 0 (V uses `?? 0`):

```dax
Ex EUR gross_sales =
VAR _v            = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "gross_sales" ) + 0
RETURN
    IF ( _v < 0, "−", "" ) & "€" & FORMAT ( ABS ( _v ) / 1000000, IF ( ABS ( _v ) >= 1000000000, "#,0", "#,0.0" ) ) & "m"
```

Codes: eurM — `gross_sales, markdown, returns, net_sales, cogs, front_margin, back_margin, total_margin,
forecast_cogs, flash.total_margin, opex_shrink, opex_store, opex_central, opex_fulfilment, lfl_net_sales,
lfl_net_sales_ly, mix_store_net_sales, mix_online_net_sales, mix_wholesale_net_sales, flash.net_sales, ebitda_bud,
ebitda`; eurM0 (`FORMAT ( ABS ( _v ) / 1000000, "#,0" )`) — `stock_incl_on_order, gmroi_front_margin_r52w,
gmroi_avg_on_hand_cost`. (25 helpers in all; the folder table counts them.)

```dax
Example Bold =
VAR _code         = [Card Code]
RETURN
    IF (
        [Card Category NA]
        ,BLANK ()
        ,SWITCH (
            _code
            ,"NET_SALES", [Ex EUR net_sales]
            ,"EBITDA", [Ex EUR ebitda]
            ,"GMROI"
                ,VAR _g = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "gmroi" )
                 RETURN IF ( ISBLANK ( _g ), BLANK (), FORMAT ( _g, "#,0.0" ) & "×" )
            ,"WEEKS_OF_COVER"
                ,VAR _w = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "weeks_of_cover" )
                 RETURN IF ( ISBLANK ( _w ), "n/a", FORMAT ( _w, "#,0.0" ) & " weeks" )
            ,"LFL_GROWTH"
                ,VAR _g = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "lfl_growth_pct" )
                 RETURN IF ( ISBLANK ( _g ), BLANK (), IF ( _g >= 0, "+", "−" ) & FORMAT ( ABS ( _g ) * 100, "#,0.0" ) & "%" )
            ,"CHANNEL_MIX"
                ,VAR _s1 = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_store_pct" ) + 0
                 VAR _s2 = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_online_pct" ) + 0
                 VAR _s3 = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_wholesale_pct" ) + 0
                 RETURN
                    FORMAT ( _s1 * 100, "#,0.0" ) & "% / " & FORMAT ( _s2 * 100, "#,0.0" ) & "% / " & FORMAT ( _s3 * 100, "#,0.0" ) & "%"
            ,VAR _metric = [Card Metric Code]
             VAR _v = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = _metric )
             RETURN
                SWITCH (
                    TRUE ()
                    ,_code IN { "AVAILABILITY", "SELL_THROUGH" } && ISBLANK ( _v )
                        ,BLANK ()
                    ,ISBLANK ( _v )
                        ,"n/a"
                    ,IF ( _v < 0, "−", "" ) & FORMAT ( ABS ( _v ) * 100, "#,0.0" ) & "%"
                )
        )
    )
```

(When Availability, LFL, Sell-through or GMROI are N/A the whole sentence is in `[Example Pre]`; Bold and Post are
blank.)

```dax
Example Post =
VAR _code         = [Card Code]
VAR _word         = [Card Status Word]
VAR _a            = [Card Actual]
VAR _b            = [Card Basis]
VAR _both         = NOT ISBLANK ( _a ) && NOT ISBLANK ( _b )
VAR _d            = _a - _b
VAR _pp           = IF ( _d >= 0, "+", "−" ) & FORMAT ( ABS ( _d ) * 100, "#,0.0" ) & " pp"
VAR _b_pct        = IF ( _b < 0, "−", "" ) & FORMAT ( ABS ( _b ) * 100, "#,0.0" ) & "%"
VAR _b_t          = FORMAT ( _b * 100, "#,0.0" )
VAR _b_trim       = IF ( RIGHT ( _b_t, 2 ) = ".0", LEFT ( _b_t, LEN ( _b_t ) - 2 ), _b_t ) & "%"
VAR _eur_b        =
    IF ( _b < 0, "−", "" ) & "€" & FORMAT ( ABS ( _b ) / 1000000, IF ( ABS ( _b ) >= 1000000000, "#,0", "#,0.0" ) ) & "m"
VAR _eur_d        =
    IF ( _d >= 0, "+", "−" ) & "€" & FORMAT ( ABS ( _d ) / 1000000, IF ( ABS ( _d ) >= 1000000000, "#,0", "#,0.0" ) ) & "m"
VAR _ratio        = DIVIDE ( _a, _b ) - 1
VAR _ratio_txt    = IF ( _ratio >= 0, "+", "−" ) & FORMAT ( ABS ( _ratio ) * 100, "#,0.0" ) & "%"
RETURN
    IF (
        [Card Category NA]
        ,BLANK ()
        ,SWITCH (
            _code
            ,"NET_SALES"
                ,IF ( ISBLANK ( _b ), ".", ". Budget was " & _eur_b & ", so " & _eur_d & " (" & _ratio_txt & ")." )
            ,"TOTAL_MARGIN"
                ,IF ( _both, ". Budget " & _b_pct & ", so " & _pp & ".", "." )
            ,"FRONT_GM"
                ,IF ( _both, ". Budget " & _b_pct & ", so " & _pp & ".", "." )
            ,"WEEKS_OF_COVER"
                ,IF (
                    _both
                    ,". Target " & FORMAT ( _b, "#,0.0" ) & ", so " & IF ( _d >= 0, "+", "−" ) & FORMAT ( ABS ( _d ), "#,0.0" ) & " → " & _word & "."
                    ,"."
                )
            ,"MARKDOWN"
                ,IF ( _both, ". Budget " & _b_pct & ", so " & _pp & "; lower is better → " & _word & ".", "." )
            ,"AVAILABILITY"
                ,IF ( ISBLANK ( _a ), BLANK (), ". Target " & _b_trim & ", so " & _pp & " → " & _word & "." )
            ,"EBITDA"
                ,VAR _m = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "ebitda_margin_pct" )
                 RETURN
                    " (" & IF ( ISBLANK ( _m ), "n/a", IF ( _m < 0, "−", "" ) & FORMAT ( ABS ( _m ) * 100, "#,0.0" ) & "%" )
                        & " of " & [Ex EUR flash.net_sales] & ")."
                        & IF ( ISBLANK ( _b ), "", " Budget " & _eur_b & ", so " & _eur_d & " (" & _ratio_txt & ")." )
            ,"LFL_GROWTH"
                ,IF ( ISBLANK ( _a ), BLANK (), IF ( ISBLANK ( _b ), ".", ". Budget LFL " & _b_pct & ", so " & _pp & "." ) )
            ,"SELL_THROUGH"
                ,IF (
                    _both
                    ,". Target " & _b_trim & " at week " & [Sel Season Week] & " of " & [Sel Season Length] & ", so " & _pp & "."
                        & IF ( [Category Pick Active], " Seasonal categories only.", "" )
                    ,BLANK ()
                )
            ,"GMROI"
                ,IF (
                    _both
                    ,". Target " & FORMAT ( _b, "#,0.0" ) & "×, so " & IF ( _d >= 0, "+", "−" ) & FORMAT ( ABS ( _d ), "#,0.0" ) & "×."
                    ,BLANK ()
                )
            ,"SUPPLIER_OTIF"
                ,". Target " & _b_trim & ", so " & _pp & "."
            ,"CHANNEL_MIX"
                ,VAR _p1 = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_store_pct_bud" )
                 VAR _p2 = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_online_pct_bud" )
                 VAR _p3 = CALCULATE ( [Actual], REMOVEFILTERS ( 'Metric' ), 'Metric'[metric_code] = "mix_wholesale_pct_bud" )
                 VAR _t1 = FORMAT ( _p1 * 100, "#,0.0" )
                 VAR _t2 = FORMAT ( _p2 * 100, "#,0.0" )
                 VAR _t3 = FORMAT ( _p3 * 100, "#,0.0" )
                 RETURN
                    IF (
                        ISBLANK ( _p1 ) || ISBLANK ( _p2 ) || ISBLANK ( _p3 )
                        ,"."
                        ,". Plan "
                            & IF ( RIGHT ( _t1, 2 ) = ".0", LEFT ( _t1, LEN ( _t1 ) - 2 ), _t1 ) & " / "
                            & IF ( RIGHT ( _t2, 2 ) = ".0", LEFT ( _t2, LEN ( _t2 ) - 2 ), _t2 ) & " / "
                            & IF ( RIGHT ( _t3, 2 ) = ".0", LEFT ( _t3, LEN ( _t3 ) - 2 ), _t3 )
                            & ", so " & [Card Mix Plan Delta] & "."
                    )
        )
    )
```

For the EBITDA card, `[Card Actual]` / `[Card Basis]` already read the month-to-date window at Week (its Metric row is
`flash`). The Channel mix sentence always compares with the **plan**, whatever the comparator:

```dax
Card Mix Plan Delta =
VAR _text         =
    CALCULATE (
        [Card Mix Delta Text]
        ,REMOVEFILTERS ( 'Comparator' )
        ,'Comparator'[comparator_code] = "budget"
    )
RETURN
    SUBSTITUTE ( _text, " vs plan", "" )
```

("online +1.9 pp vs plan" → "online +1.9 pp".)

---

## 8 Validation

```dax
Golden Column Value =
SWITCH (
    SELECTEDVALUE ( 'Golden'[column] )
    ,"actual"
        ,[Actual]
    ,"basis"
        ,[Basis]
    ,"ly"
        ,[Last Year]
    ,"prev"
        ,[Previous]
)
```

```dax
Golden Got =
VAR _id           = SELECTEDVALUE ( 'Golden'[golden_id] )
VAR _metric       = SELECTEDVALUE ( 'Golden'[metric_code] )
VAR _item         = SELECTEDVALUE ( 'Golden'[item_key] )
VAR _region       = SELECTEDVALUE ( 'Golden'[region_code] )
VAR _cats         =
    CALCULATETABLE (
        VALUES ( 'Golden Category'[category_code] )
        ,'Golden Category'[golden_id] = _id
    )
VAR _no_pick      =
    CALCULATE (
        [Golden Column Value]
        ,REMOVEFILTERS ( 'Period' )
        ,'Period'[item_key] = _item
        ,REMOVEFILTERS ( 'Region' )
        ,'Region'[region_code] = _region
        ,REMOVEFILTERS ( 'Category' )
        ,REMOVEFILTERS ( 'Comparator' )
        ,REMOVEFILTERS ( 'Metric' )
        ,'Metric'[metric_code] = _metric
    )
VAR _pick         =
    CALCULATE (
        [Golden Column Value]
        ,REMOVEFILTERS ( 'Period' )
        ,'Period'[item_key] = _item
        ,REMOVEFILTERS ( 'Region' )
        ,'Region'[region_code] = _region
        ,REMOVEFILTERS ( 'Category' )
        ,TREATAS ( _cats, 'Category'[category_code] )
        ,REMOVEFILTERS ( 'Comparator' )
        ,REMOVEFILTERS ( 'Metric' )
        ,'Metric'[metric_code] = _metric
    )
RETURN
    IF ( ISEMPTY ( _cats ), _no_pick, _pick )
```

```dax
Golden Pass =
VAR _expected     = SELECTEDVALUE ( 'Golden'[expected] )
VAR _got          = [Golden Got]
VAR _tolerance    = SELECTEDVALUE ( 'Golden'[tolerance] )
RETURN
    IF (
        ISBLANK ( _expected )
        ,ISBLANK ( _got )
        ,NOT ISBLANK ( _got ) && ABS ( _got - _expected ) <= _tolerance + 0.000000001
    )
```

```dax
Golden Diff =
[Golden Got] - SELECTEDVALUE ( 'Golden'[expected] )
```

```dax
Golden Pass Count =
COUNTROWS ( FILTER ( ALL ( 'Golden' ), [Golden Pass] ) ) + 0
```

```dax
Golden Fail Count =
COUNTROWS ( ALL ( 'Golden' ) ) - [Golden Pass Count]
```

Control totals (optional): metric codes on the row's own week range (any window, `@k` included; `*_ptd` codes on
month to date), status codes through the period picker on whole items.

```dax
Control Got =
VAR _code         = SELECTEDVALUE ( 'Control'[metric_code] )
VAR _scope        = SELECTEDVALUE ( 'Control'[scope_key] )
VAR _region       = SELECTEDVALUE ( 'Control'[region_code] )
VAR _item         = SELECTEDVALUE ( 'Control'[item_key] )
VAR _to           = SELECTEDVALUE ( 'Control'[to_ix] )
VAR _first        =
    IF (
        RIGHT ( _code, 4 ) = "_ptd"
        ,SELECTEDVALUE ( 'Control'[ptd_from_ix] )
        ,SELECTEDVALUE ( 'Control'[from_ix] )
    )
VAR _is_status    = LEFT ( _code, 7 ) = "status."
VAR _card         = UPPER ( MID ( _code, 8, 50 ) )
VAR _cats         =
    CALCULATETABLE (
        VALUES ( 'Control Scope Category'[category_code] )
        ,'Control Scope Category'[scope_key] = _scope
    )
VAR _has_cats     = NOT ISEMPTY ( _cats )
VAR _metric_all   =
    CALCULATE (
        [Metric Value]
        ,REMOVEFILTERS ( 'Metric' )
        ,'Metric'[metric_code] = _code
        ,REMOVEFILTERS ( 'Week' )
        ,'Week'[week_ix] >= _first && 'Week'[week_ix] <= _to
        ,REMOVEFILTERS ( 'Region' )
        ,'Region'[region_code] = _region
        ,REMOVEFILTERS ( 'Category' )
    )
VAR _metric_pick  =
    CALCULATE (
        [Metric Value]
        ,REMOVEFILTERS ( 'Metric' )
        ,'Metric'[metric_code] = _code
        ,REMOVEFILTERS ( 'Week' )
        ,'Week'[week_ix] >= _first && 'Week'[week_ix] <= _to
        ,REMOVEFILTERS ( 'Region' )
        ,'Region'[region_code] = _region
        ,REMOVEFILTERS ( 'Category' )
        ,TREATAS ( _cats, 'Category'[category_code] )
    )
VAR _status_all   =
    CALCULATE (
        SWITCH (
            _code
            ,"status.count_on", [Status Count On]
            ,"status.count_watch", [Status Count Watch]
            ,"status.count_off", [Status Count Off]
            ,"status.count_na", [Status Count NA]
            ,"status.dot", [Dot Code]
            ,CALCULATE ( [Card Status Code], REMOVEFILTERS ( 'Card' ), 'Card'[kpi_code] = _card )
        )
        ,REMOVEFILTERS ( 'Period' )
        ,'Period'[item_key] = _item
        ,REMOVEFILTERS ( 'Region' )
        ,'Region'[region_code] = _region
        ,REMOVEFILTERS ( 'Category' )
        ,REMOVEFILTERS ( 'Comparator' )
    )
VAR _status_pick  =
    CALCULATE (
        SWITCH (
            _code
            ,"status.count_on", [Status Count On]
            ,"status.count_watch", [Status Count Watch]
            ,"status.count_off", [Status Count Off]
            ,"status.count_na", [Status Count NA]
            ,"status.dot", [Dot Code]
            ,CALCULATE ( [Card Status Code], REMOVEFILTERS ( 'Card' ), 'Card'[kpi_code] = _card )
        )
        ,REMOVEFILTERS ( 'Period' )
        ,'Period'[item_key] = _item
        ,REMOVEFILTERS ( 'Region' )
        ,'Region'[region_code] = _region
        ,REMOVEFILTERS ( 'Category' )
        ,TREATAS ( _cats, 'Category'[category_code] )
        ,REMOVEFILTERS ( 'Comparator' )
    )
RETURN
    SWITCH (
        TRUE ()
        ,_is_status && _has_cats
            ,_status_pick
        ,_is_status
            ,_status_all
        ,_has_cats
            ,_metric_pick
        ,_metric_all
    )
```

```dax
Control Pass =
VAR _expected     = SELECTEDVALUE ( 'Control'[expected] )
VAR _got          = [Control Got]
VAR _tolerance    = SELECTEDVALUE ( 'Control'[tolerance] )
RETURN
    NOT ISBLANK ( _got ) && ABS ( _got - _expected ) <= _tolerance + 0.000000001
```

```dax
Control Fail Count =
COUNTROWS ( FILTER ( ALL ( 'Control' ), NOT [Control Pass] ) ) + 0
```

Row-count checks (expected 4,599 · 1,029 · 95 · 190 · 104 · 127):

```dax
Rows Check =
"cube " & COUNTROWS ( 'Cube' ) & " · opex " & COUNTROWS ( 'Opex' ) & " · po " & COUNTROWS ( 'PO' )
    & " · sites " & COUNTROWS ( 'Sites' ) & " · weeks " & COUNTROWS ( 'Week' ) & " · items " & COUNTROWS ( 'Period' )
```

---

## Measure count by folder

| Folder | Breakdown | Measures |
|---|---|---:|
| 0 Selection | Sel Item Id 1 · Period lookups 24 · Week-at-L 6 · Sel Season Length 1 · Sel Comparator 1 · Sel Region Code 1 · Category Pick Active 1 · Current FY / As Of Ix / Refreshed Long / Refreshed Short 4 · Seasonal In Pick 1 | **40** |
| 1 Engine | window helpers 4 · sales & margin 12 · OpEx & EBITDA 6 · OTIF 5 · LFL 8 · cover 6 · availability 4 · sell-through 5 · GMROI 4 · mix 6 · budget 21 (= the 77 distinct `Metric[layer1_measure]` values) | **81** |
| 2 Window | Win From/To 2 · Metric Value · Metric In Window · Actual · Basis · Last Year · Previous · Comparison | **9** |
| 3 Card | Code/Revealed 2 · lookups 21 · values 5 · Category NA · Badness · Status Code · status words 5 · Sub · value texts 3 · basis texts 3 · Delta Text · Mix Delta Text · Delta Is NA · colours 8 · Mix Plan Delta | **55** |
| 4 Bars | In Series · Value · Target Value · Target · Colour · Axis Min · Axis Max | **7** |
| 5 Status strip | counts 4 · Rated · dot 5 · count texts 3 · Shown · Summary Bold · picks 3 | **18** |
| 6 Header & copy | | **13** |
| 7 Explain | eyebrow/Δ/updated/drill 4 · mix bar 3 · stat helpers 8 · stat labels & values 6 · ST vs LY season 1 · mix stats 3 · example runs 3 · Ex helpers 25 | **53** |
| 8 Validation | Golden 6 · Control 3 · Rows Check 1 | **10** |
| **Total** | | **286** |

Plus three calculated columns on `Card` (`group_sort`, `lever_sort`, `owner_sort`, `03-model.md`).

The 43 catalogue metrics of `chat-metrics.ts` are all present as engine measures (the `Metric` rows with
`is_catalogue = true`), each readable in the four columns `[Actual]`, `[Basis]`, `[Last Year]`, `[Previous]`.
