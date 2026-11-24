import { extractCardmarketQuote, type PriceQuote } from './pricing.ts';

/**
 * Server-side price source. A new provider (e.g. Scrydex) is a new implementation; the
 * function's cache logic does not change.
 */
export interface PriceSource {
  readonly name: string;
  /** `null` = the source knows the card but has no price; throws only on transport failure. */
  fetchQuote(cardId: string, signal: AbortSignal): Promise<PriceQuote | null>;
}

export class TcgdexPriceSource implements PriceSource {
  readonly name = 'tcgdex:cardmarket';

  async fetchQuote(cardId: string, signal: AbortSignal): Promise<PriceQuote | null> {
    const response = await fetch(
      `https://api.tcgdex.net/v2/fr/cards/${encodeURIComponent(cardId)}`,
      { signal, headers: { Accept: 'application/json' } },
    );
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`TCGdex responded ${response.status}`);
    return extractCardmarketQuote(await response.json());
  }
}
