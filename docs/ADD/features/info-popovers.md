# Info pop-ups — shared copy (ADR-0007 §2.6, L-15)

One text per visual, used as is by Tracks A, B and C. Plain language for a reader with no finance background. `{comparison}` = the comparison the visual uses (Compare A, else Compare B, else Prior year; C-40); `{breakdown}` = the selected breakdown (Region, Channel, Category / service line, Segment; Group: Region, Entity). Keep the four headings; trim, don't rewrite, if a track has less room. The examples are illustrative and show the reading pattern, not live figures; show them in the pop-up labelled "For example".

---

## Net revenue bridge

**What it shows**
How net revenue got from {comparison} to the current figure, split into the reasons for the change.

**How to read it**
- The first bar is net revenue in {comparison}; the last bar is net revenue now.
- Each bar in between is one reason for the difference: green adds revenue, orange takes it away.
- The steps always add up exactly: first bar + all steps = last bar.
- Consumer Products: **Volume** = more or fewer units sold; **Price / mix** = earning more or less per unit (prices, discounts, selling more of the dearer products). Commerce Cloud: one step per service line. ACME Group: one step per company, then the change in intercompany eliminations.
- **FX** = the effect of exchange rates when local currencies are translated into the reporting currency. All other steps are measured at constant rates, so they show real business change.

**Example**
"Revenue is 65 m above budget: 128 m from selling more units, partly offset by price / mix and a weaker euro."

**Watch out**
The axis does not start at zero, so small steps look bigger than they are; read the numbers above the bars. With FX basis set to Constant currency, the FX step is zero.

---

## Largest variances

**What it shows**
The 8 lines of the P&L that differ most from {comparison}, in amount, whether up or down.

**How to read it**
- Each row is one detailed P&L line, with the block it belongs to underneath (for example "Advertising: working media · Sales & marketing").
- The bar points right (green) when the difference helps profit and left (orange) when it hurts profit.
- For costs this means: spending less than planned is green, spending more is orange.
- Δ is the difference in money; Δ % is that difference as a share of {comparison}.

**Example**
"Working media is 18 m below budget: a favourable variance, because a lower cost raises profit."

**Watch out**
The ranking is by size only. A large variance is not always bad news, and a small line can still matter; check the colour, not just the length of the bar.

---

## Profitability by {breakdown}

**What it shows**
How much revenue each {breakdown} brings in, how it grew against {comparison}, and how much of that revenue is left as profit at each stage of the P&L.

**How to read it**
- **Net revenue**: the revenue of the row. **Share**: its part of the total (the rows add up to 100 %).
- **vs {comparison}**: revenue growth of the row; green is better than {comparison}, orange is worse.
- **Margins** are profit as a % of the row's revenue, from the top of the P&L down: **Gross** (after the direct cost of the product or service), **Contribution** (after selling and delivery costs), **Adj. EBITDA** (after running costs such as marketing, R&D and admin), **Operating** (after depreciation and one-off items).
- Read across a row: each margin is lower than the one before, because more costs are taken off.

**Example**
"Online marketplaces is 22 % of revenue and grew 8 % vs budget, but its contribution margin is the lowest because of marketplace fees."

**Watch out**
Costs that are not booked to a {breakdown} (for example marketing or admin) are shared out by each row's share of revenue, so margins below contribution margin are partly an allocation, not a direct measurement.

---

## Contribution margin by {breakdown}

**What it shows**
For each {breakdown}, the share of its revenue that is left after the direct costs of making, selling and delivering: the contribution margin %.

**How to read it**
- A longer bar means more of each sale is left to pay for running costs and profit.
- The dashed line is the company average. Bars beyond the line do better than average; bars short of it do worse.
- Rows are the same as in the table next to it, so a large row with a short bar weighs on the whole company.

**Example**
"Premium earns a 52 % contribution margin against a 41 % average: every 100 of premium sales leaves 52 after direct costs."

**Watch out**
A high margin on a small row moves the total little. Look at the share in the table next to the bar before drawing conclusions.

---

<!-- GENERATED:redesign-v4 start - npm run export:info-copy; edit the TypeScript, not this block -->

## P&L views redesign v4 - ⓘ pop-ups and How to read (Track C source)

Generated from `js-report/lib/engine/vitals.ts`, `analysis.ts`, `profitability.ts` and `view-copy.ts` by
`npm run export:info-copy`. The TypeScript is the source: change the copy there and re-run the script. Tracks A
and B take the text as is (parity rule 6: " - " separator). Pop-up shape (ADR-0012 §2.3): title - what it is -
formula in words - sub-values - source. Where a card reads differently per company, each company is listed;
example values: FY2026 YTD Sep, USD m, Budget and Prior year.

### Vitals cards

#### Net revenue

**What it is**
Gross revenue less gross-to-net deductions (spine step 3). The chip compares with Budget only; other rows are text.

**Formula**
NR = GR + GTN; Δ = actual − comparison, % of |comparison|

**Values (example at the default selection)**
- Organic growth vs PY (constant currency): +6.1%
- Reported growth vs PY: +8.2%

**Source (Track B measures)**
KPI Value K-01 - KPI Δ A / Δ B - KPI Organic Growth - KPI Reported Growth

#### Adjusted EBITDA

_Consumer Products_

**What it is**
Contribution margin plus operating expenses (spine step 9, management performance measure). Excludes D&A and adjusting items; the data has no share-based compensation.

**Formula**
Adj. EBITDA = CM + OPEX

**Values (example at the default selection)**
- Margin: 20.1%

**Source (Track B measures)**
KPI Value K-07 - KPI Adj EBITDA Margin

_Commerce Cloud_

**What it is**
Contribution margin plus operating expenses (spine step 9, management performance measure). Excludes D&A and adjusting items; the data has no share-based compensation.

**Formula**
Adj. EBITDA = CM + OPEX

**Values (example at the default selection)**
- Margin: 13.1%
- Rule of 40 (organic growth + margin): 40.4%

**Source (Track B measures)**
KPI Value K-07 - KPI Adj EBITDA Margin - KPI Rule of 40 (K-12 S)

#### Operating profit

**What it is**
IFRS 18 required subtotal (spine step 13).

**Formula**
OP = Adj. EBITDA + D&A + adjusting items (signed)

**Values (example at the default selection)**
- Margin: 16.2%
- Adj. EBITDA: $682.6 m
- D&A: −$122.3 m
- Adjusting items: −$10.0 m
- Net profit: $396.2 m
- Net margin: 11.7%

**Source (Track B measures)**
KPI Value K-08 - KPI Operating Margin - Net Profit - KPI Net Margin

#### Gross margin %

_Consumer Products_

**What it is**
Gross profit as a share of net revenue. A ratio: variances in percentage points.

**Formula**
GM % = GP ÷ NR

**Values (example at the default selection)**
- Home care: 51.6%
- Personal care & beauty: 59.6%

**Source (Track B measures)**
KPI Gross Margin % K-03 - GM % by category (dim_line)

_Commerce Cloud_

**What it is**
Gross profit as a share of net revenue. A ratio: variances in percentage points.

**Formula**
GM % = GP ÷ NR

**Values (example at the default selection)**
- Platform subscriptions: 81.2%
- Payments: 38.6%

**Source (Track B measures)**
KPI Gross Margin % K-03 - KPI Subscription GM % - Payments GM % (same pattern on PAY)

#### Opex % revenue

**What it is**
Sales & marketing, R&D and G&A as a share of net revenue. Lower is better, so the colour logic is inverted. Excludes other operating items, D&A and adjusting items.

**Formula**
Opex % = −(SM + RD + GA) ÷ NR

**Values (example at the default selection)**
- Sales & marketing % NR: 11.5%
- R&D % NR: 2.4%
- G&A % NR: 5.3%
- Opex: $654.6 m
- Opex vs Budget (favourable +): +$27.3 m

**Source (Track B measures)**
new: Opex % NR = blocks SM + RD + GA ÷ NR (PL % NR rows) - spec KPI §5 1.3

#### Units sold

**What it is**
Units shipped in the window (a flow: sums over the months).

**Formula**
units = Σ units_sold

**Values (example at the default selection)**
- Volume vs prior year: +3.9%

**Source (Track B measures)**
KPI Units Sold K-09 P

#### Net revenue per unit

**What it is**
Net revenue divided by units sold: the price / mix lever.

**Formula**
NR per unit = NR ÷ units sold

**Values (example at the default selection)**
- Net revenue: $3,398.5 m
- Units sold: 419,838,143

**Source (Track B measures)**
KPI NR per Unit K-10 P

#### Gross-to-net %

**What it is**
Deductions from gross revenue (trade spend, rebates, returns) as a share of gross revenue. Lower is better.

**Formula**
GTN % = − GTN ÷ GR

**Values (example at the default selection)**
- Gross-to-net deductions: −$922.5 m

**Source (Track B measures)**
KPI Gross-to-Net % K-04 P

#### A&P % of NR

**What it is**
Advertising (working media) and consumer promotions as a share of net revenue. Neutral: no colour.

**Formula**
A&P % = − (SM_P1 + SM_P2) ÷ NR

**Values (example at the default selection)**
- A&P spend: −$272.9 m

**Source (Track B measures)**
KPI A&P % NR K-05 P

#### FY outlook vs Budget

**What it is**
Latest estimate of net revenue for the whole fiscal year: actual closed months plus the latest forecast for open months (C-02). Same card for every company.

**Formula**
attainment = FY LE ÷ FY Budget

**Values (example at the default selection)**
- Revenue attainment: 97.6%
- Adj. EBITDA, FY LE: $961.1 m
- EBITDA attainment: 96.4%

**Source (Track B measures)**
FY LE Amount - FY Budget Amount - PL Δ LE vs Budget (M-14)

#### GMV processed

**What it is**
Transaction value processed in the window, translated like amounts.

**Formula**
GMV = Σ gmv_local → reporting currency, per month × currency

**Values (example at the default selection)**
- Payments take rate: 2.66%
- Take rate vs Budget: 0 bp
- Take rate vs Prior year: −2 bp

**Source (Track B measures)**
KPI GMV K-09 S - KPI Payments Take Rate K-05 S

#### Active merchants

**What it is**
Merchants with an active paid plan at the last month-end of the window; never a sum over months.

**Formula**
merchants = active_merchants_end at the window end (K-23)

**Values (example at the default selection)**
- GMV per merchant: $81.3 k

**Source (Track B measures)**
KPI Active Merchants K-10 S - new: KPI GMV ÷ KPI Active Merchants

#### ARR (run-rate)

**What it is**
Platform-subscription net revenue of the last month in the window × 12. A run-rate proxy, not contract ARR.

**Formula**
ARR = SUB NR (last month) × 12

**Values (example at the default selection)**
- Net new ARR vs prior-year end: +$57.4 m

**Source (Track B measures)**
KPI ARR K-04 S - new: KPI ARR − KPI ARR as Compare B

#### Revenue mix

**What it is**
Platform subscriptions and Payments as shares of net revenue; the rest is apps, partners & ads and professional services. Neutral: no colour.

**Formula**
share = NR of the service line ÷ NR

**Values (example at the default selection)**
- Platform subscriptions: $223.4 m (+24.6% YoY)
- Payments: $299.6 m (+37.0% YoY)

**Source (Track B measures)**
Prof NR Share by dim_line (SUB, PAY) - gap analysis P1

### Analysis panels

#### Net revenue bridge

_Consumer Products_

**What it is**
Budget to actual: driver steps at constant currency, a constant-currency subtotal, then FX (translation, not controllable). The axis does not start at zero; read the labels.

**Formula**
volume = Σ slices (U − Ucmp) × NRcc cmp ÷ Ucmp; price / mix = ΔNRcc − volume; CC subtotal = comparison + Σ steps; FX = (NR − NRcc) actual − (NR − NRcc) comparison

**Values (example at the default selection)**
- Reported Δ vs Budget: −$66.3 m (−1.9%)
- Constant-currency Δ: −$95.8 m (−2.8%)
- FX: +$29.5 m

**Source (Track B measures)**
Bridge Value - Bridge Comparison NR - _NR CC Base - _NR CC Bridge Cmp - Bridge FX - C-40 - new step "Constant-currency NR"

_Commerce Cloud_

**What it is**
Budget to actual: driver steps at constant currency, a constant-currency subtotal, then FX (translation, not controllable). The axis does not start at zero; read the labels.

**Formula**
service-line step = NRcc actual − NRcc comparison per line; CC subtotal = comparison + Σ steps; FX = (NR − NRcc) actual − (NR − NRcc) comparison

**Values (example at the default selection)**
- Reported Δ vs Budget: −$6.2 m (−1.0%)
- Constant-currency Δ: −$10.5 m (−1.7%)
- FX: +$4.3 m

**Source (Track B measures)**
Bridge Value - Bridge Comparison NR - _NR CC Base - _NR CC Bridge Cmp - Bridge FX - C-40 - new step "Constant-currency NR"

#### Profit bridge

_Consumer Products_

**What it is**
Budget Adj. EBITDA to actual: revenue volume at the comparison's gross margin, GM rate and mix by category, variable selling, the opex blocks (all at constant currency), then FX. D&A and adjusting items are actual levels (their Δ is the small label) so the bridge reconciles to operating profit. No share-based compensation step: not in the data.

**Formula**
volume = ΔNRcc × GM %cmp; mix = Σ lines (NR − NR × share cmp) × GM %cmp,line; rate = ΔGPcc − volume − mix; FX = (E − Ecc) − (Ecmp − Ecc,cmp)

**Values (example at the default selection)**
- Adj. EBITDA Δ vs Budget: −$18.4 m
- of which FX: +$5.9 m
- Δ at constant currency: −$24.4 m
- Operating profit Δ vs Budget: −$21.6 m

**Source (Track B measures)**
PL Δ A rows VSC SM RD GA OOI - PL Base rows DA ADJ - GP by dim_line - _Bridge NR CC Change - CC branch of _Amt Raw - new dim_profit_step - spec Analysis §5.2

_Commerce Cloud_

**What it is**
Budget Adj. EBITDA to actual: revenue volume at the comparison's gross margin, GM rate and mix by service line, variable selling, the opex blocks (all at constant currency), then FX. D&A and adjusting items are actual levels (their Δ is the small label) so the bridge reconciles to operating profit. No share-based compensation step: not in the data.

**Formula**
volume = ΔNRcc × GM %cmp; mix = Σ lines (NR − NR × share cmp) × GM %cmp,line; rate = ΔGPcc − volume − mix; FX = (E − Ecc) − (Ecmp − Ecc,cmp)

**Values (example at the default selection)**
- Adj. EBITDA Δ vs Budget: −$4.8 m
- of which FX: +$0.6 m
- Δ at constant currency: −$5.4 m
- Operating profit Δ vs Budget: −$5.9 m

**Source (Track B measures)**
PL Δ A rows VSC SM RD GA OOI - PL Base rows DA ADJ - GP by dim_line - _Bridge NR CC Change - CC branch of _Amt Raw - new dim_profit_step - spec Analysis §5.2

#### Largest variances vs Budget

**What it is**
Leaf lines of the P&L down to operating profit. Δ = actual − comparison on signed values, so a positive Δ always helps profit and a negative one hurts it; bars share one scale. Top 8 / 12 / All; By block groups the shown lines under their P&L block with the block’s full subtotal; By |Δ| is one flat ranking. A cut splits every bar into slice members; opex and below are booked by region only and allocated by NR share to the other slices (marked alloc.).

**Formula**
Δ = actual − comparison; Δ % = Δ ÷ |comparison|, n.m. when |comparison| < 2.0 or |Δ %| > 50 %; FX = (actual − actual cc) − (comparison − comparison cc); coverage = Σ|Δ shown| ÷ Σ|Δ all|

**Values (example at the default selection)**
- Lines to operating profit: 37
- Coverage of the shown lines: 81%
- Second comparison: actual − Prior year, same months

**Source (Track B measures)**
LV Base - LV Comparison - LV Δ - LV Δ % - LV Abs Δ (TopN) - Compare B Amount (PY) - dim_account.block_code - _Amt Row block subtotals - fact_pl / fact_pl_allocated cut (C-30, C-31) - new: LV FX, TopN parameter, block grouping - C-45

### Profitability panels

#### Profitability by Region

**What it is**
Constant currency, rows by net revenue. Δ vs Budget % on net revenue; GM % and CM % of the region’s revenue; CM Δ = contribution margin % minus Budget in pp, the only column with a status dot. Adj. EBITDA is booked by region (C-31): nothing here is allocated.

**Formula**
GM % = GP ÷ NR; CM % = contribution ÷ NR; CM Δ = CM % − comparison CM %

**Values (example at the default selection)**
- Comparison: Budget
- Status dot: on track ±0.3 pp, watch to 1.0 pp, off track beyond, ahead = green

**Source (Track B measures)**
Prof Net Revenue - Prof NR Δ % (CC) - Gross Profit - Contribution Margin - KPI CM % - Adjusted EBITDA - new: CM Δ pp - C-46

#### Concentration - share by profit level

**What it is**
Three 100 % bars: each region’s share of net revenue, of contribution and of Adj. EBITDA (booked by region). A region whose share shrinks from revenue to contribution dilutes the margin; one whose share grows is accretive.

**Formula**
share = region value ÷ company value, per level; drift = EBITDA share − NR share (pp)

**Values (example at the default selection)**
- North America: 44.2% / 44.2% / 44.3%
- Continental Europe: 28.0% / 28.0% / 28.0%
- Asia-Pacific: 15.4% / 15.4% / 15.4%
- UK & Ireland: 12.4% / 12.4% / 12.4%

**Source (Track B measures)**
Prof NR Share - contribution and EBITDA shares (same pattern on Contribution Margin / Adjusted EBITDA)

#### Growth × margin by region

**What it is**
x = net revenue growth year on year at constant currency, y = contribution margin %, bubble = net revenue; dashed lines = company values, giving four quadrants. The thin line runs from the prior-year position (hollow dot) to the current one; it needs two earlier years, so it is blank where the prior year has no prior year (C-04).

**Formula**
growth = NRcc ÷ PY NRcc − 1; CM % = contribution ÷ NR, per region

**Values (example at the default selection)**
- Company growth: +6.1%
- Company CM %: 39.1%
- Prior-year trails: drawn

**Source (Track B measures)**
KPI Organic Growth per slice (K-22) - KPI CM % per slice - Prof Net Revenue - PY: Compare B Amount

#### Mix - region × category

**What it is**
Cells: net revenue at constant currency and its share of the region; colour = gross margin % of the column (dark = high). Row and column totals reconcile to the table.

**Formula**
cell = NR(region, line); share = cell ÷ region NR; colour = GP ÷ NR of the line

**Values (example at the default selection)**
- Home care: NR $946.3 m, GM 51.6%
- Personal care & beauty: NR $907.5 m, GM 59.6%
- Kitchen & household: NR $681.6 m, GM 47.5%
- Electronics accessories: NR $501.3 m, GM 34.7%
- Toys & leisure: NR $332.3 m, GM 41.5%

**Source (Track B measures)**
Net Revenue - Gross Profit at dim_region × dim_line grain (both direct, C-30)

### How to read (one per view)

#### How to read - Vitals

- **Showing**: Showing Jan – Sep 2026 - year to date - USD m - vs Budget and Prior year
- **Results**: Net revenue, Adj. EBITDA and Operating profit, then Gross margin % and Opex % revenue.
- **Drivers & health**: Five cards whose content follows the company (L-10); FY outlook for every company.
- **Card face**: Value, Δ vs Compare A and Compare B ($ and %, pp for ratios), “on plan” for a zero Δ, status chip vs Budget.
- **Legend**: Status vs Budget only: grey on track (±1 % / ±0.3 pp), amber watch (to 3 % / 1 pp), red off track beyond, green ahead; "lower is better" inverts on Opex %. ⓘ on each card holds its definition and sources.

#### How to read - Analysis

- **Showing**: Showing Jan – Sep 2026 - year to date - USD m - vs Budget and Prior year
- **Page 1**: Net revenue bridge (drivers at constant currency → CC subtotal → FX → actual) and profit bridge (comparison Adj. EBITDA → actual → operating profit).
- **Page 2**: Largest variances to operating profit: Top 8 / 12 / All, by block or by |Δ|, cut by slice, prior-year Δ and of which FX.
- **Paging**: ‹ › in the tabs row, or the ← → keys.
- **Colours**: Bridges: increase green, decrease orange, totals company colour, subtotals dark, FX hatched; axes do not start at zero. Variance bars: right helps profit, left hurts, one scale.
- **Legend**: Status vs Budget only: grey on track (±1 % / ±0.3 pp), amber watch (to 3 % / 1 pp), red off track beyond, green ahead; "lower is better" inverts on Opex %. ⓘ on each card holds its definition and sources.

#### How to read - Profitability

- **Showing**: Showing Jan – Sep 2026 - year to date - USD m - vs Budget and Prior year
- **Page 1**: Table by region at constant currency (status dot on CM Δ only) and concentration bars (share of revenue, contribution and Adj. EBITDA).
- **Page 2**: Growth × margin by region with prior-year trails, and the mix of region × category.
- **Basis**: Constant currency by default when comparing; by region nothing is allocated (opex is booked by region, C-31).
- **Paging**: ‹ › in the tabs row, or the ← → keys.
- **Legend**: Status vs Budget only: grey on track (±1 % / ±0.3 pp), amber watch (to 3 % / 1 pp), red off track beyond, green ahead; "lower is better" inverts on Opex %. ⓘ on each card holds its definition and sources.

<!-- GENERATED:redesign-v4 end -->
