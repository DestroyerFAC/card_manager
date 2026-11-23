import { describe, expect, it } from 'vitest';
import { extractCardmarketQuote, isStale, PRICE_TTL_MS } from './pricing';

// Trimmed from a real api.tcgdex.net/v2/fr/cards/swsh3-136 response (2026-11-23).
const tcgdexCard = {
  id: 'swsh3-136',
  pricing: {
    cardmarket: {
      updated: '2026-11-22T22:16:19.123Z',
      unit: 'EUR',
      idProduct: 483559,
      avg: 0.08,
      low: 0.02,
      trend: 0.14,
      'avg-holo': 0.31,
      'low-holo': 0.08,
      'trend-holo': 0.28,
    },
    tcgplayer: { unit: 'USD' },
  },
};

describe('extractCardmarketQuote', () => {
  it('maps cardmarket fields', () => {
    expect(extractCardmarketQuote(tcgdexCard)).toEqual({
      currency: 'EUR',
      low: 0.02,
      mid: 0.08,
      market: 0.14,
      holoLow: 0.08,
      holoMid: 0.31,
      holoMarket: 0.28,
      source: 'tcgdex:cardmarket',
    });
  });

  it('returns null without cardmarket pricing', () => {
    expect(extractCardmarketQuote({ id: 'x' })).toBeNull();
    expect(extractCardmarketQuote({ pricing: { cardmarket: null } })).toBeNull();
    expect(extractCardmarketQuote({ pricing: { cardmarket: { unit: 'EUR' } } })).toBeNull();
    expect(extractCardmarketQuote(null)).toBeNull();
  });

  it('rejects negative or non-numeric values', () => {
    const quote = extractCardmarketQuote({
      pricing: { cardmarket: { low: -1, avg: '3', trend: 2.345 } },
    });
    expect(quote).toMatchObject({ low: null, mid: null, market: 2.35 });
  });
});

describe('isStale', () => {
  const now = Date.parse('2026-11-23T12:00:00Z');

  it('respects the 24h TTL', () => {
    expect(isStale(new Date(now - PRICE_TTL_MS + 1000).toISOString(), now)).toBe(false);
    expect(isStale(new Date(now - PRICE_TTL_MS).toISOString(), now)).toBe(true);
  });

  it('treats invalid dates as stale', () => {
    expect(isStale('not a date', now)).toBe(true);
  });
});
