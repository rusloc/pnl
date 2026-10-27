import type { Manifest } from '../data/manifest.ts';
import { BASE_LABEL, COMPARE_LABEL } from './notices.ts';
import { periodSummary, TIME_VIEW_LABEL } from './period.ts';
import type { EntityView, Selection } from './types.ts';

// Page top (docs/design/period-picker-v2.md Part 2; Track B is the reference): the right-aligned status line (L-01,
// N-02, N-03) and the rows of the applied-filters pop-up, which replaces the L-04 context line. The rows match Track
// B's dim_filter_row / Filter Value; the Period row is the picker's summary sentence. Header copy separates with " - ".

export interface FilterRow {
  label: string;
  value: string;
}

export function companyName(m: Manifest, entity: EntityView): string {
  if (entity === 'GROUP') {
    const group = m.tables.dim_entity[0]?.consolidation_group;
    if (!group) throw new Error('header: dim_entity is empty');
    return group;
  }
  const row = m.tables.dim_entity.find((e) => e.entity_code === entity);
  if (!row) throw new Error(`header: no entity ${entity} in dim_entity`);
  return row.short_name;
}

/** "22 Oct 2026 12:32" in `timeZone` (default: the viewer's); month names from dim_month. */
export function formatStamp(m: Manifest, iso: string, timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(iso));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? '';
  const month = m.tables.dim_month.find((d) => d.month_number === Number(part('month')))?.month_name ?? part('month');
  return `${part('day')} ${month} ${part('year')} ${part('hour')}:${part('minute')}`;
}

/**
 * "Consumer Products - Management reporting - Closed through Sep 2026 - Refreshed 22 Oct 2026 12:32". Track C has no
 * refresh: the stamp is the data build time (manifest.builtAt).
 */
export function headerStatus(m: Manifest, sel: Pick<Selection, 'entity'>, timeZone?: string): string {
  const closed = m.tables.dim_month.filter((d) => d.is_closed);
  const last = closed[closed.length - 1]; // N-03: from dim_month.is_closed
  if (!last) throw new Error('header: no closed month in dim_month');
  return [
    companyName(m, sel.entity),
    'Management reporting',
    `Closed through ${last.month_name} ${last.fiscal_year}`,
    `Refreshed ${formatStamp(m, m.builtAt, timeZone)}`,
  ].join(' - ');
}

function versions(sel: Selection): string {
  const a = COMPARE_LABEL[sel.compareA];
  const b = COMPARE_LABEL[sel.compareB];
  const base = BASE_LABEL[sel.base];
  if (a === null && b === null) return `${base} only`;
  if (b === null) return `${base} vs ${a} (A)`;
  if (a === null) return `${base} vs ${b} (B)`;
  return `${base} vs ${a} (A) and ${b} (B)`;
}

/** Slice values in the dimension's sort_order, never alphabetically or in click order (parity rule 10). */
const bySortOrder = <R extends { sort_order: number }>(rows: readonly R[]): R[] =>
  [...rows].sort((a, b) => a.sort_order - b.sort_order);

function slices(m: Manifest, sel: Selection): string {
  if (sel.entity === 'GROUP') return 'Consolidated: channel, category and segment do not apply';
  const e = sel.entity;
  const t = m.tables;
  const slot = <R extends { entity_code: string; slot_label: string; sort_order: number }>(
    rows: readonly R[],
    chosen: readonly string[],
    code: (r: R) => string,
    name: (r: R) => string,
  ) => {
    const own = bySortOrder(rows.filter((r) => r.entity_code === e)); // parity rule 10
    const names = own.filter((r) => chosen.includes(code(r))).map(name);
    return { label: own[0]?.slot_label ?? '', value: names.length ? names.join(', ') : 'All' };
  };
  const parts = [
    slot(
      t.dim_channel,
      sel.channel,
      (r) => r.channel_code,
      (r) => r.channel_name,
    ),
    slot(
      t.dim_line,
      sel.line,
      (r) => r.line_code,
      (r) => r.line_name,
    ),
    slot(
      t.dim_segment,
      sel.segment,
      (r) => r.segment_code,
      (r) => r.segment_name,
    ),
  ];
  return parts.every((p) => p.value === 'All') ? 'All slices' : parts.map((p) => `${p.label}: ${p.value}`).join(' - ');
}

export function appliedFilters(m: Manifest, sel: Selection): FilterRow[] {
  const t = m.tables;
  const regions = bySortOrder(t.dim_region.filter((r) => sel.region.includes(r.region_code))).map((r) => r.region_name);
  const fx = t.param_fx_basis.find((f) => f.fx_basis_code === sel.fxBasis)?.fx_basis_name ?? sel.fxBasis;
  return [
    {
      label: 'Company',
      value: sel.entity === 'GROUP' ? `${companyName(m, 'GROUP')} (consolidated)` : companyName(m, sel.entity),
    },
    { label: 'Fiscal year', value: String(sel.fy) },
    { label: 'Period', value: periodSummary(m, sel) },
    { label: 'Time view', value: TIME_VIEW_LABEL[sel.timeView] },
    { label: 'Versions', value: versions(sel) },
    { label: 'Currency', value: sel.currency },
    { label: 'FX basis', value: sel.fxBasis === 'CC' ? `Constant currency (FY${sel.fy} budget rates)` : fx },
    { label: 'Units', value: t.param_units.find((u) => u.units_code === sel.units)?.units_name ?? sel.units },
    { label: 'Regions', value: regions.length ? regions.join(', ') : 'All regions' },
    { label: 'Slices', value: slices(m, sel) },
  ];
}

/**
 * Rail summaries of the Versions and Display groups, Track B's `Rail Sum Versions` / `Rail Sum Display`: "Actual vs
 * Budget, Prior year", "Actual only" (parity rule 8), "USD m - actual rates".
 */
export function railSummaries(sel: Selection): { versions: string; display: string } {
  const compares = [COMPARE_LABEL[sel.compareA], COMPARE_LABEL[sel.compareB]].filter((c) => c !== null);
  return {
    versions: `${BASE_LABEL[sel.base]}${compares.length ? ` vs ${compares.join(', ')}` : ' only'}`,
    display: `${sel.currency} ${sel.units === 'K' ? 'k' : 'm'} - ${sel.fxBasis === 'CC' ? 'constant currency' : 'actual rates'}`,
  };
}
