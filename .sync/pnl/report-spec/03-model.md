# 03 — Semantic model

## 1. Design in one paragraph

One P&L fact (`Fact PL`, month × version × region × channel × line × segment × account × counterparty, below-CM lines
already allocated to slices) and one operational fact (`Fact Ops`) share conformed dimensions (month, version, region,
channel, line, segment, entity). Accounts roll up to a 29-line spine through `Dim Account[BlockCode]`; subtotals are
**never stored**, they are DAX sums of block sets (D-32). Every report control (company, period, versions, currency, FX
basis, units, cost sign, toggles) is a **disconnected parameter table** read by measures; the measures build the month
window and the version plan of each column (Base, Compare A, Compare B, Budget, Prior year, Latest estimate, FY Budget,
FY LE) from two disconnected helper tables (`Plan Column`, `Plan Scope`) and translate every month × currency at its own
rate through `FX Factor`. A calculation group (`Comparison Column`) exposes the plans to any measure; a field parameter
(`Statement Columns`) holds the statement's columns.

Settings: File → Options → Current file → Data load: **Auto date/time off**. Model culture `en-US`. No table is marked as
a date table: the grain is the month, the fiscal year is the calendar year, and every window is a contiguous month-index
range computed by measures, so no built-in time-intelligence function is used.

## 2. Tables

| Table | Kind | Rows | Key | Purpose |
|---|---|---:|---|---|
| `Fact PL` | fact | 1,112,532 | (none; grain columns) | signed local amounts, below-CM allocated (C-31) |
| `Fact Ops` | fact | 26,784 | — | units (P), GMV (S), active merchants (S) |
| `Dim Month` | dim | 36 | MonthIdx | month, FY, quarter, closed flag |
| `Dim Version` | dim | 4 | VersionKey | ACT, BUD, FC2606 (no rows), FC2609 (latest) |
| `Dim Region` | dim | 4 | RegionCode | region, functional currency |
| `Dim Channel` | dim | 10 | ChannelCode | channel (P) / sales motion (S), entity-keyed |
| `Dim Line` | dim | 11 | LineCode | category (P) / service line (S) |
| `Dim Segment` | dim | 8 | SegmentCode | price tier (P) / customer segment (S) |
| `Dim Entity` | dim | 2 | EntityCode | P, S |
| `Dim Account` | dim | 73 | AccountCode | leaf accounts with block, sign, flags |
| `FX Factor` | dim | 288 | FxKey | cross rate local → reporting per month × rate type |
| `FX CC Factor` | lookup (disconnected) | 36 | FY × local × reporting | constant-currency factors |
| `PL Row` | axis (disconnected) | 86 | RowKey | statement rows: 29 lines + accounts |
| `Data Info` | lookup (disconnected) | 1 | — | build stamp, last closed month |
| `P …` (14 tables) | parameters (disconnected) | 2–36 | Code | report controls (§6) |
| `Plan Column`, `Plan Scope`, `FX Override` | helpers (disconnected, hidden) | 9 / 2 / 3 | — | plan and basis switches for measures (§7) |
| `Vitals Card`, `Bridge Step`, `Conc Level`, `Trend Row` | axes (disconnected) | 14 / 28 / 3 / 5 | — | category axes of the views (§7) |
| `Comparison Column` | calculation group | 9 items | — | §8 |
| `Statement Columns` | field parameter | 13 | — | §9 |

## 3. Relationships

All **one-to-many, single direction** (dimension filters fact), active, referential integrity assumed.

| From (one) | To (many) |
|---|---|
| `Dim Month[MonthIdx]` | `Fact PL[MonthIdx]`, `Fact Ops[MonthIdx]` |
| `Dim Version[VersionKey]` | `Fact PL[VersionKey]`, `Fact Ops[VersionKey]` |
| `Dim Region[RegionCode]` | `Fact PL[RegionCode]`, `Fact Ops[RegionCode]` |
| `Dim Channel[ChannelCode]` | `Fact PL[ChannelCode]`, `Fact Ops[ChannelCode]` |
| `Dim Line[LineCode]` | `Fact PL[LineCode]`, `Fact Ops[LineCode]` |
| `Dim Segment[SegmentCode]` | `Fact PL[SegmentCode]`, `Fact Ops[SegmentCode]` |
| `Dim Entity[EntityCode]` | `Fact PL[EntityCode]`, `Fact Ops[EntityCode]` |
| `Dim Account[AccountCode]` | `Fact PL[AccountCode]` |
| `FX Factor[FxKey]` | `Fact PL[FxKey]`, `Fact Ops[FxKey]` |

No relationship to: `PL Row`, `FX CC Factor`, `Data Info`, every `P …` table, `Plan Column`, `Plan Scope`,
`FX Override`, `Vitals Card`, `Bridge Step`, `Conc Level`, `Trend Row`, `Statement Columns`. `Dim Channel`, `Dim Line`
and `Dim Segment` codes are unique across companies (one-column keys; `EntityCode` is an attribute).

Hide every fact column and every key on the many side. Visible to report authors: dimension names, parameter tables,
measures.

## 4. Months, windows and versions

### 4.1 `Dim Month`

`MonthIdx` 0…35 = Jan 2024 … Dec 2026, contiguous, `MonthIdx = (FiscalYear − 2024) × 12 + MonthNumber − 1`. Closed months
are a prefix (0…32, `IsClosed = TRUE`); last closed = 32 = Sep 2026 (N-03: from `is_closed`, never from the data).
Sort `MonthLabel` by `MonthIdx`; sort `MonthName` by `MonthNumber`.

### 4.2 Time windows (anchor = selected month *m* of fiscal year *y*; `time-windows.ts:34-88`)

| Time view (code) | Label in pickers | Months | As index range |
|---|---|---|---|
| `MTD` | One month | m | [a, a] |
| `QTD` | Quarter to date | first month of m's quarter … m | [a − ((m−1) mod 3), a] |
| `YTD` | Year to date | Jan … m | [a − m + 1, a] |
| `LTM` | Last 12 months | m − 11 … m, may cross years; months before Jan 2024 are counted (notice) but not listed | [max(0, a − 11), a] |
| `FY` | Full year | Jan … Dec of y (the anchor month does not narrow it) | [a − m + 1, a − m + 12] |
| `RANGE` | Custom range | from the range start (FY, month) to the anchor, across years; a start after the anchor is swapped | [min(s, a), max(s, a)] |

`a` = MonthIdx of (y, m); `s` = MonthIdx of the range start (default January of y).

### 4.3 Version plans (`versions.ts:53-141`)

The base covers the window, cut at the last close when the base is Actual (C-01): `[from, min(to, 32)]`. Because
closed months are a prefix, every plan is at most **two contiguous parts**:

| Plan choice | Part 1 (version, months) | Part 2 | No data ("n/a") when |
|---|---|---|---|
| A (Actual) | ACT, [from, min(to, lastClosed)] | — | from > lastClosed |
| B (Budget) | BUD, [from, to] (C-05) | — | never inside the data |
| LE (Latest estimate) | ACT, [from, min(to, lastClosed)] | FC2609, [max(from, lastClosed + 1, 33), min(to, 35)] (C-02) | both parts empty |
| PY (Prior year) | ACT, [max(from − 12, 0), min(to − 12, lastClosed)] (C-04) | — | to − 12 < 0 |
| NONE | — | — | column switched off |

Columns and their plans (D-31): **Base** = the base choice over the base months; **Compare A / B** = the chosen
comparison over **exactly the base months** (C-03); **Bridge comparison** = Compare A, else Compare B, else PY
(`view-context.ts:121-122`); **Budget** and **Prior year** (status chips, organic growth) = B / PY over the base months;
**FY Budget / FY LE** = B / LE over the whole fiscal year y (`versions.ts:124-139`, M-14), whatever the time view (for a
custom range: the fiscal year of its last month). Translation for every column uses the **selected** FX basis, and in
constant currency the **selected** fiscal year y.

Plan "last month only" (K-23, `view-context.ts:170-178`): the plan restricted to its last month — the end of part 2 if
part 2 exists, else the end of part 1 (ARR, active merchants).

## 5. The P&L line structure (spine, `dim_report_line`; `spine.ts`)

`PL Row` holds these 29 lines in this order; input blocks are followed by their accounts. "Accounts" = the block's
account codes (P / S / shared). The DAX line measures (`04-measures.md` §4) are sums of the listed block sets.

| # | Display | Code | Kind | Formula / block set | Tag | Key | Alias P / Alias S | Cost |
|---:|---|---|---|---|---|---|---|---|
| 01 | 01. GROSS REVENUE | GR | block | {GR}: GR_P1–P2 / GR_S1–S4 | | | Gross sales / Gross billings | no |
| 02 | 02. GROSS-TO-NET DEDUCTIONS | GTN | block | {GTN}: GTN_P1–P5 / GTN_S1–S3 | | | Trade spend & customer deductions / Discounts, credits & refunds | yes |
| 03 | 03. NET REVENUE | NR | subtotal | GR + GTN = {GR, GTN} | | **key** | Net sales / Revenue | no |
| 04 | 04. COST OF REVENUE | COR | block | {COR}: COR_P1–P7 / COR_S1–S5 | | | Cost of goods sold / Cost of revenue | yes |
| 05 | 05. GROSS PROFIT | GP | subtotal | NR + COR | | | Gross profit / Gross profit | no |
| 06 | 06. GROSS MARGIN % | GM_PCT | ratio | GP / NR | | | | no |
| 07 | 07. VARIABLE SELLING & COST-TO-SERVE | VSC | block | {VSC}: VSC_P1–P5 (VSC_P4 tag IC) / VSC_S1–S3 | | | Distribution & channel costs / Acquisition & transaction costs | yes |
| 08 | 08. CONTRIBUTION MARGIN | CM | subtotal | GP + VSC | Mgmt | | | no |
| 09 | 09. CONTRIBUTION MARGIN % | CM_PCT | ratio | CM / NR | | | | no |
| 10 | 10. OPERATING EXPENSES | OPEX | group_total | SM + RD + GA + OOI | | | | yes |
| 11 | 11. SALES & MARKETING | SM | block (level 1 under OPEX) | {SM}: SM_P1–P4 / SM_S1–S4 | | | Advertising, promotion & selling / Sales & marketing | yes |
| 12 | 12. RESEARCH & DEVELOPMENT | RD | block (level 1) | {RD}: RD_P1–P2 / RD_S1–S3 | | | Product innovation / Product development | yes |
| 13 | 13. GENERAL & ADMINISTRATIVE | GA | block (level 1) | {GA}: GA_1–GA_4 (shared) | | | | yes |
| 14 | 14. OTHER OPERATING INCOME / (EXPENSE) | OOI | block (level 1) | {OOI}: OOI_1–OOI_3 (shared) | | | | no |
| 15 | 15. ADJUSTED EBITDA | EBITDA | subtotal | CM + OPEX | MPM | **key** | | no |
| 16 | 16. ADJUSTED EBITDA MARGIN % | EBITDA_PCT | ratio | EBITDA / NR | | | | no |
| 17 | 17. DEPRECIATION & AMORTISATION | DA | block | {DA}: DA_P1–P3 / DA_S1–S3 | | | | yes |
| 18 | 18. UNDERLYING OPERATING PROFIT | UOP | memo | EBITDA + DA | MPM | | | no |
| 19 | 19. ADJUSTING ITEMS (NON-UNDERLYING) | ADJ | block | {ADJ}: ADJ_1–ADJ_3 (shared) | | | | yes |
| 20 | 20. OPERATING PROFIT | OP | subtotal | UOP + ADJ | IFRS 18 | **key** | | no |
| 21 | 21. OPERATING MARGIN % | OP_PCT | ratio | OP / NR | | | | no |
| 22 | 22. INVESTING INCOME | INV | block | {INV}: INV_1–INV_2 (shared) | | | | no |
| 23 | 23. PROFIT BEFORE FINANCING AND INCOME TAXES | PBFIT | subtotal | OP + INV | IFRS 18 | | | no |
| 24 | 24. FINANCING EXPENSES | FIN | block | {FIN}: FIN_1–FIN_3 (shared) | | | | yes |
| 25 | 25. PROFIT BEFORE TAX | PBT | subtotal | PBFIT + FIN | | | | no |
| 26 | 26. INCOME TAX EXPENSE | TAX | block | {TAX}: TAX_1–TAX_2 (shared) | | | | yes |
| 27 | 27. EFFECTIVE TAX RATE % | ETR_PCT | ratio | −TAX / PBT (no favourable colour, M-11) | | | | no |
| 28 | 28. NET PROFIT FOR THE PERIOD | NP | subtotal | PBT + TAX | | **key** | Net earnings / Net income | no |
| 29 | 29. NET MARGIN % | NP_PCT | ratio | NP / NR | | | | no |

Block sets of the subtotals: GP = {GR, GTN, COR}; CM = GP ∪ {VSC}; OPEX = {SM, RD, GA, OOI}; EBITDA = CM ∪ OPEX;
UOP = EBITDA ∪ {DA}; OP = UOP ∪ {ADJ}; PBFIT = OP ∪ {INV}; PBT = PBFIT ∪ {FIN}; NP = every block.

Rules: amounts are signed (M-01), subtotals are plain sums, every ratio divides by NR except the effective tax rate
(M-03); a ratio with a zero or missing denominator is "n/a" (`spine.ts:170-176`). Account leaves of a company: scope
P or BOTH (Consumer Products), S or BOTH (Commerce Cloud); Group: P, S and BOTH (`spine.ts:7-11`). ELIM_GR, ELIM_VSC
and OOI_4 (scope GROUP, no fact rows) are not statement rows. Accounts tagged `IC`: VSC_P4 only (ELIM_* are IC too but
not shown).

## 6. Parameter tables (disconnected; one slicer each; single select unless stated)

Create as calculated tables. Defaults are what the measures fall back to when nothing is selected, and what the saved
report selects (`state/selection-schema.ts:111-138`).

```dax
P Company =
DATATABLE (
    "CompanyCode", STRING
    ,"CompanyName", STRING
    ,"CompanySub", STRING
    ,"CompanySort", INTEGER
    ,"IsBuilt", BOOLEAN
    ,{
        { "P", "Consumer Products", "Goods - retail, D2C, marketplaces", 1, TRUE }
        ,{ "S", "Commerce Cloud", "E-commerce SaaS services", 2, TRUE }
        ,{ "GROUP", "ACME Group", "Coming in build step 4", 3, FALSE }
    }
)
```

```dax
P Fiscal Year =
DISTINCT ( SELECTCOLUMNS ( 'Dim Month', "FiscalYear", 'Dim Month'[FiscalYear] ) )
```

```dax
P Month =
DATATABLE (
    "MonthNumber", INTEGER
    ,"MonthName", STRING
    ,{
        { 1, "Jan" }, { 2, "Feb" }, { 3, "Mar" }, { 4, "Apr" }, { 5, "May" }, { 6, "Jun" }
        ,{ 7, "Jul" }, { 8, "Aug" }, { 9, "Sep" }, { 10, "Oct" }, { 11, "Nov" }, { 12, "Dec" }
    }
)
```

```dax
P Time View =
DATATABLE (
    "TimeViewCode", STRING
    ,"TimeViewLabel", STRING
    ,"TimeViewSort", INTEGER
    ,{
        { "MTD", "One month", 1 }
        ,{ "QTD", "Quarter to date", 2 }
        ,{ "YTD", "Year to date", 3 }
        ,{ "LTM", "Last 12 months", 4 }
        ,{ "FY", "Full year", 5 }
        ,{ "RANGE", "Custom range", 6 }
    }
)
```

```dax
P Range Start =
SELECTCOLUMNS (
    'Dim Month'
    ,"RangeStartIdx", 'Dim Month'[MonthIdx]
    ,"RangeStartLabel", 'Dim Month'[MonthLabel]
    ,"RangeStartFY", 'Dim Month'[FiscalYear]
)
```

```dax
P Base =
DATATABLE (
    "BaseCode", STRING
    ,"BaseLabel", STRING
    ,"BaseSort", INTEGER
    ,{
        { "A", "Actual", 1 }
        ,{ "LE", "Latest estimate", 2 }
        ,{ "B", "Budget", 3 }
    }
)
```

```dax
P Compare A =
DATATABLE (
    "CompareACode", STRING
    ,"CompareALabel", STRING
    ,"CompareASort", INTEGER
    ,{
        { "B", "Budget", 1 }
        ,{ "LE", "Latest est.", 2 }
        ,{ "PY", "Prior year", 3 }
        ,{ "NONE", "None", 4 }
    }
)
```

`P Compare B` is identical with column names `CompareBCode`, `CompareBLabel`, `CompareBSort`.

```dax
P Currency =
DATATABLE (
    "CurrencyCode", STRING
    ,"CurrencySymbol", STRING
    ,"CurrencySort", INTEGER
    ,{
        { "USD", "$", 1 }
        ,{ "EUR", "€", 2 }
        ,{ "GBP", "£", 3 }
    }
)
```

```dax
P FX Basis =
DATATABLE (
    "FxBasisCode", STRING
    ,"FxBasisLabel", STRING
    ,"FxBasisSort", INTEGER
    ,{
        { "ACT", "Actual rates", 1 }
        ,{ "CC", "Constant currency", 2 }
    }
)
```

```dax
P Units =
DATATABLE (
    "UnitsCode", STRING
    ,"UnitsLabel", STRING
    ,"UnitsName", STRING
    ,"Divisor", DOUBLE
    ,"Decimals", INTEGER
    ,"UnitsSort", INTEGER
    ,{
        { "M", "m", "Millions", 1000000, 1, 1 }
        ,{ "K", "k", "Thousands", 1000, 0, 2 }
    }
)
```

```dax
P Cost Sign =
DATATABLE (
    "CostSignCode", STRING
    ,"CostSignLabel", STRING
    ,"CostMultiplier", INTEGER
    ,"CostSignSort", INTEGER
    ,{
        { "NEG", "−", 1, 1 }
        ,{ "POS", "+", -1, 2 }
    }
)
```

```dax
P Show Tags =
DATATABLE ( "ShowTags", STRING, "ShowTagsSort", INTEGER, { { "On", 1 }, { "Off", 2 } } )
```

```dax
P Hide Empty =
DATATABLE ( "HideEmpty", STRING, "HideEmptySort", INTEGER, { { "On", 1 }, { "Off", 2 } } )
```

The web "Variance format" (Amount and % / Amount / %), "% of net revenue column" and "Full-year outlook columns"
switches map to the `Statement Columns` field-parameter slicer (§9): untick the Δ % columns for "Amount", the Δ columns
for "%", "% NR" for the % NR switch, the three FY columns for the outlook switch.

Defaults: Company `P`; Fiscal year 2026; Month 9; Time view `YTD`; Range start = Jan of the selected year; Base `A`;
Compare A `B`; Compare B `PY`; Currency `USD`; FX basis `ACT`; Units `M`; Cost sign `NEG`; Show tags On; Hide empty On;
all 13 statement columns selected.

## 7. Helper and axis tables (disconnected)

```dax
Plan Column =
DATATABLE (
    "Column", STRING
    ,"ColumnDescription", STRING
    ,{
        { "BASE", "Base choice over the base months" }
        ,{ "CMP_A", "Compare A over the base months" }
        ,{ "CMP_B", "Compare B over the base months" }
        ,{ "BRIDGE", "Compare A, else Compare B, else Prior year" }
        ,{ "BUD", "Budget over the base months" }
        ,{ "PY", "Prior year over the base months" }
        ,{ "LE", "Latest estimate over the base months" }
        ,{ "FY_BUD", "Budget over the whole fiscal year" }
        ,{ "FY_LE", "Latest estimate over the whole fiscal year" }
    }
)
```

```dax
Plan Scope =
DATATABLE ( "Scope", STRING, { { "ALL" }, { "LAST" } } )
```

```dax
FX Override =
DATATABLE ( "Basis", STRING, { { "SEL" }, { "ACT" }, { "CC" } } )
```

`Vitals Card` — the ten card slots per company (`engine/vitals.ts`). `Company` = ALL / P / S.

```dax
Vitals Card =
DATATABLE (
    "CardId", STRING
    ,"Company", STRING
    ,"Section", STRING
    ,"Size", STRING
    ,"CardSort", INTEGER
    ,"CardTitle", STRING
    ,"Kind", STRING
    ,"Better", STRING
    ,{
        { "nr", "ALL", "Results", "hero", 1, "Net revenue", "amount", "Higher" }
        ,{ "ebitda", "ALL", "Results", "hero", 2, "Adjusted EBITDA", "amount", "Higher" }
        ,{ "op", "ALL", "Results", "hero", 3, "Operating profit", "amount", "Higher" }
        ,{ "gm", "ALL", "Results", "secondary", 4, "Gross margin %", "ratio", "Higher" }
        ,{ "opex", "ALL", "Results", "secondary", 5, "Opex % revenue", "ratio", "Lower" }
        ,{ "units", "P", "Drivers", "driver", 6, "Units sold", "count", "Higher" }
        ,{ "nrPerUnit", "P", "Drivers", "driver", 7, "Net revenue per unit", "perunit", "Higher" }
        ,{ "gtn", "P", "Drivers", "driver", 8, "Gross-to-net %", "ratio", "Lower" }
        ,{ "ap", "P", "Drivers", "driver", 9, "A&P % of NR", "ratio", "Neutral" }
        ,{ "gmv", "S", "Drivers", "driver", 6, "GMV processed", "amount", "Higher" }
        ,{ "merchants", "S", "Drivers", "driver", 7, "Active merchants", "count", "Higher" }
        ,{ "arr", "S", "Drivers", "driver", 8, "ARR (run-rate)", "amount", "Higher" }
        ,{ "mix", "S", "Drivers", "driver", 9, "Revenue mix", "mix", "Neutral" }
        ,{ "fy", "ALL", "Drivers", "driver", 10, "FY outlook", "fy", "Higher" }
    }
)
```

`Bridge Step` — both bridges' categories (`engine/analysis.ts:70-305`). `Company` ALL / P / S; `Cmp` = the bridge
comparison a start bar belongs to (ALL for the others). Kinds: start, change, subtotal, fx, level, end.

```dax
Bridge Step =
DATATABLE (
    "Bridge", STRING
    ,"StepId", STRING
    ,"StepSort", INTEGER
    ,"StepLabel", STRING
    ,"StepKind", STRING
    ,"Company", STRING
    ,"Cmp", STRING
    ,{
        { "NR", "NR_START_B", 1, "Budget NR", "start", "ALL", "B" }
        ,{ "NR", "NR_START_LE", 2, "Latest estimate NR", "start", "ALL", "LE" }
        ,{ "NR", "NR_START_PY", 3, "Prior year NR", "start", "ALL", "PY" }
        ,{ "NR", "NR_VOL", 10, "Volume", "change", "P", "ALL" }
        ,{ "NR", "NR_PRICE", 11, "Price / mix", "change", "P", "ALL" }
        ,{ "NR", "NR_SUB", 12, "Platform subscriptions", "change", "S", "ALL" }
        ,{ "NR", "NR_PAY", 13, "Payments", "change", "S", "ALL" }
        ,{ "NR", "NR_APP", 14, "Apps, partners & ads", "change", "S", "ALL" }
        ,{ "NR", "NR_PS", 15, "Professional services", "change", "S", "ALL" }
        ,{ "NR", "NR_CC", 20, "Constant-currency NR", "subtotal", "ALL", "ALL" }
        ,{ "NR", "NR_FX", 21, "FX", "fx", "ALL", "ALL" }
        ,{ "NR", "NR_END", 22, "Actual NR", "end", "ALL", "ALL" }
        ,{ "PROFIT", "PR_START_B", 31, "Budget Adj. EBITDA", "start", "ALL", "B" }
        ,{ "PROFIT", "PR_START_LE", 32, "Latest estimate Adj. EBITDA", "start", "ALL", "LE" }
        ,{ "PROFIT", "PR_START_PY", 33, "Prior year Adj. EBITDA", "start", "ALL", "PY" }
        ,{ "PROFIT", "PR_VOL", 40, "Revenue volume", "change", "ALL", "ALL" }
        ,{ "PROFIT", "PR_RATE", 41, "GM rate", "change", "ALL", "ALL" }
        ,{ "PROFIT", "PR_MIX", 42, "GM mix", "change", "ALL", "ALL" }
        ,{ "PROFIT", "PR_VSC", 43, "Variable selling", "change", "ALL", "ALL" }
        ,{ "PROFIT", "PR_SM", 44, "S&M", "change", "ALL", "ALL" }
        ,{ "PROFIT", "PR_RD", 45, "R&D", "change", "ALL", "ALL" }
        ,{ "PROFIT", "PR_GA", 46, "G&A", "change", "ALL", "ALL" }
        ,{ "PROFIT", "PR_OOI", 47, "Other operating", "change", "ALL", "ALL" }
        ,{ "PROFIT", "PR_FX", 48, "FX ", "fx", "ALL", "ALL" }
        ,{ "PROFIT", "PR_EBITDA", 49, "Adj. EBITDA", "subtotal", "ALL", "ALL" }
        ,{ "PROFIT", "PR_DA", 50, "D&A", "level", "ALL", "ALL" }
        ,{ "PROFIT", "PR_ADJ", 51, "Adjusting items", "level", "ALL", "ALL" }
        ,{ "PROFIT", "PR_END", 52, "Operating profit", "end", "ALL", "ALL" }
    }
)
```

28 rows. Sort `StepLabel` by `StepSort`. Power BI needs one sort value per label value, so the profit bridge's FX
label is `"FX "` (with a trailing space; it renders the same as the NR bridge's `"FX"`). Each bridge is its own visual,
filtered to its `Bridge` value.

```dax
Conc Level =
DATATABLE (
    "LevelCode", STRING
    ,"LevelLabel", STRING
    ,"LevelSort", INTEGER
    ,{
        { "NR", "Net revenue", 1 }
        ,{ "CM", "Contribution", 2 }
        ,{ "EBITDA", "Adj. EBITDA", 3 }
    }
)
```

```dax
Trend Row =
DATATABLE (
    "RowKey", STRING
    ,"RowLabel", STRING
    ,"RowSort", INTEGER
    ,{
        { "NA", "North America", 1 }
        ,{ "EU", "Continental Europe", 2 }
        ,{ "AP", "Asia-Pacific", 3 }
        ,{ "UK", "UK & Ireland", 4 }
        ,{ "TOTAL", "Company", 5 }
    }
)
```

(The web orders regions by net revenue, descending; for both companies and every default view that is NA, EU, AP, UK,
which is the static order above. Small multiples cannot be ordered by a measure.)

Sort-by-column settings: `PL Row[LineDisplay]` by `LineSort`; `PL Row[AccountName]` by `AccountSort`;
`Dim Region[RegionName]` by `RegionSort`; `Dim Channel[ChannelName]` by `ChannelSort` (same for Line, Segment);
`Dim Month[MonthLabel]` by `MonthIdx`; every `P …[…Label]` by its `…Sort`; `P Month[MonthName]` by `MonthNumber`;
`Vitals Card[CardTitle]` by `CardSort` (titles are unique); `Conc Level[LevelLabel]` by `LevelSort`;
`Trend Row[RowLabel]` by `RowSort`.

## 8. Calculation group `Comparison Column`

Create in Model view (Calculation groups) or Tabular Editor. Column name `Comparison`. Precedence 10. Items (ordinal,
name, expression). The base-only measures (growth, FY outlook, FX effect — they compare columns themselves) return
blank under every item except Base, as the catalogue does (`chat-metrics.ts:333-336`).

```dax
-- item "Base" (ordinal 0)
CALCULATE (
    SELECTEDMEASURE ()
    ,'Plan Column'[Column] = "BASE"
)
```

```dax
-- item "Budget" (ordinal 4); the other items differ only in the Plan Column value:
--   "Compare A" CMP_A (1) · "Compare B" CMP_B (2) · "Bridge comparison" BRIDGE (3) · "Budget" BUD (4)
--   "Latest Estimate" LE (5) · "Prior Year" PY (6) · "FY Budget" FY_BUD (7) · "FY Latest Estimate" FY_LE (8)
VAR _base_only    =
    ISSELECTEDMEASURE (
        [NR Growth Reported]
        ,[NR Growth Organic]
        ,[EBITDA Growth]
        ,[FY NR LE]
        ,[FY NR Budget]
        ,[FY EBITDA LE]
        ,[FY EBITDA Budget]
        ,[FY NR Attainment]
        ,[FY EBITDA Attainment]
        ,[FX Effect NR]
        ,[FX Effect EBITDA]
        ,[FX Effect OP]
    )
RETURN
    IF (
        _base_only
        ,BLANK ()
        ,CALCULATE (
            SELECTEDMEASURE ()
            ,'Plan Column'[Column] = "BUD"
        )
    )
```

Format string expression of every item: `SELECTEDMEASUREFORMATSTRING ()`.

## 9. Field parameter `Statement Columns`

Modeling → New parameter → Fields, then replace the generated DAX with:

```dax
Statement Columns =
{
    ( "Line note", NAMEOF ( [Stmt Line Note] ), 0 )
    ,( "Base", NAMEOF ( [Stmt Base] ), 1 )
    ,( "% NR", NAMEOF ( [Stmt Pct NR] ), 2 )
    ,( "Compare A", NAMEOF ( [Stmt Cmp A] ), 3 )
    ,( "Δ A", NAMEOF ( [Stmt Delta A] ), 4 )
    ,( "Δ % A", NAMEOF ( [Stmt Delta Pct A] ), 5 )
    ,( "±15% A", NAMEOF ( [Stmt Bar A] ), 6 )
    ,( "Compare B", NAMEOF ( [Stmt Cmp B] ), 7 )
    ,( "Δ B", NAMEOF ( [Stmt Delta B] ), 8 )
    ,( "Δ % B", NAMEOF ( [Stmt Delta Pct B] ), 9 )
    ,( "FY Budget", NAMEOF ( [Stmt FY Budget] ), 10 )
    ,( "FY Latest est.", NAMEOF ( [Stmt FY LE] ), 11 )
    ,( "Δ LE vs Budget", NAMEOF ( [Stmt FY Delta] ), 12 )
}
```

Generated columns: `Statement Columns[Statement Columns]` (name), `[Statement Columns Fields]`, `[Statement Columns Order]`.
The matrix uses the parameter in Values; a multi-select slicer on `Statement Columns[Statement Columns]` (Display panel,
"Statement columns") replaces the web's variance-format and column toggles. Hide-empty reads the selection
(`04-measures.md` §7).

## 10. The Group view (supported, not exposed)

`[Sel Company] = "GROUP"` makes the base amount read both companies **without the rows that carry a counterparty**
(intercompany removed, C-36 / D-33; `aggregate.ts:79-109`): Consumer Products' `VSC_P4` (fees paid to S) and Commerce
Cloud's matching revenue on `GR_S1` / `GR_S2`. Contribution margin and every line below it are unchanged by the
elimination (T-02). Operational figures and slice cuts do not exist for the Group (`chat-metrics.ts:283-286, 323`). The
web report does not show the Group (picker option disabled with the tooltip "Not built yet (ADR-0002 build step 4):
Group view with intercompany eliminations"); keep `P Company[IsBuilt] = FALSE` for GROUP and filter the company slicer
to `IsBuilt = TRUE`. Validation still exercises Group through DAX queries (`08-validation.md`).

## 11. Display folders (suggested)

| Folder | Content |
|---|---|
| `0 Selection` | `Sel …` measures, `Last Closed Idx`, `Latest Forecast …` |
| `1 Window` | `Anchor Idx`, `Win …`, `Base …`, `FY …` |
| `2 Plan` | `Plan …` |
| `3 Base amounts` | `Amt Translated`, `Amt`, `GMV Translated`, `Units Raw`, `GMV Raw`, `Merchants Raw` |
| `4 Lines` | the 23 statement lines and 6 ratios |
| `5 Catalogue` | the other 33 catalogue metrics |
| `6 Statement` | `PL Value`, `Stmt …` |
| `7 Vitals` | `Vit …` |
| `8 Analysis` | `LV …`, `Br …` |
| `9 Profitability` | `Prof …`, `Conc …`, `Trend …`, `Heat …` |
| `10 Header` | `Hdr …`, `Notice …`, `Period …`, `HowTo …`, `Theme …` |

Hide folders 0–3 from report viewers (keep visible in Desktop for authors).
