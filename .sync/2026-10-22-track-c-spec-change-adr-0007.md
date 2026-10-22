from: rusloc/pnl (main agent) · to: vosk.dev repo agent (Track C) · date: 2026-10-22 · status: ready

# Track C spec change — ADR-0007 (supplements `2026-10-22-track-c-handoff.md`)

The USER accepted ADR-0007 on 2026-10-22. It changes the spec that the Track C hand-off builds against. Source of truth in rusloc/pnl: `docs/ADR/0007-simplified-statement-and-key-figures.md` and `docs/Requirements.md` (each change marked "ADR-0007"). Pop-up text: `docs/ADD/features/info-popovers.md` (use it verbatim).

## What changes for Track C

| # | Change | Spec IDs | Effect on the skeleton / build steps 4–9 |
|---|---|---|---|
| 1 | Layout switch removed: Variance only, for every entity including ACME Group | F-18, §4, M-16, L-10 | Drop the Trend and Entity-columns layouts from step 4. Group view = Variance columns, with entity nodes and the Intercompany eliminations node inside blocks (M-05). Remove the disabled layout options from the toolbar. |
| 2 | Cost lens removed: By function only | F-19, M-23, M-24, T-04 | Drop the By-nature lens from step 8 and T-04. `bridge_account_nature` stays in the data (T-07) but nothing displays it. |
| 3 | Detail levels replaced by Expand all / Collapse all buttons above the line column; default collapsed | F-20, M-20, M-21 | Replace the Summary / Standard / Full toggle. Rows still toggle individually; the state persists across filter changes and resets to collapsed on entity change. |
| 4 | Entity switch moves to the brand mark at the top of the rail | L-01, F-01 | Remove the company cards from the header. The mark opens the entity picker (single select, F-30 / F-31 kept), is tinted in the selected company's identity colour, has a small ▾, and has the accessible name / tooltip "Switch company". The context line names the company. |
| 5 | Key figures: sparkline on all 12 tiles + target bar | K-24, K-25 | Sparkline = the KPI's monthly value for the 13 months ending at the selected month, base version, all filters; open Actual months blank; selected month marked. Target bar = base value with Compare A / B ticks; growth KPIs get the sparkline only. Tile values render first, trends after. The engine can compute the monthly series directly (no backend), so performance is not a concern in Track C. |
| 6 | (i) info pop-ups on 4 visuals | L-15 | Net revenue bridge, Largest variances, Profitability by {breakdown}, Contribution margin by {breakdown}: an (i) button in the title row opens the four-part text from `info-popovers.md`, with `{comparison}` / `{breakdown}` filled from state. Closes on Escape, ✕ and outside click; keyboard-operable (N-08). |

## Unchanged

Everything else in the hand-off: data artifacts, engine API, URL state (drop the layout / lens / detail keys from the Selection schema, or keep them ignored for old links), embed contract, CSP, test status, the deferred list.
