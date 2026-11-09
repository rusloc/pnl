import { z } from 'zod';
import type { WorkType } from '../data/manifest.ts';
import type { DatasetManifest } from './data.ts';
import { DEFAULT_WORK_TYPES, RESET_SELECTION } from './selection.ts';
import type { Calculation, PlanType, Selection } from './selection.ts';

// URL state (contract §6): six keys, every value validated with Zod at the boundary. Defaults are omitted; unknown keys
// are ignored; an invalid value falls back to that key's default (never a broken page); values are capped at 256
// characters, except `l`, capped at the length of the full loader list so every selection the page can make round-trips.
// A pick outside the manifest is dropped with the rest kept. serializeSelection writes the canonical query (fixed key
// order, manifest-order lists), so parse → serialize → parse is idempotent.

const MAX = 256;
const raw = z.string().max(MAX);

export type UrlCatalog = Pick<DatasetManifest, 'weeks' | 'offices' | 'loaders'>;

const WT_URL = { trucks: 'Trucks', onspot: 'On spot', undefined: 'Undefined' } as const satisfies Record<
  string,
  WorkType
>;
const WT_TOKENS = Object.keys(WT_URL) as (keyof typeof WT_URL)[];

const weekKey = (w: { year: number; week_num: number }) => `${w.year}-${String(w.week_num).padStart(2, '0')}`;

function value<T>(params: URLSearchParams, key: string, schema: z.ZodType<T>): T | undefined {
  const v = params.get(key);
  if (v === null) return undefined;
  const r = schema.safeParse(v);
  return r.success ? r.data : undefined;
}

/** Picks in catalog order, case-insensitive; unknown entries dropped; [] when nothing valid or everything picked. */
function list(params: URLSearchParams, key: string, all: readonly string[], schema: z.ZodType<string> = raw): string[] {
  const v = value(params, key, schema);
  if (v === undefined) return [];
  const asked = new Set(v.split(',').map((x) => x.trim().toLowerCase()));
  const picks = all.filter((c) => asked.has(c.toLowerCase()));
  return picks.length === all.length ? [] : picks;
}

export function parseSelection(params: URLSearchParams, m: UrlCatalog): Selection {
  const loaderNames = m.loaders.map((l) => l.loader_name);
  const week = value(params, 'w', raw);
  const found = week === undefined ? undefined : m.weeks.find((w) => weekKey(w) === week);

  const wtRaw = value(params, 'wt', raw);
  const asked = new Set((wtRaw ?? '').split(',').map((x) => x.trim().toLowerCase()));
  const picked = WT_TOKENS.filter((t) => asked.has(t)).map((t) => WT_URL[t]);
  const workTypes: WorkType[] =
    picked.length > 0
      ? (['On spot', 'Trucks', 'Undefined'] as const).filter((t) => picked.includes(t))
      : [...DEFAULT_WORK_TYPES];

  const planType: PlanType = value(params, 'pt', z.enum(['month', 'week'])) === 'week' ? 'Week' : 'Month';
  const calculation: Calculation =
    value(params, 'calc', z.enum(['weighted', 'linear'])) === 'linear' ? 'Linear' : 'Weighted';

  return {
    week: found?.week_ix ?? null,
    offices: list(
      params,
      'o',
      m.offices.map((o) => o.office_name),
    ),
    loaders: list(params, 'l', loaderNames, z.string().max(loaderNames.join(',').length)),
    workTypes,
    planType,
    calculation,
  };
}

/** Canonical query string (no "?"): commas stay literal, so the §6 deep links are their own canonical form. */
export function serializeSelection(s: Selection, m: UrlCatalog): string {
  const q: [string, string][] = [];
  if (s.week !== null) {
    const w = m.weeks[s.week];
    if (w) q.push(['w', weekKey(w)]);
  }
  if (s.offices.length > 0) q.push(['o', s.offices.map((o) => o.toLowerCase()).join(',')]);
  if (s.loaders.length > 0) q.push(['l', s.loaders.join(',')]);
  const defaultWt =
    s.workTypes.length === DEFAULT_WORK_TYPES.length && DEFAULT_WORK_TYPES.every((t) => s.workTypes.includes(t));
  if (!defaultWt) q.push(['wt', WT_TOKENS.filter((t) => s.workTypes.includes(WT_URL[t])).join(',')]);
  if (s.planType !== RESET_SELECTION.planType) q.push(['pt', s.planType.toLowerCase()]);
  if (s.calculation !== RESET_SELECTION.calculation) q.push(['calc', s.calculation.toLowerCase()]);
  return q.map(([k, v]) => `${k}=${encodeURIComponent(v).replaceAll('%2C', ',')}`).join('&');
}
