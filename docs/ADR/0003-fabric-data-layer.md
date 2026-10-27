# ADR-0003 — Fabric data layer for Tracks A + B (lh_raw.acme_pl)

- **Status:** accepted (schema `acme_pl` and the local Python load method). The USER approved both on 2026-10-21.
- **Date:** 2026-10-21
- **Decider:** USER (proposal by ginee)
- **Spec:** `docs/Requirements.md` §8 (D-01 … D-21, D-30, D-35), §10 T-06 · data contract `data/acme_pl_dummy_data/README.md`

## Context

Tracks A (Rayfin app) and B (Power BI report) read one shared Fabric data layer. It is loaded from the deterministic CSVs in `data/acme_pl_dummy_data/` (28 files, about 1.25 M rows, 68 MB).

- **Where it lives:** workspace **RAW**, Lakehouse **lh_raw** (IDs in CLAUDE.md › Workspaces). RAW runs on a **dev** capacity (F64, North Europe), used only to build assets. Publishing happens later on another capacity. In RAW, only `lh_raw` is relevant.
- **Constraint:** no Spark for this project's data layer, because of cost (USER, 2026-10-21).

Observed before the load (read-only):
- `lh_raw` is schema-enabled (`defaultSchema: dbo`, empty).
- The 28 CSVs are also in `Files/acme_pl_dummy_data/`, byte-identical to the repo.
- `Files/` root holds 5 unrelated CSVs from another project.

## Decision

1. **Schema `acme_pl`** in `lh_raw`. It is one namespace for the SQL endpoint, Direct Lake and Rayfin connectors: `lh_raw.acme_pl.<table>`.
2. **Table names are the file names** (spec §8 naming): 4 facts, 12 dims (including `bridge_account_nature` and `dim_cost_centre`), 11 params and `control_totals_usd`. Column names and order are the CSV headers. _Amended 2026-10-23 (ADR-0008): the loader appends 3 pre-translated columns to each fact after the CSV columns (`amount_usd`, `amount_eur`, `amount_gbp`; `gmv_*` on `fact_operational`) and writes one derived table, `fact_pl_elim`; the CSV columns stay first and unchanged._
3. **Types are explicit and declared once**, in the `TABLES` spec of `fabric-data/lh_raw/load_acme_pl.py`. Nothing is inferred.

   | Kind | Delta type | SQL endpoint type | Why |
   |---|---|---|---|
   | Codes, names, `month_key` (`YYYY-MM`), `spine_step` (has `8a`–`8d`), `forecast_cycle` | string | varchar(8000) | Keys stay text, matching the CSV |
   | ISO dates | date | date | |
   | `TRUE` / `FALSE` | boolean | bit | |
   | Counts, sort orders, signs, indices, `fiscal_year` | int | int | Largest value is 1,658,522 |
   | Amounts (`amount_local`, `gmv_local`, `amount_usd`) | decimal(18,2) | decimal(18,2) | Exactly 2 dp in the source. Exact cent sums. Largest is 7.26 bn |
   | FX `local_per_usd` | decimal(18,6) | decimal(18,6) | Exactly 6 dp in the source, so lossless |
   | `bridge_account_nature.weight` | decimal(5,4) | decimal(5,4) | 2 dp, at most 1.00. Exact, so weights sum to 1 exactly |

   Columns are not null unless the README or the CSVs show they can be empty, or they hold free-text descriptions. An empty cell loads as null.
4. **Load method: a local Python pipeline.** `fabric-data/lh_raw/load_acme_pl.py` uses pyarrow and delta-rs (`deltalake`), with dependencies pinned in `requirements.txt` and installed in the gitignored venv `fabric-data/.venv`.
   - **Reads** the CSVs from the repo, not from `Files/`.
   - **Parses strictly.** Any value that does not fit its type raises an error: extra decimal places, a boolean other than `TRUE` / `FALSE`, a bad date, int overflow, or a wrong column count.
   - **Checks every table before writing anything:** header = spec, row count = expected, 0 duplicate keys, no nulls in not-null columns.
   - **Writes** each table as Delta to `abfss://<workspace>@onelake.dfs.fabric.microsoft.com/<lakehouse>/Tables/acme_pl/<table>`, using `mode="overwrite"` and `schema_mode="overwrite"`, then reads each one back.
   - **Auth** is a bearer token for `https://storage.azure.com/` from the signed-in Azure CLI account (azure-identity). The token is never printed.
   - **Configuration:** workspace and lakehouse come from `--workspace` / `--lakehouse` or the `FABRIC_WORKSPACE` / `FABRIC_LAKEHOUSE` environment variables. No IDs are in the code.
   - **`--dry-run`** parses and checks everything and writes nothing.
5. **Idempotent full reload.** The data is static and regenerable, so there is no incremental logic, partitioning or watermark. A re-run overwrites every table (a new Delta version), and type changes in the spec apply on the next run.
6. **Repo layout:** `fabric-data/` is the shared data layer for Tracks A + B, one folder per Fabric item. `fabric-data/lh_raw/` holds `load_acme_pl.py`, `requirements.txt` and `sql/verify-acme-pl.sql`. The venv is `fabric-data/.venv/`.

## Accepted trade-off: no V-Order

delta-rs writes plain Parquet without Fabric's V-Order. At this size, 28 tables of at most 758 k rows each with one file per table, Direct Lake and SQL endpoint reads are fast without it, so the USER accepts this trade-off. If it is ever needed, V-Order can be added later with a one-off `OPTIMIZE … VORDER` from Fabric. That is a Spark run and needs the USER's consent.

## Alternatives considered

| Option | Verdict |
|---|---|
| Spark notebook in RAW (typed DDL, `insert overwrite`, V-Order) | Rejected by the USER: Spark compute is too expensive for a static load. The draft is quarantined in `_removed/2026-10-21/fabric-data/` |
| Lakehouse "Load to Tables" API | Rejected: it infers types, and per Microsoft docs at the time of writing it does not support schema-enabled lakehouses |
| Data pipeline Copy activity / Dataflow Gen2 | Rejected: more moving parts and UI-owned mappings for a one-shot static load |
| Tables in `dbo` | Rejected: a dedicated schema keeps the project's tables apart |

## Consequences

- **Cost:** zero Fabric compute for the load, only OneLake writes from the laptop. Storage is a few MB of Parquet.
- **SQL endpoint metadata sync lags writes.** On the first load, all 28 tables became queryable after about 15 minutes, and `param_detail_level` was the last. The tables were visible in `INFORMATION_SCHEMA` before they could be queried. Verification must retry rather than fail on `Invalid object name`.
- **The SQL endpoint collation is case-sensitive.** System views must be written in upper case (`INFORMATION_SCHEMA.TABLES`). Our table and column names are lower case.
- **Track B (bip / ginee):** the tables are Delta with one file each, far inside every Direct Lake guardrail. The storage mode (Import vs Direct Lake) stays **open**.
  - In the model, `local_per_usd` must be a **Decimal Number (double)**, never Fixed Decimal (4 dp), so the rates are not rounded.
  - Amounts at decimal(18,2) can be Fixed Decimal.
- **Track A (fin):** a Rayfin connector reads `lh_raw.acme_pl.*` through the SQL analytics endpoint. Decided 2026-10-21 (fin, DEC-001): connector `lhraw`, type `fabric-sqlanalytics`, on the `lh_raw` SQL analytics endpoint, schema `acme_pl`, read-only. No warehouse needed.
- Tables are replaced one at a time. For a moment during a reload, readers can see some tables already reloaded and others not yet. This is acceptable for static data.
- **Re-running needs:** the venv (`python -m venv fabric-data/.venv` + `pip install -r fabric-data/lh_raw/requirements.txt`), `az login`, and Contributor rights on RAW.

## Verification (2026-10-21, first load)

- `load_acme_pl.py --dry-run` passed all 28 tables. The write then committed Delta version 0 for every table, and every read-back count matched.
- `fab ls` shows schema `acme_pl` with the 28 tables.
- `fabric-data/lh_raw/sql/verify-acme-pl.sql` on the SQL endpoint: all 28 row counts `OK`. Consumer Products ACT FY2025 net revenue = 4,575,428,492.38 USD, so `_diff_usd = 0.00`.
