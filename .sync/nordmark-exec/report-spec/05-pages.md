# 05 · Pages and visuals

Canvas **1280 × 720** (16:9), page background `#FFFFFF`, no wallpaper. The web board is 1440 × 810; every position
below is the web position × **0.8889**, rounded to whole pixels. Fonts: **Segoe UI** family (`07-theme.md`); font sizes
are in points (web px × 0.667). All visuals: title off, background off unless stated, border off, visual header
hidden in reading view, drop shadow off.

| # | Page | Kind | Size | Visible |
|---:|---|---|---|:-:|
| 1 | Executive | report page | 1280 × 720 | yes (landing) |
| 2 | Explain | report page | 1280 × 720 | yes (reached through card buttons; hide the tab in the published view) |
| 3 | TT Dot | tooltip page | 300 × 140 | hidden |
| 4 | TT Chip | tooltip page (optional) | 300 × 110 | hidden |
| 5 | Validation | report page | 1280 × 720 | hidden |

## Card visual pattern (used 12 times on Executive)

Every card is one **group** named `Card · <kpi_code>` with the visuals below. Each visual that accepts filters carries
the visual-level filter **`Card[kpi_code]` is `<kpi_code>`** (basic filtering, "Require single selection" off).
Positions are relative to the card's top-left corner; `W` × `H` is the card size.

| Size | W × H | Used by |
|---|---|---|
| hero | 389 × 210 | NET_SALES, TOTAL_MARGIN, WEEKS_OF_COVER |
| med | 389 × 156 | MARKDOWN, AVAILABILITY, EBITDA |
| sm | 189 × 149 | LFL_GROWTH, FRONT_GM, SELL_THROUGH, GMROI, SUPPLIER_OTIF, CHANNEL_MIX |

| # | Element | Visual | Position (x, y, w, h) hero / med / sm | Content and formatting |
|---|---|---|---|---|
| 1 | Card box | **Card (new)** with no data **or** a Shape (rounded rectangle) | (0, 0, W, H) | Corner radius 14. Fill fx = `[Card Fill Colour]`; border fx = `[Card Border Colour]`, width 1 px (the web uses 2 px when Off track: if your visual supports width fx, 2 px when `[Card Status Code]` = 3). Gradient wash of the web (white → tint, left to right) has no 1:1 equivalent: flat fill with the gradient's mid tone. |
| 2 | Title line | Card (new), or a text box with wrapper measures (below) | (14, 9, W − 130, 20) / same / (12, 9, W − 46, 18) | Run 1 `[Card Title]` Segoe UI Semibold 9.5 pt (hero 10 pt), colour fx `[Card Ink Colour]`; run 2 `" · " & [Card Sub]` Segoe UI 9.5 pt, colour fx `[Card Muted Colour]`. **Small cards show the title only** (the web hides the sub-title on small cards). No wrap, ellipsis. |
| 3 | Status chip | Card (new) | right-aligned: (W − 104, 9, 90, 20) / same / (W − 32, 9, 20, 20) | Value `[Card Chip Text]` ("● Watch"; small: "●"), Segoe UI Semibold 7.5 pt, colour fx `[Card Chip Font]`; background fx `[Card Chip Fill]`, corner radius 10 (pill). Tooltip: `TT Chip` page, or the static rule text (`Card[rule]`) as the visual-header tooltip. |
| 4 | Value | Card (new) | (14, 34, 220, 46) / (14, 32, 220, 34) / (12, 30, 80, 28) | Callout `[Card Value Text]` Segoe UI Semibold — hero 29 pt, med 20 pt, sm 17 pt — colour fx `[Card Ink Colour]`; unit `[Card Unit Text]` as a second callout or reference label, Segoe UI 9 pt, `#5F6878`, 3 px to the right. One-visual alternative: `[Card Value Display]`. Left-aligned. |
| 5 | Δ line | Card (new) | (14, 82, 230, 18) / (14, 68, 230, 18) / (12, 60, 80, 48) | `[Card Delta Text]`, Segoe UI Semibold — hero 9 pt, med 8.5 pt, sm 8 pt (wraps on small cards, up to 3 lines) — colour fx `[Card Delta Colour]`. |
| 6 | ⓘ button | Button (blank) with icon | (14, H − 35, 25, 25) | Circle, border `#E5E7EB` 1 px, fill `#FFFFFF` 40 % transparency, icon: an "i" (use the SVG in `07-theme.md` or the built-in Information icon), icon colour `#5F6878`, hover `#2048C6`. Action: **Bookmark → `Explain · <kpi_code>`**. Tooltip: "Explain · what it is, why it matters, formula, worked example". |
| 7 | Binoculars button | Button (blank) with icon | (43, H − 35, 25, 25) | Same style; icon binoculars (SVG in `07-theme.md`). Action: **Bookmark → `Drill · <kpi_code>`**. Tooltip: "Drill path · from this card to the lowest grain". |
| 8 | Bars | **Line and clustered column chart** | hero (W − 245, H − 92, 231, 82) · med (W − 174, H − 65, 160, 55) · sm (W − 90, H − 62, 78, 52) | X-axis `'Bar Item'[bar_label_u]` (sorted by `item_id`, axis **off**, type categorical); column y = `[Bar Value]`; line y = `[Bar Target]`. Visual filters: `Card[kpi_code]` and `[Bar In Series]` is 1. Columns: colour fx `[Bar Colour]` (field value), inner padding 10 %, no data labels. Line: `#9CA3AF`, 1 px, **dashed** (dotted in the web), no markers, no shading. Y-axis off, Start fx `[Bar Axis Min]`, End fx `[Bar Axis Max]`. Gridlines off, legend off, tooltips off. **Channel mix has no bars** (omit this visual on CHANNEL_MIX). |

When a card is concealed by an attribute pick, every colour measure returns its faded value (near-white), so the card
fades in place and nothing moves (web: opacity 8 %, greyscale).

### Wrapper measures (for visuals without a filter pane: text boxes, shapes, buttons)

Text boxes and shapes cannot take a visual-level filter. If you build the card text with text boxes (two styled runs
per line) or the box with a Shape, generate per-card wrappers with this Tabular Editor 2/3 C# script, and use
`[<CODE> · <measure>]` in place of `[<measure>]`:

```csharp
var codes = new[] { "NET_SALES", "TOTAL_MARGIN", "WEEKS_OF_COVER", "MARKDOWN", "AVAILABILITY", "EBITDA",
                    "LFL_GROWTH", "FRONT_GM", "SELL_THROUGH", "GMROI", "SUPPLIER_OTIF", "CHANNEL_MIX" };
var generics = new[] { "Card Title", "Card Sub", "Card Chip Text", "Card Value Text", "Card Unit Text",
                       "Card Value Display", "Card Delta Text", "Card Fill Colour", "Card Border Colour",
                       "Card Ink Colour", "Card Muted Colour", "Card Delta Colour", "Card Chip Fill",
                       "Card Chip Font", "Card Status Code" };
var home = Model.Tables["Measures"];
foreach (var c in codes)
    foreach (var g in generics)
    {
        var m = home.AddMeasure(c + " · " + g,
            "CALCULATE (\n    [" + g + "]\n    ,'Card'[kpi_code] = \"" + c + "\"\n)",
            "3 Card\\wrappers\\" + c);
    }
```

(180 wrappers; not counted in `04-measures.md`. `[Card Code]` ignores the attribute filters, so a wrapper still knows
its card when an attribute pick fades it.)

---

## Page 1 · Executive

### Static frame

| Element | Visual | x | y | w | h | Content / format |
|---|---|---:|---:|---:|---:|---|
| Side bar | Shape rectangle | 0 | 0 | 50 | 720 | fill `#FFFFFF`, right border: a 1 px line shape at x = 50, `#E5E7EB` |
| Mark "N" | Shape rounded rectangle + text | 11 | 11 | 28 | 28 | fill `#2048C6`, radius 8, text "N" Segoe UI Bold 10 pt `#FFFFFF`, centred |
| Filters button | Button (blank) | 7 | 53 | 36 | 36 | radius 11; icon "three lines" (SVG in `07-theme.md`), colour `#5F6878`, hover border `#E5E7EB` + icon `#111827`; selected state (when the Filters overlay is open) fill `#EAEFFB`, icon `#2048C6`. Action: Bookmark `Overlay · Filters`. Tooltip "Filters · period, comparator, region and the metric attributes" |
| Filters badge | Card (new) | 30 | 55 | 14 | 14 | `[Attr Picks Count]`, Segoe UI Semibold 7 pt `#FFFFFF`, background `#2048C6`, radius 7; hidden when blank (fx transparency or set the callout to show nothing for BLANK) |
| How-to-read button | Button | 7 | 94 | 36 | 36 | icon "question in a circle"; action Bookmark `Overlay · How to read`; tooltip "How to read this page" |
| More-KPIs button | Button | 7 | 135 | 36 | 36 | icon "grid with plus"; action Bookmark `Overlay · More KPIs`; tooltip "More KPIs · 20 bench metrics, inactive" |
| Brand title | Text box | 71 | 13 | 150 | 20 | "Nordmark Retail", Segoe UI Semibold 12 pt `#111827`, letter spacing −0.01 em |
| Brand subtitle | Text box | 71 | 33 | 150 | 16 | "Executive dashboard", Segoe UI 8 pt `#5F6878` |
| Header divider | Shape line (vertical) | 228 | 19 | 1 | 32 | `#E5E7EB` |
| Header meta | Text box with dynamic values | 244 | 25 | 760 | 20 | Segoe UI 8.5 pt `#5F6878`; runs: **`[Hdr Period Bold]`** (Semibold `#111827`) + `[Hdr Period Rest]` + 3 spaces + "vs " + **`[Hdr Compare Label]`** + `[Hdr Compare Suffix]` + 3 spaces + **`[Hdr Region Bold]`** + `[Hdr Region Rest]`. Example: **Week 43** · 19–25 Oct 2026   vs **Budget**   All regions & formats |
| Refreshed | Text box | 1058 | 26 | 200 | 18 | `[Hdr Refreshed]`, Segoe UI 8 pt `#5F6878`, right-aligned |
| Header rule | Shape line | 71 | 57 | 1188 | 1 | `#E5E7EB` |
| Overall dot | Shape oval (or Card (new) with fx background) | 71 | 69 | 12 | 12 | fill fx `[Dot Colour]`; report-page tooltip **TT Dot**. No pulse animation in Power BI |
| Count on | Card (new) | 91 | 64 | 92 | 21 | `[Status Count On Text]` Segoe UI Semibold 8 pt `#136C3A` on `#E1F0E5`, radius 11 |
| Count watch | Card (new) | 189 | 64 | 78 | 21 | `[Status Count Watch Text]` `#9A5B00` on `#FBEFD6` |
| Count off | Card (new) | 273 | 64 | 92 | 21 | `[Status Count Off Text]` `#C0272D` on `#FAE3E3` |
| Summary | Text box | 958 | 66 | 300 | 18 | right-aligned, Segoe UI 8 pt `#5F6878`: **`[Status Summary Bold]`** (Segoe UI Semibold `#111827`) + `[Status Picks Text]` → "**12 of 12 metrics** · All" |
| Section 1 label | Text box | 71 | 101 | 300 | 15 | "THE THREE NUMBERS", Segoe UI Semibold 7.5 pt `#5F6878`, letter spacing 0.06 em |
| Section 2 label | Text box | 71 | 340 | 300 | 15 | "WHAT EXPLAINS THEM", same style |

### Card grid (12 cards)

Grid: 6 columns, column width 189, gap 11, first column x = 71 (columns at x = 71, 271, 470, 670, 870, 1069).

| card_order | kpi_code | Size | x | y | w | h |
|---:|---|---|---:|---:|---:|---:|
| 1 | NET_SALES | hero | 71 | 121 | 389 | 210 |
| 2 | TOTAL_MARGIN | hero | 470 | 121 | 389 | 210 |
| 3 | WEEKS_OF_COVER | hero | 870 | 121 | 389 | 210 |
| 4 | MARKDOWN | med | 71 | 360 | 389 | 156 |
| 5 | AVAILABILITY | med | 470 | 360 | 389 | 156 |
| 6 | EBITDA | med | 870 | 360 | 389 | 156 |
| 7 | LFL_GROWTH | sm | 71 | 527 | 189 | 149 |
| 8 | FRONT_GM | sm | 271 | 527 | 189 | 149 |
| 9 | SELL_THROUGH | sm | 470 | 527 | 189 | 149 |
| 10 | GMROI | sm | 670 | 527 | 189 | 149 |
| 11 | SUPPLIER_OTIF | sm | 870 | 527 | 189 | 149 |
| 12 | CHANNEL_MIX | sm | 1069 | 527 | 189 | 149 |

Order is fixed by `card_order` (importance, worst-first is a design note, not a sort). Default-view strings of every
card: `08-validation.md` › "Expected card strings".

**Empty states**: a card never disappears. N/A shows value `n/a` (or `–` under a category pick), a muted Δ
("n/a vs budget", "n/a by category"), a grey `–` chip "N/A", and bars blank where no history exists (e.g. Sell-through
outside a season, GMROI before week 52 of FY2025, LFL in FY2025).

### Overlay · Filters (group `Overlay Filters`, hidden by default)

| Element | Visual | x | y | w | h | Content |
|---|---|---:|---:|---:|---:|---|
| Scrim | Shape rectangle | 0 | 0 | 1280 | 720 | fill `#111827`, transparency 78 %; action: Bookmark `Overlay · none` |
| Panel | Shape rounded rectangle | 59 | 9 | 320 | 702 | fill `#FFFFFF` transparency 8 % (the web's frosted glass is 62 % white + blur; Power BI has no blur, so keep it nearly opaque), border `#FFFFFF` 1 px, radius 14, shadow 0/11/36 `#111827` 16 % |
| Title | Text box | 77 | 25 | 120 | 22 | "Filters", Segoe UI Semibold 12 pt |
| Reset | Button | 232 | 24 | 64 | 25 | "Reset", pill, border `#11182724`; action Bookmark `Default view` |
| Close | Button | 336 | 22 | 28 | 28 | "×" circle; action Bookmark `Overlay · none` |
| Hint | Text box | 77 | 50 | 290 | 16 | "Status is always vs budget or target; the comparator changes the Δ line." 7.5 pt `#5F6878` |
| "PERIOD" | Text box | 77 | 72 | 200 | 14 | section label style |
| Granularity | **Slicer (tile / button slicer)** | 77 | 88 | 284 | 25 | `Period[gran_label]` (sorted by gran_sort), single select, 4 tiles: Week · Month · Quarter · Year |
| Fiscal year | Slicer (tile) | 77 | 119 | 284 | 25 | `Period[fy_label]`, single select: FY2025 · FY2026 (kept at Year too: accepted platform difference) |
| Period item | Slicer (tile, grid) | 77 | 150 | 284 | 168 | `Period[chip_label]` (sorted by chip_sort), single select; tiles 34 × 23, 4 px gaps, ~8 per row, scrolls vertically (52 weeks); Month 12; Quarter 4; Year 1 |
| Showing | Text box | 77 | 322 | 284 | 18 | "Showing " + **`[Sel Title]`** + `[Sel Header Period Rest]` (or `[Filters Showing]`) |
| "COMPARATOR" | Text box | 77 | 346 | 200 | 14 | |
| Comparator | Slicer (tile) | 77 | 362 | 284 | 25 | `Comparator[comparator_label]`, single select: Budget · Last year · Previous |
| "REGION / FORMAT" | Text box | 77 | 393 | 200 | 14 | |
| Region | Slicer (tile) | 77 | 409 | 284 | 25 | `Region[region_label]` (sorted by region_sort), single select: All · Netherlands · Belgium · Online only |
| "CATEGORY" | Text box | 77 | 440 | 200 | 14 | |
| Category | Slicer (**dropdown**) | 77 | 456 | 284 | 28 | `Category[category_name]` (sorted by sort_order), multi-select with Ctrl off ("Multi-select without Ctrl" on), "Select all" off; nothing selected shows "All" (web: "All categories"; accepted platform difference) |
| "METRIC ATTRIBUTES" | Text box | 77 | 498 | 284 | 14 | label + " OR within a group · AND across groups" (regular, no caps), top rule `#11182714` above |
| "GROUP" | Text box | 77 | 520 | 100 | 14 | |
| Group | Slicer (tile, multi) | 77 | 536 | 284 | 50 | `Card[group_label]` (sorted by group_sort): B1 base-crucial · B2 margin & cost · B3 stock & supply · B4 channel & customer |
| "LEVER" | Text box | 77 | 592 | 100 | 14 | |
| Lever | Slicer (tile, multi) | 77 | 608 | 284 | 25 | `Card[lever_label]`: Sales · Margin · Stock · Supply · Cash |
| "OWNER" | Text box | 77 | 639 | 100 | 14 | |
| Owner | Slicer (tile, multi) | 77 | 655 | 284 | 25 | `Card[owner_label]`: Commercial · Supply chain · Finance · Digital |

Tile style (all slicers in the panel): height 25, radius 12 (pill), Segoe UI 8 pt, text `#5F6878`, border
`#11182724`; selected: text `#2048C6`, border `#2048C673`, fill `#EAEFFB`; hover: text and border `#111827`.

### Overlay · How to read (group `Overlay How`, hidden by default)

| Element | Visual | x | y | w | h | Content |
|---|---|---:|---:|---:|---:|---|
| Scrim | Shape | 0 | 0 | 1280 | 720 | as above |
| Panel | Shape | 382 | 150 | 516 | 420 | as the Filters panel |
| Eyebrow | Text box | 403 | 168 | 400 | 14 | `[How Eyebrow]` → "NORDMARK · WEEK 43" (uppercase, 7.5 pt Semibold `#5F6878`) |
| Title | Text box | 403 | 183 | 400 | 22 | "How to read this page", Segoe UI Semibold 12 pt |
| Close | Button | 852 | 168 | 28 | 28 | "×"; Bookmark `Overlay · none` |
| Bullets | Text box with dynamic value | 403 | 215 | 476 | 300 | 8.7 pt, line spacing 1.55, the six bullets below |
| Footer | Text boxes | 403 | 535 | 476 | 18 | left "Illustrative data" `#5F6878`; right **`[Hdr Refreshed]`**; rule above `#11182714` |

Bullets (bold runs in **bold**; the only dynamic value is `[How Compare Name]`):

1. **Three numbers** carry the page: Net sales (sell more), Total margin % (keep more), Weeks of cover (turn stock faster). The nine tiles below explain them: card size follows importance, worst first.
2. **Status** is vs the metric’s target: ▲ On track · ● Watch · ▼ Off track; the card is washed in the status colour; hover a chip for the rule. The **Δ line** is vs the comparator in the header (`[How Compare Name]`). The **dot** before the counts is the overall status over the cards with a status; hover it for the rule.
3. **Bars** = the last 13 weeks, 12 months, 8 quarters or 2 years up to the picked period; the picked one is in the status colour, the dotted line is the target.
4. **ⓘ** opens the plain-English explanation and a worked example; the **binoculars** open the drill path to the drill page and its lowest grain.
5. **Side bar**: Filters (period, comparator, region, category and the metric attributes; inside one attribute a choice is OR, across attributes AND; filtered-out cards fade in place so nothing moves; the badge counts active choices; Reset clears), How to read, More KPIs (the 20 bench metrics, inactive).
6. **prov.** in a title = provisional until close (true-up 10 Nov). Illustrative data · EUR · NL + BE · LY = same retail week.

### Overlay · More KPIs (group `Overlay More`, hidden by default)

| Element | Visual | x | y | w | h | Content |
|---|---|---:|---:|---:|---:|---|
| Scrim | Shape | 0 | 0 | 1280 | 720 | as above |
| Drawer | Shape | 860 | 11 | 409 | 698 | panel style |
| Eyebrow | Text box | 880 | 30 | 340 | 14 | "KPI BENCH · INACTIVE, SWITCHED ON PER CLIENT" |
| Title | Text box | 880 | 45 | 300 | 22 | "More KPIs · 20" |
| Close | Button | 1225 | 28 | 28 | 28 | "×"; Bookmark `Overlay · none` |
| Bench table | **Table** | 880 | 78 | 372 | 620 | Rows from `KPI` with visual filter `KPI[is_landing]` = False; columns: `KPI[domain]` (hidden-repeat: use a Matrix with `domain` as row header instead if you want the web's grouped look), `KPI[kpi_name]` (Semibold), `KPI[formula]` (`#5F6878`), `KPI[owner_cadence]` (pill look: 7.5 pt Semibold `#5F6878`); sort by `KPI[domain_sort]` then `KPI[catalogue_no]`; no totals; grid: horizontal lines `#11182714` only; 8.3 pt |

Expected content (domain → name · formula · owner · cadence): Sales — Sales pace vs budget % · Net sales to date ÷
(budget × elapsed trading-day share) · CM · daily; Units & average selling price · Σ units; Net sales ÷ units · CM ·
daily; Online conversion % & AOV · Orders ÷ sessions; Net sales ÷ orders · EC · daily; Store traffic & basket ·
Footfall; items ÷ transactions; Net sales ÷ transactions · RO · daily. Margin — Promo share % & uplift; Shrink %;
Category margin mix. Inventory — Aged / excess stock %; Inventory turns. Supplier — Top-10 supplier concentration %;
Purchase price variance %. Cost — Store operating cost % of sales; Cost to serve online per order. Cash — Cash
conversion cycle (days); Cash balance & headroom. Customer — Returns rate % (online); Active loyalty customers &
repeat rate; NPS / review score. People & risk — Store payroll hours vs plan & sales per labour hour; Data-quality
score. (Exact formulas, initials and cadences: `manifest.json › kpis`.)

### The chat button

The web header carries a chat button ("Ask AI") after the refresh stamp. It is a site feature, not part of the
report: leave it out.

---

## Page 2 · Explain (the ⓘ explanation and the drill path)

The web shows these as a 580 px pop-up over the dashboard. Power BI: a separate page with a centred 560 × 690 panel,
reached through the card buttons (bookmarks select the card and the state) and closed by "×" (page navigation back to
Executive). The period, comparator, region and category slicers are **synced** (hidden) from Executive.

| Element | Visual | x | y | w | h | Content |
|---|---|---:|---:|---:|---:|---|
| Backdrop | page background | | | | | `#F6F7F9` (stands in for the dimmed dashboard) |
| Card picker | Slicer (tile), **hidden** in the Selection pane (still filters) | 360 | 0 | 560 | 14 | `Card[kpi_name]` (sorted by card_order), single select, default "Net sales"; set by the `Explain · …` / `Drill · …` bookmarks |
| Panel | Shape | 360 | 15 | 560 | 690 | `#FFFFFF`, border `#E5E7EB`, radius 14, shadow |
| Eyebrow | Card (new) | 381 | 33 | 430 | 14 | `[Explain Eyebrow]`, uppercase 7.5 pt Semibold `#5F6878` ("TIER 1 · WEEK 43, ALL CHANNELS") |
| Title | Card (new) | 381 | 48 | 380 | 24 | `[Card Title]`, Segoe UI Semibold 12 pt `#111827` |
| Status word | Card (new) | 760 | 52 | 110 | 20 | `[Card Status Word]`, Segoe UI Semibold 9.5 pt, colour fx `[Card Status Colour]`, right-aligned |
| Close | Button | 878 | 32 | 28 | 28 | "×", action Page navigation → Executive |

### State A · Explanation (group `Explain body`)

| Element | Visual | x | y | w | h | Content |
|---|---|---:|---:|---:|---:|---|
| "Actual" label | Text box | 381 | 88 | 150 | 18 | "Actual", Segoe UI Semibold 10.5 pt `#374151` |
| Actual value | Card (new) | 381 | 108 | 300 | 46 | `[Card Value Text]` Segoe UI Bold 32 pt `#111827`, letter spacing −0.03 em, + `[Card Unit Text]` 10.5 pt `#5F6878` |
| Basis label | Text box / Card | 381 | 162 | 150 | 18 | 18 px dotted line `#9CA3AF` + `[Card Basis Label]` ("Budget" / "Target" / "Plan"), Segoe UI Semibold 10.5 pt `#374151` |
| Basis value | Card (new) | 381 | 182 | 300 | 40 | `[Card Basis Text]` Segoe UI Bold 27 pt (colour `#5F6878` when it is "–", else `#111827`) + `[Card Basis Unit]` 10.5 pt `#374151` |
| Δ | Card (new) | 381 | 226 | 300 | 18 | `[Explain Delta]`, Segoe UI Semibold 9 pt, colour fx `[Card Delta Colour]` |
| Bars | Line and clustered column chart | 685 | 150 | 213 | 64 | as the card bars, **x-axis visible**: `bar_label_u`, 6 pt `#5F6878`, current label bold `#111827` not possible per label → keep all labels muted; axis labels may thin automatically (web: every 3rd of 12–13 bars, every 2nd of 8, all of 2). Hidden for CHANNEL_MIX (visual filter `[Card Series Metric]` not blank, or show/hide by bookmark) |
| Mix bar | 100 % stacked bar chart | 685 | 196 | 213 | 14 | CHANNEL_MIX only (visual filter `Card[kpi_code]` = CHANNEL_MIX); values `[Mix Bar Store]` `#2048C6`, `[Mix Bar Online]` `#374151`, `[Mix Bar Wholesale]` `#B6BCC6`; no axes, no labels, rounded ends not available |
| Stat rule | Shape line | 381 | 254 | 518 | 1 | `#11182714` |
| Stat 1 | Card (new) | 381 | 266 | 165 | 40 | label `[Explain Stat 1 Label]` 8 pt `#5F6878`; value `[Explain Stat 1 Value]` Segoe UI Semibold 10 pt `#111827` |
| Stat 2 | Card (new) | 557 | 266 | 165 | 40 | `[Explain Stat 2 Label]` / `[Explain Stat 2 Value]` |
| Stat 3 | Card (new) | 733 | 266 | 165 | 40 | `[Explain Stat 3 Label]` / `[Explain Stat 3 Value]` |
| Body labels | Text boxes | 381 | 318 / 360 / 402 / 456 / 520 | 105 | 16 | "WHAT IT IS" · "WHY IT MATTERS" · "FORMULA" · "WORKED EXAMPLE" · "STATUS RULE", 7.5 pt Semibold `#5F6878`, letter spacing 0.06 em |
| What it is | Card (new) / Multi-row card | 497 | 316 | 402 | 40 | `[Card What]`, 8.7 pt `#111827`, wrap |
| Why it matters | Card (new) | 497 | 358 | 402 | 40 | `[Card Why]` |
| Formula | Card (new) | 497 | 400 | 402 | 52 | `[Card Formula]` |
| Worked example | Text box with dynamic values | 497 | 454 | 402 | 62 | `[Example Pre]` + **`[Example Bold]`** (Semibold) + `[Example Post]` |
| Status rule | Card (new) | 497 | 518 | 402 | 40 | `[Card Rule]` |
| Tags | Card (new) ×3 + text | 381 | 570 | 518 | 22 | pills "Group **`[Card Group Label]`**", "Lever **`[Card Lever Label]`**", "Owner **`[Card Owner Label]`**" (7.5 pt `#5F6878`, value Semibold `#111827`, border `#11182724`, radius 11); right end `[Explain Updated]` 8.3 pt Medium `#111827` |
| Drill pill | Button | 381 | 604 | 518 | 36 | "`[Explain Drill Label]`" (button text fx) with binoculars icon in a `#2048C6` circle; fill `#2048C61A`, border `#2048C673`, text `#2048C6` Semibold 9 pt, radius 18. Action: Bookmark `Explain view · drill` |

### State B · Drill path (group `Drill body`, hidden in state A)

| Element | Visual | x | y | w | h | Content |
|---|---|---:|---:|---:|---:|---|
| Eyebrow (drill) | Card (new) | 381 | 33 | 430 | 14 | replaces the explain eyebrow in state B: `[Explain Drill Label]` uppercase |
| Steps | **Table** | 381 | 88 | 518 | 300 | `KPI Drill Step[step_no]` (shown as a 23 px `#2048C6` circle with white number: use a column with background fx `#2048C6`, last step `#374151` via `[is_last]`), `KPI Drill Step[step_title]` Semibold 8.7 pt, `KPI Drill Step[step_text]` 8.7 pt; sorted by step_no; no headers, no grid |
| Footer | Text box | 381 | 400 | 518 | 18 | "Carried on every click: period · region / format · comparator · the metric", 8.3 pt `#5F6878`, rule above |
| Back pill | Button | 381 | 430 | 518 | 36 | ⓘ icon + "Back to the explanation"; same style as the drill pill; action Bookmark `Explain view · explanation` |

(The drill steps are the four rows per card from `KPI Drill Step`, e.g. Net sales: "Weekly net sales vs budget and LY
— 13–26 retail weeks; the same frame as the card, with the comparator carried." → "Store ranking — 142 rows: …" →
"Store × category × week — …" → "SKU-store-day rows — …".)

---

## Page 3 · TT Dot (tooltip page)

Page information: **Allow use as tooltip** on; canvas 300 × 140; background `#FFFFFF`, 8 % transparent, border radius
via a shape. One text box (8.3 pt, line spacing 1.45): **`[Dot Tooltip Title]`** + `[Dot Tooltip Body]`. Example
(default view): **Overall: orange** · computed over all 12 cards, filters ignored. Red if off track ≥ 1/3 · else orange
if watch + off track > 50% · else green if on track ≥ 2/3 · else orange. Now: off track 2 (17%), watch + off 5 (42%),
on track 7 (58%).

Assign it to the dot visual (Format › Tooltips › Type: Report page · Page: TT Dot).

## Page 4 · TT Chip (tooltip page, optional)

Canvas 300 × 110; one Card (new) / text: **`[Card Title]` · `[Card Status Word]`** + " · " + `[Card Rule]` (or the
single measure `[Card Chip Tooltip]`). Assign to each status-chip visual. TODO(verify): that a report-page tooltip
receives the hovered visual's **visual-level** filter (`Card[kpi_code]`); if it does not, put `Card[kpi_code]` into
the chip visual's tooltip well, or fall back to a static visual-header tooltip with the card's rule text
(`Card[rule]`, `02-data.md` › Card).

## Page 5 · Validation (hidden)

| Element | Visual | x | y | w | h | Content |
|---|---|---:|---:|---:|---:|---|
| Title | Text box | 20 | 12 | 600 | 24 | "Validation: answer key and control totals" |
| Counters | Card (new) ×3 | 20 | 44 | 600 | 50 | `[Golden Pass Count]` (expect 97), `[Golden Fail Count]` (expect 0), `[Rows Check]` (expect "cube 4599 · opex 1029 · po 95 · sites 190 · weeks 104 · items 127") |
| Golden table | Table | 20 | 104 | 1240 | 380 | `Golden[golden_id]`, `[question]`, `[metric_code]`, `[item_key]`, `[region_code]`, `[categories]`, `[column]`, `[expected]` (0.000000), `[Golden Got]` (0.000000), `[Golden Diff]`, `[Golden Pass]` (icon: green check / red cross); sort by golden_id |
| Control counter | Card (new) | 20 | 494 | 300 | 40 | `[Control Fail Count]` (expect 0; optional) |
| Control table | Table | 20 | 540 | 1240 | 170 | `Control[scope]`, `[period_key]`, `[metric_code]`, `[expected]`, `[Control Got]`, `[Control Pass]`; visual filter `[Control Pass]` = False (shows only failures) |

No slicers on this page; it is not synced to the others. `[Golden Got]` and `[Control Got]` set every switch
themselves.
