# Nordmark Exec parity: notes

## 2026-11-16 · PBI = web oracle (hunter)

Target: USER decision 2026-11-16 (`docs/ADD/features/nordmark-exec-pbi-spec-gap-2026-11-16.md` §11, target 1): numbers and texts identical to the vosk.dev web report.

**Engine:** `C:\__VOSK__\src\lib\nordmark\engine\` and `js-exec/lib/engine/` are the same code. A token-level diff (formatting and quotes ignored) shows only the new `URL_KEYS` export (`url-state.ts:17`) and three semicolons. Data byte-identical (cube / opex / po / sites / manifest SHA-256).

**Files**
- `2026-10-30-pbi-faces.csv` (bip's PBI capture, 945 rows) and `2026-10-30-parity-report.md`: kept.
- `2026-11-16-web-faces-expected.csv` (new, 1,620 rows = 12 states × 135 fields): `expected` = the web card face at the 1280 px canvas, `engine_vm` = the raw view-model string, `pbi_2026_10_30` = bip's earlier capture, `vs_2026_10_30`, `pbi_field`.

**Method:** `buildView(d, parseSelection(query))` on a read-only copy of the vosk.dev engine, the same field mapping as on 2026-10-30. The same script run on `js-exec/lib` gives a byte-identical dump. Scripts are kept locally in `tools/parity-oracle-2026-11-16/` (gitignored).

**Against 2026-10-30:** the 7 states (945 rows) are unchanged. 903 rows are the same text, and 42 are the small-card sub-titles: blank on the face (spec `05-pages.md` card row 2, parity-rules "small-card sub-titles"), and the view model still carries them (`engine_vm`). **0 changed.**

**New states (675 rows)**, from the gaps listed in the 2026-10-30 report: `W43 · Budget · BE`, `FY2026-P10 · Last year · ONLINE`, `W43 · Previous · All` (EBITDA ⓘ "vs P9 weeks 1–4", ET-31), `ALL#ELEC+TOYS+HOME` (header "· 3 categories"), and all 9 categories ticked (= the default state, all fields equal).

**For bip's capture**
- Signed zeros are expected text, as the PBI already printed them on 2026-10-30: `−0.0 pp vs budget 30.0%`, `store +0.0 pp vs plan`, `−€0.0m (−0.0%) vs prev. mth`.
- `pbi_field` names the current measure (`[Card Value Text <K>]`, `[Card Delta Text <K>]`, `[Card Status Word <K>]`, `[Card Basis Text <K>]`, `[Window Status Count *]`, `[Window Status Dot]`) or the SVG it is drawn in (title, sub-title, ⓘ label and note).

**Not covered:** ⓘ mini stats, worked examples and eyebrow, bars, drill path, picker texts and `chat-golden.csv` (97 rows, not in this repo). Spec `08-validation.md` §4 (17 frozen views) stays the second oracle for these.
