// Largest variances view model (C-45, redesign v4 page 2): ranking, Top-N, block
// grouping with full block subtotals, the n.m. rule, the coverage footer, the
// shared scale and the cut's member segments, all derived from the model's level
// columns (ADR-0006 §16) so no control re-queries.
import { describe, expect, it } from 'vitest';

import type { VarianceLeaf, VarianceMembers } from './types';
import { cutAllocates, largestVariances, VARIANCE_BLOCKS } from './variances';

function leaf(block: string, blockName: string, code: string, label: string, base: number | null, comparison: number | null, extra: Partial<VarianceLeaf> = {}): VarianceLeaf {
  return { rowKey: `${block}|${code}`, code, label, block, blockName, lineSort: VARIANCE_BLOCKS.indexOf(block) * 10, accountSort: 1, base, comparison, deltaB: null, fx: null, belowCm: false, ...extra };
}

// Commerce Cloud-like leaves: revenue lines booked at slice grain, opex below CM.
const LEAVES: VarianceLeaf[] = [
  leaf('GR', 'Gross revenue', 'GR_S1', 'Subscription platform fees', 256.3, 260.9, { deltaB: 40.1, fx: 4.3 }),
  leaf('GR', 'Gross revenue', 'GR_S2', 'Payments & transaction fees', 308.5, 297.5, { deltaB: 60.2, fx: 5.1 }),
  leaf('GR', 'Gross revenue', 'GR_S4', 'Professional services', 49.0, 43.0, { deltaB: 8.0, fx: 0.7 }),
  leaf('GTN', 'Gross-to-net deductions', 'GTN_S2', 'Free-trial credits', -3.7, -2.4, { deltaB: -1.0, fx: -0.1 }),
  leaf('COR', 'Cost of revenue', 'COR_S2', 'Payment processing', -212.9, -206.7, { deltaB: -40.0, fx: -3.6 }),
  leaf('SM', 'Sales & marketing', 'SM_S1', 'Performance marketing', -48.2, -47.7, { deltaB: -8.0, fx: -0.8, belowCm: true }),
  leaf('SM', 'Sales & marketing', 'SM_S2', 'Sales headcount', -41.0, -41.0, { deltaB: -5.0, fx: -0.6, belowCm: true }),
  leaf('RD', 'Research & development', 'RD_S1', 'Engineering', -84.9, -83.4, { deltaB: -12.0, fx: -1.2, belowCm: true }),
  leaf('OOI', 'Other operating income / (expense)', 'OOI_S1', 'FX gains', 0.3, 1.0, { deltaB: 0.1, fx: 0, belowCm: true }),
  leaf('ADJ', 'Adjusting items', 'ADJ_S1', 'Restructuring', -1.2, -0.9, { deltaB: -0.2, fx: 0, belowCm: true }),
  // Below operating profit: never part of the table.
  leaf('TAX', 'Income tax expense', 'TAX_S1', 'Income tax', -12.0, -11.0),
];

const base = { top: 8 as const, mode: 'block' as const, collapsed: new Set<string>() };

describe('largestVariances', () => {
  it('keeps leaves down to operating profit, ranks by |Δ|, prints the LV texts and the coverage footer', () => {
    const vm = largestVariances(LEAVES, null, { ...base, mode: 'abs' }, 'm', true);
    const leaves = vm.rows.filter((r) => r.kind === 'leaf');
    expect(leaves).toHaveLength(8);
    expect(leaves.map((r) => r.key).slice(0, 3)).toEqual(['GR|GR_S2', 'COR|COR_S2', 'GR|GR_S4']);
    expect(leaves[0]).toMatchObject({ comparison: '297.5', actual: '308.5', deltaText: '+11.0', deltaPct: '+3.7%', py: '+60.2', fx: '+5.1', tone: 'ahead', blockName: 'Gross revenue', alloc: false });
    expect(leaves[1]).toMatchObject({ deltaText: '−6.2', deltaPct: '−3.0%', tone: 'off' });
    // Flat mode has no block rows; the footer always has three rows and the total is the operating-profit Δ.
    expect(vm.rows.some((r) => r.kind === 'block')).toBe(false);
    expect(vm.footer.map((f) => f.key)).toEqual(['SHOWN', 'OTHER', 'TOTAL']);
    const total = vm.footer[2];
    expect(total.delta).toBeCloseTo(11.0 + 6.0 - 4.6 - 1.3 - 6.2 - 0.5 + 0 - 1.5 - 0.7 - 0.3, 6);
    expect(vm.footer[0].delta + vm.footer[1].delta).toBeCloseTo(total.delta, 6);
    expect(vm.footer[0].label).toMatch(/^Shown lines \(8\) - coverage \d+%$/);
    expect(vm.footer[1].label).toBe('All other lines (2)');
    expect(vm.coverage).toBeGreaterThan(0.9);
    expect(vm.scale).toBe(11.0);
    expect(vm.rows.some((r) => r.key === 'TAX|TAX_S1')).toBe(false);
  });

  it('block mode groups the shown leaves under their block in P&L order with the full subtotal and "n of m lines"', () => {
    const vm = largestVariances(LEAVES, null, base, 'm', true);
    const blocks = vm.rows.filter((r) => r.kind === 'block');
    expect(blocks.map((b) => b.key)).toEqual(['GR', 'GTN', 'COR', 'SM', 'RD', 'OOI']);
    // Gross revenue: 3 of 3 lines shown, subtotal = Σ of every leaf of the block.
    expect(blocks[0]).toMatchObject({ label: 'Gross revenue', count: '3 of 3 lines', actual: '613.8', comparison: '601.4', deltaText: '+12.4', deltaPct: '+2.1%', py: '+108.3', fx: '+10.1' });
    // Sales & marketing: only the larger leaf is in the top 8; the block still carries both.
    const sm = blocks.find((b) => b.key === 'SM');
    expect(sm).toMatchObject({ count: '1 of 2 lines', deltaText: '−0.5' });
    expect(vm.rows.findIndex((r) => r.key === 'SM|SM_S1')).toBe(vm.rows.indexOf(sm!) + 1);
    expect(vm.rows.some((r) => r.key === 'SM|SM_S2')).toBe(false);
  });

  it('Top 12 / All and collapsed blocks', () => {
    expect(largestVariances(LEAVES, null, { ...base, top: 12, mode: 'abs' }, 'm', true).rows).toHaveLength(10);
    const all = largestVariances(LEAVES, null, { ...base, top: 'all' }, 'm', true);
    expect(all.coverage).toBe(1);
    expect(all.rows.filter((r) => r.kind === 'block').map((r) => r.key)).toEqual(['GR', 'GTN', 'COR', 'SM', 'RD', 'OOI', 'ADJ']);
    const collapsed = largestVariances(LEAVES, null, { ...base, top: 'all', collapsed: new Set(['GR', 'SM']) }, 'm', true);
    expect(collapsed.rows.find((r) => r.key === 'GR')?.collapsed).toBe(true);
    expect(collapsed.rows.some((r) => r.key === 'GR|GR_S1')).toBe(false);
    expect(collapsed.rows.some((r) => r.key === 'COR|COR_S2')).toBe(true);
  });

  it('n.m. when |comparison| < 2.0 display units or |Δ %| > 50 %, in the selected units', () => {
    const vm = largestVariances(LEAVES, null, { ...base, top: 'all', mode: 'abs' }, 'm', true);
    const pct = (key: string) => vm.rows.find((r) => r.key === key)?.deltaPct;
    expect(pct('OOI|OOI_S1')).toBe('n.m.'); // |1.0| < 2.0
    expect(pct('ADJ|ADJ_S1')).toBe('n.m.'); // |0.9| < 2.0
    expect(pct('GTN|GTN_S2')).toBe('n.m.'); // |−1.3 ÷ 2.4| = 54 % > 50 %
    expect(pct('GR|GR_S4')).toBe('+14.0%');
    // In thousands the same comparisons are far above 2.0 k, so the 50 % rule is the only one left.
    const k = largestVariances(LEAVES, null, { ...base, top: 'all', mode: 'abs' }, 'k', true);
    expect(k.rows.find((r) => r.key === 'OOI|OOI_S1')?.deltaPct).toBe('n.m.');
    expect(k.rows.find((r) => r.key === 'ADJ|ADJ_S1')?.deltaPct).toBe('−33.3%');
    expect(k.rows.find((r) => r.key === 'GR|GR_S4')?.actual).toBe('49,000');
  });

  it('drops the vs Compare B column when Compare B is None (PV-05) and marks a zero Δ "plan"', () => {
    const vm = largestVariances(LEAVES, null, { ...base, mode: 'abs', top: 'all' }, 'm', false);
    expect(vm.hasPy).toBe(false);
    expect(vm.rows.every((r) => r.py === '')).toBe(true);
    expect(vm.rows.find((r) => r.key === 'SM|SM_S2')).toMatchObject({ deltaText: '0.0', tone: 'plan' });
  });

  it('a cut splits every bar into member segments; below-CM rows are "alloc." unless cut by Region / Entity', () => {
    const members: VarianceMembers = {
      cut: 'line',
      members: [
        { key: 'SUB', label: 'Platform subscriptions' },
        { key: 'PAY', label: 'Payments' },
      ],
      deltas: { 'GR|GR_S2': { SUB: 2.0, PAY: 9.0 }, 'SM|SM_S1': { SUB: -0.2, PAY: -0.3 }, 'SM|SM_S2': { SUB: 0.1, PAY: -0.1 } },
    };
    const vm = largestVariances(LEAVES, members, { ...base, top: 'all' }, 'm', true);
    expect(vm.legend.map((l) => l.label)).toEqual(['Platform subscriptions', 'Payments']);
    const pay = vm.rows.find((r) => r.key === 'GR|GR_S2')!;
    expect(pay.members.map((m) => [m.key, m.text])).toEqual([
      ['SUB', '+2.0'],
      ['PAY', '+9.0'],
    ]);
    expect(pay.alloc).toBe(false);
    expect(vm.rows.find((r) => r.key === 'SM|SM_S1')?.alloc).toBe(true);
    // The block's segments are the sum of its leaves' segments.
    expect(vm.rows.find((r) => r.key === 'SM')?.members.map((m) => m.delta)).toEqual([-0.1, -0.4]);
    expect(vm.rows.find((r) => r.key === 'SM')?.alloc).toBe(true);
    expect(vm.rows.find((r) => r.key === 'GR')?.alloc).toBe(false);
    expect(largestVariances(LEAVES, { ...members, cut: 'region' }, { ...base, top: 'all' }, 'm', true).rows.every((r) => !r.alloc)).toBe(true);
    expect(['none', 'region', 'entity', 'channel', 'line', 'segment'].map((c) => cutAllocates(c as never))).toEqual([false, false, false, true, true, true]);
  });
});
