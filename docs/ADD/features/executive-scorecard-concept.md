# Executive KPI Scorecard - design concept

> **SUPERSEDED 2026-10-24** by the Consumer Goods Reseller executive dashboard (`docs/design/executive dashboard (reseller)/`); kept for reference.

**DRAFT — projection state (design concept for USER approval; nothing built).** Date 2026-10-24. Input: `docs/specs/2026-10-24-executive-kpi-scorecard-spec.md` (the USER's spec, kept verbatim). Mockups: `docs/design/executive scorecard/mockup-light.html` (recommended) and `mockup-dark.html`. House system: `docs/design/design-requirements.md`, `kpi-card-v2.md`, `parity-rules.md`, `period-picker-v2.md`, ADR-0004, ADR-0007. Third showcase report, delivered later in Tracks A (Fabric App), B (Power BI) and C (custom JS). All figures in this document and in the mockups are illustrative.

---

## 1. Design intent and Style Brief

The scorecard answers one question for the leadership team each morning: which committed numbers are off track, by how much, and who owns the fix. It is a reading surface, not an exploration tool. It will be screenshotted, projected and embedded at 1280 px on vosk.dev, so it has to look like a flagship product page and still be read in under a minute.

**Style Brief** (design-styles):

```
SUBJECT  Executive KPI scorecard for a leadership team (CEO, CFO, CRO, COO, CCO); purpose inform; lifespan system (3 tracks, same page)
STYLE    G1 Swiss / International + modifier G14 Bento (fixed modular tile grid) · mood calm, precise, authoritative · build HTML/CSS (A, C), PBIR theme + native visuals (B)
PALETTE  bg #F2F4F7 surface #FFFFFF ink #101B2B muted #4F5C6C accent #3B4A5E (Group graphite) · status good #06603F / watch #8A5A00 / off #B3261E · checks PASS (fills #3BA37B #D9A21B #D9534F FILL-ONLY)
TYPE     display IBM Plex Sans 600 · text IBM Plex Sans 400/500 · scale 12/13/14/17/22/28/34 (≈1.2) · tabular lining numerals · subsets latin · fallback Segoe UI
CANVAS   1440×810 px (16:9) · grid 8 px base / 12 cols × 96 + 16 gutter / 24 margin · stroke 1 px rules, 1.5 px sparklines · composition: status sentence → north star → 3 domain rows, focal point = north-star value
```

**Principles (non-negotiable in every track)**

1. **Zero clicks to read the headline.** The status sentence, the north-star value and every tile's status are visible on open; no hover, no scroll, no slicer needed.
2. **Status never by colour alone.** Every state carries a glyph and a word (`▲ On track`, `● Watch`, `▼ Off track`, `○ Not available`, `⏱ Stale`), a coloured left edge on the tile, and the signed Δ text (N-07, N-08).
3. **≤ 20 tiles.** Default 14 KPIs on the page (north star + full-year outlook + 12 domain tiles); the bench is switched on in the `kpi_catalog` table, never by adding visuals.
4. **Read in under a minute.** Worst first in each row, one sentence naming the off-track KPIs, one number per tile at 28–34 px.
5. **Dense but calm.** One accent (Group graphite), three status hues, grey sparklines, no chart junk (no axes on sparklines, no gradients, one legend line).
6. **Presentational quality.** 8 px grid, tabular figures, U+2212 minus, `+` on favourable deltas, " - " separators (parity rule 6), a typographic hierarchy of four sizes and two weights per tile.

---

## 2. Two design directions

Both directions share the layout of §3, the tile anatomy, the status model and the type scale; they differ in surface, elevation and palette. Both were contrast-checked by script (every text pair ≥ 4.5:1 on every surface it sits on; status fills are fill-only and always paired with the text-colour glyph).

### Direction A - "Ledger Executive" (light) - **recommended**

| Aspect | Spec |
|---|---|
| Rationale | An evolution of the Ledger P&L system: same rail, page top, tabs, frame tokens, type and radii, so the three showcase reports read as one product family and every page-top component already built in Tracks A and B is reused as is. The scorecard adds exactly one thing to the system: a third meaning colour for Off track. |
| Palette | Ground `#F2F4F7` · Surface `#FFFFFF` · Subtle `#F6F8FA` · Ink 900 `#101B2B` (17.3:1) · Slate 600 `#4F5C6C` (6.8:1) · Line 300/200/100 `#CDD4DC` `#DEE3E9` `#EDF0F3` · accent Group graphite `#3B4A5E` (9.0:1), tint `#EAEDF1` · identity colours only inside the detail decomposition (Products blue `#2453A6`, Cloud violet `#6B48C8`) |
| Status colours | On track text `#06603F` (7.6:1), fill `#3BA37B`, tint `#E4F3EC` · Watch text `#8A5A00` (5.9:1), fill `#D9A21B`, tint `#FBF4E4`, border `#EBD9AE` (= house notice colours) · Off track text `#B3261E` (6.5:1), fill `#D9534F`, tint `#FBE9E7` · Not available Slate 600 on Subtle, dashed border |
| Typography | IBM Plex Sans; fallback Segoe UI / Segoe UI Semibold in Power BI. Title 22/600 · tabs 15 · tile label 13/500 Slate 600 · tile value 28/600 (north star 34/600) · Δ line 13/600 · target line 12/400 · note 12 italic · eyebrow 11/600 uppercase +0.08 em · status pill 11/600 |
| Surface | Flat, as the house: white tiles, 1 px Line 200 border, radius 12, no shadows (only flyouts have one). A 3 px status-coloured inset edge at the tile's left is the one new surface element. Hover: border turns accent, tile lifts 1 px (A/C only). |
| Tile anatomy | §3.3. |
| Motion (A/C) | 150 ms ease on hover border/lift; Δ line cross-fades on comparator change; sparklines draw once on load (no looping animation); `prefers-reduced-motion` disables all. |
| Relation to Ledger | Same system, new page: the P&L's favourable/unfavourable pair (green/orange) is **replaced on this page** by the three-state status set (green/amber/red), because a scorecard needs three distinguishable states and orange-vs-amber would not be. Green stays the house green; Watch reuses the house notice amber; Off-track red is new and is used nowhere in the P&L. |

### Direction B - "Boardroom" (dark, high-contrast presentational)

| Aspect | Spec |
|---|---|
| Rationale | A deliberately distinct executive skin for projection and demo screenshots: near-black ground, raised tiles, luminous status colours, the same type scale and the same meaning hues shifted to pass on dark surfaces. Shares markup and layout 1:1 with A (the mockup is the same file with one attribute switched), so it can ship later as a presentation toggle without a second layout. |
| Palette | Ground `#0B111A` · Surface `#121A26` · Raised `#182230` · Ink `#EEF2F7` (15.5:1) · Muted `#A4B1C2` (8.0:1) · Line 300/200/100 `#2E3B50` `#243042` `#1C2636` · accent steel `#9FB4D0` (8.3:1), tint `#1E2A3B` · rail `#070C14` |
| Status colours | On track `#5FCB9A` (8.7:1), tint `#163327` · Watch `#E8B64A` (9.3:1), tint `#3A2E12`, border `#6A5420` · Off track `#FF8077` (7.2:1), tint `#3B1C1C` · fills unchanged from A so bars/edges match the light file in print |
| Typography | Identical scale; weights unchanged (no thin weights on dark). |
| Surface | Soft elevation: raised tiles with a 1 px inner highlight (`rgba(255,255,255,.05)`) and a 24 px low-opacity shadow; sparkline grey `#5E6E85` (3.5:1 on the raised surface, fill-only) so the trend recedes and the status point leads. |
| Motion (A/C) | As A. |
| Relation to Ledger | Distinct skin, shared bones: tokens are a second `data-theme` block; the P&L would not get this skin unless asked. |

### Recommendation: **Direction A (light)**, for four reasons

1. **Feasibility in Power BI.** Native card visuals, tooltips, slicer pop-ups, the filter pane and PDF/subscription export all default to light; a dark theme JSON covers the canvas and visuals but not every system surface (tooltip chrome, slicer dropdowns, export headers), so B would carry visible seams in Track B.
2. **Board pack and print.** The Letter export is the same design system in greyscale; A prints as is, B needs an inverted print variant.
3. **Projector and embed.** On a washed-out projector and inside a white vosk.dev page, a light page with a dark rail keeps its contrast; a dark page in a light host page looks like an iframe.
4. **Parity.** A reuses the shared page top of ADR-0004 / period-picker-v2 Part 2 unchanged in every track.

B is kept as the **presentation mode** candidate for Tracks A and C (one toggle in the Display flyout; open question 9) and as the screenshot skin for the vosk.dev hero.

---

## 3. Layout spec (Direction A)

Artboard **1440 × 810** (the house artboard; every value below is used 1:1 in Tracks A/B/C). At **1920 × 1080** the page scales by 4/3 (Fit to page in Track B; CSS transform or fluid grid in A/C): tiles 392 × 181, sparklines 160 × 48 (the spec's size), value 37 px. Nothing reflows between the two sizes.

### 3.1 Zones

```
x: 0   64  88                                                         1416 1440
   ┌───┬──────────────────────────────────────────────────────────────────┐
   │A▾ │ Executive scorecard [⏷]       ACME Group - Executive scorecard - │ title row   y 0–72
   │── │                                Closed through Sep 2026 - Refreshed │
   │▦  │ [Scorecard][KPI detail][Board pack]  Period [Month|QTD|YTD|R12M]  │ tabs row    y 72–121
   │▥  │                                Compare with [Budget|Prior year|FC] │ rule        y 122
   │⚙  ├──────────────────────────────────────────────────────────────────┤
   │   │ STATUS BAR  pills · sentence · legend                            │ y 136–172 (36)
   │   │ NORTH STAR 880 × 136              │ FULL-YEAR OUTLOOK 432 × 136  │ y 184–320
   │   │ FINANCE  88 │ tile │ tile │ tile │ tile  (294 × 136, gap 16)     │ y 332–468
   │   │ GROWTH   88 │ tile │ tile │ tile │ tile                          │ y 480–616
   │   │ OPS&PPL  88 │ tile │ tile │ tile │ tile                          │ y 628–764
   │ » │ FOOTER  illustrative · units · Definitions · Owners · Board export│ y 772–794 (22)
   └───┴──────────────────────────────────────────────────────────────────┘
```

| Zone | Size / position | Content |
|---|---|---|
| Rail | 64 px, Ink 900, full height | Brand mark 36 × 36 in the company colour = entity picker (Group / Products / Cloud, exactly as the P&L, F-01); items Period · Comparator · Display (3 flyouts, 352 px, house pattern); expand ». |
| Title row | y 0–72, white, padding 0 24 | "Executive scorecard" 22/600 · applied-filters funnel button 32 × 32 · right-aligned status line 13: `<Company> - Executive scorecard - Closed through <Mon YYYY> - Refreshed <d Mon YYYY HH:MM>`. |
| Tabs row | y 72–121 | Tabs **Scorecard · KPI detail · Board pack** (48 high, icon 18, selected = 3 px accent underline). View toolbar right: `Period` segmented control Month / QTD / YTD / R12M and `Compare with` Budget / Prior year / Forecast (36 high, house segmented style). |
| Status bar | y 136, h 36 | Four count pills (22 high, radius 12, tinted: `▲ 5 on track` `● 5 watch` `▼ 3 off track` `○ 1 not available`) · a 1 px rule · the dynamic sentence `Off track: Pipeline coverage 2.1× (−30%) - Full-year outlook −2.3% - OTIF 92.1% (−2.9 pp)` (off-track KPIs ordered by variance, "Off track:" in the red text colour) · right legend `Worst first in each row  ▲ on track ● watch ▼ off track`. |
| North star | x 88, y 184, 880 × 136 | §3.4. |
| Full-year outlook | x 984, y 184, 432 × 136 | §3.4. |
| Domain rows | y 332 / 480 / 628, h 136, gap 12 | Label column 88 px (eyebrow 11/600 uppercase + 3 lines 12: counts per state, owners) then 4 tiles 294 × 136 with 16 px gaps (x 192, 502, 812, 1122). |
| Footer | y 772, h 22, top rule Line 200 | Left: "Illustrative data - FY2026 YTD Sep - USD millions at actual rates - status vs budget unless the KPI names a target". Right links: Definitions · Owners · Board export. |

Content padding 14 / 24 / 16 (house). Everything sits on 4 px; all heights, gaps and x positions above are multiples of 4 and the row rhythm is 136 + 12.

### 3.2 Sort rule

Within each domain row tiles are ordered **worst first**: Off track → Watch → On track → Not available, then by direction-adjusted Δ % ascending (most negative first) inside a state. Stale does not change the order (it is an overlay on a state). The north-star and outlook tiles are fixed. The sort is data-driven in A and C; see §6 for Track B.

### 3.3 Tile anatomy (294 × 136, padding 12 / 16 / 12 / 18; left inset edge 3 px in the status fill)

```
┌─▌Adj. EBITDA - margin 19.1%                       [● Watch]  │ 20 px  label 13/500 Slate 600, unit/sub in Slate 400; pill right
│ ▌$760.4 m                      ╭╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌● │ 36 px  value 28/600 (unit 14/500 muted); sparkline 120 × 36 right
│ ▌−$23.2m (−3.0%) vs budget                                   │ 18 px  Δ line 13/600 in the status text colour, signed, U+2212
│ ▌Target $783.6m - Pace 97.0% - margin −0.2 pp                │ 16 px  target / pace line 12 Slate 600
│ ▌Tariffs 2.8 pp of NR in Products; media cut holds…     (CF) │ 18 px  note 12 italic, truncated at 60 chars (full in tooltip); owner chip 20 × 20
└──────────────────────────────────────────────────────────────┘
```

| Element | Spec |
|---|---|
| Label | KPI name 13/500 Slate 600; the period or sub-metric after " - " in Slate 400 (`- margin 19.1%`, `- Q4 FY26`, `- R12M`). Tooltip = definition text from `kpi_catalog`. |
| Value | 28/600 tabular, letter-spacing −0.015 em; unit (m, %, ×, pts, m units) 14/500 muted; format string from `kpi_catalog.format_string`. 34/600 on the north star. |
| Δ line | `<signed Δ abs> (<signed Δ %>) vs <comparator>` 13/600, colour = status text colour (one hue per tile; the sign carries the direction). pp for percentage KPIs, pts for scores, × for ratios. |
| Target / pace line | 12 Slate 600: `Target … - Pace … - <tolerance or secondary>`; stock KPIs show the policy line instead of pace. |
| Status glyph | In the pill (20 high, 11/600, tint background): `▲ On track` `● Watch` `▼ Off track` `○ Not available`; the same glyph colours the sparkline's last point and the left edge. |
| Sparkline | 13 periods (monthly; quarterly waves for survey KPIs, said in the target line), 120 × 36 at 1440 (160 × 48 at 1920), 1.5 px Slate 400 line, 10 % area fill, dotted target line in Slate 600, last point 6 px in the status colour with a 2 px surface ring. No axes, no labels. |
| Owner | 20 px circle, accent tint, initials 10/600 in the accent (CF, CR, CC, CO, CH); tooltip = role and name. |
| Note | Owner's latest note from `kpi_note`, 12 italic Slate 600, one line, ellipsis at 60 characters, full text in the tooltip. |
| **Not available** | Subtle fill, dashed Line 300 border, grey edge, value `—` 28/500 Slate 400, Δ line `No data since 12 Sep 2026`, target line keeps the plan value and the reason, sparkline replaced by a dashed baseline. Excluded from the status counts (said in the target line). |
| **Stale** | Keeps its status; border turns `#EBD9AE`, a tag `⏱ Stale - 2 Jul` (11/500, notice colours) sits between label and pill; tooltip explains the cadence miss. Feeds the data-quality KPI. |

### 3.4 North star and full-year outlook

**North star (880 × 136)**, three columns 292 / fluid / 176: label `Net revenue - YTD Sep 2026`; value 34/600; Δ line 14/600; target line (`Target $4,045.4m - Pace 98.2% - tolerance −3%`) · centre: caption "Monthly net revenue, 13 months, USD m" with a two-item legend, then a 13-column chart 392 × 78 (bars in the accent at 78 % opacity, the four prior-year-side months in Slate 400, the current month solid, dotted budget line, month initials under each bar) · right: large status pill, the owner's note (3 lines), owner chip + cadence. The whole tile is the click target for the detail view.

**Full-year outlook (432 × 136)**: label `Full-year outlook vs budget - FY2026`, pill; value `$5,737.2 m latest estimate` 28/600; **bullet bar** 14 px: track Line 100 = FY budget (100 %), YTD actual solid accent (67.7 %), forecast Oct–Dec hatched accent (to 97.7 %), ticks for prior year (Slate 400) and budget (Ink 900, at 100 %); caption line 11 with the four figures; Δ line `−$132.1m (−2.3%) vs FY budget - tolerance −2%`.

### 3.5 Interaction

| Action | Behaviour |
|---|---|
| Tile click / Enter | Opens **KPI detail** as the second tab in the same window (ADR-0004 pattern: the content area swaps; header, rail and toolbar stay). The KPI is pre-selected; ‹ Scorecard or Escape returns. |
| Comparator (Budget / Prior year / Forecast) | Swaps the Δ line on every tile and the comparator series in the detail view. **Status does not change**: it is always measured against the KPI's target source (`kpi_catalog.target_source`), so the status counts and the sentence stay stable while the reader compares. |
| Period mode (Month / QTD / YTD / R12M) | Changes the window of flow KPIs; stock KPIs (cash, ARR, headcount) always show the last snapshot in the window and say so in the label. Default YTD at the last closed month. The Period flyout on the rail holds year and month (period-picker-v2). |
| Entity picker (brand mark) | Group / Consumer Products / Commerce Cloud, as the P&L (F-01, F-31). KPIs that do not apply to the entity (ARR for Products, OTIF for Cloud) are hidden by `kpi_catalog.applies` and the row re-sorts; the page keeps 3 rows × ≤ 4 tiles. |
| Funnel | Applied-filters pop-up (period sentence, entity, comparator, currency, units, data notices), as Track B's `grp_info_filters`. |
| Reset | "Back to default" in each flyout; a Reset bookmark in Track B. |

### 3.6 KPI detail view (same window)

```
‹ Scorecard   Net revenue - YTD Sep 2026 [● Watch]                       (CF) CFO  [Open P&L report ↗]
              definition, translation rule, target source and tolerance (2 lines, 12 Slate 600)
┌ 36-month trend 880 × ~300 ───────────────────────────┐ ┌ By entity 432 × ~300 ───────────────┐
│ actual (accent 2 px) · forecast 9+3 (dashed) ·       │ │ Consumer Products  ████████  3,398.5 │
│ budget 2026 (dotted) · prior year shifted (Slate 400)│ │ Commerce Cloud     ██         596.0  │
│ y grid 400/500/600 · year ticks · current point      │ │ Eliminations       ▏          −21.8  │
└───────────────────────────────────────────────────────┘ └ Group total + Δ ─────────────────────┘
┌ Variance bridge 640 × ~230 ──────────────────────────┐ ┌ Largest contributors 672 × ~230 ────┐
│ Budget → Volume & mix → Price → FX → Cloud → Elim → Actual (totals accent, decreases Off fill) │ │ 6 rows: slice · diverging bar · Δ · Δ % │
└───────────────────────────────────────────────────────┘ └──────────────────────────────────────┘
```

Decomposition uses the KPI's primary dimension from `kpi_catalog.drill_dimension` (entity for Group KPIs, channel / service line for sales KPIs, region for OTIF). The bridge appears only for additive KPIs (`is_additive`); ratio KPIs show numerator and denominator trends instead. The link button opens the domain report (the P&L for finance KPIs, the Sales dashboard for sales KPIs) in the same vosk.dev host.

### 3.7 Board export page and phone layout (brief)

- **Board pack** (third tab in the mockup; a hidden Letter page in Track B): Letter portrait, 28 px margins, title + status line, a table of every active KPI grouped by domain (KPI, Actual, Target, Δ, Δ %, PY, Status with glyph, Owner), footnote with the status rule; page 2 = north-star trend + owner notes. Values frozen from `kpi_history` at month-end lock. Greyscale-safe by construction (glyph column).
- **Phone** (≤ 480 px, Tracks A/C; Track B mobile layout): status pills wrap to two lines, the sentence below; north star full width (value 28, chart hidden, bullet kept); domain rows become two tiles per row in the same sort order, 160 px high, sparklines off, notes in the tooltip; font floor 12 px; the toolbar collapses into the Period and Comparator flyouts.

---

## 4. KPI set for ACME

ACME Group is a SaaS (Commerce Cloud) + consumer goods (Consumer Products) group, so the default set takes the spec's ★ KPIs for both company types plus the full-year outlook as the north-star companion. Sources: **P&L** = measures of the existing `ACME Unified PnL` model (`fact_pl`, `fact_operational`, `dim_account`); **sales** = the Sales & Revenue dataset being designed in parallel ("from the sales model"); **kpi_history** = small synthetic tables (§4.2). Values are the mockup's illustrative FY2026 YTD Sep figures; the ones marked † come from `control_totals_usd.csv` / `fact_operational`.

| # | Domain | KPI (key) | Source | Target source | Tolerance | Dir. | Owner | Mock value → status |
|---|---|---|---|---|---|---|---|---|
| 1 ★ | North star | Net revenue, period (`NET_REV`) | P&L `NR` line (`dim_report_line`), Group = P + S − IC | Budget | −3 % to 0 | ↑ | CF | $3,972.7m† vs 4,045.4† → −1.8 % → **Watch** |
| 8 | North star | Full-year outlook vs budget (`FY_OUTLOOK`) | P&L: Latest estimate FY (C-02) vs FY budget | Budget | −2 % | ↑ | CF | $5,737.2m† vs 5,869.3† → −2.3 % → **Off track** |
| 4 ★ | Finance | Adj. EBITDA & margin (`EBITDA`) | P&L `EBITDA`, `EBITDA_PCT` | Budget | −5 % abs / −1 pp | ↑ | CF | $760.4m† (19.1 %) vs 783.6† → −3.0 % → **Watch** |
| 3 ★ | Finance | Gross margin % (`GM_PCT`) | P&L `GM_PCT` | Budget | −1 pp | ↑ | CF | 50.1 %† vs 50.5 %† → −0.4 pp → **Watch** |
| 5 | Finance | OpEx vs budget % (`OPEX_PCT`) | P&L `OPEX` actual ÷ budget | 100 % | 100–103 % | ↓ | CF | 96.7 %† → **On track** |
| 6 ★ | Finance | Cash balance & runway (`CASH`) | `kpi_history` (synthetic month-end cash; runway n/a while cash-generative) | Table (policy min $350m) | 12–18 m runway / $ floor | ↑ | CF | $412.6m → +17.9 % → **On track** |
| 10 ★ | Growth | Pipeline coverage × next quarter (`PIPE_COV`) | **from the sales model** (open pipeline ÷ next-quarter quota) | Fixed 3.0× | 2.5–3.0× | ↑ | CR | 2.1× → −30 % → **Off track** |
| 16 ★ | Growth | Net revenue retention % (`NRR`) | **from the sales model** (cohort ARR); fallback `kpi_history` | Fixed 105 % | 100–105 % | ↑ | CC | 103.4 % → −1.6 pp → **Watch** |
| 9 ★ | Growth | Bookings vs quota % (`BOOKINGS`) | **from the sales model** (closed-won ÷ quota) | Quota (table) | 90–100 % | ↑ | CR | 101.2 % → **On track** |
| 15 ★ | Growth | Ending ARR & net new ARR (`ARR`) | P&L proxy: Commerce Cloud subscription revenue of the last month × 12 (`GR_S1`), net new = Δ month on month; replace by the sales model's ARR snapshot when it exists | Budget | −3 % | ↑ | CR | $324.6m, +$6.1m → +2.1 % → **On track** |
| 22 ★ | Ops & people | OTIF % (`OTIF`) | `kpi_history` (synthetic monthly, Products) | Fixed ≥ 95 % | 93–95 % | ↑ | CO | 92.1 % → −2.9 pp → **Off track** |
| 19 | Ops & people | NPS (`NPS`) | `kpi_history` (synthetic quarterly waves) | Table 40 | −5 pts | ↑ | CC | 38 → −2 → **Watch**, **Stale** (wave of 2 Jul older than the quarterly cadence) |
| 13 ★ | Ops & people | Net sales volume & net price (`VOLUME`) | P&L `fact_operational.units_sold` (419.8 m YTD†), price = `NR` ÷ units | Budget (`fact_operational` BUD rows) | −3 % | ↑ | CC | 419.8 m units → +0.6 % → **On track** |
| 28 ★ | Ops & people | Headcount vs plan & cost per FTE (`HEADCOUNT`) | `kpi_history` (synthetic HRIS snapshot) + P&L people cost | Plan (table) | ±3 % | context | CH | **Not available** (feed failed 13 Sep) |

**Bench** (rows present in `kpi_catalog`, `is_active = FALSE`, switched on per entity or client): Revenue pace % (2, P&L), DSO (7, kpi_history), Forecast commit vs quota (11, sales), Win rate (12, sales), Gross-to-net % (14, P&L `GTN` ÷ `GR`), GRR / logo churn (17, sales), CAC payback (18, sales + P&L `SM`), Market share (20, kpi_history), Top-10 concentration (21, sales), Inventory days (23, kpi_history + P&L `COR`), Forecast accuracy (24, kpi_history vs `fact_operational`), Uptime (25), Support backlog (26), Weekly active accounts (27, `fact_operational.active_merchants_end` as the proxy), Regretted attrition (29, kpi_history), Revenue per FTE (30, P&L + kpi_history), Rule of 40 (31, ARR growth + EBITDA margin), Burn multiple (32), Data-quality score (33, computed from `kpi_history.loaded_at` vs cadence).

Mapping notes against the P&L data: `dim_account` has D&A (`DA_*`), tax (`TAX_*`), financing (`FIN_*`) and investing income (`INV_2` "Income on cash & investments") but **no balance-sheet cash**, so cash and runway are synthetic; `fact_operational` carries `units_sold`, `gmv_local` and `active_merchants_end` (month-end count, never summed), nothing on orders, customers, subscribers or headcount, so those come from the sales model or `kpi_history`. Revenue pace uses `dim_month` elapsed share (calendar days) until a selling-day calendar exists.

### 4.2 Shared data contract (all three tracks)

Four small tables, loaded from CSV under `data/acme_kpi_scorecard/` into `lh_raw.acme_kpi` (ginee, no Spark), imported by the Track B model, read through the semantic model in Track A, pre-aggregated to Parquet in Track C. The P&L and sales measures stay in their own models; these tables hold only metadata, overrides, notes and snapshots.

**`kpi_catalog`** - one row per KPI (grain: `kpi_key`)

| Column | Type | Notes |
|---|---|---|
| `kpi_key` | text PK | `NET_REV`, `GM_PCT`, … stable; a definition change = new key + `retired_on` on the old row |
| `domain_code`, `domain_name`, `domain_sort` | text, text, int | NORTH_STAR, FINANCE, GROWTH, OPS_PEOPLE |
| `kpi_name`, `kpi_short_name` | text | tile label, board-pack label |
| `definition` | text | tooltip and detail header |
| `source_model` | text | `PL` / `SALES` / `KPI_HISTORY` |
| `measure_name` | text | the dispatcher branch (`[Net Revenue]`, `[KPI Hist Value]`) |
| `applies` | text | `S` / `C` / `B`; drives the entity filter |
| `entity_scope` | text | `GROUP`, `P`, `S` or `ALL` |
| `is_active`, `is_north_star` | bool | |
| `sort_order` | int | fallback order when two tiles tie |
| `direction` | int | +1 higher is better, −1 lower is better, 0 context |
| `target_source` | text | `BUDGET` / `PY` / `FIXED` / `TABLE` / `QUOTA` |
| `fixed_target` | decimal | when `FIXED` |
| `tolerance_low`, `tolerance_high` | decimal | Watch band in the KPI's own unit (% or pp or ×) |
| `tolerance_unit` | text | `PCT` / `PP` / `ABS` |
| `is_flow`, `is_stock`, `is_additive` | bool | pace, last-snapshot and bridge eligibility |
| `format_string` | text | `$#,##0.0,,"m"`-free: units handled by the display measure; e.g. `#,0.0`, `0.0%`, `0.0"×"` |
| `unit_label` | text | `m`, `%`, `×`, `pts`, `m units` |
| `period_basis` | text | `MONTH,QTD,YTD` etc. |
| `cadence`, `stale_after_hours` | text, int | |
| `owner_code`, `owner_role`, `owner_name` | text | `CF`, CFO, … |
| `drill_dimension`, `drill_report` | text | `ENTITY`, `CHANNEL`, … / `PNL`, `SALES`, `OPS` |
| `retired_on` | date | null while active |

**`kpi_target`** - overrides and table targets (grain: `kpi_key × period_start × entity_code`)

| Column | Type |
|---|---|
| `kpi_key` FK, `period_start` date (first day of month), `entity_code` text (`GROUP`, `P`, `S`), `target_value` decimal, `target_type` text (`TARGET` / `QUOTA` / `POLICY_MIN` / `PLAN`), `valid_from` date, `note` text |

**`kpi_note`** - owner comments (grain: `kpi_key × period_start × author_code × written_at`)

| Column | Type |
|---|---|
| `kpi_key` FK, `period_start` date, `entity_code` text, `author_code` text (= owner_code), `written_at` datetime, `note` text (≤ 280 chars; tile shows 60), `is_latest` bool (derived on load) |

**`kpi_history`** - synthetic actuals for non-P&L KPIs and month-end snapshots for the board pack (grain: `kpi_key × period_start × entity_code × snapshot_kind`)

| Column | Type |
|---|---|
| `kpi_key` FK, `period_start` date, `entity_code` text, `snapshot_kind` text (`ACTUAL` live value / `LOCKED` month-end snapshot), `actual_value` decimal, `target_value` decimal (as locked), `py_value` decimal, `loaded_at` datetime (feeds Stale and the data-quality KPI), `source_ref` text |

Row counts: catalog 33, target ≈ 33 × 36 × 3 at most (only TABLE/QUOTA rows needed, ≈ 600), notes ≈ 100, history ≈ 12 KPIs × 36 months × 3 entities ≈ 1,300. Everything stays diff-reviewable CSV.

### 4.3 Measure pattern (survives in every track)

Track B holds the pattern in DAX; Track A runs the same measures through its DAX connector (`ConnectorsRayfinClient`, ADR-0006) and Track C re-implements the four functions in TypeScript over the same four tables plus the P&L engine (ADR-0002). Outline (house DAX style):

```dax
KPI Actual =
VAR _key          = SELECTEDVALUE ( kpi_catalog[kpi_key] )
VAR _result       =
    SWITCH (
        _key
        ,"NET_REV"
            ,[Net Revenue]
        ,"GM_PCT"
            ,[Gross Margin %]
        ,"EBITDA"
            ,[Adj EBITDA]
        ,"OPEX_PCT"
            ,DIVIDE ( [Opex], [Opex Budget] )
        ,"VOLUME"
            ,[Units Sold]
        ,"ARR"
            ,[Subscription Revenue Last Month] * 12
        ,[KPI Hist Value]
    )
RETURN
    _result
```

```dax
KPI Status =
VAR _actual       = [KPI Actual]
VAR _delta_pct    = [KPI Δ %]
VAR _tol          = SELECTEDVALUE ( kpi_catalog[tolerance_low] )
VAR _result       =
    SWITCH (
        TRUE ()
        ,ISBLANK ( _actual )
            ,"N/A"
        ,_delta_pct >= 0
            ,"On track"
        ,_delta_pct >= - _tol
            ,"Watch"
        ,"Off track"
    )
RETURN
    _result
```

`KPI Target` resolves `target_source` (budget measure via the P&L's version switch, PY via the C-04 shift, `fixed_target`, or a `kpi_target` lookup for the visible period and entity); `KPI Δ = ( [KPI Actual] − [KPI Target] ) × kpi_catalog[direction]`; `KPI Δ %` divides by `ABS ( [KPI Target] )` or reports pp when `tolerance_unit = "PP"`; `KPI Pace %` applies the elapsed share from `dim_month` for `is_flow` KPIs; `KPI Stale = NOW () − MAX ( kpi_history[loaded_at] ) > stale_after_hours`; `KPI Status Colour` returns the theme names `good` / `neutral` / `bad` for conditional formatting; `KPI Sentence` concatenates the off-track KPIs ordered by `[KPI Δ %]`. The comparator (Budget / PY / Forecast) only feeds `KPI Δ (comparator)`, never `KPI Status`.

---

## 5. Tri-track feasibility matrix

A = Fabric App (React), B = Power BI (native visuals only, PBIR), C = Next.js. **native** = as designed · **workaround** = built differently, same reading · **not possible** = a visible deviation.

| Design element | A | B | C | Track B notes |
|---|---|---|---|---|
| Shared page top (rail, title, status line, funnel, tabs) | native (exists) | native (exists) | native (exists) | Reuse `grp_rail_*`, `hdr_status`, `grp_info_filters`; two more tabs. |
| 1440 × 810 fixed artboard, 1920 scaling | native (CSS) | native (Fit to page) | native | |
| Tile = label, value, Δ, target line, note, owner | native | **native** - new Card visual: label, callout value, up to 3 reference labels (Δ line, target line, note) with per-label fx colours; owner initials as a 4th reference label or in the label | native | One card per tile (as Key figures), bound to `kpi_catalog[kpi_key]`. Reference-label font sizes are capped by the visual: expect 9–10 pt for the three lines, 21–24 pt for the value. |
| Status pill with glyph + word | native | **workaround** - the glyph + word is a reference label (`▼ Off track`) with fx colour and a tinted background is not available per label; use a small coloured shape behind it or accept text-only pill | native | Colour from `KPI Status Colour`; the glyph is text, so never colour alone. |
| 3 px status edge on the tile | native | **workaround** - card visual has no per-side border colour; a 3 × 112 rectangle shape with fx fill behind each card (one scalar query each, 14 shapes) | native | Cheap: the shape reads one measure. |
| Sparkline 13 periods with dotted target and accent last point | native | **workaround** - two options: (a) the card visual's built-in **sparkline** (line only, one colour, no target line, no last-point accent; renders inside the card) or (b) an **SVG measure** image (full design, as `KPI Tile SVG` today, one extra image fx per tile). Recommend (b) for the north star and (a) for the 12 tiles, or (b) everywhere if render time stays inside N-01 | native | The SVG route is already proven in this repo (kpi-card-v2 image). 13 points × 14 tiles = 182 values per refresh; progressive rendering is not possible, so the values query must stay fast (ADR-0008 lesson). |
| North-star 13-column chart with budget line | native | **native** - clustered column + line combo is a dual-axis visual; use a **column chart** for actual with a **line** of budget on the same axis (same measure unit, one y-axis) or an SVG measure | native | One axis only (dataviz rule). |
| Full-year outlook bullet bar | native | **workaround** - stacked bar (YTD actual + forecast remainder) with a constant line for budget, or an SVG measure | native | SVG measure gives the hatched forecast segment; stacked bar does not hatch. |
| Dynamic status sentence | native | **native** - a card / text button bound to `KPI Sentence` (measure concatenating off-track KPIs ordered by variance) | native | A button ignores line breaks; the sentence is one line, so a measure-bound button or card both work. |
| Count pills (5 / 5 / 3 / 1) | native | native - four small cards with fx fill | native | |
| Sort worst first within a row | native | **workaround** - choose one: (1) **pre-sorted matrix**: one card per *slot* (as Key figures today) bound to a `kpi_slot` rank measure (`RANKX` on status severity then Δ %) that picks which KPI the slot shows - fully dynamic, same cost as today's slot pattern; (2) fixed positions per KPI and the status edge only - no re-sorting; (3) a field parameter is not a fit (it switches fields, not order). **Recommend (1)**. | native | Slot pattern is already built in Track B (`kpi_s01…s12` with literal code lists); the only change is the code list becoming a rank measure. Watch the SWITCH branch pruning. |
| Comparator toggle changes Δ lines, not status | native | native - button slicer on a disconnected comparator table; `KPI Δ (comparator)` reads it; status measure ignores it | native | |
| Period mode Month / QTD / YTD / R12M | native | native - reuse `param_time_view` (Month, QTD, YTD, LTM) | native | "R12M" = LTM; the label can be "R12M" via the Label role. |
| Entity picker on the brand mark | native | native (exists) | native | `applies` / `entity_scope` as a visual-level filter via a measure. |
| Tile click → detail view, same window | native | **workaround** - drillthrough to a hidden page (new tab in the page navigator rendered as the tabs row) or a bookmark swap of groups; drillthrough is the native way to pre-filter the KPI; the header must be duplicated on the hidden page | native | Keeps ADR-0004's one-window reading; the page navigator becomes the tabs row. |
| Detail: 36-month trend actual / budget / PY / forecast | native | native - line chart, four series on one axis | native | |
| Detail: decomposition bars with identity colours | native | native - bar chart with fx colour per entity | native | |
| Detail: variance bridge | native | native - waterfall (start bar green, known limitation) | native | |
| Detail: contributors table with diverging bars | native | native - table with data bars | native | |
| Not-available state (grey, dashed, "no data since") | native | **workaround** - fx fill Subtle on the card and the edge shape; dashed border not available (solid Line 300); text from the status measure | native | |
| Stale state (amber border + tag) | native | **workaround** - card border colour via fx (whole border, not a tag); the tag text as a reference label | native | |
| Owner initials chip | native | workaround - text reference label `CF` without the circle | native | |
| Board pack (Letter portrait) | print stylesheet | **native** - hidden Letter page, table visual, subscription to PDF | print stylesheet | Native export is Track B's strength here. |
| Phone layout | native (responsive) | native - mobile layout, cards stack | native | |
| Dark theme (Direction B) | native (tokens) | **workaround** - theme JSON covers canvas, visuals, text and card backgrounds; tooltips, slicer dropdowns and the filter pane keep system chrome; export inverts nothing | native (tokens) | Reason 1 for recommending A. |
| Fonts (IBM Plex Sans) | native (web font) | **not possible** - viewer-installed fonts only → Segoe UI / Segoe UI Semibold, sizes converted to pt (28 px ≈ 21 pt) | native (web font) | Same accepted deviation as the P&L. |
| Hover lift, Δ cross-fade | native | not possible (static) | native | Cosmetic only. |
| Sparkline per-row progressive load | native | not possible | native | Values and images come in one query per card. |
| Keyboard: Escape closes, tiles focusable | native | partial (bookmark navigation has no key handling) | native | Accepted platform difference (parity-rules). |

**Deviations each track would carry**

- **Track B:** Segoe UI; reference-label sizes smaller than the mockup; sparklines as SVG images (or the plainer built-in sparkline); status pill without a tinted background unless backed by a shape; status edge as a shape; no dashed border on Not-available; the detail view as a drillthrough page with a duplicated header; light theme only.
- **Track A:** none in the design; data-side, 13-period sparklines are 14 extra DAX query rows per load and must load after the values (ADR-0007 §3 lesson); the sales-model KPIs need a second connector or a composite model (ginee / fin decision, ADR).
- **Track C:** none in the design; the sales-model KPIs arrive as pre-aggregated Parquet with the same four tables; the status and sort logic is re-implemented in the engine and parity-tested against Track B's `tests/`.

---

## 6. Effort and order of work

| Step | Track | Effort | Depends on |
|---|---|---|---|
| 0. USER approves direction, KPI set, open questions | — | — | this document |
| 1. Data contract: `data/acme_kpi_scorecard/` CSVs (4 tables, generator script), load to `lh_raw.acme_kpi` | ginee | 1 day | step 0 |
| 2. Track B model: import the 4 tables, dispatcher / target / Δ / status / pace / stale / sentence / slot-rank measures, `tests/kpi-status.dax` (boundary tests, stale back-dating, reconciliation of each P&L-sourced KPI to the P&L measures) | bip | 2 days | step 1 |
| 3. Track B report: new report `pbi-report/ACME Executive Scorecard/` reusing the P&L page top; 14 cards + edge shapes + SVG sparklines, status bar, outlook bullet, toolbar; detail drillthrough page; Letter page; theme JSON with the status tokens | bip | 3–4 days | step 2 |
| 4. Track A: scorecard routes (`/scorecard`, `/scorecard/:kpi`), tiles and detail components with the Direction A tokens, DAX queries through the existing connector, parity fixtures | fin | 3 days | step 2 (measures published) |
| 5. Track C: Parquet build for the 4 tables + monthly KPI aggregates, engine functions (status, sort, pace, stale), pages, `.sync/` hand-off note | archi → nerd | 3 days | step 1 |
| 6. Parity + acceptance: hunter's selections file extended with scorecard selections (status counts, sentence, sort order, each KPI value) | hunter | 1 day | steps 3–5 |
| 7. Sales-model KPIs (pipeline, bookings, NRR) wired once that model exists; until then `kpi_history` rows carry them | ginee / bip | 1 day | the sales model |

Order: B first (it is the reference for copy and layout, parity rule), A and C in parallel after the measures are published. Total ≈ 2.5 weeks of agent work; the dark skin for A/C is +0.5 day after step 4/5 if approved.

---

## 7. Open questions for the USER (each with a recommended default)

1. **Direction** - A "Ledger Executive" (light) in all tracks, B "Boardroom" as a later toggle in A/C only? *Default: yes.*
2. **Status glyphs** - keep the spec's ▲ ● ▼ (status), although the P&L's ▲ ▼ mean direction of change (parity rule 15)? *Default: keep ▲ ● ▼ on the scorecard, with the legend saying "▲ on track ● watch ▼ off track"; the Δ line carries the sign, so no arrow is needed for direction.*
3. **Off-track red** - accept a new third meaning colour (`#B3261E`) on this page, while the P&L keeps green / orange? *Default: yes; document it in `design-requirements.md` as "scorecard status set".*
4. **North star** - Net revenue (as in the spec) rather than Adj. EBITDA or ARR? *Default: Net revenue, with the full-year outlook as its companion tile.*
5. **Default comparator** - Budget. *Default: Budget; status always vs the KPI's target source regardless of the comparator.*
6. **KPI set** - the 14 of §4 (12 domain tiles + north star + outlook), with Headcount shown Not available and NPS Stale in the mockup only? *Default: yes; in the built version those states appear only when the data says so.*
7. **Sales-model KPIs before that model exists** - carry pipeline coverage, bookings and NRR in `kpi_history` as synthetic values now, re-point later? *Default: yes.*
8. **Sort rule** - dynamic worst-first in every track (Track B via the slot-rank pattern) or fixed positions with the status edge only? *Default: dynamic in all three.*
9. **Sparklines in Track B** - SVG measure images (full design, proven, some query cost) or the card's built-in sparkline (plain line, cheaper)? *Default: SVG images, measured against N-01 (≤ 5 s per view); fall back to built-in if over.*
10. **Board pack** - PDF from a hidden Letter page in Track B on the first working day after close; print stylesheets in A/C? *Default: yes; PowerPoint not in scope.*
