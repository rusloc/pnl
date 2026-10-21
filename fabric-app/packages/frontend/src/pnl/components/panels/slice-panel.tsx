// Slice flyout (F-08 to F-11, F-32, F-33): region chips for every entity;
// channel / category / segment chips per operating entity; Group shows the
// reason and three disabled rows.
import { useId } from 'react';

import { activeSlices, SLICE_SLOTS } from '../../model/filters';
import { SAMPLE_INERT_REASON } from '../../model/sample-mode';
import type { Selection } from '../../model/types';
import { Caption, PanelGroup, type PanelProps } from '../filter-flyout';
import { Chip } from '../ui/chip';
import { InfoIcon } from '../ui/icons';

function countLabel(selection: Selection, total: number): string {
  return selection === null ? `All ${total}` : `${selection.length} of ${total}`;
}

function isSelected(selection: Selection, code: string): boolean {
  return selection === null || selection.includes(code);
}

export function SlicePanel({ filter, reference, dispatch, sample }: PanelProps) {
  const noteId = useId();
  const regionCodes = reference.regions.map((r) => r.code);
  const slices = activeSlices(filter);
  // LSN-002: a slice pick would reach the context line (F-36) and the allocation notice
  // but not the sample numbers, so the chips are off rather than half-honest.
  const chipProps = sample ? { disabled: true, title: SAMPLE_INERT_REASON } : {};
  return (
    <>
      {sample && <Caption id={noteId}>{SAMPLE_INERT_REASON}</Caption>}
      <PanelGroup label="Region" count={countLabel(filter.regions, regionCodes.length)}>
        <div role="group" aria-label="Region" aria-describedby={sample ? noteId : undefined} className="flex flex-wrap gap-[6px]">
          {reference.regions.map((r) => (
            <Chip
              key={r.code}
              label={r.name}
              selected={isSelected(filter.regions, r.code)}
              onToggle={() => dispatch({ type: 'toggleRegion', code: r.code, all: regionCodes })}
              {...chipProps}
            />
          ))}
        </div>
      </PanelGroup>
      {slices && filter.entity !== 'G' ? (
        <>
          {SLICE_SLOTS.map((slot) => {
            const set = reference.slices[filter.entity === 'G' ? 'P' : filter.entity][slot];
            const codes = set.values.map((v) => v.code);
            return (
              <PanelGroup key={slot} label={set.label} count={countLabel(slices[slot], codes.length)}>
                <div role="group" aria-label={set.label} aria-describedby={sample ? noteId : undefined} className="flex flex-wrap gap-[6px]">
                  {set.values.map((v) => (
                    <Chip
                      key={v.code}
                      label={v.name}
                      selected={isSelected(slices[slot], v.code)}
                      onToggle={() => dispatch({ type: 'toggleSlice', slot, code: v.code, all: codes })}
                      {...chipProps}
                    />
                  ))}
                </div>
              </PanelGroup>
            );
          })}
          <Caption>
            Every value starts selected. The last selected value in a group can’t be cleared. Lines below
            contribution margin are then allocated by net revenue share.
          </Caption>
        </>
      ) : (
        <>
          <div
            role="note"
            className="flex gap-[8px] rounded-[8px] border border-notice-border bg-notice-tint px-[12px] py-[10px] text-[13px] text-notice-text"
          >
            <InfoIcon className="mt-[2px] flex-none" />
            <span>
              Channel, category and segment values differ by company, so these filters are off in the
              consolidated view. Pick Consumer Products or Commerce Cloud to slice by them.
            </span>
          </div>
          <div className="flex flex-col gap-[6px]">
            {['Channel / sales motion', 'Category / service line', 'Price tier / customer segment'].map((label) => (
              <div
                key={label}
                aria-disabled="true"
                className="flex min-h-[40px] items-center justify-between rounded-[8px] border border-dashed border-line-300 bg-subtle px-[12px] text-slate-600"
              >
                <span>{label}</span>
                <span>All</span>
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
