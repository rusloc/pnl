import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { csvTable } from '../../scripts/csv.ts';
import { createLoader } from '../data/loader.ts';
import { createData } from '../engine/cube.ts';
import type { ExecData } from '../engine/cube.ts';

// Node side of the loader for Vitest: reads the built public/data artifacts through the same loader the browser uses
// (`npm run build:data` first). Control totals come from the dataset (data/nordmark_retail_dummy_data/checks/) or, in
// a .sync pack without the repo's data/, from fixtures/checks/ (ADR-0014).

const DIR = new URL('../../public/data/', import.meta.url);

const load = createLoader(async (name) => {
  try {
    const bytes = await readFile(fileURLToPath(new URL(name, DIR)));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  } catch (error) {
    throw new Error(`public/data/${name} unreadable — run npm run build:data`, { cause: error });
  }
});

export const loadExecData = async (): Promise<ExecData> => createData(await load());

const CHECKS = [
  new URL('../../../data/nordmark_retail_dummy_data/checks/control_totals_eur.csv', import.meta.url),
  new URL('../../fixtures/checks/control_totals_eur.csv', import.meta.url),
].map((u) => fileURLToPath(u));

export interface ControlRow {
  scope: string;
  periodKey: string;
  metric: string;
  value: number;
}

export function controlTotals(): ControlRow[] {
  const path = CHECKS.find((p) => existsSync(p));
  if (!path) throw new Error(`control_totals_eur.csv not found in ${CHECKS.join(' or ')}`);
  return [
    ...csvTable(readFileSync(path, 'utf8'), ['scope', 'period_key', 'metric_code', 'value'], 'control_totals_eur.csv'),
  ].map(([scope = '', periodKey = '', metric = '', value = '']) => ({
    scope,
    periodKey,
    metric,
    value: Number(value),
  }));
}

/** Tolerance per metric, as data/nordmark_retail_dummy_data/checks/verify.py tol(): amounts 0.005, ratios 1e-6. */
export function tolerance(metric: string): number {
  if (
    metric.startsWith('status.') ||
    ['lfl_store_count', 'po_lines_due', 'po_lines_otif', 'mix_max_dev_channel', 'otif_suppliers_below_85'].includes(
      metric,
    )
  )
    return 0;
  if (
    metric.includes('pct') ||
    /(_pp|_target|_target_wks)$/.test(metric) ||
    metric === 'gmroi' ||
    metric === 'weeks_of_cover' ||
    metric.startsWith('gmroi.')
  )
    return 1e-6;
  return /(_units|_sku_days)$/.test(metric) ? 0.06 : 0.0051;
}
