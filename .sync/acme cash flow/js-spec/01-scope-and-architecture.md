# 01 · Scope and architecture

from rusloc/pnl (archi) · to vosk.dev repo agent · 2026-11-26 · status: ready

## 1. Scope

One page, no routes besides `/`, English only, light theme only, a fixed 1440 × 810 board.

| Part | Content |
| --- | --- |
| Shell | period square (top left), title + context line, three-step path, menu square (top right) |
| KPI row | Closing cash, Net change, Operating cash flow, Free cash flow, Cash conversion, DSO; on every view |
| View 1 · Statement | indirect statement of cash flows with the S01 override on: opening cash, three expandable activities, net change, closing cash; one bar per row on a shared axis; % of net income |
| View 2 · Activities | one activity at a time (tabs): direct-method lines × calendar days as a heatmap of square cells, five equal-count colour blocks, a totals column |
| View 3 · Transactions | the cash movements behind an activity, a line or one line-day |
| Pop-ups | calendar + units, menu, ⓘ definitions (11), How to read, Cash (balance + three activities), Diagram, Reconciliation |

The numbers: statement, KPIs and Reconciliation tie to `checks/control_totals_usd.csv` to the cent (`05` § 3).

## 2. Non-goals

Do not build these. Each is absent from the accepted mock; several are in the USER's source spec (`../spec/Tab 1.md`) and were cut or deferred.

- Level 4 (single transaction: split lines, linked documents, audit times, "Open in QuickBooks").
- Filters: bank account, class, location, customer, vendor. Search. Sorting or column picks on the ledger.
- Direct statement layout and the indirect ⇄ direct toggle; the override-off (QBO default) view; the bank-only cash definition.
- Comparison, change, share and trend columns on the statement; columns by month; custom date ranges.
- Exceptions panel, status strip, sign-off, the C01–C10 checks as UI (Reconciliation shows the control-total ties only).
- Measures M11–M14 and M18–M20 as visible figures (M17 appears in the Diagram as CFO margin).
- Sparklines anywhere (ADR-0012), cash bridge waterfall, monthly rhythm chart, bank bridge.
- Export (PDF, Excel, CSV), print layout, copy-link control.
- Dark theme, other palettes (Ravlo, Loftra, Rotava were dropped in round 4), layouts narrower than the board.
- Any backend, API route, server action, auth, cookie, storage, analytics, AI chat.
- Hosting, deploy and embed wrapper decisions beyond the contract in `05` § 2: those are the site repo's.

## 3. Where the mock replaced the USER's source spec

`../spec/Tab 1.md` stays a checklist. On these points the accepted mock wins:

| Tab 1 | Mock (build this) |
| --- | --- |
| § 6: one page that expands in place, detail panel sliding in on the right | three full-panel views on a fixed path; the KPI row stays, the panel content changes |
| § 6: global controls bar (period, comparison, columns, view, cash definition, filters) | period + units in the calendar pop-up; nothing else (ADR-0012: controls in menus) |
| § 6.1: six roll-forward tiles with sparklines, cash bridge, monthly rhythm, bank bridge, status strip | six KPI cards (title, value, one delta, ⓘ), no sparklines; the roll-forward lives in the Cash pop-up |
| § 6.2: columns current, comparison, change, change %, share of section, trend | amount, bar (absolute, shared axis), % of net income |
| § 6.3 Level 2: line detail (gross in / out, top counterparties, 12-month bars) | Activities: lines × days heatmap |
| § 6.4 Level 3: two columns Cash in / Cash out, sortable, searchable, exportable | one signed Amount column (parentheses = out), fixed order, in / out as summary tiles |
| § 6.5 Level 4 | not built |
| § 8.3: M15–M20 health indicators | M15, M16, M17 plus DSO, DPO, cash conversion cycle, capex intensity and coverage, DSCR, net debt ÷ EBITDA, payout cover, accruals (definitions in `02` § 3.5); M18–M20 not shown |
| § 8.4: change % blank rules | deltas are absolute differences only |
| § 11.1: one sans family; 14 / 16 px rows | Space Grotesk for text, JetBrains Mono for figures; sizes in `04` § 3 |
| § 11.2: indent 16 px, rows 32 / 40 px, state remembered per user | indent 18 px, rows 26 / 30 / 32 / 38 px, state in the URL only |
| § 11.3: one hue for in, one for out; green / amber / red status; light and dark | four Orbya colours and listed mixes; no status colours; light only |
| § 11.5: breadcrumb section › line › counterparty › transaction | fixed path Statement › Activities › Transactions |
| § 11.1: Level 4 always shows cents | the ledger shows cents in USD and one decimal in USD k (`05` § 5, Q-11) |

## 4. Architecture

```
generator pack (.sync/data-gen/acme-cash-flow/: parquet/ + checks/)
        │  scripts/build-cash-flow-data.ts   (Node, at author time; asserts AT-01)
        ▼
public/data/  manifest.json + 4 Parquet files, ~75 kB, committed
        │  fetch at first paint (lib/data: Zod manifest, column specs)
        ▼
lib/engine/   pure TypeScript: calendar · statement · direct lines · heat · metrics ·
              quintiles · formats · copy · view models · URL codec · navigation · self-check
        │  view models (plain objects: rows, labels, formatted strings, geometry ratios)
        ▼
components/   one client root + views + pop-ups: layout, DOM, focus, events only
```

Folder layout of the standalone app (if the site repo folds the report into its own tree, keep the same module boundaries and names):

```
app/
  layout.tsx            fonts via next/font, metadata
  page.tsx              static shell
  globals.css           tokens (04 § 1) and styles
components/
  CashFlowApp.tsx       the only client root: data load, URL ↔ state, layer routing
  Shell.tsx  KpiRow.tsx
  StatementView.tsx  ActivitiesView.tsx  TransactionsView.tsx
  popups/               Popup.tsx (glass, focus, scrim) · Calendar · Menu · Info · HowToRead · CashPopup · Diagram · Reconciliation
  Tooltip.tsx
lib/engine/
  calendar.ts           periods, prior windows, quick handles, control keys
  statement.ts          indirect statement, row list, % of NI, bar axis
  direct.ts             line totals, section flows, heat grid, ledger filter
  quintile.ts           equal-count blocks
  metrics.ts            KPIs and Diagram metrics
  format.ts             money, ratios, days, dates
  view.ts               view models per view and pop-up (strings ready to print)
  copy.ts               every string on the page
  nav.ts                view stack reducer
  url-state.ts          Zod codec
  self-check.ts         ties to the control totals
  tokens.ts             the palette as constants (tests)
lib/data/
  manifest.ts           Zod contract of public/data
  loader.ts             fetch + decode
  parquet-columns.ts    column readers
scripts/
  build-cash-flow-data.ts
public/data/            generated, committed
fixtures/checks/control_totals_usd.csv
```

| ID | Requirement | Src |
| --- | --- | --- |
| CF-ARC-01 | Next.js 16 App Router, React 19, TypeScript strict (`noUncheckedIndexedAccess`). `/` is static. No API routes, server actions, middleware or server-side data access. | ADR-0002 |
| CF-ARC-02 | `lib/engine/` is framework-free: no React, DOM, `window`, `fetch`, `Date.now()` or `Intl` locale default (pass `en-US`). It runs unchanged in Vitest (Node). | ADR-0002 |
| CF-ARC-03 | Every number and every string on the page comes from the engine. Components do no arithmetic on business values; they may turn an engine ratio (0–1) into pixels. | ADR-0002 |
| CF-ARC-04 | Engine functions are pure over a `Dataset` value built once by the loader. No module-level mutable state: the display unit is an argument, not a global (the mock's `setUnit` is not copied). | archi |
| CF-ARC-05 | No literal for the data span, a month count, the as-of date, an account id or a line code position in the engine or components. They come from the manifest (the mock hard-codes 2024, 2026-11-01, `Y-2026 → 10`, "as of 5 Nov 2026"). Line **codes** (`D_INV_PURCHASE` …) may be named in `metrics.ts`. | archi |
| CF-ARC-06 | Data enters only through `lib/data/loader.ts`. The manifest is parsed with a strict Zod schema; each Parquet file is checked against its column spec (name, type, row count). A failure renders an error state that names the file; no partial page. | ADR-0002 |
| CF-ARC-07 | One client root. State = the selection parsed from the URL + the in-memory view stack + the open pop-up. No global store, no context beyond what the root passes down. | archi |
| CF-ARC-08 | Runtime dependencies: `next`, `react`, `react-dom`, `zod`, `hyparquet`. Dev: `hyparquet-writer`, `vitest`, `typescript`, `eslint`, `prettier`. No chart, UI-kit, state or date library. Charts are hand-written SVG / CSS. | ADR-0002 |
| CF-ARC-09 | Colours are defined once as CSS custom properties in `globals.css` and mirrored as constants in `lib/engine/tokens.ts` for the tests. No colour literal anywhere else (components, inline SVG, copy). | c17 |
| CF-ARC-10 | All user-facing text lives in `lib/engine/copy.ts`. The ⓘ texts and the How to read text are copied verbatim from `mockup/mockup-v2-pops.js` (`INFO`, `howHtml`). | ADR-0012 |
| CF-ARC-11 | Gate: `typecheck`, `lint`, `test`, `build` pass with no network access other than the font download of `next/font` at build time. | ADR-0014 |

## 5. Decisions taken by archi in this spec

Architecture only. Each can be reversed cheaply; say so in a `.sync/` note if the site repo's conventions need a different choice.

| # | Decision | Why | Reversal cost |
| --- | --- | --- | --- |
| D-1 | Data ships as Parquet + `manifest.json` read with `hyparquet`, not as a JS blob like the mock's `mockup-v2-data.js`. | ADR-0002 stack; one typed contract (Zod manifest + column specs) shared with the other report apps. | low |
| D-2 | Money is integer cents everywhere in the engine and in the shipped files; division by 100 happens in `format.ts`. | The mock mixes cents (ledger) and rounded doubles (statement) and needs `r2()` after every sum. Integer sums are exact; results are identical to the cent. | low |
| D-3 | All data loads at first paint (about 75 kB). No lazy files. | The KPI row needs direct-line totals (capex, proceeds, interest, draws) on the landing view, so the ledger is needed at once; a second pre-summed file would be a second source of the same numbers. | low |
| D-4 | The control totals the Reconciliation pop-up shows ship to the browser as `control.parquet` (777 values). The full CSV (2,662 rows) is a test fixture only. | The pop-up is a USER-visible feature (c11); the page must not fetch a CSV it does not need. | low |
| D-5 | The self-check runs in Vitest and, for the selected period, when Reconciliation opens. It does not run on every page load (the mock runs all 1,666 checks at load). | Same proof, no work on the visitor's device. | low |
| D-6 | State lives in the URL query string, written with `history.replaceState`. No `localStorage`, `sessionStorage` or cookie (the mock's `cf2-unit` is dropped). | Embed contract: iframe storage is partitioned or blocked; `pushState` in an iframe would hijack the host's Back button. Same rule as the P&L and Marketing apps. | low |
| D-7 | The view stack (what Esc returns to) is an engine reducer (`nav.ts`); a deep link rebuilds the canonical stack Statement → Activities → Transactions. | The mock's Esc is stack-based, not hierarchy-based (`03` § 7, CF-KEY-02); a reducer makes it testable without a browser. | low |
| D-8 | The build resolves account roles by attribute (type, sub-type, override flag), with an assert on the expected count, instead of the mock's id literals (4, 14, 20, 22, 23, 38–41, 58–60). | A regenerated chart of accounts with shifted ids must fail the build, not shift a KPI silently. Verified: the attribute rules select the same accounts today. | low |
| D-9 | The palette DOM test (`V2.paletteCheck()`) is ported as a browser test over the states of AT-14; the test runner is the site repo's choice. | Computed `color-mix()` values need a real browser; jsdom cannot give them. | low |

## 6. Traps in the mock

Things the mock does that are easy to copy wrongly or should not be copied.

1. **Default view shows "n/m".** Oct 2026 has a net loss (−662.97), so Cash conversion and the whole % of NI column read n/m on first open. That is correct (USER accepted, c3). The raw ratio (28.328446) still has to exist for the control tie.
2. **Two different section totals.** The statement, the KPI cards, the Diagram's activity nodes and the control metrics M06–M08 use the **indirect** totals. The Cash pop-up's activity cards and the Activities view use the **direct** totals (cash that actually moved). They differ when a non-cash item crosses sections: in 2025 Investing is −9,500.00 on the statement and +13,500.00 direct. The pop-up prints "statement adds … non-cash" for the gap. Do not "fix" either side.
3. **Free cash flow mixes both:** indirect CFO + direct fixed-asset purchases and proceeds (this is M15's definition).
4. **The bar axis rescales** when a section collapses or expands: its maximum is taken over the rows on screen (`02` § 3.3, CF-ENG-10).
5. **Esc is a stack.** Opening Activities from the Diagram or the Cash pop-up pushes onto whatever view was open; Esc returns there, not to "the parent level". The menu and the path reset the stack.
6. **Quarter to date compares one month with one month** but labels the comparison "vs Q3 2026" (`05` § 5, Q-06).
7. **Heat sort has no "off" click.** After the first click a sort stays on (flip only); the statement order returns only with a fresh URL (Q-07).
8. **Ledger memo is per transaction and counterparty, not per split:** the interest row of a loan instalment can read "Principal" (known finding, Q-08).
9. **Reconciliation has nothing to show for quarters** and for a YTD that does not end in December or the last data month: control totals exist per month and per year only (Q-09).
10. **Hard-coded span:** `DAY0`, `idx()`, `mEnd`, `keyPeriod()` and the context line assume Jan 2024 – Oct 2026 and "5 Nov 2026" (CF-ARC-05).
11. **Global unit and `localStorage`** (`setUnit`, `cf2-unit`): not copied (CF-ARC-04, D-6).
12. **Two glyphs for negatives:** money uses parentheses, ratios and percentages in KPI cards and the Diagram use the minus sign U+2212. Both are intended.
13. **`color-mix()` tokens**: the palette test compares computed colours with a tolerance of 0.75 per channel; rounding a mix to a hex by hand is fine (`04` § 1 gives the hex), inventing a new tint is not.
14. **Fonts come from Google Fonts in the mock**; the app self-hosts them (`05` § 2).
15. **Pop-ups centre over the visible part of the frame**, not the frame itself, so a host that shows only part of the 1440 × 810 board still gets a centred pop-up (`openPop`, `place === 'center'`).
16. **Dead CSS**: `.esc`, `.bv`, `.colsum`, `.dg-h`, `tr.nav`, `tr.k-sec`, `.bar.heavy`, `.lt tr.day`, `.mi kbd`, `.tickl`, `.rec-t td.wrap`, `.layer>.dg` are leftovers of earlier rounds. Do not port them.
