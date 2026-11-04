from rusloc/pnl (bip, for the main agent) · to vosk.dev repo agent · 2026-11-04 · status: draft

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
| `acme-marketing/power-bi/` | The Power BI flavour (PBIP, no data, `DataFolder` placeholder), its tests (26 blocks / 28,893 rows) and README | The look and behaviour reference: card anatomy, copy (card titles, questions, ⓘ texts in the README / `dim_card`), the story numbers on screen |

There is no `acme-marketing/js-app/` yet: building it is the task.

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

Default window Oct 5 – Nov 3 2026 vs the previous 30 days, all filters at default, model Data-driven: Spend $188.4k +7.0 % · New paying
customers 457 +2.9 % · Blended CAC $531 +6.4 % · New MRR $61.9k +3.4 % · CAC payback 10.8 mo +0.6 · LTV:CAC 3.4× −0.2; trial → paid
14.2 % (−1.9 pt) while clicks +0.9 %; paid CAC steps up on Oct 18; the drop is mobile paid social; Meta prospecting · Lookalike 2 %
carries 70 % of the shortfall (fatigue at frequency 3.4, CTR −46 %), App Store CVR flat 31 %, its cohorts still pay back at month 9;
five alerts; attribution gap +38 %; data 2 h old. Decision text: rotate the creative, hold the budget.

## Platform differences to expect (Power BI limits; the JS flavour should build the spec's version)

Power BI could not do these; the JS app should follow the spec and the requirement note instead, and the two flavours will differ here
(to be listed in `docs/design/parity-rules.md` as accepted differences):

- **Filters:** Power BI applies each pick at once, shows the applied state instead of a live preview, has no `F` / Esc keys or click
  outside, chips are a text line (not removable one by one), Reset clears everything. JS: Apply / Reset group / Reset all, live preview
  of spend / customers / CAC, removable chips, the dashed cross-filter chip, keyboard (A-57, A-14).
- **Saved views:** five fixed bookmarks in Power BI (no custom date range in any; Finance month-end = Cohorts + Last click). JS:
  preset filter states; a user-saved view is optional.
- **Look:** light theme only, no backdrop blur (white 90 % + edge + shadow), Segoe UI instead of Manrope / Inter, fixed 1440 × 810
  canvas, no motion. JS: light + dark, `backdrop-filter` with the `@supports` fallback, responsive (A-58, A-59).
- **Charts:** Power BI draws O1 funnel, O2 guardrails and O4 shares as SVG and uses column charts where the spec has horizontal bars
  (O6, C2–C4, P3, J2–J4, K2, K4); C3 cannot colour the paired bars per channel; the Oct 18 marker is a fixed annotation; K1 shows six
  fixed cohorts; J4 is by platform segment (the data has no single OS versions); no creative thumbnails, no ⋯ menu (ⓘ only), no
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

## Status

Power BI flavour: phases 2 and 3 built 2026-11-04 (validator 0 / 0, tests 26 blocks / 28,893 rows TRUE, every visual under 1 s cold);
first open and click / hover check by the USER pending. JS flavour: not started.
