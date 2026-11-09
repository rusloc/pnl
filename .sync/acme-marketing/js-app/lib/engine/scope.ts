import type { Dataset } from './data.ts';
import { DEFAULT_STATUSES } from './selection.ts';
import type { Cross, Filters } from './selection.ts';

// Scope model (contract §3.3, §11 rule 3): every filter but the model resolves to one campaign list. The window mask
// (filters only) drives the vitals; the body mask = window mask ∩ cross-filter drives every body card; the status
// default (Live + Learning) applies to the campaign list (P1, the Campaigns pane) only — totals keep every campaign
// until a status is picked explicitly.

const has = (list: readonly string[], v: string | undefined) =>
  list.length === 0 || (v !== undefined && list.includes(v));

/** Campaigns passing every picked facet (statuses only when picked explicitly). */
/** The scope functions read only the campaign list, so the URL parser can use them before the Dataset exists. */
type Campaigns = Pick<Dataset, 'campaigns'>;

export function windowScope(ds: Campaigns, f: Filters): number[] {
  return ds.campaigns.flatMap((c, i) =>
    has(f.platforms, c.platform_code) &&
    (f.market === null || c.market_code === f.market) &&
    (f.tier === null || c.tier_code === f.tier) &&
    has(f.channels, c.channel_code) &&
    has(f.networks, c.network_code) &&
    has(f.campaigns, c.campaign_key) &&
    (f.statuses === null || f.statuses.includes(c.status_code))
      ? [i]
      : [],
  );
}

/** Campaigns of the cross-filter (undefined = no cross-filter). */
export function crossScope(ds: Campaigns, x: Cross | null): number[] | undefined {
  if (!x) return undefined;
  return ds.campaigns.flatMap((c, i) =>
    (
      x.kind === 'campaign'
        ? c.campaign_key === x.campaign
        : c.channel_code === x.channel && (x.platform === null || c.platform_code === x.platform)
    )
      ? [i]
      : [],
  );
}

/** Window filters ∩ cross-filter: the scope of every body card (A-13). */
export function bodyScope(ds: Campaigns, f: Filters, x: Cross | null): number[] {
  const w = windowScope(ds, f);
  const xs = crossScope(ds, x);
  return xs ? w.filter((c) => xs.includes(c)) : w;
}

/** The campaign list rows (P1 Row Visible): an explicit status pick, else Live + Learning. */
export function listScope(ds: Campaigns, f: Filters, cs: readonly number[]): number[] {
  const st = f.statuses ?? DEFAULT_STATUSES;
  return cs.filter((c) => {
    const status = ds.campaigns[c]?.status_code;
    return status !== undefined && st.includes(status);
  });
}

/** The single campaign of a scope, or null (R90's own → channel → ALL fallback keys on it). */
export const singleOf = (cs: readonly number[]): number | null => (cs.length === 1 ? (cs[0] ?? null) : null);
