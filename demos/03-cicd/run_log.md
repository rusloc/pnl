# Run log · Spec 3 · Fabric CI/CD demo

Numbers from real runs only (ADR-0018). Demo-only IDs are allowed here; secrets and tokens never.

## Environment

| Field | Value |
|---|---|
| Run date | 2026-11-24 |
| Capacity | `issglobalfabric`, F64, North Europe (`1bb7581b-5ed3-4e71-b22c-4501afea0ba4`), shared with workspace RAW |
| Tenant Git settings (read 2026-11-24) | Git integration on; GitHub sync on; export to Git repos in other geographies **off** |

## Workspaces (spec § 6 step 2)

| Stage | Workspace | Workspace ID | State |
|---|---|---|---|
| Development | `ws_cicd_demo_dev` | `fa5ef562-84b9-4a60-a006-5660a27f014a` | lakehouse + notebook, seeded |
| ~~Test~~ | ~~`ws_cicd_demo_test`~~ | `2d4da455-fde4-4f1c-8531-de4cbc98843c` | **deleted by the USER 2026-11-24** (amendment 2: Dev → Prod only) |
| Production | `ws_cicd_demo_prod` | `f6a40758-3770-40de-bef8-cfbd9b811581` | filled by the deployment pipeline, seeded |

## Dev items (spec § 6 step 3)

| Item | Type | ID |
|---|---|---|
| `lh_cicd_demo` | Lakehouse, no schemas | `e4c57cf0-3ef9-442d-bf53-196ec96f879f` |
| `lh_cicd_demo` | SQL analytics endpoint | `9a29ba9b-2d12-4287-914a-2de61e83f3ba` |
| `nb_seed_sales` | Notebook, default lakehouse `lh_cicd_demo` | `8676e229-ee88-4c29-836b-5b17b3787eec` |
| `Sales CICD` | Semantic model, Direct Lake on OneLake | `23c2de31-b3eb-466c-a81a-92cf40687b9e` |
| `Sales CICD` | Report (PBIR), bound to `Sales CICD` | `a5740c26-32f3-4860-986e-82d93e780613` |

`WorkspaceId` / `LakehouseId` for the `Sales CICD` model parameters in Dev: the workspace ID and the lakehouse ID above (not the SQL endpoint ID).

Notebook source: `notebooks/nb_seed_sales.Notebook/` (spec § 5 code verbatim; `{{LAKEHOUSE_ID}}` / `{{WORKSPACE_ID}}` placeholders in the META block stand for the IDs above).

## Seed run, Dev

| Field | Value |
|---|---|
| Job | `RunNotebook`, started 2026-11-24 10:56:15 UTC, ended 10:59:18 UTC |
| Duration | 183 s (Spark session start included) |
| `dim_environment` | 1 row, `environment` = `ws_cicd_demo_dev` (the spec's context key `currentWorkspaceName` worked; no fix needed) |
| `dim_date` | 365 |
| `dim_product` | 50 |
| `fact_sales` | 50,000, 0 duplicate `sales_id` |
| Margin % as written (÷ cost) | 0.66667 (Sales 39,693,347.19, Cost 23,815,959.96) — matches the spec's ≈ 66.7 % |

Checked through the SQL analytics endpoint (counts, environment value) and the Delta log (counts).

## Model and report in Dev (spec § 6 steps 4–6) 2026-11-24

- 11:15 UTC: not attempted (same `Cost Amount` measure/column clash as Spec 1). Fixed by the ADR-0018 amendment: measures end in " (fx)" and live in the calculated table `_Measures`.
- 11:40 UTC: model created through the Fabric Items API with `WorkspaceId` / `LakehouseId` = the Dev IDs above (filled in a scratch copy only).
- **The report `Sales CICD` was published by API** (Items API, `byConnection` with the model ID), not from Desktop: spec § 6 step 6, "the last manual publish", done by ginee under ADR-0018 d (hybrid build).

| Check | Result |
|---|---|
| Framing (enhanced refresh) | Completed, 11:41:38–11:41:44 UTC, 5.7 s |
| `_Measures` calculated table processed | yes, 1 row |
| `[Margin % (fx)]` as written (÷ cost) | 0.66667 ≈ 66.7 % |
| `[Environment Name (fx)]` | `ws_cicd_demo_dev` |
| `[Sales Amount (fx)]` / `[Cost Amount (fx)]` | 39,693,347.19 / 23,815,959.96 = seed |
| Report bound to the model | yes (datasetId = model ID) |

## Deployment pipeline, Dev → Prod (spec § 7, ADR-0018 amendment 2) 2026-11-24

The USER amended Spec 3 to two stages (Development, Production; no Test). The first three-stage pipeline `cf194592-c88c-401d-9851-149f9effd0a4` was deleted by the USER (`fab api -X delete deploymentPipelines/…`) together with `ws_cicd_demo_test`; its history below stays as the record of the § 7 step 3 checkpoint and of how the Prod items were first created.

| Item | ID |
|---|---|
| `dp_cicd_demo` (current, 2 stages) | `7259267d-9038-41f8-b859-604b74fdc205` |
| Stage Development → `ws_cicd_demo_dev` | `1991057c-878f-44a1-b4ea-24a48ad32f1e` |
| Stage Production → `ws_cicd_demo_prod` | `0f953309-e3ad-48aa-bce0-83dcd6985593` |

**Pairing:** on assignment, all 4 existing Prod items paired with their Dev counterparts (stage items show `targetItemId` / `sourceItemId` for the model, report, lakehouse and notebook); no "new" or "only in target" items. No delete or reseed needed; Prod IDs unchanged.

| # | From → to | Items | Note | Server time | Result |
|---|---|---|---|---|---|
| 1 | Development → Production | `Sales CICD` model + report | "Initial deployment, Dev -> Prod pipeline" | 6.0 s (12:24:43.6–12:24:49.6 UTC) | Succeeded; diff 0 new, 0 different, 2 no difference |

After deployment 1: Prod report still bound to the Prod model (`48f71404-…`); Prod model parameters still the Dev values (`WorkspaceId` `fa5ef562-…`, `LakehouseId` `e4c57cf0-…`) until the Production rules exist; not refreshed.

### Production rules (USER, portal; no API)

| Parameter | Value |
|---|---|
| `WorkspaceId` | `f6a40758-3770-40de-bef8-cfbd9b811581` |
| `LakehouseId` | `b36cf304-8037-4b8f-956c-12cb38ae1fa7` (Prod `lh_cicd_demo`, re-read 12:24 UTC) |

## First deployment pipeline, three stages (deleted) 2026-11-24

| Item | ID |
|---|---|
| `dp_cicd_demo` | `cf194592-c88c-401d-9851-149f9effd0a4` |
| Stage Development → `ws_cicd_demo_dev` | `99399ac3-e848-4841-afc1-4805812a4da1` |
| Stage Test → `ws_cicd_demo_test` | `3df8ad57-45f0-4a8b-b5d3-52f250eeee38` |
| Stage Production → `ws_cicd_demo_prod` | `12873952-8a2d-400f-bbbc-a89fba4e46cd` |

Pipeline and stage assignment created through the Fabric REST API.

### Deployments

| # | From → to | Items | Note | Server time | Result |
|---|---|---|---|---|---|
| 1 | Development → Test | 4 new (lakehouse, notebook, model, report) | "Initial deployment" | 22.5 s (11:45:19–11:45:42 UTC) | Succeeded |
| 2 | Test → Production | 4 new (lakehouse, notebook, model, report) | "Initial deployment" | 30.9 s (11:51:36–11:52:06 UTC) | Succeeded |

### § 7 step 3 checkpoint: did the PBIR report deploy?

**Yes.** The PBIR report `Sales CICD` deployed through the pipeline (deployment 1, Succeeded) and auto-bound to the Test model (report datasetId = Test model ID). No `fabric-cicd` fallback needed.

### Test items (created by deployment 1)

| Item | Type | ID |
|---|---|---|
| `lh_cicd_demo` | Lakehouse (empty until seeded) | `2ee779a8-33c5-4c5e-b8b9-f43958e5ee18` |
| `lh_cicd_demo` | SQL analytics endpoint | `d3d9a7c7-ff7a-4bd7-a6ba-4287a35fede4` |
| `nb_seed_sales` | Notebook | `ff84ae44-2699-4ac4-a4b4-17ddc9ff364a` |
| `Sales CICD` | Semantic model | `75668c6a-ca46-4387-8e2f-915db616e155` |
| `Sales CICD` | Report (PBIR) | `f880bf90-85f4-43e2-9700-450e2b26777e` |

### Test checks

| Check | Result |
|---|---|
| `nb_seed_sales` default lakehouse after deploy | Test `lh_cicd_demo` (`2ee779a8-…`, workspace Test): the pipeline rebound it, no notebook rule needed |
| Seed run in Test | Completed, 11:46:24–11:49:43 UTC, 199 s |
| Counts | 1 / 365 / 50 / 50,000; 0 duplicate `sales_id` |
| `dim_environment` | `ws_cicd_demo_test` |
| Margin % as written, from the Test lakehouse | 0.66667 |
| Test model source before rules | still the **Dev** lakehouse (`WorkspaceId` = Dev, `LakehouseId` = Dev), as spec § 7 warns |

### Production items (created by deployment 2)

| Item | Type | ID |
|---|---|---|
| `lh_cicd_demo` | Lakehouse | `b36cf304-8037-4b8f-956c-12cb38ae1fa7` |
| `lh_cicd_demo` | SQL analytics endpoint | `6adc3c7a-f885-404f-917d-c6a3fc31d7ee` |
| `nb_seed_sales` | Notebook | `a9db32bd-4919-467f-9cf2-215aedf6ed0f` |
| `Sales CICD` | Semantic model | `48f71404-2a7e-442c-847b-881d47513b4f` |
| `Sales CICD` | Report (PBIR) | `72328283-a08a-4037-b90b-50bfe97f9ff0` |

### Production checks

| Check | Result |
|---|---|
| Report bound to the Prod model | yes (datasetId = Prod model ID) |
| `nb_seed_sales` default lakehouse after deploy | Prod `lh_cicd_demo` (`b36cf304-…`, workspace Prod) |
| Seed run in Prod | Completed, 11:52:39–11:55:47 UTC, 188 s |
| Counts | 1 / 365 / 50 / 50,000; 0 duplicate `sales_id` |
| `dim_environment` | `ws_cicd_demo_prod` |
| Margin % as written, from the Prod lakehouse | 0.66667 |
| Prod model source before rules | still the **Dev** lakehouse (`WorkspaceId` / `LakehouseId` = Dev); not refreshed |

### Stopped at § 7 step 5

Deployment rules have no public API (Fabric and Power BI REST; a probe of a stage `rules` path returns 404). The rules are set by the model owner in the portal. The owner of the Test model is the USER's identity. Test and Prod models not refreshed yet (they would frame on Dev data until the rules are in).

## Pending (later steps)

- GitHub repo `rusloc/fabric-cicd-demo` (USER) and Dev → Git connection, folder `workspace`
- Production parameter rules (USER, portal), redeploy Dev → Production, reframe, Environment = ws_cicd_demo_prod, Margin % (fx) 0.6667
- Seconds per deployment
