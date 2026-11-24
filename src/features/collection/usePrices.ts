import { createContext, useContext } from 'react';
import { appError } from '../../lib/errors';
import { useAsyncResult, type AsyncState } from '../../lib/hooks';
import { err } from '../../lib/result';
import type { PriceMap, PriceProvider } from '../../providers/prices/types';

export const PriceProviderContext = createContext<PriceProvider | null>(null);

/** Prices for a set of cards; the key is order-independent so re-renders do not refetch. */
export function usePrices(cardIds: readonly string[]): {
  state: AsyncState<PriceMap>;
  reload: () => void;
} {
  const provider = useContext(PriceProviderContext);
  const key = cardIds.length === 0 ? null : [...new Set(cardIds)].sort().join(',');

  return useAsyncResult(key, (signal) =>
    provider
      ? provider.getPrices(cardIds, { signal })
      : Promise.resolve(err(appError('unavailable', 'Service de prix non configuré'))),
  );
}
