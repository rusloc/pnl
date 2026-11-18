<!-- next-id: INFRA-003 -->

# Test infra quirks

### INFRA-001 · `it.fails` ratchet for known cross-track gaps · 2026-10-27
**Symptom:** a parity fixture must hold the contract value (parity rule 3: never assert a known bug) yet the suite must stay green while one track is still wrong
**Cause:** a skip hides the gap forever; asserting the current (wrong) value enshrines it (CAND-001 shape)
**Fix / test:** row marker `c_status = gap:<ID>` → `it.fails` asserting the contract value; when the gap is fixed the test fails and forces the marker to `match`. `expect.soft` in the per-selection match test lists every mismatching row. Pitfall: a gap row whose contract value coincides with the wrong implementation (status codes often do) passes, so it.fails fails: mark such rows match (seen: Mirelo c5.chip). js-report/lib/test-utils/parity/parity.test.ts
**Seen:** js-report/lib/test-utils/parity (2026-10-27, Vitest 5.0.5)
**Hits:** 1
**Tags:** vitest, it.fails, ratchet, parity, fixture, known-gap
**Confidence:** low
**Last-verified:** 2026-10-27
**Related:** —
**Status:** active

### INFRA-002 · Running another repo's engine read-only (extensionless imports) · 2026-11-16
**Symptom:** the vosk.dev engine (`C:\__VOSK__`, read-only) uses extensionless imports and `@/` aliases; plain `node` type stripping (used for js-exec on 2026-10-30) cannot resolve them, and running inside the other repo would write caches there
**Cause:** different module conventions per repo (vosk: bundler resolution, double quotes; ours: `.ts` imports)
**Fix / test:** copy `src/lib/<x>` + `data/<x>` into the scratchpad as `w/src/lib/<x>` / `w/data/<x>` (keeps the `../../../../data` URLs valid), `w/package.json` `{"type":"module"}`, junction `w/node_modules` → `js-report/node_modules` (PowerShell `New-Item -ItemType Junction`; `cmd mklink /J` fails from Git Bash quoting), run `node C:\__VOSK__
ode_modules	sx\dist\cli.mjs script.ts`. Skip test-utils that import `@/lib/...`; write your own loader. For "same code?" questions use a TypeScript-scanner token diff or prettier (default width) on both copies + `diff -w`. Scripts: tools/parity-oracle-2026-11-16/
**Seen:** P&L + Nordmark oracle 2026-11-16 (tsx 4.23.15, Node 24.19)
**Hits:** 1
**Tags:** tsx, cross-repo, read-only, oracle, junction, engine-dump
**Confidence:** low
**Last-verified:** 2026-11-16
**Related:** —
**Status:** active
