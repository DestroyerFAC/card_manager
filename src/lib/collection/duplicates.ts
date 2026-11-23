import type { CollectionItem, Condition, NewCollectionEntry, Variant } from './types';

export const MAX_QUANTITY = 9999;

interface EntryIdentity {
  readonly tcg: string;
  readonly cardId: string;
  readonly condition: Condition;
  readonly variant: Variant;
}

/** Same identity as the DB constraint `collection_items_unique_entry` (user is implicit). */
export function entryKey(entry: EntryIdentity): string {
  return `${entry.tcg}|${entry.cardId}|${entry.condition}|${entry.variant}`;
}

export type MergeOutcome =
  | {
      readonly kind: 'incremented';
      readonly items: readonly CollectionItem[];
      readonly item: CollectionItem;
    }
  | {
      readonly kind: 'inserted';
      readonly items: readonly CollectionItem[];
      readonly item: CollectionItem;
    };

/**
 * Client-side mirror of `add_collection_item` for optimistic updates. A duplicate is the same
 * card with the same condition AND variant: an NM reverse and an EX reverse are distinct rows.
 * O(n) single pass, no nested loop.
 */
export function mergeEntry(
  items: readonly CollectionItem[],
  entry: NewCollectionEntry,
  makeItem: (entry: NewCollectionEntry) => CollectionItem,
): MergeOutcome {
  const key = entryKey(entry);
  const index = items.findIndex((item) => entryKey(item) === key);
  const existing = index === -1 ? undefined : items[index];

  if (!existing) {
    const item = makeItem(entry);
    return { kind: 'inserted', items: [item, ...items], item };
  }

  const item: CollectionItem = {
    ...existing,
    quantity: Math.min(existing.quantity + entry.quantity, MAX_QUANTITY),
  };
  const next = items.slice();
  next[index] = item;
  return { kind: 'incremented', items: next, item };
}

/** Replaces the optimistic row with the server's authoritative one (matched by identity). */
export function reconcileItem(
  items: readonly CollectionItem[],
  confirmed: CollectionItem,
): readonly CollectionItem[] {
  const key = entryKey(confirmed);
  return items.map((item) => (entryKey(item) === key ? confirmed : item));
}

export function isValidQuantity(quantity: number): boolean {
  return Number.isInteger(quantity) && quantity >= 1 && quantity <= MAX_QUANTITY;
}
