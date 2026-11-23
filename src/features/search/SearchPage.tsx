import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CardGrid } from '../../components/CardGrid';
import { Spinner } from '../../components/Spinner';
import { EmptyState, ErrorState } from '../../components/StateMessages';
import { parseCollectorNumber } from '../../lib/cardNumber';
import { useAsyncResult, useDebouncedValue } from '../../lib/hooks';
import { foldText } from '../../lib/text';
import { getCardProvider } from '../../providers/cards/registry';
import type { SetSummary } from '../../providers/cards/types';
import { useCatalog } from './useCatalog';

type Mode = 'name' | 'set' | 'number';

const MODES: { id: Mode; label: string; placeholder: string }[] = [
  { id: 'name', label: 'Nom', placeholder: 'Ex. Dracaufeu, Pikachu…' },
  { id: 'set', label: 'Set', placeholder: 'Ex. 151, Flammes Obsidiennes…' },
  { id: 'number', label: 'Numéro', placeholder: 'Ex. 025/165, TG05…' },
];

const DEBOUNCE_MS = 350;

function isMode(value: string | null): value is Mode {
  return value === 'name' || value === 'set' || value === 'number';
}

export function SearchPage() {
  // React state is the source of truth; the URL only mirrors it so that back navigation restores
  // the results. Reading the mode from the URL would be stale between router transitions.
  const [params, setParams] = useSearchParams();
  const [mode, setMode] = useState<Mode>(() => {
    const fromUrl = params.get('mode');
    return isMode(fromUrl) ? fromUrl : 'name';
  });
  const [input, setInput] = useState(params.get('q') ?? '');
  const query = useDebouncedValue(input.trim(), DEBOUNCE_MS);
  const current = MODES.find((m) => m.id === mode) ?? MODES[0];

  function update(nextMode: Mode, nextInput: string) {
    setMode(nextMode);
    setInput(nextInput);
    const next = new URLSearchParams();
    if (nextMode !== 'name') next.set('mode', nextMode);
    if (nextInput.trim()) next.set('q', nextInput.trim());
    setParams(next, { replace: true });
  }

  return (
    <div className="flex flex-col gap-4">
      <div
        className="grid grid-cols-3 rounded-xl bg-panel p-1"
        role="tablist"
        aria-label="Type de recherche"
      >
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => {
              update(m.id, input);
            }}
            className={`rounded-lg py-2 text-sm font-semibold ${mode === m.id ? 'bg-panel-2 text-accent' : 'text-slate-400'}`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <input
        type="search"
        value={input}
        onChange={(e) => {
          update(mode, e.target.value);
        }}
        placeholder={current?.placeholder}
        aria-label="Rechercher une carte"
        className="input"
        maxLength={60}
        autoComplete="off"
        enterKeyHint="search"
      />

      {mode === 'name' && <NameResults key={query} query={query} />}
      {mode === 'set' && <SetResults query={query} />}
      {mode === 'number' && <NumberResults query={query} />}
    </div>
  );
}

function NameResults({ query }: { query: string }) {
  const { setsById } = useCatalog();
  const [pages, setPages] = useState(1);

  if (query.length < 2)
    return <EmptyState title="Recherchez une carte par son nom (en français)" />;
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: pages }, (_, index) => (
        <NameResultsPage
          key={index}
          query={query}
          page={index + 1}
          setsById={setsById}
          isLast={index + 1 === pages}
          onMore={() => {
            setPages((p) => p + 1);
          }}
        />
      ))}
    </div>
  );
}

interface NameResultsPageProps {
  readonly query: string;
  readonly page: number;
  readonly setsById: ReadonlyMap<string, SetSummary>;
  readonly isLast: boolean;
  readonly onMore: () => void;
}

/** One API page per component: "more results" never refetches pages already displayed. */
function NameResultsPage({ query, page, setsById, isLast, onMore }: NameResultsPageProps) {
  const provider = getCardProvider();
  const { state, reload } = useAsyncResult(`${query}#${page}`, (signal) =>
    provider.searchByName(query, page, { signal }),
  );

  if (state.status === 'loading' || state.status === 'idle') return <Spinner />;
  if (state.status === 'error')
    return <ErrorState message={state.error.message} onRetry={reload} />;
  if (state.data.cards.length === 0 && page === 1)
    return <EmptyState title="Aucune carte trouvée" />;

  return (
    <>
      <CardGrid cards={state.data.cards} setsById={setsById} />
      {isLast && state.data.hasMore && (
        <button type="button" className="btn-ghost" onClick={onMore}>
          Plus de résultats
        </button>
      )}
    </>
  );
}

function SetResults({ query }: { query: string }) {
  const { state, sets, reload } = useCatalog();
  const matches = useMemo<readonly SetSummary[]>(() => {
    if (!sets) return [];
    const needle = foldText(query);
    // O(n) over ~200 sets: filtering locally avoids an API call per keystroke.
    return needle ? sets.filter((set) => foldText(set.name).includes(needle)) : sets;
  }, [sets, query]);

  if (state.status === 'loading' || state.status === 'idle') return <Spinner />;
  if (state.status === 'error')
    return <ErrorState message={state.error.message} onRetry={reload} />;
  if (matches.length === 0) return <EmptyState title="Aucun set trouvé" />;

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {matches.map((set) => (
        <li key={set.id}>
          <Link
            to={`/set/${encodeURIComponent(set.id)}`}
            className="card-panel flex h-full flex-col items-center gap-2 p-3 text-center hover:bg-panel-2"
          >
            {set.logoUrl ? (
              <img
                src={set.logoUrl}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                className="h-10 w-full object-contain"
              />
            ) : (
              <span className="h-10" />
            )}
            <span className="text-sm font-semibold">{set.name}</span>
            {set.officialCount !== null && (
              <span className="text-xs text-slate-500">{set.officialCount} cartes</span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function NumberResults({ query }: { query: string }) {
  const provider = getCardProvider();
  const { setsById } = useCatalog();
  const number = parseCollectorNumber(query);
  const { state, reload } = useAsyncResult(number ? number.key : null, (signal) =>
    provider.searchByNumber(number?.key ?? '', { signal }),
  );

  if (!query) return <EmptyState title="Saisissez le numéro imprimé en bas de la carte" />;
  if (!number) return <EmptyState title="Format attendu : 025, 025/165 ou TG05" />;
  if (state.status === 'loading' || state.status === 'idle') return <Spinner />;
  if (state.status === 'error')
    return <ErrorState message={state.error.message} onRetry={reload} />;

  // "/165" narrows to sets of that size, but OCR or typos must not hide everything.
  const bySize =
    number.total === null
      ? state.data
      : state.data.filter((card) => setsById.get(card.setId)?.officialCount === number.total);
  const cards = bySize.length > 0 ? bySize : state.data;

  if (cards.length === 0) return <EmptyState title="Aucune carte avec ce numéro" />;
  return (
    <>
      {number.total !== null && bySize.length === 0 && (
        <p className="text-xs text-slate-400">
          Aucun set de {number.total} cartes : tous les résultats sont affichés.
        </p>
      )}
      <CardGrid cards={cards} setsById={setsById} />
    </>
  );
}
