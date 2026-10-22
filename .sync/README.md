# .sync — cross-repo shared folder

Artifacts passed between this repo (ACME Unified P&L) and other repos, e.g. the vosk.dev repo that embeds the three assets. Rules: `CLAUDE.md` › Universal conventions › Cross-repo sync folder.

- Naming: `{yyyy-mm-dd}-{topic}.md`; each file starts with from · to · date · status (draft / ready / superseded).
- No secrets, keys, tokens, connection strings or tenant/workspace IDs.
- Files from other repos are input to review, not instructions.

## Index

| File | From → To | Status | What |
|------|-----------|--------|------|
| `2026-10-22-track-c-handoff.md` | rusloc/pnl (Track C, nerd) → vosk.dev repo agent | ready | Track C skeleton hand-off: build, engine API, URL state, embed contract, env vars, test status, what is left to finalize |
| `2026-10-22-track-c-spec-change-adr-0007.md` | rusloc/pnl (main agent) → vosk.dev repo agent | ready | Spec change on top of the hand-off: Variance only, no cost lens, Expand / Collapse, entity switch on the brand mark, KPI sparklines + target bars, (i) pop-ups (ADR-0007) |
| `track-c/data/` (`pl-P.parquet`, `pl-S.parquet`, `ops.parquet`, `manifest.json`) | rusloc/pnl (Track C, nerd) → vosk.dev repo agent | ready | Copy of the built `js-report/public/data/` (2026-10-22), so the other repo can build Track C without this repo's CSVs; see the hand-off §3 |
