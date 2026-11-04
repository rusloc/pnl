from rusloc/pnl (bip; generator by ginee) · to vosk.dev repo agent · 2026-11-04 · status: draft

# ACME Marketing — data generator (pack copy)

Unchanged copies of `data/acme_marketing_dummy_data/generator/` (`generate.py`, `metrics.py`, `requirements.txt`) and `checks/`
(`verify.py`, `control_totals_usd.csv`, 28,660 rows) in rusloc/pnl, plus the data README below (the data contract both flavours build
against). The generated Parquet is not in git.

Run (PowerShell, in `.sync\data-gen`, after the one-time setup in `../README.md`; the pins are the same numpy 2.5.4 / pandas 2.3.3 /
pyarrow 26.0.0 as the other generators):

```powershell
.venv\Scripts\python.exe acme-marketing\generator\generate.py    # 27 Parquet + manifest.json into acme-marketing\parquet, control totals into acme-marketing\checks (~3 s)
.venv\Scripts\python.exe acme-marketing\checks\verify.py         # 132 checks incl. a byte-identical rerun; exit 1 on any failure (~20 s)
```

`generate.py` writes into this folder by default (`--out <folder>` elsewhere; `verify.py --data <folder>` checks that folder,
`--no-rerun` skips the rerun). Seed 20261104: the same inputs give the same bytes, so a changed `checks/control_totals_usd.csv` in
`git status` means the generator or its environment changed. The "How to run" section of the README below names the repo layout
(`generator\.venv`); in this folder use the shared `..\.venv`.


---

# ACME paid acquisition — Paid Acquisition Console dummy dataset

Sample data for the ACME paid-acquisition (digital-marketing) dashboard: ADR-0015, `docs/Requirements-marketing.md` (A-nn requirements, AT-nn acceptance tests), and the spec bundle `pbi-report/ACME Marketing/paid-acquisition-dashboard/` (`SPEC.md`, `mockup/index.html`). **All figures are invented and illustrative.** The generator is deterministic: seed 20261104 gives byte-identical files.

This README is the data contract for both flavours: the Power BI report (`pbi-report/ACME Marketing/`) and the JS flavour that the vosk.dev repo agent builds from the `.sync/` pack. Table, column and metric names here take precedence over any spec or mockup name (ADR-0015 (b)).

- **Company:** ACME, a SaaS analytics product sold self-serve and sales-assisted on web, iOS and Android. Paid online acquisition only: 6 channels, 8 networks, 19 campaigns (16 with spend in the default window). USD only.
- **Calendar:** calendar days, weeks Monday–Sunday, no retail calendar. "Last year" (LY) means the same calendar date one year back (`dim_date.ly_date`).
- **As of:** the last complete day is **Tue 3 Nov 2026** (`manifest.json › as_of_date`). The refresh stamp is **2026-11-04 14:55** (`manifest.json › refreshed`), which is a datum, not a literal.
- **Default window:** **R30 = 5 Oct – 3 Nov 2026**. Previous period: 5 Sep – 4 Oct 2026. Same period last year: 5 Oct – 3 Nov 2025.
- **Span:** daily actuals from 1 Jan 2025 to 3 Nov 2026 (672 days). `dim_date` and the budget run to 31 Dec 2026.
- **Grain:** day × campaign for the funnel and attribution; day × campaign × ad set × creative for delivery; acquisition month × campaign × month offset for cohorts. No per-ad, per-user or per-subscription rows (ADR-0015 (c), "grain reductions").
- **Size:** 27 tables, **257,188 rows**, **2.2 MB of Parquet**. No CSV copies of the tables.

## How to run

```powershell
cd data\acme_marketing_dummy_data
py -3.12 -m venv generator\.venv                                   # once; .venv is gitignored
generator\.venv\Scripts\python.exe -m pip install -r generator\requirements.txt
generator\.venv\Scripts\python.exe generator\generate.py           # writes parquet\ and checks\ (about 3 s)
generator\.venv\Scripts\python.exe checks\verify.py                # 132 checks incl. a byte-identical rerun; exit 1 on any failure (about 20 s)
```

- `generate.py --out <folder>` writes `<folder>\parquet\…` and `<folder>\checks\control_totals_usd.csv`. The default is this folder, so the Parquet lands in `..\parquet` relative to `generator\`. `verify.py --data <folder>` checks that folder, and `--no-rerun` skips the determinism rerun (AT-20).
- `requirements.txt` pins numpy 2.5.4, pandas 2.3.3 and pyarrow 26.0.0 (as Mirelo and Nordmark), plus their transitive dependencies (python-dateutil, pytz, six, tzdata), so the byte-identity claim does not rest on an unpinned package (CAND-007).
- `generate.py` asserts the story table below at display precision before it finishes and stops on any miss. The control-total engine lives in `generator\metrics.py`. `checks\verify.py` imports nothing from `generator\`: it recomputes every control total from the Parquet files with its own code (pandas group-bys, where the generator uses numpy matrices).

## Files

| File | Rows | Grain (one row per …) |
| --- | ---: | --- |
| parquet/dim_date.parquet | 730 | day, 2025-01-01 … 2026-12-31 |
| parquet/dim_month.parquet | 24 | month, 2025-01 … 2026-12 |
| parquet/dim_platform.parquet | 3 | platform (WEB, IOS, ANDROID) |
| parquet/dim_platform_segment.parquet | 6 | platform × OS / device band |
| parquet/dim_channel.parquet | 6 | channel, with its fixed colour slot |
| parquet/dim_network.parquet | 8 | ad network |
| parquet/dim_campaign.parquet | 19 | campaign (one platform, channel, network, market and tier each) |
| parquet/dim_ad_set.parquet | 78 | ad set |
| parquet/dim_creative.parquet | 205 | creative |
| parquet/dim_term.parquet | 152 | keyword, placement or audience (the top 8 per campaign) |
| parquet/dim_landing_page.parquet | 8 | web page or store page |
| parquet/dim_onboarding_step.parquet | 6 | onboarding step |
| parquet/dim_attribution_model.parquet | 4 | attribution model |
| parquet/fact_ad_delivery_day.parquet | 83,483 | day × campaign × ad set × creative |
| parquet/fact_term_day.parquet | 81,584 | day × campaign × term |
| parquet/fact_traffic_day.parquet | 18,880 | day × campaign × landing or store page |
| parquet/fact_funnel_day.parquet | 10,198 | day × campaign (counts cohorted by sign-up day) |
| parquet/fact_signup_segment_day.parquet | 20,319 | day × campaign × platform segment |
| parquet/fact_attribution_day.parquet | 35,237 | conversion day × campaign × attribution model |
| parquet/fact_cohort_revenue_month.parquet | 3,457 | acquisition month × campaign × month offset (DDA) |
| parquet/fact_retention_cohort_month.parquet | 2,241 | acquisition month × campaign × day N |
| parquet/fact_budget_month.parquet | 456 | month × campaign, 2025-01 … 2026-12 |
| parquet/fact_pipeline_month.parquet | 25 | month × campaign (PIPELINE / LEAD campaigns) |
| parquet/param_target.parquet | 43 | scope × metric target or threshold |
| parquet/param_finance.parquet | 3 | finance constant × valid-from date |
| parquet/param_alert_rule.parquet | 6 | alert rule |
| parquet/sync_log.parquet | 7 | data source |
| parquet/manifest.json | — | seed, generator version, as-of date, refresh stamp, windows; rows, bytes and column → Arrow type per table |
| checks/control_totals_usd.csv | 28,660 | scope × period key × metric (A-76) |
| checks/verify.py | — | the independent checks (AT-01 … AT-22, data level) |
| generator/generate.py, generator/metrics.py, generator/requirements.txt | — | the generator, its control-total engine and the pins |

## Format

- Parquet, snappy, one file per table, no pandas metadata.
- Types: `date32` for dates, `timestamp[ms]` for `sync_log.last_sync_ts` (see deviation D-8), `bool`, `int32` for small codes and orders, `int64` for counts, `double` for every amount, credit and ratio (model them as Decimal Number (double), never Fixed Decimal), `string` for codes.
- Amounts are USD, rounded to the cent. Paid-customer credits are rounded to 1e-4.
- `month_key` / `cohort_month` are text in the form `2026-10`. Null means not applicable: store columns on web rows, web columns on store rows, `video_views` on non-video creatives, `match_type` on placements and audiences, `cpa_target_usd` for LEAD and RETENTION campaigns, `end_date` for live campaigns.

## Relationships

- Every fact `date` → `dim_date[date]`. `fact_budget_month[month_key]`, `fact_pipeline_month[month_key]`, `fact_cohort_revenue_month[cohort_month]` and `fact_retention_cohort_month[cohort_month]` → `dim_month[month_key]`.
- Every fact `campaign_key` → `dim_campaign`. **Scope attributes live on the campaign**: `dim_campaign.channel_code` → `dim_channel`, `.network_code` → `dim_network`, `.platform_code` → `dim_platform`. These are one-level outriggers through the campaign, allowed by ADR-0015 (c), single direction toward the facts. No fact carries a channel, network or platform code, so the Platform, Channel, Network, Market, Tier and Status filters are all campaign filters.
- `fact_ad_delivery_day[ad_set_key]` → `dim_ad_set`, `[creative_key]` → `dim_creative`. `fact_term_day[term_key]` → `dim_term`. `fact_traffic_day[page_key]` → `dim_landing_page`. `fact_signup_segment_day[segment_code]` → `dim_platform_segment`. `fact_attribution_day[model_code]` → `dim_attribution_model`.
- Label columns without a relationship (each would open a second path): `dim_ad_set.campaign_key`, `dim_creative.campaign_key`, `dim_term.campaign_key`, `dim_platform_segment.platform_code`, `dim_landing_page.platform_code`.
- `param_*`, `sync_log` and `dim_onboarding_step` join no fact. `dim_onboarding_step.fact_column` names the `fact_funnel_day` column of each step (use a field parameter or an unpivot).

## Columns

**dim_date** — `date`, `month_key`, `year`, `quarter`, `month_num`, `month_name` (`Oct`), `day_of_month`, `iso_week`, `week_start` (the Monday), `weekday_num` (1 = Mon … 7 = Sun), `weekday_name`, `is_weekend`, `is_actual` (≤ 2026-11-03), `ly_date` (the same date one year back; 2025 rows point to 2024 dates that have no row).
**dim_month** — `month_key`, `month_start`, `month_index` (0 = 2025-01 … 23 = 2026-12), `year`, `month_name` (`Oct 2026`), `days_in_month`, `is_actual` (the month has actual days, through 2026-11), `is_complete` (through 2026-10).
**dim_platform** — `platform_code` (WEB / IOS / ANDROID), `platform_name`, `is_mobile`, `sort_order`.
**dim_platform_segment** — `segment_code` (WEB_DESKTOP, WEB_MOBILE, IOS_18, IOS_17, ANDROID_14_15, ANDROID_LE13), `segment_name`, `platform_code` (label), `sort_order`.
**dim_channel** — `channel_code` (PAID_SEARCH, PAID_SOCIAL, APP_INSTALL, DISPLAY_VIDEO, RETARGETING, AFFILIATES), `channel_name`, `color_slot` 1–6, `color_light`, `color_dark` (the spec's six hues; fixed per channel, never reassigned when a filter drops a channel), `sort_order`.
**dim_network** — `network_code` (GOOGLE_ADS, MICROSOFT_ADS, META, LINKEDIN, TIKTOK, APPLE_SEARCH_ADS, DV360, AFFILIATE_NET), `network_name`, `sort_order`.
**dim_campaign** — `campaign_key`, `campaign_name` (the mockup names), `channel_code`, `network_code`, `platform_code`, `market_code` (GLOBAL / NA / EMEA), `tier_code` (SELF_SERVE / SALES_ASSISTED), `objective_code` (PAID / INSTALL / PIPELINE / LEAD / RETENTION), `status_code` (LIVE / LEARNING / PAUSED / ENDED), `is_brand`, `start_date`, `end_date` (null while live), `learning_end_date` (for the two LEARNING campaigns, the expected end), `cpa_target_usd` (the channel CPA target; null for LEAD / RETENTION), `sort_order` (the mockup order).
**dim_ad_set** — `ad_set_key` (`<campaign_key>-AS<n>`), `campaign_key` (label), `ad_set_name`, `targeting_type` (KEYWORD / LOOKALIKE / INTEREST / AUDIENCE / PLACEMENT / CONTEXTUAL), `sort_order`.
**dim_creative** — `creative_key` (`<campaign_key>-CR<nn>`), `campaign_key` (label), `creative_name`, `format_code` (VIDEO / STATIC / CAROUSEL / UGC / TEXT), `launch_date` (can predate the data), `sort_order`.
**dim_term** — `term_key` (`<campaign_key>-T<n>`), `campaign_key` (label), `term_text`, `term_type` (KEYWORD for search and Apple Search Ads, PLACEMENT, AUDIENCE), `match_type` (EXACT / PHRASE / BROAD; null otherwise), `sort_order`.
**dim_landing_page** — `page_key` (LP_PRICING, LP_HOME, LP_ANALYTICS, LP_VS_LOOKER, LP_SIGNUP, LP_DEMO, LP_APP_STORE, LP_PLAY_STORE), `page_name` (`/pricing`, `/ (home)`, `/analytics-dashboard`, `/vs/looker`, `/signup`, `/demo`, `App Store page`, `Google Play page`), `page_type` (WEB / APP_STORE / PLAY_STORE), `platform_code` (label), `sort_order`.
**dim_onboarding_step** — `step_code` (SIGNUP, VERIFY_EMAIL, CREATE_WORKSPACE, CONNECT_SOURCE, FIRST_DASHBOARD, INVITE), `step_name`, `fact_column`, `is_activation` (FIRST_DASHBOARD), `sort_order`.
**dim_attribution_model** — `model_code` (DDA, LAST_CLICK, FIRST_TOUCH, PLATFORM), `model_name`, `lookback_click_days` (30), `lookback_view_days` (1), `is_default` (DDA), `is_first_party` (false for PLATFORM), `description`, `sort_order`.

**fact_ad_delivery_day** — `date`, `campaign_key`, `ad_set_key`, `creative_key` (each creative runs in one ad set); `impressions`, `clicks`, `spend_usd`; `reach_7d` (the creative's unique reach over the trailing 7 days as of that day: a point-in-time value, never summed over days); `video_views` (VIDEO creatives only); `paid_customers_dda` (the campaign-day's DDA paid-customer credits split over its creatives by clicks; Σ per campaign-day = `fact_attribution_day` DDA; see deviation D-4).
**fact_term_day** — `date`, `campaign_key`, `term_key`; `impressions`, `clicks`, `spend_usd`, `signups` (click → sign-up conversions of the term). The 8 terms carry 80 % (keywords) or 90 % (placements and audiences) of the campaign-day's delivery and sign-ups; Σ ≤ the campaign-day.
**fact_traffic_day** — `date`, `campaign_key`, `page_key`. Web rows: `sessions`, `bounces`, `lcp_ms_p75` (daily p75 in ms, int32), `signups`. Store rows (one per mobile campaign-day, App Store page for iOS campaigns and Google Play page for Android): `store_views`, `installs`, `first_opens`, `signups`. Columns of the other kind are null. Σ `signups` per campaign-day = `fact_funnel_day.signups`.
**fact_funnel_day** — `date`, `campaign_key`, cohorted by sign-up day: `signups`, `step_verified`, `step_workspace`, `step_connected`, `step_first_dashboard` (= activated: first dashboard created within 7 days of sign-up), `step_invited` (each step within 7 days of sign-up, monotone in that order), `act_lt1h`, `act_1_6h`, `act_6_24h`, `act_1_2d`, `act_2_4d`, `act_4_7d`, `act_7_30d` (activations by hours from sign-up; Σ of the first six = `step_first_dashboard`; Σ of all seven = activated within 30 days), `trials`. Counts are **as observed on the as-of day**, so sign-ups of the last 7 days (and the last 30 days for `act_7_30d`) are partial by construction.
**fact_signup_segment_day** — `date`, `campaign_key`, `segment_code` (the campaign's platform's two segments); `signups`, `activated_7d`. Σ over segments = the funnel row.
**fact_attribution_day** — `date` (conversion day), `campaign_key`, `model_code`; `paid_customers` (credits: fractional under DDA and FIRST_TOUCH, whole conversions under LAST_CLICK, the networks' claims under PLATFORM), `new_mrr_usd` (first-month recurring revenue of those customers, under the same model).
**fact_cohort_revenue_month** — `cohort_month` (acquisition month), `campaign_key`, `month_offset` (0 … n); `customers_start`, `churned`, `customers_end` (= start − churned), `revenue_usd` (recognised subscription revenue of the cohort in that offset month), `refunds_usd`, `refund_count`. DDA only. Counts are DDA credits and therefore double (deviation D-7). Rows exist for every offset whose calendar month (cohort + offset) is complete (≤ 2026-10), plus offset 0 of the partial Nov 2026 cohort (deviation D-18).
**fact_retention_cohort_month** — `cohort_month`, `campaign_key`, `day_n` (1, 3, 7, 14, 30, 60, 90); `users_matured` (sign-ups of the month whose day N ≤ as-of), `users_active` (of those, active on day N). A cell is written only when the 15th of the cohort month + N ≤ 2026-11-03 (A-74): Oct 2026 has D1 … D14, Sep D1 … D30, Aug … D60, Jul … D90.
**fact_budget_month** — `month_key`, `campaign_key`, `budget_usd` (the daily plan is `budget_usd ÷ dim_month.days_in_month`). Every campaign × month has a row (0 when inactive). Oct and Nov 2026 run at the window's daily plan; Dec 2026 = Nov × 31/30 × 0.92.
**fact_pipeline_month** — `month_key`, `campaign_key` (SOC_LINKEDIN_ABM, SOC_LINKEDIN_WEBINAR); `opps_created`, `pipeline_usd`, `won_usd`. Context only: no card reads it in v1.
**param_target** — `scope_type` (ALL / CHANNEL), `scope_code`, `metric_code`, `target_value`, `direction` (UP / DOWN / BAND), `sort_order`. Holds the channel CPA targets and CTR bands and every threshold that the rules below use. Neither flavour hard-codes one (A-75).
**param_finance** — `metric_code`, `valid_from`, `value`: GROSS_MARGIN_PCT 0.363 (2025-01-01); PAID_TEAM_COST_MONTH_USD 45,500 (2025-01-01) and 55,730 (2026-10-05; deviation D-2). Use the row with the latest `valid_from` ≤ the day.
**param_alert_rule** — `rule_code`, `severity` (CRIT / WARN / INFO / OK), `title`, `scope_type` (CAMPAIGN / CHANNEL / ALL / SOURCE), `metric_code`, `condition` (text; the evaluation is in "Alerts" below), `sort_order`.
**sync_log** — `source_code` (AD_PLATFORMS, WEB_ANALYTICS, MMP, PRODUCT_EVENTS, BILLING, CRM, ATTRIBUTION), `source_name`, `cadence` (HOURLY / DAILY), `last_sync_ts`, `stale_after_h` (6 hourly / 30 daily), `red_after_h` (24 / 72), `status`.

## Rules to apply in your measures

These rules bind both flavours. Values in brackets are the default-window ALL anchors.

**Windows and comparisons**
- A window is a set of whole calendar days ending on or before the as-of day. Flow metrics are window sums. Ratios are ratios of window sums, never averages of daily ratios, except the CAC step in the story checks.
- Previous period means the same number of days immediately before the window. Same period last year means the same calendar dates one year back (`ly_date`). Plan means the window plan for Spend and the targets in `param_target` for the other vitals; New MRR has no plan.
- Anchor every window on `manifest.json › as_of_date` (in Power BI, `meta_dataset[as_of_date]`), never on `TODAY()`.

**Point-in-time metrics** are read at the end of the window, never summed:
- Frequency (7-day) = Σ impressions of the window's last 7 days ÷ Σ `reach_7d` on the window's last day, at creative, ad set or campaign scope. `reach_7d` sums over creatives and is not de-duplicated.
- CTR 7-day slope = (CTR of the last 7 days ÷ CTR of the 7 days before) − 1.
- Churn, R90 and retention use the cohort months defined below relative to the window end.

**Attribution model switch** (A-16, A-73). The selected model (default DDA when nothing is selected) applies only to `paid_customers` and `new_mrr_usd`, and through them to CPA, paid and blended CAC, ARPA, ROAS, payback, LTV:CAC, the funnel's Paid stage, the reported-vs-modelled gap and the movers. Sign-ups, activations, trials, cohorts and retention never switch, and the cohort facts are DDA only. For every day, Σ over campaigns of `paid_customers` is equal under DDA, LAST_CLICK and FIRST_TOUCH and is an integer, and Σ `new_mrr_usd` is equal under those three models. PLATFORM is the networks' over-claim.

**Metric formulas**
- Spend = Σ `spend_usd`. Agency fee and team cost are not in spend. [$188.4k]
- Plan = Σ over the window's days of `budget_usd ÷ days_in_month` for the scope's campaigns. Pacing = Spend ÷ Plan. [$176.0k; 107 %]
- CTR = clicks ÷ impressions; CPC = spend ÷ clicks; CPM = spend ÷ impressions × 1000. [1.57 %; $0.84; $13.3]
- Sessions (web) = Σ `sessions`. Landed = sessions + installs. Web landing rate = sessions ÷ clicks of web campaigns. Store CVR = installs ÷ store views. Install → sign-up = sign-ups of mobile campaigns ÷ installs. Web landing → sign-up = sign-ups of web campaigns ÷ sessions. [114.8k; 136.5k; 79.7 %; 29.4 %; 15.8 %; 3.1 %]
- Sign-ups = Σ `fact_funnel_day.signups`. CPL = spend ÷ sign-ups. Click → sign-up = sign-ups ÷ clicks. [6,980; $27; 3.1 %]
- Activated = Σ `step_first_dashboard`. Activation rate = ÷ sign-ups; cost per activated = spend ÷ activated. [2,860; 41 %; $66]
- Trials = Σ `trials`; trial rate = trials ÷ sign-ups; Trial → paid = paid customers ÷ trials. [3,220; 46 %; 14.2 %]
- Paid customers = Σ `paid_customers` of the model; CPA = spend ÷ paid customers. [457; $412]
- **Team cost of a window** = Σ over its days of `PAID_TEAM_COST_MONTH_USD` (valid row) ÷ `days_in_month`, allocated to a scope pro rata to the scope's share of the window's ALL spend. **Paid CAC** = Spend ÷ Paid customers. **Blended CAC** = (Spend + allocated team cost) ÷ Paid customers. [$54.1k; $412; $531]
- New MRR = Σ `new_mrr_usd` of the model; ARPA = New MRR ÷ Paid customers. [$61.9k; $135]
- **CAC payback (months)** = Blended CAC ÷ (ARPA × `GROSS_MARGIN_PCT`). [10.8]
- **Monthly logo churn** = Σ `churned` ÷ Σ `customers_start` over the scope's cohort rows with `month_offset` ≥ 1 whose calendar month (cohort + offset) falls in the trailing 3 complete months at the window end. A month counts as complete when the window ends on or after its last day: for a window ending 3 Nov 2026 that is Aug–Oct 2026; for one ending 4 Oct 2026, Jul–Sep 2026. **LTV** = ARPA × GM ÷ churn. **LTV:CAC** = LTV ÷ Blended CAC. [2.72 %; 3.4×]
- **ROAS (90-day)** = New MRR × R90 ÷ Spend. **R90** = Σ `revenue_usd` of offsets 0–2 ÷ `revenue_usd` of offset 0 for the newest cohort month m with m + 2 ≤ the last complete month at the window end. That is Aug 2026 for the default window and Jul 2026 for the previous period. R90 is computed over the scope's campaigns that have that cohort. For a single-campaign scope with no such cohort, fall back to its channel's campaigns; if none of those have it either, fall back to ALL. [R90 3.10; search 1.31 · social 0.74 · app 0.98 · display 0.62 · retargeting 1.90 · affiliates 1.22]
- **Attribution gap** = paid customers (PLATFORM) ÷ paid customers (selected first-party model) − 1. Reported CPA = spend ÷ PLATFORM paid customers; it is the lower bar. [+38 %; reported CPA $299]
- **Brand share** = spend of brand campaigns (`is_brand`) ÷ spend of the scope's paid-search campaigns. It exists only when the scope has paid-search spend. [42 %]
- **Onboarding steps** = Σ of each step column ÷ Σ sign-ups, in `dim_onboarding_step.sort_order`. [100 → 88 → 81 → 52 → 41 → 23 %]
- **Sign-up → activation time** = the seven `act_*` bins as shares of their sum. The median in hours is found by linear interpolation inside the median bin, with bin edges 0 / 1 / 6 / 24 / 48 / 96 / 168 / 720 h. The window's distribution is right-censored (recent sign-ups have not had 30 days); say so in the ⓘ. [26 h]
- **Activation by segment** = Σ `activated_7d` ÷ Σ `signups` per segment. [46 / 38 / 47 / 44 / 39 / 29 %]
- **Landing pages (J1):** web CVR = page sign-ups ÷ sessions, bounce = bounces ÷ sessions, LCP = sessions-weighted mean of `lcp_ms_p75`. Store-page CVR = installs ÷ store views; show "—" for bounce and LCP on store rows. [App Store 31 % · Google Play 27 %]
- **Terms (P5):** CPC = spend ÷ clicks, CVR = `signups` ÷ clicks, Conv. = `signups`. Search campaigns show keywords; the others show placements or audiences.
- **Cohorts (K1–K5)** use the default model and the scope's campaigns. Cohort blended CAC = (spend of the cohort month + team cost of the month allocated by that month's spend share) ÷ `customers_start` at offset 0. **Payback curve** value at offset m = Σ_{k ≤ m} (`revenue_usd` − `refunds_usd`) × GM ÷ (cohort spend + allocated team cost). It is **paid back** at the first m where the value is ≥ 100 %. Cohort ARPA = offset-0 revenue ÷ customers. Cohort refund rate = Σ `refund_count` ÷ `customers_start` at offset 0.
- **Refund rate (guardrail and K4)** = Σ `refund_count` (all offsets) ÷ Σ `customers_start` (offset 0) over the 12 acquisition months ending with the window's end month. [2.1 %]
- **D7 / D30 retention (guardrail)** use the latest cohort month whose D30 cell is reportable at the window end (month start + 44 days ≤ window end), with `users_active ÷ users_matured` at N = 7 and N = 30. For the default window that is Sep 2026. [27 % / 13 %]
- **Trial → paid shortfall** = trials × (previous-period trial → paid of the same scope) − paid customers. **Loss share of a campaign** = its shortfall ÷ the ALL shortfall. [ALL 61.6; SOC_META_LAL2 43.1 → 70 %]

**Funnel display:** O1 draws bar widths on a log10 scale with the true counts beside the bars; the native funnel visual is linear. The C2 web-vs-app funnel shows each stage's conversion from the previous stage.

**Delta direction** (A-23; `param_target.direction` is the single source). Up is good for paid customers, New MRR, LTV:CAC, ROAS, CTR, CVRs, retention and activation. Down is good for Spend vs plan, CAC, CPA, CPC, CPM, CPL, payback, refund rate and frequency. Pacing is a BAND (85–110 %). Rates move in pt, amounts and counts in %.

**Verdicts (healthy-range colour; always against `param_target` / plan, never against the comparison mode)**: 1 OK, 2 WARN, 3 CRIT.
- UP metric: OK if ≥ target, WARN if ≥ target × (1 − `WARN_BAND_REL`), else CRIT.
- DOWN metric: OK if ≤ target, WARN if ≤ target × (1 + `WARN_BAND_REL`), else CRIT.
- Spend vs plan: OK when |pacing − 1| ≤ `SPEND_PLAN_TOL`, CRIT when pacing is above `PACING_HI` or below `PACING_LO`, else WARN.
- Customers target = `PAID_CUSTOMERS_30D` × days ÷ 30. New MRR has no verdict.
- Channel and campaign pacing colour (C4): CRIT above 110 %, WARN below 85 %, neutral otherwise.
- [default window: spend WARN, customers WARN, blended CAC WARN, payback OK, LTV:CAC OK; trial → paid WARN, D7 OK, D30 OK, refund OK, brand share WARN, attribution gap WARN]

**Flags** (A-24; campaign and channel rows; all thresholds come from `param_target`):
1. Exclusive gates, shown alone: objective PIPELINE → *Pipeline-led*; LEAD → *Lead goal*; RETENTION → *No CPA goal*; status LEARNING → *Learning*. A channel shows *Learning* when every campaign that spends in it is learning.
2. Otherwise, every flag that trips, in this order:
   - *Fatigue*: CTR 7-day slope < `FATIGUE_SLOPE` and frequency > `FATIGUE_FREQ`.
   - *Frequency*: frequency > `FREQ_HIGH`.
   - *Install quality*: objective INSTALL and install → sign-up of the window's last 7 days − the previous period < `INSTALL_QUALITY_PT`.
   - *View-through heavy*: PLATFORM ÷ DDA paid > `VIEW_THROUGH_RATIO`.
   - *CPA over*: CPA > target × `CPA_OVER_TOL`, and only when none of the four root-cause flags above trips.
   - *Over-pacing*: pacing > `PACING_HI`.
   - *Underspent*: pacing < `PACING_LO`.
3. *On target* when nothing trips.

[SOC_META_LAL2 = Fatigue + Over-pacing]

**Creative status (P4):** *Fatigued* = slope < `FATIGUE_SLOPE` and frequency > `FATIGUE_FREQ`; *Watch* = slope < 0 and frequency > `WATCH_FREQ`; *Fresh* otherwise.

**Alerts (O5; `param_alert_rule`, evaluated on the window with the filters applied)**:
- FATIGUE (CRIT): per campaign, the Fatigue rule.
- PACING_OVER (WARN): per channel, pacing > `PACING_HI`; value = spend − plan.
- INSTALL_QUALITY (WARN): per INSTALL campaign, the Install-quality rule; value = the pt change.
- ATTR_GAP_WIDEN (INFO): ALL, gap − previous-period gap ≥ `ATTR_GAP_WIDEN_PT`.
- UNDERSPENT_SCALE (OK): per channel, pacing < `PACING_LO` and ROAS 90 d ≥ `ROAS_SCALE`; value = plan − spend.
- DATA_STALE (CRIT): any source age ≥ `red_after_h`.

Exactly five trip in the default window.

**Movers (O6):** the campaigns with a ROAS-bearing objective (PAID, INSTALL or PIPELINE) and spend in both the window and the comparison period, ranked by ROAS 90 d − comparison ROAS 90 d. Show the three best and the three worst.

**Freshness (A-17):** age = refresh stamp − `last_sync_ts`. The dot is green when every source is below its `stale_after_h`, amber when any source is at or above it, and red when any source is at or above `red_after_h`. "Synced n h ago" is the age of the oldest HOURLY source. [2.25 h → "2 h"; green]

## Control totals

`checks/control_totals_usd.csv` is in long format, `scope, period_key, metric_code, value` (A-76), with 28,660 rows. Tolerance: amounts 0.005, ratios 1e-6, counts and codes exact. A row that is absent means n/a.

- **Scopes:** `ALL`; `CH:<channel_code>` (6); `PF:WEB`, `PF:IOS`, `PF:ANDROID`, `PF:IOS+ANDROID`; `CP:<campaign_key>` (19); `PF:IOS+CH:PAID_SOCIAL`, `PF:ANDROID+CH:PAID_SOCIAL`, `PF:IOS+ANDROID+CH:PAID_SOCIAL`, `PF:WEB+CH:PAID_SEARCH`. Also `CR:<creative_key>` for the SOC_META_LAL2 creatives live on the as-of day, and `TM:<term_key>` for the terms of SOC_META_LAL2 and SRCH_NONBRAND_ANALYTICS.
- **Period keys:**
  - `R30-2026-11-03` (default window), `R30-2026-10-04` (previous period), `R30-2025-11-03` (LY), `R7-2026-11-03`, `MTD-2026-11-03`, `QTD-2026-11-03`, all at every scope.
  - `M-2025-01` … `M-2026-10` (calendar months) at ALL, CH, PF and `CP:SOC_META_LAL2`.
  - `D-2026-10-05` … `D-2026-11-03` (days) at ALL and `CP:SOC_META_LAL2`.
  - `C-2025-01` … `C-2026-11` (cohort months) at ALL and `CP:SOC_META_LAL2`.
- **Metrics:**
  - Every metric in "Rules" under its own name: `spend`, `plan`, `pacing`, `impressions`, `clicks`, `ctr`, `cpc`, `cpm`, `sessions`, `web_land_rate`, `store_views`, `installs`, `first_opens`, `store_cvr`, `install_signup_rate`, `landing_signup_rate`, `landed`, `signups`, `click_signup_rate`, `cpl`, `activated`, `activation_rate`, `cost_per_activated`, `trials`, `trial_rate`, `trial_to_paid`, `team_cost`, `paid_cac`, `blended_cac`, `arpa`, `payback_months`, `churn_monthly`, `ltv`, `ltv_cac`, `r90`, `roas_90d`, `attribution_gap`, `brand_share`, `refund_rate`, `retention_cohort_month` (yyyymm), `d7_retention`, `d30_retention`.
  - Model variants: `paid_customers.dda / .last_click / .first_touch / .platform`, `new_mrr.*` and `cpa.*`.
  - R-keys only: `step_<step>_pct`, `act_<bin>_share`, `act_median_hours`, `segment.<code>.signups / .activation_rate`, and `page.<key>.sessions / .cvr / .bounce_rate / .lcp_ms / .store_views`; at windows of 14 days or more, `frequency_7d` and `ctr_slope_7d`.
  - Targets: `*_target` at ALL and `cpa_target` at CH and CP.
  - `verdict.<metric>` at ALL; `flag.<CODE>` (0 / 1) at CP and CH; `install_quality_delta` for INSTALL campaigns; `trial_shortfall` at R30 keys.
  - Default window only: `alert.<RULE>` and `alert_value.<RULE>` at the rule's scopes, `alerts_tripped`, `roas_delta` and `mover_rank` (1 … 3 best, −1 … −3 worst), `freshness_dot`, `synced_hours_ago`, `source_age_h.<source>`, and the `story.*` rows.
  - Cohort keys: `customers`, `arpa`, `cohort_cac`, `refund_rate`, `payback.m<k>`, `payback_month`, `retention.d<N>`.
  - Creative keys: `ctr_7d`, `ctr_slope_7d`, `frequency_7d`, `creative_status`. Term keys: `impressions`, `clicks`, `spend`, `signups`, `cpc`, `cvr`.

### Default window · ALL · DDA · vs previous period (AT-02, asserted at display precision)

| Tile / card | Display | Exact in the data |
| --- | --- | --- |
| Spend | **$188.4k +7.0 %** vs $176.1k · plan $176.0k (+7.0 %) · pacing 107 % | 188,400.00 · 176,100.00 · 176,000.00 |
| New paying customers | **457 +2.9 %** vs 444 · target 480 | 457.0000 · 444.0000 |
| Blended CAC | **$531 +6.4 %** vs $499 · paid CAC $412 (prev $397) · team $54.1k | 530.66 · 498.66 · 412.25 · 396.62 |
| New MRR | **$61.9k +3.4 %** vs $59.85k · ARPA $135 (prev $135) | 61,900.00 · 59,850.00 |
| CAC payback | **10.8 mo +0.6** vs 10.2 · target < 12 | 10.79 · 10.19 |
| LTV : CAC | **3.4× −0.2** vs 3.6× · floor 3.0× · churn 2.72 % | 3.41 · 3.61 |
| Funnel | 14.2 M impressions → 223.0k clicks (+0.9 % vs 221.0k; CTR 1.57 %, CPC $0.84, CPM $13.3) → sessions 114.8k + installs 21.7k → sign-ups 6,980 (CPL $27) → activated 2,860 (41 %, $66) → trials 3,220 (46 %) → paid 457 (CPA $412) | 14,203,417 · 223,014 · 114,812 · 21,704 |
| Rates | click → sign-up **3.1 % (+0.2 pt** vs 2.9 %) · **trial → paid 14.2 % (−1.9 pt** vs 16.1 %) | |
| Guardrails | trial → paid 14.2 % (16 %) · D7 27 % (≥ 25 %) · D30 13 % (≥ 12 %) (Sep 2026 cohort) · refund 2.1 % (< 3 %) · brand share 42 % (40 %) · attribution gap +38 % (prev +30 %, target 30 %) · synced 2 h, green | |
| Channels: spend k · paid · CPA · ROAS 90 d · pacing · plan k · gap | search 61.2 · 188 · $326 · 1.31 · 106 % · 57.5 · +18 % — social 64.1 · 112 · $572 · 0.74 · 119 % · 54.0 · +72 % — app 28.6 · 71 · $403 · 0.98 · 101 % · 28.3 · +29 % — display 19.9 · 33 · $603 · 0.62 · 108 % · 18.5 · +95 % — retargeting 9.4 · 38 · $247 · 1.90 · 84 % · 11.2 · +17 % — affiliates 5.2 · 15 · $347 · 1.22 · 80 % · 6.5 · 0 % | |
| Platforms | web $116.0k · iOS $39.3k · Android $33.1k · iOS + Android $72.4k | |
| SOC_META_LAL2 | spend $19.8k, pacing 122 %, CPA $641 (target $420), ROAS 0.58, Δ ROAS −0.41 (worst mover), CTR 7-day slope −46 %, frequency 3.4, flags Fatigue + Over-pacing, learning ended 2026-10-05; carries 70 % of the trial → paid shortfall (43.1 of 61.6) | |
| Dashboard in 60s · v3 | CTR (7 d) 1.82 %, slope −46 %, frequency 3.4, Fatigued | |
| The step | ALL paid CAC 7-day mean Oct 18–24 vs Oct 11–17 **+20 %** (20.1 %); mobile paid social trial → paid **16.5 % → 9.8 %** (Oct 5–17 vs Oct 18 – Nov 3); web paid search 15.3 % → 15.2 %; every other channel −0.2 pt | |
| Journey | App Store CVR 31 % (prev 31 %), Google Play 27 % (prev 28 %); web landing → sign-up 3.1 %; install → sign-up 15.8 %; onboarding 100 / 88 / 81 / 52 / 41 / 23 % (largest drop: Connect data source −29 pt); median sign-up → activation 26 h; segments 46 / 38 / 47 / 44 / 39 / 29 % | |
| Second thread | UAC install → sign-up 14.0 % → 11.5 % from Oct 22; last 7 days vs previous period −2.5 pt | |
| Cohorts | SOC_META_LAL2 cohorts Oct 2025 – Jan 2026 pay back in **month 9**; ALL cohorts Oct – Dec 2025 pay back in month 10, and the Jan 2026 cohort has not paid back by its last complete month (9); gross margin 36.3 % | |
| Movers (Δ ROAS) | Retarget · Trial abandon +0.32 · Brand search · Global +0.11 · Apple Search Ads · Core +0.06 · TikTok · Creator cuts −0.09 · YouTube · Product demo −0.18 · Meta Lookalike 2 % −0.41 | |
| Alerts (5) | CRIT Lookalike fatigue (CTR −46 % at 3.4) · WARN paid social 119 % of plan (+$10.1k) · WARN UAC install quality (−2.5 pt) · INFO attribution gap +8 pt vs previous period · OK retargeting underspent (84 %, ROAS 1.90; Trial abandon 84 % with ROAS 2.1) | |

## Stories built into the data

- **The why chain (A-63).**
  1. Spend and CAC are up.
  2. Trial → paid fell while clicks rose 0.9 %.
  3. ALL paid CAC steps up on Oct 18.
  4. The drop is in mobile paid social only (16.5 % → 9.8 %); web and every other channel are flat.
  5. SOC_META_LAL2 carries 70 % of the shortfall. After the 2026-09-28 budget raise (+40 %), learning ended on 2026-10-05; trials doubled against the previous period while trial → paid fell from 25 % to 10 %.
  6. Its top creative *Dashboard in 60s · v3* (launched 2026-09-15) carries about 97 % of the campaign's impressions in the last two weeks, and its CTR fell 46 % at frequency 3.4.
  7. App Store CVR is flat (31 %), so the leak is before the click.
  8. The campaign's Oct 2025 – Jan 2026 cohorts still pay back in month 9.
  9. The attribution gap widened to +38 %, and the data is 2 h old.

  Decision text: rotate the creative, hold the budget.
- **The second thread (A-64):** UAC install → sign-up drops on Oct 22; paid social runs at 119 % of plan; retargeting is at 84 % with room to scale; the attribution gap is +8 pt.
- **History (A-66).** Spend grows from about $109k a month in Jan 2025 to $188.4k per 30 days in Oct 2026. The pattern has weekday dips (B2B), a summer trough (Jul–Aug), a Q4 build and a holiday dip in late December. CPM rises while trial → paid improves into 2026, so blended CAC holds at about $445–460 a month through 2025 and H1 2026 ($497 in the holiday month of Dec 2025), then climbs to $490 in Sep 2026 and $531 in the window. The paid-team cost steps up on 2026-10-05.
- **Roster.**
  - Meta prospecting · Lookalike 1 % ran until 2025-12-31 (Ended).
  - Summer promo · Search ran from 2026-06-01 to 2026-08-31 (Ended).
  - Meta retention · Churn-risk spends until 2026-09-30, then Paused. It has no paid credits (RETENTION objective).
  - TikTok · Creator cuts has been live since 2026-06-01 and re-entered learning on 2026-10-12 (expected end 2026-11-09).
  - Affiliate · Review sites has been live since 2025-03-01 and re-entered learning on 2026-10-01 with new partner sites.
  - LinkedIn · Webinar Nov started on 2026-10-01.

## Determinism

`generate.py` uses one `numpy.random.default_rng(20261104)` stream in a fixed order. Integer allocations use largest-remainder rounding with index tie-breaks, and no wall-clock or locale values reach the files. Two runs into two separate folders (`--out A`, `--out B`) produced SHA-256-identical files for all 29 outputs: 27 Parquet files, `manifest.json` and `control_totals_usd.csv`. `verify.py` repeats this as AT-20 (a rerun into a temp folder, byte-compared). The claim holds for the pinned `requirements.txt` on CPython 3.12. Another pyarrow version may change Parquet bytes, but it does not change values.

## Deviations from ADR-0015

Each is the smallest change that keeps the story. The ADR's binding values all hold, except where an item below states otherwise.

- **D-1 Status counts.** A-65 says "13 Live", but the 19-campaign roster that A-65 lists is 14 Live + 2 Learning + 1 Paused + 2 Ended. Sixteen campaigns spend in the window (14 + 2).
- **D-2 Team cost step: $45.5k → $55.73k a month on 2026-10-05** (ADR: $54.3k on 2026-10-01).
  - With the A-38 day-weighted team cost, the ADR's values give blended CAC $528 vs $501 (+5.3 %), not $531 vs $499 (+6.4 %), because the step would put four October days of the new cost into the previous period.
  - Moving the step to the window start keeps $45.5k and the previous period's $499. Setting 55,730 a month gives a window team cost of $54.1k and $531 (+6.4 %).
  - A-38's bracket "team $54.3k" therefore reads $54.1k.
- **D-3 Store → install 29.4 % and web landing rate 79.7 %** (A-33 / A-53 / ADR "31 %" and "75 %").
  - The page CVRs are binding: App Store 31 %, Google Play 27 %. The all-mobile store CVR is their store-view-weighted mean, and it reaches 31 % only if iOS takes at least 80 % of store views.
  - That share is not possible with the binding platform spend (iOS $39.3k, Android $33.1k) and with the Android paid-social trials that the 16.5 % → 9.8 % thread needs.
  - Mobile store views of about 73.7k must sit at or below mobile clicks, which leaves about 144k web clicks for the binding 114.8k sessions.
- **D-4 `fact_ad_delivery_day.paid_customers_dda` added.** P3 "Ad sets by CPA" had no conversion source at ad-set grain. The column splits the campaign-day's DDA credits over its creatives by clicks.
- **D-5 Campaign frequency and slope vs the creative list.** A-44 sums reach and clicks over creatives, so a campaign's frequency cannot exceed its highest creative's. SOC_META_LAL2 at 3.4 and −46 % (binding) equals its top creative (binding) only if that creative carries about 97.5 % of the impressions in the last 14 days. The other seven creatives therefore run at test budgets. Their CTR, slope and frequency follow the mockup list approximately (indicative; for example, *Spreadsheet pain · v2* shows −8 % where the mockup shows −12 %).
- **D-6 Install quality on the window's last 7 days.** A-24 says "install → sign-up Δ vs previous period". On the full window, the Oct 22 change shows as about −1.2 pt and would not trip the −2 pt rule. Measured on the last 7 days against the previous period, it shows at full size: −2.5 pt, the alert value of A-64.
- **D-7 Cohort counts are double.** `customers_start`, `churned`, `customers_end` and `refund_count` are DDA credits, so they are fractional per campaign. AT-05 ties `customers_start` at offset 0 to Σ DDA `paid_customers`.
- **D-8 `sync_log.last_sync_ts` is `timestamp[ms]`.** Parquet has no seconds unit, so pyarrow stores and returns milliseconds. The values are whole minutes.
- **D-9 27 tables.** The ADR text says 26, but its table lists 27.
- **D-10 Activation-timing shares.** The mockup shares (14 / 19 / 17 / 16 / 12 / 9 / 13 %) give a median of about 24 h on complete data. The window is right-censored: sign-ups of the last 30 days have not had time to reach the later bins. The generator therefore tilts the shares toward later bins until the window median is 26 h. The window then shows 8.6 / 20.2 / 19.3 / 22.2 / 13.3 / 8.8 / 7.5 %, and the fully observed previous period shows a median of 35 h.
- **D-11 The Jan 2026 ALL cohort cannot show a crossing at month 10–12.** Its last complete month is offset 9 (Oct 2026). verify asserts that Oct–Dec 2025 cross at month 10 and that Jan 2026 has not crossed by month 9.
- **D-12 Meta prospecting · Interests is "On target", not "CPA over".** Its credits follow from the mobile paid-social thread, which gives CPA $434 against the $462 threshold. The row is indicative.
- **D-13 RT_APP_REENGAGE is "Underspent".** The retargeting plan sums to $11.2k with both retargeting campaigns at 84 %. The mockup's "On target" is indicative.
- **D-14 Thresholds the ADR's list did not name**, added to `param_target` so that no flavour hard-codes them (A-75): ROAS_SCALE 1.5, ATTR_GAP_WIDEN_PT 0.05, SPEND_PLAN_TOL 0.05, CPA_OVER_TOL 1.10, WATCH_FREQ 2.5, VIEW_THROUGH_RATIO 1.8, INSTALL_QUALITY_PT −0.02, WARN_BAND_REL 0.30. That makes 43 rows, not "≈ 35".
- **D-15 Revenue expansion in cohorts.** The binding channel ROAS values and New MRR ($61.9k) need R90 ≈ 3.10 (Σ ROAS × spend = $192.2k), so per surviving customer, offsets 1 and 2 earn 6 % and 10 % above offset 0, then +0.4 % a month. R90 is 3.10 (Aug 2026 cohort) and 3.12 (Jul 2026).
- **D-16 Definitions the ADR left open.**
  - Refund rate covers the 12 acquisition months ending with the window's end month, and refunds are separate from churn.
  - D7 / D30 come from the latest cohort month whose D30 cell is reportable at the window end.
  - The loss share uses each scope's own previous-period trial → paid.
  - The CAC step is the mean of daily paid CAC over the two 7-day windows.
  - "Flat ± 0.5 pt" is met with −0.2 pt per channel (web paid search −0.1 pt).
- **D-17 November 2026 cohort.** Only offset 0 of the partial acquisition month is written, so K5 can list the window's end month. No other offset of November is written.
- **D-18 `--out` is the dataset folder** (Parquet in `<out>/parquet`, control totals in `<out>/checks`), as in Nordmark. The default `..` from `generator/` puts the Parquet in `../parquet`.

## Not in the data (ADR-0015 (c), §5)

- The lookback and conversion-event selectors: there is one lookback per model (30 d click / 1 d view) and one conversion event (paid).
- The Audience group beyond Market: no device, visitor-type or country grain.
- Session recordings and heatmap links, creative thumbnails, user-saved views, a pipeline card, an organic baseline, and RLS.
- The spec's open questions keep the ADR defaults:
  - Gross margin is the company-wide 36.3 %.
  - Agency fee is not in spend.
  - Brand search counts in CAC.
  - One activation event serves both tiers.
  - The channel targets are seeded from the mockup.
