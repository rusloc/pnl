import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createSalesLoader, parquetSource } from "../data";
import type { DetailParts, SalesBase } from "../types";

// Node side of the sales loader for Vitest: reads the Parquet artifacts in data/mirelo/parquet (prebuilt in
// rusloc/pnl, js-report/; since 2026-11-03 the browser reads the same rows from Supabase through /api/mirelo)
// through the same loader the browser uses.
const DIR = new URL("../../../../data/mirelo/parquet/", import.meta.url);

const loader = createSalesLoader(
  parquetSource(async (name) => {
    try {
      const bytes = await readFile(fileURLToPath(new URL(name, DIR)));
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
    } catch (error) {
      throw new Error(
        `data/mirelo/parquet/${name} unreadable — copy it from the pack (rebuilt in rusloc/pnl)`,
        {
          cause: error,
        },
      );
    }
  }),
);

export const loadSalesBase = (): Promise<SalesBase> => loader.base();
export const loadSalesDetail = (
  names: readonly string[],
): Promise<DetailParts> => loader.detail(names);

// Test fixtures copied from rusloc/pnl data/mirelo_sales_dummy_data/ (checks/control_totals_eur.csv). The full detail
// in data/mirelo/parquet/detail/ is built from the generator by data/mirelo/build_detail.py (2026-11-01).
export const SALES_DATA_DIR = fileURLToPath(
  new URL("../../../../data/mirelo/", import.meta.url),
);
