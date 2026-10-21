import { decimal, entity, role, text } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// lh_raw.acme_pl.fact_fx_rate (spec §8, D-04): 288 rows, local currency per
// 1 USD by month and rate type (ACTUAL_AVG monthly, BUDGET per fiscal year).
@role('authenticated', ['read'])
@entity()
export class FactFxRate extends Source({ schema: 'acme_pl', table: 'fact_fx_rate' }) {
  @text({ column: 'currency_code', max: 8000 }) currencyCode!: string;
  @text({ column: 'month_key', max: 8000 }) monthKey!: string;
  @text({ column: 'rate_type', max: 8000 }) rateType!: string;
  @decimal({ column: 'local_per_usd', precision: 18, scale: 6 }) localPerUsd!: number;
}
