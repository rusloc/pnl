import { z } from 'zod';
import type { SalesManifest } from './manifest.ts';
import type { Comparator, Drill, MarketSel, SalesSelection, TimeView, ViewId } from './types.ts';
import { monthIndex, monthKey } from './windows.ts';

// URL state of the /sales route (layout-spec §6; F-37 analogue): ?view=&market=&period=&month=&cmp=&drill=. The query
// string is the whole state and the boundary to the engine: each known key is validated with Zod, an invalid value
// falls back to its default (and the caller rewrites the URL), unknown keys are dropped. Defaults are omitted, so the
// bare URL is the spec default: Overview · All markets · Month · last closed month · vs Budget.

const VIEWS = ['overview', 'loans', 'clients', 'portfolio', 'revenue'] as const satisfies readonly ViewId[];
const MARKET_URL = { all: 'ALL', pl: 'PL', ro: 'RO', pt: 'PT' } as const satisfies Record<string, MarketSel>;
const PERIOD_URL = { month: 'M', qtd: 'Q', ytd: 'Y', r12m: 'R' } as const satisfies Record<string, TimeView>;
const CMP_URL = { budget: 'BUD', py: 'PY' } as const satisfies Record<string, Comparator>;

const invert = <K extends string, V extends string>(o: Record<K, V>) =>
  Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k])) as Record<V, K>;
const MARKET_KEY = invert(MARKET_URL);
const PERIOD_KEY = invert(PERIOD_URL);
const CMP_KEY = invert(CMP_URL);

const KEYS = ['view', 'market', 'period', 'month', 'cmp', 'drill'] as const;

const enumOf = <T extends Record<string, string>>(o: T) =>
  z.enum(Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]);

type Query = Pick<URLSearchParams, 'get'>;

export interface UrlCodec {
  defaults(): SalesSelection;
  parse(query: Query): SalesSelection;
  serialize(sel: SalesSelection): string;
}

export function createUrlCodec(manifest: SalesManifest): UrlCodec {
  const first = monthIndex(manifest.source.firstMonth);
  const last = monthIndex(manifest.source.lastClosedMonth);
  const agents = new Set(manifest.dims.agent.map((a) => a.agent_code));

  const drill = z
    .string()
    .regex(/^(loans(\.(all|pl|ro|pt))?|agent\.[A-Z]\d{3}|client\.\d{1,9})$/)
    .transform((s, ctx): Drill => {
      const [kind, arg] = s.split('.') as [string, string | undefined];
      if (kind === 'loans') return { kind: 'loans', market: MARKET_URL[(arg ?? 'all') as keyof typeof MARKET_URL] };
      if (kind === 'agent' && arg && agents.has(arg)) return { kind: 'agent', agent: arg };
      if (kind === 'client' && arg) return { kind: 'client', client: Number(arg) };
      ctx.addIssue({ code: 'custom', message: `unknown drill ${s}` });
      return z.NEVER;
    });

  const schema = z
    .object({
      view: z.enum(VIEWS).catch('overview'),
      market: enumOf(MARKET_URL).catch('all'),
      period: enumOf(PERIOD_URL).catch('month'),
      month: z
        .string()
        .regex(/^\d{4}-\d{2}$/)
        .refine((k) => {
          const i = monthIndex(k);
          return i >= first && i <= last;
        })
        .catch(monthKey(last)),
      cmp: enumOf(CMP_URL).catch('budget'),
      drill: drill.nullable().catch(null),
    })
    .strict();

  const defaults = (): SalesSelection => ({
    view: 'overview',
    market: 'ALL',
    tv: 'M',
    anchor: last,
    cmp: 'BUD',
    drill: null,
  });

  function parse(query: Query): SalesSelection {
    const d = defaults();
    const raw = Object.fromEntries(KEYS.map((k) => [k, query.get(k) ?? undefined]));
    const q = schema.parse({
      view: raw.view ?? d.view,
      market: raw.market ?? 'all',
      period: raw.period ?? 'month',
      month: raw.month ?? monthKey(last),
      cmp: raw.cmp ?? 'budget',
      drill: raw.drill ?? null,
    });
    return {
      view: q.view,
      market: MARKET_URL[q.market],
      tv: PERIOD_URL[q.period],
      anchor: monthIndex(q.month),
      cmp: CMP_URL[q.cmp],
      drill: q.drill,
    };
  }

  function drillKey(dr: Drill): string {
    switch (dr.kind) {
      case 'loans':
        return dr.market === 'ALL' ? 'loans' : `loans.${MARKET_KEY[dr.market]}`;
      case 'agent':
        return `agent.${dr.agent}`;
      case 'client':
        return `client.${dr.client}`;
    }
  }

  function serialize(sel: SalesSelection): string {
    const d = defaults();
    const p = new URLSearchParams();
    if (sel.view !== d.view) p.set('view', sel.view);
    if (sel.market !== d.market) p.set('market', MARKET_KEY[sel.market]);
    if (sel.tv !== d.tv) p.set('period', PERIOD_KEY[sel.tv]);
    if (sel.anchor !== d.anchor) p.set('month', monthKey(sel.anchor));
    if (sel.cmp !== d.cmp) p.set('cmp', CMP_KEY[sel.cmp]);
    if (sel.drill) p.set('drill', drillKey(sel.drill));
    return p.toString();
  }

  return { defaults, parse, serialize };
}
