# Nordmark Exec — period model: granularity picker, items, windows, comparators, bars

> **DRAFT — projection state.** Written 2026-10-29 by archi from the USER's first-open feedback (coms 2026-10-29 §7) and ADR-0013 (k). It is the build contract for bip (`pbi-report/Nordmark Exec/`), nerd (`js-exec/`) and ginee (`data/nordmark_retail_dummy_data/checks/`). Requirement IDs: `docs/Requirements-exec.md` E-90 … E-99, ET-21 … ET-28 (and the amended E-13, E-14, E-29, E-40, E-51, E-62). Everything marked **default** is a main-agent / archi default the USER may overturn; §8 lists what is open.
>
> **Amended 2026-10-29 (same day, after the USER's walk-through):** the nine §8 questions are resolved — defaults 1, 2, 4, 6, 8, 9 accepted; **3, 5, 7 overturned** (only "Last year" at Year; Channel mix = window shares at Month / Quarter / Year; Δ suffix always short `vs prev. wk / mth / qtr`). Two layout changes of the same round are recorded in §9 (Horizon attribute removed; ⓘ target line big and bold, footer target dropped). Builders (nerd, bip, ginee) started from the USER's answers; this file now matches them. Changed IDs: E-14, E-41, E-53, E-57, E-62, E-93, E-94, E-98, E-99, ET-09, ET-23, ET-24, ET-28; new ET-29, ET-30.
>
> **Amended 2026-10-29, round 3 (USER):** (a) EBITDA flash at Week, comparator Previous = the previous month cut to the same week count (§4 #6; control value = the `P-…@k` item key of each W key, §6, ET-31; main-agent ruling 2026-10-29: week 5 of a 5-week month → N/A, and no separate W-key metric); (b) **"Month" is the only UI word** — header `Month 10 · …`, `vs LY month`, `Previous month`, sub-titles and stats; item chips stay `P1 … P12`; "period" survives only in column / key names (§2, §3, §4, §5, §8 #1 amended); (c) fixed ⓘ copy is period-neutral: owner notes dropped, W43 worked examples labelled as examples (§9, E-57, ET-32); (d) the picker keeps **three rows: type → FY → item** (§2; the round-2 "two-step" wording is withdrawn). ET-26 corrected: FY2025 items rate 3–4 target cards, never 5 (GMROI needs R52W history).
>
> Source of the rules below: the engine as built (`js-exec/lib/engine/calendar.ts`, `metrics.ts`, `status.ts`, `view.ts`, `url-state.ts`), the PBI window measures (`_measures.tmdl` folder 9 Engine: `_Window Start`, `_LW Window Start`, `Card LY <KPI>`, `Card LW <KPI>`), `checks/verify.py` and the dataset README. Where this note and the dataset README's open points 8–16 touch, the README's as-built reading stays until the USER rules on them.

## 1. What changes (USER 2026-10-29)

| Today (ADR-0013 (d)(e)(f), E-13, E-14) | New |
|---|---|
| Period switcher Week · Period to date · Year to date, always anchored on the as-of week (W43) | **Granularity** Week · Month · Quarter · Year, then **one item** of that granularity (single select, no date picker). Default on open **Week 43 FY2026** — the v5 story is unchanged on first view |
| Card bars = the last 13 weeks | Bars **follow the granularity**: last 13 weeks · 12 months (retail periods) · 8 quarters · 2 years, ending at the picked item, dotted target kept |
| Comparator Budget · Last year · Last week; LW for PTD / YTD = "same window as of last week" | Comparator **kept**: Budget · Last year · **Previous {week / month / quarter}** (the item before, at the picked granularity). **At Year only Budget · Last year** (USER 2026-10-29, §3) |
| Budget and status only for the as-of FY (gated by `fy === currentFy`) | FY2025 items: no budget → the budget-based cards are **N/A** (E-21); target-based cards keep their status (§4). No data-generation change |
| `PTD-FY2026-43`, `YTD-FY2026-43` control keys | `W-` · `P-` · `Q-` · `FY-` item keys (§6) |

"Month" is the USER's label for the 4-5-4 retail period (P10 FY2026 = W40–W43 = 28 Sep – 25 Oct 2026, ADR-0013 (e)). Quarter = 13 weeks (Q4 = W40–W52). Year = the 52-week FY. **UI vocabulary (USER 2026-10-29, round 3): "Month" is the only word shown to the reader** — type chip `Month`, header `Month 10 · 28 Sep–25 Oct 2026`, title `Nordmark · Month 10`, sub-titles `month 10` / `month 10 to date`, stats `vs LY month`, option `Previous month`, Δ `vs prev. mth`, How-to-read "12 months". The item chips stay **`P1 … P12`** (a chip, not a word). "Period" survives only in column and key names (`dim_week.period`, `period_key`, `P-FY2026-10`, `ebitda_ptd`) and in this document's data vocabulary.

## 2. Items

An **item** is one member of a granularity. The item list is derived from `dim_week` in each flavour (PBI: calculated table from `dim_week`; JS: `lib/engine/items.ts` from `manifest.weeks`) — no generator change. ET-21 asserts both lists are identical.

| Granularity (code) | Items in the data | Item key | Weeks of a complete item | Label (picker chip) | Header period line (E-51) |
|---|---|---|---|---|---|
| Week (`W`) | FY2025 W1 … FY2026 W43 = **95** | `FY2026-W43` (= `dim_week.week_key`) | 1 | `W43` | `Week 43 · 19–25 Oct 2026` (unchanged); FY shown only when ≠ as-of FY: `Week 43 FY2025 · 20–26 Oct 2025` |
| Month (`P`) | FY2025 P1 … FY2026 P10 = **22** | `FY2026-P10` (= `dim_week.period_key`) | 4 or 5 (4-5-4) | `P10` | `Month 10 · 28 Sep–25 Oct 2026` (round 3; was "Period 10") |
| Quarter (`Q`) | FY2025 Q1 … FY2026 Q4 = **8** | `FY2026-Q4` | 13 | `Q4`; partial: `Q4 · to date` | `Quarter 4 to date · 28 Sep–25 Oct 2026`; complete: `Quarter 3 · 29 Jun–27 Sep 2026` |
| Year (`FY`) | FY2025, FY2026 = **2** | `FY2026` | 52 | `FY2025`, `FY2026 · to date` | `FY2026 to date · 29 Dec 2025–25 Oct 2026` (= today's YTD line); `FY2025 · 30 Dec 2024–28 Dec 2025` |

Rules:

- **Window of an item** = its weeks ∩ actuals (`dim_week.is_actual`, ≤ the as-of week). An item is **complete** when its last week ≤ as-of, else **partial** ("to date"). At as-of W43 FY2026 exactly two items are partial: **Q4 FY2026** (W40–W43 of W40–W52) and **FY2026** (W1–W43). P10 FY2026 is complete (W40–W43 = 4 of 4), so it reads "Month 10", not "to date".
- Items with no actual week (FY2026 W44+, P11, P12) are **not listed**.
- **Last week of an item** `L` = the window's last week; point-in-time metrics read there (§4).
- **The picker keeps three rows: type → FY → item** (USER 2026-10-29, round 3, confirming this spec; the round-2 "two-step" wording is withdrawn). Row 1 = the type (Week · Month · Quarter · Year); row 2 = the fiscal year; row 3 = one item of that type in that FY; at Year the FY chips are the items and row 3 is not shown. Labels resolved: type chip **"Month"**, items **P1 … P12**, header **"Month 10 · …"** (§8 #1, round 3).
- Picker order: granularity chips `Week · Month · Quarter · Year`; FY chips `FY2025 · FY2026`; item chips in calendar order (W1 … W52 / P1 … P12 / Q1 … Q4; at Year the FY chips are the items). Default `W` · `FY2026` · `W43`. Changing the granularity keeps the FY and selects the item that contains the previous item's last week (W43 → P10 → Q4 → FY2026; back down: FY2026 → Q4 → P10 → W43 — the as-of week when the enclosing item is partial, else the item's last week).
- Window phrase for sub-titles (`view.ts windowPhrase`): `week 43` · `month 10` · `quarter 4 to date` · `FY2026 to date`; noun for stat labels: `week` · `month` · `quarter` · `year` (round 3: "month", not "period").

Sketch of the Filters-menu block (replaces the Period row; 360 px panel, ADR-0012 §2.5; the three rows reuse the chip style of the attribute groups):

```
Period
[ Week ] [ Month ] [ Quarter ] [ Year ]          ← granularity, single select
[ FY2025 ] [ FY2026 ]                            ← fiscal year, single select (hidden at Year in JS; stays in PBI)
[ W1 ] [ W2 ] … [ W43 ]                          ← items of that FY, single select, wraps (≤ 52 chips; 4 × 13 at Week)
Showing  Week 43 · 19–25 Oct 2026                ← live summary line = the header period line
```

Power BI: three button slicers on `param_granularity` → `dim_item[fy]` → `dim_item[label]` (§7); the summary line is a measure card. JS: three radiogroups, arrow keys move, the live line follows (the `period-picker-v2.md` pattern).

## 3. Windows and comparators per granularity

Let the picked item be `X` with window `w(X)` (k weeks, last week `L`).

| Comparator | Window compared | W | P | Q | FY | Label (option · Δ suffix) |
|---|---|---|---|---|---|---|
| **Budget** (default) | `fact_budget_week` / `fact_opex_week` BUD / `param_target` over `w(X)` | as today | Σ budget of the period | Σ budget of the quarter's actual weeks | Σ budget W1 … L | `Budget` · `vs budget` / `vs target` / `vs plan` (unchanged) |
| **Last year** | the **same weeks one year back by key**: `{ly_week_key(w) : w ∈ w(X)}` (E-12; never dates) | `ly_week_key` (unchanged) | same period number, FY−1 | same quarter, FY−1; partial Q4 FY2026 → FY2025 W40–W43 | FY−1 W1 … L (`FY2025 W1–W43` for FY2026 to date) | `Last year` · `vs LY` (unchanged) |
| **Previous item** (replaces Last week) | the item before `X` at the same granularity; **when `X` is partial, the previous item is cut to `X`'s week count from its start** (like-length) | `lw_week_key` (unchanged) for every card **except EBITDA flash**, whose Week reading is month-to-date: Previous = the previous month's weeks 1 … k, k = the picked week's position in its month (§4 #6, round 3) | the whole previous month at its full length (P9 for P10: 4 vs 4; P10 for P11 would be 4 vs 5 — accepted, §8 #2) | previous quarter; for Q4 FY2026 to date → Q3 first 4 weeks (W27–W30) | **not offered** (USER 2026-10-29, §8 #3): the option is hidden at Year — its window would equal Last year for FY2026 to date and be N/A for FY2025 | option `Previous week` / `Previous month` / `Previous quarter` · Δ suffix **always short**: `vs prev. wk` / `vs prev. mth` / `vs prev. qtr` (§8 #7) |

- **N/A rules (E-21, E-24):** Budget is FY2026-only → for FY2025 items every budget-based value, Δ and status is N/A (grey "–" chip, muted "n/a vs budget" Δ). Last year needs FY2024 → N/A for every FY2025 item. Previous item → N/A for the first item of the data (W1 / P1 / Q1 FY2025 and FY2025). Point-in-time inputs that need history keep their own N/A: GMROI before FY2025 W52 (R52W), LFL in FY2025 (no LY), Sell-through outside a season (§4).
- **Status is always vs Budget / target** (E-24, unchanged); only the Δ row and the "vs …" ⓘ stats follow the comparator.
- **At Year the comparator menu offers Budget · Last year only** (USER 2026-10-29, overturning the default of keeping both). Rules: (1) a user on "Previous …" who switches the type to Year **snaps to Last year** (`c=ly`); the snap is not remembered — switching back down from Year stays on Last year (default; the user re-picks Previous if wanted). (2) URL: `c=prev` together with a Year item (`i=FY2026`, `i=FY2025`) **normalises to `ly`** at parse time and serialises as `c=ly` (ET-28); legacy `c=lw` follows the same path. (3) Power BI: the Previous row of the comparator slicer is hidden while the granularity is FY, and `_Comparator Code` reads `LY` when the selection is Previous and the granularity is FY (§7). ET-23's Year clause asserts the hiding and the normalisation (not an equality).
- **Δ label set (card face, both flavours; USER 2026-10-29 "always short"):** Budget basis per card as built — `vs budget` (Net sales, Total margin, Markdown, EBITDA, Front GM), `vs budget LFL` (LFL), `vs target` (Weeks of cover, Availability, Sell-through, GMROI, OTIF), `vs plan` (Channel mix); Last year — `vs LY` (unchanged, every granularity); Previous — **`vs prev. wk` · `vs prev. mth` · `vs prev. qtr`** (replace `vs last week`; no Year form, the option is hidden). JS: `CMP_SHORT` in `view.ts` (today `{ ly: 'vs LY', lw: 'vs last week' }`); PBI: the `_lab` SWITCH in every `Card Delta <KPI>` measure (today `"LY", "vs LY", "LW", "vs last week"`). The LFL card keeps `vs budget LFL` on Budget and the plain short form on the other two.
- Header comparator line: `vs Budget` · `vs Last year (same retail weeks)` · `vs Previous week / month / quarter` (long form; the menu option label and the header line are not size-constrained).

## 4. Per-KPI rules at each granularity (the 12 landing cards)

Notation: `Σ` = sum over `w(X)` and the scope's site groups (E-15, data README "Scope"); `L` = last week of `w(X)`; `basis` = the status basis (always Budget / target, E-24); `bars(X)` = the N items of X's granularity ending at X (N = 13 / 12 / 8 / 2), each bar = the card's value for that item (so a bar of a partial item is its to-date value; a bar before the data starts or without history is blank — no bar, label kept). The dotted target = the picked item's basis (as today: the last bar's basis). Status bands = `param_status_rule` unchanged at every granularity: **no band is week-specific** (pct-of-basis, pp, wks, × and share bands are unit-only; checked against the 15 rows of `param_status_rule.parquet`).

| # | Card (kpi_code) | Value at item X | Basis (status) | Status | Bars value per item | FY2025 items |
|---|---|---|---|---|---|---|
| 1 | Net sales (`NET_SALES`) | flow: `Σ net_sales` | `Σ net_sales_bud` over `w(X)` | `1 − actual ÷ budget`, UP, bands 0 / 3 % | Σ net sales per item | value ✓ · budget / status N/A · LY N/A |
| 2 | Total margin % (`TOTAL_MARGIN`) | ratio of sums: `(Σ net_sales − Σ cogs + Σ back_margin) ÷ Σ net_sales` | same from `fact_budget_week` | `budget − actual`, UP, 0 / 1 pp | ratio per item | value ✓ · status N/A |
| 3 | Weeks of cover (`WEEKS_OF_COVER`) | point in time at `L`: `(on_hand_cost + on_order_cost)[L] ÷ forecast_cogs[L]` (R4W fallback) | forecast-weighted `cover_target_wks` at `L` (9.5 at ALL) | band \|actual − target\|, 1 / 2 wks | cover at each item's `L` | **rated** (target exists) |
| 4 | Markdown % (`MARKDOWN`) | ratio of sums: `Σ markdown ÷ Σ gross_sales` | `Σ markdown_bud ÷ Σ gross_sales_bud` | `actual − budget`, DOWN, 0 / 1 pp | ratio per item | status N/A |
| 5 | Availability % (`AVAILABILITY`) | point in time at `L`: `Σ in_stock_sku_days[L] ÷ Σ ranged_sku_days[L]` (stores only; ONLINE → N/A) | 0.97 | `target − actual`, UP, 0 / 2 pp | availability at each `L` | **rated** |
| 6 | EBITDA flash (`EBITDA`) | **W:** month-to-date of `L`'s month through `L` (`ebitda_ptd`, unchanged — sub-title "month 10 to date", so the v5 €15.3 m holds). **P / Q / FY:** EBITDA of `w(X)` = `Σ total_margin − Σ opex(ACT)` (`ebitda` of the key). **Comparators at W (round 3, USER):** Budget = `ebitda_bud_ptd` (same weeks, BUD); Last year = the same month-to-date weeks one year back by key (unchanged); **Previous = the previous month cut to the same week count** — the picked week is week k of month P(n) → compare with weeks 1 … k of P(n−1); P1 crosses to the previous FY's P12 (FY2026 W1–W4 → FY2025 W49–W52). This replaces the as-built "PTD as of last week" (`ptdLw`, README open point 16). W43 = P10 week 4 → vs P9 W36–W39 = the whole P9 (4 weeks). **Edge:** week 5 of a 5-week month (W9, W22, W35, W48) has no like-length counterpart in a 4-week previous month → Δ is N/A (`n/a vs prev. mth`; default — alternative: the whole previous month, 5 vs 4 weeks). Only EBITDA changes; every other card's Previous at W stays `lw_week_key` | same window, scenario BUD (`ebitda_bud_ptd` at W; `ebitda_bud` at P / Q / FY) | `1 − actual ÷ budget`, UP, 0 / 5 % | **W:** weekly EBITDA (unchanged) · **P:** EBITDA per month · **Q:** per quarter · **FY:** per year | status N/A. Scoped EBITDA stays a contribution (README open point 15) |
| 7 | LFL growth % (`LFL_GROWTH`) | flow by key: `Σ net_sales[is_lfl] over w(X) ÷ Σ net_sales[is_lfl_as_ly] over ly(w(X)) − 1`; LFL set is per retail period (flags on the rows), so a Q / FY window mixes period-wise sets — accepted, as YTD does today. Store count = stores with `is_lfl` rows at `L` | `Σ net_sales_bud[is_lfl] ÷ the same LY actual − 1` | `budget − actual`, UP, 0 / 2 pp | LFL growth per item | N/A (no LY) |
| 8 | Front GM % (`FRONT_GM`) | ratio of sums: `(Σ net_sales − Σ cogs) ÷ Σ net_sales` | `1 − Σ cogs_bud ÷ Σ net_sales_bud` | `budget − actual`, UP, 0 / 1 pp | ratio per item | status N/A |
| 9 | Sell-through % (`SELL_THROUGH`) | season-to-date **at `L`**: `units sold W(season start) … L ÷ (on_hand_units at the week-end before season week 1 + receipts to L)`, seasonal categories, selling locations; **N/A when `L` is outside a season** (`dim_week.season_code` null) — e.g. Q2, P7 (ends W30), FY2025 (ends W52, after AW25 W51); FY2026 to date (L = W43) ✓ | 0.62 | `target − actual`, UP, 0 / 5 pp | sell-through at each item's `L` (blank outside a season) | **rated** when in season |
| 10 | GMROI (`GMROI`) | R52W **at `L`**: `front margin over the 52 weeks ending L ÷ mean on_hand_cost over those 52 week-ends`; N/A when `L` < FY2025 W52 | 2.5 | `target − actual`, UP, 0 / 0.5× | GMROI at each item's `L` | **rated** from FY2025 W52 (P12, Q4, FY2025) |
| 11 | Supplier OTIF % (`SUPPLIER_OTIF`) | ratio of sums: `Σ po_lines_otif ÷ Σ po_lines_due` (no site → same in every scope) | 0.95 | `target − actual`, UP, 0 / 3 pp | ratio per item | **rated** |
| 12 | Channel mix (`CHANNEL_MIX`) | **shares over the whole window** (USER 2026-10-29, §8 #5): `Σ net_sales[channel] over w(X) ÷ Σ net_sales over w(X)`. At W this is the single week (unchanged, v5 68.4 / 19.9 / 11.7 holds); at P / Q / FY it is the window mix, **not** the exit mix at `L` (the as-built reading of README open point 11 is overturned; E-41 "in the window" wins over the point-in-time list of E-13 / ET-09) | plan = budget shares over the same window (`Σ net_sales_bud[channel] ÷ Σ net_sales_bud`) | band = largest \|channel − plan\|, 2 / 3 pp | — (no bars, E-20) | value ✓ · plan / status N/A |

Counts and dot (E-25, E-26): computed per item over the cards **with a status** (N/A excluded, as built — README open point 10). For an FY2025 item that is **3 or 4** of the 5 target-based cards, never 5 (corrected 2026-10-29 after ginee / nerd): GMROI needs R52W history and is rated only from FY2025 W52 (P12, Q4, FY2025), where Sell-through is already outside the AW25 season (W32–W51) — so `FY2025-P10` (L = W43, in season) rates Cover · Availability · Sell-through · OTIF = **4**; `FY2025-P12` / `Q4` / `FY2025` rate Cover · Availability · GMROI · OTIF = 4; `FY2025-Q1` (L = W13, no season, no GMROI) rates 3. OTIF and Weeks of cover are always rated, so n ≥ 1 in every scope × item. Guard anyway: n = 0 → grey dot, tooltip "no rated card". The three count pills do not show an n/a count (unchanged); the dot tooltip names "the n cards with a status".

Window-dependent ⓘ stats (today's labels in `view.ts`), by granularity — everything not listed is unchanged:

| Card · stat | W (unchanged) | P | Q | FY |
|---|---|---|---|---|
| Net sales · stat 1 | `vs LY week` | `vs LY month` | `vs LY quarter` | `vs LY year` |
| Net sales · stat 2 | `Month n to date` (round 3; was "Period n to date") | `Quarter n to date` | `FY to date` | `Budget full year` (Σ `net_sales_bud` W1–W52; N/A in FY2025) |
| Net sales · stat 3 | `Year to date` | `Year to date` | `Previous quarter` | `Last year` |
| Weeks of cover / Availability / OTIF · `vs last week` | `vs last week` | `vs prev. mth` | `vs prev. qtr` | `vs LY` (the previous-year window *is* the LY window; Previous is not offered at Year — default, see §8 #3) |
| Sell-through · `vs LY season` | unchanged (LY at `ly_week_key(L)`) | same | same | same |
| EBITDA · eyebrow / sub-title | `month 10 to date` (round 3; the v5 string "period 10 to date" is retired) | `month 10` | `quarter 4 to date` | `FY2026 to date` |
| LFL · sub-title | `vs LY week` | `vs LY month` | `vs LY quarter` | `vs LY year` |

Bar labels (ⓘ chart only; the card face bars carry none, E-29): `W31` … `W43` · `P11` … `P10` · `Q1 FY25` … `Q4 FY26` · `FY25` · `FY26`.

## 5. Status line, header and copy

- Title (E-51): `Nordmark · Week 43` · `Nordmark · Month 10` · `Nordmark · Quarter 4` · `Nordmark · FY2026`; FY appended only when ≠ the as-of FY (`Nordmark · Month 10 FY2025`).
- How-to-read bullet "Bars = the last 13 retail weeks" → "Bars = the last 13 weeks, 12 months, 8 quarters or 2 years, at the picked granularity".
- **Fixed ⓘ copy is period-neutral (round 3):** What it is / Why it matters / Formula / Status rule never name a week or window; the per-card **owner note (`note` field, Week-43-specific) is dropped from the ⓘ**; a Worked example that quotes W43 numbers keeps them under the row label **"Worked example (Week 43 FY2026)"** so a reader on another item sees it as an illustration, not the current value (E-57, ET-32). Copy lives in `js-exec/lib/engine/copy.ts` first, bip mirrors (ADR-0013 (j) sync point 1).
- `SWITCH_LABELS.period` → `granularity` { W: Week, P: Month, Q: Quarter, FY: Year }; comparator option 3 label is a function of the granularity (§3) and the option is absent at FY; Δ short forms per §3 (`vs prev. wk / mth / qtr`).
- Filters attribute groups: **Group · Lever · Owner** (Horizon removed, §9); the ⓘ tags row shows the same three.

## 6. Control-total key plan (ginee)

**Key grammar** (`checks/control_totals_eur.csv` column `period_key`): `{W|P|Q|FY}-FY{yyyy}[-{n}][@{k}]`

- `W-FY2026-43` week (two digits, unchanged) · `P-FY2026-10` period (two digits) · `Q-FY2026-4` quarter · `FY-FY2026` year.
- A key without `@` = the item's whole window ∩ actuals (so `Q-FY2026-4` = W40–W43 and `FY-FY2026` = W1–W43 at the dataset's as-of).
- `@k` = the **first k weeks** of that item — the like-length windows of §3: `Q-FY2026-3@4` (previous item of Q4 to date), `Q-FY2025-4@4` (LY of Q4 to date), `FY-FY2025@43` (LY and previous year of FY2026 to date).
- Retired: `PTD-FY2026-43`, `PTD-FY2026-42`, `PTD-FY2025-43`, `YTD-FY2026-43`, `YTD-FY2026-42`, `YTD-FY2025-43` (their values survive as `P-FY2026-10`, `P-FY2025-10`, `FY-FY2026`, `FY-FY2025@43`; the "as of last week" windows have no successor).

**Key set** (× scopes ALL, NL, BE, ONLINE):

| Group | Keys | Count | Why |
|---|---|---|---|
| Weeks (unchanged) | `W-FY2026-30 … 43`, `W-FY2025-31 … 43` | 27 | default bars + LY + LW of W31 |
| Periods | `P-FY2025-01 … 12`, `P-FY2026-01 … 10` | 22 | every Month item; covers the 12-period bars of any pick and the LY / previous windows |
| Quarters | `Q-FY2025-1 … 4`, `Q-FY2026-1 … 4` | 8 | every Quarter item; 8-quarter bars |
| Years | `FY-FY2025`, `FY-FY2026` | 2 | both Year items |
| Like-length | `Q-FY2026-3@4`, `Q-FY2025-4@4`, `FY-FY2025@43` | 3 | §3 comparators of the two partial items |
| EBITDA Previous at Week (round 3) | `P-FY{yyyy}-{p−1}@{k}` for every covered W key, k = `week_of_period`: `P-FY2026-06@4` (W30), `P-FY2026-07@1 … @4` (W31–W34), `P-FY2026-08@1 … @4` (W36–W39), `P-FY2026-09@1 … @4` (W40–W43); `P-FY2025-07@1 … @4`, `P-FY2025-08@1 … @4`, `P-FY2025-09@1 … @4` | 25 | §4 #6: the key **always carries `@k`**, even when k is the whole previous month (`P-FY2026-09@4` = P9 = W36–W39, same values as `P-FY2026-09`); W35 (week 5 of P8) has no key — its Δ is N/A; W01 of a FY would point at the previous FY's `P-…-12@k` (uncovered) |

Total **87 item keys** (62 + the 25 EBITDA-Previous `@k` keys; 6 legacy `PTD-` / `YTD-` keys retired — ginee keeps them byte-identical until both flavours are on item keys, then drops them; dataset README "Control totals" is the authoritative key list). Weeks of FY2026 W01–W29 and FY2025 W01–W30 stay uncovered by control totals (same code path as the covered weeks; hunter's parity rows add one non-default week pick, ET-25).

**Rows per key**: today ≈ 378 (FY2026 key, 4 scopes) / ≈ 174 (FY2025 key). Changes:

- FY2025 keys gain `status.<kpi>` for the rated target cards (up to 5), `status.count_on / watch / off / na` and `status.dot` → ≈ 184 per key. FY2025 W keys gain the same.
- `ebitda_ptd` / `ebitda_bud_ptd` stay on **W keys only**; P / Q / FY keys carry `ebitda` / `ebitda_bud` and their EBITDA status reads those (§4 #6).
- **EBITDA Previous at Week = the W key's `P-…@k` item key** (round 3, §4 #6; main-agent ruling aligning with ginee's build — the earlier archi default of a `ebitda_prev_ptd` W-key metric is withdrawn): each covered W key maps to `P-FY{yyyy}-{p−1}@{k}` (k = `week_of_period`), always written with `@k`; the flavours compute Δ = the W key's `ebitda_ptd` − the `ebitda` of that `@k` key. Examples: `W-FY2026-43` → `P-FY2026-09@4`; `W-FY2026-39` → `P-FY2026-08@4` (≠ `P-FY2026-08`, P8 has 5 weeks); `W-FY2026-31` → `P-FY2026-07@1`; `W-FY2026-35` (week 5 of P8) → none, Δ N/A; `W-FY2026-02` → FY2025 P12 weeks 1–2 (`P-FY2025-12@2`, uncovered). The retired "as of last week" PTD pair has no other successor. ET-31.
- `otif_suppliers_below_85` stays W-only (ALL); `gmroi.<CAT>` / `sell_through_pct.<CAT>` mini stats on every key where defined (ALL).
- **Channel mix = window shares (USER 2026-10-29, §4 #12):** on every P / Q / FY key (including the `@k` keys) the eleven `mix_*` metrics — `mix_{store|online|wholesale}_net_sales`, `mix_{…}_pct`, `mix_{…}_pct_bud`, `mix_max_dev_pp`, `mix_max_dev_channel` — are computed over the key's window `ws`, not over `[L]`; W keys are unchanged (one week = both readings). Consequence for **ET-24**: the `mix_*` rows of `P-FY2026-10` and `FY-FY2026` legitimately differ from the retired `PTD-FY2026-43` / `YTD-FY2026-43` rows (those carried the W43 exit mix) — the migration assertion **excludes `mix_*`** and asserts the rest. New **ET-29** pins the window reading: `P-FY2026-10` store share = `Σ store net sales W40–W43 ÷ Σ net sales W40–W43`.
- Estimate: + 16 FY2026 keys × 378 + 19 FY2025 keys × 184 − 6 retired × ≈ 275 ≈ **+ 7,900 rows → ≈ 17,200 rows** (from 9,328). The DAX test file (`tests/control-totals.dax`, 13,273 rows today, 39.9 min serially) grows in step: bip should sample the new keys (one P, one Q, one FY per scope plus the three `@k` keys in full) rather than mirror every row, or accept ≈ 65 min.

**`verify.py`** must: (1) generalise `win(kind, fy, w)` to `win(kind, fy, n, k=None)` → W: `[week]`; P: weeks with `period == n`; Q: weeks with `quarter == n`; FY: all weeks of `fy`; then `∩ is_actual`; `@k` → first k; (2) replace the `periods` list by the key set above; (3) drop the `fy == 2026` gate on the status block — `badness` already returns None where the budget is missing; make the EBITDA entry None-safe (`p.get('ebitda_bud')`), and read `ebitda` / `ebitda_bud` instead of the PTD pair on P / Q / FY keys; (4) keep every existing check (ET-02 Week-43 row, ET-04, ET-05, ET-20) byte-for-byte — the W-FY2026-43 rows must not change; (5) add ET-21 (item list = 95 / 22 / 8 / 2), ET-24 (`P-FY2026-10` = the old `PTD-FY2026-43` values, `FY-FY2026` = the old `YTD-FY2026-43` values **except the `mix_*` rows**: a one-off migration assertion against the current CSV) and ET-29 (window channel mix on one P key); (6) **channel mix** (`mix_*` block, today `val(Q['ch…'], s, [L], …)`) reads the window `ws` instead of `[L]` for every key — for W keys `ws == [L]`, so the W rows do not move; (7) **EBITDA Previous `@k` keys**: for every covered W key emit `P-FY{yyyy}-{p−1}@{k}` (k = `week_of_period`; P1 → previous FY's P12; **no key when `k > len(P(n−1))`** — week 5 of a 5-week month is N/A, not capped), always with `@k`; drop the "as of last week" PTD computation. ET-23 needs no verify.py check (`FY-FY2025@43` is one key; the Year clause is a UI / URL assertion).

`generate.py` writes the CSV, so the key change lands there too (same `win`); the Parquet tables, the seed and the story are untouched (ET-20 holds; the byte-identical rerun covers the CSV as well).

## 7. Flavour mechanics (describe, don't build)

**JS (`js-exec/`, nerd)**

- `calendar.ts`: `PeriodKind` `'W' | 'PTD' | 'YTD'` → `Granularity` `'W' | 'P' | 'Q' | 'FY'`; `windowWeeks(d, item)` returns `w(X)`; `lyWindow(d, item)` maps by `ly_week_key`; `prevWindow(d, item)` applies the like-length cut; `periodKey(item, k?)` / `parsePeriodKey` emit and parse the §6 grammar; `items(d)` builds the 127 items from `manifest.weeks` (no manifest change).
- `metrics.ts`: `computeMetrics(d, scope, item)`; `ptdLw` (PTD as of last week) → `ptdPrev` (previous month weeks 1 … k, null for week 5 of a 5-week month; P1 → previous FY P12); the `fy === currentFy` gate goes — budget keys are simply absent in FY2025 and `badness` yields null; EBITDA card keys per §4 #6; the status block runs for every item (`dotOf` with n ≥ 1; guard n = 0).
- `view.ts`: `Ctx.weekly` → `Ctx.series` (N items); `cmpOf` → budget / ly / prev (EBITDA at W reads `ptdPrev`); every UI noun "period" → "month" (`windowPhrase`, `noun`, `header()`, `SWITCH_LABELS`, How-to-read); `copy.ts` loses the per-card `note` from the ⓘ rows and labels W43 worked examples (§5); `CMP_SHORT` → `{ ly: 'vs LY', prev: 'vs prev. wk' | 'vs prev. mth' | 'vs prev. qtr' }` by granularity; the comparator option list is a function of the granularity (no `prev` at FY); channel mix sums the window (§4 #12); labels per §2–§5; `header()` per §2. `ATTRIBUTES` loses `horizon` (§9); `tags` → Group · Lever · Owner.
- `url-state.ts` (E-62): new key **`i`** = item key (`FY2026-W43` default, omitted when default; `FY2026-P10`, `FY2026-Q4`, `FY2026`), validated by regex `^FY\d{4}(-(W\d{2}|P\d{2}|Q[1-4]))?$` **and** membership in `items(d)` (invalid → default). Granularity is implied by `i` (no separate key). **`c`** gains `prev`; legacy `lw` parses as `prev`; **`c=prev` (or `lw`) with a Year item normalises to `ly`** and serialises as `c=ly` (§3). Legacy `horizon=` picks are ignored (key dropped, like `statement=`). **Retired `p`** still parses for old links: `week` → default item, `ptd` → `FY2026-P10` (the as-of week's period), `ytd` → `FY2026`; `p` is ignored when `i` is present and never serialised — `serializeSelection` writes the canonical `i` / `c` / `r` / attribute keys only.
- Data budget (E-83): unchanged — the shipped cube already holds all 104 weeks; no new file.

**Power BI (`pbi-report/Nordmark Exec/`, bip)**

- Retire `param_period` (disconnected, 3 rows). Add **`param_granularity`** (disconnected: `granularity_code` W / P / Q / FY, `granularity_name` Week / Month / Quarter / Year, `sort_order`) and **`dim_item`** (calculated table from `dim_week`, one row per item: `item_key`, `granularity_code`, `fy`, `n`, `label`, `label_long` (the header line), `start_index`, `end_index` (= MIN(item end, as-of)), `weeks` (k), `is_partial`, `ly_item_key`, `prev_item_key`, `sort_order`). Relationship `param_granularity[granularity_code]` 1 → * `dim_item[granularity_code]` (single direction) so the FY and item slicers cross-filter by granularity; `dim_item` joins no fact.
- Engine measures: `_Granularity Code` (`SELECTEDVALUE`, fallback `W`), `_Item Key` (fallback `meta_dataset[current_week_key]`), `_Window Start` / `_Window End` from `dim_item`, `_LY Weeks` (`TREATAS` of the window's `ly_week_key`, as `Card LY <KPI>` does today), `_Prev Window Start` / `_Prev Window End` (previous item, cut to `weeks` when `is_partial`). `_LW Window Start` and `_AsOf Index`-as-window-end retire; `_AsOf Index` stays for `is_partial`. EBITDA at W: `_Prev PTD Start` / `_Prev PTD End` = the previous month's first k weeks (k = `dim_week[week_of_period]` of the picked week; BLANK when k > the previous month's length) feed `Card Prev EBITDA`; `dim_item[label_long]` and every label measure say "Month n", "month n to date", "vs LY month".
- Card layer: `Card LW <KPI>` → `Card Prev <KPI>`; `Card Bar Points <KPI>` iterate the N items of the granularity ending at the picked item (bar = the card measure under that item's window) instead of 13 `sort_index` steps; EBITDA card per §4 #6; `Card Delta <KPI>` `_lab` SWITCH → `"LY", "vs LY", "LW", <vs prev. wk | mth | qtr by _Granularity Code>` (§3); channel-mix measures sum the window (§4 #12).
- Comparator at Year: `_Comparator Code` returns `LY` when the slicer selection is the Previous row and `_Granularity Code = "FY"`; the Previous row is hidden from `menu_param_comparator` by a visual-level filter on a measure (`_Comparator Row Visible` = 0 for LW at FY) — the saved state and *Clear all slicers* are unaffected (Budget default).
- Filters menu: slicers `menu_param_granularity`, `menu_item_fy`, `menu_item` replace `menu_param_period`; single select + force selection; the saved report state selects W43 FY2026 so the first open is the v5 story; Reset (*Clear all slicers*) must land on the same defaults (fallbacks above). The Horizon attribute slicer is removed (§9); `dim_kpi[horizon]` stays a hidden column.
- Tests: `tests/control-totals.dax` re-generated from the new CSV (sampling note in §6); the T-N2 card layer gets one block per granularity.

## 8. Open questions — **resolved 2026-10-29 (USER 1–7, main agent 8–9)**

Former default in bold; the ruling follows the arrow.

1. **Chip label "Month" for the retail period.** **"Month" on the granularity chip; items `P1 … P12`; header "Period 10".** → **Accepted, then sharpened in round 3: "Month" is the only UI word** — header "Month 10", `vs LY month`, `Previous month`, sub-titles and stats; chips stay `P1 … P12`; "period" only in column / key names.
2. **Previous item of a complete period across 4-5-4 lengths** (P11 (5 wks) vs P10 (4 wks)): **full previous item**. → **Accepted** ("Previous at Month = the whole previous month"). Round 3 adds the Week-level EBITDA rule: Previous = previous month cut to the picked week's position (§4 #6).
3. **Comparator at Year.** **Keep both "Last year" and "Previous year".** → **Overturned: only "Last year" at Year.** Previous is hidden; a user on Previous who switches to Year snaps to Last year; `c=prev` + a Year item normalises to `ly` (§3, E-94, E-62, ET-23, ET-28). Archi default inside the ruling: the snap is not remembered when switching back down.
4. **FY2025 status on target-based cards.** **Rated.** → **Accepted.**
5. **Channel mix at P / Q / FY.** **As built: shares at the item's last week.** → **Overturned: shares over the whole window** (`Σ channel ÷ Σ net sales` over `w(X)`); Week unchanged; closes README open point 11 in favour of E-41 (§4 #12, §6, E-41, E-93, ET-09, ET-24, ET-29).
6. **Sell-through for items whose last week is outside a season:** **N/A.** → **Accepted.**
7. **Δ suffix length.** **As specified (`vs prev. quarter`).** → **Overturned: always short on every card** — `vs prev. wk` / `vs prev. mth` / `vs prev. qtr`; the Budget / LY forms stay as built (full set in §3, E-98).
8. **Control-total coverage of weeks:** **leave uncovered; hunter adds one non-default week pick** (ET-25). → **Accepted** (main agent).
9. **`dim_item` home:** **derived per flavour from `dim_week`.** → **Accepted** (main agent).

## 9. Same-day layout changes (USER 2026-10-29, both flavours)

Recorded here because the builders take this file as the round's contract; the requirement text lives in E-53 / E-57 and ADR-0013 (k).

- **Horizon attribute removed** from the Filters menu and from the ⓘ tags row. Attribute groups are now **Group · Lever · Owner** (three); tags row the same three. `dim_kpi.horizon` stays in the data (hidden column in PBI, unused by `ATTRIBUTES` in JS). Reason: Horizon (the time frame a metric is managed in — week / month / quarter) is a card filter, not a date filter, and reads as a duplicate of the new period-type picker. Legacy `horizon=` URL picks are ignored.
- **ⓘ fixed copy period-neutral (round 3):** the owner `note` row is dropped; worked examples quoting W43 numbers are labelled "Worked example (Week 43 FY2026)"; What it is / Why / Formula / Status rule contain no week or window reference (E-57, ET-32).
- **ⓘ pop-up target line, big and bold; footer target removed.** The "Target budget …" / "Target …" text in the footer (`footLeft` in `view.ts`, `_footl` in the PBI `Info <KPI>` measures) goes; the footer keeps only the right-hand refresh / provisional note (default: no footer row when a card has neither). The target line directly under the 48 px actual becomes the second number of the pop-up — spec for both flavours: **value 32 px / 700 ink `#111827`; label ("Budget", "Target", "Plan" from `dim_kpi.basis`) 16 px / 600 `#374151`; unit 16 px / 600; 4 px gap under the actual; the dotted target swatch kept and scaled to 20 px** (today 16 px). Δ line stays below it. JS: `.pop-v .tgt` (today 13 px label / 20 px value, 2 px gap, 16 px swatch); PBI: the SVG `Info <KPI>` layer with the same sizes. ET-30.
