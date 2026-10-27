# Executive scorecard - design mockups

> **SUPERSEDED 2026-10-24** by the Consumer Goods Reseller executive dashboard (`docs/design/executive dashboard (reseller)/`); kept for reference.

Design concept for the third showcase report (Executive KPI Scorecard, spec `docs/specs/2026-10-24-executive-kpi-scorecard-spec.md`). Concept document: `docs/ADD/features/executive-scorecard-concept.md`. Status: DRAFT for USER approval - nothing is built in any track.

| File | What it is |
|---|---|
| `mockup-light.html` | **Recommended direction - "Ledger Executive"** (light). Evolution of the Ledger P&L system: same frame, rail, page top, type scale and meaning colours; a third status hue (Off-track red) added. |
| `mockup-dark.html` | Alternative direction - "Boardroom" (dark, high-contrast presentation skin). Same layout and markup; only the token block differs (`<html data-theme="dark">`), so it doubles as the optional presentation mode for Tracks A and C. |

## How to open

Double-click either file (no server needed; the only network request is the Google Fonts link for IBM Plex Sans, which falls back to Segoe UI offline). The 1440 × 810 artboard scales down to fit the window.

- Click the **north-star tile** (or any tile) to open the KPI detail view; **‹ Scorecard** or Escape returns. `#detail` / `#board` in the URL opens a view directly.
- **Compare with** (Budget / Prior year / Forecast) swaps the Δ line on every tile; status stays measured against each KPI's target source, as in the spec.
- The Period buttons, rail items and funnel are static in this mockup.

## Illustrative data

All figures are illustrative for an ACME Group, FY2026 YTD Sep view. Net revenue, gross profit, Adj. EBITDA, OpEx, D&A and the 419.8 m units come from `data/acme_pl_dummy_data/checks/control_totals_usd.csv` and `fact_operational`; prior-year YTD, monthly profiles, cash, pipeline, bookings, NRR, ARR, OTIF, NPS, headcount and every note are invented so that every tile state (On track, Watch, Off track, Stale, Not available) is visible on one screen.

Single-file, inline CSS, no external JS; the only script draws the SVG sparklines / trend from the numbers in the markup and switches views. Each file is about 57 KB.
