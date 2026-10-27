import { Fragment } from 'react';
import type { ReactNode } from 'react';
import { fmtAxis, fmtUnit } from '@/lib/sales/format';
import type { Unit } from '@/lib/sales/format';
import type { Chart, SeriesRole } from '@/lib/sales/view-model';
import { extent, linear, niceTicks } from '../chart-scale';

// Inline SVG charts (design-tokens §7; no chart library). Geometry only: values, labels and series roles come from
// lib/sales. Marks are decorative for assistive tech; each chart carries an aria-label and the card title.

export const C = {
  ink: '#111111',
  teal: '#128C94',
  g600: '#5C5C58',
  g400: '#7F7E79',
  g300: '#BDBBB5',
  line: '#CFCDC6',
  panel2: '#DEDDD8',
  accent: '#FFD54A',
  white: '#FFFFFF',
  marker: '#2F2F2D',
} as const;

const STROKE: Record<SeriesRole, { color: string; width: number; dash?: string; dots: boolean }> = {
  actual: { color: C.ink, width: 2, dots: true },
  budget: { color: C.teal, width: 2, dots: true },
  py: { color: C.g400, width: 1.5, dash: '4 3', dots: false },
  c1: { color: C.ink, width: 2, dots: true },
  c2: { color: C.teal, width: 2, dots: true },
  c3: { color: C.g400, width: 2, dots: false },
  c4: { color: C.g300, width: 2, dots: false },
  c5: { color: C.ink, width: 1, dash: '2 2', dots: false },
};
export const FILL: Record<SeriesRole, { fill: string; stroke?: string }> = {
  actual: { fill: C.ink },
  budget: { fill: C.teal },
  py: { fill: 'none', stroke: C.g400 },
  c1: { fill: C.ink },
  c2: { fill: C.teal },
  c3: { fill: C.g400 },
  c4: { fill: C.g300 },
  c5: { fill: C.white, stroke: C.ink },
};
const onDark = (role: SeriesRole) => role === 'actual' || role === 'c1' || role === 'c2' || role === 'budget';

interface Size {
  width: number;
  height: number;
}

function T({
  x,
  y,
  children,
  anchor = 'start',
  fill = C.g600,
  size = 11,
  weight = 400,
}: {
  x: number;
  y: number;
  children: ReactNode;
  anchor?: 'start' | 'middle' | 'end';
  fill?: string;
  size?: number;
  weight?: number;
}) {
  return (
    <text x={x} y={y} fontSize={size} fill={fill} textAnchor={anchor} fontWeight={weight}>
      {children}
    </text>
  );
}

/** Polyline points split at blanks (open months are never interpolated, design-tokens §7). */
function segments(values: readonly (number | null)[], X: (i: number) => number, Y: (v: number) => number): string[] {
  const out: string[] = [];
  let cur: string[] = [];
  values.forEach((v, i) => {
    if (v === null) {
      if (cur.length) out.push(cur.join(' '));
      cur = [];
    } else cur.push(`${X(i).toFixed(1)},${Y(v).toFixed(1)}`);
  });
  if (cur.length) out.push(cur.join(' '));
  return out;
}

function YAxis({
  ticks,
  Y,
  x,
  unit,
  x2,
}: {
  ticks: number[];
  Y: (v: number) => number;
  x: number;
  unit: Unit;
  x2: number;
}) {
  const base = ticks[0] ?? 0;
  return (
    <>
      <line x1={x} x2={x2} y1={Y(base)} y2={Y(base)} stroke={C.line} />
      {ticks.map((t) => (
        <T key={t} x={x - 6} y={Y(t) + 4} anchor="end">
          {fmtAxis(unit, t)}
        </T>
      ))}
    </>
  );
}

function XLabels({
  labels,
  X,
  y,
  sparse,
  edges = false,
}: {
  labels: readonly string[];
  X: (i: number) => number;
  y: number;
  sparse: boolean;
  edges?: boolean; // last label flush right (line charts end on the plot edge)
}) {
  const n = labels.length;
  return (
    <>
      {labels.map((l, i) =>
        l && !(sparse && (n - 1 - i) % 2) ? (
          <T key={i} x={X(i)} y={y} anchor={edges && i === n - 1 ? 'end' : 'middle'}>
            {l}
          </T>
        ) : null,
      )}
    </>
  );
}

/** Story callout (design-tokens §5): placed in the empty half of the plot at the event's month. */
function Callout({ x, text, width, top }: { x: number; text: string; width: number; top: number }) {
  const w = text.length * 6.4 + 20;
  const left = Math.min(Math.max(x + 8, 0), width - w);
  return (
    <g pointerEvents="none">
      <line x1={x} x2={x} y1={0} y2={1000} stroke={C.marker} strokeDasharray="2 2" />
      <rect x={left} y={top} width={w} height={22} fill={C.accent} stroke={C.white} strokeWidth={2} />
      <T x={left + 10} y={top + 15} fill={C.ink} size={12} weight={600}>
        {text}
      </T>
    </g>
  );
}

function MonthHits({
  months,
  X,
  slot,
  height,
  onMonth,
}: {
  months: number[] | null;
  X: (i: number) => number;
  slot: number;
  height: number;
  onMonth?: (m: number) => void;
}) {
  if (!months || !onMonth) return null;
  return (
    <>
      {months.map((m, i) => (
        <rect
          key={m}
          x={X(i) - slot / 2}
          y={0}
          width={slot}
          height={height}
          fill="transparent"
          style={{ cursor: 'pointer' }}
          onClick={() => onMonth(m)}
        >
          <title>Select this month</title>
        </rect>
      ))}
    </>
  );
}

export function LineChart({
  chart,
  width,
  height,
  onMonth,
}: Size & { chart: Extract<Chart, { kind: 'line' }>; onMonth?: (m: number) => void }) {
  const padL = 44;
  const padR = 10;
  const padT = 6;
  const padB = 16;
  const [min, hi] = extent(chart.series.flatMap((s) => s.values));
  const ticks = niceTicks(chart.zeroBased ? 0 : min, hi, 2);
  const Y = linear(ticks[0] ?? 0, ticks.at(-1) ?? 1, height - padB, padT);
  const n = chart.x.length;
  const step = (width - padL - padR) / Math.max(n - 1, 1);
  const X = (i: number) => padL + i * step;
  const first = chart.series[0];
  const sel = chart.selected !== null && first ? first.values[chart.selected] : null;
  const atCallout = chart.callout ? chart.series.map((s) => s.values[chart.callout?.index ?? 0] ?? null) : [];
  const callout = chart.callout
    ? { ...chart.callout, low: atCallout.every((v) => v === null || Y(v) > (height - padB) / 2) }
    : null;
  return (
    <svg width={width} height={height} role="img" aria-label={chart.series.map((s) => s.name).join(', ')}>
      <YAxis ticks={ticks} Y={Y} x={padL} unit={chart.unit} x2={width - padR} />
      <XLabels labels={chart.x} X={X} y={height - 3} sparse={step < 36} edges />
      {callout ? (
        <Callout x={X(callout.index)} text={callout.text} width={width} top={callout.low ? 2 : height - padB - 26} />
      ) : null}
      {[...chart.series].reverse().map((s) => {
        const st = STROKE[s.role];
        return (
          <g key={s.name}>
            {segments(s.values, X, Y).map((pts, k) => (
              <polyline
                key={k}
                points={pts}
                fill="none"
                stroke={st.color}
                strokeWidth={st.width}
                strokeDasharray={st.dash}
                strokeLinejoin="round"
              />
            ))}
            {st.dots &&
              s.values.map((v, i) =>
                v === null ? null : <circle key={i} cx={X(i)} cy={Y(v)} r={3} fill={st.color} />,
              )}
          </g>
        );
      })}
      {sel !== null && sel !== undefined && chart.selected !== null ? (
        <circle cx={X(chart.selected)} cy={Y(sel)} r={4.5} fill={C.accent} stroke={C.ink} strokeWidth={1} />
      ) : null}
      <MonthHits months={chart.months} X={X} slot={step} height={height} onMonth={onMonth} />
    </svg>
  );
}

export function ColumnChart({
  chart,
  width,
  height,
  onMonth,
}: Size & { chart: Extract<Chart, { kind: 'columns' }>; onMonth?: (m: number) => void }) {
  const padL = 44;
  const padR = 6;
  const padT = chart.labels ? 14 : 6;
  const padB = 16;
  const n = chart.x.length;
  const totals = chart.x.map((_, i) => chart.stacks.reduce((s, st) => s + (st.values[i] ?? 0), 0));
  const [, hi] = extent([...totals, ...(chart.ghost ?? []), ...(chart.line?.values ?? [])]);
  const ticks = chart.percent ? [0, 0.5, 1] : niceTicks(0, hi, 2);
  const Y = linear(0, ticks.at(-1) ?? 1, height - padB, padT);
  const slot = (width - padL - padR) / n;
  const X = (i: number) => padL + slot * (i + 0.5);
  const bw = slot * 0.6;
  const single = chart.stacks.length === 1;
  return (
    <svg width={width} height={height} role="img" aria-label={chart.stacks.map((s) => s.name).join(', ')}>
      <YAxis ticks={ticks} Y={Y} x={padL} unit={chart.unit} x2={width - padR} />
      <XLabels labels={chart.x} X={X} y={height - 3} sparse={slot < 36} />
      {chart.x.map((_, i) => {
        let base = 0;
        const selected = chart.selected === i;
        const blank = chart.stacks.every((s) => s.values[i] === null);
        return (
          <g key={i}>
            {chart.stacks.map((s) => {
              const v = s.values[i];
              if (v === null || v === undefined || v <= 0) return null;
              const y0 = Y(base);
              base += v;
              const f = FILL[s.role];
              const fill = selected && single ? C.accent : f.fill;
              return (
                <rect
                  key={s.name}
                  x={X(i) - bw / 2}
                  y={Y(base)}
                  width={bw}
                  height={Math.max(y0 - Y(base), 0)}
                  fill={fill}
                  stroke={selected && single ? C.ink : f.stroke}
                  strokeWidth={1}
                />
              );
            })}
            {selected && !single && !blank ? (
              <rect
                x={X(i) - bw / 2 - 1.5}
                y={Y(base) - 1.5}
                width={bw + 3}
                height={Y(0) - Y(base) + 1.5}
                fill="none"
                stroke={C.accent}
                strokeWidth={2}
              />
            ) : null}
            {chart.ghost?.[i] !== null && chart.ghost?.[i] !== undefined ? (
              <rect
                x={X(i) - bw / 2 + 0.5}
                y={Y(chart.ghost[i] ?? 0)}
                width={bw - 1}
                height={Math.max(Y(0) - Y(chart.ghost[i] ?? 0), 0)}
                fill="none"
                stroke={C.g400}
                strokeWidth={1}
              />
            ) : null}
            {chart.labels?.[i] ? (
              <T x={X(i)} y={Y(base) - 4} anchor="middle" size={10}>
                {chart.labels[i]}
              </T>
            ) : null}
          </g>
        );
      })}
      {chart.line ? (
        <g>
          {segments(chart.line.values, X, Y).map((pts, k) => (
            <polyline key={k} points={pts} fill="none" stroke={C.teal} strokeWidth={2} />
          ))}
          {chart.line.values.map((v, i) =>
            v === null ? null : <circle key={i} cx={X(i)} cy={Y(v)} r={3} fill={C.teal} />,
          )}
        </g>
      ) : null}
      <MonthHits months={chart.months} X={X} slot={slot} height={height} onMonth={onMonth} />
    </svg>
  );
}

export function Bars({ chart, width, height }: Size & { chart: Extract<Chart, { kind: 'bars' }> }) {
  const labW = Math.min(150, Math.round(width * 0.35));
  const valW = Math.min(150, Math.round(width * 0.25));
  const pw = width - labW - valW;
  const rowH = height / Math.max(chart.rows.length, 1);
  const [, hi] = extent(chart.rows.flatMap((r) => [r.value, r.ghost, r.tick]));
  const X = linear(0, hi || 1, 0, pw);
  return (
    <svg width={width} height={height} role="img" aria-label={chart.rows.map((r) => `${r.label} ${r.text}`).join(', ')}>
      {chart.rows.map((r, i) => {
        const cy = i * rowH + rowH / 2;
        const bh = Math.min(10, rowH - 6);
        return (
          <g key={r.label}>
            <T x={0} y={cy + 4} fill={C.ink} size={12} weight={500}>
              {r.label}
            </T>
            <rect x={labW} y={cy - bh / 2} width={pw} height={bh} fill={C.panel2} />
            {r.value !== null ? (
              <rect x={labW} y={cy - bh / 2} width={Math.max(X(r.value), 0)} height={bh} fill={C.ink} />
            ) : null}
            {r.ghost !== null ? (
              <rect
                x={labW + 0.5}
                y={cy - bh / 2 - 2.5}
                width={Math.max(X(r.ghost), 0)}
                height={bh + 5}
                fill="none"
                stroke={C.g400}
              />
            ) : null}
            {r.tick !== null ? <rect x={labW + X(r.tick) - 1} y={cy - 7} width={2} height={14} fill={C.teal} /> : null}
            <T x={labW + pw + 8} y={cy + 4} fill={C.ink} size={12} weight={600}>
              {r.text}
            </T>
          </g>
        );
      })}
    </svg>
  );
}

export function StackedBars({ chart, width, height }: Size & { chart: Extract<Chart, { kind: 'stackedBars' }> }) {
  const labW = 70;
  const valW = 56;
  const pw = width - labW - valW;
  const rowH = Math.min(height / Math.max(chart.rows.length, 1), 34);
  const hi = Math.max(...chart.rows.map((r) => r.values.reduce((s, v) => s + v, 0)), 1);
  const X = linear(0, hi, 0, pw);
  return (
    <svg width={width} height={height} role="img" aria-label={chart.rows.map((r) => `${r.label} ${r.text}`).join(', ')}>
      {chart.rows.map((r, i) => {
        const cy = i * rowH + rowH / 2;
        let x = labW;
        return (
          <g key={r.label}>
            <T x={0} y={cy + 4} fill={C.ink} size={12} weight={500}>
              {r.label}
            </T>
            {r.values.map((v, k) => {
              const seg = chart.segments[k];
              if (!seg || v <= 0) return null;
              const w = X(v);
              const f = FILL[seg.role];
              const el = (
                <Fragment key={k}>
                  <rect x={x} y={cy - 9} width={w} height={18} fill={f.fill} stroke={f.stroke} />
                  {w > 34 ? (
                    <T
                      x={x + w / 2}
                      y={cy + 4}
                      anchor="middle"
                      fill={onDark(seg.role) ? C.white : C.ink}
                      size={10}
                      weight={600}
                    >
                      {fmtUnit(chart.unit, v)}
                    </T>
                  ) : null}
                </Fragment>
              );
              x += w;
              return el;
            })}
            <T x={labW + pw + 8} y={cy + 4} fill={C.ink} size={12} weight={600}>
              {r.text}
            </T>
          </g>
        );
      })}
    </svg>
  );
}

export function Funnel({ chart, width, height }: Size & { chart: Extract<Chart, { kind: 'funnel' }> }) {
  const labW = 112;
  const textW = Math.min(250, width * 0.5);
  const pw = width - labW - textW;
  const rowH = height / Math.max(chart.rows.length, 1);
  const hi = Math.max(...chart.rows.map((r) => r.value + (r.lost ?? 0)), 1);
  const X = linear(0, hi, 0, pw);
  return (
    <svg width={width} height={height} role="img" aria-label={chart.rows.map((r) => `${r.label} ${r.text}`).join(', ')}>
      {chart.rows.map((r, i) => {
        const cy = i * rowH + rowH / 2;
        const bh = Math.min(12, rowH - 6);
        return (
          <g key={r.label}>
            <T x={0} y={cy + 4} fill={C.ink} size={12} weight={500}>
              {r.label}
            </T>
            <rect x={labW} y={cy - bh / 2} width={pw} height={bh} fill={C.panel2} />
            <rect x={labW} y={cy - bh / 2} width={X(r.value)} height={bh} fill={C.ink} />
            {r.lost ? <rect x={labW + X(r.value)} y={cy - 2} width={X(r.lost)} height={4} fill={C.g400} /> : null}
            <text x={labW + pw + 8} y={cy + 4} fontSize={12} fill={C.ink} fontWeight={600}>
              {r.text}
              <tspan fill={C.g600} fontWeight={400} fontSize={11}>
                {`  ${r.sub}`}
              </tspan>
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function Bullets({ chart, width, height }: Size & { chart: Extract<Chart, { kind: 'bullets' }> }) {
  const labW = 84;
  const textW = 120;
  const pw = width - labW - textW;
  const rowH = height / Math.max(chart.rows.length, 1);
  const hi = Math.max(...chart.rows.flatMap((r) => [r.value, r.target]), 1) * 1.05;
  const X = linear(0, hi, 0, pw);
  const tone = { good: '#176B3D', watch: '#8A5A00', off: '#B3261E', neutral: C.g600 } as const;
  return (
    <svg width={width} height={height} role="img" aria-label={chart.rows.map((r) => `${r.label} ${r.text}`).join(', ')}>
      {chart.rows.map((r, i) => {
        const cy = i * rowH + rowH / 2;
        return (
          <g key={r.label}>
            <T x={0} y={cy + 4} fill={C.ink} size={12} weight={500}>
              {r.label}
            </T>
            <rect x={labW} y={cy - 4} width={pw} height={8} fill={C.panel2} />
            <rect x={labW} y={cy - 4} width={X(r.value)} height={8} fill={C.ink} />
            <rect x={labW + X(r.target) - 1} y={cy - 7} width={2} height={14} fill={C.teal} />
            <T x={labW + pw + 8} y={cy + 4} fill={tone[r.status]} size={12} weight={700}>
              {r.text}
            </T>
          </g>
        );
      })}
    </svg>
  );
}

export function Waterfall({ chart, width, height }: Size & { chart: Extract<Chart, { kind: 'waterfall' }> }) {
  const padT = 14;
  const padB = 16;
  const levels: [number, number][] = [];
  let run = 0;
  for (const s of chart.steps) {
    if (s.kind === 'total') {
      levels.push([0, s.value]);
      run = s.value;
    } else {
      levels.push([run, run + s.value]);
      run += s.value;
    }
  }
  const tops = levels.flatMap(([a, b]) => [a, b]).filter((v) => v !== 0);
  const [lo, hi] = extent(tops);
  const floor = Math.max(0, lo - (hi - lo) * 1.2); // totals start at a truncated base so the steps stay readable
  const Y = linear(floor, hi, height - padB, padT);
  const slot = width / chart.steps.length;
  const bw = slot * 0.55;
  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={chart.steps.map((s) => `${s.label} ${s.text}`).join(', ')}
    >
      <line x1={0} x2={width} y1={height - padB} y2={height - padB} stroke={C.line} />
      {chart.steps.map((s, i) => {
        const [a, b] = levels[i] ?? [0, 0];
        const top = Y(Math.max(a, b, floor));
        const bottom = s.kind === 'total' ? height - padB : Y(Math.min(a, b));
        const x = slot * i + (slot - bw) / 2;
        const fill = s.kind === 'total' ? C.ink : s.kind === 'up' ? C.teal : C.g400;
        const next = levels[i + 1];
        return (
          <g key={s.label}>
            <rect x={x} y={top} width={bw} height={Math.max(bottom - top, 1)} fill={fill} />
            {next ? <line x1={x + bw} x2={x + slot} y1={Y(b)} y2={Y(b)} stroke={C.line} /> : null}
            <T x={x + bw / 2} y={top - 3} anchor="middle" fill={C.ink} size={10} weight={600}>
              {s.text}
            </T>
            <T x={x + bw / 2} y={height - 3} anchor="middle">
              {s.label}
            </T>
          </g>
        );
      })}
    </svg>
  );
}

const BIN_FILL = [C.panel2, C.g300, C.g400, C.ink] as const;

export function Heat({ chart, width, height }: Size & { chart: Extract<Chart, { kind: 'heat' }> }) {
  const heatW = chart.side ? Math.round(width * 0.56) : width;
  const labW = 104;
  const headH = 16;
  const cw = (heatW - labW) / Math.max(chart.cols.length, 1);
  const rh = Math.min((height - headH) / Math.max(chart.rows.length, 1), 28);
  const side = chart.side;
  return (
    <svg width={width} height={height} role="img" aria-label="Heat matrix">
      {chart.cols.map((c, j) => (
        <T key={c} x={labW + j * cw + cw / 2} y={11} anchor="middle">
          {c}
        </T>
      ))}
      {chart.rows.map((r, i) => (
        <g key={r.label}>
          <T x={0} y={headH + i * rh + rh / 2 + 4} fill={C.ink} size={12} weight={500}>
            {r.label}
          </T>
          {r.cells.map((cell, j) => (
            <g key={j}>
              <rect
                x={labW + j * cw}
                y={headH + i * rh}
                width={cw - 2}
                height={rh - 2}
                fill={cell.bin === null ? C.white : BIN_FILL[cell.bin]}
              />
              <T
                x={labW + j * cw + cw / 2}
                y={headH + i * rh + rh / 2 + 3}
                anchor="middle"
                fill={cell.bin === 3 ? C.white : C.ink}
                size={11}
                weight={600}
              >
                {cell.text}
              </T>
            </g>
          ))}
        </g>
      ))}
      {side ? (
        <g transform={`translate(${heatW + 16},0)`}>
          <T x={0} y={11}>
            {side.title}
          </T>
          <g transform={`translate(0,${headH})`}>
            <Bars
              chart={{ kind: 'bars', unit: side.unit, rows: side.rows }}
              width={width - heatW - 16}
              height={height - headH}
            />
          </g>
        </g>
      ) : null}
    </svg>
  );
}

export function Bubble({ chart, width, height }: Size & { chart: Extract<Chart, { kind: 'bubble' }> }) {
  const padL = 44;
  const padB = 16;
  const padT = 6;
  const [, xHi] = extent(chart.points.map((p) => p.x));
  const [, yHi] = extent(chart.points.map((p) => p.y));
  const xt = niceTicks(0, xHi * 1.1, 3);
  const yt = niceTicks(0, yHi * 1.15, 2);
  const X = linear(0, xt.at(-1) ?? 1, padL, width - 8);
  const Y = linear(0, yt.at(-1) ?? 1, height - padB, padT);
  const sMax = Math.max(...chart.points.map((p) => p.size), 1);
  const fills = [C.g300, C.g400, C.ink] as const;
  return (
    <svg width={width} height={height} role="img" aria-label={chart.points.map((p) => p.label).join(', ')}>
      <YAxis ticks={yt} Y={Y} x={padL} unit={chart.yUnit} x2={width - 8} />
      <line x1={padL} x2={padL} y1={padT} y2={height - padB} stroke={C.line} />
      {xt.map((t, i) => (
        <T key={t} x={X(t)} y={height - 3} anchor={i === xt.length - 1 ? 'end' : 'middle'}>
          {fmtAxis(chart.xUnit, t)}
        </T>
      ))}
      {[...chart.points]
        .sort((a, b) => b.size - a.size)
        .map((p) => {
          const r = 3 + 11 * Math.sqrt(p.size / sMax);
          return (
            <g key={p.label}>
              <circle
                cx={X(p.x)}
                cy={Y(p.y)}
                r={r}
                fill={p.highlight ? C.accent : fills[p.cls]}
                stroke={C.ink}
                strokeOpacity={0.6}
              />
              {p.showLabel ? (
                <T x={X(p.x) + r + 3} y={Y(p.y) + 4} fill={C.ink} size={10} weight={600}>
                  {p.label}
                </T>
              ) : null}
            </g>
          );
        })}
    </svg>
  );
}
