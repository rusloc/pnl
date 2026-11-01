# Mirelo Sales & Revenue: owner's changes of 2026-11-01, to align the JS pack and the Power BI report

- **From:** vosk.dev repo agent
- **To:** rusloc/pnl agent (owner of `mirelo-sales/js-app/` and `mirelo-sales/power-bi/`)
- **Date:** 2026-11-01
- **Status:** built and verified in the vosk.dev copy of the JS report; **not yet in the pack, not in the PBIP.**
- **Reference patch:** `2026-11-01-mirelo-sales-changes.patch` (same folder): the vosk.dev diff for these changes. It is
  for reading, not for `git apply`: the paths and the Prettier style differ from the pack (map below).

The owner reviewed the custom JS report live on vosk.dev (`/work/online-sales-report`) and asked for the ten changes
below. vosk.dev built them in its vendored copy (from the pack of 2026-10-28). Please carry them into
`mirelo-sales/js-app/` and make the Power BI report match where Power BI can, then re-issue the pack.

## Path map (vosk.dev → pack)

| vosk.dev | pack `mirelo-sales/js-app/` |
|---|---|
| `src/lib/mirelo/<file>.ts` | `lib/sales/<file>.ts` |
| `src/components/mirelo/sales-app.tsx`, `header.tsx`, `slide-over.tsx` | `components/sales/SalesApp.tsx`, `Header.tsx`, `SlideOver.tsx` |
| `src/components/mirelo/cards.tsx`, `charts.tsx`, `controls.tsx`, `popup.tsx`, `sales.module.css` | `components/sales/` same names |
| `src/components/mirelo/glass.tsx`, `glass.module.css` | `components/glass.tsx`, `components/glass.module.css` (vendored from `js-report/`: see change 6) |
| `src/components/report-board.tsx` (the host's 1440 × 810 scaler) | no equivalent: the pack leaves scaling to the host (change 10) |

## The changes

| # | Owner's ask | Built in vosk.dev (JS) | Power BI equivalent |
|---|---|---|---|
| 1 | Remove the yellow box behind the story callout ("RO credit policy tightened Mar 2026"): it looks like a button and is not accessible | `charts.tsx` `Callout`: no rect; plain 11 px semibold ink text beside the dashed marker, with a panel-coloured halo (`paint-order: stroke`), flips left near the right edge. The callout text is appended to the chart's `aria-label`. Applies to every callout (o8, p10, r11) | Replace the yellow shape / card behind the event label with plain text (no fill), keep the dashed marker line. Give the chart an alt text that includes the event |
| 2 | The four top cards (Loans issued … Bad / overdue loans) gave no sign that a click opens the detail view | `cards.tsx` `HeroCardView`: the stretched button now shows a visible **"Details →"** label, bottom-right (ink 1 px border, white fill; inverts on card hover and on focus). Comparator rows moved up 16 px (top 108 / 132) to free the bottom row. Aria-label ends "Open the details." | Add a visible "Details →" button on each hero card (page-navigation / bookmark action to the view), bottom-right. Keep the whole-card click if it exists |
| 3 | Remove the Month / QTD / YTD control from the top | `header.tsx`: the Market, Period, Month and Comparator controls are all gone from the bar (they moved into the filter pop-up, change 4). The header keeps title, wedge, tabs, How to read, Copy link | Remove the market / period / month / comparator picker tiles from the header |
| 4 | One filter button that opens a filter window, with named filters: period (week, month, quarter, year), comparison (Budget, PY), region (PL, RO, PT) | `header.tsx` `Filters`: a **Filters** button (funnel icon, top right on the wedge) with the applied filters as one line beside it ("Sep 2026 - Month - vs Budget - All markets", `copy.ts` `filterLine`). The glass pop-up has labelled groups: **Period** = Week · Month · Quarter to date · Year to date, plus "Up to" (closed-month select); **Comparison** = Budget · Prior year; **Region** = All markets · PL · RO · PT; then the full "Showing …" sentence, "Back to default" and "Done". Choices apply at once. **Week is shown disabled** with the reason "The data set is monthly: weekly figures are not in the data." R12M is no longer offered (old links with `period=r12m` still parse). New `controls.tsx` `Radios` (roving tabindex); the header's `Segmented` was removed. `windows.ts` `TIME_VIEW_NAMES` now reads Month / Quarter to date / Year to date / Last 12 months | One **Filters** button opening a filter panel (bookmark-toggled group or a slicer pane) with titled slicers: Period granularity, Up to month, Comparison, Region. **Week needs a weekly grain the data does not have**: add a week key to `data-gen` (and to the fact tables) if the owner wants it live; until then show it disabled or leave it out and say why |
| 5 | Markets table → "Show loans" opens a separate window with the details; overlay the main report with a 20 % transparent dark-grey mask | `slide-over.tsx` + `sales.module.css`: the 720 px right-half slide-over is now a **centred window** (1120 × 640, `max-height: calc(100% - 48px)`) in the pop-up glass of change 6; the mask covers the whole board, header included: `rgba(64, 64, 64, 0.2)`. Behaviour unchanged (focus in, Tab trapped, Escape or mask click closes, Back, CSV). Applies to every drill (loans, agent, client) | The drill-through pages `loan_detail` / `client_detail` navigate away (accepted difference, ADR-0011). Closest match: a full-page 20 % dark-grey rectangle over the report plus a centred detail panel, shown by a bookmark from "Show loans"; or keep the drill-through page and style it as a centred panel on a grey ground |
| 6 | Redesign all pop-ups: frosted matte glass with a strong blur of what is under it, a clear 1 px near-black border, a shadow | `glass.module.css`: `background: rgba(244,243,240,.62)`, `backdrop-filter: blur(28px) saturate(1.05)`, `border: 1px solid #1a1a1a`, `border-radius: 12px`, `box-shadow: 0 18px 44px rgba(17,17,17,.26), 0 2px 6px rgba(17,17,17,.14)`, no inset highlight; solid fallback `#f4f3f0` with the same border. Same look on the detail window (alpha .8). **vosk.dev now owns its Mirelo copy of the glass**: the P&L route keeps the old glass. In the pack, either fork `glass.module.css` for `/sales` or give the shared one a Mirelo modifier | Power BI has no backdrop blur. Match what it can: tooltip page `tt_card_info` and the How-to-read groups get a 1 px #1A1A1A border, a drop shadow (shape shadow, ~25 % black, offset 0 / 12 px, blur 30 px), a light warm-grey fill at ~85 % opacity, 12 px corner radius |
| 7 | "New clients by acquisition channel": prior year as a yellow filled bar | `charts.tsx` `Bars`: with a prior year a row holds two bars, actual (ink, 60 % of the bar height) on top and **prior year filled `#FFD54A`** (50 %) under it; the outline is gone. Legend role `pyFill` (yellow square), used by o6 (`overview.ts`). The column chart's PY outline (l7) is unchanged | O6 (drawn as columns in the PBIP): prior-year series filled `#FFD54A`, no outline |
| 8 | On all KPI cards, move the ⓘ to the top-left corner beside the title | `cards.tsx`: hero and KPI cards put the ⓘ at left 8 / top 12 (`.infoTop`), the title moves to left 34 (`.labI`); the pop-up opens under the card (`underCard`). Chart and table panels keep their ⓘ where it was | Move each card's ⓘ (the tooltip card visual) to the top-left, title shifted right by ~26 px |
| 9 | Use the row the ⓘ left for "vs Budget" where available | `kpis.ts` `kpiRows` returns `rows` (vs Budget, vs PY; Budget first; vs PY alone when the metric has no Budget; a fixed comparator alone) and `chip` (follows the chosen comparator, falls back to the other row). `view-model.ts` `KpiCard.row/alt` → `rows`. No more hover swap (`.alt` / `.main` CSS removed). Rows at top 78 and 98. New `kpis.test.ts` | KPI card SVG measures: draw both "vs Budget" and "vs PY" rows (Budget first) where the metric has a Budget; the status chip follows the comparator slicer |
| 10 | The report left a big empty band at the bottom of the screen | `report-board.tsx` gained `fill`: the board scales to fit the popup in both directions (≤ 1.25×) and grows taller than 810 to fill it; `sales-app.tsx` spreads the extra height: Overview, both chart rows (the hero band and the 3-row markets table keep their size, the table sits at the bottom); band views, 30 % to each chart row and the rest to the scrolling table. `.panel` now ends at the board's bottom; pop-up placement reads the board height. This is host-side: the pack's own page could do the same with a viewport-height board | Canvas: keep 16:9 (1440 × 810) or move to a taller custom page size if the report is embedded in a taller frame; set page view **Fit to page**. Check that no empty band shows in the embed at the size vosk.dev uses (the popup is up to 1600 px wide, ~ 90 % of the screen height) |

## Verified in vosk.dev (2026-11-01)

- Typecheck, lint, 900 site tests (Mirelo 154 + 4 skipped, plus 5 new), production build.
- Headless Edge at 1600 × 900, 1920 × 1080 and 1280 × 800: no gap under the board at any size; the filter pop-up has 10
  radios with Week disabled and its reason; picking Quarter to date + RO + Prior year rewrites the filter line to
  "Jul–Sep 2026 - Quarter to date - vs Prior year - Romania"; a hero card's Details opens Loans issued; Show loans opens
  the centred window (50 rows) on the `rgba(64,64,64,.2)` mask; Escape closes the window and leaves the report open;
  no console errors.

## Open for the owner (not decided here)

- **Week:** build a weekly grain in `data-gen`, or keep it disabled.
- **R12M:** it left the UI with this change (not in the owner's list). Say if it should come back as a fifth period.
- Hero values are unchanged (24.4k loans, €9.6m, 9,796 new clients, 59.9 %, 4.6 % for Sep 2026 / Month / All).
