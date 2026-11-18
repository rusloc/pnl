# 06 · Interactions: switches, defaults, bookmarks, sync

## Switches (web → Power BI)

| Web control | Web state (URL key) | Power BI | Default |
|---|---|---|---|
| Period type: Week · Month · Quarter · Year | implied by `i` | tile slicer `Period[gran_label]`, single select | Week |
| Fiscal year: FY2025 · FY2026 (hidden at Year in the web) | implied by `i` | tile slicer `Period[fy_label]`, single select, shown at every granularity | FY2026 |
| Period item chips (W1 … W52, P1 … P12, Q1 … Q4 · to date, FY2025 / FY2026 · to date) | `i` (`FY2026-W43` default) | tile slicer `Period[chip_label]`, single select | W43 |
| Comparator: Budget · Last year · Previous | `c` | tile slicer `Comparator[comparator_label]`, single select | Budget |
| Region / format: All · Netherlands · Belgium · Online only | `r` | tile slicer `Region[region_label]`, single select | All |
| Category dropdown (multi; "All categories" clears) | `cat` | dropdown slicer `Category[category_name]`, multi-select, Select-all off | nothing selected (= All) |
| Group / Lever / Owner chips (multi) | `group`, `lever`, `owner` | tile slicers `Card[group_label]`, `Card[lever_label]`, `Card[owner_label]`, multi-select without Ctrl | nothing selected |
| Reset | – | button → bookmark `Default view` | |
| ⓘ / binoculars on a card | layer state | buttons → bookmarks `Explain · <CODE>` / `Drill · <CODE>` | |
| Filters / How to read / More KPIs | layer state | side-bar buttons → bookmarks `Overlay · …` | all closed |
| Esc / scrim click / × | close the layer | scrim shape and × buttons → bookmark `Overlay · none`; Explain page × → page navigation to Executive | |

### Semantics to preserve

- **Status is always vs budget / target / plan**; the comparator changes only the Δ lines and the "vs …" stats
  (`[Card Status Code]` never reads `[Sel Comparator]`).
- **Previous at Year = Last year**: `[Sel Comparator]` maps `prev` → `ly` when the granularity is Year, and the header
  then reads "vs Last year (same retail weeks)". The web hides the Previous chip at Year. TODO(verify): whether your
  Power BI version lets a slicer take a measure-based visual filter (`Comparator[comparator_code] <> "prev" || [Sel
  Gran] <> "FY"`); if not, leave the chip visible: it behaves as Last year.
- **Switching the granularity** keeps the item holding the current item's last week in the web (W43 → P10 → Q4 →
  FY2026). Power BI cannot move a slicer selection; the old chip just stops matching, and `[Sel Item Id]` falls back
  to the latest listed item of the selected granularity and FY. From the default view this gives the same chain
  (W43 → P10 → Q4 → FY2026). From another week (e.g. W30 → Month) it lands on P10, not P8: accepted difference.
- **Switching the FY** keeps the item number in the web (FY2026-W43 → FY2025-W43). In Power BI the chip labels repeat
  across years ("W43"), so the selection carries over the same way; at Quarter "Q4 · to date" has no FY2025 twin and
  falls back to the latest FY2025 quarter (Q4), as the web does.
- **Category**: nothing ticked and all nine ticked both mean All (`[Category Pick Active]`). The Power BI dropdown
  shows "All" in its closed state where the web shows "All categories" (accepted platform difference in the PNL
  repo's parity rules). The header carries the pick: " · Electronics", " · Electronics & Toys & leisure",
  " · 3 categories".
- **Attribute picks** (Group / Lever / Owner): OR inside one slicer, AND across slicers (native slicer behaviour).
  They fade cards in place; they never change counts, dot, values or the category / period. The side-bar badge counts
  the picked attribute values (`[Attr Picks Count]`); the category pick is not counted.

## Cross-filtering

- **No visual cross-filters another.** Edit interactions on Executive: set every chart (the 11 bar charts) to **None**
  towards every other visual (clicking a bar must not filter the page). Slicers keep their default (filter).
- The bench table (More KPIs) is not affected by any slicer (it reads `KPI`, which nothing filters); set the attribute
  slicers' interaction with it to None anyway.
- Drill-down / drill-through: none. The web's drill path is a description of the drill pages (not built), shown on the
  Explain page.

## Bookmarks

Create in this order. "Data" = capture slicer and filter state; "Display" = capture visibility; "Current page" =
navigate to the bookmark's page; "Selected visuals" = apply only to the visuals selected when the bookmark was
updated.

| Bookmark | Page | Data | Display | Current page | Selected visuals | Captures |
|---|---|:-:|:-:|:-:|:-:|---|
| Default view | Executive | on | on | on | off | all slicers at default (Week · FY2026 · W43 · Budget · All · no category · no attributes), all three overlay groups hidden |
| Overlay · none | Executive | **off** | on | on | on: the three overlay groups | all overlays hidden |
| Overlay · Filters | Executive | off | on | on | on: the three overlay groups | Filters group visible, others hidden |
| Overlay · How to read | Executive | off | on | on | on: the three overlay groups | How group visible |
| Overlay · More KPIs | Executive | off | on | on | on: the three overlay groups | More group visible |
| Explain · NET_SALES … Explain · CHANNEL_MIX (12) | Explain | **on** | on | on | on: the card picker slicer + groups `Explain body`, `Drill body` | card picker = that card; `Explain body` visible, `Drill body` hidden |
| Drill · NET_SALES … Drill · CHANNEL_MIX (12) | Explain | on | on | on | on: same three | card picker = that card; `Drill body` visible, `Explain body` hidden |
| Explain view · drill | Explain | off | on | on | on: the two body groups | `Drill body` visible |
| Explain view · explanation | Explain | off | on | on | on: the two body groups | `Explain body` visible |

31 bookmarks. Because the `Explain · …` bookmarks capture data only for the (hidden) card picker, the period,
comparator, region and category the user chose stay as they are.

Alternative to the 24 card bookmarks: drill-through. Put `Card[kpi_code]` into each card visual (e.g. the value
visual's tooltip or category well), make `Card[kpi_code]` the drill-through field of the Explain page, and the user
right-clicks a card → Drill through → Explain. Simpler to maintain, but a two-click gesture and no direct "drill path"
entry; the bookmark route matches the web's one-click buttons.

## Sync slicers

| Slicer | Executive | Explain | Validation |
|---|---|---|---|
| Granularity, Fiscal year, Period item | visible (in the Filters overlay) | synced, **hidden** | not synced |
| Comparator, Region, Category | visible (overlay) | synced, hidden | not synced |
| Group, Lever, Owner | visible (overlay) | not synced (the Explain page shows one card) | not synced |
| Card picker | – | visible = no (hidden, set by bookmarks) | – |

Sync group names: `period-gran`, `period-fy`, `period-item`, `comparator`, `region`, `category`.

## Tooltips

| Hover target | Web | Power BI |
|---|---|---|
| Overall dot | "Overall: orange · computed over …" | report-page tooltip **TT Dot** |
| Status chip | "<card> · <word> · <rule>" | report-page tooltip **TT Chip** (TODO(verify) visual-filter pass-through, `05-pages.md`) or a static visual-header tooltip |
| Side-bar buttons, ⓘ, binoculars | short labels | button tooltips (static text, `05-pages.md`) |
| Region segment with ≥ 3 categories | the picked names | `[Hdr Region Tooltip]` in the header text box's tooltip is not supported; show it in the TT Dot-style tooltip of an invisible card over the header, or skip (minor) |
| Card bars | none | tooltips off |

## Keyboard and accessibility

Power BI handles focus order itself. Set the tab order on Executive: side-bar buttons → header → cards in
`card_order` (each: ⓘ, binoculars) → overlays last. Give each card group an alt text: "<title>: <value>, <Δ>,
<status>" — e.g. a measure `[Card Title] & ": " & [Card Value Display] & ", " & [Card Delta Text] & ", " & [Card
Status Word]` as the alt-text fx of the value visual.
