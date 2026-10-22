// Expand / collapse rules of the statement (M-20, M-21, M-22; ADR-0007 §2.3).
import { describe, expect, it } from 'vitest';

import { COLLAPSED, expandableCodes, toggleOpen, visibleRows } from './statement-rows';
import type { StatementRow, StatementValues } from './types';

const zero: StatementValues = { base: null, pctNr: null, cmpA: null, dA: null, dApct: null, cmpB: null, dB: null, dBpct: null, fyBud: null, fyLe: null, fyD: null };
const some: StatementValues = { ...zero, base: 10 };

function row(code: string, parent: string | null, kind: StatementRow['kind'], values: StatementValues = some): StatementRow {
  return { code, parent, kind, label: code, alias: '', tags: [], values, barFraction: null, neutralDelta: false };
}

const rows: StatementRow[] = [
  row('GR', null, 'sec'),
  row('GR.A', 'GR', 'leaf'),
  row('GR.B', 'GR', 'leaf', zero),
  row('NR', null, 'key'),
  row('OPEX', null, 'grp'),
  row('OPEX.SM', 'OPEX', 'grp'),
  row('OPEX.SM.1', 'OPEX.SM', 'leaf'),
  row('GM', null, 'ratio'),
];

describe('expandableCodes / COLLAPSED / toggleOpen (M-20)', () => {
  it('Expand all = every row with children, Collapse all = none', () => {
    expect([...expandableCodes(rows)].sort()).toEqual(['GR', 'OPEX', 'OPEX.SM']);
    expect(COLLAPSED.size).toBe(0);
  });

  it('a row toggles on its own without touching the others', () => {
    const open = toggleOpen(expandableCodes(rows), 'OPEX');
    expect(open.has('OPEX')).toBe(false);
    expect(open.has('GR')).toBe(true);
    expect(toggleOpen(open, 'OPEX').has('OPEX')).toBe(true);
    expect(toggleOpen(COLLAPSED, 'GR').has('GR')).toBe(true);
  });
});

describe('visibleRows (M-20, M-22)', () => {
  it('collapsed shows blocks, subtotals and ratios only; depth follows the open ancestors', () => {
    const visible = visibleRows(rows, COLLAPSED, { hideEmpty: true });
    expect(visible.map((v) => v.row.code)).toEqual(['GR', 'NR', 'OPEX', 'GM']);
    expect(visible.map((v) => v.hasChildren)).toEqual([true, false, true, false]);
    expect(visible.every((v) => v.depth === 0 && !v.open)).toBe(true);
  });

  it('expand all shows every leaf whose ancestors are open, hiding empty leaves (M-22, T-16)', () => {
    const all = visibleRows(rows, expandableCodes(rows), { hideEmpty: true });
    expect(all.map((v) => v.row.code)).toEqual(['GR', 'GR.A', 'NR', 'OPEX', 'OPEX.SM', 'OPEX.SM.1', 'GM']);
    expect(all.find((v) => v.row.code === 'OPEX.SM.1')?.depth).toBe(2);
    const withEmpty = visibleRows(rows, expandableCodes(rows), { hideEmpty: false });
    expect(withEmpty.map((v) => v.row.code)).toContain('GR.B');
  });

  it('a grandchild stays hidden while its parent is closed even if the grandparent is open', () => {
    const visible = visibleRows(rows, new Set(['OPEX']), { hideEmpty: true });
    expect(visible.map((v) => v.row.code)).toEqual(['GR', 'NR', 'OPEX', 'OPEX.SM', 'GM']);
  });
});
