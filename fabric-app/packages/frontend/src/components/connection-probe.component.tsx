import { useEffect, useState } from 'react';

import { getRayfinClient } from '@/lib/rayfin-client';
import { aggregateFactPl } from '@/pnl/data/pnl-aggregate.prototype';
import type { AggregatedAmount } from '@/pnl/model/fx';

type EntityRow = { entityCode: string; shortName: string };

type ProbeState =
  | { kind: 'loading' }
  | { kind: 'ok'; rows: EntityRow[] }
  | { kind: 'error'; message: string };

type AggregateState =
  | { kind: 'idle' }
  | { kind: 'running' }
  | { kind: 'ok'; rows: AggregatedAmount[]; ms: number }
  | { kind: 'error'; message: string };

const PROBE_MONTHS = Array.from({ length: 9 }, (_, i) => `2026-${String(i + 1).padStart(2, '0')}`);

/**
 * Smallest possible proof that the `lhraw` connector reads
 * lh_raw.acme_pl.dim_entity (spec §8: expected 2 rows, P and S), plus a
 * button that runs the ADR-0005 option (a) prototype (server-side groupBy +
 * sum over fact_pl). Reached with `#probe`; connectors work only when deployed.
 */
export function ConnectionProbe() {
  const [state, setState] = useState<ProbeState>({ kind: 'loading' });
  const [aggregate, setAggregate] = useState<AggregateState>({ kind: 'idle' });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const client = await getRayfinClient();
        const rows = await client.connectors.lhraw.DimEntity.select([
          'entityCode',
          'shortName',
        ])
          .first(10)
          .execute();
        if (!cancelled) setState({ kind: 'ok', rows });
      } catch (err) {
        if (!cancelled)
          setState({
            kind: 'error',
            message: err instanceof Error ? err.message : String(err),
          });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const runAggregate = async () => {
    setAggregate({ kind: 'running' });
    const started = performance.now();
    try {
      const client = await getRayfinClient();
      const rows = await aggregateFactPl(client, {
        entity: 'P',
        versionKey: 'ACT',
        monthKeys: PROBE_MONTHS,
      });
      setAggregate({ kind: 'ok', rows, ms: Math.round(performance.now() - started) });
    } catch (err) {
      setAggregate({ kind: 'error', message: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <main className="mx-auto max-w-md p-6 text-foreground">
      <h1 className="mb-1 text-lg font-semibold">ACME Unified P&amp;L</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Connection probe: lh_raw.acme_pl.dim_entity via connector{' '}
        <code>lhraw</code>
      </p>
      {state.kind === 'loading' && (
        <p className="text-sm text-muted-foreground">Reading dim_entity…</p>
      )}
      {state.kind === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          Read failed: {state.message}
        </p>
      )}
      {state.kind === 'ok' && (
        <>
          <p className="mb-2 text-sm">
            {state.rows.length} entities (expected 2)
          </p>
          <ul className="list-disc pl-5 text-sm">
            {state.rows.map((r) => (
              <li key={r.entityCode}>
                {r.entityCode} — {r.shortName}
              </li>
            ))}
          </ul>
        </>
      )}

      <h2 className="mb-1 mt-6 text-base font-semibold">Aggregation prototype (ADR-0005, option a)</h2>
      <p className="mb-2 text-sm text-muted-foreground">
        fact_pl · entity P · version ACT · Jan–Sep 2026 · groupBy account × month × currency · sum(amount_local).
        Expected: about 1,440 rows, not 458k.
      </p>
      <button
        type="button"
        onClick={() => void runAggregate()}
        disabled={aggregate.kind === 'running'}
        className="rounded bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-60"
      >
        {aggregate.kind === 'running' ? 'Running…' : 'Run aggregate prototype'}
      </button>
      {aggregate.kind === 'error' && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          Aggregate failed: {aggregate.message}
        </p>
      )}
      {aggregate.kind === 'ok' && (
        <div className="mt-2 text-sm">
          <p>
            {aggregate.rows.length} rows in {aggregate.ms} ms
          </p>
          <ul className="list-disc pl-5">
            {aggregate.rows.slice(0, 3).map((r) => (
              <li key={`${r.accountCode}|${r.monthKey}|${r.currencyCode}`}>
                {r.accountCode} · {r.monthKey} · {r.currencyCode} · {r.amountLocal}
              </li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}
