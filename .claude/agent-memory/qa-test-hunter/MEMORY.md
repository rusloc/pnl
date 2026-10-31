# QA Test Hunter — Memory Index

## Collaboration
_(none yet)_

## Domain
<!-- format: <file> — N entries · <fresh>/<verified>/<aging> · hot: <top-3 IDs by score> · <PREFIX>-NNN -->
- [defect-patterns.md](domain/defect-patterns.md) — 6 entries · 6/0/0 · hot: DEF-003, DEF-001, DEF-004 · DEF-NNN (DEF-006 .sync hand-off staleness)
- [test-infra-quirks.md](domain/test-infra-quirks.md) — 1 entry · 1/0/0 · hot: INFRA-001 (it.fails parity ratchet) · INFRA-NNN
- [candidates.md](domain/candidates.md) — 6 awaiting second hit (stale fixture, per-view FX basis, one-track placeholder, stale DAX parity rows, CSS-hidden view-model field, unpinned transitive deps vs byte-identity); CAND-002 → DEF-006
- [coverage-map.md](domain/coverage-map.md) — last pass 2026-10-31 (.sync receiver acceptance: 0 blocking); earlier 2026-10-30 Nordmark B vs C faces

## Open questions
- 2026-10-23: F-21 default breakdown — spec says Channel/Entity, ADR-0007 §3a + Track B say Region; USER to decide
- 2026-10-23: Track A Analysis "Compared with" toggle vs C-40 rule (Compare A, else B, else PY) — keep or drop?
- 2026-10-27: PV-02 / PV-19 decided (always CC, Region only) but build-brief §3 / §4 not amended (PC-03) — main agent
