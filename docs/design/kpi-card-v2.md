# KPI card v2 — Key figures (Tracks A and B)

USER request 2026-10-22: remove the sparklines from every tile; make the comparison against Budget and Prior year cleaner and readable at a glance. Supersedes the K-24 sparkline and the K-25 target bar (ADR-0007 §2.5); amendment recorded in ADR-0007. Tokens and type come from `docs/design/design-requirements.md`.

## Card anatomy (top to bottom)

1. **Label** (14/500 Slate 600). The one-line definition moves to the native tooltip on the label.
2. **Value** (34/600 financial, 28/600 operational, tabular). Sub-line (margin, or reported growth for growth KPIs) stays under the value at 12 Slate 600 where it exists today.
3. **Two comparison rows**, "vs Budget" and "vs Prior year" (the Compare A / Compare B names), each on one line:

```
vs Budget       ◀───────┃██████▶     +2.0%
vs Prior year   ◀────██┃───────▶     −1.4%
```

   - Name on the left (13 Slate 600, fixed width).
   - A **diverging bar** in the middle: a centre line at 0 (1 px Ink 900 at 40 %), track Line 100, height 8, radius 2. The bar grows right when the difference is favourable and left when it is unfavourable, so "right = good" holds on every tile, whatever the sign of the KPI. Fill: favourable `#3BA37B`, unfavourable `#E2804A`, neutral KPIs (K-21) Slate 400 and always drawn to the right of the line by absolute size.
   - The Δ text on the right (13/600, coloured like the bar): amount KPIs Δ %, percent KPIs Δ pp (K-20). Arrow ▲/▼ before the number.
   - Scale: the same for both rows of a card and for every card in a row, so lengths compare: ±20 % for Δ % and ±5 pp for Δ pp, with the bar capped at the end of the track and a small chevron when capped.
   - Compare = None → that row is hidden; no data → the row shows "n/a" with no bar.
4. **Growth KPIs** (organic growth, volume growth, price / mix): there is no Budget / PY comparison (K-20). They show the value and the sub-line only; no comparison rows.

## Rules

- No sparklines, no target bars, no extra queries: the card uses only the values the tile already has (Q2b in Track A; the existing KPI measures in Track B).
- Colour never carries meaning alone: the arrow and the sign carry it too (N-08).
- Cards in a row share the same height.
