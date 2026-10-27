import { z } from 'zod';
import type { Manifest } from '../data/manifest.ts';
import { formatAmount, formatPercent, formatPoints } from '../engine/format.ts';
import type { Units } from '../engine/format.ts';
import { hideEmptyLines } from '../engine/hide-empty.ts';
import type { Engine } from '../engine/index.ts';
import { BASE_LABEL, COMPARE_LABEL } from '../engine/notices.ts';
import type { NoticeCode } from '../engine/notices.ts';
import { isMonthNumber } from '../engine/period.ts';
import { buildSpine, lineDisplay } from '../engine/spine.ts';
import type {
  BaseChoice,
  CompareChoice,
  EntityCode,
  EntityView,
  ReportingCurrency,
  Selection,
  StatementRow,
  TimeView,
  Variance,
} from '../engine/types.ts';
import { createSelectionCodec, restrictToBuilt } from '../state/selection-schema.ts';
import { CHAT_LIMITS } from './limits.ts';

// Track C chat tools (ADR-0009 §1, §4): the closed tool set the LLM may call. Every number in a result comes from the
// engine, display-rounded by format.ts (D-30), so the chat shows the numbers the statement shows. Arguments are a
// patch over the visitor's current selection: what the question does not mention stays as the visitor set it. A
// patch is checked strictly (unknown keys, codes and values are rejected, never replaced by defaults), then
// normalised through the URL codec (F-37), so a tool runs only on selections a shareable link can hold.
// Schemas and results are kept short on purpose: the LLM is a small CPU model where every prompt token costs time
// (.sync/2026-10-23-track-c-chat-backend.md §1.3). Codes are checked here against the manifest instead of being
// listed as JSON-Schema enums. Framework-free: no React, no network.

export const TOOL_NAMES = [
  'get_statement',
  'explain_line',
  'get_kpis',
  'get_bridge',
  'get_largest_variances',
  'get_profitability',
] as const;
export type ToolName = (typeof TOOL_NAMES)[number];
const isToolName = (name: string): name is ToolName => (TOOL_NAMES as readonly string[]).includes(name);

/** OpenAI-compatible chat-completions tool definition; `parameters` is JSON Schema (draft-07). */
export interface ToolDefinition {
  type: 'function';
  function: { name: ToolName; description: string; parameters: Record<string, unknown> };
}

export interface ToolError {
  tool: string;
  error: 'invalid arguments' | 'not built yet' | 'unknown tool' | 'tool-call limit reached' | 'tool failed';
  detail: string;
}

/** What every data result carries: the period summary sentence (F-02 … F-04) and the C-50 notice codes + text. */
interface Envelope {
  period: string;
  notices: { code: NoticeCode; text: string }[];
}

export interface StatementToolResult extends Envelope {
  tool: 'get_statement';
  company: string;
  versions: string; // "Actual vs Budget (A) and Prior year (B)"
  units: string; // "USD m - actual rates"
  columns: string[];
  rows: string[][];
  /** Rows dropped by the row and size caps; 0 = complete. */
  omittedRows: number;
}

type ExplainLine = {
  kind: 'input_block' | 'subtotal' | 'ratio' | 'group_total' | 'memo';
  alias: string | null; // L-11: the selected company's own name for the line
  formula: string | null;
  partOf: string | null;
  tag: string | null;
  ifrs18Category: string | null;
  accounts: { code: string; name: string }[];
};
type ExplainAccount = {
  kind: 'account';
  company: string;
  definition: string;
  publishedComparable: string;
  ifrs18Category: string;
  intercompany: boolean;
};
export type ExplainLineResult = Envelope & {
  tool: 'explain_line';
  code: string;
  name: string;
  /** The numbered statement row: the line itself, or the line an account sits under. */
  statementLine: string;
} & (ExplainLine | ExplainAccount);

export type ToolResult = StatementToolResult | ExplainLineResult | ToolError;

export type ValidCall =
  | {
      tool: 'get_statement';
      selection: Selection;
      detail: 'lines' | 'accounts';
      lines: readonly string[] | null;
      /** Canonical query string of the statement view for these arguments (F-37), for an "Open in view" link. */
      query: string;
    }
  | { tool: 'explain_line'; code: string };

export type CheckedCall = { ok: true; call: ValidCall } | { ok: false; result: ToolError };

export interface ChatTools {
  definitions: readonly ToolDefinition[];
  /** Parses and validates one tool call against the visitor's current selection. */
  check(name: string, rawArguments: string, current: Selection): CheckedCall;
  /** Runs a validated call. The engine's dataset must hold `entityOf(call)`. */
  run(call: ValidCall, engine: Engine, current: Selection): ToolResult;
}

/** The company whose data file a call needs; null = reference data only. */
export function entityOf(call: ValidCall): EntityCode | null {
  if (call.tool !== 'get_statement') return null;
  const e = call.selection.entity;
  return e === 'GROUP' ? null : e; // the Group view is not built (restrictToBuilt), so it never reaches run()
}

const ENTITIES = ['P', 'S', 'GROUP'] as const satisfies readonly EntityView[];
const TIME_VIEWS = ['MTD', 'QTD', 'YTD', 'LTM', 'FY'] as const satisfies readonly TimeView[];
const BASES = ['A', 'LE', 'B'] as const satisfies readonly BaseChoice[];
const COMPARES = ['B', 'LE', 'PY', 'NONE'] as const satisfies readonly CompareChoice[];
const CURRENCIES = ['USD', 'EUR', 'GBP'] as const satisfies readonly ReportingCurrency[];
const SLICES = ['channel', 'line', 'segment'] as const;

const NOT_BUILT: Record<Exclude<ToolName, 'get_statement' | 'explain_line'>, string> = {
  get_kpis: 'The key figures view is not built in this report yet.',
  get_bridge: 'The net revenue bridge is not built in this report yet.',
  get_largest_variances: 'The largest variances list is not built in this report yet.',
  get_profitability: 'The profitability view is not built in this report yet.',
};
const isNotBuilt = (name: ToolName): name is keyof typeof NOT_BUILT => name in NOT_BUILT;

const DESCRIPTION: Record<ToolName, string> = {
  get_statement:
    'P&L statement of the current view; arguments change it. Default rows: the subtotals. Δ = base − comparison.',
  explain_line: 'Meaning of a report line or account: formula, definition, accounts.',
  get_kpis: 'Key figures. Not built yet.',
  get_bridge: 'Net revenue bridge. Not built yet.',
  get_largest_variances: 'Largest variances. Not built yet.',
  get_profitability: 'Profitability by slice. Not built yet.',
};

const error = (tool: string, kind: ToolError['error'], detail: string): ToolError => ({ tool, error: kind, detail });

/** Drops trailing items until the result fits the size cap (CHAT_LIMITS.maxResultChars); returns how many went. */
function fit<T>(result: unknown, items: T[]): number {
  let dropped = 0;
  while (items.length > 0 && JSON.stringify(result).length > CHAT_LIMITS.maxResultChars) {
    items.pop();
    dropped++;
  }
  return dropped;
}

export function createChatTools(m: Manifest): ChatTools {
  const t = m.tables;
  const codec = createSelectionCodec(m);
  const years = t.dim_month.map((d) => d.fiscal_year);
  const company = (e: EntityView) =>
    e === 'GROUP'
      ? `${t.dim_entity[0]?.consolidation_group ?? 'Group'} (consolidated)`
      : (t.dim_entity.find((r) => r.entity_code === e)?.short_name ?? e);
  const sliceRows = {
    channel: t.dim_channel.map((r) => ({ code: r.channel_code, entity: r.entity_code, unassigned: r.is_unassigned })),
    line: t.dim_line.map((r) => ({ code: r.line_code, entity: r.entity_code, unassigned: r.is_unassigned })),
    segment: t.dim_segment.map((r) => ({ code: r.segment_code, entity: r.entity_code, unassigned: r.is_unassigned })),
  };
  const regionCodes = new Set(t.dim_region.map((r) => r.region_code));
  const lines = [...t.dim_report_line].sort((a, b) => a.sort_order - b.sort_order);
  const lineCodes = new Set(lines.map((l) => l.line_code));
  const accountCodes = new Set(t.dim_account.map((a) => a.account_code));

  const code = z.string().min(1).max(20);
  const codes = z.array(code).min(1).max(CHAT_LIMITS.maxRows);
  const patch = {
    entity: z
      .enum(ENTITIES)
      .optional()
      .describe(ENTITIES.map((e) => `${e} ${company(e)}`).join(', ')),
    fy: z
      .number()
      .int()
      .min(Math.min(...years))
      .max(Math.max(...years))
      .optional(),
    month: z.number().int().min(1).max(12).optional().describe('Window end month'),
    timeView: z.enum(TIME_VIEWS).optional(),
    base: z.enum(BASES).optional().describe('A Actual, LE Latest estimate, B Budget'),
    compareA: z.enum(COMPARES).optional().describe('PY Prior year'),
    compareB: z.enum(COMPARES).optional(),
    region: codes.optional(),
    channel: codes.optional(),
    line: codes.optional(),
    segment: codes.optional(),
    currency: z.enum(CURRENCIES).optional(),
    fxBasis: z.enum(['ACT', 'CC']).optional().describe('CC constant currency'),
    units: z.enum(['M', 'K']).optional(),
  };
  const statementArgs = z
    .object({
      ...patch,
      lines: codes.optional().describe('Line codes, e.g. NR, OPEX, GM_PCT'),
      detail: z.enum(['lines', 'accounts']).optional().describe('accounts: add the accounts under the lines'),
    })
    .strict();
  const explainArgs = z.object({ code: code.describe('Line or account code') }).strict();
  const noArgs = z.object({}).strict();

  const SCHEMAS = {
    get_statement: statementArgs,
    explain_line: explainArgs,
    get_kpis: noArgs,
    get_bridge: noArgs,
    get_largest_variances: noArgs,
    get_profitability: noArgs,
  } as const satisfies Record<ToolName, z.ZodType>;

  const definitions: ToolDefinition[] = TOOL_NAMES.map((name) => ({
    type: 'function',
    function: { name, description: DESCRIPTION[name], parameters: jsonSchema(SCHEMAS[name]) },
  }));

  type Patch = Omit<z.infer<typeof statementArgs>, 'lines' | 'detail'>;

  /** Merge a patch into the current selection and check it like the period picker and the URL codec would. */
  function toSelection(p: Patch, current: Selection): Selection | string[] {
    const { month: askedMonth, ...rest } = p;
    const month = askedMonth === undefined ? current.month : isMonthNumber(askedMonth) ? askedMonth : null;
    if (month === null) return [`month: ${askedMonth} is not a month number`]; // the schema bounds it to 1–12
    const entityChanged = p.entity !== undefined && p.entity !== current.entity;
    // F-30: slice choices belong to a company; a company switch does not carry the old company's codes over
    const merged: Selection = {
      ...current,
      ...(entityChanged ? { channel: [], line: [], segment: [] } : {}),
      ...rest,
      month,
    };
    const issues: string[] = [];

    const unknownRegions = merged.region.filter((c) => !regionCodes.has(c));
    if (unknownRegions.length) issues.push(`region: unknown code ${unknownRegions.join(', ')}`);
    for (const field of SLICES) {
      const chosen = merged[field];
      if (chosen.length === 0) continue;
      const rows = sliceRows[field].filter((r) => chosen.includes(r.code) && !r.unassigned);
      const unknown = chosen.filter((c) => !rows.some((r) => r.code === c));
      if (unknown.length) issues.push(`${field}: unknown code ${unknown.join(', ')}`);
      else if (merged.entity === 'GROUP')
        issues.push(`${field}: channel, category and segment do not apply in the consolidated Group view`); // F-32
      else {
        const foreign = rows.filter((r) => r.entity !== merged.entity);
        if (foreign[0])
          issues.push(
            `${field}: ${foreign.map((r) => r.code).join(', ')} belong to ${company(foreign[0].entity)}, ` +
              `not ${company(merged.entity)}`,
          );
      }
    }

    // C-01: an Actual base covers closed months only, so the period picker offers no open month under it
    if (merged.base === 'A' && merged.timeView !== 'FY') {
      const end = t.dim_month.find((d) => d.fiscal_year === merged.fy && d.month_number === merged.month);
      const closed = t.dim_month.filter((d) => d.is_closed);
      const last = closed[closed.length - 1];
      if (end && !end.is_closed)
        issues.push(
          `month: ${end.month_name} ${end.fiscal_year} is not closed; Actual covers months through ` +
            `${last ? `${last.month_name} ${last.fiscal_year}` : 'no closed month yet'}. Pick a closed month or base LE`,
        );
    }
    if (issues.length) return issues;

    // The URL codec is the boundary every selection passes (F-37): a value it would replace was not valid here
    const parsed = codec.parse(new URLSearchParams(codec.serialize(merged)));
    for (const key of Object.keys(p) as (keyof Patch)[]) {
      const asked = merged[key];
      if (!Array.isArray(asked) && parsed[key] !== asked) issues.push(`${key}: ${String(asked)} is not valid here`);
    }
    return issues.length ? issues : parsed;
  }

  function check(name: string, rawArguments: string, current: Selection): CheckedCall {
    if (!isToolName(name))
      return { ok: false, result: error(name, 'unknown tool', `Available tools: ${TOOL_NAMES.join(', ')}`) };
    if (isNotBuilt(name)) return { ok: false, result: error(name, 'not built yet', NOT_BUILT[name]) };

    let raw: unknown;
    try {
      raw = rawArguments.trim() === '' ? {} : JSON.parse(rawArguments);
    } catch {
      return { ok: false, result: error(name, 'invalid arguments', 'arguments are not valid JSON') };
    }
    const invalid = (issues: readonly string[]): CheckedCall => ({
      ok: false,
      result: error(name, 'invalid arguments', issues.slice(0, 5).join('; ')),
    });
    const zodIssues = (e: z.ZodError) =>
      e.issues.map((i) => `${i.path.length ? i.path.join('.') : 'arguments'}: ${i.message}`);

    if (name === 'explain_line') {
      const r = explainArgs.safeParse(raw);
      if (!r.success) return invalid(zodIssues(r.error));
      if (!lineCodes.has(r.data.code) && !accountCodes.has(r.data.code))
        return invalid([`code: unknown line or account code ${r.data.code}`]);
      return { ok: true, call: { tool: name, code: r.data.code } };
    }

    const r = statementArgs.safeParse(raw);
    if (!r.success) return invalid(zodIssues(r.error));
    const { detail, lines: only, ...p } = r.data;
    const unknownLines = only?.filter((c) => !lineCodes.has(c)) ?? [];
    if (unknownLines.length) return invalid([`lines: unknown line code ${unknownLines.join(', ')}`]);
    const selection = toSelection(p, current);
    if (Array.isArray(selection)) return invalid(selection);

    const built = restrictToBuilt(selection);
    if (built.entity !== selection.entity)
      return { ok: false, result: error(name, 'not built yet', 'The consolidated Group view is not built yet.') };
    if ([selection.region, ...SLICES.map((f) => selection[f])].some((s) => s.length > 0))
      return { ok: false, result: error(name, 'not built yet', 'Region and slice filters are not built yet.') };

    const view: Selection = { ...selection, view: 'statement' };
    return {
      ok: true,
      call: {
        tool: name,
        selection: view,
        detail: detail ?? 'lines',
        lines: only ?? null,
        query: codec.serialize(view),
      },
    };
  }

  function envelope(engine: Engine, sel: Selection): Envelope {
    return {
      period: engine.period(sel).summary,
      notices: engine.notices(sel).map((n) => ({ code: n.code, text: n.text })),
    };
  }

  function statement(call: Extract<ValidCall, { tool: 'get_statement' }>, engine: Engine): StatementToolResult {
    const sel = call.selection;
    const result = engine.statement(sel);
    const units: Units | undefined = t.param_units.find((u) => u.units_code === sel.units);
    if (!units) throw new Error(`chat: no param_units row for ${sel.units}`);

    let rows: readonly StatementRow[];
    if (call.lines) {
      // The named lines and everything under them (OPEX → SM, RD, GA, OOI), accounts only with detail=accounts
      const keep = new Set(call.lines);
      const parent = new Map(result.rows.map((r) => [r.code, r.parent]));
      const inScope = (c0: string) => {
        for (let c: string | null = c0; c !== null; c = parent.get(c) ?? null) if (keep.has(c)) return true;
        return false;
      };
      const pool = call.detail === 'accounts' ? hideEmptyLines(result.rows, sel, units) : result.rows; // M-22
      rows = pool.filter((r) => inScope(r.code) && (call.detail === 'accounts' || r.kind !== 'leaf'));
    } else
      rows =
        call.detail === 'accounts'
          ? hideEmptyLines(result.rows, sel, units) // the whole statement with accounts, capped below
          : result.rows.filter((r) => r.kind === 'subtotal'); // default: the 8 subtotals, NR … NP

    const compares = (
      [
        [sel.compareA, 'A', (r: StatementRow) => r.compareA],
        [sel.compareB, 'B', (r: StatementRow) => r.compareB],
      ] as const
    ).flatMap(([choice, tag, pick]) => {
      const label = COMPARE_LABEL[choice];
      return label === null ? [] : [{ label: `${label} (${tag})`, tag, pick }];
    });
    const columns = [
      'code',
      'line',
      BASE_LABEL[sel.base],
      ...compares.flatMap((c) => [c.label, `Δ (${c.tag})`, `Δ% (${c.tag})`]),
    ];
    const cells = (r: StatementRow): string[] => {
      const ratio = r.kind === 'ratio'; // ratios: % values, Δ in percentage points, no Δ % (M-11)
      const value = (v: number | null) => (ratio ? formatPercent(v) : formatAmount(v, units));
      const delta = (v: Variance | null) =>
        ratio ? formatPoints(v?.delta ?? null) : formatAmount(v?.delta ?? null, units, { signed: true });
      const deltaPct = (v: Variance | null) => (ratio ? '' : formatPercent(v?.deltaPct ?? null, 1, { signed: true }));
      return [
        r.code,
        r.display,
        value(r.base),
        ...compares.flatMap((c) => {
          const v = c.pick(r);
          return [value(v?.value ?? null), delta(v), deltaPct(v)];
        }),
      ];
    };

    const header = engine.header(sel);
    const versions = header.filters.find((f) => f.label === 'Versions')?.value ?? '';
    const shown = rows.slice(0, CHAT_LIMITS.maxRows).map(cells);
    const out: StatementToolResult = {
      tool: 'get_statement',
      ...envelope(engine, sel),
      company: company(sel.entity),
      versions,
      units: header.rail.display,
      columns,
      rows: shown,
      omittedRows: rows.length - shown.length,
    };
    out.omittedRows += fit(out, shown);
    return out;
  }

  function explain(c: string, engine: Engine, current: Selection): ExplainLineResult {
    const name = new Map(lines.map((l) => [l.line_code, l.line_name]));
    const head = { tool: 'explain_line' as const, ...envelope(engine, current), code: c };
    const line = lines.find((l) => l.line_code === c);
    if (line) {
      const accounts = buildSpine(m, current.entity)
        .filter((r) => r.kind === 'leaf' && r.parent === c)
        .slice(0, CHAT_LIMITS.maxRows)
        .map((r) => ({ code: r.code, name: r.label }));
      const out: ExplainLineResult = {
        ...head,
        name: line.line_name,
        statementLine: lineDisplay(lines, line),
        kind: line.row_type,
        alias:
          (current.entity === 'P' ? line.alias_products : current.entity === 'S' ? line.alias_services : null) ?? null,
        // "-TAX / PBT" → "−Income tax expense ÷ Profit before tax"; operators first, names may hold a "/"
        formula:
          line.formula
            ?.replace('/', '÷')
            .replace(/^-/, '−')
            .replace(/[A-Z][A-Z0-9_]*/g, (code) => name.get(code) ?? code) ?? null,
        partOf: line.parent_line_code === null ? null : (name.get(line.parent_line_code) ?? line.parent_line_code),
        tag: line.tag,
        ifrs18Category: line.ifrs18_category,
        accounts,
      };
      fit(out, accounts);
      return out;
    }
    const account = t.dim_account.find((a) => a.account_code === c);
    if (!account) throw new Error(`chat: ${c} is neither a report line nor an account`); // check() rejects it first
    const block = lines.find((l) => l.block_code === account.block_code);
    return {
      ...head,
      name: account.account_name,
      statementLine: block ? lineDisplay(lines, block) : account.block_name,
      kind: 'account',
      company: account.entity_scope_name,
      definition: account.definition,
      publishedComparable: account.published_comparable,
      ifrs18Category: account.ifrs18_category,
      intercompany: account.is_intercompany,
    };
  }

  return {
    definitions,
    check,
    run(call, engine, current) {
      return call.tool === 'get_statement' ? statement(call, engine) : explain(call.code, engine, current);
    },
  };
}

/** Zod's built-in JSON Schema export (no extra dependency); draft-07 is what llama.cpp, vLLM and OpenAI all read. */
function jsonSchema(schema: z.ZodType): Record<string, unknown> {
  const json = z.toJSONSchema(schema, { target: 'draft-07', io: 'input' });
  delete json.$schema; // the relay sends `parameters` as is; the dialect marker is noise in every prompt
  return json;
}
