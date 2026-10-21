import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const execute = vi.fn();

vi.mock('@/lib/rayfin-client', () => ({
  getRayfinClient: async () => ({
    connectors: {
      lhraw: {
        DimEntity: { select: () => ({ first: () => ({ execute }) }) },
      },
    },
  }),
}));

import { ConnectionProbe } from './connection-probe.component';

describe('ConnectionProbe', () => {
  it('lists the dim_entity rows returned by the lhraw connector', async () => {
    execute.mockResolvedValueOnce([
      { entityCode: 'P', shortName: 'Consumer Products' },
      { entityCode: 'S', shortName: 'Commerce Cloud' },
    ]);
    render(<ConnectionProbe />);
    expect(await screen.findByText('2 entities (expected 2)')).toBeVisible();
    expect(screen.getByText('P — Consumer Products')).toBeVisible();
    expect(screen.getByText('S — Commerce Cloud')).toBeVisible();
  });

  it('surfaces a failed read instead of hiding it behind a loading state', async () => {
    execute.mockRejectedValueOnce(new Error('FEATURE_NOT_ENABLED'));
    render(<ConnectionProbe />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Read failed: FEATURE_NOT_ENABLED'
    );
  });
});
