# Period picker v2 + one page top for all tracks

> Status: accepted (USER, 2026-10-23). Applies to Track A (`fabric-app/`), Track B (`pbi-report/ACME Unified PnL/`) and Track C (`js-report/`).
> Replaces the Period flyout / panel of the Ledger design (`docs/design/design-requirements.md`) and the page top of Tracks A and C.
> Spec: `docs/Requirements.md` F-02, F-03, F-04, C-01, C-02, L-01, L-04 · layout reference: `docs/ADD/features/pbi-report-layout.md` (page map).

## Part 1 · Period picker v2

**Goal:** someone who has never seen a P&L report picks a period on the first try, and sees which months the numbers cover before closing the panel.

**What was wrong with v1:** jargon labels (QTD, LTM, FY); the month means different things per time view ("the month", "up to", "ending") without saying so; open months are shown by a dashed border plus a footnote; the time view sits last, although it decides what the month means; nothing shows the months actually covered.

### Layout, top to bottom

1. **Title row:** "Period" + close (×).
2. **Live summary** (large, plain sentence, updates on every click): `Showing Jan – Sep 2026 - year to date`. Month view: `Showing Sep 2026`. LTM: `Showing Oct 2025 – Sep 2026 - last 12 months`. Full year: `Showing Jan – Dec 2026 - full year`.
3. **"Show"** — the time view, first, as five buttons with plain labels:
   `One month` · `Quarter to date` · `Year to date` · `Last 12 months` · `Full year`.
4. **"Year"** — `2024` · `2025` · `2026` (no "FY" prefix).
5. **Month grid** (4 × 3), its label follows the time view:
   - One month → "Month"
   - Quarter to date / Year to date → "Up to"
   - Last 12 months → "Ending"
   - Full year → the grid is hidden, replaced by one line: "Full year covers January to December."
   - **Covered months are shaded** (light company tint) and the anchor month is solid, so the reader sees the window. LTM crossing into the previous year: the shading shows the selected year's part, and the summary names the full range.
6. **Open months** (after the last close, C-01):
   - Base = Actual: open months are disabled, text "not closed yet" under the month name; hover / focus explains "Switch the base to Latest estimate to include forecast months."
   - Base = Latest estimate or Budget: open months are selectable and carry a small "forecast" / "budget" label under the month name.
   - No footnote, no dashed borders.
7. **Footer:** `Back to default` (left, text button; restores Year to date, current year, last closed month) · `Done` (right, primary).

### Rules

- Selection applies immediately (as today); Done only closes. Escape closes; focus returns to the rail item.
- Defaults unchanged (F-02..F-04): current FY, last closed month, Year to date.
- Keyboard: each row is a radiogroup (arrow keys move, Space selects); disabled months are skipped.
- Labels are the only copy; no help text other than the one Full year line and the open-month hint.
- The rail tooltip and the applied-filters pop-up use the same summary sentence. Its separator is " - " (same as all header copy, decided 2026-10-23).
- Applied-filters pop-up: keep all Track B rows (parity); the Fiscal year row shows the plain year (`2026`, no "FY") in every track.
- Under Actual the summary names the **effective** window after the C-01 cut, the same months the numbers contain: Full year 2026 at close Sep → `Showing Jan – Sep 2026 - full year`; nothing closed yet → `Showing no closed month yet` (decided 2026-10-23, Track A first; matches the model's `_Window Label`).

### Track B (Power BI) — closest native equivalent

Power BI can't hide the month slicer per time view or shade a range inside a slicer. bip builds the closest version and lists every deviation in `docs/ADD/features/pbi-report-layout.md`. Expected: the summary sentence as a measure card at the top of the flyout; time view first with plain labels (display names from the model, not new calculated columns; push upstream or use Power Query); "Up to / Ending" label as a measure; a covered-months strip (12 small cells, measure-driven fill) under the month slicer if it costs < 0.3 s; open months handled by the existing data rules plus a hint line.

## Part 2 · One page top (Track B is the reference)

The top of the page is the same in all three tracks. The reference is the current Track B page (`pbi-report-layout.md`, page map, 2026-10-22 review batch):

- **Rail (left, dark):** brand mark tinted in the company colour (opens the company picker, accessible name "Switch company"), then Period · Versions · Slice · Display, then expand.
- **Title row:**
  - left: `Profit & loss` + an applied-filters button (funnel icon) that opens a pop-up listing every filter and its current value (the same rows as Track B's `dim_filter_row` / `Filter Value`, and the period line uses the summary sentence above).
  - right-aligned: the status line `<Company> - Management reporting - Closed through <Mon YYYY> - Refreshed <d Mon YYYY HH:MM>`.
- **Tabs row:** P&L statement · Key figures · Analysis · Profitability, icons as in Track B, selected tab with a 3 px company-colour underline.
- **Not present:** notice strip, context line under the title, header company cards.
- **Separator:** " - " everywhere in header copy (no " · ").

Notices that used to sit in the strip (window passes the close, forecast months included, prior year missing, allocation active, Group eliminations) appear as rows of the applied-filters pop-up. They must not disappear (C-50). This is an amendment of L-04 / L-05 (ADR-0007 §3a already applied it to Track B).
