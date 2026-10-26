# ginee memory — ACME Unified P&L

## Project card
- Client / scope / origin date: ACME Unified P&L showcase (vosk.dev), Tracks A + B data layer / 2026-10-21 / repo not built from pbi-fabric-agent-kit (no context/, _scripts/, validate.py) (source: observed)
- Workspaces, capacity: see CLAUDE.md › Project identity › Workspaces. RAW is a DEV capacity; only lh_raw is relevant there, every other item is a leftover — ignore (source: user)

## Hot facts
- [2026-10-21] Data layer = lh_raw schema `acme_pl`, 28 Delta tables, loaded by local Python (delta-rs), no Spark (cost) — ADR-0003 accepted (source: user)
- [2026-10-21] First load done and verified: 28/28 row counts OK, control total diff 0.00 (source: observed)
- [2026-10-21] SQL endpoint sync took ~15 min after the write; collation case-sensitive (upper-case INFORMATION_SCHEMA) (source: observed)

- [2026-10-26] Mirelo dataset built locally at data/mirelo_sales_dummy_data/ (ADR-0011 draft data home = Parquet folder): 634 k loans, 302 k clients, verify 47/47 green; see data.md (source: observed)
- [2026-10-21] ACME Trucks: local Import PBIP model rebuilt from the live "Time unitilaztion" model, data snapshot in Parquet; KPI measures use RANDBETWEEN (source: observed)

## Items → data.md · Models → models.md · Platform → platform.md

## Open threads
- Mirelo: USER to decide on committing 96 MB of fact_loan CSVs (split in 3) vs gitignoring CSVs / Git LFS; later lh_raw schema mirelo_sales (ADR-0011 (a), not in the draft)
- ACME Trucks: USER Desktop refresh + baseline-live.dax; Q-01 sensitive values (data, DAX literals); propose CLAUDE.md row for workspace Showcase (personal tenant)
- USER to delete 5 unrelated CSVs in lh_raw/Files root (fab rm commands handed over); decide on Files/acme_pl_dummy_data copies
- Verify on MS Learn: Direct Lake decimal mapping
- ACME Unified PnL in RAW: refreshed OK (28 s) via connection acme-lh_raw-sql-dev; T-06 green; T-05 GROUP fails → bip; CLAUDE.md row proposed, not written. Ask USER if acme_gql is the app's
- Per-table docs in docs/model/ not written
- ADR-0008: lh_raw write + verify green; PBIP PQ/columns applied 2026-10-23 (local refresh 14-25 s, +131 MB in memory, hash-encoded doubles). Next: bip fact_pl_elim + measures, local tests, then my service backup/updateDefinition/refresh, re-time via fabric-data/perf

## Handoffs to bip
- [2026-10-23] fact_pl_elim table (partition M + 15 cols, 5 rels: entity, month, version, region, account) + ADR-0008 §4.2 rewrites (_Amt Raw, _Elim Amount, _Bridge Elim Change, KPI IC Eliminated, Bridge Volume); new cols on the 3 facts are in the PBIP
- [2026-10-22] Bridge Value now returns unrounded values (was 4 dp) after the T-05 change: confirm intended
- [2026-10-21] (fixed 2026-10-22, 54/54) T-05 GROUP: comparison + steps 106.30 M short of base NR; ELIM step -106.39 M looks like a level, not a delta
- local_per_usd must be Decimal Number (double) in the model, never Fixed Decimal (ADR-0003)

## Last session
- 2026-10-26 (delegated): Mirelo synthetic dataset generator + verify + README; pandas 3.1 blocked by App Control -> 2.3.3; fact_loan CSV split by year; no Fabric calls, no git
- 2026-10-23 (delegated, evening): ADR-0008 PQ + 3 double cols per fact applied in the PBIP (backups 2058), validator 0/0, TMDL parse OK, local refresh 13.1 -> 14.1-24.9 s, memory 148.6 -> 279.8 MB; encodingHint Value no effect; fact_pl_elim handed to bip
- 2026-10-23 (delegated, later): verify-acme-pl.sql 1-5 green after ~24 min endpoint sync; ADR-0008 §5 load note; fabric-data/perf/ runner + frozen queries; PQ/refresh plan prepared only
- 2026-10-23 (delegated): ADR-0008 §4.1 + §5.1 written; loader derives 3 pre-translated cols/fact (CC cols dropped, §4.3) + fact_pl_elim; T-06 552/552 offline; service baseline: Key figures worst 9.5-12.3 s
- 2026-10-22 (delegated): second update (+KPI Trend), tests green incl. K-24, Q7 timings in models.md
- 2026-10-22 (delegated): updateDefinition of ACME Unified PnL in RAW (measures only), no refresh needed, all tests green, probe timings before/after in models.md; Ops → ops.md
- 2026-10-21 (delegated): Spark notebook rejected → load_acme_pl.py; dry-run + write + SQL verify green. Notebook draft in _removed/.
- 2026-10-21 (delegated): Trucks model export → Trucks.SemanticModel (Import/Parquet), report rebound byPath, live baseline tests self-tested green; read-only on the Service.
- 2026-10-21 (delegated): PnL model created in RAW via REST (create-only); first refresh failed on missing explicit connection; 48 Currency measures listed for fin (CAND-002).
- 2026-10-21 (delegated): USER bound the OAuth2 connection; refresh 28 s OK; T-06 green on the service; REST returns Currency unscaled.
