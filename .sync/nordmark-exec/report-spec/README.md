# Nordmark Retail executive dashboard — Power BI build specification

- **From:** vosk.dev repo (`C:\__VOSK__`), the web flavour's owner
- **To:** the Power BI building agent
- **Date:** 2026-11-16
- **Status:** ready to build

## Purpose

Rebuild, in Power BI Desktop and from nothing but this folder plus the data files it names, the Nordmark Retail
executive dashboard that the site shows at `https://vosk.dev/work/executive-dashboard` (web report: a Next.js
client that computes everything in the browser). Same numbers, same windows, same status rules, same texts; the
layout scaled from the web's 1440 × 810 board to a 1280 × 720 canvas. Where Power BI cannot do what the web does, the
files say so and give the closest pattern.

The truth behind every statement here is the site repo's working tree (read 2026-11-16; uncommitted changes
included): engine `C:\__VOSK__\src\lib\nordmark\`, UI `C:\__VOSK__\src\components\nordmark\`, spec
`C:\__VOSK__\docs\nordmark\`, data `C:\__VOSK__\data\nordmark\`. Do not edit those; this folder is a copy-free
description of them.

## Files

| File | What |
|---|---|
| `01-overview.md` | the business, the users, the questions, the twelve cards and their rules, what is not rebuilt |
| `02-data.md` | every source file (absolute paths), every column, grain, keys, row counts, the manifest, **all Power Query (M)**, and the expected `Week` and `Period` tables |
| `03-model.md` | tables, relationships, sort orders, the window model, why no calculation group |
| `04-measures.md` | **286 DAX measures** in 9 folders, each with the web definition, format and source reference |
| `05-pages.md` | 5 pages (Executive, Explain, two tooltip pages, Validation): every visual, position on 1280 × 720, wells, formatting, empty states; the per-card wrapper script |
| `06-interactions.md` | slicers and defaults, cross-filtering, the 31 bookmarks, slicer sync, tooltips |
| `07-theme.md` | colours (exact hex), fonts and sizes, number formats, icons, the theme JSON |
| `08-validation.md` | structure checks, the 97-row answer key with the measure that must return each value, status codes, the exact strings of every card in 17 views, the bars of the default view |

## Build order

1. **Theme**: import the JSON of `07-theme.md`; set the file's locale to English (United States); turn off Auto
   date/time.
2. **Power Query** (`02-data.md`), in this order: parameters `DataFolder`, `ChecksFolder` → `Manifest` (no load) →
   `Report Info` → `Week` → `Period` → `Bar Item` → `Site Group`, `Region`, `Region Group`, `Category`, `KPI`,
   `Status Rule`, `Target` → `Cube`, `Opex`, `PO`, `Sites` → `Comparator`, `Window`, `Card`, `KPI Drill Step`,
   `Metric` → `Golden`, `Golden Category` → (optional) `Control`, `Control Scope Category`. Add an empty `Measures`
   table.
3. **Model** (`03-model.md`): relationships, the bridge's both-direction filter, sort-by columns, the three `Card`
   calculated columns, hide technical tables and columns.
4. **Measures** (`04-measures.md`) folder by folder, 0 → 8. After folder 2, build the **Validation page first**
   (`05-pages.md` page 5) and get `[Golden Fail Count]` to 0 before any visual work.
5. **Executive page**: frame, status strip, the 12 cards (build one, copy, change the visual filter / wrappers),
   bars, overlays.
6. **Explain page** and the two tooltip pages.
7. **Bookmarks and sync** (`06-interactions.md`), then the default-view bookmark last.
8. **Validate** against `08-validation.md` (structure, answer key, card strings for the default view and the spot
   views).

## Assumptions and decisions

- The data source is the **Parquet + manifest files** in `C:\__VOSK__\data\nordmark\parquet\` (also loaded in a
  Supabase schema the Power BI build does not need). Data is a snapshot as of FY2026 W43; no refresh schedule.
- The period picker is a **disconnected table** and every window (picked period, last year by key, previous
  like-length, month to date for the EBITDA flash, the bar items) is applied in DAX as a `Week[week_ix]` range; no
  Power BI time intelligence. This is the only way to keep the 4-5-4 calendar's "same retail week" and the
  like-length "to date" comparisons exact.
- **Inter** (the web font) is replaced by **Segoe UI**; the gradient wash, glass blur and pulsing dot become flat
  colours.
- The web's URL state and the chat button are not rebuilt.
- Accepted platform differences, already agreed for the Power BI flavour in the PNL repo: the FY row stays visible at
  Year (it drives the single Year chip); the Category dropdown shows Power BI's "All" when nothing is picked.
- Further Power BI-only differences, documented where they occur: the granularity switch falls back to the latest item
  rather than "the item holding the current item's last week" (same result from the default view); bars before the
  data starts are not drawn with placeholder labels; explain-pop-up spark labels are not thinned to every 3rd / 2nd;
  the ⓘ explanation is a page reached by bookmark instead of a pop-up.

## Open items (TODO(verify))

1. Report-page tooltip receives a visual's **visual-level** filter (`Card[kpi_code]`) — `05-pages.md` › TT Chip.
   Fallback given.
2. A slicer accepting a measure-based visual filter to hide "Previous" at Year — `06-interactions.md`. Fallback: leave
   it; the measure snaps it to Last year.
3. `FORMAT` (half away from zero) vs JavaScript `toFixed` on exact halves — `04-measures.md` › recipes. No validated
   string is affected.
4. Theme-JSON keys may need trimming per Desktop version — `07-theme.md`.

## Who owns what

The web report and its data are owned by the vosk.dev repo; the generator and the control totals were produced in the
PNL repo (`rusloc/pnl`, ADR-0013) and are consumed here as files. A data re-issue means: replace the files, refresh,
re-run the Validation page.
