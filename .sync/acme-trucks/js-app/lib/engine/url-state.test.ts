import { beforeAll, describe, expect, it } from 'vitest';
import { loadDataset } from '../test-utils/trucks-data.ts';
import type { Dataset } from './data.ts';
import { RESET_SELECTION } from './selection.ts';
import { parseSelection, serializeSelection } from './url-state.ts';

// Contract §6: round-trips, defaults omitted, unknown keys ignored, invalid values fall back, the §6 deep links.

let ds: Dataset;
beforeAll(async () => {
  ds = await loadDataset();
});

const parse = (q: string) => parseSelection(new URLSearchParams(q), ds.m);
const canon = (q: string) => serializeSelection(parse(q), ds.m);

describe('url-state', () => {
  it('Reset state = every key absent', () => {
    expect(parse('')).toEqual(RESET_SELECTION);
    expect(serializeSelection(RESET_SELECTION, ds.m)).toBe('');
  });
  it('the deep links of §6 parse to the intended selection', () => {
    expect(parse('w=2023-10').week).toBe(ds.m.weeks.find((w) => w.week_label === '10 (4.3-10.3)')?.week_ix);
    expect(parse('pt=week&calc=linear')).toMatchObject({ planType: 'Week', calculation: 'Linear' });
    expect(parse('w=2022-44').week).toBe(0);
    expect(parse('w=2023-05&calc=linear&o=k3&wt=trucks,onspot,undefined')).toMatchObject({
      offices: ['K3'],
      workTypes: ['On spot', 'Trucks', 'Undefined'],
      calculation: 'Linear',
    });
  });
  it('parse → serialize → parse is idempotent; commas stay literal', () => {
    for (const q of [
      'w=2023-09',
      'o=k3,k1,k3',
      'l=ldr-12-09,LDR-12-12',
      'wt=undefined,trucks',
      'pt=week&calc=linear&o=k3',
    ]) {
      const a = canon(q);
      expect(canon(a)).toBe(a);
      expect(parse(a)).toEqual(parse(q));
      expect(a).not.toContain('%2C');
    }
    expect(canon('o=k3,k1,k3')).toBe('o=k1,k3');
    expect(canon('l=ldr-12-09')).toBe('l=LDR-12-09');
  });
  it('unknown keys are ignored and invalid values default', () => {
    expect(parse('zzz=1')).toEqual(RESET_SELECTION);
    expect(parse('w=2030-01').week).toBeNull();
    expect(parse('pt=year').planType).toBe('Month');
    expect(parse('wt=')).toMatchObject({ workTypes: RESET_SELECTION.workTypes });
    expect(parse('wt=nonsense')).toMatchObject({ workTypes: RESET_SELECTION.workTypes });
    expect(parse('o=k9,k1').offices).toEqual(['K1']);
    expect(parse(`o=${'k1,'.repeat(100)}`).offices).toEqual([]); // over the 256-character cap
  });
  it('all loaders but one round-trips, past the 256-character cap of the other keys', () => {
    const names = ds.m.loaders.map((l) => l.loader_name);
    const s = { ...RESET_SELECTION, loaders: names.slice(1) };
    const q = serializeSelection(s, ds.m);
    expect(q.length).toBeGreaterThan(256);
    expect(parseSelection(new URLSearchParams(q), ds.m)).toEqual(s);
  });
  it('an `l` longer than the whole loader list is invalid and dropped', () => {
    const names = ds.m.loaders.map((l) => l.loader_name);
    const overLong = `${names.join(',')},${'x'.repeat(10)}`;
    expect(parse(`l=${overLong}`)).toEqual(RESET_SELECTION);
    expect(parse(`l=${names[0]},${'x'.repeat(names.join(',').length)}`).loaders).toEqual([]);
  });
  it('all picked collapses to the default', () => {
    expect(canon('o=b1,k1,k2,k3,m2,t1')).toBe('');
    expect(canon('wt=trucks,onspot')).toBe('');
  });
});
