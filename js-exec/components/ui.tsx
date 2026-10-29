import type { Rich } from '@/lib/engine/view';
import { barGeometry } from './bars';

// Small presentational pieces shared by the cards and the pop-ups. No state, no business logic.

/** Tooltip attributes read by ExecApp's delegated tooltip (v5 data-tip as plain text: bold title + body, the body
 *  carrying its own separator; no HTML strings). */
export const tip = (title: string, body: string) => ({ 'data-tip-title': title, 'data-tip-body': body });

export function RichText({ rich }: { rich: Rich }) {
  return <>{rich.map((s, i) => (s.strong ? <b key={i}>{s.text}</b> : <span key={i}>{s.text}</span>))}</>;
}

/** v5 inline SVG icons (no font glyphs): upright "i" inside the button's own circle; binoculars for the drill path. */
export function InfoIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M10 8.6v5.2" />
      <circle cx="10" cy="5.6" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function DrillIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="5.8" cy="13" r="3" />
      <circle cx="14.2" cy="13" r="3" />
      <path d="M8.8 12.3h2.4M6.6 10.1 7.4 5.6h2.1l.4 2.6M13.4 10.1 12.6 5.6h-2.1l-.4 2.6" />
    </svg>
  );
}

const SIDE = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const SideIcons = {
  filters: (
    <svg viewBox="0 0 20 20" {...SIDE} aria-hidden="true">
      <path d="M3 5h14M5.5 10h9M8 15h4" />
    </svg>
  ),
  how: (
    <svg viewBox="0 0 20 20" {...SIDE} aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path d="M7.8 8a2.2 2.2 0 1 1 3.1 2c-.7.4-.9.8-.9 1.5" />
      <circle cx="10" cy="14.2" r=".6" fill="currentColor" />
    </svg>
  ),
  more: (
    <svg viewBox="0 0 20 20" {...SIDE} aria-hidden="true">
      <rect x="3" y="3" width="6" height="6" rx="1.5" />
      <rect x="11" y="3" width="6" height="6" rx="1.5" />
      <rect x="3" y="11" width="6" height="6" rx="1.5" />
      <path d="M14 12v4M12 14h4" />
    </svg>
  ),
};

/** 13-week bars with the dotted target (E-29). Card: stretched to the CSS box; pop-up: fixed size with week labels. */
export function Spark({
  values,
  target,
  width,
  height,
  labels,
  stretch,
}: {
  values: readonly (number | null)[];
  target: number | null;
  width: number;
  height: number;
  labels?: readonly string[];
  stretch?: boolean;
}) {
  const g = barGeometry(values, target, width, height, labels);
  return (
    <svg
      className="spark"
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio={stretch ? 'none' : undefined}
      aria-hidden="true"
    >
      {g.rects.map((r, i) => (
        <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx="1" className={r.current ? 'cur' : undefined} />
      ))}
      {g.labels.map((l) => (
        <text key={l.text} x={l.x} y={height} textAnchor="middle" className={l.current ? 'cur' : undefined}>
          {l.text}
        </text>
      ))}
      {g.targetY === null ? null : <path d={`M0 ${g.targetY} H${width}`} />}
    </svg>
  );
}

export function MixBar({ mix }: { mix: readonly [number, number, number] }) {
  return (
    <div className="mixbar" aria-hidden="true">
      <i className="a" style={{ width: `${mix[0]}%` }} />
      <i className="b" style={{ width: `${mix[1]}%` }} />
      <i className="c" style={{ width: `${mix[2]}%` }} />
    </div>
  );
}
