# 04 — Measures (DAX)

Every number on the web report comes from the engine in `C:\__VOSK__\src\lib\pnl\engine\`; each measure below cites the
rule it reproduces. Conventions:

- Amounts are **signed** (revenue +, costs −) and, inside the model, in **whole reporting-currency units** (not
  millions). Display measures divide by the units divisor and round; nothing else rounds (`engine/format.ts:1-3`).
- "n/a" (no data for a column, M-13) = BLANK in calculation measures. Display measures return `0` and a dynamic format
  string `"n/a"` so the cell reads `n/a` while staying numeric and right-aligned.
- Negative numbers show the true minus `−` (U+2212); deltas carry `+`. A value that rounds to zero shows without sign.
- `[Measure]` references are never table-qualified; columns always are.
- Format strings: give each measure the one in its header line; "dynamic" = Format → Dynamic, expression shown.

Measure count (inventory in §12): folders 0–3 (selection, window, plan, base amounts) 58 · folder 4 lines and ratios
29 · folder 5 catalogue 33 (folders 4 + 5 = the **62** catalogue metrics of `src/lib/pnl/chat-metrics.ts`) · folder 6
statement 38 · folder 7 Vitals 25 · folder 8 Analysis 70 · folder 9 Profitability 33 · folder 10 header 18.
**Total 304 measures.** Where a measure is said to follow "the same pattern" as one written out in full, it still
counts and must be created.

---

## 0. Selection (folder `0 Selection`)

Defaults = the web defaults (`state/selection-schema.ts:111-138`).

```dax
Sel Company =
SELECTEDVALUE ( 'P Company'[CompanyCode], "P" )
```

```dax
Last Closed Idx =
CALCULATE (
    MAX ( 'Dim Month'[MonthIdx] )
    ,REMOVEFILTERS ( 'Dim Month' )
    ,'Dim Month'[IsClosed] = TRUE ()
)
```
Format `0`. Returns 32 (Sep 2026). N-03: from the closed flag, never from data.

```dax
Sel FY =
VAR _last_idx     = [Last Closed Idx]
VAR _last_fy      =
    CALCULATE (
        MAX ( 'Dim Month'[FiscalYear] )
        ,REMOVEFILTERS ( 'Dim Month' )
        ,'Dim Month'[MonthIdx] = _last_idx
    )
RETURN
    SELECTEDVALUE ( 'P Fiscal Year'[FiscalYear], _last_fy )
```

```dax
Sel Month =
VAR _last_idx     = [Last Closed Idx]
VAR _last_month   =
    CALCULATE (
        MAX ( 'Dim Month'[MonthNumber] )
        ,REMOVEFILTERS ( 'Dim Month' )
        ,'Dim Month'[MonthIdx] = _last_idx
    )
RETURN
    SELECTEDVALUE ( 'P Month'[MonthNumber], _last_month )
```

```dax
Sel Time View =
SELECTEDVALUE ( 'P Time View'[TimeViewCode], "YTD" )
```

```dax
Sel Base =
SELECTEDVALUE ( 'P Base'[BaseCode], "A" )
```

```dax
Sel Compare A =
SELECTEDVALUE ( 'P Compare A'[CompareACode], "B" )
```

```dax
Sel Compare B =
SELECTEDVALUE ( 'P Compare B'[CompareBCode], "PY" )
```

```dax
Sel Currency =
SELECTEDVALUE ( 'P Currency'[CurrencyCode], "USD" )
```

```dax
Sel Currency Symbol =
SELECTEDVALUE ( 'P Currency'[CurrencySymbol], "$" )
```

```dax
Sel FX Basis =
SELECTEDVALUE ( 'P FX Basis'[FxBasisCode], "ACT" )
```

```dax
Sel Units Divisor =
SELECTEDVALUE ( 'P Units'[Divisor], 1000000 )
```

```dax
Sel Units Decimals =
SELECTEDVALUE ( 'P Units'[Decimals], 1 )
```

```dax
Sel Units Label =
SELECTEDVALUE ( 'P Units'[UnitsLabel], "m" )
```

```dax
Sel Cost Multiplier =
SELECTEDVALUE ( 'P Cost Sign'[CostMultiplier], 1 )
```
F-15 / M-25: display only (`engine/format.ts:69-79`).

```dax
Sel Show Tags =
SELECTEDVALUE ( 'P Show Tags'[ShowTags], "On" ) = "On"
```

```dax
Sel Hide Empty =
SELECTEDVALUE ( 'P Hide Empty'[HideEmpty], "On" ) = "On"
```

```dax
Latest Forecast Key =
CALCULATE (
    MAX ( 'Dim Version'[VersionKey] )
    ,REMOVEFILTERS ( 'Dim Version' )
    ,'Dim Version'[IsLatestForecast] = TRUE ()
)
```
Returns `FC2609` (`versions.ts:33`).

```dax
Latest Forecast First Idx =
CALCULATE (
    MAX ( 'Dim Version'[FirstMonthIdx] )
    ,REMOVEFILTERS ( 'Dim Version' )
    ,'Dim Version'[IsLatestForecast] = TRUE ()
)
```

```dax
Latest Forecast Last Idx =
CALCULATE (
    MAX ( 'Dim Version'[LastMonthIdx] )
    ,REMOVEFILTERS ( 'Dim Version' )
    ,'Dim Version'[IsLatestForecast] = TRUE ()
)
```

```dax
Latest Forecast Name =
CALCULATE (
    MAX ( 'Dim Version'[VersionName] )
    ,REMOVEFILTERS ( 'Dim Version' )
    ,'Dim Version'[IsLatestForecast] = TRUE ()
)
```
"Forecast 9+3 (Sep 2026)".

## 1. Window (folder `1 Window`; `engine/time-windows.ts:34-88`, `engine/versions.ts:115-141`)

```dax
Anchor Idx =
VAR _fy           = [Sel FY]
VAR _m            = [Sel Month]
RETURN
    CALCULATE (
        MAX ( 'Dim Month'[MonthIdx] )
        ,REMOVEFILTERS ( 'Dim Month' )
        ,'Dim Month'[FiscalYear] = _fy
        ,'Dim Month'[MonthNumber] = _m
    )
```

```dax
FY First Idx =
[Anchor Idx] - [Sel Month] + 1
```

```dax
FY Last Idx =
[FY First Idx] + 11
```

```dax
Range Start Idx =
SELECTEDVALUE ( 'P Range Start'[RangeStartIdx], [FY First Idx] )
```
Custom range start; default January of the selected year (`selection-schema.ts:165-180`).

```dax
Win From Raw =
VAR _tv           = [Sel Time View]
VAR _a            = [Anchor Idx]
VAR _m            = [Sel Month]
VAR _s            = [Range Start Idx]
RETURN
    SWITCH (
        _tv
        ,"MTD", _a
        ,"QTD", _a - MOD ( _m - 1, 3 )
        ,"YTD", _a - _m + 1
        ,"FY", _a - _m + 1
        ,"LTM", _a - 11
        ,"RANGE", MIN ( _s, _a )
        ,_a - _m + 1
    )
```
May be negative (LTM before the data history).

```dax
Win To =
VAR _tv           = [Sel Time View]
VAR _a            = [Anchor Idx]
VAR _m            = [Sel Month]
VAR _s            = [Range Start Idx]
RETURN
    SWITCH (
        _tv
        ,"FY", _a - _m + 12
        ,"RANGE", MAX ( _s, _a )
        ,_a
    )
```

```dax
Win From =
MAX ( 0, [Win From Raw] )
```

```dax
Months Before History =
MAX ( 0, - [Win From Raw] )
```

```dax
Base From =
[Win From]
```

```dax
Base To =
-- C-01: an Actual base never includes months after the last close
IF (
    [Sel Base] = "A"
    ,MIN ( [Win To], [Last Closed Idx] )
    ,[Win To]
)
```

```dax
Base Month Count =
MAX ( 0, [Base To] - [Base From] + 1 )
```

## 2. Plans (folder `2 Plan`; `engine/versions.ts:53-113`, `engine/view-context.ts:108-178`)

The plan of a column is read from the helper tables `Plan Column` (which column) and `Plan Scope` (whole plan or its
last month). Callers set them with `CALCULATE ( …, 'Plan Column'[Column] = "…" )` or through the `Comparison Column`
calculation group. Default (no filter) = the base column, whole plan.

```dax
Plan Column Code =
SELECTEDVALUE ( 'Plan Column'[Column], "BASE" )
```

```dax
Plan Choice =
VAR _col          = [Plan Column Code]
VAR _cmp_a        = [Sel Compare A]
VAR _cmp_b        = [Sel Compare B]
RETURN
    SWITCH (
        _col
        ,"BASE", [Sel Base]
        ,"CMP_A", _cmp_a
        ,"CMP_B", _cmp_b
        ,"BRIDGE",
            SWITCH (
                TRUE ()
                ,_cmp_a <> "NONE"
                    ,_cmp_a
                ,_cmp_b <> "NONE"
                    ,_cmp_b
                ,"PY"
            )
        ,"BUD", "B"
        ,"PY", "PY"
        ,"LE", "LE"
        ,"FY_BUD", "B"
        ,"FY_LE", "LE"
        ,[Sel Base]
    )
```
Bridge comparison = Compare A, else Compare B, else prior year (`view-context.ts:121-122`).

```dax
Plan Window From =
IF (
    [Plan Column Code] IN { "FY_BUD", "FY_LE" }
    ,[FY First Idx]
    ,[Base From]
)
```

```dax
Plan Window To =
IF (
    [Plan Column Code] IN { "FY_BUD", "FY_LE" }
    ,[FY Last Idx]
    ,[Base To]
)
```
M-14: the full-year columns cover the whole fiscal year whatever the time view; C-03: every other column covers
exactly the base months.

```dax
Plan P1 Version =
SWITCH (
    [Plan Choice]
    ,"B", "BUD"
    ,"NONE", BLANK ()
    ,"ACT"
)
```

```dax
Plan P1 From Raw =
IF (
    [Plan Choice] = "PY"
    ,MAX ( [Plan Window From] - 12, 0 )
    ,[Plan Window From]
)
```

```dax
Plan P1 To Raw =
VAR _choice       = [Plan Choice]
VAR _to           = [Plan Window To]
VAR _last         = [Last Closed Idx]
RETURN
    SWITCH (
        _choice
        ,"B", _to
        ,"PY", MIN ( _to - 12, _last )
        ,MIN ( _to, _last )
    )
```
A and LE read Actual only up to the last close; PY = base months − 12, Actual (C-04).

```dax
Plan P2 From Raw =
IF (
    [Plan Choice] = "LE"
    ,MAX ( MAX ( [Plan Window From], [Last Closed Idx] + 1 ), [Latest Forecast First Idx] )
    ,1
)
```

```dax
Plan P2 To Raw =
IF (
    [Plan Choice] = "LE"
    ,MIN ( [Plan Window To], [Latest Forecast Last Idx] )
    ,0
)
```
C-02: latest estimate = Actual for closed months + the latest forecast for open months.

```dax
Plan Last Only =
SELECTEDVALUE ( 'Plan Scope'[Scope], "ALL" ) = "LAST"
```

```dax
Plan Has P2 =
[Plan P2 From Raw] <= [Plan P2 To Raw]
```

```dax
Plan Has P1 =
VAR _choice       = [Plan Choice]
VAR _from         = [Plan P1 From Raw]
VAR _to           = [Plan P1 To Raw]
RETURN
    _choice <> "NONE"
        && _from <= _to
        && NOT ( [Plan Last Only] && [Plan Has P2] )
```

```dax
Plan P1 From =
IF ( [Plan Last Only], [Plan P1 To Raw], [Plan P1 From Raw] )
```

```dax
Plan P1 To =
[Plan P1 To Raw]
```

```dax
Plan P2 From =
IF ( [Plan Last Only], [Plan P2 To Raw], [Plan P2 From Raw] )
```

```dax
Plan P2 To =
[Plan P2 To Raw]
```

```dax
Plan Has Data =
[Plan Has P1] || [Plan Has P2]
```
No data at all → "n/a" (M-13, `versions.ts:143-144`).

```dax
Bridge Cmp Code =
CALCULATE ( [Plan Choice], 'Plan Column'[Column] = "BRIDGE" )
```

```dax
Bridge Cmp Name =
SWITCH (
    [Bridge Cmp Code]
    ,"B", "Budget"
    ,"LE", "Latest estimate"
    ,"PY", "Prior year"
)
```
`CHOICE_NAMES`, `view-context.ts:24-28`.

## 3. Translation and base amounts (folder `3 Base amounts`)

### 3.1 Translation (`engine/fx.ts:41-53`, `engine/aggregate.ts:23-72`; C-11 … C-13, D-30)

```dax
Amt Translated =
-- Σ local amounts × factor, month × currency × rate type at a time. Applies to whatever filters are on Fact PL.
-- FX basis: 'FX Override' (SEL / ACT / CC) set by callers, else the Display selection.
VAR _override     = SELECTEDVALUE ( 'FX Override'[Basis], "SEL" )
VAR _basis        = IF ( _override = "SEL", [Sel FX Basis], _override )
VAR _rep          = [Sel Currency]
VAR _fy           = [Sel FY]
RETURN
    IF (
        _basis = "CC"
        ,SUMX (
            FILTER (
                'FX CC Factor'
                ,'FX CC Factor'[FiscalYear] = _fy
                    && 'FX CC Factor'[ReportingCurrency] = _rep
            )
            ,VAR _ccy         = 'FX CC Factor'[LocalCurrency]
             VAR _local       =
                CALCULATE (
                    SUM ( 'Fact PL'[AmountLocal] )
                    ,KEEPFILTERS ( 'Dim Region'[FunctionalCurrency] = _ccy )
                )
             RETURN
                _local * 'FX CC Factor'[Factor]
        )
        ,SUMX (
            'FX Factor'
            ,VAR _local       = CALCULATE ( SUM ( 'Fact PL'[AmountLocal] ) )
             VAR _factor      =
                SWITCH (
                    _rep
                    ,"EUR", 'FX Factor'[ToEUR]
                    ,"GBP", 'FX Factor'[ToGBP]
                    ,'FX Factor'[ToUSD]
                )
             RETURN
                _local * _factor
        )
    )
```
Format `#,##0`. Actual rates: each row at its month's ACTUAL_AVG rate (budget rows at their year's BUDGET rate);
constant currency: every row at the **selected** year's budget rate (C-12). Never translate an aggregated total.

```dax
GMV Translated =
-- the same translation over Fact Ops[GmvLocal] (GMV is translated like amounts, chat-metrics.ts:613-616)
VAR _override     = SELECTEDVALUE ( 'FX Override'[Basis], "SEL" )
VAR _basis        = IF ( _override = "SEL", [Sel FX Basis], _override )
VAR _rep          = [Sel Currency]
VAR _fy           = [Sel FY]
RETURN
    IF (
        _basis = "CC"
        ,SUMX (
            FILTER (
                'FX CC Factor'
                ,'FX CC Factor'[FiscalYear] = _fy
                    && 'FX CC Factor'[ReportingCurrency] = _rep
            )
            ,VAR _ccy         = 'FX CC Factor'[LocalCurrency]
             VAR _local       =
                CALCULATE (
                    SUM ( 'Fact Ops'[GmvLocal] )
                    ,KEEPFILTERS ( 'Dim Region'[FunctionalCurrency] = _ccy )
                )
             RETURN
                _local * 'FX CC Factor'[Factor]
        )
        ,SUMX (
            'FX Factor'
            ,VAR _local       = CALCULATE ( SUM ( 'Fact Ops'[GmvLocal] ) )
             VAR _factor      =
                SWITCH (
                    _rep
                    ,"EUR", 'FX Factor'[ToEUR]
                    ,"GBP", 'FX Factor'[ToGBP]
                    ,'FX Factor'[ToUSD]
                )
             RETURN
                _local * _factor
        )
    )
```

### 3.2 The base amount: company × plan × translation

```dax
Amt =
-- The one P&L scan (ADR-0002 §2.3): the company (Group = both companies without intercompany rows, C-36 / D-33),
-- the plan of the column in context (two contiguous parts), translated per month × currency.
-- A plan with data returns 0 for an empty cut (a leaf with nothing booked), BLANK = "n/a".
VAR _co           = [Sel Company]
VAR _has_1        = [Plan Has P1]
VAR _has_2        = [Plan Has P2]
VAR _version_1    = [Plan P1 Version]
VAR _from_1       = [Plan P1 From]
VAR _to_1         = [Plan P1 To]
VAR _version_2    = [Latest Forecast Key]
VAR _from_2       = [Plan P2 From]
VAR _to_2         = [Plan P2 To]
VAR _entities     =
    FILTER (
        ALL ( 'Dim Entity'[EntityCode] )
        ,_co = "GROUP"
            || 'Dim Entity'[EntityCode] = _co
    )
VAR _counterparty =
    FILTER (
        ALL ( 'Fact PL'[CounterpartyCode] )
        ,_co <> "GROUP"
            || 'Fact PL'[CounterpartyCode] = ""
    )
VAR _part_1       =
    IF (
        _has_1
        ,CALCULATE (
            [Amt Translated]
            ,_entities
            ,_counterparty
            ,'Dim Version'[VersionKey] = _version_1
            ,KEEPFILTERS (
                FILTER (
                    ALL ( 'Dim Month'[MonthIdx] )
                    ,'Dim Month'[MonthIdx] >= _from_1
                        && 'Dim Month'[MonthIdx] <= _to_1
                )
            )
        )
    )
VAR _part_2       =
    IF (
        _has_2
        ,CALCULATE (
            [Amt Translated]
            ,_entities
            ,_counterparty
            ,'Dim Version'[VersionKey] = _version_2
            ,KEEPFILTERS (
                FILTER (
                    ALL ( 'Dim Month'[MonthIdx] )
                    ,'Dim Month'[MonthIdx] >= _from_2
                        && 'Dim Month'[MonthIdx] <= _to_2
                )
            )
        )
    )
RETURN
    IF ( _has_1 || _has_2, _part_1 + _part_2 + 0 )
```
Format `#,##0`. Sources: `aggregate.ts:79-109`, `versions.ts:53-141`, `view-context.ts:131-141` (a plan without data →
null). The month predicates use `KEEPFILTERS`, so a month on a visual axis intersects with the plan.

```dax
Units Raw =
-- Σ units sold over the plan (a flow; P only). Same plan block as [Amt], no translation.
VAR _co           = [Sel Company]
VAR _has_1        = [Plan Has P1]
VAR _has_2        = [Plan Has P2]
VAR _version_1    = [Plan P1 Version]
VAR _from_1       = [Plan P1 From]
VAR _to_1         = [Plan P1 To]
VAR _version_2    = [Latest Forecast Key]
VAR _from_2       = [Plan P2 From]
VAR _to_2         = [Plan P2 To]
VAR _part_1       =
    IF (
        _has_1
        ,CALCULATE (
            SUM ( 'Fact Ops'[Units] )
            ,'Dim Entity'[EntityCode] = _co
            ,'Dim Version'[VersionKey] = _version_1
            ,KEEPFILTERS (
                FILTER (
                    ALL ( 'Dim Month'[MonthIdx] )
                    ,'Dim Month'[MonthIdx] >= _from_1
                        && 'Dim Month'[MonthIdx] <= _to_1
                )
            )
        )
    )
VAR _part_2       =
    IF (
        _has_2
        ,CALCULATE (
            SUM ( 'Fact Ops'[Units] )
            ,'Dim Entity'[EntityCode] = _co
            ,'Dim Version'[VersionKey] = _version_2
            ,KEEPFILTERS (
                FILTER (
                    ALL ( 'Dim Month'[MonthIdx] )
                    ,'Dim Month'[MonthIdx] >= _from_2
                        && 'Dim Month'[MonthIdx] <= _to_2
                )
            )
        )
    )
RETURN
    IF ( _co <> "GROUP" && ( _has_1 || _has_2 ), _part_1 + _part_2 )
```
Format `#,##0`. `slices.ts:158-196` (`aggregateOpsBy`).

```dax
GMV Raw =
-- Σ GMV over the plan, translated like amounts (S only).
VAR _co           = [Sel Company]
VAR _has_1        = [Plan Has P1]
VAR _has_2        = [Plan Has P2]
VAR _version_1    = [Plan P1 Version]
VAR _from_1       = [Plan P1 From]
VAR _to_1         = [Plan P1 To]
VAR _version_2    = [Latest Forecast Key]
VAR _from_2       = [Plan P2 From]
VAR _to_2         = [Plan P2 To]
VAR _part_1       =
    IF (
        _has_1
        ,CALCULATE (
            [GMV Translated]
            ,'Dim Entity'[EntityCode] = _co
            ,'Dim Version'[VersionKey] = _version_1
            ,KEEPFILTERS (
                FILTER (
                    ALL ( 'Dim Month'[MonthIdx] )
                    ,'Dim Month'[MonthIdx] >= _from_1
                        && 'Dim Month'[MonthIdx] <= _to_1
                )
            )
        )
    )
VAR _part_2       =
    IF (
        _has_2
        ,CALCULATE (
            [GMV Translated]
            ,'Dim Entity'[EntityCode] = _co
            ,'Dim Version'[VersionKey] = _version_2
            ,KEEPFILTERS (
                FILTER (
                    ALL ( 'Dim Month'[MonthIdx] )
                    ,'Dim Month'[MonthIdx] >= _from_2
                        && 'Dim Month'[MonthIdx] <= _to_2
                )
            )
        )
    )
RETURN
    IF ( _co <> "GROUP" && ( _has_1 || _has_2 ), _part_1 + _part_2 )
```
Format `#,##0`.

```dax
Merchants Plan =
-- Σ active merchants over the plan rows in context (used only through [Merchants Raw], i.e. its last month).
VAR _co           = [Sel Company]
VAR _has_1        = [Plan Has P1]
VAR _has_2        = [Plan Has P2]
VAR _version_1    = [Plan P1 Version]
VAR _from_1       = [Plan P1 From]
VAR _to_1         = [Plan P1 To]
VAR _version_2    = [Latest Forecast Key]
VAR _from_2       = [Plan P2 From]
VAR _to_2         = [Plan P2 To]
VAR _part_1       =
    IF (
        _has_1
        ,CALCULATE (
            SUM ( 'Fact Ops'[Merchants] )
            ,'Dim Entity'[EntityCode] = _co
            ,'Dim Version'[VersionKey] = _version_1
            ,KEEPFILTERS (
                FILTER (
                    ALL ( 'Dim Month'[MonthIdx] )
                    ,'Dim Month'[MonthIdx] >= _from_1
                        && 'Dim Month'[MonthIdx] <= _to_1
                )
            )
        )
    )
VAR _part_2       =
    IF (
        _has_2
        ,CALCULATE (
            SUM ( 'Fact Ops'[Merchants] )
            ,'Dim Entity'[EntityCode] = _co
            ,'Dim Version'[VersionKey] = _version_2
            ,KEEPFILTERS (
                FILTER (
                    ALL ( 'Dim Month'[MonthIdx] )
                    ,'Dim Month'[MonthIdx] >= _from_2
                        && 'Dim Month'[MonthIdx] <= _to_2
                )
            )
        )
    )
RETURN
    IF ( _co <> "GROUP" && ( _has_1 || _has_2 ), _part_1 + _part_2 )
```

```dax
Merchants Raw =
-- K-23: a month-end stock, read at the plan's last month, never summed over months
CALCULATE (
    [Merchants Plan]
    ,'Plan Scope'[Scope] = "LAST"
)
```
Format `#,##0`. `slices.ts:172, 192`.

## 4. Statement lines and ratios (folder `4 Lines`; 29 catalogue metrics)

Block sets per `03-model.md` §5 (`dim_report_line` formulas, D-32). Every line reads the column in context (base by
default; any `Comparison Column` item; any `FX Override`). Format of amounts `#,##0`, of ratios `0.0%`.

| Metric id | Measure | DAX |
|---|---|---|
| GR | `Gross Revenue` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] = "GR" )` |
| GTN | `Gross-to-Net Deductions` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] = "GTN" )` |
| NR | `Net Revenue` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] IN { "GR", "GTN" } )` |
| COR | `Cost of Revenue` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] = "COR" )` |
| GP | `Gross Profit` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] IN { "GR", "GTN", "COR" } )` |
| VSC | `Variable Selling` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] = "VSC" )` |
| CM | `Contribution Margin` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] IN { "GR", "GTN", "COR", "VSC" } )` |
| OPEX | `Operating Expenses` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] IN { "SM", "RD", "GA", "OOI" } )` |
| SM | `Sales & Marketing` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] = "SM" )` |
| RD | `R&D` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] = "RD" )` |
| GA | `G&A` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] = "GA" )` |
| OOI | `Other Operating Income` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] = "OOI" )` |
| EBITDA | `Adjusted EBITDA` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] IN { "GR", "GTN", "COR", "VSC", "SM", "RD", "GA", "OOI" } )` |
| DA | `D&A` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] = "DA" )` |
| UOP | `Underlying Operating Profit` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] IN { "GR", "GTN", "COR", "VSC", "SM", "RD", "GA", "OOI", "DA" } )` |
| ADJ | `Adjusting Items` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] = "ADJ" )` |
| OP | `Operating Profit` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] IN { "GR", "GTN", "COR", "VSC", "SM", "RD", "GA", "OOI", "DA", "ADJ" } )` |
| INV | `Investing Income` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] = "INV" )` |
| PBFIT | `Profit Before Financing and Tax` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] IN { "GR", "GTN", "COR", "VSC", "SM", "RD", "GA", "OOI", "DA", "ADJ", "INV" } )` |
| FIN | `Financing Expenses` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] = "FIN" )` |
| PBT | `Profit Before Tax` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] IN { "GR", "GTN", "COR", "VSC", "SM", "RD", "GA", "OOI", "DA", "ADJ", "INV", "FIN" } )` |
| TAX | `Income Tax` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] = "TAX" )` |
| NP | `Net Profit` | `CALCULATE ( [Amt], 'Dim Account'[BlockCode] IN { "GR", "GTN", "COR", "VSC", "SM", "RD", "GA", "OOI", "DA", "ADJ", "INV", "FIN", "TAX" } )` |
| GM_PCT | `Gross Margin %` | `DIVIDE ( [Gross Profit], [Net Revenue] )` |
| CM_PCT | `Contribution Margin %` | `DIVIDE ( [Contribution Margin], [Net Revenue] )` |
| EBITDA_PCT | `Adjusted EBITDA Margin %` | `DIVIDE ( [Adjusted EBITDA], [Net Revenue] )` |
| OP_PCT | `Operating Margin %` | `DIVIDE ( [Operating Profit], [Net Revenue] )` |
| ETR_PCT | `Effective Tax Rate %` | `DIVIDE ( -1 * [Income Tax], [Profit Before Tax] )` |
| NP_PCT | `Net Margin %` | `DIVIDE ( [Net Profit], [Net Revenue] )` |

Multi-line form of one of them (all follow it):

```dax
Adjusted EBITDA =
CALCULATE (
    [Amt]
    ,'Dim Account'[BlockCode] IN { "GR", "GTN", "COR", "VSC", "SM", "RD", "GA", "OOI" }
)
```

The ELIM_* accounts have no rows, so the Group's blocks GR and VSC are the two companies minus the excluded
intercompany rows (`notices.ts` "Eliminations"; T-01, T-02).

## 5. The rest of the metric catalogue (folder `5 Catalogue`; `src/lib/pnl/chat-metrics.ts:392-915`)

Each catalogue metric exists for the companies listed; for another company it returns BLANK. "Base only" metrics
compare columns themselves and return BLANK under every `Comparison Column` item except Base.

### 5.1 Cost ratios (8)

```dax
Opex % of NR =
-- OPEX_PCT: − (SM + RD + GA) ÷ NR; other operating income excluded (vitals.ts:155-160, chat-metrics.ts:393-415)
VAR _sm           = [Sales & Marketing]
VAR _rd           = [R&D]
VAR _ga           = [G&A]
RETURN
    IF (
        ISBLANK ( _sm ) || ISBLANK ( _rd ) || ISBLANK ( _ga )
        ,BLANK ()
        ,DIVIDE ( - ( _sm + _rd + _ga ), [Net Revenue] )
    )
```
Format `0.0%`. Better: lower. Companies P, S, Group.

```dax
Gross-to-Net % =
-- GTN_PCT: − GTN ÷ GR (chat-metrics.ts:416-429; vitals.ts:493-514)
DIVIDE ( -1 * [Gross-to-Net Deductions], [Gross Revenue] )
```
Format `0.0%`. Lower is better.

| Metric id | Measure | DAX | Format |
|---|---|---|---|
| COR_PCT | `Cost of Revenue % of NR` | `DIVIDE ( -1 * [Cost of Revenue], [Net Revenue] )` | `0.0%` |
| VSC_PCT | `Variable Selling % of NR` | `DIVIDE ( -1 * [Variable Selling], [Net Revenue] )` | `0.0%` |
| SM_PCT | `S&M % of NR` | `DIVIDE ( -1 * [Sales & Marketing], [Net Revenue] )` | `0.0%` |
| RD_PCT | `R&D % of NR` | `DIVIDE ( -1 * [R&D], [Net Revenue] )` | `0.0%` |
| GA_PCT | `G&A % of NR` | `DIVIDE ( -1 * [G&A], [Net Revenue] )` | `0.0%` |

(Derived: on no card or statement row; `chat-metrics.ts:430-467`.)

```dax
A&P Spend =
-- AP_SPEND: Advertising: working media + Consumer promotions, sampling & sponsorship (signed, a cost). P only.
IF (
    [Sel Company] = "P"
    ,CALCULATE (
        [Amt]
        ,'Dim Account'[AccountCode] IN { "SM_P1", "SM_P2" }
    )
)
```
Format `#,##0`. `chat-metrics.ts:584-600`, `vitals.ts:438-448`.

```dax
A&P % of NR =
-- AP_PCT: − (SM_P1 + SM_P2) ÷ NR. Neutral KPI (no status, no colour). P only.
IF (
    [Sel Company] = "P"
    ,DIVIDE ( -1 * [A&P Spend], [Net Revenue] )
)
```
Format `0.0%`.

### 5.2 Growth (3, base only)

```dax
NR Growth Reported =
-- NR_GROWTH: NR ÷ prior-year NR − 1, both at the selected rates; Δ over |PY| (view-context.ts:188-191)
VAR _now          = CALCULATE ( [Net Revenue], 'Plan Column'[Column] = "BASE" )
VAR _py           = CALCULATE ( [Net Revenue], 'Plan Column'[Column] = "PY" )
RETURN
    IF (
        ISBLANK ( _now ) || ISBLANK ( _py ) || _py = 0
        ,BLANK ()
        ,( _now - _py ) / ABS ( _py )
    )
```
Format `+0.0%;−0.0%;0.0%`.

```dax
NR Growth Organic =
-- NR_GROWTH_ORGANIC (K-02): NR and prior-year NR both at constant currency (selected FY budget rates)
VAR _now          =
    CALCULATE (
        [Net Revenue]
        ,'Plan Column'[Column] = "BASE"
        ,'FX Override'[Basis] = "CC"
    )
VAR _py           =
    CALCULATE (
        [Net Revenue]
        ,'Plan Column'[Column] = "PY"
        ,'FX Override'[Basis] = "CC"
    )
RETURN
    IF (
        ISBLANK ( _now ) || ISBLANK ( _py ) || _py = 0
        ,BLANK ()
        ,( _now - _py ) / ABS ( _py )
    )
```
Format `+0.0%;−0.0%;0.0%`. `vitals.ts:146-148`.

```dax
EBITDA Growth =
-- EBITDA_GROWTH (derived): Adj. EBITDA ÷ prior-year Adj. EBITDA − 1
VAR _now          = CALCULATE ( [Adjusted EBITDA], 'Plan Column'[Column] = "BASE" )
VAR _py           = CALCULATE ( [Adjusted EBITDA], 'Plan Column'[Column] = "PY" )
RETURN
    IF (
        ISBLANK ( _now ) || ISBLANK ( _py ) || _py = 0
        ,BLANK ()
        ,( _now - _py ) / ABS ( _py )
    )
```
Format `+0.0%;−0.0%;0.0%`.

### 5.3 Drivers (10)

```dax
Units Sold =
-- UNITS (K-09 P): Σ units over the window; null when not positive (vitals.ts:433-436). P only.
VAR _units        = [Units Raw]
RETURN
    IF ( [Sel Company] = "P" && _units > 0, _units )
```
Format `#,##0`.

```dax
NR per Unit =
-- NR_PER_UNIT (K-10 P): NR ÷ units sold. P only.
IF (
    [Sel Company] = "P"
    ,DIVIDE ( [Net Revenue], [Units Sold] )
)
```
Format `#,##0.00`.

```dax
GMV Processed =
-- GMV (K-09 S). S only.
IF ( [Sel Company] = "S", [GMV Raw] )
```
Format `#,##0`.

```dax
Payments Take Rate =
-- TAKE_RATE (K-05 S): Payments NR ÷ Payments GMV; not cut by service line (it is the Payments line). S only.
IF (
    [Sel Company] = "S"
        && NOT ISFILTERED ( 'Dim Line' )
    ,DIVIDE (
        CALCULATE ( [Net Revenue], 'Dim Line'[LineCode] = "PAY" )
        ,CALCULATE ( [GMV Processed], 'Dim Line'[LineCode] = "PAY" )
    )
)
```
Format `0.00%`. `vitals.ts:311-316`, `chat-metrics.ts:618-641`.

```dax
Active Merchants =
-- ACTIVE_MERCHANTS (K-10 S): at the window's last month-end (K-23); null when not positive. S only.
VAR _merchants    = [Merchants Raw]
RETURN
    IF ( [Sel Company] = "S" && _merchants > 0, _merchants )
```
Format `#,##0`.

```dax
GMV per Merchant =
-- GMV_PER_MERCHANT (derived): GMV over the window ÷ active merchants at its end. S only.
IF (
    [Sel Company] = "S"
    ,DIVIDE ( [GMV Raw], [Active Merchants] )
)
```
Format `#,##0.00`.

```dax
ARR Run-Rate =
-- ARR (K-04 S): Platform-subscription NR of the window's last month × 12; not cut by service line. S only.
VAR _sub          =
    CALCULATE (
        [Net Revenue]
        ,'Plan Scope'[Scope] = "LAST"
        ,'Dim Line'[LineCode] = "SUB"
    )
RETURN
    IF (
        [Sel Company] = "S"
            && NOT ISFILTERED ( 'Dim Line' )
            && NOT ISBLANK ( _sub )
        ,_sub * 12
    )
```
Format `#,##0`. `vitals.ts:297-304`.

```dax
Subscriptions Share of NR =
-- SUB_SHARE: NR of the Platform subscriptions line ÷ NR (Revenue mix card). Neutral. S only.
IF (
    [Sel Company] = "S"
        && NOT ISFILTERED ( 'Dim Line' )
    ,DIVIDE (
        CALCULATE ( [Net Revenue], 'Dim Line'[LineCode] = "SUB" )
        ,[Net Revenue]
    )
)
```
Format `0.0%`.

```dax
Payments Share of NR =
IF (
    [Sel Company] = "S"
        && NOT ISFILTERED ( 'Dim Line' )
    ,DIVIDE (
        CALCULATE ( [Net Revenue], 'Dim Line'[LineCode] = "PAY" )
        ,[Net Revenue]
    )
)
```
Format `0.0%`.

(With `A&P Spend`, `Units Sold`, `NR per Unit`: 10 drivers.)

### 5.4 Full-year outlook (6, base only; M-14)

```dax
FY NR LE =
CALCULATE ( [Net Revenue], 'Plan Column'[Column] = "FY_LE" )
```

```dax
FY NR Budget =
CALCULATE ( [Net Revenue], 'Plan Column'[Column] = "FY_BUD" )
```

```dax
FY EBITDA LE =
CALCULATE ( [Adjusted EBITDA], 'Plan Column'[Column] = "FY_LE" )
```

```dax
FY EBITDA Budget =
CALCULATE ( [Adjusted EBITDA], 'Plan Column'[Column] = "FY_BUD" )
```

```dax
FY NR Attainment =
DIVIDE ( [FY NR LE], [FY NR Budget] )
```

```dax
FY EBITDA Attainment =
DIVIDE ( [FY EBITDA LE], [FY EBITDA Budget] )
```
Formats `#,##0` (amounts) and `0.0%` (attainments). `vitals.ts:537-582`, `chat-metrics.ts:737-820`.

### 5.5 FX effects (3, base only, derived)

```dax
FX Effect NR =
-- FX_EFFECT_NR: NR at actual rates − NR at constant currency, base column
VAR _actual       =
    CALCULATE (
        [Net Revenue]
        ,'Plan Column'[Column] = "BASE"
        ,'FX Override'[Basis] = "ACT"
    )
VAR _constant     =
    CALCULATE (
        [Net Revenue]
        ,'Plan Column'[Column] = "BASE"
        ,'FX Override'[Basis] = "CC"
    )
RETURN
    IF ( ISBLANK ( _actual ) || ISBLANK ( _constant ), BLANK (), _actual - _constant )
```
`FX Effect EBITDA` and `FX Effect OP`: the same with `[Adjusted EBITDA]` / `[Operating Profit]`. Format `#,##0`.
`chat-metrics.ts:821-862`.

### 5.6 Shares of the company total (3, derived; need a slice member)

```dax
NR Share of Company =
-- NR_SHARE: the member's NR ÷ the company's NR; needs one region / channel / line / segment filter. P and S only.
VAR _sliced       =
    ISFILTERED ( 'Dim Region' )
        || ISFILTERED ( 'Dim Channel' )
        || ISFILTERED ( 'Dim Line' )
        || ISFILTERED ( 'Dim Segment' )
VAR _whole        =
    CALCULATE (
        [Net Revenue]
        ,REMOVEFILTERS ( 'Dim Region' )
        ,REMOVEFILTERS ( 'Dim Channel' )
        ,REMOVEFILTERS ( 'Dim Line' )
        ,REMOVEFILTERS ( 'Dim Segment' )
    )
RETURN
    IF (
        [Sel Company] <> "GROUP" && _sliced
        ,DIVIDE ( [Net Revenue], _whole )
    )
```
`CM Share of Company` and `EBITDA Share of Company`: the same with `[Contribution Margin]` / `[Adjusted EBITDA]`.
Format `0.0%`. Because below-CM lines are allocated in `Fact PL`, a channel / line / segment member's EBITDA is the
allocated figure (C-31), exactly as in the web report.

## 6. Shared text helpers (folder `10 Header`)

```dax
Theme Acc =
SWITCH ( [Sel Company], "S", "#6B48C8", "GROUP", "#3B4A5E", "#2453A6" )
```

```dax
Theme Acc Tint =
SWITCH ( [Sel Company], "S", "#F0EBFB", "GROUP", "#EAEDF1", "#E8EEF8" )
```

```dax
Theme Key Rule =
SWITCH ( [Sel Company], "S", "#CFC2F0", "GROUP", "#C5CCD5", "#B9C8E4" )
```
`components/pnl/theme.ts:5-30`.

```dax
Company Name =
SWITCH ( [Sel Company], "S", "Commerce Cloud", "GROUP", "ACME Group", "Consumer Products" )
```

## 7. P&L statement (folder `6 Statement`; `engine/index.ts:86-157`, `components/pnl/statement-table.tsx`, `engine/hide-empty.ts`)

### 7.1 Row resolution

```dax
Stmt Row Kind =
IF (
    ISINSCOPE ( 'PL Row'[AccountName] )
    ,"leaf"
    ,SELECTEDVALUE ( 'PL Row'[LineKind] )
)
```

```dax
Stmt Row In Scope =
-- a leaf belongs to the company shown (spine.ts:7-11, 82-99); non-leaf rows always show
VAR _kind         = [Stmt Row Kind]
VAR _scope        = SELECTEDVALUE ( 'PL Row'[EntityScope] )
VAR _acc          = SELECTEDVALUE ( 'PL Row'[AccountCode] )
VAR _co           = [Sel Company]
RETURN
    SWITCH (
        TRUE ()
        ,_kind <> "leaf"
            ,TRUE ()
        ,_acc = ""
            ,FALSE ()
        ,_scope = "BOTH"
            ,TRUE ()
        ,_co = "GROUP"
            ,_scope IN { "P", "S" }
        ,_scope = _co
    )
```

```dax
PL Value =
-- the value of the statement row in context, in the column in context (unrounded, signed)
VAR _kind         = [Stmt Row Kind]
VAR _line         = SELECTEDVALUE ( 'PL Row'[LineCode] )
VAR _acc          = SELECTEDVALUE ( 'PL Row'[AccountCode] )
RETURN
    IF (
        NOT [Stmt Row In Scope]
        ,BLANK ()
        ,IF (
            _kind = "leaf"
            ,CALCULATE ( [Amt], 'Dim Account'[AccountCode] = _acc )
            ,SWITCH (
                _line
                ,"GR", [Gross Revenue]
                ,"GTN", [Gross-to-Net Deductions]
                ,"NR", [Net Revenue]
                ,"COR", [Cost of Revenue]
                ,"GP", [Gross Profit]
                ,"GM_PCT", [Gross Margin %]
                ,"VSC", [Variable Selling]
                ,"CM", [Contribution Margin]
                ,"CM_PCT", [Contribution Margin %]
                ,"OPEX", [Operating Expenses]
                ,"SM", [Sales & Marketing]
                ,"RD", [R&D]
                ,"GA", [G&A]
                ,"OOI", [Other Operating Income]
                ,"EBITDA", [Adjusted EBITDA]
                ,"EBITDA_PCT", [Adjusted EBITDA Margin %]
                ,"DA", [D&A]
                ,"UOP", [Underlying Operating Profit]
                ,"ADJ", [Adjusting Items]
                ,"OP", [Operating Profit]
                ,"OP_PCT", [Operating Margin %]
                ,"INV", [Investing Income]
                ,"PBFIT", [Profit Before Financing and Tax]
                ,"FIN", [Financing Expenses]
                ,"PBT", [Profit Before Tax]
                ,"TAX", [Income Tax]
                ,"ETR_PCT", [Effective Tax Rate %]
                ,"NP", [Net Profit]
                ,"NP_PCT", [Net Margin %]
            )
        )
    )
```

### 7.2 Raw column values

```dax
Stmt Base Raw =
CALCULATE ( [PL Value], 'Plan Column'[Column] = "BASE" )
```

```dax
Stmt Cmp A Raw =
IF ( [Sel Compare A] <> "NONE", CALCULATE ( [PL Value], 'Plan Column'[Column] = "CMP_A" ) )
```

```dax
Stmt Cmp B Raw =
IF ( [Sel Compare B] <> "NONE", CALCULATE ( [PL Value], 'Plan Column'[Column] = "CMP_B" ) )
```

```dax
Stmt FY Budget Raw =
CALCULATE ( [PL Value], 'Plan Column'[Column] = "FY_BUD" )
```

```dax
Stmt FY LE Raw =
CALCULATE ( [PL Value], 'Plan Column'[Column] = "FY_LE" )
```

```dax
Stmt NR Base =
CALCULATE ( [Net Revenue], 'Plan Column'[Column] = "BASE" )
```

```dax
Stmt Delta A Raw =
-- M-10: Δ = base − comparison on signed values; positive = favourable on every line (T-13)
VAR _base         = [Stmt Base Raw]
VAR _cmp          = [Stmt Cmp A Raw]
RETURN
    IF ( ISBLANK ( _base ) || ISBLANK ( _cmp ), BLANK (), _base - _cmp )
```
`Stmt Delta B Raw`: the same with `[Stmt Cmp B Raw]`.

```dax
Stmt FY Delta Raw =
VAR _le           = [Stmt FY LE Raw]
VAR _bud          = [Stmt FY Budget Raw]
RETURN
    IF ( ISBLANK ( _le ) || ISBLANK ( _bud ), BLANK (), _le - _bud )
```

```dax
Stmt Delta Pct A Raw =
-- Δ % = Δ ÷ |comparison|; none on ratio rows (M-11) or when the comparison is 0 (index.ts:86-100)
VAR _delta        = [Stmt Delta A Raw]
VAR _cmp          = [Stmt Cmp A Raw]
RETURN
    IF (
        [Stmt Row Kind] = "ratio" || ISBLANK ( _delta ) || _cmp = 0
        ,BLANK ()
        ,_delta / ABS ( _cmp )
    )
```
`Stmt Delta Pct B Raw`: the same with B.

### 7.3 Hide empty lines (M-22, T-16; `engine/hide-empty.ts:31-62`)

A leaf row is hidden when every number it shows rounds to zero (or is n/a) in the selected units, on the visible
columns. Blocks, subtotals and ratios always show. Compare A's bar draws Δ % even without the Δ % column.

```dax
Stmt Row Hidden =
VAR _kind         = [Stmt Row Kind]
RETURN
    IF (
        _kind <> "leaf" || NOT [Sel Hide Empty]
        ,FALSE ()
        ,VAR _cols        = VALUES ( 'Statement Columns'[Statement Columns Order] )
         VAR _div         = [Sel Units Divisor]
         VAR _dec         = [Sel Units Decimals]
         VAR _on_a        = [Sel Compare A] <> "NONE" && 3 IN _cols
         VAR _on_b        = [Sel Compare B] <> "NONE" && 7 IN _cols
         VAR _base        = [Stmt Base Raw]
         VAR _pct_nr      = DIVIDE ( _base, [Stmt NR Base] )
         VAR _cmp_a       = [Stmt Cmp A Raw]
         VAR _d_a         = [Stmt Delta A Raw]
         VAR _dp_a        = [Stmt Delta Pct A Raw]
         VAR _cmp_b       = [Stmt Cmp B Raw]
         VAR _d_b         = [Stmt Delta B Raw]
         VAR _dp_b        = [Stmt Delta Pct B Raw]
         VAR _fy_bud      = [Stmt FY Budget Raw]
         VAR _fy_le       = [Stmt FY LE Raw]
         VAR _fy_d        = [Stmt FY Delta Raw]
         VAR _z_base      = ISBLANK ( _base ) || ROUND ( ABS ( _base ) / _div, _dec ) = 0
         VAR _z_pct_nr    = NOT ( 2 IN _cols ) || ISBLANK ( _pct_nr ) || ROUND ( ABS ( _pct_nr ) * 100, 1 ) = 0
         VAR _z_a         =
            NOT _on_a
                || (
                    ( ISBLANK ( _cmp_a ) || ROUND ( ABS ( _cmp_a ) / _div, _dec ) = 0 )
                    && ( NOT ( 4 IN _cols ) || ISBLANK ( _d_a ) || ROUND ( ABS ( _d_a ) / _div, _dec ) = 0 )
                    && ( ISBLANK ( _dp_a ) || ROUND ( ABS ( _dp_a ) * 100, 1 ) = 0 )
                )
         VAR _z_b         =
            NOT _on_b
                || (
                    ( ISBLANK ( _cmp_b ) || ROUND ( ABS ( _cmp_b ) / _div, _dec ) = 0 )
                    && ( NOT ( 8 IN _cols ) || ISBLANK ( _d_b ) || ROUND ( ABS ( _d_b ) / _div, _dec ) = 0 )
                    && ( NOT ( 9 IN _cols ) || ISBLANK ( _dp_b ) || ROUND ( ABS ( _dp_b ) * 100, 1 ) = 0 )
                )
         VAR _z_fy        =
            NOT ( 10 IN _cols || 11 IN _cols )
                || (
                    ( ISBLANK ( _fy_bud ) || ROUND ( ABS ( _fy_bud ) / _div, _dec ) = 0 )
                    && ( ISBLANK ( _fy_le ) || ROUND ( ABS ( _fy_le ) / _div, _dec ) = 0 )
                    && ( NOT ( 12 IN _cols ) || ISBLANK ( _fy_d ) || ROUND ( ABS ( _fy_d ) / _div, _dec ) = 0 )
                )
         RETURN
            _z_base && _z_pct_nr && _z_a && _z_b && _z_fy
    )
```

```dax
Stmt Row Shown =
[Stmt Row In Scope] && NOT [Stmt Row Hidden]
```

### 7.4 Display columns (the field-parameter measures)

Amount cells: value × (−1 on cost rows when "Costs shown as positives") ÷ units divisor, rounded; ratio rows as a
fraction. Δ and Δ % never flip (`format.ts:69-79`). Numbers that round to zero carry no sign.

```dax
Stmt Line Note =
-- the entity alias of a spine line (L-11) and the tag (L-14: IFRS 18 · MPM · Mgmt · IC) when tags are on
VAR _kind         = [Stmt Row Kind]
VAR _co           = [Sel Company]
VAR _alias        =
    IF (
        _kind = "leaf"
        ,""
        ,SWITCH ( _co, "P", SELECTEDVALUE ( 'PL Row'[AliasP] ), "S", SELECTEDVALUE ( 'PL Row'[AliasS] ), "" )
    )
VAR _tag          =
    IF (
        [Sel Show Tags]
        ,IF ( _kind = "leaf", SELECTEDVALUE ( 'PL Row'[AccountTag] ), SELECTEDVALUE ( 'PL Row'[Tag] ) )
        ,""
    )
VAR _text         =
    _alias & IF ( _alias <> "" && _tag <> "", "  ·  ", "" ) & _tag
RETURN
    IF ( [Stmt Row Shown] && _text <> "", _text )
```

```dax
Stmt Base =
VAR _raw          = [Stmt Base Raw]
VAR _kind         = [Stmt Row Kind]
VAR _mult         = IF ( SELECTEDVALUE ( 'PL Row'[IsCost], FALSE () ), [Sel Cost Multiplier], 1 )
RETURN
    SWITCH (
        TRUE ()
        ,NOT [Stmt Row Shown]
            ,BLANK ()
        ,ISBLANK ( _raw )
            ,0
        ,_kind = "ratio"
            ,ROUND ( _raw, 3 )
        ,ROUND ( _raw * _mult / [Sel Units Divisor], [Sel Units Decimals] )
    )
```
Dynamic format string:
```dax
SWITCH (
    TRUE ()
    ,ISBLANK ( [Stmt Base Raw] )
        ,"""n/a"""
    ,[Stmt Row Kind] = "ratio"
        ,"0.0%;−0.0%;0.0%"
    ,[Sel Units Decimals] = 0
        ,"#,##0;−#,##0;0"
    ,"#,##0.0;−#,##0.0;0.0"
)
```

```dax
Stmt Pct NR =
-- M-12: row value ÷ NR of the same column (signed; costs negative even when shown as positives); none on ratio rows
VAR _kind         = [Stmt Row Kind]
VAR _ratio        = DIVIDE ( [Stmt Base Raw], [Stmt NR Base] )
RETURN
    SWITCH (
        TRUE ()
        ,NOT [Stmt Row Shown] || _kind = "ratio"
            ,BLANK ()
        ,ISBLANK ( _ratio )
            ,0
        ,ROUND ( _ratio, 3 )
    )
```
Dynamic format: `IF ( ISBLANK ( DIVIDE ( [Stmt Base Raw], [Stmt NR Base] ) ), """n/a""", "0.0%;−0.0%;0.0%" )`.

```dax
Stmt Cmp A =
VAR _raw          = [Stmt Cmp A Raw]
VAR _kind         = [Stmt Row Kind]
VAR _mult         = IF ( SELECTEDVALUE ( 'PL Row'[IsCost], FALSE () ), [Sel Cost Multiplier], 1 )
RETURN
    SWITCH (
        TRUE ()
        ,NOT [Stmt Row Shown] || [Sel Compare A] = "NONE"
            ,BLANK ()
        ,ISBLANK ( _raw )
            ,0
        ,_kind = "ratio"
            ,ROUND ( _raw, 3 )
        ,ROUND ( _raw * _mult / [Sel Units Divisor], [Sel Units Decimals] )
    )
```
Dynamic format: as `Stmt Base` with `[Stmt Cmp A Raw]`. `Stmt Cmp B`, `Stmt FY Budget`, `Stmt FY LE`: the same pattern
with `[Stmt Cmp B Raw]` (switched off when Compare B = NONE), `[Stmt FY Budget Raw]`, `[Stmt FY LE Raw]` (never switched
off; hide them through the Columns slicer).

```dax
Stmt Delta A =
-- amount rows: Δ in display units, signed; ratio rows: Δ in percentage points (M-11)
VAR _delta        = [Stmt Delta A Raw]
VAR _kind         = [Stmt Row Kind]
RETURN
    SWITCH (
        TRUE ()
        ,NOT [Stmt Row Shown] || [Sel Compare A] = "NONE"
            ,BLANK ()
        ,ISBLANK ( _delta )
            ,0
        ,_kind = "ratio"
            ,ROUND ( _delta * 100, 1 )
        ,ROUND ( _delta / [Sel Units Divisor], [Sel Units Decimals] )
    )
```
Dynamic format:
```dax
SWITCH (
    TRUE ()
    ,ISBLANK ( [Stmt Delta A Raw] )
        ,"""n/a"""
    ,[Stmt Row Kind] = "ratio"
        ,"+0.0"" pp"";−0.0"" pp"";0.0"" pp"""
    ,[Sel Units Decimals] = 0
        ,"+#,##0;−#,##0;0"
    ,"+#,##0.0;−#,##0.0;0.0"
)
```
`Stmt Delta B` (with B) and `Stmt FY Delta` (with `[Stmt FY Delta Raw]`, never switched off) follow the same pattern.

```dax
Stmt Delta Pct A =
VAR _pct          = [Stmt Delta Pct A Raw]
VAR _kind         = [Stmt Row Kind]
RETURN
    SWITCH (
        TRUE ()
        ,NOT [Stmt Row Shown] || [Sel Compare A] = "NONE" || _kind = "ratio"
            ,BLANK ()
        ,ISBLANK ( _pct )
            ,0
        ,ROUND ( _pct, 3 )
    )
```
Dynamic format: `IF ( ISBLANK ( [Stmt Delta Pct A Raw] ), """n/a""", "+0.0%;−0.0%;0.0%" )`. `Stmt Delta Pct B`: same with B.

```dax
Stmt Bar A =
-- the ±15 % bar of Compare A: Δ % clamped to ±0.15 (statement-table.tsx:219-232); none on ratio rows
VAR _pct          = [Stmt Delta Pct A Raw]
RETURN
    IF (
        [Stmt Row Shown]
            && [Sel Compare A] <> "NONE"
            && [Stmt Row Kind] <> "ratio"
            && NOT ISBLANK ( _pct )
        ,MAX ( -0.15, MIN ( 0.15, _pct ) )
    )
```
Format `0.0%`. Rendered as a data bar only (`05-pages.md`).

### 7.5 Conditional-formatting measures

```dax
Stmt Delta A Colour =
-- favourable green / unfavourable orange; no colour when Δ rounds to zero, is n/a, or on the effective tax rate (M-11)
VAR _delta        = [Stmt Delta A Raw]
VAR _kind         = [Stmt Row Kind]
VAR _line         = SELECTEDVALUE ( 'PL Row'[LineCode] )
VAR _zero         =
    IF (
        _kind = "ratio"
        ,ROUND ( ABS ( _delta ) * 100, 1 ) = 0
        ,ROUND ( ABS ( _delta ) / [Sel Units Divisor], [Sel Units Decimals] ) = 0
    )
RETURN
    SWITCH (
        TRUE ()
        ,ISBLANK ( _delta ) || _zero || ( _line = "ETR_PCT" && _kind = "ratio" )
            ,"#101B2B"
        ,_delta > 0
            ,"#06603F"
        ,"#C2410C"
    )
```
`Stmt Delta B Colour` and `Stmt FY Delta Colour`: the same with `[Stmt Delta B Raw]` / `[Stmt FY Delta Raw]`. The Δ %
columns use the colour of their Δ.

```dax
Stmt Row Background =
-- design guide §6.1: key subtotals in the company tint, other subtotals and the memo row in Subtle, the rest white
VAR _kind         = [Stmt Row Kind]
VAR _key          = SELECTEDVALUE ( 'PL Row'[IsKey], FALSE () )
RETURN
    SWITCH (
        TRUE ()
        ,_kind = "subtotal" && _key
            ,[Theme Acc Tint]
        ,_kind IN { "subtotal", "memo" }
            ,"#F6F8FA"
        ,"#FFFFFF"
    )
```

```dax
Stmt Row Font Colour =
IF ( [Stmt Row Kind] = "ratio", "#4F5C6C", "#101B2B" )
```

### 7.6 Statement texts

```dax
Window Label =
-- the statement's first column-group title window (notices.ts:101-118): "YTD Sep 2026", "Sep 2026", "LTM Sep 2026",
-- "Full year 2026", a custom range "Oct 2025 – Sep 2026" or "Mar – Sep 2026"
VAR _tv           = [Sel Time View]
VAR _fy           = [Sel FY]
VAR _anchor       = [Anchor Idx]
VAR _start        = [Range Start Idx]
VAR _at           = LOOKUPVALUE ( 'Dim Month'[MonthLabel], 'Dim Month'[MonthIdx], _anchor )
VAR _first        = MIN ( _start, _anchor )
VAR _last         = MAX ( _start, _anchor )
VAR _first_label  = LOOKUPVALUE ( 'Dim Month'[MonthLabel], 'Dim Month'[MonthIdx], _first )
VAR _first_name   = LOOKUPVALUE ( 'Dim Month'[MonthName], 'Dim Month'[MonthIdx], _first )
VAR _first_fy     = LOOKUPVALUE ( 'Dim Month'[FiscalYear], 'Dim Month'[MonthIdx], _first )
VAR _last_label   = LOOKUPVALUE ( 'Dim Month'[MonthLabel], 'Dim Month'[MonthIdx], _last )
VAR _last_fy      = LOOKUPVALUE ( 'Dim Month'[FiscalYear], 'Dim Month'[MonthIdx], _last )
RETURN
    SWITCH (
        _tv
        ,"RANGE",
            IF (
                _first = _last
                ,_last_label
                ,IF ( _first_fy = _last_fy, _first_name, _first_label ) & " – " & _last_label
            )
        ,"FY", "Full year " & _fy
        ,"MTD", _at
        ,_tv & " " & _at
    )
```

```dax
Stmt Group Titles =
-- the column-group titles of the web table, shown above the matrix (static headers in Power BI)
VAR _base_label   = SWITCH ( [Sel Base], "LE", "Latest estimate", "B", "Budget", "Actual" )
VAR _cmp_a        = SWITCH ( [Sel Compare A], "B", "vs Budget", "LE", "vs Latest estimate", "PY", "vs Prior year", "" )
VAR _cmp_b        = SWITCH ( [Sel Compare B], "B", "vs Budget", "LE", "vs Latest estimate", "PY", "vs Prior year", "" )
RETURN
    [Window Label] & " - " & _base_label
        & IF ( _cmp_a <> "", "   |   Compare A: " & _cmp_a, "" )
        & IF ( _cmp_b <> "", "   |   Compare B: " & _cmp_b, "" )
        & "   |   Full year " & [Sel FY]
```

```dax
Stmt Line Header =
"Line - " & [Sel Currency] & " " & [Sel Units Label]
```

```dax
Stmt Footnote =
-- statement-table.tsx:364-373
VAR _fx           =
    IF (
        [Sel FX Basis] = "CC"
        ,"All versions at FY" & [Sel FY] & " budget rates"
        ,"Actual at monthly average rates, budget at budget rates"
    )
VAR _costs        = IF ( [Sel Cost Multiplier] = -1, "positive", "negative" )
VAR _bar          = SWITCH ( [Sel Compare A], "B", "Budget", "LE", "Latest estimate", "PY", "Prior year", "Compare A" )
RETURN
    _fx & " - costs " & _costs & " - Δ positive when favourable - bar = Δ % vs " & _bar
        & " on a ±15% scale - IFRS 18 required subtotal - MPM management-defined measure - IC intercompany"
```

## 8. Vitals (folder `7 Vitals`; `engine/vitals.ts`, `engine/thresholds.ts`)

Cards are rows of `Vitals Card` (the visual shows one card per row); every measure reads the card in context.
Card face = title · status chip vs Budget · value · two Δ rows (vs Compare A, vs Compare B).

```dax
Vit Card Visible =
VAR _company      = SELECTEDVALUE ( 'Vitals Card'[Company] )
RETURN
    IF ( _company = "ALL" || _company = [Sel Company], 1, 0 )
```
Visual-level filter `Vit Card Visible = 1` on every card visual (L-10: the driver row swaps by company).

```dax
Vit Metric =
SWITCH (
    SELECTEDVALUE ( 'Vitals Card'[CardId] )
    ,"nr", [Net Revenue]
    ,"ebitda", [Adjusted EBITDA]
    ,"op", [Operating Profit]
    ,"gm", [Gross Margin %]
    ,"opex", [Opex % of NR]
    ,"units", [Units Sold]
    ,"nrPerUnit", [NR per Unit]
    ,"gtn", [Gross-to-Net %]
    ,"ap", [A&P % of NR]
    ,"gmv", [GMV Processed]
    ,"merchants", [Active Merchants]
    ,"arr", [ARR Run-Rate]
)
```

```dax
Vit Base =
CALCULATE ( [Vit Metric], 'Plan Column'[Column] = "BASE" )
```

```dax
Vit Cmp A =
IF ( [Sel Compare A] <> "NONE", CALCULATE ( [Vit Metric], 'Plan Column'[Column] = "CMP_A" ) )
```

```dax
Vit Cmp B =
IF ( [Sel Compare B] <> "NONE", CALCULATE ( [Vit Metric], 'Plan Column'[Column] = "CMP_B" ) )
```

```dax
Vit Budget =
CALCULATE ( [Vit Metric], 'Plan Column'[Column] = "BUD" )
```

```dax
Vit Rel A =
-- ratios: Δ in fraction points; amounts, counts, per-unit: Δ ÷ |comparison| (vitals.ts:44-74)
VAR _kind         = SELECTEDVALUE ( 'Vitals Card'[Kind] )
VAR _base         = [Vit Base]
VAR _cmp          = [Vit Cmp A]
RETURN
    SWITCH (
        TRUE ()
        ,ISBLANK ( _base ) || ISBLANK ( _cmp )
            ,BLANK ()
        ,_kind = "ratio"
            ,_base - _cmp
        ,_cmp = 0
            ,BLANK ()
        ,( _base - _cmp ) / ABS ( _cmp )
    )
```
`Vit Rel B`: the same with `[Vit Cmp B]`.

```dax
Vit Status Code =
-- the chip: vs Budget only, whatever Compare A / B are (thresholds.ts:26-41):
-- on track within ±1 % (amounts) / ±0.3 pp (ratios), watch to 3 % / 1 pp, off track beyond, ahead when better;
-- "Lower" inverts; neutral KPIs have none. FY card: FY LE NR vs FY Budget NR, amount, Higher.
VAR _card         = SELECTEDVALUE ( 'Vitals Card'[CardId] )
VAR _kind         = SELECTEDVALUE ( 'Vitals Card'[Kind] )
VAR _better       = SELECTEDVALUE ( 'Vitals Card'[Better] )
VAR _base         = IF ( _card = "fy", [FY NR LE], [Vit Base] )
VAR _bud          = IF ( _card = "fy", [FY NR Budget], [Vit Budget] )
VAR _delta        =
    SWITCH (
        TRUE ()
        ,ISBLANK ( _base ) || ISBLANK ( _bud )
            ,BLANK ()
        ,_kind = "ratio"
            ,_base - _bud
        ,_bud = 0
            ,BLANK ()
        ,( _base - _bud ) / ABS ( _bud )
    )
VAR _dir          = IF ( _better = "Lower", - _delta, _delta )
VAR _watch        = IF ( _kind = "ratio", 0.003, 0.01 )
VAR _off          = IF ( _kind = "ratio", 0.01, 0.03 )
RETURN
    SWITCH (
        TRUE ()
        ,_better = "Neutral" || ISBLANK ( _delta )
            ,BLANK ()
        ,ABS ( _dir ) <= _watch
            ,"onTrack"
        ,_dir > 0
            ,"ahead"
        ,ABS ( _dir ) <= _off
            ,"watch"
        ,"off"
    )
```

```dax
Vit Status Text =
SWITCH ( [Vit Status Code], "onTrack", "on track", "watch", "watch", "off", "off track", "ahead", "ahead" )
```

```dax
Vit Status Colour =
SWITCH ( [Vit Status Code], "watch", "#8A5A00", "off", "#C2410C", "ahead", "#06603F", "#101B2B" )
```

```dax
Vit Status Background =
SWITCH ( [Vit Status Code], "watch", "#FBF4E4", "off", "#FCEDE5", "ahead", "#E4F3EC", "#EDF0F3" )
```

```dax
Vit Value Text =
-- the card value as the web formats it (view-context.ts:195-211, vitals.ts:285-455)
VAR _card         = SELECTEDVALUE ( 'Vitals Card'[CardId] )
VAR _kind         = SELECTEDVALUE ( 'Vitals Card'[Kind] )
VAR _value        = IF ( _card = "fy", [FY NR LE], [Vit Base] )
VAR _sym          = [Sel Currency Symbol]
VAR _div          = [Sel Units Divisor]
VAR _dec          = [Sel Units Decimals]
VAR _body         = FORMAT ( ABS ( _value ) / _div, IF ( _dec = 0, "#,##0", "#,##0.0" ) )
VAR _sign         = IF ( _value < 0 && ROUND ( ABS ( _value ) / _div, _dec ) <> 0, "−", "" )
VAR _sub          = CALCULATE ( [Subscriptions Share of NR], 'Plan Column'[Column] = "BASE" )
VAR _pay          = CALCULATE ( [Payments Share of NR], 'Plan Column'[Column] = "BASE" )
RETURN
    SWITCH (
        TRUE ()
        ,_card = "mix"
            ,IF ( ISBLANK ( _sub ), "n/a", FORMAT ( ROUND ( _sub, 3 ), "0.0%" ) )
                & " / "
                & IF ( ISBLANK ( _pay ), "n/a", FORMAT ( ROUND ( _pay, 3 ), "0.0%" ) )
        ,ISBLANK ( _value )
            ,"n/a"
        ,_kind IN { "amount", "fy" }
            ,_sign & _sym & _body & " " & [Sel Units Label]
        ,_kind = "ratio"
            ,SUBSTITUTE ( FORMAT ( ROUND ( _value, 3 ), "0.0%" ), "-", "−" )
        ,_kind = "count"
            ,FORMAT ( _value, "#,##0" )
        ,IF ( _value < 0, "−", "" ) & _sym & FORMAT ( ABS ( _value ), "#,##0.00" )
    )
```

```dax
Vit Row A Label =
VAR _card         = SELECTEDVALUE ( 'Vitals Card'[CardId] )
RETURN
    SWITCH (
        TRUE ()
        ,_card = "fy"
            ,"vs FY Budget"
        ,_card = "mix"
            ,"Sub / Pay vs PY"
        ,[Sel Compare A] = "NONE"
            ,BLANK ()
        ,"vs " & SWITCH ( [Sel Compare A], "B", "Budget", "LE", "Latest estimate", "Prior year" )
    )
```
`Vit Row B Label`: fy → "EBITDA vs FY Bud"; mix → BLANK; Compare B = NONE → BLANK; else "vs " & name of Compare B.

```dax
Vit Row A Abs =
-- the Δ magnitude with its sign, number only (no symbol or unit): "−66.3", "+15,618,120", "−0.02"; none for ratios
-- and when the row reads "on plan" (vitals.ts:44-80, 276-280)
VAR _card         = SELECTEDVALUE ( 'Vitals Card'[CardId] )
VAR _kind         = SELECTEDVALUE ( 'Vitals Card'[Kind] )
VAR _div          = [Sel Units Divisor]
VAR _dec          = [Sel Units Decimals]
VAR _base         = IF ( _card = "fy", [FY NR LE], [Vit Base] )
VAR _cmp          = IF ( _card = "fy", [FY NR Budget], [Vit Cmp A] )
VAR _delta        = _base - _cmp
VAR _rel          = IF ( _card = "fy", DIVIDE ( _delta, ABS ( _cmp ) ), [Vit Rel A] )
VAR _on_plan      = _card <> "fy" && NOT ISBLANK ( _rel ) && ABS ( _rel ) < 0.0005
VAR _text         =
    SWITCH (
        TRUE ()
        ,_kind IN { "amount", "fy" }
            ,FORMAT ( ABS ( _delta ) / _div, IF ( _dec = 0, "#,##0", "#,##0.0" ) )
        ,_kind = "count"
            ,FORMAT ( ABS ( _delta ), "#,##0" )
        ,FORMAT ( ABS ( _delta ), "#,##0.00" )
    )
VAR _is_zero      = SUBSTITUTE ( SUBSTITUTE ( SUBSTITUTE ( _text, "0", "" ), ",", "" ), ".", "" ) = ""
RETURN
    SWITCH (
        TRUE ()
        ,_card = "mix" || _kind = "ratio" || _on_plan || ISBLANK ( _base ) || ISBLANK ( _cmp )
            ,BLANK ()
        ,_is_zero
            ,_text
        ,IF ( _delta > 0, "+", "−" ) & _text
    )
```
`Vit Row B Abs`: the same with `[Vit Cmp B]` / `[Vit Rel B]`, and for the fy card `[FY EBITDA LE]` − `[FY EBITDA Budget]`.
(`_is_zero` = the formatted magnitude has no digit 1–9, `vitals.ts:78`.)

```dax
Vit Row A Rel =
-- "+1.4%", "−0.4 pp", "on plan", "n/a" (vitals.ts:44-74); mix: "−1.5 pp / +2.7 pp" vs prior year
VAR _card         = SELECTEDVALUE ( 'Vitals Card'[CardId] )
VAR _kind         = SELECTEDVALUE ( 'Vitals Card'[Kind] )
VAR _rel          =
    IF ( _card = "fy", DIVIDE ( [FY NR LE] - [FY NR Budget], ABS ( [FY NR Budget] ) ), [Vit Rel A] )
VAR _sub_now      = CALCULATE ( [Subscriptions Share of NR], 'Plan Column'[Column] = "BASE" )
VAR _sub_py       = CALCULATE ( [Subscriptions Share of NR], 'Plan Column'[Column] = "PY" )
VAR _pay_now      = CALCULATE ( [Payments Share of NR], 'Plan Column'[Column] = "BASE" )
VAR _pay_py       = CALCULATE ( [Payments Share of NR], 'Plan Column'[Column] = "PY" )
VAR _pp_sub       =
    IF ( ISBLANK ( _sub_now ) || ISBLANK ( _sub_py ), "n/a",
        FORMAT ( ROUND ( ( _sub_now - _sub_py ) * 100, 1 ), "+0.0;−0.0;0.0" ) & " pp" )
VAR _pp_pay       =
    IF ( ISBLANK ( _pay_now ) || ISBLANK ( _pay_py ), "n/a",
        FORMAT ( ROUND ( ( _pay_now - _pay_py ) * 100, 1 ), "+0.0;−0.0;0.0" ) & " pp" )
RETURN
    SWITCH (
        TRUE ()
        ,_card = "mix"
            ,_pp_sub & " / " & _pp_pay
        ,_card <> "fy" && [Sel Compare A] = "NONE"
            ,BLANK ()
        ,ISBLANK ( _rel )
            ,"n/a"
        ,_card <> "fy" && ABS ( _rel ) < 0.0005
            ,"on plan"
        ,_kind = "ratio"
            ,FORMAT ( ROUND ( _rel * 100, 1 ), "+0.0;−0.0;0.0" ) & " pp"
        ,FORMAT ( ROUND ( _rel, 3 ), "+0.0%;−0.0%;0.0%" )
    )
```
`Vit Row B Rel`: the same with `[Vit Rel B]` (fy card: EBITDA LE vs EBITDA Budget; mix: BLANK).

```dax
Vit Row A Colour =
-- colour only on a Budget row (build-brief §0): ahead green, on track grey, watch / off track orange; other rows ink.
-- FY card rows are vs Budget by definition and always coloured (vitals.ts:545-561).
VAR _card         = SELECTEDVALUE ( 'Vitals Card'[CardId] )
VAR _kind         = SELECTEDVALUE ( 'Vitals Card'[Kind] )
VAR _better       = SELECTEDVALUE ( 'Vitals Card'[Better] )
VAR _is_budget    = _card = "fy" || [Sel Compare A] = "B"
VAR _rel          =
    IF ( _card = "fy", DIVIDE ( [FY NR LE] - [FY NR Budget], ABS ( [FY NR Budget] ) ), [Vit Rel A] )
VAR _dir          = IF ( _better = "Lower", - _rel, _rel )
VAR _watch        = IF ( _kind = "ratio", 0.003, 0.01 )
VAR _off          = IF ( _kind = "ratio", 0.01, 0.03 )
RETURN
    SWITCH (
        TRUE ()
        ,_card = "mix" || NOT _is_budget || _better = "Neutral" || ISBLANK ( _rel )
            ,"#101B2B"
        ,ABS ( _dir ) <= _watch
            ,"#4F5C6C"
        ,_dir > 0
            ,"#06603F"
        ,"#C2410C"
    )
```
`Vit Row B Colour`: the same with `[Sel Compare B] = "B"` and `[Vit Rel B]` (fy card: EBITDA rel).

```dax
Vit Info Values =
-- the ⓘ values of each card, one per line (vitals.ts:165-582)
VAR _card         = SELECTEDVALUE ( 'Vitals Card'[CardId] )
VAR _lf           = UNICHAR ( 10 )
VAR _pct          = "+0.0%;−0.0%;0.0%"
VAR _nr           = CALCULATE ( [Net Revenue], 'Plan Column'[Column] = "BASE" )
VAR _margin       = CALCULATE ( [Adjusted EBITDA Margin %], 'Plan Column'[Column] = "BASE" )
VAR _organic      = [NR Growth Organic]
RETURN
    SWITCH (
        _card
        ,"nr",
            "Organic growth vs PY (constant currency): " & FORMAT ( ROUND ( _organic, 3 ), _pct ) & _lf
                & "Reported growth vs PY: " & FORMAT ( ROUND ( [NR Growth Reported], 3 ), _pct )
        ,"ebitda",
            "Margin: " & FORMAT ( _margin, "0.0%" )
                & IF (
                    [Sel Company] = "S"
                    ,_lf & "Rule of 40 (organic growth + margin): "
                        & IF ( ISBLANK ( _organic ) || ISBLANK ( _margin ), "n/a", FORMAT ( _organic + _margin, "0.0%" ) )
                    ,""
                )
        ,"op",
            "Margin: " & FORMAT ( CALCULATE ( [Operating Margin %], 'Plan Column'[Column] = "BASE" ), "0.0%" ) & _lf
                & "Net margin: " & FORMAT ( CALCULATE ( [Net Margin %], 'Plan Column'[Column] = "BASE" ), "0.0%" )
        ,"fy",
            "Revenue attainment: " & FORMAT ( [FY NR Attainment], "0.0%" ) & _lf
                & "EBITDA attainment: " & FORMAT ( [FY EBITDA Attainment], "0.0%" )
        ,BLANK ()
    )
```
The other cards' ⓘ values (money and pp texts) are listed in `05-pages.md` §3.4 with the measures they read; add them to
this SWITCH in the same pattern.

## 9. Analysis (folder `8 Analysis`; `engine/analysis.ts`)

### 9.1 Largest variances (C-45; `analysis.ts:385-529`)

Rows: `Dim Account` leaves of blocks GR, GTN, COR, VSC, SM, RD, GA, OOI, DA, ADJ (down to operating profit), of the
company shown, with data in the base or the comparison. Comparison = the bridge comparison. The four slicers of the
funnel filter (`Dim Region`, `Dim Channel`, `Dim Line`, `Dim Segment`) cut the rows; below-CM lines are then the
allocated amounts (C-31). A member of the other company (left over after a company switch) is ignored, as the web
drops it (`analysis.ts:373-383`).

```dax
LV Amt =
-- [Amt] under the variance filter, ignoring stale channel / line / segment members of the other company
VAR _co           = [Sel Company]
VAR _ch_valid     = CALCULATETABLE ( VALUES ( 'Dim Channel'[ChannelCode] ), 'Dim Channel'[EntityCode] = _co )
VAR _ln_valid     = CALCULATETABLE ( VALUES ( 'Dim Line'[LineCode] ), 'Dim Line'[EntityCode] = _co )
VAR _sg_valid     = CALCULATETABLE ( VALUES ( 'Dim Segment'[SegmentCode] ), 'Dim Segment'[EntityCode] = _co )
VAR _ch           =
    FILTER (
        ALL ( 'Dim Channel'[ChannelCode] )
        ,ISEMPTY ( _ch_valid ) || 'Dim Channel'[ChannelCode] IN _ch_valid
    )
VAR _ln           =
    FILTER (
        ALL ( 'Dim Line'[LineCode] )
        ,ISEMPTY ( _ln_valid ) || 'Dim Line'[LineCode] IN _ln_valid
    )
VAR _sg           =
    FILTER (
        ALL ( 'Dim Segment'[SegmentCode] )
        ,ISEMPTY ( _sg_valid ) || 'Dim Segment'[SegmentCode] IN _sg_valid
    )
RETURN
    CALCULATE (
        [Amt]
        ,REMOVEFILTERS ( 'Dim Channel' )
        ,REMOVEFILTERS ( 'Dim Line' )
        ,REMOVEFILTERS ( 'Dim Segment' )
        ,_ch
        ,_ln
        ,_sg
        ,KEEPFILTERS ( 'Dim Account'[BlockCode] IN { "GR", "GTN", "COR", "VSC", "SM", "RD", "GA", "OOI", "DA", "ADJ" } )
    )
```

```dax
LV Base =
CALCULATE ( [LV Amt], 'Plan Column'[Column] = "BASE" )
```

```dax
LV Cmp =
CALCULATE ( [LV Amt], 'Plan Column'[Column] = "BRIDGE" )
```

```dax
LV Delta =
[LV Base] - [LV Cmp]
```

```dax
LV Abs Delta =
ABS ( [LV Delta] )
```
Sort the table by this column, descending (`analysis.ts:467`).

```dax
LV Delta CC =
CALCULATE ( [LV Base] - [LV Cmp], 'FX Override'[Basis] = "CC" )
```

```dax
LV FX =
-- of which FX = (actual − actual cc) − (comparison − comparison cc) (analysis.ts:449)
[LV Delta] - [LV Delta CC]
```

```dax
LV Cmp B Delta =
-- the second comparison column = Compare B; dropped when Compare B = None; "n/a" when it has no data
VAR _cmp_b        = CALCULATE ( [LV Amt], 'Plan Column'[Column] = "CMP_B" )
RETURN
    IF ( [Sel Compare B] = "NONE" || ISBLANK ( _cmp_b ), BLANK (), [LV Base] - _cmp_b )
```

```dax
LV Show =
-- leaf of the company with data in base or comparison (a line with nothing in either is hidden, PV-12)
VAR _scope        = SELECTEDVALUE ( 'Dim Account'[EntityScope] )
VAR _co           = [Sel Company]
VAR _in_scope     = _scope = "BOTH" || _scope = _co
VAR _block_ok     = SELECTEDVALUE ( 'Dim Account'[BlockCode] ) IN { "GR", "GTN", "COR", "VSC", "SM", "RD", "GA", "OOI", "DA", "ADJ" }
VAR _base         = [LV Base]
VAR _cmp          = [LV Cmp]
RETURN
    IF ( _in_scope && _block_ok && ( _base <> 0 || _cmp <> 0 ), 1, 0 )
```
Visual-level filter `LV Show = 1`.

```dax
LV Slice Active =
-- a valid channel / line / segment member is selected (region alone allocates nothing)
VAR _co           = [Sel Company]
VAR _ch_n         = CALCULATE ( COUNTROWS ( 'Dim Channel' ), 'Dim Channel'[EntityCode] = _co, 'Dim Channel'[IsUnassigned] = FALSE () )
VAR _ln_n         = CALCULATE ( COUNTROWS ( 'Dim Line' ), 'Dim Line'[EntityCode] = _co, 'Dim Line'[IsUnassigned] = FALSE () )
VAR _sg_n         = CALCULATE ( COUNTROWS ( 'Dim Segment' ), 'Dim Segment'[EntityCode] = _co, 'Dim Segment'[IsUnassigned] = FALSE () )
VAR _ch_all       = CALCULATE ( COUNTROWS ( 'Dim Channel' ), REMOVEFILTERS ( 'Dim Channel' ), 'Dim Channel'[EntityCode] = _co, 'Dim Channel'[IsUnassigned] = FALSE () )
VAR _ln_all       = CALCULATE ( COUNTROWS ( 'Dim Line' ), REMOVEFILTERS ( 'Dim Line' ), 'Dim Line'[EntityCode] = _co, 'Dim Line'[IsUnassigned] = FALSE () )
VAR _sg_all       = CALCULATE ( COUNTROWS ( 'Dim Segment' ), REMOVEFILTERS ( 'Dim Segment' ), 'Dim Segment'[EntityCode] = _co, 'Dim Segment'[IsUnassigned] = FALSE () )
RETURN
    ( _ch_n > 0 && _ch_n < _ch_all )
        || ( _ln_n > 0 && _ln_n < _ln_all )
        || ( _sg_n > 0 && _sg_n < _sg_all )
```

```dax
LV Alloc =
-- below CM under a channel / line / segment filter: allocated by NR share, row in grey italic with "alloc."
IF (
    [LV Slice Active] && SELECTEDVALUE ( 'Dim Account'[IsBelowCM], FALSE () )
    ,"alloc."
)
```

```dax
LV Row Font Colour =
IF ( NOT ISBLANK ( [LV Alloc] ), "#4F5C6C", "#101B2B" )
```

```dax
LV Scale =
-- max |Δ| over every shown leaf: one bar scale for the table (analysis.ts:505)
CALCULATE (
    MAXX (
        VALUES ( 'Dim Account'[AccountCode] )
        ,IF ( [LV Show] = 1, [LV Abs Delta] )
    )
    ,ALLSELECTED ( 'Dim Account' )
)
```

```dax
LV Delta Bar =
-- the diverging bar: Δ ÷ scale, capped to ±1 (data bars min −1, max 1)
VAR _scale        = [LV Scale]
RETURN
    IF ( _scale > 0, MAX ( -1, MIN ( 1, [LV Delta] / _scale ) ) )
```

```dax
LV Money Base =
-- "$4,302.4 m" (money, view-context.ts:195-206)
VAR _value        = [LV Base]
VAR _div          = [Sel Units Divisor]
VAR _dec          = [Sel Units Decimals]
VAR _zero         = ROUND ( ABS ( _value ) / _div, _dec ) = 0
RETURN
    IF ( _value < 0 && NOT _zero, "−", "" ) & [Sel Currency Symbol]
        & FORMAT ( ABS ( _value ) / _div, IF ( _dec = 0, "#,##0", "#,##0.0" ) ) & " " & [Sel Units Label]
```
`LV Money Cmp`: the same with `[LV Cmp]`.

```dax
LV Money Delta =
-- signed money: "+$18.3 m", "−$69.5 m", "$0.0 m" when it rounds to zero
VAR _value        = [LV Delta]
VAR _div          = [Sel Units Divisor]
VAR _dec          = [Sel Units Decimals]
VAR _zero         = ROUND ( ABS ( _value ) / _div, _dec ) = 0
RETURN
    IF ( _zero, "", IF ( _value < 0, "−", "+" ) ) & [Sel Currency Symbol]
        & FORMAT ( ABS ( _value ) / _div, IF ( _dec = 0, "#,##0", "#,##0.0" ) ) & " " & [Sel Units Label]
```
`LV Money FX` and `LV Money Cmp B Delta` (BLANK when `[LV Cmp B Delta]` is blank and Compare B is on → "n/a"): the same
pattern with `[LV FX]` / `[LV Cmp B Delta]`.

```dax
LV Delta Pct Text =
-- n.m. when |comparison| < 2.0 display units or |Δ %| > 50 % (spec Analysis 6.2; analysis.ts:414-420)
VAR _cmp          = [LV Cmp]
VAR _delta        = [LV Delta]
VAR _ratio        = DIVIDE ( _delta, ABS ( _cmp ) )
RETURN
    SWITCH (
        TRUE ()
        ,ABS ( _cmp ) < 2 * [Sel Units Divisor]
            ,"n.m."
        ,ABS ( _ratio ) > 0.5
            ,"n.m."
        ,FORMAT ( ROUND ( _ratio, 3 ), "+0.0%;−0.0%;0.0%" )
    )
```

```dax
LV Tone Colour =
-- grey when Δ shows as zero, green when it helps profit, orange when it hurts (analysis.ts:421-424)
VAR _delta        = [LV Delta]
VAR _zero         = ABS ( _delta ) < 0.5 * POWER ( 10, - [Sel Units Decimals] ) * [Sel Units Divisor]
RETURN
    SWITCH ( TRUE (), _zero, "#4F5C6C", _delta > 0, "#06603F", "#C2410C" )
```

```dax
LV Pct Colour =
IF ( [LV Delta Pct Text] = "n.m.", "#8592A3", [LV Tone Colour] )
```

```dax
LV Title =
"Largest variances vs " & [Bridge Cmp Name]
```

```dax
LV Cmp Header =
[Bridge Cmp Name]
```

```dax
LV Cmp B Header =
SWITCH ( [Sel Compare B], "B", "vs Budget", "LE", "vs LE", "PY", "vs PY", "" )
```

```dax
LV Filter Text =
-- the applied members, " · "-joined in dimension order; blank without a filter (analysis.ts:492-495)
VAR _co           = [Sel Company]
VAR _region       =
    IF (
        ISFILTERED ( 'Dim Region' ) && COUNTROWS ( VALUES ( 'Dim Region'[RegionCode] ) ) < 4
        ,CONCATENATEX ( VALUES ( 'Dim Region'[RegionName] ), 'Dim Region'[RegionName], ", " )
    )
VAR _channel      =
    IF (
        [LV Slice Active] && ISFILTERED ( 'Dim Channel' )
        ,CONCATENATEX ( FILTER ( VALUES ( 'Dim Channel'[ChannelName] ), CALCULATE ( MAX ( 'Dim Channel'[EntityCode] ) ) = _co ), 'Dim Channel'[ChannelName], ", " )
    )
VAR _line         =
    IF (
        [LV Slice Active] && ISFILTERED ( 'Dim Line' )
        ,CONCATENATEX ( FILTER ( VALUES ( 'Dim Line'[LineName] ), CALCULATE ( MAX ( 'Dim Line'[EntityCode] ) ) = _co ), 'Dim Line'[LineName], ", " )
    )
VAR _segment      =
    IF (
        [LV Slice Active] && ISFILTERED ( 'Dim Segment' )
        ,CONCATENATEX ( FILTER ( VALUES ( 'Dim Segment'[SegmentName] ), CALCULATE ( MAX ( 'Dim Segment'[EntityCode] ) ) = _co ), 'Dim Segment'[SegmentName], ", " )
    )
VAR _parts        =
    _region
        & IF ( _region <> "" && _channel <> "", " · ", "" ) & _channel
VAR _parts_2      =
    _parts
        & IF ( _parts <> "" && _line <> "", " · ", "" ) & _line
VAR _parts_3      =
    _parts_2
        & IF ( _parts_2 <> "" && _segment <> "", " · ", "" ) & _segment
RETURN
    IF ( _parts_3 = "", BLANK (), _parts_3 )
```

```dax
LV Filter Count =
-- the number on the funnel button
VAR _region       = IF ( ISFILTERED ( 'Dim Region' ) && COUNTROWS ( VALUES ( 'Dim Region'[RegionCode] ) ) < 4, 1, 0 )
VAR _others       = IF ( [LV Slice Active], 1, 0 )
RETURN
    IF ( _region + _others > 0, _region + _others )
```

```dax
LV Empty Text =
-- the empty state of the table (analysis-view.tsx:212-218)
IF (
    COUNTROWS ( FILTER ( VALUES ( 'Dim Account'[AccountCode] ), [LV Show] = 1 ) ) = 0
    ,"Nothing is booked for this combination."
)
```

```dax
Slot Label Channel =
CALCULATE ( MAX ( 'Dim Channel'[SlotLabel] ), REMOVEFILTERS ( 'Dim Channel' ), 'Dim Channel'[EntityCode] = [Sel Company] )
```
`Slot Label Line` ("Category" / "Service line") and `Slot Label Segment` ("Price tier" / "Customer segment"): same pattern.

```dax
Slicer Member Visible =
-- visual-level filter of the channel / line / segment slicers: members of the company shown, unassigned excluded
VAR _co           = [Sel Company]
RETURN
    IF (
        CALCULATE ( COUNTROWS ( 'Dim Channel' ), 'Dim Channel'[EntityCode] = _co, 'Dim Channel'[IsUnassigned] = FALSE () ) > 0
        ,1
        ,0
    )
```
(`Slicer Member Visible Line` / `Segment`: the same on `Dim Line` / `Dim Segment`.)

### 9.2 Net revenue bridge (C-40; `analysis.ts:70-185`)

```dax
Br NR Start =
-- comparison NR at the selected basis
COALESCE ( CALCULATE ( [Net Revenue], 'Plan Column'[Column] = "BRIDGE" ), 0 )
```

```dax
Br NR End =
COALESCE ( CALCULATE ( [Net Revenue], 'Plan Column'[Column] = "BASE" ), 0 )
```

```dax
Br NR CC Base =
COALESCE ( CALCULATE ( [Net Revenue], 'Plan Column'[Column] = "BASE", 'FX Override'[Basis] = "CC" ), 0 )
```

```dax
Br NR CC Cmp =
COALESCE ( CALCULATE ( [Net Revenue], 'Plan Column'[Column] = "BRIDGE", 'FX Override'[Basis] = "CC" ), 0 )
```

```dax
Br NR Volume =
-- Consumer Products: Σ over lowest slices k (region × channel × category × tier) of (U − Ucmp) × NRcc,cmp ÷ Ucmp;
-- a slice without comparison units counts entirely as volume (NRcc − NRcc,cmp)
VAR _co           = [Sel Company]
VAR _tuples       =
    CALCULATETABLE (
        SUMMARIZE (
            'Fact PL'
            ,'Dim Region'[RegionCode]
            ,'Dim Channel'[ChannelCode]
            ,'Dim Line'[LineCode]
            ,'Dim Segment'[SegmentCode]
        )
        ,'Dim Entity'[EntityCode] = _co
        ,'Dim Account'[BlockCode] IN { "GR", "GTN" }
    )
RETURN
    IF (
        _co = "P"
        ,SUMX (
            _tuples
            ,VAR _nr_base     = COALESCE ( CALCULATE ( [Net Revenue], 'Plan Column'[Column] = "BASE", 'FX Override'[Basis] = "CC" ), 0 )
             VAR _nr_cmp      = COALESCE ( CALCULATE ( [Net Revenue], 'Plan Column'[Column] = "BRIDGE", 'FX Override'[Basis] = "CC" ), 0 )
             VAR _u_base      = COALESCE ( CALCULATE ( [Units Raw], 'Plan Column'[Column] = "BASE" ), 0 )
             VAR _u_cmp       = COALESCE ( CALCULATE ( [Units Raw], 'Plan Column'[Column] = "BRIDGE" ), 0 )
             RETURN
                IF ( _u_cmp > 0, ( _u_base - _u_cmp ) * _nr_cmp / _u_cmp, _nr_base - _nr_cmp )
        )
    )
```
Performance note: up to 300 tuples × 4 evaluations. If a filter change takes longer than ~2 s (N-01), materialise the
per-tuple NR in local currency and multiply by the region's CC factor inside the iterator (one storage-engine query).

```dax
Br NR Price Mix =
-- price / mix = CC change − volume, so the steps add up exactly (T-05)
[Br NR CC Base] - [Br NR CC Cmp] - [Br NR Volume]
```

```dax
Br NR Line Step =
-- Commerce Cloud: one step per service line = NRcc base − NRcc comparison of the line
VAR _line         =
    SWITCH ( SELECTEDVALUE ( 'Bridge Step'[StepId] ), "NR_SUB", "SUB", "NR_PAY", "PAY", "NR_APP", "APP", "NR_PS", "PS" )
RETURN
    CALCULATE ( [Br NR CC Base] - [Br NR CC Cmp], 'Dim Line'[LineCode] = _line )
```

```dax
Br NR Line Stream =
-- the line's comparison NR at the selected basis (the step's % label base)
VAR _line         =
    SWITCH ( SELECTEDVALUE ( 'Bridge Step'[StepId] ), "NR_SUB", "SUB", "NR_PAY", "PAY", "NR_APP", "APP", "NR_PS", "PS" )
RETURN
    CALCULATE ( [Br NR Start], 'Dim Line'[LineCode] = _line )
```

```dax
Br NR CC Subtotal =
[Br NR Start] + ( [Br NR CC Base] - [Br NR CC Cmp] )
```

```dax
Br NR FX =
-- FX = (NR − NRcc) base − (NR − NRcc) comparison; zero at constant currency (T-10)
( [Br NR End] - [Br NR CC Base] ) - ( [Br NR Start] - [Br NR CC Cmp] )
```

### 9.3 Profit bridge (`analysis.ts:189-305`)

```dax
Br PR Start =
COALESCE ( CALCULATE ( [Adjusted EBITDA], 'Plan Column'[Column] = "BRIDGE" ), 0 )
```

```dax
Br PR EBITDA =
COALESCE ( CALCULATE ( [Adjusted EBITDA], 'Plan Column'[Column] = "BASE" ), 0 )
```

```dax
Br PR Volume =
-- revenue volume = ΔNRcc × comparison GM %cc
VAR _nr_a         = [Br NR CC Base]
VAR _nr_b         = [Br NR CC Cmp]
VAR _gp_b         = COALESCE ( CALCULATE ( [Gross Profit], 'Plan Column'[Column] = "BRIDGE", 'FX Override'[Basis] = "CC" ), 0 )
VAR _gm_b         = IF ( _nr_b = 0, 0, _gp_b / _nr_b )
RETURN
    ( _nr_a - _nr_b ) * _gm_b
```

```dax
Br PR Mix =
-- GM mix = Σ lines (NR_A,l − NR_A × NR_B,l ÷ NR_B) × GM %_B,l (category / service line; at CC)
VAR _co           = [Sel Company]
VAR _nr_a         = [Br NR CC Base]
VAR _nr_b         = [Br NR CC Cmp]
VAR _lines        =
    CALCULATETABLE (
        VALUES ( 'Dim Line'[LineCode] )
        ,REMOVEFILTERS ( 'Dim Line' )
        ,'Dim Line'[EntityCode] = _co
        ,'Dim Line'[IsUnassigned] = FALSE ()
    )
RETURN
    SUMX (
        _lines
        ,VAR _code        = 'Dim Line'[LineCode]
         VAR _nr_a_l      = COALESCE ( CALCULATE ( [Br NR CC Base], 'Dim Line'[LineCode] = _code ), 0 )
         VAR _nr_b_l      = COALESCE ( CALCULATE ( [Br NR CC Cmp], 'Dim Line'[LineCode] = _code ), 0 )
         VAR _gp_a_l      = COALESCE ( CALCULATE ( [Gross Profit], 'Plan Column'[Column] = "BASE", 'FX Override'[Basis] = "CC", 'Dim Line'[LineCode] = _code ), 0 )
         VAR _gp_b_l      = COALESCE ( CALCULATE ( [Gross Profit], 'Plan Column'[Column] = "BRIDGE", 'FX Override'[Basis] = "CC", 'Dim Line'[LineCode] = _code ), 0 )
         VAR _gm_b_l      =
            SWITCH (
                TRUE ()
                ,_nr_b_l <> 0
                    ,_gp_b_l / _nr_b_l
                ,_nr_a_l <> 0
                    ,_gp_a_l / _nr_a_l
                ,0
            )
         RETURN
            ( _nr_a_l - IF ( _nr_b = 0, 0, _nr_a * _nr_b_l / _nr_b ) ) * _gm_b_l
    )
```

```dax
Br PR Rate =
-- GM rate = ΔGPcc − volume − mix (the remainder, so the steps add up)
VAR _gp_a         = COALESCE ( CALCULATE ( [Gross Profit], 'Plan Column'[Column] = "BASE", 'FX Override'[Basis] = "CC" ), 0 )
VAR _gp_b         = COALESCE ( CALCULATE ( [Gross Profit], 'Plan Column'[Column] = "BRIDGE", 'FX Override'[Basis] = "CC" ), 0 )
RETURN
    _gp_a - _gp_b - [Br PR Volume] - [Br PR Mix]
```

```dax
Br PR Block Step =
-- Variable selling, S&M, R&D, G&A, Other operating: block at CC, base − comparison
VAR _block        =
    SWITCH (
        SELECTEDVALUE ( 'Bridge Step'[StepId] )
        ,"PR_VSC", "VSC"
        ,"PR_SM", "SM"
        ,"PR_RD", "RD"
        ,"PR_GA", "GA"
        ,"PR_OOI", "OOI"
    )
VAR _a            = COALESCE ( CALCULATE ( [Amt], 'Plan Column'[Column] = "BASE", 'FX Override'[Basis] = "CC", 'Dim Account'[BlockCode] = _block ), 0 )
VAR _b            = COALESCE ( CALCULATE ( [Amt], 'Plan Column'[Column] = "BRIDGE", 'FX Override'[Basis] = "CC", 'Dim Account'[BlockCode] = _block ), 0 )
RETURN
    _a - _b
```

```dax
Br PR FX =
-- FX = (E − Ecc) base − (E − Ecc) comparison
VAR _e_cc_a       = COALESCE ( CALCULATE ( [Adjusted EBITDA], 'Plan Column'[Column] = "BASE", 'FX Override'[Basis] = "CC" ), 0 )
VAR _e_cc_b       = COALESCE ( CALCULATE ( [Adjusted EBITDA], 'Plan Column'[Column] = "BRIDGE", 'FX Override'[Basis] = "CC" ), 0 )
RETURN
    ( [Br PR EBITDA] - _e_cc_a ) - ( [Br PR Start] - _e_cc_b )
```

```dax
Br PR DA =
COALESCE ( CALCULATE ( [D&A], 'Plan Column'[Column] = "BASE" ), 0 )
```

```dax
Br PR ADJ =
COALESCE ( CALCULATE ( [Adjusting Items], 'Plan Column'[Column] = "BASE" ), 0 )
```

```dax
Br PR OP =
COALESCE ( CALCULATE ( [Operating Profit], 'Plan Column'[Column] = "BASE" ), 0 )
```

### 9.4 Bridge chart plumbing (stacked column with an invisible base)

```dax
Br Visible =
VAR _company      = SELECTEDVALUE ( 'Bridge Step'[Company] )
VAR _cmp          = SELECTEDVALUE ( 'Bridge Step'[Cmp] )
RETURN
    IF (
        ( _company = "ALL" || _company = [Sel Company] )
            && ( _cmp = "ALL" || _cmp = [Bridge Cmp Code] )
        ,1
        ,0
    )
```
Visual-level filter `Br Visible = 1`.

```dax
Br Value =
-- start / subtotal / end / level: the level; change / fx: the signed change
SWITCH (
    SELECTEDVALUE ( 'Bridge Step'[StepId] )
    ,"NR_START_B", [Br NR Start]
    ,"NR_START_LE", [Br NR Start]
    ,"NR_START_PY", [Br NR Start]
    ,"NR_VOL", [Br NR Volume]
    ,"NR_PRICE", [Br NR Price Mix]
    ,"NR_SUB", [Br NR Line Step]
    ,"NR_PAY", [Br NR Line Step]
    ,"NR_APP", [Br NR Line Step]
    ,"NR_PS", [Br NR Line Step]
    ,"NR_CC", [Br NR CC Subtotal]
    ,"NR_FX", [Br NR FX]
    ,"NR_END", [Br NR End]
    ,"PR_START_B", [Br PR Start]
    ,"PR_START_LE", [Br PR Start]
    ,"PR_START_PY", [Br PR Start]
    ,"PR_VOL", [Br PR Volume]
    ,"PR_RATE", [Br PR Rate]
    ,"PR_MIX", [Br PR Mix]
    ,"PR_VSC", [Br PR Block Step]
    ,"PR_SM", [Br PR Block Step]
    ,"PR_RD", [Br PR Block Step]
    ,"PR_GA", [Br PR Block Step]
    ,"PR_OOI", [Br PR Block Step]
    ,"PR_FX", [Br PR FX]
    ,"PR_EBITDA", [Br PR EBITDA]
    ,"PR_DA", [Br PR DA]
    ,"PR_ADJ", [Br PR ADJ]
    ,"PR_END", [Br PR OP]
)
```

```dax
Br From =
-- running level before a change / fx / level step = start + Σ earlier visible changes of the same bridge
-- (charts.tsx:39-52; subtotals equal start + changes, so no reset is needed)
VAR _bridge       = SELECTEDVALUE ( 'Bridge Step'[Bridge] )
VAR _sort         = SELECTEDVALUE ( 'Bridge Step'[StepSort] )
VAR _steps        =
    FILTER (
        ALL ( 'Bridge Step' )
        ,'Bridge Step'[Bridge] = _bridge
            && [Br Visible] = 1
    )
VAR _start        = MAXX ( FILTER ( _steps, 'Bridge Step'[StepKind] = "start" ), [Br Value] )
VAR _before       =
    SUMX (
        FILTER (
            _steps
            ,'Bridge Step'[StepSort] < _sort
                && 'Bridge Step'[StepKind] IN { "change", "fx", "level" }
        )
        ,[Br Value]
    )
RETURN
    _start + _before
```

```dax
Br Invisible =
VAR _kind         = SELECTEDVALUE ( 'Bridge Step'[StepKind] )
VAR _from         = [Br From]
VAR _to           = _from + [Br Value]
RETURN
    IF ( _kind IN { "change", "fx", "level" }, MIN ( _from, _to ) )
```

```dax
Br Up =
IF ( SELECTEDVALUE ( 'Bridge Step'[StepKind] ) = "change" && [Br Value] >= 0, [Br Value] )
```

```dax
Br Down =
IF ( SELECTEDVALUE ( 'Bridge Step'[StepKind] ) = "change" && [Br Value] < 0, - [Br Value] )
```

```dax
Br FX Bar =
IF ( SELECTEDVALUE ( 'Bridge Step'[StepKind] ) = "fx", ABS ( [Br Value] ) )
```

```dax
Br Level Bar =
IF ( SELECTEDVALUE ( 'Bridge Step'[StepKind] ) = "level", ABS ( [Br Value] ) )
```

```dax
Br Total =
IF ( SELECTEDVALUE ( 'Bridge Step'[StepKind] ) IN { "start", "end" }, [Br Value] )
```

```dax
Br Subtotal =
IF ( SELECTEDVALUE ( 'Bridge Step'[StepKind] ) = "subtotal", [Br Value] )
```
Format of all bridge series: `#,##0`.

```dax
Br Label Text =
-- value label above each bar: money, signed for changes and FX (analysis.ts:55-66)
VAR _kind         = SELECTEDVALUE ( 'Bridge Step'[StepKind] )
VAR _value        = [Br Value]
VAR _div          = [Sel Units Divisor]
VAR _dec          = [Sel Units Decimals]
VAR _zero         = ROUND ( ABS ( _value ) / _div, _dec ) = 0
VAR _signed       = _kind IN { "change", "fx" }
VAR _sign         =
    SWITCH (
        TRUE ()
        ,_zero
            ,""
        ,_value < 0
            ,"−"
        ,_signed
            ,"+"
        ,""
    )
RETURN
    _sign & [Sel Currency Symbol] & FORMAT ( ABS ( _value ) / _div, IF ( _dec = 0, "#,##0", "#,##0.0" ) ) & " " & [Sel Units Label]
```

```dax
Br Sub Text =
-- small label: NR steps % of the comparison (P: of total NR; S: of the line's comparison NR); CC subtotal and end:
-- % vs the start; profit subtotal, levels and end: "Δ ±money" vs the comparison
VAR _id           = SELECTEDVALUE ( 'Bridge Step'[StepId] )
VAR _value        = [Br Value]
VAR _start_nr     = [Br NR Start]
VAR _pct          = "+0.0%;−0.0%;0.0%"
VAR _div          = [Sel Units Divisor]
VAR _dec          = [Sel Units Decimals]
VAR _delta        =
    SWITCH (
        _id
        ,"PR_EBITDA", [Br PR EBITDA] - [Br PR Start]
        ,"PR_DA", [Br PR DA] - COALESCE ( CALCULATE ( [D&A], 'Plan Column'[Column] = "BRIDGE" ), 0 )
        ,"PR_ADJ", [Br PR ADJ] - COALESCE ( CALCULATE ( [Adjusting Items], 'Plan Column'[Column] = "BRIDGE" ), 0 )
        ,"PR_END", [Br PR OP] - COALESCE ( CALCULATE ( [Operating Profit], 'Plan Column'[Column] = "BRIDGE" ), 0 )
    )
VAR _delta_text   =
    "Δ " & IF ( ROUND ( ABS ( _delta ) / _div, _dec ) = 0, "", IF ( _delta < 0, "−", "+" ) )
        & [Sel Currency Symbol] & FORMAT ( ABS ( _delta ) / _div, IF ( _dec = 0, "#,##0", "#,##0.0" ) ) & " " & [Sel Units Label]
VAR _stream       = [Br NR Line Stream]
RETURN
    SWITCH (
        TRUE ()
        ,_id IN { "NR_VOL", "NR_PRICE" } && _start_nr <> 0
            ,FORMAT ( ROUND ( _value / ABS ( _start_nr ), 3 ), _pct )
        ,_id IN { "NR_SUB", "NR_PAY", "NR_APP", "NR_PS" } && NOT ISBLANK ( _stream ) && _stream <> 0
            ,FORMAT ( ROUND ( _value / ABS ( _stream ), 3 ), _pct )
        ,_id IN { "NR_CC", "NR_END" } && _start_nr <> 0
            ,FORMAT ( ROUND ( ( _value - _start_nr ) / ABS ( _start_nr ), 3 ), _pct )
        ,_id IN { "PR_EBITDA", "PR_DA", "PR_ADJ", "PR_END" }
            ,_delta_text
        ,BLANK ()
    )
```

```dax
Br Label Colour =
SWITCH (
    TRUE ()
    ,SELECTEDVALUE ( 'Bridge Step'[StepKind] ) = "change" && [Br Value] >= 0
        ,"#06603F"
    ,SELECTEDVALUE ( 'Bridge Step'[StepKind] ) = "change"
        ,"#C2410C"
    ,"#101B2B"
)
```

```dax
Br Axis Min =
-- truncated axis (README decision 4; charts.tsx:72-81): the steps stay readable
VAR _bridge       = SELECTEDVALUE ( 'Bridge Step'[Bridge] )
VAR _steps        =
    FILTER (
        ALL ( 'Bridge Step' )
        ,'Bridge Step'[Bridge] = _bridge
            && [Br Visible] = 1
    )
VAR _levels       =
    ADDCOLUMNS (
        _steps
        ,"@lo", IF ( 'Bridge Step'[StepKind] IN { "change", "fx", "level" }, MIN ( [Br From], [Br From] + [Br Value] ), [Br Value] )
        ,"@hi", IF ( 'Bridge Step'[StepKind] IN { "change", "fx", "level" }, MAX ( [Br From], [Br From] + [Br Value] ), [Br Value] )
    )
VAR _lo           = MINX ( _levels, [@lo] )
VAR _hi           = MAXX ( _levels, [@hi] )
VAR _range        = IF ( _hi - _lo <> 0, _hi - _lo, IF ( _hi <> 0, ABS ( _hi ), 1 ) )
RETURN
    IF ( _lo >= 0, MAX ( 0, _lo - _range * 0.6 ), _lo - _range * 0.1 )
```

```dax
Br Axis Max =
VAR _bridge       = SELECTEDVALUE ( 'Bridge Step'[Bridge] )
VAR _steps        =
    FILTER (
        ALL ( 'Bridge Step' )
        ,'Bridge Step'[Bridge] = _bridge
            && [Br Visible] = 1
    )
VAR _levels       =
    ADDCOLUMNS (
        _steps
        ,"@lo", IF ( 'Bridge Step'[StepKind] IN { "change", "fx", "level" }, MIN ( [Br From], [Br From] + [Br Value] ), [Br Value] )
        ,"@hi", IF ( 'Bridge Step'[StepKind] IN { "change", "fx", "level" }, MAX ( [Br From], [Br From] + [Br Value] ), [Br Value] )
    )
VAR _lo           = MINX ( _levels, [@lo] )
VAR _hi           = MAXX ( _levels, [@hi] )
VAR _range        = IF ( _hi - _lo <> 0, _hi - _lo, IF ( _hi <> 0, ABS ( _hi ), 1 ) )
RETURN
    _hi + _range * 0.08
```
(Used by the axis `fx` with the visual filtered to one bridge, so `SELECTEDVALUE ( 'Bridge Step'[Bridge] )` resolves.)

```dax
Br Profit Title =
"Profit bridge: " & [Bridge Cmp Name] & " Adj. EBITDA → Actual → Operating profit"
```

## 10. Profitability (folder `9 Profitability`; `engine/profitability.ts`)

Everything on this page is at **constant currency** (the selected year's budget rates) and compares with the bridge
comparison. Region only: opex is booked by region, so nothing on the page is allocated (C-31).

```dax
Prof Raw NR =
CALCULATE ( [Net Revenue], 'Plan Column'[Column] = "BASE", 'FX Override'[Basis] = "CC" )
```

```dax
Prof Raw NR Cmp =
CALCULATE ( [Net Revenue], 'Plan Column'[Column] = "BRIDGE", 'FX Override'[Basis] = "CC" )
```

```dax
Prof Raw CM =
CALCULATE ( [Contribution Margin], 'Plan Column'[Column] = "BASE", 'FX Override'[Basis] = "CC" )
```

```dax
Prof Raw CM Cmp =
CALCULATE ( [Contribution Margin], 'Plan Column'[Column] = "BRIDGE", 'FX Override'[Basis] = "CC" )
```

```dax
Prof Raw GP =
CALCULATE ( [Gross Profit], 'Plan Column'[Column] = "BASE", 'FX Override'[Basis] = "CC" )
```

```dax
Prof Raw EBITDA =
CALCULATE ( [Adjusted EBITDA], 'Plan Column'[Column] = "BASE", 'FX Override'[Basis] = "CC" )
```

```dax
Prof NR =
ROUND ( [Prof Raw NR] / [Sel Units Divisor], [Sel Units Decimals] )
```
Dynamic format string of `Prof NR`, `Prof Contribution`, `Prof EBITDA` and `Heat NR` (renders "$1,488.6 m",
"−$12.0 m", "$0.0 m"):

```dax
VAR _sym          = [Sel Currency Symbol]
VAR _unit         = [Sel Units Label]
VAR _num          = IF ( [Sel Units Decimals] = 0, "#,##0", "#,##0.0" )
RETURN
    """" & _sym & """" & _num & """ " & _unit & """"
        & ";""−" & _sym & """" & _num & """ " & _unit & """"
        & ";""" & _sym & """" & _num & """ " & _unit & """"
```

```dax
Prof Contribution =
ROUND ( [Prof Raw CM] / [Sel Units Divisor], [Sel Units Decimals] )
```

```dax
Prof EBITDA =
ROUND ( [Prof Raw EBITDA] / [Sel Units Divisor], [Sel Units Decimals] )
```

```dax
Prof NR Delta Pct =
-- Δ vs comparison % on net revenue (CC); plain text colour (only CM Δ carries a status, PV-13)
VAR _now          = [Prof Raw NR]
VAR _cmp          = [Prof Raw NR Cmp]
RETURN
    IF (
        ISBLANK ( _now ) || ISBLANK ( _cmp ) || _cmp = 0
        ,BLANK ()
        ,ROUND ( ( _now - _cmp ) / ABS ( _cmp ), 3 )
    )
```
Format `+0.0%;−0.0%;0.0%`.

```dax
Prof GM % =
ROUND ( DIVIDE ( [Prof Raw GP], [Prof Raw NR] ), 3 )
```

```dax
Prof CM % =
ROUND ( DIVIDE ( [Prof Raw CM], [Prof Raw NR] ), 3 )
```
Format `0.0%`.

```dax
Prof CM Delta Raw =
VAR _cm           = DIVIDE ( [Prof Raw CM], [Prof Raw NR] )
VAR _cm_cmp       = DIVIDE ( [Prof Raw CM Cmp], [Prof Raw NR Cmp] )
RETURN
    IF ( ISBLANK ( _cm ) || ISBLANK ( _cm_cmp ), BLANK (), _cm - _cm_cmp )
```

```dax
Prof CM Delta pp =
ROUND ( [Prof CM Delta Raw] * 100, 1 )
```
Format `+0.0" pp";−0.0" pp";0.0" pp"`.

```dax
Prof CM Status =
-- the only status dot: ratio thresholds ±0.3 pp / 1 pp, Higher is better
VAR _d            = [Prof CM Delta Raw]
RETURN
    SWITCH (
        TRUE ()
        ,ISBLANK ( _d )
            ,BLANK ()
        ,ABS ( _d ) <= 0.003
            ,"onTrack"
        ,_d > 0
            ,"ahead"
        ,ABS ( _d ) <= 0.01
            ,"watch"
        ,"off"
    )
```

```dax
Prof CM Status Icon =
-- for conditional-formatting icons (field value): a coloured dot
SWITCH (
    [Prof CM Status]
    ,"onTrack", "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><circle cx='4' cy='4' r='4' fill='%238592A3'/></svg>"
    ,"watch", "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><circle cx='4' cy='4' r='4' fill='%23D9A441'/></svg>"
    ,"off", "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><circle cx='4' cy='4' r='4' fill='%23C2410C'/></svg>"
    ,"ahead", "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='8' height='8'><circle cx='4' cy='4' r='4' fill='%233BA37B'/></svg>"
)
```
Data category: Image URL. (Alternative without SVG: Conditional formatting → Icons, rules on `[Prof CM Delta Raw]`.)

```dax
Prof Subtitle =
"Constant currency (FY" & [Sel FY] & " budget rates) - " & [Sel Currency] & " " & [Sel Units Label] & " - vs " & [Bridge Cmp Name]
```

```dax
Conc Share =
-- each region's share of net revenue, contribution and Adj. EBITDA (booked by region) (profitability.ts:86-99)
VAR _level        = SELECTEDVALUE ( 'Conc Level'[LevelCode] )
VAR _value        =
    SWITCH ( _level, "NR", [Prof Raw NR], "CM", [Prof Raw CM], "EBITDA", [Prof Raw EBITDA] )
VAR _total        =
    CALCULATE (
        SWITCH ( _level, "NR", [Prof Raw NR], "CM", [Prof Raw CM], "EBITDA", [Prof Raw EBITDA] )
        ,REMOVEFILTERS ( 'Dim Region' )
    )
RETURN
    DIVIDE ( _value, _total )
```
Format `0.0%`.

```dax
Trend NR CC =
-- net revenue at CC in the axis month for the trend row (a region or the company), the base's version of that month
VAR _t            = SELECTEDVALUE ( 'Dim Month'[MonthIdx] )
VAR _row          = SELECTEDVALUE ( 'Trend Row'[RowKey], "TOTAL" )
VAR _co           = [Sel Company]
VAR _base         = [Sel Base]
VAR _in           = _t >= [Base From] && _t <= [Base To]
VAR _version      =
    SWITCH (
        TRUE ()
        ,_base = "B"
            ,"BUD"
        ,_t <= [Last Closed Idx]
            ,"ACT"
        ,[Latest Forecast Key]
    )
VAR _regions      =
    FILTER (
        ALL ( 'Dim Region'[RegionCode] )
        ,_row = "TOTAL" || 'Dim Region'[RegionCode] = _row
    )
RETURN
    IF (
        _in
        ,CALCULATE (
            [Amt Translated]
            ,'Dim Account'[BlockCode] IN { "GR", "GTN" }
            ,'Dim Version'[VersionKey] = _version
            ,'Dim Entity'[EntityCode] = _co
            ,_regions
            ,'FX Override'[Basis] = "CC"
        )
    )
```

```dax
Trend NR CC PY =
-- the same month a year earlier, Actual (C-04)
VAR _t            = SELECTEDVALUE ( 'Dim Month'[MonthIdx] )
VAR _row          = SELECTEDVALUE ( 'Trend Row'[RowKey], "TOTAL" )
VAR _co           = [Sel Company]
VAR _in           = _t >= [Base From] && _t <= [Base To] && _t - 12 >= 0
VAR _regions      =
    FILTER (
        ALL ( 'Dim Region'[RegionCode] )
        ,_row = "TOTAL" || 'Dim Region'[RegionCode] = _row
    )
RETURN
    IF (
        _in
        ,CALCULATE (
            [Amt Translated]
            ,'Dim Account'[BlockCode] IN { "GR", "GTN" }
            ,'Dim Version'[VersionKey] = "ACT"
            ,'Dim Entity'[EntityCode] = _co
            ,_regions
            ,REMOVEFILTERS ( 'Dim Month' )
            ,'Dim Month'[MonthIdx] = _t - 12
            ,'FX Override'[Basis] = "CC"
        )
    )
```

```dax
Trend CM CC =
-- contribution margin at CC in the axis month (same plumbing as Trend NR CC, blocks GR, GTN, COR, VSC)
VAR _t            = SELECTEDVALUE ( 'Dim Month'[MonthIdx] )
VAR _row          = SELECTEDVALUE ( 'Trend Row'[RowKey], "TOTAL" )
VAR _co           = [Sel Company]
VAR _base         = [Sel Base]
VAR _in           = _t >= [Base From] && _t <= [Base To]
VAR _version      =
    SWITCH (
        TRUE ()
        ,_base = "B"
            ,"BUD"
        ,_t <= [Last Closed Idx]
            ,"ACT"
        ,[Latest Forecast Key]
    )
VAR _regions      =
    FILTER (
        ALL ( 'Dim Region'[RegionCode] )
        ,_row = "TOTAL" || 'Dim Region'[RegionCode] = _row
    )
RETURN
    IF (
        _in
        ,CALCULATE (
            [Amt Translated]
            ,'Dim Account'[BlockCode] IN { "GR", "GTN", "COR", "VSC" }
            ,'Dim Version'[VersionKey] = _version
            ,'Dim Entity'[EntityCode] = _co
            ,_regions
            ,'FX Override'[Basis] = "CC"
        )
    )
```

```dax
Trend Growth =
-- NRcc(month) ÷ NRcc(same month a year earlier, Actual) − 1; n/a before Jan 2025 (profitability.ts:203-304)
VAR _now          = [Trend NR CC]
VAR _py           = [Trend NR CC PY]
RETURN
    IF ( ISBLANK ( _now ) || ISBLANK ( _py ) || _py = 0, BLANK (), ( _now - _py ) / ABS ( _py ) )
```
Format `+0%;−0%;0%` (axis), data label `+0.0%;−0.0%;0.0%`.

```dax
Trend CM % =
DIVIDE ( [Trend CM CC], [Trend NR CC] )
```
Format `0.0%`.

```dax
Trend Growth Company =
CALCULATE ( [Trend Growth], 'Trend Row'[RowKey] = "TOTAL" )
```

```dax
Trend CM % Company =
CALCULATE ( [Trend CM %], 'Trend Row'[RowKey] = "TOTAL" )
```
The dashed reference line behind each region.

```dax
Trend Note =
-- "Growth n/a for 6 of 12 months: no prior year before Jan 2024" (profitability.ts:279-290)
VAR _n            = [Base Month Count]
VAR _no_py        = MAX ( 0, MIN ( [Base To], 11 ) - [Base From] + 1 )
RETURN
    IF (
        _no_py > 0
        ,"Growth n/a for " & _no_py & " of " & _n & " months: no prior year before Jan 2024"
    )
```

```dax
Heat NR =
[Prof NR]
```
(Cell value in the region × line matrix; same dynamic format as `Prof NR`.)

```dax
Heat Share =
-- the cell's share of its region
DIVIDE ( [Prof Raw NR], CALCULATE ( [Prof Raw NR], REMOVEFILTERS ( 'Dim Line' ) ) )
```
Format `0%`.

```dax
Heat Max Cell =
-- the largest region × line cell of the company (the colour scale's 100 %)
VAR _co           = [Sel Company]
RETURN
    CALCULATE (
        MAXX (
            CROSSJOIN (
                VALUES ( 'Dim Region'[RegionCode] )
                ,CALCULATETABLE (
                    VALUES ( 'Dim Line'[LineCode] )
                    ,'Dim Line'[EntityCode] = _co
                    ,'Dim Line'[IsUnassigned] = FALSE ()
                )
            )
            ,ABS ( [Prof Raw NR] )
        )
        ,REMOVEFILTERS ( 'Dim Region' )
        ,REMOVEFILTERS ( 'Dim Line' )
    )
```

```dax
Heat Cell Background =
-- colour = the cell's NR ÷ the largest cell: color-mix(acc (15 + 70 t) %, accT) (profitability-view.tsx:134-142)
VAR _is_cell      = ISINSCOPE ( 'Dim Region'[RegionName] ) && ISINSCOPE ( 'Dim Line'[LineName] )
VAR _t            = DIVIDE ( ABS ( [Prof Raw NR] ), [Heat Max Cell], 0 )
VAR _p            = ( 15 + 70 * _t ) / 100
VAR _co           = [Sel Company]
VAR _acc_r        = IF ( _co = "S", 107, 36 )
VAR _acc_g        = IF ( _co = "S", 72, 83 )
VAR _acc_b        = IF ( _co = "S", 200, 166 )
VAR _tint_r       = IF ( _co = "S", 240, 232 )
VAR _tint_g       = IF ( _co = "S", 235, 238 )
VAR _tint_b       = IF ( _co = "S", 251, 248 )
VAR _r            = ROUND ( _acc_r * _p + _tint_r * ( 1 - _p ), 0 )
VAR _g            = ROUND ( _acc_g * _p + _tint_g * ( 1 - _p ), 0 )
VAR _b            = ROUND ( _acc_b * _p + _tint_b * ( 1 - _p ), 0 )
VAR _hex          = "0123456789ABCDEF"
RETURN
    IF (
        _is_cell
        ,"#"
            & MID ( _hex, INT ( _r / 16 ) + 1, 1 ) & MID ( _hex, MOD ( _r, 16 ) + 1, 1 )
            & MID ( _hex, INT ( _g / 16 ) + 1, 1 ) & MID ( _hex, MOD ( _g, 16 ) + 1, 1 )
            & MID ( _hex, INT ( _b / 16 ) + 1, 1 ) & MID ( _hex, MOD ( _b, 16 ) + 1, 1 )
        ,"#F6F8FA"
    )
```

```dax
Heat Cell Font =
VAR _is_cell      = ISINSCOPE ( 'Dim Region'[RegionName] ) && ISINSCOPE ( 'Dim Line'[LineName] )
VAR _t            = DIVIDE ( ABS ( [Prof Raw NR] ), [Heat Max Cell], 0 )
RETURN
    IF ( _is_cell && _t > 0.45, "#FFFFFF", "#101B2B" )
```

```dax
Heat Line GM Text =
"GM " & FORMAT ( DIVIDE ( [Prof Raw GP], [Prof Raw NR] ), "0.0%" )
```

```dax
Heat Title =
"Mix - region × " & IF ( [Sel Company] = "S", "service line", "category" )
```

## 11. Header, notices, period texts (folder `10 Header`; `engine/header.ts`, `engine/notices.ts`, `engine/period.ts`, `engine/view-copy.ts`)

```dax
Hdr Status =
-- "Consumer Products - Management reporting - Closed through Sep 2026 - Refreshed 28 Oct 2026 15:57" (UTC)
VAR _built        = MAX ( 'Data Info'[BuiltAtUtc] )
RETURN
    [Company Name] & " - Management reporting - Closed through " & MAX ( 'Data Info'[LastClosedLabel] )
        & " - Refreshed " & FORMAT ( _built, "d mmm yyyy hh:nn" )
```

```dax
Period Summary =
-- "Showing Jan – Sep 2026 - year to date"; one month "Showing Sep 2026"; across years "Oct 2025 – Sep 2026";
-- nothing closed under Actual: "Showing no closed month yet" (period.ts:107-133)
VAR _tv           = [Sel Time View]
VAR _from         = [Base From]
VAR _to           = [Base To]
VAR _a_label      = LOOKUPVALUE ( 'Dim Month'[MonthLabel], 'Dim Month'[MonthIdx], _from )
VAR _a_name       = LOOKUPVALUE ( 'Dim Month'[MonthName], 'Dim Month'[MonthIdx], _from )
VAR _a_fy         = LOOKUPVALUE ( 'Dim Month'[FiscalYear], 'Dim Month'[MonthIdx], _from )
VAR _b_label      = LOOKUPVALUE ( 'Dim Month'[MonthLabel], 'Dim Month'[MonthIdx], _to )
VAR _b_fy         = LOOKUPVALUE ( 'Dim Month'[FiscalYear], 'Dim Month'[MonthIdx], _to )
VAR _range        =
    SWITCH (
        TRUE ()
        ,_from = _to
            ,_b_label
        ,_a_fy = _b_fy
            ,_a_name & " – " & _b_label
        ,_a_label & " – " & _b_label
    )
VAR _tail         =
    IF (
        _tv IN { "MTD", "RANGE" }
        ,""
        ," - " & LOWER ( SWITCH ( _tv, "QTD", "Quarter to date", "YTD", "Year to date", "LTM", "Last 12 months", "Full year" ) )
    )
RETURN
    IF ( _from > _to, "Showing no closed month yet", "Showing " & _range & _tail )
```

```dax
Versions Text =
-- applied-filters "Versions" row (header.ts:69-77)
VAR _base         = SWITCH ( [Sel Base], "LE", "Latest estimate", "B", "Budget", "Actual" )
VAR _a            = SWITCH ( [Sel Compare A], "B", "Budget", "LE", "Latest estimate", "PY", "Prior year", "" )
VAR _b            = SWITCH ( [Sel Compare B], "B", "Budget", "LE", "Latest estimate", "PY", "Prior year", "" )
RETURN
    SWITCH (
        TRUE ()
        ,_a = "" && _b = ""
            ,_base & " only"
        ,_b = ""
            ,_base & " vs " & _a & " (A)"
        ,_a = ""
            ,_base & " vs " & _b & " (B)"
        ,_base & " vs " & _a & " (A) and " & _b & " (B)"
    )
```

```dax
Rail Sum Versions =
-- "Actual vs Budget, Prior year"; "Actual only" (header.ts:181-193)
VAR _base         = SWITCH ( [Sel Base], "LE", "Latest estimate", "B", "Budget", "Actual" )
VAR _a            = SWITCH ( [Sel Compare A], "B", "Budget", "LE", "Latest estimate", "PY", "Prior year", "" )
VAR _b            = SWITCH ( [Sel Compare B], "B", "Budget", "LE", "Latest estimate", "PY", "Prior year", "" )
VAR _list         = _a & IF ( _a <> "" && _b <> "", ", ", "" ) & _b
RETURN
    _base & IF ( _list = "", " only", " vs " & _list )
```

```dax
Rail Sum Display =
[Sel Currency] & " " & [Sel Units Label] & " - " & IF ( [Sel FX Basis] = "CC", "constant currency", "actual rates" )
```

```dax
Notice Cut-off =
-- C-01, T-11: an Actual window past the last close
IF (
    [Sel Base] = "A" && [Win To] > [Last Closed Idx]
    ,"Actuals closed through " & MAX ( 'Data Info'[LastClosedLabel] )
        & ": later months excluded; use Latest estimate for the full window"
)
```

```dax
Notice Forecast =
-- C-02: only when the base itself reads forecast months
VAR _last         = [Last Closed Idx]
VAR _start        = MAX ( _last + 1, [Win From Raw] )
VAR _end          = [Win To]
RETURN
    IF (
        [Sel Base] = "LE" && _end > _last
        ,"Forecast months included: "
            & LOOKUPVALUE ( 'Dim Month'[MonthLabel], 'Dim Month'[MonthIdx], _start ) & " – "
            & LOOKUPVALUE ( 'Dim Month'[MonthLabel], 'Dim Month'[MonthIdx], _end )
            & " (" & [Latest Forecast Name] & ")"
    )
```

```dax
Notice Prior Year =
-- C-04, T-12: a prior-year comparison and a window starting less than 12 months into the data
VAR _py_on        = [Sel Compare A] = "PY" || [Sel Compare B] = "PY"
VAR _covered      = MAX ( 0, [Base To] - MAX ( [Base From], 12 ) + 1 )
VAR _cover_text   =
    IF (
        [Sel Time View] = "RANGE"
        ,": it covers " & _covered & " of the range's " & [Base Month Count] & " months"
        ,""
    )
RETURN
    IF ( _py_on && [Win From Raw] - 12 < 0, "Prior year n/a before Jan 2024" & _cover_text )
```

```dax
Notice History =
IF (
    [Sel Time View] = "LTM" && [Win From Raw] < 0
    ,"LTM starts before the data history (Jan 2024)"
)
```

```dax
Notice Eliminations =
IF (
    [Sel Company] = "GROUP"
    ,"ACME Group: Commerce Cloud fees billed to Consumer Products are eliminated"
)
```

```dax
Notice Count =
VAR _n            =
    ( NOT ISBLANK ( [Notice Cut-off] ) ) + ( NOT ISBLANK ( [Notice Forecast] ) )
        + ( NOT ISBLANK ( [Notice Prior Year] ) ) + ( NOT ISBLANK ( [Notice History] ) )
        + ( NOT ISBLANK ( [Notice Eliminations] ) )
RETURN
    IF ( _n > 0, _n )
```
(The web's "Allocation" notice applies only with statement-wide slice filters, which are not built.)

Applied-filters table: a static axis table plus one value measure.

```dax
Applied Row =
DATATABLE (
    "RowLabel", STRING
    ,"RowSort", INTEGER
    ,"IsNotice", BOOLEAN
    ,{
        { "Company", 1, FALSE }
        ,{ "Fiscal year", 2, FALSE }
        ,{ "Period", 3, FALSE }
        ,{ "Time view", 4, FALSE }
        ,{ "Versions", 5, FALSE }
        ,{ "Currency", 6, FALSE }
        ,{ "FX basis", 7, FALSE }
        ,{ "Units", 8, FALSE }
        ,{ "Regions", 9, FALSE }
        ,{ "Slices", 10, FALSE }
        ,{ "Cut-off", 11, TRUE }
        ,{ "Forecast", 12, TRUE }
        ,{ "Prior year", 13, TRUE }
        ,{ "History", 14, TRUE }
        ,{ "Eliminations", 15, TRUE }
    }
)
```
(Calculated table; add to the model, disconnected, sort `RowLabel` by `RowSort`.)

```dax
Applied Row Value =
VAR _fy_text      =
    IF (
        [Sel Time View] = "RANGE"
            && LOOKUPVALUE ( 'Dim Month'[FiscalYear], 'Dim Month'[MonthIdx], MIN ( [Range Start Idx], [Anchor Idx] ) ) <> [Sel FY]
        ,LOOKUPVALUE ( 'Dim Month'[FiscalYear], 'Dim Month'[MonthIdx], MIN ( [Range Start Idx], [Anchor Idx] ) ) & " – " & [Sel FY]
        ,FORMAT ( [Sel FY], "0" )
    )
RETURN
    SWITCH (
        SELECTEDVALUE ( 'Applied Row'[RowLabel] )
        ,"Company", IF ( [Sel Company] = "GROUP", "ACME Group (consolidated)", [Company Name] )
        ,"Fiscal year", _fy_text
        ,"Period", [Period Summary]
        ,"Time view", SELECTEDVALUE ( 'P Time View'[TimeViewLabel], "Year to date" )
        ,"Versions", [Versions Text]
        ,"Currency", [Sel Currency]
        ,"FX basis", IF ( [Sel FX Basis] = "CC", "Constant currency (FY" & [Sel FY] & " budget rates)", "Actual rates" )
        ,"Units", SELECTEDVALUE ( 'P Units'[UnitsName], "Millions" )
        ,"Regions", "All regions"
        ,"Slices", IF ( [Sel Company] = "GROUP", "Consolidated: channel, category and segment do not apply", "All slices" )
        ,"Cut-off", [Notice Cut-off]
        ,"Forecast", [Notice Forecast]
        ,"Prior year", [Notice Prior Year]
        ,"History", [Notice History]
        ,"Eliminations", [Notice Eliminations]
    )
```

```dax
Applied Row Colour =
IF ( SELECTEDVALUE ( 'Applied Row'[IsNotice], FALSE () ), "#3D3216", "#101B2B" )
```

```dax
HowTo Showing =
-- the first line of every "How to read" panel (view-copy.ts:81-107)
VAR _a            = SWITCH ( [Sel Compare A], "B", "Budget", "LE", "Latest estimate", "PY", "Prior year", "" )
VAR _b            = SWITCH ( [Sel Compare B], "B", "Budget", "LE", "Latest estimate", "PY", "Prior year", "" )
VAR _vs           = _a & IF ( _a <> "" && _b <> "", " and ", "" ) & _b
RETURN
    [Period Summary] & " - " & [Sel Currency] & " " & [Sel Units Label] & " - vs " & IF ( _vs = "", "Prior year", _vs )
```

## 12. Measure inventory

| Folder | Measures |
|---|---|
| 0 Selection (21) | Sel Company, Last Closed Idx, Sel FY, Sel Month, Sel Time View, Sel Base, Sel Compare A, Sel Compare B, Sel Currency, Sel Currency Symbol, Sel FX Basis, Sel Units Divisor, Sel Units Decimals, Sel Units Label, Sel Cost Multiplier, Sel Show Tags, Sel Hide Empty, Latest Forecast Key, Latest Forecast First Idx, Latest Forecast Last Idx, Latest Forecast Name |
| 1 Window (11) | Anchor Idx, FY First Idx, FY Last Idx, Range Start Idx, Win From Raw, Win To, Win From, Months Before History, Base From, Base To, Base Month Count |
| 2 Plan (19) | Plan Column Code, Plan Choice, Plan Window From, Plan Window To, Plan P1 Version, Plan P1 From Raw, Plan P1 To Raw, Plan P2 From Raw, Plan P2 To Raw, Plan Last Only, Plan Has P2, Plan Has P1, Plan P1 From, Plan P1 To, Plan P2 From, Plan P2 To, Plan Has Data, Bridge Cmp Code, Bridge Cmp Name |
| 3 Base amounts (7) | Amt Translated, GMV Translated, Amt, Units Raw, GMV Raw, Merchants Plan, Merchants Raw |
| 4 Lines (29) | the 23 lines and 6 ratios of §4 |
| 5 Catalogue (33) | Opex % of NR, Gross-to-Net %, Cost of Revenue % of NR, Variable Selling % of NR, S&M % of NR, R&D % of NR, G&A % of NR, A&P % of NR, A&P Spend, NR Growth Reported, NR Growth Organic, EBITDA Growth, Units Sold, NR per Unit, GMV Processed, Payments Take Rate, Active Merchants, GMV per Merchant, ARR Run-Rate, Subscriptions Share of NR, Payments Share of NR, FY NR LE, FY NR Budget, FY EBITDA LE, FY EBITDA Budget, FY NR Attainment, FY EBITDA Attainment, FX Effect NR, FX Effect EBITDA, FX Effect OP, NR Share of Company, CM Share of Company, EBITDA Share of Company |
| 6 Statement (38) | Stmt Row Kind, Stmt Row In Scope, PL Value, Stmt Base Raw, Stmt Cmp A Raw, Stmt Cmp B Raw, Stmt FY Budget Raw, Stmt FY LE Raw, Stmt NR Base, Stmt Delta A Raw, Stmt Delta B Raw, Stmt FY Delta Raw, Stmt Delta Pct A Raw, Stmt Delta Pct B Raw, Stmt Row Hidden, Stmt Row Shown, Stmt Line Note, Stmt Base, Stmt Pct NR, Stmt Cmp A, Stmt Delta A, Stmt Delta Pct A, Stmt Bar A, Stmt Cmp B, Stmt Delta B, Stmt Delta Pct B, Stmt FY Budget, Stmt FY LE, Stmt FY Delta, Stmt Delta A Colour, Stmt Delta B Colour, Stmt FY Delta Colour, Stmt Row Background (+ Stmt Row Font Colour, Window Label, Stmt Group Titles, Stmt Line Header, Stmt Footnote) |
| 7 Vitals (25) | Vit Card Visible, Vit Metric, Vit Base, Vit Cmp A, Vit Cmp B, Vit Budget, Vit Rel A, Vit Rel B, Vit Status Code, Vit Status Text, Vit Status Colour, Vit Status Background, Vit Value Text, Vit Row A Label, Vit Row B Label, Vit Row A Abs, Vit Row B Abs, Vit Row A Rel, Vit Row B Rel, Vit Row A Colour, Vit Row B Colour, Vit Info Values (+ Vit Info What, Vit Info Formula, Vit Info Source — static SWITCH texts, `05-pages.md` §3.4) |
| 8 Analysis (70) | LV Amt, LV Base, LV Cmp, LV Delta, LV Abs Delta, LV Delta CC, LV FX, LV Cmp B Delta, LV Show, LV Slice Active, LV Alloc, LV Row Font Colour, LV Scale, LV Delta Bar, LV Money Base, LV Money Cmp, LV Money Delta, LV Money FX, LV Money Cmp B Delta, LV Delta Pct Text, LV Tone Colour, LV Pct Colour, LV Title, LV Cmp Header, LV Cmp B Header, LV Filter Text, LV Filter Count, LV Empty Text, Slot Label Channel / Line / Segment, Slicer Member Visible (×3), Br NR …(9), Br PR …(10), Br Visible, Br Value, Br From, Br Invisible, Br Up, Br Down, Br FX Bar, Br Level Bar, Br Total, Br Subtotal, Br Label Text, Br Sub Text, Br Label Colour, Br Axis Min, Br Axis Max, Br Profit Title |
| 9 Profitability (33) | Prof Raw NR, Prof Raw NR Cmp, Prof Raw CM, Prof Raw CM Cmp, Prof Raw GP, Prof Raw EBITDA, Prof NR, Prof Contribution, Prof EBITDA, Prof NR Delta Pct, Prof GM %, Prof CM %, Prof CM Delta Raw, Prof CM Delta pp, Prof CM Status, Prof CM Status Icon, Prof Subtitle, Conc Share, Trend NR CC, Trend NR CC PY, Trend CM CC, Trend Growth, Trend CM %, Trend Growth Company, Trend CM % Company, Trend Note, Heat NR, Heat Share, Heat Max Cell, Heat Cell Background, Heat Cell Font, Heat Line GM Text, Heat Title |
| 10 Header (18) | Theme Acc, Theme Acc Tint, Theme Key Rule, Company Name, Hdr Status, Period Summary, Versions Text, Rail Sum Versions, Rail Sum Display, Notice Cut-off, Notice Forecast, Notice Prior Year, Notice History, Notice Eliminations, Notice Count, Applied Row Value, Applied Row Colour, HowTo Showing |

Calculated tables added in this file: `Applied Row` (§11).
