import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Dataset } from '@/lib/data/dataset';
import { createEngine } from '@/lib/engine';
import type { Selection } from '@/lib/engine/types';
import { loadPublicDataset } from '@/lib/test-utils/public-data';
import { selection } from '@/lib/test-utils/selection';
import { StatementTable } from './StatementTable';

// Server render of the statement with real engine output: the table shows engine numbers formatted by format.ts.
let ds: Dataset;
beforeAll(async () => {
  ds = await loadPublicDataset(['P']);
});

const OPEN = new Set(['GR', 'GTN', 'COR', 'VSC', 'OPEX']);
const render = (sel: Selection) =>
  renderToStaticMarkup(
    <StatementTable
      rows={createEngine(ds).statement(sel).rows}
      sel={sel}
      windowLabel="YTD Sep 2026"
      format={{
        units: { divisor: 1_000_000, decimals: 1 },
        unitsLabel: 'USD m',
        costMultiplier: sel.costSign === 'POS' ? -1 : 1,
      }}
      open={OPEN}
      onToggle={() => undefined}
    />,
  );

describe('StatementTable (Variance layout)', () => {
  it('shows the README headline figures and the column groups', () => {
    const html = render(selection());
    expect(html).toContain('3,398.5'); // net revenue, Consumer Products YTD Sep 2026
    expect(html).toContain('682.6'); // Adj. EBITDA
    expect(html).toContain('YTD Sep 2026 · Actual');
    expect(html).toContain('vs Budget');
    expect(html).toContain('vs Prior year');
    expect(html).toContain('Full year 2026');
    expect(html).toContain('Net sales'); // alias as secondary label (L-11)
  });

  it('F-15: costs as positives flips cost rows only; Δ keeps its sign', () => {
    const neg = render(selection());
    const pos = render(selection({ costSign: 'POS' }));
    expect(neg).toContain('−1,719.3'); // cost of revenue
    expect(pos).toContain('>1,719.3<');
    expect(pos).not.toContain('−1,719.3');
    expect(pos).toContain('+19.3'); // COR below budget: Δ stays positive (favourable)
  });

  it('collapsed blocks hide their leaves; open blocks show them (M-20)', () => {
    const html = render(selection());
    expect(html).toContain('Gross product sales'); // GR open by default
    expect(html).not.toContain('Advertising: working media'); // SM closed by default
  });

  it('Compare B = None removes its column group (F-07)', () => {
    expect(render(selection({ compareB: 'NONE' }))).not.toContain('vs Prior year');
  });
});
