import { beforeAll, describe, expect, it } from 'vitest';
import { loadExecData } from '../test-utils/exec-data.ts';
import { catalog } from './items.ts';
import type { Catalog } from './items.ts';
import { DEFAULT_SELECTION, parseSelection, serializeSelection } from './url-state.ts';

// E-62: the query string is validated at the boundary; unknown keys ignored, invalid values fall back to defaults.
// Item `i`, legacy `p` and `c=lw`: period-model.test.ts (ET-28).

let cat: Catalog;
beforeAll(async () => {
  cat = catalog(await loadExecData());
});
const parse = (q: string) => parseSelection(new URLSearchParams(q), cat);

describe('URL state', () => {
  it('empty query → defaults; defaults serialise to an empty query', () => {
    expect(parse('')).toEqual(DEFAULT_SELECTION);
    expect(serializeSelection(DEFAULT_SELECTION)).toBe('');
  });

  it('round-trips every switcher and pick in canonical order', () => {
    const s = parse('i=FY2026-Q4&c=prev&r=be&lever=cash,sales&group=B3&owner=supply');
    expect(s).toMatchObject({ item: 'FY2026-Q4', compare: 'prev', region: 'be' });
    expect(s.picks).toEqual({ group: ['B3'], lever: ['sales', 'cash'], owner: ['supply'] });
    expect(serializeSelection(s)).toBe('i=FY2026-Q4&c=prev&r=be&group=B3&lever=sales%2Ccash&owner=supply');
    expect(parse(serializeSelection(s))).toEqual(s);
  });

  it('invalid values fall back per key; unknown keys and codes are dropped; Forecast is not a comparator', () => {
    const s = parse('p=month&i=FY2026-M10&c=fcst&r=%3Cscript%3E&group=B9,B1,B1&statement=&zzz=1');
    expect(s).toEqual({ ...DEFAULT_SELECTION, picks: { ...DEFAULT_SELECTION.picks, group: ['B1'] } });
    expect(serializeSelection(s)).toBe('group=B1');
  });

  it('retired Statement and Horizon keys (USER 2026-10-29) still parse: ignored, no pick, dropped from the query', () => {
    const s = parse('statement=pl,bs&horizon=week,month&owner=finance');
    expect(s.picks).toEqual({ ...DEFAULT_SELECTION.picks, owner: ['finance'] });
    expect(Object.keys(s.picks)).toEqual(['group', 'lever', 'owner']);
    expect(serializeSelection(s)).toBe('owner=finance');
    expect(parse('statement=ops')).toEqual(DEFAULT_SELECTION);
    expect(parse('horizon=quarter')).toEqual(DEFAULT_SELECTION);
  });

  it('an oversized attribute value is ignored', () => {
    expect(parse(`group=${'B1,'.repeat(200)}`).picks.group).toEqual([]);
  });
});
