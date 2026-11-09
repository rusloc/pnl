# ACME Trucks — PBI = JS parity notes (hunter, 2026-11-09)

Gate: `parity_selections_trucks.csv` (expected values + `c_status`, `c_value`, `note`), run by `lib/engine/parity.test.ts`
in `npm test`. Contract: `docs/ADD/features/trucks-js-flavour.md` §7.2 / §7.3; `docs/design/parity-rules.md` › ACME Trucks.

## Run 2026-11-09

| Selection                        |  rows | match | accepted | gap |
| -------------------------------- | ----: | ----: | -------: | --: |
| PT-01 Reset                      |   475 |   475 |        0 |   0 |
| PT-02 week 9                     |   447 |   447 |        0 |   0 |
| PT-03 week 10                    |    29 |    29 |        0 |   0 |
| PT-04 all weeks · Week · Linear  |    29 |    29 |        0 |   0 |
| PT-05 week 5 · K3 · + Undefined  |    31 |    31 |        0 |   0 |
| PT-05b K1 + T1 · + Undefined     |    30 |    30 |        0 |   0 |
| PT-06 no fixed filters (fixture) |   232 |   232 |        0 |   0 |
| PT-07 URL behaviour (JS-only)    |     4 |     4 |        0 |   0 |
| PT-08 week 44 of 2022 (R7)       |   372 |   370 |        2 |   0 |
| **total**                        | 1,649 | 1,647 |        2 |   0 |

- `accepted` = difference **(16)** only: PT-08 `TILE.pf.plan_text` and `TILE.pf.delta_text` (Power BI prints `(Blank)`, the
  JS `–` and an empty pill). No row needed the minus-glyph rule (14) or the space collapse.
- `b_status`: `captured` = a literal of the DAX tests or bip's Desktop capture; `derived` = rendered from those literals by
  the DAX format / bar / pill rule, in Python (`Decimal`), never by the engine; `n/a` = JS-only (chips, URL).
- Left out on purpose: `_Zero` (38 rows, a helper with no surface), `_factHours_%%` (39, measure removed from the model),
  `kpi_total` / `model_total` (17, unselected switches, §7.1).
- The selection comes from the state columns through `parseSelection`, so the §6 deep links are part of the gate.
- **The gate bites:** `PT-01 WF.27.plan_pct` edited from `0.416154945810734` to `0.41615494` fails both the row check and
  the freshness check (2 tests); the file was restored byte for byte. A 1e-15 edit passes, as the tolerance says.
- Refresh after an engine change: `PARITY_WRITE=1 npx vitest run lib/engine/parity.test.ts`.

## Sync point 1: copy

Every §4 string of `copy.ts` that has a PBIR source equals it exactly (text boxes, slicer headers, `wf_table` column names,
`btn_reset` with its two spaces, tooltip labels of `tt_time_structure`). Not in the PBIR, as listed in the README and
§5.4: `%` / `%` headers and their aria labels, `Copy link`, `Done`, `Clear`, `Select all`, search, chip words, axis text.
The document title equals the mockup `<title>`. **0 diffs.** Contract §4 and §5.3 still name the tooltip labels `Plan` /
`Fact`; the PBIR and `copy.ts` say `Plan share` / `Fact share`.

## Stress beyond the captured states

**Differential oracle:** an independent reading of the TMDL in Python over the shipped Parquet, against the engine, on
3,360 selections (24 windows × 4 plan / calculation × 35 masks: work-type mixes, each office, K1 + T1, office + its own
loader, office + a loader from another office (empty, 576 selections), the Undefined loader, the 7 loaders behind the 28
month-plan loader-weeks). 551,040 values (share, subtotal, loss, base per row and side, 12 KPI values) including null
exactness: **0 differences.** The oracle shares the build's bridges; those are proved by the pinned rows.

1. **R5 is really gated.** Replacing "active = any source row" by "active = has hours" moves plan row 2 at PT-01
   (0.08728 → 0.08838) and PT-02 (0.09013 → 0.09059). PT-03 does not discriminate (week 10 has none of the 28).
2. **Week and Month DAX variants are identical** after the table name (Loss, Base, Subtotal, Share × Weighted, Linear),
   checked mechanically, so Week + Weighted, which no capture pins, rests on Month + Weighted plus the differential.
3. **Linear waterfall rows** are not captured by Power BI (only KPI tiles 1–2 under Linear). Covered by the differential.
4. **Week 14:** no fact, plan-week, plan-month or rock row exists, so it is R8 on both sides. No week other than 14 lacks
   a plan-week row. Contract §3.7 (7) ("a real plan / rock for the plan side") does not hold for this extract.
5. **Grid in `parity.test.ts`** (kept as a regression): no NaN / Infinity / `undefined` on any face; the chain holds;
   14 hostile URLs parse idempotently and never throw. The Loader URL cap is nerd's open fix and is not exercised.

## Open items (no gap, no accepted row)

- **Unverified: a nonzero share that rounds to zero.** `?wt=onspot` (Reset otherwise): Refueling fact = 0.0017 %, the JS
  prints `0.00%` (§3.5: dash only for blank or exactly 0). Whether a Power BI table prints `0.00%` or `–` under
  `0.00%;-0.00%;"–"` is not captured anywhere; 267 cells of the grid are in this state. One bip capture settles it.
- **Not gated:** `model_total` in `pinned.test.ts` compares the CSV with a hand-written table (12 constants plus a manifest
  total), and `kpi_total` Performance is a hard-coded null. The engine has no unselected-switch path, so "959 / 959"
  includes 14 rows the engine does not compute. They are unreachable from the UI.
- **Needs a DOM (no RTL in this app):** Loader search `LDR-18` and "Work type cannot go empty" live inside
  `FilterBar.tsx`; PT-07 covers the URL half only. For a render check on `next build && next start`: both of those, and
  Copy link in the embed (`navigator.clipboard` needs `allow="clipboard-write"` on the host iframe; a denial is silent).
- **Contract wording, §3.3 amendment:** `_WF Plan Loss` at sort 1 is pinned **0**, not the plan КФВ share, and `_WF Plan
Base` on subtotal rows is pinned **0** under Weighted, not BLANK. The engine follows the pins.
- Suggested capture rows for bip: `?wt=onspot` fact row 10 text; one Month + Linear waterfall; one Week + Weighted waterfall.
