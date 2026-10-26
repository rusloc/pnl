# Executive dashboard (consumer-goods reseller) - prototype v2

DRAFT for USER approval, v2 of 2026-10-26 (v1 2026-10-24). Nothing built in any track. Spec: `docs/specs/2026-10-24-executive-dashboard-consumer-goods-reseller-spec.md`. Replaces the ACME executive scorecard concept (`docs/design/executive scorecard/`, superseded).

| File | What it is |
|---|---|
| `prototype.html` | **v2.** One self-contained page: header, status line, attribute filter bar, 3 Tier-1 cards, 9 explanation tiles, collapsed "Notes for the owner", footer. All explanations, formulas, drill paths and the KPI bench live in pop-ups. Inline CSS / SVG / vanilla JS; Google Fonts link for Inter (Segoe UI fallback); no external JS. |
| `prototype-v1-2026-10-24.html` | The v1 page kept for reference: "Trading sheet" theme, sections a–f (32-KPI map, lineage DAG, visual flow, design direction, Week 43 frame, tri-track, open questions). |

How to open: double-click `prototype.html`. Hover or focus a status chip for its rule; `ⓘ` opens the explanation, `↗` the drill path; `How to read` and `More KPIs` sit in the header; `Notes for the owner` expands at the bottom.

Company: **Nordmark Retail** - a fictional multi-category reseller (142 stores in three formats, e-commerce, wholesale; 9 categories, ~1,100 suppliers, ~68k active SKUs; NL + BE, EUR). All numbers are illustrative for retail Week 43 of FY2026 (19–25 Oct), comparator Budget, and keep the v1 story: 7 on track, 3 watch, 2 off track, two provisional tiles.

## What changed in v2

- **Distilled**: 32 KPIs → 3 Tier-1 numbers + 9 explanation tiles on the page; the 20 bench KPIs moved to a "More KPIs" drawer. Top category movers left the landing page (now step 2 of the Net sales drill).
- **Text cut**: card face = title · value · Δ vs comparator · status chip · 13-week sparkline · one note ≤ 6 words. Section intros ≤ 1 sentence. The v1 sticky index and prose sections a–f are gone; the data contract, "where the margins meet", status rules, open questions and build risks sit in the collapsed "Notes for the owner".
- **Explanations in pop-ups**: every metric has "what it is", "why it matters", the formula in words, a worked example with the page's own numbers, its status rule, its attribute tags, 3 mini stats, a footer line and a pill button to the drill path.
- **Drill pop-ups**: the v1 drill chains as 3–4 numbered steps, one sentence each.
- **Attribute tags + filter bar**: five attributes per metric; chips at the top hide cards that do not match.
- **Theme**: flat minimal page (white, 1 px `#E5E7EB` borders, no shadows on cards, no gradients, Inter) with **cobalt `#2048C6` kept as the single accent** (7.2:1 on white). Status colours unchanged from v1 (`#136C3A` / `#9A5B00` / `#C0272D` on their tints, all ≥ 4.5:1). Frosted glass (translucent white, `backdrop-filter: blur(22px) saturate(1.5)`, 1 px light border, inner highlight, 16 px radius) on pop-ups, the drawer, tooltips and active filter chips; `@supports not (backdrop-filter)` falls back to 92 % solid white.
- **Layout**: 1440 wide, 3-column grid; 2 columns below 1200 px, 1 below 720 px. At 1440 × 810 the fold lands inside the third explanation row (grid ends at ~950 px); see open question 1.
- **Number corrections** so the worked examples add up (listed in the notes section): stock incl. on-order €168m → €490m; GMROI inputs €411m ÷ €152m → €1,016m ÷ €376m (ratio unchanged); back margin €3.9m / 6.3 % → €3.8m / 6.2 %; channel shares 68.4 / 19.8 / 11.8 → 68.4 / 19.9 / 11.7. Weeks-of-cover rule tightened (On track ±1 wk, Watch 1–2, Off beyond 2) so +1.9 wks reads Watch as in v1.

## Metric list with attributes

Attributes: **Group** (B1 base-crucial · B2 margin & cost · B3 stock & supply · B4 channel & customer) · **Lever** (sales · margin · stock · supply · cash) · **Horizon** (week · month · quarter) · **Owner** (commercial · supply chain · finance · digital) · **Statement** (P&L · balance sheet · operational).

| Tier | Metric | Value · status | Group | Lever | Horizon | Owner | Statement | Drill page |
|---|---|---|---|---|---|---|---|---|
| 1 | Net sales | €61.4m · Watch | B1 | sales | week | commercial | P&L | Sales |
| 1 | Total margin % (prov.) | 36.3 % · On track | B1 | margin | month | finance | P&L | Margin |
| 1 | Weeks of cover | 11.4 wks · Watch | B1 | stock | week | supply chain | balance sheet | Inventory |
| 2 | Markdown % of gross sales | 9.8 % · Off track | B2 | margin | week | commercial | P&L | Margin |
| 2 | Availability % | 94.1 % · Off track | B3 | supply | week | supply chain | operational | Inventory |
| 2 | EBITDA flash (prov.) | €15.3m · Watch | B2 | margin | month | finance | P&L | Margin |
| 2 | Like-for-like growth % | +3.4 % · On track | B4 | sales | week | commercial | P&L | Sales |
| 2 | Front gross margin % | 30.1 % · On track | B2 | margin | week | finance | P&L | Margin |
| 2 | Sell-through % | 63.1 % · On track | B3 | stock | quarter | commercial | operational | Inventory |
| 2 | GMROI | 2.7× · On track | B3 | cash | quarter | finance | balance sheet | Inventory |
| 2 | Supplier OTIF % | 95.4 % · On track | B3 | supply | week | supply chain | operational | Supplier |
| 2 | Channel mix | 68.4 / 19.9 / 11.7 · On track | B4 | sales | month | digital | P&L | Channel & customer |

Owner mapping from v1 initials: CE / CM / RO → commercial, CF → finance, SC → supply chain, EC / MK → digital. Explanation tiles are ordered worst first.

## Filter semantics

- One chip per attribute value, grouped under its attribute label; `All` resets.
- Within one attribute, selected chips are **OR** (B1 + B4 = cards tagged B1 or B4). Across attributes, **AND** (B1 + Sales = cards tagged B1 and Sales).
- A card is shown only if, for every attribute with a selection, its value is among the selected ones. Each section shows a "no metric carries this combination" placeholder when all its cards are hidden; the counter reads "n of 12 metrics".
- Active chips take the frosted-glass style with the accent tint; `aria-pressed` carries the state. Pure vanilla JS, no framework.

## Pop-up inventory

| Pop-up | Opened by | Content |
|---|---|---|
| Explanation (×12) | `ⓘ` on a card, or "Back to the explanation" in a drill pop-up | eyebrow (tier · basis), title, status word, big value + unit, Δ line, 13-week sparkline with week labels (stacked bar for Channel mix), 3 mini stats, What it is / Why it matters / Formula / Worked example / Status rule, attribute tags, footer (target · refresh or provisional), pill "Drill path · page" |
| Drill path (×12) | `↗` on a card, or the pill in an explanation | 3–4 numbered steps from the landing tile to the lowest grain (e.g. Net sales → store ranking → store × category × week → SKU-store-day), footer with the carried filters, pill back to the explanation |
| How to read (×1) | header button | six bullets: the three numbers, status vs Δ, sparkline, ⓘ / ↗, filter semantics, bench and prov. |
| More KPIs drawer (×1) | header button | the 20 bench KPIs by domain: name, one-line formula, owner · cadence |
| Status tooltip (×12) | hover / focus on a status chip | metric name + status rule |

Behaviour: one layer open at a time (opening another closes the first); close on Esc, click on the scrim, or the × button; focus moves into the layer, Tab cycles inside it, and returns to the opener on close; page scroll is locked while a layer is open.

## Render check (2026-10-26)

Headless Chromium via Python Playwright, 28 checks, all pass, 0 console / page errors: initial 12 cards; B1 → 3; B1 AND Sales → Net sales only; (B1 OR B4) AND Sales → Net sales, LFL, Channel mix; empty-state placeholders; All reset; explanation and drill pop-ups open; Esc, click-outside and × close; focus returns to the opener; focus stays trapped on 40 Tabs; only one layer at a time (drawer closes when the how-to opens); tooltip on focus / blur; `@supports` fallback present; no external script; 2 columns at 1000 px with no horizontal scroll. Not verified: real backdrop-filter rendering outside Chromium (Firefox / Safari), screen-reader announcement order, and the exact 810 px fold (see question 1).

## Open questions for the USER

1. **Fold at 1440 × 810** - the 3 + 9 grid ends at ~950 px. Accept the scroll (worst-first keeps the off-track tiles above the fold), or drop to 8 explanation tiles in a 4-column grid to fit 810 exactly? *Default: accept the scroll.*
2. **Which tile to drop if 8** - GMROI (slow, R12M) or Channel mix (a "where" visual, not a KPI)? *Default: Channel mix moves to the drawer.*
3. **Accent** - cobalt `#2048C6` kept from v1; switch to a new hue to mark the theme change? *Default: keep cobalt.*
4. **Attribute set** - keep all five attributes in the bar, or hide Statement and Horizon behind a "more filters" toggle to get a one-line bar? *Default: all five, two lines.*
5. **Owner for Channel mix** - tagged "digital" (e-commerce head) so the digital chip is not empty; v1 had the CEO. *Default: digital.*
6. **Number corrections** - accept the corrected supporting amounts (stock €490m, GMROI inputs, back margin €3.8m, channel shares) as the Nordmark story from here on? *Default: yes.*
7. **Weeks-of-cover rule** - keep the tightened ±1 / ±2 rule, or the spec's single ±2 band (which would make 11.4 wks On track)? *Default: tightened.*
8. **v1 open questions** (calendar, currency, private label, back-margin method, THE number, availability, channels, landed cost) stay as listed in "Notes for the owner" with their defaults. Anything to change?
