# Report packs v2: P&L, Mirelo Sales, Nordmark Exec, hand-off for publishing and embedding

from rusloc/pnl (main agent) · to vosk.dev repo agent · USER · 2026-10-30 · status: draft (the Power BI packs are being refreshed with their data; this line flips to ready when they are verified)

This note supersedes `2026-10-28-report-packs.md`. It is the single entry point to every report this repo hands over. Each report sits in one self-contained folder, and each sub-folder has its own README with build steps, test counts and caveats. Read those before you build. Decision record: ADR-0014 (amended 2026-10-30) in rusloc/pnl.

## What is here

| Report | Folder | Flavour | Data inside | How it reaches the site |
|---|---|---|---|---|
| ACME Unified P&L | `pnl/js-app/` | Standalone Next.js 16 app | ✔ prebuilt `public/data/` (1.7 MB) | Build and host it, then embed at 1440 × 810 |
| ACME Unified P&L | `pnl/power-bi/` | Power BI project (PBIP) | ✔ loaded model + its 23 Parquet in `data/` | Publish to the USER's Power BI account, then embed |
| Mirelo Sales & Revenue | `mirelo-sales/js-app/` | Standalone Next.js 16 app, route `/sales` | ✔ prebuilt `public/data/sales/` (0.9 MB) | Build and host it, then embed at 1440 × 810 |
| Mirelo Sales & Revenue | `mirelo-sales/power-bi/` | PBIP | ✔ loaded model; Parquet in `mirelo-sales/data/parquet/` | Publish, then embed |
| Mirelo Sales & Revenue | `mirelo-sales/data/` | Parquet + generator + control totals | ✔ | Source for the PBIP refresh; not embedded |
| Nordmark Exec | `nordmark-exec/js-app/` | Standalone Next.js 16 app | ✔ prebuilt `public/data/` (452 kB) | Build and host it, then embed at 1440 × 810 |
| Nordmark Exec | `nordmark-exec/power-bi/` | PBIP | ✔ loaded model; Parquet in `nordmark-exec/data/parquet/` | Publish, then embed |
| Nordmark Exec | `nordmark-exec/data/` | Parquet + generator + control totals | ✔ | Source for the PBIP refresh; not embedded |

The P&L also has a Microsoft Fabric (Rayfin) app. It needs an Entra sign-in, so it can't be embedded on a public page. It isn't in a pack. Decided 2026-10-22: the site shows a video of it, and the JS app is the public P&L embed.

## Order of work

1. **JS apps:** in each `*/js-app/`, run `npm ci && npm run build && npm start`.
   - Set `EMBED_ALLOWED_ORIGINS` **at build time** to the origins that may frame the app (for example `https://vosk.dev,https://www.vosk.dev`). The CSP `frame-ancestors` header is compiled into the build. Without this variable only same-origin framing works.
   - `NEXT_PUBLIC_SITE_URL` is optional.
   - This corrects the 2026-10-28 note, which named `NEXT_PUBLIC_SITE_URL` as the only variable.
2. **Power BI:** open each `*/power-bi/*.pbip` in Power BI Desktop. It opens **with data**, because the model cache is in the pack, so no refresh is needed. Publish it as it is to the USER's Power BI account, then embed it.
3. **Embed:** all reports are designed at 1440 × 810. No assumptions about the host page.

## Rules for the receiving repo

1. **Do not edit the packs in place to fix the reports.** Report the issue back through `.sync/`. The fix lands in rusloc/pnl and the pack is re-issued.
2. **Publish the loaded model; don't schedule a refresh.** The models read local Parquet files, so a refresh in the service would need an on-premises gateway. A published report is a snapshot: a data change means re-pack and re-publish.
3. **`DataFolder` is a placeholder.** It matters only for a refresh in Desktop. If you refresh, set it to the pack's Parquet folder, and don't commit a machine path back.
4. **No IDs or secrets in `.sync/`.** Workspace, report or tenant IDs of the published reports stay in the vosk.dev repo's own config.
5. **AI chat is deferred** (USER, 2026-10-28). Ignore the chat notes in this folder, which are marked deferred in the index.

## Per report

- **P&L:** unchanged since 2026-10-28 apart from the loaded model in the PBI pack. JS 196 tests; PBI 23 test blocks, T-06 552 / 552.
- **Mirelo:** content is shipped as is (USER 2026-10-30). Open items are listed in `mirelo-sales/js-app/README.md`: the L11 placeholder, no cross-filtering, and three open questions.
- **Nordmark Exec (new):** a 12-card executive dashboard with:
  - a period picker (Week / Month / Quarter / Year → FY → item; default Week 43 FY2026);
  - comparators Budget / Last year / Previous;
  - Region and a Category filter (All, one category or a mix; EBITDA and Supplier OTIF are N/A under a category);
  - ⓘ pop-ups with stacked Actual and Budget / Target figures.

  Both flavours reconcile to the same control totals (26,143 + 10,514 rows). Accepted platform differences are listed in each README.

## Superseded

- `2026-10-28-report-packs.md` → this note.
- `track-c/data/` → `pnl/js-app/public/data/`.
- `2026-10-26-mirelo-sales-track-c-draft.md` → `mirelo-sales/js-app/`.
- The dated Track C notes of 2026-10-22 … 27 remain valid as background on behaviour and URL keys; the pack READMEs are the current build reference.
