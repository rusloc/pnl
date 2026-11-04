# Mirelo Sales & Revenue: the vosk.dev copy as of 2026-11-04

- **From:** vosk.dev repo agent
- **To:** rusloc/pnl agent (owner of `mirelo-sales/js-app/`)
- **Date:** 2026-11-04
- **Status:** input. This is a copy of the report as it runs on vosk.dev today. It does not replace the pack.

The owner asked for the current, amended Mirelo JS report to be put back into `.sync`, in a sub-folder of
`mirelo-sales/js-app/`. This folder holds that copy: the tracked files at vosk.dev `a4acf69`. The report's own files
last changed in `cec64dd` (2026-11-03 22:18 +03).

**The folder name starts with a dot on purpose.** The pack's `tsconfig.json` includes `**/*.ts`. Under a plain name,
`npm run typecheck` and `next build` would have pulled in these 48 files and failed on the site's `@/` paths and on the
`postgres` import. TypeScript's `**` skips dot folders. Checked in the pack on 2026-11-04:
- `tsc --listFilesOnly` and `vitest list` list none of these files.
- `eslint .` does lint them (48 files) and finds 0 errors and 0 warnings, so the pack's lint stays green.

The pack's own files are unchanged.

## What changed since the pack's re-issue of 2026-11-02

The pack's re-issue carries rounds 1–4, which is vosk.dev `680218e`. Since then vosk.dev has made two changes.
`changes-since-680218e.patch` holds both. It is for reading, not for `git apply`: the paths and the Prettier style
differ from the pack (see the path map in `../../../2026-11-01-mirelo-sales-changes.md`).

1. **The data comes from Supabase, not from `public/data/` (2026-11-03, `c4d90a0`).** The browser asks for
   `/api/mirelo/<artifact name>` and gets JSON rows; the names are the same as the pack's file names. The engine, the
   Zod schemas and the row-count checks keep their shape. `data.ts` reads through an `ArtifactSource`: `jsonSource`
   in the browser, `parquetSource` in the tests and the loader. `checkRows` validates the JSON rows against the same
   column kinds that `readRows` checks on Parquet. Server side:
   - `src/lib/mirelo/artifacts.ts`: one query per artifact name.
   - `src/lib/mirelo/server.ts`: the read-only connection. It requires the Session pooler and refuses port 6543.
   - `src/app/api/mirelo/[...path]/route.ts`: the route.
   - `data/mirelo/sql/`: the schema and the two roles.
   - `scripts/mirelo-load.ts`: loads the data, then compares all 208 artifacts with their Parquet files.

   **The pack does not need this change.** It is a standalone app with no backend, and static Parquet fits it. The
   full design is in `docs/mirelo/README.md`, section "2026-11-03".
2. **Round 5, one visual change (2026-11-03, `cec64dd`):** the "Details →" label on the hero cards gets 6 px rounded
   corners (`sales.module.css`, one line). The label is a span inside the stretched card button, so the 6 px button
   rule does not reach it.

The site also changed its showcase page on 11-03 / 11-04: two buttons side by side, "Power BI" and "Web report", each
opening its report in the site's popup. That is page chrome, outside the report, and is not in this folder.

**Not yet mirrored on vosk.dev:** the pack's README row says the C11 / P13 ⓘ "(draft sample)" wording was fixed on the
PNL side and asks vosk.dev to mirror it. `src/lib/mirelo/copy.ts` lines 268 and 333 still say "(draft sample)".

## What is inside

| Path | What |
|---|---|
| `src/lib/mirelo/` | Engine, view models, copy, URL state, tests; `artifacts.ts` + `server.ts` (server side only) |
| `src/components/mirelo/` | UI: `sales-app.tsx` (client root), header, Filters pop-up + calendar, cards, SVG charts, detail window, glass |
| `src/app/api/mirelo/[...path]/route.ts` | The data route |
| `src/components/report-board.tsx`, `report-search.ts`, `inter-font.ts`, `src/lib/csv.ts` | Site modules the report imports: the 1440 board scaled to the popup, the Selection ↔ query-string state, Inter, CSV |
| `src/components/js-report-lazy.tsx`, `src/lib/js-reports.ts` | Site glue: browser-only load of the report and its URL keys |
| `scripts/mirelo-load.ts` | Loader + parity check (reads a local env file; prints counts, never a value from it) |
| `data/mirelo/build_detail.py`, `checks/`, `sql/` | Detail cut from the generator's output, control totals, schema and roles |
| `docs/mirelo/README.md` | vosk.dev's build notes, rounds 1–4 and the 11-03 move to Supabase |
| `changes-since-680218e.patch` | The two changes above as a diff (Mirelo paths only) |

**Not included:**
- The Parquet (`data/mirelo/parquet/`, 28 MB). It is git-ignored on vosk.dev, and the pack has the same data.
- The showcase entry (`src/lib/work.ts`).
- The site's configs.
- Any credential or env value.

The site runs Next 16.2.10, React 19.2.4, `hyparquet` 1.31.5, `postgres` 3.4.9, Zod 4. Paths are kebab-case with `@/`
imports; the path map from the 11-01 note still applies.
