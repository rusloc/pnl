---
name: project-acme-marketing-build
description: ACME paid-acquisition (marketing) dashboard build — ADR-0015 Proposed 2026-11-04 on archi defaults while the USER is away; PBI flavour here, JS via pack; what must be re-confirmed before phase 2
type: project
---

ADR-0015 (`docs/ADR/0015-acme-paid-acquisition-dashboard.md`) and `docs/Requirements-marketing.md` were drafted 2026-11-04 from the USER spec bundle `pbi-report/ACME Marketing/paid-acquisition-dashboard/`; the USER was away, so every decision is a bold default (14 open questions in §5).

**Why:** USER request 2026-11-04: build the analytical digital-marketing report, generate data into Parquet, keep the generator for "another agent". Defaults follow ADR-0013 (b)–(c) and ADR-0012.

**How to apply:** before phase 2 (model + Overview/Channels/Campaigns) check with the USER: q1 flavours (PBI only here vs both), q2 scale (mockup ≈ $190k/30 d vs ×4), q3 gross margin (36.3 % keeps the mockup's payback 10.8 / LTV:CAC 3.4; 75 % changes the story). Phase 1 = ginee generator (`data/acme_marketing_dummy_data/`, seed 20261104, binding story table ADR-0015 (d)); phase 2–3 = bip. Pack `.sync/acme-marketing/` + `.sync/data-gen/acme-marketing/` only after phase 3. If the USER overturns a default, amend ADR-0015 inline (the ADR-0013 (k)–(m) style) and the A-nn / AT-nn that cite it.

**Expires:** 2027-01-04 (re-confirm; the build should be past phase 2 by then)
