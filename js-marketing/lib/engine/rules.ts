import type { Dataset } from './data.ts';
import { installQuality, metrics } from './metrics.ts';
import type { Metrics } from './metrics.ts';
import type { ModelCode } from '../data/manifest.ts';
import { MODEL_KEY } from './data.ts';

// Verdicts, flags, alerts (contract §3.7; data README › Verdicts / Flags / Alerts). Every threshold comes from
// param_target through ds.param (A-75: none is hard-coded here). Verdicts never follow the comparator (AT-12).

export type Verdict = 1 | 2 | 3;

export const FLAG_CODES = [
  'FATIGUE',
  'FREQUENCY',
  'INSTALL_QUALITY',
  'VIEW_THROUGH',
  'CPA_OVER',
  'OVER_PACING',
  'UNDERSPENT',
  'LEARNING',
  'PIPELINE_LED',
  'LEAD_GOAL',
  'NO_CPA_GOAL',
  'ON_TARGET',
] as const;
export type FlagCode = (typeof FLAG_CODES)[number];

/** Metric → [param_target code, direction, scaled by days ÷ 30]; the verdict.<metric> control rows (ALL). */
export const VERDICTS = {
  paid_customers: ['PAID_CUSTOMERS_30D', 'UP', true],
  blended_cac: ['BLENDED_CAC', 'DOWN', false],
  payback_months: ['PAYBACK_MONTHS', 'DOWN', false],
  ltv_cac: ['LTV_CAC', 'UP', false],
  trial_to_paid: ['TRIAL_TO_PAID', 'UP', false],
  d7_retention: ['D7_RETENTION', 'UP', false],
  d30_retention: ['D30_RETENTION', 'UP', false],
  refund_rate: ['REFUND_RATE', 'DOWN', false],
  brand_share: ['BRAND_SHARE', 'DOWN', false],
  attribution_gap: ['ATTR_GAP', 'DOWN', false],
} as const;
export type VerdictMetric = keyof typeof VERDICTS | 'pacing';

/** Healthy-range verdict: 1 OK · 2 WARN · 3 CRIT. */
export function verdict(ds: Dataset, metric: VerdictMetric, v: number, days: number): Verdict {
  const w = ds.param('WARN_BAND_REL');
  if (metric === 'pacing') {
    if (Math.abs(v - 1) <= ds.param('SPEND_PLAN_TOL')) return 1;
    return v > ds.param('PACING_HI') || v < ds.param('PACING_LO') ? 3 : 2;
  }
  const [code, dir, scaled] = VERDICTS[metric];
  const t = ds.param(code) * (scaled ? days / 30 : 1);
  if (dir === 'UP') return v >= t ? 1 : v >= t * (1 - w) ? 2 : 3;
  return v <= t ? 1 : v <= t * (1 + w) ? 2 : 3;
}

export interface FlagInput {
  /** window metrics of the campaign or channel (rich, so frequency / slope exist at ≥ 14 days) */
  r: Metrics;
  cs: readonly number[];
  single: number | null;
  /** install-quality delta of an INSTALL campaign */
  iq: number | undefined;
  model?: ModelCode;
}

/** A-24 flag set of a campaign (single) or a channel scope; exclusive gates first, root causes suppress CPA over. */
export function flags(ds: Dataset, { r, cs, single, iq, model = 'DDA' }: FlagInput): Record<FlagCode, 0 | 1> {
  const f = Object.fromEntries(FLAG_CODES.map((k) => [k, 0])) as Record<FlagCode, 0 | 1>;
  let gate: FlagCode | null = null;
  let tgt: number | null | undefined;
  if (single !== null) {
    const c = ds.campaigns[single];
    const o = c?.objective_code;
    gate =
      o === 'PIPELINE'
        ? 'PIPELINE_LED'
        : o === 'LEAD'
          ? 'LEAD_GOAL'
          : o === 'RETENTION'
            ? 'NO_CPA_GOAL'
            : c?.status_code === 'LEARNING'
              ? 'LEARNING'
              : null;
    tgt = c?.cpa_target_usd;
  } else {
    const spending = cs.filter((c) => totalSpend(ds, c) > 0);
    gate = cs.length > 0 && spending.every((c) => ds.campaigns[c]?.status_code === 'LEARNING') ? 'LEARNING' : null;
    const first = cs[0];
    tgt = first === undefined ? undefined : ds.channelTarget(ds.campaigns[first]?.channel_code ?? '', 'CPA');
  }
  if (gate) {
    f[gate] = 1;
    return f;
  }
  const P = (k: string) => ds.param(k);
  const slope = r.ctr_slope_7d ?? 0;
  const freq = r.frequency_7d ?? 0;
  const fat = slope < P('FATIGUE_SLOPE') && freq > P('FATIGUE_FREQ');
  const frq = freq > P('FREQ_HIGH');
  const iqf =
    single !== null &&
    ds.campaigns[single]?.objective_code === 'INSTALL' &&
    iq !== undefined &&
    iq < P('INSTALL_QUALITY_PT');
  const vt = (r.attribution_gap ?? 0) + 1 > P('VIEW_THROUGH_RATIO');
  const cpa = r[`cpa.${MODEL_KEY[model]}`] ?? 0;
  const cpaOver = !(fat || frq || iqf || vt) && tgt !== null && tgt !== undefined && cpa > tgt * P('CPA_OVER_TOL');
  const pacing = r.pacing ?? 1;
  const set: [FlagCode, boolean][] = [
    ['FATIGUE', fat],
    ['FREQUENCY', frq],
    ['INSTALL_QUALITY', iqf],
    ['VIEW_THROUGH', vt],
    ['CPA_OVER', cpaOver],
    ['OVER_PACING', pacing > P('PACING_HI')],
    ['UNDERSPENT', pacing < P('PACING_LO')],
  ];
  for (const [k, v] of set) f[k] = v ? 1 : 0;
  if (!set.some(([, v]) => v)) f.ON_TARGET = 1;
  return f;
}

const spendCache = new WeakMap<Dataset, Float64Array>();
/** Σ spend of a campaign over every actual day (the "spends in it" test of the channel Learning gate). */
function totalSpend(ds: Dataset, c: number): number {
  let t = spendCache.get(ds);
  if (!t) {
    t = new Float64Array(ds.NC);
    for (let i = 0; i < ds.NC; i++) {
      let x = 0;
      for (let d = 0; d < ds.ND; d++) x += ds.cd.spend_usd[i * ds.ND + d] ?? 0;
      t[i] = x;
    }
    spendCache.set(ds, t);
  }
  return t[c] ?? 0;
}

/** Codes of the set flags, in FLAG_CODES order (the Flag Codes order of the PBIP). */
export const flagList = (f: Record<FlagCode, 0 | 1>): FlagCode[] => FLAG_CODES.filter((k) => f[k] === 1);

/** Campaign flags for a window (P1 rows, the O5 alert column's sources). */
export function campaignFlags(ds: Dataset, c: number, a: number, b: number, model: ModelCode = 'DDA') {
  const r = metrics(ds, [c], a, b, { single: c, model });
  const iq = ds.campaigns[c]?.objective_code === 'INSTALL' ? installQuality(ds, [c], a, b) : undefined;
  return { r, iq, flags: flags(ds, { r, cs: [c], single: c, iq, model }) };
}

/** Pacing colour of C1 / P1 cells: 3 CRIT above PACING_HI, 2 WARN below PACING_LO, 0 neutral. */
export const pacingColour = (ds: Dataset, pacing: number | undefined): 0 | 2 | 3 =>
  pacing === undefined ? 0 : pacing > ds.param('PACING_HI') ? 3 : pacing < ds.param('PACING_LO') ? 2 : 0;

/** Severity order of param_alert_rule (most severe first). */
export const SEVERITY_ORDER = { CRIT: 0, WARN: 1, INFO: 2, OK: 3 } as const;

/** Campaign-scope alert rules that trip for campaign c on days a … b (O5 alert column), most severe first. */
export function campaignAlerts(ds: Dataset, c: number, a: number, b: number, model: ModelCode = 'DDA') {
  const r = metrics(ds, [c], a, b, { single: c, model });
  const out: { rule: string; value: number }[] = [];
  const slope = r.ctr_slope_7d;
  if (
    r.spend > 0 &&
    (slope ?? 0) < ds.param('FATIGUE_SLOPE') &&
    (r.frequency_7d ?? 0) > ds.param('FATIGUE_FREQ') &&
    slope !== undefined
  )
    out.push({ rule: 'FATIGUE', value: slope });
  if (ds.campaigns[c]?.objective_code === 'INSTALL') {
    const iq = installQuality(ds, [c], a, b);
    if (iq !== undefined && iq < ds.param('INSTALL_QUALITY_PT')) out.push({ rule: 'INSTALL_QUALITY', value: iq });
  }
  const rules = ds.m.alert_rules;
  const rank = (code: string) => {
    const x = rules.find((q) => q.rule_code === code);
    return x ? SEVERITY_ORDER[x.severity] * 100 + x.sort_order : 999;
  };
  return out.sort((x, y) => rank(x.rule) - rank(y.rule));
}

/** Freshness (A-17, AT-15): per-source age in hours, the dot and the hourly-source age for "Synced n h ago". */
export function freshness(ds: Dataset) {
  const ref = Date.parse(`${ds.m.meta.refreshed}:00Z`);
  const ages = ds.m.sync_log.map((x) => ({
    source: x,
    hours: (ref - Date.parse(`${x.last_sync_ts}:00Z`)) / 3_600_000,
  }));
  const red = ages.some((x) => x.hours >= x.source.red_after_h);
  const amber = ages.some((x) => x.hours >= x.source.stale_after_h);
  const hourly = ages.filter((x) => x.source.cadence === 'HOURLY').map((x) => x.hours);
  return {
    ages,
    dot: (red ? 3 : amber ? 2 : 1) as 1 | 2 | 3,
    stale: red,
    syncedHours: hourly.length > 0 ? Math.max(...hourly) : 0,
  };
}
