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

### 0.1 Header (identical in every view)

```
y0  ┌───────────────────────────────────────────────────────────────────────── yellow wedge ─────────┐
    │ ■M  Mirelo - Sales & revenue          [All markets|PL|RO|PT]  [Month|QTD|YTD|R12M] [Sep 2026 ▾]  [Budget|PY] │
    │     Showing Sep 2026 - Month - Actual vs Budget and Prior year - Closed through Sep 2026           │
y64 ├───────────────────────────────────────────────────────────────────────────────────────────────────┤
    │  Overview   Loans issued   Clients   Portfolio quality   Revenue & targets               ⓘ  ⧉ Copy link │
y100├───────────────────────────────────────────────────────────────────────────────────────────────────┤
```

| Element | x | y | w | h | Notes |
|---|---|---|---|---|---|
| Brand mark | 32 | 20 | 24 | 24 | `ink` square, white "M" 14/800 centred |
| Page title | 64 | 14 | 420 | 28 | `Mirelo - Sales & revenue` 22/800 |
| Period line | 64 | 42 | 600 | 16 | 12/400 `grey-600`, "Showing …" sentence (parity rule 7) + ` - Closed through Sep 2026` |
| Market picker | 744 | 20 | 232 | 28 | segmented, 4 cells (All markets 88 · PL 48 · RO 48 · PT 48), 13/600; selected cell `ink` + white text, others `panel`, 1 px `line` border and dividers |
| Period picker | 988 | 20 | 196 | 28 | segmented, 4 cells × 49 (Month · QTD · YTD · R12M) |
| Month select | 1192 | 20 | 104 | 28 | `Sep 2026 ▾` dropdown of closed months (Jan 2024 – Sep 2026) |
| Comparator | 1304 | 20 | 104 | 28 | segmented, 2 cells (Budget 56 · PY 46 + borders) |
| Tabs | 32 | 64 | — | 36 | 5 tabs, 14/600, padding 0 16, widths: Overview 104 · Loans issued 128 · Clients 88 · Portfolio quality 156 · Revenue & targets 164 (x: 32, 136, 264, 352, 508); active = `accent` fill full height, inactive = `ground` with `grey-600` text |
| Tabs-row right | 1296 … 1408 | 72 | — | 20 | ⓘ "How to read" (1296) · Track C only: `⧉ Copy link` (1328–1408); Track B: ⓘ only |

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
| Overview | y 116–308 (hero 192) | y 324–484 (160) | y 500–660 (160) | y 676–794 (118) |
| Views 2–5 | y 116–236 (KPI 120) | y 252–414 (162) | y 430–592 (162) | y 608–794 (186) |

---

## 1. View 1 — Overview ("are the four numbers on plan, and why not?")

Primary action: read the four Tier-1 values with their Δ vs Budget / PY without a click; the 2 × 2 grid answers "why" for each; the market table is the first drill.

```
y116 ┌■ Loans issued ──────┐ ┌■ New clients locked in┐ ┌■ Returning clients ───┐ ┌■ Bad / overdue loans ─┐
     │ 25.6k  €10.2m   ╱╲╱ │ │ 10.8k            ╱╲╱  │ │ 52.4%            ╱╱╱  │ │ 4.6%            ╲╱╲  │
     │ avg ticket €398 …   │ │ 42.2 % of loans …     │ │ of borrowers …        │ │ 30+ DPD by balance …  │
     │ vs Budget ▼ −2.4%   │ │ vs Budget ▼ −4.2%     │ │ vs Budget n/a         │ │ vs Budget ▲ +0.6pp    │
y308 │ vs PY     ▲ +16.4%  │ │ vs PY     ▲ +15.1%    │ │ vs PY     ▲ +2.9pp    │ │ vs PY     ▲ +0.7pp    │
     └─────────────────────┘ └───────────────────────┘ └───────────────────────┘ └───────────────────────┘
y324 ┌■ Loans issued by month vs Budget       ⓘ ↗┐ ┌■ New clients by acquisition channel     ⓘ ↗┐
     │ line: Actual ● black, Budget ● teal, PY ╌  │ │ bars black, PY ghost outline, labels        │
y484 └────────────────────────────────────────────┘ └─────────────────────────────────────────────┘
y500 ┌■ Returning clients - cohort repeat curve ⓘ ↗┐ ┌■ 30+ DPD by market, 13 months          ⓘ ↗┐
     │ lines per quarter cohort (black / teal / grey)│ │ 3 lines PL black · RO teal · PT grey; callout│
y660 └────────────────────────────────────────────┘ └─────────────────────────────────────────────┘
y676 ┌■ Markets - Sep 2026  MARKET LOANS vs BUDGET PRINCIPAL NEW CLIENTS RETURNING 30+ DPD STATUS ─┐
     │ Poland · Romania · Portugal (3 rows, 24 px)                                                 │
y794 └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 1.1 Cards

| # | Card | x | y | w | h | Metric (name as in metric-flow) | Sub-line | Comparators | Drill | Tables |
|---|---|---|---|---|---|---|---|---|---|---|
| O1 | **Loans issued** (hero) | 32 | 116 | 332 | 192 | Count of loans with `disbursed_date` in window: **25.6k**; second value disbursed principal EUR **€10.2m** (Σ `principal_local` ÷ `param_fx` rate of the loan's month × currency) | `avg ticket €398 - 97.6 % of target loans` | vs Budget `▼ −2.4%` (watch) · vs PY `▲ +16.4%` (good); sparkline 13 months Actual + PY | click card → view Loans issued, filters carried | `fact_loan`, `fact_target` (metric LOANS, PRINCIPAL), `param_fx`, `dim_date` |
| O2 | **New clients locked in** (hero) | 380 | 116 | 332 | 192 | Clients whose first loan was disbursed in window (Σ `fact_loan.is_first_loan`): **10.8k** | `42.2 % of loans - App 41 % - Partner 22 %` | vs Budget `▼ −4.2%` (watch) · vs PY `▲ +15.1%` (good); sparkline | click → Clients | `fact_loan` (`is_first_loan`), `dim_client`, `fact_target` (NEW_CLIENTS), `dim_channel` |
| O3 | **Returning clients** (hero) | 728 | 116 | 332 | 192 | Distinct borrowers in window with ≥ 1 prior repaid / current loan ÷ distinct borrowers: **52.4%** | `of borrowers - 57.8 % of loans - 180-day repeat 46 %` | vs Budget `n/a` (neutral, no bar) · vs PY `▲ +2.9pp` (good); sparkline | click → Clients | `fact_loan` (`client_id`, `prior_loans`, status), `dim_client` |
| O4 | **Bad / overdue loans** (hero) | 1076 | 116 | 332 | 192 | 30+ DPD balance ÷ outstanding principal at the last closed month of the window: **4.6%** | `30+ DPD by balance - 90+ 2.1 % - vintage 6m 3.4 %` | vs Budget `▲ +0.6pp` (off) · vs PY `▲ +0.7pp` (off); direction ↓ so ▲ is unfavourable; sparkline | click → Portfolio quality | `fact_loan_month` (snapshot month, `dpd_bucket`, `outstanding_local`), `fact_target` (DPD30_RATIO), `param_thresholds` |
| O5 | **Loans issued by month vs Budget** | 32 | 324 | 680 | 160 | 13 months Sep 2025 – Sep 2026: Actual loans (ink line + dots), Budget (teal line + dots), PY (grey dashed); selected month marked `accent` | — | legend bottom-left | mark click → month filter on this view; ↗ → Loans issued | `fact_loan` × `dim_date`, `fact_target` |
| O6 | **New clients by acquisition channel** | 728 | 324 | 680 | 160 | 5 horizontal bars (App · Partner · Web · Agents · Marketplace, order = `dim_channel.sort_order`), Actual ink, PY ghost outline, value + share labels | — | — | bar click → channel filter; ↗ → Clients | `fact_loan` (first loans) × `dim_channel` |
| O7 | **Returning clients - cohort repeat curve** | 32 | 500 | 680 | 160 | x = days since first loan (0–180), y = % with a 2nd loan; lines: cohort Q3 2026 (ink), Q2 2026 (teal), Q3 2025 (grey dashed); 90 / 180 d ticks | — | legend | line click → cohort filter; ↗ → Clients | `fact_loan` (client, disbursed_date, `is_first_loan`), `dim_client` (`cohort_month`) |
| O8 | **30+ DPD by market, 13 months** | 728 | 500 | 680 | 160 | 3 lines PL (ink), RO (teal), PT (grey dashed); callout box `accent` at the Mar 2026 point: `RO credit policy tightened Mar 2026` | — | legend | mark click → market (= market picker); ↗ → Portfolio quality | `fact_loan_month` × `dim_market` |
| O9 | **Markets - Sep 2026** (table) | 32 | 676 | 1376 | 118 | columns (w px): Market 160 · Loans 120 · vs Budget 120 · Principal € 140 · New clients 140 · Returning % 120 · 30+ DPD % 120 · Status chip 96 · (spacer) | rows: Poland `13.1k · −2.3% · €5.3m · 5.2k · 56.1% · 4.6% · Watch` · Romania `6.0k · −12.0% · €2.4m · 2.4k · 50.2% · 4.9% · Off` · Portugal `6.5k · +11.0% · €2.5m · 3.2k · 44.8% · 4.2% · Good` | Δ column follows the header comparator | row click → market picker = that market (view stays); double-click / "Show loans" → slide-over, loan grain | all of the above by `dim_market` |

Hero card internal layout (332 × 192, origin = card): marker (0,0) 16 × 16 · label (16, 24) 12/500 · value baseline y 84, 44/800 at x 16; second value 18/700 at value-right + 12 · sub-line (16, 100) 12/400 · comparator rows at y 124 and y 148: name x 16 (w 84, no wrap), Δ text x 100 (w 64, right-aligned), bar x 172 (80 × 6, centre tick at x 212) · sparkline (196, 44) 120 × 44 above the bars, aligned right. Title row has no ⓘ; the label's tooltip carries the definition.

---

## 2. View 2 — Loans issued ("did we issue what we planned - volume, ticket, funnel, FX?")

```
y116 ┌■ Loans ─┐┌■ Principal┐┌■ Avg ticket┐┌■ Approval rate┐┌■ Take-up rate┐┌■ Time to cash┐
     │ 25.6k   ││ €10.2m    ││ €398       ││ 41.3%         ││ 86.8%        ││ 3.4 h        │
y236 └─────────┘└───────────┘└────────────┘└───────────────┘└──────────────┘└──────────────┘
y252 ┌■ Loans by month vs Budget ┐┌■ Application funnel      ┐┌■ Originations bridge      ┐
y414 └───────────────────────────┘└──────────────────────────┘└───────────────────────────┘
y430 ┌■ Loans by product × market┐┌■ Attainment by channel   ┐┌■ Stage cycle time vs SLA  ┐
y592 └───────────────────────────┘└──────────────────────────┘└───────────────────────────┘
y608 ┌■ Agent & partner leaderboard - Sep 2026 (table, 6 rows + header) ─────────────────────┐
y794 └──────────────────────────────────────────────────────────────────────────────────────┘
```

| # | Card | x | y | w | h | Metric | Comparator row | Drill | Tables |
|---|---|---|---|---|---|---|---|---|---|
| L1 | Loans | 32 | 116 | 216 | 120 | 25.6k loans | vs Budget −2.4% (watch) · sub `PY 22.0k` | — | `fact_loan` |
| L2 | Principal | 264 | 116 | 216 | 120 | €10.2m | vs Budget −3.1% (watch) · sub `coverage 1.3× of remaining target` | — | `fact_loan`, `param_fx`, `fact_application` (approved-not-disbursed) |
| L3 | Avg ticket | 496 | 116 | 216 | 120 | €398 | vs Budget +1.9% (neutral ◦) · sub `Step 12 share 14 %` | — | `fact_loan` |
| L4 | Approval rate | 728 | 116 | 216 | 120 | 41.3% (approved ÷ submitted, by submission date) | vs Budget −2.7pp (off) · sub `new clients 31.0 %` | — | `fact_application` |
| L5 | Take-up rate | 960 | 116 | 216 | 120 | 86.8% (disbursed ÷ approved) | vs PY −0.4pp (watch) | — | `fact_application`, `fact_loan` |
| L6 | Time to cash | 1192 | 116 | 216 | 120 | 3.4 h (median submitted → disbursed) | vs PY −1.7 h (good; ↓ metric) | — | `fact_loan` (`applied_ts`, `disbursed_ts`) |
| L7 | Loans by month vs Budget | 32 | 252 | 448 | 162 | columns Actual ink (13 months), Budget teal line + dots, PY ghost outline | — | column click → month filter | `fact_loan`, `fact_target` |
| L8 | Application funnel | 496 | 252 | 448 | 162 | bar-style: Started → Submitted → KYC passed → Approved → Disbursed; value + % of previous + Δpp vs PY; declined / abandoned as grey side bars | — | bar click → stage filter on the table ("applications at stage") | `fact_application` (stage columns), `fact_loan` |
| L9 | Originations bridge Budget → Actual | 960 | 252 | 448 | 162 | waterfall: Budget €10.5m → volume −0.36 → ticket +0.19 → mix +0.08 → FX −0.24 → Actual €10.2m | — | ⓘ info pop-up | `fact_loan`, `fact_target`, `param_fx` (actual vs budget rates) |
| L10 | Loans by product × market | 32 | 430 | 448 | 162 | stacked horizontal bars per market (PL / RO / PT), segments Flex 30 · Flex 90 · Step 6 · Step 12 · Biz Boost (ink / teal / grey-400 / grey-300 / outline), direct labels | — | segment click → product + market filter | `fact_loan` × `dim_product` × `dim_market` |
| L11 | Attainment by channel | 496 | 430 | 448 | 162 | 5 bullets (App · Web · Partner · Agents · Marketplace): loans vs channel target, % label | — | bullet click → channel filter | `fact_loan`, `fact_target` × `dim_channel` |
| L12 | Stage cycle time vs SLA | 960 | 430 | 448 | 162 | horizontal bars median hours per stage (ink) with SLA tick (teal), worst first | — | — | `fact_application` (stage timestamps), `param_thresholds` (SLA hours) |
| L13 | Agent & partner leaderboard | 32 | 608 | 1376 | 186 | columns: Name 200 · Type 80 · Market 80 · Loans 100 · Target 100 · Attainment % (bar 160) · Principal € 120 · Approval % 100 · Pace 80 · Status 96; 6 rows visible, sorted by attainment desc, ramp cohort tagged | Δ column = header comparator | row click → slide-over: that agent's loans (loan grain) | `fact_loan` × `dim_agent`, `fact_target` (agent rows) |

---

## 3. View 3 — Clients ("are we still acquiring, and do clients come back?")

```
y116 ┌■ New clients┐┌■ Returning %┐┌■ Repeat share┐┌■ New-client approval┐┌■ 180-day repeat┐┌■ Days between loans┐
y236 └─────────────┘└─────────────┘└──────────────┘└─────────────────────┘└────────────────┘└────────────────────┘
y252 ┌■ New clients by channel, 13 months (stacked)      ┐┌■ New-client funnel                          ┐
y414 └───────────────────────────────────────────────────┘└─────────────────────────────────────────────┘
y430 ┌■ Cohort repeat curves (quarter cohorts)            ┐┌■ Returning % by market × segment · by product┐
y592 └───────────────────────────────────────────────────┘└─────────────────────────────────────────────┘
y608 ┌■ Clients - Sep 2026 cohort (table) ──────────────────────────────────────────────────────────┐
y794 └──────────────────────────────────────────────────────────────────────────────────────────────┘
```

| # | Card | x | y | w | h | Metric | Comparator row | Drill | Tables |
|---|---|---|---|---|---|---|---|---|---|
| C1 | New clients | 32 | 116 | 216 | 120 | 10.8k | vs Budget −4.2% (watch) | — | `fact_loan` (`is_first_loan`), `fact_target` |
| C2 | Returning clients % | 264 | 116 | 216 | 120 | 52.4% of borrowers | vs PY +2.9pp (good) | — | `fact_loan`, `dim_client` |
| C3 | Repeat share (loans) | 496 | 116 | 216 | 120 | 57.8% of loans | vs PY +3.2pp (good) | — | `fact_loan` |
| C4 | New-client approval rate | 728 | 116 | 216 | 120 | 31.0% | vs PY −1.1pp (watch) | — | `fact_application` (segment *_new) |
| C5 | 180-day repeat | 960 | 116 | 216 | 120 | 46.0% (cohort Mar 2026) | vs previous cohort +1.4pp (good) | — | `fact_loan`, `dim_client` (`cohort_month`) |
| C6 | Days between loans | 1192 | 116 | 216 | 120 | 71 d median | vs PY −4 d (neutral ◦) | — | `fact_loan` |
| C7 | New clients by channel, 13 months | 32 | 252 | 680 | 162 | stacked columns (App ink · Partner teal · Web grey-400 · Agents grey-300 · Marketplace outline), Budget total as teal tick | — | segment click → channel + month | `fact_loan` × `dim_channel` × `dim_date`, `fact_target` |
| C8 | New-client funnel | 728 | 252 | 680 | 162 | Leads → First application → First approval → First loan, value + % of previous, new-client approval 31.0 % highlighted | — | bar click → stage | `fact_application` (new segment), `fact_loan` |
| C9 | Cohort repeat curves | 32 | 430 | 680 | 162 | % with a 2nd loan vs days since first loan (0–180), one line per quarter cohort (last 4: ink · teal · grey-400 · grey-300) | — | line click → cohort filter | `fact_loan`, `dim_client` |
| C10 | Returning % by market × segment · by product | 728 | 430 | 680 | 162 | left 60 %: heat matrix markets × (consumer / micro-business); right 40 %: bars repeat share by product with company-average tick (teal) | — | cell click → market + segment filter | `fact_loan` × `dim_market` × `dim_product`, `dim_client` (`customer_type`) |
| C11 | Clients - table | 32 | 608 | 1376 | 186 | columns: Client id 140 · Market 80 · Type 110 · First loan 110 · First product 110 · Channel 110 · Loans to date 100 · Principal to date 120 · Last loan 110 · Days since 90 · Status chip 96; 6 rows visible | — | row click → slide-over: client card + that client's loans (client → loan grain) | `dim_client`, `fact_loan` |

---

## 4. View 4 — Portfolio quality ("is the growth we sell healthy?")

```
y116 ┌■ 30+ DPD %┐┌■ 90+ DPD %┐┌■ 30+ by count┐┌■ Vintage 6m bad rate┐┌■ Roll 30→60┐┌■ Cost of risk┐
y236 └───────────┘└───────────┘└──────────────┘└─────────────────────┘└────────────┘└──────────────┘
y252 ┌■ DPD buckets, 13 months  ┐┌■ Vintage curves          ┐┌■ Bad rate by product × market┐
y414 └──────────────────────────┘└──────────────────────────┘└──────────────────────────────┘
y430 ┌■ 30+ DPD by market       ┐┌■ Roll rates by month     ┐┌■ Segments: size × DPD (bubble)┐
y592 └──────────────────────────┘└──────────────────────────┘└──────────────────────────────┘
y608 ┌■ Overdue loans - Sep 2026 (table, DPD desc) ────────────────────────────────────────────┐
y794 └─────────────────────────────────────────────────────────────────────────────────────────┘
```

| # | Card | x | y | w | h | Metric | Comparator row | Drill | Tables |
|---|---|---|---|---|---|---|---|---|---|
| P1 | 30+ DPD % | 32 | 116 | 216 | 120 | 4.6% by balance, Sep 2026 | vs Budget +0.6pp (off) | — | `fact_loan_month`, `fact_target` (DPD30_RATIO) |
| P2 | 90+ DPD % | 264 | 116 | 216 | 120 | 2.1% | vs PY +0.3pp (watch) | — | `fact_loan_month` |
| P3 | 30+ by count | 496 | 116 | 216 | 120 | 5.3% of active loans | vs PY +0.5pp (watch) | — | `fact_loan_month` |
| P4 | Vintage 6m bad rate | 728 | 116 | 216 | 120 | 3.4% (loans ever 90+ within 6 months ÷ vintage loans, vintage Mar 2026) | vs PY vintage +0.4pp (watch) | — | `fact_loan_month`, `fact_loan` (`vintage_month`) |
| P5 | Roll rate 30→60 | 960 | 116 | 216 | 120 | 38.2% | vs PY +2.0pp (off) | — | `fact_loan_month` |
| P6 | Cost of risk | 1192 | 116 | 216 | 120 | 3.9% annualised | vs Budget +0.3pp (watch) | — | `fact_loan_month` (`provision_local`), `param_fx` |
| P7 | DPD buckets, 13 months | 32 | 252 | 448 | 162 | stacked columns balance in 1–29 (grey-300) · 30–59 (grey-400) · 60–89 (teal) · 90+ (ink) | — | segment click → bucket filter | `fact_loan_month` |
| P8 | Vintage curves | 496 | 252 | 448 | 162 | cumulative 30+ rate vs months on book (0–12), one line per vintage quarter (last 4) | — | line click → vintage filter | `fact_loan_month`, `fact_loan` |
| P9 | Bad rate by product × market | 960 | 252 | 448 | 162 | heat matrix 5 products × 3 markets, 4-step grey scale, value in cell | — | cell click → product + market | `fact_loan_month` × `dim_product` × `dim_market` |
| P10 | 30+ DPD by market | 32 | 430 | 448 | 162 | 3 lines (PL ink · RO teal · PT grey dashed), callout `RO policy change Mar 2026` | — | mark click → market | `fact_loan_month` × `dim_market` |
| P11 | Roll rates by month | 496 | 430 | 448 | 162 | 2 lines: 30→60 (ink), 60→90 (teal), 13 months | — | — | `fact_loan_month` |
| P12 | Segments: size × DPD (bubble) | 960 | 430 | 448 | 162 | x = avg ticket €, y = 30+ DPD %, size = outstanding €; one bubble per product × market (15), fills grey-300 / grey-400 / ink by market, worst bubble `accent`; labels on top 3 | — | bubble click → product + market | `fact_loan_month`, `fact_loan` |
| P13 | Overdue loans - table | 32 | 608 | 1376 | 186 | columns: Loan id 120 · Client id 120 · Market 70 · Product 90 · Channel 90 · Disbursed 100 · Principal 100 · Outstanding 110 · DPD 70 · Bucket 80 · Max DPD 80 · Status chip 96; sorted DPD desc; 6 rows visible | — | row click → slide-over: loan → client card | `fact_loan`, `fact_loan_month`, `dim_client` |

---

## 5. View 5 — Revenue & targets ("what did the loans earn, and are we on the number?")

```
y116 ┌■ Revenue ┐┌■ Attainment┐┌■ Interest income┐┌■ Fees ┐┌■ MRR  ┐┌■ Paying subscribers┐
y236 └──────────┘└────────────┘└─────────────────┘└───────┘└───────┘└────────────────────┘
y252 ┌■ Revenue by month vs Budget vs PY ┐┌■ Revenue by stream, 13 months ┐┌■ Attainment by market ┐
y414 └───────────────────────────────────┘└───────────────────────────────┘└───────────────────────┘
y430 ┌■ MRR and subscribers by tier       ┐┌■ Subscriber churn %           ┐┌■ Channel mix, share   ┐
y592 └───────────────────────────────────┘└───────────────────────────────┘└───────────────────────┘
y608 ┌■ Stream × market - Sep 2026 (matrix table) ───────────────────────────────────────────────┐
y794 └───────────────────────────────────────────────────────────────────────────────────────────┘
```

| # | Card | x | y | w | h | Metric | Comparator row | Drill | Tables |
|---|---|---|---|---|---|---|---|---|---|
| R1 | Revenue | 32 | 116 | 216 | 120 | €2.98m (Sep 2026: interest + fees + interchange + subscriptions) | vs Budget −1.8% (watch) | — | `fact_revenue_month`, `param_fx` |
| R2 | Attainment | 264 | 116 | 216 | 120 | 98.2% · sub `pace 101 % - LE FY 98.1 %` | vs 100 % (watch band 95–99.9) | — | `fact_revenue_month`, `fact_target` |
| R3 | Interest income | 496 | 116 | 216 | 120 | €1.79m | vs Budget −2.4% (watch) | — | `fact_revenue_month` (stream) |
| R4 | Fees | 728 | 116 | 216 | 120 | €0.63m | vs Budget +0.8% (good) | — | `fact_revenue_month` |
| R5 | MRR | 960 | 116 | 216 | 120 | €348k (month-end) | vs Budget +1.2% (good) · sub `+14.0 % YoY` | — | `fact_subscription_month` |
| R6 | Paying subscribers | 1192 | 116 | 216 | 120 | 58.6k (Plus 44.1k · Pro 14.5k) | vs PY +9.8% (good) | — | `fact_subscription_month` |
| R7 | Revenue by month vs Budget vs PY | 32 | 252 | 448 | 162 | lines: Actual ink + dots, Budget teal + dots, PY grey dashed; Oct–Dec 2026 blank | — | mark click → month | `fact_revenue_month`, `fact_target` |
| R8 | Revenue by stream, 13 months | 496 | 252 | 448 | 162 | stacked columns Interest ink · Fees teal · Interchange grey-400 · Subscriptions grey-300 | — | segment click → stream | `fact_revenue_month` |
| R9 | Attainment by market | 960 | 252 | 448 | 162 | 3 bullets PL / RO / PT, revenue vs target, % label, status chip | — | bullet click → market | `fact_revenue_month`, `fact_target` × `dim_market` |
| R10 | MRR and subscribers by tier | 32 | 430 | 448 | 162 | stacked columns subscribers Plus (ink) / Pro (teal), 13 months, MRR as labels on top (no dual axis) | — | — | `fact_subscription_month` |
| R11 | Subscriber churn % | 496 | 430 | 448 | 162 | line ink + dots, PY grey dashed; callout `Plus price rise Jan 2026` | — | — | `fact_subscription_month` |
| R12 | Channel mix, share of loans | 960 | 430 | 448 | 162 | 100 % stacked columns by month (App ink · Partner teal · Web grey-400 · Agents grey-300 · Marketplace outline) | — | segment click → channel | `fact_loan` × `dim_channel` |
| R13 | Stream × market - table | 32 | 608 | 1376 | 186 | rows: 4 streams × (PL · RO · PT) + total; columns: Stream 160 · Market 100 · Actual € 120 · Budget € 120 · Δ € 110 · Δ % 90 · PY € 120 · Δ vs PY % 90 · Status 96 | Δ pair follows the header comparator | row click → slide-over: loans of that market whose month earned the revenue (loan grain; subscriptions row → client grain, subscribers) | `fact_revenue_month`, `fact_target`, `dim_market` |

---

## 6. Interactions (both tracks)

| Control | Behaviour | Default | Power BI | React |
|---|---|---|---|---|
| **Market picker** | single select All markets · PL · RO · PT; filters every card and the slide-over; the period line and table titles repeat the market name | All markets | Tile slicer on `dim_market`; "All" = clear | `useSalesState().market`, URL `?m=` |
| **Period picker** | Month · QTD · YTD · R12M, anchored on the selected month (`Sep 2026 ▾`, closed months only); window facts sum days / months in the window; period-end metrics (DPD, MRR, subscribers) take the anchor month | Month · Sep 2026 | Two slicers → `param_period[time_view]`, `dim_date[month_key]`; window measures via `DATESINPERIOD` on `dim_date` | `?p=month&a=2026-09` |
| **Comparator** | Budget · PY; selects series 2 on every chart and the Δ column(s) of tables; hero cards always show both rows; KPI cards show the selected row and the other on hover | Budget | Slicer on `param_comparator`; measures `[Δ vs Comparator]` | `?c=budget` |
| **View tabs** | swap the content region (y 116–794); header persists; filters persist across views | Overview | 5 bookmarks toggling visual groups `g_overview … g_revenue` (data unchanged, "Display" only) | `?view=` |
| **Card click (hero / why ↗)** | opens the metric's home view with the current filters | — | Button action = bookmark | router state |
| **Mark click** | filters the same view's other cards (cross-filter) and the table; second click clears; a chip row above the table shows the active mark filters | none | Native cross-filter (edit interactions: cards → none) | `markFilter` state, chips |
| **Row click** | opens the **slide-over** (720 px from the right, x 720–1440, y 100–810, scrim 40 % ink over x 0–720): title sentence of carried filters, chip row, table of loan rows (or client card + loans for Clients), sort, "Export CSV", Esc / ✕ closes | — | Drill-through page `loan_detail` / `client_detail` (same 720 px column layout on a 1440 × 810 page with the left half dimmed), Back button | `<SlideOver>`, `?drill=` |
| **Slide-over row click** | loan row → client card (all loans of the client); client row → that client's loans | — | second drill-through | nested panel state |
| **ⓘ** | info pop-up: what it shows · how to read · example · watch-out | — | tooltip page | `<InfoPopover>` |
| **Copy link** (Track C only) | encodes view, market, period, comparator, mark filters, drill | — | — | F-37 analogue |

Filters carried into the slide-over: period window, market, product, channel, segment, agent (+ the clicked mark context: month, channel, cohort, bucket, vintage). Versions do not apply at loan level (Actual only). The slide-over title repeats the carried filters as a sentence (`1,296 loans - Romania - Step 12 - Marketplace - Sep 2026 - 60–89 DPD`).

---

## 7. Build checklist (first-open, both tracks)

1. Frame 1440 × 810, header wedge points exactly `760,0 1440,0 1440,64`.
2. Every card at the x / y / w / h of §1–§5; marker 16 × 16 flush at each card's origin.
3. Hero values 44/800, KPI values 28/700, Segoe UI Bold / Inter 800.
4. Series: Actual ink, comparator teal, PY grey dashed; selected mark yellow with ink outline.
5. Formats per `design-tokens.md` §8; U+2212 minus; `+` on positive deltas.
6. Status: glyph + colour + chip word; thresholds from `param_thresholds`.
7. Defaults: All markets · Month · Sep 2026 · Budget · Overview.
8. Row click opens the detail at loan / client grain with the title sentence of carried filters.
9. Control totals: hero values reconcile to `data/mirelo_sales_dummy_data/checks/` (when published by the generator) in both tracks.
