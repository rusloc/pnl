# P&L Report Spec — SaaS & Consumer Goods

Oct 24, 2026 · @KIRILL · (USER-supplied spec, saved verbatim on 2026-10-24; input for the gap analysis against the ACME Unified P&L)

One P&L model serves both company types: a static ledger spine (revenue → COGS → gross profit → OpEx → EBITDA → net income, summed from GL accounts) and a dynamic layer of ratios, time intelligence and scenario comparisons computed in DAX. SaaS adds the recurring-revenue and unit-economics lines; consumer goods adds the gross-to-net, trade spend and product-margin lines. Static = additive value loaded from source; dynamic = derived at query time from measures, slicers or parameters.

## Metric catalogue

Static lines sum from the GL / sub-ledger at the lowest grain; dynamic KPIs are DAX measures over those lines and respond to every slicer, scenario toggle and period selection. Sign convention: revenue positive, costs negative in the fact; display sign flips per line via a `Sign` attribute on the account dimension. `Applies` = S (SaaS), C (consumer goods), B (both).

| # | Section | Line / KPI | Type | Formula / source | Applies | Key dimensions | Compare vs | Format | Direction |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Revenue | Gross revenue / gross sales | Static | Σ invoiced at list before deductions (C); Σ recognised subscription + services + usage (S) | B | Entity, Product, Customer, Channel, Region, Period | Budget, PY, Forecast | $#,##0,K | ↑ |
| 2 | Revenue | Trade spend & promotions | Static | Σ off-invoice discounts, promo allowances, slotting, coupons, rebates, accruals | C | Customer, Brand, Promo type | Budget, PY | $#,##0,K | ↓ |
| 3 | Revenue | Returns & allowances | Static | Σ returns, damages, markdowns, chargebacks | C | Customer, Product | Budget, PY | $#,##0,K | ↓ |
| 4 | Revenue | Net revenue (NSV) | Dynamic | Gross revenue − trade spend − returns | B | all | Budget, PY, Fcst | $#,##0,K | ↑ |
| 5 | Revenue | Gross-to-net % | Dynamic | 1 − Net revenue ÷ Gross revenue | C | Customer, Brand | Budget, PY | 0.0% | ↓ |
| 6 | Revenue | Subscription revenue | Static | Σ recognised recurring revenue (ASC 606 / IFRS 15, ratable) | S | Product, Plan, Segment, Region | Budget, PY | $#,##0,K | ↑ |
| 7 | Revenue | Services / implementation revenue | Static | Σ professional services recognised | S | Product, Region | Budget, PY | $#,##0,K | ↑ |
| 8 | Revenue | Usage / overage revenue | Static | Σ metered revenue | S | Product, Customer | Budget, PY | $#,##0,K | ↑ |
| 9 | Revenue | Recurring revenue mix % | Dynamic | Subscription revenue ÷ Net revenue | S | Segment | PY | 0% | ↑ |
| 10 | Revenue | Ending ARR | Dynamic | Σ active contract ARR at period end (semi-additive, last snapshot) | S | Product, Segment, Region, Cohort | Budget, PY | $#,##0,K | ↑ |
| 11 | Revenue | ARR bridge (new / expansion / contraction / churn) | Dynamic | Movement between opening and closing ARR snapshot, by type | S | Segment, Product, Cohort | Budget | $#,##0,K | ↑ / ↓ |
| 12 | Revenue | Net revenue retention % | Dynamic | ARR today of customers active 12 m ago ÷ their ARR then | S | Segment, Cohort | Target | 0% | ↑ |
| 13 | Revenue | Deferred revenue balance | Static | Period-end balance sheet account (semi-additive) | S | Entity | PY | $#,##0,K | context |
| 14 | Revenue | Billings | Dynamic | Revenue + Δ deferred revenue | S | Entity | Budget | $#,##0,K | ↑ |
| 15 | Revenue | Volume (units / cases) | Static | Σ units shipped net of returns | C | Product, Customer, Channel | Budget, PY | #,##0 | ↑ |
| 16 | Revenue | Net price per unit | Dynamic | Net revenue ÷ Volume | C | Product, Customer | Budget, PY | $#,##0.00 | ↑ |
| 17 | Revenue | Price / volume / mix variance | Dynamic | Decomposition of Net revenue vs PY or budget into price, volume, mix, FX | C | Product, Customer | PY, Budget | $#,##0,K | context |
| 18 | COGS | Cost of goods sold — materials | Static | Σ standard cost × units + purchase price variance | C | Product, Plant | Budget, PY | $#,##0,K | ↓ |
| 19 | COGS | COGS — manufacturing & conversion | Static | Σ labour, overhead absorption, yield loss | C | Plant, Product | Budget, PY | $#,##0,K | ↓ |
| 20 | COGS | COGS — logistics & warehousing | Static | Σ freight in/out, 3PL, storage | C | Region, Channel | Budget, PY | $#,##0,K | ↓ |
| 21 | COGS | Cost of revenue — hosting & infrastructure | Static | Σ cloud, data centre, third-party APIs, AI inference | S | Product | Budget, PY | $#,##0,K | ↓ |
| 22 | COGS | Cost of revenue — support & success | Static | Σ customer support, CS salaries allocated to COGS | S | Product, Region | Budget, PY | $#,##0,K | ↓ |
| 23 | COGS | Cost of revenue — services delivery | Static | Σ PS delivery cost | S | Region | Budget, PY | $#,##0,K | ↓ |
| 24 | COGS | Total COGS | Dynamic | Σ lines 18–23 (applicable) | B | all | Budget, PY | $#,##0,K | ↓ |
| 25 | Margin | Gross profit | Dynamic | Net revenue − Total COGS | B | all | Budget, PY, Fcst | $#,##0,K | ↑ |
| 26 | Margin | Gross margin % | Dynamic | Gross profit ÷ Net revenue | B | Product, Segment, Region | Budget, PY | 0.0% | ↑ |
| 27 | Margin | Subscription gross margin % | Dynamic | (Subscription revenue − hosting − support) ÷ Subscription revenue | S | Product | Target | 0.0% | ↑ |
| 28 | Margin | Services gross margin % | Dynamic | (Services revenue − services cost) ÷ Services revenue | S | Region | Target | 0.0% | ↑ |
| 29 | Margin | Contribution margin (after variable selling) | Dynamic | Gross profit − variable S&D (freight out, commissions, trade) | C | Product, Customer, Channel | Budget | $#,##0,K | ↑ |
| 30 | Margin | Margin per unit | Dynamic | Gross profit ÷ Volume | C | Product | PY | $#,##0.00 | ↑ |
| 31 | OpEx | Sales & marketing | Static | Σ S&M salaries, commissions, programs, advertising & promotion (A&P) | B | Cost centre, Function, Campaign | Budget, PY | $#,##0,K | ↓ |
| 32 | OpEx | Research & development | Static | Σ R&D salaries, tooling, capitalised-dev offset | B | Cost centre | Budget, PY | $#,##0,K | ↓ |
| 33 | OpEx | General & administrative | Static | Σ G&A | B | Cost centre | Budget, PY | $#,##0,K | ↓ |
| 34 | OpEx | Headcount cost | Static | Σ salaries, benefits, bonus, stock comp (own flag) | B | Function, Cost centre | Budget, PY | $#,##0,K | ↓ |
| 35 | OpEx | Total OpEx | Dynamic | Σ lines 31–33 | B | Function | Budget, PY | $#,##0,K | ↓ |
| 36 | OpEx | OpEx % of revenue (S&M, R&D, G&A) | Dynamic | Each function ÷ Net revenue | B | Function | Benchmark, PY | 0% | ↓ |
| 37 | OpEx | A&P % of net revenue | Dynamic | Advertising & promotion ÷ Net revenue | C | Brand | Budget | 0.0% | context |
| 38 | Profit | EBITDA | Dynamic | Gross profit − Total OpEx (+ D&A add-back) | B | Entity, Segment | Budget, PY, Fcst | $#,##0,K | ↑ |
| 39 | Profit | EBITDA margin % | Dynamic | EBITDA ÷ Net revenue | B | Entity, Segment | Budget, PY | 0.0% | ↑ |
| 40 | Profit | Adjusted EBITDA | Dynamic | EBITDA + stock comp + one-offs (flagged accounts) | B | Entity | Budget | $#,##0,K | ↑ |
| 41 | Profit | Depreciation & amortisation | Static | Σ D&A accounts | B | Entity | Budget | $#,##0,K | ↓ |
| 42 | Profit | EBIT / operating income | Dynamic | EBITDA − D&A | B | Entity | Budget, PY | $#,##0,K | ↑ |
| 43 | Profit | Interest, FX & other | Static | Σ below-the-line accounts | B | Entity | Budget | $#,##0,K | context |
| 44 | Profit | Tax | Static | Σ tax accounts | B | Entity | Budget | $#,##0,K | ↓ |
| 45 | Profit | Net income | Dynamic | EBIT − interest − other − tax | B | Entity | Budget, PY | $#,##0,K | ↑ |
| 46 | Profit | Net margin % | Dynamic | Net income ÷ Net revenue | B | Entity | PY | 0.0% | ↑ |
| 47 | Unit economics | CAC | Dynamic | S&M cost ÷ new customers won (period, optional 1-quarter lag) | S | Segment, Channel | Target | $#,##0 | ↓ |
| 48 | Unit economics | CAC payback (months) | Dynamic | CAC ÷ (new ARR per customer ÷ 12 × gross margin %) | S | Segment | Target | 0.0 | ↓ |
| 49 | Unit economics | Magic number | Dynamic | Δ quarterly ARR × 4 ÷ prior-quarter S&M | S | Entity | Target | 0.00 | ↑ |
| 50 | Unit economics | Rule of 40 | Dynamic | ARR growth % + EBITDA margin % | S | Entity | 40 | 0 | ↑ |
| 51 | Unit economics | Burn multiple | Dynamic | Net cash burn ÷ Net new ARR | S | Entity | Target | 0.0 | ↓ |
| 52 | Unit economics | Revenue per FTE | Dynamic | Net revenue (R12M) ÷ average headcount | B | Function | Benchmark | $#,##0,K | ↑ |
| 53 | Variance | Variance vs budget (abs, %) | Dynamic | Actual − Budget; ÷ Budget; sign-aware per line | B | every line | — | +$#,##0,K; +0.0% | per line |
| 54 | Variance | Variance vs PY (abs, %) | Dynamic | Actual − PY; ÷ PY | B | every line | — | +$#,##0,K; +0.0% | per line |
| 55 | Variance | Variance vs forecast / latest estimate | Dynamic | Actual − Forecast | B | every line | — | +$#,##0,K | per line |
| 56 | Variance | Full-year outlook | Dynamic | YTD actual + remaining-month forecast (or budget) | B | Entity, Segment | Budget | $#,##0,K | context |
| 57 | Time | MTD / QTD / YTD / R12M | Dynamic | Calculation group over any line | B | all | — | inherits | — |
| 58 | Time | Run-rate (annualised) | Dynamic | Latest month × 12 or latest quarter × 4 | B | Entity | Budget FY | $#,##0,K | context |
| 59 | Time | Growth MoM / QoQ / YoY % | Dynamic | (Current − prior) ÷ prior | B | all | — | +0.0% | ↑ |
| 60 | FX | Constant-currency revenue / EBITDA | Dynamic | Local amounts × budget (or PY) rate instead of actual rate | B | Entity, Currency | Actual rate | $#,##0,K | context |
| 61 | FX | FX impact | Dynamic | Reported − Constant-currency | B | Entity | — | +$#,##0,K | context |

Metric subtotals (4, 24, 25, 35, 38, 42, 45) are dynamic measures, never stored, so every subtotal re-computes under any filter; percentage KPIs use `DIVIDE` and return BLANK when the denominator is zero.

## Dimensions

Every dimension is a conformed table shared by the actual, budget and forecast facts; the P&L hierarchy itself is a dimension (Account), so adding a line is a row, not a code change.

| # | Dimension | Grain | Hierarchy / attributes | Applies | Type | Source | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Account (P&L line) | GL account | Statement → Section → Line → Sub-line → Account; attributes: Sign, Sort order, Is subtotal, Is cash, Is adjusted-EBITDA add-back, Variable/Fixed | B | Static | Chart of accounts, mapping table | Parent-child flattened with PATH; mapping owned by Finance |
| 2 | Scenario | Version | Actual, Budget, Forecast (Q1/Q2/Q3 LE), Prior year, Stretch; attributes: Version date, Is locked | B | Static | Planning system / Excel | Drives all variance measures; one active comparison picked by slicer |
| 3 | Date (fiscal) | Day | Fiscal year → Half → Quarter → Period (month or 4-4-5) → Week → Day; attributes: Is closed period, Working days, Relative offsets | B | Static | Calendar table | Marked date table; period-close flag hides open months from actuals |
| 4 | Legal entity / company | Entity | Group → Region → Country → Entity; attributes: Functional currency, Consolidation method | B | Static | ERP | Eliminations as a pseudo-entity |
| 5 | Cost centre / department | Cost centre | Function (S&M, R&D, G&A, COGS) → Department → Cost centre → Manager | B | Static | ERP / HR | Function mapping drives OpEx % KPIs |
| 6 | Product | SKU / plan | Category → Brand → Product line → SKU (C); Product family → Product → Plan / tier (S) | B | Static | ERP, billing | SaaS adds Billing frequency, Is recurring |
| 7 | Customer / account | Customer | Segment (Enterprise, Mid-market, SMB) → Industry → Customer (S); Channel → Key account → Banner → Store (C) | B | Static | CRM, ERP | Customer tier for concentration |
| 8 | Channel / route to market | Channel | Direct, Partner, Marketplace, Self-serve (S); Retail, E-commerce, DTC, Wholesale, Distributor (C) | B | Static | ERP / CRM |  |
| 9 | Geography / market | Country | Region → Sub-region → Country → State; attributes: Currency | B | Static | ERP | Role-plays: ship-to vs bill-to for C |
| 10 | Currency | ISO code | Currency code, symbol, format string; FX rate table by month and rate type (actual, budget, PY) | B | Static + rate table | Treasury | Reporting currency switch is dynamic (calc group) |
| 11 | Customer cohort | Acquisition month | Cohort year → quarter → month | S | Dynamic (derived from first contract date) | Billing | NRR and ARR bridge grain |
| 12 | ARR movement type | Movement | New, Expansion, Contraction, Churn, Reactivation, FX | S | Static | ARR snapshot ETL |  |
| 13 | Promotion / trade event | Promo ID | Promo type → Event → Customer → Period | C | Static | TPM system | Links trade spend to volume uplift |
| 14 | Plant / site / 3PL | Site | Country → Site → Line | C | Static | ERP / MES | For conversion cost and yield |
| 15 | Cost nature | Nature | Variable vs Fixed; Cash vs Non-cash; People vs Non-people; Recurring vs One-off | B | Static (attribute of Account or Cost element) | Mapping | Enables contribution margin and adjusted EBITDA |
| 16 | Headcount / employee | Employee (hidden) | Function → Team; FTE, Start date | B | Static | HRIS | Only aggregated; feeds revenue per FTE |
| 17 | Comparison selector | Parameter | Budget / PY / Forecast / LE | B | Dynamic (field or what-if parameter) | Report | One slicer flips every variance column |
| 18 | Display unit & currency | Parameter | K / M; reporting vs local; constant vs actual rate | B | Dynamic (calculation group) | Report | Dynamic format strings |
| 19 | Period mode | Parameter | Month / QTD / YTD / R12M / FY outlook | B | Dynamic (calculation group) | Report |  |

## Model & parameters

One `GL Fact` holds every scenario at account × entity × cost centre × product × customer × period grain (local and reporting amount); SaaS adds an `ARR Snapshot` fact (customer × month-end) and consumer goods adds a `Sales Line` fact (SKU × customer × day, with units and gross/trade/net columns) so price-volume-mix and gross-to-net resolve below GL grain.

| Topic | Specification |
| --- | --- |
| Scenario handling | Scenario is a column in the fact, never separate tables; `Actual`, `Budget`, `Forecast` measures = `CALCULATE ( [Amount], Scenario[Name] = "..." )`; the comparison selector picks the second operand of every variance measure |
| Static lines | Loaded additive; subtotals are `Is subtotal` rows in Account used only for sort/labels, their values computed by measures over child accounts |
| Dynamic KPIs | Ratios, bridges, retention, unit economics, time intelligence, FX restatement, outlook; all `DIVIDE`-guarded; percentages on the matrix row via a `KPI Format` dynamic format string keyed on Account |
| Sign & variance direction | `Account[Sign]` (+1 revenue / −1 cost) and `Account[Favourable when]` drive green/red so a cost under budget shows favourable |
| P&L matrix | Rows = Account hierarchy (expand to sub-line); columns = Actual, Budget, Var, Var %, PY, Var PY %, with period mode and comparison selector in the header; IBCS notation (actual solid, budget outlined, forecast dashed) |
| Period close | `Date[Is closed]` gates actual lines; open months show forecast in the outlook column, flagged |
| FX | Local amount + rate table (actual, budget, PY rates); constant-currency measures restate at budget rate; FX impact = reported − constant |
| Allocations | Shared cost allocations (hosting to product, overhead to brand) loaded as separate allocation scenario rows with a driver attribute so they can be toggled off |
| Refresh | Monthly after close plus daily flash for revenue lines; budget/forecast versions locked by `Is locked` |
| Security | RLS by Entity and Cost centre manager; OLS hides headcount cost detail below function |

**Open parameters to confirm**: fiscal calendar (month vs 4-4-5); chart-of-accounts mapping owner; forecast cadence (monthly LE vs quarterly); whether trade spend is accrued or cash-based in the ledger; ARR definition (contracted vs live); allocation rules for hosting and shared services; EBITDA adjustments list; reporting currency and rate policy; which subtotal is "the number" for the executive card (EBITDA vs adjusted EBITDA vs contribution margin).
