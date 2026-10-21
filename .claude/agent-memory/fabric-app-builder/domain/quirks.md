# Quirks (version-bound)
<!-- next-id: QRK-004 -->

### QRK-001 · `connector inspect --name` does not interpolate `${VAR}` in `connectors[].config` · 2026-10-21
**What:** With `workspaceId: ${LH_RAW_WORKSPACE_ID}` in `rayfin.yml`, `npx rayfin connector inspect --name lhraw --entity acme_pl.dim_entity` fails `Fabric API error: 400 Bad Request`. Same command with literal IDs returns rows. `connector list --json` and `up --dry-run` DO resolve the placeholders.
**Why / Evidence:** Reproduced 2026-10-21 by swapping literals ↔ `${VAR}` in `rayfin.yml` and re-running; direct mode (`--workspace-id … --item-id … --type fabric-sqlanalytics --entity acme_pl.dim_entity`) works regardless.
**Workaround:** use direct mode for inspect; keep `${VAR}` in `rayfin.yml` for deploys.
**Scope (refined 2026-10-21):** `inspect --name` only. `connector invoke pnlModel executeQuery --file …` with `workspaceId: ${PNL_MODEL_WORKSPACE_ID}` / `itemId: ${PNL_MODEL_ITEM_ID}` in `rayfin.yml` and the values in `rayfin/.env` succeeded three times (ROW, INFO.VIEW.MEASURES, Q1) — ADR-0006 §3.20 answered: `invoke` interpolates, `inspect` does not. No Power BI consent prompt appeared for an identity that had already run `rayfin login`.
**Where:** `fabric-app/rayfin/rayfin.yml`, `fabric-app/rayfin/probes/*.query.json`
**Versions:** rayfin-core 1.36.2 · rayfin-cli 1.36.2
**Hits:** 2 · **Confidence:** high · **Tags:** cli, connector, inspect, invoke, env-interpolation
**Last-verified:** 2026-10-21 · **Last-refined:** 2026-10-21 · **Related:** DEC-001, DEC-003, QRK-002
**Status:** active — skill-patch candidate (connectors.md: "inspect --name needs literal ids; invoke --name does not")

### QRK-002 · cli 1.36.2 `connector add` / `blankapp` scaffold differ from the skill · 2026-10-21
**What:** (a) `--name lhRaw` is lowercased to `lhraw` (folder, yml, `client.connectors.lhraw`). (b) For a Lakehouse, `add` writes the lakehouse's **SQLEndpoint item id** (`fab api …/items` type `SQLEndpoint`) into `config.itemId`, not the Lakehouse id you passed; both ids work in `inspect` direct mode. (c) `add` writes `auth.type: application` (skill/docs say `delegated`; `connector search` reports `defaultAuth: application`). (d) `add` rewrites `packages/frontend/src/lib/connectors.ts` with a `// @generated … do not edit below this line.` marker; delete that line to own the wiring. (e) `blankapp` is an npm-workspaces monorepo (`packages/frontend|data|shared`, `rayfin/` has no `data/`; entities would go in `packages/data`); `services.data.enabled: false` by default. (f) Item/workspace link lives in gitignored `rayfin/.deployments.json`, not in `rayfin.yml` — a fresh clone must pass `--workspace-id`/`--item-id` (create) or `up --workspace-id` to hit the existing item. (g) Template `.gitignore` has `rayfin/.env*`, which also ignores `rayfin/.env.example`. (h) Template `vite.config.ts` uses `react()` from plugin-react-swc with no decorator option, so the production bundle keeps TC39 decorators of any value-imported entity class and `rayfin up` refuses it (LSN-001); only `vitest.config.ts` has the lowering.
**Why / Evidence:** Observed during the 2026-10-21 scaffold + add run; `add.md` in `@microsoft/rayfin-guide` documents (c); (h) reproduced by the failed `up` of 2026-10-21 13:20Z and fixed in `vite.config.ts`.
**Where:** `fabric-app/rayfin/rayfin.yml`, `fabric-app/rayfin/.deployments.json`, `fabric-app/.gitignore`, `fabric-app/packages/frontend/src/lib/connectors.ts`
**Versions:** rayfin-core 1.36.2 · rayfin-cli 1.36.2 · create-rayfin 1.36.2
**Hits:** 1 · **Confidence:** high · **Tags:** cli, scaffold, connector-add, layout, gitignore, auth
**Last-verified:** 2026-10-21 · **Last-refined:** 2026-10-21 · **Related:** DEC-001, QRK-001, LSN-001
**Status:** active — skill-patch candidate (project-config.md layout, connectors.md auth default)

### QRK-003 · Connector entities support server-side `groupBy` / `aggregate` (DAB); the skill says nothing about it · 2026-10-21
**What:** `client.connectors.<name>.<Entity>.where(f).groupBy(['a','b']).aggregate({ x: { sum: 'col' } }).execute()` returns `{ fields, aggregations }[]` — `sum/avg/min/max/count` on numeric columns, `having`, `distinct`; `where` supports `in`, `isNull`, `and/or`. Rules: `.aggregate()` after `.select()/.first()/.orderBy()/.after()` throws; grouped results are not paged; no joins or expressions. The skill's `data-client.md` lists only `select/where/orderBy/first` and "no count()", and `connectors.md` shows only `select…first…execute`, so a reader of the skill alone would conclude the browser must page facts.
**Why / Evidence:** `node_modules/@microsoft/rayfin-connectors/dist/category-a/ConnectorEntityClient.d.ts` (methods `groupBy`, `aggregate`), `ConnectorsSchema.d.ts` (`read` ops include `"groupBy", "aggregate"`), `node_modules/@microsoft/rayfin-data/assets/docs/aggregations.md`; `rayfin-connector-fabric-graphql/assets/docs/querying.md` points to it. Compile-verified in `pnl-aggregate.prototype.ts`; **not yet executed against lh_raw** (connectors run only deployed).
**Where:** `fabric-app/packages/frontend/src/pnl/data/pnl-aggregate.prototype.ts`, ADR-0005
**Versions:** rayfin-connectors 1.36.2 · rayfin-data 1.36.2 · rayfin-cli 1.36.2
**Hits:** 1 · **Confidence:** high (typings + package docs) · **Tags:** connector, aggregation, dab, groupBy, skill-gap
**Last-verified:** 2026-10-21 · **Related:** DEC-002
**Status:** active — skill-patch candidate: add an "Aggregate" section to `data-client.md` and `connectors.md` (chain order, numeric-only, no paging, DAB `in`/`isNull` filters). Bump to 2 hits once the deployed probe returns rows.
