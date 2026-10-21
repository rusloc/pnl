# Tech stack + rationale

Status as of 2026-10-21 (ADR-0001). Items marked **open** wait for a USER answer or an ADR.

## Shared
| Choice | Rationale |
|---|---|
| Source data: CSVs in `data/acme_pl_dummy_data/` | Deterministic, regenerable (`node generator/gen_data.js <out>`); built to spec §8. |
| Acceptance: `checks/control_totals_usd.csv` + spec §10 tests | One numeric truth for all three flavors. |
| Repo: single branch `prod` on GitHub (`rusloc/pnl`) | Solo build; no review gate needed yet. |
| No dbt | Data is static dummy data; transformation needs are small. |

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
| Source: Fabric Lakehouse/Warehouse loaded from the CSVs | One data layer shared with Track A. Lakehouse vs Warehouse **open** — ADR-0003. |
| Storage mode | **Open** (Import vs Direct Lake) — ADR-0003. |
| Workspaces, capacity, deploy method | **Open** — single workspace vs deployment pipeline (fab-admin-mcp). |

## Track C — custom JS report (`js-report/`)
| Choice | Rationale |
|---|---|
| Next.js (App Router), TypeScript strict | Default accepted; strong fit with nerd / front-end skills. |
| Data: pre-aggregated Parquet + DuckDB-wasm in the browser | No backend to run or pay for; raw facts (≈68 MB CSV) are too large to ship, so a build step pre-aggregates. Grain **open** — ADR-0002. |
| Hosting: Vercel (team `yaga`) | Already connected via MCP; embedding handled by the vosk.dev repo. |
| Calc engine: framework-free TS module | Spec §7 rules are tested in isolation against the control totals. |
