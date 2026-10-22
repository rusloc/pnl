import { beforeAll, describe, expect, it } from 'vitest';
import { loadPublicDataset } from '../test-utils/public-data.ts';
import { selection } from '../test-utils/selection.ts';
import { createEngine } from './index.ts';
import type { Engine } from './index.ts';

// C-50 notice conditions and the L-04 context line on the dummy data (last close Sep 2026, data from Jan 2024).
let engine: Engine;
beforeAll(async () => {
  engine = createEngine(await loadPublicDataset(['P']));
});
const codes = (overrides: Parameters<typeof selection>[0]) => engine.notices(selection(overrides)).map((n) => n.code);

describe('notices (C-50)', () => {
  it('none for the default selection', () => {
    expect(codes({})).toEqual([]);
  });

  it('T-11: an Actual window past the last close shows the notice and names the open months', () => {
    const n = engine.notices(selection({ timeView: 'FY', month: 12 }));
    expect(n.map((x) => x.code)).toEqual(['PAST_CLOSE']);
    expect(n[0]?.text).toContain('Oct 2026 – Dec 2026');
  });

  it('C-02: Latest estimate lists the forecast months', () => {
    const n = engine.notices(selection({ base: 'LE', timeView: 'FY', month: 12 }));
    expect(n.map((x) => x.code)).toEqual(['FORECAST_MONTHS']);
    expect(n[0]?.text).toContain('Oct 2026 – Dec 2026');
  });

  it('T-12: prior year for the first data year is n/a with a notice', () => {
    expect(codes({ fy: 2024, timeView: 'FY', month: 12 })).toEqual(['PY_MISSING']);
  });

  it('C-04 partial prior year and LTM before the history', () => {
    expect(codes({ fy: 2025, month: 9, timeView: 'LTM' })).toEqual(['PY_PARTIAL']);
    expect(codes({ fy: 2024, month: 3, timeView: 'LTM' })).toEqual(['PY_MISSING', 'LTM_BEFORE_HISTORY']);
  });
});

describe('context line (L-04)', () => {
  it('window · versions · currency, units, FX · slices', () => {
    expect(engine.context(selection())).toBe(
      'YTD Sep 2026 · Actual vs Budget and Prior year · USD m, actual rates · All slices',
    );
    expect(
      engine.context(selection({ timeView: 'MTD', compareB: 'NONE', currency: 'EUR', units: 'K', fxBasis: 'CC' })),
    ).toBe('Sep 2026 · Actual vs Budget · EUR k, constant currency · All slices');
  });
});
