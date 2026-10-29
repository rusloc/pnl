---
name: cut-redundant-controls
description: USER removes any UI control that duplicates another or yields identical numbers — do not default to "keep both options"; propose the cut
type: feedback
---

When two controls overlap (two comparators giving the same numbers, an attribute filter that mirrors a primary picker, a footer line repeating a value shown above), the USER removes one. Default to the cut, not to "keep both for completeness".

**Why:** Nordmark exec round of 2026-10-29 — four cuts in one day, three of them overturning my "keep both" defaults: "Previous year" hidden at Year (≡ Last year), Horizon attribute removed (duplicates the period-type picker), ⓘ footer "Target budget …" removed (the target now sits under the value), Statement attribute and Notes panel removed earlier the same day. The USER also first asked to drop the comparator entirely before keeping it — the instinct is fewer controls.

**How to apply:** when a spec default has the shape "keep both, identical numbers / overlapping meaning", flip it: propose hiding the redundant one and define the fallback (snap rule, URL normalisation). When sizing labels, prefer the short form everywhere (the USER chose `vs prev. wk / mth / qtr` on every card over a per-size rule). Related: [[visual-first-minimum-text]].
