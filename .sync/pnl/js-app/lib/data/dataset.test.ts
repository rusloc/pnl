import { describe, expect, it } from 'vitest';
import { loadPublicDataset } from '../test-utils/public-data.ts';
import { createDatasetLoader } from './dataset.ts';

// The built artifacts read back through the same loader the browser uses (ADR-0002 §2.7).
describe('dataset loader', () => {
  it('reads every row of both entity files (ADR-0002 row counts)', async () => {
    const ds = await loadPublicDataset(['P', 'S']);
    expect(ds.pl.get('P')?.n).toBe(334_700);
    expect(ds.pl.get('S')?.n).toBe(88_012);
    expect(ds.manifest.files['pl-P.parquet'].rows).toBe(334_700);
    expect(ds.manifest.dict.version).toEqual(['ACT', 'BUD', 'FC2609']); // superseded FC2606 not shipped
  });

  it('caches per session and loads only the entities asked for', async () => {
    const names: string[] = [];
    const loader = createDatasetLoader(async (name) => {
      names.push(name);
      return new ArrayBuffer(0);
    });
    await expect(loader.load([])).rejects.toThrow(); // empty bytes are not a manifest …
    await expect(loader.load([])).rejects.toThrow(); // … and a failed read is retried, not cached
    expect(names).toEqual(['manifest.json', 'manifest.json']);
  });
});
