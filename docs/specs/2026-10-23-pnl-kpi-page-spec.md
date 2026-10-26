# KPI Page – Optimisation Spec

**Report:** Financial statement report, KPI page
**Data base:** P&L model (actual for selected period, budget, prior year, FY projection)
**Goal:** The reader gets the financial story in ≤5 seconds; colour appears only where a conversation is needed.
**Status:** Draft v1 · 2026-10-23

---

## 1. Scope

In scope: KPI page only – tile set, tile order, variance logic, colour rules, number formats, header, data-quality fixes.
Out of scope: P&L detail page, data model changes beyond the measures listed in §7.

---

## 2. Page structure

```
┌────────────────────────────────────────────────────────────────────────┐
│ HEADER   Period · Currency · Last refresh · 2-line headline ("so what") │
├────────────────────────────────────────────────────────────────────────┤
│ ROW 1 · RESULTS (P&L cascade, left → right)                            │
│ Net revenue │ Gross margin │ Opex % rev │ Adj. EBITDA │ Op. profit / NI │
├────────────────────────────────────────────────────────────────────────┤
│ ROW 2 · DRIVERS & HEALTH                                               │
│ GMV │ Active merchants │ ARR │ Revenue mix │ FY outlook vs budget      │
└────────────────────────────────────────────────────────────────────────┘
```

- 2 rows × 5 tiles (was 2 rows × 4 + 1 row × 4 = 12 tiles → 10).
- Row labels: **Results** and **Drivers & health** (replaces Financial / Operational).
- Reading order follows the P&L: revenue → margin → opex → EBITDA → operating profit / net income.

---

## 3. Header

| Element | Content |
|---|---|
| Period | e.g. `YTD Sep 2026 (9M)` or `Q3 2026` – always explicit, never implied |
| Currency / units | `USD, $m unless stated` |
| Refresh | `Data as of DD Mon YYYY` |
| Headline | Auto-generated, max 2 lines, 4 clauses: revenue vs budget (+$), EBITDA vs budget (+$), largest negative variance, largest positive driver. Example: *"Revenue +$9.2m (+1.4%) vs budget on GMV beat · EBITDA on plan · OP −$1.5m on D&A/SBC · Active merchants −3.0% vs budget"* |

Headline logic: rank all tiles by `abs(variance vs budget in $)`, name the top 2 positives and top 2 negatives.

---

## 4. Tile anatomy (every tile)

```
┌──────────────────────────────────────────┐
│ Title                           [status] │   status = ● grey / amber / red (see §6)
│                                          │
│ 667.4                                    │   primary value, large
│ sub-line 1 · sub-line 2                  │   context, small grey
│                                          │
│ vs Budget   +9.2   +1.4%    ▁▂▃▅▆▇  │   $ delta · % delta · 12-period sparkline
│ vs PY      +153.6  +29.9%               │
└──────────────────────────────────────────┘
```

Rules
- Variance lines always show **both $ (or pp) and %** where both are meaningful. For ratio metrics (margins, take rate): show pp only.
- `0.0` variances render as **`on plan`** (grey), never as `0.0 pp` / `0.0%`.
- Sparkline: last 12 periods of the primary value, actual only; optional dotted budget line.
- Bullet bars from current design are **removed** (one data point, inconsistent scale across tiles).
- Tooltip on title: definition + formula + "adjusted" items list where relevant.

---

## 5. Tile definitions

### Row 1 · Results

| # | Tile | Primary value | Formula | Sub-lines | Variances |
|---|---|---|---|---|---|
| 1.1 | **Net revenue** | Net revenue, $m | `gross revenue − refunds − discounts − chargebacks` | `Organic +x.x% · Reported +y.y%` (organic = YoY excl. M&A and FX) | vs Budget ($, %) · vs PY ($, %) |
| 1.2 | **Gross margin %** | GM %, 1 dp | `(net revenue − COGS) / net revenue` | `Subscription xx.x% · Payments xx.x%` | vs Budget (pp) · vs PY (pp) |
| 1.3 | **Opex % revenue** *(new)* | Opex / revenue, 1 dp | `(S&M + R&D + G&A, excl. D&A/SBC/one-offs) / net revenue` | `S&M x% · R&D x% · G&A x%` | vs Budget (pp, and $ of opex) · vs PY (pp) — note: lower is better, invert colour logic |
| 1.4 | **Adj. EBITDA** | $m | `operating profit + D&A + SBC + one-off items` | `Margin xx.x%` | vs Budget ($, %) · vs PY ($, %) |
| 1.5 | **Operating profit** | $m | `Adj. EBITDA − D&A − SBC − one-offs` | `Margin x.x% · Net income $x.xm` | vs Budget ($, %) · vs PY ($, %) |

Bridge note on 1.5 tooltip: `EBITDA 82.8 − D&A x − SBC y − other z = OP 48.6` (values from model).

### Row 2 · Drivers & health

| # | Tile | Primary value | Formula | Sub-lines | Variances |
|---|---|---|---|---|---|
| 2.1 | **GMV processed** | $m | `Σ transaction value processed in period` | `Take rate x.xx% (vs PY ±x bp)` | vs Budget ($, %) · vs PY ($, %) |
| 2.2 | **Active merchants** | count, period end | `merchants with ≥1 processed transaction OR active paid subscription at period end` (lock one definition) | `GMV / merchant $x.xk (±x% vs budget)` | vs Budget (#, %) · vs PY (#, %) |
| 2.3 | **ARR** | $m, period end | `period-end MRR × 12` (subscription only) | `Net new ARR in period $x.xm` | vs Budget ($, %) · vs PY ($, %) |
| 2.4 | **Revenue mix** *(new)* | Subscription % / Payments % | `subscription revenue / net revenue`, remainder = payments & other | `Sub $x.xm (+x%) · Pay $x.xm (+x%)` YoY growth per stream | vs PY (pp shift) |
| 2.5 | **FY outlook vs budget** *(new)* | FY forecast revenue $m | `YTD actual + remaining-period projection` | `EBITDA FY fcst $x.xm · Budget attainment xx%` | FY forecast vs FY budget ($, %) for revenue and EBITDA |

### Removed from KPI page (retained in P&L detail)

| Tile | Reason | Where it lives now |
|---|---|---|
| Organic growth vs PY | Duplicates "vs PY" on revenue | Sub-line of 1.1 |
| Payments take rate | Flat 0.0 / 0.0; no signal | Sub-line of 2.1 |
| Subscription gross margin % | Stable; context not monitor | Sub-line of 1.2 |
| Contribution margin % | Moves 1:1 with gross margin | P&L detail only |
| Rule of 40 | Composite; keep only if PY calc is fixed (§8). If kept, place as sub-line of 1.4: `Rule of 40: xx.x` | Optional sub-line |

---

## 6. Status & colour rules

Colour is driven by **variance vs budget** only (PY variances stay text-only, no colour).

| Status | Threshold – $ metrics (revenue, EBITDA, OP, GMV, ARR, merchants) | Threshold – ratio metrics (margins, opex %) | Colour |
|---|---|---|---|
| On track | within ±1.0% | within ±0.3 pp | grey ● / no arrow |
| Watch | 1.0–3.0% adverse | 0.3–1.0 pp adverse | amber ● |
| Off track | >3.0% adverse | >1.0 pp adverse | red ● |
| Ahead | >1.0% favourable | >0.3 pp favourable | green text, no dot |

- "Adverse" direction: lower is adverse for all metrics **except Opex % revenue**, where higher is adverse.
- Thresholds are parameters in the model (one table), not hard-coded per tile.
- Applied to the current data, only **Active merchants** (−3.0% → amber/red boundary) and **Operating profit** (−3.1% → red) would show colour. Everything else is grey.

---

## 7. Number formats

| Type | Format | Example |
|---|---|---|
| $ values ≥ 1,000m | `$x,xxx.x m` | `$12,470.9 m` |
| $ values < 1,000m | `$xxx.x m` | `$667.4 m` |
| Counts | thousands separator, no decimals | `124,291` |
| Ratios | 1 dp with % | `55.9%` |
| Take rate | 2 dp | `2.67%` |
| % variance | sign + 1 dp | `+1.4%` / `−3.1%` |
| pp variance | sign + 1 dp + `pp` | `−0.6 pp` |
| bp variance (take rate) | integer + `bp` | `+3 bp` |
| Zero variance | `on plan` | — |
| Negative sign | true minus `−`, not hyphen | `−3.1%` |

---

## 8. Data-quality fixes (blocking)

| # | Issue | Evidence | Action |
|---|---|---|---|
| DQ-1 | Rule of 40 vs PY = +29.3 pp implies PY Rule of 40 = 10.9%, which equals PY EBITDA margin alone → PY growth component missing | 82.8/1.478 = 56.0 PY EBITDA; 667.4/1.299 = 513.8 PY revenue; 56.0/513.8 = 10.9% | Rebuild PY Rule of 40 as `PY organic growth + PY EBITDA margin`; or drop the PY comparison |
| DQ-2 | Take rate exactly 0.0 pp vs budget and vs PY | Two exact zeros is improbable for an actual ratio | Confirm budget and PY take rate are computed from actual payments revenue / GMV, not a plugged assumption |
| DQ-3 | "Active merchants" definition unclear vs GMV beat | Merchants −3.0% vs budget while GMV +3.4% | Lock a single definition (see 2.2) and document it in the tooltip |
| DQ-4 | Period not labelled | No period on page | Add to header (§3) |

---

## 9. Measures to add to the model

```
Opex_pct_rev        = (SM + RD + GA) / NetRevenue
Opex_pct_rev_Bud    = same on budget
Opex_pct_rev_PY     = same on PY
NetIncome           = from P&L
Sub_Rev_Share       = SubscriptionRevenue / NetRevenue
Pay_Rev_Share       = PaymentsRevenue / NetRevenue
GMV_per_Merchant    = GMV / ActiveMerchants_PE
NetNewARR           = ARR_PE − ARR_PE_PY_period_end (or vs prior period end)
FY_Fcst_Revenue     = YTD_Actual + Remaining_Projection
FY_Fcst_EBITDA      = same
FY_Attainment       = FY_Fcst / FY_Budget
Var_Bud_Abs         = Actual − Budget      (per metric)
Var_Bud_Pct         = Actual / Budget − 1
Var_PY_Abs, Var_PY_Pct  likewise
Status              = per thresholds table (§6)
Headline_Text       = generated per §3
```

---

## 10. Acceptance criteria

- [ ] 10 tiles, 2 rows, order exactly as §2.
- [ ] Header shows period, currency, refresh date, and a generated 2-line headline.
- [ ] Every variance shows $ (or pp) **and** %, except ratio metrics (pp only).
- [ ] No `0.0` variances rendered; `on plan` used instead.
- [ ] Colour appears only on tiles breaching §6 thresholds; on current data that is 2 tiles max.
- [ ] Bullet bars removed; 12-period sparkline present on each tile.
- [ ] Rule of 40 PY value reconciles to `PY growth + PY margin` or the comparison is removed.
- [ ] Take rate budget/PY values verified as calculated, not plugged.
- [ ] All formulas documented in tile tooltips.
- [ ] A reader unfamiliar with the business can state revenue, profit, and the biggest problem within 5 seconds (test with 3 non-finance users).

---

## 11. Open questions for the owner

1. Is the selected period YTD or a single quarter? (affects ARR vs revenue sanity checks and FY outlook tile)
2. Which items are in "adjusted" EBITDA? Needed for the bridge on tile 1.5.
3. Is a cash / FCF figure available? If yes, consider replacing Revenue mix (2.4) with FCF, or adding a 3rd row of 2–3 tiles.
4. Should Rule of 40 stay as a visible metric for board use, or move to the board pack only?
