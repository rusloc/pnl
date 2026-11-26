from rusloc/pnl (main agent) · to vosk.dev repo agent · 2026-11-26 · status: ready (Next.js flavour; Power BI follows later)

# ACME Cash Flow — hand-off for the Next.js app

**Entry point for the ACME Cash Flow bundle.** Build a standalone Next.js app of the ACME Cash Flow report: a replacement for the QuickBooks Online Statement of Cash Flows for one synthetic company (ACME Advisory Services LLC, USD, Jan 2024 – Oct 2026, all figures invented). The USER accepted the layout mock on 2026-11-26 (rusloc/pnl ADR-0019, amendment 1). Building the app is your task; rusloc/pnl does not build a JS flavour of this report.

## What the bundle holds

| Path | What | Status |
|------|------|--------|
| `acme cash flow/js-spec/` | Build spec: README (reading order), `01`–`05` (scope and architecture, data and engine, views and interactions, theme and accessibility, acceptance and open questions), 190 requirements `CF-<area>-nn`, acceptance tests AT-01…AT-18 | ready (archi) |
| `acme cash flow/js-spec/mockup/` | The accepted mock = the reference implementation (opens over `file://`, self-checks 1,666 / 1,666 on load). Where spec and mock disagree, the mock wins; report the defect back | ready |
| `data-gen/acme-cash-flow/` | Data generator (Python 3.12, pinned deps, seed 42) + `checks/verify.py` + `checks/control_totals_usd.csv`; its README is the data contract | ready (ginee; rerun byte-identical, verify 74 / 74) |
| `acme cash flow/spec/` | The USER's source spec pair (`Tab 1.md`, `Data generator spec.md`); background only, the js-spec says where the mock replaced it | input, read-only |

## Steps

1. Generate the data: follow `data-gen/acme-cash-flow/README.md` (one command, about 2 s), then run its `verify.py` (expect 74 passed). Output `parquet/` is the input of the app's pre-aggregation build. Generated files are not in git.
2. Read `acme cash flow/js-spec/README.md` and the five spec files in order; open the mock next to it.
3. Build per the spec (Next.js 16 App Router, TS strict, pre-aggregated Parquet + pure-TS engine, Zod, Vitest; no backend). Data budget ≤ 150 kB at first paint.
4. Prove AT-01…AT-18, including control-total parity (the build reproduces the mock's 1,554 control values; the engine its 1,666 checks) and the palette test.
5. Open USER questions Q-01…Q-16 (js-spec `05`) run on the mock's behaviour as the default; none blocks the build. Send answers or defects back through `.sync/`.

## Not in this bundle

- The Power BI flavour (`acme cash flow/power-bi/`): in progress in rusloc/pnl, delivered later as its own pack.
- No secrets, keys, connection strings or workspace / tenant IDs anywhere in the bundle.
