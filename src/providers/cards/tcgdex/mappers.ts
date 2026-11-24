import type { CardDetail, CardImage, CardSummary, SetSummary } from '../types';
import type { TcgdexCard, TcgdexCardBrief, TcgdexSetBrief } from './schemas';

const ASSET_ORIGIN = 'https://assets.tcgdex.net/';

/**
 * TCGdex returns extension-less base URLs; quality and format are appended per the asset docs.
 * Anything not served by the official asset host is dropped so the UI never renders arbitrary URLs.
 */
export function toCardImage(base: string | undefined): CardImage | null {
  if (!base?.startsWith(ASSET_ORIGIN)) return null;
  return { small: `${base}/low.webp`, large: `${base}/high.webp` };
}

function toAssetUrl(base: string | undefined, extension: string): string | null {
  return base?.startsWith(ASSET_ORIGIN) ? `${base}.${extension}` : null;
}

/** TCGdex card ids are `${setId}-${localId}`; local ids may themselves contain dashes. */
export function setIdFromCardId(cardId: string, localId: string): string {
  const suffix = `-${localId}`;
  return cardId.endsWith(suffix) ? cardId.slice(0, -suffix.length) : cardId;
}

export function toSetSummary(set: TcgdexSetBrief): SetSummary {
  return {
    id: set.id,
    name: set.name,
    logoUrl: toAssetUrl(set.logo, 'webp'),
    symbolUrl: toAssetUrl(set.symbol, 'webp'),
    officialCount: set.cardCount?.official ?? null,
    totalCount: set.cardCount?.total ?? null,
  };
}

export function toCardSummary(card: TcgdexCardBrief, setId?: string): CardSummary {
  return {
    id: card.id,
    tcg: 'pokemon',
    localId: card.localId,
    name: card.name,
    setId: setId ?? setIdFromCardId(card.id, card.localId),
    image: toCardImage(card.image),
  };
}

export function toCardDetail(card: TcgdexCard): CardDetail {
  return {
    ...toCardSummary(card, card.set.id),
    rarity: card.rarity ?? null,
    category: card.category ?? null,
    illustrator: card.illustrator ?? null,
    set: toSetSummary(card.set),
    variants: {
      normal: card.variants?.normal ?? true,
      reverse: card.variants?.reverse ?? false,
      holo: card.variants?.holo ?? false,
      firstEdition: card.variants?.firstEdition ?? false,
    },
  };
}
