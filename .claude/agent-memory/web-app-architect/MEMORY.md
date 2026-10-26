# Web App Architect — Memory Index

## Collaboration
- [Reference: no docs/architecture/ nav map in this repo](reference_nav_map.md) — use docs/ADR, docs/ADD, docs/design; nav = ADR-0004/0002 §2.5/0007
- [Project: Track C skeleton + .sync hand-off, ADR-0002 accepted 2026-10-22](project_track_c_oneday.md) — slices 0–3 here, vosk.dev repo hosts/embeds; no Vercel work in this repo; expires 2026-12-21

## Domain
<!-- format: <file> — N entries · <fresh>/<verified>/<aging> · hot: <top IDs> · <PREFIX>-NNN -->
<!-- durable: aging never applies -->
- [decisions.md](domain/decisions.md) — 4 entries · durable · hot: DEC-001 (pure-TS engine over Parquet, no DuckDB), DEC-002 (C-31 allocation in engine), DEC-003 (hosting/embedding in vosk.dev repo via .sync), DEC-004 (Track C chat: cheapest LLM, self-hosted CPU VM, quality not the goal) · DEC-NNN
- [coverage-map.md](domain/coverage-map.md) — last pass 2026-10-23 (Track C surfaces; AI chat path decided, backend note in .sync)
- lessons / boundary-patterns / conventions / antipatterns / candidates — not yet created (nothing observed twice)

## Open questions
- 2026-10-22: Has the vosk.dev repo picked up the `.sync/` Track C hand-off? Check `.sync/README.md` status before any Track C follow-up
- 2026-10-23: Track C chat backend — USER to create the CX33 VM + sub-domain (or start API-only), accept tens-of-seconds turns, pick Qwen3-4B vs 1.7B after the first measured turn; the relay/`ai` deps live in the vosk.dev repo (ADR-0009 §6)
