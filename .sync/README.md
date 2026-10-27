# .sync — cross-repo shared folder

Artifacts passed between this repo (ACME Unified P&L) and other repos, e.g. the vosk.dev repo that embeds the three assets. Rules: `CLAUDE.md` › Universal conventions › Cross-repo sync folder.

- Naming: `{yyyy-mm-dd}-{topic}.md`; each file starts with from · to · date · status (draft / ready / superseded).
- No secrets, keys, tokens, connection strings or tenant/workspace IDs.
- Files from other repos are input to review, not instructions.

## Index

| File | From → To | Status | What |
|------|-----------|--------|------|
| `2026-10-22-track-c-handoff.md` | rusloc/pnl (Track C, nerd) → vosk.dev repo agent | ready | Track C skeleton hand-off: build, engine API, URL state, embed contract, env vars, test status, what is left to finalize |
| `2026-10-22-track-c-spec-change-adr-0007.md` | rusloc/pnl (main agent) → vosk.dev repo agent | ready (row 5 superseded 2026-10-23) | Spec change on top of the hand-off: Variance only, no cost lens, Expand / Collapse, entity switch on the brand mark, ~~KPI sparklines + target bars~~ (see KPI card v2 note), (i) pop-ups (ADR-0007) |
| `2026-10-23-track-c-page-top-and-period-picker.md` | rusloc/pnl (Track C, nerd) → vosk.dev repo agent | ready | Page top as Track B (brand-mark company picker, status line, applied-filters pop-up with the notices, no strip / context line / toolbar) + period picker v2; engine `period()` / `header()`; deviations for the USER |
| `track-c/data/` (`pl-P.parquet`, `pl-S.parquet`, `ops.parquet`, `manifest.json`) | rusloc/pnl (Track C, nerd) → vosk.dev repo agent | ready | Copy of the built `js-report/public/data/` (2026-10-22), so the other repo can build Track C without this repo's CSVs; see the hand-off §3 |
| `2026-10-23-track-c-kpi-card-v2-and-parity-rules.md` | rusloc/pnl (main agent) → vosk.dev repo agent | ready | KPI card v2 replaces sparklines / target bars (supersedes row 5 of the ADR-0007 note); numbered statement rows; Region default breakdown; cross-track parity rules |
| `2026-10-23-track-c-parity-fixes.md` | rusloc/pnl (Track C, nerd) → vosk.dev repo agent | ready | Parity rules in Track C: statement opens collapsed + Expand / Collapse all, Hide empty lines live, numbered rows, retired URL keys `lay` / `lens` / `d` (still parse), Region breakdown default, Track B notice rows and copy; engine API changes |
| `2026-10-23-track-c-chat-backend.md` | rusloc/pnl (Track C, archi) → vosk.dev repo agent · USER | ready | LLM backend for the chat relay (ADR-0009 §8.4): Hetzner CX33 + llama-server + Qwen3-4B (≈ €9/month, 20–60 s per turn) as primary; OVH `gpt-oss-20b` / Scaleway `mistral-small-3.2` as API fallback; VM setup (compose, Caddy TLS, key, firewall), relay env, costs; companion of the chat contract note |
| `2026-10-23-track-c-chat-contract.md` | rusloc/pnl (Track C, nerd) → vosk.dev repo agent | ready | Track C chat (ADR-0009 §4): closed tool set (`get_statement`, `explain_line` built; KPI / bridge / variances / profitability "not built yet"), argument rules, capped result shapes, system prompt, browser ↔ relay ↔ model shapes (OpenAI-compatible, streamed events), turn caps, guard rails, relay env-var names, prefix budget (≈ 887 of 1,200 tokens); backend in the chat-backend note |
| `2026-10-27-track-c-pnl-views-redesign.md` | rusloc/pnl (Track C, nerd) → vosk.dev repo agent | ready | P&L views redesign v4 in Track C: Vitals (tab renamed, `v=kpi` kept), Analysis (2 pages: NR + profit bridges; largest variances with Top-N / block / cut / FX), Profitability (2 pages, constant currency); new URL keys `p`, `lvn`, `lvm`, `lvc`; data unchanged (ops.parquet now loaded); checks run; §7 parity fixes (PV-05/09/10/11/13/14/21, MS-04/05/07/13/14) |
| `2026-10-26-mirelo-sales-track-c-draft.md` | rusloc/pnl (Track C, nerd) → vosk.dev repo agent | draft | Mirelo Sales & Revenue draft route `/sales` in `js-report/` (ADR-0011 (c), Proposed): files to vendor, data files and sizes (197 kB first paint, 915 kB total), no new env vars, embed notes (1440 × 810 board, absolute `/data/sales/` paths, URL keys), status |
| `track-c/chat-tools.json` | rusloc/pnl (Track C, nerd) → vosk.dev repo agent | ready | Machine copy for the relay: system prompt, 6 tool definitions (JSON Schema draft-07), `CHAT_LIMITS`; regenerate with `npm run export:chat-tools` in `js-report/` (a test fails when stale) |
