import type { CSSProperties } from 'react';
import type { KpiCardVM, Tone, VitalsVM } from '@/lib/engine/view-types';
import { InfoButton } from '../glass';
import styles from './views.module.css';

// Vitals (P&L views redesign v4, build-brief §1): "Results" = 3 hero cards + a column of 2 ratio cards, "Drivers &
// health" = 5 driver cards on the subtle fill. Card face = title · ⓘ · status chip · value · Δ rows (ADR-0012).

const TONE: Record<Tone, string | undefined> = {
  ahead: styles.ahead,
  adverse: styles.adverse,
  plan: styles.plan,
  neutral: styles.neutral,
};
const CHIP: Record<string, string | undefined> = {
  onTrack: undefined,
  watch: styles.watch,
  off: styles.off,
  ahead: styles.ahead,
};

function KpiCard({ card, popup }: { card: KpiCardVM; popup: CSSProperties }) {
  const size =
    card.size === 'hero'
      ? styles.hero
      : card.size === 'secondary'
        ? styles.secondary
        : `${styles.driver} ${styles.subtle}`;
  return (
    <section className={`${styles.card} ${size}`} aria-labelledby={`kpi-${card.id}`}>
      <div className={styles.ttl}>
        <h3 id={`kpi-${card.id}`} style={{ margin: 0, font: 'inherit' }}>
          {card.title}
        </h3>
        <InfoButton id={`kpi-${card.id}`} title={card.info.title} info={card.info} popupStyle={popup} />
        {card.status ? (
          <span className={`${styles.chip} ${CHIP[card.status.status] ?? ''}`}>{card.status.text}</span>
        ) : null}
      </div>
      <div className={styles.val}>{card.value}</div>
      <div className={styles.vars}>
        {card.rows.map((r) => (
          <div key={r.label} style={{ display: 'contents' }}>
            <span className={styles.k}>{r.label}</span>
            <span className={`${styles.num} ${TONE[r.tone] ?? ''}`}>{r.abs ?? ''}</span>
            <span className={`${styles.num} ${TONE[r.tone] ?? ''}`}>{r.rel}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function VitalsView({ vm }: { vm: VitalsVM }) {
  const [nr, ebitda, op, gm, opex] = vm.results;
  // Pop-ups open below the results row and above the drivers row; right-hand cards align to their right edge.
  const down = (right: boolean): CSSProperties => ({ top: 40, ...(right ? { right: 8 } : { left: 8 }) });
  const up = (right: boolean): CSSProperties => ({
    bottom: 'calc(100% - 36px)',
    ...(right ? { right: 8 } : { left: 8 }),
  });
  return (
    <div className={styles.view}>
      <div className={styles.eyebrow}>Results</div>
      <div className={styles.results}>
        {[nr, ebitda, op].map((c, i) => (c ? <KpiCard key={c.id} card={c} popup={down(i === 2)} /> : null))}
        <div className={styles.stack}>
          {gm ? <KpiCard card={gm} popup={down(true)} /> : null}
          {opex ? <KpiCard card={opex} popup={up(true)} /> : null}
        </div>
      </div>
      <div className={styles.eyebrow}>Drivers &amp; health</div>
      <div className={styles.drivers}>
        {vm.drivers.map((c, i) => (
          <KpiCard key={c.id} card={c} popup={up(i >= 3)} />
        ))}
      </div>
    </div>
  );
}
