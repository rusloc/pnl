import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Dataset } from '@/lib/data/dataset';
import { createEngine } from '@/lib/engine';
import type { Units } from '@/lib/engine/format';
import { hideEmptyLines } from '@/lib/engine/hide-empty';
import type { Selection } from '@/lib/engine/types';
import { loadPublicDataset } from '@/lib/test-utils/public-data';
import { selection } from '@/lib/test-utils/selection';
import { collapsedRows, expandedRows, openRows } from './expansion';
import { StatementTable } from './StatementTable';

// Server render of the statement with real engine output: the table shows engine numbers formatted by format.ts.
let ds: Dataset;
beforeAll(async () => {
  ds = await loadPublicDataset(['P']);
});

const MILLIONS: Units = { divisor: 1_000_000, decimals: 1 };
const THOUSANDS: Units = { divisor: 1_000, decimals: 0 };
const rowsOf = (sel: Selection, units = MILLIONS) => hideEmptyLines(createEngine(ds).statement(sel).rows, sel, units);
const render = (sel: Selection, open?: ReadonlySet<string>, units = MILLIONS) => {
  const rows = rowsOf(sel, units);
  return renderToStaticMarkup(
    <StatementTable
      rows={rows}
      sel={sel}
      windowLabel="YTD Sep 2026"
      format={{ units, unitsLabel: 'USD m', costMultiplier: sel.costSign === 'POS' ? -1 : 1 }}
      open={open ?? expandedRows(rows)}
      onToggle={() => undefined}
      onExpandAll={() => undefined}
      onCollapseAll={() => undefined}
    />,
  );
};
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

describe('StatementTable (Variance layout)', () => {
  it('shows the README headline figures and the column groups, titled "<window> - <version>"', () => {
    const html = render(selection());
    expect(html).toContain('3,398.5'); // net revenue, Consumer Products YTD Sep 2026
    expect(html).toContain('682.6'); // Adj. EBITDA
    expect(html).toContain('YTD Sep 2026 - Actual'); // parity rule 12
    expect(html).toContain('vs Budget');
    expect(html).toContain('vs Prior year');
    expect(html).toContain('Full year 2026');
    expect(html).toContain('Net sales'); // alias as secondary label (L-11)
    expect(text(html)).not.toContain(' · '); // parity rule 6
    expect(html).toContain('Line - USD m');
  });

  it('F-15: costs as positives flips cost rows only; Δ keeps its sign', () => {
    const neg = render(selection());
    const pos = render(selection({ costSign: 'POS' }));
    expect(neg).toContain('−1,719.3'); // cost of revenue
    expect(pos).toContain('>1,719.3<');
    expect(pos).not.toContain('−1,719.3');
    expect(pos).toContain('+19.3'); // COR below budget: Δ stays positive (favourable)
  });

  it('Compare B = None removes its column group (F-07)', () => {
    expect(render(selection({ compareB: 'NONE' }))).not.toContain('vs Prior year');
  });
});

describe('numbered rows (parity rule 11)', () => {
  it('report lines read "01. GROSS REVENUE" … "29. NET MARGIN %"; accounts keep their names', () => {
    const html = render(selection());
    expect(html).toContain('>01. GROSS REVENUE<');
    expect(html).toContain('>10. OPERATING EXPENSES<');
    expect(html).toContain('>29. NET MARGIN %<');
    expect(html).toContain('>Gross product sales<'); // an account, not numbered or in capitals
  });
});

describe('opens collapsed; Expand all / Collapse all (M-20, M-21, parity rule 5)', () => {
  const rows = () => createEngine(ds).statement(selection()).rows;

  it('collapsed = all 29 report lines, no account (blocks and subtotals only, as Track B)', () => {
    const html = render(selection(), collapsedRows(rows()));
    expect(html.match(/>\d\d\. [^<]+</g)).toHaveLength(29);
    expect(html).toContain('>11. SALES &amp; MARKETING<'); // the opex blocks show under Operating expenses
    expect(html).not.toContain('Gross product sales');
    expect(html).not.toContain('Advertising: working media');
    expect([...collapsedRows(rows())]).toEqual(['OPEX']);
  });

  it('Expand all opens every row with children, so every account shows', () => {
    const open = expandedRows(rows());
    expect(open).toEqual(new Set(rows().flatMap((r) => (r.parent === null ? [] : [r.parent]))));
    const html = render(selection(), open);
    expect(html).toContain('Gross product sales');
    expect(html).toContain('Advertising: working media');
  });

  it('M-21: the open rows survive every filter change; another company opens collapsed', () => {
    const collapsed = collapsedRows(rows());
    const mine = new Set(['OPEX', 'SM', 'GR']);
    expect(openRows({ entity: 'P', open: mine }, 'P', collapsed)).toBe(mine);
    expect(openRows({ entity: 'P', open: null }, 'P', collapsed)).toBe(collapsed);
    expect(openRows({ entity: 'P', open: mine }, 'S', collapsed)).toBe(collapsed);
  });

  it('the buttons sit above the line column, before the table', () => {
    const html = render(selection(), collapsedRows(rows()));
    const tools = html.indexOf('aria-label="Statement rows"');
    expect(tools).toBeGreaterThan(-1);
    expect(tools).toBeLessThan(html.indexOf('<table'));
    expect(text(html)).toMatch(/Expand all Collapse all/);
  });
});

describe('Hide empty lines (M-22, T-16, parity rule 2)', () => {
  const codes = (sel: Selection, units = MILLIONS) => rowsOf(sel, units).map((r) => r.code);
  const all = (sel: Selection) => createEngine(ds).statement(sel).rows;

  it('on by default: a leaf that shows only zeros is hidden; off shows it', () => {
    expect(codes(selection())).not.toContain('ADJ_2'); // all zero in every column
    expect(codes(selection({ hideEmpty: false }))).toContain('ADJ_2');
  });

  it('T-16: never hides a block, subtotal, ratio or group total', () => {
    const sel = selection({ fy: 2024, timeView: 'FY', month: 12 });
    const kept = new Set(codes(sel));
    for (const r of all(sel)) if (r.kind !== 'leaf') expect(kept.has(r.code)).toBe(true);
    expect(kept.has('ADJ')).toBe(true); // its three accounts are all empty in FY2024, the block stays
    expect(['ADJ_1', 'ADJ_2', 'ADJ_3'].some((c) => kept.has(c))).toBe(false);
  });

  it('rounds in the selected units: 3.7 k shows in thousands, rounds to 0.0 in millions', () => {
    const sel = selection({ fy: 2024, timeView: 'FY', month: 12 }); // OOI_2 = USD 3,670 in FY2024
    expect(codes(sel, MILLIONS)).not.toContain('OOI_2');
    expect(codes({ ...sel, units: 'K' }, THOUSANDS)).toContain('OOI_2');
  });

  it('judges the visible columns only: a value in a hidden column does not keep the line', () => {
    const sel = selection({ fy: 2024, month: 1, timeView: 'MTD' }); // OOI_1: 0.0 in the window, 0.1 in FY LE
    expect(codes(sel)).toContain('OOI_1');
    expect(codes({ ...sel, showFyOutlook: false })).not.toContain('OOI_1');
  });
});
