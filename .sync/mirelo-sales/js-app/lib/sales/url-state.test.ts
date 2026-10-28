import { beforeAll, describe, expect, it } from 'vitest';
import { loadSalesBase } from '../test-utils/sales-data.ts';
import { createUrlCodec } from './url-state.ts';
import type { UrlCodec } from './url-state.ts';
import { monthIndex } from './windows.ts';

// URL state is the input boundary of the route (layout-spec §6): every key validated, defaults omitted, junk dropped.

let codec: UrlCodec;
beforeAll(async () => {
  codec = createUrlCodec((await loadSalesBase()).manifest);
});
const q = (s: string) => new URLSearchParams(s);

describe('sales URL codec', () => {
  it('bare URL = spec default: Overview · All markets · Month · Sep 2026 · vs Budget', () => {
    expect(codec.parse(q(''))).toEqual({
      view: 'overview',
      market: 'ALL',
      tv: 'M',
      anchor: monthIndex('2026-09'),
      cmp: 'BUD',
      drill: null,
    });
    expect(codec.serialize(codec.defaults())).toBe('');
  });

  it('round-trips every key', () => {
    const s = 'view=portfolio&market=ro&period=r12m&month=2025-12&cmp=py&drill=client.123456';
    const sel = codec.parse(q(s));
    expect(sel).toEqual({
      view: 'portfolio',
      market: 'RO',
      tv: 'R',
      anchor: monthIndex('2025-12'),
      cmp: 'PY',
      drill: { kind: 'client', client: 123456 },
    });
    expect(codec.serialize(sel)).toBe(s);
    expect(codec.serialize(codec.parse(q('drill=loans.pt')))).toBe('drill=loans.pt');
    expect(codec.parse(q('drill=agent.A001')).drill).toEqual({ kind: 'agent', agent: 'A001' });
  });

  it('replaces invalid values by their default and drops unknown keys', () => {
    const sel = codec.parse(q('view=admin&market=DE&period=week&month=2026-10&cmp=LE&drill=agent.Z999&x=1'));
    expect(sel).toEqual(codec.defaults());
    expect(codec.serialize(sel)).toBe('');
    expect(codec.parse(q('month=2023-12')).anchor).toBe(monthIndex('2026-09')); // before the data
    expect(codec.parse(q('month=2026-10')).anchor).toBe(monthIndex('2026-09')); // open month
    expect(codec.parse(q('drill=client.<script>')).drill).toBeNull();
    expect(codec.parse(q('market=PL')).market).toBe('ALL'); // values are lower case
  });
});
