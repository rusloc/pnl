<!-- next-id: AP-003 -->

# Anti-Patterns

### AP-001 · Growing a max-height pop-up without a per-card scroll pass · 2026-10-30
**Symptom:** a design tweak to the ⓘ (new row, bigger type) passes every unit test, but some cards' pop-ups scroll at 1440 × 810.
**Cause:** `.pop` caps at `min(86vh, 820px)` = 697 px at 810 px; content height varies per card and per period (EBITDA tallest); unit tests cannot measure layout.
**Fix:** headless pass after any ⓘ height change: for every card × scenario, `scrollHeight - clientHeight <= 0`; report the overflow in px. Applied 2026-10-30 (main agent): `.pop` `max-height: min(calc(100vh - 32px), 820px)` (778 px at 810) → tallest 723 px, 55 px headroom.
**Seen:** js-exec ExplainPop target line (2026-10-29, EBITDA +15 px); stacked figure block (2026-10-30, EBITDA +26 px, six cards +7 px)
**Confidence:** high
**Last-verified:** 2026-10-30
**Related:** CAND-015
**Status:** active

### AP-002 · Copy that describes the data shape or layout outlives the change · 2026-11-05
**Symptom:** ⓘ / How to read text names a structure that a later change removed: "(draft sample)" after the full data landed; "The binoculars at the right end open their daily dynamics" after the binoculars moved before each vital's label.
**Cause:** the data or layout change is made in code / visuals, the prose that describes it lives elsewhere (copy.ts, dim_card, a textbox) and no test reads it.
**Fix:** in the same change, grep the copy sources for words naming the old shape or position ("sample", "top N", "right end", the old control name). When seeding copy verbatim from another flavour, keep it byte-identical and flag the stale line to the owner instead of fixing it silently.
**Seen:** js-report/lib/sales/copy.ts c11 + p13 (2026-11-02); pbi-report/ACME Marketing howto_overview_text, seeded into js-marketing/lib/engine/copy.ts HOW_TO_READ.text.overview[0] (2026-11-05)
**Confidence:** high
**Last-verified:** 2026-11-05
**Related:** CAND-020
**Status:** active
