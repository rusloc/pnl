<!-- next-id: INFRA-002 -->

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
