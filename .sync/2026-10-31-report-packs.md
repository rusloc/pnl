# Report packs v3: P&L, Mirelo Sales, Nordmark Exec, hand-off for publishing and embedding

from rusloc/pnl (main agent) · to vosk.dev repo agent · USER · 2026-10-31 · status: **draft** (fresh-clone acceptance test running)

This note supersedes `2026-10-30-report-packs.md`. It is the single entry point to every report this repo hands over. Each report sits in one self-contained folder, and each sub-folder has its own README with build steps, test counts and caveats. Read those before you build. Decision record: ADR-0014 (amended 2026-10-30, item 10) in rusloc/pnl.

**What changed since v2:** the Power BI packs no longer ship data or a model cache. You generate the data with `data-gen/`, point the PBIP at it, refresh in Desktop, check, then publish. The JS apps are unchanged: they still carry their prebuilt data.

## What is here

| Report | Folder | Flavour | Data | How it reaches the site |
|---|---|---|---|---|
| ACME Unified P&L | `pnl/js-app/` | Standalone Next.js 16 app | ✔ prebuilt `public/data/` (1.7 MB) | Build and host it, then embed at 1440 × 810 |
| ACME Unified P&L | `pnl/power-bi/` | Power BI project (PBIP) | ✘ generate with `data-gen/pnl/` | Generate → refresh in Desktop → publish → embed |
| Mirelo Sales & Revenue | `mirelo-sales/js-app/` | Standalone Next.js 16 app, route `/sales` | ✔ prebuilt `public/data/sales/` (0.9 MB) | Build and host it, then embed at 1440 × 810 |
| Mirelo Sales & Revenue | `mirelo-sales/power-bi/` | PBIP | ✘ generate with `data-gen/mirelo-sales/` | Generate → refresh in Desktop → publish → embed |
| Nordmark Exec | `nordmark-exec/js-app/` | Standalone Next.js 16 app | ✔ prebuilt `public/data/` (452 kB) | Build and host it, then embed at 1440 × 810 |
| Nordmark Exec | `nordmark-exec/power-bi/` | PBIP | ✘ generate with `data-gen/nordmark-exec/` | Generate → refresh in Desktop → publish → embed |
| All three (Power BI) | `data-gen/` | Python + Node generators, control totals | — | Builds the Parquet each PBIP imports; not embedded |

The P&L also has a Microsoft Fabric (Rayfin) app. It needs an Entra sign-in, so it can't be embedded on a public page. It isn't in a pack. Decided 2026-10-22: the site shows a video of it (the USER supplies the video later), and the JS app is the public P&L embed.

## Order of work

1. **JS apps:** in each `*/js-app/`, run `npm ci && npm run build && npm start` (Node 24 or later, `engines`).
   - Set `EMBED_ALLOWED_ORIGINS` **at build time** to the origins that may frame the app (for example `https://vosk.dev,https://www.vosk.dev`). The CSP `frame-ancestors` header is compiled into the build. Without this variable only same-origin framing works.
   - `NEXT_PUBLIC_SITE_URL` is optional.
2. **Power BI data:** in `data-gen/`, set up the Python 3.12 venv once, then run one command per report (`data-gen/README.md` › Generate; Node 18+ is needed for the P&L). Output goes to `data-gen/<report>/parquet/`. The generators are deterministic, so the output matches the committed control totals byte for byte.
3. **Power BI, per report:**
   1. Open `*/power-bi/*.pbip` in Power BI Desktop. The tables are empty. If Desktop offers a refresh, cancel it.
   2. Set the **`DataFolder`** parameter to the full local path of `data-gen/<report>/parquet`, with no trailing backslash. Close & Apply, then Refresh.
   3. Check the landing page and run the test sample listed in the pack README (every `_pass` TRUE).
   4. Publish from Desktop to the USER's Power BI account, then embed.
4. **Embed:** all reports are designed at 1440 × 810. No assumptions about the host page.

## Rules for the receiving repo

1. **Do not edit the packs in place to fix the reports.** Report the issue back through `.sync/`. The fix lands in rusloc/pnl and the pack is re-issued.
2. **Don't schedule a refresh.** The models read local Parquet files, so a refresh in the service would need an on-premises gateway. A published report is a snapshot of the generated data: a data change here means re-generate, refresh and re-publish there.
3. **`DataFolder` ships as a placeholder.** A Desktop save writes your machine path into `definition/expressions.tmdl` and creates `.pbi/cache.abf`. Neither goes back into `.sync/`: restore the placeholder before you commit anything in a pack, and never commit a cache.
4. **No IDs or secrets in `.sync/`.** Workspace, report or tenant IDs of the published reports stay in the vosk.dev repo's own config.
5. **AI chat is deferred** (USER, 2026-10-28). Ignore the chat notes in this folder, which are marked deferred in the index.

## Per report

- **P&L:** report content unchanged since 2026-10-28. JS 196 tests. PBI 23 test blocks, T-06 552 / 552. Data: 23 Parquet files, 1.25 M fact rows.
- **Mirelo:** content is shipped as is (USER 2026-10-30). Open items are listed in `mirelo-sales/js-app/README.md`: the L11 placeholder, no cross-filtering, and three open questions. JS 92 tests. Data check: `verify.py`, 47 checks.
- **Nordmark Exec:** a 12-card executive dashboard with:
  - a period picker (Week / Month / Quarter / Year → FY → item; default Week 43 FY2026);
  - comparators Budget / Last year / Previous;
  - Region and a Category filter (All, one category or a mix; EBITDA and Supplier OTIF are N/A under a category);
  - ⓘ pop-ups with stacked Actual and Budget / Target figures.

  Both flavours reconcile to the same control totals (26,143 + 10,514 rows): JS 458 tests; PBI 207 test blocks / 50,390 rows TRUE. A card-face comparison of the two flavours across 7 states found 0 mismatches in 945 fields. Data check: `verify.py`, 91 checks. Accepted platform differences are listed in each README.

## Superseded

- `2026-10-30-report-packs.md` and `2026-10-28-report-packs.md` → this note.
- `mirelo-sales/data/`, `nordmark-exec/data/`, `pnl/power-bi/data/` → `data-gen/` (generated, not in git).
- `track-c/data/` → `pnl/js-app/public/data/`.
- `2026-10-26-mirelo-sales-track-c-draft.md` → `mirelo-sales/js-app/`.
- The dated Track C notes of 2026-10-22 … 27 remain valid as background on behaviour and URL keys; the pack READMEs are the current build reference.
