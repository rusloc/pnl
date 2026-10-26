import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createSalesLoader } from '../sales/data.ts';
import type { SalesBase, SalesDetail } from '../sales/types.ts';

// Node side of the sales loader for Vitest: reads the built public/data/sales artifacts through the same loader the
// browser uses (run `npm run build:sales-data` first).
const DIR = new URL('../../public/data/sales/', import.meta.url);

const loader = createSalesLoader(async (name) => {
  try {
    const bytes = await readFile(fileURLToPath(new URL(name, DIR)));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  } catch (error) {
    throw new Error(`public/data/sales/${name} unreadable — run \`npm run build:sales-data\` first`, { cause: error });
  }
});

export const loadSalesBase = (): Promise<SalesBase> => loader.base();
export const loadSalesDetail = (): Promise<SalesDetail> => loader.detail();

export const SALES_DATA_DIR = fileURLToPath(new URL('../../../data/mirelo_sales_dummy_data/', import.meta.url));
