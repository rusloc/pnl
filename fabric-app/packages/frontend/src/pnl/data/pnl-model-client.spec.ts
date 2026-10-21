// Query runner for the pnlModel connector: `status: 'error'` becomes a typed
// exception, transport errors propagate, and column lookups accept both the
// `table[column]` and `[@alias]` names the connector returns (ADR-0006 §3.7).
import type { SemanticModelQueryResult } from '@microsoft/rayfin-connector-fabric-semanticmodel';
import { describe, expect, it, vi } from 'vitest';

import { cellBoolean, cellNumber, cellString, columnName, indexColumns, type ModelQueryRunner, PnlModelError, runModelQuery } from './pnl-model-client';

function runner(result: SemanticModelQueryResult): ModelQueryRunner & { executeQuery: ReturnType<typeof vi.fn> } {
  return { executeQuery: vi.fn(async () => result) };
}

describe('runModelQuery', () => {
  it('passes the DAX and the row cap through and returns the table with its request id', async () => {
    const table = { columns: [{ name: '[@base]', dataType: 'Double' }], rows: [[1]] };
    const r = runner({ status: 'success', table, requestId: 'req-1' });
    await expect(runModelQuery(r, 'EVALUATE ROW ( "ok", 1 )', 500)).resolves.toEqual({ table, requestId: 'req-1' });
    expect(r.executeQuery).toHaveBeenCalledWith({ query: 'EVALUATE ROW ( "ok", 1 )', resultSetRowCountLimit: 500 });
  });

  it('turns a normalised error result into a PnlModelError carrying category and request id', async () => {
    const r = runner({
      status: 'error',
      error: { category: 'overflow', message: 'Row limit of 500 exceeded', recoveryHint: 'raise the limit' },
      requestId: 'req-2',
    });
    const err = await runModelQuery(r, 'EVALUATE x', 500).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PnlModelError);
    expect(err).toMatchObject({ category: 'overflow', message: 'Row limit of 500 exceeded', requestId: 'req-2' });
  });

  it('lets a transport exception propagate untouched', async () => {
    const r: ModelQueryRunner = {
      executeQuery: async () => {
        throw new TypeError('Failed to fetch');
      },
    };
    await expect(runModelQuery(r, 'EVALUATE x', 500)).rejects.toThrow(TypeError);
  });
});

describe('column helpers', () => {
  it('normalises fully qualified, aliased and bare column names', () => {
    expect(columnName('dim_pl_row[row_key]')).toBe('row_key');
    expect(columnName('[@base]')).toBe('@base');
    expect(columnName('row_key')).toBe('row_key');
    expect(columnName("'dim pl row'[line_code]")).toBe('line_code');
  });

  it('indexes columns by normalised name and refuses a table missing a required one', () => {
    const table = {
      columns: [
        { name: 'dim_pl_row[row_key]', dataType: 'String' },
        { name: '[@base]', dataType: 'Double' },
      ],
      rows: [],
    };
    const index = indexColumns(table, ['row_key', '@base']);
    expect(index.get('row_key')).toBe(0);
    expect(index.get('@base')).toBe(1);
    expect(() => indexColumns(table, ['row_key', '@cmp_a', '@d_a'])).toThrow(/missing column\(s\): @cmp_a, @d_a/);
  });

  it('reads cells defensively: blanks are null, numeric strings are numbers, booleans may arrive as text', () => {
    expect(cellNumber(null)).toBeNull();
    expect(cellNumber(undefined)).toBeNull();
    expect(cellNumber('')).toBeNull();
    expect(cellNumber('12.5')).toBe(12.5);
    expect(cellNumber(3)).toBe(3);
    expect(cellNumber('n/a')).toBeNull();
    expect(cellNumber(Number.NaN)).toBeNull();
    expect(cellString(null)).toBe('');
    expect(cellString('NR')).toBe('NR');
    expect(cellBoolean(true)).toBe(true);
    expect(cellBoolean('True')).toBe(true);
    expect(cellBoolean(1)).toBe(true);
    expect(cellBoolean(false)).toBe(false);
    expect(cellBoolean(null)).toBe(false);
  });
});
