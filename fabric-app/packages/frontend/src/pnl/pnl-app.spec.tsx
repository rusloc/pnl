// Key interactions of the Ledger shell: company switch from the rail mark
// (ADR-0007), rail collapse/expand, flyout open/close, tab switch, statement
// expand/collapse rules (M-20, M-21), and the filter rules F-30 to F-32 as the
// user sees them.
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

const mark = () => screen.getByRole('button', { name: 'Switch company' });
const picker = () => screen.getByRole('dialog', { name: 'Switch company' });

function switchCompany(name: 'Consumer Products' | 'Commerce Cloud' | 'ACME Group') {
  fireEvent.click(mark());
  fireEvent.click(within(picker()).getByRole('radio', { name: new RegExp(name) }));
}

describe('PnlApp', () => {
  it('starts on Consumer Products with the Products blue accent, and switching company swaps the accent only', async () => {
    await renderApp();
    expect(shell().dataset.entity).toBe('P');
    expect(shell().style.getPropertyValue('--acc')).toBe(COMPANY_THEME.P.acc);
    expect(screen.getByTestId('status-line')).toHaveTextContent('Consumer Products - Management reporting - Closed through Sep 2026');

    switchCompany('Commerce Cloud');
    expect(shell().dataset.entity).toBe('S');
    expect(shell().style.getPropertyValue('--acc')).toBe(COMPANY_THEME.S.acc);
    // The picker closes on a choice; the status line names the company (Part 2).
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('status-line')).toHaveTextContent(/^Commerce Cloud - Management reporting/);
    // Same zones, same tabs (L-10); no company cards in the header any more (ADR-0007).
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    expect(screen.getByRole('heading', { name: 'Profit & loss' })).toBeVisible();
    expect(screen.queryByRole('group', { name: 'Company' })).toBeNull();
  });

  it('opens the company picker from the rail mark with keyboard, moves between options with arrow keys and returns focus on close (N-08)', async () => {
    await renderApp();
    const m = mark();
    expect(m).toHaveAttribute('title', 'Switch company');
    expect(m).toHaveAttribute('aria-haspopup', 'dialog');
    expect(m).toHaveAttribute('aria-expanded', 'false');
    m.focus();
    fireEvent.click(m); // Enter / Space on a button fire click.
    expect(m).toHaveAttribute('aria-expanded', 'true');
    const options = within(picker()).getAllByRole('radio');
    expect(options.map((o) => o.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    // Focus lands on the current company; only it is in the tab order.
    expect(document.activeElement).toBe(options[0]);
    expect(options[1]).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(options[0], { key: 'ArrowDown' });
    expect(document.activeElement).toBe(options[1]);
    fireEvent.keyDown(options[1], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(options[0]);
    fireEvent.keyDown(options[0], { key: 'ArrowUp' });
    expect(document.activeElement).toBe(options[2]);

    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(shell().dataset.entity).toBe('P');
    expect(document.activeElement).toBe(mark());

    // ✕ and a click outside close it too; opening a filter flyout closes it as well.
    fireEvent.click(mark());
    fireEvent.click(within(picker()).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(mark());
    fireEvent.mouseDown(screen.getByRole('heading', { name: 'Profit & loss' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(mark());
    fireEvent.click(screen.getByRole('button', { name: /^Period:/ }));
    expect(screen.queryByRole('dialog', { name: 'Switch company' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Period filters' })).toBeVisible();
  });

  it('collapses and expands the filter rail', async () => {
    await renderApp();
    const rail = screen.getByTestId('filter-rail');
    expect(rail.style.width).toBe('64px');
    expect(screen.queryByText('ACME P&L')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Expand filter panel' }));
    expect(rail.style.width).toBe('248px');
    expect(screen.getByText('ACME P&L')).toBeVisible();
    // The expanded rail carries the full "Showing …" sentence (parity rule 7).
    expect(screen.getByText('Showing Jan – Sep 2026 - year to date')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse filter panel' }));
    expect(rail.style.width).toBe('64px');
  });

  it('opens one flyout at a time and closes it with Done, the close button and Escape', async () => {
    await renderApp();
    expect(screen.queryByRole('dialog')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /^Period:/ }));
    const dialog = await screen.findByRole('dialog', { name: 'Period filters' });
    expect(within(dialog).getByRole('radiogroup', { name: 'Year' })).toBeVisible();
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

    fireEvent.click(screen.getByRole('tab', { name: 'Vitals' }));
    expect(screen.getByRole('region', { name: 'Vitals' })).toBeVisible();
    expect(screen.queryByRole('region', { name: 'Income statement' })).toBeNull();
    // Parity rule 13: caption from the selection; one How to read per view (rule 19); no pager on Vitals (rule 20).
    expect(screen.getByText('Changes vs Budget and Prior year, same months')).toBeVisible();
    expect(screen.getByRole('button', { name: 'How to read' })).toBeVisible();
    expect(screen.queryByTestId('pager')).toBeNull();

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Vitals' }), { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'Analysis' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('heading', { name: /Net revenue bridge/ })).toBeVisible();
    expect(screen.getByTestId('pager')).toHaveTextContent('1 / 2');

    fireEvent.keyDown(screen.getByRole('tab', { name: 'Analysis' }), { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: /Profitability by Region/ })).toBeVisible();
    expect(screen.getByRole('heading', { name: /Concentration/ })).toBeVisible();
  });

  it('pages Analysis and Profitability with ‹ › and the ← → keys, remembering each view’s page (parity rule 20)', async () => {
    await renderApp('ana');
    expect(screen.getByRole('heading', { name: /Net revenue bridge/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByTestId('pager')).toHaveTextContent('2 / 2');
    expect(screen.getByRole('heading', { name: /^Largest variances vs Budget/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Next page' })).toBeDisabled();
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(screen.getByTestId('pager')).toHaveTextContent('1 / 2');
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: /^Largest variances/ })).toBeVisible();
    // Each paged view keeps its own page; Vitals has none.
    fireEvent.click(screen.getByRole('tab', { name: 'Profitability' }));
    expect(screen.getByTestId('pager')).toHaveTextContent('1 / 2');
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(screen.getByRole('heading', { name: /Growth × margin by region/ })).toBeVisible();
    expect(screen.getByRole('heading', { name: /^Mix - region ×/ })).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Analysis' }));
    expect(screen.getByTestId('pager')).toHaveTextContent('2 / 2');
    // The arrow keys on the tabs move the tab selection, not the page.
    fireEvent.click(screen.getByRole('tab', { name: 'Profitability' }));
    fireEvent.keyDown(screen.getByRole('tab', { name: 'Profitability' }), { key: 'ArrowLeft' });
    expect(screen.getByRole('tab', { name: 'Analysis' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('pager')).toHaveTextContent('2 / 2');
  });

  it('starts collapsed, toggles rows on their own and honours Expand all / Collapse all (M-20)', async () => {
    await renderApp();
    // Default collapsed: blocks and subtotals only.
    expect(screen.queryByText('Gross product sales')).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeDisabled();
    const gr = screen.getByRole('button', { name: /^Gross revenue$/ });
    expect(gr).toHaveAttribute('aria-expanded', 'false');

    fireEvent.click(gr);
    expect(gr).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Gross product sales')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByText('Depreciation: right-of-use assets')).toBeVisible();
    expect(screen.getAllByRole('button', { expanded: false }).filter((b) => b.closest('[role="row"]'))).toHaveLength(0);
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeDisabled();

    // A row still closes on its own after Expand all.
    fireEvent.click(screen.getByRole('button', { name: /Depreciation & amortisation/ }));
    expect(screen.queryByText('Depreciation: right-of-use assets')).toBeNull();
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Collapse all' }));
    expect(screen.queryByText('Gross product sales')).toBeNull();
    expect(screen.getByRole('button', { name: /^Gross revenue$/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeDisabled();
  });

  it('keeps the expansion state across filter changes and resets it on an entity change (M-21)', async () => {
    await renderApp('pnl', liveLikeSource);
    fireEvent.click(screen.getByRole('button', { name: /^Gross revenue$/ }));
    expect(screen.getByText('Gross product sales')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /^Display:/ }));
    fireEvent.click(screen.getByRole('switch', { name: '% of net revenue column' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText('% NR')).toBeNull();
    expect(screen.getByText('Gross product sales')).toBeVisible();

    fireEvent.click(screen.getByRole('button', { name: /^Period:/ }));
    fireEvent.click(screen.getByRole('radio', { name: '2025' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await screen.findByText('YTD Sep 2025 - Actual');
    expect(screen.getByText('Gross product sales')).toBeVisible();

    switchCompany('Commerce Cloud');
    await waitFor(() => expect(screen.getByTestId('status-line')).toHaveTextContent(/^Commerce Cloud - /));
    expect(screen.getByRole('button', { name: /^Gross revenue$/ })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeDisabled();
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
    fireEvent.click(screen.getByRole('radio', { name: '2025' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    fireEvent.click(screen.getByRole('button', { name: /^Slice:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Own D2C webstore' }));
    expect(screen.getByRole('button', { name: 'Own D2C webstore' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByText('4 of 5')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    switchCompany('Commerce Cloud');
    expect(screen.getByRole('button', { name: /^Period:/ })).toHaveAttribute('aria-label', 'Period: Showing Jan – Sep 2025 - year to date');
    fireEvent.click(screen.getByRole('button', { name: /^Slice:/ }));
    expect(screen.getAllByText('All 3').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByRole('button', { name: 'Self-serve sign-up' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    switchCompany('Consumer Products');
    fireEvent.click(screen.getByRole('button', { name: /^Slice:/ }));
    expect(screen.getByRole('button', { name: 'Own D2C webstore' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('disables channel, category and segment in the Group view with the reason (F-32, T-15)', async () => {
    await renderApp();
    switchCompany('ACME Group');
    fireEvent.click(screen.getByRole('button', { name: /^Slice:/ }));
    const dialog = screen.getByRole('dialog', { name: 'Slice filters' });
    expect(within(dialog).getByRole('note')).toHaveTextContent(/off in the consolidated view/);
    expect(within(dialog).queryByRole('button', { name: 'Own D2C webstore' })).toBeNull();
    expect(within(dialog).getByText('Channel / sales motion')).toBeVisible();
    expect(within(dialog).getByRole('button', { name: 'North America' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    // ADR-0007: no Layout / Cost lens / Detail switches anywhere, in any view.
    for (const name of ['Variance', 'Trend', 'Entity columns', 'By function', 'By nature', 'Summary', 'Standard', 'Full']) {
      expect(screen.queryByRole('button', { name })).toBeNull();
    }
  });

  // Page top (docs/design/period-picker-v2.md Part 2): title + funnel, status line, no strip / context line.
  it('shows the status line on the title row and lists every filter and the notices in the applied-filters pop-up (L-04, C-50)', async () => {
    await renderApp('pnl', liveLikeSource);
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.queryByText(/Management reporting ·/)).toBeNull();
    expect(screen.getByTestId('status-line')).toHaveTextContent('Consumer Products - Management reporting - Closed through Sep 2026');

    const funnel = screen.getByRole('button', { name: /^Show the applied filters/ });
    expect(funnel).toHaveAttribute('title', 'Applied filters');
    expect(funnel).toHaveAttribute('aria-haspopup', 'dialog');
    // The sample meta carries one notice for Consumer Products; the funnel says so.
    expect(funnel).toHaveAccessibleName('Show the applied filters (1 notice)');
    expect(screen.getByTestId('notice-count')).toHaveTextContent('1');

    fireEvent.click(funnel);
    const popup = screen.getByRole('dialog', { name: 'Applied filters' });
    expect(document.activeElement).toBe(within(popup).getByRole('button', { name: 'Close' }));
    const labels = within(popup).getAllByRole('rowheader').map((th) => th.textContent);
    // The sample meta's one notice is not one of the model's: it is a plain "Notice" row (parity rule 9).
    expect(labels).toEqual(['Company', 'Fiscal year', 'Period', 'Time view', 'Versions', 'Currency', 'FX basis', 'Units', 'Regions', 'Slices', 'Notice']);
    expect(within(popup).getByRole('row', { name: /^Period/ })).toHaveTextContent('Showing Jan – Sep 2026 - year to date');
    expect(within(popup).getByRole('row', { name: /^Fiscal year/ })).toHaveTextContent('2026');
    expect(within(popup).getByRole('row', { name: /^Versions/ })).toHaveTextContent('Actual vs Budget (A) and Prior year (B)');
    expect(within(popup).getByTestId('notice-row')).toHaveTextContent(/Full year compares the budget/);

    // Escape closes and returns focus to the funnel; a click outside closes too.
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(funnel);
    fireEvent.click(funnel);
    fireEvent.mouseDown(screen.getByRole('heading', { name: 'Profit & loss' }));
    expect(screen.queryByRole('dialog')).toBeNull();

    // The rows follow the filters; the rail tooltip carries the same sentence.
    fireEvent.click(screen.getByRole('button', { name: /^Period:/ }));
    fireEvent.click(screen.getByRole('radio', { name: 'Last 12 months' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: /^Period:/ })).toHaveAttribute('title', 'Period: Showing Oct 2025 – Sep 2026 - last 12 months');
    fireEvent.click(funnel);
    expect(within(screen.getByRole('dialog')).getByRole('row', { name: /^Period/ })).toHaveTextContent('Showing Oct 2025 – Sep 2026 - last 12 months');
    expect(within(screen.getByRole('dialog')).getByRole('row', { name: /^Time view/ })).toHaveTextContent('Last 12 months');
  });

  // Period picker v2 (Part 1).
  it('period panel: live sentence, time view first, grid label follows the view, Full year hides the grid, Back to default', async () => {
    await renderApp('pnl', liveLikeSource);
    fireEvent.click(screen.getByRole('button', { name: /^Period:/ }));
    const dialog = screen.getByRole('dialog', { name: 'Period filters' });
    const summary = () => within(dialog).getByTestId('period-summary');
    expect(summary()).toHaveTextContent('Showing Jan – Sep 2026 - year to date');
    const groups = within(dialog).getAllByRole('radiogroup').map((g) => g.getAttribute('aria-label'));
    expect(groups).toEqual(['Show', 'Year', 'Up to']);
    expect(within(within(dialog).getByRole('radiogroup', { name: 'Show' })).getAllByRole('radio').map((r) => r.textContent)).toEqual([
      'One month', 'Quarter to date', 'Year to date', 'Last 12 months', 'Full year',
    ]);
    expect(within(within(dialog).getByRole('radiogroup', { name: 'Year' })).getAllByRole('radio').map((r) => r.textContent)).toEqual(['2024', '2025', '2026']);
    expect(within(dialog).queryByText(/^FY/)).toBeNull();
    expect(within(dialog).queryByText(/Dashed months/)).toBeNull();

    // Covered months are shaded (Jan–Sep), the anchor is solid (checked).
    const cell = (name: string) => within(within(dialog).getByRole('radiogroup', { name: /Up to|Month|Ending/ })).getByRole('radio', { name });
    expect(cell('Sep')).toHaveAttribute('aria-checked', 'true');
    expect(cell('Mar').className).toMatch(/bg-acc-t/);
    expect(cell('Oct, not closed yet').className).not.toMatch(/bg-acc-t/);

    fireEvent.click(within(dialog).getByRole('radio', { name: 'One month' }));
    expect(summary()).toHaveTextContent('Showing Sep 2026');
    expect(within(dialog).getByRole('radiogroup', { name: 'Month' })).toBeVisible();
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Last 12 months' }));
    expect(within(dialog).getByRole('radiogroup', { name: 'Ending' })).toBeVisible();
    expect(summary()).toHaveTextContent('Showing Oct 2025 – Sep 2026 - last 12 months');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Full year' }));
    expect(within(dialog).queryByRole('radiogroup', { name: /Up to|Month|Ending/ })).toBeNull();
    expect(within(dialog).getByText('Full year covers January to December.')).toBeVisible();
    expect(summary()).toHaveTextContent('Showing Jan – Sep 2026 - full year');

    fireEvent.click(within(dialog).getByRole('radio', { name: '2025' }));
    expect(summary()).toHaveTextContent('Showing Jan – Dec 2025 - full year');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to default' }));
    expect(summary()).toHaveTextContent('Showing Jan – Sep 2026 - year to date');
    expect(within(dialog).getByRole('radio', { name: 'Year to date' })).toHaveAttribute('aria-checked', 'true');
    expect(within(dialog).queryByRole('button', { name: 'Reset this group' })).toBeNull();
  });

  it('period panel: open months are off under Actual with the hint, selectable with a label under Latest estimate / Budget (C-01)', async () => {
    await renderApp('pnl', liveLikeSource);
    fireEvent.click(screen.getByRole('button', { name: /^Period:/ }));
    let dialog = screen.getByRole('dialog', { name: 'Period filters' });
    const oct = within(dialog).getByRole('radio', { name: 'Oct, not closed yet' });
    expect(oct).toBeDisabled();
    expect(oct).toHaveAttribute('title', 'Switch the base to Latest estimate to include forecast months.');
    expect(within(dialog).getByRole('radio', { name: 'Sep' })).toBeEnabled();
    expect(within(dialog).queryByText(/footnote|Dashed/)).toBeNull();

    // Arrow keys move focus and skip the disabled months (wrap from Sep to Jan); Left goes back to Aug.
    const sep = within(dialog).getByRole('radio', { name: 'Sep' });
    expect(sep).toHaveAttribute('tabindex', '0');
    sep.focus();
    fireEvent.keyDown(sep, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(within(dialog).getByRole('radio', { name: 'Jan' }));
    fireEvent.keyDown(document.activeElement as HTMLElement, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(sep);
    fireEvent.keyDown(sep, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(within(dialog).getByRole('radio', { name: 'Aug' }));
    // Moving focus does not select (Space / Enter do).
    expect(sep).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: /^Versions:/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Latest estimate/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: /^Period:/ }));
    dialog = screen.getByRole('dialog', { name: 'Period filters' });
    const octLe = within(dialog).getByRole('radio', { name: 'Oct, forecast' });
    expect(octLe).toBeEnabled();
    fireEvent.click(octLe);
    expect(within(dialog).getByTestId('period-summary')).toHaveTextContent('Showing Jan – Oct 2026 - year to date');
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    fireEvent.click(screen.getByRole('button', { name: /^Versions:/ }));
    fireEvent.click(screen.getByRole('radio', { name: /^Budget/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('button', { name: /^Period:/ }));
    expect(within(screen.getByRole('dialog')).getByRole('radio', { name: 'Dec, budget' })).toBeEnabled();
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
