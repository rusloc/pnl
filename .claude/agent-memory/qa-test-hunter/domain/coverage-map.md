# Coverage map

| Region | Last audited | By | Findings | Re-audit due |
|---|---|---|---|---|
| Cross-track parity (fabric-app/pnl, pbi-report _measures.tmdl page-top + views, js-report components + lib/engine) | 2026-10-23 | qa-test-hunter | DEF-001, DEF-002, DEF-003, CAND-001, CAND-002 | 2027-01-21 |
| P&L views redesign v4, B vs C (pbi-report ACME _measures redesign block + PBIR kv_ / an_ / pf_ visuals; js-report lib/engine vitals / analysis / profitability) | 2026-10-27 | qa-test-hunter | DEF-001, DEF-003, DEF-004, DEF-005, CAND-003; PV-01..22 in docs/ADD/features/parity-check-2026-10-27.md | 2027-01-25 |
| Mirelo Sales, B vs C (pbi-report Mirelo Sales _measures cards / status; js-report lib/sales) | 2026-10-27 | qa-test-hunter | DEF-004, DEF-005, CAND-004; MS-01..15 | 2027-01-25 |

Test baselines 2026-10-23: Track A `npm test` 28 files / 207 tests green (Vitest 4.1.11); Track C `npx vitest run` 14 files / 145 tests green (Vitest 5.0.5); Track B DAX not run (Desktop).
Test baseline 2026-10-27: Track C `npm test` 23 files / 360 passed + 36 expected-fail (parity spec js-report/lib/test-utils/parity; it.fails = known Track C gaps); Track B DAX not run.
| Nordmark Exec card faces, B vs C (pbi-report Nordmark Exec faces CSV 7 states × 135; js-exec lib/engine view.ts) | 2026-10-30 | qa-test-hunter | 0 real mismatches, 42 display-only (small-card sub-title); CAND-006; report pbi-report/Nordmark Exec/tests/parity/2026-10-30-parity-report.md | 2027-01-28 |
| .sync hand-off packs, receiver acceptance (clean `git ls-files -co` copy: 3 js-app, 3 power-bi, data-gen) | 2026-10-31 | qa-test-hunter | JS 3/3 green (196+1s / 92+4s / 458), CSP frame-ancestors OK; data-gen 3 gens + verify 47/91 green, control totals + 61 data blobs byte-identical; DEF-006, CAND-007 | 2027-01-29 |
| ACME Marketing PBI = JS gate, B vs C (pbi-report/ACME Marketing tests/parity-expected.csv 1,416 rows; js-marketing lib/engine view.ts, windows.ts, url-state.ts) | 2026-11-05 | qa-test-hunter | 1,396 match / 20 accepted (14) / 0 gap; stress: DEF-007 (V1/V2 LY, K7), CAND-008, `_Mv Start` 31 d Top-5 basis of 1 day (rule, shared); js-marketing/lib/test-utils/parity/parity-notes.md | 2027-02-03 |
Test baseline 2026-11-05: js-marketing `npm test` 7 files / 83 tests green in ~0.9 s (Vitest 5.0.5), parity.test.ts 36 tests.
| ACME Trucks JS oracle extraction (pbi-report/ACME Trucks/tests → js-trucks/fixtures/checks/trucks-pinned.csv; contract trucks-js-flavour §7) | 2026-11-09 | qa-test-hunter | 1,004 rows (871 captured / 88 derived / 6 pending / 39 unmapped); PT-04, PT-05 have no oracle; CAND-009 | 2027-02-07 |
| ACME Trucks PBI = JS gate (js-trucks lib/engine shares, kpi, waterfall, view, format; parity_selections_trucks.csv 1,649 rows) | 2026-11-09 | qa-test-hunter | 1,647 match / 2 accepted (16) / 0 gap; differential oracle 551,040 values 0 diffs; CAND-010; js-trucks/lib/test-utils/parity/parity-notes.md | 2027-02-07 |
Test baseline 2026-11-09: js-trucks `npx vitest run` 6 files / 68 tests green (Vitest 5.0.5), parity.test.ts 41 tests.
