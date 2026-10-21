// Key interactions of the Ledger shell: company switch swaps the accent,
// rail collapse/expand, flyout open/close, tab switch, row expand/collapse,
// and the filter rules F-30 to F-32 as the user sees them.
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { sampleReference } from './data/sample-reference';
import { loadSampleFigures } from './data/sample-source';
import type { PnlDataSource } from './model/types';
import { PnlApp } from './pnl-app';
import { COMPANY_THEME } from './theme/company';

const offlineSource: PnlDataSource = {
  loadReference: async () => ({ reference: sampleReference() }),
  loadFigures: loadSampleFigures,
};

/** Same numbers, flagged as live: the filter pickers stay on (sample mode is tested in sample-mode.spec). */
const liveLikeSource: PnlDataSource = {
  loadReference: offlineSource.loadReference,
  loadFigures: async (filter, reference) => ({ ...(await loadSampleFigures(filter, reference)), sample: false }),
};

async function renderApp(initialView: 'pnl' | 'kpi' | 'ana' | 'prof' = 'pnl', source: PnlDataSource = offlineSource) {
  const utils = render(<PnlApp source={source} initialView={initialView} />);
  await screen.findByRole('heading', { name: 'Profit & loss' });
  await waitFor(() => expect(screen.queryByText('Loading figures…')).toBeNull());
  return utils;
}

function shell(): HTMLElement {
  const el = document.querySelector('[data-entity]');
  if (!(el instanceof HTMLElement)) throw new Error('shell not rendered');
  return el;
}

describe('PnlApp', () => {
  it('starts on Consumer Products with the Products blue accent, and switching company swaps the accent only', async () => {
    await renderApp();
    expect(shell().dataset.entity).toBe('P');
    expect(shell().style.getPropertyValue('--acc')).toBe(COMPANY_THEME.P.acc);

    const cloud = screen.getByRole('button', { name: /Commerce Cloud/ });
    fireEvent.click(cloud);
    expect(shell().dataset.entity).toBe('S');
    expect(shell().style.getPropertyValue('--acc')).toBe(COMPANY_THEME.S.acc);
    expect(cloud).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /Consumer Products/ })).toHaveAttribute('aria-pressed', 'false');
    // Same zones, same tabs (L-10).
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('heading', { name: 'Profit & loss' })).toBeVisible();
  });

  it('collapses and expands the filter rail', async () => {
    await renderApp();
    const rail = screen.getByTestId('filter-rail');
    expect(rail.style.width).toBe('64px');
    expect(screen.queryByText('Management reporting')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand filter panel' }));
    expect(rail.style.width).toBe('248px');
    expect(screen.getByText('Management reporting')).toBeVisible();
    expect(screen.getByText('YTD · Sep 2026')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse filter panel' }));
    expect(rail.style.width).toBe('64px');
  });

  it('opens one flyout at a time and closes it with Done, the close button and Escape', async () => {
    await renderApp();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Period:/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Period filters' });
    expect(within(dialog).getByRole('group', { name: 'Fiscal year' })).toBeVisible();
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close' }));

    fireEvent.click(screen.getByRole('button', { name: /^Display:/ }));
    expect(screen.getByRole('dialog', { name: 'Display filters' })).toBeVisible();
    expect(screen.queryByRole('dialog', { name: 'Period filters' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Versions:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Slice:/ }));
    expect(screen.getByRole('dialog', { name: 'Slice filters' })).toBeVisible();
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('switches views with the tabs and with arrow keys', async () => {
    await renderApp();
    expect(screen.getByRole('tab', { name: 'P&L statement' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('region', { name: 'Income statement' })).toBeVisible();

    fireEvent.click(screen.getByRole('tab', { name: 'Key figures' }));
    expect(screen.getByRole('region', { name: 'Key figures' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Income statement' })).toBeNull();
    expect(screen.getByText('▲ favourable')).toBeVisible();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Key figures' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Analysis' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /Net revenue bridge/ })).toBeVisible();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Analysis' }), { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: /Profitability by channel/ })).toBeVisible();
  });

  it('expands and collapses statement blocks, keeping default blocks open', async () => {
    await renderApp();
    // GR is open by default (M-20): its first leaf is visible.
    expect(screen.getByText('Gross product sales')).toBeVisible();
    const gr = screen.getByRole('button', { name: /^Gross revenue$/ });
    expect(gr).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(gr);
    expect(gr).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Gross product sales')).toBeNull();

    // D&A is closed by default; opening it reveals its leaves.
    expect(screen.queryByText('Depreciation: right-of-use assets')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /Depreciation & amortisation/ }));
    expect(screen.getByText('Depreciation: right-of-use assets')).toBeVisible();
  });

  it('renders the Ledger row kinds and the sample-data chip', async () => {
    await renderApp();
    expect(document.querySelectorAll('[data-row-kind="key"]').length).toBeGreaterThanOrEqual(4);
    expect(document.querySelectorAll('[data-row-kind="ratio"]').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('status')).toHaveTextContent('Sample data');
    expect(screen.getByText('3,398.5')).toBeVisible();
    expect(screen.getByText('−66.3')).toBeVisible();
  });

  it('keeps period, versions, currency and region on an entity switch but remembers slices per entity (F-30, F-31)', async () => {
    await renderApp('pnl', liveLikeSource);
    fireEvent.click(screen.getByRole('button', { name: /^Period:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'FY2025' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    fireEvent.click(screen.getByRole('button', { name: /^Slice:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Own D2C webstore' }));
    expect(screen.getByRole('button', { name: 'Own D2C webstore' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('4 of 5')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    fireEvent.click(screen.getByRole('button', { name: /Commerce Cloud/ }));
    expect(screen.getByRole('button', { name: /^Period:/ })).toHaveAttribute('aria-label', 'Period: YTD · Sep 2025');
    fireEvent.click(screen.getByRole('button', { name: /^Slice:/ }));
    expect(screen.getAllByText('All 3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Self-serve sign-up' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    fireEvent.click(screen.getByRole('button', { name: /Consumer Products/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Slice:/ }));
    expect(screen.getByRole('button', { name: 'Own D2C webstore' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables channel, category and segment in the Group view with the reason (F-32, T-15)', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /ACME Group/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Slice:/ }));
    const dialog = screen.getByRole('dialog', { name: 'Slice filters' });
    expect(within(dialog).getByRole('note')).toHaveTextContent(/off in the consolidated view/);
    expect(within(dialog).queryByRole('button', { name: 'Own D2C webstore' })).toBeNull();
    expect(within(dialog).getByText('Channel / sales motion')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'North America' })).toBeVisible();
    // Entity columns is enabled only in the Group view (F-18).
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: 'Entity columns' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: /Consumer Products/ }));
    expect(screen.getByRole('button', { name: 'Entity columns' })).toBeDisabled();
  });

  it('applies display settings to the statement columns', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /^Display:/ }));
    fireEvent.click(screen.getByRole('switch', { name: '% of net revenue column' }));
    fireEvent.click(screen.getByRole('button', { name: 'Amount' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('% NR')).toBeNull();
    expect(screen.queryByText('Δ %')).toBeNull();
    expect(screen.getAllByText('Δ').length).toBeGreaterThanOrEqual(2);
  });
});
