import type { Selection } from '../engine/types.ts';

/** Spec defaults (F-01 … F-21) for the dummy data: FY2026, last closed month Sep. Tests override what they need. */
export function selection(overrides: Partial<Selection> = {}): Selection {
  return {
    entity: 'P',
    fy: 2026,
    month: 9,
    timeView: 'YTD',
    base: 'A',
    compareA: 'B',
    compareB: 'PY',
    region: [],
    channel: [],
    line: [],
    segment: [],
    currency: 'USD',
    fxBasis: 'ACT',
    units: 'M',
    costSign: 'NEG',
    varianceFormat: 'BOTH',
    showPctNr: true,
    showFyOutlook: true,
    showTags: true,
    hideEmpty: true,
    layout: 'VAR',
    costLens: 'FN',
    detail: 'STD',
    breakdown: 'CHANNEL',
    view: 'statement',
    ...overrides,
  };
}
