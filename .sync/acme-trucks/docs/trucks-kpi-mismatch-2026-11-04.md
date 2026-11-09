# ACME Trucks — KPI mismatch between "Time utilization" and "Time util (original)" (2026-11-04)

> Bug report (USER, 2026-11-04): with the same filters, the new page "Time utilization" (`ReportSectionbdcfb2b87f3167b0ec4f`)
> and the old page "Time util (original)" (`time_util_original`) show very different KPI numbers, and the new page's Δ pills
> do not equal Fact − Plan. The USER takes the old page as correct.
> Diagnosis: bip, read-only. Numbers come from DAX queries on a scratch copy of the repo PBIP (the USER's 17:44 save,
> `cache.abf` included), opened in bip's own Desktop instance. No file under `pbi-report/ACME Trucks/` was changed.
> Status: **fixed 2026-11-04** after the USER's decision (§6): options A, C and D applied; no data changed.

## 1. Root cause

1. **`_KPI Noise` = `RANDBETWEEN ( 10, 100 )`, on both pages.** `Rock Mass by Truck Plan/Fact` multiply by one draw, and
   `Performance per Truck Plan/Fact` multiply by two (one inside Rock Mass and one of their own, so 100 to 10,000). Each card
   and each Δ measure gets its own draws. The two pages use **the same four measures**, so they show the same plan and fact
   numbers, each scaled by a different random factor. The old page is just as random as the new one, so it is not more
   correct. This placeholder came from the live model ("RANDBETWEEN(10,100)" inline). On 2026-10-21 the USER chose to keep
   it (redesign §0.1 decision 6) and it was moved into `_KPI Noise`.
2. **The Δ pills are not inconsistent in their DAX.** `KPI Performance per Truck Δ` and `KPI Rock Mass by Truck Δ` are already
   `Fact − Plan`. Their Plan and Fact draw different noise from the cards beside them, though, so the pill cannot equal the
   difference of the two numbers shown. The dictionary already says so.
3. The ratio tiles (Truck loading, Effective work time) have no noise. They are **correct and equal to the old page**, whose
   waterfall label rows 27 and 24 use the same filter context.

Things the bug report suspected, all ruled out: bindings, plan-type / calculation contexts, week vs month plan table, auto
date tables (`LocalDateTable_*` hang only on `fact_interval`, which no KPI reads), bridge filtering, division basis and units.
None of them differs between the pages.

## 2. Proof: every screenshot number is an exact multiple of one noise-free value

Filter set from the USER's 17:44 save. Both pages hold the same state: week "10 (4.3-10.3)", plan type Month, calculation
Weighted, work type Trucks + On spot, office and loader all, report filter `dim_loader[is_included] = "да"`. The
noise-free values are the same DAX with `_KPI Noise = 1`, and they are identical with and without the old page's
contractor filter.

| Card | Noise-free value | Screenshot | Screenshot ÷ value |
|---|---|---|---|
| New · Mass loaded Plan | 7,155.96 | 114,495 | 16.000 |
| New · Mass loaded Fact | 7,028.80 | 576,362 | 82.000 |
| New · Performance Plan | 847.047 | 5,356,724 | 6,324.000 (two draws, e.g. 68 × 93) |
| New · Performance Fact | 762.467 | 3,736,088 | 4,900.000 (e.g. 70 × 70) |
| Old · left card (PlanBottomGroup) · Performance | 847.047 | 2,851,160 | 3,366.000 |
| Old · left card · Mass loaded | 7,155.96 | 679,816 | 95.000 |
| Old · right card (FactBottomGroup) · Performance | 762.467 | 1,756,724 | 2,304.000 (48 × 48) |
| Old · right card · Mass loaded | 7,028.80 | 386,584 | 55.000 |
| New · Δ Mass loaded | −127.16 | −89,651 | = 7,028.80 × 86 − 7,155.96 × 97 (own draws) |
| New · Δ Performance | −84.58 | +1,059,121 | = 762.467 × 2,500 − 847.047 × 1,000 (own draws) |

Old page: the left card is **Plan** (group `44f05374881d5eda766a` "PlanBottomGroup", x 254) and the right card is **Fact**
(group `c731034919c0f8f5e8ef` "FactBottomGroup", x 877). The numbers confirm this, since the left values divide only by the
plan units.

In one query the noise held the same value across repeated identical cells (cache), but Performance and Rock Mass got
different draws (Rock Mass Plan × 61, Performance Plan × 900 = 30²). So no two cards can be relied on to share a draw.

## 3. Per KPI

### Truck loading (% of total time)

| | Old page | New page |
|---|---|---|
| Plan | `Time Share Plan %` on waterfall row sort 27, visual filters `is_shown = "1"`, `is_included = "да"`, code not blank | `KPI Truck Loading Plan %` = `CALCULATE ( [Time Share Plan %], dim_time_category[sort_order] = 27 )` |
| Fact | `Time Share Fact %`, row 27 | `KPI Truck Loading Fact %` (same pattern) |
| Δ | `Time Share Δ`, row 27 | `KPI Truck Loading Δ pp` = (Fact − Plan) × 100 |
| Difference in definition / context | none in the default work types (contractor page filter, see §4) | |
| Values at the screenshot filters | 42.92 % / 45.35 % / +2.42 pp | 42.9 % / 45.3 % / +2.42 pp (the USER's screenshot) |
| Fix | none needed | |

### Effective work time (% of total time)

| | Old page | New page |
|---|---|---|
| Plan / Fact / Δ | `Time Share Plan % / Fact % / Δ` on row sort 24 | `KPI Effective Work Plan % / Fact % / Δ pp` (sort_order 24) |
| Difference | none in the default work types | |
| Values | 53.69 % / 51.56 % / −2.13 pp | 53.7 % / 51.6 % / −2.13 pp (screenshot) |
| Fix | none needed | |

### Performance per truck (m³/h)

| | Old page | New page |
|---|---|---|
| Plan | `Performance per Truck Plan` (left card) | `Performance per Truck Plan` (`kpi_pf_plan`) |
| Fact | `Performance per Truck Fact` (right card) | `Performance per Truck Fact` (`kpi_pf_fact`) |
| Δ | none on the page | `KPI Performance per Truck Δ` = Fact − Plan, with its own draws |
| Difference | **same measure**, and each card draws `_KPI Noise` twice | |
| Noise-free values | 847.05 / 762.47 | Δ −84.58 |
| Screenshots | 2,851,160 / 1,756,724 | 5,356,724 / 3,736,088 / +1,059,121 |
| Fix | `_KPI Noise` → `1` (§5 option A) | |

### Mass loaded per truck (thousand m³)

| | Old page | New page |
|---|---|---|
| Plan | `Rock Mass by Truck Plan` (left card) | `Rock Mass by Truck Plan` (`kpi_rm_plan`) |
| Fact | `Rock Mass by Truck Fact` (right card) | `Rock Mass by Truck Fact` (`kpi_rm_fact`) |
| Δ | none on the page | `KPI Rock Mass by Truck Δ` = Fact − Plan, with its own draws |
| Difference | **same measure**, one `_KPI Noise` draw per card | |
| Noise-free values | 7,155.96 / 7,028.80 | Δ −127.16 |
| Screenshots | 679,816 / 386,584 | 114,495 / 576,362 / −89,651 |
| Fix | `_KPI Noise` → `1` (§5 option A) | |

Units are consistent. `fact_rock_mass` holds thousand m³, so 7,155.96 thousand m³ ÷ 8,448.13 truck-loading hours × 1,000 =
847 m³/h. "Per truck" means "loaded into trucks" (the measure is named `Rock Mass by Truck`); it is not divided by a truck count.

## 4. Other context differences (not the cause, but real)

- **Slicers are not synced across the pages.** The old page's slicers sit in sync groups `Date`, `Филиал`, `type`, `_schema`
  and `Название ЭКС в ГД` (Calculation has none). The new page's six slicers have **no** `syncGroup`. A filter set on one page
  does not carry to the other. The USER's test matched only because both pages were set by hand (the 17:44 save shows the
  same state on both).
- **Contractor page filter.** The old page keeps `dim_loader[contractor]` = blank, a leftover of its drillthrough. The new page
  dropped it (USER decision 5, 2026-10-21). All loaders with a contractor have work type "Undefined", so the filter changes
  nothing under the default Trucks + On spot. Once the USER also ticks **Undefined** (both work-type slicers list it), every KPI
  differs. Example at S1 + Undefined: Truck loading Fact 45.07 % (new) vs 45.35 % (old), Mass loaded Plan 7,271.27 vs 7,155.96.

## 5. Proposed fix (needs the USER's yes: it reverses decision 6 of 2026-10-21)

Nothing on the new page needs re-binding, because it already uses the old page's measures. The only fix is the noise. It is
a model change, so the **old page's numbers change too** (from random multiples to 7,156 / 7,029 and 847 / 762 at the
screenshot filters), although no file of that page is touched.

**Option A (recommended): switch the noise off.** One line in `_measures.tmdl`, as the measure's description already says:

```dax
_KPI Noise =
1
```

Then Mass loaded and Performance are deterministic and equal on both pages, and the Δ pills equal Fact − Plan exactly
(for example −127 thousand m³ and −85 m³/h at the screenshot filters). The `* [_KPI Noise]` references stay, so the diff is
one line. Removing them as well would be a cleanup that nobody asked for.

**Option B: keep a placeholder scale, but make it stable.** For example `_KPI Noise = 37`. Both pages then agree and Δ = Fact − Plan,
but the numbers stay fake. Only worth it if the showcase must not show the real volumes.

Optional, decided separately:
- **C. Sync the slicers.** Give the new page's Week, Office, Plan type, Work type and Loader slicers the old page's group
  names. This is a new-page edit only. Syncing Calculation would need a group on the old page too, which would edit the
  original page, so it needs an explicit OK.
- **D. Contractor parity.** Add the contractor = blank page filter to the new page, or remove it from the old one. This
  reverses decision 5 or edits the original page, so it is the USER's call.

### Files a fix would touch (option A)

| File | Change |
|---|---|
| `pbi-report/ACME Trucks/Trucks.SemanticModel/definition/tables/_measures.tmdl` | `_KPI Noise` body → `1`, description updated; descriptions of the two volume Δ measures lose the "own noise" caveat |
| `pbi-report/ACME Trucks/tests/page-parity.dax` (new) | new page vs original page, 12 KPI values × 3 filter sets (S1 screenshot state, S2 all weeks / Week / Linear, S3 week 5 / Month / Linear / office K3). Already run on the scratch copy with noise-free units: **36/36 TRUE**. After option A it compares the real measures |
| `pbi-report/ACME Trucks/tests/time-util.dax` tab 6, `tests/time-util-original.dax` tab 2, `tests/baseline-live-en.dax` KPI tabs | RANDBETWEEN rule (ratio in [10, 100] / [100, 10,000]) → exact equality with the unit |
| `docs/model/trucks-measure-dictionary.md` | notes, `_KPI Noise` row and DAX, the two Δ rows |
| `docs/ADD/features/trucks-how-it-works.md` | §3 "KPI noise" bullet, §7 last bullet |
| `docs/ADD/features/trucks-report-redesign.md` | §0.1 decision 6 marked reversed (date, USER) |

There is no `pbi-report/ACME Trucks/README.md` (the bug report asked for a change-log row there). The change log lives in the
two feature docs above, unless the USER wants a README.

## 6. Resolution (2026-11-04)

USER decision: the new page must show the same numbers as "Time util (original)" under the same filters, with no change to
the data (Parquet, CSV, generator, partitions and Power Query untouched). Applied by bip after the Desktop check (no
window showed Trucks); every touched file was backed up under `__backup__/` with suffix `.2026-11-04-1757.bak`. The original
page's files were not edited.

| Option | Change | File |
|---|---|---|
| A | `_KPI Noise` = `1` (measure, folder and hidden flag kept); the two volume Δ descriptions lose the "own noise" caveat | `Trucks.SemanticModel/definition/tables/_measures.tmdl` |
| C | `syncGroup` on five new-page slicers with the original page's names: Week `Date`, Office `Филиал`, Plan type `type`, Work type `_schema`, Loader `Название ЭКС в ГД`. **Calculation stays ungrouped:** the original page keeps its Calculation slicer in no group, and giving it one would edit the original page | `…/ReportSectionbdcfb2b87f3167b0ec4f/visuals/s_week`, `s_office`, `s_plan_type`, `s_work_type`, `s_loader` `/visual.json` |
| D | page filter `dim_loader[contractor]` = blank, a copy of the original page's filter (`f_contractor_blank`) | `…/ReportSectionbdcfb2b87f3167b0ec4f/page.json` |

The original page's numbers changed too, without any edit to its files. Its volume cards now show the noise-free values.

**Check-up** (scratch copy of the repo PBIP, opened in bip's own Desktop instance without `cache.abf`, full refresh from
`data/`):

| Check | Result |
|---|---|
| `powerbi-report-author validate "pbi-report/ACME Trucks/Trucks.pbip"` | 0 errors, 0 warnings |
| `tests/page-parity.dax` (new): new page = original page, 12 KPI values × 3 filter sets, plus the four tiles pinned in S1 with Δ = Fact − Plan | 2 tabs, 40 / 40 rows TRUE |
| `tests/time-util.dax` | 8 tabs, 413 / 413 TRUE. Tab 6 now checks card = unit, `_KPI Noise` = 1 and the volume Δ = Fact − Plan (was "multiplier in [10, 100]"). Tab 7 checks that the contractor filter changes no KPI under the default work types |
| `tests/time-util-original.dax` | 2 tabs, 194 / 194 TRUE. Tab 2 multiplier bounds `[100, 10000]` / `[10, 100]` → `[1, 1]` |
| `tests/baseline-live-en.dax` | 7 tabs, 536 / 536 TRUE. `kpi_saved`, `kpi_switches` and `kpi_total`: multiplier bounds → `[1, 1]`; the expected unit values are unchanged |
| Render | Both pages rendered in the scratch instance at the USER's context and show the same numbers |

**The four tiles at the USER's context** (week 10 · Month · Weighted · Trucks + On spot), identical on both pages:

| Tile | Plan | Fact | Δ (Fact − Plan) |
|---|---|---|---|
| Truck loading | 42.92 % | 45.35 % | +2.42 pp |
| Effective work time | 53.69 % | 51.56 % | −2.13 pp |
| Performance per truck (m³/h) | 847 | 762 | −85 |
| Mass loaded per truck (thousand m³) | 7,156 | 7,029 | −127 |

The original page has no Δ card for the two volume KPIs; its Plan and Fact cards show the same Plan and Fact values.
