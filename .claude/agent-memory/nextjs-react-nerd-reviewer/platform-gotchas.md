<!-- next-id: PG-003 -->

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
