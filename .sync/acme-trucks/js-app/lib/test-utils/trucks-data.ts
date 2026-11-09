import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { csvTable } from '../../scripts/csv.ts';
import { createLoader, createUnfilteredLoader } from '../data/loader.ts';
import type { ReadArtifact } from '../data/loader.ts';
import type { UnfilteredManifest } from '../data/manifest.ts';
import { addPlanWeek, createDataset } from '../engine/data.ts';
import type { Dataset } from '../engine/data.ts';

// Node side of the loader for Vitest: the built public/data (`npm run build:data` first) and the fixture set
// fixtures/data-unfiltered (`npm run build:fixtures`), through the same code the browser uses; plus the hunter-owned
// pinned-value fixture.

const reader =
  (dir: URL): ReadArtifact =>
  async (name) => {
    try {
      const bytes = await readFile(fileURLToPath(new URL(name, dir)));
      return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    } catch (error) {
      throw new Error(`${fileURLToPath(dir)}${name} unreadable — run npm run build:data / build:fixtures`, {
        cause: error,
      });
    }
  };

const DATA = new URL('../../public/data/', import.meta.url);
const UNFILTERED = new URL('../../fixtures/data-unfiltered/', import.meta.url);
const PINNED = fileURLToPath(new URL('../../fixtures/checks/trucks-pinned.csv', import.meta.url));

let shipped: Promise<Dataset> | undefined;
export function loadDataset(): Promise<Dataset> {
  shipped ??= (async () => {
    const loader = createLoader(reader(DATA));
    const ds = createDataset(await loader.core());
    addPlanWeek(ds, await loader.planWeek());
    return ds;
  })();
  return shipped;
}

export const hasUnfiltered = (): boolean => existsSync(fileURLToPath(new URL('manifest.json', UNFILTERED)));

let unfiltered: Promise<{ ds: Dataset; m: UnfilteredManifest }> | undefined;
export function loadUnfiltered(): Promise<{ ds: Dataset; m: UnfilteredManifest }> {
  unfiltered ??= (async () => {
    const loader = createUnfilteredLoader(reader(UNFILTERED));
    const core = await loader.core();
    const ds = createDataset(core);
    addPlanWeek(ds, await loader.planWeek());
    return { ds, m: core.manifest };
  })();
  return unfiltered;
}

export interface PinnedRow {
  context: string;
  sort: number | null;
  measure: string;
  expected: string;
  tol: string;
  source: string;
  status: string;
}

const COLUMNS = ['context', 'category_sort', 'measure', 'expected', 'tol', 'source', 'b_status'];

/** The rows the pinned suite runs: captured + derived (pending and unmapped are skipped, per the fixture's owner). */
export function pinnedRows(): PinnedRow[] {
  const out: PinnedRow[] = [];
  for (const [context, sort, measure, expected, tol, source, status] of csvTable(
    readFileSync(PINNED, 'utf8'),
    COLUMNS,
    'trucks-pinned.csv',
  )) {
    if (status !== 'captured' && status !== 'derived') continue;
    out.push({
      context: context ?? '',
      sort: sort ? Number(sort) : null,
      measure: measure ?? '',
      expected: expected ?? '',
      tol: tol ?? '',
      source: source ?? '',
      status: status ?? '',
    });
  }
  return out;
}
