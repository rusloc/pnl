import { boolean, entity, int, role, text } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// lh_raw.acme_pl.dim_line (spec §8, D-19): category (P) / service line (S).
@role('authenticated', ['read'])
@entity()
export class DimLine extends Source({ schema: 'acme_pl', table: 'dim_line' }) {
  @text({ column: 'line_code', max: 8000 }) lineCode!: string;
  @text({ column: 'line_name', max: 8000 }) lineName!: string;
  @text({ column: 'entity_code', max: 8000 }) entityCode!: string;
  @text({ column: 'slot_label', max: 8000 }) slotLabel!: string;
  @int({ column: 'sort_order' }) sortOrder!: number;
  @boolean({ column: 'is_unassigned' }) isUnassigned!: boolean;
}
