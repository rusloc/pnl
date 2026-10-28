# Report packs: P&L and Mirelo Sales, hand-off for publishing and hosting

from rusloc/pnl (main agent) · to vosk.dev repo agent · USER · 2026-10-28 · status: ready (all five packs verified 2026-10-28)

The USER publishes and hosts these reports from the vosk.dev repo. Each report is one self-contained folder. Take what you need without the rest of this repo. Decision record: ADR-0014 in rusloc/pnl.

## What is here

| Folder | Report | Flavour | Build / open |
|---|---|---|---|
| `pnl/js-app/` | ACME Unified P&L | Standalone Next.js 16 app | `npm ci && npm run build && npm start` |
| `pnl/power-bi/` | ACME Unified P&L | Power BI project (PBIP), Import from local Parquet | Open the `.pbip`, set `DataFolder` to `pnl/power-bi/data`, Refresh |
| `mirelo-sales/js-app/` | Mirelo Sales & Revenue | Standalone Next.js 16 app, route `/sales` | `npm ci && npm run build && npm start` |
| `mirelo-sales/power-bi/` | Mirelo Sales & Revenue | PBIP, Import from local Parquet | Open the `.pbip`, set `DataFolder` to `mirelo-sales/data/parquet`, Refresh |
| `mirelo-sales/data/` | Mirelo Sales & Revenue | Parquet + generator + control totals | `generator/generate.py` regenerates everything byte-identically; `checks/verify.py` asserts the control totals |

Every sub-folder has its own README with details, test counts and caveats. Read those before building.

## Rules for the receiving repo

1. **Do not edit the packs in place to fix the reports.** Report the issue back through `.sync/`; the fix lands in rusloc/pnl and the pack is re-issued.
2. **Power BI refresh.** Both models read local files. Publish an already-refreshed model; a scheduled refresh in the service would need an on-premises gateway. Don't schedule one.
3. **`DataFolder` is a placeholder.** Set it locally before refreshing; don't commit a machine path back.
4. **JS apps embed at 1440 × 810.** CSP and security headers live in each app's `next.config.ts`. The only env var is the optional `NEXT_PUBLIC_SITE_URL`.
5. **AI chat is deferred** (USER, 2026-10-28). The P&L app contains no chat code. Ignore the chat notes in this folder, which are marked deferred in the index.

## Superseded by these packs

- `track-c/data/`: use `pnl/js-app/public/data/`.
- `2026-10-26-mirelo-sales-track-c-draft.md`: use `mirelo-sales/js-app/`.
- The dated Track C notes of 2026-10-22 … 27 remain valid as background on behaviour and URL keys. The P&L app README is the current build reference.

## Open on this side

- Power BI packs were verified by bip on 2026-10-28: each refreshes from its own Parquet, every DAX test is TRUE and the validator is clean. Run the test blocks one at a time; the whole P&L file in one batch runs out of memory.
- The USER has not yet done the first-open check of either report in Power BI Desktop.
- Mirelo content items still draft: L11 placeholder, no cross-filtering, three open USER questions (listed in `mirelo-sales/js-app/README.md`).
