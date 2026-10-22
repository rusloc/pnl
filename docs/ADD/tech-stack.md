# Tech stack + rationale

Status as of 2026-10-22 (ADR-0001; Track C per ADR-0002). Items marked **open** wait for a USER answer or an ADR.

## Shared
| Choice | Rationale |
|---|---|
| Source data: CSVs in `data/acme_pl_dummy_data/` | Deterministic, regenerable (`node generator/gen_data.js <out>`); built to spec §8. |
| Acceptance: `checks/control_totals_usd.csv` + spec §10 tests | One numeric truth for all three flavors. |
| Repo: single branch `prod` on GitHub (`rusloc/pnl`) | Solo build; no review gate needed yet. |
| No dbt | Data is static dummy data; transformation needs are small. |
| Fabric data layer: Lakehouse `lh_raw` (workspace RAW, dev capacity), schema `acme_pl`, loaded by local Python (delta-rs) — ADR-0003 | No Spark cost; typed, idempotent, verified against control totals. No V-Order, accepted at ~1.2M rows. |

## Track A — Rayfin app (`fabric-app/`)
| Choice | Rationale |
|---|---|
| Microsoft Fabric Apps (Rayfin) SDK/CLI, TypeScript | Required flavor. Entities in `rayfin/data/`, deploy with `npx rayfin up`. |
| Frontend: React (Vite) from the Rayfin template | Template default; matches the TS/React skills on the roster. |
| Data: connector to the shared Fabric data layer (or the Track B semantic model) | **Open** — ADR-0003. |
| Auth: Fabric SSO (Entra) | Mandatory for deployed Fabric Apps. |

## Track B — Power BI report (`pbi-report/`)
| Choice | Rationale |
|---|---|
| Power BI Desktop, PBIP (TMDL + PBIR) | Diff-reviewable source; edited with the pbip-editor skill. |
| Source: `lh_raw.acme_pl` | One data layer shared with Track A — ADR-0003 (accepted). |
| Storage mode | **Open** (Import vs Direct Lake) — ADR-0003. |
| Workspaces, capacity, deploy method | **Open** — single workspace vs deployment pipeline (fab-admin-mcp). |

## Track C — custom JS report (`js-report/`)
| Choice | Rationale |
|---|---|
| Next.js 16 (App Router), React 19, TypeScript 5.9 strict, Vitest, Zod; no Tailwind, no chart library | ADR-0002 §2.1, §2.9 (dependency list approved 2026-10-22). The Ledger guide's px/hex values map to CSS variables + CSS Modules. |
| Data: pre-aggregated Parquet read by `hyparquet` in the browser (no DuckDB-wasm) | ADR-0002 §2.1–2.2. `fact_pl` minus cost centre and the FC2606 cycle (422,712 rows) as per-entity Parquet, built by `scripts/build-data.ts` from the repo CSVs; DuckDB-wasm dropped — several MB of wasm for 8 fixed query shapes over < 0.5 M rows. Amends ADR-0001 §3. |
| Calc engine: framework-free TS module (`lib/engine/`), C-31 allocation computed live | ADR-0002 §2.3. The single source of every number; tested in Vitest against all 552 control totals (T-06); allocation parity-tested against `fact_pl_allocated`. |
| Hosting + embedding: vosk.dev repo, via the `.sync/` hand-off | ADR-0002 §2.6, §5 Q4. This repo delivers the skeleton (ADR-0002 §2.8 slices 0–3) only; no Vercel project or deploy from here. |
