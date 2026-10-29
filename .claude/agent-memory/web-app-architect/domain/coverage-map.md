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
| AI chat path (Track A/C) | 2026-10-23 (USER decided ADR-0009 §8; Track C backend note in `.sync/`) | DEC-004 (cheapest LLM, self-hosted CPU VM + EU API fallback); relay + browser tools pattern per ADR-0009 §4 | 2027-04-23 (security-adjacent: bearer key on the VM, relay limits) |
| Nordmark exec dashboard architecture (generator, grain, calendar, two flavours, standalone app, dot rule, parity) | 2026-10-28 (ADR-0013 Proposed + `docs/Requirements-exec.md` drafted; 4 USER points decided inside) | DEC-005, CNV-001; finding: v5 calendar strings inconsistent (Week 43 = 19–25 Oct needs a Jan-anchored 4-5-4, not the Feb start of v1) | when ADR-0013 is accepted (re-check §5 answers, esp. grain + calendar), else 2027-04-28 |
| Nordmark exec period model (granularity picker, items, comparators, bars, control keys, URL state, PBI picker tables) | 2026-10-29 (ADR-0013 (k) + E-90…E-99 + `docs/ADD/features/exec-period-model.md`; same evening: §8 resolved by the USER, §9 layout round, ET-29/30 added) | DEC-006 (Hits 2); findings: engine/verify.py gate statuses on `fy == currentFy` (must become per-card N/A); EBITDA badness in verify.py not None-safe; old LW-for-PTD "as of last week" has no successor; channel-mix window shares break the naive ET-24 migration equality (`mix_*` excluded); E-57 references a non-existent `exec-info-popovers.md` | when both flavours pass ET-21…ET-30, else 2027-04-29 |
