import { TcgdexProvider } from './tcgdex/TcgdexProvider';
import type { CardProvider, TcgId } from './types';

// Adding a game only adds an entry here; consumers depend on the CardProvider interface.
const providers: Record<TcgId, CardProvider> = {
  pokemon: new TcgdexProvider(),
};

export function getCardProvider(tcg: TcgId = 'pokemon'): CardProvider {
  return providers[tcg];
}
