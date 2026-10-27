import { useId } from 'react';
import type { BridgeStep, BubbleVM, ConcentrationVM, VarMember } from '@/lib/engine/view-types';
import { linear, niceTicks } from '../chart-scale';

// Inline SVG charts of the Vitals / Analysis / Profitability views (no chart library). Geometry only: values,
// labels and step kinds come from lib/engine.

export const INK = '#101B2B';
export const SLATE = '#4F5C6C';
export const SLATE4 = '#8592A3';
export const LINE = '#CDD4DC';
export const LINE1 = '#EDF0F3';
const GREEN = '#3BA37B';
const ORANGE = '#E2804A';
const DARK = '#2B3748';
/** Member colours of a cut (regions, channels, lines, segments), in member order (v4 reference `memCols`). */
export const MEMBER = ['#6B48C8', '#2453A6', '#3BA37B', '#E2804A', '#8592A3', '#B9A3E8'] as const;

/** Two-line wrap for long axis labels. */
function wrap(label: string, max = 12): [string, string] {
  if (label.length <= max) return [label, ''];
  const cut = label.lastIndexOf(' ', Math.ceil(label.length / 2) + 2);
  return cut > 0 ? [label.slice(0, cut), label.slice(cut + 1)] : [label, ''];
}

/** Running level before / after each bar; level steps change the level, like D&A from EBITDA to OP. */
function runningLevels(steps: readonly BridgeStep[]) {
  const out: { s: BridgeStep; from: number | null; to: number }[] = [];
  let run = 0;
  for (const s of steps) {
    if (s.kind === 'start' || s.kind === 'subtotal' || s.kind === 'end') {
      run = s.value;
      out.push({ s, from: null, to: s.value });
    } else {
      out.push({ s, from: run, to: run + s.value });
      run += s.value;
    }
  }
  return out;
}

export function Waterfall({ steps, width, height }: { steps: readonly BridgeStep[]; width: number; height: number }) {
  const hatch = useId().replace(/:/g, '');
  if (width < 40 || height < 40) return null;
  const padL = 46;
  const padR = 8;
  const padT = 34;
  // narrow steps (the 14-step profit bridge in a half-width panel): smaller type, sub-labels move under the axis
  const compact = (width - padL - padR) / steps.length < 60;
  const padB = compact ? 60 : 44;
  const font = compact ? 9.5 : 11;
  const bars = runningLevels(steps);
  const levels = bars.flatMap((b) => (b.from === null ? [b.to] : [b.from, b.to]));
  const lo = Math.min(...levels);
  const hi = Math.max(...levels);
  const range = hi - lo || Math.abs(hi) || 1;
  // truncated axis (README decision 4): totals start well above zero so the steps stay readable
  const y0 = lo >= 0 ? Math.max(0, lo - range * 0.6) : lo - range * 0.1;
  const ticks = niceTicks(y0, hi + range * 0.08, 4);
  const Y = linear(ticks[0] ?? y0, ticks.at(-1) ?? hi, height - padB, padT);
  const iw = width - padL - padR;
  const gap = iw / steps.length;
  const bw = Math.min(64, gap * 0.62);
  const base = Y(ticks[0] ?? y0);
  const fmt = (t: number) => {
    const scale = Math.abs(ticks.at(-1) ?? 1) >= 1e6 ? 1e6 : 1e3;
    return (t / scale).toLocaleString('en-US', { maximumFractionDigits: 0 });
  };
  return (
    <svg width={width} height={height} role="img" aria-label={steps.map((s) => `${s.label} ${s.text}`).join(', ')}>
      <defs>
        <pattern id={hatch} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="#FFFFFF" />
          <line x1="0" y1="0" x2="0" y2="6" stroke={SLATE4} strokeWidth="3" />
        </pattern>
      </defs>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={width - padR} y1={Y(t)} y2={Y(t)} stroke={LINE1} />
          <text x={padL - 6} y={Y(t) + 3} fontSize={10} textAnchor="end" fill={SLATE4}>
            {fmt(t)}
          </text>
        </g>
      ))}
      {bars.map(({ s, from, to }, i) => {
        const x = padL + gap * i + (gap - bw) / 2;
        const top = from === null ? Y(to) : Y(Math.max(from, to));
        const bottom = from === null ? base : Y(Math.min(from, to));
        const fill =
          s.kind === 'start' || s.kind === 'end'
            ? 'var(--acc)'
            : s.kind === 'subtotal'
              ? DARK
              : s.kind === 'level'
                ? SLATE4
                : s.kind === 'fx'
                  ? `url(#${hatch})`
                  : s.value >= 0
                    ? GREEN
                    : ORANGE;
        const [l1, l2] = wrap(s.label, compact ? 9 : 12);
        const subBelow = compact && s.sub !== null;
        const next = bars[i + 1];
        const labelColour = s.kind === 'up' ? '#06603F' : s.kind === 'down' ? '#C2410C' : INK;
        return (
          <g key={`${s.label}-${i}`}>
            <rect
              x={x}
              y={top}
              width={bw}
              height={Math.max(2, bottom - top)}
              rx={2}
              fill={fill}
              stroke={s.kind === 'fx' ? SLATE : undefined}
            />
            {next && next.from !== null ? (
              <line x1={x + bw} x2={x + gap} y1={Y(to)} y2={Y(to)} stroke={LINE} strokeDasharray="2 2" />
            ) : null}
            <text
              x={x + bw / 2}
              y={top - (s.sub && !subBelow ? 16 : 5)}
              fontSize={font + (compact ? 0.5 : 0)}
              fontWeight={600}
              textAnchor="middle"
              fill={labelColour}
            >
              {s.text}
            </text>
            {s.sub ? (
              <text
                x={x + bw / 2}
                y={subBelow ? height - padB + 42 : top - 4}
                fontSize={subBelow ? 9 : 9.5}
                fontWeight={subBelow ? 600 : 400}
                textAnchor="middle"
                fill={SLATE}
              >
                {s.sub}
              </text>
            ) : null}
            <text x={x + bw / 2} y={height - padB + 15} fontSize={font} textAnchor="middle" fill={SLATE}>
              {l1}
            </text>
            {l2 ? (
              <text x={x + bw / 2} y={height - padB + 27} fontSize={font} textAnchor="middle" fill={SLATE}>
                {l2}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}

/** Diverging variance bar on a shared scale; with a cut, member segments stack outwards from the centre. */
export function DivBar({
  delta,
  members,
  scale,
  width = 124,
}: {
  delta: number;
  members: readonly VarMember[];
  scale: number;
  width?: number;
}) {
  const half = width / 2;
  const w = (d: number) => (Math.min(Math.abs(d), scale) / scale) * half;
  const segs: { x: number; w: number; fill: string }[] = [];
  if (members.length === 0) {
    const ww = w(delta);
    segs.push({ x: delta >= 0 ? half : half - ww, w: ww, fill: delta >= 0 ? GREEN : ORANGE });
  } else {
    let right = half;
    let left = half;
    members.forEach((m, i) => {
      const ww = w(m.delta);
      const fill = MEMBER[i % MEMBER.length] ?? SLATE4;
      if (m.delta >= 0) {
        segs.push({ x: right, w: ww, fill });
        right += ww;
      } else {
        left -= ww;
        segs.push({ x: left, w: ww, fill });
      }
    });
  }
  return (
    <svg width={width} height={11} aria-hidden="true" style={{ verticalAlign: 'middle' }}>
      <rect x={0} y={1} width={width} height={9} rx={2} fill={LINE1} />
      {segs.map((s, i) => (
        <rect key={i} x={Math.max(0, s.x)} y={1} width={Math.min(s.w, width)} height={9} fill={s.fill} />
      ))}
      <line x1={half} x2={half} y1={0} y2={11} stroke="rgba(16,27,43,.45)" />
    </svg>
  );
}

export function ShareBars({ vm, width, height }: { vm: ConcentrationVM; width: number; height: number }) {
  if (width < 40 || height < 40) return null;
  const labW = 92;
  const rowH = Math.min(64, (height - 8) / vm.levels.length);
  const bw = width - labW - 4;
  return (
    <svg width={width} height={height} role="img" aria-label="Share by profit level">
      {vm.levels.map((lvl, r) => {
        let x = labW;
        const y = r * rowH + 8;
        return (
          <g key={lvl.label}>
            <text x={0} y={y + rowH * 0.42} fontSize={12} fontWeight={500} fill={INK}>
              {lvl.label}
            </text>
            {lvl.segments.map((s, i) => {
              const w = s.share * bw;
              const el = (
                <g key={s.key}>
                  <rect x={x} y={y} width={Math.max(0, w - 1)} height={rowH * 0.6} fill={MEMBER[i % MEMBER.length]} />
                  {w > 38 ? (
                    <text
                      x={x + w / 2}
                      y={y + rowH * 0.36}
                      fontSize={11}
                      fontWeight={600}
                      textAnchor="middle"
                      fill="#FFFFFF"
                    >
                      {s.text}
                    </text>
                  ) : null}
                </g>
              );
              x += w;
              return el;
            })}
          </g>
        );
      })}
    </svg>
  );
}

/** Greedy label stacking: a label whose box would overlap an earlier one moves up by one label height (34 px). */
function labelLift(anchors: readonly { x: number; y: number }[]): number[] {
  const placed: { x: number; y: number }[] = [];
  return anchors.map((a) => {
    let lift = 0;
    while (placed.some((p) => Math.abs(p.x - a.x) < 130 && Math.abs(p.y - (a.y - lift)) < 32)) lift += 34;
    placed.push({ x: a.x, y: a.y - lift });
    return lift;
  });
}

export function Bubble({ vm, width, height }: { vm: BubbleVM; width: number; height: number }) {
  const arrow = useId().replace(/:/g, '');
  if (width < 60 || height < 60 || vm.points.length === 0) return null;
  const padL = 52;
  const padR = 24;
  const padT = 24;
  const padB = 34;
  const xs = [...vm.points.flatMap((p) => [p.x, p.trail?.x ?? p.x]), vm.ref.x];
  const ys = [...vm.points.flatMap((p) => [p.y, p.trail?.y ?? p.y]), vm.ref.y];
  const span = (a: number[]) => Math.max(...a) - Math.min(...a) || 0.02;
  const xt = niceTicks(Math.min(...xs) - span(xs) * 0.35, Math.max(...xs) + span(xs) * 0.35, 4);
  const yt = niceTicks(Math.min(...ys) - span(ys) * 0.4, Math.max(...ys) + span(ys) * 0.4, 4);
  const X = linear(xt[0] ?? 0, xt.at(-1) ?? 1, padL, width - padR);
  const Y = linear(yt[0] ?? 0, yt.at(-1) ?? 1, height - padB, padT);
  const sMax = Math.max(...vm.points.map((p) => p.size), 1);
  const pct = (v: number) => `${(v * 100).toFixed(Math.abs(span(xs)) < 0.05 ? 1 : 0)}%`;
  const [tl, tr, bl, br] = vm.quadrants;
  const lift = labelLift(vm.points.map((p) => ({ x: X(p.x), y: Y(p.y) - (8 + 18 * Math.sqrt(p.size / sMax)) })));
  return (
    <svg width={width} height={height} role="img" aria-label={vm.points.map((p) => p.detail).join('; ')}>
      <defs>
        <marker id={arrow} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
          <path d="M0 0 L8 4 L0 8 z" fill={SLATE4} />
        </marker>
      </defs>
      {xt.map((t) => (
        <text key={`x${t}`} x={X(t)} y={height - padB + 16} fontSize={10.5} textAnchor="middle" fill={SLATE4}>
          {pct(t)}
        </text>
      ))}
      {yt.map((t) => (
        <g key={`y${t}`}>
          <line x1={padL} x2={width - padR} y1={Y(t)} y2={Y(t)} stroke={LINE1} />
          <text x={padL - 6} y={Y(t) + 3} fontSize={10.5} textAnchor="end" fill={SLATE4}>
            {(t * 100).toFixed(1)}%
          </text>
        </g>
      ))}
      <text x={(padL + width - padR) / 2} y={height - 4} fontSize={11} textAnchor="middle" fill={SLATE}>
        Net revenue growth vs PY (constant currency)
      </text>
      <text
        x={12}
        y={(padT + height - padB) / 2}
        fontSize={11}
        textAnchor="middle"
        fill={SLATE}
        transform={`rotate(-90 12 ${(padT + height - padB) / 2})`}
      >
        Contribution margin %
      </text>
      <line x1={X(vm.ref.x)} x2={X(vm.ref.x)} y1={padT} y2={height - padB} stroke={SLATE4} strokeDasharray="4 3" />
      <line x1={padL} x2={width - padR} y1={Y(vm.ref.y)} y2={Y(vm.ref.y)} stroke={SLATE4} strokeDasharray="4 3" />
      <text x={X(vm.ref.x) + 4} y={padT + 10} fontSize={10.5} fill={SLATE}>
        {vm.ref.xText}
      </text>
      <text x={width - padR - 4} y={Y(vm.ref.y) - 5} fontSize={10.5} textAnchor="end" fill={SLATE}>
        {vm.ref.yText}
      </text>
      {[
        [tl, padL + 8, padT + 26, 'start'],
        [tr, width - padR - 6, padT + 26, 'end'],
        [bl, padL + 8, height - padB - 8, 'start'],
        [br, width - padR - 6, height - padB - 8, 'end'],
      ].map(([t, x, y, a]) => (
        <text
          key={String(t)}
          x={Number(x)}
          y={Number(y)}
          fontSize={12}
          fontStyle="italic"
          textAnchor={a as 'start' | 'end'}
          fill={SLATE4}
        >
          {t}
        </text>
      ))}
      {vm.points.map((p, i) => {
        const r = 8 + 18 * Math.sqrt(p.size / sMax);
        const c = MEMBER[i % MEMBER.length] ?? SLATE4;
        return (
          <g key={p.key}>
            <title>{p.detail}</title>
            {p.trail ? (
              <>
                <line
                  x1={X(p.trail.x)}
                  y1={Y(p.trail.y)}
                  x2={X(p.x)}
                  y2={Y(p.y)}
                  stroke={SLATE4}
                  strokeWidth={1.2}
                  markerEnd={`url(#${arrow})`}
                />
                <circle cx={X(p.trail.x)} cy={Y(p.trail.y)} r={4} fill="#FFFFFF" stroke={SLATE4} strokeWidth={1.5} />
              </>
            ) : null}
            <circle cx={X(p.x)} cy={Y(p.y)} r={r} fill={c} fillOpacity={0.82} stroke="#FFFFFF" strokeWidth={1.5} />
            <text
              x={X(p.x)}
              y={Y(p.y) - r - 18 - (lift[i] ?? 0)}
              fontSize={12}
              fontWeight={600}
              textAnchor="middle"
              fill={INK}
            >
              {p.label}
            </text>
            <text x={X(p.x)} y={Y(p.y) - r - 5 - (lift[i] ?? 0)} fontSize={11} textAnchor="middle" fill={SLATE}>
              {p.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
