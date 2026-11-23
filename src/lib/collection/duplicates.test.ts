import { describe, expect, it } from 'vitest';
import { MAX_QUANTITY, entryKey, isValidQuantity, mergeEntry, reconcileItem } from './duplicates';
import type { CollectionItem, NewCollectionEntry } from './types';

const entry = (overrides: Partial<NewCollectionEntry> = {}): NewCollectionEntry => ({
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
  ...overrides,
});

let counter = 0;
const makeItem = (e: NewCollectionEntry): CollectionItem => ({
  ...e,
  id: `tmp-${++counter}`,
  createdAt: '2026-11-23T00:00:00Z',
});

describe('mergeEntry', () => {
  it('inserts a new card at the top', () => {
    const result = mergeEntry([], entry(), makeItem);
    expect(result.kind).toBe('inserted');
    expect(result.items).toHaveLength(1);
  });

  it('increments the quantity of an exact duplicate', () => {
    const first = mergeEntry([], entry({ quantity: 2 }), makeItem);
    const second = mergeEntry(first.items, entry({ quantity: 3 }), makeItem);
    expect(second.kind).toBe('incremented');
    expect(second.items).toHaveLength(1);
    expect(second.item.quantity).toBe(5);
    expect(second.item.id).toBe(first.item.id);
  });

  it('treats another condition or variant as a distinct entry', () => {
    const base = mergeEntry([], entry(), makeItem).items;
    expect(mergeEntry(base, entry({ condition: 'EX' }), makeItem).kind).toBe('inserted');
    expect(mergeEntry(base, entry({ variant: 'reverse' }), makeItem).kind).toBe('inserted');
  });

  it('caps the quantity like the database does', () => {
    const base = mergeEntry([], entry({ quantity: MAX_QUANTITY - 1 }), makeItem).items;
    expect(mergeEntry(base, entry({ quantity: 5 }), makeItem).item.quantity).toBe(MAX_QUANTITY);
  });

  it('does not mutate the input array', () => {
    const base = mergeEntry([], entry(), makeItem).items;
    const snapshot = [...base];
    mergeEntry(base, entry(), makeItem);
    expect(base).toEqual(snapshot);
  });
});

describe('reconcileItem', () => {
  it('replaces the optimistic row with the server row', () => {
    const optimistic = mergeEntry([], entry(), makeItem).items;
    const server: CollectionItem = { ...makeItem(entry()), id: 'server-id', quantity: 4 };
    const result = reconcileItem(optimistic, server);
    expect(result).toEqual([server]);
  });
});

describe('entryKey / isValidQuantity', () => {
  it('builds identity from tcg, card, condition and variant', () => {
    expect(entryKey(entry())).toBe('pokemon|sv03.5-025|NM|normal');
  });

  it('validates quantities', () => {
    expect(isValidQuantity(1)).toBe(true);
    expect(isValidQuantity(0)).toBe(false);
    expect(isValidQuantity(1.5)).toBe(false);
    expect(isValidQuantity(MAX_QUANTITY + 1)).toBe(false);
  });
});
