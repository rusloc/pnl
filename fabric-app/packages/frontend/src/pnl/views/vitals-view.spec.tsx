// Vitals view (redesign v4 build-brief §1; ADR-0012): 3 hero + 2 secondary + 5
// driver cards, each title · ⓘ · status chip · value · Δ rows; no sparklines,
// no bars; the ⓘ sub-metrics line follows its own zone.
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { emptyFigures } from '../data/sample-source';
import type { Figures, VitalsCard, ZoneKey, ZoneStatus } from '../model/types';
import { VitalsView } from './vitals-view';

function card(code: string, tier: VitalsCard['tier'], extra: Partial<VitalsCard> = {}): VitalsCard {
  return {
    code,
    label: `Card ${code}`,
    tier,
    value: '$1.0 m',
    rows: [
      { name: 'vs Budget', abs: '+9.2', rel: '+1.4%', tone: 'ahead' },
      { name: 'vs Prior year', abs: '+153.6', rel: '+29.9%', tone: 'neutral' },
    ],
    status: { kind: 'ahead', text: 'ahead' },
    info: { title: `Card ${code}`, what: 'What it is.', formula: null, values: [], source: 'KPI Value' },
    ...extra,
  };
}

function figures(status: Partial<Record<ZoneKey, ZoneStatus>> = {}, cards?: Figures['vitals'], info: Record<string, string> = {}): Figures {
  const zones = Object.fromEntries(['statement', 'vitals', 'vitalsInfo', 'bridge', 'profit', 'variances', 'variancesCut', 'profitability', 'concentration', 'bubble', 'heat', 'context'].map((z) => [z, { kind: 'live', requestId: 'r' }])) as Figures['zones'];
  const f = emptyFigures({ ...zones, ...status });
  return { ...f, vitals: cards ?? { results: [card('NR', 'hero'), card('EBITDA', 'hero'), card('OP', 'hero'), card('GM_PCT', 'secondary'), card('OPEX_PCT', 'secondary')], drivers: ['GMV', 'MERCHANTS', 'ARR', 'MIX', 'FY_OUTLOOK'].map((c) => card(c, 'driver')) }, vitalsInfo: info };
}

const article = (name: string) => screen.getByRole('article', { name });

describe('VitalsView', () => {
  it('renders the results (3 hero + 2 secondary) and the five drivers with title, chip, value and Δ rows; no sparklines or bars', () => {
    render(<VitalsView figures={figures()} />);
    expect(screen.getByRole('region', { name: 'Vitals' })).toBeVisible();
    expect(within(screen.getByTestId('vitals-results')).getAllByRole('article')).toHaveLength(5);
    expect(within(screen.getByTestId('vitals-drivers')).getAllByRole('article')).toHaveLength(5);
    const nr = article('Card NR');
    expect(within(nr).getByRole('heading', { level: 3 })).toHaveTextContent('Card NR');
    expect(within(nr).getByTestId('status-chip')).toHaveTextContent('ahead');
    expect(within(nr).getByTestId('status-chip')).toHaveAttribute('data-status', 'ahead');
    expect(within(nr).getByTestId('card-value')).toHaveTextContent('$1.0 m');
    const rows = within(nr).getAllByTestId('delta-row');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('vs Budget+9.2+1.4%');
    expect(rows[1]).toHaveTextContent('vs Prior year+153.6+29.9%');
    expect(document.querySelector('[data-testid="compare-bar"]')).toBeNull();
    expect(document.querySelector('svg.spark, .spark')).toBeNull();
  });

  it('shows "on plan", an empty abs cell on ratio cards and no chip on a neutral card', () => {
    const opex = card('OPEX_PCT', 'secondary', { value: '39.0%', rows: [{ name: 'vs Budget', abs: null, rel: 'on plan', tone: 'plan' }], status: { kind: 'ontrack', text: 'on track' } });
    const mix = card('MIX', 'driver', { value: '37.5% / 45.3%', rows: [{ name: 'Sub / Pay vs PY', abs: null, rel: '−2.6 pp / +2.6 pp', tone: 'neutral' }], status: null });
    render(<VitalsView figures={figures({}, { results: [opex], drivers: [mix] })} />);
    expect(within(article('Card OPEX_PCT')).getByTestId('delta-row')).toHaveTextContent(/^vs Budgeton plan$/);
    expect(within(article('Card OPEX_PCT')).getByTestId('status-chip')).toHaveTextContent('on track');
    expect(within(article('Card MIX')).queryByTestId('status-chip')).toBeNull();
    expect(within(article('Card MIX')).getByTestId('card-value')).toHaveTextContent('37.5% / 45.3%');
  });

  it('the ⓘ carries the definition, the sub-metrics from the info zone (or its state) and the source', () => {
    render(<VitalsView figures={figures({ vitalsInfo: { kind: 'loading' } }, undefined, { NR: 'Organic growth +27.5% - reported +29.9% vs prior year' })} />);
    fireEvent.click(within(article('Card NR')).getByRole('button', { name: 'About Card NR' }));
    let dialog = screen.getByRole('dialog', { name: 'Card NR' });
    expect(within(dialog).getByText('What it is.')).toBeVisible();
    expect(within(dialog).getByTestId('info-detail')).toHaveTextContent('reading from the semantic model');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    const { unmount } = render(<VitalsView figures={figures({}, undefined, { NR: 'Organic growth +27.5% - reported +29.9% vs prior year' })} />);
    fireEvent.click(screen.getAllByRole('button', { name: 'About Card NR' })[1]);
    dialog = screen.getByRole('dialog', { name: 'Card NR' });
    expect(within(dialog).getByTestId('info-detail')).toHaveTextContent('Organic growth +27.5% - reported +29.9% vs prior year');
    expect(within(dialog).getByTestId('info-source')).toHaveTextContent('KPI Value');
    unmount();
  });

  it('shows the zone state instead of cards while loading, on error, and the sample note when the mockup has no figures', () => {
    const { rerender } = render(<VitalsView figures={figures({ vitals: { kind: 'loading' } }, { results: [], drivers: [] })} />);
    expect(screen.getByRole('status')).toHaveTextContent(/Reading vitals/);
    expect(screen.queryByRole('article')).toBeNull();
    rerender(<VitalsView figures={figures({ vitals: { kind: 'error', reason: 'timeout', requestId: 'req-1' } }, { results: [], drivers: [] })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(/timeout/);
    rerender(<VitalsView figures={{ ...figures({ vitals: { kind: 'sample' } }, { results: [], drivers: [] }), sample: true }} />);
    expect(screen.getByTestId('sample-empty')).toHaveTextContent(/No sample figures for the vitals/);
  });
});
