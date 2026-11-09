import type { WorkType } from '../data/manifest.ts';

// The validated state (contract §3.1, §6): every input the engine receives. url-state.ts parses it from the URL with
// Zod; components never read `location`.

export type PlanType = 'Month' | 'Week';
export type Calculation = 'Weighted' | 'Linear';

export interface Selection {
  /** week_ix, or null = all weeks (the Week filter is one week or all). */
  week: number | null;
  /** office_name picks; [] = all. */
  offices: string[];
  /** loader_name picks; [] = all. */
  loaders: string[];
  /** Keeps ≥ 1 pick (§3.1); manifest order. */
  workTypes: WorkType[];
  planType: PlanType;
  calculation: Calculation;
}

export const DEFAULT_WORK_TYPES: readonly WorkType[] = ['On spot', 'Trucks'];

/** The Reset state (`bm_reset`, §3.7 (9)); the page also opens on it. */
export const RESET_SELECTION: Selection = {
  week: null,
  offices: [],
  loaders: [],
  workTypes: [...DEFAULT_WORK_TYPES],
  planType: 'Month',
  calculation: 'Weighted',
};
