import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { CardImage } from '../../components/CardImage';
import { Spinner } from '../../components/Spinner';
import { EmptyState, ErrorState } from '../../components/StateMessages';
import { CONDITION_LABELS, VARIANT_LABELS, type CollectionItem } from '../../lib/collection/types';
import { formatPrice } from '../../lib/format';
import { computeCollectionValue, itemValue } from '../../lib/pricing/valuation';
import type { PriceMap } from '../../providers/prices/types';
import { useCollection } from './CollectionContext';
import { usePrices } from './usePrices';

const EMPTY_PRICES: PriceMap = new Map();

export function CollectionPage() {
  const { load, items, reload } = useCollection();
  const cardIds = useMemo(() => items.map((item) => item.cardId), [items]);
  const { state: priceState, reload: reloadPrices } = usePrices(cardIds);
  const prices = priceState.status === 'success' ? priceState.data : EMPTY_PRICES;
  const value = useMemo(() => computeCollectionValue(items, prices), [items, prices]);
  const [setFilter, setSetFilter] = useState<string | null>(null);

  if (load.status === 'loading') return <Spinner label="Chargement de la collection…" />;
  if (load.status === 'error') return <ErrorState message={load.error.message} onRetry={reload} />;
  if (items.length === 0) {
    return (
      <EmptyState title="Votre collection est vide">
        <p>
          <Link to="/" className="text-accent underline">
            Recherchez
          </Link>{' '}
          ou{' '}
          <Link to="/scan" className="text-accent underline">
            scannez
          </Link>{' '}
          une carte pour commencer.
        </p>
      </EmptyState>
    );
  }

  const visible = setFilter ? items.filter((item) => item.setId === setFilter) : items;

  return (
    <div className="flex flex-col gap-4">
      <section className="card-panel" aria-labelledby="value-title">
        <h2 id="value-title" className="text-sm text-slate-400">
          Valeur estimée
        </h2>
        <p className="text-3xl font-bold text-accent">
          {priceState.status === 'loading' ? '…' : formatPrice(value.total, value.currency)}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {value.cardCount} carte{value.cardCount > 1 ? 's' : ''} · prix connus pour{' '}
          {value.pricedCount}. Estimation Cardmarket (tendance), ajustée selon l’état.
        </p>
        {priceState.status === 'error' && (
          <div className="mt-2 flex items-center gap-2 text-xs text-red-300">
            {priceState.error.message}
            <button type="button" className="underline" onClick={reloadPrices}>
              Réessayer
            </button>
          </div>
        )}
      </section>

      <section aria-labelledby="sets-title">
        <h2 id="sets-title" className="mb-2 text-sm font-semibold text-slate-300">
          Par set
        </h2>
        <ul className="flex gap-2 overflow-x-auto pb-1">
          <li>
            <button
              type="button"
              onClick={() => {
                setSetFilter(null);
              }}
              className={`rounded-xl px-3 py-2 text-left text-xs whitespace-nowrap ${setFilter === null ? 'bg-accent text-slate-900' : 'bg-panel'}`}
            >
              Tous
            </button>
          </li>
          {value.bySet.map((set) => (
            <li key={set.setId}>
              <button
                type="button"
                onClick={() => {
                  setSetFilter(set.setId);
                }}
                className={`rounded-xl px-3 py-2 text-left text-xs whitespace-nowrap ${setFilter === set.setId ? 'bg-accent text-slate-900' : 'bg-panel'}`}
              >
                <span className="block font-semibold">{set.setName}</span>
                <span>
                  {formatPrice(set.value)} · {set.cardCount} carte{set.cardCount > 1 ? 's' : ''}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <ul className="flex flex-col gap-2">
        {visible.map((item) => (
          <CollectionRow key={item.id} item={item} prices={prices} />
        ))}
      </ul>
    </div>
  );
}

function CollectionRow({ item, prices }: { item: CollectionItem; prices: PriceMap }) {
  const { setQuantity, remove } = useCollection();
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  // Rows not yet confirmed by the server have no real id to update.
  const pending = item.id.startsWith('optimistic-');
  const value = itemValue(item, prices.get(item.cardId));

  async function changeQuantity(next: number) {
    setError(null);
    const result = next < 1 ? await remove(item.id) : await setQuantity(item.id, next);
    if (!result.ok) setError(result.error.message);
  }

  return (
    <li className="card-panel flex gap-3 p-3">
      <Link to={`/card/${encodeURIComponent(item.cardId)}`} className="w-16 shrink-0">
        <CardImage src={item.imageUrl} alt={item.cardName} />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate font-semibold">{item.cardName}</p>
            <p className="truncate text-xs text-slate-400">
              {item.setName} · #{item.localId}
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-accent">{formatPrice(value)}</p>
        </div>
        <p className="text-xs text-slate-400">
          <span title={CONDITION_LABELS[item.condition]}>{item.condition}</span> ·{' '}
          {VARIANT_LABELS[item.variant]}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost size-11 p-0"
            aria-label="Retirer un exemplaire"
            disabled={pending}
            onClick={() => void changeQuantity(item.quantity - 1)}
          >
            −
          </button>
          <span className="min-w-8 text-center tabular-nums" aria-label="Quantité">
            {item.quantity}
          </span>
          <button
            type="button"
            className="btn-ghost size-11 p-0"
            aria-label="Ajouter un exemplaire"
            disabled={pending}
            onClick={() => void changeQuantity(item.quantity + 1)}
          >
            +
          </button>
          <div className="ml-auto">
            {confirming ? (
              <span className="flex gap-2">
                <button
                  type="button"
                  className="btn-danger"
                  disabled={pending}
                  onClick={() => void changeQuantity(0)}
                >
                  Confirmer
                </button>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => {
                    setConfirming(false);
                  }}
                >
                  Annuler
                </button>
              </span>
            ) : (
              <button
                type="button"
                className="btn-danger"
                disabled={pending}
                onClick={() => {
                  setConfirming(true);
                }}
              >
                Supprimer
              </button>
            )}
          </div>
        </div>
        {error && (
          <p role="alert" className="text-xs text-red-300">
            {error}
          </p>
        )}
      </div>
    </li>
  );
}
