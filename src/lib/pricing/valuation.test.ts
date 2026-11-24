import { describe, expect, it } from 'vitest';
import type { CollectionItem } from '../collection/types';
import type { CardPrice } from '../../providers/prices/types';
import { computeCollectionValue, itemValue, unitReferencePrice } from './valuation';

const price = (cardId: string, overrides: Partial<CardPrice> = {}): CardPrice => ({
  cardId,
  currency: 'EUR',
  low: 1,
  mid: 2,
  market: 3,
  holoLow: 10,
  holoMid: 20,
  holoMarket: 30,
  updatedAt: '2026-11-23T00:00:00Z',
  stale: false,
  ...overrides,
});

const item = (overrides: Partial<CollectionItem> = {}): CollectionItem => ({
  id: 'id',
  tcg: 'pokemon',
  cardId: 'sv03.5-025',
  quantity: 1,
  condition: 'NM',
  variant: 'normal',
  cardName: 'Pikachu',
  setId: 'sv03.5',
  setName: '151',
  localId: '025',
  imageUrl: null,
  createdAt: '2026-11-23T00:00:00Z',
  ...overrides,
});

describe('unitReferencePrice', () => {
  it('prefers trend, then average, then low', () => {
    expect(unitReferencePrice(price('a'), 'normal')).toBe(3);
    expect(unitReferencePrice(price('a', { market: null }), 'normal')).toBe(2);
    expect(unitReferencePrice(price('a', { market: null, mid: null }), 'normal')).toBe(1);
  });

  it('uses holo prices for reverse/holo and falls back to standard ones', () => {
    expect(unitReferencePrice(price('a'), 'reverse')).toBe(30);
    expect(
      unitReferencePrice(price('a', { holoMarket: null, holoMid: null, holoLow: null }), 'holo'),
    ).toBe(3);
  });

  it('returns null when no price is known', () => {
    expect(
      unitReferencePrice(price('a', { market: null, mid: null, low: null }), 'normal'),
    ).toBeNull();
  });
});

describe('itemValue', () => {
  it('applies quantity and condition', () => {
    expect(itemValue(item({ quantity: 2, condition: 'EX' }), price('a'))).toBeCloseTo(5.1);
  });

  it('is null without price', () => {
    expect(itemValue(item(), undefined)).toBeNull();
  });
});

describe('computeCollectionValue', () => {
  it('returns zeros for an empty collection', () => {
    expect(computeCollectionValue([], new Map())).toEqual({
      total: 0,
      currency: 'EUR',
      cardCount: 0,
      pricedCount: 0,
      bySet: [],
    });
  });

  it('totals per set, sorted by value, and counts unpriced cards', () => {
    const items = [
      item({ id: '1', cardId: 'a', quantity: 2 }),
      item({ id: '2', cardId: 'b', variant: 'holo' }),
      item({ id: '3', cardId: 'c', setId: 'base1', setName: 'Set de Base' }),
      item({ id: '4', cardId: 'unknown', setId: 'base1', setName: 'Set de Base', quantity: 3 }),
    ];
    const prices = new Map([
      ['a', price('a')],
      ['b', price('b')],
      ['c', price('c', { market: 100 })],
    ]);

    const value = computeCollectionValue(items, prices);
    expect(value.total).toBe(136);
    expect(value.cardCount).toBe(7);
    expect(value.pricedCount).toBe(4);
    expect(value.bySet).toEqual([
      { setId: 'base1', setName: 'Set de Base', value: 100, cardCount: 4, pricedCount: 1 },
      { setId: 'sv03.5', setName: '151', value: 36, cardCount: 3, pricedCount: 3 },
    ]);
  });

  it('ignores prices in another currency', () => {
    const value = computeCollectionValue(
      [item({ cardId: 'a' })],
      new Map([['a', price('a', { currency: 'USD' })]]),
    );
    expect(value.total).toBe(0);
    expect(value.pricedCount).toBe(0);
  });

  it('does not accumulate floating point drift', () => {
    const items = Array.from({ length: 1000 }, (_, i) => item({ id: String(i), cardId: 'a' }));
    const value = computeCollectionValue(items, new Map([['a', price('a', { market: 0.1 })]]));
    expect(value.total).toBe(100);
  });
});
