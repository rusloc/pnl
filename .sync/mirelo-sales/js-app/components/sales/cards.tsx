import type { CSSProperties } from 'react';
import type { CmpRow, Status } from '@/lib/sales/status';
import type { ViewId } from '@/lib/sales/types';
import type { ChartCard, HeroCard, KpiCard, LegendItem, RowAction, TableCard } from '@/lib/sales/view-model';
import { Bars, Bubble, Bullets, C, ColumnChart, FILL, Funnel, Heat, LineChart, StackedBars, Waterfall } from './charts';
import { InfoButton } from './popup';
import styles from './sales.module.css';

// Card family renderers (design-tokens §5, layout-spec §0.2). Positions are board px minus the 116 px content top.

export interface Box {
  x: number;
  y: number; // board y (layout-spec), converted to the content panel here
  w: number;
  h: number;
}
const place = (b: Box) => ({ left: b.x, top: b.y - 116, width: b.w, height: b.h });

// Pop-up placement (design-tokens §5a: 360 px wide, max 420 high), in card coordinates: the side with more room, and
// flipped to the card's right edge when 360 px would leave the frame (x 1408).
const FRAME_R = 1408;
const BOARD_H = 810;
const TABS_BOTTOM = 104;
const POP_W = 360;
const xSide = (b: Box): CSSProperties => (b.x + 8 + POP_W > FRAME_R ? { right: 8 } : { left: 8 });
/** ⓘ at the bottom-left of a card or panel. */
function belowOrAbove(b: Box): CSSProperties {
  const down = BOARD_H - (b.y + b.h) - 8;
  const up = b.y + b.h - 32 - TABS_BOTTOM;
  return down >= up
    ? { ...xSide(b), top: b.h + 4, maxHeight: Math.min(420, down) }
    : { ...xSide(b), bottom: 32, maxHeight: Math.min(420, up) };
}
/** ⓘ in a table's title row: tables sit at the bottom of the frame, so the pop-up opens above the card. */
const aboveCard = (b: Box): CSSProperties => ({
  right: 8,
  bottom: b.h + 4,
  maxHeight: Math.min(420, b.y - TABS_BOTTOM - 4),
});

const HALF_BAR = 72; // hero diverging bar 144 × 6 (16 px card padding kept on the right)

const TONE: Record<Status, string | undefined> = {
  good: styles.good,
  watch: styles.watch,
  off: styles.off,
  neutral: styles.neutral,
};
const BAR_BG: Record<Status, string | undefined> = {
  good: styles.bgGood,
  watch: styles.bgWatch,
  off: styles.bgOff,
  neutral: styles.bgNeutral,
};

function Comparator({ row, top, bar, className }: { row: CmpRow; top: number; bar: boolean; className?: string }) {
  const b = row.bar;
  return (
    <div className={`${styles.cr} ${className ?? ''}`} style={{ top }}>
      <span className={styles.crName}>{row.label}</span>
      <span className={`${styles.crDelta} ${TONE[row.status]}`}>{row.text}</span>
      {bar ? (
        <span className={styles.diff} style={b ? undefined : { background: 'transparent' }} aria-hidden="true">
          {b ? (
            <>
              <i />
              <b
                className={BAR_BG[row.status]}
                style={
                  b.side === 'right'
                    ? { left: HALF_BAR, width: b.size * HALF_BAR }
                    : { right: HALF_BAR, width: b.size * HALF_BAR }
                }
              />
            </>
          ) : null}
        </span>
      ) : null}
    </div>
  );
}

function StatusChip({ chip, className }: { chip: { text: string; status: Status } | null; className?: string }) {
  return chip ? (
    <span className={`${styles.chip} ${styles[chip.status] ?? ''} ${TONE[chip.status] ?? ''} ${className ?? ''}`}>
      {chip.text}
    </span>
  ) : null;
}

export function HeroCardView({ card, box, onOpen }: { card: HeroCard; box: Box; onOpen: (v: ViewId) => void }) {
  return (
    <section className={`${styles.card} ${styles.hero}`} style={place(box)} aria-label={card.label}>
      {/* stretched button: the whole card opens the metric's view; the ⓘ sits above it */}
      <button
        type="button"
        className={styles.heroOpen}
        aria-label={`${card.label}: ${card.value}${card.second ? `, ${card.second}` : ''}. ${card.rows.map((r) => `${r.label} ${r.text}`).join(', ')}. Open the view.`}
        onClick={() => onOpen(card.open)}
      />
      <span className={styles.lab}>{card.label}</span>
      <StatusChip chip={card.status} className={styles.heroChip} />
      <span className={styles.heroVal}>
        {card.value}
        {card.second ? <small>{card.second}</small> : null}
      </span>
      <Comparator row={card.rows[0]} top={124} bar />
      <Comparator row={card.rows[1]} top={148} bar />
      <InfoButton
        id={card.id}
        title={card.label}
        info={card.info}
        className={styles.infoCorner}
        popupStyle={belowOrAbove(box)}
      />
    </section>
  );
}

export function KpiCardView({ card, box }: { card: KpiCard; box: Box }) {
  return (
    <section className={`${styles.card} ${styles.kpi}`} style={place(box)} aria-label={card.label}>
      <span className={styles.lab}>{card.label}</span>
      <span className={styles.kpiVal}>{card.value}</span>
      <StatusChip chip={card.status} className={styles.kpiChip} />
      <Comparator row={card.row} top={80} bar={false} className={card.alt ? styles.main : undefined} />
      {card.alt ? <Comparator row={card.alt} top={80} bar={false} className={styles.alt} /> : null}
      <InfoButton
        id={card.id}
        title={card.label}
        info={card.info}
        className={styles.infoCorner}
        popupStyle={belowOrAbove(box)}
      />
    </section>
  );
}

function Legend({ items }: { items: LegendItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className={styles.legend} aria-hidden="true">
      {items.map((it) => {
        const square = it.role === 'selected' || it.role === 'ghost' || it.role === 'c5';
        const style =
          it.role === 'selected'
            ? { background: C.accent, border: `1px solid ${C.ink}` }
            : it.role === 'ghost'
              ? { background: 'transparent', border: `1px solid ${C.g400}` }
              : it.role === 'py'
                ? { background: `repeating-linear-gradient(90deg, ${C.g400} 0 4px, transparent 4px 7px)` }
                : {
                    background: FILL[it.role].fill === 'none' ? 'transparent' : FILL[it.role].fill,
                    border: FILL[it.role].stroke ? `1px solid ${FILL[it.role].stroke}` : undefined,
                  };
        return (
          <span key={it.label}>
            <i className={`${styles.sw} ${square ? styles.swSq : ''}`} style={style} />
            {it.label}
          </span>
        );
      })}
    </div>
  );
}

const VIEW_NAMES: Record<ViewId, string> = {
  overview: 'overview',
  loans: 'loans issued',
  clients: 'clients',
  portfolio: 'portfolio quality',
  revenue: 'revenue & targets',
};

export function ChartCardView({
  card,
  box,
  onOpen,
  onMonth,
}: {
  card: ChartCard;
  box: Box;
  onOpen: (v: ViewId) => void;
  onMonth: (m: number) => void;
}) {
  const width = box.w - 32;
  const height = box.h - 40 - 30; // bottom strip: ⓘ + legend
  const ch = card.chart;
  const size = { width, height };
  return (
    <section className={styles.card} style={place(box)} aria-labelledby={`${card.id}-t`}>
      <div className={styles.ct}>
        <h3 id={`${card.id}-t`}>{card.title}</h3>
        <span className={styles.acts}>
          {card.open ? (
            <button type="button" className={styles.openBtn} onClick={() => card.open && onOpen(card.open)}>
              Open {VIEW_NAMES[card.open]} ↗
            </button>
          ) : null}
        </span>
      </div>
      {ch.kind === 'placeholder' ? (
        <div className={styles.placeholder}>{ch.text}</div>
      ) : (
        <div className={styles.chart}>
          {ch.kind === 'line' ? <LineChart chart={ch} {...size} onMonth={onMonth} /> : null}
          {ch.kind === 'columns' ? <ColumnChart chart={ch} {...size} onMonth={onMonth} /> : null}
          {ch.kind === 'bars' ? <Bars chart={ch} {...size} /> : null}
          {ch.kind === 'stackedBars' ? <StackedBars chart={ch} {...size} /> : null}
          {ch.kind === 'funnel' ? <Funnel chart={ch} {...size} /> : null}
          {ch.kind === 'bullets' ? <Bullets chart={ch} {...size} /> : null}
          {ch.kind === 'waterfall' ? <Waterfall chart={ch} {...size} /> : null}
          {ch.kind === 'heat' ? <Heat chart={ch} {...size} /> : null}
          {ch.kind === 'bubble' ? <Bubble chart={ch} {...size} /> : null}
        </div>
      )}
      <InfoButton
        id={card.id}
        title={card.title}
        info={card.info}
        className={styles.infoCorner}
        popupStyle={belowOrAbove(box)}
      />
      <Legend items={card.legend} />
    </section>
  );
}

export function TableCardView({
  card,
  box,
  tight,
  onAction,
}: {
  card: TableCard;
  box: Box;
  tight: boolean;
  onAction: (a: RowAction) => void;
}) {
  return (
    <section className={styles.card} style={place(box)} aria-labelledby={`${card.id}-t`}>
      <div className={styles.ct}>
        <h3 id={`${card.id}-t`}>{card.title}</h3>
        <span className={styles.acts}>
          <InfoButton id={card.id} title={card.title} info={card.info} popupStyle={aboveCard(box)} />
          {card.action ? (
            <button
              type="button"
              className={styles.openBtn}
              onClick={() => card.action && onAction({ kind: 'drill', drill: card.action.drill })}
            >
              {card.action.label} ↗
            </button>
          ) : null}
        </span>
      </div>
      <div className={`${styles.tableWrap} ${tight ? styles.tableWrapTight : ''}`}>
        <table className={`${styles.table} ${tight ? styles.tight : ''}`} aria-label={card.title}>
          <colgroup>
            {card.columns.map((c) => (
              <col key={c.key} style={{ width: c.width }} />
            ))}
            <col />
          </colgroup>
          <thead>
            <tr>
              {card.columns.map((c) => (
                <th key={c.key} scope="col" className={c.align === 'right' ? styles.r : undefined}>
                  {c.label}
                </th>
              ))}
              <th aria-hidden="true" />
            </tr>
          </thead>
          <tbody>
            {card.empty ? (
              <tr>
                <td colSpan={card.columns.length + 1} className={styles.empty}>
                  {card.empty}
                </td>
              </tr>
            ) : null}
            {card.rows.map((r) => (
              <tr
                key={r.key}
                className={r.action ? styles.row : undefined}
                aria-selected={r.selected}
                tabIndex={r.action ? 0 : undefined}
                onClick={() => r.action && onAction(r.action)}
                onDoubleClick={() => r.secondary && onAction(r.secondary)}
                onKeyDown={(e) => {
                  if ((e.key === 'Enter' || e.key === ' ') && r.action) {
                    e.preventDefault();
                    onAction(e.shiftKey && r.secondary ? r.secondary : r.action);
                  }
                }}
              >
                {r.cells.map((c, k) => {
                  const col = card.columns[k];
                  const tone = c.status ? TONE[c.status] : undefined;
                  return (
                    <td key={col?.key ?? k} className={col?.align === 'right' ? styles.r : undefined}>
                      {c.bar !== undefined ? (
                        <span className={styles.attBar} aria-hidden="true">
                          <b style={{ width: `${Math.min((c.bar ?? 0) / 1.5, 1) * 100}%` }} />
                          <i />
                        </span>
                      ) : null}
                      {c.chip ? (
                        <span className={`${styles.chip} ${c.status ? styles[c.status] : ''} ${tone ?? ''}`}>
                          {c.text}
                        </span>
                      ) : (
                        <span className={tone}>{c.text}</span>
                      )}
                      {c.tag ? <span className={styles.tag}>{c.tag}</span> : null}
                    </td>
                  );
                })}
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
