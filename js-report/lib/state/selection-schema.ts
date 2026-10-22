import { z } from 'zod';
import type { Manifest } from '../data/manifest.ts';
import type { EntityView, MonthNumber, Selection } from '../engine/types.ts';

// F-37 shareable link (ADR-0002 §2.4): the URL query string is the whole state. Every key is validated at the
// boundary; an invalid value is replaced by its default (F-02 … F-21) and the URL is rewritten, and unknown keys are
// dropped, so nothing unvalidated reaches the engine. Defaults are omitted, so the bare URL is the spec default.

const entity = z.enum(['P', 'S', 'GROUP']);
const flag = z.enum(['0', '1']).transform((v) => v === '1');
const MONTH_NUMBERS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] as const;
const isMonth = (n: number): n is MonthNumber => (MONTH_NUMBERS as readonly number[]).includes(n);

const ENUMS = {
  tv: z.enum(['MTD', 'QTD', 'YTD', 'LTM', 'FY']),
  b: z.enum(['A', 'LE', 'B']),
  ca: z.enum(['B', 'LE', 'PY', 'NONE']),
  cb: z.enum(['B', 'LE', 'PY', 'NONE']),
  cur: z.enum(['USD', 'EUR', 'GBP']),
  fx: z.enum(['ACT', 'CC']),
  u: z.enum(['M', 'K']),
  cs: z.enum(['NEG', 'POS']),
  vf: z.enum(['BOTH', 'ABS', 'PCT']),
  lay: z.enum(['VAR', 'TREND_M', 'TREND_Q', 'ENTITY']),
  lens: z.enum(['FN', 'NAT']),
  d: z.enum(['SUM', 'STD', 'FULL']),
  bd: z.enum(['REGION', 'CHANNEL', 'LINE', 'SEGMENT', 'ENTITY']),
  v: z.enum(['statement', 'kpi', 'analysis', 'profitability']),
} as const;

/** Short URL key per Selection field, in serialisation order (ADR-0002 §2.4). */
const KEYS = {
  entity: 'e',
  fy: 'fy',
  month: 'm',
  timeView: 'tv',
  base: 'b',
  compareA: 'ca',
  compareB: 'cb',
  region: 'r',
  channel: 'ch',
  line: 'ln',
  segment: 'sg',
  currency: 'cur',
  fxBasis: 'fx',
  units: 'u',
  costSign: 'cs',
  varianceFormat: 'vf',
  showPctNr: 'pn',
  showFyOutlook: 'fo',
  showTags: 'tg',
  hideEmpty: 'he',
  layout: 'lay',
  costLens: 'lens',
  detail: 'd',
  breakdown: 'bd',
  view: 'v',
} as const satisfies Record<keyof Selection, string>;

type Query = Pick<URLSearchParams, 'get'>;

/** Entity alone, readable before the manifest is loaded (it decides which data file to fetch). */
export function parseEntity(query: Query): EntityView {
  const r = entity.safeParse(query.get(KEYS.entity));
  return r.success ? r.data : 'P';
}

export interface SelectionCodec {
  defaults(entity: EntityView): Selection;
  parse(query: Query): Selection;
  serialize(sel: Selection): string;
}

export function createSelectionCodec(m: Manifest): SelectionCodec {
  const closed = m.tables.dim_month.filter((d) => d.is_closed);
  const lastRow = closed[closed.length - 1] ?? m.tables.dim_month[m.tables.dim_month.length - 1];
  if (!lastRow) throw new Error('selection: dim_month is empty');
  const last = lastRow;
  const years = [...new Set(m.tables.dim_month.map((d) => d.fiscal_year))];
  const lastMonth = isMonth(last.month_number) ? last.month_number : 12;
  const slices = (e: EntityView) => ({
    region: m.tables.dim_region.map((r) => r.region_code),
    // F-32: channel, category and segment are entity-specific and off in the Group view
    channel:
      e === 'GROUP'
        ? []
        : m.tables.dim_channel.filter((d) => d.entity_code === e && !d.is_unassigned).map((d) => d.channel_code),
    line:
      e === 'GROUP'
        ? []
        : m.tables.dim_line.filter((d) => d.entity_code === e && !d.is_unassigned).map((d) => d.line_code),
    segment:
      e === 'GROUP'
        ? []
        : m.tables.dim_segment.filter((d) => d.entity_code === e && !d.is_unassigned).map((d) => d.segment_code),
  });

  function defaults(e: EntityView): Selection {
    return {
      entity: e, // F-01
      fy: last.fiscal_year, // F-02: current FY = the year of the last close
      month: lastMonth, // F-03: last closed month (N-03)
      timeView: 'YTD', // F-04
      base: 'A', // F-05
      compareA: 'B', // F-06
      compareB: 'PY', // F-07
      region: [], // F-08 … F-11: [] = all
      channel: [],
      line: [],
      segment: [],
      currency: 'USD', // F-12
      fxBasis: 'ACT', // F-13
      units: 'M', // F-14
      costSign: 'NEG', // F-15
      varianceFormat: 'BOTH', // F-16
      showPctNr: true, // F-17: all on
      showFyOutlook: true,
      showTags: true,
      hideEmpty: true,
      layout: e === 'GROUP' ? 'ENTITY' : 'VAR', // F-18
      costLens: 'FN', // F-19
      detail: 'STD', // F-20
      breakdown: e === 'GROUP' ? 'ENTITY' : 'CHANNEL', // F-21
      view: 'statement',
    };
  }

  function pick<T>(schema: z.ZodType<T>, raw: string | null, fallback: T): T {
    if (raw === null) return fallback;
    const r = schema.safeParse(raw);
    return r.success ? r.data : fallback;
  }

  /** Multi-select codes: unknown codes dropped; empty or every value selected means all ([]) (F-33). */
  function codes(raw: string | null, allowed: readonly string[]): string[] {
    if (!raw) return [];
    const chosen = allowed.filter((c) => raw.split(',').includes(c));
    return chosen.length === allowed.length ? [] : chosen;
  }

  function parse(q: Query): Selection {
    const e = parseEntity(q);
    const d = defaults(e);
    const s = slices(e);
    const fy = pick(z.coerce.number().int(), q.get(KEYS.fy), d.fy);
    const month = pick(z.coerce.number().int(), q.get(KEYS.month), d.month);
    const breakdown = pick(ENUMS.bd, q.get(KEYS.breakdown), d.breakdown);
    const layout = pick(ENUMS.lay, q.get(KEYS.layout), d.layout);
    const groupOnly = (v: string) => v === 'ENTITY';
    return {
      entity: e,
      fy: years.includes(fy) ? fy : d.fy,
      month: isMonth(month) ? month : d.month,
      timeView: pick(ENUMS.tv, q.get(KEYS.timeView), d.timeView),
      base: pick(ENUMS.b, q.get(KEYS.base), d.base),
      compareA: pick(ENUMS.ca, q.get(KEYS.compareA), d.compareA),
      compareB: pick(ENUMS.cb, q.get(KEYS.compareB), d.compareB),
      region: codes(q.get(KEYS.region), s.region),
      channel: codes(q.get(KEYS.channel), s.channel),
      line: codes(q.get(KEYS.line), s.line),
      segment: codes(q.get(KEYS.segment), s.segment),
      currency: pick(ENUMS.cur, q.get(KEYS.currency), d.currency),
      fxBasis: pick(ENUMS.fx, q.get(KEYS.fxBasis), d.fxBasis),
      units: pick(ENUMS.u, q.get(KEYS.units), d.units),
      costSign: pick(ENUMS.cs, q.get(KEYS.costSign), d.costSign),
      varianceFormat: pick(ENUMS.vf, q.get(KEYS.varianceFormat), d.varianceFormat),
      showPctNr: pick(flag, q.get(KEYS.showPctNr), d.showPctNr),
      showFyOutlook: pick(flag, q.get(KEYS.showFyOutlook), d.showFyOutlook),
      showTags: pick(flag, q.get(KEYS.showTags), d.showTags),
      hideEmpty: pick(flag, q.get(KEYS.hideEmpty), d.hideEmpty),
      // Entity columns and the Entity breakdown exist only in the Group view (F-18, F-21)
      layout: groupOnly(layout) && e !== 'GROUP' ? d.layout : layout,
      costLens: pick(ENUMS.lens, q.get(KEYS.costLens), d.costLens),
      detail: pick(ENUMS.d, q.get(KEYS.detail), d.detail),
      breakdown:
        (groupOnly(breakdown) && e !== 'GROUP') || (e === 'GROUP' && !['REGION', 'ENTITY'].includes(breakdown))
          ? d.breakdown
          : breakdown,
      view: pick(ENUMS.v, q.get(KEYS.view), d.view),
    };
  }

  function serialize(sel: Selection): string {
    // Entity-dependent defaults (layout, breakdown) are judged against the selected entity; the entity itself
    // against the global default.
    const d = { ...defaults(sel.entity), entity: defaults('P').entity };
    const out = new URLSearchParams();
    for (const [field, key] of Object.entries(KEYS) as [keyof Selection, string][]) {
      const v = sel[field];
      const dv = d[field];
      if (Array.isArray(v) ? v.length === 0 : v === dv) continue;
      out.set(key, Array.isArray(v) ? v.join(',') : typeof v === 'boolean' ? (v ? '1' : '0') : String(v));
    }
    return out.toString();
  }

  return { defaults, parse, serialize };
}

/**
 * What the app can show today (ADR-0002 build steps 0–3). Anything else falls back to the default, so a link made
 * for a later build still opens on real numbers instead of an unbuilt view. Remove each line as its step lands.
 */
export function restrictToBuilt(sel: Selection, defaults: Selection): Selection {
  return {
    ...sel,
    entity: sel.entity === 'GROUP' ? 'P' : sel.entity, // step 4: Group view, eliminations, entity columns
    layout: 'VAR', // step 4: Trend and Entity columns
    detail: defaults.detail, // step 4: detail levels
    region: [], // step 5: slice filters and allocation
    channel: [],
    line: [],
    segment: [],
    costLens: 'FN', // step 8: by-nature lens
    view: 'statement', // steps 6–8: key figures, analysis, profitability
  };
}
