# ACME Unified P&L — standalone JS app (Track C)

- **From:** rusloc/pnl (Track C, nerd)
- **To:** vosk.dev repo agent
- **Date:** 2026-10-28
- **Status:** ready

A complete, standalone Next.js 16 app: copy this folder into the vosk.dev repo, `npm ci`, build, host and embed it. It replaces vendoring from `js-report/` in rusloc/pnl. The source of truth stays in rusloc/pnl (`js-report/`); this folder is a copy of the P&L part of it as of 2026-10-28, with the changes listed under "Differences from js-report/". The AI chat is **not** in this pack (deferred by the USER on 2026-10-28).

## What is inside

| Path | What |
|---|---|
| `app/` | App Router shell: `layout.tsx` (IBM Plex via `next/font`, metadata), `page.tsx` (static page with a Suspense boundary), `globals.css` (Ledger tokens) |
| `components/` | UI: `Shell.tsx` (the only client root), statement table, filter rail, flyouts, company picker, header, the Vitals / Analysis / Profitability views (`views/`), glass pop-ups (`glass.tsx`), chart scale helpers |
| `lib/engine/` | Framework-free P&L engine (spec §7): time windows, versions, FX, C-31 allocation, intercompany, bridges, view models, notices, all UI copy |
| `lib/data/` | Parquet loader (`hyparquet`) and the Zod manifest contract |
| `lib/state/` | URL state (F-37 shareable link): Zod-validated codecs for the selection and the view keys |
| `lib/test-utils/` | Node-side loader and default selection for the tests |
| `public/data/` | Prebuilt data, **committed** (see Data) |
| `fixtures/checks/control_totals_usd.csv` | Expected totals from the generator, used by the T-06 test |
| `scripts/csv.ts` | RFC 4180 CSV reader used by the T-06 test (plus its own test) |
| `next.config.ts` | Security headers and CSP (see Embed) |

Stack: Next.js 16.4.2 (App Router, Turbopack, `cacheComponents`), React 19.3, TypeScript 5.9 strict (`noUncheckedIndexedAccess`), Zod 4, hyparquet, Vitest 5, ESLint 9 (`eslint-config-next`). Node 24 or later (`engines`).

## Run

```bash
npm ci
npm run dev          # http://localhost:3000
npm run typecheck    # next typegen && tsc --noEmit
npm run lint
npm test             # Vitest
npm run build        # next build: / is static
npm start            # next start
```

There is no `prebuild` step: the data is already in `public/data/`.

## Environment variables

| Name | Read | Meaning |
|---|---|---|
| `EMBED_ALLOWED_ORIGINS` | `next.config.ts`, **at build time** (the headers are compiled into the build) | Comma-separated bare origins allowed to frame the app, for example `https://vosk.dev,https://www.vosk.dev`. Must be https (`http://localhost` and `http://127.0.0.1` are allowed for local tests). A malformed entry fails the build. Empty means same-origin framing only. |
| `NEXT_PUBLIC_SITE_URL` | client, inlined at build | Public URL of the deployment: base for "Copy link" and `metadataBase`. Client-safe by design. Optional: without it, "Copy link" uses the page's own origin. |

There are no secrets in this app.

## Embed

- Embed with an `<iframe>`. The app assumes nothing about the host: no `postMessage`, host CSS, auth, cookies or storage.
- Board: checked at a 1440 × 810 viewport (every view and sub-page, no page scroll, nothing outside the window). The app is usable from 1024 px wide (N-09: `body { min-width: 1024px }`). The host sizes or scales the frame.
- Headers (`next.config.ts`, on every path): `Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'self' <EMBED_ALLOWED_ORIGINS>; base-uri 'self'; form-action 'none'; object-src 'none'`, plus `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(), microphone=(), geolocation=()`. There is no `X-Frame-Options` (it would block the embed; `frame-ancestors` replaces it) and no `X-Powered-By`. `'unsafe-inline'` for scripts covers Next's inline hydration scripts; per-request nonces are not built.
- Fonts (IBM Plex Sans and Sans Condensed) are self-hosted by `next/font` at build time. The build needs network access to Google Fonts once; there are no third-party requests at runtime.
- Data fetches are absolute (`/data/<file>`, in `components/Shell.tsx`). A `basePath` deploy has to prefix them.
- "Copy link": an iframe needs `allow="clipboard-write"`; when the clipboard is blocked, the app shows the link in a read-only field.
- URL state (defaults omitted, every key Zod-validated, invalid values rewritten to the default, unknown keys dropped): see `../../2026-10-22-track-c-handoff.md` §5 (engine API in §4), `../../2026-10-23-track-c-parity-fixes.md` and `../../2026-10-27-track-c-pnl-views-redesign.md` §3 in this `.sync/` folder. Those notes describe the same code; read their `js-report/` paths as paths in this folder.

## Data

| File | Bytes | Load |
|---|---:|---|
| `public/data/manifest.json` | 104,008 | first load |
| `public/data/ops.parquet` | 130,499 | first load |
| `public/data/pl-P.parquet` | 1,154,995 | first load (default company) |
| `public/data/pl-S.parquet` | 331,039 | when Commerce Cloud is picked |

First load 1.39 MB; total 1.72 MB.

**Provenance.** Built by `js-report/scripts/build-data.ts` in rusloc/pnl from the dummy dataset `data/acme_pl_dummy_data/` (CSV, spec §8): pre-aggregated to month × version × region × channel × line × segment × account, the superseded forecast cycle FC2606 is not shipped. The build checks T-07, the read-back round trip and the allocation parity against `fact_pl_allocated`. `fixtures/checks/control_totals_usd.csv` is the generator's `checks/control_totals_usd.csv`.

**Rebuild the data in rusloc/pnl, not here:** run `npm run build:data` in `js-report/`, then copy the four files above (and the control totals, if the generator changed) into this pack. The build script and its CSV source are not in this pack on purpose.

This copy supersedes `../../track-c/data/` (2026-10-22): the three Parquet files are identical, but that `manifest.json` is older.

## Tests

`npm test`: **16 files, 196 passed, 1 skipped** (2026-10-28).

- T-06: 552 rows of `control_totals_usd.csv` (P, S, GROUP × 8 windows × 23 lines), each within 0.01 USD.
- Engine: time windows, versions, FX, spine, notices, period and header copy, the views redesign (Vitals, Analysis, Profitability) against the control totals; URL codecs; formats; server render of the statement and the page top.
- Skipped: the cross-check of the statement labels against Track B's `bm_pl_expand` bookmark (`lib/engine/spine.test.ts`). It reads the PBIP report in rusloc/pnl and skips when that file is absent, as it is here.

## Not in this pack

- **AI chat** (ADR-0009 §4): deferred by the USER on 2026-10-28. `lib/chat/`, `scripts/export-chat-tools.ts` and the `export:chat-tools` script are left out; the chat notes in `../../` are marked deferred. Do not build the relay.
- Data build (`scripts/build-data.ts`, `hyparquet-writer`), the B vs C parity harness and the ⓘ copy export: they stay in rusloc/pnl.
- The Mirelo `/sales` route: separate app in `../../mirelo-sales/js-app/`.
- Not built in the app itself: the Group view and slice filters (Track C build steps 4 and 5), and the parts of the views left off at review (list in `../../2026-10-27-track-c-pnl-views-redesign.md` §6).

## Differences from `js-report/`

- Left out: everything Mirelo (`app/sales/`, `components/sales/`, `lib/sales/`, `lib/data/parquet-columns.ts`), `lib/chat/`, `lib/test-utils/parity/`, `scripts/build-data.ts`, `build-sales-data.ts`, `export-chat-tools.ts`, `export-info-copy.ts`.
- `package.json`: no `prebuild`, `build:data`, `build:sales-data`, `export:*` scripts; no `hyparquet-writer`. The lockfile is regenerated to match.
- `public/data/` is committed (in `js-report/` it is build output, ignored by `public/data/.gitignore`, which is not copied).
- `lib/test-utils/public-data.ts`: `DATA_DIR` points to `fixtures/`; the missing-file message no longer says to run `build:data`.
- Code comments that mention `scripts/build-data.ts` refer to the file in rusloc/pnl.

## Checks run on this folder (2026-10-28)

- `npm run typecheck`, `npm run lint`: clean.
- `npm test`: 16 files, 196 passed, 1 skipped.
- `npm run build`: `/` static.
- `next start`: `/` and `/data/*` return 200; headers as above. Headless Chromium at 1440 × 810 on the statement, Vitals (Commerce Cloud), Analysis page 2 and Profitability: no console or CSP errors, no page scroll, and pixel-identical to `js-report/` at the same URLs.
