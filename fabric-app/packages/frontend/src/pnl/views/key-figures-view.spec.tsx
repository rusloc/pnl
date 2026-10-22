// Key figures view (docs/design/kpi-card-v2.md): label with the definition as
// its tooltip, value, sub-lines, then one comparison row per active Compare —
// a diverging bar on the shared scale and the Δ text with its arrow.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { Figures, KpiCompare, KpiTile } from '../model/types';
import { KeyFiguresView } from './key-figures-view';

function tile(code: string, compares: KpiCompare[], extra: Partial<KpiTile> = {}): KpiTile {
  return { code, label: `Tile ${code}`, hint: '', value: '1.0', sublines: [], compares, ...extra };
}

function figures(financial: KpiTile[], operational: KpiTile[] = []): Figures {
  return {
    sample: false,
    zones: { statement: { kind: 'loading' }, kpi: { kind: 'live', requestId: 'r' }, bridge: { kind: 'loading' }, drivers: { kind: 'loading' }, profitability: { kind: 'loading' }, context: { kind: 'loading' } },
    notices: [],
    dataStatus: null,
    statement: [],
    financial,
    operational,
    bridge: { subtitle: '', steps: [], axisText: '' },
    drivers: [],
    profitability: { by: '', column: '', options: [], compareLabel: '', note: '', rows: [], cmAverageText: '', cmAveragePct: 0 },
  };
}

const article = (name: string) => screen.getByRole('article', { name });

describe('KeyFiguresView', () => {
  it('renders label (definition as tooltip), value, sub-line and one comparison row per compare, favourable right and unfavourable left', () => {
    const nrTile = tile(
      'NR',
      [
        { name: 'vs Budget', text: '+2.0%', tone: 'fav', bar: { fraction: 0.1, capped: false } },
        { name: 'vs Prior year', text: '−5.0%', tone: 'unf', bar: { fraction: -0.25, capped: false } },
      ],
      { hint: 'Gross revenue + GTN', value: '$3,398.5m', sublines: ['Margin 49.4%'] }
    );
    render(<KeyFiguresView figures={figures([nrTile])} />);
    const nr = article('Tile NR');
    expect(within(nr).getByRole('heading', { level: 3 })).toHaveAttribute('title', 'Gross revenue + GTN');
    expect(within(nr).getByText('$3,398.5m')).toBeVisible();
    expect(within(nr).getByText('Margin 49.4%')).toBeVisible();
    const rows = within(nr).getAllByTestId('compare-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent(/^vs Budget▲\+2\.0%$/);
    const favFill = within(rows[0]).getByTestId('compare-fill');
    expect(favFill).toHaveClass('bg-fav-bar');
    expect(favFill).toHaveStyle({ left: '50%', width: '5%' });
    expect(rows[1]).toHaveTextContent(/^vs Prior year▼−5\.0%$/);
    const unfFill = within(rows[1]).getByTestId('compare-fill');
    expect(unfFill).toHaveClass('bg-unf-bar');
    expect(unfFill).toHaveStyle({ left: '37.5%', width: '12.5%' });
    expect(within(nr).queryByTestId('compare-cap')).toBeNull();
  });

  it('caps a bar beyond the scale with a chevron, draws neutral rows in slate to the right, and shows n/a without a bar', () => {
    const x = tile('X', [
      { name: 'vs Budget', text: '+35.0%', tone: 'fav', bar: { fraction: 1, capped: true } },
      { name: 'vs Prior year', text: '−24.5%', tone: 'unf', bar: { fraction: -1, capped: true } },
      { name: 'vs Latest estimate', text: '−1.0 pp', tone: 'neutral', bar: { fraction: 0.2, capped: false } },
      { name: 'vs None', text: 'n/a', tone: 'neutral', bar: null },
    ]);
    render(<KeyFiguresView figures={figures([x])} />);
    const rows = within(article('Tile X')).getAllByTestId('compare-row');
    expect(within(rows[0]).getByTestId('compare-bar')).toHaveAttribute('data-capped', 'true');
    expect(within(rows[0]).getByTestId('compare-fill')).toHaveStyle({ left: '50%', width: '50%' });
    expect(within(rows[0]).getByTestId('compare-cap')).toHaveClass('right-px');
    expect(within(rows[1]).getByTestId('compare-fill')).toHaveStyle({ left: '0%', width: '50%' });
    expect(within(rows[1]).getByTestId('compare-cap')).toHaveClass('left-px');
    const neutral = within(rows[2]).getByTestId('compare-fill');
    expect(neutral).toHaveClass('bg-slate-400');
    expect(neutral).toHaveStyle({ left: '50%', width: '10%' });
    expect(within(rows[2]).queryByTestId('compare-cap')).toBeNull();
    expect(rows[3]).toHaveTextContent(/^vs Nonen\/a$/);
    expect(within(rows[3]).queryByTestId('compare-fill')).toBeNull();
    expect(within(rows[3]).queryByTestId('compare-cap')).toBeNull();
  });

  it('shows growth KPIs with the value and sub-line only, draws no fill for a zero Δ, and keeps operational tiles apart', () => {
    const growth = tile('ORG_GROWTH', [], { value: '+6.1%', sublines: ['Reported +8.2%'] });
    const flat = tile('GM_PCT', [{ name: 'vs Budget', text: '0.0 pp', tone: 'neutral', bar: { fraction: 0, capped: false } }]);
    render(<KeyFiguresView figures={figures([growth, flat], [tile('UNITS', [])])} />);
    const g = article('Tile ORG_GROWTH');
    expect(within(g).getByText('+6.1%')).toBeVisible();
    expect(within(g).getByText('Reported +8.2%')).toBeVisible();
    expect(within(g).queryByTestId('compare-row')).toBeNull();
    const zero = within(article('Tile GM_PCT')).getByTestId('compare-row');
    expect(zero).toHaveTextContent(/^vs Budget0\.0 pp$/);
    expect(within(zero).queryByTestId('compare-fill')).toBeNull();
    expect(within(article('Tile UNITS')).queryByTestId('compare-row')).toBeNull();
    expect(screen.getByRole('region', { name: 'Key figures' })).toBeVisible();
  });
});
