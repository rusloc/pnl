---
name: nordmark-exec-build
description: Nordmark Retail exec dashboard (third showcase) — ADR-0013 Proposed 2026-10-28, v5 approved, build starting in parallel; two flavours (PBI + standalone js-exec/), local Parquet generator, literal dot rule
type: project
---

Nordmark Retail executive dashboard build started 2026-10-28: ADR-0013 (Proposed) + `docs/Requirements-exec.md` drafted by archi; prototype v5 (`docs/design/executive dashboard (reseller)/`) is the approved design target; the USER wants the generator, the PBI flavour (bip) and the JS flavour (nerd) built in parallel, then hunter's parity rows, then a `.sync/` pack for the vosk.dev repo.

**Why:** third showcase after the P&L and Mirelo; the USER decided on 2026-10-27/28: two flavours (no Rayfin), standalone app per report for the `.sync/` hand-offs (DEC-005), local Parquet from a deterministic generator (no `lh_raw`), literal pulse-dot rule (7/3/2 → orange).

**How to apply:** treat (a)(b)(h)(i) of ADR-0013 as settled; do not reopen them. Still open (ADR-0013 §5): flavour naming ("Track A/B" vs "JS/PBI flavour"), calendar anchor (Jan-anchored 4-5-4 recommended — the v5 YTD label "2 Feb" is the inconsistent string), sales grain week vs day (decide before the generator runs), app folder name (`js-exec/` vs `nordmark-app/`), dot edge case (one off-track card may read green under the literal rule), Forecast comparator, PBIP name, design-contract form, status basis (vs Budget only), parity runner copy vs npm workspace, GMROI inputs, v1 defaults. Builders take the generator README as the naming source of truth (ADR-0011 §3 lesson). Any new dependency in `js-exec/` needs USER consent.

**Expires:** 2026-12-28 (re-confirm ADR-0013 status and which open questions were answered)
