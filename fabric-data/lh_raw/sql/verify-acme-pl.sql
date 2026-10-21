-- Verification of lh_raw.acme_pl after load_acme_pl.py (ADR-0003). Read-only.
-- Run against the SQL analytics endpoint of Lakehouse lh_raw (workspace RAW), database lh_raw.
-- If a table is missing right after the load, wait for the endpoint's metadata sync and re-run.

-- 1. Row counts vs data/acme_pl_dummy_data/README.md (params: counts of the CSVs)
with expected as (
    select
         v._table_name                 _table_name
        ,v._expected_rows              _expected_rows
    from (values
         ('fact_pl'                  , 457896)
        ,('fact_pl_allocated'        , 758364)
        ,('fact_operational'         ,  29016)
        ,('fact_fx_rate'             ,    288)
        ,('dim_account'              ,     73)
        ,('dim_report_line'          ,     29)
        ,('bridge_account_nature'    ,     54)
        ,('dim_nature'               ,      9)
        ,('dim_entity'               ,      2)
        ,('dim_month'                ,     36)
        ,('dim_version'              ,      4)
        ,('dim_region'               ,      4)
        ,('dim_channel'              ,     10)
        ,('dim_line'                 ,     11)
        ,('dim_segment'              ,      8)
        ,('dim_cost_centre'          ,     19)
        ,('param_breakdown'          ,      5)
        ,('param_cost_lens'          ,      2)
        ,('param_cost_sign'          ,      2)
        ,('param_detail_level'       ,      3)
        ,('param_fx_basis'           ,      2)
        ,('param_layout'             ,      3)
        ,('param_reporting_currency' ,      3)
        ,('param_time_view'          ,      5)
        ,('param_units'              ,      2)
        ,('param_variance_format'    ,      3)
        ,('param_version_choice'     ,      5)
        ,('control_totals_usd'       ,    552)
    ) v (_table_name, _expected_rows)
)
,actual as (
    select 'fact_pl'                  _table_name, count_big(*) _actual_rows from acme_pl.fact_pl
    union all
    select 'fact_pl_allocated'        _table_name, count_big(*) _actual_rows from acme_pl.fact_pl_allocated
    union all
    select 'fact_operational'         _table_name, count_big(*) _actual_rows from acme_pl.fact_operational
    union all
    select 'fact_fx_rate'             _table_name, count_big(*) _actual_rows from acme_pl.fact_fx_rate
    union all
    select 'dim_account'              _table_name, count_big(*) _actual_rows from acme_pl.dim_account
    union all
    select 'dim_report_line'          _table_name, count_big(*) _actual_rows from acme_pl.dim_report_line
    union all
    select 'bridge_account_nature'    _table_name, count_big(*) _actual_rows from acme_pl.bridge_account_nature
    union all
    select 'dim_nature'               _table_name, count_big(*) _actual_rows from acme_pl.dim_nature
    union all
    select 'dim_entity'               _table_name, count_big(*) _actual_rows from acme_pl.dim_entity
    union all
    select 'dim_month'                _table_name, count_big(*) _actual_rows from acme_pl.dim_month
    union all
    select 'dim_version'              _table_name, count_big(*) _actual_rows from acme_pl.dim_version
    union all
    select 'dim_region'               _table_name, count_big(*) _actual_rows from acme_pl.dim_region
    union all
    select 'dim_channel'              _table_name, count_big(*) _actual_rows from acme_pl.dim_channel
    union all
    select 'dim_line'                 _table_name, count_big(*) _actual_rows from acme_pl.dim_line
    union all
    select 'dim_segment'              _table_name, count_big(*) _actual_rows from acme_pl.dim_segment
    union all
    select 'dim_cost_centre'          _table_name, count_big(*) _actual_rows from acme_pl.dim_cost_centre
    union all
    select 'param_breakdown'          _table_name, count_big(*) _actual_rows from acme_pl.param_breakdown
    union all
    select 'param_cost_lens'          _table_name, count_big(*) _actual_rows from acme_pl.param_cost_lens
    union all
    select 'param_cost_sign'          _table_name, count_big(*) _actual_rows from acme_pl.param_cost_sign
    union all
    select 'param_detail_level'       _table_name, count_big(*) _actual_rows from acme_pl.param_detail_level
    union all
    select 'param_fx_basis'           _table_name, count_big(*) _actual_rows from acme_pl.param_fx_basis
    union all
    select 'param_layout'             _table_name, count_big(*) _actual_rows from acme_pl.param_layout
    union all
    select 'param_reporting_currency' _table_name, count_big(*) _actual_rows from acme_pl.param_reporting_currency
    union all
    select 'param_time_view'          _table_name, count_big(*) _actual_rows from acme_pl.param_time_view
    union all
    select 'param_units'              _table_name, count_big(*) _actual_rows from acme_pl.param_units
    union all
    select 'param_variance_format'    _table_name, count_big(*) _actual_rows from acme_pl.param_variance_format
    union all
    select 'param_version_choice'     _table_name, count_big(*) _actual_rows from acme_pl.param_version_choice
    union all
    select 'control_totals_usd'       _table_name, count_big(*) _actual_rows from acme_pl.control_totals_usd
)
select
     e._table_name                     _table_name
    ,e._expected_rows                  _expected_rows
    ,a._actual_rows                    _actual_rows
    ,case
         when a._actual_rows = e._expected_rows
             then 'OK'
         else 'MISMATCH'
     end                               _status
from expected e
left join actual a on a._table_name = e._table_name
order by
     _status
    ,_table_name;


-- 2. Control total T-06: Consumer Products, ACT FY2025, net revenue (NR = GR + GTN) in USD.
--    Direct lines come from fact_pl (README); translate per month x currency with ACTUAL_AVG (C-11, D-30).
--    Expected: 4,575,428,492.38 (control_totals_usd), _diff_usd = 0.00.
with nr_local as (
    select
         f.currency_code               _currency_code
        ,f.month_key                   _month_key
        ,sum(f.amount_local)           _amount_local
    from acme_pl.fact_pl f
    join acme_pl.dim_account a on a.account_code = f.account_code
    join acme_pl.dim_month m on m.month_key = f.month_key
    where 1=1
        and f.entity_code = 'P'
        and f.version_key = 'ACT'
        and m.fiscal_year = 2025
        and a.is_direct = 1
        and a.block_code in ('GR', 'GTN')
    group by
         f.currency_code
        ,f.month_key
)
,nr_usd as (
    select
         sum(n._amount_local / r.local_per_usd)    _amount_usd
    from nr_local n
    join acme_pl.fact_fx_rate r on r.currency_code = n._currency_code
                               and r.month_key = n._month_key
    where 1=1
        and r.rate_type = 'ACTUAL_AVG'
)
select
     round(u._amount_usd, 2)                       _computed_usd
    ,c.amount_usd                                  _expected_usd
    ,round(u._amount_usd, 2) - c.amount_usd        _diff_usd
from nr_usd u
cross join acme_pl.control_totals_usd c
where 1=1
    and c.entity_code = 'P'
    and c.version = 'ACT'
    and c.[window] = 'FY2025'
    and c.line_code = 'NR';
