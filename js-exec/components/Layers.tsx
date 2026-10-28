import { Fragment } from 'react';
import { ATTRIBUTES, SWITCH_LABELS } from '@/lib/engine/copy';
import type { AttrKey } from '@/lib/engine/copy';
import { COMPARATORS, PERIODS, REGIONS } from '@/lib/engine/url-state';
import type { Selection } from '@/lib/engine/url-state';
import type { CardView, DashboardView } from '@/lib/engine/view';
import { DrillIcon, InfoIcon, MixBar, RichText, Spark } from './ui';

// Contents of the frosted layers (E-52 … E-59): Filters menu, ⓘ explanation, drill path, How to read, Notes and the
// More-KPIs drawer. ExecApp owns which one is open, focus and the scrim; these only render view-model text.

function Close() {
  return (
    <button type="button" className="x" aria-label="Close" data-close="">
      ×
    </button>
  );
}

function Head({ eyebrow, title, word, status }: { eyebrow: string; title: string; word?: string; status?: string }) {
  return (
    <div className="pop-h">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h2 id="pop-title">{title}</h2>
      </div>
      {word ? <span className={`word ${status ?? ''}`}>{word}</span> : null}
      <Close />
    </div>
  );
}

export function FiltersMenu({
  sel,
  onSelect,
  onToggle,
  onReset,
}: {
  sel: Selection;
  onSelect: (next: Selection) => void;
  onToggle: (key: AttrKey, code: string) => void;
  onReset: () => void;
}) {
  return (
    <>
      <div className="mh">
        <h2 id="menu-title">Filters</h2>
        <button type="button" className="reset" onClick={onReset} data-reset="">
          Reset
        </button>
        <Close />
      </div>
      <div className="hint">Status is always vs budget or target; the comparator changes the Δ line.</div>
      {[
        {
          key: 'period',
          label: SWITCH_LABELS.period.label,
          chips: PERIODS.map(
            (v) => [v, SWITCH_LABELS.period.options[v], v === sel.period, { ...sel, period: v }] as const,
          ),
        },
        {
          key: 'compare',
          label: SWITCH_LABELS.compare.label,
          chips: COMPARATORS.map(
            (v) => [v, SWITCH_LABELS.compare.options[v], v === sel.compare, { ...sel, compare: v }] as const,
          ),
        },
        {
          key: 'region',
          label: SWITCH_LABELS.region.label,
          chips: REGIONS.map(
            (v) => [v, SWITCH_LABELS.region.options[v], v === sel.region, { ...sel, region: v }] as const,
          ),
        },
      ].map((g) => (
        <div key={g.key}>
          <div className="gh">{g.label}</div>
          <div className="chips">
            {g.chips.map(([v, label, pressed, next]) => (
              <button key={v} type="button" className="chip" aria-pressed={pressed} onClick={() => onSelect(next)}>
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div className="gh sec">
        Metric attributes <span>OR within a group · AND across groups</span>
      </div>
      {ATTRIBUTES.map((a) => (
        <div key={a.key}>
          <div className="gh">{a.label}</div>
          <div className="chips">
            {a.options.map(([code, label]) => (
              <button
                key={code}
                type="button"
                className="chip"
                aria-pressed={sel.picks[a.key].includes(code)}
                onClick={() => onToggle(a.key, code)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

export function ExplainPop({ card, onDrill }: { card: CardView; onDrill: () => void }) {
  const e = card.explain;
  return (
    <>
      <Head eyebrow={e.eyebrow} title={card.title} word={card.word} status={card.status} />
      <div className="pop-v">
        <div>
          <div className="big">
            {card.value}
            <small>{card.unit}</small>
          </div>
          <div className="delta" style={{ color: `var(--${card.status === 'na' ? 'muted' : card.status})` }}>
            {card.delta}
          </div>
        </div>
        {card.mix ? <MixBar mix={card.mix} /> : null}
        {card.bars ? (
          <Spark
            values={card.bars.values}
            target={card.bars.target}
            width={240}
            height={72}
            labels={card.bars.labels}
          />
        ) : null}
      </div>
      <div className="stats">
        {e.stats.map(([label, value]) => (
          <div key={label}>
            {label}
            <b>{value}</b>
          </div>
        ))}
      </div>
      <dl className="body">
        {e.rows.map(([label, rich]) => (
          <Fragment key={label}>
            <dt>{label}</dt>
            <dd>
              <RichText rich={rich} />
            </dd>
          </Fragment>
        ))}
      </dl>
      <div className="tags">
        {e.tags.map(([label, value]) => (
          <span key={label} className="tag">
            {label} <b>{value}</b>
          </span>
        ))}
      </div>
      <div className="pop-f">
        <span>{e.foot[0]}</span>
        <span>
          <b>{e.foot[1]}</b>
        </span>
      </div>
      <button type="button" className="pill" onClick={onDrill}>
        <span className="n">
          <DrillIcon />
        </span>
        {e.drillLabel}
      </button>
    </>
  );
}

export function DrillPop({ card, onExplain }: { card: CardView; onExplain: () => void }) {
  const steps = card.drill.steps;
  return (
    <>
      <Head eyebrow={card.drill.eyebrow} title={card.title} word={card.word} status={card.status} />
      <ol className="steps">
        {steps.map(([title, text], i) => (
          <li key={title} className={i === steps.length - 1 ? 'last' : undefined}>
            <b>{title}</b>
            {text}
          </li>
        ))}
      </ol>
      <div className="pop-f">
        <span>Carried on every click: period · region / format · comparator · the metric</span>
      </div>
      <button type="button" className="pill" onClick={onExplain}>
        <span className="n">
          <InfoIcon />
        </span>
        Back to the explanation
      </button>
    </>
  );
}

export function HowPop({ how }: { how: DashboardView['how'] }) {
  return (
    <>
      <Head eyebrow={how.eyebrow} title="How to read this page" />
      <ul className="plain">
        {how.bullets.map((rich, i) => (
          <li key={i}>
            <RichText rich={rich} />
          </li>
        ))}
      </ul>
      <div className="pop-f">
        <span>{how.foot[0]}</span>
        <span>
          <b>{how.foot[1]}</b>
        </span>
      </div>
    </>
  );
}

export function NotesPop({ notes }: { notes: DashboardView['notes'] }) {
  return (
    <>
      <Head eyebrow="For the owner" title="Notes" />
      <h4>Status rules (vs target, independent of the comparator)</h4>
      <table className="t">
        <tbody>
          {notes.rules.map(([title, rule]) => (
            <tr key={title}>
              <td>
                <b>{title}</b>
              </td>
              <td>{rule}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h4>Where the margins meet</h4>
      <p>{notes.margin}</p>
      <h4>Data contract</h4>
      <ul className="plain">
        {notes.contract.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <div className="pop-f">
        <span>{notes.foot}</span>
      </div>
    </>
  );
}

export function BenchDrawer({ bench }: { bench: DashboardView['bench'] }) {
  return (
    <>
      <div className="pop-h">
        <div>
          <div className="eyebrow">KPI bench · inactive, switched on per client</div>
          <h2 id="drawer-title">More KPIs · {bench.count}</h2>
        </div>
        <Close />
      </div>
      {bench.domains.map((d) => (
        <div key={d.domain}>
          <div className="dom">{d.domain}</div>
          {d.items.map(([name, formula, owner]) => (
            <div key={name} className="bk">
              <div>
                <b>{name}</b>
                <span>{formula}</span>
              </div>
              <span className="o">{owner}</span>
            </div>
          ))}
        </div>
      ))}
    </>
  );
}
