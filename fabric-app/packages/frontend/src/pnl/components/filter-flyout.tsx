// Filter flyout (design brief §5.2): one panel open at a time, anchored to the
// rail item with a pointer; Escape, ✕ and Done close it; focus moves to the
// close button on open and returns to the rail item on close (N-08).
import { useEffect, useRef, type ReactNode } from 'react';

import type { FilterAction } from '../model/filters';
import type { FilterState, PanelKey, ReferenceData } from '../model/types';
import { RAIL_GROUPS, RAIL_WIDTH, railItemId } from './rail-groups';
import { DisplayPanel } from './panels/display-panel';
import { PeriodPanel } from './panels/period-panel';
import { SlicePanel } from './panels/slice-panel';
import { VersionsPanel } from './panels/versions-panel';
import { CloseIcon } from './ui/icons';

export interface PanelProps {
  filter: FilterState;
  reference: ReferenceData;
  dispatch: (action: FilterAction) => void;
  /** True while the figures are sample: pickers that would re-label them are off (LSN-002). */
  sample: boolean;
}

const TITLES: Record<PanelKey, [string, (reference: ReferenceData, filter: FilterState) => string]> = {
  period: ['Period', () => 'Year, month and time view'],
  compare: ['Versions', () => 'Base and two comparisons'],
  slice: [
    'Slice',
    (reference, filter) =>
      filter.entity === 'G'
        ? 'Only region applies in the consolidated view'
        : `Region, ${Object.values(reference.slices[filter.entity])
            .map((s) => s.label.toLowerCase())
            .join(', ')
            .replace(/, ([^,]*)$/, ' and $1')}`,
  ],
  display: ['Display', () => 'Currency, units and table options'],
};

interface FilterFlyoutProps extends PanelProps {
  panel: PanelKey;
  wide: boolean;
  defaults: FilterState;
  onClose: () => void;
}

export function FilterFlyout({ panel, wide, defaults, onClose, filter, reference, dispatch, sample }: FilterFlyoutProps) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    return () => {
      document.getElementById(railItemId(panel))?.focus();
    };
  }, [panel]);

  useEffect(() => {
    const ctrl = new AbortController();
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') onClose();
      },
      { signal: ctrl.signal }
    );
    return () => ctrl.abort();
  }, [onClose]);

  const index = RAIL_GROUPS.findIndex((g) => g.key === panel);
  const [title, subtitle] = TITLES[panel];
  const railWidth = wide ? RAIL_WIDTH.expanded : RAIL_WIDTH.collapsed;
  const panelProps: PanelProps = { filter, reference, dispatch, sample };
  const body: ReactNode =
    panel === 'period' ? (
      <PeriodPanel {...panelProps} />
    ) : panel === 'compare' ? (
      <VersionsPanel {...panelProps} />
    ) : panel === 'slice' ? (
      <SlicePanel {...panelProps} />
    ) : (
      <DisplayPanel {...panelProps} />
    );

  return (
    <div className="absolute z-30 w-[352px]" style={{ left: railWidth + 10, top: 92 }}>
      <div
        aria-hidden="true"
        className="absolute -left-[7px] h-[12px] w-[12px] rotate-45 border-b border-l border-line-200 bg-surface"
        style={{ top: index * 52 + 18 }}
      />
      <div
        role="dialog"
        aria-label={`${title} filters`}
        className="relative box-border flex max-h-[calc(100vh-108px)] flex-col rounded-[12px] border border-line-200 bg-surface shadow-flyout"
      >
        <div className="flex flex-none items-center justify-between gap-[8px] border-b border-line-100 px-[16px] pb-[12px] pt-[14px]">
          <div className="flex min-w-0 flex-col">
            <span className="text-[16px] font-semibold">{title}</span>
            <span className="text-[12px] text-slate-600">{subtitle(reference, filter)}</span>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[40px] w-[40px] flex-none cursor-pointer items-center justify-center rounded-[8px] border-0 bg-ground"
          >
            <CloseIcon />
          </button>
        </div>
        <div className="flex min-h-0 flex-auto flex-col gap-[18px] overflow-auto px-[16px] pb-[16px] pt-[14px]">
          {body}
        </div>
        <div className="flex flex-none items-center justify-between gap-[8px] border-t border-line-100 px-[16px] py-[10px]">
          <button
            type="button"
            onClick={() => dispatch({ type: 'resetGroup', group: panel, defaults })}
            className="h-[40px] cursor-pointer border-0 bg-transparent px-[4px] font-[inherit] text-[14px] text-acc underline"
          >
            Reset this group
          </button>
          <button
            type="button"
            onClick={onClose}
            className="h-[40px] cursor-pointer rounded-[8px] border-0 bg-acc px-[20px] font-[inherit] text-[14px] font-semibold text-surface"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function PanelGroup({ label, count, children }: { label: string; count?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-[8px]">
      {count === undefined ? (
        <span className="text-[12px] font-semibold text-slate-600">{label}</span>
      ) : (
        <div className="flex items-baseline justify-between">
          <span className="text-[12px] font-semibold text-slate-600">{label}</span>
          <span className="text-[12px] text-slate-600">{count}</span>
        </div>
      )}
      {children}
    </div>
  );
}

export function Caption({ id, children }: { id?: string; children: ReactNode }) {
  return (
    <span id={id} className="text-[12px] text-slate-600">
      {children}
    </span>
  );
}
