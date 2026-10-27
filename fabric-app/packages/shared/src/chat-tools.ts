// AI chat tool contract (ADR-0009 §1, §2): the closed list of tools the LLM may
// call, with their JSON-schema arguments. Shared by the `chatTurn` function
// (sends them to the model as `tools`) and the frontend (validates the model's
// arguments against the reference data and runs them through the view loaders).
// The LLM never touches data: every number in an answer comes from a tool result.

export const CHAT_TOOL_NAMES = [
  'get_statement',
  'get_kpis',
  'get_bridge',
  'get_largest_variances',
  'get_profitability',
  'get_context',
  'explain_line',
  'explain_kpi',
] as const;

export type ChatToolName = (typeof CHAT_TOOL_NAMES)[number];

export function isChatToolName(name: string): name is ChatToolName {
  return (CHAT_TOOL_NAMES as readonly string[]).includes(name);
}

/** Row caps per tool result (ADR-0009 §2); the runner truncates and says so. */
export const TOOL_ROW_CAPS = {
  get_statement: { lines: 30, detail: 50 },
  get_kpis: 12,
  get_bridge: 20,
  get_largest_variances: 8,
  get_profitability: 25,
} as const;

/** Bounds of one chat turn, enforced in the function before any provider call. */
export const CHAT_BOUNDS = {
  /** Messages per request (system prompt excluded). */
  maxMessages: 24,
  /** Characters of one user message. */
  maxUserChars: 1_000,
  /** Characters of one tool result (the runner caps its JSON at this size). */
  maxToolResultChars: 6_000,
  /** Characters of the whole request (all message contents). */
  maxRequestChars: 40_000,
  /** Tool calls the model may make in one response; extras are dropped. */
  maxToolCallsPerTurn: 4,
  /** Tool-call rounds per user question (the loop runs in the browser). */
  maxStepsPerTurn: 3,
  /** Output tokens per model response. */
  maxOutputTokens: 600,
  /** Provider call abort, ms (ADR-0009 §2: LLM call ≤ 60 s, turn ≤ 90 s). */
  providerTimeoutMs: 60_000,
  /** Browser-side invoke timeout for one `chatTurn`, ms. */
  invokeTimeoutMs: 90_000,
} as const;

/** Minimal JSON-schema vocabulary (what the chat-completions API accepts for `parameters`). */
export interface JsonSchemaProperty {
  type: 'string' | 'integer' | 'boolean' | 'array';
  description: string;
  enum?: readonly string[];
  minimum?: number;
  maximum?: number;
  items?: { type: 'string' };
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required?: readonly string[];
  additionalProperties: false;
}

export interface ChatToolDefinition {
  name: ChatToolName;
  description: string;
  parameters: ToolParameters;
}

/**
 * The filter patch every data tool accepts (snake_case for the model; the
 * frontend maps it onto `FilterState`). Unspecified fields inherit the user's
 * current filters, so a question "and for Commerce Cloud?" is one field.
 */
const FILTER_PROPERTIES: Record<string, JsonSchemaProperty> = {
  entity: {
    type: 'string',
    enum: ['P', 'S', 'G'],
    description: 'Company: P = ACME Consumer Products, S = ACME Commerce Cloud, G = ACME Group (consolidated). Omit to keep the current one.',
  },
  fiscal_year: { type: 'integer', description: 'Fiscal year, e.g. 2026. Omit to keep the current one.', minimum: 1900, maximum: 2999 },
  month: { type: 'integer', description: 'Anchor month number 1-12 (the window ends here). Omit to keep the current one.', minimum: 1, maximum: 12 },
  time_view: {
    type: 'string',
    enum: ['month', 'qtd', 'ytd', 'ltm', 'fy'],
    description: 'Window ending at the anchor month: one month, quarter to date, year to date, last 12 months, full year.',
  },
  base_version: { type: 'string', enum: ['ACT', 'LE', 'BUD'], description: 'Base figures: Actual, Latest estimate or Budget.' },
  compare_a: { type: 'string', enum: ['BUD', 'LE', 'PY', 'NONE'], description: 'Comparison A: Budget, Latest estimate, Prior year or none.' },
  compare_b: { type: 'string', enum: ['BUD', 'LE', 'PY', 'NONE'], description: 'Comparison B.' },
  currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'], description: 'Reporting currency.' },
  fx_basis: { type: 'string', enum: ['actual', 'constant'], description: 'Actual rates or constant currency (budget rates).' },
  regions: { type: 'array', items: { type: 'string' }, description: 'Region names to keep; omit for all regions.' },
  channel: { type: 'array', items: { type: 'string' }, description: 'Channel / sales-motion names to keep (operating companies only); omit for all.' },
  line: { type: 'array', items: { type: 'string' }, description: 'Category / service-line names to keep (operating companies only); omit for all.' },
  segment: { type: 'array', items: { type: 'string' }, description: 'Price-tier / customer-segment names to keep (operating companies only); omit for all.' },
};

function withFilters(extra: Record<string, JsonSchemaProperty> = {}, required: readonly string[] = []): ToolParameters {
  return { type: 'object', properties: { ...FILTER_PROPERTIES, ...extra }, required, additionalProperties: false };
}

export const CHAT_TOOLS: readonly ChatToolDefinition[] = [
  {
    name: 'get_statement',
    description:
      'The P&L statement for a filter selection: one row per line (gross revenue, net revenue, gross profit, EBITDA, operating profit, net profit, margins) with base, comparisons and variances. Amounts in the reporting currency, millions; ratio rows in %. Set detail=true to include the account-level rows under each line.',
    parameters: withFilters({ detail: { type: 'boolean', description: 'Include account-level rows (up to 50 rows instead of 30).' } }),
  },
  {
    name: 'get_kpis',
    description: 'The Vitals cards (net revenue, Adj. EBITDA, operating profit, gross margin %, opex % NR and the five company drivers) with their value, the status vs Budget and the change vs each comparison, as the Vitals view shows them.',
    parameters: withFilters(),
  },
  {
    name: 'get_bridge',
    description: 'The net revenue bridge from the comparison to the base: the comparison total, one step per driver (volume, price/mix, FX, service lines or companies) and the base total.',
    parameters: withFilters(),
  },
  {
    name: 'get_largest_variances',
    description: 'The 8 detailed P&L lines that differ most from the comparison, with the block they belong to, the difference and whether it is favourable.',
    parameters: withFilters(),
  },
  {
    name: 'get_profitability',
    description: 'Net revenue, share, growth vs the comparison and the four margins (gross, contribution, adj. EBITDA, operating) per member of a breakdown dimension.',
    parameters: withFilters({
      breakdown: {
        type: 'string',
        enum: ['region', 'channel', 'line', 'segment', 'entity'],
        description: 'Breakdown dimension; entity (company) only for the Group view; channel, line and segment only for operating companies. Omit to keep the current one.',
      },
    }),
  },
  {
    name: 'get_context',
    description: 'The applied filters in words (company, window, versions, currency, slices), the last closed month, the data refresh time and the notices that apply (cut-off, forecast months, allocation, eliminations). Call this first when unsure what the user is looking at.',
    parameters: withFilters(),
  },
  {
    name: 'explain_line',
    description: 'What a P&L line is: its label, level, tags (IFRS 18, management measure, intercompany), its parent and the detailed lines under it. No numbers.',
    parameters: withFilters({ name: { type: 'string', description: 'The line code or label, e.g. "NR" or "Net revenue".' } }, ['name']),
  },
  {
    name: 'explain_kpi',
    description: 'What a key figure means: its definition and whether higher or lower is better. No numbers.',
    parameters: withFilters({ name: { type: 'string', description: 'The KPI code or label, e.g. "GM_PCT" or "Gross margin".' } }, ['name']),
  },
];

/** The `tools` array of the chat-completions request. */
export function chatToolsForProvider(): { type: 'function'; function: { name: string; description: string; parameters: ToolParameters } }[] {
  return CHAT_TOOLS.map((t) => ({ type: 'function', function: { name: t.name, description: t.description, parameters: t.parameters } }));
}

/** Which view a tool's result opens (the "Open in view" action). */
export const TOOL_VIEW: Record<ChatToolName, 'pnl' | 'kpi' | 'ana' | 'prof'> = {
  get_statement: 'pnl',
  get_kpis: 'kpi',
  get_bridge: 'ana',
  get_largest_variances: 'ana',
  get_profitability: 'prof',
  get_context: 'pnl',
  explain_line: 'pnl',
  explain_kpi: 'kpi',
};

/** Human label of a tool, for the result cards and the loading text. */
export const TOOL_LABEL: Record<ChatToolName, string> = {
  get_statement: 'P&L statement',
  get_kpis: 'Vitals',
  get_bridge: 'Net revenue bridge',
  get_largest_variances: 'Largest variances',
  get_profitability: 'Profitability',
  get_context: 'Applied filters and notices',
  explain_line: 'Line definition',
  explain_kpi: 'KPI definition',
};
