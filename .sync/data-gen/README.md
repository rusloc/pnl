from rusloc/pnl (ginee) · to vosk.dev repo agent · 2026-10-30 · status: ready

# Data generation for the Power BI packs

The data and the Power BI model caches are not in git (USER 2026-10-30). The three PBIPs in `../pnl/power-bi/`,
`../mirelo-sales/power-bi/` and `../nordmark-exec/power-bi/` ship without data. This folder holds the scripts that rebuild the exact
Parquet files each PBIP imports. Generate the data, point the PBIP's `DataFolder` parameter at it, refresh in Power BI Desktop, check,
then publish.

The JS apps (`../*/js-app/`) are not affected. They ship their own small prebuilt `public/data/` and build without this folder.

Verified 2026-10-30 by ginee: every generator below, run from this folder into an empty folder, reproduced the files the packs
shipped until 2026-10-30 byte for byte (P&L 23 Parquet + 28 CSV, Mirelo 18 Parquet + `manifest.json` + 20 CSV, Nordmark 18 Parquet +
`manifest.json`, and every committed control-totals CSV). `mirelo-sales\checks\verify.py` printed ALL CHECKS GREEN (47 checks) and
`nordmark-exec\checks\verify.py` ALL CHECKS GREEN (91 checks, including the byte-identical rerun ET-20).

## Layout

| Path | Committed | What |
|---|---|---|
| `requirements.txt` | yes | Python pins for all three generators |
| `pnl/generator/` | yes | `generate.py` (runs both steps), `gen_data.js` + `engine.js` (CSV generator, Node), `load_acme_pl.py` (CSV → Parquet: strict parse, types, checks, derived columns and `fact_pl_elim`) |
| `pnl/checks/control_totals_usd.csv` | yes | Expected USD totals (552 rows, spec T-06); the model also imports it as table `control_totals_usd` |
| `mirelo-sales/generator/` | yes | `generate.py` (seed 20261026) + `requirements.txt` |
| `mirelo-sales/checks/` | yes | `verify.py` (47 checks), `control_totals_eur.csv` (2,396 rows) |
| `mirelo-sales/README.md` | yes | Data contract: tables, grain, columns, rules |
| `nordmark-exec/generator/` | yes | `generate.py` (seed 20261028) + `requirements.txt` |
| `nordmark-exec/checks/` | yes | `verify.py` (91 checks), `control_totals_eur.csv` (26,143 rows), `control_totals_category_eur.csv` (10,514 rows) |
| `nordmark-exec/README.md` | yes | Data contract: tables, grain, columns, rules |
| `<report>/parquet/` | no (generated) | The Parquet files the PBIP imports (= `DataFolder`) |
| `pnl/facts/`, `dims/`, `params/`, `checks/_counts.json` · `mirelo-sales/dims/`, `facts/`, `params/` | no (generated) | CSV outputs |
| `.venv/` | no | The Python environment |

The control totals stay committed: they are small, the tests and `verify.py` read them, and a regeneration rewrites them byte for
byte, so a changed control-totals file in `git status` means the generator or its environment changed. Everything else a generator
writes is ignored by the repo `.gitignore`.

## Requirements

- Python 3.12 (tested with 3.12.10) and the pins in `requirements.txt`: numpy 2.5.4, pandas 2.3.3, pyarrow 26.0.0. Byte-identical
  output depends on these exact versions. pandas 3.x was blocked by Windows Application Control on the source machine; stay on 2.3.3.
- Node.js 18 or later on `PATH`, for the P&L CSV generator only (tested with 24.19.0). It uses no npm packages.
- A current Power BI Desktop that opens Power BI Projects (`.pbip`) with a TMDL model and a PBIR report.

Set up once (PowerShell, in this folder):

```powershell
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -r requirements.txt
```

## Generate (one command per report, PowerShell, in this folder)

```powershell
.venv\Scripts\python.exe pnl\generator\generate.py              # CSV + 23 Parquet into pnl\ (~10 s)
.venv\Scripts\python.exe mirelo-sales\generator\generate.py     # CSV + 18 Parquet + manifest.json into mirelo-sales\ (~20 s)
.venv\Scripts\python.exe nordmark-exec\generator\generate.py    # 18 Parquet + manifest.json + control totals into nordmark-exec\ (~5 s)
```

Check the data (optional before Power BI, required after any change):

```powershell
.venv\Scripts\python.exe mirelo-sales\checks\verify.py          # 47 checks; ALL CHECKS GREEN, exit 1 on any failure (~16 s)
.venv\Scripts\python.exe nordmark-exec\checks\verify.py         # 91 checks incl. a byte-identical rerun; ALL CHECKS GREEN (~50 s)
```

The P&L generate step checks itself: every CSV is parsed strictly (header, row count, unique keys, no nulls in not-null columns) and
the derived columns are reconciled before anything is written. It ends with `23 of 23 tables written to Parquet and read back.`
and exits 1 on any failure.

| Report | `DataFolder` (default output) | Rows | Power BI pack |
|---|---|---|---|
| ACME Unified P&L | `pnl\parquet` (23 files, 31.8 MB) | 1.25 M fact rows | `../pnl/power-bi/` |
| Mirelo Sales | `mirelo-sales\parquet` (18 files + `manifest.json`, 22.8 MB) | 1.03 M | `../mirelo-sales/power-bi/` |
| Nordmark Exec | `nordmark-exec\parquet` (18 files + `manifest.json`, 15.4 MB) | 0.88 M | `../nordmark-exec/power-bi/` |

- Every generator writes into its own report folder by default (the folder above `generator\`). `--out <folder>` writes elsewhere;
  then `verify.py --data <folder>` checks that folder (Nordmark's ET-20 rerun needs `generator\` inside it, or pass `--no-rerun`).
- The same inputs give the same bytes: rerunning a generator changes nothing.
- Do not rename the Parquet files. The PBIPs read `DataFolder & "\<table>.parquet"` (Nordmark also reads `manifest.json`).

## Load into Power BI and publish (per report)

1. Generate the report's data (above).
2. Open the report's `.pbip` in Power BI Desktop. There is no data cache in git, so the tables are empty. If Desktop offers to
   refresh, cancel: the parameter is still the placeholder `<folder holding the Parquet files>`.
3. Transform data > Manage parameters > **DataFolder** = the full local path of the report's `parquet` folder in this folder, without a
   trailing backslash (for example `<repo root>\.sync\data-gen\pnl\parquet`). Close & Apply, then Home > Refresh.
4. Check: the row counts and `tests/control-totals.dax` as described in the pack's README (every `_pass` TRUE).
5. Publish from Desktop (Home > Publish). The published model is a snapshot of this data. Do not schedule a refresh and do not set up
   a gateway: the source is local files, which the service could refresh only through an on-premises data gateway.
6. Keep machine state out of `.sync/`: saving in Desktop writes your local path into `definition/expressions.tmdl` and a new
   `.pbi/cache.abf` (ignored by git). Put the placeholder back in `expressions.tmdl` before committing anything in the pack.

## Provenance and re-sync

The source of truth stays in rusloc/pnl; the scripts here are unchanged copies, so a re-sync is a plain copy:

| Here | Source in rusloc/pnl |
|---|---|
| `pnl/generator/gen_data.js`, `engine.js`, `pnl/checks/control_totals_usd.csv` | `data/acme_pl_dummy_data/generator/`, `data/acme_pl_dummy_data/checks/` |
| `pnl/generator/load_acme_pl.py` | `fabric-data/lh_raw/load_acme_pl.py` (only its `--parquet-out` path runs here; the lakehouse path needs packages that are not in `requirements.txt`) |
| `pnl/generator/generate.py` | written for this folder: runs `gen_data.js`, then `load_acme_pl.py --parquet-out` on the 23 tables the model imports |
| `mirelo-sales/generator/`, `checks/`, `README.md` | `data/mirelo_sales_dummy_data/` (README with a pack preface) |
| `nordmark-exec/generator/`, `checks/`, `README.md` | `data/nordmark_retail_dummy_data/` (README with a pack preface) |

Data, names and numbers are fictional.
