import type { AppError } from '../../lib/errors';
import type { Result } from '../../lib/result';

export interface CardPrice {
  readonly cardId: string;
  readonly currency: string;
  readonly low: number | null;
  readonly mid: number | null;
  readonly market: number | null;
  readonly holoLow: number | null;
  readonly holoMid: number | null;
  readonly holoMarket: number | null;
  readonly updatedAt: string;
  /** True when the refresh budget was exhausted and the cached value is older than the TTL. */
  readonly stale: boolean;
}

export type PriceMap = ReadonlyMap<string, CardPrice>;

export interface PriceProvider {
  getPrices(
    cardIds: readonly string[],
    options?: { readonly signal?: AbortSignal },
  ): Promise<Result<PriceMap, AppError>>;
}
