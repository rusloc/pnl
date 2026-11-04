-- mirelo_demo tables — one per artifact the report reads (src/lib/mirelo/manifest.ts FILES and DETAIL), so the
-- server route (src/lib/mirelo/artifacts.ts) can reproduce every Parquet file the browser used to fetch, in the
-- same row order. Drop-and-rebuild seed, applied via MCP execute_sql by postgres (NOT a migration). The grants
-- come from 001-schema-and-roles.sql's default privileges. Loaded by scripts/mirelo-load.ts as mirelo_loader.
--
-- Types: the manifest's column kinds map str → text, int → integer, num → double precision, bool → boolean,
-- a trailing ? → nullable. Doubles (not numeric) so the JSON the route returns carries JS numbers, as Parquet did.
-- Base tables keep the file's row order in `seq`; the detail tables reproduce the builder's sort keys
-- (data/mirelo/build_detail.py): loans by loan_id per month, client cards by client_id, disbursed, loan_id.

set search_path = mirelo_demo;

drop table if exists document, loans_month, funnel_month, portfolio_month, vintage, window_stats, cohort_curve,
    agent_month, revenue_month, subs_month, target_month, loan, client cascade;

-- manifest.json and detail/index.json, verbatim: the browser validates them with the same Zod schemas as before.
create table if not exists document (
    name text primary key check (name in ('manifest.json', 'detail/index.json')),
    doc  jsonb not null
);

create table if not exists loans_month (
    seq             integer primary key,
    month           text not null,
    market          text not null,
    product         text not null,
    channel         text not null,
    repeat          boolean not null,
    loans           integer not null,
    principal_local double precision not null
);

create table if not exists funnel_month (
    seq        integer primary key,
    month      text not null,
    market     text not null,
    product    text not null,
    channel    text not null,
    repeat     boolean not null,
    leads      integer not null,
    started    integer not null,
    submitted  integer not null,
    kyc_passed integer not null,
    approved   integer not null,
    disbursed  integer not null
);

create table if not exists portfolio_month (
    seq           integer primary key,
    month         text not null,
    market        text not null,
    product       text not null,
    loans_active  integer not null,
    loans_dpd_30p integer not null,
    outstanding   double precision not null,
    bal_current   double precision not null,
    bal_1_29      double precision not null,
    bal_30_59     double precision not null,
    bal_60_89     double precision not null,
    bal_90p       double precision not null,
    written_off   double precision not null,
    provision     double precision not null
);

create table if not exists vintage (
    seq       integer primary key,
    vintage   text not null,
    market    text not null,
    mob       integer not null,
    disbursed integer not null,
    first_30p integer not null,
    first_90p integer not null
);

create table if not exists window_stats (
    seq                     integer primary key,
    tv                      text not null,
    anchor                  text not null,
    market                  text not null,
    segment                 text not null,
    borrowers               integer not null,
    "returning"             integer not null, -- reserved word, quoted; the driver quotes it too
    median_hours_to_cash    double precision,
    median_hours_to_approve double precision,
    median_hours_payout     double precision,
    median_days_between     double precision
);

create table if not exists cohort_curve (
    seq        integer primary key,
    cohort     text not null,
    market     text not null,
    day        integer not null,
    clients    integer not null,
    repeated   integer not null,
    observable boolean not null
);

create table if not exists agent_month (
    seq                    integer primary key,
    month                  text not null,
    agent                  text not null,
    loans                  integer not null,
    principal_local        double precision not null,
    target_loans           double precision not null,
    target_principal_local double precision not null
);

create table if not exists revenue_month (
    seq          integer primary key,
    month        text not null,
    market       text not null,
    product      text not null,
    stream       text not null,
    amount_local double precision not null
);

create table if not exists subs_month (
    seq                 integer primary key,
    month               text not null,
    market              text not null,
    tier                text not null,
    subscribers_start   integer not null,
    subscribers_new     integer not null,
    subscribers_churned integer not null,
    subscribers_end     integer not null,
    revenue_local       double precision not null,
    mrr_local           double precision not null
);

create table if not exists target_month (
    seq     integer primary key,
    month   text not null,
    market  text not null,
    product text,
    metric  text not null,
    value   double precision not null
);

-- Every loan disbursed through the last close (613,738). detail/loans-YYYY-MM = month; detail/overdue =
-- dpd_close >= 30 and outstanding > 0; detail/client-NN = bucket (client_id % 64), all in the builder's order.
create table if not exists loan (
    loan_id                 integer primary key,
    client_id               integer not null,
    disbursed               text not null,
    market                  text not null,
    product                 text not null,
    channel                 text not null,
    agent                   text,
    repeat                  boolean not null,
    principal_local         double precision not null,
    hours_to_cash           double precision not null,
    status                  text not null,
    dpd_close               integer not null,
    outstanding_close_local double precision not null,
    month                   text     generated always as (left(disbursed, 7)) stored,
    bucket                  smallint generated always as ((client_id % 64)::smallint) stored
);
create index if not exists loan_month_idx   on loan (month, loan_id);
create index if not exists loan_bucket_idx  on loan (bucket, client_id, disbursed, loan_id);
create index if not exists loan_overdue_idx on loan (loan_id) where dpd_close >= 30 and outstanding_close_local > 0;

-- Every client (302,230): the dim columns (detail/client-dim-NN) plus the to-date summary the cohort lists carry
-- (detail/cohort-YYYY-MM), null for clients outside the 2024-01 … last-close cohorts.
create table if not exists client (
    client_id             integer primary key,
    market                text not null,
    segment               text not null,
    acquisition_channel   text not null,
    acquisition_agent     text,
    first_loan_date       text not null,
    first_product         text not null,
    cohort_month          text not null,
    birth_year_band       text not null,
    city_tier             integer not null,
    loans_before_2024     integer not null,
    loans_to_date         integer,
    principal_eur_to_date double precision,
    last_disbursed        text,
    last_status           text,
    bucket                smallint generated always as ((client_id % 64)::smallint) stored,
    constraint client_cohort_summary_all_or_none check (
        (loans_to_date is null) = (principal_eur_to_date is null)
        and (loans_to_date is null) = (last_disbursed is null)
        and (loans_to_date is null) = (last_status is null)
    )
);
create index if not exists client_bucket_idx on client (bucket, client_id);
create index if not exists client_cohort_idx on client (cohort_month, client_id) where loans_to_date is not null;

reset search_path;
