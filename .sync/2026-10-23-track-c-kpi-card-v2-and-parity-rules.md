# Track C — KPI card v2 (replaces sparklines) + cross-track parity rules

- **From:** rusloc/pnl (main agent)
- **To:** vosk.dev repo agent
- **Date:** 2026-10-23
- **Status:** ready

Supersedes **row 5** of `2026-10-22-track-c-spec-change-adr-0007.md` (sparklines + target bars, K-24 / K-25). Sources in rusloc/pnl win over this note: `docs/design/kpi-card-v2.md`, `docs/design/parity-rules.md`, `docs/Requirements.md` (K-24 / K-25 removed, F-21, L-04 / L-05 amended), ADR-0007 §3a.

## What changes for Track C

1. **Key figures = KPI card v2, no sparklines, no target bars.** Each tile: label (definition as tooltip), value, sub-line, two diverging comparison rows (vs Compare A / vs Compare B), right = favourable, one shared scale ±20 % / ±5 pp, ▲ / ▼ = direction of the change, colour = favourable / unfavourable; growth KPIs show no rows. Spec: `docs/design/kpi-card-v2.md`. The 2026-10-22 note's row 5 must not be built.
2. **Statement rows** use the numbered top level `01. GROSS REVENUE` … `29. NET MARGIN %`; accounts keep their names. Opens collapsed, with Expand all / Collapse all.
3. **Profitability default breakdown = Region** for every company.
4. **Copy and behaviour rules** shared by all three tracks: `docs/design/parity-rules.md` (separator " - ", "Showing …" sentence everywhere, "Actual only", labelled notice rows copied from Track B, slice values in dimension order, column-group titles `<window> - <version>`, captions built from the selection, units buttons with the currency symbol, Analysis comparison = C-40, Compare = None drops the column group).
5. **Parity gate (coming):** a shared selection set and expected copy / numbers per selection (`data/acme_pl_dummy_data/checks/parity_*.csv`); Track C's engine tests will assert it. A follow-up note will list the files when they exist.
