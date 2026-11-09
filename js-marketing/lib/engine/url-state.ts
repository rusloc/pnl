import { z } from 'zod';
import type { Manifest, ModelCode, Status } from '../data/manifest.ts';
import { STATUSES } from '../data/manifest.ts';
import type { Calendar } from './calendar.ts';
import { bodyScope } from './scope.ts';
import { DEFAULT_SELECTION, VIEW_KEYS } from './selection.ts';
import type { Cross, RankMode, Selection, ViewKey } from './selection.ts';
import { COMPARATORS, GRAINS, PRESETS } from './windows.ts';

// URL state and hash routing (contract §6, A-62; F-37 analogue): the view in the hash, 18 query keys, every value
// validated with Zod at the boundary. Defaults are omitted; unknown keys are ignored; an invalid value falls back to
// that key's default (never a broken page); values are capped at 256 characters. serializeSelection writes the
// canonical query (fixed key order, sorted lists), so parse → serialize → parse is idempotent.

const MAX = 256;
const MODEL_URL = { dda: 'DDA', lc: 'LAST_CLICK', ft: 'FIRST_TOUCH', pf: 'PLATFORM' } as const satisfies Record<
  string,
  ModelCode
>;
const MODEL_OUT = Object.fromEntries(Object.entries(MODEL_URL).map(([k, v]) => [v, k])) as Record<ModelCode, string>;

export interface Catalog {
  platforms: readonly string[];
  markets: readonly string[];
  tiers: readonly string[];
  channels: readonly string[];
  networks: readonly string[];
  campaigns: readonly string[];
  cal: Calendar;
  /** the campaign rows: a cross-filter outside the scope is dropped on parse */
  rows: Manifest['campaigns'];
}

export function catalog(m: Manifest, cal: Calendar): Catalog {
  return {
    platforms: m.platforms.map((p) => p.platform_code),
    markets: [...new Set(m.campaigns.map((c) => c.market_code))],
    tiers: [...new Set(m.campaigns.map((c) => c.tier_code))],
    channels: m.channels.map((c) => c.channel_code),
    networks: m.networks.map((n) => n.network_code),
    campaigns: m.campaigns.map((c) => c.campaign_key),
    cal,
    rows: m.campaigns,
  };
}

const raw = z.string().max(MAX);
/** Comma list of lower-case codes → the catalog's codes in catalog order, deduplicated; null on any unknown value. */
const codeList = (all: readonly string[], lower = true) =>
  raw.transform((v, ctx) => {
    const picks = v.split(',').map((x) => (lower ? x.toUpperCase() : x));
    if (picks.some((p) => !all.includes(p))) {
      ctx.addIssue({ code: 'custom', message: 'unknown code' });
      return z.NEVER;
    }
    return all.filter((c) => picks.includes(c));
  });

const one = <T extends string>(values: readonly T[]) => z.enum(values as [T, ...T[]]);
const isoDate = z.iso.date();

function field<T>(params: URLSearchParams, key: string, schema: z.ZodType<T>): T | undefined {
  const v = params.get(key);
  if (v === null) return undefined;
  const r = schema.safeParse(v);
  return r.success ? r.data : undefined;
}

function parseCross(v: string, cat: Catalog): Cross | null {
  const cp = /^cp:([A-Za-z0-9_]+)$/.exec(v);
  if (cp?.[1] && cat.campaigns.includes(cp[1])) return { kind: 'campaign', campaign: cp[1] };
  const ch = /^ch:([a-z_]+)(?:\|pf:([a-z]+))?$/.exec(v);
  const channel = ch?.[1]?.toUpperCase();
  const platform = ch?.[2]?.toUpperCase() ?? null;
  if (channel && cat.channels.includes(channel) && (platform === null || cat.platforms.includes(platform)))
    return { kind: 'channel', channel, platform };
  return null;
}

/** Hash → view (`#overview` … `#cohorts`; anything else = overview). */
export function parseView(hash: string): ViewKey {
  const v = hash.replace(/^#/, '');
  return (VIEW_KEYS as readonly string[]).includes(v) ? (v as ViewKey) : 'overview';
}

/** A deep link may carry its query inside the hash (`#campaigns?sel=cp:SOC_META_LAL2`, contract §8 step 6): those keys
 *  count too (the search part wins on a clash) and the canonical rewrite moves them to the search. */
export function parseSelection(search: URLSearchParams, cat: Catalog, hash = ''): Selection {
  const q = hash.indexOf('?');
  const params = new URLSearchParams(search);
  if (q >= 0) for (const [k, v] of new URLSearchParams(hash.slice(q + 1))) if (!params.has(k)) params.set(k, v);
  const viewPart = q >= 0 ? hash.slice(0, q) : hash;
  const d = DEFAULT_SELECTION;
  let preset = field(params, 'p', one(PRESETS)) ?? d.preset;
  let from: number | null = null;
  let to: number | null = null;
  if (preset === 'custom') {
    // Custom is read as on screen (§3.1): an inverted range, or a range wholly outside the data (to before the first
    // day, from after the as-of day), is the default window, so the canonical URL drops it; else clip to the data.
    const f = field(params, 'from', isoDate);
    const t = field(params, 'to', isoDate);
    const rawFrom = f === undefined ? 0 : cat.cal.ix(f);
    const rawTo = t === undefined ? cat.cal.asOf : cat.cal.ix(t);
    if (rawFrom > rawTo || rawTo < 0 || rawFrom > cat.cal.asOf) preset = d.preset;
    else {
      from = Math.max(rawFrom, 0);
      to = Math.min(rawTo, cat.cal.asOf);
    }
  }
  const all = <T extends string>(xs: T[] | undefined, n: number) => (xs === undefined || xs.length === n ? [] : xs);
  const statuses = field(params, 'st', codeList(STATUSES)) as Status[] | undefined;
  const mUrl = field(params, 'm', one(Object.keys(MODEL_URL) as (keyof typeof MODEL_URL)[]));
  const dyn = field(params, 'dyn', z.enum(['v1', 'v2', 'v3', 'v4', 'v5', 'v6']));
  const sel = params.get('sel');
  const out: Selection = {
    view: parseView(viewPart),
    preset,
    from,
    to,
    cmp: field(params, 'c', one(COMPARATORS)) ?? d.cmp,
    grain: field(params, 'g', one(GRAINS)) ?? d.grain,
    platforms: all(field(params, 'pf', codeList(cat.platforms)), cat.platforms.length),
    market: field(params, 'mk', raw.transform((v) => v.toUpperCase()).pipe(one(cat.markets))) ?? null,
    tier: field(params, 'tr', raw.transform((v) => v.toUpperCase()).pipe(one(cat.tiers))) ?? null,
    channels: all(field(params, 'ch', codeList(cat.channels)), cat.channels.length),
    networks: all(field(params, 'nw', codeList(cat.networks)), cat.networks.length),
    campaigns: all(field(params, 'cp', codeList(cat.campaigns, false)), cat.campaigns.length),
    statuses: statuses && statuses.length > 0 ? statuses : null,
    model: mUrl ? MODEL_URL[mUrl] : d.model,
    cross: sel !== null && sel.length <= MAX ? parseCross(sel, cat) : null,
    o5: (field(params, 'o5', z.enum(['worst', 'top'])) ?? d.o5) as RankMode,
    o6: (field(params, 'o6', z.enum(['worst', 'top'])) ?? d.o6) as RankMode,
    dyn: dyn ? Number(dyn.slice(1)) : null,
    theme: field(params, 'theme', z.enum(['light', 'dark'])) ?? null,
  };
  // a cross-filter outside the window filters' scope selects nothing: drop it (canonical URL without `sel`)
  if (out.cross && bodyScope({ campaigns: cat.rows }, out, out.cross).length === 0) out.cross = null;
  return out;
}

const lower = (xs: readonly string[]) => xs.map((x) => x.toLowerCase()).join(',');

/** Canonical query string (no "?"); defaults omitted. The view travels in the hash (viewHash). */
export function serializeSelection(s: Selection, cal: Calendar): string {
  const q: [string, string][] = [];
  const d = DEFAULT_SELECTION;
  if (s.preset !== d.preset) q.push(['p', s.preset]);
  if (s.preset === 'custom' && s.from !== null && s.to !== null) {
    q.push(['from', cal.iso(s.from)]);
    q.push(['to', cal.iso(s.to)]);
  }
  if (s.cmp !== d.cmp) q.push(['c', s.cmp]);
  if (s.grain !== d.grain) q.push(['g', s.grain]);
  if (s.platforms.length > 0) q.push(['pf', lower(s.platforms)]);
  if (s.market) q.push(['mk', s.market.toLowerCase()]);
  if (s.tier) q.push(['tr', s.tier.toLowerCase()]);
  if (s.channels.length > 0) q.push(['ch', lower(s.channels)]);
  if (s.networks.length > 0) q.push(['nw', lower(s.networks)]);
  if (s.campaigns.length > 0) q.push(['cp', s.campaigns.join(',')]);
  if (s.statuses) q.push(['st', lower(s.statuses)]);
  if (s.model !== d.model) q.push(['m', MODEL_OUT[s.model]]);
  if (s.cross)
    q.push([
      'sel',
      s.cross.kind === 'campaign'
        ? `cp:${s.cross.campaign}`
        : `ch:${s.cross.channel.toLowerCase()}${s.cross.platform ? `|pf:${s.cross.platform.toLowerCase()}` : ''}`,
    ]);
  if (s.o5 !== d.o5) q.push(['o5', s.o5]);
  if (s.o6 !== d.o6) q.push(['o6', s.o6]);
  if (s.dyn !== null) q.push(['dyn', `v${s.dyn}`]);
  if (s.theme) q.push(['theme', s.theme]);
  return new URLSearchParams(q).toString();
}

export const viewHash = (v: ViewKey): string => (v === 'overview' ? '' : `#${v}`);
