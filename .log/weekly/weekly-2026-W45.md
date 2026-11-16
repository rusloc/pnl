# Weekly — 2026-W45 (2 – 8 Nov 2026)

## Summary
- **Mirelo PBI:** Filters pop-up closes again; publish path clarified (from Desktop, target workspace open) — [daily-2026-11-03](../daily/daily-2026-11-03.md)
- **ACME paid-acquisition dashboard (ADR-0015):** Power BI flavour built end to end and redesigned in one day; Mirelo PBI aligned to the vosk.dev JS (40-row audit) — [daily-2026-11-04](../daily/daily-2026-11-04.md)
- **ACME Trucks:** redesign page = original page, hand-off pack and synthetic twin (149 checks) — [daily-2026-11-04](../daily/daily-2026-11-04.md)
- **ACME Marketing JS flavour:** built, parity-gated (1,416 rows / 0 gap) and packed; per-vital dynamics pop-ups and the O5 / O6 fix in PBI — [daily-2026-11-05](../daily/daily-2026-11-05.md)
- **No work on 11-02, 11-06, 11-07** (backfilled as empty days); 11-08 logs caught up — [daily-2026-11-08](../daily/daily-2026-11-08.md)
- **ACME Trucks JS flavour (ADR-0016, Accepted):** built, PBI = JS parity 1,649 rows / 0 gaps, pack `.sync/acme-trucks/js-app/` issued as a draft — [daily-2026-11-08](../daily/daily-2026-11-08.md)

## Comments
- **Issues:** nothing from 11-04 or 11-05 was committed during the week. The plans of 11-05 and 11-06 said the git blocks were in the coms files; they existed only in the chat, so they were recompiled on 11-08 (the USER committed them on 11-09).
- **Findings (11-08):** a test that compares a measure with itself has no oracle (CAND-045); a URL cap set by a guessed length silently drops a valid selection (CAND-046).
- **Findings:** a comparison window built from a user-picked range can fall entirely outside the data and blank the rank / delta measures silently (CAND-044). JS rendered 0 where DAX returns BLANK (DEF-007).
- **Process:** this rollup was due Friday 11-06 and was written on Sunday 11-08 with the backfill.
