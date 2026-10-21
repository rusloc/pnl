---
name: feedback-desktop-open
description: Never edit PBIP files while Power BI Desktop has the report open; diagnose read-only and plan instead
metadata:
  type: feedback
---

Check `Get-Process PBIDesktop` (window title) before any PBIP edit. If the report is open: read-only diagnosis only (DAX queries against Desktop's msmdsrv, pbi-profiler), then stop with a concrete change plan.

**Why:** Desktop overwrites external edits on save; the user may save at any time.

**How to apply:** query-scoped `DEFINE MEASURE` overrides let you prove a rewrite (speed + parity) against the live model without writing — use them to make the plan concrete. No commit attribution of any kind (CLAUDE.md hard rule, 2026-10-21).
