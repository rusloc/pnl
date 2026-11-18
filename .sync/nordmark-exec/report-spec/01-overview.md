# 01 · Overview: what the report is and what it answers

## The business

**Nordmark Retail** is a fictional multi-category reseller: stores in the **Netherlands (NL)** and **Belgium (BE)**, a
web shop (**ONLINE**), a **WHOLESALE** arm, distribution centres (**DC**) and a head office (**CENTRAL**). All data is
generated (seed `20261028`). Money is in **EUR**, excluding VAT. The data is a snapshot **as of FY2026 Week 43
(19–25 Oct 2026)**, refreshed `2026-10-26T05:12` ("Refreshed Mon 26 Oct 05:12").

Showcase entry (source of the copy below): `C:\__VOSK__\src\lib\work.ts`, slug `executive-dashboard`.

- Title: **Retail executive dashboard**
- Summary: *Twelve retail KPIs vs budget, last year or previous period, by region and category.*
- Client line: **Multi-channel retailer, Netherlands and Belgium**
- Headline metric on the showcase card: **€68.4M** (the code gives no source; it matches Week 43 gross sales, `gross_sales` = 68,414,126.07)

The five points (verbatim, English):

1. A retailer with stores in the Netherlands and Belgium, a web shop and a wholesale arm. Management wants the whole
   business on one screen.
2. Twelve KPI cards, each on track, watch or off track against budget, last year or the previous period.
3. Net sales, total margin and weeks of cover lead. Behind them sit markdowns, availability, like-for-like growth,
   GMROI, sell-through and supplier OTIF.
4. Weeks follow the 4-5-4 retail calendar, the same one the buyers plan in. Every card shows its formula and where to
   drill next.
5. Under the hood: complex ETL into compact Parquet files, and every number computed right in the browser, no server
   in the loop. *(In Power BI: the same Parquet files, Power Query + DAX.)*

## Users

The executive team (CEO, CFO, commercial, supply chain, digital). One landing page that answers "how is the business
doing this week / month / quarter / year", with a plain-English explanation and a drill path behind every number.
Card attributes record who owns each metric: **Commercial**, **Supply chain**, **Finance**, **Digital**.

## The page in one paragraph

A 56 px side bar (Filters · How to read · More KPIs), a header (brand, period, comparator, region, refresh stamp), a
status strip (overall dot + counts on track / watch / off track + "12 of 12 metrics · All"), then two sections:
**"The three numbers"** (three large hero cards: Net sales, Total margin, Weeks of cover) and **"What explains them"**
(three medium cards: Markdown, Availability, EBITDA flash; six small cards: Like-for-like growth, Front gross margin,
Sell-through, GMROI, Supplier OTIF, Channel mix). Every card shows value, Δ line vs the comparator, a status chip vs
budget/target/plan, a bar history (13 weeks / 12 months / 8 quarters / 2 years) with a dotted target line, an ⓘ button
(explanation + worked example) and a binoculars button (drill path).

## Questions it answers

| Question | Where |
|---|---|
| Are we selling what we budgeted? | Net sales card (vs budget, −3 % = off track) |
| Are we keeping enough of each euro? | Total margin % (front + back), Front gross margin %, Markdown % |
| Is stock right-sized? | Weeks of cover (band ±1 / ±2 wks around a forecast-weighted target), Availability, Sell-through, GMROI |
| Are suppliers delivering? | Supplier OTIF |
| Is the bottom line on budget? | EBITDA flash (month to date at Week) |
| Is the existing estate growing? | Like-for-like growth (stores open in both years) |
| Is the channel mix on plan? | Channel mix (store / online / wholesale share vs plan, worst channel) |
| How does this compare with last year / the previous period? | Comparator switch changes every Δ line, never the status |
| Which region / category? | Region (All · Netherlands · Belgium · Online only) and Category (multi-select) switches |
| Which metrics does my function own? | Attribute filters (Group · Lever · Owner) fade the other cards in place |

## The twelve cards (manifest `kpis`, `is_landing = true`, in `card_order`)

| # | kpi_code | Card | Size | Group | Lever | Owner | Status basis | Direction | Rule (watch / off) |
|---:|---|---|---|---|---|---|---|---|---|
| 1 | NET_SALES | Net sales | hero | B1 | sales | commercial | Budget | UP | 0 / 0.03 (ratio shortfall) |
| 2 | TOTAL_MARGIN | Total margin (prov.) | hero | B1 | margin | finance | Budget | UP | 0 / 0.01 (pp) |
| 3 | WEEKS_OF_COVER | Weeks of cover | hero | B1 | stock | supply | Target | BAND | 1 / 2 (weeks) |
| 4 | MARKDOWN | Markdown | medium | B2 | margin | commercial | Budget | DOWN | 0 / 0.01 (pp) |
| 5 | AVAILABILITY | Availability | medium | B3 | supply | supply | Target | UP | 0 / 0.02 (pp) |
| 6 | EBITDA | EBITDA flash (prov.) | medium | B2 | margin | finance | Budget | UP | 0 / 0.05 (ratio) |
| 7 | LFL_GROWTH | Like-for-like growth | small | B4 | sales | commercial | Budget | UP | 0 / 0.02 (pp) |
| 8 | FRONT_GM | Front gross margin | small | B2 | margin | finance | Budget | UP | 0 / 0.01 (pp) |
| 9 | SELL_THROUGH | Sell-through | small | B3 | stock | commercial | Target | UP | 0 / 0.05 (pp) |
| 10 | GMROI | GMROI | small | B3 | cash | finance | Target | UP | 0 / 0.5 (×) |
| 11 | SUPPLIER_OTIF | Supplier OTIF | small | B3 | supply | supply | Target | UP | 0 / 0.03 (pp) |
| 12 | CHANNEL_MIX | Channel mix | small | B4 | sales | digital | Plan | BAND | 0.02 / 0.03 (pp) |

Overall dot (rules `DOT_*`): over the cards **with a status** (N/A excluded): **red** if off ≥ 1/3; else **orange** if
(watch + off) > 50 %; else **green** if on ≥ 2/3; else **orange**. No rated card → **grey**. Attribute filters never
change the counts or the dot.

The opening view (Week 43 · vs Budget · All regions & formats · All categories) reads **7 on track / 3 watch / 2 off
track, dot orange**; the exact strings of every card are in `08-validation.md`.

## The 20 bench KPIs ("More KPIs")

Listed, inactive (no numbers): Sales pace vs budget %, Units & ASP, Online conversion % & AOV, Store traffic & basket,
Promo share % & uplift, Shrink %, Category margin mix, Aged / excess stock %, Inventory turns, Top-10 supplier
concentration %, Purchase price variance %, Store operating cost % of sales, Cost to serve online per order, Cash
conversion cycle, Cash balance & headroom, Returns rate % (online), Active loyalty customers & repeat rate, NPS / review
score, Store payroll hours vs plan & sales per labour hour, Data-quality score. Each shows its formula and
"owner initials · cadence" (manifest `kpis`, `is_landing = false`).

## What is deliberately not rebuilt

- The web header's chat button ("Ask AI") and its chat panel: a site feature outside the report.
- The URL state (`?i=…&c=…&r=…&cat=…`): Power BI keeps state in slicers and bookmarks instead.
- Animations (the pulsing dot), frosted-glass blur, gradient status wash: replaced by the closest static Power BI
  formatting (`07-theme.md`).
