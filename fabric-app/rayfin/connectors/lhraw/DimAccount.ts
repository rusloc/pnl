import { boolean, entity, int, role, text } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// lh_raw.acme_pl.dim_account (spec §8, D-10): the 73 leaf accounts. The
// free-text columns (definition, published_comparable, default cost centres)
// are left out on purpose: the app reads labels and flags only.
@role('authenticated', ['read'])
@entity()
export class DimAccount extends Source({ schema: 'acme_pl', table: 'dim_account' }) {
  @text({ column: 'account_code', max: 8000 }) accountCode!: string;
  @text({ column: 'account_name', max: 8000 }) accountName!: string;
  @text({ column: 'entity_scope', max: 8000 }) entityScope!: string;
  @text({ column: 'block_code', max: 8000 }) blockCode!: string;
  @text({ column: 'block_name', max: 8000 }) blockName!: string;
  @text({ column: 'spine_step', max: 8000 }) spineStep!: string;
  @int({ column: 'sort_order' }) sortOrder!: number;
  @int({ column: 'natural_sign' }) naturalSign!: number;
  @text({ column: 'ifrs18_category', max: 8000 }) ifrs18Category!: string;
  @boolean({ column: 'is_direct' }) isDirect!: boolean;
  @boolean({ column: 'is_below_cm' }) isBelowCm!: boolean;
  @boolean({ column: 'is_intercompany' }) isIntercompany!: boolean;
  @boolean({ column: 'has_fact_rows' }) hasFactRows!: boolean;
}
