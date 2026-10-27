# QA Test Hunter — Memory Index

## Collaboration
_(none yet)_

## Domain
<!-- format: <file> — N entries · <fresh>/<verified>/<aging> · hot: <top-3 IDs by score> · <PREFIX>-NNN -->
- [defect-patterns.md](domain/defect-patterns.md) — 5 entries · 5/0/0 · hot: DEF-003, DEF-001, DEF-004 · DEF-NNN
- [test-infra-quirks.md](domain/test-infra-quirks.md) — 1 entry · 1/0/0 · hot: INFRA-001 (it.fails parity ratchet) · INFRA-NNN
- [candidates.md](domain/candidates.md) — 5 awaiting second hit (stale fixture, superseded .sync note, per-view FX basis, one-track placeholder, stale DAX parity rows)
- [coverage-map.md](domain/coverage-map.md) — last pass 2026-10-27 (B vs C parity: P&L redesign v4 + Mirelo); re-run same day; Track C baseline 23 files / 362, 0 expected-fail

## Open questions
- 2026-10-23: F-21 default breakdown — spec says Channel/Entity, ADR-0007 §3a + Track B say Region; USER to decide
- 2026-10-23: Track A Analysis "Compared with" toggle vs C-40 rule (Compare A, else B, else PY) — keep or drop?
- 2026-10-27: PV-02 / PV-19 decided (always CC, Region only) but build-brief §3 / §4 not amended (PC-03) — main agent
