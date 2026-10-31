<!-- next-id: CAND-008 -->

# Candidates

### CAND-001 · Live-capture fixture enshrines a since-fixed model bug · first seen 2026-10-23
**Where:** fabric-app/packages/frontend/src/pnl/data/pnl-model-figures.spec.ts ("known T-05 gap ... 106.3 M short", BRIDGE_G captured 2026-10-22); Track B fixed T-05 in the PBIP the same day
**Why interesting:** fixture tests stay green forever; after republish nobody notices the app now adds up (or still doesn't)
**Watch for:** tests asserting a known bug; fixtures older than the last model change; ADR-0006 parity fixtures after ADR-0008 reload
**Tags:** fixture, stale, track-a, t-05, semantic-model
**Promote-to:** defect-patterns.md (or flaky-roots.md) on second sighting
**Expires:** 2027-01-21

### CAND-002 · Cross-repo .sync note superseded but still "ready" · first seen 2026-10-23
**Where:** .sync/2026-10-22-track-c-spec-change-adr-0007.md row 5 still asks for KPI sparklines + target bars (K-24/K-25 removed by ADR-0007 §3a, KPI card v2)
**Why interesting:** the vosk.dev agent builds Track C from it; parity breaks downstream without any test here
**Watch for:** .sync files whose content predates an ADR amendment; README status not flipped to superseded
**Tags:** sync, hand-off, track-c, spec-drift
**Promote-to:** defect-patterns.md on second sighting
**Expires:** 2027-01-21
**Promoted-to:** DEF-006 on 2026-10-31

### CAND-003 · A view's FX basis differs by track (forced CC vs selected basis) · first seen 2026-10-27
**Where:** Profitability: js-report/lib/engine/profitability.ts (always trCC) vs pbi-report ACME `_measures` Prof * / Conc Share / Heat Cell (selected basis; only `Prof NR Δ % CC` forced); PV-02
**Why interesting:** totals differ by the FX effect (S FY2025 NR 655.6 vs 667.4) and each track's own reconciliations still pass
**Watch for:** per-view basis overrides in briefs ("CC by default", "Display flyout still rules"); TREATAS ( param_fx_basis ) on only some columns of one visual
**Tags:** fx, constant-currency, parity, profitability
**Promote-to:** defect-patterns.md on second sighting
**Expires:** 2027-01-25

### CAND-004 · One track ships a placeholder for a metric the other derives from the same data · first seen 2026-10-27
**Where:** Mirelo C6 Days between loans: B `Card C6 SVG` placeholder ("needs previous-loan dates"); C derives the previous disbursed date per client from fact_loan (scripts/build-sales-data.ts `gap`); MS-03
**Why interesting:** "the data doesn't have it" goes unchallenged until the other track proves it buildable
**Watch for:** README "Built vs placeholder" rows; placeholder cards in one track only
**Tags:** placeholder, data-gap, parity, mirelo
**Promote-to:** defect-patterns.md on second sighting
**Expires:** 2027-01-25

### CAND-005 · Cross-track DAX fixture rows generated once, not re-synced after the contract CSV changes · first seen 2026-10-27
**Where:** pbi-report/ACME Unified PnL/tests/control-totals.dax T-P block still expects the pre-decision var.leaf_count (35/38) and var.nm_codes after nerd updated parity_selections.csv (PV-23)
**Why interesting:** the B run reports TRUE against stale expectations, so a closed-looking gap stays open
**Watch for:** T-P rows whose expected differs from the CSV; compare row counts and changed metric ids after every CSV edit
**Tags:** fixture, parity, dax, stale, sync
**Promote-to:** defect-patterns.md (relates to CAND-001) on second sighting
**Expires:** 2027-01-25

### CAND-006 · View-model string differs from the rendered face (CSS-hidden field) · first seen 2026-10-30
**Where:** js-exec/lib/engine/view.ts `card.sub` on small cards vs js-exec/app/globals.css `.sm .ch h3 span {display:none}` (shown again below 1200 px), inherited from the v5 prototype lines 75 / 186
**Why interesting:** an engine-level parity diff (42 rows vs PBI) that does not show on the desktop face. Comparing view models without the CSS gives false (c)s, and comparing only the desktop face hides the responsive divergence
**Watch for:** any parity field the other flavour leaves blank. Check the CSS / size class before classifying it as a mismatch
**Tags:** parity, css, responsive, view-model, nordmark
**Promote-to:** defect-patterns.md on second sighting
**Expires:** 2027-01-28

### CAND-007 · "Byte-identical regeneration" contract rests on unpinned transitive deps · first seen 2026-10-31
**Where:** .sync/data-gen/requirements.txt pins numpy / pandas / pyarrow only; a fresh venv on 2026-10-31 resolved python-dateutil 3.0.0, pytz 2026.6, tzdata 2026.6 (output still byte-identical: 4 control-totals CSVs + 61 Parquet/manifest blobs vs 1062764^)
**Why interesting:** ADR-0014 §3 makes byte-identity the validity proof of the committed control totals; a future tzdata / dateutil release can break it with no code change, and the receiver sees a "changed" control-totals file
**Watch for:** requirements files that pin only top-level packages next to a determinism claim; no `pip freeze` constraints file
**Tags:** determinism, python, pins, data-gen, sync
**Promote-to:** defect-patterns.md (or flaky-roots.md) on second sighting
**Expires:** 2027-01-29
