// SAMPLE figures source: adapts the mockup's `DATA`/`META` (sample-data.ts) to
// the typed `Figures` shape. The numbers are fixed at "YTD Sep 2026 · Actual
// vs Budget and Prior year · USD m" whatever the filters say; the UI shows a
// "sample data" chip while this source is active. Used only when no backend can
// be reached (rayfin dev, tests); deployed, every zone is read from the semantic
// model (ADR-0006).
import { barOnScale } from '../model/compare-bar';
import { parseSampleNumber, toneOf } from '../model/format';
import type {
  Bridge,
  Driver,
  EntityCode,
  Figures,
  FilterState,
  KpiCompare,
  KpiTile,
  Profitability,
  ReferenceData,
  StatementRow,
  Tone,
  ZoneKey,
  ZoneStatus,
} from '../model/types';
import { SAMPLE_DATA } from './sample-data';
import type { SampleRow, SampleTile } from './sample-types';

interface SampleMeta {
  sliceNote: string;
  notices: string[];
  bridgeSub: string;
  profBy: string;
  profCol: string;
  profOpts: string[];
  profNote: string;
}

const FULL_YEAR_NOTICE =
  'Full year compares the budget with the latest estimate: Jan–Sep actuals plus the Sep 2026 forecast for Oct–Dec.';

export const SAMPLE_META: Record<EntityCode, SampleMeta> = {
  P: {
    sliceNote: 'All slices',
    notices: [FULL_YEAR_NOTICE],
    bridgeSub: 'Volume and price / mix at constant currency; FX is the translation effect.',
    profBy: 'channel',
    profCol: 'Channel',
    profOpts: ['Region', 'Channel', 'Category', 'Price tier'],
    profNote:
      'Gross and contribution margins use costs booked to each channel. Lines below contribution margin are allocated by net revenue share, so EBITDA and operating margins by channel are indicative.',
  },
  S: {
    sliceNote: 'All slices',
    notices: [
      FULL_YEAR_NOTICE,
      'Revenue includes $21.8m billed to Consumer Products for its D2C webstore and payments; it is eliminated in the Group view.',
    ],
    bridgeSub: 'Change by service line at constant currency; FX is the translation effect.',
    profBy: 'sales motion',
    profCol: 'Sales motion',
    profOpts: ['Region', 'Sales motion', 'Service line', 'Segment'],
    profNote:
      'Gross and contribution margins use costs booked to each sales motion. Lines below contribution margin are allocated by net revenue share, so EBITDA and operating margins by sales motion are indicative.',
  },
  G: {
    sliceNote: 'All regions, consolidated',
    notices: [
      'Consolidated: $21.8m of Commerce Cloud fees to the Consumer Products D2C webstore are removed from revenue and from cost-to-serve. Channel, category and segment filters are off.',
      FULL_YEAR_NOTICE,
    ],
    bridgeSub: 'Change by company at constant currency; FX is the translation effect.',
    profBy: 'company',
    profCol: 'Company',
    profOpts: ['Region', 'Company'],
    profNote:
      'Company margins are each company’s own results before eliminations. Shares are of consolidated net revenue.',
  },
};

function tone(code: 'f' | 'u' | '0'): Tone {
  return code === 'f' ? 'fav' : code === 'u' ? 'unf' : 'neutral';
}

export function toStatementRow(r: SampleRow): StatementRow {
  const [code, parent, kind, label, alias, tags, cells, , bar] = r;
  const n = (i: number) => parseSampleNumber(cells[i]);
  return {
    code,
    parent: parent === '' ? null : parent,
    kind,
    label,
    alias,
    tags,
    values: {
      base: n(0), pctNr: n(1),
      cmpA: n(2), dA: n(3), dApct: n(4),
      cmpB: n(5), dB: n(6), dBpct: n(7),
      fyBud: n(8), fyLe: n(9), fyD: n(10),
    },
    barFraction: kind === 'ratio' ? null : bar,
    neutralDelta: code === 'ETR',
  };
}

/** The mockup's tone codes, kept to prove the rounded-Δ tone rule reproduces them. */
export function sampleToneCodes(r: SampleRow): string {
  return r[7];
}

/** The mockup's "vs …" lines are the comparison rows; its other lines (margin, reported growth, drivers) are sub-lines. */
function isCompareLine(name: string): boolean {
  return name.startsWith('vs ');
}

/** A comparison row from the mockup's pre-formatted Δ text: the bar reads the printed number back, never invents one (LSN-002). */
function toCompare([name, text, code]: SampleTile['s'][number]): KpiCompare {
  const n = parseSampleNumber(text);
  const pp = text.endsWith('pp');
  const t = tone(code);
  return { name, text, tone: t, bar: n === null ? null : barOnScale(pp ? n : n / 100, pp, t === 'unf' ? -1 : 1) };
}

function toTile(t: SampleTile): KpiTile {
  return {
    // The mockup has no kpi_code: the label keys the tile.
    code: t.l,
    label: t.l,
    hint: t.h,
    value: t.v,
    sublines: t.s.filter(([name]) => !isCompareLine(name)).map(([name, text]) => `${name} ${text}`),
    compares: t.s.filter(([name]) => isCompareLine(name)).map(toCompare),
  };
}

function toBridge(entity: EntityCode): Bridge {
  const d = SAMPLE_DATA[entity].bridge;
  return {
    subtitle: SAMPLE_META[entity].bridgeSub,
    axisText: d.axis,
    steps: d.geo.map(([label, valueText, kind, bottomPct, heightPct]) => ({
      label,
      valueText,
      kind: kind === 't' ? 'total' : kind === 'f' ? 'fav' : 'unf',
      bottomPct,
      heightPct,
    })),
  };
}

function toDrivers(entity: EntityCode): Driver[] {
  return SAMPLE_DATA[entity].drivers.map(([name, block, , , deltaText, deltaPctText, code]) => ({
    name,
    block,
    delta: parseSampleNumber(deltaText) ?? 0,
    deltaText,
    deltaPctText,
    tone: tone(code),
  }));
}

function toProfitability(entity: EntityCode): Profitability {
  const d = SAMPLE_DATA[entity];
  const m = SAMPLE_META[entity];
  const cmTile = d.kpis.find((k) => k.l === 'Contribution margin');
  const cmAverageText = cmTile?.v ?? '';
  return {
    by: m.profBy,
    column: m.profCol,
    options: m.profOpts,
    compareLabel: 'Budget',
    note: m.profNote,
    rows: d.prof.map(([name, nrText, shareText, sharePct, deltaPctText, code, gm, cm, ebitda, op]) => ({
      name, nrText, shareText, sharePct: Math.max(0, Math.min(100, sharePct)), deltaPctText,
      tone: tone(code), gm, cm, ebitda, op,
    })),
    cmAverageText,
    cmAveragePct: parseSampleNumber(cmAverageText) ?? 0,
  };
}

/** A profitability zone with nothing in it (a live zone still loading or failed). */
export function emptyProfitability(): Profitability {
  return { by: '', column: '', options: [], compareLabel: '', note: '', rows: [], cmAverageText: '', cmAveragePct: 0 };
}

const SAMPLE_ZONES: Record<ZoneKey, ZoneStatus> = {
  statement: { kind: 'sample' },
  kpi: { kind: 'sample' },
  bridge: { kind: 'sample' },
  drivers: { kind: 'sample' },
  profitability: { kind: 'sample' },
  context: { kind: 'sample' },
};

export function sampleFigures(filter: FilterState): Figures {
  const entity = filter.entity;
  const d = SAMPLE_DATA[entity];
  return {
    sample: true,
    zones: SAMPLE_ZONES,
    notices: SAMPLE_META[entity].notices,
    dataStatus: null,
    statement: d.rows.map(toStatementRow),
    financial: d.kpis.map(toTile),
    operational: d.ops.map(toTile),
    bridge: toBridge(entity),
    drivers: toDrivers(entity),
    profitability: toProfitability(entity),
  };
}

/** Re-derive a tone the way the view does, for the fidelity test. */
export function derivedTone(delta: number | null): Tone {
  return toneOf(delta);
}

export async function loadSampleFigures(filter: FilterState, _reference: ReferenceData, onUpdate?: (figures: Figures) => void): Promise<Figures> {
  void _reference;
  const figures = sampleFigures(filter);
  onUpdate?.(figures);
  return figures;
}
