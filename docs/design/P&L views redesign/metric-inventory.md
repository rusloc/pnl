DRAFT — projection state (assessment only; nothing implemented in any track)

# Metric inventory — KPI · Analysis · Profitability views (the merge)

> 2026-10-26. Inputs: the three USER specs of 2026-10-23 (`docs/specs/2026-10-23-pnl-{kpi,analysis,profitability}-page-spec.md`), what exists today (`docs/model/measure-dictionary.md`, `docs/ADD/features/pbi-report-layout.md`, ADR-0007, `docs/design/kpi-card-v2.md`, `docs/design/parity-rules.md`), the data (`data/acme_pl_dummy_data/README.md` + dims) and the previous gap analysis (`docs/ADD/features/pnl-spec-gap-analysis-2026-10-24.md`, whose data findings are reused, not redone).
> Rule applied: a metric is placed on the redesign only if it **exists** (a named measure) or is **buildable now** from columns the model already holds. Anything that needs a table or a column the data does not have is "later (needs data)" and is left off the layout. Nothing else is invented.

Status legend: **exists** = a measure in `_measures` today · **buildable now** = new measure(s) over existing columns, no data change · **later: needs data** = needs a table / column not in `data/acme_pl_dummy_data/` · **dropped** = removed by the spec or by this redesign.
Priority: **P1** hero · **P2** context · **P3** drill (off the main surface, reachable from it).

## 0. Vocabulary map (spec → ACME model)

| Spec term | Model equivalent | Note |
|---|---|---|
| Merchants / Active merchants | `KPI Active Merchants` (`fact_operational.active_merchants_end`, Commerce Cloud) | Period-end count (K-23). Spec DQ-3 definition: "active paid plan at the last month-end" is already the model's one definition |
| GMV | `KPI GMV` (`fact_operational.gmv_local`, translated) | Commerce Cloud only |
| ARR | `KPI ARR` = subscription NR of the last window month × 12 | Run-rate proxy, not contract ARR (gap analysis Q5). Labelled "ARR (run-rate)" on the page |
| Service lines: Platform subscriptions / Payments / Apps, partners & ads / Professional services | `dim_line` SUB / PAY / APP / PS | Exact match. For Consumer Products the same slot is **Category** (5 values); for ACME Group it is **Entity** |
| Regions NA / CE / UK&I / APAC | `dim_region` North America / Continental Europe / UK & Ireland / Asia-Pacific | Exact match (functional currencies USD / EUR / GBP / AUD) |
| Sales motion / Segment | `dim_channel` (S: Self-serve, Sales-led, Partner & agency-led) / `dim_segment` (S: Small business, Mid-market, Enterprise) | Exact match; P uses Channel / Price tier |
| Net income | `Net Profit` (line 28 NP) | |
| Opex (S&M + R&D + G&A) | Blocks SM, RD, GA (`OPEX` group total also includes OOI) | Spec excludes D&A / SBC / one-offs: D&A (DA) and one-offs (ADJ) are already outside these blocks; SBC does not exist in the data (gap analysis D-7) |
| Adjusting items / one-offs | Block ADJ (restructuring, impairment, M&A) | Sits **below** Adj. EBITDA (spine step 12) |
| Budget / Prior year / Latest estimate comparators | `param_compare_a` / `param_compare_b` (B, LE, PY, None) | |
| Prior forecast comparator | FC2606 exists as a version but is not selectable (Requirements §11; gap analysis P7 skip) | **no equivalent in model** (as a comparator) |
| Constant currency | FX basis CC = every version at the selected year's **budget** rates (C-12); `_NR CC Base`, `_NR CC Bridge Cmp`, `Bridge FX` | vs Budget this equals the spec's "actual at comparator rates". vs PY the spec wants PY-year rates; ours uses the selected year's budget rates (gap analysis P9: skip) |
| FY forecast = YTD actual + remaining projection | Latest estimate (C-02): `FY LE Amount`, `PL FY LE`, `PL Δ LE vs Budget` | Same concept |
| Pass-through, Controllable, Nature, Run-rate FY, Owner, Comment | **no equivalent in model** (classification tables `VarianceNature`, `PassThroughMap`, `NonControllable` do not exist) | The obvious one-row map Payments → `COR_S2 Payment processing & interchange` is a candidate (open decision 6) |
| Direct opex by slice / allocation keys | Opex and everything below is **booked at entity × region × cost centre** (C-31, README) and allocated by NR share only to channel / line / segment (`fact_pl_allocated`) | So by **Region** (and Entity in the Group view) EBITDA and OP are booked, not allocated; by Channel / Line / Segment they are allocated. No `AllocationKey` / `CostCentreToSlice` tables |
| SBC, FTE, CAC, churn, ARPU, attach rate, utilisation, cash / FCF | **no equivalent in model** (gap analysis D-5, D-7, §11) | |
| Thresholds table (§6) | none today | A `param_kpi_threshold` table is a parameter, not data: buildable now |

Illustrative dataset used on the page: **Commerce Cloud · Actual · FY Jan–Dec 2025 · vs Budget (Compare A) and Prior year (Compare B) · USD m**, because the specs quote that view (NR 667.4 · Adj. EBITDA 82.8 · OP 48.6 · FX +11.7 · CC NR 655.7 · region CM % 50.9–51.9). Values the specs do not quote are placeholders labelled "illustrative" in the page footer.

## 1. KPI view

| Metric | Source (existing measure \| spec §) | Status | Priority | Placement in the redesign | Note |
|---|---|---|---|---|---|
| Net revenue | `KPI Value` (K-01), `Net Revenue` | exists | P1 | Hero card 1 (large) | Δ vs Budget $ and %, Δ vs PY $ and % from `KPI Δ A` / `KPI Δ B` (+ a $ Δ measure, trivial) |
| Organic growth vs PY | `KPI Organic Growth` (K-02) | exists | P2 | Sub-line of Net revenue ("Organic +x.x% · Reported +y.y%") | Spec §5 "removed" table: duplicates vs PY; the K-02 tile is folded into the hero |
| Reported growth vs PY | `KPI Reported Growth` (K-02 sub-line) | exists | P2 | Same sub-line | |
| Adj. EBITDA + margin | `KPI Value` (K-07), `KPI Adj EBITDA Margin` | exists | P1 | Hero card 2 (large) | Sub-line "Margin 12.4%" (`KPI Secondary`) |
| Operating profit + margin | `KPI Value` (K-08), `KPI Operating Margin` | exists | P1 | Hero card 3 (large; the IFRS 18 required subtotal) | Sub-line "Margin x% · Net profit $x m" |
| Net profit (spec: Net income) | `Net Profit`, `KPI Net Margin` | exists (Group tile K-11; measure for every entity) | P2 | Sub-line of Operating profit | Spec 1.5 sub-line |
| EBITDA → OP bridge note | `Adjusted EBITDA`, line DA, line ADJ (`PL Base` rows) | exists | P3 | Tooltip of Operating profit ("82.8 − D&A 30.1 − adjusting items 4.1 = 48.6") | Spec says "− SBC": no SBC in the data, the tooltip omits it |
| Gross margin % | `KPI Gross Margin %` (K-03) | exists | P2 | Secondary card (row 1) | Δ in pp (`KPI Δ A` PCT branch) |
| GM sub-lines per stream | `KPI Subscription GM %` (K-11 S); Payments GM % = same pattern on `PAY` | exists / buildable now | P3 | Sub-line of Gross margin % ("Subscription 81.0% · Payments 31.0%") | Entity swap: P shows the two largest categories, Group shows CP / CC GM % |
| Opex % revenue (new) | spec KPI §5 1.3, §9 `Opex_pct_rev`; blocks SM + RD + GA ÷ NR (`PL % NR` already does it per row) | buildable now | P2 | Secondary card (row 1); **lower is better** (`dim_kpi.better_when = Lower`) | Excludes OOI, DA, ADJ; no SBC exists. Gap analysis P2 proposed the same ratios as statement memo rows |
| Opex sub-lines S&M / R&D / G&A % NR | `PL % NR` on rows SM, RD, GA | exists (statement column) | P3 | Sub-line of Opex % revenue | |
| Contribution margin % | `KPI CM %` (K-06) | exists → **dropped from KPI view** | — | Profitability view (table + lollipop) | Spec §5: moves 1:1 with GM; keep where it carries information |
| GMV processed | `KPI GMV` (K-09 S) | exists | P2 | Driver card (row 2, slot swaps by entity) | P slot: Units sold (`KPI Units Sold`); Group slot: Consumer Products operating margin (`KPI CP Operating Margin`) |
| Payments take rate | `KPI Payments Take Rate` (K-05 S) | exists | P3 | Sub-line of GMV ("Take rate 2.67% (+3 bp vs PY)") | bp = pp × 100 on the PCT2 Δ. Spec DQ-2 (two exact zeros): a generator artefact to confirm, not a model bug |
| Active merchants | `KPI Active Merchants` (K-10 S) | exists | P2 | Driver card (row 2) | P slot: Net revenue per unit (`KPI NR per Unit`); Group: Commerce Cloud operating margin (`KPI CC Operating Margin`) |
| GMV per merchant | `KPI GMV` ÷ `KPI Active Merchants` | buildable now | P3 | Sub-line of Active merchants | |
| ARR (run-rate) | `KPI ARR` (K-04 S) | exists | P2 | Driver card (row 2) | P slot: Gross-to-net % (`KPI Gross-to-Net %`); Group: Services share of NR (`KPI Services Share`) |
| Net new ARR | `KPI ARR` − `KPI ARR` evaluated as Compare B (PY) via `_Sel Eval` | buildable now (vs PY period end) | P3 | Sub-line of ARR | "vs prior period end" needs the Prior-period comparator (gap analysis P5, not recommended) |
| Revenue mix (Subscription % / Payments %) | `Prof NR Share` by `dim_line`; gap analysis P1 "x % of NR recurring" | buildable now | P2 | Driver card (row 2): "Sub 37.5% · Pay 45.3%", Δ vs PY in pp | P slot: A&P % NR (`KPI A&P % NR`); Group: Intercompany eliminated (`KPI IC Eliminated`) |
| FY outlook vs budget | `FY LE Amount`, `FY Budget Amount`, `PL Δ LE vs Budget` (M-14) on NR and EBITDA; attainment = FY LE ÷ FY Budget | exists / buildable now | P2 | Driver card (row 2, same for every entity) | With a closed full year the outlook equals actual (card says so); live for YTD windows |
| Rule of 40 | `KPI Rule of 40` (K-12 S) | exists | P3 | Sub-line of Adj. EBITDA ("Rule of 40: 39.9") | Spec DQ-1: the PY value cannot be built for a window whose prior year has no prior year (FY2024 has none, C-04) → show the value, no PY comparison. P slot sub-line: Price / mix (`KPI Price Mix`); Group: Effective tax rate (`KPI Effective Tax Rate`) |
| Volume growth / Price-mix (P), ETR / CP / CC margins (Group) | `KPI Volume Growth`, `KPI Price Mix`, `KPI Effective Tax Rate`, `KPI CP Operating Margin`, `KPI CC Operating Margin` | exists | P2 / P3 | Entity slot swaps (see rows above); nothing lost from the 12 current tiles | L-10: same layout per entity, content swaps as today |
| Subscription GM % tile | `KPI Subscription GM %` | exists → **dropped as a tile** | — | Sub-line of Gross margin % | Spec §5 removed table |
| Status dot grey / amber / red, green text | spec KPI §6 thresholds (±1.0 % / ±0.3 pp on track; 3.0 % / 1.0 pp red) | buildable now (`param_kpi_threshold` table + one measure) | P1 | Every card | Colour only on breaches; PY variances text-only. "Lower is better" inverts on Opex % |
| 12-period sparkline | monthly `Net Revenue` etc. at month grain (data exists; `KPI Trend` was dropped 2026-10-23) | buildable now (re-add one month-grain measure) | P2 | Every card, actual only, dotted budget optional | **Conflicts with kpi-card-v2** (no sparklines, diverging bars). Open decision 1 |
| "on plan" for zero variance | spec KPI §4 | buildable now (format rule) | P2 | Every card | |
| Header: period · currency · refresh · 2-line headline | `Period Summary`, `Hdr Status`, `Data Status`; headline = ranking of tile Δ vs Budget in $ (spec §3) | exists / buildable now | P1 | Header band of the view | Headline is a text measure over the existing Δ measures |
| Bullet / diverging bars | kpi-card-v2 | **dropped** | — | — | Spec §4: one data point, inconsistent scale |
| Cash / FCF | — | later: needs data (§11) | — | — | Spec open question 3 |

KPI view totals: exists 22 · buildable now 8 · later 1 · dropped 3.

## 2. Analysis view

| Metric | Source (existing measure \| spec §) | Status | Priority | Placement in the redesign | Note |
|---|---|---|---|---|---|
| Reported Δ (NR, Adj. EBITDA) vs comparator | `PL Δ A` / `PL Δ A %` on rows NR, EBITDA; `KPI Δ A` | exists | P1 | Headline strip, tile 1 per metric | Comparator = parity rule 1 (Compare A, else B, else PY) |
| Constant-currency Δ (NR) | `_Bridge NR CC Change` = `_NR CC Base` − `_NR CC Bridge Cmp` | exists | P1 | Headline strip, tile 2 (NR) | Spec worked example: Reported +9.2 → CC −2.5 |
| Constant-currency Δ (Adj. EBITDA) | engine CC branch of `_Amt Raw` on every line (F-13) evaluated next to the reported one | buildable now (second FX-basis evaluation in one visual; gap analysis P4 estimates +0.4–1 s) | P1 | Headline strip, tile 2 (EBITDA) | Today CC is a report-wide toggle, never side by side |
| Underlying Δ | spec Analysis §4.2 (`CC Δ − one-offs Δ − pass-through Δ`) | **later: needs data** (`PassThroughMap`); one-off Δ alone is zero on Adj. EBITDA by construction (ADJ is below it) | — | off the layout | |
| Controllable Δ | spec §4.2 (`NonControllable` table) | **later: needs data** | — | off the layout | |
| Commentary bullets (FP&A text) | spec §4.3 | later: needs data (text table keyed by period) | — | off the layout; a generated 2-line headline (same rule as KPI header) stands in | Auto-draft from the variances table is buildable |
| Net revenue bridge | `Bridge Value` per `dim_bridge_step` (START, service lines / volume & price-mix / entities, FX) | exists | P1 | Row 1 left | Steps per entity as today (C-40) |
| CC subtotal bar in the bridge | `_NR CC Base` (comparison + driver steps) | buildable now (one `dim_bridge_step` row "Constant-currency NR" + branch) | P1 | Bridge, before FX | Spec DQ-6: 655.7 on the quoted data |
| Truncated axis / readable steps | spec §5.1 | buildable now (Track A / C native; Track B: waterfall axis starts at zero, known limitation → "net change" panel variant) | P2 | Bridge | Open decision 4 |
| Step labels $Δ and Δ % of comparator | `Bridge Value`, `Bridge Comparison NR` | buildable now | P2 | Bridge | |
| FX transaction (separate from translation) | OOI_1 "Operating FX gains / (losses)" is a leaf of OOI | exists as a line, not as a bridge step | P3 | Largest variances row when it ranks; not a bridge step | Spec: show separately only if > 0.5 |
| Profit bridge Budget Adj. EBITDA → Actual Adj. EBITDA → OP | spec §5.2; steps from existing lines: revenue volume effect = `_Bridge NR CC Change` × budget GM %; GM rate / mix from GP by `dim_line` (COR is direct at line grain); VSC Δ, SM Δ, RD Δ, GA Δ, OOI Δ = `PL Δ A` rows; FX on EBITDA = reported − CC EBITDA; D&A and ADJ as levels (`PL Base` rows) with Δ labels | buildable now (≈ 6 new measures + a `dim_profit_step` table) | P1 | Row 1 right | Spec lists "SBC Δ": no SBC → no step. The spec's EBITDA→OP steps are restated as **levels** (D&A −30.1, adjusting items −4.1) so the bridge reconciles; their Δ vs budget is the label. A VSC step is added because the spine has one (CM, step 7). End-toggle EBITDA / OP / Net profit: INV, FIN, TAX rows exist |
| Reconciliation check line | Σ steps vs Actual − Budget | buildable now | P2 | Under each bridge | |
| Service-line economics table | NR, Rev Δ / Δ %: `Prof Net Revenue`, `Prof NR Δ %`; CoR, GP, GM %: GP ÷ NR by `dim_line` (as the Profitability table's GM % column); GP Δ, GM Δ pp vs comparator: same with `Bridge Comparison Amount`; Rev share: `Prof NR Share`; pass-through ratio = CoR Δ ÷ Rev Δ | exists / buildable now (3–4 new measures) | P2 | Row 2 left | Stream = service line (S) / category (P) / entity (Group). Status dot on **GP Δ %**, not on revenue (spec 6.1) |
| Largest variances table | `LV Base`, `LV Comparison`, `LV Δ`, `LV Δ %`, `LV Abs Δ` (top 8), `LV Δ Color` | exists | P1 | Row 2 right | Profit-impact sign = the model's signed convention (M-10: positive favourable on every line) — already true; the subtitle now says so (spec DQ-1) |
| Sort by |Δ| | `LV Abs Δ` (TopN) + sort | exists (sort order fix) | P1 | Table | Spec DQ-2 |
| n.m. rule | spec 6.2: `abs(comparator) < 2.0 or abs(Δ %) > 50 %` | buildable now (display rule in `LV Δ %`) | P2 | Table Δ % column | Spec DQ-3 |
| vs PY Δ column | `Compare B Amount` per leaf (same pattern as `LV Comparison`) | buildable now | P2 | Table | Base / comparison columns were removed from the current table for query cost; re-adding them is open decision 5 |
| Footer: shown · all other · total · coverage % | Σ over leaves of `LV Abs Δ` | buildable now | P2 | Table footer | Spec DQ-4 |
| Block column | `dim_account.block_name` | exists | P2 | Table (under the line name) | |
| Nature · Run-rate FY · Owner · Comment | spec 6.2 (`VarianceNature` table) | **later: needs data** | — | off the layout | Row-highlight rule for Unclassified goes with it |
| Monthly trend act / bud / PY, 15 months | monthly `Net Revenue` / `Adjusted EBITDA` by `dim_month` (base, Compare A, PY via `_Amt Window`) | buildable now (month-grain evaluation; the dropped `KPI Trend` shape) | P2 | Row 3 left | Markers on months beyond the red threshold: same threshold table as KPI |
| Cumulative YTD variance (step area) | running Σ of the monthly Δ | buildable now | P3 | Row 3 left, small secondary panel | |
| FY outlook bridge FY Budget → YTD Δ → remaining Δ → FY LE | `FY Budget Amount`, `PL Δ A` (YTD), `FY LE Amount`; remaining = FY LE − FY Budget − YTD Δ; attainment % | exists / buildable now | P2 | Row 3 right | "by driver (volume · rate · FX · opex · one-offs)" for the remaining step: later (needs forecast driver data). Run-rate side table: later (needs FP&A input) |
| Comparator toggle Budget / PY | Versions flyout (parity rule 1) | exists | P2 | Header line shows the comparison in use | Prior forecast: no equivalent (not selectable) |
| Click a bar → filter the table | Track-native cross-filter | buildable now (A / C native; B cross-highlight on `dim_account`) | P3 | Bridges | |
| Volume / rate / mix drill (Payments: ΔGMV × take rate; Subscriptions: Δmerchants × ARPU) | `KPI GMV`, `KPI Payments Take Rate`, `KPI Active Merchants`, NR by line | buildable now for Payments (GMV × take rate); Subscriptions needs ARPU = SUB NR ÷ merchants (buildable as a proxy); card-type / plan mix: no data | P3 | Drill tab (not on the main surface) | |
| GM rate vs mix (two bars) | same inputs as the profit bridge steps | buildable now | P3 | Drill tab | Already visible as two bridge steps |
| Opex by function: Actual, Comp, Δ, Δ %, % of revenue | `PL Base`, `PL Compare A`, `PL Δ A`, `PL Δ A %`, `PL % NR` on SM / RD / GA / OOI | exists | P3 | Drill tab | FTE, cost per FTE, capitalised R&D %: later (needs data; RD_S3 is the capitalised-dev credit, so "capitalised %" = −RD_S3 ÷ gross R&D is buildable for S) |
| Adjusting items register | leaves ADJ_1..3 with `PL Base` / `PL Compare A` | exists (as statement rows) | P3 | Drill tab | "Planned? / Expected total / Owner": later (needs data) |

Analysis view totals: exists 13 · buildable now 15 · later 7 · dropped 0.

## 3. Profitability view

| Metric | Source (existing measure \| spec §) | Status | Priority | Placement in the redesign | Note |
|---|---|---|---|---|---|
| Currency toggle Reported / Constant currency | FX basis (F-13, `param_fx_basis`) | exists (report-wide) | P1 | Header: the view states the basis in use; default CC when comparing to Budget / PY (spec 4.1) | Per-view default differs from the report default (actual rates): open decision 7 |
| Breakdown toggle Region / Channel / Line / Segment (Group: Region / Entity) | `param_breakdown_field`, `Breakdown Allowed` (F-21) | exists | P1 | Header | |
| Comparator | parity rule 1 | exists | P1 | Header | |
| Net revenue, NR share | `Prof Net Revenue`, `Prof NR Share` | exists | P1 | Table group A | |
| NR growth YoY (CC) | `KPI Organic Growth` evaluated per slice (K-22) | exists | P2 | Table group A | |
| NR vs comparator $ and % (CC), reported + FX portion in tooltip | `Prof NR Δ %`; CC: `_NR CC Base` − `_NR CC Bridge Cmp` per slice; FX portion: `Bridge FX` per slice | exists / buildable now | P2 | Table group A | Spec F-1 / DQ-1: CE and UK&I stop reading green at CC |
| Gross profit $, GM %, GM Δ vs comp pp, GM Δ vs PY pp | `Gross Profit` ÷ `Net Revenue` per slice (today's GM % column); Δ pp with `Bridge Comparison Amount` / `Compare B Amount` | exists / buildable now | P2 | Table group B | |
| Contribution $, CM %, CM Δ vs comp pp, CM Δ vs PY pp | `Contribution Margin`, `KPI CM %` per slice (today's CM % column) + Δ pp | exists / buildable now | P1 | Table group C (headline profit level) | Status dot on CM Δ vs comp and on Contribution $ Δ (spec 5.1), not on NR |
| Contribution share | Contribution_slice ÷ Contribution_total (same pattern as `Prof NR Share`) | buildable now | P2 | Table group C, next to NR share | A slice below its NR share is diluting |
| Contribution $ Δ vs comp | `Contribution Margin` − comparator | buildable now | P1 | Table group C; feeds the waterfall | |
| Direct opex / Adj. EBITDA by slice **booked** | opex is booked at entity × region (C-31): by **Region** (and Entity in the Group view) `Adjusted EBITDA` and `Operating Profit` per slice are booked, not allocated | exists (today's Adj. EBITDA % / Operating % columns, by region) | P2 | Table group D, shown for Region / Entity only; labelled "booked by region" | Spec group D is this. Dummy-data note: the generator spreads opex across regions near NR share, so dispersion is small (spec F-2) |
| Allocated Adj. EBITDA / OP by Channel / Line / Segment | `fact_pl_allocated` (NR-share allocation, C-31) | exists | P3 | Table group E, **collapsed, grey, badge "allocated — indicative"**; a "Corporate / unallocated" row needs the key table → not shown | Spec §8 allocation keys (GMV, merchants, tickets) and `AllocationKey` table: **later: needs data** |
| Corporate / unallocated row | spec 5.1 | later: needs data (which pools stay central is a policy + table) | — | off the layout | |
| Total row reconciles to the statement | `Net Revenue` etc. at the visual total | exists | P2 | Table footer | |
| Headline tile: Concentration (largest slice share of NR and of contribution) | `Prof NR Share`, contribution share (above) | buildable now | P2 | Headline strip tile 1 | |
| Headline tile: Margin dispersion (max − min CM %, $ gap to best) | CM % per slice; gap $ = (max CM % − CM %_largest) × NR_largest | buildable now | P2 | Headline strip tile 2 | Amber > 2 pp, red > 4 pp |
| Headline tile: Profit Δ driver (slice with the largest contribution $ Δ, revenue / margin split) | revenue effect = (NR_act − NR_comp) × CM %_comp; margin effect = (CM %_act − CM %_comp) × NR_act | buildable now | P1 | Headline strip tile 3 | |
| Headline tile: FX note (non-USD slices reported vs CC Δ) | `Bridge FX` per slice | buildable now | P2 | Headline strip tile 4 | Spec example: "+10.7 reported, ≈ −1.0 CC" |
| CM deviation lollipop (dot = CM % − company CM %, ticks = comparator and PY CM %, dot size ∝ NR, min ±2 pp scale) | `KPI CM %` per slice and at the visual total (today's dashed line), comparator / PY CM % (above) | exists / buildable now | P1 | Row 1 right (replaces the 0–60 % bar chart) | Spec F-3 / DQ-4 |
| Profit variance waterfall by slice (revenue effect, margin effect per slice, FX, totals) | the effect measures above + `Bridge FX` per slice | buildable now (new `dim_prof_step` rows per slice) | P1 | Row 2 left | Reconciliation line under the chart |
| Growth × margin bubble chart (x = NR growth YoY CC, y = CM %, size = NR, reference lines = company values) | `KPI Organic Growth` per slice, `KPI CM %` per slice and total, `Prof Net Revenue` | exists (inputs) / buildable now (visual) | P2 | Row 2 right | PY trail: buildable (PY CM % and PY growth need FY2023 → n/a for the FY2025 view, C-04) |
| Mix heatmap slice × service line (NR, GM % colour) | `Net Revenue`, GP ÷ NR at region × `dim_line` grain (both direct dims, C-30) | buildable now | P3 | Drill strip under row 2 (compact) | Explains NA's lower CM (payments mix) |
| Quarterly CM % trend by slice (8 quarters) | `KPI CM %` by `dim_month.quarter` per slice | buildable now | P3 | Drill (not on the main surface) | |
| Allocation view (pool · key · $ per slice · % of NR) | spec 7.3 | later: needs data (`AllocationKey`); today the only key is NR share | — | off the layout; the badge tooltip states the NR-share rule | |
| Region driver columns: active merchants, NR per merchant, GMV per merchant, FX portion | `fact_operational` carries region / channel / line / segment keys → `KPI Active Merchants`, `KPI GMV` per slice | buildable now | P3 | Table group F (Region, Commerce Cloud only; P shows units / NR per unit) | |
| Service-line drivers: take rate (PAY) | `KPI Payments Take Rate` | exists | P3 | Table group F when breakdown = Service line | ARPU: proxy buildable (SUB NR ÷ merchants); attach rate, utilisation: later (needs data) |
| Sales-motion drivers: CAC, payback, new vs existing | — | later: needs data (§11) | — | off the layout | |
| Segment drivers: churn | — | later: needs data | — | off the layout | |
| Table ↔ chart sort and highlight | track-native | buildable now | P2 | All panels follow the table sort (spec DQ-5) | |

Profitability view totals: exists 13 · buildable now 16 · later 6 · dropped 0 (the 0–60 % CM bar chart is replaced, not dropped: same measure, new form).

## 4. Dropped and why

| Item | Why |
|---|---|
| Contribution margin % tile (K-06) | Spec KPI §5: moves 1:1 with gross margin; lives on Profitability (table, lollipop) |
| Subscription GM % tile (K-11 S) | Spec KPI §5: stable context → sub-line of Gross margin % |
| Organic growth tile (K-02) | Spec KPI §5: duplicates vs PY → sub-line of Net revenue |
| kpi-card-v2 diverging comparison bars | Spec KPI §4: one data point, inconsistent scale; replaced by $ / % text + sparkline (open decision 1) |
| Payments take rate tile (K-05 S) | Spec KPI §5: flat → sub-line of GMV |
| CM % bar chart 0–60 % | Spec Profitability F-3: replaced by the deviation lollipop (same measure) |
| "Compared with: Prior forecast" | Not selectable in the model (Requirements §11; gap analysis P7 skip) |
| SBC steps / add-backs | No SBC in the data (gap analysis D-7) |
| 12-tile 3 × 4 grid | Replaced by 3 hero + 2 secondary + 5 driver cards (10 metrics, spec §2), the same 12 measures still reachable (tiles + sub-lines) |

## 5. Open decisions for the USER (max 10, each with a default)

| # | Decision | Default |
|---|---|---|
| 1 | **Sparklines vs kpi-card-v2.** The spec (10-23) wants a 12-period sparkline and no bars; kpi-card-v2 (10-22) removed sparklines and added diverging bars, and `KPI Trend` was dropped from the model the same day. | Follow the spec: re-add one month-grain trend measure, retire the bars; amend kpi-card-v2 and ADR-0007 §3a |
| 2 | **Hero set.** Net revenue, Adj. EBITDA and a third hero. | Operating profit (IFRS 18 required subtotal, and the one tile that breaches on the quoted data) |
| 3 | **One-window rule (ADR-0004, 1440 × 810).** Analysis with bridges + tables + trend / outlook does not fit 810 px; Profitability fits with the heatmap as a drill. | Analysis rows 1–2 in the window, row 3 (trend, FY outlook) behind a "Time & outlook" drill tab; the page marks the 810 fold |
| 4 | **Bridge axis in Track B.** Native waterfall starts at zero (known limitation); the spec wants readable steps. | Keep the native waterfall for the totals and add a small "net change" panel (steps only) in Track B; A / C truncate the axis |
| 5 | **Variances table columns.** Re-adding Budget / Actual / vs PY columns costs evaluations (they were removed for query time). | Add Budget, Actual and vs PY Δ; drop nothing else; measure the cost before merging (N-01) |
| 6 | **Pass-through without a table.** The only pass-through pair in the data is Payments → `COR_S2`. | Do not hard-code; show the service-line pass-through ratio (buildable) and leave Underlying / Controllable Δ for a `PassThroughMap` table |
| 7 | **Profitability FX default.** Spec: constant currency by default when comparing to Budget / PY; the report default is actual rates everywhere. | Per-view default CC on Profitability only, stated in the subtitle; the Display flyout still rules |
| 8 | **Allocated columns.** Show the NR-share-allocated EBITDA / OP for Channel / Line / Segment at all? | Yes, collapsed and badged "allocated — indicative"; never in a headline column; a Corporate row waits for allocation keys |
| 9 | **Rule of 40 PY comparison.** The PY value cannot be built for the first data year (no FY2023). | Show Rule of 40 as a sub-line without a PY comparison (spec DQ-1 option 2) |
| 10 | **Entity slot swaps.** The spec is written for Commerce Cloud; L-10 requires the same layout for every company. | Keep today's slot-swap rule: same cards, entity-specific content in the driver row and in sub-lines (mapping in §1) |
