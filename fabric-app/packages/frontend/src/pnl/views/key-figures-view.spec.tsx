// Key figures view (K-24, K-25): values first, trends progressive per tile.
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TREND_LOADING_TEXT, TREND_UNAVAILABLE_TEXT } from '../model/sample-mode';
import type { Figures, KpiTile } from '../model/types';
import { KeyFiguresView } from './key-figures-view';

function tile(code: string, target: KpiTile['target'] = null): KpiTile {
  return { code, label: `Tile ${code}`, hint: '', value: '1.0', deltas: [], target };
}

function figures(trends: Figures['trends']): Figures {
  return {
    sample: false,
    zones: { statement: { kind: 'loading' }, kpi: { kind: 'live', requestId: 'r' }, bridge: { kind: 'loading' }, drivers: { kind: 'loading' }, profitability: { kind: 'loading' }, context: { kind: 'loading' } },
    notices: [],
    dataStatus: null,
    statement: [],
    financial: [tile('NR', { base: 80, marks: [{ name: 'Budget', value: 100, text: '100.0' }] }), tile('ORG_GROWTH')],
    operational: [tile('UNITS')],
    trends,
    bridge: { subtitle: '', steps: [], axisText: '' },
    drivers: [],
    profitability: { by: '', column: '', options: [], compareLabel: '', note: '', rows: [], cmAverageText: '', cmAveragePct: 0 },
  };
}

describe('KeyFiguresView', () => {
  it('renders every tile value with its own trend state: loading until the series arrives, the target bar at once', () => {
    render(<KeyFiguresView figures={figures({})} />);
    const nr = screen.getByRole('article', { name: 'Tile NR' });
    expect(within(nr).getByText('1.0')).toBeVisible();
    expect(within(nr).getByRole('status')).toHaveTextContent(TREND_LOADING_TEXT);
    expect(within(nr).getByTestId('target-bar')).toBeInTheDocument();
    const growth = screen.getByRole('article', { name: 'Tile ORG_GROWTH' });
    expect(within(growth).queryByTestId('target-bar')).toBeNull();
  });

  it('fills trends in per tile as they settle, ready or unavailable, without touching the others', () => {
    const points = Array.from({ length: 13 }, (_, i) => ({ month: `2026-${String(i + 1).padStart(2, '0')}`, value: i + 1, text: String(i + 1), isOpen: false }));
    render(
      <KeyFiguresView
        figures={figures({
          NR: { kind: 'ready', trend: { code: 'NR', points } },
          UNITS: { kind: 'unavailable', reason: 'no series' },
        })}
      />
    );
    expect(within(screen.getByRole('article', { name: 'Tile NR' })).getByTestId('sparkline')).toBeInTheDocument();
    expect(within(screen.getByRole('article', { name: 'Tile UNITS' })).getByText(TREND_UNAVAILABLE_TEXT)).toHaveAttribute('title', 'no series');
    expect(within(screen.getByRole('article', { name: 'Tile ORG_GROWTH' })).getByRole('status')).toHaveTextContent(TREND_LOADING_TEXT);
  });
});
