---
name: project-track-b-copilot
description: Power BI Copilot / data agent findings for Track B (2026-10-23 research for ADR-0009): public-site availability, model prep blockers, RLS caveats
metadata:
  type: project
---

- [2026-10-23] No Copilot chat (report pane, standalone, app, data agent) works for anonymous visitors: Publish to web has no Copilot, app-owns-data has no Copilot pane; only the Copilot *narrative visual* supports app-owns-data (preview, May 2026). Secure embed has an "Enable Copilot" checkbox but every viewer signs in. (source: Learn, observed)
- [2026-10-23] Copilot needs paid F2+/P1+ (no trial), tenant switch on; North Europe is inside the EU Data Boundary, so no cross-geo switch. CU: 100 CU-s per 1k input tokens, 10 cached, 400 per 1k output, background (24 h smoothing). (source: Learn)
- [2026-10-23] Main prep blocker in our model: time / version / entity / currency come from disconnected param tables via SELECTEDVALUE defaults, and `_Amt Window` uses ALL(dim_month ...), so a Copilot query that filters dim_month gets the default window. Copilot data questions also ignore page slicers. Needs AI instructions that steer it to param tables, or an ADR for Copilot-friendly measures. (source: observed in TMDL)
- [2026-10-23] Verified answers break on hidden fields, slicers are not carried, max 3 filters, no CI/CD (Git / pipelines) for them. Prep data for AI requires Q&A on; Q&A retirement is Dec 2026 (MC1218421) or Feb 2027 (Learn verified-answers page), the sources conflict. (source: Learn)

**Why:** ADR-0009 option D (Track B Copilot) and the vosk.dev showcase decision depend on this.
**How to apply:** Before any Copilot prep work, re-check the Learn pages (they change monthly), and run the Track B DAX test set against Copilot answers for the hero questions. Related: [[project-track-b-engine]].
