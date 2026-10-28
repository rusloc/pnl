import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createSalesLoader } from '../sales/data.ts';
import type { SalesBase, SalesDetail } from '../sales/types.ts';

// Node side of the sales loader for Vitest: reads the built public/data/sales artifacts through the same loader the
// browser uses (prebuilt in rusloc/pnl, js-report/).
const DIR = new URL('../../public/data/sales/', import.meta.url);

const loader = createSalesLoader(async (name) => {
  try {
    const bytes = await readFile(fileURLToPath(new URL(name, DIR)));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  } catch (error) {
    throw new Error(`public/data/sales/${name} unreadable — copy it from the pack (rebuilt in rusloc/pnl)`, {
      cause: error,
    });
  }
});

export const loadSalesBase = (): Promise<SalesBase> => loader.base();
export const loadSalesDetail = (): Promise<SalesDetail> => loader.detail();

// Test fixtures copied from rusloc/pnl data/mirelo_sales_dummy_data/ (checks/control_totals_eur.csv). The raw
// parquet/fact_loan.parquet (19.6 MB) is not shipped: the detail-sample test in lib/sales/engine.test.ts skips without it.
export const SALES_DATA_DIR = fileURLToPath(new URL('../../fixtures/', import.meta.url));
