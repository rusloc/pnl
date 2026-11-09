# ACME Marketing — JS flavour (`js-marketing/`): Track C contract

> **DRAFT — projection state.** Written 2026-11-05 by archi after the USER's decision of the same day: **build the JS flavour in this repo now; the Power BI report is the reference** (look, copy, behaviour, numbers). ADR-0015 (a) is amended to its alternative 1 (both flavours here, parity gate before the pack). This is the one document nerd builds from and hunter tests against. Nothing here changes the Power BI flavour, the data or the generator.
>
> **Precedence (highest first):** `data/acme_marketing_dummy_data/README.md` (names, grains, metric rules, deviations D-1 … D-18) → `pbi-report/ACME Marketing/` as built on 2026-11-05 (PBIP README view map + change log, `dim_card`, the measure dictionary `docs/model/marketing-measure-dictionary.md`) → `docs/Requirements-marketing.md` (A-nn / AT-nn) → ADR-0015 → the USER spec bundle. Where the PBIP and the requirement note differ, the PBIP wins and the A-nn line gets a dated note (round 1 changed A-20 / A-21 / A-52 / AT-02 already). Where Power BI could not do what the spec asks (platform limits), the JS flavour builds the spec's version — §7.3 lists exactly which rows.
>
> **Precedents:** `js-exec/` (Nordmark JS flavour) for toolchain, layout, engine shape, tests, URL state, CSP; ADR-0002 (Track C architecture: pre-aggregated Parquet + pure-TS engine, no backend, no DuckDB-wasm); ADR-0012 (visual first); ADR-0013 (j) (sync points); ADR-0014 (packs); `docs/design/parity-rules.md`.

## 1. App, toolchain, gate

| Item | Decision |
|---|---|
| Folder | `js-marketing/` at the repo root (DEC-005: one standalone Next.js app per showcase; no cross-app imports; `parquet-columns.ts`, `csv.ts` vendored with a source header). Already scaffolded by nerd (`package.json`, `lib/data/manifest.ts` source schema, `scripts/build-marketing-data.ts` check-only, `lib/test-utils/marketing-data.ts`, icons). |
| Toolchain | Pinned exactly as `js-exec/package.json`: Next 16.4.2 (App Router, `cacheComponents`), React 19.3.1, TypeScript 5.9.3 strict, hyparquet 1.31.5, hyparquet-writer 0.17.0, Zod 4.6.7, Vitest 5.0.5, ESLint 9.39.5 + eslint-config-next 16.4.2, Prettier 3.9.10, Node ≥ 24 (native type stripping for `scripts/`). No new dependency without the main agent's yes (CLAUDE.md › Ask first). |
| Scripts | `build:data` (`node scripts/build-marketing-data.ts`: `../data/acme_marketing_dummy_data/parquet` → `public/data/`), `prebuild` = `build:data`, `build` = `next build`, `typecheck` = `next typegen && tsc --noEmit`, `lint` = `eslint`, `test` = `vitest run` (reads `public/data`, so `build:data` first), `format`. |
| Gate (every hand-back) | `npm run typecheck && npm run lint && npm test && npm run build` green; the control-total suite (§7.1) 100 % of rows; the byte budgets of §2.3 met (the build script fails otherwise). |
| Runtime | Static shell (`○ /`), everything in the browser: `public/data` + the engine. No API route, no server state, no DuckDB-wasm, no backend. Runtime hooks as js-exec: `NEXT_PUBLIC_SITE_URL` (metadata base, optional), `EMBED_ALLOWED_ORIGINS` (server-side, comma-separated https origins → CSP `frame-ancestors`; the `next.config.ts` of js-exec is copied as is, incl. the fail-the-build check on a malformed origin). No secrets, no IDs. |
| Embed target | vosk.dev board **1440 × 810**; the app designs at 1440 wide and **may grow taller** (ADR-0015 risk 4, A-50, Mirelo precedent) — height rule pending the USER (§10 q A). Below 1200 px the app is not optimised (spec responsiveness is out of scope for v1; no bottom bar, no 6-column grid). |
| Theme | **Light + dark** (A-58); dark follows `prefers-color-scheme`, overridable by the URL key `theme` (§6) so the host can force one. Tokens in §5.1. Pending the USER whether dark ships in v1 or later (§10 q B); the tokens cost nothing, the per-chart dark check costs a pass. |
| A11y / motion | A-59: every control keyboard-reachable, status never by colour alone (arrow glyphs, flag words), tooltips on focus, view cross-fade 180 ms, window scale-in 220 ms, `prefers-reduced-motion` honoured. Layers (`LayerFrame` pattern of `js-exec/components/Layers.tsx`): one scrim, one layer open at a time, Esc / × / click outside close, focus trapped and returned. |
| Performance | A-83: a filter change re-renders every card of the current view in < 100 ms on the shipped data (typed-array scans over ≤ 10.2 k campaign-day rows; the lazy files add ≤ 82 k rows for one view). First paint ≤ 750 kB of data (§2.3). |

## 2. Data plan

### 2.1 Rule

Everything that is a **sum over days** is pre-aggregated in `scripts/build-marketing-data.ts` to **day × campaign** grain (the finest grain any built card reads; one platform / channel / network / market / tier per campaign, so every scope filter is a campaign mask). The browser engine only **windows** (picks day indices), **masks** (campaign / scope / status), **sums** and takes **ratios**. Attribution credits are already precomputed per model by the generator (ADR-0015 (c)); the build copies the four models as eight columns. There is no currency translation (USD only). **One allocation stays in the engine by necessity:** the paid-team cost of a window is allocated to a scope by its spend share of that window (A-38), and the share depends on the window, so it cannot be a column; it is one formula (`teamCost(scope, window)`), tested by the `team_cost` / `blended_cac` control rows.

Nothing ships below day × campaign except the four per-view lazy files (page, segment, term grain) that the Journey and Campaigns cards read directly. Ad sets, creatives and the pipeline table do not ship (their cards P3 / P4 were dropped by the USER in redesign round 1; see §2.4 for the creative control rows).

### 2.2 Source table → shipped form

| Source table (rows) | Ships as | Why |
|---|---|---|
| `dim_date` (730), `dim_month` (24) | **Derived in the engine** from `manifest.meta` (first day 2025-01-01, as-of 2026-11-03 → 672 day indices; ISO week start Monday; `ly_date` = same calendar date one year back; month index 0 = 2025-01) | 1,8 kB of rules instead of 730 rows; the build **asserts** the derived calendar equals `dim_date` / `dim_month` column for column (week_start, ly_date, month_index, days_in_month, is_actual) and fails otherwise |
| `dim_platform` (3), `dim_platform_segment` (6), `dim_channel` (6), `dim_network` (8), `dim_campaign` (19), `dim_landing_page` (8), `dim_onboarding_step` (6), `dim_attribution_model` (4) | `manifest.json` arrays, every column, strict Zod objects | Small; the engine indexes them once (`camp_ix` etc.) |
| `param_target` (43), `param_finance` (3), `param_alert_rule` (6), `sync_log` (7) | `manifest.json` arrays (A-75: no threshold hard-coded anywhere else) | — |
| `fact_budget_month` (456) | `manifest.budget` `[month_ix, camp_ix, budget_usd]` | Plan is month-overlap arithmetic (`_b Plan`), not a daily sum; 456 triples ≈ 9 kB |
| `fact_ad_delivery_day` (83,483) | Collapsed over ad set × creative into **`campaign-day.parquet`** (impressions, clicks, spend, `reach_7d` summed over the day's creative rows — A-44 / D-5) | 8× fewer rows; no card reads ad sets or creatives |
| `fact_funnel_day` (10,198) | `campaign-day.parquet` (signups, activated = `step_first_dashboard`, trials, the 7 `act_*` bins) + **`journey-day.parquet`** (the other 4 steps) | The vitals (V2, V3, V4) and O1 need sign-ups, activated, trials and the bins at first paint; the step shares only on Journey |
| `fact_attribution_day` (35,237 = 9,574 campaign-days × ≤ 4 models) | `campaign-day.parquet`: `paid_dda, paid_last_click, paid_first_touch, paid_platform, mrr_dda, mrr_last_click, mrr_first_touch, mrr_platform` (0 where no row) | The model switch is a column choice; PLATFORM is needed at first paint (O2 gap) |
| `fact_traffic_day` (18,880) | Stage sums into `campaign-day.parquet` (sessions, store_views, installs; `first_opens` into `journey-day.parquet`) + **`traffic-page-day.parquet`** at day × campaign × page (sessions, bounces, `lcp_x_sessions` = Σ lcp_ms_p75 × sessions, store_views, installs, signups) | J1 is the only page-grain reader; LCP is a sessions-weighted mean (A-46), so the product ships, not the p75 |
| `fact_signup_segment_day` (20,319) | **`segment-day.parquet`** (day_ix, camp_ix, seg_ix, signups, activated_7d) | J4 only; lazy |
| `fact_term_day` (81,584) | **`term-day.parquet`** (day_ix, term_ix, impressions, clicks, spend, signups); `dim_term` (152) in the manifest (a term belongs to one campaign) | P5 and the `TM:` control rows; lazy; the one file over 0.5 MB |
| `fact_cohort_revenue_month` (3,457) | **`cohort-month.parquet`** as is (cohort_month_ix, camp_ix, month_offset, customers_start, churned, customers_end, revenue_usd, refunds_usd, refund_count) | O2 (D7 / D30 month choice, refund rate), vitals V6 (R90), K1 / K2 / K6 / K7, P6 / P7 — first paint |
| `fact_retention_cohort_month` (2,241) | **`retention.parquet`** as is (cohort_month_ix, camp_ix, day_n, users_matured, users_active) | O2 D7 / D30, K3 — first paint |
| `dim_ad_set` (78), `dim_creative` (205), `fact_pipeline_month` (25), `paid_customers_dda` of the delivery table, `video_views` | **Not shipped** | No card since round 1 (P2 / P3 / P4 dropped; no pipeline card in v1) |

### 2.3 Shipped files (`public/data/`), estimated size, load time

All integers as INT32, every amount and credit as DOUBLE **copied unchanged from the source** (Float64 sums then reproduce `verify.py` to the cent / 1e-6 — DEC-001 lesson; never fixed-point them). Day index `day_ix` 0 … 671, campaign index `camp_ix` in `dim_campaign.sort_order` order, etc. Byte estimates use the Nordmark cube's measured density (≈ 3 B per cell with hyparquet-writer) — the build prints the real numbers and **fails over the hard caps**.

| File | Grain | Rows | Columns | Est. bytes | Loaded |
|---|---|---|---|---|---|
| `manifest.json` | — | — | meta + dims + params + budget + files | 50,501 B | first paint |
| `campaign-day.parquet` | day × campaign | 10,198 | `day_ix, camp_ix, impressions, clicks, spend_usd, reach_7d, sessions, store_views, installs, signups, activated, trials, act_lt1h, act_1_6h, act_6_24h, act_1_2d, act_2_4d, act_4_7d, act_7_30d, paid_dda, paid_last_click, paid_first_touch, paid_platform, mrr_dda, mrr_last_click, mrr_first_touch, mrr_platform` (27) | 568,575 B | first paint |
| `cohort-month.parquet` | cohort month × campaign × offset | 3,457 | 9 | 89,317 B | first paint |
| `retention.parquet` | cohort month × campaign × day N | 2,241 | 5 | 8,789 B | first paint (**first paint total 717,182 B**) |
| `journey-day.parquet` | day × campaign | 10,198 | `day_ix, camp_ix, step_verified, step_workspace, step_connected, step_invited, first_opens` (7) | 43,648 B | first open of Journey (also the control-total `first_opens` rows) |
| `traffic-page-day.parquet` | day × campaign × page | 18,880 | `day_ix, camp_ix, page_ix, sessions, bounces, lcp_x_sessions, store_views, installs, signups` (9) | 177,200 B | first open of Journey |
| `segment-day.parquet` | day × campaign × segment | 20,319 | 5 | 29,824 B | first open of Journey |
| `term-day.parquet` | day × term | 81,584 | 6 | 585,074 B | first open of Campaigns (**total 1,552,928 B**) |

*Sizes replaced with the actuals of nerd's build on 2026-11-05 (were estimates ≈ 45 kB / 550 kB / 90 kB / 25 kB / 110 kB / 250 kB / 150 kB / 0.9 MB, ≈ 2.1 MB total); the budgets below hold with margin, no fallback split needed. First-load JS 852 kB raw / 262 kB gzip (Zod 4 + hyparquet on the client) — recorded as CAND-024, not optimised in this build.*

Budgets: **first paint ≤ 750 kB** (hard fail 1 MB), **total ≤ 2.5 MB** (hard fail 3 MB). If `campaign-day.parquet` measures over 600 kB, the agreed fallback is to move `paid_last_click, paid_first_touch, mrr_last_click, mrr_first_touch` into a lazy `attribution-alt.parquet` loaded on the first model switch (PLATFORM and DDA stay: O2 needs the gap at first paint). No other split without updating this table.

### 2.4 Build-time checks (`scripts/build-marketing-data.ts`; every failure throws → `npm run build` fails)

1. Source manifest strict-parsed (already built); every Parquet footer matches rows / columns / bytes.
2. Calendar derivation equals `dim_date` / `dim_month` (above).
3. Ties (AT-05) on the collapsed rows: Σ `fact_traffic_day.signups` = `fact_funnel_day.signups` per campaign-day; Σ segment signups = the same; Σ `activated_7d` = `step_first_dashboard` = Σ of the first six bins; term clicks ≤ campaign clicks; stages monotone; cohort offset-0 revenue per month = Σ DDA MRR of the month and `customers_start` = Σ DDA credits.
4. Every campaign-day of the attribution table exists in the delivery / funnel set (else fail: a credit without a delivery row would vanish from the cube).
5. **Creative control rows (`CR:` scopes, 32 rows: `ctr_7d`, `ctr_slope_7d`, `frequency_7d`, `creative_status` of the eight `SOC_META_LAL2` creatives at `R30-2026-11-03`)** are computed here from `fact_ad_delivery_day` + `dim_creative` with the A-44 rule and compared with `checks/control_totals_usd.csv` (tolerance as A-76). They are a build assertion, not an engine test: no creative data ships because no card shows creatives since round 1 (§10 q D).
6. Byte budgets of §2.3; the shipped `manifest.files[*].rows/bytes` written from the actual output.

### 2.5 Shipped manifest contract (`lib/data/manifest.ts`, Zod 4, `.strict()` everywhere)

```ts
// schema 'acme-marketing/1'. Names follow data/acme_marketing_dummy_data/README.md; indices point into the arrays below.
meta: { seed: int, as_of: isoDate, refreshed: 'YYYY-MM-DDTHH:MM', first_day: isoDate /* 2025-01-01 */, days: int /* 672 */,
        default_window: { start, end }, previous_window: { start, end }, currency: 'USD' }
platforms[3]  { platform_code, platform_name, is_mobile, sort_order }
segments[6]   { segment_code, segment_name, platform_code, sort_order }
channels[6]   { channel_code, channel_name, color_slot 1-6, color_light '#rrggbb', color_dark '#rrggbb', sort_order }
networks[8]   { network_code, network_name, sort_order }
campaigns[19] { campaign_key, campaign_name, channel_code, network_code, platform_code, market_code, tier_code,
                objective_code 'PAID'|'INSTALL'|'LEAD'|'PIPELINE'|'RETENTION', status_code 'LIVE'|'LEARNING'|'PAUSED'|'ENDED',
                is_brand, start_date, end_date|null, learning_end_date|null, cpa_target_usd|null, sort_order }
pages[8]      { page_key, page_name, page_type 'WEB'|'APP_STORE'|'PLAY_STORE', platform_code, sort_order }
steps[6]      { step_code, step_name, fact_column, is_activation, sort_order }
models[4]     { model_code 'DDA'|'LAST_CLICK'|'FIRST_TOUCH'|'PLATFORM', model_name, lookback_click_days, lookback_view_days, is_default, is_first_party, description, sort_order }
terms[152]    { term_key, campaign_key, term_text, term_type 'KEYWORD'|'PLACEMENT'|'AUDIENCE', match_type|null, sort_order }
targets[43]   { scope_type 'ALL'|'CHANNEL', scope_code, metric_code, target_value, direction 'UP'|'DOWN'|'BAND', sort_order }
finance[3]    { metric_code, valid_from: isoDate, value }
alert_rules[6]{ rule_code, severity 'CRIT'|'WARN'|'INFO'|'OK', title, scope_type 'CAMPAIGN'|'CHANNEL'|'ALL'|'SOURCE', metric_code, condition, sort_order }
sync_log[7]   { source_code, source_name, cadence 'HOURLY'|'DAILY', last_sync_ts: 'YYYY-MM-DDTHH:MM', stale_after_h, red_after_h, status }
budget[456]   [month_ix 0-23, camp_ix, budget_usd]
files: { campaignDay, cohortMonth, retention, journeyDay, trafficPageDay, segmentDay, termDay }: { name, rows, bytes }
```

`FILES` (column specs per file, as `js-exec/lib/data/manifest.ts`) is the single place the loader and the build share; the engine never names a Parquet column outside it.

## 3. Engine rules (`lib/engine/`, framework-free, mirrored from the measures)

Module layout (names final; components render strings and compute nothing): `calendar.ts` (day / week / month indices, LY mapping, window resolution), `data.ts` (typed arrays from the loader; `Dataset` type behind which the file format hides — DEC-001), `selection.ts` (the validated state type; defaults), `scope.ts` (campaign mask from filters ∩ cross-filter ∩ status rule), `metrics.ts` (every metric of §3.6 for a scope × window; the control-total surface), `windows.ts` (presets, comparator windows, movers window, dynamics window, trend buckets), `rules.ts` (verdicts, flags, alerts, creative status — reads `targets` / `alert_rules` only, A-75), `rank.ts` (movers, anomalies, P6 / P7, selected campaign), `cohorts.ts` (R90, churn, LTV, payback curve, retention cells, K1 / K3 month choice), `format.ts` (display rounding, signs, units), `view.ts` (card faces: values, Δ texts, bars, table rows, pop-up series), `copy.ts` (§4), `url-state.ts` (§6).

### 3.1 Window model (`_Win Start` / `_Win End` / `_Win Days`)

- `end` = as-of (2026-11-03) for every preset; Custom: `min(to, as_of)`. A window never passes the as-of day and never starts before `first_day` (Custom `from` is clipped; `from > to` → default window).
- `start`: **7 d** `end − 6` · **30 d (default)** `end − 29` · **MTD** first day of `end`'s month · **QTD** first day of `end`'s quarter · **Custom** `from`. `days = end − start + 1`. AT-03 anchors: 7 d = Oct 28 – Nov 3, MTD = Nov 1 – 3, QTD = Oct 1 – Nov 3.
- Granularity **Day (default) / Week / Month** affects O3 (and the dynamics pop-up never: it is daily by definition). Buckets as `Trend Spend`: one point per bucket at the bucket's first day inside the window; Week bucket = `max(start, week_start)` … `min(end, week_start + 6)` (Monday weeks); Month bucket = `max(start, month_start)` … `min(end, month_end)`. Window totals never change with the granularity (AT-03).

### 3.2 Comparator (`_Cmp`; Filters label **"SAME PERIOD LY"** since round 1, four options)

- **Previous period (default)** `[start − days, start − 1]` · **Same period last year** `[ly(start), ly(end)]` (calendar dates one year back — `dim_date.ly_date`; 2025 / 2026 have no Feb 29) · **Plan** (Spend vs `plan`; paid customers vs `Customers Target` = `PAID_CUSTOMERS_30D × days ÷ 30`; blended CAC / payback / LTV:CAC vs their `param_target`; n/a for New MRR) · **None** (every Δ hidden).
- The comparator drives: every "vs prior" Δ on body cards, O5 / O6's basis window, the period pill text (`vs prior 30 d` · `vs same period LY` · `vs plan` · `no comparison`). It **never** drives: the six vitals (always same dates LY, A-20 as amended), verdict colours, flags, guardrail markers (AT-12).
- Period pill text: `Oct 5 – Nov 3  |  vs prior 30 d` (year appended when `end`'s year ≠ as-of year).

### 3.3 Scope model (A-12, A-13, A-71; PBIP platform limit 21)

- Window filters: Platform (multi), Market, Tier, Channel › Network (tree, multi), Campaign (multi), Status (multi), Attribution model (single). All but the model resolve to **one campaign mask**: a campaign is in scope iff it passes every picked facet. **Status default = Live + Learning applies to the campaign list only** (P1 rows, the Campaigns pane list); **window totals keep every campaign until a status is explicitly picked** (`P1 Row Visible`: `ISFILTERED(status) || status ∈ {LIVE, LEARNING}`). This is what keeps the ALL control totals (+7.0 % spend) true; the paused retention campaign spends in the previous period.
- Cross-filter (one at a time): a C1 row click (channel, or channel | platform on the expanded level) or a P1 row click (campaign). It intersects the mask for **every body card of every view** and is shown as the dashed chip `Selected: <name>`; **the vitals ribbon ignores it** (AT-04). A second click on the same row clears it. An O6 mover click = navigate to `#campaigns` with the campaign as cross-filter (spec A-52; Power BI cannot — accepted difference).
- Selected campaign (P5 target; P6 / P7 scope to its channel): the cross-filtered campaign if exactly one, else the **worst mover of the scope** (minimum `ROAS Delta`, ties by key), else the **top spender** (`_Selected Campaign`). Default window → `SOC_META_LAL2`.
- Scope keys of the control totals map 1:1: `ALL`, `CH:<code>`, `PF:<code>`, `PF:IOS+ANDROID`, `CP:<key>`, `PF:…+CH:…` = the same masks; `CR:` / `TM:` are creative / term rows (§2.4, §7.1).

### 3.4 Attribution switch (A-16, AT-06)

`model` ∈ DDA (default) · LAST_CLICK · FIRST_TOUCH · PLATFORM selects the `paid_*` / `mrr_*` column pair for **paid customers and New MRR only** — and so CAC, CPA, ROAS, payback, LTV:CAC, the funnel's Paid stage, O5 / O6, C5 / C6, the chips' `Attribution:` segment (shown only when ≠ DDA). Sign-ups, activations, trials, cohorts, retention, P6 / P7 **never switch** (cohort facts are DDA). The **first-party model** (`_Model FP`) = the selected model, or DDA when PLATFORM is selected; it feeds `Modelled CPA` and the attribution gap (`paid_platform ÷ paid_fp − 1`, blank unless both > 0). Trial shortfall / loss share use DDA always.

### 3.5 Vitals (ribbon; window filters only; Δ always vs the same dates LY)

| Tile (`dim_card`) | Value | PBI measures | Δ form · direction | Display (`Vital Vn SVG`) |
|---|---|---|---|---|
| V1 **Spend** | Σ spend | `Spend`, `Spend LY` | % · up unfavourable | `$188.4k`, `▲ +32.7%`, `LY $142.0k` |
| V2 **New clients** | Σ signups | `Signups`, `Signups LY` | % · up favourable | `6,980`, `▲ +19.4%`, `LY 5,847` |
| V3 **Conversion into paid** | paid (model) ÷ signups, both in the window (a period rate) | `Signup to Paid`, `Signup to Paid LY` | pt · up favourable | `6.5%`, `▼ −0.5 pt`, `LY 7.0%` |
| V4 **Time to activation** | median hours ÷ 24 (A-47 interpolation over the window's 7 bins) | `Time to Activation Days`, `… LY` (`Act Median Hours`) | d · down favourable | `1.1 d`, `▼ −0.3 d`, `LY 1.4 d` |
| V5 **CAC** | spend ÷ paid (model) — paid CAC, no team cost | `Paid CAC`, `Paid CAC LY` | % · up unfavourable | `$412`, `▲ +19.0%`, `LY $346` |
| V6 **ROAS 90 d** | New MRR × R90 ÷ spend | `ROAS 90d`, `ROAS 90d LY` | × · up favourable | `1.02×`, `▼ −0.14`, `LY 1.16×` |

Arrow `▲` / `▼` / `■` (Δ rounds to 0 at 4 dp → neutral ink-3). Sign glyphs `+` / `−` (U+2212). No target, no verdict dot, no sparkline (ADR-0012 §2.4). Each tile: a **binoculars button before the label** (16 px, the ⓘ's circle) opening that metric's dynamics pop-up (§5.4); the ⓘ at the right.

### 3.6 Metric catalogue (scope × window → value; `metrics.ts` is the control-total surface)

| Metric (CSV code) | Rule | PBI measure |
|---|---|---|
| `spend`, `impressions`, `clicks`, `sessions`, `store_views`, `installs`, `first_opens`, `signups`, `activated`, `trials` | Σ over the masked campaign-days of the window | `Spend` … `Trials` |
| `plan` | Σ over the months overlapping the window of Σ budget (masked campaigns) × overlap days ÷ days_in_month (`_b Plan`) | `Plan` |
| `pacing` | spend ÷ plan | `Pacing` |
| `ctr`, `cpc`, `cpm`, `landed` (= sessions + installs), `click_signup_rate`, `cpl`, `activation_rate`, `cost_per_activated`, `trial_rate`, `trial_to_paid` (paid(model) ÷ trials) | ratios | same names |
| `web_land_rate` = sessions ÷ clicks of **web** campaigns; `store_cvr` = installs ÷ store views; `install_signup_rate` = signups ÷ installs of **mobile** campaigns; `landing_signup_rate` = signups ÷ sessions of web campaigns | platform-filtered ratios (the campaign's platform) | `Web Land Rate`, `Store CVR`, `Install Signup Rate`, `Landing Signup Rate` |
| `paid_customers.<model>`, `new_mrr.<model>`, `cpa.<model>` | Σ column; spend ÷ paid | `Paid Customers`, `New MRR`, `CPA` under the slicer |
| `paid_cac` | = CPA of the selected model | `Paid CAC` |
| `team_cost` | pool = Σ over window days of `PAID_TEAM_COST_MONTH_USD` valid on that day ÷ days in that day's month; × spend(scope) ÷ spend(ALL, same window, **unfiltered** — `_b Spend All`) | `Team Cost` |
| `blended_cac` | (spend + team_cost) ÷ paid | `Blended CAC` |
| `arpa` | New MRR ÷ paid | `ARPA` |
| `payback_months` | blended CAC ÷ (ARPA × GM); GM = latest `GROSS_MARGIN_PCT` valid at as-of | `Payback Months` |
| `churn_monthly` | Σ churned ÷ Σ customers_start over cohort rows with offset ≥ 1 whose **calendar month** (cohort month + offset) ∈ the trailing 3 **complete** months to the window end (`_x Last Complete Month`: the end month counts when `end` is its last day, else the month before) | `Churn Monthly` |
| `ltv`, `ltv_cac` | ARPA × GM ÷ churn (needs churn > 0 and MRR > 0); ÷ blended CAC | `LTV`, `LTV CAC` |
| `r90` | cohort month c = last complete month − 2; over the scope's campaigns with offset-0 revenue > 0 **and** an offset-2 row: Σ revenue(offsets 0–2) ÷ Σ revenue(offset 0); **single-campaign scope with no such row → its channel's R90 → ALL's** (`_x R90`) | `R90` |
| `roas_90d` | New MRR × R90 ÷ spend (blank unless R90 and spend > 0) | `ROAS 90d` |
| `attribution_gap` | paid_platform ÷ paid_fp − 1 | `Attribution Gap` |
| `brand_share` | spend of brand campaigns ÷ spend of PAID_SEARCH campaigns in scope (0 when search spend > 0 and no brand; blank when no search spend) | `Brand Share` |
| `refund_rate` | Σ refund_count (all offsets) ÷ Σ customers_start(offset 0) over cohort months `end_month − 11 … end_month` | `Refund Rate` |
| `retention_cohort_month` (yyyymm), `d7_retention`, `d30_retention` | month = latest cohort month (scope-independent) with `cohort_month_start ≤ end − 44 d` and a D30 cell; value = Σ users_active ÷ Σ users_matured of the scope at N = 7 / 30 | `Retention Cohort Month`, `D7 Retention`, `D30 Retention` |
| `frequency_7d`, `ctr_slope_7d` | only when `days ≥ 14`; frequency = Σ impressions(last 7 days) ÷ Σ reach_7d on the window's **last day**; slope = CTR(last 7) ÷ CTR(7 before) − 1 (needs both impressions and the before-clicks > 0) | `Frequency 7d`, `CTR Slope 7d` |
| `install_quality_delta` | INSTALL campaigns: signups ÷ installs of the window's last 7 days − the same ratio over the **previous period** (both install counts > 0) | `Install Quality Delta` |
| `cpa_target` | campaign: own `cpa_target_usd` (null for LEAD / RETENTION); channel: `param_target` CHANNEL row | `CPA Target` |
| `trial_shortfall`, loss share | trials × previous-period trial → paid of the **same scope** − paid (DDA); share = scope shortfall ÷ ALL shortfall | `Trial Shortfall`, `Loss Share` |
| `step_<step>_pct` | Σ step column ÷ Σ signups | `Step Share` |
| `act_<bin>_share`, `act_median_hours` | bin ÷ Σ 7 bins; median: cumulative shares, first bin ≥ 0.5, linear inside it with edges 0 / 1 / 6 / 24 / 48 / 96 / 168 / 720 h | `Act Share`, `Act Median Hours` |
| `segment.<code>.signups / .activation_rate` | from `segment-day` | `Segment Signups`, `Segment Activation` |
| `page.<key>.sessions / .store_views / .cvr / .bounce_rate / .lcp_ms` | from `traffic-page-day`; cvr = signups ÷ sessions (web) or installs ÷ store views (store); lcp = Σ lcp_x_sessions ÷ Σ sessions | `Page Visits`, `Page CVR`, `Page Bounce Rate`, `Page LCP` |
| Term rows (`TM:`): `impressions`, `clicks`, `spend`, `signups`, `cpc`, `cvr` | from `term-day` | `Term *` |
| Cohort keys (`C-yyyy-mm`): `customers`, `arpa`, `cohort_cac`, `refund_rate`, `payback.m<k>`, `payback_month`, `retention.d<N>` | §3.9 | `Cohort *` |
| `verdict.<metric>`, `flag.<CODE>`, `alert.<RULE>`, `alert_value.<RULE>`, `alerts_tripped`, `roas_delta`, `mover_rank`, `freshness_dot`, `synced_hours_ago`, `source_age_h.<src>`, `story.*` | §3.7, §3.8, §3.10 | — |

Every `*_target` row = the `param_target` value (ALL rows; `cpa_target` at CH / CP).

### 3.7 Verdicts, flags, alerts (`rules.ts`; thresholds from `targets` only)

- **Verdicts** (1 OK · 2 WARN · 3 CRIT; never follow the comparator): UP metric OK ≥ target, WARN ≥ target × (1 − `WARN_BAND_REL`), else CRIT; DOWN mirrored; Spend vs plan OK when |pacing − 1| ≤ `SPEND_PLAN_TOL`, CRIT outside `PACING_LO … PACING_HI`, else WARN. New MRR has none.
- **Flags** (`Flag Codes`, campaign or channel scope, only when spend > 0): exclusive gates first — campaign objective PIPELINE → `PIPELINE_LED`, LEAD → `LEAD_GOAL`, RETENTION → `NO_CPA_GOAL`, status LEARNING → `LEARNING`; a channel is `LEARNING` when every spending campaign in it is learning. Else, in this order, every one that trips: `FATIGUE` (slope < `FATIGUE_SLOPE` and frequency > `FATIGUE_FREQ`) · `FREQUENCY` (> `FREQ_HIGH`) · `INSTALL_QUALITY` (INSTALL campaign, delta < `INSTALL_QUALITY_PT`) · `VIEW_THROUGH` (gap + 1 > `VIEW_THROUGH_RATIO`) · `CPA_OVER` (CPA > target × `CPA_OVER_TOL`, **only when none of the four root-cause flags trips**, target not null) · `OVER_PACING` (> `PACING_HI`) · `UNDERSPENT` (< `PACING_LO`); none → `ON_TARGET`. Words: Fatigue · Frequency · Install quality · View-through heavy · CPA over · Over-pacing · Underspent · On target · Learning · Pipeline-led · Lead goal · No CPA goal. Colour: crit for a root cause or over-pacing, warn for underspent / view-through, good for On target (`Flags Colour`).
- **Alerts** (`Alert Tripped` per rule × entity, evaluated on the window with the filters applied): FATIGUE (campaign; value = slope) · PACING_OVER (channel, pacing > `PACING_HI`; value = spend − plan) · INSTALL_QUALITY (campaign; value = delta) · ATTR_GAP_WIDEN (ALL, gap − previous-period gap ≥ `ATTR_GAP_WIDEN_PT`) · UNDERSPENT_SCALE (channel, pacing < `PACING_LO` and ROAS 90 d ≥ `ROAS_SCALE`; value = plan − spend) · DATA_STALE (freshness dot red; value = hours). Exactly five trip in the default window (AT-10) — a **model test** (they are no longer a card); O5's alert column uses the campaign-scope rules only (FATIGUE, INSTALL_QUALITY), most severe first (CRIT < WARN < INFO < OK, then `sort_order`), evaluated over the **movers window** (§3.8).
- **Creative status** (build-time only, §2.4): Fatigued (fatigue rule) · Watch (slope < 0 and frequency > `WATCH_FREQ`) · Fresh.
- **Pacing colour** (C1 pacing cell): CRIT above `PACING_HI`, WARN below `PACING_LO`, neutral otherwise.

### 3.8 Movers and anomalies (O5, O6) — incl. the 2026-11-05 fallback

- **Movers window** (`_Mv Start`): `basis_start` = `ly(start)` in LY mode, else `start − days`. **If `basis_start < first_day` and `days > 30`, the movers window is the window's last 30 days** (`end − 29 … end`); otherwise it is the window itself. Its basis window follows the same comparator rule from the movers window. Every O5 / O6 number, including the O5 "now" / "before" cells and the alert column, is computed over the movers window, never the full window. Trigger case: Custom Jan 1 2025 – Nov 3 2026 (672 days; previous period 2023–2024, LY only partly covered). Every window ≤ 30 days or whose basis is covered is unchanged.
- **O6 `ROAS Delta`**: per campaign with objective ∈ {PAID, INSTALL, PIPELINE} and spend > 0 in both the movers window and its basis: ROAS 90 d(movers window) − ROAS 90 d(basis). Rank mode **Worst 5** (default, negatives only, most negative first) · **Top 5** (positives only). Bars = |Δ| with the signed label (`−0.41`); good / crit colour by sign. Fewer than five rows when fewer campaigns have the mode's sign. Default window, Worst 5: Lookalike 2% −0.41 · YouTube −0.18 · TikTok −0.09 · Google UAC −0.04 · Meta Interests −0.03. (`mover_rank` control rows keep the pre-round-1 three best / three worst meaning: 1 … 3 / −1 … −3 — the engine exposes both rankings from the same deltas.)
- **O5 `Anomaly Delta`**: per campaign with spend > 0 in both windows: paid(model, movers window) − paid(model, basis). Worst 5 / Top 5 as O6; columns `# | campaign | channel | paid (now) | before | Δ | alert`. Default window, Worst 5: Google UAC · Android growth −9.1 (Install quality) · Meta prospecting · Lookalike 2% −5.9 (Creative fatigue) · YouTube · Product demo −5.7 · LinkedIn · Data teams ABM −0.3 (four rows). Δ shown with one decimal (DDA credits are fractional).
- The two switches are independent, persist across view changes, and reset to Worst 5 on Reset all; URL keys `o5`, `o6` (§6).

### 3.9 Cohorts (`cohorts.ts`; DDA; scope's campaigns; the window only picks months)

- Month indices: `end_month` = month of the window end (`_Cohort End Index`); "complete" as §3.6.
- **Cohort customers** = Σ customers_start at offset 0; **cohort cost** = spend of the acquisition month (actual days) × (1 + team pool of the month ÷ unfiltered spend of the month); **cohort CAC** = cost ÷ customers; **ARPA** = offset-0 revenue ÷ customers; **refund rate** = Σ refund_count (all offsets) ÷ customers; **payback at offset k** = Σ_{offset ≤ k}(revenue − refunds) × GM ÷ cost, only when an offset-k row exists and customers > 0; **payback month** = first k with payback ≥ 1; **retention D-N** = Σ users_active ÷ Σ users_matured at N (blank where no cell — A-74).
- **K1 heatmap** rows = the 12 acquisition months to `end_month` per `_K1 Heat Month` (nerd takes the bound exactly as the dictionary's DAX), columns = offsets 0 … 11; fill: one hue (accent) darker = closer to 1, **green `#1E9E6A` once ≥ 100 %**, white when blank. **K3** rows = the latest six cohort months with any retention cell at or before the window end (`_K3 Last Cohort`, scope-independent), columns D1 D3 D7 D14 D30 D60 D90; fill darker = higher (`K3 Cell Colour` ramp from white toward the accent at 0.6). **K7** = cohort customers of the 12 months to `end_month`. **K2** = LTV:CAC per channel (window formula) + dashed `LTV_CAC` (3.0) line; **K6** = payback months per channel (window formula) + dashed `PAYBACK_MONTHS` (12) line — both in channel colour; the ⓘ says "window formula, not the cohort curve".
- **P6** churned customers per channel (trailing 3 complete months, offsets ≥ 1, DDA), **P7** refunds per channel (12 acquisition months to `end_month`): the five channels with the most, absolute counts, channel colours; scoped to the selected campaign's channel when a campaign is cross-filtered.

### 3.10 Freshness, story annotation, rounding

- Freshness (A-17, AT-15): age_h = (`meta.refreshed` − `last_sync_ts`) in hours per source; dot = 3 red if any age ≥ `red_after_h`, 2 amber if any ≥ `stale_after_h`, else 1 green; header text `Synced n h ago` = floor of the oldest **HOURLY** source's age (`under 1 h` below 1) → `Synced 2 h ago`. The JS adds a per-source tooltip on the dot (the PBI footer was removed in round 1; accepted difference).
- **O3 marker = the fixed story date 2026-10-18** (`Story Step Date`), drawn when inside the window; it is **not** derived from the data (the largest 7-day step of the noisy daily CAC falls on Oct 17 — PBIP limit 20). `story.cac_step_7d` = mean daily CPA Oct 18–24 ÷ mean Oct 11–17 − 1 (test only).
- Rounding **only at display** (A-49, D-30 analogue): engine values are full precision; `format.ts`: `$188.4k` (`#,0.0k` for ≥ 10 k), `$412`, `6,980`, `14.2%`, `+7.0%`, `−1.9 pt`, `10.8 mo`, `3.4×` (`0.00×` on the ROAS vital: `1.02×`), `1.1 d`, `$0.84`, `$13.3` CPM, `0.0` for O5 Δ; counts of paid credits are **integers on card faces** (`#,0`) and one decimal in O5; **minus sign U+2212 everywhere in the JS** *(2026-11-05: Power BI native visuals print ASCII `-` from format strings on O5 Δ and P1 CTR slope, its SVG faces and O6 labels print `−` — accepted platform difference, the parity harness normalises the two glyphs, §7.2)*; `—` for blank / n/a (LEAD / RETENTION CPA and ROAS; store-page bounce / LCP).

### 3.11 Cards per view — what the JS builds (the PBIP as built on 2026-11-05 is the layout reference)

Codes are `dim_card.card_code`. "Dropped" = removed by the USER in redesign round 1 (not built in either flavour).

| View | Card | Content and measures | Visual (PBI as built → JS) |
|---|---|---|---|
| Overview | **O1** Acquisition funnel | 7 stages Impressions · Clicks · Visits + installs (`Landed`) · Sign-ups · Activated · Trials · Paid (model); bar width `log10(value)`, absolute count beside each bar; `Funnel Label` texts (CPM / CTR + CPC / web + installs / click→sign-up + CPL / activation + cost / trial rate / trial→paid + CPA) | SVG horizontal log bars (`O1 Funnel SVG`) → the same SVG, native |
| | **O2** Guardrails | 6 rows: Trial → paid (`Trial to Paid` vs `TRIAL_TO_PAID`) · D7 retention (`D7 Retention` vs `D7_RETENTION`) · D30 (`D30_RETENTION`) · Refund rate (`REFUND_RATE`) · Brand share of search spend (`BRAND_SHARE`) · Attribution gap (`ATTR_GAP`); meter = value against 2 × target, marker at target, value coloured by `Verdict *` | SVG meters → native |
| | **O7** Spend and paid customers by channel | per channel: spend ($k) and paid customers (model), two aligned bar columns in the channel colour | SVG → native |
| | **O5** Anomalies and alerts | §3.8 table + **Worst 5 \| Top 5** switch | table → table |
| | **O6** Top movers by Δ ROAS | §3.8, bars of \|Δ\| with signed labels + **Worst 5 \| Top 5** switch; click → `#campaigns` scoped | column chart → columns (PBI orientation kept) |
| | **O3** Spend vs plan and CAC | per bucket: spend columns, plan as pale columns, paid CAC (`Trend Paid CAC` = CPA per bucket) as a line on a **secondary axis** (USER-accepted deviation, PBIP limit 28), the Oct 18 marker; granularity Day / Week / Month | one combo chart → the same |
| | *O4* Spend share vs New-MRR share | **dropped** | — |
| Channels | **C1** Channel matrix | rows channel › platform (expandable): spend, share (`Spend Share` — **at a channel row the share of the scope's total spend; at a platform row the row's spend ÷ that platform's spend across the scope's channels** — what the PBI `Spend Share` evaluates: Paid social · iOS 50.4 %, Retargeting · iOS 8.4 % *(corrected 2026-11-05 after nerd's build; was "the share within that channel's platform rows"; bip adds the wording to `dim_card` C1 if its formula text does not say so)*), paid customers, **CAC** (`Paid CAC`, no CPA column), ROAS 90 d, click → sign-up, pacing (coloured), flag words; row click = cross-filter | matrix → table with expandable rows |
| | **C2** Web vs app funnel | stages CLICK · LAND · INSTALL · SIGNUP · ACT · TRIAL · PAID; **web** = CTR, sessions ÷ clicks, —, signups ÷ sessions, activation, trial rate, trial → paid; **app (iOS + Android)** = CTR, store views ÷ clicks, installs ÷ store views, signups ÷ installs, activation, trial rate, trial → paid (`C2 Web Rate` / `C2 App Rate`) | clustered columns → the same |
| | **C5** Paid customers by channel, web · **C6** … mobile | per channel (platform WEB / IOS + ANDROID as a fixed filter): paid customers bar, label `count  \|  $CAC` (`Paid Customers CAC Bar`), channel colour; a Scope pick of one platform empties the other card (empty-state line) | columns → columns |
| | *C3* reported vs modelled CPA, *C4* budget pacing | **dropped** (the gap lives in O2 and the flags; pacing in C1 and O3) | — |
| Campaigns | **P1** Campaigns | one row per campaign in scope (Live + Learning unless Status picked): campaign, channel, platform, spend, pacing, CPA (`P1 CPA`, — for LEAD / RETENTION), ROAS (`P1 ROAS`), CTR 7 d Δ (`P1 Slope`), frequency, flags; sorted by spend desc; **a campaign whose P1 measures are all blank in the window is not listed** (the PBI table drops all-blank rows: with every status picked the R30 window shows 16, not 19 — *2026-11-05, main agent on bip's capture*); row click = cross-filter + selection; spans two rows | table → table (scrolls inside the card) |
| | **P5** Keywords / placements | the selected campaign's terms: term, CPC, CVR, Conv. (`P5 CPC`, `P5 CVR`, `P5 Conv`); **the title is the static "Keywords / placements"** (PBIP as built); the Keywords / Placements switch (keywords for search campaigns, placements otherwise) lives only in the `P5 Caption` measure → in the JS it is the table's accessible name, not the title *(corrected 2026-11-05 after nerd's build; was "title says Keywords … Placements otherwise")* | table → table |
| | **P6** Churn by channel · **P7** Refund by channel | §3.9 (`Churned Customers`, `Refunds`, top 5) | columns → columns |
| | *P2* selected campaign trend, *P3* ad sets, *P4* creatives | **dropped** | — |
| Journey | **J1** Landing and store pages | page, visits (`Page Visits` = sessions or store views), CVR, bounce (— on store pages), LCP ms (— on store pages) | table → table |
| | **J2** Onboarding steps, paid traffic | 6 `Step Share` bars in `dim_onboarding_step` order; the largest drop from the previous step in crit (`J2 Largest Drop Step`) | columns → columns |
| | **J3** Sign-up → activation time | 7 `Act Share` bins, the median bin in accent (`J3 Median Bin`) | columns → columns |
| | **J4** Activation rate by platform and OS | 6 segments (`Segment Activation`) vs dashed `ACTIVATION_7D` (40 %); warn colour under the line | columns → columns |
| Cohorts | **K1** Payback by acquisition month | §3.9 heatmap 12 × 12 | matrix heatmap → grid |
| | **K3** Retention grid, paid cohorts | §3.9, 6 × 7 | matrix → grid |
| | **K2** LTV:CAC by channel · **K6** Payback months by channel · **K7** Cohort size by acquisition month | §3.9 | columns → columns |
| | *K4*, *K5* | K4 moved to Campaigns as P6 / P7; K5 **dropped** (K7 keeps the sizes) | — |

Every card: title row (title · ⓘ right), the visual, nothing else — **no question line, no caption, no footer since round 1**; text dividers in this report are `|` (round 1), the `·` inside campaign / segment names comes from the dataset. One **How to read** per view.

## 4. Copy source (`js-marketing/lib/engine/copy.ts`; ADR-0013 (j) sync point 1)

- `copy.ts` is the shared TS source; bip mirrors it back into `dim_card` / the How-to-read text boxes when either side changes. **Numbers never live in `copy.ts`** (the window, model and values in an ⓘ come from the engine).
- nerd seeds it **verbatim** from: (1) `pbi-report/ACME Marketing/ACME Marketing.SemanticModel/definition/tables/dim_card.tmdl` — the `DATATABLE` rows `card_code, card_title, card_question, card_what, card_formula, card_note, sort_order` (29 rows: V1 … V6, O1 O2 O3 O7 O5 O6, C1 C2 C5 C6, P1 P5 P6 P7, J1 J2 J3 J4, K1 K2 K6 K7 K3); `card_question` is kept in the module for the ⓘ ("what") but **not rendered on the face**; (2) the five How-to-read text boxes `pbi-report/ACME Marketing/ACME Marketing.Report/definition/pages/paid_acquisition/visuals/howto_<view>_text/visual.json` (+ `howto_<view>_title`) for `overview | channels | campaigns | journey | cohorts`; (3) the flag words, Δ texts, period-pill and synced texts, chips labels (`Platform: …`, `Market:`, `Tier:`, `Channel:`, `Network:`, `Campaign:` / `n picked`, `Status:`, `Attribution:`, `Selected:`) from the measures `Flags Text`, `Period Pill Text`, `Synced Text`, `Chips Line` in the dictionary — the `CHIPS` block of `copy.ts` defines the segment labels and **the join ` | `** (house rule for this report; *2026-11-05: the PBI `Chips Line` measure joined with `   -   ` and bip is changing it to ` | ` and re-capturing the chip rows*), one segment per active facet in the order Platform · Market · Tier · Channel · Network · Campaign · Status · Attribution · Selected; (4) the Filters window labels from the PBIP (rail entries Period · Scope · Channels · Campaigns · Audience · Attribution; the comparison label **SAME PERIOD LY**; Reset all · Close).
- ⓘ pop-up per card = title · what · formula · note + the engine's "window and model in use" line (`Card Info Note`). Separator inside copy: `|` as the PBIP (parity rule 6's " - " is replaced by " | " in this report family — recorded in the parity-rules draft).
- Deviations from the PBIP strings are deliberate and listed in `js-marketing/README.md › Deviations`, as js-exec does for v5.

## 5. Visual contract

### 5.1 Tokens (from the mockup `:root` and `acme-marketing-theme.json`; `dim_channel.color_light / color_dark` are the channel truth)

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#EEF1F6` | `#0E1117` |
| blooms (two radial gradients, static) | a `rgba(91,108,255,.16)` · b `rgba(40,199,183,.12)` · c `rgba(255,170,90,.08)` | a `rgba(99,114,255,.24)` · b `rgba(40,199,183,.16)` · c `rgba(255,170,90,.08)` |
| glass / strong / top highlight / line | `rgba(255,255,255,.56)` / `.78` / `.85` / `rgba(17,24,39,.09)` | `rgba(255,255,255,.045)` / `rgba(22,26,36,.82)` / `rgba(255,255,255,.14)` / `rgba(255,255,255,.07)` |
| ink / ink-2 / ink-3 / grid | `#111827` / `#4B5563` / `#8A94A6` / `rgba(17,24,39,.08)` | `#F3F4F6` / `#A6AEBD` / `#6B7382` / `rgba(255,255,255,.08)` |
| accent / accent-2 / accent-soft | `#4A57E8` / `#0F9A8E` / `rgba(74,87,232,.12)` | `#8B93FF` / `#3FD4C4` / `rgba(139,147,255,.16)` |
| good / warn / crit | `#1E9E6A` / `#C47A0E` / `#D93B4B` | `#4CCB92` / `#F0A93A` / `#FF6B78` |
| channel 1–6 (search, social, app install, display & video, retargeting, affiliates) | `#4A57E8 #C26A10 #0F9A8E #8E52D9 #6E7A1E #9B2A4E` | `#7F88F5 #C9822A #259E90 #9B7FE0 #86983F #D2688C` |

Channel colours are **bound by channel code, never by position** (a filter that drops a channel does not re-colour the rest). Semantic colours only on deltas, flags, verdicts. Glass = `backdrop-filter: blur(24px) saturate(140%)` + 1 px line + inset highlight, radius 14 px; `@supports not (backdrop-filter)` → solid 92 % white (ADR-0012 §2.5). Fonts: Manrope 600–700 tabular for display numbers, Inter 400–500 for text (self-hosted via `next/font`, no external font host — CSP `font-src 'self'`).

### 5.2 Frame geometry (1440 wide; the PBIP's y positions are the reference)

Top bar 56 px (logo `public/icons/acme-marketing-logo.svg` 28 px at x 16 · **header title "ACME Marketing"** (the PBIR `hdr_brand` as the USER restyled it; "Paid Acquisition Console" is the logo alt and the document `<title>` — *corrected 2026-11-05, PBI as built wins; was title "Paid Acquisition Console"*) · five tabs · period pill · **Filters** button with active-count badge · freshness dot + `Synced n h ago`), chips line 36 px (collapses when empty), vitals ribbon 112 px (six 224 px tiles, 12 px gaps), body = 12-column grid, three rows of **186 px at y 196 / 394 / 592** with 12 px gaps, 14 px gutters; no footer. Tables scroll inside their card. If the USER allows growth beyond 810 px (§10 q A), rows may grow to the content, never the ribbon.

### 5.3 Card anatomy and tile anatomy

- Card: glass panel, title row (title 10 pt semibold ink; ⓘ 16 px circle 1 px ink-3 with an "i" at the right), the visual filling the rest, 12 px inner padding. No question, caption, menu or footnote.
- Vitals tile (224 × 96 inner, from `Vital Vn SVG`): **binoculars 16 px at x 12, y 10** (the glyph of `public/icons/binoculars.svg`, stroke ink-2, inside a 16 px circle like the ⓘ) → label uppercase 10.5 px letter-spacing .06 em ink-3 at x 34, y 22 → value 26 px semibold ink at x 14, baseline 58 → Δ 12 px semibold right-aligned at x 212, baseline 57, coloured good / crit / ink-3 → sub-line `LY <value>` 11 px ink-3 at x 14, baseline 84; ⓘ at the tile's right edge.
- ⓘ pop-up: glass, ≤ 360 px wide, title · what · formula · note · window + model line; opened on click (and shown on hover after 400 ms), closes on Esc / outside / ×.

### 5.4 Single-metric dynamics pop-up (`<metric> | dynamics`, 2026-11-05)

Opened by a tile's binoculars; **one metric per pop-up**, glass window **880 × 560** centred over a 32 % scrim, title `Spend | dynamics` (… `New clients`, `Conversion into paid`, `Time to activation`, `CAC`, `ROAS 90 d`), one line chart 846 × 480: the metric **by day over the window, or its last 30 days when the window is longer than 90 days** (`Dyn <metric>`), the same calendar day last year as a dashed line (`Dyn <metric> LY`), the last day as a marker with its value label (`Dyn <metric> Last`); daily values use the vital's own formula per day (V3 = paid ÷ sign-ups of that day; V4 = that day's median; V6 = that day's MRR × R90 ÷ spend). × , Esc, click outside or a view tab closes it. URL key `dyn` (§6). Granularity plays no part.

### 5.5 Filters window (A-57 with the JS resolutions of the PBI limits)

- Glass window **880 × 560** over the scrim; opened by the Filters button (lands on **Scope**) and by the period pill (lands on **Period**); closes on **Close**, ×, Esc, click outside, a second click on the Filters button; `F` opens it (not while typing in an input).
- Left rail 200 px, **six** entries (Saved views removed): Period · Scope · Channels · Campaigns · Audience · Attribution, each with an active-count dot. Main area = the group's controls: Period = preset tiles 7 d · 30 d · MTD · QTD · Custom + From / To date inputs (enabled on Custom, clipped to the data range) + comparison tiles under the label **SAME PERIOD LY** (Previous period · Same period last year · Plan · None) + granularity tiles; Scope = platform tiles (multi) + tier tiles; Channels = channel › network tree with tri-state parents; Campaigns = status tiles (Live · Learning · Paused · Ended; default Live + Learning) + searchable multi-select list (shows the campaigns of the current status pick, 16 by default); Audience = market dropdown; Attribution = model tiles.
- Right rail 220 px = **live preview** of the pending selection: spend · paid customers · CAC for the window under the pending filters (spec rule 1; JS only) + `n campaigns | m channels | k platforms` + the pending chips.
- Footer: **Reset group · Reset all · Apply**. Picks are pending until Apply (Enter applies; Esc discards); Reset all returns to 30 d · Previous period · all · Live + Learning · DDA · Day and clears the cross-filter and both switches.
- Chips line (after Apply): one removable chip per active non-default facet (× removes just that facet and re-applies), the cross-filter chip dashed in accent; a `Clear` link at the end.

### 5.6 Other interactions

Worst 5 | Top 5 = two-tile segmented switches in the O5 / O6 title rows. View tabs = hash routes (§6); the active tab in accent-soft. Tables: sticky header, header click sorts (client only; default sort as the PBIP). Hover on any bar / point shows a tooltip with the exact engine value. Keyboard: tabs ← →, tiles arrows, Esc everywhere.

**As built 2026-11-05 (nerd; reduced versions of the interactions above — the USER may ask for the full version; each is recorded in `js-marketing/README.md › Deviations`):** ⓘ opens on click / Enter only (no 400 ms hover open, §5.3); no header-click sort on P1 / J1 / C1 (accepted difference 13 of §7.3 not built — both flavours sort as the PBIP); bar / point tooltips are native `<title>` hovers with the exact engine value, not styled pop-overs; the K1 / K3 heat ramps use the PBIP formula (white → accent, green at ≥ 100 % on K1) in dark mode too, i.e. no dark-specific ramp.

## 6. URL state and hash routing (A-62; validated with Zod at the boundary, F-37 analogue)

- View in the hash: `#overview` (default, omitted) · `#channels` · `#campaigns` · `#journey` · `#cohorts`.
- Query keys (defaults omitted; canonical rewrite as js-exec `url-state.ts`; unknown keys ignored; invalid value → that key's default, never a broken page; `max(256)` per value):

| Key | Values | Default |
|---|---|---|
| `p` | `7d` · `30d` · `mtd` · `qtd` · `custom` | `30d` |
| `from`, `to` | ISO dates, only read with `p=custom`; clipped to `first_day … as_of`; `from > to` → default window | — |
| `c` | `prev` · `ly` · `plan` · `none` | `prev` |
| `g` | `day` · `week` · `month` | `day` |
| `pf` | comma list of `web,ios,android` (sort_order, deduplicated; all three = absent) | all |
| `mk` | `global` · `na` · `emea` | all |
| `tr` | `self_serve` · `sales_assisted` | all |
| `ch`, `nw` | comma lists of channel / network codes (lower case in the URL, mapped to the codes) | all |
| `cp` | comma list of campaign keys | all |
| `st` | comma list of `live,learning,paused,ended`; **absent = the list default (Live + Learning), totals unfiltered** | absent |
| `m` | `dda` · `lc` · `ft` · `pf` | `dda` |
| `sel` | cross-filter: `ch:<code>`, `ch:<code>|pf:<code>`, `cp:<key>` | none |
| `o5`, `o6` | `worst` · `top` | `worst` |
| `dyn` | `v1` … `v6` (dynamics pop-up open) | closed |
| `theme` | `light` · `dark` | system |

Everything the engine receives comes through `parseSelection(URLSearchParams, manifest)`; components never read `location`. A Copy-link button on the header (Track C precedent) writes the canonical URL.

## 7. Parity

### 7.1 Engine tests (Vitest; AT-01)

- `lib/engine/control-totals.test.ts` reproduces **every row** of `data/acme_marketing_dummy_data/checks/control_totals_usd.csv` (28,660; from `fixtures/checks/` in the pack) with verify.py's tolerances (amounts 0.005, ratios 1e-6, counts and codes exact), **both ways**: every CSV row has an engine value, and the engine returns n/a where the CSV has no row (e.g. `frequency_7d` under 14 days, CPA of LEAD / RETENTION campaigns). Period keys: `R30-` / `R7-` / `MTD-` / `QTD-` (end date → preset + end; `R30-2026-10-04` and `R30-2025-11-03` are Custom windows of 30 days), `M-yyyy-mm` (Custom = the calendar month), `D-yyyy-mm-dd` (Custom one day), `C-yyyy-mm` (cohort keys → §3.9 per acquisition month). Scopes per §3.3. The `CR:` rows are excluded here (build-time, §2.4) and the test asserts that exclusion is exactly the 32 creative rows.
- Minimum coverage = what the DAX tests assert (29 blocks T-K1 … T-K12 cover every CSV row), so the JS suite covers the same set; in addition: AT-03 (preset dates), AT-04 (precedence + status rule, iOS + Android spend $72.4k, 16 default rows), AT-06 (model switch changes only the listed metrics; `m=pf` gap uses DDA), AT-08 (step +20 % ± 1 pt, 16.5 % / 9.8 %), AT-10 (five alerts; O6 default list), AT-12 (comparator changes no verdict), AT-13 / AT-14 / AT-15 (fixtures for amber / red), AT-22, the `_Mv Start` cases (R30 unchanged; Custom from 2025-01-01 → last 30 days in both PREV and LY modes; a 31-day Custom window starting 2025-01-01 → fallback; a 30-day one → none), the dynamics window (30 d → 30 points; 672 d → the last 30), URL round-trips (parse → serialize → parse idempotent; retired / unknown keys dropped).
- Performance test: the default Overview recompute < 100 ms in Node on the shipped files (A-83 proxy).

### 7.2 Parity selections (hunter; both flavours; 0 `gap` rows = the gate)

File `js-marketing/lib/test-utils/parity/parity_selections_marketing.csv` (the Nordmark / Mirelo pattern; run by `parity.test.ts` in the JS, the same rows as a DAX block in `pbi-report/ACME Marketing/tests/`). Columns: `sel_id, view, preset, from, to, comparator, granularity, platforms, market, tier, channels, networks, campaigns, statuses, model, cross, o5_mode, o6_mode, element, kind, expected, tol, c_status, b_status, source` — `element` = the card + slot (`V1.value`, `V1.delta`, `V1.ly`, `O5.row1.campaign`, `O6.row1.delta`, `C1.PAID_SOCIAL.cac`, `chips`, `pill`, `P1.rows`, `K1.2025-11.m9`, `DYN.v1.points`, `DYN.v1.last_label` …), `kind` = `text | number | count | list`, `expected` as displayed text for `text`, engine value for `number`.

Selections (≈ 14; every one also names its control-total rows where they exist):

| sel_id | Selection | Elements |
|---|---|---|
| PA-01 | Overview, defaults | six vital faces (value, Δ, LY text), O1 seven labels, O2 six rows, chips empty, pill `Oct 5 – Nov 3  \|  vs prior 30 d`, `Synced 2 h ago` |
| PA-02 | Overview, defaults, O5 / O6 Worst 5 | O5 four rows (campaign, Δ, alert), O6 five rows (campaign, Δ text) |
| PA-03 | Overview, defaults, O5 / O6 **Top 5** | both lists |
| PA-04 | **Custom 2025-01-01 – 2026-11-03, Month, Previous period** (the USER's saved state that exposed the movers bug) | O5 / O6 lists (= the last-30-day comparison), O3 bucket count (23), vitals |
| PA-05 | Same range, comparator **LY** | O5 / O6 lists (LY basis of the last 30 days), pill text |
| PA-06 | Channels, Platform iOS + Android | C1 rows (3 channels, expanded platforms), vitals (spend $72.4k), chips `Platform: iOS + Android` |
| PA-07 | Channels, cross-filter Paid social | chips `Selected: Paid social`, C2 / C5 / C6 values, vitals **equal PA-01** |
| PA-08 | Campaigns, defaults | P1 16 rows in order (spend, pacing, CPA, ROAS, slope, frequency, flags), P5 title "Placements" + LAL2 rows, P6 / P7 lists; C1 platform-row shares (within the channel) at PA-06 |
| PA-09 | Campaigns, Status Paused + Ended + Live + Learning | P1 **16 rows** *(amended 2026-11-05, main agent on bip's PBI capture; was 19)*: the three campaigns with every P1 measure blank in the R30 window (`RT_META_RETENTION`, `SOC_META_LAL1`, `SRCH_SUMMER_PROMO`) are **not listed** — the table drops all-blank rows (rule in §3.11 P1); a window covering **Jun – Aug 2026** with every status picked lists **19** (`RT_META_RETENTION` shows `—` CPA / ROAS; AT-22) — *corrected 2026-11-05 after hunter's run: the LY window lists 16 too, because `SRCH_SUMMER_PROMO` ran 2026-06-01 … 2026-08-31 only; was "e.g. the LY window"* |
| PA-10 | Overview, **7 d**, comparator **Plan** | vitals unchanged in form (still LY), O3 Δ vs plan, P1 flags (no Fatigue / Frequency under 14 days) |
| PA-11 | Overview, MTD, comparator LY, model **Last click** | vitals V3 / V5 / V6 values, chips `Attribution: Last click`, O2 gap row (FP = LAST_CLICK) |
| PA-12 | Journey, defaults | J1 eight rows, J2 six shares + highlight, J3 median bin + shares, J4 six rates |
| PA-13 | Cohorts, Campaign `SOC_META_LAL2` (Filters › Campaigns) | K1 cells 2025-11 … 2026-01 at m9 (green), K2 / K6 / K7 values, chips `Campaign: Meta prospecting · Lookalike 2%` |
| PA-14a / PA-14b | Dynamics pop-up **Spend** at defaults (14a) and at the PA-04 state (14b) *(split 2026-11-05: `sel_id` + `element` must be unique per row)* | point count (30 / 30), last-point label `$…`, LY series present |

| PA-15 *(added 2026-11-05, multi-chip stress selection; hunter testing now, bip captures later)* | Overview, Platform **iOS**, Status **Live**, Attribution **Last click**, cross-filter **Paid social** (C1 platform row iOS) | chips text exactly `Platform: iOS \| Status: Live \| Attribution: Last click \| Selected: Paid social \| iOS` (`kind = text`); badge count 3; vitals under Platform iOS + Status Live (the explicit status pick filters the totals, §10 q F), cross-filter not applied to the vitals |

**Gate result (hunter, 2026-11-05, `js-marketing/lib/engine/parity.test.ts`):** 1,416 rows (PA-01 … PA-14b) — 1,396 match, 20 accepted (difference 14, minus glyph), **0 gap**; suite 83 tests. Four extra capture rows are proposed by bip in `js-marketing/lib/test-utils/parity/parity-notes.md` for a later capture: LY-blank vitals, K7 non-blank months, PA-15 multi-chip, the 31-day edge of §10 q H.

*Amended 2026-11-05 (bip's PBI-side capture):* the Power BI expected values live in `pbi-report/ACME Marketing/tests/parity-selections.dax` (15 blocks, one per selection incl. 14a / 14b) and `pbi-report/ACME Marketing/tests/parity-expected.csv` (1,416 rows, the columns above; card + field combined in `element`, e.g. `V1.delta`, `O5.row1.alert`). hunter's `parity_selections_marketing.csv` takes its `expected` / `b_status` from that CSV and asserts the JS engine against it; a difference is a `gap` row unless listed in §7.3. **Text normalisation before comparing:** the harness maps ASCII `-` and U+2212 `−` to one glyph (Power BI native visuals print `-` from format strings — O5 Δ, P1 CTR slope — while its SVG faces and O6 labels print `−`; the JS prints `−` everywhere, §3.10) and collapses runs of spaces around the ` | ` separator.

### 7.3 Accepted differences and shared readings (draft rows for `docs/design/parity-rules.md › Accepted platform differences › ACME Marketing`)

**Shared readings (identical in both flavours; the PBIP as built wins):** vitals Δ always vs the same dates LY, no target / dot / sparkline; status default on the campaign list only; attribution switch reaches paid customers and New MRR only; cohorts, P6 / P7 and the shortfall are DDA; O3 = one combo chart with a secondary axis (USER 2026-11-04); O5 = campaigns by Δ paid customers + alert column, O6 = Δ ROAS, both Worst 5 | Top 5 with the **last-30-days movers window** when the basis precedes the data; the fixed Oct 18 annotation; column (not horizontal) charts for O6, C2, C5 / C6, P6 / P7, J2–J4, K2, K6, K7; the log10 funnel; J4 by platform segment; no creatives / ad-set / pipeline card; saved views removed; `|` as the text divider in this report (replaces parity rule 6's " - "); Filters button lands on Scope, the period pill on Period; six rail entries; "SAME PERIOD LY" label; one How to read per view; copy from `dim_card` = `copy.ts`.

**Accepted differences (JS builds the spec's version):** (1) Filters apply on **Apply** with a live preview and Reset group — Power BI applies each pick at once and shows the applied state; (2) `F` / Esc / click outside / × close — Power BI: Close, × and the button's second click; (3) removable chips + dashed cross-filter chip — Power BI: a text line, Reset all; (4) light + dark — light only; (5) 1440 wide, height may grow (pending q A) — fixed 1440 × 810 FitToPage; (6) backdrop blur glass — white 90 % + edge + shadow; (7) Manrope / Inter — Segoe UI; (8) an O6 mover click opens Campaigns scoped to it — Power BI cross-filters in place; (9) hash routing + URL state + Copy link — bookmarks only; (10) freshness per-source tooltip on the dot — none; (11) keyboard shortcuts and focus trap — none; (12) hover tooltips with exact values on SVG cards (O1, O2, O7) — none on image measures; (13) table header sort on P1 / J1 / C1 — Power BI native sort only where the visual allows.

## 8. Build order (verification per step; sync points with bip)

| # | Step (owner) | Verify |
|---|---|---|
| 0 | Scaffold (nerd, **done 2026-11-05**): toolchain pins, source-manifest schema, check-only build script, loader, icons | `typecheck`, `lint`, `test`, `build` green on the empty app |
| 1 | `scripts/build-marketing-data.ts` → `public/data/` per §2 (+ the shipped `manifest.ts` schema, `FILES`) | the §2.4 checks pass; printed sizes inside §2.3; `manifest.test.ts` strict-parses the output |
| 2 | Engine core: `calendar`, `data`, `scope`, `windows`, `metrics`, `rules`, `rank`, `cohorts`, `format` | `control-totals.test.ts` 28,628 / 28,628 engine rows (28,660 − 32 `CR:`), both ways; the AT list of §7.1 |
| 3 | `copy.ts` seeded from `dim_card.tmdl` + the five How-to-read text boxes (nerd); **sync point 1:** bip confirms the extraction is verbatim (diff) and from here on changes go to `copy.ts` first | `copy.test.ts`: 29 cards, 5 How-to-reads; **no digits in flag words and chip labels** *(narrowed 2026-11-05: the verbatim `dim_card` notes carry A-nn IDs and the How-to-read texts carry story numbers, so the earlier "no digits in copy strings except the story date" rule cannot hold for verbatim copy)* |
| 4 | Views: frame, vitals, Overview → Channels → Campaigns → Journey → Cohorts (`view.ts` + components) against the PBIP layout; **sync point 2:** measure / metric names of §3.6 are the names in both flavours — neither side invents one | `next build` green; render check of each view at 1440 × 810 against the PBIP (screenshots in the hand-back); every card has an ⓘ |
| 5 | Pop-ups and Filters: ⓘ, How to read, dynamics (6), Filters window with Apply / preview / chips, Worst / Top switches | layer tests (focus, Esc, outside click), AT-16 steps, the dynamics-window cases |
| 6 | URL state + hash routing (`url-state.ts`), Copy link | round-trip tests; deep links `#campaigns?sel=cp:SOC_META_LAL2`, PA-04's URL |
| 7 | Parity (hunter): `parity_selections_marketing.csv` captured in both flavours; bip runs the same rows as a DAX block | 0 `gap` rows; the §7.3 rows confirmed or amended in `parity-rules.md` |
| 8 | Pack (nerd + bip; §9) | pack builds from a clean clone: `npm ci && npm run typecheck && npm run lint && npm test && npm run build` |

Step 2 may start before step 1 is final on the source Parquet through a temporary Node reader, but the control-total suite is only green on the shipped files. Steps 4–6 are the USER's first-open round for the JS flavour; expect a redesign pass as on 2026-11-04 and keep the engine untouched by it (faces live in `view.ts`).

## 9. Pack (`.sync/acme-marketing/js-app/`; ADR-0014, ADR-0015 (h) amended)

- Contents = the `js-marketing/` tree **without** `node_modules/`, `.next/`, `tsconfig.tsbuildinfo`, `.env*`; **with** `public/data/` prebuilt (ADR-0014 items 2 / 10: JS packs ship their small prebuilt data and build without this repo's `data/`; here ≈ 2.1 MB, of which `term-day.parquet` ≈ 0.9 MB) and `fixtures/checks/control_totals_usd.csv` (the tests need it; `lib/test-utils/marketing-data.ts` reads the repo `data/` first, the fixture second, as js-exec). The pack copy drops `prebuild` from `package.json` (no `../data/` there) and its README carries the `.sync` header, the gate, the runtime hooks (`EMBED_ALLOWED_ORIGINS`, `NEXT_PUBLIC_SITE_URL`; names only), the 1440 × 810 embed note with the height rule, the URL keys, the deviations list, and "source of truth = `js-marketing/` in rusloc/pnl; a pack is a copy". *The brief of 2026-11-05 said "without `public/data`"; ADR-0014 says with — this contract follows the ADR; flagged in §10 q C.*
- Hand-off note `.sync/2026-11-04-acme-marketing-handoff.md`: a dated status line (added 2026-11-05) says the JS flavour is built in rusloc/pnl; at pack time its "What is in `.sync/`" table gains the `acme-marketing/js-app/` row, the "no `js-app/` yet — building it is the task" sentence is struck, the "Platform differences to expect" section points to the parity-rules section, and the status section records the parity result; status draft → ready.
- `.sync/README.md` › Report packs: new row `acme-marketing/js-app/` — from rusloc/pnl (nerd) → vosk.dev repo agent — status — "ACME Marketing standalone Next.js app (five views, Filters window, dynamics pop-ups, URL state), 1440 × 810, prebuilt data ≈ 2.1 MB + control-totals fixture; N tests, build green; parity 0 gaps (hunter yyyy-mm-dd)".
- Issued after step 7 (parity), never before; the Power BI pack is re-issued at the same time if bip changed copy during the sync points.

## 10. Assumptions and open USER questions

Assumptions taken (overturn any of them by a one-line ruling): A1 the PBIP as built on 2026-11-05 (after round 1 and the 11-05 changes) is the layout and copy reference, not the spec's original view table; A2 column charts stay columns (PBI orientation) rather than the spec's horizontal bars, so the two flavours read alike; A3 the Filters window keeps the spec's Apply semantics in the JS (A-57 says so) even though Power BI applies on change; A4 creatives / ad sets / pipeline do not ship; A5 the `mover_rank` control rows (three best / three worst) stay satisfied by the engine while the cards show five.

| # | Question | Default until answered |
|---|---|---|
| A | May the JS board exceed **810 px** tall at 1440 wide (ADR-0015 risk 4: P1 over two rows and the K1 / K3 grids are tight)? | Yes, up to content height; the host iframe takes the taller size (Mirelo precedent); the ribbon and header never grow |
| B | **Dark theme now** or after the first-open round? | Tokens and `theme` key now; the per-chart dark check in the first-open round |
| C | Pack **with prebuilt `public/data/`** (ADR-0014 items 2 / 10) or without it (the 2026-11-05 brief)? | With (the receiving repo has no `data/`) |
| D | Restore a **creatives card** (P4) in the JS flavour (the spec's fatigue unit; the data supports it)? If yes, `creative-day.parquet` (last 14 days of every window end → full daily, ≈ 83 k rows ≈ 0.9 MB lazy) and the `CR:` rows move from the build to the engine | No — both flavours stay without it (round 1) |
| E | O6 mover click: **navigate to Campaigns** scoped to the campaign (spec A-52; JS can) or cross-filter in place as Power BI (identical behaviour)? | Navigate |
| F | Status facet in the URL (`st`) when the user explicitly picks Live + Learning: write the key (totals then filtered) or treat it as the default (absent)? | Write it: an explicit pick filters the totals, as in Power BI |
| G *(flag only, 2026-11-05)* | Period pill under Custom: the PBI text omits the start year (`Jan 1 – Nov 3  \|  vs prior 672 d`) while O5 / O6 then compare the last 30 days. Keep the pill as built (both flavours identical) or append the start year and a `· movers: last 30 d` hint? | As built — no change until the USER rules |
| H *(added 2026-11-05 after the parity run)* | A **Custom window of 31 days starting on the first data day** (2025-01-01 – 2025-01-31) triggers the `_Mv Start` fallback (comparison basis before the data, window > 30 d), but the fallback basis `[end − 59, end − 30]` then holds a single data day (2025-01-01), so O5 / O6 compare 30 days with 1 day. Both flavours share the rule. Keep as built, or blank the movers when the fallback basis is shorter than the movers window? | As built — an edge of the synthetic span, not reachable from any preset; the alternative is one guard in `_Mv Start` / `windows.ts` plus a re-capture |

## 11. The three riskiest rules to mirror

1. **The movers window (`_Mv Start`) and its basis** — the fallback changes which days every O5 / O6 number, the "before" cell and the alert column read, and it keys on `first_day` and `days > 30`; one off-by-one or applying it to the full window reproduces the blank cards the USER saw, or shifts the lists silently. Tests: PA-04 / PA-05 and the four `_Mv Start` cases.
2. **R90 and the cohort-month choices** — R90's cohort is `last complete month − 2` with the own → channel → ALL fallback for single-campaign scopes; churn uses calendar months (cohort + offset) in the trailing three complete months; the D7 / D30 month is scope-independent (`end − 44 d`); refund rate uses twelve acquisition months. Four different month rules feed one guardrail panel and one vital (V6); each is cheap to get subtly wrong and only the control totals catch it.
3. **Scope semantics around status and team cost** — the status default filters the list but not the totals, the cross-filter scopes every body card but never the vitals, and the team-cost allocation divides by the **unfiltered** ALL spend of the same window. Getting any of the three wrong moves the ALL anchors (+7.0 % spend, $531 blended CAC) or makes the vitals move on a click.
