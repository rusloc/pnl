import { boolean, entity, role, text } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// lh_raw.acme_pl.dim_version (spec §8, D-16).
@role('authenticated', ['read'])
@entity()
export class DimVersion extends Source({ schema: 'acme_pl', table: 'dim_version' }) {
  @text({ column: 'version_key', max: 8000 }) versionKey!: string;
  @text({ column: 'version_code', max: 8000 }) versionCode!: string;
  @text({ column: 'version_name', max: 8000 }) versionName!: string;
  @text({ optional: true, column: 'forecast_cycle', max: 8000 }) forecastCycle?: string;
  @boolean({ column: 'is_latest_forecast' }) isLatestForecast!: boolean;
  @text({ column: 'first_month_key', max: 8000 }) firstMonthKey!: string;
  @text({ column: 'last_month_key', max: 8000 }) lastMonthKey!: string;
}
