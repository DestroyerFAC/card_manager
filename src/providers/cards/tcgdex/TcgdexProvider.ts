import { abortable } from '../../../lib/abortable';
import { localIdQuerySuffix, normalizeLocalId } from '../../../lib/cardNumber';
import { appError, type AppError } from '../../../lib/errors';
import { fetchJson } from '../../../lib/http';
import { err, ok, type Result } from '../../../lib/result';
import type {
  CardDetail,
  CardProvider,
  CardSummary,
  RequestOptions,
  SearchPage,
  SetSummary,
  SetWithCards,
} from '../types';
import { toCardDetail, toCardSummary, toSetSummary } from './mappers';
import {
  cardBriefListSchema,
  cardSchema,
  serieSchema,
  setBriefListSchema,
  setSchema,
} from './schemas';

const BASE_URL = 'https://api.tcgdex.net/v2/fr';
export const SEARCH_PAGE_SIZE = 40;
/** Digital-only TCG Pocket cards share the API with physical cards: they are not collectable. */
const DIGITAL_SERIES_ID = 'tcgp';
const ID_PATTERN = /^[\w.!?-]{1,64}$/;

interface Catalog {
  readonly sets: readonly SetSummary[];
  readonly digitalSetIds: ReadonlySet<string>;
}

/** TCGdex filter values are parsed for operators (`eq:`, `*`, `|`): user input must be inert. */
export function sanitizeFilterValue(input: string): string {
  return input.replace(/[*|]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}

function buildUrl(path: string, params: Record<string, string> = {}): string {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url.toString();
}

export class TcgdexProvider implements CardProvider {
  readonly tcg = 'pokemon' as const;
  private catalog: Promise<Result<Catalog, AppError>> | null = null;

  async searchByName(
    name: string,
    page: number,
    options: RequestOptions = {},
  ): Promise<Result<SearchPage, AppError>> {
    const value = sanitizeFilterValue(name);
    if (value.length < 2) return err(appError('validation', 'Saisissez au moins 2 caractères'));

    const [cards, catalog] = await Promise.all([
      fetchJson(
        buildUrl('/cards', {
          // Explicit `like:` so a name such as "eq:foo" can never switch the operator.
          name: `like:${value}`,
          'pagination:page': String(Math.max(1, Math.trunc(page))),
          'pagination:itemsPerPage': String(SEARCH_PAGE_SIZE),
        }),
        cardBriefListSchema,
        options,
      ),
      this.getCatalog(),
    ]);
    if (!cards.ok) return cards;

    const digital = catalog.ok ? catalog.value.digitalSetIds : new Set<string>();
    return ok({
      cards: cards.value.map((card) => toCardSummary(card)).filter((c) => !digital.has(c.setId)),
      hasMore: cards.value.length === SEARCH_PAGE_SIZE,
    });
  }

  async searchByNumber(
    number: string,
    options: RequestOptions = {},
  ): Promise<Result<readonly CardSummary[], AppError>> {
    const key = normalizeLocalId(number);
    if (!/^[A-Z]*\d+[A-Z]*$/.test(key)) return err(appError('validation', 'Numéro invalide'));

    const [cards, catalog] = await Promise.all([
      fetchJson(
        buildUrl('/cards', { localId: `*${localIdQuerySuffix(key)}` }),
        cardBriefListSchema,
        options,
      ),
      this.getCatalog(),
    ]);
    if (!cards.ok) return cards;

    const digital = catalog.ok ? catalog.value.digitalSetIds : new Set<string>();
    return ok(
      cards.value
        .filter((card) => normalizeLocalId(card.localId) === key)
        .map((card) => toCardSummary(card))
        .filter((card) => !digital.has(card.setId)),
    );
  }

  async listSets(options: RequestOptions = {}): Promise<Result<readonly SetSummary[], AppError>> {
    const catalog = await abortable(this.getCatalog(), options.signal);
    return catalog.ok ? ok(catalog.value.sets) : catalog;
  }

  async getSet(
    setId: string,
    options: RequestOptions = {},
  ): Promise<Result<SetWithCards, AppError>> {
    if (!ID_PATTERN.test(setId)) return err(appError('validation', 'Identifiant de set invalide'));
    const result = await fetchJson(
      buildUrl(`/sets/${encodeURIComponent(setId)}`),
      setSchema,
      options,
    );
    if (!result.ok) return result;
    return ok({
      set: toSetSummary(result.value),
      cards: result.value.cards.map((card) => toCardSummary(card, result.value.id)),
    });
  }

  async getCard(
    cardId: string,
    options: RequestOptions = {},
  ): Promise<Result<CardDetail, AppError>> {
    if (!ID_PATTERN.test(cardId))
      return err(appError('validation', 'Identifiant de carte invalide'));
    const result = await fetchJson(
      buildUrl(`/cards/${encodeURIComponent(cardId)}`),
      cardSchema,
      options,
    );
    return result.ok ? ok(toCardDetail(result.value)) : result;
  }

  /**
   * The set list (~200 entries) is fetched once per session and shared by every screen. The
   * request is not bound to the caller's AbortSignal because other callers may await it.
   */
  private getCatalog(): Promise<Result<Catalog, AppError>> {
    this.catalog ??= this.loadCatalog().then((result) => {
      if (!result.ok) this.catalog = null;
      return result;
    });
    return this.catalog;
  }

  private async loadCatalog(): Promise<Result<Catalog, AppError>> {
    const [sets, digital] = await Promise.all([
      fetchJson(buildUrl('/sets'), setBriefListSchema),
      fetchJson(buildUrl(`/series/${DIGITAL_SERIES_ID}`), serieSchema),
    ]);
    if (!sets.ok) return sets;
    const digitalSetIds = new Set(digital.ok ? digital.value.sets.map((s) => s.id) : []);
    return ok({
      sets: sets.value.filter((set) => !digitalSetIds.has(set.id)).map(toSetSummary),
      digitalSetIds,
    });
  }
}
