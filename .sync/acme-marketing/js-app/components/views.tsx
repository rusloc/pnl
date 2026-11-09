import type { ReactNode } from 'react';
import { C2_STAGES, CARDS, HEADERS } from '@/lib/engine/copy';
import type { CardCode } from '@/lib/engine/copy';
import { money, num, usd } from '@/lib/engine/format';
import type { RankMode } from '@/lib/engine/selection';
import type { campaigns, channels, cohorts, journey, overview } from '@/lib/engine/view';
import { Clustered, Columns, Combo, Table, tickIndices } from './charts';
import { Card, Empty, RankSwitch, toneClass } from './ui';
import type { OpenInfo } from './ui';

// The five views (contract §3.11; the PBIP layout as built on 2026-11-05): a 12-column grid of 186 px rows. Every
// card = title + ⓘ + its visual. Strings and numbers come from lib/engine/view.ts; this file only lays them out.

const title = (code: CardCode) => CARDS.find((c) => c.code === code)?.title ?? code;
/** Card body widths on the 1440 board (12 columns, 12 px gaps, 12 px card padding). */
const W = { 4: 437, 6: 680, 8: 923, 12: 1384 } as const;
const H = 142;
const chColor = (code: string) => `var(--ch-${code})`;

function C({
  code,
  cls,
  onInfo,
  tools,
  children,
}: {
  code: CardCode;
  cls: string;
  onInfo: OpenInfo;
  tools?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card code={code} title={title(code)} onInfo={onInfo} className={cls} tools={tools}>
      {children}
    </Card>
  );
}

// ---------- Overview ----------

export function OverviewView({
  v,
  modes,
  onInfo,
  onRank,
  onMover,
}: {
  v: ReturnType<typeof overview>;
  modes: { o5: RankMode; o6: RankMode };
  onInfo: OpenInfo;
  onRank: (key: 'o5' | 'o6', m: RankMode) => void;
  onMover: (campaign: string) => void;
}) {
  const ticks = tickIndices(v.o3.points.length, v.o3.grain === 'day' ? 5 : 12);
  return (
    <div className="grid">
      <C code="O1" cls="c4" onInfo={onInfo}>
        <ul className="hbars funnel">
          {v.funnel.map((f) => (
            <li key={f.label} title={f.tip}>
              <span className="lbl">{f.label}</span>
              <span className="bar">
                <i style={{ width: `${(f.width * 100).toFixed(1)}%` }} />
              </span>
              <span className="val">{f.value}</span>
            </li>
          ))}
        </ul>
      </C>
      <C code="O2" cls="c4" onInfo={onInfo}>
        <ul className="meters">
          {v.guardrails.map((g) => (
            <li key={g.label}>
              <span className="lbl">{g.label}</span>
              <span className="meter" aria-hidden="true">
                <i style={{ width: `${(g.meter * 100).toFixed(1)}%` }} />
                <b />
              </span>
              <span className="tgt">{g.target}</span>
              <span className={`val ${toneClass(g.tone)}`}>{g.value}</span>
            </li>
          ))}
        </ul>
      </C>
      <C code="O7" cls="c4" onInfo={onInfo}>
        <div className="o7">
          <span />
          <span className="colh">{HEADERS.o7[0]}</span>
          <span className="colh">{HEADERS.o7[1]}</span>
          {v.o7.map((r) => (
            <div className="o7-row" key={r.code}>
              <span className="lbl">{r.name}</span>
              <span className="bar" title={`${r.name}: ${r.spendText}`}>
                <i style={{ width: `${(r.spendW * 72).toFixed(1)}%`, background: chColor(r.code) }} />
                <em>{r.spendText}</em>
              </span>
              <span className="bar" title={`${r.name}: ${r.paidText}`}>
                <i style={{ width: `${(r.paidW * 72).toFixed(1)}%`, background: chColor(r.code) }} />
                <em>{r.paidText}</em>
              </span>
            </div>
          ))}
        </div>
      </C>
      <C
        code="O5"
        cls="c6"
        onInfo={onInfo}
        tools={<RankSwitch label="Anomalies and alerts" mode={modes.o5} onChange={(m) => onRank('o5', m)} />}
      >
        {v.o5.length === 0 ? (
          <Empty>{DASH_ROWS}</Empty>
        ) : (
          <Table
            className="o5"
            head={HEADERS.o5}
            rows={v.o5.map((r) => ({
              key: r.key,
              cells: [
                r.rank,
                r.campaign,
                r.channel,
                r.paid,
                r.before,
                <span key="d" className={toneClass(r.tone)}>
                  {r.delta}
                </span>,
                r.alert,
              ],
            }))}
          />
        )}
      </C>
      <C
        code="O6"
        cls="c6"
        onInfo={onInfo}
        tools={<RankSwitch label="Top movers by Δ ROAS" mode={modes.o6} onChange={(m) => onRank('o6', m)} />}
      >
        {v.o6.length === 0 ? (
          <Empty>{DASH_ROWS}</Empty>
        ) : (
          <Columns
            width={W[6]}
            height={H}
            labelChars={22}
            items={v.o6.map((r) => ({
              key: r.key,
              label: r.campaign,
              value: r.height,
              text: r.delta,
              color: `var(--${r.tone})`,
            }))}
            onPick={onMover}
          />
        )}
      </C>
      <C code="O3" cls="c12" onInfo={onInfo}>
        <ul className="legend-row">
          <li className="k-spend">{HEADERS.o3[0]}</li>
          <li className="k-plan">{HEADERS.o3[1]}</li>
          <li className="k-cac">{HEADERS.o3[2]}</li>
        </ul>
        <Combo
          width={W[12]}
          height={H - 18}
          points={v.o3.points.map((p) => ({
            ...p,
            tip: `${p.axisLong}: ${HEADERS.o3[0]} ${usd(p.spend)} | ${HEADERS.o3[1]} ${usd(p.plan)} | ${HEADERS.o3[2]} ${p.cac === null ? '—' : usd(p.cac)}`,
          }))}
          ticks={ticks}
          axisLeft={money}
          axisRight={(x) => usd(x)}
          marker={v.o3.marker}
        />
      </C>
    </div>
  );
}

const DASH_ROWS = '—';

// ---------- Channels ----------

export function ChannelsView({
  v,
  onInfo,
  expanded,
  onExpand,
  onCross,
}: {
  v: ReturnType<typeof channels>;
  onInfo: OpenInfo;
  expanded: ReadonlySet<string>;
  onExpand: (code: string) => void;
  onCross: (channel: string, platform: string | null) => void;
}) {
  const rows = v.c1.flatMap((r) => {
    const open = expanded.has(r.code);
    const cells = (x: (typeof v.c1)[number] | (typeof v.c1)[number]['platforms'][number], lead: ReactNode) => [
      lead,
      x.spend,
      x.share,
      x.paid,
      x.cac,
      x.roas,
      x.cs,
      <span key="p" className={toneClass(x.pacingTone)}>
        {x.pacing}
      </span>,
      <span key="f" className={toneClass(x.flags.tone)}>
        {x.flags.text}
      </span>,
    ];
    const head = {
      key: r.code,
      selected: r.selected,
      onClick: () => onCross(r.code, null),
      cells: cells(
        r,
        <span className="tree">
          <button
            type="button"
            className="exp"
            aria-expanded={open}
            aria-label={`${open ? 'Collapse' : 'Expand'} ${r.label}`}
            onClick={(e) => {
              e.stopPropagation();
              onExpand(r.code);
            }}
          >
            {open ? '−' : '+'}
          </button>
          <i className="sw" style={{ background: chColor(r.code) }} />
          {r.label}
        </span>,
      ),
    };
    const kids = open
      ? r.platforms.map((p) => ({
          key: `${r.code}|${p.platform}`,
          selected: p.selected,
          className: 'sub',
          onClick: () => onCross(r.code, p.platform),
          cells: cells(p, <span className="tree sub">{p.label}</span>),
        }))
      : [];
    return [head, ...kids];
  });
  return (
    <div className="grid ch">
      <C code="C1" cls="c6 rows3" onInfo={onInfo}>
        <Table className="c1" head={HEADERS.c1} rows={rows} />
      </C>
      <C code="C2" cls="c6" onInfo={onInfo}>
        <Clustered
          width={W[6]}
          height={H}
          series={[
            { name: HEADERS.c2[0], color: 'var(--accent)' },
            { name: HEADERS.c2[1], color: 'var(--accent-2)' },
          ]}
          stages={v.c2.map((s, i) => ({
            label: C2_STAGES[i] ?? s.label,
            values: [s.web, s.app],
            texts: [s.webText, s.appText],
          }))}
        />
      </C>
      {(['c5', 'c6'] as const).map((k) => (
        <C key={k} code={k === 'c5' ? 'C5' : 'C6'} cls="c6" onInfo={onInfo}>
          {v[k].length === 0 ? (
            <Empty>{DASH_ROWS}</Empty>
          ) : (
            <Columns
              width={W[6]}
              height={H}
              items={v[k].map((r) => ({
                key: r.code,
                label: r.name,
                value: r.value,
                text: r.label,
                color: chColor(r.code),
              }))}
            />
          )}
        </C>
      ))}
    </div>
  );
}

// ---------- Campaigns ----------

export function CampaignsView({
  v,
  onInfo,
  onCross,
}: {
  v: ReturnType<typeof campaigns>;
  onInfo: OpenInfo;
  onCross: (campaign: string) => void;
}) {
  return (
    <div className="grid">
      <C code="P1" cls="c12 rows2" onInfo={onInfo}>
        <Table
          className="p1"
          head={HEADERS.p1}
          rows={v.p1.map((r) => ({
            key: r.key,
            selected: r.selected,
            onClick: () => onCross(r.key),
            cells: [
              ...r.cells.slice(0, 4),
              <span key="p" className={toneClass(r.pacingTone)}>
                {r.cells[4]}
              </span>,
              ...r.cells.slice(5),
              <span key="f" className={toneClass(r.flags.tone)}>
                {r.flags.text}
              </span>,
            ],
          }))}
        />
      </C>
      <C code="P5" cls="c4" onInfo={onInfo}>
        {v.p5 ? (
          <Table className="p5" head={HEADERS.p5} rows={v.p5.rows.map((r, i) => ({ key: String(i), cells: r }))} />
        ) : (
          <p className="loading">Loading…</p>
        )}
        {v.p5 ? <span className="sr-only">{v.p5.caption}</span> : null}
      </C>
      {(['p6', 'p7'] as const).map((k) => (
        <C key={k} code={k === 'p6' ? 'P6' : 'P7'} cls="c4" onInfo={onInfo}>
          {v[k].length === 0 ? (
            <Empty>{DASH_ROWS}</Empty>
          ) : (
            <Columns
              width={W[4]}
              height={H}
              labelChars={12}
              items={v[k].map((r) => ({
                key: r.code,
                label: r.name,
                value: r.value,
                text: r.label,
                color: chColor(r.code),
              }))}
            />
          )}
        </C>
      ))}
    </div>
  );
}

// ---------- Journey ----------

export function JourneyView({ v, onInfo }: { v: ReturnType<typeof journey>; onInfo: OpenInfo }) {
  if (!v) return <p className="loading">Loading the Journey data…</p>;
  const tall = 236;
  return (
    <div className="grid jo">
      <C code="J1" cls="c6 rowJ" onInfo={onInfo}>
        <Table className="j1" head={HEADERS.j1} rows={v.j1.map((r, i) => ({ key: String(i), cells: r.cells }))} />
      </C>
      <C code="J2" cls="c6 rowJ" onInfo={onInfo}>
        <Columns
          width={W[6]}
          height={tall}
          labelChars={16}
          items={v.j2.map((r) => ({
            key: r.label,
            label: r.label,
            value: r.value,
            text: r.text,
            color: r.highlight ? 'var(--crit)' : 'var(--accent)',
          }))}
        />
      </C>
      <C code="J3" cls="c6 rowJ" onInfo={onInfo}>
        <Columns
          width={W[6]}
          height={tall}
          items={v.j3.map((r) => ({
            key: r.label,
            label: r.label,
            value: r.value,
            text: r.text,
            color: r.highlight ? 'var(--accent)' : 'var(--accent-soft-solid)',
          }))}
        />
      </C>
      <C code="J4" cls="c6 rowJ" onInfo={onInfo}>
        <Columns
          width={W[6]}
          height={tall}
          labelChars={14}
          line={{ value: v.target, label: v.targetText }}
          items={v.j4.map((r) => ({
            key: r.label,
            label: r.label,
            value: r.value,
            text: r.text,
            color: r.tone === 'warn' ? 'var(--warn)' : 'var(--accent)',
          }))}
        />
      </C>
    </div>
  );
}

// ---------- Cohorts ----------

function Heat({
  head,
  cols,
  rows,
}: {
  head: readonly string[];
  cols: readonly string[];
  rows: readonly { label: string; cells: readonly { text: string; fill: string | null; dark: boolean }[] }[];
}) {
  return (
    <div className="heat">
      <table>
        <thead>
          <tr>
            <th scope="col">{head[0]}</th>
            {cols.map((c) => (
              <th key={c} scope="col">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {r.cells.map((c, i) => (
                <td key={i} className={c.dark ? 'dk' : undefined} style={c.fill ? { background: c.fill } : undefined}>
                  {c.text}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CohortsView({ v, onInfo }: { v: ReturnType<typeof cohorts>; onInfo: OpenInfo }) {
  return (
    <div className="grid co">
      <C code="K1" cls="c8 k1" onInfo={onInfo}>
        <Heat head={HEADERS.k1} cols={Array.from({ length: 12 }, (_, i) => String(i))} rows={v.k1} />
      </C>
      <C code="K2" cls="c4 kr1" onInfo={onInfo}>
        <Columns
          width={W[4]}
          height={H}
          labelChars={12}
          line={{ value: v.k2Line, label: `${num(v.k2Line, 1)}` }}
          items={v.k2.map((r) => ({
            key: r.code,
            label: r.name,
            value: r.value,
            text: r.label,
            color: chColor(r.code),
          }))}
        />
      </C>
      <C code="K3" cls="c8 k3" onInfo={onInfo}>
        <Heat head={HEADERS.k3} cols={v.k3Days} rows={v.k3} />
      </C>
      <C code="K6" cls="c4 kr2" onInfo={onInfo}>
        <Columns
          width={W[4]}
          height={H}
          labelChars={12}
          line={{ value: v.k6Line, label: num(v.k6Line) }}
          items={v.k6.map((r) => ({
            key: r.code,
            label: r.name,
            value: r.value,
            text: r.label,
            color: chColor(r.code),
          }))}
        />
      </C>
      <C code="K7" cls="c4 kr3" onInfo={onInfo}>
        <Columns
          width={W[4]}
          height={H}
          labelChars={4}
          items={v.k7.map((r) => ({
            key: r.label,
            label: r.label.slice(0, 3),
            value: r.value,
            text: r.text,
            color: 'var(--accent)',
          }))}
        />
      </C>
    </div>
  );
}
