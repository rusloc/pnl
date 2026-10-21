import { boolean, entity, int, role, text } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// lh_raw.acme_pl.dim_channel (spec §8, D-18): channel (P) / sales motion (S).
@role('authenticated', ['read'])
@entity()
export class DimChannel extends Source({ schema: 'acme_pl', table: 'dim_channel' }) {
  @text({ column: 'channel_code', max: 8000 }) channelCode!: string;
  @text({ column: 'channel_name', max: 8000 }) channelName!: string;
  @text({ column: 'entity_code', max: 8000 }) entityCode!: string;
  @text({ column: 'slot_label', max: 8000 }) slotLabel!: string;
  @int({ column: 'sort_order' }) sortOrder!: number;
  @boolean({ column: 'is_unassigned' }) isUnassigned!: boolean;
}
