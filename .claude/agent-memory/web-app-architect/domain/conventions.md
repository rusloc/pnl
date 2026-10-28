<!-- next-id: CNV-002 -->

# Conventions (inductive)

### CNV-001 · Showcase PBIPs import local Parquet through a `DataFolder` text parameter; lakehouse switch = parameter change only · 2026-10-28
**Pattern:** `expressions.tmdl` holds a `DataFolder` text parameter (default = absolute repo path of `data/<dataset>/parquet`); every table partition is `Parquet.Document(File.Contents(DataFolder & "\<table>.parquet"))` + explicit `Table.TransformColumnTypes`; derived columns (month keys, pre-translated amounts) are added in Power Query on load (ADR-0008 analogue); a later move to `lh_raw` replaces only the partition sources with the `SqlEndpoint` / `Database` parameters of the P&L model. No Fabric item, connection or refresh cycle needed for a draft.
**Where seen:** `pbi-report/ACME Trucks/Trucks.SemanticModel` (first use, 2026-10-2x) · `pbi-report/Mirelo Sales/Mirelo Sales.SemanticModel` (README "Data source", built 2026-10-27, ADR-0011 (b)). Prescribed again for `pbi-report/Nordmark Exec/` in ADR-0013 (b)(g).
**Why it works:** keeps the PBI flavour portable (no tenant dependency in a `.sync/` pack), typed and small vs CSV, same files the JS flavour's build reads; Desktop needs an absolute path, so builders on another machine change the parameter (documented in each PBIP README).
**Reversal cost:** low
**Hits:** 2
**Tags:** pbip, parquet, power-query, data-home, portability, showcase, sync-handoff
**Confidence:** medium
**Last-verified:** 2026-10-28
**Related:** DEC-005
**Status:** active
