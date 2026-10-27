# Track C — parity fixes (statement, hide empty lines, retired URL keys, copy)

- **From:** rusloc/pnl (Track C, nerd)
- **To:** vosk.dev repo agent
- **Date:** 2026-10-23
- **Status:** ready

Applies `docs/design/parity-rules.md` (accepted 2026-10-23) to `js-report/` on `prod`, after hunter's parity audit. It supplements `2026-10-23-track-c-page-top-and-period-picker.md`; where the two disagree, this note wins. Sources in rusloc/pnl win over both.

## 1. URL state: retired keys

- `lay`, `lens` and `d` (layout, cost lens, detail) are gone from `Selection` and from the codec (ADR-0007 items 1–3). Old links still open: the keys are read as unknown keys, ignored, and dropped by the canonical rewrite. Example: `?lay=TREND_M&lens=NAT&d=FULL&cur=EUR` opens the default view in EUR and the address becomes `?cur=EUR`.
- `bd` (Profitability breakdown) now defaults to `REGION` for every company (F-21, parity rule 4). `ENTITY` stays Group-only; the Group view accepts `REGION` or `ENTITY`.
- `restrictToBuilt(sel)` takes the selection only (the defaults argument went with `detail`). Nothing in the codec or the engine depends on layout, lens or detail any more, so the Group view (build step 4) cannot trip a "not built" error through them.

## 2. Engine API changes (`js-report/lib/engine/`)

| Change | Detail |
|---|---|
| `engine.context()` / `contextLine()` removed | The L-04 context line was replaced by the applied-filters pop-up (previous note); nothing called them. |
| `engine.notices(sel)` → `{ code, label, text }[]` | Track B's notice rows, labels, conditions and text (`_Notice Row`): `N_CLOSE` Cut-off, `N_FORECAST` Forecast, `N_PY` Prior year, `N_LTM` History, `N_ALLOC` Allocation, `N_ELIM` Eliminations, in that order; no row when none applies. Forecast only when the base itself is Latest estimate. |
| `engine.header(sel)` adds `rail: { versions, display }` | Track B's `Rail Sum Versions` / `Rail Sum Display`: `Actual vs Budget, Prior year`, `Actual only`, `USD m - actual rates`. |
| `SpineRow.display` (new) | Statement text: `01. GROSS REVENUE` … `29. NET MARGIN %` (Track B `dim_pl_row[line_display]`); accounts keep their names. `label` stays the plain name. |
| `lib/engine/hide-empty.ts` (new) | `hideEmptyLines(rows, sel, units)`, `isEmptyLine`, `statementColumns(sel)`: M-22 / T-16, see §3. |
| `windowLabel(m, sel)` | Full year reads `Full year 2026` (was `FY2026`), as Track B's `PL Hdr Base`. |
| `periodSummary` | Nothing covered → exactly `Showing no closed month yet` (no time-view tail; parity rule 7). |

## 3. Statement

- **Opens collapsed** (M-20, parity rule 5): all 29 numbered report lines show, no account, as in Track B. **Expand all / Collapse all** buttons sit above the line column. Expansion survives every filter change and resets to collapsed only when the company changes (M-21). Presets: `components/expansion.ts`.
- **Hide empty lines** is live and on by default (M-22): a leaf is hidden when every number it shows rounds to zero in the selected units, on the visible columns only (Compare A's bar counts as its Δ %). Blocks, subtotals, ratios and Operating expenses always show (T-16).
- Column-group titles `<window> - <version>`: `YTD Sep 2026 - Actual`, `Full year 2026 - Budget`.

## 4. Copy

- " - " replaces " · " in all UI copy: rail Display summary, company-picker subtitle, statement line header (`Line - USD m`) and footnote.
- Applied-filters pop-up: notices are labelled `<dl>` rows after Slices (no separate notice box).
- Regions and slice values listed in the dimension's `sort_order` (parity rule 10).
- Units buttons carry the currency symbol: `$m / $k`, `€m / €k`, `£m / £k` (from `param_reporting_currency.symbol`).

## 5. Status

- Gate green in rusloc/pnl: `npm run lint`, `npm run typecheck`, `npm run build`, `npm test` — **167 tests in 14 files** (was 145).
- `.sync/track-c/data/` unchanged: no data or manifest-schema change.
- Not click-tested in a browser: Expand all / Collapse all, the Hide empty lines switch and the pop-up's notice rows need the hand-off §8 click-test.
