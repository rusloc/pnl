// Honest sample mode (LSN-002): while the figures are sample, every control
// that would re-label them is off with a reason, the strip says so once, no
// title ever contradicts the numbers, and everything that works stays on.
// All of it disappears when the figures are live from the semantic model
// (ADR-0006 phase 2), where each zone carries its own state instead.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { sampleReference } from './data/sample-reference';
import { loadSampleFigures } from './data/sample-source';
import {
  LIVE_ZONE_DETAIL,
  SAMPLE_FIGURES_DETAIL,
  SAMPLE_FIGURES_NOTICE,
  SAMPLE_INERT_REASON,
  SAMPLE_STATEMENT_ONLY_NOTE,
  zoneErrorText,
  zoneLoadingText,
} from './model/sample-mode';
import type { Figures, FilterState, PnlDataSource, ZoneKey, ZoneStatus } from './model/types';
import { PnlApp } from './pnl-app';

const sampleSource: PnlDataSource = {
  loadReference: async () => ({ reference: sampleReference() }),
  loadFigures: loadSampleFigures,
};

/** The sample numbers re-flagged as live zones: the gates must vanish (the numbers themselves are not under test). */
function liveLike(status: (zone: ZoneKey) => ZoneStatus): PnlDataSource {
  return {
    loadReference: sampleSource.loadReference,
    loadFigures: async (filter, reference) => {
      const f = await loadSampleFigures(filter, reference);
      const zones = Object.fromEntries((Object.keys(f.zones) as ZoneKey[]).map((z) => [z, status(z)])) as Figures['zones'];
      return { ...f, sample: false, zones, notices: ['Notice from the model'], dataStatus: 'Closed through Sep 2026  ·  Refreshed 21 Oct 2026 18:00', refreshedAt: '2026-10-21T18:00:00' };
    },
  };
}

const liveSource = liveLike(() => ({ kind: 'live', requestId: 'req-1' }));

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

/** ADR-0007: the company switch is the rail brand mark → picker → one option. */
function switchCompany(name: 'Consumer Products' | 'Commerce Cloud' | 'ACME Group') {
  fireEvent.click(screen.getByRole('button', { name: 'Switch company' }));
  fireEvent.click(within(screen.getByRole('dialog', { name: 'Switch company' })).getByRole('radio', { name: new RegExp(name) }));
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
  it('shows one notice row in the applied-filters pop-up naming the filters the sample figures ignore', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: /^Show the applied filters/ }));
    const dialog = screen.getByRole('dialog', { name: 'Applied filters' });
    const rows = within(dialog).getAllByTestId('notice-row');
    expect(rows.filter((r) => r.textContent?.includes(SAMPLE_FIGURES_NOTICE))).toHaveLength(1);
    expect(dialog.textContent?.split('Sample figures (').length).toBe(2);
  });

  it('switches off fiscal year, month and time view with the reason (period re-titles the window)', async () => {
    await renderApp();
    const dialog = openPanel('Period');
    expectOff(within(dialog).getByRole('radio', { name: '2025' }));
    expectOff(within(dialog).getByRole('radio', { name: 'Jan' }));
    expectOff(within(dialog).getByRole('radio', { name: 'One month' }));
    expectDescribedByReason(within(dialog).getByRole('radiogroup', { name: 'Year' }));
    expectDescribedByReason(within(dialog).getByRole('radiogroup', { name: 'Up to' }));
    expectDescribedByReason(within(dialog).getByRole('radiogroup', { name: 'Show' }));
    fireEvent.click(within(dialog).getByRole('radio', { name: '2025' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(screen.getByRole('button', { name: /^Period:/ })).toHaveAttribute('aria-label', 'Period: Showing Jan – Sep 2026 - year to date');
    expect(screen.getByText('YTD Sep 2026 - Actual')).toBeVisible();
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

    switchCompany('ACME Group');
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
    expect(screen.getByText('Line - USD k')).toBeVisible();
    expect(screen.queryByText('Full year 2026')).toBeNull();
  });

  it('has no Analysis toolbar (parity rule 1); the sample bridge shows and the redesigned panels say they have no sample figures', async () => {
    await renderApp('ana');
    expect(screen.queryByRole('group', { name: 'Compared with' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Prior year' })).toBeNull();
    expect(screen.getByRole('heading', { name: /^Net revenue bridge/ })).toBeVisible();
    expect(screen.getAllByTestId('bridge-step').length).toBeGreaterThan(2);
    expect(screen.getByTestId('sample-empty')).toHaveTextContent(/No sample figures for the profit bridge/);
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByRole('heading', { name: /^Largest variances vs Budget/ })).toBeVisible();
    expect(screen.getByTestId('sample-empty')).toHaveTextContent(/No sample figures for the largest variances/);
    // The cut is a query input: off while sample (LSN-002).
    expectOff(screen.getByRole('button', { name: 'Region' }));
  });

  it('Profitability is Region only (PV-19): no breakdown control; the sample has no profitability figures, the table says so', async () => {
    await renderApp('prof');
    expect(screen.queryByRole('group', { name: 'Break down by' })).toBeNull();
    expect(screen.getByRole('heading', { name: /^Profitability by Region/ })).toBeVisible();
    expect(screen.getAllByTestId('sample-empty')[0]).toHaveTextContent(/No sample figures for the profitability table/);
    switchCompany('Commerce Cloud');
    expect(await screen.findByRole('heading', { name: /^Profitability by Region/ })).toBeVisible();
  });

  it('gives every view the same sample caveat', async () => {
    for (const view of ['pnl', 'kpi', 'ana', 'prof'] as const) {
      const { unmount } = render(<PnlApp source={sampleSource} initialView={view} />);
      const chips = await screen.findAllByRole('status');
      expect(chips[0]).toHaveTextContent(`Sample data - ${SAMPLE_FIGURES_DETAIL}`);
      unmount();
    }
  });

  it('keeps the company switch, view tabs and Expand all / Collapse all working', async () => {
    await renderApp();
    expect(screen.getByRole('button', { name: 'Expand all' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Expand all' }));
    expect(screen.getByRole('button', { name: 'Collapse all' })).toBeEnabled();
    switchCompany('Commerce Cloud');
    expect(screen.getByTestId('status-line')).toHaveTextContent(/^Commerce Cloud - /);
    fireEvent.click(screen.getByRole('tab', { name: 'Vitals' }));
    const kpi = screen.getByRole('region', { name: 'Vitals' });
    expect(kpi).toBeVisible();
    // The mockup has no Vitals cards: the view says so rather than inventing numbers (LSN-002).
    expect(within(kpi).getByTestId('sample-empty')).toHaveTextContent(/No sample figures for the vitals/);
  });
});

// ADR-0006 phase 2: live zones — no gates, the model's notices and status, a chip per zone,
// and a loading / error panel where a zone has no numbers to show.
describe('live mode', () => {
  it('drops the notice and every gate, shows the model’s notices and refresh time, and flags each zone live', async () => {
    await renderApp('pnl', liveSource);
    expect(screen.queryByText(SAMPLE_FIGURES_NOTICE)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Show the applied filters (1 notice)' }));
    const popup = screen.getByRole('dialog', { name: 'Applied filters' });
    expect(within(popup).getAllByTestId('notice-row')).toHaveLength(1);
    expect(within(popup).getByTestId('notice-row')).toHaveTextContent('Notice from the model');
    expect(within(popup).queryByText(SAMPLE_FIGURES_NOTICE)).toBeNull();
    fireEvent.click(within(popup).getByRole('button', { name: 'Close' }));
    expect(screen.getByTestId('status-line')).toHaveTextContent(
      'Consumer Products - Management reporting - Closed through Sep 2026 - Refreshed 21 Oct 2026 18:00'
    );
    expect(screen.getByRole('status')).toHaveTextContent(`Live - semantic model - ${LIVE_ZONE_DETAIL}`);
    let dialog = openPanel('Period');
    expect(within(dialog).getByRole('radio', { name: '2025' })).toBeEnabled();
    expect(within(dialog).getByRole('radio', { name: 'Jun' })).toBeEnabled();
    expect(within(dialog).getByRole('radio', { name: 'Last 12 months' })).toBeEnabled();
    expect(within(dialog).getByRole('radiogroup', { name: 'Year' })).not.toHaveAttribute('aria-describedby');
    dialog = openPanel('Versions');
    expect(within(dialog).getByRole('radio', { name: /^Latest estimate/ })).toBeEnabled();
    expect(within(within(dialog).getByRole('group', { name: 'Compare B' })).getByRole('button', { name: 'None' })).toBeEnabled();
    dialog = openPanel('Slice');
    expect(within(dialog).getByRole('button', { name: 'Own D2C webstore' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: 'North America' })).toBeEnabled();
    dialog = openPanel('Display');
    expect(within(dialog).getByRole('button', { name: 'EUR' })).toBeEnabled();
    expect(within(dialog).getByRole('button', { name: 'Constant currency' })).toBeEnabled();
    expect(within(dialog).queryByText(SAMPLE_STATEMENT_ONLY_NOTE)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Analysis' }));
    // Live, the analysis headings follow Compare A (C-40, parity rule 1).
    expect(screen.getByRole('heading', { name: /^Profit bridge: Budget Adj\. EBITDA/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByRole('heading', { name: /^Largest variances vs Budget/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Price tier' })).toBeEnabled();
    fireEvent.click(screen.getByRole('tab', { name: 'Profitability' }));
    expect(screen.queryByRole('group', { name: 'Break down by' })).toBeNull();
  });

  it('re-titles the live statement from the filters and re-queries on a filter change', async () => {
    const calls: FilterState[] = [];
    const source: PnlDataSource = {
      loadReference: liveSource.loadReference,
      loadFigures: (filter, reference, onUpdate) => {
        calls.push(filter);
        return liveSource.loadFigures(filter, reference, onUpdate);
      },
    };
    await renderApp('pnl', source);
    const dialog = openPanel('Period');
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Jun' }));
    fireEvent.click(within(dialog).getByRole('radio', { name: 'Quarter to date' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(calls.at(-1)).toMatchObject({ month: 6, timeView: 'qtd' }));
    expect(screen.getByRole('button', { name: /^Period:/ })).toHaveAttribute('aria-label', 'Period: Showing Apr – Jun 2026 - quarter to date');
    expect(await screen.findByText('QTD Jun 2026 - Actual')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: /^Versions:/ }));
    fireEvent.click(within(within(screen.getByRole('dialog')).getByRole('group', { name: 'Compare A' })).getByRole('button', { name: 'Latest est.' }));
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(calls.at(-1)?.compareA).toBe('LE'));
    expect(screen.getByText('vs Latest estimate')).toBeVisible();
    // Parity rules 1, 13: the analysis headings, the Vitals caption, the Profitability subtitle and the
    // How to read all follow the new Compare A; the statement footnote names the bar comparison.
    expect(screen.getByTestId('statement-footnote')).toHaveTextContent('bars in Δ % vs Latest estimate on a ±15% scale');
    fireEvent.click(screen.getByRole('tab', { name: 'Analysis' }));
    expect(screen.getByRole('heading', { name: /^Profit bridge: Latest est\. Adj\. EBITDA/ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(screen.getByRole('heading', { name: /^Largest variances vs Latest est\./ })).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'How to read' }));
    expect(screen.getByRole('dialog', { name: 'How to read - Analysis' })).toHaveTextContent('Apr – Jun 2026 - quarter to date - USD m - vs Latest estimate and Prior year');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Close' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Vitals' }));
    expect(screen.getByText('Changes vs Latest estimate and Prior year, same months')).toBeVisible();
    fireEvent.click(screen.getByRole('tab', { name: 'Profitability' }));
    expect(screen.getByTestId('prof-table-subtitle')).toHaveTextContent('Constant currency (FY2026 budget rates) - USD m - vs Latest est. - opex booked by region, allocated for other breakdowns');
  });

  it('units buttons carry the selected currency’s symbol (parity rule 14)', async () => {
    await renderApp('pnl', liveSource);
    const dialog = openPanel('Display');
    expect(within(dialog).getByRole('button', { name: '$m' })).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'EUR' }));
    expect(within(dialog).getByRole('button', { name: '€m' })).toBeVisible();
    expect(within(dialog).getByRole('button', { name: '€k' })).toBeVisible();
    fireEvent.click(within(dialog).getByRole('button', { name: 'GBP' }));
    expect(within(dialog).getByRole('button', { name: '£k' })).toBeVisible();
  });

  it('shows a loading panel while a zone is in flight and an error panel with the reason when the model could not answer', async () => {
    const mixed = liveLike((zone) =>
      zone === 'vitals' ? { kind: 'loading' } : zone === 'bridge' ? { kind: 'error', reason: 'Row limit of 20 exceeded', requestId: 'req-9' } : { kind: 'live', requestId: 'req-1' }
    );
    await renderApp('kpi', mixed);
    expect(screen.getByRole('status')).toHaveTextContent(zoneLoadingText('vitals'));
    fireEvent.click(screen.getByRole('tab', { name: 'Analysis' }));
    expect(screen.getByRole('alert')).toHaveTextContent(zoneErrorText('net revenue bridge', 'Row limit of 20 exceeded'));
    expect(screen.getByRole('alert')).toHaveTextContent('request req-9');
    // The profit bridge next to it is live and keeps its chip.
    expect(screen.getByRole('status')).toHaveTextContent('Live - semantic model');
  });

  it('disables the Group option of the picker when the model shows the user one company only (Q0, N-04)', async () => {
    const oneEntity: PnlDataSource = {
      loadReference: async () => ({ reference: { ...sampleReference(), visibleEntities: ['P'] } }),
      loadFigures: liveSource.loadFigures,
    };
    await renderApp('pnl', oneEntity);
    fireEvent.click(screen.getByRole('button', { name: 'Switch company' }));
    const picker = screen.getByRole('dialog', { name: 'Switch company' });
    const group = within(picker).getByRole('radio', { name: /ACME Group/ });
    expect(group).toBeDisabled();
    expect(group).toHaveAttribute('title', expect.stringMatching(/both companies/));
    expect(within(picker).getByRole('radio', { name: /Commerce Cloud/ })).toBeEnabled();
  });

  it('says so when the model shows the user no company at all', async () => {
    const none: PnlDataSource = {
      loadReference: async () => ({ reference: { ...sampleReference(), visibleEntities: [] } }),
      loadFigures: liveSource.loadFigures,
    };
    await renderApp('pnl', none);
    expect(screen.getByRole('alert')).toHaveTextContent(/no P&L access/);
  });
});
