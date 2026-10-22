# ADR-0007 — Simplified statement controls, entity switch on the brand mark, Key figures trends, info pop-ups

- **Status:** accepted (decided by the USER, 2026-10-22)
- **Date:** 2026-10-22
- **Decider:** USER
- **Applies to:** Track A (fin), Track B (bip), Track C (spec-change note in `.sync/` for the vosk.dev repo agent)
- **Spec:** `docs/Requirements.md` §2, §4, §5, §6, §10 (edited in place, each change marked "ADR-0007") · design guide `docs/design/design-requirements.md` · pop-up copy `docs/ADD/features/info-popovers.md`

## 1. Context

The showcase audience is mostly non-finance visitors. The statement toolbar carried three switches (Layout, Cost lens, Detail), and two of them are not built in Track A anyway. The company cards take header space, the brand mark at the top of the rail does nothing, the Key figures tiles show one number and no dynamics, and the Analysis and Profitability visuals have no explanation for a beginner.

## 2. Decision

1. **Layout switch removed (F-18).** The statement has one layout, Variance, for every entity including ACME Group. Trend and Entity columns are dropped (§4 table, M-16, the L-10 exception). The Group view keeps the M-05 entity nodes inside blocks; eliminations stay visible as the Intercompany eliminations node, the bridge's eliminations step and the K-05 Group tile.
2. **Cost lens removed (F-19).** By function only; By nature (M-23, M-24) and T-04 are dropped. The data keeps `bridge_account_nature` (T-07 unchanged); no track reads it for display.
3. **Detail levels replaced (F-20, M-20).** Two buttons above the line column: **Expand all** (every leaf open) and **Collapse all** (blocks and subtotals only). **Default: collapsed.** Any row with children still toggles on its own. Expansion state persists across filter changes and resets to collapsed on entity change (M-21).
4. **Entity switch moves to the brand mark (L-01, F-01).** The 36 × 36 mark at the top of the rail opens the entity picker (Consumer Products · Commerce Cloud · ACME Group, single select, same behaviour as F-01 / F-30 / F-31). The mark carries the selected company's identity colour and a small ▾, has the tooltip / accessible name "Switch company", and the header context line (L-04) names the current company. The three company cards leave the header.
5. **Key figures trends, all 12 tiles (new K-24, K-25).**
   - K-24 Each tile adds a sparkline: the KPI's monthly value for the 13 months ending at the selected month, base version, same filters (K-22). Open months of Actual are blank; the selected month's point is marked. Period-end KPIs plot month-end values (K-23); ratio KPIs plot the monthly ratio; growth KPIs plot monthly growth vs prior year.
   - K-25 Tiles with a Compare A / Compare B value add a thin target bar: the base value as the bar, Compare A and Compare B as tick marks, labelled with the comparison names. Growth KPIs (no Δ, K-20 secondary line) show the sparkline only.
   - Loading: tile values first; trends fill in after (progressive), so the tiles never wait for the sparklines.
6. **Info pop-ups (new L-15).** An (i) button in the title row of four visuals — Net revenue bridge, Largest variances, Profitability by {breakdown}, Contribution margin by {breakdown} — opens a small pop-up with four parts: what it shows · how to read it · an example · one watch-out. The text is the same in every track and lives in `docs/ADD/features/info-popovers.md`. Keyboard-operable, closes on Escape and outside click (N-08).

## 3. Consequences

- Fewer controls; every remaining control works in every track.
- Lost: the monthly column view (partly replaced by the sparklines), the CP + CC − IC = Group column view, the by-nature cost view and its IFRS 18 talking point.
- Track A: removes the "not built yet" Trend / Entity-columns / By-nature paths. The sparklines need monthly KPI values for 12 KPIs × 13 months; bip provides one efficient model measure or query shape for that (contract in bip's hand-back), ginee republishes. Performance budget for the trends: they load after the tile values and must not slow the values down.
- Track B: removes the Layout / Cost lens / Detail toolbar items and their bookmarks; the matrix gets Expand all / Collapse all buttons (bookmarks of the matrix expansion state); entity picker as a pop-up from the rail mark; tile sparklines; (i) buttons as pop-ups or tooltips. Any by-nature or trend-only measures that become unused are removed with the measure dictionary updated.
- Track C: the vosk.dev agent gets a spec-change note in `.sync/`; the skeleton's toolbar already shows only Variance / By function.
- Acceptance tests: T-04 dropped. T-01 / T-02 stay (checked through measures and tests, no longer through the Entity columns layout).

## 4. Alternatives considered

| Alternative | Why not |
|---|---|
| Keep the switches, finish Trend / Entity columns / By nature in Track A | More controls for a beginner audience and days of work across three tracks for views the USER does not want |
| Sparklines on the 8 financial tiles only | USER chose all 12 |
| Entity cards kept in the header next to the mark | Duplicates the control and keeps the header crowded |
