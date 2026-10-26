DRAFT — projection state (assessment only; nothing implemented in any track)

# P&L views redesign — KPI · Analysis · Profitability

> 2026-10-26. One static page that restructures the three non-statement views of the ACME Unified P&L so the USER can judge the redesign before anything is built in Track A (Rayfin), Track B (Power BI) or Track C (JS). Method (USER): merge the metrics → list what is possible to build → redesign layout and metric list for maximum readability. No file under `fabric-app/`, `pbi-report/`, `js-report/`, `fabric-data/` or `data/` was touched.

## Files

| File | What it is |
|---|---|
| `pnl-views-redesign.html` | The assessment page: one 1440-wide frame in the Ledger design (rail, header, view tabs), a top switcher between **Key figures · Analysis · Profitability** (the P&L statement tab is shown greyed, "unchanged"). Self-contained: inline CSS and JS, inline SVG charts, Google Fonts only. Open it directly in a browser (`?view=ana` / `?view=prof` deep-link a view; the last view is remembered per browser). |
| `metric-inventory.md` | The merge: one table per view (metric · source · status · priority · placement · note), the vocabulary map spec → model, the dropped list and the 10 open decisions with defaults. This is the audit trail for the no-hallucination rule. |
| `README.md` | This file. |

## How to read the page

- **Every card and panel carries a small grey source tag** (measure names from `docs/model/measure-dictionary.md`, spec section, or "new: formula over existing columns"). A tag that starts with "new:" is buildable now from existing data; nothing on the page lacks a tag. Truncated tags show in full on hover.
- **Illustrative dataset:** Commerce Cloud · Actual · FY Jan–Dec 2025 · vs Budget (Compare A) and Prior year (Compare B) · USD m — the view the three specs quote (NR 667.4, Adj. EBITDA 82.8, OP 48.6, FX +11.7, CC NR 655.7, region CM % 50.9–51.9 …). Values the specs do not quote are placeholders chosen so that every bridge, table and tile reconciles; the page footer lists exactly which numbers are quoted.
- **Colour appears only on a breach** (spec KPI §6: grey on track · amber watch · red off track, green text when ahead), driven by variance vs Budget only; prior-year variances are text. On the quoted data only Operating profit (red), Active merchants and ARR (amber) light up on the KPI view, and Adj. EBITDA at constant currency (red) on Analysis.
- **The dashed orange line is the 810 px fold** of the one-window rule (ADR-0004, 1440 × 810). Key figures fits above it (801 px). Analysis (1,749 px) and Profitability (1,384 px) do not; the line shows what would have to move behind a drill tab or scroll inside the view (open decision 3).

## Main design decisions

1. **Key figures: 3 heroes + 2 secondary + 5 drivers (10 metrics, spec §2), not 12 equal tiles.** Net revenue, Adj. EBITDA and Operating profit are visibly larger; Gross margin % and Opex % revenue are small cards; the driver row (GMV · Active merchants · ARR · Revenue mix · FY outlook) swaps content by company exactly like today's slots 4–5 and 9–12 (L-10). The three tiles the spec removes (organic growth, subscription GM %, take rate) and Rule of 40 become sub-lines; Contribution margin % moves to Profitability. All 24 existing `KPI *` item measures stay reachable.
2. **Card anatomy per the spec:** $ and % variances (pp for ratios), "on plan" for a zero variance, 12-month sparkline (actual, dotted budget on the hero), no bullet / diverging bars, status dot, definition tooltip. Header: explicit period, currency, refresh date and a generated 2-line headline. This **supersedes kpi-card-v2** if accepted (open decision 1: the sparkline needs the month-grain measure that was dropped on 2026-10-23).
3. **Analysis headline strip = Reported Δ and Constant-currency Δ only** (NR and Adj. EBITDA). Underlying Δ and Controllable Δ are left off: they need `PassThroughMap` / `NonControllable` tables the model does not have. CC for NR exists (`_Bridge NR CC Change`); CC for EBITDA is buildable (second FX-basis evaluation, perf cost to measure).
4. **Net revenue bridge gains a constant-currency subtotal bar** before FX (655.7 on the quoted data) and step labels in $ and % of comparator; axis truncated (Track B: known native limit, see decision 4).
5. **Profit bridge Budget Adj. EBITDA → Actual Adj. EBITDA → Operating profit** built from existing lines: revenue volume, GM rate, GM mix (from GP by service line, which is direct at line grain), a Variable selling & cost-to-serve step (our spine has one), S&M / R&D / G&A / Other operating, FX, then D&A and Adjusting items as **levels** with their Δ vs budget as label (the spec's "Δ" steps would not reconcile). No SBC step: no SBC in the data.
6. **Service-line economics table** (NR, Δ, CoR, GP, GP Δ, GM %, Δ pp, share, pass-through ratio) with the status dot on **gross-profit Δ %**, not revenue. Stream = service line / category / entity by company.
7. **Largest variances** keeps the model's signed convention (M-10: positive = favourable) and now says so in the subtitle; sorted by |Δ|; n.m. rule; vs PY Δ column; coverage footer. Nature / run-rate / owner / comment wait for a classification table.
8. **Profitability table in groups A–D:** Scale · Gross · Contribution (headline profit level, status dots on CM Δ pp and contribution Δ $) · **D = Adj. EBITDA booked by region** — opex is booked at entity × region (C-31), so by Region (and Entity in the Group view) EBITDA is measured, not allocated. Group E (allocated by NR share) exists only for Channel / Line / Segment, collapsed and badged "allocated — indicative"; it never sits in a headline column. Corporate / unallocated row and allocation keys: later (need an `AllocationKey` table).
9. **Constant currency by default on Profitability** when comparing to Budget or PY (spec DQ-1): the CE / UK&I "beats" of the current page are FX; the headline strip's FX tile says so (+10.7 reported, −1.0 CC for non-USD regions).
10. **CM deviation lollipop** (± pp from the company average, Budget and PY ticks, dot ∝ NR, ±2 pp minimum scale) replaces the 0–60 % bar chart; **contribution variance waterfall by region** (revenue effect vs margin effect per region, FX separate) answers "which region moved profit, volume or margin"; **growth × margin bubble** uses organic growth per slice (exists, K-22); the **mix heatmap** (region × service line) is the drill that explains NA's lower margin (payments mix).
11. **Entity rule kept:** the specs were written for Commerce Cloud; the layout is the same for every company and only the driver row, sub-lines and "stream" rows swap (inventory §0 and §1 give the mapping).

## Status counts (from `metric-inventory.md`)

| View | exists | buildable now | later: needs data | dropped |
|---|---:|---:|---:|---:|
| Key figures | 22 | 8 | 1 | 3 |
| Analysis | 13 | 15 | 7 | 0 |
| Profitability | 13 | 16 | 6 | 0 |

"Later" items are listed in the inventory with the table or column they need; none is on the page.

## Open decisions

See `metric-inventory.md` §5 (10 decisions, each with a default). The ones that change scope: (1) sparklines vs kpi-card-v2, (3) the 810 px one-window rule for Analysis and Profitability, (5) re-adding Budget / Actual / vs PY columns to the variances table (query cost), (7) constant-currency default per view.

## Once approved

All three tracks implement **the same layout, metric list and design**: Track A (Rayfin app, fin), Track B (Power BI PBIP, bip — model measures first, then PBIR), Track C (JS report, spec note via `.sync/` for the vosk.dev agent). The inventory's "buildable now" rows become bip's measure list (new `dim_kpi` rows, a `param_kpi_threshold` table, `dim_profit_step` / `dim_prof_step`, the CC-subtotal bridge step, month-grain trend measure); parity rules (`docs/design/parity-rules.md`) and the spec §10 tests gate each track. Changes to ADR-0007 §3a (kpi-card-v2), ADR-0004 (one window) and the Requirements §5 tile table are ADR-worthy and need the USER's confirmation before any build.

## Verification done

Rendered headless (Chromium via Playwright) on 2026-10-26: no console or page errors; the extracted script passes `node --check`; no empty panels; no horizontal overflow in any card, panel or tile; frame heights Key figures 801 px · Analysis 1,749 px · Profitability 1,384 px. Not verified: real fonts on a machine without IBM Plex (falls back to Segoe UI), and the numbers themselves — they are illustrative, not model output.
