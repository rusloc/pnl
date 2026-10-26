# Analysis Page – Optimisation Spec

**Report:** Financial statement report, Analysis page
**Data base:** P&L model (actual for selected period, budget, prior year, prior forecast, FY projection); service-line revenue and cost of revenue; opex by function; adjusting items; FX rates
**Goal:** The reader can judge the *quality* and *cause* of the period's result — not just its size — and knows which variances persist into the full year.
**Companion:** `kpi-page-spec.md` (KPI page). Shared threshold table, number formats and colour rules apply here unchanged.
**Status:** Draft v1 · 2026-10-23

---

## 1. Scope

In scope: Analysis page – panel set, panel order, bridge definitions, variance table design, decomposition logic, drill-through, comparison toggle.
Out of scope: KPI page, P&L statement tab, Profitability tab (referenced where a panel should move there).

---

## 2. Design principle

Every panel must answer one of four questions. A panel that answers none is removed.

| Question | Panels that answer it |
|---|---|
| **How much** did we miss/beat? | Headline strip, variance table |
| **Why** (which driver)? | Revenue bridge, profit bridge, volume/rate/mix, GM bridge, opex by function |
| **How real** is it (FX, pass-through, one-off, timing)? | Headline strip quality split, "Nature" column, trend chart |
| **Does it persist** into FY? | FY outlook bridge, run-rate column |

---

## 3. Page structure

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│ HEADER   Period · Currency · Compared with [Budget | Prior year | Prior forecast] │
├─────────────────────────────────────────────────────────────────────────────────┤
│ HEADLINE STRIP                                                                  │
│ Reported Δ │ Constant-currency Δ │ Underlying Δ │ Controllable Δ   (Rev + EBITDA) │
│ Commentary: 3–5 bullets (what · why · action · FY impact)                       │
├────────────────────────────────────────┬────────────────────────────────────────┤
│ ROW 1  Net revenue bridge (fixed)      │ Profit bridge: Budget → EBITDA → OP     │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ ROW 2  Service-line economics table    │ Largest variances table (enhanced)      │
├────────────────────────────────────────┼────────────────────────────────────────┤
│ ROW 3  Monthly trend: act / bud / PY   │ FY outlook bridge + run-rate impact     │
├────────────────────────────────────────┴────────────────────────────────────────┤
│ DRILL-THROUGH (tabs or expanders)                                               │
│ Volume/rate/mix · GM rate vs mix · Opex by function · Adjusting items register  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- The **Compared with** toggle drives every panel (bridges re-base to PY NR / prior-forecast NR; tables swap the comparator column).
- Clicking a bar in any bridge filters the variance table to the lines behind that bar (cross-filter, not navigation).

---

## 4. Header & headline strip

### 4.1 Header
| Element | Content |
|---|---|
| Period | explicit, e.g. `Q3 2026` or `YTD Sep 2026 (9M)` |
| Currency | `USD $m · constant-currency at budget rates` |
| Comparator toggle | Budget · Prior year · Prior forecast (default Budget) |

### 4.2 Headline strip – four Δ tiles × two metrics (Net revenue, Adj. EBITDA)

| Tile | Formula | Reads as |
|---|---|---|
| **Reported Δ** | `Actual − Comparator` | the number in the statement |
| **Constant-currency Δ** | `Actual at comparator FX rates − Comparator` | strips translation effect |
| **Underlying Δ** | `CC Δ − one-offs Δ − pass-through Δ` | what the business actually did |
| **Controllable Δ** | `Underlying Δ − interchange/scheme-rate Δ − regulatory Δ` | what management could influence |

Each tile: $ and %, with the same grey/amber/red status rules as the KPI page.
Definitions of *pass-through* and *controllable* live in a tooltip and in §9.

Worked example on current data (revenue): Reported +9.2 · CC −2.5 · Underlying ≈ −2.5 · Controllable ≈ −2.5. Reported +1.4% becomes −0.4% in three steps — that is the point of the strip.

### 4.3 Commentary block
- 3–5 bullets, each ≤ 25 words, structure: *line · variance · cause · action · FY impact*.
- Source: FP&A text field in the model, keyed by period and comparator. Auto-draft allowed from the variance table (top 3 |Δ| with Nature tag), must be reviewed before publishing.
- Example: *"Subscriptions −4.6 vs budget on merchant count −3.0%; acquisition slipped to Q4; FY impact −6 to −8."*

---

## 5. Row 1 – Bridges

### 5.1 Net revenue bridge (existing, fixed)

| Change | Detail |
|---|---|
| Axis | Truncate y-axis to start ≈ 2% below the lowest point (≈ 640 on current data), **or** add a second panel "Net change" showing only the steps at readable scale. Deltas of 0.1–2% must be visible, not slivers. |
| Subtotal | Insert **Constant-currency NR** bar between the last service-line step and FX. Current data: 655.7. |
| Labels | Each step: `$Δ` and `Δ%` of comparator. |
| Naming | "Comparison NR" → `Budget NR` / `PY NR` / `Prior fcst NR` depending on toggle. |
| Steps | Platform subscriptions · Payments · Apps, partners & ads · Professional services · [CC subtotal] · FX translation · FX transaction (if material, else merge) · Total. |
| Interaction | Click step → variance table filters to that service line's revenue and directly attributable cost lines. |
| Colour | Favourable green, adverse orange, subtotals dark; FX bar hatched to mark it as non-controllable. |

### 5.2 Profit bridge (new) – Budget Adj. EBITDA → Actual Adj. EBITDA → Operating profit

Steps, in order:

```
Budget Adj. EBITDA
  + Revenue volume effect          (ΔRevenue at budget GM%)
  + GM rate effect                 (ΔGM% within each stream × actual revenue)
  + GM mix effect                  (shift between streams at budget GM% per stream)
  + S&M  Δ
  + R&D  Δ
  + G&A  Δ
  + FX on EBITDA                   (translation effect on all lines)
= Actual Adj. EBITDA               (subtotal bar)
  + Adjusting items Δ              (one-offs vs budget)
  + D&A Δ
  + SBC Δ
= Actual Operating profit          (total bar)
```

- Reconciliation check printed under the chart: `Σ steps = Actual − Budget` to 0.05.
- Same axis, label, naming and click rules as 5.1.
- A second toggle **EBITDA | Operating profit | Net income** selects where the bridge ends.

---

## 6. Row 2 – Tables

### 6.1 Service-line economics table (new)

One row per stream + total.

| Column | Definition |
|---|---|
| Stream | Platform subscriptions · Payments · Apps, partners & ads · Professional services · Total |
| Revenue | actual, $m |
| Rev Δ / Δ% | vs comparator |
| Cost of revenue | actual, $m |
| Gross profit | `Revenue − CoR` |
| GP Δ / Δ% | vs comparator |
| GM % | `GP / Revenue`, 1 dp |
| GM Δ pp | vs comparator |
| Rev share % | `Revenue / Total revenue` |
| Pass-through ratio | `CoR Δ / Rev Δ` for the stream (shows how much of a revenue beat is retained; payments on current data ≈ 56% pass-through) |

Status dot per row on **GP Δ%**, not on revenue. Revenue beats that don't reach gross profit must not light up green.

### 6.2 Largest variances table (existing, enhanced)

Subtitle: *"Top N lines by |Δ|, $m. Δ = impact on profit; negative is adverse."*

| Column | Definition |
|---|---|
| Line | P&L line name |
| Block | P&L block (gross revenue, cost of revenue, S&M, R&D, G&A, adjusting items, below EBITDA) |
| Comparator | budget / PY / prior fcst value |
| Actual | |
| Δ | `profit impact`: revenue lines `Actual − Comp`; cost lines `Comp − Actual` |
| Δ % | of comparator; render **n.m.** when `abs(Comparator) < 2.0` or `abs(Δ%) > 50%` |
| vs PY Δ | second comparator always visible, so budget-vs-PY context is on one row |
| Nature | enum: `FX` · `Timing` · `One-off` · `Volume` · `Rate` · `Mix` · `Pass-through` · `Structural` · `Unclassified` |
| Run-rate FY | annualised persistence of the variance, $m (`0` for Timing/One-off, FP&A input otherwise) |
| Owner | function / cost-centre owner |
| Comment | ≤ 15 words |

Rules
- Sort: by |Δ| descending (default) or P&L order (toggle). Never an unexplained mixed order.
- N = 8 default, user-adjustable 5–15.
- Footer rows: **Shown lines total** · **All other lines** · **Total P&L Δ** · **Coverage** (`Σ|Δ shown| / Σ|Δ all|`, %).
- Rows highlighted when `Nature = Unclassified` and |Δ| > 1.0 — forces classification before publishing.
- Bar column: horizontal diverging bar, single shared scale, zero line visible.

---

## 7. Row 3 – Time and outlook

### 7.1 Monthly trend (new)
- Lines: Actual · Budget (phased) · Prior year; metrics: Net revenue and Adj. EBITDA (toggle); trailing 15 months.
- Secondary panel: cumulative YTD variance vs comparator (step area) — a timing variance shows as a dip that recovers; a structural one keeps widening.
- Markers on months with |variance| above the red threshold.

### 7.2 FY outlook bridge (new)
```
FY Budget → Δ YTD actual vs budget → Δ remaining-period forecast vs budget (by driver: volume · rate · FX · opex · one-offs) → FY Forecast
```
- Both Net revenue and Adj. EBITDA (toggle).
- Side table: **Run-rate impact** – each variance from 6.2 with `Run-rate FY` ≠ 0, summed, reconciled to the remaining-period step.
- Label: FY attainment % (`FY Forecast / FY Budget`).

---

## 8. Drill-through panels

### 8.1 Volume / rate / mix
| Stream | Decomposition |
|---|---|
| Payments | `ΔRev = ΔGMV × take rate_comp` (volume) `+ GMV_act × Δtake rate` (rate) `+ mix` (card type / region at constant take rates) |
| Subscriptions | `ΔRev = Δmerchants × ARPU_comp` (count) `+ merchants_act × ΔARPU` (price) `+ plan-mix` |
Shown as a mini-bridge per stream + table.

### 8.2 Gross margin rate vs mix
Two bars: **Rate effect** (`Σ stream ΔGM% × actual stream revenue`) and **Mix effect** (`Σ (Δrev share × (GM%_stream − GM%_total))`). Explains the blended GM Δpp on the KPI page in one glance.

### 8.3 Opex by function
| Function | Actual | Comp | Δ | Δ% | % of revenue | FTE actual / comp | Cost per FTE | Capitalised R&D % (R&D only) |
Driver column (FTE / contractors / capitalisation) is mandatory for R&D and S&M.

### 8.4 Adjusting items register
| Item | Description | Actual | Budget | Planned? (Y/N) | Period incurred | Expected total | Owner |
Every line in "Adjusting items (non-underlying)" must appear here. Unbudgeted items flagged.

---

## 9. Definitions (tooltips + glossary tab)

| Term | Definition |
|---|---|
| Constant currency | Actual restated at comparator-period FX rates (budget rates when comparing to budget, PY rates when comparing to PY) |
| FX translation | Effect of converting foreign-currency results to USD |
| FX transaction | Realised gains/losses on non-functional-currency transactions (show separately only if > 0.5) |
| Pass-through | Revenue and cost lines that move together by contract (interchange, scheme fees, partner revenue share); pass-through Δ = cost Δ attributable to the revenue Δ |
| Controllable | Variances excluding FX, interchange/scheme rate changes, regulatory items, and budget phasing errors |
| Run-rate FY | Annualised amount of the variance expected to persist to year end; 0 for Timing and One-off |
| Nature taxonomy | see §6.2; one tag per line per period, set in the model, not in the report |

---

## 10. Data-quality fixes (blocking)

| # | Issue | Action |
|---|---|---|
| DQ-1 | Variance table sign convention not stated; cost and revenue Δ read inconsistently | Implement profit-impact sign (§6.2) and state it in the subtitle |
| DQ-2 | Table says "top 8 by size" but rows are not sorted by size | Default sort by \|Δ\| |
| DQ-3 | −52.9% on a sub-$3m base | n.m. rule (§6.2) |
| DQ-4 | "Total +1.0" ambiguous (8 lines vs full P&L) | Footer rows with coverage % |
| DQ-5 | Bridge deltas unreadable on zero-based axis | Truncated axis or net-change panel (§5.1) |
| DQ-6 | No constant-currency subtotal; FX is +11.7 of a +9.2 beat and the page does not say so | CC subtotal bar + headline strip |
| DQ-7 | Pass-through on payments (+11.0 revenue / −6.2 cost) shown as two unrelated rows | Service-line table with pass-through ratio |

---

## 11. Measures to add to the model

```
Rev_CC                   = Σ(local revenue × comparator FX rate)
FX_Translation_Delta     = Rev_Actual − Rev_CC
PassThrough_Delta        = Σ(pass-through cost lines Δ attributable to revenue Δ)
OneOff_Delta             = AdjustingItems_Actual − AdjustingItems_Comp
Underlying_Delta         = CC_Delta − OneOff_Delta − PassThrough_Delta
Controllable_Delta       = Underlying_Delta − NonControllable_Delta
GM_Rate_Effect           = Σ_stream (GM%_act − GM%_comp) × Rev_act_stream
GM_Mix_Effect            = Σ_stream (Share_act − Share_comp) × (GM%_comp_stream − GM%_comp_total)
Rev_Volume_Effect_EBITDA = (Rev_act − Rev_comp) × GM%_comp
Opex_Delta_by_Function   = Comp − Actual, per function
Profit_Bridge_Check      = Σ steps − (EBITDA_act − EBITDA_comp)   → must be |x| < 0.05
Variance_ProfitImpact    = IF(line is revenue, Act − Comp, Comp − Act)
Variance_Pct_Display     = IF(abs(Comp) < 2 OR abs(pct) > 0.5, "n.m.", pct)
Variance_Nature          = lookup from classification table (line, period)
RunRate_FY               = lookup from FP&A input table
Coverage_Pct             = Σ|Δ top N| / Σ|Δ all lines|
FY_Forecast              = YTD_Actual + Remaining_Projection
FY_Attainment            = FY_Forecast / FY_Budget
PassThrough_Ratio        = CoR_Delta_stream / Rev_Delta_stream
Cum_YTD_Variance         = running Σ (Actual − Comp) by month
```

Classification tables to add: `VarianceNature(line, period, nature, run_rate_fy, owner, comment)`, `PassThroughMap(revenue_line → cost_line)`, `NonControllable(line)`.

---

## 12. Acceptance criteria

- [ ] Headline strip shows Reported / CC / Underlying / Controllable Δ for revenue and EBITDA; on current data CC revenue Δ reads −2.5 (−0.4%).
- [ ] Revenue bridge has a CC subtotal bar and readable delta bars (each step ≥ 8px tall at default size).
- [ ] Profit bridge reconciles to 0.05; ends at the metric selected by the toggle.
- [ ] Variance table: sign convention in subtitle; sorted by |Δ|; n.m. rule applied; Nature and Run-rate columns populated for every row with |Δ| > 1.0; footer shows coverage %.
- [ ] Service-line table shows GP Δ and pass-through ratio per stream.
- [ ] Trend chart shows 15 months act/bud/PY with cumulative variance panel.
- [ ] FY outlook bridge reconciles to the run-rate table.
- [ ] Comparator toggle (Budget / PY / Prior forecast) re-bases every panel.
- [ ] Clicking a bridge bar cross-filters the variance table.
- [ ] Commentary block populated and reviewed before publish; empty block blocks publish.
- [ ] A reader can state, within 15 seconds: the real (CC, underlying) variance, the single biggest cause, and whether it persists to FY.

---

## 13. Open questions for the owner

1. Which cost lines are contractually pass-through (interchange, scheme fees, partner rev-share)? Needed for the PassThroughMap.
2. Is a prior forecast stored by period, so "Compared with: Prior forecast" is possible?
3. Is FX transaction effect material enough to show separately from translation?
4. Who owns the Nature / Run-rate classification each period — FP&A central or function controllers?
5. Should the Profitability tab absorb the GM rate/mix and service-line economics panels, leaving this page as bridges + variances + outlook?
