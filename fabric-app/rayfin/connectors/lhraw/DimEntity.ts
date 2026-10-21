import { entity, role, text } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// lh_raw.acme_pl.dim_entity (spec §8, D-04). Keyless: the SQL analytics
// endpoint exposes no PK metadata, so by-key reads are not available.
@role('authenticated', ['read'])
@entity()
export class DimEntity extends Source({ schema: 'acme_pl', table: 'dim_entity' }) {
  @text({ column: 'entity_code', max: 8000 }) entityCode!: string;
  @text({ column: 'entity_name', max: 8000 }) entityName!: string;
  @text({ column: 'short_name', max: 8000 }) shortName!: string;
  @text({ optional: true, max: 8000 }) description?: string;
  @text({ column: 'consolidation_group', max: 8000 }) consolidationGroup!: string;
}
