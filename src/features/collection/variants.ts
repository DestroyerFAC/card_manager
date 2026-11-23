import type { Variant } from '../../lib/collection/types';
import type { CardDetail } from '../../providers/cards/types';

/** Only variants the card actually exists in are offered (from TCGdex `variants`). */
export function availableVariants(card: CardDetail): Variant[] {
  const variants: Variant[] = [];
  if (card.variants.normal || card.variants.firstEdition) variants.push('normal');
  if (card.variants.reverse) variants.push('reverse');
  if (card.variants.holo) variants.push('holo');
  return variants.length > 0 ? variants : ['normal'];
}
