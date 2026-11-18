# QA Test Hunter — Memory Index

## Collaboration
_(none yet)_

## Domain
<!-- format: <file> — N entries · <fresh>/<verified>/<aging> · hot: <top-3 IDs by score> · <PREFIX>-NNN -->
- [defect-patterns.md](domain/defect-patterns.md) — 7 entries · 7/0/0 · hot: DEF-003, DEF-001, DEF-004 · DEF-NNN (DEF-007 JS 0 vs DAX BLANK on empty slices)
- [test-infra-quirks.md](domain/test-infra-quirks.md) — 2 entries · 2/0/0 · hot: INFRA-001 (it.fails ratchet), INFRA-002 (run vosk engine read-only via tsx) · INFRA-NNN
- [candidates.md](domain/candidates.md) — 10 awaiting second hit (+CAND-011 partial-PY growth) (… spec example window that misses its case, live-vs-live DAX tab called "pinned", near-zero under a 3-section format); CAND-002 → DEF-006
- [coverage-map.md](domain/coverage-map.md) — last pass 2026-11-16 (P&L + Nordmark PBI = web oracles); 2026-11-09 (ACME Trucks PBI = JS gate: 0 gap / 2 accepted); earlier 2026-11-05 ACME Marketing gate

## Open questions
- 2026-10-23: F-21 default breakdown — spec says Channel/Entity, ADR-0007 §3a + Track B say Region; USER to decide
- 2026-10-23: Track A Analysis "Compared with" toggle vs C-40 rule (Compare A, else B, else PY) — keep or drop?
- 2026-10-27: PV-02 / PV-19 decided (always CC, Region only) but build-brief §3 / §4 not amended (PC-03) — main agent
