import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FILES, manifestSchema, sourceManifestSchema } from './manifest.ts';

// Both manifests strict-parse (contract §2.4 item 1, §2.5, §8 step 1): the source the build reads and the shipped
// public/data/manifest.json it writes (run `npm run build:data` first).

const read = (rel: string) => JSON.parse(readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')) as unknown;
// The source dataset: the repo's data/ or, in the .sync pack, data-gen/acme-marketing/parquet once generated (ADR-0014
// item 10); absent in a fresh pack, where the shipped manifest is the only one to check.
const SOURCE = [
  '../../../data/acme_marketing_dummy_data/parquet/manifest.json',
  '../../../../data-gen/acme-marketing/parquet/manifest.json',
].find((rel) => existsSync(fileURLToPath(new URL(rel, import.meta.url))));

describe('manifests', () => {
  it.skipIf(SOURCE === undefined)('the source manifest parses (27 tables, 257,188 rows)', () => {
    const m = sourceManifestSchema.parse(read(SOURCE ?? ''));
    expect(m.tables).toHaveLength(27);
    expect(m.tables.reduce((s, t) => s + t.rows, 0)).toBe(257_188);
  });
  it('the shipped manifest parses and lists every FILES entry', () => {
    const m = manifestSchema.parse(read('../../public/data/manifest.json'));
    expect(m.meta).toMatchObject({ as_of: '2026-11-03', first_day: '2025-01-01', days: 672, currency: 'USD' });
    expect(Object.keys(m.files).sort()).toEqual(Object.keys(FILES).sort());
    expect(m.files.campaignDay.rows).toBe(10_198);
  });
  it('rejects unknown fields (strict)', () => {
    const m = read('../../public/data/manifest.json') as Record<string, unknown>;
    expect(manifestSchema.safeParse({ ...m, extra: 1 }).success).toBe(false);
  });
});
