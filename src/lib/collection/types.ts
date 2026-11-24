import type { TcgId } from '../../providers/cards/types';

export const CONDITIONS = ['NM', 'EX', 'GD', 'PL'] as const;
export type Condition = (typeof CONDITIONS)[number];

export const VARIANTS = ['normal', 'reverse', 'holo'] as const;
export type Variant = (typeof VARIANTS)[number];

export const CONDITION_LABELS: Record<Condition, string> = {
  NM: 'Quasi neuf',
  EX: 'Excellent',
  GD: 'Bon',
  PL: 'Joué',
};

export const VARIANT_LABELS: Record<Variant, string> = {
  normal: 'Normale',
  reverse: 'Reverse',
  holo: 'Holo',
};

export interface CollectionItem {
  readonly id: string;
  readonly tcg: TcgId;
  readonly cardId: string;
  readonly quantity: number;
  readonly condition: Condition;
  readonly variant: Variant;
  readonly cardName: string;
  readonly setId: string;
  readonly setName: string;
  readonly localId: string;
  readonly imageUrl: string | null;
  readonly createdAt: string;
}

/** What the user chooses when adding a card; identity fields mirror the DB unique key. */
export interface NewCollectionEntry {
  readonly tcg: TcgId;
  readonly cardId: string;
  readonly quantity: number;
  readonly condition: Condition;
  readonly variant: Variant;
  readonly cardName: string;
  readonly setId: string;
  readonly setName: string;
  readonly localId: string;
  readonly imageUrl: string | null;
}
