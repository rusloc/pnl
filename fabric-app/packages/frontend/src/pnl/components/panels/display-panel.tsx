// Display flyout (F-12 to F-17): currency, FX basis, units, costs shown,
// variance format and the "Statement shows" switches.
import { useId } from 'react';

import type { FilterPatch } from '../../model/filters';
import { SAMPLE_INERT_REASON, SAMPLE_STATEMENT_ONLY_NOTE, sampleGate } from '../../model/sample-mode';
import type { CostSign, Currency, FxBasis, Units, VarianceFormat } from '../../model/types';
import { Caption, PanelGroup, type PanelProps } from '../filter-flyout';
import { Segmented } from '../ui/segmented';
import { SwitchRow } from '../ui/switch';

const CURRENCIES: readonly { value: Currency; label: string }[] = [
  { value: 'USD', label: 'USD' },
  { value: 'EUR', label: 'EUR' },
  { value: 'GBP', label: 'GBP' },
];
const FX: readonly { value: FxBasis; label: string }[] = [
  { value: 'actual', label: 'Actual rates' },
  { value: 'constant', label: 'Constant currency' },
];
const UNITS: readonly { value: Units; label: string }[] = [
  { value: 'm', label: '$m' },
  { value: 'k', label: '$k' },
];
const COST_SIGN: readonly { value: CostSign; label: string }[] = [
  { value: 'neg', label: '−' },
  { value: 'pos', label: '+' },
];
const VARIANCE: readonly { value: VarianceFormat; label: string }[] = [
  { value: 'both', label: 'Amount and %' },
  { value: 'amount', label: 'Amount' },
  { value: 'pct', label: '%' },
];

export function DisplayPanel({ filter, dispatch, sample }: PanelProps) {
  const noteId = useId();
  const set = (patch: FilterPatch) => dispatch({ type: 'set', patch });
  const describedBy = sample ? noteId : undefined;
  return (
    <>
      {/* LSN-002: sample figures are USD at actual rates, so currency (F-12) and FX basis (F-13)
          are off; units, costs shown and variance format do work, but in the statement only. */}
      {sample && <Caption id={noteId}>{SAMPLE_INERT_REASON}</Caption>}
      <PanelGroup label="Currency">
        <Segmented
          label="Currency"
          value={filter.currency}
          options={sampleGate(CURRENCIES, sample)}
          onChange={(currency) => set({ currency })}
          fontSize={14}
          describedBy={describedBy}
        />
      </PanelGroup>
      <PanelGroup label="FX basis">
        <Segmented label="FX basis" value={filter.fxBasis} options={sampleGate(FX, sample)} onChange={(fxBasis) => set({ fxBasis })} describedBy={describedBy} />
      </PanelGroup>
      <div className="grid grid-cols-2 gap-[10px]">
        <PanelGroup label="Units">
          <Segmented label="Units" value={filter.units} options={UNITS} onChange={(units) => set({ units })} />
        </PanelGroup>
        <PanelGroup label="Costs shown">
          <Segmented label="Costs shown" value={filter.costSign} options={COST_SIGN} onChange={(costSign) => set({ costSign })} />
        </PanelGroup>
      </div>
      <PanelGroup label="Variance">
        <Segmented
          label="Variance format"
          value={filter.varianceFormat}
          options={VARIANCE}
          onChange={(varianceFormat) => set({ varianceFormat })}
        />
        {sample && <Caption>{SAMPLE_STATEMENT_ONLY_NOTE}</Caption>}
      </PanelGroup>
      <div className="flex flex-col">
        <span className="text-[12px] font-semibold text-slate-600">Statement shows</span>
        <SwitchRow label="% of net revenue column" checked={filter.showPctNr} onChange={(showPctNr) => set({ showPctNr })} />
        <SwitchRow label="Full-year outlook columns" checked={filter.showFyOutlook} onChange={(showFyOutlook) => set({ showFyOutlook })} />
        <SwitchRow label="Classification tags" checked={filter.showTags} onChange={(showTags) => set({ showTags })} />
        <SwitchRow label="Hide empty lines" checked={filter.hideEmpty} onChange={(hideEmpty) => set({ hideEmpty })} last />
      </div>
    </>
  );
}
