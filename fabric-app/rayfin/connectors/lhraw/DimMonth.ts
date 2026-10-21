import { boolean, date, entity, int, role, text } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// lh_raw.acme_pl.dim_month (spec §8, D-15). Keyless: no PK metadata on the
// SQL analytics endpoint. `isClosed` is the close control (N-03).
@role('authenticated', ['read'])
@entity()
export class DimMonth extends Source({ schema: 'acme_pl', table: 'dim_month' }) {
  @text({ column: 'month_key', max: 8000 }) monthKey!: string;
  @date({ column: 'month_start_date' }) monthStartDate!: Date;
  @int({ column: 'month_index' }) monthIndex!: number;
  @int({ column: 'fiscal_year' }) fiscalYear!: number;
  @text({ max: 8000 }) quarter!: string;
  @int({ column: 'month_number' }) monthNumber!: number;
  @text({ column: 'month_name', max: 8000 }) monthName!: string;
  @boolean({ column: 'is_closed' }) isClosed!: boolean;
}
