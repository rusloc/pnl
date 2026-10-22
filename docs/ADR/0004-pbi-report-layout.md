# ADR-0004 — Track B report layout: one 16:9 window with view switcher and filter side bar

- **Status:** proposed (draft by bip, 2026-10-21). The USER decides.
- **Date:** 2026-10-21
- **Decider:** USER
- **Spec:** `docs/Requirements.md` §2 (L-01..L-10), §6 (F-01, F-31..F-36), N-01, N-09, N-10, N-12 · design brief: `docs/ADD/features/pbi-report-layout.md`
- **Layout reference (2026-10-21):** the **Ledger design guide** — `docs/design/design-requirements.md` and the mockup `docs/design/P&L statement view/Main.dc.html`. The Track B report was rebuilt to it: 1440 × 810 page, dark filter rail with four flyouts (Period · Versions · Slice · Display) instead of the side bar with three pop-ups, company cards, view tabs with a per-view toolbar, notice strip. The mechanism decided below (one page, display-only bookmarks, entity as a real filter) is unchanged. Status stays proposed; the USER decides.

## Context

Spec §2 lays the report out as one long page with nine zones stacked top to bottom (header, page tabs, filter band, context line, notices, KPI strip, income statement, analysis panels, profitability), and L-10 says no zone appears or disappears on an entity switch. The USER asked for a different Track B layout (2026-10-21):

1. One 16:9 window that never scrolls; a view switcher shows P&L table, Key figures, Analysis or Profitability.
2. A second switcher for the company profile (Consumer Products, Commerce Cloud, ACME Group).
3. Filters in a collapsible left side bar with icons; each group (Period & version, Slice, Presentation) opens in a pop-up panel.

The spec is tool-neutral and also drives Tracks A and C; this ADR concerns Track B only.

## Decision (proposed)

- Track B uses a single 1280 × 720 page. Header: title, entity switch (tile slicer), data status. Below it: four view tabs and the context line, then the notices line, then one content area that shows one view at a time.
- Views are swapped with **display-only, selected-visuals bookmarks** (Data off, Current page off) driven by buttons; the side bar and its three pop-ups use the same mechanism. Slicer selections are never stored in these bookmarks, so switching views or opening panels never resets filters.
- The entity switch is a real filter (slicer on a disconnected entity-view table), so period, versions, currency and region carry across entities (F-31).
- The profitability breakdown uses a field parameter.

## Consequences

- **L-10 deviation:** zones are not all visible at once; KPIs, statement, analysis and profitability appear by view. Zone content, order inside each view and column sets stay identical for every entity, which keeps the intent of L-10 (no layout jump on an entity switch).
- **L-03 replaced:** the filter band becomes the side bar + pop-ups; the context line (L-04) and notices (L-05) stay always visible, so the active selection is still readable in screenshots.
- **L-02:** the Line definitions and Filters & rules reference pages are not in this draft; if kept, they become extra pages reached from the header.
- **N-10 export:** a page PDF shows only the active view; a full-report PDF needs one bookmark per view (or a print page) — to decide.
- **N-09 small screens:** a fixed 16:9 canvas scales down instead of reflowing; phone use needs a mobile layout (deferred).
- **N-01:** good for performance — hidden views and closed panels do not query; the heaviest view runs about 5 visuals.
- **Maintenance:** each new visual must join the right group, and groups / bookmarks must be renamed together.
- **Parity across tracks:** Track A and Track C may follow the spec layout or this one; parity tests (§10) do not depend on layout.

## Alternatives considered

| Option | Verdict |
|---|---|
| Spec §2 as written: one long scrolling page with all nine zones | Faithful to the spec, but scrolls well past one screen on 16:9 and was not what the USER asked for |
| One report page per view + page navigator | Simple and robust, but breaks "one window" and every page duplicates header, side bar and pop-ups |
| Field parameters / calculation groups only, no bookmarks | Cannot swap visual types (matrix ↔ tiles ↔ waterfall); used only for the breakdown |
| Native filter pane instead of a side bar | No grouping into pop-ups and no icon bar; kept available as a fallback |

## Open questions for the USER

1. Accept the L-10 / L-03 deviation for Track B (this ADR), or keep the spec layout?
2. Keep or drop the Line definitions and Filters & rules pages (L-02, N-12)?
3. PDF export expectation (N-10): active view only, or all four views?
