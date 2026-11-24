import { Link, useParams } from 'react-router';
import { CardImage } from '../../components/CardImage';
import { Spinner } from '../../components/Spinner';
import { ErrorState } from '../../components/StateMessages';
import { formatDate, formatPrice } from '../../lib/format';
import { useAsyncResult } from '../../lib/hooks';
import { getCardProvider } from '../../providers/cards/registry';
import type { CardDetail } from '../../providers/cards/types';
import { AddToCollectionForm } from '../collection/AddToCollectionForm';
import { usePrices } from '../collection/usePrices';

export function CardDetailPage() {
  const { cardId = '' } = useParams();
  const provider = getCardProvider();
  const { state, reload } = useAsyncResult(cardId || null, (signal) =>
    provider.getCard(cardId, { signal }),
  );

  if (state.status === 'loading' || state.status === 'idle') return <Spinner />;
  if (state.status === 'error')
    return <ErrorState message={state.error.message} onRetry={reload} />;
  return <CardDetailView card={state.data} />;
}

function CardDetailView({ card }: { card: CardDetail }) {
  return (
    <article className="flex flex-col gap-4 md:flex-row md:items-start">
      <div className="mx-auto w-full max-w-xs md:mx-0">
        <CardImage src={card.image?.large ?? null} alt={`Carte ${card.name}`} eager />
      </div>
      <div className="flex flex-1 flex-col gap-4">
        <header>
          <h1 className="text-2xl font-bold">{card.name}</h1>
          <p className="text-sm text-slate-400">
            <Link
              to={`/set/${encodeURIComponent(card.set.id)}`}
              className="underline hover:text-accent"
            >
              {card.set.name}
            </Link>{' '}
            · #{card.localId}
            {card.set.officialCount !== null ? `/${card.set.officialCount}` : ''}
          </p>
        </header>

        <dl className="card-panel grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-xs text-slate-500">Rareté</dt>
            <dd>{card.rarity ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Catégorie</dt>
            <dd>{card.category ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Illustrateur</dt>
            <dd>{card.illustrator ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Versions</dt>
            <dd>
              {[
                card.variants.normal && 'Normale',
                card.variants.reverse && 'Reverse',
                card.variants.holo && 'Holo',
                card.variants.firstEdition && '1re édition',
              ]
                .filter(Boolean)
                .join(', ') || '—'}
            </dd>
          </div>
        </dl>

        <PricePanel cardId={card.id} />
        <AddToCollectionForm card={card} />
      </div>
    </article>
  );
}

function PricePanel({ cardId }: { cardId: string }) {
  const { state, reload } = usePrices([cardId]);
  const price = state.status === 'success' ? state.data.get(cardId) : undefined;

  return (
    <section className="card-panel" aria-labelledby="price-title">
      <h2 id="price-title" className="mb-2 font-semibold">
        Prix estimé (Cardmarket)
      </h2>
      {state.status === 'loading' && <p className="text-sm text-slate-400">Chargement du prix…</p>}
      {state.status === 'error' && (
        <div className="flex items-center gap-2 text-sm text-red-300">
          {state.error.message}
          <button type="button" className="underline" onClick={reload}>
            Réessayer
          </button>
        </div>
      )}
      {state.status === 'success' &&
        (!price ||
        (price.market === null &&
          price.mid === null &&
          price.low === null &&
          price.holoMarket === null) ? (
          <p className="text-sm text-slate-400">Aucun prix connu pour cette carte.</p>
        ) : (
          <>
            <dl className="grid grid-cols-3 gap-2 text-center">
              <div>
                <dt className="text-xs text-slate-500">Bas</dt>
                <dd className="font-semibold">{formatPrice(price.low, price.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Moyen</dt>
                <dd className="font-semibold">{formatPrice(price.mid, price.currency)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Tendance</dt>
                <dd className="text-lg font-bold text-accent">
                  {formatPrice(price.market, price.currency)}
                </dd>
              </div>
            </dl>
            {price.holoMarket !== null && (
              <p className="mt-2 text-center text-xs text-slate-400">
                Reverse / Holo : {formatPrice(price.holoMarket, price.currency)} (tendance)
              </p>
            )}
            <p className="mt-2 text-center text-[11px] text-slate-500">
              Mis à jour le {formatDate(price.updatedAt)}
              {price.stale ? ' · actualisation en attente' : ''}
            </p>
          </>
        ))}
    </section>
  );
}
