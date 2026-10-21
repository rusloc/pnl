import { boolean, entity, int, role, text } from '@microsoft/rayfin-core';
import { Source } from '@microsoft/rayfin-connectors';

// lh_raw.acme_pl.dim_report_line (spec §8, D-11): the 19-step spine that
// drives row order, subtotal formulas, tags and aliases (N-11).
@role('authenticated', ['read'])
@entity()
export class DimReportLine extends Source({ schema: 'acme_pl', table: 'dim_report_line' }) {
  @text({ column: 'line_code', max: 8000 }) lineCode!: string;
  @text({ column: 'line_name', max: 8000 }) lineName!: string;
  @text({ column: 'row_type', max: 8000 }) rowType!: string;
  @text({ optional: true, max: 8000 }) formula?: string;
  @text({ optional: true, column: 'block_code', max: 8000 }) blockCode?: string;
  @text({ column: 'spine_step', max: 8000 }) spineStep!: string;
  @text({ optional: true, max: 8000 }) tag?: string;
  @text({ optional: true, column: 'parent_line_code', max: 8000 }) parentLineCode?: string;
  @boolean({ column: 'is_key' }) isKey!: boolean;
  @text({ optional: true, column: 'alias_products', max: 8000 }) aliasProducts?: string;
  @text({ optional: true, column: 'alias_services', max: 8000 }) aliasServices?: string;
  @text({ optional: true, column: 'ifrs18_category', max: 8000 }) ifrs18Category?: string;
  @int({ column: 'sort_order' }) sortOrder!: number;
}
