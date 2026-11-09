from rusloc/pnl (bip, for the main agent) · to vosk.dev repo agent · 2026-11-04 · status: ready (2026-11-05)

> **2026-11-05, later (nerd):** `acme-marketing/js-app/` is issued (parity gate passed: 1,416 rows, 0 gap, hunter). Ingest
> it into the site repo as it is; its README covers build, run, embed and the URL keys. Status of this note: ready.
>
> **2026-11-05 (USER decision, archi):** the JS flavour is **built in rusloc/pnl** (`js-marketing/`, ADR-0015 (a) amended to alternative 1; contract `docs/ADD/features/marketing-js-flavour.md`), with the Power BI report as the reference and a parity gate before the pack. "Building it is the task" below **no longer applies to the vosk.dev agent**: do not start the JS build from this pack. The pack will gain `acme-marketing/js-app/` (source + prebuilt `public/data/` + control-totals fixture) after the parity gate; this note is then updated and set to ready.

# ACME Marketing (Paid Acquisition Console) — hand-off for the JS flavour

ADR-0015 (Proposed) built the Power BI flavour of a new showcase in rusloc/pnl: a one-page, five-view analytical dashboard for the paid
online acquisition of ACME's SaaS product (web, iOS, Android; 6 channels, 8 networks, 19 campaigns; USD; all data generated and
illustrative). This note is the entry point for building the **JS flavour** from the same data in the vosk.dev repo. Nothing here
carries a secret, key, connection string or workspace / tenant ID.

## What is in `.sync/`

| Path | What | Use it for |
|---|---|---|
| `data-gen/acme-marketing/` | Generator (`generate.py`, `metrics.py`, seed 20261104), `checks/verify.py` (132 checks) and `checks/control_totals_usd.csv` (28,660 rows), and the **data README** | Build the data (27 Parquet + `manifest.json`, 0.26 M rows, 2.2 MB, byte-identical per seed). The data README is the **contract**: tables, grain, columns, metric rules, verdict / flag / alert rules, deviations D-1 … D-18. Its names win over the spec |
| `acme-marketing/spec/` | The USER's spec bundle (`README.md`, `AI_CONTEXT.md`, `SPEC.md` v1.0, `mockup/index.html`) + `Requirements-marketing.md` (requirement IDs A-nn, acceptance tests AT-nn) | What to build: views, cards, filter design, visual system (tokens, the six channel colours), chart conventions. Where the mockup's numbers disagree with the data, the data README and the requirement note win (ADR-0015 (d)) |
| `acme-marketing/js-app/` | The JS flavour: a standalone Next.js 16 app (source, config, tests, the parity CSV + notes, lockfile, prebuilt `public/data/` 1.55 MB, `fixtures/checks/control_totals_usd.csv`) and its README | Ingest into the site repo: `npm ci`, build with `EMBED_ALLOWED_ORIGINS` set, host, embed the 1440 × 810 board. No data step: the data is prebuilt |
| `acme-marketing/power-bi/` | The Power BI flavour (PBIP, no data, `DataFolder` placeholder), its tests (28 blocks / 29,265 rows) and README | The look and behaviour reference: card anatomy, copy (card titles, questions, ⓘ texts in the README / `dim_card`), the story numbers on screen |

Ingest `acme-marketing/js-app/` into the site repo (its README: build, run, embed, URL keys, deviations, open USER items).

## How to get the data

```powershell
cd .sync\data-gen
py -3.12 -m venv .venv                                   # once
.venv\Scripts\python.exe -m pip install -r requirements.txt
.venv\Scripts\python.exe acme-marketing\generator\generate.py     # writes acme-marketing\parquet\ (~3 s)
.venv\Scripts\python.exe acme-marketing\checks\verify.py          # 132 checks, exit 1 on any failure (~20 s)
```

The JS app should read static files built from that folder (pre-aggregate in its build step, as the Mirelo / Nordmark apps do) and
reconcile to `checks/control_totals_usd.csv` (AT-01): every row has a scope (`ALL`, `CH:<channel>`, `PF:<platform>`, `CP:<campaign>`,
combos, `CR:` creatives, `TM:` terms), a period key (`R30-2026-11-03` default, previous period, LY, 7 d, MTD, QTD, calendar months,
days, cohort months) and a metric code; tolerance amounts 0.005, ratios 1e-6. The Power BI tests reconcile every row; use them as a
cross-check when a JS number differs.

## The story the screen must tell (AT-02, data README "Default window")

Default window Oct 5 – Nov 3 2026, all filters at default, model Data-driven. Vitals (redesign round 1, A-20 / A-21 amended 2026-11-04;
Δ always vs the same dates last year): Spend $188.4k +32.7 % · New clients 6,980 +19.4 % · Conversion into paid 6.5 % −0.5 pt · Time to
activation 1.1 d −0.3 d · CAC $412 +19.0 % · ROAS 90 d 1.02× −0.14; a binoculars before each tile's label opens that one metric by
day with last year dashed (2026-11-05). Against the previous 30 days (the Filters default): trial → paid
14.2 % (−1.9 pt) while clicks +0.9 %; paid CAC steps up on Oct 18; the drop is mobile paid social; Meta prospecting · Lookalike 2 %
carries 70 % of the shortfall (fatigue at frequency 3.4, CTR −46 %), App Store CVR flat 31 %, its cohorts still pay back at month 9;
five alerts trip (model tests; the Anomalies card now lists campaigns by Δ paid customers, Worst 5 / Top 5);
attribution gap +38 %; data 2 h old. Decision text: rotate the creative, hold the budget.

## Platform differences to expect (Power BI limits; the JS flavour should build the spec's version)

Power BI could not do these; the JS app should follow the spec and the requirement note instead, and the two flavours will differ here
(to be listed in `docs/design/parity-rules.md` as accepted differences):

- **Filters:** Power BI applies each pick at once, shows the applied state instead of a live preview, has no `F` / Esc keys or click
  outside, chips are a text line (not removable one by one), Reset clears everything. JS: Apply / Reset group / Reset all, live preview
  of spend / customers / CAC, removable chips, the dashed cross-filter chip, keyboard (A-57, A-14).
- **Saved views:** removed from both flavours' scope by the USER (redesign round 1, 2026-11-04).
- **Look:** light theme only, no backdrop blur (white 90 % + edge + shadow), Segoe UI instead of Manrope / Inter, fixed 1440 × 810
  canvas, no motion. JS: light + dark, `backdrop-filter` with the `@supports` fallback, responsive (A-58, A-59).
- **Charts:** Power BI draws O1 funnel, O2 guardrails and O7 spend / paid customers by channel as SVG and uses column charts where the
  spec has horizontal bars (O6, C2, C5 / C6, P6 / P7, J2–J4, K2, K6, K7); the Oct 18 marker is a fixed annotation; J4 is by platform segment (the data has no single OS versions); no creative thumbnails, no ⋯ menu (ⓘ only), no
  session recordings (A-04).
- **Interaction:** a click on a mover cannot open the Campaigns view; the Campaigns view defaults to the worst mover; the vitals never
  re-scope on a click (both flavours, A-13). JS: hash routing `#overview … #cohorts` (A-62).
- **Readings both flavours share** (data README wins): vitals without sparklines (ADR-0012), status default Live + Learning only on the
  campaign list (window totals keep every campaign), the attribution switch reaches paid customers and New MRR only, cohorts are DDA only.

## Open USER decisions (ADR-0015 §5; the build runs on the defaults)

1. **Flavours (q 1):** JS built here in the vosk.dev repo from this pack (default) — or both flavours in rusloc/pnl with a parity gate
   before release.
2. **Scale (q 2):** mockup scale, about $190k paid spend per 30 days (default) — or ×4; every absolute value scales, ratios and the
   story do not; one constant in the generator, then regenerate and re-test both flavours.
3. **Gross margin for payback and LTV (q 3):** company-wide 36.3 % (default; the only value that keeps payback 10.8 mo and LTV:CAC 3.4×)
   — or a SaaS-typical 75 % (payback ≈ 5.2 mo, LTV:CAC ≈ 7×) or per tier.

The remaining questions of ADR-0015 §5 (agency fee, brand in CAC, activation per tier, targets, campaign count, attribution controls,
audience, freshness rule, cohort months, names, filter shape) also run on their defaults; see the ADR in rusloc/pnl.

## Redesign round 1 (USER review, 2026-11-04) — build the JS flavour to this, not to the original spec layout

- Overview: funnel (absolute counts) | guardrails | spend and paid customers by channel; anomalies (campaigns by Δ paid customers + the
  campaign alert, Worst 5 / Top 5 switch) | top movers by Δ ROAS (Worst 5 / Top 5); spend + plan columns with the paid CAC line on a
  second axis, full width. O4 is gone; the alert list is no longer a card.
- Channels: channel matrix (CAC, no CPA) on the left; web vs app funnel, paid customers by channel on web and on mobile (CAC in the label).
  C3 / C4 dropped. Campaigns: the campaign table over two rows; keywords / placements | churn by channel | refund by channel (top 5).
  P2–P4 dropped. Cohorts: payback heatmap over the retention grid; LTV:CAC, payback months by channel vs 12, cohort size by month.
  K5 (12-month table) dropped.
- Everywhere: `|` as the text divider, no question line under titles, no captions, no page footer (freshness stays in the header).
- Details and limits: `acme-marketing/power-bi/README.md` (view map, deviations 28–30).
- **Vitals dynamics pop-up (USER, 2026-11-05):** every vitals tile has a binoculars icon before its label (16 px, the ⓘ's circle); a
  click opens one glass window titled `<metric> | dynamics` (e.g. `Spend | dynamics`) with that one metric only: daily line over the
  window (its last 30 days when the window is longer than 90), the same day last year dashed, the last day's value labelled; × closes,
  a view tab closes. No ribbon-level button, no six-chart grid. In Power BI: six pane groups over one shared window, one bookmark each.
- **O5 / O6 movers window (2026-11-05):** when the comparison window would start before the first day of data and the window is longer
  than 30 days (e.g. Custom Jan 1 2025 – Nov 3 2026: its previous period is 2023–2024, its LY only partly covered), both cards compare
  the window's last 30 days with their comparison; every other window is unchanged. Build the JS engine the same way.

## Status

Power BI flavour: phases 2 and 3 built 2026-11-04, redesign round 1 (passes 1 + 2) the same day; 2026-11-05 per-vital dynamics and the
O5 / O6 movers window (validator 0 / 0, tests 29 blocks / 29,387 rows TRUE, every visual under 1 s cold); USER click / hover check pending. JS flavour: built in rusloc/pnl (`js-marketing/`, contract steps 1–6, nerd
2026-11-05), parity gate passed (hunter: 1,416 rows, 1,396 match, 20 accepted minus-glyph rows, 0 gap); packed as
`acme-marketing/js-app/` (standalone `npm ci && typecheck && lint && test && build` green inside the pack folder).
