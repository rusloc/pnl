# 02 — Data: sources, columns, Power Query

All figures are synthetic. The data was built on 2026-10-28 (`manifest.builtAt` = `2026-10-28T15:57:41.341Z`) and is
frozen. The web report reads the same rows from a Postgres schema (`pnl_demo`), but that copy is reachable only through
the site's server credentials; **build from the four files below**. They are byte-for-byte what the web engine's tests
read (`src/lib/pnl/test-utils/public-data.ts`).

## 1. Source files

| # | Absolute path | Format | Rows | Bytes | Content |
|---|---|---|---:|---:|---|
| F1 | `C:\__VOSK__\data\pnl\parquet\manifest.json` | JSON (UTF-8) | — | 104,008 | Dictionaries for the Parquet integer codes + 26 lookup tables (dimensions, parameter tables, FX rates) |
| F2 | `C:\__VOSK__\data\pnl\parquet\pl-P.parquet` | Parquet, 1 row group | 334,700 | 1,154,995 | Consumer Products P&L facts |
| F3 | `C:\__VOSK__\data\pnl\parquet\pl-S.parquet` | Parquet, 1 row group | 88,012 | 331,039 | Commerce Cloud P&L facts |
| F4 | `C:\__VOSK__\data\pnl\parquet\ops.parquet` | Parquet, 1 row group | 26,784 | 130,499 | Operational facts of both companies (units, GMV, active merchants) |
| C1 | `C:\__VOSK__\data\pnl\checks\control_totals_usd.csv` | CSV | 552 | — | Expected subtotals in USD (validation only; `08-validation.md`) |
| C2 | `C:\__VOSK__\data\pnl\checks\chat-golden.csv` | CSV | 63 | — | Verified answers (validation only; `08-validation.md`) |

Schema SQL of the Postgres copy (reference only): `C:\__VOSK__\data\pnl\sql\001-schema-and-roles.sql`,
`C:\__VOSK__\data\pnl\sql\002-schema.sql`.

## 2. Parquet facts

### 2.1 `pl-P.parquet` / `pl-S.parquet` (D-01, pre-aggregated)

Grain: **month × version × region × channel × line × segment × account × counterparty**, one company per file. No
duplicate grain keys (checked). All columns `REQUIRED`, no nulls. Code columns are **0-based indexes into the
manifest's `dict` arrays** (§3.1).

| Column | Parquet type | Meaning | Values (decoded) | Distinct P / S |
|---|---|---|---|---|
| `month_idx` | INT32 | Month index 0…35 = `dim_month.month_index` (0 = 2024-01, 32 = 2026-09, 35 = 2026-12) | 0…35 | 36 / 36 |
| `version` | INT32 | → `dict.version` | 0 `ACT`, 1 `BUD`, 2 `FC2609` | 3 / 3 |
| `region` | INT32 | → `dict.region` | 0 `NA`, 1 `EU`, 2 `UK`, 3 `AP` | 4 / 4 |
| `channel` | INT32 | → `dict.channel` (channel for P, sales motion for S) | P: GRO, DRG, D2C, MKT, WHS, P_UNASSIGNED; S: SELF, SALES, PART, S_UNASSIGNED | 6 / 4 |
| `line` | INT32 | → `dict.line` (category for P, service line for S) | P: HOME, PERS, KITC, ELEC, TOYS, P_UNASSIGNED; S: SUB, PAY, APP, PS, S_UNASSIGNED | 6 / 5 |
| `segment` | INT32 | → `dict.segment` (price tier for P, customer segment for S) | P: PREM, MAIN, VAL, P_UNASSIGNED; S: SMB, MID, ENT, S_UNASSIGNED | 4 / 4 |
| `account` | INT32 | → `dict.account` (73 codes) | leaf account codes | 45 / 39 |
| `counterparty` | INT32 | → `dict.counterparty`; 0 = none (`""`) | P rows: `""` or `S`; S rows: `""` or `P` | 2 / 2 |
| `cents` | DOUBLE | Amount in **integer cents**, local (functional) currency of the region, **signed** (revenue/income +, costs −, M-01) | e.g. 489986123 = 4,899,861.23 | 283,461 / 84,019 |

Rows per version: P — ACT 153,552 (months 0–32), BUD 167,216 (0–35), FC2609 13,932 (33–35); S — ACT 40,416, BUD 43,936,
FC2609 3,660. Rows with a counterparty: P 1,980 / 2,160 / 180 (ACT / BUD / FC; account `VSC_P4`, counterparty S);
S 264 / 288 / 24 (accounts `GR_S1`, `GR_S2`, counterparty P). All `cents` values are whole numbers.

**Two kinds of rows** (`dim_account.is_direct` / `is_below_cm`):
- **Direct lines** (blocks GR, GTN, COR, VSC; 410,112 rows: P 328,320, S 81,792) are booked at full slice grain
  (real channel / line / segment codes; never `*_UNASSIGNED`).
- **Below-contribution-margin lines** (blocks SM, RD, GA, OOI, DA, ADJ, INV, FIN, TAX; 12,600 rows: P 6,380, S 6,220)
  are booked at entity × version × month × region × account with channel / line / segment = `P_UNASSIGNED` /
  `S_UNASSIGNED` and no counterparty. The report allocates them to slices by net-revenue share (C-31, §5.4).

### 2.2 `ops.parquet` (D-03)

Grain: **entity × month × version × region × channel × line × segment**. 26,784 rows.

| Column | Parquet type | Meaning | Values |
|---|---|---|---|
| `entity` | INT32 | → `dict.entity` | 0 `P`, 1 `S` |
| `month_idx` | INT32 | month index | 0…35 |
| `version` | INT32 | → `dict.version` | ACT, BUD, FC2609 |
| `region` | INT32 | → `dict.region` | 4 regions |
| `channel` | INT32 | → `dict.channel` | P: GRO…WHS (5); S: SELF, SALES, PART (3) |
| `line` | INT32 | → `dict.line` | P: 5 categories; S: SUB, PAY only |
| `segment` | INT32 | → `dict.segment` | P: PREM, MAIN, VAL; S: SMB, MID, ENT |
| `units` | INT32 | Units sold (P only; 0 for S). A **flow**: sums over months | e.g. 471,141 |
| `gmv_cents` | DOUBLE | GMV processed in local-currency cents (S only, on line PAY; 0 for P). A flow, **translated like amounts** | e.g. 9,982,275,557 |
| `merchants` | INT32 | Active merchants at month end (S only). A **stock**: never summed over months; read the window's last month (K-23) | e.g. 38,026 |

Totals per entity × version (raw): P ACT 9,900 rows / 1,542,272,873 units; P BUD 10,800 / 1,734,709,692; P FC2609 900 /
170,455,095. S ACT 2,376 rows, GMV 3,328,927,473,600 cents, merchant-months 3,702,308; S BUD 2,592 / 3,900,439,670,599 /
4,227,512; S FC2609 216 / 586,612,128,968 / 433,542.

## 3. `manifest.json`

Top-level keys: `schemaVersion` (1), `builtAt` (ISO datetime), `files` (rows and bytes of F2–F4), `dict`, `tables`.
Contract: `C:\__VOSK__\src\lib\pnl\data\manifest.ts`.

### 3.1 `dict` (code lists; Parquet codes are 0-based positions)

| Key | Size | Values in order |
|---|---:|---|
| `entity` | 2 | P, S |
| `version` | 3 | ACT, BUD, FC2609 (FC2606 exists in `dim_version` but has no fact rows) |
| `region` | 4 | NA, EU, UK, AP |
| `channel` | 10 | GRO, DRG, D2C, MKT, WHS, P_UNASSIGNED, SELF, SALES, PART, S_UNASSIGNED |
| `line` | 11 | HOME, PERS, KITC, ELEC, TOYS, P_UNASSIGNED, SUB, PAY, APP, PS, S_UNASSIGNED |
| `segment` | 8 | PREM, MAIN, VAL, P_UNASSIGNED, SMB, MID, ENT, S_UNASSIGNED |
| `account` | 73 | GR_P1, GR_P2, GR_S1, GR_S2, GR_S3, GR_S4, ELIM_GR, GTN_P1 … GTN_P5, GTN_S1 … GTN_S3, COR_P1 … COR_P7, COR_S1 … COR_S5, VSC_P1 … VSC_P5, VSC_S1 … VSC_S3, ELIM_VSC, SM_P1 … SM_P4, SM_S1 … SM_S4, RD_P1, RD_P2, RD_S1 … RD_S3, GA_1 … GA_4, OOI_1 … OOI_4, DA_P1 … DA_P3, DA_S1 … DA_S3, ADJ_1 … ADJ_3, INV_1, INV_2, FIN_1 … FIN_3, TAX_1, TAX_2 (exact order in the file; read it, never retype it) |
| `counterparty` | 3 | `""` (none), P, S |

### 3.2 `tables` (26 lookup tables)

| Table | Rows | Columns (type) | Notes |
|---|---:|---|---|
| `dim_account` (D-10) | 73 | account_code, account_name, entity_scope (P/S/BOTH/GROUP), entity_scope_name, block_code, block_name, block_alias_products, block_alias_services, spine_step, sort_order (int), natural_sign (−1/0/+1), ifrs18_category, is_direct, is_below_cm, is_intercompany, has_fact_rows (bool), definition, published_comparable, default_cost_centre_products, default_cost_centre_services (nullable) | 70 accounts have fact rows; ELIM_GR, ELIM_VSC, OOI_4 (scope GROUP) have none. P books 28 own + 17 shared (BOTH) = 45; S 25 + 17 = 42 (3 of them have no rows) |
| `dim_report_line` (D-11) | 29 | line_code, line_name, row_type (input_block / subtotal / ratio / group_total / memo), formula (nullable), block_code (nullable), spine_step, tag (nullable: IFRS 18 / MPM / Mgmt), parent_line_code (nullable), is_key, alias_products, alias_services (nullable), ifrs18_category (nullable), sort_order | the spine; full table in `03-model.md` §5 |
| `bridge_account_nature` (D-12) | 54 | account_code, nature_code, weight | not used by the report (by-nature lens removed, ADR-0007) |
| `dim_nature` (D-13) | 9 | nature_code, nature_name, sort_order, natural_sign | not used |
| `dim_entity` (D-14) | 2 | entity_code, entity_name, short_name, description, consolidation_group | consolidation_group = "ACME Group" |
| `dim_month` (D-15) | 36 | month_key (YYYY-MM), month_start_date, month_index (0…35), fiscal_year, quarter (Q1…Q4), month_number, month_name (Jan…Dec), is_closed | 33 closed (2024-01 … 2026-09) |
| `dim_version` (D-16) | 4 | version_key, version_code (Actual/Budget/Forecast), version_name, forecast_cycle, is_latest_forecast, first_month_key, last_month_key | ACT 2024-01…2026-09; BUD 2024-01…2026-12; FC2606 "Forecast 6+6 (Jun 2026)" 2026-07…12 (no rows); FC2609 "Forecast 9+3 (Sep 2026)" 2026-10…12, **latest** |
| `dim_region` (D-17) | 4 | region_code, region_name, functional_currency, sort_order | NA North America USD 10; EU Continental Europe EUR 20; UK UK & Ireland GBP 30; AP Asia-Pacific AUD 40 |
| `dim_channel` (D-18) | 10 | channel_code, channel_name, entity_code, slot_label, sort_order, is_unassigned | slot_label "Channel" (P) / "Sales motion" (S); unassigned name "Unassigned (allocated by NR share)", sort 990 |
| `dim_line` (D-19) | 11 | line_code, line_name, entity_code, slot_label, sort_order, is_unassigned | slot_label "Category" (P) / "Service line" (S) |
| `dim_segment` (D-20) | 8 | segment_code, segment_name, entity_code, slot_label, sort_order, is_unassigned | slot_label "Price tier" (P) / "Customer segment" (S) |
| `param_reporting_currency` | 3 | currency_code, currency_name, symbol, sort_order, is_default | USD "$" (default), EUR "€", GBP "£" |
| `param_fx_basis` | 2 | fx_basis_code, fx_basis_name, sort_order, is_default | ACT "Actual rates" (default), CC "Constant currency (budget rates of selected year)" |
| `param_units` | 2 | units_code, units_name, divisor, decimals, sort_order, is_default | M Millions 1,000,000 / 1 decimal (default); K Thousands 1,000 / 0 |
| `param_version_choice` | 5 | choice_code, choice_name, allowed_as_base, allowed_as_compare, sort_order, default_for | A, LE, B, PY, NONE |
| `param_time_view` | 5 | time_view_code, time_view_name, sort_order, is_default | MTD, QTD, YTD (default), LTM, FY (RANGE is added by the report, not in the manifest) |
| `param_cost_sign` | 2 | cost_sign_code, cost_sign_name, display_multiplier_for_costs, sort_order, is_default | NEG "As negatives" ×1 (default), POS "As positives" ×−1 |
| `param_variance_format` | 3 | variance_format_code, variance_format_name, sort_order, is_default | BOTH "Amount and %", ABS "Amount", PCT "%" |
| `param_breakdown` | 5 | breakdown_code, breakdown_name, available_for, sort_order | unused (Profitability is by region only) |
| `param_layout`, `param_cost_lens`, `param_detail_level` | 3, 2, 3 | — | retired by ADR-0007; do not load |
| `fact_fx_rate` (D-04) | 288 | currency_code (USD/EUR/GBP/AUD), month_key, rate_type (ACTUAL_AVG / BUDGET), local_per_usd | 36 months × 4 currencies × 2 types. USD = 1. BUDGET is one rate per currency per fiscal year, repeated per month |

Budget rates (local per USD), constant per fiscal year (checked): EUR 0.92 / 0.93 / 0.87 (2024 / 2025 / 2026);
GBP 0.79 / 0.79 / 0.75; AUD 1.50 / 1.55 / 1.53; USD 1.

## 4. Translation rule (C-10 … C-13, D-30)

`src/lib/pnl/engine/fx.ts:41-53`, `src/lib/pnl/engine/aggregate.ts:23-72`.

```
amount_reporting = amount_local × rate(reporting, m, type) ÷ rate(local, m, type)
  type = BUDGET      when the row's version is BUD, or FX basis = constant currency
  type = ACTUAL_AVG  otherwise (ACT and forecast rows)
  m    = the row's own month                           (FX basis = actual rates)
  m    = the same month number in the SELECTED fiscal year (FX basis = constant currency; budget rates are constant
         within a year, so this is "the selected fiscal year's budget rate")
```

Translate **per month and currency before summing**, never an aggregated total. Constant currency applies to every
version, prior year included, at the budget rates of the selected fiscal year (`fy` of the period's last month).

## 5. Power Query (M)

All queries below are complete. Names in `#"…"` are the query names used across this spec. Queries marked
"(no load)" have *Enable load* off.

### 5.1 Parameter and manifest

```m
// Query: DataFolder   (Manage Parameters → Text, required)
"C:\__VOSK__\data\pnl\parquet\" meta [IsParameterQuery = true, Type = "Text", IsParameterQueryRequired = true]
```

```m
// Query: Manifest   (no load)
let
    Source = Json.Document ( File.Contents ( DataFolder & "manifest.json" ), 65001 )
in
    Source
```

```m
// Query: fnManifestTable   (no load) — a manifest lookup table as a typed table
(name as text) as table =>
let
    Result = Table.FromRecords ( Record.Field ( Manifest[tables], name ) )
in
    Result
```

### 5.2 Dimensions

```m
// Query: Dim Month
let
    Source  = fnManifestTable ( "dim_month" ),
    Renamed = Table.RenameColumns ( Source, {
        { "month_key", "MonthKey" }, { "month_start_date", "MonthStart" }, { "month_index", "MonthIdx" },
        { "fiscal_year", "FiscalYear" }, { "quarter", "Quarter" }, { "month_number", "MonthNumber" },
        { "month_name", "MonthName" }, { "is_closed", "IsClosed" } } ),
    Typed   = Table.TransformColumnTypes ( Renamed, {
        { "MonthKey", type text }, { "MonthStart", type date }, { "MonthIdx", Int64.Type }, { "FiscalYear", Int64.Type },
        { "Quarter", type text }, { "MonthNumber", Int64.Type }, { "MonthName", type text }, { "IsClosed", type logical } } ),
    Label   = Table.AddColumn ( Typed, "MonthLabel", each [MonthName] & " " & Text.From ( [FiscalYear] ), type text ),
    QNum    = Table.AddColumn ( Label, "QuarterNumber", each Number.RoundUp ( [MonthNumber] / 3 ), Int64.Type )
in
    QNum
```

```m
// Query: Dim Version
let
    Source  = fnManifestTable ( "dim_version" ),
    Renamed = Table.RenameColumns ( Source, {
        { "version_key", "VersionKey" }, { "version_code", "VersionCode" }, { "version_name", "VersionName" },
        { "forecast_cycle", "ForecastCycle" }, { "is_latest_forecast", "IsLatestForecast" },
        { "first_month_key", "FirstMonthKey" }, { "last_month_key", "LastMonthKey" } } ),
    Months  = Table.Buffer ( Table.SelectColumns ( #"Dim Month", { "MonthKey", "MonthIdx" } ) ),
    First   = Table.AddColumn ( Renamed, "FirstMonthIdx", each Table.SelectRows ( Months, ( m ) => m[MonthKey] = [FirstMonthKey] ){0}[MonthIdx], Int64.Type ),
    Last    = Table.AddColumn ( First, "LastMonthIdx", each Table.SelectRows ( Months, ( m ) => m[MonthKey] = [LastMonthKey] ){0}[MonthIdx], Int64.Type ),
    Typed   = Table.TransformColumnTypes ( Last, {
        { "VersionKey", type text }, { "VersionCode", type text }, { "VersionName", type text },
        { "ForecastCycle", type text }, { "IsLatestForecast", type logical } } )
in
    Typed
```

```m
// Query: Dim Region
let
    Source  = fnManifestTable ( "dim_region" ),
    Renamed = Table.RenameColumns ( Source, {
        { "region_code", "RegionCode" }, { "region_name", "RegionName" },
        { "functional_currency", "FunctionalCurrency" }, { "sort_order", "RegionSort" } } ),
    Typed   = Table.TransformColumnTypes ( Renamed, {
        { "RegionCode", type text }, { "RegionName", type text }, { "FunctionalCurrency", type text }, { "RegionSort", Int64.Type } } )
in
    Typed
```

```m
// Query: Dim Channel   (Dim Line and Dim Segment are the same pattern: replace "channel" by "line" / "segment"
//                       and the output names by LineCode, LineName, LineSort / SegmentCode, SegmentName, SegmentSort)
let
    Source  = fnManifestTable ( "dim_channel" ),
    Renamed = Table.RenameColumns ( Source, {
        { "channel_code", "ChannelCode" }, { "channel_name", "ChannelName" }, { "entity_code", "EntityCode" },
        { "slot_label", "SlotLabel" }, { "sort_order", "ChannelSort" }, { "is_unassigned", "IsUnassigned" } } ),
    Typed   = Table.TransformColumnTypes ( Renamed, {
        { "ChannelCode", type text }, { "ChannelName", type text }, { "EntityCode", type text },
        { "SlotLabel", type text }, { "ChannelSort", Int64.Type }, { "IsUnassigned", type logical } } )
in
    Typed
```

```m
// Query: Dim Entity
let
    Source  = fnManifestTable ( "dim_entity" ),
    Renamed = Table.RenameColumns ( Source, {
        { "entity_code", "EntityCode" }, { "entity_name", "EntityName" }, { "short_name", "ShortName" },
        { "description", "Description" }, { "consolidation_group", "ConsolidationGroup" } } ),
    Typed   = Table.TransformColumnTypes ( Renamed, {
        { "EntityCode", type text }, { "EntityName", type text }, { "ShortName", type text },
        { "Description", type text }, { "ConsolidationGroup", type text } } )
in
    Typed
```

```m
// Query: Dim Account
let
    Source  = fnManifestTable ( "dim_account" ),
    Renamed = Table.RenameColumns ( Source, {
        { "account_code", "AccountCode" }, { "account_name", "AccountName" }, { "entity_scope", "EntityScope" },
        { "entity_scope_name", "EntityScopeName" }, { "block_code", "BlockCode" }, { "block_name", "BlockName" },
        { "block_alias_products", "BlockAliasP" }, { "block_alias_services", "BlockAliasS" }, { "spine_step", "SpineStep" },
        { "sort_order", "AccountSort" }, { "natural_sign", "NaturalSign" }, { "ifrs18_category", "Ifrs18Category" },
        { "is_direct", "IsDirect" }, { "is_below_cm", "IsBelowCM" }, { "is_intercompany", "IsIntercompany" },
        { "has_fact_rows", "HasFactRows" }, { "definition", "Definition" }, { "published_comparable", "PublishedComparable" },
        { "default_cost_centre_products", "CostCentreP" }, { "default_cost_centre_services", "CostCentreS" } } ),
    Typed   = Table.TransformColumnTypes ( Renamed, {
        { "AccountCode", type text }, { "AccountName", type text }, { "EntityScope", type text }, { "BlockCode", type text },
        { "BlockName", type text }, { "SpineStep", type text }, { "AccountSort", Int64.Type }, { "NaturalSign", Int64.Type },
        { "IsDirect", type logical }, { "IsBelowCM", type logical }, { "IsIntercompany", type logical },
        { "HasFactRows", type logical }, { "Definition", type text } } )
in
    Typed
```

```m
// Query: Report Line   (no load; feeds PL Row)
let
    Source  = fnManifestTable ( "dim_report_line" ),
    Renamed = Table.RenameColumns ( Source, {
        { "line_code", "LineCode" }, { "line_name", "LineName" }, { "row_type", "RowType" }, { "formula", "Formula" },
        { "block_code", "BlockCode" }, { "spine_step", "SpineStep" }, { "tag", "Tag" }, { "parent_line_code", "ParentLineCode" },
        { "is_key", "IsKey" }, { "alias_products", "AliasP" }, { "alias_services", "AliasS" },
        { "ifrs18_category", "Ifrs18Category" }, { "sort_order", "LineSortOrder" } } )
in
    Renamed
```

### 5.3 FX

```m
// Query: FX Rate   (no load) — fact_fx_rate with the month index
let
    Source  = fnManifestTable ( "fact_fx_rate" ),
    Months  = Table.Buffer ( Table.SelectColumns ( #"Dim Month", { "MonthKey", "MonthIdx", "FiscalYear", "MonthNumber" } ) ),
    Joined  = Table.NestedJoin ( Source, { "month_key" }, Months, { "MonthKey" }, "M", JoinKind.Inner ),
    Expand  = Table.ExpandTableColumn ( Joined, "M", { "MonthIdx", "FiscalYear", "MonthNumber" } ),
    Typed   = Table.TransformColumnTypes ( Expand, { { "local_per_usd", type number } } )
in
    Typed
```

```m
// Query: FX Factor — one row per month × local currency × rate type (288 rows):
//   ToXXX = rate(XXX, month, type) / rate(local, month, type)  — the C-13 cross rate local → USD → reporting
let
    Pivot   = Table.Pivot ( Table.SelectColumns ( #"FX Rate", { "MonthIdx", "FiscalYear", "rate_type", "currency_code", "local_per_usd" } ),
                            { "USD", "EUR", "GBP", "AUD" }, "currency_code", "local_per_usd" ),
    Locals  = Table.AddColumn ( Pivot, "Locals", each {
                  [ LocalCurrency = "USD", Local = [USD] ], [ LocalCurrency = "EUR", Local = [EUR] ],
                  [ LocalCurrency = "GBP", Local = [GBP] ], [ LocalCurrency = "AUD", Local = [AUD] ] } ),
    Rows    = Table.ExpandListColumn ( Locals, "Locals" ),
    Rec     = Table.ExpandRecordColumn ( Rows, "Locals", { "LocalCurrency", "Local" } ),
    ToUSD   = Table.AddColumn ( Rec, "ToUSD", each [USD] / [Local], type number ),
    ToEUR   = Table.AddColumn ( ToUSD, "ToEUR", each [EUR] / [Local], type number ),
    ToGBP   = Table.AddColumn ( ToEUR, "ToGBP", each [GBP] / [Local], type number ),
    Renamed = Table.RenameColumns ( ToGBP, { { "rate_type", "RateType" } } ),
    Key     = Table.AddColumn ( Renamed, "FxKey", each Text.From ( [MonthIdx] ) & "|" & [LocalCurrency] & "|" & [RateType], type text ),
    Out     = Table.SelectColumns ( Key, { "FxKey", "MonthIdx", "FiscalYear", "LocalCurrency", "RateType", "ToUSD", "ToEUR", "ToGBP" } ),
    Typed   = Table.TransformColumnTypes ( Out, { { "MonthIdx", Int64.Type }, { "FiscalYear", Int64.Type }, { "LocalCurrency", type text }, { "RateType", type text } } )
in
    Typed
```

```m
// Query: FX CC Factor — constant currency: budget rates of a fiscal year (36 rows = 3 FY × 4 local × 3 reporting)
let
    Budget  = Table.SelectRows ( #"FX Rate", each [rate_type] = "BUDGET" and [MonthNumber] = 1 ),
    Rates   = Table.Buffer ( Table.SelectColumns ( Budget, { "FiscalYear", "currency_code", "local_per_usd" } ) ),
    Pairs   = Table.AddColumn ( Rates, "Reporting", each { "USD", "EUR", "GBP" } ),
    Rows    = Table.ExpandListColumn ( Pairs, "Reporting" ),
    Factor  = Table.AddColumn ( Rows, "Factor", ( r ) =>
                  Table.SelectRows ( Rates, each [FiscalYear] = r[FiscalYear] and [currency_code] = r[Reporting] ){0}[local_per_usd]
                  / r[local_per_usd], type number ),
    Renamed = Table.RenameColumns ( Factor, { { "currency_code", "LocalCurrency" }, { "Reporting", "ReportingCurrency" } } ),
    Out     = Table.SelectColumns ( Renamed, { "FiscalYear", "LocalCurrency", "ReportingCurrency", "Factor" } ),
    Typed   = Table.TransformColumnTypes ( Out, { { "FiscalYear", Int64.Type }, { "LocalCurrency", type text }, { "ReportingCurrency", type text } } )
in
    Typed
```

### 5.4 Facts, with the C-31 allocation

Rule (`src/lib/pnl/engine/slices.ts:102-155`; spec C-31): for every entity × version × month × region group, each
below-CM account amount is spread over the group's net-revenue slice tuples (channel × line × segment) in proportion to
their net revenue (accounts of blocks GR and GTN), **in local currency**:
`allocated(tuple) = amount(group, account) × NR(group, tuple) ÷ NR(group)`. Translation happens later, per row, in DAX.
Every group has net revenue (checked: no zero denominators). Unfiltered and by-region totals are unchanged to the cent
(checked: P −782,064,219,781 cents before and after; S −189,369,563,182).

```m
// Query: fnPl   (no load) — one company's P&L Parquet, decoded
(entity as text) as table =>
let
    D            = Manifest[dict],
    Version      = List.Buffer ( D[version] ),
    Region       = List.Buffer ( D[region] ),
    Channel      = List.Buffer ( D[channel] ),
    Line         = List.Buffer ( D[line] ),
    Segment      = List.Buffer ( D[segment] ),
    Account      = List.Buffer ( D[account] ),
    Counterparty = List.Buffer ( D[counterparty] ),
    Source       = Parquet.Document ( File.Contents ( DataFolder & "pl-" & entity & ".parquet" ) ),
    Decoded      = Table.TransformColumns ( Source, {
        { "month_idx",    each _,                Int64.Type },
        { "version",      each Version{_},       type text },
        { "region",       each Region{_},        type text },
        { "channel",      each Channel{_},       type text },
        { "line",         each Line{_},          type text },
        { "segment",      each Segment{_},       type text },
        { "account",      each Account{_},       type text },
        { "counterparty", each Counterparty{_},  type text },
        { "cents",        each _ / 100,          type number } } ),
    Renamed      = Table.RenameColumns ( Decoded, {
        { "month_idx", "MonthIdx" }, { "version", "VersionKey" }, { "region", "RegionCode" }, { "channel", "ChannelCode" },
        { "line", "LineCode" }, { "segment", "SegmentCode" }, { "account", "AccountCode" },
        { "counterparty", "CounterpartyCode" }, { "cents", "AmountLocal" } } ),
    WithEntity   = Table.AddColumn ( Renamed, "EntityCode", each entity, type text )
in
    WithEntity
```

```m
// Query: Fact PL — direct rows as booked + below-CM rows allocated to slices (1,112,532 rows)
let
    Raw          = Table.Combine ( { fnPl ( "P" ), fnPl ( "S" ) } ),
    BelowCm      = List.Buffer ( Table.SelectRows ( #"Dim Account", each [IsBelowCM] )[AccountCode] ),
    NrAccounts   = List.Buffer ( Table.SelectRows ( #"Dim Account", each [BlockCode] = "GR" or [BlockCode] = "GTN" )[AccountCode] ),
    GroupKeys    = { "EntityCode", "VersionKey", "MonthIdx", "RegionCode" },
    SliceKeys    = { "ChannelCode", "LineCode", "SegmentCode" },
    Direct       = Table.SelectRows ( Raw, each not List.Contains ( BelowCm, [AccountCode] ) ),
    Below        = Table.SelectRows ( Raw, each List.Contains ( BelowCm, [AccountCode] ) ),
    // net revenue per group × slice tuple and per group (local currency)
    NrRows       = Table.SelectRows ( Direct, each List.Contains ( NrAccounts, [AccountCode] ) ),
    NrTuple      = Table.Group ( NrRows, GroupKeys & SliceKeys, { { "NrTuple", each List.Sum ( [AmountLocal] ), type number } } ),
    NrGroup      = Table.Group ( NrTuple, GroupKeys, { { "NrTotal", each List.Sum ( [NrTuple] ), type number } } ),
    SharesJoin   = Table.NestedJoin ( NrTuple, GroupKeys, NrGroup, GroupKeys, "G", JoinKind.Inner ),
    SharesExp    = Table.ExpandTableColumn ( SharesJoin, "G", { "NrTotal" } ),
    Shares       = Table.AddColumn ( SharesExp, "Share",
                       each if [NrTotal] = 0 then error "C-31: no net revenue to allocate by" else [NrTuple] / [NrTotal], type number ),
    ShareCols    = Table.Buffer ( Table.SelectColumns ( Shares, GroupKeys & SliceKeys & { "Share" } ) ),
    // below-CM amount per group × account (these rows never carry a counterparty)
    BelowAgg     = Table.Group ( Below, GroupKeys & { "AccountCode", "CounterpartyCode" },
                       { { "AmountLocal", each List.Sum ( [AmountLocal] ), type number } } ),
    AllocJoin    = Table.NestedJoin ( BelowAgg, GroupKeys, ShareCols, GroupKeys, "S", JoinKind.Inner ),
    AllocExp     = Table.ExpandTableColumn ( AllocJoin, "S", SliceKeys & { "Share" } ),
    AllocAmt     = Table.AddColumn ( AllocExp, "AmountAllocated", each [AmountLocal] * [Share], type number ),
    Allocated    = Table.RenameColumns ( Table.RemoveColumns ( AllocAmt, { "AmountLocal", "Share" } ),
                       { { "AmountAllocated", "AmountLocal" } } ),
    DirectFlag   = Table.AddColumn ( Direct, "IsAllocated", each false, type logical ),
    AllocFlag    = Table.AddColumn ( Allocated, "IsAllocated", each true, type logical ),
    Combined     = Table.Combine ( { DirectFlag, AllocFlag } ),
    RegionCcy    = Record.FromList ( #"Dim Region"[FunctionalCurrency], #"Dim Region"[RegionCode] ),
    BudgetKey    = Table.SelectRows ( #"Dim Version", each [VersionCode] = "Budget" ){0}[VersionKey],
    WithCcy      = Table.AddColumn ( Combined, "LocalCurrency", each Record.Field ( RegionCcy, [RegionCode] ), type text ),
    WithRate     = Table.AddColumn ( WithCcy, "RateType", each if [VersionKey] = BudgetKey then "BUDGET" else "ACTUAL_AVG", type text ),
    WithKey      = Table.AddColumn ( WithRate, "FxKey", each Text.From ( [MonthIdx] ) & "|" & [LocalCurrency] & "|" & [RateType], type text ),
    Typed        = Table.TransformColumnTypes ( WithKey, {
        { "EntityCode", type text }, { "MonthIdx", Int64.Type }, { "VersionKey", type text }, { "RegionCode", type text },
        { "ChannelCode", type text }, { "LineCode", type text }, { "SegmentCode", type text }, { "AccountCode", type text },
        { "CounterpartyCode", type text }, { "AmountLocal", type number }, { "IsAllocated", type logical } } )
in
    Typed
```

| `Fact PL` column | Type | Meaning |
|---|---|---|
| EntityCode | text | P / S |
| MonthIdx | int | 0…35 → `Dim Month` |
| VersionKey | text | ACT / BUD / FC2609 → `Dim Version` |
| RegionCode | text | → `Dim Region` |
| ChannelCode, LineCode, SegmentCode | text | → `Dim Channel` / `Dim Line` / `Dim Segment`; after allocation never `*_UNASSIGNED` |
| AccountCode | text | → `Dim Account` |
| CounterpartyCode | text | `""`, `P` or `S` (intercompany; used only by the Group view) |
| AmountLocal | decimal (double) | signed amount in the region's functional currency (cents ÷ 100; allocated rows are fractional) |
| IsAllocated | bool | TRUE = a below-CM amount spread by NR share (C-31; "alloc." tag) |
| LocalCurrency | text | functional currency of the region (USD/EUR/GBP/AUD) |
| RateType | text | BUDGET for the budget version, else ACTUAL_AVG |
| FxKey | text | `MonthIdx|LocalCurrency|RateType` → `FX Factor` |

Expected rows: direct 410,112 (P 328,320, S 81,792) + allocated 702,420 (P 6,380 × 75 tuples = 478,500; S 6,220 × 36
tuples = 223,920) = **1,112,532** (P 806,820, S 305,712).

```m
// Query: Fact Ops (26,784 rows)
let
    D           = Manifest[dict],
    Entity      = List.Buffer ( D[entity] ),
    Version     = List.Buffer ( D[version] ),
    Region      = List.Buffer ( D[region] ),
    Channel     = List.Buffer ( D[channel] ),
    Line        = List.Buffer ( D[line] ),
    Segment     = List.Buffer ( D[segment] ),
    Source      = Parquet.Document ( File.Contents ( DataFolder & "ops.parquet" ) ),
    Decoded     = Table.TransformColumns ( Source, {
        { "entity",    each Entity{_},   type text },
        { "month_idx", each _,           Int64.Type },
        { "version",   each Version{_},  type text },
        { "region",    each Region{_},   type text },
        { "channel",   each Channel{_},  type text },
        { "line",      each Line{_},     type text },
        { "segment",   each Segment{_},  type text },
        { "units",     each _,           Int64.Type },
        { "gmv_cents", each _ / 100,     type number },
        { "merchants", each _,           Int64.Type } } ),
    Renamed     = Table.RenameColumns ( Decoded, {
        { "entity", "EntityCode" }, { "month_idx", "MonthIdx" }, { "version", "VersionKey" }, { "region", "RegionCode" },
        { "channel", "ChannelCode" }, { "line", "LineCode" }, { "segment", "SegmentCode" }, { "units", "Units" },
        { "gmv_cents", "GmvLocal" }, { "merchants", "Merchants" } } ),
    RegionCcy   = Record.FromList ( #"Dim Region"[FunctionalCurrency], #"Dim Region"[RegionCode] ),
    BudgetKey   = Table.SelectRows ( #"Dim Version", each [VersionCode] = "Budget" ){0}[VersionKey],
    WithCcy     = Table.AddColumn ( Renamed, "LocalCurrency", each Record.Field ( RegionCcy, [RegionCode] ), type text ),
    WithRate    = Table.AddColumn ( WithCcy, "RateType", each if [VersionKey] = BudgetKey then "BUDGET" else "ACTUAL_AVG", type text ),
    WithKey     = Table.AddColumn ( WithRate, "FxKey", each Text.From ( [MonthIdx] ) & "|" & [LocalCurrency] & "|" & [RateType], type text )
in
    WithKey
```

### 5.5 Statement rows (`PL Row`) and data info

`PL Row` is the row axis of the statement matrix: the 29 report lines in sort order, each input block followed by its
accounts (only accounts with fact rows; scope P / S / BOTH). 70 account rows + 16 non-block lines = **86 rows**.
Line display text = two-digit position among **all 29** report lines (ratio rows included) + `". "` + the line name in
capitals (`src/lib/pnl/engine/spine.ts:25-31`): "01. GROSS REVENUE", "03. NET REVENUE", "10. OPERATING EXPENSES",
"11. SALES & MARKETING", "28. NET PROFIT FOR THE PERIOD". Cost flag (`spine.ts:44-59`): a block is a cost block when the
natural signs of its accounts sum below zero (GTN, COR, VSC, SM, RD, GA, DA, ADJ, FIN, TAX; not GR, OOI, INV); the group
total OPEX sums its children's signs (cost); subtotals, memo and ratio rows are not cost rows; leaves follow their block.

```m
// Query: PL Row
let
    Lines       = Table.Sort ( #"Report Line", { { "LineSortOrder", Order.Ascending } } ),
    Numbered    = Table.AddIndexColumn ( Lines, "LineSort", 1, 1, Int64.Type ),
    Display     = Table.AddColumn ( Numbered, "LineDisplay",
                      each Text.PadStart ( Text.From ( [LineSort] ), 2, "0" ) & ". " & Text.Upper ( [LineName] ), type text ),
    BlockSign   = Table.Group ( #"Dim Account", { "BlockCode" }, { { "SignSum", each List.Sum ( [NaturalSign] ), Int64.Type } } ),
    SignOf      = ( block as nullable text ) as number =>
                      if block = null then 0 else List.Sum ( Table.SelectRows ( BlockSign, each [BlockCode] = block )[SignSum] ),
    ChildSign   = ( line as text ) as number =>
                      List.Sum ( List.Transform ( Table.SelectRows ( Lines, each [ParentLineCode] = line )[BlockCode], SignOf ) ),
    Kind        = Table.AddColumn ( Display, "LineKind", each
                      if [RowType] = "input_block" then "block" else [RowType], type text ),
    IsCost      = Table.AddColumn ( Kind, "IsCost", each
                      if [RowType] = "input_block" then SignOf ( [BlockCode] ) < 0
                      else if [RowType] = "group_total" then ChildSign ( [LineCode] ) < 0
                      else false, type logical ),
    Level       = Table.AddColumn ( IsCost, "LineLevel", each if [ParentLineCode] = null then 0 else 1, Int64.Type ),
    Accounts    = Table.SelectRows ( #"Dim Account", each [HasFactRows] ),
    AccCols     = Table.SelectColumns ( Accounts, { "BlockCode", "AccountCode", "AccountName", "AccountSort", "EntityScope", "IsIntercompany", "IsBelowCM" } ),
    Joined      = Table.NestedJoin ( Level, { "BlockCode" }, AccCols, { "BlockCode" }, "A", JoinKind.LeftOuter ),
    Expanded    = Table.ExpandTableColumn ( Joined, "A", { "AccountCode", "AccountName", "AccountSort", "EntityScope", "IsIntercompany", "IsBelowCM" } ),
    Clean       = Table.ReplaceValue ( Table.ReplaceValue ( Expanded, null, "", Replacer.ReplaceValue,
                      { "AccountCode", "AccountName", "EntityScope" } ), null, 0, Replacer.ReplaceValue, { "AccountSort" } ),
    AccTag      = Table.AddColumn ( Clean, "AccountTag", each if [IsIntercompany] = true then "IC" else "", type text ),
    RowKey      = Table.AddColumn ( AccTag, "RowKey", each [LineCode] & "|" & [AccountCode], type text ),
    Out         = Table.SelectColumns ( RowKey, {
                      "RowKey", "LineCode", "LineDisplay", "LineName", "LineSort", "LineKind", "LineLevel", "ParentLineCode",
                      "IsKey", "Tag", "IsCost", "AliasP", "AliasS", "AccountCode", "AccountName", "AccountSort",
                      "EntityScope", "AccountTag", "IsBelowCM" } ),
    Typed       = Table.TransformColumnTypes ( Out, {
                      { "LineSort", Int64.Type }, { "LineLevel", Int64.Type }, { "AccountSort", Int64.Type },
                      { "IsKey", type logical }, { "IsCost", type logical } } )
in
    Typed
```

```m
// Query: Data Info (1 row)
let
    Closed  = Table.SelectRows ( #"Dim Month", each [IsClosed] ),
    Last    = Table.Max ( Closed, "MonthIdx" ),
    Out     = #table (
                  type table [ BuiltAtUtc = datetime, LastClosedMonthIdx = Int64.Type, LastClosedLabel = text ],
                  { { DateTimeZone.RemoveZone ( DateTimeZone.FromText ( Manifest[builtAt] ) ), Last[MonthIdx], Last[MonthLabel] } } )
in
    Out
```

### 5.6 Type and load checklist

- Every text code column: `type text`; every index / count: `Int64.Type`; `AmountLocal`, `GmvLocal`, factors:
  `type number` (Decimal Number in the model; **not** Fixed Decimal — allocated amounts are fractional).
- Load: `Fact PL`, `Fact Ops`, `Dim Month`, `Dim Version`, `Dim Region`, `Dim Channel`, `Dim Line`, `Dim Segment`,
  `Dim Entity`, `Dim Account`, `FX Factor`, `FX CC Factor`, `PL Row`, `Data Info`, plus the static tables of
  `03-model.md` §6–§7. Do not load `Manifest`, `fnManifestTable`, `fnPl`, `Report Line`, `FX Rate`.
- Refresh time on a laptop: well under a minute; the allocation join produces ~700k rows.
