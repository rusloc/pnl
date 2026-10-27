// AI assistant (ADR-0009): the entry button in the title row (next to the
// applied-filters funnel, Track B page-top kept) and a right-docked panel with
// the conversation. It is labelled as an AI assistant (transparency), every
// tool result is a card with "Open in view" (the validated filters become the
// app's filters and the view switches), and loading / timeout / error states
// are entries of the log. Closes on Escape and ✕; focus goes to the input on
// open and back to the button on close (N-08).
import { type FormEvent, type KeyboardEvent, useEffect, useRef, useState } from 'react';

import { CHAT_BOUNDS } from '@rayfin-app/shared';

import { cn } from '@/lib/utils';

import { CHAT_BUTTON_ID, CHAT_TITLE, CHAT_TRANSPARENCY, STARTER_QUESTIONS } from '../chat/chat-copy';
import type { ChatEntry } from '../chat/chat-session';
import type { ChatHandle } from '../chat/use-chat';
import type { FilterState, ViewKey } from '../model/types';
import { CloseIcon, SendIcon, SparkleIcon } from './ui/icons';

interface ChatButtonProps {
  open: boolean;
  onToggle: () => void;
}

export function ChatButton({ open, onToggle }: ChatButtonProps) {
  return (
    <button
      id={CHAT_BUTTON_ID}
      type="button"
      aria-haspopup="dialog"
      aria-expanded={open}
      title={`${CHAT_TITLE} (preview)`}
      onClick={onToggle}
      className={cn(
        'flex h-[28px] cursor-pointer items-center gap-[6px] rounded-[8px] border-0 px-[10px] font-[inherit] text-[12px] font-medium',
        open ? 'bg-acc-t text-acc' : 'bg-ground text-slate-600 hover:bg-[#EDF0F3]'
      )}
    >
      <SparkleIcon />
      {CHAT_TITLE}
    </button>
  );
}

interface ChatPanelProps {
  chat: ChatHandle;
  onOpenInView: (state: FilterState, view: ViewKey) => void;
  onClose: () => void;
}

export function ChatPanel({ chat, onOpenInView, onClose }: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const { state } = chat;

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      document.getElementById(CHAT_BUTTON_ID)?.focus();
    };
  }, []);

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

  // New entries scroll into view; jsdom has no scrollTo, so guard it.
  useEffect(() => {
    const log = logRef.current;
    if (log && typeof log.scrollTo === 'function') log.scrollTo({ top: log.scrollHeight });
  }, [state.entries.length, state.busy]);

  const submit = (text: string) => {
    if (state.busy !== null || text.trim().length === 0) return;
    setDraft('');
    void chat.send(text);
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(draft);
  };
  const onKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit(draft);
    }
  };

  return (
    <aside
      role="dialog"
      aria-label={CHAT_TITLE}
      data-testid="chat-panel"
      className="absolute bottom-0 right-0 top-0 z-30 box-border flex w-[420px] max-w-[calc(100vw-80px)] flex-col border-l border-line-200 bg-surface shadow-flyout"
    >
      <div className="flex flex-none items-center justify-between gap-[8px] border-b border-line-100 px-[16px] pb-[10px] pt-[12px]">
        <div className="flex min-w-0 items-center gap-[8px]">
          <span className="text-acc">
            <SparkleIcon />
          </span>
          <h2 className="m-0 text-[16px] font-semibold">{CHAT_TITLE}</h2>
          <span className="rounded-[6px] bg-ground px-[6px] py-[2px] text-[11px] font-medium uppercase tracking-[0.06em] text-slate-600">Preview</span>
        </div>
        <div className="flex items-center gap-[4px]">
          {state.entries.length > 0 && (
            <button
              type="button"
              onClick={chat.clear}
              disabled={state.busy !== null}
              className="h-[40px] cursor-pointer border-0 bg-transparent px-[8px] font-[inherit] text-[13px] text-acc underline disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-[40px] w-[40px] flex-none cursor-pointer items-center justify-center rounded-[8px] border-0 bg-ground"
          >
            <CloseIcon />
          </button>
        </div>
      </div>

      <p className="m-0 flex-none border-b border-line-100 bg-subtle px-[16px] py-[8px] text-[12px] leading-[1.4] text-slate-600">{CHAT_TRANSPARENCY}</p>

      <div ref={logRef} role="log" aria-live="polite" aria-relevant="additions" className="flex min-h-0 flex-auto flex-col gap-[10px] overflow-auto px-[16px] py-[12px]">
        {state.entries.length === 0 && (
          <div className="flex flex-col gap-[8px]">
            <span className="text-[13px] text-slate-600">Ask about the figures you are looking at, or start with one of these:</span>
            {STARTER_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => submit(q)}
                className="cursor-pointer rounded-[8px] border border-line-300 bg-surface px-[12px] py-[8px] text-left font-[inherit] text-[13px] text-ink-900 hover:bg-subtle"
              >
                {q}
              </button>
            ))}
          </div>
        )}
        {state.entries.map((entry) => (
          <Entry key={entry.id} entry={entry} onOpenInView={onOpenInView} />
        ))}
        {state.busy !== null && (
          <p role="status" aria-busy="true" className="m-0 flex items-center gap-[8px] text-[13px] text-slate-600">
            <span aria-hidden="true" className="inline-block h-[10px] w-[10px] animate-pulse rounded-full bg-acc" />
            {state.busy}
          </p>
        )}
      </div>

      <form onSubmit={onSubmit} className="flex flex-none items-end gap-[8px] border-t border-line-100 px-[16px] py-[10px]">
        <textarea
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={onKey}
          rows={2}
          maxLength={CHAT_BOUNDS.maxUserChars}
          aria-label="Ask about the P&L"
          placeholder="Ask about the P&L… (Enter to send)"
          disabled={state.busy !== null}
          className="box-border min-h-[48px] flex-auto resize-none rounded-[8px] border border-line-300 bg-surface px-[10px] py-[8px] font-[inherit] text-[14px] text-ink-900 disabled:bg-subtle"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={state.busy !== null || draft.trim().length === 0}
          className="flex h-[40px] w-[40px] flex-none cursor-pointer items-center justify-center rounded-[8px] border-0 bg-acc text-surface disabled:cursor-not-allowed disabled:opacity-40"
        >
          <SendIcon />
        </button>
      </form>
    </aside>
  );
}

function Entry({ entry, onOpenInView }: { entry: ChatEntry; onOpenInView: ChatPanelProps['onOpenInView'] }) {
  switch (entry.kind) {
    case 'user':
      return (
        <div data-testid="chat-user" className="max-w-[88%] self-end whitespace-pre-wrap rounded-[12px] rounded-br-[4px] bg-acc-t px-[12px] py-[8px] text-[14px] text-ink-900">
          {entry.text}
        </div>
      );
    case 'assistant':
      return (
        <div data-testid="chat-assistant" className="max-w-[92%] self-start whitespace-pre-wrap rounded-[12px] rounded-bl-[4px] bg-subtle px-[12px] py-[8px] text-[14px] leading-[1.45] text-ink-900">
          {entry.text}
        </div>
      );
    case 'error':
      return (
        <div role="alert" data-testid="chat-error" className="rounded-[8px] border border-notice-border bg-notice-tint px-[12px] py-[8px] text-[13px] text-notice-text">
          {entry.text}
        </div>
      );
    case 'tool': {
      const r = entry.result;
      const target = r.filter;
      return (
        <div data-testid="chat-tool" className={cn('flex flex-col gap-[4px] rounded-[8px] border px-[12px] py-[8px] text-[13px]', r.error ? 'border-notice-border bg-notice-tint text-notice-text' : 'border-line-200 bg-surface')}>
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-slate-600">{r.label}</span>
          <span className="font-medium">{r.summary}</span>
          <span className={cn('text-[12px]', r.error ? '' : 'text-slate-600')}>{r.detail}</span>
          {target !== null && r.error === null && (
            <button
              type="button"
              onClick={() => onOpenInView(target, r.view)}
              className="mt-[2px] h-[32px] w-fit cursor-pointer rounded-[8px] border border-acc bg-surface px-[10px] font-[inherit] text-[13px] font-medium text-acc hover:bg-acc-t"
            >
              Open in view
            </button>
          )}
        </div>
      );
    }
  }
}
