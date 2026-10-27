// ⓘ pop-up behaviour (ADR-0012 §2.5, N-08): opens from the (i) button into a
// glass dialog with the copy, one layer at a time, closes on Escape / ✕ / a
// click outside, traps Tab and returns focus to the opener.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PANEL_INFO } from '../model/info-popovers';
import { HowToReadButton } from './how-to-read';
import { InfoPopover } from './info-popover';

const info = { ...PANEL_INFO.PROFTABLE, values: [{ label: 'Comparison', value: 'Budget' }] };

describe('InfoPopover', () => {
  it('opens a dialog with the name, what it shows, the formula, the values, the sub-metrics line and the source; focus on the close button', () => {
    render(
      <h2>
        Profitability by Region <InfoPopover info={info} detail={{ kind: 'text', text: 'S&M 15.2% - R&D 15.9%' }} />
      </h2>
    );
    const button = screen.getByRole('button', { name: 'About Profitability by Region' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog', { name: 'Profitability by Region' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getByText(/^Constant currency, rows by net revenue\. Δ vs Budget % on net revenue/)).toBeVisible();
    expect(within(dialog).getByTestId('info-formula')).toHaveTextContent('GM % = GP ÷ NR; CM % = contribution ÷ NR; CM Δ = CM % − comparison CM %');
    expect(within(dialog).getByTestId('info-values')).toHaveTextContent('ComparisonBudget');
    expect(within(dialog).getByTestId('info-detail')).toHaveTextContent('S&M 15.2% - R&D 15.9%');
    expect(within(dialog).getByTestId('info-source')).toHaveTextContent(/^Prof Net Revenue/);
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close' }));
  });

  it('says so while the sub-metrics are loading or failed, and omits the line without a detail', () => {
    const { rerender } = render(<InfoPopover info={info} detail={{ kind: 'loading' }} />);
    fireEvent.click(screen.getByRole('button', { name: /^About/ }));
    expect(screen.getByTestId('info-detail')).toHaveTextContent('reading from the semantic model');
    rerender(<InfoPopover info={info} detail={{ kind: 'error', reason: 'timeout' }} />);
    expect(screen.getByTestId('info-detail')).toHaveTextContent('Sub-metrics could not be read: timeout');
    rerender(<InfoPopover info={info} detail={null} />);
    expect(screen.queryByTestId('info-detail')).toBeNull();
  });

  it('closes on ✕, on Escape and on a click outside, returning focus to the (i) button', async () => {
    render(
      <div>
        <p>outside</p>
        <InfoPopover info={PANEL_INFO.NRBRIDGE} />
      </div>
    );
    const button = screen.getByRole('button', { name: 'About Net revenue bridge' });

    fireEvent.click(button);
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    expect(screen.getByRole('dialog')).toBeVisible();
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(button);

    fireEvent.click(button);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(screen.getByRole('dialog')).toBeVisible();
    fireEvent.mouseDown(screen.getByText('outside'));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('keeps one layer open at a time and traps Tab inside the dialog', async () => {
    render(
      <div>
        <InfoPopover info={PANEL_INFO.NRBRIDGE} />
        <InfoPopover info={PANEL_INFO.PBRIDGE} />
      </div>
    );
    fireEvent.click(screen.getByRole('button', { name: 'About Net revenue bridge' }));
    expect(screen.getByRole('dialog', { name: 'Net revenue bridge' })).toBeVisible();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'About Profit bridge' }));
    });
    expect(screen.queryByRole('dialog', { name: 'Net revenue bridge' })).toBeNull();
    const dialog = screen.getByRole('dialog', { name: 'Profit bridge' });
    const close = within(dialog).getByRole('button', { name: 'Close' });
    expect(document.activeElement).toBe(close);
    // The close button is the only focusable element: Tab in either direction stays on it.
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Tab' });
    });
    expect(document.activeElement).toBe(close);
    await act(async () => {
      fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
    });
    expect(document.activeElement).toBe(close);
  });
});

describe('HowToReadButton', () => {
  it('opens the view guide as a wide glass dialog with its lines', () => {
    render(
      <HowToReadButton
        guide={{
          title: 'How to read - Analysis',
          lines: [
            { label: 'Showing', value: 'Jan – Sep 2026 - year to date - USD m - vs Budget and Prior year' },
            { label: 'Paging', value: '‹ › in the tabs row, or the ← → keys.' },
          ],
        }}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'How to read' }));
    const dialog = screen.getByRole('dialog', { name: 'How to read - Analysis' });
    expect(dialog).toHaveStyle({ width: '780px' });
    expect(within(dialog).getByText('Showing')).toBeVisible();
    expect(within(dialog).getByText(/‹ › in the tabs row/)).toBeVisible();
  });
});
