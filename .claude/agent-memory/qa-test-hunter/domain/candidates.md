<!-- next-id: CAND-003 -->

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
