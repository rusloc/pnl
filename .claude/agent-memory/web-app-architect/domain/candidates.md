<!-- next-id: CAND-002 -->

# Candidates (single observations awaiting a second hit)

### CAND-001 · Mirroring a Power BI model in JS: VertiPaq string joins and DAX `IN {}` lists are case-insensitive, the data is not · first seen 2026-11-09
**Where:** `pbi-report/ACME Trucks/Trucks.SemanticModel` — fact `idle_name_for_op` `Авар. Прост.` joins `dim_time_category[category_code]` `Авар. прост.`; `bridge_fact_time_category` `Консервация/резерв` joins `Консервация/Резерв`; the `_Fact Base % Linear` lists spell a third variant. 6,776 + 527 fact rows would drop from every share if the JS build joined case-sensitively. Recorded as rule R1 + build check 4 (exactly two case-only matches) in `docs/ADD/features/trucks-js-flavour.md`.
**Why interesting:** a silent total-moving defect class whenever a JS engine is derived from a TMDL over real (not generated) data; generated datasets never show it because the generator writes one spelling. Second sighting on another live-extract showcase → CNV (build rule: fold case on every join that mirrors a relationship or a DAX string compare, and assert the fold set).
**Watch for:** the next PBIP built on an extract rather than a generator (P&L lakehouse data, any client sample).
**Tags:** dax, vertipaq, case-insensitive, bridge, live-extract, js-mirror, build-check
**Promote-to:** conventions.md on second sighting (would become CNV-NNN)
**Expires:** 2027-03-09
