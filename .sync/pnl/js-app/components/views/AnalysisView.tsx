import { useState } from 'react';
import type { CSSProperties } from 'react';
import type { AnalysisVM, BridgeVM, Tone, VarCut, VarMode, VarRow, VarTop, VariancesVM } from '@/lib/engine/view-types';
import { InfoButton } from '../glass';
import { DivBar, MEMBER, Waterfall } from './charts';
import { useSize } from './use-size';
import styles from './views.module.css';

// Analysis (P&L views redesign v4, build-brief §2). Page 1: the two bridges side by side, full height. Page 2:
// largest variances; Top-N, grouping and cut live in the URL (lvn / lvm / lvc), block collapse and member lists are
// local view state.

const TONE: Record<Tone, string | undefined> = {
  ahead: styles.ahead,
  adverse: styles.adverse,
  plan: styles.plan,
  neutral: styles.neutral,
};
const POPUP_RIGHT: CSSProperties = { top: 40, right: 8 };

function BridgePanel({ vm }: { vm: BridgeVM }) {
  const [ref, size] = useSize<HTMLDivElement>();
  return (
    <section className={styles.panel} aria-labelledby={`h-${vm.id}`}>
      <h2 id={`h-${vm.id}`}>
        {vm.title}
        <span style={{ marginLeft: 'auto' }}>
          <InfoButton id={vm.id} title={vm.info.title} info={vm.info} popupStyle={POPUP_RIGHT} />
        </span>
      </h2>
      <div ref={ref} className={styles.ch}>
        <Waterfall steps={vm.steps} width={size.width} height={size.height} />
      </div>
    </section>
  );
}

export function AnalysisBridges({ vm }: { vm: AnalysisVM }) {
  return (
    <div className={`${styles.page} ${styles.halves}`}>
      <BridgePanel vm={vm.nr} />
      <BridgePanel vm={vm.profit} />
    </div>
  );
}

function Seg<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string | null;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className={styles.seg} role="radiogroup" aria-label={label ?? 'Grouping'}>
      {label ? <span className={styles.lbl}>{label}</span> : null}
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const TOPS: readonly { value: VarTop; label: string }[] = [
  { value: 8, label: '8' },
  { value: 12, label: '12' },
  { value: 'all', label: 'All' },
];
const MODES: readonly { value: VarMode; label: string }[] = [
  { value: 'block', label: 'By block' },
  { value: 'abs', label: 'By |Δ|' },
];

function Cells({ r, scale, py }: { r: VarRow; scale: number; py: boolean }) {
  return (
    <>
      <td>{r.comparison}</td>
      <td>{r.actual}</td>
      <td>
        <DivBar delta={r.delta} members={r.members} scale={scale} />
      </td>
      <td className={TONE[r.tone]}>{r.deltaText}</td>
      <td className={r.deltaPct === 'n.m.' ? styles.nm : TONE[r.tone]}>{r.deltaPct}</td>
      {py ? <td>{r.py}</td> : null}
      <td>{r.fx}</td>
    </>
  );
}

export function Variances({
  vm,
  top,
  mode,
  cut,
  onChange,
}: {
  vm: VariancesVM;
  top: VarTop;
  mode: VarMode;
  cut: VarCut;
  onChange: (patch: { top?: VarTop; mode?: VarMode; cut?: VarCut }) => void;
}) {
  const showPy = vm.columns.py !== ''; // Compare B = None drops the column (parity rule 17)
  // "All" starts with every block collapsed so the page still fits (v4); other Top-N values start expanded.
  const [closed, setClosed] = useState<ReadonlySet<string> | null>(null);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());
  const blocks = vm.rows.filter((r) => r.kind === 'block').map((r) => r.code);
  const isClosed = (code: string) => (closed ?? new Set(top === 'all' ? blocks : [])).has(code);
  const toggleBlock = (code: string) => {
    const next = new Set(closed ?? (top === 'all' ? blocks : []));
    if (!next.delete(code)) next.add(code);
    setClosed(next);
  };
  const toggleLeaf = (code: string) => {
    const next = new Set(open);
    if (!next.delete(code)) next.add(code);
    setOpen(next);
  };
  const change = (patch: { top?: VarTop; mode?: VarMode; cut?: VarCut }) => {
    setClosed(null);
    setOpen(new Set());
    onChange(patch);
  };

  return (
    <div className={styles.page}>
      <section className={styles.panel} aria-labelledby="h-variances">
        <h2 id="h-variances">
          {vm.title}
          <div className={styles.ctl}>
            <Seg label="Top" options={TOPS} value={top} onChange={(v) => change({ top: v })} />
            <Seg label={null} options={MODES} value={mode} onChange={(v) => change({ mode: v })} />
            <Seg label="Cut" options={vm.cuts} value={cut} onChange={(v) => change({ cut: v })} />
          </div>
          <InfoButton id="variances" title={vm.info.title} info={vm.info} popupStyle={POPUP_RIGHT} />
        </h2>
        {vm.legend.length > 0 ? (
          <div className={styles.legend} aria-label="Cut members">
            {vm.legend.map((m, i) => (
              <span key={m.key}>
                <i style={{ background: MEMBER[i % MEMBER.length] }} />
                {m.label}
              </span>
            ))}
          </div>
        ) : null}
        <div className={`${styles.ch} ${styles.scroll}`}>
          <table className={`${styles.table} ${styles.vtable}`}>
            <thead>
              <tr>
                <th className={styles.l}>Line</th>
                <th>{vm.columns.comparison}</th>
                <th>Actual</th>
                <th aria-label="Variance bar" />
                <th>Δ</th>
                <th>Δ %</th>
                {showPy ? <th>{vm.columns.py}</th> : null}
                <th>of which FX</th>
              </tr>
            </thead>
            <tbody>
              {vm.rows.map((r) => {
                if (r.kind === 'block')
                  return (
                    <tr key={`b-${r.code}`} className={styles.blk}>
                      <td className={styles.l}>
                        <button type="button" aria-expanded={!isClosed(r.code)} onClick={() => toggleBlock(r.code)}>
                          {isClosed(r.code) ? '▸' : '▾'}
                        </button>
                        {r.label}
                        <span className={styles.blkn}>{r.count}</span>
                        {r.alloc ? <span className={styles.tag}>alloc.</span> : null}
                      </td>
                      <Cells r={r} scale={vm.scale} py={showPy} />
                    </tr>
                  );
                if (mode === 'block' && r.block && isClosed(r.block)) return null;
                const expandable = r.members.length > 0;
                return [
                  <tr
                    key={`l-${r.code}`}
                    className={`${mode === 'block' ? styles.leaf : ''} ${r.alloc ? styles.alloc : ''}`}
                  >
                    <td className={styles.l}>
                      {expandable ? (
                        <button
                          type="button"
                          aria-expanded={open.has(r.code)}
                          aria-label={`Members of ${r.label}`}
                          onClick={() => toggleLeaf(r.code)}
                        >
                          {open.has(r.code) ? '▾' : '▸'}
                        </button>
                      ) : null}
                      {r.label}
                      {mode === 'abs' && r.blockName ? <span className={styles.blkn}>{r.blockName}</span> : null}
                      {r.alloc ? <span className={styles.tag}>alloc.</span> : null}
                    </td>
                    <Cells r={r} scale={vm.scale} py={showPy} />
                  </tr>,
                  ...(open.has(r.code)
                    ? r.members.map((m, i) => (
                        <tr key={`m-${r.code}-${m.key}`} className={styles.mem}>
                          <td className={styles.l}>
                            <i
                              style={{
                                display: 'inline-block',
                                width: 8,
                                height: 8,
                                marginRight: 6,
                                borderRadius: 4,
                                background: MEMBER[i % MEMBER.length],
                              }}
                            />
                            {m.label}
                          </td>
                          <td />
                          <td />
                          <td>
                            <DivBar delta={m.delta} members={[]} scale={vm.scale} />
                          </td>
                          <td>{m.text}</td>
                          <td />
                          {showPy ? <td /> : null}
                          <td />
                        </tr>
                      ))
                    : []),
                ];
              })}
            </tbody>
            <tfoot>
              {vm.footer.map((r) => (
                <tr key={`f-${r.code}`} className={styles.foot}>
                  <td className={styles.l}>{r.label}</td>
                  <Cells r={r} scale={vm.scale} py={showPy} />
                </tr>
              ))}
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
