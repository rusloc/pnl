// Runs one DAX query through the `pnlModel` connector and reads its result table.
// The connector returns a normalised `SemanticModelQueryResult` (never throws on
// a query error); this module turns `status: 'error'` into a typed exception and
// gives the mappers column lookups that tolerate both `table[column]` and
// `[@alias]` column names (ADR-0006 §3.7).
import type {
  ExecuteQueryInput,
  QueryErrorCategory,
  QueryTable,
  SemanticModelQueryResult,
} from '@microsoft/rayfin-connector-fabric-semanticmodel';

export class PnlModelError extends Error {
  constructor(
    readonly category: QueryErrorCategory,
    message: string,
    readonly requestId?: string
  ) {
    super(message);
    this.name = 'PnlModelError';
  }
}

/** The one method of `client.connectors.pnlModel` the app uses (structural, so tests can fake it). */
export interface ModelQueryRunner {
  executeQuery(input: ExecuteQueryInput): Promise<SemanticModelQueryResult>;
}

export interface ModelQueryResult {
  table: QueryTable;
  requestId: string;
}

export async function runModelQuery(runner: ModelQueryRunner, query: string, rowLimit: number): Promise<ModelQueryResult> {
  const result = await runner.executeQuery({ query, resultSetRowCountLimit: rowLimit });
  if (result.status === 'error') {
    throw new PnlModelError(result.error.category, result.error.message, result.requestId);
  }
  return { table: result.table, requestId: result.requestId };
}

/** `dim_pl_row[row_key]` → `row_key`; `[@base]` → `@base`; `row_key` → `row_key`. */
export function columnName(name: string): string {
  const open = name.lastIndexOf('[');
  if (open === -1 || !name.endsWith(']')) return name;
  return name.slice(open + 1, -1);
}

/** Column index by normalised name; every `required` column must be present. */
export function indexColumns(table: QueryTable, required: readonly string[]): Map<string, number> {
  const index = new Map<string, number>();
  table.columns.forEach((c, i) => {
    if (!index.has(columnName(c.name))) index.set(columnName(c.name), i);
  });
  const missing = required.filter((c) => !index.has(c));
  if (missing.length > 0) {
    throw new PnlModelError('query', `Result is missing column(s): ${missing.join(', ')}`);
  }
  return index;
}

export function cellNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : typeof value === 'string' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function cellString(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}

export function cellBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === 'true' || value === 'True';
}
