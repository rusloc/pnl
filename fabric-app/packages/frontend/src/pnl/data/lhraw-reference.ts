// Reference data read from lh_raw.acme_pl through the `lhraw` connector:
// dim_entity, dim_month, dim_version, dim_region, dim_channel, dim_line,
// dim_segment (+ dim_report_line and dim_account counts for the probe).
// Small tables only; every read names its columns and bounds its rows.
import type { AppClient } from '@/lib/rayfin-client';

import type {
  EntityRef,
  OperatingEntity,
  ReferenceData,
  SliceSet,
  SliceSlot,
} from '../model/types';

const BOUND = 500;

function sliceSet(
  label: string,
  rows: { code: string; name: string; entityCode: string; sortOrder: number; isUnassigned: boolean }[],
  entity: OperatingEntity
): SliceSet {
  return {
    label,
    values: rows
      .filter((r) => r.entityCode === entity && !r.isUnassigned)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map(({ code, name }) => ({ code, name })),
  };
}

export async function loadLhrawReference(client: AppClient): Promise<ReferenceData> {
  const lh = client.connectors.lhraw;
  const [entities, months, versions, regions, channels, lines, segments, reportLines, accounts] =
    await Promise.all([
      lh.DimEntity.select(['entityCode', 'entityName', 'shortName']).first(BOUND).execute(),
      lh.DimMonth.select(['monthKey', 'monthIndex', 'fiscalYear', 'monthNumber', 'monthName', 'isClosed'])
        .orderBy({ monthIndex: 'asc' })
        .first(BOUND)
        .execute(),
      lh.DimVersion.select(['versionKey', 'versionCode', 'versionName', 'isLatestForecast'])
        .first(BOUND)
        .execute(),
      lh.DimRegion.select(['regionCode', 'regionName', 'functionalCurrency', 'sortOrder'])
        .orderBy({ sortOrder: 'asc' })
        .first(BOUND)
        .execute(),
      lh.DimChannel.select(['channelCode', 'channelName', 'entityCode', 'slotLabel', 'sortOrder', 'isUnassigned'])
        .first(BOUND)
        .execute(),
      lh.DimLine.select(['lineCode', 'lineName', 'entityCode', 'slotLabel', 'sortOrder', 'isUnassigned'])
        .first(BOUND)
        .execute(),
      lh.DimSegment.select(['segmentCode', 'segmentName', 'entityCode', 'slotLabel', 'sortOrder', 'isUnassigned'])
        .first(BOUND)
        .execute(),
      lh.DimReportLine.select(['lineCode']).first(BOUND).execute(),
      lh.DimAccount.select(['accountCode']).first(BOUND).execute(),
    ]);

  const operating: EntityRef[] = entities
    .filter((e): e is typeof e & { entityCode: OperatingEntity } => e.entityCode === 'P' || e.entityCode === 'S')
    .map((e) => ({ code: e.entityCode, name: e.entityName, shortName: e.shortName }));
  if (operating.length !== 2) {
    throw new Error(`dim_entity: expected entities P and S, got ${entities.map((e) => e.entityCode).join(', ')}`);
  }

  const monthRefs = months.map((m) => ({
    key: m.monthKey,
    monthIndex: m.monthIndex,
    fiscalYear: m.fiscalYear,
    monthNumber: m.monthNumber,
    monthName: m.monthName,
    isClosed: m.isClosed,
  }));
  const lastClosed = [...monthRefs].reverse().find((m) => m.isClosed);
  if (!lastClosed) throw new Error('dim_month: no closed month (is_closed = TRUE)');

  const normChannels = channels.map((c) => ({
    code: c.channelCode, name: c.channelName, entityCode: c.entityCode,
    label: c.slotLabel, sortOrder: c.sortOrder, isUnassigned: c.isUnassigned,
  }));
  const normLines = lines.map((c) => ({
    code: c.lineCode, name: c.lineName, entityCode: c.entityCode,
    label: c.slotLabel, sortOrder: c.sortOrder, isUnassigned: c.isUnassigned,
  }));
  const normSegments = segments.map((c) => ({
    code: c.segmentCode, name: c.segmentName, entityCode: c.entityCode,
    label: c.slotLabel, sortOrder: c.sortOrder, isUnassigned: c.isUnassigned,
  }));
  const labelFor = (rows: { entityCode: string; label: string }[], entity: OperatingEntity, fallback: string) =>
    rows.find((r) => r.entityCode === entity)?.label ?? fallback;

  const slicesFor = (entity: OperatingEntity): Record<SliceSlot, SliceSet> => ({
    channel: sliceSet(labelFor(normChannels, entity, 'Channel'), normChannels, entity),
    line: sliceSet(labelFor(normLines, entity, 'Category'), normLines, entity),
    segment: sliceSet(labelFor(normSegments, entity, 'Segment'), normSegments, entity),
  });

  return {
    source: 'lhraw',
    entities: [...operating, { code: 'G', name: 'ACME Group', shortName: 'ACME Group' }],
    months: monthRefs,
    lastClosed,
    versions: versions.map((v) => ({
      key: v.versionKey, code: v.versionCode, name: v.versionName, isLatestForecast: v.isLatestForecast,
    })),
    regions: regions.map((r) => ({ code: r.regionCode, name: r.regionName, currency: r.functionalCurrency })),
    slices: { P: slicesFor('P'), S: slicesFor('S') },
    counts: {
      dim_entity: entities.length,
      dim_month: months.length,
      dim_version: versions.length,
      dim_region: regions.length,
      dim_channel: channels.length,
      dim_line: lines.length,
      dim_segment: segments.length,
      dim_report_line: reportLines.length,
      dim_account: accounts.length,
    },
  };
}
