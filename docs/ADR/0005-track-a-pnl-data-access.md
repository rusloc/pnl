# ADR-0005 — Track A: how the Rayfin app gets the P&L numbers

- **Status:** superseded by ADR-0006 on 2026-10-21 — the USER chose option (c) (semantic-model connector, delegated auth, RLS in the model). Option (a) was prototyped (`pnl/data/pnl-aggregate.prototype.ts`, `pnl/model/fx.ts`) and never deployed.
- **Date:** 2026-10-21
- **Decider:** USER
- **Spec:** `docs/Requirements.md` §7 (C-01 … C-50), §8 (D-01 … D-35), N-01, N-04, §10 (T-01 … T-06, T-18) · data contract `data/acme_pl_dummy_data/README.md` · ADR-0003 (lh_raw.acme_pl) · ADR-0004 / design brief (one-window layout)
- **Related memory:** fin DEC-001 (lhraw connector), QRK-003 (DAB aggregation on connector entities)

## Context

Track A reads the shared Fabric data layer `lh_raw.acme_pl` (ADR-0003) through the read-only `lhraw` connector (`fabric-sqlanalytics`, `auth.type: application`, DEC-001). The dimensions are small and already flow into the app. The numbers do not: `fact_pl` has 457,896 rows and `fact_pl_allocated` 758,364, so the browser cannot page them through the keyless connector (DAB caps a page at 100,000 rows, and every filter change would re-pull megabytes).

Every zone of the app needs small result sets computed from those facts under spec §7: month-grain currency translation at two rate types (C-10 … C-13), the 19-step spine (§3), allocation when a slice filter is on (C-31, read from `fact_pl_allocated`), consolidation by counterparty (C-36), the bridge (C-40), and N-01 (filter change < 2 s p95).

Four options were evaluated against the installed SDK (`@microsoft/rayfin-*` 1.36.2), the package docs that ship with it, and the CLI.

## Options

### (a) Server-side aggregation through the existing `lhraw` connector

**Evidence.** `@microsoft/rayfin-connectors@1.36.2` `dist/category-a/ConnectorEntityClient.d.ts` declares `where()`, `groupBy()` and `aggregate()` on every Category A connector entity, and `ConnectorsSchema.d.ts` lists `"groupBy", "aggregate"` among the `read` operations. `@microsoft/rayfin-data/assets/docs/aggregations.md` documents the DAB `groupBy` query: `.where(filter).groupBy([...scalar fields]).aggregate({ alias: { sum: 'numericField' } }).execute()` → `{ fields, aggregations }[]`; `sum/avg/min/max/count` on numeric columns, `having`, `distinct`; filters support `eq, neq, in, isNull, and/or`. Constraints: no joins or expressions inside the aggregation, no paging of grouped results, and the aggregation runs through Data API Builder against the SQL analytics endpoint.

**Shape.** One round trip per version × window: `fact_pl` filtered by entity (or `counterparty_entity_code IS NULL` for the Group), version, window months and the selected slice codes, grouped by `account_code, month_key, currency_code`, `sum(amount_local)`. Result ≈ months × currencies × accounts, about 1,440 rows for YTD Sep on one entity; six such calls in parallel cover base, Compare A, Compare B, FY Budget, FY Latest estimate and prior year. `fact_fx_rate` (288 rows) is read once. The browser then translates per month × currency (C-11/C-12), sums per account, and evaluates the spine from `dim_report_line` — a framework-free TypeScript module (`fx.ts` is the first piece; unit-tested) that can be checked against `control_totals_usd` (T-06) in CI.

- Prototype in code: `fabric-app/packages/frontend/src/pnl/data/pnl-aggregate.prototype.ts` (filter builder unit-tested), `model/fx.ts` (translation, tested), probe button at `#probe` after a deploy.
- Cost: GraphQL API CU for request processing + SQL endpoint compute per query; no new item. Low.
- Latency: a grouped scan of ≤ 458k rows on the SQL endpoint is sub-second warm, a few seconds cold; six parallel calls per filter change, cacheable by key in the browser. N-01 is plausible but **unproven until the probe runs on the deployed app**.
- Security: `auth.type: application` — the app identity (item owner) reads lh_raw; app users need only app access. N-04 (row-level security by entity and region) is **not** enforced by this path; it would need `@role` policies keyed on claims (email → entity map) or a switch to `delegated` auth, both later decisions.
- Calc rules: §7 implemented once, in TypeScript, unit-tested against the control totals. Risk: a second implementation of the rules next to Track B's DAX — mitigated by T-06 on both.
- Unknowns to confirm on the deployed app: DAB's cap (if any) on grouped result rows; `in` filter with 12 month keys; `decimal(18,2)` sums arriving as numbers, not strings.

### (b) Rayfin functions querying the SQL endpoint with aggregating T-SQL

**Evidence.** `@microsoft/rayfin-guide` `functions/index.md`, `writing-functions.md`, `connections/add-fabric-resource.md`: `npx rayfin functions init` scaffolds `rayfin/functions/` (a Fabric User Data Functions project); `services.functions.enabled: true` with `auth.type: application`; a function declares `RayfinContext<AppSchema, AudienceType.Sql>` and queries the Lakehouse SQL endpoint with `mssql@^12.6.0` (`server` = endpoint connection string, `database` = item GUID, token from `ctx.Tokens.Sql`); the frontend calls `client.functions.<name>.invoke()`.

- Fit: arbitrary SQL — translation, spine and allocation in one query, smallest payloads, exact §7 in one place (SQL).
- Cost: a **new Fabric child item** (User Data Functions) created by `rayfin up`; function execution CUs; Azure Functions cold starts of seconds. Excluded for this run (no new items).
- Security: same app identity; adds a server boundary (good), but SQL text built from user selections (allow-listed codes only, never raw text).
- Effort: scaffold + driver + typegen + a second deploy surface; local loop via `rayfin dev functions apply`.

### (c) Semantic-model connector running DAX against the Track B model

**Evidence.** `cli/connectors/category-b-function-bridge.md`: `fabric-semanticmodel`, `executeQuery` (DAX) with `resultSetRowCountLimit`, **`auth.type: delegated` only**, works only when deployed.

- Fit: Track B's measures reused as-is — strongest guarantee of identical numbers across tracks.
- Blockers: the model is a local PBIP draft, not published; needs a workspace, a refresh, and every viewer needs read on the model (delegated). Timeline and ownership (bip/ginee) outside fin's lane. Keep as a later parity check, not the first path.

### (d) Pre-aggregated tables or views in `lh_raw` written by the Python pipeline

- Fit: a `fact_pl_usd` (amounts pre-translated at both rate types) or a month × account × slice summary would let (a) group in reporting currency directly and drop the browser-side translation.
- Cost: ginee's lane, a USER yes, a pipeline change and a reload; T-SQL views on the SQL endpoint are endpoint objects, not Delta tables, so they need their own deployment path.
- Verdict: an **optimisation on top of (a)** if the probe shows N-01 at risk, not a first step.

## Decision (proposed)

**Option (a).** Keep the single `lhraw` connector; read the facts only through `where → groupBy → aggregate`; translate, sum and evaluate the spine in a tested TypeScript engine in the app. Register `FactPl` and `FactFxRate` as read-only `@role('authenticated', ['read'])` connector entities (done, pending deploy). Add `FactPlAllocated` and `FactOperational` the same way in the next run (C-31 allocated lines, C-40 units, K-09 … K-12).

Upgrade path if the probe disappoints: (d) for pre-translated amounts, then (b) if the browser engine cannot hold N-01. (c) stays a parity check once Track B is published.

## Consequences

- No new Fabric items; one deploy surface; the §7 rules live in `packages/frontend/src/pnl/model/` with unit tests, and T-06 can run in CI against `control_totals_usd` (readable through the same connector).
- Every app user with app access can read the facts in aggregate (and, through the raw GraphQL endpoint, by page). Acceptable for dummy data on a showcase; N-04 is an open requirement.
- The first `rayfin up` after this ADR exposes `fact_pl` and `fact_fx_rate` through DAB; verify with `#probe` → "Run aggregate prototype" (expected ≈ 1,440 rows, a few hundred ms warm).

## Open questions for the USER

1. Approve (a) as the P&L numbers path?
2. Keep `auth.type: application` (viewers need app access only; N-04 unenforced) or move to `delegated` (viewers need lh_raw read; RLS possible later)?
3. Is a second implementation of §7 (TypeScript next to Track B's DAX) acceptable, with T-06 as the shared gauntlet?
