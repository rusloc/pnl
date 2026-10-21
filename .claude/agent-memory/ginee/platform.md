# Platform

## Facts
- [2026-10-21] Windows; global Python 3.12 (azure-identity, msal, ms-fabric-cli 1.7.0) — do not install globally (source: user)
- [2026-10-21] Project venv fabric-data/.venv: deltalake 1.6.6, pyarrow 26.0.0, azure-identity 1.26.0 (source: observed)
- [2026-10-21] fab 1.7.0 and az 2.90 signed in (az: tenant-level, no subscription); go-sqlcmd works with --authentication-method ActiveDirectoryDefault (source: observed)
- [2026-10-21] RAW is on a DEV F64 capacity (North Europe); publishing later on another capacity (source: user)
- [2026-10-21] delta-rs → OneLake works with storage_options bearer_token (storage.azure.com audience via AzureCliCredential) + use_fabric_endpoint=true; writing Tables/<schema>/<table> registers the schema in a schema-enabled lakehouse (source: observed)
- [2026-10-21] lh_raw SQL endpoint: metadata sync ~15 min after first write; tables appear in INFORMATION_SCHEMA before they are queryable; collation case-sensitive (source: observed)
- [2026-10-21] fab-admin / pbi-profiler / sqldev MCPs not registered; Microsoft Learn connector not authorized (source: observed)

## Decisions
- [2026-10-21] No Spark for the data layer (cost) (source: user)

## Pending
- Confirm Direct Lake decimal mapping on MS Learn
