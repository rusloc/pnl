# Track C — page top as Track B + period picker v2

- **From:** rusloc/pnl (Track C, nerd)
- **To:** vosk.dev repo agent
- **Date:** 2026-10-23
- **Status:** ready

Supplements `2026-10-22-track-c-handoff.md` and `2026-10-22-track-c-spec-change-adr-0007.md`. Design source in rusloc/pnl: `docs/design/period-picker-v2.md` (accepted by the USER 2026-10-23; Part 1 = period picker, Part 2 = one page top for all tracks, Track B is the reference). Code: `js-report/` on `prod`. If this note and those sources disagree, the sources win.

## 1. What changed

### Page top (design note Part 2)

| Area | Before (hand-off §8) | Now |
|---|---|---|
| Rail brand mark | Static "A" | Button "A▾" tinted in the company colour; accessible name and tooltip "Switch company"; opens the company picker (Consumer Products, Commerce Cloud, ACME Group; Group stays off until build step 4, with its reason). A choice applies and closes; Escape, ✕ and a click outside close; focus returns to the mark. Period, versions, currency and region carry across (F-31). This delivers item 4 of the ADR-0007 note. |
| Rail items | Summary text in the expanded rail | Same, plus a tooltip; the Period item's summary and tooltip are the picker's summary sentence. |
| Header, title row | Eyebrow "ACME Group · Management reporting · Actuals closed through …", title, context line (L-04), company cards | `Profit & loss` + a funnel button "Applied filters" that opens a pop-up; right-aligned status line `<Company> - Management reporting - Closed through <Mon YYYY> - Refreshed <d Mon YYYY HH:MM>`. Track C has no refresh: the stamp is `manifest.builtAt`, shown in the viewer's time zone. |
| Applied-filters pop-up | — | Rows as Track B: Company, Fiscal year, Period (= the summary sentence), Time view, Versions, Currency, FX basis, Units, Regions, Slices; then the C-50 notices as the last rows. While notices apply, the funnel carries a small count badge (as Track A) and its accessible name says "Applied filters (1 notice)". Escape, ✕, the funnel again or a click outside close it; focus returns to the funnel. |
| Header, tabs row | Tabs + toolbar (Layout, Cost lens, Detail) + Copy link | Tabs with the 3 px company-colour underline (unchanged) + Copy link on the right. The Layout / Cost lens / Detail controls are gone (ADR-0007 items 1–3; Track B has no statement toolbar). Their URL keys `lay`, `lens`, `d` still parse, so old links keep working. |
| Notice strip, context line, company cards | Shown | Removed. Notices are not lost: they are rows of the applied-filters pop-up (C-50; amendment of L-04 / L-05). |

Header copy separates with " - ", the summary sentence included (decided 2026-10-23, recorded in `docs/design/period-picker-v2.md`).

### Period picker v2 (design note Part 1)

Top to bottom: title "Period" + ✕ · live summary sentence (large, `aria-live="polite"`) · **Show** (One month, Quarter to date, Year to date, Last 12 months, Full year) · **Year** (2024, 2025, 2026, no "FY") · month grid labelled by the time view (One month: "Month"; Quarter / Year to date: "Up to"; Last 12 months: "Ending"; Full year: no grid, one line "Full year covers January to December.") · footer "Back to default" + "Done".

- Summary examples: `Showing Sep 2026` · `Showing Jul – Sep 2026 - quarter to date` · `Showing Jan – Sep 2026 - year to date` · `Showing Oct 2025 – Sep 2026 - last 12 months` · `Showing Jan – Dec 2025 - full year`.
- **The sentence names the months the numbers contain** (decided 2026-10-23, Track A first, matches the model's `_Window Label`): the window is clipped to the data history, and under base Actual it is cut at the last close (C-01). At close Sep 2026: Full year 2026 under Actual → `Showing Jan – Sep 2026 - full year`, under Latest estimate / Budget → `Showing Jan – Dec 2026 - full year`; Year to date or Last 12 months ending Dec 2026 under Actual → cut at Sep; nothing closed in the window under Actual → `Showing no closed month yet` (plus ` - quarter to date` etc. for windows longer than one month, as Track A).
- Covered months are shaded in the company tint, the selected month is solid. Last 12 months crossing a year shades the selected year's part; the summary names the whole range.
- Open months (after the last close): base Actual → shown but not selectable, "not closed yet" under the name, tooltip "Switch the base to Latest estimate to include forecast months."; base Latest estimate → selectable, "forecast"; base Budget → selectable, "budget". No dashed borders, no footnote.
- Keyboard: each row is a radiogroup; arrow keys move focus (→ / ↓ next, ← / ↑ previous, wrapping, open months under Actual skipped), Space or Enter selects; only the checked option is in the tab order. Selection applies at once; Done only closes; Escape closes and focus returns to the rail item.
- "Back to default" restores Year to date, the current fiscal year and the last closed month (F-02 … F-04, unchanged defaults).

## 2. Engine API additions (`js-report/lib/engine/index.ts`)

```ts
engine.period(sel)              // → PeriodView: summary, timeViews, years, gridLabel, fullYearNote, months[], openMonthHint
engine.header(sel, timeZone?)   // → { status, filters: { label, value }[] }; timeZone defaults to the viewer's
```

- Pure modules: `lib/engine/period.ts` (`periodSummary`, `periodView`, `TIME_VIEW_LABEL`) and `lib/engine/header.ts` (`headerStatus`, `appliedFilters`, `companyName`, `formatStamp`). Every month name, year, company name and unit name comes from the manifest; no hard-coded numbers.
- Unchanged: `statement`, `notices`, `dataStatus`. `context(sel)` still exists but the UI no longer shows it (the pop-up replaced the context line).
- `BASE_LABEL` / `COMPARE_LABEL` are now exported from `lib/engine/notices.ts`.

## 3. URL state and selection semantics

No change. Same keys, same Zod validation, same defaults, same `restrictToBuilt()`. The new controls write the same fields (`tv`, `fy`, `m`, `e`).

## 4. Deviations from the design note

All accepted by the main agent on 2026-10-23 (recorded in `docs/design/period-picker-v2.md`).

1. **Separator in the summary sentence:** " - " (decided), e.g. `Showing Jan – Sep 2026 - year to date`; the en dash inside a month range stays.
2. **Pop-up rows:** all ten Track B rows are kept for parity, so Fiscal year and Time view repeat what the Period sentence says. Fiscal year shows the plain year `2026` in every track.
3. **Copy link** stays on the tabs row (F-37). Track B has no share link (deferred there).
4. **Open-month hint:** a hover tooltip and the accessible description. The design note says "hover / focus", but disabled months are skipped by the arrow keys, so they never take keyboard focus.
5. **Show row** is a 2-column grid: the five plain labels do not fit one row of the 352 px flyout.
6. **Under base Actual**, open months inside the window are not shaded (C-01 drops them), and the summary names the cut window (see §1); the "Actual covers closed months only" notice is in the pop-up.
7. **Last 12 months before the data history** (e.g. Mar 2024): the summary is clipped to the data, `Showing Jan – Mar 2024 - last 12 months` (parity with Track A); the existing notice says it covers fewer months.
8. **Expand all / Collapse all** (ADR-0007 item 3) is not part of this change; it stays on the build-step list.

## 5. Status

- Gate green in rusloc/pnl: `npm run lint`, `npm run typecheck`, `npm run build` (static prerender of `/`), `npm test`.
- **Tests: 145 passing in 14 Vitest files** (was 94 in 11). New: `lib/engine/period.test.ts` (summary for every time view and base incl. the C-01 cut, LTM across years and before the history, grid labels, Full year line, covered months, open months per base), `lib/engine/header.test.ts` (status line, time-zone stamp, pop-up rows), `components/PageTop.test.tsx` (server render of the picker, header, pop-up, rail, company picker and the notice-count badge; arrow-key step function).
- **Not click-tested in a browser** (no browser in this session): focus moves, Escape, outside click and arrow keys need the click-test from hand-off §8 before release.
- `.sync/track-c/data/` was not refreshed: the data and the manifest schema did not change.
