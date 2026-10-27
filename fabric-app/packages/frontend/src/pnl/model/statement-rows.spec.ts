// Expand / collapse rules of the statement (M-20, M-21, M-22; ADR-0007 §2.3).
import { describe, expect, it } from 'vitest';

import { COLLAPSED, expandableCodes, isEmptyLine, type StatementColumnSettings, toggleOpen, visibleRows, visibleValueKeys } from './statement-rows';
import type { StatementRow, StatementValues } from './types';

const zero: StatementValues = { base: null, pctNr: null, cmpA: null, dA: null, dApct: null, cmpB: null, dB: null, dBpct: null, fyBud: null, fyLe: null, fyD: null };
const some: StatementValues = { ...zero, base: 10 };

/** The default display settings: millions, both compares, every column on. */
const settings: StatementColumnSettings = { hideEmpty: true, units: 'm', compareA: 'BUD', compareB: 'PY', varianceFormat: 'both', showPctNr: true, showFyOutlook: true };
const at = (patch: Partial<StatementColumnSettings>): StatementColumnSettings => ({ ...settings, ...patch });

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
    const visible = visibleRows(rows, COLLAPSED, settings);
    expect(visible.map((v) => v.row.code)).toEqual(['GR', 'NR', 'OPEX', 'GM']);
    expect(visible.map((v) => v.hasChildren)).toEqual([true, false, true, false]);
    expect(visible.every((v) => v.depth === 0 && !v.open)).toBe(true);
  });

  it('expand all shows every leaf whose ancestors are open, hiding empty leaves (M-22, T-16)', () => {
    const all = visibleRows(rows, expandableCodes(rows), settings);
    expect(all.map((v) => v.row.code)).toEqual(['GR', 'GR.A', 'NR', 'OPEX', 'OPEX.SM', 'OPEX.SM.1', 'GM']);
    expect(all.find((v) => v.row.code === 'OPEX.SM.1')?.depth).toBe(2);
    const withEmpty = visibleRows(rows, expandableCodes(rows), at({ hideEmpty: false }));
    expect(withEmpty.map((v) => v.row.code)).toContain('GR.B');
  });

  it('a grandchild stays hidden while its parent is closed even if the grandparent is open', () => {
    const visible = visibleRows(rows, new Set(['OPEX']), settings);
    expect(visible.map((v) => v.row.code)).toEqual(['GR', 'NR', 'OPEX', 'OPEX.SM', 'GM']);
  });
});

// Parity rule 2: hide-empty rounds in the selected units, on the visible columns only.
describe('isEmptyLine / visibleValueKeys (M-22, parity rule 2)', () => {
  it('lists the value columns the display settings show, in column order', () => {
    expect(visibleValueKeys(settings)).toEqual(['base', 'pctNr', 'cmpA', 'dA', 'dApct', 'cmpB', 'dB', 'dBpct', 'fyBud', 'fyLe', 'fyD']);
    expect(visibleValueKeys(at({ compareA: 'NONE', showPctNr: false, showFyOutlook: false }))).toEqual(['base', 'cmpB', 'dB', 'dBpct']);
    expect(visibleValueKeys(at({ varianceFormat: 'pct', showFyOutlook: true }))).toEqual(['base', 'pctNr', 'cmpA', 'dApct', 'cmpB', 'dBpct', 'fyBud', 'fyLe']);
    expect(visibleValueKeys(at({ varianceFormat: 'amount', compareB: 'NONE' }))).toEqual(['base', 'pctNr', 'cmpA', 'dA', 'fyBud', 'fyLe', 'fyD']);
  });

  it('a 40 k line is empty in millions (rounds to 0.0) but not in thousands (40)', () => {
    const values: StatementValues = { ...zero, base: 0.04 };
    expect(isEmptyLine(values, at({ units: 'm' }))).toBe(true);
    expect(isEmptyLine(values, at({ units: 'k' }))).toBe(false);
    // 0.4 k rounds to 0 in thousands too.
    expect(isEmptyLine({ ...zero, base: 0.0004 }, at({ units: 'k' }))).toBe(true);
    expect(isEmptyLine({ ...zero, base: -0.06 }, at({ units: 'm' }))).toBe(false);
  });

  it('a value in a hidden column does not keep the line visible', () => {
    const onlyFy: StatementValues = { ...zero, fyBud: 12 };
    expect(isEmptyLine(onlyFy, settings)).toBe(false);
    expect(isEmptyLine(onlyFy, at({ showFyOutlook: false }))).toBe(true);
    const onlyCmpB: StatementValues = { ...zero, cmpB: 3 };
    expect(isEmptyLine(onlyCmpB, at({ compareB: 'NONE' }))).toBe(true);
    const onlyDeltaPct: StatementValues = { ...zero, dApct: 0.3 };
    expect(isEmptyLine(onlyDeltaPct, at({ varianceFormat: 'amount' }))).toBe(true);
    expect(isEmptyLine(onlyDeltaPct, settings)).toBe(false);
    // Percent columns round to one decimal whatever the units.
    expect(isEmptyLine({ ...zero, pctNr: 0.04 }, at({ units: 'k' }))).toBe(true);
    expect(isEmptyLine({ ...zero, pctNr: 0.04 }, at({ units: 'k', showPctNr: false }))).toBe(true);
  });

  it('visibleRows applies it: the leaf shows in thousands and vanishes in millions', () => {
    const small: StatementRow[] = [row('GR', null, 'sec'), row('GR.A', 'GR', 'leaf', { ...zero, base: 0.04 })];
    expect(visibleRows(small, new Set(['GR']), at({ units: 'm' })).map((v) => v.row.code)).toEqual(['GR']);
    expect(visibleRows(small, new Set(['GR']), at({ units: 'k' })).map((v) => v.row.code)).toEqual(['GR', 'GR.A']);
  });
});
