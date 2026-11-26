# 05 · Budgets, embed contract, acceptance tests, trace, open questions

from rusloc/pnl (archi) · to vosk.dev repo agent · 2026-11-26 · status: ready

## 1. Performance budget

| ID | Requirement | Src |
| --- | --- | --- |
| CF-NFR-01 | Data: `public/data/` ≤ 150 kB (CF-DAT-04), fetched in parallel at first paint, cacheable (content-hashed names or the manifest's `sha256` as a query). | ADR-0002 |
| CF-NFR-02 | First-load JavaScript ≤ 300 kB gzip (the Marketing app ships 262 kB with full Zod on the client). | archi |
| CF-NFR-03 | On the deployed URL (Lighthouse, desktop): LCP ≤ 2.0 s, CLS ≤ 0.02. The statement and KPI row are on screen within 2 s. | Tab 1 § 12.1 |
| CF-NFR-04 | Every interaction (period, unit, view, tab, sort, section toggle, pop-up) paints within 100 ms at p95 on a mid-range laptop; opening the largest ledger (2025, Operating, all lines: 963 rows) within 1 s. | Tab 1 § 12.1 |
| CF-NFR-05 | Engine, measured in Vitest: statement + metrics + flows for one period ≤ 5 ms; a year's heat grid (365 days × 8 lines) ≤ 10 ms; the full self-check ≤ 500 ms. | archi |
| CF-NFR-06 | No virtualisation library: the ledger never exceeds about 1,000 rows and the heat grid draws only non-empty cells plus one strip per line. | archi |
| CF-NFR-07 | Loading: the board with its shell and empty cards, no layout shift when the data arrives. Failure: one message naming the file that failed (CF-ARC-06). | Tab 1 § 11.5 |
| CF-NFR-08 | Current Chromium, Firefox and Safari. Without `backdrop-filter` the glass falls back to 95 % solid; where `::-webkit-scrollbar` is not supported the heat scrollbar uses `scrollbar-color` / `scrollbar-width: auto` and must still be visible. | c5, c7 |

## 2. Embed contract

Same contract as the P&L and Marketing apps.

| ID | Requirement | Src |
| --- | --- | --- |
| CF-EMB-01 | The site embeds `/` in an `<iframe>`. The app assumes nothing about the host: no `postMessage`, no host CSS, no auth, no cookies, no storage, no access to `window.top`. | ADR-0002 |
| CF-EMB-02 | **Board 1440 × 810**, fixed, centred horizontally; the host scales it (`transform: scale()` on the wrapper or the iframe). The area outside the board is `--surf`. The board never grows taller: panels and pop-up bodies scroll inside. Below 1440 px of iframe width the document scrolls; no narrow layout. | c1, c9 |
| CF-EMB-03 | Headers on every path (in `next.config.ts`): CSP `default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self' <EMBED_ALLOWED_ORIGINS>; base-uri 'self'; form-action 'none'; object-src 'none'`, plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. No `X-Frame-Options`, no `X-Powered-By`. `'unsafe-eval'` only under `next dev`. | ADR-0002 |
| CF-EMB-04 | Environment: `EMBED_ALLOWED_ORIGINS` (build time, comma-separated bare https origins; a malformed entry fails the build; empty = same-origin framing only) and optional `NEXT_PUBLIC_SITE_URL` (`metadataBase`). No secret, key or id exists in this app. | ADR-0002 |
| CF-EMB-05 | No third-party request at runtime: fonts are self-hosted by `next/font`, the grain is an inline SVG data URI (hence `img-src data:`), data comes from the app's own origin. | ADR-0002 |
| CF-EMB-06 | Data URLs respect a `basePath` deploy. | archi |
| CF-EMB-07 | Deep links are the host's integration API: iframe `src` = the app URL plus any query of `03` § 8. | ADR-0002 |
| CF-EMB-08 | Centred pop-ups centre over the visible part of the board, so a host showing only part of it still gets a usable pop-up. | mock |

## 3. Acceptance tests

"The mock ties 1,554 control values and passes a 1,666-check self-check; the app must match."

| ID | Test | Pass when |
| --- | --- | --- |
| AT-01 | **Build ties** (`scripts/build-cash-flow-data.ts`, `02` § 2.3) | 1,554 control values over 38 periods recomputed from the output files, all within tolerance; roll-forward holds in all 38; exit 0 |
| AT-02 | **Engine ties to the full control file** (Vitest, engine over `public/data/` vs `fixtures/checks/control_totals_usd.csv`) | the same 1,554 values produced by `statement`, `lineTotals`, `metrics` for the 34 months, 3 years and the whole span; both ways for M05 and DIRECT_LINE |
| AT-03 | **Self-check** (Vitest, `selfCheck()` vs `control.parquet`) | 1,666 checks, 1,666 pass (37 × 44 + 2 × 19) |
| AT-04 | **Reference values** (`02` § 4) | every figure of the table and the three paragraphs, to the cent / to the printed decimal |
| AT-05 | **Mock parity over the 49 reachable periods** | for each period: statement rows (labels, order, values), the 20 metrics, section flows, line totals, heat cell blocks and totals blocks per activity equal the mock engine's output (money 0.005, ratios 1e-9). Harness: run `mockup-v2-data.js` + `mockup-v2-core.js` in Node with a `window` stub and dump a JSON fixture; `quint()` lives in `mockup-v2-ui.js` and is 8 lines |
| AT-06 | **Period model** | labels, control keys, prior windows and labels, `partial`, `days` for month, quarter, year, YTD and the three quick handles; first-month and first-quarter cases give no prior |
| AT-07 | **Quintiles** | empty input; one value → block 5; ties share the higher block; 3 values → 2, 4, 5; 4 values → 2, 3, 4, 5; the Operating Oct 2026 case (sizes 7 / 7 / 8 / 7 / 8 and bounds) |
| AT-08 | **Formats** | money in both units incl. zero, null, negative, `exact`, `suffix`; `(0.0%)` never printed; ratio, days, percent, compact, the four date forms |
| AT-09 | **URL codec** | defaults omitted; round trip for every reachable state; invalid → default; unknown keys dropped; dependent keys dropped; `l` outside `a` dropped; `d` outside the period dropped; canonical order |
| AT-10 | **View stack** | every rule of CF-KEY-02, incl. Diagram node from Transactions → Esc returns to Transactions; menu and path reset; deep link builds the canonical stack |
| AT-11 | **Data boundary** | a manifest with an extra key, a missing file, a wrong column type or a wrong row count each give the named error state, not a partial page |
| AT-12 | **Click-through** (real browser; list below) | 36 / 36 flows, no console error or warning |
| AT-13 | **Layout assertions** (real browser; list below) | all hold at 1440 × 810 |
| AT-14 | **Palette test** (real browser; port of `V2.paletteCheck()`; states below) | zero colours outside the allowed set in every state |
| AT-15 | **Accessibility** | every AT-12 flow done with the keyboard only; focus returns to the opener after every pop-up; an automated audit (axe or equal) reports nothing except the contrast exceptions E-1 … E-4; reduced motion removes all transitions |
| AT-16 | **Embed and privacy** | framed from an allowed origin: renders; from another origin: blocked; headers of CF-EMB-03 present; network log same-origin only; `localStorage`, `sessionStorage` and cookies untouched after a full AT-12 run |
| AT-17 | **Budgets** | CF-DAT-04 and CF-NFR-01 … 05 measured and written into the app README |
| AT-18 | **Gate** | `typecheck`, `lint`, `test`, `build` green on a clean checkout without the generator pack |

### AT-12 click-through flows

1. Open `/`: Statement, Oct 2026, USD, three sections expanded, path pill on Statement, KPI faces of `02` § 4.
2. Click the Operating row: it collapses and shows (18,781), a bar and `n/m`; the axis rescales; click again: it expands; focus stays on the row.
3. Keyboard on section rows: ↓ ↑ move between the three, Enter and Space toggle.
4. YTD, scroll the statement: the opening row pins under the header, the closing row at the bottom; scroll to both ends: no row is hidden.
5. The S01 chip on Line of Credit shows its tooltip.
6. The arrow button on the Financing row opens Activities with the Financing tab active and the pill on Activities.
7. Tabs: click Operating; ← → Home End switch and keep focus on the tab; sort and period survive.
8. Hover a coloured cell: tooltip with date, line, in, out, count.
9. Click a coloured cell: Transactions for that line and date; the total equals the cell; the long date shows in the header.
10. Esc: back to Activities; Esc: Statement; Esc: nothing.
11. Click a line label: Transactions for the line over the period; total = the heat row total.
12. Click `Net cash from operating activities`: all lines, 90 rows in Oct 2026, the Line column appears.
13. Path from Statement: Transactions → Operating, all lines; Activities → Operating; Statement.
14. Sort: Name → A–Z → Z–A; Total → high–low → low–high; choosing one clears the other; whole rows move.
15. Heat keyboard: focus the grid, arrows move the cursor and its tooltip, Home / End, Enter opens a day with transactions and does nothing on an empty cell.
16. Calendar, Month: pick Sep 2026: the page updates behind, the pop-up stays, the badge reads `Month · Sep · 2026`.
17. Calendar, Quarter: Q3 2026: Activities shows 92 date columns, a visible scrollbar, month bands and every date; labels and totals stay put while scrolling.
18. Calendar, Year: 2025 (KPIs `vs 2024`); 2026 has a dashed edge, reads "to date" and compares `vs Jan–Oct 2025`.
19. Quick: YTD, QTD, MTD each set the period, show their name in the badge and leave no span tab or element selected; picking a month clears the quick handle.
20. Nov and Dec 2026 are disabled; the year stepper stops at 2024 and 2026.
21. Units: `USD k` puts `k` on KPI values, one decimal on the statement and the ledger; the URL gains `u=k`; a reload keeps it.
22. Menu: three blocks; the current step is marked; Statement / Activities / Transactions navigate and reset the stack (after menu → Transactions, Esc goes to Activities, then Statement).
23. Each of the 11 ⓘ buttons opens its definition next to it; Esc closes and returns focus.
24. How to read opens from the menu; a click outside closes it.
25. Cash pop-up from the Closing cash button: four cards, In / Out on one line, Closing level with Net; Oct 2026 reads 351,232 + 175,915 + (212,018) = 315,129; in 2025 all three activity cards carry a "statement adds … non-cash" note.
26. A Cash pop-up activity card opens that activity; Esc returns to the previous view.
27. Diagram from the menu: the page blurs, the box is 1200 × 600; Expand all shows 12 metrics and the body scrolls; Collapse all; each chip disables when it would do nothing.
28. A Diagram group toggles on click and with Enter; focus stays on it.
29. From Transactions open the Diagram and click Investing: the pop-up closes, Activities · Investing opens; Esc returns to Transactions.
30. The Diagram's ⓘ toggles an inline note; no second pop-up.
31. Reconciliation: Oct 2026 `44 / 44 tie ✓`; 2025 `44 / 44`; Q3 2026 shows the "per month and per year" message; the box stays 1200 × 600.
32. Pop-up mechanics: opening the menu while the calendar is open closes the calendar; Tab cycles inside; focus returns to the opener.
33. Deep links: `/?v=transactions&a=fin&l=d_fin_repaid` · `/?p=q-2026-3&v=activities&a=fin&s=total` · `/?pop=diagram&g=quality,wc` · `/?p=y-2031&u=x&l=zzz&foo=1` (rewritten to `/`).
34. On Transactions for one day, change the period to one that excludes the day: the day is dropped, the line stays.
35. Empty states: Investing in Oct 2026: Activities with empty strips and `–` totals; Transactions with `No cash moved`.
36. Jan 2024: every KPI delta reads `no prior period`; DSCR in the Diagram reads `n/m`.

### AT-13 layout assertions

- Statement: label + amount columns = 50 % of the table (± 1 px); `% of NI` column 84 px; every bar 12 px thick; no dashed or hatched mark in the DOM.
- Path: the three steps have identical boxes on all three views.
- KPI row: six cards of equal width, 84 px high; the Closing cash button sits in the bottom-right corner and never overlaps the delta text (49 periods × 2 units).
- Panel: its bottom edge = the board's bottom margin on all three views, including a collapsed statement and an empty activity.
- Activities: tabs of equal width, left-aligned; cells are squares; column count = days in the period (31, 92, 304, 365); cell size identical for a 31-day month, a quarter and a year; legend in the bottom-right corner.
- Calendar: 400 × 432 in each span and each quick state; "To date" and "Units" at the same position in all of them.
- Diagram and Reconciliation: 1200 × 600 collapsed, expanded and in any period.
- Cash pop-up: In and Out rows share their y across the four cards; Closing y = Net y; all bars start at the same x within their card.

### AT-14 palette states

Allowed set = the 17 tokens of `04` § 1 (`--bg`, `--surf`, `--ink`, `--hl`, `--sub`, `--sub2`, `--muted`, `--faint`, `--rule`, `--line`, `--hover`, `--out`, `--q1`, `--q2`, `--q3`, `--tabLine`, `--lineBar`), each with any alpha; fully transparent values are skipped; tolerance 0.75 per channel. The walk reads `color`, `background-color`, the four border colours, `outline-color`, `text-decoration-color`, `box-shadow`, `background-image` of every element and its `::before` / `::after`, and `fill` / `stroke` of SVG shapes and text.

States (the mock passes all of them from this folder; 819 to 7,867 colour values each):
`/` · `?p=ytd` · `?c=op,inv,fin` · `?u=k` · `?v=activities` · `?v=activities&a=inv` · `?p=q-2026-3&v=activities&a=fin` · `?p=ytd&v=activities` · `?v=transactions` · `?v=transactions&l=d_rec_cust` · `?v=transactions&a=inv` · calendar open · menu open · `?pop=cash` · `?pop=how` · `?pop=rec` · `?pop=diagram` · `?pop=diagram&g=quality,wc,fcf,lev` · the Closing cash ⓘ open · `?p=y-2025`.

## 4. Trace: USER decisions of 2026-11-26 → requirements

`c1`–`c17` are the entries of the USER's review log (rusloc/pnl `.log/coms/coms-2026-11-26.md`, rounds 1–14). Decisions that a later entry replaced are marked.

| Entry | Decision | Requirement |
| --- | --- | --- |
| c1 | Landing = classic statement left, bars of absolute amounts right | CF-STM-01, CF-STM-09 |
| c1 | First line cash at start, last line cash at end | CF-ENG-07 |
| c1 | Activity → heatmap (X days, Y items) → transaction ledger | CF-ACT-01, CF-ENG-12, CF-TXN-01, CF-TXN-03 |
| c1 | 5–7 vital KPI cards on top | CF-KPI-01, CF-KPI-02 |
| c1 | Diagram: net change → 3 activities → KPI groups → metrics, behind its own button | CF-DIA-03, CF-DIA-04 (form: c12) |
| c1 | Two rounded squares: calendar + settings (left), menu (right) | CF-NAV-02 |
| c1 | Statement = indirect with the S01 override on; numbers tie to the control totals | CF-ENG-06, AT-01 … AT-03 |
| c1 | Four switchable palettes | replaced by c4 (CF-VIS-04) |
| c2 | Closing-cash row stays visible | CF-STM-05 |
| c2 | Diagram is a management view, apart from the drill path in the menu | CF-MNU-01 |
| c2 | No dashed or striped bars at all | CF-STM-10, CF-VIS-10 |
| c2 | Landing bars in the highlight colour | replaced by c3 (grey, CF-STM-10) |
| c2 | KPI cap questioned; colouring options | closed by c3 (CF-KPI-03) |
| c3 | Statement table (labels + amounts) 50 % wide | CF-STM-02 |
| c3 | Balance bars dark, line bars #8A8986, no borders | CF-STM-10 |
| c3 | Navigation always visible (header pinned) | CF-NAV-08 |
| c3 | KPI highlight removed: plain cards | CF-KPI-03 |
| c3 | Orbya with role mapping | CF-VIS-03 |
| c3 | Thin % column at the far right; base = net income; n/m in loss periods | CF-STM-02, CF-ENG-09 |
| c3 | Activity cards under the KPI row, collapsible; Net bars #F2A33A | replaced by c4 (pop-up) and c17 (#FF6F1A): CF-CSH-01, CF-CSH-05 |
| c3 | Current level bold + orange underline | replaced by c17 (pill, CF-NAV-06) |
| c4 | Path always visible, named Statement › Activities › Transactions, current highlighted | CF-NAV-05, CF-NAV-06, CF-NAV-07 |
| c4 | Fourth card: opening → in → out → closing | CF-CSH-02 |
| c4 | Statement expandable; a section click expands all its sub-elements | CF-STM-06, CF-STM-07 |
| c4 | Heatmap rows squeezed to square cells | CF-ACT-06 |
| c4 | Activity cards move to a pop-up behind a small orange button on Closing cash | CF-KPI-04, CF-CSH-01, CF-CSH-06 |
| c4 | Orbya only | CF-VIS-04 |
| c4 | Orange button on each activity row of the statement → Activities | CF-STM-08 |
| c5 | More than one month: scroll bar, months + dates on the axis, never aggregate dates | CF-ACT-07, CF-ACT-08, CF-ENG-12, CF-ENG-25 |
| c5 | Statement expanded on opening | CF-STM-06 |
| c6 | Opening and closing balance always visible | CF-STM-05 |
| c7 | Pop-ups: more transparent, matte frosted glass | CF-POP-01, CF-POP-04 |
| c7 | Semi-transparent orange dots behind the diagram | CF-DIA-06 |
| c8 | No "Esc" in the top line | CF-NAV-05, CF-INF-03 |
| c8 | Diagram pill in the path | replaced by c11 (CF-NAV-05) |
| c9 | Container fills the view; only content changes | CF-NAV-09 |
| c9 | Cash pop-up rows aligned across the four cards | CF-CSH-04 |
| c9 | Five blocks of 20 % of the items; top block orange; more contrast; no diverging colours | CF-ENG-13, CF-ACT-09, CF-VIS-06 |
| c9 | Colour coding on the totals | CF-ENG-14, CF-ACT-10 (form: c10) |
| c10 | Legend without labels, in the bottom-right corner | CF-ACT-11 |
| c10 | Totals: a square in the matching colour instead of a coloured background | CF-ACT-10 |
| c10 | Sort toggles above the titles (name) and the totals (amount) | CF-ACT-12, CF-ENG-15 |
| c10 | Reconciliation wide enough for its content; page blurred behind it | CF-REC-01, CF-POP-04 |
| c11 | No Diagram pill in the header | CF-NAV-05 |
| c11 | Reconciliation grouped with Diagram under Management view | CF-MNU-01 |
| c11 | What Reconciliation shows | CF-REC-02, CF-REC-03 |
| c11 | "add another" (message cut off) | open: Q-10 |
| c12 | Diagram is a pop-up like Reconciliation | CF-DIA-01, CF-DIA-07, CF-URL-04 |
| c13 | (git command) | none |
| c14 | Reconciliation and Diagram keep constant dimensions | CF-DIA-02, CF-REC-01, CF-VIS-09 |
| c14 | Expand all / Collapse all on the Diagram | CF-DIA-05 |
| c14 | Activities navigation as tabs | CF-ACT-02, CF-ACT-04 |
| c14 | Calendar: span on top, its elements below; separate YTD / QTD / MTD | CF-CAL-02 … CF-CAL-07, CF-ENG-02, CF-ENG-04 |
| c14 | Clear-state circles orange | CF-TXN-06 |
| c15 | Activities tabs above the title | CF-ACT-02 |
| c15 | Clear circles #FF6F1A, no border | CF-TXN-06 |
| c15 | Cash balance: Opening and Closing bars #FF6F1A, no border | CF-CSH-05 |
| c15 | Every close button #FF6F1A with a dark ×, no border | CF-POP-03 |
| c16 | Tabs look like folder tabs; more space under them | CF-ACT-02, CF-ACT-03 |
| c16 | Calendar keeps static dimensions (Month size) | CF-CAL-01 |
| c16 | Calendar selections in the dark Units style | CF-CAL-08 |
| c16 | All statement bars the same height | CF-STM-11 |
| c17 | Orange exactly #FF6F1A, dark exactly #2C3A54, background #F6F5F2, primary #E8E5DF, everywhere | CF-VIS-01, CF-VIS-02, CF-ARC-09, AT-14 |
| c17 | Current path step = orange pill | CF-NAV-06 |
| c17 | Closing cash button in the bottom-right corner | CF-KPI-04 |
| c17 | Tabs only as wide as the titles, all equal | CF-ACT-02 |

## 5. Open USER questions

The app is built on the default in each row (= what the accepted mock does). An answer comes back as a `.sync/` note; none blocks the build.

| # | Question | Default in force |
| --- | --- | --- |
| Q-01 | #2C3A54 text on #FF6F1A is 4.10:1 (AA asks 4.5): path pill, R / C letters, ×, S01 chip. Accept as is? | keep (E-1) |
| Q-02 | Flat #FF6F1A marks without a border are 2.22:1 against the card (AA asks 3): clear discs, orange buttons, Opening / Closing / Net bars. Uncleared vs reconciled / cleared differ by the letter only. Accept? | keep (E-2) |
| Q-03 | #8A8986 line bars are 2.78:1 against the card. Accept? | keep (E-3) |
| Q-04 | The orange focus ring is 2.22:1 against the card. Keep orange, or use the dark ring everywhere? | orange (E-4) |
| Q-05 | KPI definitions asked in round 1, not answered: (a) DPO base = bills spend without payroll, interest and bad debts; (b) DSCR counts term and vehicle loans, not line-of-credit repayments; (c) net debt ÷ EBITDA uses the period's EBITDA annualised. | as listed |
| Q-06 | Quarter to date compares one month (Oct) with the first month of the previous quarter (Jul) but the card says `vs Q3 2026`. Label it `vs Jul 2026`, or compare with the whole previous quarter? | mock: like-length window, label `Q3 2026` |
| Q-07 | Heat sort: should a third click switch the sort off (back to statement order)? | no off state |
| Q-08 | Ledger memo is per transaction and counterparty; a loan instalment's interest row can read "Principal". Show the split's own description instead? | per transaction |
| Q-09 | Reconciliation has no figures for quarters and mid-year YTD (control totals are monthly and yearly). Tie those as the sum of the monthly control rows, or leave the message? | message |
| Q-10 | Round 9: "add another" (cut off) in the Management view block. Another what? | nothing added |
| Q-11 | In `USD k` the ledger shows one decimal of thousands; the source spec wants transactions always to the cent. | follows the unit |
| Q-12 | Round 1, not answered: hide statement rows with no movement in the period; show the "statement adds … non-cash" note on the Cash pop-up's activity cards. | both yes |
| Q-13 | The mock remembered the unit in the browser; the app keeps it in the URL only (embed rule, D-6). Acceptable? | URL only |
| Q-14 | The source spec wants every view shareable as a link; inside an iframe the URL is not visible. Add a copy-link control (where)? | none |
| Q-15 | Data: tax collected on training invoices lands in "Taxes paid" as an inflow (data README, deviation D-9, still waiting for a USER ruling). The app prints what the data gives. | as generated |
| Q-16 | Deferred in the mock: single-transaction view, filters, direct statement view, override-off toggle, exceptions panel, dark theme, narrow layout. Any of them for this build? | none (`01` § 2) |
