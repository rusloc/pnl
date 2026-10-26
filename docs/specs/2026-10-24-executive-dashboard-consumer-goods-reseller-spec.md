# Executive Dashboard — Consumer Goods Reseller

Oct 24, 2026 · @KIRILL · (USER-supplied spec, saved verbatim on 2026-10-24; replaces the generic Executive KPI Scorecard spec as the input for the third showcase report; the executive dashboard gets a completely separate design from the P&L "Ledger" system; metric map + metric flow prototype first, USER approval before any build)

For a reseller the executive page is a margin-and-stock story, not a bookings story: net sales and like-for-like growth on top, then gross margin split into front margin (sell price minus cost) and back margin (supplier rebates and allowances), then inventory health (sell-through, weeks of cover, GMROI, availability, markdowns), supplier and channel mix, and cost-to-serve. Twelve tiles, daily refresh from the ERP/POS, drill to category, store or supplier.

## Business context & audience

A multi-category reseller (buys finished goods from brands and distributors, sells through own stores, e-commerce and B2B wholesale) makes money on three levers the dashboard must keep visible at once: sell more at the right price (sales, like-for-like, mix), keep more of each sale (front and back margin, markdowns, shrink), and turn stock faster than it costs to hold (sell-through, weeks of cover, GMROI, availability).

| Attribute | Specification |
| --- | --- |
| Company profile assumed | 20–200 stores or sites plus online and wholesale; 5–15 categories; 200–2,000 suppliers; 20k–200k active SKUs; ERP + POS + WMS + e-commerce platform |
| Readers | CEO / owner, CFO, Commercial / Merchandising director, Supply chain director, Retail operations director, E-commerce head |
| Decision served | Monday trading meeting: what sold, at what margin, what is out of stock or overstocked, which supplier or category needs action this week |
| Cadence | Daily refresh after POS and ERP close (05:00); weekly trading review; monthly close locks the P&L tiles |
| Tile count | 12 on the landing page, 24 approved in the KPI bench |
| Time basis | Retail week and period (4-5-4 or calendar month), week-to-date, period-to-date, YTD; comparators = budget, last year (same retail week), last week |
| Status model | On track / Watch / Off track from tolerance rules per KPI; inverted for cost, markdown, shrink, stock KPIs |
| Interaction | Zero clicks to read; one click to a drill page (Sales, Margin, Inventory, Supplier, Channel); category, store and supplier as drill-through fields |
| Out of scope | SKU-level replenishment, planogram analytics, loyalty CRM analytics, store labour scheduling; these live in domain dashboards |

## KPI catalogue

★ marks the 12 landing-page tiles; the remaining rows ship inactive in the KPI table. Static = loaded from POS / ERP / WMS as additive or snapshot values; Dynamic = computed in DAX from those values and responds to every slicer. Targets default to budget; LY = same retail week or period last year.

| # | Domain | KPI | Type | Formula / source | Target | Tolerance (Watch) | Direction | Period basis | Cadence | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 ★ | Sales | Net sales | Dynamic | Gross sales − returns − discounts − VAT, from POS / order lines | Budget | −3% to 0% | ↑ | WTD, PTD, YTD | Daily | CEO / Commercial |
| 2 ★ | Sales | Like-for-like sales growth % | Dynamic | Net sales of stores/sites open ≥ 13 months ÷ their LY sales − 1 | Budget LFL | −2 pp | ↑ | WTD, PTD, YTD | Daily | Retail ops |
| 3 | Sales | Sales pace vs budget % | Dynamic | Net sales to date ÷ (budget × elapsed trading days share) | 100% | 95–100% | ↑ | WTD, PTD | Daily | Commercial |
| 4 | Sales | Units sold & average selling price | Static + dynamic | Σ units; Net sales ÷ units | Budget | −3% | ↑ | PTD | Daily | Commercial |
| 5 ★ | Sales | Channel mix % (store / online / wholesale) | Dynamic | Channel net sales ÷ total | Plan mix | ±2 pp | context | PTD | Daily | CEO |
| 6 | Sales | Online conversion % and AOV | Dynamic | Orders ÷ sessions; Net sales ÷ orders | Target | −0.3 pp / −5% | ↑ | WTD | Daily | E-commerce |
| 7 | Sales | Store traffic & basket (transactions, items per basket, basket value) | Static + dynamic | Footfall counters; items ÷ transactions; Net sales ÷ transactions | LY | −3% | ↑ | WTD | Daily | Retail ops |
| 8 ★ | Margin | Gross margin % (front) | Dynamic | (Net sales − COGS at landed cost) ÷ Net sales | Budget | −1 pp | ↑ | PTD, YTD | Daily | CFO |
| 9 ★ | Margin | Back margin (supplier income) & total margin % | Dynamic | Rebates + promo funding + listing fees accrued; (Front margin + back margin) ÷ Net sales | Budget | −5% / −1 pp | ↑ | PTD, YTD | Weekly (accrual), monthly (true-up) | CFO / Commercial |
| 10 ★ | Margin | Markdown % of sales | Dynamic | Markdown value (permanent + promo) ÷ Gross sales | Budget | +1 pp | ↓ | PTD | Daily | Commercial |
| 11 | Margin | Promo share of sales % and promo uplift | Dynamic | Sales on promotion ÷ Net sales; promo units ÷ baseline units − 1 | Plan | +3 pp | context | PTD | Weekly | Commercial |
| 12 | Margin | Shrink % | Dynamic | (Book stock − counted stock) at cost ÷ Net sales, from stock counts | ≤ 1% | 1–1.5% | ↓ | Count cycle, R12M | Monthly | Retail ops |
| 13 | Margin | Category margin mix | Dynamic | Margin % by category vs plan; contribution to total margin | Plan | −1 pp | ↑ | PTD | Weekly | Commercial |
| 14 ★ | Inventory | Weeks of cover (forward) | Dynamic | On-hand + on-order stock at cost ÷ forecast weekly COGS (fallback: R4W average) | Target by category | ±2 weeks | context | Point in time | Daily | Supply chain |
| 15 ★ | Inventory | Sell-through % | Dynamic | Units sold in period ÷ (opening stock + receipts) | Target by season | −5 pp | ↑ | PTD, season to date | Weekly | Commercial |
| 16 ★ | Inventory | GMROI | Dynamic | Gross margin (R12M or annualised) ÷ average inventory at cost | ≥ 2.5 (category-specific) | 2.0–2.5 | ↑ | R12M | Weekly | CFO / Supply chain |
| 17 ★ | Inventory | Availability / in-stock % | Dynamic | SKU-store-days in stock ÷ SKU-store-days ranged, top-selling SKUs weighted | ≥ 97% | 95–97% | ↑ | WTD | Daily | Supply chain |
| 18 | Inventory | Aged / excess stock % | Dynamic | Stock at cost older than 90 days (or > 26 weeks cover) ÷ total stock | ≤ 10% | 10–15% | ↓ | Point in time | Weekly | Supply chain |
| 19 | Inventory | Inventory turns | Dynamic | R12M COGS ÷ average inventory at cost | Target | −0.5 | ↑ | R12M | Monthly | Supply chain |
| 20 ★ | Supplier | Supplier OTIF % (inbound) | Dynamic | PO lines received on time and in full ÷ PO lines due | ≥ 95% | 92–95% | ↑ | WTD, PTD | Daily | Supply chain |
| 21 | Supplier | Top-10 supplier concentration % | Dynamic | Top-10 suppliers' COGS ÷ total COGS | Policy cap | +2 pp | ↓ | R12M | Monthly | Commercial |
| 22 | Supplier | Purchase price variance % | Dynamic | (Actual landed cost − standard) ÷ standard × units | 0% | +1% | ↓ | PTD | Weekly | CFO |
| 23 | Cost | Store operating cost % of sales (payroll, rent, utilities) | Dynamic | Store OpEx ÷ Net sales | Budget | +0.5 pp | ↓ | PTD, YTD | Monthly | Retail ops |
| 24 | Cost | Cost to serve online (fulfilment + delivery + returns) per order | Dynamic | Fulfilment costs ÷ orders | Budget | +5% | ↓ | PTD | Weekly | E-commerce |
| 25 ★ | Profit | EBITDA & margin % | Dynamic | Total margin − OpEx; ÷ Net sales | Budget | −5% / −1 pp | ↑ | PTD, YTD | Monthly (flash weekly) | CFO |
| 26 | Cash | Cash conversion cycle (days) = DIO + DSO − DPO | Dynamic | Inventory days + receivable days (wholesale) − payable days | Target | +5 days | ↓ | Point in time | Monthly | CFO |
| 27 | Cash | Cash balance & net debt / headroom | Static | Period-end balances | Covenant / policy | per policy | ↑ | Point in time | Weekly | CFO |
| 28 | Customer | Returns rate % (online) | Dynamic | Returned units ÷ sold units, lagged 30 days | ≤ target | +2 pp | ↓ | PTD | Weekly | E-commerce |
| 29 | Customer | Active loyalty customers & repeat rate | Static + dynamic | Members with ≥ 1 purchase in R12M; customers with ≥ 2 purchases ÷ active | Target | −3% | ↑ | R12M | Monthly | Marketing |
| 30 | Customer | NPS / review score | Static | Survey or review platform export | Target | −5 pts | ↑ | Latest wave | Monthly | Marketing |
| 31 | People | Store payroll hours vs plan & sales per labour hour | Dynamic | Hours worked ÷ planned; Net sales ÷ hours | Plan | ±3% | context | WTD | Weekly | Retail ops |
| 32 | Risk | Data-quality score | Dynamic | % sources refreshed on schedule and reconciled (POS vs GL, stock vs WMS) | 100% | 95–100% | ↑ | Daily | Daily | BI / Finance |

Every tile carries value, Δ vs comparator (absolute and %), 13-week sparkline, status glyph with colour, last-refresh stamp, owner initials and a one-line owner note. Weekly tiles (margin accruals, shrink, EBITDA flash) show a "provisional" badge until month-end close.

## Dimensions & parameters

The landing page exposes three slicers (period, region/format, comparator); every other dimension is reached by drill-through, so the headline reads the same for everyone.

| # | Dimension / parameter | Role | Values / hierarchy | Type | Source | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Retail calendar | Slicer (header) | Fiscal year → Quarter → Period (4-5-4) → Week → Day; attributes: trading day flag, LY same-week key, season, event (Black Friday, Ramadan, Christmas) | Static | Calendar table | LY comparisons by week key, not by date; 53-week year handled by restated LY |
| 2 | Store / site / channel | Slicer (header, region or format level) and drill | Channel (Store, Online, Wholesale, Marketplace) → Region → Format (hyper, super, convenience) → Store; attributes: Open date, Sq m, LFL flag, Cluster | Static | ERP / store master | LFL flag recalculated monthly (open ≥ 13 months, not refitted) |
| 3 | Product | Drill | Division → Category → Subcategory → Brand → SKU; attributes: Private label flag, Price band, Season, Status (active / delisted), Pack size | Static | PIM / ERP | Category manager mapping for ownership |
| 4 | Supplier | Drill | Supplier group → Supplier → Contract; attributes: Terms, Rebate scheme, Lead time, Country | Static | ERP | Back-margin accruals keyed on contract |
| 5 | Comparator | Slicer (header) | Budget / Last year / Last week / Forecast | Dynamic (field parameter) | Report | Drives all Δ columns |
| 6 | Promotion | Drill (margin page) | Promo type (TPR, multibuy, clearance, loyalty) → Event → Promo ID; attributes: Funding source (supplier / own), Start / end | Static | Promo system | Links markdown and uplift |
| 7 | Price band / tier | Drill | Entry, Mid, Premium; Private label vs branded | Static (attribute of Product) | PIM | Mix KPIs |
| 8 | Customer (loyalty) | Drill (customer page) | Segment → Member; attributes: First purchase date, Tier | Static | Loyalty platform | Only aggregated on exec page |
| 9 | Stock location | Drill (inventory page) | DC → Store → Location type (sales floor, backroom, in transit, on order) | Static | WMS / ERP | Weeks of cover uses on-hand + on-order |
| 10 | Cost type | Hidden in measures | COGS (landed), Store OpEx, Central OpEx, Fulfilment, D&A | Static | GL mapping | EBITDA composition |
| 11 | Scenario | Hidden in measures | Actual, Budget, Forecast, LY | Static | GL / planning |  |
| 12 | KPI | Metadata row | Domain, Name, Definition, Measure, Target source, Tolerances, Direction, Format, Cadence, Owner, Drill page, Is active, Is stock | Static metadata | KPI table | Maintained by Finance / BI |
| 13 | Status | Computed | On track / Watch / Off track / N/A | Dynamic | Measure |  |
| 14 | Period mode | Parameter | WTD / PTD / QTD / YTD / R12M / R13W | Dynamic (calc group) | Report |  |
| 15 | Currency & unit | Parameter | Reporting currency; K / M | Dynamic (calc group) | Report | Multi-country only |

## Layout

One landing page (Executive Summary archetype, KPI-strip variant), five drill pages, one board-export page; canvas 1920×1080, 32 px margins, 72 px header, 12-column grid, 8 px snap; slicers synced across pages.

**Landing page**

```
HEADER 72px    "Trading dashboard — Week 43 (20–26 Oct)"   refreshed 24 Oct 05:12   [Period] [Region / Format] [Comparator] [Reset]
STATUS BAR 40px   ● 7 on track  ● 3 watch  ● 2 off track  |  "Off track: Availability 94.1%, Markdown 9.8% of sales"
ROW 1 180px   Net sales (WTD / PTD): value, Δ vs budget, Δ vs LY, pace %, 13-week columns vs budget line     8 cols
              Channel mix: 100% stacked bar Store / Online / Wholesale vs plan, with Δ pp                        4 cols
ROW 2 200px   Margin:     LFL growth %      | Gross margin % (front) | Back margin & total margin % | Markdown % of sales
ROW 3 200px   Stock:      Weeks of cover    | Sell-through %         | GMROI                         | Availability %
ROW 4 200px   Supply &    Supplier OTIF %   | EBITDA & margin (flash)| Top category movers (ranked bar Δ vs LY, 6 cols)
              profit
FOOTER 32px   definitions · owners · [Board export] · provisional-data legend
```

**Tile anatomy** (new Card visual, fixed size, reference labels on)

| Element | Spec |
| --- | --- |
| Label | KPI name 10.5 pt; owner initials right; "provisional" badge for unclosed periods |
| Value | 28–32 pt bold; format from KPI table ($#,##0,K; 0.0%; 0.0 weeks; 0.0×) |
| Reference 1 | Δ vs comparator: "+$412K (+3.1%) vs budget" signed, semantic colour |
| Reference 2 | second comparator or pace: "vs LY +5.4% · pace 97%" |
| Status glyph | ▲ on track / ● watch / ▼ off track in `#107C10` / `#C19C00` / `#D13438`, always with the glyph |
| Sparkline | 13 retail weeks, 160×48 px, grey; target dotted; last point accented |
| Note | Owner's one-liner, 60 characters, full text in tooltip |
| States | N/A (grey), Stale (amber border when source older than its cadence) |

**Status logic**: within each row tiles sort by severity then variance %, so the worst sits left; the status-bar sentence names Off-track KPIs with their value; a tile click drills through to its page with the KPI selected.

**Drill pages** (hidden from navigation, back button, same slicers)

| Page | Hero | Supporting visuals | Detail |
| --- | --- | --- | --- |
| Sales | Net sales by week, actual vs budget vs LY (13–26 weeks) | LFL vs non-LFL bridge; sales by category vs LY (sorted bar, Δ % colour); sales by channel and region small multiples; online funnel (sessions → orders → AOV) | Store ranking table: sales, LFL %, basket, traffic, margin % |
| Margin | Margin bridge: LY margin % → price → mix → cost → markdown → back margin → current | Margin % by category vs plan (dumbbell); markdown by promo type; back margin accrual vs contract target by supplier | Category × subcategory matrix: sales, front %, back %, total %, markdown %, shrink % |
| Inventory | Stock at cost by category vs target cover (bar + target markers) | Sell-through by season/category; aged stock buckets (0–30 / 31–90 / 91–180 / 180+ days); availability by store cluster heatmap; GMROI by category | SKU exception list: out-of-stock top sellers, overstock, delisted with stock |
| Supplier | OTIF trend and by supplier (ranked bar, volume-weighted) | Purchase price variance by supplier; rebate accrual vs earned; concentration Pareto | Supplier scorecard table: spend, OTIF, lead time, PPV, back margin % |
| Channel & customer | Channel mix trend (100% stacked area) | Online conversion / AOV / returns; wholesale order book; loyalty active members and repeat rate | Channel P&L matrix: sales, margin, cost to serve, contribution |

**Board export page**: Letter portrait; table of all active KPIs (Actual, Budget, Δ, Δ %, LY, Status, Owner, Note) plus the net-sales and margin trend; PDF subscription on Monday 07:00 and after month-end close.

**Mobile layout**: status bar → Net sales card → tiles two per row in landing-page order → top category movers; sparklines off; fonts ≥ 9 pt.

## Model & mechanics

A star schema with five facts at their native grain, aggregated to day × store × SKU for the executive model (the SKU-level transactional detail stays in the domain models or in aggregation tables), plus the three metadata tables that make the page configurable.

| Fact | Grain | Key measures | Source | Notes |
| --- | --- | --- | --- | --- |
| Sales | Day × store/channel × SKU (receipt line upstream) | Gross sales, discounts, returns, net sales, units, COGS at landed cost, markdown value, promo flag, transactions | POS, e-commerce, wholesale orders | Import with incremental refresh; 3 years history |
| Inventory snapshot | Day (or week) × location × SKU | On-hand units and cost, on-order, in transit, first-receipt date (ageing) | WMS / ERP | Semi-additive (last snapshot); daily for DCs, weekly for stores if volume requires |
| Purchases / receipts | PO line × receipt | Ordered units, received units, due date, received date, standard and actual cost | ERP | OTIF and PPV |
| Supplier income | Contract × period | Rebate accrual, promo funding, listing fees, earned vs invoiced | ERP / contracts | Back margin; provisional until true-up |
| GL / OpEx | Account × cost centre × period, scenario | Actual, Budget, Forecast amounts | GL, planning | EBITDA, store cost %, cash metrics |
| Traffic & web | Day × store or site | Footfall, sessions, orders | Counters, analytics | Optional |

| Topic | Specification |
| --- | --- |
| Dimensions | Retail calendar (with LY week key), Store, Product, Supplier, Promotion, Scenario, Cost type, Customer (aggregated), Stock location, Currency; all one-to-many single direction |
| KPI metadata | `KPI` (definition, measure name, target source, tolerances, direction, format, cadence, owner, drill page, Is active, Is stock, Stale after), `KPI Target` (KPI × period start × store/category → value, for availability, cover, GMROI targets by category), `KPI Note` (owner comments) |
| Dispatcher measures | `KPI Actual`, `KPI Target`, `KPI Δ`, `KPI Δ %`, `KPI Status`, `KPI Pace %` driven by `SWITCH` on KPI Key, so cards, the board table and the status bar bind to one set |
| LFL | `Store[Is LFL]` recalculated monthly (open ≥ 13 months, not refitted or resized); LFL measures filter both current and LY sides to the same store set |
| LY alignment | Comparisons use `Calendar[LY Week Key]` (same retail week) not `DATEADD`; 53-week years restate LY per the client's policy |
| Stock measures | Last-snapshot-in-period via `MAX` snapshot date with `ALLEXCEPT`; weeks of cover = (on-hand + on-order) ÷ forecast weekly COGS, fallback to R4W average |
| Back margin | Accrual = contract rate × qualifying purchases, provisional flag until finance true-up; total margin = front + back |
| Status | `SWITCH ( TRUE (), blank → N/A, Δ % × direction ≥ 0 → On track, ≥ −tolerance → Watch, Off track )`; colour via theme names `good` / `neutral` / `bad` |
| Refresh | 05:00 daily after POS and WMS close (incremental on Sales and Inventory); GL weekly flash and monthly close; supplier income weekly; stale flag per source timestamp |
| Performance | Executive model ≤ 500 MB: day × store × category aggregation table for landing-page visuals, SKU grain only on drill pages; DAX per visual < 1 s |
| Security | Org app audiences: Executive (all), Regional (RLS by region), Category (RLS by category manager); supplier cost and back margin hidden from store roles via OLS |
| Governance | KPI definitions signed off by CFO and Commercial director; shrink and back margin definitions documented with finance; quarterly KPI review |
| Testing | Net sales reconciles to GL revenue within 0.1%; stock at cost reconciles to balance sheet at month end; OTIF recomputed from a sample of 50 PO lines; LFL store set audited monthly |

**Open parameters to confirm**: retail calendar (4-5-4 vs calendar months) and week start; channels and formats in scope; private-label share and whether to split its margin; how landed cost is held (standard vs actual, freight and duty inclusion); back-margin accrual method; shrink count cadence; availability definition (ranged SKUs vs top sellers); GMROI and cover targets by category; loyalty data availability; reporting currency and countries.
