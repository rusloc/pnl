# Cross-track parity rules (A · B · C)

> Status: accepted (main agent, 2026-10-23, from hunter's parity audit). Applies to Track A (`fabric-app/`), Track B (`pbi-report/ACME Unified PnL/`) and Track C (`js-report/`). All three are shown on vosk.dev/work, so the same selection must read the same in every track.
> Track B is the reference for copy and layout unless a rule below says otherwise. Related: `docs/design/period-picker-v2.md`, `docs/design/kpi-card-v2.md`, ADR-0004, ADR-0007.

## Numbers

1. **Analysis comparison = C-40 in every track:** Compare A, else Compare B, else Prior year. No separate Analysis toggle (Track A's `analysisCompare` goes). Profitability's "vs …" uses the same comparison.
2. **Hide empty lines (M-22)** rounds in the selected units (millions or thousands), on the columns that are visible.
3. A test must never assert a known bug. Fixtures captured before a model fix are re-captured after the fix is published.

## Defaults

4. **Profitability breakdown default = Region** for every company (F-21, ADR-0007 §3a).
5. **Statement opens collapsed** with Expand all / Collapse all (M-20, M-21).

## Copy

6. **Separator " - "** in every header, rail, picker and pop-up text. " · " is not used anywhere in UI copy. The en dash "–" stays inside ranges ("Jan – Sep").
7. **Period summary sentence** always starts with "Showing" (panel, rail tooltip, applied-filters Period row, expanded-rail summary). Nothing covered → exactly `Showing no closed month yet` (no time-view tail).
8. **Rail Versions summary** with no comparison: `Actual only` (Track B wording).
9. **Notice rows** in the applied-filters pop-up: one row per notice, labelled as Track B does (`Cut-off`, `Forecast`, `Prior year`, `History`, `Allocation`, `Eliminations`), notice text copied from Track B's `Notices` / `_Notice Row`; no row at all when none applies (no "None for this selection").
10. **Slice values** (regions, channels, …) are listed in the dimension's `sort_order`, not alphabetically, in rail summaries and the pop-up.
11. **Statement rows** use Track B's numbered top level (`01. GROSS REVENUE` … `29. NET MARGIN %`, `dim_pl_row[line_display]`); accounts keep their names.
12. **Column-group titles** follow Track B: `<window> - <version>`, e.g. `YTD Sep 2026 - Actual`, `Full year 2026 - Budget`.
13. **Subtitles and captions are built from the selection**, never hard-coded (statement footnote, Vitals (formerly Key figures) caption "Changes vs <Compare A> and <Compare B>, same months", Profitability subtitle = the period summary without "Showing" + currency and units).
14. **Units buttons** show the selected currency's symbol (`$m / $k`, `€m / €k`, `£m / £k`).
15. **KPI arrows** show the direction of the change (▲ up, ▼ down); colour shows favourable / unfavourable. The legend says exactly that: "▲ up / ▼ down - green = favourable, orange = unfavourable" (" - " per rule 6).
16. **Info pop-ups** use `docs/ADD/features/info-popovers.md` verbatim; the `{comparison}` placeholder is lower case ("from budget", "from latest estimate"). Superseded on the redesigned views by rules 18–21 (2026-10-27).
17. **Compare = None:** the column group is dropped (Tracks A and C); Track B keeps an empty group with "none" (native limit, accepted).

### ADR-0012 / P&L views redesign v4 (2026-10-27)

18. **ⓘ per card and per panel:** every Vitals card and every Analysis / Profitability panel has one ⓘ; it shows the name, what it shows and the formula or sub-metrics (the card face keeps title · value · Δ rows · status chip only). Track B: hover tooltip page; Tracks A and C: pop-over on click / hover.
19. **One How to read per view** (Vitals, Analysis, Profitability) holds the reading guide; no prose strips on the canvas.
20. **Pager:** Analysis and Profitability have two pages each, switched by ‹ › with the text "n / 2" next to the tabs; the P&L statement and Vitals have one page.
21. **Glass = solid panel in Track B:** frosted-glass panels of the HTML design are solid white panels with the Ledger border in Power BI (native limit, accepted).

Track A (2026-10-27, `fabric-app/`, see `docs/ADD/features/track-a-pnl-views.md`): 18 — one ⓘ per Vitals card and per panel (`components/info-popover.tsx`; copy = `dim_pl_info` verbatim for panels, `dim_kpi` definition + `KPI Info Sub` for cards, source line per card); 19 — one "How to read" per view in the tabs row (`components/how-to-read.tsx`, lines after Track C's `view-copy.ts`, opening with the selection sentence); 20 — `Pager` next to the tabs on Analysis / Profitability, ← → keys page too, each view remembers its page; 21 — glass dialogs with the `@supports` solid fallback (`components/glass-dialog.tsx`), one layer open at a time, Esc / outside click / × close, Tab trapped, focus returned.

## Accepted platform differences

- Track B: open months under Actual stay selectable (shown "not closed yet"); no Escape / radiogroup keys in flyouts; no notice-count badge on the funnel; shading in a strip under the month grid; Hide empty lines hides only rows whose values are all blank (a leaf that rounds to 0.0 in every column stays visible: doing rule 2 natively would make every column measure evaluate all the others and undo the ADR-0008 speed-up).
- Track C: "Copy link" on the tabs row (F-37).
- Nordmark Exec (2026-10-30, ADR-0013 (l) "Doc alignment", E-53 / E-91): **the FY row of the period picker at Year** — the JS flavour hides the FY row and offers the two FY items (`FY2025`, `FY2026 · to date`) as the item chips; the Power BI flavour keeps the FY row (`menu_item_fy`), which then drives the single Year chip, because a slicer cannot select a value on behalf of another slicer. Same items, same windows, same header; only the picker rows differ.
- Nordmark Exec (2026-10-30, ADR-0013 (l), E-103): **the Category dropdown's closed-state wording** — the JS shows "All categories" in the closed dropdown and as the clearing option; the Power BI dropdown slicer shows its native "All" when nothing is picked. Same semantics (no pick = All, all 9 ticked = All), same header segment, same numbers.
- Nordmark Exec (2026-10-30, hunter parity run): **small-card sub-titles below 1200 px** — the 6 small cards (LFL growth, Front GM, Sell-through, GMROI, Supplier OTIF, Channel mix) have no sub-title in Power BI; the JS engine still emits one ("vs LY week", "% of net sales" …) and hides it from 1200 px up (`.sm .ch h3 span`, as the v5 prototype), so at the 1440 × 810 embed both show none. Below 1200 px only the JS shows it.

## Check

hunter's parity check (`js-report/lib/test-utils/parity/` (`parity_selections.csv` for the P&L, `parity_selections_mirelo.csv` for Mirelo, run by `parity.test.ts`; Track B runs the same rows as DAX, see `docs/ADD/features/parity-check-2026-10-27.md`): expected copy and numbers per selection, run by every track) is the gate once built: a feature is implemented only when its rows pass in every track that has the view.
