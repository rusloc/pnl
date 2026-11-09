# ACME Marketing — measure dictionary

> Generated 2026-11-05 by `pbi-report/ACME Marketing/tools/gen/build_docs.py` from the measure list of the model (bip, ADR-0015 phase 2).
> Regenerate it with the model; do not edit by hand. Owner of every measure: bip. Spec IDs: `docs/Requirements-marketing.md` (A-nn).

`_measures` holds **469 measures**: 327 visible in folders 1–8, 142 hidden engine helpers in folder 9.

## How the layers fit

- **Window** (`9 Engine`): `_Win Start` / `_Win End` from the period preset (`param_period_preset`, 30 d when nothing is picked) or the Custom range (`param_date`), anchored on `meta_dataset[as_of_date]` (2026-11-03), never `TODAY()` (A-10, A-81).
- **Base sums** (`_b *`) and **derived metrics** (`_x *`) read whatever days are in the date context.
- **Visible metrics** (`<Metric>`) evaluate `_x <Metric>` over the window days; `<Metric> Prev` (same length, immediately before), `<Metric> LY` (same dates one year back) and `<Metric> Cmp` (the comparison mode) are the comparison windows (A-11).
- **Model switch**: `_Model` reads `dim_attribution_model` (DDA when nothing is selected) and reaches paid customers and New MRR only, so CAC, CPA, ROAS, payback and LTV:CAC follow it; sign-ups, activations, trials, cohorts and retention never switch (A-16).
- **Thresholds** live in `param_target` (`_T <CODE>` measures) and `param_finance` (`_GM`, `_b Team Pool`) only (A-75).

## Visible measures

### 6 Diagnostics

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `CPA Target` | CPA target of the scope: the campaign's own target (null for Lead / Retention) or the channel target in param_target (A-24). |  | `$#,0` |
| `Frequency 7d` | Frequency at the window end (14-day windows and longer). | A-44 | `0.0` |
| `CTR Slope 7d` | CTR 7-day slope at the window end (14-day windows and longer). | A-44 | `+0%;-0%;0%` |
| `Install Quality Delta` | Install → sign-up, last 7 days − previous period (INSTALL campaigns). | A-24 | `+0.0%;-0.0%;0.0%` |
| `Creative CTR 7d` | CTR of the window's last 7 days (creatives, no window-length guard). | A-44 | `0.00%` |
| `Creative Slope 7d` | CTR slope at the window end (creatives). | A-44 | `+0%;-0%;0%` |
| `Creative Frequency` | Frequency at the window end (creatives). | A-44 | `0.0` |
| `Term Impressions` | Σ term impressions. | A-45 | `#,0` |
| `Term Clicks` | Σ term clicks. | A-45 | `#,0` |
| `Term Spend` | Σ term spend. | A-45 | `$#,0.00` |
| `Term Signups` | Σ term sign-ups (Conv.). | A-45 | `#,0` |
| `Term CPC` | Term spend ÷ term clicks. | A-45 | `$#,0.00` |
| `Term CVR` | Term sign-ups ÷ term clicks. | A-45 | `0.0%` |
| `Ad Set Credits` | Σ paid_customers_dda of the window (DDA only). | A-54 | `#,0.0` |
| `Flag Codes` | Flag codes of a campaign or channel scope in the window (A-24, data README Flags): exclusive gates first, then every root cause that trips; CPA over only without a root cause. | A-24 | `text` |
| `Flags Text` | Flag words of the scope (A-24, A-25: every flag carries its word). | A-24 | `text` |
| `Trial Shortfall` | Trials × the scope's previous-period trial → paid − paid customers (DDA; data README Trial → paid shortfall). | A-63 | `#,0.0` |
| `Loss Share` | Share of the ALL trial → paid shortfall carried by the scope (story: SOC_META_LAL2 ≈ 70 %). | A-63 | `0%` |
| `ROAS 90d Basis` | ROAS 90 d of the comparison period for the movers: same period last year in LY mode, else the previous period (A-52). | A-52 | `0.00` |
| `ROAS Delta` | ROAS 90 d − the comparison period's, for one campaign with a ROAS objective and spend in both periods, over the movers window (_Mv Start .. window end) and its comparison, as explicit date windows (data README Movers). | A-52 | `+0.00;-0.00;0.00` |
| `Mover Rank` | 1 … 3 = the three best, −1 … −3 = the three worst campaigns by Δ ROAS in the scope; blank otherwise (O6). Also clears dim_campaign[sort_order]: a visual grouping by campaign_label groups by its sort-by column too. | A-52 | `0` |
| `ROAS Delta Shown` | Δ ROAS of the six movers only (O6 bars; blank for every other campaign). | A-52 | `+0.00;-0.00;0.00` |
| `Mover Visible` | 1 for the six movers of O6 (visual filter). | A-52 | `0` |
| `Selected Campaign Name` | Name of the selected campaign (P2 title). | A-54 | `text` |
| `P3 Ad Set CPA` | Ad-set CPA of the selected campaign: spend ÷ DDA credits (P3). | A-54 | `$#,0` |
| `P3 CPA Target` | CPA target of the selected campaign (P3 dashed line). | A-54 | `$#,0` |
| `P4 CTR 7d` | Creative CTR of the window's last 7 days (P4). | A-54 | `0.00%` |
| `P4 Slope` | Creative CTR 7-day slope (P4). | A-54 | `+0%;-0%;0%` |
| `P4 Frequency` | Creative frequency at the window end (P4). | A-54 | `0.0` |
| `P5 CPC` | Term CPC of the selected campaign (P5). | A-54 | `$#,0.00` |
| `P5 CVR` | Term CVR of the selected campaign (P5). | A-54 | `0.0%` |
| `P5 Conv` | Term sign-ups of the selected campaign (P5). | A-54 | `#,0` |
| `Creative Status` | 3 Fatigued, 2 Watch, 1 Fresh (data README Creative status). | A-54 | `0` |
| `P4 Status` | Creative status word (P4). | A-54 | `text` |
| `Alert Tripped` | 1 when the alert slot trips in the window and scope (param_alert_rule, data README Alerts), else 0. | A-64 | `0` |
| `Alert Value` | Value of a tripped alert: slope, spend − plan, pt change, gap change, plan − spend or hours (data README Alerts). | A-64 | `0.0000` |
| `Alerts Tripped` | Number of alert slots that trip (default window: 5, AT-10). | A-64 | `0` |
| `Freshness Dot` | 1 green, 2 amber (a source at or past stale_after_h), 3 red (past red_after_h) (A-17, AT-15). | A-17 | `0` |
| `Synced Hours Ago` | Age in hours of the oldest hourly source (header 'Synced n h ago', A-17). | A-17 | `0.00` |
| `Story Step Date` | The story's event day (ADR-0015 (d), A-52 / A-63: paid CAC steps up and mobile paid-social trial → paid breaks on Oct 18). An annotation of the dataset, like the O3 / P2 constant line: the noisy daily CAC makes the largest 7-day step fall on Oct 17, so the day is not detected. | A-63 | `yyyy-mm-dd` |
| `Story CAC Step` | 7-day mean of daily paid CAC from the step day ÷ the 7 days before − 1 (story +20 %, AT-08). | A-63 | `+0.0%;-0.0%` |
| `Paid Customers Basis` | Paid customers of the anomalies' comparison window: the same period last year in LY mode, else the previous period (O5). | A-52 | `#,0` |
| `Anomaly Delta` | Paid customers (selected model) − the comparison window's, for one campaign with spend in both periods, over the movers window (_Mv Start .. window end) and its comparison, as explicit date windows (O5). | A-52 | `+#,0.0;-#,0.0;0.0` |
| `O5 Rank` | 1 .. 5: the campaign's place among the five largest losses (Worst 5) or gains (Top 5) of paid customers in the scope; blank otherwise (O5). | A-52 | `0` |
| `O5 Visible` | 1 for the five campaigns O5 lists (visual filter). | A-52 | `0` |
| `O6 Rank` | 1 .. 5: the campaign's place among the five largest falls (Worst 5) or rises (Top 5) of 90-day ROAS in the scope; blank otherwise (O6). | A-52 | `0` |
| `O6 Visible` | 1 for the five campaigns O6 draws (visual filter). | A-52 | `0` |
| `P6 Rank` | 1 .. 5: the channel's place among the five with the most churned customers in the scope; blank otherwise (P6). |  | `0` |
| `P6 Visible` | 1 for the five channels P6 draws (visual filter). |  | `0` |
| `P7 Rank` | 1 .. 5: the channel's place among the five with the most refunds in the scope; blank otherwise (P7). |  | `0` |
| `P7 Visible` | 1 for the five channels P7 draws (visual filter). |  | `0` |

### 1 Spend & delivery

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Spend` | Σ spend_usd of the window. | A-30 | `$#,0` |
| `Plan` | Plan of the window: Σ budget_usd ÷ days_in_month per day. | A-31 | `$#,0` |
| `Pacing` | Spend ÷ plan. | A-31 | `0%` |
| `Impressions` | Σ impressions. | A-32 | `#,0` |
| `Clicks` | Σ clicks. | A-32 | `#,0` |
| `CTR` | Clicks ÷ impressions. | A-32 | `0.00%` |
| `CPC` | Spend ÷ clicks. | A-32 | `$#,0.00` |
| `CPM` | Spend ÷ impressions × 1000. | A-32 | `$#,0.00` |
| `Spend Share` | Share of the scope's spend (C1 share, O4). | A-52 | `0.0%` |

### 7 Comparisons

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Spend Prev` | Spend of the previous period (same length, immediately before) (A-11). | A-30 | `$#,0` |
| `Spend LY` | Spend of the same dates one year back (A-11). | A-30 | `$#,0` |
| `Spend Cmp` | Spend of the comparison window: previous period or same period last year; blank for Plan and None (A-11). | A-11 | `$#,0` |
| `Clicks Prev` | Clicks of the previous period (same length, immediately before) (A-11). | A-32 | `#,0` |
| `Clicks LY` | Clicks of the same dates one year back (A-11). | A-32 | `#,0` |
| `Clicks Cmp` | Clicks of the comparison window: previous period or same period last year; blank for Plan and None (A-11). | A-11 | `#,0` |
| `Click Signup Rate Prev` | Click Signup Rate of the previous period (same length, immediately before) (A-11). | A-34 | `0.0%` |
| `Click Signup Rate LY` | Click Signup Rate of the same dates one year back (A-11). | A-34 | `0.0%` |
| `Click Signup Rate Cmp` | Click Signup Rate of the comparison window: previous period or same period last year; blank for Plan and None (A-11). | A-11 | `0.0%` |
| `Trials Prev` | Trials of the previous period (same length, immediately before) (A-11). | A-36 | `#,0` |
| `Trial to Paid Prev` | Trial to Paid of the previous period (same length, immediately before) (A-11). | A-36 | `0.0%` |
| `Trial to Paid LY` | Trial to Paid of the same dates one year back (A-11). | A-36 | `0.0%` |
| `Trial to Paid Cmp` | Trial to Paid of the comparison window: previous period or same period last year; blank for Plan and None (A-11). | A-11 | `0.0%` |
| `Paid Customers Prev` | Paid Customers of the previous period (same length, immediately before) (A-11). | A-37 | `#,0` |
| `Paid Customers LY` | Paid Customers of the same dates one year back (A-11). | A-37 | `#,0` |
| `Paid Customers Cmp` | Paid Customers of the comparison window: previous period or same period last year; blank for Plan and None (A-11). | A-11 | `#,0` |
| `Paid Customers DDA Prev` | Paid Customers DDA of the previous period (same length, immediately before) (A-11). | A-37 | `#,0.0` |
| `New MRR Prev` | New MRR of the previous period (same length, immediately before) (A-11). | A-39 | `$#,0` |
| `New MRR LY` | New MRR of the same dates one year back (A-11). | A-39 | `$#,0` |
| `New MRR Cmp` | New MRR of the comparison window: previous period or same period last year; blank for Plan and None (A-11). | A-11 | `$#,0` |
| `ARPA Prev` | ARPA of the previous period (same length, immediately before) (A-11). | A-39 | `$#,0.00` |
| `ARPA LY` | ARPA of the same dates one year back (A-11). | A-39 | `$#,0.00` |
| `ARPA Cmp` | ARPA of the comparison window: previous period or same period last year; blank for Plan and None (A-11). | A-11 | `$#,0.00` |
| `CPA Prev` | CPA of the previous period (same length, immediately before) (A-11). | A-37 | `$#,0` |
| `Paid CAC Prev` | Paid CAC of the previous period (same length, immediately before) (A-11). | A-38 | `$#,0` |
| `Paid CAC LY` | Paid CAC of the same dates one year back (A-11). | A-38 | `$#,0` |
| `Paid CAC Cmp` | Paid CAC of the comparison window: previous period or same period last year; blank for Plan and None (A-11). | A-11 | `$#,0` |
| `Blended CAC Prev` | Blended CAC of the previous period (same length, immediately before) (A-11). | A-38 | `$#,0` |
| `Blended CAC LY` | Blended CAC of the same dates one year back (A-11). | A-38 | `$#,0` |
| `Blended CAC Cmp` | Blended CAC of the comparison window: previous period or same period last year; blank for Plan and None (A-11). | A-11 | `$#,0` |
| `Payback Months Prev` | Payback Months of the previous period (same length, immediately before) (A-11). | A-40 | `0.0` |
| `Payback Months LY` | Payback Months of the same dates one year back (A-11). | A-40 | `0.0` |
| `Payback Months Cmp` | Payback Months of the comparison window: previous period or same period last year; blank for Plan and None (A-11). | A-11 | `0.0` |
| `LTV CAC Prev` | LTV CAC of the previous period (same length, immediately before) (A-11). | A-41 | `0.0` |
| `LTV CAC LY` | LTV CAC of the same dates one year back (A-11). | A-41 | `0.0` |
| `LTV CAC Cmp` | LTV CAC of the comparison window: previous period or same period last year; blank for Plan and None (A-11). | A-11 | `0.0` |
| `ROAS 90d Prev` | ROAS 90d of the previous period (same length, immediately before) (A-11). | A-42 | `0.00` |
| `ROAS 90d LY` | ROAS 90d of the same dates one year back (A-11). | A-42 | `0.00` |
| `ROAS 90d Cmp` | ROAS 90d of the comparison window: previous period or same period last year; blank for Plan and None (A-11). | A-11 | `0.00` |
| `Attribution Gap Prev` | Attribution Gap of the previous period (same length, immediately before) (A-11). | A-43 | `+0%;-0%;0%` |
| `Customers Target` | PAID_CUSTOMERS_30D × window days ÷ 30 (data README Verdicts). | A-24 | `#,0` |
| `Spend Δ` | Spend vs the comparison window, or vs plan in Plan mode (A-11, A-21). | A-21 | `+0.0%;-0.0%;0.0%` |
| `Paid Customers Δ` | Paid customers vs the comparison window, or vs the target in Plan mode. | A-21 | `+0.0%;-0.0%;0.0%` |
| `Blended CAC Δ` | Blended CAC vs the comparison window, or vs the target in Plan mode. | A-21 | `+0.0%;-0.0%;0.0%` |
| `New MRR Δ` | New MRR vs the comparison window; no plan exists (A-11). | A-21 | `+0.0%;-0.0%;0.0%` |
| `Payback Months Δ` | Payback months − the comparison value (months). | A-21 | `+0.0;-0.0;0.0` |
| `LTV CAC Δ` | LTV:CAC − the comparison value. | A-21 | `+0.0;-0.0;0.0` |
| `Clicks Δ` | Clicks vs the comparison window. | A-52 | `+0.0%;-0.0%;0.0%` |
| `Click Signup Rate Δ` | Click → sign-up − the comparison value (pt). | A-52 | `+0.0%;-0.0%;0.0%` |
| `Trial to Paid Δ` | Trial → paid − the comparison value (pt). | A-52 | `+0.0%;-0.0%;0.0%` |
| `Verdict Pacing` | Spend vs plan verdict: 1 OK within SPEND_PLAN_TOL, 3 CRIT beyond PACING_HI / PACING_LO, else 2 WARN (A-24). | A-24 | `0` |
| `Verdict Paid Customers` | Paid Customers vs its target: 1 OK, 2 WARN within WARN_BAND_REL, 3 CRIT (up is good; never follows the comparison mode, A-24). | A-24 | `0` |
| `Verdict Blended CAC` | Blended CAC vs its target: 1 OK, 2 WARN within WARN_BAND_REL, 3 CRIT (down is good; never follows the comparison mode, A-24). | A-24 | `0` |
| `Verdict Payback Months` | Payback Months vs its target: 1 OK, 2 WARN within WARN_BAND_REL, 3 CRIT (down is good; never follows the comparison mode, A-24). | A-24 | `0` |
| `Verdict LTV CAC` | LTV CAC vs its target: 1 OK, 2 WARN within WARN_BAND_REL, 3 CRIT (up is good; never follows the comparison mode, A-24). | A-24 | `0` |
| `Verdict Trial to Paid` | Trial to Paid vs its target: 1 OK, 2 WARN within WARN_BAND_REL, 3 CRIT (up is good; never follows the comparison mode, A-24). | A-24 | `0` |
| `Verdict D7 Retention` | D7 Retention vs its target: 1 OK, 2 WARN within WARN_BAND_REL, 3 CRIT (up is good; never follows the comparison mode, A-24). | A-24 | `0` |
| `Verdict D30 Retention` | D30 Retention vs its target: 1 OK, 2 WARN within WARN_BAND_REL, 3 CRIT (up is good; never follows the comparison mode, A-24). | A-24 | `0` |
| `Verdict Refund Rate` | Refund Rate vs its target: 1 OK, 2 WARN within WARN_BAND_REL, 3 CRIT (down is good; never follows the comparison mode, A-24). | A-24 | `0` |
| `Verdict Brand Share` | Brand Share vs its target: 1 OK, 2 WARN within WARN_BAND_REL, 3 CRIT (down is good; never follows the comparison mode, A-24). | A-24 | `0` |
| `Verdict Attribution Gap` | Attribution Gap vs its target: 1 OK, 2 WARN within WARN_BAND_REL, 3 CRIT (down is good; never follows the comparison mode, A-24). | A-24 | `0` |
| `Signups LY` | Signups of the same dates one year back (A-11; vitals V2). | A-20 | `#,0` |
| `Signup to Paid LY` | Conversion into paid of the same dates one year back. | A-20 | `0.0%` |
| `Act Median Hours LY` | Median hours from sign-up to activation, same dates one year back. | A-20 | `0` |
| `Time to Activation Days LY` | Time to activation of the same dates one year back. | A-20 | `0.0` |
| `Page CVR Prev` | Page CVR of the previous period (J1 caption). | A-55 | `0.0%` |

### 2 Funnel

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Sessions` | Σ web sessions. | A-33 | `#,0` |
| `Web Land Rate` | Web sessions ÷ clicks of web campaigns. | A-33 | `0.0%` |
| `Store Views` | Σ store-page views. | A-33 | `#,0` |
| `Installs` | Σ installs. | A-33 | `#,0` |
| `First Opens` | Σ first opens. | A-33 | `#,0` |
| `Store CVR` | Installs ÷ store views. | A-33 | `0.0%` |
| `Install Signup Rate` | Sign-ups of mobile campaigns ÷ installs. | A-33 | `0.0%` |
| `Landing Signup Rate` | Sign-ups of web campaigns ÷ sessions. | A-33 | `0.0%` |
| `Landed` | Web sessions + installs. | A-33 | `#,0` |
| `Signups` | Σ sign-ups. | A-34 | `#,0` |
| `Click Signup Rate` | Sign-ups ÷ clicks. | A-34 | `0.0%` |
| `CPL` | Spend ÷ sign-ups. | A-34 | `$#,0.00` |
| `Activated` | Σ first dashboard within 7 days of sign-up (cohorted by sign-up day). | A-35 | `#,0` |
| `Activation Rate` | Activated ÷ sign-ups. | A-35 | `0.0%` |
| `Cost per Activated` | Spend ÷ activated. | A-35 | `$#,0.00` |
| `Trials` | Σ trials. | A-36 | `#,0` |
| `Trial Rate` | Trials ÷ sign-ups. | A-36 | `0.0%` |
| `Trial to Paid` | Paid customers (selected model) ÷ trials. | A-36 | `0.0%` |
| `Signup to Paid` | Conversion into paid (vitals V3): paid customers of the window (selected model, conversion day) ÷ sign-ups of the window (sign-up day); a period rate, not a cohort. | A-20 | `0.0%` |
| `Time to Activation Days` | Vitals V4: median days from sign-up to activation (first dashboard) of the window's sign-ups that activated within 30 days; stands in for time to paid (the data has no sign-up → payment timing). | A-20 | `0.0` |

### 3 Customers & revenue

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Paid Customers` | Σ paid_customers under the selected model (DDA default). | A-37 | `#,0` |
| `Paid Customers DDA` | Σ paid_customers under DDA (cohort basis, trial shortfall). | A-37 | `#,0.0` |
| `Paid Customers Platform` | Σ paid_customers claimed by the networks (PLATFORM). | A-43 | `#,0.0` |
| `New MRR` | Σ new_mrr_usd under the selected model. | A-39 | `$#,0` |
| `ARPA` | New MRR ÷ paid customers. | A-39 | `$#,0.00` |
| `New MRR Share` | Share of the scope's New MRR (O4). | A-52 | `0.0%` |

### 4 Unit economics

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `CPA` | Spend ÷ paid customers (selected model). | A-37 | `$#,0` |
| `Reported CPA` | Spend ÷ PLATFORM paid customers (the networks' claim). | A-43 | `$#,0` |
| `Modelled CPA` | Spend ÷ paid customers of the first-party model. | A-43 | `$#,0` |
| `Team Cost` | Paid-team cost of the window allocated by spend share. | A-38 | `$#,0` |
| `Paid CAC` | Spend ÷ paid customers (= CPA at the same scope). | A-38 | `$#,0` |
| `Blended CAC` | (Spend + allocated team cost) ÷ paid customers. | A-38 | `$#,0` |
| `Payback Months` | Blended CAC ÷ (ARPA × gross margin). | A-40 | `0.0` |
| `Churn Monthly` | Monthly logo churn, trailing 3 complete months. | A-41 | `0.00%` |
| `LTV` | ARPA × gross margin ÷ monthly churn. | A-41 | `$#,0` |
| `LTV CAC` | LTV ÷ blended CAC. | A-41 | `0.0` |
| `R90` | 3-month revenue multiple of the newest complete cohort (campaign → channel → ALL). | A-42 | `0.00` |
| `ROAS 90d` | New MRR × R90 ÷ spend. | A-42 | `0.00` |
| `Churned Customers` | Customers lost in the trailing 3 complete months to the window end (DDA credits; P6). | A-41 | `#,0` |

### 5 Guardrails

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Attribution Gap` | PLATFORM ÷ first-party paid customers − 1. | A-43 | `+0%;-0%;0%` |
| `Brand Share` | Brand campaign spend ÷ paid-search spend. | A-22 | `0.0%` |
| `Refund Rate` | Refunds ÷ cohort customers, 12 acquisition months to the window end. | A-22 | `0.0%` |
| `Retention Cohort Month` | Cohort month (yyyymm) behind the D7 / D30 guardrails. | A-22 | `0` |
| `D7 Retention` | D7 retention of the guardrail cohort month. | A-22 | `0.0%` |
| `D30 Retention` | D30 retention of the guardrail cohort month. | A-22 | `0.0%` |
| `Refunds` | Refunds of the cohorts acquired in the 12 months to the window end (DDA credits; P7). | A-22 | `#,0` |

### 8 Report

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Flags Colour` | Colour of the flag words: crit for a root cause or over-pacing, warn for underspent / view-through, good for on target, ink-2 for gates. | A-24 | `text` |
| `Movers Colour` | Good for a positive Δ ROAS, crit for a negative one. |  | `text` |
| `P4 Status Colour` | Colour of the creative status word. | A-54 | `text` |
| `Alert Glyph` | Severity glyph of a tripped alert (coloured by Alert Colour; A-25). |  | `text` |
| `Alert Colour` | Severity colour: crit / warn / accent (info) / good (OK). |  | `text` |
| `Alert Detail` | One-line detail of a tripped alert (O5). |  | `text` |
| `Alert Value Text` | Value text of a tripped alert (O5). |  | `text` |
| `Trend Spend` | Spend per day / week / month bucket of the window on the dim_date axis (O3). | A-52 | `$#,0` |
| `Trend Plan` | Plan per bucket (O3, dashed). | A-52 | `$#,0` |
| `Trend Spend Cmp` | Spend of the comparison period aligned to the window's buckets (O3, dotted; blank for Plan / None). | A-52 | `$#,0` |
| `Trend Paid CAC` | Paid CAC (spend ÷ paid customers, selected model) per bucket (O3 lower chart). | A-52 | `$#,0` |
| `Trend Paid` | Paid customers (selected model) per bucket. | A-52 | `#,0.0` |
| `Trend Spend Selected` | Daily spend of the selected campaign (P2 upper chart). | A-52 | `$#,0` |
| `Trend Paid Selected` | Daily paid conversions of the selected campaign (P2 lower chart). | A-52 | `#,0.0` |
| `Funnel Value` | True count of the funnel stage (O1). | A-52 | `#,0` |
| `Funnel Label` | Label beside the funnel bar: true count and the stage's rate or cost (O1). | A-52 | `text` |
| `Funnel Log` | Bar width of the funnel: log10 of the stage count; its format string prints the true-value label (ADR-0015 platform limit 8). | A-52 | `dynamic` |
| `Funnel Axis Max` | Value-axis end of the funnel: leaves room for the labels. |  | `0.00` |
| `O1 Caption` | O1 caption: trial → paid and click → sign-up with their Δ (pt) and the cost per paid customer (A-52). | A-52 | `text` |
| `C2 Web Rate` | Web stage conversion from the previous stage (C2): CTR, sessions ÷ clicks, sign-ups ÷ sessions, activation, trial, trial → paid. | A-53 | `0.0%` |
| `C2 App Rate` | App (iOS + Android) stage conversion from the previous stage (C2): CTR, store views ÷ clicks, installs ÷ store views, sign-ups ÷ installs, then activation, trial, trial → paid. | A-53 | `0.0%` |
| `C2 Caption` | C2 caption (A-53). | A-53 | `text` |
| `C3 Caption` | C3 caption: the scope's over-claim and the channel that over-claims most (A-53). | A-53 | `text` |
| `Pacing Colour` | C4 bar colour: crit above PACING_HI, warn below PACING_LO, neutral otherwise (AT-11). | A-53 | `text` |
| `C4 Label` | C4 bar label. |  | `text` |
| `C4 Pacing Bar` | Pacing as the C4 bar; its format string prints the label (spend of plan). | A-53 | `dynamic` |
| `C4 Question` | C4 question with the window day count (AT-11: day 30 of 30 for R30, day 3 of 30 for MTD Nov). | A-53 | `text` |
| `C4 Caption` | C4 caption. |  | `text` |
| `Channel Colour` | The channel's fixed colour (dim_channel.color_light, A-58). |  | `text` |
| `Channel Tint` | The channel colour mixed 55 % with white (O4 New-MRR bars, paired with the solid spend bars). |  | `text` |
| `O4 Caption` | O4 caption: the channel whose spend share most exceeds its New-MRR share (A-52). | A-52 | `text` |
| `O3 Caption` | O3 caption: spend vs plan and the CAC step day (A-52). | A-52 | `text` |
| `O5 Caption` | O5 caption. | A-52 | `text` |
| `O6 Caption` | O6 caption. | A-52 | `text` |
| `O2 Caption` | O2 caption. |  | `text` |
| `C1 Caption` | C1 caption. |  | `text` |
| `P1 Row Visible` | P1 and Campaigns-pane rows: Live + Learning by default; every status once Status is picked (A-12, AT-04, AT-22). |  | `0` |
| `P1 CPA` | CPA cell of the campaign table; — for Lead / Retention (A-54). |  | `dynamic` |
| `P1 ROAS` | ROAS 90 d cell of the campaign table; — for Lead / Retention (A-54). |  | `dynamic` |
| `P1 Spend` | Campaign-table cell: [Spend] for Live + Learning campaigns (every status once Status is picked; A-54, AT-04). |  | `$#,0` |
| `P1 Pacing` | Campaign-table cell: [Pacing] for Live + Learning campaigns (every status once Status is picked; A-54, AT-04). |  | `0%` |
| `P1 Slope` | Campaign-table cell: [CTR Slope 7d] for Live + Learning campaigns (every status once Status is picked; A-54, AT-04). |  | `+0%;-0%;0%` |
| `P1 Frequency` | Campaign-table cell: [Frequency 7d] for Live + Learning campaigns (every status once Status is picked; A-54, AT-04). |  | `0.0` |
| `P1 Flags` | Campaign-table cell: [Flags Text] for Live + Learning campaigns (every status once Status is picked; A-54, AT-04). |  | `text` |
| `P1 Caption` | P1 caption. |  | `text` |
| `P2 Title` | P2 title: the selected campaign (A-54). |  | `text` |
| `P2 Caption` | P2 caption: CPA vs target and the learning-phase end (A-54). |  | `text` |
| `P3 Caption` | P3 caption. |  | `text` |
| `P4 Caption` | P4 caption: the fatigue rule from param_target (A-54). |  | `text` |
| `P5 Caption` | P5 caption: keywords for search campaigns, placements for the others (AT-09). |  | `text` |
| `P4 Row Visible` | 1 for the selected campaign's creatives live on the window's last day (P4 rows). |  | `0` |
| `Chips Line` | Chips line: one segment per active non-default filter + 'Selected:' for a cross-filter, ' | ' as separator; blank with the defaults (A-14). | A-14 | `text` |
| `Period Pill Text` | Period pill: window dates and the comparison basis (A-50). | A-50 | `text` |
| `Synced Text` | Header freshness text: age of the oldest hourly source, whole hours (A-17). | A-17 | `text` |
| `Freshness Colour` | Freshness dot colour. |  | `text` |
| `Footer Line` | Footer strip: model, currency, last sync per source (A-50). | A-50 | `text` |
| `Filters Button Text` | Filters button label with the active-count badge (A-50). |  | `text` |
| `Info Glyph` | The ⓘ glyph of every card (hover target for tt_card_info, A-51). |  | `text` |
| `Card Info Title` | ⓘ pop-up: card title. |  | `text` |
| `Card Info What` | ⓘ pop-up: what the card shows. |  | `text` |
| `Card Info Formula` | ⓘ pop-up: formula. |  | `text` |
| `Card Info Note` | ⓘ pop-up: note + the window and model in use (A-16: every ⓘ of an affected card names the model). |  | `text` |
| `O5 Channel` | O5 cell: channel of the listed campaign. |  | `text` |
| `O5 Paid Now` | O5 cell: paid customers in the movers window (selected model). |  | `#,0` |
| `O5 Paid Before` | O5 cell: paid customers in the comparison window of the movers window. |  | `#,0` |
| `O5 Delta` | O5 cell: Δ paid customers, absolute (one decimal: DDA credits are fractional). |  | `+#,0.0;-#,0.0;0.0` |
| `O5 Colour` | O5 Δ colour: good for a gain, crit for a loss. |  | `text` |
| `O5 Alert` | O5 cell: title of the most severe campaign alert that trips on the listed campaign over the movers window (_Mv Start .. window end; param_alert_rule; blank when none). | A-64 | `text` |
| `O6 Bar` | O6 bar: size of the Δ ROAS (absolute ROAS points); the format string puts the sign back (+ for Top 5, − for Worst 5). | A-52 | `dynamic` |
| `O6 Colour` | O6 bar colour: good for Top 5, crit for Worst 5. |  | `text` |
| `P6 Churned` | P6 bar: churned customers of the top-5 channels (absolute). |  | `#,0` |
| `P7 Refunds` | P7 bar: refunds of the top-5 channels (absolute). |  | `#,0` |
| `K1 Heat` | K1 heatmap cell: cumulative payback of the acquisition month (row) at the month since acquisition (column), months 0 .. 11 (A-56). | A-56 | `0%` |
| `K1 Heat Colour` | K1 cell fill: one hue (accent), darker = closer to payback; good green once paid back (≥ 100 %). |  | `text` |
| `K1 Heat Ink` | K1 cell text colour on the fill. |  | `text` |
| `Payback Target` | The 12-month payback line of K6 (param_target PAYBACK_MONTHS). |  | `0` |
| `Paid Customers CAC Bar` | C5 / C6 bar: paid customers of the channel; the format string prints the label 'count / $CAC'. | A-53 | `dynamic` |
| `J1 Bounce` | J1 bounce cell; — on store pages (A-55). |  | `dynamic` |
| `J1 LCP` | J1 LCP cell in ms; — on store pages (A-55). |  | `dynamic` |
| `J1 Caption` | J1 caption: store-page CVR now and in the previous period (the story: flat, so the leak is pre-click). | A-55 | `text` |
| `J2 Colour` | J2 bar colour: crit on the largest drop, accent otherwise. |  | `text` |
| `J2 Caption` | J2 caption: the largest drop in pt (A-55). | A-55 | `text` |
| `J3 Colour` | J3 bar colour: accent on the median bin. |  | `text` |
| `J3 Caption` | J3 caption (A-55). | A-55 | `text` |
| `J4 Colour` | J4 bar colour: warn under the 40 % reference. |  | `text` |
| `J4 Caption` | J4 caption: lowest vs highest segment (A-55). | A-55 | `text` |
| `K1 Payback` | K1 line value: payback curve of the six shown cohorts (A-56). | A-56 | `0%` |
| `K1 Paid Back Line` | The 100 % paid-back reference. |  | `0%` |
| `K1 Caption` | K1 caption: the latest shown cohort that has paid back, and its month (A-56; LAL2 scope: month 9). | A-56 | `text` |
| `K5 Customers` | K5 cell: [Cohort Customers] for the 12 acquisition months to the window's end month (A-56). | A-56 | `#,0` |
| `K5 ARPA` | K5 cell: [Cohort ARPA] for the 12 acquisition months to the window's end month (A-56). | A-56 | `$#,0` |
| `K5 CAC` | K5 cell: [Cohort CAC] for the 12 acquisition months to the window's end month (A-56). | A-56 | `$#,0` |
| `K5 Refund Rate` | K5 cell: [Cohort Refund Rate] for the 12 acquisition months to the window's end month (A-56). | A-56 | `0.0%` |
| `K5 Payback Month` | K5 cell: [Cohort Payback Month] for the 12 acquisition months to the window's end month (A-56). | A-56 | `0` |
| `K5 Caption` | K5 caption. |  | `text` |
| `K3 Cell` | K3 retention cell for the latest six acquisition months (A-56); blank where not reportable. | A-56 | `0%` |
| `K3 Cell Colour` | K3 cell fill: one hue (accent), darker = higher (A-56). |  | `text` |
| `K3 Cell Ink` | K3 cell text colour on the fill. |  | `text` |
| `K3 Caption` | K3 caption: the guardrail pair (A-56). |  | `text` |
| `K2 Target` | The 3:1 LTV:CAC floor (param_target LTV_CAC). |  | `0.0` |
| `K2 Caption` | K2 caption (A-56). |  | `text` |
| `K4 Caption` | K4 caption (A-56). |  | `text` |

### 8 Report\Dynamics

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Dyn Spend` | Spend per day of the dynamics window (the selected period, or its last 30 days when longer than 90). | A-20 | `$#,0` |
| `Dyn Spend LY` | Spend of the same day one year back (dashed line). | A-20 | `$#,0` |
| `Dyn Spend Last` | Spend on the last day only (marker + value label). | A-20 | `$#,0` |
| `Dyn New Clients` | Sign-ups per day of the dynamics window (the selected period, or its last 30 days when longer than 90). | A-20 | `#,0` |
| `Dyn New Clients LY` | Sign-ups of the same day one year back (dashed line). | A-20 | `#,0` |
| `Dyn New Clients Last` | Sign-ups on the last day only (marker + value label). | A-20 | `#,0` |
| `Dyn Conversion` | Paid customers ÷ sign-ups per day of the dynamics window (the selected period, or its last 30 days when longer than 90). | A-20 | `0.0%` |
| `Dyn Conversion LY` | Paid customers ÷ sign-ups of the same day one year back (dashed line). | A-20 | `0.0%` |
| `Dyn Conversion Last` | Paid customers ÷ sign-ups on the last day only (marker + value label). | A-20 | `0.0%` |
| `Dyn Time to Activation` | Median days from sign-up to activation per day of the dynamics window (the selected period, or its last 30 days when longer than 90). | A-20 | `0.0` |
| `Dyn Time to Activation LY` | Median days from sign-up to activation of the same day one year back (dashed line). | A-20 | `0.0` |
| `Dyn Time to Activation Last` | Median days from sign-up to activation on the last day only (marker + value label). | A-20 | `0.0` |
| `Dyn CAC` | Paid CAC per day of the dynamics window (the selected period, or its last 30 days when longer than 90). | A-20 | `$#,0` |
| `Dyn CAC LY` | Paid CAC of the same day one year back (dashed line). | A-20 | `$#,0` |
| `Dyn CAC Last` | Paid CAC on the last day only (marker + value label). | A-20 | `$#,0` |
| `Dyn ROAS` | ROAS 90 d per day of the dynamics window (the selected period, or its last 30 days when longer than 90). | A-20 | `0.00` |
| `Dyn ROAS LY` | ROAS 90 d of the same day one year back (dashed line). | A-20 | `0.00` |
| `Dyn ROAS Last` | ROAS 90 d on the last day only (marker + value label). | A-20 | `0.00` |

### 6 Diagnostics\Journey

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Page Visits` | Sessions (web pages) or store views (store pages) of the page in context (J1). | A-55 | `#,0` |
| `Page CVR` | Page CVR of the window (J1, A-46). | A-55 | `0.0%` |
| `Page Bounce Rate` | Bounce rate of the window (web pages). | A-55 | `0.0%` |
| `Page LCP` | Sessions-weighted LCP (ms) of the window (web pages). | A-55 | `#,0` |
| `Step Share` | Onboarding step share of sign-ups in the window (J2). | A-55 | `0%` |
| `Act Bin Count` | Activations of the time bin in the window (J3). | A-55 | `#,0` |
| `Act Share` | Time-bin share of the window's activations within 30 days (J3). | A-55 | `0.0%` |
| `Act Median Hours` | Median hours from sign-up to activation in the window (J3). | A-55 | `0` |
| `Segment Signups` | Sign-ups of the platform segment in the window (J4). | A-55 | `#,0` |
| `Segment Activation` | 7-day activation rate of the platform segment in the window (J4). | A-55 | `0.0%` |
| `J2 Largest Drop Step` | Step with the largest drop from the previous step (J2 highlight; story: Connect data source). | A-55 | `text` |
| `J3 Median Bin` | Time bin that holds the median (J3 emphasis). | A-55 | `text` |
| `J4 Target` | The 40 % activation reference (param_target ACTIVATION_7D). |  | `0%` |

### 6 Diagnostics\Cohorts

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `Cohort Customers` | Paid customers of the acquisition month (offset-0 customers_start, DDA credits). | A-48 | `#,0` |
| `Cohort ARPA` | Offset-0 revenue ÷ cohort customers (A-48). | A-48 | `$#,0` |
| `Cohort Cost` | Spend of the acquisition month + the month's team cost allocated by spend share (A-48). | A-48 | `$#,0` |
| `Cohort CAC` | Cohort blended CAC: cohort cost ÷ cohort customers (A-48). | A-48 | `$#,0` |
| `Cohort Refund Rate` | Σ refund_count (all offsets) ÷ cohort customers (A-48). | A-48 | `0.0%` |
| `Cohort Payback At` | Payback curve value at the offset in context: Σ (revenue − refunds) to that offset × gross margin ÷ cohort cost (A-48). | A-48 | `0%` |
| `Cohort Payback Month` | First month offset where the payback curve reaches 100 % (A-48). | A-48 | `0` |
| `Cohort Retention` | users_active ÷ users_matured of the acquisition month at the day N in context; blank where not reportable (A-48, A-74). | A-48 | `0%` |

### 8 Report\SVG

| Measure | Definition | Spec | Format |
|---|---|---|---|
| `O4 Shares SVG` | O4: per channel, share of spend (solid bar, channel colour) and share of New MRR (tinted bar), both on one scale (A-52; field-value colours do not reach multi-series bars, so the card is drawn). | A-52 | `image URL` |
| `O7 Spend Customers SVG` | O7: per channel, spend and paid customers (selected model) on two aligned bar columns, each on its own scale, channel colours, absolute labels (A-52; redesign round 1 pass 2 replaces O4). | A-52 | `image URL` |
| `O1 Funnel SVG` | O1 acquisition funnel: seven stages, bar width = log10 of the count ([Funnel Log]), the absolute count at the right edge (ADR-0015 platform limit 8, A-52; redesign round 1: no rate / cost labels). | A-52 | `image URL` |
| `Vital V1 SVG` | Vitals tile V1 (Spend): value, Δ vs the same period last year (arrow + direction-aware colour), last year's value as the sub-line (A-20 amended 2026-11-04; no target, no sparkline). | A-20 | `image URL` |
| `Vital V2 SVG` | Vitals tile V2 (New Clients): value, Δ vs the same period last year (arrow + direction-aware colour), last year's value as the sub-line (A-20 amended 2026-11-04; no target, no sparkline). | A-20 | `image URL` |
| `Vital V3 SVG` | Vitals tile V3 (Conversion Into Paid): value, Δ vs the same period last year (arrow + direction-aware colour), last year's value as the sub-line (A-20 amended 2026-11-04; no target, no sparkline). | A-20 | `image URL` |
| `Vital V4 SVG` | Vitals tile V4 (Time To Activation): value, Δ vs the same period last year (arrow + direction-aware colour), last year's value as the sub-line (A-20 amended 2026-11-04; no target, no sparkline). | A-20 | `image URL` |
| `Vital V5 SVG` | Vitals tile V5 (Cac): value, Δ vs the same period last year (arrow + direction-aware colour), last year's value as the sub-line (A-20 amended 2026-11-04; no target, no sparkline). | A-20 | `image URL` |
| `Vital V6 SVG` | Vitals tile V6 (Roas 90 D): value, Δ vs the same period last year (arrow + direction-aware colour), last year's value as the sub-line (A-20 amended 2026-11-04; no target, no sparkline). | A-20 | `image URL` |
| `O2 Guardrails SVG` | O2 guardrails: name, meter (value against 2 × target, marker = target), target and value coloured by the verdict (A-22). | A-22 | `image URL` |
| `Header Period SVG` | Period pill: window dates and comparison basis (opens the Filters window on Period; A-50). | A-50 | `image URL` |
| `Header Filters SVG` | Filters button face with the active-count badge (A-50). | A-50 | `image URL` |
| `Header Freshness SVG` | Freshness dot (green / amber / red per source thresholds) + 'Synced n h ago' (A-17). | A-17 | `image URL` |
| `Filters Applied SVG` | Right rail of the Filters window: the applied state of every group and the campaigns / channels / platforms in scope (A-57; replaces the spec's live preview). | A-57 | `image URL` |

## Hidden engine measures

| Measure | Definition |
|---|---|
| `_As Of` | Last complete day of the dataset (manifest as_of_date); anchors every window (A-03, A-81). Never TODAY(). |
| `_Refreshed` | Refresh stamp of the dataset (manifest refreshed; A-17). |
| `_Preset` | Picked period preset; 30 d when nothing is picked (A-10). |
| `_Win End` | Last day of the window: the as-of day, or the To date of a Custom range (A-10). |
| `_Win Start` | First day of the window: 7 d, 30 d, MTD, QTD from the window end, or the From date of a Custom range (A-10, AT-03). |
| `_Win Days` | Days in the window. |
| `_Cmp` | Comparison mode; Previous period when nothing is picked (A-11). |
| `_Granularity` | Trend granularity; Day when nothing is picked (A-10). |
| `_Model` | Selected attribution model; Data-driven when nothing is selected (A-16, AT-06). |
| `_Model Name` | Name of the selected attribution model (Data-driven by default). |
| `_Model FP` | First-party model for the attribution gap and modelled CPA: the selected model, DDA when Platform-reported is picked (A-43). |
| `_GM` | Gross margin (param_finance GROSS_MARGIN_PCT, latest valid-from; A-40, ADR-0015 §5 q 3). |
| `_T ROAS` | param_target ALL / ROAS (A-75: thresholds live in param_target only). |
| `_T ROAS_SCALE` | param_target ALL / ROAS_SCALE (A-75: thresholds live in param_target only). |
| `_T PAID_CUSTOMERS_30D` | param_target ALL / PAID_CUSTOMERS_30D (A-75: thresholds live in param_target only). |
| `_T BLENDED_CAC` | param_target ALL / BLENDED_CAC (A-75: thresholds live in param_target only). |
| `_T PAYBACK_MONTHS` | param_target ALL / PAYBACK_MONTHS (A-75: thresholds live in param_target only). |
| `_T LTV_CAC` | param_target ALL / LTV_CAC (A-75: thresholds live in param_target only). |
| `_T TRIAL_TO_PAID` | param_target ALL / TRIAL_TO_PAID (A-75: thresholds live in param_target only). |
| `_T ACTIVATION_7D` | param_target ALL / ACTIVATION_7D (A-75: thresholds live in param_target only). |
| `_T D7_RETENTION` | param_target ALL / D7_RETENTION (A-75: thresholds live in param_target only). |
| `_T D30_RETENTION` | param_target ALL / D30_RETENTION (A-75: thresholds live in param_target only). |
| `_T REFUND_RATE` | param_target ALL / REFUND_RATE (A-75: thresholds live in param_target only). |
| `_T BRAND_SHARE` | param_target ALL / BRAND_SHARE (A-75: thresholds live in param_target only). |
| `_T ATTR_GAP` | param_target ALL / ATTR_GAP (A-75: thresholds live in param_target only). |
| `_T ATTR_GAP_WIDEN_PT` | param_target ALL / ATTR_GAP_WIDEN_PT (A-75: thresholds live in param_target only). |
| `_T PACING_LO` | param_target ALL / PACING_LO (A-75: thresholds live in param_target only). |
| `_T PACING_HI` | param_target ALL / PACING_HI (A-75: thresholds live in param_target only). |
| `_T SPEND_PLAN_TOL` | param_target ALL / SPEND_PLAN_TOL (A-75: thresholds live in param_target only). |
| `_T CPA_OVER_TOL` | param_target ALL / CPA_OVER_TOL (A-75: thresholds live in param_target only). |
| `_T FATIGUE_SLOPE` | param_target ALL / FATIGUE_SLOPE (A-75: thresholds live in param_target only). |
| `_T FATIGUE_FREQ` | param_target ALL / FATIGUE_FREQ (A-75: thresholds live in param_target only). |
| `_T FREQ_HIGH` | param_target ALL / FREQ_HIGH (A-75: thresholds live in param_target only). |
| `_T WATCH_FREQ` | param_target ALL / WATCH_FREQ (A-75: thresholds live in param_target only). |
| `_T VIEW_THROUGH_RATIO` | param_target ALL / VIEW_THROUGH_RATIO (A-75: thresholds live in param_target only). |
| `_T INSTALL_QUALITY_PT` | param_target ALL / INSTALL_QUALITY_PT (A-75: thresholds live in param_target only). |
| `_T WARN_BAND_REL` | param_target ALL / WARN_BAND_REL (A-75: thresholds live in param_target only). |
| `_Is Campaign Scope` | TRUE when the scope is one picked campaign (campaign flags and targets); FALSE for channel or wider scopes. |
| `_b Spend` | Σ spend_usd in the date context (A-30). |
| `_b Impressions` | Σ impressions in the date context. |
| `_b Clicks` | Σ clicks in the date context. |
| `_b Paid Credits Delivery` | Σ paid_customers_dda (DDA credits split over creatives by clicks; data README D-4): the ad-set CPA source (P3). |
| `_b Plan` | Plan of the days in the date context: Σ budget_usd × overlapping days ÷ days_in_month (A-31). |
| `_b Sessions` | Σ web sessions. |
| `_b Store Views` | Σ store-page views. |
| `_b Installs` | Σ installs. |
| `_b First Opens` | Σ first opens. |
| `_b Signups` | Σ sign-ups (fact_funnel_day; = Σ fact_traffic_day signups, AT-05). |
| `_b Activated` | Σ first dashboard within 7 days of sign-up (A-35). |
| `_b Trials` | Σ trials. |
| `_b Web Clicks` | Clicks of web campaigns. |
| `_b Web Signups` | Sign-ups of web campaigns. |
| `_b Mobile Clicks` | Clicks of iOS and Android campaigns. |
| `_b Mobile Signups` | Sign-ups of iOS and Android campaigns. |
| `_b Paid` | Σ paid_customers under _Model (A-37; the model switch applies to paid customers and New MRR only, A-16). |
| `_b Paid FP` | Σ paid_customers under _Model FP (A-37; the model switch applies to paid customers and New MRR only, A-16). |
| `_b Paid DDA` | Σ paid_customers under "DDA" (A-37; the model switch applies to paid customers and New MRR only, A-16). |
| `_b Paid Platform` | Σ paid_customers under "PLATFORM" (A-37; the model switch applies to paid customers and New MRR only, A-16). |
| `_b New MRR` | Σ new_mrr_usd under _Model (A-39). |
| `_b New MRR DDA` | Σ new_mrr_usd under "DDA" (A-39). |
| `_b Spend All` | Spend of every campaign in the date context (team-cost allocation base, A-38). |
| `_b Team Pool` | Paid-team cost of the days in the date context: Σ monthly cost (valid row) ÷ days in month (A-38, data README D-2). |
| `_b Team Cost` | Team cost allocated to the scope pro rata to its share of the ALL spend (A-38). |
| `_b Term Spend` | Σ term spend. |
| `_b Term Clicks` | Σ term clicks. |
| `_b Term Impressions` | Σ term impressions. |
| `_b Term Signups` | Σ term sign-ups. |
| `_x Pacing` | Spend ÷ plan (A-31). |
| `_x CTR` | Clicks ÷ impressions (A-32). |
| `_x CPC` | Spend ÷ clicks. |
| `_x CPM` | Spend ÷ impressions × 1000. |
| `_x Web Land Rate` | Web sessions ÷ clicks of web campaigns (A-33). |
| `_x Store CVR` | Installs ÷ store views. |
| `_x Install Signup Rate` | Sign-ups of mobile campaigns ÷ installs. |
| `_x Landing Signup Rate` | Sign-ups of web campaigns ÷ sessions. |
| `_x Landed` | Web sessions + installs. |
| `_x Click Signup Rate` | Sign-ups ÷ clicks (A-34). |
| `_x CPL` | Spend ÷ sign-ups. |
| `_x Activation Rate` | Activated ÷ sign-ups (A-35). |
| `_x Cost per Activated` | Spend ÷ activated. |
| `_x Trial Rate` | Trials ÷ sign-ups (A-36). |
| `_x Trial to Paid` | Paid customers (selected model) ÷ trials (A-36). |
| `_x CPA` | Spend ÷ paid customers (A-37). |
| `_x Reported CPA` | Spend ÷ PLATFORM paid customers (A-43). |
| `_x Modelled CPA` | Spend ÷ paid customers of the first-party model (A-43). |
| `_x Blended CAC` | (Spend + allocated team cost) ÷ paid customers (A-38). |
| `_x ARPA` | New MRR ÷ paid customers (A-39). |
| `_x Payback Months` | Blended CAC ÷ (ARPA × gross margin) (A-40). |
| `_x Month Index End` | Month index (0 = 2025-01) of the last day in the date context. |
| `_x Last Complete Month` | Last complete calendar month at the end of the date context (data README Churn / R90). |
| `_x Churn` | Monthly logo churn: Σ churned ÷ Σ customers_start, offsets ≥ 1 whose calendar month is in the trailing 3 complete months (A-41). |
| `_x LTV` | ARPA × gross margin ÷ monthly churn (A-41). |
| `_x LTV CAC` | LTV ÷ blended CAC (A-41). |
| `_x R90 Own` | R90 over the campaigns in context that have the cohort: Σ revenue offsets 0-2 ÷ revenue offset 0 of the newest cohort month m with m + 2 ≤ the last complete month (A-42). |
| `_x R90` | R90 with the fallback campaign → channel → ALL (A-42). |
| `_x ROAS 90d` | New MRR × R90 ÷ spend (A-42). |
| `_x Attribution Gap` | PLATFORM paid customers ÷ first-party paid customers − 1 (A-43). |
| `_x Brand Share` | Spend of brand campaigns ÷ spend of the scope's paid-search campaigns (data README Brand share). |
| `_x Refund Rate` | Σ refund_count ÷ Σ customers_start (offset 0) over the 12 acquisition months ending with the window's end month (data README Refund rate). |
| `_x Retention Month Index` | Latest cohort month whose D30 cell is reportable at the window end (month start + 44 days ≤ end; data README D7 / D30). |
| `_x Retention Cohort Month` | The guardrail cohort month as yyyymm. |
| `_x D7 Retention` | users_active ÷ users_matured at day 7 of the guardrail cohort month (A-22). |
| `_x D30 Retention` | users_active ÷ users_matured at day 30 of the guardrail cohort month (A-22). |
| `_x CTR Last 7` | CTR of the last 7 days of the date context (creative CTR 7 d, A-44). |
| `_x CTR Slope Raw` | CTR of the last 7 days ÷ CTR of the 7 days before − 1 (A-44). |
| `_x Frequency Raw` | Σ impressions of the last 7 days ÷ Σ reach_7d on the last day (A-44; reach_7d is point in time). |
| `_x Window Long Enough` | TRUE when the window has 14 days or more (frequency and slope need two 7-day blocks). |
| `_x Frequency 7d` | Frequency (7-day) at the window end; windows of 14 days or more (A-44). |
| `_x CTR Slope 7d` | CTR 7-day slope at the window end; windows of 14 days or more (A-44). |
| `_x Install Quality Delta` | Install → sign-up of the window's last 7 days − the previous period's (data README D-6). |
| `_Mv Start` | Movers window start (O5 / O6, 2026-11-05): the window's start, or its last 30 days when the comparison window would start before the first day of data (e.g. Custom from Jan 1 2025: no previous period, a partial last year). |
| `_Worst Mover Key` | Campaign with the lowest Δ ROAS in the scope. |
| `_Top Spender Key` | Campaign with the most spend in the scope (fallback selection). |
| `_Selected Campaign` | Selected campaign of the Campaigns view: the one clicked (or filtered to), else the worst mover of the window (A-54, AT-09). |
| `_Creative Live` | TRUE when the creative in context has delivery on the window's last day (P4 rows). |
| `_Source Age H` | Hours between the refresh stamp and the source's last sync (one source in context). |
| `P1 No Goal` | TRUE for Lead and Retention objectives (CPA / ROAS shown as —). |
| `_Filter Count` | Active non-period filter groups (Filters badge). |
| `Applied State` | Applied state of the Filters window as '/'-separated lines (PATHITEM); a divider inside a line is written '¦' and drawn as '/' by the SVG (A-57: shown instead of a live preview). |
| `_O5 Rank Mode` | O5 switch: WORST (default, nothing picked) or TOP. |
| `_O6 Rank Mode` | O6 switch: WORST (default, nothing picked) or TOP. |
| `_x Churned` | Σ churned, months since acquisition ≥ 1 whose calendar month is in the trailing 3 complete months (numerator of monthly churn, A-41). |
| `_x Refunds` | Σ refund_count of the cohorts acquired in the 12 months ending with the window's end month (numerator of the refund rate). |
| `_K1 Heat Month` | TRUE for the 12 acquisition months before the window's end month (K1 heatmap rows). |
| `_b Traffic Signups` | Σ fact_traffic_day sign-ups (page-level sign-ups, J1). |
| `_b Bounces` | Σ bounces (web pages). |
| `_b LCP Weighted` | Σ lcp_ms_p75 × sessions (sessions-weighted LCP numerator, A-46). |
| `_x Page CVR` | Page CVR: installs ÷ store views on store pages, page sign-ups ÷ sessions on web pages (A-46). |
| `_x Page Bounce Rate` | Bounces ÷ sessions (web pages). |
| `_x Page LCP` | Sessions-weighted mean of the daily p75 LCP in ms (web pages). |
| `_x Step Share` | Onboarding step completion ÷ sign-ups for the step in context (A-47). |
| `_b Act Bin` | Activations in the sign-up → activation time bin in context (A-47). |
| `_b Act Total` | Activations within 30 days (Σ the seven bins). |
| `_x Act Share` | Bin share of the activations within 30 days (A-47). |
| `_x Act Median Hours` | Median hours from sign-up to activation: linear interpolation inside the median bin, edges 0/1/6/24/48/96/168/720 h (A-47). |
| `_x Segment Signups` | Σ sign-ups of the platform segment(s) in context (J4). |
| `_x Segment Activation` | Σ activated_7d ÷ Σ sign-ups of the platform segment(s) in context (A-47). |
| `_J1 Store` | TRUE on a store-page row. |
| `_Cohort End Index` | Month index of the window's end month (cohort cards list acquisition months up to it). |
| `_K1 Cohort Shown` | TRUE for the six K1 cohorts: every other month back from the window's end month − 3 (A-56). |
| `_K12 Month` | TRUE for the 12 acquisition months ending with the window's end month (K5). |
| `_K3 Last Cohort` | Latest acquisition month with a retention cell, up to the window end (K3 rows). |

## DAX

Every measure body as it is in `ACME Marketing.SemanticModel/definition/tables/_measures.tmdl`.

### `_As Of`

```dax
_As Of =
MAX ( meta_dataset[as_of_date] )
```

### `_Refreshed`

```dax
_Refreshed =
MAX ( meta_dataset[refreshed] )
```

### `_Preset`

```dax
_Preset =
SELECTEDVALUE ( param_period_preset[preset_code], "30D" )
```

### `_Win End`

```dax
_Win End =
VAR _as_of        = [_As Of]
VAR _custom_end   = MAX ( param_date[date] )
RETURN
    IF ( [_Preset] = "CUSTOM", MIN ( _custom_end, _as_of ), _as_of )
```

### `_Win Start`

```dax
_Win Start =
VAR _end          = [_Win End]
VAR _preset       = [_Preset]
RETURN
    SWITCH (
        _preset
        ,"7D"
            ,_end - 6
        ,"MTD"
            ,DATE ( YEAR ( _end ), MONTH ( _end ), 1 )
        ,"QTD"
            ,DATE ( YEAR ( _end ), ( QUARTER ( _end ) - 1 ) * 3 + 1, 1 )
        ,"CUSTOM"
            ,MIN ( param_date[date] )
        ,_end - 29
    )
```

### `_Win Days`

```dax
_Win Days =
INT ( [_Win End] - [_Win Start] ) + 1
```

### `_Cmp`

```dax
_Cmp =
SELECTEDVALUE ( param_comparator[comparator_code], "PREV" )
```

### `_Granularity`

```dax
_Granularity =
SELECTEDVALUE ( param_granularity[granularity_code], "DAY" )
```

### `_Model`

```dax
_Model =
SELECTEDVALUE ( dim_attribution_model[model_code], "DDA" )
```

### `_Model Name`

```dax
_Model Name =
VAR _model        = [_Model]
RETURN
    CALCULATE (
        SELECTEDVALUE ( dim_attribution_model[model_name] )
        ,REMOVEFILTERS ( dim_attribution_model )
        ,dim_attribution_model[model_code] = _model
    )
```

### `_Model FP`

```dax
_Model FP =
VAR _model        = [_Model]
RETURN
    IF ( _model = "PLATFORM", "DDA", _model )
```

### `_GM`

```dax
_GM =
VAR _as_of        = [_As Of]
RETURN
    MAXX (
        TOPN (
            1
            ,FILTER (
                param_finance
                ,param_finance[metric_code] = "GROSS_MARGIN_PCT"
                    && param_finance[valid_from] <= _as_of
            )
            ,param_finance[valid_from], DESC
        )
        ,param_finance[value]
    )
```

### `_T ROAS`

```dax
_T ROAS =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "ROAS"
)
```

### `_T ROAS_SCALE`

```dax
_T ROAS_SCALE =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "ROAS_SCALE"
)
```

### `_T PAID_CUSTOMERS_30D`

```dax
_T PAID_CUSTOMERS_30D =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "PAID_CUSTOMERS_30D"
)
```

### `_T BLENDED_CAC`

```dax
_T BLENDED_CAC =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "BLENDED_CAC"
)
```

### `_T PAYBACK_MONTHS`

```dax
_T PAYBACK_MONTHS =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "PAYBACK_MONTHS"
)
```

### `_T LTV_CAC`

```dax
_T LTV_CAC =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "LTV_CAC"
)
```

### `_T TRIAL_TO_PAID`

```dax
_T TRIAL_TO_PAID =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "TRIAL_TO_PAID"
)
```

### `_T ACTIVATION_7D`

```dax
_T ACTIVATION_7D =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "ACTIVATION_7D"
)
```

### `_T D7_RETENTION`

```dax
_T D7_RETENTION =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "D7_RETENTION"
)
```

### `_T D30_RETENTION`

```dax
_T D30_RETENTION =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "D30_RETENTION"
)
```

### `_T REFUND_RATE`

```dax
_T REFUND_RATE =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "REFUND_RATE"
)
```

### `_T BRAND_SHARE`

```dax
_T BRAND_SHARE =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "BRAND_SHARE"
)
```

### `_T ATTR_GAP`

```dax
_T ATTR_GAP =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "ATTR_GAP"
)
```

### `_T ATTR_GAP_WIDEN_PT`

```dax
_T ATTR_GAP_WIDEN_PT =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "ATTR_GAP_WIDEN_PT"
)
```

### `_T PACING_LO`

```dax
_T PACING_LO =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "PACING_LO"
)
```

### `_T PACING_HI`

```dax
_T PACING_HI =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "PACING_HI"
)
```

### `_T SPEND_PLAN_TOL`

```dax
_T SPEND_PLAN_TOL =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "SPEND_PLAN_TOL"
)
```

### `_T CPA_OVER_TOL`

```dax
_T CPA_OVER_TOL =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "CPA_OVER_TOL"
)
```

### `_T FATIGUE_SLOPE`

```dax
_T FATIGUE_SLOPE =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "FATIGUE_SLOPE"
)
```

### `_T FATIGUE_FREQ`

```dax
_T FATIGUE_FREQ =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "FATIGUE_FREQ"
)
```

### `_T FREQ_HIGH`

```dax
_T FREQ_HIGH =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "FREQ_HIGH"
)
```

### `_T WATCH_FREQ`

```dax
_T WATCH_FREQ =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "WATCH_FREQ"
)
```

### `_T VIEW_THROUGH_RATIO`

```dax
_T VIEW_THROUGH_RATIO =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "VIEW_THROUGH_RATIO"
)
```

### `_T INSTALL_QUALITY_PT`

```dax
_T INSTALL_QUALITY_PT =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "INSTALL_QUALITY_PT"
)
```

### `_T WARN_BAND_REL`

```dax
_T WARN_BAND_REL =
CALCULATE (
    MAX ( param_target[target_value] )
    ,param_target[scope_type] = "ALL"
    ,param_target[metric_code] = "WARN_BAND_REL"
)
```

### `_Is Campaign Scope`

```dax
_Is Campaign Scope =
HASONEVALUE ( dim_campaign[campaign_key] )
    && (
        ISFILTERED ( dim_campaign[campaign_key] )
            || ISFILTERED ( dim_campaign[campaign_label] )
            || ISFILTERED ( dim_campaign[campaign_name] )
    )
```

### `CPA Target`

```dax
CPA Target =
VAR _campaign     = SELECTEDVALUE ( dim_campaign[cpa_target_usd] )
VAR _channel      = SELECTEDVALUE ( dim_campaign[channel_code] )
VAR _by_channel   =
    CALCULATE (
        MAX ( param_target[target_value] )
        ,param_target[scope_type] = "CHANNEL"
        ,param_target[scope_code] = _channel
        ,param_target[metric_code] = "CPA"
    )
RETURN
    IF ( [_Is Campaign Scope], _campaign, _by_channel )
```

### `_b Spend`

```dax
_b Spend =
SUM ( fact_ad_delivery_day[spend_usd] )
```

### `_b Impressions`

```dax
_b Impressions =
SUM ( fact_ad_delivery_day[impressions] )
```

### `_b Clicks`

```dax
_b Clicks =
SUM ( fact_ad_delivery_day[clicks] )
```

### `_b Paid Credits Delivery`

```dax
_b Paid Credits Delivery =
SUM ( fact_ad_delivery_day[paid_customers_dda] )
```

### `_b Plan`

```dax
_b Plan =
VAR _start        = MIN ( dim_date[date] )
VAR _end          = MAX ( dim_date[date] )
RETURN
    SUMX (
        FILTER (
            ALL ( dim_month )
            ,dim_month[month_start] <= _end
                && EOMONTH ( dim_month[month_start], 0 ) >= _start
        )
        ,VAR _month_start  = dim_month[month_start]
         VAR _overlap      = INT ( MIN ( _end, EOMONTH ( _month_start, 0 ) ) - MAX ( _start, _month_start ) ) + 1
         RETURN
            CALCULATE ( SUM ( fact_budget_month[budget_usd] ) ) * _overlap / dim_month[days_in_month]
    )
```

### `_b Sessions`

```dax
_b Sessions =
SUM ( fact_traffic_day[sessions] )
```

### `_b Store Views`

```dax
_b Store Views =
SUM ( fact_traffic_day[store_views] )
```

### `_b Installs`

```dax
_b Installs =
SUM ( fact_traffic_day[installs] )
```

### `_b First Opens`

```dax
_b First Opens =
SUM ( fact_traffic_day[first_opens] )
```

### `_b Signups`

```dax
_b Signups =
SUM ( fact_funnel_day[signups] )
```

### `_b Activated`

```dax
_b Activated =
SUM ( fact_funnel_day[step_first_dashboard] )
```

### `_b Trials`

```dax
_b Trials =
SUM ( fact_funnel_day[trials] )
```

### `_b Web Clicks`

```dax
_b Web Clicks =
CALCULATE ( [_b Clicks], KEEPFILTERS ( dim_platform[platform_code] = "WEB" ) )
```

### `_b Web Signups`

```dax
_b Web Signups =
CALCULATE ( [_b Signups], KEEPFILTERS ( dim_platform[platform_code] = "WEB" ) )
```

### `_b Mobile Clicks`

```dax
_b Mobile Clicks =
CALCULATE ( [_b Clicks], KEEPFILTERS ( dim_platform[platform_code] <> "WEB" ) )
```

### `_b Mobile Signups`

```dax
_b Mobile Signups =
CALCULATE ( [_b Signups], KEEPFILTERS ( dim_platform[platform_code] <> "WEB" ) )
```

### `_b Paid`

```dax
_b Paid =
CALCULATE (
    SUM ( fact_attribution_day[paid_customers] )
    ,TREATAS ( { [_Model] }, dim_attribution_model[model_code] )
)
```

### `_b Paid FP`

```dax
_b Paid FP =
CALCULATE (
    SUM ( fact_attribution_day[paid_customers] )
    ,TREATAS ( { [_Model FP] }, dim_attribution_model[model_code] )
)
```

### `_b Paid DDA`

```dax
_b Paid DDA =
CALCULATE (
    SUM ( fact_attribution_day[paid_customers] )
    ,TREATAS ( { "DDA" }, dim_attribution_model[model_code] )
)
```

### `_b Paid Platform`

```dax
_b Paid Platform =
CALCULATE (
    SUM ( fact_attribution_day[paid_customers] )
    ,TREATAS ( { "PLATFORM" }, dim_attribution_model[model_code] )
)
```

### `_b New MRR`

```dax
_b New MRR =
CALCULATE (
    SUM ( fact_attribution_day[new_mrr_usd] )
    ,TREATAS ( { [_Model] }, dim_attribution_model[model_code] )
)
```

### `_b New MRR DDA`

```dax
_b New MRR DDA =
CALCULATE (
    SUM ( fact_attribution_day[new_mrr_usd] )
    ,TREATAS ( { "DDA" }, dim_attribution_model[model_code] )
)
```

### `_b Spend All`

```dax
_b Spend All =
CALCULATE (
    [_b Spend]
    ,REMOVEFILTERS ( dim_campaign )
    ,REMOVEFILTERS ( dim_channel )
    ,REMOVEFILTERS ( dim_network )
    ,REMOVEFILTERS ( dim_platform )
    ,REMOVEFILTERS ( dim_ad_set )
    ,REMOVEFILTERS ( dim_creative )
)
```

### `_b Team Pool`

```dax
_b Team Pool =
SUMX (
    VALUES ( dim_date[date] )
    ,VAR _day         = dim_date[date]
     VAR _monthly     =
        MAXX (
            TOPN (
                1
                ,FILTER (
                    param_finance
                    ,param_finance[metric_code] = "PAID_TEAM_COST_MONTH_USD"
                        && param_finance[valid_from] <= _day
                )
                ,param_finance[valid_from], DESC
            )
            ,param_finance[value]
        )
     RETURN
        DIVIDE ( _monthly, DAY ( EOMONTH ( _day, 0 ) ) )
)
```

### `_b Team Cost`

```dax
_b Team Cost =
[_b Team Pool] * DIVIDE ( [_b Spend], [_b Spend All] )
```

### `_b Term Spend`

```dax
_b Term Spend =
SUM ( fact_term_day[spend_usd] )
```

### `_b Term Clicks`

```dax
_b Term Clicks =
SUM ( fact_term_day[clicks] )
```

### `_b Term Impressions`

```dax
_b Term Impressions =
SUM ( fact_term_day[impressions] )
```

### `_b Term Signups`

```dax
_b Term Signups =
SUM ( fact_term_day[signups] )
```

### `_x Pacing`

```dax
_x Pacing =
DIVIDE ( [_b Spend], [_b Plan] )
```

### `_x CTR`

```dax
_x CTR =
DIVIDE ( [_b Clicks], [_b Impressions] )
```

### `_x CPC`

```dax
_x CPC =
DIVIDE ( [_b Spend], [_b Clicks] )
```

### `_x CPM`

```dax
_x CPM =
DIVIDE ( [_b Spend] * 1000, [_b Impressions] )
```

### `_x Web Land Rate`

```dax
_x Web Land Rate =
DIVIDE ( [_b Sessions], [_b Web Clicks] )
```

### `_x Store CVR`

```dax
_x Store CVR =
DIVIDE ( [_b Installs], [_b Store Views] )
```

### `_x Install Signup Rate`

```dax
_x Install Signup Rate =
DIVIDE ( [_b Mobile Signups], [_b Installs] )
```

### `_x Landing Signup Rate`

```dax
_x Landing Signup Rate =
DIVIDE ( [_b Web Signups], [_b Sessions] )
```

### `_x Landed`

```dax
_x Landed =
[_b Sessions] + [_b Installs]
```

### `_x Click Signup Rate`

```dax
_x Click Signup Rate =
DIVIDE ( [_b Signups], [_b Clicks] )
```

### `_x CPL`

```dax
_x CPL =
DIVIDE ( [_b Spend], [_b Signups] )
```

### `_x Activation Rate`

```dax
_x Activation Rate =
DIVIDE ( [_b Activated], [_b Signups] )
```

### `_x Cost per Activated`

```dax
_x Cost per Activated =
DIVIDE ( [_b Spend], [_b Activated] )
```

### `_x Trial Rate`

```dax
_x Trial Rate =
DIVIDE ( [_b Trials], [_b Signups] )
```

### `_x Trial to Paid`

```dax
_x Trial to Paid =
DIVIDE ( [_b Paid], [_b Trials] )
```

### `_x CPA`

```dax
_x CPA =
DIVIDE ( [_b Spend], [_b Paid] )
```

### `_x Reported CPA`

```dax
_x Reported CPA =
DIVIDE ( [_b Spend], [_b Paid Platform] )
```

### `_x Modelled CPA`

```dax
_x Modelled CPA =
DIVIDE ( [_b Spend], [_b Paid FP] )
```

### `_x Blended CAC`

```dax
_x Blended CAC =
DIVIDE ( [_b Spend] + [_b Team Cost], [_b Paid] )
```

### `_x ARPA`

```dax
_x ARPA =
DIVIDE ( [_b New MRR], [_b Paid] )
```

### `_x Payback Months`

```dax
_x Payback Months =
DIVIDE ( [_x Blended CAC], [_x ARPA] * [_GM] )
```

### `_x Month Index End`

```dax
_x Month Index End =
VAR _end          = MAX ( dim_date[date] )
RETURN
    CALCULATE (
        MAX ( dim_date[month_index] )
        ,REMOVEFILTERS ( dim_date )
        ,dim_date[date] = _end
    )
```

### `_x Last Complete Month`

```dax
_x Last Complete Month =
VAR _end          = MAX ( dim_date[date] )
VAR _month        = [_x Month Index End]
RETURN
    IF ( _end = EOMONTH ( _end, 0 ), _month, _month - 1 )
```

### `_x Churn`

```dax
_x Churn =
VAR _last         = [_x Last Complete Month]
RETURN
    CALCULATE (
        DIVIDE (
            SUM ( fact_cohort_revenue_month[churned] )
            ,SUM ( fact_cohort_revenue_month[customers_start] )
        )
        ,fact_cohort_revenue_month[month_offset] >= 1
        ,fact_cohort_revenue_month[calendar_month_index] >= _last - 2
        ,fact_cohort_revenue_month[calendar_month_index] <= _last
    )
```

### `_x LTV`

```dax
_x LTV =
VAR _churn        = [_x Churn]
RETURN
    IF ( _churn > 0 && [_b New MRR] > 0, DIVIDE ( [_x ARPA] * [_GM], _churn ) )
```

### `_x LTV CAC`

```dax
_x LTV CAC =
DIVIDE ( [_x LTV], [_x Blended CAC] )
```

### `_x R90 Own`

```dax
_x R90 Own =
VAR _cohort       = [_x Last Complete Month] - 2
VAR _rows         =
    FILTER (
        ADDCOLUMNS (
            VALUES ( dim_campaign[campaign_key] )
            ,"@r0",
                CALCULATE (
                    SUM ( fact_cohort_revenue_month[revenue_usd] )
                    ,fact_cohort_revenue_month[cohort_month_index] = _cohort
                    ,fact_cohort_revenue_month[month_offset] = 0
                )
            ,"@n2",
                CALCULATE (
                    COUNTROWS ( fact_cohort_revenue_month )
                    ,fact_cohort_revenue_month[cohort_month_index] = _cohort
                    ,fact_cohort_revenue_month[month_offset] = 2
                )
            ,"@r012",
                CALCULATE (
                    SUM ( fact_cohort_revenue_month[revenue_usd] )
                    ,fact_cohort_revenue_month[cohort_month_index] = _cohort
                    ,fact_cohort_revenue_month[month_offset] <= 2
                )
        )
        ,[@r0] > 0
            && [@n2] > 0
    )
RETURN
    DIVIDE ( SUMX ( _rows, [@r012] ), SUMX ( _rows, [@r0] ) )
```

### `_x R90`

```dax
_x R90 =
VAR _own          = [_x R90 Own]
VAR _single       = HASONEVALUE ( dim_campaign[campaign_key] )
VAR _channel      = SELECTEDVALUE ( dim_campaign[channel_code] )
VAR _by_channel   =
    IF (
        ISBLANK ( _own ) && _single
        ,CALCULATE (
            [_x R90 Own]
            ,REMOVEFILTERS ( dim_campaign )
            ,REMOVEFILTERS ( dim_channel )
            ,REMOVEFILTERS ( dim_network )
            ,REMOVEFILTERS ( dim_platform )
            ,dim_campaign[channel_code] = _channel
        )
    )
VAR _all          =
    IF (
        ISBLANK ( _own ) && ISBLANK ( _by_channel )
        ,CALCULATE (
            [_x R90 Own]
            ,REMOVEFILTERS ( dim_campaign )
            ,REMOVEFILTERS ( dim_channel )
            ,REMOVEFILTERS ( dim_network )
            ,REMOVEFILTERS ( dim_platform )
        )
    )
RETURN
    COALESCE ( _own, _by_channel, _all )
```

### `_x ROAS 90d`

```dax
_x ROAS 90d =
VAR _r90          = [_x R90]
VAR _spend        = [_b Spend]
RETURN
    IF ( NOT ISBLANK ( _r90 ) && _spend > 0, DIVIDE ( ( [_b New MRR] + 0 ) * _r90, _spend ) )
```

### `_x Attribution Gap`

```dax
_x Attribution Gap =
VAR _modelled     = [_b Paid FP]
VAR _platform     = [_b Paid Platform]
RETURN
    IF ( _modelled > 0 && _platform > 0, DIVIDE ( _platform, _modelled ) - 1 )
```

### `_x Brand Share`

```dax
_x Brand Share =
VAR _search       = CALCULATE ( [_b Spend], KEEPFILTERS ( dim_campaign[channel_code] = "PAID_SEARCH" ) )
VAR _brand        =
    CALCULATE (
        [_b Spend]
        ,KEEPFILTERS ( dim_campaign[channel_code] = "PAID_SEARCH" )
        ,KEEPFILTERS ( dim_campaign[is_brand] = TRUE () )
    )
RETURN
    IF ( _search > 0, DIVIDE ( _brand, _search ) + 0 )
```

### `_x Refund Rate`

```dax
_x Refund Rate =
VAR _month        = [_x Month Index End]
RETURN
    CALCULATE (
        DIVIDE (
            SUM ( fact_cohort_revenue_month[refund_count] )
            ,CALCULATE (
                SUM ( fact_cohort_revenue_month[customers_start] )
                ,fact_cohort_revenue_month[month_offset] = 0
            )
        )
        ,fact_cohort_revenue_month[cohort_month_index] >= _month - 11
        ,fact_cohort_revenue_month[cohort_month_index] <= _month
    )
```

### `_x Retention Month Index`

```dax
_x Retention Month Index =
VAR _end          = MAX ( dim_date[date] )
RETURN
    CALCULATE (
        MAX ( fact_retention_cohort_month[cohort_month_index] )
        ,REMOVEFILTERS ( dim_campaign )
        ,REMOVEFILTERS ( dim_channel )
        ,REMOVEFILTERS ( dim_network )
        ,REMOVEFILTERS ( dim_platform )
        ,fact_retention_cohort_month[day_n] = 30
        ,fact_retention_cohort_month[cohort_month_start] <= _end - 44
    )
```

### `_x Retention Cohort Month`

```dax
_x Retention Cohort Month =
VAR _index        = [_x Retention Month Index]
VAR _start        = CALCULATE ( MAX ( dim_month[month_start] ), dim_month[month_index] = _index )
RETURN
    IF ( NOT ISBLANK ( _index ), YEAR ( _start ) * 100 + MONTH ( _start ) )
```

### `_x D7 Retention`

```dax
_x D7 Retention =
VAR _index        = [_x Retention Month Index]
RETURN
    IF (
        NOT ISBLANK ( _index )
        ,CALCULATE (
            DIVIDE (
                SUM ( fact_retention_cohort_month[users_active] )
                ,SUM ( fact_retention_cohort_month[users_matured] )
            )
            ,fact_retention_cohort_month[day_n] = 7
            ,fact_retention_cohort_month[cohort_month_index] = _index
        )
    )
```

### `_x D30 Retention`

```dax
_x D30 Retention =
VAR _index        = [_x Retention Month Index]
RETURN
    IF (
        NOT ISBLANK ( _index )
        ,CALCULATE (
            DIVIDE (
                SUM ( fact_retention_cohort_month[users_active] )
                ,SUM ( fact_retention_cohort_month[users_matured] )
            )
            ,fact_retention_cohort_month[day_n] = 30
            ,fact_retention_cohort_month[cohort_month_index] = _index
        )
    )
```

### `_x CTR Last 7`

```dax
_x CTR Last 7 =
VAR _end          = MAX ( dim_date[date] )
RETURN
    CALCULATE (
        DIVIDE ( [_b Clicks], [_b Impressions] )
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _end - 6
                && dim_date[date] <= _end
        )
    )
```

### `_x CTR Slope Raw`

```dax
_x CTR Slope Raw =
VAR _end          = MAX ( dim_date[date] )
VAR _imp_last     =
    CALCULATE (
        [_b Impressions]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _end - 6 && dim_date[date] <= _end )
    )
VAR _clk_last     =
    CALCULATE (
        [_b Clicks]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _end - 6 && dim_date[date] <= _end )
    )
VAR _imp_before   =
    CALCULATE (
        [_b Impressions]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _end - 13 && dim_date[date] <= _end - 7 )
    )
VAR _clk_before   =
    CALCULATE (
        [_b Clicks]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _end - 13 && dim_date[date] <= _end - 7 )
    )
RETURN
    IF (
        _imp_last > 0 && _imp_before > 0 && _clk_before > 0
        ,DIVIDE ( DIVIDE ( _clk_last, _imp_last ), DIVIDE ( _clk_before, _imp_before ) ) - 1
    )
```

### `_x Frequency Raw`

```dax
_x Frequency Raw =
VAR _end          = MAX ( dim_date[date] )
VAR _imp_last     =
    CALCULATE (
        [_b Impressions]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _end - 6 && dim_date[date] <= _end )
    )
VAR _reach        =
    CALCULATE (
        SUM ( fact_ad_delivery_day[reach_7d] )
        ,REMOVEFILTERS ( dim_date )
        ,dim_date[date] = _end
    )
RETURN
    DIVIDE ( _imp_last, _reach )
```

### `_x Window Long Enough`

```dax
_x Window Long Enough =
INT ( MAX ( dim_date[date] ) - MIN ( dim_date[date] ) ) >= 13
```

### `_x Frequency 7d`

```dax
_x Frequency 7d =
IF ( [_x Window Long Enough], [_x Frequency Raw] )
```

### `_x CTR Slope 7d`

```dax
_x CTR Slope 7d =
IF ( [_x Window Long Enough], [_x CTR Slope Raw] )
```

### `_x Install Quality Delta`

```dax
_x Install Quality Delta =
VAR _start        = MIN ( dim_date[date] )
VAR _end          = MAX ( dim_date[date] )
VAR _days         = INT ( _end - _start ) + 1
VAR _ins_last     =
    CALCULATE (
        [_b Installs]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _end - 6 && dim_date[date] <= _end )
    )
VAR _su_last      =
    CALCULATE (
        [_b Signups]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _end - 6 && dim_date[date] <= _end )
    )
VAR _ins_prev     =
    CALCULATE (
        [_b Installs]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _start - _days && dim_date[date] <= _start - 1 )
    )
VAR _su_prev      =
    CALCULATE (
        [_b Signups]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _start - _days && dim_date[date] <= _start - 1 )
    )
RETURN
    IF ( _ins_last > 0 && _ins_prev > 0, DIVIDE ( _su_last, _ins_last ) - DIVIDE ( _su_prev, _ins_prev ) )
```

### `Spend`

```dax
Spend =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Spend]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Spend Prev`

```dax
Spend Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_b Spend]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `Spend LY`

```dax
Spend LY =
VAR _start        = EDATE ( [_Win Start], -12 )
VAR _end          = EDATE ( [_Win End], -12 )
RETURN
    CALCULATE (
        [_b Spend]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Spend Cmp`

```dax
Spend Cmp =
SWITCH (
    [_Cmp]
    ,"PREV"
        ,[Spend Prev]
    ,"LY"
        ,[Spend LY]
)
```

### `Plan`

```dax
Plan =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Plan]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Pacing`

```dax
Pacing =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Pacing]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Impressions`

```dax
Impressions =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Impressions]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Clicks`

```dax
Clicks =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Clicks]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Clicks Prev`

```dax
Clicks Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_b Clicks]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `Clicks LY`

```dax
Clicks LY =
VAR _start        = EDATE ( [_Win Start], -12 )
VAR _end          = EDATE ( [_Win End], -12 )
RETURN
    CALCULATE (
        [_b Clicks]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Clicks Cmp`

```dax
Clicks Cmp =
SWITCH (
    [_Cmp]
    ,"PREV"
        ,[Clicks Prev]
    ,"LY"
        ,[Clicks LY]
)
```

### `CTR`

```dax
CTR =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x CTR]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `CPC`

```dax
CPC =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x CPC]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `CPM`

```dax
CPM =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x CPM]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Sessions`

```dax
Sessions =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Sessions]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Web Land Rate`

```dax
Web Land Rate =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Web Land Rate]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Store Views`

```dax
Store Views =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Store Views]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Installs`

```dax
Installs =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Installs]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `First Opens`

```dax
First Opens =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b First Opens]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Store CVR`

```dax
Store CVR =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Store CVR]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Install Signup Rate`

```dax
Install Signup Rate =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Install Signup Rate]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Landing Signup Rate`

```dax
Landing Signup Rate =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Landing Signup Rate]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Landed`

```dax
Landed =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Landed]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Signups`

```dax
Signups =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Signups]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Click Signup Rate`

```dax
Click Signup Rate =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Click Signup Rate]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Click Signup Rate Prev`

```dax
Click Signup Rate Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_x Click Signup Rate]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `Click Signup Rate LY`

```dax
Click Signup Rate LY =
VAR _start        = EDATE ( [_Win Start], -12 )
VAR _end          = EDATE ( [_Win End], -12 )
RETURN
    CALCULATE (
        [_x Click Signup Rate]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Click Signup Rate Cmp`

```dax
Click Signup Rate Cmp =
SWITCH (
    [_Cmp]
    ,"PREV"
        ,[Click Signup Rate Prev]
    ,"LY"
        ,[Click Signup Rate LY]
)
```

### `CPL`

```dax
CPL =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x CPL]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Activated`

```dax
Activated =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Activated]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Activation Rate`

```dax
Activation Rate =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Activation Rate]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Cost per Activated`

```dax
Cost per Activated =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Cost per Activated]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Trials`

```dax
Trials =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Trials]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Trials Prev`

```dax
Trials Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_b Trials]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `Trial Rate`

```dax
Trial Rate =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Trial Rate]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Trial to Paid`

```dax
Trial to Paid =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Trial to Paid]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Trial to Paid Prev`

```dax
Trial to Paid Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_x Trial to Paid]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `Trial to Paid LY`

```dax
Trial to Paid LY =
VAR _start        = EDATE ( [_Win Start], -12 )
VAR _end          = EDATE ( [_Win End], -12 )
RETURN
    CALCULATE (
        [_x Trial to Paid]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Trial to Paid Cmp`

```dax
Trial to Paid Cmp =
SWITCH (
    [_Cmp]
    ,"PREV"
        ,[Trial to Paid Prev]
    ,"LY"
        ,[Trial to Paid LY]
)
```

### `Paid Customers`

```dax
Paid Customers =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Paid]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Paid Customers Prev`

```dax
Paid Customers Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_b Paid]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `Paid Customers LY`

```dax
Paid Customers LY =
VAR _start        = EDATE ( [_Win Start], -12 )
VAR _end          = EDATE ( [_Win End], -12 )
RETURN
    CALCULATE (
        [_b Paid]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Paid Customers Cmp`

```dax
Paid Customers Cmp =
SWITCH (
    [_Cmp]
    ,"PREV"
        ,[Paid Customers Prev]
    ,"LY"
        ,[Paid Customers LY]
)
```

### `Paid Customers DDA`

```dax
Paid Customers DDA =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Paid DDA]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Paid Customers DDA Prev`

```dax
Paid Customers DDA Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_b Paid DDA]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `Paid Customers Platform`

```dax
Paid Customers Platform =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Paid Platform]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `New MRR`

```dax
New MRR =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b New MRR]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `New MRR Prev`

```dax
New MRR Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_b New MRR]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `New MRR LY`

```dax
New MRR LY =
VAR _start        = EDATE ( [_Win Start], -12 )
VAR _end          = EDATE ( [_Win End], -12 )
RETURN
    CALCULATE (
        [_b New MRR]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `New MRR Cmp`

```dax
New MRR Cmp =
SWITCH (
    [_Cmp]
    ,"PREV"
        ,[New MRR Prev]
    ,"LY"
        ,[New MRR LY]
)
```

### `ARPA`

```dax
ARPA =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x ARPA]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `ARPA Prev`

```dax
ARPA Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_x ARPA]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `ARPA LY`

```dax
ARPA LY =
VAR _start        = EDATE ( [_Win Start], -12 )
VAR _end          = EDATE ( [_Win End], -12 )
RETURN
    CALCULATE (
        [_x ARPA]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `ARPA Cmp`

```dax
ARPA Cmp =
SWITCH (
    [_Cmp]
    ,"PREV"
        ,[ARPA Prev]
    ,"LY"
        ,[ARPA LY]
)
```

### `CPA`

```dax
CPA =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x CPA]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `CPA Prev`

```dax
CPA Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_x CPA]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `Reported CPA`

```dax
Reported CPA =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Reported CPA]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Modelled CPA`

```dax
Modelled CPA =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Modelled CPA]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Team Cost`

```dax
Team Cost =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Team Cost]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Paid CAC`

```dax
Paid CAC =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x CPA]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Paid CAC Prev`

```dax
Paid CAC Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_x CPA]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `Paid CAC LY`

```dax
Paid CAC LY =
VAR _start        = EDATE ( [_Win Start], -12 )
VAR _end          = EDATE ( [_Win End], -12 )
RETURN
    CALCULATE (
        [_x CPA]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Paid CAC Cmp`

```dax
Paid CAC Cmp =
SWITCH (
    [_Cmp]
    ,"PREV"
        ,[Paid CAC Prev]
    ,"LY"
        ,[Paid CAC LY]
)
```

### `Blended CAC`

```dax
Blended CAC =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Blended CAC]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Blended CAC Prev`

```dax
Blended CAC Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_x Blended CAC]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `Blended CAC LY`

```dax
Blended CAC LY =
VAR _start        = EDATE ( [_Win Start], -12 )
VAR _end          = EDATE ( [_Win End], -12 )
RETURN
    CALCULATE (
        [_x Blended CAC]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Blended CAC Cmp`

```dax
Blended CAC Cmp =
SWITCH (
    [_Cmp]
    ,"PREV"
        ,[Blended CAC Prev]
    ,"LY"
        ,[Blended CAC LY]
)
```

### `Payback Months`

```dax
Payback Months =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Payback Months]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Payback Months Prev`

```dax
Payback Months Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_x Payback Months]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `Payback Months LY`

```dax
Payback Months LY =
VAR _start        = EDATE ( [_Win Start], -12 )
VAR _end          = EDATE ( [_Win End], -12 )
RETURN
    CALCULATE (
        [_x Payback Months]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Payback Months Cmp`

```dax
Payback Months Cmp =
SWITCH (
    [_Cmp]
    ,"PREV"
        ,[Payback Months Prev]
    ,"LY"
        ,[Payback Months LY]
)
```

### `Churn Monthly`

```dax
Churn Monthly =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Churn]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `LTV`

```dax
LTV =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x LTV]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `LTV CAC`

```dax
LTV CAC =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x LTV CAC]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `LTV CAC Prev`

```dax
LTV CAC Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_x LTV CAC]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `LTV CAC LY`

```dax
LTV CAC LY =
VAR _start        = EDATE ( [_Win Start], -12 )
VAR _end          = EDATE ( [_Win End], -12 )
RETURN
    CALCULATE (
        [_x LTV CAC]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `LTV CAC Cmp`

```dax
LTV CAC Cmp =
SWITCH (
    [_Cmp]
    ,"PREV"
        ,[LTV CAC Prev]
    ,"LY"
        ,[LTV CAC LY]
)
```

### `R90`

```dax
R90 =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x R90]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `ROAS 90d`

```dax
ROAS 90d =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x ROAS 90d]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `ROAS 90d Prev`

```dax
ROAS 90d Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_x ROAS 90d]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `ROAS 90d LY`

```dax
ROAS 90d LY =
VAR _start        = EDATE ( [_Win Start], -12 )
VAR _end          = EDATE ( [_Win End], -12 )
RETURN
    CALCULATE (
        [_x ROAS 90d]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `ROAS 90d Cmp`

```dax
ROAS 90d Cmp =
SWITCH (
    [_Cmp]
    ,"PREV"
        ,[ROAS 90d Prev]
    ,"LY"
        ,[ROAS 90d LY]
)
```

### `Attribution Gap`

```dax
Attribution Gap =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Attribution Gap]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Attribution Gap Prev`

```dax
Attribution Gap Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_x Attribution Gap]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `Brand Share`

```dax
Brand Share =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Brand Share]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Refund Rate`

```dax
Refund Rate =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Refund Rate]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Retention Cohort Month`

```dax
Retention Cohort Month =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Retention Cohort Month]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `D7 Retention`

```dax
D7 Retention =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x D7 Retention]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `D30 Retention`

```dax
D30 Retention =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x D30 Retention]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Frequency 7d`

```dax
Frequency 7d =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Frequency 7d]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `CTR Slope 7d`

```dax
CTR Slope 7d =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x CTR Slope 7d]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Install Quality Delta`

```dax
Install Quality Delta =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Install Quality Delta]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Creative CTR 7d`

```dax
Creative CTR 7d =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x CTR Last 7]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Creative Slope 7d`

```dax
Creative Slope 7d =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x CTR Slope Raw]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Creative Frequency`

```dax
Creative Frequency =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Frequency Raw]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Term Impressions`

```dax
Term Impressions =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Term Impressions]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Term Clicks`

```dax
Term Clicks =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Term Clicks]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Term Spend`

```dax
Term Spend =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Term Spend]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Term Signups`

```dax
Term Signups =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Term Signups]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Term CPC`

```dax
Term CPC =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        DIVIDE ( [_b Term Spend], [_b Term Clicks] )
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Term CVR`

```dax
Term CVR =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        DIVIDE ( [_b Term Signups], [_b Term Clicks] )
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Ad Set Credits`

```dax
Ad Set Credits =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Paid Credits Delivery]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Customers Target`

```dax
Customers Target =
[_T PAID_CUSTOMERS_30D] * [_Win Days] / 30
```

### `Spend Δ`

```dax
Spend Δ =
VAR _mode         = [_Cmp]
VAR _base         =
    SWITCH (
        _mode
        ,"PLAN"
            ,[Plan]
        ,"NONE"
            ,BLANK ()
        ,[Spend Cmp]
    )
RETURN
    DIVIDE ( [Spend] - _base, _base )
```

### `Paid Customers Δ`

```dax
Paid Customers Δ =
VAR _mode         = [_Cmp]
VAR _base         =
    SWITCH (
        _mode
        ,"PLAN"
            ,[Customers Target]
        ,"NONE"
            ,BLANK ()
        ,[Paid Customers Cmp]
    )
RETURN
    DIVIDE ( [Paid Customers] - _base, _base )
```

### `Blended CAC Δ`

```dax
Blended CAC Δ =
VAR _mode         = [_Cmp]
VAR _base         =
    SWITCH (
        _mode
        ,"PLAN"
            ,[_T BLENDED_CAC]
        ,"NONE"
            ,BLANK ()
        ,[Blended CAC Cmp]
    )
RETURN
    DIVIDE ( [Blended CAC] - _base, _base )
```

### `New MRR Δ`

```dax
New MRR Δ =
VAR _mode         = [_Cmp]
VAR _base         = IF ( _mode IN { "PREV", "LY" }, [New MRR Cmp] )
RETURN
    DIVIDE ( [New MRR] - _base, _base )
```

### `Payback Months Δ`

```dax
Payback Months Δ =
VAR _mode         = [_Cmp]
VAR _base         =
    SWITCH (
        _mode
        ,"PLAN"
            ,[_T PAYBACK_MONTHS]
        ,"NONE"
            ,BLANK ()
        ,[Payback Months Cmp]
    )
RETURN
    IF ( NOT ISBLANK ( _base ), [Payback Months] - _base )
```

### `LTV CAC Δ`

```dax
LTV CAC Δ =
VAR _mode         = [_Cmp]
VAR _base         =
    SWITCH (
        _mode
        ,"PLAN"
            ,[_T LTV_CAC]
        ,"NONE"
            ,BLANK ()
        ,[LTV CAC Cmp]
    )
RETURN
    IF ( NOT ISBLANK ( _base ), [LTV CAC] - _base )
```

### `Clicks Δ`

```dax
Clicks Δ =
DIVIDE ( [Clicks] - [Clicks Cmp], [Clicks Cmp] )
```

### `Click Signup Rate Δ`

```dax
Click Signup Rate Δ =
IF ( NOT ISBLANK ( [Click Signup Rate Cmp] ), [Click Signup Rate] - [Click Signup Rate Cmp] )
```

### `Trial to Paid Δ`

```dax
Trial to Paid Δ =
IF ( NOT ISBLANK ( [Trial to Paid Cmp] ), [Trial to Paid] - [Trial to Paid Cmp] )
```

### `Verdict Pacing`

```dax
Verdict Pacing =
VAR _pacing       = [Pacing]
RETURN
    IF (
        NOT ISBLANK ( _pacing )
        ,SWITCH (
            TRUE ()
            ,ABS ( _pacing - 1 ) <= [_T SPEND_PLAN_TOL]
                ,1
            ,_pacing > [_T PACING_HI] || _pacing < [_T PACING_LO]
                ,3
            ,2
        )
    )
```

### `Verdict Paid Customers`

```dax
Verdict Paid Customers =
VAR _value        = [Paid Customers]
VAR _target       = [Customers Target]
VAR _band         = [_T WARN_BAND_REL]
RETURN
    IF (
        NOT ISBLANK ( _value )
        ,SWITCH (
            TRUE ()
            ,_value >= _target
                ,1
            ,_value >= _target * ( 1 - _band )
                ,2
            ,3
        )
    )
```

### `Verdict Blended CAC`

```dax
Verdict Blended CAC =
VAR _value        = [Blended CAC]
VAR _target       = [_T BLENDED_CAC]
VAR _band         = [_T WARN_BAND_REL]
RETURN
    IF (
        NOT ISBLANK ( _value )
        ,SWITCH (
            TRUE ()
            ,_value <= _target
                ,1
            ,_value <= _target * ( 1 + _band )
                ,2
            ,3
        )
    )
```

### `Verdict Payback Months`

```dax
Verdict Payback Months =
VAR _value        = [Payback Months]
VAR _target       = [_T PAYBACK_MONTHS]
VAR _band         = [_T WARN_BAND_REL]
RETURN
    IF (
        NOT ISBLANK ( _value )
        ,SWITCH (
            TRUE ()
            ,_value <= _target
                ,1
            ,_value <= _target * ( 1 + _band )
                ,2
            ,3
        )
    )
```

### `Verdict LTV CAC`

```dax
Verdict LTV CAC =
VAR _value        = [LTV CAC]
VAR _target       = [_T LTV_CAC]
VAR _band         = [_T WARN_BAND_REL]
RETURN
    IF (
        NOT ISBLANK ( _value )
        ,SWITCH (
            TRUE ()
            ,_value >= _target
                ,1
            ,_value >= _target * ( 1 - _band )
                ,2
            ,3
        )
    )
```

### `Verdict Trial to Paid`

```dax
Verdict Trial to Paid =
VAR _value        = [Trial to Paid]
VAR _target       = [_T TRIAL_TO_PAID]
VAR _band         = [_T WARN_BAND_REL]
RETURN
    IF (
        NOT ISBLANK ( _value )
        ,SWITCH (
            TRUE ()
            ,_value >= _target
                ,1
            ,_value >= _target * ( 1 - _band )
                ,2
            ,3
        )
    )
```

### `Verdict D7 Retention`

```dax
Verdict D7 Retention =
VAR _value        = [D7 Retention]
VAR _target       = [_T D7_RETENTION]
VAR _band         = [_T WARN_BAND_REL]
RETURN
    IF (
        NOT ISBLANK ( _value )
        ,SWITCH (
            TRUE ()
            ,_value >= _target
                ,1
            ,_value >= _target * ( 1 - _band )
                ,2
            ,3
        )
    )
```

### `Verdict D30 Retention`

```dax
Verdict D30 Retention =
VAR _value        = [D30 Retention]
VAR _target       = [_T D30_RETENTION]
VAR _band         = [_T WARN_BAND_REL]
RETURN
    IF (
        NOT ISBLANK ( _value )
        ,SWITCH (
            TRUE ()
            ,_value >= _target
                ,1
            ,_value >= _target * ( 1 - _band )
                ,2
            ,3
        )
    )
```

### `Verdict Refund Rate`

```dax
Verdict Refund Rate =
VAR _value        = [Refund Rate]
VAR _target       = [_T REFUND_RATE]
VAR _band         = [_T WARN_BAND_REL]
RETURN
    IF (
        NOT ISBLANK ( _value )
        ,SWITCH (
            TRUE ()
            ,_value <= _target
                ,1
            ,_value <= _target * ( 1 + _band )
                ,2
            ,3
        )
    )
```

### `Verdict Brand Share`

```dax
Verdict Brand Share =
VAR _value        = [Brand Share]
VAR _target       = [_T BRAND_SHARE]
VAR _band         = [_T WARN_BAND_REL]
RETURN
    IF (
        NOT ISBLANK ( _value )
        ,SWITCH (
            TRUE ()
            ,_value <= _target
                ,1
            ,_value <= _target * ( 1 + _band )
                ,2
            ,3
        )
    )
```

### `Verdict Attribution Gap`

```dax
Verdict Attribution Gap =
VAR _value        = [Attribution Gap]
VAR _target       = [_T ATTR_GAP]
VAR _band         = [_T WARN_BAND_REL]
RETURN
    IF (
        NOT ISBLANK ( _value )
        ,SWITCH (
            TRUE ()
            ,_value <= _target
                ,1
            ,_value <= _target * ( 1 + _band )
                ,2
            ,3
        )
    )
```

### `Flag Codes`

```dax
Flag Codes =
VAR _spend        = [Spend]
VAR _is_campaign  = [_Is Campaign Scope]
VAR _objective    = IF ( _is_campaign, SELECTEDVALUE ( dim_campaign[objective_code] ) )
VAR _status       = IF ( _is_campaign, SELECTEDVALUE ( dim_campaign[status_code] ) )
VAR _spenders     =
    FILTER (
        VALUES ( dim_campaign[campaign_key] )
        ,CALCULATE ( [_b Spend], REMOVEFILTERS ( dim_date ) ) > 0
    )
VAR _learners     =
    COUNTROWS (
        FILTER (
            _spenders
            ,CALCULATE ( SELECTEDVALUE ( dim_campaign[status_code] ) ) = "LEARNING"
        )
    )
VAR _gate         =
    IF (
        _is_campaign
        ,SWITCH (
            _objective
            ,"PIPELINE"
                ,"PIPELINE_LED"
            ,"LEAD"
                ,"LEAD_GOAL"
            ,"RETENTION"
                ,"NO_CPA_GOAL"
            ,IF ( _status = "LEARNING", "LEARNING" )
        )
        ,IF ( _learners = COUNTROWS ( _spenders ), "LEARNING" )
    )
VAR _slope        = [CTR Slope 7d]
VAR _frequency    = [Frequency 7d]
VAR _fatigue      = _slope < [_T FATIGUE_SLOPE] && _frequency > [_T FATIGUE_FREQ]
VAR _freq_high    = _frequency > [_T FREQ_HIGH]
VAR _quality      = IF ( _is_campaign && _objective = "INSTALL", [Install Quality Delta] )
VAR _install_q    = NOT ISBLANK ( _quality ) && _quality < [_T INSTALL_QUALITY_PT]
VAR _view_through = [Attribution Gap] + 1 > [_T VIEW_THROUGH_RATIO]
VAR _target       = [CPA Target]
VAR _cpa_over     =
    NOT ( _fatigue || _freq_high || _install_q || _view_through )
        && NOT ISBLANK ( _target )
        && [CPA] > _target * [_T CPA_OVER_TOL]
VAR _pacing       = [Pacing]
VAR _over         = NOT ISBLANK ( _pacing ) && _pacing > [_T PACING_HI]
VAR _under        = NOT ISBLANK ( _pacing ) && _pacing < [_T PACING_LO]
VAR _list         =
    IF ( _fatigue, "FATIGUE," )
        & IF ( _freq_high, "FREQUENCY," )
        & IF ( _install_q, "INSTALL_QUALITY," )
        & IF ( _view_through, "VIEW_THROUGH," )
        & IF ( _cpa_over, "CPA_OVER," )
        & IF ( _over, "OVER_PACING," )
        & IF ( _under, "UNDERSPENT," )
VAR _result       =
    SWITCH (
        TRUE ()
        ,NOT ISBLANK ( _gate )
            ,_gate
        ,_list = ""
            ,"ON_TARGET"
        ,LEFT ( _list, LEN ( _list ) - 1 )
    )
RETURN
    IF ( _spend > 0, _result )
```

### `Flags Text`

```dax
Flags Text =
VAR _codes        = [Flag Codes]
VAR _target       = [CPA Target]
VAR _over_pct     = DIVIDE ( [CPA], _target ) - 1
VAR _words        =
    SUBSTITUTE (
        SUBSTITUTE (
            SUBSTITUTE (
                SUBSTITUTE (
                    SUBSTITUTE (
                        SUBSTITUTE (
                            SUBSTITUTE (
                                SUBSTITUTE (
                                    SUBSTITUTE (
                                        SUBSTITUTE (
                                            SUBSTITUTE (
                                                SUBSTITUTE ( _codes, "FATIGUE", "Fatigue" )
                                                ,"FREQUENCY", "Frequency"
                                            )
                                            ,"INSTALL_QUALITY", "Install quality"
                                        )
                                        ,"VIEW_THROUGH", "View-through heavy"
                                    )
                                    ,"CPA_OVER", "CPA " & FORMAT ( _over_pct, "0%" ) & " over"
                                )
                                ,"OVER_PACING", "Over-pacing"
                            )
                            ,"UNDERSPENT", "Underspent"
                        )
                        ,"PIPELINE_LED", "Pipeline-led"
                    )
                    ,"LEAD_GOAL", "Lead goal"
                )
                ,"NO_CPA_GOAL", "No CPA goal"
            )
            ,"LEARNING", "Learning"
        )
        ,"ON_TARGET", "On target"
    )
RETURN
    SUBSTITUTE ( _words, ",", " | " )
```

### `Flags Colour`

```dax
Flags Colour =
VAR _codes        = "," & [Flag Codes] & ","
RETURN
    SWITCH (
        TRUE ()
        ,ISBLANK ( [Flag Codes] )
            ,"#8A94A6"
        ,CONTAINSSTRING ( _codes, ",FATIGUE," ) || CONTAINSSTRING ( _codes, ",OVER_PACING," ) || CONTAINSSTRING ( _codes, ",CPA_OVER," )
            || CONTAINSSTRING ( _codes, ",FREQUENCY," ) || CONTAINSSTRING ( _codes, ",INSTALL_QUALITY," )
            ,"#D93B4B"
        ,CONTAINSSTRING ( _codes, ",UNDERSPENT," ) || CONTAINSSTRING ( _codes, ",VIEW_THROUGH," )
            ,"#C47A0E"
        ,CONTAINSSTRING ( _codes, ",ON_TARGET," )
            ,"#1E9E6A"
        ,"#4B5563"
    )
```

### `Trial Shortfall`

```dax
Trial Shortfall =
VAR _prev_rate    = DIVIDE ( [Paid Customers DDA Prev], [Trials Prev] )
RETURN
    IF ( [Trials] > 0 && [Trials Prev] > 0, [Trials] * _prev_rate - [Paid Customers DDA] )
```

### `Loss Share`

```dax
Loss Share =
VAR _all          =
    CALCULATE (
        [Trial Shortfall]
        ,REMOVEFILTERS ( dim_campaign )
        ,REMOVEFILTERS ( dim_channel )
        ,REMOVEFILTERS ( dim_network )
        ,REMOVEFILTERS ( dim_platform )
    )
RETURN
    DIVIDE ( [Trial Shortfall], _all )
```

### `_Mv Start`

```dax
_Mv Start =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
VAR _basis_start  = IF ( [_Cmp] = "LY", EDATE ( _start, -12 ), _start - _days )
VAR _first        = CALCULATE ( MIN ( param_date[date] ), REMOVEFILTERS ( param_date ) )
RETURN
    IF ( _basis_start < _first && _days > 30, _end - 29, _start )
```

### `ROAS 90d Basis`

```dax
ROAS 90d Basis =
SWITCH (
    [_Cmp]
    ,"LY"
        ,[ROAS 90d LY]
    ,[ROAS 90d Prev]
)
```

### `ROAS Delta`

```dax
ROAS Delta =
VAR _start        = [_Mv Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
VAR _is_ly        = [_Cmp] = "LY"
VAR _b_start      = IF ( _is_ly, EDATE ( _start, -12 ), _start - _days )
VAR _b_end        = IF ( _is_ly, EDATE ( _end, -12 ), _start - 1 )
VAR _objective    = SELECTEDVALUE ( dim_campaign[objective_code] )
VAR _now          =
    CALCULATE (
        [_x ROAS 90d]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
VAR _before       =
    CALCULATE (
        [_x ROAS 90d]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _b_start
                && dim_date[date] <= _b_end
        )
    )
VAR _spend        =
    CALCULATE (
        [_b Spend]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
VAR _spend_basis  =
    CALCULATE (
        [_b Spend]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _b_start
                && dim_date[date] <= _b_end
        )
    )
RETURN
    IF (
        HASONEVALUE ( dim_campaign[campaign_key] )
            && _objective IN { "PAID", "INSTALL", "PIPELINE" }
            && _spend > 0
            && _spend_basis > 0
            && NOT ISBLANK ( _now )
            && NOT ISBLANK ( _before )
        ,_now - _before
    )
```

### `Mover Rank`

```dax
Mover Rank =
VAR _me           = SELECTEDVALUE ( dim_campaign[campaign_key] )
VAR _deltas       =
    CALCULATETABLE (
        FILTER (
            ADDCOLUMNS (
                VALUES ( dim_campaign[campaign_key] )
                ,"@d", [ROAS Delta]
            )
            ,NOT ISBLANK ( [@d] )
        )
        ,REMOVEFILTERS ( dim_campaign[campaign_key] )
        ,REMOVEFILTERS ( dim_campaign[campaign_label] )
        ,REMOVEFILTERS ( dim_campaign[sort_order] )
    )
VAR _mine         = MAXX ( FILTER ( _deltas, dim_campaign[campaign_key] = _me ), [@d] )
VAR _better       = COUNTROWS ( FILTER ( _deltas, [@d] > _mine ) ) + 0
VAR _worse        = COUNTROWS ( FILTER ( _deltas, [@d] < _mine ) ) + 0
RETURN
    IF (
        NOT ISBLANK ( _mine )
        ,SWITCH (
            TRUE ()
            ,_worse < 3
                ,- ( _worse + 1 )
            ,_better < 3
                ,_better + 1
        )
    )
```

### `ROAS Delta Shown`

```dax
ROAS Delta Shown =
IF ( NOT ISBLANK ( [Mover Rank] ), [ROAS Delta] )
```

### `Mover Visible`

```dax
Mover Visible =
IF ( NOT ISBLANK ( [Mover Rank] ), 1, 0 )
```

### `Movers Colour`

```dax
Movers Colour =
VAR _d = [ROAS Delta Shown] RETURN IF ( NOT ISBLANK ( _d ), IF ( _d >= 0, "#1E9E6A", "#D93B4B" ) )
```

### `_Worst Mover Key`

```dax
_Worst Mover Key =
VAR _deltas       =
    FILTER (
        ADDCOLUMNS (
            VALUES ( dim_campaign[campaign_key] )
            ,"@d", [ROAS Delta]
        )
        ,NOT ISBLANK ( [@d] )
    )
RETURN
    MAXX (
        TOPN ( 1, _deltas, [@d], ASC, dim_campaign[campaign_key], ASC )
        ,dim_campaign[campaign_key]
    )
```

### `_Top Spender Key`

```dax
_Top Spender Key =
MAXX (
    TOPN (
        1
        ,ADDCOLUMNS ( VALUES ( dim_campaign[campaign_key] ), "@s", [Spend] )
        ,[@s], DESC
        ,dim_campaign[campaign_key], ASC
    )
    ,dim_campaign[campaign_key]
)
```

### `_Selected Campaign`

```dax
_Selected Campaign =
CALCULATE (
    IF (
        HASONEVALUE ( dim_campaign[campaign_key] )
        ,VALUES ( dim_campaign[campaign_key] )
        ,COALESCE ( [_Worst Mover Key], [_Top Spender Key] )
    )
    ,REMOVEFILTERS ( dim_date )
    ,REMOVEFILTERS ( dim_ad_set )
    ,REMOVEFILTERS ( dim_creative )
    ,REMOVEFILTERS ( dim_term )
)
```

### `Selected Campaign Name`

```dax
Selected Campaign Name =
VAR _key          = [_Selected Campaign]
RETURN
    CALCULATE (
        SELECTEDVALUE ( dim_campaign[campaign_name] )
        ,REMOVEFILTERS ( dim_campaign )
        ,dim_campaign[campaign_key] = _key
    )
```

### `P3 Ad Set CPA`

```dax
P3 Ad Set CPA =
VAR _key          = [_Selected Campaign]
RETURN
    CALCULATE (
        DIVIDE ( [Spend], [Ad Set Credits] )
        ,TREATAS ( { _key }, dim_campaign[campaign_key] )
    )
```

### `P3 CPA Target`

```dax
P3 CPA Target =
VAR _key          = [_Selected Campaign]
RETURN
    CALCULATE (
        [CPA Target]
        ,TREATAS ( { _key }, dim_campaign[campaign_key] )
    )
```

### `P4 CTR 7d`

```dax
P4 CTR 7d =
VAR _key          = [_Selected Campaign]
RETURN
    CALCULATE (
        IF ( [_Creative Live], [Creative CTR 7d] )
        ,TREATAS ( { _key }, dim_campaign[campaign_key] )
    )
```

### `P4 Slope`

```dax
P4 Slope =
VAR _key          = [_Selected Campaign]
RETURN
    CALCULATE (
        IF ( [_Creative Live], [Creative Slope 7d] )
        ,TREATAS ( { _key }, dim_campaign[campaign_key] )
    )
```

### `P4 Frequency`

```dax
P4 Frequency =
VAR _key          = [_Selected Campaign]
RETURN
    CALCULATE (
        IF ( [_Creative Live], [Creative Frequency] )
        ,TREATAS ( { _key }, dim_campaign[campaign_key] )
    )
```

### `P5 CPC`

```dax
P5 CPC =
VAR _key          = [_Selected Campaign]
RETURN
    CALCULATE (
        [Term CPC]
        ,TREATAS ( { _key }, dim_campaign[campaign_key] )
    )
```

### `P5 CVR`

```dax
P5 CVR =
VAR _key          = [_Selected Campaign]
RETURN
    CALCULATE (
        [Term CVR]
        ,TREATAS ( { _key }, dim_campaign[campaign_key] )
    )
```

### `P5 Conv`

```dax
P5 Conv =
VAR _key          = [_Selected Campaign]
RETURN
    CALCULATE (
        [Term Signups]
        ,TREATAS ( { _key }, dim_campaign[campaign_key] )
    )
```

### `_Creative Live`

```dax
_Creative Live =
VAR _end          = [_Win End]
RETURN
    CALCULATE ( [_b Impressions], REMOVEFILTERS ( dim_date ), dim_date[date] = _end ) > 0
```

### `Creative Status`

```dax
Creative Status =
VAR _slope        = [Creative Slope 7d]
VAR _frequency    = [Creative Frequency]
RETURN
    IF (
        NOT ISBLANK ( _frequency )
        ,SWITCH (
            TRUE ()
            ,_slope < [_T FATIGUE_SLOPE] && _frequency > [_T FATIGUE_FREQ]
                ,3
            ,_slope < 0 && _frequency > [_T WATCH_FREQ]
                ,2
            ,1
        )
    )
```

### `P4 Status`

```dax
P4 Status =
VAR _key          = [_Selected Campaign]
RETURN
    CALCULATE (
        IF ( [_Creative Live], SWITCH ( [Creative Status], 3, "Fatigued", 2, "Watch", 1, "Fresh" ) )
        ,TREATAS ( { _key }, dim_campaign[campaign_key] )
    )
```

### `P4 Status Colour`

```dax
P4 Status Colour =
VAR _key          = [_Selected Campaign]
RETURN
    CALCULATE (
        SWITCH ( [Creative Status], 3, "#D93B4B", 2, "#C47A0E", "#1E9E6A" )
        ,TREATAS ( { _key }, dim_campaign[campaign_key] )
    )
```

### `Alert Tripped`

```dax
Alert Tripped =
VAR _rule         = SELECTEDVALUE ( dim_alert_slot[rule_code] )
VAR _code         = SELECTEDVALUE ( dim_alert_slot[entity_code] )
RETURN
    IF (
        HASONEVALUE ( dim_alert_slot[slot_code] )
        ,SWITCH (
            _rule
            ,"FATIGUE"
                ,CALCULATE (
                    IF ( [Spend] > 0 && [CTR Slope 7d] < [_T FATIGUE_SLOPE] && [Frequency 7d] > [_T FATIGUE_FREQ], 1, 0 )
                    ,KEEPFILTERS ( TREATAS ( { _code }, dim_campaign[campaign_key] ) )
                )
            ,"PACING_OVER"
                ,CALCULATE (
                    IF ( [Pacing] > [_T PACING_HI], 1, 0 )
                    ,KEEPFILTERS ( TREATAS ( { _code }, dim_channel[channel_code] ) )
                )
            ,"INSTALL_QUALITY"
                ,CALCULATE (
                    VAR _q        = [Install Quality Delta]
                    RETURN
                        IF ( SELECTEDVALUE ( dim_campaign[objective_code] ) = "INSTALL" && NOT ISBLANK ( _q ) && _q < [_T INSTALL_QUALITY_PT], 1, 0 )
                    ,KEEPFILTERS ( TREATAS ( { _code }, dim_campaign[campaign_key] ) )
                )
            ,"ATTR_GAP_WIDEN"
                ,IF ( [Attribution Gap] - [Attribution Gap Prev] >= [_T ATTR_GAP_WIDEN_PT], 1, 0 )
            ,"UNDERSPENT_SCALE"
                ,CALCULATE (
                    IF ( NOT ISBLANK ( [Pacing] ) && [Pacing] < [_T PACING_LO] && [ROAS 90d] >= [_T ROAS_SCALE], 1, 0 )
                    ,KEEPFILTERS ( TREATAS ( { _code }, dim_channel[channel_code] ) )
                )
            ,"DATA_STALE"
                ,IF ( [Freshness Dot] = 3, 1, 0 )
        )
    )
```

### `Alert Value`

```dax
Alert Value =
VAR _rule         = SELECTEDVALUE ( dim_alert_slot[rule_code] )
VAR _code         = SELECTEDVALUE ( dim_alert_slot[entity_code] )
RETURN
    IF (
        [Alert Tripped] = 1
        ,SWITCH (
            _rule
            ,"FATIGUE"
                ,CALCULATE ( [CTR Slope 7d], KEEPFILTERS ( TREATAS ( { _code }, dim_campaign[campaign_key] ) ) )
            ,"PACING_OVER"
                ,CALCULATE ( [Spend] - [Plan], KEEPFILTERS ( TREATAS ( { _code }, dim_channel[channel_code] ) ) )
            ,"INSTALL_QUALITY"
                ,CALCULATE ( [Install Quality Delta], KEEPFILTERS ( TREATAS ( { _code }, dim_campaign[campaign_key] ) ) )
            ,"ATTR_GAP_WIDEN"
                ,[Attribution Gap] - [Attribution Gap Prev]
            ,"UNDERSPENT_SCALE"
                ,CALCULATE ( [Plan] - [Spend], KEEPFILTERS ( TREATAS ( { _code }, dim_channel[channel_code] ) ) )
            ,"DATA_STALE"
                ,[Synced Hours Ago]
        )
    )
```

### `Alerts Tripped`

```dax
Alerts Tripped =
SUMX ( dim_alert_slot, [Alert Tripped] )
```

### `Alert Glyph`

```dax
Alert Glyph =
IF ( [Alert Tripped] = 1, "●" )
```

### `Alert Colour`

```dax
Alert Colour =
SWITCH (
    SELECTEDVALUE ( dim_alert_slot[severity] )
    ,"CRIT"
        ,"#D93B4B"
    ,"WARN"
        ,"#C47A0E"
    ,"INFO"
        ,"#4A57E8"
    ,"#1E9E6A"
)
```

### `Alert Detail`

```dax
Alert Detail =
VAR _rule         = SELECTEDVALUE ( dim_alert_slot[rule_code] )
VAR _code         = SELECTEDVALUE ( dim_alert_slot[entity_code] )
VAR _value        = [Alert Value]
VAR _sign         = IF ( _value < 0, "−", "+" )
RETURN
    IF (
        [Alert Tripped] = 1
        ,SWITCH (
            _rule
            ,"FATIGUE"
                ,CALCULATE (
                    "CTR " & _sign & FORMAT ( ABS ( _value ), "0%" ) & " in 7 d at frequency " & FORMAT ( [Frequency 7d], "0.0" )
                        & " | CPA $" & FORMAT ( [CPA], "#,0" ) & " vs $" & FORMAT ( [CPA Target], "#,0" )
                    ,KEEPFILTERS ( TREATAS ( { _code }, dim_campaign[campaign_key] ) )
                )
            ,"PACING_OVER"
                ,CALCULATE (
                    FORMAT ( [Pacing], "0%" ) & " of plan | $" & FORMAT ( [Spend] / 1000, "#,0.0" ) & "k vs $" & FORMAT ( [Plan] / 1000, "#,0.0" ) & "k"
                    ,KEEPFILTERS ( TREATAS ( { _code }, dim_channel[channel_code] ) )
                )
            ,"INSTALL_QUALITY"
                ,"Install → sign-up " & _sign & FORMAT ( ABS ( _value ) * 100, "0.0" ) & " pt, last 7 d vs previous period"
            ,"ATTR_GAP_WIDEN"
                ,"Gap " & FORMAT ( [Attribution Gap], "+0%;-0%" ) & " vs " & FORMAT ( [Attribution Gap Prev], "+0%;-0%" ) & " in the previous period"
            ,"UNDERSPENT_SCALE"
                ,CALCULATE (
                    FORMAT ( [Pacing], "0%" ) & " of plan with ROAS " & FORMAT ( [ROAS 90d], "0.00" ) & " | room to scale"
                    ,KEEPFILTERS ( TREATAS ( { _code }, dim_channel[channel_code] ) )
                )
            ,"DATA_STALE"
                ,"Oldest source " & FORMAT ( [Synced Hours Ago], "0" ) & " h old"
        )
    )
```

### `Alert Value Text`

```dax
Alert Value Text =
VAR _rule         = SELECTEDVALUE ( dim_alert_slot[rule_code] )
VAR _value        = [Alert Value]
VAR _sign         = IF ( _value < 0, "−", "+" )
RETURN
    IF (
        [Alert Tripped] = 1
        ,SWITCH (
            _rule
            ,"FATIGUE"
                ,_sign & FORMAT ( ABS ( _value ), "0%" )
            ,"PACING_OVER"
                ,"+$" & FORMAT ( _value / 1000, "#,0.0" ) & "k"
            ,"INSTALL_QUALITY"
                ,_sign & FORMAT ( ABS ( _value ) * 100, "0.0" ) & " pt"
            ,"ATTR_GAP_WIDEN"
                ,_sign & FORMAT ( ABS ( _value ) * 100, "0" ) & " pt"
            ,"UNDERSPENT_SCALE"
                ,"$" & FORMAT ( _value / 1000, "#,0.0" ) & "k"
            ,"DATA_STALE"
                ,FORMAT ( _value, "0" ) & " h"
        )
    )
```

### `_Source Age H`

```dax
_Source Age H =
SUMX ( sync_log, ( [_Refreshed] - sync_log[last_sync_ts] ) * 24 )
```

### `Freshness Dot`

```dax
Freshness Dot =
VAR _ages         =
    ADDCOLUMNS (
        ALL ( sync_log )
        ,"@age", ( [_Refreshed] - sync_log[last_sync_ts] ) * 24
    )
VAR _red          = COUNTROWS ( FILTER ( _ages, [@age] >= sync_log[red_after_h] ) )
VAR _amber        = COUNTROWS ( FILTER ( _ages, [@age] >= sync_log[stale_after_h] ) )
RETURN
    SWITCH (
        TRUE ()
        ,_red > 0
            ,3
        ,_amber > 0
            ,2
        ,1
    )
```

### `Synced Hours Ago`

```dax
Synced Hours Ago =
MAXX (
    FILTER ( ALL ( sync_log ), sync_log[cadence] = "HOURLY" )
    ,( [_Refreshed] - sync_log[last_sync_ts] ) * 24
)
```

### `Trend Spend`

```dax
Trend Spend =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
VAR _grain        = [_Granularity]
VAR _day          = MAX ( dim_date[date] )
VAR _bucket_start =
    SWITCH (
        _grain
        ,"WEEK"
            ,MAX ( _start, MAX ( dim_date[week_start] ) )
        ,"MONTH"
            ,MAX ( _start, MAX ( dim_date[month_start] ) )
        ,_day
    )
VAR _bucket_end   =
    SWITCH (
        _grain
        ,"WEEK"
            ,MIN ( _end, MAX ( dim_date[week_start] ) + 6 )
        ,"MONTH"
            ,MIN ( _end, EOMONTH ( _day, 0 ) )
        ,_day
    )
VAR _is_point     = HASONEVALUE ( dim_date[date] ) && _day = _bucket_start && _day >= _start && _day <= _end
RETURN
    IF (
        _is_point
        ,CALCULATE (
            [_b Spend]
            ,REMOVEFILTERS ( dim_date )
            ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _bucket_start && dim_date[date] <= _bucket_end )
        )
    )
```

### `Trend Plan`

```dax
Trend Plan =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
VAR _grain        = [_Granularity]
VAR _day          = MAX ( dim_date[date] )
VAR _bucket_start =
    SWITCH (
        _grain
        ,"WEEK"
            ,MAX ( _start, MAX ( dim_date[week_start] ) )
        ,"MONTH"
            ,MAX ( _start, MAX ( dim_date[month_start] ) )
        ,_day
    )
VAR _bucket_end   =
    SWITCH (
        _grain
        ,"WEEK"
            ,MIN ( _end, MAX ( dim_date[week_start] ) + 6 )
        ,"MONTH"
            ,MIN ( _end, EOMONTH ( _day, 0 ) )
        ,_day
    )
VAR _is_point     = HASONEVALUE ( dim_date[date] ) && _day = _bucket_start && _day >= _start && _day <= _end
RETURN
    IF (
        _is_point
        ,CALCULATE (
            [_b Plan]
            ,REMOVEFILTERS ( dim_date )
            ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _bucket_start && dim_date[date] <= _bucket_end )
        )
    )
```

### `Trend Spend Cmp`

```dax
Trend Spend Cmp =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
VAR _grain        = [_Granularity]
VAR _day          = MAX ( dim_date[date] )
VAR _bucket_start =
    SWITCH (
        _grain
        ,"WEEK"
            ,MAX ( _start, MAX ( dim_date[week_start] ) )
        ,"MONTH"
            ,MAX ( _start, MAX ( dim_date[month_start] ) )
        ,_day
    )
VAR _bucket_end   =
    SWITCH (
        _grain
        ,"WEEK"
            ,MIN ( _end, MAX ( dim_date[week_start] ) + 6 )
        ,"MONTH"
            ,MIN ( _end, EOMONTH ( _day, 0 ) )
        ,_day
    )
VAR _is_point     = HASONEVALUE ( dim_date[date] ) && _day = _bucket_start && _day >= _start && _day <= _end
VAR _mode         = [_Cmp]
VAR _from         = SWITCH ( _mode, "PREV", _bucket_start - _days, "LY", EDATE ( _bucket_start, -12 ) )
VAR _to           = SWITCH ( _mode, "PREV", _bucket_end - _days, "LY", EDATE ( _bucket_end, -12 ) )
RETURN
    IF (
        _is_point && NOT ISBLANK ( _from )
        ,CALCULATE (
            [_b Spend]
            ,REMOVEFILTERS ( dim_date )
            ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _from && dim_date[date] <= _to )
        )
    )
```

### `Trend Paid CAC`

```dax
Trend Paid CAC =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
VAR _grain        = [_Granularity]
VAR _day          = MAX ( dim_date[date] )
VAR _bucket_start =
    SWITCH (
        _grain
        ,"WEEK"
            ,MAX ( _start, MAX ( dim_date[week_start] ) )
        ,"MONTH"
            ,MAX ( _start, MAX ( dim_date[month_start] ) )
        ,_day
    )
VAR _bucket_end   =
    SWITCH (
        _grain
        ,"WEEK"
            ,MIN ( _end, MAX ( dim_date[week_start] ) + 6 )
        ,"MONTH"
            ,MIN ( _end, EOMONTH ( _day, 0 ) )
        ,_day
    )
VAR _is_point     = HASONEVALUE ( dim_date[date] ) && _day = _bucket_start && _day >= _start && _day <= _end
RETURN
    IF (
        _is_point
        ,CALCULATE (
            [_x CPA]
            ,REMOVEFILTERS ( dim_date )
            ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _bucket_start && dim_date[date] <= _bucket_end )
        )
    )
```

### `Trend Paid`

```dax
Trend Paid =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
VAR _grain        = [_Granularity]
VAR _day          = MAX ( dim_date[date] )
VAR _bucket_start =
    SWITCH (
        _grain
        ,"WEEK"
            ,MAX ( _start, MAX ( dim_date[week_start] ) )
        ,"MONTH"
            ,MAX ( _start, MAX ( dim_date[month_start] ) )
        ,_day
    )
VAR _bucket_end   =
    SWITCH (
        _grain
        ,"WEEK"
            ,MIN ( _end, MAX ( dim_date[week_start] ) + 6 )
        ,"MONTH"
            ,MIN ( _end, EOMONTH ( _day, 0 ) )
        ,_day
    )
VAR _is_point     = HASONEVALUE ( dim_date[date] ) && _day = _bucket_start && _day >= _start && _day <= _end
RETURN
    IF (
        _is_point
        ,CALCULATE (
            [_b Paid]
            ,REMOVEFILTERS ( dim_date )
            ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _bucket_start && dim_date[date] <= _bucket_end )
        )
    )
```

### `Trend Spend Selected`

```dax
Trend Spend Selected =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
VAR _grain        = [_Granularity]
VAR _day          = MAX ( dim_date[date] )
VAR _bucket_start =
    SWITCH (
        _grain
        ,"WEEK"
            ,MAX ( _start, MAX ( dim_date[week_start] ) )
        ,"MONTH"
            ,MAX ( _start, MAX ( dim_date[month_start] ) )
        ,_day
    )
VAR _bucket_end   =
    SWITCH (
        _grain
        ,"WEEK"
            ,MIN ( _end, MAX ( dim_date[week_start] ) + 6 )
        ,"MONTH"
            ,MIN ( _end, EOMONTH ( _day, 0 ) )
        ,_day
    )
VAR _is_point     = HASONEVALUE ( dim_date[date] ) && _day = _bucket_start && _day >= _start && _day <= _end
VAR _key          = [_Selected Campaign]
RETURN
    IF (
        _is_point
        ,CALCULATE (
            [_b Spend]
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { _key }, dim_campaign[campaign_key] )
            ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _bucket_start && dim_date[date] <= _bucket_end )
        )
    )
```

### `Trend Paid Selected`

```dax
Trend Paid Selected =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
VAR _grain        = [_Granularity]
VAR _day          = MAX ( dim_date[date] )
VAR _bucket_start =
    SWITCH (
        _grain
        ,"WEEK"
            ,MAX ( _start, MAX ( dim_date[week_start] ) )
        ,"MONTH"
            ,MAX ( _start, MAX ( dim_date[month_start] ) )
        ,_day
    )
VAR _bucket_end   =
    SWITCH (
        _grain
        ,"WEEK"
            ,MIN ( _end, MAX ( dim_date[week_start] ) + 6 )
        ,"MONTH"
            ,MIN ( _end, EOMONTH ( _day, 0 ) )
        ,_day
    )
VAR _is_point     = HASONEVALUE ( dim_date[date] ) && _day = _bucket_start && _day >= _start && _day <= _end
VAR _key          = [_Selected Campaign]
RETURN
    IF (
        _is_point
        ,CALCULATE (
            [_b Paid]
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { _key }, dim_campaign[campaign_key] )
            ,FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _bucket_start && dim_date[date] <= _bucket_end )
        )
    )
```

### `Story Step Date`

```dax
Story Step Date =
DATE ( 2026, 10, 18 )
```

### `Story CAC Step`

```dax
Story CAC Step =
VAR _d            = [Story Step Date]
VAR _cac          =
    ADDCOLUMNS (
        FILTER ( ALL ( dim_date[date] ), dim_date[date] >= _d - 7 && dim_date[date] <= _d + 6 )
        ,"@cac", CALCULATE ( [_x CPA] )
    )
VAR _after        = AVERAGEX ( FILTER ( _cac, dim_date[date] >= _d ), [@cac] )
VAR _before       = AVERAGEX ( FILTER ( _cac, dim_date[date] < _d ), [@cac] )
RETURN
    DIVIDE ( _after, _before ) - 1
```

### `Funnel Value`

```dax
Funnel Value =
SWITCH (
    SELECTEDVALUE ( dim_funnel_stage[stage_code] )
    ,"IMP"
        ,[Impressions]
    ,"CLK"
        ,[Clicks]
    ,"LAND"
        ,[Landed]
    ,"SIGNUP"
        ,[Signups]
    ,"ACT"
        ,[Activated]
    ,"TRIAL"
        ,[Trials]
    ,"PAID"
        ,[Paid Customers]
)
```

### `Funnel Label`

```dax
Funnel Label =
VAR _v            = [Funnel Value]
VAR _txt          = IF ( _v >= 1000000, FORMAT ( _v / 1000000, "0.0" ) & "M", IF ( _v >= 10000, FORMAT ( _v / 1000, "#,0.0" ) & "k", FORMAT ( _v, "#,0" ) ) )
RETURN
    SWITCH (
        SELECTEDVALUE ( dim_funnel_stage[stage_code] )
        ,"IMP"
            ,_txt & "  |  CPM $" & FORMAT ( [CPM], "0.0" )
        ,"CLK"
            ,_txt & "  |  CTR " & FORMAT ( [CTR], "0.00%" ) & " | CPC $" & FORMAT ( [CPC], "0.00" )
        ,"LAND"
            ,_txt & "  |  " & IF ( [Sessions] >= 1000000, FORMAT ( [Sessions] / 1000000, "0.0" ) & "M", IF ( [Sessions] >= 10000, FORMAT ( [Sessions] / 1000, "#,0.0" ) & "k", FORMAT ( [Sessions], "#,0" ) ) ) & " web + " & IF ( [Installs] >= 1000000, FORMAT ( [Installs] / 1000000, "0.0" ) & "M", IF ( [Installs] >= 10000, FORMAT ( [Installs] / 1000, "#,0.0" ) & "k", FORMAT ( [Installs], "#,0" ) ) ) & " installs"
        ,"SIGNUP"
            ,_txt & "  |  " & FORMAT ( [Click Signup Rate], "0.0%" ) & " of clicks | CPL $" & FORMAT ( [CPL], "#,0" )
        ,"ACT"
            ,_txt & "  |  " & FORMAT ( [Activation Rate], "0%" ) & " | $" & FORMAT ( [Cost per Activated], "#,0" )
        ,"TRIAL"
            ,_txt & "  |  " & FORMAT ( [Trial Rate], "0%" ) & " of sign-ups"
        ,"PAID"
            ,FORMAT ( _v, "#,0" ) & "  |  " & FORMAT ( [Trial to Paid], "0.0%" ) & " of trials | CPA $" & FORMAT ( [CPA], "#,0" )
    )
```

### `Funnel Log`

```dax
Funnel Log =
VAR _v = [Funnel Value] RETURN IF ( _v > 0, LOG10 ( _v ) )
```

Format string expression:

```dax
VAR _t           = SUBSTITUTE ( [Funnel Label], """", "'" )
RETURN
    """" & _t & """;""" & _t & """"
```

### `Funnel Axis Max`

```dax
Funnel Axis Max =
MAXX ( ALL ( dim_funnel_stage ), [Funnel Log] ) * 1.85
```

### `O1 Caption`

```dax
O1 Caption =
VAR _tp_d         = [Trial to Paid Δ]
VAR _cs_d         = [Click Signup Rate Δ]
RETURN
    "Trial → paid " & FORMAT ( [Trial to Paid], "0.0%" ) & IF ( NOT ISBLANK ( _tp_d ), " (" & IF ( _tp_d < 0, "−", "+" ) & FORMAT ( ABS ( _tp_d ) * 100, "0.0" ) & " pt" & ")" )
        & "   |   Click → sign-up " & FORMAT ( [Click Signup Rate], "0.0%" ) & IF ( NOT ISBLANK ( _cs_d ), " (" & IF ( _cs_d < 0, "−", "+" ) & FORMAT ( ABS ( _cs_d ) * 100, "0.0" ) & " pt" & ")" )
        & "   |   Cost per paid $" & FORMAT ( [CPA], "#,0" )
```

### `C2 Web Rate`

```dax
C2 Web Rate =
VAR _stage        = SELECTEDVALUE ( dim_c2_stage[stage_code] )
RETURN
    CALCULATE (
        SWITCH (
            _stage
            ,"CLICK"
                ,[CTR]
            ,"LAND"
                ,DIVIDE ( [Sessions], [Clicks] )
            ,"SIGNUP"
                ,DIVIDE ( [Signups], [Sessions] )
            ,"ACT"
                ,[Activation Rate]
            ,"TRIAL"
                ,[Trial Rate]
            ,"PAID"
                ,[Trial to Paid]
        )
        ,KEEPFILTERS ( dim_platform[platform_code] = "WEB" )
    )
```

### `C2 App Rate`

```dax
C2 App Rate =
VAR _stage        = SELECTEDVALUE ( dim_c2_stage[stage_code] )
RETURN
    CALCULATE (
        SWITCH (
            _stage
            ,"CLICK"
                ,[CTR]
            ,"LAND"
                ,DIVIDE ( [Store Views], [Clicks] )
            ,"INSTALL"
                ,[Store CVR]
            ,"SIGNUP"
                ,DIVIDE ( [Signups], [Installs] )
            ,"ACT"
                ,[Activation Rate]
            ,"TRIAL"
                ,[Trial Rate]
            ,"PAID"
                ,[Trial to Paid]
        )
        ,KEEPFILTERS ( dim_platform[platform_code] IN { "IOS", "ANDROID" } )
    )
```

### `C2 Caption`

```dax
C2 Caption =
"Store → install " & FORMAT ( [Store CVR], "0.0%" ) & "   |   install → sign-up " & FORMAT ( [Install Signup Rate], "0.0%" )
    & "   |   web landing → sign-up " & FORMAT ( [Landing Signup Rate], "0.0%" )
```

### `C3 Caption`

```dax
C3 Caption =
VAR _by_channel   =
    ADDCOLUMNS (
        CALCULATETABLE ( VALUES ( dim_channel[channel_name] ), REMOVEFILTERS ( dim_channel ) )
        ,"@gap", [Attribution Gap]
    )
VAR _top          = TOPN ( 1, _by_channel, [@gap], DESC, dim_channel[channel_name], ASC )
RETURN
    "Average over-claim " & FORMAT ( CALCULATE ( [Attribution Gap], REMOVEFILTERS ( dim_channel ) ), "+0%;-0%" )
        & "   |   highest: " & LOWER ( MAXX ( _top, dim_channel[channel_name] ) ) & " " & FORMAT ( MAXX ( _top, [@gap] ), "+0%;-0%" )
```

### `Pacing Colour`

```dax
Pacing Colour =
VAR _pacing       = [Pacing]
RETURN
    SWITCH (
        TRUE ()
        ,_pacing > [_T PACING_HI]
            ,"#D93B4B"
        ,_pacing < [_T PACING_LO]
            ,"#C47A0E"
        ,"#8A94A6"
    )
```

### `C4 Label`

```dax
C4 Label =
FORMAT ( [Pacing], "0%" ) & "  |  " & "$" & FORMAT ( [Spend] / 1000, "#,0.0" ) & "k" & " of " & "$" & FORMAT ( [Plan] / 1000, "#,0.0" ) & "k"
```

### `C4 Pacing Bar`

```dax
C4 Pacing Bar =
[Pacing]
```

Format string expression:

```dax
VAR _t           = SUBSTITUTE ( [C4 Label], """", "'" )
RETURN
    """" & _t & """;""" & _t & """"
```

### `C4 Question`

```dax
C4 Question =
VAR _days         = [_Win Days]
VAR _end          = [_Win End]
VAR _preset       = [_Preset]
VAR _of           =
    SWITCH (
        _preset
        ,"MTD"
            ,DAY ( EOMONTH ( _end, 0 ) )
        ,"QTD"
            ,INT ( EOMONTH ( DATE ( YEAR ( _end ), QUARTER ( _end ) * 3, 1 ), 0 ) - DATE ( YEAR ( _end ), ( QUARTER ( _end ) - 1 ) * 3 + 1, 1 ) ) + 1
        ,_days
    )
RETURN
    "Who is ahead or behind plan at day " & _days & " of " & _of & "?"
```

### `C4 Caption`

```dax
C4 Caption =
"Plan " & "$" & FORMAT ( [Plan] / 1000, "#,0.0" ) & "k" & "   |   spend " & "$" & FORMAT ( [Spend] / 1000, "#,0.0" ) & "k" & " (" & FORMAT ( [Pacing], "0%" ) & " of plan)"
```

### `Spend Share`

```dax
Spend Share =
DIVIDE (
    [Spend]
    ,CALCULATE ( [Spend], REMOVEFILTERS ( dim_channel ), REMOVEFILTERS ( dim_platform[platform_label] ) )
)
```

### `New MRR Share`

```dax
New MRR Share =
DIVIDE (
    [New MRR]
    ,CALCULATE ( [New MRR], REMOVEFILTERS ( dim_channel ), REMOVEFILTERS ( dim_platform[platform_label] ) )
)
```

### `Channel Colour`

```dax
Channel Colour =
SELECTEDVALUE ( dim_channel[color_light], "#4A57E8" )
```

### `Channel Tint`

```dax
Channel Tint =
VAR _hex          = SELECTEDVALUE ( dim_channel[color_light], "#4A57E8" )
VAR _digits       = "0123456789ABCDEF"
VAR _r            = ( SEARCH ( MID ( _hex, 2, 1 ), _digits ) - 1 ) * 16 + SEARCH ( MID ( _hex, 3, 1 ), _digits ) - 1
VAR _g            = ( SEARCH ( MID ( _hex, 4, 1 ), _digits ) - 1 ) * 16 + SEARCH ( MID ( _hex, 5, 1 ), _digits ) - 1
VAR _b            = ( SEARCH ( MID ( _hex, 6, 1 ), _digits ) - 1 ) * 16 + SEARCH ( MID ( _hex, 7, 1 ), _digits ) - 1
VAR _r2           = ROUND ( _r + ( 255 - _r ) * 0.55, 0 )
VAR _g2           = ROUND ( _g + ( 255 - _g ) * 0.55, 0 )
VAR _b2           = ROUND ( _b + ( 255 - _b ) * 0.55, 0 )
RETURN
    "#"
        & MID ( _digits, INT ( _r2 / 16 ) + 1, 1 ) & MID ( _digits, MOD ( _r2, 16 ) + 1, 1 )
        & MID ( _digits, INT ( _g2 / 16 ) + 1, 1 ) & MID ( _digits, MOD ( _g2, 16 ) + 1, 1 )
        & MID ( _digits, INT ( _b2 / 16 ) + 1, 1 ) & MID ( _digits, MOD ( _b2, 16 ) + 1, 1 )
```

### `O4 Caption`

```dax
O4 Caption =
VAR _by_channel   =
    ADDCOLUMNS (
        CALCULATETABLE ( VALUES ( dim_channel[channel_name] ), REMOVEFILTERS ( dim_channel ) )
        ,"@spend", [Spend Share]
        ,"@mrr", [New MRR Share]
    )
VAR _worst        = TOPN ( 1, FILTER ( _by_channel, NOT ISBLANK ( [@spend] ) ), [@spend] - [@mrr], DESC, dim_channel[channel_name], ASC )
RETURN
    MAXX ( _worst, dim_channel[channel_name] ) & " takes " & FORMAT ( MAXX ( _worst, [@spend] ), "0%" ) & " of spend for "
        & FORMAT ( MAXX ( _worst, [@mrr] ), "0%" ) & " of new MRR"
```

### `O3 Caption`

```dax
O3 Caption =
VAR _step         = [Story Step Date]
VAR _delta        = DIVIDE ( [Spend] - [Plan], [Plan] )
RETURN
    "Spend " & "$" & FORMAT ( [Spend] / 1000, "#,0.0" ) & "k" & " vs plan " & "$" & FORMAT ( [Plan] / 1000, "#,0.0" ) & "k" & " (" & IF ( _delta < 0, "−", "+" ) & FORMAT ( ABS ( _delta ), "0.0%" ) & ")"
        & IF ( NOT ISBLANK ( _step ), "   |   CAC stepped up on " & FORMAT ( _step, "mmm d" ) & " (" & FORMAT ( [Story CAC Step], "+0%;-0%" ) & ")" )
```

### `O5 Caption`

```dax
O5 Caption =
VAR _n            = [Alerts Tripped]
VAR _crit         = SUMX ( FILTER ( dim_alert_slot, dim_alert_slot[severity] = "CRIT" ), [Alert Tripped] )
RETURN
    _n & IF ( _n = 1, " alert", " alerts" ) & " in the window   |   " & _crit & " critical"
```

### `O6 Caption`

```dax
O6 Caption =
"Δ ROAS 90 d vs " & IF ( [_Cmp] = "LY", "the same period last year", "the previous period" ) & "   |   three best, three worst"
```

### `O2 Caption`

```dax
O2 Caption =
"Markers = targets (param_target)   |   model " & LOWER ( [_Model Name] )
```

### `C1 Caption`

```dax
C1 Caption =
"Click a row to scope the cards below and the Campaigns view   |   flags from each channel's targets"
```

### `P1 Row Visible`

```dax
P1 Row Visible =
VAR _status       = SELECTEDVALUE ( dim_campaign[status_code] )
RETURN
    IF ( ISFILTERED ( dim_campaign[status_name] ) || _status IN { "LIVE", "LEARNING" }, 1, 0 )
```

### `P1 No Goal`

```dax
P1 No Goal =
SELECTEDVALUE ( dim_campaign[objective_code] ) IN { "LEAD", "RETENTION" }
```

### `P1 CPA`

```dax
P1 CPA =
IF ( [P1 Row Visible] = 1 && NOT ISBLANK ( [Spend] ), IF ( [P1 No Goal], 0, [CPA] ) )
```

Format string expression:

```dax
IF ( [P1 No Goal], """—""", "$#,0" )
```

### `P1 ROAS`

```dax
P1 ROAS =
IF ( [P1 Row Visible] = 1 && NOT ISBLANK ( [Spend] ), IF ( [P1 No Goal], 0, [ROAS 90d] ) )
```

Format string expression:

```dax
IF ( [P1 No Goal], """—""", "0.00" )
```

### `P1 Spend`

```dax
P1 Spend =
IF ( [P1 Row Visible] = 1, [Spend] )
```

### `P1 Pacing`

```dax
P1 Pacing =
IF ( [P1 Row Visible] = 1, [Pacing] )
```

### `P1 Slope`

```dax
P1 Slope =
IF ( [P1 Row Visible] = 1, [CTR Slope 7d] )
```

### `P1 Frequency`

```dax
P1 Frequency =
IF ( [P1 Row Visible] = 1, [Frequency 7d] )
```

### `P1 Flags`

```dax
P1 Flags =
IF ( [P1 Row Visible] = 1, [Flags Text] )
```

### `P1 Caption`

```dax
P1 Caption =
VAR _n            = COUNTROWS ( FILTER ( VALUES ( dim_campaign[campaign_key] ), [P1 Row Visible] = 1 && [Spend] > 0 ) )
RETURN
    _n & " campaigns with spend   |   sorted by spend   |   flags from each campaign's own targets"
```

### `P2 Title`

```dax
P2 Title =
"Selected | " & [Selected Campaign Name]
```

### `P2 Caption`

```dax
P2 Caption =
VAR _key          = [_Selected Campaign]
VAR _row          =
    CALCULATETABLE (
        ROW (
            "@cpa", [CPA]
            ,"@target", [CPA Target]
            ,"@status", SELECTEDVALUE ( dim_campaign[status_code] )
            ,"@learn", SELECTEDVALUE ( dim_campaign[learning_end_date] )
        )
        ,TREATAS ( { _key }, dim_campaign[campaign_key] )
    )
VAR _cpa          = MAXX ( _row, [@cpa] )
VAR _target       = MAXX ( _row, [@target] )
VAR _status       = MAXX ( _row, [@status] )
VAR _learn        = MAXX ( _row, [@learn] )
RETURN
    IF ( NOT ISBLANK ( _cpa ), "CPA $" & FORMAT ( _cpa, "#,0" ) & IF ( NOT ISBLANK ( _target ), " (target $" & FORMAT ( _target, "#,0" ) & ")" ), "No paid conversions" )
        & "   |   " & IF ( _status = "LEARNING", "Learning phase ends ", "Learning phase ended " ) & FORMAT ( _learn, "mmm d" )
```

### `P3 Caption`

```dax
P3 Caption =
"Dashed line: campaign CPA target $" & FORMAT ( [P3 CPA Target], "#,0" ) & "   |   DDA credits"
```

### `P4 Caption`

```dax
P4 Caption =
"Fatigued when the CTR 7-day slope is below " & FORMAT ( [_T FATIGUE_SLOPE], "0%" ) & " and frequency above " & FORMAT ( [_T FATIGUE_FREQ], "0" )
    & "   |   Watch: slope below 0 at frequency above " & FORMAT ( [_T WATCH_FREQ], "0.0" )
```

### `P5 Caption`

```dax
P5 Caption =
VAR _key          = [_Selected Campaign]
VAR _channel      = CALCULATE ( SELECTEDVALUE ( dim_campaign[channel_code] ), REMOVEFILTERS ( dim_campaign ), dim_campaign[campaign_key] = _key )
RETURN
    IF ( _channel = "PAID_SEARCH" || _key = "APP_ASA_CORE", "Keywords of ", "Placements and audiences of " ) & [Selected Campaign Name]
```

### `P4 Row Visible`

```dax
P4 Row Visible =
VAR _key          = [_Selected Campaign]
RETURN
    IF ( CALCULATE ( [_Creative Live], TREATAS ( { _key }, dim_campaign[campaign_key] ) ), 1, 0 )
```

### `_Filter Count`

```dax
_Filter Count =
INT ( ISFILTERED ( dim_platform[platform_name] ) )
    + INT ( ISFILTERED ( dim_campaign[market_name] ) )
    + INT ( ISFILTERED ( dim_campaign[tier_name] ) )
    + INT ( ISFILTERED ( dim_campaign[channel_name] ) || ISFILTERED ( dim_campaign[network_name] ) )
    + INT ( ISFILTERED ( dim_campaign[campaign_name] ) )
    + INT ( ISFILTERED ( dim_campaign[status_name] ) )
    + INT ( [_Model] <> "DDA" )
```

### `Chips Line`

```dax
Chips Line =
VAR _platform     = IF ( ISFILTERED ( dim_platform[platform_name] ), "Platform: " & CONCATENATEX ( VALUES ( dim_platform ), dim_platform[platform_name], " + ", dim_platform[sort_order], ASC ) & " | " )
VAR _market       = IF (
        ISFILTERED ( dim_campaign[market_name] )
        ,"Market: " & CONCATENATEX ( VALUES ( dim_campaign[market_name] ), dim_campaign[market_name], " + ", dim_campaign[market_name], ASC ) & " | "
    )
VAR _tier         = IF (
        ISFILTERED ( dim_campaign[tier_name] )
        ,"Tier: " & CONCATENATEX ( VALUES ( dim_campaign[tier_name] ), dim_campaign[tier_name], " + ", dim_campaign[tier_name], ASC ) & " | "
    )
VAR _channel      = IF (
        ISFILTERED ( dim_campaign[channel_name] )
        ,"Channel: " & CONCATENATEX ( VALUES ( dim_campaign[channel_name] ), dim_campaign[channel_name], " + ", dim_campaign[channel_name], ASC ) & " | "
    )
VAR _network      = IF (
        ISFILTERED ( dim_campaign[network_name] )
        ,"Network: " & CONCATENATEX ( VALUES ( dim_campaign[network_name] ), dim_campaign[network_name], " + ", dim_campaign[network_name], ASC ) & " | "
    )
VAR _campaigns    = IF ( ISFILTERED ( dim_campaign[campaign_name] ), "Campaign: " & IF ( COUNTROWS ( VALUES ( dim_campaign[campaign_name] ) ) = 1, VALUES ( dim_campaign[campaign_name] ), COUNTROWS ( VALUES ( dim_campaign[campaign_name] ) ) & " picked" ) & " | " )
VAR _status       = IF (
        ISFILTERED ( dim_campaign[status_name] )
        ,"Status: " & CONCATENATEX ( VALUES ( dim_campaign[status_name] ), dim_campaign[status_name], " + ", dim_campaign[status_name], ASC ) & " | "
    )
VAR _model        = IF ( [_Model] <> "DDA", "Attribution: " & [_Model Name] & " | " )
VAR _selected     =
    SWITCH (
        TRUE ()
        ,ISFILTERED ( dim_campaign[campaign_label] )
            ,"Selected: " & CONCATENATEX ( VALUES ( dim_campaign[campaign_label] ), dim_campaign[campaign_label], " + " ) & " | "
        ,ISFILTERED ( dim_channel[channel_name] )
            ,"Selected: " & CONCATENATEX ( VALUES ( dim_channel[channel_name] ), dim_channel[channel_name], " + " )
                & IF ( ISFILTERED ( dim_platform[platform_label] ), " | " & CONCATENATEX ( VALUES ( dim_platform[platform_label] ), dim_platform[platform_label], " + " ) )
                & " | "
    )
VAR _line         = _platform & _market & _tier & _channel & _network & _campaigns & _status & _model & _selected
RETURN
    IF ( LEN ( _line ) > 0, LEFT ( _line, LEN ( _line ) - 3 ), " " )
```

### `Period Pill Text`

```dax
Period Pill Text =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _mode         = [_Cmp]
VAR _days         = [_Win Days]
VAR _basis        =
    SWITCH (
        _mode
        ,"PREV"
            ,"vs prior " & _days & " d"
        ,"LY"
            ,"vs same period LY"
        ,"PLAN"
            ,"vs plan"
        ,"no comparison"
    )
RETURN
    FORMAT ( _start, "mmm d" ) & " – " & FORMAT ( _end, "mmm d" ) & IF ( YEAR ( _end ) <> YEAR ( [_As Of] ), " " & YEAR ( _end ) ) & "  |  " & _basis
```

### `Synced Text`

```dax
Synced Text =
VAR _h            = [Synced Hours Ago]
RETURN
    "Synced " & IF ( _h < 1, "under 1 h", INT ( _h ) & " h" ) & " ago"
```

### `Freshness Colour`

```dax
Freshness Colour =
SWITCH ( [Freshness Dot], 3, "#D93B4B", 2, "#C47A0E", "#1E9E6A" )
```

### `Footer Line`

```dax
Footer Line =
VAR _model        = [_Model Name]
VAR _sources      =
    CONCATENATEX (
        ALL ( sync_log )
        ,SWITCH ( sync_log[source_code], "AD_PLATFORMS", "Ad platforms", "WEB_ANALYTICS", "Web analytics", "PRODUCT_EVENTS", "Product events", "ATTRIBUTION", "Attribution", sync_log[source_name] )
            & " " & FORMAT ( sync_log[last_sync_ts], "hh:nn" )
        ," | "
        ,sync_log[last_sync_ts], DESC
    )
RETURN
    "Attribution: " & _model & ", 30-day click / 1-day view   |   Currency: USD   |   " & _sources & "   |   Figures are illustrative"
```

### `Filters Button Text`

```dax
Filters Button Text =
VAR _n            = [_Filter Count]
RETURN
    "Filters" & IF ( _n > 0, "  " & _n )
```

### `Applied State`

```dax
Applied State =
VAR _period       = SUBSTITUTE ( [Period Pill Text], "|", "¦" )
VAR _platform     = IF ( ISFILTERED ( dim_platform[platform_name] ), CONCATENATEX ( VALUES ( dim_platform ), dim_platform[platform_name], " + ", dim_platform[sort_order], ASC ), "all platforms" )
VAR _channel      = IF ( ISFILTERED ( dim_campaign[channel_name] ) || ISFILTERED ( dim_campaign[network_name] ), CONCATENATEX ( VALUES ( dim_campaign[channel_name] ), dim_campaign[channel_name], " + ", dim_campaign[channel_name], ASC ), "all channels" )
VAR _market       = IF ( ISFILTERED ( dim_campaign[market_name] ), CONCATENATEX ( VALUES ( dim_campaign[market_name] ), dim_campaign[market_name], " + " ), "all markets" )
VAR _tier         = IF ( ISFILTERED ( dim_campaign[tier_name] ), CONCATENATEX ( VALUES ( dim_campaign[tier_name] ), dim_campaign[tier_name], " + " ), "all tiers" )
VAR _status       = IF ( ISFILTERED ( dim_campaign[status_name] ), CONCATENATEX ( VALUES ( dim_campaign[status_name] ), dim_campaign[status_name], " + " ), "Live + Learning (list)" )
VAR _model        = [_Model Name]
VAR _active       =
    CALCULATETABLE (
        FILTER ( VALUES ( dim_campaign[campaign_key] ), [Spend] > 0 )
    )
VAR _n_campaigns  = COUNTROWS ( _active )
VAR _n_channels   = COUNTROWS ( SUMMARIZE ( FILTER ( dim_campaign, dim_campaign[campaign_key] IN _active ), dim_campaign[channel_code] ) )
VAR _n_platforms  = COUNTROWS ( SUMMARIZE ( FILTER ( dim_campaign, dim_campaign[campaign_key] IN _active ), dim_campaign[platform_code] ) )
RETURN
    _period & "|" & _platform & "|" & _market & " ¦ " & _tier & "|" & _channel & "|" & _status & "|" & _model & "|"
        & _n_campaigns + 0 & " campaigns ¦ " & _n_channels + 0 & " channels|" & _n_platforms + 0 & " platforms"
```

### `Info Glyph`

```dax
Info Glyph =
"i"
```

### `Card Info Title`

```dax
Card Info Title =
SELECTEDVALUE ( dim_card[card_title] )
```

### `Card Info What`

```dax
Card Info What =
SELECTEDVALUE ( dim_card[card_what] )
```

### `Card Info Formula`

```dax
Card Info Formula =
SELECTEDVALUE ( dim_card[card_formula] )
```

### `Card Info Note`

```dax
Card Info Note =
VAR _model        = [_Model Name]
RETURN
    SELECTEDVALUE ( dim_card[card_note] ) & "   Window " & [Period Pill Text] & " | model " & _model & "."
```

### `_O5 Rank Mode`

```dax
_O5 Rank Mode =
SELECTEDVALUE ( param_o5_rank[rank_code], "WORST" )
```

### `_O6 Rank Mode`

```dax
_O6 Rank Mode =
SELECTEDVALUE ( param_o6_rank[rank_code], "WORST" )
```

### `Paid Customers Basis`

```dax
Paid Customers Basis =
SWITCH (
    [_Cmp]
    ,"LY"
        ,[Paid Customers LY]
    ,[Paid Customers Prev]
)
```

### `Anomaly Delta`

```dax
Anomaly Delta =
VAR _start        = [_Mv Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
VAR _is_ly        = [_Cmp] = "LY"
VAR _b_start      = IF ( _is_ly, EDATE ( _start, -12 ), _start - _days )
VAR _b_end        = IF ( _is_ly, EDATE ( _end, -12 ), _start - 1 )
VAR _spend        =
    CALCULATE (
        [_b Spend]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
VAR _spend_basis  =
    CALCULATE (
        [_b Spend]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _b_start
                && dim_date[date] <= _b_end
        )
    )
VAR _paid         =
    CALCULATE (
        [_b Paid]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
VAR _paid_basis   =
    CALCULATE (
        [_b Paid]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _b_start
                && dim_date[date] <= _b_end
        )
    )
RETURN
    IF (
        HASONEVALUE ( dim_campaign[campaign_key] )
            && _spend > 0
            && _spend_basis > 0
        ,_paid - _paid_basis
    )
```

### `O5 Rank`

```dax
O5 Rank =
VAR _mode         = [_O5 Rank Mode]
VAR _me           = SELECTEDVALUE ( dim_campaign[campaign_key] )
VAR _deltas       =
    CALCULATETABLE (
        FILTER (
            ADDCOLUMNS (
                VALUES ( dim_campaign[campaign_key] )
                ,"@d", [Anomaly Delta]
            )
            ,IF ( _mode = "TOP", [@d] > 0, [@d] < 0 )
        )
        ,REMOVEFILTERS ( dim_campaign[campaign_key] )
        ,REMOVEFILTERS ( dim_campaign[campaign_label] )
        ,REMOVEFILTERS ( dim_campaign[sort_order] )
    )
VAR _mine         = MAXX ( FILTER ( _deltas, dim_campaign[campaign_key] = _me ), [@d] )
VAR _ahead        =
    COUNTROWS (
        FILTER (
            _deltas
            ,IF ( _mode = "TOP", [@d] > _mine, [@d] < _mine )
        )
    ) + 0
RETURN
    IF ( NOT ISBLANK ( _mine ) && _ahead < 5, _ahead + 1 )
```

### `O5 Visible`

```dax
O5 Visible =
IF ( NOT ISBLANK ( [O5 Rank] ), 1, 0 )
```

### `O5 Channel`

```dax
O5 Channel =
IF ( [O5 Visible] = 1, SELECTEDVALUE ( dim_campaign[channel_name] ) )
```

### `O5 Paid Now`

```dax
O5 Paid Now =
VAR _start        = [_Mv Start]
VAR _end          = [_Win End]
RETURN
    IF (
        [O5 Visible] = 1
        ,CALCULATE (
            [_b Paid] + 0
            ,REMOVEFILTERS ( dim_date )
            ,FILTER (
                ALL ( dim_date[date] )
                ,dim_date[date] >= _start
                    && dim_date[date] <= _end
            )
        )
    )
```

### `O5 Paid Before`

```dax
O5 Paid Before =
VAR _start        = [_Mv Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
VAR _is_ly        = [_Cmp] = "LY"
VAR _b_start      = IF ( _is_ly, EDATE ( _start, -12 ), _start - _days )
VAR _b_end        = IF ( _is_ly, EDATE ( _end, -12 ), _start - 1 )
RETURN
    IF (
        [O5 Visible] = 1
        ,CALCULATE (
            [_b Paid] + 0
            ,REMOVEFILTERS ( dim_date )
            ,FILTER (
                ALL ( dim_date[date] )
                ,dim_date[date] >= _b_start
                    && dim_date[date] <= _b_end
            )
        )
    )
```

### `O5 Delta`

```dax
O5 Delta =
IF ( [O5 Visible] = 1, [Anomaly Delta] )
```

### `O5 Colour`

```dax
O5 Colour =
VAR _d = [O5 Delta] RETURN IF ( NOT ISBLANK ( _d ), IF ( _d >= 0, "#1E9E6A", "#D93B4B" ) )
```

### `O5 Alert`

```dax
O5 Alert =
VAR _start        = [_Mv Start]
VAR _end          = [_Win End]
VAR _key          = SELECTEDVALUE ( dim_campaign[campaign_key] )
RETURN
    IF (
        [O5 Visible] = 1
        ,CALCULATE (
            VAR _slots        =
                FILTER (
                    ADDCOLUMNS (
                        FILTER (
                            ALL ( dim_alert_slot )
                            ,dim_alert_slot[entity_type] = "CAMPAIGN"
                                && dim_alert_slot[entity_code] = _key
                        )
                        ,"@t", [Alert Tripped]
                    )
                    ,[@t] = 1
                )
            VAR _top          = TOPN ( 1, _slots, dim_alert_slot[severity_rank], ASC, dim_alert_slot[rule_order], ASC )
            RETURN
                MAXX ( _top, dim_alert_slot[title] )
            ,REMOVEFILTERS ( param_period_preset )
            ,TREATAS ( { "CUSTOM" }, param_period_preset[preset_code] )
            ,REMOVEFILTERS ( param_date )
            ,param_date[date] >= _start
            ,param_date[date] <= _end
        )
    )
```

### `O6 Rank`

```dax
O6 Rank =
VAR _mode         = [_O6 Rank Mode]
VAR _me           = SELECTEDVALUE ( dim_campaign[campaign_key] )
VAR _deltas       =
    CALCULATETABLE (
        FILTER (
            ADDCOLUMNS (
                VALUES ( dim_campaign[campaign_key] )
                ,"@d", [ROAS Delta]
            )
            ,IF ( _mode = "TOP", [@d] > 0, [@d] < 0 )
        )
        ,REMOVEFILTERS ( dim_campaign[campaign_key] )
        ,REMOVEFILTERS ( dim_campaign[campaign_label] )
        ,REMOVEFILTERS ( dim_campaign[sort_order] )
    )
VAR _mine         = MAXX ( FILTER ( _deltas, dim_campaign[campaign_key] = _me ), [@d] )
VAR _ahead        =
    COUNTROWS (
        FILTER (
            _deltas
            ,IF ( _mode = "TOP", [@d] > _mine, [@d] < _mine )
        )
    ) + 0
RETURN
    IF ( NOT ISBLANK ( _mine ) && _ahead < 5, _ahead + 1 )
```

### `O6 Visible`

```dax
O6 Visible =
IF ( NOT ISBLANK ( [O6 Rank] ), 1, 0 )
```

### `O6 Bar`

```dax
O6 Bar =
IF ( [O6 Visible] = 1, ABS ( [ROAS Delta] ) )
```

Format string expression:

```dax
IF ( [_O6 Rank Mode] = "TOP", """+""0.00", """−""0.00" )
```

### `O6 Colour`

```dax
O6 Colour =
IF ( [O6 Visible] = 1, IF ( [_O6 Rank Mode] = "TOP", "#1E9E6A", "#D93B4B" ) )
```

### `_x Churned`

```dax
_x Churned =
VAR _last         = [_x Last Complete Month]
RETURN
    CALCULATE (
        SUM ( fact_cohort_revenue_month[churned] )
        ,fact_cohort_revenue_month[month_offset] >= 1
        ,fact_cohort_revenue_month[calendar_month_index] >= _last - 2
        ,fact_cohort_revenue_month[calendar_month_index] <= _last
    )
```

### `_x Refunds`

```dax
_x Refunds =
VAR _month        = [_x Month Index End]
RETURN
    CALCULATE (
        SUM ( fact_cohort_revenue_month[refund_count] )
        ,fact_cohort_revenue_month[cohort_month_index] >= _month - 11
        ,fact_cohort_revenue_month[cohort_month_index] <= _month
    )
```

### `Churned Customers`

```dax
Churned Customers =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Churned]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Refunds`

```dax
Refunds =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Refunds]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `P6 Rank`

```dax
P6 Rank =
VAR _me           = SELECTEDVALUE ( dim_channel[channel_code] )
VAR _by           =
    CALCULATETABLE (
        FILTER (
            ADDCOLUMNS (
                VALUES ( dim_channel[channel_code] )
                ,"@v", [Churned Customers]
            )
            ,[@v] > 0
        )
        ,REMOVEFILTERS ( dim_channel[channel_code] )
        ,REMOVEFILTERS ( dim_channel[channel_name] )
        ,REMOVEFILTERS ( dim_channel[sort_order] )
    )
VAR _mine         = MAXX ( FILTER ( _by, dim_channel[channel_code] = _me ), [@v] )
VAR _ahead        = COUNTROWS ( FILTER ( _by, [@v] > _mine ) ) + 0
RETURN
    IF ( NOT ISBLANK ( _mine ) && _ahead < 5, _ahead + 1 )
```

### `P6 Visible`

```dax
P6 Visible =
IF ( NOT ISBLANK ( [P6 Rank] ), 1, 0 )
```

### `P6 Churned`

```dax
P6 Churned =
IF ( [P6 Visible] = 1, [Churned Customers] )
```

### `P7 Rank`

```dax
P7 Rank =
VAR _me           = SELECTEDVALUE ( dim_channel[channel_code] )
VAR _by           =
    CALCULATETABLE (
        FILTER (
            ADDCOLUMNS (
                VALUES ( dim_channel[channel_code] )
                ,"@v", [Refunds]
            )
            ,[@v] > 0
        )
        ,REMOVEFILTERS ( dim_channel[channel_code] )
        ,REMOVEFILTERS ( dim_channel[channel_name] )
        ,REMOVEFILTERS ( dim_channel[sort_order] )
    )
VAR _mine         = MAXX ( FILTER ( _by, dim_channel[channel_code] = _me ), [@v] )
VAR _ahead        = COUNTROWS ( FILTER ( _by, [@v] > _mine ) ) + 0
RETURN
    IF ( NOT ISBLANK ( _mine ) && _ahead < 5, _ahead + 1 )
```

### `P7 Visible`

```dax
P7 Visible =
IF ( NOT ISBLANK ( [P7 Rank] ), 1, 0 )
```

### `P7 Refunds`

```dax
P7 Refunds =
IF ( [P7 Visible] = 1, [Refunds] )
```

### `_K1 Heat Month`

```dax
_K1 Heat Month =
VAR _end          = [_Cohort End Index]
VAR _m            = SELECTEDVALUE ( dim_month[month_index] )
RETURN
    NOT ISBLANK ( _m ) && _m < _end && _m >= _end - 12
```

### `K1 Heat`

```dax
K1 Heat =
VAR _k            = SELECTEDVALUE ( dim_offset[month_offset] )
RETURN
    IF ( [_K1 Heat Month] && _k <= 11, [Cohort Payback At] )
```

### `K1 Heat Colour`

```dax
K1 Heat Colour =
VAR _v            = [K1 Heat]
VAR _t            = MIN ( MAX ( _v, 0 ), 1 ) * 0.80 + 0.06
VAR _digits       = "0123456789ABCDEF"
VAR _r            = ROUND ( 255 - ( 255 - 74 ) * _t, 0 )
VAR _g            = ROUND ( 255 - ( 255 - 87 ) * _t, 0 )
VAR _b            = ROUND ( 255 - ( 255 - 232 ) * _t, 0 )
VAR _hex          =
    "#"
        & MID ( _digits, INT ( _r / 16 ) + 1, 1 ) & MID ( _digits, MOD ( _r, 16 ) + 1, 1 )
        & MID ( _digits, INT ( _g / 16 ) + 1, 1 ) & MID ( _digits, MOD ( _g, 16 ) + 1, 1 )
        & MID ( _digits, INT ( _b / 16 ) + 1, 1 ) & MID ( _digits, MOD ( _b, 16 ) + 1, 1 )
RETURN
    SWITCH (
        TRUE ()
        ,ISBLANK ( _v )
            ,"#FFFFFF"
        ,_v >= 1
            ,"#1E9E6A"
        ,_hex
    )
```

### `K1 Heat Ink`

```dax
K1 Heat Ink =
IF ( [K1 Heat] >= 0.55, "#FFFFFF", "#111827" )
```

### `Signups LY`

```dax
Signups LY =
VAR _start        = EDATE ( [_Win Start], -12 )
VAR _end          = EDATE ( [_Win End], -12 )
RETURN
    CALCULATE (
        [_b Signups]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Signup to Paid`

```dax
Signup to Paid =
DIVIDE ( [Paid Customers], [Signups] )
```

### `Signup to Paid LY`

```dax
Signup to Paid LY =
DIVIDE ( [Paid Customers LY], [Signups LY] )
```

### `Act Median Hours LY`

```dax
Act Median Hours LY =
VAR _start        = EDATE ( [_Win Start], -12 )
VAR _end          = EDATE ( [_Win End], -12 )
RETURN
    CALCULATE (
        [_x Act Median Hours]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Time to Activation Days`

```dax
Time to Activation Days =
DIVIDE ( [Act Median Hours], 24 )
```

### `Time to Activation Days LY`

```dax
Time to Activation Days LY =
DIVIDE ( [Act Median Hours LY], 24 )
```

### `Payback Target`

```dax
Payback Target =
[_T PAYBACK_MONTHS]
```

### `Paid Customers CAC Bar`

```dax
Paid Customers CAC Bar =
[Paid Customers]
```

Format string expression:

```dax
VAR _cac          = [Paid CAC]
RETURN
    IF ( ISBLANK ( _cac ), "#,0", "#,0""  |  $" & FORMAT ( _cac, "#,0" ) & """" )
```

### `Dyn Spend`

```dax
Dyn Spend =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on
        ,CALCULATE (
            [_b Spend]
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { _day }, dim_date[date] )
        )
    )
```

### `Dyn Spend LY`

```dax
Dyn Spend LY =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on
        ,CALCULATE (
            [_b Spend]
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { EDATE ( _day, -12 ) }, dim_date[date] )
        )
    )
```

### `Dyn Spend Last`

```dax
Dyn Spend Last =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on && _day = _end
        ,CALCULATE (
            [_b Spend]
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { _day }, dim_date[date] )
        )
    )
```

### `Dyn New Clients`

```dax
Dyn New Clients =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on
        ,CALCULATE (
            [_b Signups]
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { _day }, dim_date[date] )
        )
    )
```

### `Dyn New Clients LY`

```dax
Dyn New Clients LY =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on
        ,CALCULATE (
            [_b Signups]
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { EDATE ( _day, -12 ) }, dim_date[date] )
        )
    )
```

### `Dyn New Clients Last`

```dax
Dyn New Clients Last =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on && _day = _end
        ,CALCULATE (
            [_b Signups]
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { _day }, dim_date[date] )
        )
    )
```

### `Dyn Conversion`

```dax
Dyn Conversion =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on
        ,CALCULATE (
            DIVIDE ( [_b Paid], [_b Signups] )
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { _day }, dim_date[date] )
        )
    )
```

### `Dyn Conversion LY`

```dax
Dyn Conversion LY =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on
        ,CALCULATE (
            DIVIDE ( [_b Paid], [_b Signups] )
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { EDATE ( _day, -12 ) }, dim_date[date] )
        )
    )
```

### `Dyn Conversion Last`

```dax
Dyn Conversion Last =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on && _day = _end
        ,CALCULATE (
            DIVIDE ( [_b Paid], [_b Signups] )
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { _day }, dim_date[date] )
        )
    )
```

### `Dyn Time to Activation`

```dax
Dyn Time to Activation =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on
        ,CALCULATE (
            DIVIDE ( [_x Act Median Hours], 24 )
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { _day }, dim_date[date] )
        )
    )
```

### `Dyn Time to Activation LY`

```dax
Dyn Time to Activation LY =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on
        ,CALCULATE (
            DIVIDE ( [_x Act Median Hours], 24 )
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { EDATE ( _day, -12 ) }, dim_date[date] )
        )
    )
```

### `Dyn Time to Activation Last`

```dax
Dyn Time to Activation Last =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on && _day = _end
        ,CALCULATE (
            DIVIDE ( [_x Act Median Hours], 24 )
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { _day }, dim_date[date] )
        )
    )
```

### `Dyn CAC`

```dax
Dyn CAC =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on
        ,CALCULATE (
            [_x CPA]
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { _day }, dim_date[date] )
        )
    )
```

### `Dyn CAC LY`

```dax
Dyn CAC LY =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on
        ,CALCULATE (
            [_x CPA]
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { EDATE ( _day, -12 ) }, dim_date[date] )
        )
    )
```

### `Dyn CAC Last`

```dax
Dyn CAC Last =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on && _day = _end
        ,CALCULATE (
            [_x CPA]
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { _day }, dim_date[date] )
        )
    )
```

### `Dyn ROAS`

```dax
Dyn ROAS =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on
        ,CALCULATE (
            [_x ROAS 90d]
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { _day }, dim_date[date] )
        )
    )
```

### `Dyn ROAS LY`

```dax
Dyn ROAS LY =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on
        ,CALCULATE (
            [_x ROAS 90d]
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { EDATE ( _day, -12 ) }, dim_date[date] )
        )
    )
```

### `Dyn ROAS Last`

```dax
Dyn ROAS Last =
VAR _end          = [_Win End]
VAR _start        = IF ( [_Win Days] > 90, _end - 29, [_Win Start] )
VAR _day          = MAX ( dim_date[date] )
VAR _on           = HASONEVALUE ( dim_date[date] ) && _day >= _start && _day <= _end
RETURN
    IF (
        _on && _day = _end
        ,CALCULATE (
            [_x ROAS 90d]
            ,REMOVEFILTERS ( dim_date )
            ,TREATAS ( { _day }, dim_date[date] )
        )
    )
```

### `_b Traffic Signups`

```dax
_b Traffic Signups =
SUM ( fact_traffic_day[signups] )
```

### `_b Bounces`

```dax
_b Bounces =
SUM ( fact_traffic_day[bounces] )
```

### `_b LCP Weighted`

```dax
_b LCP Weighted =
SUMX ( fact_traffic_day, fact_traffic_day[lcp_ms_p75] * fact_traffic_day[sessions] )
```

### `_x Page CVR`

```dax
_x Page CVR =
VAR _store        = [_b Store Views]
VAR _sessions     = [_b Sessions]
RETURN
    IF ( _store > 0, DIVIDE ( [_b Installs], _store ), DIVIDE ( [_b Traffic Signups], _sessions ) )
```

### `_x Page Bounce Rate`

```dax
_x Page Bounce Rate =
DIVIDE ( [_b Bounces], [_b Sessions] )
```

### `_x Page LCP`

```dax
_x Page LCP =
DIVIDE ( [_b LCP Weighted], [_b Sessions] )
```

### `_x Step Share`

```dax
_x Step Share =
VAR _signups      = [_b Signups]
RETURN
    SWITCH (
        SELECTEDVALUE ( dim_onboarding_step[step_code] )
        ,"SIGNUP"
            ,IF ( _signups > 0, 1 )
        ,"VERIFY_EMAIL"
            ,DIVIDE ( SUM ( fact_funnel_day[step_verified] ), _signups )
        ,"CREATE_WORKSPACE"
            ,DIVIDE ( SUM ( fact_funnel_day[step_workspace] ), _signups )
        ,"CONNECT_SOURCE"
            ,DIVIDE ( SUM ( fact_funnel_day[step_connected] ), _signups )
        ,"FIRST_DASHBOARD"
            ,DIVIDE ( SUM ( fact_funnel_day[step_first_dashboard] ), _signups )
        ,"INVITE"
            ,DIVIDE ( SUM ( fact_funnel_day[step_invited] ), _signups )
    )
```

### `_b Act Bin`

```dax
_b Act Bin =
SWITCH (
    SELECTEDVALUE ( dim_act_bin[bin_code] )
    ,"LT1H"
        ,SUM ( fact_funnel_day[act_lt1h] )
    ,"H1_6"
        ,SUM ( fact_funnel_day[act_1_6h] )
    ,"H6_24"
        ,SUM ( fact_funnel_day[act_6_24h] )
    ,"D1_2"
        ,SUM ( fact_funnel_day[act_1_2d] )
    ,"D2_4"
        ,SUM ( fact_funnel_day[act_2_4d] )
    ,"D4_7"
        ,SUM ( fact_funnel_day[act_4_7d] )
    ,"D7_30"
        ,SUM ( fact_funnel_day[act_7_30d] )
)
```

### `_b Act Total`

```dax
_b Act Total =
SUM ( fact_funnel_day[act_lt1h] ) + SUM ( fact_funnel_day[act_1_6h] ) + SUM ( fact_funnel_day[act_6_24h] ) + SUM ( fact_funnel_day[act_1_2d] ) + SUM ( fact_funnel_day[act_2_4d] ) + SUM ( fact_funnel_day[act_4_7d] ) + SUM ( fact_funnel_day[act_7_30d] )
```

### `_x Act Share`

```dax
_x Act Share =
DIVIDE ( [_b Act Bin], [_b Act Total] )
```

### `_x Act Median Hours`

```dax
_x Act Median Hours =
VAR _total        = [_b Act Total]
VAR _bins         =
    ADDCOLUMNS (
        ALL ( dim_act_bin )
        ,"@n", [_b Act Bin]
    )
VAR _cum          =
    ADDCOLUMNS (
        _bins
        ,"@c",
            VAR _s        = dim_act_bin[sort_order]
            RETURN
                DIVIDE ( SUMX ( FILTER ( _bins, dim_act_bin[sort_order] <= _s ), [@n] ), _total )
    )
VAR _median_bin   = TOPN ( 1, FILTER ( _cum, [@c] >= 0.5 ), dim_act_bin[sort_order], ASC )
VAR _order        = MAXX ( _median_bin, dim_act_bin[sort_order] )
VAR _c            = MAXX ( _median_bin, [@c] )
VAR _lo           = MAXX ( FILTER ( _cum, dim_act_bin[sort_order] = _order - 1 ), [@c] ) + 0
VAR _from         = MAXX ( _median_bin, dim_act_bin[lo_hours] )
VAR _to           = MAXX ( _median_bin, dim_act_bin[hi_hours] )
RETURN
    IF ( _total > 0, _from + DIVIDE ( 0.5 - _lo, _c - _lo ) * ( _to - _from ) )
```

### `_x Segment Signups`

```dax
_x Segment Signups =
SUM ( fact_signup_segment_day[signups] )
```

### `_x Segment Activation`

```dax
_x Segment Activation =
DIVIDE ( SUM ( fact_signup_segment_day[activated_7d] ), SUM ( fact_signup_segment_day[signups] ) )
```

### `Page Visits`

```dax
Page Visits =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Sessions] + [_b Store Views]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Page CVR`

```dax
Page CVR =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Page CVR]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Page Bounce Rate`

```dax
Page Bounce Rate =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Page Bounce Rate]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Page LCP`

```dax
Page LCP =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Page LCP]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Step Share`

```dax
Step Share =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Step Share]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Act Bin Count`

```dax
Act Bin Count =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_b Act Bin]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Act Share`

```dax
Act Share =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Act Share]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Act Median Hours`

```dax
Act Median Hours =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Act Median Hours]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Segment Signups`

```dax
Segment Signups =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Segment Signups]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Segment Activation`

```dax
Segment Activation =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        [_x Segment Activation]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start
                && dim_date[date] <= _end
        )
    )
```

### `Page CVR Prev`

```dax
Page CVR Prev =
VAR _start        = [_Win Start]
VAR _end          = [_Win End]
VAR _days         = INT ( _end - _start ) + 1
RETURN
    CALCULATE (
        [_x Page CVR]
        ,REMOVEFILTERS ( dim_date )
        ,FILTER (
            ALL ( dim_date[date] )
            ,dim_date[date] >= _start - _days
                && dim_date[date] <= _start - 1
        )
    )
```

### `_J1 Store`

```dax
_J1 Store =
SELECTEDVALUE ( dim_landing_page[page_type] ) IN { "APP_STORE", "PLAY_STORE" }
```

### `J1 Bounce`

```dax
J1 Bounce =
IF ( NOT ISBLANK ( [Page Visits] ), IF ( [_J1 Store], 0, [Page Bounce Rate] ) )
```

Format string expression:

```dax
IF ( [_J1 Store], """—""", "0.0%" )
```

### `J1 LCP`

```dax
J1 LCP =
IF ( NOT ISBLANK ( [Page Visits] ), IF ( [_J1 Store], 0, [Page LCP] ) )
```

Format string expression:

```dax
IF ( [_J1 Store], """—""", "#,0"" ms""" )
```

### `J1 Caption`

```dax
J1 Caption =
VAR _as           = CALCULATE ( [Page CVR], dim_landing_page[page_key] = "LP_APP_STORE" )
VAR _as_p         = CALCULATE ( [Page CVR Prev], dim_landing_page[page_key] = "LP_APP_STORE" )
VAR _gp           = CALCULATE ( [Page CVR], dim_landing_page[page_key] = "LP_PLAY_STORE" )
VAR _gp_p         = CALCULATE ( [Page CVR Prev], dim_landing_page[page_key] = "LP_PLAY_STORE" )
RETURN
    "App Store CVR " & FORMAT ( _as, "0%" ) & " (prev " & FORMAT ( _as_p, "0%" ) & ")   |   Google Play " & FORMAT ( _gp, "0%" )
        & " (prev " & FORMAT ( _gp_p, "0%" ) & ")   |   web landing → sign-up " & FORMAT ( [Landing Signup Rate], "0.0%" )
```

### `J2 Largest Drop Step`

```dax
J2 Largest Drop Step =
VAR _drops        =
    ADDCOLUMNS (
        ALL ( dim_onboarding_step )
        ,"@share", [Step Share]
        ,"@prev",
            VAR _s        = dim_onboarding_step[sort_order]
            RETURN
                CALCULATE ( [Step Share], REMOVEFILTERS ( dim_onboarding_step ), dim_onboarding_step[sort_order] = _s - 1 )
    )
VAR _top          = TOPN ( 1, FILTER ( _drops, NOT ISBLANK ( [@prev] ) ), [@prev] - [@share], DESC, dim_onboarding_step[sort_order], ASC )
RETURN
    MAXX ( _top, dim_onboarding_step[step_code] )
```

### `J2 Colour`

```dax
J2 Colour =
VAR _largest      = [J2 Largest Drop Step]
RETURN
    IF ( SELECTEDVALUE ( dim_onboarding_step[step_code] ) = _largest, "#D93B4B", "#4A57E8" )
```

### `J2 Caption`

```dax
J2 Caption =
VAR _drops        =
    ADDCOLUMNS (
        ALL ( dim_onboarding_step )
        ,"@share", [Step Share]
        ,"@prev",
            VAR _s        = dim_onboarding_step[sort_order]
            RETURN
                CALCULATE ( [Step Share], REMOVEFILTERS ( dim_onboarding_step ), dim_onboarding_step[sort_order] = _s - 1 )
    )
VAR _top          = TOPN ( 1, FILTER ( _drops, NOT ISBLANK ( [@prev] ) ), [@prev] - [@share], DESC, dim_onboarding_step[sort_order], ASC )
VAR _drop         = MAXX ( _top, [@share] - [@prev] )
RETURN
    "Largest drop: " & MAXX ( _top, dim_onboarding_step[step_name] ) & " (−" & FORMAT ( ABS ( _drop ) * 100, "0" ) & " pt)   |   "
        & FORMAT ( [Signups], "#,0" ) & " paid sign-ups"
```

### `J3 Median Bin`

```dax
J3 Median Bin =
VAR _median       = [Act Median Hours]
RETURN
    MAXX ( FILTER ( ALL ( dim_act_bin ), dim_act_bin[lo_hours] <= _median && dim_act_bin[hi_hours] > _median ), dim_act_bin[bin_code] )
```

### `J3 Colour`

```dax
J3 Colour =
IF ( SELECTEDVALUE ( dim_act_bin[bin_code] ) = [J3 Median Bin], "#4A57E8", "#B7BDF3" )
```

### `J3 Caption`

```dax
J3 Caption =
"Median " & FORMAT ( [Act Median Hours], "0" ) & " h   |   7-day activation " & FORMAT ( [Activation Rate], "0%" ) & "   |   recent sign-ups have not had 30 days"
```

### `J4 Target`

```dax
J4 Target =
[_T ACTIVATION_7D]
```

### `J4 Colour`

```dax
J4 Colour =
IF ( [Segment Activation] < [_T ACTIVATION_7D], "#C47A0E", "#4A57E8" )
```

### `J4 Caption`

```dax
J4 Caption =
VAR _seg          =
    FILTER (
        ADDCOLUMNS ( ALL ( dim_platform_segment ), "@r", [Segment Activation] )
        ,NOT ISBLANK ( [@r] )
    )
VAR _low          = TOPN ( 1, _seg, [@r], ASC, dim_platform_segment[sort_order], ASC )
VAR _high         = TOPN ( 1, _seg, [@r], DESC, dim_platform_segment[sort_order], ASC )
RETURN
    MAXX ( _low, dim_platform_segment[segment_name] ) & " " & FORMAT ( MAXX ( _low, [@r] ), "0%" ) & " vs "
        & MAXX ( _high, dim_platform_segment[segment_name] ) & " " & FORMAT ( MAXX ( _high, [@r] ), "0%" ) & "   |   dashed line: 40 % target"
```

### `_Cohort End Index`

```dax
_Cohort End Index =
VAR _end          = [_Win End]
RETURN
    CALCULATE ( MAX ( dim_date[month_index] ), REMOVEFILTERS ( dim_date ), dim_date[date] = _end )
```

### `Cohort Customers`

```dax
Cohort Customers =
CALCULATE (
    SUM ( fact_cohort_revenue_month[customers_start] )
    ,fact_cohort_revenue_month[month_offset] = 0
)
```

### `Cohort ARPA`

```dax
Cohort ARPA =
DIVIDE (
    CALCULATE ( SUM ( fact_cohort_revenue_month[revenue_usd] ), fact_cohort_revenue_month[month_offset] = 0 )
    ,[Cohort Customers]
)
```

### `Cohort Cost`

```dax
Cohort Cost =
VAR _month        = SELECTEDVALUE ( dim_month[month_index] )
VAR _spend        =
    CALCULATE (
        [_b Spend]
        ,REMOVEFILTERS ( dim_date )
        ,dim_date[month_index] = _month
        ,dim_date[is_actual] = TRUE ()
    )
VAR _spend_all    =
    CALCULATE (
        [_b Spend All]
        ,REMOVEFILTERS ( dim_date )
        ,dim_date[month_index] = _month
        ,dim_date[is_actual] = TRUE ()
    )
VAR _team         =
    CALCULATE (
        [_b Team Pool]
        ,REMOVEFILTERS ( dim_date )
        ,dim_date[month_index] = _month
        ,dim_date[is_actual] = TRUE ()
    )
RETURN
    IF ( NOT ISBLANK ( _month ), _spend * ( 1 + DIVIDE ( _team, _spend_all ) ) )
```

### `Cohort CAC`

```dax
Cohort CAC =
DIVIDE ( [Cohort Cost], [Cohort Customers] )
```

### `Cohort Refund Rate`

```dax
Cohort Refund Rate =
DIVIDE ( SUM ( fact_cohort_revenue_month[refund_count] ), [Cohort Customers] )
```

### `Cohort Payback At`

```dax
Cohort Payback At =
VAR _k            = SELECTEDVALUE ( dim_offset[month_offset] )
VAR _rows         = CALCULATE ( COUNTROWS ( fact_cohort_revenue_month ), fact_cohort_revenue_month[month_offset] = _k )
VAR _net          =
    CALCULATE (
        SUM ( fact_cohort_revenue_month[revenue_usd] ) - SUM ( fact_cohort_revenue_month[refunds_usd] )
        ,fact_cohort_revenue_month[month_offset] <= _k
    )
RETURN
    IF ( _rows > 0 && [Cohort Customers] > 0, DIVIDE ( _net * [_GM], [Cohort Cost] ) )
```

### `Cohort Payback Month`

```dax
Cohort Payback Month =
VAR _hits         =
    FILTER (
        ALL ( dim_offset[month_offset] )
        ,[Cohort Payback At] >= 1
    )
RETURN
    MINX ( _hits, dim_offset[month_offset] )
```

### `Cohort Retention`

```dax
Cohort Retention =
VAR _n            = SELECTEDVALUE ( dim_day_n[day_n] )
RETURN
    CALCULATE (
        DIVIDE ( SUM ( fact_retention_cohort_month[users_active] ), SUM ( fact_retention_cohort_month[users_matured] ) )
        ,fact_retention_cohort_month[day_n] = _n
    )
```

### `_K1 Cohort Shown`

```dax
_K1 Cohort Shown =
VAR _end          = [_Cohort End Index]
VAR _m            = SELECTEDVALUE ( dim_month[month_index] )
VAR _back         = _end - 3 - _m
RETURN
    NOT ISBLANK ( _m ) && _back >= 0 && _back <= 10 && MOD ( _back, 2 ) = 0
```

### `K1 Payback`

```dax
K1 Payback =
IF ( [_K1 Cohort Shown], [Cohort Payback At] )
```

### `K1 Paid Back Line`

```dax
K1 Paid Back Line =
1
```

### `K1 Caption`

```dax
K1 Caption =
VAR _shown        =
    FILTER (
        ADDCOLUMNS ( ALL ( dim_month ), "@show", [_K1 Cohort Shown], "@pm", [Cohort Payback Month] )
        ,[@show] && NOT ISBLANK ( [@pm] )
    )
VAR _latest       = TOPN ( 1, _shown, dim_month[month_index], DESC )
RETURN
    "Line crosses 100 % = paid back   |   "
        & IF (
            ISEMPTY ( _shown )
            ,"no shown cohort has paid back yet"
            ,"latest cohort paid back: " & MAXX ( _latest, dim_month[month_name] ) & " in month " & MAXX ( _latest, [@pm] )
        )
```

### `_K12 Month`

```dax
_K12 Month =
VAR _end          = [_Cohort End Index]
VAR _m            = SELECTEDVALUE ( dim_month[month_index] )
RETURN
    NOT ISBLANK ( _m ) && _m <= _end && _m > _end - 12
```

### `K5 Customers`

```dax
K5 Customers =
IF ( [_K12 Month], [Cohort Customers] )
```

### `K5 ARPA`

```dax
K5 ARPA =
IF ( [_K12 Month], [Cohort ARPA] )
```

### `K5 CAC`

```dax
K5 CAC =
IF ( [_K12 Month], [Cohort CAC] )
```

### `K5 Refund Rate`

```dax
K5 Refund Rate =
IF ( [_K12 Month], [Cohort Refund Rate] )
```

### `K5 Payback Month`

```dax
K5 Payback Month =
IF ( [_K12 Month], [Cohort Payback Month] )
```

### `K5 Caption`

```dax
K5 Caption =
"12 acquisition months to " & FORMAT ( [_Win End], "mmm yyyy" ) & "   |   DDA credits (cohorts never switch model)   |   payback month blank = not paid back yet"
```

### `_K3 Last Cohort`

```dax
_K3 Last Cohort =
VAR _end          = [_Win End]
RETURN
    CALCULATE (
        MAX ( fact_retention_cohort_month[cohort_month_index] )
        ,REMOVEFILTERS ( dim_month )
        ,REMOVEFILTERS ( dim_campaign )
        ,REMOVEFILTERS ( dim_channel )
        ,REMOVEFILTERS ( dim_network )
        ,REMOVEFILTERS ( dim_platform )
        ,fact_retention_cohort_month[cohort_month_start] <= _end
    )
```

### `K3 Cell`

```dax
K3 Cell =
VAR _last         = [_K3 Last Cohort]
VAR _m            = SELECTEDVALUE ( dim_month[month_index] )
RETURN
    IF ( _m <= _last && _m > _last - 6, [Cohort Retention] )
```

### `K3 Cell Colour`

```dax
K3 Cell Colour =
VAR _v            = [K3 Cell]
VAR _t            = MIN ( DIVIDE ( _v, 0.6 ), 1 ) * 0.85 + 0.08
VAR _digits       = "0123456789ABCDEF"
VAR _r            = ROUND ( 255 - ( 255 - 74 ) * _t, 0 )
VAR _g            = ROUND ( 255 - ( 255 - 87 ) * _t, 0 )
VAR _b            = ROUND ( 255 - ( 255 - 232 ) * _t, 0 )
RETURN
    IF (
        NOT ISBLANK ( _v )
        ,"#"
            & MID ( _digits, INT ( _r / 16 ) + 1, 1 ) & MID ( _digits, MOD ( _r, 16 ) + 1, 1 )
            & MID ( _digits, INT ( _g / 16 ) + 1, 1 ) & MID ( _digits, MOD ( _g, 16 ) + 1, 1 )
            & MID ( _digits, INT ( _b / 16 ) + 1, 1 ) & MID ( _digits, MOD ( _b, 16 ) + 1, 1 )
        ,"#FFFFFF"
    )
```

### `K3 Cell Ink`

```dax
K3 Cell Ink =
IF ( [K3 Cell] >= 0.33, "#FFFFFF", "#111827" )
```

### `K3 Caption`

```dax
K3 Caption =
VAR _ym           = [Retention Cohort Month]
RETURN
"D7 / D30 of " & FORMAT ( DATE ( INT ( _ym / 100 ), MOD ( _ym, 100 ), 1 ), "mmm yyyy" )
    & ": " & FORMAT ( [D7 Retention], "0%" ) & " / " & FORMAT ( [D30 Retention], "0%" ) & "   |   blank = not reportable yet   |   darker = higher"
```

### `K2 Target`

```dax
K2 Target =
[_T LTV_CAC]
```

### `K2 Caption`

```dax
K2 Caption =
VAR _by           =
    FILTER (
        ADDCOLUMNS ( CALCULATETABLE ( VALUES ( dim_channel[channel_name] ), REMOVEFILTERS ( dim_channel ) ), "@l", [LTV CAC] )
        ,NOT ISBLANK ( [@l] )
    )
VAR _best         = TOPN ( 1, _by, [@l], DESC, dim_channel[channel_name], ASC )
VAR _under        = COUNTROWS ( FILTER ( _by, [@l] < [_T LTV_CAC] ) ) + 0
RETURN
    "Dashed line: 3:1 floor   |   best: " & LOWER ( MAXX ( _best, dim_channel[channel_name] ) ) & " " & FORMAT ( MAXX ( _best, [@l] ), "0.0" ) & "×   |   "
        & _under & IF ( _under = 1, " channel", " channels" ) & " under the floor"
```

### `K4 Caption`

```dax
K4 Caption =
"Refund rate " & FORMAT ( [Refund Rate], "0.0%" ) & " (target < " & FORMAT ( [_T REFUND_RATE], "0%" ) & ")   |   monthly churn " & FORMAT ( [Churn Monthly], "0.00%" ) & "   |   all channels in scope"
```

### `O4 Shares SVG`

```dax
O4 Shares SVG =
VAR _c0           =
    CALCULATETABLE (
        ROW (
            "@s", [Spend Share]
            ,"@m", [New MRR Share]
            ,"@c", [Channel Colour]
            ,"@t", [Channel Tint]
        )
        ,KEEPFILTERS ( dim_channel[channel_code] = "PAID_SEARCH" )
    )
VAR _s0           = MAXX ( _c0, [@s] )
VAR _m0           = MAXX ( _c0, [@m] ) + 0
VAR _c1           =
    CALCULATETABLE (
        ROW (
            "@s", [Spend Share]
            ,"@m", [New MRR Share]
            ,"@c", [Channel Colour]
            ,"@t", [Channel Tint]
        )
        ,KEEPFILTERS ( dim_channel[channel_code] = "PAID_SOCIAL" )
    )
VAR _s1           = MAXX ( _c1, [@s] )
VAR _m1           = MAXX ( _c1, [@m] ) + 0
VAR _c2           =
    CALCULATETABLE (
        ROW (
            "@s", [Spend Share]
            ,"@m", [New MRR Share]
            ,"@c", [Channel Colour]
            ,"@t", [Channel Tint]
        )
        ,KEEPFILTERS ( dim_channel[channel_code] = "APP_INSTALL" )
    )
VAR _s2           = MAXX ( _c2, [@s] )
VAR _m2           = MAXX ( _c2, [@m] ) + 0
VAR _c3           =
    CALCULATETABLE (
        ROW (
            "@s", [Spend Share]
            ,"@m", [New MRR Share]
            ,"@c", [Channel Colour]
            ,"@t", [Channel Tint]
        )
        ,KEEPFILTERS ( dim_channel[channel_code] = "DISPLAY_VIDEO" )
    )
VAR _s3           = MAXX ( _c3, [@s] )
VAR _m3           = MAXX ( _c3, [@m] ) + 0
VAR _c4           =
    CALCULATETABLE (
        ROW (
            "@s", [Spend Share]
            ,"@m", [New MRR Share]
            ,"@c", [Channel Colour]
            ,"@t", [Channel Tint]
        )
        ,KEEPFILTERS ( dim_channel[channel_code] = "RETARGETING" )
    )
VAR _s4           = MAXX ( _c4, [@s] )
VAR _m4           = MAXX ( _c4, [@m] ) + 0
VAR _c5           =
    CALCULATETABLE (
        ROW (
            "@s", [Spend Share]
            ,"@m", [New MRR Share]
            ,"@c", [Channel Colour]
            ,"@t", [Channel Tint]
        )
        ,KEEPFILTERS ( dim_channel[channel_code] = "AFFILIATES" )
    )
VAR _s5           = MAXX ( _c5, [@s] )
VAR _m5           = MAXX ( _c5, [@m] ) + 0
VAR _max          = MAX ( MAX ( MAX ( _s0, _s1 ), MAX ( _s2, _s3 ) ), MAX ( MAX ( _s4, _s5 ), MAX ( MAX ( _m0, _m1 ), MAX ( MAX ( _m2, _m3 ), MAX ( _m4, _m5 ) ) ) ) )
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='440' height='112' viewBox='0 0 440 112'>"
        & IF (
            NOT ISBLANK ( _s0 )
            ,"<text x='84' y='12.0' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#4B5563'>Paid search</text>"
            & "<rect x='92' y='3.0' height='6' rx='2' fill='"
            & MAXX ( _c0, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _s0, _max ) * 250, "0.0" )
            & "'/>"
            & "<rect x='92' y='10.0' height='6' rx='2' fill='"
            & MAXX ( _c0, [@t] )
            & "' width='"
            & FORMAT ( DIVIDE ( _m0, _max ) * 250, "0.0" )
            & "'/>"
            & "<text x='352' y='12.0' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10.5' fill='#111827'>"
            & FORMAT ( _s0, "0%" )
            & "</text>"
            & "<text x='392' y='12.0' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#8A94A6'>"
            & "MRR " & FORMAT ( _m0, "0%" )
            & "</text>"
        )
        & IF (
            NOT ISBLANK ( _s1 )
            ,"<text x='84' y='30.7' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#4B5563'>Paid social</text>"
            & "<rect x='92' y='21.7' height='6' rx='2' fill='"
            & MAXX ( _c1, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _s1, _max ) * 250, "0.0" )
            & "'/>"
            & "<rect x='92' y='28.7' height='6' rx='2' fill='"
            & MAXX ( _c1, [@t] )
            & "' width='"
            & FORMAT ( DIVIDE ( _m1, _max ) * 250, "0.0" )
            & "'/>"
            & "<text x='352' y='30.7' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10.5' fill='#111827'>"
            & FORMAT ( _s1, "0%" )
            & "</text>"
            & "<text x='392' y='30.7' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#8A94A6'>"
            & "MRR " & FORMAT ( _m1, "0%" )
            & "</text>"
        )
        & IF (
            NOT ISBLANK ( _s2 )
            ,"<text x='84' y='49.3' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#4B5563'>App install</text>"
            & "<rect x='92' y='40.3' height='6' rx='2' fill='"
            & MAXX ( _c2, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _s2, _max ) * 250, "0.0" )
            & "'/>"
            & "<rect x='92' y='47.3' height='6' rx='2' fill='"
            & MAXX ( _c2, [@t] )
            & "' width='"
            & FORMAT ( DIVIDE ( _m2, _max ) * 250, "0.0" )
            & "'/>"
            & "<text x='352' y='49.3' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10.5' fill='#111827'>"
            & FORMAT ( _s2, "0%" )
            & "</text>"
            & "<text x='392' y='49.3' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#8A94A6'>"
            & "MRR " & FORMAT ( _m2, "0%" )
            & "</text>"
        )
        & IF (
            NOT ISBLANK ( _s3 )
            ,"<text x='84' y='68.0' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#4B5563'>Display &amp; video</text>"
            & "<rect x='92' y='59.0' height='6' rx='2' fill='"
            & MAXX ( _c3, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _s3, _max ) * 250, "0.0" )
            & "'/>"
            & "<rect x='92' y='66.0' height='6' rx='2' fill='"
            & MAXX ( _c3, [@t] )
            & "' width='"
            & FORMAT ( DIVIDE ( _m3, _max ) * 250, "0.0" )
            & "'/>"
            & "<text x='352' y='68.0' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10.5' fill='#111827'>"
            & FORMAT ( _s3, "0%" )
            & "</text>"
            & "<text x='392' y='68.0' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#8A94A6'>"
            & "MRR " & FORMAT ( _m3, "0%" )
            & "</text>"
        )
        & IF (
            NOT ISBLANK ( _s4 )
            ,"<text x='84' y='86.7' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#4B5563'>Retargeting</text>"
            & "<rect x='92' y='77.7' height='6' rx='2' fill='"
            & MAXX ( _c4, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _s4, _max ) * 250, "0.0" )
            & "'/>"
            & "<rect x='92' y='84.7' height='6' rx='2' fill='"
            & MAXX ( _c4, [@t] )
            & "' width='"
            & FORMAT ( DIVIDE ( _m4, _max ) * 250, "0.0" )
            & "'/>"
            & "<text x='352' y='86.7' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10.5' fill='#111827'>"
            & FORMAT ( _s4, "0%" )
            & "</text>"
            & "<text x='392' y='86.7' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#8A94A6'>"
            & "MRR " & FORMAT ( _m4, "0%" )
            & "</text>"
        )
        & IF (
            NOT ISBLANK ( _s5 )
            ,"<text x='84' y='105.3' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#4B5563'>Affiliates</text>"
            & "<rect x='92' y='96.3' height='6' rx='2' fill='"
            & MAXX ( _c5, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _s5, _max ) * 250, "0.0" )
            & "'/>"
            & "<rect x='92' y='103.3' height='6' rx='2' fill='"
            & MAXX ( _c5, [@t] )
            & "' width='"
            & FORMAT ( DIVIDE ( _m5, _max ) * 250, "0.0" )
            & "'/>"
            & "<text x='352' y='105.3' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10.5' fill='#111827'>"
            & FORMAT ( _s5, "0%" )
            & "</text>"
            & "<text x='392' y='105.3' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#8A94A6'>"
            & "MRR " & FORMAT ( _m5, "0%" )
            & "</text>"
        )
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```

### `O7 Spend Customers SVG`

```dax
O7 Spend Customers SVG =
VAR _c0           =
    CALCULATETABLE (
        ROW (
            "@s", [Spend]
            ,"@p", [Paid Customers]
            ,"@c", [Channel Colour]
        )
        ,KEEPFILTERS ( dim_channel[channel_code] = "PAID_SEARCH" )
    )
VAR _s0           = MAXX ( _c0, [@s] )
VAR _p0           = MAXX ( _c0, [@p] )
VAR _c1           =
    CALCULATETABLE (
        ROW (
            "@s", [Spend]
            ,"@p", [Paid Customers]
            ,"@c", [Channel Colour]
        )
        ,KEEPFILTERS ( dim_channel[channel_code] = "PAID_SOCIAL" )
    )
VAR _s1           = MAXX ( _c1, [@s] )
VAR _p1           = MAXX ( _c1, [@p] )
VAR _c2           =
    CALCULATETABLE (
        ROW (
            "@s", [Spend]
            ,"@p", [Paid Customers]
            ,"@c", [Channel Colour]
        )
        ,KEEPFILTERS ( dim_channel[channel_code] = "APP_INSTALL" )
    )
VAR _s2           = MAXX ( _c2, [@s] )
VAR _p2           = MAXX ( _c2, [@p] )
VAR _c3           =
    CALCULATETABLE (
        ROW (
            "@s", [Spend]
            ,"@p", [Paid Customers]
            ,"@c", [Channel Colour]
        )
        ,KEEPFILTERS ( dim_channel[channel_code] = "DISPLAY_VIDEO" )
    )
VAR _s3           = MAXX ( _c3, [@s] )
VAR _p3           = MAXX ( _c3, [@p] )
VAR _c4           =
    CALCULATETABLE (
        ROW (
            "@s", [Spend]
            ,"@p", [Paid Customers]
            ,"@c", [Channel Colour]
        )
        ,KEEPFILTERS ( dim_channel[channel_code] = "RETARGETING" )
    )
VAR _s4           = MAXX ( _c4, [@s] )
VAR _p4           = MAXX ( _c4, [@p] )
VAR _c5           =
    CALCULATETABLE (
        ROW (
            "@s", [Spend]
            ,"@p", [Paid Customers]
            ,"@c", [Channel Colour]
        )
        ,KEEPFILTERS ( dim_channel[channel_code] = "AFFILIATES" )
    )
VAR _s5           = MAXX ( _c5, [@s] )
VAR _p5           = MAXX ( _c5, [@p] )
VAR _smax         = MAX ( MAX ( MAX ( _s0, _s1 ), MAX ( _s2, _s3 ) ), MAX ( _s4, _s5 ) )
VAR _pmax         = MAX ( MAX ( MAX ( _p0, _p1 ), MAX ( _p2, _p3 ) ), MAX ( _p4, _p5 ) )
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='440' height='136' viewBox='0 0 440 136'>"
        & "<text x='96' y='10' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='9.5' letter-spacing='0.5' fill='#8A94A6'>SPEND</text>"
        & "<text x='280' y='10' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='9.5' letter-spacing='0.5' fill='#8A94A6'>PAID CUSTOMERS</text>"
        & IF (
            NOT ISBLANK ( _s0 )
            ,"<text x='88' y='30.0' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#4B5563'>Paid search</text>"
            & "<rect x='96' y='22.0' height='10' rx='2' fill='"
            & MAXX ( _c0, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _s0, _smax ) * 112, "0.0" )
            & "'/>"
            & "<text x='"
            & FORMAT ( 102 + DIVIDE ( _s0, _smax ) * 112, "0.0" )
            & "' y='30.0' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' fill='#111827'>"
            & "$" & FORMAT ( _s0 / 1000, "#,0.0" ) & "k"
            & "</text>"
            & "<rect x='280' y='22.0' height='10' rx='2' fill='"
            & MAXX ( _c0, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _p0, _pmax ) * 112, "0.0" )
            & "'/>"
            & "<text x='"
            & FORMAT ( 286 + DIVIDE ( _p0, _pmax ) * 112, "0.0" )
            & "' y='30.0' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' fill='#111827'>"
            & FORMAT ( _p0, "#,0" )
            & "</text>"
        )
        & IF (
            NOT ISBLANK ( _s1 )
            ,"<text x='88' y='49.7' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#4B5563'>Paid social</text>"
            & "<rect x='96' y='41.7' height='10' rx='2' fill='"
            & MAXX ( _c1, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _s1, _smax ) * 112, "0.0" )
            & "'/>"
            & "<text x='"
            & FORMAT ( 102 + DIVIDE ( _s1, _smax ) * 112, "0.0" )
            & "' y='49.7' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' fill='#111827'>"
            & "$" & FORMAT ( _s1 / 1000, "#,0.0" ) & "k"
            & "</text>"
            & "<rect x='280' y='41.7' height='10' rx='2' fill='"
            & MAXX ( _c1, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _p1, _pmax ) * 112, "0.0" )
            & "'/>"
            & "<text x='"
            & FORMAT ( 286 + DIVIDE ( _p1, _pmax ) * 112, "0.0" )
            & "' y='49.7' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' fill='#111827'>"
            & FORMAT ( _p1, "#,0" )
            & "</text>"
        )
        & IF (
            NOT ISBLANK ( _s2 )
            ,"<text x='88' y='69.3' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#4B5563'>App install</text>"
            & "<rect x='96' y='61.3' height='10' rx='2' fill='"
            & MAXX ( _c2, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _s2, _smax ) * 112, "0.0" )
            & "'/>"
            & "<text x='"
            & FORMAT ( 102 + DIVIDE ( _s2, _smax ) * 112, "0.0" )
            & "' y='69.3' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' fill='#111827'>"
            & "$" & FORMAT ( _s2 / 1000, "#,0.0" ) & "k"
            & "</text>"
            & "<rect x='280' y='61.3' height='10' rx='2' fill='"
            & MAXX ( _c2, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _p2, _pmax ) * 112, "0.0" )
            & "'/>"
            & "<text x='"
            & FORMAT ( 286 + DIVIDE ( _p2, _pmax ) * 112, "0.0" )
            & "' y='69.3' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' fill='#111827'>"
            & FORMAT ( _p2, "#,0" )
            & "</text>"
        )
        & IF (
            NOT ISBLANK ( _s3 )
            ,"<text x='88' y='89.0' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#4B5563'>Display &amp; video</text>"
            & "<rect x='96' y='81.0' height='10' rx='2' fill='"
            & MAXX ( _c3, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _s3, _smax ) * 112, "0.0" )
            & "'/>"
            & "<text x='"
            & FORMAT ( 102 + DIVIDE ( _s3, _smax ) * 112, "0.0" )
            & "' y='89.0' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' fill='#111827'>"
            & "$" & FORMAT ( _s3 / 1000, "#,0.0" ) & "k"
            & "</text>"
            & "<rect x='280' y='81.0' height='10' rx='2' fill='"
            & MAXX ( _c3, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _p3, _pmax ) * 112, "0.0" )
            & "'/>"
            & "<text x='"
            & FORMAT ( 286 + DIVIDE ( _p3, _pmax ) * 112, "0.0" )
            & "' y='89.0' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' fill='#111827'>"
            & FORMAT ( _p3, "#,0" )
            & "</text>"
        )
        & IF (
            NOT ISBLANK ( _s4 )
            ,"<text x='88' y='108.7' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#4B5563'>Retargeting</text>"
            & "<rect x='96' y='100.7' height='10' rx='2' fill='"
            & MAXX ( _c4, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _s4, _smax ) * 112, "0.0" )
            & "'/>"
            & "<text x='"
            & FORMAT ( 102 + DIVIDE ( _s4, _smax ) * 112, "0.0" )
            & "' y='108.7' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' fill='#111827'>"
            & "$" & FORMAT ( _s4 / 1000, "#,0.0" ) & "k"
            & "</text>"
            & "<rect x='280' y='100.7' height='10' rx='2' fill='"
            & MAXX ( _c4, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _p4, _pmax ) * 112, "0.0" )
            & "'/>"
            & "<text x='"
            & FORMAT ( 286 + DIVIDE ( _p4, _pmax ) * 112, "0.0" )
            & "' y='108.7' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' fill='#111827'>"
            & FORMAT ( _p4, "#,0" )
            & "</text>"
        )
        & IF (
            NOT ISBLANK ( _s5 )
            ,"<text x='88' y='128.3' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='10.5' fill='#4B5563'>Affiliates</text>"
            & "<rect x='96' y='120.3' height='10' rx='2' fill='"
            & MAXX ( _c5, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _s5, _smax ) * 112, "0.0" )
            & "'/>"
            & "<text x='"
            & FORMAT ( 102 + DIVIDE ( _s5, _smax ) * 112, "0.0" )
            & "' y='128.3' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' fill='#111827'>"
            & "$" & FORMAT ( _s5 / 1000, "#,0.0" ) & "k"
            & "</text>"
            & "<rect x='280' y='120.3' height='10' rx='2' fill='"
            & MAXX ( _c5, [@c] )
            & "' width='"
            & FORMAT ( DIVIDE ( _p5, _pmax ) * 112, "0.0" )
            & "'/>"
            & "<text x='"
            & FORMAT ( 286 + DIVIDE ( _p5, _pmax ) * 112, "0.0" )
            & "' y='128.3' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' fill='#111827'>"
            & FORMAT ( _p5, "#,0" )
            & "</text>"
        )
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```

### `O1 Funnel SVG`

```dax
O1 Funnel SVG =
VAR _max          = MAXX ( ALL ( dim_funnel_stage ), [Funnel Log] )
VAR _f0           =
    VAR _log      = CALCULATE ( [Funnel Log], dim_funnel_stage[stage_code] = "IMP" )
    VAR _w        = DIVIDE ( _log, _max ) * 252
    VAR _count    = CALCULATE ( [Funnel Value], dim_funnel_stage[stage_code] = "IMP" )
    RETURN
        "<text x='104' y='15.214285714285714' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='11' fill='#4B5563'>Impressions</text>"
        & "<rect x='112' y='4.0' height='13.4' rx='3' fill='#4A57E8' fill-opacity='1.00' width='"
        & FORMAT ( _w, "0.0" )
        & "'/>"
        & "<text x='440' y='15.214285714285714' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='11' fill='#111827'>"
        & FORMAT ( _count, "#,0" )
        & "</text>"
VAR _f1           =
    VAR _log      = CALCULATE ( [Funnel Log], dim_funnel_stage[stage_code] = "CLK" )
    VAR _w        = DIVIDE ( _log, _max ) * 252
    VAR _count    = CALCULATE ( [Funnel Value], dim_funnel_stage[stage_code] = "CLK" )
    RETURN
        "<text x='104' y='34.614285714285714' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='11' fill='#4B5563'>Clicks</text>"
        & "<rect x='112' y='23.4' height='13.4' rx='3' fill='#4A57E8' fill-opacity='0.93' width='"
        & FORMAT ( _w, "0.0" )
        & "'/>"
        & "<text x='440' y='34.614285714285714' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='11' fill='#111827'>"
        & FORMAT ( _count, "#,0" )
        & "</text>"
VAR _f2           =
    VAR _log      = CALCULATE ( [Funnel Log], dim_funnel_stage[stage_code] = "LAND" )
    VAR _w        = DIVIDE ( _log, _max ) * 252
    VAR _count    = CALCULATE ( [Funnel Value], dim_funnel_stage[stage_code] = "LAND" )
    RETURN
        "<text x='104' y='54.114285714285714' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='11' fill='#4B5563'>Visits + installs</text>"
        & "<rect x='112' y='42.9' height='13.4' rx='3' fill='#4A57E8' fill-opacity='0.86' width='"
        & FORMAT ( _w, "0.0" )
        & "'/>"
        & "<text x='440' y='54.114285714285714' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='11' fill='#111827'>"
        & FORMAT ( _count, "#,0" )
        & "</text>"
VAR _f3           =
    VAR _log      = CALCULATE ( [Funnel Log], dim_funnel_stage[stage_code] = "SIGNUP" )
    VAR _w        = DIVIDE ( _log, _max ) * 252
    VAR _count    = CALCULATE ( [Funnel Value], dim_funnel_stage[stage_code] = "SIGNUP" )
    RETURN
        "<text x='104' y='73.5142857142857' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='11' fill='#4B5563'>Sign-ups</text>"
        & "<rect x='112' y='62.3' height='13.4' rx='3' fill='#4A57E8' fill-opacity='0.79' width='"
        & FORMAT ( _w, "0.0" )
        & "'/>"
        & "<text x='440' y='73.5142857142857' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='11' fill='#111827'>"
        & FORMAT ( _count, "#,0" )
        & "</text>"
VAR _f4           =
    VAR _log      = CALCULATE ( [Funnel Log], dim_funnel_stage[stage_code] = "ACT" )
    VAR _w        = DIVIDE ( _log, _max ) * 252
    VAR _count    = CALCULATE ( [Funnel Value], dim_funnel_stage[stage_code] = "ACT" )
    RETURN
        "<text x='104' y='92.91428571428571' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='11' fill='#4B5563'>Activated</text>"
        & "<rect x='112' y='81.7' height='13.4' rx='3' fill='#4A57E8' fill-opacity='0.72' width='"
        & FORMAT ( _w, "0.0" )
        & "'/>"
        & "<text x='440' y='92.91428571428571' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='11' fill='#111827'>"
        & FORMAT ( _count, "#,0" )
        & "</text>"
VAR _f5           =
    VAR _log      = CALCULATE ( [Funnel Log], dim_funnel_stage[stage_code] = "TRIAL" )
    VAR _w        = DIVIDE ( _log, _max ) * 252
    VAR _count    = CALCULATE ( [Funnel Value], dim_funnel_stage[stage_code] = "TRIAL" )
    RETURN
        "<text x='104' y='112.3142857142857' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='11' fill='#4B5563'>Trials</text>"
        & "<rect x='112' y='101.1' height='13.4' rx='3' fill='#4A57E8' fill-opacity='0.65' width='"
        & FORMAT ( _w, "0.0" )
        & "'/>"
        & "<text x='440' y='112.3142857142857' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='11' fill='#111827'>"
        & FORMAT ( _count, "#,0" )
        & "</text>"
VAR _f6           =
    VAR _log      = CALCULATE ( [Funnel Log], dim_funnel_stage[stage_code] = "PAID" )
    VAR _w        = DIVIDE ( _log, _max ) * 252
    VAR _count    = CALCULATE ( [Funnel Value], dim_funnel_stage[stage_code] = "PAID" )
    RETURN
        "<text x='104' y='131.81428571428572' text-anchor='end' font-family='Segoe UI, sans-serif' font-size='11' fill='#4B5563'>Paid</text>"
        & "<rect x='112' y='120.6' height='13.4' rx='3' fill='#4A57E8' fill-opacity='0.58' width='"
        & FORMAT ( _w, "0.0" )
        & "'/>"
        & "<text x='440' y='131.81428571428572' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='11' fill='#111827'>"
        & FORMAT ( _count, "#,0" )
        & "</text>"
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='440' height='136' viewBox='0 0 440 136'>"
        & _f0
        & _f1
        & _f2
        & _f3
        & _f4
        & _f5
        & _f6
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```

### `Vital V1 SVG`

```dax
Vital V1 SVG =
VAR _now          = [Spend]
VAR _ly           = [Spend LY]
VAR _d            = DIVIDE ( _now - _ly, _ly )
VAR _has_d        = NOT ISBLANK ( _d )
VAR _arrow        = IF ( _d > 0, "▲ ", IF ( _d < 0, "▼ ", "■ " ) )
VAR _d_text       = IF ( _has_d, _arrow & IF ( _d < 0, "−", "+" ) & FORMAT ( ABS ( _d ), "0.0%" ), "" )
VAR _d_colour     = IF ( ROUND ( _d, 4 ) = 0, "#8A94A6", IF ( _d < 0, "#1E9E6A", "#D93B4B" ) )
VAR _value        = IF ( ISBLANK ( _now ), "—", "$" & FORMAT ( _now / 1000, "#,0.0" ) & "k" )
VAR _ly_text      = IF ( ISBLANK ( _ly ), "LY —", "LY " & "$" & FORMAT ( _ly / 1000, "#,0.0" ) & "k" )
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='224' height='96' viewBox='0 0 224 96'>"
        & "<text x='34' y='22' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10.5' letter-spacing='0.6' fill='#8A94A6'>SPEND</text>"
        & "<text x='14' y='58' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='26' fill='#111827'>"
        & _value
        & "</text>"
        & "<text x='212' y='57' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='"
        & _d_colour
        & "'>"
        & _d_text
        & "</text>"
        & "<text x='14' y='84' font-family='Segoe UI, sans-serif' font-size='11' fill='#8A94A6'>"
        & _ly_text
        & "</text>"
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```

### `Vital V2 SVG`

```dax
Vital V2 SVG =
VAR _now          = [Signups]
VAR _ly           = [Signups LY]
VAR _d            = DIVIDE ( _now - _ly, _ly )
VAR _has_d        = NOT ISBLANK ( _d )
VAR _arrow        = IF ( _d > 0, "▲ ", IF ( _d < 0, "▼ ", "■ " ) )
VAR _d_text       = IF ( _has_d, _arrow & IF ( _d < 0, "−", "+" ) & FORMAT ( ABS ( _d ), "0.0%" ), "" )
VAR _d_colour     = IF ( ROUND ( _d, 4 ) = 0, "#8A94A6", IF ( _d > 0, "#1E9E6A", "#D93B4B" ) )
VAR _value        = IF ( ISBLANK ( _now ), "—", FORMAT ( _now, "#,0" ) )
VAR _ly_text      = IF ( ISBLANK ( _ly ), "LY —", "LY " & FORMAT ( _ly, "#,0" ) )
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='224' height='96' viewBox='0 0 224 96'>"
        & "<text x='34' y='22' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10.5' letter-spacing='0.6' fill='#8A94A6'>NEW CLIENTS</text>"
        & "<text x='14' y='58' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='26' fill='#111827'>"
        & _value
        & "</text>"
        & "<text x='212' y='57' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='"
        & _d_colour
        & "'>"
        & _d_text
        & "</text>"
        & "<text x='14' y='84' font-family='Segoe UI, sans-serif' font-size='11' fill='#8A94A6'>"
        & _ly_text
        & "</text>"
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```

### `Vital V3 SVG`

```dax
Vital V3 SVG =
VAR _now          = [Signup to Paid]
VAR _ly           = [Signup to Paid LY]
VAR _d            = IF ( NOT ISBLANK ( _now ) && NOT ISBLANK ( _ly ), _now - _ly )
VAR _has_d        = NOT ISBLANK ( _d )
VAR _arrow        = IF ( _d > 0, "▲ ", IF ( _d < 0, "▼ ", "■ " ) )
VAR _d_text       = IF ( _has_d, _arrow & IF ( _d < 0, "−", "+" ) & FORMAT ( ABS ( _d ) * 100, "0.0" ) & " pt", "" )
VAR _d_colour     = IF ( ROUND ( _d, 4 ) = 0, "#8A94A6", IF ( _d > 0, "#1E9E6A", "#D93B4B" ) )
VAR _value        = IF ( ISBLANK ( _now ), "—", FORMAT ( _now, "0.0%" ) )
VAR _ly_text      = IF ( ISBLANK ( _ly ), "LY —", "LY " & FORMAT ( _ly, "0.0%" ) )
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='224' height='96' viewBox='0 0 224 96'>"
        & "<text x='34' y='22' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10.5' letter-spacing='0.6' fill='#8A94A6'>CONVERSION INTO PAID</text>"
        & "<text x='14' y='58' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='26' fill='#111827'>"
        & _value
        & "</text>"
        & "<text x='212' y='57' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='"
        & _d_colour
        & "'>"
        & _d_text
        & "</text>"
        & "<text x='14' y='84' font-family='Segoe UI, sans-serif' font-size='11' fill='#8A94A6'>"
        & _ly_text
        & "</text>"
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```

### `Vital V4 SVG`

```dax
Vital V4 SVG =
VAR _now          = [Time to Activation Days]
VAR _ly           = [Time to Activation Days LY]
VAR _d            = IF ( NOT ISBLANK ( _now ) && NOT ISBLANK ( _ly ), _now - _ly )
VAR _has_d        = NOT ISBLANK ( _d )
VAR _arrow        = IF ( _d > 0, "▲ ", IF ( _d < 0, "▼ ", "■ " ) )
VAR _d_text       = IF ( _has_d, _arrow & IF ( _d < 0, "−", "+" ) & FORMAT ( ABS ( _d ), "0.0" ) & " d", "" )
VAR _d_colour     = IF ( ROUND ( _d, 4 ) = 0, "#8A94A6", IF ( _d < 0, "#1E9E6A", "#D93B4B" ) )
VAR _value        = IF ( ISBLANK ( _now ), "—", FORMAT ( _now, "0.0" ) & " d" )
VAR _ly_text      = IF ( ISBLANK ( _ly ), "LY —", "LY " & FORMAT ( _ly, "0.0" ) & " d" )
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='224' height='96' viewBox='0 0 224 96'>"
        & "<text x='34' y='22' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10.5' letter-spacing='0.6' fill='#8A94A6'>TIME TO ACTIVATION</text>"
        & "<text x='14' y='58' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='26' fill='#111827'>"
        & _value
        & "</text>"
        & "<text x='212' y='57' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='"
        & _d_colour
        & "'>"
        & _d_text
        & "</text>"
        & "<text x='14' y='84' font-family='Segoe UI, sans-serif' font-size='11' fill='#8A94A6'>"
        & _ly_text
        & "</text>"
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```

### `Vital V5 SVG`

```dax
Vital V5 SVG =
VAR _now          = [Paid CAC]
VAR _ly           = [Paid CAC LY]
VAR _d            = DIVIDE ( _now - _ly, _ly )
VAR _has_d        = NOT ISBLANK ( _d )
VAR _arrow        = IF ( _d > 0, "▲ ", IF ( _d < 0, "▼ ", "■ " ) )
VAR _d_text       = IF ( _has_d, _arrow & IF ( _d < 0, "−", "+" ) & FORMAT ( ABS ( _d ), "0.0%" ), "" )
VAR _d_colour     = IF ( ROUND ( _d, 4 ) = 0, "#8A94A6", IF ( _d < 0, "#1E9E6A", "#D93B4B" ) )
VAR _value        = IF ( ISBLANK ( _now ), "—", "$" & FORMAT ( _now, "#,0" ) )
VAR _ly_text      = IF ( ISBLANK ( _ly ), "LY —", "LY " & "$" & FORMAT ( _ly, "#,0" ) )
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='224' height='96' viewBox='0 0 224 96'>"
        & "<text x='34' y='22' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10.5' letter-spacing='0.6' fill='#8A94A6'>CAC</text>"
        & "<text x='14' y='58' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='26' fill='#111827'>"
        & _value
        & "</text>"
        & "<text x='212' y='57' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='"
        & _d_colour
        & "'>"
        & _d_text
        & "</text>"
        & "<text x='14' y='84' font-family='Segoe UI, sans-serif' font-size='11' fill='#8A94A6'>"
        & _ly_text
        & "</text>"
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```

### `Vital V6 SVG`

```dax
Vital V6 SVG =
VAR _now          = [ROAS 90d]
VAR _ly           = [ROAS 90d LY]
VAR _d            = IF ( NOT ISBLANK ( _now ) && NOT ISBLANK ( _ly ), _now - _ly )
VAR _has_d        = NOT ISBLANK ( _d )
VAR _arrow        = IF ( _d > 0, "▲ ", IF ( _d < 0, "▼ ", "■ " ) )
VAR _d_text       = IF ( _has_d, _arrow & IF ( _d < 0, "−", "+" ) & FORMAT ( ABS ( _d ), "0.00" ), "" )
VAR _d_colour     = IF ( ROUND ( _d, 4 ) = 0, "#8A94A6", IF ( _d > 0, "#1E9E6A", "#D93B4B" ) )
VAR _value        = IF ( ISBLANK ( _now ), "—", FORMAT ( _now, "0.00" ) & "×" )
VAR _ly_text      = IF ( ISBLANK ( _ly ), "LY —", "LY " & FORMAT ( _ly, "0.00" ) & "×" )
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='224' height='96' viewBox='0 0 224 96'>"
        & "<text x='34' y='22' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10.5' letter-spacing='0.6' fill='#8A94A6'>ROAS 90 D</text>"
        & "<text x='14' y='58' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='26' fill='#111827'>"
        & _value
        & "</text>"
        & "<text x='212' y='57' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='"
        & _d_colour
        & "'>"
        & _d_text
        & "</text>"
        & "<text x='14' y='84' font-family='Segoe UI, sans-serif' font-size='11' fill='#8A94A6'>"
        & _ly_text
        & "</text>"
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```

### `O2 Guardrails SVG`

```dax
O2 Guardrails SVG =
VAR _row0         =
    VAR _v        = [Trial to Paid]
    VAR _t        = [_T TRIAL_TO_PAID]
    VAR _w        = IF ( _t > 0, MIN ( MAX ( _v, 0 ) / ( 2 * _t ), 1 ), 0 ) * 128
    VAR _c        = SWITCH ( [Verdict Trial to Paid], 1, "#1E9E6A", 2, "#C47A0E", 3, "#D93B4B", "#8A94A6" )
    RETURN
        "<text x='0' y='14.0' font-family='Segoe UI, sans-serif' font-size='12' fill='#4B5563'>Trial → paid</text>"
            & "<rect x='284' y='7.0' width='128' height='6' rx='3' fill='#E3E6EC'/>"
            & "<rect x='284' y='7.0' width='"
            & FORMAT ( _w, "0.0" )
            & "' height='6' rx='3' fill='#4A57E8'/>"
            & "<rect x='347.0' y='4.0' width='2' height='12' rx='1' fill='#8A94A6'/>"
            & "<text x='426' y='14.0' font-family='Segoe UI, sans-serif' font-size='11' fill='#8A94A6'>"
            & "target " & FORMAT ( _t, "0%" )
            & "</text>"
            & "<text x='552' y='14.0' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12.5' fill='"
            & _c
            & "'>"
            & IF ( ISBLANK ( _v ), "n/a", FORMAT ( _v, "0.0%" ) )
            & "</text>"
VAR _row1         =
    VAR _v        = [D7 Retention]
    VAR _t        = [_T D7_RETENTION]
    VAR _w        = IF ( _t > 0, MIN ( MAX ( _v, 0 ) / ( 2 * _t ), 1 ), 0 ) * 128
    VAR _c        = SWITCH ( [Verdict D7 Retention], 1, "#1E9E6A", 2, "#C47A0E", 3, "#D93B4B", "#8A94A6" )
    RETURN
        "<text x='0' y='34.0' font-family='Segoe UI, sans-serif' font-size='12' fill='#4B5563'>D7 retention, paid</text>"
            & "<rect x='284' y='27.0' width='128' height='6' rx='3' fill='#E3E6EC'/>"
            & "<rect x='284' y='27.0' width='"
            & FORMAT ( _w, "0.0" )
            & "' height='6' rx='3' fill='#4A57E8'/>"
            & "<rect x='347.0' y='24.0' width='2' height='12' rx='1' fill='#8A94A6'/>"
            & "<text x='426' y='34.0' font-family='Segoe UI, sans-serif' font-size='11' fill='#8A94A6'>"
            & "≥ " & FORMAT ( _t, "0%" )
            & "</text>"
            & "<text x='552' y='34.0' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12.5' fill='"
            & _c
            & "'>"
            & IF ( ISBLANK ( _v ), "n/a", FORMAT ( _v, "0%" ) )
            & "</text>"
VAR _row2         =
    VAR _v        = [D30 Retention]
    VAR _t        = [_T D30_RETENTION]
    VAR _w        = IF ( _t > 0, MIN ( MAX ( _v, 0 ) / ( 2 * _t ), 1 ), 0 ) * 128
    VAR _c        = SWITCH ( [Verdict D30 Retention], 1, "#1E9E6A", 2, "#C47A0E", 3, "#D93B4B", "#8A94A6" )
    RETURN
        "<text x='0' y='54.0' font-family='Segoe UI, sans-serif' font-size='12' fill='#4B5563'>D30 retention, paid</text>"
            & "<rect x='284' y='47.0' width='128' height='6' rx='3' fill='#E3E6EC'/>"
            & "<rect x='284' y='47.0' width='"
            & FORMAT ( _w, "0.0" )
            & "' height='6' rx='3' fill='#4A57E8'/>"
            & "<rect x='347.0' y='44.0' width='2' height='12' rx='1' fill='#8A94A6'/>"
            & "<text x='426' y='54.0' font-family='Segoe UI, sans-serif' font-size='11' fill='#8A94A6'>"
            & "≥ " & FORMAT ( _t, "0%" )
            & "</text>"
            & "<text x='552' y='54.0' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12.5' fill='"
            & _c
            & "'>"
            & IF ( ISBLANK ( _v ), "n/a", FORMAT ( _v, "0%" ) )
            & "</text>"
VAR _row3         =
    VAR _v        = [Refund Rate]
    VAR _t        = [_T REFUND_RATE]
    VAR _w        = IF ( _t > 0, MIN ( MAX ( _v, 0 ) / ( 2 * _t ), 1 ), 0 ) * 128
    VAR _c        = SWITCH ( [Verdict Refund Rate], 1, "#1E9E6A", 2, "#C47A0E", 3, "#D93B4B", "#8A94A6" )
    RETURN
        "<text x='0' y='74.0' font-family='Segoe UI, sans-serif' font-size='12' fill='#4B5563'>Refund rate</text>"
            & "<rect x='284' y='67.0' width='128' height='6' rx='3' fill='#E3E6EC'/>"
            & "<rect x='284' y='67.0' width='"
            & FORMAT ( _w, "0.0" )
            & "' height='6' rx='3' fill='#4A57E8'/>"
            & "<rect x='347.0' y='64.0' width='2' height='12' rx='1' fill='#8A94A6'/>"
            & "<text x='426' y='74.0' font-family='Segoe UI, sans-serif' font-size='11' fill='#8A94A6'>"
            & "&lt; " & FORMAT ( _t, "0%" )
            & "</text>"
            & "<text x='552' y='74.0' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12.5' fill='"
            & _c
            & "'>"
            & IF ( ISBLANK ( _v ), "n/a", FORMAT ( _v, "0.0%" ) )
            & "</text>"
VAR _row4         =
    VAR _v        = [Brand Share]
    VAR _t        = [_T BRAND_SHARE]
    VAR _w        = IF ( _t > 0, MIN ( MAX ( _v, 0 ) / ( 2 * _t ), 1 ), 0 ) * 128
    VAR _c        = SWITCH ( [Verdict Brand Share], 1, "#1E9E6A", 2, "#C47A0E", 3, "#D93B4B", "#8A94A6" )
    RETURN
        "<text x='0' y='94.0' font-family='Segoe UI, sans-serif' font-size='12' fill='#4B5563'>Brand share of search spend</text>"
            & "<rect x='284' y='87.0' width='128' height='6' rx='3' fill='#E3E6EC'/>"
            & "<rect x='284' y='87.0' width='"
            & FORMAT ( _w, "0.0" )
            & "' height='6' rx='3' fill='#4A57E8'/>"
            & "<rect x='347.0' y='84.0' width='2' height='12' rx='1' fill='#8A94A6'/>"
            & "<text x='426' y='94.0' font-family='Segoe UI, sans-serif' font-size='11' fill='#8A94A6'>"
            & "target " & FORMAT ( _t, "0%" )
            & "</text>"
            & "<text x='552' y='94.0' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12.5' fill='"
            & _c
            & "'>"
            & IF ( ISBLANK ( _v ), "n/a", FORMAT ( _v, "0%" ) )
            & "</text>"
VAR _row5         =
    VAR _v        = [Attribution Gap]
    VAR _t        = [_T ATTR_GAP]
    VAR _w        = IF ( _t > 0, MIN ( MAX ( _v, 0 ) / ( 2 * _t ), 1 ), 0 ) * 128
    VAR _c        = SWITCH ( [Verdict Attribution Gap], 1, "#1E9E6A", 2, "#C47A0E", 3, "#D93B4B", "#8A94A6" )
    RETURN
        "<text x='0' y='114.0' font-family='Segoe UI, sans-serif' font-size='12' fill='#4B5563'>Attribution gap, reported vs modelled</text>"
            & "<rect x='284' y='107.0' width='128' height='6' rx='3' fill='#E3E6EC'/>"
            & "<rect x='284' y='107.0' width='"
            & FORMAT ( _w, "0.0" )
            & "' height='6' rx='3' fill='#4A57E8'/>"
            & "<rect x='347.0' y='104.0' width='2' height='12' rx='1' fill='#8A94A6'/>"
            & "<text x='426' y='114.0' font-family='Segoe UI, sans-serif' font-size='11' fill='#8A94A6'>"
            & "target " & FORMAT ( _t, "0%" )
            & "</text>"
            & "<text x='552' y='114.0' text-anchor='end' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12.5' fill='"
            & _c
            & "'>"
            & IF ( ISBLANK ( _v ), "n/a", IF ( _v < 0, "−", "+" ) & FORMAT ( ABS ( _v ), "0%" ) )
            & "</text>"
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='552' height='120' viewBox='0 0 552 120'>"
        & _row0
        & _row1
        & _row2
        & _row3
        & _row4
        & _row5
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```

### `Header Period SVG`

```dax
Header Period SVG =
VAR _text         = [Period Pill Text]
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='236' height='32' viewBox='0 0 236 32'>"
        & "<rect x='0.5' y='0.5' width='235' height='31' rx='10' fill='#FFFFFF' fill-opacity='0.85' stroke='#111827' stroke-opacity='0.12'/>"
        & "<text x='118' y='20.5' text-anchor='middle' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='#111827'>"
        & _text
        & "</text>"
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```

### `Header Filters SVG`

```dax
Header Filters SVG =
VAR _n            = [_Filter Count]
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='108' height='32' viewBox='0 0 108 32'>"
        & "<rect x='0.5' y='0.5' width='107' height='31' rx='10' fill='#FFFFFF' fill-opacity='0.85' stroke='#111827' stroke-opacity='0.12'/>"
        & "<text x='"
        & IF ( _n > 0, "42", "54" )
        & "' y='20.5' text-anchor='middle' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12.5' fill='#111827'>Filters</text>"
        & IF ( _n > 0, "<circle cx='84' cy='16' r='9' fill='#4A57E8'/>"
            & "<text x='84' y='20' text-anchor='middle' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='11' fill='#FFFFFF'>"
            & _n
            & "</text>" )
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```

### `Header Freshness SVG`

```dax
Header Freshness SVG =
VAR _colour       = [Freshness Colour]
VAR _text         = [Synced Text]
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='132' height='32' viewBox='0 0 132 32'>"
        & "<circle cx='10' cy='16' r='7' fill='"
        & _colour
        & "' fill-opacity='0.22'/>"
        & "<circle cx='10' cy='16' r='4' fill='"
        & _colour
        & "'/>"
        & "<text x='22' y='20.5' font-family='Segoe UI, sans-serif' font-size='12' fill='#4B5563'>"
        & _text
        & "</text>"
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```

### `Filters Applied SVG`

```dax
Filters Applied SVG =
VAR _raw          = [Applied State]
VAR _cut          = 31
VAR _l1           =
    VAR _p        = SUBSTITUTE ( PATHITEM ( _raw, 1 ), "¦", "|" )
    RETURN
        IF ( LEN ( _p ) > _cut, LEFT ( _p, _cut - 1 ) & "…", _p )
VAR _l2           =
    VAR _p        = SUBSTITUTE ( PATHITEM ( _raw, 2 ), "¦", "|" )
    RETURN
        IF ( LEN ( _p ) > _cut, LEFT ( _p, _cut - 1 ) & "…", _p )
VAR _l3           =
    VAR _p        = SUBSTITUTE ( PATHITEM ( _raw, 3 ), "¦", "|" )
    RETURN
        IF ( LEN ( _p ) > _cut, LEFT ( _p, _cut - 1 ) & "…", _p )
VAR _l4           =
    VAR _p        = SUBSTITUTE ( PATHITEM ( _raw, 4 ), "¦", "|" )
    RETURN
        IF ( LEN ( _p ) > _cut, LEFT ( _p, _cut - 1 ) & "…", _p )
VAR _l5           =
    VAR _p        = SUBSTITUTE ( PATHITEM ( _raw, 5 ), "¦", "|" )
    RETURN
        IF ( LEN ( _p ) > _cut, LEFT ( _p, _cut - 1 ) & "…", _p )
VAR _l6           =
    VAR _p        = SUBSTITUTE ( PATHITEM ( _raw, 6 ), "¦", "|" )
    RETURN
        IF ( LEN ( _p ) > _cut, LEFT ( _p, _cut - 1 ) & "…", _p )
VAR _l7           =
    VAR _p        = SUBSTITUTE ( PATHITEM ( _raw, 7 ), "¦", "|" )
    RETURN
        IF ( LEN ( _p ) > _cut, LEFT ( _p, _cut - 1 ) & "…", _p )
VAR _l8           =
    VAR _p        = SUBSTITUTE ( PATHITEM ( _raw, 8 ), "¦", "|" )
    RETURN
        IF ( LEN ( _p ) > _cut, LEFT ( _p, _cut - 1 ) & "…", _p )
VAR _svg          =
    "<svg xmlns='http://www.w3.org/2000/svg' width='208' height='360' viewBox='0 0 208 360'>"
        & "<text x='0' y='16' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' letter-spacing='0.6' fill='#8A94A6'>PERIOD</text>"
        & "<text x='0' y='35' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='#111827'>"
        & SUBSTITUTE ( SUBSTITUTE ( _l1, "&", "&amp;" ), "<", "&lt;" )
        & "</text>"
        & "<text x='0' y='66' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' letter-spacing='0.6' fill='#8A94A6'>PLATFORM</text>"
        & "<text x='0' y='85' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='#111827'>"
        & SUBSTITUTE ( SUBSTITUTE ( _l2, "&", "&amp;" ), "<", "&lt;" )
        & "</text>"
        & "<text x='0' y='116' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' letter-spacing='0.6' fill='#8A94A6'>MARKET | TIER</text>"
        & "<text x='0' y='135' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='#111827'>"
        & SUBSTITUTE ( SUBSTITUTE ( _l3, "&", "&amp;" ), "<", "&lt;" )
        & "</text>"
        & "<text x='0' y='166' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' letter-spacing='0.6' fill='#8A94A6'>CHANNEL</text>"
        & "<text x='0' y='185' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='#111827'>"
        & SUBSTITUTE ( SUBSTITUTE ( _l4, "&", "&amp;" ), "<", "&lt;" )
        & "</text>"
        & "<text x='0' y='216' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' letter-spacing='0.6' fill='#8A94A6'>CAMPAIGN STATUS</text>"
        & "<text x='0' y='235' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='#111827'>"
        & SUBSTITUTE ( SUBSTITUTE ( _l5, "&", "&amp;" ), "<", "&lt;" )
        & "</text>"
        & "<text x='0' y='266' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' letter-spacing='0.6' fill='#8A94A6'>ATTRIBUTION</text>"
        & "<text x='0' y='285' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='#111827'>"
        & SUBSTITUTE ( SUBSTITUTE ( _l6, "&", "&amp;" ), "<", "&lt;" )
        & "</text>"
        & "<text x='0' y='316' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='10' letter-spacing='0.6' fill='#8A94A6'>IN SCOPE</text>"
        & "<text x='0' y='335' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='#111827'>"
        & SUBSTITUTE ( SUBSTITUTE ( _l7, "&", "&amp;" ), "<", "&lt;" )
        & "</text>"
        & "<text x='0' y='353' font-family='Segoe UI Semibold, Segoe UI, sans-serif' font-size='12' fill='#111827'>"
        & SUBSTITUTE ( SUBSTITUTE ( _l8, "&", "&amp;" ), "<", "&lt;" )
        & "</text>"
        & "</svg>"
RETURN
    "data:image/svg+xml;utf8," & SUBSTITUTE ( SUBSTITUTE ( _svg, "%", "%25" ), "#", "%23" )
```
