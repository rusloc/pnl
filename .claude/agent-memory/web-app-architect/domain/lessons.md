<!-- next-id: LSN-003 -->

# Lessons (durable)

### LSN-001 · USER-supplied design mockups carry arithmetic inconsistencies; reconcile them into a binding table with a published change list before the generator starts · 2026-11-04
**Lesson:** an "illustrative" mockup's numbers do not add up across cards (two sightings: Nordmark v5 — YTD label vs the 4-5-4 calendar, GMROI €1,016 m ÷ €376 m impossible under the accepted front-margin definition, sell-through bars unreachable, W31–W39 net-sales bars vs YTD; Paid Acquisition mockup — CPM $1.90 vs $13.3, "75 % land" vs 31 % store CVR, 58 % install → sign-up vs 6,980 total sign-ups, blended-CAC +6.4 % impossible with flat team cost, channel budgets $182.3 k vs plan $176.0 k, brand share 42 % vs 50 % from its own campaign spends, 17 campaign spends summing to $191.2 k vs $188.4 k, payback "month 9" on cohorts 0–5 months old). A story-first generator cannot hit contradictory targets, and builders otherwise discover the contradiction mid-build.
**Why:** the mockup author optimises each card's readability independently; nobody sums them. The fix that worked both times: the ADR keeps every mockup value that is consistent, changes the fewest to restore arithmetic, and publishes the change list (ADR-0013 (e)/(f) + README open points 12–14; ADR-0015 (d) "Where the mockup was changed"), so the USER can overturn a specific change rather than the story.
**Reversal cost:** low — each change is one parameter in the story table.
**Applied at:** `docs/ADR/0013-nordmark-executive-dashboard.md` (e), (f); `data/nordmark_retail_dummy_data/README.md` open points 12–14; `docs/ADR/0015-acme-paid-acquisition-dashboard.md` (d).
**Hits:** 2
**Tags:** mockup, generator, story-first, control-totals, reconciliation
**Confidence:** high
**Last-verified:** 2026-11-04
**Related:** DEC-010, DEC-006
**Status:** active

### LSN-002 · The USER's first-open round rewrites the vitals and the view map within a day; sequence the second flavour after it and keep its engine behind `view.ts` · 2026-11-05
**Lesson:** two showcases in a row changed shape right after the USER's first open of the Power BI flavour — Nordmark (ADR-0013 (k), 2026-10-29: the whole period model, Week/PTD/YTD → granularity + item) and ACME Marketing (redesign round 1, 2026-11-04: eight cards dropped or moved, the six vitals replaced and their Δ basis switched to LY, question lines / captions / footer removed, saved views removed; 2026-11-05: per-vital dynamics, O5/O6 movers window). A JS flavour built in parallel from the spec would have been rebuilt twice; built after the round, it mirrors a settled PBIP (DEC-011). The round also surfaces data-coverage bugs only a real user state finds (Custom from the first day of data → previous period before the data → blank movers).
**Why:** the USER reviews by clicking, not by reading the spec; the spec's card catalogue survives, its layout and wording do not. Pattern that worked: PBI first → first-open round(s) → freeze → second flavour with the PBIP as the reference, copy extracted verbatim, engine faces isolated in `view.ts` so the next round touches no metric code.
**Reversal cost:** low — it is a sequencing choice; parallel builds remain right when the USER has already approved a prototype (Nordmark v5 was approved before build, yet (k) still happened).
**Applied at:** ADR-0015 (a) as amended 2026-11-05 (phase 4 after the rounds); `docs/ADD/features/marketing-js-flavour.md` §8 note "expect a redesign pass … keep the engine untouched"; ADR-0013 (k) and the PBIP README change log as the evidence.
**Hits:** 2
**Tags:** sequencing, first-open, redesign, two-flavours, parity, view-layer, pbi-reference
**Confidence:** high
**Last-verified:** 2026-11-05
**Related:** DEC-011, DEC-006, LSN-001
**Status:** active
