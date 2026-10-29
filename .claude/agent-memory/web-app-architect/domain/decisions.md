<!-- next-id: DEC-007 -->

# Decisions (durable)

### DEC-001 · Track C: pure-TS engine over Parquet, DuckDB-wasm dropped · 2026-10-22
**Decision:** Track C ships `fact_pl` minus cost centre and minus the FC2606 cycle (422,712 rows, P 334,700 / S 88,012) as per-entity Parquet (DOUBLE integer cents, dictionary codes) read by `hyparquet`; all §7 logic in `lib/engine/` (framework-free), no DuckDB-wasm, no backend.
**Why:** measured data is small (1.2 M rows fully allocated, 0.42 M unallocated); 8 fixed query shapes; typed-array scan is ms-level vs several MB of wasm + worker cold start (N-01, LCP). Tests run in plain Vitest/Node. Control totals were generated as per-row `amount_local / rate` in Float64, so a month × currency translation reproduces them to the cent.
**Reversal cost:** low — only `lib/data/` knows the file format; DuckDB could sit behind the same `Dataset` type.
**Applied at:** `docs/ADR/0002-track-c-architecture.md` §2.1–2.3 (accepted 2026-10-22; amends ADR-0001 §3 on the DuckDB point); `docs/ADD/tech-stack.md` Track C rows
**Hits:** 2
**Tags:** track-c, parquet, duckdb, engine, performance, data-size
**Confidence:** high
**Last-verified:** 2026-10-22
**Related:** DEC-002, DEC-003
**Status:** active (ADR-0002 accepted by the USER 2026-10-22; dependency list approved incl. vite as vitest peer, eslint 9, typescript 5.9.3)

### DEC-002 · Track C computes C-31 allocation in the engine instead of shipping fact_pl_allocated · 2026-10-22
**Decision:** below-CM lines ship at entity × region × month (the `*_UNASSIGNED` rows); the engine allocates by NR share per (entity, region, month, version) when a slice filter is on; a build-time parity test compares with `fact_pl_allocated` at cent tolerance (generator rounds each slice to 2 dp and pushes the residual to the largest slice).
**Why:** cuts the payload from 1.11 M to 0.42 M rows (~2.6×) for a one-line formula the engine must understand anyway (alloc. tags, notices); T-03 holds by construction. Reads C-32 ("pre-computed in the data model") as "pre-computed in Track C's build pipeline/engine" — USER accepted this reading on 2026-10-22 (ADR-0002 §5 Q3).
**Reversal cost:** low — build-script flag to ship allocated rows + one-line change in `aggregate`.
**Applied at:** `docs/ADR/0002-track-c-architecture.md` §2.2
**Hits:** 2
**Tags:** track-c, allocation, C-31, C-32, data-size, parity-test
**Confidence:** high
**Last-verified:** 2026-10-22
**Related:** DEC-001
**Status:** active (USER accepted 2026-10-22)

### DEC-003 · Track C: this repo ships a skeleton (ADR-0002 slices 0–3) + `.sync/` hand-off; hosting and embedding live in the vosk.dev repo · 2026-10-22
**Decision:** no Vercel project, no deploy and no embedding work for Track C in this repo. `js-report/` stops at scaffold + data build + engine core (T-06 552/552) + Ledger shell/statement; the embed contract, env-var names, build/data-path notes and the remaining build order go to `.sync/` (CLAUDE.md › Cross-repo sync folder), and an agent in the vosk.dev repo finishes, hosts and embeds. `.mcp.json` keeps its single vercel entry (`yaga/vosk-dev`).
**Why:** USER decision (ADR-0002 §5 Q4) consistent with ADR-0001 §2 — this repo ships the three assets only; the vosk.dev repo already owns the wrapper and its hosting. Keeps deploy writes and origin allow-lists in one place.
**Reversal cost:** low — a Vercel project with Root Directory `js-report/` could be created later from this repo; the ADR §2.6 bullet and `.sync/` file would need a superseding note.
**Applied at:** `docs/ADR/0002-track-c-architecture.md` §1, §2.6, §2.8, §4, §5; `docs/ADD/tech-stack.md` Track C hosting row; ADR-0001 §3 amendment note
**Hits:** 1
**Tags:** track-c, hosting, vercel, embed, cross-repo, sync-folder, scope
**Confidence:** high
**Last-verified:** 2026-10-22
**Related:** DEC-001
**Status:** active

### DEC-004 · Track C public chat: cheapest third-party LLM, self-hosted small model preferred, answer quality not the goal · 2026-10-23
**Decision:** the Track C chat (public vosk.dev showcase) runs on the cheapest viable LLM: primary a small open-weight model (Qwen3-4B Q4_K_M, 1.7B as speed fallback) on a CPU VM the USER hosts (Hetzner CX33-class, llama-server, OpenAI-compatible, bearer key, Caddy TLS); fallback a cheap EU API (OVH gpt-oss-20b / Scaleway mistral-small-3.2). The relay and VM live outside this repo; this repo ships only the tool layer + `.sync/` contract. Hallucinations are acceptable: the chat tests the setup and the flow.
**Why:** USER decision, ADR-0009 §8.4 (2026-10-23), overriding archi's quality-first proposal (Mistral Medium 3.5 primary, ~$40–65/month). Showcase budget; sovereignty story is "self-hosted in the EU". Consequence I derived: on CPU the prompt-processing of the fixed prefix (system prompt + tool schemas) dominates turn latency (≈ 20–60 s/turn), so the tool contract must keep the prefix ≤ ~1.2k tokens, trim history, cap tool results (~400 tokens) and the relay must stream, allow ≥ 120 s per call and 429 when both llama-server slots are busy.
**Reversal cost:** low — four relay env values (`LLM_PROVIDER/BASE_URL/API_KEY/MODEL`) switch backend; VM is hourly-billed.
**Applied at:** `docs/ADR/0009-ai-chat-track-a.md` §8.4; `.sync/2026-10-23-track-c-chat-backend.md` (archi); `.sync/2026-10-23-track-c-chat-contract.md` (nerd)
**Hits:** 1
**Tags:** track-c, ai-chat, llm, self-host, llama-cpp, qwen3, cost, sovereignty, relay
**Confidence:** high
**Last-verified:** 2026-10-23
**Related:** DEC-003
**Status:** active

### DEC-005 · New showcases ship as standalone JS apps (one top-level folder per report), not routes in `js-report/` · 2026-10-28
**Decision:** from Nordmark on, each new showcase's JS flavour is its own Next.js app at the repo root (proposed `js-exec/`, alt `nordmark-app/`), with its own package.json / lockfile / lint / vitest, copied helpers (`parquet-columns.ts`, csv, parity runner) instead of cross-app imports; the `.sync/` pack is the folder itself (`npm ci && npm run build`). Two flavours only (JS + PBI), local Parquet from a deterministic generator, no `lh_raw` at runtime; pulse dot = literal v5 rule (7/3/2 → orange).
**Why:** USER 2026-10-28 ("standalone apps per report for the .sync hand-offs"), relayed by the main agent while ADR-0013 was being drafted. Reverses the ADR-0011 (c) reasoning (Mirelo = route `/sales` to reuse tooling) for *new* reports; Mirelo's route is untouched. Price accepted: duplicated tooling + a second CI job; benefit: self-contained pack, no shared bundle, no design-system leakage, no LCP coupling.
**Reversal cost:** low — folders map 1:1 onto `js-report/app/<x>/`, `components/<x>/`, `lib/<x>/`; engine is framework-free.
**Applied at:** `docs/ADR/0013-nordmark-executive-dashboard.md` §2 (a)(b)(h)(i), §5; `docs/Requirements-exec.md` E-02, E-80…E-83, E-86
**Hits:** 1
**Tags:** showcase, js-flavour, standalone-app, sync-handoff, portability, parquet, nordmark, two-flavours
**Confidence:** high
**Last-verified:** 2026-10-28
**Related:** DEC-001, DEC-003
**Status:** active (ADR-0013 Proposed; the four USER points inside it are decided)

### DEC-006 · Nordmark exec: granularity picker (W/P/Q/FY + one item) replaces the Week/PTD/YTD switcher; items derived from dim_week, like-length "previous item", `@k` control keys · 2026-10-29
**Decision:** period model = granularity (Week · Month=4-5-4 period · Quarter · Year) + one item, default W43 FY2026 so the v5 story is untouched; bars follow the granularity (13 / 12 / 8 / 2); comparator kept with "Last week" → "Previous item" (previous member, cut to the current item's week count when the current item is partial; **at Year "Previous" is hidden** because it would ≡ LY — USER 2026-10-29, overturning "keep both"; `c=prev` + Year item normalises to `ly`); Δ suffix always short `vs prev. wk / mth / qtr` (USER); "Month" is the only UI word for the 4-5-4 period, chips stay P1…P12 (USER round 3); EBITDA-at-Week Previous = previous month cut to the week's position, control value = the W key's `P-…@k` key (always `@k`; 87 item keys; week 5 of a 5-week month → N/A) (USER round 3 + main-agent ruling); ⓘ fixed copy period-neutral, owner notes dropped (USER round 3); Channel mix = window shares at P/Q/FY, exit mix only at W (USER, overturning the as-built reading; `mix_*` control rows move, ET-24 excludes them); Budget stays FY2026-only → budget cards N/A in FY2025, target cards still rated; EBITDA = PTD at Week (v5), own window at P/Q/FY; control keys `{W|P|Q|FY}-FY{yyyy}[-{n}][@{k}]` (`@k` = first k weeks; 62 keys, ≈ 17.2 k rows); items derived per flavour from `dim_week` (no generator table); JS URL = single `i=` item key with granularity implied, legacy `p=`/`c=lw` parse-only.
**Why:** USER first-open feedback 2026-10-29 (coms §7): "a proper calendar / history", no date picker, both flavours. Like-length cut chosen over full-previous-item because € deltas of the two partial items (Q4 FY2026, FY2026) would compare 4 vs 13 weeks; chosen over N/A because it makes "previous year" coincide with LY at Year. No FY2025 budget generated: it would rewrite the story data for a history view the N/A pattern already covers.
**Reversal cost:** low–medium — only `calendar.ts`/`metrics.ts`/`view.ts`/`url-state.ts` window functions and the PBI folder-9 window measures move; cube, Parquet and story untouched. Key grammar change forces a `verify.py` + DAX test regeneration (≈ 65 min serial DAX run unless sampled).
**Applied at:** `docs/ADR/0013-nordmark-executive-dashboard.md` (k) + "Resolved"; `docs/Requirements-exec.md` §2b E-90…E-99, ET-21…ET-30; `docs/ADD/features/exec-period-model.md` §8 (resolved) + §9
**Hits:** 2
**Tags:** nordmark, period-model, calendar, 4-5-4, granularity, comparator, control-totals, url-state, pbi-picker, parity
**Confidence:** high (USER decision; all 9 §8 points ruled 2026-10-29 — 6 defaults held, 3 overturned: Year comparator, channel-mix window, Δ length)
**Last-verified:** 2026-10-29
**Last-refined:** 2026-10-29
**Related:** DEC-005, CNV-001
**Status:** active
