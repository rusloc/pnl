# ACME Unified P&L — AI coding brief

1. **What:** one management P&L (IFRS 18 19-step spine; ACME Consumer Products, ACME Commerce Cloud, consolidated ACME Group) built three times from one spec.
2. **Spec:** `docs/Requirements.md` — requirement IDs L-, M-, K-, F-, C-, D-, N-, T- are the contract; cite them in code, tests and commits.
3. **Data:** `data/acme_pl_dummy_data/` — deterministic dummy CSVs (spec §8 star schema) + `checks/control_totals_usd.csv` (expected totals for T-06).
4. **Track A — Rayfin app** in `fabric-app/` (Microsoft Fabric App, deployed with `rayfin up`).
5. **Track B — Power BI report** in `pbi-report/` (PBIP: TMDL + PBIR).
6. **Track C — custom JS report** in `js-report/` (Next.js on Vercel; Parquet + DuckDB-wasm).
7. **Data layer:** A + B read one Fabric Lakehouse/Warehouse loaded from the CSVs; C reads pre-aggregated Parquet built from the same CSVs.
8. **Delivery:** this repo ships the assets only; the vosk.dev showcase embeds them from a separate repo.
9. **Correctness bar:** every flavor matches the control totals and passes the spec §10 acceptance tests.
10. **Repo rules:** single branch `prod`; `en` only; git commands are compiled for the user, never run.
