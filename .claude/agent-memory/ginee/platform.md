# Platform

## Facts
- [2026-10-21] Windows; global Python 3.12 (azure-identity, msal, ms-fabric-cli 1.7.0) — do not install globally (source: user)
- [2026-10-21] Project venv fabric-data/.venv: deltalake 1.6.6, pyarrow 26.0.0, azure-identity 1.26.0 (source: observed)
- [2026-10-21] fab 1.7.0 and az 2.90 signed in (az: tenant-level, no subscription); go-sqlcmd works with --authentication-method ActiveDirectoryDefault (source: observed)
- [2026-10-21] RAW is on a DEV F64 capacity (North Europe); publishing later on another capacity (source: user)
- [2026-10-21] delta-rs → OneLake works with storage_options bearer_token (storage.azure.com audience via AzureCliCredential) + use_fabric_endpoint=true; writing Tables/<schema>/<table> registers the schema in a schema-enabled lakehouse (source: observed)
- [2026-10-21] lh_raw SQL endpoint: metadata sync ~15 min after first write; tables appear in INFORMATION_SCHEMA before they are queryable; collation case-sensitive (source: observed)
- [2026-10-21] fab-admin / pbi-profiler / sqldev MCPs not registered; Microsoft Learn connector not authorized (source: observed)
- [2026-10-21] `fab api -i <file>` reads the body in the console code page: Cyrillic DAX arrives as mojibake → send ASCII-escaped JSON (json.dump ensure_ascii=True) (source: observed)
- [2026-10-21] executeQueries via `fab api -A powerbi -X post groups/<ws>/datasets/<id>/executeQueries` works; page by date ≤30k rows with short column aliases to stay under the size limits (source: observed)
- [2026-10-21] `fab export <ws>.Workspace/<name>.SemanticModel -o <dir>` writes PBIP/TMDL directly (source: observed)
- [2026-10-21] No local TOM; scratch .NET 10 console with Microsoft.AnalysisServices.NetCore.retail.amd64 19.x TmdlSerializer parses TMDL without Desktop (source: observed)
- [2026-10-21] powerbi-report-author 0.4.0 on PATH (npm global) (source: observed)
- [2026-10-21] Work tenant (iss-gf.com): USER is Fabric admin (admin/tenantsettings readable), capacity admin of the RAW capacity (F64 issglobalfabric, with 3 other admins), sole Admin of RAW (source: observed)
- [2026-10-21] Tenant settings ON: DatasetExecuteQueries, OnPremAnalyzeInExcel (tenant XMLA switch), EnableAOAI (Copilot, delegated to capacity), PowerBIMCP, AppBackendTenant (Fabric Apps), AllowGuestUserToAccessSharedContent, ExternalSharingV2, Embedding, UseDatasetsAcrossWorkspaces; OFF: ElevatedGuestsTenant, ExternalDatasetSharingTenant, BlockAutoDiscoverAndPackageRefresh, EnableAnonymousDataAccessForFabricApps. SP API access limited to 2 security groups (source: observed)
- [2026-10-21] Capacity XMLA Read/Write mode not readable by API: check Admin portal › Capacity settings (source: observed)
- [2026-10-21] RAW defaultDatasetStorageFormat = Small (source: observed)
- [2026-10-21] fab 1.7.0 `import` sends every file under the folder except cache.abf (so .pbi/*.json too) and refuses a report with byPath → stage a clean model folder before importing (source: observed, fab_cmd_import_utils.py)
- [2026-10-21] Rayfin fabric-semanticmodel connector: deployed path = platform function → Power BI executeQueries under the user's token; its docs name "missing Build permission" as a failure → viewers need Read + Build on the model (source: observed, node_modules docs)
- [2026-10-21] `fab import` without `-f` needs a TTY (questionary prompt) and with `-f` silently overwrites a same-named item → for create-only, POST /v1/workspaces/<ws>/items with the same base64 parts (skip .pbi/, cache.abf); LRO finished in seconds (source: observed)
- [2026-10-21] API-created Import model on a Fabric SQL endpoint: first refresh fails Premium_ASWL_Error "default data connection without explicit connection credentials" until an explicit cloud connection is bound (source: observed)
- [2026-10-21] Fabric Create Connection API cannot create OAuth2 credentials; SQL type allows Basic / OAuth2 / ServicePrincipal / WorkspaceIdentity, Fabric SQL endpoints take Entra only, RAW has no workspace identity → OAuth2 binding = portal sign-in (source: observed)
- [2026-10-21] executeQueries on a never-refreshed model: INFO.VIEW.MEASURES works (DataType per measure), queries touching calculated tables fail "calculated table ... does not" (not processed) (source: observed)

## Decisions
- [2026-10-21] No Spark for the data layer (cost) (source: user)

## Pending
- Confirm Direct Lake decimal mapping on MS Learn
