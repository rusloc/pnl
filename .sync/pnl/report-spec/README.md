# Management P&L report — Power BI build specification

**What this is.** A complete, build-ready specification of the management P&L report published as a web report at
`https://vosk.dev/work/pnl-suite` ("Management PnL report"), written so that a Power BI developer (human or agent) with no
other context can rebuild the same report in Power BI Desktop from the ground up: data load, model, DAX, pages,
interactions, formatting and validation.

**Source of truth** (read-only, do not modify): repo `C:\__VOSK__` (a Next.js site). The web report's business logic
lives in a framework-free engine (`src/lib/pnl/engine/*.ts`); every rule in this spec cites the file it comes from.
Where the original requirement documents (`docs/pnl/requirements.md`, ADR-0007) and the code disagree, **the code wins**:
the code is what the web report shows today (state of the working tree on 2026-11-16, including an uncommitted
Profitability rework).

**Audience.** A Power BI building agent. Precision over prose: exact names, exact numbers, exact formulas.

## File index

| File | Content |
|---|---|
| `README.md` | this page: purpose, file index, build order, assumptions, open items |
| `01-overview.md` | business story, users, the questions the report answers, the five showcase points, scope of the web report today |
| `02-data.md` | every source file (absolute paths), every column, grain, keys, row counts, the manifest's lookups, Power Query (M) to load and reshape them, including the C-31 allocation |
| `03-model.md` | star schema, relationships, the month table, the P&L line structure (spine), versions and plans, helper / parameter tables, calculation group, field parameter |
| `04-measures.md` | every measure as DAX (selection, window and plan engine, translation, 23 lines + 6 ratios, the 62-metric catalogue, statement, Vitals, Analysis, Profitability, header and notices), with the engine rule, format string and `file:line` source |
| `05-pages.md` | page by page, visual by visual on a 1280 × 720 grid: type, position, fields, sort, conditional formatting, titles, tooltips, empty states, notices |
| `06-interactions.md` | slicers and their defaults, the filter rail and flyouts as bookmark panels, cross-filtering rules, sync groups, what replaces each web control |
| `07-theme.md` | colour tokens (exact hex), fonts, number formats, a complete Power BI theme JSON |
| `08-validation.md` | the 63 verified answers (filter context → measure → expected value), the 552 control totals, engine reference outputs for the default views, row-count checks, DAX query templates |

## Build order

1. **Data** (`02-data.md`): create the `DataFolder` parameter, the manifest query, the dictionary lists, then `Fact PL`
   (with the allocation step), `Fact Ops`, the dimensions, `FX Factor`, `FX CC Factor`, `Data Info`, `PL Row`. Check the
   row counts in `08-validation.md` §5 before going further.
2. **Static helper and parameter tables** (`03-model.md` §6–§7): `P …` parameter tables, `Plan Column`, `Plan Scope`,
   `FX Override`, `Vitals Card`, `Bridge Step`, `Conc Level`, `Trend Row`, and `Applied Row` (`04-measures.md` §11).
3. **Relationships** (`03-model.md` §3). All single direction, one-to-many; parameter and helper tables stay disconnected.
4. **Measures in this order** (`04-measures.md`): folder 0 (selection) → 1 (window) → 2 (plan) → 3 (translation and base
   amounts) → 4 (lines and ratios) → 5 (catalogue) → then the page folders. Set the model culture to `en-US`.
5. **Calculation group** `Comparison Column` and the **field parameter** `Statement Columns` (`03-model.md` §8–§9).
6. **Validate numbers before any visual**: run the DAX queries in `08-validation.md` §2 and §3. All 63 golden rows and
   the control totals must match (amounts within 0.011 currency units, ratios within 1e-9).
7. **Theme** (`07-theme.md`), then **pages** (`05-pages.md`) and **interactions / bookmarks** (`06-interactions.md`).
8. **Visual check** against the engine reference outputs in `08-validation.md` §4 (default views of both companies).

## Assumptions

- Power BI Desktop, current release (2025/2026), import mode. Features used: Parquet connector (`Parquet.Document`),
  calculation groups, field parameters, dynamic format strings for measures, the new Card visual with reference labels,
  page navigator, bookmarks and selection pane, report-page tooltips, data bars, small multiples. No custom visuals.
- The data is frozen synthetic data (built 2026-10-28). No incremental refresh, no gateway. The source files are on the
  machine that builds the report (`C:\__VOSK__\data\pnl\parquet\`). If the builder cannot reach that folder, copy the
  four files listed in `02-data.md` §1 next to the `.pbix` and change the `DataFolder` parameter only.
- Monthly grain, calendar fiscal year, 36 months Jan 2024 – Dec 2026, last closed month Sep 2026 (`dim_month.is_closed`).
- Report-level parity target = what the web report shows today: **two companies** (Consumer Products `P`, Commerce Cloud
  `S`), four views (P&L statement, Vitals, Analysis, Profitability). The consolidated **ACME Group** view and the
  statement-wide slice filters are **not built in the web report** (the company picker shows Group as "Not built yet";
  the Slice flyout says slice filters are not built). The model in this spec still supports Group (needed by three golden
  answers) so it can be switched on later; see `03-model.md` §10.
- Model culture `en-US` (thousands separator `,`, decimal `.`). Negative numbers use the true minus sign `−` (U+2212).
- No AI chat in Power BI (the web report's "Ask AI" button is out of scope; its answer key is reused for validation).

## What Power BI cannot do 1:1 (summary; details in the page and interaction files)

| Web report | Closest Power BI pattern |
|---|---|
| State in the URL, "Copy link" | Report bookmarks / personal bookmarks; "Reset" bookmark replaces "Back to default" |
| Filter rail flyouts, company picker, applied-filters pop-up, "How to read", ⓘ pop-ups | Bookmark-driven panels (grouped shapes + slicers / cards), report-page tooltips |
| Statement row styles on the line label (bold key rows, italic ratios) | Row-dependent background and font colour on value cells via conditional formatting; row headers stay plain |
| Statement column set switched by toggles and Compare = None | Field parameter `Statement Columns` with a "Columns" slicer; switched-off comparisons return blank |
| Dynamic column-group titles ("vs Budget", "YTD Sep 2026 - Actual") | Static matrix headers + a dynamic title text box above the matrix |
| Waterfall with truncated axis, CC subtotal, hatched FX, level steps | Stacked column chart with an invisible base series and measure-driven axis start |
| Region colours by rank in Concentration / Trends | Fixed region colours matching the default rank (NA, EU, AP, UK) |
| Variance filter drops members of the other company | Measures ignore a stale member of the other company (pattern in `04-measures.md` §9.1) |
| IBM Plex Sans / Condensed | Use them if installed on every viewer's machine; otherwise Segoe UI (the design's own fallback) |

## Size of the build

14 loaded Power Query tables (+ 6 staging queries / parameters), 24 calculated tables (14 parameter tables,
3 helpers, 4 axis tables, `Applied Row`, the field parameter, the calculation group), 17 relationships, **304 measures** (62 of them
the metric catalogue), 4 report pages + 2 tooltip pages (or 1 + 7 if one info tooltip page per visual), ~55 bookmarks.

## Open items (`TODO(verify)`)

1. `docs/pnl/ai-chat.md` and `README.md` say the catalogue has **61** metrics; the code (`src/lib/pnl/chat-metrics.ts`)
   defines **62** (23 + 6 + 8 + 3 + 10 + 6 + 3 + 3), confirmed by running it. This spec follows the code: 62 metric measures.
2. Power BI version differences: the "Totals label" text option of the Table visual and per-series `fx` colours in a
   stacked column chart exist in recent Desktop releases; if missing, use the fallbacks named in `05-pages.md`.
3. The web header shows the data build stamp in the **viewer's** time zone; Power BI shows it in UTC
   ("Refreshed 28 Oct 2026 15:57").
