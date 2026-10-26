# Executive KPI Scorecard — Spec

Oct 24, 2026 · @KIRILL · (USER-supplied spec, saved verbatim on 2026-10-24; input for the third showcase report, Tracks A + B + C; design concept first, USER approval before any build)

The scorecard is a one-page, decision-first view of 12–20 cross-functional KPIs, each shown as actual vs target with status, trend and owner, refreshed daily and read in under a minute; it is metadata-driven, so adding a KPI is a row in a KPI table, not a new visual. Static KPIs are loaded values (ledger, headcount, targets); dynamic KPIs are computed at query time (ratios, retention, pace, status).

## Scope & audience

The scorecard answers one question for the leadership team each morning: which of our committed numbers are off track, by how much, and who owns the fix. It is not an exploration tool; every drill leads to a domain dashboard (Sales, P&L, Customer, Ops, People) that holds the detail.

| Attribute | Specification |
| --- | --- |
| Readers | CEO / owner, CFO, CRO, COO, CMO, CPO; board pack export monthly |
| Decision served | Weekly leadership meeting agenda: red and amber KPIs are the agenda, in order of variance |
| Cadence | Daily refresh (06:00 local); weekly review; month-end lock of the period column |
| KPI count | 12 default, 20 maximum; 3–6 per domain; one "north star" tile |
| Time basis | Current period (month and quarter) with pace, plus YTD and rolling 12 months; prior year and budget as comparators |
| Status model | Three states (On track / Watch / Off track) from threshold rules per KPI, never from colour alone |
| Interaction budget | Zero clicks to read the headline; one click to a KPI detail page; one more to the domain dashboard |
| Company types covered | SaaS (ARR, NRR, CAC payback) and consumer goods (net sales, gross-to-net, OTIF, inventory); both share finance, people and cash KPIs |
| Out of scope | Operational monitoring (real-time), rep-level or SKU-level analysis, forecasting models, commentary workflow beyond a note field |

## KPI catalogue

The default 12-tile set is marked ★; the rest are the approved bench a client picks from, so the KPI table ships with all rows and an `Is active` flag. `Applies` = S (SaaS), C (consumer goods), B (both). Status rule: On track when actual meets the target condition; Watch inside the tolerance band; Off track beyond it; costs and churn use inverted direction. Targets come from the budget unless a KPI names another source.

| # | Domain | KPI | Type | Formula / source | Applies | Target source | Tolerance (Watch band) | Direction | Period basis | Cadence | Owner |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 ★ | North star | Net revenue (period) | Dynamic | Gross revenue − deductions (C); recognised revenue (S), from GL fact | B | Budget | −3% to 0% | ↑ | Month, QTD, YTD | Daily flash, monthly close | CFO |
| 2 ★ | Finance | Revenue pace vs budget % | Dynamic | Revenue to date ÷ (budget × elapsed share of period) | B | 100% | 95–100% | ↑ | MTD / QTD | Daily | CFO |
| 3 ★ | Finance | Gross margin % | Dynamic | Gross profit ÷ Net revenue | B | Budget | −1 pp | ↑ | Month, YTD | Monthly | CFO |
| 4 ★ | Finance | EBITDA (adjusted) and margin % | Dynamic | Gross profit − OpEx + add-backs; ÷ Net revenue | B | Budget | −5% abs / −1 pp | ↑ | Month, YTD | Monthly | CFO |
| 5 | Finance | OpEx vs budget % | Dynamic | Actual OpEx ÷ Budget OpEx | B | 100% | 100–103% | ↓ | Month, YTD | Monthly | CFO |
| 6 ★ | Finance | Cash balance & runway (months) | Static + dynamic | Period-end cash (semi-additive); runway = cash ÷ average 3-month net burn | B | Policy minimum | runway 12–18 m | ↑ | Point in time | Weekly | CFO |
| 7 | Finance | DSO (days) | Dynamic | AR balance ÷ R3M revenue × days | B | Policy | +5 days | ↓ | Point in time | Monthly | CFO |
| 8 | Finance | Full-year outlook vs budget | Dynamic | YTD actual + latest forecast for remaining months − FY budget | B | Budget | −2% | ↑ | FY | Monthly | CFO |
| 9 ★ | Sales | Bookings vs quota (attainment %) | Dynamic | Closed-won ÷ quota, period | B | Quota | 90–100% | ↑ | Month, QTD | Daily | CRO |
| 10 ★ | Sales | Pipeline coverage × (next quarter) | Dynamic | Open pipeline closing next quarter ÷ next-quarter quota | S, C (B2B) | 3× or 1 ÷ win rate | 2.5–3× | ↑ | Point in time | Weekly | CRO |
| 11 | Sales | Forecast commit vs quota % | Dynamic | (Closed + Commit) ÷ quota, current quarter | S | 100% | 90–100% | ↑ | QTD | Weekly | CRO |
| 12 | Sales | Win rate % (trailing 4Q) | Dynamic | Won ÷ (Won + Lost), count | S | PY | −2 pp | ↑ | R12M | Monthly | CRO |
| 13 ★ | Sales (C) | Net sales volume & net price per unit | Static + dynamic | Units shipped net of returns; Net revenue ÷ units | C | Budget | −3% | ↑ | Month, YTD | Daily | CCO |
| 14 | Sales (C) | Gross-to-net % | Dynamic | 1 − Net revenue ÷ Gross revenue | C | Budget | +1 pp | ↓ | Month, YTD | Monthly | CCO |
| 15 ★ | Customer (S) | Ending ARR & net new ARR | Dynamic | ARR snapshot at month end; closing − opening | S | Budget | −3% | ↑ | Month, QTD | Daily | CRO |
| 16 ★ | Customer (S) | Net revenue retention % | Dynamic | ARR now of customers active 12 m ago ÷ their ARR then | S | ≥ 100% (target 105–110%) | 100–105% | ↑ | R12M | Monthly | CCO / CS |
| 17 | Customer (S) | Gross revenue retention % / logo churn % | Dynamic | GRR caps each customer at prior ARR; churned logos ÷ opening logos | S | ≥ 90% / ≤ 1% monthly | 88–90% | ↑ / ↓ | R12M / month | Monthly | CS |
| 18 | Customer (S) | CAC payback (months) | Dynamic | CAC ÷ (new ARR per customer ÷ 12 × GM %) | S | ≤ 18 m | 18–24 m | ↓ | R3M | Quarterly | CMO |
| 19 | Customer (B) | NPS / CSAT | Static | Survey score, latest wave | B | Target | −5 pts | ↑ | Latest wave | Quarterly | CCO |
| 20 | Customer (C) | Market share % (category, value) | Static | Syndicated panel data (Nielsen / Circana) | C | PY | −0.3 pp | ↑ | R12 weeks | Monthly | CMO |
| 21 | Customer (C) | Top-10 customer concentration % | Dynamic | Top-10 net revenue ÷ total | C | Policy cap | +2 pp | ↓ | R12M | Monthly | CCO |
| 22 ★ | Operations (C) | OTIF % (on time in full) | Dynamic | Orders delivered on time and complete ÷ orders delivered | C | ≥ 95% | 93–95% | ↑ | Month | Daily | COO |
| 23 | Operations (C) | Inventory days / weeks of cover | Dynamic | Inventory value ÷ (R3M COGS ÷ days) | C | Policy | +5 days | ↓ | Point in time | Weekly | COO |
| 24 | Operations (C) | Forecast accuracy (demand) % | Dynamic | 1 − Σ abs(forecast − actual units) ÷ Σ actual, lag-1 month | C | ≥ 75% | 70–75% | ↑ | Month | Monthly | COO |
| 25 | Operations (S) | Uptime / SLA attainment % | Static | Monitoring export | S | ≥ 99.9% | 99.5–99.9% | ↑ | Month | Daily | CTO |
| 26 | Operations (S) | Support: first-response time / backlog | Static | Ticketing export | S | SLA | +20% | ↓ | Week | Daily | CS |
| 27 | Product (S) | Weekly active accounts / adoption % | Static | Product analytics export; active ÷ paying accounts | S | Target | −3 pp | ↑ | Week | Weekly | CPO |
| 28 ★ | People | Headcount vs plan & cost per FTE | Static + dynamic | HRIS headcount; people cost ÷ FTE | B | Plan | ±3% | context | Point in time | Monthly | CHRO |
| 29 | People | Regretted attrition % (R12M) | Dynamic | Regretted leavers ÷ average headcount | B | ≤ 10% | 10–13% | ↓ | R12M | Monthly | CHRO |
| 30 | People | Revenue per FTE | Dynamic | R12M net revenue ÷ average FTE | B | Benchmark | −5% | ↑ | R12M | Quarterly | CFO |
| 31 | Efficiency (S) | Rule of 40 | Dynamic | ARR growth % + EBITDA margin % | S | ≥ 40 | 30–40 | ↑ | R12M | Quarterly | CEO |
| 32 | Efficiency (S) | Burn multiple | Dynamic | Net burn ÷ Net new ARR | S | ≤ 1.5 | 1.5–2.0 | ↓ | QTD | Monthly | CFO |
| 33 | Risk | Data-quality score | Dynamic | % KPI inputs refreshed and reconciled on schedule | B | 100% | 95–100% | ↑ | Daily | Daily | RevOps / FP&A |

Each tile also carries: Δ vs comparator (absolute and %), 13-period sparkline, status glyph (▲ ● ▼) with colour, last-refresh stamp, owner initials and a one-line note from the owner (editable via a notes table).

## Dimensions & parameters

The scorecard page exposes only three slicers (period, entity/business unit, comparator); every other dimension lives on the drill-through pages, which keeps the headline readable without interaction.

| # | Dimension / parameter | Role on scorecard | Values / hierarchy | Applies | Type | Source |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Period | Slicer (header) | Fiscal year → quarter → month; default = current month; period mode toggle Month / QTD / YTD / R12M | B | Static date table + dynamic calc group | Calendar |
| 2 | Entity / business unit | Slicer (header) | Group → Region → Entity (or Brand / Product line for C; Segment for S) | B | Static | ERP |
| 3 | Comparator | Slicer (header) | Budget / Prior year / Forecast (LE) / Target | B | Dynamic (field parameter) | Report |
| 4 | KPI | Row of the metadata table | Domain → KPI; attributes: Is active, Sort, Direction, Target source, Tolerance low/high, Format string, Owner, Drill page, Definition text | B | Static metadata | KPI table (Excel / Sheets maintained by FP&A) |
| 5 | Scenario | Hidden filter inside measures | Actual, Budget, Forecast, PY | B | Static | GL / planning |
| 6 | Status | Computed | On track / Watch / Off track; Not available | B | Dynamic | Measure |
| 7 | Owner | Tile attribute and filter on detail page | Executive role, person | B | Static | KPI table |
| 8 | Currency & display unit | Parameter | Reporting currency; K / M | B | Dynamic (calc group) | Report |
| 9 | Snapshot date | Hidden | Last refresh, last close date | B | Static | Refresh log |
| 10 | Drill-through dimensions (detail pages only) | — | Product, Customer / segment, Channel, Region, Cost centre, Rep / team, Cohort | B | Static | Domain models |

Fixed by design: no free-form date ranges, no multi-select on comparator, no KPI-level filters on the landing page; a reset bookmark restores defaults.

## Layout

One landing page in the Executive Summary archetype (KPI-strip variant), one hidden KPI detail page reached by drill-through, and a board-export page in Letter format; canvas 1920×1080, 32 px margins, 72 px header, 12-column grid.

**Landing page**

```
HEADER 72px   "Leadership scorecard — <Period>"   refreshed dd MMM hh:mm   [Period] [Entity] [Comparator] [Reset]
STATUS BAR 40px   ● 8 on track  ● 3 watch  ● 1 off track   |  "Off track: Pipeline coverage 2.1×, NRR 98%"  (dynamic sentence)
NORTH STAR 180px  Net revenue (period): value, Δ vs comparator, pace %, 13-month column trend with target line    8 cols
                  Full-year outlook vs budget: bullet bar (YTD actual + forecast vs FY budget)                       4 cols
DOMAIN ROWS 3 × 200px  (4 tiles per row, 3 cols each; each row = one domain with its label at left)
  Finance:   Gross margin %      | Adj. EBITDA & margin | Cash & runway        | OpEx vs budget
  Growth:    Bookings vs quota   | Pipeline coverage ×  | Ending / net new ARR | NRR %   (C: Volume & price | Gross-to-net | OTIF | Market share)
  Health:    Headcount vs plan   | Regretted attrition  | NPS / CSAT           | Data-quality score
FOOTER 32px   definitions · owners · [Board export] · [vs Budget | vs PY toggle]
```

**Tile anatomy** (new Card visual, one card per KPI, fixed size, reference labels on)

| Element | Spec |
| --- | --- |
| Label | KPI name 10.5 pt, owner initials right-aligned |
| Value | 28–32 pt bold, format string from KPI table (K/M, %, days, ×) |
| Reference line 1 | Δ vs comparator: "+$1.2M (+4.3%) vs budget", signed, semantic colour |
| Reference line 2 | Pace or target: "Target 95% · Pace 98%" |
| Status glyph | ▲ on track / ● watch / ▼ off track, coloured green `#107C10` / amber `#C19C00` / red `#D13438`, never colour alone |
| Sparkline | 13 periods, 160×48 px, grey line, last point accented, target as dotted line |
| Note | Owner's one-line comment (from notes table), truncated at 60 characters, full in tooltip |
| States | Not available (grey, "no data since dd MMM"), Stale (amber border when source older than cadence) |

**Status logic**: tiles sorted within each row by status severity then by variance %, so the worst KPI in each domain sits left; the status bar sentence lists Off-track KPIs by variance; a tile click drills to the KPI detail page with the KPI pre-filtered.

**KPI detail page (hidden)**: title with definition text and owner; large trend (36 months, actual vs target vs PY); decomposition by the KPI's primary dimension (sorted bar); variance bridge vs comparator where additive; table of the top contributors; link button to the domain dashboard; back button.

**Board export page**: Letter portrait, static table of all active KPIs (Actual, Target, Δ, Δ %, PY, Status, Owner, Note) plus the north-star trend; exported to PDF or PowerPoint via subscription on the first working day after close.

**Mobile layout** (phone): status bar → north-star card → tiles stacked two per row in the sort order above; sparklines off; fonts ≥ 9 pt; tooltips carry the note.

## Model & mechanics

The scorecard is a thin composite model: it reads the domain semantic models (Sales, P&L, Customer, Ops, People) through DirectQuery-to-semantic-model connections or imports their monthly aggregates, and adds three local tables — `KPI` (metadata), `KPI Target` (overrides by period and entity) and `KPI Note` (owner comments) — so no business logic is duplicated.

| Topic | Specification |
| --- | --- |
| `KPI` table | One row per KPI: KPI Key, Domain, Name, Definition, Measure name, Applies (S/C/B), Is active, Sort, Direction (+1/−1), Target source (Budget / PY / Fixed / Table), Fixed target, Tolerance low, Tolerance high, Format string, Cadence, Owner, Drill page, Stale after (hours) |
| `KPI Target` table | KPI Key × Period start × Entity → Target value; first-day-of-period dating; used when Target source = Table (NPS, OTIF, policy minimums) |
| `KPI Note` table | KPI Key × Period × Author × Note; written via a Power Apps / translytical task flow or a shared Excel; latest note per KPI shown |
| Actual measure | `KPI Actual = SWITCH ( SELECTEDVALUE ( KPI[KPI Key] ), "NET_REV", [Net Revenue], "GM_PCT", [Gross Margin %], ... )` — one dispatcher so the card visual and matrix bind to a single measure |
| Target measure | `KPI Target` resolves by Target source: budget measure, PY via calc group, fixed value, or lookup in `KPI Target` for the visible period and entity |
| Variance measures | `KPI Δ = ( [KPI Actual] − [KPI Target] ) × KPI[Direction]`; `KPI Δ % = DIVIDE ( [KPI Δ], ABS ( [KPI Target] ) )`; sign already direction-adjusted so positive is always favourable |
| Status measure | `KPI Status = SWITCH ( TRUE (), ISBLANK ( [KPI Actual] ), "N/A", [KPI Δ %] >= 0, "On track", [KPI Δ %] >= −Tolerance, "Watch", "Off track" )`; tolerance read from the KPI row; status colour returned as theme names `good` / `neutral` / `bad` for conditional formatting |
| Pace measure | Elapsed share of period from the date table (calendar or selling days); `Pace % = DIVIDE ( [KPI Actual], [KPI Target] × share )` for flow KPIs only (flag `Is flow` on KPI) |
| Semi-additive KPIs | Cash, ARR, headcount, inventory use last-snapshot-in-period logic; `Is stock` flag on KPI selects the pattern |
| Freshness | Each source model writes a refresh timestamp; `KPI Stale = NOW () − source refresh > KPI[Stale after]`; feeds tile border and the data-quality KPI |
| Format | Dynamic format string on `KPI Actual` reading `KPI[Format string]`; display units off on the card |
| Refresh | Composite refresh 06:00 daily after the domain models; notes table every hour; month-end snapshot of actuals stored in `KPI History` for the board export and for restating targets |
| Security | Executive audience via Org app; RLS by Entity for regional leaders; notes editable only by the KPI owner (table-level RLS on Author) |
| Governance | KPI definitions signed off by CFO and owner before activation; a KPI changes definition only with a new KPI Key and an end date on the old one; quarterly review of the active set (add / retire) |
| Testing | Reconciliation of every active KPI to its domain dashboard figure (exact match); status rule unit tests for boundary values; stale-flag test by backdating a refresh timestamp |

**Open parameters to confirm**: active KPI set per company type; north-star metric (net revenue vs ARR vs EBITDA); comparator default (budget vs PY); tolerance bands per KPI; fiscal calendar; whether notes are required for every Off-track KPI; board pack format (PDF vs PowerPoint) and day; who maintains the `KPI` table.
