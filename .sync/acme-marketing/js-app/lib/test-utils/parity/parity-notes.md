# ACME Marketing — PBI = JS parity notes (hunter, 2026-11-05)

Gate: `parity_selections_marketing.csv` (bip's 1,416 captured rows + `c_status`, `c_value`, `note`), run by
`lib/engine/parity.test.ts` in `npm test`. Contract: `docs/ADD/features/marketing-js-flavour.md` §7.2 / §7.3;
`docs/design/parity-rules.md` › ACME Marketing.

## Run 2026-11-05

|          |  rows |
| -------- | ----: |
| total    | 1,416 |
| match    | 1,396 |
| accepted |    20 |
| gap      |     0 |

- `accepted` = parity-rules ACME Marketing difference **(14) minus glyph** only: O5 Δ (PA-02 rows 1–4, PA-04 rows 1–4,
  PA-05 rows 1–2) and P1 CTR 7 d Δ (PA-08 / PA-09 rows 1, 2, 6, 7, 8). Power BI native visuals print `-`, the JS `−`.
  These rows are still asserted after the §7.2 normalisation (difference 14 is a normalisation rule, not a skip).
- No row needed the whitespace collapse around `|`.
- No DOM-only rows: every captured element resolves from a view model (`lib/test-utils/parity/marketing-parity.ts`).
- The test also asserts that the CSV mirrors bip's `pbi-report/ACME Marketing/tests/parity-expected.csv` row for row and
  that the state columns agree with the `// State:` lines of `parity-selections.dax`. Both checks are skipped in a
  `.sync` pack, where `pbi-report/` is absent.
- Refresh `c_value` / `c_status` after an engine change: `PARITY_WRITE=1 npx vitest run lib/engine/parity.test.ts`.

## Stress beyond the 14 selections (engine only; no Power BI capture for these states)

1. **Multi-chip** (platform iOS + status Live + Last click + cross-filter Paid social | iOS): the JS gives
   `Platform: iOS | Status: Live | Attribution: Last click | Selected: Paid social | iOS`, identical to the PBI rule.
   Notes: the cross-filter join and the segment join are the same glyph (`|`), so the line cannot be split back into
   segments. Order inside a segment: platforms follow the dim order (`Web + iOS + Android` when all three are picked),
   while channels / networks / statuses are alphabetical. PA-06 and PA-09 confirm the platform and status orders.
   No captured row covers multi-channel, network, market, tier or `Campaign: n picked`.
2. **Custom 30 / 31 d from 2025-01-01** (`_Mv Start` = `basis_start < first && days > 30`, JS `moversWindow` mirrors
   it exactly):
   - 30 d: no fallback. The basis 2024-12-02..2024-12-31 has no data, so O5 / O6 are empty in every mode.
   - 31 d: fallback to the last 30 days (2025-01-02..2025-01-31). The basis 2024-12-03..2025-01-01 holds one data day,
     so O5 **Top 5** compares 30 days with 1 day (`Non-brand · Analytics terms 65 / 2 +62.2`, …). Worst 5 is empty.
     Both flavours share the rule, so this is not a parity gap but a rule-design issue: the fallback does not give a
     full basis until the window ends at 2025-03-01 or later (owner: archi / main agent).
   - LY mode: the basis is in 2024, so O5 / O6 are empty. No NaN anywhere.
3. **Window entirely in 2025** (Mar 2025 vs LY; all of 2025 vs LY; Jun 2025 prev; one day): no NaN / Infinity /
   `undefined` in any view model; Δ blank; dynamics LY points 0; O5 / O6 empty in LY mode.
   **Probable gap (JS):** V1 / V2 print `LY $0.0k` / `LY 0`, while the ratio vitals print `LY —`. The PBI
   `Vital V1 SVG` / `V2` print `LY —` when `[Spend LY]` / `[Signups LY]` are BLANK, and both are bare `SUM`s, so no LY
   rows means BLANK. The JS sums to 0 where DAX returns BLANK.
4. **URL state with invalid values** (22 query strings × 3 hashes: bad enums, bad / impossible dates, unknown codes,
   `../` and `__proto__` values, `%00`, a 5,000-char `sel`, duplicate keys, emoji): never throws. Each bad key falls back
   on its own, parse → serialize → parse is idempotent, and no NaN reaches a view model. Findings:
   - `p=custom&from=2026-11-03&to=2025-01-01` (from > to): the window falls back to the default 30 d, but the
     Selection keeps `custom` + the inverted dates. The canonical URL still carries them and the Period dot stays lit,
     so the URL is not rewritten to the state on screen (JS; low).
   - `p=custom&to=2024-12-31`: `to` before the data is clipped up to a 1-day window (2025-01-01), not reset. Reasonable,
     but undocumented.
   - `pf=web&sel=ch:app_install|pf:ios`: a cross-filter outside the scope gives an empty body and a chip for a row C1
     does not show. It only clears with the chip × (no NaN).
5. **P1 16 vs 19**: R30 with every status → 16 (the three campaigns have all-blank P1 measures). Full range
   2025-01-01..2026-11-03 with every status → **19**, and `RT_META_RETENTION` shows `—` CPA / ROAS with
   `No CPA goal`. Default statuses → 16 at any window (the three are Paused / Ended).
   **Contract wording gap:** §7.2 PA-09 says the LY window covers all three. It covers two: `SRCH_SUMMER_PROMO` ran
   2026-06-01..2026-08-31, so the LY window 2025-10-05..2025-11-03 still lists 16 rows (two of the three appear; other
   campaigns with no data in that window drop out).
6. **Same class as 3, Cohorts:** with a sparse scope (Campaign `SRCH_SUMMER_PROMO`), the JS K7 draws 12 columns, 9 of
   them `0`. The PBI capture query and the column chart keep only non-blank `[K5 Customers]` months (3 columns).
   Probable gap (JS), to be confirmed by a bip capture.

Suggested extra capture rows for bip (would turn 3, 5 and 6 into gated rows): Custom 2025-03-01..2025-03-31 + LY
(V1.ly, V2.ly); Campaigns, Custom full range, all statuses (P1.rows = 19, the RETENTION row); Cohorts, Campaign
`SRCH_SUMMER_PROMO` (K7.rows); Custom 2025-01-01..2025-01-31, O5 Top (the `_Mv Start` edge).

## Playwright smoke note (DOM, not Vitest; run on `next build && next start`)

The view models are gated above. These need a rendered page:

- Vital tile Δ renders `arrow + " " + delta` in one span (`MarketingApp.tsx`); blank Δ renders nothing (no stray arrow).
- K1 cells listed in `K1.green_cells` carry the `#1E9E6A` fill; J2 highlight on `CONNECT_SOURCE`; J3 highlight on
  `1–2 d`.
- Chips render as separate removable chips (accepted difference 3), the cross-filter chip dashed and last.
- O5 / O6 empty state at Custom 2025-01-01..2025-01-30 (no list, no broken table).
- Header title (being changed to "ACME Marketing" by nerd; not a captured row).
