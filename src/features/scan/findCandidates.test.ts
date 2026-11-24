import { describe, expect, it } from 'vitest';
import { appError } from '../../lib/errors';
import { err, ok } from '../../lib/result';
import type { CardProvider, CardSummary } from '../../providers/cards/types';
import { findCandidates, nameQueryFromReading } from './findCandidates';

const card = (id: string, name: string, localId: string, setId: string): CardSummary => ({
  id,
  tcg: 'pokemon',
  name,
  localId,
  setId,
  image: null,
});

function fakeProvider(overrides: Partial<CardProvider> = {}): CardProvider {
  return {
    tcg: 'pokemon',
    searchByName: () =>
      Promise.resolve(
        ok({ cards: [card('sv03.5-025', 'Pikachu', '025', 'sv03.5')], hasMore: false }),
      ),
    searchByNumber: () =>
      Promise.resolve(
        ok([
          card('sv03.5-025', 'Pikachu', '025', 'sv03.5'),
          card('sv01-025', 'Terracool', '025', 'sv01'),
        ]),
      ),
    listSets: () =>
      Promise.resolve(
        ok([
          {
            id: 'sv03.5',
            name: '151',
            logoUrl: null,
            symbolUrl: null,
            officialCount: 165,
            totalCount: 207,
          },
        ]),
      ),
    getSet: () => Promise.resolve(err(appError('unknown', 'unused'))),
    getCard: () => Promise.resolve(err(appError('unknown', 'unused'))),
    ...overrides,
  };
}

const signal = new AbortController().signal;

describe('nameQueryFromReading', () => {
  it('keeps the longest word with its accents', () => {
    expect(nameQueryFromReading('Salamèche wv')).toBe('Salamèche');
    expect(nameQueryFromReading('Dracaufeu-ex')).toBe('Dracaufeu');
  });

  it('returns null without a usable word', () => {
    expect(nameQueryFromReading('a b')).toBeNull();
  });
});

describe('findCandidates', () => {
  it('merges number and name results and deduplicates them', async () => {
    const result = await findCandidates(
      { name: 'Pikachu', number: { key: '25', total: 165 } },
      fakeProvider(),
      signal,
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value[0]?.card.id).toBe('sv03.5-025');
    expect(result.value.filter((c) => c.card.id === 'sv03.5-025')).toHaveLength(1);
  });

  it('still answers when one of the lookups fails', async () => {
    const result = await findCandidates(
      { name: 'Pikachu', number: { key: '25', total: null } },
      fakeProvider({ searchByNumber: () => Promise.resolve(err(appError('network', 'down'))) }),
      signal,
    );
    expect(result.ok && result.value.length).toBe(1);
  });

  it('fails with a validation error on an empty reading', async () => {
    const result = await findCandidates({ name: null, number: null }, fakeProvider(), signal);
    expect(!result.ok && result.error.kind).toBe('validation');
  });
});
