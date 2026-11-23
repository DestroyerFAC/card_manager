import { useParams } from 'react-router';
import { CardGrid } from '../../components/CardGrid';
import { Spinner } from '../../components/Spinner';
import { EmptyState, ErrorState } from '../../components/StateMessages';
import { useAsyncResult } from '../../lib/hooks';
import { getCardProvider } from '../../providers/cards/registry';

export function SetPage() {
  const { setId = '' } = useParams();
  const provider = getCardProvider();
  const { state, reload } = useAsyncResult(setId || null, (signal) =>
    provider.getSet(setId, { signal }),
  );

  if (state.status === 'loading' || state.status === 'idle') return <Spinner />;
  if (state.status === 'error')
    return <ErrorState message={state.error.message} onRetry={reload} />;

  const { set, cards } = state.data;
  const setsById = new Map([[set.id, set]]);
  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3">
        {set.logoUrl && (
          <img
            src={set.logoUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-12 w-24 object-contain"
          />
        )}
        <div>
          <h1 className="text-xl font-bold">{set.name}</h1>
          <p className="text-xs text-slate-400">
            {set.officialCount ?? '?'} cartes officielles · {set.totalCount ?? cards.length} au
            total
          </p>
        </div>
      </header>
      {cards.length === 0 ? (
        <EmptyState title="Aucune carte dans ce set" />
      ) : (
        <CardGrid cards={cards} setsById={setsById} />
      )}
    </div>
  );
}
