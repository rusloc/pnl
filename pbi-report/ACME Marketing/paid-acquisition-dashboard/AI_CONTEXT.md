# AI_CONTEXT.md — Paid Acquisition Console

Machine-oriented entry point. Read this first; it tells you where every fact lives so you never have to guess or duplicate. **`SPEC.md` is the single source of truth for requirements; `mockup/index.html` is the single source of truth for implementation details (tokens, layout, sample data).** This file only maps between them.

## 1. What this project is

| Field | Value |
| --- | --- |
| Artifact | One-page, five-view analytical dashboard for paid online ad campaigns of a SaaS product (web + iOS + Android) |
| Company profile | Medium SaaS; 5–20 live campaigns across 3–6 channels; see `SPEC.md › Purpose and scope` |
| Status | Spec v1.0 + static HTML mockup with illustrative data. No backend, no build step. |
| Owner | Spec owner is the human; this bundle was generated 2026-11-04 |
| Licence of assets | Fonts: Google Fonts (Manrope, Inter). No other third-party code. |

## 2. File map

```
paid-acquisition-dashboard/
├── AI_CONTEXT.md      ← you are here (map + conventions + task recipes)
├── README.md          ← one-screen human intro
├── SPEC.md            ← requirements: metrics, reading flow, layout, filters, visual system, data model
└── mockup/
    └── index.html     ← self-contained mockup: CSS tokens + HTML skeleton + inline JS (data, chart helpers, filter window)
```

## 3. Where to find each kind of fact (do not re-derive)

| Need | Go to | Anchor |
| --- | --- | --- |
| Metric names, formulas, grain, source, healthy ranges | `SPEC.md` | `## Metric catalogue` (table; one row per metric) |
| Which tier a metric belongs to and where it renders | `SPEC.md` | `## Metric framework` |
| Reader path / drill-down order | `SPEC.md` | `## Reading flow` (mermaid flowchart, 9 steps) |
| Views, cards per view, grid spans | `SPEC.md` | `## Views and page layout` › "View contents" table |
| Filter window behaviour and precedence rules | `SPEC.md` | `## Filter design` › "Rules" (numbered) |
| Colour tokens, type scale, chart conventions | `SPEC.md` | `## Visual system`; implemented verbatim in `mockup/index.html` `:root` |
| Channel categorical palette (validated) | `SPEC.md` | `## Visual system` › "Slot / Light / Dark / Channel" table ↔ `--c1…--c6` in CSS |
| Star schema tables and refresh cadence | `SPEC.md` | `## Data model and refresh` |
| Unresolved decisions | `SPEC.md` | `## Data model and refresh` › "Open questions" checklist |
| Sample data used by the mockup | `mockup/index.html` | `/* ---------- data (illustrative) ---------- */` block |
| Chart drawing helpers | `mockup/index.html` | `lineChart(svg, series, opts)`, `hbars(svg, rows, opts)` |
| View routing | `mockup/index.html` | `const VIEWS=[…]`, `showView()`, `hashchange` |
| Filter window logic | `mockup/index.html` | `/* ---------- filter window ---------- */` (`openFilters`, `preview`, `applyBtn`) |

## 4. Conventions an assistant must keep

1. **Names are identifiers.** Metric names in `SPEC.md › Metric catalogue`, view ids (`overview`, `channels`, `campaigns`, `journey`, `cohorts`), channel names and token names (`--bg`, `--ink`, `--accent`, `--c1…--c6`, `--good/--warn/--crit`) are used verbatim across spec, HTML ids and JS. Rename in all places or not at all.
2. **Colour is by job.** Series colour = `--accent`, `--accent-2`, `--c1…--c6` (channel hue is fixed per channel, never reassigned on filter). Status colour = `--good/--warn/--crit` only for deltas and flags, never for a series. Text uses `--ink*` only.
3. **One axis per chart.** Two measures of different scale are two stacked charts sharing the x-axis (see Spend + CAC in Overview). Never add a secondary y-axis.
4. **Funnel widths are log-scaled** (`Math.log10`), with numbers printed beside each bar; do not switch to linear.
5. **Filters apply on Apply.** Changing a control updates only the preview pane; nothing re-queries the body until `#applyBtn`.
6. **Cross-filter chips are dashed** (`.chip.cross`), window-filter chips are solid. Keep the distinction.
7. **Both themes.** Every colour token is defined on `:root` (light) and redefined in the two dark blocks. Add new tokens in all three places.
8. **Card anatomy** = `header(h3 + .q)` → visual → `.cap` with the key number. Keep it for every new card.
9. **No external libraries.** Charts are hand-drawn SVG via `el()`; keep it that way unless the task explicitly asks for a charting library.
10. **Figures are illustrative.** Do not treat sample numbers as real; the footer says so and must keep saying so until live data is wired.

## 5. Task recipes

**Add a metric**
1. Add a row to `SPEC.md › Metric catalogue` (formula, grain, source, healthy range).
2. Decide its tier in `SPEC.md › Metric framework` and the card it belongs to in `Views and page layout`.
3. In `mockup/index.html`, add sample data in the data block, then render with `hbars`/`lineChart` or a table row inside the right `<section class="view">`.

**Add a view**
1. Append to `SPEC.md › Views and page layout` (both tables).
2. In HTML: add `<a href="#id" data-view="id">` in `.tabs`, a `<section class="view" id="view-id">`, and push `'id'` into `VIEWS`.

**Add a filter**
1. Add it to `SPEC.md › Filter design` (surface + rules if precedence changes).
2. In HTML: a `[role=tab]` button in `.fw .rail`, a `.pane[data-pane]`, inputs with stable ids, read it in `preview()` and `applyBtn`, and emit a chip in `#chips`.

**Swap the brand palette**
1. Replace values in `mockup/index.html` `:root` and the two dark blocks only.
2. Re-validate the six channel hues for colour-vision separation and contrast (OKLCH lightness 0.43–0.77 light / 0.48–0.67 dark; adjacent ΔE ≥ 8 under deutan/protan; ≥ 3:1 on surface), then update the palette table in `SPEC.md › Visual system`.

**Wire real data**
1. Build the star schema in `SPEC.md › Data model and refresh`.
2. Replace the `/* data */` block with fetches that return the same shapes (`vitals[]`, `channels[]`, `campaigns[]`, daily arrays of 30 numbers).
3. Remove the "Figures are illustrative" footer line.

## 6. Port notes

- The HTML is framework-free; to port to React/Vue, map each `<article class="card">` to a component and keep the CSS tokens as a global stylesheet.
- To port to a BI tool (Power BI, Looker, Tableau): `SPEC.md › Views and page layout` is the page/visual list, `Metric catalogue` is the measure list, `Filter design` is the slicer/bookmark spec, `Visual system` is the theme JSON.
- Hash routing (`#overview` …) is the only URL state; filter state is in-memory by design (`SPEC.md › Filter design › Rules › 5`).
