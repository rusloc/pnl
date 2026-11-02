# Weekly — 2026-W44 (26 Oct – 1 Nov 2026)

## Summary
- **Mirelo Sales & Revenue built:** dataset (634k loans, verify 47 / 47), design contract, Power BI PBIP and the Track C `/sales` route, both reconciled; P&L redesign assessed — [daily-2026-10-26](../daily/daily-2026-10-26.md)
- **P&L redesign v4 in all three tracks** (Vitals, 2-page Analysis / Profitability) with a B-vs-C parity harness (601 + 833 rows green); Mirelo ADR-0012 clean-ups — [daily-2026-10-27](../daily/daily-2026-10-27.md)
- **Hand-off packs (ADR-0014)** for P&L + Mirelo; Rayfin app deployed (chat deferred); **Nordmark Exec built in both flavours** (ADR-0013) — [daily-2026-10-28](../daily/daily-2026-10-28.md)
- **Nordmark rounds 1–3:** shared scrim, ⓘ target line, Statement / Notes / Horizon removed, period model (Week / Month / Quarter / Year, Previous) in both flavours — [daily-2026-10-29](../daily/daily-2026-10-29.md)
- **Nordmark finished + `.sync` hand-off:** category filter + stacked ⓘ in both flavours, PBI perf ≤ 0.65 s cards; 207 PBI blocks / 50,390 rows, 458 JS tests, parity 0 mismatches; Nordmark packs; hand-off note v2. Late reversal: model caches + data out of git, `.sync/data-gen/` instead — [daily-2026-10-30](../daily/daily-2026-10-30.md)
- **`.sync` fresh-clone acceptance green** (0 blockers, 10 README warnings); hand-off note v3 (draft); the USER found the P&L JS slice filters unbuilt on the site → next goal: P&L fully functional in PBI + JS — [daily-2026-10-31](../daily/daily-2026-10-31.md)
- **Mirelo identical in Power BI and JS:** the owner's 33 changes from vosk.dev (4 rounds) built in both flavours, JS pack ships the full detail data (21.7 MB), PBI 40 blocks / 4,361 rows TRUE checked against the JS engine output; P&L "fully functional" not started — [daily-2026-11-01](../daily/daily-2026-11-01.md)

## Comments
- **Issues:**
  - Power BI test runs are long when strictly serial: the full Nordmark file took ~3 h 50 min. The USER read that as a hang twice.
  - Hand-off decisions flipped within a day: ship loaded models → keep data out of git. The same-day reversal cost a full pack round (≈ 30 min agent time + 112 MB committed to history).
- **Findings:**
  - Desktop drops an Import model's cache when TMDL is edited after a save (CAND-029, now confirmed twice). Setting a parameter in the open model before saving keeps it.
  - A Desktop save re-serializes PBIP text and adds a `.gitignore` that excludes the cache (CAND-033).
  - Perf baselines need a verified cache clear: the 10-29 "9–10 s" was measured warm-path wrong.
  - One SVG frame per card cut the Nordmark cards ~2×, ⓘ ~3.5×.
- **Process:**
  - The USER committed while an agent was mid-round and pulled in half a round (CAND-032). The main agent should state the in-flight paths in every git block.
  - Category applicability checked by two independent agents (docs vs data) caught the OTIF supplier-link question before build.
  - Generators belong in the repo (`tools/`), not the scratchpad (CAND-028 closed).
- **Hand-off gap (2026-10-31):** the entry note listed what each pack holds but not what each report can't do. The P&L JS "not built" line (Group view, slices) stayed in its pack README, and the USER found it on the live site (CAND-034).
- **Ideas parked:**
  - parity capture v2 (ⓘ mini stats, BE / ONLINE, 3+ picks);
  - skip-if-absent Vitest parity test;
  - `.sync` pack script with a staleness test.
- **Week close (2026-11-01):**
  - **Planned vs done:** the plan's North Star (P&L fully functional) yielded to the USER's task #1 (Mirelo changes from vosk.dev), which grew from 10 to 33 changes across 4 rounds during the day. P&L steps 4–5 + PBI deferred controls carry to W45.
  - **Findings:** a dimension with non-unique display names (`dim_agent`) merged leaderboard rows in Power BI silently (CAND-040). Power BI colour-by-measure sees one cell at a time, so a whole-grid scale needs an explicit grid (CAND-036). A JS engine view-model dump made a strong parity oracle for the PBI side.
  - **Process:** a cross-repo note updated in place while it was being worked on (rounds 2–4 landed after round 1 was built); ⚠ markers in the note made the overtaken parts clear. A full day's work sits uncommitted at the close.
