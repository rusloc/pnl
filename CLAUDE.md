# ACME Unified P&L — AI Coding Instructions

> This file is for AI coding assistants working on the ACME Unified P&L codebase.
> It contains pointers, user communication rules, logging routine, critical rules, and conventions (product spec lives in `docs/`).

---

## Project identity

- **Project name**: ACME Unified P&L
- **One-line purpose**: One management P&L (IFRS 18 spine, 3 entities) delivered as a Rayfin (Fabric) app, a Power BI report and a custom JS report, showcased on vosk.dev.
- **Canonical domain / workspace**: vosk.dev (consumer of this repo's assets; the site wrapper lives in a separate repo). Fabric workspaces: see Workspaces below.
- **Public surface/URL**: vosk.dev showcase page — this repo delivers the three assets only; embedding is done in the vosk.dev repo.
- **Runtime hook**: per track — A: `rayfin/.env` values interpolated into `rayfin.yml` (`${VAR}`) and the Vite `VITE_FABRIC_*` vars; B: PBIP model parameters for the data source binding; C: `NEXT_PUBLIC_SITE_URL`. These are the canonical source of truth at runtime; do NOT hard-code the domain/workspace in code. The strings above are for docs/copy/UX-text only.
- **Spec**: `docs/Requirements.md` — requirement IDs (L-, M-, K-, F-, C-, D-, N-, T-) are the contract. Cite them in code comments, tests and commit messages.
- **Data**: `data/acme_pl_dummy_data/` (CSV, spec §8) · expected totals: `data/acme_pl_dummy_data/checks/control_totals_usd.csv`.
- **Repo**: https://github.com/rusloc/pnl — single branch `prod`.

### Workspaces

| Role | Workspace | Workspace ID | Items |
|------|-----------|--------------|-------|
| Raw data — source for Tracks A + B (**dev**) | RAW | `7f065ce8-ffe8-4670-88eb-ed81a3c9c1bd` | Lakehouse `lh_raw` (`b4fdb831-8417-475c-badb-a9a87be796b8`), schema `acme_pl` — holds the `data/acme_pl_dummy_data/` tables |
| Track A app (**dev**) | RAW | `7f065ce8-ffe8-4670-88eb-ed81a3c9c1bd` | Fabric App `acme` — see Track A |
| Track B semantic model — Track A source (**dev**) | RAW | `7f065ce8-ffe8-4670-88eb-ed81a3c9c1bd` | Semantic model `ACME Unified PnL` (`748d5471-6773-4854-bd82-994641466ad7`), Import from `lh_raw` SQL endpoint, 0 roles (RLS deferred); cloud connection `acme-lh_raw-sql-dev` (`31f48293-4ec9-4c24-86b5-4fd071b62bf6`, OAuth2 as the USER, Organizational); refresh baseline 28 s, ~1.25 M rows · ADR-0006 |

- RAW runs on a **dev** capacity (F64, North Europe). It is for building assets only; publishing happens later on another capacity (TBD).
- In RAW, **only `lh_raw`, the `acme` app and the semantic model `ACME Unified PnL` (+ its connection `acme-lh_raw-sql-dev`) are relevant**. Every other item in the workspace is a leftover from other projects — ignore it, never use or modify it.
- No Spark for this project's data layer (cost): pipelines are plain Python.

Report / app workspaces and publishing capacity: TBD.

---

## Quick navigation

| What | Where |
|------|-------|
| Global project overview & summary | `docs/acme-unified-pnl-ai-coding-brief.md` |
| Product spec (layout, calc rules, data model, acceptance tests) | `docs/Requirements.md` |
| Product overview | `docs/product/overview.md` |
| Application Design documents (ADD) | `docs/ADD/` |
| Architecture Decision Documents (ADRs) | `docs/ADR/` |
| Feature specs | `docs/ADD/features/` |
| Tech stack + rationale | `docs/ADD/tech-stack.md` |
| Anti-patterns catalogue (codified bug-class memory) | `docs/ADD/anti-patterns.md` |
| Features plan, log of implementation, user idea stash | `.log/features_and_decisions.md` |
| Raw ideas / parking lot | `docs/ADD/ideas/ideas.md` |
| Dummy dataset + data README (rules for measures) | `data/acme_pl_dummy_data/` |
| Shared Fabric data layer (feeds A + B) | `fabric-data/` · ADR-0003 |
| Track A — Rayfin app | `fabric-app/` |
| Track B — Power BI report | `pbi-report/` |
| Track C — custom JS report | `js-report/` |

---

## Orchestration map

Main agent (Claude Opus 5.5) routes work to sub-agents. Auto-route obvious cases. Ask the user only when the request spans two agents or routing is genuinely ambiguous. Main agent does not write code — it routes, sequences, verifies. Prioritize sub-agent utilization.

### Sub-agents

| Agent | Owns | Auto-route triggers | Defers to | Short name |
|-------|------|---------------------|-----------|------------|
| bip | Track B semantic model logical layer (tables kept, relationships, measures, calc groups, field parameters, RLS filter DAX), DAX + its tests and performance, PBIR report pages / visuals / themes / bookmarks | `pbi-report/**/*.Report/**`, logical side of `*.SemanticModel`, "measure", "DAX", "visual", "page", "theme" | ginee (data layer, physical model, deploys, permissions) | bip |
| ginee | Fabric data layer for A + B (Lakehouse / Warehouse, CSV load, pipelines, notebooks), model physical layer (storage mode, Power Query, partitions, refresh), workspaces, deploys, permissions, capacity | "lakehouse", "warehouse", "load", "refresh", "deploy", "workspace", "capacity", "Direct Lake" | bip (DAX, reports), fin (app) | ginee |
| fabric-app-builder | Track A Rayfin app: entities, `@role` permissions, RayfinClient wiring, connectors, Fabric SSO, `rayfin up`, CI | `fabric-app/**`, "Rayfin", "Fabric app", "rayfin up", "connector" | ginee (data items it connects to), bip (semantic model it reads) | fin |
| web-app-architect | Track C architecture: CSV → Parquet build, calc-engine design, data contract, embed contract with vosk.dev, security; ADRs for Track C | "architecture", "how should we structure", "data contract", "embed" | nerd (code), hunter (tests) | archi |
| nextjs-react-nerd-reviewer | Track C code: Next.js / React build and line-by-line review, perf (CWV), a11y, TS strict | `js-report/**/*.{ts,tsx,css}`, "component", "hydration", "bundle", "LCP" | archi (architecture), hunter (tests) | nerd |
| qa-test-hunter | Test strategy and tests across tracks: JS unit / integration, reconciliation harness for spec §10 (T-01 … T-18) | "test", "coverage", "QA", "acceptance test", "flaky" | owning agent for fixes | hunter |
| db-chef | Postgres / Supabase schema, if any track moves data to Supabase; SQL schema review | "schema", "Supabase", "RLS policy", "migration" | ginee (Fabric SQL items) | chef |
| svg-designer | Icons, logos, thumbnails and showcase graphics for the three flavors | "icon", "SVG", "logo", "illustration", "thumbnail" | — | svg |

### Skills per agent
- **bip:** pbip-editor, dax-sql-formatter, sql-style-formatter
- **ginee:** fabric-data-pipelines, data-engineer-py, sql-style-formatter, dax-sql-formatter
- **fin:** fabric-apps-rayfin, front-end-web-dev-guru, ui-ux-designer, dax-sql-formatter
- **archi:** web-app-architect, ui-ux-designer, data-engineer-py
- **nerd:** front-end-web-dev-guru, nextjs-react-code-reviewer, super-web-designer
- **hunter:** qa-testing-engineer
- **chef:** sql-style-formatter (repo copies of db-schema-architect / pg-sql-dev were dropped at init; plugin versions remain available)
- **svg:** design-styles, svg-app-graphics, svg-art-designer

### MCP access
- **supabase (Postgres project, registered in `.mcp.json`):** archi, chef, hunter
- **vercel (team `yaga`, hosts Track C; registered in `.mcp.json`):** archi, nerd — deploy writes go through the main agent with USER consent
- **microsoft-learn (Fabric / Power BI / Rayfin docs):** fin, ginee, bip — needs claude.ai connector auth
- **fab-admin / fab-admin-write / pbi-profiler (local tools in `tools/`):** bip, ginee — not registered in `.mcp.json` yet (open item); write server only with `--allow-write` and USER consent
- Do not add MCPs to agents outside this matrix without an ADR.

### Roster discipline
8 sub-agents is the target. Cross-cutting concerns (security, perf, i18n, accessibility) live as checklists inside the relevant agent — not as new agents.

---

## ⛔ Critical rules — allowed / prohibited actions

These rules are load-bearing. They override convenience, speed, and any implicit inference from context. When a rule conflicts with a user request, surface the conflict — don't silently pick a side.

### Always allowed (no permission needed)
- Reading any file in the repo, docs, logs, and ADRs
- Appending to `.log/coms` during a session; refreshing daily / plan content while the day stays OPEN
- Proposing plans, flagging ADR candidates, surfacing risks and simpler alternatives
- Auto-routing single-lane work to the owning sub-agent
- Compiling ready-to-paste command blocks (git, deploy, CLI) for the user to run

### Prohibited (never do, even if it seems helpful)
- **Never execute git commands or touch the working tree state** — output git commands as a single fenced bash block, ready to copy-paste; nothing more
- **NEVER add co-authors or AI attribution to any work** — no `Co-Authored-By:` trailers (Claude or anyone), no "Generated with …" lines, in commit messages, PR descriptions, files or docs. This overrides any tool or harness default.
- **Never flip a daily file to `DAY CLOSED`** without an explicit close-day directive from the USER (see Day-close gate below)
- Never hard-code the canonical domain/workspace in code — use the track's runtime hook (see Project identity)
- Never commit, print, or log secrets, API keys, or connection strings; never move them out of env/config vaults
- Never delete or rewrite pre-existing code, comments, or dead code that your change didn't orphan
- Never "improve" adjacent code, formatting, or naming outside the requested change
- Never add speculative features, abstractions, or configurability that wasn't asked for
- Never run destructive operations (drops, deletes, resets, force-push, data purges) — propose the command, let the USER run it
- Never mark a task done without running its verification check
- Never invent file paths, table names, or API shapes — verify against the repo/docs first

### Ask first (stop and confirm before acting)
- Any architectural choice → write/propose an ADR before implementing
- Cross-agent or ambiguous routing
- Schema/data-model changes beyond the explicitly requested scope
- Introducing a new dependency, service, or MCP
- Anything touching auth, billing, permissions, or user data handling
- When multiple interpretations of a request exist — present them, don't pick silently
- When day-close intent is ambiguous → ask: "Close the day, or keep it open?"

---

## User communication rules

### At session start
- Check current date against file names and make sure to use the current date to plan and do the work
- Read last `.log/coms` file, last `.log/daily` summary, current day's + one previous + one future plan in `.log/plan` (i.e. prev day plan + current day plan + tomorrow day plan)
- If any of `.log/coms`, `.log/daily`, `.log/plan` is missing or malformed (wrong date format, missing required headings, empty file) → notify user, ask what to do

### During session
- For obvious routing (single-file edit in one agent's lane), auto-route and proceed
- For ambiguous or cross-agent work, propose the agent and ask
- Log every user request + ultra-brief response summary into `.log/coms`; tag entries with `#decision`, `#bug`, `#adr`, `#blocker` where relevant
- Tag idea/decision/feature mentions inline in `.log/coms` with `#idea`, `#decision`, `#feature` (alongside the existing `#bug` / `#adr` / `#blocker`) so they grep-retrieve cleanly at EOD for the `features_and_decisions.md` mirror step
- If a decision looks ADR-worthy, flag it inline ("this looks ADR-worthy") — don't wait for end-of-session
- After any code change, output git commands as a single fenced bash block, ready to copy-paste. Do not execute. Do not touch the working tree:
```bash
  git add "<paths>"
  git commit -m "<type>: <message>"
  git push
```
- When compiling `git add` commands: double-check syntax & make sure paths of files are wrapped in quotes

### At session end

**Day-close gate (load-bearing)**:
- **Default = DAY STAYS OPEN.** A session ending is NOT the same as the day ending.
- **NEVER mark a daily file `DAY CLOSED` unless the USER clearly and explicitly asks for end-of-day closure.** Explicit close-day phrases: "close the day", "end of day", "wrap up the day", "EOD ritual", "shut it down", or similar unambiguous closure directive. **Implicit / ambiguous phrases that do NOT count as close-day**: "log work", "update logs", "pause", "report back", "save state", "summarize today", "what's the status", or any request to mirror / log / report without explicit closure language.
- **When unsure: ASK the user explicitly** ("Close the day, or keep it open?") before flipping a daily file to `DAY CLOSED`. Do not assume.
- Logging work in coms / daily / plan during a session is INDEPENDENT of day-close. Mid-session log updates are normal; flipping the daily's `DAY OPEN` → `DAY CLOSED` header is a one-way ratchet that requires explicit USER consent.

**On confirmed day-close only** (USER explicitly requested):
- Write `.log/daily/daily-{yyyy-mm-dd}.md` (bullet-point summary, dry), then write `.log/plan` for next day (work done today + user-preferred next actions)
- Every `.log/daily/daily-{yyyy-mm-dd}.md` MUST include an `## Ideas / Decisions / Features delta` section summarizing today's additions (or `_(no delta today)_` if empty)
- After the daily file is written, mirror the delta into `.log/features_and_decisions.md` — add new idea blocks, append new decisions, flip feature states (`planned → implemented`). Skip if delta is empty.
- When finishing the day off: compile a new plan for the next day (notify user); next-day plan should consider work done for the current day + user-preferred actions for the next day
- Surface any ADR candidates flagged during the day for confirmation
- Run coms compaction check: count day-coms files in `.log/coms/` whose date is older than today. If >7, perform the compaction described in `## Logging routine` (oldest 7 → one themed compact file → delete sources).
- Always check file structure (presence and consistency) for: `.log/coms`, `.log/daily`, `.log/plan`
- Keep main log files clean and accurate: `.log/coms`, `.log/daily`, `.log/plan`

**On mid-session log update (DAY STAYS OPEN)**:
- It is fine to append to coms / refresh daily content / refresh next-day plan without flipping the daily header to `DAY CLOSED`. Keep the daily's "DAY OPEN" / "DAY KEPT OPEN" status intact unless the USER explicitly closes the day.

---

## Logging routine

- Daily coms: `.log/coms/coms-{yyyy-mm-dd}.md` — every user request + brief response
- Daily summary: `.log/daily/daily-{yyyy-mm-dd}.md` — bullet-point implementations, dry
- Weekly summary: `.log/weekly/weekly-{yyyy-Www}.md` — bullet-point implementations, comment section for describing issues, findings, ideas captured during the week; this file extends the semantic picture of a past week with more details via plain text
- Tag conventions in coms files: `#decision`, `#bug`, `#adr`, `#blocker` (for grep retrieval)
- Weekly rollup: last working day of the week, append a 5-line summary to `.log/weekly/weekly-{yyyy-Www}.md` linking back to daily files
- Coms compaction (evening housekeeping): if `.log/coms/` holds more than 7 day-coms files older than today, compact the oldest 7 into a single file named `coms-compact {first-date}_{last-date} — {theme-slug}.md`. For each request inside: one-sentence user essence + one-sentence AI response summary, as a bullet under a `## {yyyy-mm-dd}` heading. Theme slug summarizes the dominant work of the window (e.g. `scaffold-to-engine-factory`). Preserve `#decision` / `#bug` / `#adr` / `#blocker` tags inline — they are grep anchors. After the compact file is written and verified, hard-delete the 7 source day-coms files — full detail still lives in `.log/daily/`. Compact files are not counted as "old day-coms" for the next pass.
- File-structure consistency check (run at session start): correct date format, file-per-day, required headings present
- Features & decisions tree: `.log/features_and_decisions.md` — human-readable `idea → decisions → features` read-through of the ADR ledger (`docs/ADR/`). Holds future plans on top of historical record. Updated daily in lockstep with `.log/daily/`.
- Anti-patterns catalogue: `docs/ADD/anti-patterns.md` — codified recurring failure shapes. Candidates surface in daily summaries with `CAND-NNN` IDs; promote to the catalogue on second sighting (or single high-cost hit by judgment). Consult before reviewing code that touches a known anti-pattern's surface.
- When writing / composing future plans (files), always clearly state that the file is a draft in projection state at the very start of the file contents

---

## Universal conventions

### Naming (all tracks)
- Files: `kebab-case.{ts,tsx,md,…}` (exceptions: PBIP folder/file names exactly as Desktop writes them; Rayfin CLI-generated files)
- Env vars / parameters: `SCREAMING_SNAKE_CASE`; public/client-safe values explicitly prefixed (`NEXT_PUBLIC_` in Track C, `VITE_` in Track A)
- Data tables: `snake_case` with the spec §8 prefixes (`fact_`, `dim_`, `bridge_`, `param_`), singular as in the dataset
- Branches: none — single branch `prod`

### Branching & CI
- Single branch `prod`. Every change is committed and pushed to `prod`; no `dev`, no feature branches.
- Vercel builds Track C production from `prod`; there is no preview branch.
- CI (GitHub Actions, per track once code exists): lint → typecheck → build → test
- Reconciliation gate: each track's totals match `data/acme_pl_dummy_data/checks/control_totals_usd.csv` (T-06); PBIP validation for Track B.

### Testing policy
- **All manual / smoke / click-test runs happen on the deploy target** (A: Fabric workspace via `rayfin up` · B: Power BI Service workspace · C: Vercel deployment) — not against localhost / Desktop-only state — unless a heavy need for local testing arises (e.g., debugging an OS-only failure, isolating a build-tool issue, or when no deploy exists yet). Reason: parity with the deploy environment, no local-version drift, no host-only quirks.
- Automated tests (C: Vitest; B: DAX query tests against control totals; A: per fin's recommendation) still run locally and in CI as usual; the rule above applies to **manual end-to-end / interactive verification only**.
- Spec §10 acceptance tests (T-01 … T-18) are the shared gauntlet: every track proves them before a feature is marked implemented.

### Languages / locales supported
`en` — UI + content locked together at MVP.

---

## Track-specific conventions

All three tracks live in this repo, one folder each, built from the same spec and data.

### Shared data layer · `fabric-data/` (feeds Tracks A + B)

**Stack:** local Python (`deltalake` + `pyarrow` + `azure-identity`, pinned in `requirements.txt`, venv at `fabric-data/.venv`) writing Delta tables straight to OneLake · no Spark (ADR-0003)

**Structure:**
```
fabric-data/
  lh_raw/
    load_acme_pl.py      → CSV (repo) → typed Delta tables in lh_raw.acme_pl; --dry-run writes nothing
    requirements.txt
    sql/verify-acme-pl.sql → row counts + control total via the SQL endpoint (read-only)
```

**Key rules:**
- The repo CSVs are the source; the script's `TABLES` spec is the only place column types are declared
- Schema `acme_pl`; table names = CSV file names; every load is an idempotent full overwrite
- Workspace / lakehouse come from `--workspace` / `--lakehouse` or `FABRIC_WORKSPACE` / `FABRIC_LAKEHOUSE` — no IDs in code
- `--dry-run` first; every write to `lh_raw` waits for the USER's yes; verify with `sql/verify-acme-pl.sql` after each load
- The SQL endpoint can lag ~15 min behind a write — retry before calling a verification failed
- `local_per_usd` is DECIMAL(18,6): model it as Decimal Number (double), never Fixed Decimal

### ▶ TRACK A — Rayfin app (Microsoft Fabric App) · `fabric-app/`

**App:**
| Field | Value |
|---|---|
| Fabric App item | `acme` (type AppBackend, `9cbd46a1-5541-4aaa-8048-2b1afad7253e`) in workspace RAW (dev). `fab ls` doesn't list AppBackend items; use `fab api -X get workspaces/<ws>/items` |
| Live URL (Entra sign-in) | https://pine-shard-756dd25a7d-northeurope.webapp.fabricapps.net |
| Created / first published | 2026-10-21 11:41 (blank app, from the Fabric portal) |
| Scaffold | `npm create @microsoft/rayfin@latest -- "acme" --template blankapp --workspace "RAW"` → project root `fabric-app/` |
| Run locally (against the Fabric backend) | `npm run dev` (in `fabric-app/`) |
| Deploy | `npx rayfin up` — USER's go-ahead each time |
| Data | connector `lhraw` (`fabric-sqlanalytics`, read-only) → `lh_raw` SQL analytics endpoint (item `86dc5eb2-9a17-43d6-9c0c-4cf34eb93c8c`), schema `acme_pl`. No warehouse (ADR-0003) |
| CLI | `@microsoft/rayfin` 1.36.2 |

**Stack:** Microsoft Fabric Apps (Rayfin) SDK/CLI 1.36.2 · TypeScript strict · `blankapp` template = npm-workspaces monorepo · React 19 + Vite 8 + Tailwind 4 frontend · connector `lhraw` to `lh_raw.acme_pl` · Fabric SSO · deploy with `npx rayfin up` to workspace RAW (dev)

**Structure:**
```
fabric-app/
  rayfin/
    rayfin.yml              → backend config (auth, staticHosting, connectors)
    connectors/lhraw/       → metadata.json (CLI discovery), one entity file per table, schema.ts (connectorConfig)
    .env                    → LH_RAW_WORKSPACE_ID, LH_RAW_SQL_ENDPOINT_ID + CLI-written RAYFIN_PUBLIC_* (gitignored)
    .env.example            → committed placeholders
    .deployments.json       → link to the acme item (gitignored, written by the CLI)
  packages/frontend/        → React app; src/lib/rayfin-client.ts = the one ConnectorsRayfinClient (getRayfinClient()), src/lib/connectors.ts = connector wiring
  packages/data/            → app-owned entities (data service disabled for now)
  packages/shared/
  .agents/                  → template packs (needed by `npm run pack:add`); keep
  package.json              → root scripts: typecheck, build, lint, test
```

**Key rules:**
- Deploy needs `services.auth.enabled: true` and `services.auth.fabric.enabled: true`
- Connector entities are keyless (`Source({ schema: 'acme_pl', table })`), carry a `@role`, and are registered in `rayfin/connectors/lhraw/schema.ts` and `packages/frontend/src/lib/connectors.ts`; client-side types are not an authorization boundary
- Connectors work only in the deployed app: verify them after `rayfin up`, never with `rayfin dev`. To inspect data, use direct mode: `npx rayfin connector inspect --workspace-id … --item-id … --type fabric-sqlanalytics --entity acme_pl.<table>` (`--name` mode breaks with `${VAR}` ids)
- Gate before every deploy: `npm run typecheck && npm run build && npm run lint && npm test`, then `npx rayfin up --dry-run`. `build` ends with `npm run check:bundle` (parses every `dist` script with `node --check`, as `rayfin up` does); `up --dry-run` neither builds nor parses, so never hand `up` to the USER without a green `build`
- Decorated entity classes reach the frontend bundle via `packages/frontend/src/lib/connectors.ts`; the SWC decorator lowering in `packages/frontend/vite.config.ts` (`useAtYourOwnRisk_mutateSwcOptions`, `decoratorVersion: '2022-03'`) must stay — without it the deployed app is a blank page Partial redeploys: `npx rayfin up staticapp deploy` · `npx rayfin up connector apply --name lhraw`
- Nullable column = `{ optional: true }`; PK is always `id: string` (UUID); relative imports inside `rayfin/` use `.js` extensions
- One shared `RayfinClient` (`ConnectorsRayfinClient` when connectors exist)
- `--force` on `up` / `db apply` drops data — destructive, USER runs it
- Never commit `rayfin/.env` or `rayfin/.temp/`
- P&L calculation rules follow spec §7 exactly; no re-interpretation per flavor

### ▶ TRACK B — Power BI report (PBIP) · `pbi-report/`

**Stack:** Power BI Desktop (PBIP enabled) · TMDL semantic model · DAX · Power Query/M · deployment to Fabric workspace TBD (method open: single workspace vs deployment pipeline) · source: `lh_raw.acme_pl` in workspace RAW (ADR-0003; storage mode open)

**Structure:**
```
pbi-report/
  ACME Unified PnL.pbip
  ACME Unified PnL.SemanticModel/   → TMDL (Import from lh_raw SQL endpoint via PQ params SqlEndpoint / Database; measures in `_measures`)
  ACME Unified PnL.Report/          → PBIR: one page `pnl_one_pager`, view + side-bar bookmarks, theme + SVG icons
  tests/control-totals.dax          → DAX query view tests (T-01..T-17, T-06 vs control_totals_usd)
docs/model/                         → semantic-model.md, measure-dictionary.md
docs/ADD/features/pbi-report-layout.md → design brief, view map, first-open checklist
```
- Verify after every PBIR edit: `powerbi-report-author validate "pbi-report/ACME Unified PnL.pbip"`; a measure change is done only when every `_pass` in `tests/control-totals.dax` is TRUE.

**Key rules:**
- PBIP is the source of truth — every model/report change lands as a diff-reviewable PBIP commit; no binary `.pbix` in the repo
- Star schema discipline: fact and dimension tables explicitly classified; no snowflaking without an ADR; no bidirectional relationships without an ADR
- All measures live in dedicated measure tables/folders — no implicit measures, no measures scattered on fact tables
- Measure dictionary in `docs/model/` stays in lockstep with the model: name, plain-language definition, DAX, owner, spec ID
- DAX and SQL follow the house formatting style — applied silently and always
- Format strings never use trailing-comma scaling (`#,0.0,,` renders the commas literally in Power BI); display units are applied in DAX via `param_units[divisor]`, in visual-bound measures only
- Never edit PBIP files while Power BI Desktop has the report open (Desktop overwrites them on save): check `Get-Process PBIDesktop` first; if open, diagnose read-only and hand back a plan
- Children of a visual group store positions relative to the group, not the page
- Power Query: query folding preserved wherever possible; every folding-breaking step is commented with rationale
- RLS roles defined in the model (TMDL), documented in `docs/model/`, and tested with "View as" before every deploy (spec N-04)
- Incremental refresh policies and aggregations are ADR-worthy decisions — document parameters (`RangeStart`/`RangeEnd`) and partitions
- Naming: tables keep the spec §8 names (`fact_pl`, `dim_account`, …) · measures human-readable with folder paths · hide all raw FK/key columns from report view
- No calculated columns where a Power Query step or upstream view can do the job — push transforms upstream
- Report performance budget: spec N-01 (filter change < 2 s p95, row expand < 0.3 s); Performance Analyzer run before merging heavy pages

**Deployment:**
- Target workspace(s) TBD; deploy method TBD (Fabric deployment pipeline via fab-admin-mcp, or single workspace)
- Manual publishes to a user-facing workspace only with USER consent
- Post-deploy checks: refresh succeeds, RLS verified per role, key measure totals reconciled against `control_totals_usd.csv`

### ▶ TRACK C — Custom JS report · `js-report/`

**Stack:** Next.js (App Router) · TypeScript strict · pre-aggregated Parquet + DuckDB-wasm in the browser (no backend) · Vitest · Vercel (team `yaga`)

**Structure** (proposed; finalized in ADR-0002):
```
js-report/
  app/             → app shell (thin — orchestration only)
  lib/engine/      → P&L calc engine (spec §7: time windows, versions, FX, allocation, intercompany, bridge)
  lib/data/        → DuckDB-wasm loader + typed queries
  scripts/         → CSV → Parquet pre-aggregation build
  public/data/     → generated Parquet (build output)
```

**Key rules:**
- TypeScript strict mode everywhere; ESLint + Prettier with shared config
- No business logic in components — the engine is the single source of truth for every number
- Engine is framework-free and unit-tested against `control_totals_usd.csv` and spec §10 tests
- Translation, allocation and elimination happen at month × currency grain before aggregation; rounding only at display (spec §7, D-30)
- All URL/query-state inputs (F-37 shareable link) validated at the boundary before reaching the engine
- Keep the shipped Parquet small: pre-aggregate in `scripts/`, never ship raw fact CSVs to the browser
- Embeddable: no assumptions about the host page; the vosk.dev repo owns the wrapper
- Components: `PascalCase.tsx` · engine modules: `kebab-case.ts`

---

## Before you code

1. Read the relevant feature spec in `docs/ADD/features/` and the referenced sections of `docs/Requirements.md`
2. Check `docs/ADD/` for where the change fits
3. Check `docs/ADR/` for any ADRs that constrain your approach
4. If making an architectural choice, write a new ADR before implementing

### Core coding rules

#### 1. Think Before Coding
Don't assume. Don't hide confusion. Surface tradeoffs.

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

#### 2. Simplicity First
Minimum code that solves the problem. Nothing speculative.

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.
- Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

#### 3. Surgical Changes
Touch only what you must. Clean up only your own mess.

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: every changed line should trace directly to the user's request.

#### 4. Goal-Driven Execution
Define success criteria. Loop until verified.

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
