import type { ModelCode, Status } from '../data/manifest.ts';
import type { Comparator, Grain, Preset } from './windows.ts';

// The validated state (contract §6): every input the engine receives. url-state.ts parses it from the URL with Zod;
// components never read `location`. Codes are the dataset's (upper case); the URL spells them in lower case.

export const VIEW_KEYS = ['overview', 'channels', 'campaigns', 'journey', 'cohorts'] as const;
export type ViewKey = (typeof VIEW_KEYS)[number];
export type RankMode = 'worst' | 'top';

/** Cross-filter (one at a time): a C1 row (channel, or channel | platform) or a P1 row (campaign). */
export type Cross =
  { kind: 'channel'; channel: string; platform: string | null } | { kind: 'campaign'; campaign: string };

export interface Filters {
  /** platform codes; [] = all */
  platforms: string[];
  market: string | null;
  tier: string | null;
  channels: string[];
  networks: string[];
  campaigns: string[];
  /** null = the list default (Live + Learning on the campaign list only; totals unfiltered, §3.3) */
  statuses: Status[] | null;
}

export interface Selection extends Filters {
  view: ViewKey;
  preset: Preset;
  /** day indices, only with preset 'custom' */
  from: number | null;
  to: number | null;
  cmp: Comparator;
  grain: Grain;
  model: ModelCode;
  cross: Cross | null;
  o5: RankMode;
  o6: RankMode;
  /** open dynamics pop-up: vital 1 … 6 */
  dyn: number | null;
  theme: 'light' | 'dark' | null;
}

export const DEFAULT_FILTERS: Filters = {
  platforms: [],
  market: null,
  tier: null,
  channels: [],
  networks: [],
  campaigns: [],
  statuses: null,
};

export const DEFAULT_SELECTION: Selection = {
  ...DEFAULT_FILTERS,
  view: 'overview',
  preset: '30d',
  from: null,
  to: null,
  cmp: 'prev',
  grain: 'day',
  model: 'DDA',
  cross: null,
  o5: 'worst',
  o6: 'worst',
  dyn: null,
  theme: null,
};

export const DEFAULT_STATUSES: readonly Status[] = ['LIVE', 'LEARNING'];

/** Reset all (§5.5): the default window, comparator, filters, model and granularity; clears the cross-filter and both
 *  switches; keeps the view and the theme. */
export const resetAll = (s: Selection): Selection => ({ ...DEFAULT_SELECTION, view: s.view, theme: s.theme });
