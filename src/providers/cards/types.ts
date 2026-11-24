import type { AppError } from '../../lib/errors';
import type { Result } from '../../lib/result';

/** Extension point: a new game = a new TcgId + a new CardProvider registered in registry.ts. */
export type TcgId = 'pokemon';

export interface CardImage {
  readonly small: string;
  readonly large: string;
}

export interface SetSummary {
  readonly id: string;
  readonly name: string;
  readonly logoUrl: string | null;
  readonly symbolUrl: string | null;
  /** Number printed on cards ("025/165" → 165). Null when the source does not know it. */
  readonly officialCount: number | null;
  readonly totalCount: number | null;
}

export interface CardSummary {
  readonly id: string;
  readonly tcg: TcgId;
  readonly localId: string;
  readonly name: string;
  readonly setId: string;
  readonly image: CardImage | null;
}

export interface CardVariants {
  readonly normal: boolean;
  readonly reverse: boolean;
  readonly holo: boolean;
  readonly firstEdition: boolean;
}

export interface CardDetail extends CardSummary {
  readonly rarity: string | null;
  readonly category: string | null;
  readonly illustrator: string | null;
  readonly set: SetSummary;
  readonly variants: CardVariants;
}

export interface SearchPage {
  readonly cards: readonly CardSummary[];
  readonly hasMore: boolean;
}

export interface SetWithCards {
  readonly set: SetSummary;
  readonly cards: readonly CardSummary[];
}

export interface RequestOptions {
  readonly signal?: AbortSignal;
}

export interface CardProvider {
  readonly tcg: TcgId;
  searchByName(
    name: string,
    page: number,
    options?: RequestOptions,
  ): Promise<Result<SearchPage, AppError>>;
  /** Cards whose collector number equals `number` (any set). */
  searchByNumber(
    number: string,
    options?: RequestOptions,
  ): Promise<Result<readonly CardSummary[], AppError>>;
  listSets(options?: RequestOptions): Promise<Result<readonly SetSummary[], AppError>>;
  getSet(setId: string, options?: RequestOptions): Promise<Result<SetWithCards, AppError>>;
  getCard(cardId: string, options?: RequestOptions): Promise<Result<CardDetail, AppError>>;
}
