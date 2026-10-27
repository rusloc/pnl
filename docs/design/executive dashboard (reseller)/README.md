# Executive dashboard (consumer-goods reseller) - prototype v5

DRAFT for USER approval, v5 of 2026-10-27 (v1 2026-10-24, v2 2026-10-26, v3 and v4 2026-10-27). Nothing built in any track. Spec: `docs/specs/2026-10-24-executive-dashboard-consumer-goods-reseller-spec.md`. Replaces the ACME executive scorecard concept (`docs/design/executive scorecard/`, superseded).

**Delivery** (USER decision 2026-10-27): two flavours - Track A = custom JS app, Track B = Power BI report. No Rayfin flavour.

| File | What it is |
|---|---|
| `prototype.html` | **v5.** One self-contained page: 56 px side bar (Filters menu, How to read, More KPIs, Notes), header, one status line with the overall-status dot, 3 hero cards, 9 explanation tiles in two sizes; Watch / Off-track cards washed in their status colour (Off track also red-bordered), bottom-aligned half-height 13-week bars, SVG ⓘ and binoculars buttons. Every piece of text beyond title / value / Δ / status lives in a frosted pop-up. Inline CSS / SVG / vanilla JS; Google Fonts link for Inter (Segoe UI fallback); no external JS. |
| `prototype-v4-2026-10-27.html` | v4 kept for reference: wash on every status, full-height bars, font-glyph ⓘ / ↗ buttons, vertical mix bar on Channel mix. |
| `prototype-v3-2026-10-27.html` | v3: side bar + glass menu, equal-size 3 + 9 grid, flat white cards, reflowing filter. |
| `prototype-v2-2026-10-26.html` | v2: flat theme, two-line filter bar in the body, card notes, collapsed notes on the page. |
| `prototype-v1-2026-10-24.html` | v1: "Trading sheet" theme, sections a–f (32-KPI map, lineage DAG, visual flow, design direction, Week 43 frame, tri-track, open questions). |

How to open: double-click `prototype.html`. Side bar: funnel = Filters (badge = active attribute picks), ? = How to read, grid+ = More KPIs, document = Notes. On a card: hover or focus the status chip for its rule, bottom-left `i` (thin circle) for the explanation and the binoculars for the drill path (tooltips "Explain" / "Drill path"); hover the dot before the counts for the overall-status rule.

## What changed in v5

1. **On-track cards are plain white** (no gradient); Watch and Off track keep their wash.
2. **Off-track cards get a 2 px border in the status red** (`#C0272D`), rounded as the card; padding reduced by 1 px so the outer size matches the siblings.
3. **Channel mix has no chart**: value + Δ + chip only; the horizontal mix bar stays in its pop-up.
4. **ⓘ button = inline SVG**: an upright stem + dot inside the button's own thin circle; no font glyph, no italic.
5. **Drill button = binoculars inline SVG**, same 28 px size and bottom-left spot, tooltip "Drill path"; the pop-up content is unchanged (3–4 steps to the lowest grain). The pills inside the pop-ups use the same two icons.
6. **Bars halved and bottom-aligned**: hero 260 × 92 px (was 184), medium 180 × 62 (was 124), small 88 × 58 (was 116); they sit on the card's bottom padding line at the right, so the top half of the body is free; the dotted target line scales with them.
7. Fold unchanged: grid bottom 761 px at 1440 × 810, no page scroll. Everything else as v4.

Company: **Nordmark Retail** - a fictional multi-category reseller (142 stores in three formats, e-commerce, wholesale; 9 categories, ~1,100 suppliers, ~68k active SKUs; NL + BE, EUR). All numbers are illustrative for retail Week 43 of FY2026 (19–25 Oct), comparator Budget, and keep the v1 story: 7 on track, 3 watch, 2 off track, two provisional tiles. USER accepted the v2 defaults (9 tiles, cobalt accent, number corrections, tightened cover rule, five attributes) and rated v3 "generally OK".

## What changed in v4 (superseded where v5 says otherwise)

1. **Card anatomy**: `ⓘ` and `↗` moved to the bottom-left corner (28 px, side by side); the 13-week bar chart moved to the right and stretched to the full card height below the title row (hero 260 × 184 px, medium 180 × 124, small 88 × 116; the current week in the status colour, dotted target). Channel mix shows a vertical stacked bar in the same slot. Small cards drop the basis sub-title and show the status glyph only (word + rule in the tooltip and `aria-label`).
2. **Card sizes by importance** (6-column grid, 12 px gaps, content width 1336 px beside the 56 px side bar) - see the size map below. Fold: the grid ends at **761 px** at a 1440 × 810 viewport, no page scroll.
3. **Filters conceal in place**: a filtered-out card keeps its slot (opacity 0.08, grayscale, `pointer-events: none`, `inert`, `aria-hidden`); positions are identical before and after a filter and after Reset; the "n of 12 metrics · picks" summary stays on the status line.
4. **Status wash**: card background as a horizontal linear gradient from white (left) to a pale status colour at 50 % alpha (right); flat, no shadow; the status chip stays. Tokens and contrast at the right edge below. (v5: Watch and Off track only; On track plain white.)
5. **Overall-status dot** (14 px, CSS keyframe pulse ring, static under `prefers-reduced-motion`) immediately before the three count pills, with a tooltip stating the rule and the current shares. The rule is computed over all 12 cards, filters ignored.
6. Everything else as v3: side bar + 360 px frosted menu (period / comparator / region switchers, five attribute groups, Reset), frosted pop-ups (explanation, drill, How to read, Notes) and drawer (More KPIs), one layer at a time, Esc / scrim / × close, focus trap and return, minimum text.

## Card size map

| Size | Grid | Card (w × h at 1440) | Value | Bars (v5, bottom-aligned) | Metrics |
|---|---|---|---|---|---|
| hero | span 2 of 6 | 437 × 236 | 44 px | 260 × 92 | Net sales · Total margin % · Weeks of cover (Tier 1, equal size; Net sales keeps the first slot) |
| medium | span 2 of 6 | 437 × 176 | 30 px | 180 × 62 | Markdown (off) · Availability (off) · EBITDA flash (watch, the bottom line) |
| small | span 1 of 6 | 213 × 168 | 26 px | 88 × 58 (none on Channel mix) | Like-for-like growth · Front gross margin · Sell-through · GMROI · Supplier OTIF · Channel mix |

Vertical budget at 1440 × 810: page padding 14 · header 62 · status line 40 · label 32 · hero 236 · label 32 · medium 176 · gap 12 · small 168 · bottom 16 = 788 ≤ 810 (measured grid bottom 761). Below 1200 px: 2 columns, every card span 1 with auto height, bars at 38 % width; below 720 px: 1 column.

## Status gradient tokens

`background: linear-gradient(90deg, #FFFFFF 0%, <pale> 100%)`, pale colour at 50 % alpha; the composite is the effective colour at the right edge on white.

| Status | Background | Composite at the right edge | ink #111827 | muted #5F6878 | status text |
|---|---|---|---|---|---|
| On track (v5) | plain `#FFFFFF`, 1 px #E5E7EB border | #FFFFFF | 17.4:1 | 5.6:1 | good #136C3A 6.6:1 |
| Watch | `rgba(255,211,160,.5)` wash | #FFE9D0 | 15.1:1 | 4.77:1 | watch #9A5B00 4.6:1 |
| Off track | `rgba(243,201,197,.5)` wash (pale of #B3261E) + 2 px #C0272D border | #F9E4E2 | 14.6:1 | 4.61:1 | off #C0272D 4.8:1 |

(v4 used `rgba(184,222,196,.5)` → #DCEEE2 on On-track cards; dropped in v5.)

A first attempt with `rgba(232,180,176,.5)` (composite #F4DAD8) failed at 4.24:1 for muted and 4.45:1 for the red Δ text and was lightened. Chips keep their own solid tints (v1 values) on top of the wash.

## Overall-status dot rule

Over all 12 cards, independent of filters: **red** if off-track cards ≥ 1/3 · else **orange** if watch + off-track > 50 % · else **green** if on-track ≥ 2/3 · else **orange**. Colours: green #2E9E5B, orange #E3A52A, red #B3261E. Thresholds are named constants in the script (`R.redOff`, `R.orangeWatchOff`, `R.greenGood`).

**With the current 7 / 3 / 2 the rule as written yields orange, not green**: off 2/12 = 17 % (< 1/3), watch + off 5/12 = 42 % (≤ 50 %), on track 7/12 = 58 % (< 2/3 = 67 %). The page shows orange and the tooltip states the shares. See open question 1 for the one-number change that makes it green.

## Side-bar inventory (unchanged from v3)

| Button | Opens | Contents | State on the bar |
|---|---|---|---|
| Filters (funnel) | 360 px frosted menu, left | Period · Comparator · Region / format (single-select, re-label the header) · Group · Lever · Horizon · Owner · Statement (multi-select) · Reset · Close | badge = active attribute picks; `aria-expanded` |
| How to read (?) | centred pop-up | six bullets (now mentioning the wash, the dot and conceal-in-place) | `aria-expanded` |
| More KPIs (grid +) | 460 px frosted drawer, right | the 20 bench KPIs by domain | `aria-expanded` |
| Notes (document) | centred pop-up | status rules table (12), margin logic, data contract, number corrections vs v1 | `aria-expanded` |

## Metric list with attributes

Attributes: **Group** (B1 base-crucial · B2 margin & cost · B3 stock & supply · B4 channel & customer) · **Lever** (sales · margin · stock · supply · cash) · **Horizon** (week · month · quarter) · **Owner** (commercial · supply chain · finance · digital) · **Statement** (P&L · balance sheet · operational).

| Size | Metric | Value · status | Group | Lever | Horizon | Owner | Statement | Drill page |
|---|---|---|---|---|---|---|---|---|
| hero | Net sales | €61.4m · Watch | B1 | sales | week | commercial | P&L | Sales |
| hero | Total margin % (prov.) | 36.3 % · On track | B1 | margin | month | finance | P&L | Margin |
| hero | Weeks of cover | 11.4 wks · Watch | B1 | stock | week | supply chain | balance sheet | Inventory |
| medium | Markdown % of gross sales | 9.8 % · Off track | B2 | margin | week | commercial | P&L | Margin |
| medium | Availability % | 94.1 % · Off track | B3 | supply | week | supply chain | operational | Inventory |
| medium | EBITDA flash (prov.) | €15.3m · Watch | B2 | margin | month | finance | P&L | Margin |
| small | Like-for-like growth % | +3.4 % · On track | B4 | sales | week | commercial | P&L | Sales |
| small | Front gross margin % | 30.1 % · On track | B2 | margin | week | finance | P&L | Margin |
| small | Sell-through % | 63.1 % · On track | B3 | stock | quarter | commercial | operational | Inventory |
| small | GMROI | 2.7× · On track | B3 | cash | quarter | finance | balance sheet | Inventory |
| small | Supplier OTIF % | 95.4 % · On track | B3 | supply | week | supply chain | operational | Supplier |
| small | Channel mix | 68.4 / 19.9 / 11.7 · On track | B4 | sales | month | digital | P&L | Channel & customer |

Owner mapping from v1 initials: CE / CM / RO → commercial, CF → finance, SC → supply chain, EC / MK → digital. The 20 bench KPIs (v1 Tier 3) are in the More KPIs drawer; Top category movers (Δ vs LY) is step 2 of the Net sales drill.

## Filter semantics

- Attribute chips: within one attribute **OR**, across attributes **AND**; a card stays revealed only if, for every attribute with a selection, its value is among the selected ones. Filtered-out cards are concealed in place (faded, non-interactive, out of the tab order); nothing moves. Reset reveals all.
- Switchers (period, comparator, region) are single-select and only re-label the header in the prototype; the Δ values are the Budget / Week 43 set.
- Active chips take the frosted-glass style with the accent tint; `aria-pressed` carries the state. Pure vanilla JS.

## Pop-up inventory (unchanged from v3)

Explanation (×12: value, Δ, labelled sparkline, 3 mini stats, What it is / Why it matters / Formula / Worked example / Status rule / Owner note, tags, footer, pill to the drill) · Drill path (×12: 3–4 steps, pill back) · Filters menu · How to read · Notes · More KPIs drawer · tooltips on status chips, side-bar buttons and the dot.

## Number corrections vs v1 (accepted by the USER)

Stock incl. on-order €168m → €490m; GMROI inputs €411m ÷ €152m → €1,016m ÷ €376m (2.7× unchanged); back margin €3.9m / 6.3 % → €3.8m / 6.2 %; channel shares → 68.4 / 19.9 / 11.7; weeks-of-cover rule On track ±1 wk · Watch 1–2 · Off beyond 2; Channel mix owner digital.

## Render check (2026-10-27, v5)

Headless Chromium via Python Playwright, 31 checks, all pass, 0 console / page errors: fold 761 px, no page scroll; On-track cards `background-image: none`, white; Watch / Off cards keep the `linear-gradient(90deg, #fff …)`; exactly Markdown and Availability carry a 2 px `rgb(192,39,45)` border, every other card 1 px grey, Off cards the same outer height as their siblings; no `svg.spark` / mix bar on Channel mix while value, Δ and chip remain; bar heights 92 / 62 / 58 px (= v4 ÷ 2 ± 2), bottom gap to the padding line 0 px, right-aligned, ≤ 50 % of the body; dotted target in every chart; info buttons hold an SVG with no text and `font-style: normal`; drill buttons hold a two-circle SVG, tooltip "Drill path", 28 px, bottom-left; tooltip on focus; explanation → drill (4 steps) → back pills with SVG icons; Esc with focus return; Channel mix pop-up still shows the horizontal mix bar; B3 filter conceals 8 cards in place; dot still orange; no Georgia / italic glyph in the source; no external script; no horizontal scroll at 1000 px.

## Render check (2026-10-27, v4, superseded)

Headless Chromium via Python Playwright, 38 checks, all pass, 0 console / page errors: contrast at the right edge of each wash (ink, muted, own status text ≥ 4.5:1); grid bottom 761 px and no page scroll at 1440 × 810; three equal hero cards taller than medium, medium wider and taller than small, each group uniform; buttons within 17 px of the left and 12 px of the bottom edge; hero bars right-aligned at 184 px = 91 % of the body below the title; medium 124 px, small 116 px; Channel mix vertical bar; every card a `linear-gradient(90deg, #fff …)` with the status-specific rgba; no box-shadow; dot colour orange with 7 / 3 / 2, pulse animation present, static under reduced motion, tooltip with the rule; card rectangles identical before / after (B1 OR B4) AND Sales and after Reset; 9 cards dimmed with `inert` + `aria-hidden`, still `display` ≠ none, opacity < 0.2; summary "3 of 12"; dot unaffected by filters; explanation and drill pop-ups, Esc with focus return, Notes, drawer replacing Notes (one at a time), How to read, focus trapped over 30 Tabs; small-card chip tooltip and `aria-label`; `@supports` fallback; no external script; 2 columns and no horizontal scroll at 1000 px.

Not verified: backdrop-filter and the gradient rendering outside Chromium; screen-reader behaviour of `inert`; the page on a real 1440 × 810 window with browser chrome.

## Open questions for the USER (≤ 8)

1. **Dot threshold** - the rule as written gives orange for 7 / 3 / 2 (on track 58 % < 2/3). Keep the rule (orange now), or set the green threshold to "on track > 50 %" (one constant, `R.greenGood = 0.5`) so the current state reads green as intended? *Default: keep 2/3 until the USER decides.*
2. **Hero hierarchy** - the three Tier-1 cards are equal; make Net sales larger (e.g. span 3 + 2 + 1, or a taller row) as a 2-level hierarchy? *Default: equal.*
3. **Medium set** - Markdown and Availability (off track) plus EBITDA flash as the third medium; alternative: Like-for-like growth. *Default: EBITDA.*
4. **Concealment style** - faded in place (opacity 0.08 + grayscale) vs a flat empty slot of the same size? *Default: faded.*
5. **Wash strength** - 50 % alpha of the pale tones; lighter (30 %) would read calmer, stronger would fail the 4.5:1 muted-text check on the off card. *Default: 50 %.*
6. **Small-card chips** - glyph-only on the six small cards (word in tooltip / aria-label); keep, or show the word and drop the sub-title permanently? *Default: glyph-only.*
7. **Switchers are label-only** - period / comparator / region re-label the header; Δ values stay the Budget / Week 43 set. *Default: label-only until a build.*
8. **v1 open questions and build risks** (retail calendar, currency, private label, back-margin method, THE number, availability definition, channels, landed cost; LY week key, grain, Power BI card-visual limits) keep their defaults. Anything to change?
