# 02 · Data: sources, columns, Power Query

All sources are local files in the site repo (read-only; copy them next to the .pbix if you prefer, then change the two
parameters). The working tree is the current truth: the files moved from `public/data/nordmark/` (deleted there) to
`data/nordmark/parquet/` on 2026-11-15. The same rows are also loaded in Supabase schema `nordmark_demo` (tables
`document`, `cube`, `opex`, `po`, `sites`, each with a `seq` column = file row order; DDL in
`C:\__VOSK__\data\nordmark\sql\002-schema.sql`); the Power BI build reads the **files**, no database credentials needed.

| File | Absolute path | Rows | Bytes | Grain |
|---|---|---:|---:|---|
| Manifest | `C:\__VOSK__\data\nordmark\parquet\manifest.json` | – | 55,380 | calendar (104 weeks), 9 categories, 32 KPIs, 15 status rules, 27 targets, file index |
| Cube | `C:\__VOSK__\data\nordmark\parquet\cube.parquet` | 4,599 | 384,427 | week × site group × category |
| OpEx | `C:\__VOSK__\data\nordmark\parquet\opex.parquet` | 1,029 | 8,932 | scenario × week × cost type × site group |
| PO | `C:\__VOSK__\data\nordmark\parquet\po.parquet` | 95 | 1,685 | week |
| Sites | `C:\__VOSK__\data\nordmark\parquet\sites.parquet` | 190 | 1,355 | week × site group |
| Answer key | `C:\__VOSK__\data\nordmark\checks\chat-golden.csv` | 97 | 8,024 | one verified figure per row (validation) |
| Control totals | `C:\__VOSK__\data\nordmark\checks\control_totals_eur.csv` | 26,143 | 1,063,412 | scope × period key × metric code (validation, optional) |
| Control totals by category | `C:\__VOSK__\data\nordmark\checks\control_totals_category_eur.csv` | 10,514 | 517,447 | region#categories × period key × metric code (validation, optional) |

Parquet: one row group each, written by `nordmark js-exec build-exec-data`; every column `REQUIRED` (no nulls). Index
columns are `INT32`, measures `DOUBLE` (cube, opex) or `INT32` (po, sites).

Provenance: generator seed 20261028, as-of FY2026 W43; every fold reconciled to the source totals. The control totals
were computed independently of the web engine (spec: `C:\__VOSK__\docs\nordmark\README.md` › "The answer key").

## Index conventions (all files)

| Index | Values | Source of truth |
|---|---|---|
| `week_ix` | 0 … 103 = position in `manifest.weeks` (0 = FY2025-W01, 51 = FY2025-W52, 52 = FY2026-W01, **94 = FY2026-W43 = as-of week**, 103 = FY2026-W52) | `manifest.weeks` order |
| `group_ix` | 0 NL · 1 BE · 2 ONLINE · 3 WHOLESALE · 4 DC · 5 CENTRAL | `manifest.groups` order |
| `category_ix` | 0 FRESH · 1 AMBIENT · 2 HB · 3 HOUSEHOLD · 4 ELEC · 5 APPAREL · 6 HOME · 7 GARDEN · 8 TOYS | `manifest.categories` order (= `sort_order` − 1) |
| `scenario_ix` (opex) | 0 ACT · 1 BUD | `src/lib/nordmark/data/manifest.ts` `SCENARIOS` |
| `cost_type_ix` (opex) | 0 SHRINK · 1 STORE_OPEX · 2 CENTRAL_OPEX · 3 FULFILMENT | `manifest.ts` `COST_TYPES` |

Actual weeks are `week_ix` 0–94 (`is_actual = true` and ≤ as-of); weeks 95–103 (FY2026 W44–W52) carry **budget only**.

## manifest.json

Top-level keys (strict contract `C:\__VOSK__\src\lib\nordmark\data\manifest.ts`):

| Key | Value |
|---|---|
| `schema` | `"nordmark-exec/1"` |
| `seed` | `20261028` |
| `as_of` | `"2026-10-25"` |
| `current_week_key` | `"FY2026-W43"` |
| `refreshed` | `"2026-10-26T05:12"` |
| `groups` | `["NL","BE","ONLINE","WHOLESALE","DC","CENTRAL"]` |
| `weeks` | 104 records (below) |
| `categories` | 9 records (below) |
| `kpis` | 32 records (12 landing + 20 bench) |
| `rules` | 15 records (12 card rules + 3 dot constants) |
| `targets` | 27 records (`kpi_code`, `category_code`, `target_value`) |
| `files` | `{cube:{name,rows:4599,bytes:384427}, opex:{…1029…}, po:{…95…}, sites:{…190…}}` |

### `weeks[]` (104)

| Field | Type | Meaning / example |
|---|---|---|
| week_key | text | `FY2026-W43` |
| fy | int | 2025 · 2026 (FY = 52 Mon–Sun weeks from the Monday of the week containing 1 Jan) |
| week_of_fy | int | 1–52 |
| period | int | 1–12 (4-5-4 retail **month**; the UI says "Month", never "Period") |
| period_key | text | `FY2026-P10` |
| week_of_period | int | 1–5 |
| weeks_in_period | int | 4 or 5 (P1 4, P2 5, P3 4, P4 4, P5 5, P6 4 …) |
| week_start / week_end | ISO date | `2026-10-19` / `2026-10-25` |
| period_start / period_end | ISO date | `2026-09-28` / `2026-10-25` |
| ly_week_key | text, null in FY2025 | `FY2025-W43` (same retail week last year; **always by key**, never date arithmetic) |
| lw_week_key | text, null for the first week | `FY2026-W42`; FY2026-W01 → `FY2025-W52` |
| is_actual | bool | true for weeks 0–94 |
| season_code | text, nullable | `AW25` (FY2025 W32–W51), `AW26` (FY2026 W32–W51); 20 weeks each; otherwise null |
| season_week | int, nullable | 1–20 inside a season (W43 FY2026 = 12) |
| week_label | text | `Week 43` |

Quarter = `ceil(period / 3)` (13 weeks = three 4-5-4 months). The full 104-row calendar (as the `Week` query must
produce it) is at the end of this file.

### `categories[]` (9)

| category_code | category_name | is_seasonal | cover_target_wks | gmroi_target | sellthrough_target | sort_order |
|---|---|:-:|---:|---:|---:|---:|
| FRESH | Fresh food | no | 1.5 | 7 | null | 1 |
| AMBIENT | Ambient grocery | no | 7 | 2.8 | null | 2 |
| HB | Health & beauty | no | 11 | 3.5 | null | 3 |
| HOUSEHOLD | Household & cleaning | no | 10 | 2.8 | null | 4 |
| ELEC | Electronics | no | 15 | 2.2 | null | 5 |
| APPAREL | Apparel | yes | 18 | 2.4 | 0.62 | 6 |
| HOME | Home & kitchen | yes | 18 | 2.3 | 0.62 | 7 |
| GARDEN | Garden & DIY | yes | 17 | 2 | 0.62 | 8 |
| TOYS | Toys & leisure | yes | 16.3 | 2.3 | 0.62 | 9 |

### `kpis[]` (32)

Fields: `kpi_code, catalogue_no, kpi_name, domain, is_landing, size (hero|medium|small|null), card_order (1–12|null),
group (B1–B4|null), lever (sales|margin|stock|supply|cash|null), horizon (unused by the UI), owner
(commercial|supply|finance|digital), statement (unused), drill_page (Sales|Margin|Inventory|Supplier|Channel),
is_provisional, direction (UP|DOWN|BAND|CONTEXT), basis (BUDGET|TARGET|PLAN|null), formula (bench only),
owner_initials (bench only), cadence (daily|weekly|monthly)`. The 12 landing rows are tabled in `01-overview.md`.

### `rules[]` (15)

| rule_code | kpi_code | direction | watch_from | off_from | threshold |
|---|---|---|---:|---:|---:|
| NET_SALES | NET_SALES | UP | 0 | 0.03 | |
| TOTAL_MARGIN | TOTAL_MARGIN | UP | 0 | 0.01 | |
| WEEKS_OF_COVER | WEEKS_OF_COVER | BAND | 1 | 2 | |
| MARKDOWN | MARKDOWN | DOWN | 0 | 0.01 | |
| AVAILABILITY | AVAILABILITY | UP | 0 | 0.02 | |
| EBITDA | EBITDA | UP | 0 | 0.05 | |
| LFL_GROWTH | LFL_GROWTH | UP | 0 | 0.02 | |
| FRONT_GM | FRONT_GM | UP | 0 | 0.01 | |
| SELL_THROUGH | SELL_THROUGH | UP | 0 | 0.05 | |
| GMROI | GMROI | UP | 0 | 0.5 | |
| SUPPLIER_OTIF | SUPPLIER_OTIF | UP | 0 | 0.03 | |
| CHANNEL_MIX | CHANNEL_MIX | BAND | 0.02 | 0.03 | |
| DOT_RED_OFF | | | | | 0.3333333333333333 |
| DOT_ORANGE_WATCH_OFF | | | | | 0.5 |
| DOT_GREEN_GOOD | | | | | 0.6666666666666666 |

### `targets[]` (27)

`category_code = "ALL"` rows (used at All categories): AVAILABILITY 0.97 · SUPPLIER_OTIF 0.95 · GMROI 2.5 ·
WEEKS_OF_COVER 9.5 · SELL_THROUGH 0.62. Per-category rows repeat the `categories` columns (GMROI × 9, WEEKS_OF_COVER × 9,
SELL_THROUGH × 4 seasonal). Note: the **weeks-of-cover target is always the forecast-weighted category target**, even
at All (it rounds to 9.500000 at W43); the `ALL` 9.5 row is not read by the cards.

## cube.parquet — 4,599 rows

Grain: `week_ix × group_ix × category_ix`. Weeks 0–94: 5 groups (NL, BE, ONLINE, WHOLESALE, DC) × 9 categories = 45
rows/week (4,275); weeks 95–103: 4 groups (no DC) × 9 = 36 rows/week (324, budget only). No CENTRAL rows. All columns
are additive across groups and categories; **point-in-time** columns are read at one week (never summed over weeks).

| Column | Parquet | Meaning | Non-zero in groups | Non-zero weeks | Kind | Σ all rows |
|---|---|---|---|---|---|---:|
| week_ix | INT32 | week index | | 0–103 | key | |
| group_ix | INT32 | site group 0–4 | | | key | |
| category_ix | INT32 | category 0–8 | | | key | |
| gross_sales | DOUBLE | sales at ticket price, EUR ex VAT | NL BE ONLINE WHOLESALE | 0–94 | flow | 5,579,260,914.32 |
| markdown | DOUBLE | markdowns + discounts, EUR | same | 0–94 | flow | 458,496,099.29 |
| returns | DOUBLE | returns, EUR | same | 0–94 | flow | 25,540,049.61 |
| net_sales | DOUBLE | gross − markdown − returns, EUR | same | 0–94 | flow | 5,095,224,765.42 |
| cogs | DOUBLE | cost of goods sold at landed cost, EUR | same | 0–94 | flow | 3,561,206,580.31 |
| back_margin | DOUBLE | supplier income (rebates, promo funding, listing fees), EUR | same | 0–94 | flow | 309,238,505.36 |
| units | DOUBLE | units sold | same | 0–94 | flow | 1,036,832,856 |
| net_sales_lfl | DOUBLE | net sales of the like-for-like stores (current side) | NL BE | 0–94 | flow | 3,478,910,471.47 |
| net_sales_lfl_as_ly | DOUBLE | on week *w*: LFL stores' sales that are the **LY base of week w + 52** (read it through `ly_week_ix`) | NL BE | 0–94 | flow | 3,437,232,757.62 |
| net_sales_bud | DOUBLE | budget net sales | NL BE ONLINE WHOLESALE | 52–103 | flow | 2,938,389,411.15 |
| gross_sales_bud | DOUBLE | budget gross sales | same | 52–103 | flow | 3,229,618,859.64 |
| markdown_bud | DOUBLE | budget markdown | same | 52–103 | flow | 276,696,163.55 |
| cogs_bud | DOUBLE | budget COGS | same | 52–103 | flow | 2,057,023,793.35 |
| back_margin_bud | DOUBLE | budget back margin | same | 52–103 | flow | 182,163,583.07 |
| net_sales_bud_lfl | DOUBLE | budget net sales of the LFL stores | NL BE | 52–103 | flow | 1,923,505,218.17 |
| on_hand_units | DOUBLE | closing stock units at week end | NL BE ONLINE DC | 0–94 | point in time | |
| on_hand_cost | DOUBLE | closing stock at cost, EUR | NL BE ONLINE DC | 0–94 | point in time | |
| on_order_cost | DOUBLE | open purchase orders at cost, EUR | NL BE ONLINE DC | 0–94 | point in time | |
| forecast_cogs | DOUBLE | forecast weekly COGS (cover denominator) | NL BE ONLINE WHOLESALE | 0–94 | point in time | |
| ranged_sku_days | DOUBLE | top-500 SKUs × stores × 7 days ranged | NL BE | 0–94 | point in time (week) | |
| in_stock_sku_days | DOUBLE | of which in stock | NL BE | 0–94 | point in time (week) | |
| receipt_units | DOUBLE | units received in the week | NL BE ONLINE | 0–94 | flow | 897,685,618 |

## opex.parquet — 1,029 rows

| Column | Parquet | Meaning |
|---|---|---|
| scenario_ix | INT32 | 0 ACT (weeks 0–94, 7 × 95 = 665 rows) · 1 BUD (weeks 52–103, 7 × 52 = 364 rows) |
| week_ix | INT32 | week index |
| cost_type_ix | INT32 | 0 SHRINK (NL, BE) · 1 STORE_OPEX (NL, BE) · 2 CENTRAL_OPEX (CENTRAL only) · 3 FULFILMENT (ONLINE, WHOLESALE) |
| group_ix | INT32 | site group; CENTRAL (5) = cost with no site, counted only in the ALL scope |
| amount | DOUBLE | EUR, 105,734.34 … 8,937,383.91; Σ 2,404,945,933.21 |

No category key: OpEx (and so EBITDA) cannot be split by category → N/A under a category pick.

## po.parquet — 95 rows

| Column | Parquet | Meaning |
|---|---|---|
| week_ix | INT32 | 0–94 |
| po_lines_due | INT32 | inbound PO lines due (4,390–5,530; Σ 458,134) |
| po_lines_otif | INT32 | of which on time and in full (Σ 433,476) |
| suppliers_below_85 | INT32 | suppliers below 85 % OTIF that week (0–2; W43 = 2) |

No site and no category: the same in every region; N/A under a category pick.

## sites.parquet — 190 rows

| Column | Parquet | Meaning |
|---|---|---|
| week_ix | INT32 | 0–94 |
| group_ix | INT32 | 0 NL · 1 BE only |
| trading_stores | INT32 | stores trading that week (W43: NL 82, BE 60 = 142) |
| lfl_stores | INT32 | like-for-like stores (W43: NL 76, BE 55 = 131) |

Distinct store counts do not add over categories, so they live outside the cube; read them at the window's last week.

---

## Power Query (M)

Create the queries in this order (later ones reference earlier ones). Queries marked *staging* have
**Enable load = off**. Set the file's regional setting to **English (United States)** (File › Options › Current file ›
Regional settings) so `FORMAT` in DAX writes `1,234.5`.

### Parameters

```m
// DataFolder (Text, required)
"C:\__VOSK__\data\nordmark\parquet\" meta [IsParameterQuery = true, Type = "Text", IsParameterQueryRequired = true]
```

```m
// ChecksFolder (Text, required)
"C:\__VOSK__\data\nordmark\checks\" meta [IsParameterQuery = true, Type = "Text", IsParameterQueryRequired = true]
```

### Manifest (staging)

```m
let
    Source = Json.Document ( File.Contents ( DataFolder & "manifest.json" ), 65001 )
in
    Source
```

### Report Info (1 row)

```m
let
    M         = Manifest,
    WeekKeys  = List.Transform ( M[weeks], each [week_key] ),
    AsOfIx    = List.PositionOf ( WeekKeys, M[current_week_key] ),
    CurrentFy = M[weeks]{AsOfIx}[fy],
    Refreshed = DateTime.FromText ( M[refreshed], [Format = "yyyy-MM-dd'T'HH:mm", Culture = "en-US"] ),
    Result    = #table (
        type table [
            schema = text, seed = Int64.Type, as_of = date, current_week_key = text, as_of_ix = Int64.Type,
            current_fy = Int64.Type, refreshed = datetime, refreshed_long = text, refreshed_short = text
        ],
        {
            {
                M[schema], M[seed], Date.FromText ( M[as_of] ), M[current_week_key], AsOfIx, CurrentFy, Refreshed,
                DateTime.ToText ( Refreshed, [Format = "ddd d MMM HH:mm", Culture = "en-US"] ),
                DateTime.ToText ( Refreshed, [Format = "ddd HH:mm", Culture = "en-US"] )
            }
        }
    )
in
    Result
```

Expected: `as_of_ix = 94`, `current_fy = 2026`, `refreshed_long = "Mon 26 Oct 05:12"`, `refreshed_short = "Mon 05:12"`.

### Week (104 rows; the date dimension)

```m
let
    M          = Manifest,
    AsOfIx     = #"Report Info"{0}[as_of_ix],
    Raw        = Table.FromRecords ( M[weeks] ),
    Indexed    = Table.AddIndexColumn ( Raw, "week_ix", 0, 1, Int64.Type ),
    Typed      = Table.TransformColumnTypes (
        Indexed,
        {
            {"week_key", type text}, {"fy", Int64.Type}, {"week_of_fy", Int64.Type}, {"period", Int64.Type},
            {"period_key", type text}, {"week_of_period", Int64.Type}, {"weeks_in_period", Int64.Type},
            {"week_start", type date}, {"week_end", type date}, {"period_start", type date}, {"period_end", type date},
            {"ly_week_key", type text}, {"lw_week_key", type text}, {"is_actual", type logical},
            {"season_code", type text}, {"season_week", Int64.Type}, {"week_label", type text}
        },
        "en-US"
    ),
    KeyToIx    = Record.FromList ( Typed[week_ix], Typed[week_key] ),
    AddLy      = Table.AddColumn ( Typed, "ly_week_ix", each if [ly_week_key] = null then null else Record.Field ( KeyToIx, [ly_week_key] ), Int64.Type ),
    AddLw      = Table.AddColumn ( AddLy, "lw_week_ix", each if [lw_week_key] = null then null else Record.Field ( KeyToIx, [lw_week_key] ), Int64.Type ),
    AddQ       = Table.AddColumn ( AddLw, "quarter", each Number.RoundUp ( [period] / 3 ), Int64.Type ),
    AddQKey    = Table.AddColumn ( AddQ, "quarter_key", each "FY" & Text.From ( [fy] ) & "-Q" & Text.From ( [quarter] ), type text ),
    AddFyLabel = Table.AddColumn ( AddQKey, "fy_label", each "FY" & Text.From ( [fy] ), type text ),
    Buf        = Table.Buffer ( AddFyLabel ),
    StartOf    = ( col as text, value as any ) as number =>
        List.Min ( Table.SelectRows ( Buf, ( x ) => Record.Field ( x, col ) = value )[week_ix] ),
    AddPStart  = Table.AddColumn ( Buf, "month_start_ix", each StartOf ( "period_key", [period_key] ), Int64.Type ),
    AddQStart  = Table.AddColumn ( AddPStart, "quarter_start_ix", each StartOf ( "quarter_key", [quarter_key] ), Int64.Type ),
    AddFyStart = Table.AddColumn ( AddQStart, "fy_start_ix", each StartOf ( "fy_label", [fy_label] ), Int64.Type ),
    AddSeason  = Table.AddColumn (
        AddFyStart,
        "season_length",
        each
            if [season_code] = null then null
            else Table.RowCount ( Table.SelectRows ( Buf, ( x ) => x[fy] = [fy] and x[season_code] = [season_code] ) ),
        Int64.Type
    ),
    AddActual  = Table.AddColumn ( AddSeason, "is_in_actuals", each [week_ix] <= AsOfIx and [is_actual], type logical ),
    Sorted     = Table.Sort ( AddActual, {{"week_ix", Order.Ascending}} )
in
    Sorted
```

Check: `ly_week_ix = week_ix − 52` for every FY2026 row, null for FY2025; `lw_week_ix = week_ix − 1` except row 0;
W43 FY2026 (94): `month_start_ix 91`, `quarter_start_ix 91`, `fy_start_ix 52`, `season_week 12`, `season_length 20`.

### Period (127 rows; the period picker, disconnected)

One row per **listed item**: 95 weeks, 22 months (FY2026 P11–P12 have no actual week, so they are not listed),
8 quarters, 2 years. The window of an item = its weeks ∩ actual weeks (contiguous `from_ix … to_ix`). Comparator
windows follow `C:\__VOSK__\src\lib\nordmark\engine\items.ts`:

- **LY** = the same weeks one year back by `ly_week_key` (null when any week has no LY, i.e. all of FY2025).
- **Previous** = at Week: the previous week by `lw_week_key`; at Month / Quarter / Year: the previous item of the same
  granularity, **cut to the picked item's week count when the picked item is partial ("to date")** (like-length).
  Null for the first item.
- **PTD** (Week only, used by the EBITDA flash) = month to date through the week; **PTD LY** its LY; **PTD Previous**
  = the previous month's first *k* weeks, *k* = the week's position in its month; null for the first month of the data
  and for week 5 of a 5-week month (the previous month has only 4 weeks).

```m
let
    W            = Table.Buffer ( Table.Sort ( Week, {{"week_ix", Order.Ascending}} ) ),
    Info         = #"Report Info"{0},
    AsOf         = Info[as_of_ix],
    CurFy        = Info[current_fy],
    LyOf         = List.Buffer ( W[ly_week_ix] ),
    LwOf         = List.Buffer ( W[lw_week_ix] ),
    MonthStartOf = List.Buffer ( W[month_start_ix] ),
    PeriodOf     = List.Buffer ( W[period] ),
    PeriodKeyOf  = List.Buffer ( W[period_key] ),
    StartOfWk    = List.Buffer ( W[week_start] ),
    EndOfWk      = List.Buffer ( W[week_end] ),
    Months       = {"Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"},
    DateRange    = ( a as date, b as date ) as text =>
        let
            D  = ( d as date ) => Text.From ( Date.Day ( d ) ),
            Mo = ( d as date ) => Months{Date.Month ( d ) - 1},
            Y  = ( d as date ) => Text.From ( Date.Year ( d ) )
        in
            if Date.Year ( a ) <> Date.Year ( b ) then D ( a ) & " " & Mo ( a ) & " " & Y ( a ) & "–" & D ( b ) & " " & Mo ( b ) & " " & Y ( b )
            else if Date.Month ( a ) <> Date.Month ( b ) then D ( a ) & " " & Mo ( a ) & "–" & D ( b ) & " " & Mo ( b ) & " " & Y ( b )
            else D ( a ) & "–" & D ( b ) & " " & Mo ( b ) & " " & Y ( b ),
    Spec         = #table (
        type table [
            gran = text, gran_sort = Int64.Type, key_col = text, n_col = text, gran_label = text,
            word_header = text, word_noun = text, word_prev = text, word_short = text, bar_count = Int64.Type
        ],
        {
            { "W",  1, "week_key",    "week_of_fy", "Week",    "Week",    "week",    "Previous week",    "vs prev. wk",  13 },
            { "P",  2, "period_key",  "period",     "Month",   "Month",   "month",   "Previous month",   "vs prev. mth", 12 },
            { "Q",  3, "quarter_key", "quarter",    "Quarter", "Quarter", "quarter", "Previous quarter", "vs prev. qtr",  8 },
            { "FY", 4, "fy_label",    null,         "Year",    "FY",      "year",    "Last year",        "vs LY",         2 }
        }
    ),
    Build        = ( s as record ) as table =>
        let
            Keyed    = Table.AddColumn ( W, "item_key", each Record.Field ( _, s[key_col] ), type text ),
            WithN    = Table.AddColumn ( Keyed, "n", each if s[n_col] = null then 0 else Record.Field ( _, s[n_col] ), Int64.Type ),
            Grouped  = Table.Group (
                WithN,
                {"item_key", "fy", "n"},
                {
                    {"first_all_ix", each List.Min ( [week_ix] ), Int64.Type},
                    {"size",         each Table.RowCount ( _ ), Int64.Type},
                    {"from_ix",      each List.Min ( Table.SelectRows ( _, ( x ) => x[is_in_actuals] )[week_ix] ), Int64.Type},
                    {"to_ix",        each List.Max ( Table.SelectRows ( _, ( x ) => x[is_in_actuals] )[week_ix] ), Int64.Type},
                    {"n_actual",     each List.Count ( List.Select ( [is_in_actuals], ( b ) => b ) ), Int64.Type}
                }
            ),
            Listed   = Table.Sort ( Table.SelectRows ( Grouped, each [from_ix] <> null ), {{"first_all_ix", Order.Ascending}} ),
            Ord      = Table.AddIndexColumn ( Listed, "item_ord", 0, 1, Int64.Type ),
            Froms    = List.Buffer ( Ord[from_ix] ),
            Tos      = List.Buffer ( Ord[to_ix] ),
            WithSpec = Table.AddColumn ( Ord, "spec", each s ),
            Expanded = Table.ExpandRecordColumn (
                WithSpec, "spec",
                {"gran", "gran_sort", "gran_label", "word_header", "word_noun", "word_prev", "word_short", "bar_count"}
            ),
            Prev     = Table.AddColumn (
                Expanded,
                "prev",
                each
                    if [gran] = "W" then
                        ( let lw = LwOf{[to_ix]} in if lw = null then null else [f = lw, t = lw] )
                    else if [item_ord] = 0 then
                        null
                    else
                        (
                            let
                                pf = Froms{[item_ord] - 1},
                                pt = Tos{[item_ord] - 1}
                            in
                                [f = pf, t = if [n_actual] < [size] then List.Min ( {pt, pf + [n_actual] - 1} ) else pt]
                        )
            ),
            PrevCols = Table.ExpandRecordColumn ( Prev, "prev", {"f", "t"}, {"prev_from_ix", "prev_to_ix"} )
        in
            PrevCols,
    AllGrans     = Table.Combine ( List.Transform ( Table.ToRecords ( Spec ), Build ) ),
    Sorted       = Table.Sort ( AllGrans, {{"gran_sort", Order.Ascending}, {"item_ord", Order.Ascending}} ),
    WithId       = Table.AddIndexColumn ( Sorted, "item_id", 0, 1, Int64.Type ),
    PItems       = Table.Buffer ( Table.SelectRows ( WithId, each [gran] = "P" ) ),
    AddLy        = Table.AddColumn (
        WithId,
        "ly",
        each let lf = LyOf{[from_ix]}, lt = LyOf{[to_ix]} in if lf = null or lt = null then null else [f = lf, t = lt]
    ),
    LyCols       = Table.ExpandRecordColumn ( AddLy, "ly", {"f", "t"}, {"ly_from_ix", "ly_to_ix"} ),
    AddPtd       = Table.AddColumn (
        LyCols,
        "ptd",
        each
            if [gran] <> "W" then null
            else
                let
                    L     = [to_ix],
                    Ms    = MonthStartOf{L},
                    K     = L - Ms + 1,
                    LyF   = LyOf{Ms},
                    LyT   = LyOf{L},
                    Cur   = Table.SelectRows ( PItems, ( p ) => p[item_key] = PeriodKeyOf{L} ){0},
                    PrevP = if Cur[item_ord] = 0 then null else Table.SelectRows ( PItems, ( p ) => p[item_ord] = Cur[item_ord] - 1 ){0},
                    HasPP = PrevP <> null and PrevP[n_actual] >= K,
                    Fy    = [fy]
                in
                    [
                        ptd_from_ix      = Ms,
                        ptd_to_ix        = L,
                        ptd_ly_from_ix   = if LyF = null or LyT = null then null else LyF,
                        ptd_ly_to_ix     = if LyF = null or LyT = null then null else LyT,
                        ptd_prev_from_ix = if HasPP then PrevP[from_ix] else null,
                        ptd_prev_to_ix   = if HasPP then PrevP[from_ix] + K - 1 else null,
                        ptd_prev_name    =
                            if HasPP then
                                "P" & Text.From ( PrevP[n] )
                                    & ( if PrevP[fy] = Fy then "" else " FY" & Text.From ( PrevP[fy] ) )
                                    & " " & ( if K = 1 then "week 1" else "weeks 1–" & Text.From ( K ) )
                            else null
                    ]
    ),
    PtdCols      = Table.ExpandRecordColumn (
        AddPtd, "ptd",
        {"ptd_from_ix", "ptd_to_ix", "ptd_ly_from_ix", "ptd_ly_to_ix", "ptd_prev_from_ix", "ptd_prev_to_ix", "ptd_prev_name"}
    ),
    AddLabels    = Table.AddColumn (
        PtdCols,
        "labels",
        each
            let
                Partial  = [n_actual] < [size],
                FySuffix = if [gran] <> "FY" and [fy] <> CurFy then " FY" & Text.From ( [fy] ) else "",
                ToDate   = if Partial then " to date" else "",
                Yy       = Text.End ( Text.From ( [fy] ), 2 ),
                Base     = if [gran] = "FY" then "FY" & Text.From ( [fy] ) else [gran] & Text.From ( [n] ),
                Bar      =
                    if [gran] = "Q" then "Q" & Text.From ( [n] ) & " FY" & Yy
                    else if [gran] = "FY" then "FY" & Yy
                    else [gran] & Text.From ( [n] ),
                Dates    = DateRange ( StartOfWk{[from_ix]}, EndOfWk{[to_ix]} )
            in
                [
                    is_partial         = Partial,
                    chip_label         = Base & ( if Partial then " · to date" else "" ),
                    chip_sort          = if [gran] = "FY" then [fy] else [n],
                    fy_label           = "FY" & Text.From ( [fy] ),
                    title              = if [gran] = "FY" then "FY" & Text.From ( [fy] ) else [word_header] & " " & Text.From ( [n] ) & FySuffix,
                    to_date_suffix     = ToDate,
                    date_text          = Dates,
                    header_period_rest = ToDate & " · " & Dates,
                    window_phrase      =
                        if [gran] = "FY" then "FY" & Text.From ( [fy] ) & ToDate
                        else [word_noun] & " " & Text.From ( [n] ) & FySuffix & ToDate,
                    bar_label          = Bar,
                    bar_label_u        = Bar & ( if [fy] = CurFy then Character.FromNumber ( 8203 ) else "" ),
                    last_period        = PeriodOf{[to_ix]},
                    is_default         = [item_key] = Info[current_week_key],
                    contains_as_of     = AsOf >= [first_all_ix] and AsOf <= [first_all_ix] + [size] - 1
                ]
    ),
    Labels       = Table.ExpandRecordColumn (
        AddLabels, "labels",
        {
            "is_partial", "chip_label", "chip_sort", "fy_label", "title", "to_date_suffix", "date_text",
            "header_period_rest", "window_phrase", "bar_label", "bar_label_u", "last_period", "is_default", "contains_as_of"
        }
    ),
    Typed        = Table.TransformColumnTypes (
        Labels,
        {
            {"ly_from_ix", Int64.Type}, {"ly_to_ix", Int64.Type}, {"prev_from_ix", Int64.Type}, {"prev_to_ix", Int64.Type},
            {"ptd_from_ix", Int64.Type}, {"ptd_to_ix", Int64.Type}, {"ptd_ly_from_ix", Int64.Type}, {"ptd_ly_to_ix", Int64.Type},
            {"ptd_prev_from_ix", Int64.Type}, {"ptd_prev_to_ix", Int64.Type}, {"ptd_prev_name", type text},
            {"is_partial", type logical}, {"chip_label", type text}, {"chip_sort", Int64.Type}, {"fy_label", type text},
            {"title", type text}, {"to_date_suffix", type text}, {"date_text", type text}, {"header_period_rest", type text},
            {"window_phrase", type text}, {"bar_label", type text}, {"bar_label_u", type text}, {"last_period", Int64.Type},
            {"is_default", type logical}, {"contains_as_of", type logical}
        }
    )
in
    Typed
```

`bar_label_u` appends a zero-width space (U+200B) to FY2026 labels so "W43" of FY2025 and FY2026 stay distinct axis
categories while looking identical. The complete expected Period table is at the end of this file.

### Bar Item (127 rows; bar-chart axis, disconnected)

```m
let
    Source = Table.SelectColumns (
        Period,
        {"item_id", "item_key", "gran", "fy", "n", "item_ord", "from_ix", "to_ix", "bar_label", "bar_label_u"}
    )
in
    Source
```

### Site Group (6)

```m
let
    Groups = Manifest[groups],
    Rows   = #table (
        type table [ group_code = text, group_name = text, channel = text, is_store = logical, is_selling = logical ],
        {
            { "NL",        "Netherlands stores",   "Store",     true,  true  },
            { "BE",        "Belgium stores",       "Store",     true,  true  },
            { "ONLINE",    "Online",               "Online",    false, true  },
            { "WHOLESALE", "Wholesale",            "Wholesale", false, false },
            { "DC",        "Distribution centres", null,        false, false },
            { "CENTRAL",   "Central (no site)",    null,        false, false }
        }
    ),
    WithIx = Table.AddColumn ( Rows, "group_ix", each List.PositionOf ( Groups, [group_code] ), Int64.Type )
in
    WithIx
```

`is_store` = the stores (LFL, availability, store sales); `is_selling` = selling locations for sell-through (wholesale
excluded); `channel` = the Channel mix channels (DC and CENTRAL have none).

### Region (4) and Region Group (9)

```m
// Region
#table (
    type table [ region_code = text, region_label = text, scope_code = text, scope_word = text, region_sort = Int64.Type ],
    {
        { "all",    "All",          "ALL",    "all channels", 1 },
        { "nl",     "Netherlands",  "NL",     "Netherlands",  2 },
        { "be",     "Belgium",      "BE",     "Belgium",      3 },
        { "online", "Online only",  "ONLINE", "online",       4 }
    }
)
```

```m
// Region Group: ALL = every group (wholesale, the DCs and central costs count only in ALL)
#table (
    type table [ region_code = text, group_code = text ],
    {
        { "all", "NL" }, { "all", "BE" }, { "all", "ONLINE" }, { "all", "WHOLESALE" }, { "all", "DC" }, { "all", "CENTRAL" },
        { "nl", "NL" }, { "be", "BE" }, { "online", "ONLINE" }
    }
)
```

### Category (9)

```m
let
    Raw     = Table.FromRecords ( Manifest[categories] ),
    Indexed = Table.AddIndexColumn ( Raw, "category_ix", 0, 1, Int64.Type ),
    Typed   = Table.TransformColumnTypes (
        Indexed,
        {
            {"category_code", type text}, {"category_name", type text}, {"is_seasonal", type logical},
            {"cover_target_wks", type number}, {"gmroi_target", type number}, {"sellthrough_target", type number},
            {"sort_order", Int64.Type}
        }
    )
in
    Typed
```

### KPI (32), Status Rule (15), Target (27)

```m
// KPI
let
    Raw   = Table.FromRecords ( Manifest[kpis] ),
    Typed = Table.TransformColumnTypes (
        Raw,
        {
            {"kpi_code", type text}, {"catalogue_no", Int64.Type}, {"kpi_name", type text}, {"domain", type text},
            {"is_landing", type logical}, {"size", type text}, {"card_order", Int64.Type}, {"group", type text},
            {"lever", type text}, {"horizon", type text}, {"owner", type text}, {"statement", type text},
            {"drill_page", type text}, {"is_provisional", type logical}, {"direction", type text}, {"basis", type text},
            {"formula", type text}, {"owner_initials", type text}, {"cadence", type text}
        }
    ),
    AddOwnerCadence = Table.AddColumn ( Typed, "owner_cadence", each ( if [owner_initials] = null then "" else [owner_initials] ) & " · " & [cadence], type text ),
    DomainOrder     = Table.AddColumn ( AddOwnerCadence, "domain_sort", each List.PositionOf ( {"Sales", "Margin", "Inventory", "Supplier", "Cost", "Profit", "Cash", "Customer", "People & risk"}, [domain] ) + 1, Int64.Type )
in
    DomainOrder
```

```m
// Status Rule
let
    Raw = Table.FromRecords ( Manifest[rules] )
in
    Table.TransformColumnTypes (
        Raw,
        {{"rule_code", type text}, {"kpi_code", type text}, {"direction", type text}, {"watch_from", type number}, {"off_from", type number}, {"threshold", type number}}
    )
```

```m
// Target
let
    Raw = Table.FromRecords ( Manifest[targets] )
in
    Table.TransformColumnTypes ( Raw, {{"kpi_code", type text}, {"category_code", type text}, {"target_value", type number}} )
```

### Cube, Opex, PO, Sites (facts)

```m
// Cube
let
    Source  = Parquet.Document ( File.Contents ( DataFolder & "cube.parquet" ) ),
    Numbers = List.RemoveItems ( Table.ColumnNames ( Source ), {"week_ix", "group_ix", "category_ix"} ),
    Typed   = Table.TransformColumnTypes (
        Source,
        {{"week_ix", Int64.Type}, {"group_ix", Int64.Type}, {"category_ix", Int64.Type}}
            & List.Transform ( Numbers, each {_, type number} )
    )
in
    Typed
```

```m
// Opex
let
    Source   = Parquet.Document ( File.Contents ( DataFolder & "opex.parquet" ) ),
    Typed    = Table.TransformColumnTypes (
        Source,
        {{"scenario_ix", Int64.Type}, {"week_ix", Int64.Type}, {"cost_type_ix", Int64.Type}, {"group_ix", Int64.Type}, {"amount", type number}}
    ),
    Scenario = Table.AddColumn ( Typed, "scenario", each {"ACT", "BUD"}{[scenario_ix]}, type text ),
    CostType = Table.AddColumn ( Scenario, "cost_type", each {"SHRINK", "STORE_OPEX", "CENTRAL_OPEX", "FULFILMENT"}{[cost_type_ix]}, type text )
in
    CostType
```

```m
// PO
let
    Source = Parquet.Document ( File.Contents ( DataFolder & "po.parquet" ) )
in
    Table.TransformColumnTypes (
        Source,
        {{"week_ix", Int64.Type}, {"po_lines_due", Int64.Type}, {"po_lines_otif", Int64.Type}, {"suppliers_below_85", Int64.Type}}
    )
```

```m
// Sites
let
    Source = Parquet.Document ( File.Contents ( DataFolder & "sites.parquet" ) )
in
    Table.TransformColumnTypes (
        Source,
        {{"week_ix", Int64.Type}, {"group_ix", Int64.Type}, {"trading_stores", Int64.Type}, {"lfl_stores", Int64.Type}}
    )
```

Row-count guard (optional): add a step `if Table.RowCount ( Source ) <> Manifest[files][cube][rows] then error "cube.parquet: row count" else Source`
to each fact query (4,599 / 1,029 / 95 / 190).

### Comparator (3) and Window (5): disconnected switch tables

```m
// Comparator
#table (
    type table [ comparator_code = text, comparator_label = text, comparator_sort = Int64.Type ],
    { { "budget", "Budget", 1 }, { "ly", "Last year", 2 }, { "prev", "Previous", 3 } }
)
```

```m
// Window (internal; never on a slicer)
#table (
    type table [ window_code = text, window_label = text ],
    {
        { "CUR",  "Picked period (EBITDA family: month to date at Week)" },
        { "LY",   "Last year, same retail weeks" },
        { "PREV", "Previous week / month / quarter (like-length)" },
        { "ITEM", "Picked period, never month to date" },
        { "BAR",  "The bar item in the row context" }
    }
)
```

### Card (12): card copy and behaviour (the page text, from `C:\__VOSK__\src\lib\nordmark\engine\copy.ts`)

`metric_code` = the value's metric, `series_metric` = the bars' metric (null = no bars), `delta_kind` = how the Δ line
is written, `budget_delta_label` = the Δ label under the Budget comparator, `target_style` = basis printed as "97%"
(trailing ".0" dropped) under Budget.

```m
#table (
    type table [ kpi_code = text, card_order = Int64.Type, kpi_name = text, size = text, tier = Int64.Type, metric_code = text, series_metric = text, delta_kind = text, budget_delta_label = text, target_style = logical, basis = text, basis_label = text, group_code = text, group_label = text, lever_code = text, lever_label = text, owner_code = text, owner_label = text, is_provisional = logical, drill_page_label = text, sub_base = text, rule = text, what = text, why = text, formula = text, cadence = text, provisional_note = text ],
    {
    { "NET_SALES", 1, "Net sales", "hero", 1, "net_sales", "net_sales", "EUR", "vs budget", false, "BUDGET", "Budget", "B1", "B1 base-crucial", "sales", "Sales", "commercial", "Commercial", false, "Sales page", "all channels", "Watch when −3% to 0% vs budget; Off track below −3%.", "The money customers actually paid us in the picked period, after returns, discounts and VAT.", "It is the top line every other number divides by or adds up to; if it slips, the margin and stock numbers follow.", "Gross sales at ticket price − markdowns and discounts − returns, excluding VAT.", "refresh", null },
    { "TOTAL_MARGIN", 2, "Total margin", "hero", 1, "total_margin_pct", "total_margin_pct", "PP", "vs budget", false, "BUDGET", "Budget", "B1", "B1 base-crucial", "margin", "Margin", "finance", "Finance", true, "Margin page", "front + back", "Watch when −1.0 pp to 0 vs budget; Off track below −1.0 pp. Provisional until the monthly true-up.", "The share of each euro of sales we keep after paying suppliers for the goods, counting the money suppliers pay back to us.", "Front margin alone hides half of a reseller’s profit; this is the margin the business really keeps.", "(Front margin + back margin) ÷ Net sales. Front = sales − cost of goods; back = supplier rebates, promo funding and listing fees.", "refresh", "Provisional · true-up 10 Nov" },
    { "WEEKS_OF_COVER", 3, "Weeks of cover", "hero", 1, "weeks_of_cover", "weeks_of_cover", "WKS", "vs target", false, "TARGET", "Target", "B1", "B1 base-crucial", "stock", "Stock", "supply", "Supply chain", false, "Inventory page", "forward", "On track within ±1 wk of target 9.5; Watch 1–2 wks away; Off track beyond ±2 wks.", "How many weeks our stock would last at the sales we expect, if nothing more arrived.", "Too little and shelves go empty; too much and the stock ends in markdown. It decides the next buying actions.", "(Stock on hand + stock on order, at cost) ÷ forecast cost of goods sold per week.", "refresh", null },
    { "MARKDOWN", 4, "Markdown", "med", 2, "markdown_pct", "markdown_pct", "PP", "vs budget", false, "BUDGET", "Budget", "B2", "B2 margin & cost", "margin", "Margin", "commercial", "Commercial", false, "Margin page", "% of gross sales", "Lower is better. Watch when 0 to +1.0 pp vs budget; Off track above +1.0 pp.", "The part of the ticket price we gave away through price cuts and promotions.", "Every point of markdown is margin lost; rising markdown is the first sign of too much or the wrong stock.", "Markdown value (permanent + promotional) ÷ gross sales at ticket price.", "refresh", null },
    { "AVAILABILITY", 5, "Availability", "med", 2, "availability_pct", "availability_pct", "PP", "vs target", true, "TARGET", "Target", "B3", "B3 stock & supply", "supply", "Supply", "supply", "Supply chain", false, "Inventory page", "top-500 SKUs, weighted", "On track at 97% or above; Watch 95–97%; Off track below 95%.", "How often our best-selling products were actually on the shelf when a customer could buy them.", "A gap on the shelf is a sale that never happens; it is the ""too little stock"" failure mode.", "SKU-store-days in stock ÷ SKU-store-days ranged, for the top-500 sellers, weighted by sales.", "refresh", null },
    { "EBITDA", 6, "EBITDA flash", "med", 2, "ebitda", "ebitda", "EUR", "vs budget", false, "BUDGET", "Budget", "B2", "B2 margin & cost", "margin", "Margin", "finance", "Finance", true, "Margin page", "to date", "Watch when −5% to 0 vs budget; Off track below −5%. Provisional until month-end close.", "Profit before interest, tax and depreciation in the picked period (at Week: the month so far): what is left after all operating costs.", "It is the bottom line the board sees; every margin and cost move lands here.", "Total margin − shrink − store costs − central costs − fulfilment costs; ÷ Net sales for the margin %.", "refresh", "Provisional · weekly flash" },
    { "LFL_GROWTH", 7, "Like-for-like growth", "sm", 2, "lfl_growth_pct", "lfl_growth_pct", "PP", "vs budget LFL", false, "BUDGET", "Budget", "B4", "B4 channel & customer", "sales", "Sales", "commercial", "Commercial", false, "Sales page", "vs LY", "Watch when −2 pp to 0 vs budget LFL; Off track below −2 pp.", "Sales growth in the stores that were open a year ago too, so new openings and closures do not distort it.", "It tells you whether the existing business is growing, not just the estate.", "Sales of stores open ≥ 13 months in the picked period ÷ the same stores’ sales in the same retail weeks last year − 1.", "refresh", null },
    { "FRONT_GM", 8, "Front gross margin", "sm", 2, "front_gm_pct", "front_gm_pct", "PP", "vs budget", false, "BUDGET", "Budget", "B2", "B2 margin & cost", "margin", "Margin", "finance", "Finance", false, "Margin page", "% of net sales", "Watch when −1.0 pp to 0 vs budget; Off track below −1.0 pp.", "The share of sales left after paying what the goods cost us, landed in our warehouse.", "It is the price-minus-cost half of profit; pricing, buying cost and category mix show up here first.", "(Net sales − cost of goods at landed cost) ÷ Net sales.", "refresh", null },
    { "SELL_THROUGH", 9, "Sell-through", "sm", 2, "sell_through_pct", "sell_through_pct", "PP", "vs target", true, "TARGET", "Target", "B3", "B3 stock & supply", "stock", "Stock", "commercial", "Commercial", false, "Inventory page", "A/W season to date", "Watch when −5 pp to 0 vs the season target; Off track below −5 pp.", "The share of the season’s stock we have sold so far.", "It says whether the season is clearing on time or heading for clearance markdown.", "Units sold season to date ÷ (opening stock units + units received).", "weekly", null },
    { "GMROI", 10, "GMROI", "sm", 2, "gmroi", "gmroi", "X", "vs target", false, "TARGET", "Target", "B3", "B3 stock & supply", "cash", "Cash", "finance", "Finance", false, "Inventory page", "rolling 12 months", "On track at 2.5× or above; Watch 2.0–2.5×; Off track below 2.0×.", "How many euros of margin each euro tied up in stock earned over the last 12 months.", "Stock costs money to hold; this says whether it is earning its keep.", "Front gross margin for the last 52 weeks ÷ average stock at cost over the same 52 week-ends.", "weekly", null },
    { "SUPPLIER_OTIF", 11, "Supplier OTIF", "sm", 2, "otif_pct", "otif_pct", "PP", "vs target", true, "TARGET", "Target", "B3", "B3 stock & supply", "supply", "Supply", "supply", "Supply chain", false, "Supplier page", "inbound, PO lines", "On track at 95% or above; Watch 92–95%; Off track below 92%.", "The share of purchase-order lines suppliers delivered on the agreed day and in the agreed quantity.", "Late or short deliveries become empty shelves two weeks later.", "PO lines received on time and in full ÷ PO lines due.", "refresh", null },
    { "CHANNEL_MIX", 12, "Channel mix", "sm", 2, "mix_store_pct", null, "MIX", "vs plan", false, "PLAN", "Plan", "B4", "B4 channel & customer", "sales", "Sales", "digital", "Digital", false, "Channel & customer page", "% of net sales vs plan", "On track within ±2 pp of the plan mix per channel; Watch 2–3 pp away; Off track beyond 3 pp.", "What share of sales came through stores, online and wholesale.", "A shift between channels changes margin and cost to serve even when total sales look fine.", "Each channel’s net sales ÷ total net sales, compared with the planned mix.", "refresh", null }
    }
)
```

### KPI Drill Step (48): the drill path of each card

```m
#table (
    type table [ kpi_code = text, step_no = Int64.Type, step_title = text, step_text = text, is_last = logical ],
    {
    { "NET_SALES", 1, "Weekly net sales vs budget and LY", "13–26 retail weeks; the same frame as the card, with the comparator carried.", false },
    { "NET_SALES", 2, "Store ranking", "142 rows: net sales, Δ vs budget, LFL %, basket value, traffic; click a store.", false },
    { "NET_SALES", 3, "Store × category × week", "A matrix for the chosen store; click a cell.", false },
    { "NET_SALES", 4, "SKU-store-day rows", "Units, net sales, markdown, on-hand; ""open receipt lines"" hands the key to the POS domain model.", true },
    { "TOTAL_MARGIN", 1, "Margin bridge", "LY margin % → price → mix → landed cost → markdown → back margin → the picked period.", false },
    { "TOTAL_MARGIN", 2, "Category × subcategory matrix", "Net sales, front %, back %, total %, markdown %, shrink %, Δ pp vs plan.", false },
    { "TOTAL_MARGIN", 3, "SKU × promotion list", "Sell price, landed cost, markdown €, promo funding, margin €.", false },
    { "TOTAL_MARGIN", 4, "Contract accrual lines", "Rate, qualifying purchases, accrued, invoiced, provisional flag.", true },
    { "WEEKS_OF_COVER", 1, "Stock at cost by category vs target cover", "Bars with target markers, over and under coloured.", false },
    { "WEEKS_OF_COVER", 2, "SKU exception list", "Three tabs: out-of-stock top sellers, overstock (cover > 26 wks), delisted with stock.", false },
    { "WEEKS_OF_COVER", 3, "SKU-store-day snapshot", "On hand, on order, in transit, first-receipt date, last sale.", false },
    { "WEEKS_OF_COVER", 4, "Open PO lines", "Due date, supplier, OTIF status; the PO domain model from here.", true },
    { "MARKDOWN", 1, "Markdown by promo type", "TPR, multibuy, clearance, loyalty: value and % of sales.", false },
    { "MARKDOWN", 2, "Category × subcategory matrix", "Markdown % next to front, back and total margin.", false },
    { "MARKDOWN", 3, "SKU × promotion list", "Markdown €, funding source (supplier / own), start and end.", false },
    { "MARKDOWN", 4, "Receipt lines", "POS domain model, via the SKU-store-day key.", true },
    { "AVAILABILITY", 1, "Availability by store cluster", "Heatmap: cluster × week.", false },
    { "AVAILABILITY", 2, "Out-of-stock top sellers", "SKU list with lost-sales estimate.", false },
    { "AVAILABILITY", 3, "SKU-store-day snapshot", "On hand, on order, in transit, last sale.", false },
    { "AVAILABILITY", 4, "Open PO lines", "Due date, supplier, OTIF status.", true },
    { "EBITDA", 1, "EBITDA bridge", "Total margin → shrink → store OpEx → central OpEx → fulfilment → EBITDA.", false },
    { "EBITDA", 2, "Store operating cost % by format and region", "Payroll, rent, utilities vs budget.", false },
    { "EBITDA", 3, "Cost centre × account", "GL detail for the period.", false },
    { "EBITDA", 4, "GL journal lines", "Finance system, via the cost-centre key.", true },
    { "LFL_GROWTH", 1, "LFL vs non-LFL bridge", "LY → LFL growth → new stores → closures → online → wholesale → actual.", false },
    { "LFL_GROWTH", 2, "LFL growth by format and region", "Hyper, super, convenience × NL, BE.", false },
    { "LFL_GROWTH", 3, "Store ranking, LFL set", "131 rows: LFL %, Δ vs budget, basket, traffic.", false },
    { "LFL_GROWTH", 4, "Store × category × week", "Matrix for the chosen store.", true },
    { "FRONT_GM", 1, "Margin % by category vs plan", "Dumbbell: plan vs actual per category.", false },
    { "FRONT_GM", 2, "Category × subcategory matrix", "Front %, back %, total %, markdown %, shrink %.", false },
    { "FRONT_GM", 3, "SKU × promotion list", "Sell price, landed cost, margin €.", false },
    { "FRONT_GM", 4, "Receipt lines for COGS", "POS domain model.", true },
    { "SELL_THROUGH", 1, "Sell-through by season × category", "Curve vs target curve per category.", false },
    { "SELL_THROUGH", 2, "Aged stock buckets", "0–30 / 31–90 / 91–180 / 180+ days at cost.", false },
    { "SELL_THROUGH", 3, "SKU exception list, overstock tab", "Cover > 26 wks, € at cost.", false },
    { "SELL_THROUGH", 4, "SKU-store-day snapshot", "On hand, on order, in transit, last sale.", true },
    { "GMROI", 1, "GMROI by category", "Ranked bar vs category target.", false },
    { "GMROI", 2, "Stock at cost by category vs cover", "Where the stock sits.", false },
    { "GMROI", 3, "SKU exception list", "Overstock and delisted with stock.", false },
    { "GMROI", 4, "SKU-store-day snapshot", "On hand, on order, last sale.", true },
    { "SUPPLIER_OTIF", 1, "OTIF trend and by supplier", "Ranked bar, volume-weighted.", false },
    { "SUPPLIER_OTIF", 2, "Supplier scorecard", "Spend, OTIF, lead time, PPV, back margin %.", false },
    { "SUPPLIER_OTIF", 3, "Contract", "Terms, rebate scheme, accrual vs earned.", false },
    { "SUPPLIER_OTIF", 4, "PO line × receipt", "Ordered, received, due and received dates.", true },
    { "CHANNEL_MIX", 1, "Channel mix trend", "100% stacked area, 13–26 weeks.", false },
    { "CHANNEL_MIX", 2, "Channel P&L matrix", "Net sales, margin, cost to serve, contribution per channel.", false },
    { "CHANNEL_MIX", 3, "Store format / online site", "Hyper, super, convenience; web, app, marketplace.", false },
    { "CHANNEL_MIX", 4, "Order lines", "E-commerce and wholesale domain models.", true }
    }
)
```

### Metric (82): every figure code the engine computes, with its DAX measure

The 43 `is_catalogue = true` rows are the metric catalogue of `C:\__VOSK__\src\lib\nordmark\chat-metrics.ts`
(meaning and aliases verbatim); the other rows are the status bases and the helper figures the cards and the
validation need. `flash = true` = read month to date when the picked granularity is Week. `layer1_measure` is the DAX
measure `[Metric Value]` dispatches to (`04-measures.md`).

```m
#table (
    type table [ metric_code = text, metric_name = text, unit = text, basis_code = text, basis_label = text, card_code = text, flash = logical, is_catalogue = logical, sort = Int64.Type, layer1_measure = text, meaning = text, aliases = text ],
    {
    { "gross_sales", "Gross sales", "eur", null, null, null, false, true, 1, "Gross Sales", "Sales at ticket price, before markdowns and returns.", "sales at ticket" },
    { "markdown", "Markdown value", "eur", null, null, null, false, true, 2, "Markdown", "Markdowns and discounts in EUR.", "markdowns and discounts in EUR" },
    { "returns", "Returns", "eur", null, null, null, false, true, 3, "Returns", "Returns in EUR.", "refunds" },
    { "net_sales", "Net sales", "eur", "net_sales_bud", "budget", "NET_SALES", false, true, 4, "Net Sales", "Gross sales at ticket minus markdowns and discounts minus returns, in EUR. Lead card 1.", "sales, revenue, turnover" },
    { "cogs", "Cost of goods", "eur", null, null, null, false, true, 5, "COGS", "Cost of the goods sold, in EUR.", "COGS, cost of sales" },
    { "back_margin", "Back margin", "eur", null, null, null, false, true, 6, "Back Margin", "Supplier income (rebates, allowances), in EUR.", "supplier income, rebates" },
    { "front_margin", "Front margin", "eur", null, null, null, false, true, 7, "Front Margin", "Net sales minus cost of goods, in EUR.", "gross margin in EUR" },
    { "total_margin", "Total margin", "eur", null, null, null, false, true, 8, "Total Margin", "Front margin plus back margin, in EUR.", "total margin in EUR" },
    { "front_gm_pct", "Front gross margin %", "pct", "front_gm_pct_bud", "budget", "FRONT_GM", false, true, 9, "Front GM %", "Net sales minus cost of goods, as a share of net sales.", "front margin %, gross margin %" },
    { "back_margin_pct", "Back margin %", "pct", null, null, null, false, true, 10, "Back Margin %", "Back margin as a share of net sales.", "supplier income %" },
    { "total_margin_pct", "Total margin %", "pct", "total_margin_pct_bud", "budget", "TOTAL_MARGIN", false, true, 11, "Total Margin %", "Front margin plus back margin (supplier income), as a share of net sales. Lead card 2.", "margin, total margin, gross margin incl. back margin" },
    { "markdown_pct", "Markdown %", "pct", "markdown_pct_bud", "budget", "MARKDOWN", false, true, 12, "Markdown %", "Markdowns and discounts as a share of gross sales; lower is better.", "markdowns, discounts, price reductions" },
    { "opex_shrink", "Shrink", "eur", "opex_shrink_bud", "budget", null, true, true, 13, "Opex Shrink", "Stock loss, in EUR; at Week, month to date.", "shrinkage, stock loss" },
    { "opex_store", "Store costs", "eur", "opex_store_bud", "budget", null, true, true, 14, "Opex Store", "Store operating costs, in EUR; at Week, month to date.", "store opex, store operating costs" },
    { "opex_central", "Central costs", "eur", "opex_central_bud", "budget", null, true, true, 15, "Opex Central", "Central operating costs, in EUR (All regions only); at Week, month to date.", "central opex, head office costs" },
    { "opex_fulfilment", "Fulfilment costs", "eur", "opex_fulfilment_bud", "budget", null, true, true, 16, "Opex Fulfilment", "Fulfilment costs, in EUR; at Week, month to date.", "fulfilment opex, logistics costs" },
    { "ebitda", "EBITDA", "eur", "ebitda_bud", "budget", "EBITDA", true, true, 17, "EBITDA", "Total margin minus shrink, store, central and fulfilment costs, in EUR. At Week the card shows month to date. Not split by category; a region pick is a contribution before central costs.", "EBITDA flash, operating profit, bottom line" },
    { "ebitda_margin_pct", "EBITDA margin", "pct", "ebitda_margin_pct_bud", "budget", null, true, true, 18, "EBITDA Margin %", "EBITDA as a share of net sales; at Week, month to date.", "EBITDA %" },
    { "po_lines_due", "PO lines due", "int", null, null, null, false, true, 19, "PO Lines Due", "Inbound purchase-order lines due in the period.", "purchase order lines" },
    { "po_lines_otif", "PO lines on time and in full", "int", null, null, null, false, true, 20, "PO Lines OTIF", "Inbound PO lines delivered on time and in full.", "OTIF lines" },
    { "otif_pct", "Supplier OTIF", "pct", "otif_target", "target", "SUPPLIER_OTIF", false, true, 21, "OTIF %", "Inbound PO lines delivered on time and in full ÷ PO lines due. Not split by category or region (no site).", "on time in full, supplier delivery, PO lines OTIF" },
    { "otif_target", "OTIF Target", "pct", null, null, null, false, false, 22, "OTIF Target", null, null },
    { "store_net_sales", "Store Net Sales", "eur", null, null, null, false, false, 23, "Store Net Sales", null, null },
    { "store_net_sales_ly", "Store Net Sales LY", "eur", null, null, null, false, false, 24, "Store Net Sales LY", null, null },
    { "lfl_net_sales", "LFL net sales", "eur", null, null, null, false, true, 25, "LFL Net Sales", "Net sales of the like-for-like stores, in EUR.", "like-for-like sales" },
    { "lfl_net_sales_ly", "LFL net sales last year", "eur", null, null, null, false, true, 26, "LFL Net Sales LY", "The like-for-like stores' net sales in the same weeks last year.", "like-for-like sales last year" },
    { "lfl_store_count", "LFL stores", "int", null, null, null, false, true, 27, "LFL Store Count", "Number of like-for-like stores at the last week of the period.", "like-for-like store count" },
    { "lfl_growth_pct", "Like-for-like growth", "spct", "lfl_growth_pct_bud", "budget", "LFL_GROWTH", false, true, 28, "LFL Growth %", "Net sales of stores trading in both years ÷ the same stores' sales in the same retail weeks last year, minus 1. Stores only.", "LFL, comparable store sales growth" },
    { "nonlfl_effect_pp", "Non-LFL effect", "pp", null, null, null, false, true, 29, "Non-LFL Effect pp", "Store sales growth minus like-for-like growth, in percentage points: what openings and closures add.", "new and closed stores effect" },
    { "on_hand_cost", "Stock on hand at cost", "eur", null, null, null, false, true, 30, "On Hand Cost", "Stock on hand at cost at the last week of the period, in EUR.", "inventory, stock value" },
    { "on_order_cost", "Stock on order", "eur", null, null, null, false, true, 31, "On Order Cost", "Stock on order at cost at the last week of the period, in EUR.", "open orders at cost" },
    { "forecast_cogs", "Forecast weekly cost of goods", "eur", null, null, null, false, true, 32, "Forecast COGS", "Forecast weekly cost of goods, the denominator of weeks of cover.", "forecast COGS" },
    { "stock_incl_on_order", "Stock incl. on-order", "eur", null, null, null, false, true, 33, "Stock Incl On Order", "Stock on hand plus on order at cost, the numerator of weeks of cover.", "total stock at cost" },
    { "weeks_of_cover", "Weeks of cover", "wks", "cover_target_wks", "target", "WEEKS_OF_COVER", false, true, 34, "Weeks of Cover", "Stock at cost including on-order ÷ forecast weekly cost of goods, at the last week of the period; the target is the forecast-weighted category targets. Lead card 3; off target either way.", "stock cover, forward cover, inventory cover" },
    { "cover_target_wks", "Cover Target Wks", "wks", null, null, null, false, false, 35, "Cover Target Wks", null, null },
    { "ranged_sku_days", "Ranged SKU Days", "int", null, null, null, false, false, 36, "Ranged SKU Days", null, null },
    { "in_stock_sku_days", "In Stock SKU Days", "int", null, null, null, false, false, 37, "In Stock SKU Days", null, null },
    { "availability_pct", "Availability", "pct", "availability_target", "target", "AVAILABILITY", false, true, 38, "Availability %", "In-stock SKU-days ÷ ranged SKU-days of the top-500 SKUs in the stores, at the last week of the period. Stores only.", "in-stock rate, on-shelf availability, top-500 SKUs" },
    { "availability_target", "Availability Target", "pct", null, null, null, false, false, 39, "Availability Target", null, null },
    { "season_opening_units", "Season Opening Units", "units", null, null, null, false, false, 40, "Season Opening Units", null, null },
    { "season_receipt_units", "Season Receipt Units", "units", null, null, null, false, false, 41, "Season Receipt Units", null, null },
    { "season_units_sold", "Season units sold", "units", null, null, null, false, true, 42, "Season Units Sold", "Units of seasonal categories sold in the season to date.", "seasonal units sold" },
    { "sell_through_pct", "Sell-through", "pct", "sell_through_target", "target", "SELL_THROUGH", false, true, 43, "Sell-through %", "Units sold in the season to date ÷ (opening stock + receipts), seasonal categories only; n/a outside a season.", "season sell-through, seasonal sell-through" },
    { "sell_through_target", "Sell-through Target", "pct", null, null, null, false, false, 44, "Sell-through Target", null, null },
    { "gmroi_front_margin_r52w", "R52W front margin", "eur", null, null, null, false, true, 45, "GMROI Front Margin R52W", "Front margin over the rolling 52 weeks, the numerator of GMROI.", "rolling 52-week front margin" },
    { "gmroi_avg_on_hand_cost", "Average stock at cost", "eur", null, null, null, false, true, 46, "GMROI Avg On Hand Cost", "Average stock at cost over the rolling 52 weeks, the denominator of GMROI.", "average inventory" },
    { "gmroi", "GMROI", "x", "gmroi_target", "target", "GMROI", false, true, 47, "GMROI", "Front margin over the rolling 52 weeks ÷ average stock at cost over those weeks.", "gross margin return on inventory" },
    { "gmroi_target", "GMROI Target", "x", null, null, null, false, false, 48, "GMROI Target", null, null },
    { "mix_store_net_sales", "Store net sales", "eur", null, null, null, false, true, 49, "Mix Store Net Sales", "Net sales through the stores (NL + BE), in EUR.", "stores channel sales" },
    { "mix_online_net_sales", "Online net sales", "eur", null, null, null, false, true, 50, "Mix Online Net Sales", "Net sales online, in EUR.", "e-commerce sales" },
    { "mix_wholesale_net_sales", "Wholesale net sales", "eur", null, null, null, false, true, 51, "Mix Wholesale Net Sales", "Net sales to wholesale, in EUR (All regions only).", "wholesale sales" },
    { "mix_store_pct", "Channel mix: store share", "pct", "mix_store_pct_bud", "plan", "CHANNEL_MIX", false, true, 52, "Mix Store %", "Stores' share of net sales (the Channel mix card's value).", "store share of net sales, channel mix" },
    { "mix_online_pct", "Channel mix: online share", "pct", "mix_online_pct_bud", "plan", "CHANNEL_MIX", false, true, 53, "Mix Online %", "Online's share of net sales.", "online share, e-commerce share" },
    { "mix_wholesale_pct", "Channel mix: wholesale share", "pct", "mix_wholesale_pct_bud", "plan", "CHANNEL_MIX", false, true, 54, "Mix Wholesale %", "Wholesale's share of net sales (in All regions only).", "wholesale share" },
    { "net_sales_bud", "Net Sales Budget", "eur", null, null, null, false, false, 55, "Net Sales Budget", null, null },
    { "gross_sales_bud", "Gross Sales Budget", "eur", null, null, null, false, false, 56, "Gross Sales Budget", null, null },
    { "markdown_bud", "Markdown Budget", "eur", null, null, null, false, false, 57, "Markdown Budget", null, null },
    { "cogs_bud", "COGS Budget", "eur", null, null, null, false, false, 58, "COGS Budget", null, null },
    { "back_margin_bud", "Back Margin Budget", "eur", null, null, null, false, false, 59, "Back Margin Budget", null, null },
    { "markdown_pct_bud", "Markdown % Budget", "pct", null, null, null, false, false, 60, "Markdown % Budget", null, null },
    { "front_gm_pct_bud", "Front GM % Budget", "pct", null, null, null, false, false, 61, "Front GM % Budget", null, null },
    { "total_margin_pct_bud", "Total Margin % Budget", "pct", null, null, null, false, false, 62, "Total Margin % Budget", null, null },
    { "opex_shrink_bud", "Opex Shrink Budget", "eur", null, null, null, true, false, 63, "Opex Shrink Budget", null, null },
    { "opex_store_bud", "Opex Store Budget", "eur", null, null, null, true, false, 64, "Opex Store Budget", null, null },
    { "opex_central_bud", "Opex Central Budget", "eur", null, null, null, true, false, 65, "Opex Central Budget", null, null },
    { "opex_fulfilment_bud", "Opex Fulfilment Budget", "eur", null, null, null, true, false, 66, "Opex Fulfilment Budget", null, null },
    { "ebitda_bud", "EBITDA Budget", "eur", null, null, null, true, false, 67, "EBITDA Budget", null, null },
    { "ebitda_margin_pct_bud", "EBITDA Margin % Budget", "pct", null, null, null, true, false, 68, "EBITDA Margin % Budget", null, null },
    { "lfl_net_sales_bud", "LFL Net Sales Budget", "eur", null, null, null, false, false, 69, "LFL Net Sales Budget", null, null },
    { "lfl_growth_pct_bud", "LFL Growth % Budget", "spct", null, null, null, false, false, 70, "LFL Growth % Budget", null, null },
    { "mix_store_pct_bud", "Mix Store % Budget", "pct", null, null, null, false, false, 71, "Mix Store % Budget", null, null },
    { "mix_online_pct_bud", "Mix Online % Budget", "pct", null, null, null, false, false, 72, "Mix Online % Budget", null, null },
    { "mix_wholesale_pct_bud", "Mix Wholesale % Budget", "pct", null, null, null, false, false, 73, "Mix Wholesale % Budget", null, null },
    { "mix_max_dev_pp", "Mix Max Dev pp", "pp", null, null, null, false, false, 74, "Mix Max Dev pp", null, null },
    { "mix_max_dev_channel", "Mix Max Dev Channel", "int", null, null, null, false, false, 75, "Mix Max Dev Channel", null, null },
    { "ebitda_ptd", "EBITDA", "eur", null, null, null, true, false, 76, "EBITDA", null, null },
    { "ebitda_bud_ptd", "EBITDA Budget", "eur", null, null, null, true, false, 77, "EBITDA Budget", null, null },
    { "flash.net_sales", "Net Sales", "eur", null, null, null, true, false, 78, "Net Sales", null, null },
    { "flash.net_sales_bud", "Net Sales Budget", "eur", null, null, null, true, false, 79, "Net Sales Budget", null, null },
    { "flash.total_margin", "Total Margin", "eur", null, null, null, true, false, 80, "Total Margin", null, null },
    { "trading_stores", "Trading Stores", "int", null, null, null, false, false, 81, "Trading Stores", null, null },
    { "suppliers_below_85", "Suppliers Below 85", "int", null, null, null, false, false, 82, "Suppliers Below 85", null, null }
    }
)
```

### Golden and Golden Category (validation)

```m
// Golden (97 rows)
let
    Source   = Csv.Document ( File.Contents ( ChecksFolder & "chat-golden.csv" ), [Delimiter = ",", Columns = 3, Encoding = 65001, QuoteStyle = QuoteStyle.Csv] ),
    Promoted = Table.PromoteHeaders ( Source, [PromoteAllScalars = true] ),
    Indexed  = Table.AddIndexColumn ( Promoted, "golden_id", 1, 1, Int64.Type ),
    Split    = Table.SplitColumn (
        Indexed, "key",
        Splitter.SplitTextByDelimiter ( "|", QuoteStyle.None ),
        {"metric_code", "item_key", "region_code", "categories", "column"}
    ),
    Default  = Table.TransformColumns ( Split, {{"item_key", each if _ = null or _ = "" then #"Report Info"{0}[current_week_key] else _, type text}} ),
    Expected = Table.TransformColumns ( Default, {{"expected", each if _ = null or _ = "" then null else Number.FromText ( _, "en-US" ), type nullable number}} ),
    Units    = Table.NestedJoin ( Expected, {"metric_code"}, Metric, {"metric_code"}, "m", JoinKind.LeftOuter ),
    Unit     = Table.ExpandTableColumn ( Units, "m", {"unit"} ),
    Tol      = Table.AddColumn (
        Unit, "tolerance",
        each
            if [unit] = "int" then 0
            else if List.Contains ( {"pct", "spct", "pp", "wks", "x"}, [unit] ) then 0.000001
            else if [unit] = "units" then 0.06
            else 0.0051,
        type number
    ),
    Sorted   = Table.Sort ( Tol, {{"golden_id", Order.Ascending}} )
in
    Sorted
```

```m
// Golden Category (bridge, disconnected)
let
    Src      = Table.SelectRows ( Table.SelectColumns ( Golden, {"golden_id", "categories"} ), each [categories] <> null and [categories] <> "" ),
    Lists    = Table.AddColumn ( Src, "category_code", each Text.Split ( [categories], "+" ) ),
    Expanded = Table.ExpandListColumn ( Lists, "category_code" ),
    Out      = Table.TransformColumnTypes ( Table.SelectColumns ( Expanded, {"golden_id", "category_code"} ), {{"category_code", type text}} )
in
    Out
```

### Control and Control Scope Category (extended validation, optional)

```m
// Control (≈ 36,6k rows; non-status metric codes on any window, status codes on whole items only)
let
    Read     = ( f as text ) => Table.PromoteHeaders ( Csv.Document ( File.Contents ( ChecksFolder & f ), [Delimiter = ",", Encoding = 65001] ) ),
    Both     = Table.Combine ( { Read ( "control_totals_eur.csv" ), Read ( "control_totals_category_eur.csv" ) } ),
    Keep     = Table.SelectRows (
        Both,
        each not Text.StartsWith ( [period_key], "PTD" ) and not Text.StartsWith ( [period_key], "YTD" )
            and not Text.StartsWith ( [metric_code], "gmroi." ) and not Text.StartsWith ( [metric_code], "sell_through_pct." )
    ),
    Parsed   = Table.AddColumn (
        Keep, "p",
        each
            let
                Parts   = Text.Split ( [period_key], "@" ),
                K       = if List.Count ( Parts ) = 2 then Number.FromText ( Parts{1} ) else null,
                Seg     = Text.Split ( Parts{0}, "-" ),           // { "W", "FY2026", "43" } or { "FY", "FY2026" }
                G       = Seg{0},
                Fy      = Seg{1},
                N       = if List.Count ( Seg ) = 3 then Number.FromText ( Seg{2} ) else null,
                ItemKey =
                    if G = "W" then Fy & "-W" & Text.PadStart ( Text.From ( N ), 2, "0" )
                    else if G = "P" then Fy & "-P" & Text.PadStart ( Text.From ( N ), 2, "0" )
                    else if G = "Q" then Fy & "-Q" & Text.From ( N )
                    else Fy,
                Item    = Table.SelectRows ( Period, ( x ) => x[item_key] = ItemKey ){0},
                ToIx    = if K = null then Item[to_ix] else Item[from_ix] + K - 1,
                Scope   = Text.Split ( [scope], "#" )
            in
                [
                    item_key    = ItemKey,
                    whole_item  = K = null,
                    from_ix     = Item[from_ix],
                    to_ix       = ToIx,
                    ptd_from_ix = Table.SelectRows ( Week, ( w ) => w[week_ix] = ToIx ){0}[month_start_ix],
                    region_code = Text.Lower ( Scope{0} ),
                    scope_key   = [scope]
                ]
    ),
    Expanded = Table.ExpandRecordColumn ( Parsed, "p", {"item_key", "whole_item", "from_ix", "to_ix", "ptd_from_ix", "region_code", "scope_key"} ),
    NoPartialStatus = Table.SelectRows ( Expanded, each [whole_item] or not Text.StartsWith ( [metric_code], "status." ) ),
    Renamed  = Table.RenameColumns ( NoPartialStatus, {{"value", "expected"}} ),
    Typed    = Table.TransformColumnTypes (
        Renamed,
        {{"expected", type number}, {"whole_item", type logical}, {"from_ix", Int64.Type}, {"to_ix", Int64.Type}, {"ptd_from_ix", Int64.Type}},
        "en-US"
    ),
    Indexed  = Table.AddIndexColumn ( Typed, "control_id", 1, 1, Int64.Type ),
    MapOtif  = Table.ReplaceValue ( Indexed, "otif_suppliers_below_85", "suppliers_below_85", Replacer.ReplaceValue, {"metric_code"} ),
    Tol      = Table.AddColumn (
        MapOtif, "tolerance",
        each
            if Text.StartsWith ( [metric_code], "status." ) or List.Contains ( {"lfl_store_count", "po_lines_due", "po_lines_otif", "mix_max_dev_channel", "suppliers_below_85"}, [metric_code] ) then 0
            else if Text.Contains ( [metric_code], "pct" ) or Text.EndsWith ( [metric_code], "_pp" ) or Text.EndsWith ( [metric_code], "_target" )
                or Text.EndsWith ( [metric_code], "_target_wks" ) or List.Contains ( {"gmroi", "weeks_of_cover"}, [metric_code] ) then 0.000001
            else if Text.EndsWith ( [metric_code], "_units" ) or Text.EndsWith ( [metric_code], "_sku_days" ) then 0.06
            else 0.0051,
        type number
    )
in
    Tol
```

The `otif_suppliers_below_85` control rows exist only for Week windows at All categories.

```m
// Control Scope Category (bridge, disconnected): "ALL#ELEC+TOYS" → ELEC, TOYS
let
    Scopes   = Table.Distinct ( Table.SelectColumns ( Control, {"scope_key"} ) ),
    WithCats = Table.SelectRows ( Scopes, each Text.Contains ( [scope_key], "#" ) ),
    Lists    = Table.AddColumn ( WithCats, "category_code", each Text.Split ( Text.Split ( [scope_key], "#" ){1}, "+" ) ),
    Expanded = Table.ExpandListColumn ( Lists, "category_code" )
in
    Table.TransformColumnTypes ( Expanded, {{"scope_key", type text}, {"category_code", type text}} )
```

Tolerances are the generator's (`verify.py tol()`, mirrored in
`C:\__VOSK__\src\lib\nordmark\test-utils\exec-data.ts` › `tolerance`): status codes and counts exact; ratios,
`weeks_of_cover`, `gmroi` 1e-6; units and SKU-days 0.06; EUR amounts 0.0051.

---

## Appendix A · expected `Week` table (104 rows)

| week_ix | week_key | period_key | Q | week of P | P weeks | week_start | week_end | is_actual | season (week) | ly_week_ix | lw_week_ix |
|---:|---|---|---:|---:|---:|---|---|:-:|---|---:|---:|
| 0 | FY2025-W01 | FY2025-P01 | 1 | 1 | 4 | 2024-12-30 | 2025-01-05 | Y |  |  |  |
| 1 | FY2025-W02 | FY2025-P01 | 1 | 2 | 4 | 2025-01-06 | 2025-01-12 | Y |  |  | 0 |
| 2 | FY2025-W03 | FY2025-P01 | 1 | 3 | 4 | 2025-01-13 | 2025-01-19 | Y |  |  | 1 |
| 3 | FY2025-W04 | FY2025-P01 | 1 | 4 | 4 | 2025-01-20 | 2025-01-26 | Y |  |  | 2 |
| 4 | FY2025-W05 | FY2025-P02 | 1 | 1 | 5 | 2025-01-27 | 2025-02-02 | Y |  |  | 3 |
| 5 | FY2025-W06 | FY2025-P02 | 1 | 2 | 5 | 2025-02-03 | 2025-02-09 | Y |  |  | 4 |
| 6 | FY2025-W07 | FY2025-P02 | 1 | 3 | 5 | 2025-02-10 | 2025-02-16 | Y |  |  | 5 |
| 7 | FY2025-W08 | FY2025-P02 | 1 | 4 | 5 | 2025-02-17 | 2025-02-23 | Y |  |  | 6 |
| 8 | FY2025-W09 | FY2025-P02 | 1 | 5 | 5 | 2025-02-24 | 2025-03-02 | Y |  |  | 7 |
| 9 | FY2025-W10 | FY2025-P03 | 1 | 1 | 4 | 2025-03-03 | 2025-03-09 | Y |  |  | 8 |
| 10 | FY2025-W11 | FY2025-P03 | 1 | 2 | 4 | 2025-03-10 | 2025-03-16 | Y |  |  | 9 |
| 11 | FY2025-W12 | FY2025-P03 | 1 | 3 | 4 | 2025-03-17 | 2025-03-23 | Y |  |  | 10 |
| 12 | FY2025-W13 | FY2025-P03 | 1 | 4 | 4 | 2025-03-24 | 2025-03-30 | Y |  |  | 11 |
| 13 | FY2025-W14 | FY2025-P04 | 2 | 1 | 4 | 2025-03-31 | 2025-04-06 | Y |  |  | 12 |
| 14 | FY2025-W15 | FY2025-P04 | 2 | 2 | 4 | 2025-04-07 | 2025-04-13 | Y |  |  | 13 |
| 15 | FY2025-W16 | FY2025-P04 | 2 | 3 | 4 | 2025-04-14 | 2025-04-20 | Y |  |  | 14 |
| 16 | FY2025-W17 | FY2025-P04 | 2 | 4 | 4 | 2025-04-21 | 2025-04-27 | Y |  |  | 15 |
| 17 | FY2025-W18 | FY2025-P05 | 2 | 1 | 5 | 2025-04-28 | 2025-05-04 | Y |  |  | 16 |
| 18 | FY2025-W19 | FY2025-P05 | 2 | 2 | 5 | 2025-05-05 | 2025-05-11 | Y |  |  | 17 |
| 19 | FY2025-W20 | FY2025-P05 | 2 | 3 | 5 | 2025-05-12 | 2025-05-18 | Y |  |  | 18 |
| 20 | FY2025-W21 | FY2025-P05 | 2 | 4 | 5 | 2025-05-19 | 2025-05-25 | Y |  |  | 19 |
| 21 | FY2025-W22 | FY2025-P05 | 2 | 5 | 5 | 2025-05-26 | 2025-06-01 | Y |  |  | 20 |
| 22 | FY2025-W23 | FY2025-P06 | 2 | 1 | 4 | 2025-06-02 | 2025-06-08 | Y |  |  | 21 |
| 23 | FY2025-W24 | FY2025-P06 | 2 | 2 | 4 | 2025-06-09 | 2025-06-15 | Y |  |  | 22 |
| 24 | FY2025-W25 | FY2025-P06 | 2 | 3 | 4 | 2025-06-16 | 2025-06-22 | Y |  |  | 23 |
| 25 | FY2025-W26 | FY2025-P06 | 2 | 4 | 4 | 2025-06-23 | 2025-06-29 | Y |  |  | 24 |
| 26 | FY2025-W27 | FY2025-P07 | 3 | 1 | 4 | 2025-06-30 | 2025-07-06 | Y |  |  | 25 |
| 27 | FY2025-W28 | FY2025-P07 | 3 | 2 | 4 | 2025-07-07 | 2025-07-13 | Y |  |  | 26 |
| 28 | FY2025-W29 | FY2025-P07 | 3 | 3 | 4 | 2025-07-14 | 2025-07-20 | Y |  |  | 27 |
| 29 | FY2025-W30 | FY2025-P07 | 3 | 4 | 4 | 2025-07-21 | 2025-07-27 | Y |  |  | 28 |
| 30 | FY2025-W31 | FY2025-P08 | 3 | 1 | 5 | 2025-07-28 | 2025-08-03 | Y |  |  | 29 |
| 31 | FY2025-W32 | FY2025-P08 | 3 | 2 | 5 | 2025-08-04 | 2025-08-10 | Y | AW25 (1) |  | 30 |
| 32 | FY2025-W33 | FY2025-P08 | 3 | 3 | 5 | 2025-08-11 | 2025-08-17 | Y | AW25 (2) |  | 31 |
| 33 | FY2025-W34 | FY2025-P08 | 3 | 4 | 5 | 2025-08-18 | 2025-08-24 | Y | AW25 (3) |  | 32 |
| 34 | FY2025-W35 | FY2025-P08 | 3 | 5 | 5 | 2025-08-25 | 2025-08-31 | Y | AW25 (4) |  | 33 |
| 35 | FY2025-W36 | FY2025-P09 | 3 | 1 | 4 | 2025-09-01 | 2025-09-07 | Y | AW25 (5) |  | 34 |
| 36 | FY2025-W37 | FY2025-P09 | 3 | 2 | 4 | 2025-09-08 | 2025-09-14 | Y | AW25 (6) |  | 35 |
| 37 | FY2025-W38 | FY2025-P09 | 3 | 3 | 4 | 2025-09-15 | 2025-09-21 | Y | AW25 (7) |  | 36 |
| 38 | FY2025-W39 | FY2025-P09 | 3 | 4 | 4 | 2025-09-22 | 2025-09-28 | Y | AW25 (8) |  | 37 |
| 39 | FY2025-W40 | FY2025-P10 | 4 | 1 | 4 | 2025-09-29 | 2025-10-05 | Y | AW25 (9) |  | 38 |
| 40 | FY2025-W41 | FY2025-P10 | 4 | 2 | 4 | 2025-10-06 | 2025-10-12 | Y | AW25 (10) |  | 39 |
| 41 | FY2025-W42 | FY2025-P10 | 4 | 3 | 4 | 2025-10-13 | 2025-10-19 | Y | AW25 (11) |  | 40 |
| 42 | FY2025-W43 | FY2025-P10 | 4 | 4 | 4 | 2025-10-20 | 2025-10-26 | Y | AW25 (12) |  | 41 |
| 43 | FY2025-W44 | FY2025-P11 | 4 | 1 | 5 | 2025-10-27 | 2025-11-02 | Y | AW25 (13) |  | 42 |
| 44 | FY2025-W45 | FY2025-P11 | 4 | 2 | 5 | 2025-11-03 | 2025-11-09 | Y | AW25 (14) |  | 43 |
| 45 | FY2025-W46 | FY2025-P11 | 4 | 3 | 5 | 2025-11-10 | 2025-11-16 | Y | AW25 (15) |  | 44 |
| 46 | FY2025-W47 | FY2025-P11 | 4 | 4 | 5 | 2025-11-17 | 2025-11-23 | Y | AW25 (16) |  | 45 |
| 47 | FY2025-W48 | FY2025-P11 | 4 | 5 | 5 | 2025-11-24 | 2025-11-30 | Y | AW25 (17) |  | 46 |
| 48 | FY2025-W49 | FY2025-P12 | 4 | 1 | 4 | 2025-12-01 | 2025-12-07 | Y | AW25 (18) |  | 47 |
| 49 | FY2025-W50 | FY2025-P12 | 4 | 2 | 4 | 2025-12-08 | 2025-12-14 | Y | AW25 (19) |  | 48 |
| 50 | FY2025-W51 | FY2025-P12 | 4 | 3 | 4 | 2025-12-15 | 2025-12-21 | Y | AW25 (20) |  | 49 |
| 51 | FY2025-W52 | FY2025-P12 | 4 | 4 | 4 | 2025-12-22 | 2025-12-28 | Y |  |  | 50 |
| 52 | FY2026-W01 | FY2026-P01 | 1 | 1 | 4 | 2025-12-29 | 2026-01-04 | Y |  | 0 | 51 |
| 53 | FY2026-W02 | FY2026-P01 | 1 | 2 | 4 | 2026-01-05 | 2026-01-11 | Y |  | 1 | 52 |
| 54 | FY2026-W03 | FY2026-P01 | 1 | 3 | 4 | 2026-01-12 | 2026-01-18 | Y |  | 2 | 53 |
| 55 | FY2026-W04 | FY2026-P01 | 1 | 4 | 4 | 2026-01-19 | 2026-01-25 | Y |  | 3 | 54 |
| 56 | FY2026-W05 | FY2026-P02 | 1 | 1 | 5 | 2026-01-26 | 2026-02-01 | Y |  | 4 | 55 |
| 57 | FY2026-W06 | FY2026-P02 | 1 | 2 | 5 | 2026-02-02 | 2026-02-08 | Y |  | 5 | 56 |
| 58 | FY2026-W07 | FY2026-P02 | 1 | 3 | 5 | 2026-02-09 | 2026-02-15 | Y |  | 6 | 57 |
| 59 | FY2026-W08 | FY2026-P02 | 1 | 4 | 5 | 2026-02-16 | 2026-02-22 | Y |  | 7 | 58 |
| 60 | FY2026-W09 | FY2026-P02 | 1 | 5 | 5 | 2026-02-23 | 2026-03-01 | Y |  | 8 | 59 |
| 61 | FY2026-W10 | FY2026-P03 | 1 | 1 | 4 | 2026-03-02 | 2026-03-08 | Y |  | 9 | 60 |
| 62 | FY2026-W11 | FY2026-P03 | 1 | 2 | 4 | 2026-03-09 | 2026-03-15 | Y |  | 10 | 61 |
| 63 | FY2026-W12 | FY2026-P03 | 1 | 3 | 4 | 2026-03-16 | 2026-03-22 | Y |  | 11 | 62 |
| 64 | FY2026-W13 | FY2026-P03 | 1 | 4 | 4 | 2026-03-23 | 2026-03-29 | Y |  | 12 | 63 |
| 65 | FY2026-W14 | FY2026-P04 | 2 | 1 | 4 | 2026-03-30 | 2026-04-05 | Y |  | 13 | 64 |
| 66 | FY2026-W15 | FY2026-P04 | 2 | 2 | 4 | 2026-04-06 | 2026-04-12 | Y |  | 14 | 65 |
| 67 | FY2026-W16 | FY2026-P04 | 2 | 3 | 4 | 2026-04-13 | 2026-04-19 | Y |  | 15 | 66 |
| 68 | FY2026-W17 | FY2026-P04 | 2 | 4 | 4 | 2026-04-20 | 2026-04-26 | Y |  | 16 | 67 |
| 69 | FY2026-W18 | FY2026-P05 | 2 | 1 | 5 | 2026-04-27 | 2026-05-03 | Y |  | 17 | 68 |
| 70 | FY2026-W19 | FY2026-P05 | 2 | 2 | 5 | 2026-05-04 | 2026-05-10 | Y |  | 18 | 69 |
| 71 | FY2026-W20 | FY2026-P05 | 2 | 3 | 5 | 2026-05-11 | 2026-05-17 | Y |  | 19 | 70 |
| 72 | FY2026-W21 | FY2026-P05 | 2 | 4 | 5 | 2026-05-18 | 2026-05-24 | Y |  | 20 | 71 |
| 73 | FY2026-W22 | FY2026-P05 | 2 | 5 | 5 | 2026-05-25 | 2026-05-31 | Y |  | 21 | 72 |
| 74 | FY2026-W23 | FY2026-P06 | 2 | 1 | 4 | 2026-06-01 | 2026-06-07 | Y |  | 22 | 73 |
| 75 | FY2026-W24 | FY2026-P06 | 2 | 2 | 4 | 2026-06-08 | 2026-06-14 | Y |  | 23 | 74 |
| 76 | FY2026-W25 | FY2026-P06 | 2 | 3 | 4 | 2026-06-15 | 2026-06-21 | Y |  | 24 | 75 |
| 77 | FY2026-W26 | FY2026-P06 | 2 | 4 | 4 | 2026-06-22 | 2026-06-28 | Y |  | 25 | 76 |
| 78 | FY2026-W27 | FY2026-P07 | 3 | 1 | 4 | 2026-06-29 | 2026-07-05 | Y |  | 26 | 77 |
| 79 | FY2026-W28 | FY2026-P07 | 3 | 2 | 4 | 2026-07-06 | 2026-07-12 | Y |  | 27 | 78 |
| 80 | FY2026-W29 | FY2026-P07 | 3 | 3 | 4 | 2026-07-13 | 2026-07-19 | Y |  | 28 | 79 |
| 81 | FY2026-W30 | FY2026-P07 | 3 | 4 | 4 | 2026-07-20 | 2026-07-26 | Y |  | 29 | 80 |
| 82 | FY2026-W31 | FY2026-P08 | 3 | 1 | 5 | 2026-07-27 | 2026-08-02 | Y |  | 30 | 81 |
| 83 | FY2026-W32 | FY2026-P08 | 3 | 2 | 5 | 2026-08-03 | 2026-08-09 | Y | AW26 (1) | 31 | 82 |
| 84 | FY2026-W33 | FY2026-P08 | 3 | 3 | 5 | 2026-08-10 | 2026-08-16 | Y | AW26 (2) | 32 | 83 |
| 85 | FY2026-W34 | FY2026-P08 | 3 | 4 | 5 | 2026-08-17 | 2026-08-23 | Y | AW26 (3) | 33 | 84 |
| 86 | FY2026-W35 | FY2026-P08 | 3 | 5 | 5 | 2026-08-24 | 2026-08-30 | Y | AW26 (4) | 34 | 85 |
| 87 | FY2026-W36 | FY2026-P09 | 3 | 1 | 4 | 2026-08-31 | 2026-09-06 | Y | AW26 (5) | 35 | 86 |
| 88 | FY2026-W37 | FY2026-P09 | 3 | 2 | 4 | 2026-09-07 | 2026-09-13 | Y | AW26 (6) | 36 | 87 |
| 89 | FY2026-W38 | FY2026-P09 | 3 | 3 | 4 | 2026-09-14 | 2026-09-20 | Y | AW26 (7) | 37 | 88 |
| 90 | FY2026-W39 | FY2026-P09 | 3 | 4 | 4 | 2026-09-21 | 2026-09-27 | Y | AW26 (8) | 38 | 89 |
| 91 | FY2026-W40 | FY2026-P10 | 4 | 1 | 4 | 2026-09-28 | 2026-10-04 | Y | AW26 (9) | 39 | 90 |
| 92 | FY2026-W41 | FY2026-P10 | 4 | 2 | 4 | 2026-10-05 | 2026-10-11 | Y | AW26 (10) | 40 | 91 |
| 93 | FY2026-W42 | FY2026-P10 | 4 | 3 | 4 | 2026-10-12 | 2026-10-18 | Y | AW26 (11) | 41 | 92 |
| 94 | FY2026-W43 | FY2026-P10 | 4 | 4 | 4 | 2026-10-19 | 2026-10-25 | Y | AW26 (12) | 42 | 93 |
| 95 | FY2026-W44 | FY2026-P11 | 4 | 1 | 5 | 2026-10-26 | 2026-11-01 |  | AW26 (13) | 43 | 94 |
| 96 | FY2026-W45 | FY2026-P11 | 4 | 2 | 5 | 2026-11-02 | 2026-11-08 |  | AW26 (14) | 44 | 95 |
| 97 | FY2026-W46 | FY2026-P11 | 4 | 3 | 5 | 2026-11-09 | 2026-11-15 |  | AW26 (15) | 45 | 96 |
| 98 | FY2026-W47 | FY2026-P11 | 4 | 4 | 5 | 2026-11-16 | 2026-11-22 |  | AW26 (16) | 46 | 97 |
| 99 | FY2026-W48 | FY2026-P11 | 4 | 5 | 5 | 2026-11-23 | 2026-11-29 |  | AW26 (17) | 47 | 98 |
| 100 | FY2026-W49 | FY2026-P12 | 4 | 1 | 4 | 2026-11-30 | 2026-12-06 |  | AW26 (18) | 48 | 99 |
| 101 | FY2026-W50 | FY2026-P12 | 4 | 2 | 4 | 2026-12-07 | 2026-12-13 |  | AW26 (19) | 49 | 100 |
| 102 | FY2026-W51 | FY2026-P12 | 4 | 3 | 4 | 2026-12-14 | 2026-12-20 |  | AW26 (20) | 50 | 101 |
| 103 | FY2026-W52 | FY2026-P12 | 4 | 4 | 4 | 2026-12-21 | 2026-12-27 |  |  | 51 | 102 |

## Appendix B · expected `Period` table (127 rows)

`from–to`, `ly`, `prev`, `ptd`, `ptd_ly`, `ptd_prev` are `week_ix` ranges (inclusive); blank = null. Week items show
their PTD columns; `ptd_prev ix (name)` shows `ptd_prev_name` in brackets.

| item_id | item_key | gran | item_ord | chip_label | title | from–to ix | size | partial | ly ix | prev ix | ptd ix | ptd_ly ix | ptd_prev ix (name) | dates |
|---:|---|---|---:|---|---|---|---:|:-:|---|---|---|---|---|---|
| 0 | FY2025-W01 | W | 0 | W1 | Week 1 FY2025 | 0–0 | 1 |  |  |  | 0–0 |  |  | 30 Dec 2024–5 Jan 2025 |
| 1 | FY2025-W02 | W | 1 | W2 | Week 2 FY2025 | 1–1 | 1 |  |  | 0–0 | 0–1 |  |  | 6–12 Jan 2025 |
| 2 | FY2025-W03 | W | 2 | W3 | Week 3 FY2025 | 2–2 | 1 |  |  | 1–1 | 0–2 |  |  | 13–19 Jan 2025 |
| 3 | FY2025-W04 | W | 3 | W4 | Week 4 FY2025 | 3–3 | 1 |  |  | 2–2 | 0–3 |  |  | 20–26 Jan 2025 |
| 4 | FY2025-W05 | W | 4 | W5 | Week 5 FY2025 | 4–4 | 1 |  |  | 3–3 | 4–4 |  | 0–0 (P1 week 1) | 27 Jan–2 Feb 2025 |
| 5 | FY2025-W06 | W | 5 | W6 | Week 6 FY2025 | 5–5 | 1 |  |  | 4–4 | 4–5 |  | 0–1 (P1 weeks 1–2) | 3–9 Feb 2025 |
| 6 | FY2025-W07 | W | 6 | W7 | Week 7 FY2025 | 6–6 | 1 |  |  | 5–5 | 4–6 |  | 0–2 (P1 weeks 1–3) | 10–16 Feb 2025 |
| 7 | FY2025-W08 | W | 7 | W8 | Week 8 FY2025 | 7–7 | 1 |  |  | 6–6 | 4–7 |  | 0–3 (P1 weeks 1–4) | 17–23 Feb 2025 |
| 8 | FY2025-W09 | W | 8 | W9 | Week 9 FY2025 | 8–8 | 1 |  |  | 7–7 | 4–8 |  |  | 24 Feb–2 Mar 2025 |
| 9 | FY2025-W10 | W | 9 | W10 | Week 10 FY2025 | 9–9 | 1 |  |  | 8–8 | 9–9 |  | 4–4 (P2 week 1) | 3–9 Mar 2025 |
| 10 | FY2025-W11 | W | 10 | W11 | Week 11 FY2025 | 10–10 | 1 |  |  | 9–9 | 9–10 |  | 4–5 (P2 weeks 1–2) | 10–16 Mar 2025 |
| 11 | FY2025-W12 | W | 11 | W12 | Week 12 FY2025 | 11–11 | 1 |  |  | 10–10 | 9–11 |  | 4–6 (P2 weeks 1–3) | 17–23 Mar 2025 |
| 12 | FY2025-W13 | W | 12 | W13 | Week 13 FY2025 | 12–12 | 1 |  |  | 11–11 | 9–12 |  | 4–7 (P2 weeks 1–4) | 24–30 Mar 2025 |
| 13 | FY2025-W14 | W | 13 | W14 | Week 14 FY2025 | 13–13 | 1 |  |  | 12–12 | 13–13 |  | 9–9 (P3 week 1) | 31 Mar–6 Apr 2025 |
| 14 | FY2025-W15 | W | 14 | W15 | Week 15 FY2025 | 14–14 | 1 |  |  | 13–13 | 13–14 |  | 9–10 (P3 weeks 1–2) | 7–13 Apr 2025 |
| 15 | FY2025-W16 | W | 15 | W16 | Week 16 FY2025 | 15–15 | 1 |  |  | 14–14 | 13–15 |  | 9–11 (P3 weeks 1–3) | 14–20 Apr 2025 |
| 16 | FY2025-W17 | W | 16 | W17 | Week 17 FY2025 | 16–16 | 1 |  |  | 15–15 | 13–16 |  | 9–12 (P3 weeks 1–4) | 21–27 Apr 2025 |
| 17 | FY2025-W18 | W | 17 | W18 | Week 18 FY2025 | 17–17 | 1 |  |  | 16–16 | 17–17 |  | 13–13 (P4 week 1) | 28 Apr–4 May 2025 |
| 18 | FY2025-W19 | W | 18 | W19 | Week 19 FY2025 | 18–18 | 1 |  |  | 17–17 | 17–18 |  | 13–14 (P4 weeks 1–2) | 5–11 May 2025 |
| 19 | FY2025-W20 | W | 19 | W20 | Week 20 FY2025 | 19–19 | 1 |  |  | 18–18 | 17–19 |  | 13–15 (P4 weeks 1–3) | 12–18 May 2025 |
| 20 | FY2025-W21 | W | 20 | W21 | Week 21 FY2025 | 20–20 | 1 |  |  | 19–19 | 17–20 |  | 13–16 (P4 weeks 1–4) | 19–25 May 2025 |
| 21 | FY2025-W22 | W | 21 | W22 | Week 22 FY2025 | 21–21 | 1 |  |  | 20–20 | 17–21 |  |  | 26 May–1 Jun 2025 |
| 22 | FY2025-W23 | W | 22 | W23 | Week 23 FY2025 | 22–22 | 1 |  |  | 21–21 | 22–22 |  | 17–17 (P5 week 1) | 2–8 Jun 2025 |
| 23 | FY2025-W24 | W | 23 | W24 | Week 24 FY2025 | 23–23 | 1 |  |  | 22–22 | 22–23 |  | 17–18 (P5 weeks 1–2) | 9–15 Jun 2025 |
| 24 | FY2025-W25 | W | 24 | W25 | Week 25 FY2025 | 24–24 | 1 |  |  | 23–23 | 22–24 |  | 17–19 (P5 weeks 1–3) | 16–22 Jun 2025 |
| 25 | FY2025-W26 | W | 25 | W26 | Week 26 FY2025 | 25–25 | 1 |  |  | 24–24 | 22–25 |  | 17–20 (P5 weeks 1–4) | 23–29 Jun 2025 |
| 26 | FY2025-W27 | W | 26 | W27 | Week 27 FY2025 | 26–26 | 1 |  |  | 25–25 | 26–26 |  | 22–22 (P6 week 1) | 30 Jun–6 Jul 2025 |
| 27 | FY2025-W28 | W | 27 | W28 | Week 28 FY2025 | 27–27 | 1 |  |  | 26–26 | 26–27 |  | 22–23 (P6 weeks 1–2) | 7–13 Jul 2025 |
| 28 | FY2025-W29 | W | 28 | W29 | Week 29 FY2025 | 28–28 | 1 |  |  | 27–27 | 26–28 |  | 22–24 (P6 weeks 1–3) | 14–20 Jul 2025 |
| 29 | FY2025-W30 | W | 29 | W30 | Week 30 FY2025 | 29–29 | 1 |  |  | 28–28 | 26–29 |  | 22–25 (P6 weeks 1–4) | 21–27 Jul 2025 |
| 30 | FY2025-W31 | W | 30 | W31 | Week 31 FY2025 | 30–30 | 1 |  |  | 29–29 | 30–30 |  | 26–26 (P7 week 1) | 28 Jul–3 Aug 2025 |
| 31 | FY2025-W32 | W | 31 | W32 | Week 32 FY2025 | 31–31 | 1 |  |  | 30–30 | 30–31 |  | 26–27 (P7 weeks 1–2) | 4–10 Aug 2025 |
| 32 | FY2025-W33 | W | 32 | W33 | Week 33 FY2025 | 32–32 | 1 |  |  | 31–31 | 30–32 |  | 26–28 (P7 weeks 1–3) | 11–17 Aug 2025 |
| 33 | FY2025-W34 | W | 33 | W34 | Week 34 FY2025 | 33–33 | 1 |  |  | 32–32 | 30–33 |  | 26–29 (P7 weeks 1–4) | 18–24 Aug 2025 |
| 34 | FY2025-W35 | W | 34 | W35 | Week 35 FY2025 | 34–34 | 1 |  |  | 33–33 | 30–34 |  |  | 25–31 Aug 2025 |
| 35 | FY2025-W36 | W | 35 | W36 | Week 36 FY2025 | 35–35 | 1 |  |  | 34–34 | 35–35 |  | 30–30 (P8 week 1) | 1–7 Sep 2025 |
| 36 | FY2025-W37 | W | 36 | W37 | Week 37 FY2025 | 36–36 | 1 |  |  | 35–35 | 35–36 |  | 30–31 (P8 weeks 1–2) | 8–14 Sep 2025 |
| 37 | FY2025-W38 | W | 37 | W38 | Week 38 FY2025 | 37–37 | 1 |  |  | 36–36 | 35–37 |  | 30–32 (P8 weeks 1–3) | 15–21 Sep 2025 |
| 38 | FY2025-W39 | W | 38 | W39 | Week 39 FY2025 | 38–38 | 1 |  |  | 37–37 | 35–38 |  | 30–33 (P8 weeks 1–4) | 22–28 Sep 2025 |
| 39 | FY2025-W40 | W | 39 | W40 | Week 40 FY2025 | 39–39 | 1 |  |  | 38–38 | 39–39 |  | 35–35 (P9 week 1) | 29 Sep–5 Oct 2025 |
| 40 | FY2025-W41 | W | 40 | W41 | Week 41 FY2025 | 40–40 | 1 |  |  | 39–39 | 39–40 |  | 35–36 (P9 weeks 1–2) | 6–12 Oct 2025 |
| 41 | FY2025-W42 | W | 41 | W42 | Week 42 FY2025 | 41–41 | 1 |  |  | 40–40 | 39–41 |  | 35–37 (P9 weeks 1–3) | 13–19 Oct 2025 |
| 42 | FY2025-W43 | W | 42 | W43 | Week 43 FY2025 | 42–42 | 1 |  |  | 41–41 | 39–42 |  | 35–38 (P9 weeks 1–4) | 20–26 Oct 2025 |
| 43 | FY2025-W44 | W | 43 | W44 | Week 44 FY2025 | 43–43 | 1 |  |  | 42–42 | 43–43 |  | 39–39 (P10 week 1) | 27 Oct–2 Nov 2025 |
| 44 | FY2025-W45 | W | 44 | W45 | Week 45 FY2025 | 44–44 | 1 |  |  | 43–43 | 43–44 |  | 39–40 (P10 weeks 1–2) | 3–9 Nov 2025 |
| 45 | FY2025-W46 | W | 45 | W46 | Week 46 FY2025 | 45–45 | 1 |  |  | 44–44 | 43–45 |  | 39–41 (P10 weeks 1–3) | 10–16 Nov 2025 |
| 46 | FY2025-W47 | W | 46 | W47 | Week 47 FY2025 | 46–46 | 1 |  |  | 45–45 | 43–46 |  | 39–42 (P10 weeks 1–4) | 17–23 Nov 2025 |
| 47 | FY2025-W48 | W | 47 | W48 | Week 48 FY2025 | 47–47 | 1 |  |  | 46–46 | 43–47 |  |  | 24–30 Nov 2025 |
| 48 | FY2025-W49 | W | 48 | W49 | Week 49 FY2025 | 48–48 | 1 |  |  | 47–47 | 48–48 |  | 43–43 (P11 week 1) | 1–7 Dec 2025 |
| 49 | FY2025-W50 | W | 49 | W50 | Week 50 FY2025 | 49–49 | 1 |  |  | 48–48 | 48–49 |  | 43–44 (P11 weeks 1–2) | 8–14 Dec 2025 |
| 50 | FY2025-W51 | W | 50 | W51 | Week 51 FY2025 | 50–50 | 1 |  |  | 49–49 | 48–50 |  | 43–45 (P11 weeks 1–3) | 15–21 Dec 2025 |
| 51 | FY2025-W52 | W | 51 | W52 | Week 52 FY2025 | 51–51 | 1 |  |  | 50–50 | 48–51 |  | 43–46 (P11 weeks 1–4) | 22–28 Dec 2025 |
| 52 | FY2026-W01 | W | 52 | W1 | Week 1 | 52–52 | 1 |  | 0–0 | 51–51 | 52–52 | 0–0 | 48–48 (P12 FY2025 week 1) | 29 Dec 2025–4 Jan 2026 |
| 53 | FY2026-W02 | W | 53 | W2 | Week 2 | 53–53 | 1 |  | 1–1 | 52–52 | 52–53 | 0–1 | 48–49 (P12 FY2025 weeks 1–2) | 5–11 Jan 2026 |
| 54 | FY2026-W03 | W | 54 | W3 | Week 3 | 54–54 | 1 |  | 2–2 | 53–53 | 52–54 | 0–2 | 48–50 (P12 FY2025 weeks 1–3) | 12–18 Jan 2026 |
| 55 | FY2026-W04 | W | 55 | W4 | Week 4 | 55–55 | 1 |  | 3–3 | 54–54 | 52–55 | 0–3 | 48–51 (P12 FY2025 weeks 1–4) | 19–25 Jan 2026 |
| 56 | FY2026-W05 | W | 56 | W5 | Week 5 | 56–56 | 1 |  | 4–4 | 55–55 | 56–56 | 4–4 | 52–52 (P1 week 1) | 26 Jan–1 Feb 2026 |
| 57 | FY2026-W06 | W | 57 | W6 | Week 6 | 57–57 | 1 |  | 5–5 | 56–56 | 56–57 | 4–5 | 52–53 (P1 weeks 1–2) | 2–8 Feb 2026 |
| 58 | FY2026-W07 | W | 58 | W7 | Week 7 | 58–58 | 1 |  | 6–6 | 57–57 | 56–58 | 4–6 | 52–54 (P1 weeks 1–3) | 9–15 Feb 2026 |
| 59 | FY2026-W08 | W | 59 | W8 | Week 8 | 59–59 | 1 |  | 7–7 | 58–58 | 56–59 | 4–7 | 52–55 (P1 weeks 1–4) | 16–22 Feb 2026 |
| 60 | FY2026-W09 | W | 60 | W9 | Week 9 | 60–60 | 1 |  | 8–8 | 59–59 | 56–60 | 4–8 |  | 23 Feb–1 Mar 2026 |
| 61 | FY2026-W10 | W | 61 | W10 | Week 10 | 61–61 | 1 |  | 9–9 | 60–60 | 61–61 | 9–9 | 56–56 (P2 week 1) | 2–8 Mar 2026 |
| 62 | FY2026-W11 | W | 62 | W11 | Week 11 | 62–62 | 1 |  | 10–10 | 61–61 | 61–62 | 9–10 | 56–57 (P2 weeks 1–2) | 9–15 Mar 2026 |
| 63 | FY2026-W12 | W | 63 | W12 | Week 12 | 63–63 | 1 |  | 11–11 | 62–62 | 61–63 | 9–11 | 56–58 (P2 weeks 1–3) | 16–22 Mar 2026 |
| 64 | FY2026-W13 | W | 64 | W13 | Week 13 | 64–64 | 1 |  | 12–12 | 63–63 | 61–64 | 9–12 | 56–59 (P2 weeks 1–4) | 23–29 Mar 2026 |
| 65 | FY2026-W14 | W | 65 | W14 | Week 14 | 65–65 | 1 |  | 13–13 | 64–64 | 65–65 | 13–13 | 61–61 (P3 week 1) | 30 Mar–5 Apr 2026 |
| 66 | FY2026-W15 | W | 66 | W15 | Week 15 | 66–66 | 1 |  | 14–14 | 65–65 | 65–66 | 13–14 | 61–62 (P3 weeks 1–2) | 6–12 Apr 2026 |
| 67 | FY2026-W16 | W | 67 | W16 | Week 16 | 67–67 | 1 |  | 15–15 | 66–66 | 65–67 | 13–15 | 61–63 (P3 weeks 1–3) | 13–19 Apr 2026 |
| 68 | FY2026-W17 | W | 68 | W17 | Week 17 | 68–68 | 1 |  | 16–16 | 67–67 | 65–68 | 13–16 | 61–64 (P3 weeks 1–4) | 20–26 Apr 2026 |
| 69 | FY2026-W18 | W | 69 | W18 | Week 18 | 69–69 | 1 |  | 17–17 | 68–68 | 69–69 | 17–17 | 65–65 (P4 week 1) | 27 Apr–3 May 2026 |
| 70 | FY2026-W19 | W | 70 | W19 | Week 19 | 70–70 | 1 |  | 18–18 | 69–69 | 69–70 | 17–18 | 65–66 (P4 weeks 1–2) | 4–10 May 2026 |
| 71 | FY2026-W20 | W | 71 | W20 | Week 20 | 71–71 | 1 |  | 19–19 | 70–70 | 69–71 | 17–19 | 65–67 (P4 weeks 1–3) | 11–17 May 2026 |
| 72 | FY2026-W21 | W | 72 | W21 | Week 21 | 72–72 | 1 |  | 20–20 | 71–71 | 69–72 | 17–20 | 65–68 (P4 weeks 1–4) | 18–24 May 2026 |
| 73 | FY2026-W22 | W | 73 | W22 | Week 22 | 73–73 | 1 |  | 21–21 | 72–72 | 69–73 | 17–21 |  | 25–31 May 2026 |
| 74 | FY2026-W23 | W | 74 | W23 | Week 23 | 74–74 | 1 |  | 22–22 | 73–73 | 74–74 | 22–22 | 69–69 (P5 week 1) | 1–7 Jun 2026 |
| 75 | FY2026-W24 | W | 75 | W24 | Week 24 | 75–75 | 1 |  | 23–23 | 74–74 | 74–75 | 22–23 | 69–70 (P5 weeks 1–2) | 8–14 Jun 2026 |
| 76 | FY2026-W25 | W | 76 | W25 | Week 25 | 76–76 | 1 |  | 24–24 | 75–75 | 74–76 | 22–24 | 69–71 (P5 weeks 1–3) | 15–21 Jun 2026 |
| 77 | FY2026-W26 | W | 77 | W26 | Week 26 | 77–77 | 1 |  | 25–25 | 76–76 | 74–77 | 22–25 | 69–72 (P5 weeks 1–4) | 22–28 Jun 2026 |
| 78 | FY2026-W27 | W | 78 | W27 | Week 27 | 78–78 | 1 |  | 26–26 | 77–77 | 78–78 | 26–26 | 74–74 (P6 week 1) | 29 Jun–5 Jul 2026 |
| 79 | FY2026-W28 | W | 79 | W28 | Week 28 | 79–79 | 1 |  | 27–27 | 78–78 | 78–79 | 26–27 | 74–75 (P6 weeks 1–2) | 6–12 Jul 2026 |
| 80 | FY2026-W29 | W | 80 | W29 | Week 29 | 80–80 | 1 |  | 28–28 | 79–79 | 78–80 | 26–28 | 74–76 (P6 weeks 1–3) | 13–19 Jul 2026 |
| 81 | FY2026-W30 | W | 81 | W30 | Week 30 | 81–81 | 1 |  | 29–29 | 80–80 | 78–81 | 26–29 | 74–77 (P6 weeks 1–4) | 20–26 Jul 2026 |
| 82 | FY2026-W31 | W | 82 | W31 | Week 31 | 82–82 | 1 |  | 30–30 | 81–81 | 82–82 | 30–30 | 78–78 (P7 week 1) | 27 Jul–2 Aug 2026 |
| 83 | FY2026-W32 | W | 83 | W32 | Week 32 | 83–83 | 1 |  | 31–31 | 82–82 | 82–83 | 30–31 | 78–79 (P7 weeks 1–2) | 3–9 Aug 2026 |
| 84 | FY2026-W33 | W | 84 | W33 | Week 33 | 84–84 | 1 |  | 32–32 | 83–83 | 82–84 | 30–32 | 78–80 (P7 weeks 1–3) | 10–16 Aug 2026 |
| 85 | FY2026-W34 | W | 85 | W34 | Week 34 | 85–85 | 1 |  | 33–33 | 84–84 | 82–85 | 30–33 | 78–81 (P7 weeks 1–4) | 17–23 Aug 2026 |
| 86 | FY2026-W35 | W | 86 | W35 | Week 35 | 86–86 | 1 |  | 34–34 | 85–85 | 82–86 | 30–34 |  | 24–30 Aug 2026 |
| 87 | FY2026-W36 | W | 87 | W36 | Week 36 | 87–87 | 1 |  | 35–35 | 86–86 | 87–87 | 35–35 | 82–82 (P8 week 1) | 31 Aug–6 Sep 2026 |
| 88 | FY2026-W37 | W | 88 | W37 | Week 37 | 88–88 | 1 |  | 36–36 | 87–87 | 87–88 | 35–36 | 82–83 (P8 weeks 1–2) | 7–13 Sep 2026 |
| 89 | FY2026-W38 | W | 89 | W38 | Week 38 | 89–89 | 1 |  | 37–37 | 88–88 | 87–89 | 35–37 | 82–84 (P8 weeks 1–3) | 14–20 Sep 2026 |
| 90 | FY2026-W39 | W | 90 | W39 | Week 39 | 90–90 | 1 |  | 38–38 | 89–89 | 87–90 | 35–38 | 82–85 (P8 weeks 1–4) | 21–27 Sep 2026 |
| 91 | FY2026-W40 | W | 91 | W40 | Week 40 | 91–91 | 1 |  | 39–39 | 90–90 | 91–91 | 39–39 | 87–87 (P9 week 1) | 28 Sep–4 Oct 2026 |
| 92 | FY2026-W41 | W | 92 | W41 | Week 41 | 92–92 | 1 |  | 40–40 | 91–91 | 91–92 | 39–40 | 87–88 (P9 weeks 1–2) | 5–11 Oct 2026 |
| 93 | FY2026-W42 | W | 93 | W42 | Week 42 | 93–93 | 1 |  | 41–41 | 92–92 | 91–93 | 39–41 | 87–89 (P9 weeks 1–3) | 12–18 Oct 2026 |
| 94 | FY2026-W43 | W | 94 | W43 | Week 43 | 94–94 | 1 |  | 42–42 | 93–93 | 91–94 | 39–42 | 87–90 (P9 weeks 1–4) | 19–25 Oct 2026 |
| 95 | FY2025-P01 | P | 0 | P1 | Month 1 FY2025 | 0–3 | 4 |  |  |  |  |  |  | 30 Dec 2024–26 Jan 2025 |
| 96 | FY2025-P02 | P | 1 | P2 | Month 2 FY2025 | 4–8 | 5 |  |  | 0–3 |  |  |  | 27 Jan–2 Mar 2025 |
| 97 | FY2025-P03 | P | 2 | P3 | Month 3 FY2025 | 9–12 | 4 |  |  | 4–8 |  |  |  | 3–30 Mar 2025 |
| 98 | FY2025-P04 | P | 3 | P4 | Month 4 FY2025 | 13–16 | 4 |  |  | 9–12 |  |  |  | 31 Mar–27 Apr 2025 |
| 99 | FY2025-P05 | P | 4 | P5 | Month 5 FY2025 | 17–21 | 5 |  |  | 13–16 |  |  |  | 28 Apr–1 Jun 2025 |
| 100 | FY2025-P06 | P | 5 | P6 | Month 6 FY2025 | 22–25 | 4 |  |  | 17–21 |  |  |  | 2–29 Jun 2025 |
| 101 | FY2025-P07 | P | 6 | P7 | Month 7 FY2025 | 26–29 | 4 |  |  | 22–25 |  |  |  | 30 Jun–27 Jul 2025 |
| 102 | FY2025-P08 | P | 7 | P8 | Month 8 FY2025 | 30–34 | 5 |  |  | 26–29 |  |  |  | 28 Jul–31 Aug 2025 |
| 103 | FY2025-P09 | P | 8 | P9 | Month 9 FY2025 | 35–38 | 4 |  |  | 30–34 |  |  |  | 1–28 Sep 2025 |
| 104 | FY2025-P10 | P | 9 | P10 | Month 10 FY2025 | 39–42 | 4 |  |  | 35–38 |  |  |  | 29 Sep–26 Oct 2025 |
| 105 | FY2025-P11 | P | 10 | P11 | Month 11 FY2025 | 43–47 | 5 |  |  | 39–42 |  |  |  | 27 Oct–30 Nov 2025 |
| 106 | FY2025-P12 | P | 11 | P12 | Month 12 FY2025 | 48–51 | 4 |  |  | 43–47 |  |  |  | 1–28 Dec 2025 |
| 107 | FY2026-P01 | P | 12 | P1 | Month 1 | 52–55 | 4 |  | 0–3 | 48–51 |  |  |  | 29 Dec 2025–25 Jan 2026 |
| 108 | FY2026-P02 | P | 13 | P2 | Month 2 | 56–60 | 5 |  | 4–8 | 52–55 |  |  |  | 26 Jan–1 Mar 2026 |
| 109 | FY2026-P03 | P | 14 | P3 | Month 3 | 61–64 | 4 |  | 9–12 | 56–60 |  |  |  | 2–29 Mar 2026 |
| 110 | FY2026-P04 | P | 15 | P4 | Month 4 | 65–68 | 4 |  | 13–16 | 61–64 |  |  |  | 30 Mar–26 Apr 2026 |
| 111 | FY2026-P05 | P | 16 | P5 | Month 5 | 69–73 | 5 |  | 17–21 | 65–68 |  |  |  | 27 Apr–31 May 2026 |
| 112 | FY2026-P06 | P | 17 | P6 | Month 6 | 74–77 | 4 |  | 22–25 | 69–73 |  |  |  | 1–28 Jun 2026 |
| 113 | FY2026-P07 | P | 18 | P7 | Month 7 | 78–81 | 4 |  | 26–29 | 74–77 |  |  |  | 29 Jun–26 Jul 2026 |
| 114 | FY2026-P08 | P | 19 | P8 | Month 8 | 82–86 | 5 |  | 30–34 | 78–81 |  |  |  | 27 Jul–30 Aug 2026 |
| 115 | FY2026-P09 | P | 20 | P9 | Month 9 | 87–90 | 4 |  | 35–38 | 82–86 |  |  |  | 31 Aug–27 Sep 2026 |
| 116 | FY2026-P10 | P | 21 | P10 | Month 10 | 91–94 | 4 |  | 39–42 | 87–90 |  |  |  | 28 Sep–25 Oct 2026 |
| 117 | FY2025-Q1 | Q | 0 | Q1 | Quarter 1 FY2025 | 0–12 | 13 |  |  |  |  |  |  | 30 Dec 2024–30 Mar 2025 |
| 118 | FY2025-Q2 | Q | 1 | Q2 | Quarter 2 FY2025 | 13–25 | 13 |  |  | 0–12 |  |  |  | 31 Mar–29 Jun 2025 |
| 119 | FY2025-Q3 | Q | 2 | Q3 | Quarter 3 FY2025 | 26–38 | 13 |  |  | 13–25 |  |  |  | 30 Jun–28 Sep 2025 |
| 120 | FY2025-Q4 | Q | 3 | Q4 | Quarter 4 FY2025 | 39–51 | 13 |  |  | 26–38 |  |  |  | 29 Sep–28 Dec 2025 |
| 121 | FY2026-Q1 | Q | 4 | Q1 | Quarter 1 | 52–64 | 13 |  | 0–12 | 39–51 |  |  |  | 29 Dec 2025–29 Mar 2026 |
| 122 | FY2026-Q2 | Q | 5 | Q2 | Quarter 2 | 65–77 | 13 |  | 13–25 | 52–64 |  |  |  | 30 Mar–28 Jun 2026 |
| 123 | FY2026-Q3 | Q | 6 | Q3 | Quarter 3 | 78–90 | 13 |  | 26–38 | 65–77 |  |  |  | 29 Jun–27 Sep 2026 |
| 124 | FY2026-Q4 | Q | 7 | Q4 · to date | Quarter 4 | 91–94 | 13 | Y | 39–42 | 78–81 |  |  |  | 28 Sep–25 Oct 2026 |
| 125 | FY2025 | FY | 0 | FY2025 | FY2025 | 0–51 | 52 |  |  |  |  |  |  | 30 Dec 2024–28 Dec 2025 |
| 126 | FY2026 | FY | 1 | FY2026 · to date | FY2026 | 52–94 | 52 | Y | 0–42 | 0–42 |  |  |  | 29 Dec 2025–25 Oct 2026 |
