// Tool runner (ADR-0009 §2): validates a tool call, reads the zone it needs
// through the views' own cached loaders (as the signed-in user, through
// `pnlModel`), maps the zone with the views' own mappers and returns a compact,
// capped JSON for the model plus what the result card shows. Every number the
// assistant can quote comes through here; nothing else reaches the LLM.
import { CHAT_BOUNDS, type ChatToolName, TOOL_LABEL, TOOL_ROW_CAPS } from '@rayfin-app/shared';

import { assembleFigures, type ZoneReader, type ZoneResult } from '../data/data-source';
import { filterRows, noticeRows, refreshedText, statusLine } from '../model/applied-filters';
import { periodSummary } from '../model/period';
import type { Figures, FilterState, ReferenceData, StatementRow, ViewKey, VitalsCard, ZoneKey } from '../model/types';
import { filterSummary, type ToolArgs, validateToolArgs } from './tool-args';

export interface ToolRunResult {
  name: ChatToolName;
  label: string;
  /** The filter state the tool ran on; null when the arguments were rejected. */
  filter: FilterState | null;
  view: ViewKey;
  /** Card title: the filters in words. */
  summary: string;
  /** What the card says under the title ("31 rows", "rejected: …"). */
  detail: string;
  /** The JSON text sent back to the model, ≤ CHAT_BOUNDS.maxToolResultChars. */
  text: string;
  error: string | null;
}

export interface ToolRunContext {
  reader: ZoneReader;
  reference: ReferenceData;
  /** The user's current filters: unspecified arguments inherit them. */
  current: FilterState;
}

const ZONES_FOR: Record<ChatToolName, readonly ZoneKey[]> = {
  get_statement: ['statement'],
  get_kpis: ['vitals'],
  get_bridge: ['bridge'],
  get_largest_variances: ['variances'],
  get_profitability: ['profitability'],
  get_context: ['context'],
  explain_line: ['statement'],
  explain_kpi: ['vitals', 'vitalsInfo'],
};

const round1 = (v: number | null): number | null => (v === null ? null : Math.round(v * 10) / 10);

/** Dropped rows are counted so the model knows the list is partial. */
interface Payload {
  tool: ChatToolName;
  filters: string;
  notes?: string[];
  [key: string]: unknown;
}

function errorText(reason: string): string {
  return JSON.stringify({ error: reason });
}

/** Serialise within the budget: drop rows from `rowsKey` until it fits, and say so. */
export function fitPayload(payload: Payload, rowsKey: string | null): string {
  let text = JSON.stringify(payload);
  if (text.length <= CHAT_BOUNDS.maxToolResultChars || rowsKey === null || !Array.isArray(payload[rowsKey])) {
    return text.length <= CHAT_BOUNDS.maxToolResultChars ? text : text.slice(0, CHAT_BOUNDS.maxToolResultChars);
  }
  const rows = payload[rowsKey] as unknown[];
  let keep = rows.length;
  while (keep > 0 && text.length > CHAT_BOUNDS.maxToolResultChars) {
    keep -= 1;
    text = JSON.stringify({ ...payload, [rowsKey]: rows.slice(0, keep), truncated: rows.length - keep });
  }
  return text;
}

function statementPayload(rows: StatementRow[], args: ToolArgs, filters: string): { payload: Payload; rowsKey: string; count: number } {
  const cap = args.detail ? TOOL_ROW_CAPS.get_statement.detail : TOOL_ROW_CAPS.get_statement.lines;
  const chosen = (args.detail ? rows : rows.filter((r) => r.kind !== 'leaf')).slice(0, cap);
  const f = args.filter;
  const columns = ['base', ...(f.compareA !== 'NONE' ? ['cmpA', 'dA', 'dApct'] : []), ...(f.compareB !== 'NONE' ? ['cmpB', 'dB', 'dBpct'] : []), 'fyBud', 'fyLe'];
  return {
    payload: {
      tool: 'get_statement',
      filters,
      units: `${f.currency} millions; ratio rows in %, their deltas in pp`,
      columns: { base: 'Base', cmpA: 'Compare A', dA: 'Δ vs A', dApct: 'Δ % vs A', cmpB: 'Compare B', dB: 'Δ vs B', dBpct: 'Δ % vs B', fyBud: 'Full-year budget', fyLe: 'Full-year latest estimate' },
      rows: chosen.map((r) => ({
        code: r.code,
        label: r.label,
        kind: r.kind,
        ...(r.tags.length > 0 ? { tags: r.tags } : {}),
        ...Object.fromEntries(columns.map((c) => [c, round1(r.values[c as keyof StatementRow['values']])])),
      })),
    },
    rowsKey: 'rows',
    count: chosen.length,
  };
}

/** Every Vitals card, results first (the view's own order). */
function vitalsCards(figures: Figures): VitalsCard[] {
  return [...figures.vitals.results, ...figures.vitals.drivers];
}

function kpiPayload(figures: Figures, filters: string): { payload: Payload; rowsKey: string; count: number } {
  const cards = vitalsCards(figures).slice(0, TOOL_ROW_CAPS.get_kpis);
  return {
    payload: {
      tool: 'get_kpis',
      filters,
      kpis: cards.map((c) => ({
        code: c.code,
        label: c.label,
        value: c.value,
        ...(c.status ? { status: `${c.status.text} vs Budget` } : {}),
        ...(c.rows.length > 0 ? { changes: c.rows.map((r) => `${r.name}: ${[r.abs, r.rel].filter((t) => t).join(' ')}`) } : {}),
      })),
    },
    rowsKey: 'kpis',
    count: cards.length,
  };
}

function lineOf(rows: StatementRow[], subject: string): StatementRow | undefined {
  const s = subject.trim().toLowerCase();
  const plain = (t: string) => t.toLowerCase().replace(/^\d+\.\s*/, '');
  return rows.find((r) => r.code.toLowerCase() === s) ?? rows.find((r) => plain(r.label) === s) ?? rows.find((r) => plain(r.label).includes(s));
}

const TAG_MEANING: Record<string, string> = {
  'IFRS 18': 'required IFRS 18 subtotal',
  MPM: 'management-defined performance measure',
  Mgmt: 'management subtotal',
  IC: 'intercompany',
};

export async function runTool(call: { name: ChatToolName; argumentsJson: string }, ctx: ToolRunContext): Promise<ToolRunResult> {
  const label = TOOL_LABEL[call.name];
  const validated = validateToolArgs(call.name, call.argumentsJson, ctx.current, ctx.reference);
  if (!validated.ok) {
    return { name: call.name, label, filter: null, view: 'pnl', summary: 'Rejected', detail: validated.reason, text: errorText(validated.reason), error: validated.reason };
  }
  const args = validated.args;
  const filters = filterSummary(args.filter);
  const base = { name: call.name, label, filter: args.filter, view: args.view, summary: filters };

  const settled: Partial<Record<ZoneKey, { status: 'ok'; result: ZoneResult } | { status: 'error'; reason: string }>> = {};
  await Promise.all(
    ZONES_FOR[call.name].map(async (zone) => {
      try {
        settled[zone] = { status: 'ok', result: await ctx.reader.loadZone(zone, args.filter, ctx.reference) };
      } catch (err) {
        settled[zone] = { status: 'error', reason: err instanceof Error ? err.message : String(err) };
      }
    })
  );
  const figures = assembleFigures(settled, args.filter, ctx.reference);
  // The ⓘ sub-metrics zone is optional for explain_kpi: a failure there drops the line, not the answer.
  const failed = ZONES_FOR[call.name].filter((z) => z !== 'vitalsInfo').map((z) => figures.zones[z]).find((s) => s.kind === 'error');
  if (failed && failed.kind === 'error') {
    const reason = `The model could not answer: ${failed.reason}`;
    return { ...base, detail: reason, text: errorText(reason), error: reason };
  }
  const notes = args.notes.length > 0 ? { notes: args.notes } : {};

  switch (call.name) {
    case 'get_statement': {
      const { payload, rowsKey, count } = statementPayload(figures.statement, args, filters);
      return { ...base, detail: `${count} rows`, text: fitPayload({ ...payload, ...notes }, rowsKey), error: null };
    }
    case 'get_kpis': {
      const { payload, rowsKey, count } = kpiPayload(figures, filters);
      return { ...base, detail: `${count} vitals`, text: fitPayload({ ...payload, ...notes }, rowsKey), error: null };
    }
    case 'get_bridge': {
      const steps = figures.bridge.steps
        .slice(0, TOOL_ROW_CAPS.get_bridge)
        .map((s) => ({ step: s.label, value: s.valueText, kind: s.kind === 'fav' ? 'favourable' : s.kind === 'unf' ? 'unfavourable' : s.kind === 'fx' ? 'FX translation' : s.kind === 'subtotal' ? 'constant-currency subtotal' : 'total' }));
      const payload: Payload = { tool: 'get_bridge', filters, method: figures.bridge.subtitle, units: `${args.filter.currency} ${args.filter.units === 'm' ? 'millions' : 'thousands'}`, steps, ...notes };
      return { ...base, detail: `${steps.length} steps`, text: fitPayload(payload, 'steps'), error: null };
    }
    case 'get_largest_variances': {
      const rows = figures.drivers.slice(0, TOOL_ROW_CAPS.get_largest_variances).map((d) => ({ line: d.name, block: d.block, delta: d.deltaText, deltaPct: d.deltaPctText, effect: d.tone === 'fav' ? 'favourable' : d.tone === 'unf' ? 'unfavourable' : 'neutral' }));
      const payload: Payload = { tool: 'get_largest_variances', filters, units: `${args.filter.currency} ${args.filter.units === 'm' ? 'millions' : 'thousands'}`, rows, ...notes };
      return { ...base, detail: `${rows.length} lines`, text: fitPayload(payload, 'rows'), error: null };
    }
    case 'get_profitability': {
      const p = figures.profitability;
      const rows = p.rows.slice(0, TOOL_ROW_CAPS.get_profitability).map((r) => ({ [p.by]: r.name, netRevenue: r.nrText, [`vs ${p.compareLabel} %`]: r.nrDeltaText, grossMargin: r.gm, contributionMargin: r.cm, contributionMarginDeltaPp: r.cmDeltaText, contribution: r.contributionText, adjEbitda: r.ebitdaText }));
      const payload: Payload = { tool: 'get_profitability', filters, by: p.column, basis: p.subtitle, units: `${args.filter.currency} ${args.filter.units === 'm' ? 'millions' : 'thousands'}`, rows, ...notes };
      return { ...base, detail: `${rows.length} ${p.by === 'company' ? 'companies' : `${p.by}s`}`, text: fitPayload(payload, 'rows'), error: null };
    }
    case 'get_context': {
      const payload: Payload = {
        tool: 'get_context',
        filters,
        status: statusLine(args.filter, ctx.reference, refreshedText(figures.refreshedAt)),
        window: periodSummary(args.filter, ctx.reference),
        appliedFilters: Object.fromEntries(filterRows(args.filter, ctx.reference).map((r) => [r.label, r.value])),
        notices: noticeRows(figures.notices).map((r) => `${r.label}: ${r.value}`),
        ...notes,
      };
      return { ...base, detail: `${figures.notices.length} notice${figures.notices.length === 1 ? '' : 's'}`, text: fitPayload(payload, 'notices'), error: null };
    }
    case 'explain_line': {
      const row = lineOf(figures.statement, args.subject ?? '');
      if (!row) {
        const reason = `No line "${args.subject ?? ''}". Lines: ${figures.statement
          .filter((r) => r.kind !== 'leaf')
          .map((r) => r.label)
          .slice(0, TOOL_ROW_CAPS.get_statement.lines)
          .join('; ')}`;
        return { ...base, detail: reason, text: errorText(reason), error: reason };
      }
      const parent = row.parent === null ? null : (figures.statement.find((r) => r.code === row.parent)?.label ?? row.parent);
      const children = figures.statement.filter((r) => r.parent === row.code).map((r) => r.label).slice(0, 20);
      const payload: Payload = {
        tool: 'explain_line',
        filters,
        code: row.code,
        label: row.label,
        level: row.kind,
        tags: row.tags.map((t) => `${t} = ${TAG_MEANING[t] ?? t}`),
        parent,
        children,
        ...(row.kind === 'ratio' ? { note: 'A ratio row: values in %, changes in percentage points.' } : {}),
      };
      return { ...base, summary: row.label, detail: parent ? `in ${parent}` : row.kind, text: fitPayload(payload, 'children'), error: null };
    }
    case 'explain_kpi': {
      const s = (args.subject ?? '').trim().toLowerCase();
      const cards = vitalsCards(figures);
      const card = cards.find((c) => c.code.toLowerCase() === s || c.label.toLowerCase() === s) ?? cards.find((c) => c.label.toLowerCase().includes(s));
      if (!card) {
        const reason = `No vital "${args.subject ?? ''}". Vitals: ${cards.map((c) => `${c.label} (${c.code})`).join('; ')}`;
        return { ...base, detail: reason, text: errorText(reason), error: reason };
      }
      const subMetrics = figures.vitalsInfo[card.code];
      const payload: Payload = {
        tool: 'explain_kpi',
        filters,
        code: card.code,
        label: card.label,
        definition: card.info.what || 'No definition published for this vital.',
        ...(card.info.formula ? { formula: card.info.formula } : {}),
        ...(subMetrics ? { subMetrics } : {}),
      };
      return { ...base, summary: card.label, detail: card.info.what, text: fitPayload(payload, null), error: null };
    }
  }
}
