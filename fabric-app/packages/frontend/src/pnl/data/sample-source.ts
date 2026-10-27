// SAMPLE figures source: adapts the mockup's `DATA`/`META` (sample-data.ts) to
// the typed `Figures` shape. The numbers are fixed at "YTD Sep 2026 · Actual
// vs Budget and Prior year · USD m" whatever the filters say; the UI shows a
// "sample data" chip while this source is active. Used only when no backend can
// be reached (rayfin dev, tests); deployed, every zone is read from the semantic
// model (ADR-0006).
import { parseSampleNumber, toneOf } from '../model/format';
import { PANEL_INFO } from '../model/info-popovers';
import type {
  Bridge,
  Bubble,
  Concentration,
  Driver,
  EntityCode,
  Figures,
  FilterState,
  Heat,
  Profitability,
  ReferenceData,
  StatementRow,
  Tone,
  VitalsZone,
  ZoneKey,
  ZoneStatus,
} from '../model/types';
import { SAMPLE_DATA } from './sample-data';
import type { SampleRow } from './sample-types';

interface SampleMeta {
  sliceNote: string;
  notices: string[];
  bridgeSub: string;
}

const FULL_YEAR_NOTICE =
  'Full year compares the budget with the latest estimate: Jan–Sep actuals plus the Sep 2026 forecast for Oct–Dec.';

export const SAMPLE_META: Record<EntityCode, SampleMeta> = {
  P: {
    sliceNote: 'All slices',
    notices: [FULL_YEAR_NOTICE],
    bridgeSub: 'Volume and price / mix at constant currency; FX is the translation effect.',
  },
  S: {
    sliceNote: 'All slices',
    notices: [
      FULL_YEAR_NOTICE,
      'Revenue includes $21.8m billed to Consumer Products for its D2C webstore and payments; it is eliminated in the Group view.',
    ],
    bridgeSub: 'Change by service line at constant currency; FX is the translation effect.',
  },
  G: {
    sliceNote: 'All regions, consolidated',
    notices: [
      'Consolidated: $21.8m of Commerce Cloud fees to the Consumer Products D2C webstore are removed from revenue and from cost-to-serve. Channel, category and segment filters are off.',
      FULL_YEAR_NOTICE,
    ],
    bridgeSub: 'Change by company at constant currency; FX is the translation effect.',
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
      sub: null,
    })),
    info: PANEL_INFO.NRBRIDGE,
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

/** The mockup's profitability table is the pre-redesign one; the redesigned zones have no sample figures (honest: empty, flagged). */
export function emptyProfitability(): Profitability {
  return { by: '', column: '', options: [], compareLabel: '', subtitle: '', allocated: false, rows: [], info: PANEL_INFO.PROFTABLE };
}

export function emptyBridge(key: 'NRBRIDGE' | 'PBRIDGE'): Bridge {
  return { subtitle: '', steps: [], axisText: '', info: PANEL_INFO[key] };
}

export function emptyVitals(): VitalsZone {
  return { results: [], drivers: [] };
}

export function emptyConcentration(): Concentration {
  return { levels: [], legend: [], info: PANEL_INFO.CONC };
}

export function emptyBubble(): Bubble {
  return { points: [], ref: null, quadrants: ['profitable, slower', 'profitable growth', 'problem', 'dilutive growth'], info: PANEL_INFO.BUBBLE };
}

export function emptyHeat(): Heat {
  return { rows: [], cols: [], grand: '', info: PANEL_INFO.HEAT };
}

/** A snapshot with nothing in it, each zone carrying the status given (loading, sample, …). */
export function emptyFigures(zones: Record<ZoneKey, ZoneStatus>): Figures {
  return {
    sample: false,
    zones,
    notices: [],
    dataStatus: null,
    refreshedAt: null,
    statement: [],
    vitals: emptyVitals(),
    vitalsInfo: {},
    bridge: emptyBridge('NRBRIDGE'),
    profit: emptyBridge('PBRIDGE'),
    variances: { leaves: [] },
    variancesCut: null,
    drivers: [],
    profitability: emptyProfitability(),
    concentration: emptyConcentration(),
    bubble: emptyBubble(),
    heat: emptyHeat(),
  };
}

const SAMPLE_ZONES: Record<ZoneKey, ZoneStatus> = {
  statement: { kind: 'sample' },
  vitals: { kind: 'sample' },
  vitalsInfo: { kind: 'sample' },
  bridge: { kind: 'sample' },
  profit: { kind: 'sample' },
  variances: { kind: 'sample' },
  variancesCut: { kind: 'sample' },
  profitability: { kind: 'sample' },
  concentration: { kind: 'sample' },
  bubble: { kind: 'sample' },
  heat: { kind: 'sample' },
  context: { kind: 'sample' },
};

/**
 * The mockup covers the statement, the net revenue bridge and the top 8 variances
 * (AI assistant); the redesigned zones (Vitals cards, profit bridge, variances
 * table, profitability) stay empty and say so (LSN-002).
 */
export function sampleFigures(filter: FilterState): Figures {
  const entity = filter.entity;
  const d = SAMPLE_DATA[entity];
  return {
    ...emptyFigures(SAMPLE_ZONES),
    sample: true,
    notices: SAMPLE_META[entity].notices,
    statement: d.rows.map(toStatementRow),
    bridge: toBridge(entity),
    drivers: toDrivers(entity),
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
