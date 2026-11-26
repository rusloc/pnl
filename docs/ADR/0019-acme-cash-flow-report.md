# ADR-0019 — ACME Cash Flow: QBO-replacement cash flow report, synthetic QBO data and layout mock

- **Status:** Accepted 2026-11-26 (USER accepted mock v2; amendment 1 below)
- **Date:** 2026-11-25
- **Decider:** USER (scope, scenarios, design rule, mock form); main agent (location, routing, defaults)

## Context
The USER's spec pair in `.sync/acme cash flow/spec/` (2026-11-25): `Tab 1.md` (cash flow statement replacing the QuickBooks Online statement: indirect + direct views, five drill levels, checks C01–C10, measures M01–M20) and `Data generator spec.md` (synthetic QBO company: processes P01–P14, posting rules, scenarios S01–S20, invariants I01–I14, delivery modes). A new showcase report outside the P&L spec (`docs/Requirements.md`), like ADR-0015 and ADR-0016. The delivery tool is still open (report spec § 12.3).

## Decisions
| | Decision |
|---|---|
| Data scope | Generator writes the report tables of report spec § 9.2 as Parquet **and** the QBO-shaped files of generator spec § 10.1 (`entities/*.jsonl`, `reports/<Report>/*.json`, `expected/*.jsonl`, `manifest.json`). Not built: mock API (§ 10.2), incremental mode (§ 10.3), sandbox loader (§ 10.4). (USER) |
| Scenarios | "Typical" preset: clean books plus S01, S02, S03, S04, S06, S07, S08, S13, S18, each with an oracle record. S10 / S17 need incremental mode and are out. (USER) |
| Design rule | ADR-0012 wins over the spec: no sparklines in tiles or per statement row (trend lives in the monthly chart and the line panel); controls in one side-bar menu pop-up; explanations behind ⓘ and one "How to read" glass pop-up. (USER) |
| Mock | Static HTML: general layout, navigation (levels 0–4, drill panel, breadcrumb) and design approach; no real data needed. (USER) |
| Defaults | Profile `services`, size S, home currency USD, fiscal year = calendar year, `seed` 42, span 1 Jan 2024 – 31 Oct 2026 (last month end before 2026-11-25), cash set = QBO cash (Bank + Undeposited Funds). Python, pinned like the other `data/acme_*` generators. (main agent) |
| Location | Data: `data/acme_cash_flow_dummy_data/` (`generator/`, `parquet/`, `qbo/`, `checks/`, `README.md`), as the Marketing / Trucks packs. Mock: `docs/design/cash flow statement/`. Spec stays in `.sync/acme cash flow/spec/` as input. (main agent) |

## Rejected
- Report tables only (no QBO JSON): USER wants the loader-facing contract too.
- Clean-only or torture presets: clean leaves the exceptions panel empty; torture needs incremental mode.
- Spec-literal sparklines and control bar: conflicts with ADR-0012.

## Open
- ~~Delivery tool (Power BI, JS app or both) and the pack (ADR-0014) — after the mock review.~~ Closed by amendment 1.
- Report spec § 12.3 questions that need a real QBO file (Undeposited Funds as cash, region, payroll depth) stay open; the synthetic data follows the spec's defaults.

## Amendment 1 — 2026-11-26: mock v2 accepted, delivery
| | Decision |
|---|---|
| Mock | `docs/design/cash flow statement/mockup-v2-2026-11-26.html` (+ `mockup-v2.css`, `mockup-v2-{core,ui,pops}.js`, data from `build-mock-v2-data.py`) is the accepted design and behaviour reference: Statement › Activities › Transactions, KPI row, cash / Diagram / Reconciliation pop-ups, calendar span + YTD / QTD / MTD, exact Orbya palette. Supersedes the mock row above and mock v1. (USER) |
| Delivery | Both: Power BI report built in this repo (`pbi-report/ACME Cash Flow/`, local Parquet `DataFolder` as the ADR-0014 packs); Next.js app built by another agent from a spec sheet. Closes "Delivery tool" in Open. (USER) |
| Packs | `.sync/acme cash flow/power-bi/` (PBIP, no data), `.sync/acme cash flow/js-spec/` (spec sheet + reference mock), `.sync/data-gen/acme-cash-flow/` (generator). (USER: assets in `.sync`; paths main agent) |

## Pointers
- Spec: `.sync/acme cash flow/spec/` · Data: `data/acme_cash_flow_dummy_data/` · Mock: `docs/design/cash flow statement/`
- Rules: ADR-0012 (visual first), ADR-0014 (packs), ADR-0015 (pattern)
