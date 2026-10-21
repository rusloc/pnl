import { entity, int, role, text } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// lh_raw.acme_pl.dim_region (spec §8, D-17).
@role('authenticated', ['read'])
@entity()
export class DimRegion extends Source({ schema: 'acme_pl', table: 'dim_region' }) {
  @text({ column: 'region_code', max: 8000 }) regionCode!: string;
  @text({ column: 'region_name', max: 8000 }) regionName!: string;
  @text({ column: 'functional_currency', max: 8000 }) functionalCurrency!: string;
  @int({ column: 'sort_order' }) sortOrder!: number;
}
