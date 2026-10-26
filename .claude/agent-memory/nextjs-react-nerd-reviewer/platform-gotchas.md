<!-- next-id: PG-005 -->

# Platform gotchas

### PG-001 · Windows Smart App Control blocks native .node binaries · 2026-10-22
**Symptom:** `next` logs "Attempted to load @next/swc-win32-x64-msvc … An Application Control policy has blocked this file" and downloads `@next/swc-wasm-nodejs`; first `vitest run` fails at startup with "Cannot find native binding … @rolldown/binding-wasm32-wasi". A plain retry passes.
**Cause:** OS application-control policy on the USER's Windows 11 box blocks or delays first load of unsigned native addons (swc, rolldown). Not a code or lockfile problem.
**Fix:** none in repo. Retry once; Next falls back to swc-wasm by itself. Do not "fix" it by deleting the lockfile or adding wasm binding packages.
**Seen:** js-report/ scaffold, `next build` + `vitest run` (uncommitted, 2026-10-22)
**Confidence:** medium — swc block reproducible; rolldown only on first run
**Last-verified:** 2026-10-22
**Related:** —
**Status:** active

### PG-002 · Zod 4 union-of-literals is not a number for CSV coercion · 2026-10-22
**Symptom:** A build script that coerces CSV cells by Zod field kind (`instanceof z.ZodNumber`) leaves `natural_sign` as the string "1", and `z.union([z.literal(-1), …])` rejects it.
**Cause:** A union of number literals is a ZodUnion, not a ZodNumber, so kind-driven coercion skips it.
**Fix:** declare such columns as `z.number().int().min(-1).max(1)` (js-report/lib/data/manifest.ts).
**Seen:** js-report/scripts/build-data.ts (uncommitted, 2026-10-22)
**Confidence:** high — reproduced
**Last-verified:** 2026-10-22
**Related:** —
**Status:** active

### PG-003 · CSS-module lookups are `string | undefined` under noUncheckedIndexedAccess · 2026-10-23
**Symptom:** `tsc` fails "Type 'string | undefined' is not assignable to type 'string'" when `styles.foo` is passed to a prop typed `className: string`.
**Cause:** Next's `*.module.css` typing is an index signature; with `noUncheckedIndexedAccess` every lookup may be undefined.
**Fix:** type component `className` props as optional (`className?: string`), never `!` / `as string` on the lookup.
**Seen:** js-report/components/primitives.tsx ChoiceGroup (2026-10-23, uncommitted)
**Confidence:** high — reproduced
**Last-verified:** 2026-10-23
**Related:** —
**Status:** active

### PG-004 · Stopped background `next start` keeps the port on Windows · 2026-10-27
**Symptom:** after TaskStop of a backgrounded `npx next start -p N` and a rebuild, a new `next start` dies with EADDRINUSE; the orphaned server keeps serving a mix of old and new `.next` output, so a headless check fails with a timeout that looks like a code bug.
**Cause:** stopping the npx shell does not kill the node child on Windows.
**Fix:** before restarting, free the port (PowerShell, only for your own server): `Get-NetTCPConnection -LocalPort N -State Listen | % { Stop-Process -Id $_.OwningProcess -Force }`. Also: never put backticks inside a double-quoted bash `node -e` string, because bash runs them as commands.
**Seen:** js-report /sales headless checks, 2026-10-27 (twice in one session)
**Confidence:** high — reproduced
**Last-verified:** 2026-10-27
**Related:** PG-001
**Status:** active
