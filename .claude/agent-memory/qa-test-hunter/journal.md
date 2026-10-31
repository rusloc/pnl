# Journal (append-only)

2026-10-23 16:45 — read-only cross-track parity audit A/B/C (page top, filters, views, T-coverage) — ~35 gaps — defect-patterns, candidates, coverage-map — DEF-001..003, CAND-001..002
2026-10-27 17:40 — B vs C parity: P&L views redesign v4 + Mirelo Sales; built js-report/lib/test-utils/parity (2 CSVs, resolvers, Vitest spec) — 39 findings (29 gap / 5 accepted / 5 contract) — defect-patterns, candidates, coverage-map, test-infra-quirks — DEF-001/002/003 verified, DEF-004, DEF-005, CAND-003, CAND-004, INFRA-001
2026-10-27 20:00 — B vs C parity re-run after fix rounds — 42 findings: 31 closed / 6 open / 5 accepted (new PV-23, PV-24, PC-03); CSV b_status flipped (P&L 221, Mirelo 207) — defect-patterns, candidates — DEF-002 verified, CAND-005
2026-10-30 18:00 — Nordmark Exec B vs C card-face parity (7 states, 945 fields, engine via plain node, no vitest) — 0 (c) / 42 (b) / 903 identical; category states reconciled to control_totals_category_eur — candidates, coverage-map — CAND-006
2026-10-31 10:55 — .sync receiver acceptance test (clean copy 1180 files / 28.5 MB; npm ci/typecheck/lint/test/build/start x3; data-gen venv + 3 generate + 2 verify; TMDL refs; contract scan; link check) — 0 blocking, ~10 WARN — defect-patterns, candidates, coverage-map — DEF-006 (from CAND-002), CAND-007
