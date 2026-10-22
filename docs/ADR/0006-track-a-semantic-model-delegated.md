# ADR-0006 — Track A reads the P&L through a semantic model (`fabric-semanticmodel`, delegated auth, RLS in the model)

- **Status:** accepted, phase 1 only (one filter, no RLS); decided by the main agent under USER delegation, 2026-10-21. Phase 1 = `fabric-semanticmodel` connector `pnlModel` (delegated), Track B model reused in RAW, the P&L statement live and driven by the Month filter; RLS roles, demo users, Build grants and the remaining zones/filters are later phases. Supersedes ADR-0005 (see §12; status edit applied 2026-10-22). Amended 2026-10-22 (§16): Q1 / Q2b fetch level columns only, variances derived client-side with parity tests; connector failure shows an error panel, never sample numbers.
- **Date:** 2026-10-21
- **Decider:** USER
- **Spec:** `docs/Requirements.md` §5 (K-01 … K-23), §6 (F-01 … F-37, esp. F-30 … F-36), §7 (C-01 … C-50), §8 (D-21, D-30 … D-33), N-01, N-04, §10 (T-01 … T-06, T-14, T-15, T-18) · ADR-0003 (lh_raw.acme_pl) · ADR-0004 (one-window layout) · ADR-0005 (superseded)
- **Ground truth checked:** `@microsoft/rayfin-cli` / `-connectors` / `-connector-fabric-semanticmodel` / `-tools-common` / `-guide` **1.36.2** (installed in `fabric-app/`), `npx rayfin connector types --json`, `npx rayfin connector add|invoke --help`, Microsoft Learn (Fabric Apps connectors, Power BI `executeQueries`, RLS, workspace roles). Memory: fin DEC-001, DEC-002, LSN-002, LSN-003, QRK-001.

## 1. Context

Track A's four views (statement, key figures, analysis, profitability) run on **sample figures** fixed at "YTD Sep 2026 · Actual vs Budget and Prior year · USD m". Every filter therefore changes labels, not numbers, which breaks **F-34** ("every filter applies to every zone"); the stopgap (LSN-002: honest sample mode, controls switched off with a reason) is live in code but is not a data path.

ADR-0005 proposed to compute the P&L in the browser from DAB aggregations over the `lhraw` connector (option (a)). That path has three structural costs: a **second implementation of §7** (TypeScript next to Track B's DAX), **no N-04** (row-level security by entity and region) because the connector runs as the app identity, and no natural seat for the **AI chat** the USER wants later (LSN-003: a Fabric data agent or LLM tools need a governed model and a per-user identity).

The USER decided on 2026-10-21: Track A reads a **semantic model** through the `fabric-semanticmodel` connector with **delegated** auth, so the model's RLS applies to each signed-in user; ginee builds and publishes the model on top of `lh_raw`; fin re-links the app; the AI chat comes later on the same path. This is ADR-0005's option (c).

## 2. Decision (proposed)

1. **Data path.** One `fabric-semanticmodel` connector (`pnlModel`) with `auth.type: delegated` and the single operation `executeQuery` (DAX). Every number in the app comes from a model measure; the §7 rules live **once, in DAX**. TypeScript does presentation only (units, signs, variance format, formatting, sort, layout).
2. **Security.** N-04 is enforced by **RLS roles in the model** and nothing else. The app's filter allow-list and view gating are UX. Users reach the model under their own identity (on-behalf-of), so Build-permission holders can query anything the roles let them see, and nothing more.
3. **Model.** Reuse the Track B model `pbi-report/ACME Unified PnL.SemanticModel` as the **single governed model** for Tracks A and B (§4). Published to workspace **RAW** (dev) for now (§5).
4. **Fallback.** The sample figures stay as the **offline fallback** (`rayfin dev`, tests, connector failure), always flagged `sample: true` with the LSN-002 gating.
5. **Migration.** `lhraw` stays during the migration (reference dims), then goes (§10).

## 3. Verification against the installed SDK 1.36.2

[V] = verified in installed code, bundled docs or CLI output (path given). [I] = inferred; not exercised here.

| # | Item | Finding | Mark | Evidence |
|---|---|---|---|---|
| 3.1 | `rayfin.yml` connector block | Top-level `connectors:` **array**; entry = `name`, `type: fabric-semanticmodel`, **`version: '1'`** (required for function-bridge types), `config.workspaceId` / `config.itemId`, `auth.type: delegated`, `operations: [{ name: executeQuery }]`. Omitted `auth` is a validation error. | [V] | `rayfin-tools-common/dist/config/types.d.ts` (`ConnectorEntry`, `ConnectorAuthType`), `config/connectors.js` (`CONNECTOR_CATALOG['fabric-semanticmodel']`: `defaultAuth: Delegated`, `allowedAuthTypes: [Delegated]`, `requiresVersion: true`, `defaultVersion: '1'`); `rayfin-guide/assets/docs/cli/connectors/category-b-function-bridge.md` §"Resulting rayfin.yml" |
| 3.2 | `application` auth for a semantic model | **Rejected.** Category B is delegated-only; `rayfin up` refuses `auth.type: application`. | [V] | same catalog entry; category-b doc §Troubleshooting |
| 3.3 | `connector add` behaviour | `npx rayfin connector add --type fabric-semanticmodel --workspace-id <ws> --item-id <model> --name pnlModel` verifies the item, writes the YAML entry (literal IDs; `${VAR}` placeholders are rejected at add time), scaffolds `rayfin/connectors/pnlModel/schema.ts` with a `// @generated — do not edit.` banner, runs **no schema discovery** (no `metadata.json`, no entities, no `@role`), **installs nothing** and prints the pinned install line. Because `packages/frontend/src/lib/connectors.ts` is app-owned (marker removed), the CLI prints wiring instructions instead of rewriting it. | [V] | `rayfin-cli/dist/commands/connector/connector-add.js` (`buildFunctionBridgeScaffold`, `meta.requiresVersion` branch, `regenerateConnectorWiring`), `cli/connectors/add.md`, `--help` |
| 3.4 | Generated `schema.ts` | `export type PnlModelSchema = FabricSemanticModel<'executeQuery'>; export const connectorConfig = { connector: 'fabric-semanticmodel' } as const satisfies ConnectorConfig;` — no IDs in the bundle; the backend injects `workspaceId`/`itemId` from `rayfin.yml` server-side. | [V] | `connector-add.js` lines 57–110; `rayfin-connector-fabric-semanticmodel/assets/docs/index.md` §"Wiring the client" |
| 3.5 | Client registration | `AppConnectorsSchema = { lhraw: LhrawSchema; pnlModel: PnlModelSchema }`; `connectorConfigs.pnlModel = connectorConfig`; **`connectorRuntimes.pnlModel = fabricSemanticModel()`** is mandatory (without it the Arrow response is never decoded and `executeQuery` returns raw bytes). The current `rayfin-client.ts` already passes `connectorRuntimes` as the second constructor argument. | [V] | `connectors.ts`, `rayfin-client.ts`; catalog `runtimeFactory`; package doc §"Registering the runtime" |
| 3.6 | Packages to install | `@microsoft/rayfin-connector-fabric-semanticmodel@1.36.2` (marker + runtime; already present at `node_modules/@microsoft/` through the connectors pack, but not declared by `packages/frontend/package.json`) and `@microsoft/rayfin-connectors@1.36.2` (installed). Install pinned, into the frontend workspace. | [V] | `npx rayfin connector types --json` → `packages[]`; `npm ls` |
| 3.7 | Client API | `client.connectors.pnlModel.executeQuery({ query: string; resultSetRowCountLimit?: number })` → `SemanticModelQueryResult` = `{ status: 'success', table: { columns: {name, dataType}[], rows: unknown[][] }, requestId } \| { status: 'error', error: { category: 'api'\|'query'\|'network'\|'overflow'\|'unknown', message, code?, details?, recoveryHint? }, requestId }`. Already normalised; **no parameters / bind variables** — the DAX string is the whole input. Column names come back fully qualified (`dim_pl_row[row_key]`) or bracketed for aliases (`[@base]`). | [V] | `dist/types.d.ts` (`ExecuteQueryInput`), `dist/queryResult.d.ts`, `dist/marker.d.ts` |
| 3.8 | `resultSetRowCountLimit` | Per-call field on the request body, enforced by Analysis Services; **no default** (unbounded without it); exceeding it fails the call with `category: 'overflow'` (never a silent partial). Non-positive-integer values are dropped by the runtime middleware (not a security boundary). Runtime-wide default via `fabricSemanticModel({ resultSetRowCountLimit })`. Forwarded verbatim on the delegated path. | [V] | package doc §"Limiting rows"; `dist/runtime.js` (`withValidatedRowLimit`) |
| 3.9 | Other query options (`culture`, `schemaOnly`, `queryTimeout`) | Exist only on the **CLI direct path** (`DaxQueryOptions`); the delegated path sends only `query` + `resultSetRowCountLimit`. No app-side query timeout control. | [V] | `dist/directExecute.d.ts`, `dist/runtime.js` |
| 3.10 | Transport in the deployed app | Browser host = `'standalone'` → POST `<RAYFIN_API_URL>/connector-invoke/pnlModel` on the BaaS → platform-owned User Data Function → Power BI DAX endpoint, **on-behalf-of the signed-in user** ("BaaS → FuncSet → delegated OBO"). | [V] | `rayfin-connectors/dist/Connectors.js` (`detectHost`), `category-b/SemanticConnectorClient.js` (`standaloneTransport`), `connector-invoke.js` lines 440–460 and 590–620 |
| 3.11 | Underlying API | Public Power BI REST **`executeQueries`** (`/v1.0/myorg/groups/{ws}/datasets/{id}/executeQueries`), Arrow-encoded on the wire. Not XMLA. | [V] for the CLI path (`directExecute.d.ts`, `endpoints.d.ts` `DEFAULT_POWER_BI_BASE_URL`), [I] for the UDF path (types say the envelope "mirrors the Power BI `DatasetExecuteQueriesResponse` shape", `queryError` "More than one result table in a query") |
| 3.12 | Permission a viewer needs on the model | Power BI `executeQueries`: "The user must have dataset **read and build** permissions"; scope `Dataset.Read.All`. Workspace **Viewer** gives Read only; **Build** is granted separately (share dialog "Allow recipients to build content" / Manage permissions › Build). The CLI comment agrees: the direct path is "gating on the model's Build permission". | [V] | learn.microsoft.com `rest/api/power-bi/datasets/execute-queries` §Permissions; `collaborate-share/service-roles-new-workspaces` (Viewer + Build note); `connector-invoke.js` line 570; `directExecute.d.ts` header |
| 3.13 | Tenant setting | "**Dataset Execute Queries REST API**" (Integration settings) must be enabled. | [V] | same REST doc §Permissions |
| 3.14 | RLS applies to delegated `executeQuery` | The call runs **as the user** (OBO), so RLS evaluates the user's role membership; `USERPRINCIPALNAME()` returns the user's UPN. RLS "only restricts data access for users with **Viewer** permissions. It doesn't apply to workspace **Admin, Member, or Contributor**" — so the USER (Admin of RAW) will never see RLS in effect; demo accounts must be Viewers or item-shared only. Users in **no** role see **no** rows (default-deny). Roles are **additive** (union across roles). Service principals cannot be in RLS roles (irrelevant here: delegated, not application). | [V] for Power BI RLS semantics (learn `fabric/security/service-admin-row-level-security`); [V] that the connector is OBO per user (category-b doc: "Delegated authentication runs every call as the signed-in user through the on-behalf-of flow"); [I] end-to-end (not executed yet: proven only when a demo Viewer sees filtered rows in the deployed app) |
| 3.15 | Limits | Power BI `executeQueries`: **1 query / call, 1 result table / query, ≤ 100,000 rows or ≤ 1,000,000 values (first hit), ≤ 15 MB, 120 requests / minute / user**; DAX only (no INFO/DMV). Connector adds nothing on top except the optional row cap. | [V] | REST doc §Limitations; package doc |
| 3.16 | Timeouts | Not documented for the delegated path (no `queryTimeout` on the wire; UDF/BaaS timeouts unknown). | [I] | §3.9 |
| 3.17 | Throttling symptom | Comes back as `status: 'error', category: 'api'` (not a throw); the fabric-sdk skill says retry only transient `network`; treat `api` as permanent until something changes. | [V] | `.agents/skills/fabric-sdk/SKILL.md` §Error categories; `queryResult.d.ts` |
| 3.18 | Fixed-decimal gotcha | Fixed Decimal (currency) measures can arrive as scaled integers through this connector: "a total of 2,613,203.85 renders as 26,132,038,531"; wrap every amount in `CONVERT ( [Measure], DOUBLE )`. Track B's amounts **are** Fixed Decimal (`docs/model/semantic-model.md`). | [V] that the installed skill mandates it ("This has now shipped twice"); [I] for this model until the first probe | `.agents/skills/dax-authoring/SKILL.md` §Must |
| 3.19 | Local dev | `rayfin dev` parses the `connectors:` block but **does not wire** Category B calls; a real `executeQuery` needs `rayfin up`. The CLI loop `npx rayfin connector invoke pnlModel executeQuery --file <payload.json>` works **before deploy**, directly against Power BI **under the developer's identity** (needs Build; prompts once for Power BI consent — `rayfin login` only consents the Fabric scope), with the row cap in the JSON payload. A passing CLI probe does **not** prove the deployed OBO path; `--transport deployed` needs an app-session token the CLI cannot mint. | [V] | category-b doc §Verify; `cli/connectors/invoke.md` §Transports, §Token handling; `.agents/skills/rayfin-connectors/SKILL.md` step 5 |
| 3.20 | `connector invoke` with `${VAR}` IDs | The direct path reads `connector.config.workspaceId/itemId` from the parsed YAML; QRK-001 (`inspect --name` ignores `${VAR}`) suggests interpolation may not happen here either. Plan: probe with literal IDs first, switch to `${PNL_MODEL_*}` before commit, re-probe; record the outcome. | [I] | `connector-invoke.js` lines 456–470; fin QRK-001 |
| 3.21 | CORS / CSP | The app already calls the same API host for `lhraw` GraphQL (`RAYFIN_PUBLIC_API_URL` → `*.pbidedicated.windows.net`) from `*.webapp.fabricapps.net`; `connector-invoke/<name>` lives on that host, so no new origin. The frontend sets no CSP meta of its own (`packages/frontend/index.html`). Nothing to configure in the app. | [V] for hosts and absence of CSP; [I] that the platform's CORS allow-list covers the invoke route identically (it is the documented browser route) |
| 3.22 | `lhraw` coexistence | `connectors:` is an array; the official example declares a Category A and a semantic-model connector side by side; `AppConnectorsSchema`, `connectorConfigs` and `connectorRuntimes` are keyed maps. Mixed auth (`lhraw: application`, `pnlModel: delegated`) is allowed per entry. | [V] | learn `fabric/apps/connectors` YAML example; `rayfin-tools-common` `ConnectorEntry[]`; `connectors.ts` |
| 3.23 | Platform enablement | `FEATURE_NOT_ENABLED` / 404 on `/connector-invoke/<name>` means ConnectorFunction invocation is **disabled for the workspace** — server-side, not fixable in the app. Unknown for RAW until the first deployed call. | [V] that the error exists; [I] RAW's state | `.agents/skills/rayfin-connectors/SKILL.md` §Troubleshooting |
| 3.24 | Hidden measures | `isHidden` is a field-list hint, not security; the app can query `9 Engine` measures (`_PL Base`, `_Bridge Value`, …). Only RLS (rows) and OLS (objects) restrict. | [V] for Tabular semantics (RLS doc FAQ: columns/measures are not hidden by RLS; OLS is separate) |
| 3.25 | `useSemanticModelQuery` hook | Comes with `npm run pack:add -- analytics` (`.agents/skills/analytics/kit/hooks/`); **not installed**. It does not forward `resultSetRowCountLimit` and reports failures on two channels (`error` thrown vs `data.status === 'error'`). The app's `PnlDataSource` seam makes it unnecessary; call the client directly. | [V] | `fabric-app/package.json` `rayfinPacks: ["connectors"]`, `.agents/skills/analytics/pack.json`, `.agents/skills/fabric-sdk/SKILL.md` |

## 4. Model choice: reuse Track B (recommended)

| Option | Pros | Cons |
|---|---|---|
| **Reuse `ACME Unified PnL.SemanticModel`** (recommended) | One governed model, one DAX implementation of §7, Track B's `tests/control-totals.dax` (T-01 … T-07, T-10, T-17) already reconcile 552 control rows to 0.01 USD; `_measures` already exposes the engine the app needs (`_PL Base`, `_PL Compare A/B`, `Base Amount`, `Bridge Comparison Amount`, `_Bridge Value`, KPI items, `Notices`, `Context Line`, `Data Status`); the disconnected parameter tables (D-21) are exactly the surface a DAX query filters; identical numbers across tracks by construction. | The report's `Design` folder (47 helper measures) and Ledger-specific tables ride along (harmless); the app depends on measure names (freeze them in `docs/model/measure-dictionary.md` as an "app contract"); RLS roles must be added to the shared model (they would be needed for Track B anyway, N-04). |
| New app-only model | Could be trimmed to app needs. | Second copy of the §7 engine to keep in sync; duplicate tests; no gain. |
| Direct Lake variant of the same model | No refresh. | Storage mode is ginee's open decision (ADR-0003); RLS works in both; not a blocker either way. |

**Decision:** reuse. Storage mode stays ginee's call; Import (current draft) needs a scheduled refresh and credentials for the `lh_raw` SQL endpoint connection; Direct Lake needs none. Nothing in this ADR depends on it.

## 5. Workspace

Publish to **RAW** (`7f065ce8-ffe8-4670-88eb-ed81a3c9c1bd`) next to `lh_raw` and the `acme` app for now (dev capacity F64). Consequences: demo users with a **workspace Viewer role** see every item in RAW, including the leftovers CLAUDE.md says to ignore; prefer **item-level sharing** (the `acme` app + the model with Build) over a workspace role for demo accounts, unless the USER accepts the exposure. Publishing workspace/capacity stays TBD (CLAUDE.md); moving the model later means a new item id → one `.env` change and `connector apply`.

## 6. RLS role design (N-04)

Facts (`fact_pl`, `fact_pl_allocated`, `fact_operational`) hang off `dim_entity` and `dim_region` through active many-to-one relationships, so a filter on either dimension secures all three facts. `fact_fx_rate` is disconnected and not sensitive. `control_totals_usd` carries `entity_code` and is reachable by any Build user → filter it too (or drop it from the published model; the DAX tests run in Desktop).

**Phase 1 — static roles (demo):**

| Role | `tablePermission` filters | Who |
|---|---|---|
| `Entity · Consumer Products` | `dim_entity[entity_code] = "P"` · `control_totals_usd[entity_code] = "P"` | entity manager demo |
| `Entity · Commerce Cloud` | `dim_entity[entity_code] = "S"` · `control_totals_usd[entity_code] = "S"` | entity manager demo |
| `Group Finance` | no filters (model read) | group demo, CFO view |

TMDL outline for bip (pbip-editor lane; verify syntax against the installed TMDL grammar):

```tmdl
role 'Entity · Consumer Products'
	modelPermission: read

	tablePermission dim_entity = dim_entity[entity_code] = "P"
	tablePermission control_totals_usd = control_totals_usd[entity_code] = "P"
```

Rules that follow from the RLS semantics (§3.14):

- Roles are **additive** (union). An "entity × region" scope must be **one role** carrying both filters, or dynamic RLS; never two roles. Region roles are therefore **not** stacked on entity roles in phase 1.
- A user in **no role** gets empty results, not an error. The app must render that state honestly ("You have no P&L access") rather than spin.
- The Group view (C-36) needs rows of **both** entities plus the counterparty rows; for an entity-only user `_Amt Entity` returns the visible entity only and `_Elim Amount` only that entity's side. The app therefore **hides** the Group option (F-01) unless the user sees two entities (§8, query Q0). bip should make `_Sel Entity`'s default ignore an unselectable `GROUP`.
- The USER (workspace Admin) bypasses RLS; every RLS check runs as a **demo Viewer** in the deployed app (two identities, CLAUDE.md testing policy).

**Phase 2 — dynamic RLS (when "and region" is needed, N-04):** a `sec_user_scope(upn, entity_code, region_code)` table in `lh_raw.acme_pl` (ginee), one role `Scoped` with
`dim_entity[entity_code] IN CALCULATETABLE ( VALUES ( sec_user_scope[entity_code] ), sec_user_scope[upn] = USERPRINCIPALNAME () )` and the mirror filter on `dim_region`, giving intersection semantics in one role. Member accounts, not B2B guests (UPN format caveats in the RLS doc).

## 7. Demo users

Three Entra **member** accounts in the tenant (names are placeholders for the USER): `demo-products` → `Entity · Consumer Products`; `demo-cloud` → `Entity · Commerce Cloud`; `demo-group` → `Group Finance`. Each needs: access to the `acme` Fabric App item; **Read + Build** on the model (share with "Allow recipients to build content"); **never** Contributor/Member/Admin on RAW (RLS bypass). Licensing: RAW is F64, so Viewer-level consumption needs no Pro license [V, workspace-roles doc]. Optional fourth account in no role to prove default-deny.

## 8. Query design

One DAX query per zone, one `EVALUATE`, every query built by a **pure, unit-tested builder** `buildPnlQueries(filter: FilterState, ref: ReferenceData)` from allow-listed codes only. `FilterState` holds enums and codes (no free text); each value is mapped through a fixed table or checked for membership in the reference data before it becomes a DAX literal; integers are range-checked; a value that fails the allow-list throws before any query is sent. **No user text is ever concatenated into DAX.**

### 8.1 Filter mapping (F-01 … F-21 → model parameter tables)

Common `DEFINE` block, emitted from `FilterState`:

```dax
DEFINE
    VAR _entity   = TREATAS ( { "P" }, param_entity_view[entity_view_code] )        // F-01: P | S | GROUP
    VAR _fy       = TREATAS ( { 2026 }, param_fiscal_year[fiscal_year] )            // F-02 (integer, in dim_month range)
    VAR _month    = TREATAS ( { 9 }, param_period[month_number] )                   // F-03 (1..12)
    VAR _tv       = TREATAS ( { "YTD" }, param_time_view[time_view_code] )          // F-04: MTD | QTD | YTD | LTM | FY
    VAR _base     = TREATAS ( { "A" }, param_base_version[choice_code] )            // F-05: A | LE | B
    VAR _cmp_a    = TREATAS ( { "B" }, param_compare_a[choice_code] )               // F-06: B | LE | PY | NONE
    VAR _cmp_b    = TREATAS ( { "PY" }, param_compare_b[choice_code] )              // F-07: B | LE | PY | NONE
    VAR _ccy      = TREATAS ( { "USD" }, param_reporting_currency[currency_code] )  // F-12
    VAR _fx       = TREATAS ( { "ACT" }, param_fx_basis[fx_basis_code] )            // F-13: ACT | CC
    VAR _regions  = TREATAS ( { "NA", "CE" }, dim_region[region_code] )             // F-08; omitted when All
    VAR _channels = TREATAS ( { "GRO", "D2C" }, dim_channel[channel_code] )         // F-09; omitted when All or GROUP
    VAR _lines    = TREATAS ( { ... }, dim_line[line_code] )                        // F-10; idem
    VAR _segments = TREATAS ( { ... }, dim_segment[segment_code] )                  // F-11; idem
```

| Filter | DAX | Notes |
|---|---|---|
| F-01 entity | `param_entity_view[entity_view_code]` | Group offered only when Q0 returns 2 entities |
| F-02 … F-04 period | `param_fiscal_year`, `param_period`, `param_time_view` | `_Win Start/_Win End` and C-01 cut-off are model logic |
| F-05 … F-07 versions | `param_base_version`, `param_compare_a`, `param_compare_b` | C-02 … C-05 are model logic (`_Amt Window`) |
| F-08 region | `dim_region[region_code]` | multi; `null` = no filter arg (F-33 guarantees non-empty) |
| F-09 … F-11 slices | `dim_channel` / `dim_line` / `dim_segment` codes | per-entity memory (F-30) stays in `FilterState`; omitted for GROUP (F-32); the model's `_Amt Entity` already ignores stale other-entity selections |
| F-12, F-13 | `param_reporting_currency`, `param_fx_basis` | C-10 … C-13 in the model |
| F-14 units, F-15 cost sign, F-16 variance format, F-17 toggles, F-18 … F-20 toolbar | **TypeScript** on unscaled results | no re-query; `param_units` is not sent (unscaled engine measures are queried instead) |
| F-21 breakdown | allow-list `{ region: dim_region[region_name], channel: dim_channel[channel_name], line: dim_line[line_name], segment: dim_segment[segment_name], entity: dim_entity[short_name] }` | identifier chosen by key, never built from text |
| F-36 context line, C-50 notices | model measures `Context Line`, `Notices`, `Slice Panel Note`, `Data Status` | no second implementation of the notice rules |

Column keys in results are `dim_pl_row[row_key]`-style for columns and `[@base]`-style for aliases; a small helper maps `table.columns` to indices once per result.

### 8.2 Query shapes (all amounts wrapped in `CONVERT ( …, DOUBLE )`, §3.18)

**Q0 — visible entities (RLS probe, once per session):**

```dax
EVALUATE
VALUES ( dim_entity[entity_code] )
```

**Q1 — statement (§4, M-01 … M-22), unscaled, one row per `dim_pl_row`:**

```dax
EVALUATE
SUMMARIZECOLUMNS (
    dim_pl_row[row_key]
    ,dim_pl_row[line_code]
    ,dim_pl_row[line_label]
    ,dim_pl_row[row_type]
    ,dim_pl_row[is_key]
    ,dim_pl_row[tag]
    ,dim_pl_row[account_code]
    ,dim_pl_row[account_label]
    ,dim_pl_row[is_leaf]
    ,dim_pl_row[line_sort]
    ,dim_pl_row[account_sort]
    ,_entity, _fy, _month, _tv, _base, _cmp_a, _cmp_b, _ccy, _fx, _regions, _channels, _lines, _segments
    ,"@base",   CONVERT ( [_PL Base], DOUBLE )
    ,"@cmp_a",  CONVERT ( [_PL Compare A], DOUBLE )
    ,"@cmp_b",  CONVERT ( [_PL Compare B], DOUBLE )
    ,"@fy_bud", CONVERT ( [_PL FY Budget], DOUBLE )   // bip: unscaled twin of `PL FY Budget` (see §13 bip)
    ,"@fy_le",  CONVERT ( [_PL FY LE], DOUBLE )       // bip: unscaled twin of `PL FY LE`
)
ORDER BY dim_pl_row[line_sort], dim_pl_row[account_sort]
```

Δ, Δ %, % of NR, pp on ratio rows, units, cost sign and hide-empty are presentation (TypeScript), computed from these unscaled columns. Expected size: ≈ 110 rows × 16 columns.

**Q2 — KPI tiles (§5), 12 rows:**

```dax
EVALUATE
SUMMARIZECOLUMNS (
    dim_kpi[slot]
    ,dim_kpi[kpi_code]
    ,dim_kpi[kpi_label]
    ,dim_kpi[kpi_group]
    ,dim_kpi[better_when]
    ,dim_kpi[value_type]
    ,dim_kpi[definition]
    ,_entity, _fy, _month, _tv, _base, _cmp_a, _cmp_b, _ccy, _fx, _regions, _channels, _lines, _segments
    ,"@value",     CONVERT ( [_KPI Value], DOUBLE )     // bip: unscaled twin of `KPI Value`
    ,"@secondary", [KPI Secondary]
    ,"@d_a",       CONVERT ( [KPI Δ A], DOUBLE )
    ,"@d_b",       CONVERT ( [KPI Δ B], DOUBLE )
)
ORDER BY dim_kpi[slot]
```

`dim_kpi` relates to `param_entity_view`, so `_entity` already selects the entity's 12 slots.

**Q3 — net revenue bridge (C-40, T-05):**

```dax
EVALUATE
SUMMARIZECOLUMNS (
    dim_bridge_step[step_code]
    ,dim_bridge_step[step_label]
    ,dim_bridge_step[step_sort]
    ,_entity, _fy, _month, _tv, _base, _cmp_a, _cmp_b, _ccy, _fx, _regions, _channels, _lines, _segments
    ,"@value", CONVERT ( [_Bridge Value], DOUBLE )
)
ORDER BY dim_bridge_step[step_sort]
```

**Q4 — largest variances (C-45), top 8 leaf rows:**

```dax
EVALUATE
TOPN (
    8
    ,SUMMARIZECOLUMNS (
        dim_pl_row[row_key]
        ,dim_pl_row[line_code]
        ,dim_pl_row[account_label]
        ,FILTER ( ALL ( dim_pl_row[is_leaf] ), dim_pl_row[is_leaf] )
        ,_entity, _fy, _month, _tv, _base, _cmp_a, _cmp_b, _ccy, _fx, _regions, _channels, _lines, _segments
        ,"@base",  CONVERT ( [Base Amount], DOUBLE )
        ,"@cmp",   CONVERT ( [Bridge Comparison Amount], DOUBLE )
        ,"@abs_d", CONVERT ( [LV Abs Δ], DOUBLE )
    )
    ,[@abs_d], DESC
)
```

**Q5 — profitability by slice (C-46), breakdown column from the allow-list:**

```dax
EVALUATE
SUMMARIZECOLUMNS (
    dim_channel[channel_name]                       // allow-listed per F-21
    ,_entity, _fy, _month, _tv, _base, _cmp_a, _cmp_b, _ccy, _fx, _regions, _channels, _lines, _segments
    ,"@nr",       CONVERT ( [Net Revenue], DOUBLE )
    ,"@share",    [Prof NR Share]
    ,"@nr_d_pct", [Prof NR Δ %]
    ,"@gm",       [KPI Gross Margin %]
    ,"@cm",       [KPI CM %]
    ,"@ebitda",   [KPI Adj EBITDA Margin]
    ,"@op",       [KPI Operating Margin]
)
ORDER BY [@nr] DESC
```

**Q6 — context strip (L-04, L-05, C-50), one row:**

```dax
EVALUATE
CALCULATETABLE (
    ROW (
        "@status",     [Data Status]
        ,"@context",   [Context Line]
        ,"@notices",   [Notices]
        ,"@slice_note", [Slice Panel Note]
        ,"@base_nr",   CONVERT ( [Net Revenue], DOUBLE )
        ,"@cmp_nr",    CONVERT ( [Bridge Comparison NR], DOUBLE )
    )
    ,_entity, _fy, _month, _tv, _base, _cmp_a, _cmp_b, _ccy, _fx, _regions, _channels, _lines, _segments
)
```

Every call carries `resultSetRowCountLimit` (Q1: 500; Q2: 50; Q3: 20; Q4: 20; Q5: 100; Q6: 5; Q0: 10) so an unexpected fan-out fails as `overflow` instead of flooding the browser. Reference data (months, versions, regions, slices) can later come from the same model (`SUMMARIZECOLUMNS` over the dims, RLS-consistent), which is what retires `lhraw` (§10).

## 9. Performance vs N-01

- **Per filter change:** the active view's query + Q6 first (2 calls), the other views prefetched in parallel after (4 calls) → ≤ 6 calls; F-14 … F-20 and layout changes re-render from cached unscaled results with **no query**. Debounce multi-select edits (F-33) to one round trip.
- **Budget:** 120 req/min/user leaves headroom (20 full filter changes per minute per user). Results cached in session memory keyed by the serialised filter, **per principal** (cleared on sign-out; never a shared store — fabric-sdk skill).
- **Latency chain:** browser → BaaS → UDF → Power BI → Analysis Services. Import model of ≈ 1.2 M fact rows; the engine chain `_PL Base → _Amt Window → _Amt Row → _Amt Entity → _Amt Raw` is the same one Track B's visuals run. Expectation: sub-second warm engine time for Q1 (≈ 110 rows), unknown platform overhead (§3.16); **N-01 (< 2 s p95) is plausible, unproven**. T-18 is measured on the deployed app with the three demo identities after the first `rayfin up`; fallback levers if it misses: fewer measures in Q1 (drop FY columns unless F-17 "Full-year outlook" is on), prefetch adjacent periods, ask bip for aggregation tables or Direct Lake.
- **Row expand < 0.3 s:** client-side only (all rows are in Q1).

## 10. Consequences and upgrade path

- `§7` lives in DAX once; T-01 … T-07 run in `tests/control-totals.dax` for both tracks; the app's TypeScript engine from ADR-0005 (`pnl/model/fx.ts`, `pnl/data/pnl-aggregate.prototype.ts`, `#probe`) and the `FactPl` / `FactFxRate` connector entities become dead code → removal proposed to the USER (not executed by fin without approval; CLAUDE.md "never delete pre-existing code").
- N-04 enforced server-side; the app's gating is UX. Any Build user can run arbitrary DAX within their rows — acceptable and intended.
- New runtime dependency on the model being **published and refreshed**: a failed refresh shows stale data (`Data Status` surfaces it), an unpublished model shows the sample fallback with a reason.
- `lhraw` migration: phase 1 keep (reference dims, `auth: application` — dimension labels are visible to every app user; acceptable), phase 2 move reference reads to the model (RLS-consistent entity list), phase 3 `npx rayfin connector remove lhraw` + delete `rayfin/connectors/lhraw/` (USER go; code removal only, no data loss) and update DEC-001 / ADR-0003's "which connector" note.
- Publishing elsewhere later = new item id in `rayfin/.env` + `npx rayfin up connector apply --name pnlModel` (verify the subcommand on 1.36.2 before use).
- AI chat (later): a Fabric data agent over this model inherits RLS per user when it runs as the user; an LLM-tools design would call the same `executeQuery` surface with the same allow-list discipline. Identity remains the deciding constraint (LSN-003).

## 11. Alternatives considered

| Option | Verdict |
|---|---|
| ADR-0005 (a): DAB aggregation on `lhraw` + TypeScript engine | Superseded: second §7 implementation, no N-04, no chat seat. |
| ADR-0005 (b): Rayfin functions + T-SQL | New child item, cold starts, SQL text assembly; still no per-user RLS without extra work. |
| `fabric-semanticmodel` with `application` auth | Not allowed by the platform (§3.2) and would defeat N-04. |
| New app-only model | Duplicate engine and tests (§4). |

## 12. Supersession of ADR-0005 (edit applied 2026-10-22)

The status line of `docs/ADR/0005-track-a-pnl-data-access.md` now reads:

```markdown
- **Status:** superseded by ADR-0006 on 2026-10-21 — the USER chose option (c) (semantic-model connector, delegated auth, RLS in the model). Option (a) was prototyped (`pnl/data/pnl-aggregate.prototype.ts`, `pnl/model/fx.ts`) and never deployed.
```

## 13. Prerequisites by owner

Blocking chain: **USER (tenant, accounts) → ginee (publish, item id, refresh) → bip (roles, measures) → ginee (role members, Build) → fin (connector, deploy) → USER + fin (3-identity test)**. Items marked ⛔ block fin's deploy; items marked ▶ block fin's authoring.

**USER**
- ⛔ Tenant setting "Dataset Execute Queries REST API" (Admin portal › Integration settings) enabled, or confirm it already is. [V §3.13]
- ⛔ Confirm Fabric Apps connector invocation is enabled for RAW (surfaces as `FEATURE_NOT_ENABLED` on the first deployed call otherwise; cannot be checked from the repo). [V §3.23]
- ⛔ Create the demo accounts (§7): 3 member accounts; confirm names; decide **item-level sharing vs workspace Viewer** for RAW (§5).
- ▶ Confirm model reuse (§4) and RAW as the publish workspace (§5).
- ▶ Accept the Power BI consent prompt once when fin runs the first `connector invoke` (developer identity) — or state that fin's identity must not hold Build.
- Later: approve deletion of the ADR-0005 prototype code and of `lhraw` (phase 3).

**ginee**
- ▶ Publish `pbi-report/ACME Unified PnL.SemanticModel` to RAW (Desktop publish or Fabric item import of the PBIP definition); hand fin the **model item id** (`npx rayfin connector search "ACME Unified PnL" --workspace-id <RAW> --type fabric-semanticmodel --json` works once published).
- ⛔ Data source credentials for the `lh_raw` SQL endpoint connection (OAuth2 / cloud connection) and a successful first refresh; schedule (N-02) if Import stays.
- ⛔ After bip's roles land: publish the updated model; add demo users to roles (model › Security); grant Read + **Build** on the model to the three accounts (and app item access).
- Decide Import vs Direct Lake (ADR-0003 open item); record in `docs/model/semantic-model.md`.
- Phase 2: `sec_user_scope` table in `lh_raw.acme_pl` if dynamic RLS is adopted.

**bip**
- ⛔ RLS roles in TMDL per §6 phase 1 (3 roles; `control_totals_usd` filter); `_Sel Entity` robust to an unselectable `GROUP`.
- ▶ App measure contract: confirm or add unscaled `_PL FY Budget`, `_PL FY LE`, `_KPI Value` (or confirm `[KPI Value]` with a `param_units` filter is acceptable); confirm `_PL Base`, `_PL Compare A`, `_PL Compare B`, `_Bridge Value`, `Base Amount`, `Bridge Comparison Amount`, `Bridge Comparison NR`, `LV Abs Δ`, `Prof NR Share`, `Prof NR Δ %`, KPI `%` items, `Notices`, `Context Line`, `Data Status`, `Slice Panel Note` as stable names; mark them "app contract" in `docs/model/measure-dictionary.md`.
- DAX tests: run `tests/control-totals.dax` under each role (View as) and add a role test (entity role sees only its entity; group role reconciles T-01).
- Performance Analyzer baseline for the statement and KPI visuals (input to §9).

**fin** (details in §14)
- Connector add, pinned install, wiring, `.env.example`, probe payloads, DAX builder + tests, figures source, Q0 gating, data-source switch, gates, dry-run, deploy on the USER's go, 3-identity test plan.

## 14. Implementation plan — fin's part (nano steps)

Effort: S ≤ 30 min · M ≤ 2 h · L ≤ half a day. "Verify" is the check that closes the step. No step deploys without the USER's go; no step deletes pre-existing code.

| # | Step | Verify | Effort | Needs |
|---|---|---|---|---|
| 1 | `npx rayfin connector search "ACME Unified PnL" --workspace-id <RAW> --type fabric-semanticmodel --json` → take `itemId` from the result (never typed by hand). | JSON lists exactly one model in RAW. | S | ginee published |
| 2 | `npx rayfin connector add --type fabric-semanticmodel --workspace-id <RAW> --item-id <model> --name pnlModel --operations executeQuery` (literal IDs). | `rayfin.yml` gains the entry with `version: '1'`, `auth.type: delegated`; `rayfin/connectors/pnlModel/schema.ts` exists with the `@generated` banner; CLI prints wiring instructions (app-owned file) and the install line. | S | 1 |
| 3 | Run the printed install verbatim, scoped: `npm install -w @rayfin-app/frontend @microsoft/rayfin-connector-fabric-semanticmodel@1.36.2 @microsoft/rayfin-connectors@1.36.2`. | `npm ls` shows one version line (1.36.2) for every `@microsoft/rayfin-*`. | S | 2 |
| 4 | Probe payloads under `fabric-app/rayfin/probes/` (JSON envelopes, not `.dax`): `q0-entities.query.json` (`EVALUATE VALUES ( dim_entity[entity_code] )`, limit 10) and `q1-statement-smoke.query.json` (Q1 with literal defaults, limit 500). `rayfin/probes/` is committed; results spill to `rayfin/.temp/` (gitignored). | `npx rayfin connector invoke pnlModel executeQuery --file rayfin/probes/q0-entities.query.json` returns `status: 'success'` with 2 rows (developer identity, Build). Check whether amounts arrive scaled (§3.18). | S | 3, USER consent prompt |
| 5 | Move IDs to the runtime hook: `PNL_MODEL_WORKSPACE_ID` / `PNL_MODEL_ITEM_ID` in `rayfin/.env` (gitignored) and `rayfin/.env.example` (placeholders), `${VAR}` in `rayfin.yml`. | `npx rayfin up --dry-run` resolves both; re-run step 4 — record whether `invoke` still works with `${VAR}` (QRK-001 follow-up). | S | 4 |
| 6 | Wire the client: `packages/frontend/src/lib/connectors.ts` — import `PnlModelSchema` + `connectorConfig` from `../../../../rayfin/connectors/pnlModel/schema`; `AppConnectorsSchema = { lhraw; pnlModel }`; `connectorConfigs.pnlModel`; `connectorRuntimes = { pnlModel: fabricSemanticModel({ resultSetRowCountLimit: 1000 }) }`. | `npm run typecheck`; `client.connectors.pnlModel.executeQuery` is typed as `SemanticModelQueryResult`. | S | 2 |
| 7 | Allow-list + DAX builder `packages/frontend/src/pnl/data/pnl-model-queries.ts`: code maps (`TimeView → MTD/QTD/YTD/LTM/FY`, versions, fx), `daxString()` (rejects `"` and control chars, used only on reference-validated codes), `buildDefine(filter, ref)`, `buildStatement/KPIs/Bridge/Drivers/Profitability/Context/VisibleEntities`. Pure functions. | `pnl-model-queries.spec.ts`: snapshot per view for 3 filter states; rejects an unknown region code, a channel code from the other entity, month 13; GROUP drops slice filters (F-32); `null` selections emit no filter arg. | M | 6 |
| 8 | Executor `pnl-model-client.ts`: `runQuery(client, name, dax, limit)` → throws `PnlModelError(category, message, requestId)` on `status: 'error'`; column-index helper `indexColumns(table)`. | Unit tests with a fake client: success mapping, `overflow`, `api`, thrown transport error. | S | 6 |
| 9 | Mapper `pnl-model-figures.ts`: Q1 … Q6 rows → `Figures` (statement rows with Δ/Δ %/% NR/pp, units & cost sign applied, KPI tiles, bridge geometry via existing `bridge-geometry.ts`, drivers, profitability, notices from Q6). `sample: false`. | Tests from recorded probe results (fixtures captured in step 4/13, numbers cross-checked against `control_totals_usd` for NR / OP / NP of the probe scenario — T-06 at the app boundary). | L | 7, 8, bip contract |
| 10 | Data source switch `pnl/data/data-source.ts`: `loadFigures` → model path; on throw/`error` → `loadSampleFigures` with `fallbackReason` and `sample: true` (LSN-002 gating stays automatic). Q0 result → `ReferenceData.visibleEntities`; `FilterState.entity` options exclude `G` unless both entities are visible; empty Q0 → explicit "no access" state. | `pnl-app.spec.tsx`: offline source still renders; a source whose Q0 returns `['P']` hides Group and forces entity `P`; empty Q0 shows the no-access message. | M | 9 |
| 11 | Caching + fan-out in `use-pnl-data.ts`: per-filter-key memo (module state cleared on sign-out via `onSessionChange`), active view + Q6 first, others after; debounce 250 ms. | Tests: two identical filters → one call set; sign-out clears the cache. | M | 10 |
| 12 | Gates: `npm run typecheck && npm run build && npm run lint && npm test`, then `npx rayfin up --dry-run` (targeting = recorded deployment `acme`, not a create). | All green; dry-run lists the connector change only (plus static app). | S | 11 |
| 13 | **Deploy on the USER's go:** `npx rayfin up` (connector + static app); smallest alternative `npx rayfin up connector apply --name pnlModel` then `npx rayfin up staticapp deploy` — confirm both subcommands exist on 1.36.2 with `--help` before offering them. | Deployed app, signed in as the USER: Q0 returns 2 entities, statement renders real numbers; `#probe` page shows request ids. | S | 12, USER |
| 14 | 3-identity test (manual, deployed): `demo-products` sees entity P only, Group hidden, figures match Track B for the same slicer state; `demo-cloud` idem for S; `demo-group` sees Group with eliminations (T-01); a no-role account gets the no-access state; T-14/T-15 behaviour; N-01 timing from the browser (p95 over 20 filter changes) → T-18 note. | Checklist signed in `.log/daily` by the USER; any RLS leak = stop-ship. | M | 13, ginee roles/members |
| 15 | Follow-ups proposed to the USER (not executed): remove `#probe` aggregate prototype, `fx.ts`, `FactPl`/`FactFxRate` entities (ADR-0005 artefacts); phase 2 reference reads from the model; phase 3 `connector remove lhraw`; ADR-0005 status edit (§12); memory updates (DEC-003, QRK on `${VAR}` + `invoke`, CONVERT DOUBLE candidate). | USER decision recorded in coms. | S | 14 |

Total: about 1.5 to 2 working days of fin effort once bip's contract and ginee's publish are in place.

## 15. Open questions for the USER

1. Accept this ADR (semantic model, delegated, RLS in the model) and the reuse of the Track B model published to RAW?
2. Demo accounts: three member accounts as in §7? Who creates them, and do they get item-level sharing (recommended) or the RAW Viewer role?
3. Phase 1 static entity roles now, dynamic `sec_user_scope` (entity × region) later — agreed?
4. May fin's own identity hold Build on the model for the CLI probe loop (§14 step 4)?
5. After the switch: approve removing the ADR-0005 prototype code and, after phase 2, the `lhraw` connector?

## 16. Amendments (2026-10-22, main agent under USER delegation)

### 16.1 Q1 / Q2b contract: level columns only, variances derived in the app

**Finding (bip, Performance Analyzer on the published model):** every query is formula-engine bound and most of the cost is plan building. The statement columns share nothing — `PL Δ A` re-evaluates both `_PL Base` and `_PL Compare A`, `PL Δ A %` again, `PL % NR` adds the NR line — so one Q1 row cost about 19 engine evaluations; the number of group-by columns makes no difference.

**Decision.** Q1 requests only the five level measures `PL Base`, `PL Compare A`, `PL Compare B`, `PL FY Budget`, `PL FY LE`. Q2b requests `KPI Value` plus the same measure under `param_eval` `CMP_A` / `CMP_B` (one column per Compare that is not None) instead of `KPI Δ A` / `KPI Δ B`. The app derives `Δ A`, `Δ A %`, `Δ B`, `Δ B %`, `% NR`, `Δ LE vs Budget` and the KPI Δ in `packages/frontend/src/pnl/model/derive.ts` — pure functions that copy the model's rules verbatim from `_measures.tmdl`:

| Model measure | Rule reproduced |
|---|---|
| `_PL Δ A` / `_PL Δ B` / `_PL Δ LE` | blank comparison → blank; otherwise base − comparison on signed values (positive is favourable on every line; the sign lives in the amounts, there is no per-line flip); ratio rows × 100 (pp); a blank base counts as 0 (`BLANK () − c = −c`) |
| `PL Δ A %` / `PL Δ B %` | blank on ratio rows and blank comparison; (base − c) ÷ \|c\|; c = 0 → blank (`DIVIDE`) |
| `PL % NR` | blank on ratio rows; row value ÷ the NR line's value of the same column; blank value or NR blank / 0 → blank |
| `KPI Δ A` / `KPI Δ B` | Compare None, blank value or blank comparison → blank; `value_type` PCT / PCT2 → (v − c) × 100 pp; otherwise (v − c) ÷ \|c\|, c = 0 → blank |

The display measures divide amounts by `_Units Divisor` before the variance measures subtract; the app subtracts after. Both are linear, so the results agree to floating-point noise (≤ 1e-9 relative in the parity tests).

**Evidence.** `pnl-model-statement.parity.spec.ts` and `pnl-model-figures.parity.spec.ts` replay live captures of both query shapes (`fixtures/q1-statement-parity.fixture.ts`, `fixtures/q2-kpi-parity.fixture.ts`, 2026-10-22, default and sliced filters): every derived cell equals the model's own column, blank for blank. Timings through `connector invoke` the same afternoon (wall clock incl. ≈ 5 s CLI start-up; model `_meta_refresh` = 2026-10-21 18:00 UTC): Q1 default 31.3 s / 24.4 s / timed out at the CLI's 30 s (old shape; QRK-004) → 8.9 s / 8.3 s / 12.1 s (new); Q1 sliced 29.4 s → 8.2 s; Q2b 4 KPIs 12.7 s → 9.4 s. Net of CLI start-up Q1 drops from ≈ 20–27 s to ≈ 3.5–7 s, in line with bip's −76 %. Whether bip's measure speed-ups were already published at probe time cannot be told from the app side (a metadata-only republish leaves `refreshed_at` unchanged); the before/after pairs above were taken minutes apart against the same model state.

**Not changed.** Q4 largest variances keep `LV Δ` / `LV Δ %` in DAX because the `TOPN` by |Δ| runs server-side; Q5 profitability keeps `Prof NR Δ %` (its comparison NR is not a fetched column); Q3 has no variance column. `KPI Secondary` stays a model measure (text).

**Consequences.** `model/derive.ts` is the only TypeScript that computes a number from other numbers; any change to the model's variance rules must land there too (the parity fixtures catch a drift when re-captured). The measure contract in `docs/model/measure-dictionary.md` can drop `PL Δ *`, `PL % NR` and `KPI Δ *` from the app-contract list — they remain Track B report measures.

### 16.2 Connector failure shows an error panel, never sample numbers

Decided 2026-10-22 with phase 2 (restates the practice in `pnl/data/data-source.ts`): when a zone's query fails or the connector cannot be reached, that zone renders its reason and request id; sample figures are used only when no backend exists at all (`rayfin dev`, tests), flagged `sample: true` with the LSN-002 gating. Numbers that ignore the active filters are never shown under a live-looking header (fin LSN-002).
