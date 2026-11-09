import type { ReactNode } from 'react';

// SVG / CSS chart primitives (contract §3.11: column charts as the PBIP, the O3 combo with a secondary axis, the
// dynamics line). Geometry only: every value and label arrives formatted from lib/engine/view.ts. Each chart draws
// at its card's size on the 1440 board (viewBox = the px size), so 1 unit = 1 px at the embed size.

export interface ColumnItem {
  key: string;
  label: string;
  value: number;
  text: string;
  /** CSS colour (a channel var, the accent, a semantic token) */
  color: string;
  emphasis?: boolean;
}

/** Wraps a category label into ≤ 2 lines of ≤ `max` characters (word boundaries). */
function wrap(label: string, max: number): string[] {
  const words = label.split(' ');
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (cur && (cur + ' ' + w).length > max) {
      lines.push(cur);
      cur = w;
    } else cur = cur ? `${cur} ${w}` : w;
  }
  if (cur) lines.push(cur);
  if (lines.length <= 2) return lines;
  return [
    lines[0] ?? '',
    `${lines
      .slice(1)
      .join(' ')
      .slice(0, max - 1)}…`,
  ];
}

export function Columns({
  items,
  width,
  height,
  line,
  labelChars = 14,
  onPick,
}: {
  items: readonly ColumnItem[];
  width: number;
  height: number;
  line?: { value: number; label: string };
  labelChars?: number;
  onPick?: (key: string) => void;
}) {
  const top = 16;
  const bottom = 30;
  const right = line ? 28 : 0; // room for the reference line's label at the right edge
  const plotH = height - top - bottom;
  const max = Math.max(...items.map((i) => i.value), line?.value ?? 0, 1e-9) * 1.08;
  const slot = items.length > 0 ? (width - right) / items.length : width;
  const bw = Math.min(slot * 0.62, 72);
  const y = (v: number) => top + plotH - (Math.max(v, 0) / max) * plotH;
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
      {items.map((it, i) => {
        const x = slot * i + (slot - bw) / 2;
        const yy = y(it.value);
        const body = (
          <g key={it.key} className={it.emphasis ? 'em' : undefined}>
            <title>{`${it.label}: ${it.text}`}</title>
            <rect x={x} y={yy} width={bw} height={top + plotH - yy} rx={2} style={{ fill: it.color }} />
            <text x={x + bw / 2} y={yy - 4} textAnchor="middle" className="v">
              {it.text}
            </text>
            {wrap(it.label, labelChars).map((l, j) => (
              <text key={j} x={x + bw / 2} y={top + plotH + 13 + j * 12} textAnchor="middle" className="c">
                {l}
              </text>
            ))}
          </g>
        );
        return onPick ? (
          <g
            key={it.key}
            role="button"
            tabIndex={0}
            className="pick"
            aria-label={`${it.label} ${it.text}`}
            onClick={() => onPick(it.key)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onPick(it.key))}
          >
            {body}
          </g>
        ) : (
          body
        );
      })}
      {line ? (
        <g className="ref">
          <line x1={0} x2={width - right} y1={y(line.value)} y2={y(line.value)} />
          <text x={width - 2} y={y(line.value) + 4} textAnchor="end">
            {line.label}
          </text>
        </g>
      ) : null}
    </svg>
  );
}

export function Clustered({
  stages,
  series,
  width,
  height,
}: {
  stages: readonly { label: string; values: readonly (number | undefined)[]; texts: readonly string[] }[];
  series: readonly { name: string; color: string }[];
  width: number;
  height: number;
}) {
  const top = 26;
  const bottom = 18;
  const plotH = height - top - bottom;
  const max = Math.max(...stages.flatMap((s) => s.values.map((v) => v ?? 0)), 1e-9) * 1.1;
  const slot = width / stages.length;
  const bw = Math.min((slot * 0.7) / series.length, 30);
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
      <g className="legend">
        {series.map((s, i) => (
          <g key={s.name} transform={`translate(${i * 150},0)`}>
            <circle cx={5} cy={7} r={4} style={{ fill: s.color }} />
            <text x={13} y={11}>
              {s.name}
            </text>
          </g>
        ))}
      </g>
      {stages.map((st, i) =>
        st.values.map((v, k) => {
          if (v === undefined) return null;
          const x = slot * i + (slot - bw * series.length) / 2 + k * bw;
          const h = (v / max) * plotH;
          return (
            <g key={`${i}-${k}`}>
              <title>{`${st.label}, ${series[k]?.name}: ${st.texts[k]}`}</title>
              <rect x={x + 1} y={top + plotH - h} width={bw - 2} height={h} rx={2} style={{ fill: series[k]?.color }} />
              <text x={x + bw / 2} y={top + plotH - h - 3} textAnchor="middle" className="v sm">
                {st.texts[k]}
              </text>
            </g>
          );
        }),
      )}
      {stages.map((st, i) => (
        <text key={st.label} x={slot * i + slot / 2} y={height - 4} textAnchor="middle" className="c">
          {st.label}
        </text>
      ))}
    </svg>
  );
}

export interface ComboPoint {
  day: string;
  axis: string;
  spend: number;
  plan: number;
  cac: number | null;
  tip: string;
}

/** O3: spend + plan (pale) columns on the left axis, paid CAC line on the right axis, the story marker. */
export function Combo({
  points,
  ticks,
  axisLeft,
  axisRight,
  marker,
  width,
  height,
}: {
  points: readonly ComboPoint[];
  ticks: readonly number[];
  axisLeft: (v: number) => string;
  axisRight: (v: number) => string;
  marker: { index: number; label: string } | null;
  width: number;
  height: number;
}) {
  const left = 44;
  const right = 48;
  const top = 12;
  const bottom = 20;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const maxL = Math.max(...points.flatMap((p) => [p.spend, p.plan]), 1e-9) * 1.1;
  const cacs = points.map((p) => p.cac).filter((v): v is number => v !== null);
  const loR = cacs.length > 0 ? Math.min(...cacs) * 0.85 : 0;
  const hiR = cacs.length > 0 ? Math.max(...cacs) * 1.08 : 1;
  const slot = plotW / Math.max(points.length, 1);
  const bw = Math.min(slot * 0.38, 22);
  const yL = (v: number) => top + plotH - (v / maxL) * plotH;
  const yR = (v: number) => top + plotH - ((v - loR) / (hiR - loR || 1)) * plotH;
  const cx = (i: number) => left + slot * i + slot / 2;
  const path = points
    .map((p, i) => (p.cac === null ? null : `${cx(i).toFixed(1)},${yR(p.cac).toFixed(1)}`))
    .filter((x) => x !== null)
    .join(' L');
  return (
    <svg className="chart" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
      {[0, 0.5, 1].map((f) => (
        <g key={f} className="axis">
          <text x={left - 6} y={yL(maxL * f) + 4} textAnchor="end">
            {axisLeft(maxL * f)}
          </text>
          <text x={width - right + 6} y={yR(loR + (hiR - loR) * f) + 4}>
            {axisRight(loR + (hiR - loR) * f)}
          </text>
        </g>
      ))}
      {points.map((p, i) => (
        <g key={p.day}>
          <title>{p.tip}</title>
          <rect x={cx(i) - bw} y={yL(p.spend)} width={bw} height={top + plotH - yL(p.spend)} className="s-spend" />
          <rect x={cx(i)} y={yL(p.plan)} width={bw} height={top + plotH - yL(p.plan)} className="s-plan" />
        </g>
      ))}
      {path ? <path d={`M${path}`} className="s-cac" /> : null}
      {marker ? (
        <g className="marker">
          <line x1={cx(marker.index)} x2={cx(marker.index)} y1={top} y2={top + plotH} />
          <text x={cx(marker.index) + 4} y={top + 9}>
            {marker.label}
          </text>
        </g>
      ) : null}
      {ticks.map((i) => (
        <text key={i} x={cx(i)} y={height - 4} textAnchor="middle" className="c">
          {points[i]?.axis}
        </text>
      ))}
    </svg>
  );
}

/** Dynamics pop-up (§5.4): the metric by day, the same day last year dashed, the last point labelled. */
export function LineChart({
  points,
  ticks,
  axis,
  lastLabel,
  width,
  height,
}: {
  points: readonly { axis: string; value: number | null; ly: number | null; tip: string }[];
  ticks: readonly number[];
  axis: (v: number) => string;
  lastLabel: string;
  width: number;
  height: number;
}) {
  const left = 56;
  const right = 40;
  const top = 30;
  const bottom = 26;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const vals = points.flatMap((p) => [p.value, p.ly]).filter((v): v is number => v !== null);
  const lo = vals.length > 0 ? Math.min(...vals) : 0;
  const hi = vals.length > 0 ? Math.max(...vals) : 1;
  const pad = (hi - lo) * 0.08 || Math.abs(hi) * 0.1 || 1;
  const y0 = lo - pad;
  const y1 = hi + pad;
  const x = (i: number) => left + (points.length > 1 ? (plotW * i) / (points.length - 1) : plotW / 2);
  const y = (v: number) => top + plotH - ((v - y0) / (y1 - y0)) * plotH;
  const line = (pick: (p: (typeof points)[number]) => number | null) => {
    let d = '';
    points.forEach((p, i) => {
      const v = pick(p);
      if (v === null) return;
      d += `${d && pick(points[i - 1] ?? p) !== null ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
    });
    return d;
  };
  const lastI = points.length - 1;
  const last = points[lastI]?.value ?? null;
  return (
    <svg className="chart dyn" viewBox={`0 0 ${width} ${height}`} width="100%" height={height} role="img">
      {[0, 1 / 3, 2 / 3, 1].map((f) => (
        <g key={f} className="axis">
          <line x1={left} x2={width - right} y1={y(y0 + (y1 - y0) * f)} y2={y(y0 + (y1 - y0) * f)} className="grid" />
          <text x={left - 8} y={y(y0 + (y1 - y0) * f) + 4} textAnchor="end">
            {axis(y0 + (y1 - y0) * f)}
          </text>
        </g>
      ))}
      <path d={line((p) => p.ly)} className="s-ly" />
      <path d={line((p) => p.value)} className="s-now" />
      {points.map((p, i) => (
        <rect
          key={i}
          x={x(i) - plotW / points.length / 2}
          y={top}
          width={plotW / points.length}
          height={plotH}
          className="hit"
        >
          <title>{p.tip}</title>
        </rect>
      ))}
      {last !== null ? (
        <g className="last">
          <circle cx={x(lastI)} cy={y(last)} r={4} />
          <text x={x(lastI)} y={y(last) - 10} textAnchor="end">
            {lastLabel}
          </text>
        </g>
      ) : null}
      {ticks.map((i) => (
        <text key={i} x={x(i)} y={height - 6} textAnchor="middle" className="c">
          {points[i]?.axis}
        </text>
      ))}
    </svg>
  );
}

/** A table that scrolls inside its card (sticky header); `onRow` makes rows clickable (cross-filter sources). */
export function Table({
  head,
  rows,
  className = '',
}: {
  head: readonly string[];
  rows: readonly {
    key: string;
    cells: readonly ReactNode[];
    selected?: boolean;
    onClick?: () => void;
    className?: string;
  }[];
  className?: string;
}) {
  return (
    <div className={`tbl ${className}`}>
      <table>
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.key}
              className={`${r.selected ? 'sel' : ''} ${r.onClick ? 'click' : ''} ${r.className ?? ''}`}
              tabIndex={r.onClick ? 0 : undefined}
              aria-selected={r.onClick ? Boolean(r.selected) : undefined}
              onClick={r.onClick}
              onKeyDown={
                r.onClick
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        r.onClick?.();
                      }
                    }
                  : undefined
              }
            >
              {r.cells.map((c, i) => (
                <td key={i}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Evenly spaced tick indices (≤ n) across `len` points, always including the first. */
export function tickIndices(len: number, n: number): number[] {
  if (len <= n) return Array.from({ length: len }, (_, i) => i);
  const step = Math.ceil(len / n);
  const out: number[] = [];
  for (let i = 0; i < len; i += step) out.push(i);
  return out;
}
