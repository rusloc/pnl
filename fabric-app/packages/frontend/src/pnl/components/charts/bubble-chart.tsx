// Growth × margin by region (redesign v4 Profitability page 2): x = NR growth
// vs prior year at constant currency, y = CM %, bubble area = NR; dashed
// company reference lines with their values, quadrant labels inside the plot,
// "CM % - growth" labels, native hover detail; prior-year → actual trails
// (hollow dot, arrow) once a point carries a trail. SVG sized to its container.
import { useRef } from 'react';

import { useSize } from '../../hooks/use-size';
import { fmtPct } from '../../model/format';
import type { Bubble } from '../../model/types';

const PAD = { left: 52, right: 20, top: 18, bottom: 40 };

function niceDomain(values: number[], refValue: number | null, minSpan: number): [number, number] {
  const all = refValue === null ? values : [...values, refValue];
  const lo = Math.min(...all);
  const hi = Math.max(...all);
  const span = Math.max(hi - lo, minSpan);
  const pad = span * 0.2;
  return [lo - pad, hi + pad];
}

export function BubbleChart({ bubble }: { bubble: Bubble }) {
  const ref = useRef<HTMLDivElement>(null);
  const { width, height } = useSize(ref);
  const w = Math.max(0, width - PAD.left - PAD.right);
  const h = Math.max(0, height - PAD.top - PAD.bottom);
  const points = bubble.points;
  const xs = points.flatMap((p) => [p.x, ...(p.trail ? [p.trail.x] : [])]);
  const ys = points.flatMap((p) => [p.y, ...(p.trail ? [p.trail.y] : [])]);
  const [x0, x1] = xs.length > 0 ? niceDomain(xs, bubble.ref?.x ?? null, 0.1) : [-0.1, 0.3];
  const [y0, y1] = ys.length > 0 ? niceDomain(ys, bubble.ref?.y ?? null, 0.1) : [0.3, 0.6];
  const sx = (v: number) => PAD.left + ((v - x0) / (x1 - x0)) * w;
  const sy = (v: number) => PAD.top + h - ((v - y0) / (y1 - y0)) * h;
  const maxSize = Math.max(1e-9, ...points.map((p) => p.size));
  const radius = (size: number) => 10 + Math.sqrt(size / maxSize) * Math.min(w, h) * 0.09;
  const ticks = (a: number, b: number, n: number) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);

  if (w < 40 || h < 40) return <div ref={ref} className="min-h-0 flex-auto" data-testid="bubble-chart" />;
  return (
    <div ref={ref} className="relative min-h-0 flex-auto" data-testid="bubble-chart">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Growth × margin by region" className="absolute inset-0 font-ledger">
        {ticks(x0, x1, 4).map((t) => (
          <g key={`x${t}`}>
            <line x1={sx(t)} x2={sx(t)} y1={PAD.top} y2={PAD.top + h} stroke="#EDF0F3" />
            <text x={sx(t)} y={PAD.top + h + 16} fontSize={10} textAnchor="middle" fill="#8592A3">
              {fmtPct(t * 100, true, 0)}
            </text>
          </g>
        ))}
        {ticks(y0, y1, 4).map((t) => (
          <g key={`y${t}`}>
            <line x1={PAD.left} x2={PAD.left + w} y1={sy(t)} y2={sy(t)} stroke="#EDF0F3" />
            <text x={PAD.left - 6} y={sy(t) + 3} fontSize={10} textAnchor="end" fill="#8592A3">
              {fmtPct(t * 100, false, 0)}
            </text>
          </g>
        ))}
        <text x={PAD.left + w / 2} y={height - 6} fontSize={10.5} textAnchor="middle" fill="#4F5C6C">
          Net revenue growth vs prior year, constant currency
        </text>
        <text x={12} y={PAD.top + h / 2} fontSize={10.5} textAnchor="middle" fill="#4F5C6C" transform={`rotate(-90 12 ${PAD.top + h / 2})`}>
          Contribution margin %
        </text>
        {bubble.ref && (
          <g data-testid="bubble-ref">
            <line x1={sx(bubble.ref.x)} x2={sx(bubble.ref.x)} y1={PAD.top} y2={PAD.top + h} stroke="#101B2B" strokeDasharray="4 3" opacity={0.6} />
            <line x1={PAD.left} x2={PAD.left + w} y1={sy(bubble.ref.y)} y2={sy(bubble.ref.y)} stroke="#101B2B" strokeDasharray="4 3" opacity={0.6} />
            <text x={sx(bubble.ref.x) + 4} y={PAD.top + 10} fontSize={10} fill="#4F5C6C">
              {bubble.ref.xText}
            </text>
            <text x={PAD.left + w - 4} y={sy(bubble.ref.y) - 4} fontSize={10} textAnchor="end" fill="#4F5C6C">
              {bubble.ref.yText}
            </text>
            {(
              [
                [PAD.left + 6, PAD.top + h / 2 - 6, bubble.quadrants[0], 'start'],
                [PAD.left + w - 6, PAD.top + h / 2 - 6, bubble.quadrants[1], 'end'],
                [PAD.left + 6, PAD.top + h - 6, bubble.quadrants[2], 'start'],
                [PAD.left + w - 6, PAD.top + h - 6, bubble.quadrants[3], 'end'],
              ] as const
            ).map(([x, y, label, anchor]) => (
              <text key={label} x={x} y={y} fontSize={10} textAnchor={anchor} fill="#8592A3" fontStyle="italic">
                {label}
              </text>
            ))}
          </g>
        )}
        {points.map((p) => (
          <g key={p.key} data-testid="bubble-point">
            {p.trail && (
              <g data-testid="bubble-trail">
                <line x1={sx(p.trail.x)} y1={sy(p.trail.y)} x2={sx(p.x)} y2={sy(p.y)} stroke="#8592A3" strokeWidth={1} />
                <circle cx={sx(p.trail.x)} cy={sy(p.trail.y)} r={4} fill="#FFFFFF" stroke="#8592A3" />
              </g>
            )}
            <circle cx={sx(p.x)} cy={sy(p.y)} r={radius(p.size)} fill="var(--acc)" fillOpacity={0.28} stroke="var(--acc)" strokeWidth={1.5}>
              <title>{p.detail}</title>
            </circle>
            <text x={sx(p.x)} y={sy(p.y) - radius(p.size) - 14} fontSize={11.5} fontWeight={600} textAnchor="middle" fill="#101B2B">
              {p.label}
            </text>
            <text x={sx(p.x)} y={sy(p.y) - radius(p.size) - 3} fontSize={10} textAnchor="middle" fill="#4F5C6C">
              {p.text}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
