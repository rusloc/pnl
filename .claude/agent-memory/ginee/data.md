# Data (Fabric items by name)

## Facts
- [2026-10-21] lh_raw.acme_pl: 28 Delta tables (4 facts, 12 dims, 11 params, control_totals_usd), version 0, written by fabric-data/lh_raw/load_acme_pl.py; grain/keys in its TABLES spec (source: observed)
- [2026-10-21] Row counts: fact_pl 457,896; fact_pl_allocated 758,364; fact_operational 29,016; fact_fx_rate 288; control_totals_usd 552; dims/params per README (source: observed)
- [2026-10-21] SQL endpoint types: decimal(18,2) amounts, decimal(18,6) fx, decimal(5,4) weight, bit, date, varchar(8000) (source: observed)
- [2026-10-21] Dataset profile: no duplicate keys, full FK + FX coverage, bridge weights sum to 1, no CR/BOM; spine_step text (8a-8d) (source: observed)
- [2026-10-21] lh_raw Files: acme_pl_dummy_data/ (repo copy, no longer read by the load) + 5 unrelated CSVs in root, pending USER delete (source: observed)

## Decisions
- [2026-10-21] Schema acme_pl, full overwrite reload, no V-Order (accepted at this size) — ADR-0003 accepted (source: user)

## Pending
- Per-table docs in docs/model/

## 2026-10-23 (ADR-0008, loader side, NOT yet written to lh_raw)
- [2026-10-23] load_acme_pl.py derives 3 decimal(18,6) cols per fact (amount_/gmv_ usd, eur, gbp at the row version's own rate type; CC columns dropped by main-agent review §4.3, model iterates 4 ccys x 1 BUDGET factor) and table fact_pl_elim (5,304 rows = fact_pl counterparty rows, account -> block's ELIM_* account, amounts negated, key unique). Dry run green 29 tables (source: observed)
- [2026-10-23] Offline from amount_usd (+fact_pl_elim for GROUP): T-06 552/552 exact to the cent; row precision 4 dp fails 43/552 under the test rule (<0.01) -> model type double, never Fixed Decimal (source: observed)
- [2026-10-23] Parquet after (3-col): fact_pl 2.8->12.7 MB, allocated 4.0->18.7 MB, +25 MB total; ~0.4-0.65 M distinct per new column. CC offline = today's DAX arithmetic on 4,968 cells; service Group NR FY2025 CC USD 5,109.4689692634 m = offline (source: observed)
- [2026-10-23] verify-acme-pl.sql checks 3-5 added but never parsed (sqlcmd PARSEONLY blocked by the permission classifier); run after the write (source: observed)
- [2026-10-23] USER ran the ADR-0008 lh_raw write (last commit 13:14 UTC; facts at Delta v1, fact_pl_elim v0). verify-acme-pl.sql 1-5 all green at 13:38 UTC: 29/29 counts, T-06 diff 0.00, check 3 32/32 (max 0.000195), check 4 5,304 = 5,304 net 0, check 5 P + GROUP diff 0.00. New cols decimal(18,6) on the endpoint (source: observed)

## 2026-10-26 Mirelo synthetic dataset (local only, data/mirelo_sales_dummy_data/)
- [2026-10-26] Generator generator/generate.py (seed 20261026, numpy+pandas+pyarrow, ~30 s) writes 18 tables as CSV + parquet/ + checks/control_totals_eur.csv (2,396 values); checks/verify.py = 47 independent checks, all green; byte-identical across runs (source: observed)
- [2026-10-26] Scale: fact_loan 634,365 (613,738 thru Sep 2026 + 20,627 Oct 1-25 partial, status AFTER_CLOSE), dim_client 302,230, source fact rows 0.73 M. fact_loan_month and fact_application are cell-grain aggregates (per-loan month rows would be ~3.4 M) (source: observed)
- [2026-10-26] Simulation starts 2023-01-01 (burn-in) so the Jan 2024 book is seasoned; 2023 loans only appear as fact_loan_month vintages 2023-xx (no dim_month row) and in dim_client.loans_before_2024 / prior_loans (source: observed)
- [2026-10-26] fact_loan CSV split by disbursement year (single file 96 MB, at GitHub's 100 MB hard limit); Parquet single file 19.6 MB. EUR columns 6 dp (ADR-0008 rule) (source: observed)
- [2026-10-26] Headline FY2026 YTD Sep: 209,898 loans, EUR 82.10 m, 83,633 new clients, returning 62.1 % clients / 60.2 % loans, 30+ DPD 4.63 % at Sep, revenue EUR 11.98 m (APR band 18-45 % caps revenue at about half the concept's) (source: observed)
