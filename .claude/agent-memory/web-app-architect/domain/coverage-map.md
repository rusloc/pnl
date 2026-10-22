# Coverage map — Track C architecture surfaces

| Surface | Last reviewed | Findings | Re-review due |
|---|---|---|---|
| Track C stack + data format (Parquet vs DuckDB) | 2026-10-22 | DEC-001 · ADR-0002 §2.1–2.2 | 2027-04-22 (or when hyparquet-writer hits 1.0 / data regenerates) |
| Track C engine API + data contract | 2026-10-22 | ADR-0002 §2.3 | 2027-04-22 |
| Track C allocation / intercompany model | 2026-10-22 | DEC-002 | 2027-04-22 |
| Track C URL state (F-37) | 2026-10-22 | ADR-0002 §2.4 | 2027-04-22 |
| Track C embed contract + CSP | 2026-10-22 | ADR-0002 §2.6 (day-one `'unsafe-inline'` scripts; nonce follow-up) | 2027-04-22 (security-adjacent, 6 months) |
| Track C test strategy (T-01…T-18 mapping) | 2026-10-22 | ADR-0002 §2.7 | 2027-04-22 |
| Vercel project setup for Track C | 2026-10-22 — moved out of this repo | DEC-003 · ADR-0002 §5 Q4: hosting + embedding belong to the vosk.dev repo via `.sync/` hand-off | n/a here (re-check the hand-off status in `.sync/README.md` by 2026-12-21) |
| Track C `.sync/` hand-off content (embed contract, env names, data path, slices 4–9) | 2026-10-22 (specified in ADR-0002 §2.6; file written by nerd) | DEC-003 | 2027-04-22 (security-adjacent: frame-ancestors origins) |
| AI chat path (Track A/C) | (not reviewed) | mentioned in `.log/plan/plan-2026-10-22.md` as a later ADR | open |
