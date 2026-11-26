# ACME Cash Flow — build spec for the standalone Next.js app

- **From:** rusloc/pnl (archi)
- **To:** vosk.dev repo agent
- **Date:** 2026-11-26
- **Status:** ready (the open USER questions in `05` run on stated defaults; the data pack `.sync/data-gen/acme-cash-flow/` is issued (ginee 2026-11-26: byte-identical rerun, verify 74 / 74), see "Data" below)

Build, from this folder plus the generated data, a standalone Next.js app of the **ACME Cash Flow** report: a replacement for the QuickBooks Online Statement of Cash Flows for one synthetic company (ACME Advisory Services LLC, USD, Jan 2024 – Oct 2026, all figures invented). One page, three views on a drill path (Statement › Activities › Transactions), six KPI cards and seven pop-ups. The USER accepted the layout mock on 2026-11-26 (ADR-0019, amendment 1 in rusloc/pnl). **The mock in `mockup/` is the reference implementation**: where this spec and the mock disagree on a look or a behaviour, the mock wins and the spec has a defect; report it back.

Nothing in this folder carries a secret, key, connection string or workspace / tenant ID.

## Reading order

| # | File | What |
| --- | --- | --- |
| 1 | `README.md` | this file |
| 2 | `01-scope-and-architecture.md` | scope, non-goals, deviations from the USER's source spec, architecture, folder layout, the decisions archi took, traps in the mock |
| 3 | `02-data-and-engine.md` | data contract, the pre-aggregation build (inputs, outputs, asserts, size budget), every engine rule with its formula |
| 4 | `03-views-and-interactions.md` | shell, KPI cards, the three views, the seven pop-ups, keyboard, URL state |
| 5 | `04-theme-and-accessibility.md` | exact palette, derived mixes (with hex), typography, fixed sizes, accessibility and the contrast exceptions |
| 6 | `05-acceptance-and-open-questions.md` | performance budget, embed contract, acceptance tests, trace from each USER decision to its requirement, open USER questions |
| — | `mockup/` | the accepted mock, copied 2026-11-26 from rusloc/pnl `docs/design/cash flow statement/` (byte-identical) |

Requirements carry IDs (`CF-<area>-nn`, 190 in total) and acceptance tests `AT-nn` (18). Cite them in code comments, tests and commit messages. The `Src` column names the USER decision behind a requirement: `c3` = entry 3 of the USER's review log of 2026-11-26 (rounds 1–14, entries 1–17; listed in `05` § 4), `ADR` = an ADR of rusloc/pnl, `mock` = behaviour of the accepted mock that no entry spells out, `archi` = an architecture decision taken in this spec (`01` § 5).

## The mock

| File | What |
| --- | --- |
| `mockup/mockup-v2-2026-11-26.html` | open this (works over `file://`; loads Space Grotesk and JetBrains Mono from Google Fonts) |
| `mockup/mockup-v2.css` | design tokens and every style |
| `mockup/mockup-v2-core.js` | the engine: periods, statement, direct lines, heat grid, KPIs, formats, self-check (no DOM) |
| `mockup/mockup-v2-ui.js` | shell, KPI cards, the three views, navigation, keyboard, `V2.paletteCheck()` |
| `mockup/mockup-v2-pops.js` | pop-ups: calendar, menu, ⓘ, How to read, cash, Diagram, Reconciliation |
| `mockup/mockup-v2-data.js` | the pre-aggregated data (175 kB), generated; do not edit |
| `mockup/build-mock-v2-data.py` | how that data was built from the Parquet tables and asserted against the control totals; **reference only**: its paths point into rusloc/pnl, so it does not run from here. It is the model for the app's build script (`02` § 2) |

Checked on 2026-11-26 from this folder, headless Edge over `file://`: self-check 1,666 / 1,666, `V2.paletteCheck()` passes on 20 states, no console errors or warnings.

Review hooks of the mock (query string, mock-only; the app's URL contract is `03` § 8):
`?mode=M|Q|A|Y&y=2026&m=10` · `?quick=YTD|QTD|MTD` · `?unit=USDk` · `?view=heat|ledger&sec=OP|INV|FIN&line=D_REC_CUST&day=<days since 2024-01-01>` · `?exp=` (statement collapsed) · `?pop=cal|menu|cash|how|rec|diagram|<ⓘ id>` · `?open=quality,wc,fcf,lev` (diagram groups).
In the console: `CF_SELFCHECK` (the load-time self-check), `CF.selfCheck('M-2026-10')`, `V2.paletteCheck()`. The mock stores the unit in `localStorage` (`cf2-unit`), so a `?unit=USDk` visit sticks until `?unit=USD`.

## Data

The app reads Parquet built from the generator pack **`.sync/data-gen/acme-cash-flow/`** (same generator as rusloc/pnl `data/acme_cash_flow_dummy_data/`, seed 42, byte-identical output: `parquet/` + `checks/control_totals_usd.csv`). That pack's README is the data contract; its table, column and code names win over any name in the USER's source spec. `02` § 1 lists the six tables the app's build reads. Do not rebuild the data from `mockup/mockup-v2-data.js`.

## Other inputs

- USER's source spec: `../spec/Tab 1.md` (report: measures M01–M20, checks C01–C10) and `../spec/Data generator spec.md`. A checklist, not the design: `01` § 3 lists where the mock replaced it.
- The Power BI flavour of the same report is built in rusloc/pnl and will ship in `../power-bi/`. It follows the same mock; neither flavour is the other's reference.
- Format precedents: `.sync/acme-marketing/js-app/README.md` (board, embed, URL state, fixtures), `.sync/2026-10-22-track-c-handoff.md`.

## Rules for this folder

- A copy for building against. The source of truth stays in rusloc/pnl (`docs/design/cash flow statement/`, `docs/ADR/0019-acme-cash-flow-report.md`). Do not edit it in place.
- A question, a defect in the spec or a USER answer goes back as a dated note in `.sync/` (`{yyyy-mm-dd}-{topic}.md`, from · to · date · status).
- Design changes go through the USER; the mock is changed in rusloc/pnl first and this folder is re-issued.
