import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createDatasetLoader } from '../data/dataset.ts';
import type { Dataset } from '../data/dataset.ts';
import type { EntityCode } from '../engine/types.ts';

// Node side of the loader for Vitest: reads the built public/data artifacts (run `npm run build:data` first).
const DIR = new URL('../../public/data/', import.meta.url);

const loader = createDatasetLoader(async (name) => {
  try {
    const bytes = await readFile(fileURLToPath(new URL(name, DIR)));
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  } catch (error) {
    throw new Error(`public/data/${name} unreadable — run \`npm run build:data\` first`, { cause: error });
  }
});

export const loadPublicDataset = (entities: readonly EntityCode[] = ['P', 'S']): Promise<Dataset> =>
  loader.load(entities);

export const DATA_DIR = fileURLToPath(new URL('../../../data/acme_pl_dummy_data/', import.meta.url));
