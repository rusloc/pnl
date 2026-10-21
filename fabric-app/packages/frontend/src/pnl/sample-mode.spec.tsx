// Honest sample mode (LSN-002): while the figures are sample, every control
// that would re-label them is off with a reason, the strip says so once, no
// title ever contradicts the numbers, and everything that works stays on.
// All of it disappears when the figures source reports `sample: false`.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { sampleReference } from './data/sample-reference';
import { loadSampleFigures } from './data/sample-source';
import {
  LIVE_STATEMENT_DETAIL,
  MIXED_FIGURES_NOTICE,
  MONTH_LIVE_NOTE,
  SAMPLE_FIGURES_DETAIL,
  SAMPLE_FIGURES_NOTICE,
  SAMPLE_INERT_REASON,
  SAMPLE_STATEMENT_ONLY_NOTE,
} from './model/sample-mode';
import type { FilterState, PnlDataSource } from './model/types';
import { PnlApp } from './pnl-app';

const sampleSource: PnlDataSource = {
  loadReference: async () => ({ reference: sampleReference() }),
  loadFigures: loadSampleFigures,
};

const liveLikeSource: PnlDataSource = {
  loadReference: sampleSource.loadReference,
  loadFigures: async (filter, reference) => ({ ...(await loadSampleFigures(filter, reference)), sample: false }),
};

type View = 'pnl' | 'kpi' | 'ana' | 'prof';

async function renderApp(initialView: View = 'pnl', source: PnlDataSource = sampleSource) {
  render(<PnlApp source={source} initialView={initialView} />);
  await screen.findByRole('heading', { name: 'Profit & loss' });
  await waitFor(() => expect(screen.queryByText('Loading figures…')).toBeNull());
}

function openPanel(name: 'Period' | 'Versions' | 'Slice' | 'Display'): HTMLElement {
  fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${name}:`) }));
  return screen.getByRole('dialog', { name: `${name} filters` });
}

function expectOff(el: HTMLElement) {
  expect(el).toBeDisabled();
  expect(el).toHaveAttribute('title', SAMPLE_INERT_REASON);
}

/** The group's aria-describedby must point at the visible reason (a11y: disabled controls explain themselves). */
function expectDescribedByReason(group: HTMLElement) {
  const id = group.getAttribute('aria-describedby');
  expect(id).toBeTruthy();
  expect(document.getElementById(id as string)).toHaveTextContent(SAMPLE_INERT_REASON);
}

describe('sample mode', () => {
  it('shows one notice-strip line naming the filters the sample figures ignore', async () => {
    await renderApp();
    const strip = screen.getByRole('note');
    expect(strip).toHaveTextContent(SAMPLE_FIGURES_NOTICE);
    expect(strip.textContent?.split('Sample figures (').length).toBe(2);
  });

  it('switches off fiscal year, month and time view with the reason (period re-titles the window)', async () => {
    await renderApp();
    const dialog = openPanel('Period');
    expectOff(within(dialog).getByRole('button', { name: 'FY2025' }));
    expectOff(within(dialog).getByRole('button', { name: 'Jan' }));
    expectOff(within(dialog).getByRole('button', { name: 'Month' }));
    expectDescribedByReason(within(dialog).getByRole('group', { name: 'Fiscal year' }));
    expectDescribedByReason(within(dialog).getByRole('group', { name: 'Month' }));
    expectDescribedByReason(within(dialog).getByRole('group', { name: 'Time view' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'FY2025' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: /^Period:/ })).toHaveAttribute('aria-label', 'Period: YTD · Sep 2026');
    expect(screen.getByText('YTD Sep 2026 · Actual')).toBeVisible();
  });

  it('switches off base version and Compare A / B, so a column can never read "Latest est." over Budget figures (F-06, F-07)', async () => {
    await renderApp();
    const dialog = openPanel('Versions');
    for (const name of ['Actual', 'Latest estimate', 'Budget']) {
      expect(within(dialog).getByRole('radio', { name: new RegExp(`^${name}`) })).toBeDisabled();
    }
    expectDescribedByReason(within(dialog).getByRole('radiogroup', { name: 'Base version' }));
    const compareA = within(dialog).getByRole('group', { name: 'Compare A' });
    const compareB = within(dialog).getByRole('group', { name: 'Compare B' });
    expectDescribedByReason(compareA);
    expectDescribedByReason(compareB);
    const latestA = within(compareA).getByRole('button', { name: 'Latest est.' });
    expectOff(latestA);
    expectOff(within(compareB).getByRole('button', { name: 'None' }));
    fireEvent.click(latestA);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByText('vs Latest estimate')).toBeNull();
    expect(screen.getByText('vs Budget')).toBeVisible();
    expect(screen.getByText('vs Prior year')).toBeVisible();
    // The only "Latest est." title left is the full-year outlook column, which is what the sample holds.
    expect(screen.getAllByText('Latest est.')).toHaveLength(1);
    expect(screen.getByText('Full year 2026')).toBeVisible();
  });

  it('switches off region and slice chips with the reason, in operating and Group views', async () => {
    await renderApp();
    let dialog = openPanel('Slice');
    expectOff(within(dialog).getByRole('button', { name: 'North America' }));
    expectOff(within(dialog).getByRole('button', { name: 'Own D2C webstore' }));
    expectDescribedByReason(within(dialog).getByRole('group', { name: 'Region' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Own D2C webstore' }));
    expect(within(dialog).queryByText('4 of 5')).toBeNull();
    expect(within(dialog).getAllByText(/^All \d+$/).length).toBeGreaterThanOrEqual(4);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.queryByText(/allocated by net revenue share and tagged/)).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: /ACME Group/ }));
    dialog = openPanel('Slice');
    expectOff(within(dialog).getByRole('button', { name: 'North America' }));
    expect(within(dialog).getByText('Channel / sales motion')).toBeVisible();
  });

  it('switches off currency and FX basis but keeps units, costs shown, variance format and the statement switches', async () => {
    await renderApp();
    const dialog = openPanel('Display');
    expectOff(within(dialog).getByRole('button', { name: 'EUR' }));
    expectOff(within(dialog).getByRole('button', { name: 'GBP' }));
    expectOff(within(dialog).getByRole('button', { name: 'Constant currency' }));
    expectDescribedByReason(within(dialog).getByRole('group', { name: 'Currency' }));
    expectDescribedByReason(within(dialog).getByRole('group', { name: 'FX basis' }));
    expect(within(dialog).getByRole('button', { name: '$k' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: '+' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: 'Amount' })).toBeEnabled();
    expect(within(dialog).getByRole('switch', { name: 'Full-year outlook columns' })).toBeEnabled();
    expect(within(dialog).getByText(SAMPLE_STATEMENT_ONLY_NOTE)).toBeVisible();

    fireEvent.click(within(dialog).getByRole('button', { name: '$k' }));
    fireEvent.click(within(dialog).getByRole('switch', { name: 'Full-year outlook columns' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByText('Line · USD k')).toBeVisible();
    expect(screen.queryByText('Full year 2026')).toBeNull();
  });

  it('switches off "Compared with" so the Analysis headings stay vs Budget, like the bars (C-45)', async () => {
    await renderApp('ana');
    const prior = screen.getByRole('button', { name: 'Prior year' });
    expectOff(prior);
    fireEvent.click(prior);
    expect(screen.getByRole('heading', { name: 'Largest variances vs Budget' })).toBeVisible();
    expect(screen.getByText(/^Budget to Actual, USD millions/)).toBeVisible();
  });

  it('switches off "Break down by" and names the breakdown the sample shows (F-21)', async () => {
    await renderApp('prof');
    const region = screen.getByRole('button', { name: 'Region' });
    expectOff(region);
    fireEvent.click(region);
    expect(screen.getByRole('heading', { name: /^Profitability by channel/ })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Contribution margin by channel' })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /Commerce Cloud/ }));
    expect(await screen.findByRole('heading', { name: /^Profitability by sales motion/ })).toBeVisible();
    expectOff(screen.getByRole('button', { name: 'Region' }));
  });

  it('gives every view the same sample caveat', async () => {
    for (const view of ['pnl', 'kpi', 'ana', 'prof'] as const) {
      const { unmount } = render(<PnlApp source={sampleSource} initialView={view} />);
      const chip = await screen.findByRole('status');
      expect(chip).toHaveTextContent(`Sample data · ${SAMPLE_FIGURES_DETAIL}`);
      unmount();
    }
  });

  it('keeps company cards, view tabs, layout, cost lens and detail working', async () => {
    await renderApp();
    for (const name of ['Trend', 'By nature', 'Full']) {
      expect(screen.getByRole('button', { name })).toBeEnabled();
    }
    fireEvent.click(screen.getByRole('button', { name: 'Full' }));
    expect(screen.getByRole('button', { name: 'Full' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /Commerce Cloud/ }));
    expect(screen.getByRole('button', { name: /Commerce Cloud/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Key figures' }));
    expect(screen.getByRole('region', { name: 'Key figures' })).toBeVisible();
  });

  it('drops the notice and every gate as soon as the figures are not sample', async () => {
    await renderApp('pnl', liveLikeSource);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.queryByText(SAMPLE_FIGURES_NOTICE)).toBeNull();
    let dialog = openPanel('Period');
    expect(within(dialog).getByRole('button', { name: 'FY2025' })).toBeEnabled();
    expect(within(dialog).getByRole('group', { name: 'Fiscal year' })).not.toHaveAttribute('aria-describedby');
    dialog = openPanel('Versions');
    expect(within(dialog).getByRole('radio', { name: /^Latest estimate/ })).toBeEnabled();
    dialog = openPanel('Slice');
    expect(within(dialog).getByRole('button', { name: 'Own D2C webstore' })).toBeEnabled();
    dialog = openPanel('Display');
    expect(within(dialog).getByRole('button', { name: 'EUR' })).toBeEnabled();
    expect(within(dialog).queryByText(SAMPLE_STATEMENT_ONLY_NOTE)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Analysis' }));
    expect(screen.getByRole('button', { name: 'Prior year' })).toBeEnabled();
  });
});

// ADR-0006 phase 1: the statement is live from the semantic model and follows the
// month; every other zone is still sample, so its gates and copy stay exactly as above.
describe('mixed mode: live statement, sample elsewhere', () => {
  function liveStatementSource(calls: FilterState[]): PnlDataSource {
    return {
      loadReference: sampleSource.loadReference,
      loadFigures: async (filter, reference) => {
        calls.push(filter);
        const figures = await loadSampleFigures(filter, reference);
        return { ...figures, liveStatement: { source: 'semantic model', requestId: `req-${calls.length}` } };
      },
    };
  }

  const fallbackSource: PnlDataSource = {
    loadReference: sampleSource.loadReference,
    loadFigures: async (filter, reference) => ({
      ...(await loadSampleFigures(filter, reference)),
      liveFallbackReason: 'Row limit of 1000 exceeded',
    }),
  };

  it('un-gates the month only, re-queries on a month change and re-titles the live statement', async () => {
    const calls: FilterState[] = [];
    await renderApp('pnl', liveStatementSource(calls));
    expect(screen.getByRole('status')).toHaveTextContent(`Live · semantic model · ${LIVE_STATEMENT_DETAIL}`);
    const strip = screen.getByRole('note');
    expect(strip).toHaveTextContent(MIXED_FIGURES_NOTICE);
    expect(strip).not.toHaveTextContent(SAMPLE_FIGURES_NOTICE);

    const dialog = openPanel('Period');
    const jun = within(dialog).getByRole('button', { name: 'Jun' });
    expect(jun).toBeEnabled();
    expect(jun).not.toHaveAttribute('title');
    const monthGroup = within(dialog).getByRole('group', { name: 'Month' });
    expect(document.getElementById(monthGroup.getAttribute('aria-describedby') as string)).toHaveTextContent(MONTH_LIVE_NOTE);
    expectOff(within(dialog).getByRole('button', { name: 'FY2025' }));
    expectOff(within(dialog).getByRole('button', { name: 'Month' }));
    expectDescribedByReason(within(dialog).getByRole('group', { name: 'Fiscal year' }));
    expectDescribedByReason(within(dialog).getByRole('group', { name: 'Time view' }));

    fireEvent.click(jun);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(calls.at(-1)?.month).toBe(6));
    expect(screen.getByRole('button', { name: /^Period:/ })).toHaveAttribute('aria-label', 'Period: YTD · Jun 2026');
    expect(await screen.findByText('YTD Jun 2026 · Actual')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent('Live · semantic model');
  });

  it('keeps the sample chip, the version gates and the fixed window on the sample zones', async () => {
    const calls: FilterState[] = [];
    await renderApp('prof', liveStatementSource(calls));
    fireEvent.click(screen.getByRole('button', { name: /^Period:/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Jun' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(calls.at(-1)?.month).toBe(6));
    // Profitability still shows the sample window, not the live month (LSN-002).
    expect(screen.getByText('YTD Jan–Sep 2026, USD millions')).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(`Sample data · ${SAMPLE_FIGURES_DETAIL}`);
    expectOff(screen.getByRole('button', { name: 'Region' }));

    fireEvent.click(screen.getByRole('tab', { name: 'Key figures' }));
    expect(screen.getByRole('status')).toHaveTextContent('Sample data');
    const dialog = openPanel('Versions');
    expect(within(dialog).getByRole('radio', { name: /^Latest estimate/ })).toBeDisabled();
  });

  it('says why when the model could not be read and keeps everything gated', async () => {
    await renderApp('pnl', fallbackSource);
    expect(screen.getByRole('note')).toHaveTextContent(
      'The P&L statement could not be read from the semantic model (Row limit of 1000 exceeded); showing sample figures instead.'
    );
    expect(screen.getByRole('note')).toHaveTextContent(SAMPLE_FIGURES_NOTICE);
    expect(screen.getByRole('status')).toHaveTextContent('Sample data');
    const dialog = openPanel('Period');
    expectOff(within(dialog).getByRole('button', { name: 'Jun' }));
  });
});
