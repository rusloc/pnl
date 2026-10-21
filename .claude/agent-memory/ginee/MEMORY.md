# ginee memory — ACME Unified P&L

## Project card
- Client / scope / origin date: ACME Unified P&L showcase (vosk.dev), Tracks A + B data layer / 2026-10-21 / repo not built from pbi-fabric-agent-kit (no context/, _scripts/, validate.py) (source: observed)
- Workspaces, capacity: see CLAUDE.md › Project identity › Workspaces. RAW is a DEV capacity; only lh_raw is relevant there, every other item is a leftover — ignore (source: user)

## Hot facts
- [2026-10-21] Data layer = lh_raw schema `acme_pl`, 28 Delta tables, loaded by local Python (delta-rs), no Spark (cost) — ADR-0003 accepted (source: user)
- [2026-10-21] First load done and verified: 28/28 row counts OK, control total diff 0.00 (source: observed)
- [2026-10-21] SQL endpoint sync took ~15 min after the write; collation case-sensitive (upper-case INFORMATION_SCHEMA) (source: observed)

## Items → data.md · Platform → platform.md

## Open threads
- USER to delete 5 unrelated CSVs in lh_raw/Files root (fab rm commands handed over); decide on Files/acme_pl_dummy_data copies
- Verify on MS Learn: Direct Lake decimal mapping
- Per-table docs in docs/model/ not written

## Handoffs to bip
- local_per_usd must be Decimal Number (double) in the model, never Fixed Decimal (ADR-0003)

## Last session
- 2026-10-21 (delegated): Spark notebook rejected → load_acme_pl.py; dry-run + write + SQL verify green. Notebook draft in _removed/.
