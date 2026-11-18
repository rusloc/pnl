# P&L parity oracle: notes

## 2026-11-16 · PBI = web oracle (hunter)

Target: USER decision 2026-11-16 (`docs/ADD/features/pnl-pbi-spec-gap-2026-11-16.md` §11, target 1): the Power BI numbers equal the vosk.dev web report.

**Files**
- `parity_selections.csv` (2026-10-27, 601 rows): kept. It is still the Track C gate run by `parity.test.ts` against this repo's `lib/engine`, which is now behind the web (no custom range, no variance filter, no trends).
- `parity_selections_2026-11-16.csv` (new, 4,514 rows, 21 selections): expected values from the **vosk.dev engine as of 2026-11-16**. No test reads it yet (this repo's engine would fail its new rows). Track B is captured by bip against it.

**Method:** read-only copy of `C:\__VOSK__\src\lib\pnl` + `data\pnl` (Parquet SHA-256 identical to `public/data`), run with tsx; the dumper is `pnl.ts` ported to the new engine API, plus the new families. Scripts are kept locally in `tools/parity-oracle-2026-11-16/` (gitignored), with `RUN.txt`.

**Columns:** the 2026-10-27 set, plus `start_fy` / `start_month` (RANGE only), `cost_sign`, `var_filter` (`dim=code;…` or `none`), `web_query` (the web URL query string), `vs_2026_10_27` (`same` / `new`) and `pbi_field` (our measure or visual, or `TBD-bip`). Units and tolerances as before: amounts in currency units (0.01 for `ct.*`, 0.05 for the rest), ratios and pp as fractions (1e-6), text exact. `null` = the engine shows n/a.

**Against 2026-10-27:** 555 of 601 rows carry over with **0 changed values**. 46 are retired because the web no longer shows them:
- `bubble.*` (24): the growth × margin bubbles were replaced by month-by-month trends (`profitability.ts:117`, `trendsOf` `:210`, 2026-11-15).
- `heat.<line>.colour_gm` (18): the cell colour is now the cell's NR ÷ the largest cell (`profitability.ts:119-136`, 2026-10-31). GM % moved to the column header, so the rows are renamed `heat.<line>.gm` (same 18 values).
- `var.coverage_top8` (4): Top 8 / 12 / All and block grouping are gone; the table lists every leaf with data, ranked by |Δ| (`analysis.ts:385-495`, 2026-10-31). `var.top8_codes` is kept as the first 8 rows of that ranking.

**New since 2026-10-28 (web engine):**
| Feature | Engine | Selections | Metrics |
|---|---|---|---|
| Analysis on one page: all lines + 4-dimension member filter (AND); below-CM lines allocated unless the filter is region only | `analysis.ts:319` dims, `:374` validVarFilter, `:395` alloc, `:475` total, `:495` filter text; `index.ts:184-187` | `*-vf*` (8) + defaults | `var.row.<code>.delta` / `.text`, `var.rank_codes`, `var.filter_text`, `var.footer.*` |
| Profitability trends by region and month | `profitability.ts:210`; `slices.ts:42-78` byMonth; `view-context.ts:65,161` monthly | defaults, S-FY25, ranges | `trend.<row>.growth|cm.<yyyy-mm>`, `*_last`, `trend.note`, `trend.months` |
| Heat colour = cell NR | `profitability.ts:119-159` | defaults, S-FY25, 2 ranges | `heat.<region>.<line>.nr` / `.colour` |
| Custom range (RANGE) | `time-windows.ts:64`; `versions.ts:117-120`; `period.ts:22,163,179,209`; `notices.ts:62-79,108`; `header.ts:148`; `types.ts:8,49` | `*-RNG-*` (5): cross-year, same-year, partial PY, past the close, one month | all families + `hdr.*` |
| Cost sign (F-15), display only, applied in the table component (`statement-table.tsx` text(), `shell.tsx:229`) | not engine | `*-csPOS` (2) vs the defaults | `stmt.<code>.*_text` |
| How-to-read copy (Top / Bottom / Below) | `view-copy.ts:43-68` | not captured (copy) | — |

**Self-checks:** spec `08-validation.md` §4.1a/b base column = `stmt.<code>.base` on all 58 rows; Σ `var.row.*.delta` = `var.total_delta` (every filter); Σ heat cells = `prof.TOTAL.nr`; NR bridge reconciles to `ct.NR`. RANGE metamorphic: Oct 25–Sep 26 = LTM Sep 26, Sep–Sep = MTD, Jul 24–Jun 25 = LTM Jun 25, Jul–Dec 26 = QTD Sep 26 (cut-off), Jan–Dec 25 = FY25, Jan–Sep 26 = YTD Sep 26: totals, bridges and the Profitability table all equal.

**For bip's capture**
- `pbi_field`: 2,224 rows mapped to an existing measure, 1,447 `TBD-bip` (trends, heat colour, variance filter and row texts, statement row count, bridge labels), 843 mapped but on a RANGE selection (needs the custom range first).
- Signed values print with U+2212 (`−$69.5 m`), as the web does.
- Cost sign: only the value columns of cost rows flip (`stmt.*.base_text`, `cmp_a_text`, `cmp_b_text`, `fy_bud_text`, `fy_le_text`); Δ and Δ % keep the signed values.
- CC rates on a cross-year range are the **last month's FY** budget rates (`view-context.ts:104`, subtitle `profitability.ts:176`): `P-RNG-2407-2506` reads "FY2025 budget rates".
- Partial prior year is compared as is (C-04: notice only): `P-RNG-2407-2506` NR vs PY = **+129.0 %** (12 months against 6). This is the same in LTM Jun 2025, so it is not new; it is the contract, but it reads badly. Main agent / USER to judge.
- The 2026-10-27 Track B gaps PV-12 (`var.leaf_count`) and PV-23 (`var.nm_codes`) keep their values: re-check them in the capture.

**What the engine could not produce:** the Group view (not built on the web; `vitals` / `analysis` / `profitability` are single-company), the 63 chat goldens (`chat-golden.csv` is not in this repo), the header status line (it carries the build stamp and the viewer's time zone), and `var.total_fx` as a raw number under a member filter (only the footer text `var.footer.fx`). One quirk, out of reach through the URL: a range with its start after its end gives the right totals but CC rates from the start's year (`selection-schema.ts` swaps the ends, so the UI never sends it).
