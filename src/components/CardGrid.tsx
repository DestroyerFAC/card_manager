import { Link } from 'react-router';
import type { CardSummary, SetSummary } from '../providers/cards/types';
import { CardImage } from './CardImage';

interface CardGridProps {
  readonly cards: readonly CardSummary[];
  readonly setsById?: ReadonlyMap<string, SetSummary>;
}

export function CardGrid({ cards, setsById }: CardGridProps) {
  return (
    <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
      {cards.map((card) => {
        const setName = setsById?.get(card.setId)?.name;
        return (
          <li key={card.id}>
            <Link to={`/card/${encodeURIComponent(card.id)}`} className="group block">
              <CardImage src={card.image?.small ?? null} alt={card.name} />
              <p className="mt-1 truncate text-xs font-medium text-slate-200 group-hover:text-accent">
                {card.name}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {setName ? `${setName} · ` : ''}#{card.localId}
              </p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
