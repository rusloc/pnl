// Entity picker (L-01, F-01; ADR-0007 §2.4): opened from the rail brand mark,
// single select over the three companies. Anchored like the filter flyout;
// Escape, ✕, a click outside and a choice close it; focus moves to the current
// company on open and returns to the mark on close; arrow keys move between the
// options (N-08). The Group option follows the Q0 gate (ADR-0006 §8.2).
import { useEffect, useRef, type KeyboardEvent } from 'react';

import { cn } from '@/lib/utils';

import type { EntityCode } from '../model/types';
import { COMPANIES, COMPANY_THEME } from '../theme/company';
import { RAIL_WIDTH } from './rail-groups';
import { CloseIcon } from './ui/icons';

export const BRAND_MARK_ID = 'rail-brand-mark';

export const GROUP_GATE_REASON = 'The consolidated view needs access to both companies in the semantic model';

interface EntityPickerProps {
  entity: EntityCode;
  groupAllowed: boolean;
  wide: boolean;
  onSelect: (entity: EntityCode) => void;
  onClose: () => void;
}

export function EntityPicker({ entity, groupAllowed, wide, onSelect, onClose }: EntityPickerProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const current = COMPANIES.findIndex((c) => c.code === entity);
    optionRefs.current[current]?.focus();
    const ctrl = new AbortController();
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
        }
      },
      { signal: ctrl.signal, capture: true }
    );
    document.addEventListener(
      'mousedown',
      (e) => {
        if (!(e.target instanceof Node)) return;
        if (rootRef.current?.contains(e.target)) return;
        if (document.getElementById(BRAND_MARK_ID)?.contains(e.target)) return;
        onClose();
      },
      { signal: ctrl.signal }
    );
    return () => {
      ctrl.abort();
      document.getElementById(BRAND_MARK_ID)?.focus();
    };
    // Runs once per open: the focus target is the company at open time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onOptionKey = (e: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 0;
    if (delta === 0) return;
    e.preventDefault();
    const next = (i + delta + COMPANIES.length) % COMPANIES.length;
    optionRefs.current[next]?.focus();
  };

  return (
    <div ref={rootRef} className="absolute z-30 w-[320px]" style={{ left: (wide ? RAIL_WIDTH.expanded : RAIL_WIDTH.collapsed) + 10, top: 12 }}>
      <div aria-hidden="true" className="absolute -left-[7px] top-[18px] h-[12px] w-[12px] rotate-45 border-b border-l border-line-200 bg-surface" />
      <div role="dialog" aria-label="Switch company" className="relative box-border flex flex-col rounded-[12px] border border-line-200 bg-surface shadow-flyout">
        <div className="flex flex-none items-center justify-between gap-[8px] border-b border-line-100 px-[16px] pb-[12px] pt-[14px]">
          <div className="flex min-w-0 flex-col">
            <span className="text-[16px] font-semibold">Company</span>
            <span className="text-[12px] text-slate-600">Period, versions, currency and region carry across</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[40px] w-[40px] flex-none cursor-pointer items-center justify-center rounded-[8px] border-0 bg-ground"
          >
            <CloseIcon />
          </button>
        </div>
        <div role="radiogroup" aria-label="Company" className="flex flex-col gap-[8px] px-[16px] pb-[16px] pt-[14px]">
          {COMPANIES.map((c, i) => {
            const selected = c.code === entity;
            const theme = COMPANY_THEME[c.code];
            const off = c.code === 'G' && !groupAllowed;
            return (
              <button
                key={c.code}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                type="button"
                role="radio"
                aria-checked={selected}
                tabIndex={selected ? 0 : -1}
                disabled={off}
                title={off ? GROUP_GATE_REASON : undefined}
                onKeyDown={(e) => onOptionKey(e, i)}
                onClick={() => {
                  onSelect(c.code);
                  onClose();
                }}
                className={cn(
                  'box-border flex min-h-[52px] w-full items-center gap-[10px] rounded-[10px] border py-[6px] pl-[12px] pr-[16px] text-left font-[inherit] text-ink-900',
                  off ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
                )}
                style={{
                  borderColor: selected ? theme.acc : '#CDD4DC',
                  boxShadow: selected ? `0 0 0 1px ${theme.acc}` : 'none',
                  background: selected ? theme.accT : '#FFFFFF',
                }}
              >
                <span aria-hidden="true" className="h-[12px] w-[12px] flex-none rounded-[6px]" style={{ background: theme.acc }} />
                <span className="flex flex-col leading-[1.25]">
                  <span className="text-[15px] font-semibold">{c.name}</span>
                  <span className="text-[12px] text-slate-600">{c.sub}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
