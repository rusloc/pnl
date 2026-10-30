<!-- next-id: AP-002 -->

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
