// Frosted-glass pop-up shell (ADR-0012 §2.5): translucent white with a backdrop
// blur, 1 px light border, 16 px radius; a solid panel where backdrop-filter is
// not supported. One layer open at a time (opening one closes every other);
// Esc, a click outside and × close; focus moves to the close button on open,
// Tab is trapped inside, and focus returns to the opener on close (N-08).
// Used by the ⓘ pop-ups (`info-popover.tsx`) and "How to read" (`how-to-read.tsx`).
import { type ReactNode, useEffect, useId, useRef } from 'react';

import { cn } from '@/lib/utils';

import { CloseIcon } from './ui/icons';

/** Open dialogs announce themselves here so the others close (one layer at a time). */
const openListeners = new Set<(token: symbol) => void>();

function announceOpen(token: symbol): void {
  for (const listener of [...openListeners]) listener(token);
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export interface GlassDialogProps {
  open: boolean;
  onClose: () => void;
  /** The element the dialog is positioned against and whose contents count as "inside". */
  rootRef: React.RefObject<HTMLElement | null>;
  /** The opener, which gets the focus back on close (N-08). */
  openerRef: React.RefObject<HTMLElement | null>;
  title: string;
  /** Which edge of the opener the dialog aligns to. */
  align?: 'start' | 'end';
  width: number;
  children: ReactNode;
  testId?: string;
}

export function GlassDialog({ open, onClose, rootRef, openerRef, title, align = 'start', width, children, testId }: GlassDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const token = Symbol('glass');
    const opener = openerRef.current;
    const onOther = (other: symbol) => {
      if (other !== token) onClose();
    };
    openListeners.add(onOther);
    announceOpen(token);
    closeRef.current?.focus();
    const ctrl = new AbortController();
    window.addEventListener(
      'keydown',
      (e) => {
        if (e.key === 'Escape') {
          e.stopPropagation();
          onClose();
          return;
        }
        if (e.key !== 'Tab' || !dialogRef.current) return;
        const items = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        } else if (!dialogRef.current.contains(document.activeElement)) {
          e.preventDefault();
          first.focus();
        }
      },
      { signal: ctrl.signal, capture: true }
    );
    document.addEventListener(
      'mousedown',
      (e) => {
        if (rootRef.current && e.target instanceof Node && !rootRef.current.contains(e.target)) onClose();
      },
      { signal: ctrl.signal }
    );
    const dialog = dialogRef.current;
    return () => {
      ctrl.abort();
      openListeners.delete(onOther);
      // Focus goes back to the opener unless another layer already took it (one layer at a time).
      const active = document.activeElement;
      if (!active || active === document.body || dialog?.contains(active)) opener?.focus();
    };
    // `onClose` is a state setter from the owner; the effect runs per open/close only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;
  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-labelledby={titleId}
      data-testid={testId}
      className={cn(
        'absolute top-full z-30 mt-[6px] box-border flex max-h-[640px] max-w-[calc(100vw-120px)] flex-col overflow-auto rounded-[16px] border border-line-200/95 bg-surface/95 text-left font-ledger text-[13px] font-normal normal-case leading-[1.45] tracking-normal text-ink-900 shadow-flyout',
        'supports-[backdrop-filter]:bg-surface/75 supports-[backdrop-filter]:backdrop-blur-[18px] supports-[backdrop-filter]:backdrop-saturate-[1.3]',
        align === 'end' ? 'right-0' : 'left-0'
      )}
      style={{ width }}
    >
      <div className="flex flex-none items-start justify-between gap-[8px] px-[18px] pb-[6px] pt-[14px]">
        <span id={titleId} className="text-[15px] font-semibold">
          {title}
        </span>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="-mr-[8px] -mt-[4px] flex h-[32px] w-[32px] flex-none cursor-pointer items-center justify-center rounded-[8px] border-0 bg-ground/90 text-slate-600"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="px-[18px] pb-[14px]">{children}</div>
    </div>
  );
}
