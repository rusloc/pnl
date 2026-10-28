# ADR-0014 — Hand-off packs in `.sync/`: one self-contained folder per report

- **Status:** **Accepted** (USER decisions 2026-10-28)
- **Date:** 2026-10-28
- **Decider:** USER
- **Applies to:** the ACME P&L report (Tracks B and C), the Mirelo Sales & Revenue report (Power BI + JS) and, later, the Nordmark executive dashboard (ADR-0013).
- **Amends:** ADR-0002 (Track C single app) and ADR-0011 (c) (`/sales` as a route in `js-report/`) **for the hand-off copies only**. Inside this repo `js-report/` stays one app with two routes, and `pbi-report/ACME Unified PnL` stays bound to `lh_raw` (Track A reads the published model).

## 1. Context

The USER publishes and hosts the Power BI and JS reports from another repo (vosk.dev). Until 2026-10-27 the hand-off was a set of dated notes plus a data copy (`.sync/track-c/data/`), and the other repo had to vendor files from `js-report/`. Three problems:
- `js-report/` holds two reports that share 4 small files; the build (`prebuild`) reads `../data/**`, so it fails outside this repo.
- The P&L Power BI model loads from the `lh_raw` SQL endpoint in the dev workspace RAW. That binding cannot go into `.sync/` (no endpoint / workspace IDs) and the publish target may not reach RAW.
- The Mirelo Power BI model reads local Parquet through an absolute `DataFolder` path.

## 2. Decision

1. **One folder per report** in `.sync/`: `.sync/pnl/` and `.sync/mirelo-sales/` (and `.sync/nordmark-exec/` later). Each holds `power-bi/`, `js-app/` and, where the data is not inside a flavour, `data/`. Each sub-folder has a README with the `.sync` header (from · to · date · status).
2. **JS flavour = a standalone Next.js app per report** (option (a) of nerd's assessment 2026-10-28). Shared code (glass, chart-scale, parquet-columns, csv) is **vendored** with a header naming its source of truth in `js-report/`. Prebuilt `public/data` ships committed; no `prebuild`; control-totals CSVs ship as test fixtures. Each pack must pass typecheck, lint, test and build on its own.
3. **Power BI flavour reads local Parquet** through a `DataFolder` text parameter with a placeholder value. The P&L pack gets its Parquet from the same type spec and derivations as `fabric-data/lh_raw/load_acme_pl.py` (ADR-0008 pre-translated columns + `fact_pl_elim`), so the pack and the lakehouse cannot diverge.
4. **Data:** Mirelo ships Parquet + the deterministic generator (seed 20261026) + control totals, not the CSVs (reproducible). Raw P&L CSVs are not shipped; the Parquet in the Power BI pack and the prebuilt JS data are enough to rebuild both reports.
5. **AI chat is deferred** (USER 2026-10-28): no chat code in any pack; the chat notes in `.sync/` are marked deferred.
6. **Source of truth stays here.** A pack is a copy. Any change is made in `js-report/` / `pbi-report/` first and re-packed; pack READMEs say so. Older `.sync/track-c/*` artefacts are superseded by the packs but kept.

## 3. Consequences

- The other repo can take one report without the other, and build each without this repo's `data/`.
- Duplication: vendored files and Parquet copies add ~50 MB to the repo history; re-packing is manual until a pack script exists (idea: copy-list script + staleness test, like `chat-tools.json`).
- Two JS deploys and two CSP configs in the other repo.
- The packs ship before the USER's Desktop first-open check of both PBIPs; that check remains open.
