// Pure, dependency-free module shared by the Edge Function (Deno) and Vitest (Node).
// Keep it free of imports so it runs unchanged in both runtimes.

export const PRICE_TTL_MS = 24 * 60 * 60 * 1000;

export interface PriceQuote {
  readonly currency: string;
  readonly low: number | null;
  readonly mid: number | null;
  readonly market: number | null;
  readonly holoLow: number | null;
  readonly holoMid: number | null;
  readonly holoMarket: number | null;
  readonly source: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toPrice(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

/**
 * Extracts the Cardmarket (EUR) block embedded in a TCGdex card payload
 * (`pricing.cardmarket` with `low`/`avg`/`trend` and their `-holo` counterparts).
 * Returns null when the card has no Cardmarket listing.
 */
export function extractCardmarketQuote(card: unknown): PriceQuote | null {
  if (!isRecord(card) || !isRecord(card['pricing'])) return null;
  const cardmarket = card['pricing']['cardmarket'];
  if (!isRecord(cardmarket)) return null;

  const unit = cardmarket['unit'];
  const quote: PriceQuote = {
    currency: typeof unit === 'string' && /^[A-Z]{3}$/.test(unit) ? unit : 'EUR',
    low: toPrice(cardmarket['low']),
    mid: toPrice(cardmarket['avg']),
    market: toPrice(cardmarket['trend']),
    holoLow: toPrice(cardmarket['low-holo']),
    holoMid: toPrice(cardmarket['avg-holo']),
    holoMarket: toPrice(cardmarket['trend-holo']),
    source: 'tcgdex:cardmarket',
  };
  const hasAnyPrice = [
    quote.low,
    quote.mid,
    quote.market,
    quote.holoLow,
    quote.holoMid,
    quote.holoMarket,
  ].some((price) => price !== null);
  return hasAnyPrice ? quote : null;
}

export function isStale(updatedAt: string, now: number, ttlMs: number = PRICE_TTL_MS): boolean {
  const time = Date.parse(updatedAt);
  return Number.isNaN(time) || now - time >= ttlMs;
}

export const CARD_ID_PATTERN = /^[A-Za-z0-9_.!?-]{1,64}$/;
