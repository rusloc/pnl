// SAMPLE reference data: the dimension values from the mockup's META, used
// only when lh_raw cannot be read (local `rayfin dev`, where connectors are
// not wired, or a failed read). Mirrors data/acme_pl_dummy_data/README.md:
// 36 months Jan 2024 – Dec 2026, last closed month Sep 2026.
import type { MonthRef, ReferenceData, SliceSet, SliceSlot, OperatingEntity } from '../model/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function months(): MonthRef[] {
  const out: MonthRef[] = [];
  let index = 1;
  for (const fiscalYear of [2024, 2025, 2026]) {
    for (let m = 1; m <= 12; m += 1) {
      const key = `${fiscalYear}-${String(m).padStart(2, '0')}`;
      out.push({
        key,
        monthIndex: index,
        fiscalYear,
        monthNumber: m,
        monthName: MONTH_NAMES[m - 1],
        isClosed: key <= '2026-09',
      });
      index += 1;
    }
  }
  return out;
}

function set(label: string, names: readonly string[]): SliceSet {
  return { label, values: names.map((name) => ({ code: name, name })) };
}

const SLICES: Record<OperatingEntity, Record<SliceSlot, SliceSet>> = {
  P: {
    channel: set('Channel', [
      'Grocery & mass retail', 'Drugstore & specialty retail', 'Own D2C webstore',
      'Online marketplaces', 'Wholesale & distributors',
    ]),
    line: set('Category', [
      'Home care', 'Personal care & beauty', 'Kitchen & household',
      'Electronics accessories', 'Toys & leisure',
    ]),
    segment: set('Price tier', ['Premium', 'Mainstream', 'Value & private label']),
  },
  S: {
    channel: set('Sales motion', ['Self-serve sign-up', 'Sales-led (direct)', 'Partner & agency-led']),
    line: set('Service line', [
      'Platform subscriptions', 'Payments', 'Apps, partners & ads', 'Professional services',
    ]),
    segment: set('Customer segment', ['Small business', 'Mid-market', 'Enterprise']),
  },
};

export function sampleReference(): ReferenceData {
  const all = months();
  const lastClosed = [...all].reverse().find((m) => m.isClosed) ?? all[all.length - 1];
  return {
    source: 'sample',
    entities: [
      { code: 'P', name: 'ACME Consumer Products', shortName: 'Consumer Products' },
      { code: 'S', name: 'ACME Commerce Cloud', shortName: 'Commerce Cloud' },
      { code: 'G', name: 'ACME Group', shortName: 'ACME Group' },
    ],
    months: all,
    lastClosed,
    versions: [
      { key: 'ACT', code: 'ACT', name: 'Actual', isLatestForecast: false },
      { key: 'BUD', code: 'BUD', name: 'Budget', isLatestForecast: false },
      { key: 'FC2606', code: 'FC', name: 'Forecast 6+6', isLatestForecast: false },
      { key: 'FC2609', code: 'FC', name: 'Forecast 9+3', isLatestForecast: true },
    ],
    regions: [
      { code: 'NA', name: 'North America', currency: 'USD' },
      { code: 'EU', name: 'Continental Europe', currency: 'EUR' },
      { code: 'UK', name: 'UK & Ireland', currency: 'GBP' },
      { code: 'APAC', name: 'Asia-Pacific', currency: 'AUD' },
    ],
    slices: SLICES,
    counts: {},
  };
}
