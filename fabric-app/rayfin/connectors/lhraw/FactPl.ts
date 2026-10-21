import { decimal, entity, role, text } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// lh_raw.acme_pl.fact_pl (spec §8, D-01): about 458k rows of signed
// local-currency amounts at month × slice × account grain. Read only through
// server-side `where → groupBy → aggregate` (ADR-0005, option a); never paged
// into the browser row by row.
@role('authenticated', ['read'])
@entity()
export class FactPl extends Source({ schema: 'acme_pl', table: 'fact_pl' }) {
  @text({ column: 'entity_code', max: 8000 }) entityCode!: string;
  @text({ column: 'month_key', max: 8000 }) monthKey!: string;
  @text({ column: 'version_key', max: 8000 }) versionKey!: string;
  @text({ column: 'region_code', max: 8000 }) regionCode!: string;
  @text({ column: 'channel_code', max: 8000 }) channelCode!: string;
  @text({ column: 'line_code', max: 8000 }) lineCode!: string;
  @text({ column: 'segment_code', max: 8000 }) segmentCode!: string;
  @text({ column: 'account_code', max: 8000 }) accountCode!: string;
  @text({ optional: true, column: 'counterparty_entity_code', max: 8000 })
  counterpartyEntityCode?: string;
  @text({ column: 'currency_code', max: 8000 }) currencyCode!: string;
  @decimal({ column: 'amount_local', precision: 18, scale: 2 }) amountLocal!: number;
}
