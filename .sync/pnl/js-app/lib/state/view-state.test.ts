import { describe, expect, it } from 'vitest';
import { VIEW_STATE_DEFAULTS, joinQuery, parseViewState, serializeViewState } from './view-state.ts';

const q = (s: string) => new URLSearchParams(s);

describe('view state (p, lvn, lvm, lvc)', () => {
  it('defaults are omitted and round-trip', () => {
    expect(parseViewState(q(''))).toEqual(VIEW_STATE_DEFAULTS);
    expect(serializeViewState(VIEW_STATE_DEFAULTS)).toBe('');
    const s = 'p=2&lvn=all&lvm=abs&lvc=line';
    expect(serializeViewState(parseViewState(q(s)))).toBe(s);
  });
  it('invalid values fall back to the default', () => {
    expect(parseViewState(q('p=3&lvn=5&lvm=x&lvc=entity'))).toEqual(VIEW_STATE_DEFAULTS);
  });
  it('joins with the selection query', () => {
    expect(joinQuery('e=S&v=analysis', 'p=2')).toBe('e=S&v=analysis&p=2');
    expect(joinQuery('', '')).toBe('');
  });
});
