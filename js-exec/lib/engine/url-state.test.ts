import { describe, expect, it } from 'vitest';
import { DEFAULT_SELECTION, parseSelection, serializeSelection } from './url-state.ts';

// E-62: the query string is validated at the boundary; unknown keys ignored, invalid values fall back to defaults.

const parse = (q: string) => parseSelection(new URLSearchParams(q));

describe('URL state', () => {
  it('empty query → defaults; defaults serialise to an empty query', () => {
    expect(parse('')).toEqual(DEFAULT_SELECTION);
    expect(serializeSelection(DEFAULT_SELECTION)).toBe('');
  });

  it('round-trips every switcher and pick in canonical order', () => {
    const s = parse('p=ytd&c=lw&r=be&lever=cash,sales&group=B3&owner=supply');
    expect(s).toMatchObject({ period: 'ytd', compare: 'lw', region: 'be' });
    expect(s.picks).toEqual({ group: ['B3'], lever: ['sales', 'cash'], horizon: [], owner: ['supply'], statement: [] });
    expect(serializeSelection(s)).toBe('p=ytd&c=lw&r=be&group=B3&lever=sales%2Ccash&owner=supply');
    expect(parse(serializeSelection(s))).toEqual(s);
  });

  it('invalid values fall back per key; unknown keys and codes are dropped; Forecast is not a comparator', () => {
    const s = parse('p=month&c=fcst&r=%3Cscript%3E&group=B9,B1,B1&statement=&zzz=1');
    expect(s).toEqual({ ...DEFAULT_SELECTION, picks: { ...DEFAULT_SELECTION.picks, group: ['B1'] } });
    expect(serializeSelection(s)).toBe('group=B1');
  });

  it('an oversized attribute value is ignored', () => {
    expect(parse(`group=${'B1,'.repeat(200)}`).picks.group).toEqual([]);
  });
});
