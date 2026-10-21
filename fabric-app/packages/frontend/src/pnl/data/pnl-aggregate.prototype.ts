// PROTOTYPE for ADR-0005 option (a): server-side aggregation of fact_pl
// through the lhraw connector (DAB `groupBy` + `sum`), so the browser never
// pulls the 458k fact rows. The result is one amount per account × month ×
// currency, which `translateAndSum` (model/fx.ts) turns into reporting-
// currency totals per account (spec §7 C-10 to C-13). Compile-checked and
// unit-tested for the filter it builds; the live call needs the deployed app
// (connectors are not wired under `rayfin dev`), see the probe view.
import type { AppClient } from '@/lib/rayfin-client';

import type { AggregatedAmount } from '../model/fx';
import type { EntityCode, Selection } from '../model/types';

export interface AggregateQuery {
  entity: EntityCode;
  /** dim_version.version_key: ACT, BUD, FC2609 … */
  versionKey: string;
  /** Window months after C-01 (closed months only for Actual). */
  monthKeys: readonly string[];
  regions?: Selection;
  channels?: Selection;
  lines?: Selection;
  segments?: Selection;
}

type FactFilter = Parameters<AppClient['connectors']['lhraw']['FactPl']['where']>[0];

/** The DAB filter for one version × window × slice selection (pure, tested). */
export function buildFactFilter(q: AggregateQuery): FactFilter {
  const filter: FactFilter = {
    versionKey: { eq: q.versionKey },
    monthKey: { in: [...q.monthKeys] },
  };
  if (q.entity === 'G') {
    // C-36: ACME Group = every row without a counterparty (both entities,
    // intercompany pairs removed).
    filter.counterpartyEntityCode = { isNull: true };
  } else {
    filter.entityCode = { eq: q.entity };
  }
  if (q.regions) filter.regionCode = { in: [...q.regions] };
  if (q.channels) filter.channelCode = { in: [...q.channels] };
  if (q.lines) filter.lineCode = { in: [...q.lines] };
  if (q.segments) filter.segmentCode = { in: [...q.segments] };
  return filter;
}

/**
 * One round trip per version × window. Expected size: months × currencies ×
 * accounts (≈ 9 × 4 × 40 = 1,440 rows for YTD Sep, one entity), not fact rows.
 */
export async function aggregateFactPl(client: AppClient, q: AggregateQuery): Promise<AggregatedAmount[]> {
  const rows = await client.connectors.lhraw.FactPl.where(buildFactFilter(q))
    .groupBy(['accountCode', 'monthKey', 'currencyCode'])
    .aggregate({ amountLocal: { sum: 'amountLocal' } })
    .execute();
  return rows.map((r) => ({
    accountCode: r.fields.accountCode,
    monthKey: r.fields.monthKey,
    currencyCode: r.fields.currencyCode,
    amountLocal: r.aggregations.amountLocal ?? 0,
  }));
}

/** fact_fx_rate is 288 rows: read it once and keep it for the session. */
export async function loadFxRates(client: AppClient) {
  return client.connectors.lhraw.FactFxRate.select(['currencyCode', 'monthKey', 'rateType', 'localPerUsd'])
    .first(1000)
    .execute();
}
