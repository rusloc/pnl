# Data (Fabric items by name)

## Facts
- [2026-10-21] lh_raw.acme_pl: 28 Delta tables (4 facts, 12 dims, 11 params, control_totals_usd), version 0, written by fabric-data/lh_raw/load_acme_pl.py; grain/keys in its TABLES spec (source: observed)
- [2026-10-21] Row counts: fact_pl 457,896; fact_pl_allocated 758,364; fact_operational 29,016; fact_fx_rate 288; control_totals_usd 552; dims/params per README (source: observed)
- [2026-10-21] SQL endpoint types: decimal(18,2) amounts, decimal(18,6) fx, decimal(5,4) weight, bit, date, varchar(8000) (source: observed)
- [2026-10-21] Dataset profile: no duplicate keys, full FK + FX coverage, bridge weights sum to 1, no CR/BOM; spine_step text (8a-8d) (source: observed)
- [2026-10-21] lh_raw Files: acme_pl_dummy_data/ (repo copy, no longer read by the load) + 5 unrelated CSVs in root, pending USER delete (source: observed)

## Decisions
- [2026-10-21] Schema acme_pl, full overwrite reload, no V-Order (accepted at this size) — ADR-0003 accepted (source: user)

## Pending
- Per-table docs in docs/model/
