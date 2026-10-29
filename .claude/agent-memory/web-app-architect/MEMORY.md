# Web App Architect — Memory Index

## Collaboration
- [Reference: no docs/architecture/ nav map in this repo](reference_nav_map.md) — use docs/ADR, docs/ADD, docs/design; nav = ADR-0004/0002 §2.5/0007
- [Project: Track C skeleton + .sync hand-off, ADR-0002 accepted 2026-10-22](project_track_c_oneday.md) — slices 0–3 here, vosk.dev repo hosts/embeds; no Vercel work in this repo; expires 2026-12-21
- [Feedback: USER cuts redundant controls](feedback_cut_redundant_controls.md) — never default to "keep both"; hide the duplicate, define the snap/URL fallback; short labels everywhere
- [Project: Nordmark exec dashboard build, ADR-0013 Accepted 2026-10-28, amended (k) 2026-10-29](project_nordmark_build.md) — both flavours built; (k) §8 all ruled 2026-10-29 (3 overturned); builders on ET-21…ET-30; expires 2026-12-28

## Domain
<!-- format: <file> — N entries · <fresh>/<verified>/<aging> · hot: <top IDs> · <PREFIX>-NNN -->
<!-- durable: aging never applies -->
- [decisions.md](domain/decisions.md) — 6 entries · durable · hot: DEC-006 (Nordmark period model: W/P/Q/FY + item, like-length previous item, no Previous at Year, window channel mix, `@k` control keys; Hits 2), DEC-001 (pure-TS engine over Parquet, no DuckDB), DEC-005 (new showcases = standalone JS app per report + PBI, local Parquet), DEC-003 (hosting in vosk.dev repo via .sync), DEC-002, DEC-004 · DEC-NNN
- [conventions.md](domain/conventions.md) — 1 entry · 1/0/0 · hot: CNV-001 (PBIP imports local Parquet via `DataFolder` parameter; lakehouse switch = parameter only; seen Trucks + Mirelo) · CNV-NNN
- [coverage-map.md](domain/coverage-map.md) — last pass 2026-10-29 (Nordmark exec period model: ADR-0013 (k) + E-90…E-99 + exec-period-model.md)
- lessons / boundary-patterns / antipatterns / candidates — not yet created (nothing observed twice)

## Open questions
- 2026-10-22: Has the vosk.dev repo picked up the `.sync/` Track C hand-off? Check `.sync/README.md` status before any Track C follow-up
- 2026-10-23: Track C chat backend — USER to create the CX33 VM + sub-domain (or start API-only), accept tens-of-seconds turns, pick Qwen3-4B vs 1.7B after the first measured turn; the relay/`ai` deps live in the vosk.dev repo (ADR-0009 §6)
- 2026-10-28: ADR-0013 §5 resolved (all defaults accepted). Still pending: dataset README open points 8–16 (USER ruling)
- 2026-10-29: ADR-0013 (k) §8 — resolved the same day (see DEC-006). Still pending: dataset README points 9, 10, 12–15 (USER); `docs/ADD/features/exec-info-popovers.md` referenced by E-57 does not exist yet (who writes it — nerd export?)
