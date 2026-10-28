import type { CardView } from '@/lib/engine/view';
import { SIDEBAR_TIPS } from '@/lib/engine/copy';
import { DrillIcon, InfoIcon, Spark, tip } from './ui';

// One landing card (E-20, ADR-0012 §2.3): title · sub-title · value · Δ · status chip · bars · ⓘ and binoculars.
// A filtered-out card keeps its slot (E-55): faded, inert, out of the accessibility tree.

const BAR_WIDTH = { hero: 260, med: 180, sm: 88 } as const;

export function Card({
  card,
  onOpen,
}: {
  card: CardView;
  onOpen: (kind: 'explain' | 'drill', id: string, from: HTMLElement) => void;
}) {
  const small = card.size === 'sm';
  return (
    <article
      className={`card ${card.status} ${card.size}${card.revealed ? '' : ' dim'}`}
      aria-labelledby={`c-${card.id}`}
      inert={!card.revealed}
      aria-hidden={card.revealed ? undefined : true}
    >
      <div className="ch">
        <h3 id={`c-${card.id}`}>
          {card.title} <span>· {card.sub}</span>
        </h3>
        <span
          className={`st ${card.status}`}
          tabIndex={0}
          role="img"
          aria-label={card.word}
          {...tip(`${card.title} · ${card.word}`, ` · ${card.rule}`)}
        >
          {small ? card.glyph : `${card.glyph} ${card.word}`}
        </span>
      </div>
      <div className="cb">
        <div className="cl">
          <div className="val">
            {card.value}
            <small>{card.unit}</small>
          </div>
          <div className="delta">{card.delta}</div>
          <div className="acts2">
            <button
              type="button"
              className="ib"
              aria-label={`Explain ${card.title}`}
              aria-haspopup="dialog"
              onClick={(e) => onOpen('explain', card.id, e.currentTarget)}
              {...tip(...SIDEBAR_TIPS.explain)}
            >
              <InfoIcon />
            </button>
            <button
              type="button"
              className="ib"
              aria-label={`Drill path for ${card.title}`}
              aria-haspopup="dialog"
              onClick={(e) => onOpen('drill', card.id, e.currentTarget)}
              {...tip(...SIDEBAR_TIPS.drill)}
            >
              <DrillIcon />
            </button>
          </div>
        </div>
        {card.bars ? (
          <Spark
            values={card.bars.values}
            target={card.bars.target}
            width={BAR_WIDTH[card.size]}
            height={100}
            stretch
          />
        ) : null}
      </div>
    </article>
  );
}
