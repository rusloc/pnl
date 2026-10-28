import { z } from 'zod';
import { ATTRIBUTES } from './copy.ts';
import type { AttrKey } from './copy.ts';

// URL state (E-62, F-37 analogue): the query string is the only untrusted input (E-82). Each key is validated on its
// own with Zod; unknown keys are ignored and an invalid value falls back to its default, so a hand-edited link never
// breaks the page. serialize() writes the canonical form (defaults omitted, attribute picks in menu order).

export const PERIODS = ['week', 'ptd', 'ytd'] as const;
export const COMPARATORS = ['budget', 'ly', 'lw'] as const;
export const REGIONS = ['all', 'nl', 'be', 'online'] as const;

export type Period = (typeof PERIODS)[number];
export type Comparator = (typeof COMPARATORS)[number];
export type Region = (typeof REGIONS)[number];
export type Picks = Readonly<Record<AttrKey, readonly string[]>>;

export interface Selection {
  period: Period;
  compare: Comparator;
  region: Region;
  picks: Picks;
}

export const NO_PICKS: Picks = { group: [], lever: [], horizon: [], owner: [], statement: [] };
export const DEFAULT_SELECTION: Selection = { period: 'week', compare: 'budget', region: 'all', picks: NO_PICKS };

const SINGLE = {
  p: z.enum(PERIODS).catch('week'),
  c: z.enum(COMPARATORS).catch('budget'),
  r: z.enum(REGIONS).catch('all'),
} as const;

/** Comma list of one attribute's codes; unknown codes are dropped, order and duplicates normalised to the menu. */
function picksOf(params: URLSearchParams, key: AttrKey): string[] {
  const raw = z
    .string()
    .max(256)
    .catch('')
    .parse(params.get(key) ?? '');
  const wanted = new Set(raw.split(','));
  const options: readonly (readonly [string, string])[] = ATTRIBUTES.find((a) => a.key === key)?.options ?? [];
  return options.map(([code]) => code).filter((code) => wanted.has(code));
}

export function parseSelection(params: URLSearchParams): Selection {
  return {
    period: SINGLE.p.parse(params.get('p') ?? undefined),
    compare: SINGLE.c.parse(params.get('c') ?? undefined),
    region: SINGLE.r.parse(params.get('r') ?? undefined),
    picks: {
      group: picksOf(params, 'group'),
      lever: picksOf(params, 'lever'),
      horizon: picksOf(params, 'horizon'),
      owner: picksOf(params, 'owner'),
      statement: picksOf(params, 'statement'),
    },
  };
}

export function serializeSelection(s: Selection): string {
  const q = new URLSearchParams();
  if (s.period !== DEFAULT_SELECTION.period) q.set('p', s.period);
  if (s.compare !== DEFAULT_SELECTION.compare) q.set('c', s.compare);
  if (s.region !== DEFAULT_SELECTION.region) q.set('r', s.region);
  for (const a of ATTRIBUTES) {
    const options: readonly (readonly [string, string])[] = a.options;
    const codes = options.map(([code]) => code).filter((code) => s.picks[a.key].includes(code));
    if (codes.length) q.set(a.key, codes.join(','));
  }
  return q.toString();
}
