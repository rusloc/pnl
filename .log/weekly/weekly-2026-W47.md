# Weekly — 2026-W47 (16 – 22 Nov 2026)

## Summary
- **11-16:** P&L and Nordmark Exec Power BI synced to the vosk.dev build specs (oracles 4,515 / 1,620 rows, 0 gaps); ADR-0017 (P&L PBI performance) Accepted, P0 + P1 done (pages 6.4 / 1.6 / 7.6 / 2.4 s) — [daily-2026-11-16](../daily/daily-2026-11-16.md)
- **11-17:** P&L Profitability rebuilt to the 2026-11-17 spec, all four views 1280 × 720; P&L pack re-issued; sub-agent `aid` added (roster 9) — [daily-2026-11-17](../daily/daily-2026-11-17.md)
- **11-18:** status check; the USER committed and pushed everything (`c9b44d6`) — [daily-2026-11-18](../daily/daily-2026-11-18.md)
- **11-19 … 11-22:** dull days, no work (backfilled 11-24) — [daily-2026-11-19](../daily/daily-2026-11-19.md) … [daily-2026-11-22](../daily/daily-2026-11-22.md)
- **Open:** ADR-0017 (a) static formats / P2, `lh_raw` reload yes, click-tests of both reports, `gen_report.py` broken.

## Comments
- **Findings:** dynamic / zero-rule format strings keep costing 1.5–3 s of cold page time (CAND-047 → AP-005). A Desktop save of the P&L PBIP silently resets matrix headers and auto-size (CAND-051); click-test without saving.
- **Process:** sub-agent memory landed inside a PBIR `pages/` folder again (CAND-050 → AP-002 sighting); briefs must name the absolute memory path. This rollup was due Friday 11-20 and was written on Tuesday 11-24 with the backfill.
