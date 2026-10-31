# Nordmark Exec, PBI vs JS card-face parity, 2026-10-30

From: hunter (qa-test-hunter) · Input: `2026-10-30-pbi-faces.csv` (bip, 945 rows, 7 states × 135 fields) · Spec: `docs/Requirements-exec.md` (E-20, E-93, E-98, E-101, E-103, ET-34), ADR-0013 (l)/(m), `docs/design/parity-rules.md`.

## Method

- JS side: `buildView(d, normalize(sel))` from `js-exec/lib/engine/view.ts` on the built `js-exec/public/data/` (no browser, product code untouched). Run with plain Node 24 (type stripping): `node js-faces.ts <out.json>` from `js-exec/`. The script lives in the hunter scratchpad and is not in the repo.
- Field mapping: title = `card.title` · sub-title = `card.sub` · value / unit = `card.value` / `card.unit` · delta = `card.delta` · status = `card.word` · ⓘ actual = value + unit · ⓘ basis label / value = `card.target` (`n/a` → `–`, `NO_BASIS_VALUE`) · ⓘ Δ = `explain.delta` · ⓘ note = the worked-example text when the face is `n/a by category` · header = period + 3 spaces + compare + 3 spaces + region · counts = `on / watch / off` · dot = `status.dot`.
- State → JS selection (URL form):

| PBI state | JS URL |
|---|---|
| W43 · Budget · All | *(empty, defaults)* |
| FY2026-W20 · Budget · All | `i=FY2026-W20` |
| FY2025-P10 · Last year · All | `i=FY2025-P10&c=ly` |
| FY2026-Q4 · Previous · NL | `i=FY2026-Q4&c=prev&r=nl` |
| ALL#ELEC · W43 · Budget | `cat=ELEC` |
| NL#ELEC+TOYS · FY2026-P10 · Previous | `i=FY2026-P10&c=prev&r=nl&cat=ELEC,TOYS` |
| FY2026 · Budget · All | `i=FY2026` |

## Result

| Class | Rows |
|---|---|
| Identical | 903 / 945 |
| (a) accepted platform difference, listed in parity-rules | 0 |
| (b) display-only, **not** covered by parity-rules | 42 |
| (c) real mismatch | **0** |

All 135 fields of all 7 states match byte for byte: every value, Δ text, chip word, ⓘ basis label / value, ⓘ Δ, ⓘ note, header line, counts and dot. The two accepted Nordmark rows in parity-rules (FY row at Year, "All categories" vs "All") do not show in this capture. The CSV holds no picker or dropdown text, and the header is the same in both flavours.

## (c) real mismatches

None.

## (b) not covered by parity-rules

| States | Cards | Field | PBI | JS view model | Rendered JS face |
|---|---|---|---|---|---|
| all 7 | LFL_GROWTH, FRONT_GM, SELL_THROUGH, GMROI, SUPPLIER_OTIF, CHANNEL_MIX (the 6 small cards) | sub-title | *(empty)* | `vs LY week/month/quarter/year`, `% of net sales`, `A/W season to date`, `rolling 12 months`, `inbound, PO lines`, `% of net sales vs plan` | hidden at ≥ 1200 px (`.sm .ch h3 span {display:none}`), so it reads the same as PBI. **Shown below 1200 px** (two-column layout) |

- The JS behaviour comes from the v5 design contract (`docs/design/executive dashboard (reseller)/prototype.html`, lines 75 and 186), not from a JS bug. E-20 ("basis sub-title (hero and medium only)") describes only the desktop face, and the PBI canvas is fixed, so it has no layout below 1200 px.
- Proposed parity-rules line (main agent to decide): *Nordmark Exec: small-card sub-titles. Hidden on the desktop face in both flavours (E-20). The JS responsive layout below 1200 px shows them, as v5 does. PBI has no responsive layout.*
- Side effect not checked by this capture: in JS the `sub` also feeds the ⓘ eyebrow of small cards (`Explains Tier 1 · vs LY week`). The PBI eyebrow was not captured.

## Category states (ADR-0013 (l), E-101 … E-104)

Both flavours agree with each other and with `data/nordmark_retail_dummy_data/checks/control_totals_category_eur.csv`:

| Check | ALL#ELEC · W43 | NL#ELEC+TOYS · P10 |
|---|---|---|
| EBITDA: `–`, `n/a by category`, N/A, OpEx note | yes | yes |
| Supplier OTIF: `–`, `n/a by category`, N/A, PO-lines note | yes | yes |
| Sell-through | N/A, "No seasonal category in the selection." (no `sell_through_pct` row in the checks: correct) | 59.2% = TOYS only (`sell_through_pct` 0.591539), target 62.0%, Watch |
| GMROI target | 2.2× = ELEC's own `dim_category` row (`gmroi_target` 2.200000) | 2.2× = AOH-weighted 2.249904 (both round to 2.2; the weighting is proven only to 1 decimal at display, and the control total holds the exact value) |
| Counts / dot | 3 / 5 / 1 = **9 rated** (ET-34), orange; checks 3/5/1, na 3, dot 2 | 5 / 2 / 3 = 10 rated, orange; checks 5/2/3, na 2, dot 2 |
| Header segment | ` · Electronics` | ` · Electronics & Toys & leisure` |

Status packs of the other states against `control_totals_eur.csv`: W43 ALL 7/3/2 · P-FY2025-10 0/3/1 (na 8) · Q4 NL 6/3/3 · FY2026 4/6/2, all dot 2 (orange). This matches both flavours. **FY2026-W20 has no control-total rows**: its 5 / 5 / 1 is proven only by the two flavours agreeing.

## Not covered by this capture (gaps for the next round)

- ⓘ mini stats (E-101: `gmroi.<CAT>` / `sell_through_pct.<CAT>` list the picked categories only), worked examples (E-101: " Seasonal categories only." on sell-through under a pick, ⓘ worked example only), ⓘ eyebrow, footer / tags, drill path.
- Dot tooltip, "n of 12 metrics · picks" summary, How-to-read, bars (values, target line, labels).
- Picker / dropdown texts, so the two accepted Nordmark rows of parity-rules were not exercised.
- No state with region BE or ONLINE, no ≥ 3-category pick (` · n categories` + `regionTitle`), no all-9-ticked = All state, no Week-vs-Previous EBITDA (`vs P9 weeks 1–4`, E-93 / ET-31).
