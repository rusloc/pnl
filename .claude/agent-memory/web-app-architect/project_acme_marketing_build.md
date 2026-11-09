---
name: project-acme-marketing-build
description: ACME paid-acquisition (marketing) dashboard — PBI flavour built 2026-11-04/05 (reference); JS flavour `js-marketing/` being built here from the 2026-11-05 contract; parity gate then pack; what to re-confirm
type: project
---

ADR-0015 (`docs/ADR/0015-acme-paid-acquisition-dashboard.md`, still Proposed) and `docs/Requirements-marketing.md` were drafted 2026-11-04 on archi defaults; phase 1 (ginee generator, 27 tables, 28,660 control rows) and phases 2–3 (bip PBIP, 469 measures, 29 DAX blocks) landed the same day; the USER's redesign round 1 (2026-11-04) and the 2026-11-05 changes (per-vital dynamics pop-up, O5/O6 last-30-days movers window) reshaped the page. **2026-11-05 the USER decided: build the JS flavour here (`js-marketing/`), the Power BI report is the reference** — ADR-0015 (a) amended to alternative 1; contract `docs/ADD/features/marketing-js-flavour.md` (archi); nerd scaffolded the app the same day and builds from the contract; hunter writes `js-marketing/lib/test-utils/parity/parity_selections_marketing.csv` (PA-01 … PA-14); bip mirrors `copy.ts` ↔ `dim_card` at the sync points.

**Why:** the USER saw the page and wants the PBI = JS gate before the pack (Nordmark way, ADR-0013 (j)); the PBIP already settled every rule the JS must mirror.

**How to apply:** the precedence is data README → PBIP as built → Requirements-marketing → ADR-0015 → spec; if the PBIP changes again (another first-open round), amend the contract §3.11 / §5 and the A-nn lines, never the engine rules by inference. Open before the pack: ADR-0015 §5 q 15 (JS taller than 810 px — default yes), q 16 (dark now — default tokens now), q 17 (pack with prebuilt `public/data/` per ADR-0014 — default with), q 18 (creatives card — default none), q 19 (O6 click navigates — default yes); still open from 11-04: q 2 scale, q 3 gross margin 36.3 %. The pack `.sync/acme-marketing/js-app/` is issued only after hunter's 0-gap parity run; the hand-off note then gets its `js-app/` row and status ready. The three engine rules most likely to drift: `_Mv Start` movers window, the four cohort month rules behind O2 / V6 (R90, churn, D7/D30 month, refund months), status-default / cross-filter / unfiltered-ALL team-cost scope semantics.

**Expires:** 2027-01-05 (re-confirm; the JS build and parity should be done well before)
