// Info pop-up (L-15, ADR-0007 §2.6): an (i) button in a visual's title row that
// opens a small card with the shared explanation (model/info-popovers.ts).
// Closes on Escape, ✕ and a click outside; focus moves to the close button on
// open and returns to the (i) button on close (N-08). Styled with the flyout
// tokens (design guide §5.2).
import { useEffect, useId, useRef, useState } from 'react';

import { cn } from '@/lib/utils';

import { boldRuns, INFO_HEADINGS, infoFor, type InfoContext, type InfoKey } from '../model/info-popovers';
import { CloseIcon, InfoCircleIcon } from './ui/icons';

interface InfoPopoverProps {
  info: InfoKey;
  context: InfoContext;
  /** Which edge of the button the card aligns to; 'end' for cards at the right of the screen. */
  align?: 'start' | 'end';
}

function Rich({ text }: { text: string }) {
  return (
    <>
      {boldRuns(text).map((r, i) => (r.bold ? <strong key={i}>{r.text}</strong> : <span key={i}>{r.text}</span>))}
    </>
  );
}

export function InfoPopover({ info, context, align = 'start' }: InfoPopoverProps) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const rootRef = useRef<HTMLSpanElement>(null);
  const titleId = useId();
  const text = infoFor(info, context);

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

  return (
    <span ref={rootRef} className="relative inline-flex font-ledger text-[14px] font-normal normal-case tracking-normal">
      <button
        ref={buttonRef}
        type="button"
        aria-label={`About ${text.title}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={`About ${text.title}`}
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-[8px] border-0 bg-transparent p-0',
          open ? 'text-acc' : 'text-slate-400 hover:text-slate-600'
        )}
      >
        <InfoCircleIcon />
      </button>
      {open && (
        <div
          role="dialog"
          aria-labelledby={titleId}
          className={cn(
            'absolute top-full z-30 mt-[6px] box-border flex w-[380px] max-w-[calc(100vw-120px)] flex-col rounded-[12px] border border-line-200 bg-surface text-left text-ink-900 shadow-flyout',
            align === 'end' ? 'right-0' : 'left-0'
          )}
        >
          <div className="flex flex-none items-center justify-between gap-[8px] border-b border-line-100 px-[16px] pb-[10px] pt-[12px]">
            <span id={titleId} className="text-[16px] font-semibold">
              {text.title}
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
          <div className="flex flex-col gap-[12px] px-[16px] pb-[14px] pt-[12px] text-[13px] leading-[1.45]">
            <section>
              <h3 className="m-0 mb-[4px] text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-600">{INFO_HEADINGS.whatItShows}</h3>
              <p className="m-0">
                <Rich text={text.whatItShows} />
              </p>
            </section>
            <section>
              <h3 className="m-0 mb-[4px] text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-600">{INFO_HEADINGS.howToRead}</h3>
              <ul className="m-0 flex list-disc flex-col gap-[4px] pl-[18px]">
                {text.howToRead.map((line, i) => (
                  <li key={i}>
                    <Rich text={line} />
                  </li>
                ))}
              </ul>
            </section>
            <section>
              <h3 className="m-0 mb-[4px] text-[12px] font-semibold uppercase tracking-[0.06em] text-slate-600">{INFO_HEADINGS.example}</h3>
              <p className="m-0 italic text-ink-700">{text.example}</p>
            </section>
            <section className="rounded-[8px] border border-notice-border bg-notice-tint px-[12px] py-[8px] text-notice-text">
              <h3 className="m-0 mb-[4px] text-[12px] font-semibold uppercase tracking-[0.06em] text-notice-icon">{INFO_HEADINGS.watchOut}</h3>
              <p className="m-0">{text.watchOut}</p>
            </section>
          </div>
        </div>
      )}
    </span>
  );
}
