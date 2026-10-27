# ACME Unified P&L — Layout & Technical Requirements

Oct 20, 2026 · @KIRILL

## 1. Scope and entities

Build one management P&L page that shows ACME Consumer Products, ACME Commerce Cloud or the consolidated ACME Group through a single entity switch. Layout, row order, subtotals and columns stay identical across entities. Only leaf lines, slice values and two KPI tiles change.

| Entity | Business | Revenue model | Slices available |
| --- | --- | --- | --- |
| ACME Consumer Products | Wide range of consumer goods | Units × list price, less trade deductions | Region (4), channel (5), category (5), price tier (3) |
| ACME Commerce Cloud | E-commerce SaaS department | Subscriptions, payment fees, apps and partner revenue share, professional services | Region (4), sales motion (3), service line (4), customer segment (3) |
| ACME Group | Consolidated view | Products + Services − intercompany | Region (4), entity |

**Users:** CFO and group finance, entity general managers, FP&A, controllers.

**Assumptions to confirm**

- Monthly close, calendar fiscal year. Sample cut-off used in this spec: actuals closed through Sep 2026.
- Versions: Actual, Budget, Latest estimate (actual months + forecast for open months), prior-year actual.
- IFRS reporter. IFRS 18 takes effect 1 Jan 2027, so the layout follows it from day one.
- Reporting currency selectable (USD default). Local currencies: USD, EUR, GBP, AUD by region.
- Commerce Cloud runs the Consumer Products D2C webstore and its payments. These fees are intercompany.
- BI tool not named. Requirements are tool-neutral; section 8 defines the semantic model any tool can implement.

Requirement IDs (L-, M-, K-, F-, C-, D-, N-, T-) are used throughout so build tickets can reference them. The [interactive prototype](https://claude.ai/artifact/FiSz454hxLvwyzvyiNTTzz) from earlier implements these rules on sample data and can serve as a behaviour reference.

## 2. Page layout

The page reads top to bottom in nine zones: context and controls first, summary next, detail last. Every zone keeps the same position for all three entity views.

&#91;embedded content: report page wireframe · 9 zones, Consumer Products selected\]

The dashed zone appears only when a notice applies; every other zone stays fixed when the entity changes.

| ID | Zone | Content | Behaviour |
| --- | --- | --- | --- |
| L-01 | Header | Report title, data status (last closed month, last refresh time). Entity switch: picker opened from the brand mark at the top of the filter rail (Consumer Products, Commerce Cloud, ACME Group), mark tinted in the selected company's colour, accessible name "Switch company" (ADR-0007) | Entity switch is single select. Switching keeps period, version, currency and region selections. The context line (L-04) names the current company. |
| L-02 | Page tabs | Report · Line definitions · Filters & rules | Definitions and rules pages are static reference content generated from the account hierarchy (section 8). |
| L-03 | Filter band | Three groups: Period & version, Slice, Presentation (section 6) | Wraps to one column below \~900 px. Disabled filters stay visible with a reason. |
| L-04 | Context line | _(replaced, ADR-0007 §3a + ADR-0004: the title row carries a status line (company - Management reporting - closed through - refreshed); the full selection (period sentence, versions, currency, units, FX basis, slices) is listed in the applied-filters pop-up opened from the funnel next to the title)_ | Status line always visible; pop-up on demand. |
| L-05 | Notices | Cut-off, forecast months included, prior year missing, allocation active, intercompany eliminated | Shown only when the condition applies (section 7), as labelled rows of the applied-filters pop-up (no notice strip; ADR-0007 §3a, `docs/design/period-picker-v2.md` Part 2). |
| L-06 | KPI strip | Row 1: 8 financial tiles. Row 2: 4 operational tiles (section 5) | 4 tiles per row on desktop, 2 on tablet, 1 on phone. Each tile: label, value, delta vs Compare A, delta vs Compare B, one-line definition. |
| L-07 | Income statement | Matrix: rows = unified line structure (section 3), columns = the Variance layout (section 4). Expand all / Collapse all buttons above the line column (M-20; ADR-0007) | Main zone; full width. Line column frozen on horizontal scroll. |
| L-08 | Analysis panels | Left: net revenue bridge (waterfall). Right: largest variances (top 8 leaf lines) | Side by side on desktop, stacked on narrow screens. |
| L-09 | Profitability by slice | Table: one row per value of the chosen breakdown; NR, share, growth, GM %, CM %, Adj. EBITDA %, operating margin % | Breakdown selector: Region, Channel, Category/Service line, Segment (Group: Region, Entity). |

**Layout rules**

- L-10 Same zone order, sizes and column set for every entity. No zone appears or disappears on entity switch. (Entity columns exception removed, ADR-0007.)
- L-11 Label slots stay fixed; entity-specific names appear as a secondary label (for example "Cost of revenue · Cost of goods sold").
- L-12 Numbers right-aligned, tabular figures, negatives with a minus sign, variance colour = favourable/unfavourable, not sign.
- L-13 Subtotal rows shaded; key subtotals (Net revenue, Adjusted EBITDA, Operating profit, Net profit) shaded stronger. Ratio rows in italics under their subtotal.
- L-14 Row tags: IFRS 18 (required subtotal), MPM (management-defined measure), Mgmt (management-only subtotal), IFRS 18 category on section rows, IC on intercompany lines, alloc. on allocated lines while a slice filter is on.
- L-15 Info pop-ups: an (i) button in the title row of the net revenue bridge, largest variances, profitability table and contribution margin chart opens a short explanation (what it shows, how to read it, an example, a watch-out). Shared text: `docs/ADD/features/info-popovers.md` (ADR-0007).

## 3. Unified P&L line structure

Both entities run on one 19-step spine. Input blocks hold entity-specific leaf lines; every subtotal is the same formula for both entities and for the group.

| # | Line | Type | Formula | ACME Consumer Products leaf lines | ACME Commerce Cloud leaf lines | IFRS 18 category |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Gross revenue | Input block | Σ leaves | Gross product sales; Shipping & delivery fees billed (D2C) | Subscription platform fees; Payments & transaction fees; Apps, partner revenue share & ads; Professional services | Operating |
| 2 | Gross-to-net deductions | Input block (contra-revenue) | Σ leaves | Trade promotions & retailer allowances; Customer rebates, listing & slotting fees; Consumer coupons & D2C discounts; Returns, damages & spoilage; Prompt-payment discounts | Contractual discounts & promotional credits; Free-trial & onboarding credits; Refunds, SLA credits & billing adjustments | Operating |
| 3 | **Net revenue** | Key subtotal | 1 + 2 | Shown as "Net sales" | Shown as "Revenue" | Operating |
| 4 | Cost of revenue | Input block | Σ leaves | Raw materials & packaging; Sourced finished goods; Direct labour; Manufacturing overhead (ex-depreciation); Inbound freight, duties & tariffs; Royalties on licensed brands; Inventory write-downs & obsolescence | Cloud hosting & infrastructure; Payment processing & interchange; Third-party software, data & partner payouts; Customer support & merchant onboarding; Professional services delivery | Operating |
| 5 | **Gross profit** | Subtotal + ratio | 3 + 4; GM % = 5 ÷ 3 |  |  | Operating |
| 6 | Variable selling & cost-to-serve | Input block | Σ leaves | Outbound freight & last-mile delivery; Warehousing & pick-pack (3PL); Marketplace referral & fulfilment fees; E-commerce platform & payment fees (intercompany); Sales commissions & broker fees | Sales commissions; Partner & agency referral fees; Transaction & merchant credit losses | Operating |
| 7 | **Contribution margin** | Management subtotal + ratio | 5 + 6; CM % = 7 ÷ 3 |  |  | Operating |
| 8a | Sales & marketing | Input block | Σ leaves | Advertising: working media; Consumer promotions, sampling & sponsorship; Marketing overhead; Sales force & key-account management | Performance marketing & paid acquisition; Brand, content & events; Sales & account management staff; Partner programme & ecosystem | Operating |
| 8b | Research & development | Input block | Σ leaves | Product innovation & development; Quality, regulatory & safety testing | Engineering & product management; Data, AI & security platform; Capitalised development costs (credit) | Operating |
| 8c | General & administrative | Shared block | Σ leaves | Finance, legal & HR; IT & corporate systems; Facilities & insurance; Corporate centre allocation | same leaves | Operating |
| 8d | Other operating income / (expense) | Shared block | Σ leaves | Operating FX gains/(losses); Gain/(loss) on disposal of assets; Other operating income | same leaves | Operating |
| 8 | Operating expenses | Group total | 8a + 8b + 8c + 8d |  |  | Operating |
| 9 | **Adjusted EBITDA** | Key subtotal (MPM) + ratio | 7 + 8; margin = 9 ÷ 3 |  |  | Operating |
| 10 | Depreciation & amortisation | Input block | Σ leaves | Depreciation: plants, DCs & equipment; Depreciation: right-of-use assets; Amortisation: acquired brands & customer relationships | Amortisation: capitalised software; Depreciation: servers, equipment & right-of-use assets; Amortisation: acquired intangibles | Operating |
| 11 | Underlying operating profit | Memo subtotal (MPM) | 9 + 10 |  |  | Operating |
| 12 | Adjusting items (non-underlying) | Shared block | Σ leaves | Restructuring & reorganisation; Impairment of goodwill & intangibles; M&A, integration & other one-offs | same leaves | Operating |
| 13 | **Operating profit** | Key subtotal (IFRS 18 required) + ratio | 11 + 12; margin = 13 ÷ 3 |  |  | Operating |
| 14 | Investing income | Shared block | Σ leaves | Share of profit of associates & JVs; Income on cash & investments | same leaves | Investing |
| 15 | Profit before financing and income taxes | Subtotal (IFRS 18 required) | 13 + 14 |  |  | — |
| 16 | Financing expenses | Shared block | Σ leaves | Interest on borrowings; Interest on lease liabilities; FX & other finance costs on financing items | same leaves | Financing |
| 17 | Profit before tax | Subtotal | 15 + 16 |  |  | — |
| 18 | Income tax expense | Shared block + ratio | Σ leaves; ETR = −18 ÷ 17 | Current tax; Deferred tax | same leaves | Income taxes |
| 19 | **Net profit for the period** | Key subtotal + ratio | 17 + 18; margin = 19 ÷ 3 |  |  | — |

**Structure rules**

- M-01 Store every amount signed: revenue and income positive, costs negative. Subtotals are plain sums of signed values; no line-by-line sign logic in formulas.
- M-02 Each leaf line belongs to exactly one block and one scope: Consumer Products, Commerce Cloud, Both (shared code), or Group elimination.
- M-03 Every ratio divides by net revenue (step 3), except the effective tax rate (step 17).
- M-04 D&A is kept out of all functional blocks so Adjusted EBITDA can be shown. Capitalised development is a positive line inside R\&D; its amortisation sits in step 10.
- M-05 In the Group view, each input block expands to entity nodes (Consumer Products, Commerce Cloud) and then leaves. Blocks 1 and 6 also get an Intercompany eliminations node.
- M-06 Full attributes of each leaf (code, definition, IFRS 18 category, nature split, published comparable) are listed in the Line catalogue tab.

All 73 leaf lines with codes, signs, nature weights and definitions: Line catalogue

## 4. Income statement matrix

The statement has one column layout, Variance, for every entity including ACME Group, and one cost lens, By function. Trend, Entity columns and By nature were removed by ADR-0007.

| Layout | Columns, in order | Available for |
| --- | --- | --- |
| Variance | Base · % NR · Compare A · Δ · Δ % · Compare B · Δ · Δ % · FY Budget · FY Latest estimate · Δ LE vs Budget | All views |

**Columns**

- M-10 Δ = base − comparison, on signed values. A positive Δ is favourable on every line, revenue or cost. Δ % = Δ ÷ |comparison|.
- M-11 Ratio rows show values as % and Δ in percentage points. The effective tax rate Δ is shown without favourable/unfavourable colour.
- M-12 % NR = row value ÷ net revenue of the same column.
- M-13 Comparison columns cover exactly the months the base covers (C-03). Show "n/a" when a comparison has no data; leave the cell blank when the line does not belong to that column's entity.
- M-14 Full-year outlook columns always cover the whole fiscal year, whatever the time view. Toggle: Full-year outlook on/off.
- M-15 Variance format toggle: amount and %, amount only, % only. % NR toggle: on/off.
- M-16 _(removed, ADR-0007: Trend layout dropped)_

**Rows**

- M-20 Expand all (every leaf open) and Collapse all (blocks and subtotals only) buttons above the line column; default collapsed. Any row with children also expands or collapses on its own (ADR-0007).
- M-21 Expansion state persists across filter changes and resets to collapsed when the entity changes.
- M-22 Hide empty lines (default on): hide leaf and entity rows whose visible columns all round to zero. Blocks and subtotals always show.
- M-23 _(removed, ADR-0007: one cost lens, By function = the spine in section 3)_
- M-24 _(removed, ADR-0007; nature weights stay in the data for T-07)_ Natures were: Materials, goods & packaging consumed · Employee benefits · Freight, logistics & outsourced services · Advertising, promotion & media · Technology, hosting & software · Commissions, fees, transaction & credit losses · Energy, facilities & other operating costs · Other operating income & FX · Own work capitalised. Each leaf maps to one or more natures with weights summing to 1. A nature row expands to its contributing leaves, each showing its weight.
- M-25 Costs shown as negatives (default) or as positives. Display only; Δ and totals are unaffected.
- M-26 Line column frozen on horizontal scroll; header row sticky when the table is taller than the screen.
- M-27 Drill-through from any leaf cell to the journal lines behind it (account, cost centre, document number).

## 5. KPI strip

> **Vitals (formerly Key figures), 2026-10-27:** the KPI view is named **Vitals** in every track (P&L views redesign v4, `docs/design/P&L views redesign/`). The K-xx IDs below are unchanged; Vitals shows 10 cards (3 results, 2 secondary incl. the new Opex % NR, 5 company-swapped drivers) and the remaining K-xx stay in the model.

Twelve fixed tile slots: eight financial, four operational. Slots 1–3 and 6–8 are identical for every view; slots 4–5 and 9–12 swap content by entity.

| ID | Slot | ACME Consumer Products | ACME Commerce Cloud | ACME Group | Better when |
| --- | --- | --- | --- | --- | --- |
| K-01 | 1 | Net revenue | Net revenue | Net revenue | Higher |
| K-02 | 2 | Organic growth vs prior year | Organic growth vs prior year | Organic growth vs prior year | Higher |
| K-03 | 3 | Gross margin % | Gross margin % | Gross margin % | Higher |
| K-04 | 4 | Gross-to-net % | ARR (period end) | Services share of net revenue | Lower / Higher / Neutral |
| K-05 | 5 | Advertising & promotion % NR | Payments take rate | Intercompany eliminated | Neutral / Higher / Neutral |
| K-06 | 6 | Contribution margin % | Contribution margin % | Contribution margin % | Higher |
| K-07 | 7 | Adjusted EBITDA + margin | Adjusted EBITDA + margin | Adjusted EBITDA + margin | Higher |
| K-08 | 8 | Operating profit + margin | Operating profit + margin | Operating profit + margin | Higher |
| K-09 | 9 | Units sold | GMV processed | Consumer Products operating margin | Higher |
| K-10 | 10 | Net revenue per unit | Active merchants (period end) | Commerce Cloud operating margin | Higher |
| K-11 | 11 | Volume growth vs prior year | Subscription gross margin % | Net profit + margin | Higher |
| K-12 | 12 | Price / mix vs prior year | Rule of 40 | Effective tax rate | Higher / Higher / Neutral |

**Formulas**

| KPI | Calculation |
| --- | --- |
| Organic growth vs prior year | NR at constant currency ÷ prior-year NR at the same rates, same months − 1. Sub-line: reported growth incl. FX. |
| Gross-to-net % | − gross-to-net deductions ÷ gross revenue |
| Advertising & promotion % NR | − (working media + consumer promotions, sampling & sponsorship) ÷ NR |
| Net revenue per unit | NR ÷ units sold |
| Volume growth, price / mix | From the bridge vs prior year (C-40), each ÷ prior-year NR at constant currency |
| ARR (period end) | Subscription net revenue of the last month in the window × 12 |
| Payments take rate | Payments net revenue ÷ GMV processed |
| Active merchants (period end) | Count of merchants with an active paid plan at the last month-end in the window |
| Subscription gross margin % | Gross profit ÷ NR for the Platform subscriptions service line only |
| Rule of 40 | Organic growth % + Adjusted EBITDA margin % |
| Services share of net revenue | Commerce Cloud NR after eliminations ÷ group NR |
| Intercompany eliminated | Fees billed by Commerce Cloud to Consumer Products in the window |

**Tile rules**

- K-20 Each tile shows: label, value, Δ vs Compare A, Δ vs Compare B, one-line definition. Percent KPIs show Δ in percentage points; amount KPIs show Δ %.
- K-21 Δ colour follows the "Better when" column. Neutral KPIs are never coloured.
- K-22 KPIs follow every filter, including slice filters.
- K-23 Period-end KPIs (ARR, active merchants) read the last month of the window, not a sum.
- K-24 _(removed: KPI card v2 replaced the sparklines, ADR-0007 §3a; the `KPI Trend` measures were dropped 2026-10-23)_
- K-25 _(removed: KPI card v2 replaced the target bars, ADR-0007 §3a)_

## 6. Filters

Twenty-one controls in fixed slots. Slice filters keep the same slot for both entities and swap their values; the three entity-specific slices switch off in the Group view.

| ID | Filter | Group | Values | Default | Select | Products | Services | Group |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-01 | Entity | Rail brand mark (ADR-0007) | Consumer Products, Commerce Cloud, ACME Group | Consumer Products | Single | ✓ | ✓ | ✓ |
| F-02 | Fiscal year | Period & version | FY2024 … current FY | Current FY | Single | ✓ | ✓ | ✓ |
| F-03 | Period | Period & version | Jan … Dec; months after cut-off marked "open" | Last closed month | Single | ✓ | ✓ | ✓ |
| F-04 | Time view | Period & version | Month, QTD, YTD, LTM, Full year | YTD | Single | ✓ | ✓ | ✓ |
| F-05 | Base version | Period & version | Actual, Latest estimate, Budget | Actual | Single | ✓ | ✓ | ✓ |
| F-06 | Compare A | Period & version | Budget, Latest estimate, Prior year, None | Budget | Single | ✓ | ✓ | ✓ |
| F-07 | Compare B | Period & version | Budget, Latest estimate, Prior year, None | Prior year | Single | ✓ | ✓ | ✓ |
| F-08 | Region | Slice | North America, Continental Europe, UK & Ireland, Asia-Pacific | All | Multi | ✓ | ✓ | ✓ |
| F-09 | Channel | Slice | Products: Grocery & mass retail, Drugstore & specialty retail, Own D2C webstore, Online marketplaces, Wholesale & distributors. Services (sales motion): Self-serve sign-up, Sales-led (direct), Partner & agency-led | All | Multi | ✓ | ✓ | — |
| F-10 | Category / service line | Slice | Products: Home care, Personal care & beauty, Kitchen & household, Electronics accessories, Toys & leisure. Services: Platform subscriptions, Payments, Apps, partners & ads, Professional services | All | Multi | ✓ | ✓ | — |
| F-11 | Price tier / customer segment | Slice | Products: Premium, Mainstream, Value & private label. Services: Small business, Mid-market, Enterprise | All | Multi | ✓ | ✓ | — |
| F-12 | Reporting currency | Presentation | USD, EUR, GBP | USD | Single | ✓ | ✓ | ✓ |
| F-13 | FX basis | Presentation | Actual rates, Constant currency (budget rates) | Actual rates | Single | ✓ | ✓ | ✓ |
| F-14 | Units | Presentation | Millions, Thousands | Millions | Single | ✓ | ✓ | ✓ |
| F-15 | Costs shown | Presentation | As negatives, As positives | As negatives | Single | ✓ | ✓ | ✓ |
| F-16 | Variance format | Presentation | Amount and %, Amount, % | Amount and % | Single | ✓ | ✓ | ✓ |
| F-17 | Display toggles | Presentation | % of net revenue, Full-year outlook, Classification tags, Hide empty lines | All on | Toggles | ✓ | ✓ | ✓ |
| F-18 | _(removed, ADR-0007: Variance layout only)_ | | | | | | | |
| F-19 | _(removed, ADR-0007: By function only)_ | | | | | | | |
| F-20 | Expand / Collapse | Above the statement's line column | Expand all, Collapse all | Collapsed | Buttons | ✓ | ✓ | ✓ |
| F-21 | Breakdown | Profitability panel | Region, Channel, Category / service line, Segment; Group: Region, Entity | Region for every company (ADR-0007 §3a) | Single | ✓ | ✓ | ✓ |

**Interaction rules**

- F-30 Each entity remembers its own F-09 to F-11 selection. Switching away and back restores it.
- F-31 Region (F-08), period, versions and presentation settings carry across entity switches.
- F-32 In the Group view, F-09 to F-11 are disabled and read "All (consolidated)" with the reason: values differ by entity.
- F-33 A multi-select can never be empty: the last checked value stays on. Each multi-select offers Select all.
- F-34 Every filter applies to every zone: KPIs, statement, bridge, largest variances, profitability.
- F-35 Reset restores the defaults above, keeping the current entity and page tab.
- F-36 The context line (L-04) lists every active slice filter. Any slice filter switches on the allocation notice and alloc. tags (C-30).
- F-37 Optional: remember the last selection per user and support a link that reopens the same selection.

## 7. Calculation rules

All calculations run on unrounded, signed, local-currency amounts at month grain; translation, allocation and elimination happen before aggregation, rounding only at display.

**Time windows** (anchor = selected month m of fiscal year y)

| Time view | Months included |
| --- | --- |
| Month | m |
| QTD | First month of m's quarter … m |
| YTD | Jan … m |
| LTM | m − 11 … m, can cross fiscal years |
| Full year | Jan … Dec of y |

**Versions**

- C-01 Actual never includes months after the last close. If the window reaches past it, those months drop out and a notice suggests Latest estimate.
- C-02 Latest estimate = actuals for closed months + the latest forecast for open months. The notice lists the forecast months.
- C-03 Compare A and B use exactly the months the base covers after C-01.
- C-04 Prior year = base months shifted back 12, Actual version. No prior-year months → "n/a"; some missing → notice.
- C-05 Budget = the approved budget of each fiscal year, phased by month.

**Currency**

- C-10 Store amounts in each region's functional currency. Keep two rate tables vs USD: monthly average actual rates and one budget rate per currency per fiscal year.
- C-11 Actual and forecast months translate at that month's average actual rate. Budget translates at its own year's budget rate.
- C-12 Constant currency translates every version, prior year included, at the selected fiscal year's budget rates.
- C-13 Cross rates go local → USD → reporting currency.

**Allocation**

- C-30 Revenue, gross-to-net, cost of revenue and cost-to-serve are booked at source to region, channel, category/service line and segment.
- C-31 Lines from operating expenses down are booked at entity × region × cost centre. When a slice filter is on, they are allocated by net revenue share within the same entity, region and month: allocated amount = line × NR(slice) ÷ NR(entity, region). Rows tagged alloc.
- C-32 Allocation is pre-computed in the data model (section 8) so totals reconcile at any slice (T-03).

**Intercompany**

- C-35 Intercompany lines carry a counterparty entity at source: Commerce Cloud revenue billed to Consumer Products, and the matching Consumer Products cost in "E-commerce platform & payment fees".
- C-36 ACME Group = Consumer Products + Commerce Cloud + eliminations. Eliminations remove the revenue in block 1 and the cost in block 6, so contribution margin and every line below it are unchanged.
- C-37 A mismatch between the two sides (timing, FX) posts to an "Intercompany difference" line in other operating income/(expense) and is shown whenever it is non-zero.

**Net revenue bridge** (C-40)

The bridge walks from the comparison's net revenue to the base's. Driver steps are at constant currency (cc); FX is the translation difference. Comparison = Compare A, else Compare B, else prior year.

Consumer Products, per lowest slice k (region × channel × category × tier), with U = units:

```latex
\text{Volume}_k = (U_{b,k} - U_{c,k}) \cdot \frac{NR^{cc}_{c,k}}{U_{c,k}}
```

```latex
\text{Price/mix}_k = NR^{cc}_{b,k} - NR^{cc}_{c,k} - \text{Volume}_k
```

```latex
\text{FX} = (NR_b - NR^{cc}_b) - (NR_c - NR^{cc}_c)
```

A slice with no units in either period counts entirely as volume. Commerce Cloud steps: change in NR at constant currency by service line, then FX. Group steps: change by entity, change in eliminations, then FX. Steps must add up exactly: comparison NR + steps = base NR.

**Analysis panels**

- C-45 Largest variances: leaf lines ranked by absolute Δ vs the bridge comparison, top 8. Columns: line, block (and entity in the Group view), base, comparison, Δ, Δ %, favourable/unfavourable.
- C-46 Profitability by slice: per slice value, NR, share of total NR, NR Δ % vs comparison, GM %, CM %, Adj. EBITDA %, operating margin %. In the Group view by region, each region includes its own eliminations.

**Notices** (L-05)

- C-50 Show a notice when: the window passes the last close (C-01); forecast months are included (C-02); prior-year data is missing (C-04); LTM starts before the data history; a slice filter is on (C-31); the Group view is on (C-36).

## 8. Data model

A star schema with one P&L fact at month × slice × account grain, one operational fact, an FX rate table and a shared account hierarchy drives every zone. Entity-specific slice values live in the same dimension tables, keyed by entity, so one filter slot serves both entities.

&#91;embedded content: data model · 4 facts, 12 dimension and mapping tables\]

Shared dimensions and entity-keyed slices filter all three facts; the account hierarchy joins only the two P&L facts, and the rate table translates amounts by currency and month.

**Facts**

| ID | Table | Grain | Measures and keys |
| --- | --- | --- | --- |
| D-01 | fact\_pl | Entity × month × version × region × channel × category/service line × segment × account × counterparty | amount\_local (signed), currency\_code, cost\_centre, forecast\_cycle. Lines from operating expenses down arrive with channel, line and segment = "Unassigned". |
| D-02 | fact\_pl\_allocated | Same grain as D-01, below-CM lines only | Output of C-31: below-CM amounts spread to slices by NR share. Built in the transformation layer; the report reads D-01 for direct lines and D-02 for allocated lines. |
| D-03 | fact\_operational | Entity × month × version × region × channel × line × segment | units\_sold (Products), gmv\_local and active\_merchants\_end (Services) |
| D-04 | fact\_fx\_rate | Currency × month × rate type | rate\_to\_usd for rate type Actual average (monthly) and Budget (one per fiscal year, repeated per month) |

**Dimensions**

| ID | Table | Key attributes |
| --- | --- | --- |
| D-10 | dim\_account | account\_code, label, entity\_scope (Products / Services / Both / Group elimination), block\_code, spine\_step (1–19), sort\_order, natural\_sign, ifrs18\_category, is\_intercompany, definition, published\_comparable |
| D-11 | dim\_report\_line | line\_code, label, row\_type (input block / subtotal / ratio / memo), formula, tag (IFRS 18 / MPM / Mgmt), is\_key, sort\_order, alias\_products, alias\_services. Drives row order and subtotal rows. |
| D-12 | bridge\_account\_nature | account\_code, nature\_code, weight. Weights per account sum to 1. |
| D-13 | dim\_nature | nature\_code, label, sort\_order |
| D-14 | dim\_entity | entity\_code, name, short\_name; also used as counterparty |
| D-15 | dim\_month | month\_key, fiscal\_year, quarter, month\_number, is\_closed (≤ last close) |
| D-16 | dim\_version | version\_code (Actual, Budget, Forecast), forecast\_cycle, is\_latest |
| D-17 | dim\_region | region\_code, name, functional\_currency |
| D-18 | dim\_channel | entity\_code, channel\_code, name, sort\_order |
| D-19 | dim\_line | entity\_code, line\_code, name, sort\_order (category for Products, service line for Services) |
| D-20 | dim\_segment | entity\_code, segment\_code, name, sort\_order (price tier for Products, customer segment for Services) |
| D-21 | Parameter tables | Reporting currency, FX basis, units, base version, Compare A, Compare B, time view, layout, cost lens. Not related to facts. |

**Semantic layer**

- D-30 One base measure translates amount\_local month by month and currency by currency before summing (C-11, C-12). Never translate an aggregated total.
- D-31 Version measures (base, Compare A, Compare B, prior year, FY Budget, FY Latest estimate) reuse the base measure with version and month filters from section 7.
- D-32 Subtotal and ratio rows are evaluated from dim\_report\_line formulas; no subtotal is stored in a fact.
- D-33 Group measure = Products + Services − intercompany, using counterparty in D-01 (C-36).
- D-34 By-nature amounts = account amount × nature weight from D-12.
- D-35 Expected volume for the sample scope: about 36 months × 3 versions × 440 slice combinations × 70 accounts ≈ 3.3 million rows in D-01, well inside import-mode or warehouse limits.

## 9. Non-functional requirements

Targets marked "proposed" are starting values for you to confirm with users.

| ID | Area | Requirement |
| --- | --- | --- |
| N-01 | Performance | Any filter change re-renders all zones in under 2 s at the 95th percentile (proposed). Expanding or collapsing a row responds in under 0.3 s. **Showcase target (ADR-0008):** each view renders in ≤ 5 s after a filter change; 5–10 s is the accepted worst case. |
| N-02 | Refresh | Actuals load after each monthly close; budget and forecast load when a version is approved. The header shows the last refresh time and the last closed month. |
| N-03 | Close control | The last closed month comes from dim\_month.is\_closed, set by finance, never from the latest data date. |
| N-04 | Security | Row-level security by entity and region. Entity managers see their entity only; the Group view and eliminations need group access. |
| N-05 | Versions and audit | Budget is locked after approval. Each forecast cycle is kept. A closed month's figures reproduce exactly on re-run. |
| N-06 | Number format | Millions with 1 decimal, thousands with 0; percentages with 1 decimal; take rate with 2; thousands separators; minus sign for negatives; tabular figures. Currency symbol on KPI tiles. |
| N-07 | Colour | Favourable and unfavourable use two colours plus the sign or a text label, so meaning does not rely on colour alone. |
| N-08 | Accessibility | All filters, tabs and row toggles keyboard-operable with visible focus; WCAG 2.1 AA contrast; KPI tiles readable by screen readers. |
| N-09 | Screens | Designed for 1280 px and wider; usable at 1024 px; on phones, KPI strip and statement at Summary detail. |
| N-10 | Export | Statement to Excel keeping the hierarchy, with filters and the context line in the header. Page snapshot to PDF. |
| N-11 | Labels | All labels come from dim\_account, dim\_report\_line and dimension tables, so translation and renaming need no report change. |
| N-12 | Reference pages | Line definitions and Filters & rules pages are generated from the same tables as the report, so they cannot drift. |
| N-13 | Data quality | Tests in section 10 run after every load. A failed test blocks publishing the refresh. |

## 10. Acceptance tests

The build is accepted when every test below passes on full data for at least one closed month, one open month and one first-year window.

**Reconciliation**

- [ ] T-01 ACME Group = Consumer Products + Commerce Cloud + eliminations, on every line and every column.
- [ ] T-02 Eliminations leave contribution margin and every line below it unchanged.
- [ ] T-03 For each slice dimension, the sum over its values equals the unfiltered total on every line, allocated lines included.
- [ ] T-04 _(removed, ADR-0007: By nature lens dropped)_
- [ ] T-05 Bridge: comparison NR + all steps = base NR, to the unit.
- [ ] T-06 Net revenue, operating profit and net profit for a closed month match the general ledger trial balance per entity.
- [ ] T-07 Every account has a block, spine step, IFRS 18 category and nature weights summing to 1.

**Behaviour**

- [ ] T-10 Constant currency: the bridge FX step is zero and no variance contains FX.
- [ ] T-11 Base Actual with a window past the last close drops the open months, comparisons use the same months, and the notice shows.
- [ ] T-12 Prior year for the first year of data shows "n/a" with a notice.
- [ ] T-13 A cost below budget gives a positive, favourable Δ; revenue below budget gives a negative, unfavourable Δ.
- [ ] T-14 Switching entity keeps period, versions, currency and region, and restores each entity's own slice selection.
- [ ] T-15 The Group view disables channel, category and segment filters and shows the reason.
- [ ] T-16 Hide empty lines never hides a block or subtotal.
- [ ] T-17 Period-end KPIs (ARR, active merchants) equal the last month of the window, not a sum.
- [ ] T-18 N-01 performance target holds at full data volume.

## 11. Out of scope and sources

**Not in version 1**

- Balance sheet, cash flow and working capital views.
- KPIs that need data outside the P&L: net revenue retention, churn and CAC payback (billing and CRM), sell-out and market share (retail panels), on-time-in-full (supply chain).
- Variance commentary entered per line and period.
- Several forecast cycles selectable side by side (for example 3+9, 6+6, 9+3).
- Further slices: brand and SKU, retail customer account, legal entity, cost centre, plan tier, signup cohort, partner.

**Research basis**

| Source | What it shows | Used for |
| --- | --- | --- |
| [P&G financial statements](https://www.sec.gov/Archives/edgar/data/0000080424/000008042412000063/fy2012financialstatementsf.htm) | Coupons and customer trade funds reduce net sales; cost of products sold includes distribution and inbound freight | Gross-to-net block; distribution moved below gross profit as a deliberate change |
| [Unilever full-year results](https://sec.gov/Archives/edgar/data/217410/000165495424001469/a4104c.htm) | Underlying sales growth split into volume and price; brand and marketing investment as % of turnover; non-underlying items | Organic growth, volume and price/mix, A&P % NR, adjusting items |
| [Amazon 10-K](https://www.sec.gov/Archives/edgar/data/0001018724/000101872414000006/amzn-20131231x10k.htm) | Product and service sales in one statement; fulfilment covers warehousing, picking, packing and payment processing; shared costs allocated to segments | Goods and services on one face; cost-to-serve block; allocation rule |
| [Shopify 10-K FY2025](https://www.sec.gov/Archives/edgar/data/1594805/000159480526000007/shop-20251231.htm) | Subscription and merchant solutions revenue with matching cost of revenues; transaction and loan losses line | Service-line streams, hosting and payment processing costs, credit losses, GMV and take rate |
| [BigCommerce results](https://investors.bigcommerce.com/news-releases/news-release-details/bigcommerce-announces-third-quarter-2022-financial-results/) | Subscription and partner & services revenue; subscription ARR; revenue by region | Apps and partner stream, ARR, region slice |
| [PwC: IFRS 18](https://viewpoint.pwc.com/dt/gx/en/pwc/in_briefs/in_briefs_INT/in_briefs_INT/ifrs18insights.html), [Grant Thornton: IFRS 18](https://www.grantthornton.com.br/en/insights/articles/ifrs-18--the-iasbs-new-presentation-and-disclosure-standard/), [Schneider Downs: IFRS 18](https://schneiderdowns.com/our-thoughts-on/ifrs-entities-reporting-changes/) | Operating, investing and financing categories; required operating profit and profit before financing and income taxes; MPM reconciliation; effective 1 Jan 2027 | Spine steps 13–16, category tags, MPM labels |
| [eightX: CPG trade spend](https://eightx.co/blog/cpg-trade-spend-accounting), [Wiss: CPG product line profitability](https://wiss.com/product-line-profitability-for-cpg/) | Trade spend as contra-revenue; contribution margin by channel after channel costs | Gross-to-net %, contribution margin, profitability by slice |
| [The SaaS CFO: SaaS P&L](https://www.thesaascfo.com/?p=271469), [Mosaic: SaaS P&L](https://mosaic.tech/post/saas-pl) | Hosting, support, DevOps and services delivery as cost of revenue; gross margin by revenue line | Commerce Cloud cost of revenue, subscription gross margin |
| [Solver: P&L estimate vs budget](https://www.solverglobal.com/marketplaces-inner/pl-estimate-vs-budget-report), [IBCS: P&L one-pager](https://www.ibcs.com/?p=72984) | Actual, budget and prior year side by side; full-year budget vs revised forecast; favourable/unfavourable variance colour | Variance layout, full-year outlook columns, variance sign rule |
