# Mirelo Sales & Revenue — layout spec (one page, five views)

> **DRAFT — projection state.** Pixel contract for the draft build in Track B (PBIR) and Track C (Next.js `/sales`). Tokens, type, chart styling and formats: `design-tokens.md`. Visual reference: `mockup.html` (Overview populated, views 2–5 as wireframes). Metric definitions: `metric-flow.html` §a; concept §9 addendum. Governed by ADR-0011 (Proposed).
>
> Numbers quoted in this file are the illustrative draft-story values for **Sep 2026 · Month · All markets · EUR**, at the ×0.6 business scale of ADR-0011 (f). The generator (`data/mirelo_sales_dummy_data/`, built in parallel) is the source of truth once it lands; the builders replace the numbers, not the layout.

Date: 2026-10-26

---

## 0. Frame and grid

| Item | px |
|---|---|
| Frame | 1440 × 810, background `ground`, no scrolling |
| Margins | 32 left / right · 0 top (header is flush) · 16 bottom |
| Columns | 12 × 100, gutters 16 → `x(c) = 32 + 116·(c − 1)` for column c (1-based) · `w(n) = 116·n − 16` |
| Header | y 0–64 (h 64), background `ground`; yellow wedge polygon `760,0 1440,0 1440,64` |
| Tabs row | y 64–100 (h 36); 1 px `line` rule at y 100 |
| Content top | y 116 |
| Content bottom | y 794 |
| Row gap | 16 |

Column x positions: c1 32 · c2 148 · c3 264 · c4 380 · c5 496 · c6 612 · c7 728 · c8 844 · c9 960 · c10 1076 · c11 1192 · c12 1308.

**Delivery (USER 2026-10-27): two flavours of the same page — Track A = the custom JS app (Next.js route `/sales` in `js-report/`), Track B = the Power BI report (`pbi-report/Mirelo Sales/`).** Both follow this file pixel for pixel; the parity table in `design-tokens.md` §10 maps every element. (ADR-0011 labelled the JS flavour "Track C" after the P&L numbering; for Mirelo the USER's A / B naming above is the one to use.)

**Presentation rule (ADR-0012):** every card face is title · value · delta row(s) · status chip; all other text (sub-values, definitions, formulas, sources, footnotes, captions) sits behind the card's ⓘ button (bottom-left of every card and panel) or the view's "How to read" button (header-right). The values below are from `data/mirelo_sales_dummy_data/` for Sep 2026 - Month - All markets - EUR; the "ⓘ sub-values" listed per card are the lines that used to sit on the card face.

### 0.1 Header (identical in every view)

```
y0  ┌───────────────────────────────────────────────────────────────────────── yellow wedge ─────────┐
    │ [M] Mirelo - Sales & revenue          [All markets|PL|RO|PT]  [Month|QTD|YTD|R12M] [Sep 2026 ▾]  [Budget|PY] │
y64 ├───────────────────────────────────────────────────────────────────────────────────────────────────┤
    │  Overview   Loans issued   Clients   Portfolio quality   Revenue & targets      ⓘ How to read  ⧉ Copy link │
y100├───────────────────────────────────────────────────────────────────────────────────────────────────┤
```

No applied-filters / period line under the title (removed 2026-10-27, USER review). The "Showing …" sentence lives in the "How to read" glass pop-up and as the slide-over context line.

| Element | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Brand mark | 32 | 20 | 24 | 24 | `ink` square, white "M" 14/800 centred |
| Page title | 64 | 18 | 420 | 28 | `Mirelo - Sales & revenue` 22/800, vertically centred in the 64 px header |
| Market picker | 744 | 20 | 232 | 28 | segmented, 4 cells (All markets 88 · PL 48 · RO 48 · PT 48), 13/600; selected cell `ink` + white text, others `panel`, 1 px `line` border and dividers |
| Period picker | 988 | 20 | 196 | 28 | segmented, 4 cells × 49 (Month · QTD · YTD · R12M) |
| Month select | 1192 | 20 | 104 | 28 | `Sep 2026 ▾` dropdown of closed months (Jan 2024 – Sep 2026) |
| Comparator | 1304 | 20 | 104 | 28 | segmented, 2 cells (Budget 56 · PY 46 + borders) |
| Tabs | 32 | 64 | — | 36 | 5 tabs, 14/600, padding 0 16, widths: Overview 104 · Loans issued 128 · Clients 88 · Portfolio quality 156 · Revenue & targets 164 (x: 32, 136, 264, 352, 508); active = `accent` fill full height, inactive = `ground` with `grey-600` text |
| Tabs-row right | 1248 … 1408 | 72 | — | 20 | `ⓘ How to read` button (1248–1336) · Track C only: `⧉ Copy link` (1348–1408); Track B: How to read only |
| How to read pop-up | 1048 | 100 | 360 | ≤ 420 | glass pop-up (`design-tokens.md` §5a), sections Showing · Top band · Grid · Table; ✕, Escape, outside click close it |

The header sits on `ground`; the wedge is behind the pickers (pickers keep their own `panel` fill and `ink` selected cell so they read on yellow). Charts narrower than 500 px label every second month on the x-axis (13-month charts in the 448-wide panels).

### 0.2 Card families

| Family | w × h | Used in |
|---|---|---|
| Hero card | 332 × 192 | Overview top band only (the largest card in the system) |
| KPI card | 216 × 120 | top band of views 2–5 (6 across) |
| Why panel, half | 680 × 160 (Overview) · 680 × 162 (views 2–5) | 2 × 2 grid |
| Why panel, third | 448 × 162 | 2 × 3 grid |
| Table card | 1376 × 118 (Overview) · 1376 × 186 (views 2–5) | bottom strip |

### 0.3 Row y positions

| View family | Band 1 | Why row 1 | Why row 2 | Table |
|---|---|---|---|---|
| Overview | y 116–308 (hero 192) | y 324–476 (152) | y 492–644 (152) | y 660–794 (134) |
| Views 2–5 | y 116–236 (KPI 120) | y 252–414 (162) | y 430–592 (162) | y 608–794 (186) |

---

## 1. View 1 — Overview ("are the four numbers on plan, and why not?")

Primary action: read the four Tier-1 values with their Δ vs Budget / PY without a click; the 2 × 2 grid answers "why" for each; the market table is the first drill.

```
y116 ┌ Loans issued   ▼ Watch ┐ ┌ New clients locked in ▼ Watch┐ ┌ Returning clients  ▲ Good ┐ ┌ Bad / overdue loans ▲ Off┐
     │ 25.6k  €10.2m          │ │ 10.8k                        │ │ 52.4%                     │ │ 4.6%                     │
     │ avg ticket €398 …      │ │ 42.2 % of loans …            │ │ of borrowers …            │ │ 30+ DPD by balance …     │
     │ vs Budget ▼ −2.4% ▭▭▭▭ │ │ vs Budget ▼ −4.2% ▭▭▭▭       │ │ vs Budget n/a             │ │ vs Budget ▲ +0.6pp ▭▭▭▭  │
y308 │ vs PY    ▲ +16.4% ▭▭▭▭ │ │ vs PY    ▲ +15.1% ▭▭▭▭       │ │ vs PY    ▲ +2.9pp ▭▭▭▭    │ │ vs PY    ▲ +0.7pp ▭▭▭▭   │
     └────────────────────────┘ └──────────────────────────────┘ └───────────────────────────┘ └──────────────────────────┘
y324 ┌ Loans issued by month vs Budget        ⓘ ↗┐ ┌ New clients by acquisition channel      ⓘ ↗┐
     │ line: Actual ● black, Budget ● teal, PY ╌  │ │ bars black, PY ghost outline, labels        │
y484 └────────────────────────────────────────────┘ └─────────────────────────────────────────────┘
y500 ┌ Returning clients - cohort repeat curve  ⓘ ↗┐ ┌ 30+ DPD by market, 13 months           ⓘ ↗┐
     │ lines per quarter cohort (black / teal / grey)│ │ 3 lines PL black · RO teal · PT grey; callout│
y660 └────────────────────────────────────────────┘ └─────────────────────────────────────────────┘
y676 ┌ Markets - Sep 2026   MARKET LOANS vs BUDGET PRINCIPAL NEW CLIENTS RETURNING 30+ DPD STATUS ─┐
     │ Poland · Romania · Portugal (3 rows, 24 px)                                                 │
y794 └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Cards

| # | Card | x | y | w | h | Metric (name as in metric-flow) · value Sep 2026 | ⓘ sub-values (off the face) | Comparators on the face | Drill | Tables |
|---|---|---|---|---|---|---|---|---|---|---|
| O1 | **Loans issued** (hero) | 32 | 116 | 332 | 192 | Count of loans with `disbursed_date` in window: **24,410**; second value disbursed principal **€9.6m** (Σ `principal_eur` = `principal_local` ÷ ACTUAL_AVG rate of the loan's month × currency) | Budget 24,309 loans · principal vs Budget €9.82m (−2.3 %) · avg ticket €393 (Budget €404) · PY 21,185 / €8.04m · FY2026 YTD 209,898 / €82.1m | vs Budget `▲ +0.4%` (good) · vs PY `▲ +15.2%` (good); chip `▲ Good` | click card → view Loans issued, filters carried | `fact_loan`, `fact_target` (LOANS, PRINCIPAL_LOCAL), `param_fx`, `dim_date` |
| O2 | **New clients locked in** (hero) | 380 | 116 | 332 | 192 | Clients whose first loan was disbursed in window (Σ `fact_loan.is_first_loan`): **9,796** | 40.1 % of loans · by channel App 3,620 (37 %) · Partner 2,846 (29 %) · Paid 2,509 (26 %) · Agents 821 (8 %) · Budget 9,905 · PY 9,281 | vs Budget `▼ −1.1%` (watch) · vs PY `▲ +5.5%` (good); chip `▼ Watch` | click → Clients | `fact_loan` (`is_first_loan`), `dim_client`, `fact_target` (NEW_CLIENTS), `dim_channel` |
| O3 | **Returning clients** (hero) | 728 | 116 | 332 | 192 | Distinct borrowers in window with `is_repeat` ÷ distinct borrowers: **59.9%** | 14,614 of 24,410 borrowers · loan-weighted 59.9 % · 180-day repeat of the Mar 2026 cohort 43.5 % (90-day 27.6 %) · PY 56.2 % · no Budget | vs Budget `n/a` (neutral, no bar) · vs PY `▲ +3.7pp` (good); chip `▲ Good` | click → Clients | `fact_loan` (`client_id`, `is_repeat`, `prior_loans`), `dim_client` |
| O4 | **Bad / overdue loans** (hero) | 1076 | 116 | 332 | 192 | 30+ DPD balance ÷ outstanding at the last closed month of the window: **4.6%** (4.63 %) | €1.50m of €32.47m · 90+ DPD 2.6 % · 30+ by count 4.6 % · vintage 6-month bad rate (Mar 2026) 2.9 % · Budget appetite 4.2 % (PL 4.0 / RO 4.5 / PT 4.2, outstanding-weighted) · PY 5.6 % | vs Budget `▲ +0.4pp` (watch) · vs PY `▼ −0.9pp` (good); direction ↓ so ▲ is unfavourable; chip `▲ Watch` | click → Portfolio quality | `fact_loan_month` (`bal_dpd_*_local`, `outstanding_local`), `fact_target` (DPD30_RATIO), `param_thresholds`, `param_fx` |
| O5 | **Loans issued by month vs Budget** | 32 | 324 | 680 | 152 | 13 months Sep 2025 – Sep 2026: Actual loans (ink line + dots; 21.2k → 24.4k, Dec 2025 peak 26.4k), Budget (teal), PY (grey dashed); selected month `accent` | peak / trough months, Budget met in 7 of 13 months | legend bottom-left (x 40) | mark click → month filter on this view; ↗ → Loans issued | `fact_loan` × `dim_date`, `fact_target` |
| O6 | **New clients by acquisition channel** | 728 | 324 | 680 | 152 | 4 horizontal bars (App · Partner · Paid · Agents = `dim_channel.sort_order`), Actual ink, PY ghost outline, value + share labels | PY values per channel | — | bar click → channel filter; ↗ → Clients | `fact_loan` (first loans) × `dim_channel` |
| O7 | **Returning clients - cohort repeat curve** | 32 | 492 | 680 | 152 | x = days since first loan (0–180), y = % with a 2nd loan; lines: cohort Mar 2026 (ink, 43.5 % at 180 d), Mar 2025 (teal, 44.3 %), Jun 2026 partial (grey dashed, to 120 d) | cohort sizes, 90-day values | legend | line click → cohort filter; ↗ → Clients | `fact_loan` (client, disbursed_date, `is_first_loan`, `prior_loans`), `dim_client` (`cohort_month`) |
| O8 | **30+ DPD by market, 13 months** | 728 | 492 | 680 | 152 | 3 lines PL (ink), RO (teal, 7.3 % → 4.1 %), PT (grey dashed); callout box `accent` at the Mar 2026 point: `RO policy tightened Mar 2026` (event label, ≤ 6 words) | Sep 2026 and Sep 2025 values per market | legend | mark click → market (= market picker); ↗ → Portfolio quality | `fact_loan_month` × `dim_market` |
| O9 | **Markets - Sep 2026** (table) | 32 | 660 | 1376 | 134 | columns (w px): Market 160 · Loans 120 · vs Budget 120 · Principal € 140 · New clients 140 · Returning % 120 · 30+ DPD % 120 · Status chip 96 · (spacer); rows 20 px | rows: Poland `11,713 · +1.5% · €3.3m · 4,712 · 59.8% · 4.8% · Good` · Romania `5,412 · −13.1% · €2.5m · 2,178 · 59.8% · 4.1% · Off` · Portugal `7,285 · +11.3% · €3.8m · 2,906 · 60.1% · 4.9% · Good`; ⓘ: status rule, principal vs Budget per market | Δ column follows the header comparator | row click → slide-over, loan grain ("Show loans" button does the same for the selected row) | all of the above by `dim_market` |

Hero card internal layout (332 × 192, origin = card): no marker · label (16, 16) 12/500 · status chip top-right (right 16, top 16, 16 px high) · value baseline y 80, 44/800 at x 16; second value 18/700 at value-right + 12 · comparator rows at y 108 and y 132: name x 16 (w 84, no wrap), Δ text x 100 (w 64, right-aligned), bar x 172 (**160 × 6**, centre tick at x 252; 4 px per 1 % / 16 px per pp) · ⓘ at (16, 168), 16 × 16. No sparkline, no secondary-values line (ADR-0012): the one-line definition and every sub-value are in the card's ⓘ.

---

## 2. View 2 — Loans issued ("did we issue what we planned - volume, ticket, funnel, FX?")

```
y116 ┌  Loans ─┐┌  Principal┐┌  Avg ticket┐┌  Approval rate┐┌  Take-up rate┐┌  Time to cash┐
     │ 25.6k   ││ €10.2m    ││ €398       ││ 41.3%         ││ 86.8%        ││ 3.4 h        │
y236 └─────────┘└───────────┘└────────────┘└───────────────┘└──────────────┘└──────────────┘
y252 ┌  Loans by month vs Budget ┐┌  Application funnel      ┐┌  Originations bridge      ┐
y414 └───────────────────────────┘└──────────────────────────┘└───────────────────────────┘
y430 ┌  Loans by product × market┐┌  Attainment by channel   ┐┌  Stage cycle time vs SLA  ┐
y592 └───────────────────────────┘└──────────────────────────┘└───────────────────────────┘
y608 ┌  Agent & partner leaderboard - Sep 2026 (table, 6 rows + header) ─────────────────────┐
y794 └──────────────────────────────────────────────────────────────────────────────────────┘
```

| # | Card | x | y | w | h | Metric | Comparator row | Drill | Tables |
|---|---|---|---|---|---|---|---|---|---|
| L1 | Loans | 32 | 116 | 216 | 120 | 24,410 loans | vs Budget `▲ +0.4%` (good); ⓘ: Budget 24,309 · PY 21,185 (+15.2 %) | — | `fact_loan`, `fact_target` (LOANS) |
| L2 | Principal | 264 | 116 | 216 | 120 | €9.6m | vs Budget `▼ −2.3%` (watch); ⓘ: Budget €9.82m at the BUDGET rate · PY €8.04m (+19.3 %) | — | `fact_loan`, `fact_target` (PRINCIPAL_LOCAL), `param_fx` |
| L3 | Average ticket | 496 | 116 | 216 | 120 | €393 | vs Budget `▼ −2.7%` (neutral ◦); ⓘ: Budget €404 · PY €379 · Step 12 share 9.0 % | — | `fact_loan` |
| L4 | Approval rate | 728 | 116 | 216 | 120 | 53.8% (approved ÷ submitted, by submission day) | vs PY `▲ +1.3pp` (good); ⓘ: new clients 36.9 % · KYC pass 92.9 % · no Budget target | — | `fact_application` |
| L5 | Take-up rate | 960 | 116 | 216 | 120 | 89.0% (disbursed ÷ approved) | vs PY `▲ +0.6pp` (good); ⓘ: 27,429 approved, 24,407 disbursed by submission day | — | `fact_application` |
| L6 | Time to cash | 1192 | 116 | 216 | 120 | 3.5 h (median `hours_to_cash`) | vs PY `▼ −1.4 h` (good; ↓ metric); ⓘ: approval leg 2.3 h (PY 3.2 h) | — | `fact_loan` (`hours_to_cash`, `hours_to_approve`) |
| L7 | Loans by month vs Budget | 32 | 252 | 448 | 162 | columns Actual ink (13 months), Budget teal line + dots, PY ghost outline | — | column click → month filter | `fact_loan`, `fact_target` |
| L8 | Application funnel | 496 | 252 | 448 | 162 | bar-style: Started → Submitted → KYC passed → Approved → Disbursed; value + % of previous + Δpp vs PY; declined / abandoned as grey side bars | — | bar click → stage filter on the table ("applications at stage") | `fact_application` (stage columns), `fact_loan` |
| L9 | Originations bridge Budget → Actual | 960 | 252 | 448 | 162 | waterfall: Budget €10.5m → volume −0.36 → ticket +0.19 → mix +0.08 → FX −0.24 → Actual €10.2m | — | ⓘ info pop-up | `fact_loan`, `fact_target`, `param_fx` (actual vs budget rates) |
| L10 | Loans by product × market | 32 | 430 | 448 | 162 | stacked horizontal bars per market (PL / RO / PT), segments Flex 30 · Flex 90 · Step 6 · Step 12 · Biz Boost (ink / teal / grey-400 / grey-300 / outline), direct labels | — | segment click → product + market filter | `fact_loan` × `dim_product` × `dim_market` |
| L11 | Attainment by channel | 496 | 430 | 448 | 162 | 5 bullets (App · Web · Partner · Agents · Marketplace): loans vs channel target, % label | — | bullet click → channel filter | `fact_loan`, `fact_target` × `dim_channel` |
| L12 | Stage cycle time vs SLA | 960 | 430 | 448 | 162 | horizontal bars median hours per stage (ink) with SLA tick (teal), worst first | — | — | `fact_application` (stage timestamps), `param_thresholds` (SLA hours) |
| L13 | Agent & partner leaderboard | 32 | 608 | 1376 | 186 | columns: Name 200 · Type 90 · Market 90 · Team 120 · Loans 100 · Quota 100 · Attainment % 120 · Principal € 120 · Status 110; 5 rows visible (22 px), sorted by attainment desc, ramp cohort tagged in ⓘ; Sep 2026 top: Andrei Stan RO 63 / 34 (185 %) · Anna Wojcik PL 73 / 40 (183 %) · Elena Popescu RO 162 % · Cristian Ionescu RO 150 % · Pawel Kaminska PL 140 %; ⓘ: 40 agents with a quota, 55 % at target | status: good ≥ 100 %, watch 90–99 %, off < 90 % | row click → slide-over: that agent's loans (loan grain) | `fact_loan` × `dim_agent`, `fact_target` (AGENT_LOANS) |

---

## 3. View 3 — Clients ("are we still acquiring, and do clients come back?")

```
y116 ┌  New clients┐┌  Returning %┐┌  Repeat share┐┌  New-client approval┐┌  180-day repeat┐┌  Days between loans┐
y236 └─────────────┘└─────────────┘└──────────────┘└─────────────────────┘└────────────────┘└────────────────────┘
y252 ┌  New clients by channel, 13 months (stacked)      ┐┌  New-client funnel                          ┐
y414 └───────────────────────────────────────────────────┘└─────────────────────────────────────────────┘
y430 ┌  Cohort repeat curves (quarter cohorts)            ┐┌  Returning % by market × segment · by product┐
y592 └───────────────────────────────────────────────────┘└─────────────────────────────────────────────┘
y608 ┌  Clients - Sep 2026 cohort (table) ──────────────────────────────────────────────────────────┐
y794 └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

| # | Card | x | y | w | h | Metric | Comparator row | Drill | Tables |
|---|---|---|---|---|---|---|---|---|---|
| C1 | New clients | 32 | 116 | 216 | 120 | 9,796 | vs Budget `▼ −1.1%` (watch); ⓘ: Budget 9,905 · PY 9,281 (+5.5 %) · 40.1 % of loans | — | `fact_loan` (`is_first_loan`), `fact_target` (NEW_CLIENTS) |
| C2 | Returning clients % | 264 | 116 | 216 | 120 | 59.9% of borrowers | vs PY `▲ +3.7pp` (good); ⓘ: FY2026 YTD 62.1 % | — | `fact_loan`, `dim_client` |
| C3 | Repeat share (loans) | 496 | 116 | 216 | 120 | 59.9% of loans | vs PY `▲ +3.7pp` (good); ⓘ: FY2026 YTD 60.2 % | — | `fact_loan` |
| C4 | New-client approval rate | 728 | 116 | 216 | 120 | 36.9% | vs PY `▼ −0.4pp` (watch); ⓘ: KYC pass for new applicants 88.9 % | — | `fact_application` (`is_repeat` = FALSE) |
| C5 | 180-day repeat | 960 | 116 | 216 | 120 | 43.5% (cohort Mar 2026, 10,397 clients) | vs PY cohort `▼ −0.9pp` (watch); ⓘ: 90-day 27.6 % · Mar 2025 cohort 44.3 % | — | `fact_loan`, `dim_client` (`cohort_month`) |
| C6 | Days between loans | 1192 | 116 | 216 | 120 | 115 d median | vs PY `▲ +5 d` (neutral ◦); ⓘ: PY 110 d | — | `fact_loan` |
| C7 | New clients by channel, 13 months | 32 | 252 | 680 | 162 | stacked columns (App ink · Partner teal · Web grey-400 · Agents grey-300 · Marketplace outline), Budget total as teal tick | — | segment click → channel + month | `fact_loan` × `dim_channel` × `dim_date`, `fact_target` |
| C8 | New-client funnel | 728 | 252 | 680 | 162 | Leads → First application → First approval → First loan, value + % of previous, new-client approval 31.0 % highlighted | — | bar click → stage | `fact_application` (new segment), `fact_loan` |
| C9 | Cohort repeat curves | 32 | 430 | 680 | 162 | % with a 2nd loan vs days since first loan (0–180), one line per quarter cohort (last 4: ink · teal · grey-400 · grey-300) | — | line click → cohort filter | `fact_loan`, `dim_client` |
| C10 | Returning % by market × segment · by product | 728 | 430 | 680 | 162 | left 60 %: heat matrix markets × (consumer / micro-business); right 40 %: bars repeat share by product with company-average tick (teal) | — | cell click → market + segment filter | `fact_loan` × `dim_market` × `dim_product`, `dim_client` (`customer_type`) |
| C11 | Clients - Sep 2026 cohort (table) | 32 | 608 | 1376 | 186 | columns: Client id 120 · Market 90 · Type 130 · First loan 120 · First product 120 · Channel 110 · Age band 110 · City tier 90 · Loans to date 110 · Status chip 110; 5 rows visible (22 px); ⓘ: 9,796 clients in the cohort | — | row click → slide-over: client card + that client's loans (client → loan grain) | `dim_client`, `fact_loan` |

---

## 4. View 4 — Portfolio quality ("is the growth we sell healthy?")

```
y116 ┌  30+ DPD %┐┌  90+ DPD %┐┌  30+ by count┐┌  Vintage 6m bad rate┐┌  Roll 30→60┐┌  Cost of risk┐
y236 └───────────┘└───────────┘└──────────────┘└─────────────────────┘└────────────┘└──────────────┘
y252 ┌  DPD buckets, 13 months  ┐┌  Vintage curves          ┐┌  Bad rate by product × market┐
y414 └──────────────────────────┘└──────────────────────────┘└──────────────────────────────┘
y430 ┌  30+ DPD by market       ┐┌  Roll rates by month     ┐┌  Segments: size × DPD (bubble)┐
y592 └──────────────────────────┘└──────────────────────────┘└──────────────────────────────┘
y608 ┌  Overdue loans - Sep 2026 (table, DPD desc) ────────────────────────────────────────────┐
y794 └─────────────────────────────────────────────────────────────────────────────────────────┘
```

| # | Card | x | y | w | h | Metric | Comparator row | Drill | Tables |
|---|---|---|---|---|---|---|---|---|---|
| P1 | 30+ DPD % | 32 | 116 | 216 | 120 | 4.6% by balance, Sep 2026 | vs Budget `▲ +0.4pp` (watch); ⓘ: PY 5.6 % (−0.9 pp) | — | `fact_loan_month`, `fact_target` (DPD30_RATIO) |
| P2 | 90+ DPD % | 264 | 116 | 216 | 120 | 2.6% | vs PY `▼ −0.2pp` (good); ⓘ: €0.85m of €32.47m | — | `fact_loan_month` |
| P3 | 30+ by count | 496 | 116 | 216 | 120 | 4.6% of active loans | vs PY `▼ −1.0pp` (good) | — | `fact_loan_month` (`loans_dpd_30p`, `loans_active`) |
| P4 | Vintage 6-month bad rate | 728 | 116 | 216 | 120 | 2.9% (`loans_first_90p` within 6 months on book ÷ `loans_disbursed`, vintage Mar 2026) | vs PY vintage `▼ −0.5pp` (good); ⓘ: Mar 2025 3.4 % · Feb 2026 3.3 % | — | `fact_loan_month` (`vintage_month`) |
| P5 | Roll rate 30 → 60 | 960 | 116 | 216 | 120 | 77.6% (60–89 balance this month ÷ 30–59 balance last month) | vs PY `▼ −2.4pp` (good); ⓘ: approximation, balances amortise | — | `fact_loan_month` |
| P6 | Cost of risk | 1192 | 116 | 216 | 120 | 10.4% annualised (Sep provision × 12 ÷ average outstanding) | vs PY `▼ −3.9pp` (good); ⓘ: FY2026 YTD 11.2 % · write-offs €0.29m · no Budget target | — | `fact_loan_month` (`provision_local`, `written_off_local`), `param_fx` |
| P7 | DPD buckets, 13 months | 32 | 252 | 448 | 162 | stacked columns balance in 1–29 (grey-300) · 30–59 (grey-400) · 60–89 (teal) · 90+ (ink) | — | segment click → bucket filter | `fact_loan_month` |
| P8 | Vintage curves | 496 | 252 | 448 | 162 | cumulative 30+ rate vs months on book (0–12), one line per vintage quarter (last 4) | — | line click → vintage filter | `fact_loan_month`, `fact_loan` |
| P9 | Bad rate by product × market | 960 | 252 | 448 | 162 | heat matrix 5 products × 3 markets, 4-step grey scale, value in cell | — | cell click → product + market | `fact_loan_month` × `dim_product` × `dim_market` |
| P10 | 30+ DPD by market | 32 | 430 | 448 | 162 | 3 lines (PL ink · RO teal · PT grey dashed), callout `RO policy change Mar 2026` | — | mark click → market | `fact_loan_month` × `dim_market` |
| P11 | Roll rates by month | 496 | 430 | 448 | 162 | 2 lines: 30→60 (ink), 60→90 (teal), 13 months | — | — | `fact_loan_month` |
| P12 | Segments: size × DPD (bubble) | 960 | 430 | 448 | 162 | x = avg ticket €, y = 30+ DPD %, size = outstanding €; one bubble per product × market (15), fills grey-300 / grey-400 / ink by market, worst bubble `accent`; labels on top 3 | — | bubble click → product + market | `fact_loan_month`, `fact_loan` |
| P13 | Overdue loans - Sep 2026 (table) | 32 | 608 | 1376 | 186 | columns: Loan id 110 · Client id 110 · Market 80 · Product 100 · Channel 100 · Disbursed 120 · Principal € 110 · Outstanding € 120 · DPD 70 · Max DPD 90 · Status chip 110 (bucket word: `90+ DPD`); sorted `dpd_days_close` desc; 5 rows visible (22 px); ⓘ: outstanding translated at the Sep 2026 rate | — | row click → slide-over: loan → client card | `fact_loan` (`status_code`, `dpd_days_close`, `outstanding_local_close`), `dim_loan_status`, `dim_client` |

---

## 5. View 5 — Revenue & targets ("what did the loans earn, and are we on the number?")

```
y116 ┌  Revenue ┐┌  Attainment┐┌  Interest income┐┌  Fees ┐┌  MRR  ┐┌  Paying subscribers┐
y236 └──────────┘└────────────┘└─────────────────┘└───────┘└───────┘└────────────────────┘
y252 ┌  Revenue by month vs Budget vs PY ┐┌  Revenue by stream, 13 months ┐┌  Attainment by market ┐
y414 └───────────────────────────────────┘└───────────────────────────────┘└───────────────────────┘
y430 ┌  MRR and subscribers by tier       ┐┌  Subscriber churn %           ┐┌  Channel mix, share   ┐
y592 └───────────────────────────────────┘└───────────────────────────────┘└───────────────────────┘
y608 ┌  Stream × market - Sep 2026 (matrix table) ───────────────────────────────────────────────┐
y794 └───────────────────────────────────────────────────────────────────────────────────────────┘
```

| # | Card | x | y | w | h | Metric | Comparator row | Drill | Tables |
|---|---|---|---|---|---|---|---|---|---|
| R1 | Revenue | 32 | 116 | 216 | 120 | €1.34m (Sep 2026: interest + fees + interchange + subscriptions) | vs Budget `▼ −3.2%` (watch); ⓘ: Budget €1.39m · PY €1.05m (+28.3 %) · FY2026 YTD €11.98m | — | `fact_revenue_month`, `fact_target` (REVENUE_LOCAL), `param_fx` |
| R2 | Attainment | 264 | 116 | 216 | 120 | 96.8% (revenue ÷ Budget revenue at the BUDGET rate) | vs 100 % `▼ −3.2pp` (watch band 95–99.9); ⓘ: no pace, Sep is closed | — | `fact_revenue_month`, `fact_target` |
| R3 | Interest + fees | 496 | 116 | 216 | 120 | €1.07m (the Budget carries interest and fees together per loan product) | vs Budget `▼ −3.8%` (watch); ⓘ: interest €787k · fees €286k · Budget €1.11m · PY €848k | — | `fact_revenue_month` (INTEREST, FEE), `fact_target` |
| R4 | Interchange | 728 | 116 | 216 | 120 | €122k | vs Budget `▲ +4.3%` (good); ⓘ: Budget €117k · PY €75k | — | `fact_revenue_month` (INTERCHANGE), `fact_target` (CARD) |
| R5 | MRR | 960 | 116 | 216 | 120 | €147k (month-end, Plus + Pro) | vs PY `▲ +18.7%` (good); ⓘ: subscription revenue €146k vs Budget €154k (−5.0 %) | — | `fact_subscription_month` (`mrr_eur`) |
| R6 | Paying subscribers | 1192 | 116 | 216 | 120 | 23,408 (Plus 15,376 · Pro 8,032 in ⓘ) | vs PY `▲ +12.1%` (good); ⓘ: churn of paying tiers 2.1 % | — | `fact_subscription_month` (`subscribers_end`) |
| R7 | Revenue by month vs Budget vs PY | 32 | 252 | 448 | 162 | lines: Actual ink + dots, Budget teal + dots, PY grey dashed; Oct–Dec 2026 blank | — | mark click → month | `fact_revenue_month`, `fact_target` |
| R8 | Revenue by stream, 13 months | 496 | 252 | 448 | 162 | stacked columns Interest ink · Fees teal · Interchange grey-400 · Subscriptions grey-300 | — | segment click → stream | `fact_revenue_month` |
| R9 | Attainment by market | 960 | 252 | 448 | 162 | 3 bullets PL / RO / PT, revenue vs target, % label, status chip | — | bullet click → market | `fact_revenue_month`, `fact_target` × `dim_market` |
| R10 | MRR and subscribers by tier | 32 | 430 | 448 | 162 | stacked columns subscribers Plus (ink) / Pro (teal), 13 months, MRR as labels on top (no dual axis) | — | — | `fact_subscription_month` |
| R11 | Subscriber churn % | 496 | 430 | 448 | 162 | line ink + dots, PY grey dashed; callout `Plus price rise Jan 2026` | — | — | `fact_subscription_month` |
| R12 | Channel mix, share of loans | 960 | 430 | 448 | 162 | 100 % stacked columns by month (App ink · Partner teal · Web grey-400 · Agents grey-300 · Marketplace outline) | — | segment click → channel | `fact_loan` × `dim_channel` |
| R13 | Stream × market - Sep 2026 (table) | 32 | 608 | 1376 | 186 | rows: 4 streams (All markets) + total, 5 rows visible (22 px); market rows reached by the market picker; columns: Stream 180 · Market 120 · Actual € 130 · Budget € 130 · Δ vs Budget % 130 · PY € 130 · Δ vs PY % 130 · Status 110; interest and fees show `n/a` under Budget (one Budget line per loan product); ⓘ: total €1.34m vs €1.39m / €1.05m | Δ pair follows the header comparator | row click → slide-over: loans of that market whose month earned the revenue (loan grain; subscriptions row → client grain, subscribers) | `fact_revenue_month`, `fact_target`, `dim_revenue_type`, `dim_market` |

---

## 6. Interactions (both tracks)

| Control | Behaviour | Default | Power BI | React |
|---|---|---|---|---|
| **Market picker** | single select All markets · PL · RO · PT; filters every card and the slide-over; table titles, the How-to-read "Showing" sentence and the slide-over context line repeat the market name | All markets | Tile slicer on `dim_market`; "All" = clear | `useSalesState().market`, URL `?m=` |
| **Period picker** | Month · QTD · YTD · R12M, anchored on the selected month (`Sep 2026 ▾`, closed months only); window facts sum days / months in the window; period-end metrics (DPD, MRR, subscribers) take the anchor month | Month · Sep 2026 | Two slicers → `param_period[time_view]`, `dim_date[month_key]`; window measures via `DATESINPERIOD` on `dim_date` | `?p=month&a=2026-09` |
| **Comparator** | Budget · PY; selects series 2 on every chart and the Δ column(s) of tables; hero cards always show both rows; KPI cards show the selected row and the other on hover | Budget | Slicer on `param_comparator`; measures `[Δ vs Comparator]` | `?c=budget` |
| **View tabs** | swap the content region (y 116–794); header persists; filters persist across views | Overview | 5 bookmarks toggling visual groups `g_overview … g_revenue` (data unchanged, "Display" only) | `?view=` |
| **Card click (hero / why ↗)** | opens the metric's home view with the current filters | — | Button action = bookmark | router state |
| **Mark click** | filters the same view's other cards (cross-filter) and the table; second click clears; a chip row above the table shows the active mark filters | none | Native cross-filter (edit interactions: cards → none) | `markFilter` state, chips |
| **Row click** | opens the **slide-over** (720 px from the right, x 720–1440, y 100–810, glass surface, scrim 40 % ink over x 0–720): title sentence of carried filters, chip row, table of loan rows (or client card + loans for Clients), sort, "Export CSV", Esc / ✕ closes | — | Drill-through page `loan_detail` / `client_detail` (same 720 px column layout on a 1440 × 810 page with the left half dimmed, glass fallback surface), Back button | `<SlideOver>`, `?drill=` |
| **Slide-over row click** | loan row → client card (all loans of the client); client row → that client's loans | — | second drill-through | nested panel state |
| **ⓘ** (bottom-left of every card and panel) | glass pop-up 360 wide anchored to the button (below it when it fits, else above): what it is · why it matters · formula in words · sub-values · source table; one layer open at a time; ✕ / Escape / outside click / second click on the opener close it; focus moves in, Tab is trapped, focus returns to the opener | — | tooltip page per card (glass fallback) | `<InfoPopover>` |
| **How to read** (one per view, header-right) | glass pop-up at (1048, 100), content keyed by the active view: Showing · Cards · Panels · Table · ⓘ (status rules and the drill explained per view) | — | bookmark pop-up group per view (glass fallback) | `<HowToRead view>` |
| **Copy link** (Track C only) | encodes view, market, period, comparator, mark filters, drill | — | — | F-37 analogue |

Filters carried into the slide-over: period window, market, product, channel, segment, agent (+ the clicked mark context: month, channel, cohort, bucket, vintage). Versions do not apply at loan level (Actual only). The slide-over title repeats the carried filters as a sentence (`1,296 loans - Romania - Step 12 - Marketplace - Sep 2026 - 60–89 DPD`).

---

## 7. Build checklist (first-open, both tracks)

1. Frame 1440 × 810, header wedge points exactly `760,0 1440,0 1440,64`; no text line under the title.
2. Every card at the x / y / w / h of §1–§5; plain `panel` blocks — no corner marker, no border, no in-card sparkline, no sub-line, no footnote or caption.
3. Hero values 44/800, KPI values 28/700, Segoe UI Bold / Inter 800; hero cards carry a status chip; card face = title · value · delta row(s) · chip; one ⓘ bottom-left on every card and panel; one "How to read" per view header-right; pop-ups glass, one at a time, Esc / outside / ✕, focus returned.
4. Series: Actual ink, comparator teal, PY grey dashed; selected mark yellow with ink outline.
5. Formats per `design-tokens.md` §8; U+2212 minus; `+` on positive deltas.
6. Status: glyph + colour + chip word; thresholds from `param_thresholds`.
7. Defaults: All markets · Month · Sep 2026 · Budget · Overview.
8. Row click opens the detail at loan / client grain with the title sentence of carried filters.
9. Control totals: hero values reconcile to `data/mirelo_sales_dummy_data/checks/` (when published by the generator) in both tracks.

---

## 8. Change log

| Date | Change | Source |
|---|---|---|
| 2026-10-26 | First version: frame, header with period line, five views with px positions, hero cards with sparkline, interactions, checklist | USER directives 2026-10-26 |
| 2026-10-27 | Header: applied-filters line removed, title centred at y 18, "How to read" pop-up position added (§0.1); hero cards: sparkline removed, comparator bars 160 px, status chip (§1, O1–O4); corner marker removed from every card (§1 wireframe, §7); ⓘ / How to read / slide-over as glass pop-ups (§6); checklist updated. Mockup v2 kept as `mockup-v2-2026-10-26.html`; `mockup.html` is v3 | USER review of the Mirelo drafts, 2026-10-27; house rule `design-requirements.md` §1 "Visual first, minimum text" |
| 2026-10-27 (v4) | ADR-0012 applied in full and values replaced by the dataset (Sep 2026 - Month - All markets): §0 delivery note (Track A = JS app, Track B = Power BI) and presentation rule; Overview why rows 152 px and market table 134 px (§0.3, O5–O9); hero rows at y 108 / 132 and ⓘ at y 168, secondary-values line removed (card rows now list "ⓘ sub-values"); KPI cards Δ text only, sub-lines moved into ⓘ (L1–L6, C1–C6, P1–P6, R1–R6 with dataset values; R3 = Interest + fees, R4 = Interchange); tables 5 rows × 22 px with ⓘ under the last row, footnotes into the table's ⓘ (L13, C11, P13, R13); ⓘ and How to read rows rewritten (§6); checklist (§7). Mockup v3 kept as `mockup-v3-2026-10-27.html`; `mockup.html` is v4 | USER "update with all the rules", ADR-0012, 2026-10-27 |
| 2026-10-27 (MS-11, MS-15) | Counts on card faces and in tables are always exact with a thousands separator (O1 24,410 · O2 / C1 9,796 · L1 · R6 23,408 · O9 market rows); comparator row label is `vs PY` on every card (hero and KPI); mockup v4.1 shows the same strings | Contract maintenance MS-11 / MS-15, 2026-10-27 |
