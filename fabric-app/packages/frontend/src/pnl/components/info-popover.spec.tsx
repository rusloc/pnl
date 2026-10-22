// Info pop-up behaviour (L-15, N-08): opens from the (i) button, fills the
// placeholders, closes on Escape / ✕ / outside click, manages focus.
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { InfoPopover } from './info-popover';

describe('InfoPopover', () => {
  it('opens a dialog with the four sections and the placeholders filled, focus on the close button', () => {
    render(
      <h2>
        Profitability by channel <InfoPopover info="profitability" context={{ comparison: 'Budget', breakdown: 'channel' }} />
      </h2>
    );
    const button = screen.getByRole('button', { name: 'About Profitability by channel' });
    expect(button).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(button);
    const dialog = screen.getByRole('dialog', { name: 'Profitability by channel' });
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(within(dialog).getAllByRole('heading', { level: 3 }).map((h) => h.textContent)).toEqual(['What it shows', 'How to read it', 'For example', 'Watch out']);
    expect(within(dialog).getByText(/How much revenue each channel brings in, how it grew against Budget/)).toBeVisible();
    expect(within(dialog).getByText('vs Budget', { selector: 'strong' })).toBeVisible();
    expect(dialog.textContent).not.toMatch(/\{(comparison|breakdown)\}/);
    expect(document.activeElement).toBe(within(dialog).getByRole('button', { name: 'Close' }));
  });

  it('closes on ✕, on Escape and on a click outside, returning focus to the (i) button', async () => {
    render(
      <div>
        <p>outside</p>
        <InfoPopover info="bridge" context={{ comparison: 'Prior year' }} />
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

  it('fills the comparison the visual uses into the bridge and variances text', () => {
    render(<InfoPopover info="variances" context={{ comparison: 'Latest estimate' }} align="end" />);
    fireEvent.click(screen.getByRole('button', { name: 'About Largest variances' }));
    expect(screen.getByText('The 8 lines of the P&L that differ most from Latest estimate, in amount, whether up or down.')).toBeVisible();
    expect(screen.getByText(/Δ % is that difference as a share of Latest estimate\./)).toBeVisible();
  });
});
