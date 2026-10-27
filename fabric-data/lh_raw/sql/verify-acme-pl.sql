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
        ,('fact_pl_elim'             ,   5304)
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
    union all
    select 'fact_pl_elim'             _table_name, count_big(*) _actual_rows from acme_pl.fact_pl_elim
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


-- 3. ADR-0008 (a): pre-translated columns = translation per month x currency on the fly, per table x version x FY.
--    amount_usd / _eur / _gbp and gmv_* use the row version's own rate type: ACT and FC at the month's ACTUAL_AVG,
--    BUD at BUDGET (C-11), cross rate local -> USD -> reporting currency (C-13). No constant-currency columns (ADR-0008 4.3): the model
--    derives C-12 from local sums. Rows are rounded to 6 dp, so sums may differ by < 0.001.
--    Expected: every _status = 'OK' (each |diff| < 0.01).
with amounts as (
    select
         'fact_pl'                     _table_name
        ,f.version_key                 _version_key
        ,f.month_key                   _month_key
        ,f.currency_code               _currency_code
        ,f.amount_local                _local
        ,f.amount_usd                  _usd
        ,f.amount_eur                  _eur
        ,f.amount_gbp                  _gbp
    from acme_pl.fact_pl f
    union all
    select
         'fact_pl_allocated'           _table_name
        ,a.version_key                 _version_key
        ,a.month_key                   _month_key
        ,a.currency_code               _currency_code
        ,a.amount_local                _local
        ,a.amount_usd                  _usd
        ,a.amount_eur                  _eur
        ,a.amount_gbp                  _gbp
    from acme_pl.fact_pl_allocated a
    union all
    select
         'fact_pl_elim'                _table_name
        ,e.version_key                 _version_key
        ,e.month_key                   _month_key
        ,e.currency_code               _currency_code
        ,e.amount_local                _local
        ,e.amount_usd                  _usd
        ,e.amount_eur                  _eur
        ,e.amount_gbp                  _gbp
    from acme_pl.fact_pl_elim e
    union all
    select
         'fact_operational'            _table_name
        ,o.version_key                 _version_key
        ,o.month_key                   _month_key
        ,o.currency_code               _currency_code
        ,o.gmv_local                   _local
        ,o.gmv_usd                     _usd
        ,o.gmv_eur                     _eur
        ,o.gmv_gbp                     _gbp
    from acme_pl.fact_operational o
    where 1=1
        and o.gmv_local is not null
)
,cells as (
    select
         a._table_name                 _table_name
        ,a._version_key                _version_key
        ,a._month_key                  _month_key
        ,a._currency_code              _currency_code
        ,case
             when a._version_key = 'BUD'
                 then 'BUDGET'
             else 'ACTUAL_AVG'
         end                           _rate_type
        ,sum(a._local)                 _local
        ,sum(a._usd)                   _usd
        ,sum(a._eur)                   _eur
        ,sum(a._gbp)                   _gbp
    from amounts a
    group by
         a._table_name
        ,a._version_key
        ,a._month_key
        ,a._currency_code
)
,fly as (
    select
         c._table_name                                                     _table_name
        ,c._version_key                                                    _version_key
        ,m.fiscal_year                                                     _fiscal_year
        ,c._usd                                                            _usd
        ,c._eur                                                            _eur
        ,c._gbp                                                            _gbp
        ,cast(c._local as float) / l.local_per_usd * u.local_per_usd       _usd_fly
        ,cast(c._local as float) / l.local_per_usd * e.local_per_usd       _eur_fly
        ,cast(c._local as float) / l.local_per_usd * g.local_per_usd       _gbp_fly
    from cells c
    join acme_pl.dim_month m on m.month_key = c._month_key
    join acme_pl.fact_fx_rate l on l.currency_code = c._currency_code
                               and l.month_key = c._month_key
                               and l.rate_type = c._rate_type
    join acme_pl.fact_fx_rate u on u.currency_code = 'USD'
                               and u.month_key = c._month_key
                               and u.rate_type = c._rate_type
    join acme_pl.fact_fx_rate e on e.currency_code = 'EUR'
                               and e.month_key = c._month_key
                               and e.rate_type = c._rate_type
    join acme_pl.fact_fx_rate g on g.currency_code = 'GBP'
                               and g.month_key = c._month_key
                               and g.rate_type = c._rate_type
)
,diffs as (
    select
         f._table_name                                 _table_name
        ,f._version_key                                _version_key
        ,f._fiscal_year                                _fiscal_year
        ,sum(f._usd) - sum(f._usd_fly)                 _diff_usd
        ,sum(f._eur) - sum(f._eur_fly)                 _diff_eur
        ,sum(f._gbp) - sum(f._gbp_fly)                 _diff_gbp
    from fly f
    group by
         f._table_name
        ,f._version_key
        ,f._fiscal_year
)
select
     d._table_name                     _table_name
    ,d._version_key                    _version_key
    ,d._fiscal_year                    _fiscal_year
    ,round(d._diff_usd, 6)             _diff_usd
    ,round(d._diff_eur, 6)             _diff_eur
    ,round(d._diff_gbp, 6)             _diff_gbp
    ,case
         when abs(d._diff_usd) < 0.01
             and abs(d._diff_eur) < 0.01
             and abs(d._diff_gbp) < 0.01
             then 'OK'
         else 'MISMATCH'
     end                               _status
from diffs d
order by
     _status
    ,_table_name
    ,_version_key
    ,_fiscal_year;


-- 4. ADR-0008 (b): fact_pl_elim = minus the counterparty rows of fact_pl (C-36, D-33), on the block's ELIM_* account.
--    Per version x month x region x block: elimination + counterparty amounts = 0 (local and pre-translated USD).
--    Per version x month x region: eliminations net to 0, so contribution margin is unchanged (T-02, C-37 difference 0).
--    Expected: _status = 'OK', _ic_rows = _elim_rows = 5,304.
with ic as (
    select
         f.version_key                 _version_key
        ,f.month_key                   _month_key
        ,f.region_code                 _region_code
        ,a.block_code                  _block_code
        ,count_big(*)                  _rows
        ,sum(f.amount_local)           _local
        ,sum(f.amount_usd)             _usd
    from acme_pl.fact_pl f
    join acme_pl.dim_account a on a.account_code = f.account_code
    where 1=1
        and f.counterparty_entity_code is not null
    group by
         f.version_key
        ,f.month_key
        ,f.region_code
        ,a.block_code
)
,el as (
    select
         e.version_key                 _version_key
        ,e.month_key                   _month_key
        ,e.region_code                 _region_code
        ,a.block_code                  _block_code
        ,count_big(*)                  _rows
        ,sum(e.amount_local)           _local
        ,sum(e.amount_usd)             _usd
    from acme_pl.fact_pl_elim e
    join acme_pl.dim_account a on a.account_code = e.account_code
    where 1=1
        and a.is_intercompany = 1
        and a.has_fact_rows = 0
    group by
         e.version_key
        ,e.month_key
        ,e.region_code
        ,a.block_code
)
,pairs as (
    select
         coalesce(i._version_key, l._version_key)                          _version_key
        ,coalesce(i._month_key, l._month_key)                              _month_key
        ,coalesce(i._region_code, l._region_code)                          _region_code
        ,coalesce(i._rows, 0)                                              _ic_rows
        ,coalesce(l._rows, 0)                                              _elim_rows
        ,coalesce(i._local, 0) + coalesce(l._local, 0)                     _net_local
        ,coalesce(i._usd, 0) + coalesce(l._usd, 0)                         _net_usd
        ,coalesce(l._local, 0)                                             _elim_local
    from ic i
    full join el l on l._version_key = i._version_key
                  and l._month_key = i._month_key
                  and l._region_code = i._region_code
                  and l._block_code = i._block_code
)
,regions as (
    select
         p._version_key                _version_key
        ,p._month_key                  _month_key
        ,p._region_code                _region_code
        ,sum(p._elim_local)            _elim_local
    from pairs p
    group by
         p._version_key
        ,p._month_key
        ,p._region_code
)
,summary as (
    select
         count_big(*)                                                      _block_groups
        ,sum(p._ic_rows)                                                   _ic_rows
        ,sum(p._elim_rows)                                                 _elim_rows
        ,sum(case
                 when p._net_local <> 0 or p._net_usd <> 0
                     then 1
                 else 0
             end)                                                          _groups_not_negated
        ,(
            select
                 count_big(*)          _cnt
            from regions r
            where 1=1
                and r._elim_local <> 0
         )                                                                 _regions_not_net_zero
    from pairs p
)
select
     s._block_groups                   _block_groups
    ,s._ic_rows                        _ic_rows
    ,s._elim_rows                      _elim_rows
    ,s._groups_not_negated             _groups_not_negated
    ,s._regions_not_net_zero           _regions_not_net_zero
    ,case
         when s._ic_rows = s._elim_rows
             and s._groups_not_negated = 0
             and s._regions_not_net_zero = 0
             then 'OK'
         else 'MISMATCH'
     end                               _status
from summary s;


-- 5. T-06 from the pre-translated column (what the model will sum after ADR-0008): net revenue in USD.
--    P ACT FY2025 = fact_pl direct GR + GTN; ACME Group ACT FY2026 YTD Sep = P + S + fact_pl_elim (C-36).
--    Expected: 4,575,428,492.38 and 3,972,687,506.52 (control_totals_usd), every _diff_usd = 0.00.
with nr_rows as (
    select
         'P'                           _entity_code
        ,'FY2025'                      _window
        ,f.amount_usd                  _amount_usd
    from acme_pl.fact_pl f
    join acme_pl.dim_account a on a.account_code = f.account_code
    join acme_pl.dim_month m on m.month_key = f.month_key
    where 1=1
        and f.entity_code = 'P'
        and f.version_key = 'ACT'
        and m.fiscal_year = 2025
        and a.is_direct = 1
        and a.block_code in ('GR', 'GTN')
    union all
    select
         'GROUP'                       _entity_code
        ,'FY2026 YTD Sep'              _window
        ,f.amount_usd                  _amount_usd
    from acme_pl.fact_pl f
    join acme_pl.dim_account a on a.account_code = f.account_code
    join acme_pl.dim_month m on m.month_key = f.month_key
    where 1=1
        and f.version_key = 'ACT'
        and m.fiscal_year = 2026
        and m.month_number <= 9
        and a.is_direct = 1
        and a.block_code in ('GR', 'GTN')
    union all
    select
         'GROUP'                       _entity_code
        ,'FY2026 YTD Sep'              _window
        ,e.amount_usd                  _amount_usd
    from acme_pl.fact_pl_elim e
    join acme_pl.dim_account a on a.account_code = e.account_code
    join acme_pl.dim_month m on m.month_key = e.month_key
    where 1=1
        and e.version_key = 'ACT'
        and m.fiscal_year = 2026
        and m.month_number <= 9
        and a.block_code in ('GR', 'GTN')
)
,nr as (
    select
         n._entity_code                _entity_code
        ,n._window                     _window
        ,sum(n._amount_usd)            _amount_usd
    from nr_rows n
    group by
         n._entity_code
        ,n._window
)
select
     n._entity_code                                _entity_code
    ,n._window                                     _window
    ,round(n._amount_usd, 2)                       _computed_usd
    ,c.amount_usd                                  _expected_usd
    ,round(n._amount_usd, 2) - c.amount_usd        _diff_usd
from nr n
join acme_pl.control_totals_usd c on c.entity_code = n._entity_code
                                 and c.[window] = n._window
where 1=1
    and c.version = 'ACT'
    and c.line_code = 'NR'
order by n._entity_code;
