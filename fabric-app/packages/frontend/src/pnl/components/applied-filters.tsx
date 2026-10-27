// Applied-filters button and pop-up (period-picker-v2 Part 2; L-04 / L-05 as
// amended, C-50): the funnel next to "Profit & loss" (Track B `hdr_filters`,
// 28 × 28, ground fill) opens a card listing every filter and its value plus the
// notices as rows (Track B `grp_info_filters`). Closes on Escape, ✕ and a click
// outside; focus moves to the close button on open and returns to the funnel on
// close (N-08). Same open / close pattern as the info pop-ups.
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import type { FilterRow } from '../model/applied-filters';
import { CloseIcon, FunnelIcon } from './ui/icons';

interface AppliedFiltersProps {
  rows: readonly FilterRow[];
  noticeRows: readonly FilterRow[];
  /** Number of notices that apply; shown on the button so they never go unnoticed (C-50). */
  noticeCount: number;
}

export function AppliedFilters({ rows, noticeRows, noticeCount }: AppliedFiltersProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const button = buttonRef.current;
    closeRef.current?.focus();
    const ctrl = new AbortController();
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          setOpen(false);
        }
      },
      { signal: ctrl.signal, capture: true }
    );
    document.addEventListener(
      'mousedown',
      (e) => {
        if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) setOpen(false);
      },
      { signal: ctrl.signal }
    );
    return () => {
      ctrl.abort();
      button?.focus();
    };
  }, [open]);

  const name = noticeCount > 0 ? `Show the applied filters (${noticeCount} ${noticeCount === 1 ? 'notice' : 'notices'})` : 'Show the applied filters';

  return (
    <span ref={rootRef} className="relative inline-flex">
      <button
        ref={buttonRef}
        type="button"
        aria-label={name}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Applied filters"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'relative flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-[8px] border-0 p-0 text-slate-600',
          open ? 'bg-acc-t text-acc' : 'bg-ground hover:bg-[#EDF0F3]'
        )}
      >
        <FunnelIcon size={16} />
        {noticeCount > 0 && (
          <span
            aria-hidden="true"
            data-testid="notice-count"
            className="absolute -right-[5px] -top-[5px] flex h-[15px] min-w-[15px] items-center justify-center rounded-full bg-notice-icon px-[3px] text-[10px] font-semibold leading-none text-surface"
          >
            {noticeCount}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-labelledby={titleId}
          className="absolute left-0 top-full z-30 mt-[6px] box-border flex w-[440px] max-w-[calc(100vw-120px)] flex-col rounded-[12px] border border-line-200 bg-surface text-left text-ink-900 shadow-flyout"
        >
          <div className="flex flex-none items-center justify-between gap-[8px] border-b border-line-100 px-[16px] pb-[10px] pt-[12px]">
            <span id={titleId} className="text-[16px] font-semibold">
              Applied filters
            </span>
            <button
              ref={closeRef}
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="flex h-[40px] w-[40px] flex-none cursor-pointer items-center justify-center rounded-[8px] border-0 bg-ground"
            >
              <CloseIcon />
            </button>
          </div>
          <table className="m-0 w-full border-collapse px-[16px] text-[13px] leading-[1.4]">
            <tbody>
              {rows.map((r) => (
                <tr key={r.label} className="border-b border-line-100">
                  <th scope="row" className="w-[112px] px-[16px] py-[6px] text-left align-top font-semibold text-slate-600">
                    {r.label}
                  </th>
                  <td className="px-[8px] py-[6px] pr-[16px] align-top">{r.value}</td>
                </tr>
              ))}
              {noticeRows.map((r, i) => (
                <tr key={`notice-${i}`} className={cn(i === 0 && 'border-t-2 border-line-200')} data-testid="notice-row">
                  <th scope="row" className="w-[112px] px-[16px] py-[6px] text-left align-top font-semibold text-notice-icon">
                    {r.label}
                  </th>
                  <td className="px-[8px] py-[6px] pr-[16px] align-top text-notice-text">{r.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </span>
  );
}
