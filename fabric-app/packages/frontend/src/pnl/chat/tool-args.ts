// Tool-argument validation (ADR-0009 §2): the model's arguments are a filter
// patch in snake_case; every value is checked against the enums and the
// reference data before it becomes a `FilterState`, and unspecified fields
// inherit the user's current filters. Hand-written, no schema library: the
// allow-lists are the same ones the DAX builders enforce a second time.
import { type ChatToolName, TOOL_VIEW } from '@rayfin-app/shared';

import { breakdownKeys, type BreakdownKey } from '../data/pnl-model-queries';
import { VERSION_SHORT, windowLabel } from '../model/filters';
import type {
  BaseVersion,
  CompareVersion,
  Currency,
  EntityCode,
  FilterState,
  FxBasis,
  OperatingEntity,
  ReferenceData,
  Selection,
  SliceSlot,
  TimeView,
  ViewKey,
} from '../model/types';
import { COMPANY_THEME } from '../theme/company';

export interface ToolArgs {
  name: ChatToolName;
  /** The validated filter state the tool runs on (and "Open in view" dispatches). */
  filter: FilterState;
  /** `get_statement`: include account-level rows. */
  detail: boolean;
  /** `explain_line` / `explain_kpi`: the thing to explain, trimmed. */
  subject: string | null;
  /** Filter fields the call changed vs the user's current filters, in words. */
  changed: string[];
  /** Caveats the model must relay (e.g. the window stops at the last close). */
  notes: string[];
  view: ViewKey;
}

export type ToolArgsResult = { ok: true; args: ToolArgs } | { ok: false; reason: string };

const ENTITIES: readonly EntityCode[] = ['P', 'S', 'G'];
const TIME_VIEWS: readonly TimeView[] = ['month', 'qtd', 'ytd', 'ltm', 'fy'];
const BASE_VERSIONS: readonly BaseVersion[] = ['ACT', 'LE', 'BUD'];
const COMPARE_VERSIONS: readonly CompareVersion[] = ['BUD', 'LE', 'PY', 'NONE'];
const CURRENCIES: readonly Currency[] = ['USD', 'EUR', 'GBP'];
const FX_BASES: readonly FxBasis[] = ['actual', 'constant'];
const BREAKDOWNS: readonly BreakdownKey[] = ['region', 'channel', 'line', 'segment', 'entity'];
const SLOTS: readonly SliceSlot[] = ['channel', 'line', 'segment'];
const FILTER_KEYS = new Set(['entity', 'fiscal_year', 'month', 'time_view', 'base_version', 'compare_a', 'compare_b', 'currency', 'fx_basis', 'regions', 'channel', 'line', 'segment']);
const EXTRA_KEYS: Record<ChatToolName, readonly string[]> = {
  get_statement: ['detail'],
  get_kpis: [],
  get_bridge: [],
  get_largest_variances: [],
  get_profitability: ['breakdown'],
  get_context: [],
  explain_line: ['name'],
  explain_kpi: ['name'],
};
const MAX_LIST = 50;
const MAX_SUBJECT = 80;

class ArgError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], what: string): T {
  if (typeof value !== 'string' || !(allowed as readonly string[]).includes(value)) {
    throw new ArgError(`${what} must be one of ${allowed.join(', ')}`);
  }
  return value as T;
}

function integer(value: unknown, what: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new ArgError(`${what} must be an integer between ${min} and ${max}`);
  return value;
}

function strings(value: unknown, what: string): string[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_LIST || !value.every((v) => typeof v === 'string')) {
    throw new ArgError(`${what} must be a non-empty list of names`);
  }
  return (value as string[]).map((v) => v.trim()).filter((v) => v.length > 0);
}

const norm = (s: string) => s.trim().toLowerCase();

/** Names or codes → codes, in the reference order; a full set collapses to "All" (null), like the pickers (F-33). */
function selection(values: string[], allowed: readonly { code: string; name: string }[], what: string): Selection {
  const wanted = new Set(values.map(norm));
  const matched = allowed.filter((a) => wanted.has(norm(a.code)) || wanted.has(norm(a.name)));
  const found = new Set(matched.flatMap((a) => [norm(a.code), norm(a.name)]));
  const unknown = values.filter((v) => !found.has(norm(v)));
  if (unknown.length > 0) throw new ArgError(`Unknown ${what}: ${unknown.join(', ')}. Known: ${allowed.map((a) => a.name).join(', ')}`);
  if (matched.length === allowed.length) return null;
  return matched.map((a) => a.code);
}

function parseArguments(argumentsJson: string): Record<string, unknown> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(argumentsJson);
  } catch {
    throw new ArgError('Arguments are not valid JSON');
  }
  if (!isRecord(parsed)) throw new ArgError('Arguments must be an object');
  return parsed;
}

export function validateToolArgs(name: ChatToolName, argumentsJson: string, current: FilterState, reference: ReferenceData): ToolArgsResult {
  try {
    const a = parseArguments(argumentsJson);
    const allowedKeys = new Set([...FILTER_KEYS, ...EXTRA_KEYS[name]]);
    const unknown = Object.keys(a).filter((k) => !allowedKeys.has(k));
    if (unknown.length > 0) throw new ArgError(`Unknown argument${unknown.length > 1 ? 's' : ''}: ${unknown.join(', ')}`);

    const changed: string[] = [];
    const notes: string[] = [];
    let filter: FilterState = { ...current };

    if (a.entity !== undefined) {
      const entity = oneOf(a.entity, ENTITIES, 'entity');
      if (entity !== filter.entity) {
        filter = { ...filter, entity };
        changed.push(entity === 'G' ? 'ACME Group' : COMPANY_THEME[entity].short);
      }
    }
    if (a.fiscal_year !== undefined) {
      const years = [...new Set(reference.months.map((m) => m.fiscalYear))];
      const fy = integer(a.fiscal_year, 'fiscal_year', 1900, 2999);
      if (!years.includes(fy)) throw new ArgError(`fiscal_year ${fy} is not in the data (${Math.min(...years)}-${Math.max(...years)})`);
      if (fy !== filter.fiscalYear) {
        filter = { ...filter, fiscalYear: fy };
        changed.push(`FY${fy}`);
      }
    }
    if (a.month !== undefined) {
      const month = integer(a.month, 'month', 1, 12);
      if (month !== filter.month) {
        filter = { ...filter, month };
        changed.push('month');
      }
    }
    if (a.time_view !== undefined) {
      const timeView = oneOf(a.time_view, TIME_VIEWS, 'time_view');
      if (timeView !== filter.timeView) {
        filter = { ...filter, timeView };
        changed.push('time view');
      }
    }
    if (a.base_version !== undefined) {
      const baseVersion = oneOf(a.base_version, BASE_VERSIONS, 'base_version');
      if (baseVersion !== filter.baseVersion) {
        filter = { ...filter, baseVersion };
        changed.push(`base ${VERSION_SHORT[baseVersion]}`);
      }
    }
    if (a.compare_a !== undefined) {
      const compareA = oneOf(a.compare_a, COMPARE_VERSIONS, 'compare_a');
      if (compareA !== filter.compareA) {
        filter = { ...filter, compareA };
        changed.push(compareA === 'NONE' ? 'no comparison A' : `vs ${VERSION_SHORT[compareA]}`);
      }
    }
    if (a.compare_b !== undefined) {
      const compareB = oneOf(a.compare_b, COMPARE_VERSIONS, 'compare_b');
      if (compareB !== filter.compareB) {
        filter = { ...filter, compareB };
        changed.push(compareB === 'NONE' ? 'no comparison B' : `vs ${VERSION_SHORT[compareB]} (B)`);
      }
    }
    if (a.currency !== undefined) {
      const currency = oneOf(a.currency, CURRENCIES, 'currency');
      if (currency !== filter.currency) {
        filter = { ...filter, currency };
        changed.push(currency);
      }
    }
    if (a.fx_basis !== undefined) {
      const fxBasis = oneOf(a.fx_basis, FX_BASES, 'fx_basis');
      if (fxBasis !== filter.fxBasis) {
        filter = { ...filter, fxBasis };
        changed.push(fxBasis === 'constant' ? 'constant currency' : 'actual rates');
      }
    }
    if (a.regions !== undefined) {
      const regions = selection(strings(a.regions, 'regions'), reference.regions, 'region');
      filter = { ...filter, regions };
      changed.push(regions === null ? 'all regions' : `${regions.length} region${regions.length === 1 ? '' : 's'}`);
    }
    const sliceArgs = SLOTS.filter((slot) => a[slot] !== undefined);
    if (sliceArgs.length > 0) {
      // F-32: slices do not apply to the consolidated view; the model is told so rather than silently ignored.
      if (filter.entity === 'G') throw new ArgError('channel, line and segment do not apply to the Group view; pick entity P or S');
      const entity: OperatingEntity = filter.entity;
      const sets = reference.slices[entity];
      let slices = { ...filter.slices[entity] };
      for (const slot of sliceArgs) {
        const picked = selection(strings(a[slot], slot), sets[slot].values, sets[slot].label.toLowerCase());
        slices = { ...slices, [slot]: picked };
        changed.push(picked === null ? `all ${sets[slot].label.toLowerCase()}` : `${picked.length} ${sets[slot].label.toLowerCase()}`);
      }
      filter = { ...filter, slices: { ...filter.slices, [entity]: slices } };
    }

    let detail = false;
    if (a.detail !== undefined) {
      if (typeof a.detail !== 'boolean') throw new ArgError('detail must be true or false');
      detail = a.detail;
    }
    if (a.breakdown !== undefined) {
      const key = oneOf(a.breakdown, BREAKDOWNS, 'breakdown');
      const keys = breakdownKeys(filter.entity);
      const index = keys.indexOf(key);
      if (index === -1) throw new ArgError(`breakdown ${key} is not available for this company; use ${keys.join(', ')}`);
      if (index !== filter.breakdown[filter.entity]) {
        filter = { ...filter, breakdown: { ...filter.breakdown, [filter.entity]: index } };
        changed.push(`by ${key}`);
      }
    }
    let subject: string | null = null;
    if (name === 'explain_line' || name === 'explain_kpi') {
      const raw = a.name;
      if (typeof raw !== 'string' || raw.trim().length === 0 || raw.length > MAX_SUBJECT) throw new ArgError('name must be a short name or code');
      subject = raw.trim();
    }

    // C-01: under Actual the window stops at the last closed month; say so instead of refusing.
    const selectedKey = `${filter.fiscalYear}-${String(filter.month).padStart(2, '0')}`;
    if (filter.baseVersion === 'ACT' && selectedKey > reference.lastClosed.key) {
      notes.push(`Actuals are closed through ${reference.lastClosed.monthName} ${reference.lastClosed.fiscalYear}; the window stops there. Use base_version LE for the full window.`);
    }
    return { ok: true, args: { name, filter, detail, subject, changed, notes, view: TOOL_VIEW[name] } };
  } catch (err) {
    if (err instanceof ArgError) return { ok: false, reason: err.message };
    throw err;
  }
}

/** "Commerce Cloud - Q3 2026 - Actual vs Budget, Prior year - USD": the card title and the LLM's filter echo. */
export function filterSummary(filter: FilterState): string {
  const company = filter.entity === 'G' ? 'ACME Group' : COMPANY_THEME[filter.entity].short;
  const compares = [filter.compareA, filter.compareB].filter((c): c is Exclude<CompareVersion, 'NONE'> => c !== 'NONE').map((c) => VERSION_SHORT[c]);
  const versions = compares.length === 0 ? `${VERSION_SHORT[filter.baseVersion]} only` : `${VERSION_SHORT[filter.baseVersion]} vs ${compares.join(', ')}`;
  return [company, windowLabel(filter), versions, `${filter.currency}${filter.fxBasis === 'constant' ? ' constant currency' : ''}`].join(' - ');
}
