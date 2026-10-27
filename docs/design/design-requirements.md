# Design requirements — "Ledger" P&L app (Tracks A + B)

Source of truth: `docs/design/P&L statement view/Main.dc.html` (interactive mockup, artboard 1440 × 810) and `Ledger colour palette@1x.png`. The mockup is a **reference**, not code: replicate its values (colours, sizes, spacing, radii, shadows, layout) in each track's own components. Where this doc and the mockup disagree, the mockup wins. Spec IDs refer to `docs/Requirements.md`.

Date: 2026-10-21 · Applies to: Track A (Rayfin app, `fabric-app/`) and Track B (PBIP, `pbi-report/`).

> **Superseded in parts by ADR-0007 (2026-10-22):** the company cards (entity switch moves to the rail brand mark), the statement toolbar (Layout / Cost lens / Detail → Expand all / Collapse all), and the KPI tiles (now `docs/design/kpi-card-v2.md`). Track B only (ADR-0007 §3a): no notice strip, the context line becomes an applied-filters pop-up, a right-aligned status line on the title row, and " - " separators. Where this guide and ADR-0007 disagree, ADR-0007 wins.

---

## 1. Principles
- **One window fits all** (ADR-0004): a single 16:9 screen; the view tabs swap the content area; nothing else moves.
- **One neutral frame, one identity colour per company, two fixed meaning colours.** Switching company swaps only the identity colour (`acc` / `accT`); layout never changes (L-10). Identity colour never means good or bad.
- **Variance meaning never relies on colour alone** (N-07): favourable/unfavourable always pair a colour with a sign and an arrow (▲ / ▼).
- Numbers: tabular figures, right-aligned, minus sign `−` (U+2212) for negatives, `+` on deltas (L-12, N-06).
- **Visual first, minimum text (USER directive 2026-10-27, all designs and all tracks):** every design artefact and report view is visual. No long bars or strips of text explaining numbers, no prose intros, no footnote paragraphs on the page. Card face = title · value · delta · status only. Explanations, formulas, sources and caveats live in pop-ups reached from an ⓘ button per card/panel and one "How to read" button per view. No tiny sparkline / mini-line charts inside cards (noise); real charts keep their space. Pop-ups and overlaying windows use the matte / frosted-glass style (translucent white, backdrop blur, 1 px light border, 16 px radius, solid fallback). Filters, slicers and switchers collapse into one side bar with a menu pop-up where the view has more than a handful of controls.

## 2. Colour tokens

### Neutral frame
| Token | Hex | Use |
|---|---|---|
| Ink 900 | `#101B2B` | Primary text, filter rail background |
| Ink 700 | `#2B3748` | Open rail item background, IFRS 18 tag |
| Slate 600 | `#4F5C6C` | Labels, secondary text, ratio rows (muted) |
| Slate 400 | `#8592A3` | Icons, disabled; text only on Ink 900 |
| Line 300 | `#CDD4DC` | Control borders, column-header rule |
| Line 200 | `#DEE3E9` | Panel and tile borders |
| Line 100 | `#EDF0F3` | Row rules, neutral pills, bar tracks |
| Ground | `#F2F4F7` | App background behind panels |
| Subtle | `#F6F8FA` | Subtotal rows, operational tiles, disabled controls |
| Surface | `#FFFFFF` | Panels, tables, header bar |
| Rail text | `#C9D3E0` (items), `#AEB9C7` (summaries), divider `#3A475A` | Filter rail only |
| Column-group rule | `#E3E8ED` | Vertical separators between column groups; sec/grp row rules |
| Subtotal rule | `#D5DCE3` | Top rule of subtotal / memo rows |

### Company identity (swaps with the company switch)
| Company | `acc` | `accT` (tint) | `keyRule` |
|---|---|---|---|
| Consumer Products — "Products blue" | `#2453A6` | `#E8EEF8` | `#B9C8E4` |
| Commerce Cloud — "Cloud violet" | `#6B48C8` | `#F0EBFB` | `#CFC2F0` |
| ACME Group — "Group graphite" | `#3B4A5E` | `#EAEDF1` | `#C5CCD5` |

Where `acc` appears: brand mark at the top of the rail · selected company card (border + 1px ring + tint) · active view-tab underline · selected toggle/segment (text `acc`, background `accT`) · selected chips · key subtotal rows (background `accT`, rule `keyRule`) · bridge total bars · share bars · CM bars · primary button in filter panels · switch "on" track.

### Meaning (fixed for every company)
| Meaning | Text | Bar / fill | Pill tint |
|---|---|---|---|
| Favourable | `#06603F` | `#3BA37B` | `#E4F3EC` |
| Unfavourable | `#C2410C` | `#E2804A` | `#FCEDE5` |
| Notice / forecast | `#8A5A00` (icon), text `#3D3216` | border `#EBD9AE` | `#FBF4E4` |
| Neutral pill | `#101B2B` | — | `#EDF0F3` |

Arrow shows direction; colour shows whether it helps. A cost rising above budget points ▲ and is orange.

## 3. Typography
- UI font: **IBM Plex Sans** (fallback `Segoe UI`, system-ui). Statement table: **IBM Plex Sans Condensed** (fallback IBM Plex Sans, `Arial Narrow`). Weights 400/500/600/700. Base 14 px / line-height 1.45.
- Tabular numerals everywhere numbers align.
- Scale: page title 22/600 · card title 17/600 · flyout title 16/600 · company name 15/600 · tab 15 (500, selected 600) · body 14 · secondary 13 · caption/labels 12 (group labels 12/600 Slate 600) · eyebrow 12/500 uppercase +0.06em · rail section label 11/600 uppercase +0.08em · tags 11/500 · KPI value 34/600 (financial), 28/600 (operational).
- Track B note: Power BI renders only fonts installed on the viewer's machine. If IBM Plex is not guaranteed, use **Segoe UI / Segoe UI Semibold** (the design's own fallback) and keep sizes and weights.

## 4. Shape, spacing, elevation
- Radii: panels/cards/tiles 12 · flyout 12 · company cards 10 · controls, buttons, notices 8 · chips/pills 20 / 12 · tags 4 · bar ends 2–3.
- Borders 1 px; header rule under column titles 2 px Ink 900; selected company card adds a 1 px `acc` ring.
- Flyout shadow `0 14px 36px rgba(16,27,43,0.20)`; nothing else has a shadow.
- Spacing: content padding 14/24/16 · card padding 16/20 · tile padding 16/18 (operational 14/18) · gaps 12 between tiles, 16 between cards, 18 between filter groups, 8 inside a group, 6 between chips/month buttons.
- Control heights: segmented/toggle 40 (toolbar segments 36) · chips min 40 · rail items min 48 · company cards min 52 · tabs min 48 · close button 40 × 40 · switch 44 × 26.

## 5. Layout (1440 × 810 reference, 16:9)

```
┌──────┬───────────────────────────────────────────────────────────────┐
│ RAIL │ HEADER (white, bottom rule Line 200)                          │
│ Ink  │  eyebrow · "Profit & loss" + context line   [3 company cards] │
│ 900  │  [P&L statement][Key figures][Analysis][Profitability]  [view │
│ 64px │                                                    toolbar]   │
│ (248 ├───────────────────────────────────────────────────────────────┤
│ wide)│ CONTENT (Ground #F2F4F7, padding 14/24/16, gap 12)            │
│      │  [notice strip — only when a notice applies]                  │
│      │  [active view]                                                │
└──────┴───────────────────────────────────────────────────────────────┘
```

### 5.1 Filter rail (replaces the old side bar)
- Width 64 collapsed (default) / 248 expanded; padding 12/10; gap 4; background Ink 900.
- Top: brand mark 36 × 36, radius 8, fill `acc`, white "A" 16/700; expanded adds "ACME P&L" 15/600 white + "Management reporting" 12 `#AEB9C7`.
- Section label "FILTERS" (expanded) or a 24 px divider `#3A475A` (collapsed).
- **Four groups** (was three): **Period** (calendar icon) · **Versions** (bar icon) · **Slice** (funnel icon) · **Display** (sliders icon). Item: min-height 48, radius 8, icon 20, gap 12; open item background Ink 700 + white text; expanded shows label 14/500 white + one-line summary 12 `#AEB9C7` (e.g. "YTD · Sep 2026", "Actual vs Budget, Prior year", "All slices", "USD m · actual rates").
- Icons: replicate the four 20 × 20 stroke icons from the mockup (stroke 1.6, round caps).

### 5.2 Filter flyout (pop-up)
- Position: left = rail width + 10, top 92; width 352; pointer arrow 12 × 12 at the open item; max height = screen − 108, scrolls inside.
- Card: white, 1 px Line 200, radius 12, flyout shadow.
- Header: title 16/600 + subtitle 12 Slate 600; close button 40 × 40, radius 8, fill Ground, ✕ stroke Slate 600; bottom rule Line 100. Padding 14/16/12.
- Body: padding 14/16/16, gap 18 between filter groups; each group = label 12/600 Slate 600 (+ right-aligned count "All 4" for multi-selects) + control.
- Footer: rule Line 100; left "Reset this group" link (14, `acc`, underlined); right primary button "Done" (40 high, padding 0 20, radius 8, fill `acc`, white 14/600).
- Contents:
  - **Period:** Fiscal year — 3-segment control · Month — 4 × 3 grid of 40 px buttons; selected month filled `acc` with white 600 text; **open months dashed border, Subtle fill, Slate 600 text** + caption "Dashed months are still open…" · Time view — 5 segments (Month, QTD, YTD, LTM, FY).
  - **Versions:** Base version — 3 radio cards (Actual / Latest estimate / Budget) with a one-line description each; selected card border + ring `acc`, fill `accT` · Compare A and Compare B — 4 segments (Budget, Latest est., Prior year, None) + caption "Comparisons always cover the same months as the base."
  - **Slice:** Region chips + Channel / Category / Price tier (CC: sales motion / service line / segment) chips; chip = pill 40 high, `acc` border, `accT` fill, check icon in `acc`; caption about allocation. **Group view:** notice box (notice colours) explaining slices are off + three dashed disabled rows reading "All".
  - **Display:** Currency (USD/EUR/GBP) · FX basis (Actual rates / Constant currency) · Units ($m / $k) and Costs shown (− / +) side by side · Variance (Amount and % / Amount / %) · "Statement shows" switches: % of net revenue column · Full-year outlook columns · Classification tags · Hide empty lines (switch on = `acc` track, white knob).
- Segmented control: 40 high, 1 px Line 300 border, radius 8, equal columns divided by 1 px Line 300; unselected white / Ink 900 / 400; selected `accT` / `acc` / 600.

### 5.3 Header
- Eyebrow (12/500 uppercase Slate 600): "ACME Group · Management reporting · Actuals closed through Sep 2026" (data status, N-02/N-03).
- Title "Profit & loss" 22/600 + context line 13 Slate 600 (L-04): window · versions · currency/units/FX · slices.
- **Company cards** (F-01): 3 buttons, min-height 52, radius 10, padding 6/16/6/12; 12 px dot in the company's own `acc`; name 15/600 + sub 12 Slate 600 ("Goods · retail, D2C, marketplaces" / "E-commerce SaaS services" / "Consolidated"). Selected: border `acc` + 1 px ring + fill `accT`; unselected: border Line 300, white.
- **View tabs:** P&L statement · Key figures · Analysis · Profitability, each with an 18 px icon; min-height 48, padding 0 14; selected = 3 px bottom border `acc`, Ink 900, 600; unselected Slate 600, 500.
- **View toolbar** (right of tabs, 36-high segmented controls):
  - P&L: Layout (Variance / Trend / Entity columns — disabled with tooltip "Available in the ACME Group view" unless Group) · Cost lens (By function / By nature) · Detail (Summary / Standard / Full).
  - Key figures: caption "Changes vs Budget and Prior year, same months" + legend pills "▲ favourable" / "▼ unfavourable".
  - Analysis: "Compared with" Budget / Prior year.
  - Profitability: "Break down by" Region / Channel / Category / Price tier (Group: Region / Entity).

### 5.4 Notice strip (L-05, C-50)
Full width, padding 8/12, radius 8, border `#EBD9AE`, fill `#FBF4E4`, text 13 `#3D3216`, info icon `#8A5A00`; one line per notice; shown only when a notice applies.

## 6. Views

### 6.1 P&L statement (L-07, §4)
- Card: white, Line 200 border, radius 12; table font IBM Plex Sans Condensed, tabular.
- Columns (Variance layout): Line (min 300, sticky) · **Actual · % NR** · **vs Budget:** Budget · Δ · Δ % · ±15% bar · **vs Prior year:** Prior year · Δ · Δ % · **Full year 2026:** Budget · Latest est. · Δ. Widths 84/60/84/72/62/84/84/72/62/84/84/72.
- Two header rows: group titles (12/600, centred, 2 px Ink 900 underline, 12 px white gap between groups) — e.g. "YTD Sep 2026 · Actual", "vs Budget", "vs Prior year", "Full year 2026"; column titles (12/600 Slate 600, first "Line · USD m"); 1 px Line 300 under; group starts separated by 1 px `#E3E8ED`.
- Row kinds:

| Kind | Background | Weight / style | Size | Ink | Top rule |
|---|---|---|---|---|---|
| section / group block | white | 500 | 14 | Ink 900 | `#E3E8ED` |
| leaf / entity node | white | 400 | 14 | Ink 900 | `#EDF0F3` |
| subtotal | `#F6F8FA` | 600 | 14 | Ink 900 | `#D5DCE3` |
| memo subtotal | `#F6F8FA` | 500 italic | 14 | Ink 900 | `#D5DCE3` |
| **key subtotal** (NR, Adj. EBITDA, OP, NP) | `accT` | 700 | 14 | Ink 900 | `keyRule` |
| ratio | white | 400 italic | 13 | Slate 600 | `#EDF0F3` |

- Indent 12 + 22 px per level; expandable rows show a 12 px chevron (rotates 90° open); default open blocks: GR, GTN, COR, VSC, OPEX (Group: GR, VSC, OPEX) — M-20/M-21.
- Row height: Compact 28 (default) / Comfortable 34.
- Secondary label (alias, L-11) 12 Slate 600 after the line name. Tags (L-14) 11/500 outlined pills radius 4: IFRS 18 `#2B3748` solid · MPM, Mgmt Slate 600 dashed · IC `#6B48C8` solid.
- Cell colours: Δ and Δ % favourable `#06603F` / unfavourable `#C2410C`; % NR Slate 600; others inherit row ink.
- ±15% bar column: centre line 1 px Line 300; bar from centre, width ∝ Δ % (±15% = full half), favourable `#3BA37B` right / unfavourable `#E2804A` left; none on ratio rows.
- Footnote (12 Slate 600, top rule Line 100): "Actual at monthly average rates, budget at budget rates · costs negative · Δ positive when favourable · bar = Δ % vs Budget on a ±15% scale · IFRS 18 required subtotal · MPM management-defined measure · IC intercompany".

### 6.2 Key figures (L-06, §5)
- Section labels "FINANCIAL" / "OPERATIONAL" (12/600 uppercase Slate 600).
- Financial: 8 tiles, 4 per row; white, Line 200, radius 12, padding 16/18; label 14/500 Slate 600 (+ optional hint 12); value 34/600 tabular ("$3,398.5m"); two delta rows "vs Budget" / "vs Prior year": name left Slate 600 13, pill right (radius 12, padding 1/8, 600, arrow 9 px) — fav `#E4F3EC`/`#06603F`, unf `#FCEDE5`/`#C2410C`, neutral `#EDF0F3`/Ink 900; % KPIs show pp (K-20, K-21).
- Operational: 4 tiles, fill Subtle `#F6F8FA`, padding 14/18, value 28/600.

### 6.3 Analysis (L-08, C-40, C-45)
- Two cards side by side (bridge ≈ 1.2 : variances 1).
- **Net revenue bridge:** title 17/600 "Net revenue bridge"; subtitle 13 "Budget to Actual, USD millions." + method note; bars: totals `acc`, increases `#3BA37B`, decreases `#E2804A`; value labels 13/600 above (coloured fav/unf, totals Ink 900); category labels 12 `#2B3748`; truncated axis + note "The axis starts at …".
- **Largest variances vs Budget:** "Top 8 lines by size of Δ, USD millions"; columns Line (name 500 + block 12 Slate 600) · diverging bar "Unfavourable · Favourable" (centre line, bars `#E2804A` / `#3BA37B`) · Δ (600, coloured) · Δ %; rows 48 high, rules Line 100.

### 6.4 Profitability (L-09, C-46)
- Two cards (table ≈ 1.7 : chart 1).
- **Profitability by {breakdown}:** columns Name · Net revenue · Share (8 px bar track Line 100 with `acc` fill + %) · vs Budget (600, coloured) · margin group "margin, % of net revenue": Gross · Contribution · Adj. EBITDA · Operating; rows 48 high; note 12 Slate 600 on allocation.
- **Contribution margin by {breakdown}:** horizontal bars (14 high, track Line 100, fill `acc`, scale 0–60%) with value right, and a 2 px dashed Ink 900 marker at the company average CM %.

## 7. Behaviour carried from the spec
- Entity switch keeps period, versions, currency, region (F-31); each entity remembers its slices (F-30); Group disables channel/category/segment with the notice (F-32, T-15).
- Rail collapse/expand; one flyout open at a time; Done/✕ closes; Reset this group restores defaults (F-35).
- Keyboard-operable controls with visible focus; WCAG AA contrast (N-08) — all palette text pairs pass on white.

## 8. Track notes
- **Track B (Power BI):** page 16:9 (1440 × 810 or 1280 × 720 scaled); identity colour via measure-driven conditional formatting (fx) wherever the visual supports it; flyouts and rail states via bookmarks; segmented controls via button/tile slicers styled to §5.2; theme JSON carries the neutral tokens. Must not regress performance (N-01): prefer native formatting over per-cell SVG measures in the matrix.
- **Track A (Rayfin / React):** replicate the mockup almost 1:1 as components (the mockup is already flexbox/grid with inline values); tokens as Tailwind theme / CSS variables with `acc`/`accT`/`keyRule` switched per company.
