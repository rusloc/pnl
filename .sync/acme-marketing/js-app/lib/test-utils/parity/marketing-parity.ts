import type { ModelCode, Status } from '../../data/manifest.ts';
import type { Dataset } from '../../engine/data.ts';
import { CARDS } from '../../engine/copy.ts';
import { usd } from '../../engine/format.ts';
import { DEFAULT_SELECTION } from '../../engine/selection.ts';
import type { Cross, RankMode, Selection, ViewKey } from '../../engine/selection.ts';
import {
  campaigns,
  channels,
  chips,
  chipsText,
  cohorts,
  context,
  dynamics,
  frame,
  journey,
  overview,
} from '../../engine/view.ts';
import type { Comparator, Grain, Preset } from '../../engine/windows.ts';

// ACME Marketing PBI = JS parity harness (contract docs/ADD/features/marketing-js-flavour.md §7.2; A-84 / A-85).
// hunter's own mapping from bip's Power BI capture (`element` = card.slot) to the JS view models. View models only, no
// DOM: every element the CSV names is a string or a count the engine already builds. The selection comes from the
// row's state columns (cross-checked against the `// State:` lines of parity-selections.dax in parity.test.ts).

export const COLUMNS = [
  'sel_id',
  'view',
  'preset',
  'from',
  'to',
  'comparator',
  'granularity',
  'platforms',
  'market',
  'tier',
  'channels',
  'networks',
  'campaigns',
  'statuses',
  'model',
  'cross',
  'o5_mode',
  'o6_mode',
  'element',
  'kind',
  'expected',
  'tol',
  'c_status',
  'b_status',
  'source',
] as const;
export const OUT_COLUMNS = [...COLUMNS, 'c_value', 'note'] as const;
export type Row = Record<(typeof OUT_COLUMNS)[number], string>;

// ---------- CSV (RFC 4180: quoted fields, "" escapes, CRLF or LF) ----------

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let f = '';
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          f += '"';
          i++;
        } else q = false;
      } else f += c;
    } else if (c === '"') q = true;
    else if (c === ',') {
      row.push(f);
      f = '';
    } else if (c === '\n') {
      row.push(f.endsWith('\r') ? f.slice(0, -1) : f);
      rows.push(row);
      row = [];
      f = '';
    } else f += c;
  }
  if (f !== '' || row.length > 0) rows.push([...row, f]);
  return rows;
}

export function readRows(text: string): Row[] {
  const [head, ...body] = parseCsv(text.replace(/^﻿/, ''));
  if (!head) throw new Error('empty CSV');
  return body.map((cells, n) => {
    if (cells.length !== head.length) throw new Error(`CSV row ${n + 2}: ${cells.length} cells, header ${head.length}`);
    const o = Object.fromEntries(OUT_COLUMNS.map((k) => [k, ''])) as Row;
    head.forEach((k, i) => ((o as Record<string, string>)[k] = cells[i] ?? ''));
    return o;
  });
}

const quote = (v: string) => (/[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v);
export const writeRows = (rows: readonly Row[]): string =>
  [OUT_COLUMNS.join(','), ...rows.map((r) => OUT_COLUMNS.map((k) => quote(r[k])).join(','))].join('\n') + '\n';

// ---------- normalisation (§7.2): one minus glyph, spaces around the " | " divider collapsed ----------

export const collapse = (t: string): string => t.replace(/\s*\|\s*/g, ' | ').trim();
export const normalise = (t: string): string => collapse(t.replaceAll('−', '-'));

// ---------- selection state of a row ----------

const PRESET: Record<string, Preset> = { '7D': '7d', '30D': '30d', MTD: 'mtd', QTD: 'qtd', CUSTOM: 'custom' };
const CMP: Record<string, Comparator> = { PREV: 'prev', LY: 'ly', PLAN: 'plan', NONE: 'none' };
const GRAIN: Record<string, Grain> = { DAY: 'day', WEEK: 'week', MONTH: 'month' };
const RANK: Record<string, RankMode> = { WORST: 'worst', TOP: 'top' };
const list = (v: string) => (v === '' ? [] : v.split('+'));
const pick = <T>(m: Record<string, T>, v: string, what: string): T => {
  const x = m[v];
  if (x === undefined) throw new Error(`unknown ${what} "${v}"`);
  return x;
};

function cross(v: string): Cross | null {
  if (v === '') return null;
  const [kind, rest = ''] = v.split(':');
  if (kind === 'cp') return { kind: 'campaign', campaign: rest };
  if (kind === 'ch') {
    const [channel = '', platform] = rest.split('|');
    return { kind: 'channel', channel, platform: platform ?? null };
  }
  throw new Error(`unknown cross "${v}"`);
}

export function selectionOf(ds: Dataset, r: Row): Selection {
  const day = (iso: string) => (iso === '' ? null : ds.cal.ix(iso));
  return {
    ...DEFAULT_SELECTION,
    view: r.view as ViewKey,
    preset: pick(PRESET, r.preset, 'preset'),
    from: day(r.from),
    to: day(r.to),
    cmp: pick(CMP, r.comparator, 'comparator'),
    grain: pick(GRAIN, r.granularity, 'granularity'),
    platforms: list(r.platforms),
    market: r.market || null,
    tier: r.tier || null,
    channels: list(r.channels),
    networks: list(r.networks),
    campaigns: list(r.campaigns),
    statuses: r.statuses === '' ? null : (list(r.statuses) as Status[]),
    model: r.model as ModelCode,
    cross: cross(r.cross),
    o5: pick(RANK, r.o5_mode, 'O5 mode'),
    o6: pick(RANK, r.o6_mode, 'O6 mode'),
  };
}

/** The selection key of a row: rows of one sel_id share it (asserted in the test). */
export const stateKey = (r: Row): string =>
  COLUMNS.slice(2, 18)
    .map((k) => r[k])
    .join('|');

// ---------- element → JS text ----------

// Power BI dimension codes of the captured slots → the JS card order (dim_funnel_stage, dim_c2_stage, dim_act_bin)
const O1 = ['IMP', 'CLK', 'LAND', 'SIGNUP', 'ACT', 'TRIAL', 'PAID'];
const O2 = ['TRIAL_TO_PAID', 'D7_RETENTION', 'D30_RETENTION', 'REFUND_RATE', 'BRAND_SHARE', 'ATTR_GAP'];
const C2 = ['CLICK', 'LAND', 'INSTALL', 'SIGNUP', 'ACT', 'TRIAL', 'PAID'];
const J3 = ['LT1H', 'H1_6', 'H6_24', 'D1_2', 'D2_4', 'D4_7', 'D7_30'];
const P1 = ['campaign', 'channel', 'platform', 'spend', 'pacing', 'cpa', 'roas', 'slope', 'frequency'];
const P5 = ['term', 'cpc', 'cvr', 'conv'];
const J1 = ['page', 'visits', 'cvr', 'bounce', 'lcp'];
/** K1 payback ≥ 100 % fill (`K1 Heat Colour`). */
const GREEN = '#1E9E6A';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "Nov 2025" (the view's month label) → "2025-11" (the capture's month key). */
const monthKeyOf = (label: string) => {
  const [mmm = '', yyyy = ''] = label.split(' ');
  return `${yyyy}-${String(MONTHS.indexOf(mmm) + 1).padStart(2, '0')}`;
};
const rowIx = (slot: string | undefined) => {
  const m = /^row(\d+)$/.exec(slot ?? '');
  return m ? Number(m[1]) - 1 : -1;
};

type Resolver = (element: string) => string | undefined;

/** Builds every view model once for a selection and returns element → displayed text (undefined = no such slot). */
export function resolver(ds: Dataset, sel: Selection): Resolver {
  const ctx = context(ds, sel);
  const fr = frame(ctx);
  const memo = new Map<string, unknown>();
  const once = <T>(k: string, f: () => T): T => {
    if (!memo.has(k)) memo.set(k, f());
    return memo.get(k) as T;
  };
  const ov = () => once('ov', () => overview(ctx));
  const chn = () => once('ch', () => channels(ctx));
  const cmp = () => once('cp', () => campaigns(ctx));
  const jr = () => once('jr', () => journey(ctx));
  const ko = () => once('ko', () => cohorts(ctx));
  const dyn = (n: number) => once(`dyn${n}`, () => dynamics(ctx, n));

  return (element) => {
    const [card = '', a, b, c] = element.split('.');
    if (element === 'pill') return fr.pill;
    if (element === 'synced') return fr.synced;
    if (element === 'chips') return chipsText(chips(ds, sel));

    const v = /^V([1-6])$/.exec(card);
    if (v) {
      const x = fr.vitals[Number(v[1]) - 1];
      if (!x) return undefined;
      if (a === 'label') return x.label;
      if (a === 'value') return x.value;
      if (a === 'ly') return x.ly;
      if (a === 'delta') return x.delta === '' ? '' : `${x.arrow} ${x.delta}`;
      return undefined;
    }
    if (card === 'O1') {
      const x = ov().funnel[O1.indexOf(a ?? '')];
      if (!x) return undefined;
      return b === 'stage' ? x.label : b === 'count' ? x.value : b === 'label' ? x.tip : undefined;
    }
    if (card === 'O2') {
      const x = ov().guardrails[O2.indexOf(a ?? '')];
      if (!x) return undefined;
      return b === 'label' ? x.label : b === 'target' ? x.target : b === 'value' ? x.value : undefined;
    }
    if (card === 'O3') {
      const pts = ov().o3.points;
      if (a === 'buckets') return String(pts.length);
      const p = pts.find((x) => x.day === a);
      if (!p) return undefined;
      // raw engine values; displayed with format.ts as the O3 tooltip / axis labels do ("$#,0")
      return b === 'spend'
        ? usd(p.spend)
        : b === 'plan'
          ? usd(p.plan)
          : b === 'cac'
            ? p.cac === null
              ? ''
              : usd(p.cac)
            : undefined;
    }
    if (card === 'O5') {
      const rows = ov().o5;
      if (a === 'rows') return String(rows.length);
      const x = rows[rowIx(a)];
      if (!x) return undefined;
      const f: Record<string, string> = {
        rank: String(x.rank),
        campaign: x.campaign,
        channel: x.channel,
        now: x.paid,
        before: x.before,
        delta: x.delta,
        alert: x.alert,
      };
      return f[b ?? ''];
    }
    if (card === 'O6') {
      const rows = ov().o6;
      if (a === 'rows') return String(rows.length);
      const x = rows[rowIx(a)];
      if (!x) return undefined;
      return b === 'campaign' ? x.campaign : b === 'delta' ? x.delta : undefined;
    }
    if (card === 'C1') {
      const rows = chn().c1;
      if (a === 'rows') return String(rows.length);
      if (a === 'platform_rows') return String(rows.reduce((n, r) => n + r.platforms.length, 0));
      const ch = rows.find((r) => r.code === a);
      if (!ch) return undefined;
      const [row, field] = c === undefined ? [ch, b] : [ch.platforms.find((p) => p.platform === b), c];
      if (!row) return undefined;
      const f: Record<string, string> = {
        spend: row.spend,
        share: row.share,
        paid: row.paid,
        cac: row.cac,
        roas: row.roas,
        click_signup: row.cs,
        pacing: row.pacing,
        flags: row.flags.text,
      };
      return f[field ?? ''];
    }
    if (card === 'C2') {
      const x = chn().c2[C2.indexOf(a ?? '')];
      if (!x) return undefined;
      return b === 'web' ? x.webText : b === 'app' ? x.appText : undefined;
    }
    if (card === 'C5' || card === 'C6') {
      const rows = card === 'C5' ? chn().c5 : chn().c6;
      if (a === 'rows') return String(rows.length);
      const x = rows.find((r) => r.code === a);
      return x && b === 'label' ? x.label : undefined;
    }
    if (card === 'P1') {
      const rows = cmp().p1;
      if (a === 'rows') return String(rows.length);
      const x = rows[rowIx(a)];
      if (!x) return undefined;
      if (b === 'flags') return x.flags.text;
      const i = P1.indexOf(b ?? '');
      return i < 0 ? undefined : x.cells[i];
    }
    if (card === 'P5') {
      const p5 = cmp().p5;
      if (a === 'title') return CARDS.find((x) => x.code === 'P5')?.title;
      if (!p5) return undefined;
      if (a === 'caption') return p5.caption;
      if (a === 'rows') return String(p5.rows.length);
      const x = p5.rows[rowIx(a)];
      const i = P5.indexOf(b ?? '');
      return x && i >= 0 ? x[i] : undefined;
    }
    if (card === 'P6' || card === 'P7') {
      const rows = card === 'P6' ? cmp().p6 : cmp().p7;
      if (a === 'rows') return String(rows.length);
      const x = rows[rowIx(a)];
      if (!x) return undefined;
      return b === 'channel' ? x.name : b === 'value' ? x.label : undefined;
    }
    if (card === 'J1' || card === 'J2' || card === 'J3' || card === 'J4') {
      const j = jr();
      if (!j) return undefined;
      if (card === 'J1') {
        if (a === 'rows') return String(j.j1.length);
        const x = j.j1[rowIx(a)];
        const i = J1.indexOf(b ?? '');
        return x && i >= 0 ? x.cells[i] : undefined;
      }
      if (card === 'J2') {
        const steps = ds.m.steps;
        if (a === 'highlight') return steps[j.j2.findIndex((x) => x.highlight)]?.step_code ?? '';
        const i = steps.findIndex((s) => s.step_code === a);
        return i >= 0 && b === 'share' ? j.j2[i]?.text : undefined;
      }
      if (card === 'J3') {
        if (a === 'median_bin') return J3[j.j3.findIndex((x) => x.highlight)] ?? '';
        const i = J3.indexOf(a ?? '');
        return i >= 0 && b === 'share' ? j.j3[i]?.text : undefined;
      }
      if (a === 'target') return j.targetText;
      const i = ds.m.segments.findIndex((s) => s.segment_code === a);
      return i >= 0 && b === 'rate' ? j.j4[i]?.text : undefined;
    }
    if (card === 'K1') {
      const k = ko().k1;
      const cells = k.flatMap((r) => r.cells.map((x, off) => ({ key: `${monthKeyOf(r.label)}.m${off}`, ...x })));
      const drawn = cells.filter((x) => x.text !== '');
      if (a === 'cells') return String(drawn.length);
      if (a === 'green_cells')
        return drawn
          .filter((x) => x.fill === GREEN)
          .map((x) => x.key)
          .join(', ');
      return cells.find((x) => x.key === `${a}.${b}`)?.text;
    }
    if (card === 'K2' || card === 'K6') {
      const rows = card === 'K2' ? ko().k2 : ko().k6;
      if (a === 'rows') return String(rows.length);
      return rows.find((r) => r.code === a)?.label;
    }
    if (card === 'K7') {
      const rows = ko().k7;
      if (a === 'rows') return String(rows.length);
      return rows.find((r) => monthKeyOf(r.label) === a)?.text;
    }
    if (card === 'DYN') {
      const m = /^v([1-6])$/.exec(a ?? '');
      if (!m) return undefined;
      const d = dyn(Number(m[1]));
      if (b === 'points') return String(d.points.length);
      if (b === 'ly_points') return String(d.points.filter((p) => p.ly !== null).length);
      if (b === 'first_date') return d.points[0]?.day;
      if (b === 'last_date') return d.points.at(-1)?.day;
      if (b === 'last_label') return d.lastLabel;
      return undefined;
    }
    return undefined;
  };
}
