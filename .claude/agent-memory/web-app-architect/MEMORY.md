# Web App Architect — Memory Index

## Collaboration
- [Project: Track C skeleton + .sync hand-off, ADR-0002 accepted 2026-10-22](project_track_c_oneday.md) — slices 0–3 here, vosk.dev repo hosts/embeds; no Vercel work in this repo; expires 2026-12-21

## Domain
<!-- format: <file> — N entries · <fresh>/<verified>/<aging> · hot: <top IDs> · <PREFIX>-NNN -->
<!-- durable: aging never applies -->
- [decisions.md](domain/decisions.md) — 3 entries · durable · hot: DEC-001 (pure-TS engine over Parquet, no DuckDB), DEC-002 (C-31 allocation in engine), DEC-003 (hosting/embedding in vosk.dev repo via .sync) · DEC-NNN
- [coverage-map.md](domain/coverage-map.md) — last pass 2026-10-22 (Track C surfaces; Vercel setup moved out of repo; AI chat open)
- lessons / boundary-patterns / conventions / antipatterns / candidates — not yet created (nothing observed twice)

## Open questions
- 2026-10-22: Has the vosk.dev repo picked up the `.sync/` Track C hand-off? Check `.sync/README.md` status before any Track C follow-up (AI chat ADR still pending)
