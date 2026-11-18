# 01 — Overview

## 1. The business story

ACME is a two-company group (`dim_entity`, manifest):

| Code | Company (`entity_name` / `short_name`) | Business | Identity colour |
|---|---|---|---|
| `P` | ACME Consumer Products / **Consumer Products** | Branded and private-label consumer goods sold through retail, wholesale, marketplaces and an own D2C webstore. Revenue = units × list price, less trade deductions. | Products blue `#2453A6` |
| `S` | ACME Commerce Cloud / **Commerce Cloud** | E-commerce SaaS: store platform subscriptions, payments, apps marketplace and implementation services for merchants. | Cloud violet `#6B48C8` |
| `GROUP` | **ACME Group** (consolidated; `consolidation_group`) | P + S − intercompany (S runs P's D2C webstore and payments). Not built in the web report. | Group graphite `#3B4A5E` |

Two very different businesses are read on **one P&L layout**: a 19-step "spine" of 29 report lines
(Gross revenue → Net revenue → Gross profit → Contribution margin → Adjusted EBITDA → Operating profit → Net profit,
with ratio rows), the same subtotal formulas for both companies, entity-specific leaf accounts underneath.

All figures are synthetic and deterministic. Months Jan 2024 – Dec 2026; actuals closed through **Sep 2026**.
Versions: Actual (Jan 2024 – Sep 2026), Budget (all 36 months), latest forecast "Forecast 9+3 (Sep 2026)" (`FC2609`,
Oct – Dec 2026). Amounts are stored signed in each region's functional currency (USD, EUR, GBP, AUD) and translated to
the reporting currency (USD, EUR or GBP) at monthly average actual rates or budget rates.

Stories built into the data (from `docs/pnl/data-contract.md`), useful to check that variances and bridges show
something real: Consumer Products D2C webstore and marketplaces run ahead in 2026, toys & leisure and electronics
accessories miss, tariffs lift cost of revenue in electronics and toys, grocery trade promotions run 1 pp of gross sales
above budget in 2026, outbound freight rises, working media is cut by 6 % in 2026, restructuring in Apr–Jun 2025 and
Feb–Mar 2026, a toy-brand impairment in Dec 2025, M&A costs May–Jul 2026. Commerce Cloud: payments run ahead,
subscriptions and professional services behind, payment processing costs rise to 60.5 % of payments revenue in 2026,
operating leverage, acquisition costs Jun–Sep 2025 and higher amortisation from Jul 2025, restructuring Feb–Mar 2026.

## 2. Users

CFO and group finance, entity general managers, FP&A, controllers (`requirements.md` §1). The showcase audience is
mostly non-finance visitors, hence the info pop-ups and "How to read" panels (ADR-0007 §1).

## 3. Questions the report answers

| Question | Where |
|---|---|
| Where are we against budget and last year, line by line, from block down to account? | P&L statement |
| What does the full year look like (latest estimate vs budget)? | Statement "Full year" columns; Vitals "FY outlook" card |
| How are revenue, Adj. EBITDA and operating profit doing, and are the margins on track? Status vs budget. | Vitals (Results) |
| What drives the money? Units and net revenue per unit, gross-to-net %, A&P % (goods); GMV, take rate, active merchants, ARR, revenue mix (SaaS) | Vitals (Drivers & health) |
| Which lines moved most vs the comparison, and how much of it is FX? Within a region, channel, category or price tier? | Analysis, largest variances |
| How did revenue get from budget to actual: volume, price / mix (or service lines), FX? How did Adj. EBITDA bridge to operating profit? | Analysis, the two bridges |
| Which region grows and which actually earns? Concentration, month-by-month growth and margin, region × category mix. | Profitability |

## 4. The five showcase points (`src/lib/work.ts`, entry `slug: "pnl-suite"`, lines 150–184)

- Title: "Management PnL report". Summary: "Budget vs actual P&L for two companies: statement, KPIs, variances, bridges,
  profitability." Client: "Two-company group: a consumer goods maker and an e-commerce SaaS". Headline metric: `$3.4B`
  (Consumer Products net revenue YTD Sep 2026 = 3,398.5 m USD).
1. "Two very different businesses, a consumer goods maker and an e-commerce SaaS, on one P&L layout. The CFO reads both
   the same way."
2. "Every line vs budget, latest estimate or last year, from the block down to the account. USD, EUR or GBP, at actual
   or constant FX."
3. "The drivers behind the money: units and price per unit for the goods side; GMV, take rate, active merchants and ARR
   for the SaaS."
4. "Bridges walk revenue and profit from budget to actual, driver by driver, with FX split out. Then region and
   category: who grows, who actually earns."
5. "Under the hood: complex ETL into a PostgreSQL backend, and an AI chat that answers only from the report's numbers,
   checked against 63 known answers." (Power BI: the ETL becomes the Power Query in `02-data.md`; the 63 answers become
   the validation table in `08-validation.md`; the chat itself is out of scope.)

## 5. What the web report shows today (scope for parity)

| Area | Web report today (code) | Spec decision |
|---|---|---|
| Companies | P and S. Group listed in the picker but disabled: "Not built yet (ADR-0002 build step 4)" (`components/pnl/company-picker.tsx:15`) | Build P and S; model supports Group (validation); Group option shown disabled |
| Statement-wide slice filters | Off. Slice flyout shows a notice and four disabled "All" rows (`components/pnl/flyout.tsx:386-414`; `state/selection-schema.ts:252-262` clears them) | Same |
| Slice cut in Analysis | Yes: the largest-variances funnel filter (region, channel, category, price tier), below-CM lines allocated by NR share | Same, via four slicers on the Analysis page |
| Views | P&L statement · Vitals (URL value `kpi`) · Analysis (one page) · Profitability (one scrolling page) | Four report pages |
| Time views | One month (MTD), QTD, YTD, LTM, Full year, Custom range | Same |
| Base / comparisons | Base Actual / Latest estimate / Budget; Compare A and B: Budget / Latest est. / Prior year / None | Same |
| Display | Currency USD/EUR/GBP, FX basis actual / constant, units m / k, costs − / +, variance format, 4 statement toggles | Same (column toggles via a field parameter) |
| Export, drill-through to journals, phone layout | Not built (README "Deferred") | Not required |

## 6. Glossary

| Term | Meaning |
|---|---|
| Base | The version the numbers are read from: Actual (A), Latest estimate (LE), Budget (B) |
| Compare A / Compare B | Two comparison columns: Budget (B), Latest estimate (LE), Prior year (PY) or None |
| Bridge comparison | Compare A, else Compare B, else Prior year (used by Analysis and Profitability) |
| LE | Latest estimate = Actual for closed months + latest forecast (FC2609) for open months (C-02) |
| PY | Prior year = the base months shifted back 12, Actual version (C-04) |
| CC | Constant currency = every version, prior year included, translated at the **selected fiscal year's** budget rates (C-12) |
| C-01 | An Actual base never includes months after the last close; comparisons cover exactly the base's months (C-03) |
| C-31 | Lines from operating expenses down are booked by entity × region only; under a channel / category / segment cut they are allocated by net-revenue share within entity × version × month × region |
| Δ | Base − comparison on **signed** values (revenue +, costs −): a positive Δ is favourable on every line (M-10) |
