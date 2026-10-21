// Loads reference data once, then figures whenever the filter changes. Both
// loads are cancellable so a stale response never overwrites a newer one.
import { useEffect, useState } from 'react';

import type { Figures, FilterState, PnlDataSource, ReferenceData } from '../model/types';

export type ReferenceState =
  | { status: 'loading' }
  | { status: 'ready'; reference: ReferenceData; fallbackReason?: string };

export function useReference(source: PnlDataSource): ReferenceState {
  const [state, setState] = useState<ReferenceState>({ status: 'loading' });
  useEffect(() => {
    let cancelled = false;
    source.loadReference().then((r) => {
      if (!cancelled) setState({ status: 'ready', ...r });
    });
    return () => {
      cancelled = true;
    };
  }, [source]);
  return state;
}

export function useFigures(source: PnlDataSource, filter: FilterState, reference: ReferenceData): Figures | null {
  const [figures, setFigures] = useState<Figures | null>(null);
  useEffect(() => {
    let cancelled = false;
    source.loadFigures(filter, reference).then((f) => {
      if (!cancelled) setFigures(f);
    });
    return () => {
      cancelled = true;
    };
  }, [source, filter, reference]);
  return figures;
}
