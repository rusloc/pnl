import type { ReactNode } from 'react';
import { RANK_MODES } from '@/lib/engine/copy';
import type { CardCode } from '@/lib/engine/copy';
import type { RankMode } from '@/lib/engine/selection';
import type { Tone } from '@/lib/engine/view';

// Presentational primitives: a card (title + ⓘ + body, nothing else — §3.11), the ⓘ and binoculars buttons, the
// Worst 5 | Top 5 switch and a scrolling table. They render view-model strings; nothing here computes.

export type OpenInfo = (code: CardCode, el: HTMLElement) => void;

export function InfoButton({ code, title, onInfo }: { code: CardCode; title: string; onInfo: OpenInfo }) {
  return (
    <button
      type="button"
      className="info"
      aria-label={`Definition of ${title}`}
      aria-haspopup="dialog"
      onClick={(e) => onInfo(code, e.currentTarget)}
    >
      i
    </button>
  );
}

/** The glyph of public/icons/binoculars.svg (svg-designer), inline so it takes currentColor. */
export function Binoculars() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true" focusable="false">
      <path
        d="M2.5 2.5L5.5 2.5L5.5 6.5L6.5 6.5L6.5 11.5A2 2 0 0 1 4.5 13.5L3.5 13.5A2 2 0 0 1 1.5 11.5L1.5 6.5L2.5 6.5ZM13.5 2.5L10.5 2.5L10.5 6.5L9.5 6.5L9.5 11.5A2 2 0 0 0 11.5 13.5L12.5 13.5A2 2 0 0 0 14.5 11.5L14.5 6.5L13.5 6.5ZM6.5 9.5H9.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Card({
  code,
  title,
  onInfo,
  className = '',
  tools,
  children,
}: {
  code: CardCode;
  title: string;
  onInfo: OpenInfo;
  className?: string;
  tools?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className={`card glass ${className}`} aria-labelledby={`h-${code}`} data-card={code}>
      <header className="card-h">
        <h2 id={`h-${code}`}>{title}</h2>
        <div className="card-tools">
          {tools}
          <InfoButton code={code} title={title} onInfo={onInfo} />
        </div>
      </header>
      <div className="card-b">{children}</div>
    </section>
  );
}

export function RankSwitch({
  label,
  mode,
  onChange,
}: {
  label: string;
  mode: RankMode;
  onChange: (m: RankMode) => void;
}) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {(['worst', 'top'] as const).map((m) => (
        <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => onChange(m)}>
          {RANK_MODES[m]}
        </button>
      ))}
    </div>
  );
}

export const toneClass = (t: Tone | undefined) => (t ? `t-${t}` : '');

export function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
