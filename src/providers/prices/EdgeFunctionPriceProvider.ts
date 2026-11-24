import { z } from 'zod';
import { appError, type AppError } from '../../lib/errors';
import { err, ok, type Result } from '../../lib/result';
import type { AppSupabaseClient } from '../../lib/supabase/client';
import type { CardPrice, PriceMap, PriceProvider } from './types';

const FUNCTION_NAME = 'card-prices';
/** Must match MAX_IDS_PER_REQUEST in the Edge Function. */
const BATCH_SIZE = 100;

const nullablePrice = z.number().nonnegative().nullable();
const responseSchema = z.object({
  prices: z.array(
    z.object({
      cardId: z.string(),
      currency: z.string().regex(/^[A-Z]{3}$/),
      low: nullablePrice,
      mid: nullablePrice,
      market: nullablePrice,
      holoLow: nullablePrice,
      holoMid: nullablePrice,
      holoMarket: nullablePrice,
      updatedAt: z.string(),
      stale: z.boolean(),
    }),
  ),
});

function chunk<T>(values: readonly T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < values.length; i += size) chunks.push(values.slice(i, i + size));
  return chunks;
}

export class EdgeFunctionPriceProvider implements PriceProvider {
  private readonly client: AppSupabaseClient;

  constructor(client: AppSupabaseClient) {
    this.client = client;
  }

  async getPrices(
    cardIds: readonly string[],
    options: { readonly signal?: AbortSignal } = {},
  ): Promise<Result<PriceMap, AppError>> {
    const unique = [...new Set(cardIds)];
    const prices = new Map<string, CardPrice>();
    if (unique.length === 0) return ok(prices);

    // Sequential batches: each call may refresh upstream prices, so we avoid fanning out.
    for (const batch of chunk(unique, BATCH_SIZE)) {
      if (options.signal?.aborted) return err(appError('aborted', 'Requête annulée'));
      let data: unknown;
      try {
        const response = await this.client.functions.invoke(FUNCTION_NAME, {
          body: { cardIds: batch },
          ...(options.signal ? { signal: options.signal } : {}),
        });
        if (response.error) {
          if (options.signal?.aborted) return err(appError('aborted', 'Requête annulée'));
          return err(appError('unavailable', 'Prix indisponibles pour le moment'));
        }
        data = response.data;
      } catch {
        if (options.signal?.aborted) return err(appError('aborted', 'Requête annulée'));
        return err(appError('network', 'Prix indisponibles (réseau)'));
      }

      const parsed = responseSchema.safeParse(data);
      if (!parsed.success) return err(appError('parse', 'Format de prix inattendu'));
      for (const price of parsed.data.prices) prices.set(price.cardId, price);
    }
    return ok(prices);
  }
}
