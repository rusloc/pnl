import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { FILES, manifestSchema } from './manifest.ts';

// Contract §2.5, §8 step 1: the shipped manifest strict-parses and matches the source facts (run `npm run build:data`).

const read = () =>
  JSON.parse(
    readFileSync(fileURLToPath(new URL('../../public/data/manifest.json', import.meta.url)), 'utf8'),
  ) as Record<string, unknown>;

describe('shipped manifest', () => {
  it('strict-parses and lists every FILES entry', () => {
    const m = manifestSchema.parse(read());
    expect(m.meta).toMatchObject({
      calendar_first: '2022-10-29',
      calendar_last: '2023-04-02',
      fact_first: '2022-11-01',
      fact_last: '2023-03-26',
      month_plan_first: '2023-01-01',
    });
    expect(Object.keys(m.files).sort()).toEqual(Object.keys(FILES).sort());
    expect(m.files.timeWeek.rows).toBe(2688);
    expect(m.files.planMonth.rows).toBe(1533);
    expect(m.files.planWeek.rows).toBe(2522);
    expect(m.files.rockWeek.rows).toBe(2671);
    expect(m.offices.map((o) => o.office_name)).toEqual(['B1', 'K1', 'K2', 'K3', 'M2', 'T1']);
    expect(m.weeks[0]?.week_label).toBe('44 (29.10-4.11)');
    expect(m.weeks[22]?.days).toBe(2);
  });
  it('rejects unknown fields (strict)', () => {
    expect(manifestSchema.safeParse({ ...read(), extra: 1 }).success).toBe(false);
  });
});
