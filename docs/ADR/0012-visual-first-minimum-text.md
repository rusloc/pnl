# ADR-0012 — Visual first, minimum text: the presentation rule for every report and design artefact

- **Status:** **Accepted** (USER directive 2026-10-27; formulated as an ADR on the USER's request the same day)
- **Date:** 2026-10-27
- **Decider:** USER
- **Applies to:** every design artefact under `docs/design/`, every report view in Tracks A (Rayfin), B (Power BI) and C (JS), the ACME Trucks report, the Mirelo Sales & Revenue drafts and the Nordmark reseller executive dashboard, and any future showcase.
- **Amends:** `docs/design/design-requirements.md` §1 Principles (rule appended 2026-10-27) · `docs/design/kpi-card-v2.md` (no sparklines, already decided in ADR-0007 §3a; now generalised) · `docs/design/sales-revenue dashboard/design-tokens.md` (card anatomy: no corner marker, no in-card sparkline) · ADR-0004 (layout stays; this ADR adds the text budget and the pop-up rule).
- **Supersedes nothing**; it narrows how pages may carry text.

## 1. Context

Two review rounds on 2026-10-26 / 27 ended with the same USER verdict on otherwise different artefacts: the first P&L three-view redesign (`docs/design/P&L views redesign/`) and the first reseller executive dashboard prototype (`docs/design/executive dashboard (reseller)/`) were "overloaded with text". Explanations, formulas, caveats, decision notes and source tags sat on card faces, in strips between rows and in footers; sparklines inside KPI cards added visual noise without a readable scale; filter bars took two lines of the window. The USER's words: *all designs ARE VISUAL — minimum text; no long bars with text explanations of numbers; only ⓘ and "How to read" buttons that show pop-ups.* The reworked versions (P&L v2: visible words −51 … −63 %; exec dashboard v3: side-bar menu, fold met) were accepted, so the rule is proven on two artefacts.

## 2. Decision

1. **Every page is visual.** The reader gets the numbers and their status from values, deltas, colour and charts. Prose on the page is limited to: the view title, the header context line (period · currency · as-of, small and grey), one optional single-line headline on a status line, card titles, axis / legend labels and ≤ 6-word card notes.
2. **No explanatory text bars.** No strips, banners, intros, footnotes or "notes for the owner" sections between or under visuals. The applied-filters summary banner under a report title is removed (Track B keeps its applied-filters pop-up per ADR-0007 §3a).
3. **Card face = title · value · delta row(s) · status chip.** Sub-metrics, definitions, formulas, source measure / spec IDs, caveats and data-lineage go behind an **ⓘ button on every card and panel**; each view has one **"How to read"** button in the header or side bar. Drill paths may sit behind a second small button (↗).
4. **No sparklines or mini-line charts inside cards.** Real charts (bridges, waterfalls, lollipops, bubbles, heatmaps, trends) keep their own panels and may grow into the freed space. KPI card v2 (two diverging Δ rows) stays the house KPI card for the P&L; other reports use the same principle (value + Δ rows, no mini chart).
5. **Pop-ups and overlays are matte / frosted glass:** translucent white (≈ 60–65 %), backdrop blur ≈ 18–22 px, 1 px light border, subtle inner highlight, 16 px radius; `@supports not (backdrop-filter)` → solid 92 % white. One layer open at a time; Esc, click outside and × close; focus moves in and returns to the opener; Tab trapped. Power BI: tooltip pages and bookmark pop-ups styled as close as the platform allows (solid panel with the same border / radius; blur is not available).
6. **Filters collapse into one side bar** when a view carries more than a handful of controls: a narrow bar (≈ 56 px) of icon buttons; the main button opens a glass menu (≈ 360 px) holding every slicer, switcher and attribute filter, with a reset and an active-count badge; a one-line active-filter summary may sit on the status line. Applying a filter never reflows the remaining cards: hidden cards are concealed in place.
7. **Card size follows metric importance** (hero / medium / small), as on the P&L Key figures view; the arrangement is fixed per view.
8. **Non-actionable decoration is removed** (e.g. the dark corner marker on Mirelo cards).

## 3. Consequences

- **Design artefacts:** P&L three-view redesign v3 and exec dashboard v4 are the reference implementations; the Mirelo mockup, design tokens and layout spec are updated (no banner, no marker, no hero sparklines).
- **Tracks:** the P&L tracks already comply on the statement and Key figures views (ADR-0007); the Analysis / Profitability views and the Mirelo drafts (Track B SVG hero cards, Track C hero cards) lose their in-card sparklines in the next build round. Track B must express the glass style with solid panels; this is an accepted platform difference (add to `docs/design/parity-rules.md`).
- **Specs:** USER specs that ask for sparklines in tiles (e.g. the KPI page spec §4) are read as "value + Δ rows"; the spec stays a checklist, the house rule wins (same reading as ADR-0007 §3a).
- **Review checklist (every design hand-back):** count visible words per view; no in-card sparklines; no banners / footers / intros; every card has an ⓘ; one "How to read" per view; filters in the side bar when > 5 controls; pop-ups glass with fallback; cards concealed in place on filter.
- **Risk:** information that lived on the page now needs one click; the "How to read" pop-up must make the view self-explanatory for a first-time vosk.dev visitor (N-07: meaning never by colour alone still applies on the card face).

## 4. Alternatives considered

| Alternative | Why not |
|---|---|
| Keep explanations on the page, shorter | The USER rejected two shortened versions; the reading task is the numbers, not the prose |
| Sparklines kept but larger | A 12-point line without axis still has no readable scale; real trend charts exist on the Analysis views |
| Tooltips only (hover) | Not keyboard / touch reachable; the ⓘ button is explicit and works in all three tracks |
| Filters as a top bar (current P&L rail stays) | Two lines of chips broke the 810 px fold; the P&L rail is already a side bar and complies |
