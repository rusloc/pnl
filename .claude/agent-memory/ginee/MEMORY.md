# ginee memory — ACME Unified P&L

## Project card
- Client / scope / origin date: ACME Unified P&L showcase (vosk.dev), Tracks A + B data layer / 2026-10-21 / repo not built from pbi-fabric-agent-kit (no context/, _scripts/, validate.py) (source: observed)
- Workspaces, capacity: see CLAUDE.md › Project identity › Workspaces. RAW is a DEV capacity; only lh_raw is relevant there, every other item is a leftover — ignore (source: user)

## Hot facts
- [2026-10-21] Data layer = lh_raw schema `acme_pl`, 28 Delta tables, loaded by local Python (delta-rs), no Spark (cost) — ADR-0003 accepted (source: user)
- [2026-10-21] First load done and verified: 28/28 row counts OK, control total diff 0.00 (source: observed)
- [2026-10-21] SQL endpoint sync took ~15 min after the write; collation case-sensitive (upper-case INFORMATION_SCHEMA) (source: observed)

- [2026-10-21] ACME Trucks: local Import PBIP model rebuilt from the live "Time unitilaztion" model, data snapshot in Parquet; KPI measures use RANDBETWEEN (source: observed)

## Items → data.md · Models → models.md · Platform → platform.md

## Open threads
- ACME Trucks: USER Desktop refresh + baseline-live.dax; Q-01 sensitive values (data, DAX literals); propose CLAUDE.md row for workspace Showcase (personal tenant)
- USER to delete 5 unrelated CSVs in lh_raw/Files root (fab rm commands handed over); decide on Files/acme_pl_dummy_data copies
- Verify on MS Learn: Direct Lake decimal mapping
- ACME Unified PnL in RAW: refreshed OK (28 s) via connection acme-lh_raw-sql-dev; T-06 green; T-05 GROUP fails → bip; CLAUDE.md row proposed, not written. Ask USER if acme_gql is the app's
- Per-table docs in docs/model/ not written
- ADR pending (USER): (a) pre-translated amounts, (b) materialised ELIM rows — notes in models.md 2026-10-22

## Handoffs to bip
- [2026-10-22] Bridge Value now returns unrounded values (was 4 dp) after the T-05 change: confirm intended
- [2026-10-21] (fixed 2026-10-22, 54/54) T-05 GROUP: comparison + steps 106.30 M short of base NR; ELIM step -106.39 M looks like a level, not a delta
- local_per_usd must be Decimal Number (double) in the model, never Fixed Decimal (ADR-0003)

## Last session
- 2026-10-22 (delegated): second update (+KPI Trend), tests green incl. K-24, Q7 timings in models.md
- 2026-10-22 (delegated): updateDefinition of ACME Unified PnL in RAW (measures only), no refresh needed, all tests green, probe timings before/after in models.md; Ops → ops.md
- 2026-10-21 (delegated): Spark notebook rejected → load_acme_pl.py; dry-run + write + SQL verify green. Notebook draft in _removed/.
- 2026-10-21 (delegated): Trucks model export → Trucks.SemanticModel (Import/Parquet), report rebound byPath, live baseline tests self-tested green; read-only on the Service.
- 2026-10-21 (delegated): PnL model created in RAW via REST (create-only); first refresh failed on missing explicit connection; 48 Currency measures listed for fin (CAND-002).
- 2026-10-21 (delegated): USER bound the OAuth2 connection; refresh 28 s OK; T-06 green on the service; REST returns Currency unscaled.
