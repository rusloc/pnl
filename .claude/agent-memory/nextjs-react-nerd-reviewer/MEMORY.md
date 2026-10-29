# Nerd — Memory Index

## Hot findings (last 30 days)
- 2026-10-29 · js-exec period model (ADR-0013 (k)): lib/engine/items.ts (127 items, windows, LY / prev like-length, bars); computeMetrics(d, scope, Window); 204 tests, 68 control keys reconciled; CAND-016
- 2026-10-29 · PG-005: harness heredoc quoting + Windows Python CRLF → write scripts to scratchpad, prettier --write touched files
- 2026-10-29 · js-exec USER feedback: one LayerFrame scrim for all layers, ⓘ target line (dim_kpi.basis), Statement + Notes removed; 117 tests; CAND-014/015
- 2026-10-28 · Nordmark exec JS flavour built in js-exec/ (ADR-0013 (h)): 86 tests, ET-01 = all 9,328 control rows both ways, 452 kB data, 32/32 headless; CAND-012/013
- 2026-10-28 · Standalone packs (USER option a): .sync/pnl/js-app (P&L, chat out) + .sync/mirelo-sales/js-app (/sales kept, / → 307); js-report stays source of truth; CAND-011
- 2026-10-27 · Parity B vs C fixes done (0 Track C expected-fail); harness js-report/lib/test-utils/parity/; ⓘ copy export `npm run export:info-copy`
- 2026-10-27 · CAND-010: band the displayed Δ, not the raw one; CAND-009: "; " between formulas, " - " in prose
- 2026-10-27 · Mirelo /sales draft built (ADR-0011 (c)); README js-report/app/sales/README.md, .sync note 2026-10-26-mirelo-sales-track-c-draft.md
- 2026-10-27 · PG-004: stopped `next start` keeps the port on Windows (stale server = fake test failures); kill by port
- 2026-10-27 · CAND-004: modal content swap drops focus to body; refocus close button on content change
- 2026-10-23 · Track C chat layer: lib/chat (tools, runner, prompt, limits) + .sync contract; prefix budget test (≈887/1,200 tok)
- 2026-10-23 · CAND-003: substitute names after operator rewrites (formula "/" bug)
- 2026-10-23 · CONV-001: Track C copy (summaries, notices, titles) lives in lib/engine, tested against Track B measure text
- 2026-10-23 · CAND-001: Track B matrix is 2-level; Track C "collapsed" must keep OPEX open to show all 29 lines
- 2026-10-23 · PG-003: CSS-module class lookups are string | undefined (noUncheckedIndexedAccess); make className props optional
- 2026-10-22 · PG-001: Windows Smart App Control blocks swc / rolldown native binaries; first vitest run can fail, retry passes
- 2026-10-22 · PG-002: Zod 4 union of number literals breaks kind-driven CSV coercion; use bounded z.number()

## Topic files
- platform-gotchas.md — 5 entries · stalest 2026-10-22 · PG-NNN
- conventions.md       — 1 entry   · stalest 2026-10-27 · CONV-NNN
- candidates.md        — 15 awaiting second hit (CAND-013 promoted to PG-005)

## Track C facts (verify before citing)
- 2026-10-22: Track C finalisation moved to the vosk.dev repo agent; hand-off in `.sync/2026-10-22-track-c-handoff.md` (steps 0–3 built here).
- Engine reproduces control_totals_usd.csv to ≤ 0.005 USD by translating per row (cents × factor); GROUP = P + S rows with counterparty empty.
- `npm test` reads public/data (build output, gitignored): run `npm run build:data` first.
- 2026-10-23: page top = Track B (period-picker-v2.md Part 2); engine.period() / engine.header() own all header + picker copy; .sync note 2026-10-23.
- Selection serialize bug class: entity-dependent defaults must not swallow the entity key itself (caught by round-trip test).
- 2026-10-23: parity fixes per docs/design/parity-rules.md; .sync note 2026-10-23-track-c-parity-fixes.md. Retired URL keys lay/lens/d parse as unknown (ignored); notices = Track B `_Notice Row` codes N_*; Track B text source: pbi-report/ACME Unified PnL/…SemanticModel/definition/tables/_measures.tmdl.

- 2026-10-23: chat (ADR-0009 §4) in js-report/lib/chat; contract .sync/2026-10-23-track-c-chat-contract.md + machine copy .sync/track-c/chat-tools.json (`npm run export:chat-tools`, stale file fails a test). Backend = small CPU model (archi note): keep schemas terse, codes checked in code not as enums, results ≤ 1,600 chars.
- Chat tool args = patch over current Selection, strict reject (not codec fallback), then codec round trip; unbuilt = restrictToBuilt() diff.

## P&L redesign facts (verify before citing)
- Engine: slices.ts rebuilds C-31 allocation at runtime (line × NR(slice) ÷ NR(region) per entity×version×month×region) from pl-*.parquet; no allocated file shipped. ops.parquet now loaded by dataset.ts.
- view-context.ts = plans (Compare A/B, bridge cmp = A else B else PY, Budget, PY) + tr / trAct / trCC; Profitability always CC; status chips vs Budget only (thresholds.ts).
- Glass pop-ups shared: components/glass.tsx (PopupProvider scope prop); /sales wraps it in components/sales/popup.tsx.

## Mirelo /sales facts (verify before citing)
- Engine lib/sales (framework-free), build scripts/build-sales-data.ts reads data/mirelo_sales_dummy_data/parquet → public/data/sales (197 kB first paint, 915 kB total). `npm run build:sales-data` before `npm test`.
- Distinct-client returning % and MEDIANX are per-window precomputed in the build (window-stats.parquet: tv × anchor × market × segment); everything else is additive monthly cubes translated per month × market in cube.ts.
- Detail sample is exact for its caps (top-N per month × market / agent × month / overdue per market / cohort clients + full client histories); tested against raw fact_loan.
- 2026-10-27 ADR-0012 applied: card face title · value · Δ rows · status chip; sub-lines → ⓘ values (copy.ts info(id, values)); How to read per view.
- 2026-10-27 USER review: no period banner (text → period tooltip + How-to-read), no card corner markers, no in-card sparklines (design-requirements §1 "Visual first, minimum text" applies to Mirelo too, overriding design-tokens card anatomy).
- Control totals (control_totals_eur.csv) reconcile for ALL/PL/RO/PT × Sep 2026, FY2024, FY2025, FY2026 YTD + every closed month.

## Nordmark exec facts (verify before citing)
- js-exec/: engine in lib/engine (brief + CLAUDE.md, not ADR-0013's lib/exec); cube week × site group (NL, BE, ONLINE, WHOLESALE, DC, CENTRAL) × category; metrics.ts mirrors data/nordmark_retail_dummy_data/checks/verify.py metrics().
- Status: badness rounded to 10 dp; ≤ watch_from good, ≤ off_from watch (edge = Watch: data README beats the E-23 sentence); dot over rated cards, N/A excluded.
- Copy source = lib/engine/copy.ts + view.ts (examples / stats from data); export to docs/ADD/features/exec-info-popovers.md not done (sync point 1 open).
- 2026-10-29/30 period model: Selection.item (null = as-of week), URL `i`; Channel mix = window shares + window plan at P/Q/FY; FY2025 statuses per card; EBITDA at W vs Previous = previous month first k weeks (items.ts prevMonthToDate, CSV P-…@k keys); UI says "Month" never "Period n"; no owner-note row; fixed copy period-neutral.
- Headless checks: Python Playwright (`py -3.12`) works on this box; scripts stay in the session scratchpad.

## Open questions
- 2026-10-27: Mirelo: Budget for interest vs fees (set per product only); leaderboard Approval % / Pace (no agent funnel); loan states are a Sep 2026 snapshot for every anchor — deferred to USER.
- (resolved 2026-10-22) ADR-0002 Q3: USER accepted allocation in the engine; Q5 all deferred.
