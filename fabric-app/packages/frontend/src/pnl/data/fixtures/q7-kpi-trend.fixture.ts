// Q7 `KPI Trend` result in the contract shape bip handed over on 2026-10-22
// (columns kpi_code, month_index, month_key, @v; one row per kpi × month, rows
// missing where the measure is blank). CONTRACT-SHAPED, NOT A LIVE CAPTURE: the
// model was being republished when this was written and no probe was allowed.
// Replace with a `rayfin connector invoke` capture (rayfin/probes/q7-kpi-trend-smoke.query.json)
// once "go: model republished" arrives; the mapping tests below assert shape rules,
// not control totals. Values are plausible monthly figures for Consumer Products,
// FY2026, selected month Sep, Actual, USD, millions.
import type { QueryTable } from '@microsoft/rayfin-connector-fabric-semanticmodel';

const COLUMNS = [
  { name: 'dim_kpi[kpi_code]', dataType: 'String' },
  { name: 'dim_month[month_index]', dataType: 'Int64' },
  { name: 'dim_month[month_key]', dataType: 'String' },
  { name: '[@v]', dataType: 'Double' },
];

/** month_index of a `YYYY-MM` key in the sample dim_month (Jan 2024 = 1). */
function monthIndex(key: string): number {
  const [y, m] = key.split('-').map(Number);
  return (y - 2024) * 12 + m;
}

const row = (code: string, key: string, v: number | null): unknown[] => [code, monthIndex(key), key, v];

/** 13 months ending Sep 2026 for NR (AMT, every month), ORG_GROWTH (growth, one blank month), UNITS (CNT). */
export const Q7_FIN_OPS: QueryTable = {
  columns: COLUMNS,
  rows: [
    // A stray row outside the 13-month window: the mapper must ignore it.
    row('NR', '2025-08', 361.2),
    row('NR', '2025-09', 352.4),
    row('NR', '2025-10', 366.9),
    row('NR', '2025-11', 401.3),
    row('NR', '2025-12', 448.7),
    row('NR', '2026-01', 338.1),
    row('NR', '2026-02', 331.6),
    row('NR', '2026-03', 362.8),
    row('NR', '2026-04', 371.5),
    row('NR', '2026-05', 383.0),
    row('NR', '2026-06', 392.4),
    row('NR', '2026-07', 388.9),
    row('NR', '2026-08', 410.2),
    row('NR', '2026-09', 419.9),
    row('ORG_GROWTH', '2025-09', 0.052),
    row('ORG_GROWTH', '2025-10', 0.061),
    row('ORG_GROWTH', '2025-11', 0.058),
    row('ORG_GROWTH', '2025-12', 0.049),
    row('ORG_GROWTH', '2026-01', 0.071),
    row('ORG_GROWTH', '2026-02', 0.066),
    // 2026-03 missing: a blank point (gap), not zero.
    row('ORG_GROWTH', '2026-04', 0.059),
    row('ORG_GROWTH', '2026-05', 0.063),
    row('ORG_GROWTH', '2026-06', 0.068),
    row('ORG_GROWTH', '2026-07', 0.054),
    row('ORG_GROWTH', '2026-08', 0.072),
    row('ORG_GROWTH', '2026-09', 0.069),
    row('UNITS', '2025-09', 43.1),
    row('UNITS', '2025-10', 44.8),
    row('UNITS', '2025-11', 49.6),
    row('UNITS', '2025-12', 55.2),
    row('UNITS', '2026-01', 41.7),
    row('UNITS', '2026-02', 40.9),
    row('UNITS', '2026-03', 44.3),
    row('UNITS', '2026-04', 45.8),
    row('UNITS', '2026-05', 47.1),
    row('UNITS', '2026-06', 48.0),
    row('UNITS', '2026-07', 47.6),
    row('UNITS', '2026-08', 50.3),
    row('UNITS', '2026-09', 51.4),
  ],
};

/** Selected month Nov 2026 (two open months): the model returns rows for Oct / Nov under LE, which the mapper blanks under Actual. */
export const Q7_OPEN_MONTHS: QueryTable = {
  columns: COLUMNS,
  rows: [
    row('NR', '2025-11', 401.3),
    row('NR', '2025-12', 448.7),
    row('NR', '2026-01', 338.1),
    row('NR', '2026-02', 331.6),
    row('NR', '2026-03', 362.8),
    row('NR', '2026-04', 371.5),
    row('NR', '2026-05', 383.0),
    row('NR', '2026-06', 392.4),
    row('NR', '2026-07', 388.9),
    row('NR', '2026-08', 410.2),
    row('NR', '2026-09', 419.9),
    row('NR', '2026-10', 425.0),
    row('NR', '2026-11', 455.5),
  ],
};
