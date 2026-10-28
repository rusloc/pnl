import type { CSSProperties } from 'react';
import type { ProfitabilityVM, Tone } from '@/lib/engine/view-types';
import { InfoButton } from '../glass';
import { Bubble, MEMBER, ShareBars } from './charts';
import { useSize } from './use-size';
import styles from './views.module.css';

// Profitability (P&L views redesign v4, build-brief §3). Page 1: 8-column region table (status dot on CM Δ only) +
// concentration bars; page 2: growth × margin by region (left) + region × service-line mix heatmap (right).

const TONE: Record<Tone, string | undefined> = {
  ahead: styles.ahead,
  adverse: styles.adverse,
  plan: styles.plan,
  neutral: styles.neutral,
};
const DOT: Record<string, string | undefined> = {
  onTrack: '',
  watch: styles.watch,
  off: styles.off,
  ahead: styles.ahead,
};
const POPUP_RIGHT: CSSProperties = { top: 40, right: 8 };

function Title({
  id,
  title,
  sub,
  info,
}: {
  id: string;
  title: string;
  sub?: string;
  info: ProfitabilityVM['heat']['info'];
}) {
  return (
    <h2 id={`h-${id}`}>
      {title}
      {sub ? <span className={styles.sub}>{sub}</span> : null}
      <span style={{ marginLeft: 'auto' }}>
        <InfoButton id={id} title={info.title} info={info} popupStyle={POPUP_RIGHT} />
      </span>
    </h2>
  );
}

export function ProfitabilityTable({ vm }: { vm: ProfitabilityVM }) {
  const [ref, size] = useSize<HTMLDivElement>();
  return (
    <div className={`${styles.page} ${styles.tableAndBars}`}>
      <section className={styles.panel} aria-labelledby="h-prof-table">
        <Title id="prof-table" title={vm.title} sub={vm.subtitle} info={vm.table.info} />
        <div className={styles.ch}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th className={styles.l}>Region</th>
                <th>Net revenue</th>
                <th>Δ vs {vm.table.cmpName} %</th>
                <th>GM %</th>
                <th>CM %</th>
                <th>CM Δ pp</th>
                <th>Contribution</th>
                <th>Adj. EBITDA</th>
              </tr>
            </thead>
            <tbody>
              {vm.table.rows.map((r) => (
                <tr key={r.key} className={r.total ? styles.total : undefined}>
                  <td className={styles.l}>{r.label}</td>
                  <td>{r.nr}</td>
                  <td className={TONE[r.nrDelta.tone]}>{r.nrDelta.text}</td>
                  <td>{r.gm}</td>
                  <td>{r.cm}</td>
                  <td>
                    {r.cmDelta.status ? (
                      <span
                        className={`${styles.dot} ${DOT[r.cmDelta.status] ?? ''}`}
                        role="img"
                        aria-label={r.cmDelta.status}
                      />
                    ) : null}
                    {r.cmDelta.text}
                  </td>
                  <td>{r.contribution}</td>
                  <td>{r.ebitda}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className={styles.panel} aria-labelledby="h-prof-conc">
        <Title id="prof-conc" title="Concentration - share by profit level" info={vm.concentration.info} />
        <div ref={ref} className={styles.ch}>
          <ShareBars vm={vm.concentration} width={size.width} height={Math.max(0, size.height - 70)} />
        </div>
        <div className={styles.legend} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
          {vm.concentration.legend.map((l, i) => (
            <span key={l.key}>
              <i style={{ background: MEMBER[i % MEMBER.length] }} />
              {l.label} <b style={{ fontWeight: 500, color: 'var(--ink-900)' }}>{l.drift}</b>
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}

export function ProfitabilityCharts({ vm }: { vm: ProfitabilityVM }) {
  const [ref, size] = useSize<HTMLDivElement>();
  const gms = vm.heat.cols.map((c) => c.gm ?? 0);
  const lo = Math.min(...gms);
  const hi = Math.max(...gms);
  // colour = GM % of the column (company accent ramp, design v4); text switches to white on the dark half
  const shade = (gm: number | null) => (gm === null || hi === lo ? 0.5 : (gm - lo) / (hi - lo));
  const bg = (t: number) => `color-mix(in srgb, var(--acc) ${Math.round(15 + t * 70)}%, var(--acc-t))`;
  return (
    <div className={`${styles.page} ${styles.halves}`}>
      <section className={styles.panel} aria-labelledby="h-prof-bubble">
        <Title id="prof-bubble" title="Growth × margin by region" info={vm.bubble.info} />
        <div ref={ref} className={styles.ch}>
          <Bubble vm={vm.bubble} width={size.width} height={size.height} />
        </div>
      </section>
      <section className={styles.panel} aria-labelledby="h-prof-heat">
        <Title id="prof-heat" title={vm.heat.info.title} info={vm.heat.info} />
        <div className={styles.ch}>
          <table className={styles.table} style={{ height: '100%', tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th className={styles.l} style={{ width: 132 }}>
                  Region
                </th>
                {vm.heat.cols.map((c) => (
                  <th key={c.key} style={{ whiteSpace: 'normal', textAlign: 'center' }}>
                    {c.label}
                    <br />
                    <span style={{ fontWeight: 400 }}>{c.gmText}</span>
                  </th>
                ))}
                <th style={{ width: 84 }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {vm.heat.rows.map((r) => (
                <tr key={r.key}>
                  <td className={styles.l}>{r.label}</td>
                  {r.cells.map((c, j) => {
                    const t = shade(vm.heat.cols[j]?.gm ?? null);
                    return (
                      <td
                        key={j}
                        title={c.detail}
                        style={{
                          background: bg(t),
                          color: t > 0.45 ? '#FFFFFF' : 'var(--ink-900)',
                          textAlign: 'center',
                          border: '2px solid var(--surface)',
                        }}
                      >
                        <div style={{ fontWeight: 600 }}>{c.text}</div>
                        <div style={{ fontSize: 11 }}>{c.share}</div>
                      </td>
                    );
                  })}
                  <td style={{ fontWeight: 600 }}>{r.total}</td>
                </tr>
              ))}
              <tr className={styles.total}>
                <td className={styles.l}>Total</td>
                {vm.heat.cols.map((c) => (
                  <td key={c.key} style={{ textAlign: 'center' }}>
                    {c.total}
                  </td>
                ))}
                <td>{vm.heat.grand}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
