# Sales & Revenue Dashboard — Power BI Spec Sheet

Oct 23, 2026 · @KIRILL · (USER-supplied generic spec, saved verbatim on 2026-10-24; to be adapted to a SaaS microloans / neobanking business for the second showcase report, Tracks A + B + C)

## Purpose & scope

This spec defines a reusable, client-agnostic Sales & Revenue dashboard in Power BI that an AI builder can generate end to end: semantic model, DAX measures, report pages and governance. It targets the single most-ordered BI deliverable on freelance marketplaces (the "Sales / KPI / P&L dashboard" gig trio) and is written so that one build serves CRM-driven B2B pipelines, transactional B2C/retail sales, and SaaS recurring revenue with configuration rather than redesign.

**In scope**

- Pipeline (open opportunities, stage conversion, velocity, coverage, slippage, forecast categories)
- Bookings (closed-won value, new vs expansion vs renewal, ACV/TCV, discounting)
- Revenue (recognised/invoiced revenue, MRR/ARR for SaaS, gross margin where cost is available)
- Attainment (quota vs actual by rep, team, region, product; pacing against period)
- Breakdowns by product, region/territory, rep/team, customer segment, channel, time
- Activity and productivity (calls, meetings, demos per rep; pipeline created per rep)
- Forecast vs actual, with pipeline snapshot history

**Out of scope** (separate specs): marketing attribution, full P&L / finance close, customer success & churn beyond revenue retention, commission calculation.

**Deliverables the builder must produce**: a PBIP/TMDL semantic model, a `.pbix`/`.pbip` report with the pages in section 7, a measure library (section 6), a data dictionary, RLS roles, and a README with refresh and parameter instructions.

**Assumptions** (confirm with client, see section 10): fiscal year = calendar year; reporting currency single (multi-currency handled via a rate table); CRM = Salesforce-like object model (Account, Opportunity, Product, User, Quota); daily refresh.

## What clients actually order (demand evidence, Oct 2026)

The market splits in two: SMB / e-commerce buyers on gig marketplaces want a 1–3 page "interactive at-a-glance" revenue dashboard from Excel/CSV ($10–$450), while B2B companies via agencies want a 5-page CRM-fed pipeline/forecast/quota solution with role-based views ($3k–$20k+). This spec covers both as tiers of one model.

**Marketplace asks (Freelancer, Fiverr, ComeUp, Upwork — Oct 2026)**

| Signal | Evidence |
| --- | --- |
| Named most in buyer posts | Total revenue, daily & MoM trend, top/bottom products, region, profit margin, date + category slicers, previous-period comparison |
| Sources named | Excel/CSV on OneDrive (most), Google Sheets, SQL, BigQuery, Shopify/WooCommerce exports, Odoo, GoHighLevel; Salesforce/HubSpot/QuickBooks listed by sellers as connectors |
| Buyer budgets | ₹1.5k–37.5k INR (~$18–450); $250–750 for cloud-sourced builds; £5–10/hr |
| Seller Basic tier | $10–$30: 1 page, 1 source, ≤3–5 visuals, 1–3 revisions, 1–2 days; .pbix often only in Standard+ |
| Paid add-ons (ComeUp) | +$36–43 each: extra page (products/customers/regions), time intelligence (YoY, YTD, rolling 12m), plan vs actual, Power Query cleanup; Service publishing & live connections excluded |
| Acceptance criteria buyers now write | "Refresh with a new data dump and KPIs update accurately", "no hard-coded file paths", slicers responsive at ~100k rows, refresh-failure indicator, star schema, hand-off Loom/video, model absorbs new sales streams without rework |

**Agency / B2B asks**

- Canonical page set: Executive summary, Pipeline, Rep performance, Forecast, Territory; start with 5–7 KPIs; three role views (exec, manager, rep) on one model with RLS.
- KPIs promised: total & weighted pipeline, open deals, avg deal size, revenue MTD/QTD, quota attainment, win rate by count/value/segment, stage conversion, days in stage, cycle length, velocity, coverage (~3x), forecast accuracy & bias, movement since last week, margin by deal.
- Pricing unit is dashboards × sources × audiences, not visuals: $2,999 (3 dashboards, 2 sources, 2–3 wks) → $19,999 (10 dashboards, 5+ sources, 6–10 wks) → from $79,999; 1-source builds 2–4 wks, 2–3 sources 4–8 wks.
- Refresh: daily before stand-up is standard; 4–6×/day for high-velocity teams; DirectQuery rarely needed.

**Where a custom build must beat native CRM reporting.** Pipedrive, HubSpot and Salesforce already ship stage pipeline, forecasts, goals, lead-source conversion and win/loss reasons. The custom gap is: multi-source blending (CRM + ERP margin + Excel quotas + Shopify), historical snapshots (forecast accuracy, stage ageing, week-over-week movement), governed time intelligence, and cross-CRM consolidation. Connector limits are spec items: the Salesforce Reports API returns max 2,000 rows (use the Objects connector); Microsoft retired the Dynamics 365 Sales template apps in May 2025; HubSpot→Power BI sync apps start at ~$79/mo.

**Pain the dashboard sells against** (Salesforce State of Sales, n=4,050, fielded Aug–Sep 2025): 60% of the rep week is non-selling, 40% cite lack of data access, 87% report a missing unified view, teams without one platform run ~8 tools, 46% say data quality hurts sales.

**Failure modes to pre-empt** (built for sponsor not user; numbers don't reconcile; too many metrics; stale refresh; no training; spreadsheet is easier) → the spec mandates a signed metric-definition sheet, a reconciliation test against CRM closed-won, a last-refresh/failure indicator, parameterised sources, a data-quality page, ≤8 KPIs per view, subscriptions, and a hand-off guide.

## Personas & the questions each page must answer

Four personas drive the page design; every visual must trace back to one of these questions or be removed.

| Persona | Primary questions | Cadence | Default landing page | Needs |
| --- | --- | --- | --- | --- |
| CRO / VP Sales / Owner | Will we hit the number this quarter? Where is the gap (region, product, team)? Is pipeline coverage enough for next quarter? How reliable is the forecast? | Weekly, board-prep monthly | Executive overview | 6–8 KPIs with target & trend, pacing, forecast vs quota, top risks; mobile view |
| Sales manager / team lead | Which reps are behind pace? Which deals are stuck or slipping? What moved in pipeline this week? Who needs coaching (activity vs output)? | Daily / weekly 1:1 | Pipeline + Rep performance | Leaderboard, stage ageing, pushed deals list, activity vs results, drill to deal |
| Account executive / rep | Where am I vs quota and pace? What do I need to close to hit it? Which of my deals are at risk or idle? | Daily | My performance (RLS-filtered) | Personal attainment, gap-to-goal, next-close deals, task list |
| RevOps / Finance | Are bookings reconciling to invoiced/recognised revenue? What is net new ARR, discounting, margin? Is CRM data hygiene acceptable (missing close dates, stale stages)? | Monthly close, QBR | Bookings & revenue + Data quality | Reconciliation tables, exportable detail, definitions, data-quality flags |

Secondary consumers: Marketing (pipeline sourced by channel), Customer Success (renewal/expansion pipeline), Executive team/board (period summary export to PDF/PowerPoint).

## KPI catalogue

About 30 metrics recur across Salesforce, HubSpot, Gong, Clari/Salesloft, Fullcast, Bridge Group, SaaS Capital and Benchmarkit; the definitions below are the defaults the builder implements, with the known divergences stated so the client can pick. Every KPI maps to a measure in section 6 and must appear in `DATA_DICTIONARY.md` with the definition signed off before build.

**Pipeline**

| KPI | Definition (default) | Grain / window | Direction | Divergences & pitfalls | Benchmark |
| --- | --- | --- | --- | --- | --- |
| Open pipeline | Σ amount of open opportunities with close date in period; Salesforce rollup = Pipeline + Best Case + Commit, excludes Omitted | opp → rep/team/period; as of last snapshot | context | Exclude $0 and negative opps; discount deals open > 2× avg cycle | — |
| Weighted pipeline | Σ amount × stage probability (= SF Expected Revenue, HubSpot Weighted amount) | same | context | Static CRM probabilities overstate late stages; show age-adjusted variant | — |
| Pipeline by forecast category | Closed / Commit / (Most Likely) / Best Case / Pipeline / Omitted; cumulative rollups Commit = Commit + Closed, Best Case = + Best Case | opp → period | context | HubSpot has no fixed probabilities; Clari expects ~90% of Commit to close | — |
| Coverage × | Open pipeline ÷ full-period quota; show remaining-quota variant (Gong) and target = 1 ÷ trailing-4Q win rate | period, weekly | higher, with cap | Fixed 3× implies 33% win rate; SMB 1.7–2.5×, mid-market 2.5–4×, enterprise 4–7× | 3.7–3.8× observed, ICONIQ 2025 |
| Pipeline created | Σ amount and count of opportunities by created date; by source, rep | period | higher | Pipeline needed = gap ÷ win rate − expected from weighted | no AE benchmark published |
| Stage conversion % | Opps that ever entered stage k+1 ÷ entered stage k, cohorted by created date | stage, 12-month cohort | higher | Needs ≥12 months; inconsistent stage use across reps | Opp→won SMB 20–30%, ENT 30–40% (composite, unverified) |
| Win rate % | Won ÷ (Won + Lost) by count on closed-in-period, sales-accepted, positive-value opps; "no decision" = lost; secondary: value-weighted, all-created | close-date cohort, trailing 4Q | higher | Excluding no-decision inflates by 10–15 pp | New 18–19%, expansion 45% (Ebsta × Pavilion 2025, $48B opps); 21% all / 29% qualified |
| Avg deal size | Bookings ÷ deals won (ACV for subscriptions) | period | higher | Mixed terms distort; report by segment | by ACV band: <$10K 31% win … >$100K 15% |
| Sales cycle days | Avg (median shown) close date − created date, won deals | period | lower | State won-only vs all closed | 91 d new / 52 d expansion (Ebsta 2025) |
| Pipeline velocity | Open opps × avg deal × win rate ÷ cycle days | period | higher | Not revenue; skewed by large deals | — |
| Slip rate % | Slipped forecasted deals ÷ forecasted deals (count and value); slipped = close date pushed past period end | period, from snapshots or PushCount | lower | >30% = systemic; slip-adjusted forecast = commit × (1 − slip rate) | 36% of deals slipped (Ebsta 2024 data); top teams <10% |
| Stale / aged deals | Days in stage > segment median × 1.5 (SMB) – 2.0 (ENT); no activity 14 d; close date ≤30 d with no activity | opp | lower | Recalibrate quarterly | — |

**Bookings & revenue**

| KPI | Definition (default) | Grain | Divergences & pitfalls | Benchmark |
| --- | --- | --- | --- | --- |
| Bookings | Σ closed-won amount at signature (close date); count of deals | period, rep, product | LOIs and verbal ≠ bookings | — |
| Bookings by type | New / Expansion / Renewal / Churn (negative); Net new = New + Expansion − Churn | period | Upsells billed as new contracts; record at signature vs go-live policy | Expansion = 40% of new ARR (Benchmarkit 2025) |
| ACV / TCV | ACV = recurring value per 12 months; TCV = full term incl. one-time fees | opp | a16z includes one-time fees in TCV, ChartMogul excludes from ACV | — |
| MRR / ARR | MRR = recurring normalised monthly (annual ÷ 12), net of discounts, excl. services; ARR = annualised contracted recurring (MRR × 12 as alternate) | month-end | Ramped and usage deals diverge; disclose method | — |
| ARR bridge / Net new ARR | Beginning + New + Expansion − Contraction − Churn = Ending | month/quarter | Contracted vs live ARR (phantom churn); multi-year prepaid counted at annual value | — |
| NRR / GRR | Current MRR of customers active 12 months ago ÷ their MRR then; GRR caps each at prior MRR | 12-month cohort | Report both | NRR 101%, GRR 91% median, >1,000 private SaaS, 2025 |
| Bookings → billings → revenue → cash | Billings = invoiced; revenue = recognised (ratable); cash = collected | month | Actuals for accuracy come from ERP, not CRM | — |
| Gross margin % | (Revenue − COGS) ÷ Revenue; split software vs services | period, product | COGS now includes AI inference | Subscription 80–81%, services 30% (2025–26) |
| Avg discount % | (List − Net) ÷ List, by rep, segment, product | opp line | — | ~10% SaaS average (Vendr 2023); >30% = deep |
| Customer concentration | Top-1 and top-10 share; HHI = Σ share² | period | ASC 280 flags ≥10% from one customer | Top customer ~12%, top-5 ~30% (SaaS Capital, secondhand) |
| Growth YoY / QoQ / MoM | (Current − prior) ÷ prior; CMGR for multi-month | period | Rolling 12 months and constant currency for ARR | Median growth 24–26% (2025) |

**Quota, pace, reps**

| KPI | Definition (default) | Divergences & pitfalls | Benchmark |
| --- | --- | --- | --- |
| Attainment % | Bookings ÷ quota, rep and Σ/Σ for team; Gap = quota − bookings | Hybrid quotas weight components | 48% of AEs hit annual quota (Bridge Group 2026, 158 cos); avg attainment 42.7% (RepVue Q2 2025) |
| % reps at quota | Reps with attainment ≥100% ÷ ramped reps | Ramped only; show % at quota, % missed and avg attainment, they differ | Target 60–70%; SDRs 60% (Bridge Group 2025) |
| Pace % | Bookings ÷ (quota × elapsed share of period); projected = bookings ÷ elapsed share; also deals needed = gap ÷ avg deal, pipeline required = gap ÷ win rate | No formal published formula; use selling days if seasonal | — |
| Rep ramp | Months to full productivity; ramped quota 0/25/50/100% by quarter | Quota-based ramp assumes quotas are right | 6.2 months AE, 3.0 SDR (Bridge Group 2025–26) |
| Activity | Calls, emails, meetings, demos, opps created per rep per day/week; tied to outcomes, never a standalone score | Vanity when uncoupled from pipeline | SDR median 112 activities/day, 10 meetings/month quota |

**Forecast**

| KPI | Definition (default) | Divergences & pitfalls | Benchmark |
| --- | --- | --- | --- |
| Forecast accuracy % | 1 − abs(Commit at Day-One snapshot − Actual) ÷ Actual; weekly snapshot series for convergence | Denominator actual (Rox, Clari error rate) vs forecast (Metabase); snapshot cannot be backfilled | ±5% excellent, ±10% good; only 21% of orgs within ±10%; 81% missed a quarter in 7 (Gong 2024) |
| Forecast bias | (Forecast − Actual) ÷ Actual signed, 8-quarter average | >10% = systematic optimism | typical 5–10% |
| Commit-to-close % | Deals in Commit at period start that closed in period | — | ~90% expected (Clari); 80% top vs 60% average on time |

**Role views** (which KPIs each page must carry): CRO = attainment, gap, pace, rep attainment distribution, in- and out-quarter coverage, forecast categories vs actual with Day-One accuracy, net new ARR bridge, NRR/GRR, concentration. Manager = the same by rep plus leaderboard, pipeline by rep/stage, slipped and stale deals, activity vs outcome, ramp cohort. Rep = own quota and pace, own pipeline with ageing flags, next steps, activities. RevOps = hygiene (field completeness, last-updated, stage SLA), conversion and cycle diagnostics.

**Default target band for a mid-market B2B SaaS client** (to seed conditional formatting until the client supplies targets): win rate 20–25% new / 45% expansion; cycle 60–120 days; coverage 3–4×; 50–60% of ramped reps at quota; NRR ≥101%, GRR ≥90%; forecast within ±10% of Day-One commit.

## Data model

One star schema with three kinds of fact table — current-state opportunities (accumulating snapshot), periodic pipeline snapshots (semi-additive) and transactional sales/invoice lines — plus a coarse-grain quota fact dated to the first day of its period, following Microsoft's fact-table typology and Kimball Design Tip 140 ("the opportunity is the entity, the pipeline is the process"). Snapshots and stage history are built upstream (warehouse, lakehouse or Power Query staging) and imported; Power BI never reconstructs history itself.

[embedded content: star schema · 7 fact tables, 6 shared dimensions, 4 helper dimensions]

Shared dimensions filter every fact one way; Quota joins Date on its period-start date, and Sec_User to Salesperson is the single bi-directional relationship, kept only for RLS.

**Fact tables**

| Table | Type | Grain | Keys | Measures / attributes | Source mapping |
| --- | --- | --- | --- | --- | --- |
| `Opportunity` (fact, current state) | Accumulating snapshot | 1 row per opportunity | OpportunityKey, AccountKey, OwnerKey (SCD2), StageKey, ProductFamilyKey, CurrencyKey, CreatedDateKey, CloseDateKey, WonLostDateKey, ForecastCategoryKey | Amount, AmountReporting, Probability, ExpectedRevenue, PushCount, DaysOpen, DaysInCurrentStage, IsClosed, IsWon, Type (New/Expansion/Renewal), LeadSource | SF `Opportunity`; HubSpot `Deal`; D365 `opportunity` |
| `Opportunity Line` | Transaction | 1 row per opportunity product line | OpportunityKey, ProductKey | Quantity, UnitPrice, TotalPrice, ListPrice, Discount % | SF `OpportunityLineItem`; D365 `opportunityproduct` |
| `Pipeline Snapshot` | Periodic snapshot (daily; weekly for >1M rows) | 1 row per open or recently closed opportunity per snapshot date | SnapshotDateKey, OpportunityKey, StageKey, CloseDateKey (role), OwnerKey, ForecastCategoryKey | Amount, ExpectedRevenue, Probability | Daily extract of the CRM opportunity object; no native snapshot object exists in SF/HubSpot/D365 |
| `Stage History` | Event / transaction | 1 row per stage, amount or close-date change | OpportunityKey, ChangeDateKey, FromStageKey, ToStageKey | PrevAmount, Amount, PrevCloseDate, CloseDate | SF `OpportunityHistory`; HubSpot `hs_v2_date_entered_*` unpivoted; D365 audit / `processstage` |
| `Sales Line` (bookings / invoices) | Transaction | 1 row per order or invoice line | OrderDateKey, InvoiceDateKey (role), ProductKey, CustomerKey, SalespersonKey, CurrencyKey | Quantity, NetAmount, Cost, GrossMargin, Discount | ERP / QuickBooks / Shopify / D365 `invoicedetail` |
| `Quota` | Transaction at coarse grain | 1 row per rep (or territory) per month or quarter | PeriodStartDateKey (= first day of period), OwnerKey, optional TerritoryKey / ProductFamilyKey | QuotaAmount | SF `ForecastingQuota`; Excel quota sheet |
| `Activity` | Factless / transaction | 1 row per call, email, meeting, demo | ActivityDateKey, OwnerKey, AccountKey, OpportunityKey, ActivityTypeKey | Count = 1, DurationMinutes | SF Task/Event; HubSpot Engagements |

**Dimensions**: `Date` (marked date table; fiscal columns; `IsWorkingDay`; `RelativeDay/Week/Month` offsets), `Salesperson` (SCD2 surrogate key, team, manager, region, hire date for ramp), `Account/Customer` (segment, industry, country, tier), `Product` (family, line, SKU), `Stage` (sort order, probability default, IsOpen, SLA days), `Forecast Category` (Closed / Commit / Best case / Pipeline / Omitted), `Territory/Region` (hierarchy), `Currency` + `Exchange Rate` (monthly average, first-of-month dated), `Opportunity Type`, `Lead Source`, `Sec_User` (UPN → OwnerKey / TerritoryKey, hidden).

**Relationship rules**

- All relationships one-to-many, single direction, dimension → fact; surrogate integer keys; no snowflakes (denormalise in the source).
- Role-playing dates as separate referencing tables: `Date` (close/order), `Snapshot Date`, `Created Date`, `Invoice Date`; one active relationship each.
- `Quota[PeriodStartDate]` → `Date[Date]` one-to-many; territory- or product-level quotas use a single-direction many-to-many from the dimension; the quota measure returns BLANK below its grain via `ISFILTERED` guards.
- The only bi-directional edge is `Sec_User` → `Salesperson` with "apply security filter in both directions" for RLS propagation.
- Hide every key column, every fact base column that has an explicit measure, and the `Sec_User` table.

**Currency**: store `AmountLocal` + `CurrencyKey` and a pre-converted `AmountReporting` (rate on close date for bookings, on snapshot date for pipeline); a `Currency` calculation group that iterates months, not transactions, is added only when users must switch reporting currency; it skips measures named with `#` or `%`.

**Storage & refresh**: Import with incremental refresh (`RangeStart`/`RangeEnd`) on `Sales Line`, `Pipeline Snapshot`, `Activity`, `Stage History`; Direct Lake on OneLake when data lands in a Fabric lakehouse; DirectQuery only for true real-time needs.

**Data-quality rules computed at load** (surface on page 7): missing or past close date on open opportunities, no activity in 30 days, stage regression, amount change >20% after creation, probability inconsistent with stage default, duplicate account names, opportunity without owner or product.

## DAX measure library

About 45 base measures plus one Time Intelligence calculation group cover every KPI in section 4; the builder emits them as TMDL with description, format string and display folder on each, and never ships implicit measures. Patterns below follow SQLBI DAX Patterns and Microsoft guidance; measures marked *synth.* are this spec's synthesis where no published pattern exists.

**Naming & folders**: `Bookings`, `Bookings PY`, `Bookings YoY %`, `Pipeline Open`, `Quota`, `Attainment %`; folders `01 Bookings & Revenue`, `02 Pipeline`, `03 Quota & Pace`, `04 Win & Cycle`, `05 Forecast`, `06 Activity`, `07 Data quality`, `99 Helpers (hidden)`. Suffixes `#` for counts and `%` for ratios so calculation items can skip them.

**Bookings & revenue**

```dax
Bookings =
CALCULATE (
    SUM ( Opportunity[AmountReporting] )
    ,Opportunity[IsWon] = TRUE ()
    ,USERELATIONSHIP ( Opportunity[WonLostDateKey], 'Date'[DateKey] )
)
```

```dax
Bookings Net New =
VAR _new        = CALCULATE ( [Bookings], 'Opportunity Type'[Type] IN { "New", "Expansion" } )
VAR _churn      = CALCULATE ( [Bookings], 'Opportunity Type'[Type] = "Churn" )
RETURN
    _new - _churn
```

`Revenue` = `SUM ( 'Sales Line'[NetAmount] )`; `Gross Margin %` = `DIVIDE ( [Revenue] - SUM ( 'Sales Line'[Cost] ), [Revenue] )`; `Avg Discount %` = `DIVIDE ( SUMX ( 'Opportunity Line', 'Opportunity Line'[ListPrice] * 'Opportunity Line'[Quantity] ) - SUM ( 'Opportunity Line'[TotalPrice] ), SUMX ( ... ) )`; `ARR` = `[Bookings] * 12` for monthly-term contracts or `SUM ( Opportunity[ARR] )` when stored.

**Pipeline (as of the last snapshot in the visible period)**

```dax
Pipeline Open =
VAR _snap_date  =
    CALCULATE (
        MAX ( 'Pipeline Snapshot'[SnapshotDate] )
        ,ALLEXCEPT ( 'Pipeline Snapshot', 'Snapshot Date' )
    )
RETURN
    CALCULATE (
        SUM ( 'Pipeline Snapshot'[AmountReporting] )
        ,'Snapshot Date'[Date] = _snap_date
        ,Stage[IsOpen] = TRUE ()
    )
```

`Pipeline Weighted` swaps `AmountReporting` for `ExpectedRevenue` (= Amount × Probability). `Pipeline Open #` uses `DISTINCTCOUNT ( 'Pipeline Snapshot'[OpportunityKey] )`. `Pipeline Commit`, `Pipeline Best Case` add `'Forecast Category'[Name] = "Commit"` etc.

```dax
Pipeline Created =
CALCULATE (
    SUM ( Opportunity[AmountReporting] )
    ,USERELATIONSHIP ( Opportunity[CreatedDateKey], 'Date'[DateKey] )
)
```

Pipeline movement between the first and last snapshot of the selected period (*synth.*): build `_s0` and `_s1` as `CALCULATETABLE ( SUMMARIZE ( 'Pipeline Snapshot', 'Pipeline Snapshot'[OpportunityKey], "@amt", SUM ( ... ), "@close", MAX ( ... ), "@stage", MAX ( ... ) ), 'Snapshot Date'[Date] = _d0 )`, then `Movement Created` = Σ amount of `EXCEPT ( _s1, _s0 )`, `Movement Won` / `Movement Lost` = `_s0` rows whose current `Opportunity[IsWon]` / `[IsClosed]` flipped, `Movement Pushed Out` = rows in both with `@close` later in `_s1` and now outside the period, `Movement Pulled In` the reverse, `Movement Resized` = Σ(`@amt1 − @amt0`) over `NATURALINNERJOIN`. A `Pipeline Closing` reconciliation measure asserts `_s0 + created + pulled + resized − won − lost − pushed = _s1`.

**Quota, attainment, pace**

```dax
Quota =
IF (
    NOT ISFILTERED ( 'Date'[Date] )
        && NOT ISFILTERED ( 'Date'[Week] )
    ,SUM ( Quota[QuotaAmount] )
)
```

```dax
Quota Daily =
VAR _period_start = STARTOFMONTH ( 'Date'[Date] )
VAR _period_end   = ENDOFMONTH ( 'Date'[Date] )
VAR _days         = DATEDIFF ( _period_start, _period_end, DAY ) + 1
RETURN
    DIVIDE ( CALCULATE ( SUM ( Quota[QuotaAmount] ), _period_start ), _days )
```

```dax
Pace % =
VAR _today        = TODAY ()
VAR _start        = STARTOFMONTH ( 'Date'[Date] )
VAR _end          = ENDOFMONTH ( 'Date'[Date] )
VAR _elapsed      = DATEDIFF ( _start, MIN ( _today, _end ), DAY ) + 1
VAR _total        = DATEDIFF ( _start, _end, DAY ) + 1
VAR _share        = DIVIDE ( _elapsed, _total )
VAR _quota_to_date = [Quota] * _share
RETURN
    DIVIDE ( [Bookings], _quota_to_date )
```

`Attainment %` = `DIVIDE ( [Bookings], [Quota] )`; `Gap to Quota` = `[Quota] - [Bookings]`; `Projected Bookings` = `DIVIDE ( [Bookings], _share )`; `Coverage x` = `DIVIDE ( [Pipeline Open], [Gap to Quota] )`; `Reps at Quota %` = `DIVIDE ( COUNTROWS ( FILTER ( VALUES ( Salesperson[SalespersonKey] ), [Attainment %] >= 1 ) ), COUNTROWS ( VALUES ( Salesperson[SalespersonKey] ) ) )`. Replace calendar days with `SUM ( 'Date'[IsWorkingDay] )` when selling days matter; use quarter functions when quotas are quarterly.

**Win rate, deal size, cycle, velocity** (by close-date cohort; flags, not stage names)

```dax
Win Rate % =
VAR _won        = CALCULATE ( COUNTROWS ( Opportunity ), Opportunity[IsWon] = TRUE () )
VAR _closed     = CALCULATE ( COUNTROWS ( Opportunity ), Opportunity[IsClosed] = TRUE () )
RETURN
    DIVIDE ( _won, _closed )
```

`Win Rate Value %` uses `SUM ( Opportunity[AmountReporting] )` in both branches. `Avg Deal Size` = `DIVIDE ( [Bookings], [Deals Won #] )`. `Sales Cycle Days` = `AVERAGEX ( FILTER ( Opportunity, Opportunity[IsWon] = TRUE () ), Opportunity[DaysOpen] )`. `Pipeline Velocity` = `DIVIDE ( [Pipeline Open #] * [Avg Deal Size] * [Win Rate %], [Sales Cycle Days] )`. `Stage Conversion %` (k→k+1) = `DIVIDE ( DISTINCTCOUNT of opportunities with a Stage History row entering stage k+1, those entering stage k )`, cohorted by created date. `Days in Stage` = `Opportunity[DaysInCurrentStage]` (computed at load from `LastStageChangeDate`). `Slipped Deals #` = `CALCULATE ( COUNTROWS ( Opportunity ), Opportunity[PushCount] > 0, Opportunity[IsClosed] = FALSE () )`. `Stale Deals #` = open with `LastActivityDate` older than 30 days.

**Forecast accuracy** (from snapshots at a fixed offset before period end)

```dax
Forecast Commit at -30d =
VAR _period_end = MAX ( 'Date'[Date] )
VAR _snap       = _period_end - 30
RETURN
    CALCULATE (
        SUM ( 'Pipeline Snapshot'[AmountReporting] )
        ,REMOVEFILTERS ( 'Snapshot Date' )
        ,'Snapshot Date'[Date] = _snap
        ,'Forecast Category'[Name] IN { "Closed", "Commit" }
        ,'Pipeline Snapshot'[CloseDateKey] <= INT ( FORMAT ( _period_end, "yyyymmdd" ) )
    )
```

`Forecast Error %` = `DIVIDE ( [Forecast Commit at -30d] - [Bookings], [Bookings] )`; `Forecast Bias` = average signed error over the last 8 quarters; `Forecast MAPE %` = average of `ABS` error.

**Time intelligence**: one calculation group `Time Calc` (precedence 20) with items `Current`, `MTD`, `QTD`, `YTD`, `PY`, `PY YTD`, `YoY`, `YoY %`, `R12M` (`DATESINPERIOD ( 'Date'[Date], MAX ( 'Date'[Date] ), -12, MONTH )`), each guarded with `[ShowValueForDates]` so future months stay blank; fiscal year start taken from a `Fiscal Year Start Month` parameter; for 4-4-5 or ISO calendars switch to Microsoft calendar-based time intelligence (preview) or SQLBI week-based filters, and avoid `DATESYTD` with a February year-end (leap-year defect).

```dax
// calculation item: PY
CALCULATE (
    SELECTEDMEASURE ()
    ,DATEADD ( 'Date'[Date], -1, YEAR )
)
```

**Ranking / Top N**: `Rep Rank` = `IF ( ISINSCOPE ( Salesperson[Name] ), RANKX ( ALLSELECTED ( Salesperson ), [Attainment %] ) )`; Top-N via visual-level filter on the rank measure.

**Helpers (hidden)**: `Last Refresh` (from a Power Query timestamp table), `Selected Period Label`, `ShowValueForDates`, `Target Line` (flat quota for line charts), `Currency Symbol` for dynamic format strings, `RLS Check` = `USERPRINCIPALNAME ()` card for testing.

Visual calculations (`RUNNINGSUM`, `MOVINGAVERAGE`, `PREVIOUS`) are used only inside visuals for cumulative-to-quota lines and share-of-total columns, never as model logic.

## Page-by-page layout

Seven visible pages plus two hidden ones, each mapped to a Microsoft report-design archetype so the pages differ in shape rather than repeat one grid. Canvas 1920×1080, 32 px margins, 72 px header band (title left; 1–3 slicers right; page navigator), 8 px snap, 12 columns with 24 px gutters (~133 px tracks). Slicers `Period`, `Region`, `Team/Rep` are synced across pages and kept in the same position.

| # | Page | Archetype | Persona | Visuals (max) | Slicers |
| --- | --- | --- | --- | --- | --- |
| 1 | Overview | Executive Summary, KPI-Strip | CRO / owner | 10 | Period only |
| 2 | Pipeline | Analytical Canvas, Inline-Slicers | Manager | 12 | Period, Region, Team, Stage |
| 3 | Bookings & Revenue | Analytical Canvas, Inline-Slicers | RevOps / Finance | 12 | Period, Region, Product, Type |
| 4 | Rep Performance | Comparative Benchmark, Side-by-Side | Manager / rep | 10 | Period, Team |
| 5 | Product & Region | Analytical Canvas, Small-Multiples | CRO / product | 12 | Period, Product family |
| 6 | Forecast | Comparative Benchmark, Stacked-Pairs | CRO / RevOps | 10 | Period, Forecast category |
| 7 | Activity & Data Quality | Operational Monitor, 4-Up Status | Manager / RevOps | 12 | Period, Team |
| 8 | Opportunity Detail (hidden) | Analytical Canvas, matrix | All | 6 | drill-through fields |
| 9 | Tooltip pages (hidden, 320×240) | — | — | 2–3 per page | — |

The KPI strip answers "are we on track" before any chart is read; the hero carries the trend, the right column carries what changed, and the bottom row carries where to act.

**Page 1 — Overview** (0–1 clicks; cards set to *Filter*, charts *Highlight*, reference visuals *None*)

```
HEADER 72px: "Sales performance — <Period>" | last refresh dd MMM hh:mm | [Period slicer] [Page navigator]
KPI STRIP (2 grid rows, 6 equal cards, h≈140):
  Revenue (period)  | Attainment %     | Open pipeline    | Coverage ×      | Win rate        | Avg deal size
  Δ vs target, Δ% PY| vs pace          | Δ vs last week   | vs 3× norm      | Δ pp vs PY      | Δ% vs PY
ROW 2 (h≈300): Revenue vs target vs PY by month (line+column, 13 months, forecast dashed) 8 cols | Top-5 movers by Δ (ranked bar) 4 cols
ROW 3 (h≈300): Pipeline by stage (horizontal bar, value, count label) 4 cols | Attainment by team (bar vs target line) 4 cols | At-risk deals closing ≤30 d (table ≤8 rows) 4 cols
FOOTER 32px: source · definitions link · [vs Plan | vs PY bookmark toggle] · [Open opportunity detail]
```

**Page 2 — Pipeline**

| Zone | Visual | Fields / measures | Notes |
| --- | --- | --- | --- |
| Hero, full width h≈320 | Pipeline bridge (waterfall) | Opening pipeline → +Created +Pulled-in +Upsized −Won −Lost −Pushed-out −Downsized → Closing | Between two snapshot dates; green/red steps, grey totals |
| Supporting 1 | Stage funnel (bar-style, not triangle) | Open pipeline value and count by stage, stage-order sorted | Chart tooltip shows % of first and % of previous stage |
| Supporting 2 | Pipeline by expected close month, stacked by forecast category | Commit / Best case / Pipeline | 6 months forward; target line |
| Supporting 3 | Deal ageing heatmap (matrix) | Stage × age bucket (0–15, 16–30, 31–60, >60 days) | RAG by days in stage vs stage SLA |
| Detail h≈240 | Deals table | Name, Account, Owner, Stage, Amount, Close date, Days in stage, Pushes, Last activity | Sort by amount; drill-through to Detail |

Field parameter on the hero and funnel: `Amount` / `Weighted amount` / `Count`.

**Page 3 — Bookings & Revenue**

| Zone | Visual | Fields / measures |
| --- | --- | --- |
| KPI row (4) | Bookings, Recognised revenue, Net new ARR (SaaS) or Gross margin (product), Avg discount % | with Δ vs PY and vs plan |
| Hero | Bookings by month, stacked by type (New / Expansion / Renewal / Churn negative) | 24 months; plan outlined |
| Supporting | Bookings → Invoiced → Collected reconciliation (clustered bar or table) | by month; flags variance > 2% |
| Supporting | Revenue by product line vs PY (clustered bar) | sorted desc |
| Supporting | Customer concentration (Pareto: top-N customers cumulative % line over bar) | top 20 |
| Detail | Invoice / order line matrix | exportable |

**Page 4 — Rep Performance** (RLS: a rep sees own row highlighted, team context grey)

| Zone | Visual | Fields / measures |
| --- | --- | --- |
| Headline | Attainment leaderboard (sorted horizontal bar: actual bar + target marker, data labels %) | Rep, Attainment %, Gap to quota |
| Callout | "N of M reps at ≥100% (PY: K)" card | % reps at quota |
| Matrix | Scorecard: Revenue, Quota, Attainment %, Pace %, Open pipeline, Coverage, Win rate, Avg deal, Cycle days, Deals won | icons on attainment; data bars on pipeline |
| Scatter | Win rate (y) × Avg deal size (x), bubble = revenue, colour = attainment band | coaching quadrant |
| Small multiples | Monthly bookings per rep vs quota, shared Y axis (≤12 panels) | top reps by quota |

**Page 5 — Product & Region**

| Zone | Visual | Fields / measures |
| --- | --- | --- |
| Hero | Small-multiples trellis: revenue vs PY by region (6–12 panels, shared Y) | field parameter: Region / Product family / Segment / Channel |
| Supporting | Sorted bar revenue by product (≤15) or treemap (>15) | Δ% PY as colour |
| Supporting | Azure map by country/territory, bubble = revenue, colour = attainment | only if geography is meaningful; otherwise ranked bar |
| Supporting | Product × Region matrix with conditional heat on growth % |  |

**Page 6 — Forecast**

| Zone | Visual | Fields / measures |
| --- | --- | --- |
| KPI row (4) | Quota (period), Closed-won to date, Commit forecast, Gap to quota | plus Best case and Weighted pipeline as reference labels |
| Hero | Forecast vs actual by week within quarter: actual solid, commit dashed, best case dotted, quota flat line | snapshot-based |
| Supporting | Forecast category stacked bar vs quota (Closed / Commit / Best case / Pipeline / Omitted) | by team |
| Supporting | Forecast accuracy trend: MAPE and bias by quarter, last 8 quarters | from snapshots at day −30 / −60 / −90 |
| Supporting | Deals that changed forecast category or close date since last snapshot (table) | with push count |

**Page 7 — Activity & Data Quality**

| Zone | Visual | Fields / measures |
| --- | --- | --- |
| 4 status tiles | Calls, Meetings, Demos, Pipeline created — per rep per week vs target | last updated timestamp in header |
| Hero | Activity vs outcome: small panels on a shared x-axis (activities, pipeline created, bookings) | per rep or team |
| Exception queue | Data-quality table: missing close date, close date in past, stale (no activity 30 d), stage regressed, amount changed >20%, no next step, duplicates | sorted by severity; count card per rule |
| Supporting | Hygiene score by rep (% opportunities clean) | ranked bar |

**Page 8 — Opportunity Detail (hidden drill-through)**: header card strip (Account, Owner, Stage, Amount, Close date, Probability), stage history timeline (stacked bar by stage with days), amount and close-date change log, activity list, back button. Drill-through fields: Opportunity ID, Account, Owner.

**Page 9 — Tooltips (hidden, 320×240)**: (a) category tooltip: count, value, win rate, 6-month sparkline; (b) rep tooltip: attainment, pace, open pipeline, top 3 deals.

**Navigation & interaction rules**: Page Navigator (≤7 visible tabs) is the single primary model; buttons only for drill-through, Back and "Reset filters"; ≤8 bookmarks total (vs Plan/PY toggle, chart/table toggles, reset); Filters pane hidden on Overview, visible with defaults on analytical pages; Personalize visuals enabled on pages 2, 3, 5; every drill-through page keeps the auto back button.

**Mobile layout** (Overview and Rep Performance only): width 323 pt, period slicer horizontal (M 323×100) → 2-up S cards (158×100): Revenue vs target, Attainment, Pipeline & coverage, Win rate → attainment bar vs target (L 323×180) → leaderboard top-10 (L) → revenue trend line, legend off (L); fonts ≥9 pt; no matrices or maps.

## Design system & UX conventions

The report follows IBCS scenario notation (actual solid, prior year lighter, plan outlined, forecast dashed/hatched, signed green/red variance) and Microsoft's 2026 report-design rules for grid, typography and colour; the builder ships these as a report theme JSON, not per-visual overrides.

**Metric → visual mapping (locked)**

| Question | Visual | Never |
| --- | --- | --- |
| Single KPI vs target | New card visual with reference label (Δ, Δ%) and arrow; optional 160×48 sparkline | Gauge, bare card as hero |
| Attainment by rep/team | Sorted horizontal bar with target marker (bullet style) or clustered actual vs target | Gauge, pie |
| Revenue trend | Line/column combo, ≥7 points; PY light, plan outline, forecast dashed | Dual y-axis, area for non-stacked |
| Pipeline by stage | Bar-style funnel or horizontal bar in stage order | Triangular funnel, >10 stages |
| Pipeline movement | Waterfall: totals grey, increases green, decreases red | Stacked bar |
| Mix by product/region | Sorted bar ≤15 categories; treemap >15; map only for spatial questions | Pie >5 slices, rainbow hues |
| Rank / leaderboard | Sorted bar or matrix with data bars + icon set | Unsorted bars |
| Multi-entity comparison | Small multiples 4–12 panels, shared Y | Unshared axes |
| Variance vs plan | Diverging bar at zero, Δ and Δ% side by side, "+" on positives | Colour as only signal |

**Theme tokens** (report theme JSON `dataColors`, `good`/`neutral`/`bad`, text classes)

| Token | Value | Use |
| --- | --- | --- |
| Actual (brand accent) | client brand or `#0F6CBD` | current-period bars/lines, selected series |
| Prior year | 45% tint of accent (e.g. `#9CC3E6`) | PY series |
| Plan / quota | white fill, accent outline 1.5 px; flat line on trends | targets |
| Forecast | accent, dashed 4-2 | forecast series |
| Good / Bad / Warning | `#107C10` / `#D13438` / `#C19C00` | variance, RAG icons (always with glyph ▲▼ or icon) |
| Neutral / context | `#605E5C` / `#BDBDBD` | reference lines, de-emphasised series |
| Chrome | `#E1DFDD` on white/near-white page | borders, gridlines |

Categorical palettes ≤8 hues, colour-blind safe (Microsoft ColorblindSafe-Longer base), same colour for the same category on every page; text contrast ≥4.5:1.

**Typography & number formats** (≤4 sizes, one family, Segoe UI default)

| Element | Size / weight | Format |
| --- | --- | --- |
| Page title | 20 pt SemiBold, top-left, states measure · unit · period | "Bookings vs quota, USD k, Q4 FY26" |
| Visual title | 14 pt SemiBold, phrased as the finding where static ("EMEA 12% below plan") | never the chart type |
| KPI value / delta / label | 32 pt Bold / 12 pt SemiBold semantic colour / 10 pt | `$#,##0,,.0M`; `+#,##0;-#,##0`; `+0.0%;-0.0%` |
| Body / data labels | 10–11 pt; floor 9 pt | currency `$#,##0,.0K` axes, `$#,##0` tables; % 1 decimal below 10%, else 0 |
| Dates | axis `MMM 'yy`; tables `dd MMM yyyy` | week labels `W41` with start date in tooltip |

Numbers right-aligned, tabular figures; negatives as `-1,234` (or parentheses for finance clients).

**Grid & spacing**: 8 px base; 16 px inside a group, 24 px between groups, 32 px page margins, 72 px header; executive page ≤15–20% empty cells; 1–3 slicers inline in the header, 4+ in a 310 px left rail; never a slicer at x<200, y<100.

**Lint rules the builder must pass before publish**: ≤6 cards and ≤12 visuals per page; ≤4 slicers visible; bars start at 0; no secondary y-axis; pie ≤5 slices; ≤8 categorical hues; no hard-coded hex outside the theme; every visual sorted deliberately; alt text on data visuals; refresh timestamp on Overview, Pipeline, Forecast and Activity pages; tab order = reading order; no information reachable only via tooltip or interaction.

## Architecture, platform & governance (state as of Oct 2026)

The builder targets the GA Power BI project format — PBIP with TMDL for the model and PBIR for the report (developer mode GA announced 1 Sep 2026, PBIR the only supported report format) — and validates through Microsoft's own agentic toolchain: the Power BI Authoring MCP server for model edits and DAX tests, and the Desktop Bridge for reload-and-screenshot loops.

**Repository layout the builder emits**

```
SalesRevenue.pbip
.gitignore                      # **/.pbi/localSettings.json, **/.pbi/cache.abf
SalesRevenue.SemanticModel/
  definition.pbism
  definition/
    model.tmdl  database.tmdl  relationships.tmdl  expressions.tmdl
    tables/*.tmdl             # one file per table incl. CG_Time Calc, FP_Metric
    roles/*.tmdl              # RLS roles
    functions/*.tmdl          # DAX UDFs (e.g. Sales.SafeDivide, Sales.FormatCurrency)
    cultures/en-US.tmdl       # synonyms for Copilot
SalesRevenue.Report/
  definition.pbir
  definition/ version.json report.json pages.json reportExtensions.json
    pages/<page>/page.json  pages/<page>/visuals/<visual>/visual.json  mobile.json
    bookmarks/
  StaticResources/RegisteredResources/SalesTheme.json
tests/*.dax                     # EVALUATE queries with expected values
README.md  DATA_DICTIONARY.md   # definitions signed off by the client
```

**Platform features to use (GA unless noted)**: new Card visual with reference labels (GA Nov 2025); Button slicer (GA Oct 2025); Date picker slicer (GA Aug 2026); field parameters (GA Jul 2025); calculation groups with dynamic format strings; visual calculations (GA May 2026); DAX user-defined functions with compound names (GA Jun 2026); Fluent 2 base theme and Theme pane (GA Aug 2026); Org apps with audiences (GA Jul 2026) for role-based distribution; Direct Lake on OneLake (GA Mar 2026) when the client is on Fabric. Preview features (List slicer, calendar-based time intelligence, Prep data for AI, Desktop Bridge) are used only with client consent and noted in the README.

**Modelling conventions & BPA gate**

- Table names in business language without `Dim`/`Fact` prefixes (`Opportunity`, `Salesperson`, `Date`); hidden helpers prefixed `CG_`, `FP_`, `Sec_`.
- Every visible object has a description ≤200 characters that leads with business meaning, unit and exclusions; every measure has a format string; synonyms added for Copilot.
- Keys hidden; numeric columns `SummarizeBy = None`; fact base columns hidden behind explicit measures; `Discourage implicit measures = true`; no auto date/time; currency as Fixed Decimal, never Double.
- BPA (Tabular Editor BPARules.json or `run_model_bpa` in a Fabric notebook) must return zero error-severity findings before publish.

**Security**: dynamic RLS `Sec_User[UPN] = USERPRINCIPALNAME ()` on dimensions, roles `Rep`, `Manager`, `Region`, `Finance`, `Executive` mapped to Entra security groups; consumers only in the Viewer role or app audiences (Admin/Member/Contributor bypass RLS); OLS hides `Cost`/`Margin` columns from the Rep role; validated with View as plus a real test user sign-in for dynamic rules; a sensitivity label on the semantic model so reports inherit it.

**Refresh & connectivity**: daily refresh before the first stand-up (06:00 local) by default; up to 8/day on Pro, 48/day on PPU or Fabric capacity; incremental refresh with 24-month archive and 7-day refresh window on the large facts; on-premises gateway registered for any ERP/SQL source; source paths and credentials as Power Query parameters (no hard-coded paths); a `Last Refresh` timestamp table and refresh-failure e-mail to the owner.

**Deployment**: Dev → Test → Prod workspaces via Fabric git integration (branch per environment) or the `fabric-cicd` library; deployment pipelines are avoided while they reject PBIR reports and require capacity; incremental-refresh models are promoted metadata-only (XMLA/ALM Toolkit), never re-published from Desktop.

**Licensing to state in the proposal**: Pro $14 and PPU $24 per user/month (paid yearly); viewers on F2–F32 still need Pro/PPU, free viewers only on F64+; Copilot needs F2+ or P1+; Direct Lake needs an F SKU; P SKUs are retiring at term end.

**Testing**

| Test | Method | Pass criterion |
| --- | --- | --- |
| Reconciliation | `tests/*.dax` EVALUATE vs source SQL for Bookings, Revenue, Pipeline Open, Quota by year and by owner | Match within 0.1%; documented exceptions |
| Pipeline bridge | Opening + movements − closings = Ending for last 8 weekly snapshots | Zero residual |
| Attainment | Σ rep quota = team quota; attainment at team = Σ bookings / Σ quota | Exact |
| Time intelligence | YTD, PY, YoY % on three known months incl. fiscal-year boundary | Expected values |
| RLS | View as each role + one real user per role | Only own rows; no BLANK visuals |
| Performance | Performance Analyzer JSON per page, model < 500 MB, DAX per visual (project budget) | < 1 s DAX per visual at 1M fact rows; no page > 3 s |
| Lint | Design rules in section 8 run as a script over PBIR visual.json | Zero violations |
| Visual regression | Desktop Bridge `screenshot-all` compared against approved baselines | Reviewed diff |
| Refresh | Full and incremental refresh in Test workspace | Completes; row counts logged |

## Build prompt, tiers & acceptance criteria

The builder is instructed with the block below plus this document; it must stop and ask on any parameter in the open-questions table before generating, and deliver in tiers so the same model serves a $300 marketplace gig and a $20k agency engagement.

**Delivery tiers**

| Tier | Pages | Sources | Measures | Includes | Excludes |
| --- | --- | --- | --- | --- | --- |
| Basic (gig) | Overview + Product & Region | 1 (Excel/CSV/Sheets) | Bookings/Revenue, PY, YoY %, Top N, MTD/QTD/YTD | star schema, theme, parameterised path, .pbix + .pbip, refresh guide, Loom-style README | pipeline snapshots, quota, RLS, Service publishing |
| Standard | + Pipeline, Rep Performance, Forecast | 2 (CRM + quota sheet) | full library incl. attainment, pace, coverage, win rate, cycle | daily snapshot pipeline, calc group, drill-through, mobile layout, workspace publish & schedule | multi-currency, OLS, CI/CD |
| Premium (agency) | all 7 + hidden pages | 3+ (CRM + ERP/finance + activity) | + margin, reconciliation, forecast accuracy, data-quality rules | RLS/OLS roles, Org app with audiences, git CI/CD, test harness, Copilot prep, training | — |

**Prompt to the AI PBI builder**

```markdown
You are building a Sales & Revenue dashboard in Power BI from the attached spec.
Output a PBIP project (TMDL semantic model + PBIR report) plus tests/ and README.

1. Confirm the open parameters below before generating anything.
2. Model: implement section 5 exactly (table names, grain, keys, relationships, hidden
   objects, RLS). Build snapshots and stage history in Power Query from the provided
   extracts if no warehouse exists. Mark Date as the date table.
3. Measures: implement section 6 in TMDL with description, format string and display
   folder on every measure; one Time Calc calculation group; no implicit measures.
4. Report: implement section 7 page by page on a 1920×1080 canvas using the theme in
   section 8; visuals must come only from the metric→visual table; apply the lint rules.
5. Validate: run BPA (zero errors), tests/*.dax reconciliations, RLS View-as per role,
   Performance Analyzer per page, Desktop Bridge screenshot-all; fix and re-run until green.
6. Deliver: PBIP folder, .pbix export, DATA_DICTIONARY.md, README with refresh,
   parameter and extension steps, and a 10-line change log of any deviation from the spec.
Never invent data, stage names or targets; use client values or BLANK with a flagged TODO.
```

**Open parameters to confirm with the client**

| # | Parameter | Default if unanswered |
| --- | --- | --- |
| 1 | Business model: B2B pipeline / transactional retail / SaaS recurring (drives Type, ARR, MRR measures) | B2B pipeline |
| 2 | CRM and version (Salesforce, HubSpot, Dynamics, Pipedrive, Zoho) and extract method | Salesforce Objects connector |
| 3 | Fiscal year start month; week numbering (ISO / US); 4-4-5 calendar? | January; ISO weeks; Gregorian |
| 4 | Reporting currency; multi-currency sources; rate source | single currency |
| 5 | Stage list with sort order, default probability, open/closed-won/closed-lost mapping, SLA days per stage | from CRM metadata |
| 6 | Forecast category names and which count as Commit | SF defaults: Closed, Commit, Best Case, Pipeline, Omitted |
| 7 | Quota grain (rep-month, rep-quarter, team, territory) and source | rep-month from Excel |
| 8 | Bookings definition: close date vs contract start; include renewals? | close date; renewals shown separately |
| 9 | Revenue source and recognition (invoiced, recognised, collected) | invoiced |
| 10 | Snapshot cadence and history depth available | daily, 24 months |
| 11 | Rep hierarchy, team structure, territory assignment history (SCD2 needed?) | current assignment only |
| 12 | Who sees cost/margin; RLS roles and Entra groups | Finance & Exec only |
| 13 | Licensing (Pro / PPU / Fabric SKU) and workspace model | Pro |
| 14 | Brand colours, font, logo; dark mode required? | Fluent 2 default + brand accent |
| 15 | Refresh time and frequency; gateway available? | 06:00 local daily |
| 16 | Known reference figures for reconciliation (last quarter bookings, YTD revenue) | required before sign-off |

**Acceptance criteria (sign-off checklist)**

- [ ] Overview answers "will we hit the number" within 5 seconds: period revenue vs target, attainment, pace, coverage, forecast gap visible without a click
- [ ] Bookings, revenue, pipeline and quota reconcile to the client's reference figures within 0.1%
- [ ] Pipeline bridge sums exactly from opening to closing for the last 8 snapshots
- [ ] Every KPI in section 4 has a measure, a definition in DATA_DICTIONARY.md and appears on at least one page
- [ ] Each role sees only its rows; no visual shows BLANK under any role
- [ ] All pages pass the section 8 lint; mobile layout present for Overview and Rep Performance
- [ ] Refresh succeeds with a new data drop; adding a product, rep or month breaks no visual
- [ ] BPA zero errors; Performance Analyzer within budget; screenshots reviewed
- [ ] README lets a non-developer change the source path, refresh, and add a quota row

## Sources

(Source link list of the original document omitted in this repo copy; the original carries ~120 inline links to Microsoft Learn, SQLBI, Kimball, Salesforce, HubSpot, Gong, Bridge Group, SaaS Capital and marketplace listings, opened 23 Oct 2026.)

**Known gaps**: Upwork and PeoplePerHour job pages could not be fetched; template prices for Numerro, Havens, PowerBI.tips and Enterprise DNA are unverified; the full IBCS 1.2 text and daxpatterns.com currency and week-related pages errored; no Microsoft-published performance thresholds exist, so the budgets in section 9 are project-defined; third-party F-SKU prices are estimates.
