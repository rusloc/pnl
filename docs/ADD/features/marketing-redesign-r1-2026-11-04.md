# ACME Marketing (Power BI) — redesign round 1: four proposals

> **DRAFT, projection state. Proposals only, nothing built.** For USER approval before implementation.
> From: bip · 2026-11-04 · scope: `pbi-report/ACME Marketing/` (ADR-0015, `docs/Requirements-marketing.md`, data contract `data/acme_marketing_dummy_data/README.md`).
> House rules applied: visual first, minimum text, no sparklines in tiles (ADR-0012 §2.4), absolute numbers first, one message per visual.
> The numbers below come from `checks/control_totals_usd.csv`. The default window is R30 Oct 5 – Nov 3 2026, ALL, DDA. LY is the same dates in 2025 (`R30-2025-11-03`). They are not from a DAX run.
> **Rec** marks the recommended option. `new:` marks a measure that does not exist yet (house DAX style at build time).

---

## 1. Overview — replaces O4 "Spend share vs new-MRR share" (top row, third of three)

| # | Option | Shows | Measures | Visual | Read |
|---|---|---|---|---|---|
| **1A Rec** | **CAC by channel vs target** | Cost of one paid customer per channel, with the channel's target | `Paid CAC` (= spend ÷ paid customers; same formula as `CPA`), `CPA Target`, `Channel Colour` | Column chart, one bar per channel in its channel colour. The target is drawn as markers only (combo with no secondary axis, line width 0) | One number per channel against one mark, and the verdict needs no arithmetic. Default: 3 of 6 channels over target (paid social $572 vs $420, display $603 vs $550, app $403 vs $380). Search $326 / $340, retargeting $247 / $260, affiliates $347 / $350. Same formula as the new CAC vital (§2) |
| 1B | Spend and paid customers by channel | Where the money goes and where the customers come from, on aligned rows | `Spend`, `Paid Customers`, `Channel Colour` | SVG image measure, two aligned horizontal bar columns ($k · count). Reuses the `O4 Shares SVG` pattern with absolute values | Absolute numbers, but the reader has to divide in their head. Two scales in one card |
| 1C | New MRR by channel | Where the new monthly revenue comes from | `New MRR`, `Channel Colour` | Column chart | Simple, but gives no verdict: New MRR has no plan (A-11), and the bars mostly follow spend size |
| 1D | Pacing by channel vs plan | Spend ÷ plan per channel, 100 % line | `Pacing`, `Pacing Colour` | Column chart + dashed 100 % | Repeats C4 (Channels) and O3. Not recommended |

## 2. Overview — vitals row

Every Δ is vs **Same period LY** (`param_comparator` LY). The tile face is: label · value · Δ (arrow + direction colour, A-23) · one plain sub-line `LY <value>`. There is no target sub-line, no verdict dot and no sparkline.

| Candidate | Formula in words | Value · LY · Δ (default window) | Measures |
|---|---|---|---|
| **Spend** | Σ ad spend in the window | $188.4k · $142.0k · **+32.7 %** | `Spend`, `Spend LY`, `Spend Δ` |
| **Spend vs plan** | Spend ÷ plan (plan = Σ budget ÷ days in month, per day) | 107 % · 100 % · **+6.8 pt** | `Pacing`; new: `Plan Prev`, `Plan LY`, `Plan Cmp` (same windows as `Spend Prev` / `Spend LY`), `Pacing Cmp` = DIVIDE ( [Spend Cmp], [Plan Cmp] ), `Pacing Δ` = [Pacing] − [Pacing Cmp] |
| **Paid customers** | Σ paid-customer credits, selected model | 457 · 410 · **+11.5 %** | `Paid Customers`, `Paid Customers LY`, `Paid Customers Δ` |
| **CAC** | Spend ÷ paid customers (ad spend only, no team cost) | $412 · $346 · **+19.0 %** | `Paid CAC`, `Paid CAC LY`, `Paid CAC Cmp`; new: `Paid CAC Δ` = DIVIDE ( [Paid CAC] − [Paid CAC Cmp], [Paid CAC Cmp] ) |
| **New MRR** | Σ first-month recurring revenue of the new customers, selected model | $61.9k · $52.6k · **+17.6 %** | `New MRR`, `New MRR LY`, `New MRR Δ` |
| **ROAS (90 d)** | New MRR × R90 ÷ spend. R90 = revenue of the first 3 months ÷ revenue of month 1 (latest complete cohort) | 1.02× · 1.16× · **−0.14** | `ROAS 90d`, `ROAS 90d LY`, `ROAS 90d Cmp`; new: `ROAS 90d Δ` = [ROAS 90d] − [ROAS 90d Cmp] |
| Trial → paid % | Paid customers ÷ trials | 14.2 % · 14.9 % · −0.7 pt | `Trial to Paid`, `Trial to Paid LY`, `Trial to Paid Δ` |
| Cost per trial | Spend ÷ trials | $58.5 · $51.6 · +13.4 % | new: `Cost per Trial` = DIVIDE ( [Spend], [Trials] ), `Trials LY`, `Trials Cmp`, `Cost per Trial Cmp`, `Cost per Trial Δ` |

**ROAS: what the data supports.** `new_mrr_usd` is the new customers' first-month recurring revenue (data README), so all three versions can be computed:

- First-month ROAS = New MRR ÷ spend = **0.33×**. Plain, but it reads as a loss.
- New MRR × 12 ÷ spend = **3.94×**. It ignores churn (2.72 %/month), so it overstates.
- ROAS 90 d = **1.02×**. Already built and tested.

**Rec: ROAS 90 d.** C1, the O6 movers and the alerts already use it. A second ROAS definition on the same page would contradict them.

**Rec — 6 tiles: Spend · Spend vs plan · Paid customers · CAC · New MRR · ROAS (90 d).**

- Two tiles for spend (amount and control), two for effect (customers and revenue), two for efficiency (cost and return).
- Trial → paid stays in O2 Guardrails and the O1 caption, so it is not repeated in the row.

**5-tile variant: Spend · Paid customers · CAC · New MRR · ROAS (90 d).** It drops Spend vs plan, which the O3 "Spend vs plan and CAC" combo carries on the same view.

**Spec impact (main agent):**

- A-20 / A-21 change. Blended CAC $531, CAC payback 10.8 mo and LTV:CAC 3.4× leave the ribbon. Payback and LTV:CAC remain on Cohorts (K1 heatmap, K2).
- The AT-02 vital anchors change, so `tests/control-totals.dax` gets LY blocks for the six tiles.
- `Paid CAC` has no ALL target in `param_target`, so the CAC tile has no verdict (none is shown anyway).

## 3. Channels — two visuals under "Web vs app funnel" (right half: web | mobile)

The platform mix comes from `dim_campaign.platform_code`: each campaign runs on one platform.

- **Web:** 5 channels (search, social = LinkedIn ABM + webinar, display, retargeting = Trial abandon, affiliates).
- **Mobile (iOS + Android):** 3 channels (paid social = Meta LAL2 / Interests / TikTok, app install = ASA / UAC, retargeting = App re-engage + the paused retention campaign).

The split is applied with a visual-level filter on `dim_platform[platform_code]` (WEB · IOS + ANDROID). That is the same split the `C2 Web Rate` / `C2 App Rate` measures use, and it needs no new measure. Fallback: KEEPFILTERS measures like `_b Web Clicks`.

| # | Option | Shows | Measures | Visual | Read |
|---|---|---|---|---|---|
| **3A Rec** | **Paid customers by channel, CAC as label** (one per platform) | How many customers each channel brings on web / mobile, and their price | `Paid Customers` (bar), `Paid CAC` (detail label), `Channel Colour` | Column chart per platform. Data label = count, detail label = `$CAC` (`labels.enableDetailDataLabel` / `dynamicLabelDetail` exist on clusteredColumnChart in the report-author catalog) | Absolute count first, cost beside it, one channel axis. Not a repeat of 1A (all-platform cost verdict) or of C1 (numbers in a matrix). Default: web search 188 at $326 · mobile paid social 81 at $500, app install 71 at $403. Web paid social is ~31 at ~$760 (derived: channel − mobile) |
| 3B | CAC by channel vs target (one per platform) | Per platform, cost per customer vs the channel target | `Paid CAC`, `CPA Target`, `Channel Colour` | As 1A, split by platform | Clear verdict, but it repeats 1A's form and message one tab later. Take it if the USER rejects 1A |
| 3C | Trial → paid by channel vs 16 % (one per platform) | The conversion step where the story breaks | `Trial to Paid`, new: `Trial to Paid Target` = [_T TRIAL_TO_PAID], `Channel Colour` | Column + dashed target | Shows the story (mobile paid social 16.5 % → 9.8 %), but as a rate, not an absolute. The install → sign-up → paid version is not symmetric (web has no installs) and needs 3 series × 5 channels: rejected |

**Missing in the model:**

- No per-platform paid-customer or CAC measure (Web / Mobile versions exist only for clicks and sign-ups). With the visual filter none is needed.
- No per-platform CPA target: the channel target applies to both platforms.
- `dim_platform_segment` reaches only `fact_signup_segment_day` (sign-ups, activation). There is no spend, paid customers or CAC by segment, so segments cannot carry this pair.
- A Filters › Scope pick of one platform empties the other chart, which then needs an empty-state caption.

## 4. Cohorts — two visuals under K2 "LTV:CAC by channel" (right third)

Excluded:

- The left two-thirds: payback by acquisition month (heatmap) and the retention grid.
- The Campaigns bottom row: churn by channel and refund by channel, top 5 each.

| # | Option | Shows | Measures | Visual | Read |
|---|---|---|---|---|---|
| **4A Rec** | **Payback months by channel vs 12** | Months for each channel's customers to repay their CAC | `Payback Months` (blended CAC ÷ (ARPA × GM), window basis like K2), new: `Payback Target` = [_T PAYBACK_MONTHS] (pattern of `K2 Target`), `Channel Colour` | Column chart in channel colours + dashed 12 | Absolute months, one target, wide spread. Default: retargeting 5.8 · search 8.4 · affiliates 9.0 · app 11.2 · paid social 14.9 · display 17.7, so 2 channels miss the year. Different cut from the heatmap (channel vs month). The ⓘ must say it is the window formula, not the cohort curve |
| **4B Rec** | **Cohort size by acquisition month** | New paid customers per acquisition month, last 12 | `K5 Customers` (gated by `_K12 Month`) | Column chart, one neutral colour | Absolute counts. Gives the heatmap and the grid their denominators, and keeps K5's size information if K5 goes |
| 4C | D30 retention by channel vs 12 % | Share of each channel's cohort still active at day 30 | `D30 Retention`, new: `D30 Target` = [_T D30_RETENTION] | Column + dashed target | Flat: 12.5 – 13.4 %, all above 12 %. Little to read |
| 4D | LTV by channel | Lifetime value per customer by channel | `LTV` | Column chart | $1.3k – $2.4k, but it is K2's numerator: repeats K2 |
| 4E | Refund rate by channel | — | `Refund Rate` | — | Goes to the Campaigns bottom row: excluded |

4A and K2 tell a related story (LTV:CAC ≈ 1 ÷ (payback × churn)). If the USER wants no overlap with K2, take **4B + 4C**.
