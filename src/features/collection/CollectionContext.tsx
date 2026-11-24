import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { isValidQuantity, mergeEntry, reconcileItem } from '../../lib/collection/duplicates';
import type { CollectionItem, NewCollectionEntry } from '../../lib/collection/types';
import { appError, type AppError } from '../../lib/errors';
import { err, ok, type Result } from '../../lib/result';
import type { CollectionRepository } from './collectionRepository';

type LoadState =
  | { readonly status: 'loading' }
  | { readonly status: 'error'; readonly error: AppError }
  | { readonly status: 'ready' };

export type AddOutcome = 'inserted' | 'incremented';

interface CollectionContextValue {
  readonly load: LoadState;
  readonly items: readonly CollectionItem[];
  readonly reload: () => void;
  readonly add: (entry: NewCollectionEntry) => Promise<Result<AddOutcome, AppError>>;
  readonly setQuantity: (id: string, quantity: number) => Promise<Result<void, AppError>>;
  readonly remove: (id: string) => Promise<Result<void, AppError>>;
}

const CollectionContext = createContext<CollectionContextValue | null>(null);

function optimisticItem(entry: NewCollectionEntry): CollectionItem {
  return { ...entry, id: `optimistic-${crypto.randomUUID()}`, createdAt: new Date().toISOString() };
}

export function CollectionProvider({
  repository,
  children,
}: {
  repository: CollectionRepository;
  children: ReactNode;
}) {
  const [items, setItems] = useState<readonly CollectionItem[]>([]);
  const [load, setLoad] = useState<LoadState>({ status: 'loading' });
  const [nonce, setNonce] = useState(0);
  // Latest items for callbacks without re-creating them on every change.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    let active = true;
    void repository.list().then((result) => {
      if (!active) return;
      if (result.ok) {
        setItems(result.value);
        setLoad({ status: 'ready' });
      } else {
        setLoad({ status: 'error', error: result.error });
      }
    });
    return () => {
      active = false;
    };
  }, [repository, nonce]);

  const reload = useCallback(() => {
    setLoad({ status: 'loading' });
    setNonce((n) => n + 1);
  }, []);

  const add = useCallback(
    async (entry: NewCollectionEntry): Promise<Result<AddOutcome, AppError>> => {
      if (!isValidQuantity(entry.quantity)) return err(appError('validation', 'Quantité invalide'));
      const previous = itemsRef.current;
      const outcome = mergeEntry(previous, entry, optimisticItem);
      setItems(outcome.items);

      const result = await repository.add(entry);
      if (!result.ok) {
        setItems(previous);
        return result;
      }
      setItems((current) => reconcileItem(current, result.value));
      return ok(outcome.kind);
    },
    [repository],
  );

  const setQuantity = useCallback(
    async (id: string, quantity: number): Promise<Result<void, AppError>> => {
      if (!isValidQuantity(quantity)) return err(appError('validation', 'Quantité invalide'));
      const previous = itemsRef.current;
      setItems(previous.map((item) => (item.id === id ? { ...item, quantity } : item)));
      const result = await repository.setQuantity(id, quantity);
      if (!result.ok) setItems(previous);
      return result;
    },
    [repository],
  );

  const remove = useCallback(
    async (id: string): Promise<Result<void, AppError>> => {
      const previous = itemsRef.current;
      setItems(previous.filter((item) => item.id !== id));
      const result = await repository.remove(id);
      if (!result.ok) setItems(previous);
      return result;
    },
    [repository],
  );

  const value = useMemo(
    () => ({ load, items, reload, add, setQuantity, remove }),
    [load, items, reload, add, setQuantity, remove],
  );
  return <CollectionContext.Provider value={value}>{children}</CollectionContext.Provider>;
}

export function useCollection(): CollectionContextValue {
  const context = useContext(CollectionContext);
  if (!context) throw new Error('useCollection must be used inside <CollectionProvider>');
  return context;
}
