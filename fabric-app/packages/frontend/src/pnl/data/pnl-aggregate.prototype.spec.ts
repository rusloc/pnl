import { describe, expect, it } from 'vitest';

import { buildFactFilter } from './pnl-aggregate.prototype';

describe('buildFactFilter (ADR-0005 option a)', () => {
  it('filters one entity, one version and the window months', () => {
    expect(buildFactFilter({ entity: 'P', versionKey: 'ACT', monthKeys: ['2026-01', '2026-02'] })).toEqual({
      entityCode: { eq: 'P' },
      versionKey: { eq: 'ACT' },
      monthKey: { in: ['2026-01', '2026-02'] },
    });
  });

  it('consolidates the Group as every row without a counterparty (C-36)', () => {
    const f = buildFactFilter({ entity: 'G', versionKey: 'BUD', monthKeys: ['2026-01'] });
    expect(f.counterpartyEntityCode).toEqual({ isNull: true });
    expect(f.entityCode).toBeUndefined();
  });

  it('adds region and slice filters only when a selection narrows them', () => {
    const f = buildFactFilter({
      entity: 'S',
      versionKey: 'FC2609',
      monthKeys: ['2026-10'],
      regions: ['EU', 'UK'],
      channels: null,
      lines: ['S_L1'],
    });
    expect(f.regionCode).toEqual({ in: ['EU', 'UK'] });
    expect(f.channelCode).toBeUndefined();
    expect(f.lineCode).toEqual({ in: ['S_L1'] });
    expect(f.segmentCode).toBeUndefined();
  });
});
