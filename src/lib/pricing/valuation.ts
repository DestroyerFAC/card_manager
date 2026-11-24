import type { CollectionItem, Condition, Variant } from '../collection/types';
import type { CardPrice, PriceMap } from '../../providers/prices/types';

/**
 * Cardmarket aggregates are dominated by Near Mint listings, so lower grades are discounted.
 * Assumption (documented in README): common community heuristics, not market data.
 */
export const CONDITION_MULTIPLIERS: Record<Condition, number> = {
  NM: 1,
  EX: 0.85,
  GD: 0.65,
  PL: 0.45,
};

/** Reference price for one copy: trend first (most robust), then average, then lowest listing. */
export function unitReferencePrice(price: CardPrice, variant: Variant): number | null {
  const standard = price.market ?? price.mid ?? price.low;
  if (variant === 'normal') return standard;
  // Reverse/holo prints are listed under the "-holo" fields; fall back to the standard print.
  return price.holoMarket ?? price.holoMid ?? price.holoLow ?? standard;
}

export function itemValue(item: CollectionItem, price: CardPrice | undefined): number | null {
  if (!price) return null;
  const unit = unitReferencePrice(price, item.variant);
  if (unit === null) return null;
  return unit * CONDITION_MULTIPLIERS[item.condition] * item.quantity;
}

export interface SetValue {
  readonly setId: string;
  readonly setName: string;
  readonly value: number;
  readonly cardCount: number;
  readonly pricedCount: number;
}

export interface CollectionValue {
  readonly total: number;
  readonly currency: string;
  readonly cardCount: number;
  /** Copies with a known price: lets the UI say "estimate based on X of Y cards". */
  readonly pricedCount: number;
  readonly bySet: readonly SetValue[];
}

const roundCents = (value: number): number => Math.round(value * 100) / 100;

/**
 * Single pass over the items with O(1) map lookups: O(n + s log s) where s = number of sets.
 * Accumulates in cents to avoid floating-point drift on large collections.
 */
export function computeCollectionValue(
  items: readonly CollectionItem[],
  prices: PriceMap,
  currency = 'EUR',
): CollectionValue {
  const sets = new Map<
    string,
    { setName: string; cents: number; cardCount: number; pricedCount: number }
  >();
  let totalCents = 0;
  let cardCount = 0;
  let pricedCount = 0;

  for (const item of items) {
    const price = prices.get(item.cardId);
    const value = price && price.currency === currency ? itemValue(item, price) : null;
    const cents = value === null ? 0 : Math.round(value * 100);

    let set = sets.get(item.setId);
    if (!set) {
      set = { setName: item.setName, cents: 0, cardCount: 0, pricedCount: 0 };
      sets.set(item.setId, set);
    }
    set.cardCount += item.quantity;
    set.cents += cents;
    cardCount += item.quantity;
    totalCents += cents;
    if (value !== null) {
      set.pricedCount += item.quantity;
      pricedCount += item.quantity;
    }
  }

  const bySet = [...sets.entries()]
    .map(([setId, set]) => ({
      setId,
      setName: set.setName,
      value: roundCents(set.cents / 100),
      cardCount: set.cardCount,
      pricedCount: set.pricedCount,
    }))
    .sort((a, b) => b.value - a.value || a.setName.localeCompare(b.setName, 'fr'));

  return { total: roundCents(totalCents / 100), currency, cardCount, pricedCount, bySet };
}
