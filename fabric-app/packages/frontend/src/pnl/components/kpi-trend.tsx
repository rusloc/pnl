// Key figures trends (K-24, K-25; ADR-0007 §2.5): a 13-month sparkline and a
// thin target bar, drawn as plain SVG from `model/trend-geometry.ts`. The
// trend area has its own state per tile and never holds the tile value back.
import { TREND_LOADING_TEXT, TREND_UNAVAILABLE_TEXT } from '../model/sample-mode';
import { monthLabel, segmentPath, sparklineGeometry, targetBarGeometry } from '../model/trend-geometry';
import type { KpiTarget, KpiTrend, KpiTrendState } from '../model/types';

const SPARK_W = 104;
const SPARK_H = 32;
const BAR_W = 100;
const BAR_H = 10;

interface SparklineProps {
  trend: KpiTrend;
}

export function Sparkline({ trend }: SparklineProps) {
  const g = sparklineGeometry(trend.points, SPARK_W, SPARK_H);
  const plotted = trend.points.filter((p) => !p.isOpen && p.value !== null);
  const first = plotted[0];
  const last = plotted[plotted.length - 1];
  const selected = trend.points[trend.points.length - 1];
  const label =
    plotted.length === 0
      ? `No closed months in the ${trend.points.length}-month trend to ${monthLabel(selected.month)}`
      : `${trend.points.length}-month trend to ${monthLabel(selected.month)}: from ${first.text} in ${monthLabel(first.month)} to ${last.text} in ${monthLabel(last.month)}${g.blanks.length > 0 ? `; ${g.blanks.length} month${g.blanks.length === 1 ? '' : 's'} blank` : ''}`;
  return (
    <svg
      role="img"
      aria-label={label}
      width={SPARK_W}
      height={SPARK_H}
      viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
      className="flex-none overflow-visible"
      data-testid="sparkline"
    >
      {g.blanks.map((i) => (
        <circle key={i} cx={g.xs[i]} cy={SPARK_H - 2} r={1} fill="#CDD4DC" data-blank={i} />
      ))}
      {g.segments.map((run, i) => (
        <path key={i} d={segmentPath(run)} fill="none" stroke="var(--acc)" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {g.marker && (
        <circle cx={g.marker.x} cy={g.marker.y} r={2.8} fill="var(--acc)" stroke="#FFFFFF" strokeWidth={1.2} data-testid="sparkline-marker">
          <title>{`${monthLabel(selected.month)}: ${selected.text}`}</title>
        </circle>
      )}
    </svg>
  );
}

interface TargetBarProps {
  target: KpiTarget;
  /** The tile's value text (the base of the bar). */
  baseText: string;
}

const TICK_STROKE = { a: '#101B2B', b: '#8592A3' } as const;

export function TargetBar({ target, baseText }: TargetBarProps) {
  const g = targetBarGeometry(target, BAR_W);
  if (!g) return null;
  const marks = target.marks.filter((m) => m.value !== null);
  const label = `${target.base === null ? 'No value' : `Value ${baseText}`}${marks.map((m) => `; ${m.name} ${m.text}`).join('')}`;
  return (
    <div className="flex min-w-0 flex-col gap-[2px]" data-testid="target-bar">
      <svg role="img" aria-label={label} width="100%" height={BAR_H} viewBox={`0 0 ${BAR_W} ${BAR_H}`} preserveAspectRatio="none" className="block">
        <rect x={0} y={3} width={BAR_W} height={4} rx={2} fill="#EDF0F3" />
        {g.bar && <rect x={g.bar.from} y={3} width={Math.max(0.5, g.bar.to - g.bar.from)} height={4} rx={2} fill="var(--acc)" data-testid="target-bar-base" />}
        {g.ticks.map((t) => (
          <line key={t.name} x1={t.x} x2={t.x} y1={0} y2={BAR_H} stroke={TICK_STROKE[t.kind]} strokeWidth={1.5} vectorEffect="non-scaling-stroke" data-tick={t.kind} />
        ))}
      </svg>
      <div aria-hidden="true" className="flex flex-wrap gap-x-[10px] text-[11px] leading-[1.2] text-slate-600">
        {g.ticks.map((t) => (
          <span key={t.name} className="inline-flex items-center gap-[4px] whitespace-nowrap">
            <span className="inline-block h-[9px] w-[2px]" style={{ background: TICK_STROKE[t.kind] }} />
            {t.name}
          </span>
        ))}
      </div>
    </div>
  );
}

interface TrendAreaProps {
  state: KpiTrendState | undefined;
  target: KpiTarget | null;
  /** The tile's value text, for the target bar description. */
  baseText: string;
}

/** The tile's trend row: sparkline (own loading / unavailable state) and the target bar (from the tile values). */
export function TrendArea({ state, target, baseText }: TrendAreaProps) {
  const kind = state?.kind ?? 'loading';
  return (
    <div className="flex items-end justify-between gap-[12px]" data-testid="trend-area" data-trend-state={kind}>
      {kind === 'ready' && state?.kind === 'ready' ? (
        <Sparkline trend={state.trend} />
      ) : kind === 'loading' ? (
        <span role="status" aria-busy="true" className="flex h-[32px] w-[104px] flex-none items-center gap-[6px] text-[11px] text-slate-400">
          <span aria-hidden="true" className="inline-block h-[2px] w-[40px] animate-pulse rounded bg-line-300" />
          {TREND_LOADING_TEXT}
        </span>
      ) : (
        <span className="flex h-[32px] w-[104px] flex-none items-center text-[11px] text-slate-400" title={state?.kind === 'unavailable' ? state.reason : undefined}>
          {TREND_UNAVAILABLE_TEXT}
        </span>
      )}
      {target && (
        <div className="min-w-0 flex-auto">
          <TargetBar target={target} baseText={baseText} />
        </div>
      )}
    </div>
  );
}
