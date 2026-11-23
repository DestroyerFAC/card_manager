import { useMemo } from 'react';
import { useAsyncResult } from '../../lib/hooks';
import { getCardProvider } from '../../providers/cards/registry';
import type { SetSummary } from '../../providers/cards/types';

const EMPTY: ReadonlyMap<string, SetSummary> = new Map();

/** Set list indexed by id for O(1) lookups when labelling search results. */
export function useCatalog() {
  const provider = getCardProvider();
  const { state, reload } = useAsyncResult('catalog', (signal) => provider.listSets({ signal }));
  const sets = state.status === 'success' ? state.data : null;
  const setsById = useMemo(
    () => (sets ? new Map(sets.map((set) => [set.id, set])) : EMPTY),
    [sets],
  );
  return { state, sets, setsById, reload };
}
