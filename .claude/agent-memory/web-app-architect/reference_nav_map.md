---
name: nav-map-missing
description: The archi agent prompt's "required reading" docs/architecture/app_nav_map.md does not exist in this repo; nav/layout truth lives elsewhere
type: reference
---

`docs/architecture/` does not exist in rusloc/pnl (checked 2026-10-23). The agent prompt's required reading `docs/architecture/app_nav_map.md`, `docs/architecture/DESIGN.md`, `docs/architecture/decisions/` and `docs/architecture/anti-patterns.md` are generic paths; this repo's equivalents are `docs/ADR/` (ADRs), `docs/ADD/` (design docs, `anti-patterns.md`, `tech-stack.md`), `docs/design/design-requirements.md` (Ledger guide) and, for nav structure, ADR-0004 (one-window layout, Tracks A + B) + ADR-0002 §2.5 (Track C views/tabs) + ADR-0007 (simplified statement). Don't look for the nav map again; read those.
