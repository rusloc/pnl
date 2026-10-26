# Profitability Page – Optimisation Spec

**Report:** Financial statement report, Profitability page
**Data base:** P&L model by slice (region · sales motion · service line · segment): revenue, cost of revenue, variable costs, direct opex where attributable; budget, prior year, prior forecast; FX by currency; merchants by slice
**Goal:** The reader can tell *where* profit is made, *whether each slice is improving*, and *which slice drove the period's profit variance* — and is never misled by allocated numbers or FX.
**Companions:** `kpi-page-spec.md`, `analysis-page-spec.md`. Shared threshold table, number formats, colour rules and definitions (§9 of the Analysis spec) apply unchanged.
**Status:** Draft v1 · 2026-10-23

---

## 1. Findings on the current page (why it is not yet informative)

| # | Finding | Evidence on current data | Consequence for the reader |
|---|---|---|---|
| F-1 | **The green "beats" are FX.** Regional revenue vs budget is shown reported only. | CE +4.9% (+7.2) and UK&I +5.8% (+3.8) sum to +11.0; the Analysis page shows FX translation = +11.7, which sits entirely outside North America. At constant currency every region is on or below budget (total CC −2.5). | Reader concludes Europe is outperforming; it is not. |
| F-2 | **EBITDA and Operating margin columns carry no information.** Lines below contribution are allocated by NR share. | CM − EBITDA margin is a near-constant ≈ 38.6–39.2 pp in every row. The two columns are the contribution column minus a constant. | False precision; invites conclusions about regional "operating profitability" that do not exist in the data. |
| F-3 | **Margin dispersion is 1.0 pp; chart scale is 0–60%.** | CM% range 50.9–51.9%. Four bars of identical length. | The chart answers nothing; the dashed average line is invisible against the bars. |
| F-4 | **No comparison on any margin.** Only NR has a "vs comparison" column. | Gross, Contribution, EBITDA, Operating are shown as static values. | Cannot tell whether any region's margin is improving, deteriorating, or off plan. |
| F-5 | **No $ profit.** Only margin %. | Contribution $ by region is NA ≈ 182, CE ≈ 80, APAC ≈ 44, UK&I ≈ 36 — never shown. | Reader cannot weigh a 1 pp margin gap in NA (≈ $3.6m) against the same gap in UK&I (≈ $0.7m). |
| F-6 | **No growth by region.** | Total revenue is +29.9% YoY; the page does not say where. | The main story of the year (where growth comes from and at what margin) is absent. |
| F-7 | **"vs comparison" is unlabelled.** | Header does not say vs Budget / PY / forecast, nor which metric. | Ambiguity on the one variance column that exists. |
| F-8 | **Table and chart sort differently.** | Table by NR (NA, CE, APAC, UK&I); chart NA, CE, UK&I, APAC — neither by NR nor by margin. | Eye has to re-map rows to bars. |
| F-9 | **Half the page is empty.** | Table occupies ~40% of the left panel. | Space for a variance decomposition or trend is unused. |
| F-10 | **Allocation caveat is a footnote.** | Grey text at the bottom of the panel. | The most important caveat on the page is the least visible element. |

---

## 2. Design principle

| Question the page must answer | Panel |
|---|---|
| Where is revenue and profit concentrated? | Table (NR share, contribution share) + headline strip |
| Is each slice's margin on plan and improving? | Table (Δ pp columns) + margin deviation chart |
| Which slice drove the period's profit variance, and was it volume or margin? | Profit variance waterfall by slice |
| Is growth coming from high- or low-margin slices? | Growth × margin bubble chart |
| Why do margins differ between slices? | Mix heatmap (slice × service line) |
| Is the picture stable over time? | Quarterly CM% trend by slice |

Rule: **no allocated number in a headline column.** Allocated figures appear only in a collapsed, visibly de-emphasised group, and a *Corporate / unallocated* row makes totals reconcile without spreading central costs over slices.

---

## 3. Page structure

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ HEADER  Period · Currency [Reported | Constant currency] · Compared with [Budget |  │
│         Prior year | Prior forecast] · Break down by [Region | Sales motion |      │
│         Service line | Segment]                                                   │
├──────────────────────────────────────────────────────────────────────────────────┤
│ HEADLINE STRIP  Concentration · CM dispersion · Slice driving profit Δ · CC note   │
├─────────────────────────────────────────────┬────────────────────────────────────┤
│ ROW 1  Profitability table (redesigned)      │ CM deviation vs average (lollipop) │
├─────────────────────────────────────────────┼────────────────────────────────────┤
│ ROW 2  Profit variance by slice (waterfall)  │ Growth × margin bubble chart       │
├─────────────────────────────────────────────┴────────────────────────────────────┤
│ DRILL  Mix heatmap (slice × service line) · Quarterly CM% trend · Allocation view │
└──────────────────────────────────────────────────────────────────────────────────┘
```

- All four toggles drive every panel.
- Table row click → highlights the slice in all charts; chart element click → highlights the row.

---

## 4. Header & headline strip

### 4.1 Header
| Element | Spec |
|---|---|
| Period | explicit, e.g. `FY Jan–Dec 2025`; must match the other pages |
| Currency toggle | **Reported** / **Constant currency** (at comparator rates). Default: Constant currency when Compared with = Budget or PY. |
| Comparator toggle | Budget · Prior year · Prior forecast |
| Breakdown toggle | Region · Sales motion · Service line · Segment |

### 4.2 Headline strip – four tiles

| Tile | Formula | Current data |
|---|---|---|
| **Concentration** | share of NR in largest slice; share of contribution $ in largest slice | NA 53.6% of NR · ≈ 53.2% of contribution |
| **Margin dispersion** | max CM% − min CM% across slices, pp; and $ value of closing the gap to the best slice | 1.0 pp · ≈ $3.6m if NA reached CE's CM% |
| **Profit Δ driver** | slice with largest contribution $ Δ vs comparator, with its revenue/margin split | populated from §6.1 |
| **FX note** | reported NR Δ vs CC NR Δ for non-functional-currency slices | "Non-USD regions: +10.7 reported, ≈ −1.0 CC" |

Each tile grey/amber/red by the shared threshold rules; dispersion tile amber when gap > 2 pp, red > 4 pp.

---

## 5. Row 1 – Table and deviation chart

### 5.1 Profitability table (redesigned)

Column groups, left to right. Columns marked ▸ are collapsed by default.

**A. Scale**
| Column | Definition |
|---|---|
| Slice | region / motion / service line / segment |
| Net revenue | actual, $m (reported or CC per toggle) |
| NR share | `NR_slice / NR_total`, bar |
| NR growth YoY | % (CC) |
| NR vs comparator | `$Δ` and `%Δ` (CC); reported Δ in tooltip with the FX portion |

**B. Gross**
| Column | Definition |
|---|---|
| Gross profit $ | `NR − cost of revenue` |
| GM % | `GP / NR` |
| GM Δ vs comp | pp |
| GM Δ vs PY | pp (second comparator always visible) |

**C. Contribution (headline profit level for slices)**
| Column | Definition |
|---|---|
| Contribution $ | `GP − variable costs directly attributable` |
| CM % | `Contribution / NR` |
| CM Δ vs comp | pp |
| CM Δ vs PY | pp |
| Contribution share | `Contribution_slice / Contribution_total` — compare with NR share: a slice contributing less than its revenue share is diluting |
| Contribution $ Δ vs comp | $ — feeds the waterfall in §6.1 |

**D. Direct opex (new; only where attributable)**
| Column | Definition |
|---|---|
| Direct opex $ | regional S&M, regional G&A, local support — costs with a slice-specific cost centre |
| Contribution after direct opex $ / % | `Contribution − Direct opex`; the deepest *unallocated* profit measure per slice |

**E. ▸ Allocated (collapsed, grey italics, header badge "allocated — indicative")**
| Column | Definition |
|---|---|
| Allocated central cost | per §8 allocation keys, never pure NR share |
| Adj. EBITDA $ / % | `Contribution after direct opex − allocated central cost` |
| Operating profit $ / % | EBITDA − allocated D&A/SBC/one-offs |

**Rows**
- One per slice, sorted by NR descending (default; user may sort by any column; chart sort follows table sort).
- **Corporate / unallocated** row: central costs not attributed to any slice (shown in group D/E context so Σ slices + Corporate = Total).
- **Total** row reconciles to the P&L statement tab.

**Status colouring**
- Status dot on **CM Δ vs comp** (pp thresholds) and on **Contribution $ Δ vs comp** ($ thresholds). Not on NR vs comp — revenue beats that are FX or low-margin must not read green.

### 5.2 Contribution margin deviation chart (replaces the bar chart)

| Element | Spec |
|---|---|
| Type | horizontal lollipop: dot = CM% of slice, baseline = company CM% (51.3%); value shown as **± pp from average** |
| Scale | symmetric, auto-fit to data with minimum ±2 pp (current data: ±1 pp shown on ±2 pp axis — differences are visible) |
| Markers | hollow tick = comparator CM%; grey tick = PY CM%; so each row reads actual vs plan vs last year at a glance |
| Dot size | proportional to NR (a 1 pp gap in NA is bigger than 1 pp in UK&I) |
| Order | same as table |
| Labels | `CM% · Δ vs avg pp · Δ vs comp pp` |

---

## 6. Row 2 – Decomposition charts

### 6.1 Profit variance by slice (waterfall, new)

```
Comparator contribution $
  + Slice 1: revenue effect     (NR_act − NR_comp) × CM%_comp
  + Slice 1: margin effect      (CM%_act − CM%_comp) × NR_act
  + Slice 2: revenue effect
  + Slice 2: margin effect
  …
  + FX effect                   (if Currency = Reported)
= Actual contribution $
```
- Revenue effect bars solid; margin effect bars hatched; FX hatched and grey.
- Toggle to collapse per-slice pairs into one bar per slice.
- Reconciliation line under chart: `Σ = Actual − Comparator` to 0.05.
- This chart answers the question the current page asks and never answers: *which region moved profit, and was it volume or margin?*

### 6.2 Growth × margin bubble chart (new)

| Axis / mark | Spec |
|---|---|
| X | NR growth YoY, CC, % |
| Y | CM %, 1 dp |
| Bubble size | NR $m |
| Reference lines | company CM% (horizontal); company growth % (vertical) → four quadrants: *profitable growth · dilutive growth · profitable stagnation · problem* |
| Trail | thin line from PY position to current position per slice (optional, toggle) |
| Labels | slice name; tooltip with all table columns |

---

## 7. Drill-through panels

### 7.1 Mix heatmap – slice × service line
- Cells: NR $m (size/number) and GM% (colour).
- Explains margin differences between slices: on current data, NA's lower CM is expected to be a heavier payments mix (≈ 31% GM) vs subscription (81% GM). Without this panel the reader cannot distinguish "NA is less efficient" from "NA sells more payments".
- Row/column totals reconcile to table.

### 7.2 Quarterly CM% trend by slice
- Lines per slice, 8 quarters, company average dashed; comparator phased as dotted.
- Y-axis auto-fit with minimum range 4 pp.

### 7.3 Allocation view (replaces the footnote)
- Table: central cost pool · allocation key · $ allocated per slice · % of slice NR.
- Shows the reader *how* allocated columns were built and lets them judge whether to trust them.

---

## 8. Allocation policy (replaces "allocated by NR share")

| Cost pool | Allocation key | Rationale |
|---|---|---|
| Regional S&M, regional G&A, local support | **Direct** (cost centre) | not allocated — attributed |
| Hosting / infrastructure | GMV or transaction volume | cost driver |
| Customer support | active merchants or ticket volume | cost driver |
| Payment risk & fraud | GMV | cost driver |
| Central R&D | *not allocated* → Corporate row | no causal link to slice; allocating by NR share only restates revenue share |
| Corporate G&A, M&A, one-offs | *not allocated* → Corporate row | same |

- Allocation keys stored in a `AllocationKey(cost_pool, key, period)` table; the Allocation view (§7.3) renders it.
- Any column built with an allocation carries the "allocated — indicative" badge in its header, not a footnote.

---

## 9. Breakdown-specific column sets

The table's column set adapts to the breakdown dimension; groups A–E stay, driver columns change.

| Breakdown | Additional driver columns |
|---|---|
| Region | active merchants · NR per merchant · GMV per merchant · FX portion of NR Δ |
| Service line | take rate (payments) · ARPU (subscriptions) · attach rate (apps) · utilisation (professional services); groups D/E hidden — opex is not attributable by service line |
| Sales motion | CAC (if available) · new vs existing NR split · payback months |
| Segment | merchants · NR per merchant · churn % (if available) |

---

## 10. Data-quality fixes (blocking)

| # | Issue | Action |
|---|---|---|
| DQ-1 | Regional "vs comparison" shown reported; FX inflates CE/UK&I | Add CC toggle (default CC vs Budget/PY); show FX portion in tooltip and headline strip |
| DQ-2 | EBITDA/Operating margins by slice = CM − constant | Move to collapsed allocated group with badge; add Corporate/unallocated row; implement §8 keys |
| DQ-3 | "vs comparison" column unlabelled | Rename `NR vs Budget (CC)` dynamically from toggles |
| DQ-4 | Chart scale 0–60% hides 1 pp dispersion | Replace with deviation lollipop, min ±2 pp scale |
| DQ-5 | Chart order ≠ table order | Chart inherits table sort |
| DQ-6 | No $ profit, no margin Δ, no growth columns | Groups B–C in §5.1 |
| DQ-7 | Allocation caveat as footnote | Header badge + Allocation view |
| DQ-8 | Period label inconsistent across pages | Single period measure feeding all page headers |

---

## 11. Measures to add to the model

```
NR_CC_slice                = Σ(local NR × comparator FX rate), by slice
NR_Delta_CC_slice          = NR_CC_slice − NR_comp_slice
FX_Portion_slice           = NR_act_slice − NR_CC_slice
NR_Growth_CC_slice         = NR_CC_slice / NR_PY_slice − 1
GP_slice                   = NR_slice − CoR_slice
GM_pct_slice, GM_Delta_pp_comp, GM_Delta_pp_PY
Contribution_slice         = GP_slice − VariableCost_slice
CM_pct_slice, CM_Delta_pp_comp, CM_Delta_pp_PY
Contribution_Share_slice   = Contribution_slice / Contribution_total
Contribution_Delta_slice   = Contribution_slice − Contribution_comp_slice
Rev_Effect_slice           = (NR_act − NR_comp) × CM_pct_comp
Margin_Effect_slice        = (CM_pct_act − CM_pct_comp) × NR_act
Waterfall_Check            = Σ(Rev_Effect + Margin_Effect) + FX_Effect − Contribution_Delta_total  → |x| < 0.05
DirectOpex_slice           = Σ cost centres mapped to slice
CAD_slice                  = Contribution_slice − DirectOpex_slice        (contribution after direct opex)
Allocated_Cost_slice       = Σ_pool Pool_amount × Key_share(slice)       (per AllocationKey table)
Corporate_Unallocated      = Total central cost − Σ Allocated_Cost_slice
EBITDA_alloc_slice         = CAD_slice − Allocated_Cost_slice             (badge: allocated)
CM_Dev_From_Avg_pp         = CM_pct_slice − CM_pct_total
Dispersion_pp              = max(CM_pct_slice) − min(CM_pct_slice)
Gap_Value_$                = (max CM_pct − CM_pct_slice) × NR_slice, for the largest slice
Concentration_NR, Concentration_Contribution
NR_per_Merchant_slice, GMV_per_Merchant_slice
```

Tables to add: `AllocationKey(cost_pool, key, period)`, `CostCentreToSlice(cost_centre, slice_type, slice)`, `SliceFX(slice, currency, rate_act, rate_comp, rate_PY)`.

---

## 12. Acceptance criteria

- [ ] Currency toggle present; default CC when comparing to Budget or PY; on current data CE and UK&I NR Δ no longer show green at CC.
- [ ] No allocated figure appears in an expanded column by default; expanded allocated columns carry the badge; a Corporate/unallocated row exists and totals reconcile to the P&L statement.
- [ ] Table shows $ and % for gross profit and contribution, with Δ pp vs comparator and vs PY, and NR growth YoY, for every slice.
- [ ] Deviation chart renders 1 pp differences at ≥ 20 px separation; order matches table.
- [ ] Profit variance waterfall reconciles to 0.05 and splits revenue vs margin effect per slice.
- [ ] Bubble chart renders four quadrants with company reference lines.
- [ ] Mix heatmap reconciles row and column totals to the table.
- [ ] All toggles (period, currency, comparator, breakdown) drive every panel.
- [ ] Footnote removed; Allocation view available from the badge.
- [ ] A reader can state within 15 seconds: the most profitable slice in $, whether any slice's margin is off plan, and which slice drove the profit variance.

---

## 13. Open questions for the owner

1. Which cost centres can be mapped directly to region / sales motion / segment? (determines how far group D goes)
2. Is FX held by currency and slice, so CC by slice is computable? (DQ-1 depends on it)
3. Are the four breakdown dimensions additive and mutually exclusive within each dimension? (required for waterfall reconciliation)
4. Are merchants, GMV and ARPU available by slice? (drives §9 columns)
5. Are variable costs defined consistently across slices, so CM% is comparable? If not, the deviation chart should show GM% until it is.
