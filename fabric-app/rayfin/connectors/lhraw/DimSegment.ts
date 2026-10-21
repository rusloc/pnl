import { boolean, entity, int, role, text } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// lh_raw.acme_pl.dim_segment (spec §8, D-20): price tier (P) / customer segment (S).
@role('authenticated', ['read'])
@entity()
export class DimSegment extends Source({ schema: 'acme_pl', table: 'dim_segment' }) {
  @text({ column: 'segment_code', max: 8000 }) segmentCode!: string;
  @text({ column: 'segment_name', max: 8000 }) segmentName!: string;
  @text({ column: 'entity_code', max: 8000 }) entityCode!: string;
  @text({ column: 'slot_label', max: 8000 }) slotLabel!: string;
  @int({ column: 'sort_order' }) sortOrder!: number;
  @boolean({ column: 'is_unassigned' }) isUnassigned!: boolean;
}
