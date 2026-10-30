import { z } from 'zod';
import { ATTRIBUTES } from './copy.ts';
import type { AttrKey } from './copy.ts';
import type { Catalog } from './items.ts';

// URL state (E-62, F-37 analogue): the query string is the only untrusted input (E-82). Each key is validated on its
// own with Zod; unknown keys are ignored and an invalid value falls back to its default, so a hand-edited link never
// breaks the page. serialize() writes the canonical form (defaults omitted, attribute picks in menu order).
// Item `i` (E-91 key, granularity implied) must also be a listed item; the default item (the as-of week) is `null`.
// Retired keys still parse: `p` (week · ptd · ytd → the as-of week · its period · its year; ignored when `i` is present,
// never written), `c=lw` (→ prev). Retired keys parsed as unknown (ignored, dropped by the canonical rewrite):
// `statement`, `horizon` (attributes removed from the Filters menu, USER 2026-10-29).
// Category `cat` (E-62, E-100): comma-separated dim_category codes, normalised to sort_order, deduplicated, unknown codes
// dropped (case-sensitive); nothing valid, or all of them, = All = key absent. Written after `r`, before the attributes.

export const COMPARATORS = ['budget', 'ly', 'prev'] as const;
export const REGIONS = ['all', 'nl', 'be', 'online'] as const;

export type Comparator = (typeof COMPARATORS)[number];
export type Region = (typeof REGIONS)[number];
export type Picks = Readonly<Record<AttrKey, readonly string[]>>;

export interface Selection {
  /** Item key (FY2026-P10, FY2026-Q4, FY2026, FY2025-W12 …); null = the default item, the as-of week. */
  item: string | null;
  compare: Comparator;
  region: Region;
  /** Picked dim_category codes in sort_order; empty = All (E-100). Never all of them (normalize). */
  categories: readonly string[];
  picks: Picks;
}

export const NO_PICKS: Picks = { group: [], lever: [], owner: [] };
export const DEFAULT_SELECTION: Selection = {
  item: null,
  compare: 'budget',
  region: 'all',
  categories: [],
  picks: NO_PICKS,
};

const SINGLE = {
  i: z
    .string()
    .regex(/^FY\d{4}(-(W\d{2}|P\d{2}|Q[1-4]))?$/)
    .nullable()
    .catch(null),
  p: z.enum(['week', 'ptd', 'ytd']).nullable().catch(null),
  c: z.enum(['budget', 'ly', 'prev', 'lw']).catch('budget'),
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

/** Canonical form: the default item as null; no "Previous" at Year (USER 2026-10-29: it equals Last year) → Last year;
 *  the category pick in sort_order, valid codes only, all of them = All (E-100). */
export function normalize(s: Selection, cat: Catalog): Selection {
  const item = s.item !== null && cat.byKey.has(s.item) && s.item !== cat.defaultKey ? s.item : null;
  const year = item !== null && cat.byKey.get(item)?.gran === 'FY';
  const picked = cat.categories.filter((code) => s.categories.includes(code));
  return {
    ...s,
    item,
    compare: year && s.compare === 'prev' ? 'ly' : s.compare,
    categories: picked.length === cat.categories.length ? [] : picked,
  };
}

export function parseSelection(params: URLSearchParams, cat: Catalog): Selection {
  const legacy = SINGLE.p.parse(params.get('p'));
  const item = params.has('i')
    ? SINGLE.i.parse(params.get('i'))
    : legacy === 'ptd'
      ? cat.asOf.P.key
      : legacy === 'ytd'
        ? cat.asOf.FY.key
        : null;
  const c = SINGLE.c.parse(params.get('c') ?? undefined);
  return normalize(
    {
      item,
      compare: c === 'lw' ? 'prev' : c,
      region: SINGLE.r.parse(params.get('r') ?? undefined),
      categories: z
        .string()
        .max(128)
        .catch('')
        .parse(params.get('cat') ?? '')
        .split(','),
      picks: { group: picksOf(params, 'group'), lever: picksOf(params, 'lever'), owner: picksOf(params, 'owner') },
    },
    cat,
  );
}

export function serializeSelection(s: Selection): string {
  const q = new URLSearchParams();
  if (s.item !== null) q.set('i', s.item);
  if (s.compare !== DEFAULT_SELECTION.compare) q.set('c', s.compare);
  if (s.region !== DEFAULT_SELECTION.region) q.set('r', s.region);
  if (s.categories.length) q.set('cat', s.categories.join(','));
  for (const a of ATTRIBUTES) {
    const options: readonly (readonly [string, string])[] = a.options;
    const codes = options.map(([code]) => code).filter((code) => s.picks[a.key].includes(code));
    if (codes.length) q.set(a.key, codes.join(','));
  }
  return q.toString();
}
