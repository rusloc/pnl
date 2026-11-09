import { existsSync, readFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { readControlTotals } from '../../scripts/control-totals.ts';
import type { ControlRow } from '../../scripts/control-totals.ts';
import { createLoader } from '../data/loader.ts';
import { addJourney, addTerms, createDataset } from '../engine/data.ts';
import type { Dataset } from '../engine/data.ts';

// Node side of the loader for Vitest (as js-exec/lib/test-utils/exec-data.ts): reads the built public/data artifacts
// through the same loader the browser uses (`npm run build:data` first), lazy groups included. Control totals come from
// the dataset (data/acme_marketing_dummy_data/checks/) or, in a .sync pack without the repo's data/, from
// fixtures/checks/ (ADR-0014).

const DIR = new URL('../../public/data/', import.meta.url);

export const loader = createLoader(async (name) => {
  try {
    const bytes = await readFile(fileURLToPath(new URL(name, DIR)));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  } catch (error) {
    throw new Error(`public/data/${name} unreadable — run npm run build:data`, { cause: error });
  }
});

let full: Promise<Dataset> | undefined;
/** The Dataset with every file loaded (journey and terms too). */
export function loadDataset(): Promise<Dataset> {
  full ??= (async () => {
    const ds = createDataset(await loader.core());
    addJourney(ds, await loader.journey());
    addTerms(ds, await loader.campaigns());
    return ds;
  })();
  return full;
}

const CHECKS = [
  new URL('../../../data/acme_marketing_dummy_data/checks/control_totals_usd.csv', import.meta.url),
  new URL('../../fixtures/checks/control_totals_usd.csv', import.meta.url),
].map((u) => fileURLToPath(u));

export function controlTotals(): ControlRow[] {
  const path = CHECKS.find((p) => existsSync(p));
  if (!path) throw new Error(`control_totals_usd.csv not found in ${CHECKS.join(' or ')}`);
  return readControlTotals(readFileSync(path, 'utf8'));
}
